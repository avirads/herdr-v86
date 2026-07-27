# Browser VM capabilities

- The guest is 32-bit Alpine Linux with BusyBox `sh`. Use portable POSIX shell
  syntax and BusyBox-compatible flags.
- Installed command-line tools include BusyBox utilities, `jq`, `rg`
  (ripgrep), `git`, `curl`, `tar`, `gzip`, QuickJS (`qjs`), and `vmjs`.
- `curl` and remote `git` operations require a default IP route. Without one,
  use `vmfetch` for CORS-enabled HTTPS resources and `vmgithub archive` for a
  GitHub source archive.
- Use `vmproject import ARCHIVE.tar.gz [DEST]` to load a local project archive.
  Use `vmproject pack` to create an archive and `vmproject export` to download
  the project through the browser.
- AutoBro browser tools are exposed only when they appear in the active agent's
  tool list. Do not claim AutoBro access when those tools are absent.
