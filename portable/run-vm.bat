@echo off
setlocal
cd /d "%~dp0"
if not exist "vm-launcher.exe" (
  echo vm-launcher.exe is missing from this portable bundle.
  exit /b 1
)
"%~dp0vm-launcher.exe" %*
endlocal
