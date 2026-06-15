---
name: Refresh-before-decide invariant + two-layer print DX (raw → interpretation, mismatch is the bug class) — Claude.ai 2026-05-01
description: Claude.ai feedback packet 2026-05-01 (preserved verbatim at memory/riven/ide/cursor/conversations/2026-05-01-claudeai-backlog-driven-dual-pm-loop-with-refresh-discipline.md) names refresh-before-decide as **the fundamental invariant** for agent loops, and the two-layer print DX (raw output → labeled interpretation, both visible) as the discipline that makes the staleness failure mode catchable rather than silent. The human maintainer's standalone framing: *"refresh-before-decide is the most violated invariant in agent loops generally, not just Otto. The temptation to skip refresh is constant because refresh feels redundant when 'I just refreshed earlier.' The cure is making refresh cheap enough that re-running is friction-free."* Zeta's existing `tools/github/poll-pr-gate.ts` + `poll-pr-gate-batch.ts` ALREADY implement this pattern (cheap, structured-JSON output, interpretation-via-summary-aggregate); the discipline now has explicit framing.
type: feedback
caused_by:
  - "Claude.ai 2026-05-01 carved-handoff packet (verbatim at memory/riven/ide/cursor/conversations/2026-05-01-claudeai-backlog-driven-dual-pm-loop-with-refresh-discipline.md) — multi-section architecture document on backlog-driven dual-PM agent loop with refresh as the load-bearing primitive."
  - "The human maintainer 2026-05-01 standalone framing in same packet: 'refresh-before-decide is the most violated invariant in agent loops generally, not just Otto.' Plus: 'The DX two-layer print is the part most worth flagging for Otto specifically — raw output before interpretation, both visible to the human dev, mismatch as debug surface.'"
  - "Empirical Otto failure-pattern this session: I have repeatedly acted on stale derived state without re-running raw refresh. The poll-pr-gate-batch.ts tool exists precisely to make refresh cheap; the discipline of using it before tick decisions is what was missing the explicit naming."
  - "Composes with the BLOCKED-with-green-CI investigate-threads-first rule (CLAUDE.md) — that rule is a special case of refresh-before-decide applied to PR thread state."
composes_with:
  - feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md
  - feedback_learnings_must_land_in_claude_md_or_pointer_aaron_2026_05_01.md
  - feedback_otto_355_blocked_with_green_ci_means_investigate_review_threads_first_dont_wait_2026_04_27.md
  - feedback_prefer_ts_scripts_over_dynamic_bash_for_conversation_ux_dst_in_ts_aaron_2026_05_01.md
  - feedback_harness_engineering_external_anchors_osmani_bockeler_validates_zeta_substrate_discipline_2026_05_01.md
---

# Rule

**Refresh-before-decide is the fundamental invariant.** Every
other discipline assumes current worldview.

Operationally:

1. **Mandatory refresh before tick selection.** Run
   `bun tools/github/poll-pr-gate-batch.ts <args>` (or the
   future `refresh-github-worldview` if/when built) BEFORE
   deciding what to work on this tick. Stale derived state
   from earlier sessions or earlier ticks is the most common
   failure source.
2. **Mandatory refresh after any merge or claim release.**
   Main moves; PR states change; threads close. Re-refresh.
3. **Mandatory refresh on session start.** Even if a previous
   session refreshed, conditions changed in the gap.
4. **Optional refresh on demand.** Cheap to run (read-only,
   no side effects). When in doubt, refresh again.

**Two-layer print DX** — raw output BEFORE interpretation:

1. **Raw layer first.** Print structured machine output
   (JSON / table / list) verbatim. This is the auditable
   ground truth.
2. **Interpretation layer second, labeled.** Distinct
   from raw data. The agent's derived "what changed since
   last refresh, what's actionable, what's stale, what
   conflicts."
3. **Mismatch is the bug class.** When interpretation
   doesn't match the raw layer the human dev (or any
   reader) can see in the same output, the agent's
   worldview-construction has a bug. This is the failure
   mode the discipline is designed to catch.

# Why

## Why-1: Refresh is the most violated invariant

