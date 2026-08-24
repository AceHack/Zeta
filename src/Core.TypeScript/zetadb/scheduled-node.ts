#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { compareAndSwapRevisionPolicy, type RevisionPolicyRefusal } from "../persistence/revision-policy";
import { noForgetBackpressureAdmissionPolicy, type ZetaDbAdmissionPolicyPort } from "./admission-policy";
import {
  runZetaDbNodeTick,
  type ZetaDbDelta,
  type ZetaDbFeedback,
  type ZetaDbImagePort,
  type ZetaDbImageRecord,
  type ZetaDbResult,
  type ZetaDbTickReadout,
} from "./zeta-db-node";

export const ZETA_DB_SCHEDULED_JOURNAL_SCHEMA = "zeta.db.scheduled-journal.v1" as const;
export const ZETA_DB_FILE_CHECKPOINT_SCHEMA = "zeta.db.file-checkpoint.v1" as const;

export interface ZetaDbScheduledJournal {
  readonly schema: typeof ZETA_DB_SCHEDULED_JOURNAL_SCHEMA;
  readonly nodeId: string;
  readonly deltas: readonly ZetaDbDelta[];
}

export interface ZetaDbScheduledRunReadout {
  readonly changed: boolean;
  readonly checkpointPath: string;
  readonly tick: ZetaDbTickReadout;
}

interface FileCheckpointEnvelope {
  readonly schema: typeof ZETA_DB_FILE_CHECKPOINT_SCHEMA;
  readonly nodeId: string;
  readonly revision: number;
  readonly payloadBase64: string;
}

export interface ZetaDbScheduledNodeOptions {
  readonly journalPath: string;
  readonly checkpointPath: string;
  readonly executorId: string;
  readonly maxDeltas: number;
  readonly maxEntries: number;
  readonly maxCheckpointBytes: number;
  readonly admissionPolicy?: ZetaDbAdmissionPolicyPort;
}

function failed(
  code: ZetaDbFeedback["code"],
  detail: string,
  severity: ZetaDbFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: ZetaDbFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function revisionRefused(refusal: RevisionPolicyRefusal): { readonly ok: false; readonly feedback: ZetaDbFeedback } {
  return failed(
    refusal.reason === "node-mismatch" ? "database-image-invalid" : "database-revision-conflict",
    refusal.detail,
    refusal.reason === "node-mismatch" ? "heat" : "backpressure",
  );
}

function readJournal(path: string): ZetaDbResult<ZetaDbScheduledJournal> {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return failed("database-read-failed", `Scheduled database journal read failed: ${String(error)}`);
  }
  if (
    !isRecord(value) ||
    value.schema !== ZETA_DB_SCHEDULED_JOURNAL_SCHEMA ||
    typeof value.nodeId !== "string" ||
    value.nodeId.length === 0 ||
    !Array.isArray(value.deltas)
  ) {
    return failed("database-request-invalid", "The scheduled database journal has an invalid schema or shape.");
  }
  return { ok: true, value: value as unknown as ZetaDbScheduledJournal };
}

function readCheckpoint(path: string): ZetaDbResult<ZetaDbImageRecord | null> {
  if (!existsSync(path)) return { ok: true, value: null };
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return failed("database-read-failed", `Scheduled database checkpoint read failed: ${String(error)}`);
  }
  if (
    !isRecord(value) ||
    value.schema !== ZETA_DB_FILE_CHECKPOINT_SCHEMA ||
    typeof value.nodeId !== "string" ||
    value.nodeId.length === 0 ||
    typeof value.revision !== "number" ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    typeof value.payloadBase64 !== "string"
  ) {
    return failed("database-image-invalid", "The scheduled database checkpoint has an invalid schema or shape.");
  }
  let payload: Uint8Array;
  try {
    payload = Uint8Array.from(Buffer.from(value.payloadBase64, "base64"));
  } catch (error) {
    return failed("database-image-invalid", `Scheduled database checkpoint payload is invalid: ${String(error)}`);
  }
  return { ok: true, value: { nodeId: value.nodeId, revision: value.revision, payload } };
}

