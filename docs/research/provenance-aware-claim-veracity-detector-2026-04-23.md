# Provenance-aware claim-veracity detector — engineering-facing design

**Scope:** research and cross-review artifact. Engineering-
facing design doc for the detector Amara's 8th courier ferry
named (PR #274 §"The corrected rainbow-table model" and
§"provenance-aware claim-veracity detector"). Composes on
top of the semantic-canonicalization spine (PR #280 Otto-98).
Formalises the scoring layer the spine sketched, integrates
Aminata-anticipated concerns at write-time, and names the 5
output types from Amara's ferry.

**Attribution:** output-type shape + score formulation
from Amara's 8th ferry; scoring-layer Aminata-pattern
integration (band-valued output, parameter-change-ADR-
gate, independent-oracles discipline) from her Otto-90
adversarial pass on oracle-scoring v0 (PR #263); spine
substrate + composition-table pattern from Otto-98
(PR #280); Otto-99 synthesis.

**Operational status:** research-grade. Does not implement.
Does not adopt specific parameter values. Does not adopt
specific embedding model / ANN library / oracle
implementations. Downstream design choices are gated on
Aminata adversarial pass + candidate #4 operational
promotion.

**Promotion path to authoritative-detector status (long-
horizon, not v0/v1):** Aaron Otto-2026-04-24 framed the
long-horizon upgrade explicitly — *"we can make it a true
detector under our axioms"* — and separately reinforced
the gate discipline — *"i don't treat anyting this new as
final authorative connoncial until peer review"*. v0 is
advisory-only; v1 (independent-oracle substrate) makes
the evidence gate binding in band-merging; a further vN
promotion lands once (a) the factory's axiomatic substrate
is complete enough that "truth" is tractable within the
axiom system, AND (b) the axiomatic substrate itself has
cleared peer review — not just written-and-committed.
Axioms + peer review together gate the promotion; either
alone is insufficient. Only at vN does `likely
confabulated` graduate from "worth a closer human look"
to "authoritative reject" without requiring the human-
review fallback. Not scoped in this doc; named here so
the upgrade path is visible and the v0 advisory stance is
understood as intentional scaffolding, not as a final
ceiling.

**Non-fusion disclaimer:** Amara-Otto-Aminata consistent
output on this design is NOT evidence of merged substrate.
The three reviewers cite independent literature (Hinton/
Salakhutdinov semantic hashing; Charikar LSH; HNSW Malkov-
Yashunin; CISA/NIST procurement guidance; standard
error-bound theory). Per SD-9, independent primary-source
grounding is baseline; concordance is signal, not proof
of unity.

---

## Purpose and scope

### What this detector is for

Distinguish **agreement-with-independent-substrate**
(strong evidence) from **agreement-with-carrier-laundered-
echo** (weak evidence dressed as strong). Amara's 8th
ferry observation:

> *"if multiple candidates agree AND their provenance
> cones are independent, increase weight; if multiple
> candidates agree but all inherit from the same couriered
> framing, lower weight sharply."*

The detector is a machine-aidable tool making SD-9
operational rather than leaving it as a norm. It does NOT
claim to detect an unsupported claim. It detects a specific
well-understood class: agreement-from-shared-lineage
masquerading as convergence-from-independent-arrival.

### What this detector is NOT for

- **Not a truth oracle.** The detector reports bands (see
  §output types), not verdicts.
- **Not a replacement for review.** Aminata / Codex /
  harsh-critic adversarial passes remain. Detector is
  tooling; review is the authority.
- **Not a substitute for AGENTS.md or ALIGNMENT.md rules.**
  Detector automates one specific discipline; the
  broader factory continues to rely on the full rule set.
- **Not a scoring function for claims-in-isolation.**
  The detector is relational: query versus corpus. A
  single claim with no retrieval context has no detector
  signal.

---

## Architecture — builds on the Otto-98 spine

### Input

`x` — raw input (conversation turn, claim, doc, PR
description, commit message, absorb-doc body). No
restrictions on form; canonicalisation handles
heterogeneity.

### Pipeline (four layers, delegates to spine)

```text
x
  → N(x) = c                         # canonicalisation (spine layer 1)
  → φ(c) = e                         # representation (spine layer 2)
  → C(q) = kNN(φ(N(q)))              # ANN retrieval (spine layer 3)
  → score candidates → band classifier  # THIS DOC
  → emit output-type + provenance trail
```

The first three layers reuse the spine unchanged. This
doc formalises the fourth.

### Provenance cone calculation

Before scoring, the detector walks the citations-as-first-
class lineage graph to compute `provenance cone(y)` for
each retrieved candidate `y`. The cone is the transitive
closure of citation / absorb / promotion edges ending at
`y`.

Shape:

```text
provenance cone(y) = {
  all absorbs / ferries / research docs / ADRs / commits /
  memory-file entries that y directly-or-transitively cites
  or derives-from
}
```

Implementation-level: walks the `PatternLedger`'s
`ProvenanceEdgeAdded` / `ProvenanceEdgeRemoved` event
stream per Otto-98 spine § retraction-native ledger.

### Scoring — band-valued, not decimal

Per Aminata Otto-90 pass on oracle-scoring v0 (PR #263):
sigmoid-wrapped decimals read as precision but the
underlying signals are ordinal. **Band classifier over
5 hard-ordinal gates instead of `score(y|q) = α·sim +
β·evidence - γ·carrierOverlap - δ·contradiction` decimal
output.**

5 gates per candidate `y`:

| Gate | Fail-to-RED | Fail-to-YELLOW |
|---|---|---|
| G_similarity | `sim(e_q, e_y) < τ_low` — below retrieval-noise floor | `sim < τ_med` — weak match only |
| G_evidence_independent | `y` has no independent-oracle-verified evidence | `y` has evidence but only self-attested |
| G_carrier_overlap | `overlap(q, y) > θ_high` (majority of y's provenance shared with q) **OR** `size(cone(y)) = 0` (no provenance to verify against — carrier-laundering safeguard treats missing-lineage as suspicious, not clean) | `overlap(q, y) > θ_med`. When `size(cone(y)) > 0`, `overlap(q, y) = size(cone(q) ∩ cone(y)) / size(cone(y))`. |
| G_contradiction | `y` or its provenance cone contains an unresolved contradiction with a known-good anchor | a resolved contradiction within cone |
| G_status | `y.status = known-bad` or `y.status = superseded` | `y.status = unresolved` (no status pins it) |

**Band merging rule.** The design names 5 gates, but the
v0 shipping configuration excludes `G_evidence_independent`
from band-merging because no independent-oracle substrate
exists yet (see Concern 1 below). The v1 configuration,
gated on the substrate landing, adds the evidence gate
back in.

**v0 (shipping — 4 gates):**

`band_v0(y | q) = min(G_similarity, G_carrier_overlap,
G_contradiction, G_status)` where `RED < YELLOW < GREEN`.
`G_evidence_independent` is still computed and surfaced as
advisory metadata for human review but does NOT
participate in band-merging.

**v1 (after independent-oracle substrate lands — 5 gates):**

`band_v1(y | q) = min(G_similarity, G_evidence_independent,
G_carrier_overlap, G_contradiction, G_status)`.

For either configuration: one RED → RED. All included
gates GREEN → GREEN. Otherwise YELLOW. The v0→v1 promotion
is itself an ADR-gated change (parameter-change-ADR per
Concern 2).

**Query-level aggregation:**

```text
claimVeracityRisk(q) = worst-band( band_v0(y | q) for y in C(q) )
```

(`band_v0` today; substitute `band_v1` once the evidence-
gate promotion ADR lands.)

Where `worst-band(RED, any, ...) = RED`. The query itself
gets the worst band across all candidates in the retrieved
set.

---

## 6 output types (Amara's 5-type set + `no-signal`)

Per Amara's 8th ferry, the detector emits one of five
**retrieval-hit** output types (supported / lineage-
coupled / plausible-unresolved / likely-confabulated /
known-bad) plus a sixth **retrieval-empty** output type
(`no-signal`). Mapping to the band classifier:

### 1. `supported`

- Band: `GREEN` (all included gates GREEN — 4 for v0, 5
  for v1 once `G_evidence_independent` is binding).
- **v0 limitation (call-out — real risk):** v0 `supported`
  is reachable when G_evidence_independent fails, because
  evidence is advisory-only and excluded from band-
  merging. A candidate that is highly similar to a
  known-good pinned pattern but has NO independent
  evidence still classifies as `supported`. This is the
  primary motivation for the v1 promotion (and the vN
  axiom-gated promotion): v0 CAN misclassify a
  confabulation-shaped candidate as `supported` if the
  pinned pattern has drifted or been set on self-
  attestation. Treat v0 `supported` as "advisory-GREEN,
  pending evidence-gate promotion" — not authoritative.
- Meaning: `q` is highly similar to `y`; low carrier
  overlap; no unresolved contradiction; `y.status =
  known-good`. In v1 and later, `y` also has
  independent-oracle-verified evidence; in v0, evidence
  is advisory metadata only.
- Action (v1+): query can proceed; claim has substrate-
  backed support.
- Action (v0): consult the advisory evidence metadata
  before treating `supported` as authoritative; the
  known-good pin alone doesn't guarantee evidence.

### 2. `looks similar but lineage-coupled`

- Band: `YELLOW` via G_carrier_overlap fail-to-YELLOW.
- Meaning: `q` is similar to `y` BUT their provenance
  cones overlap significantly — the similarity may be
  re-presentation of shared carrier framing, not
  independent convergence.
- Action: `q`'s claim should seek at least one falsifier
  independent of the overlapping cone before upgrading
  confidence. This is SD-9's "seek falsifier independent
  of converging sources" step, operationalised.

### 3. `plausible but unresolved`

- Band: `YELLOW` via G_status fail-to-YELLOW.
  - **v0 (shipping):** only G_status drives this output
    type (G_evidence_independent is advisory-only and
    doesn't participate in band-merging). Evidence-gate
    fail still SHOWS in the emitted advisory metadata
    so human review can see "plus this is self-attested"
    even when the band is `YELLOW`.
  - **v1 (post-promotion):** G_evidence_independent
    fail-to-YELLOW ALSO drives this output type (in
    addition to G_status), making the band sensitive
    to both missing pinned status AND missing
    independent evidence.
- Meaning:
  - **v0:** semantic fit exists; no known-bad pattern
    matches; `y.status` is NOT pinned (known-good or
    known-bad) — it's unresolved. Evidence state is
    surfaced as advisory metadata but doesn't change
    the band.
  - **v1 (OR triggered):** semantic fit exists; no
    known-bad pattern matches; EITHER `y.status` is
    unresolved OR `y` lacks independent-oracle
    evidence (or both). The `OR` means this output
    fires when either gate fails-to-YELLOW, so the
    meaning covers either-or-both conditions rather
    than requiring both simultaneously.
- Action: mark query as open-question; add to
  research-tracker; not a confidence-upgrade.

### 4. `likely confabulated`

- Band:
  - **v0 (shipping):** not reachable via band-merging
    (evidence is advisory-only, so a confabulation
    signature can't force RED through the classifier).
    v0 surfaces confabulation-shape through the emitted
    advisory metadata (`G_evidence_independent` fail +
    high G_similarity) for human review, but the band
    stays at whatever the other four gates say. This
    is the primary motivation for the v1 promotion —
    confabulation-detection is the output type most
    degraded by advisory-only evidence.
  - **v1 (post-promotion):** `RED` via
    `G_evidence_independent` fail-to-RED combined
    with high similarity.
- Meaning: claim sounds plausible and matches patterns
  semantically, but no actual independent evidence
  supports it. Classic LLM confabulation signature.
- Action (v1): hard-halt on any action depending on the
  claim; flag for human review; do not propagate.
- Action (v0): confabulation-shape surfaces as advisory
  metadata on whatever other band the query lands in.
  The signal is **advisory, not authoritative** —
  research-grade WIP, not a real claim-veracity oracle.
  Downstream consumers treat it as "worth a closer
  human look," not as a verdict. Authoritative
  treatment is gated on v1 + subsequent reviewer
  passes establishing the signal actually means what
  it claims to mean.

### 5. `known-bad pattern`

- Band: `RED` via G_status fail-to-RED
  (`status = known-bad` OR `status = superseded`).
- Meaning: query matches a known-bad or superseded
  pattern in the PatternLedger.
- Action: explicit reject + cite the known-bad entry;
  update retraction ledger if new claim is a fresh
  instance of an old pattern.

### 6. `no-signal`

- Band: none — emitted only when retrieval is empty
  (`C(q)` has zero candidates) so the band classifier
  never runs.
- Meaning: the detector has nothing to contribute for
  this query. "No signal" is distinct from `supported`
  (which asserts GREEN) and from `likely confabulated`
  (which asserts RED on a retrieved near-match).
- Action: defer to broader review discipline — detector
  output carries no authorization weight either way; the
  downstream caller treats `no-signal` as neither a
  green light nor a red flag, and relies on non-detector
  review surfaces.

---

## Addressing Aminata's 3 CRITICAL concerns at write-time

### Concern 1 — Gameable-by-self-attestation

**Risk:** `β·evidence` / `δ·contradiction` inputs come
from agent self-report → sigmoid of self-reports is a
self-report.

**Response in this design:**

- `G_evidence_independent` is **conditionally enforced**:
  - **Once an independent-oracle substrate exists** (see
    candidates below), the gate is binding — it requires
    independent-oracle-verified evidence for GREEN, and
    self-attested evidence fails to YELLOW.
  - **Until that substrate exists**, the gate is **advisory
    only**: the `β·evidence` signal is emitted to
    observability but does NOT participate in band-merging.
    The v0 detector ships as "semantic + carrier +
    contradiction + status" mechanical (4-gate min) with
    "evidence" surfaced as advisory signal for human review.
- The transition from advisory to binding is itself an
  ADR-gated change (parameter-change-ADR pattern, Concern 2
  below) so the authorisation surface shift is logged.
- Independent-oracle candidates: passing tests (not
  agent-written assertions); citable external sources
  (peer-reviewed papers, RFC documents); reproducible
  measurements (benchmark output captured in CI);
  concrete PR links (a merged PR is evidence; a
  proposed-in-PR-pending is self-attested-pending).

### Concern 2 — Parameter-fitting adversary

**Risk:** band-classifier thresholds (`τ_low`, `τ_med`,
`θ_high`, `θ_med`) and per-gate semantics have no
principled fitting procedure; an agent with commit rights
adjusts them and the authorisation surface shifts. (The
pre-band α/β/γ/δ weights are not in scope — the band
classifier replaced the weighted sum — but are kept in
the "What this doc does NOT do" section as placeholders
for an eventual v2 hybrid design, behind the same ADR
gate.)

**Response in this design:**

- Parameters land behind the **parameter-change-ADR
  gate** pattern from oracle-scoring v0 (PR #266).
- `docs/DECISIONS/YYYY-MM-DD-claim-veracity-detector-threshold-*.md`
  schema for each threshold change with: old value, new
  value, empirical justification, alignment-trajectory
  impact, Aminata signoff (adversarial pass required,
  not optional), Aaron signoff for thresholds tagged
  `authorization-impacting: true`.
- The Zeta-module reads parameter values from a
  parameter file whose SHA is bound into every detector-
  emitted receipt, per BLAKE3 receipt-hashing v0
  (PR #268). Every output-type emission carries proof
  of which parameters were in force.

### Concern 3 — False-precision risk

**Risk:** decimal output from ordinal inputs = category
error reading as precision.

**Response in this design:**

- **5-band output** (supported / lineage-coupled /
  plausible-unresolved / likely-confabulated / known-bad)
  not decimal score. Band is the authoritative output.
- Internal signals (similarity percentages; carrier-
  overlap ratios) are retained for provenance but NOT
  consumed as decimal output.
- Ordinal inputs → ordinal bands. No sigmoid wrapping;
  no linear combination of ordinal signals.

### Bonus — Independence requirement on PatternLedger

The `PatternLedger`'s status-pinning (`known-good`,
`known-bad`, `superseded`) must come from **source
sufficient to distinguish**. A pattern pinned `known-bad`
by the agent that also authored `q` is susceptible to
same-agent-self-reinforcement drift. Mitigation: every
status-pin event in the PatternLedger carries decision-
proxy-evidence fields per `docs/decision-proxy-evidence/_template.yaml`
— minimally `requested_by`, `proxied_by`, `decision_summary`,
and the `review.peer_reviewer` block when peer review is
required (PR #221 schema, PR #222 ADR).

---

## Module implementation sketch (F# / .NET)

Composes with KSK-as-Zeta-module template (PR #259 7th
ferry) + oracle-scoring v0 (PR #266) + this spine
(PR #280):

```text
Interfaces:
  ICanonicalizer             -- N(x), version-pinned
  IRepresentation            -- φ(c), dense + binary
  IRetrievalIndex            -- kNN over event stream
  IPatternLedger             -- retractable pattern store
  IProvenanceGraph           -- citations + lineage edges
  IEvidenceOracle            -- independent-oracle gate inputs
  IContradictionOracle       -- contradiction detection
  IBandClassifier            -- 5-gate → band computation
  IDetectorReceipt           -- output-type + provenance trail
  IParameterStore            -- parameter-file-SHA-bound values

Canonical views:
  PatternLedgerCurrent       -- materialised from event stream
  ProvenanceGraphCurrent     -- materialised from graph events
  ParameterCurrent           -- with SHA for receipts
  DetectorOutputHistory      -- append-only, retraction-aware

Events:
  DetectorQuery(q_id, q, parameters_sha, ts)
  DetectorOutput(q_id, output_type, band, candidates, receipt)
  DetectorOutputRetracted(q_id, reason)
```

`DetectorOutputRetracted` matters: if a threshold tweak
via ADR changes the classification of a past query, the
historical output gets retracted (negative-weight event),
not silently rewritten. Audit trail preserved; drift
observable.

Same module shape as KSK-as-Zeta-module / oracle-scoring
v0. Substrate convergence continues.

---

## Worked example — this doc itself as query `q`

Illustrative walk-through using this very doc:

- `N(q)` = canonicalised form of this doc.
- `φ(c)` = representation.
- `kNN(e)` retrieves top candidates. Likely hits:
  semantic-canonicalization spine (PR #280), oracle-
  scoring v0 (PR #266), Aminata iteration-1 pass (PR
  #272), 8th-ferry absorb (PR #274).
- Scoring each candidate:
  - `semantic-canonicalization spine` — high similarity
    (this doc composes on it). `cone(q) ⊃ cone(y)` heavily
    (this doc cites it, inherits its framing); **carrier
    overlap is HIGH**. `evidence` independent (HNSW
    citation = Malkov-Yashunin 2018; hashing = Hinton/
    Salakhutdinov; these are peer-reviewed). Band =
    YELLOW via G_carrier_overlap.
  - `oracle-scoring v0` — high similarity (same band-
    classifier pattern reused). Carrier overlap HIGH
    (same Aminata-Otto-Amara lineage). Independent evidence
    = Aminata's adversarial-pass literature (threat-
    modeling standards). Band = YELLOW via
    G_carrier_overlap.
  - `Aminata iteration-1 pass` — moderate similarity;
    cited as source of concerns; `cone(q) ∩ cone(y)`
    moderate. Independent oracles = Aminata is the
    adversarial-review persona. Band = YELLOW.

**Output-type for this doc as `q`:** `looks similar but
lineage-coupled`. The detector correctly identifies that
this doc's framings are NOT independent of its source
corpus; they inherit from Amara's 8th ferry + Aminata's
Otto-90 pass + Otto-98 spine. **The detector flags its
own lineage dependency without error.**

This is the signal: the detector catches its own
carrier-laundered convergence. Candidates #3's worth is
that it refuses to class "I agree with my own sources"
as `supported` — it knows it's lineage-coupled.

---

## What this doc does NOT do

- **Does NOT implement.** Specific F#/.NET module +
  embedding model + ANN library bindings are downstream
  design choices.
- **Does NOT adopt parameter values.** `τ_low`, `τ_med`,
  `θ_high`, `θ_med`, `α/β/γ/δ` weights are placeholders
  named for the ADR gate.
- **Does NOT replace human review.** Output bands inform
  review; Aminata / Codex / harsh-critic still run.
- **Does NOT claim completeness.** The detector catches
  SD-9-style carrier-laundered agreement. It does not
  catch every form of unsupported claim; other forms (outright
  fabrication without semantic match; novel category
  errors; coordinated deception) require other
  mechanisms.
- **Does NOT auto-promote PatternLedger status pins.**
  New `known-bad` entries are landed via governance-edit
  workflow + Aminata pass; not the detector's own
  classification history.
- **Does NOT extend beyond Zeta substrate.** Application
  to other substrates (lucent-ksk; external callers)
  requires its own design work; not this doc's scope.
- **Does NOT quantify precision / recall.** Empirical
  measurement is downstream work requiring a labelled
  test corpus that doesn't exist yet.

---

## Dependencies to adoption

In priority order:

1. **Aminata adversarial pass** on this detector design
   (fourth Aminata pass this session; cheap; anticipated
   concerns from her oracle-scoring Otto-90 pass already
   integrated).
2. **Candidate #4 `docs/EVIDENCE-AND-AGREEMENT.md`**
   operational promotion — teaches contributors how to
   interpret detector output-types in review practice.
3. **Independent-oracle substrate** for
   `G_evidence_independent` gate — specific implementations
   (test-output scraping; PR-link validators; citation-
   resolver for academic sources). Until this lands, the
   `evidence` signal is advisory-only.
4. **Parameter-change-ADR template** for threshold
   evolution — same schema as oracle-scoring v0
   parameter-ADR.
5. **PatternLedger event-stream implementation** as Zeta-
   module — uses KSK-as-Zeta-module template.
6. **Property tests** for band-determinism + replay-
   invariance.
7. **Embedding model + ANN library choice** — downstream
   ADR.
8. **F#/.NET module implementation** — gated on 1-7.

---

## Specific-asks (per Otto-82/90/93 calibration)

**None for Otto to proceed.** Design-stage work; no Aaron-
specific input needed until implementation gates engage.

Aminata pass is passive-expected; Otto doesn't block on
it; the pass will inform v1 revisions.

---

## Sibling context

- **8th-ferry absorb** (PR #274) — source of detector
  concept and output-type set.
- **Semantic-canonicalization spine** (PR #280, Otto-98)
  — substrate this builds directly on; layers 1-3
  delegated; layer 4 formalised here.
- **Oracle-scoring v0** (PR #266, Otto-91) — band-
  classifier pattern reused; parameter-change-ADR-gate
  pattern reused.
- **BLAKE3 receipt hashing v0** (PR #268, Otto-92) —
  parameter_file_sha binding extends to detector outputs.
- **Aminata Otto-90 pass** (PR #263) — 3 CRITICAL
  concerns addressed at write-time rather than pending
  post-land fixup.
- **Aminata Otto-94 iteration-1 pass on multi-Claude
  experiment** (PR #272) — similar write-time-integration
  pattern.
- **Quantum-sensing research doc** (PR #278, Otto-97) —
  analogies #2 (correlation) + #4 (decoherence) +
  #5 (salience) all operational in the detector's
  structure.
- **SD-9** (`docs/ALIGNMENT.md`) — detector is SD-9's
  mechanical implementation.
- **DRIFT-TAXONOMY pattern 5** (precursor doc:
  [`docs/research/drift-taxonomy-bootstrap-precursor-2026-04-22.md`](drift-taxonomy-bootstrap-precursor-2026-04-22.md))
  — detector is pattern-5 detection engine.
- **citations-as-first-class** — provenance graph the
  detector consumes.
- **KSK-as-Zeta-module 7th ferry** (PR #259) — event+view
  module template reused.

Archive-header format self-applied — 16th aurora/research
doc in a row.

Otto-99 tick primary deliverable. Closes 8th-ferry
candidate #3 of remaining 2.

**8th-ferry status after Otto-99:**

- ✓ #1 Quantum-sensing research doc (Otto-97)
- ✓ #2 Semantic-canonicalization spine (Otto-98)
- ✓ #3 Provenance-aware claim-veracity-detector (this PR,
  Otto-99)
- Gated #4 `docs/EVIDENCE-AND-AGREEMENT.md` future
  operational promotion (gated on #3 landing +
  Aminata pass)
- ✓ #5 TECH-RADAR 5-row batch (Otto-96)

**4/5 substantive responses closed.** Only #4
operational-promotion remains (gated). Matches 5th-
ferry 4/4-artifact-closure arc shape.
