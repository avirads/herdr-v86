@echo off
setlocal
title Install AutoBro
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0native\install-autobro.ps1" -ExtensionDirectory "%~dp0"
if errorlevel 1 (
  echo.
  echo AutoBro installation did not complete. Review the error above.
  pause
  exit /b 1
)
echo.
echo The helper is installed. In Chrome, enable Developer mode, click
echo "Load unpacked", and paste the extension folder path copied to your
echo clipboard.
pause
