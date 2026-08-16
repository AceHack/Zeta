export type WasmExecutionController = Readonly<{
  readonly generation: number;
  readonly running: boolean;
}>;

export const idleWasmExecution: WasmExecutionController = { generation: 0, running: false };

/** Each start or cancellation advances the generation, invalidating late async results. */
export function beginWasmExecution(previous: WasmExecutionController): WasmExecutionController {
  return { generation: previous.generation + 1, running: true };
}

export function cancelWasmExecution(previous: WasmExecutionController): WasmExecutionController {
  return { generation: previous.generation + 1, running: false };
}

export function acceptsWasmResult(current: WasmExecutionController, generation: number): boolean {
  return current.running && current.generation === generation;
}
