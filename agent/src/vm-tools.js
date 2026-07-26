// Feature parity with the Deep Agents tier, as Mastra tools.
//
// @mastra/core/workspace supplies the filesystem/sandbox tools. Everything
// here is the rest of what `vmagent` can do: the browser-backed vm* commands
// and the AutoBro browser-automation tools. The guest command strings and
// approval semantics deliberately mirror agent/src/agent.js one-for-one — the
// two tiers must behave identically, so this is a faithful port rather than a
// refactor of the working Deep Agents tier.
//
// Every tool is gated by the same approve/YOLO contract used by vmagent.

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

// The guest wraps command output with an exit-code marker; unwrap it and turn
// a non-zero exit into a throw, exactly as the Deep Agents backend does.
export function commandResult(response) {
  const match = String(response).match(/^__V86AGENT_EXIT__(\d+)\n?/);
  const output = match ? String(response).slice(match[0].length) : String(response);
  if (match && Number(match[1]) !== 0) throw new Error(`guest command exited ${match[1]}: ${output}`);
  return output;
}

// Small on-device models pass an already-decoded object where a pre-serialized
// string body is expected. Same coercion the Deep Agents tier applies.
export function coerceStringBody(value) {
  if (value == null || typeof value === 'string') return value;
  if (typeof value === 'object') return Object.keys(value).length ? JSON.stringify(value) : undefined;
  return value;
}

const INTERACTIVE_SITE = /^https?:\/\/(?:www\.)?(?:google\.[^/]+|bing\.com|duckduckgo\.com)(?:\/|$)/i;

