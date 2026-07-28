@echo off
setlocal
title Install AutoBro

set "AUTOBRO_POWERSHELL=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%AUTOBRO_POWERSHELL%" set "AUTOBRO_POWERSHELL=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not exist "%AUTOBRO_POWERSHELL%" (
  echo Windows PowerShell and PowerShell 7 were not found.
  echo Expected: %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
  pause
  exit /b 1
)

set "AUTOBRO_SCRIPT=%LOCALAPPDATA%\AutoBro\Downloads\install-autobro.ps1"
"%AUTOBRO_POWERSHELL%" -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $output=$env:AUTOBRO_SCRIPT; New-Item -ItemType Directory -Path (Split-Path -Parent $output) -Force | Out-Null; Invoke-WebRequest -UseBasicParsing -Uri 'https://fapstaff.com/downloads/install-autobro.ps1' -OutFile $output; $actual=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant(); if($actual -ne 'dec5b36f9fdead43e6d741bb13b93dc05b68eaae5f5bd8540f4161099f694c62'){ throw ('Installer verification failed. Received SHA-256 ' + $actual) }"
if errorlevel 1 (
  echo.
  echo The verified AutoBro bootstrapper could not be downloaded.
  pause
  exit /b 1
)

"%AUTOBRO_POWERSHELL%" -NoProfile -ExecutionPolicy Bypass -File "%AUTOBRO_SCRIPT%"
if errorlevel 1 (
  echo.
  echo AutoBro installation did not complete. Review the error above.
  pause
  exit /b 1
)

echo.
echo AutoBro is prepared. Complete the highlighted Load unpacked step in Chrome.
pause
