---
name: Cadence-history tracking hygiene — every active cadenced row must have a structured fire-history surface; FACTORY-HYGIENE #44
description: Aaron 2026-04-22 "everything with a cadence should be track it history hygene make sure we got that one too" + "else how can we verify it's cadence?" — fire-history IS the cadence-verification mechanism. Without per-fire entries (date, agent, output, link, next-expected-date), a declared cadence is a claim without evidence. Closes the meta-hygiene triangle with rows #23 (existence) and #43 (activation).
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

**Rule.** Every **cadenced factory surface** with a declared
**active** cadence must have a **fire-history surface** where
each fire leaves a dated entry. Without a fire-log, the cadence
is unverifiable — a paper declaration that nobody can check.
Row #44 in `docs/FACTORY-HYGIENE.md` is the durable enforcement
surface.

**Scope — explicitly broader than FACTORY-HYGIENE rows
(2026-04-22 extension).** Row #44's original scope only named
`docs/FACTORY-HYGIENE.md` rows and BP-NN rules. Aaron's
second directive on the same round — *"you might as well right
a history record somewhere on every loop tool right before
you check cron"* — applied the rule to the autonomous-loop
cron tick, which was NOT a FACTORY-HYGIENE row but IS the
single most cadenced surface in the factory. The corrected
scope covers:

1. `docs/FACTORY-HYGIENE.md` rows with declared active cadence
2. BP-NN rules in `docs/AGENT-BEST-PRACTICES.md` with declared
   cadence
3. **Cron jobs** declared in `docs/factory-crons.md` (every
   row — `autonomous-loop`, `heartbeat`, `git-status-pulse`,
   any future additions)
4. **Round-open / round-close checklist items** declared in
   `.claude/skills/round-open-checklist/` and
   `.claude/skills/round-close-checklist/`
5. Any **other declared recurring obligation** named in docs
   / memory / skills (harness-surface cadenced audits per
   row #38, skill-tune-up sweeps, wake-briefing routines,
   etc.)

Canonical worked example at factory root:
`docs/hygiene-history/loop-tick-history.md` — the
autonomous-loop tick's fire-log, appended to every tick
immediately before the end-of-tick `CronList` call (see
`docs/AUTONOMOUS-LOOP.md` step 5). That file's schema is
the reference pattern for any per-surface fire-history
file.

**Why.** Aaron 2026-04-22 immediately after row #23 activation:

> everything with a cadence should be track it history hygene
> make sure we got that one too

And, when I acknowledged but under-emphasized the point:

> else how can we verify it's cadence?

That second message is the load-bearing logic. A cadence is
not a declaration — it is a **promise to fire with a period**.
A promise with no log is indistinguishable from a lie. Rows
#23 and #43 check for *existence* and *activation* of cadenced
hygiene items; row #44 is the only one of the three that lets
us *verify the cadence actually fires*. Without it, a row that
says "every 5-10 rounds" can sit for 30 rounds with nobody
noticing, while the factory's paperwork continues to claim the
hygiene runs.

The factory's credibility rests on the claim that it self-
regulates. A cadence without fire-history is the same failure
mode as a proposed row without activation — the paperwork
drifts ahead of the practice. Row #44 is the third leg of the
stool; without it, the meta-hygiene triangle is two-legged
and falls over.

**How to apply.**

- **Every time an agent fires a cadenced row**, leave a dated
  fire-entry on that row's designated history surface. The
  entry's minimum schema:
  **(date, agent, output-or-finding, link-to-durable-output,
  next-fire-expected-date-if-known)**. Shorter entries are
  compliance gaps; longer entries are fine.
- **Fire-history surfaces — pick one per row:**
  - (a) **Per-row history file** — `docs/hygiene-history/row-NN-<slug>.md`.
    Use when the row fires often enough that its history
    would overwhelm a shared surface.
  - (b) **Shared ledger** — e.g., `docs/research/meta-wins-log.md`
    for meta-check fires. Use when many rows fire rarely and
    a shared surface gives cross-row visibility.
  - (c) **Notebook section** — e.g., Aarav's notebook for
    row #5 (skill-tune-up) fires. Use when the row has a
    dedicated persona owner.
  - (d) **ROUND-HISTORY rollup** — per-round row in
    `docs/ROUND-HISTORY.md`. Use when the fire is short
    enough that it fits inline and the round close is the
    natural cadence trigger.
