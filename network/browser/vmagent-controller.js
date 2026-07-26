export class VmAgentController {
  constructor({ createAgent, createMastraAgent = null, getLlmClient, getGuest, getBrowserClient = () => null, approveAction, onOutput = () => {}, onActivity = () => {}, onBusy = () => {} }) {
    Object.assign(this, { createAgent, createMastraAgent, getLlmClient, getGuest, getBrowserClient, approveAction, onOutput, onActivity, onBusy });
    this.harness = null;
    this.mastraHarness = null;
    // Matches what index.html asks for, and switchable at runtime with
    // `mastra tools lean|full`.
    this.mastraFullTools = true;
    this.abortController = null;
    this.yolo = true;
    this.conversationActive = false;
    this.completedRuns = new Map();
  }

  resetHarness() { this.harness = null; this.mastraHarness = null; this.completedRuns.clear(); }

  // Everything the Mastra harness can do, reachable from `mastra` in the guest
  // shell. Subcommands arrive as separate AGENT_MASTRA_* operations, matching
  // how vmagent's status/stop/reset/yolo are routed.
  async handleMastra(command, value) {
    if (!this.createMastraAgent) return await this.onOutput('[mastra] tier is not available in this build.');

    // Cheap, harness-free commands first — these must work before a model is
    // loaded, otherwise `mastra status` cannot tell you why it is not ready.
    if (command === 'mastra_stop') {
      if (!this.abortController) return await this.onOutput('[mastra] no task is running.');
      this.abortController.abort();
      return await this.onOutput('[mastra] stop requested.');
    }
    if (command === 'mastra_reset') {
      this.mastraHarness = null;
      return await this.onOutput('[mastra] session reset; the next run rebuilds it.');
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
      return await this.onOutput(`[mastra] YOLO ${this.yolo ? 'on' : 'off'} (shared with vmagent).`);
    }
    if (command === 'mastra_tools' && (value === 'lean' || value === 'full')) {
      const wanted = value === 'full';
      if (wanted !== this.mastraFullTools) {
        this.mastraFullTools = wanted;
        // The tool set is fixed when the agent is constructed, so switching
        // profiles has to discard the harness rather than mutate it.
        this.mastraHarness = null;
      }
      return await this.onOutput(`[mastra] tool profile: ${value}${wanted ? ' (19 tools)' : ' (8 workspace tools)'}.`);
    }

    const guest = this.getGuest();
    if (!guest) return await this.onOutput('[mastra] guest bridge is still initializing.');
    const llmClient = this.getLlmClient();
    const model = llmClient && typeof llmClient.status === 'function'
      ? await llmClient.status().catch(() => null)
      : null;

    if (command === 'mastra_status') {
      const lines = [
        `[mastra] ${this.abortController ? 'running' : 'idle'}`,
        `  model:   ${model?.modelName || 'not configured — use Configure LLM in the header'}`,
        `  YOLO:    ${this.yolo ? 'on' : 'off'} (shared with vmagent)`,
        `  profile: ${this.mastraFullTools ? 'full (19 tools)' : 'lean (8 workspace tools)'}`,
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
    if (!llmClient) return await this.onOutput('[mastra] WebGPU LLM is not ready; use Configure LLM in the browser header.');
    if (model && !model.modelName) {
      return await this.onOutput('[mastra] no model loaded; click "Configure LLM" in the header, load a .litertlm model, then run mastra again.');
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
      try {
        const names = await (await harness()).listTools();
        return await this.onOutput([`[mastra] ${names.length} tools active:`, ...names.map(name => `  ${name}`)].join('\n'));
      } catch (error) { return await this.onOutput(`Mastra error: ${error.message}`); }
    }
    if (command === 'mastra_cost') {
      try {
        const cost = await (await harness()).systemPromptCost();
        return await this.onOutput(
          `[mastra] system prompt ~${cost.approxTokens} tokens (${cost.chars} chars) across ${cost.toolCount} tools — ` +
          `${Math.round((cost.approxTokens / 16384) * 100)}% of a 16k window.`,
        );
      } catch (error) { return await this.onOutput(`Mastra error: ${error.message}`); }
    }

    // Default: run a task. `mastra batch` tries a one-shot script first and
    // falls back to the tool loop if it does not exit clean — codeact's speed
    // without codeact's habit of reporting a half-finished script as success.
    if (this.abortController) return await this.onOutput('[mastra] another agent task is running.');
    this.abortController = new AbortController();
    await this.onBusy(true);
    try {
      const output = await (await harness()).run(value, { batchFirst: command === 'mastra_batch' });
      await this.onOutput(String(output || '').trim() || '[mastra] the agent returned no output.');
    } catch (error) {
      await this.onOutput(`Mastra error: ${error.message}`);
    } finally {
      this.abortController = null;
      await this.onBusy(false);
    }
  }
  closeConversation() { this.conversationActive = false; }

  async runRig(prompt) {
    const llm = this.getLlmClient();
    const guest = this.getGuest();
    if (!llm || !guest) throw new Error('model or VM bridge is not ready');
    const tools = [
      { type: 'function', function: { name: 'read_file', description: 'Read a UTF-8 project file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
      { type: 'function', function: { name: 'list_directory', description: 'List a project directory', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
      { type: 'function', function: { name: 'write_file', description: 'Write a UTF-8 project file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
      { type: 'function', function: { name: 'shell', description: 'Run a shell command in the project', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } },
    ];
    const messages = [
      { role: 'system', content: 'You are a concise coding agent in /root/project. Use tools only when needed, then answer directly.' },
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
  async runRigCodeAct(prompt) {
    const llm = this.getLlmClient();
    const guest = this.getGuest();
    if (!llm || !guest) throw new Error('model or VM bridge is not ready');
    const messages = [
      { role: 'system', content: 'You are a coding agent working in /root/project on a 32-bit Linux VM. Accomplish the task by writing ONE POSIX sh script that uses standard tools (cat, ls, grep, sed, awk, printf, test, mkdir, etc.). Output ONLY the script body — no explanation and no markdown fences.' },
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

  async handle(command, value = '') {
    if (command === 'status') {
      const llm = this.getLlmClient();
      const model = llm ? await llm.status().catch(() => null) : null;
      return await this.onOutput(`[vmagent] ${this.abortController ? 'running' : 'idle'}; model: ${model?.modelName || 'not configured'}; YOLO: ${this.yolo ? 'on' : 'off'}`);
    }
    if (command === 'stop') {
      if (!this.abortController) return await this.onOutput('[vmagent] no task is running.');
      this.abortController.abort();
      return await this.onOutput('[vmagent] stop requested.');
    }
    if (command === 'reset') {
      this.abortController?.abort();
      this.abortController = null;
      this.harness = null;
      this.completedRuns.clear();
      this.yolo = true;
      this.conversationActive = false;
      return await this.onOutput('[vmagent] session reset; YOLO is on by default.');
    }
    if (command === 'yolo') {
      if (value === 'on' && !this.yolo) this.yolo = await this.approveAction('enable_yolo', {
        scope: 'current browser page session',
        warning: 'The agent may overwrite/delete guest files and run arbitrary shell commands without further approval, including commands that use credentials or network access.',
      });
      if (value === 'off') this.yolo = false;
      // One YOLO setting governs every tier, so the Mastra harness must follow.
      this.mastraHarness?.setYolo?.(this.yolo);
      return await this.onOutput(`[vmagent] YOLO ${this.yolo ? 'on' : 'off'}.`);
    }
    // Third tier, beside rig and vmagent. Same lifecycle as rig: one task per
    // invocation, no persistent conversation. The harness is built lazily and
    // reused so the 9.5 MB bundle is only imported if someone actually runs it.
    if (command.startsWith('mastra')) return await this.handleMastra(command, value);
    if (command === 'rig' || command === 'codeact') {
      if (this.abortController) return await this.onOutput('[rig] another agent task is running.');
      this.abortController = new AbortController();
      await this.onBusy(true);
      try {
        const output = command === 'codeact' ? await this.runRigCodeAct(value) : await this.runRig(value);
        await this.onOutput(output);
      }
      catch (error) { await this.onOutput(`Rig error: ${error.message}`); }
      finally { this.abortController = null; await this.onBusy(false); }
      return;
    }
    if (command !== 'run') throw new Error(`unsupported vmagent command: ${command}`);
    const runKey = String(value).trim();
    if (this.completedRuns.has(runKey)) {
      await this.onOutput(this.completedRuns.get(runKey));
      await this.onBusy(false);
      return;
    }
    if (this.abortController) return await this.onOutput('[vmagent] another task is already running; use vmagent stop first.');
    const llmClient = this.getLlmClient();
    const guest = this.getGuest();
    if (!llmClient) return await this.onOutput('[vmagent] WebGPU LLM is not ready; use Configure LLM in the browser header.');
    if (!guest) return await this.onOutput('[vmagent] guest bridge is still initializing.');

    // A LiteRtLmClient object exists from page load even before a model file is
    // loaded, so the !llmClient guard above is not enough. Without a ready model
    // the first inference throws deep inside the harness (or stalls), and the
    // error never reaches the terminal — the user is left staring at
    // "conversation started". Check readiness up front and report it plainly.
    const model = typeof llmClient.status === 'function' ? await llmClient.status().catch(() => null) : null;
    if (model) {
      if (model.webgpu === false) return await this.onOutput('[vmagent] WebGPU is unavailable in this browser; open the page in a WebGPU-capable desktop browser (Chrome/Edge).');
      if (model.loading) return await this.onOutput('[vmagent] the model is still loading; wait for it to finish, then run vmagent again.');
      if (!model.modelName) return await this.onOutput('[vmagent] no model loaded; click "Configure LLM" in the header, load a .litertlm model, then run vmagent again.');
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
      const display = output.trim() ? output : '[vmagent] the agent returned no output.';
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
