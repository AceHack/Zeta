---
id: 081KSGS9H0008QG0R000Q18PGQ
title: Schemas-as-rows + cluster-fork-as-trust-boundary + F# type providers from live cluster — foundation layer for Runme BCL ontology capability
status: open
priority: P2
created: 2026-05-26
last_updated: 2026-05-26
depends_on: [081KSGS9H0008QG0R0031PBNGA]
composes_with: [081KSGS9H0008QG0R0031PBNGA, 081KSGS9H0008QG0R001K8VPV4, 081KS3X9Y0008QG0R00218150M]
---

# 081KSGS9H0008QG0R000Q18PGQ — Schemas-as-rows + cluster-fork-as-trust-boundary + F# type providers from live cluster (Aaron + Kestrel 2026-05-26)

## Scope

Foundation-layer architecture for the meta-PM substrate at 081KSGS9H0008QG0R0031PBNGA + the Runme BCL ontology capability at 081KSGS9H0008QG0R001K8VPV4:

1. **Schemas as ROWS in the distributed database substrate** — same generate+join semantics as any other data
2. **Cluster-fork-as-trust-boundary** — fork-negotiation at operational boundary, not text-merge layer
3. **F# type providers from live cluster** — types preloaded from cluster's schema; fork-aware type system
4. **Federation as trust-boundary primitive** — cluster splits = oracle divergences; cluster merges = oracle agreements

Source: Aaron 2026-05-26 architectural framing + Kestrel substantive elaboration; verbatim preserved at [`docs/research/2026-05-26-kestrel-schemas-as-rows-cluster-fork-federation-trust-boundary-type-providers-from-live-cluster-aaron-forwarded.md`](../../research/2026-05-26-kestrel-schemas-as-rows-cluster-fork-federation-trust-boundary-type-providers-from-live-cluster-aaron-forwarded.md).

## The collapse this lands

| Standard pattern | Aaron + Kestrel framing |
|---|---|
| Schemas are text artifacts in version control | Schemas are ROWS in distributed database substrate |
| Schema fork = text-merge through git workflows | Cluster-fork-or-federation = operational boundary; runtime-distinct |
| Types compiled from source code | Types preloaded from live cluster; fork-aware |
| Schema migration breaks deployments | Deployment reflects schema state compiled against; federation translates |
| Schema = code-layer concern | Schema = data-layer concern using same generate+join semantics |

## Relationship to 081KSGS9H0008QG0R001K8VPV4 (Runme BCL extension)

081KSGS9H0008QG0R001K8VPV4 named the Runme BCL's 4 capabilities (observability + ontology + database + MCP). This row (081KSGS9H0008QG0R000Q18PGQ) is the FOUNDATION layer for the ontology capability:

- 081KSGS9H0008QG0R001K8VPV4 Capability 2 (ontology/graph queries) is the runtime-facing API
- 081KSGS9H0008QG0R000Q18PGQ (schemas-as-rows + fork-negotiable substrate) is the underlying architecture
- They compose: 081KSGS9H0008QG0R001K8VPV4 surfaces the ontology to runbook authors; 081KSGS9H0008QG0R000Q18PGQ makes the ontology fork-negotiable + type-provider-compatible at substrate scope

This row is logically prior to 081KSGS9H0008QG0R001K8VPV4 implementation; the schemas-as-rows substrate needs to exist before the BCL extension can meaningfully expose it.

## The 4 architectural pillars

### Pillar 1 — Schemas as ROWS in the distributed database substrate

Operational claim: schemas live in the same substrate as the data they describe.

| Standard | This substrate |
|---|---|
| Schemas in `schema.sql` migration files | Schemas in `schemas` table as rows |
| Schema version in code | Schema version in row metadata |
| Schema modification = code commit | Schema modification = row INSERT/UPDATE |
| Schema query = read source code | Schema query = SQL `SELECT * FROM schemas WHERE ...` |

