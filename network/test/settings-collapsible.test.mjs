import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const settings = html.slice(html.indexOf('<dialog id="settings-dialog">'), html.indexOf('<dialog id="remote-dialog">'));

test("every titled Settings section is a native collapsible control", () => {
  const titles = [
    "vm-image-settings-title",
    "ai-model-settings-title",
    "cloud-model-settings-title",
    "autobro-settings-title",
    "voice-settings-title",
    "assets-transfer-settings-title",
    "diagnostics-settings-title",
  ];
  for (const title of titles) {
    assert.match(settings, new RegExp(`<details class="provider-section" aria-labelledby="${title}">\\s*<summary><h3 id="${title}">`));
  }
});

test("Settings sections are collapsed by default", () => {
  const sections = [...settings.matchAll(/<details class="provider-section"[^>]*>/g)].map(match => match[0]);
  assert.equal(sections.length, 7);
  assert.ok(sections.every(section => !/\sopen(?:\s|>|=)/.test(section)));
});

test("collapsible headings have visible keyboard and touch affordances", () => {
  assert.match(html, /\.provider-section > summary \{ min-height: 44px/);
  assert.match(html, /\.provider-section > summary:focus-visible/);
  assert.match(html, /\.provider-section\[open\] > summary::after/);
});
