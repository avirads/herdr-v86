@echo off
setlocal EnableExtensions

for %%B in ("Google\Chrome" "Microsoft\Edge" "Chromium") do (
    %SystemRoot%\System32\reg.exe delete "HKCU\Software\%%~B\NativeMessagingHosts\com.autobro.v86net" /f >nul 2>nul
)

del /q "%LOCALAPPDATA%\AutoBro\com.autobro.v86net.json" >nul 2>nul
del /q "%LOCALAPPDATA%\AutoBro\v86net-native-host.exe" >nul 2>nul
rmdir "%LOCALAPPDATA%\AutoBro" >nul 2>nul

echo.
echo AutoBro networking helper removed for the current user.
echo.
pause
