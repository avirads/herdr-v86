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
