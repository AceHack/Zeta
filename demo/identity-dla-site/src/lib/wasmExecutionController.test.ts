import { describe, expect, test } from "bun:test";
import { acceptsWasmResult, beginWasmExecution, cancelWasmExecution, idleWasmExecution } from "./wasmExecutionController";

describe("WASM execution controller", () => {
  test("starts only after an explicit request", () => {
    expect(idleWasmExecution.running).toBeFalse();
    const started = beginWasmExecution(idleWasmExecution);
    expect(started.running).toBeTrue();
    expect(acceptsWasmResult(started, started.generation)).toBeTrue();
  });

  test("FAULT INJECTION: cancellation invalidates a late compiler result", () => {
    const started = beginWasmExecution(idleWasmExecution);
    const cancelled = cancelWasmExecution(started);
    expect(acceptsWasmResult(cancelled, started.generation)).toBeFalse();
    expect(cancelled.generation).toBeGreaterThan(started.generation);
  });
});
