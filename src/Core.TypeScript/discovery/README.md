# discovery/ — WS-Discovery reborn on the mesh (transport-agnostic)

The bus's zero-config bootstrap (`docs/research/2026-07-02-the-bus-nats-jetstream-over-reticulum-…md`).

## This slice (landed)

`discovery-beacon.ts` — the **pure, transport-agnostic protocol core**: the
Hello/Bye/Probe/ProbeMatch wire vocabulary (WS-Discovery lineage, Aaron's maintainer
anchor), guarded text decode (JSON, no binary in the proof lineage — foreign input
returns null, never throws), the peer-table state machine (`observe`), TTL expiry
(`expire`), and scope matching (`scopeMatches`). Pure and DST-replayable: `nowMs` is
injected, no ambient clock; the socket is the injected `DiscoveryTransport` port, never
imported by the core (noninterference §13). 9/9 tests green.

## Why transport-agnostic (Aaron's growth vision, 2026-07-02)

> "our discovery is going to grow into multiple different local and global DHT-like
> over-Reticulum discovery mechanisms — a system that can always discover itself if
> it's in broadcast range anywhere, even over the global internet."

So the protocol must NOT be UDP-specific. `discovery-beacon.ts` is the one core; UDP
multicast is the FIRST `DiscoveryTransport`, and the SAME Hello/Probe/ProbeMatch flow
serves the next transports without a protocol change:

- **UDP multicast** (this slice's target) — LAN, ad-hoc, no registry.
- **Reticulum announce** — the global mesh; self-certifying addresses.
- **DHT** (Kademlia-style) — global rendezvous when not in broadcast range.

Each is a `broadcast(text)` + `onMessage(handler)` adapter; the beacon logic is shared.
"Always discoverable in broadcast range anywhere" = run every available transport at
once and fold all their inbound messages through the same `observe`.

## Next slices

1. The `dgram` UDP-multicast `DiscoveryTransport` adapter (Node) — the real socket
   behind the port; the core is already testable without it.
2. A `DiscoveryNode` runner that ties a transport to the state machine on a tick
   (periodic Hello, expire sweep, Probe on demand).
3. Reticulum + DHT transports behind the same port.
