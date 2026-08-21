import { browserCheckpointRecordNodeId } from "./browser-checkpoint-port";

export const BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA = "zeta.browser-causal-handoff-checkpoint.v1" as const;
export const MAX_BROWSER_CAUSAL_HANDOFF_CHECKPOINT_BYTES = 64 * 1024;

export interface BrowserPendingCausalHandoff {
  readonly targetTabId: string;
  readonly handoffId: string;
  readonly correctionCount: number;
}

export interface BrowserCausalHandoffCheckpoint {
  readonly schema: typeof BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA;
  readonly maxPendingHandoffs: number;
  readonly generation: number;
  readonly pending: readonly BrowserPendingCausalHandoff[];
}

export interface BrowserCausalHandoffCheckpointFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "causal-handoff-checkpoint-state-invalid"
    | "causal-handoff-checkpoint-capacity-exhausted"
    | "causal-handoff-checkpoint-too-large"
    | "causal-handoff-checkpoint-encode-failed"
    | "causal-handoff-checkpoint-decode-failed"
    | "causal-handoff-checkpoint-schema-unsupported"
    | "causal-handoff-checkpoint-non-canonical";
  readonly detail: string;
}

export type BrowserCausalHandoffCheckpointResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserCausalHandoffCheckpointFeedback };

function succeeded<T>(value: T): BrowserCausalHandoffCheckpointResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserCausalHandoffCheckpointFeedback["code"],
  detail: string,
  severity: BrowserCausalHandoffCheckpointFeedback["severity"] = "heat",
): BrowserCausalHandoffCheckpointResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 2048 && !/[\u0000-\u001f\u007f]/.test(value);
}

function handoffGeneration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^replay\/([1-9]\d*)@.+$/.exec(value);
  if (match === null) return null;
  const generation = Number(match[1]);
  return Number.isSafeInteger(generation) ? generation : null;
}

function comparePending(left: BrowserPendingCausalHandoff, right: BrowserPendingCausalHandoff): number {
  if (left.targetTabId < right.targetTabId) return -1;
  if (left.targetTabId > right.targetTabId) return 1;
  return 0;
}

function canonicalCheckpoint(value: unknown): BrowserCausalHandoffCheckpointResult<BrowserCausalHandoffCheckpoint> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schema", "maxPendingHandoffs", "generation", "pending"]) ||
    value.schema !== BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA ||
    !isCount(value.maxPendingHandoffs) ||
    !isCount(value.generation) ||
    !Array.isArray(value.pending)
  ) {
    return failed(
      "causal-handoff-checkpoint-state-invalid",
      "A causal handoff checkpoint must contain the current schema, bounded capacity, generation, and pending array.",
    );
  }
  if (value.pending.length > value.maxPendingHandoffs) {
    return failed(
      "causal-handoff-checkpoint-capacity-exhausted",
      `The handoff checkpoint contains ${String(value.pending.length)} pending offers for capacity ${String(value.maxPendingHandoffs)}.`,
      "backpressure",
    );
  }

  const pending: BrowserPendingCausalHandoff[] = [];
  const targets = new Set<string>();
  for (const item of value.pending) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["targetTabId", "handoffId", "correctionCount"]) ||
      !isIdentifier(item.targetTabId) ||
      !isIdentifier(item.handoffId) ||
      !isCount(item.correctionCount) ||
      item.correctionCount < 1
    ) {
      return failed(
        "causal-handoff-checkpoint-state-invalid",
        "Each pending handoff must contain only a target tab, replay identifier, and positive correction count.",
      );
    }
    const generation = handoffGeneration(item.handoffId);
    if (generation === null || generation > value.generation) {
      return failed(
        "causal-handoff-checkpoint-state-invalid",
        "Each pending handoff identifier must be a replay generation represented by the checkpoint generation.",
      );
    }
    if (targets.has(item.targetTabId)) {
      return failed(
        "causal-handoff-checkpoint-state-invalid",
        `The handoff checkpoint contains duplicate target ${item.targetTabId}.`,
      );
    }
    targets.add(item.targetTabId);
    pending.push({
      targetTabId: item.targetTabId,
      handoffId: item.handoffId,
      correctionCount: item.correctionCount,
    });
  }
  pending.sort(comparePending);
  return succeeded({
    schema: BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
    maxPendingHandoffs: value.maxPendingHandoffs,
    generation: value.generation,
    pending,
  });
}

