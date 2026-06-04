# Tick must never stop — every-tick-verify because cron is unreliable

Carved sentence:

> The tick is the factory's heartbeat. The cron mechanism is empirically
> unreliable: durable:true doesn't persist, auto-expire is ~3 days not 7.
> Every session MUST CronList at start; re-arm if missing.

## Operational content

When running under `/loop` autonomous mode (cron fires every minute per
`docs/AUTONOMOUS-LOOP.md`), the tick is the factory's heartbeat — never
let it go dark.

**Every session (autonomous OR interactive) MUST `CronList` at start.**
If no live cron exists, re-arm via `CronCreate` with the
`<<autonomous-loop>>` sentinel and `* * * * *` cadence.

**`durable: true` is documented but doesn't actually persist across
sessions in this harness** — set it as intent-documentation but do NOT
rely on cross-session continuity OR on `.claude/scheduled_tasks.json`
as audit-trail. Auto-expire window is empirically ~3 days, not the
documented 7.

**Two distinct expiration mechanisms — do not conflate:**

| Mechanism | Trigger | Empirical anchor |
|---|---|---|
| **Session-exit non-persistence** (structural) | The Claude Code session that armed the sentinel exits — the in-memory cron dies with the process | 2026-05-17: sentinel `de1e7f5d` armed at 21:29Z gone by 22:07Z (within ~38 min). The 21:29Z session exited; the 22:07Z fresh session found `CronList` empty. [2207Z tick shard](../../docs/hygiene-history/ticks/2026/05/17/2207Z.md) |
| **Within-session auto-expire** (timer) | The cron has run continuously in one session past the auto-expire window | Empirically ~3 days, not the documented 7 |

The session-exit mechanism is the more common cause of "sentinel missing" at fresh-session cold-boot, because Claude Code sessions cycle on a much shorter cadence (minutes to hours) than the 3-day auto-expire window. Per `CronCreate`'s own documentation: *"Jobs live only in this Claude session — nothing is written to disk, and the job is gone when Claude exits."* The session-exit non-persistence is by design at the harness level, NOT a bug in the cron mechanism.

Either mechanism produces the same observable outcome: fresh-session `CronList` returns empty. The remediation is the same: `CronCreate` with `<<autonomous-loop>>` + `* * * * *` BEFORE any substrate work. The distinction matters only for diagnostic accuracy and for understanding why `durable: true` cannot fix it (the in-memory cron has no persistent surface to restore from after session exit).

Audit trail lives in committed substrate (tick-history rows, memory
files, commits), NOT in the cron mechanism itself.

**End-of-tick checklist** (six steps):

1. Speculative work (per never-be-idle priority ladder)
2. Verify
3. Commit
4. Write per-tick shard at `docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md`
   (canonical write surface; NOT legacy `loop-tick-history.md` table)
5. CronList
6. Visibility signal → stop

## Full reasoning

`docs/AUTONOMOUS-LOOP.md`
`docs/hygiene-history/ticks/README.md` (shard schema + write-vs-read separation)
