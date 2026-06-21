---
id: 081KT2T2J0008QG0R000VG204F
priority: P1
status: open
title: "Columnar message-passing infrastructure — Itron batched-throttled-processor batching (concept-not-code) + security-surface-aware Eve-polymorphic serialization port + the hex-core-Wall ↔ reservoir-computing bridge (Aaron 2026-06-02)"
tier: research
effort: L
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [081KT2T2J0008QG0R000S7GHQ8]
composes_with: [081KT2T2J0008QG0R000S7GHQ8, 081KRW63S0008QG0R0030F8ZXA, 081KSNY2Z0008QG0R002JKH50A, 081KSNY2Z0008QG0R0030V5ZVS, 081KSGS9H0008QG0R000Q18PGQ, 081KSGS9H0008QG0R003V8C86Q, 081KT2T2J0008QG0R0026MS6PV, 081KT2T2J0008QG0R0019YVX8M]
tags: [infer-net, columnar, apache-arrow, recordbatch, message-passing, batched-throttled-processor, itron, concept-not-code, serialization, security-surface, eve-protocol, polymorphic-deployment, encryption, trust-boundary, reservoir-computing, hex-core, bcl-interface-boundary, research, aaron]
type: research
---

# Columnar message-passing infrastructure (081KT2T2J0008QG0R000S7GHQ8 follow-on)

