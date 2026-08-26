import {
  BROWSER_CHECKPOINT_RECORD_SCHEMA,
  browserCheckpointRecordNodeId,
  validateBrowserCheckpointRecord,
  type BrowserCheckpointFeedback,
  type BrowserCheckpointPort,
  type BrowserCheckpointRecord,
} from "../browser-node/browser-checkpoint-port";
import {
  openNativeIndexedDbCheckpointPort,
  type NativeIndexedDbCheckpointFeedback,
  type NativeIndexedDbCheckpointOptions,
} from "../browser-node/browser-indexeddb-checkpoint";
import {
  decodeBrowserRoomCheckpoint,
  encodeBrowserRoomCheckpoint,
  type BrowserRoomCheckpointFeedback,
  type DurableRoomRunTranscript,
} from "../browser-node/browser-room-checkpoint";
import type { BrowserLifecycleHostFeedback, BrowserLifecycleHostReadout } from "../browser-node/browser-lifecycle-host";
import type { BrowserTabTransportReadout } from "../browser-node/browser-tab-channel-selector";
import type { BrowserCheckpoint } from "../browser-node/browser-node";
import type { CrossRunReader } from "../chip9/chip8-cross-run-store";
import {
  browserCausalCorrectionCheckpointNodeId,
  decodeBrowserCausalCorrectionCheckpoint,
  encodeBrowserCausalCorrectionCheckpoint,
  type BrowserCausalCorrectionCheckpointFeedback,
} from "../browser-node/browser-causal-correction-checkpoint";
import {
  BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
  browserCausalHandoffCheckpointNodeId,
  decodeBrowserCausalHandoffCheckpoint,
  emptyBrowserCausalHandoffCheckpoint,
  encodeBrowserCausalHandoffCheckpoint,
  type BrowserCausalHandoffCheckpoint,
  type BrowserCausalHandoffCheckpointFeedback,
  type BrowserPendingCausalHandoff,
} from "../browser-node/browser-causal-handoff-checkpoint";
import {
  createBrowserCausalCorrectionLedger,
  foldBrowserCausalCorrection,
  foldBrowserCausalCorrections,
  type BrowserCausalCorrectionLedger,
  type BrowserCausalCorrectionLedgerFeedback,
} from "../browser-node/browser-causal-correction-ledger";
import type {
  BrowserCausalCorrectionNotice,
  BrowserCausalCorrectionReplayNotice,
  BrowserCausalCorrectionReplayAcknowledgement,
  BrowserCausalCorrectionReplayAdmission,
  BrowserCausalCorrectionReplayPort,
  BrowserCheckpointInvalidation,
  BrowserDatabaseExecutionReceiptNotice,
  BrowserDatabaseInvalidation,
} from "../browser-node/browser-tab-coordinator";
import type { DarkHallDatabaseReadout } from "./darkhall-database-readout";
import {
  darkHallCausalHandoffReadout,
  darkHallCausalReadout,
  type DarkHallCausalHandoffReadout,
  type DarkHallCausalHandoffState,
  type DarkHallCausalReadout,
} from "./darkhall-causal-readout";
import {
  startNativeDarkHallBrowser,
  type DarkHallBrowserBootstrapFeedback,
  type DarkHallBrowserBootstrapOptions,
  type DarkHallBrowserBootstrapResult,
  type DarkHallBrowserRuntime,
} from "./darkhall-browser-bootstrap";
import type { RoomRunTranscript } from "./darkhall-room";

export const DARK_HALL_BROWSER_DURABLE_RUNTIME_SCHEMA = "zeta.darkhall.browser-durable-runtime.v8" as const;

const MAX_CAUSAL_CHECKPOINT_SAVE_ATTEMPTS = 4;

type DurableRuntimeSource =
  | "browser-runtime"
  | "checkpoint-store"
  | "room-checkpoint"
  | "room-render"
  | "causal-ledger"
  | "causal-checkpoint"
  | "causal-handoff-checkpoint";
type UnderlyingFeedback =
  | BrowserCheckpointFeedback
  | NativeIndexedDbCheckpointFeedback
  | BrowserRoomCheckpointFeedback
  | BrowserCausalCorrectionCheckpointFeedback
  | BrowserCausalHandoffCheckpointFeedback
  | BrowserLifecycleHostFeedback
  | DarkHallBrowserBootstrapFeedback
  | BrowserCausalCorrectionLedgerFeedback;

export interface DarkHallBrowserDurableFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | UnderlyingFeedback["code"]
    | "browser-runtime-operation-threw"
    | "checkpoint-operation-threw"
    | "room-render-failed"
    | "causal-checkpoint-pending"
    | "causal-checkpoint-contention"
    | "causal-checkpoint-revision-exhausted"
    | "causal-handoff-checkpoint-pending"
    | "causal-handoff-checkpoint-contention"
    | "causal-handoff-checkpoint-revision-exhausted"
    | "causal-handoff-generation-exhausted";
  readonly source: DurableRuntimeSource;
  readonly detail: string;
  readonly cleanup: readonly string[];
}

export type DarkHallBrowserDurableResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: DarkHallBrowserDurableFeedback };

type DarkHallBrowserDurableFailure = Extract<DarkHallBrowserDurableResult<never>, { readonly ok: false }>;

export interface DarkHallBrowserDurableOptions extends Omit<
  DarkHallBrowserBootstrapOptions,
  "causalCorrectionReplay" | "checkpoint" | "onCheckpointInvalidated" | "transcript"
> {
  readonly initialTranscript: RoomRunTranscript;
  readonly maxCausalCorrections: number;
}

export interface NativeDarkHallBrowserDurableOptions
  extends DarkHallBrowserDurableOptions, NativeIndexedDbCheckpointOptions {}

export type DarkHallBrowserStarter = (
  options: DarkHallBrowserBootstrapOptions,
) => DarkHallBrowserBootstrapResult<DarkHallBrowserRuntime>;

export interface DarkHallBrowserDurableReadout {
  readonly schema: typeof DARK_HALL_BROWSER_DURABLE_RUNTIME_SCHEMA;
  readonly transport: BrowserTabTransportReadout;
  readonly host: BrowserLifecycleHostReadout;
  readonly recoveredRevision: number | null;
  readonly currentRevision: number | null;
  readonly payloadBytes: number | null;
  readonly checkpointSync: {
    readonly state: "idle" | "loading" | "applied" | "failed";
    readonly invalidation: BrowserCheckpointInvalidation | null;
    readonly appliedRevision: number | null;
    readonly feedback: DarkHallBrowserDurableFeedback | null;
  };
  readonly room: {
    readonly roomName: string;
    readonly seed: string;
    readonly latestTick: number | null;
    readonly continuationToken: string | null;
  };
  readonly database: DarkHallDatabaseReadout | null;
  readonly causal: DarkHallCausalReadout;
  readonly causalHandoff: DarkHallCausalHandoffReadout;
  readonly causalHandoffCheckpoint: {
    readonly state: "idle" | "saving" | "saved" | "failed";
    readonly recoveredRevision: number | null;
    readonly currentRevision: number | null;
    readonly payloadBytes: number | null;
    readonly feedback: DarkHallBrowserDurableFeedback | null;
  };
  readonly causalCheckpoint: {
    readonly state: "idle" | "saving" | "saved" | "failed";
    readonly recoveredRevision: number | null;
    readonly currentRevision: number | null;
    readonly payloadBytes: number | null;
    readonly feedback: DarkHallBrowserDurableFeedback | null;
  };
  readonly causalRenderFeedback: DarkHallBrowserDurableFeedback | null;
}