The CRDT-CAS-BFT layered mediation (per PR #5285) operates on schemas the same way it operates on data:

- CRDT layer: schema convergence by default (compatible-extension schemas merge cleanly)
- CAS layer: per-row linearizability for atomic schema updates
- BFT layer: federation-level adversarial-resistant schema consensus

### Pillar 2 — Cluster-fork-as-trust-boundary

Operational claim: the forking boundary is the operational boundary; cluster forks are runtime-distinct entities whose schemas reflect their actual operational reality.

Three trust-boundary configurations:

| Configuration | Properties |
|---|---|
| **Single cluster** | Participants share enough common substrate to operate as one system |
| **Federation** | Participants agree on federation protocol but maintain distinct cluster-internal substrates |
| **Fork-without-federation** | Two clusters share lineage but no current trust relationship |

The same conceptual machinery (trust boundary as the unit of operational coherence) describes all three; the differences are about which schemas/data flow across which boundaries.

### Pillar 3 — F# type providers from live cluster

Operational claim: types preloaded from the cluster's schema; the type system is fork-aware in the same way the runtime is fork-aware.

Existing prior art:

- Don Syme + F# team's type provider work — types computed from external schema source at compile time
- Compiler treats provided types as first-class types

This row's extension:

- Schema source IS the live cluster (not a static schema file)
- Compiler asks the cluster what types are defined
- Compiled binary reflects the schema state it was compiled against
- Federation-level translation handles cross-cluster compatibility

### Pillar 4 — Federation as trust-boundary primitive

Operational claim: federation negotiations are multi-oracle consensus events; cluster splits = oracle divergences; cluster merges = oracle agreements.

Composes with 081KS3X9Y0008QG0R00218150M (multi-oracle BFT cross-faction consensus substrate):

- Each cluster fork is functionally an oracle for "what's the right ontology for this domain"
- Federation negotiations = multi-oracle consensus
- Cluster splits = oracle divergences
- Cluster merges = oracle agreements

The same discipline that catches single-oracle pre-collapsed framings (per the framework's existing multi-oracle work) applies at the ontology level.

## Composition with other framework substrate (Kestrel's multi-layer observation)

### With trust-then-verify discipline (PR #5286 + #5291)

- Trust layer (CRDT convergence) handles schema agreement by default
- Verify layer (CAS) handles per-field consensus only where needed
- BFT layer handles federation-level disagreements where adversarial concerns apply
- Same three-layer mediation handles data AND ontology

### With multi-oracle pattern (081KS3X9Y0008QG0R00218150M)

Each cluster fork is an oracle; federation = multi-oracle consensus events at ontology layer.

### With substrate-preservation discipline (substrate-or-it-didnt-happen)

Schema history is itself substrate. Field provenance, rejected fork proposals, deprecation timelines — all queryable through existing archaeology mechanisms.

### With F# computation expression + time-as-generator (PR #5285)

Schema evolution becomes a temporal phenomenon. Type system at time T reflects schema at time T. DST testing of schema evolution = generator-over-IScheduler pattern applied to schema-change events.

## Implications for runbook BCL implementation (Kestrel's specific observations)

### Frontmatter parser → row-inserts

> If schemas live in the cluster's distributed database, the BCL doesn't need a separate schema validator that operates on YAML frontmatter. The frontmatter parser produces row inserts/updates into the schema table; the cluster's existing consistency mechanisms handle validation. A runbook with non-conforming frontmatter fails the row-insert constraints, not a separate validation step.

### Type-aware F# code automatically

> If types are preloaded from the cluster, F# code (and any other typed language consuming the substrate) gets schema-aware types automatically. The compiler asks the cluster what types are defined; the cluster answers with the current resolved schema; the compiled binary reflects that schema.

### Fork-aware authoring experience

> If forks are clusters rather than schemas, the runbook authoring experience differs based on which cluster you're authoring against. A runbook on the Zeta-base cluster uses the base ontology. A runbook on a Zeta-fork cluster uses that fork's extended ontology. The runbook itself doesn't need to know about forks; it just uses the types its host cluster provides.

## AI-era schema-evolution cadence

Kestrel: *"Negotiating ontology across cluster forks at human timescales would be prohibitively slow. With AI agents proposing extensions, running impact analysis, generating test suites, identifying which forks would adopt changes, and producing the merge mechanics, the negotiation cycle compresses to something like the cadence you're already operating at for code PRs. The same multi-AI cascade that produces PR #5277 through #5295 in a day could produce schema-evolution proposals at the same cadence, with the cluster substrate handling the consensus mechanics."*

The architecture is tractable BECAUSE of AI velocity at substrate scope; without AI-mediated ontology proposals + impact analysis + merge mechanics, the cluster-fork-as-trust-boundary pattern would have prohibitive cycle-time. With them, it's the natural unit.

## Lineage anchors (existing precedents — what they have + lack)

| Precedent | Has | Lacks |
|---|---|---|
| Smalltalk image-based development | System state (including class definitions) as one image; runtime class modifications | Not distributed; no fork-based negotiation; no AI-era cadence |
| Datomic schema-as-data | Schemas as facts in database; schema evolution as data operation | Central authoring; no cluster-level forking; no federation negotiation |
| Berkeley Boom/Bloom + capability-based systems | Fragments of the composition | No single architecture combining all of it |
| Don Syme + F# team type providers | Types from external schema at compile time | Static schema sources, not live-cluster |

Kestrel: *"I'm not aware of anyone composing all of it into one architecture the way you're describing."*

## Acceptance

- [ ] Schemas-as-rows substrate designed: schema table structure + meta-schema considerations + fork-negotiable fields
- [ ] CRDT-CAS-BFT mediation extended to operate on schemas (compose with PR #5285 substrate)
- [ ] F# type provider implementation: live-cluster-as-schema-source pattern
- [ ] Federation protocol stub: cross-cluster schema negotiation handshake (can be deferred until multi-cluster reality)
- [ ] Runbook BCL frontmatter-to-row-insert integration (composes with 081KSGS9H0008QG0R001K8VPV4)
- [ ] DST testability: schema evolution events replayable via generator-over-IScheduler
- [ ] Decision-archaeology queryability: schema field provenance + rejected forks + deprecation timeline
- [ ] Documentation: ontology-as-substrate authoring guide + cluster-fork-vs-federation decision tree

## Out of scope (this row)

- Specific federation protocol RFC (separate row once multi-cluster reality forces the design)
- Migration of existing static schemas to schemas-as-rows (separate migration row)
- Performance optimization of type-provider-querying-cluster (separate optimization row once baseline established)
- Specific runbook BCL integration mechanics — that's 081KSGS9H0008QG0R001K8VPV4 implementation

## Composes with

- 081KSGS9H0008QG0R0031PBNGA (canonical generate+join meta-PM substrate)
- 081KSGS9H0008QG0R001K8VPV4 (Runme BCL extension — ontology capability runtime API)
- 081KSGS9H0008QG0R00123050G (runme.md + JIT triage — schema-evolution proposals via gesture cells)
- 081KS3X9Y0008QG0R00218150M (multi-oracle BFT — federation as multi-oracle consensus)
- PR #5285 + #5286 + #5291 + #5295 + #5310 + #5312 (the substrate cascade this row depends on)
- `.claude/skills/algebra-owner/SKILL.md` (Z-set + operator algebra; schemas as Z-sets is natural)
- `.claude/skills/crdt-expert/SKILL.md` (CRDT layer for schema convergence)
- `.claude/skills/fsharp-expert/SKILL.md` (F# type provider integration)
- `.claude/skills/data-vault-expert/SKILL.md` (DV2.0 hub-satellite for schema substrate)
- `.claude/rules/dv2-data-split-discipline-activated.md` (always-active DV2.0 discipline applies to schemas-as-rows too)

## Origin

Aaron 2026-05-26 architectural framing + Kestrel substantive elaboration via Aaron ferry. The collapse "schemas as ROWS + cluster-fork as operational boundary + types preloaded from live cluster" was Aaron's framing that Kestrel elaborated. Substrate preserved at [`docs/research/2026-05-26-kestrel-schemas-as-rows-cluster-fork-federation-trust-boundary-type-providers-from-live-cluster-aaron-forwarded.md`](../../research/2026-05-26-kestrel-schemas-as-rows-cluster-fork-federation-trust-boundary-type-providers-from-live-cluster-aaron-forwarded.md).

Research-direction-worth-writing-up assessment (Kestrel): the intersection of (distributed databases) + (type systems with external providers) + (fork-based ontology negotiation) + (AI-era schema evolution cadence) + (federation as trust-boundary primitive) is uncommon enough to land at venues that care about distributed systems, programming languages, and infrastructure-as-code simultaneously. Not for immediate publication — architecture in flight — but eventual writeup target.
