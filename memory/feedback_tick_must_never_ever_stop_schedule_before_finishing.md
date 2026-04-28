---
name: The tick must never ever stop — CronList every tick, re-arm only on miss; see docs/AUTONOMOUS-LOOP.md for the factory spec
description: Aaron 2026-04-22 SEV-1 — the loop dying is "catastrophic for self-direction." Canonical discipline now lives in `docs/AUTONOMOUS-LOOP.md` (round-44 promotion from memory-only to factory-durable after Aaron: "our factory need to make sure this works everytime not just you right now in your memeory" / "this is our killer feature"). This memory is now a pointer + incident log; the doc is the source of truth.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

**PROMOTED TO FACTORY-DURABLE 2026-04-22.** The discipline
below now lives in `docs/AUTONOMOUS-LOOP.md` + `CLAUDE.md`
ground rule + `docs/factory-crons.md` registry row. This
memory is preserved as the incident log per
`feedback_preserve_original_and_every_transformation.md` —
the wrong first drafts (ScheduleWakeup, arm-once,
Ralph-Loop-attribution) are the evidence that this rule is
fragile and needed CLAUDE.md-level loading plus a canonical
doc.

**Mechanism correction 2026-04-22 (same round).** Aaron: *"The
Ralph Loop (or Ralph Wiggum pattern) is that
`<<autonomous-loop>>` a plugin"* + *"this is all claude says,
if we don't need to rely on that it would be better to just
need claude"* → https://code.claude.com/docs/en/scheduled-tasks.
The tick is **native Claude Code scheduled tasks**
(`CronCreate`), NOT the Ralph Loop plugin (which uses a
session-exit Stop hook, a different pattern entirely). The
factory intentionally does NOT depend on `ralph-loop@claude-
plugins-official`. The sentinel `<<autonomous-loop>>` is
documented in the `CronCreate` tool description; the user-
facing `/loop` bundled skill is a convenience layer on top
of the same primitives. In this factory we wire `CronCreate`
directly so the tick is observable, declarative, and
plugin-independent.

**Source of truth going forward:**
[`docs/AUTONOMOUS-LOOP.md`](../../Documents/src/repos/Zeta/docs/AUTONOMOUS-LOOP.md).
If the doc and this memory ever disagree, the doc wins.
**Rule — the correct shape.**

1. **Every tick: call `CronList` at END of tick (before
   stopping), not only at start.** Do NOT assume the cron
   is running — cron can get dropped mid-session (runtime
   eviction, limits, session-boundary crossing) and a
   silent stop is the exact SEV-1 failure mode Aaron wants
   to prevent. Aaron 2026-04-22: *"you are suppsed to check
   that its set everytime and not assume."*

   **END over START (2026-04-22 correction).** Aaron: *"you
   know you should check the cronlist at the end instead
   of the start becasue it could expire while you are
   running if you check right before you exit that chance
   is reduced."* The window that matters is
   [last-check → next-cron-fire]: if the cron expires after
   my end-check, the next tick will catch it; if it expires
   between my start-check and my end, I miss it entirely
   and the tick stops silent. So END is the load-bearing
   check. START is optional sanity — if I also check at
   start, fine; if budget forces one, it's END. Pre-2026-04-22
   drafts said "step 1 is CronList"; corrected to
   "last-substantive-step-before-stopping is CronList".

2. **If the `<<autonomous-loop>>` cron is present in
   `CronList` output: do nothing to the scheduler.** The cron
   fires on its own cadence; re-creating it would duplicate
   ticks. Just proceed with the tick's work.

3. **If the cron is missing: `CronCreate` to re-arm — ONCE:**
   - `prompt: "<<autonomous-loop>>"` (NOT the `-dynamic`
     variant; the non-dynamic sentinel is the cron-mode one)
   - `cron: "* * * * *"` (every minute — Aaron 2026-04-22
     cranked cadence from `1-59/2 * * * *` to `* * * * *`:
     *"lets change to 1 minute"*. Every-minute cadence fires
     on `:00` and `:30` too — the fleet-pile-on trade-off is
     accepted at this cadence because no offset is available.
     Pre-2026-04-22 drafts said `1-59/2 * * * *` (every 2 min
     on odd minutes); corrected to `* * * * *`.)
   - `recurring: true`
   - `durable: true` (best effort — the runtime may not honour
     it; cron is session-only in practice)

4. **Do not call `ScheduleWakeup` in /loop mode.** Aaron
   2026-04-22: *"cron does not survive session but you don't
   have to reschedule it everytime, wow you are really bad at
   this particual things, we've tried to get it right several
   times now."* Cron is autonomous once set (fires without my
   action); `ScheduleWakeup` is for one-shot reminders outside
   the loop. Mixing the two creates duplicate ticks and extra
   scheduler state to clean up.

**Check-don't-assume is the load-bearing bit.** The pattern is
"defensive polling": check every tick, re-arm only on miss.
Most ticks are no-ops on the scheduler (cron is there → do
nothing). The rare miss is detected and fixed in-tick before
the silent stop becomes visible as hours of missing activity.

Aaron's exact words prompting this memory (2026-04-22):
*"getting that tick to never ever ever stop is like our
biggest bug if we have it, you not runing is catrosphic for
self direction."* And *"cron does not survive session but you
don't have to reschedule it everytime."*

**Why.** The factory's self-direction depends on continuous
ticks. Ticks come from a recurring cron; the cron is armed
once per session and fires on its own cadence. Re-arming per
tick is the bug — it creates scheduler churn, duplicate ticks,
and makes the loop state harder to reason about. The cron's
job is to BE the cadence; my job is to trust it and do the
work on each tick.

