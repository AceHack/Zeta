import { describe, expect, test } from "bun:test";
import { BROWSER_RUNTIME_PROBE_SCHEMA, probeBrowserRuntime } from "./browser-runtime-probe";

describe("browser runtime capability probe", () => {
  test("reports JavaScript honestly when no browser APIs are present", () => {
    const readout = probeBrowserRuntime({});

    expect(readout.schema).toBe(BROWSER_RUNTIME_PROBE_SCHEMA);
    expect(readout.capabilities).toEqual(["javascript"]);
    expect(readout.observations).toContainEqual({
      capability: "css",
      state: "unavailable",
      evidencePath: null,
    });
    expect(readout.feedback).toEqual([]);
  });

  test("maps nested browser APIs and explicit bridges to source capabilities", () => {
    const readout = probeBrowserRuntime({
      document: {},
      CanvasRenderingContext2D: {},
      WebGL2RenderingContext: {},
      WebAssembly: {},
      fetch: () => undefined,
      BroadcastChannel: {},
      SharedWorker: {},
      SyncManager: {},
      indexedDB: {},
      crypto: { subtle: {} },
      RTCPeerConnection: {},
      WebSocket: {},
      navigator: {
        serviceWorker: {},
        storage: { getDirectory: () => undefined },
        gpu: {},
        usb: {},
        serial: {},
        hid: {},
        bluetooth: {},
        locks: { request: () => undefined },
      },
      __zetaBrowserBridge: { extension: true, nativeMessaging: true },
    });

    expect(readout.capabilities).toEqual([
      "background-sync",
      "broadcast-channel",
      "canvas-2d",
      "css",
      "extension-bridge",
      "fetch",
      "indexed-db",
      "javascript",
      "native-messaging",
      "opfs",
      "service-worker",
      "shared-worker",
      "web-bluetooth",
      "web-crypto",
      "web-gpu",
      "web-hid",
      "web-locks",
      "web-rtc",
      "web-serial",
      "web-usb",
      "webassembly",
      "webgl",
      "websocket",
    ]);
    expect(readout.feedback).toEqual([]);
  });

  test("does not infer privileged bridges from unrelated host globals", () => {
    const readout = probeBrowserRuntime({
      chrome: { runtime: { connectNative: () => undefined } },
      browser: { runtime: {} },
      __zetaBrowserBridge: { extension: false, nativeMessaging: false },
    });

    expect(readout.capabilities).not.toContain("extension-bridge");
    expect(readout.capabilities).not.toContain("native-messaging");
  });

  test("turns hostile getters into typed heat instead of throwing", () => {
    const hostile = Object.defineProperty({}, "navigator", {
      get(): never {
        throw new Error("blocked by host policy");
      },
    });

    const readout = probeBrowserRuntime(hostile);

    expect(readout.capabilities).toEqual(["javascript"]);
    expect(readout.observations).toContainEqual({
      capability: "service-worker",
      state: "blocked",
      evidencePath: null,
    });
    expect(readout.feedback).toContainEqual({
      severity: "heat",
      code: "capability-probe-blocked",
      capability: "service-worker",
      detail: "Browser runtime blocked capability inspection: service-worker.",
    });
  });

  test("accepts either WebGL generation without duplicate capability rows", () => {
    const readout = probeBrowserRuntime({ WebGLRenderingContext: {} });

    expect(readout.capabilities).toEqual(["javascript", "webgl"]);
    expect(readout.observations.filter((row) => row.capability === "webgl")).toHaveLength(1);
  });
});
