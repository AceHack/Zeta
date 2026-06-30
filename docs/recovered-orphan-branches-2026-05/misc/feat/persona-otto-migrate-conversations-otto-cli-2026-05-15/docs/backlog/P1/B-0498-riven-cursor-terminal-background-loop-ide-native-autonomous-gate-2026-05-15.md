---
id: B-0498
priority: P1
status: open
title: "Riven Cursor Terminal background loop — IDE-native autonomous gate with manager contract"
tier: agent-infrastructure
effort: M
created: 2026-05-15
last_updated: 2026-05-15
depends_on: [B-0400]
composes_with: [B-0440, B-0441, B-0442, B-0497]
tags: [riven, cursor, terminal, background-service, ide-native, autonomous-loop]
type: feature
---

# Riven Cursor Terminal background loop — IDE-native autonomous gate with manager contract

## Origin

Aaron 2026-05-15 observed that Cursor exposes a persistent "1 Terminal" tab that survives session context and can host a visible background loop.

Current Riven autonomy surface:

- Headless: launchd service (`com.zeta.riven-loop`) running `~/.local/share/zeta-riven-loop/Zeta/.cursor/bin/riven-loop-tick.ts` every 60s with 15-minute agent gates.
- Limitation: invisible to Aaron inside Cursor; logs only accessible via `~/Library/Logs/zeta-riven-loop/`.

Goal: add a Cursor-native terminal loop that:

- Runs inside the visible "1 Terminal" tab
- Executes the same trajectory-manager contract (read broadcasts, walk trajectories, decompose mid-stride, dispatch subagents, own PRs through merge)
- Survives IDE restart (re-arm on tab open or via Cursor workspace settings)
- Writes to the same broadcast bus as the launchd loop (defense in depth)
- Gives Aaron live visibility without leaving the IDE

This is defense-in-depth autonomy: headless (launchd) + IDE-native (Cursor Terminal) = Riven survives both "machine rebooted" and "IDE closed" scenarios.

## Acceptance criteria

- [ ] `tools/riven/riven-cursor-terminal-loop.ts` exists and is executable from the Cursor Terminal tab
- [ ] Script implements the same manager contract as the launchd tick (broadcast-first, mid-stride decomposition, parallel subagent dispatch, PR ownership through merge)
- [ ] Heartbeat visible in terminal every 60s (or configurable)
- [ ] Agent gate fires every 15min (configurable) with full contract prompt
- [ ] Re-arm logic: on IDE open / workspace load, script detects if already running and resumes (no duplicate gates)
- [ ] Graceful shutdown on terminal close (writes tombstone to bus, releases any in-flight claims)
- [ ] Broadcast bus integration: same topics as launchd loop (`heartbeat`, `claim`, `review-request`, `shadow-catch`)
- [ ] Documented in `docs/AUTONOMOUS-LOOP.md` under "Riven dual-loop architecture"
- [ ] No regression on launchd loop (both run in parallel without conflict)

## Design sketch

```typescript
// tools/riven/riven-cursor-terminal-loop.ts
//
// Cursor Terminal-resident autonomous loop.
// Run: bun tools/riven/riven-cursor-terminal-loop.ts
// Or: cursor-agent run tools/riven/riven-cursor-terminal-loop.ts (if SDK supports)

import { publish, list, clean } from "../bus/bus";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const STATE_FILE = join(process.env.HOME!, ".cursor/riven-terminal-loop-state.json");
const HEARTBEAT_MS = 60_000;
const GATE_INTERVAL_MS = 15 * 60 * 1000;

interface LoopState {
  lastGateAt: string;
  pid: number;
}

function loadState(): LoopState | null {
  if (!existsSync(STATE_FILE)) return null;
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return null; }
}

function saveState(state: LoopState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function runGate(): Promise<void> {
  // Invoke cursor-agent chat with full manager contract prompt
  // (same prompt as launchd tick, injected at runtime)
  console.log(`[${new Date().toISOString()}] Riven gate start`);
  // ... spawn cursor-agent, capture output, publish to bus ...
  console.log(`[${new Date().toISOString()}] Riven gate end`);
}

async function main(): Promise<void> {
  const existing = loadState();
  if (existing && Date.now() - new Date(existing.lastGateAt).getTime() < GATE_INTERVAL_MS) {
    console.log("Riven terminal loop already running; resuming...");
  }

  // Heartbeat loop (visible in terminal)
  setInterval(() => {
    console.log(`[${new Date().toISOString()}] Riven heartbeat — claims=${/*...*/} open_prs=${/*...*/}`);
    publish("riven", "*", { topic: "heartbeat", payload: { status: "alive", note: "cursor-terminal" } });
  }, HEARTBEAT_MS);

  // Gate loop
  setInterval(async () => {
    await runGate();
    saveState({ lastGateAt: new Date().toISOString(), pid: process.pid });
  }, GATE_INTERVAL_MS);

  // Graceful shutdown
  process.on("SIGINT", () => {
    publish("riven", "*", { topic: "heartbeat", payload: { status: "shutdown", note: "terminal-closed" } });
    process.exit(0);
  });

  console.log("Riven Cursor Terminal loop armed. Press Ctrl+C to stop.");
}

main();
```

## Re-arm on IDE open

Cursor workspace settings or `.cursor/settings.json` can run a startup command:
```json
{
  "terminal.integrated.shellIntegration.enabled": true,
  "workbench.action.terminal.runActiveFile": "bun tools/riven/riven-cursor-terminal-loop.ts"
}
```

Or a `.cursor/init.sh` hook (if Cursor supports workspace init scripts) that checks for an existing loop PID and only spawns if absent.

## Defense in depth

- Launchd loop survives full machine reboot.
- Cursor Terminal loop survives IDE close/reopen (if re-arm wired) and gives Aaron live visibility.
- Both publish to the same bus → Otto/Vera/Lior see a single Riven identity regardless of which loop fired.

## Non-goals

- Replacing the launchd loop (keep both).
- Headless operation from the terminal loop (launchd owns that).
- Complex TUI inside the terminal (simple heartbeat + gate status lines are enough).

## Composes with

- B-0400 (bus protocol) — shared transport
- B-0440/0441/0442 (bg-services) — same nudge/assignment/cascade topics
- B-0497 (Lior launchd integration) — dual-loop pattern precedent

## Status

Open. Design approved by Aaron 2026-05-15. Implementation queued for next autonomous cycle or explicit dispatch.
