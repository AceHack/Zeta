---
name: Missing-cadence activation audit — proposed / TBD-owner hygiene rows are themselves a tracked class; FACTORY-HYGIENE #43
description: Aaron 2026-04-22 "missing cadences for any items that should be reoccuring hygene we should add" — distinct from row #23 (missing-CLASSES we don't run at all). This class catches rows we AUTHORED but never ACTIVATED. Canonical evidence — row #23 itself is marked "(proposed)" and therefore could not catch attribution-hygiene (row #42) before Aaron did manually.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

**Rule.** Whenever a hygiene item, BP rule, skill, or audit
is **authored** with a declared cadence, it must also be
**activated** — a named owner, an active enforcement surface,
and a visible last-fire signal. Rows tagged `(proposed)` /
`TBD` / `pending` with no activation date are themselves a
hygiene failure. Row #43 in `docs/FACTORY-HYGIENE.md` is the
durable enforcement surface.

**Why.** Aaron 2026-04-22 after catching that
`docs/FACTORY-HYGIENE.md` row #23 ("Missing-hygiene-class
gap-finder") is itself marked `(proposed)` — so it never
fired, so it never caught row #42 (attribution hygiene)
before Aaron had to surface it manually:

> missing cadences for any items that should be reoccuring
> hygene we should add

Authoring is cheap; activation is work. Without an explicit
row tracking proposed-but-inactive hygiene, the factory's
paperwork drifts ahead of its practice. The factory starts
to look self-regulating on paper while in practice Aaron
still has to catch gaps by hand. That gap **is the failure
mode** — a factory that documents hygiene it doesn't run is
harder to trust than one that documents less but runs all of
it.

**How to apply.**

- **Every time an agent adds a row to `FACTORY-HYGIENE.md`
  or a BP-NN to `docs/AGENT-BEST-PRACTICES.md`** with a
  cadence tagged `(proposed)` or a TBD owner, also surface
  it for activation review (HUMAN-BACKLOG row or Architect
  notebook entry). Proposed-without-activation-trajectory
  is acceptable briefly — accepted state for routine
  bootstrap — but a proposed row with no activation date
  after 3+ rounds is a hygiene failure.
- **Distinguish from row #23.** Row #23 (missing-hygiene-
  class gap-finder) asks *"what hygiene are we not running
  at all?"* Row #43 asks *"what hygiene have we authored
  but not activated?"* Both point at the same meta-gap
  (factory-less-self-regulating-than-paperwork-suggests)
  from opposite directions.
- **Self-audit risk.** Row #43 itself is marked `(proposed)`
  at authoring time — this is the canonical example of what
  the row should catch. Honest reporting means flagging
  itself as a visible bootstrap risk in the row's "Checks"
  column.
- **Activation signals.** A cadence counts as activated
  when any of: (a) a skill `.claude/skills/<name>/SKILL.md`
  exists and declares itself the enforcement surface, (b) a
  CI hook fires the check, (c) a persona's notebook shows
  the cadence running with dated entries, (d) a pre-commit
  hook enforces it. Paper declaration in the row's text
  alone is not activation.
- **Bias to activate or retire, not park indefinitely.**
  A row that has been `(proposed)` for 5+ rounds without
  activation is probably either (a) load-bearing but
  blocked on a skill decision → escalate, or (b) not
  actually needed → retire via ADR. Park indefinitely is
  the worst option — it hides the gap.

**Known proposed / inactive rows at memory-write time
(2026-04-22):**

| Row | Class | Why still proposed |
|---|---|---|
| 22 | Symmetry-opportunities audit | Awaiting Aaron confirmation on discriminator |
| 23 | Missing-hygiene-class gap-finder | **ACTIVATED 2026-04-22** — first fire produced `docs/research/missing-hygiene-class-scan-2026-04-22.md`; interim owner Architect + Aarav; now "active with interim owner" |
| 35 | Missing-scope gap-finder (retrospective) | Candidate skill `missing-scope-finder` queued in BACKLOG P1 |
| 36 | Incorrectly-scoped gap-finder (retrospective) | Candidate skill queued alongside #35 |
| 42 | Attribution hygiene | New this round; on-touch active, sweep skill TBD |
| 43 | Missing-cadence activation audit | New this round; is its own canonical example |
| 44 | Cadence-history tracking hygiene | New this round (2026-04-22 after row #23 activation); Aaron: "else how can we verify it's cadence?" — closes meta-hygiene triangle with #23 (existence) and #43 (activation). Is its own canonical example — `(proposed)` with no fire-log yet. |

**Relationship to companion rules.**

- `feedback_missing_hygiene_class_gap_finder.md` — row #23
  parent. Row #43 is not a replacement — they catch
  complementary gaps.
- `feedback_attribution_hygiene.md` — row #42. The
  triggering concrete class that row #23 should have
  surfaced but couldn't (because row #23 itself wasn't
  activated).
- `feedback_imperfect_enforcement_hygiene_as_tracked_class.md`
  — meta-rule that imperfect-enforcement hygiene items are
  themselves a tracked class. Row #43 is the activation-
  status audit for all such items.
- `feedback_meta_wins_tracked_separately.md` — meta-wins
  log gets a row when row #43 catches a proposed-row that
  should have fired earlier. The 2026-04-22 round-#23-
  didn't-fire catch is the canonical first entry.
- `feedback_cadence_history_tracking_hygiene.md` — row
  #44 companion. Activation (row #43) and fire-history
  (row #44) compose: a row can only be audited for
  verification (#44) once it is active (#43). The two
  rows together plus row #23 (existence) form the meta-
  hygiene triangle.

**Triggering incident (verbatim, preserved per
preserve-original rule).**

Aaron 2026-04-22 during round 44 autonomous-loop work, after
I added row #42 (attribution hygiene) without first noticing
that row #23 already exists to catch exactly this class:

1. *"we alreday have missing hygene class hygene right?"* —
   pointing at row #23.
2. *"missing cadences for any items that should be
   reoccuring hygene we should add"* — pointing at the
   meta-gap that row #23 (and several other rows) are
   `(proposed)` with no activation.

The honest read: the factory has the right *concepts*
documented, but the cadence-enforcement bar is underset. A
proposed row that never activates is a structural false-
positive — it makes the factory appear more capable than
it is. Row #43 exists to raise the enforcement bar.
