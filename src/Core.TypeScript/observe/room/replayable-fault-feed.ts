/**
 * Static replayable room-fault feed.
 *
 * Style: this publishes already-defined finite teaching vectors as immutable static
 * discovery data. It does not observe a room, create a durable evidence atom, resolve
 * witness authority, or make an agent-heartbeat claim.
 */
import {
  addressReplayableRoomFaultReceipt,
  encodeReplayableRoomFaultReceipt,
  replayRoomFaultScenario,
  type ReplayableRoomFaultReceipt,
  type ReplayableRoomFaultScenario,
} from "./replayable-fault-receipts";

export const REPLAYABLE_ROOM_FAULT_FEED_INDEX_SCHEMA = "zeta.replayable-room-fault-feed-index.v1" as const;
export const REPLAYABLE_ROOM_FAULT_FEED_RECEIPT_SCHEMA = "zeta.replayable-room-fault-feed-receipt.v1" as const;
export const REPLAYABLE_ROOM_FAULT_FEED_DIRECTORY = "replayable-fault-receipts" as const;

const SCENARIOS = [
  "altered-content",
  "correctable-recovery",
  "undecodable-transport",
  "unresolved-witness",
  "visible-witness-conflict",
] as const satisfies readonly ReplayableRoomFaultScenario[];

export interface ReplayableRoomFaultFeedEntry {
  readonly scenario: ReplayableRoomFaultScenario;
  /** Relative to the static replay-feed root, not a general filesystem path. */
  readonly file: string;
  /** Content address of the receipt, not the containing discovery wrapper. */
  readonly contentKey: string;
}

export interface ReplayableRoomFaultFeedIndex {
  readonly schema: typeof REPLAYABLE_ROOM_FAULT_FEED_INDEX_SCHEMA;
  readonly entries: readonly ReplayableRoomFaultFeedEntry[];
}

export interface ReplayableRoomFaultFeedReceipt {
  readonly schema: typeof REPLAYABLE_ROOM_FAULT_FEED_RECEIPT_SCHEMA;
  readonly contentKey: string;
  readonly receipt: ReplayableRoomFaultReceipt;
}

export interface ReplayableRoomFaultFeedPort {
  /** `null` means the requested immutable static object was not available. */
  read(path: string): Promise<string | null>;
}

export type ReplayableRoomFaultFeedRead =
  | { readonly kind: "ready"; readonly index: ReplayableRoomFaultFeedIndex; readonly receipts: readonly ReplayableRoomFaultFeedReceipt[] }
  | { readonly kind: "empty"; readonly index: ReplayableRoomFaultFeedIndex }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "malformed"; readonly reason: string };

function succeeded<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

function failed(reason: string): { readonly ok: false; readonly reason: string } {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isContentKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
}

function isScenario(value: unknown): value is ReplayableRoomFaultScenario {
  return typeof value === "string" && (SCENARIOS as readonly string[]).includes(value);
}

export function replayFeedFile(scenario: ReplayableRoomFaultScenario): string {
  return `${scenario}.json`;
}

function canonicalIndex(entries: readonly ReplayableRoomFaultFeedEntry[]): ReplayableRoomFaultFeedIndex {
  return {
    schema: REPLAYABLE_ROOM_FAULT_FEED_INDEX_SCHEMA,
    entries: [...entries].sort((left, right) => left.scenario < right.scenario ? -1 : left.scenario > right.scenario ? 1 : 0),
  };
}

export function encodeReplayableRoomFaultFeedIndex(index: ReplayableRoomFaultFeedIndex): string {
  return `${JSON.stringify(canonicalIndex(index.entries), null, 2)}\n`;
}

export function decodeReplayableRoomFaultFeedIndex(
  payload: string,
): { readonly ok: true; readonly value: ReplayableRoomFaultFeedIndex } | { readonly ok: false; readonly reason: string } {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!isRecord(parsed) || parsed.schema !== REPLAYABLE_ROOM_FAULT_FEED_INDEX_SCHEMA || !Array.isArray(parsed.entries)) {
      return failed(`replay feed index schema must be ${REPLAYABLE_ROOM_FAULT_FEED_INDEX_SCHEMA}`);
    }
    const scenarios = new Set<ReplayableRoomFaultScenario>();
    const entries: ReplayableRoomFaultFeedEntry[] = [];
    for (const [position, candidate] of parsed.entries.entries()) {
      if (!isRecord(candidate) || !isScenario(candidate.scenario) || candidate.file !== replayFeedFile(candidate.scenario) || !isContentKey(candidate.contentKey)) {
        return failed(`replay feed entry ${String(position)} has an invalid scenario, file, or content key`);
      }
      if (scenarios.has(candidate.scenario)) return failed(`replay feed repeats scenario ${candidate.scenario}`);
      scenarios.add(candidate.scenario);
      entries.push({ scenario: candidate.scenario, file: candidate.file, contentKey: candidate.contentKey });
    }
    return succeeded(canonicalIndex(entries));
  } catch {
    return failed("replay feed index is not valid JSON");
  }
}

