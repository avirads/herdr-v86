@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0gateway\setup-windows.ps1"" -GatewayExe ""%~dp0gateway\v86net-gateway.exe"" -AllowedOrigin ""http://127.0.0.1:8090""'"
endlocal
