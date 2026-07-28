#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/v86net-gateway" >&2
  exit 2
fi

SOURCE="$(realpath "$1")"
INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/autobro"
EXE="$INSTALL_DIR/v86net-gateway"
LAUNCHER="$INSTALL_DIR/v86net-native-host"
MANIFEST="$INSTALL_DIR/com.autobro.v86net.json"

mkdir -p "$INSTALL_DIR"
install -m 0755 "$SOURCE" "$EXE"
printf '#!/usr/bin/env sh\nexec "%s" -native-messaging\n' "$EXE" > "$LAUNCHER"
chmod 0755 "$LAUNCHER"
printf '%s\n' \
  '{' \
  '  "name": "com.autobro.v86net",' \
  '  "description": "AutoBro unprivileged v86 userspace network helper",' \
  "  \"path\": \"$LAUNCHER\"," \
  '  "type": "stdio",' \
  '  "allowed_origins": ["chrome-extension://aaigkodgcmkbipbacijelgebhchknkln/"]' \
  '}' > "$MANIFEST"

for DIRECTORY in \
  "${XDG_CONFIG_HOME:-$HOME/.config}/google-chrome/NativeMessagingHosts" \
  "${XDG_CONFIG_HOME:-$HOME/.config}/chromium/NativeMessagingHosts" \
  "${XDG_CONFIG_HOME:-$HOME/.config}/microsoft-edge/NativeMessagingHosts"
do
  mkdir -p "$DIRECTORY"
  ln -sf "$MANIFEST" "$DIRECTORY/com.autobro.v86net.json"
done

echo "AutoBro local networking helper installed for the current user."
echo "Restart the browser, then reconnect AutoBro in Herdr."
