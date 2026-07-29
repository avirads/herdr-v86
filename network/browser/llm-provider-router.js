const PROVIDERS_KEY = "vmvm.llm.providers";
const DEFAULTS_KEY = "vmvm.llm.agentDefaults";
const SECRET_PREFIX = "vmvm.llm.secret.";

const clean = value => String(value ?? "").trim();

function normalizedBaseUrl(value) {
  const url = new URL(clean(value));
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("Cloud provider URLs must use HTTPS (HTTP is allowed only for localhost)");
  }
  return url.href.replace(/\/+$/, "");
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return clean(content);
  return content.map(part => part?.text || part?.content || "").join("");
}

function openAiMessage(message = {}) {
  return {
    role: "assistant",
    content: contentText(message.content),
    ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}),
  };
}

class CloudLlmClient {
  constructor(config, apiKey, fetchImpl = fetch) {
    this.config = config;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.modelName = config.model;
  }

  async status() {
    return { modelName: this.modelName, provider: this.config.id, cloud: true };
  }

  async models() {
    return { object: "list", data: [{ id: this.modelName, object: "model", owned_by: this.config.type }] };
  }

  async request(url, init) {
    let response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (error) {
      throw new Error(`${this.config.label || this.config.id} request failed (network or browser CORS policy): ${error.message}`);
    }
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; }
    catch { throw new Error(`${this.config.label || this.config.id} returned non-JSON HTTP ${response.status}`); }
    if (!response.ok) {
      const message = data?.error?.message || data?.message || text || response.statusText;
      throw new Error(`${this.config.label || this.config.id} HTTP ${response.status}: ${message}`);
    }
    return data;
  }

  async chat(body = {}) {
    if (this.config.type === "anthropic") return this.anthropic(body);
    if (this.config.type === "gemini") return this.gemini(body);
    return this.openai(body);
  }

  async openai(body) {
    const base = normalizedBaseUrl(this.config.baseUrl);
    const request = {
      ...body,
      model: body.model && body.model !== "webgpu" ? body.model : this.modelName,
      stream: false,
    };
    return this.request(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(request),
    });
  }

  async anthropic(body) {
    const system = (body.messages || []).filter(message => message.role === "system").map(message => contentText(message.content)).join("\n");
    const messages = (body.messages || []).filter(message => message.role !== "system").map(message => {
      if (message.role === "tool") {
        return { role: "user", content: [{ type: "tool_result", tool_use_id: message.tool_call_id, content: contentText(message.content) }] };
      }
      const content = [{ type: "text", text: contentText(message.content) }];
      for (const call of message.tool_calls || []) {
        let input = {};
        try { input = JSON.parse(call.function?.arguments || "{}"); } catch {}
        content.push({ type: "tool_use", id: call.id, name: call.function?.name, input });
      }
      return { role: message.role === "assistant" ? "assistant" : "user", content };
    });
    const tools = (body.tools || []).map(tool => ({
      name: tool.function?.name, description: tool.function?.description || "", input_schema: tool.function?.parameters || { type: "object" },
    }));
    const data = await this.request(`${normalizedBaseUrl(this.config.baseUrl || "https://api.anthropic.com/v1")}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: body.model && body.model !== "webgpu" ? body.model : this.modelName,
        max_tokens: body.max_tokens || 1024,
        ...(system ? { system } : {}),
        messages,
        ...(tools.length ? { tools } : {}),
      }),
    });
    const text = (data.content || []).filter(part => part.type === "text").map(part => part.text).join("");
    const toolCalls = (data.content || []).filter(part => part.type === "tool_use").map(part => ({
      id: part.id, type: "function", function: { name: part.name, arguments: JSON.stringify(part.input || {}) },
    }));
    return { id: data.id, model: data.model, choices: [{ message: { role: "assistant", content: text, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) }, finish_reason: toolCalls.length ? "tool_calls" : "stop" }], usage: data.usage };
  }

  async gemini(body) {
    const system = (body.messages || []).filter(message => message.role === "system").map(message => contentText(message.content)).join("\n");
    const contents = (body.messages || []).filter(message => message.role !== "system").map(message => {
      if (message.role === "tool") {
        return { role: "user", parts: [{ functionResponse: { name: message.name || "tool", response: { output: contentText(message.content) } } }] };
      }
      const parts = contentText(message.content) ? [{ text: contentText(message.content) }] : [];
      for (const call of message.tool_calls || []) {
        let args = {};
        try { args = JSON.parse(call.function?.arguments || "{}"); } catch {}
        parts.push({ functionCall: { name: call.function?.name, args } });
      }
      return { role: message.role === "assistant" ? "model" : "user", parts };
    });
    const declarations = (body.tools || []).map(tool => ({
      name: tool.function?.name, description: tool.function?.description || "", parameters: tool.function?.parameters,
    }));
    const base = normalizedBaseUrl(this.config.baseUrl || "https://generativelanguage.googleapis.com/v1beta");
    const model = body.model && body.model !== "webgpu" ? body.model : this.modelName;
    const data = await this.request(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        ...(declarations.length ? { tools: [{ functionDeclarations: declarations }] } : {}),
        generationConfig: { temperature: body.temperature, maxOutputTokens: body.max_tokens || 1024 },
      }),
    });
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.filter(part => part.text).map(part => part.text).join("");
    const toolCalls = parts.filter(part => part.functionCall).map((part, index) => ({
      id: `gemini-${Date.now()}-${index}`, type: "function",
      function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args || {}) },
    }));
    return { model, choices: [{ message: { role: "assistant", content: text, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) }, finish_reason: toolCalls.length ? "tool_calls" : "stop" }], usage: data.usageMetadata };
  }
}

export class LlmProviderRouter {
  constructor({ getLocalClient, fetchImpl = fetch, persistentStorage = localStorage, secretStorage = sessionStorage } = {}) {
    this.getLocalClient = getLocalClient;
    this.fetchImpl = fetchImpl;
    this.persistentStorage = persistentStorage;
    this.secretStorage = secretStorage;
    this.sessions = new Map();
  }

  providers() {
    try { return JSON.parse(this.persistentStorage.getItem(PROVIDERS_KEY) || "[]"); } catch { return []; }
  }

  defaults() {
    try { return JSON.parse(this.persistentStorage.getItem(DEFAULTS_KEY) || "{}"); } catch { return {}; }
  }

  saveProvider(config, apiKey = "", { persistSecret = false } = {}) {
    const id = clean(config.id).replace(/[^a-zA-Z0-9._-]/g, "-");
    if (!id || id === "local") throw new Error("Choose a provider name other than local");
    const next = {
      id, label: clean(config.label) || id, type: clean(config.type),
      baseUrl: normalizedBaseUrl(config.baseUrl), model: clean(config.model),
    };
    if (!["openai", "compatible", "anthropic", "gemini"].includes(next.type)) throw new Error("Unsupported provider type");
    if (!next.model) throw new Error("A model name is required");
    const providers = this.providers().filter(item => item.id !== id);
    providers.push(next);
    this.persistentStorage.setItem(PROVIDERS_KEY, JSON.stringify(providers));
    if (apiKey) {
      const storage = persistSecret ? this.persistentStorage : this.secretStorage;
      storage.setItem(`${SECRET_PREFIX}${id}`, apiKey);
      if (persistSecret) this.secretStorage.removeItem(`${SECRET_PREFIX}${id}`);
      else this.persistentStorage.removeItem(`${SECRET_PREFIX}${id}`);
    }
    return next;
  }

  removeProvider(id) {
    this.persistentStorage.setItem(PROVIDERS_KEY, JSON.stringify(this.providers().filter(item => item.id !== id)));
    this.persistentStorage.removeItem(`${SECRET_PREFIX}${id}`);
    this.secretStorage.removeItem(`${SECRET_PREFIX}${id}`);
    for (const [key, route] of this.sessions) if (route.provider === id) this.sessions.delete(key);
  }

  setDefault(agent, provider) {
    const defaults = this.defaults();
    defaults[clean(agent)] = clean(provider) || "local";
    this.persistentStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults));
  }

  resolve(agent, route = {}) {
    const sessionId = clean(route.sessionId || route.session);
    const key = sessionId ? `${clean(agent)}:${sessionId}` : "";
    const requested = { provider: clean(route.provider), model: clean(route.model), sessionId };
    let selected = key && this.sessions.get(key);
    if (!selected) {
      selected = { ...requested, provider: requested.provider || this.defaults()[agent] || "local" };
      if (key) this.sessions.set(key, selected);
    } else if ((requested.provider && requested.provider !== selected.provider) || (requested.model && requested.model !== selected.model)) {
      throw new Error(`session ${sessionId} is already bound to provider ${selected.provider}${selected.model ? `/${selected.model}` : ""}`);
    }
    if (selected.provider === "local") return this.getLocalClient();
    const config = this.providers().find(item => item.id === selected.provider);
    if (!config) throw new Error(`LLM provider "${selected.provider}" is not configured`);
    const apiKey = this.secretStorage.getItem(`${SECRET_PREFIX}${config.id}`) || this.persistentStorage.getItem(`${SECRET_PREFIX}${config.id}`) || "";
    if (!apiKey) throw new Error(`API key for provider "${config.id}" is not available in this browser tab`);
    return new CloudLlmClient({ ...config, ...(selected.model ? { model: selected.model } : {}) }, apiKey, this.fetchImpl);
  }

  resetSession(agent, sessionId) { this.sessions.delete(`${clean(agent)}:${clean(sessionId)}`); }
}
