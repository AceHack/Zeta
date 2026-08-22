#!/usr/bin/env bun
/**
 * tick-metrics-writer.ts — compute observe loop metrics and append to the ledger.
 *
 * Reads the event log (docs/observe-events/*.json), computes aggregate metrics,
 * and appends a frame to data/tick-history.json. The file IS the ledger — append-only,
 * served by GitHub Pages, fetched same-origin by the dashboard.
 *
 * Called by .github/workflows/tick-metrics.yml on every push to main + schedule.
 *
 * Frame shape (per the design handoff data contract):
 *   { t, total_events, last_action, last_mode, last_agent, entropy_state, entropy_heat,
 *     ticks_24h, agents_active, claims_pending }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const EVENT_DIR = join(REPO_ROOT, "docs", "observe-events");
const HISTORY_FILE = join(REPO_ROOT, "data", "tick-history.json");
const LATEST_FILE = join(REPO_ROOT, "data", "tick-latest.json");

interface MetricsFrame {
  readonly t: string; // ISO-8601 timestamp
  readonly total_events: number;
  readonly last_action: string;
  readonly last_mode: string;
  readonly last_agent: string;
  readonly entropy_state: number;
  readonly entropy_heat: number;
  readonly ticks_24h: number;
  readonly agents_active: number;
  readonly claims_pending: number;
}

interface HistoryLedger {
  readonly provenance: { readonly generator: string; readonly mock: boolean };
  readonly frames: readonly MetricsFrame[];
}

function loadHistory(): HistoryLedger {
  if (!existsSync(HISTORY_FILE)) {
    return {
      provenance: { generator: "tick-metrics-writer.ts", mock: false },
      frames: [],
    };
  }
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, "utf-8")) as HistoryLedger;
  } catch {
    return {
      provenance: { generator: "tick-metrics-writer.ts", mock: false },
      frames: [],
    };
  }
}

function readEventEnvelopes(): Array<{ id: string; at: string; by: string; action: { kind: string }; entropy?: { entropy_state: number; entropy_heat: number } }> {
  const dir = EVENT_DIR;
  if (!existsSync(dir)) return [];
  const { readdirSync } = require("node:fs");
  const files = readdirSync(dir).filter((f: string) => f.endsWith(".json"));
  const envelopes: Array<{ id: string; at: string; by: string; action: { kind: string }; entropy?: { entropy_state: number; entropy_heat: number } }> = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(join(dir, file), "utf-8"));
      if (raw && raw.id && raw.at && raw.action) envelopes.push(raw);
    } catch { /* skip malformed */ }
  }
  return envelopes.sort((a, b) => a.at < b.at ? -1 : 1);
}

function computeFrame(): MetricsFrame {
  const envelopes = readEventEnvelopes();
  const now = new Date();
  const last = envelopes[envelopes.length - 1];

  // 24h window
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const recent = envelopes.filter(e => e.at >= cutoff);

  // Active agents in last 24h
  const activeAgents = new Set(recent.map(e => e.by));

  // Last entropy snapshot
  const lastWithEntropy = [...envelopes].reverse().find(e => e.entropy);
  const entropy = lastWithEntropy?.entropy ?? { entropy_state: 0, entropy_heat: 0 };

  // Claims pending (self_claim actions without a matching do_item completion)
  const claims = envelopes.filter(e => e.action.kind === "self_claim");
  const completions = new Set(envelopes.filter(e => e.action.kind === "do_item").map(e => (e.action as { item?: { id?: string } }).item?.id));
  const pendingClaims = claims.filter(e => !completions.has((e.action as { item?: { id?: string } }).item?.id)).length;

  return {
    t: now.toISOString(),
    total_events: envelopes.length,
    last_action: last?.action.kind ?? "none",
    last_mode: last?.action.kind === "explore" || last?.action.kind === "free_time" || last?.action.kind === "play" || last?.action.kind === "self_reflect" ? last.action.kind : "work",
    last_agent: last?.by ?? "unknown",
    entropy_state: entropy.entropy_state,
    entropy_heat: entropy.entropy_heat,
    ticks_24h: recent.length,
    agents_active: activeAgents.size,
    claims_pending: pendingClaims,
  };
}

function main(): void {
  const history = loadHistory();
  const frame = computeFrame();

  // Append the frame
  const updated: HistoryLedger = {
    ...history,
    provenance: { generator: "tick-metrics-writer.ts", mock: false },
    frames: [...history.frames, frame],
  };

  // Write both files
  mkdirSync(join(REPO_ROOT, "data"), { recursive: true });
  writeFileSync(HISTORY_FILE, JSON.stringify(updated, null, 2) + "\n");
  writeFileSync(LATEST_FILE, JSON.stringify(frame, null, 2) + "\n");

  console.log(`[tick-metrics] Appended frame #${updated.frames.length}`);
  console.log(`  t: ${frame.t}`);
  console.log(`  total_events: ${frame.total_events}`);
  console.log(`  last_action: ${frame.last_action}`);
  console.log(`  ticks_24h: ${frame.ticks_24h}`);
  console.log(`  agents_active: ${frame.agents_active}`);
  console.log(`  entropy: state=${frame.entropy_state} heat=${frame.entropy_heat}`);
  console.log(`  claims_pending: ${frame.claims_pending}`);
}

main();
