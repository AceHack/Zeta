import {
  BROWSER_CAUSAL_CORRECTION_LEDGER_SCHEMA,
  type BrowserCausalCorrectionLedger,
  type BrowserCausalCorrectionLedgerFeedback,
} from "../browser-node/browser-causal-correction-ledger";
import type { BrowserCausalCorrectionNotice } from "../browser-node/browser-tab-coordinator";

export const DARK_HALL_CAUSAL_READOUT_SCHEMA = "zeta.darkhall.causal-readout.v2" as const;
export const DARK_HALL_CAUSAL_HANDOFF_READOUT_SCHEMA = "zeta.darkhall.causal-handoff-readout.v1" as const;

export interface DarkHallCausalReadout {
  readonly schema: typeof DARK_HALL_CAUSAL_READOUT_SCHEMA;
  readonly sourceSchema: typeof BROWSER_CAUSAL_CORRECTION_LEDGER_SCHEMA;
  readonly executionDirection: "forward-only";
  readonly appendOnly: true;
  readonly rewritesHistory: false;
  readonly maxCorrections: number;
  readonly remainingCapacity: number;
  readonly admission: "open" | "backpressure";
  readonly corrections: readonly BrowserCausalCorrectionNotice[];
  readonly feedback: BrowserCausalCorrectionLedgerFeedback | null;
}

export interface DarkHallCausalHandoffState {
  readonly status: "idle" | "offered" | "received" | "duplicate" | "backpressured" | "heat";
  readonly direction: "none" | "outbound" | "inbound";
  readonly peerTabId: string | null;
  readonly correctionCount: number;
  readonly admittedCorrections: number;
  readonly feedback: BrowserCausalCorrectionLedgerFeedback | null;
}

export interface DarkHallCausalHandoffReadout extends DarkHallCausalHandoffState {
  readonly schema: typeof DARK_HALL_CAUSAL_HANDOFF_READOUT_SCHEMA;
  readonly localTabId: string;
  readonly maxCorrections: number;
}

/** Project the latest bounded peer exchange without claiming delivery beyond the observed edge. */
export function darkHallCausalHandoffReadout(
  localTabId: string,
  maxCorrections: number,
  state: DarkHallCausalHandoffState,
): DarkHallCausalHandoffReadout {
  return {
    schema: DARK_HALL_CAUSAL_HANDOFF_READOUT_SCHEMA,
    localTabId,
    maxCorrections,
    ...state,
    feedback: state.feedback === null ? null : { ...state.feedback },
  };
}

/** Project private ledger state into an immutable, source-attributed UI value. */
export function darkHallCausalReadout(
  ledger: BrowserCausalCorrectionLedger,
  feedback: BrowserCausalCorrectionLedgerFeedback | null = null,
): DarkHallCausalReadout {
  const remainingCapacity = Math.max(0, ledger.maxCorrections - ledger.corrections.length);
  return {
    schema: DARK_HALL_CAUSAL_READOUT_SCHEMA,
    sourceSchema: BROWSER_CAUSAL_CORRECTION_LEDGER_SCHEMA,
    executionDirection: "forward-only",
    appendOnly: true,
    rewritesHistory: false,
    maxCorrections: ledger.maxCorrections,
    remainingCapacity,
    admission: remainingCapacity === 0 ? "backpressure" : "open",
    corrections: ledger.corrections.map((correction) => ({ ...correction })),
    feedback: feedback === null ? null : { ...feedback },
  };
}
