[CmdletBinding()]
param([switch]$RemoveInstalledFiles)

$ErrorActionPreference = "Stop"
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run teardown from an Administrator PowerShell window."
}

$task = Get-ScheduledTask -TaskName "HerdrV86Gateway" -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName "HerdrV86Gateway" -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName "HerdrV86Gateway" -Confirm:$false
}
Get-NetNat -Name "HerdrV86" -ErrorAction SilentlyContinue | Remove-NetNat -Confirm:$false
if ($RemoveInstalledFiles) {
    $installDirectory = Join-Path $env:ProgramData "HerdrV86"
    $resolvedProgramData = (Resolve-Path -LiteralPath $env:ProgramData).Path
    if ([IO.Path]::GetFullPath($installDirectory).StartsWith($resolvedProgramData + [IO.Path]::DirectorySeparatorChar)) {
        Remove-Item -LiteralPath $installDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "Herdr Windows gateway and NAT configuration removed."

