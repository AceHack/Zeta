/**
 * Pure capability and liveness planning for a browser-hosted Zeta node.
 * Browser APIs and third-party runtimes stay behind declared adapter bindings.
 */

export const BROWSER_NODE_SCHEMA = "zeta.browser-node.v1" as const;

export const BROWSER_EXECUTION_TIERS = ["static-css", "javascript", "canvas-2d", "webgl", "webassembly"] as const;

export type BrowserExecutionTier = (typeof BROWSER_EXECUTION_TIERS)[number];

export type BrowserNodeCapability =
  | "css"
  | "javascript"
  | "canvas-2d"
  | "webgl"
  | "webassembly"
  | "fetch"
  | "broadcast-channel"
  | "shared-worker"
  | "service-worker"
  | "background-sync"
  | "indexed-db"
  | "opfs"
  | "web-crypto"
  | "web-rtc"
  | "websocket"
  | "web-gpu"
  | "web-usb"
  | "web-serial"
  | "web-hid"
  | "web-bluetooth"
  | "extension-bridge"
  | "native-messaging";

export type BrowserNodePort =
  | "static-projection"
  | "git-native-read"
  | "git-native-write"
  | "forge-host"
  | "reticulum-peer"
  | "zeta-db-replica"
  | "ai-inference"
  | "background-execution"
  | "device-hardware";

export type BrowserConsent = "not-required" | "pending" | "granted" | "denied";
export type BrowserTabState = "foreground" | "background" | "suspended" | "dark";
export type BrowserCheckpoint = "none" | "volatile" | "durable";
export type BrowserAdapterReliability = "best-effort" | "durable";

export interface BrowserTabPresence {
  readonly tabId: string;
  readonly sequence: number;
  readonly state: BrowserTabState;
}

export interface BrowserPortBinding {
  readonly port: BrowserNodePort;
  readonly adapterId: string;
  readonly requiredCapabilities: readonly BrowserNodeCapability[];
  readonly reliability: BrowserAdapterReliability;
}

export interface BrowserPortRequest {
  readonly port: BrowserNodePort;
  readonly sequence: number;
  readonly consent: BrowserConsent;
}

export interface BrowserNodeSnapshot {
  readonly capabilities: readonly BrowserNodeCapability[];
  readonly tabs: readonly BrowserTabPresence[];
  readonly checkpoint: BrowserCheckpoint;
  readonly bindings: readonly BrowserPortBinding[];
  readonly requests: readonly BrowserPortRequest[];
}

export interface BrowserExecutionReadout {
  readonly available: readonly BrowserExecutionTier[];
  readonly preferred: BrowserExecutionTier | "unavailable";
}

export interface BrowserLivenessReadout {
  readonly runtime: "projection-only" | "node-capable";
  readonly availability: "live" | "dormant" | "cold";
  readonly continuity: "multi-tab" | "single-tab" | "checkpoint-only" | "none";
  readonly zetaAlive: boolean;
  readonly criticalPathEligible: false;
  readonly checkpoint: BrowserCheckpoint;
  readonly openTabIds: readonly string[];
  readonly liveTabIds: readonly string[];
  readonly suspendedTabIds: readonly string[];
  readonly darkTabIds: readonly string[];
}

export type BrowserPortState = "active" | "awaiting-consent" | "denied" | "unsupported";

export interface BrowserPortReadout {
  readonly port: BrowserNodePort;
  readonly state: BrowserPortState;
  readonly consent: BrowserConsent;
  readonly adapterId?: string;
  readonly reliability?: BrowserAdapterReliability;
  readonly missingCapabilities: readonly BrowserNodeCapability[];
  readonly reason: string;
}

export interface BrowserNodeFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "consent-required"
    | "consent-denied"
    | "adapter-missing"
    | "capability-missing"
    | "volatile-checkpoint-lost";
  readonly port?: BrowserNodePort;
  readonly detail: string;
}

