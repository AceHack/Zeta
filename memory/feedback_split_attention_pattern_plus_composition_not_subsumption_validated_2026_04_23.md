---
name: Split-attention pattern + composition-not-subsumption distinction both validated at Otto-75 close — Aaron endorsed the full three-PR tick-close framing
description: Aaron "i love all this" on the Otto-75 tick-close description explicitly naming (a) split-attention working under load and (b) PR #228 vs cross-harness-mirror-pipeline composing rather than subsuming — keep both patterns deliberate in future ticks
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-23 Otto-76 response to Otto-75 tick-close
(verbatim):
*"i love all this"* — quoting my tick-close text:
> *"Otto-75 tick closed with the split-attention pattern
> working under load: the primary Govern-stage backfill (PR
> #227) and the mid-tick Codex-first-class directive-absorb
> (PR #228) both landed + tick-history row (PR #229) filed in
> the same tick. The BACKLOG row deliberately distinguishes
> session-operation parity (this directive) from the existing
> skill-file-distribution cross-harness-mirror-pipeline row —
> they compose, neither subsumes the other."*

## The rule

Two operational patterns were endorsed together here; both
keep.

**(1) Split-attention pattern** — when a mid-tick directive
arrives while primary tick work is in progress, absorb and
land **both** rather than dropping the primary or deferring
the directive. Land the primary substrate AND file the
directive as a BACKLOG row + memory AND close the tick-history
row — all in the same tick. Already captured in
`feedback_split_attention_model_validated_phase_1_drain_background_new_substrate_foreground_2026_04_24.md`
(Otto-72), now reinforced at Otto-76.

**(2) Composition-not-subsumption distinction** — when new
work looks adjacent to existing substrate, explicitly decide:
does this **subsume** the existing thing, or does it
**compose** with it? Two rows that cover different layers (PR
#228 session-operation-parity vs. existing cross-harness-
mirror-pipeline skill-file-distribution) should stay separate
because they exercise different mechanisms; consolidating into
one row would hide the distinction and force one row to over-
reach. Consolidate only when two rows genuinely cover the same
layer.

## Why each matters

- **Why split-attention.** A tick that drops primary work to
  absorb directives loses the tick's primary substrate.  A
  tick that defers directives until next tick leaves the
  directive's context (Aaron's verbatim, current setup, etc.)
  to age before it's captured. Both are lossy. Split-attention
  lands both cleanly.
- **Why composition-not-subsumption.** Subsumption hides
  distinctions — a reader later has to reverse-engineer which
  concerns were collapsed. Composition is explicit: two rows,
  each naming one concern, with a cross-reference making the
  relationship visible. Future-Otto thanks present-Otto for
  the explicit decision.

## How to apply

- **Split-attention triggers** when a new directive arrives
  mid-tick AND the primary work is already in flight.
  Foreground = primary; mid-tick-background = directive
  absorb. Both land as separate PRs; tick-history row covers
  both.
- **Composition check** applies any time a new BACKLOG / memory
  / doc row looks like it might overlap with existing
  substrate. Ask: *is this the same layer and same
  mechanism?* If yes, update the existing row. If **either**
  layer or mechanism differs, file a new row with explicit
  cross-reference to the sibling and scope-limit language that
  prevents readers from conflating them.

## What this does NOT authorize

- Proliferation of rows for the same concern. Composition is
  NOT a license to split every row — only when there's a
  genuine layer / mechanism distinction.
- Deferring absorb indefinitely. Split-attention still runs to
  completion in the tick it triggers; it's not license to
  stretch directive-absorb across multiple ticks.
- Treating every endorsement as a new rule. Aaron's "i love
  all this" validated the specific framings in the tick-close
  — split-attention + composition discipline. It's not a
  blanket endorsement of everything Otto-75 did.

## Sibling memories

- `feedback_split_attention_model_validated_phase_1_drain_background_new_substrate_foreground_2026_04_24.md`
  — the first split-attention validation (Otto-72). This
  memory reinforces + broadens.
- `feedback_deterministic_reconciliation_endorsed_naming_for_closure_gap_not_philosophy_gap_2026_04_23.md`
  — similar shape (Aaron endorsed a phrasing, it became
  canonical).
- `project_retractability_by_design_is_the_foundation_licensing_trust_based_batch_review_frontier_ui_2026_04_24.md`
  — retractability is the design foundation; split-attention
  + composition are operational consequences of it (future-self
  can always retract a row that turned out to be the wrong
  split).

**Source:** Aaron Otto-76 message quoting Otto-75 tick-close
verbatim + endorsement.
