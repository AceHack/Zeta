import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { MutationLogEntry, MutationOptions, MutationParams, MutationRequest } from "./mutate";
import { mutate } from "./mutate";

// ---------------------------------------------------------------------------
// Log file location
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");
export const DEFAULT_LOG_PATH = resolve(REPO_ROOT, "docs/hygiene-history/playwright-mutations/log.jsonl");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A drain-log entry persisted on disk.  Extends the in-memory MutationLogEntry
 * with a status field. Each record is individually immutable; reversals and
 * indeterminate revert attempts are recorded as new lines with the same id
 * (append-only invariant).
 */
export type DrainLogStatus = "applied" | "reverted" | "indeterminate";

export type DrainLogEntry = Omit<MutationLogEntry, "status"> & {
  readonly status: DrainLogStatus;
};

export interface RevertSuccess {
  readonly success: true;
  readonly entryId: string;
}

export interface RevertFailure {
  readonly success: false;
  readonly entryId: string;
  readonly error: string;
}

export type RevertResult = RevertSuccess | RevertFailure;

interface DrainLogReadSuccess {
  readonly success: true;
  readonly entries: DrainLogEntry[];
}

interface DrainLogReadFailure {
  readonly success: false;
  readonly error: string;
}

type DrainLogReadResult = DrainLogReadSuccess | DrainLogReadFailure;

const inFlightReverts = new Set<string>();

// ---------------------------------------------------------------------------
// Core I/O helpers
// ---------------------------------------------------------------------------

