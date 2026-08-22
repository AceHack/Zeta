import {
  startBrowserTabCoordinator,
  type BrowserTabChannel,
  type BrowserCausalCorrectionNotice,
  type BrowserCheckpointInvalidationOperation,
  type BrowserDatabaseExecutionReceiptNotice,
  type BrowserDatabaseInvalidation,
  type BrowserTabCoordinator,
  type BrowserTabCoordinatorFeedback,
  type BrowserTabCoordinatorOptions,
  type BrowserTabCoordinatorReadout,
} from "./browser-tab-coordinator";
import type { BrowserCheckpoint, BrowserTabState } from "./browser-node";

export const BROWSER_LIFECYCLE_HOST_SCHEMA = "zeta.browser-lifecycle-host.v1" as const;

export type BrowserLifecycleEventType = "visibilitychange" | "pageshow" | "pagehide";
export type BrowserDocumentVisibility = "visible" | "hidden" | "prerender";

export interface BrowserLifecycleEvent {
  readonly persisted: boolean;
}

export interface BrowserLifecycleHostFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "lifecycle-configuration-invalid"
    | "lifecycle-unavailable"
    | "lifecycle-subscribe-failed"
    | "lifecycle-unsubscribe-failed"
    | "visibility-invalid"
    | "sequence-invalid"
    | "sequence-exhausted"
    | "coordinator-start-failed"
    | "coordinator-operation-failed"
    | "readout-sink-failed"
    | "feedback-capacity-exhausted"
    | "host-stopped";
  readonly detail: string;
}

export type BrowserLifecycleResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserLifecycleHostFeedback };

export type BrowserReadoutSinkResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly detail: string };

export interface BrowserLifecycleSubscription {
  unsubscribe(): BrowserLifecycleResult<null>;
}

export interface BrowserLifecyclePort {
  visibility(): BrowserLifecycleResult<BrowserDocumentVisibility>;
  subscribe(
    eventType: BrowserLifecycleEventType,
    listener: (event: BrowserLifecycleEvent) => void,
  ): BrowserLifecycleResult<BrowserLifecycleSubscription>;
}

export interface BrowserSequencePort {
  next(): BrowserLifecycleResult<number>;
}

export interface BrowserTabReadoutSink {
  write(readout: BrowserTabCoordinatorReadout): BrowserReadoutSinkResult<null>;
}

export interface BrowserLifecycleHostOptions extends Omit<BrowserTabCoordinatorOptions, "onReadout"> {
  readonly maxFeedback: number;
}

export interface BrowserLifecycleHostReadout {
  readonly schema: typeof BROWSER_LIFECYCLE_HOST_SCHEMA;
  readonly state: BrowserTabState;
  readonly stopped: boolean;
  readonly admission: "open" | "backpressured";
  readonly coordinator: BrowserTabCoordinatorReadout;
  readonly feedback: readonly BrowserLifecycleHostFeedback[];
}

export interface BrowserLifecycleHost {
  read(): BrowserLifecycleHostReadout;
  updateCheckpoint(checkpoint: BrowserCheckpoint): BrowserLifecycleResult<BrowserLifecycleHostReadout>;
  publishCheckpointInvalidation(
    operation: BrowserCheckpointInvalidationOperation,
    revision: number,
  ): BrowserLifecycleResult<BrowserLifecycleHostReadout>;
  publishDatabaseInvalidation(
    databaseNodeId: BrowserDatabaseInvalidation["databaseNodeId"],
    revision: number,
  ): BrowserLifecycleResult<BrowserLifecycleHostReadout>;
  publishDatabaseExecutionReceipt(
    receipt: Omit<BrowserDatabaseExecutionReceiptNotice, "sourceTabId">,
  ): BrowserLifecycleResult<BrowserLifecycleHostReadout>;
  publishCausalCorrection(
    correction: Omit<BrowserCausalCorrectionNotice, "sourceTabId">,
  ): BrowserLifecycleResult<BrowserLifecycleHostReadout>;
  stop(): BrowserLifecycleResult<BrowserLifecycleHostReadout>;
}

