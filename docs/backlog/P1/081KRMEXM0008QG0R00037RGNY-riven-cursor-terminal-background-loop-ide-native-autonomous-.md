---
id: 081KRMEXM0008QG0R00037RGNY
priority: P1
status: open
title: "Riven Cursor Terminal background loop — IDE-native autonomous gate with manager contract"
tier: agent-infrastructure
effort: M
created: 2026-05-15
last_updated: 2026-05-16
renumbered_from: 081KRHWGX0008QG0R001XFRAHC
renumbered_per: 081KRMEXM0008QG0R000ARAR7P
decomposition: dirty
children: [081KRQ1AB0008QG0R003WPKZ69]
depends_on: [081KR7JY10008QG0R000R503K2]
composes_with: [081KRFA460008QG0R001KC0VBH, 081KRFA460008QG0R00229616S, 081KRFA460008QG0R00061SXRW, 081KRHWGX0008QG0R003NT6DY9]
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

- 081KR7JY10008QG0R000R503K2 (bus protocol) — shared transport
- 081KRFA460008QG0R001KC0VBH/0441/0442 (bg-services) — same nudge/assignment/cascade topics
- 081KRHWGX0008QG0R003NT6DY9 (Lior launchd integration) — dual-loop pattern precedent

## Status

Open. Design approved by Aaron 2026-05-15. Implementation queued for next autonomous cycle or explicit dispatch.

## Renumber history

This row was originally filed as **081KRHWGX0008QG0R001XFRAHC** on 2026-05-15. The ID collided with a pre-existing P2 row (`081KRHWGX0008QG0R001XFRAHC-substrate-evolution-algebra-rule-promotion-after-cooling-period-2026-05-14.md`, dated 2026-05-14). Per the `b0451_per_collision_renumber_procedure` memory and 081KRMEXM0008QG0R000ARAR7P's filed-correction surface, first-merged-wins applies: the 2026-05-14 algebra row keeps 081KRHWGX0008QG0R001XFRAHC, and this row renumbers.

Renumber target was chosen by re-running `refresh-before-decide.md` at ID-allocation scope: 081KRMEXM0008QG0R000ARAR7P originally noted 081KRMEXM0008QG0R00278KS63 as next-free, but between filing (2026-05-15T22:55Z) and execution (2026-05-16T01:53Z), 081KRMEXM0008QG0R00278KS63/081KRMEXM0008QG0R001VGNET5/081KRQ1AB0008QG0R002DQBGZF were claimed. Next-free at execution time was **081KRMEXM0008QG0R00037RGNY**.

**Immutable historical references that still quote `081KRHWGX0008QG0R001XFRAHC` in the Riven sense:**

- PR #3603 (merged) — `feat(riven): Riven cursor-terminal loop scaffold [081KRHWGX0008QG0R001XFRAHC] (decomposed)` — merged-PR title, historical record only.
- `docs/hygiene-history/ticks/2026/05/15/2217Z.md` — tick shard, immutable per `tick-shards-are-immutable` discipline.
- `docs/pr-discussions/PR-3619-*` — PR-discussion archive of the 081KRMEXM0008QG0R000ARAR7P filing PR, references the Riven 081KRHWGX0008QG0R001XFRAHC in the renumber-target context. Historical record.

These artifacts are NOT edited. Readers encountering `081KRHWGX0008QG0R001XFRAHC` in the Riven sense should resolve to this row (081KRMEXM0008QG0R00037RGNY) via the `renumbered_from: 081KRHWGX0008QG0R001XFRAHC` frontmatter.

**Composes with:**

- `memory/feedback_b0451_per_collision_renumber_procedure_external_references_rule_trumps_first_merged_2026_05_14.md` (the renumber rule)
- 081KRMEXM0008QG0R000ARAR7P (the filed-correction surface)
- `.claude/rules/claim-acquire-before-worktree-work.md` (ID allocation discipline that the original collision violated)
