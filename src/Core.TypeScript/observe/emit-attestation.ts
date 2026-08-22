#!/usr/bin/env bun
/**
 * emit-attestation.ts — emit a peer attestation event into the event log.
 *
 * Called by the heartbeat workflow: each agent attests the events it sees
 * from its peers during the tick. This is the symmetric "everyone IS IT"
 * attestation — you attest what you observe, your peers attest you.
 *
 * The attestation is a durable G-set event (same shape as heartbeat events)
 * that records: "I (attestor) saw N events from (attested) in this window."
 *
 * Usage:
 *   bun src/Core.TypeScript/observe/emit-attestation.ts \
 *     --attestor otto --event-dir docs/observe-events
 *
 * Scans the last 20 events, finds peers' recent events (last 30min), and
 * emits one attestation per peer that produced events in that window.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildAttestation } from "./attestation-event";

interface CliArgs {
  attestor: string;
  eventDir: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    attestor: process.env.ZETA_AGENT_ID ?? "alexa",
    eventDir: "docs/observe-events",
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--attestor" && argv[i + 1]) args.attestor = argv[++i]!;
    else if (argv[i] === "--event-dir" && argv[i + 1]) args.eventDir = argv[++i]!;
  }
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const now = Date.now();
  const thirtyMinAgo = now - 30 * 60 * 1000;

  // Read recent events
  let files: string[];
  try {
    files = readdirSync(args.eventDir).filter((f) => f.endsWith(".json")).sort();
  } catch {
    console.log("[attestation] no event dir — skipping");
    return;
  }

  const recent = files.slice(-50);
  const peerEvents = new Map<string, { count: number; earliest: string; latest: string }>();

  for (const f of recent) {
    try {
      const raw = JSON.parse(readFileSync(join(args.eventDir, f), "utf-8"));
      if (!raw.by || !raw.at || raw.by === args.attestor) continue;
      const eventTime = new Date(raw.at).getTime();
      if (eventTime < thirtyMinAgo) continue;

      const existing = peerEvents.get(raw.by);
      if (existing) {
        existing.count++;
        if (raw.at < existing.earliest) existing.earliest = raw.at;
        if (raw.at > existing.latest) existing.latest = raw.at;
      } else {
        peerEvents.set(raw.by, { count: 1, earliest: raw.at, latest: raw.at });
      }
    } catch { /* skip malformed */ }
  }

  if (peerEvents.size === 0) {
    console.log("[attestation] no peer events in last 30min — nothing to attest");
    return;
  }

  // Emit one attestation event per peer
  const nowIso = new Date(now).toISOString();
  mkdirSync(args.eventDir, { recursive: true });

  for (const [peer, data] of peerEvents) {
    const attestation = buildAttestation({
      attestor: args.attestor,
      attested: peer,
      eventCount: data.count,
      windowStart: data.earliest,
      windowEnd: data.latest,
      // All peers that we're attesting in this tick are simultaneous participants
      simultaneousParticipants: [...peerEvents.keys()].filter((p) => p !== peer),
    });

    // Mint ID from content hash (deterministic — same attestation = same ID = idempotent)
    const content = JSON.stringify({ attestor: args.attestor, attested: peer, window: data.latest });
    const id = Buffer.from(content).toString("hex").slice(0, 32).padEnd(32, "0");

    const envelope = {
      id,
      at: nowIso,
      by: args.attestor,
      kind: "attestation",
      action: { kind: "attest_peer", reason: `verified ${data.count} events from ${peer}` },
      attestation,
    };

    const filePath = join(args.eventDir, `${id}.json`);
    try {
      writeFileSync(filePath, JSON.stringify(envelope, null, 2) + "\n", { flag: "wx" });
      console.log(`[attestation] ${args.attestor} → ${peer}: ${data.count} events attested (strength: ${attestation.strength.toFixed(2)})`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") {
        // Idempotent: same attestation already exists — that's fine (G-set dedup)
        console.log(`[attestation] ${args.attestor} → ${peer}: already attested (idempotent)`);
      } else {
        console.warn(`[attestation] write failed: ${(err as Error).message}`);
      }
    }
  }
}

main();
