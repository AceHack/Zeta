import type { BrowserNodeCapability } from "./browser-node";

export const BROWSER_RUNTIME_PROBE_SCHEMA = "zeta.browser-runtime-probe.v1" as const;

export type BrowserCapabilityProbeState = "available" | "unavailable" | "blocked";

export interface BrowserCapabilityObservation {
  readonly capability: BrowserNodeCapability;
  readonly state: BrowserCapabilityProbeState;
  readonly evidencePath: string | null;
}

export interface BrowserRuntimeProbeFeedback {
  readonly severity: "heat";
  readonly code: "capability-probe-blocked";
  readonly capability: BrowserNodeCapability;
  readonly detail: string;
}

export interface BrowserRuntimeProbeReadout {
  readonly schema: typeof BROWSER_RUNTIME_PROBE_SCHEMA;
  readonly capabilities: readonly BrowserNodeCapability[];
  readonly observations: readonly BrowserCapabilityObservation[];
  readonly feedback: readonly BrowserRuntimeProbeFeedback[];
}

type EvidenceKind = "defined" | "function" | "truthy";

interface CapabilityEvidence {
  readonly capability: BrowserNodeCapability;
  readonly paths: readonly (readonly string[])[];
  readonly evidence: EvidenceKind;
}

interface PathReadout {
  readonly state: "present" | "missing" | "blocked";
  readonly value?: unknown;
}

const CAPABILITY_EVIDENCE: readonly CapabilityEvidence[] = [
  { capability: "css", paths: [["document"]], evidence: "defined" },
  { capability: "canvas-2d", paths: [["CanvasRenderingContext2D"]], evidence: "defined" },
  {
    capability: "webgl",
    paths: [["WebGL2RenderingContext"], ["WebGLRenderingContext"]],
    evidence: "defined",
  },
  { capability: "webassembly", paths: [["WebAssembly"]], evidence: "defined" },
  { capability: "fetch", paths: [["fetch"]], evidence: "function" },
  { capability: "broadcast-channel", paths: [["BroadcastChannel"]], evidence: "defined" },
  { capability: "shared-worker", paths: [["SharedWorker"]], evidence: "defined" },
  { capability: "service-worker", paths: [["navigator", "serviceWorker"]], evidence: "defined" },
  { capability: "background-sync", paths: [["SyncManager"]], evidence: "defined" },
  { capability: "indexed-db", paths: [["indexedDB"]], evidence: "defined" },
  { capability: "web-locks", paths: [["navigator", "locks", "request"]], evidence: "function" },
  { capability: "opfs", paths: [["navigator", "storage", "getDirectory"]], evidence: "function" },
  { capability: "web-crypto", paths: [["crypto", "subtle"]], evidence: "defined" },
  { capability: "web-rtc", paths: [["RTCPeerConnection"]], evidence: "defined" },
  { capability: "websocket", paths: [["WebSocket"]], evidence: "defined" },
  { capability: "web-gpu", paths: [["navigator", "gpu"]], evidence: "defined" },
  { capability: "web-usb", paths: [["navigator", "usb"]], evidence: "defined" },
  { capability: "web-serial", paths: [["navigator", "serial"]], evidence: "defined" },
  { capability: "web-hid", paths: [["navigator", "hid"]], evidence: "defined" },
  { capability: "web-bluetooth", paths: [["navigator", "bluetooth"]], evidence: "defined" },
  {
    capability: "extension-bridge",
    paths: [["__zetaBrowserBridge", "extension"]],
    evidence: "truthy",
  },
  {
    capability: "native-messaging",
    paths: [["__zetaBrowserBridge", "nativeMessaging"]],
    evidence: "truthy",
  },
];

function compareOrdinal(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function readPath(root: unknown, path: readonly string[]): PathReadout {
  let current = root;

  for (const segment of path) {
    if (current === null || (typeof current !== "object" && typeof current !== "function")) {
      return { state: "missing" };
    }

    try {
      if (!(segment in current)) return { state: "missing" };
      current = Reflect.get(current, segment);
    } catch {
      return { state: "blocked" };
    }
  }

  return current === null || current === undefined ? { state: "missing" } : { state: "present", value: current };
}

function satisfiesEvidence(readout: PathReadout, evidence: EvidenceKind): boolean {
  if (readout.state !== "present") return false;
  if (evidence === "function") return typeof readout.value === "function";
  if (evidence === "truthy") return Boolean(readout.value);
  return true;
}

function observeCapability(root: unknown, descriptor: CapabilityEvidence): BrowserCapabilityObservation {
  let blocked = false;

  for (const path of descriptor.paths) {
    const readout = readPath(root, path);
    if (satisfiesEvidence(readout, descriptor.evidence)) {
      return {
        capability: descriptor.capability,
        state: "available",
        evidencePath: path.join("."),
      };
    }
    blocked ||= readout.state === "blocked";
  }

  return {
    capability: descriptor.capability,
    state: blocked ? "blocked" : "unavailable",
    evidencePath: null,
  };
}

export function probeBrowserRuntime(root: unknown): BrowserRuntimeProbeReadout {
  const javascriptObservation: BrowserCapabilityObservation = {
    capability: "javascript",
    state: "available",
    evidencePath: "probe-execution",
  };
  const observations: readonly BrowserCapabilityObservation[] = [
    javascriptObservation,
    ...CAPABILITY_EVIDENCE.map((descriptor) => observeCapability(root, descriptor)),
  ].sort((left, right) => compareOrdinal(left.capability, right.capability));

  const capabilities = observations
    .filter((observation) => observation.state === "available")
    .map((observation) => observation.capability);
  const feedback = observations
    .filter((observation) => observation.state === "blocked")
    .map(
      (observation): BrowserRuntimeProbeFeedback => ({
        severity: "heat",
        code: "capability-probe-blocked",
        capability: observation.capability,
        detail: `Browser runtime blocked capability inspection: ${observation.capability}.`,
      }),
    );

  return {
    schema: BROWSER_RUNTIME_PROBE_SCHEMA,
    capabilities,
    observations,
    feedback,
  };
}

export function probeCurrentBrowserRuntime(): BrowserRuntimeProbeReadout {
  return probeBrowserRuntime(globalThis);
}
