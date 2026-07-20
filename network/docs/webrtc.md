# Optional WebRTC data plane

`browser/v86-datachannel-network.js` carries the same raw Ethernet frames over
an already-negotiated `RTCDataChannel`. The application owns signaling and
ties it to the same short-lived v86 session identity used by the WebSocket
gateway.

```js
const channel = peer.createDataChannel('ethernet', {
  ordered: false,
  maxRetransmits: 2,
});
const adapter = new V86DataChannelNetwork(emulator, channel).start();
```

Use WebSocket as signaling and fallback. The remote WebRTC peer must terminate
the channel into the TAP interface; a browser DataChannel cannot directly open
internet TCP or UDP sockets. TURN is required where direct ICE connectivity
fails. The WebSocket path remains the production default because it is easier
to deploy through corporate networks and reverse proxies.
