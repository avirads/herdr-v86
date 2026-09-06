#!/usr/bin/env bash
# Build the GitHub Pages artifact from the checkout.
#
# The site is ordinary static content -- agent/dist/ is committed, so there is
# no build step. Two things differ from the fapstaff.com deployment:
#
#   1. Pages serves under a project subpath (/herdr-v86/), not a domain root,
#      so the handful of root-absolute URLs in the tree are rewritten here
#      rather than in the sources, which stay correct for fapstaff.com.
#   2. Pages cannot set response headers, so /cx/ (CheerpX) will not start --
#      it needs COOP/COEP for SharedArrayBuffer. The v86 provider is unaffected.
#
# The v86 .img disk images are not in git (see network/deploy/DEPLOY.md), so the
# published site carries images/v86/vm-images.json without the images it names.
set -euo pipefail

rm -rf _site
mkdir -p _site

# Everything in the checkout is deployable except the build/CI plumbing and the
# production rescue archive, which nothing on the site links to.
tar -cf - \
  --exclude=./.git \
  --exclude=./.github \
  --exclude=./_site \
  --exclude=./node_modules \
  --exclude=./agent/node_modules \
  --exclude=./models \
  --exclude=./rescued-from-production \
  . | tar -xf - -C _site

# upload-pages-artifact does not run Jekyll, but the marker keeps behaviour the
# same if the site is ever served from a branch instead.
touch _site/.nojekyll

base_path="${BASE_PATH:-}"
if [ -z "$base_path" ] || [ "$base_path" = "/" ]; then
  echo "Serving from the domain root; no path rewrite needed."
  exit 0
fi
base_path="${base_path%/}"
echo "Rewriting root-absolute URLs for base path: $base_path"

# index.html links four downloads as /downloads/... and /skills/...; offline.html
# loads one icon as /assets/....
sed -i "s#href=\"/#href=\"${base_path}/#g" _site/index.html
sed -i "s#src=\"/#src=\"${base_path}/#g" _site/offline.html

# Every slash-prefixed string value in the manifest is a URL: id, scope,
# start_url, icon srcs and shortcut urls. Keys are unquoted-slash-free, so a
# blanket rewrite of quoted values that begin with "/" is exact here.
sed -i "s#\"/#\"${base_path}/#g" _site/app.webmanifest

python3 -c 'import json,sys; json.load(open("_site/app.webmanifest"))' \
  && echo "app.webmanifest still parses as JSON."

grep -n "$base_path" _site/app.webmanifest