- **The row's "Durable output" column must name the surface.**
  Rows whose Durable output is ephemeral ("inline
  acknowledgement", "one-off finding with no home") are
  compliance gaps — either pick a surface or retire the
  cadence. There is no third option.
- **Distinct from rows #23 and #43:**
  - Row #23 (existence) — *what hygiene are we not running
    at all?*
  - Row #43 (activation) — *what hygiene have we authored
    but not activated?*
  - Row #44 (fire-history) — *of the classes we AUTHORED
    and ACTIVATED, can we prove they fire on cadence?*
  Each row catches a different structural failure mode.
  The three together form the meta-hygiene triangle and
  each is its own canonical example (self-audit risk).
- **Self-audit risk.** Row #44 itself is proposed at
  authoring time. First fire: an audit of every currently-
  active cadenced row in `docs/FACTORY-HYGIENE.md` checking
  whether its Durable output names a fire-history surface
  and whether that surface has recent entries matching the
  declared cadence. Expected output: some rows have
  history surfaces (row #5 → Aarav's notebook; meta-wins
  → `meta-wins-log.md`; round-close rows → ROUND-HISTORY);
  others don't and need one assigned.
- **Promotion / retirement decision.** A cadenced row that
  goes 2× its declared cadence without a new fire-log entry
  is either (a) not actually running → activate or retire
  via ADR, or (b) running but not logging → fix the logging
  discipline. Parking indefinitely is the worst option — it
  hides the gap.
- **Factory-scope, not shipped-scope.** The hygiene list
  itself is factory-internal. The *discipline* (fire-log
  for cadenced checks) ships to project-under-construction
  indirectly via any audit skill built to enforce this row.

**The meta-hygiene triangle — each row's self-audit risk:**

| Row | Catches | Self-audit example at authoring |
|---|---|---|
| 23 | Classes we don't run at all | Row #23 itself was `(proposed)` and therefore could not catch row #42 before Aaron did |
| 43 | Authored-but-not-activated rows | Row #43 itself is `(proposed)` at authoring — canonical example of what it catches |
| 44 | Active cadences with no verifiable fire-log | Row #44 itself is `(proposed)` at authoring and has no fire-log yet — canonical example |

**Leverage chain observed.**

Row #43 → surfaced row #23 as proposed-unactivated → row
#23 activation fired 6 candidates → 2 became BACKLOG P1
(dead-link hygiene, skill-eval coverage) → Aaron then
noticed that of the *already-active* cadenced rows, we
had no fire-history discipline → row #44.

Depth-3 leverage chain (row #43 → row #23 activation →
row #44 as follow-on). This is the exact structural
payoff the factory is built around: a meta-hygiene
mechanism surfaces a sibling mechanism, which then
exposes a further gap, which produces a new mechanism.
Meta-wins-log entry expected to upgrade to clean-depth-4
once row #44 has its first fire.

**Triggering incident (verbatim, preserved per
preserve-original rule).**

Aaron 2026-04-22 during round 44 autonomous-loop work,
immediately after row #23 activation landed:

1. *"everything with a cadence should be track it history
   hygene make sure we got that one too"* — asserts the
   class.
2. *"else how can we verify it's cadence?"* — makes the
   load-bearing logic explicit: fire-history IS the
   cadence-verification mechanism, not a nice-to-have.

The honest read: the factory had nailed *existence* and
*activation* but had a blind spot on *verification*. A
cadence without fire-history looks self-regulating on
paper but provides no evidence. Row #44 exists to raise
the verification bar and complete the triangle.

**Relationship to companion rules.**

- `feedback_missing_cadences_hygiene.md` — row #43
  sibling (activation tracker). Row #44 depends on row
  #43 having marked a row as active before row #44 can
  audit its fire-log — a row can't be audited for
  verification if it's not yet active.
- `feedback_missing_hygiene_class_gap_finder.md` — row
  #23 parent (existence tracker). The full triangle.
- `feedback_imperfect_enforcement_hygiene_as_tracked_class.md`
  — meta-rule. Row #44 is an imperfect-enforcement
  class by construction (no agent reads every fire-log
  every round); its enforcement shape is sample-audit,
  not exhaustive.
- `feedback_meta_wins_tracked_separately.md` — the
  meta-wins log is itself one of the fire-history
  surfaces row #44 can point at (shared-ledger shape
  (b)).
- `feedback_preserve_original_and_every_transformation.md`
  — per-fire entries are an audit trail; preserve-
  original applies to fire-entry text when an agent
  later wants to compress or summarize.

**Known bootstrap state at memory-write time
(2026-04-22):**

- Row #44 is `(proposed)` in `docs/FACTORY-HYGIENE.md`.
- No first-fire audit has run yet. First fire expected
  in round 45 round-close; output will be an audit doc
  at `docs/research/cadence-history-audit-YYYY-MM-DD.md`
  listing every currently-active cadenced row and
  whether its Durable output column names a fire-
  history surface.
- The row's own fire-history surface (once it becomes
  active): `docs/hygiene-history/row-44-cadence-history.md`
  (shape (a)) — because the audit runs per-round and
  the output is a full doc, a per-row history file is
  the right shape.
