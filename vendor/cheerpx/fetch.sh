#!/bin/sh
# Re-fetch the vendored CheerpX runtime from Leaning Technologies' CDN.
#
# The engine is normally loaded straight from cxrtnc.leaningtech.com at page
# load, which makes that CDN a hard runtime dependency of /cx/ and rules out
# working offline. These files are a pinned copy so the page serves everything
# from its own origin.
#
# The file list is not guesswork and must not be trimmed. It is the closure
# reached from cx.esm.js:
#
#   cx.esm.js      thin ESM shim, re-exports from cx_esm.js
#   cx_esm.js      the engine; references the four files below by bare name
#   cxcore.js      + cxcore.wasm (found by swapping .js for .wasm)
#   cxbridge.js    worker
#   cheerpOS.js    worker
#   workerclock.js worker
#
# fail.wasm and dump.wasm appear as string literals in the engine but are never
# fetched -- they are built in memory and handed to URL.createObjectURL. The CDN
# answers 204 for them, which is also how it says "no such file".
#
# NAMES ARE LOAD-BEARING. cx_esm.js locates its siblings by throwing an Error
# and scanning the stack trace for the substring "/cx_esm.js", then taking
# everything back to the preceding http:/https:/chrome-extension:/isolated-app:
# as the base directory. Rename the file, inline it into a bundle, or serve it
# from a different directory than its siblings and resolution silently breaks.
#
# Usage: sh vendor/cheerpx/fetch.sh [version]      (default 1.3.7)

set -eu

VERSION="${1:-1.3.7}"
BASE="https://cxrtnc.leaningtech.com/${VERSION}"
DEST="$(dirname "$0")/${VERSION}"

FILES="cx.esm.js cx_esm.js cxcore.js cxcore.wasm cxbridge.js cheerpOS.js workerclock.js"

mkdir -p "$DEST"
for f in $FILES; do
    code=$(curl -sS -o "$DEST/$f.tmp" -w '%{http_code}' "$BASE/$f")
    # 204 is this CDN's "not found"; treat anything but a real 200 as fatal
    # rather than leaving a zero-byte file that fails much later at boot.
    if [ "$code" != "200" ] || [ ! -s "$DEST/$f.tmp" ]; then
        rm -f "$DEST/$f.tmp"
        echo "FAILED: $f (HTTP $code) -- $BASE/$f" >&2
        exit 1
    fi
    mv "$DEST/$f.tmp" "$DEST/$f"
    printf '%8s  %s\n' "$(wc -c < "$DEST/$f")" "$f"
done

( cd "$DEST" && sha256sum $FILES > SHA256SUMS )
echo "wrote $DEST/SHA256SUMS"

# Guard against a silently changed upstream: these files are pinned by version
# but the CDN serves them mutably.
( cd "$DEST" && sha256sum -c SHA256SUMS >/dev/null && echo "checksums OK" )
