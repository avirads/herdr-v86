// Fully-local voice input via Moonshine (Useful Sensors) ASR.
// Everything runs in-browser: the Moonshine tiny model, the ONNX runtime
// (WASM/JSEP), and the Silero VAD are all vendored under extension/vendor and
// pointed at chrome-extension:// URLs — no network, no cloud STT.
//
// Exposes startDictation({ onUpdate, onCommit, onError }) → returns a stop fn.
// Moonshine's MicrophoneTranscriber owns getUserMedia + VAD; onCommit fires
// with a finalized utterance (VAD end-of-speech), onUpdate with interim text.

let Moonshine = null;
let loadPromise = null;

async function loadMoonshine() {
  if (Moonshine) return Moonshine;
  if (!loadPromise) {
    loadPromise = (async () => {
      const mod = await import('../vendor/moonshine/dist/moonshine.min.js');
      // Redirect every remote asset base to the vendored local copies.
      mod.Settings.BASE_ASSET_PATH.MOONSHINE = chrome.runtime.getURL('vendor/moonshine/dist/');
      mod.Settings.BASE_ASSET_PATH.ONNX_RUNTIME = chrome.runtime.getURL('vendor/onnxruntime-web/');
      mod.Settings.BASE_ASSET_PATH.SILERO_VAD = chrome.runtime.getURL('vendor/vad-web/');
      Moonshine = mod;
      return mod;
    })();
  }
  return loadPromise;
}

export async function startDictation({ onUpdate, onCommit, onError }) {
  const ms = await loadMoonshine();
  // "model/tiny" resolves to vendor/moonshine/dist/model/tiny/quantized/*.onnx.
  const transcriber = new ms.MicrophoneTranscriber('model/tiny', {
    onTranscriptionUpdated: text => onUpdate?.(text),
    onTranscriptionCommitted: text => { if (text?.trim()) onCommit?.(text.trim()); },
    onError: err => onError?.(err instanceof Error ? err : new Error(String(err)))
  });
  await transcriber.start();
  return async () => { try { await transcriber.stop(); } catch { /* already stopped */ } };
}
