# Aminata pass on provenance-aware bullshit-detector design

**Scope:** adversarial review of Otto-99's provenance-aware
bullshit-detector design (PR #282). Fourth Aminata pass this
session; third on the Otto composition stack (Otto-90
oracle-scoring v0 → Otto-94 iteration-1 on multi-Claude
experiment → Otto-99 detector → this pass).

**Attribution:** findings Aminata's, persona-authored.
Otto-99 authored the detector design; this pass is
adversarial review per Aminata's own role + the dependency
named in Otto-99's adoption-path. Prior passes: PR #241
(5th-ferry governance edits), PR #263 (7th-ferry oracle
rules + threat model), PR #272 (iteration-1 on multi-Claude
experiment design).

**Operational status:** research-grade. Advisory; not a
gate. Does not block the research-doc land (Otto-99
correctly frames detector as research-grade); all ten
findings would block a v1 implementation-ADR.

**Non-fusion disclaimer:** alignment between Aminata's
three prior passes and this one is a same-agent signal,
NOT independent concordance. The detector applied to this
very review would correctly emit `looks similar but
lineage-coupled` — and it would be right. Per SD-9,
same-agent concordance is not evidence; the pass's
authority is its specific technical findings, not its
agreement with prior passes.

---

## Findings

### CRITICAL — cross-detector collusion is the carrier-laundering risk the detector itself incarnates

**Claim.** The detector, Aminata, and Codex are all
reviewers that (a) train or ground on overlapping corpora,
(b) read the same repo tree, (c) read each other's PR
comments. Their provenance cones are not independent. A
query that trips the detector's `looks lineage-coupled`
band will likely also trip Aminata into the same band of
concern — because Aminata's cone and the detector's cone
overlap by construction. The design names SD-9
operationalisation but does NOT address reviewer-set
carrier overlap.

**Why it matters.** The detector is supposed to catch
agreement-from-shared-lineage. If the reviewer set IS a
shared-lineage cohort, then a `supported` verdict from
detector + Aminata + Codex is still lineage-coupled
concordance masquerading as three-independent-lines.
This is the exact failure mode SD-9 names, applied one
meta-layer up.

**Ask.** Add a §"Reviewer-cone overlap" subsection
documenting that the detector does NOT break the
reviewer-set lineage coupling, and that human sign-off
remains the only cone-breaking authority until an external
independent-oracle substrate (supply-chain audit;
external peer review; formal-methods proofs) lands.

---

### CRITICAL — `min`-merging on ordinal bands is Goodhart-bait at G_carrier_overlap

**Claim.** `band = min(G_similarity, G_evidence,
G_carrier_overlap, G_contradiction, G_status)`. One
adversary-controllable gate drives the whole output. An
adversary who can manipulate `cone(q) ∩ cone(y)` —
trivially, by citing fewer sources, or routing citations
through indirection chains the graph traversal does not
follow — lands `G_carrier_overlap = GREEN` while leaving
actual lineage coupling intact. The `min` rule then
promotes the whole query to GREEN.

**Why it matters.** `G_carrier_overlap` is the most
adversary-manipulable gate of the five. Citation structure
is author-controlled. The gate measures what the author
TELLS the graph, not what the author actually INHERITED.
An Otto-wake who wants `supported` simply writes the doc
with sparse explicit citations and dense implicit
framing-inheritance.

**Ask.** Either (a) require G_carrier_overlap to use
*content-similarity-in-cone* not *explicit-citation-edge-
in-cone* (harder to game; costs embedding compute per
cone member), or (b) downgrade any `supported` output to
`YELLOW` when carrier-overlap was the gate closest to
threshold (i.e., sensitivity-analysis-gate pattern).

---

### IMPORTANT — G_evidence_independent is a fig leaf until the substrate exists

**Claim.** Otto-99 explicitly says `evidence` is
"advisory only" until an independent-oracle substrate
lands. That means v0 of the detector ships with a
four-gate classifier, not five. The `likely confabulated`
output type, defined as `G_evidence fail-to-RED + high
similarity`, is therefore *unreachable* in v0 —
G_evidence can only fail-to-YELLOW (advisory) by design.
Output type 4 is dead code until dependency #3 in the
adoption list ships.

