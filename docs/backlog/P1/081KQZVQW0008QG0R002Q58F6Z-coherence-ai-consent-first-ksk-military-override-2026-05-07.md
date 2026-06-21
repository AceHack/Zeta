---
id: 081KQZVQW0008QG0R002Q58F6Z
priority: P1
status: open
title: "Coherence AI with consent-first design — KSK override for military/emergency use"
created: 2026-05-07
last_updated: 2026-05-07
depends_on: [081KQZVQW0008QG0R002QZAFB2, 081KQZVQW0008QG0R001PS4F8G]
decomposition: decomposed
children: [081KR2E4K0008QG0R003CPCM4V, 081KR2E4K0008QG0R00009QQJM]
owners: [architect, security-researcher, threat-model-critic]
type: feature
---

# 081KQZVQW0008QG0R002Q58F6Z — Coherence AI: consent-first default, KSK military override

## What

English language coherence AI on local GPUs with consent-first
as the default operating mode. The KSK provides N-of-M override
to disable consent-first for authorized military/emergency use.

Aaron 2026-05-07: "coherence consent first design ... military
can use ksk to disable the consent first"

This is not the concordance backlog item. Concordance is one
application. The load-bearing primitive here is coherence:
do claims, references, policies, model outputs, receipts, and
human intent still hang together when they move across agents,
models, organizations, and time?

## The shape

```
Default mode: coherence AI + consent-first
    ↓
All data processing requires consent gate
    ↓
KSK override: N-of-M approval disables consent-first
    ↓
Military / emergency authorized use only
    ↓
Receipts logged regardless (glass halo)
    ↓
Override is transparent, auditable, retractable
```

## Data homecoming, not data rapture

Aaron 2026-05-07 distinguished two migration paths:

- **Data homecoming**: the slow, non-apocalyptic path. People
  keep their data under local policy, and corporations,
  researchers, lawyers, or governments interact with it through
  each person's own AI guardian. Access is cooperative,
  consent-first, scoped, logged, and revocable.
- **Data rapture**: the violent path. Personal data is collected
  or exported en masse, then GDPR/data-rights machinery is used
  for a mass exodus all at once. This may be legally coherent,
  but it is socially brittle and operationally dangerous.

Preferred direction: homecoming. The architecture should make
cooperative access easier than extraction.

## Guardian/grain actor pattern

The likely runtime shape is actor-native:

- **Guardian**: the per-person or per-organization AI policy
  agent that mediates consent, scope, receipts, and disclosure.
- **Grain**: the durable actor identity for a person, dataset,
  consent grant, policy, coherence query, or receipt.
- **Silo**: the local host or trusted cluster that runs many
  grains while preserving locality and policy boundaries.
- **Message**: a request to inspect, compare, summarize, or act
  on data. Messages cross boundaries; raw data does not by
  default.

This mirrors the Microsoft Orleans virtual actor model: grains
are identity-bearing actors with behavior and state; silos host
grains; clusters of silos coordinate for scale and fault
tolerance. In Zeta terms, each guardian is an edge gate wrapped
around actor-local state. Consent lives at the grain boundary,
not in a central database permission table.

Coherence AI then becomes a distributed query over guarded
actors. The system asks: can these claims be reconciled without
breaking consent, provenance, or policy? If yes, return a
receipt. If no, return the smallest coherent blocker.

## Consent-first as default

- Coherence analysis requires consent from data subjects
- Local GPU processing (data never leaves the machine)
- Results gated by Itron edge gate before external use
- Receipts stay local unless disclosed
- Same Ace distribution architecture
- Corporate access goes through guardians instead of direct
  extraction
- Cross-organization cooperation is message passing, not data
  pooling

## KSK military override

- N-of-M multi-sig to activate override
- Disables consent-first for authorized scope only
- Time-bounded (override expires, must be re-authorized)
- Full audit trail (every action under override is receipted)
- Glass halo: the override itself is transparent
- Retractable: override can be revoked mid-operation
- Override targets actor sets, scopes, and time windows; it does
  not become a permanent global permission

## Why this matters

Consent-first is the ethical default. But military/emergency
use cases (intelligence analysis, crisis response, battlefield
communication analysis) legitimately need to operate without
subject consent. The architecture handles both by making
consent-first the default and the override the exception —
gated, receipted, and transparent.

The KSK was designed for this: NVIDIA Thor actuators needed
safety gates. Consent-first needs the same gate — the
override is the kinetic specialization applied to data rights
instead of physical motion.

## Night-of convergence links

This backlog item ties together the 2026-05-07 convergence:

- **BFT / immune system**: three independent agents establish
  consensus-grade evidence before the system learns from a catch.
- **Kozyrev Mirror riff**: after the three-node threshold, depth
  comes from repeated ticks through the same reflective surface,
  not unbounded node count.
- **Shadow log / safety harness**: persistent model failure
  patterns are the observable safety surface for model weights.
- **Hawkins / Thousand Brains**: independent world models reach
  consensus without a central authority.
- **Sakana NCA clustering**: permissive mixing, crystallization,
  and relaxation are environment-tuned phases for coherent
  ecosystems.
- **Superorganism pattern**: local actors can speak and move as
  one without a central brain when the coordination rules are
  right.
- **DBSP replay algebra**: consent grants, overrides, receipts,
  and retractions must be replayable as +1/-1 history.
- **ARC-AGI-3 / game substrate**: coherence must survive level
  changes, exploration, corrections, and accumulated lessons.
- **Data homecoming**: local guardians turn personal data rights
  into cooperative access instead of extraction.

## Acceptance criteria

- [ ] Consent-first gate integrated with coherence engine
- [ ] KSK N-of-M override mechanism for consent bypass
- [ ] Override time-bounded with automatic expiry
- [ ] Full receipt/audit trail for override operations
- [ ] Glass halo: override events are transparent
- [ ] Guardian/grain actor model sketched with consent at the
      grain boundary
- [ ] Data homecoming path documented separately from mass export
      / data rapture
- [ ] Coherence query protocol returns receipts or coherent
      blockers without default raw-data extraction

## Composes with

- 081KQZVQW0008QG0R002QZAFB2 (structure recognizer) — the coherence engine
- 081KQZVQW0008QG0R001PS4F8G (concordance/coherence AI on GPUs) — the runtime
- 081KQZVQW0008QG0R001V420F0 (red team hole puncher) — test the override
- `docs/STRUCTURE-CATALOG.md` — KSK primitive
- `docs/research/2026-05-07-kozyrev-mirror-bft-immune-system-three-node-threshold-riff.md` — three-node threshold and immune-system mirror
- `docs/research/2026-05-07-convergence-hawkins-sakana-worm-towers-bft-superorganism-no-central-authority.md` — world-model clustering and superorganism convergence
- Per-user MEMORY.md "Ace package manager" — distribution
- Per-user MEMORY.md "Itron is the edge gate" — consent gate
