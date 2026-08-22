import type { BrowserCausalCorrectionNotice } from "./browser-tab-coordinator";

export const BROWSER_CAUSAL_CORRECTION_LEDGER_SCHEMA = "zeta.browser-causal-correction-ledger.v1" as const;

export interface BrowserCausalCorrectionLedger {
  readonly schema: typeof BROWSER_CAUSAL_CORRECTION_LEDGER_SCHEMA;
  readonly maxCorrections: number;
  readonly corrections: readonly BrowserCausalCorrectionNotice[];
}

export interface BrowserCausalCorrectionLedgerFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "causal-correction-ledger-configuration-invalid"
    | "causal-correction-invalid"
    | "causal-correction-conflict"
    | "causal-correction-capacity-exhausted";
  readonly detail: string;
}

export type BrowserCausalCorrectionLedgerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserCausalCorrectionLedgerFeedback };

function succeeded<T>(value: T): BrowserCausalCorrectionLedgerResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserCausalCorrectionLedgerFeedback["code"],
  detail: string,
  severity: BrowserCausalCorrectionLedgerFeedback["severity"] = "heat",
): BrowserCausalCorrectionLedgerResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !/[\u0000-\u001f\u007f]/.test(value);
}

function decimalSequence(value: unknown): bigint | null {
  if (typeof value !== "string" || value.length > 128 || !/^(0|[1-9]\d*)$/.test(value)) return null;
  return BigInt(value);
}

export function validateBrowserCausalCorrectionNotice(
  value: unknown,
): BrowserCausalCorrectionLedgerResult<BrowserCausalCorrectionNotice> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return failed("causal-correction-invalid", "A causal correction notice must be a finite record.");
  }
  const candidate = value as Readonly<Record<string, unknown>>;
  const sequence = decimalSequence(candidate.sequence);
  const reinterpretsThrough = decimalSequence(candidate.reinterpretsThrough);
  if (
    !isIdentifier(candidate.sourceTabId) ||
    sequence === null ||
    reinterpretsThrough === null ||
    sequence <= reinterpretsThrough ||
    typeof candidate.deltaRows !== "number" ||
    !Number.isSafeInteger(candidate.deltaRows) ||
    candidate.deltaRows < 0
  ) {
    return failed(
      "causal-correction-invalid",
      "A causal correction requires a source, canonical decimal order with sequence after history, and a non-negative safe row count.",
    );
  }
  return succeeded({
    sourceTabId: candidate.sourceTabId,
    sequence: candidate.sequence as string,
    reinterpretsThrough: candidate.reinterpretsThrough as string,
    deltaRows: candidate.deltaRows,
  });
}

function sameCorrection(left: BrowserCausalCorrectionNotice, right: BrowserCausalCorrectionNotice): boolean {
  return (
    left.sourceTabId === right.sourceTabId &&
    left.sequence === right.sequence &&
    left.reinterpretsThrough === right.reinterpretsThrough &&
    left.deltaRows === right.deltaRows
  );
}

function compareCorrection(left: BrowserCausalCorrectionNotice, right: BrowserCausalCorrectionNotice): number {
  const sequenceOrder = BigInt(left.sequence) - BigInt(right.sequence);
  if (sequenceOrder < 0n) return -1;
  if (sequenceOrder > 0n) return 1;
  return left.sourceTabId < right.sourceTabId ? -1 : left.sourceTabId > right.sourceTabId ? 1 : 0;
}

function validLedger(value: unknown): value is BrowserCausalCorrectionLedger {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  if (
    candidate.schema !== BROWSER_CAUSAL_CORRECTION_LEDGER_SCHEMA ||
    typeof candidate.maxCorrections !== "number" ||
    !Number.isSafeInteger(candidate.maxCorrections) ||
    candidate.maxCorrections < 1 ||
    !Array.isArray(candidate.corrections) ||
    candidate.corrections.length > candidate.maxCorrections
  ) {
    return false;
  }
  let previous: BrowserCausalCorrectionNotice | null = null;
  for (const value of candidate.corrections) {
    const correction = validateBrowserCausalCorrectionNotice(value);
    if (!correction.ok || (previous !== null && compareCorrection(previous, correction.value) >= 0)) return false;
    previous = correction.value;
  }
  return true;
}

export function createBrowserCausalCorrectionLedger(
  maxCorrections: number,
): BrowserCausalCorrectionLedgerResult<BrowserCausalCorrectionLedger> {
  if (!Number.isSafeInteger(maxCorrections) || maxCorrections < 1) {
    return failed(
      "causal-correction-ledger-configuration-invalid",
      "The causal correction ledger requires a positive safe correction capacity.",
    );
  }
  return succeeded({
    schema: BROWSER_CAUSAL_CORRECTION_LEDGER_SCHEMA,
    maxCorrections,
    corrections: [],
  });
}

/**
 * Admit one append-only correction. Delivery order and exact duplicates do not
 * affect the result; conflicting reuse of a source/sequence identity is heat.
 */
export function foldBrowserCausalCorrection(
  ledger: BrowserCausalCorrectionLedger,
  notice: unknown,
): BrowserCausalCorrectionLedgerResult<BrowserCausalCorrectionLedger> {
  if (!validLedger(ledger)) {
    return failed(
      "causal-correction-ledger-configuration-invalid",
      "The causal correction ledger must be bounded, canonical, and strictly ordered by correction identity.",
    );
  }
  const validated = validateBrowserCausalCorrectionNotice(notice);
  if (!validated.ok) return validated;
  const correction = validated.value;
  const existing = ledger.corrections.find(
    (candidate) => candidate.sourceTabId === correction.sourceTabId && candidate.sequence === correction.sequence,
  );
  if (existing !== undefined) {
    return sameCorrection(existing, correction)
      ? succeeded(ledger)
      : failed(
          "causal-correction-conflict",
          `Source ${correction.sourceTabId} reused correction sequence ${correction.sequence} with different evidence.`,
        );
  }
  if (ledger.corrections.length >= ledger.maxCorrections) {
    return failed(
      "causal-correction-capacity-exhausted",
      `The causal ledger retained ${ledger.corrections.length.toString()} corrections and will not forget one to admit ${correction.sourceTabId}/${correction.sequence}.`,
      "backpressure",
    );
  }
  return succeeded({
    ...ledger,
    corrections: [...ledger.corrections, correction].sort(compareCorrection),
  });
}

export function foldBrowserCausalCorrections(
  ledger: BrowserCausalCorrectionLedger,
  notices: readonly unknown[],
): BrowserCausalCorrectionLedgerResult<BrowserCausalCorrectionLedger> {
  let current = ledger;
  for (const notice of notices) {
    const admitted = foldBrowserCausalCorrection(current, notice);
    if (!admitted.ok) return admitted;
    current = admitted.value;
  }
  return succeeded(current);
}
