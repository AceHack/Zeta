/**
 * society-event-index.ts — append-only, hash-chained manifest for society events.
 *
 * Git is the durable transport. This index makes the committed event sequence
 * independently replayable: every entry carries the SHA-256 of its exact event
 * bytes and a chain digest over its predecessor. A replay consumer can therefore
 * reject a changed event, a swapped entry, or an ambiguous duplicate identifier.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const SOCIETY_EVENT_INDEX_SCHEMA = "zeta.society.event-index/v1" as const;
export const SOCIETY_EVENT_INDEX_FILE = "society-index.json" as const;
export const EMPTY_SOCIAL_CHAIN_DIGEST = "0".repeat(64);

export interface SocietyEventIndexEntry {
  readonly id: string;
  readonly at: string;
  readonly file: string;
  readonly eventDigest: string;
  readonly previousDigest: string;
  readonly chainDigest: string;
  readonly sourceRevision?: string;
}

export interface SocietyEventIndex {
  readonly schema: typeof SOCIETY_EVENT_INDEX_SCHEMA;
  readonly eventCount: number;
  readonly headDigest: string;
  readonly events: readonly SocietyEventIndexEntry[];
}

export interface SocietyEventEvidence {
  readonly id: string;
  readonly at: string;
  readonly file: string;
  /** Exact UTF-8 bytes written to the event JSON file, represented as text. */
  readonly eventText: string;
  readonly sourceRevision?: string;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function chainDigest(
  previousDigest: string,
  evidence: Pick<SocietyEventIndexEntry, "id" | "at" | "file" | "eventDigest">,
  sourceRevision?: string,
): string {
  return sha256(JSON.stringify([
    previousDigest,
    evidence.id,
    evidence.at,
    evidence.file,
    evidence.eventDigest,
    sourceRevision ?? null,
  ]));
}

function isDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function emptySocietyEventIndex(): SocietyEventIndex {
  return {
    schema: SOCIETY_EVENT_INDEX_SCHEMA,
    eventCount: 0,
    headDigest: EMPTY_SOCIAL_CHAIN_DIGEST,
    events: [],
  };
}

/** Verify the index chain. This is a conformance check, not a self-certification. */
export function validateSocietyEventIndex(index: SocietyEventIndex): void {
  if (index.schema !== SOCIETY_EVENT_INDEX_SCHEMA) {
    throw new Error(`unsupported society event index schema: ${index.schema}`);
  }
  if (index.eventCount !== index.events.length) {
    throw new Error(`eventCount ${index.eventCount} does not match ${index.events.length} entries`);
  }

  let previousDigest = EMPTY_SOCIAL_CHAIN_DIGEST;
  const ids = new Set<string>();
  const files = new Set<string>();
  for (const entry of index.events) {
    if (!entry.id || !entry.file || !entry.at) throw new Error("society event index entry has a blank identity field");
    if (!isDigest(entry.eventDigest) || !isDigest(entry.previousDigest) || !isDigest(entry.chainDigest)) {
      throw new Error(`society event index entry ${entry.id} has a malformed digest`);
    }
    if (entry.previousDigest !== previousDigest) {
      throw new Error(`society event index entry ${entry.id} has a broken predecessor link`);
    }
    if (ids.has(entry.id) || files.has(entry.file)) {
      throw new Error(`society event index has duplicate evidence for ${entry.id}`);
    }
    const expectedChainDigest = chainDigest(entry.previousDigest, entry, entry.sourceRevision);
    if (entry.chainDigest !== expectedChainDigest) {
      throw new Error(`society event index entry ${entry.id} fails its chain digest`);
    }
    ids.add(entry.id);
    files.add(entry.file);
    previousDigest = entry.chainDigest;
  }
  if (index.headDigest !== previousDigest) {
    throw new Error("society event index head digest does not match the final entry");
  }
}

export function appendSocietyEventEvidence(
  index: SocietyEventIndex,
  evidence: SocietyEventEvidence,
): SocietyEventIndex {
  validateSocietyEventIndex(index);
  const eventDigest = sha256(evidence.eventText);
  const existing = index.events.find(entry => entry.id === evidence.id || entry.file === evidence.file);
  if (existing) {
    if (existing.id === evidence.id && existing.file === evidence.file && existing.eventDigest === eventDigest) {
      return index; // retry is idempotent only when the exact evidence bytes agree
    }
    throw new Error(`conflicting society event evidence for ${evidence.id}`);
  }

  const previousDigest = index.headDigest;
  const base = {
    id: evidence.id,
    at: evidence.at,
    file: evidence.file,
    eventDigest,
  };
  const entry: SocietyEventIndexEntry = {
    ...base,
    previousDigest,
    chainDigest: chainDigest(previousDigest, base, evidence.sourceRevision),
    ...(evidence.sourceRevision ? { sourceRevision: evidence.sourceRevision } : {}),
  };
  return {
    schema: SOCIETY_EVENT_INDEX_SCHEMA,
    eventCount: index.events.length + 1,
    headDigest: entry.chainDigest,
    events: [...index.events, entry],
  };
}

export function readSocietyEventIndex(eventDir: string): SocietyEventIndex {
  const path = join(eventDir, SOCIETY_EVENT_INDEX_FILE);
  if (!existsSync(path)) return emptySocietyEventIndex();
  const index = JSON.parse(readFileSync(path, "utf8")) as SocietyEventIndex;
  validateSocietyEventIndex(index);
  return index;
}

export function writeSocietyEventEvidence(eventDir: string, evidence: SocietyEventEvidence): SocietyEventIndex {
  const index = appendSocietyEventEvidence(readSocietyEventIndex(eventDir), evidence);
  writeFileSync(join(eventDir, SOCIETY_EVENT_INDEX_FILE), `${JSON.stringify(index, null, 2)}\n`);
  return index;
}
