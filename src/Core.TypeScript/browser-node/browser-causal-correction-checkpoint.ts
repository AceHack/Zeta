import {
  BROWSER_CAUSAL_CORRECTION_LEDGER_SCHEMA,
  createBrowserCausalCorrectionLedger,
  foldBrowserCausalCorrections,
  type BrowserCausalCorrectionLedger,
} from "./browser-causal-correction-ledger";
import { browserCheckpointRecordNodeId } from "./browser-checkpoint-port";

export const BROWSER_CAUSAL_CORRECTION_CHECKPOINT_SCHEMA = "zeta.browser-causal-correction-checkpoint.v1" as const;
export const MAX_BROWSER_CAUSAL_CORRECTION_CHECKPOINT_BYTES = 256 * 1024;

export interface BrowserCausalCorrectionCheckpointFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "causal-checkpoint-state-invalid"
    | "causal-checkpoint-too-large"
    | "causal-checkpoint-encode-failed"
    | "causal-checkpoint-decode-failed"
    | "causal-checkpoint-schema-unsupported"
    | "causal-checkpoint-non-canonical";
  readonly detail: string;
}

export type BrowserCausalCorrectionCheckpointResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserCausalCorrectionCheckpointFeedback };

interface BrowserCausalCorrectionCheckpointEnvelope {
  readonly schema: typeof BROWSER_CAUSAL_CORRECTION_CHECKPOINT_SCHEMA;
  readonly maxCorrections: number;
  readonly corrections: BrowserCausalCorrectionLedger["corrections"];
}

function succeeded<T>(value: T): BrowserCausalCorrectionCheckpointResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserCausalCorrectionCheckpointFeedback["code"],
  detail: string,
  severity: BrowserCausalCorrectionCheckpointFeedback["severity"] = "heat",
): BrowserCausalCorrectionCheckpointResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function canonicalLedger(value: unknown): BrowserCausalCorrectionCheckpointResult<BrowserCausalCorrectionLedger> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schema", "maxCorrections", "corrections"]) ||
    value.schema !== BROWSER_CAUSAL_CORRECTION_LEDGER_SCHEMA
  ) {
    return failed(
      "causal-checkpoint-state-invalid",
      `A causal correction checkpoint must contain a ${BROWSER_CAUSAL_CORRECTION_LEDGER_SCHEMA} ledger.`,
    );
  }
  const created = createBrowserCausalCorrectionLedger(value.maxCorrections as number);
  if (!created.ok || !Array.isArray(value.corrections)) {
    return failed(
      "causal-checkpoint-state-invalid",
      created.ok ? "A causal correction checkpoint must contain a correction array." : created.feedback.detail,
      created.ok ? "heat" : created.feedback.severity,
    );
  }
  if (
    !value.corrections.every(
      (correction) =>
        isRecord(correction) &&
        hasExactKeys(correction, ["sourceTabId", "sequence", "reinterpretsThrough", "deltaRows"]),
    )
  ) {
    return failed(
      "causal-checkpoint-state-invalid",
      "Causal correction checkpoint rows may contain only sourceTabId, sequence, reinterpretsThrough, and deltaRows.",
    );
  }
  const folded = foldBrowserCausalCorrections(created.value, value.corrections);
  return folded.ok
    ? succeeded(folded.value)
    : failed("causal-checkpoint-state-invalid", folded.feedback.detail, folded.feedback.severity);
}

