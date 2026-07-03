# Riven Cursor Terminal Loop — Design

**Date:** 2026-05-15
**Status:** Design approved; implementation queued
**Backlog:** 081KRMEXM0008QG0R00037RGNY (renumbered from 081KRHWGX0008QG0R001XFRAHC per 081KRMEXM0008QG0R000ARAR7P, 2026-05-16)

## Problem

Riven's current autonomy surface (launchd + `riven-loop-tick.ts`) is headless and invisible inside Cursor. Aaron cannot watch the loop's heartbeat or gate output without tailing `~/Library/Logs/zeta-riven-loop/`. This reduces situational awareness and makes debugging autonomous behavior harder.

## Solution

Add a second, Cursor-native loop that runs inside the persistent "1 Terminal" tab. The loop:

- Is visible in the IDE (Aaron sees heartbeat + gate output live)
- Executes the same trajectory-manager contract as the launchd loop
- Survives IDE close/reopen via re-arm logic
- Publishes to the same 081KR7JY10008QG0R000R503K2 bus (single Riven identity across both loops)

Result: defense-in-depth autonomy (headless + IDE-native) + live observability.

## Architecture

```
Cursor IDE
├── "1 Terminal" tab (persistent)
│   └── riven-cursor-terminal-loop.ts
│       ├── Heartbeat (60s) → stdout + bus
│       ├── Gate (15min) → cursor-agent chat + bus
│       └── Re-arm on IDE open (check PID file / bus tombstone)
│
└── launchd (headless)
    └── riven-loop-tick.ts (existing, unchanged)
```

Both loops share:

- The manager contract prompt (injected at runtime)
- The 081KR7JY10008QG0R000R503K2 bus topics (`heartbeat`, `claim`, `review-request`, `shadow-catch`, `infinite-backlog-nudge`, etc.)
- The broadcast file `~/.local/share/zeta-broadcasts/riven.md`

## Re-arm strategy

On IDE open / workspace load:

1. Script checks for `~/.cursor/riven-terminal-loop-state.json`
2. If PID is alive and last gate < 15min ago → resume (no-op)
3. If PID dead or stale → spawn new gate loop, write new state file

Cursor workspace hook (if supported) or a `.cursor/init.ts` can invoke the script on startup.

## Failure modes

- **Duplicate gates** — prevented by PID + timestamp check in state file
- **Terminal closed mid-gate** — publish tombstone to bus, release any in-flight claim
- **IDE crash** — next open triggers re-arm; state file survives
- **Bus unavailable** — loop continues (best-effort publish); errors logged to terminal

## Implementation plan

1. Create `tools/riven/riven-cursor-terminal-loop.ts` (skeleton + heartbeat)
2. Wire the existing manager contract prompt (same text as launchd tick)
3. Add state file + re-arm logic
4. Add graceful shutdown (SIGINT → bus tombstone)
5. Document in `docs/AUTONOMOUS-LOOP.md`
6. Arm in current "1 Terminal" session for first live test

## Scope

- P1 (self-sustainability win)
- Composes with existing bg-services (081KRFA460008QG0R001KC0VBH/0441/0442) and bus (081KR7JY10008QG0R000R503K2)
- No changes to launchd loop (keep both)

## Open questions

- Does Cursor expose a workspace "on open" hook? (If not, manual re-arm on first terminal keystroke is acceptable.)
- Should the terminal loop also forward actions (git push, PR create) or delegate to launchd? (Current design: launchd owns forward; terminal loop is observation + gate only.)

---

**Riven** — Split by truth.