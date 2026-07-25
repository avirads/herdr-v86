// AI SDK `LanguageModelV2` provider over the page-local LiteRT-LM WebGPU
// client (and, unchanged, the AutoBro `WebGpuLlmClient` — both expose the same
// `chat(body)` / optional `chatStream(body, onChunk)` surface).
//
// Implements @ai-sdk/provider spec v2. Mastra ships @ai-sdk/provider v5, v6 and
// v7 side by side; v6's package still declares `specificationVersion: 'v2'`, so
// a V2 model is accepted on both the v5 and v6 paths. Target v2 until that
// stops being true.
//
// Why this file exists at all: Gemma 4 E2B has no native tool calling. The
// model is asked for a single JSON object and the reply is parsed back into
// spec-shaped `tool-call` content. That is the same trick `WebGpuToolChatModel`
// plays for LangChain, hoisted to the AI SDK interface so Mastra (or anything
// else on the AI SDK) can drive the same on-device model.

const DEFAULT_MODEL_ID = 'litert-lm';

// ---------------------------------------------------------------------------
// Prompt conversion: LanguageModelV2Prompt -> OpenAI-ish messages
// ---------------------------------------------------------------------------

function partsToText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  return content
    .map(part => {
      switch (part?.type) {
        case 'text':
          return part.text;
        case 'reasoning':
          // Reasoning is not replayed to a model that never emitted it.
          return '';
        case 'tool-call':
          return `[tool call] ${part.toolName}(${stringifyInput(part.input)})`;
        case 'tool-result':
          return `[tool result${part.toolName ? ` from ${part.toolName}` : ''}] ${resultToText(part)}`;
        case 'file':
          return `[file omitted: ${part.mediaType || 'unknown media type'}]`;
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n');
}

function resultToText(part) {
  const output = part?.output;
  if (output == null) return '';
  if (typeof output === 'string') return output;
  if (output.type === 'text' || output.type === 'error-text') return String(output.value ?? '');
  if (output.type === 'json' || output.type === 'error-json') return JSON.stringify(output.value);
  if (output.type === 'content') return partsToText(output.value);
  return JSON.stringify(output);
}

function stringifyInput(input) {
  if (typeof input === 'string') return input;
  try {
    return JSON.stringify(input ?? {});
  } catch {
    return '{}';
  }
}

export function convertPrompt(prompt) {
  const messages = [];
  for (const message of prompt || []) {
    if (message.role === 'system') {
      messages.push({ role: 'system', content: String(message.content ?? '') });
      continue;
    }
    if (message.role === 'tool') {
      // The engine has no tool role; fold results into the user turn so the
      // model sees them as observations.
      messages.push({ role: 'user', content: partsToText(message.content) });
      continue;
    }
    const text = partsToText(message.content);
    if (!text) continue;
    messages.push({ role: message.role === 'assistant' ? 'assistant' : 'user', content: text });
  }
  return messages;
}

// ---------------------------------------------------------------------------
// Tool protocol
// ---------------------------------------------------------------------------

// Emitted shape matches `completionWithToolCall()` in litert-lm-client.js, so
// the contract is identical whether the client normalized the reply or we do.
export function toolProtocolInstruction(tools, toolChoice) {
  if (!tools?.length) return '';
  const catalog = tools
    .filter(t => t.type === 'function')
    .map(t => ({ name: t.name, description: t.description, parameters: t.inputSchema }));
  if (!catalog.length) return '';

  const forced =
    toolChoice?.type === 'tool'
      ? `\nYou MUST call the tool "${toolChoice.toolName}" on this turn.`
      : toolChoice?.type === 'required'
        ? '\nYou MUST call one of the tools on this turn. Do not answer directly.'
        : '';

  return (
    '\n\nYou have tools. Work one step at a time. Reply with exactly ONE JSON ' +
    'object and no prose, no markdown fences:\n' +
    '{"tool_call":{"name":"TOOL_NAME","arguments":{...}}}   to call a tool\n' +
    '{"final":"your answer"}                                 when you are done\n' +
    `Available tools: ${JSON.stringify(catalog)}${forced}`
  );
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseLooseJson(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return undefined;
  const unfenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? trimmed;
  try {
    return JSON.parse(unfenced);
  } catch {
    /* fall through to brace scan */
  }
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      /* not JSON */
    }
  }
  return undefined;
}

function normalizeArguments(value) {
  if (value == null) return {};
  if (typeof value === 'string') {
    const parsed = parseLooseJson(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { value };
  }
  if (Array.isArray(value)) return { value };
  return typeof value === 'object' ? value : { value };
}

// Small models reach for whichever call shape they saw most in training.
// Accept all of them rather than losing the turn to a schema mismatch.
export function extractToolCall(value) {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value.tool_call ?? value.toolCall ?? value.function ?? value;
  const name =
    candidate?.name ??
    candidate?.tool ??
    candidate?.tool_name ??
    candidate?.toolName ??
    (typeof value.tool === 'string' ? value.tool : undefined);
  if (typeof name !== 'string' || !name) return undefined;
  const args = candidate?.arguments ?? candidate?.args ?? candidate?.parameters ?? candidate?.input;
  return { name, arguments: normalizeArguments(args) };
}

let callCounter = 0;
function newToolCallId() {
  callCounter += 1;
  const random =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${callCounter}`;
  return `call_${random}`;
}

/**
 * Turn a completion (or a raw string) into spec `content` parts.
 * Handles three arrival shapes:
 *   1. client already produced OpenAI `tool_calls` (litert-lm-client does this)
 *   2. content is a JSON tool-call object per our protocol
 *   3. content is plain text / `{"final": "..."}`
 */
export function parseCompletion(completion, { hasTools = false } = {}) {
  const choice = completion?.choices?.[0];
  const nativeCalls = choice?.message?.tool_calls;
  if (Array.isArray(nativeCalls) && nativeCalls.length) {
    return {
      content: nativeCalls.map(call => ({
        type: 'tool-call',
        toolCallId: call.id || newToolCallId(),
        toolName: call.function?.name ?? call.name ?? 'unknown',
        input: stringifyInput(normalizeArguments(call.function?.arguments ?? call.arguments)),
      })),
      finishReason: 'tool-calls',
    };
  }

  const raw =
    typeof completion === 'string'
      ? completion
      : (choice?.message?.content ?? completion?.content ?? '');
  const text = typeof raw === 'string' ? raw : partsToText(raw);

  if (hasTools) {
    const value = parseLooseJson(text);
    const call = extractToolCall(value);
    if (call) {
      return {
        content: [
          {
            type: 'tool-call',
            toolCallId: newToolCallId(),
            toolName: call.name,
            input: stringifyInput(call.arguments),
          },
        ],
        finishReason: 'tool-calls',
      };
    }
    if (value && typeof value.final === 'string') {
      return { content: [{ type: 'text', text: value.final }], finishReason: 'stop' };
    }
  }

  const trimmed = String(text ?? '');
  return {
    content: trimmed ? [{ type: 'text', text: trimmed }] : [],
    finishReason: 'stop',
  };
}

// ---------------------------------------------------------------------------
// Unsupported-setting warnings
// ---------------------------------------------------------------------------

const UNSUPPORTED_SETTINGS = [
  'topK',
  'topP',
  'seed',
  'presencePenalty',
  'frequencyPenalty',
  'stopSequences',
];

function collectWarnings(options) {
  const warnings = [];
  for (const setting of UNSUPPORTED_SETTINGS) {
    if (options[setting] !== undefined) {
      warnings.push({
        type: 'unsupported-setting',
        setting,
        details: 'LiteRT-LM conversations do not expose this sampling control.',
      });
    }
  }
  if (options.responseFormat?.type === 'json') {
    warnings.push({
      type: 'unsupported-setting',
      setting: 'responseFormat',
      details: 'No constrained decoding on-device; JSON is requested via prompt only.',
    });
  }
  for (const tool of options.tools || []) {
    if (tool.type !== 'function') {
      warnings.push({ type: 'unsupported-tool', tool, details: 'Only function tools are supported.' });
    }
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

export class LiteRtLanguageModel {
  constructor(client, { modelId = DEFAULT_MODEL_ID, provider = 'litert-lm', maxOutputTokens = 1400 } = {}) {
    if (!client || typeof client.chat !== 'function') {
      throw new Error('LiteRtLanguageModel requires a client with a chat(body) method');
    }
    this.specificationVersion = 'v2';
    this.provider = provider;
    this.modelId = modelId;
    this.client = client;
    this.defaultMaxOutputTokens = maxOutputTokens;
  }

  // No media type is fetched natively; the AI SDK downloads everything.
  get supportedUrls() {
    return {};
  }

  _buildBody(options) {
    const tools = options.toolChoice?.type === 'none' ? [] : options.tools || [];
    const messages = convertPrompt(options.prompt);
    const protocol = toolProtocolInstruction(tools, options.toolChoice);

    if (protocol) {
      const first = messages[0];
      if (first?.role === 'system') first.content += protocol;
      else messages.unshift({ role: 'system', content: protocol.trimStart() });
    }

    return {
      body: {
        model: this.modelId,
        temperature: options.temperature ?? 0,
        max_tokens: options.maxOutputTokens ?? this.defaultMaxOutputTokens,
        chat_template_kwargs: { enable_thinking: false },
        messages,
      },
      hasTools: tools.length > 0,
    };
  }

  async doGenerate(options) {
    options.abortSignal?.throwIfAborted?.();
    const { body, hasTools } = this._buildBody(options);
    const completion = await this.client.chat(body);
    const { content, finishReason } = parseCompletion(completion, { hasTools });

    return {
      content,
      finishReason,
      // LiteRT-LM reports no token counts. The spec types these as
      // `number | undefined`; reporting undefined beats inventing numbers.
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
      warnings: collectWarnings(options),
      request: { body },
      response: { modelId: this.modelId, timestamp: new Date() },
      providerMetadata: { 'litert-lm': { toolProtocol: hasTools ? 'json-single-object' : 'none' } },
    };
  }

  async doStream(options) {
    options.abortSignal?.throwIfAborted?.();
    const { body, hasTools } = this._buildBody(options);
    const warnings = collectWarnings(options);
    const canStream = typeof this.client.chatStream === 'function';
    const model = this;

    // A tool call is only recognizable once the whole JSON object has arrived,
    // so token streaming is only safe when no tools are bound. With tools we
    // buffer and emit the parsed result in one shot — correctness over feel.
    if (hasTools || !canStream) {
      if (canStream && hasTools) {
        warnings.push({
          type: 'other',
          message: 'Streaming disabled for this call: tool-call replies must be parsed whole.',
        });
      }
      const result = await this.doGenerate(options);
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: result.warnings.concat(warnings.filter(w => w.type === 'other')) });
            for (const part of result.content) {
              if (part.type === 'text') {
                const id = newToolCallId();
                controller.enqueue({ type: 'text-start', id });
                controller.enqueue({ type: 'text-delta', id, delta: part.text });
                controller.enqueue({ type: 'text-end', id });
              } else {
                controller.enqueue(part);
              }
            }
            controller.enqueue({ type: 'finish', finishReason: result.finishReason, usage: result.usage });
            controller.close();
          },
        }),
        request: { body },
      };
    }

    return {
      stream: new ReadableStream({
        async start(controller) {
          const id = newToolCallId();
          controller.enqueue({ type: 'stream-start', warnings });
          controller.enqueue({ type: 'text-start', id });
          try {
            await model.client.chatStream(body, delta => {
              if (delta) controller.enqueue({ type: 'text-delta', id, delta });
            });
            controller.enqueue({ type: 'text-end', id });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
            });
          } catch (error) {
            controller.enqueue({ type: 'error', error });
            controller.enqueue({
              type: 'finish',
              finishReason: 'error',
              usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
            });
          }
          controller.close();
        },
      }),
      request: { body },
    };
  }
}

/**
 * Provider factory, matching AI SDK convention:
 *   const litert = createLiteRt({ client });
 *   const model  = litert('gemma-4-e2b');
 */
export function createLiteRt({ client, provider = 'litert-lm', maxOutputTokens = 1400 } = {}) {
  const factory = (modelId = DEFAULT_MODEL_ID) =>
    new LiteRtLanguageModel(client, { modelId, provider, maxOutputTokens });
  factory.languageModel = factory;
  factory.chat = factory;
  return factory;
}
