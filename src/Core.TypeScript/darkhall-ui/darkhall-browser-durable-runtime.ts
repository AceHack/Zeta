import {
  BROWSER_CHECKPOINT_RECORD_SCHEMA,
  openNativeIndexedDbCheckpointPort,
  validateBrowserCheckpointRecord,
  type BrowserCheckpointFeedback,
  type BrowserCheckpointPort,
  type BrowserCheckpointRecord,
  type NativeIndexedDbCheckpointOptions,
} from "../browser-node/browser-indexeddb-checkpoint";
import {
  decodeBrowserRoomCheckpoint,
  encodeBrowserRoomCheckpoint,
  type BrowserRoomCheckpointFeedback,
  type DurableRoomRunTranscript,
} from "../browser-node/browser-room-checkpoint";
import type { BrowserLifecycleHostFeedback, BrowserLifecycleHostReadout } from "../browser-node/browser-lifecycle-host";
import type { BrowserCheckpoint } from "../browser-node/browser-node";
import type { BrowserCheckpointInvalidation } from "../browser-node/browser-tab-coordinator";
import {
  startNativeDarkHallBrowser,
  type DarkHallBrowserBootstrapFeedback,
  type DarkHallBrowserBootstrapOptions,
  type DarkHallBrowserBootstrapResult,
  type DarkHallBrowserRuntime,
} from "./darkhall-browser-bootstrap";
import type { RoomRunTranscript } from "./darkhall-room";

export const DARK_HALL_BROWSER_DURABLE_RUNTIME_SCHEMA = "zeta.darkhall.browser-durable-runtime.v1" as const;

type DurableRuntimeSource = "browser-runtime" | "checkpoint-store" | "room-checkpoint" | "room-render";
type UnderlyingFeedback =
  | BrowserCheckpointFeedback
  | BrowserRoomCheckpointFeedback
  | BrowserLifecycleHostFeedback
  | DarkHallBrowserBootstrapFeedback;

export interface DarkHallBrowserDurableFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | UnderlyingFeedback["code"]
    | "browser-runtime-operation-threw"
    | "checkpoint-operation-threw"
    | "room-render-failed";
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
  "checkpoint" | "onCheckpointInvalidated" | "transcript"
> {
  readonly initialTranscript: RoomRunTranscript;
}

export interface NativeDarkHallBrowserDurableOptions
  extends DarkHallBrowserDurableOptions, NativeIndexedDbCheckpointOptions {}

export type DarkHallBrowserStarter = (
  options: DarkHallBrowserBootstrapOptions,
) => DarkHallBrowserBootstrapResult<DarkHallBrowserRuntime>;

export interface DarkHallBrowserDurableReadout {
  readonly schema: typeof DARK_HALL_BROWSER_DURABLE_RUNTIME_SCHEMA;
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
}

export interface DarkHallBrowserDurableRuntime {
  read(): DarkHallBrowserDurableReadout;
  transcript(): DurableRoomRunTranscript;
  checkpoint(
    revision: number,
    transcript: RoomRunTranscript,
  ): Promise<DarkHallBrowserDurableResult<BrowserCheckpointRecord>>;
  retract(throughRevision: number): Promise<DarkHallBrowserDurableResult<boolean>>;
  drainCheckpointInvalidations(): Promise<DarkHallBrowserDurableResult<DarkHallBrowserDurableReadout>>;
  stop(): DarkHallBrowserDurableResult<DarkHallBrowserDurableReadout>;
}

function succeeded<T>(value: T): DarkHallBrowserDurableResult<T> {
  return { ok: true, value };
}

function failed(
  source: DurableRuntimeSource,
  feedback: Pick<UnderlyingFeedback, "severity" | "code" | "detail">,
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
): Promise<DarkHallBrowserDurableResult<BrowserCheckpointRecord | null>> {
  try {
    const loaded = await port.load(nodeId);
    if (!loaded.ok) return failed("checkpoint-store", loaded.feedback);
    return loaded.value === null ? succeeded(null) : verifyRecord(loaded.value, nodeId);
  } catch {
    return thrown("checkpoint-store", "checkpoint-operation-threw", "loading a room checkpoint");
  }
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
  onCheckpointInvalidated: (invalidation: BrowserCheckpointInvalidation) => void,
): DarkHallBrowserBootstrapOptions {
  return {
    root: options.root,
    mount: options.mount,
    channelName: options.channelName,
    nodeId: options.nodeId,
    tabId: options.tabId,
    initialSequence: options.initialSequence,
    maxTrackedTabs: options.maxTrackedTabs,
    maxFeedback: options.maxFeedback,
    capabilities: options.capabilities,
    checkpoint,
    transcript,
    onCheckpointInvalidated,
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

  const recovered = await loadCheckpoint(checkpointPort, options.nodeId);
  if (!recovered.ok) return closeAfterFailure(checkpointPort, recovered);

  const selectedTranscript = transcriptForCheckpoint(recovered.value, initial.value);
  if (!selectedTranscript.ok) return closeAfterFailure(checkpointPort, selectedTranscript);

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
        onCheckpointInvalidated,
      ),
    );
  } catch {
    return closeAfterFailure(checkpointPort, thrown("browser-runtime", "browser-runtime-operation-threw", "starting"));
  }
  if (!started.ok) {
    return closeAfterFailure(checkpointPort, failed("browser-runtime", started.feedback, started.feedback.cleanup));
  }

  const browserRuntime = started.value;
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
  let checkpointSyncTail: Promise<DarkHallBrowserDurableResult<null>> = Promise.resolve(succeeded(null));

  const read = (): DarkHallBrowserDurableReadout => ({
    schema: DARK_HALL_BROWSER_DURABLE_RUNTIME_SCHEMA,
    host: browserRuntime.host.read(),
    recoveredRevision,
    currentRevision: currentRecord?.revision ?? null,
    payloadBytes: currentRecord?.payload.byteLength ?? null,
    checkpointSync,
    room: roomSummary(currentTranscript),
  });

  const updateRenderedTranscript = (nextTranscript: DurableRoomRunTranscript): DarkHallBrowserDurableResult<null> => {
    try {
      const rendered = browserRuntime.updateTranscript(nextTranscript);
      return rendered.ok
        ? succeeded(null)
        : {
            ok: false,
            feedback: {
              severity: "heat",
              code: "room-render-failed",
              source: "room-render",
              detail: rendered.detail,
              cleanup: [],
            },
          };
    } catch {
      return thrown("browser-runtime", "browser-runtime-operation-threw", "rendering a room transcript");
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
    const loaded = await loadCheckpoint(checkpointPort, options.nodeId);
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
    read,
    transcript: () => currentTranscript,
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
          nodeId: options.nodeId,
          revision,
          payload: encoded.value,
        });
      } catch {
        return thrown("checkpoint-store", "checkpoint-operation-threw", "saving a room checkpoint");
      }
      if (!saved.ok) return failed("checkpoint-store", saved.feedback);
      const verified = verifyRecord(saved.value, options.nodeId, revision, encoded.value);
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
        removed = await checkpointPort.remove(options.nodeId, throughRevision);
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
    stop: () => {
      if (finalized) return succeeded(read());
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
