import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Guest scripts run inside the Alpine VM via `#!/bin/sh`. If a checkout
// converts them to CRLF (e.g. Windows with core.autocrlf=true, absent the
// .gitattributes `eol=lf` guard), the shebang becomes "#!/bin/sh\r" and the
// kernel resolves it to a nonexistent interpreter path — exec fails with
// "can't execute", silently. This exact corruption previously broke
// /sbin/autologin-rpc in a released VM image, which knocked out the ttyS1
// RPC shell that vmagent/FETCH/CLIPBOARD/LLM_* all depend on, with zero
// visible error anywhere in the browser. Guard against it recurring by
// scanning every guest script's source for embedded CR bytes before it ever
// gets baked into an image.

const guestDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'guest');
const binaryExtensions = new Set(['.tar.gz', '.gz', '.config']);

function isLikelyBinary(name) {
  return name.endsWith('.tar.gz') || name.endsWith('.gz');
}

test('guest scripts contain no CR bytes (would corrupt the #!/bin/sh shebang)', () => {
  const entries = readdirSync(guestDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && !isLikelyBinary(entry.name));
  assert.ok(entries.length > 5, 'sanity check: expected to find guest scripts in network/guest/');

  const offenders = [];
  for (const entry of entries) {
    const contents = readFileSync(path.join(guestDir, entry.name), 'utf8');
    if (contents.includes('\r')) offenders.push(entry.name);
  }
  assert.deepEqual(offenders, [], `these guest files contain CR bytes and will fail to exec once baked into the VM image: ${offenders.join(', ')}`);
});

test('shebang guest scripts start with a clean "#!/bin/..." line (no trailing CR)', () => {
  const entries = readdirSync(guestDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && !isLikelyBinary(entry.name));
  for (const entry of entries) {
    const contents = readFileSync(path.join(guestDir, entry.name), 'utf8');
    if (!contents.startsWith('#!')) continue;
    const firstLine = contents.slice(0, contents.indexOf('\n'));
    assert.ok(!firstLine.includes('\r'), `${entry.name}: shebang line has a trailing CR`);
  }
});
