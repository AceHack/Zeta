/**
 * Deterministic room-evidence emitter for the existing heartbeat lane.
 *
 * Style: the emitter records only that a named heartbeat lane completed this generator. It writes
 * immutable Git-backed ZetaStorageCell payloads, an audit envelope, and a parser-validated feed
 * entry. It has no private signer and therefore reports first-genesis authority as unresolved.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

import {
  makeStorageRecord,
  type StorageRecord,
  type StorageResult,
  type ZetaStoragePort,
  ZetaStorageCell,
} from "../browser-node/zeta-storage-cell";
import {
  decodeRoomEvidenceAuditEvent,
  DurableRoomEvidenceAuditLedger,
  encodeRoomEvidenceAuditEvent,
  makeRoomEvidenceAuditEvent,
  type RoomEvidenceAuditEvent,
} from "../observe/room/durable-room-evidence-audit";
import {
  DurableRoomEvidenceLedger,
  encodeRoomEvidenceReceipt,
  type RoomEvidenceResult,
  type RoomEvidenceReceipt,
} from "../observe/room/durable-room-evidence";
import {
  decodeRoomEvidenceLiveFeedIndex,
  DurableRoomEvidenceLiveFeedPublisher,
  ROOM_EVIDENCE_LIVE_FEED_DIRECTORY,
  ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE,
  type RoomEvidenceLiveFeedIndex,
  type RoomEvidenceLiveFeedPort,
  type RoomEvidenceLiveFeedWriter,
} from "../observe/room/durable-room-evidence-live-feed";
import { genesisEventHash, type AuditGenesisBinding } from "../research/zero-crossing-evidence-audit";
import {
  encodeRoomWitnessAdjudication,
  makeRoomWitnessAdjudication,
  persistRoomWitnessAdjudication,
} from "../observe/room/room-witness-adjudication";

export const HEARTBEAT_ROOM_EVIDENCE_SCHEMA = "zeta.heartbeat-room-evidence.v1" as const;
export const HEARTBEAT_ROOM_ID = "agent-heartbeat-observation";
export const HEARTBEAT_ROOM_FINGERPRINT = "room:agent-heartbeat-observation:v1";
export const HEARTBEAT_SPECTRUM_SLICE = "heartbeat-observation:v1";
export const HEARTBEAT_UNCONFIGURED_WITNESS_SCHEME = "unconfigured-local-witness";

export interface HeartbeatRoomEvidenceArgs {
  readonly agent: string;
  readonly runId: string;
  readonly repoRoot: string;
  readonly sourceSha: string;
  readonly dryRun: boolean;
}

export interface HeartbeatRoomEvidenceEmission {
  readonly event: RoomEvidenceAuditEvent;
  readonly receiptContentKey: string;
  readonly auditContentKey: string;
  /** Present only when this emission introduced a sequence-zero local-authority question. */
  readonly adjudicationContentKey?: string;
  readonly duplicate: boolean;
}

function succeeded<T>(value: T): RoomEvidenceResult<T> {
  return { ok: true, value };
}

function failed(reason: string): RoomEvidenceResult<never> {
  return { ok: false, reason };
}

function storageFailure(reason: string): StorageResult<never> {
  return { ok: false, reason, severity: "heat" };
}

function isAgent(value: string): boolean {
  return /^[a-z][a-z0-9-]{0,63}$/.test(value);
}

function isRunId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{1,256}$/.test(value);
}

function isSha(value: string): boolean {
  return /^[0-9a-f]{40}$/.test(value);
}

function contentPath(root: string, key: string): string {
  if (!/^[0-9a-f]{32}$/.test(key)) throw new RangeError("content key must be 32 lowercase hexadecimal characters");
  return join(root, `${key}.json`);
}

