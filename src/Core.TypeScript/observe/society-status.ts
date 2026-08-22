#!/usr/bin/env bun
/**
 * society-status.ts — "how's the society doing right now?" in one screen.
 *
 * Pulls together all observability surfaces into a single coherent view:
 *   - Agent health (cadence, phases, last seen)
 *   - ECC coverage (blocks, gaps, next emission)
 *   - Connectivity (mutual attestation)
 *   - Forge health (CI drift rate, red/green trend)
 *   - Vault status (per-vault liveness)
 *   - Forward progress (events/day trend, work vs explore ratio)
 *
 * ## Design principles
 *
 * 1. FORGE-AGNOSTIC: reads from data/ files (tick-history, vault-state, rs-blocks)
 *    that any forge host produces. No GitHub API calls. When we move to decentralized
 *    git, this CLI works unchanged because it reads the same data contracts.
 *
 * 2. DRIFT-ORIENTED: doesn't ask "is CI green?" — asks "what's the red/green rate
 *    over time?" A society that patches drift continuously is healthier than one that
 *    blocks on every failure. The metric is convergence rate, not instantaneous state.
 *
 * 3. PLUGGABLE: each section is a pure function of a data file. Add a new forge host,
 *    keep the same file contracts, the dashboard works.
 *
 * Usage:
 *   bun src/Core.TypeScript/observe/society-status.ts
 *   bun src/Core.TypeScript/observe/society-status.ts --json
 *   bun src/Core.TypeScript/observe/society-status.ts --section agents
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ═══ Data Loading (forge-agnostic — reads file contracts, not APIs) ═══════════

interface TickFrame {
  t: string;
  total_events: number;
  ticks_24h: number;
  agents_active: number;
  last_agent: string;
  last_action: string;
}

interface VaultState {
  status: string;
  generated_at_ms: number;
  total_events_read: number;
  max_phase: number | null;
  connectivity?: { agent_id: string; connectivity: number; reciprocity: number }[];
  vaults: { id: string; status: string; confidence: { value: number; epsilon: number } }[];
}

interface RSBlock {
  agent: string;
  seq: number;
  startPhase: number;
  endPhase: number;
  emittedAt: string;
}

function loadJSON<T>(path: string): T | null {
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return null; }
}

function loadJSONL<T>(path: string): T[] {
  try {
    return readFileSync(path, "utf-8").trim().split("\n")
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));
  } catch { return []; }
}

// ═══ Sections ═════════════════════════════════════════════════════════════════

interface AgentHealth {
  agent: string;
  eventCount: number;
  lastSeen: string | null;
  ageMinutes: number | null;
  phase: number;
  healthy: boolean;
}

function assessAgents(eventDir: string, nowMs: number): AgentHealth[] {
  const agents = ["alexa", "otto", "soraya"];
  const result: AgentHealth[] = [];

  for (const agent of agents) {
    let count = 0;
    let lastAt: string | null = null;
    let maxPhase = 0;

    const files = readdirSync(eventDir).filter((f) => f.endsWith(".json")).sort();
    // Scan last 500 events — enough to cover ~5 days of heartbeats while staying fast.
    // ZetaId filenames are time-ordered, so the tail is the most recent.
    const recentFiles = files.slice(-500);
    for (const f of recentFiles) {
      try {
        const e = JSON.parse(readFileSync(join(eventDir, f), "utf-8"));
        if (e.by !== agent) continue;
        count++;
        if (!lastAt || e.at > lastAt) lastAt = e.at;
        if (e.phase?.phase > maxPhase) maxPhase = e.phase.phase;
      } catch { /* skip */ }
    }

    const ageMs = lastAt ? nowMs - new Date(lastAt).getTime() : null;
    const ageMinutes = ageMs !== null ? Math.round(ageMs / 60000) : null;
    // Healthy if seen within last 2 hours (8 ticks at 15min)
    const healthy = ageMinutes !== null && ageMinutes < 120;

    result.push({ agent, eventCount: count, lastSeen: lastAt, ageMinutes, phase: maxPhase, healthy });
  }
  return result;
}

