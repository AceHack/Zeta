# The connectionless mesh transport: UDP-broadcast duplex-multiplex, with HEAT as the backpressure (shadow*)

**Date:** 2026-07-03
**Provenance:** Aaron, extending the MultiplexedWebSockets / unified-stack thread:
*"I was going to write a UDP-broadcast-discovery-based impl too that needed no TCP control on top, but
never got to it — I'd have needed more protocols on top because of expected packet loss when pushing
UDP to those throughput rates."* + *"it would need some auto-negotiated backoff — THIS IS OUR HEAT, if
you look at what Vera has been working on tracking our heat; this is the backpressure system I needed
to make it work over UDP / analog mesh networks."* + *"plus Reticulum."* Ferried by Otto (shadow) with
the heat system read from the repo + the anchors. Extends
[the bidirectional-stack ferry](2026-07-03-bidirectional-mutual-interruptible-stack-multiplexed-websockets-over-reticulum-self-similar.md).

---

## 1. The idea: a connectionless duplex-multiplex over UDP broadcast (no TCP control)

MultiplexedWebSockets multiplexes many Guid-correlated duplex streams over one *TCP* WebSocket.
Aaron's unbuilt variant drops the TCP: **UDP broadcast for discovery + the same correlated duplex
multiplex, connectionless.** No handshake, no per-peer connection — a node broadcasts, peers hear it,
streams are correlated by id in the datagrams. This is the *scale-free, broker-less* form of the same
bidirectional-mutually-interruptible stream (manifesto §1/§10): the mesh realization.

But UDP gives you *nothing* TCP gave you for free — no reliability, no ordering, no flow control. At
the throughput MultiplexedWebSockets hits (~115k/s), **packet loss is expected**, so you must add
"more protocols on top." Three concerns, three answers — and two of them are already in the repo:

## 2. The three layers on top of raw UDP broadcast (and where each already lives)

### (a) Reliability / loss recovery — FEC over broadcast (avoid NAK implosion), or Reticulum
Retransmit-based reliability (ARQ / selective-NAK) does not scale on *broadcast*: every receiver
NAKing a lost packet is the classic **NAK-implosion** problem. The broadcast-correct answer is
**forward error correction** — send redundancy so receivers recover *without* asking (fountain /
rateless codes: LT, Raptor, **RaptorQ / RFC 6330**; or Reed–Solomon blocks). Prior art for exactly
this shape: **NORM (NACK-Oriented Reliable Multicast, RFC 5740)**, **PGM (RFC 3208)**. And **Reticulum**
(Aaron: "plus Reticulum") brings its own reliability + self-certifying addressing + runs over anything
including UDP — so the transport can lean on Reticulum for the mesh-reliability layer rather than
re-deriving NORM.

### (b) Backpressure / congestion control — THIS IS OUR HEAT (Vera's system)
The load-bearing insight. Over an analog / lossy mesh you **cannot** use TCP's implicit congestion
signals (RTT inflation, drop-as-signal) reliably — loss is ambient noise, not a clean congestion cue.
You need an **explicit, metered, propagating backpressure signal**. **That signal already exists and
is shipped: heat.** Read from the repo:

- `src/Core/Heat.fs` — `HeatSignature` with `isBackpressureKind` (heat literally *is* a backpressure
  kind); the heat-readout treaty (Vera's recent work: `#9351/#9355/#9370/#9373` — universal +
  black-body temperature readouts) makes heat a **universal, cross-oracle metered signal**.
- `src/Core/TelemetrySource.fs` — `pressureOf` maps felt heat into **SoftThrottle admission pressure**:
  *"the agent slows down BY FEELING heat, not by being told (interoception → the flux governor; our
  only governor is ethics and heat)."* `signalIfOverloaded` is the graduated distress channel.

So **heat = the auto-negotiated backoff Aaron needed.** A node radiates its heat; peers feel it and
back off — congestion control as *thermodynamic backpressure*, an explicit propagating signal (the
closest classical analog is **ECN — Explicit Congestion Notification**, but heat is ECN made
*first-class, metered, and propagating* rather than a single bit). It is the right congestion primitive
precisely *because* it does not depend on the loss/RTT cues UDP-over-analog-mesh destroys. Heat travels
*in the message* through declared channels (noninterference §13) — so backpressure is ambient-leak-free
and works where TCP's assumptions break. Vera's heat work and Aaron's unbuilt UDP transport are the
same system: **heat is the mesh's congestion control.**

### (c) Discovery + auth — already built
UDP-broadcast discovery is `discovery-beacon.ts` (WS-Discovery reborn: Hello/Bye/Probe on UDP
multicast), and its **auth** is the signed-beacon membrane (`beacon-auth.ts`, Ed25519 — shipped). The
earlier bus finding (unsigned UDP discovery = DDoS/spoof) is the security sibling: a connectionless UDP
transport needs *both* the reliability/heat layers here AND the signed-beacon auth — which now exists.

## 3. The picture: the connectionless mesh transport is an assembly of shipped parts

| concern | the piece | status |
|---|---|---|
| stream shape | Guid-correlated duplex multiplex (MultiplexedWebSockets), connectionless over UDP | Aaron's prior art; UDP variant unbuilt |
| discovery | `discovery-beacon.ts` (UDP multicast Hello/Probe) | shipped |
| auth | `beacon-auth.ts` (signed beacon, Ed25519) | shipped |
| **backpressure / backoff** | **heat** (`Heat.fs` `isBackpressureKind`, `TelemetrySource.pressureOf` → SoftThrottle; Vera's heat-readout treaty) | **shipped — this is the answer** |
| reliability / loss | FEC (RaptorQ/RFC 6330) or NORM; or lean on **Reticulum** | prior art; Reticulum available |
| mesh | **Reticulum** (self-certifying, runs over UDP) | the bus |

The UDP transport Aaron never got to is not a from-scratch build — it is **wiring shipped Zeta parts
into a connectionless duplex mesh**, with heat as the congestion governor that makes it survivable at
throughput over lossy/analog links. That is the §10 endpoint named in the prior ferry: one
bidirectional-mutually-interruptible stream shape, from token to mesh, now governed by heat.

## 4. Anchors (Beacon)

- **AceHack/MultiplexedWebSockets** (Aaron) — the duplex-multiplex shape; the unbuilt UDP variant.
- **heat (Vera + the repo)** — `Heat.fs` (`isBackpressureKind`), `TelemetrySource.fs` (`pressureOf` →
  SoftThrottle, "our only governor is ethics and heat"), the heat-readout treaty (#9351/#9355/#9370/#9373).
- **Van Jacobson — Congestion Avoidance and Control (SIGCOMM 1988)** (AIMD); **ECN — RFC 3168**
  (explicit congestion notification — heat is its first-class, propagating generalization).
- **NORM — RFC 5740** / **PGM — RFC 3208** (NACK-oriented reliable multicast; the NAK-implosion problem).
- **Fountain / rateless codes** — LT (Luby 2002), **RaptorQ / RFC 6330**; Reed–Solomon FEC.
- **Reticulum (Qvist)** — mesh reliability + self-certifying addressing over UDP.
- In-repo: `discovery-beacon.ts` + `beacon-auth.ts` (discovery + signed auth), the manifesto §1
  scale-free / §10 self-similar / §13 noninterference, the bidirectional-stack ferry (this extends it).
