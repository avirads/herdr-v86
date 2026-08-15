#!/usr/bin/env node
// Vendors tcpip.js (lwIP compiled to WASM) into vendor/tcpip/ for the
// buildless page. The published packages use bare specifiers, which a plain
// <script type="module"> cannot resolve without an import map; the page loads
// every provider through relative dynamic import(), so rewrite the specifiers
// to relative paths instead of introducing a page-wide import map.
//
//   npm install tcpip @tcpip/dhcp   # in a scratch dir
//   node network/scripts/vendor-tcpip.mjs <scratch-dir>/node_modules
//
// tcpip.wasm must stay one directory above dist/: it is resolved at runtime
// with new URL('../tcpip.wasm', import.meta.url).

import { cp, readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(REPO, 'vendor', 'tcpip');

// source package -> vendored directory name
const PACKAGES = {
  'tcpip': 'tcpip',
  '@bjorn3/browser_wasi_shim': 'browser_wasi_shim',
  '@tcpip/dns': 'dns',
  '@tcpip/wire': 'wire',
  '@tcpip/transport': 'transport',
  '@tcpip/dhcp': 'dhcp',
};

// bare specifier -> path relative to a vendored package's dist/ directory
const REWRITES = {
  '@bjorn3/browser_wasi_shim': '../../browser_wasi_shim/dist/index.js',
  '@tcpip/dns': '../../dns/dist/index.js',
  '@tcpip/wire': '../../wire/dist/index.js',
  '@tcpip/transport': '../../transport/dist/index.js',
};

const nodeModules = process.argv[2];
if (!nodeModules) {
  console.error('usage: node vendor-tcpip.mjs <node_modules-dir>');
  process.exit(1);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const versions = {};
for (const [pkg, dir] of Object.entries(PACKAGES)) {
  const src = join(nodeModules, pkg);
  await cp(src, join(OUT, dir), { recursive: true });
  versions[pkg] = JSON.parse(await readFile(join(src, 'package.json'), 'utf8')).version;
}

// Drop everything the browser will not load: CJS builds, sourcemaps, typings,
// and each package's own test fixtures and build metadata. Only dist/*.js, the
// wasm, the licences, and package.json need to survive.
const DROP_DIRS = new Set(['test', 'tests', '__tests__', 'src', 'typings']);
const DROP_FILES = /^(\.gitmodules|\.swcrc|\.prettierrc|\.npmignore|tsconfig\.json|tsconfig\.tsbuildinfo)$/;
let removed = 0;
async function prune(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (DROP_DIRS.has(entry.name)) { await rm(path, { recursive: true }); removed++; continue; }
      await prune(path);
      continue;
    }
    if (/\.(cjs|map|d\.ts|d\.cts)$/.test(entry.name) || DROP_FILES.test(entry.name)) {
      await rm(path); removed++;
    }
  }
}
await prune(OUT);

// Rewrite bare specifiers in the surviving ESM.
let patched = 0;
async function rewrite(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { await rewrite(path); continue; }
    if (!entry.name.endsWith('.js')) continue;
    const before = await readFile(path, 'utf8');
    let after = before;
    for (const [bare, rel] of Object.entries(REWRITES)) {
      after = after.replaceAll(`"${bare}"`, `"${rel}"`).replaceAll(`'${bare}'`, `'${rel}'`);
    }
    if (after !== before) { await writeFile(path, after); patched++; }
  }
}
await rewrite(OUT);

await writeFile(join(OUT, 'versions.json'), JSON.stringify(versions, null, 2) + '\n');

// Fail loudly rather than shipping a module the browser cannot resolve.
const leftover = [];
async function verify(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { await verify(path); continue; }
    if (!entry.name.endsWith('.js')) continue;
    const text = await readFile(path, 'utf8');
    for (const m of text.matchAll(/from\s*["']([^"'./][^"']*)["']/g)) leftover.push(`${path}: ${m[1]}`);
  }
}
await verify(OUT);
if (leftover.length) {
  console.error('unresolved bare specifiers remain:\n' + leftover.join('\n'));
  process.exit(1);
}

console.log(`vendored ${Object.keys(PACKAGES).length} packages to ${OUT}`);
console.log(`  versions: ${JSON.stringify(versions)}`);
console.log(`  pruned ${removed} non-browser files, rewrote ${patched} modules, 0 bare specifiers left`);