export interface BrowserNodeReadout {
  readonly schema: typeof BROWSER_NODE_SCHEMA;
  readonly capabilities: readonly BrowserNodeCapability[];
  readonly execution: BrowserExecutionReadout;
  readonly liveness: BrowserLivenessReadout;
  readonly ports: readonly BrowserPortReadout[];
  readonly feedback: readonly BrowserNodeFeedback[];
}

const RELIABILITY_PRIORITY: Readonly<Record<BrowserAdapterReliability, number>> = {
  durable: 0,
  "best-effort": 1,
};

const TIER_CAPABILITY: Readonly<Record<BrowserExecutionTier, BrowserNodeCapability>> = {
  "static-css": "css",
  javascript: "javascript",
  "canvas-2d": "canvas-2d",
  webgl: "webgl",
  webassembly: "webassembly",
};

const CONSENT_REQUIRED_PORTS: ReadonlySet<BrowserNodePort> = new Set([
  "git-native-write",
  "forge-host",
  "reticulum-peer",
  "ai-inference",
  "background-execution",
  "device-hardware",
]);

const TAB_STATE_SAFETY_ORDER: Readonly<Record<BrowserTabState, number>> = {
  foreground: 0,
  background: 1,
  suspended: 2,
  dark: 3,
};

const CONSENT_SAFETY_ORDER: Readonly<Record<BrowserConsent, number>> = {
  granted: 0,
  "not-required": 1,
  pending: 2,
  denied: 3,
};

function compareOrdinal(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)].sort(compareOrdinal);
}

function sequenceOrder(sequence: number): number {
  return Number.isSafeInteger(sequence) && sequence >= 0 ? sequence : -1;
}

export function foldBrowserTabPresence(events: readonly BrowserTabPresence[]): readonly BrowserTabPresence[] {
  const latest = new Map<string, BrowserTabPresence>();

  for (const event of events) {
    const current = latest.get(event.tabId);
    const eventSequence = sequenceOrder(event.sequence);
    const currentSequence = current === undefined ? -1 : sequenceOrder(current.sequence);
    if (
      current === undefined ||
      eventSequence > currentSequence ||
      (eventSequence === currentSequence && TAB_STATE_SAFETY_ORDER[event.state] > TAB_STATE_SAFETY_ORDER[current.state])
    ) {
      latest.set(event.tabId, event);
    }
  }

  return [...latest.values()].sort((left, right) => compareOrdinal(left.tabId, right.tabId));
}

function foldRequests(events: readonly BrowserPortRequest[]): readonly BrowserPortRequest[] {
  const latest = new Map<BrowserNodePort, BrowserPortRequest>();

  for (const event of events) {
    const current = latest.get(event.port);
    const eventSequence = sequenceOrder(event.sequence);
    const currentSequence = current === undefined ? -1 : sequenceOrder(current.sequence);
    if (
      current === undefined ||
      eventSequence > currentSequence ||
      (eventSequence === currentSequence && CONSENT_SAFETY_ORDER[event.consent] > CONSENT_SAFETY_ORDER[current.consent])
    ) {
      latest.set(event.port, event);
    }
  }

  return [...latest.values()].sort((left, right) => compareOrdinal(left.port, right.port));
}

function executionReadout(capabilities: ReadonlySet<BrowserNodeCapability>): BrowserExecutionReadout {
  const available = BROWSER_EXECUTION_TIERS.filter((tier) => capabilities.has(TIER_CAPABILITY[tier]));
  return {
    available,
    preferred: available.at(-1) ?? "unavailable",
  };
}

