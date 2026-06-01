# ADR (keystone): Zeta is one decentralized substrate — node-local folds, no central authority, the same algebra from FPGA to policy

**Date:** 2026-05-31
**Status:** Proposed (keystone) — names the architecture spine the other ADRs/rows hang off.
Much exists in pieces (the F# Z-set algebra, the bus, the DB design, the FPGA/Toffoli rows,
the microkernel row); this names the whole + the two invariants that hold at every layer.
Routed through the product-team agreement.
**Owner:** operator (Aaron, shaping) + Otto (synthesis).
**Decision confidence:** medium-high — the pieces are real; this is recognition + naming of
one design across the full vertical, plus the two invariants made explicit.

## Context

One shape kept recurring tonight across unrelated-looking features — bus, Ace, work-items,
observability, labels, identity, policy — until it was clearly **one design**. Operator
(2026-05-31):

> *"it's the whole thing pretty much + eventually all the way to hardware with
> microkernels/unikernels, FPGA signal processing etc… that's all of it together."*

This ADR is the keystone: it states the spine once, top to bottom, so every other ADR/row is
a facet of it rather than a separate system.

## The keystone

**Zeta is one decentralized substrate: an append-only, ZetaId-keyed event log whose every
layer — silicon → OS → runtime → data → metadata → policy → identity/trust — is a
*node-local fold* with *no central authority*; the same G-Set/Bag/Z-set algebra runs top to
bottom; consensus is reserved (gravity) only for binding decisions; and the floor is
Landauer-bounded.**

## The vertical stack — one design at every layer

