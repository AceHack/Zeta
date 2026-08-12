import type {
  ZetaDbDelta,
  ZetaDbFeedback,
  ZetaDbResult,
  ZetaDbTickLimits,
  ZetaDbTickReadout,
  ZetaDbTickRequest,
} from "../zetadb/zeta-db-node";
import type {
  BrowserDatabaseIntentFeedback,
  BrowserDatabaseExecutionReceipt,
  BrowserDatabaseIntentOutboxPort,
  BrowserDatabaseIntentReadout,
  BrowserDatabaseIntentRecord,
} from "./browser-database-intent-outbox";
import type { BrowserExecutionAdmissionPort } from "./browser-execution-admission";
import type { BrowserDatabaseInvalidation } from "./browser-tab-coordinator";

export interface BrowserZetaDbTabFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "database-tab-configuration-invalid"
    | "database-tab-admission-failed"
    | "database-tab-execution-backpressured"
    | "database-tab-executor-threw"
    | "database-tab-intent-failed"
    | "database-tab-intent-refused"
    | "database-tab-observer-failed"
    | "database-tab-outbox-observer-failed"
    | "database-tab-publish-failed"
    | "database-tab-receipt-publish-failed"
    | "database-tab-stopped";
  readonly detail: string;
}

export type BrowserZetaDbTabResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: ZetaDbFeedback | BrowserZetaDbTabFeedback };

export type BrowserZetaDbTabExecutor = (request: ZetaDbTickRequest) => Promise<ZetaDbResult<ZetaDbTickReadout>>;

export type BrowserZetaDbTabEdgeResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly feedback: { readonly severity: "backpressure" | "heat"; readonly code: string; readonly detail: string };
    };

export interface BrowserZetaDbTabRuntimeOptions {
  readonly databaseNodeId: string;
  readonly executorId: string;
  readonly limits: ZetaDbTickLimits;
  readonly admission: BrowserExecutionAdmissionPort;
  readonly outbox: BrowserDatabaseIntentOutboxPort;
  readonly execute: BrowserZetaDbTabExecutor;
  readonly observe: (readout: ZetaDbTickReadout) => BrowserZetaDbTabEdgeResult;
  readonly observeOutbox: (readout: BrowserDatabaseIntentReadout) => BrowserZetaDbTabEdgeResult;
  readonly publishInvalidation: (databaseNodeId: string, revision: number) => BrowserZetaDbTabEdgeResult;
  readonly publishExecutionReceipt: (receipt: BrowserDatabaseExecutionReceipt) => BrowserZetaDbTabEdgeResult;
}

export interface BrowserZetaDbTabRuntime {
  tick(deltas: readonly ZetaDbDelta[]): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout>>;
  compareAndSwap(
    expectedRevision: number,
    deltas: readonly ZetaDbDelta[],
  ): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout>>;
  readOutbox(): Promise<BrowserZetaDbTabResult<BrowserDatabaseIntentReadout>>;
  recoverPending(): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>>;
  receiveInvalidation(invalidation: BrowserDatabaseInvalidation): BrowserZetaDbTabResult<null>;
  drainInvalidations(): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>>;
  stop(): BrowserZetaDbTabResult<null>;
}

interface RuntimeState {
  stopped: boolean;
  latestRevision: number | null;
  lastTick: ZetaDbTickReadout | null;
}

interface DrainReadout {
  readonly lastTick: ZetaDbTickReadout | null;
  readonly target: BrowserZetaDbTabResult<ZetaDbTickReadout> | null;
}

type ExecutorOutcome =
  | { readonly kind: "returned"; readonly result: ZetaDbResult<ZetaDbTickReadout> }
  | { readonly kind: "threw" };

function succeeded<T>(value: T): BrowserZetaDbTabResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserZetaDbTabFeedback["code"],
  detail: string,
  severity: BrowserZetaDbTabFeedback["severity"] = "heat",
): BrowserZetaDbTabResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024;
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function hasMethods(value: unknown, names: readonly string[]): boolean {
  if (value === null || typeof value !== "object") return false;
  try {
    return names.every((name) => typeof Reflect.get(value, name) === "function");
  } catch {
    return false;
  }
}

