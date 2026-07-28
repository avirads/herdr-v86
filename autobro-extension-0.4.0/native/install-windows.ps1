param(
    [Parameter(Mandatory = $true)]
    [string]$GatewayExe
)

$ErrorActionPreference = 'Stop'
$extensionId = 'aaigkodgcmkbipbacijelgebhchknkln'
$hostName = 'com.autobro.v86net'
$source = (Resolve-Path -LiteralPath $GatewayExe).Path
$installDirectory = Join-Path $env:LOCALAPPDATA 'AutoBro'
$installedExe = Join-Path $installDirectory 'v86net-native-host.exe'
$manifestPath = Join-Path $installDirectory "$hostName.json"

New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $installedExe -Force

$manifest = [ordered]@{
    name = $hostName
    description = 'AutoBro unprivileged v86 userspace network helper'
    path = $installedExe
    type = 'stdio'
    allowed_origins = @("chrome-extension://$extensionId/")
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding utf8

foreach ($browser in @('Google\Chrome', 'Microsoft\Edge', 'Chromium')) {
    $key = "HKCU:\Software\$browser\NativeMessagingHosts\$hostName"
    New-Item -Path $key -Force | Out-Null
    Set-Item -Path $key -Value $manifestPath
}

Write-Host 'AutoBro local networking helper installed for the current user.'
Write-Host 'No administrator rights or network adapter changes were used.'
Write-Host 'Restart the browser, then reconnect AutoBro in Herdr.'
