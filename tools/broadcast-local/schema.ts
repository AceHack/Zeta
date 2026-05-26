// schema.ts -- structured contract for ~/.local/share/zeta-broadcasts.

export const LOCAL_BROADCAST_SCHEMA_VERSION = 1 as const;
export const DEFAULT_LOCAL_BROADCAST_TTL_MS = 30 * 60 * 1000;

export type LocalBroadcastAgent = "otto" | "vera" | "riven";
export type LocalBroadcastPriority = "P0" | "P1" | "P2" | "P3";
export type LocalBroadcastStatus = "ok" | "working" | "blocked" | "idle";

export interface LocalBroadcastScope {
  readonly kind: "path" | "claim" | "pr" | "branch" | "worktree";
  readonly value: string;
}

export interface LocalBroadcastAsk {
  readonly id: string;
  readonly summary: string;
  readonly priority: LocalBroadcastPriority;
  readonly scope?: readonly LocalBroadcastScope[];
}

export interface LocalBroadcastOffer {
  readonly id: string;
  readonly summary: string;
  readonly scope?: readonly LocalBroadcastScope[];
}

export interface LocalBroadcastBlocker {
  readonly id: string;
  readonly summary: string;
  readonly nextAction: string;
  readonly scope?: readonly LocalBroadcastScope[];
}

export interface LocalBroadcastReceipt {
  readonly kind: "read";
  readonly from: LocalBroadcastAgent;
  readonly readAt: string;
  readonly broadcastId: string;
  readonly broadcastFrom: LocalBroadcastAgent;
  readonly observedWrittenAt: string;
  readonly sourcePath?: string;
  readonly note?: string;
}

export interface LocalBroadcastEnvelope {
  readonly schemaVersion: typeof LOCAL_BROADCAST_SCHEMA_VERSION;
  readonly id: string;
  readonly from: LocalBroadcastAgent;
  readonly writtenAt: string;
  readonly expiresAt: string;
  readonly priority: LocalBroadcastPriority;
  readonly status: LocalBroadcastStatus;
  readonly summary: string;
  readonly scope?: readonly LocalBroadcastScope[];
  readonly asks?: readonly LocalBroadcastAsk[];
  readonly offers?: readonly LocalBroadcastOffer[];
  readonly blockers?: readonly LocalBroadcastBlocker[];
  readonly receipts?: readonly LocalBroadcastReceipt[];
}

export type LocalBroadcastValidation =
  | { readonly ok: true; readonly value: LocalBroadcastEnvelope }
  | { readonly ok: false; readonly errors: readonly string[] };

const AGENTS: readonly LocalBroadcastAgent[] = ["otto", "vera", "riven"];
const PRIORITIES: readonly LocalBroadcastPriority[] = ["P0", "P1", "P2", "P3"];
const STATUSES: readonly LocalBroadcastStatus[] = ["ok", "working", "blocked", "idle"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function localBroadcastExpiresAt(writtenAt: string, ttlMs = DEFAULT_LOCAL_BROADCAST_TTL_MS): string {
  const timestamp = Date.parse(writtenAt);
  if (Number.isNaN(timestamp)) {
    throw new Error(`invalid broadcast writtenAt timestamp: ${writtenAt}`);
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error(`invalid local broadcast ttl: ${ttlMs}`);
  }
  return new Date(timestamp + ttlMs).toISOString();
}

export function isLocalBroadcastStale(
  envelope: Pick<LocalBroadcastEnvelope, "expiresAt">,
  now: Date = new Date(),
): boolean {
  const expiresAt = Date.parse(envelope.expiresAt);
  if (Number.isNaN(expiresAt)) {
    return true;
  }
  return expiresAt <= now.getTime();
}

export function makeLocalBroadcastReceipt(config: {
  readonly from: LocalBroadcastAgent;
  readonly readAt: string;
  readonly envelope: Pick<LocalBroadcastEnvelope, "id" | "from" | "writtenAt">;
  readonly sourcePath?: string;
  readonly note?: string;
}): LocalBroadcastReceipt {
  return {
    kind: "read",
    from: config.from,
    readAt: config.readAt,
    broadcastId: config.envelope.id,
    broadcastFrom: config.envelope.from,
    observedWrittenAt: config.envelope.writtenAt,
    sourcePath: config.sourcePath,
    note: config.note,
  };
}

export function validateLocalBroadcastEnvelope(value: unknown): LocalBroadcastValidation {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["envelope must be an object"] };
  }

  if (value.schemaVersion !== LOCAL_BROADCAST_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${LOCAL_BROADCAST_SCHEMA_VERSION}`);
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    errors.push("id must be a non-empty string");
  }
  if (!isOneOf(value.from, AGENTS)) {
    errors.push("from must be one of otto, vera, riven");
  }
  if (!isIsoTimestamp(value.writtenAt)) {
    errors.push("writtenAt must be an ISO-8601 timestamp");
  }
  if (!isIsoTimestamp(value.expiresAt)) {
    errors.push("expiresAt must be an ISO-8601 timestamp");
  }
  if (!isOneOf(value.priority, PRIORITIES)) {
    errors.push("priority must be P0, P1, P2, or P3");
  }
  if (!isOneOf(value.status, STATUSES)) {
    errors.push("status must be ok, working, blocked, or idle");
  }
  if (typeof value.summary !== "string" || value.summary.length === 0) {
    errors.push("summary must be a non-empty string");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: value as unknown as LocalBroadcastEnvelope };
}
