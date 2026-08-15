import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('manual model import waits only for runtime initialization', () => {
  assert.match(html, /const runtimeInitialization = client\.initialize\(\{ autoLoad: false \}\)/);
  assert.match(html, /manualModelLoadRequested = true;[\s\S]*await runtimeInitialization;[\s\S]*await client\.importModel\(file\)/);
  assert.doesNotMatch(html, /showModelProgress\(1,[\s\S]{0,500}await initialization;[\s\S]{0,200}await client\.importModel\(file\)/);
});

test('automatic cached-model loading still waits for the VM shell', () => {
  assert.match(html, /Promise\.all\(\[vmBootReady, runtimeInitialization\]\)/);
  assert.match(html, /if \(manualModelLoadRequested\) return runtimeStatus/);
  assert.match(html, /models\.includes\(remembered\) \? remembered : models\[0\]/);
  assert.match(html, /if \(name\) await client\.loadCachedModel\(name\)/);
});
