export class VmAgentController {
  constructor({ createAgent, getLlmClient, getGuest, getBrowserClient = () => null, approveAction, onOutput = () => {}, onActivity = () => {}, onBusy = () => {} }) {
    Object.assign(this, { createAgent, getLlmClient, getGuest, getBrowserClient, approveAction, onOutput, onActivity, onBusy });
    this.harness = null;
    this.abortController = null;
    this.yolo = false;
  }

  resetHarness() { this.harness = null; }

  async handle(command, value = '') {
    if (command === 'status') {
      const llm = this.getLlmClient();
      const model = llm ? await llm.status().catch(() => null) : null;
      return this.onOutput(`[vmagent] ${this.abortController ? 'running' : 'idle'}; model: ${model?.modelName || 'not configured'}; YOLO: ${this.yolo ? 'on' : 'off'}`);
    }
    if (command === 'stop') {
      if (!this.abortController) return this.onOutput('[vmagent] no task is running.');
      this.abortController.abort();
      return this.onOutput('[vmagent] stop requested.');
    }
    if (command === 'reset') {
      this.abortController?.abort();
      this.abortController = null;
      this.harness = null;
      this.yolo = false;
      return this.onOutput('[vmagent] session reset; YOLO is off.');
    }
    if (command === 'yolo') {
      if (value === 'on' && !this.yolo) this.yolo = await this.approveAction('enable_yolo', {
        scope: 'current browser page session',
        warning: 'The agent may overwrite/delete guest files and run arbitrary shell commands without further approval, including commands that use credentials or network access.',
      });
      if (value === 'off') this.yolo = false;
      return this.onOutput(`[vmagent] YOLO ${this.yolo ? 'on' : 'off'}.`);
    }
    if (command !== 'run') throw new Error(`unsupported vmagent command: ${command}`);
    if (this.abortController) return this.onOutput('[vmagent] another task is already running; use vmagent stop first.');
    const llmClient = this.getLlmClient();
    const guest = this.getGuest();
    if (!llmClient) return this.onOutput('[vmagent] WebGPU LLM is not ready; use Configure LLM in the browser header.');
    if (!guest) return this.onOutput('[vmagent] guest bridge is still initializing.');

    this.abortController = new AbortController();
    this.onBusy(true);
    this.onOutput('[vmagent] Deep Agents started.');
    try {
      this.harness ||= await this.createAgent({
        llmClient,
        guest,
        browserClient: this.getBrowserClient(),
        onActivity: event => this.onActivity(event),
        approveAction: (operation, detail) => this.yolo || this.approveAction(operation, detail),
      });
      const result = await this.harness.run(value, { signal: this.abortController.signal });
      this.onOutput(result.output);
    } catch (error) {
      this.onOutput(`[vmagent] Agent error: ${error.message}`);
    } finally {
      this.abortController = null;
      this.onBusy(false);
    }
  }
}