function canonicalBytes(ledger: BrowserCausalCorrectionLedger): BrowserCausalCorrectionCheckpointResult<Uint8Array> {
  const envelope: BrowserCausalCorrectionCheckpointEnvelope = {
    schema: BROWSER_CAUSAL_CORRECTION_CHECKPOINT_SCHEMA,
    maxCorrections: ledger.maxCorrections,
    corrections: ledger.corrections.map((correction) => ({
      sourceTabId: correction.sourceTabId,
      sequence: correction.sequence,
      reinterpretsThrough: correction.reinterpretsThrough,
      deltaRows: correction.deltaRows,
    })),
  };
  let payload: Uint8Array;
  try {
    payload = new TextEncoder().encode(JSON.stringify(envelope));
  } catch (error) {
    return failed("causal-checkpoint-encode-failed", `Causal correction checkpoint encoding failed: ${String(error)}`);
  }
  if (payload.byteLength > MAX_BROWSER_CAUSAL_CORRECTION_CHECKPOINT_BYTES) {
    return failed(
      "causal-checkpoint-too-large",
      `Causal correction checkpoint payload is ${String(payload.byteLength)} bytes; the limit is ${String(MAX_BROWSER_CAUSAL_CORRECTION_CHECKPOINT_BYTES)}.`,
      "backpressure",
    );
  }
  return succeeded(payload);
}

export function browserCausalCorrectionCheckpointNodeId(nodeId: string): string {
  return browserCheckpointRecordNodeId("causal-corrections", nodeId);
}

export function encodeBrowserCausalCorrectionCheckpoint(
  ledger: BrowserCausalCorrectionLedger,
): BrowserCausalCorrectionCheckpointResult<Uint8Array> {
  try {
    const canonical = canonicalLedger(ledger);
    return canonical.ok ? canonicalBytes(canonical.value) : canonical;
  } catch (error) {
    return failed(
      "causal-checkpoint-encode-failed",
      `Causal correction checkpoint inspection failed: ${String(error)}`,
    );
  }
}

export function decodeBrowserCausalCorrectionCheckpoint(
  payload: Uint8Array,
): BrowserCausalCorrectionCheckpointResult<BrowserCausalCorrectionLedger> {
  try {
    if (!(payload instanceof Uint8Array) || payload.byteLength === 0) {
      return failed("causal-checkpoint-decode-failed", "Causal correction checkpoint payload must contain bytes.");
    }
    if (payload.byteLength > MAX_BROWSER_CAUSAL_CORRECTION_CHECKPOINT_BYTES) {
      return failed(
        "causal-checkpoint-too-large",
        `Causal correction checkpoint payload is ${String(payload.byteLength)} bytes; the limit is ${String(MAX_BROWSER_CAUSAL_CORRECTION_CHECKPOINT_BYTES)}.`,
        "backpressure",
      );
    }

    let parsed: unknown;
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(payload);
      parsed = JSON.parse(text);
    } catch (error) {
      return failed(
        "causal-checkpoint-decode-failed",
        `Causal correction checkpoint decoding failed: ${String(error)}`,
      );
    }
    if (!isRecord(parsed) || parsed.schema !== BROWSER_CAUSAL_CORRECTION_CHECKPOINT_SCHEMA) {
      return failed(
        "causal-checkpoint-schema-unsupported",
        `Causal correction checkpoint schema must be ${BROWSER_CAUSAL_CORRECTION_CHECKPOINT_SCHEMA}.`,
      );
    }
    if (!hasExactKeys(parsed, ["schema", "maxCorrections", "corrections"])) {
      return failed(
        "causal-checkpoint-state-invalid",
        "A causal correction checkpoint must contain only schema, maxCorrections, and corrections.",
      );
    }

    const canonical = canonicalLedger({
      schema: BROWSER_CAUSAL_CORRECTION_LEDGER_SCHEMA,
      maxCorrections: parsed.maxCorrections,
      corrections: parsed.corrections,
    });
    if (!canonical.ok) return canonical;
    const encoded = canonicalBytes(canonical.value);
    if (!encoded.ok) return encoded;
    if (
      encoded.value.byteLength !== payload.byteLength ||
      encoded.value.some((byte, index) => byte !== payload[index])
    ) {
      return failed(
        "causal-checkpoint-non-canonical",
        "Causal correction checkpoint bytes are valid JSON but not canonical bytes.",
      );
    }
    return succeeded(canonical.value);
  } catch (error) {
    return failed(
      "causal-checkpoint-decode-failed",
      `Causal correction checkpoint inspection failed: ${String(error)}`,
    );
  }
}
