$ErrorActionPreference = 'Stop'
$hostName = 'com.autobro.v86net'
foreach ($browser in @('Google\Chrome', 'Microsoft\Edge', 'Chromium')) {
    $key = "HKCU:\Software\$browser\NativeMessagingHosts\$hostName"
    if (Test-Path $key) { Remove-Item -LiteralPath $key -Force }
}
$installDirectory = Join-Path $env:LOCALAPPDATA 'AutoBro'
if (Test-Path -LiteralPath $installDirectory) {
    $resolved = (Resolve-Path -LiteralPath $installDirectory).Path
    $expected = Join-Path $env:LOCALAPPDATA 'AutoBro'
    if ($resolved -ne $expected) { throw "Refusing to remove unexpected path: $resolved" }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
Write-Host 'AutoBro local networking helper removed for the current user.'
