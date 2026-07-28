AutoBro Windows userspace networking helper
============================================

INSTALL

1. Extract this entire ZIP to a folder.
2. Double-click "Install AutoBro Helper.cmd".
3. Restart Chrome or Edge.
4. Return to https://fapstaff.com/ and reconnect AutoBro.

The installer copies v86net-native-host.exe to:

  %LOCALAPPDATA%\AutoBro

It registers Chrome Native Messaging under HKCU for the current user. It does
not use PowerShell, request administrator rights, install a service, or modify
network adapters.

UNINSTALL

Double-click "Uninstall AutoBro Helper.cmd".

SOURCE

The source directory contains the complete Go module needed to reproduce the
included executable. From that directory, with Go installed:

  set CGO_ENABLED=0
  set GOOS=windows
  set GOARCH=amd64
  go build -trimpath -ldflags="-s -w" -o v86net-native-host.exe ./cmd/v86net-gateway

The binary enters Chrome Native Messaging mode because its installed filename
starts with "v86net-native-host".
