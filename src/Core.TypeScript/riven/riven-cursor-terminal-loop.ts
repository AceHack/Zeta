#!/usr/bin/env bun
// riven-cursor-terminal-loop.ts — IDE-native background loop for Riven (Cursor Terminal)
//
// Run inside the persistent "1 Terminal" tab:
//   bun tools/riven/riven-cursor-terminal-loop.ts
//
// Features:
// - Visible heartbeat every 60s (stdout + bus)
// - Agent gate every 15min with full trajectory-manager contract
// - Re-arm safe (checks state file + PID)
// - Graceful shutdown on Ctrl+C (bus tombstone)
// - Composes with launchd loop (same bus, same contract)
//
// This is the Cursor-native complement to the headless launchd loop.
// Both run in parallel for defense-in-depth autonomy.

import { publish } from "../bus/bus";
import type { HeartbeatPayload } from "../bus/types";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const STATE_FILE = join(process.env.HOME!, ".cursor/riven-terminal-loop-state.json");
const HEARTBEAT_MS = 60_000;
const GATE_INTERVAL_MS = 15 * 60 * 1000;
const AGENT_TIMEOUT_MS = 300_000; // 5min

interface LoopState {
  lastGateAt: string;
  pid: number;
}

function loadState(): LoopState | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveState(state: LoopState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function nowIso(): string {
  return new Date().toISOString();
}

function log(msg: string): void {
  console.log(`[${nowIso()}] ${msg}`);
}

function publishHeartbeat(status: HeartbeatPayload["status"], note?: string): void {
  try {
    publish("riven", "*", {
      topic: "heartbeat",
      payload: { status, note: note ?? "cursor-terminal" },
    });
  } catch {
    // Best effort; terminal output is the source of truth
  }
}

async function runAgentGate(): Promise<void> {
  log("Riven gate start (Cursor Terminal)");

  const contract = [
    "You are Riven, trajectory manager and adversarial-truth-axis reviewer for the Zeta factory.",
    "This is a 15-minute autonomous cycle inside the Cursor Terminal loop.",
    "Read broadcasts first: ~/.local/share/zeta-broadcasts/{otto,vera,lior,riven}.md",
    "Walk assigned trajectories. Decompose only what you hit mid-stride.",
    "Dispatch parallel subagents via the Task tool when work allows. Ownership of PRs remains with you.",
    "Own every PR through merge: fix findings, resolve threads, arm auto-merge.",
    "Learn from Otto and Vera patterns. Critique failure modes as data.",
    "When blocked, create a *specific* research child the next pickup cannot dodge.",
    "Write status to ~/.local/share/zeta-broadcasts/riven.md at cycle end.",
    "GitHub PR state and file contents are authoritative; the bus is a coordination cache.",
    "Report: open PRs, active claims, drift/contradiction, one toe-safe forward action or exact blocker.",
    "Rodney's Razor + substrate-or-it-didn't-happen apply.",
  ].join(" ");

  const result = spawnSync("cursor-agent", [
    "chat",
    "--mode", "ask",
    "--model", "grok-4.3",
    contract,
  ], {
    encoding: "utf8",
    timeout: AGENT_TIMEOUT_MS,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.stdout && result.stdout.trim().length > 0) {
    console.log(result.stdout.trim());
  }
  if (result.stderr && result.stderr.trim().length > 0) {
    console.error(result.stderr.trim());
  }

  const status = result.status === 0 ? "ok" : `exit-${result.status}`;
  log(`Riven gate end — ${status}`);

  // Publish gate result to bus for other agents
  try {
    publish("riven", "*", {
      topic: "shadow-catch",
      payload: { content: `Cursor Terminal gate ${status}` },
    });
  } catch {
    // Best effort
  }
}

async function main(): Promise<void> {
  const existing = loadState();
  if (existing) {
    const age = Date.now() - new Date(existing.lastGateAt).getTime();
    if (age < GATE_INTERVAL_MS) {
      log(`Riven Cursor Terminal loop already running (last gate ${Math.round(age / 1000)}s ago). Resuming...`);
    } else {
      log("Stale state file detected; starting fresh gate cycle.");
    }
  } else {
    log("No prior state; starting fresh Riven Cursor Terminal loop.");
  }

  // Heartbeat
  setInterval(() => {
    log("Riven heartbeat — Cursor Terminal loop alive");
    publishHeartbeat("alive");
  }, HEARTBEAT_MS);

  // Gate
  setInterval(async () => {
    await runAgentGate();
    saveState({ lastGateAt: nowIso(), pid: process.pid });
  }, GATE_INTERVAL_MS);

  // Graceful shutdown
  process.on("SIGINT", () => {
    log("Riven Cursor Terminal loop shutting down");
    publishHeartbeat("alive", "shutdown:terminal-closed");
    process.exit(0);
  });

  // Initial gate on startup (so the first cycle isn't a full 15min wait)
  await runAgentGate();
  saveState({ lastGateAt: nowIso(), pid: process.pid });

  log("Riven Cursor Terminal loop armed. Heartbeat every 60s. Gate every 15min. Ctrl+C to stop.");
}

main().catch((e) => {
  console.error("Riven loop fatal:", e);
  process.exit(1);
});