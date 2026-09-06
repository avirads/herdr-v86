# Local patches to `libv86-network.js`

`libv86-network.js` is a prebuilt v86 bundle checked into this repository with no
build step. Patches applied to it are recorded here so they are not silently lost
the next time the bundle is replaced from upstream.

## 1. Drop the `X-Accept-Encoding` request header on disk reads

**Why.** v86's async disk loader sets `X-Accept-Encoding: identity` on every
range request. That header is not CORS-safelisted, so cross-origin disk reads
become *preflighted* requests, and the image host must answer the `OPTIONS` with
`Access-Control-Allow-Headers: X-Accept-Encoding`. A host that only sends
`Access-Control-Allow-Origin: *` — GitHub release assets, and most object stores
where response headers are not configurable — fails the preflight.

The failure is silent and looks like a hang. The disk XHR is rejected before it
reaches the network, the guest never receives a sector, and the boot overlay
parks at 90%: `bootTicker` in `index.html` caps there while `shellReady` is
false, so there is no error, only a stall.

**The change.** One call, `setRequestHeader("X-Accept-Encoding","identity")` →
`setRequestHeader("Accept","*/*")`. `Accept` is CORS-safelisted, so the request
stays *simple*: no preflight, and `Range` is itself safelisted. The bundle goes
from 353,762 to 353,746 bytes.

**The tradeoff.** The original header asks the server not to transfer-encode the
ranged response, because v86 needs exact byte ranges. Dropping it is safe with a
server that does not compress `application/octet-stream` — nginx does not by
default, and neither does GitHub — but a host that gzips byte ranges would return
corrupt sectors. If disk reads ever come back garbled from a new image host,
check its `Content-Encoding` on a ranged response first.

**Verification.** With an image served from a second origin that allows only
`Range`, matching what release assets provide:

- before the patch: CORS error `Request header field x-accept-encoding is not
  allowed`, boot stalls at 90%
- after the patch: boot reaches `100% Ready` in about 9 seconds

Same-origin boots are unaffected and were re-checked at `100% Ready`.

**Removal condition.** Drop this patch if upstream v86 stops sending the header,
or if every deployment serves disk images from the page's own origin. It exists
only to make cross-origin image hosting work; see `imageBaseUrl` in
`images/v86/vm-images.json`.
