// Recovering tool calls from what a small model actually emitted.
//
// Both tiers ask for the same JSON protocol —
//   {"tool_call":{"name":"TOOL_NAME","arguments":{…}}}
// — and gemma-4-E2B-it-web answers in its own trained syntax anyway. Verbatim,
// from a rig `write_file` turn:
//
//   <|tool_call>call:write_file{path: "/root/project/greet.js", content: "…"
//   }<tool_call|>
//
// Three separate things break `JSON.parse` there: the delimiter tokens, the
// tool name sitting outside the braces, and unquoted keys. None of them are
// ambiguous about intent, and all three used to fail the same silent way — the
// call fell through as assistant prose, the caller saw no tool call, and the
// turn ended successfully having done nothing.
//
// This module is the shared syntax layer so `rig` (litert-lm-client.js) and
// `vmlang` (litert-provider.js) cannot drift apart on what they accept.

// `<|tool_call>` opens and `<tool_call|>` closes; the bare and doubled forms
// show up too, depending on where the turn was cut.
const TOOL_DELIMITER = /<\|?tool_call\|?>/gi;

/**
 * Remove the delimiter tokens, and report whether any were there.
 *
 * The flag matters downstream: a delimiter is the model explicitly framing the
 * reply as a tool call, which is what makes an unwrapped `{name, arguments}`
 * safe to accept. Without it, that shape is indistinguishable from a JSON
 * answer that happens to carry a `name` field.
 */
export function stripToolDelimiters(text) {
  const raw = String(text ?? '');
  const delimited = new RegExp(TOOL_DELIMITER.source, 'i').test(raw);
  return { text: raw.replace(TOOL_DELIMITER, ' ').trim(), delimited };
}

/**
 * Quote bare keys and normalize single-quoted strings, walking the text rather
 * than regexing over it.
 *
 * A global regex would rewrite any `key:` sequence inside a string literal —
 * and those string literals are the file bodies the agent is writing, i.e. the
 * exact payload that has to survive intact.
 */
export function normalizeJsonish(text) {
  let out = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"' || char === "'") {
      const quote = char;
      let body = '';
      index += 1;
      for (; index < text.length; index += 1) {
        const inner = text[index];
        if (inner === '\\') {
          body += inner + (text[index + 1] ?? '');
          index += 1;
          continue;
        }
        if (inner === quote) break;
        body += inner === '"' ? '\\"' : inner;
      }
      out += `"${body}"`;
      continue;
    }

    const word = /^[A-Za-z_$][\w$]*/.exec(text.slice(index))?.[0];
    if (word) {
      // An identifier followed by a colon is a key; `true`/`false`/`null` are
      // not, and pass through untouched.
      out += /^\s*:/.test(text.slice(index + word.length)) ? `"${word}"` : word;
      index += word.length - 1;
      continue;
    }

    out += char;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Parse the loosest JSON a small model plausibly meant.
 *
 * Repairs are tried only after strict parsing fails: bare keys get quoted, and
 * a missing trailing brace is restored — the 2B model closes
 * `{"tool_call":{…}}` with two braces instead of three often enough to matter.
 */
export function relaxedJsonParse(text) {
  for (const candidate of [text, normalizeJsonish(text)]) {
    for (const suffix of ['', '}', '}}']) {
      try {
        return JSON.parse(candidate + suffix);
      } catch { /* try the next repair */ }
    }
  }
  return undefined;
}

/** `call:write_file{…}` — the tool name rides outside the object. */
export function parseNamedCall(text) {
  const match = /^call\s*:\s*([A-Za-z_][\w.-]*)\s*([\s\S]*)$/.exec(text);
  if (!match) return undefined;
  const [, name, rest] = match;
  const body = rest.trim();
  if (!body) return { name, arguments: {} };
  const parsed = relaxedJsonParse(body);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  return { name, arguments: parsed };
}