function isExecutionAdmissionPort(value: unknown): value is BrowserExecutionAdmissionPort {
  return hasMethods(value, ["tryRun"]);
}

function isIntentOutboxPort(value: unknown): value is BrowserDatabaseIntentOutboxPort {
  return hasMethods(value, ["enqueue", "read", "begin", "settle", "refuse", "close"]);
}

function validLimits(limits: ZetaDbTickLimits): boolean {
  return (
    Number.isSafeInteger(limits.maxDeltas) &&
    limits.maxDeltas > 0 &&
    Number.isSafeInteger(limits.maxEntries) &&
    limits.maxEntries > 0 &&
    Number.isSafeInteger(limits.maxCheckpointBytes) &&
    limits.maxCheckpointBytes > 0
  );
}

function edgeFailure(
  code:
    | "database-tab-observer-failed"
    | "database-tab-outbox-observer-failed"
    | "database-tab-publish-failed"
    | "database-tab-receipt-publish-failed",
  edge: Extract<BrowserZetaDbTabEdgeResult, { readonly ok: false }>,
): BrowserZetaDbTabResult<never> {
  return failed(code, `${edge.feedback.code}: ${edge.feedback.detail}`, edge.feedback.severity);
}

function intentFailure(feedback: BrowserDatabaseIntentFeedback): BrowserZetaDbTabResult<never> {
  return failed("database-tab-intent-failed", `${feedback.code}: ${feedback.detail}`, feedback.severity);
}

function observeOutbox(
  options: BrowserZetaDbTabRuntimeOptions,
  readout: BrowserDatabaseIntentReadout,
): BrowserZetaDbTabResult<BrowserDatabaseIntentReadout> {
  try {
    const observed = options.observeOutbox(readout);
    return observed.ok ? succeeded(readout) : edgeFailure("database-tab-outbox-observer-failed", observed);
  } catch {
    return failed(
      "database-tab-outbox-observer-failed",
      "The injected browser database outbox observer threw after a durable transition.",
    );
  }
}

async function readAndObserveOutbox(
  options: BrowserZetaDbTabRuntimeOptions,
): Promise<BrowserZetaDbTabResult<BrowserDatabaseIntentReadout>> {
  const read = await options.outbox.read(options.databaseNodeId);
  return read.ok ? observeOutbox(options, read.value) : intentFailure(read.feedback);
}

async function captureExecutor(
  options: BrowserZetaDbTabRuntimeOptions,
  request: ZetaDbTickRequest,
): Promise<ExecutorOutcome> {
  try {
    return { kind: "returned", result: await options.execute(request) };
  } catch {
    return { kind: "threw" };
  }
}

function requestForIntent(
  options: BrowserZetaDbTabRuntimeOptions,
  intent: BrowserDatabaseIntentRecord,
): ZetaDbTickRequest {
  return {
    nodeId: options.databaseNodeId,
    executorId: options.executorId,
    executorKind: "browser-tab",
    deltas: intent.deltas,
    limits: options.limits,
    requireComplete: true,
    ...(intent.expectedRevision === null ? {} : { expectedRevision: intent.expectedRevision }),
  };
}

function isTransientDatabaseFailure(feedback: ZetaDbFeedback): boolean {
  return feedback.code === "database-read-failed" || feedback.code === "database-write-failed";
}

function applyTickEdges(
  options: BrowserZetaDbTabRuntimeOptions,
  state: RuntimeState,
  tick: ZetaDbTickReadout,
): BrowserZetaDbTabResult<ZetaDbTickReadout> {
  state.latestRevision = tick.revision;
  state.lastTick = tick;

  let publishFailure: BrowserZetaDbTabResult<never> | null = null;
  if (tick.accepted > 0 || tick.duplicates > 0) {
    try {
      const published = options.publishInvalidation(options.databaseNodeId, tick.revision);
      if (!published.ok) publishFailure = edgeFailure("database-tab-publish-failed", published);
    } catch {
      publishFailure = failed(
        "database-tab-publish-failed",
        "The injected database invalidation publisher threw after a committed tick.",
      );
    }
  }

  try {
    const observed = options.observe(tick);
    if (!observed.ok) return edgeFailure("database-tab-observer-failed", observed);
  } catch {
    return failed("database-tab-observer-failed", "The injected browser database observer threw after a finite tick.");
  }
  return publishFailure ?? succeeded(tick);
}

