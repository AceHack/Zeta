export const ZETA_DB_PROCEDURE_REQUEST_SCHEMA = "zeta.db.procedure-request.v1" as const;
export const ZETA_DB_PROCEDURE_READOUT_SCHEMA = "zeta.db.procedure-readout.v1" as const;

export interface ZetaDbProcedureRequest {
  readonly schema: typeof ZETA_DB_PROCEDURE_REQUEST_SCHEMA;
  readonly invocationId: string;
  readonly moduleId: string;
  readonly moduleBytes: Uint8Array;
  readonly input: Uint8Array;
  readonly maxOutputBytes: number;
  readonly executionMode: "trusted-cooperative";
}

export interface ZetaDbProcedureReadout {
  readonly schema: typeof ZETA_DB_PROCEDURE_READOUT_SCHEMA;
  readonly invocationId: string;
  readonly moduleId: string;
  readonly target: "wasm";
  readonly executionMode: "trusted-cooperative";
  readonly output: Uint8Array;
}

export interface ZetaDbProcedureFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "procedure-request-invalid"
    | "wasm-unavailable"
    | "wasm-instantiation-failed"
    | "wasm-abi-invalid"
    | "wasm-memory-out-of-bounds"
    | "wasm-execution-failed"
    | "wasm-output-capacity-exhausted";
  readonly detail: string;
}

export type ZetaDbProcedureResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: ZetaDbProcedureFeedback };

export interface ZetaDbProcedurePlugin {
  readonly target: "wasm";
  execute(request: ZetaDbProcedureRequest): Promise<ZetaDbProcedureResult<ZetaDbProcedureReadout>>;
}

export interface ZetaDbWasmHost {
  instantiate(moduleBytes: Uint8Array): Promise<ZetaDbProcedureResult<unknown>>;
}

interface WasmMemoryLike {
  readonly buffer: ArrayBufferLike;
}

interface WasmAbi {
  readonly memory: WasmMemoryLike;
  readonly allocate: (length: number) => unknown;
  readonly execute: (pointer: number, length: number) => unknown;
  readonly resultPointer: () => unknown;
  readonly resultLength: () => unknown;
  readonly deallocate: ((pointer: number, length: number) => unknown) | null;
}

function succeeded<T>(value: T): ZetaDbProcedureResult<T> {
  return { ok: true, value };
}

function failed(
  code: ZetaDbProcedureFeedback["code"],
  detail: string,
  severity: ZetaDbProcedureFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: ZetaDbProcedureFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024;
}

function method(
  value: Readonly<Record<string, unknown>>,
  name: string,
): ((...args: readonly unknown[]) => unknown) | null {
  try {
    const candidate = Reflect.get(value, name);
    return typeof candidate === "function" ? (candidate as (...args: readonly unknown[]) => unknown) : null;
  } catch {
    return null;
  }
}

