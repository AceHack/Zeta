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
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PRODUCER CAN AND CANNOT SAY (work-item 081M0BTG2M7087G0R0011X5ESW)
 * ---------------------------------------------------------------------------
 * It emits an UNBOUND record: `--attestor` / `$ZETA_AGENT_ID` is a plain string
 * and nothing here holds a key, so the `by` field is a self-claim. That is stated
 * on every write rather than hidden, and the record it writes is now SIGNABLE by
 * whoever does hold the key — the canonical bytes, the persona binding and the
 * verifier live in `attestation-record.ts`, and `verify-attestation-events.ts`
 * prints the bytes for `ssh-keygen -Y sign`.
 *
 * What it CAN now say honestly: exactly WHICH events it read. Each attestation
 * carries `attestedDigest`, a SHA-256 over the sorted set of the attested event
 * ids, so a peer holding those events recomputes and gets identity or
 * contradiction. Before this the record carried only `eventCount` — a count,
 * which identifies nothing.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildAttestation } from "./attestation-event";
import { attestedEventsDigest, deriveAttestationId, isPersonaName, verifyAttestationId } from "./attestation-record";

/**
 * How many recent events to consider. This is a bound on work, NOT a time window —
 * the time window is `WINDOW_MS`, applied to each event's `at` field. See
 * `selectRecentEvents` for why the two must not be conflated.
 */
const SCAN_LIMIT = 200;

/** The attestation window: events older than this are not attested. */
const WINDOW_MS = 30 * 60 * 1000;

// The derived-id mint moved to `attestation-record.ts` so the VERIFIER can
// recompute it without importing this CLI module. Re-exported here because that is
// where callers and tests have always found it, and because moving a function is
// not a reason to break them.
export { deriveAttestationId } from "./attestation-record";

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
  /**
   * The event's id — its filename stem, which is what a peer holding the folder
   * sees. REQUIRED: without ids there is no set to digest, and an attestation
   * that cannot name its subject is the vacuity class.
   */
  readonly id: string;
  readonly by: string;
  readonly at: string;
}

export interface PeerWindow {
  count: number;
  earliest: string;
  latest: string;
  /** The ids attested — the SET the digest is taken over. Deduplicated at digest time. */
  ids: string[];
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
    if (!raw.id || !raw.by || !raw.at || raw.by === attestor) continue;
    // A peer's `by` becomes this attestation's `attested` AND every sibling's
    // `simultaneousParticipants` entry. Six committed records name
    // `/tmp/attest-<random>` as their attested peer because nothing checked here.
    // A filesystem path is not a persona; refuse it before it becomes history.
    if (!isPersonaName(raw.by)) continue;
    const eventTime = Date.parse(raw.at);
    if (Number.isNaN(eventTime) || eventTime < cutoff) continue;

    const existing = peerEvents.get(raw.by);
    if (existing) {
      existing.count++;
      existing.ids.push(raw.id);
      if (raw.at < existing.earliest) existing.earliest = raw.at;
      if (raw.at > existing.latest) existing.latest = raw.at;
    } else {
      peerEvents.set(raw.by, { count: 1, earliest: raw.at, latest: raw.at, ids: [raw.id] });
    }
  }
  return peerEvents;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  // THE CHEAP GUARD, at the point where it is cheap. `--attestor` /
  // `$ZETA_AGENT_ID` is a plain string, and on 2026-08-17 six attestations naming
  // `/tmp/attest-<random>` as their attestor were written, committed, and merged
  // to main. Binding the attestor to a key (`attestation-record.ts`) is the real
  // fix and needs a key holder; refusing a value that is not even shaped like a
  // persona needs a regex, and would have caught this on its own.
  //
  // FAIL CLOSED. This exits non-zero rather than skipping the tick: an attestor
  // this process cannot name is not a peer-observation problem to route around,
  // it is a caller bug, and writing nothing is the correct output.
  if (!isPersonaName(args.attestor)) {
    console.error(
      `[attestation] REFUSED: attestor ${JSON.stringify(args.attestor)} is not a persona name ` +
        "(lowercase ASCII, no slashes, no spaces). A filesystem path is not an identity.",
    );
    process.exitCode = 1;
    return;
  }

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
  let idMismatches = 0;
  for (const f of files) {
    const stem = f.slice(0, -".json".length);
    try {
      const raw = JSON.parse(readFileSync(join(args.eventDir, f), "utf-8"));
      if (typeof raw?.by !== "string" || typeof raw?.at !== "string") continue;
      // The id attested is the FILENAME STEM — that is what a peer holding this
      // folder sees and what the digest must be recomputable from. When the record
      // also carries an `id`, the two must agree: a file whose internal id names a
      // different event is exactly the substitution this work-item is about, and
      // attesting it would put a digest over ids nobody can reproduce. Skipped
      // rather than dropped silently — the count is printed below.
      if (typeof raw?.id === "string" && raw.id !== stem) {
        idMismatches++;
        continue;
      }
      parsed.push({ id: stem, by: raw.by, at: raw.at });
    } catch { /* skip malformed */ }
  }
  if (idMismatches > 0) {
    console.warn(`[attestation] skipped ${idMismatches} event(s) whose internal id disagreed with their filename`);
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
    // The evidence pointer: a SHA-256 over the sorted, deduplicated set of ids this
    // attestation is about. `eventCount` alone is a count and identifies nothing.
    const attestedDigest = attestedEventsDigest(data.ids);

    const attestation = buildAttestation({
      attestor: args.attestor,
      attested: peer,
      eventCount: data.count,
      windowStart: data.earliest,
      windowEnd: data.latest,
      attestedDigest,
      // All peers that we're attesting in this tick are simultaneous participants.
      // The subject itself is excluded (it is `peer`); the attestor is never in the
      // map, since `selectRecentEvents` drops its own events.
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
      // "read", not "verified": this producer lists a directory, parses JSON, and
      // checks that `by`/`at` are strings. Nothing here establishes that an event is
      // genuine, and the reason line must not say otherwise.
      action: { kind: "attest_peer", reason: `read ${data.count} events from ${peer}` },
      attestation,
    };

    // The producer checks its own id before writing. The id is the G-set dedup key,
    // so a record whose id does not derive from its own fields is not deduplicable —
    // and the only check downstream was `^[0-9a-f]{32}\.json$`, a shape standing in
    // for a value. Cheap here; impossible to reconstruct later.
    if (!verifyAttestationId({ id, attestation })) {
      console.error(`[attestation] REFUSED to write ${id}.json — id does not derive from its own fields`);
      continue;
    }

    const filePath = join(args.eventDir, `${id}.json`);
    try {
      writeFileSync(filePath, JSON.stringify(envelope, null, 2) + "\n", { flag: "wx" });
      console.log(
        `[attestation] ${args.attestor} → ${peer}: ${data.count} events attested ` +
          `(strength: ${attestation.strength.toFixed(2)}, digest: ${attestedDigest.slice(0, 19)}…) ` +
          `— UNBOUND: no signature, so \`by\` is a self-claim until a key holder signs it`,
      );
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
