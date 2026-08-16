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
import { createHash } from "node:crypto";
import { join } from "node:path";
import { buildAttestation } from "./attestation-event";
import { pack, type SimulationEnvironment } from "../zeta-id/zeta-id";
import {
  Category,
  Chromosome,
  IdVersion,
  LocationHint,
  Persona,
  type Milliseconds,
  type ZetaObservation,
} from "../zeta-id/types";

/**
 * How many recent events to consider. This is a bound on work, NOT a time window —
 * the time window is `WINDOW_MS`, applied to each event's `at` field. See
 * `selectRecentEvents` for why the two must not be conflated.
 */
const SCAN_LIMIT = 200;

/** The attestation window: events older than this are not attested. */
const WINDOW_MS = 30 * 60 * 1000;

// ═══ Derived attestation id ════════════════════════════════════════════════════
//
// DERIVED mint, not MINTED — per the derived-vs-minted discipline in
// `docs/research/2026-08-14-zetaid-universal-pointer-derived-vs-minted-declared-sort-fields-and-why-v3-is-not-needed.md`
// §6a. The test there is "if two parties construct this independently, must they
// agree?" For an attestation dedup key the answer is yes: re-running the tick must
// re-derive the same id so the `flag: "wx"` write dedups (G-set idempotency) instead
// of appending a duplicate fact.
//
// Discrimination is 80 bits: 48 bits of `timestamp` (the window end — a stable
// property of the subject, which §6a-1 explicitly sanctions for a DERIVED mint) plus
// 32 bits of `randomness` carrying a SHA-256 digest of the full subject tuple. The
// same doc §7 puts 80 bits at p < 10⁻¹⁶ over a corpus this size.
//
// Pattern copied from `forge-host/github/pr-manifest-shards.ts` `shardZetaId`: the
// `SimulationEnvironment` that `pack` requires is satisfied by the subject itself, so
// this mint needs no DST boundary — there is no ambient non-determinism to inject.

/**
 * Derive the attestation's ZetaId. PURE in (attestor, attested, windowEnd) — no clock,
 * no CSPRNG. Distinct subjects give distinct ids; identical subjects give the same id.
 */
export function deriveAttestationId(attestor: string, attested: string, windowEnd: string): string {
  // Length-prefixed so ("ab","c") and ("a","bc") cannot digest to the same bytes.
  const subject = [attestor, attested, windowEnd].map((s) => `${s.length}:${s}`).join("|");
  const digest = createHash("sha256").update(subject, "utf8").digest();
  const rand = BigInt(digest.readUInt32BE(0));

  const windowMs = Date.parse(windowEnd);
  const keyEnv: SimulationEnvironment = { nextInt64: () => rand };
  const obs: ZetaObservation = {
    version: IdVersion.V1,
    // The subject's own window end, not a mint clock: a timestamp that moved would
    // move the attestation's identity and break the dedup this id exists to provide.
    timestamp: (Number.isNaN(windowMs) ? 0 : windowMs) as Milliseconds,
    chromosome: Chromosome.MetaCoherence,
    // Same category as every other observe-event in this folder
    // (`event-sink-folder.ts` `mintObserveEventIdHex`) — an attestation is a
    // planning/workflow fact and sorts alongside its siblings.
    category: Category.WorkItem,
    authority: { type: "TrustedAgent" },
    persona: Persona.FireflyCoherence,
    momentum: { type: "Normal" },
    location: LocationHint.EastUS_VA1,
  };
  return pack(obs, keyEnv).toString(16).padStart(32, "0");
}

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

/** The minimum an event must carry to be attestable. */
export interface ObservedEvent {
  readonly by: string;
  readonly at: string;
}

export interface PeerWindow {
  count: number;
  earliest: string;
  latest: string;
}

/**
 * Fold the events a given attestor can attest, keyed by peer.
 *
 * NOTE the ordering discipline, which is the whole reason this is a named function.
 * `docs/observe-events/` holds THREE filename schemes — 32-hex ZetaIds
 * (`mintObserveEventIdHex`), `society-<base36ms>` (`planning/society-evolution-runner.ts`),
 * and three frozen legacy names (see `docs/observe-events/README.md`). Lexical filename
 * order is therefore NOT time order: every `society-*` name sorts after every hex name,
 * regardless of when it was written.
 *
 * The previous implementation took `files.sort().slice(-50)` as "the recent events". On
 * the real corpus that window was 100% `society-*` events, so no agent heartbeat was ever
 * a candidate and the only peer anyone could attest was `society` itself. Recency is
 * decided HERE, on the parsed `at` field, and never on the filename.
 */
export function selectRecentEvents(
  events: readonly ObservedEvent[],
  attestor: string,
  nowMs: number,
  windowMs: number = WINDOW_MS,
): Map<string, PeerWindow> {
  const cutoff = nowMs - windowMs;
  const peerEvents = new Map<string, PeerWindow>();

  for (const raw of events) {
    if (!raw.by || !raw.at || raw.by === attestor) continue;
    const eventTime = Date.parse(raw.at);
    if (Number.isNaN(eventTime) || eventTime < cutoff) continue;

    const existing = peerEvents.get(raw.by);
    if (existing) {
      existing.count++;
      if (raw.at < existing.earliest) existing.earliest = raw.at;
      if (raw.at > existing.latest) existing.latest = raw.at;
    } else {
      peerEvents.set(raw.by, { count: 1, earliest: raw.at, latest: raw.at });
    }
  }
  return peerEvents;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const now = Date.now();

  // Read recent events
  let files: string[];
  try {
    files = readdirSync(args.eventDir).filter((f) => f.endsWith(".json"));
  } catch {
    console.log("[attestation] no event dir — skipping");
    return;
  }

  // Parse first, then order by the event's OWN time. Filename order is not time order
  // in this folder (see `selectRecentEvents`), so the scan bound must be applied to
  // timestamps — applying it to filenames is what silenced peer attestation.
  const parsed: ObservedEvent[] = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(readFileSync(join(args.eventDir, f), "utf-8"));
      if (typeof raw?.by === "string" && typeof raw?.at === "string") {
        parsed.push({ by: raw.by, at: raw.at });
      }
    } catch { /* skip malformed */ }
  }
  parsed.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const recent = parsed.slice(-SCAN_LIMIT);

  const peerEvents = selectRecentEvents(recent, args.attestor, now);

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

    // Derived ZetaId (deterministic — same attestation = same ID = idempotent).
    // This previously hex-encoded the JSON and truncated to 32 chars, which is 16 bytes
    // of `{"attestor":"xyz` — so the id was a function of the attestor's first three
    // characters only, `attested` and `window` never reached it, and every attestation
    // after the first per attestor was discarded by the EEXIST branch below while
    // logging "already attested (idempotent)".
    const id = deriveAttestationId(args.attestor, peer, data.latest);

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

// Guarded so the pure helpers above can be imported by tests without the CLI running
// (repo convention: `golden-vectors.ts`, `society-evolution-runner.ts`, …).
if (import.meta.main) main();
