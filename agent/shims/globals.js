// Injected into every browser bundle (esbuild --inject), NOT imported:
// Mastra reads process.env during MODULE INIT (readPositiveIntEnv), so these
// bindings must exist before the bundle body executes.
//
// setImmediate is the one that bites quietly: Mastra's tool-execution path
// calls it, browsers do not have it, and the resulting TypeError is caught and
// returned to the model as a tool RESULT. Every tool then "succeeds" with an
// error string and the agent invents a plausible answer over dead tool calls.
import processPolyfill from 'process/browser';
import { Buffer as BufferPolyfill } from 'buffer';

processPolyfill.env = processPolyfill.env || {};

const setImmediatePolyfill =
  globalThis.setImmediate ?? ((fn, ...args) => setTimeout(() => fn(...args), 0));
const clearImmediatePolyfill = globalThis.clearImmediate ?? (id => clearTimeout(id));

export {
  processPolyfill as process,
  BufferPolyfill as Buffer,
  setImmediatePolyfill as setImmediate,
  clearImmediatePolyfill as clearImmediate,
};
