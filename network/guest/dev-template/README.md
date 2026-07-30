# Mastra + Hono + Astro

A Node-free full-stack template derived from `herdr-v86`'s `vmmastra` runtime:

- Astro pages compile with the official Astro Go/WASM compiler.
- Hono routes run in QuickJS behind the native Chi server.
- Mastra `Agent` runs in the browser with the `vmmastra` browser shims.
- LiteRT-LM runs Gemma 4 E2B locally through WebGPU and streams through Mastra.

## Model setup

Download `gemma-4-E2B-it-web.litertlm` using the link in the app and import it.
The model is intentionally not part of the project archive: it is around 2 GB.
LiteRT-LM stores the imported model in browser OPFS and automatically reloads it
on later visits.

For a pre-provisioned deployment, serve the model at
`/vmmastra/models/gemma-4-E2B-it-web.litertlm`; the app detects and loads that
URL automatically. If it is absent, the file-picker flow remains unchanged.

No API key is needed. Prompts and generation stay in the browser. The app does
not have live weather data and its agent instructions explicitly prevent it from
inventing current forecasts or alerts.

## Architecture

Hono exposes `/api/health` and `/api/model-config`. Inference remains browser-local:
the page creates a real Mastra `Agent`, connects the canonical `createLiteRt`
AI SDK provider to `LiteRtLmClient`, and consumes `agent.stream().textStream`.

## Runtime provenance

The vendored browser assets are copied from the canonical
`D:\zero\herdr-v86` checkout:

| Runtime | Version | License |
| --- | ---: | --- |
| `@mastra/core` | 1.52.1 | Apache-2.0 |
| `@litert-lm/core` | 0.14.0 | Apache-2.0 |
| `@litertjs/wasm-utils` | 2.5.0 | Apache-2.0 |

The generated Mastra browser bundle retains its bundled third-party license
notices. The Gemma weights are not copied or committed and remain governed by
their upstream model terms.