async function refuseIntent(
  options: BrowserZetaDbTabRuntimeOptions,
  intent: BrowserDatabaseIntentRecord,
  feedback: ZetaDbFeedback,
): Promise<BrowserZetaDbTabResult<BrowserDatabaseIntentReadout>> {
  const refused = await options.outbox.refuse(options.databaseNodeId, intent.intentId, intent.sequence, feedback);
  return refused.ok ? observeOutbox(options, refused.value) : intentFailure(refused.feedback);
}

async function settleIntent(
  options: BrowserZetaDbTabRuntimeOptions,
  intent: BrowserDatabaseIntentRecord,
  tick: ZetaDbTickReadout,
): Promise<BrowserZetaDbTabResult<BrowserDatabaseExecutionReceipt>> {
  const settled = await options.outbox.settle(options.databaseNodeId, intent.intentId, intent.sequence, tick);
  if (!settled.ok) return intentFailure(settled.feedback);
  const observed = observeOutbox(options, settled.value);
  if (!observed.ok) return observed;
  const receipt = observed.value.receipts.find(
    (candidate) => candidate.intentId === intent.intentId && candidate.sequence === intent.sequence,
  );
  return receipt === undefined
    ? failed("database-tab-intent-failed", `Settled intent ${intent.intentId} produced no durable receipt.`)
    : succeeded(receipt);
}

function publishExecutionReceipt(
  options: BrowserZetaDbTabRuntimeOptions,
  receipt: BrowserDatabaseExecutionReceipt,
): BrowserZetaDbTabResult<null> {
  try {
    const published = options.publishExecutionReceipt(receipt);
    return published.ok ? succeeded(null) : edgeFailure("database-tab-receipt-publish-failed", published);
  } catch {
    return failed(
      "database-tab-receipt-publish-failed",
      "The injected database execution receipt publisher threw after durable settlement.",
    );
  }
}

async function executePendingIntent(
  options: BrowserZetaDbTabRuntimeOptions,
  state: RuntimeState,
  intent: BrowserDatabaseIntentRecord,
): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>> {
  const begun = await options.outbox.begin(options.databaseNodeId, intent.intentId, intent.sequence);
  if (!begun.ok) return intentFailure(begun.feedback);
  const visible = await readAndObserveOutbox(options);
  if (!visible.ok) return visible;
  const outcome = await captureExecutor(options, requestForIntent(options, begun.value));
  if (outcome.kind === "threw") {
    return failed("database-tab-executor-threw", "The injected browser database executor threw during a finite tick.");
  }
  if (!outcome.result.ok) {
    if (isTransientDatabaseFailure(outcome.result.feedback)) return outcome.result;
    const refused = await refuseIntent(options, intent, outcome.result.feedback);
    return refused.ok ? outcome.result : refused;
  }

  const settled = await settleIntent(options, begun.value, outcome.result.value);
  if (!settled.ok) return settled;
  const edged = applyTickEdges(options, state, outcome.result.value);
  const receiptPublished = publishExecutionReceipt(options, settled.value);
  if (!edged.ok) return edged;
  return receiptPublished.ok ? succeeded(edged.value) : receiptPublished;
}

function refusedTarget(intent: BrowserDatabaseIntentRecord): BrowserZetaDbTabResult<never> {
  const refusal = intent.refusal;
  return failed(
    "database-tab-intent-refused",
    refusal === null
      ? `Intent ${intent.intentId} is retained as refused without feedback.`
      : `${refusal.code}: ${refusal.detail}`,
    refusal?.severity ?? "heat",
  );
}

async function advanceDrain(
  options: BrowserZetaDbTabRuntimeOptions,
  state: RuntimeState,
  targetIntentId: string | null,
  current: DrainReadout,
  intent: BrowserDatabaseIntentRecord,
): Promise<BrowserZetaDbTabResult<DrainReadout>> {
  const executed = await executePendingIntent(options, state, intent);
  if (!executed.ok) {
    if (intent.intentId === targetIntentId || isTransientResult(executed)) return executed;
    return succeeded(current);
  }
  if (executed.value === null) return succeeded(current);
  return succeeded({
    lastTick: executed.value,
    target: intent.intentId === targetIntentId ? succeeded(executed.value) : current.target,
  });
}

