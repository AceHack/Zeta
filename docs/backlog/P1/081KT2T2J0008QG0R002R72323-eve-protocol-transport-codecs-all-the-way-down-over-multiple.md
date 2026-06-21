---
id: 081KT2T2J0008QG0R002R72323
priority: P1
status: open
title: "Eve Protocol transport — codecs all the way down over multiplexed WebSocket/TCP for zero-trust strangers (nothing shared but the wire); Aaron's channels/pipelines multiplexed-WS prior art (Fowler-reviewed) (Aaron 2026-06-02)"
tier: research
effort: XL
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [081KT2T2J0008QG0R000VG204F]
composes_with: [081KT2T2J0008QG0R000VG204F, 081KT2T2J0008QG0R000S7GHQ8, 081KRW63S0008QG0R0030F8ZXA, 081KSNY2Z0008QG0R002JKH50A, 081KSNY2Z0008QG0R0030V5ZVS, 081KSGS9H0008QG0R000Q18PGQ, 081KRFA460008QG0R0018SN61J, 081KR2E4K0008QG0R001SWEPNV]
tags: [eve-protocol, transport, websocket, tcp, multiplexed, channels, pipelines, aspnet, fowler, zero-trust, strangers, codec-of-codecs, codecs-all-the-way-down, on-wire-negotiation, key-exchange, authenticated-encryption, security-surface, recordbatch, message-passing, bcl-interface-boundary, research, aaron]
type: research
---

# Eve Protocol transport — codecs all the way down, for strangers over the wire

## Why (the design target, Aaron 2026-06-02)

Aaron: *"make sure whatever you do works for two people on tcp port who never met and don't share shit other than the web. like my multiplexted websockets on my github — i think it uses channels / pipelines in aspnet, mine was reviewed by Fowler on github, it's fast — but you have to make it work like that websocket or tcp and be eve protocol, that's the codec of all codecs, codecs all the way down."*

The serialization target is **the hardest surface, made primary**: two parties who **never met and share nothing but the web** (raw TCP / WebSocket). No shared schema, no pre-shared keys, no prior contact. **Everything is established on the wire.** This is the cross-trust / adversarial adapter from 081KT2T2J0008QG0R000VG204F — promoted from edge-case to the design target.

## Eve = the codec of all codecs — *codecs all the way down*

081KT2T2J0008QG0R000VG204F sharpened the port to `Codec<Codec<T>>` where `T` is HKT (inner value codec + outer security/deployment codec). Aaron generalizes: **Eve is `Codec<Codec<Codec<…>>>` — codecs all the way down.** A *recursive* codec tower, and because the two parties share nothing, **Eve NEGOTIATES the tower on the wire**:

- framing / multiplexing codec (which logical stream) →
- value codec (Arrow columnar / `NaturalBatch` is one inner rung; others negotiable) →
- compression codec (optional) →
- **key-exchange + authenticated-encryption codec** (mandatory for strangers — no pre-shared secret) →
- transport codec (WebSocket / TCP).

Each rung is a `Codec<inner>`; the stack is established by negotiation at connect time (capabilities handshake), then data flows. "Codecs all the way down" = the tower is recursive + self-describing enough that a stranger can decode it from the wire alone.

## Transport — multiplexed WebSocket/TCP (Aaron's channels/pipelines prior art)

Reference impl: **Aaron's GitHub multiplexed-WebSocket**, built on ASP.NET Core **`System.Threading.Channels`** + **`System.IO.Pipelines`**, **reviewed by David Fowler** (the author of Pipelines/Channels in .NET) — fast. Many logical streams multiplexed over one WS/TCP connection; backpressure + zero-copy via Pipelines; bounded channels for flow control.

`[honor-those-that-came-before / search-first]` Study Aaron's repo as the transport reference (Aaron's own work — he points us to it; distinct from concept-not-code proprietary constraints). Ground the Pipelines/Channels multiplexed-WS pattern against current ASP.NET docs + Fowler's public guidance before implementing.

## Security — strangers are the adversarial surface (gated)

Zero-trust strangers ⇒ **adversarial by default**:

