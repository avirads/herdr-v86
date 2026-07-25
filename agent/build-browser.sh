#!/bin/sh
# Bundle an entry for the browser with every node builtin aliased away.
set -eu
ENTRY=$1; OUT=$2
npx esbuild "$ENTRY" --bundle --format=esm --platform=browser --target=chrome120 \
  --alias:path=path-browserify --alias:path/posix=path-browserify \
  --alias:fs=./shims/fs-stub.js --alias:fs/promises=./shims/fs-stub.js \
  --alias:os=./shims/os-stub.js --alias:crypto=./shims/crypto-stub.js \
  --alias:events=./shims/events.js --alias:stream/web=./shims/stream-web.js \
  --alias:url=./shims/url.js --alias:stream=./shims/stream.js \
  --alias:child_process=./shims/child_process.js --alias:async_hooks=./shims/async_hooks.js \
  --alias:string_decoder=./shims/string_decoder.js --alias:module=./shims/module.js \
  --inject:./shims/globals.js --outfile="$OUT"
