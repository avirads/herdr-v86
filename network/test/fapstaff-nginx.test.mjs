import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = await readFile(new URL('../deploy/fapstaff-peerjs.nginx', import.meta.url), 'utf8');
const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('fapstaff serves ES modules with a browser-executable MIME type', () => {
  assert.match(config, /location ~ \\\.(?:mjs)\$ \{/);
  assert.match(config, /default_type application\/javascript;/);
  assert.match(config, /try_files \$uri =404;/);
});

test('fapstaff exposes the running Dev IDE through the public HTTPS origin', () => {
  assert.match(config, /location = \/ide \{/);
  assert.match(config, /location \/ide\/ \{/);
  assert.match(config, /proxy_pass http:\/\/10\.77\.0\.15:3000\//);
  assert.match(config, /Cache-Control "no-store"/);
});

test('fapstaff exposes the scaffolded app preview on the guest app port', () => {
  assert.match(config, /location = \/preview \{/);
  assert.match(config, /location \/preview\/ \{/);
  assert.match(config, /proxy_pass http:\/\/10\.77\.0\.15:3100\//);
  assert.match(config, /return 301 \/preview\//);
});

test('fapstaff exposes the scoped gateway session and WebSocket routes', () => {
  assert.match(config, /location = \/v1\/sessions \{/);
  assert.match(config, /location = \/v1\/ethernet \{/);
  assert.match(config, /proxy_pass http:\/\/127\.0\.0\.1:8086/);
  assert.match(config, /proxy_set_header Upgrade \$http_upgrade/);
});

test('the static app and PeerJS routes remain enabled together', () => {
  assert.match(config, /location \/peerjs\/ \{/);
  assert.match(config, /root \/var\/www\/herdr-v86\/current;/);
  assert.match(config, /location \/ \{\s*try_files \$uri \$uri\/ =404;/);
});

test('the PLU route and avirads redirect remain present in the deployment config', () => {
  assert.match(config, /location \/plu\/ \{/);
  assert.match(config, /server_name avirads\.com www\.avirads\.com/);
  assert.match(config, /return 301 https:\/\/fapstaff\.com\$request_uri/);
});

test('the voice model ZIP is served from persistent storage', () => {
  assert.match(config, /location = \/downloads\/moonshine-tiny-quantized-0\.1\.29\.zip/);
  assert.match(config, /alias \/var\/www\/herdr-v86-downloads\/moonshine-tiny-quantized-0\.1\.29\.zip/);
  assert.match(config, /default_type application\/zip/);
});

test('QR loading bypasses stale MIME cache entries and has a visible fallback', () => {
  assert.match(html, /qrcode-generator-2\.0\.4\.mjs\?v=20260727-js-mime/);
  assert.match(html, /const qrReady = await renderRemoteQr/);
  assert.match(html, /QR code unavailable\. Copy the pairing key/);
});

// --- CheerpX provider routes ------------------------------------------------

test('the CheerpX route is cross-origin isolated', () => {
  // CheerpX needs SharedArrayBuffer; without these two headers /cx/ cannot boot.
  assert.match(config, /location \/cx\/ \{/);
  assert.match(config, /Cross-Origin-Opener-Policy "same-origin"/);
  assert.match(config, /Cross-Origin-Embedder-Policy "require-corp"/);
});

test('isolation stays scoped to /cx/ and off the v86 page', () => {
  // COEP on "/" would break the PeerJS remote chat, the Moonshine voice model
  // and the AutoBro bridge, none of which send CORP headers.
  const root = config.slice(config.lastIndexOf('location / {'));
  assert.doesNotMatch(root, /Cross-Origin-Embedder-Policy/);
});

test('the preview service worker may claim a scope above its own directory', () => {
  assert.match(config, /location = \/cx\/preview-sw\.js \{/);
  assert.match(config, /Service-Worker-Allowed "\/cx\/"/);
});

test('CheerpX disk images are served for Range streaming', () => {
  // HttpBytesDevice refuses to start without Last-Modified or ETag, both of
  // which nginx emits for static files, and streams the image over 206s.
  assert.match(config, /location \/images\/cheerpx\/ \{/);
  assert.match(config, /default_type application\/octet-stream;/);
  assert.match(config, /max-age=31536000, immutable/);
});

test('HTTP/2 is enabled on the fapstaff origin', () => {
  // CheerpX issues hundreds of small Range requests for its disk. On HTTP/1.1
  // they serialise behind ~6 connections, each paying a fresh TCP+TLS
  // handshake, which made /cx/ unusable on this host until h2 was turned on.
  assert.match(config, /http2 on;/);
  const tls = config.slice(config.indexOf('listen 443 ssl;'));
  assert.match(tls.slice(0, 600), /http2 on;/, 'http2 must be inside the TLS server block');
});

test('the ethernet tunnel keeps the long timeout a persistent socket needs', () => {
  // vmbro carries 75s here, which is right for /peerjs/ signalling and wrong
  // for this: the guest holds one WebSocket open for the life of the VM, so a
  // 75s read timeout drops the network every 75 seconds.
  const tunnel = config.slice(config.indexOf('location = /v1/ethernet {'));
  assert.match(tunnel.slice(0, 500), /proxy_read_timeout 3600s;/);
  assert.match(tunnel.slice(0, 500), /proxy_send_timeout 3600s;/);
});
