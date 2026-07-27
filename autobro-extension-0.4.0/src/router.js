// In-browser port of go-extension-bridge/internal/bridge/server.go's core.
// The Go bridge correlated command ids because caller and executor lived in
// different processes. Here the executor (commands.js) is in-process, so
// execute() is a plain awaited call with a timeout; the pending map exists
// only for message-framed transports (relay, WebRTC) that need v3-style
// {type:"result", id} frames.

import { handleCommand } from './commands.js';
import { enableGuidewireCommands, isGuidewireSkillPath } from './domain-registry.js';
import { loadSkills, importSkill } from './skills.js';

export const BRIDGE_VERSION = 3;

let nextId = 0;
const startedAt = Date.now();
const transports = new Map(); // name -> { connected: () => boolean }

export function registerTransport(name, status) {
  transports.set(name, status);
}

// Bridge-level commands, not tab commands — the Go bridge served these as
// /skills; here they are protocol commands so every transport gets them.
async function bridgeCommand(payload) {
  switch (payload?.command) {
    case 'skills': {
      const skills = await loadSkills(
        payload.q ?? payload.args?.[0] ?? '',
        payload.limit ?? payload.args?.[1] ?? 4,
        payload.maxChars ?? payload.args?.[2] ?? 6000
      );
      if (skills.some(skill => isGuidewireSkillPath(skill.path))) await enableGuidewireCommands();
      return skills;
    }
    case 'skillsImport': {
      if (typeof payload.path !== 'string' || !payload.path || typeof payload.content !== 'string') {
        throw new Error('skillsImport requires {path, content}');
      }
      await importSkill(payload.path, payload.content);
      const guidewireCommandsEnabled = isGuidewireSkillPath(payload.path);
      if (guidewireCommandsEnabled) await enableGuidewireCommands();
      return { ok: true, path: payload.path, bytes: payload.content.length, guidewireCommandsEnabled };
    }
    default:
      return undefined;
  }
}

export async function execute(payload, { timeoutMs = 30_000 } = {}) {
  const bridgeResult = await bridgeCommand(payload);
  if (bridgeResult !== undefined) return bridgeResult;
  const id = String(++nextId);
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timed out waiting for extension command ${id}`)),
      timeoutMs
    );
  });
  try {
    return await Promise.race([handleCommand(payload ?? {}), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Mirrors GET /health. "extensionConnected" is definitionally true now —
// the bridge lives inside the extension.
export function health() {
  const transportStatus = {};
  for (const [name, status] of transports) {
    transportStatus[name] = status.connected();
  }
  return {
    ok: true,
    bridgeVersion: BRIDGE_VERSION,
    extensionConnected: true,
    inBrowser: true,
    uptimeMs: Date.now() - startedAt,
    transports: transportStatus
  };
}

// v3 wire-frame helper for message-based transports: takes a
// {type:"command", id, payload} frame, returns a {type:"result"...} frame.
export async function executeFrame(frame, options) {
  if (!frame || frame.type !== 'command' || !frame.id) return null;
  try {
    const result = await execute(frame.payload, options);
    return { type: 'result', id: frame.id, ok: true, result };
  } catch (error) {
    return {
      type: 'result',
      id: frame.id,
      ok: false,
      error: error?.stack || error?.message || String(error)
    };
  }
}
