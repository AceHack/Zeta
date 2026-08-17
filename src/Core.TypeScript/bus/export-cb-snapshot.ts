#!/usr/bin/env bun
/**
 * export-cb-snapshot.ts — derive circuit-breaker state from live bus envelopes
 *
 * Reads non-expired envelopes from /tmp/zeta-bus/, groups by agent identity,
 * derives CLOSED/HALF_OPEN/OPEN/UNKNOWN state, and writes demo/circuit-breaker-snapshot.json.
 *
 * Usage:
 *   bun src/Core.TypeScript/bus/export-cb-snapshot.ts [--bus-dir <path>] [--out <path>]
 *
 * Defaults:
 *   --bus-dir  /tmp/zeta-bus
 *   --out      demo/circuit-breaker-snapshot.json  (relative to repo root)
 *
 * Run from any directory; paths resolve relative to this file's location.
 *
 * 081KRHWGX0008QG0R0029WA0HQ slice-2.
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join, resolve, dirname } from "path";
import type { MessageEnvelope, SenderAgentId } from "./types.ts";

// ── constants ─────────────────────────────────────────────────────────────────

// This file lives at src/Core.TypeScript/bus/, so the repo root is THREE levels up. It was
// "../.." while the script lived at tools/bus/, and the move left it resolving to `src/` —
// which made the default invocation crash with ENOENT on src/demo/circuit-breaker-snapshot.json.
// Found while regenerating the snapshot: the exporter had been unrunnable at its default path,
// so the artifact the demo page fetches had been frozen since 2026-05-14 while rendering as live.
const REPO_ROOT = resolve(dirname(import.meta.path), "../../..");
const DEFAULT_BUS_DIR = "/tmp/zeta-bus";
const DEFAULT_OUT = join(REPO_ROOT, "demo/circuit-breaker-snapshot.json");

/** Circuit-breaker trips at this many consecutive idle heartbeats. */
const THRESHOLD = 5;

/** Canonical identity → display metadata. Order determines output order. */
const AGENT_META: Record<string, { model: string; harness: string }> = {
  otto: { model: "Otto", harness: "Claude Code" },
  alexa: { model: "Alexa", harness: "Kiro / Qwen" },
  lior: { model: "Lior", harness: "Gemini" },
  vera: { model: "Vera", harness: "Codex / GPT" },
  riven: { model: "Riven", harness: "Grok" },
};

/** Known identity prefixes in longest-match order. */
const IDENTITIES = Object.keys(AGENT_META);

// ── helpers ───────────────────────────────────────────────────────────────────

/** Normalise a surface-tagged sender ID back to identity level.
 *  e.g. "otto-cli" → "otto", "lior-gemini" → "lior", "otto" → "otto"
 */
function toIdentity(from: SenderAgentId): string | null {
  for (const id of IDENTITIES) {
    if (from === id || from.startsWith(id + "-")) return id;
  }
  return null;
}

async function readEnvelopes(busDir: string): Promise<MessageEnvelope[]> {
  const now = Date.now();
  // Let readdir throw — silent suppression would turn a missing or unreadable bus
  // directory into a "healthy/no recent activity" snapshot, hiding misconfiguration.
  const files = await readdir(busDir);
  const envelopes: MessageEnvelope[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(await readFile(join(busDir, file), "utf8")) as MessageEnvelope;
      if (new Date(raw.expiresAt).getTime() > now) {
        envelopes.push(raw);
      }
    } catch {
      // corrupted or partial file — skip
    }
  }
  return envelopes;
}

// ── circuit-breaker derivation ────────────────────────────────────────────────

/**
 * Breaker state, with UNKNOWN as a first-class fourth value.
 *
 * **"No traffic" and "no errors" must not render as the same reading.** Before
 * 081M0148RV6087G0R001BN31P0 this function returned `CLOSED` with the note "No recent bus
 * activity — assuming healthy" whenever an identity produced zero envelopes, which inverted
 * the instrument: an agent still emitting idle heartbeats read HALF_OPEN or OPEN, while an
 * agent that had gone completely silent — the deeper outage — read healthy and green. The
 * checked-in `demo/circuit-breaker-snapshot.json` carried exactly that reading for two of
 * five agents, and `demo/index.html` fetches and renders it.
 *
 * A breaker with zero observations has not measured health; it has failed to measure. That
 * is UNKNOWN, and UNKNOWN is not a shade of CLOSED.
 */
type CbState = "CLOSED" | "HALF_OPEN" | "OPEN" | "UNKNOWN";

