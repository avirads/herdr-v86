# Page-local LiteRT-LM runtime

herdr loads the vendored `@litert-lm/core` WebGPU runtime directly from this
directory. A model selected with **Configure LLM** is copied into the site's
Origin Private File System and automatically reloaded on later visits.

The model executes in the hosting browser's WebGPU implementation, not in the
i386 guest. The guest's `vmllm` command and browser read-only agent use the
page-local provider through their existing serial RPC interface. No Chrome
extension, API key, native process, or VM network gateway is required.

Vendored packages:

- `@litert-lm/core` 0.14.0, Apache-2.0, from
  <https://github.com/google-ai-edge/LiteRT-LM/tree/main/js>
- `@litertjs/wasm-utils` 2.5.0, Apache-2.0

The vendored `load.js` uses a relative browser import for wasm-utils. Preserve
that patch when updating the packages. The four WASM builds are selected at
runtime according to relaxed-SIMD and JSPI support and must remain together.

