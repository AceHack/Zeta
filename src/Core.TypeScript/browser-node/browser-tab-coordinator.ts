import {
  BROWSER_NODE_SCHEMA,
  foldBrowserTabPresence,
  planBrowserNode,
  type BrowserCheckpoint,
  type BrowserLivenessReadout,
  type BrowserNodeCapability,
  type BrowserNodeFeedback,
  type BrowserTabPresence,
  type BrowserTabState,
} from "./browser-node";

export const BROWSER_TAB_COORDINATOR_SCHEMA = "zeta.browser-tab-coordinator.v7" as const;

export interface BrowserTabPresenceMessage {
  readonly schema: typeof BROWSER_TAB_COORDINATOR_SCHEMA;
  readonly nodeId: string;
  readonly kind: "presence";
  readonly presence: BrowserTabPresence;
}

export interface BrowserTabProbeMessage {
  readonly schema: typeof BROWSER_TAB_COORDINATOR_SCHEMA;
  readonly nodeId: string;
  readonly kind: "probe";
  readonly requesterTabId: string;
  readonly sequence: number;
}

export type BrowserCheckpointInvalidationOperation = "saved" | "removed";

export interface BrowserCheckpointInvalidation {
  readonly sourceTabId: string;
  readonly operation: BrowserCheckpointInvalidationOperation;
  readonly revision: number;
}

export interface BrowserCheckpointInvalidationMessage {
  readonly schema: typeof BROWSER_TAB_COORDINATOR_SCHEMA;
  readonly nodeId: string;
  readonly kind: "checkpoint-invalidated";
  readonly invalidation: BrowserCheckpointInvalidation;
}

export interface BrowserDatabaseInvalidation {
  readonly sourceTabId: string;
  readonly databaseNodeId: string;
  readonly revision: number;
}

export interface BrowserDatabaseInvalidationMessage {
  readonly schema: typeof BROWSER_TAB_COORDINATOR_SCHEMA;
  readonly nodeId: string;
  readonly kind: "database-invalidated";
  readonly invalidation: BrowserDatabaseInvalidation;
}

export interface BrowserDatabaseExecutionReceiptNotice {
  readonly sourceTabId: string;
  readonly databaseNodeId: string;
  readonly intentId: string;
  readonly sequence: number;
  readonly status: "settled";
  readonly revision: number;
  readonly accepted: number;
  readonly duplicates: number;
}

export interface BrowserDatabaseExecutionReceiptMessage {
  readonly schema: typeof BROWSER_TAB_COORDINATOR_SCHEMA;
  readonly nodeId: string;
  readonly kind: "database-execution-receipt";
  readonly receipt: BrowserDatabaseExecutionReceiptNotice;
}

export interface BrowserCausalCorrectionNotice {
  readonly sourceTabId: string;
  readonly sequence: string;
  readonly reinterpretsThrough: string;
  readonly deltaRows: number;
}

export interface BrowserCausalCorrectionMessage {
  readonly schema: typeof BROWSER_TAB_COORDINATOR_SCHEMA;
  readonly nodeId: string;
  readonly kind: "causal-correction";
  readonly correction: BrowserCausalCorrectionNotice;
}

export interface BrowserCausalCorrectionReplayNotice {
  readonly handoffId: string;
  readonly sourceTabId: string;
  readonly targetTabId: string;
  readonly maxCorrections: number;
  readonly corrections: readonly BrowserCausalCorrectionNotice[];
}

export interface BrowserCausalCorrectionReplayMessage {
  readonly schema: typeof BROWSER_TAB_COORDINATOR_SCHEMA;
  readonly nodeId: string;
  readonly kind: "causal-correction-replay";
  readonly replay: BrowserCausalCorrectionReplayNotice;
}

export interface BrowserCausalCorrectionReplayFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code: string;
  readonly detail: string;
}

export type BrowserCausalCorrectionReplayDisposition = "admitted" | "duplicate" | "backpressured" | "heat";

export interface BrowserCausalCorrectionReplayAdmission {
  readonly disposition: BrowserCausalCorrectionReplayDisposition;
  readonly admittedCorrections: number;
  readonly feedback: BrowserCausalCorrectionReplayFeedback | null;
}

export interface BrowserCausalCorrectionReplayAcknowledgement extends BrowserCausalCorrectionReplayAdmission {
  readonly handoffId: string;
  readonly sourceTabId: string;
  readonly targetTabId: string;
  readonly correctionCount: number;
}

export interface BrowserCausalCorrectionReplayAcknowledgementMessage {
  readonly schema: typeof BROWSER_TAB_COORDINATOR_SCHEMA;
  readonly nodeId: string;
  readonly kind: "causal-correction-replay-acknowledged";
  readonly acknowledgement: BrowserCausalCorrectionReplayAcknowledgement;
}

export interface BrowserCausalCorrectionReplayOffer {
  readonly handoffId: string;
  readonly corrections: readonly BrowserCausalCorrectionNotice[];
}

export type BrowserTabChannelMessage =
  | BrowserTabPresenceMessage
  | BrowserTabProbeMessage
  | BrowserCheckpointInvalidationMessage
  | BrowserDatabaseInvalidationMessage
  | BrowserDatabaseExecutionReceiptMessage
  | BrowserCausalCorrectionMessage
  | BrowserCausalCorrectionReplayMessage
  | BrowserCausalCorrectionReplayAcknowledgementMessage;

export interface BrowserCausalCorrectionReplayPort {
  readonly maxCorrections: number;
  snapshot(targetTabId: string): BrowserCausalCorrectionReplayOffer;
  receive(replay: BrowserCausalCorrectionReplayNotice): BrowserCausalCorrectionReplayAdmission;
  acknowledge(acknowledgement: BrowserCausalCorrectionReplayAcknowledgement): void;
}

export interface BrowserTabCoordinatorFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "broadcast-channel-unavailable"
    | "broadcast-channel-blocked"
    | "broadcast-channel-invalid"
    | "broadcast-channel-closed"
    | "broadcast-channel-publish-failed"
    | "broadcast-channel-subscribe-failed"
    | "broadcast-channel-unsubscribe-failed"
    | "broadcast-channel-close-failed"
    | "service-worker-unavailable"
    | "service-worker-blocked"
    | "service-worker-invalid"
    | "service-worker-controller-missing"
    | "service-worker-channel-closed"
    | "service-worker-publish-failed"
    | "service-worker-subscribe-failed"
    | "service-worker-unsubscribe-failed"
    | "service-worker-relay-source-missing"
    | "service-worker-relay-clients-failed"
    | "service-worker-relay-capacity-exhausted"
    | "service-worker-relay-client-post-failed"
    | "tab-message-invalid"
    | "tab-capacity-exhausted"
    | "tab-id-collision"
    | "tab-sequence-stale"
    | "readout-observer-failed"
    | "checkpoint-invalidation-observer-failed"
    | "database-invalidation-observer-failed"
    | "database-receipt-observer-failed"
    | "causal-correction-observer-failed"
    | "causal-correction-replay-provider-failed"
    | "causal-correction-replay-observer-failed"
    | "causal-correction-replay-admission-invalid"
    | "causal-correction-replay-acknowledgement-observer-failed"
    | "causal-correction-replay-unavailable"
    | "causal-correction-replay-capacity-exhausted"
    | "coordinator-configuration-invalid"
    | "coordinator-stopped";
  readonly detail: string;
}

export type BrowserTabOperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserTabCoordinatorFeedback };

export interface BrowserTabChannelSubscription {
  unsubscribe(): BrowserTabOperationResult<null>;
}

/** Injected message edge. Implementations return typed feedback and do not throw. */
export interface BrowserTabChannel {
  publish(message: BrowserTabChannelMessage): BrowserTabOperationResult<null>;
  subscribe(listener: (message: unknown) => void): BrowserTabOperationResult<BrowserTabChannelSubscription>;
  close(): BrowserTabOperationResult<null>;
}

export interface BrowserTabCoordinatorOptions {
  readonly nodeId: string;
  readonly tabId: string;
  readonly initialSequence: number;
  readonly initialState: BrowserTabState;
  readonly maxTrackedTabs: number;
  readonly capabilities: readonly BrowserNodeCapability[];
  readonly checkpoint: BrowserCheckpoint;
  readonly onReadout?: (readout: BrowserTabCoordinatorReadout) => void;
  readonly onCheckpointInvalidated?: (invalidation: BrowserCheckpointInvalidation) => void;
  readonly onDatabaseInvalidated?: (invalidation: BrowserDatabaseInvalidation) => void;
  readonly onDatabaseExecutionReceipt?: (receipt: BrowserDatabaseExecutionReceiptNotice) => void;
  readonly onCausalCorrection?: (correction: BrowserCausalCorrectionNotice) => void;
  readonly causalCorrectionReplay?: BrowserCausalCorrectionReplayPort;
}

export interface BrowserTabCoordinatorReadout {
  readonly schema: typeof BROWSER_TAB_COORDINATOR_SCHEMA;
  readonly nodeSchema: typeof BROWSER_NODE_SCHEMA;
  readonly nodeId: string;
  readonly localTabId: string;
  readonly tabs: readonly BrowserTabPresence[];
  readonly liveness: BrowserLivenessReadout;
  readonly feedback: readonly (BrowserNodeFeedback | BrowserTabCoordinatorFeedback)[];
}

export interface BrowserTabCoordinator {
  read(): BrowserTabCoordinatorReadout;
  announce(sequence: number, state: BrowserTabState): BrowserTabOperationResult<BrowserTabCoordinatorReadout>;
  probe(sequence: number): BrowserTabOperationResult<BrowserTabCoordinatorReadout>;
  /** Refresh this tab's projection after the checkpoint adapter commits. */
  updateCheckpoint(checkpoint: BrowserCheckpoint): BrowserTabOperationResult<BrowserTabCoordinatorReadout>;
  /** Notify peers that storage changed; receivers must reread their own checkpoint port. */
  publishCheckpointInvalidation(
    operation: BrowserCheckpointInvalidationOperation,
    revision: number,
  ): BrowserTabOperationResult<BrowserTabCoordinatorReadout>;
  /** Notify peers that a database image changed; receivers perform their own finite wake. */
  publishDatabaseInvalidation(
    databaseNodeId: string,
    revision: number,
  ): BrowserTabOperationResult<BrowserTabCoordinatorReadout>;
  /** Broadcast compact execution evidence; database rows remain in the database port. */
  publishDatabaseExecutionReceipt(
    receipt: Omit<BrowserDatabaseExecutionReceiptNotice, "sourceTabId">,
  ): BrowserTabOperationResult<BrowserTabCoordinatorReadout>;
  /** Broadcast one later correction; retained history remains local and immutable. */
  publishCausalCorrection(
    correction: Omit<BrowserCausalCorrectionNotice, "sourceTabId">,
  ): BrowserTabOperationResult<BrowserTabCoordinatorReadout>;
  stop(sequence: number): BrowserTabOperationResult<BrowserTabCoordinatorReadout>;
}