interface ECCStatus {
  totalBlocks: number;
  agentBlocks: Record<string, number>;
  latestEmission: string | null;
  phasesCovered: { agent: string; min: number; max: number }[];
}

function assessECC(repoRoot: string): ECCStatus {
  const blocks = loadJSONL<RSBlock>(join(repoRoot, "data", "rs-blocks.jsonl"));
  const byAgent: Record<string, RSBlock[]> = {};
  for (const b of blocks) {
    (byAgent[b.agent] ??= []).push(b);
  }

  const agentBlocks: Record<string, number> = {};
  const phasesCovered: { agent: string; min: number; max: number }[] = [];
  let latestEmission: string | null = null;

  for (const [agent, agentList] of Object.entries(byAgent)) {
    agentBlocks[agent] = agentList.length;
    const phases = agentList.flatMap((b) => [b.startPhase, b.endPhase]);
    if (phases.length > 0) {
      phasesCovered.push({ agent, min: Math.min(...phases), max: Math.max(...phases) });
    }
    for (const b of agentList) {
      if (!latestEmission || b.emittedAt > latestEmission) latestEmission = b.emittedAt;
    }
  }

  return { totalBlocks: blocks.length, agentBlocks, latestEmission, phasesCovered };
}

interface ForgeHealth {
  /** Events/day over the last 7 days (from tick-history frames). */
  eventsPerDay: number;
  /** Ticks in last 24h. */
  ticks24h: number;
  /** Agents active in the latest frame. */
  agentsActive: number;
  /** Ratio of work actions (edit_grammar, decompose) to total. */
  workRatio: number;
  /** Forward progress indicator: events growing or shrinking? */
  trending: "growing" | "stable" | "shrinking";
}

function assessForgeHealth(repoRoot: string, eventDir: string): ForgeHealth {
  const tickHistory = loadJSON<{ frames: TickFrame[] }>(join(repoRoot, "data", "tick-history.json"));
  const frames = tickHistory?.frames ?? [];
  const latest = frames[frames.length - 1];

  // Events per day: compare latest total vs 7 days ago
  const weekAgoFrame = frames.length > 672 ? frames[frames.length - 672] : frames[0]; // 672 = 7 days × 96 frames/day
  const eventsPerDay = latest && weekAgoFrame
    ? (latest.total_events - weekAgoFrame.total_events) / 7
    : latest?.total_events ? latest.total_events / Math.max(1, frames.length / 96) : 0;

  // Work ratio from recent events
  let workCount = 0;
  let totalCount = 0;
  const files = readdirSync(eventDir).filter((f) => f.endsWith(".json")).sort().slice(-100);
  for (const f of files) {
    try {
      const e = JSON.parse(readFileSync(join(eventDir, f), "utf-8"));
      if (e.by && e.by !== "society") {
        totalCount++;
        const kind = e.action?.kind ?? "";
        if (kind === "edit_grammar" || kind === "decompose" || kind.includes("work")) workCount++;
      }
    } catch { /* skip */ }
  }

  const trending = eventsPerDay > 150 ? "growing" : eventsPerDay > 50 ? "stable" : "shrinking";

  return {
    eventsPerDay: Math.round(eventsPerDay),
    ticks24h: latest?.ticks_24h ?? 0,
    agentsActive: latest?.agents_active ?? 0,
    workRatio: totalCount > 0 ? workCount / totalCount : 0,
    trending,
  };
}

// ═══ Display ══════════════════════════════════════════════════════════════════

