# Browser VM capabilities

This is the canonical capability reference for every coding agent. Read it at
startup and again before choosing tools for a task.

- The guest is 32-bit Alpine Linux with BusyBox `sh`. Use portable POSIX shell
  syntax and BusyBox-compatible flags.
- Installed command-line tools include BusyBox utilities, `jq`, `rg`
  (ripgrep), `git`, `curl`, `tar`, `gzip`, QuickJS (`qjs`), `vmjs`,
  `shfmt`, `ctags`, `make`, and `patch`. ShellCheck is documented but is not
  installed because Alpine 3.22 has no x86 package and the VM image is fixed-size.
- Grafana `k6` v2.0.0 is installed for JavaScript performance and load tests.
  Run `k6 new SCRIPT.js`, `k6 run SCRIPT.js`, or `k6 run --vus N --duration D
  SCRIPT.js`. Network targets remain subject to the guest egress policy.
- Use `rg` for fast source search, `ctags` for symbol indexing, `make` for
  projects that provide a Makefile, `patch` to apply unified diffs, and `k6`
  for HTTP/API performance tests.
- After creating or editing a shell script, run `shfmt -w FILE`, then
  `sh -n FILE`; run `shellcheck FILE` when an external ShellCheck is available.
  Repair failures before reporting success.
- `curl` and remote `git` operations require a default IP route. Without one,
  use `vmfetch` for CORS-enabled HTTPS resources and `vmgithub archive` for a
  GitHub source archive.
- Use `vmproject import ARCHIVE.tar.gz [DEST]` to load a local project archive.
  Use `vmproject pack` to create an archive and `vmproject export` to download
  the project through the browser.
- AutoBro browser tools are exposed only when they appear in the active agent's
  tool list. Do not claim AutoBro access when those tools are absent.
- Local WebGPU is the direct default LLM for `rig`, `zerostack`, `vmlang`, and
  `vmmastra`; it does not pass through the cloud router. The browser's
  **Settings → Cloud AI providers** section can configure OpenAI, Anthropic,
  Gemini, and OpenAI-compatible endpoints and a separate default for each
  agent.
- A user can override an agent invocation with `--provider NAME`, `--model
  MODEL`, and `--session ID`. These options must appear before the task or
  subcommand, for example:

  ```sh
  rig --provider work-openai --model gpt-4.1-mini 'Review this project'
  vmlang --provider claude --session review-a run 'Review this project'
  vmmastra --provider gemini --session build-a 'Implement and test the change'
  zerostack --provider local-gateway --model provider/model-id
  ```

  Omit the options to use the selected agent's browser setting. A named session
  remains pinned to its initial provider and model. Provider, authentication,
  network, and CORS failures are reported and never silently fall back to a
  different model. Do not ask for, print, read, or persist provider API keys;
  credentials are owned by the browser Settings layer.
