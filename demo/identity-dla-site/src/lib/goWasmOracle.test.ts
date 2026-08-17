import { describe, expect, test } from "bun:test";
import { installGoRuntimeBridge, probeGoOracle, readGoOracle, type FetchLike } from "./goWasmOracle";

const MODULE_URL = "/Zeta/wasm/dla-go.wasm";
const BRIDGE_URL = "/Zeta/wasm/wasm_exec.js";

function wasmBytes(size = 64): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes.set([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
  return bytes.buffer;
}

/** A static host that serves only the files handed to it; everything else is a 404. */
function hostServing(files: Readonly<Record<string, ArrayBuffer | string>>): FetchLike {
  return async (url: string) => {
    const body = files[url];
    if (body === undefined) {
      return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0), text: async () => "" };
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => (typeof body === "string" ? new TextEncoder().encode(body).buffer : body),
      text: async () => (typeof body === "string" ? body : new TextDecoder().decode(body)),
    };
  };
}

const BRIDGE = "globalThis.Go = class Go {};";

describe("Go oracle availability is derived from the artifact", () => {
  test("both halves published — available", async () => {
    const probe = await probeGoOracle(hostServing({ [MODULE_URL]: wasmBytes(), [BRIDGE_URL]: BRIDGE }), MODULE_URL, BRIDGE_URL);
    expect(probe.available).toBeTrue();
  });

  // THE MUTATION. This is the same code path as the passing case with one file removed
  // from the host, which is exactly the deployment where the Pages Go build did not run.
  // A status hardcoded to "ready" passes the test above and fails this one.
  test("MUTATION: module absent from the artifact — reports pending, names the file", async () => {
    const probe = await probeGoOracle(hostServing({ [BRIDGE_URL]: BRIDGE }), MODULE_URL, BRIDGE_URL);
    expect(probe.available).toBeFalse();
    if (probe.available) throw new Error("unreachable");
    expect(probe.reason).toContain("pending");
    expect(probe.reason).toContain("dla-go.wasm");
    expect(probe.reason).toContain("404");
  });

  test("MUTATION: bridge absent — the pair is incomplete, so unavailable", async () => {
    const probe = await probeGoOracle(hostServing({ [MODULE_URL]: wasmBytes() }), MODULE_URL, BRIDGE_URL);
    expect(probe.available).toBeFalse();
    if (probe.available) throw new Error("unreachable");
    expect(probe.reason).toContain("wasm_exec.js");
  });

  test("a host answering 200 with an error page is not a module", async () => {
    const probe = await probeGoOracle(hostServing({ [MODULE_URL]: "<!doctype html><title>404</title>", [BRIDGE_URL]: BRIDGE }), MODULE_URL, BRIDGE_URL);
    expect(probe.available).toBeFalse();
    if (probe.available) throw new Error("unreachable");
    expect(probe.reason).toContain("not a WebAssembly module");
  });

  test("a bridge that does not define Go is refused before instantiation", async () => {
    const probe = await probeGoOracle(hostServing({ [MODULE_URL]: wasmBytes(), [BRIDGE_URL]: "console.log('not the bridge');" }), MODULE_URL, BRIDGE_URL);
    expect(probe.available).toBeFalse();
    if (probe.available) throw new Error("unreachable");
    expect(probe.reason).toContain("does not define the Go runtime bridge");
  });

  test("a network failure is reported, not swallowed into a false ready", async () => {
    const failing: FetchLike = async () => {
      throw new Error("offline");
    };
    const probe = await probeGoOracle(failing, MODULE_URL, BRIDGE_URL);
    expect(probe.available).toBeFalse();
    if (probe.available) throw new Error("unreachable");
    expect(probe.reason).toContain("offline");
  });
});

describe("the Go runtime bridge installs once", () => {
  test("evaluates into the given realm and is idempotent", () => {
    const realm: Record<string, unknown> = {};
    installGoRuntimeBridge(BRIDGE, realm);
    expect(typeof realm["Go"]).toBe("function");
    const first = realm["Go"];
    installGoRuntimeBridge("throw new Error('must not re-evaluate');", realm);
    expect(realm["Go"]).toBe(first);
  });

  test("a bridge that defines nothing is a teaching error", () => {
    expect(() => installGoRuntimeBridge("var unused = 1;", {})).toThrow(/did not|without defining/);
  });
});

describe("a degenerate run is not rendered as a D_f", () => {
  const computeDf = (n: number) => Math.log(n) / Math.log(Math.sqrt(n) + 1);

  test("a grown cluster is measured", () => {
    // 345 is the cluster the canonical Go substrate produces at seed 4, and the same
    // number the committed WAT module produces — measured 2026-08-17.
    const reading = readGoOracle(345, computeDf);
    expect(reading.kind).toBe("measured");
    if (reading.kind !== "measured") throw new Error("unreachable");
    expect(reading.df).toBeCloseTo(1.9647, 3);
  });

  test("MUTATION: a cluster that never grew reports degenerate, not D_f = 0.000", () => {
    const reading = readGoOracle(1, computeDf);
    expect(reading.kind).toBe("degenerate");
    if (reading.kind !== "degenerate") throw new Error("unreachable");
    expect(reading.reason).toContain("did not grow");
  });
});