The human maintainer's framing 2026-05-01:

> *"refresh-before-decide is the most violated invariant in
> agent loops generally, not just Otto. The temptation to
> skip refresh is constant because refresh feels redundant
> when 'I just refreshed earlier.' The cure is making
> refresh cheap enough that re-running is friction-free,
> which the TypeScript-via-Bun version achieves. If refresh
> were slow or expensive, the temptation would win; if it's
> fast, the discipline holds."*

Empirical Otto-pattern this session: I have repeatedly acted
on stale derived state. Examples:

- Citing `17` PR-thread counts from a prior tick's output
  Aaron couldn't see (the human maintainer 2026-04-XX).
- Believing PR-merge state from memory rather than from
  fresh poll, leading to dangling-pointer findings (PR
  #1153 dangling SQLSharp pointer; PR #1160 dangling
  loading-taxonomy pointer).
- Predicting rebase outcome based on cached file-overlap
  knowledge rather than fresh `git diff origin/main`.

In every case, the cure was the same: refresh was cheap, I
should have refreshed again before deciding. The tool
existed; the discipline of using it didn't have explicit
wake-time framing.

## Why-2: Two-layer print catches the bug at the boundary

The Claude.ai packet's framing of two-layer print:

> *"Two-layer print is the dev-experience interface. Raw
> layer for ground truth, interpretation layer for agent's
> derived state. Mismatch between them is the bug class
> refresh is designed to surface."*

The mismatch IS the bug class. When the agent says "PR
#1153 has 3 unresolved threads" but the raw output shows
1 unresolved thread, the human reading both layers
catches the bug at the boundary — without needing to
trust the agent's interpretation.

Zeta's existing `poll-pr-gate-batch.ts` already implements
this:

- **Raw layer**: full structured JSON with per-PR
  `GateReport` array (gate, requiredChecks, unresolvedThreads,
  autoMerge, mergeCommit, warnings, nextAction).
- **Interpretation layer**: summary aggregate (byGate,
  byNextAction, byState, actionable, warnings).

The pattern is already in the substrate; this rule names
the discipline so future-Otto recognizes it as a discipline
and sustains it across surfaces.

## Why-3: Cheap-to-run is what makes the discipline hold

Aaron's framing: *"if refresh were slow or expensive, the
temptation would win; if it's fast, the discipline holds."*

`poll-pr-gate-batch.ts` runs in ~5-10s for the full
session-PR set, ~30-60s for `--all-open`. Fast enough that
re-running is friction-free. The DST tests + `--fixture`
mode mean the script's correctness is itself verified.

