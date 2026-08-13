import test from 'node:test';
import assert from 'node:assert/strict';
import { completionWithToolCall, parseToolCall } from '../../shared/litert-lm-client.js';

const completionOf = content => completionWithToolCall({
  choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
});

test('page-local JSON tool request becomes an OpenAI tool call', () => {
  const completion = completionOf('{"tool_call":{"name":"read","arguments":{"path":"README.md"}}}');
  assert.equal(completion.choices[0].message.tool_calls[0].function.name, 'read');
  assert.equal(completion.choices[0].message.tool_calls[0].function.arguments, '{"path":"README.md"}');
  assert.equal(completion.choices[0].finish_reason, 'tool_calls');
});

// Verbatim gemma-4-E2B-it-web output from a rig `write_file` turn. Delimiters,
// the tool name outside the braces, and bare keys, all in one reply.
const E2B_WRITE_FILE =
  '<|tool_call>call:write_file{path: "/root/project/greet.js", ' +
  'content: "export function greet(name) {\\n  return `hello, ${name}`;\\n}\\n\\ngreet(\\"i386\\");"\n}<tool_call|>';

test('gemma native tool-call syntax is recovered', () => {
  const call = parseToolCall(E2B_WRITE_FILE);
  assert.equal(call.name, 'write_file');
  assert.equal(call.arguments.path, '/root/project/greet.js');
  // The file body must survive byte-for-byte — backticks, `${…}`, and escaped
  // quotes are exactly what a naive regex repair would corrupt.
  assert.equal(
    call.arguments.content,
    'export function greet(name) {\n  return `hello, ${name}`;\n}\n\ngreet("i386");',
  );
});

test('gemma native syntax reaches rig as a real tool_calls entry', () => {
  const completion = completionOf(E2B_WRITE_FILE);
  const [call] = completion.choices[0].message.tool_calls;
  assert.equal(call.function.name, 'write_file');
  assert.equal(JSON.parse(call.function.arguments).path, '/root/project/greet.js');
  assert.equal(completion.choices[0].finish_reason, 'tool_calls');
  assert.equal(completion.choices[0].message.content, null);
});

test('delimiters around the protocol shape are stripped', () => {
  const call = parseToolCall('<|tool_call>{"name":"list_directory","arguments":{"path":"."}}<tool_call|>');
  assert.equal(call.name, 'list_directory');
  assert.equal(call.arguments.path, '.');
});

test('a dropped closing brace is repaired', () => {
  const call = parseToolCall('{"tool_call":{"name":"read_file","arguments":{"path":"/a.md"}}');
  assert.equal(call.name, 'read_file');
  assert.equal(call.arguments.path, '/a.md');
});

test('parameters left beside the name are treated as arguments', () => {
  const call = parseToolCall('{"tool_call":{"name":"read_file","path":"/a.md"}}');
  assert.equal(call.name, 'read_file');
  assert.equal(call.arguments.path, '/a.md');
});

test('single-quoted values are accepted', () => {
  const call = parseToolCall("<|tool_call>call:shell{command: 'echo \"hi\"'}<tool_call|>");
  assert.equal(call.name, 'shell');
  assert.equal(call.arguments.command, 'echo "hi"');
});

test('prose stays prose', () => {
  const completion = completionOf('I wrote greet.js and it prints hello, i386.');
  assert.equal(completion.choices[0].message.tool_calls, undefined);
  assert.equal(completion.choices[0].finish_reason, 'stop');
});

test('a JSON answer is not mistaken for a tool call', () => {
  // The vmfactory envelope. It is an object with a `name`-free shape, but the
  // looser parser must not start claiming arbitrary JSON replies either.
  const envelope = '{"status":"ok","summary":"Added greet.js","artifacts":["greet.js"]}';
  assert.equal(parseToolCall(envelope), undefined);
  assert.equal(parseToolCall('{"final":"done"}'), undefined);
  assert.equal(parseToolCall('{"name":"greet.js","size":42}'), undefined);
});

// Verbatim gemma-4-E2B-it-web reply using its own quote token in place of `"`.
// The text between a pair is raw: real newlines, unescaped quotes, backticks.
const E2B_QUOTE_TOKENS =
  '<|tool_call>call:write_file{path:<|"|>greet.js<|"|>,content:<|"|>export function greet(name) {\n' +
  '  return `hello, ${name}`;\n}\n\ngreet("i386");<|"|>}<tool_call|>';

test('gemma\'s <|"|> quote token is understood', () => {
  const call = parseToolCall(E2B_QUOTE_TOKENS);
  assert.equal(call.name, 'write_file');
  assert.equal(call.arguments.path, 'greet.js');
  // The payload is a file body: newlines, quotes and backticks must all survive
  // exactly, which is why the region is re-encoded rather than character-swapped.
  assert.equal(
    call.arguments.content,
    'export function greet(name) {\n  return `hello, ${name}`;\n}\n\ngreet("i386");',
  );
});

test('an unpaired quote token is left alone rather than guessed at', () => {
  assert.equal(parseToolCall('<|tool_call>call:shell{command:<|"|>ls -la}<tool_call|>'), undefined);
});
