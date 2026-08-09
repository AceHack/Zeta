import { describe, expect, test } from "bun:test";
import {
  createNativeZetaDbWasmHost,
  createWasmZetaDbProcedurePlugin,
  type ZetaDbWasmHost,
} from "./wasm-procedure-plugin";

function echoHost(output: Uint8Array): ZetaDbWasmHost {
  return {
    instantiate: () => {
      const memory = { buffer: new ArrayBuffer(128) };
      new Uint8Array(memory.buffer).set(output, 64);
      return Promise.resolve({
        ok: true,
        value: {
          exports: {
            memory,
            zeta_alloc: () => 8,
            zeta_execute: () => 0,
            zeta_result_pointer: () => 64,
            zeta_result_length: () => output.byteLength,
          },
        },
      });
    },
  };
}

const request = {
  schema: "zeta.db.procedure-request.v1" as const,
  invocationId: "invocation/1",
  moduleId: "module/example",
  moduleBytes: new Uint8Array([0, 97, 115, 109]),
  input: new Uint8Array([1, 2, 3]),
  maxOutputBytes: 32,
  executionMode: "trusted-cooperative" as const,
};

describe("WASM ZetaDB procedure plugin", () => {
  test("executes the owned byte ABI through an injected host", async () => {
    const result = await createWasmZetaDbProcedurePlugin(echoHost(new Uint8Array([9, 8, 7]))).execute(request);

    expect(result).toEqual({
      ok: true,
      value: {
        schema: "zeta.db.procedure-readout.v1",
        invocationId: "invocation/1",
        moduleId: "module/example",
        target: "wasm",
        executionMode: "trusted-cooperative",
        output: new Uint8Array([9, 8, 7]),
      },
    });
  });

  test("backpressures output that exceeds the invocation budget", async () => {
    const result = await createWasmZetaDbProcedurePlugin(echoHost(new Uint8Array([9, 8, 7]))).execute({
      ...request,
      maxOutputBytes: 2,
    });

    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "wasm-output-capacity-exhausted",
        detail: "The WASM procedure produced 3 bytes; the output budget is 2 bytes.",
      },
    });
  });

  test("rejects an incomplete ABI", async () => {
    const plugin = createWasmZetaDbProcedurePlugin({
      instantiate: () => Promise.resolve({ ok: true, value: { exports: {} } }),
    });

    expect(await plugin.execute(request)).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "wasm-abi-invalid",
        detail:
          "A database WASM module must export memory, zeta_alloc, zeta_execute, zeta_result_pointer, and zeta_result_length.",
      },
    });
  });

  test("reports a missing native WebAssembly host without throwing", () => {
    expect(createNativeZetaDbWasmHost({})).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "wasm-unavailable",
        detail: "This runtime does not expose WebAssembly.",
      },
    });
  });
});