function ensureLogDir(logPath: string): void {
  const dir = dirname(logPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function appendDrainLogEntry(entry: DrainLogEntry, logPath: string): void {
  ensureLogDir(logPath);
  appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMutationParams(value: unknown): value is MutationParams {
  return isRecord(value) && typeof value.url === "string" && typeof value.toggleKey === "string";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isDrainLogEntry(value: unknown): value is DrainLogEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.surfaceId === "string" &&
    typeof value.action === "string" &&
    typeof value.inverseAction === "string" &&
    isMutationParams(value.params) &&
    isRecord(value.before) &&
    isRecord(value.after) &&
    isRecord(value.diff) &&
    (value.status === "applied" || value.status === "reverted" || value.status === "indeterminate")
  );
}

/** Parse all lines from the log file, skipping blank, parse-failed, or schema-invalid lines. */
function readAllLines(logPath: string): DrainLogReadResult {
  let raw: string;
  try {
    raw = readFileSync(logPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { success: true, entries: [] };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Unable to read drain log at ${logPath}: ${message}` };
  }
  const entries: DrainLogEntry[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isDrainLogEntry(parsed)) entries.push(parsed);
    } catch {
      // Skip truncated/malformed lines (e.g. from a crash mid-append).
    }
  }
  return { success: true, entries };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Append a MutationLogEntry (produced by mutate.ts) to the drain log.
 * The file is created (including parent directories) if absent.
 * Append-only — never modifies existing lines.
 */
export function appendEntry(entry: MutationLogEntry, logPath: string = DEFAULT_LOG_PATH): void {
  appendDrainLogEntry(entry, logPath);
}

/**
 * Return all drain-log entries whose effective (latest) status is "applied".
 *
 * Because the file is append-only, a revert is recorded as a second line
 * with the same id and status "reverted".  We reduce to the latest status
 * per id so that listing reflects current reality.
 */
export function listPending(logPath: string = DEFAULT_LOG_PATH): DrainLogEntry[] {
  const readResult = readAllLines(logPath);
  if (!readResult.success) return [];
  const all = readResult.entries;
  // Track latest status per id
  const latestStatus = new Map<string, DrainLogStatus>();
  // Track the full entry keyed by id (last-wins for metadata, but status is separate)
  const byId = new Map<string, DrainLogEntry>();
  for (const entry of all) {
    latestStatus.set(entry.id, entry.status);
    byId.set(entry.id, entry);
  }
  const result: DrainLogEntry[] = [];
  for (const [id, status] of latestStatus) {
    if (status === "applied") {
      const entry = byId.get(id);
      if (entry !== undefined) result.push(entry);
    }
  }
  return result;
}

function findLatestEntry(entries: readonly DrainLogEntry[], entryId: string): DrainLogEntry | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.id === entryId) return entry;
  }
  return null;
}

/**
 * Mechanically undo a logged mutation.
 *
 * Reads the inverse action from the log entry, calls mutate() with it, then
 * appends a new log line marking the entry as "reverted".  The original line
 * is never modified (append-only invariant).
 *
 * Returns a RevertResult — callers should check `success` before proceeding.
 */
export async function revert(
  entryId: string,
  options: MutationOptions = {},
  logPath: string = DEFAULT_LOG_PATH,
): Promise<RevertResult> {
  if (inFlightReverts.has(entryId)) {
    return { success: false, entryId, error: `Entry "${entryId}" is already being reverted.` };
  }

  inFlightReverts.add(entryId);
  try {
    return await revertUnlocked(entryId, options, logPath);
  } finally {
    inFlightReverts.delete(entryId);
  }
}

async function revertUnlocked(
  entryId: string,
  options: MutationOptions,
  logPath: string,
): Promise<RevertResult> {
  const readResult = readAllLines(logPath);
  if (!readResult.success) {
    return { success: false, entryId, error: readResult.error };
  }
  const all = readResult.entries;

  const latest = findLatestEntry(all, entryId);
  if (latest === null) {
    return { success: false, entryId, error: `No log entry found with id "${entryId}".` };
  }
  if (latest.status === "reverted") {
    return { success: false, entryId, error: `Entry "${entryId}" is already reverted.` };
  }
  if (latest.status === "indeterminate") {
    return {
      success: false,
      entryId,
      error:
        `Entry "${entryId}" has an indeterminate revert: the inverse mutation may already have succeeded ` +
        "without a reverted marker. Verify the target surface manually before retrying.",
    };
  }

  // Build the inverse request
  const inverseRequest: MutationRequest = {
    surfaceId: latest.surfaceId,
    action: latest.inverseAction,
    params: latest.params,
  };

  const indeterminateMarker: DrainLogEntry = {
    ...latest,
    timestamp: new Date().toISOString(),
    status: "indeterminate",
  };
  try {
    appendDrainLogEntry(indeterminateMarker, logPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      entryId,
      error: `Unable to persist indeterminate revert marker before mutation: ${message}. No inverse mutation was attempted.`,
    };
  }

  let result: Awaited<ReturnType<typeof mutate>>;
  try {
    // skipLog: true — drain-log handles the revert marker append itself; the
    // inverse mutation must not auto-log as a separate "applied" entry.
    result = await mutate(inverseRequest, { ...options, skipLog: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      entryId,
      error:
        `Inverse mutation threw after durable indeterminate marker was written: ${message}. ` +
        "Verify the target surface manually before retrying.",
    };
  }
  if (!result.success) {
    return {
      success: false,
      entryId,
      error:
        `Inverse mutation failed after durable indeterminate marker was written: ${result.error}. ` +
        "Verify the target surface manually before retrying.",
    };
  }

  // Append revert marker — full entry from the inverse mutation, id overridden
  // to match the original applied record so listPending() correctly reduces it.
  const revertMarker: DrainLogEntry = {
    ...result.drainLogEntry,
    id: entryId,         // same id as original — this is the revert event
    status: "reverted",
  };
  try {
    appendDrainLogEntry(revertMarker, logPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      entryId,
      error:
        `Inverse mutation succeeded but reverted marker append failed: ${message}. ` +
        "The durable indeterminate marker remains in the log. Verify the target surface manually before retrying.",
    };
  }

  return { success: true, entryId };
}