function isReplayReceipt(value: unknown): value is ReplayableRoomFaultReceipt {
  return isRecord(value) && value.schema === "zeta.replayable-room-fault-receipt.v1" && isScenario(value.scenario);
}

export function encodeReplayableRoomFaultFeedReceipt(receipt: ReplayableRoomFaultFeedReceipt): string {
  return `${JSON.stringify(receipt, null, 2)}\n`;
}

export function decodeReplayableRoomFaultFeedReceipt(
  payload: string,
): { readonly ok: true; readonly value: ReplayableRoomFaultFeedReceipt } | { readonly ok: false; readonly reason: string } {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!isRecord(parsed) || parsed.schema !== REPLAYABLE_ROOM_FAULT_FEED_RECEIPT_SCHEMA || !isContentKey(parsed.contentKey) || !isReplayReceipt(parsed.receipt)) {
      return failed(`replay feed receipt schema must be ${REPLAYABLE_ROOM_FAULT_FEED_RECEIPT_SCHEMA}`);
    }
    return succeeded({ schema: REPLAYABLE_ROOM_FAULT_FEED_RECEIPT_SCHEMA, contentKey: parsed.contentKey, receipt: parsed.receipt });
  } catch {
    return failed("replay feed receipt is not valid JSON");
  }
}

/** Deterministic finite publication set. The selected +1 vectors do not erase the -1 test path. */
export function createReplayableRoomFaultFeed(): {
  readonly index: ReplayableRoomFaultFeedIndex;
  readonly receipts: readonly ReplayableRoomFaultFeedReceipt[];
} {
  const receipts = SCENARIOS.map((scenario) => {
    const receipt = replayRoomFaultScenario(scenario);
    const addressed = addressReplayableRoomFaultReceipt(receipt);
    return { schema: REPLAYABLE_ROOM_FAULT_FEED_RECEIPT_SCHEMA, contentKey: addressed.contentKey, receipt } as const;
  });
  return {
    index: canonicalIndex(receipts.map(({ receipt, contentKey }) => ({ scenario: receipt.scenario, file: replayFeedFile(receipt.scenario), contentKey }))),
    receipts,
  };
}

/**
 * Read and verify every declared vector. A declared address must recompute from exact
 * canonical receipt bytes, so a changed lesson, sign, register, or transport mask fails.
 */
export async function readReplayableRoomFaultFeed(port: ReplayableRoomFaultFeedPort): Promise<ReplayableRoomFaultFeedRead> {
  const indexPayload = await port.read("index.json");
  if (indexPayload === null) return { kind: "unavailable", reason: "replay feed index is unavailable" };
  const decodedIndex = decodeReplayableRoomFaultFeedIndex(indexPayload);
  if (!decodedIndex.ok) return { kind: "malformed", reason: decodedIndex.reason };
  if (decodedIndex.value.entries.length === 0) return { kind: "empty", index: decodedIndex.value };

  const receipts: ReplayableRoomFaultFeedReceipt[] = [];
  for (const entry of decodedIndex.value.entries) {
    const payload = await port.read(entry.file);
    if (payload === null) return { kind: "unavailable", reason: `replay vector ${entry.file} is unavailable` };
    const decoded = decodeReplayableRoomFaultFeedReceipt(payload);
    if (!decoded.ok) return { kind: "malformed", reason: `replay vector ${entry.file}: ${decoded.reason}` };
    if (decoded.value.receipt.scenario !== entry.scenario) {
      return { kind: "malformed", reason: `replay entry ${entry.scenario} does not bind vector ${entry.file}` };
    }
    if (decoded.value.contentKey !== entry.contentKey) {
      return { kind: "malformed", reason: `replay entry ${entry.scenario} content key differs from vector ${entry.file}` };
    }
    if (addressReplayableRoomFaultReceipt(decoded.value.receipt).contentKey !== entry.contentKey) {
      return { kind: "malformed", reason: `replay entry ${entry.scenario} content key does not bind canonical receipt bytes` };
    }
    receipts.push(decoded.value);
  }
  return { kind: "ready", index: decodedIndex.value, receipts };
}

/** Write this feed with `bun …/write-replayable-fault-feed.ts <directory>`. */
export function replayableRoomFaultFeedFiles(): ReadonlyMap<string, string> {
  const feed = createReplayableRoomFaultFeed();
  const files = new Map<string, string>();
  files.set("index.json", encodeReplayableRoomFaultFeedIndex(feed.index));
  for (const vector of feed.receipts) files.set(replayFeedFile(vector.receipt.scenario), encodeReplayableRoomFaultFeedReceipt(vector));
  return files;
}

/** The canonical receipt encoder is intentionally referenced here to make publication binding explicit. */
void encodeReplayableRoomFaultReceipt;