function livenessReadout(
  tabs: readonly BrowserTabPresence[],
  checkpoint: BrowserCheckpoint,
  capabilities: ReadonlySet<BrowserNodeCapability>,
): { readonly readout: BrowserLivenessReadout; readonly feedback: readonly BrowserNodeFeedback[] } {
  const openTabIds = tabs.filter((tab) => tab.state !== "dark").map((tab) => tab.tabId);
  const runnable =
    capabilities.has("javascript") ||
    capabilities.has("service-worker") ||
    capabilities.has("extension-bridge") ||
    capabilities.has("native-messaging");
  const activeTabIds = tabs
    .filter((tab) => tab.state === "foreground" || tab.state === "background")
    .map((tab) => tab.tabId);
  const liveTabIds = runnable ? activeTabIds : [];
  const suspendedTabIds = tabs.filter((tab) => tab.state === "suspended").map((tab) => tab.tabId);
  const darkTabIds = tabs.filter((tab) => tab.state === "dark").map((tab) => tab.tabId);

  if (liveTabIds.length > 0) {
    return {
      readout: {
        runtime: "node-capable",
        availability: "live",
        continuity: liveTabIds.length > 1 ? "multi-tab" : "single-tab",
        zetaAlive: true,
        criticalPathEligible: false,
        checkpoint,
        openTabIds,
        liveTabIds,
        suspendedTabIds,
        darkTabIds,
      },
      feedback: [],
    };
  }

  if (checkpoint === "durable") {
    return {
      readout: {
        runtime: runnable ? "node-capable" : "projection-only",
        availability: "dormant",
        continuity: "checkpoint-only",
        zetaAlive: false,
        criticalPathEligible: false,
        checkpoint,
        openTabIds,
        liveTabIds,
        suspendedTabIds,
        darkTabIds,
      },
      feedback: [],
    };
  }

  const feedback: readonly BrowserNodeFeedback[] =
    checkpoint === "volatile"
      ? [
          {
            severity: "heat",
            code: "volatile-checkpoint-lost",
            detail: "No live tab can carry the volatile checkpoint; durable recovery is unavailable.",
          },
        ]
      : [];

  return {
    readout: {
      runtime: runnable ? "node-capable" : "projection-only",
      availability: "cold",
      continuity: "none",
      zetaAlive: false,
      criticalPathEligible: false,
      checkpoint,
      openTabIds,
      liveTabIds,
      suspendedTabIds,
      darkTabIds,
    },
    feedback,
  };
}

function missingCapabilities(
  binding: BrowserPortBinding,
  available: ReadonlySet<BrowserNodeCapability>,
): readonly BrowserNodeCapability[] {
  return uniqueSorted(binding.requiredCapabilities.filter((capability) => !available.has(capability)));
}

function bestBinding(
  port: BrowserNodePort,
  bindings: readonly BrowserPortBinding[],
  available: ReadonlySet<BrowserNodeCapability>,
):
  | { readonly kind: "active"; readonly binding: BrowserPortBinding }
  | {
      readonly kind: "missing";
      readonly binding: BrowserPortBinding;
      readonly missing: readonly BrowserNodeCapability[];
    }
  | { readonly kind: "absent" } {
  const candidates = bindings
    .filter((binding) => binding.port === port)
    .map((binding) => ({ binding, missing: missingCapabilities(binding, available) }))
    .sort((left, right) => {
      const missingCompare = left.missing.length - right.missing.length;
      if (missingCompare !== 0) return missingCompare;

      const reliabilityCompare =
        RELIABILITY_PRIORITY[left.binding.reliability] - RELIABILITY_PRIORITY[right.binding.reliability];
      if (reliabilityCompare !== 0) return reliabilityCompare;

      const adapterCompare = compareOrdinal(left.binding.adapterId, right.binding.adapterId);
      if (adapterCompare !== 0) return adapterCompare;

      const requirementCompare = compareOrdinal(
        JSON.stringify(uniqueSorted(left.binding.requiredCapabilities)),
        JSON.stringify(uniqueSorted(right.binding.requiredCapabilities)),
      );
      return requirementCompare;
    });

  const candidate = candidates[0];
  if (candidate === undefined) return { kind: "absent" };
  if (candidate.missing.length === 0) return { kind: "active", binding: candidate.binding };
  return { kind: "missing", binding: candidate.binding, missing: candidate.missing };
}

