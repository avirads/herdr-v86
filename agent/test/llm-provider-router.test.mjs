import test from "node:test";
import assert from "node:assert/strict";
import { LlmProviderRouter } from "../../shared/llm-provider-router.js";

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function router(options = {}) {
  const local = { modelName: "local", chat: async () => "local" };
  return {
    local,
    router: new LlmProviderRouter({
      getLocalClient: () => local,
      persistentStorage: new Storage(),
      secretStorage: new Storage(),
      ...options,
    }),
  };
}

test("local remains the direct hardcoded fallback", () => {
  const { router: instance, local } = router();
  assert.equal(instance.resolve("rig"), local);
  assert.equal(instance.resolve("vmmastra", { provider: "local" }), local);
});

test("agent defaults and invocation overrides resolve independently", async () => {
  const calls = [];
  const { router: instance } = router({
    fetchImpl: async (url, init) => {
      calls.push([url, JSON.parse(init.body)]);
      return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" } }] }));
    },
  });
  instance.saveProvider({ id: "openai-work", type: "openai", baseUrl: "https://api.openai.com/v1/", model: "gpt-test" }, "secret");
  instance.saveProvider({ id: "local-gateway", type: "compatible", baseUrl: "http://localhost:8080/v1", model: "other" }, "local-secret");
  instance.setDefault("rig", "openai-work");
  await instance.resolve("rig").chat({ model: "webgpu", messages: [{ role: "user", content: "hi" }] });
  await instance.resolve("rig", { provider: "local-gateway", model: "override" }).chat({ messages: [] });
  assert.equal(calls[0][0], "https://api.openai.com/v1/chat/completions");
  assert.equal(calls[0][1].model, "gpt-test");
  assert.equal(calls[1][1].model, "override");
});

test("a named session is pinned and cannot silently change provider", () => {
  const { router: instance } = router();
  instance.saveProvider({ id: "one", type: "openai", baseUrl: "https://example.com/v1", model: "m1" }, "key");
  instance.resolve("rig", { provider: "one", sessionId: "terminal-a" });
  assert.throws(() => instance.resolve("rig", { provider: "local", sessionId: "terminal-a" }), /already bound/);
  instance.resetSession("rig", "terminal-a");
  assert.doesNotThrow(() => instance.resolve("rig", { provider: "local", sessionId: "terminal-a" }));
});

test("Anthropic responses are normalized with tool calls", async () => {
  const { router: instance } = router({
    fetchImpl: async () => new Response(JSON.stringify({
      id: "msg_1", model: "claude-test",
      content: [{ type: "text", text: "checking" }, { type: "tool_use", id: "tool_1", name: "read_file", input: { path: "a" } }],
    })),
  });
  instance.saveProvider({ id: "claude", type: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-test" }, "key");
  const result = await instance.resolve("vmlang", { provider: "claude" }).chat({ messages: [], tools: [] });
  assert.equal(result.choices[0].message.content, "checking");
  assert.equal(result.choices[0].message.tool_calls[0].function.name, "read_file");
});

test("unsafe non-local HTTP provider URLs are rejected", () => {
  const { router: instance } = router();
  assert.throws(() => instance.saveProvider({ id: "bad", type: "compatible", baseUrl: "http://example.com/v1", model: "m" }, "key"), /HTTPS/);
});
