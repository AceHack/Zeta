---
id: 081KSXN940008QG0R001V8NBDV
priority: P3
status: open
title: Creator compensation via a multi-attribution contribution graph + weighted split (provenance, NOT DRM)
tier: economy-substrate
ask: Aaron 2026-05-31
created: 2026-05-31
last_updated: 2026-05-31
decomposition: umbrella
composes_with:
  - docs/research/2026-05-31-work-ontology-bi-kimball-grounding-provenance-lineage-anchor-creator-comp-not-drm-aaron-max-ratification.md
  - docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md
  - .claude/rules/dv2-data-split-discipline-activated.md
  - .claude/rules/additive-not-zero-sum.md
  - .claude/rules/honor-those-that-came-before.md
  - docs/backlog/P2/081KRW63S0008QG0R000QJR08H-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md
tags: [economy-substrate, creator-compensation, provenance, lineage, contribution-graph, attribution, anti-drm, openlineage, prov-o, c2pa, agora, multi-attribution, bridge-table, dv2.0]
type: feature
---

# 081KSXN940008QG0R001V8NBDV — Creator compensation via a multi-attribution contribution graph + weighted split (provenance, NOT DRM)

## The directive (Aaron 2026-05-31)

> *"lets land data provenance / lineage anchor somewhere too … like where does dbt inherit its
> lineage from or like meta attribute from lexisnexis legal on streams. something we can pay creators
> not for DRM"* + *"so can this support a multi attribution/contribution graph for items?"*

The bet: **pay creators by attribution along a provenance/contribution graph — the opposite of DRM.**
DRM restricts access to extract value; this records who-contributed-what (open content) and splits
compensation along the lineage. Builds on the work-ontology grounding doc (BI/Kimball + DV2.0 +
OpenLineage/PROV-O/C2PA), which is **pending Aaron+Max ratification** — so this row's design is
gated on that ratification.

## The thing

A **contribution graph** over work-nodes (work-items / projects / initiatives / content artifacts)
plus a **weighted-split engine** that turns the graph into creator payouts:

1. **Multi-attribution edges.** Each work-node has a *weighted set* of contributors (human travelers
   + AI agents + the prior substrate it derived from). Modeled as:
   - **Kimball bridge table** with a `contribution_weight` allocation factor (weights sum to 1.0 /
     total credit) — the canonical M:N weighted-credit pattern;
   - on a **DV2.0** `contribution` link + satellite (`{weight, role, what, timestamp}`) — graph by
     construction;
   - emitting **PROV-O** qualified attribution (`prov:wasAttributedTo` + `prov:hadRole` + weight) and
     **OpenLineage** events (the format dbt's lineage already speaks).
2. **Source-material pre-attribution (Aaron 2026-05-31).** The graph extends upstream to the *source
   creators of any human material the framework synthesizes or trains on*, recorded **pre-emptively —
   even if the creator doesn't know we're using it**. Synthesis/training source edges
   (`synthesizedFrom` / `trainedOn`; PROV-O `wasDerivedFrom`; OpenLineage inputs extended to
   human-authored sources) attribute identifiable source creators directly; unidentifiable ones get a
   **placeholder / reserved-attribution escrow** that releases when the human is later identified or
   surfaces (they set their own terms then, per NCI + m-acc). The anti-extraction inverse of
   scrape-silently-attribute-nothing; `honor-those-that-came-before` at training-data scope. External
   anchor: **Data Dignity / "Data as Labor"** (Lanier & Weyl / RadicalxChange).
3. **Transitive attribution along `wasDerivedFrom`.** When item B derives from item A, A's
   contributors earn a weight-decayed share of B's credit (PageRank- / Shepard's-citation-depth-style
   flow with a bounded decay). This is `honor-those-that-came-before` made computable.
4. **Attention-weighted value inflow (Aaron 2026-05-31).** An item's *earned credit* is not flat —
   it is `attention × quality-of-attention` the item receives. Attention = a fact measure (grain =
   attention-event; reputation-weighted per Agora V6 081KRW63S0008QG0R001Z10PVV + participation-economy 081KRW63S0008QG0R000QJR08H);
   quality-of-attention = reputation-of-the-attender (eigenvector/EigenTrust/PageRank, BFT-anchored)
   × depth/valence-of-engagement (Shepard's-treatment-style) × an **anti-coercion filter** (genuine
   curiosity-driven attention counts; coerced / farmed / tonal-momentum-captured attention is
   detected + zeroed per `tonal-momentum-equals-meme-emergent-harmonic-coercion` + NCI). Attention
   propagates through the graph (transitive, citation-style).
5. **Weighted-split payout.** payout(contributor) = Σ over items [ attention_value(item) ×
   contribution_weight(contributor, item) ] + transitive-decayed-upstream; pay via the **Agora**
   economy layer. (Both the contribution graph and the attention graph are reputation/quality-weighted
   graphs; the payout composes them.)
6. **Glass-halo + retraction-native.** The attribution ledger is open/auditable (not a DRM gate);
   contribution weights are signed-measure (Z-set) values; a mis-attributed share is corrected by a
   compensating edge (idempotency / retraction discipline), never a silent rewrite.

## Why provenance, not DRM

| | DRM | This (provenance/attribution) |
|---|---|---|
| Mechanism | lock content down | record origin + every edit; leave content open |
| Creator value | gate access | attribute → compensate along lineage |
| Stance | zero-sum | additive (`additive-not-zero-sum`) |

**C2PA** (6000+ members 2026; native on consumer hardware; AI generators embed it) already proves
provenance-without-restriction works at consumer scale — and it **lacks a payout layer**; that gap is
what this fills. **Shepard's Citations** (LexisNexis) is the century-old precedent that
attribution-lineage is how a creator-class is *valued* without DRM.

## Acceptance (umbrella — decomposes into slices)

1. Contribution-graph data model ratified (bridge-table semantics + DV2.0 link/satellite storage +
   PROV-O/OpenLineage emission), gated on the work-ontology ratification.
2. A weighted-split function: graph → per-contributor payout shares (direct + transitive-with-decay),
   verifiable + retraction-correctable.
3. Human + AI + prior-substrate all attributable as first-class graph nodes.
4. Integration point with Agora (the payout/economy layer) specified (not necessarily built).
5. Glass-halo: the attribution ledger is open + auditable; no DRM gate anywhere in the design.

## Why P3

Major economy-direction bet, but downstream of (a) the work-ontology ratification (Aaron+Max) and
(b) Agora maturing as a payout layer. Long-horizon; not blocking. Raise to P2 once the ontology is
ratified and Agora has a payout surface.

## Pre-start checklist (per backlog-item-start-gate)

- **Prior-art search (2026-05-31):** no existing creator-compensation / provenance-anchor /
  contribution-graph substrate (verified via content search across `.claude/` + `docs/` + `memory/`).
  Genuine new row. Composes with the participation-economy (081KRW63S0008QG0R000QJR08H) + Agora + additive/honor rules.
  External anchors (search-verified 2026-05-31): OpenLineage (LF AI; dbt's native lineage), PROV-O
  (W3C), C2PA / Content Credentials, LexisNexis Shepard's Citations.
- **Dependency check:** gated on the work-ontology grounding doc's Aaron+Max ratification; the
  weighted-split engine depends on a payout surface (Agora). Design pass can start once the ontology
  is ratified.