async function drainPendingIntents(
  options: BrowserZetaDbTabRuntimeOptions,
  state: RuntimeState,
  targetIntentId: string | null,
): Promise<BrowserZetaDbTabResult<DrainReadout>> {
  const outbox = await readAndObserveOutbox(options);
  if (!outbox.ok) return outbox;
  const targetRecord =
    targetIntentId === null ? undefined : outbox.value.intents.find((intent) => intent.intentId === targetIntentId);
  if (targetRecord?.status === "refused") return refusedTarget(targetRecord);

  let drained: DrainReadout = { lastTick: null, target: null };
  for (const intent of outbox.value.intents) {
    if (intent.status !== "queued" && intent.status !== "executing") continue;
    const next = await advanceDrain(options, state, targetIntentId, drained, intent);
    if (!next.ok) return next;
    drained = next.value;
  }
  if (targetIntentId !== null && drained.target === null) {
    return failed("database-tab-intent-refused", `Intent ${targetIntentId} was not present after durable enqueue.`);
  }
  return succeeded(drained);
}

function isTransientResult(result: BrowserZetaDbTabResult<unknown>): boolean {
  if (result.ok) return false;
  return (
    result.feedback.code === "database-read-failed" ||
    result.feedback.code === "database-write-failed" ||
    result.feedback.code.startsWith("database-tab-") ||
    result.feedback.code.startsWith("intent-")
  );
}

async function admitDrain(
  options: BrowserZetaDbTabRuntimeOptions,
  state: RuntimeState,
  targetIntentId: string | null,
  waitForOwner: boolean,
): Promise<BrowserZetaDbTabResult<DrainReadout>> {
  let admitted;
  try {
    const resourceId = `database/${options.databaseNodeId}`;
    const operation = (): Promise<BrowserZetaDbTabResult<DrainReadout>> =>
      drainPendingIntents(options, state, targetIntentId);
    admitted =
      waitForOwner && options.admission.runWhenAvailable !== undefined
        ? await options.admission.runWhenAvailable(resourceId, operation)
        : await options.admission.tryRun(resourceId, operation);
  } catch {
    return failed(
      "database-tab-admission-failed",
      "The injected browser database execution admission port threw during a finite tick.",
    );
  }
  if (!admitted.ok) {
    return failed(
      "database-tab-admission-failed",
      `${admitted.feedback.code}: ${admitted.feedback.detail}`,
      admitted.feedback.severity,
    );
  }
  return admitted.value.status === "busy"
    ? failed(
        "database-tab-execution-backpressured",
        `Another browser context is executing a finite tick for ${options.databaseNodeId}; the durable intent remains pending.`,
        "backpressure",
      )
    : admitted.value.value;
}

async function executeRead(
  options: BrowserZetaDbTabRuntimeOptions,
  state: RuntimeState,
  requestedRevision: number | null,
  expectedRevision: number | null,
): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>> {
  if (requestedRevision !== null && state.latestRevision !== null && requestedRevision <= state.latestRevision) {
    return succeeded(state.lastTick);
  }
  const request: ZetaDbTickRequest = {
    nodeId: options.databaseNodeId,
    executorId: options.executorId,
    executorKind: "browser-tab",
    deltas: [],
    limits: options.limits,
    ...(expectedRevision === null ? {} : { expectedRevision }),
  };
  const outcome = await captureExecutor(options, request);
  if (outcome.kind === "threw") {
    return failed("database-tab-executor-threw", "The injected browser database executor threw during a finite tick.");
  }
  return outcome.result.ok ? applyTickEdges(options, state, outcome.result.value) : outcome.result;
}

/**
 * Serialize this tab's work and persist every mutation before cross-tab admission.
 * Messages carry only revision evidence; database bytes and the intent outbox remain authoritative.
 */