export interface DarkHallBrowserDurableRuntime {
  readonly crossRunReader: CrossRunReader;
  read(): DarkHallBrowserDurableReadout;
  transcript(): DurableRoomRunTranscript;
  renderTranscript(transcript: RoomRunTranscript): DarkHallBrowserDurableResult<DarkHallBrowserDurableReadout>;
  checkpoint(
    revision: number,
    transcript: RoomRunTranscript,
  ): Promise<DarkHallBrowserDurableResult<BrowserCheckpointRecord>>;
  retract(throughRevision: number): Promise<DarkHallBrowserDurableResult<boolean>>;
  drainCheckpointInvalidations(): Promise<DarkHallBrowserDurableResult<DarkHallBrowserDurableReadout>>;
  updateDatabaseReadout(readout: DarkHallDatabaseReadout): DarkHallBrowserDurableResult<DarkHallBrowserDurableReadout>;
  publishDatabaseInvalidation(
    databaseNodeId: BrowserDatabaseInvalidation["databaseNodeId"],
    revision: number,
  ): DarkHallBrowserDurableResult<DarkHallBrowserDurableReadout>;
  publishDatabaseExecutionReceipt(
    receipt: Omit<BrowserDatabaseExecutionReceiptNotice, "sourceTabId">,
  ): DarkHallBrowserDurableResult<DarkHallBrowserDurableReadout>;
  publishCausalCorrection(
    correction: Omit<BrowserCausalCorrectionNotice, "sourceTabId">,
  ): DarkHallBrowserDurableResult<DarkHallBrowserDurableReadout>;
  drainCausalCorrectionCheckpoint(): Promise<DarkHallBrowserDurableResult<DarkHallBrowserDurableReadout>>;
  drainCausalHandoffCheckpoint(): Promise<DarkHallBrowserDurableResult<DarkHallBrowserDurableReadout>>;
  stop(): DarkHallBrowserDurableResult<DarkHallBrowserDurableReadout>;
}

function succeeded<T>(value: T): DarkHallBrowserDurableResult<T> {
  return { ok: true, value };
}

function failed(
  source: DurableRuntimeSource,
  feedback: Pick<DarkHallBrowserDurableFeedback, "severity" | "code" | "detail">,
  cleanup: readonly string[] = [],
): DarkHallBrowserDurableFailure {
  return { ok: false, feedback: { ...feedback, source, cleanup } };
}

function thrown(
  source: "browser-runtime" | "checkpoint-store",
  code: "browser-runtime-operation-threw" | "checkpoint-operation-threw",
  operation: string,
): DarkHallBrowserDurableFailure {
  return {
    ok: false,
    feedback: {
      severity: "heat",
      code,
      source,
      detail: `The injected ${source} threw while ${operation}.`,
      cleanup: [],
    },
  };
}

function closePort(port: BrowserCheckpointPort): DarkHallBrowserDurableResult<null> {
  try {
    const closed = port.close();
    return closed.ok ? succeeded(null) : failed("checkpoint-store", closed.feedback);
  } catch {
    return thrown("checkpoint-store", "checkpoint-operation-threw", "closing");
  }
}

function closeAfterFailure(
  port: BrowserCheckpointPort,
  failure: DarkHallBrowserDurableFailure,
): DarkHallBrowserDurableFailure {
  const closed = closePort(port);
  if (closed.ok) return failure;
  return {
    ...failure,
    feedback: {
      ...failure.feedback,
      cleanup: [...failure.feedback.cleanup, `${closed.feedback.code}: ${closed.feedback.detail}`],
    },
  };
}

function roomSummary(transcript: DurableRoomRunTranscript): DarkHallBrowserDurableReadout["room"] {
  const latestTick = transcript.ticks.reduce<number | null>(
    (latest, tick) => (latest === null || tick.tick > latest ? tick.tick : latest),
    null,
  );
  return {
    roomName: transcript.roomName,
    seed: transcript.seed,
    latestTick,
    continuationToken: transcript.continuationReadout?.token ?? null,
  };
}