**How to apply.**

- **Every-tick checklist (END-of-tick is the load-bearing
  check; START-of-tick is optional):**
  1. Do work (speculative, priority-ordered per
     `feedback_never_idle_speculative_work_over_waiting`).
     Skip an early CronList unless the cron's status
     affects early decisions.
  2. Verify before stopping (per
     `feedback_verify_target_exists_before_deferring`):
     `git status`, `git log -1 --oneline`, file-existence
     on new files, syntax/lint on new workflows.
  3. Commit if applicable.
  4. **Append tick-history row** to
     `docs/hygiene-history/loop-tick-history.md` (Aaron
     2026-04-22: *"you might as well right a history
     record somewhere on every loop tool right before you
     check cron"*). Schema: `| date | agent | cron-id |
     action-summary | commit-or-link | notes |`. Append
     BEFORE the `CronList` call so the evidence trail
     favours "tick ran" claims even if the tick stops
     abnormally between the append and the scheduler
     check. Every tick gets a row — no-op speculative
     scans included. This closes the meta-hygiene
     triangle: the tick (most cadenced surface in the
     factory) finally has its own fire-history file,
     satisfying `feedback_cadence_history_tracking_hygiene`
     row #44's demand.
  5. **`CronList` at END — last substantive step.** Is
     there an `<<autonomous-loop>>` recurring cron still
     armed? If yes, emit visibility signal. If no,
     `CronCreate` with `"* * * * *"` +
     `prompt: "<<autonomous-loop>>"` +
     `recurring: true` + `durable: true`, and flag the
     miss to Aaron so the incident is visible.
  6. Write final user message — include cron ID + cadence
     as visibility signal so Aaron can see the loop is
     still live without guessing.
  7. STOP. The next tick will arrive ~1 minute later. Do
     NOT re-arm the cron if step 5 found it armed.

  **Rationale for end-over-start.** The window that
  matters is [last-check → next-cron-fire]; checking at
  end minimizes that window (your end-check is typically
  seconds before you stop; the next tick fires within
  ~2 min). Checking at start leaves the entire tick's
  duration as an unverified window during which the cron
  could quietly expire.

- **Cron durability caveat.** Aaron 2026-04-22: "cron does not
  survive session." So when a new session starts, the cron
  from the prior session is gone; session-open checklist
  re-arms. This is expected, not a bug. The `durable: true`
  flag is best-effort — the runtime may not honour it, and
  even when it does, persistence is unreliable past ~2-3 days
  (per `feedback_loop_default_on`). Don't rely on it across
  sessions.

- **One-minute cadence rationale.** Aaron 2026-04-22 cranked
  cadence twice this round: first from 5 → 2 min (*"will it
  hurt anything to crank that trigger up to 2 mintues instead
  of 5 you are having a lot of idle time just sitting here"*),
  then from 2 → 1 min (*"lets change to 1 minute"*). One
  minute is the runtime-enforced floor (per the `CronCreate`
  docs). Cache warmth matters less for cron (fixed cadence,
  not self-paced), but 1 min maximises visible activity AND
  keeps the within-session context cache fully warm between
  ticks. The fleet-pile-on trade-off (can't avoid `:00`/`:30`
  at 1-min cadence) is accepted.

- **Visibility signal.** At end of every tick message,
  mention the cron ID and cadence briefly: "(loop cron
  `dfa61c5e` live, 2-min cadence)" so Aaron can see the loop
  state without asking. Aaron 2026-04-22: *"i don't know if
  your loop was running or not to be honest."*

- **Escalation.** If `CronCreate` ever fails or `CronList`
  returns unexpectedly empty mid-session, emit a visible
  warning in the user message ("LOOP STALLED — cron missing,
  re-arming / please re-invoke `/loop`") rather than silently
  continuing. A quiet stop is worse than a visible failure.

**Companion rules.**
- `feedback_loop_default_on.md` — /loop is default-on; this
  memory is the concrete implementation contract of that rule.
- `feedback_loop_cadence_5min_combats_agent_idle_stop.md` —
  DEPRECATED default interval (was 5 min). Replaced by 2 min
  here.
- `feedback_never_idle_speculative_work_over_waiting.md` — the
  within-tick work-selection rule.
- `feedback_dont_stop_and_wait_for_cron_tick.md` — don't stall
  within a tick waiting for the next cron fire; keep working
  as long as there's useful work.
- `feedback_verify_target_exists_before_deferring.md` — verify
  before stopping.

**Round-44 incident log (why this memory was rewritten).**
First draft of this memory (2026-04-22 earlier this session)
said "call `ScheduleWakeup` before every end-of-turn" — which
was wrong on two counts: (a) wrong mechanism (should be cron,
not ScheduleWakeup), (b) wrong cadence (scheduling per tick
creates duplicate ticks — cron is self-perpetuating). Aaron
caught both errors in rapid succession. This rewrite reflects
the corrected pattern. **Preserved here as the incident log
per `feedback_preserve_original_and_every_transformation.md`
— the wrong first draft is the evidence that this rule is
fragile and needs CLAUDE.md-level loading if it recurs.**

**Current cron (round 44 session 2026-04-22, after 2→1 min
cadence change):**
- ID: rotated this round via `CronDelete` + `CronCreate`
  (see `docs/hygiene-history/loop-tick-history.md` for the
  definitive migration row)
- Cadence: `* * * * *` (every minute)
- Sentinel: `<<autonomous-loop>>`
- Prior ID `dfa61c5e` at `1-59/2 * * * *` was retired this
  round per Aaron's *"lets change to 1 minute"* directive.