function safeIndex(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function boundsFit(pointer: number, length: number, capacity: number): boolean {
  return Number.isSafeInteger(pointer + length) && pointer <= capacity && length <= capacity - pointer;
}

function inspectAbi(value: unknown): ZetaDbProcedureResult<WasmAbi> {
  if (!isRecord(value)) return failed("wasm-abi-invalid", "The WASM host returned no export object.");
  let exportsValue: unknown = value;
  if (isRecord(value.instance)) exportsValue = value.instance.exports;
  else if (isRecord(value.exports)) exportsValue = value.exports;
  if (!isRecord(exportsValue)) return failed("wasm-abi-invalid", "The WASM instance has no export object.");

  const memoryValue = exportsValue.memory;
  const allocate = method(exportsValue, "zeta_alloc");
  const execute = method(exportsValue, "zeta_execute");
  const resultPointer = method(exportsValue, "zeta_result_pointer");
  const resultLength = method(exportsValue, "zeta_result_length");
  const deallocate = method(exportsValue, "zeta_dealloc");
  if (
    !isRecord(memoryValue) ||
    !(
      memoryValue.buffer instanceof ArrayBuffer ||
      (typeof SharedArrayBuffer !== "undefined" && memoryValue.buffer instanceof SharedArrayBuffer)
    ) ||
    allocate === null ||
    execute === null ||
    resultPointer === null ||
    resultLength === null
  ) {
    return failed(
      "wasm-abi-invalid",
      "A database WASM module must export memory, zeta_alloc, zeta_execute, zeta_result_pointer, and zeta_result_length.",
    );
  }
  return succeeded({
    memory: memoryValue as unknown as WasmMemoryLike,
    allocate: (length) => Reflect.apply(allocate, exportsValue, [length]),
    execute: (pointer, length) => Reflect.apply(execute, exportsValue, [pointer, length]),
    resultPointer: () => Reflect.apply(resultPointer, exportsValue, []),
    resultLength: () => Reflect.apply(resultLength, exportsValue, []),
    deallocate:
      deallocate === null ? null : (pointer, length) => Reflect.apply(deallocate, exportsValue, [pointer, length]),
  });
}

function release(abi: WasmAbi, pointer: number, length: number): void {
  if (abi.deallocate === null) return;
  try {
    abi.deallocate(pointer, length);
  } catch {
    // The execution or bounds result remains primary; deallocation is an optional ABI extension.
  }
}

/** Create the native host adapter without importing browser or Node WebAssembly types. */
export function createNativeZetaDbWasmHost(root: unknown): ZetaDbProcedureResult<ZetaDbWasmHost> {
  if (!isRecord(root)) return failed("wasm-unavailable", "This runtime does not expose WebAssembly.", "backpressure");
  let webAssembly: unknown;
  try {
    webAssembly = Reflect.get(root, "WebAssembly");
  } catch {
    return failed("wasm-unavailable", "This runtime blocked WebAssembly inspection.", "backpressure");
  }
  if (!isRecord(webAssembly)) {
    return failed("wasm-unavailable", "This runtime does not expose WebAssembly.", "backpressure");
  }
  const instantiate = method(webAssembly, "instantiate");
  if (instantiate === null) {
    return failed("wasm-unavailable", "This runtime does not expose WebAssembly.instantiate.", "backpressure");
  }
  return succeeded({
    instantiate: async (moduleBytes) => {
      try {
        const instance = await Promise.resolve(Reflect.apply(instantiate, webAssembly, [moduleBytes, {}]));
        return succeeded(instance);
      } catch (error) {
        return failed("wasm-instantiation-failed", `WASM instantiation failed: ${String(error)}`);
      }
    },
  });
}

/**
 * Byte-in/byte-out WASM procedure ABI. Language-specific compilers target this owned boundary;
 * the database does not know which source language produced the module.
 */
export function createWasmZetaDbProcedurePlugin(host: ZetaDbWasmHost): ZetaDbProcedurePlugin {
  return {
    target: "wasm",
    execute: async (request) => {
      const candidate: unknown = request;
      if (
        !isRecord(candidate) ||
        candidate.schema !== ZETA_DB_PROCEDURE_REQUEST_SCHEMA ||
        !isIdentifier(candidate.invocationId) ||
        !isIdentifier(candidate.moduleId) ||
        !(candidate.moduleBytes instanceof Uint8Array) ||
        candidate.moduleBytes.byteLength === 0 ||
        !(candidate.input instanceof Uint8Array) ||
        typeof candidate.maxOutputBytes !== "number" ||
        !Number.isSafeInteger(candidate.maxOutputBytes) ||
        candidate.maxOutputBytes < 0 ||
        candidate.executionMode !== "trusted-cooperative"
      ) {
        return failed(
          "procedure-request-invalid",
          "A WASM procedure requires identifiers, non-empty module bytes, input bytes, a non-negative safe output budget, and the explicit trusted-cooperative execution mode.",
        );
      }
      const validated = candidate as unknown as ZetaDbProcedureRequest;

      const instantiated = await host.instantiate(new Uint8Array(validated.moduleBytes));
      if (!instantiated.ok) return instantiated;
      const inspected = inspectAbi(instantiated.value);
      if (!inspected.ok) return inspected;
      const abi = inspected.value;

      let inputPointer: number | null = null;
      try {
        inputPointer = safeIndex(abi.allocate(validated.input.byteLength));
        if (inputPointer === null) return failed("wasm-abi-invalid", "zeta_alloc returned an invalid pointer.");
        const inputMemory = new Uint8Array(abi.memory.buffer);
        if (!boundsFit(inputPointer, validated.input.byteLength, inputMemory.byteLength)) {
          return failed("wasm-memory-out-of-bounds", "The allocated input range lies outside exported WASM memory.");
        }
        inputMemory.set(validated.input, inputPointer);
        const status = abi.execute(inputPointer, validated.input.byteLength);
        if (status !== 0) {
          return failed("wasm-execution-failed", `zeta_execute returned non-zero status ${String(status)}.`);
        }

        const outputPointer = safeIndex(abi.resultPointer());
        const outputLength = safeIndex(abi.resultLength());
        if (outputPointer === null || outputLength === null) {
          return failed("wasm-abi-invalid", "The WASM result pointer or length is invalid.");
        }
        if (outputLength > validated.maxOutputBytes) {
          return failed(
            "wasm-output-capacity-exhausted",
            `The WASM procedure produced ${String(outputLength)} bytes; the output budget is ${String(validated.maxOutputBytes)} bytes.`,
            "backpressure",
          );
        }
        const outputMemory = new Uint8Array(abi.memory.buffer);
        if (!boundsFit(outputPointer, outputLength, outputMemory.byteLength)) {
          return failed("wasm-memory-out-of-bounds", "The WASM output range lies outside exported memory.");
        }
        return succeeded({
          schema: ZETA_DB_PROCEDURE_READOUT_SCHEMA,
          invocationId: validated.invocationId,
          moduleId: validated.moduleId,
          target: "wasm",
          executionMode: "trusted-cooperative",
          output: outputMemory.slice(outputPointer, outputPointer + outputLength),
        });
      } catch (error) {
        return failed("wasm-execution-failed", `WASM procedure execution failed: ${String(error)}`);
      } finally {
        if (inputPointer !== null) release(abi, inputPointer, validated.input.byteLength);
      }
    },
  };
}
