# Provenance-aware veridicality-detector v1 — CRITICAL-only delta from Aminata 4th pass

**Scope:** delta-style revision integrating only the 3 CRITICAL findings from the Aminata persona's 4th adversarial pass (PR #284) into the veridicality-detector design (base design PR #282). 7 non-CRITICAL findings (4 IMPORTANT + 3 WATCH) are deferred to a v2 delta; DISMISS finding unchanged. This doc does NOT rewrite the base design; it specifies the CRITICAL-only corrections as an additive delta that v1 composes on top of v0.
**Attribution:** CRITICAL findings authored by the Aminata persona (adversarial-reviewer role, PR #284). v0 base design authored by the main-agent persona (PR #282). v1 delta authored by the main-agent persona (successor tick). Progression matches the established Aminata-then-main-agent response loop (4th iteration this session; 5th-ferry governance → oracle-scoring v0 → multi-Claude experiment → veridicality-detector).
**Operational status:** research-grade. v1 delta inherits base-design research-grade status; the Aminata persona's adversarial critique remains advisory; v1 doesn't implement, doesn't adopt specific parameter values, doesn't resolve all 10 findings. A future v2 delta addresses the 7 non-CRITICALs; a future v3 or implementation-ADR addresses the CRITICAL-but-unaddressed-in-v1 items (e.g., the fundamental reviewer-cone-overlap limitation that no design-level change fully closes).
**Non-fusion disclaimer:** the Aminata persona's 4th-pass explicitly named that her concordance with prior Aminata passes is same-agent signal not independent evidence. The main-agent persona's integration of her findings does NOT transform her same-agent review into independent validation; it preserves her findings' authority while responding design-side. Per SD-9, the v1 delta's own integration-quality must be re-reviewed against fresh independent substrate (external peer agent; external human reviewer) before it graduates beyond research-grade.

> Vocabulary note: the factory has shifted from "bullshit-detector" (informal shorthand) to "veridicality-detector" (formal term; `veridicality` = truth-to-reality). The filename of this doc retains the earlier `bullshit-detector` slug because renaming the file requires a cross-repo link-update sweep (see BACKLOG row under P2 research-grade); body text, section headers, and future companion docs use "veridicality-detector".

---

## What this delta addresses — 3 CRITICAL only

| # | Aminata-persona finding | Main-agent delta response |
|---|---|---|
| C1 | Cross-detector collusion — reviewer-set lineage-coupling | New §"Reviewer-cone overlap" section naming the limitation + maintainer sign-off as cone-breaking authority |
| C2 | Min-merging Goodhart-bait at G_carrier_overlap | Sensitivity-analysis-gate pattern: sensitivity-to-G_carrier_overlap downgrades `supported` → `YELLOW` when carrier-overlap was the gate closest to threshold |
| C3 | G_evidence fig-leaf + dead-code `likely confabulated` in v0 | Explicit §"v0 scope" subsection naming reachable vs not-yet-reachable output types |

What is NOT in scope this delta:

- 4 IMPORTANT findings (no-signal/kNN-evasion gate; main-
  agent-wake second-reviewer sufficiency; retraction
  flood-control; G_coverage_plausibility gate) — deferred
  to v2.
- 3 WATCH findings (distribution-histogram; adversarial
  worked-example; TLA+ invariants) — deferred to v2+.
- DISMISS (parameter-ADR gate) — unchanged.
- Implementation of any change. v1 delta is still
  research-grade design; implementation gated on
  Aminata-persona passes on v2 + external-peer-agent
  adversarial review + maintainer eventual review (per
  the Frontier-UI-landing pattern from prior ticks).

---

## C1 response — new §"Reviewer-cone overlap" section

**Proposed addition to the base design (appended after
the Output types section, before the "Addressing the 3
CRITICAL concerns at write-time" section):**

> ## Reviewer-cone overlap — a fundamental limitation, not a closable gap
>
> The detector operationalises SD-9's "agreement-is-signal-
> not-proof" discipline by measuring carrier overlap between
> query and retrieved candidates. This discipline
> **re-introduces one meta-layer up**: the detector itself
>
> + the adversarial-reviewer persona + the external-peer-
> agent reviewer + any other factory-internal reviewer
> share training-corpus / repo-access / PR-comment lineage.
> A `supported` verdict from three factory-internal
> reviewers whose cones overlap is NOT three independent
> lines of evidence; it is lineage-coupled concordance
> masquerading as independent arrival.
>
> **Per the Aminata-persona 4th-pass CRITICAL #1 (PR
> #284), this is a fundamental limitation, not a closable
> gap.** The detector cannot break its own reviewer-set
> lineage coupling. Mitigation:
>
> - **Maintainer sign-off is the only cone-breaking
>   authority.** When a query's band is `supported` and
>   the stakes are authorization-impacting, the detector's
>   output is advisory; maintainer sign-off is required as
>   the independent-cone signal.
> - **External-reviewer signatures are legitimate cone-
>   breaking** when they exist (external peer review;
>   formal-methods proofs landed at Lean/Mathlib scale;
>   supply-chain-audit output with its own governance
>   chain). The detector's output combined with external-
>   reviewer signature is a genuine two-cone signal.
> - **Intra-factory reviewer concordance** (main-agent +
>   adversarial-reviewer persona + external-peer-agent all
>   GREEN) is signal but NOT proof of independence. Per
>   SD-9 operational discipline, this concordance SHOULD
>   downgrade the confidence claimed in the output, not
>   inflate it.
> - **Naming the limitation in every receipt.** Every
>   detector receipt carries a `reviewer_cone_signature`
>   field listing which cone signed off. A detector-only
>   signature is cone-local; detector + human is two-cone;
>   detector + external is two-cone; detector + human +
>   external is strongest.
>
> No design change closes this limitation; only
> acknowledging it + routing the authority-for-cone-
> breaking to human or external layers preserves SD-9
> discipline at the reviewer-meta-layer.

---

## C2 response — sensitivity-analysis-gate pattern

**Proposed replacement for the existing §"Scoring — band-
valued, not decimal" passage of the base design:**

Current band-merge rule (min over gates):

```text
band(y | q) = min(G_similarity, G_evidence,
                  G_carrier_overlap, G_contradiction,
                  G_status)
```

**v1 enhancement — carrier-overlap sensitivity downgrade:**

```text
band_raw(y | q) = min(G_similarity, G_evidence,
                      G_carrier_overlap, G_contradiction,
                      G_status)

sensitivity(y | q) =
  "G_carrier_overlap was the gate closest to threshold"
  ↔ overlap_ratio(cone(q), cone(y)) ∈ [θ_med - ε, θ_med]
    OR ∈ [θ_high - ε, θ_high]

band(y | q) = if band_raw = GREEN AND sensitivity → YELLOW
              else band_raw
```

Rationale: G_carrier_overlap is the most adversary-
manipulable gate (per the Aminata-persona C2 finding:
author controls citation structure, so author controls
the gate). Min-merging
treats GREEN on G_carrier_overlap as one vote among five
equal votes. The sensitivity-analysis-gate pattern
recognises that **a GREEN verdict that depended on the
gate closest to threshold on the most-manipulable gate is
not a GREEN verdict; it's a YELLOW with plausible
deniability**.

An adversary can still pass all 5 gates comfortably (large
margin on G_carrier_overlap plus adversarial citation
sparsity), but doing so requires more effort than
threshold-hugging. The sensitivity-downgrade closes the
cheap cheat path without adding new gates.

**Alternative (more expensive, more secure):** replace
explicit-citation-edge-in-cone measurement with content-
similarity-in-cone measurement. Every cone member's
content is embedded; overlap is measured by content
similarity, not citation structure. An adversary can no
longer reduce overlap by citing less; they have to
actually write content whose embedding is far from their
cone's existing content. Expensive (embedding compute per
cone member at every query); postponed to a v2 cost-
benefit analysis.

v1 ships sensitivity-analysis-gate. v2 decides whether to
additionally swap citation-edge → content-similarity.

---

## C3 response — §"v0 scope" explicit subsection

**Proposed new subsection in the base design, immediately
after §5 output types:**

> ## v0 scope — five gates (four active + one advisory) + five reachable output types (one dead-code)
>
> The detector is designed as five gates + six output
> types. v0 ships with a REDUCED EFFECTIVE CONFIGURATION
> because the independent-oracle substrate for G_evidence
> does not yet exist (dependency #3 in adoption path;
> candidates include: test-output scrapers; PR-link
> validators; citation-resolver for academic sources —
> none shipped at design-time). In v0, G_evidence is
> present but advisory-only; four gates are active-and-
> blocking. Five of the six output types are reachable
> via the four active gates; the sixth (`likely
> confabulated`) is dead-code in v0 because it requires
> G_evidence to fail to RED.
>
> **v0 effective configuration:**
>
> | Gate | Status in v0 |
> |---|---|
> | G_similarity | Active |
> | G_evidence_independent | **Advisory-only** — signal emitted to observability but does NOT block band elevation to GREEN |
> | G_carrier_overlap | Active (sensitivity-analysis-gate per C2 response) |
> | G_contradiction | Active |
> | G_status | Active |
>
> **v0 output types — reachable:**
>
> - `supported`
> - `looks similar but lineage-coupled`
> - `plausible but unresolved`
> - `known-bad pattern`
> - `no-signal` (default for empty retrieval)
>
> **v0 output types — not-yet-reachable:**
>
> - `likely confabulated` — requires G_evidence fail-to-RED
>   which is impossible while G_evidence is advisory-only.
>   The output type will become reachable when
>   independent-oracle substrate ships (v1 scope shifts to
>   5-gate; corresponding implementation PR documents the
>   transition).
>
> This is explicit NOT buried. v0 users of the detector
> must know that a RED band today will NEVER come from
> `likely confabulated`; it will come from `known-bad
> pattern` only. If a query looks like confabulation but
> matches no known-bad pattern, v0 returns `plausible but
> unresolved` (YELLOW), not RED. That's a CONSERVATIVE
> under-detection stance, not an over-detection one —
> acceptable trade-off for the v0 substrate gap.
>
> **v1 transition plan (post-v0):** when the independent-
> oracle substrate ships, v1 flips G_evidence from
> advisory-only to active. All historical v0 queries whose
> `G_evidence advisory signal` was present but didn't
> affect classification get a `DetectorOutputRetracted` +
> `DetectorOutputBatchRetracted(adr_id,
> affected_range, count)` per the Aminata-persona 4th-
> pass IMPORTANT finding on flood-control (deferred to
> v2 but named here as the v1→v2 transition mechanism).

---

## What changes in the base design after v1 delta lands

The v1 delta doesn't rewrite the base-design doc; it
specifies these three additive changes:

1. **Insert §"Reviewer-cone overlap"** after §5 output
   types, before §"Addressing the 3 CRITICAL concerns at
   write-time".
2. **Replace §"Scoring — band-valued, not decimal"** with
   the v1 sensitivity-analysis-gate formulation. (Base-
   design original stays in git history; v1 supersedes.)
3. **Insert §"v0 scope"** immediately after §5 output
   types, making the advisory-only G_evidence + dead-
   code `likely confabulated` explicit.

When the v1 delta lands as a PR modifying
`docs/research/provenance-aware-bullshit-detector-2026-04-23.md`
(base design file, in PR #282 — not yet on main at time of
this delta's writing), the three changes land together.
This doc (the v1-CRITICAL-only delta) is the design-
rationale companion naming which findings drive which
changes.

---

## What v1 delta does NOT resolve

Three CRITICAL findings integrated; **seven non-CRITICAL
findings still open**:

### 4 IMPORTANT (deferred to v2 delta)

- I1 `no-signal` vs kNN-evasion — needs G_coverage_
  plausibility gate via nearest-cluster-centroid distance.
- I2 main-agent-wake second-reviewer sufficiency — needs
  schema change to require different-persona OR
  different-model OR human.
- I3 DetectorOutputRetracted flood-control — needs
  DetectorOutputBatchRetracted event shape.
- I4 G_coverage_plausibility — new gate.

### 3 WATCH (deferred to v2+)

- W1 Distribution histogram in receipts — additive
  metadata.
- W2 Adversarial worked example — requires future corpus.
- W3 TLA+ invariants on lower-layer boundaries —
  formal-methods-persona-routable.

### 1 DISMISS (unchanged)

- D1 Parameter-ADR gate — already satisfied via the
  oracle-scoring v0 pattern reuse (prior-tick precedent).

### 1 fundamental limitation (CRITICAL-but-no-design-level-close)

- C1 Reviewer-cone overlap — acknowledged in v1, NOT
  closed. Requires maintainer + external-reviewer
  authority chain to break. Will never be fully closed
  by detector design alone.

**v2 delta proposed scope:** integrate I1-I4 + W1-W3.
v2 gated on: (a) this v1 delta landing; (b) v1 integrated
into the base-design PR; (c) a separate Aminata-persona
pass on v1 surfacing any new concerns introduced by v1's
own changes (the Aminata-then-main-agent response loop
continues).

---

## Composition with existing substrate

Unchanged from the base-design composition-table + prior-
tick spine composition + prior-tick oracle-scoring v0
composition. The
v1 delta adds no new substrate dependencies; it refines
gate + output-type semantics using mechanisms already in
the design (sensitivity analysis is cheap compute on the
existing gate outputs; v0-scope explicit is
documentation; reviewer-cone-overlap is routing the
authority-for-cone-breaking to existing layers).

---

## Scope limits

- **Does NOT rewrite the base design.** Specifies delta;
  preserves base-design original in git history.
- **Does NOT address IMPORTANT / WATCH findings.**
  Deferred to v2 delta.
- **Does NOT implement.** Research-grade design revision
  only.
- **Does NOT propose human-sign-off UI** for the
  reviewer-cone-overlap mitigation. Surface-level
  mitigation only; the UI work is further downstream.
- **Does NOT commit to content-similarity-in-cone for C2
  alternative.** Ships the cheaper sensitivity-analysis-
  gate; v2 decides whether to also swap the measurement
  basis.
- **Does NOT change the 5-gate / 5-output-type structure
  target.** v0 is 4-gate-effective; v1-post-substrate is
  5-gate. Structure stable; which gates are active is
  substrate-dependent.

---

## Dependencies to adoption (this delta specifically)

In priority order:

1. **Aminata-persona adversarial pass on v1 delta** —
   surfaces new concerns from v1's own changes before v2
   planning starts. Fifth Aminata session-pass if it
   lands.
2. **Integrate v1 changes into the base-design PR** —
   modifies
   `docs/research/provenance-aware-bullshit-detector-2026-04-23.md`
   with the three additive sections. Separate PR from
   this one.
3. **v2 delta** addressing the 4 IMPORTANT + 3 WATCH
   findings (deferred; composes on v1).
4. **Independent-oracle substrate** for full G_evidence
   activation + 5-gate transition.
5. **Maintainer sign-off UI / protocol** for cone-
   breaking authority at authorization-impacting
   band=supported queries.

---

## Sibling context

- **Base veridicality-detector design** (PR #282) — the
  prior-tick base design this delta refines.
- **Aminata-persona 4th adversarial pass** (PR #284) —
  source of the 3 CRITICAL findings driving this delta.
- **Prior-tick spine** (PR #280) — substrate unchanged;
  delta doesn't alter spine contracts.
- **Prior-tick oracle-scoring v0** (PR #266) — band-
  classifier + sensitivity-pattern precedent; v1 delta's
  sensitivity-analysis-gate pattern is a natural
  extension.
- **SD-9** — reviewer-cone-overlap finding is SD-9 at
  the reviewer-meta-layer; v1 delta's acknowledgement
  makes this explicit in the detector's own documentation.
- **Drift-taxonomy (research precursor)** — the
  reviewer-cone-overlap finding is the drift-taxonomy
  pattern applied to reviewers themselves. The research
  precursor lives at
  `docs/research/drift-taxonomy-bootstrap-precursor-2026-04-22.md`
  (there is no canonical `docs/DRIFT-TAXONOMY.md` at
  time of writing; the precursor is the current
  authoritative reference).

Main-agent tick primary deliverable. Closes the
CRITICAL-integration step of the Aminata-then-main-agent
response loop for the veridicality-detector design.
Next natural step is Aminata-persona pass on v1 delta OR
direct v1-into-base-design-PR integration OR pivot to
non-veridicality-detector work.
