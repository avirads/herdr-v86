// @cline/agents 0.0.72 imports two Node/provider-factory exports even when a
// caller supplies its own AgentModel.  Its advertised browser entry for
// @cline/llms does not currently export those names. VMVM always supplies the
// model adapter in cline-browser.js, so keep the browser bundle small and make
// the unreachable provider factory fail explicitly if upstream behavior
// changes.
export function createGateway() {
  throw new Error('VMVM supplies Cline with its browser model; provider factory is unavailable');
}

export function classifyProviderError() {
  return 'unknown';
}

