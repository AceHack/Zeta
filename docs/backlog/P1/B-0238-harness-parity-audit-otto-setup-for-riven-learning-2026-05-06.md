---
id: B-0238
zetaid: 081KQX9B50008QG0R002V5ATNP
priority: P1
status: open
title: "Harness parity audit — document Otto's session setup so Riven (and future nodes) can approximate the same autonomy"
created: 2026-05-06
last_updated: 2026-05-06
depends_on: [B-0208]
decomposition: atomic
type: friction-reducer
---

# B-0238 — Harness parity audit

Otto (Claude Code) has capabilities Riven (Cursor) doesn't:

- CronCreate (session-scoped cron, fires every minute)
- Auto-mode (continuous autonomous execution)
- Tool permissions (granular allowedTools)
- Session compaction (harness manages context automatically)

Riven has:

- Per-turn gate only (fires when Aaron types)
- alwaysApply rules (static, not timer-driven)
- Background launchd loop (healthy but conservative)

## Deliverables

1. **Document Otto's session setup** — CronCreate config,
   auto-mode settings, tool permissions, .claude/settings.json
   relevant entries. Make this a "how to set up a productive
   Claude Code session" reference.

2. **Map Cursor equivalents** — for each Otto capability, what's
   the closest Cursor approximation? Where is there no equivalent?

3. **Codex comparison** — Vera starts with `danger-full-access`
   (allow everything). Document what that gives her and what the
   safe-actions list (SAFE-AUTONOMOUS-ACTIONS.md) constrains.

4. **Riven improvement path** — specific changes to
   `.cursor/bin/riven-loop-tick.ts` and `.cursor/rules/` that
   would close the autonomy gap within Cursor's constraints.

5. **Monitor Cursor for timer hooks** — when Cursor adds
   timer/scheduler hooks, Riven should be first to wire them.

## Why P1

Riven's lower throughput is partly harness constraint, not
capability. Closing the harness gap directly increases the
BFT's weakest node, which improves the whole system.

## Composes with

- B-0208 (launchd forward-tick reliability)
- B-0209 (remote-only background agent test matrix)
- docs/SAFE-AUTONOMOUS-ACTIONS.md
