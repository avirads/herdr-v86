@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "SOURCE_EXE=%~dp0v86net-native-host.exe"
set "INSTALL_DIR=%LOCALAPPDATA%\AutoBro"
set "INSTALLED_EXE=%INSTALL_DIR%\v86net-native-host.exe"
set "MANIFEST=%INSTALL_DIR%\com.autobro.v86net.json"

if not exist "%SOURCE_EXE%" (
    echo ERROR: v86net-native-host.exe is missing from this folder.
    goto :failed
)

if not defined LOCALAPPDATA (
    echo ERROR: LOCALAPPDATA is not available.
    goto :failed
)

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if errorlevel 1 (
    echo ERROR: Could not create "%INSTALL_DIR%".
    goto :failed
)

copy /y "%SOURCE_EXE%" "%INSTALLED_EXE%" >nul
if errorlevel 1 (
    echo ERROR: Could not install the helper. Close Chrome and try again.
    goto :failed
)

set "JSON_EXE=%INSTALLED_EXE:\=\\%"
(
    echo {
    echo   "name": "com.autobro.v86net",
    echo   "description": "AutoBro unprivileged v86 userspace network helper",
    echo   "path": "%JSON_EXE%",
    echo   "type": "stdio",
    echo   "allowed_origins": ["chrome-extension://aaigkodgcmkbipbacijelgebhchknkln/"]
    echo }
) > "%MANIFEST%"
if errorlevel 1 (
    echo ERROR: Could not write the Native Messaging manifest.
    goto :failed
)

for %%B in ("Google\Chrome" "Microsoft\Edge" "Chromium") do (
    %SystemRoot%\System32\reg.exe add "HKCU\Software\%%~B\NativeMessagingHosts\com.autobro.v86net" /ve /t REG_SZ /d "%MANIFEST%" /f >nul
    if errorlevel 1 (
        echo ERROR: Could not register the helper for %%~B.
        goto :failed
    )
)

echo.
echo AutoBro networking helper installed successfully.
echo Restart Chrome or Edge, then reconnect AutoBro in fapstaff.com.
echo.
pause
exit /b 0

:failed
echo.
echo AutoBro installation did not complete.
echo.
pause
exit /b 1