/** Git is the durable backend; its immutable payload names are ZetaStorageCell content keys. */
export class GitFolderStoragePort implements ZetaStoragePort {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async write(record: StorageRecord): Promise<StorageResult<string>> {
    const canonical = makeStorageRecord(record.payload);
    if (canonical.key !== record.key) return storageFailure("storage record key does not bind its payload");
    const path = contentPath(this.root, record.key);
    await mkdir(this.root, { recursive: true });
    try {
      const prior = await readFile(path, "utf8");
      if (prior !== record.payload)
        return storageFailure(`content-addressed path ${record.key} contains different bytes`);
      return { ok: true, value: record.key };
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      if (code !== "ENOENT")
        return storageFailure(`storage read failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      await writeFile(path, record.payload, { encoding: "utf8", flag: "wx" });
      return { ok: true, value: record.key };
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      if (code === "EEXIST") return this.write(record);
      return storageFailure(`storage write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async read(key: string): Promise<StorageResult<StorageRecord | null>> {
    let path: string;
    try {
      path = contentPath(this.root, key);
    } catch (error) {
      return storageFailure(error instanceof Error ? error.message : String(error));
    }
    try {
      const payload = await readFile(path, "utf8");
      const record = makeStorageRecord(payload);
      if (record.key !== key) return storageFailure(`content-addressed path ${key} does not bind stored bytes`);
      return { ok: true, value: record };
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      if (code === "ENOENT") return { ok: true, value: null };
      return storageFailure(`storage read failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async list(): Promise<StorageResult<string[]>> {
    try {
      const names = await readdir(this.root);
      const keys = names
        .filter((name) => /^[0-9a-f]{32}\.json$/.test(name))
        .map((name) => name.slice(0, -".json".length))
        .sort();
      return { ok: true, value: keys };
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      if (code === "ENOENT") return { ok: true, value: [] };
      return storageFailure(`storage list failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  close(): StorageResult<null> {
    return { ok: true, value: null };
  }
}

/** Maps the abstract feed writer paths to the static GitHub Pages `docs/room-evidence` tree. */
export class GitRoomEvidenceFeedPort implements RoomEvidenceLiveFeedPort, RoomEvidenceLiveFeedWriter {
  private readonly root: string;

  constructor(repoRoot: string) {
    this.root = resolve(repoRoot, "docs", "room-evidence");
  }

  private pathFor(path: string): string | null {
    const relativePath =
      path === ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE
        ? "index.json"
        : new RegExp(`^(?:${ROOM_EVIDENCE_LIVE_FEED_DIRECTORY}|adjudications)/[A-Za-z0-9._:-]+\\.json$`).test(path)
          ? path
          : null;
    if (relativePath === null) return null;
    const candidate = resolve(this.root, relativePath);
    const child = relative(this.root, candidate);
    return child === "" || (!child.startsWith(`..${sep}`) && child !== "..") ? candidate : null;
  }

  async read(path: string): Promise<string | null> {
    const target = this.pathFor(path);
    if (target === null) return null;
    try {
      return await readFile(target, "utf8");
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      if (code === "ENOENT") return null;
      throw error;
    }
  }

  async write(path: string, payload: string): Promise<RoomEvidenceResult<void>> {
    const target = this.pathFor(path);
    if (target === null) return failed(`feed path is outside the declared room-evidence namespace: ${path}`);
    try {
      await mkdir(resolve(target, ".."), { recursive: true });
      await writeFile(target, payload, "utf8");
      return succeeded(undefined);
    } catch (error) {
      return failed(`feed write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export function heartbeatEmitterId(agent: string): string {
  if (!isAgent(agent)) throw new RangeError("heartbeat agent must match /^[a-z][a-z0-9-]{0,63}$/");
  return `agent-heartbeat:${agent}`;
}

/** Explicitly unconfigured key material: it is a binding input, not a claimed signature. */
export function heartbeatGenesisBinding(agent: string): AuditGenesisBinding {
  const emitterId = heartbeatEmitterId(agent);
  return {
    emitterId,
    signer: `heartbeat-${agent}`,
    scheme: HEARTBEAT_UNCONFIGURED_WITNESS_SCHEME,
    keyFingerprint: `unconfigured-local-key:${agent}`,
    witnessRef: `heartbeat-local-witness:${agent}:unconfigured`,
  };
}

export function heartbeatObservationReceipt(
  agent: string,
  runId: string,
  sourceSha: string,
  sequence: number,
): RoomEvidenceReceipt {
  if (!isRunId(runId)) throw new RangeError("heartbeat run ID must be a printable bounded identifier");
  if (!isSha(sourceSha)) throw new RangeError("heartbeat source SHA must be 40 lowercase hexadecimal characters");
  if (!Number.isSafeInteger(sequence) || sequence < 0)
    throw new RangeError("heartbeat sequence must be a non-negative safe integer");
  return {
    schema: "zeta.room-evidence-receipt.v1",
    roomId: HEARTBEAT_ROOM_ID,
    roomFingerprint: HEARTBEAT_ROOM_FINGERPRINT,
    channelFingerprint: `channel:git-agent-heartbeat:${agent}`,
    spectrumSlice: HEARTBEAT_SPECTRUM_SLICE,
    signatureSplit: "witness:unconfigured-local-key",
    runId,
    episodeId: `heartbeat-run:${agent}:${runId}`,
    factId: `heartbeat-observation:${agent}:${sequence}`,
    sourceArtifact: `github-actions:agent-heartbeat.yml:${sourceSha}`,
    weight: 1,
    // This atom says only that the bounded generator ran. It is not an outcome posterior.
    uncertainty: { meanPpm: 0, precisionPpm: 1 },
    solved: false,
    actionCount: 0,
    elapsedMs: 0,
    actionBudget: 1,
    timeBudgetMs: 1,
  };
}

async function loadExistingFeed(port: GitRoomEvidenceFeedPort): Promise<
  RoomEvidenceResult<{
    readonly index: RoomEvidenceLiveFeedIndex;
    readonly events: readonly RoomEvidenceAuditEvent[];
  }>
> {
  const rawIndex = await port.read(ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE);
  if (rawIndex === null)
    return succeeded({
      index: { schema: "zeta.room-evidence-live-feed-index.v1", entries: [] },
      events: [],
    });
  const index = decodeRoomEvidenceLiveFeedIndex(rawIndex);
  if (!index.ok) return index;
  const events: RoomEvidenceAuditEvent[] = [];
  for (const entry of index.value.entries) {
    const rawEvent = await port.read(entry.file);
    if (rawEvent === null) return failed(`published feed entry ${entry.file} is unavailable`);
    const event = decodeRoomEvidenceAuditEvent(rawEvent);
    if (!event.ok) return failed(`published feed entry ${entry.file} is malformed: ${event.reason}`);
    if (event.value.delta.eventId !== entry.eventId)
      return failed(`published feed entry ${entry.file} does not bind ${entry.eventId}`);
    if (makeStorageRecord(rawEvent).key !== entry.auditContentKey) {
      return failed(`published feed entry ${entry.file} audit content key does not bind its envelope`);
    }
    if (makeStorageRecord(encodeRoomEvidenceReceipt(event.value.receipt)).key !== entry.receiptContentKey) {
      return failed(`published feed entry ${entry.file} receipt content key does not bind its receipt`);
    }
    events.push(event.value);
  }
  return succeeded({ index: index.value, events });
}

function nextHeartbeatPosition(
  events: readonly RoomEvidenceAuditEvent[],
  agent: string,
  runId: string,
): RoomEvidenceResult<{
  readonly sequence: number;
  readonly predecessor: string | undefined;
  readonly duplicate: RoomEvidenceAuditEvent | undefined;
}> {
  const emitterId = heartbeatEmitterId(agent);
  const own = events
    .filter((event) => event.delta.emitterId === emitterId)
    .sort((left, right) => left.delta.emitterSeq - right.delta.emitterSeq);
  const priorRun = own.find((event) => event.receipt.runId === runId);
  if (priorRun !== undefined)
    return succeeded({
      sequence: priorRun.delta.emitterSeq,
      predecessor: undefined,
      duplicate: priorRun,
    });
  const binding = heartbeatGenesisBinding(agent);
  for (const [index, event] of own.entries()) {
    if (event.delta.emitterSeq !== index)
      return failed(`heartbeat emitter ${emitterId} has a missing or repeated logical sequence`);
    const expectedPrevious = index === 0 ? genesisEventHash(binding) : own[index - 1]!.delta.eventId;
    if (event.delta.previousEventHash !== expectedPrevious)
      return failed(`heartbeat emitter ${emitterId} has an invalid predecessor at sequence ${index}`);
  }
  const latest = own.at(-1);
  return succeeded({ sequence: own.length, predecessor: latest?.delta.eventId, duplicate: undefined });
}

/** Emit once per named workflow run. A repeat of the same run is an idempotent no-op. */
export async function emitHeartbeatRoomEvidence(
  args: HeartbeatRoomEvidenceArgs,
): Promise<RoomEvidenceResult<HeartbeatRoomEvidenceEmission>> {
  if (!isAgent(args.agent)) return failed("heartbeat agent must match /^[a-z][a-z0-9-]{0,63}$/");
  if (!isRunId(args.runId)) return failed("heartbeat run ID must be a printable bounded identifier");
  if (!isSha(args.sourceSha)) return failed("heartbeat source SHA must be 40 lowercase hexadecimal characters");

  const feedPort = new GitRoomEvidenceFeedPort(args.repoRoot);
  const existing = await loadExistingFeed(feedPort);
  if (!existing.ok) return existing;
  const position = nextHeartbeatPosition(existing.value.events, args.agent, args.runId);
  if (!position.ok) return position;

  if (position.value.duplicate !== undefined) {
    const entry = existing.value.index.entries.find(
      (candidate) => candidate.eventId === position.value.duplicate!.delta.eventId,
    );
    if (entry === undefined) return failed("existing heartbeat event has no matching feed entry");
    return succeeded({
      event: position.value.duplicate,
      receiptContentKey: entry.receiptContentKey,
      auditContentKey: entry.auditContentKey,
      duplicate: true,
    });
  }

  const receipt = heartbeatObservationReceipt(args.agent, args.runId, args.sourceSha, position.value.sequence);
  const binding = heartbeatGenesisBinding(args.agent);
  const eventInput =
    position.value.sequence === 0
      ? { receipt, emitterId: heartbeatEmitterId(args.agent), emitterSeq: 0, genesisBinding: binding }
      : position.value.predecessor === undefined
        ? null
        : {
            receipt,
            emitterId: heartbeatEmitterId(args.agent),
            emitterSeq: position.value.sequence,
            previousEventHash: position.value.predecessor,
          };
  if (eventInput === null) return failed("non-genesis heartbeat emission requires the preceding event identity");
  const event = makeRoomEvidenceAuditEvent(eventInput);
  if (!event.ok) return event;
  if (args.dryRun) {
    const payload = encodeRoomEvidenceAuditEvent(event.value);
    return succeeded({
      event: event.value,
      receiptContentKey: makeStorageRecord(encodeRoomEvidenceReceipt(receipt)).key,
      auditContentKey: makeStorageRecord(payload).key,
      duplicate: false,
    });
  }

  const contentRoot = join(args.repoRoot, "docs", "room-evidence", "content");
  const storage = new ZetaStorageCell({
    primary: new GitFolderStoragePort(contentRoot),
    nodeId: heartbeatEmitterId(args.agent),
  });
  const ledger = new DurableRoomEvidenceAuditLedger({
    receiptLedger: new DurableRoomEvidenceLedger(storage),
    auditStorage: storage,
    schemes: [],
    roster: [],
  });
  const publisher = new DurableRoomEvidenceLiveFeedPublisher(ledger, feedPort, existing.value.index);
  const published = await publisher.appendAndPublish(event.value);
  if (!published.ok) return published;
  if (event.value.delta.emitterSeq !== 0 || event.value.genesisWitness !== undefined) {
    return succeeded({ event: event.value, ...published.value });
  }
  const adjudication = makeRoomWitnessAdjudication(
    {
      eventId: event.value.delta.eventId,
      auditContentKey: published.value.auditContentKey,
      receiptContentKey: published.value.receiptContentKey,
    },
    "unresolved",
    [],
  );
  if (!adjudication.ok) return adjudication;
  const persisted = await persistRoomWitnessAdjudication(storage, adjudication.value);
  if (!persisted.ok) return persisted;
  const named = await feedPort.write(
    `adjudications/${event.value.delta.eventId}.json`,
    encodeRoomWitnessAdjudication(adjudication.value),
  );
  if (!named.ok) return failed(`adjudication replay reference failed: ${named.reason}`);
  return succeeded({
    event: event.value,
    ...published.value,
    adjudicationContentKey: persisted.value.contentKey,
  });
}

function parseArgs(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): HeartbeatRoomEvidenceArgs | { readonly error: string } {
  let agent = env.AGENT ?? "";
  let runId = env.GITHUB_RUN_ID ?? "";
  let repoRoot = env.GITHUB_WORKSPACE ?? process.cwd();
  let sourceSha = env.GITHUB_SHA ?? "";
  let dryRun = false;
  const next = (index: number, flag: string): string | { readonly error: string } => {
    const value = argv[index + 1];
    return value === undefined ? { error: `${flag} requires a value` } : value;
  };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]!;
    if (flag === "--dry-run") dryRun = true;
    else if (flag === "--agent" || flag === "--run-id" || flag === "--repo-root" || flag === "--source-sha") {
      const value = next(index, flag);
      if (typeof value !== "string") return value;
      if (flag === "--agent") agent = value;
      if (flag === "--run-id") runId = value;
      if (flag === "--repo-root") repoRoot = value;
      if (flag === "--source-sha") sourceSha = value;
      index++;
    } else return { error: `unknown argument: ${flag}` };
  }
  return { agent, runId, repoRoot, sourceSha, dryRun };
}

if (import.meta.main) {
  const parsed = parseArgs(process.argv.slice(2));
  if ("error" in parsed) {
    console.error(`emit-room-evidence: ${parsed.error}`);
    process.exitCode = 2;
  } else {
    emitHeartbeatRoomEvidence(parsed).then((result) => {
      if (!result.ok) {
        console.error(`emit-room-evidence: ${result.reason}`);
        process.exitCode = 1;
        return;
      }
      console.log(
        JSON.stringify({
          schema: HEARTBEAT_ROOM_EVIDENCE_SCHEMA,
          eventId: result.value.event.delta.eventId,
          emitterSeq: result.value.event.delta.emitterSeq,
          duplicate: result.value.duplicate,
          authority: result.value.event.genesisWitness === undefined ? "unresolved" : "witness-material-present",
        }),
      );
    });
  }
}