function succeeded<T>(value: T): BrowserLifecycleResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserLifecycleHostFeedback["code"],
  detail: string,
  severity: BrowserLifecycleHostFeedback["severity"] = "heat",
): BrowserLifecycleResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSequence(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function stateFromVisibility(visibility: BrowserDocumentVisibility): BrowserTabState {
  if (visibility === "visible") return "foreground";
  if (visibility === "hidden") return "background";
  return "suspended";
}

function coordinatorFailure(feedback: BrowserTabCoordinatorFeedback): BrowserLifecycleHostFeedback {
  return {
    severity: feedback.severity,
    code: "coordinator-operation-failed",
    detail: `${feedback.code}: ${feedback.detail}`,
  };
}

export function createBrowserSequenceCounter(initialSequence: number): BrowserLifecycleResult<BrowserSequencePort> {
  if (!isSequence(initialSequence)) {
    return failed("sequence-invalid", "The browser lifecycle sequence must start at a non-negative safe integer.");
  }

  let current = initialSequence;
  return succeeded({
    next: () => {
      if (current === Number.MAX_SAFE_INTEGER) {
        return failed(
          "sequence-exhausted",
          "The browser lifecycle sequence reached Number.MAX_SAFE_INTEGER and will not wrap.",
          "backpressure",
        );
      }
      current += 1;
      return succeeded(current);
    },
  });
}

/**
 * Drive a tab coordinator from browser lifecycle events. This host owns no
 * clock: lifecycle events supply cadence and the injected sequence supplies
 * ordering. Feedback is bounded and never evicts an admitted entry.
 */
export function startBrowserLifecycleHost(
  options: BrowserLifecycleHostOptions,
  channel: BrowserTabChannel,
  lifecycle: BrowserLifecyclePort,
  sequence: BrowserSequencePort,
  sink: BrowserTabReadoutSink,
): BrowserLifecycleResult<BrowserLifecycleHost> {
  const { maxFeedback, ...coordinatorOptions } = options;
  if (!Number.isSafeInteger(maxFeedback) || maxFeedback < 2) {
    return failed(
      "lifecycle-configuration-invalid",
      "The lifecycle feedback capacity must be a safe integer of at least two entries.",
    );
  }

  let feedback: readonly BrowserLifecycleHostFeedback[] = [];
  let admission: BrowserLifecycleHostReadout["admission"] = "open";
  let stopped = false;
  let state: BrowserTabState = options.initialState;
  let latest: BrowserTabCoordinatorReadout | null = null;
  const subscriptions: BrowserLifecycleSubscription[] = [];

  const record = (entry: BrowserLifecycleHostFeedback): void => {
    if (admission === "backpressured") return;
    if (feedback.length + 1 < maxFeedback) {
      feedback = [...feedback, entry];
      return;
    }
    feedback = [
      ...feedback,
      {
        severity: "backpressure",
        code: "feedback-capacity-exhausted",
        detail: `The lifecycle host retained ${String(feedback.length)} feedback entries and could not admit ${entry.code}.`,
      },
    ];
    admission = "backpressured";
  };

  const observe = (readout: BrowserTabCoordinatorReadout): void => {
    latest = readout;
    const local = readout.tabs.find((tab) => tab.tabId === readout.localTabId);
    if (local !== undefined) state = local.state;
    if (admission === "backpressured") return;

    try {
      const written = sink.write(readout);
      if (!written.ok) {
        record({ severity: "heat", code: "readout-sink-failed", detail: written.detail });
      }
    } catch {
      record({
        severity: "heat",
        code: "readout-sink-failed",
        detail: "The injected browser tab readout sink threw while writing.",
      });
    }
  };

  const coordinatorResult = startBrowserTabCoordinator({ ...coordinatorOptions, onReadout: observe }, channel);
  if (!coordinatorResult.ok) {
    return failed(
      "coordinator-start-failed",
      `${coordinatorResult.feedback.code}: ${coordinatorResult.feedback.detail}`,
      coordinatorResult.feedback.severity,
    );
  }
  const coordinator: BrowserTabCoordinator = coordinatorResult.value;
  latest ??= coordinator.read();

  const read = (): BrowserLifecycleHostReadout => {
    const current = latest ?? coordinator.read();
    return {
      schema: BROWSER_LIFECYCLE_HOST_SCHEMA,
      state,
      stopped,
      admission,
      coordinator: current,
      feedback,
    };
  };

  const detach = (): void => {
    for (const subscription of subscriptions.splice(0)) {
      try {
        const result = subscription.unsubscribe();
        if (!result.ok) record(result.feedback);
      } catch {
        record({
          severity: "heat",
          code: "lifecycle-unsubscribe-failed",
          detail: "The injected browser lifecycle subscription threw while unsubscribing.",
        });
      }
    }
  };

  const nextSequence = (): BrowserLifecycleResult<number> => {
    try {
      return sequence.next();
    } catch {
      return failed("sequence-invalid", "The injected browser lifecycle sequence threw while advancing.");
    }
  };

  const announce = (nextState: BrowserTabState): void => {
    if (stopped || admission === "backpressured" || nextState === state) return;
    const next = nextSequence();
    if (!next.ok) {
      record(next.feedback);
      return;
    }
    const announced = coordinator.announce(next.value, nextState);
    if (!announced.ok) record(coordinatorFailure(announced.feedback));
  };

  const currentVisibility = (): BrowserLifecycleResult<BrowserDocumentVisibility> => {
    try {
      return lifecycle.visibility();
    } catch {
      return failed("visibility-invalid", "The injected browser lifecycle port threw while reading visibility.");
    }
  };

  const announceVisibility = (): void => {
    const visibility = currentVisibility();
    if (!visibility.ok) {
      record(visibility.feedback);
      return;
    }
    announce(stateFromVisibility(visibility.value));
  };

  const stopCoordinator = (): BrowserLifecycleResult<null> => {
    if (stopped) return succeeded(null);
    const next = nextSequence();
    if (!next.ok) {
      record(next.feedback);
      return next;
    }
    const stoppedResult = coordinator.stop(next.value);
    if (!stoppedResult.ok) record(coordinatorFailure(stoppedResult.feedback));
    stopped = true;
    state = "dark";
    detach();
    return succeeded(null);
  };

  const listener =
    (eventType: BrowserLifecycleEventType) =>
    (event: BrowserLifecycleEvent): void => {
      if (stopped) return;
      if (eventType === "pagehide" && !event.persisted) {
        stopCoordinator();
        return;
      }
      if (admission === "backpressured") return;
      if (eventType === "visibilitychange" || eventType === "pageshow") {
        announceVisibility();
        return;
      }
      announce("suspended");
    };

  for (const eventType of ["visibilitychange", "pageshow", "pagehide"] as const) {
    let subscribed: BrowserLifecycleResult<BrowserLifecycleSubscription>;
    try {
      subscribed = lifecycle.subscribe(eventType, listener(eventType));
    } catch {
      subscribed = failed("lifecycle-subscribe-failed", `The lifecycle port threw while subscribing to ${eventType}.`);
    }
    if (!subscribed.ok) {
      detach();
      const next = nextSequence();
      if (next.ok) coordinator.stop(next.value);
      return subscribed;
    }
    subscriptions.push(subscribed.value);
  }

  const host: BrowserLifecycleHost = {
    read,
    updateCheckpoint: (checkpoint) => {
      if (stopped) return failed("host-stopped", "The browser lifecycle host has already stopped.");
      const updated = coordinator.updateCheckpoint(checkpoint);
      if (!updated.ok) {
        const operationFailure = coordinatorFailure(updated.feedback);
        record(operationFailure);
        return { ok: false, feedback: operationFailure };
      }
      return succeeded(read());
    },
    publishCheckpointInvalidation: (operation, revision) => {
      if (stopped) return failed("host-stopped", "The browser lifecycle host has already stopped.");
      const published = coordinator.publishCheckpointInvalidation(operation, revision);
      if (!published.ok) {
        const operationFailure = coordinatorFailure(published.feedback);
        record(operationFailure);
        return { ok: false, feedback: operationFailure };
      }
      return succeeded(read());
    },
    publishDatabaseInvalidation: (databaseNodeId, revision) => {
      if (stopped) return failed("host-stopped", "The browser lifecycle host has already stopped.");
      const published = coordinator.publishDatabaseInvalidation(databaseNodeId, revision);
      if (!published.ok) {
        const operationFailure = coordinatorFailure(published.feedback);
        record(operationFailure);
        return { ok: false, feedback: operationFailure };
      }
      return succeeded(read());
    },
    publishDatabaseExecutionReceipt: (receipt) => {
      if (stopped) return failed("host-stopped", "The browser lifecycle host has already stopped.");
      const published = coordinator.publishDatabaseExecutionReceipt(receipt);
      if (!published.ok) {
        const operationFailure = coordinatorFailure(published.feedback);
        record(operationFailure);
        return { ok: false, feedback: operationFailure };
      }
      return succeeded(read());
    },
    publishCausalCorrection: (correction) => {
      if (stopped) return failed("host-stopped", "The browser lifecycle host has already stopped.");
      const published = coordinator.publishCausalCorrection(correction);
      if (!published.ok) {
        const operationFailure = coordinatorFailure(published.feedback);
        record(operationFailure);
        return { ok: false, feedback: operationFailure };
      }
      return succeeded(read());
    },
    stop: () => {
      if (stopped) return failed("host-stopped", "The browser lifecycle host has already stopped.");
      const result = stopCoordinator();
      if (!result.ok) return result;
      return succeeded(read());
    },
  };

  return succeeded(host);
}

type NativeListener = (event: unknown) => void;

function method(value: unknown, name: string): ((...args: readonly unknown[]) => unknown) | null {
  if (!isRecord(value)) return null;
  try {
    const candidate = Reflect.get(value, name);
    return typeof candidate === "function" ? (candidate as (...args: readonly unknown[]) => unknown) : null;
  } catch {
    return null;
  }
}

/** Create a thin native edge without importing DOM types into the core. */
export function createNativeBrowserLifecyclePort(
  root: unknown = globalThis,
): BrowserLifecycleResult<BrowserLifecyclePort> {
  if (!isRecord(root)) {
    return failed("lifecycle-unavailable", "The current host does not expose a browser document.");
  }
  let documentValue: unknown;
  try {
    documentValue = Reflect.get(root, "document");
  } catch {
    return failed("lifecycle-unavailable", "The current host blocked access to its browser document.");
  }
  if (!isRecord(documentValue)) {
    return failed("lifecycle-unavailable", "The current host does not expose a browser document.");
  }
  const documentRoot = documentValue;

  const port: BrowserLifecyclePort = {
    visibility: () => {
      let value: unknown;
      try {
        value = Reflect.get(documentRoot, "visibilityState");
      } catch {
        return failed("visibility-invalid", "The browser blocked access to document.visibilityState.");
      }
      if (value !== "visible" && value !== "hidden" && value !== "prerender") {
        return failed("visibility-invalid", "The browser returned an unsupported document visibility state.");
      }
      return succeeded(value);
    },
    subscribe: (eventType, eventListener) => {
      const target = eventType === "visibilitychange" ? documentRoot : root;
      const add = method(target, "addEventListener");
      const remove = method(target, "removeEventListener");
      if (add === null || remove === null) {
        return failed("lifecycle-unavailable", `The browser does not expose ${eventType} event subscription.`);
      }
      const nativeListener: NativeListener = (event) => {
        let persisted = false;
        try {
          persisted = isRecord(event) && Reflect.get(event, "persisted") === true;
        } catch {
          persisted = false;
        }
        eventListener({ persisted });
      };
      try {
        Reflect.apply(add, target, [eventType, nativeListener]);
      } catch {
        return failed("lifecycle-subscribe-failed", `The browser rejected the ${eventType} event subscription.`);
      }
      let active = true;
      return succeeded({
        unsubscribe: () => {
          if (!active) return succeeded(null);
          try {
            Reflect.apply(remove, target, [eventType, nativeListener]);
            active = false;
            return succeeded(null);
          } catch {
            return failed("lifecycle-unsubscribe-failed", `The browser rejected removal of the ${eventType} listener.`);
          }
        },
      });
    },
  };

  return succeeded(port);
}
