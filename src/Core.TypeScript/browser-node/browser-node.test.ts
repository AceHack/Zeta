import { describe, expect, test } from "bun:test";
import {
  BROWSER_NODE_SCHEMA,
  planBrowserNode,
  type BrowserNodeSnapshot,
  type BrowserPortBinding,
} from "./browser-node";

const cssProjection: BrowserPortBinding = {
  port: "static-projection",
  adapterId: "css-static-document",
  requiredCapabilities: ["css"],
  reliability: "best-effort",
};

function snapshot(overrides: Partial<BrowserNodeSnapshot> = {}): BrowserNodeSnapshot {
  return {
    capabilities: ["css"],
    tabs: [{ tabId: "tab-a", sequence: 1, state: "foreground" }],
    checkpoint: "none",
    bindings: [cssProjection],
    requests: [{ port: "static-projection", sequence: 1, consent: "not-required" }],
    ...overrides,
  };
}

describe("browser node capability and liveness planner", () => {
  test("keeps a CSS-only tab as a valid projection without claiming a live node", () => {
    const readout = planBrowserNode(snapshot());

    expect(readout.schema).toBe(BROWSER_NODE_SCHEMA);
    expect(readout.execution).toEqual({ available: ["static-css"], preferred: "static-css" });
    expect(readout.liveness).toMatchObject({
      runtime: "projection-only",
      availability: "cold",
      continuity: "none",
      zetaAlive: false,
      criticalPathEligible: false,
      openTabIds: ["tab-a"],
      liveTabIds: [],
    });
    expect(readout.ports).toEqual([
      {
        port: "static-projection",
        state: "active",
        consent: "not-required",
        adapterId: "css-static-document",
        reliability: "best-effort",
        missingCapabilities: [],
        reason: "The requested port has an available adapter and all required capabilities.",
      },
    ]);
    expect(readout.feedback).toEqual([]);
  });

  test("reports the progressive execution ladder without hiding lower tiers", () => {
    const readout = planBrowserNode(
      snapshot({
        capabilities: ["webassembly", "css", "webgl", "canvas-2d", "javascript"],
      }),
    );

    expect(readout.execution).toEqual({
      available: ["static-css", "javascript", "canvas-2d", "webgl", "webassembly"],
      preferred: "webassembly",
    });
  });

  test("folds tab presence by sequence and keeps the node alive while one tab remains", () => {
    const events = [
      { tabId: "tab-b", sequence: 2, state: "dark" as const },
      { tabId: "tab-a", sequence: 1, state: "foreground" as const },
      { tabId: "tab-b", sequence: 2, state: "foreground" as const },
    ];
    const forward = planBrowserNode(snapshot({ capabilities: ["css", "javascript"], tabs: events }));
    const reverse = planBrowserNode(snapshot({ capabilities: ["css", "javascript"], tabs: [...events].reverse() }));

    expect(forward).toEqual(reverse);
    expect(forward.liveness).toMatchObject({
      runtime: "node-capable",
      availability: "live",
      continuity: "single-tab",
      zetaAlive: true,
      liveTabIds: ["tab-a"],
      darkTabIds: ["tab-b"],
    });
  });

  test("treats all-dark tabs as dormant when durable state can resume", () => {
    const readout = planBrowserNode(
      snapshot({
        tabs: [{ tabId: "tab-a", sequence: 2, state: "dark" }],
        checkpoint: "durable",
      }),
    );

    expect(readout.liveness).toMatchObject({
      availability: "dormant",
      continuity: "checkpoint-only",
      zetaAlive: false,
      checkpoint: "durable",
    });
    expect(readout.feedback).toEqual([]);
  });

  test("emits heat when the last tab leaves only volatile state", () => {
    const readout = planBrowserNode(
      snapshot({
        tabs: [{ tabId: "tab-a", sequence: 2, state: "dark" }],
        checkpoint: "volatile",
      }),
    );

    expect(readout.liveness.availability).toBe("cold");
    expect(readout.feedback).toContainEqual({
      severity: "heat",
      code: "volatile-checkpoint-lost",
      detail: "No live tab can carry the volatile checkpoint; durable recovery is unavailable.",
    });
  });

  test("keeps git-native and forge-host ports independent", () => {
    const readout = planBrowserNode(
      snapshot({
        capabilities: ["css", "javascript", "fetch", "indexed-db"],
        bindings: [
          cssProjection,
          {
            port: "git-native-read",
            adapterId: "git-dumb-http",
            requiredCapabilities: ["javascript", "fetch", "indexed-db"],
            reliability: "best-effort",
          },
          {
            port: "forge-host",
            adapterId: "github-rest-plugin",
            requiredCapabilities: ["javascript", "fetch"],
            reliability: "best-effort",
          },
        ],
        requests: [
          { port: "forge-host", sequence: 1, consent: "pending" },
          { port: "git-native-read", sequence: 1, consent: "not-required" },
        ],
      }),
    );

    expect(readout.ports).toEqual([
      {
        port: "forge-host",
        state: "awaiting-consent",
        consent: "pending",
        missingCapabilities: [],
        reason: "Explicit user consent is required before this browser port can activate.",
      },
      {
        port: "git-native-read",
        state: "active",
        consent: "not-required",
        adapterId: "git-dumb-http",
        reliability: "best-effort",
        missingCapabilities: [],
        reason: "The requested port has an available adapter and all required capabilities.",
      },
    ]);
    expect(readout.feedback).toContainEqual({
      severity: "backpressure",
      code: "consent-required",
      port: "forge-host",
      detail: "Browser port is waiting for explicit consent: forge-host.",
    });
  });

  test("prefers a durable adapter before deterministic identifier tie-breakers", () => {
    const readout = planBrowserNode(
      snapshot({
        capabilities: ["css", "javascript", "fetch"],
        bindings: [
          {
            port: "git-native-read",
            adapterId: "a-best-effort",
            requiredCapabilities: ["javascript", "fetch"],
            reliability: "best-effort",
          },
          {
            port: "git-native-read",
            adapterId: "z-durable",
            requiredCapabilities: ["javascript", "fetch"],
            reliability: "durable",
          },
        ],
        requests: [{ port: "git-native-read", sequence: 1, consent: "not-required" }],
      }),
    );

    expect(readout.ports).toMatchObject([
      {
        port: "git-native-read",
        state: "active",
        adapterId: "z-durable",
        reliability: "durable",
      },
    ]);
  });

  test("never activates background or hardware adapters without consent", () => {
    const readout = planBrowserNode(
      snapshot({
        capabilities: ["css", "javascript", "service-worker", "background-sync", "web-usb"],
        bindings: [
          {
            port: "background-execution",
            adapterId: "pwa-background-sync",
            requiredCapabilities: ["service-worker", "background-sync"],
            reliability: "best-effort",
          },
          {
            port: "device-hardware",
            adapterId: "web-usb-device",
            requiredCapabilities: ["web-usb"],
            reliability: "best-effort",
          },
        ],
        requests: [
          { port: "background-execution", sequence: 1, consent: "not-required" },
          { port: "device-hardware", sequence: 1, consent: "denied" },
        ],
      }),
    );

    expect(readout.ports.map((port) => [port.port, port.state])).toEqual([
      ["background-execution", "awaiting-consent"],
      ["device-hardware", "denied"],
    ]);
    expect(readout.feedback.map((feedback) => feedback.code)).toEqual(["consent-required", "consent-denied"]);
  });

  test("resolves equal-sequence consent conflicts toward the restrictive state", () => {
    const requests = [
      { port: "ai-inference" as const, sequence: 4, consent: "granted" as const },
      { port: "ai-inference" as const, sequence: 4, consent: "denied" as const },
    ];
    const bindings = [
      {
        port: "ai-inference" as const,
        adapterId: "local-wasm-model-plugin",
        requiredCapabilities: ["javascript", "webassembly"] as const,
        reliability: "best-effort" as const,
      },
    ];
    const forward = planBrowserNode(
      snapshot({ capabilities: ["css", "javascript", "webassembly"], bindings, requests }),
    );
    const reverse = planBrowserNode(
      snapshot({
        capabilities: ["css", "javascript", "webassembly"],
        bindings,
        requests: [...requests].reverse(),
      }),
    );

    expect(forward).toEqual(reverse);
    expect(forward.ports).toMatchObject([{ port: "ai-inference", state: "denied" }]);
  });

  test("activates Reticulum and AI only through declared plugin bindings", () => {
    const readout = planBrowserNode(
      snapshot({
        capabilities: ["css", "javascript", "web-rtc", "webassembly"],
        bindings: [
          {
            port: "reticulum-peer",
            adapterId: "reticulum-webrtc-plugin",
            requiredCapabilities: ["javascript", "web-rtc"],
            reliability: "best-effort",
          },
          {
            port: "ai-inference",
            adapterId: "local-wasm-model-plugin",
            requiredCapabilities: ["javascript", "webassembly"],
            reliability: "best-effort",
          },
        ],
        requests: [
          { port: "reticulum-peer", sequence: 1, consent: "granted" },
          { port: "ai-inference", sequence: 1, consent: "granted" },
        ],
      }),
    );

    expect(readout.ports.map((port) => [port.port, port.state, port.adapterId])).toEqual([
      ["ai-inference", "active", "local-wasm-model-plugin"],
      ["reticulum-peer", "active", "reticulum-webrtc-plugin"],
    ]);
    expect(readout.feedback).toEqual([]);
  });

  test("reports missing adapters and capabilities instead of throwing", () => {
    const readout = planBrowserNode(
      snapshot({
        capabilities: ["css", "javascript"],
        bindings: [
          {
            port: "zeta-db-replica",
            adapterId: "opfs-zeta-db",
            requiredCapabilities: ["javascript", "opfs"],
            reliability: "durable",
          },
        ],
        requests: [
          { port: "git-native-read", sequence: 1, consent: "not-required" },
          { port: "zeta-db-replica", sequence: 1, consent: "not-required" },
        ],
      }),
    );

    expect(readout.ports).toMatchObject([
      { port: "git-native-read", state: "unsupported", missingCapabilities: [] },
      {
        port: "zeta-db-replica",
        state: "unsupported",
        adapterId: "opfs-zeta-db",
        missingCapabilities: ["opfs"],
      },
    ]);
    expect(readout.feedback.map((feedback) => feedback.code)).toEqual(["adapter-missing", "capability-missing"]);
  });
});
