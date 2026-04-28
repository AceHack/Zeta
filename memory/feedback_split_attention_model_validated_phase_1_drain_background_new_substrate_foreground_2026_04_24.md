---
name: Split-attention model validated — Phase 1 mechanical-drain in background + new-substrate production in foreground works; Aaron explicitly endorsed; applies to future Otto-sessions with cascading queue + parallel substrate work
description: Aaron 2026-04-24 Otto-46 — *"love it Split-attention model working. that's amazing"*. Validation of the operational model emerging across Otto-30..45 where the hardened batch-resolve tool drains Phase 1 PR threads mechanically in background via periodic apply-sweeps, while new-substrate production (Craft modules / linguistic-seed terms / research docs / hygiene rows) runs as foreground ticks. Aaron's explicit endorsement makes this a validated discipline, not just a working pattern. Save per the confirm-as-well-as-correct memory rule.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Split-attention model — validated discipline

## Verbatim (2026-04-24 Otto-46)

> love it Split-attention model working. that's amazing

## The rule

When the factory has (a) a long-tail queue of PRs
requiring thread-resolution / merge-drive / status-
checking + (b) independent new-substrate work that
doesn't depend on queue-state, **split attention**:

- **Background axis**: apply the hardened batch-resolve
  tool periodically (every 2-3 ticks), auto-merge-arm,
  update-branch on BEHIND PRs, let CI + bot re-reviews
  settle naturally. Don't grind regex extensions past
  diminishing-returns.
- **Foreground axis**: pick the next bounded new-
  substrate item from the Frontier-readiness roadmap /
  Craft backlog / linguistic-seed term list / hygiene
  row candidates / research doc queue. Land it as its
  own PR with its own branch.

Neither axis blocks the other. Both make progress
concurrently.

## Why Aaron's endorsement matters

Per `feedback_current_memory_per_maintainer_distillation_
pattern_prefer_progress_2026_04_23.md`, Aaron
explicitly prefers progress-over-quiet-close. The
split-attention model operationalises this: even when
the PR queue has a long tail, the factory produces new
substrate. Otto-session ran 6 consecutive new-
substrate ticks (Otto-39..44) while Phase 1 threads
got drained in 30-second sweeps between them.

Aaron's *"amazing"* is the highest explicit
endorsement he's given this session. Validates the
pattern as discipline.

## How to apply

### When split-attention applies

- PR queue has 5+ open PRs with remaining thread-
  substance AND
- Independent new-substrate items exist on BACKLOG /
  memory / Frontier-readiness roadmap

### When NOT to apply

- **Critical blocker on foreground work** — e.g., a
  Craft module requires a linguistic-seed term that's
  in a stuck PR; can't stack dependent substrate
  against the stuck branch (per Otto-42 pivot-on-
  blocker discipline)
- **Aaron-directed focus** — if Aaron explicitly
  directs attention to a specific PR or item, focus
  there; split-attention is the default when no
  direction is given
- **Alignment / safety gate fires** — Common Sense 2.0
  property check / HC-1 consent-first / any active
  red-line concern takes foreground regardless

### Background-axis operation (per-tick overhead ~30s)

1. Check PR status summary (1 gh call)
2. Apply hardened tool to each BLOCKED / BEHIND PR
   (one apply call per; drain mechanizable classes)
3. update-branch any BEHIND PRs
4. Note in tick-history row

### Foreground-axis operation (most of the tick budget)

1. Pick next substrate item
2. Fresh branch from main
3. Author the content (~10-15 min per module / term /
   doc)
4. Commit + PR + auto-merge
5. Note in tick-history row

### Interrupt handling

- Mid-tick Aaron directive: absorb into memory + note
  in tick-history; don't drop foreground work unless
  directive explicitly requires it
- Mid-tick PR failure (CI red): diagnose the specific
  failure; fix if cheap; defer if deep
- Mid-tick bot-review spike: note count; don't grind
  regex past diminishing-returns

## Composes with

- `feedback_current_memory_per_maintainer_distillation_
  pattern_prefer_progress_2026_04_23.md` — progress-
  over-quiet-close discipline that this operationalises
- `project_amara_operational_gap_assessment_...` (PR
  #196 merged) — *"mechanize already-discovered
  failure modes"* is the background-axis discipline
- `project_loop_agent_named_otto_role_project_manager_
  2026_04_23.md` — Otto-as-PM role requires this split
  attention; running one queue while producing another
  substrate IS the PM function
- `feedback_never_idle_speculative_work_over_waiting` —
  split-attention is the concrete discipline for
  avoiding idle-waiting when foreground has work but
  background is in-flight

## What this discipline is NOT

- **Not a license to ignore Phase 1 long-tail.** The
  tail still matters; it just doesn't block foreground
  progress. Each tick's background axis keeps tail
  current.
- **Not permission to pile new substrate beyond
  reviewer capacity.** If 10+ PRs have pending
  reviewer-required work, stop opening more new ones
  until reviewer throughput catches up.
- **Not a replacement for honest content-review.**
  Substantive threads require content-fix or defer-
  with-rationale; split-attention drains only
  mechanizable classes.
- **Not a disregard of budget.** Tool cycles consume
  API calls; stay within poor-man's-mode free-tier
  bounds (haikus for NSA tests + gh API for threads;
  both free).
- **Not indifference to Aaron's attention.** He can
  still interrupt; split-attention just means we
  don't waste ticks waiting for his attention when he
  hasn't given it.

## Observations

**Substrate production metrics** over Otto-39..44
(6 consecutive ticks):

| Tick | Foreground | Background |
|---|---|---|
| 39 | Craft module #2 | (n/a; fresh-branch) |
| 40 | Linguistic-seed truth term | (n/a) |
| 41 | Craft module #3 | (n/a) |
| 42 | MD032 preflight tool + hygiene row #56 | (n/a) |
| 43 | Zora-UX directive + BACKLOG row + 2 MD fixes | (interrupt-handled cleanly) |
| 44 | Zora-UX research doc v0 | 2 PRs update-branch |
| 45 | (background focused) | 9 threads drained across 5 PRs |
| 46 | Craft module #4 (this tick) | (n/a) |

6-of-8 ticks produced foreground substrate. Background
work was either interrupt-driven or batch-drained
(Otto-45). Aaron validates the rhythm.

## Attribution

Aaron (human maintainer) validated the discipline. Otto
(loop-agent PM hat) operated it across Otto-30..46.
Future-tick Otto + future-maintainer + future-Otto-
sessions inherit this as operating rule.
