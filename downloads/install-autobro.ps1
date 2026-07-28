param()

$ErrorActionPreference = 'Stop'
$extensionUrl = 'https://fapstaff.com/downloads/autobro-web-bridge-0.4.0.zip'
$extensionSha256 = '959a6921685fc1f650fe0fa528431df7cf3befb7e2d0b1623c64681016a322f7'
$helperName = 'v86net-gateway-windows-amd64.exe'
$helperUrl = "https://fapstaff.com/downloads/$helperName"
$helperSha256 = 'bc633b2a04a5aa16575222010dc98e5bad53211f849b83fe28ebe9a2a3acd51d'
$downloadDirectory = Join-Path $env:LOCALAPPDATA 'AutoBro\Downloads'
$extensionDirectory = Join-Path $env:LOCALAPPDATA 'AutoBro\Extension-0.4.0'
$extensionZip = Join-Path $downloadDirectory 'autobro-web-bridge-0.4.0.zip'
$helper = Join-Path $downloadDirectory $helperName

New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
Write-Host 'Downloading AutoBro Chrome extension...'
Invoke-WebRequest -UseBasicParsing -Uri $extensionUrl -OutFile $extensionZip
$actualExtensionHash = (Get-FileHash -LiteralPath $extensionZip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualExtensionHash -ne $extensionSha256) {
    throw "AutoBro ZIP verification failed. Expected $extensionSha256 but received $actualExtensionHash."
}

if (Test-Path -LiteralPath $extensionDirectory) {
    $resolved = (Resolve-Path -LiteralPath $extensionDirectory).Path
    $expected = Join-Path $env:LOCALAPPDATA 'AutoBro\Extension-0.4.0'
    if ($resolved -ne $expected) { throw "Refusing to replace unexpected directory: $resolved" }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
Expand-Archive -LiteralPath $extensionZip -DestinationPath $extensionDirectory -Force

Write-Host 'Downloading AutoBro userspace networking helper...'
Invoke-WebRequest -UseBasicParsing -Uri $helperUrl -OutFile $helper
$actualHelperHash = (Get-FileHash -LiteralPath $helper -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHelperHash -ne $helperSha256) {
    throw "Networking helper verification failed. Expected $helperSha256 but received $actualHelperHash."
}

$nativeInstaller = Join-Path $extensionDirectory 'native\install-windows.ps1'
if (-not (Test-Path -LiteralPath $nativeInstaller)) {
    throw "Downloaded AutoBro package is incomplete: $nativeInstaller was not found."
}
& $nativeInstaller -GatewayExe $helper

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
Write-Host 'AutoBro and its userspace networking helper are prepared.'
Write-Host "Extension folder copied to clipboard: $extensionDirectory"
Write-Host 'Enable Developer mode, click Load unpacked, and paste the copied path.'
