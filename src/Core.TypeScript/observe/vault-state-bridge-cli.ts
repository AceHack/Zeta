#!/usr/bin/env bun
/**
 * vault-state-bridge-cli.ts — thin I/O wrapper around buildVaultState.
 *
 * Reads the event files + tick-history + drift-ledger, calls the pure adapter,
 * writes data/vault-roster.json + data/vault-state.json.
 *
 * Usage:
 *   bun src/Core.TypeScript/observe/vault-state-bridge-cli.ts \
 *     --events-dir docs/observe-events \
 *     --tick-history data/tick-history.json \
 *     --drift-ledger data/drift-mtth.json \
 *     --output-dir data
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildVaultState, buildRoster, type ObserveEvent, type TickHistory, type DriftLedger } from "./vault-state-bridge";

interface CliArgs {
  eventsDir: string;
  tickHistory: string;
  driftLedger: string;
  outputDir: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    eventsDir: "docs/observe-events",
    tickHistory: "data/tick-history.json",
    driftLedger: "data/drift-mtth.json",
    outputDir: "data",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--events-dir" && argv[i + 1]) args.eventsDir = argv[++i]!;
    else if (arg === "--tick-history" && argv[i + 1]) args.tickHistory = argv[++i]!;
    else if (arg === "--drift-ledger" && argv[i + 1]) args.driftLedger = argv[++i]!;
    else if (arg === "--output-dir" && argv[i + 1]) args.outputDir = argv[++i]!;
  }
  return args;
}

function readEvents(dir: string): ObserveEvent[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  } catch {
    console.warn(`[bridge] cannot read events dir: ${dir}`);
    return [];
  }

  const events: ObserveEvent[] = [];
  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === "string" && typeof parsed.at === "string" && typeof parsed.by === "string") {
        events.push(parsed as ObserveEvent);
      }
    } catch {
      // Skip malformed files silently — the adapter handles missing data honestly
    }
  }
  return events;
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  console.log(`[bridge] reading events from ${args.eventsDir}`);
  const events = readEvents(args.eventsDir);
  console.log(`[bridge] ${events.length} events loaded`);

  const tickHistory = readJson<TickHistory>(args.tickHistory) ?? { frames: [] };
  const driftLedger = readJson<DriftLedger>(args.driftLedger);

  const nowMs = Date.now();
  const state = buildVaultState({ events, tickHistory, driftLedger, nowMs });
  const roster = buildRoster();

  mkdirSync(args.outputDir, { recursive: true });

  const rosterPath = join(args.outputDir, "vault-roster.json");
  const statePath = join(args.outputDir, "vault-state.json");

  writeFileSync(rosterPath, JSON.stringify(roster, null, 2) + "\n");
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");

  console.log(`[bridge] wrote ${rosterPath} (roster: ${roster.agents.length} agents, ${roster.vaults.length} vaults, ${roster.hats.length} hats)`);
  console.log(`[bridge] wrote ${statePath} (status=${state.status}, ${state.total_events_read} events, frame=${state.tick_frame_t})`);
}

main();
