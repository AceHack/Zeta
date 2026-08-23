/**
 * protocol.ts — the typed worker ⟷ main message contract.
 *
 * Every payload that crosses `postMessage` is named here, once, so the two
 * sides cannot drift apart silently. The untyped `e.data` destructuring this
 * replaces was 84 unsafe-`any` accesses across the app — a class the root
 * `lint (TS)` job cannot surface because it type-checks these files under
 * the ROOT project's settings, not the app's own (see
 * workitems/081M0QF7ZVY087G0R003Q4Q18D-*).
 */
import type { ArenaReadout } from "../../../Core.TypeScript/observe/observe";

/** main → worker. */
export type MainToWorkerMessage =
  | {
      readonly type: "INIT";
      readonly payload: { readonly apiKey: string | null; readonly baseUrl: string | null };
    }
  | {
      readonly type: "INJECT_EPIGENETIC_MATERIAL";
      readonly payload: { readonly buffer: ArrayBuffer };
    }
  | { readonly type: "KEY_DOWN"; readonly payload: { readonly key: number } }
  | { readonly type: "KEY_UP"; readonly payload: { readonly key: number } };

/**
 * worker → main: one frame per tick. Everything the overlay labels rides on
 * the SAME message as the pixels it labels — a second channel would be a
 * second clock, and a chance for the overlay to disagree with its frame.
 */
export interface FramePayload {
  readonly kind: "chip8-frame";
  readonly display: readonly number[];
  readonly cycle: number;
  readonly keys: readonly boolean[];
  readonly keyPredictions: Readonly<Record<number, number>>;
  /** The committed (CMYK) key this tick, −1 when none. */
  readonly chosenKey: number;
  /** Forced-perception readout: tracks, roles, mode, OCR, intent vector. */
  readonly arena: ArenaReadout | null;
}

export interface WorkerToMainMessage {
  readonly type: "FRAME";
  readonly payload: FramePayload;
}
