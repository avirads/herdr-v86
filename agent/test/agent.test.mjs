import test from 'node:test';
import assert from 'node:assert/strict';
import { createHerdrReadonlyAgent } from '../src/agent.js';

test('Deep Agents invokes the read-only guest tool and returns evidence', async () => {
  let calls = 0;
  const activities = [];
  const llmClient = {
    async chat() {
      calls += 1;
      const content = calls === 1
        ? JSON.stringify({ tool: 'guest_list', args: { path: '.' } })
        : JSON.stringify({ final: 'The workspace contains src/main.js.' });
      return { choices: [{ message: { content } }] };
    },
  };
  const guestCalls = [];
  const guest = {
    async list(path) { guestCalls.push(['list', path]); return 'regular file\tsrc/main.js\t20'; },
    async read(path) { guestCalls.push(['read', path]); return 'const value = 1;'; },
    async grep(pattern, path) { guestCalls.push(['grep', pattern, path]); return ''; },
    async test(recipe) { guestCalls.push(['test', recipe]); return 'ok'; },
  };
  const harness = createHerdrReadonlyAgent({ llmClient, guest, onActivity: event => activities.push(event) });
  const result = await harness.run('List the project.');
  assert.deepEqual(guestCalls, [['list', '.']]);
  assert.match(result.output, /src\/main\.js/);
  assert.ok(activities.some(event => event.tool === 'guest_list'));
});
