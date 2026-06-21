---
id: 081KSXN940008QG0R001YABTHH
title: First-class labels/tags + scopes on every G-Set/Z-set entity — deferred-to-human state-label; OTel-baggage / DI-scope propagation; the metadata layer policies + decentralized identity build on
status: open
priority: P1
created: 2026-05-31
attribution: aaron-otto-2026-05-31
last_updated: 2026-05-31
decomposition: umbrella
depends_on: []
composes_with:
  - 081KRYRGG0008QG0R0018CMFQY
  - 081KSXN940008QG0R002FWR9B2
  - 081KRW63S0008QG0R001Z10PVV
  - 081KSE6WT0008QG0R002275NDE
  - 081KSKBP80008QG0R000B3Y19A
tags:
  - labels
  - tags
  - scopes
  - faceted-classification
  - folksonomy
  - metadata
  - otel-baggage
  - di-logging-scopes
  - g-set-crdt
  - z-set
  - deferred-to-human
  - policy-substrate
  - decentralized-identity
  - zero-trust
  - umbrella
---

# 081KSXN940008QG0R001YABTHH — Labels/tags + scopes as first-class metadata on every entity

## Why (operator 2026-05-31)

> Aaron: *"somewhere in the workitem stuff we need the deferred-to-human label … we
> generically need labels/tags on every zset/gset, and even OTel needs to pass many like
> DI logging scopes via OTel-like propagation … we should also backlog label/tag design and
> scopes, cause i'm guessing policies are going to come in here next … tie in decentralized
> identity eventually where good-actor/bad-actor is defined at the individual node level —
> the root of zero-trust identity policy."*

Every entity in the DB design (the ZetaId-keyed event log → G-Set/Bag/Z-set folds, ADR
2026-05-31) needs **first-class metadata facets** — and that metadata is the layer
**policies** and **decentralized identity / zero-trust** will build on next. This row lands
the metadata layer; it sets up (does not yet build) the policy + identity trajectory.

## Labels vs tags (the distinction, with human CS lineage)

| | Tag | Label |
|---|---|---|
| Shape | flat **membership** marker (a bare string) | **key→value facet** (a dimension) |
| Question | "is it tagged X?" | "what's its `state`? `deferred-to-human`" |
| Algebra | a **G-Set of strings** (add +1; remove → Z-set) | a **Z-set / Map of `(key,value)`** facets |
| Lineage | **folksonomy** (uncontrolled, user-generated tags) | **faceted classification** — Ranganathan **Colon Classification (1933)** + **PMEST**; mutually-exclusive collectively-exhaustive *facets* (the ancestor of K8s/Prometheus labels) |

Usage is inconsistent across systems (Gmail "labels" are tags; Git "tags" are pointers;
K8s/AWS "labels"/"tags" are key-value) — the load-bearing split is **flat-membership (tag) vs
keyed-facet (label)**. Both are **folds over the event log** (a label's current value = the
fold of its set/unset events) — no new store, consistent with the [DB-design ADR](../../DECISIONS/2026-05-31-zeta-database-design-event-sourced-gset-bag-zset-rx-fold-materialized-views-two-backends.md).

