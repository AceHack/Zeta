---
name: Operator-input quality log — symmetric counterpart to force-multiplication log; scores the quality of inputs arriving from Aaron / operator channel (direct directives, forwarded signals, research drops, capability asks); 1-5 rating across six dimensions; 2026-04-22
description: Aaron auto-loop-43 directive — keep a rolling quality score of operator inputs (research drops, directives, forwarded signals) so the factory has retrospective calibration on how much to trust wholesale absorption; first asked about deep-research-report.md quality then generalised to standing log; landed docs/operator-input-quality-log.md; six dimensions (signal-density / actionability / specificity / novelty / verifiability / load-bearing-risk); four classes (A maintainer-direct / B maintainer-forwarded / C maintainer-dropped-research / D maintainer-requested-capability); complementary to docs/force-multiplication-log.md which measures factory-to-operator signal quality.
type: project
---

# Operator-input quality log directive

Aaron 2026-04-22 auto-loop-43 multi-message directive:

> *"can you tell me how the quality of that research you
> received was?"*

> *"you should probably keep up with a score of the quality
> of the things im giving you or the human operator"*

> *"this is teach opportunity"*

> *"naturally"*

> *"if my qualit is low you teach me if its high i teach you"*

> *"eaither way Zeta grows"*

> *"i think from the meta persepetive most of the time"*

First message asked about a specific drop
(`deep-research-report.md`). Second message generalised
to a standing operator-channel quality log. Third through
fifth messages reframed the log from retrospective
scorecard to **teaching-direction selector**: low-quality
Aaron input = factory teaches Aaron; high-quality Aaron
input = Aaron teaches factory. Sixth and seventh messages
added the meta-property: **either direction grows Zeta**
— the loop has no dissipation direction, both arrows feed
the growth engine; true most-of-the-time (not
universally). This is why the log is load-bearing factory
infrastructure, not a housekeeping artifact.

**Why:** symmetry with `docs/force-multiplication-log.md`.
That log measures the *outgoing* signal quality — what the
factory produces and hands back to the operator. The
operator-input quality log measures the *incoming* signal
quality — what the operator (Aaron) sends in, what
research drops arrive via `drop/`, what third-party
forwards Aaron routes to the factory. Together the two
logs give bidirectional quality visibility. A factory
that scores its own outputs but not its inputs can't tell
if low output quality is its own fault or amplified noise
from low-quality input.

**How to apply:**

1. **Score load-bearing inputs only.** Not every Aaron
   chat message gets a row. Row-worthy = absorbed into
   substrate (memory, BACKLOG, research doc, ADR, code).
   Casual chat does not.
2. **Six dimensions** (each 1-5): signal density,
   actionability, specificity, novelty, verifiability,
   load-bearing risk. "Overall" is judgment, not
   arithmetic mean — reflects which dimensions mattered
   most for that input class.
3. **Four input classes:**
   - A: Maintainer direct (Aaron typed directive)
   - B: Maintainer forwarded (tweet / video / article
     Aaron routed to the factory)
   - C: Maintainer-dropped research (deposits into
     `drop/` per drop-zone protocol)
   - D: Maintainer-requested capability (Aaron asked the
     factory to check / build / verify something)
4. **Newest-first table** under "Running log" section in
   `docs/operator-input-quality-log.md`. Append at tick
   close when a row-worthy input was absorbed this tick.
5. **Teaching-direction use (primary).** The score is
   pedagogical direction-setter: low Overall (1.0-2.4) →
   factory teaches Aaron via chat (*"I read this as X
   because of ambiguity in clause Y — did you mean Z?"*);
   mid Overall (2.5-3.9) → bidirectional (partial absorb,
   open questions); high Overall (4.0-5.0) → Aaron
   teaches factory via substrate landing (memory / BACKLOG
   / research / ADR). The information flows both ways
   "naturally" (Aaron's word) and the score picks the
   direction this tick.
6. **Retrospective-calibration use (secondary).** Low-score
   inputs are not blocked — pattern monitoring: are
   A-class inputs consistently higher-quality than C-class?
   Do low-verifiability inputs correlate with high-novelty?
   Those signals tune absorption skepticism over time.
6. **Not published externally.** Maintainer-internal
   record, same surface class as operator force-
   multiplication-log.
7. **Seeded with inaugural C-class grade.** The Deep
   Research report Aaron dropped this tick got a 3.5 / 5
   (B+) — useful starting point on oracle-gate design
   and preservation strata, weak on citation
   verifiability and F# code quality. Full grading
   rationale embedded in the log file under "Inaugural
   grading".

## Composes with

- **`docs/force-multiplication-log.md`** — outgoing signal
  quality log. The two logs together are the factory's
  bidirectional quality-visibility surface.
- **`memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`**
  — the clean-or-better invariant this log measures
  against. Low-score inputs don't excuse low-quality
  emissions; they calibrate how much to rely on wholesale
  absorption.
- **`memory/feedback_aaron_terse_directives_high_leverage_do_not_underweight.md`**
  — why short Aaron messages score well on signal density;
  the log measures leverage not word count.
- **`memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md`**
  — Goodhart warning: if the factory starts optimising to
  make inputs look high-quality by inflating dimensions,
  the log is corrupted. Keep the dimensions outcome-tied
  (did acting on this input produce good substrate?).
- **`memory/project_aaron_drop_zone_protocol_2026_04_22.md`**
  — C-class inputs arrive via `drop/`; this log scores them
  at absorption time.
- **`memory/feedback_external_signal_confirms_internal_insight_second_occurrence_discipline_2026_04_22.md`**
  — external-signal-strength hierarchy already names
  algorithm-level / expert-level / human-level signal
  tiers; this log adds per-input quality on top of those
  tiers.

## NOT authorization for

- Scoring Aaron as a person. Scores inputs only.
- Gatekeeping absorption. Low-score inputs still get
  absorbed if they land in scope. The score is a
  retrospective read, not a filter.
- Replacing existing substrate discipline. Memories /
  BACKLOG / ADRs / research docs do their jobs; this log
  adds one dimension on top.
- Arithmetic-mean overalls. The "Overall" column is
  judgment reflecting which dimensions mattered for
  *this kind* of input; mechanical averaging hides
  that nuance.
- External publication. Maintainer-internal record.
- Goodhart-gaming: inflating dimensions to make inputs
  look higher-quality than the acting-on-them outcome
  warrants.
