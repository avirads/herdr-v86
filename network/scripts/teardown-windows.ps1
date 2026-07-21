[CmdletBinding()]
param([switch]$RemoveInstalledFiles)

$ErrorActionPreference = "Stop"
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run teardown from an Administrator PowerShell window."
}

$task = Get-ScheduledTask -TaskName "VMV86Gateway" -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName "VMV86Gateway" -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName "VMV86Gateway" -Confirm:$false
}
Get-NetNat -Name "VMV86" -ErrorAction SilentlyContinue | Remove-NetNat -Confirm:$false
if ($RemoveInstalledFiles) {
    $installDirectory = Join-Path $env:ProgramData "VMV86"
    $resolvedProgramData = (Resolve-Path -LiteralPath $env:ProgramData).Path
    if ([IO.Path]::GetFullPath($installDirectory).StartsWith($resolvedProgramData + [IO.Path]::DirectorySeparatorChar)) {
        Remove-Item -LiteralPath $installDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "VM Windows gateway and NAT configuration removed."
