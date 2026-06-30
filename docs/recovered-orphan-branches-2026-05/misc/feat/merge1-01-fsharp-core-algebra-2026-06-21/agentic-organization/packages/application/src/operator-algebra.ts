/**
 * Operator algebra — the room tick boundary. Port of `src/Core/PluginApi.fs`
 * (`IOperator<'TOut>`, `IStrictOperator<'TOut>`, `OutputBuffer<'TOut>`).
 *
 * Merge1 §01 (F# Core Algebra). A strict operator is the feedback-cut: it IS
 * the z⁻¹ unit delay that separates room ticks. A room's tick loop is
 * `stepAsync()` (observe/execute, publishing the delayed output) →
 * `afterStepAsync()` (capture current input for the next tick). Making the
 * boundary explicit lets room operators compose algebraically.
 */

/** Write-only output channel. Publish exactly once per tick. Port of `OutputBuffer<'TOut>`. */
export interface OutputBuffer<TOut> {
  publish(value: TOut): void;
}

/** Plugin-operator contract. Port of `IOperator<'TOut>` (PluginApi.fs). */
export interface Operator<TOut> {
  readonly name: string;
  /** Names of the inputs this operator reads each tick. */
  readonly readDependencies: readonly string[];
  stepAsync(output: OutputBuffer<TOut>): Promise<void>;
}

/**
 * Strict operator (feedback-cut). `stepAsync` publishes the delayed output;
 * `afterStepAsync` captures the current input for the next tick. This IS the
 * room boundary — the z⁻¹ unit delay. Port of `IStrictOperator<'TOut>`.
 */
export interface StrictOperator<TOut> extends Operator<TOut> {
  afterStepAsync(): Promise<void>;
}

/**
 * A single-slot OutputBuffer enforcing the publish-exactly-once-per-tick
 * contract. Reset between ticks via `take()`.
 */
export function createOutputBuffer<TOut>(): OutputBuffer<TOut> & {
  /** Read and clear the published value; throws if nothing was published. */
  take: () => TOut;
  /** Whether a value has been published this tick. */
  readonly published: () => boolean;
} {
  let slot: { value: TOut } | undefined;
  return {
    publish: (value: TOut) => {
      if (slot !== undefined) {
        throw new Error("OutputBuffer.publish called more than once in a tick");
      }
      slot = { value };
    },
    take: () => {
      if (slot === undefined) {
        throw new Error("OutputBuffer.take called before publish");
      }
      const { value } = slot;
      slot = undefined;
      return value;
    },
    published: () => slot !== undefined,
  };
}