function display(repoRoot: string, eventDir: string): void {
  const nowMs = Date.now();
  const nowStr = new Date(nowMs).toISOString().replace("T", " ").slice(0, 16) + " UTC";

  console.log(`Society Status (${nowStr})`);
  console.log("─".repeat(50));

  // Agents
  const agents = assessAgents(eventDir, nowMs);
  console.log("\nAgents:");
  for (const a of agents) {
    const icon = a.healthy ? "✓" : "✗";
    const age = a.ageMinutes !== null ? `${a.ageMinutes}min ago` : "never seen";
    console.log(`  ${icon} ${a.agent}: phase=${a.phase}, last=${age}, events=${a.eventCount}`);
  }
  const allHealthy = agents.every((a) => a.healthy);
  console.log(`  ${allHealthy ? "All agents healthy" : "⚠ Some agents stale"}`);

  // ECC
  const ecc = assessECC(repoRoot);
  console.log("\nECC (Reed-Solomon [16,12]):");
  console.log(`  Blocks: ${ecc.totalBlocks} total`);
  for (const [agent, count] of Object.entries(ecc.agentBlocks)) {
    console.log(`    ${agent}: ${count} blocks`);
  }
  if (ecc.latestEmission) {
    const eccAge = Math.round((nowMs - new Date(ecc.latestEmission).getTime()) / 60000);
    console.log(`  Latest emission: ${eccAge}min ago`);
  }

  // Connectivity
  const vaultState = loadJSON<VaultState>(join(repoRoot, "data", "vault-state.json"));
  if (vaultState?.connectivity) {
    console.log("\nConnectivity:");
    for (const c of vaultState.connectivity) {
      console.log(`  ${c.agent_id}: ${(c.connectivity * 100).toFixed(0)}% connected, ${(c.reciprocity * 100).toFixed(0)}% reciprocal`);
    }
  }

  // Forge health (drift-oriented, not gate-oriented)
  const forge = assessForgeHealth(repoRoot, eventDir);
  console.log("\nForge Health (drift-oriented):");
  console.log(`  Events/day: ${forge.eventsPerDay} (trend: ${forge.trending})`);
  console.log(`  Ticks 24h: ${forge.ticks24h}`);
  console.log(`  Agents active: ${forge.agentsActive}`);
  console.log(`  Work ratio: ${(forge.workRatio * 100).toFixed(0)}% (edit_grammar+decompose vs explore)`);

  // Vault status
  if (vaultState) {
    console.log("\nVaults:");
    for (const v of vaultState.vaults) {
      const conf = `${(v.confidence.value * 100).toFixed(0)}%±${(v.confidence.epsilon * 100).toFixed(0)}%`;
      console.log(`  ${v.id}: ${v.status} (confidence: ${conf})`);
    }
    const vaultAge = Math.round((nowMs - vaultState.generated_at_ms) / 60000);
    console.log(`  Generated: ${vaultAge}min ago | Total events: ${vaultState.total_events_read}`);
  }

  // Summary line
  console.log("\n" + "─".repeat(50));
  const issues: string[] = [];
  if (!allHealthy) issues.push("agent(s) stale");
  if (forge.trending === "shrinking") issues.push("event rate declining");
  if (vaultState?.status === "cold") issues.push("vault-state cold");
  if (issues.length === 0) {
    console.log("✓ Society operational — all signals nominal");
  } else {
    console.log(`⚠ Attention: ${issues.join(", ")}`);
  }
}

// ═══ JSON output mode ═════════════════════════════════════════════════════════

function outputJSON(repoRoot: string, eventDir: string): void {
  const nowMs = Date.now();
  const agents = assessAgents(eventDir, nowMs);
  const ecc = assessECC(repoRoot);
  const forge = assessForgeHealth(repoRoot, eventDir);
  const vaultState = loadJSON<VaultState>(join(repoRoot, "data", "vault-state.json"));

  const output = {
    timestamp: new Date(nowMs).toISOString(),
    agents,
    ecc,
    forge,
    vaults: vaultState?.vaults ?? [],
    connectivity: vaultState?.connectivity ?? [],
    summary: {
      allHealthy: agents.every((a) => a.healthy),
      trending: forge.trending,
      totalBlocks: ecc.totalBlocks,
      eventsPerDay: forge.eventsPerDay,
    },
  };
  console.log(JSON.stringify(output, null, 2));
}

// ═══ Main ═════════════════════════════════════════════════════════════════════

function main(): void {
  const repoRoot = process.cwd();
  const eventDir = join(repoRoot, "docs", "observe-events");
  const jsonMode = process.argv.includes("--json");

  if (jsonMode) {
    outputJSON(repoRoot, eventDir);
  } else {
    display(repoRoot, eventDir);
  }
}

main();