const TAB_STATES: ReadonlySet<string> = new Set(["foreground", "background", "suspended", "dark"]);
const CHECKPOINTS: ReadonlySet<string> = new Set(["none", "volatile", "durable"]);
const CHECKPOINT_OPERATIONS: ReadonlySet<string> = new Set(["saved", "removed"]);

function succeeded<T>(value: T): BrowserTabOperationResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserTabCoordinatorFeedback["code"],
  detail: string,
  severity: BrowserTabCoordinatorFeedback["severity"] = "heat",
): BrowserTabOperationResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isHandoffId(value: unknown): value is string {
  return isBoundedText(value, 2048);
}

function isSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function decimalSequence(value: unknown): bigint | null {
  if (typeof value !== "string" || value.length > 128 || !/^(0|[1-9]\d*)$/.test(value)) return null;
  return BigInt(value);
}

function isCausalCorrection(value: unknown): value is BrowserCausalCorrectionNotice {
  if (!isRecord(value) || !isIdentifier(value.sourceTabId)) return false;
  const sequence = decimalSequence(value.sequence);
  const reinterpretsThrough = decimalSequence(value.reinterpretsThrough);
  return (
    sequence !== null && reinterpretsThrough !== null && sequence > reinterpretsThrough && isSequence(value.deltaRows)
  );
}

function isCausalCorrectionReplay(value: unknown): value is BrowserCausalCorrectionReplayNotice {
  return (
    isRecord(value) &&
    isHandoffId(value.handoffId) &&
    isIdentifier(value.sourceTabId) &&
    isIdentifier(value.targetTabId) &&
    value.sourceTabId !== value.targetTabId &&
    isSequence(value.maxCorrections) &&
    value.maxCorrections > 0 &&
    Array.isArray(value.corrections) &&
    value.corrections.length <= value.maxCorrections &&
    value.corrections.every(isCausalCorrection)
  );
}

function isCausalCorrectionReplayFeedback(value: unknown): value is BrowserCausalCorrectionReplayFeedback {
  return (
    isRecord(value) &&
    (value.severity === "backpressure" || value.severity === "heat") &&
    isBoundedText(value.code, 256) &&
    isBoundedText(value.detail, 4096)
  );
}

function isCausalCorrectionReplayAdmission(
  value: unknown,
  correctionCount: number,
): value is BrowserCausalCorrectionReplayAdmission {
  if (
    !isRecord(value) ||
    (value.disposition !== "admitted" &&
      value.disposition !== "duplicate" &&
      value.disposition !== "backpressured" &&
      value.disposition !== "heat") ||
    !isSequence(value.admittedCorrections) ||
    value.admittedCorrections > correctionCount
  ) {
    return false;
  }
  if (value.disposition === "admitted") {
    return value.admittedCorrections > 0 && value.feedback === null;
  }
  if (value.disposition === "duplicate") {
    return value.admittedCorrections === 0 && value.feedback === null;
  }
  return (
    value.admittedCorrections === 0 &&
    isCausalCorrectionReplayFeedback(value.feedback) &&
    value.feedback.severity === (value.disposition === "backpressured" ? "backpressure" : "heat")
  );
}

function isCausalCorrectionReplayAcknowledgement(
  value: unknown,
): value is BrowserCausalCorrectionReplayAcknowledgement {
  return (
    isRecord(value) &&
    isHandoffId(value.handoffId) &&
    isIdentifier(value.sourceTabId) &&
    isIdentifier(value.targetTabId) &&
    value.sourceTabId !== value.targetTabId &&
    isSequence(value.correctionCount) &&
    value.correctionCount > 0 &&
    isCausalCorrectionReplayAdmission(value, value.correctionCount)
  );
}