**Lineage links** (`composes_with` / `depends_on`) are a third ancestry: **citation
indexing** — Shepard's Citations (Frank Shepard, **1873**) → Eugene Garfield's Science
Citation Index (**1955/1960**, explicitly modeled on Shepard's). LexisNexis runs both halves
at once (West Key-Number controlled taxonomy ≈ faceted labels; Shepard's ≈ citation lineage)
— exactly our (labels + cross-ref edges) pair.

## Scopes — propagation (the OTel-baggage / DI-logging-scope half)

Labels/tags must **propagate** with the logical operation, not just sit on one entity:

- **OTel Baggage** = key-values propagated *across* boundaries (W3C Baggage header).
- **.NET `ILogger.BeginScope`** = AsyncLocal ambient key-values every log line within inherits.

Same shape: a **scope** is an ambient label-context that flows through the fold pipeline, so a
work-item / bus / observability event **inherits its enclosing scope's labels** (agent,
trajectory, session). This is the **Tempo / trace-context leg** of the git-native LGTM
(#6289): baggage = the propagated label-context; a span's attributes = its labels.

## The concrete first need: `deferred-to-human`

`deferred-to-human` is a **state-label** (`state=deferred-to-human`) — the work-item twin of
the GitHub `deferred-to-human` PR label ([`pr-triage-tiers.md`](../../../.claude/rules/pr-triage-tiers.md) Tier 5). Per the type-vs-state
model (081KSXN940008QG0R002FWR9B2): it's a *state* value, not a type. (Operator 2026-05-31 prefers
`deferred-to-human` over `waiting-on-human`.)

## Forward trajectory — what this sets up (operator 2026-05-31; "circling the core")

This metadata layer is the substrate the next rings build on (anticipated, not filed here):

- **Policies** — rules/predicates over `(labels × actor-identity)`, evaluated as a **fold/view**
  (a policy decision is a materialized view; cf. K8s label-selectors, **OPA/Rego** already in
  the cluster stack, 081KSE6WT0008QG0R002275NDE). "policies are coming next."
- **Decentralized identity / zero-trust** — good-actor/bad-actor **defined at the individual
  node level** (each node runs the trust-calculus locally; no central authority) = the root of
  zero-trust identity policy. Composes with the **multi-oracle trust-gradient**
  (`useful-output-is-evidence-not-authority.md`), **NCI** consent-floor, **m-acc** multi-oracle,
  and the **agora-v6 reputation / encryption-budget** economy (081KRW63S0008QG0R001Z10PVV).
- **Verifiable identity** — **SPIFFE/SPIRE** (workload identity / SVID) + the **AgencySignature**
  layered-actor-identity (commit-trailer attribution) + the **ZetaId** as the identity primitive:
  the "actor" in a policy is a verifiable identity; nodes attest + decide locally (zero-trust).

The tie to the core: **the ZetaId-keyed event substrate is simultaneously the identity,
metadata, and policy substrate; trust is computed locally (zero-trust / multi-oracle), not
centrally.** Labels are the facets; scopes propagate them; policies fold over (labels ×
identity); decentralized identity makes the actor verifiable + the trust-decision node-local.

## Acceptance (umbrella — sub-targets)

- [ ] **Design memo** (route through product-team agreement): tag (G-Set) vs label (Z-set facet)
      schema on the entity model; how they fold; how cross-ref edges (citation) are represented.
- [ ] **Scopes / propagation**: an ambient label-context (OTel-baggage / DI-scope shape) that
      flows through the fold pipeline; events inherit enclosing-scope labels.
- [ ] `deferred-to-human` state-label landed on the work-item model (081KSXN940008QG0R002FWR9B2), twinned with the
      existing GitHub PR label.
- [ ] Labels/tags are **selectable** (label-selector / faceted query) as folds/views.
- [ ] Forward hooks documented for policies (OPA, 081KSE6WT0008QG0R002275NDE) + decentralized-identity/zero-trust
      (081KRW63S0008QG0R001Z10PVV + SPIFFE/SPIRE + AgencySignature) — set up, not built here.

## Composes with

- **081KRYRGG0008QG0R0018CMFQY** (compositional-DBSP meta-tagged *dimensions*) — this row is the entity-metadata
  level; 081KRYRGG0008QG0R0018CMFQY is the dimensional-frame level; they compose (dims × entity-facets)
- **081KSXN940008QG0R002FWR9B2** (work-items) — the first consumer (`deferred-to-human` state-label)
- the [DB-design ADR](../../DECISIONS/2026-05-31-zeta-database-design-event-sourced-gset-bag-zset-rx-fold-materialized-views-two-backends.md) (2026-05-31) + git-native LGTM (#6289) — labels-as-folds + baggage=Tempo
- **081KRW63S0008QG0R001Z10PVV** (agora-v6 reputation / encryption-budget) — the trust/identity economy
- **081KSE6WT0008QG0R002275NDE** (cluster stack incl. OPA) — the policy-engine anchor
- **081KSKBP80008QG0R000B3Y19A** (workflow engine) — labels/states on lifecycle objects
- `.claude/rules/useful-output-is-evidence-not-authority.md` + `non-coercion-invariant.md` +
  `m-acc-multi-oracle-end-user-moral-invariants.md` — the local/zero-trust trust-calculus
- KSK consent substrate (081KQZVQW0008QG0R002Q58F6Z / 081KR2E4K0008QG0R003MJ4JK0 / 081KR2E4K0008QG0R003CPCM4V) + the AgencySignature actor-identity writeup
  — the consent + verifiable-identity precedents
- human lineage: Ranganathan faceted classification (1933) · folksonomy · Shepard's/Garfield
  citation indexing — honored per `honor-those-that-came-before.md`
