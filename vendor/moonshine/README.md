# MoonshineJS browser assets

Pinned local assets for VM voice input:

- `@moonshine-ai/moonshine-js` 0.1.29
- Moonshine Tiny English quantized ONNX model distributed with that package
- `onnxruntime-web` 1.22.0 WebAssembly runtime
- `@ricky0123/vad-web` 0.0.24 VAD model and AudioWorklet

The application sets `Moonshine.Settings.BASE_ASSET_PATH` before creating a
transcriber, so model inference and voice-activity detection load these
same-origin files rather than mutable CDN URLs.

MoonshineJS and the English model are MIT licensed; see `LICENSE`. The ONNX
Runtime and VAD components retain their upstream licenses.
