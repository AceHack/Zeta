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

export const BROWSER_TAB_COORDINATOR_SCHEMA = "zeta.browser-tab-coordinator.v1" as const;

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

export type BrowserTabChannelMessage = BrowserTabPresenceMessage | BrowserTabProbeMessage;

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
    | "tab-message-invalid"
    | "tab-capacity-exhausted"
    | "tab-id-collision"
    | "tab-sequence-stale"
    | "readout-observer-failed"
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
  stop(sequence: number): BrowserTabOperationResult<BrowserTabCoordinatorReadout>;
}

const TAB_STATES: ReadonlySet<string> = new Set(["foreground", "background", "suspended", "dark"]);
const CHECKPOINTS: ReadonlySet<string> = new Set(["none", "volatile", "durable"]);

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

function isSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function decodeChannelMessage(value: unknown): BrowserTabOperationResult<BrowserTabChannelMessage> {
  if (
    !isRecord(value) ||
    value.schema !== BROWSER_TAB_COORDINATOR_SCHEMA ||
    !isIdentifier(value.nodeId) ||
    (value.kind !== "presence" && value.kind !== "probe")
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
      feedback: [...node.feedback, ...(observerFailure === null ? [] : [observerFailure]), ...eventFeedback],
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
  };

  const receive = (value: unknown): void => {
    const decoded = decodeChannelMessage(value);
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
