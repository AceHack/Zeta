---
name: /loop default-on unless user requests off
description: Session-open check — is /loop running? If not and user hasn't explicitly asked for it off, prompt to turn it on so autonomous work can continue.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
The Zeta software factory should **always have `/loop` running** unless
Aaron has explicitly requested it off. The factory should check at
session-open / round-open and prompt to turn it on if it's off.

**Why:** Aaron 2026-04-20, after Round 42 TECH-RADAR graduation landed
and he asked "do you still have the loop on?" — "this make it where
you can keep doing you work". Loop-on is the default operating mode
for autonomous execution; loop-off is the exception that requires an
explicit ask.

**How to apply:**
- At session open / round open, **call `CronList` first** to see
  whether the loop is already running (it usually is — a prior
  session may have armed it). Only take action if no autonomous /
  next-steps / loop-sentinel job is listed.
- Agents **can** start the loop themselves. Two mechanisms:
  - `CronCreate` with `prompt: "<<autonomous-loop>>"` — recurring
    fixed-interval (e.g. `"13,33,53 * * * *"` for every 20 min at
    off-minutes). The `durable: true` flag writes to
    `.claude/scheduled_tasks.json` but **does not reliably survive
    past ~2-3 days** in practice (Aaron 2026-04-20) — the job
    eventually disappears and needs re-arming. Treat `durable` as
    "survives short restarts," not "set once and forget."
  - `ScheduleWakeup` with `prompt: "<<autonomous-loop-dynamic>>"` —
    one-shot self-pacing (each fire reschedules). Also session-
    bounded.
  Verified 2026-04-20: runtime accepts both sentinels without
  governance or rule-level block. My earlier claim "agents cannot
  start it themselves" was wrong — I hadn't tried.
- If Aaron has durable-policy-said "loop off" in this session,
  respect that — do not re-prompt every turn.
- Treat "is loop on?" as a cold-start question on the same level as
  "am I on the right branch?" and "is the build clean?" — part of
  the wake-up checklist Daya (AX) owns, not ambient chatter.
- Durable-policy marker: this overrides the default "wait for the
  user to ask" cadence — the factory proactively flags loop-off.
- If the existing loop is `/next-steps`-cadence (Aaron's usual
  shape), that counts as "loop on" — don't pile a second
  `<<autonomous-loop>>` cron on top; one cadence source is
  enough.
