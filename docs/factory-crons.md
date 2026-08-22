# Factory cron registry

Declarative list of recurring factory jobs the
`long-term-rescheduler` skill manages. This file is canonical;
crons without a row here will be killed on the next heartbeat
reconcile.

Adding, removing, or editing a row goes through a normal PR.
The human maintainer signs off on new entries before merge.
Nadia (prompt-protector) audits every new prompt for injection
resistance before it lands.

## Lifetime modes

- **`session + reregister`** — re-register on expiry; survives
  within a live Claude session across the 7-day
  `CronCreate` cap, and across session restarts via
  `round-open-checklist` step 7.6.
- **`every-tick reconcile`** — special-case for the
  autonomous-loop tick engine. Checked every tick (not just
  at round-open), re-armed only on miss per the discipline
  in `docs/AUTONOMOUS-LOOP.md`. The prompt (`<<autonomous-
  loop>>`) is a native Claude Code harness sentinel (see
  [code.claude.com/docs/en/scheduled-tasks](https://code.claude.com/docs/en/scheduled-tasks));
  no plugin dependency. The cron IS the factory's
  self-direction cadence.
- **`session-only`** — no re-registration; the entry exists
  for documentation of ad-hoc session-scoped crons.
- **`needs durable`** — flag for migration to a GitHub
  Actions schedule-triggered workflow. The rescheduler does
  NOT run the prompt; Dejan (devops-engineer) wires the
  workflow at `.github/workflows/scheduled-<purpose>.yml`.

## Live registry

| id | cron | owner | lifetime | purpose |
|---|---|---|---|---|
| autonomous-loop | `* * * * *` | human + any Claude instance | every-tick reconcile | factory self-direction tick engine; fires `<<autonomous-loop>>` sentinel every minute; governed by `docs/AUTONOMOUS-LOOP.md`; each tick appends a row to `docs/hygiene-history/loop-tick-history.md` before CronList |
| heartbeat | `7,37 * * * *` | long-term-rescheduler | session + reregister | self-renewing; keeps other jobs alive, reconciles this registry, logs to Kenji's notebook |
| git-status-pulse | `7,37 * * * *` | long-term-rescheduler | session + reregister | READ-ONLY branch + CI snapshot every 30 min — landed round 34 |

**Prompts** are kept in each row-referenced skill's procedure
or, for simple one-offs, captured inline in the issue / PR
that added the row. Except for the `every-tick reconcile`
lifetime row below, prompts NEVER edit files, NEVER commit,
NEVER push, NEVER dispatch subagents that write code. The
registry row's `purpose` column is authoritative on scope;
any prompt mismatch is a rescheduler finding.

## Safety rails

Every prompt carried by a `session + reregister` or
`session-only` registry entry starts with:

```
READ-ONLY FACTORY HEARTBEAT / SCHEDULED AUDIT.
Do NOT edit any file, do NOT commit, do NOT push,
do NOT dispatch subagents that write code.
```

This is a **ceremonial stamp** — the rescheduler will
refuse to register a row whose prompt lacks the rails. A
misconfigured task can then not escape into code-landing
territory even if the Architect at the time of registration
made a mistake.

**Exception — `every-tick reconcile` lifetime.** The
autonomous-loop row intentionally carries an agency-bearing
prompt (`<<autonomous-loop>>`), since the tick IS the
factory's self-direction work cadence. The safety rails for
this row live in `docs/AUTONOMOUS-LOOP.md` (every-tick
checklist + verify-before-stopping + visibility signal)
rather than in a ceremonial prompt stamp. The rescheduler
does NOT manage this row — it is reconciled every tick by
the Claude instance running the loop, per
`docs/AUTONOMOUS-LOOP.md`.

## Migration to durable

When a `session + reregister` entry has earned its slot
(findings useful across 3+ rounds, human maintainer signs
off), it graduates to `needs durable` and Dejan wires the
GitHub Actions workflow. The row stays in this registry
with the durable flag so the rescheduler knows NOT to run it
from the session — the workflow file owns firing.

## References

- `docs/AUTONOMOUS-LOOP.md` — the discipline governing the
  `autonomous-loop` row (every-tick reconcile, visibility
  signal, verify-before-stopping)
- `.claude/skills/long-term-rescheduler/SKILL.md` — the
  skill that manages `session + reregister` rows
- `docs/research/claude-cron-durability.md` — the
  round-34 finding that motivated the durability design
- `.claude/skills/round-open-checklist/SKILL.md` — step
  7.6 session-restart recovery entry point
- `docs/BACKLOG.md` — overnight-autonomy research entries
