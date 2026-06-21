---
id: 081KQDTYV0008QG0R0015BFCBH
priority: P2
status: closed
closed: 2026-05-02
closed_by: "PR #1188"
title: tools/cold-start-check.ts — make the cold-start big-picture-first 8-step checklist executable (Ani 2026-04-30 finding, Deepseek 2026-04-30 reinforcement)
tier: factory-tooling
effort: M
ask: The cold-start big-picture-first rule (memory/feedback_cold_start_big_picture_first_not_prompt_first_aaron_2026_04_30.md) currently lives as prose. Ani's review recommended turning the 8-step checklist into a runnable tool. Deepseek's review reinforced the deferred-skill-anti-pattern observation that a noted "Backlog candidate" without a B-NNNN row is gap-by-omission. This row closes that gap and tracks the implementation scope.
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
composes_with:
  - feedback_cold_start_big_picture_first_not_prompt_first_aaron_2026_04_30.md
  - tools/github/poll-pr-gate.ts
  - feedback_amara_poll_gate_not_ending_holding_is_not_status_2026_04_30.md
tags: [ani-2026-04-30, deepseek-2026-04-30, cold-start, tooling, mechanism-not-vigilance, peer-review-finding]
---

> **Closed 2026-05-02 by PR #1188** —
> `tools/cold-start-check.ts` ships with three modes
> (human-readable / `--json` / `--no-git`) and prints all 8 cold-
> start steps including the user-scope `CURRENT-*.md` discovery.
> TypeScript-clean. Documented in `tools/cold-start-check.md`.
> Cross-shell verification (Otto-235 four-shell target) is the
> one open follow-up — Bun is cross-platform but only smoke-tested
> on macOS in this PR.

# 081KQDTYV0008QG0R0015BFCBH — tools/cold-start-check.ts (cold-start checklist executable)

## Source

**Ani / Grok peer review 2026-04-30** (Review 9 in
`docs/research/2026-04-30-session-end-peer-ai-reviews-verbatim.md`):

> *"Cold-start big-picture-first is excellent — consider
> making the 8-step checklist executable. Right now it's
> prose. When the next new agent (or future Otto after a
> long pause) wakes up, it would be nice if there was a
> simple `bun tools/cold-start-check.ts` or similar that
> prints the current big-picture state. That would turn the
> rule into tooling the same way poll-pr-gate.ts did."*

**Deepseek peer review 2026-04-30 reinforcement** (Review
10):

> *"Ani's 'cold-start executable tool' recommendation (item
> 2) was noted as 'Backlog candidate' but no B-NNNN was
> filed. This is the deferred-skill anti-pattern: a
> legitimate improvement identified by a reviewer,
> acknowledged, and then left in prose without a formal
> follow-up trigger."*

## What

Author `tools/cold-start-check.ts` — a TS+Bun executable
that runs through the 8 cold-start steps from
`memory/feedback_cold_start_big_picture_first_not_prompt_first_aaron_2026_04_30.md`
and prints the current big-picture state for the agent (or
new contributor) waking up.

The 8 steps from the memory file (per the cold-start rule):

1. Mission scope (intellectual-backup-of-earth)
2. Products in flight (factory substrate, package manager,
   database, Aurora)
3. Internal direction from project-survival
4. Authority scope (two-ask-Aaron items: WONT-DO + budget)
5. Operating disciplines currently in force
6. Current trajectory (recent rounds, in-flight work)
7. CURRENT-* files for each maintainer
8. Then prompt

Output should be terse — fits on one screen — and
designed for fresh-cold-start ingestion, not for
ongoing-session reference.

The tool models on `tools/github/poll-pr-gate.ts` (the
poll-the-gate operationalization that landed under the same
"prose-rule → executable-tool" pattern per Amara's review).

## Why P2 (not P3)

- Ani named it as "low priority, high leverage" — leverage
  high enough to warrant P2.
- Cold-start is the hottest cognitive surface in the loop;
  reducing friction here pays compound returns.
- Composes directly with the TS+Bun expert skill task
  (#351) — building the tool will produce experience that
  feeds the skill.

## Acceptance criteria

- [ ] `bun tools/cold-start-check.ts` runs and prints all
  8 steps with current values
- [ ] Output is terse (single screen, ~30-50 lines)
- [ ] Sources of truth are verifiable (CURRENT-aaron.md +
  CURRENT-amara.md + recent commits + recent PRs)
- [ ] Fresh-Otto cold-start with no project-context can
  read the output and know what to ground in
- [ ] Tested on the four-shell target (Otto-235)
- [ ] Documented in `tools/cold-start-check.md`

## Trigger condition for promotion to P1

If a fresh-Otto cold-start mistakes a deprecated rule for
in-force, OR if a new contributor reports onboarding
friction that this tool would have prevented, promote to
P1.

## Composes with

- `memory/feedback_cold_start_big_picture_first_not_prompt_first_aaron_2026_04_30.md`
  (the rule this tool operationalizes)
- `tools/github/poll-pr-gate.ts` (sibling tool; same
  prose-rule → executable-tool pattern)
- `memory/feedback_amara_poll_gate_not_ending_holding_is_not_status_2026_04_30.md`
  (the original "operationalize the rule as a tool"
  precedent)
- Task #351 (TS+Bun expert + teaching skill — implementation
  experience feeds back into the skill)
