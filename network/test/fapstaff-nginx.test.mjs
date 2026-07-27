import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = await readFile(new URL('../deploy/fapstaff-peerjs.nginx', import.meta.url), 'utf8');

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