export function createVmTools({
  guest,
  browserClient = null,
  llmClient = null,
  approveAction = async () => false,
  isYolo = () => false,
  onActivity = () => {},
} = {}) {
  if (!guest) throw new Error('createVmTools requires the guest bridge');

  const approve = async (toolName, detail) => {
    onActivity({ tool: toolName, detail, approval: true });
    if (isYolo()) return true;
    return Boolean(await approveAction(toolName, detail));
  };

  const approvedCommand = async (toolName, detail, command) => {
    if (!await approve(toolName, detail)) return 'Operation rejected by user.';
    try { return commandResult(await guest.execute(command)); }
    catch (error) { return `Error: ${error.message}`; }
  };

  const openWithAutoBro = async (url, reason) => {
    if (!browserClient) return `Error: ${reason}. AutoBro is not connected.`;
    try {
      const tab = await browserClient.command('newTab', { url }, 120_000);
      await browserClient.command('waitForLoad', { tabId: tab.tabId, timeout: 20 }, 30_000).catch(() => undefined);
      const page = await browserClient.command('pageInfo', { tabId: tab.tabId }, 30_000).catch(() => tab);
      return JSON.stringify({ switchedProvider: 'autobro', reason, tab, page });
    } catch (error) { return `Error: ${reason}; AutoBro fallback also failed: ${error.message}`; }
  };

  const tools = {};

  tools.vmfetch = createTool({
    id: 'vmfetch',
    description: 'Fetch a CORS-enabled HTTP API/resource when the guest has no route. Cannot operate interactive websites, scrape Google Search, bypass CORS, or automate a browser. HTTPS/localhost only; 16 MiB limit. Requires approval.',
    inputSchema: z.object({
      url: z.string(),
      output: z.string().default('-'),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
      headers: z.array(z.string()).default([]),
      data: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    }),
    execute: async ({ url, output = '-', method = 'GET', headers = [], data: rawData }) => {
      const data = coerceStringBody(rawData);
      const detail = { url, output, method, headers, hasBody: data != null };
      if (!await approve('vmfetch', detail)) return 'Operation rejected by user.';
      if (INTERACTIVE_SITE.test(url)) return await openWithAutoBro(url, 'interactive search sites cannot be fetched through CORS');
      const command = [
        'vmfetch', '-o', shellQuote(output), '-X', shellQuote(method),
        ...headers.flatMap(header => ['-H', shellQuote(header)]),
        ...(data == null ? [] : ['-d', shellQuote(data)]),
        shellQuote(url),
      ].join(' ');
      try { return commandResult(await guest.execute(command)); }
      catch (error) {
        if (method === 'GET') return await openWithAutoBro(url, `vmfetch failed: ${error.message}`);
        return `Error: ${error.message}; automatic browser fallback is disabled for non-GET requests`;
      }
    },
  });

  tools.vmgithub = createTool({
    id: 'vmgithub',
    description: 'Read GitHub metadata/API or download a repository archive through browser fetch. Not full Git; CORS/rate limits apply. Requires approval.',
    inputSchema: z.object({
      action: z.enum(['repo', 'api', 'archive']),
      repository: z.string().default(''),
      path: z.string().default(''),
      ref: z.string().default('HEAD'),
      output: z.string().default('source.tar.gz'),
    }),
    execute: async ({ action, repository = '', path = '', ref = 'HEAD', output = 'source.tar.gz' }) => {
      let command;
      if (action === 'repo') command = `vmgithub repo ${shellQuote(repository)}`;
      else if (action === 'api') command = `vmgithub api ${shellQuote(path)}`;
      else command = `vmgithub archive ${shellQuote(repository)} ${shellQuote(ref)} ${shellQuote(output)}`;
      const result = await approvedCommand('vmgithub', { action, repository, path, ref, output }, command);
      if (String(result).startsWith('Error:') && browserClient && action !== 'api') {
        return await openWithAutoBro(`https://github.com/${repository}`, `vmgithub ${action} failed`);
      }
      return result;
    },
  });

  tools.vmclip = createTool({
    id: 'vmclip',
    description: 'Read or write the system clipboard through the browser. Browser permission or a user gesture may be required. Requires approval.',
    inputSchema: z.object({ action: z.enum(['read', 'write']), text: z.string().optional() }),
    execute: async ({ action, text }) => {
      const command = action === 'read' ? 'vmclip read' : `printf %s ${shellQuote(text || '')} | vmclip write`;
      const result = await approvedCommand('vmclip', { action, textLength: text?.length || 0 }, command);
      if (String(result).startsWith('Error:') && browserClient && action === 'write') {
        try { return JSON.stringify({ switchedProvider: 'autobro', reason: result, result: await browserClient.command('typeText', { text: text || '' }, 30_000) }); }
        catch (error) { return `${result}; AutoBro typing fallback also failed: ${error.message}`; }
      }
      return result;
    },
  });

  tools.vmexport = createTool({
    id: 'vmexport',
    description: 'Download one guest file through the browser, maximum 8 MiB. Requires approval.',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => approvedCommand('vmexport', { path }, `vmexport ${shellQuote(path)}`),
  });

  tools.vmai = createTool({
    id: 'vmai',
    description: 'Call an OpenAI-compatible Responses API using the guest OPENAI_API_KEY and browser fetch. Never exposes the key to the model. Requires approval.',
    inputSchema: z.object({ prompt: z.string(), model: z.string().optional(), baseUrl: z.string().optional() }),
    execute: async ({ prompt, model, baseUrl }) => {
      const environment = `${model ? `OPENAI_MODEL=${shellQuote(model)} ` : ''}${baseUrl ? `OPENAI_BASE_URL=${shellQuote(baseUrl)} ` : ''}`;
      return approvedCommand('vmai', { model, baseUrl, promptLength: prompt.length }, `${environment}vmai ${shellQuote(prompt)}`);
    },
  });

  tools.vmllm_info = createTool({
    id: 'vmllm_info',
    description: 'Inspect the page-local LiteRT-LM status or cached model list. Chat is intentionally excluded to avoid recursive inference.',
    inputSchema: z.object({ operation: z.enum(['status', 'models']) }),
    execute: async ({ operation }) => {
      try { return commandResult(await guest.execute(`vmllm ${operation}`)); }
      catch (error) { return `Error: ${error.message}`; }
    },
  });

  if (!browserClient) return tools;

  // --- AutoBro browser automation -----------------------------------------
  // Mirrors the Deep Agents tier, including its once-per-turn guard: the
  // small model otherwise re-runs a completed browser task repeatedly.
  let currentExecution = null;
  const AUTOBRO_COMMANDS = new Set([
    'pageInfo', 'inventoryCurrentPage', 'visibleActions', 'relatedActions',
    'extractGrids', 'findSearchAction', 'fillInput', 'setSelect', 'elementState',
    'dispatchKey', 'clickAtXY', 'typeText', 'pressKey', 'scroll', 'waitForElement',
    'waitForLoad', 'waitNetworkIdle', 'gotoUrl', 'currentTab', 'newTab', 'gwClick',
  ]);

  tools.browser_search = createTool({
    id: 'browser_search',
    description: 'Search Google, Bing, or DuckDuckGo in a real AutoBro-controlled Chrome tab. Use this — not vmfetch — when asked to search the web. Requires approval unless YOLO is active.',
    inputSchema: z.object({ query: z.string(), engine: z.enum(['google', 'bing', 'duckduckgo']).default('google') }),
    execute: async ({ query, engine = 'google' }) => {
      if (currentExecution) return `AUTOBRO_EXECUTION_COMPLETE\n${currentExecution.text}`;
      const base = engine === 'bing' ? 'https://www.bing.com/search?q='
        : engine === 'duckduckgo' ? 'https://duckduckgo.com/?q='
        : 'https://www.google.com/search?q=';
      const url = base + encodeURIComponent(query);
      if (!await approve('browser_search', { engine, query, url })) return 'Browser search rejected by user.';
      try {
        const tab = await browserClient.command('newTab', { url }, 120_000);
        await browserClient.command('waitForLoad', { tabId: tab.tabId, timeout: 20 }, 30_000).catch(() => undefined);
        const page = await browserClient.command('pageInfo', { tabId: tab.tabId }, 30_000).catch(() => tab);
        const text = ['AutoBro task completed.', `Search: ${query}`, `Engine: ${engine}`,
          `Final page: ${page?.title || '(untitled)'}${page?.url ? ` — ${page.url}` : ''}`].join('\n');
        currentExecution = { text };
        return `AUTOBRO_EXECUTION_COMPLETE\n${text}`;
      } catch (error) { return `Browser search error: ${error.message}`; }
    },
  });

  tools.autobro_command = createTool({
    id: 'autobro_command',
    description: 'Control the user-authorized Chrome browser through AutoBro bridge-v3 with a known low-level command (gotoUrl, newTab, pageInfo, fillInput, pressKey, clickAtXY, scroll, waitForLoad, ...). Pass command fields in parameters. Requires approval unless YOLO is active.',
    inputSchema: z.object({ command: z.string(), parameters: z.record(z.string(), z.unknown()).default({}) }),
    execute: async ({ command, parameters = {} }) => {
      if (currentExecution) return `AUTOBRO_EXECUTION_COMPLETE\nA browser task already ran during this turn.\n${currentExecution.text}`;
      const fallbackUrl = ['gotoUrl', 'newTab'].includes(command) ? parameters?.url : null;
      const canFetchFallback = fallbackUrl && /^https:\/\//i.test(fallbackUrl);
      if (!await approve('autobro_command', { command, parameters })) return 'Browser operation rejected by user.';
      let result;
      try { result = await browserClient.command(command, parameters, 120_000); }
      catch (error) {
        if (canFetchFallback) {
          try {
            const raw = commandResult(await guest.execute(`vmfetch -o - ${shellQuote(fallbackUrl)}`));
            return JSON.stringify({ switchedProvider: 'vmfetch', reason: `AutoBro ${command} failed: ${error.message}`, content: raw });
          } catch (fetchError) { return `AutoBro error: ${error.message}; vmfetch fallback also failed: ${fetchError.message}`; }
        }
        return `AutoBro error: ${error.message}; no equivalent vm* fallback exists for ${command}`;
      }
      if (command === 'captureScreenshot' && result?.data) {
        return JSON.stringify({ ...result, data: '<omitted from text context>', byteLength: Math.ceil(result.data.length * 3 / 4) });
      }
      const output = typeof result === 'string' ? result : JSON.stringify(result);
      return output.length > 60000 ? `${output.slice(0, 60000)}\n[AutoBro result truncated]` : output;
    },
  });

  // Needs the page-local model to plan, so only offered when one is present.
  if (llmClient?.chat) {
    tools.autobro_automate = createTool({
      id: 'autobro_automate',
      description: 'Preferred tool for natural-language browser tasks when AutoBro is connected. Gives the live page, its exact visible controls and relevant skills to the page-local model, validates the resulting command sequence, then executes it. Use autobro_command only for an already-known low-level command.',
      inputSchema: z.object({
        instruction: z.string().min(1).optional(),
        command: z.string().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
      }),
      execute: async args => {
        // The small model often reaches for autobro_command's shape instead;
        // derive a usable instruction rather than failing the turn.
        const instruction = typeof args.instruction === 'string' && args.instruction
          ? args.instruction
          : [args.command, args.parameters?.url || args.parameters?.query || args.parameters?.text].filter(Boolean).join(' ');
        if (!instruction) return 'autobro_automate needs an instruction.';
        if (currentExecution) {
          return `AUTOBRO_EXECUTION_COMPLETE\nA browser automation sequence has already run during this turn. Do not run another browser tool.\n${currentExecution.text}`;
        }
        if (!await approve('autobro_automate', { instruction })) return 'Browser automation rejected by user.';

        const page = await browserClient.command('inventoryCurrentPage', {}, 30_000)
          .catch(() => browserClient.command('pageInfo', {}, 30_000).catch(() => ({})));
        const relatedActions = await browserClient.command('relatedActions', { args: [instruction, 12] }, 30_000).catch(() => []);
        const skills = await browserClient.command('skills', { q: instruction, limit: 2, maxChars: 1200 }, 30_000).catch(() => []);
        const compactPage = {
          url: page?.url,
          title: page?.title || page?.pageTitle,
          controls: (page?.controls || []).slice(0, 30).map(({ tag, type, id, name, label, disabled, readonly }) => ({ tag, type, id, name, label, disabled, readonly })),
          actions: (page?.actions || []).slice(0, 20).map(({ id, text, tag, dataGwClick }) => ({ id, text, tag, dataGwClick })),
          relatedActions: (relatedActions || []).slice(0, 12),
        };
        const skillContext = (Array.isArray(skills) ? skills : skills?.skills || []).slice(0, 2)
          .map(skill => ({ path: skill.path, content: String(skill.content || '').slice(0, 1200) }));

        const completion = await llmClient.chat({
          model: llmClient.modelName,
          temperature: 0,
          max_tokens: 1024,
          chat_template_kwargs: { enable_thinking: false },
          messages: [
            { role: 'system', content: 'Convert the browser task into the smallest safe AutoBro command sequence. Return only JSON: {"steps":[{"command":"commandName","args":[],"tabId":1}]}. Use exact selectors and action IDs from page context; never invent selectors.' },
            { role: 'user', content: `Task: ${instruction}\nAllowed commands: ${[...AUTOBRO_COMMANDS].join(', ')}\nCurrent page: ${JSON.stringify(compactPage)}\nRelevant skills: ${JSON.stringify(skillContext)}` },
          ],
        });

        const raw = String(completion?.choices?.[0]?.message?.content ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        let plan;
        try { plan = JSON.parse(raw); }
        catch {
          const start = raw.indexOf('{');
          const end = raw.lastIndexOf('}');
          plan = start >= 0 && end > start ? JSON.parse(raw.slice(start, end + 1)) : {};
        }
        let steps = Array.isArray(plan?.steps) ? plan.steps : [];
        if (!steps.length || steps.length > 12) throw new Error('planner returned no usable AutoBro steps');

        // The small model tends to emit the same step repeatedly; collapse an
        // exactly-repeating sequence back down to one period.
        const signatures = steps.map(step => JSON.stringify({ command: step?.command, args: step?.args || [], tabId: step?.tabId || null }));
        for (let period = 1; period <= Math.floor(steps.length / 2); period += 1) {
          if (steps.length % period === 0 && signatures.every((signature, index) => signature === signatures[index % period])) {
            steps = steps.slice(0, period);
            break;
          }
        }

        const results = [];
        for (const step of steps) {
          if (!step || !AUTOBRO_COMMANDS.has(step.command)) throw new Error(`planner selected unsupported AutoBro command: ${step?.command || '<missing>'}`);
          if (step.args != null && !Array.isArray(step.args)) throw new Error(`AutoBro ${step.command} args must be an array`);
          const parameters = { ...(step.args?.length ? { args: step.args } : {}), ...(step.tabId ? { tabId: step.tabId } : {}) };
          results.push({ command: step.command, result: await browserClient.command(step.command, parameters, 120_000) });
        }

        const finalPage = await browserClient.command('pageInfo', {}, 30_000).catch(() => null);
        const stepLines = results.map(({ command, result }, index) => `${index + 1}. ${command}: ${typeof result === 'string' ? result : JSON.stringify(result)}`);
        const pageLine = finalPage
          ? `Final page: ${finalPage.title || finalPage.pageTitle || '(untitled)'}${finalPage.url ? ` — ${finalPage.url}` : ''}`
          : 'Final page: unavailable';
        const text = ['AutoBro task completed.', `Task: ${instruction}`, ...stepLines, pageLine].join('\n');
        currentExecution = { text };
        return `AUTOBRO_EXECUTION_COMPLETE\nThe browser task ran exactly once. Report its results directly.\n${text}`;
      },
    });
  }

  // Lets a caller clear the once-per-turn browser guard between agent runs.
  Object.defineProperty(tools, 'resetTurn', {
    value: () => { currentExecution = null; },
    enumerable: false,
  });

  return tools;
}

/**
 * Match paths by pattern in a single guest round-trip.
 *
 * `list_files` already accepts a glob `pattern`, so this is not a missing
 * capability — it is a missing *correct* one. Measured against the real guest,
 * list_files costs 2 round-trips to this tool's 1 (it reads .gitignore first),
 * and it renders a tree truncated at depth 2, so a file three directories down
 * simply is not in the answer. This returns flat paths at any depth.
 *
 * Note the matcher is the guest's `find -path`, not picomatch: `*` crosses `/`
 * there. So "*.md" is the recursive form and "**\/*.md" is the narrower one,
 * which is backwards from what a model expects — hence the blunt warning in
 * the tool description.
 *
 * Unlike the tools above, this is on by default — see enableGlob.
 */
export function createGlobTool({ guest } = {}) {
  if (!guest) throw new Error('createGlobTool requires the guest bridge');
  return {
    glob: createTool({
      id: 'glob',
      description:
        'Find files by path pattern, e.g. "*.md" or "src/*.js". ' +
        'IMPORTANT: "*" matches across directories here, so "*.md" finds every .md ' +
        'file at any depth. Do NOT write "**/*.md" — the leading "**/" requires a ' +
        'slash and so skips files in the top directory. ' +
        'Returns matching paths relative to the project directory.',
      inputSchema: z.object({
        pattern: z.string(),
        path: z.string().default('/'),
      }),
      execute: async ({ pattern, path = '/' }) => {
        const relative = String(path).replace(/^\/+/, '') || '.';
        const raw = await guest.glob(pattern, relative);
        const paths = String(raw ?? '')
          .split('\n')
          .filter(Boolean)
          // The guest emits "type<sep>path<sep>size", where the separator is
          // the literal two characters backslash-t, not a tab — BusyBox stat
          // does not interpret the \t in its format string. Keep files, drop
          // directories, and report the path alone: type and size are noise
          // here and the model pays for every token of it.
          .map(line => line.split(/\\t|\t/))
          .filter(([type]) => type !== 'directory')
          .map(([, entryPath]) => entryPath)
          .filter(Boolean);
        if (!paths.length) return `No files match ${pattern}`;
        return `${paths.length} match${paths.length === 1 ? '' : 'es'}:\n${paths.join('\n')}`;
      },
    }),
  };
}

/**
 * Replace Mastra's grep with the guest's own.
 *
 * Mastra's workspace grep walks the tree and reads every file over the bridge
 * to search it client-side. Measured against a booted guest on a six-file
 * project: 34 round-trips and 6576 ms, against 468 ms and one round-trip for
 * `guest.grep`, for identical results. The gap scales with the file count, so
 * on a real project it is far worse than 14x.
 *
 * The trade is option richness — Mastra's grep offers context lines and its
 * own glob filtering, this is the guest's `grep -R -n -F`. Fixed-string, no
 * context. On a guest where every file read is ~450 ms, that is the right
 * side of the trade, and it is the same shape the Deep Agents tier uses.
 */
export function createGrepTool({ guest } = {}) {
  if (!guest) throw new Error('createGrepTool requires the guest bridge');
  return {
    grep: createTool({
      id: 'grep',
      description:
        'Search file contents for a literal string across the project, e.g. "TODO". ' +
        'Matches are plain text, not regular expressions. ' +
        'Returns "path:line:text" for each match.',
      inputSchema: z.object({
        pattern: z.string(),
        path: z.string().default('/'),
      }),
      execute: async ({ pattern, path = '/' }) => {
        const relative = String(path).replace(/^\/+/, '') || '.';
        const raw = await guest.grep(pattern, relative);
        const lines = String(raw ?? '').split('\n').filter(Boolean);
        if (!lines.length) return `No matches for ${pattern}`;
        return `${lines.length} match${lines.length === 1 ? '' : 'es'}:\n${lines.join('\n')}`;
      },
    }),
  };
}