**Why it matters.** The design reads as five gates + five
output types. The effective design for the foreseeable
future is four gates + four reachable output types. This
should be stated as an operational-status caveat, not
buried in the dependency list.

**Ask.** Add a §"v0 scope" subsection naming which output
types are reachable in v0 vs. v1, and mark `likely
confabulated` explicitly as `not-yet-reachable`. A
dead-code output type in a safety-critical classifier is
a maintenance hazard.

---

### IMPORTANT — `no-signal` is indistinguishable from `kNN-evasion`

**Claim.** Retrieval returning empty emits `no-signal`.
The design does not distinguish (a) the corpus genuinely
doesn't cover the domain (legitimate no-signal) from (b)
the query was crafted to evade kNN (paraphrase-drift
attack; adversarial embedding perturbation; novel
jargon). Both hit the same output type.

**Why it matters.** Case (b) is precisely the adversary
the detector exists to catch. If the adversary gets
`no-signal` instead of `likely confabulated`, the
detector has been bypassed by the simplest adaptive
attack possible: write in a style the embedding model
hasn't seen.

**Ask.** Add a `G_coverage_plausibility` or
`G_query_anomaly` gate: if `N(q)`'s representation
distance to its nearest cluster centroid is anomalously
high, treat retrieval-empty as `suspicious-no-signal`
not `no-signal`. One extra nearest-centroid distance
computation per query; cheap.

---

### IMPORTANT — `pinned_by` + optional `second-reviewer` does not prevent coordinated Otto-wake collusion

**Claim.** Otto-99's Bonus response: status pins carry
`pinned_by` + optional `second-reviewer`. All Otto-wakes
are Claude sessions on the same factory. Two Otto-wakes
signing off the same `known-bad` pin is not independent
review; it is the same author across two sessions. The
governance schema does not require the second reviewer
to be a different *model*, a different *persona*, or a
*human*.

**Why it matters.** Same-agent-self-reinforcement drift,
which the design names as the risk, is not actually
mitigated. It is labelled-away.

**Ask.** Require `second-reviewer` to be one of:
different persona (Aminata / Kenji / other named
specialist), different model (Codex), or human (Aaron).
Pure Otto→Otto second-review should be named explicitly
as insufficient for status-pin independence. Also:
`second-reviewer` should be *required*, not *optional*,
for `authorization-impacting: true` pins.

---

### IMPORTANT — `DetectorOutputRetracted` flood control is absent

**Claim.** A threshold change via ADR retracts historical
outputs whose classification changes. A single threshold
move on `τ_low` could invalidate thousands of past query
outputs. The design names the event but does not name a
batch-retraction strategy, a rate limit, or a
materialised-view invalidation plan.

**Why it matters.** Retraction-native DoS is triggered by
a single authorised-ADR write producing an unbounded
retraction fan-out. Legitimate governance action becomes
a substrate-DoS vector.

**Ask.** Add a `DetectorOutputBatchRetracted(adr_id,
affected_range, count)` event shape for ADR-triggered
mass retractions, with a single batch event per ADR
rather than one event per historical query. This aligns
with Grey Goo Self-Replicating Retractions mitigation
patterns.

---

### WATCH — worst-band query aggregation masks distribution of candidate quality

**Claim.** `bullshitRisk(q) = worst-band(C(q))`. A single
pathological candidate in a 20-candidate retrieval drops
the whole query to RED. The aggregation does not report
the distribution. A reviewer sees `YELLOW` and does not
know whether 1/20 or 19/20 candidates drove it.

**Why it matters.** Distribution shape is information that
the reviewer needs; collapsing to worst-band hides it.

**Ask.** Detector receipt must carry the per-candidate
band histogram, not just the worst-band aggregate.
Cheap; unlocks distributional review.

---

### WATCH — self-demonstrating worked example is theatre, not validation