If a refresh tool were slow (minutes per run), the
discipline would not hold — agents would skip it under
time pressure (per the "Refresh-skipping under time
pressure" failure mode named in the Claude.ai packet).
The TS+Bun stack makes the discipline operational.

# How to apply

At every tick wake:

1. **First call** is `bun tools/github/poll-pr-gate-batch.ts <args>`
   (or whichever cheap refresh tool fits the scope).
2. **Print the raw output** — do not summarize, do not
   filter, do not interpret yet. Let the maintainer (or
   future reader) see the same thing the agent sees.
3. **Then write the interpretation** as a clearly-labeled
   second section. Include: what changed since last refresh,
   what's actionable, what's stale.
4. **Decide based on the refreshed-and-printed state**, not
   on memory of prior states.

When in doubt mid-tick (e.g., before pushing, before
opening a PR, before resolving a thread):

- **Re-refresh.** Cheap. The temptation to skip is the
  failure mode.
- **Re-print both layers.** Mismatch with prior assumption
  is the catch-the-bug-at-the-boundary moment.

When the maintainer challenges a claim about state:

- **Refresh AGAIN.** Even if you refreshed at tick start.
  The maintainer's challenge is itself signal that
  derived state may be stale.
- **Show the raw output.** Don't argue from interpretation;
  show the ground truth.

# Composes with

- `feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`
  — substrate-or-it-didn't-happen at the durability layer;
  refresh-before-decide is the same discipline at the
  current-worldview layer. Both insist on grounding in
  observable reality.
- `feedback_learnings_must_land_in_claude_md_or_pointer_aaron_2026_05_01.md`
  — meta-rule on substrate landing. This memo gets a
  CLAUDE.md pointer per the meta-rule (load-bearing
  learning, must reach wake-time scope).
- `feedback_otto_355_blocked_with_green_ci_means_investigate_review_threads_first_dont_wait_2026_04_27.md`
  — special case of refresh-before-decide applied to PR
  thread state. Generalizes here.
- `feedback_prefer_ts_scripts_over_dynamic_bash_for_conversation_ux_dst_in_ts_aaron_2026_05_01.md`
  — TS scripts unlock cheap-and-DST-able refresh tools;
  the discipline of refresh-before-decide depends on the
  TS-script discipline being in place.
- `feedback_harness_engineering_external_anchors_osmani_bockeler_validates_zeta_substrate_discipline_2026_05_01.md`
  — Böckeler's "Sensors (feedback)" category in the
  control-taxonomy IS exactly what refresh tools are.
  poll-pr-gate-batch.ts is a Computational + Sensor
  control under that classification.

# Worked example — already in the substrate

`tools/github/poll-pr-gate-batch.ts` (PR #1153, merged
2026-05-01) is the existing implementation of this
discipline at PR-state scope. It produces:

```json
{
  "owner": "Lucent-Financial-Group",
  "repo": "Zeta",
  "queriedAt": "2026-05-01T21:40:47.059Z",
  "count": 27,
  "summary": {
    "byGate": { "BLOCKED": 5, "UNKNOWN": 22 },
    "byNextAction": { "wait-ci": 1, "fix-failed-checks": 4, "resolve-threads": 21, "none": 1 },
    "byState": { "OPEN": 27 },
    "actionable": [...]
  },
  "reports": [...]
}
```

The `reports` array is the raw layer per PR. The `summary`
is the interpretation layer. The maintainer (or future-Otto
reading the output) sees both; mismatch between
`reports[i]` and `summary` would surface as a visible bug.

The Claude.ai packet's `refresh-github-worldview` is a
broader-scope version (open PRs + CI status + claim files +
completion log delta + backlog row delta + reviewer queue
depth). poll-pr-gate-batch.ts covers a subset; extending
toward the broader scope is its own future work.

# What this rule does NOT do

- **NOT a directive to refresh on every micro-action.** The
  rule is "refresh-before-decide" — the granularity is
  tick-level decisions and material state-checks, not
  every Bash call. Over-refreshing is its own failure mode
  (rate-limit, latency cost in conversation UX).
- **NOT a substitute for the existing review-loop hygiene
  rules.** This rule is the upstream invariant; the
  rebase-decision rule, BLOCKED-with-green-CI rule, and
  Copilot-false-positive rule are downstream applications
  that depend on this rule's foundation.
- **NOT a license to print walls of raw output.** The
  two-layer print discipline is meaningful at decision
  points; conversation-window noise compounds. Use the
  full poll-pr-gate-batch output when deciding; use a
  filtered view (`--summary-only`) for status updates.
- **NOT yet promoted to seed-layer.** This memo is
  research-grade; the carved sentence is a candidate per
  the Claude.ai packet's own caution about Mirror-vs-Beacon
  ratios.

# Carved sentence (candidate, not seed-layer yet)

*"Refresh-before-decide is the fundamental invariant; every
other discipline assumes current worldview. Two-layer print
(raw before interpretation, both visible) makes staleness
catchable rather than silent. Cheap-to-run is what makes
the discipline hold."* (Claude.ai 2026-05-01 + Zeta absorption.)

(Marked candidate per CSAP. Has not been multi-domain-tested.
Promotes via Razor + CSAP under DST grading on cadence,
not by maintainer fiat.)

# Sources

- [Claude.ai feedback packet — Backlog-Driven Dual-PM Agent Loop with Refresh Discipline (verbatim)](../memory/riven/ide/cursor/conversations/2026-05-01-claudeai-backlog-driven-dual-pm-loop-with-refresh-discipline.md) — preserved 2026-05-01.
