# Gateway-free browser bridge

The host bridge uses the v86 serial port to expose bounded browser services to
the 32-bit guest. It does not create a NIC, guest IP address, DNS resolver, or
general TCP/UDP connectivity.

> **A socket-backed alternative now exists.** In the `local` and `hybrid`
> network modes the page holds an address on the guest LAN and publishes the
> same services over real sockets — see
> [browser LAN services](../../providers/v86/lan-services.js) and the guest's
> `vmlan` command. That path has no tty size cap (the serial bridge caps
> vmfetch at 16 MiB and vmexport at 8 MiB) and moves megabytes per second rather
> than ~11 KB/s: a 12 MiB export takes ~8.7 s over sockets. `eval "$(vmlan env)"`
> also points `http_proxy` at the page, so unmodified curl/wget/apk work for
> plain HTTP with no guest command at all.
>
> The serial bridge described below remains the fallback, and is the only option
> in `gateway` mode, where the page is not on the guest LAN. Both paths are
> equally bound by browser security policy: cross-origin targets must send
> permissive CORS headers either way, and neither can tunnel TLS, so HTTPS is
> fetched *by the browser* (`vmlan fetch`) rather than proxied.

## Guest commands

```sh
vmfetch -o page.html https://example.com/
vmfetch -X POST -H 'Content-Type: application/json' -d '{}' -o response.json https://api.example.com/
vmclip read
printf 'copied from the guest' | vmclip write
vmexport /root/result.txt
vmgithub repo owner/repository
vmgithub archive owner/repository main source.tar.gz
OPENAI_API_KEY=... vmai 'Summarize this project'
vmllm status
vmllm 'Summarize this project locally'
```

`vmfetch` supports GET and other HTTP methods, repeatable request headers,
request bodies, redirects, streamed responses, stdout with `-o -`, and files up
to 16 MiB. It permits HTTPS plus localhost HTTP. Browser CORS and forbidden
header rules still apply; the bridge cannot bypass browser security policy.

The toolbar imports files (up to 8 MiB) into `/root`, and saves/restores a full
VM snapshot in IndexedDB. `vmexport` downloads a guest file through the browser.
Clipboard operations require browser permission and can require a user gesture.

API credentials remain in guest memory but pass through the hosting page when a
request is made. Only use credentials with narrow scope, short expiry, and a
trusted copy of the page. GitHub and AI requests also require the remote endpoint
to allow the page origin through CORS. A same-origin backend can be used where an
API does not permit browser-originated requests.

The existing WebRTC DataChannel adapter is a transport for a separately paired
peer. Signaling, identity verification, and a remote peer are deployment-owned;
WebRTC alone cannot provide Internet access or bypass CORS.

`vmllm` is a separate authenticated RPC path to the AutoBro Web Bridge Chrome
extension. The extension owns the LiteRT-LM WebGPU runtime, model cache, and
offscreen inference document. The guest sends OpenAI-style chat messages and
receives the final assistant text through the bounded serial bridge.