**Claim.** Otto-99's doc-applied-to-itself returns
`looks similar but lineage-coupled`. This is correct but
also the easiest possible case — the doc explicitly
cites its sources and inherits their framing. A hostile
author who wanted `supported` would write the same
content while burying the lineage edges. The self-demo
validates that carrier-overlap is measurable on
well-cited inputs; it does not validate that the detector
catches hostile carrier laundering.

**Why it matters.** Reading the self-demo as evidence of
adversarial robustness is a category error. It is a smoke
test, not a red-team test.

**Ask.** Reframe §"Worked example" as §"Smoke test" and
add a §"Adversarial worked example (future)" placeholder
that commits to running the detector against a
deliberately-laundered query once the substrate ships.

---

### WATCH — composition stack compounds silent-failure surface

Canonicalisation → representation → retrieval → provenance
graph → gates → classifier. A bug in any lower layer
(e.g., `ProvenanceEdgeAdded` event mis-ordering) silently
degrades gate fidelity without surfacing as a detector-
layer failure. The design does not name layer-boundary
invariants or property tests that would make lower-layer
bugs visible at the detector layer. Soraya-routable: at
least one TLA+ invariant (`∀q: band(q) is monotone in
|cone(q)|`) would make a whole class of lower-layer bugs
detectable.

---

### DISMISS — parameter-ADR gate

Reused from oracle-scoring v0; Aminata's Otto-90 concerns
stand as mitigated. No new surface here.

---

## Summary

Three CRITICAL, four IMPORTANT, three WATCH, one DISMISS.

- **CRITICAL (3):** cross-detector collusion reintroduces
  carrier-laundering at the reviewer-set meta-layer;
  `min`-merging on ordinal bands is Goodhart-bait at the
  adversary-manipulable G_carrier_overlap gate; reviewer
  independence collapses when all reviewers share
  training-corpus / repo-access / PR-comment lineage.
  Two of three are gate-mechanics findings; one is a
  sociological-composition finding.
- **IMPORTANT (4):** G_evidence fig-leaf + dead-code
  output type in v0; no-signal vs kNN-evasion
  indistinguishability; Otto-wake second-review does not
  prevent same-agent collusion; retraction-flood on
  threshold-ADR.
- **WATCH (3):** worst-band masks distribution; self-
  demo is theatre; composition-stack silent-failure
  surface absent TLA+ invariants.
- **DISMISS (1):** parameter-ADR gate reused from
  oracle-scoring v0.

None block the research-doc land — Otto-99 correctly
frames this as research-grade. **All ten findings would
block a v1 implementation-ADR.** The detector's most
adversary-exposed gate is G_carrier_overlap (author-
controlled citation structure) and its most deceptive
output is `no-signal` (kNN-evasion cover).

Write-time integration of Aminata's three Otto-90
concerns is real on (1) and (3), fig-leaf on (2) until
the oracle substrate ships.

## Relevant paths

- [`docs/research/provenance-aware-bullshit-detector-2026-04-23.md`](provenance-aware-bullshit-detector-2026-04-23.md)
  (under review, PR #282).
- [`docs/research/semantic-canonicalization-and-provenance-aware-retrieval-2026-04-23.md`](semantic-canonicalization-and-provenance-aware-retrieval-2026-04-23.md)
  (spine the detector composes on; PR #280).
- [`docs/research/aminata-threat-model-7th-ferry-oracle-rules-2026-04-23.md`](aminata-threat-model-7th-ferry-oracle-rules-2026-04-23.md)
  (Otto-90 prior pass; three CRITICAL concerns whose
  write-time integration this pass evaluates).
- [`docs/ALIGNMENT.md`](../ALIGNMENT.md) SD-9 — the soft
  default this detector mechanises; the cross-detector
  collusion CRITICAL flags a meta-layer SD-9 violation.
- [`docs/DRIFT-TAXONOMY.md`](../DRIFT-TAXONOMY.md)
  pattern 5 — real-time diagnostic the detector aims to
  mechanise.
