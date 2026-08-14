import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const scripts = await Promise.all(["rig-vm", "vmlang", "mastra-vm", "zerostack-vm"].map(async name => [
  name, await readFile(new URL(`../guest/${name}`, import.meta.url), "utf8"),
]));
const capabilities = await readFile(new URL("../guest/agent-capabilities.md", import.meta.url), "utf8");

test("Settings exposes cloud provider configuration and per-agent defaults", () => {
  assert.match(index, /id="cloud-provider-select"/);
  assert.match(index, /value="openai">OpenAI/);
  assert.match(index, /value="anthropic">Anthropic/);
  assert.match(index, /value="gemini">Gemini/);
  assert.match(index, /value="compatible">OpenAI-compatible/);
  for (const agent of ["rig", "zerostack", "vmlang", "vmmastra"]) {
    assert.match(index, new RegExp(`data-agent="${agent}"`));
  }
  assert.match(index, /Keys stay in this tab|session-only|current (?:browser )?tab/i);
});

test("all coding agent launchers accept provider, model, and session overrides", () => {
  for (const [name, script] of scripts) {
    assert.match(script, /--provider/, `${name} lacks --provider`);
    assert.match(script, /--model/, `${name} lacks --model`);
    assert.match(script, /--session/, `${name} lacks --session`);
    assert.match(script, /VM_LLM_ROUTE_B64|sessionId/, `${name} does not forward routing metadata`);
  }
});

test("Zerostack translates one quoted positional task to its non-interactive prompt flag", () => {
  const zerostack = scripts.find(([name]) => name === "zerostack-vm")[1];
  assert.match(zerostack, /if \[ "\$#" -eq 1 \].*\n\s*set -- -p "\$1"/);
});

test("the host keeps Local WebGPU direct and resolves only routed requests", () => {
  assert.match(index, /getLocalClient: \(\) => webGpuLlmClient/);
  assert.match(index, /llmProviderRouter\.resolve\(agent, route\)/);
});

test("the canonical in-VM agent reference teaches provider routing safely", () => {
  assert.match(capabilities, /Local WebGPU is the direct default/);
  assert.match(capabilities, /Settings → Cloud AI providers/);
  assert.match(capabilities, /--provider NAME/);
  assert.match(capabilities, /--model\s+MODEL/);
  assert.match(capabilities, /--session ID/);
  assert.match(capabilities, /never silently fall back/);
  assert.match(capabilities, /credentials are owned by the browser Settings layer/);
});

test("GitHub Copilot is offered as a provider and wired end to end", async () => {
  const router = await readFile(new URL("../../shared/llm-provider-router.js", import.meta.url), "utf8");

  // Settings can select it, and picking it fills in a base URL.
  assert.match(index, /value="copilot">GitHub Copilot/);
  assert.match(index, /copilot: "https:\/\/api\.githubcopilot\.com"/);
  // The key is a GitHub OAuth token, not a provider API key, so the field says so.
  assert.match(index, /GitHub token with Copilot access/);

  // chat() dispatches to it, and the OAuth token is exchanged rather than sent.
  assert.match(router, /this\.config\.type === "copilot"\) return this\.copilot\(body\)/);
  assert.match(router, /copilot_internal\/v2\/token/);
  assert.match(router, /COPILOT_TOKENS\.set\(this\.apiKey/);

  // The exchanged token must be short-lived and refreshed before it expires.
  assert.match(router, /cached\.expiry - 60000 > now/);

  // chatStream must NOT fall through to the generic OpenAI path for copilot.
  // That path sends `Bearer ${this.apiKey}` -- the GitHub token, not the
  // exchanged one -- so the request would be rejected without ever reaching
  // copilotToken(). Copilot belongs with anthropic and gemini here.
  const stream = router.slice(router.indexOf("async chatStream("));
  const guard = stream.slice(0, stream.indexOf("\n    }"));
  assert.match(guard, /this\.config\.type === "copilot"/);

  // Saving one must also be accepted. vmbro implemented the provider but never
  // added it here, so every save threw "Unsupported provider type" and the
  // provider was unreachable from the UI that offers it.
  assert.match(router, /\["openai", "compatible", "anthropic", "gemini", "copilot"\]\.includes\(next\.type\)/);
});