function createFileImagePort(initial: ZetaDbImageRecord | null): {
  readonly port: ZetaDbImagePort;
  readonly pending: () => ZetaDbImageRecord | null;
} {
  let current = initial;
  let pending: ZetaDbImageRecord | null = null;
  let closed = false;
  const port: ZetaDbImagePort = {
    revisionPolicy: compareAndSwapRevisionPolicy,
    load: (nodeId) => {
      if (closed) return Promise.resolve(failed("database-read-failed", "The scheduled database port is closed."));
      if (current !== null && current.nodeId !== nodeId) {
        return Promise.resolve(failed("database-image-invalid", "The checkpoint belongs to another database node."));
      }
      return Promise.resolve({
        ok: true,
        value: current === null ? null : { ...current, payload: new Uint8Array(current.payload) },
      });
    },
    save: (candidate) => {
      if (closed) return Promise.resolve(failed("database-write-failed", "The scheduled database port is closed."));
      const decision = compareAndSwapRevisionPolicy.decide(current, candidate);
      if (!decision.ok) return Promise.resolve(revisionRefused(decision.refusal));
      if (decision.value.action === "idempotent") return Promise.resolve({ ok: true, value: candidate });
      current = { ...candidate, payload: new Uint8Array(candidate.payload) };
      pending = current;
      return Promise.resolve({ ok: true, value: current });
    },
    close: () => {
      closed = true;
      return { ok: true, value: null };
    },
  };
  return { port, pending: () => pending };
}

function writeCheckpoint(path: string, record: ZetaDbImageRecord): ZetaDbResult<null> {
  const envelope: FileCheckpointEnvelope = {
    schema: ZETA_DB_FILE_CHECKPOINT_SCHEMA,
    nodeId: record.nodeId,
    revision: record.revision,
    payloadBase64: Buffer.from(record.payload).toString("base64"),
  };
  const temporary = `${path}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(envelope, null, 2)}\n`);
    renameSync(temporary, path);
    return { ok: true, value: null };
  } catch (error) {
    return failed("database-write-failed", `Scheduled database checkpoint write failed: ${String(error)}`);
  }
}

export async function runScheduledZetaDbNode(
  options: ZetaDbScheduledNodeOptions,
): Promise<ZetaDbResult<ZetaDbScheduledRunReadout>> {
  const journal = readJournal(options.journalPath);
  if (!journal.ok) return journal;
  const checkpoint = readCheckpoint(options.checkpointPath);
  if (!checkpoint.ok) return checkpoint;
  const filePort = createFileImagePort(checkpoint.value);
  const tick = await runZetaDbNodeTick(
    filePort.port,
    {
      nodeId: journal.value.nodeId,
      executorId: options.executorId,
      executorKind: "github-actions",
      deltas: journal.value.deltas,
      limits: {
        maxDeltas: options.maxDeltas,
        maxEntries: options.maxEntries,
        maxCheckpointBytes: options.maxCheckpointBytes,
      },
    },
    options.admissionPolicy ?? noForgetBackpressureAdmissionPolicy,
  );
  filePort.port.close();
  if (!tick.ok) return tick;
  const pending = filePort.pending();
  if (pending !== null) {
    const written = writeCheckpoint(options.checkpointPath, pending);
    if (!written.ok) return written;
  }
  return {
    ok: true,
    value: {
      changed: pending !== null,
      checkpointPath: options.checkpointPath,
      tick: tick.value,
    },
  };
}

function argument(args: readonly string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index < 0 ? fallback : (args[index + 1] ?? fallback);
}

export async function main(args: readonly string[]): Promise<number> {
  const result = await runScheduledZetaDbNode({
    journalPath: resolve(argument(args, "--journal", "data/zetadb/journal.json")),
    checkpointPath: resolve(argument(args, "--checkpoint", "data/zetadb/checkpoint.json")),
    executorId: argument(args, "--executor-id", process.env.GITHUB_RUN_ID ?? "local/scheduled-node"),
    maxDeltas: 1024,
    maxEntries: 100_000,
    maxCheckpointBytes: 16 * 1024 * 1024,
  });
  if (!result.ok) {
    process.stderr.write(`${JSON.stringify(result.feedback)}\n`);
    return 1;
  }
  process.stdout.write(`${JSON.stringify(result.value)}\n`);
  return result.value.tick.admission === "complete" ? 0 : 2;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
