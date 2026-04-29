---
id: B-0100
priority: P3
status: open
title: Pure-wait tick backpressure / quiescence rule for autonomous-loop tick shards
tier: research-grade
effort: M
ask: Multi-AI synthesis packet 2026-04-29 (Deepseek + Amara filter)
created: 2026-04-29
last_updated: 2026-04-29
composes_with: [B-0098, B-0099, B-0101]
tags: [autonomous-loop, tick-history, backpressure, quiescence, repo-hygiene, soulfile]
---

# Pure-wait tick backpressure / quiescence rule

Right now every `<<autonomous-loop>>` cron fire produces a
tick-history shard PR, even if the only tick activity was "queue
checked, nothing to merge, CI in progress, no events." Over a
long-enough operational drain the repo accumulates thousands of
near-identical "pure-wait" shards.

The packet's strategic point: there's currently no termination
condition.

## Two-tier proposal

### Tier 1 — Backpressure (immediate)

```text
If open tick-history PRs >= 3
and the tick has no substantive event
and only CI is pending,
do not open another pure-wait shard.
Batch or skip until one lands.
```

Implementable as a check in the tick-close procedure: count open
`tick-history/*` PRs; if ≥ N and the tick body would be a
pure-wait note, skip the shard creation step.

### Tier 2 — Quiescence (after Tier 1 lands)

```text
After M consecutive no-op / CI-wait ticks,
enter quiescent mode:
- stop per-minute shards
- run periodic health checks (e.g., hourly)
- wake on external signal:
    - new PR opened
    - failing build
    - maintainer input
    - unresolved review thread
```

Implementable as a CronCreate cadence change on detection of
quiescence + a re-arm trigger.

## Why this matters

Per the soulfile-cleanliness rule
(`memory/feedback_repo_is_soulfile_dont_commit_raw_diagnostic_dumps_aaron_amara_2026_04_29.md`),
text compresses well in pack-delta storage so individual
near-identical shards aren't a soulfile risk. But:

- Repo browse-ability suffers (thousands of shards = hard to
  scan).
- PR-review backlog accumulates (each shard needs a CI cycle).
- The factory's signal-to-noise ratio degrades — "what changed
  this hour" becomes "scroll through 60 shards."

## Why P3

The loop is currently in productive operational drain — every
recent tick has had real events (PR merges, review-thread fixes,
mid-tick corrections). The quiescence rule fires only when drain
runs out. Backpressure is a slightly more proactive safeguard
but still bounded. Promote when active drain is clear.

## Composes with

- B-0098, B-0099, B-0101 — sibling actionables from the same
  packet.
- `docs/AUTONOMOUS-LOOP.md` — current per-minute cron contract.
- `memory/feedback_never_idle_speculative_work_over_waiting.md`
  — the never-idle invariant; quiescence is its dual (idle is OK
  when queue is genuinely empty, but only after sustained
  evidence).