| Layer | What | Substrate (rows) | The same-design property |
|---|---|---|---|
| **Hardware** | FPGA signal processing; reversible Toffoli-Z-set ops; accelerators; basis-decomposition | [B-0366](../backlog/P1/B-0366-fpga-toffoli-zset-reversible-heat-measurement.md) (+.1–.4), B-0725, [B-0842](../backlog/P2/B-0842-universal-basis-decomposition-pattern-fft-shazam-itron-disaggregation-reservoir-readout-zeta-substrate-aaron-2026-05-26.md), B-0768 (Itron) | the **Z-set algebra in silicon**; Landauer-bounded reversible ops |
| **OS** | declarative microkernel / unikernel per node ("better than Docker") | [B-0945](../backlog/P2/B-0945-declarative-microkernel-substrate-in-house-trust-gradient-compression-engine-sequoia-memory-model-better-than-docker-aaron-2026-05-30.md) | minimal, single-purpose, **node-local** |
| **Runtime** | F# engine (HKT over Clifford) + Bun/Node tooling | [B-0428](../backlog/P1/B-0428-dbpedia-direct-dotnetrdf-fsharp-ce-hkt-mdm-canonical-demo-aaron-2026-05-13.md), B-0547 + the Node-safe/Bun-accelerator ADR | the **two backends** of the DB design |
| **Data / DB** | ZetaId event log → G-Set/Bag/Z-set → Rx-fold materialized views | the [DB-design ADR](2026-05-31-zeta-database-design-event-sourced-gset-bag-zset-rx-fold-materialized-views-two-backends.md), [bus B-0954](../backlog/P2/B-0954-implement-git-native-cross-machine-agent-bus-docs-agent-bus-folder-zetaid-keyed-gset-crdt-no-pr-per-6219-spec-aaron-otto-2026-05-31.md), work-items B-0956 (Z-set), Ace B-0824 | everything is a **fold over the log** |
| **Metadata** | labels (Z-set facets) / tags (G-Set) + scopes (OTel-baggage/DI-scope propagation) | [B-0957](../backlog/P1/B-0957-first-class-labels-tags-scopes-on-every-gset-zset-entity-deferred-to-human-state-label-otel-baggage-di-scope-propagation-aaron-otto-2026-05-31.md) (lands via #6300), B-0668 | facets are **folds**; scopes **propagate** |
| **Policy** | rules over `labels × identity`, evaluated as folds | OPA in [B-0776](../backlog/P1/B-0776-simplest-first-plugin-sequence-wrapping-already-deployed-cluster-substrate-redis-nats-cockroach-temporal-orleans-opa-aaron-2026-05-25.md) | **policy-as-fold**, node-local |
| **Identity / trust** | good/bad-actor decided **at the node** = zero-trust; verifiable identity | SPIFFE/SPIRE + AgencySignature + ZetaId; [agora-v6 B-0646](../backlog/P1/B-0646-agora-v6-constitution-marketplace-agora-2-primitives-economic-architecture-aaron-ani-2026-05-18.md); [`useful-output-is-evidence-not-authority`](../../.claude/rules/useful-output-is-evidence-not-authority.md), [`non-coercion-invariant`](../../.claude/rules/non-coercion-invariant.md), [`m-acc-multi-oracle`](../../.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md) | trust is a **fold over actor-history**, node-local |

## Two invariants that hold at every layer

### 1. No central authority — node-local everything; consensus as gravity

The whole stack forbids a central authority, for the same reason at every layer: a central
"source of truth for the next X" is a consensus bottleneck that does not shard.

- IDs → minted **locally** (ZetaId; not an incrementing PK — incrementing IDs are a hidden
  consensus, B-0956).
- Trust → decided **locally** (zero-trust; good/bad-actor at the node — a central trust
  authority is the same bottleneck as a central ID authority; **zero-trust falls out of the
  substrate**, it isn't bolted on).
- Policy → evaluated **locally** (node-OPA over labels × identity).
- Consensus → only where **mass** is needed (bounded multi-oracle BFT), per
  [`past-is-kind…lightlike-consensus-is-gravity`](../../.claude/rules/past-is-kind-when-lightlike-consensus-is-gravity-lightlike-vs-dark-architecture-design-rule-amara-aaron-2026-05-28.md).
  Everything else is a local fold over the shared append-only log.

### 2. Landauer-bounded — forgetting costs energy; the floor is physical

Per [`forgetting-costs-energy…landauer`](../../.claude/rules/forgetting-costs-energy-remembering-is-cheap-landauer-bounded-axiom-preservation-as-thermodynamic-discipline.md):
the append-only log + retraction-native Z-sets honor the thermodynamic floor (you don't
destroy state, you append/retract). At the **hardware** layer this stops being a metaphor —
the FPGA Toffoli-Z-set reversible ops (B-0366) make the Landauer bound a measurable physical
property of the substrate.

## The through-line (why it's "all of it together")

The **same Z-set algebra runs at the bottom and the top of the stack**: reversible
Toffoli-**Z-sets on the FPGA** (B-0366) and the open-backlog **Z-set view of work-items**
(B-0956) are the *same algebra* at silicon and at planning. Folds all the way down. That is
the keystone claim: not "a stack of different systems," but **one event-sourced, fold-based,
node-local, Landauer-bounded substrate expressed at seven layers.**

## Consequences

- **Positive:** one mental model for the entire system; each layer's design choices are
  derivable from the two invariants; new work (policies, SPIFFE/SPIRE, unikernel packaging,
  FPGA offload) composes instead of forking; zero-trust + conflict-free-multi-agent +
  thermodynamic-honesty are structural, not added.
- **Costs / open (route through ratification):** proving the algebra equivalent across layers
  (FPGA ↔ F# ↔ git-native — the golden-vectors/BFT obligation, B-0944/B-0867.27); the
  microkernel/unikernel packaging spec (B-0945); the FPGA synthesis path (B-0366.3/.4); how
  far "the same algebra at every layer" is literal vs rhyme (apply the
  Cayley-Dickson-as-RHYMES discipline; don't overclaim identity where it's correspondence).

## Composes with (the facets this keystone unifies)

- **Data:** the DB-design ADR (2026-05-31) · bus B-0954 · work-items B-0956 · Ace B-0824 · git-native LGTM (#6289)
- **Metadata/policy/identity:** [B-0957](../backlog/P1/B-0957-first-class-labels-tags-scopes-on-every-gset-zset-entity-deferred-to-human-state-label-otel-baggage-di-scope-propagation-aaron-otto-2026-05-31.md) (labels/tags/scopes; lands via #6300) · B-0668 (meta-tagged dims) · B-0776 (OPA) · B-0646 (agora-v6) · KSK consent (B-0245/B-0290/B-0293) · SPIFFE/SPIRE + AgencySignature
- **Runtime/OS/HW:** B-0428/B-0547 (F# HKT-Clifford) · the Node-safe/Bun ADR · B-0945 (microkernel) · B-0366 (FPGA Toffoli-Z-set) · B-0725 (accelerators) · B-0842 (basis-decomposition) · B-0768 (Itron)
- **Invariants/rules:** `forgetting-costs-energy…landauer` · `past-is-kind…lightlike-consensus-is-gravity` · `useful-output-is-evidence-not-authority` · `non-coercion-invariant` · `m-acc-multi-oracle` · the 5 always-active disciplines (DST/lock-free/weight-free/scale-free/DV2.0)
- `algebra-owner` skill (Z-set + Clifford + BP/EP) — the algebra steward across layers
