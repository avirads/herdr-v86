[CmdletBinding()]
param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "dist"),
    [string]$ModelPath = "D:\zero\gemma-4-E2B-it-web.litertlm",
    [switch]$ReuseDownloads
)

$ErrorActionPreference = "Stop"
$repository = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$version = "0.5.0"
$chromeVersion = "150.0.7871.129"
$modelRevision = "main"
$modelName = "gemma-4-E2B-it-web.litertlm"
$modelSha256 = "3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5"
$cache = Join-Path $OutputDirectory "cache"
$stage = Join-Path $OutputDirectory "VM-portable-windows-x64-v$version"
$archive = "$stage.zip"
New-Item -ItemType Directory -Force -Path $cache | Out-Null
if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
New-Item -ItemType Directory -Force -Path $stage,(Join-Path $stage "app"),(Join-Path $stage "gateway"),(Join-Path $stage "models") | Out-Null

function Get-PortableAsset([string]$Url, [string]$Path, [string]$Sha256 = "") {
    if (-not ($ReuseDownloads -and (Test-Path $Path))) {
        Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Path
    }
    if ($Sha256) {
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
        if ($actual -ne $Sha256) { throw "Checksum mismatch for $Path`: $actual" }
    }
}

Push-Location $PSScriptRoot
try {
    go build -trimpath -ldflags "-s -w" -o (Join-Path $stage "vm-launcher.exe") ./cmd/vm-launcher
} finally { Pop-Location }
Copy-Item (Join-Path $PSScriptRoot "run-vm.bat") $stage
Copy-Item (Join-Path $PSScriptRoot "setup-network.bat") $stage
Copy-Item (Join-Path $PSScriptRoot "vm-portable.example.json") $stage

Push-Location (Join-Path $repository "network")
try {
    go build -trimpath -ldflags "-s -w" -o (Join-Path $stage "gateway\v86net-gateway.exe") ./cmd/v86net-gateway
} finally { Pop-Location }
Copy-Item (Join-Path $repository "network\scripts\setup-windows.ps1") (Join-Path $stage "gateway")
Copy-Item (Join-Path $repository "network\scripts\teardown-windows.ps1") (Join-Path $stage "gateway")
$wintunZip = Join-Path $cache "wintun-0.14.1.zip"
Get-PortableAsset "https://www.wintun.net/builds/wintun-0.14.1.zip" $wintunZip
$wintunExtract = Join-Path $cache "wintun-0.14.1"
if (-not (Test-Path (Join-Path $wintunExtract "wintun\bin\amd64\wintun.dll"))) {
    if (Test-Path $wintunExtract) { Remove-Item $wintunExtract -Recurse -Force }
    Expand-Archive -LiteralPath $wintunZip -DestinationPath $wintunExtract
}
Copy-Item (Join-Path $wintunExtract "wintun\bin\amd64\wintun.dll") (Join-Path $stage "gateway")
Copy-Item (Join-Path $wintunExtract "wintun\LICENSE.txt") (Join-Path $stage "gateway\WINTUN-LICENSE.txt")

$appFiles = @(
    "index.html", "remote.html", "README.md", "llms.txt", "xterm.js", "xterm.css",
    "libv86-network.js", "v86-network.wasm", "seabios.bin", "vgabios.bin",
    "bzImage-network", "vm-network-ext4.img"
)
foreach ($relative in $appFiles) { Copy-Item (Join-Path $repository $relative) (Join-Path $stage "app\$relative") }
foreach ($directory in @("agent\dist", "network\browser", "llm\vendor", "vendor\moonshine", "docs")) {
    $destination = Join-Path $stage ("app\" + $directory)
    New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
    Copy-Item (Join-Path $repository $directory) $destination -Recurse
}

$extensionZip = Join-Path $repository "downloads\autobro-web-bridge-0.4.0.zip"
Expand-Archive -LiteralPath $extensionZip -DestinationPath (Join-Path $stage "extension")

$chromeZip = Join-Path $cache "chrome-for-testing-$chromeVersion-win64.zip"
Get-PortableAsset "https://storage.googleapis.com/chrome-for-testing-public/$chromeVersion/win64/chrome-win64.zip" $chromeZip
Expand-Archive -LiteralPath $chromeZip -DestinationPath (Join-Path $stage "browser")

$model = Join-Path $stage "app\models\$modelName"
New-Item -ItemType Directory -Force -Path (Split-Path $model) | Out-Null
if (-not (Test-Path -LiteralPath $ModelPath)) { throw "Required offline model is missing: $ModelPath" }
$actualModelHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ModelPath).Hash.ToLowerInvariant()
if ($actualModelHash -ne $modelSha256) { throw "Unexpected Gemma model checksum: $actualModelHash" }
Copy-Item -LiteralPath $ModelPath -Destination $model
Get-PortableAsset "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/$modelRevision/README.md" (Join-Path $stage "models\Gemma-4-E2B-MODEL-CARD.md")

$hashes = Get-ChildItem $stage -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($stage.Length + 1).Replace('\','/')
    "{0}  {1}" -f (Get-FileHash -Algorithm SHA256 $_.FullName).Hash.ToLowerInvariant(),$relative
}
$hashes | Set-Content -LiteralPath (Join-Path $stage "SHA256SUMS.txt") -Encoding ascii

@"
# VM portable Windows x64

Run ``run-vm.bat``. Remote full gateway is the default. Session tokens are
prompted for each launch and are not saved. Modes 2 (local userspace) and 5
(offline) need no installation or Administrator rights.

Mode 3 uses the optional Wintun backend. Run the bundled setup script once from
an Administrator PowerShell before selecting it.

The offline model is Gemma 4 E2B's WebGPU LiteRT-LM build. Its upstream model
card is in ``models/Gemma-4-E2B-MODEL-CARD.md``.

The guest includes ``/usr/local/bin/herdr`` but continues to boot to the shell.
"@ | Set-Content -LiteralPath (Join-Path $stage "README.txt") -Encoding utf8

& (Join-Path $env:SystemRoot "System32\tar.exe") -a -c -f $archive -C $OutputDirectory (Split-Path $stage -Leaf)
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $archive)) { throw "Creating portable ZIP failed" }
Write-Host "Built $archive"