export function startBrowserZetaDbTabRuntime(
  options: BrowserZetaDbTabRuntimeOptions,
): BrowserZetaDbTabResult<BrowserZetaDbTabRuntime> {
  if (
    !isIdentifier(options.databaseNodeId) ||
    !isIdentifier(options.executorId) ||
    !validLimits(options.limits) ||
    !isExecutionAdmissionPort(options.admission) ||
    !isIntentOutboxPort(options.outbox)
  ) {
    return failed(
      "database-tab-configuration-invalid",
      "A browser database tab runtime requires identifiers, positive safe-integer tick budgets, admission, and an intent outbox.",
    );
  }

  const state: RuntimeState = { stopped: false, latestRevision: null, lastTick: null };
  let tail: Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>> = Promise.resolve(succeeded(null));
  let invalidationTail: Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>> = Promise.resolve(succeeded(null));

  const schedule = (
    operation: () => Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>>,
  ): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>> => {
    const scheduled = tail
      .then(() => {
        return state.stopped
          ? failed("database-tab-stopped", "The browser database tab runtime has already stopped.")
          : operation();
      })
      .catch(() => failed("database-tab-executor-threw", "The browser database tick queue rejected unexpectedly."));
    tail = scheduled;
    return scheduled;
  };

  const mutate = async (
    expectedRevision: number | null,
    deltas: readonly ZetaDbDelta[],
  ): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>> => {
    if (deltas.length === 0) return executeRead(options, state, null, expectedRevision);
    const first = deltas[0];
    if (first === undefined) {
      return failed("database-tab-configuration-invalid", "A database mutation requires at least one delta.");
    }
    const enqueued = await options.outbox.enqueue({
      databaseNodeId: options.databaseNodeId,
      intentId: first.eventId,
      expectedRevision,
      deltas,
    });
    if (!enqueued.ok) return intentFailure(enqueued.feedback);
    const visible = await readAndObserveOutbox(options);
    if (!visible.ok) return visible;
    const drained = await admitDrain(options, state, enqueued.value.intentId, false);
    if (!drained.ok) return drained;
    return (
      drained.value.target ?? failed("database-tab-intent-refused", "The durable intent produced no tick readout.")
    );
  };

  return succeeded({
    tick: async (deltas) => {
      const result = await schedule(() => mutate(null, deltas));
      if (!result.ok) return result;
      return result.value === null
        ? failed("database-tab-executor-threw", "The browser database executor returned no tick readout.")
        : succeeded(result.value);
    },
    compareAndSwap: async (expectedRevision, deltas) => {
      if (!isRevision(expectedRevision)) {
        return failed(
          "database-tab-configuration-invalid",
          "A compare-and-swap tick requires a non-negative safe-integer expected revision.",
        );
      }
      const result = await schedule(() => mutate(expectedRevision, deltas));
      if (!result.ok) return result;
      return result.value === null
        ? failed("database-tab-executor-threw", "The browser database executor returned no tick readout.")
        : succeeded(result.value);
    },
    readOutbox: () => readAndObserveOutbox(options),
    recoverPending: async () => {
      const result = await schedule(async () => {
        const current = await readAndObserveOutbox(options);
        if (!current.ok) return current;
        if (current.value.queued + current.value.executing === 0) return succeeded(null);
        const drained = await admitDrain(options, state, null, true);
        return drained.ok ? succeeded(drained.value.lastTick) : drained;
      });
      return result;
    },
    receiveInvalidation: (invalidation) => {
      if (state.stopped) return failed("database-tab-stopped", "The browser database tab runtime has already stopped.");
      if (
        !isIdentifier(invalidation.sourceTabId) ||
        !isIdentifier(invalidation.databaseNodeId) ||
        !isRevision(invalidation.revision)
      ) {
        return failed(
          "database-tab-configuration-invalid",
          "A database invalidation carried invalid revision evidence.",
        );
      }
      if (invalidation.databaseNodeId !== options.databaseNodeId) return succeeded(null);
      invalidationTail = schedule(() => executeRead(options, state, invalidation.revision, null));
      return succeeded(null);
    },
    drainInvalidations: () => invalidationTail,
    stop: () => {
      if (state.stopped) return succeeded(null);
      state.stopped = true;
      const closed = options.outbox.close();
      return closed.ok ? succeeded(null) : intentFailure(closed.feedback);
    },
  });
}
