export class VmAgentController {
  constructor({ createAgent, createMastraAgent = null, createCodeAgent = null, createClineAgent = null, getLlmClient, getGuest, getBrowserClient = () => null, approveAction, onOutput = () => {}, onActivity = () => {}, onBusy = () => {} }) {
    Object.assign(this, { createAgent, createMastraAgent, createCodeAgent, createClineAgent, getLlmClient, getGuest, getBrowserClient, approveAction, onOutput, onActivity, onBusy });
    this.harness = null;
    this.mastraHarness = null;
    this.codeHarness = null;
    this.clineHarness = null;
    // Matches what index.html asks for, and switchable at runtime with
    // `vmmastra tools lean|full`.
    this.mastraFullTools = true;
    this.abortController = null;
    this.yolo = true;
    this.conversationActive = false;
    this.completedRuns = new Map();
  }

  route(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return {}; }
  }

  llm(agent, route) {
    return this.getLlmClient(agent, this.route(route));
  }

  routeKey(agent, route) {
    const value = this.route(route);
    return `${agent}:${value.sessionId || value.session || ''}:${value.provider || ''}:${value.model || ''}`;
  }

  resetHarness() { this.harness = null; this.mastraHarness = null; this.codeHarness = null; this.clineHarness = null; this.completedRuns.clear(); }

  async handleCline(command, value, cwd = '', route = '') {
    if (command === 'cline_stop') {
      if (!this.clineHarness || !this.abortController) return await this.onOutput('[cline] no task is running.');
      this.clineHarness.stop();
      this.abortController.abort();
      return await this.onOutput('[cline] stop requested.');
    }
    if (command === 'cline_reset') {
      this.clineHarness?.stop();
      this.clineHarness = null;
      this.clineRouteKey = null;
      return await this.onOutput('[cline] conversation reset.');
    }
    if (command === 'cline_yolo') {
      if (value === 'on' && !this.yolo) this.yolo = await this.approveAction('enable_yolo', {
        scope: 'current browser page session',
        warning: 'Cline may overwrite guest files and run arbitrary shell commands without further approval.',
      });
      if (value === 'off') this.yolo = false;
      this.clineHarness?.setYolo(this.yolo);
      return await this.onOutput(`[cline] YOLO ${this.yolo ? 'on' : 'off'} (shared with other agents).`);
    }
    const guest = this.getGuest();
    if (!guest) return await this.onOutput('[cline] guest bridge is still initializing.');
    const llmClient = this.llm('cline', route);
    const model = llmClient?.status ? await llmClient.status().catch(() => null) : null;
    if (command === 'cline_status') return await this.onOutput([
      `[cline] ${this.abortController ? 'running' : 'idle'}`,
      `  model: ${model?.modelName || 'not configured'}`,
      `  YOLO:  ${this.yolo ? 'on' : 'off'}`,
      `  session: ${this.clineHarness ? 'active' : 'not started'}`,
    ].join('\n'));
    if (!this.createClineAgent) return await this.onOutput('[cline] tier is not available in this build.');
    if (!llmClient) return await this.onOutput('[cline] no model is configured; load a local model or select a cloud provider in Settings.');
    if (this.abortController) return await this.onOutput('[cline] another agent task is running.');
    const key = this.routeKey('cline', route);
    const workspace = String(cwd || '/root/project');
    if (this.clineRouteKey !== key || this.clineWorkspace !== workspace) {
      this.clineHarness?.stop();
      this.clineHarness = null;
    }
    this.clineRouteKey = key;
    this.clineWorkspace = workspace;
    this.clineHarness ||= await this.createClineAgent({
      guest, llmClient, workspace, yolo: this.yolo,
      approveAction: (operation, detail) => this.approveAction(operation, detail),
      onActivity: event => this.onActivity(event),
    });
    this.clineHarness.setYolo(this.yolo);
    this.abortController = new AbortController();
    await this.onBusy(true);
    try {
      const result = command === 'cline_continue'
        ? await this.clineHarness.continue(value)
        : await this.clineHarness.run(value);
      const summary = result?.outputText || result?.messages?.at(-1)?.content?.find(part => part.type === 'text')?.text;
      await this.onOutput(String(summary || '[cline] task completed without a text summary.'));
    } catch (error) {
      await this.onOutput(`[cline] error: ${error.message}`);
    } finally {
      this.abortController = null;
      await this.onBusy(false);
    }
  }

  // Everything the Mastra harness can do, reachable from `vmmastra` in the guest
  // shell. Subcommands arrive as separate AGENT_MASTRA_* operations, matching
  // how vmlang's status/stop/reset/yolo are routed.
  async handleMastra(command, value, route = '') {
    // Cheap, harness-free commands first — these must work before any agent is
    // loaded, otherwise `vmmastra status` cannot tell you why it is not ready.
    if (command === 'mastra_stop') {
      // Cancel any in-flight code harness task first
      this.codeHarness?.stop();
      if (!this.abortController && !this.codeHarness?.abortController) {
        return await this.onOutput('[vmmastra] no task is running.');
      }
      this.abortController?.abort();
      return await this.onOutput('[vmmastra] stop requested.');
    }
    if (command === 'mastra_reset') {
      this.codeHarness?.reset();
      this.codeHarness = null;
      this.mastraHarness = null;
      return await this.onOutput('[vmmastra] session reset; the next run rebuilds it.');
    }
    if (command === 'mastra_yolo') {
      if (value === 'on' && !this.yolo) {
        this.yolo = await this.approveAction('enable_yolo', {
          scope: 'current browser page session',
          warning: 'The agent may overwrite/delete guest files and run arbitrary shell commands without further approval.',
        });
      }
      if (value === 'off') this.yolo = false;
      this.mastraHarness?.setYolo?.(this.yolo);
      return await this.onOutput(`[vmmastra] YOLO ${this.yolo ? 'on' : 'off'} (shared with vmlang).`);
    }
    if (command === 'mastra_code') return await this.handleMastraCode(value, '', route);
    if (command === 'mastra_tools' && (value === 'lean' || value === 'full')) {
      const wanted = value === 'full';
      if (wanted !== this.mastraFullTools) {
        this.mastraFullTools = wanted;
        // The tool set is fixed when the agent is constructed, so switching
        // profiles has to discard the harness rather than mutate it.
        this.mastraHarness = null;
      }
      return await this.onOutput(`[vmmastra] tool profile: ${value}${wanted ? ' (20 tools)' : ' (9 workspace tools)'}.`);
    }

    const guest = this.getGuest();
    if (!guest) return await this.onOutput('[vmmastra] guest bridge is still initializing.');
    const llmClient = this.llm('vmmastra', route);
    const mastraRouteKey = this.routeKey('vmmastra', route);
    if (this.mastraRouteKey && this.mastraRouteKey !== mastraRouteKey) this.mastraHarness = null;
    this.mastraRouteKey = mastraRouteKey;
    const model = llmClient && typeof llmClient.status === 'function'
      ? await llmClient.status().catch(() => null)
      : null;

    if (command === 'mastra_status') {
      const lines = [
        `[vmmastra] ${this.abortController ? 'running' : 'idle'}`,
        `  model:   ${model?.modelName || 'not configured — use Configure LLM in the header'}`,
        `  YOLO:    ${this.yolo ? 'on' : 'off'} (shared with vmlang)`,
        `  profile: ${this.mastraFullTools ? 'full (20 tools)' : 'lean (9 workspace tools)'}`,
        `  session: ${this.mastraHarness ? 'built' : 'not built — starts on first run'}`,
      ];
      // Only report the prompt budget if the harness is already up; building
      // it just to answer `status` would import 9.7 MB as a side effect.
      if (this.mastraHarness?.systemPromptCost) {
        const cost = await this.mastraHarness.systemPromptCost().catch(() => null);
        if (cost) lines.push(`  prompt:  ~${cost.approxTokens} tokens across ${cost.toolCount} tools (${Math.round((cost.approxTokens / 16384) * 100)}% of a 16k window)`);
      }
      return await this.onOutput(lines.join('\n'));
    }

    // Remaining commands need the harness, which needs a model.
    if (!llmClient) return await this.onOutput('[vmmastra] WebGPU LLM is not ready; use Configure LLM in the browser header.');
    if (model && !model.modelName) {
      return await this.onOutput('[vmmastra] no model loaded; click "Configure LLM" in the header, load a .litertlm model, then run vmmastra again.');
    }

    const harness = async () => {
      this.mastraHarness ||= await this.createMastraAgent({
        guest,
        llmClient,
        browserClient: this.getBrowserClient(),
        yolo: this.yolo,
        fullTools: this.mastraFullTools,
        approveAction: (operation, detail) => this.approveAction(operation, detail),
        onActivity: event => this.onActivity(event),
      });
      this.mastraHarness.setYolo?.(this.yolo);
      return this.mastraHarness;
    };

    if (command === 'mastra_tools') {
      if (!this.createMastraAgent) return await this.onOutput('[vmmastra] tier is not available in this build.');
      try {
        const names = await (await harness()).listTools();
        return await this.onOutput([`[vmmastra] ${names.length} tools active:`, ...names.map(name => `  ${name}`)].join('\n'));
      } catch (error) { return await this.onOutput(`Mastra error: ${error.message}`); }
    }
    if (command === 'mastra_cost') {
      if (!this.createMastraAgent) return await this.onOutput('[vmmastra] tier is not available in this build.');
      try {
        const cost = await (await harness()).systemPromptCost();
        return await this.onOutput(
          `[vmmastra] system prompt ~${cost.approxTokens} tokens (${cost.chars} chars) across ${cost.toolCount} tools — ` +
          `${Math.round((cost.approxTokens / 16384) * 100)}% of a 16k window.`,
        );
      } catch (error) { return await this.onOutput(`Mastra error: ${error.message}`); }
    }

// Default: run a task. `vmmastra batch` tries a one-shot script first and
    // falls back to the tool loop if it does not exit clean — codeact's speed
    // without codeact's habit of reporting a half-finished script as success.
    if (!this.createMastraAgent) return await this.onOutput('[vmmastra] tier is not available in this build.');
    if (this.abortController) return await this.onOutput('[vmmastra] another agent task is running.');
    this.abortController = new AbortController();
    await this.onBusy(true);
    try {
      const output = await (await harness()).run(value, { batchFirst: command === 'mastra_batch' });
      await this.onOutput(String(output || '').trim() || '[vmmastra] the agent returned no output.');
    } catch (error) {
      await this.onOutput(`Mastra error: ${error.message}`);
    } finally {
      this.abortController = null;
      await this.onBusy(false);
    }
  }

  async handleMastraCode(value, cwd = '', route = '') {
    if (!this.createCodeAgent) return await this.onOutput('[vmmastra] code tier is not available in this build.');

    const guest = this.getGuest();
    if (!guest) return await this.onOutput('[vmmastra] guest bridge is still initializing.');
    const workspace = String(cwd || '/root/project');
    if (workspace !== this.codeWorkspace) {
      await this.codeHarness?.reset();
      this.codeHarness = null;
      this.codeWorkspace = workspace;
    }
    guest.setWorkspace?.(workspace);
    const llmClient = this.llm('vmmastra', route);
    const codeRouteKey = this.routeKey('vmmastra-code', route);
    if (this.codeRouteKey && this.codeRouteKey !== codeRouteKey) {
      await this.codeHarness?.reset();
      this.codeHarness = null;
    }
    this.codeRouteKey = codeRouteKey;
    if (!llmClient) return await this.onOutput('[vmmastra] WebGPU LLM is not ready; use Configure LLM in the browser header.');

    const subcmd = String(value ?? '');

    // `vmmastra code threads` — list saved threads
    if (subcmd === 'threads') {
      try {
        this.codeHarness ||= await this.createCodeAgent({
          guest, llmClient, browserClient: this.getBrowserClient(),
          yolo: this.yolo, approveAction: this.approveAction,
          onActivity: e => this.onActivity(e), onOutput: m => this.onOutput(m),
        });
        const threads = await this.codeHarness.listThreads();
        if (!threads.length) return await this.onOutput('[vmmastra-code] no saved threads.');
        const lines = threads.map(t =>
          `  ${t.id}  ${t.mode}  ${t.messages.length} msgs  ${new Date(t.updatedAt).toLocaleString()}`);
        return await this.onOutput(['[vmmastra-code] saved threads:', ...lines].join('\n'));
      } catch (error) { return await this.onOutput(`[vmmastra-code] error: ${error.message}`); }
    }

    // `vmmastra code reset` — drop the current thread
    if (subcmd === 'reset') {
      try {
        this.codeHarness ||= await this.createCodeAgent({
          guest, llmClient, browserClient: this.getBrowserClient(),
          yolo: this.yolo, approveAction: this.approveAction,
          onActivity: e => this.onActivity(e), onOutput: m => this.onOutput(m),
        });
        await this.codeHarness.reset();
        return await this.onOutput('[vmmastra-code] current thread reset.');
      } catch (error) { return await this.onOutput(`[vmmastra-code] error: ${error.message}`); }
    }

    // `vmmastra code TASK...` — run one task
    // or `vmmastra code` — read one line interactively in the guest
    const task = subcmd.startsWith('run:') ? subcmd.slice(4) : subcmd;

    this.codeHarness ||= await this.createCodeAgent({
      guest, llmClient, browserClient: this.getBrowserClient(),
      yolo: this.yolo, approveAction: this.approveAction,
      onActivity: e => this.onActivity(e), onOutput: m => this.onOutput(m),
    });
    this.codeHarness.setYolo(this.yolo);

    if (!task) {
      return await this.onOutput('[vmmastra-code] type a message or use /help for commands.');
    }

    if (this.abortController) return await this.onOutput('[vmmastra-code] another task is running.');
    this.abortController = new AbortController();
    await this.onBusy(true);
    try {
      const result = await this.codeHarness.run(task);
      await this.onOutput(result.content ?? result.message ?? String(result));
    } catch (error) {
      await this.onOutput(`[vmmastra-code] error: ${error.message}`);
    } finally {
      this.abortController = null;
      await this.onBusy(false);
    }
  }
  closeConversation() { this.conversationActive = false; }

  async runRig(prompt, route = '') {
    const llm = this.llm('rig', route);
    const guest = this.getGuest();
    if (!llm || !guest) throw new Error('model or VM bridge is not ready');
    const tools = [
      { type: 'function', function: { name: 'read_file', description: 'Read a UTF-8 project file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
      { type: 'function', function: { name: 'list_directory', description: 'List a project directory', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
      { type: 'function', function: { name: 'write_file', description: 'Write a UTF-8 project file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
      { type: 'function', function: { name: 'shell', description: 'Run a shell command in the project', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } },
    ];
    const messages = [
      { role: 'system', content: 'You are a concise coding agent in /root/project on 32-bit Alpine Linux with BusyBox sh. Read /usr/local/share/vm-agent-capabilities.md for the canonical installed-tool and workflow reference. Installed commands include BusyBox utilities, jq, rg, git, curl, tar, gzip, qjs, vmjs, shfmt, ctags, make, patch, k6, and vmproject; ShellCheck is not installed in this fixed-size i686 image. Use Grafana k6 for JavaScript HTTP/API performance and load tests. Format and verify shell scripts with shfmt and sh -n. Remote curl, git, and k6 targets require a default route; without one use vmfetch or vmgithub archive when available. Use vmproject import/export for project archives. AutoBro is not available in this Rig tool set. Use tools only when needed, verify changes, then answer directly.' },
      { role: 'user', content: String(prompt) },
    ];
    for (let turn = 0; turn < 6; turn += 1) {
      const completion = await llm.chat({ model: llm.modelName || 'webgpu', temperature: 0, max_tokens: 1000, chat_template_kwargs: { enable_thinking: false }, messages, tools });
      const message = completion?.choices?.[0]?.message || {};
      const call = message.tool_calls?.[0];
      if (!call) return String(message.content || '');
      const name = call.function?.name;
      const args = JSON.parse(call.function?.arguments || '{}');
      let result;
      if (name === 'read_file') result = await guest.read(args.path);
      else if (name === 'list_directory') result = await guest.list(args.path || '.');
      else if (name === 'write_file') {
        if (!this.yolo && !await this.approveAction('write_file', args)) result = 'Operation rejected.';
        else result = await guest.write(args.path, args.content);
      } else if (name === 'shell') {
        if (!this.yolo && !await this.approveAction('execute', args)) result = 'Operation rejected.';
        else result = await guest.execute(args.command);
      } else result = `Unknown tool: ${name}`;
      messages.push(message, { role: 'tool', tool_call_id: call.id, name, content: String(result) });
    }
    throw new Error('Rig exceeded six tool turns');
  }

  // CodeAct variant: instead of one model round-trip per tool op (each of which
  // is a slow guest RPC), the model writes ONE shell script that performs the
  // whole task locally in the VM, run in a single guest.execute. Collapses N
  // model calls + N RPC round-trips into ~1 + 1.
  async runRigCodeAct(prompt, route = '') {
    const llm = this.llm('rig', route);
    const guest = this.getGuest();
    if (!llm || !guest) throw new Error('model or VM bridge is not ready');
    const messages = [
      { role: 'system', content: 'You are a coding agent working in /root/project on 32-bit Alpine Linux with BusyBox sh. Read /usr/local/share/vm-agent-capabilities.md for the canonical installed-tool and workflow reference. Installed commands include BusyBox utilities, jq, rg, git, curl, tar, gzip, qjs, vmjs, shfmt, ctags, make, patch, k6, and vmproject; ShellCheck is not installed in this fixed-size i686 image. Use Grafana k6 for JavaScript HTTP/API performance and load tests. Format and verify shell scripts with shfmt and sh -n. Remote curl, git, and k6 targets require a default route. AutoBro is not available in this Rig tool set. Accomplish the task by writing ONE POSIX sh script using the installed tools. Output ONLY the script body — no explanation and no markdown fences.' },
      { role: 'user', content: String(prompt) },
    ];
    const completion = await llm.chat({ model: llm.modelName || 'webgpu', temperature: 0, max_tokens: 1000, chat_template_kwargs: { enable_thinking: false }, messages });
    let script = String(completion?.choices?.[0]?.message?.content || '').trim();
    const fenced = script.match(/^```(?:sh|bash)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) script = fenced[1].trim();
    if (!script) throw new Error('CodeAct produced no script');
    if (!this.yolo && !await this.approveAction('execute', { script })) return 'Operation rejected.';
    const output = await guest.execute(`cd /root/project 2>/dev/null; ${script}`);
    return String(output);
  }

  async handle(command, value = '', cwd = '', route = '') {
    if (command.startsWith('cline')) return await this.handleCline(command, value, cwd, route);
    if (command === 'status') {
      const llm = this.llm('vmlang', route);
      const model = llm ? await llm.status().catch(() => null) : null;
      return await this.onOutput(`[vmlang] ${this.abortController ? 'running' : 'idle'}; model: ${model?.modelName || 'not configured'}; YOLO: ${this.yolo ? 'on' : 'off'}`);
    }
    if (command === 'stop') {
      if (!this.abortController) return await this.onOutput('[vmlang] no task is running.');
      this.abortController.abort();
      return await this.onOutput('[vmlang] stop requested.');
    }
    if (command === 'reset') {
      this.abortController?.abort();
      this.abortController = null;
      this.harness = null;
      this.mastraHarness = null;
      this.codeHarness?.reset();
      this.codeHarness = null;
      this.clineHarness?.stop();
      this.clineHarness = null;
      this.completedRuns.clear();
      this.yolo = true;
      this.conversationActive = false;
      return await this.onOutput('[vmlang] session reset; YOLO is on by default.');
    }
    if (command === 'yolo') {
      if (value === 'on' && !this.yolo) this.yolo = await this.approveAction('enable_yolo', {
        scope: 'current browser page session',
        warning: 'The agent may overwrite/delete guest files and run arbitrary shell commands without further approval, including commands that use credentials or network access.',
      });
      if (value === 'off') this.yolo = false;
      // One YOLO setting governs every tier, so the Mastra harness must follow.
      this.mastraHarness?.setYolo?.(this.yolo);
      return await this.onOutput(`[vmlang] YOLO ${this.yolo ? 'on' : 'off'}.`);
    }
    // Third tier, beside rig and vmlang. Same lifecycle as rig: one task per
    // invocation, no persistent conversation. The harness is built lazily and
    // reused so the 9.5 MB bundle is only imported if someone actually runs it.
    if (command.startsWith('mastra')) {
      if (command === 'mastra_code') return await this.handleMastraCode(value, cwd, route);
      return await this.handleMastra(command, value, route);
    }
    if (command === 'rig' || command === 'codeact') {
      if (this.abortController) return await this.onOutput('[rig] another agent task is running.');
      this.abortController = new AbortController();
      await this.onBusy(true);
      try {
        const output = command === 'codeact' ? await this.runRigCodeAct(value, route) : await this.runRig(value, route);
        await this.onOutput(output);
      }
      catch (error) { await this.onOutput(`Rig error: ${error.message}`); }
      finally { this.abortController = null; await this.onBusy(false); }
      return;
    }
    if (command !== 'run') throw new Error(`unsupported vmlang command: ${command}`);
    const runKey = String(value).trim();
    if (this.completedRuns.has(runKey)) {
      await this.onOutput(this.completedRuns.get(runKey));
      await this.onBusy(false);
      return;
    }
    if (this.abortController) return await this.onOutput('[vmlang] another task is already running; use vmlang stop first.');
    const llmClient = this.llm('vmlang', route);
    const harnessRouteKey = this.routeKey('vmlang', route);
    if (this.harnessRouteKey && this.harnessRouteKey !== harnessRouteKey) this.harness = null;
    this.harnessRouteKey = harnessRouteKey;
    const guest = this.getGuest();
    if (!llmClient) return await this.onOutput('[vmlang] WebGPU LLM is not ready; use Configure LLM in the browser header.');
    if (!guest) return await this.onOutput('[vmlang] guest bridge is still initializing.');

    // A LiteRtLmClient object exists from page load even before a model file is
    // loaded, so the !llmClient guard above is not enough. Without a ready model
    // the first inference throws deep inside the harness (or stalls), and the
    // error never reaches the terminal — the user is left staring at
    // "conversation started". Check readiness up front and report it plainly.
    const model = typeof llmClient.status === 'function' ? await llmClient.status().catch(() => null) : null;
    if (model) {
      if (model.webgpu === false) return await this.onOutput('[vmlang] WebGPU is unavailable in this browser; open the page in a WebGPU-capable desktop browser (Chrome/Edge).');
      if (model.loading) return await this.onOutput('[vmlang] the model is still loading; wait for it to finish, then run vmlang again.');
      if (!model.modelName) return await this.onOutput('[vmlang] no model loaded; click "Configure LLM" in the header, load a .litertlm model, then run vmlang again.');
    }

    this.conversationActive = true;
    this.abortController = new AbortController();
    this.onBusy(true);
    try {
      this.harness ||= await this.createAgent({
        llmClient,
        guest,
        browserClient: this.getBrowserClient(),
        onActivity: event => this.onActivity(event),
        approveAction: (operation, detail) => this.yolo || this.approveAction(operation, detail),
      });
      const result = await this.harness.run(value, { signal: this.abortController.signal });
      const output = (result?.output ?? '').toString();
      const display = output.trim() ? output : '[vmlang] the agent returned no output.';
      this.completedRuns.set(runKey, display);
      if (this.completedRuns.size > 64) this.completedRuns.delete(this.completedRuns.keys().next().value);
      await this.onOutput(display);
    } catch (error) {
      await this.onOutput(`Error: ${error.message}`);
    } finally {
      this.abortController = null;
      await this.onBusy(false);
    }
  }
}
