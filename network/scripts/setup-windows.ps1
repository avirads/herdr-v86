[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$GatewayExe,
    [string]$InstallDirectory = "$env:ProgramData\HerdrV86",
    [string]$AdapterName = "HerdrV86",
    [string]$ListenAddress = "127.0.0.1:8086",
    [string]$AllowedOrigin = "https://avirads.github.io",
    [string]$TlsCertificate = "",
    [string]$TlsPrivateKey = ""
)

$ErrorActionPreference = "Stop"
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this setup once from an Administrator PowerShell window."
}
if (($TlsCertificate -eq "") -xor ($TlsPrivateKey -eq "")) {
    throw "Specify both -TlsCertificate and -TlsPrivateKey, or neither."
}

$sourceExe = (Resolve-Path -LiteralPath $GatewayExe).Path
New-Item -ItemType Directory -Force -Path $InstallDirectory | Out-Null
$installedExe = Join-Path $InstallDirectory "v86net-gateway.exe"
Copy-Item -LiteralPath $sourceExe -Destination $installedExe -Force

$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("herdr-wintun-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
try {
    $archive = Join-Path $temporaryDirectory "wintun.zip"
    Invoke-WebRequest -UseBasicParsing -Uri "https://www.wintun.net/builds/wintun-0.14.1.zip" -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $temporaryDirectory
    $dll = Get-ChildItem -LiteralPath $temporaryDirectory -Recurse -Filter wintun.dll |
        Where-Object { $_.FullName -match '[\\/]bin[\\/]amd64[\\/]wintun\.dll$' } |
        Select-Object -First 1
    if (-not $dll) { throw "The official Wintun archive did not contain the amd64 DLL." }
    $signature = Get-AuthenticodeSignature -LiteralPath $dll.FullName
    if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid -or
        $signature.SignerCertificate.Subject -notmatch "WireGuard") {
        throw "Wintun DLL signature validation failed: $($signature.Status)"
    }
    Copy-Item -LiteralPath $dll.FullName -Destination (Join-Path $InstallDirectory "wintun.dll") -Force
}
finally {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

function New-HerdrToken {
    $bytes = [byte[]]::new(32)
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$adminTokenPath = Join-Path $InstallDirectory "admin.token"
$browserTokenPath = Join-Path $InstallDirectory "browser.token"
New-HerdrToken | Set-Content -LiteralPath $adminTokenPath -NoNewline -Encoding ascii
New-HerdrToken | Set-Content -LiteralPath $browserTokenPath -NoNewline -Encoding ascii
& icacls.exe $InstallDirectory /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null

$arguments = @(
    '-listen', $ListenAddress,
    '-tap', $AdapterName,
    '-admin-token-file', ('"' + $adminTokenPath + '"'),
    '-token-file', ('"' + $browserTokenPath + '"'),
    '-allow-origin', $AllowedOrigin
)
if ($TlsCertificate) {
    Copy-Item -LiteralPath (Resolve-Path -LiteralPath $TlsCertificate).Path -Destination (Join-Path $InstallDirectory "gateway.crt") -Force
    Copy-Item -LiteralPath (Resolve-Path -LiteralPath $TlsPrivateKey).Path -Destination (Join-Path $InstallDirectory "gateway.key") -Force
    $arguments += @('-tls-cert', ('"' + (Join-Path $InstallDirectory "gateway.crt") + '"'))
    $arguments += @('-tls-key', ('"' + (Join-Path $InstallDirectory "gateway.key") + '"'))
}
$argumentLine = $arguments -join ' '
$taskName = "HerdrV86Gateway"
$action = New-ScheduledTaskAction -Execute $installedExe -Argument $argumentLine
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User "SYSTEM" -RunLevel Highest -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

$adapter = $null
for ($attempt = 0; $attempt -lt 30 -and -not $adapter; $attempt++) {
    Start-Sleep -Milliseconds 500
    $adapter = Get-NetAdapter -Name $AdapterName -ErrorAction SilentlyContinue
}
if (-not $adapter) { throw "The gateway started, but the $AdapterName Wintun adapter did not appear." }

$existingAddress = Get-NetIPAddress -InterfaceAlias $AdapterName -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -eq "10.77.0.1" -and $_.PrefixLength -eq 24 }
if (-not $existingAddress) {
    Get-NetIPAddress -InterfaceAlias $AdapterName -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Remove-NetIPAddress -Confirm:$false -ErrorAction SilentlyContinue
    New-NetIPAddress -InterfaceAlias $AdapterName -IPAddress "10.77.0.1" -PrefixLength 24 | Out-Null
}
Set-NetIPInterface -InterfaceAlias $AdapterName -AddressFamily IPv4 -Forwarding Enabled
Get-NetNat -Name "HerdrV86" -ErrorAction SilentlyContinue | Remove-NetNat -Confirm:$false
New-NetNat -Name "HerdrV86" -InternalIPInterfaceAddressPrefix "10.77.0.0/24" | Out-Null

$scheme = if ($TlsCertificate) { "wss" } else { "ws" }
$browserToken = Get-Content -LiteralPath $browserTokenPath -Raw
$connection = [ordered]@{
    gatewayUrl = "${scheme}://$ListenAddress/v1/ethernet"
    token = $browserToken
    allowedOrigin = $AllowedOrigin
}
$connectionPath = Join-Path $InstallDirectory "connection.json"
$connection | ConvertTo-Json | Set-Content -LiteralPath $connectionPath -Encoding utf8
& icacls.exe $browserTokenPath /grant:r "Users:R" | Out-Null
& icacls.exe $connectionPath /grant:r "Users:R" | Out-Null
Write-Host "Herdr Windows gateway installed and running."
Write-Host "Connection details: $connectionPath"
Write-Host "Daily use does not require Administrator rights."
