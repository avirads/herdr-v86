# Build the static 32-bit ELF for v86 from Windows (PowerShell).
param(
  [string]$Version = "0.1.0",
  [string]$Out = "dist/vaptr-linux-386"
)
$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null

Write-Host "Building vaptr $Version for linux/386 (static, CGO off)..."
$env:CGO_ENABLED = "0"
$env:GOOS = "linux"
$env:GOARCH = "386"
go build -trimpath -ldflags "-s -w -X main.version=$Version" -o $Out ./cmd/vaptr

Remove-Item Env:CGO_ENABLED, Env:GOOS, Env:GOARCH
Write-Host "Done: $Out"
Get-Item $Out | Select-Object Name, Length
