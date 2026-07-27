param(
  [ValidateSet('guest-tools', 'deep-agent')]
  [string]$Document = 'guest-tools'
)

$ErrorActionPreference = 'Stop'
$docsDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourcePath = Join-Path $docsDirectory "$Document.md"
$outputPath = Join-Path $docsDirectory "$Document.html"
$title = if ($Document -eq 'deep-agent') { 'Deep Agents coding agent' } else { 'Browser-backed guest tools' }
$body = (ConvertFrom-Markdown -Path $sourcePath).Html

$renderedPage = @"
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0d1117">
<title>$title</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0d1117;
    --panel: #161b22;
    --border: #30363d;
    --text: #e6edf3;
    --muted: #8b949e;
    --link: #58a6ff;
    --code: #f0f6fc;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
  body {
    margin: 0;
    overflow-x: hidden;
    background: var(--bg);
    color: var(--text);
    font: 16px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  header, main {
    width: min(calc(100% - 32px), 900px);
    min-width: 0;
    margin-inline: auto;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-block: 18px;
    border-bottom: 1px solid var(--border);
  }
  header a { white-space: nowrap; }
  main { padding-block: clamp(24px, 5vw, 52px) 72px; overflow-wrap: anywhere; }
  h1, h2, h3 { line-height: 1.25; color: #f0f6fc; scroll-margin-top: 20px; overflow-wrap: anywhere; }
  h1 { margin-top: 0; font-size: clamp(1.8rem, 6vw, 2.7rem); }
  h2 {
    margin-top: 2.4em;
    padding-bottom: .35em;
    border-bottom: 1px solid var(--border);
    font-size: clamp(1.3rem, 4vw, 1.7rem);
  }
  p, li { max-width: 76ch; }
  a { color: var(--link); text-underline-offset: 3px; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  code {
    padding: .14em .35em;
    border-radius: 5px;
    background: var(--panel);
    color: var(--code);
    white-space: break-spaces;
    word-break: break-word;
  }
  pre {
    max-width: 100%;
    padding: 16px;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--panel);
    -webkit-overflow-scrolling: touch;
  }
  pre code { padding: 0; background: transparent; white-space: pre; word-break: normal; }
  table {
    display: block;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
    -webkit-overflow-scrolling: touch;
  }
  th, td { min-width: 140px; padding: 10px 12px; border: 1px solid var(--border); text-align: left; vertical-align: top; }
  th { background: var(--panel); }
  blockquote { margin-inline: 0; padding-left: 16px; border-left: 3px solid var(--border); color: var(--muted); }
  @media (max-width: 560px) {
    header { align-items: flex-start; flex-direction: column; }
    main { padding-top: 24px; }
    ul, ol { padding-left: 1.35rem; }
    pre { margin-inline: -8px; padding: 12px; border-radius: 7px; font-size: .85rem; }
  }
</style>
</head>
<body>
<header>
  <strong>Herdr VM documentation</strong>
  <a href="../?role=agent">Open VM</a>
</header>
<main>
$body
</main>
</body>
</html>
"@

Set-Content -LiteralPath $outputPath -Value $renderedPage -Encoding utf8