export function decodeBrowserTabChannelMessage(value: unknown): BrowserTabOperationResult<BrowserTabChannelMessage> {
  if (
    !isRecord(value) ||
    value.schema !== BROWSER_TAB_COORDINATOR_SCHEMA ||
    !isIdentifier(value.nodeId) ||
    (value.kind !== "presence" &&
      value.kind !== "probe" &&
      value.kind !== "checkpoint-invalidated" &&
      value.kind !== "database-invalidated" &&
      value.kind !== "database-execution-receipt" &&
      value.kind !== "causal-correction" &&
      value.kind !== "causal-correction-replay" &&
      value.kind !== "causal-correction-replay-acknowledged")
  ) {
    return failed("tab-message-invalid", "A browser tab channel message did not match the coordinator schema.");
  }

  if (value.kind === "probe") {
    if (!isIdentifier(value.requesterTabId) || !isSequence(value.sequence)) {
      return failed("tab-message-invalid", "A browser tab probe carried an invalid requester or sequence.");
    }
    return succeeded({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: value.nodeId,
      kind: "probe",
      requesterTabId: value.requesterTabId,
      sequence: value.sequence,
    });
  }

  if (value.kind === "checkpoint-invalidated") {
    const invalidation = value.invalidation;
    if (
      !isRecord(invalidation) ||
      !isIdentifier(invalidation.sourceTabId) ||
      typeof invalidation.operation !== "string" ||
      !CHECKPOINT_OPERATIONS.has(invalidation.operation) ||
      !isSequence(invalidation.revision)
    ) {
      return failed("tab-message-invalid", "A checkpoint invalidation carried invalid source or revision evidence.");
    }
    return succeeded({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: value.nodeId,
      kind: "checkpoint-invalidated",
      invalidation: {
        sourceTabId: invalidation.sourceTabId,
        operation: invalidation.operation as BrowserCheckpointInvalidationOperation,
        revision: invalidation.revision,
      },
    });
  }

  if (value.kind === "database-invalidated") {
    const invalidation = value.invalidation;
    if (
      !isRecord(invalidation) ||
      !isIdentifier(invalidation.sourceTabId) ||
      !isIdentifier(invalidation.databaseNodeId) ||
      !isSequence(invalidation.revision)
    ) {
      return failed("tab-message-invalid", "A database invalidation carried invalid source or revision evidence.");
    }
    return succeeded({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: value.nodeId,
      kind: "database-invalidated",
      invalidation: {
        sourceTabId: invalidation.sourceTabId,
        databaseNodeId: invalidation.databaseNodeId,
        revision: invalidation.revision,
      },
    });
  }

  if (value.kind === "database-execution-receipt") {
    const receipt = value.receipt;
    if (
      !isRecord(receipt) ||
      !isIdentifier(receipt.sourceTabId) ||
      !isIdentifier(receipt.databaseNodeId) ||
      !isIdentifier(receipt.intentId) ||
      !isSequence(receipt.sequence) ||
      receipt.status !== "settled" ||
      !isSequence(receipt.revision) ||
      !isSequence(receipt.accepted) ||
      !isSequence(receipt.duplicates)
    ) {
      return failed("tab-message-invalid", "A database execution receipt carried invalid finite evidence.");
    }
    return succeeded({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: value.nodeId,
      kind: "database-execution-receipt",
      receipt: {
        sourceTabId: receipt.sourceTabId,
        databaseNodeId: receipt.databaseNodeId,
        intentId: receipt.intentId,
        sequence: receipt.sequence,
        status: "settled",
        revision: receipt.revision,
        accepted: receipt.accepted,
        duplicates: receipt.duplicates,
      },
    });
  }

  if (value.kind === "causal-correction") {
    if (!isCausalCorrection(value.correction)) {
      return failed("tab-message-invalid", "A causal correction carried invalid forward-order evidence.");
    }
    return succeeded({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: value.nodeId,
      kind: "causal-correction",
      correction: { ...value.correction },
    });
  }

  if (value.kind === "causal-correction-replay") {
    if (!isCausalCorrectionReplay(value.replay)) {
      return failed(
        "tab-message-invalid",
        "A causal correction replay exceeded its bound or carried invalid evidence.",
      );
    }
    return succeeded({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: value.nodeId,
      kind: "causal-correction-replay",
      replay: {
        handoffId: value.replay.handoffId,
        sourceTabId: value.replay.sourceTabId,
        targetTabId: value.replay.targetTabId,
        maxCorrections: value.replay.maxCorrections,
        corrections: value.replay.corrections.map((correction) => ({ ...correction })),
      },
    });
  }

  if (value.kind === "causal-correction-replay-acknowledged") {
    if (!isCausalCorrectionReplayAcknowledgement(value.acknowledgement)) {
      return failed("tab-message-invalid", "A causal correction replay acknowledgement carried invalid evidence.");
    }
    return succeeded({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: value.nodeId,
      kind: "causal-correction-replay-acknowledged",
      acknowledgement: {
        ...value.acknowledgement,
        feedback: value.acknowledgement.feedback === null ? null : { ...value.acknowledgement.feedback },
      },
    });
  }

  const presence = value.presence;
  if (
    !isRecord(presence) ||
    !isIdentifier(presence.tabId) ||
    !isSequence(presence.sequence) ||
    typeof presence.state !== "string" ||
    !TAB_STATES.has(presence.state)
  ) {
    return failed("tab-message-invalid", "A browser tab presence message carried an invalid tab state.");
  }

  return succeeded({
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeId: value.nodeId,
    kind: "presence",
    presence: {
      tabId: presence.tabId,
      sequence: presence.sequence,
      state: presence.state as BrowserTabState,
    },
  });
}

function presenceMessage(nodeId: string, presence: BrowserTabPresence): BrowserTabPresenceMessage {
  return { schema: BROWSER_TAB_COORDINATOR_SCHEMA, nodeId, kind: "presence", presence };
}

function probeMessage(nodeId: string, requesterTabId: string, sequence: number): BrowserTabProbeMessage {
  return {
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeId,
    kind: "probe",
    requesterTabId,
    sequence,
  };
}

function checkpointInvalidationMessage(
  nodeId: string,
  sourceTabId: string,
  operation: BrowserCheckpointInvalidationOperation,
  revision: number,
): BrowserCheckpointInvalidationMessage {
  return {
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeId,
    kind: "checkpoint-invalidated",
    invalidation: { sourceTabId, operation, revision },
  };
}

function databaseInvalidationMessage(
  nodeId: string,
  sourceTabId: string,
  databaseNodeId: string,
  revision: number,
): BrowserDatabaseInvalidationMessage {
  return {
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeId,
    kind: "database-invalidated",
    invalidation: { sourceTabId, databaseNodeId, revision },
  };
}

function databaseExecutionReceiptMessage(
  nodeId: string,
  sourceTabId: string,
  receipt: Omit<BrowserDatabaseExecutionReceiptNotice, "sourceTabId">,
): BrowserDatabaseExecutionReceiptMessage {
  return {
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeId,
    kind: "database-execution-receipt",
    receipt: { ...receipt, sourceTabId },
  };
}

function causalCorrectionMessage(
  nodeId: string,
  sourceTabId: string,
  correction: Omit<BrowserCausalCorrectionNotice, "sourceTabId">,
): BrowserCausalCorrectionMessage {
  return {
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeId,
    kind: "causal-correction",
    correction: { ...correction, sourceTabId },
  };
}

function causalCorrectionReplayMessage(
  nodeId: string,
  handoffId: string,
  sourceTabId: string,
  targetTabId: string,
  maxCorrections: number,
  corrections: readonly BrowserCausalCorrectionNotice[],
): BrowserCausalCorrectionReplayMessage {
  return {
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeId,
    kind: "causal-correction-replay",
    replay: {
      handoffId,
      sourceTabId,
      targetTabId,
      maxCorrections,
      corrections: corrections.map((correction) => ({ ...correction })),
    },
  };
}

