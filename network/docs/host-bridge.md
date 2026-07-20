# Gateway-free browser bridge

The host bridge uses the v86 serial port to expose bounded browser services to
the 32-bit guest. It does not create a NIC, guest IP address, DNS resolver, or
general TCP/UDP connectivity.

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