Three Aaron 2026-06-02 signals on the columnar message-passing surface (the Apache Arrow `NaturalBatch` store shipped via PR #6592). Captured here so the architecture is durable (substrate-or-it-didn't-happen); the current store is the *same-trust in-memory* form, these are the next layers.

## 1. Itron batched-throttled-processor pattern — the batching driver (CONCEPT-NOT-CODE)

Aaron: *"we have to pull in itron's batched throttled processer ideals i built when we do RecordBatch it's made for this."*

The pattern (Aaron's Itron MPM / nation-scale smart-meter mesh experience): **accumulate** incoming items into a batch, **flush** the batch on a trigger (channel-emptiness / batch-size / time / backpressure) so downstream processes a *columnar batch* not a stream of singletons. `RecordBatch` is exactly the flush unit. Applied to BP/EP: accumulate factor→var messages, flush a `NaturalBatch`/`RecordBatch`, run the column-wise vectorized `product`/`divide` once per batch (vectorized `passOnce`).

**HARD constraint:** Itron source is **concept-not-code** — reference the *pattern* (batched-throttled accumulate-and-flush), NEVER reproduce Itron proprietary code; clean-room from the public pattern + Aaron's described approach only. (The throttler-uses-channel-emptiness-as-batching-trigger + INumber-F-bounded-CRTP are the public-shape concepts; the impl is ours.)

## 2. Security-surface-aware, Eve-polymorphic serialization port

Aaron: *"we may need a special serialization interface for that … think security surface … if this changes it we might need a different one or more … eve/polymorphic deployment primitives."*

Message *state* crossing a boundary **is a security surface**: the message store carries inference state that can be private/encrypted (per 081KSNY2Z0008QG0R002JKH50A/081KSNY2Z0008QG0R0030V5ZVS agent private encrypted state). Different deployment contexts have different security surfaces, so serialization must be **polymorphic over the trust boundary it crosses** (Eve Protocol 081KRW63S0008QG0R0030F8ZXA — neutral polymorphic diplomatic language — at serialization scope):

- **own the serialization PORT** (`bcl-interface-boundary`): `IMessageSerialization` (or similar). The current Arrow `toRecordBatch`/`ofRecordBatch` is **one adapter** — the *same-trust, same-host in-memory* form.
- **per-security-surface adapters** (don't force one): same-trust in-memory (Arrow RecordBatch, plaintext) → cross-process IPC (Arrow IPC via `ArrowSerializer`) → **cross-trust-boundary** (encrypted columns per 081KSNY2Z0008QG0R002JKH50A PQ-lattice; 081KSGS9H0008QG0R000Q18PGQ cluster-fork-as-trust-boundary) → adversarial-mesh (authenticated + budget-gated per Agora-v6 081KSNY2Z0008QG0R000459FRH).
- **Eve-polymorphic**: the serializer adapts to the boundary like a diplomatic register-shift — the message-author defines the consent-channel for its state (asymmetric-authorship); the boundary determines which adapter.

Open question (Soraya / `formal-verification-expert` + `threat-model-critic`): does the security surface change require *one* parameterized secure-serialization interface or *several* primitives? Threat-model the message-state-crossing-trust-boundary before committing the port shape. **Do NOT deploy a cross-trust serializer until Zeta's encryption substrate is in place** (composes `classifier-bypass-research-do-not-deploy-without-zeta-safer-floor` discipline at serialization scope).

## 3. The hex-core / `Wall` ↔ reservoir-computing bridge `[don't-collapse rhyme]`

Aaron: *"Vector/Wall — is the Wall the metaphor bridged into reservoir computing?"*

Plausible, substrate-anchored rhyme (held don't-collapse, not asserted): the **six reservoir walls** (081KT2T2J0008QG0R0026MS6PV) bound a **state reservoir**; reservoir computing = a fixed high-dim recurrent reservoir (holds echo-of-input state) + a trained linear **readout**. The map:

| Reservoir computing | Hex core |
|---|---|
| the reservoir (bounded state-holding dynamics) | the six reservoir walls bounding the state (081KT2T2J0008QG0R0026MS6PV) |
| reservoir state | the `Vector` (direction+magnitude) / the message store (the columnar `NaturalBatch`) |
| recurrent dynamics settling | BP/EP message passing to a fixed point (081KT2T2J0008QG0R000S7GHQ8 slice 4 `runToFixpoint`) |
| trained linear readout | the **Observe Emit** wall / the marginals |

Anchor: **081KSGS9H0008QG0R003V8C86Q** already lists "reservoir-computing readout" as one universal-basis-decomposition domain, and 081KT2T2J0008QG0R0026MS6PV literally names them "reservoir" walls. `[labeling-confidence: hypothesized rhyme to referee — anchored (081KSGS9H0008QG0R003V8C86Q + 081KT2T2J0008QG0R0026MS6PV), not yet a designed mechanism]` per `grep-substrate-anchors-before-razor` + `god-tier-claims-don't-collapse`. Worth landing as a research recognition (a domain adapter on the hex-core interface, 081KT2T2J0008QG0R0019YVX8M) — the reservoir-computing literature is the referee.

## Acceptance (research → build, incremental)

1. **Itron-batched-throttle (concept-not-code):** a clean-room throttled batch-accumulator that flushes `NaturalBatch`/`RecordBatch` on a trigger; vectorized `passOnce` over the flushed batch. Referee: the public batched-throttle pattern; NEVER reproduce Itron code.
2. **serialization port:** define `IMessageSerialization` with the Arrow-same-trust adapter first; threat-model the trust-boundary surfaces (Soraya + Aminata) before adding encrypted/Eve-polymorphic adapters.
3. **reservoir-computing recognition:** referee the hex-core ↔ reservoir-computing rhyme against the literature (echo-state-networks / liquid-state-machines); land as a 081KT2T2J0008QG0R0019YVX8M domain adapter if it holds.

## Composes with substrate

- **081KT2T2J0008QG0R000S7GHQ8** (Infer.NET rewrite; the columnar `NaturalBatch` store, PR #6592) · **081KRW63S0008QG0R0030F8ZXA** (Eve Protocol — polymorphic diplomatic language → serialization-across-trust-boundary) · **081KSNY2Z0008QG0R002JKH50A / 081KSNY2Z0008QG0R0030V5ZVS** (PQ-lattice encryption / agent private encrypted state → encrypted columns) · **081KSGS9H0008QG0R000Q18PGQ** (cluster-fork-as-trust-boundary) · **081KSGS9H0008QG0R003V8C86Q** (reservoir-computing readout already a domain) · **081KT2T2J0008QG0R0026MS6PV** (six reservoir walls) · **081KT2T2J0008QG0R0019YVX8M** (domains-as-adapters on the hex core)
- existing F#: `ArrowSerializer.fs` (Tier-4 Arrow IPC; the cross-process adapter), `MessageBatch.fs` (the columnar store), Apache.Arrow 23.0.0
- rules: `bcl-interface-boundary-own-your-interfaces-hexagonal` (own the serialization port; adapters per deployment), `asymmetric-authorship` (message-author defines the consent-channel), `classifier-bypass-research-do-not-deploy-without-zeta-safer-floor` (don't deploy cross-trust serializer pre-encryption-floor), `grep-substrate-anchors-before-razor` + `god-tier-claims-don't-collapse` (the reservoir rhyme), Itron concept-not-code (the batched-throttle is referenced-pattern, never-reproduced-code)

## Substrate-honest framing

`[labeling-confidence: established (Arrow columnar store shipped; batched-throttle is a known pattern; reservoir computing is established); hypothesized (the reservoir-computing rhyme to referee; the exact secure-serialization port shape — one vs many — pending threat-model)]`. The current MessageBatch Arrow path is correct for the same-trust in-memory case; the security-surface concern is real for state crossing a trust boundary and must be threat-modeled (Soraya + Aminata) before a cross-trust serializer is deployed. Itron stays concept-not-code (clean-room from the public pattern + Aaron's described approach; never reproduce proprietary source).