- **on-wire key exchange** (no pre-shared secret) → authenticated encryption of the value/columnar rungs (compose 081KSNY2Z0008QG0R002JKH50A PQ-lattice; 081KSNY2Z0008QG0R0030V5ZVS agent private state).
- **encryption-floor gate**: do NOT deploy the cross-stranger encrypted transport until Zeta's encryption substrate is demonstrably in place (composes `classifier-bypass-research-do-not-deploy-without-zeta-safer-floor` at transport scope).
- **threat-model first** (Aminata `threat-model-critic` + Soraya `formal-verification-expert`): the stranger-over-wire surface is the highest-stakes serialization surface (downgrade attacks on the negotiation, MITM on key exchange, malformed-codec-tower DoS). Threat-model the negotiation handshake before committing the wire format.
- composes 081KR2E4K0008QG0R001SWEPNV (Green Lantern / RF mesh transport) + 081KSGS9H0008QG0R000Q18PGQ (cluster-fork-as-trust-boundary).

## How this composes with what's built

- **MessageBatch / `NaturalBatch` (Arrow columnar, on main)** = **one inner value-codec rung** (the same-host in-memory form). The Eve tower wraps it for cross-stranger transport — it is NOT the transport itself.
- **081KT2T2J0008QG0R000VG204F `Codec<Codec<T>>`-where-T-is-HKT** = the type; 081KT2T2J0008QG0R002R72323 = the recursive generalization (`codecs all the way down`) + the concrete transport (multiplexed WS/TCP) + the on-wire negotiation for strangers.
- **081KRFA460008QG0R0018SN61J real HKT** to express the recursive codec tower cleanly; simulate via the `IColumnar`/`IMessage` dictionary + SRTP until the fork lands.

## Acceptance (research → build, incremental; gated)

1. **transport prototype:** multiplexed WS/TCP over `System.Threading.Channels` + `System.IO.Pipelines` (study Aaron's repo); carry a plaintext `NaturalBatch`/`RecordBatch` rung between two same-trust processes first.
2. **codec-tower negotiation:** the connect-time capabilities handshake that establishes the recursive codec stack from the wire alone (self-describing tower).
3. **secure-stranger rung (GATED):** on-wire key exchange + authenticated encryption; threat-model (Aminata + Soraya) BEFORE; do NOT deploy pre-encryption-floor.
4. **referee:** the transport against ASP.NET Pipelines/Channels current docs + Aaron's Fowler-reviewed impl; the security against the threat model.

## Composes with substrate

- **081KT2T2J0008QG0R000VG204F** (codec<codec<T>> serialization port; columnar message infra) · **081KT2T2J0008QG0R000S7GHQ8** (Infer.NET rewrite; the message state being transported) · **081KRW63S0008QG0R0030F8ZXA** (Eve Protocol — polymorphic diplomatic language; the negotiation) · **081KSNY2Z0008QG0R002JKH50A / 081KSNY2Z0008QG0R0030V5ZVS** (PQ-lattice encryption / agent private state) · **081KSGS9H0008QG0R000Q18PGQ** (cluster-fork-as-trust-boundary) · **081KRFA460008QG0R0018SN61J** (real HKT) · **081KR2E4K0008QG0R001SWEPNV** (Green Lantern RF/mesh transport)
- existing F#: `ArrowSerializer.fs` (Arrow IPC bytes — one rung's wire form), `MessageBatch.fs` (the inner value codec); .NET `System.Threading.Channels` + `System.IO.Pipelines` (the transport)
- rules: `bcl-interface-boundary-own-your-interfaces-hexagonal` (own the codec-tower interface; WS/TCP adapt in), `honor-those-that-came-before` (Aaron's repo + Fowler), `search-first-authority` (ground the Pipelines/Channels pattern), `classifier-bypass-research-do-not-deploy-without-zeta-safer-floor` (encryption-floor gate at transport scope), `grep-substrate-anchors-before-razor` + `god-tier-claims-don't-collapse`

## Substrate-honest framing

`[labeling-confidence: established (multiplexed-WS-over-Pipelines/Channels is a known fast pattern, Fowler-reviewed; Arrow is a real wire codec); hypothesized (the exact recursive codec-tower negotiation wire format — threat-model + prototype before committing); XL multi-year per zeta-ships-with-skills]`. The stranger-over-wire surface is the highest-stakes serialization surface — **gated** behind threat-model + encryption-floor. The current Arrow columnar store is correct for same-host in-memory; this row is the cross-stranger transport that wraps it. Aaron's multiplexed-WS repo is his own prior art (reference + study, not concept-not-code-locked).