function consentState(request: BrowserPortRequest): BrowserPortState | null {
  if (!CONSENT_REQUIRED_PORTS.has(request.port)) return null;
  if (request.consent === "granted") return null;
  if (request.consent === "denied") return "denied";
  return "awaiting-consent";
}

function planPort(
  request: BrowserPortRequest,
  bindings: readonly BrowserPortBinding[],
  available: ReadonlySet<BrowserNodeCapability>,
): { readonly readout: BrowserPortReadout; readonly feedback: BrowserNodeFeedback | null } {
  const blockedByConsent = consentState(request);
  if (blockedByConsent === "denied") {
    return {
      readout: {
        port: request.port,
        state: "denied",
        consent: request.consent,
        missingCapabilities: [],
        reason: "The user denied this privileged browser port.",
      },
      feedback: {
        severity: "heat",
        code: "consent-denied",
        port: request.port,
        detail: `Denied browser port: ${request.port}.`,
      },
    };
  }

  if (blockedByConsent === "awaiting-consent") {
    return {
      readout: {
        port: request.port,
        state: "awaiting-consent",
        consent: request.consent,
        missingCapabilities: [],
        reason: "Explicit user consent is required before this browser port can activate.",
      },
      feedback: {
        severity: "backpressure",
        code: "consent-required",
        port: request.port,
        detail: `Browser port is waiting for explicit consent: ${request.port}.`,
      },
    };
  }

  const binding = bestBinding(request.port, bindings, available);
  if (binding.kind === "absent") {
    return {
      readout: {
        port: request.port,
        state: "unsupported",
        consent: request.consent,
        missingCapabilities: [],
        reason: "No adapter is installed for this browser port.",
      },
      feedback: {
        severity: "heat",
        code: "adapter-missing",
        port: request.port,
        detail: `No browser adapter is installed for port: ${request.port}.`,
      },
    };
  }

  if (binding.kind === "missing") {
    return {
      readout: {
        port: request.port,
        state: "unsupported",
        consent: request.consent,
        adapterId: binding.binding.adapterId,
        reliability: binding.binding.reliability,
        missingCapabilities: binding.missing,
        reason: "The selected adapter requires browser capabilities that are not available.",
      },
      feedback: {
        severity: "heat",
        code: "capability-missing",
        port: request.port,
        detail: `Browser adapter ${binding.binding.adapterId} is missing: ${binding.missing.join(", ")}.`,
      },
    };
  }

  return {
    readout: {
      port: request.port,
      state: "active",
      consent: request.consent,
      adapterId: binding.binding.adapterId,
      reliability: binding.binding.reliability,
      missingCapabilities: [],
      reason: "The requested port has an available adapter and all required capabilities.",
    },
    feedback: null,
  };
}

/**
 * Project a browser probe into one deterministic node readout. This function
 * performs no I/O, reads no ambient clock, and never enables a privileged port
 * without an explicit grant.
 */
export function planBrowserNode(snapshot: BrowserNodeSnapshot): BrowserNodeReadout {
  const capabilities = uniqueSorted(snapshot.capabilities);
  const capabilitySet = new Set(capabilities);
  const tabs = foldBrowserTabPresence(snapshot.tabs);
  const liveness = livenessReadout(tabs, snapshot.checkpoint, capabilitySet);
  const portPlans = foldRequests(snapshot.requests).map((request) =>
    planPort(request, snapshot.bindings, capabilitySet),
  );

  return {
    schema: BROWSER_NODE_SCHEMA,
    capabilities,
    execution: executionReadout(capabilitySet),
    liveness: liveness.readout,
    ports: portPlans.map((plan) => plan.readout),
    feedback: [...liveness.feedback, ...portPlans.flatMap((plan) => (plan.feedback === null ? [] : [plan.feedback]))],
  };
}
