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

test('the static app and PeerJS routes remain enabled together', () => {
  assert.match(config, /location \/peerjs\/ \{/);
  assert.match(config, /root \/var\/www\/herdr-v86\/current;/);
  assert.match(config, /location \/ \{\s*try_files \$uri \$uri\/ =404;/);
});

test('QR loading bypasses stale MIME cache entries and has a visible fallback', () => {
  assert.match(html, /qrcode-generator-2\.0\.4\.mjs\?v=20260727-js-mime/);
  assert.match(html, /const qrReady = await renderRemoteQr/);
  assert.match(html, /QR code unavailable\. Copy the pairing key/);
});
