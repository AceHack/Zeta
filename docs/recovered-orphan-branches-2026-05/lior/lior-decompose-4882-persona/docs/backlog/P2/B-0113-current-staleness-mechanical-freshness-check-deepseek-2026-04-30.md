---
id: B-0113
priority: P2
status: open
title: Mechanical CURRENT-staleness check — same-tick-update discipline as enforced rule, not vigilance (Deepseek 2026-04-30)
tier: factory-hygiene
effort: S
ask: Deepseek peer review 2026-04-30 — the same-tick CURRENT-update discipline currently relies on agent memory of whether the rule fired. A 4-day staleness gap on `memory/CURRENT-aaron.md` was caught only because Deepseek flagged it during peer review, not by mechanism. The rule needs a mechanical trigger.
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
composes_with:
  - PR-934
  - feedback_otto_341_lint_suppression_is_self_deception_noise_signal_or_underlying_fix_greenfield_large_refactors_welcome_training_data_human_shortcut_bias_2026_04_26.md
tags: [deepseek-2026-04-30, current-files, mechanism-not-vigilance, freshness-check, factory-hygiene, peer-review-finding]
type: friction-reducer
---

# B-0113 — Mechanical CURRENT-staleness check

## Source

Deepseek peer review of the 2026-04-30 substrate-landing session
(forwarded by Aaron 2026-04-30T~PM):

> *"CURRENT-aaron.md is 4 days stale. This is a real gap. The
> file exists specifically to prevent cold-start agents from
> needing to read the full memory index. If it's 4 days behind
> ... a cold-starting agent will make decisions on incomplete
> context. The same-tick CURRENT-update discipline needs a
> mechanical trigger, not an agent's memory of whether it
> remembered. A pre-commit hook that checks the last-modified
> date of CURRENT-aaron.md against the newest memory file and
> warns if the gap exceeds 24 hours would close this."*

## Why this matters

CURRENT-*.md files are the **fast-path projection** of
currently-in-force rules per maintainer. Per CLAUDE.md
session-bootstrap protocol:

> *"Fast-path on wake: read any `CURRENT-<maintainer>.md`
> files ... before the raw `feedback_*.md` ... log."*

If CURRENT-aaron.md is stale, cold-starting agents read an
outdated projection and make decisions on incomplete context.
The same-tick-CURRENT-update rule (codified in CURRENT-aaron.md
itself: *"When a new memory updates a rule here, I update this
file in the same tick. If I don't, this file is lying by
omission."*) currently depends on the agent's memory of whether
the rule fired — vigilance, not mechanism.

The 2026-04-30 session caught a 4-day staleness only because
peer-AI review flagged it. Without that catch, the gap could
have persisted indefinitely.

## Proposed mechanism

Two design alternatives:

1. **Pre-commit hook** (`tools/hygiene/check-current-freshness.sh`):
   - For each `CURRENT-<name>.md` file, compute its last-modified
     date (via `git log -1 --format='%ad' --date=short`).
   - For each `memory/feedback_*.md` file referencing the same
     maintainer name (heuristic: filename contains `<name>` or
     `aaron`/`amara`/`ani`), compute newest-modified date.
   - If newest feedback file is more than 24 hours newer than
     the CURRENT file, fail with diagnostic.
   - Allowlist: explicit override comment in CURRENT file's
     frontmatter or footer ("staleness-tolerated until <date>")
     for cases where the staleness is intentional.
2. **CI lint job** (`.github/workflows/gate.yml` extension):
   - Same logic as hook but runs in CI, not pre-commit.
   - Trade-off: catches at PR time vs commit time. CI is less
     aggressive (allows local commits that are stale, fails the
     PR).

Hook is more aggressive (block commit); CI is less aggressive
(allow commit, block merge). Either is mechanism-not-vigilance.

The 24-hour threshold is a starting point — could be tighter
(12 hours) for high-velocity rounds or looser (72 hours) for
low-velocity periods. Deepseek's 24-hour suggestion is a
reasonable default.

## Composes with

- **Otto-341 lint-suppression discipline** — the rule's response
  to a stale-CURRENT failure should be "fix the staleness," not
  "suppress the lint." The hook's diagnostic output should make
  the fix path obvious.
- **Otto-363 substrate-or-it-didn't-happen** — the CURRENT file
  is the substrate projection; staleness is the projection
  drifting from canonical truth.
- **PR #934** (worked example) — manual catch via peer review.
  This row is the structural fix that makes future-PR-934
  unnecessary (mechanism catches before peer review needs to).
- **`memory/CURRENT-aaron.md`** §"How this file stays accurate"
  — the rule itself; this row mechanizes the rule.

## Effort estimate

**S (small)** — under a day. Single bash script (~50-100 lines)
or single CI job (~20 lines YAML + script). Pattern matches
existing `tools/hygiene/check-no-conflict-markers.sh` and
`tools/hygiene/check-tick-history-order.sh` shape.

## What this row does NOT do

- Does NOT auto-update CURRENT files. The fix is still the
  agent's job; this row only catches the gap mechanically so
  the agent can't forget.
- Does NOT replace peer review of CURRENT-file accuracy. Stale
  by date is mechanical; *correct* by content needs a reader.
- Does NOT extend to per-user CURRENT files outside the repo
  (none currently — CURRENT-ani.md is user-scope-only at time
  of writing).

## Carved sentence

*"Same-tick-CURRENT-update is a rule. Vigilance is the
implementation. Mechanism is the implementation that doesn't
forget."*