function causalCorrectionReplayAcknowledgementMessage(
  nodeId: string,
  acknowledgement: BrowserCausalCorrectionReplayAcknowledgement,
): BrowserCausalCorrectionReplayAcknowledgementMessage {
  return {
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeId,
    kind: "causal-correction-replay-acknowledged",
    acknowledgement: {
      ...acknowledgement,
      feedback: acknowledgement.feedback === null ? null : { ...acknowledgement.feedback },
    },
  };
}

function validateOptions(options: BrowserTabCoordinatorOptions): BrowserTabOperationResult<null> {
  if (!isIdentifier(options.nodeId) || !isIdentifier(options.tabId)) {
    return failed("coordinator-configuration-invalid", "Node and tab identifiers must be non-empty strings.");
  }
  if (!isSequence(options.initialSequence)) {
    return failed("coordinator-configuration-invalid", "The initial tab sequence must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(options.maxTrackedTabs) || options.maxTrackedTabs < 1) {
    return failed("coordinator-configuration-invalid", "The tracked-tab capacity must be a positive safe integer.");
  }
  if (!CHECKPOINTS.has(options.checkpoint)) {
    return failed("coordinator-configuration-invalid", "The initial checkpoint state is invalid.");
  }
  if (
    options.causalCorrectionReplay !== undefined &&
    (!Number.isSafeInteger(options.causalCorrectionReplay.maxCorrections) ||
      options.causalCorrectionReplay.maxCorrections < 1)
  ) {
    return failed(
      "coordinator-configuration-invalid",
      "A causal correction replay port requires a positive safe correction capacity.",
    );
  }
  return succeeded(null);
}

/**
 * Start a bounded, deterministic tab coordinator over an injected channel.
 * Sequence numbers are supplied by the caller; this layer reads no clock and
 * schedules no timer. New tabs receive current peers through a one-shot probe.
 */
export function startBrowserTabCoordinator(
  options: BrowserTabCoordinatorOptions,
  channel: BrowserTabChannel,
): BrowserTabOperationResult<BrowserTabCoordinator> {
  const optionsResult = validateOptions(options);
  if (!optionsResult.ok) return optionsResult;

  const initialPresence: BrowserTabPresence = {
    tabId: options.tabId,
    sequence: options.initialSequence,
    state: options.initialState,
  };
  let tabs: readonly BrowserTabPresence[] = [initialPresence];
  let localPresence = initialPresence;
  let checkpoint = options.checkpoint;
  let stopped = false;
  let observerFailure: BrowserTabCoordinatorFeedback | null = null;
  let checkpointObserverFailure: BrowserTabCoordinatorFeedback | null = null;
  let databaseObserverFailure: BrowserTabCoordinatorFeedback | null = null;
  let databaseReceiptObserverFailure: BrowserTabCoordinatorFeedback | null = null;
  let causalCorrectionObserverFailure: BrowserTabCoordinatorFeedback | null = null;
  let causalCorrectionReplayObserverFailure: BrowserTabCoordinatorFeedback | null = null;
  let causalCorrectionReplayAcknowledgementObserverFailure: BrowserTabCoordinatorFeedback | null = null;

  const project = (eventFeedback: readonly BrowserTabCoordinatorFeedback[] = []): BrowserTabCoordinatorReadout => {
    const node = planBrowserNode({
      capabilities: options.capabilities,
      tabs,
      checkpoint,
      bindings: [],
      requests: [],
    });
    return {
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeSchema: node.schema,
      nodeId: options.nodeId,
      localTabId: options.tabId,
      tabs,
      liveness: node.liveness,
      feedback: [
        ...node.feedback,
        ...(observerFailure === null ? [] : [observerFailure]),
        ...(checkpointObserverFailure === null ? [] : [checkpointObserverFailure]),
        ...(databaseObserverFailure === null ? [] : [databaseObserverFailure]),
        ...(databaseReceiptObserverFailure === null ? [] : [databaseReceiptObserverFailure]),
        ...(causalCorrectionObserverFailure === null ? [] : [causalCorrectionObserverFailure]),
        ...(causalCorrectionReplayObserverFailure === null ? [] : [causalCorrectionReplayObserverFailure]),
        ...(causalCorrectionReplayAcknowledgementObserverFailure === null
          ? []
          : [causalCorrectionReplayAcknowledgementObserverFailure]),
        ...eventFeedback,
      ],
    };
  };

  const notify = (readout: BrowserTabCoordinatorReadout): void => {
    if (options.onReadout === undefined) return;
    try {
      options.onReadout(readout);
    } catch {
      observerFailure = {
        severity: "heat",
        code: "readout-observer-failed",
        detail: "The injected readout observer threw; coordinator state and channel delivery continued.",
      };
    }
  };

  const applyPresence = (presence: BrowserTabPresence): BrowserTabOperationResult<BrowserTabCoordinatorReadout> => {
    const known = tabs.some((tab) => tab.tabId === presence.tabId);
    if (!known && tabs.length >= options.maxTrackedTabs) {
      return failed(
        "tab-capacity-exhausted",
        `The coordinator retained ${String(tabs.length)} tabs and will not discard one to admit ${presence.tabId}.`,
        "backpressure",
      );
    }
    tabs = foldBrowserTabPresence([...tabs, presence]);
    return succeeded(project());
  };

  const publish = (message: BrowserTabChannelMessage): BrowserTabOperationResult<null> => {
    try {
      return channel.publish(message);
    } catch {
      return failed("broadcast-channel-publish-failed", "The injected browser tab channel threw while publishing.");
    }
  };

  const respondToProbe = (message: BrowserTabProbeMessage): void => {
    if (message.requesterTabId === options.tabId || stopped) return;
    const response = publish(presenceMessage(options.nodeId, localPresence));
    if (!response.ok) notify(project([response.feedback]));
    const replayPort = options.causalCorrectionReplay;
    if (replayPort === undefined) return;

    let snapshot: unknown;
    try {
      snapshot = replayPort.snapshot(message.requesterTabId);
    } catch {
      notify(
        project([
          {
            severity: "heat",
            code: "causal-correction-replay-provider-failed",
            detail: "The injected causal correction replay provider threw while reading its bounded snapshot.",
          },
        ]),
      );
      return;
    }
    if (!isRecord(snapshot) || !isHandoffId(snapshot.handoffId) || !Array.isArray(snapshot.corrections)) {
      notify(
        project([
          {
            severity: "heat",
            code: "causal-correction-replay-provider-failed",
            detail: "The replay provider did not return an identified finite correction offer.",
          },
        ]),
      );
      return;
    }
    const corrections: readonly unknown[] = snapshot.corrections;
    if (corrections.length > replayPort.maxCorrections) {
      notify(
        project([
          {
            severity: "backpressure",
            code: "causal-correction-replay-capacity-exhausted",
            detail: `The replay provider returned ${String(corrections.length)} corrections for capacity ${String(replayPort.maxCorrections)}.`,
          },
        ]),
      );
      return;
    }
    if (!corrections.every(isCausalCorrection)) {
      notify(
        project([
          {
            severity: "heat",
            code: "causal-correction-replay-provider-failed",
            detail: "The replay provider returned invalid causal correction evidence.",
          },
        ]),
      );
      return;
    }
    if (corrections.length === 0) return;
    const replayed = publish(
      causalCorrectionReplayMessage(
        options.nodeId,
        snapshot.handoffId,
        options.tabId,
        message.requesterTabId,
        replayPort.maxCorrections,
        corrections as readonly BrowserCausalCorrectionNotice[],
      ),
    );
    if (!replayed.ok) notify(project([replayed.feedback]));
  };

  const acknowledgeReplay = (
    replay: BrowserCausalCorrectionReplayNotice,
    admission: BrowserCausalCorrectionReplayAdmission,
  ): void => {
    const published = publish(
      causalCorrectionReplayAcknowledgementMessage(options.nodeId, {
        ...admission,
        handoffId: replay.handoffId,
        sourceTabId: options.tabId,
        targetTabId: replay.sourceTabId,
        correctionCount: replay.corrections.length,
      }),
    );
    if (!published.ok) notify(project([published.feedback]));
  };

  const receive = (value: unknown): void => {
    const decoded = decodeBrowserTabChannelMessage(value);
    if (!decoded.ok) {
      notify(project([decoded.feedback]));
      return;
    }
    const message = decoded.value;
    if (message.nodeId !== options.nodeId) return;

    if (message.kind === "probe") {
      respondToProbe(message);
      return;
    }

    if (message.kind === "checkpoint-invalidated") {
      if (message.invalidation.sourceTabId === options.tabId) {
        const collision = failed(
          "tab-id-collision",
          `Another channel participant published checkpoint evidence for locally owned tab ${options.tabId}.`,
        );
        if (!collision.ok) notify(project([collision.feedback]));
        return;
      }
      if (options.onCheckpointInvalidated === undefined) return;
      try {
        options.onCheckpointInvalidated(message.invalidation);
      } catch {
        checkpointObserverFailure = {
          severity: "heat",
          code: "checkpoint-invalidation-observer-failed",
          detail: "The injected checkpoint invalidation observer threw; channel delivery continued.",
        };
        notify(project());
      }
      return;
    }

    if (message.kind === "database-invalidated") {
      if (message.invalidation.sourceTabId === options.tabId) {
        const collision = failed(
          "tab-id-collision",
          `Another channel participant published database evidence for locally owned tab ${options.tabId}.`,
        );
        if (!collision.ok) notify(project([collision.feedback]));
        return;
      }
      if (options.onDatabaseInvalidated === undefined) return;
      try {
        options.onDatabaseInvalidated(message.invalidation);
      } catch {
        databaseObserverFailure = {
          severity: "heat",
          code: "database-invalidation-observer-failed",
          detail: "The injected database invalidation observer threw; channel delivery continued.",
        };
        notify(project());
      }
      return;
    }

    if (message.kind === "database-execution-receipt") {
      if (message.receipt.sourceTabId === options.tabId) {
        const collision = failed(
          "tab-id-collision",
          `Another channel participant published database receipt evidence for locally owned tab ${options.tabId}.`,
        );
        if (!collision.ok) notify(project([collision.feedback]));
        return;
      }
      if (options.onDatabaseExecutionReceipt === undefined) return;
      try {
        options.onDatabaseExecutionReceipt(message.receipt);
      } catch {
        databaseReceiptObserverFailure = {
          severity: "heat",
          code: "database-receipt-observer-failed",
          detail: "The injected database receipt observer threw; channel delivery continued.",
        };
        notify(project());
      }
      return;
    }

    if (message.kind === "causal-correction") {
      if (message.correction.sourceTabId === options.tabId) {
        const collision = failed(
          "tab-id-collision",
          `Another channel participant published causal correction evidence for locally owned tab ${options.tabId}.`,
        );
        if (!collision.ok) notify(project([collision.feedback]));
        return;
      }
      if (options.onCausalCorrection === undefined) return;
      try {
        options.onCausalCorrection(message.correction);
      } catch {
        causalCorrectionObserverFailure = {
          severity: "heat",
          code: "causal-correction-observer-failed",
          detail: "The injected causal correction observer threw; channel delivery continued.",
        };
        notify(project());
      }
      return;
    }

    if (message.kind === "causal-correction-replay") {
      if (message.replay.targetTabId !== options.tabId) return;
      if (message.replay.sourceTabId === options.tabId) {
        const collision = failed(
          "tab-id-collision",
          `Another channel participant published causal replay evidence for locally owned tab ${options.tabId}.`,
        );
        if (!collision.ok) notify(project([collision.feedback]));
        return;
      }
      const replayPort = options.causalCorrectionReplay;
      if (replayPort === undefined) {
        const feedback: BrowserTabCoordinatorFeedback = {
          severity: "backpressure",
          code: "causal-correction-replay-unavailable",
          detail: `Tab ${options.tabId} has no causal correction replay port.`,
        };
        const unavailable: BrowserCausalCorrectionReplayAdmission = {
          disposition: "backpressured",
          admittedCorrections: 0,
          feedback,
        };
        acknowledgeReplay(message.replay, unavailable);
        notify(project([feedback]));
        return;
      }
      if (message.replay.corrections.length > replayPort.maxCorrections) {
        const feedback: BrowserTabCoordinatorFeedback = {
          severity: "backpressure",
          code: "causal-correction-replay-capacity-exhausted",
          detail: `Peer ${message.replay.sourceTabId} offered ${String(message.replay.corrections.length)} corrections for local capacity ${String(replayPort.maxCorrections)}.`,
        };
        acknowledgeReplay(message.replay, {
          disposition: "backpressured",
          admittedCorrections: 0,
          feedback,
        });
        notify(project([feedback]));
        return;
      }
      let admission: unknown;
      try {
        admission = replayPort.receive({
          ...message.replay,
          corrections: message.replay.corrections.map((correction) => ({ ...correction })),
        });
      } catch {
        causalCorrectionReplayObserverFailure = {
          severity: "heat",
          code: "causal-correction-replay-observer-failed",
          detail: "The injected causal correction replay observer threw; channel delivery continued.",
        };
        notify(project());
        return;
      }
      if (!isCausalCorrectionReplayAdmission(admission, message.replay.corrections.length)) {
        causalCorrectionReplayObserverFailure = {
          severity: "heat",
          code: "causal-correction-replay-admission-invalid",
          detail: "The injected causal correction replay observer returned an invalid finite admission outcome.",
        };
        notify(project());
        return;
      }
      acknowledgeReplay(message.replay, admission);
      return;
    }

    if (message.kind === "causal-correction-replay-acknowledged") {
      if (message.acknowledgement.targetTabId !== options.tabId) return;
      if (message.acknowledgement.sourceTabId === options.tabId) {
        const collision = failed(
          "tab-id-collision",
          `Another channel participant acknowledged causal replay evidence for locally owned tab ${options.tabId}.`,
        );
        if (!collision.ok) notify(project([collision.feedback]));
        return;
      }
      const replayPort = options.causalCorrectionReplay;
      if (replayPort === undefined) return;
      try {
        replayPort.acknowledge({
          ...message.acknowledgement,
          feedback: message.acknowledgement.feedback === null ? null : { ...message.acknowledgement.feedback },
        });
      } catch {
        causalCorrectionReplayAcknowledgementObserverFailure = {
          severity: "heat",
          code: "causal-correction-replay-acknowledgement-observer-failed",
          detail: "The injected causal correction replay acknowledgement observer threw; channel delivery continued.",
        };
        notify(project());
      }
      return;
    }

    if (message.presence.tabId === options.tabId) {
      const sameLocalPresence =
        message.presence.sequence === localPresence.sequence && message.presence.state === localPresence.state;
      if (!sameLocalPresence) {
        const collision = failed(
          "tab-id-collision",
          `Another channel participant attempted to update locally owned tab ${options.tabId}.`,
        );
        if (!collision.ok) notify(project([collision.feedback]));
      }
      return;
    }

    const applied = applyPresence(message.presence);
    if (applied.ok) notify(applied.value);
    else notify(project([applied.feedback]));
  };

  let subscribeResult: BrowserTabOperationResult<BrowserTabChannelSubscription>;
  try {
    subscribeResult = channel.subscribe(receive);
  } catch {
    subscribeResult = failed(
      "broadcast-channel-subscribe-failed",
      "The injected browser tab channel threw while subscribing.",
    );
  }
  if (!subscribeResult.ok) {
    try {
      channel.close();
    } catch {
      // The subscription failure is the primary typed result.
    }
    return subscribeResult;
  }
  const subscription = subscribeResult.value;

  const abandonStartup = (): void => {
    try {
      subscription.unsubscribe();
    } catch {
      // Preserve the primary typed startup failure.
    }
    try {
      channel.close();
    } catch {
      // Preserve the primary typed startup failure.
    }
  };

  const initialProbe = publish(probeMessage(options.nodeId, options.tabId, options.initialSequence));
  if (!initialProbe.ok) {
    abandonStartup();
    return initialProbe;
  }
  const initialPresencePublished = publish(presenceMessage(options.nodeId, localPresence));
  if (!initialPresencePublished.ok) {
    abandonStartup();
    return initialPresencePublished;
  }

  const ensureRunning = (): BrowserTabOperationResult<null> =>
    stopped ? failed("coordinator-stopped", "The browser tab coordinator has already stopped.") : succeeded(null);

  const coordinator: BrowserTabCoordinator = {
    read: () => project(),
    announce: (sequence, state) => {
      const running = ensureRunning();
      if (!running.ok) return running;
      if (!isSequence(sequence)) {
        return failed("coordinator-configuration-invalid", "A tab announcement sequence must be non-negative.");
      }
      const candidate = { tabId: options.tabId, sequence, state };
      const applied = applyPresence(candidate);
      if (!applied.ok) return applied;
      const effectivePresence = tabs.find((tab) => tab.tabId === options.tabId);
      if (effectivePresence === undefined) {
        return failed("coordinator-configuration-invalid", "The locally owned tab is missing from coordinator state.");
      }
      if (effectivePresence.sequence !== candidate.sequence || effectivePresence.state !== candidate.state) {
        return failed(
          "tab-sequence-stale",
          `The local tab retained sequence ${String(effectivePresence.sequence)} and rejected sequence ${String(sequence)}.`,
          "backpressure",
        );
      }
      localPresence = effectivePresence;
      const published = publish(presenceMessage(options.nodeId, localPresence));
      if (!published.ok) return published;
      notify(applied.value);
      return applied;
    },
    probe: (sequence) => {
      const running = ensureRunning();
      if (!running.ok) return running;
      if (!isSequence(sequence)) {
        return failed("coordinator-configuration-invalid", "A tab probe sequence must be non-negative.");
      }
      const published = publish(probeMessage(options.nodeId, options.tabId, sequence));
      if (!published.ok) return published;
      const readout = project();
      notify(readout);
      return succeeded(readout);
    },
    updateCheckpoint: (nextCheckpoint) => {
      const running = ensureRunning();
      if (!running.ok) return running;
      if (!CHECKPOINTS.has(nextCheckpoint)) {
        return failed("coordinator-configuration-invalid", "The checkpoint state is invalid.");
      }
      checkpoint = nextCheckpoint;
      const readout = project();
      notify(readout);
      return succeeded(readout);
    },
    publishCheckpointInvalidation: (operation, revision) => {
      const running = ensureRunning();
      if (!running.ok) return running;
      if (!CHECKPOINT_OPERATIONS.has(operation) || !isSequence(revision)) {
        return failed(
          "coordinator-configuration-invalid",
          "A checkpoint invalidation requires a supported operation and non-negative safe revision.",
        );
      }
      const published = publish(checkpointInvalidationMessage(options.nodeId, options.tabId, operation, revision));
      if (!published.ok) return published;
      return succeeded(project());
    },
    publishDatabaseInvalidation: (databaseNodeId, revision) => {
      const running = ensureRunning();
      if (!running.ok) return running;
      if (!isIdentifier(databaseNodeId) || !isSequence(revision)) {
        return failed(
          "coordinator-configuration-invalid",
          "A database invalidation requires a non-empty database node and non-negative safe revision.",
        );
      }
      const published = publish(databaseInvalidationMessage(options.nodeId, options.tabId, databaseNodeId, revision));
      if (!published.ok) return published;
      return succeeded(project());
    },
    publishDatabaseExecutionReceipt: (receipt) => {
      const running = ensureRunning();
      if (!running.ok) return running;
      if (
        !isIdentifier(receipt.databaseNodeId) ||
        !isIdentifier(receipt.intentId) ||
        !isSequence(receipt.sequence) ||
        receipt.status !== "settled" ||
        !isSequence(receipt.revision) ||
        !isSequence(receipt.accepted) ||
        !isSequence(receipt.duplicates)
      ) {
        return failed(
          "coordinator-configuration-invalid",
          "A database execution receipt requires bounded identity, sequence, revision, and result counts.",
        );
      }
      const published = publish(databaseExecutionReceiptMessage(options.nodeId, options.tabId, receipt));
      if (!published.ok) return published;
      return succeeded(project());
    },
    publishCausalCorrection: (correction) => {
      const running = ensureRunning();
      if (!running.ok) return running;
      const message = causalCorrectionMessage(options.nodeId, options.tabId, correction);
      if (!isCausalCorrection(message.correction)) {
        return failed(
          "coordinator-configuration-invalid",
          "A causal correction requires canonical decimal order after retained history and a non-negative safe row count.",
        );
      }
      const published = publish(message);
      if (!published.ok) return published;
      return succeeded(project());
    },
    stop: (sequence) => {
      const running = ensureRunning();
      if (!running.ok) return running;
      const announced = coordinator.announce(sequence, "dark");
      if (
        !announced.ok &&
        (announced.feedback.code === "tab-sequence-stale" ||
          announced.feedback.code === "coordinator-configuration-invalid")
      ) {
        return announced;
      }
      stopped = true;

      let cleanupFailure: BrowserTabCoordinatorFeedback | null = announced.ok ? null : announced.feedback;
      try {
        const unsubscribed = subscription.unsubscribe();
        if (!unsubscribed.ok && cleanupFailure === null) cleanupFailure = unsubscribed.feedback;
      } catch {
        cleanupFailure ??= {
          severity: "heat",
          code: "broadcast-channel-unsubscribe-failed",
          detail: "The injected browser tab channel threw while unsubscribing.",
        };
      }
      try {
        const closed = channel.close();
        if (!closed.ok && cleanupFailure === null) cleanupFailure = closed.feedback;
      } catch {
        cleanupFailure ??= {
          severity: "heat",
          code: "broadcast-channel-close-failed",
          detail: "The injected browser tab channel threw while closing.",
        };
      }

      return cleanupFailure === null ? succeeded(project()) : { ok: false, feedback: cleanupFailure };
    },
  };

  const initialReadout = project();
  notify(initialReadout);
  return succeeded(coordinator);
}