interface CbEntry {
  model: string;
  harness: string;
  state: CbState;
  consecutiveFailures: number;
  threshold: number;
  /**
   * How many health-bearing envelopes this state was derived from. The reading carries its
   * own denominator, so a downstream reader that ignores `state` entirely can still tell a
   * measured CLOSED from an unmeasured one.
   */
  observations: number;
  /** `null` when this identity was never observed — never a fabricated "now". */
  lastCheck: string | null;
  note: string;
}

/** Envelopes that actually carry evidence about an agent's health. */
function isHealthBearing(e: MessageEnvelope): boolean {
  return (
    e.topic === "heartbeat" || e.topic === "work-assignment" || (e.topic === "claim" && e.payload.action === "claim")
  );
}

export function deriveEntry(
  identity: string,
  meta: { model: string; harness: string },
  envelopes: MessageEnvelope[],
): CbEntry {
  // Collect envelopes from this identity (any surface variant)
  const own = envelopes
    .filter((e) => toIdentity(e.from) === identity)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const observations = own.filter(isHealthBearing).length;
  const lastCheck = own[0]?.timestamp ?? null;

  // Zero observations is the THIRD state, not the healthy one. This covers both "no envelopes
  // at all" and "envelopes present, none of them health-bearing" — in either case nothing was
  // measured, and the honest reading says so rather than defaulting to green.
  if (observations === 0) {
    return {
      model: meta.model,
      harness: meta.harness,
      state: "UNKNOWN",
      consecutiveFailures: 0,
      threshold: THRESHOLD,
      observations: 0,
      lastCheck,
      note:
        own.length === 0
          ? "No bus activity observed — health UNKNOWN, not healthy"
          : `${own.length} envelope(s) present but none health-bearing — health UNKNOWN`,
    };
  }

  // Walk newest-first and count the trailing run of idle heartbeats.
  // Stop at the first envelope that is not an idle heartbeat so that a working
  // signal resets the streak (e.g. idle→working→idle→idle counts 2, not 3).
  let consecutiveIdle = 0;
  for (const e of own) {
    if (e.topic === "heartbeat" && e.payload.status === "idle") {
      consecutiveIdle++;
    } else {
      break;
    }
  }

  // Any positive signal: active claim-acquire, work-assignment, or working heartbeat.
  // Claim-release does NOT count — an agent relinquishing work should not be treated
  // as a health signal (it may be about to go idle).
  const hasWorkSignal = own.some(
    (e) =>
      (e.topic === "claim" && e.payload.action === "claim") ||
      e.topic === "work-assignment" ||
      (e.topic === "heartbeat" && e.payload.status === "working"),
  );

  let state: CbState;
  let note: string;

  if (consecutiveIdle >= THRESHOLD) {
    state = "OPEN";
    note = `Tripped — ${consecutiveIdle} consecutive idle heartbeats exceeded threshold (${THRESHOLD})`;
  } else if (consecutiveIdle > 0) {
    state = "HALF_OPEN";
    note = `${consecutiveIdle} consecutive idle heartbeat(s) — watching; threshold ${THRESHOLD}`;
  } else if (hasWorkSignal) {
    state = "CLOSED";
    note = `Active work detected — normal operation (${observations} observation(s))`;
  } else {
    state = "CLOSED";
    note = `Health-bearing activity present, no idle pattern detected (${observations} observation(s))`;
  }

  return {
    model: meta.model,
    harness: meta.harness,
    state,
    consecutiveFailures: consecutiveIdle,
    threshold: THRESHOLD,
    observations,
    lastCheck,
    note,
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const busDir = args.includes("--bus-dir")
    ? (args[args.indexOf("--bus-dir") + 1] ?? DEFAULT_BUS_DIR)
    : DEFAULT_BUS_DIR;
  const outPath = args.includes("--out") ? (args[args.indexOf("--out") + 1] ?? DEFAULT_OUT) : DEFAULT_OUT;

  let envelopes: MessageEnvelope[];
  try {
    envelopes = await readEnvelopes(busDir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Cannot read bus directory ${busDir}: ${msg}`);
    process.exit(1);
  }

  const entries: CbEntry[] = Object.entries(AGENT_META).map(([id, meta]) => deriveEntry(id, meta, envelopes));

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "src/Core.TypeScript/bus/export-cb-snapshot.ts",
    busDir,
    envelopeCount: envelopes.length,
    entries,
  };

  await writeFile(outPath, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Wrote ${entries.length} entries (${envelopes.length} envelopes) → ${outPath}`);
}

if (import.meta.main) {
  main();
}