function canonicalBytes(checkpoint: BrowserCausalHandoffCheckpoint): BrowserCausalHandoffCheckpointResult<Uint8Array> {
  const envelope: BrowserCausalHandoffCheckpoint = {
    schema: BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
    maxPendingHandoffs: checkpoint.maxPendingHandoffs,
    generation: checkpoint.generation,
    pending: checkpoint.pending.map((item) => ({
      targetTabId: item.targetTabId,
      handoffId: item.handoffId,
      correctionCount: item.correctionCount,
    })),
  };
  let payload: Uint8Array;
  try {
    payload = new TextEncoder().encode(JSON.stringify(envelope));
  } catch (error) {
    return failed(
      "causal-handoff-checkpoint-encode-failed",
      `Causal handoff checkpoint encoding failed: ${String(error)}`,
    );
  }
  if (payload.byteLength > MAX_BROWSER_CAUSAL_HANDOFF_CHECKPOINT_BYTES) {
    return failed(
      "causal-handoff-checkpoint-too-large",
      `Causal handoff checkpoint payload is ${String(payload.byteLength)} bytes; the limit is ${String(MAX_BROWSER_CAUSAL_HANDOFF_CHECKPOINT_BYTES)}.`,
      "backpressure",
    );
  }
  return succeeded(payload);
}

export function emptyBrowserCausalHandoffCheckpoint(
  maxPendingHandoffs: number,
): BrowserCausalHandoffCheckpointResult<BrowserCausalHandoffCheckpoint> {
  return canonicalCheckpoint({
    schema: BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
    maxPendingHandoffs,
    generation: 0,
    pending: [],
  });
}

export function browserCausalHandoffCheckpointNodeId(nodeId: string): string {
  return browserCheckpointRecordNodeId("causal-handoffs", nodeId);
}

export function encodeBrowserCausalHandoffCheckpoint(
  checkpoint: BrowserCausalHandoffCheckpoint,
): BrowserCausalHandoffCheckpointResult<Uint8Array> {
  try {
    const canonical = canonicalCheckpoint(checkpoint);
    return canonical.ok ? canonicalBytes(canonical.value) : canonical;
  } catch (error) {
    return failed(
      "causal-handoff-checkpoint-encode-failed",
      `Causal handoff checkpoint inspection failed: ${String(error)}`,
    );
  }
}

export function decodeBrowserCausalHandoffCheckpoint(
  payload: Uint8Array,
): BrowserCausalHandoffCheckpointResult<BrowserCausalHandoffCheckpoint> {
  try {
    if (!(payload instanceof Uint8Array) || payload.byteLength === 0) {
      return failed("causal-handoff-checkpoint-decode-failed", "Causal handoff checkpoint payload must contain bytes.");
    }
    if (payload.byteLength > MAX_BROWSER_CAUSAL_HANDOFF_CHECKPOINT_BYTES) {
      return failed(
        "causal-handoff-checkpoint-too-large",
        `Causal handoff checkpoint payload is ${String(payload.byteLength)} bytes; the limit is ${String(MAX_BROWSER_CAUSAL_HANDOFF_CHECKPOINT_BYTES)}.`,
        "backpressure",
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload));
    } catch (error) {
      return failed(
        "causal-handoff-checkpoint-decode-failed",
        `Causal handoff checkpoint decoding failed: ${String(error)}`,
      );
    }
    if (!isRecord(parsed) || parsed.schema !== BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA) {
      return failed(
        "causal-handoff-checkpoint-schema-unsupported",
        `Causal handoff checkpoint schema must be ${BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA}.`,
      );
    }
    const canonical = canonicalCheckpoint(parsed);
    if (!canonical.ok) return canonical;
    const encoded = canonicalBytes(canonical.value);
    if (!encoded.ok) return encoded;
    if (
      encoded.value.byteLength !== payload.byteLength ||
      encoded.value.some((byte, index) => byte !== payload[index])
    ) {
      return failed(
        "causal-handoff-checkpoint-non-canonical",
        "Causal handoff checkpoint bytes are valid JSON but not canonical bytes.",
      );
    }
    return succeeded(canonical.value);
  } catch (error) {
    return failed(
      "causal-handoff-checkpoint-decode-failed",
      `Causal handoff checkpoint inspection failed: ${String(error)}`,
    );
  }
}
