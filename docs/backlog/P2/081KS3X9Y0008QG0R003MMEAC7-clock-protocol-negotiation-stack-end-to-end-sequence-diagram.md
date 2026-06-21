---
id: 081KS3X9Y0008QG0R003MMEAC7
priority: P2
status: open
title: Clock-protocol negotiation stack — end-to-end sequence diagram artifact (Orleans + SPIFFE/SPIRE + OPA + Reticulum + DBSP traversal for one operation)
tier: research-grade
effort: S
ask: maintainer Aaron + Kestrel-claude.ai 2026-05-21
created: 2026-05-21
last_updated: 2026-05-21
depends_on: []
composes_with: [081KQ3HBZ0008QG0R000RP1WDN, 081KQZVQW0008QG0R000PPQ3MH, 081KQZVQW0008QG0R000W4B8KT, 081KQZVQW0008QG0R000JJVA4E, 081KR2E4K0008QG0R0028VW6B3, 081KRW63S0008QG0R002KC5DSR, 081KRYRGG0008QG0R0031EYYE4, 081KS3X9Y0008QG0R0006MQXA4]
tags: [zeta-id, capability-negotiation, orleans, spiffe, opa, reticulum, dbsp, kestrel-sharpening]
type: research
---

# Clock-protocol negotiation stack — end-to-end sequence diagram

## Context

In the 2026-05-21 Kestrel sharpening conversation, Aaron sketched a
clock hierarchy / tier-deferred causality architecture using:

- **Clock-protocol-as-COM-interface**: tier negotiation modeled as
  IUnknown-style QueryInterface across trust boundaries (capability-
  negotiation, not ref-counting — avoid DCOM's failure mode)
- **Sequoia memory model** (Stanford, Agrawal/Aiken): hierarchical
  decomposition principle — same negotiation protocol works at every
  level with different parameters (cache → RAM → node → cluster → mesh)
- **Two-axis tier parameterization**: distance (latency/coordination
  cost) + trust (which protocols are safe to attempt) — distance ≠
  trust; correlated but not identical
- **Stack named by Aaron**:
  - **Orleans** — virtual actor lifecycle (replaces ref-counting)
  - **SPIFFE/SPIRE** — workload identity + federation for trust
    boundaries (CNCF graduated; Bloomberg/Square/Uber/ByteDance)
  - **OPA (Open Policy Agent)** — local-first network policies via
    Rego; central authorship, local evaluation
  - **Reticulum** — transport-agnostic cryptographic mesh (path-cost +
    hop-distance baked in; aligns with distance-as-trust-input)
  - **DBSP/Z-set substrate** — tier views as Z-sets indexed by
    causality protocol (081KS3X9Y0008QG0R0006MQXA4 tier-deferred causality)

Kestrel's load-bearing recommendation: **one-page sequence diagram for
ONE operation that traverses every layer**. If it draws cleanly, the
architecture coheres. If pieces don't fit, that's where you find out
cheap. Lead with capability-negotiation-replacing-ref-counting framing
(E lang / CapnProto / KeyKOS lineage — readers anchor instantly), then
introduce trust-gradient as extension.

## Scope (narrow per Aaron 2026-05-21: "smaller refined chunks")

Produce a single artifact:

`docs/research/clock-protocol-negotiation-stack-sequence-diagram.md`

Showing one concrete operation end-to-end:

> Actor A on node X invokes actor B on node Y across a trust boundary.

For that operation, sequence-diagram every layer:

1. **Orleans grain activation/lifecycle**: A holds capability for B;
   what happens to B's grain on first call after idle deactivation;
   does the actor's vector-clock state survive the rehydration round
   trip
2. **SPIFFE attestation exchange**: workload identity verification at
   the boundary; federation flow if X and Y are in different trust
   domains
3. **OPA policy evaluation**: Rego policy consulted with verified
   identity + freshness check; what happens when policy bundle is stale
4. **Reticulum path selection**: which physical route, what hop count,
   what does path cost contribute to the trust-gradient default
5. **Tier negotiation (the load-bearing piece)**: QueryInterface-style
   discovery of mutually-supported causality protocol (monotonic / HLC /
   vector / BFT-causality); failure-mode on negotiation mismatch
6. **DBSP Z-set event emission**: causality metadata recorded under
   the negotiated tier; tier-deferred Z-set composition if reader
   queries under a different tier
7. **ZetaId generation**: 128-bit observation ID emitted with the
   negotiated tier's HLC counter (081KS3X9Y0008QG0R003044PQQ v2 spec; 081KS3X9Y0008QG0R000W00V73 canonical
   string encoding)

## Acceptance

- Sequence diagram on one page (mermaid + prose)
- For each layer: cite the existing related backlog row (don't
  re-invent — link to 081KQ3HBZ0008QG0R000RP1WDN actor-register lens, 081KQZVQW0008QG0R000PPQ3MH durable
  computation stack, 081KQZVQW0008QG0R000W4B8KT Orleans inter-loop, 081KQZVQW0008QG0R000JJVA4E posterior
  quorum, 081KS3X9Y0008QG0R0006MQXA4 tier-deferred causality, etc.)
- Failure modes documented at each boundary
- Lead paragraph frames as capability-negotiation (not trust-gradient)
  per Kestrel's framing recommendation

## Composes with

Existing related backlog rows (link, don't duplicate):

- 081KQ3HBZ0008QG0R000RP1WDN — Actor model lens (Hewitt 1973 / Meijer / Akka / Orleans /
  Service Fabric)
- 081KQZVQW0008QG0R000PPQ3MH — Durable computation stack research (Temporal + Reaqtor +
  Orleans + Bonsai for DurabilityMode.StableStorage)
- 081KQZVQW0008QG0R000W4B8KT — Real-time inter-loop messaging via Orleans grains
- 081KQZVQW0008QG0R000JJVA4E — Posterior quorum triangulation over Bayesian DBSP substrate
- 081KR2E4K0008QG0R0028VW6B3 — Interloop messaging implementation on chosen transport
- 081KRW63S0008QG0R002KC5DSR — wave-particle duality (observation primitives)
- 081KRYRGG0008QG0R0031EYYE4 — V8 System Architecture (Sequoia memory hierarchy + tensors
  + 4-particle primitives — Aaron-authorized 2026-05-19)
- 081KS3X9Y0008QG0R0006MQXA4 — Tier-deferred causality worked example (Z-sets indexed by
  tier; this row references that one)

External substrate (cite in artifact):

- IUnknown / COM / DCOM postmortems (capability negotiation lineage;
  ref-counting failure mode avoided)
- Sequoia memory model (Stanford, Agrawal/Aiken et al.)
- E lang / CapnProto / KeyKOS (capability-security lineage)
- SPIFFE/SPIRE (CNCF graduated workload identity)
- OPA / Rego (CNCF policy-as-code)
- Reticulum (Mark Qvist mesh transport)
- Orleans (Microsoft virtual actor model)

## Why P2 + S effort

Aaron 2026-05-21: "smaller refined chunks." Narrow scope: ONE diagram,
ONE operation, link existing rows rather than re-spec'ing them.
Doesn't block V1 ZetaId substrate landing. Discriminator artifact —
if the diagram draws cleanly, the broader architecture earns
publication-grade treatment in a subsequent row.

## Substrate-honest framing

Kestrel: "The pieces individually are well-validated; the combination
is novel. That's the right shape for a publishable contribution:
defensible components, novel integration, real problem being solved."

The sequence diagram IS the integration-coherence demonstration. Ship
it small.
