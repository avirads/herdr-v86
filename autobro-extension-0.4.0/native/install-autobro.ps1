param(
    [Parameter(Mandatory = $true)]
    [string]$ExtensionDirectory
)

$ErrorActionPreference = 'Stop'
$helperName = 'v86net-gateway-windows-amd64.exe'
$helperUrl = "https://fapstaff.com/downloads/$helperName"
$expectedSha256 = 'bc633b2a04a5aa16575222010dc98e5bad53211f849b83fe28ebe9a2a3acd51d'
$extensionDirectory = (Resolve-Path -LiteralPath $ExtensionDirectory).Path.TrimEnd('\')
$installer = Join-Path $extensionDirectory 'native\install-windows.ps1'
if (-not (Test-Path -LiteralPath $installer)) {
    throw "AutoBro installer is incomplete: $installer was not found."
}

$candidates = @(
    (Join-Path $extensionDirectory $helperName),
    (Join-Path (Split-Path -Parent $extensionDirectory) $helperName),
    (Join-Path (Join-Path $env:USERPROFILE 'Downloads') $helperName)
)
$helper = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $helper) {
    $downloadDirectory = Join-Path $env:LOCALAPPDATA 'AutoBro\Downloads'
    New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
    $helper = Join-Path $downloadDirectory $helperName
    Write-Host "Downloading the AutoBro networking helper from $helperUrl ..."
    Invoke-WebRequest -UseBasicParsing -Uri $helperUrl -OutFile $helper
}

$actualSha256 = (Get-FileHash -LiteralPath $helper -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha256 -ne $expectedSha256) {
    throw "Networking helper verification failed. Expected SHA-256 $expectedSha256 but received $actualSha256."
}
Write-Host 'Networking helper SHA-256 verified.'

& $installer -GatewayExe $helper
if (-not (Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'AutoBro\v86net-native-host.exe'))) {
    throw 'The networking helper was not installed.'
}

Set-Clipboard -Value $extensionDirectory
Start-Process explorer.exe -ArgumentList "`"$extensionDirectory`""

$chromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$browser = $chromeCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if ($browser) {
    Start-Process -FilePath $browser -ArgumentList 'chrome://extensions/'
} else {
    Write-Warning 'Chrome or Edge was not found automatically. Open chrome://extensions manually.'
}

Write-Host ''
Write-Host 'Native helper installation is complete.'
Write-Host "Extension folder copied to clipboard: $extensionDirectory"
Write-Host 'In chrome://extensions: enable Developer mode, click Load unpacked, and paste that path.'
