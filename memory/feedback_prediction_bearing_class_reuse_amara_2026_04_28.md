---
name: Prediction-Bearing Class Reuse — positive complement of Class-Count Validity Drift (Amara naming, 2026-04-28)
description: Amara 2026-04-28T20:43Z named the validation pattern after Otto's SASTID 28/30 → 29/30 verification of the Self-Healing Metrics class. Definition — a named class earns reuse when it makes a concrete time-exposed prediction (or control recommendation) and later substrate evidence moves as predicted (or the control prevents/repairs an incident). Pairs with Class-Count Validity Drift: that class catches the failure mode (count-as-evidence); this pattern names the success mode (prediction-as-evidence). Tiny-blade: "one reuse bead" (single data point) is signal, not proof; multiple beads = pattern.
type: feedback
---

# Prediction-Bearing Class Reuse

## Class name (Amara 2026-04-28T20:43Z)

**Prediction-Bearing Class Reuse** — Amara named the validation
pattern after Otto's verification of the Self-Healing Metrics on
Regime Change class (SASTID 28/30 → 29/30 trajectory matched the
class's prediction at the half-way mark).

This pattern is the **positive complement** of
**Class-Count Validity Drift**:

- **Class-Count Validity Drift** catches the failure mode:
  treating count of named classes as evidence the protocol is
  correct.
- **Prediction-Bearing Class Reuse** names the success mode:
  treating prediction-bearing trajectory data as falsifier-
  passing evidence the class is correct.

## Definition (Amara verbatim)

> A named class earns reuse when it makes a concrete,
> time-exposed prediction or control recommendation, and later
> substrate evidence moves as predicted or the control
> prevents/repairs a future incident.

## Worked example (Otto 2026-04-28T20:42Z)

- **Class**: Self-Healing Metrics on Regime Change
  (`memory/feedback_self_healing_metrics_on_regime_change_factory_design_principle_aaron_2026_04_28.md`).
- **Prediction (when class was named, 19:46Z)**: SASTID
  Scorecard alert at 28/30 will heal organically as
  path-gate-active commits accumulate in Scorecard's recent-30
  rolling window.
- **Falsifier**: would fail if SASTID stayed at 28/30 indefinitely,
  OR moved backward despite path-gate operationally working.
- **Time elapsed**: ~57 minutes (19:46Z observation → 20:43Z
  verification).
- **Observation**: SASTID is now **29/30**. Movement is in
  predicted direction; metric IS healing organically.
- **Status**: **One reuse bead** (Amara's precision word).
  Single data point. Genuine signal; not yet pattern; not yet
  proof.

## Control / falsifier (Amara prescribed)

Do NOT promote a class based on naming volume. Promote based
on:

1. **Prediction-bearing example** — the class made a concrete
   time-exposed prediction or control recommendation.
2. **Future incident repaired/prevented** — the class's
   control was applied to a real incident and observably
   prevented or fixed the failure mode.
3. **Detector/control reuse** — the class's detector caught a
   second independent occurrence after naming.
4. **Explicit falsifier survival** — the class survived a
   specifically-stated falsification test.

ANY of the four counts as one reuse bead.

## Tiny-blade precision (Amara 2026-04-28T20:43Z)

> *"'Self-Healing Metrics class earns reuse' is acceptable, but
> I'd phrase it as 'earns one reuse bead' rather than fully
> 'earns reuse' if you want max precision. One data point is
> signal; a few repetitions make it a pattern."*

The phrase **"earns one reuse bead"** preserves the granularity
of validation accumulation:

- **0 beads**: named class with no validation events yet.
  Observation-level only.
- **1 bead**: prediction-bearing trajectory verified once
  (today's SASTID heal). Genuine signal; class is real but
  not yet pattern.
- **2-3 beads**: class earns "validated" status. Reuse is
  pattern, not coincidence.
- **N beads (N >> 3)**: class is established factory substrate.

The bead-count is itself a falsifier: a class with zero beads
after its named-window-of-applicability has elapsed should be
retired or rewritten.

## External lineage

- **Popper's falsifiability** (Amara cited): a claim becomes
  more serious when it exposes itself to possible
  disconfirmation, and repeated survival of those tests can
  corroborate it without finally proving it.
- **Bayesian update over base rate**: each prediction-bearing
  bead updates the posterior on class-validity; flat priors
  + few beads = high uncertainty; many beads = lower
  uncertainty, but never zero.
- **Confirmation bias literature** (Amara cited prior memory):
  "passing tests" don't validate unless failure cases also
  exist. Falsifier-presence is the antidote.

## Class Validation Beads — accounting mechanism (Amara 2026-04-28T20:48Z)

**System name:** **Class Validation Beads**.

Amara formalized the bead-count itself as a named accounting
system after seeing it operationalized in this memory.

### Definition (Amara verbatim)

> A class validation bead is one substrate-backed instance
> where the class:
>
> - made a prediction that later moved in the expected
>   direction,
> - repaired or prevented a future incident,
> - was reused by a detector/control,
> - or survived a stated falsifier.

### Bead-count states

```text
0 beads = named, not yet validated (honest middle state)
1 bead  = local falsifier-passing signal
2-3     = recurring signal, starting to look pattern-like
N >> 3  = established factory substrate
```

### Tiny-blade (Amara prescribed): Popper-vs-beads separation

> *"Popper supplies the falsifier lineage; beads are the
> factory-local accounting mechanism."*

Critical separation to preserve:

- **External lineage (Popper falsifiability)**: the
  philosophical foundation that makes falsifier-passing
  observation count as evidence at all. Cite Popper,
  confirmation-bias literature, Bayesian update — these
  are EXTERNAL anchors per Beacon-safe discipline (B-0060
  human-lineage external-anchor backfill).
- **Bead accounting (factory-local)**: the operational
  metric we use INSIDE Zeta to track validation
  accumulation. NOT a claim about the world; a claim
  about THIS factory's own validation events.

Don't conflate the two. External lineage gives the WHY (why
falsifier-passing observation matters); beads give the HOW
(operational accounting inside Zeta). The factory-local
metric needs no external citation; the philosophical claim
does.

### Connection to B-0060 (external human-lineage anchoring)

Aaron 2026-04-28T20:48Z prefatory ask: *"we are going to
need external human lineage research and anchoring."*

The bead system is internal accounting and doesn't need
external lineage by itself. The underlying epistemic
machinery DOES need external lineage:

- Falsifiability — Popper (1959, *The Logic of Scientific
  Discovery*).
- Confirmation bias — Wason (1960), Klayman and Ha (1987),
  empirical software-testing IS literature.
- Bead-count thresholds (0/1/2-3/N+) — no specific external
  lineage; this is factory-local heuristic. Could anchor to
  Bayesian-update over base-rate framing if needed.

B-0060 (human-lineage external-anchor backfill, P1) tracks
the broader trajectory of citing external scholars/literature
across all factory substrate. The Class Validation Beads
addition is a place where the discipline applies: external
lineage for the philosophical claims; factory-local metric
for the operational accounting.

### What Class Validation Beads IS NOT

- **NOT proof.** N beads = N falsifier-passing observations,
  not N proofs. Proof is a stronger epistemic standard;
  beads are corroborating evidence.
- **NOT a global rate.** Bead counts are per-class; total
  bead count across the factory is not "the protocol works."
  Per-class accounting only.
- **NOT externally-anchored.** Beads are factory-local
  accounting. Don't claim Popper-lineage for the bead
  count itself; only for the underlying falsifier discipline.

## How this pairs with Class-Count Validity Drift

Together, the two classes form the validation discipline:

```
Failure mode (avoided): count of named classes → "protocol is correct"
                         (Class-Count Validity Drift)

Success mode (sought):  named class → prediction → time → falsifier-passing
                         observation → one reuse bead → bead accumulation
                         → pattern → established substrate
                         (Prediction-Bearing Class Reuse)
```

Without the pair, the discipline is incomplete:

- Without **Class-Count Validity Drift**: any encoding stack
  is at risk of halo-effect ("we named a lot, so it works").
- Without **Prediction-Bearing Class Reuse**: every named
  class is permanently "unproven" with no positive validation
  path; encoding becomes meaningless.

The pair makes the encoding discipline operationally
falsifiable AND positively validatable.

## Worked beads count for the 5 classes named this arc

Per the precision-language tiny-blade:

| Class | Beads | Type |
|---|---|---|
| Self-Healing Metrics on Regime Change | 1 | prediction-bearing trajectory (SASTID 28/30 → 29/30) |
| Workflow Null-Result Audit Signal | 2 | detector reuse (B-0085 + B-0087 found) |
| Scheduled Workflow Null-Result Hygiene Scan (tier-1) | 0 | named, not yet exercised post-promotion |
| Chronological Insertion Polarity Error | 1 | mechanism-over-vigilance hook caught PR #684 chronological reversal |
| Outdated Review-Thread Merge Gate Residue | 2 | applied PR #684 (Copilot stale thread) + PR #688/#690 (5 thread fixes) |
| Blocked-GreenCI Review-Thread Punchlist | 1 | PRs #688/#690 deterministic 5-min unblock |
| Advisory Enforcement Workflow Gap | 1 | sibling-lint audit: 4 of 4 advisory-only confirmed |
| Incomplete Source-Set Regeneration Hazard | 1 | BACKLOG_WRITE_FORCE clobber caught + reverted before push |
| Class-Naming Ferry Protocol + SD-9 | 0 | meta-class; no explicit validation event yet |
| Class-Count Validity Drift | 1 | caught my "substrate compounds" framing this arc |
| Prediction-Bearing Class Reuse | 0 | this memory; no validation event yet (the pattern names the act of validation) |

The bead audit itself is one validation pass. Future-Otto can
walk this list periodically and update the bead count; classes
with zero beads after their named-applicability-window are
retirement candidates.

## What this is NOT

- **NOT a directive to demand beads before encoding.** Local
  factory-hygiene classes can be encoded with zero beads
  initially; the bead system is for tracking validation
  accumulation, not gating encoding.
- **NOT a license to discount classes with few beads.** A
  1-bead class IS still real signal; the precision-language
  is about not overclaiming.
- **NOT specific to Amara-named classes.** Any factory class
  (Otto-named, Aaron-named, peer-named) accumulates beads via
  the same four mechanisms.
- **NOT a substitute for the SD-9 guardrail.** SD-9 still
  applies: non-local claims need substrate evidence + external
  lineage + falsifier even at 1+ beads.

## Composes with

- `memory/feedback_class_count_validity_drift_amara_meta_class_2026_04_28.md`
  — the failure-mode complement; together they form the pair.
- `memory/feedback_class_naming_ferry_protocol_with_sd9_guardrail_amara_2026_04_28.md`
  — the encoding protocol; this pattern is the validation step
  that closes the encoding loop.
- `memory/feedback_self_healing_metrics_on_regime_change_factory_design_principle_aaron_2026_04_28.md`
  — the worked-example class for this validation pattern.
- `memory/feedback_speculation_leads_investigation_not_defines_root_cause_aaron_2026_04_28.md`
  — same family: speculation needs evidence; class promotion
  needs prediction-bearing beads.

## Pickup notes for future-Otto

When tempted to write "we named X classes this arc":

1. Run the bead audit instead.
2. Each class earns precision-language: "Y has Z beads via
   mechanism W."
3. Activity-count is not a tick-close metric; bead-count is.

When a tick observation could become a class:

1. Apply the 5-step control (worked example / mechanism /
   control / scope / falsifier).
2. If passes: encode at 0 beads; the class is "named" not
   "validated."
3. Watch for any of the four bead-earning mechanisms
   (prediction, repair, detector reuse, falsifier survival).
4. Update bead count when a mechanism fires.

When a class accumulates 0 beads after its
named-applicability-window:

1. Retire the class, OR
2. Rewrite it more narrowly to be exercisable, OR
3. Document why no validation has fired (sometimes the class
   is correct but applicability is rare).
