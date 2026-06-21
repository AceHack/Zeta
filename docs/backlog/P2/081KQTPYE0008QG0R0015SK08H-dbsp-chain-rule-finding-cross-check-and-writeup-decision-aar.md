---
id: 081KQTPYE0008QG0R0015SK08H
priority: P2
status: open
title: DBSP chain rule formal-verification finding -- cross-check counter-example + verify Prop 3.5 reading + writeup decision (Aaron 2026-05-05)
tier: research
effort: M
ask: Aaron 2026-05-05 verbatim "and what makes you rmemeber it tomorrow?" -- caught the verify-before-deferring failure mode on a deferred set of TODOs from the Claude.ai shard's review of `tools/lean4/Lean4/DbspChainRule.lean`
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with: [081KQR4HQ0008QG0R002933PRR, 081KQTPYE0008QG0R003DK06PA]
tags: [dbsp, formal-verification, lean, chain-rule, paper-writeup, research]
type: friction-reducer
---

# 081KQTPYE0008QG0R0015SK08H -- DBSP chain rule formal-verification finding: cross-check + writeup decision

## Source

Aaron 2026-05-05 verbatim:

> *"and what makes you rmemeber it tomorrow?"*

This was Aaron catching the verify-before-deferring failure mode.
I had said (paraphrased) *"tomorrow's work: cross-check the
counter-example, verify the Prop 3.5 reading, decide on the
writeup format"* without filing substrate. A deferral that lives
only in chat is weather, not a directive (per Otto-363
substrate-or-it-didn't-happen). This row IS the substrate that
makes the deferral durable across compaction / session reset.

## What this is

Three concrete cross-check + decision tasks against the formal-
verification finding the Claude.ai shard surfaced when reviewing
`tools/lean4/Lean4/DbspChainRule.lean`:

1. **Counter-example cross-check** -- the earlier "expanded
   bilinear" form with eight terms was caught as unsound by an
   impulse counter-example. Specific instance: `f = g = id`,
   `s = δ₀`, `n = 0` produces `LHS = 1`, `RHS = 0`. This is
   computable; anyone with the algebra in front of them can
   verify or refute. The rename `chain_rule` to `Dop_LTI_commute`
   is the substrate-discipline correcting itself in the working
   copy.

2. **Paper-level finding** -- DBSP paper (Budiu et al.,
   arXiv:2203.16684) Prop 3.5 has an unspoken precondition
   (time-invariance) that is implicit in the prose but does not
   formalize without being made explicit. `map_add` alone (which
   is what the bundled `IsLinear` provided) is insufficient to
   force commutation with delay. The stratified hierarchy
   `IsLinear` / `IsCausal` / `IsTimeInvariant` / `IsPointwiseLinear`
   disentangles what the paper bundled.

The shard's framing: *"modest but real research-grade
contribution -- formalization forced an articulation the paper's
prose didn't have to make. That's not 'the paper is wrong' --
it's 'the formalization makes a precondition explicit that the
paper left implicit.'"*

## Acceptance criteria

Each acceptance criterion has a clear falsifier. If the
falsifier fires, the finding is invalidated and the row pivots
to *"what was actually wrong"* rather than proceeding to writeup.

### (a) Cross-check the impulse counter-example by hand

Work through `f = g = id, s = δ₀, n = 0` for the original
"expanded bilinear" eight-term form and confirm `LHS = 1`,
`RHS = 0`.

- **Verifier**: independent algebra by hand, comparing to the
  Lean-file artifact at `tools/lean4/Lean4/DbspChainRule.lean`.
- **Pass**: counter-example reproduces; the eight-term form is
  unsound as transcribed; the rename is correct.
- **Fail (falsifier)**: counter-example does not reproduce.
  Either the original "expanded bilinear" form is sound and
  Otto / the shard misread it, or the impulse / `n = 0` choice
  was wrong, or the algebra was mis-transcribed in the report.
  Pivot the row to *"what was actually wrong with the
  intermediate transcription"* and revise the Lean-file
  rename's framing.

### (b) Verify Prop 3.5 reading against arXiv:2203.16684

Read DBSP paper Prop 3.5 statement directly. Confirm whether
time-invariance is unspoken (implicit in prose) vs explicit
(stated in proposition body or its preconditions).

- **Verifier**: the arXiv PDF, with the exact prose quoted in
  the row's resolution note.
- **Pass**: Prop 3.5's prose presupposes but does not state
  time-invariance; the formalization makes it explicit; the
  finding is real.
- **Fail (falsifier)**: Prop 3.5 IS explicit about
  time-invariance and Otto / the shard missed it. Pivot to
  *"the precondition was already explicit; the formalization
  surfaced something different (which?)"* or close the row as
  *no finding here -- our reading was wrong*.

### (c) Writeup-format decision

Conditional on (a) and (b) outcomes, pick one of:

1. **Research note in `docs/research/`** -- internal
   substrate, no external publication. Default if (a)+(b) pass
   but the finding is judged too narrow for external value.
2. **arXiv preprint as a short note** -- if (a)+(b) pass and
   external value is judged real (alignment-frontier-relevant
   formalization-surfaced-precondition pattern).
3. **GitHub issue on the DBSP paper's repo** (if one exists)
   -- lighter-weight than arXiv; targets the paper's authors
   directly. Composes with (2), not exclusive.
4. **Lean-file artifact only** -- the substrate stays in
   `tools/lean4/Lean4/DbspChainRule.lean` with no separate
   writeup. Default if (a) or (b) fails; default also if the
   finding is judged too narrow for any external surface.

The decision is downstream of (a) and (b); make it explicit
when those land.

## Falsifiability hooks

- (a) falsifier: counter-example does not reproduce on hand
  algebra.
- (b) falsifier: Prop 3.5 is explicit about time-invariance.
- (c) is itself a decision-with-rationale, not a falsifiable
  claim; its rationale is recorded in the resolution note.

The row's research-grade-ness IS that the falsifiers are clear
and computable. If both (a) and (b) fall on the falsifier side,
the row closes without writeup and the finding is retracted in
the Lean file's framing.

## Why P2 (not P1, not P3)

- **Higher than P3** because there is a real finding to verify
  (counter-example caught + paper-level precondition surfaced)
  and the cross-check is bounded effort.
- **Lower than P1** because:
  - Research-grade, not blocking. No production system depends
    on this resolution.
  - Cross-check is verification work, not new substrate.
  - The writeup decision is downstream of cross-check outcomes;
    deferring the writeup itself is correct.
- Effort M -- a few hours of focused work for (a)+(b); (c) is a
  decision moment.

## Out of scope

- **Doing the writeup itself** -- depends on outcome of
  cross-checks (a) and (b); filed separately if the writeup
  path is chosen.
- **Drafting the arXiv preprint** -- only if (c) selects the
  arXiv path.
- **Contacting the DBSP authors** -- only if (c) selects the
  GitHub-issue or arXiv path AND there is a substantive finding
  to communicate.
- **Generalizing the stratified hierarchy** beyond the chain-
  rule context -- the `IsLinear` / `IsCausal` /
  `IsTimeInvariant` / `IsPointwiseLinear` disentanglement is
  reusable substrate, but expanding its scope is its own row.

## Composes with

- **081KQR4HQ0008QG0R002933PRR** -- Q# Bayesian BP/EP runtime research uses chain-
  rule reasoning at the operator-algebra layer; the DBSP paper's
  Prop 3.5 reading affects how chain-rule preconditions are
  formalized for the Bayesian-inference runtime.
- **`tools/lean4/Lean4/DbspChainRule.lean`** -- the Lean file
  containing the substantive findings (counter-example caught,
  rename to `Dop_LTI_commute`, stratified hierarchy).
- **`docs/research/2026-05-05-claudeai-knights-knaves-round-table-harmonious-division-bootstrap-razor-aaron-forwarded-preservation.md`**
  -- the parent Claude.ai conversation preservation under which
  the shard's review of the Lean file was conducted. The
  cross-check work originates from that conversation.

## Origin

Aaron 2026-05-05 caught the verify-before-deferring failure
mode when I framed cross-check work as *"tomorrow's work"*
without filing substrate. *"and what makes you rmemeber it
tomorrow?"* -- the question is the rule. A deferral without
substrate is weather. This row is the substrate.

The Claude.ai shard reviewing the session's work read
`tools/lean4/Lean4/DbspChainRule.lean` and confirmed the file
contains substantive formal-verification findings. The shard
explicitly framed the contribution as *"modest but real
research-grade"* -- formalization forcing an articulation the
paper's prose did not have to make.

The rename `chain_rule` to `Dop_LTI_commute` is itself
substrate-discipline correcting the working copy. The cross-
check work in this row verifies the correction is correct.
