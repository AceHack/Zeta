/**
 * Browser reader for the published finite replayable room-fault feed.
 *
 * Style: static discovery only. It validates feed structure, scenario/file binding, and
 * declared-address equality. Canonical content-address recomputation remains in the
 * durable TypeScript publisher; this browser reader never creates a receipt or verdict.
 */
export const REPLAYABLE_ROOM_FAULT_FEED_ROOT =
  "https://raw.githubusercontent.com/Lucent-Financial-Group/Zeta/main/docs/replayable-fault-receipts";

export type ReplayFaultScenario =
  | "correctable-recovery"
  | "undecodable-transport"
  | "altered-content"
  | "unresolved-witness"
  | "visible-witness-conflict";

export type PublishedReplayFaultVector = {
  readonly contentKey: string;
  readonly receipt: {
    readonly scenario: ReplayFaultScenario;
    readonly transport: { readonly erasureMask: number; readonly classification: { readonly status: string; readonly erasedCount: number }; readonly semanticReceipt: boolean };
    readonly registers: { readonly evidenceSign: string; readonly contentIntegrity: string; readonly causalContinuity: string; readonly genesisAuthority: string };
    readonly outcome: string;
    readonly teaching: { readonly code: string; readonly lesson: string; readonly nextGenerator: string };
  };
};

export type ReplayFaultFeedState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly vectors: readonly PublishedReplayFaultVector[] }
  | { readonly kind: "empty" }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "malformed"; readonly reason: string };

type FeedEntry = { readonly scenario: ReplayFaultScenario; readonly file: string; readonly contentKey: string };

const SCENARIOS: readonly ReplayFaultScenario[] = [
  "altered-content",
  "correctable-recovery",
  "undecodable-transport",
  "unresolved-witness",
  "visible-witness-conflict",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isScenario(value: unknown): value is ReplayFaultScenario {
  return typeof value === "string" && SCENARIOS.includes(value as ReplayFaultScenario);
}

function isContentKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 4096;
}

function decodeIndex(value: unknown): FeedEntry[] | string {
  if (!isRecord(value) || value.schema !== "zeta.replayable-room-fault-feed-index.v1" || !Array.isArray(value.entries)) {
    return "replay feed index schema is invalid";
  }
  const seen = new Set<ReplayFaultScenario>();
  const entries: FeedEntry[] = [];
  for (const candidate of value.entries) {
    if (!isRecord(candidate) || !isScenario(candidate.scenario) || candidate.file !== `${candidate.scenario}.json` || !isContentKey(candidate.contentKey)) {
      return "replay feed index has an invalid scenario, file, or declared content address";
    }
    if (seen.has(candidate.scenario)) return `replay feed repeats scenario ${candidate.scenario}`;
    seen.add(candidate.scenario);
    entries.push({ scenario: candidate.scenario, file: candidate.file, contentKey: candidate.contentKey });
  }
  return entries;
}

function decodeVector(value: unknown, entry: FeedEntry): PublishedReplayFaultVector | string {
  if (!isRecord(value) || value.schema !== "zeta.replayable-room-fault-feed-receipt.v1" || value.contentKey !== entry.contentKey || !isRecord(value.receipt)) {
    return `replay vector ${entry.file} does not bind its declared feed entry`;
  }
  const receipt = value.receipt;
  if (!isScenario(receipt.scenario) || receipt.scenario !== entry.scenario || !isRecord(receipt.transport) || !isRecord(receipt.registers) || !isRecord(receipt.teaching)) {
    return `replay vector ${entry.file} has an invalid receipt shape`;
  }
  const transport = receipt.transport;
  const classification = transport.classification;
  if (!isRecord(classification)) return `replay vector ${entry.file} has an invalid transport classification`;
  const registers = receipt.registers;
  const teaching = receipt.teaching;
  if (
    typeof transport.erasureMask !== "number" ||
    typeof classification.erasedCount !== "number" ||
    !isString(classification.status) ||
    typeof transport.semanticReceipt !== "boolean" ||
    !isString(registers.evidenceSign) ||
    !isString(registers.contentIntegrity) ||
    !isString(registers.causalContinuity) ||
    !isString(registers.genesisAuthority) ||
    !isString(receipt.outcome) ||
    !isString(teaching.code) ||
    !isString(teaching.lesson) ||
    !isString(teaching.nextGenerator)
  ) {
    return `replay vector ${entry.file} has incomplete teaching or register fields`;
  }
  return {
    contentKey: entry.contentKey,
    receipt: {
      scenario: receipt.scenario,
      transport: { erasureMask: transport.erasureMask, classification: { status: classification.status, erasedCount: classification.erasedCount }, semanticReceipt: transport.semanticReceipt },
      registers: { evidenceSign: registers.evidenceSign, contentIntegrity: registers.contentIntegrity, causalContinuity: registers.causalContinuity, genesisAuthority: registers.genesisAuthority },
      outcome: receipt.outcome,
      teaching: { code: teaching.code, lesson: teaching.lesson, nextGenerator: teaching.nextGenerator },
    },
  };
}

export async function readPublishedReplayFaultFeed(fetcher: typeof fetch = fetch): Promise<ReplayFaultFeedState> {
  let indexResponse: Response;
  try {
    indexResponse = await fetcher(`${REPLAYABLE_ROOM_FAULT_FEED_ROOT}/index.json`);
  } catch {
    return { kind: "unavailable", reason: "replay feed request did not complete" };
  }
  if (!indexResponse.ok) return { kind: "unavailable", reason: `replay feed index returned HTTP ${String(indexResponse.status)}` };
  let indexValue: unknown;
  try { indexValue = await indexResponse.json(); } catch { return { kind: "malformed", reason: "replay feed index is not JSON" }; }
  const decodedIndex = decodeIndex(indexValue);
  if (typeof decodedIndex === "string") return { kind: "malformed", reason: decodedIndex };
  if (decodedIndex.length === 0) return { kind: "empty" };

  const vectors: PublishedReplayFaultVector[] = [];
  for (const entry of decodedIndex) {
    let response: Response;
    try { response = await fetcher(`${REPLAYABLE_ROOM_FAULT_FEED_ROOT}/${entry.file}`); } catch { return { kind: "unavailable", reason: `replay vector ${entry.file} request did not complete` }; }
    if (!response.ok) return { kind: "unavailable", reason: `replay vector ${entry.file} returned HTTP ${String(response.status)}` };
    let value: unknown;
    try { value = await response.json(); } catch { return { kind: "malformed", reason: `replay vector ${entry.file} is not JSON` }; }
    const decoded = decodeVector(value, entry);
    if (typeof decoded === "string") return { kind: "malformed", reason: decoded };
    vectors.push(decoded);
  }
  return { kind: "ready", vectors };
}
