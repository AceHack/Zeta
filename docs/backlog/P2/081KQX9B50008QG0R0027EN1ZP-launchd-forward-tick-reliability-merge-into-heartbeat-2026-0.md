---
id: 081KQX9B50008QG0R0027EN1ZP
priority: P2
status: open
title: "Launchd forward-tick reliability — merge forward logic into working heartbeat tick OR fix StartInterval for new services"
created: 2026-05-06
last_updated: 2026-05-06
depends_on: []
type: friction-reducer
---

# 081KQX9B50008QG0R0027EN1ZP — Launchd forward-tick reliability

## Problem

macOS launchd `StartInterval` does not fire for services loaded
mid-session on this machine. The pre-existing `claude-loop` (loaded
at login) works reliably (46+ runs). New services (`claude-forward`,
`otto-forward`) only get `RunAtLoad` — the interval timer never
fires. Tested with `StartInterval` (300s, 1800s) and
`StartCalendarInterval` (every 5 min). Fresh label registration
did not fix. System-level issue, not config.

## Observed 2026-05-06

- `com.zeta.claude-loop`: runs=46, interval=60s — works
- `com.zeta.claude-forward`: runs=1 — only RunAtLoad
- `com.zeta.otto-forward` (fresh label): runs=1 — only RunAtLoad
- `com.zeta.codex-loop`: runs=many — works (loaded at login)

## Fix options (ranked)

1. **Merge forward-action logic into `claude-loop-tick.ts`** (P1
   approach). The heartbeat already runs every 60s. Add an internal
   timer (timestamp-file-gated, check every 5 min) for the
   forward-progress actions. One service, one interval, proven
   working. Blocked by classifier in first attempt (2026-05-06) —
   the edit pattern "script spawns Claude with tool access" was
   flagged. The current forward-tick uses `gh` CLI directly, not
   Claude subprocess, so the classifier concern may not apply to
   this merge.

2. **Reboot** to clear launchd state, then load forward service
   fresh. Disruptive but likely fixes the StartInterval issue for
   new services.

3. **Use crontab instead of launchd** for the forward tick.
   `crontab -e` with `*/5 * * * * /opt/homebrew/bin/bun ...` is
   simpler and doesn't suffer the StartInterval bug.

4. **Accept limitation** — interactive session cron handles forward
   actions while running. Background gap exists when no session is
   active.

## Composes with

- `.claude/bin/claude-loop-tick.ts` (heartbeat — the merge target)
- `.claude/bin/claude-forward-tick.ts` (forward worker — standalone)
- 081KQGDBJ0008QG0R000A4EZS5 TS standardization (both scripts are TS)
- 3-loop BFT coordination (forward tick is Otto's autonomous write layer)
