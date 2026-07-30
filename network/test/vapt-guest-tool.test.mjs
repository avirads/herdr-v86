import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const builder = await readFile(new URL("network/guest/build-tier-images.sh", root), "utf8");
const config = JSON.parse(await readFile(new URL("network/guest/vaptr-native.json", root), "utf8"));
const capabilities = await readFile(new URL("network/guest/agent-capabilities.md", root), "utf8");
const help = await readFile(new URL("docs/guest-tools.md", root), "utf8");

const externalTools = ["httpx", "katana", "urlfinder", "ffuf", "interactsh-client", "hakrawler", "gospider", "nuclei"];

test("VAPT tier installs only the self-contained Vaptr binary", async () => {
  // The static vaptr binary is the sole tool baked into the image.
  assert.ok((await stat(new URL("network/guest/bin/vaptr", root))).size > 1_000_000);
  assert.match(builder, /install -D -m 0755 "\$VAPTR_BINARY" "\$MOUNT_DIR\/usr\/local\/bin\/vaptr"/);
  assert.match(builder, /install -D -m 0644 "\$VAPTR_CONFIG" "\$MOUNT_DIR\/opt\/vaptr\/configs\/native\.json"/);
  // No external scan tooling is installed; the verifier asserts each is absent.
  assert.match(builder, /command -v vaptr/);
  for (const tool of externalTools) {
    assert.match(builder, new RegExp(tool.replace("-", "\\-")));
  }
});

test("supplied Vaptr config runs every stage through the native backend", () => {
  for (const stage of ["fingerprint", "crawl", "content", "params", "scan"]) {
    assert.equal(config[stage].backend, "native");
  }
  assert.equal(config.llm.provider, "vmllm");
  assert.match(config.scope.authorization, /REPLACE/);
});

test("agents and Help document the native design, authorization, and no external tools", () => {
  for (const text of [capabilities, help]) {
    assert.match(text, /explicit\s+written (?:authorization|permission)/i);
    assert.match(text, /no external tools/i);
    assert.match(text, /native/i);
    assert.match(text, /vaptr caps/);
  }
});
