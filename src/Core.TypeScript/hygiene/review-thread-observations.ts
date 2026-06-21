#!/usr/bin/env bun
// review-thread-observations.ts — live caller for 081KR7JY10008QG0R000MH7PJT review-thread
// disagreement preservation.
//
// This is the operational bridge below a full GitHub review workflow: record
// one loop's machine-comparable conclusion for a PR review thread, compare it
// with prior observations for that same thread from other loop identities, and
// invoke fileReviewThreadDisagreement when conclusions differ.

import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, normalize } from "node:path";

import {
  fileReviewThreadDisagreement,
  type ReviewThreadNoDisagreementReason,
  type ReviewThreadObservation,
  type ReviewThreadShardOutcome,
} from "./divergence-shard.ts";

export const DEFAULT_OBSERVATION_STORE_REL_PATH = "docs/hygiene-history/review-thread-observations.json";
const SCHEMA_VERSION = 1 as const;

export interface StoredReviewThreadObservation {
  readonly observedAt: string;
  readonly observation: ReviewThreadObservation;
}

export interface StoredReviewThreadDisagreement {
  readonly filedAt: string;
  readonly prNumber: number;
  readonly threadId: string;
  readonly conclusions: readonly [string, string];
  readonly evidenceFingerprints?: readonly [string, string];
  readonly relPath: string;
}

export type ReviewThreadDisagreementWriter = (
  repoRoot: string,
  input: Parameters<typeof fileReviewThreadDisagreement>[1],
) => ReviewThreadShardOutcome;

export interface ReviewThreadObservationStore {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly observations: ReadonlyArray<StoredReviewThreadObservation>;
  readonly filedDisagreements?: ReadonlyArray<StoredReviewThreadDisagreement>;
}

export interface RecordReviewThreadObservationInput {
  readonly repoRoot: string;
  readonly storeRelPath?: string;
  readonly observedAt: string;
  readonly tick: string;
  readonly operativeAuthorization: string;
  readonly observation: ReviewThreadObservation;
  readonly fileDisagreement?: ReviewThreadDisagreementWriter;
}

export interface RecordReviewThreadObservationBatchItem {
  readonly observedAt: string;
  readonly tick: string;
  readonly operativeAuthorization: string;
  readonly observation: ReviewThreadObservation;
}

export interface RecordReviewThreadObservationBatchInput {
  readonly repoRoot: string;
  readonly storeRelPath?: string;
  readonly fileDisagreement?: ReviewThreadDisagreementWriter;
  readonly observations: ReadonlyArray<RecordReviewThreadObservationBatchItem>;
}

export interface FiledReviewThreadDisagreement {
  readonly prior: StoredReviewThreadObservation;
  readonly outcome: Extract<ReviewThreadShardOutcome, { readonly kind: "filed" }>;
}

export type ReviewThreadObservationNoFileReason = ReviewThreadNoDisagreementReason | "already-filed";

export interface ReviewThreadNoDisagreement {
  readonly prior: StoredReviewThreadObservation;
  readonly reason: ReviewThreadObservationNoFileReason;
}

export interface RecordReviewThreadObservationResult {
  readonly storeRelPath: string;
  readonly stored: StoredReviewThreadObservation;
  readonly compared: number;
  readonly filed: ReadonlyArray<FiledReviewThreadDisagreement>;
  readonly noDisagreements: ReadonlyArray<ReviewThreadNoDisagreement>;
}

export type ParseArgsResult =
  | { readonly kind: "args"; readonly input: RecordReviewThreadObservationInput }
  | { readonly kind: "error"; readonly message: string };