function isRevision(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function verifyRecord(
  value: unknown,
  expectedNodeId: string,
  expectedRevision?: number,
  expectedPayload?: Uint8Array,
): DarkHallBrowserDurableResult<BrowserCheckpointRecord> {
  const validated = validateBrowserCheckpointRecord(value);
  if (!validated.ok) return failed("checkpoint-store", validated.feedback);
  if (validated.value.nodeId !== expectedNodeId) {
    return failed("checkpoint-store", {
      severity: "heat",
      code: "checkpoint-record-invalid",
      detail: `Checkpoint storage returned node ${validated.value.nodeId} while ${expectedNodeId} was requested.`,
    });
  }
  if (expectedRevision !== undefined && validated.value.revision !== expectedRevision) {
    return failed("checkpoint-store", {
      severity: "heat",
      code: "checkpoint-record-invalid",
      detail: `Checkpoint storage returned revision ${String(validated.value.revision)} while ${String(expectedRevision)} was saved.`,
    });
  }
  if (expectedPayload !== undefined && !sameBytes(validated.value.payload, expectedPayload)) {
    return failed("checkpoint-store", {
      severity: "heat",
      code: "checkpoint-record-invalid",
      detail: "Checkpoint storage returned bytes different from the room payload that was saved.",
    });
  }
  return succeeded(validated.value);
}

function canonicalTranscript(transcript: RoomRunTranscript): DarkHallBrowserDurableResult<DurableRoomRunTranscript> {
  const encoded = encodeBrowserRoomCheckpoint(transcript);
  if (!encoded.ok) return failed("room-checkpoint", encoded.feedback);
  const decoded = decodeBrowserRoomCheckpoint(encoded.value);
  return decoded.ok ? succeeded(decoded.value) : failed("room-checkpoint", decoded.feedback);
}

async function loadCheckpoint(
  port: BrowserCheckpointPort,
  nodeId: string,
  operation = "loading a room checkpoint",
): Promise<DarkHallBrowserDurableResult<BrowserCheckpointRecord | null>> {
  try {
    const loaded = await port.load(nodeId);
    if (!loaded.ok) return failed("checkpoint-store", loaded.feedback);
    return loaded.value === null ? succeeded(null) : verifyRecord(loaded.value, nodeId);
  } catch {
    return thrown("checkpoint-store", "checkpoint-operation-threw", operation);
  }
}

function ledgerForCheckpoint(
  record: BrowserCheckpointRecord | null,
  maxCorrections: number,
): DarkHallBrowserDurableResult<BrowserCausalCorrectionLedger> {
  const created = createBrowserCausalCorrectionLedger(maxCorrections);
  if (!created.ok) return failed("causal-ledger", created.feedback);
  if (record === null) return succeeded(created.value);

  const decoded = decodeBrowserCausalCorrectionCheckpoint(record.payload);
  if (!decoded.ok) return failed("causal-checkpoint", decoded.feedback);
  const admitted = foldBrowserCausalCorrections(created.value, decoded.value.corrections);
  return admitted.ok ? succeeded(admitted.value) : failed("causal-ledger", admitted.feedback);
}

function handoffsForCheckpoint(
  record: BrowserCheckpointRecord | null,
  maxPendingHandoffs: number,
): DarkHallBrowserDurableResult<BrowserCausalHandoffCheckpoint> {
  const decoded =
    record === null
      ? emptyBrowserCausalHandoffCheckpoint(maxPendingHandoffs)
      : decodeBrowserCausalHandoffCheckpoint(record.payload);
  if (!decoded.ok) return failed("causal-handoff-checkpoint", decoded.feedback);
  if (decoded.value.pending.length > maxPendingHandoffs) {
    return failed("causal-handoff-checkpoint", {
      severity: "backpressure",
      code: "causal-handoff-checkpoint-capacity-exhausted",
      detail: `The recovered handoff checkpoint retained ${String(decoded.value.pending.length)} pending offers for current capacity ${String(maxPendingHandoffs)}.`,
    });
  }
  return succeeded({ ...decoded.value, maxPendingHandoffs });
}

type CausalHandoffCheckpointOperation =
  | {
      readonly kind: "offer";
      readonly generation: number;
      readonly handoff: BrowserPendingCausalHandoff;
    }
  | {
      readonly kind: "acknowledge";
      readonly targetTabId: string;
      readonly handoffId: string;
    };

function causalHandoffOwner(handoffId: string): string {
  const separator = handoffId.indexOf("@");
  return separator < 0 ? handoffId : handoffId.slice(separator + 1);
}

function transcriptForCheckpoint(
  record: BrowserCheckpointRecord | null,
  initialTranscript: DurableRoomRunTranscript,
): DarkHallBrowserDurableResult<DurableRoomRunTranscript> {
  if (record === null) return succeeded(initialTranscript);
  const decoded = decodeBrowserRoomCheckpoint(record.payload);
  return decoded.ok ? succeeded(decoded.value) : failed("room-checkpoint", decoded.feedback);
}

function bootstrapOptions(
  options: DarkHallBrowserDurableOptions,
  checkpoint: "none" | "durable",
  transcript: DurableRoomRunTranscript,
  causalReadout: DarkHallCausalReadout,
  causalHandoffReadout: DarkHallCausalHandoffReadout,
  onCheckpointInvalidated: (invalidation: BrowserCheckpointInvalidation) => void,
  onCausalCorrection: (correction: BrowserCausalCorrectionNotice) => void,
  causalCorrectionReplay: BrowserCausalCorrectionReplayPort,
): DarkHallBrowserBootstrapOptions {
  return {
    root: options.root,
    mount: options.mount,
    channelName: options.channelName,
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    ...(options.crossRunReader === undefined ? {} : { crossRunReader: options.crossRunReader }),
    nodeId: options.nodeId,
    tabId: options.tabId,
    initialSequence: options.initialSequence,
    maxTrackedTabs: options.maxTrackedTabs,
    maxFeedback: options.maxFeedback,
    capabilities: options.capabilities,
    checkpoint,
    transcript: { ...transcript, causalReadout, causalHandoffReadout },
    onCheckpointInvalidated,
    onCausalCorrection,
    causalCorrectionReplay,
    ...(options.onTabReadout === undefined ? {} : { onTabReadout: options.onTabReadout }),
    ...(options.onDatabaseInvalidated === undefined ? {} : { onDatabaseInvalidated: options.onDatabaseInvalidated }),
    ...(options.onDatabaseExecutionReceipt === undefined
      ? {}
      : { onDatabaseExecutionReceipt: options.onDatabaseExecutionReceipt }),
  };
}

/**
 * Compose a browser room with an injected durable checkpoint port. The port is
 * owned by the returned runtime and is closed on startup failure or stop.
 */
export async function startDurableDarkHallBrowser(
  options: DarkHallBrowserDurableOptions,
  checkpointPort: BrowserCheckpointPort,
  startBrowser: DarkHallBrowserStarter = startNativeDarkHallBrowser,
): Promise<DarkHallBrowserDurableResult<DarkHallBrowserDurableRuntime>> {
  const initial = canonicalTranscript(options.initialTranscript);
  if (!initial.ok) return closeAfterFailure(checkpointPort, initial);

  const roomCheckpointNodeId = browserCheckpointRecordNodeId("room", options.nodeId);
  const recovered = await loadCheckpoint(checkpointPort, roomCheckpointNodeId);
  if (!recovered.ok) return closeAfterFailure(checkpointPort, recovered);

  const selectedTranscript = transcriptForCheckpoint(recovered.value, initial.value);
  if (!selectedTranscript.ok) return closeAfterFailure(checkpointPort, selectedTranscript);

  const causalCheckpointNodeId = browserCausalCorrectionCheckpointNodeId(options.nodeId);
  const recoveredCausalCheckpoint = await loadCheckpoint(
    checkpointPort,
    causalCheckpointNodeId,
    "loading a causal correction checkpoint",
  );
  if (!recoveredCausalCheckpoint.ok) return closeAfterFailure(checkpointPort, recoveredCausalCheckpoint);

  const selectedCausalLedger = ledgerForCheckpoint(recoveredCausalCheckpoint.value, options.maxCausalCorrections);
  if (!selectedCausalLedger.ok) return closeAfterFailure(checkpointPort, selectedCausalLedger);

  const maxPendingCausalHandoffs = Math.max(0, options.maxTrackedTabs - 1);
  const causalHandoffCheckpointNodeId = browserCausalHandoffCheckpointNodeId(options.nodeId);
  const recoveredCausalHandoffCheckpoint = await loadCheckpoint(
    checkpointPort,
    causalHandoffCheckpointNodeId,
    "loading a causal handoff checkpoint",
  );
  if (!recoveredCausalHandoffCheckpoint.ok) {
    return closeAfterFailure(checkpointPort, recoveredCausalHandoffCheckpoint);
  }
  const selectedCausalHandoffs = handoffsForCheckpoint(
    recoveredCausalHandoffCheckpoint.value,
    maxPendingCausalHandoffs,
  );
  if (!selectedCausalHandoffs.ok) return closeAfterFailure(checkpointPort, selectedCausalHandoffs);

  let causalLedger: BrowserCausalCorrectionLedger = selectedCausalLedger.value;
  let causalFeedback: BrowserCausalCorrectionLedgerFeedback | null = null;
  let causalHandoffState: DarkHallCausalHandoffState = {
    status: "idle",
    direction: "none",
    handoffId: null,
    peerTabId: null,
    correctionCount: 0,
    admittedCorrections: 0,
    feedback: null,
  };
  let causalRenderFeedback: DarkHallBrowserDurableFeedback | null = null;
  let causalHandoffGeneration = selectedCausalHandoffs.value.generation;
  const pendingCausalHandoffs = new Map<string, BrowserPendingCausalHandoff>(
    selectedCausalHandoffs.value.pending.map((handoff) => [handoff.targetTabId, { ...handoff }]),
  );
  let causalHandoffCheckpointRecord = recoveredCausalHandoffCheckpoint.value;
  let causalHandoffCheckpointPendingWrites = 0;
  let causalHandoffCheckpointSync: DarkHallBrowserDurableReadout["causalHandoffCheckpoint"] = {
    state: causalHandoffCheckpointRecord === null ? "idle" : "saved",
    recoveredRevision: causalHandoffCheckpointRecord?.revision ?? null,
    currentRevision: causalHandoffCheckpointRecord?.revision ?? null,
    payloadBytes: causalHandoffCheckpointRecord?.payload.byteLength ?? null,
    feedback: null,
  };
  let causalHandoffCheckpointSyncTail: Promise<DarkHallBrowserDurableResult<null>> = Promise.resolve(succeeded(null));
  let causalCheckpointRecord = recoveredCausalCheckpoint.value;
  let causalCheckpointPendingWrites = 0;
  let causalCheckpointSync: DarkHallBrowserDurableReadout["causalCheckpoint"] = {
    state: causalCheckpointRecord === null ? "idle" : "saved",
    recoveredRevision: causalCheckpointRecord?.revision ?? null,
    currentRevision: causalCheckpointRecord?.revision ?? null,
    payloadBytes: causalCheckpointRecord?.payload.byteLength ?? null,
    feedback: null,
  };
  let causalCheckpointSyncTail: Promise<DarkHallBrowserDurableResult<null>> = Promise.resolve(succeeded(null));
  let browserRuntimeForCausalRender: DarkHallBrowserRuntime | null = null;
  let transcriptForCausalRender = selectedTranscript.value;
  let causalRenderPending = false;

  const currentCausalHandoffReadout = (): DarkHallCausalHandoffReadout =>
    darkHallCausalHandoffReadout(
      options.tabId,
      options.maxCausalCorrections,
      pendingCausalHandoffs.size,
      maxPendingCausalHandoffs,
      causalHandoffState,
    );

  const renderCausalProjection = (): void => {
    if (browserRuntimeForCausalRender === null) {
      causalRenderPending = true;
      return;
    }
    causalRenderPending = false;
    try {
      const rendered = browserRuntimeForCausalRender.updateTranscript({
        ...transcriptForCausalRender,
        causalReadout: darkHallCausalReadout(causalLedger, causalFeedback),
        causalHandoffReadout: currentCausalHandoffReadout(),
      });
      causalRenderFeedback = rendered.ok
        ? null
        : {
            severity: "heat",
            code: "room-render-failed",
            source: "room-render",
            detail: rendered.detail,
            cleanup: [],
          };
    } catch {
      causalRenderFeedback = thrown(
        "browser-runtime",
        "browser-runtime-operation-threw",
        "rendering a causal correction readout",
      ).feedback;
    }
  };

  const mergeCausalCheckpoint = (
    target: BrowserCausalCorrectionLedger,
    source: BrowserCausalCorrectionLedger,
  ): DarkHallBrowserDurableResult<BrowserCausalCorrectionLedger> => {
    const merged = foldBrowserCausalCorrections(target, source.corrections);
    return merged.ok ? succeeded(merged.value) : failed("causal-ledger", merged.feedback);
  };

  const persistCausalCheckpoint = async (): Promise<DarkHallBrowserDurableResult<null>> => {
    let candidateLedger = causalLedger;
    let baseRecord = causalCheckpointRecord;

    for (let attempt = 0; attempt < MAX_CAUSAL_CHECKPOINT_SAVE_ATTEMPTS; attempt += 1) {
      const encoded = encodeBrowserCausalCorrectionCheckpoint(candidateLedger);
      if (!encoded.ok) return failed("causal-checkpoint", encoded.feedback);
      if (baseRecord?.revision === Number.MAX_SAFE_INTEGER) {
        return failed("causal-checkpoint", {
          severity: "backpressure",
          code: "causal-checkpoint-revision-exhausted",
          detail: "The causal correction checkpoint exhausted its safe integer revision space.",
        });
      }
      const revision = (baseRecord?.revision ?? 0) + 1;
      let saved;
      try {
        saved = await checkpointPort.save({
          schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
          nodeId: causalCheckpointNodeId,
          revision,
          payload: encoded.value,
        });
      } catch {
        return thrown("checkpoint-store", "checkpoint-operation-threw", "saving a causal correction checkpoint");
      }
      if (saved.ok) {
        const verified = verifyRecord(saved.value, causalCheckpointNodeId, revision, encoded.value);
        if (!verified.ok) return verified;
        causalCheckpointRecord = verified.value;
        const previousLive = causalLedger;
        const live = mergeCausalCheckpoint(causalLedger, candidateLedger);
        if (!live.ok) return live;
        causalLedger = live.value;
        if (causalLedger !== previousLive) renderCausalProjection();
        return succeeded(null);
      }
      if (saved.feedback.code !== "checkpoint-revision-conflict") {
        return failed("checkpoint-store", saved.feedback);
      }

      const loaded = await loadCheckpoint(
        checkpointPort,
        causalCheckpointNodeId,
        "reconciling a causal correction checkpoint conflict",
      );
      if (!loaded.ok) return loaded;
      baseRecord = loaded.value;
      if (baseRecord === null) continue;
      const decoded = decodeBrowserCausalCorrectionCheckpoint(baseRecord.payload);
      if (!decoded.ok) return failed("causal-checkpoint", decoded.feedback);
      const mergedCandidate = mergeCausalCheckpoint(candidateLedger, decoded.value);
      if (!mergedCandidate.ok) return mergedCandidate;
      candidateLedger = mergedCandidate.value;
      const mergedLive = mergeCausalCheckpoint(causalLedger, decoded.value);
      if (!mergedLive.ok) return mergedLive;
      const previousLive = causalLedger;
      causalLedger = mergedLive.value;
      causalFeedback = null;
      if (causalLedger !== previousLive) renderCausalProjection();
    }

    return failed("causal-checkpoint", {
      severity: "backpressure",
      code: "causal-checkpoint-contention",
      detail: `The causal correction checkpoint changed during all ${String(MAX_CAUSAL_CHECKPOINT_SAVE_ATTEMPTS)} bounded save attempts.`,
    });
  };

  const scheduleCausalCheckpoint = (): void => {
    causalCheckpointPendingWrites += 1;
    causalCheckpointSync = {
      ...causalCheckpointSync,
      state: "saving",
      feedback: null,
    };
    causalCheckpointSyncTail = causalCheckpointSyncTail
      .then(() => persistCausalCheckpoint())
      .catch(() => thrown("checkpoint-store", "checkpoint-operation-threw", "queuing a causal correction checkpoint"))
      .then((result) => {
        causalCheckpointPendingWrites -= 1;
        causalCheckpointSync = {
          ...causalCheckpointSync,
          state: result.ok ? (causalCheckpointPendingWrites === 0 ? "saved" : "saving") : "failed",
          currentRevision: causalCheckpointRecord?.revision ?? null,
          payloadBytes: causalCheckpointRecord?.payload.byteLength ?? null,
          feedback: result.ok ? null : result.feedback,
        };
        return result;
      });
  };

  const applyCausalHandoffCheckpointOperation = (
    checkpoint: BrowserCausalHandoffCheckpoint,
    operation: CausalHandoffCheckpointOperation,
  ): DarkHallBrowserDurableResult<{
    readonly changed: boolean;
    readonly checkpoint: BrowserCausalHandoffCheckpoint;
  }> => {
    const pending = new Map(checkpoint.pending.map((handoff) => [handoff.targetTabId, { ...handoff }]));
    let generation = checkpoint.generation;
    let changed = checkpoint.maxPendingHandoffs !== maxPendingCausalHandoffs;

    if (operation.kind === "offer") {
      const previous = pending.get(operation.handoff.targetTabId);
      if (previous === undefined && pending.size >= maxPendingCausalHandoffs) {
        return failed("causal-handoff-checkpoint", {
          severity: "backpressure",
          code: "causal-handoff-checkpoint-capacity-exhausted",
          detail: `The durable handoff checkpoint retained ${String(pending.size)} pending offers and cannot admit ${operation.handoff.targetTabId}.`,
        });
      }
      generation = Math.max(generation, operation.generation);
      changed = changed || generation !== checkpoint.generation;
      const replace =
        previous === undefined ||
        operation.handoff.correctionCount > previous.correctionCount ||
        (operation.handoff.correctionCount === previous.correctionCount &&
          causalHandoffOwner(operation.handoff.handoffId) < causalHandoffOwner(previous.handoffId));
      if (replace) {
        pending.set(operation.handoff.targetTabId, { ...operation.handoff });
        changed = true;
      }
    } else {
      const previous = pending.get(operation.targetTabId);
      if (previous?.handoffId === operation.handoffId) {
        pending.delete(operation.targetTabId);
        changed = true;
      }
    }

    return succeeded({
      changed,
      checkpoint: {
        schema: BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
        maxPendingHandoffs: maxPendingCausalHandoffs,
        generation,
        pending: [...pending.values()],
      },
    });
  };

  const persistCausalHandoffCheckpoint = async (
    operation: CausalHandoffCheckpointOperation,
  ): Promise<DarkHallBrowserDurableResult<null>> => {
    let baseRecord = causalHandoffCheckpointRecord;

    for (let attempt = 0; attempt < MAX_CAUSAL_CHECKPOINT_SAVE_ATTEMPTS; attempt += 1) {
      const base = handoffsForCheckpoint(baseRecord, maxPendingCausalHandoffs);
      if (!base.ok) return base;
      const applied = applyCausalHandoffCheckpointOperation(base.value, operation);
      if (!applied.ok) return applied;
      if (!applied.value.changed) {
        causalHandoffCheckpointRecord = baseRecord;
        causalHandoffGeneration = Math.max(causalHandoffGeneration, applied.value.checkpoint.generation);
        return succeeded(null);
      }
      if (baseRecord?.revision === Number.MAX_SAFE_INTEGER) {
        return failed("causal-handoff-checkpoint", {
          severity: "backpressure",
          code: "causal-handoff-checkpoint-revision-exhausted",
          detail: "The causal handoff checkpoint exhausted its safe integer revision space.",
        });
      }
      const encoded = encodeBrowserCausalHandoffCheckpoint(applied.value.checkpoint);
      if (!encoded.ok) return failed("causal-handoff-checkpoint", encoded.feedback);
      const revision = (baseRecord?.revision ?? 0) + 1;
      let saved;
      try {
        saved = await checkpointPort.save({
          schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
          nodeId: causalHandoffCheckpointNodeId,
          revision,
          payload: encoded.value,
        });
      } catch {
        return thrown("checkpoint-store", "checkpoint-operation-threw", "saving a causal handoff checkpoint");
      }
      if (saved.ok) {
        const verified = verifyRecord(saved.value, causalHandoffCheckpointNodeId, revision, encoded.value);
        if (!verified.ok) return verified;
        causalHandoffCheckpointRecord = verified.value;
        causalHandoffGeneration = Math.max(causalHandoffGeneration, applied.value.checkpoint.generation);
        return succeeded(null);
      }
      if (saved.feedback.code !== "checkpoint-revision-conflict") return failed("checkpoint-store", saved.feedback);

      const loaded = await loadCheckpoint(
        checkpointPort,
        causalHandoffCheckpointNodeId,
        "reconciling a causal handoff checkpoint conflict",
      );
      if (!loaded.ok) return loaded;
      baseRecord = loaded.value;
    }

    return failed("causal-handoff-checkpoint", {
      severity: "backpressure",
      code: "causal-handoff-checkpoint-contention",
      detail: `The causal handoff checkpoint changed during all ${String(MAX_CAUSAL_CHECKPOINT_SAVE_ATTEMPTS)} bounded save attempts.`,
    });
  };

  const scheduleCausalHandoffCheckpoint = (operation: CausalHandoffCheckpointOperation): void => {
    causalHandoffCheckpointPendingWrites += 1;
    causalHandoffCheckpointSync = { ...causalHandoffCheckpointSync, state: "saving", feedback: null };
    causalHandoffCheckpointSyncTail = causalHandoffCheckpointSyncTail
      .then(() => persistCausalHandoffCheckpoint(operation))
      .catch(() => thrown("checkpoint-store", "checkpoint-operation-threw", "queuing a causal handoff checkpoint"))
      .then((result) => {
        causalHandoffCheckpointPendingWrites -= 1;
        causalHandoffCheckpointSync = {
          ...causalHandoffCheckpointSync,
          state: result.ok ? (causalHandoffCheckpointPendingWrites === 0 ? "saved" : "saving") : "failed",
          currentRevision: causalHandoffCheckpointRecord?.revision ?? null,
          payloadBytes: causalHandoffCheckpointRecord?.payload.byteLength ?? null,
          feedback: result.ok ? null : result.feedback,
        };
        if (!result.ok) {
          if (operation.kind === "offer") {
            const current = pendingCausalHandoffs.get(operation.handoff.targetTabId);
            if (current?.handoffId === operation.handoff.handoffId) {
              pendingCausalHandoffs.delete(operation.handoff.targetTabId);
            }
          }
          causalHandoffState = {
            status: result.feedback.severity === "backpressure" ? "backpressured" : "heat",
            direction: "outbound",
            handoffId: operation.kind === "offer" ? operation.handoff.handoffId : operation.handoffId,
            peerTabId: operation.kind === "offer" ? operation.handoff.targetTabId : operation.targetTabId,
            correctionCount: operation.kind === "offer" ? operation.handoff.correctionCount : 0,
            admittedCorrections: 0,
            feedback: {
              severity: result.feedback.severity,
              code: result.feedback.code,
              detail: result.feedback.detail,
            },
          };
          renderCausalProjection();
        }
        return result;
      });
  };

  const onCausalCorrection = (correction: BrowserCausalCorrectionNotice): void => {
    const previous = causalLedger;
    const admitted = foldBrowserCausalCorrection(causalLedger, correction);
    if (admitted.ok) {
      causalLedger = admitted.value;
      causalFeedback = null;
      if (causalLedger !== previous) scheduleCausalCheckpoint();
    } else {
      causalFeedback = admitted.feedback;
    }
    renderCausalProjection();
    options.onCausalCorrection?.(correction);
  };

  const receiveCausalCorrectionReplay = (
    replay: BrowserCausalCorrectionReplayNotice,
  ): BrowserCausalCorrectionReplayAdmission => {
    const previous = causalLedger;
    const admitted = foldBrowserCausalCorrections(causalLedger, replay.corrections);
    if (admitted.ok) {
      causalLedger = admitted.value;
      causalFeedback = null;
      const admittedCorrections = causalLedger.corrections.length - previous.corrections.length;
      causalHandoffState = {
        status: admittedCorrections === 0 ? "duplicate" : "received",
        direction: "inbound",
        handoffId: replay.handoffId,
        peerTabId: replay.sourceTabId,
        correctionCount: replay.corrections.length,
        admittedCorrections,
        feedback: null,
      };
      if (causalLedger !== previous) scheduleCausalCheckpoint();
      renderCausalProjection();
      return {
        disposition: admittedCorrections === 0 ? "duplicate" : "admitted",
        admittedCorrections,
        feedback: null,
      };
    } else {
      causalFeedback = admitted.feedback;
      causalHandoffState = {
        status: admitted.feedback.severity === "backpressure" ? "backpressured" : "heat",
        direction: "inbound",
        handoffId: replay.handoffId,
        peerTabId: replay.sourceTabId,
        correctionCount: replay.corrections.length,
        admittedCorrections: 0,
        feedback: admitted.feedback,
      };
      renderCausalProjection();
      return {
        disposition: admitted.feedback.severity === "backpressure" ? "backpressured" : "heat",
        admittedCorrections: 0,
        feedback: { ...admitted.feedback },
      };
    }
  };

  const acknowledgeCausalCorrectionReplay = (acknowledgement: BrowserCausalCorrectionReplayAcknowledgement): void => {
    const pendingCausalHandoff = pendingCausalHandoffs.get(acknowledgement.sourceTabId);
    if (
      pendingCausalHandoff === undefined ||
      acknowledgement.handoffId !== pendingCausalHandoff.handoffId ||
      acknowledgement.sourceTabId !== pendingCausalHandoff.targetTabId ||
      acknowledgement.targetTabId !== options.tabId ||
      acknowledgement.correctionCount !== pendingCausalHandoff.correctionCount
    ) {
      return;
    }
    causalHandoffState = {
      status:
        acknowledgement.disposition === "admitted"
          ? "acknowledged"
          : acknowledgement.disposition === "backpressured"
            ? "backpressured"
            : acknowledgement.disposition,
      direction: "outbound",
      handoffId: acknowledgement.handoffId,
      peerTabId: acknowledgement.sourceTabId,
      correctionCount: acknowledgement.correctionCount,
      admittedCorrections: acknowledgement.admittedCorrections,
      feedback: acknowledgement.feedback === null ? null : { ...acknowledgement.feedback },
    };
    pendingCausalHandoffs.delete(acknowledgement.sourceTabId);
    scheduleCausalHandoffCheckpoint({
      kind: "acknowledge",
      targetTabId: acknowledgement.sourceTabId,
      handoffId: acknowledgement.handoffId,
    });
    renderCausalProjection();
  };

  const nextCausalHandoffId = (): string | null => {
    if (causalHandoffGeneration === Number.MAX_SAFE_INTEGER) return null;
    causalHandoffGeneration += 1;
    return `replay/${String(causalHandoffGeneration)}@${options.tabId}`;
  };

  const previewCausalHandoffId = (): string => {
    const generation = Math.min(Number.MAX_SAFE_INTEGER, causalHandoffGeneration + 1);
    return `replay/${String(generation)}@${options.tabId}`;
  };

  const causalCorrectionReplay: BrowserCausalCorrectionReplayPort = {
    maxCorrections: options.maxCausalCorrections,
    snapshot: (targetTabId) => {
      const corrections = causalLedger.corrections.map((correction) => ({ ...correction }));
      if (corrections.length === 0) {
        causalHandoffState = {
          status: "idle",
          direction: "none",
          handoffId: null,
          peerTabId: null,
          correctionCount: 0,
          admittedCorrections: 0,
          feedback: null,
        };
        renderCausalProjection();
        return { handoffId: previewCausalHandoffId(), corrections };
      }

      const pending = pendingCausalHandoffs.get(targetTabId);
      if (pending === undefined && pendingCausalHandoffs.size >= maxPendingCausalHandoffs) {
        const handoffId = previewCausalHandoffId();
        causalHandoffState = {
          status: "backpressured",
          direction: "outbound",
          handoffId,
          peerTabId: targetTabId,
          correctionCount: corrections.length,
          admittedCorrections: 0,
          feedback: {
            severity: "backpressure",
            code: "causal-correction-replay-pending-capacity-exhausted",
            detail: `The runtime retained ${String(pendingCausalHandoffs.size)} pending peer handoffs and will not discard one to admit ${targetTabId}.`,
          },
        };
        renderCausalProjection();
        return { handoffId, corrections: [] };
      }

      const handoffId = pending?.correctionCount === corrections.length ? pending.handoffId : nextCausalHandoffId();
      if (handoffId === null) {
        const exhaustedId = `replay/${String(Number.MAX_SAFE_INTEGER)}@${options.tabId}`;
        causalHandoffState = {
          status: "backpressured",
          direction: "outbound",
          handoffId: exhaustedId,
          peerTabId: targetTabId,
          correctionCount: corrections.length,
          admittedCorrections: 0,
          feedback: {
            severity: "backpressure",
            code: "causal-handoff-generation-exhausted",
            detail: "The runtime exhausted its safe integer causal handoff generation space.",
          },
        };
        renderCausalProjection();
        return { handoffId: exhaustedId, corrections: [] };
      }
      const nextPending = { handoffId, targetTabId, correctionCount: corrections.length };
      pendingCausalHandoffs.set(targetTabId, nextPending);
      if (pending?.handoffId !== handoffId || pending?.correctionCount !== corrections.length) {
        scheduleCausalHandoffCheckpoint({
          kind: "offer",
          generation: causalHandoffGeneration,
          handoff: nextPending,
        });
      }
      causalHandoffState = {
        status: "offered",
        direction: "outbound",
        handoffId,
        peerTabId: targetTabId,
        correctionCount: corrections.length,
        admittedCorrections: 0,
        feedback: null,
      };
      renderCausalProjection();
      return { handoffId, corrections };
    },
    receive: receiveCausalCorrectionReplay,
    acknowledge: acknowledgeCausalCorrectionReplay,
  };

  let receiveCheckpointInvalidation: ((invalidation: BrowserCheckpointInvalidation) => void) | null = null;
  let startupInvalidation: BrowserCheckpointInvalidation | null = null;
  const onCheckpointInvalidated = (invalidation: BrowserCheckpointInvalidation): void => {
    if (receiveCheckpointInvalidation === null) {
      startupInvalidation = invalidation;
      return;
    }
    receiveCheckpointInvalidation(invalidation);
  };

  let started: DarkHallBrowserBootstrapResult<DarkHallBrowserRuntime>;
  try {
    started = startBrowser(
      bootstrapOptions(
        options,
        recovered.value === null ? "none" : "durable",
        selectedTranscript.value,
        darkHallCausalReadout(causalLedger, causalFeedback),
        currentCausalHandoffReadout(),
        onCheckpointInvalidated,
        onCausalCorrection,
        causalCorrectionReplay,
      ),
    );
  } catch {
    return closeAfterFailure(checkpointPort, thrown("browser-runtime", "browser-runtime-operation-threw", "starting"));
  }
  if (!started.ok) {
    return closeAfterFailure(checkpointPort, failed("browser-runtime", started.feedback, started.feedback.cleanup));
  }

  const browserRuntime = started.value;
  browserRuntimeForCausalRender = browserRuntime;
  if (causalRenderPending) renderCausalProjection();
  const recoveredRevision = recovered.value?.revision ?? null;
  let currentRecord = recovered.value;
  let currentTranscript = selectedTranscript.value;
  let finalized = false;
  let localCheckpointGeneration = 0;
  let checkpointSync: DarkHallBrowserDurableReadout["checkpointSync"] = {
    state: "idle",
    invalidation: null,
    appliedRevision: currentRecord?.revision ?? null,
    feedback: null,
  };
  let databaseReadout: DarkHallDatabaseReadout | null = null;
  let checkpointSyncTail: Promise<DarkHallBrowserDurableResult<null>> = Promise.resolve(succeeded(null));

  const read = (): DarkHallBrowserDurableReadout => ({
    schema: DARK_HALL_BROWSER_DURABLE_RUNTIME_SCHEMA,
    transport: browserRuntime.transport,
    host: browserRuntime.host.read(),
    recoveredRevision,
    currentRevision: currentRecord?.revision ?? null,
    payloadBytes: currentRecord?.payload.byteLength ?? null,
    checkpointSync,
    room: roomSummary(currentTranscript),
    database: databaseReadout,
    causal: darkHallCausalReadout(causalLedger, causalFeedback),
    causalHandoff: currentCausalHandoffReadout(),
    causalHandoffCheckpoint: {
      ...causalHandoffCheckpointSync,
      feedback:
        causalHandoffCheckpointSync.feedback === null
          ? null
          : { ...causalHandoffCheckpointSync.feedback, cleanup: [...causalHandoffCheckpointSync.feedback.cleanup] },
    },
    causalCheckpoint: {
      ...causalCheckpointSync,
      feedback:
        causalCheckpointSync.feedback === null
          ? null
          : { ...causalCheckpointSync.feedback, cleanup: [...causalCheckpointSync.feedback.cleanup] },
    },
    causalRenderFeedback:
      causalRenderFeedback === null ? null : { ...causalRenderFeedback, cleanup: [...causalRenderFeedback.cleanup] },
  });

  const updateRenderedTranscript = (nextTranscript: DurableRoomRunTranscript): DarkHallBrowserDurableResult<null> => {
    transcriptForCausalRender = nextTranscript;
    try {
      const rendered = browserRuntime.updateTranscript({
        ...nextTranscript,
        causalReadout: darkHallCausalReadout(causalLedger, causalFeedback),
        causalHandoffReadout: currentCausalHandoffReadout(),
      });
      if (rendered.ok) {
        causalRenderFeedback = null;
        return succeeded(null);
      }
      causalRenderFeedback = {
        severity: "heat",
        code: "room-render-failed",
        source: "room-render",
        detail: rendered.detail,
        cleanup: [],
      };
      return { ok: false, feedback: causalRenderFeedback };
    } catch {
      const failure = thrown("browser-runtime", "browser-runtime-operation-threw", "rendering a room transcript");
      causalRenderFeedback = failure.feedback;
      return failure;
    }
  };

  const updateCheckpointReadout = (checkpoint: BrowserCheckpoint): DarkHallBrowserDurableResult<null> => {
    try {
      const updated = browserRuntime.host.updateCheckpoint(checkpoint);
      return updated.ok ? succeeded(null) : failed("browser-runtime", updated.feedback);
    } catch {
      return thrown("browser-runtime", "browser-runtime-operation-threw", "updating checkpoint liveness");
    }
  };

  const publishCheckpointInvalidation = (
    invalidation: Omit<BrowserCheckpointInvalidation, "sourceTabId">,
  ): DarkHallBrowserDurableResult<null> => {
    try {
      const published = browserRuntime.host.publishCheckpointInvalidation(
        invalidation.operation,
        invalidation.revision,
      );
      return published.ok ? succeeded(null) : failed("browser-runtime", published.feedback);
    } catch {
      return thrown("browser-runtime", "browser-runtime-operation-threw", "publishing checkpoint invalidation");
    }
  };

  const applyLoadedCheckpoint = (
    record: BrowserCheckpointRecord | null,
    invalidation: BrowserCheckpointInvalidation,
  ): DarkHallBrowserDurableResult<null> => {
    const selected = transcriptForCheckpoint(record, initial.value);
    if (!selected.ok) return selected;
    if (finalized) {
      return failed("checkpoint-store", {
        severity: "heat",
        code: "checkpoint-store-closed",
        detail: "The durable browser room runtime stopped before checkpoint synchronization completed.",
      });
    }

    currentRecord = record;
    currentTranscript = selected.value;
    const checkpointReadout = updateCheckpointReadout(record === null ? "none" : "durable");
    const rendered = updateRenderedTranscript(currentTranscript);
    if (!checkpointReadout.ok) return checkpointReadout;
    if (!rendered.ok) return rendered;

    checkpointSync = {
      state: "applied",
      invalidation,
      appliedRevision: record?.revision ?? null,
      feedback: null,
    };
    return succeeded(null);
  };

  const reconcileCheckpointInvalidation = async (
    invalidation: BrowserCheckpointInvalidation,
  ): Promise<DarkHallBrowserDurableResult<null>> => {
    checkpointSync = {
      state: "loading",
      invalidation,
      appliedRevision: currentRecord?.revision ?? null,
      feedback: null,
    };
    const generationBeforeLoad = localCheckpointGeneration;
    const loaded = await loadCheckpoint(checkpointPort, roomCheckpointNodeId);
    if (loaded.ok && generationBeforeLoad !== localCheckpointGeneration) {
      checkpointSync = {
        state: "applied",
        invalidation,
        appliedRevision: currentRecord?.revision ?? null,
        feedback: null,
      };
      return succeeded(null);
    }
    const reconciled = loaded.ok ? applyLoadedCheckpoint(loaded.value, invalidation) : loaded;
    if (!reconciled.ok) {
      checkpointSync = {
        state: "failed",
        invalidation,
        appliedRevision: currentRecord?.revision ?? null,
        feedback: reconciled.feedback,
      };
    }
    return reconciled;
  };

  receiveCheckpointInvalidation = (invalidation) => {
    checkpointSyncTail = checkpointSyncTail
      .then(() => reconcileCheckpointInvalidation(invalidation))
      .catch(() => {
        const failure = thrown(
          "checkpoint-store",
          "checkpoint-operation-threw",
          "synchronizing a checkpoint invalidation",
        );
        checkpointSync = {
          state: "failed",
          invalidation,
          appliedRevision: currentRecord?.revision ?? null,
          feedback: failure.feedback,
        };
        return failure;
      });
  };
  if (startupInvalidation !== null) receiveCheckpointInvalidation(startupInvalidation);

  return succeeded({
    crossRunReader: browserRuntime.crossRunReader,
    read,
    transcript: () => currentTranscript,
    renderTranscript: (nextTranscript) => {
      if (finalized) {
        return failed("browser-runtime", {
          severity: "heat",
          code: "host-stopped",
          detail: "The durable browser room runtime has already stopped.",
        });
      }
      const canonical = canonicalTranscript(nextTranscript);
      if (!canonical.ok) return canonical;
      const rendered = updateRenderedTranscript(canonical.value);
      if (!rendered.ok) return rendered;
      return succeeded(read());
    },
    checkpoint: async (revision, nextTranscript) => {
      if (finalized) {
        return failed("checkpoint-store", {
          severity: "heat",
          code: "checkpoint-store-closed",
          detail: "The durable browser room runtime has already stopped.",
        });
      }
      if (!isRevision(revision)) {
        return failed("checkpoint-store", {
          severity: "heat",
          code: "checkpoint-record-invalid",
          detail: "A durable browser room revision must be a non-negative safe integer.",
        });
      }
      const encoded = encodeBrowserRoomCheckpoint(nextTranscript);
      if (!encoded.ok) return failed("room-checkpoint", encoded.feedback);

      let saved;
      try {
        saved = await checkpointPort.save({
          schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
          nodeId: roomCheckpointNodeId,
          revision,
          payload: encoded.value,
        });
      } catch {
        return thrown("checkpoint-store", "checkpoint-operation-threw", "saving a room checkpoint");
      }
      if (!saved.ok) return failed("checkpoint-store", saved.feedback);
      const verified = verifyRecord(saved.value, roomCheckpointNodeId, revision, encoded.value);
      if (!verified.ok) return verified;

      localCheckpointGeneration += 1;
      currentRecord = verified.value;
      const decoded = decodeBrowserRoomCheckpoint(verified.value.payload);
      if (!decoded.ok) return failed("room-checkpoint", decoded.feedback);
      currentTranscript = decoded.value;
      const published = publishCheckpointInvalidation({ operation: "saved", revision });
      const checkpointReadout = updateCheckpointReadout("durable");
      const rendered = updateRenderedTranscript(currentTranscript);
      if (!checkpointReadout.ok) return checkpointReadout;
      if (!rendered.ok) return rendered;
      return published.ok ? succeeded(verified.value) : published;
    },
    retract: async (throughRevision) => {
      if (finalized) {
        return failed("checkpoint-store", {
          severity: "heat",
          code: "checkpoint-store-closed",
          detail: "The durable browser room runtime has already stopped.",
        });
      }
      if (!isRevision(throughRevision)) {
        return failed("checkpoint-store", {
          severity: "heat",
          code: "checkpoint-record-invalid",
          detail: "A durable browser room retraction revision must be a non-negative safe integer.",
        });
      }
      let removed;
      try {
        removed = await checkpointPort.remove(roomCheckpointNodeId, throughRevision);
      } catch {
        return thrown("checkpoint-store", "checkpoint-operation-threw", "retracting a room checkpoint");
      }
      if (!removed.ok) return failed("checkpoint-store", removed.feedback);
      if (!removed.value) return succeeded(false);

      localCheckpointGeneration += 1;
      currentRecord = null;
      currentTranscript = initial.value;
      const published = publishCheckpointInvalidation({ operation: "removed", revision: throughRevision });
      const checkpointReadout = updateCheckpointReadout("none");
      const rendered = updateRenderedTranscript(currentTranscript);
      if (!checkpointReadout.ok) return checkpointReadout;
      if (!rendered.ok) return rendered;
      return published.ok ? succeeded(true) : published;
    },
    drainCheckpointInvalidations: async () => {
      const synchronized = await checkpointSyncTail;
      return synchronized.ok ? succeeded(read()) : synchronized;
    },
    updateDatabaseReadout: (nextReadout) => {
      if (finalized) {
        return failed("browser-runtime", {
          severity: "heat",
          code: "host-stopped",
          detail: "The durable browser room runtime has already stopped.",
        });
      }
      try {
        const rendered = browserRuntime.updateDatabaseReadout(nextReadout);
        if (!rendered.ok) {
          return {
            ok: false,
            feedback: {
              severity: "heat",
              code: "room-render-failed",
              source: "room-render",
              detail: rendered.detail,
              cleanup: [],
            },
          };
        }
      } catch {
        return thrown("browser-runtime", "browser-runtime-operation-threw", "rendering a database readout");
      }
      databaseReadout = nextReadout;
      return succeeded(read());
    },
    publishDatabaseInvalidation: (databaseNodeId, revision) => {
      if (finalized) {
        return failed("browser-runtime", {
          severity: "heat",
          code: "host-stopped",
          detail: "The durable browser room runtime has already stopped.",
        });
      }
      try {
        const published = browserRuntime.host.publishDatabaseInvalidation(databaseNodeId, revision);
        return published.ok ? succeeded(read()) : failed("browser-runtime", published.feedback);
      } catch {
        return thrown("browser-runtime", "browser-runtime-operation-threw", "publishing database invalidation");
      }
    },
    publishDatabaseExecutionReceipt: (receipt) => {
      if (finalized) {
        return failed("browser-runtime", {
          severity: "heat",
          code: "host-stopped",
          detail: "The durable browser room runtime has already stopped.",
        });
      }
      try {
        const published = browserRuntime.host.publishDatabaseExecutionReceipt(receipt);
        return published.ok ? succeeded(read()) : failed("browser-runtime", published.feedback);
      } catch {
        return thrown("browser-runtime", "browser-runtime-operation-threw", "publishing database execution receipt");
      }
    },
    publishCausalCorrection: (correction) => {
      if (finalized) {
        return failed("browser-runtime", {
          severity: "heat",
          code: "host-stopped",
          detail: "The durable browser room runtime has already stopped.",
        });
      }
      const notice: BrowserCausalCorrectionNotice = { sourceTabId: options.tabId, ...correction };
      const previous = causalLedger;
      const admitted = foldBrowserCausalCorrection(causalLedger, notice);
      if (!admitted.ok) {
        causalFeedback = admitted.feedback;
        renderCausalProjection();
        return failed("causal-ledger", admitted.feedback);
      }
      try {
        const published = browserRuntime.host.publishCausalCorrection(correction);
        if (!published.ok) return failed("browser-runtime", published.feedback);
      } catch {
        return thrown("browser-runtime", "browser-runtime-operation-threw", "publishing causal correction");
      }
      causalLedger = admitted.value;
      causalFeedback = null;
      if (causalLedger !== previous) scheduleCausalCheckpoint();
      const rendered = updateRenderedTranscript(currentTranscript);
      return rendered.ok ? succeeded(read()) : rendered;
    },
    drainCausalCorrectionCheckpoint: async () => {
      if (causalCheckpointPendingWrites === 0 && causalCheckpointSync.state === "failed") {
        scheduleCausalCheckpoint();
      }
      const synchronized = await causalCheckpointSyncTail;
      return synchronized.ok ? succeeded(read()) : synchronized;
    },
    drainCausalHandoffCheckpoint: async () => {
      const synchronized = await causalHandoffCheckpointSyncTail;
      return synchronized.ok ? succeeded(read()) : synchronized;
    },
    stop: () => {
      if (finalized) return succeeded(read());
      if (causalCheckpointPendingWrites > 0) {
        return failed("causal-checkpoint", {
          severity: "backpressure",
          code: "causal-checkpoint-pending",
          detail: `The durable browser room has ${String(causalCheckpointPendingWrites)} causal correction checkpoint write(s) pending. Drain them before stopping.`,
        });
      }
      if (causalCheckpointSync.state === "failed" && causalCheckpointSync.feedback !== null) {
        return { ok: false, feedback: causalCheckpointSync.feedback };
      }
      if (causalHandoffCheckpointPendingWrites > 0) {
        return failed("causal-handoff-checkpoint", {
          severity: "backpressure",
          code: "causal-handoff-checkpoint-pending",
          detail: `The durable browser room has ${String(causalHandoffCheckpointPendingWrites)} causal handoff checkpoint write(s) pending. Drain them before stopping.`,
        });
      }
      if (causalHandoffCheckpointSync.state === "failed" && causalHandoffCheckpointSync.feedback !== null) {
        return { ok: false, feedback: causalHandoffCheckpointSync.feedback };
      }
      finalized = true;

      let stopped;
      try {
        stopped = browserRuntime.host.stop();
      } catch {
        const closed = closePort(checkpointPort);
        const failure = thrown("browser-runtime", "browser-runtime-operation-threw", "stopping");
        return {
          ...failure,
          feedback: {
            ...failure.feedback,
            cleanup: closed.ok ? [] : [`${closed.feedback.code}: ${closed.feedback.detail}`],
          },
        };
      }
      const closed = closePort(checkpointPort);
      if (!stopped.ok) {
        return failed(
          "browser-runtime",
          stopped.feedback,
          closed.ok ? [] : [`${closed.feedback.code}: ${closed.feedback.detail}`],
        );
      }
      return closed.ok ? succeeded(read()) : closed;
    },
  });
}

/** Open the native IndexedDB edge, then start the durable browser room. */
export async function startNativeDurableDarkHallBrowser(
  options: NativeDarkHallBrowserDurableOptions,
): Promise<DarkHallBrowserDurableResult<DarkHallBrowserDurableRuntime>> {
  const { databaseName, storeName, ...runtimeOptions } = options;
  let opened;
  try {
    opened = await openNativeIndexedDbCheckpointPort(options.root ?? globalThis, { databaseName, storeName });
  } catch {
    return thrown("checkpoint-store", "checkpoint-operation-threw", "opening IndexedDB");
  }
  return opened.ok
    ? startDurableDarkHallBrowser(runtimeOptions, opened.value)
    : failed("checkpoint-store", opened.feedback);
}
