import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const scripts = await Promise.all(["rig-vm", "vmlang", "mastra-vm", "zerostack-vm", "cline-vm"].map(async name => [
  name, await readFile(new URL(`../guest/${name}`, import.meta.url), "utf8"),
]));
const capabilities = await readFile(new URL("../guest/agent-capabilities.md", import.meta.url), "utf8");

test("Settings exposes cloud provider configuration and per-agent defaults", () => {
  assert.match(index, /id="cloud-provider-select"/);
  assert.match(index, /value="openai">OpenAI/);
  assert.match(index, /value="anthropic">Anthropic/);
  assert.match(index, /value="gemini">Gemini/);
  assert.match(index, /value="compatible">OpenAI-compatible/);
  for (const agent of ["rig", "zerostack", "vmlang", "vmmastra", "cline"]) {
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

test("Cline submits through the visible agent serial transport", () => {
  const cline = scripts.find(([name]) => name === "cline-vm")[1];
  // Use the shell's already-open console stream. Reopening an emulated UART
  // can wait forever for carrier before the request or acknowledgement appears.
  assert.doesNotMatch(cline, /> \/dev\/ttyS0/);
  assert.doesNotMatch(cline, /> \/dev\/ttyS1/);
  assert.match(cline, /submitted to the ready browser agent/);
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