function nonBlank(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} must be non-blank`);
  }
  return trimmed;
}

function normalizeRelPath(relPath: string): string {
  const normalized = normalize(nonBlank(relPath, "store path")).replaceAll("\\", "/");
  if (isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`store path must be repo-relative: ${relPath}`);
  }
  return normalized;
}

function threadKey(observation: ReviewThreadObservation): string {
  return `${observation.prNumber}:${nonBlank(observation.threadId, "threadId")}`;
}

function identityKey(observation: ReviewThreadObservation): string {
  const id = observation.identity;
  return [
    nonBlank(id.agent, "identity.agent"),
    nonBlank(id.model, "identity.model"),
    nonBlank(id.harness, "identity.harness"),
  ].join("\u0000");
}

export function validateReviewThreadObservation(observation: ReviewThreadObservation): void {
  if (!Number.isInteger(observation.prNumber) || observation.prNumber <= 0) {
    throw new Error(`prNumber must be a positive integer: ${observation.prNumber}`);
  }
  threadKey(observation);
  identityKey(observation);
  nonBlank(observation.conclusion, "conclusion");
  nonBlank(observation.body, "body");
}

export function emptyObservationStore(): ReviewThreadObservationStore {
  return { schemaVersion: SCHEMA_VERSION, observations: [], filedDisagreements: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringField(value: Record<string, unknown>, field: string): string {
  const raw = value[field];
  if (typeof raw !== "string") {
    throw new Error(`observation store ${field} must be a string`);
  }
  return raw;
}

function parseStoredObservation(value: unknown, index: number): StoredReviewThreadObservation {
  if (!isRecord(value)) {
    throw new Error(`observation store entry ${index} must be an object`);
  }
  const observationValue = value["observation"];
  if (!isRecord(observationValue)) {
    throw new Error(`observation store entry ${index}.observation must be an object`);
  }
  const identityValue = observationValue["identity"];
  if (!isRecord(identityValue)) {
    throw new Error(`observation store entry ${index}.observation.identity must be an object`);
  }
  const prNumber = observationValue["prNumber"];
  if (typeof prNumber !== "number") {
    throw new Error(`observation store entry ${index}.observation.prNumber must be a number`);
  }
  const stored = {
    observedAt: stringField(value, "observedAt"),
    observation: {
      identity: {
        agent: stringField(identityValue, "agent"),
        model: stringField(identityValue, "model"),
        harness: stringField(identityValue, "harness"),
      },
      prNumber,
      threadId: stringField(observationValue, "threadId"),
      conclusion: stringField(observationValue, "conclusion"),
      body: stringField(observationValue, "body"),
    },
  };
  validateReviewThreadObservation(stored.observation);
  nonBlank(stored.observedAt, `observation store entry ${index}.observedAt`);
  return stored;
}

function parseStoredDisagreement(value: unknown, index: number): StoredReviewThreadDisagreement {
  if (!isRecord(value)) {
    throw new Error(`observation store filedDisagreements entry ${index} must be an object`);
  }
  const conclusions = value["conclusions"];
  if (!Array.isArray(conclusions) || conclusions.length !== 2) {
    throw new Error(`observation store filedDisagreements entry ${index}.conclusions must be a 2-item array`);
  }
  const prNumber = value["prNumber"];
  if (typeof prNumber !== "number" || !Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error(`observation store filedDisagreements entry ${index}.prNumber must be a positive integer`);
  }
  const evidenceFingerprints = value["evidenceFingerprints"];
  if (
    evidenceFingerprints !== undefined &&
    (!Array.isArray(evidenceFingerprints) ||
      evidenceFingerprints.length !== 2 ||
      typeof evidenceFingerprints[0] !== "string" ||
      typeof evidenceFingerprints[1] !== "string")
  ) {
    throw new Error(
      `observation store filedDisagreements entry ${index}.evidenceFingerprints must be a 2-item string array`,
    );
  }
  return {
    filedAt: nonBlank(stringField(value, "filedAt"), `filedDisagreements entry ${index}.filedAt`),
    prNumber,
    threadId: nonBlank(stringField(value, "threadId"), `filedDisagreements entry ${index}.threadId`),
    conclusions: [normalizedConclusion(String(conclusions[0])), normalizedConclusion(String(conclusions[1]))],
    ...(evidenceFingerprints === undefined
      ? {}
      : {
          evidenceFingerprints: [
            nonBlank(evidenceFingerprints[0], "evidenceFingerprints[0]"),
            nonBlank(evidenceFingerprints[1], "evidenceFingerprints[1]"),
          ] as const,
        }),
    relPath: normalizeRelPath(stringField(value, "relPath")),
  };
}

export function parseObservationStore(text: string): ReviewThreadObservationStore {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) {
    throw new Error("observation store must be a JSON object");
  }
  if (parsed["schemaVersion"] !== SCHEMA_VERSION) {
    throw new Error(`observation store schemaVersion must be ${SCHEMA_VERSION}`);
  }
  const observations = parsed["observations"];
  if (!Array.isArray(observations)) {
    throw new Error("observation store observations must be an array");
  }
  const filedDisagreements = parsed["filedDisagreements"];
  if (filedDisagreements !== undefined && !Array.isArray(filedDisagreements)) {
    throw new Error("observation store filedDisagreements must be an array");
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    observations: observations.map(parseStoredObservation),
    filedDisagreements: filedDisagreements?.map(parseStoredDisagreement) ?? [],
  };
}

export function loadObservationStore(
  repoRoot: string,
  storeRelPath = DEFAULT_OBSERVATION_STORE_REL_PATH,
): ReviewThreadObservationStore {
  const relPath = normalizeRelPath(storeRelPath);
  const absPath = join(repoRoot, relPath);
  if (!existsSync(absPath)) {
    return emptyObservationStore();
  }
  return parseObservationStore(readFileSync(absPath, "utf8"));
}

export function writeObservationStore(
  repoRoot: string,
  storeRelPath: string,
  store: ReviewThreadObservationStore,
): void {
  const relPath = normalizeRelPath(storeRelPath);
  const absPath = join(repoRoot, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  const tempPath = `${absPath}.tmp-${process.pid}-${randomUUID()}`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    renameSync(tempPath, absPath);
  } catch (err) {
    try {
      unlinkSync(tempPath);
    } catch {
      // The temp file may not exist if the write failed before creation.
    }
    throw err;
  }
}

function sameReviewThread(a: ReviewThreadObservation, b: ReviewThreadObservation): boolean {
  return a.prNumber === b.prNumber && threadKey(a) === threadKey(b);
}

function differentLoopIdentity(a: ReviewThreadObservation, b: ReviewThreadObservation): boolean {
  return identityKey(a) !== identityKey(b);
}

function normalizedConclusion(value: string): string {
  return nonBlank(value, "conclusion").toLowerCase();
}

function disagreementConclusions(a: ReviewThreadObservation, b: ReviewThreadObservation): readonly [string, string] {
  const sorted = [normalizedConclusion(a.conclusion), normalizedConclusion(b.conclusion)].sort();
  return [sorted[0]!, sorted[1]!];
}

function evidenceFingerprint(observation: ReviewThreadObservation): string {
  return createHash("sha256").update(nonBlank(observation.body, "body")).digest("hex");
}

function disagreementEvidenceFingerprints(
  a: ReviewThreadObservation,
  b: ReviewThreadObservation,
): readonly [string, string] {
  const sorted = [
    `${normalizedConclusion(a.conclusion)}\u0000${evidenceFingerprint(a)}`,
    `${normalizedConclusion(b.conclusion)}\u0000${evidenceFingerprint(b)}`,
  ].sort();
  return [sorted[0]!, sorted[1]!];
}

function sameFiledDisagreement(
  filed: StoredReviewThreadDisagreement,
  a: ReviewThreadObservation,
  b: ReviewThreadObservation,
): boolean {
  const conclusions = disagreementConclusions(a, b);
  const evidenceFingerprints = disagreementEvidenceFingerprints(a, b);
  return (
    filed.prNumber === a.prNumber &&
    filed.threadId === nonBlank(a.threadId, "threadId") &&
    filed.conclusions[0] === conclusions[0] &&
    filed.conclusions[1] === conclusions[1] &&
    filed.evidenceFingerprints?.[0] === evidenceFingerprints[0] &&
    filed.evidenceFingerprints?.[1] === evidenceFingerprints[1]
  );
}

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireObservationStoreLock(
  repoRoot: string,
  storeRelPath: string,
): { readonly absPath: string; readonly fd: number } {
  const lockAbsPath = join(repoRoot, `${normalizeRelPath(storeRelPath)}.lock`);
  mkdirSync(dirname(lockAbsPath), { recursive: true });
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      return { absPath: lockAbsPath, fd: openSync(lockAbsPath, "wx") };
    } catch (err) {
      if (!isRecord(err) || err["code"] !== "EEXIST" || Date.now() >= deadline) {
        throw err;
      }
      sleepMs(25);
    }
  }
}

function withObservationStoreLock<T>(repoRoot: string, storeRelPath: string, fn: () => T): T {
  const lock = acquireObservationStoreLock(repoRoot, storeRelPath);
  let thrown: unknown;
  try {
    return fn();
  } catch (err) {
    thrown = err;
    throw err;
  } finally {
    let closeErr: unknown;
    try {
      closeSync(lock.fd);
    } catch (err) {
      closeErr = err;
    }
    try {
      unlinkSync(lock.absPath);
    } catch (err) {
      if (!isRecord(err) || err["code"] !== "ENOENT") {
        if (thrown === undefined) {
          throw err;
        }
      }
    }
    if (thrown === undefined && closeErr !== undefined) {
      throw closeErr;
    }
  }
}

export function recordReviewThreadObservation(
  input: RecordReviewThreadObservationInput,
): RecordReviewThreadObservationResult {
  const storeRelPath = normalizeRelPath(input.storeRelPath ?? DEFAULT_OBSERVATION_STORE_REL_PATH);
  nonBlank(input.observedAt, "observedAt");
  nonBlank(input.tick, "tick");
  nonBlank(input.operativeAuthorization, "operativeAuthorization");
  validateReviewThreadObservation(input.observation);

  return withObservationStoreLock(input.repoRoot, storeRelPath, () => {
    const store = loadObservationStore(input.repoRoot, storeRelPath);
    const current: StoredReviewThreadObservation = {
      observedAt: input.observedAt,
      observation: input.observation,
    };
    const observations = [...store.observations, current];
    const priorSameThread = store.observations.filter(
      (prior) =>
        sameReviewThread(prior.observation, input.observation) &&
        differentLoopIdentity(prior.observation, input.observation),
    );

    const filedDisagreements = [...(store.filedDisagreements ?? [])];
    const filed: FiledReviewThreadDisagreement[] = [];
    const noDisagreements: ReviewThreadNoDisagreement[] = [];
    const writeStore = (): void =>
      writeObservationStore(input.repoRoot, storeRelPath, {
        schemaVersion: SCHEMA_VERSION,
        observations,
        filedDisagreements,
      });

    writeStore();

    const writeDisagreement = input.fileDisagreement ?? fileReviewThreadDisagreement;
    for (const prior of priorSameThread) {
      if (
        normalizedConclusion(prior.observation.conclusion) !== normalizedConclusion(input.observation.conclusion) &&
        filedDisagreements.some((existing) => sameFiledDisagreement(existing, prior.observation, input.observation))
      ) {
        noDisagreements.push({ prior, reason: "already-filed" });
        continue;
      }

      const outcome = writeDisagreement(input.repoRoot, {
        tick: input.tick,
        loopA: prior.observation,
        loopB: input.observation,
        operativeAuthorization: input.operativeAuthorization,
      });
      if (outcome.kind === "filed") {
        filed.push({ prior, outcome });
        filedDisagreements.push({
          filedAt: input.tick,
          prNumber: input.observation.prNumber,
          threadId: nonBlank(input.observation.threadId, "threadId"),
          conclusions: disagreementConclusions(prior.observation, input.observation),
          evidenceFingerprints: disagreementEvidenceFingerprints(prior.observation, input.observation),
          relPath: outcome.write.relPath,
        });
        writeStore();
      } else {
        noDisagreements.push({ prior, reason: outcome.reason });
      }
    }

    return {
      storeRelPath,
      stored: current,
      compared: priorSameThread.length,
      filed,
      noDisagreements,
    };
  });
}

export function recordReviewThreadObservationBatch(
  input: RecordReviewThreadObservationBatchInput,
): ReadonlyArray<RecordReviewThreadObservationResult> {
  return input.observations.map((observationInput) =>
    recordReviewThreadObservation({
      ...observationInput,
      repoRoot: input.repoRoot,
      storeRelPath: input.storeRelPath ?? DEFAULT_OBSERVATION_STORE_REL_PATH,
      fileDisagreement: input.fileDisagreement ?? fileReviewThreadDisagreement,
    }),
  );
}

function hasFlagValue(value: string | undefined): value is string {
  return value !== undefined && value.length > 0 && !value.startsWith("--");
}

function readRequired(flags: Map<string, string>, key: string): string | { readonly error: string } {
  const value = flags.get(key);
  if (value === undefined) {
    return { error: `${key} is required` };
  }
  return value;
}

const REQUIRED_FLAGS = [
  "--tick",
  "--operative-authorization",
  "--agent",
  "--model",
  "--harness",
  "--pr-number",
  "--thread-id",
  "--conclusion",
  "--body",
] as const;

const OPTIONAL_FLAGS = ["--repo-root", "--store", "--observed-at"] as const;
const ALLOWED_FLAGS = new Set<string>([...REQUIRED_FLAGS, ...OPTIONAL_FLAGS]);

export function parseArgs(argv: string[]): ParseArgsResult {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; ) {
    const flag = argv[i]!;
    if (!flag.startsWith("--")) {
      return { kind: "error", message: `unknown positional argument: ${flag}` };
    }
    if (!ALLOWED_FLAGS.has(flag)) {
      return { kind: "error", message: `unknown argument: ${flag}` };
    }
    const value = argv[i + 1];
    if (!hasFlagValue(value)) {
      return { kind: "error", message: `${flag} requires a value` };
    }
    flags.set(flag, value);
    i += 2;
  }

  for (const flag of REQUIRED_FLAGS) {
    const value = readRequired(flags, flag);
    if (typeof value !== "string") {
      return { kind: "error", message: value.error };
    }
  }
  const prNumberRaw = flags.get("--pr-number")!;
  if (!/^\d+$/.test(prNumberRaw)) {
    return { kind: "error", message: "--pr-number must be a positive integer" };
  }
  const prNumber = Number.parseInt(prNumberRaw, 10);
  if (prNumber <= 0) {
    return { kind: "error", message: "--pr-number must be a positive integer" };
  }

  return {
    kind: "args",
    input: {
      repoRoot: flags.get("--repo-root") ?? ".",
      storeRelPath: flags.get("--store") ?? DEFAULT_OBSERVATION_STORE_REL_PATH,
      observedAt: flags.get("--observed-at") ?? flags.get("--tick")!,
      tick: flags.get("--tick")!,
      operativeAuthorization: flags.get("--operative-authorization")!,
      observation: {
        identity: {
          agent: flags.get("--agent")!,
          model: flags.get("--model")!,
          harness: flags.get("--harness")!,
        },
        prNumber,
        threadId: flags.get("--thread-id")!,
        conclusion: flags.get("--conclusion")!,
        body: flags.get("--body")!,
      },
    },
  };
}

function renderOutcome(outcome: RecordReviewThreadObservationResult): string {
  return JSON.stringify(
    {
      storeRelPath: outcome.storeRelPath,
      compared: outcome.compared,
      filed: outcome.filed.map((f) => ({
        priorAgent: f.prior.observation.identity.agent,
        relPath: f.outcome.write.relPath,
        status: f.outcome.write.status,
      })),
      noDisagreements: outcome.noDisagreements.map((n) => ({
        priorAgent: n.prior.observation.identity.agent,
        reason: n.reason,
      })),
    },
    null,
    2,
  );
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const parsed = parseArgs(argv);
  if (parsed.kind === "error") {
    console.error(`error: ${parsed.message}`);
    return 64;
  }
  const outcome = recordReviewThreadObservation(parsed.input);
  console.log(renderOutcome(outcome));
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
