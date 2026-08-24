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
import type { WhyContext } from "../../../Core.TypeScript/bayesian/why-chain";

/**
 * The attention field on the wire (D1 of #14503). The per-tile arrays are
 * Float32Arrays whose buffers ride the postMessage TRANSFER LIST — moved,
 * not copied — and they ride the SAME message as the frame they label.
 */
export interface AttentionFramePayload {
  readonly cols: number;
  readonly rows: number;
  /** Predictive variance per tile, row-major — the frost channel. */
  readonly variance: Float32Array;
  /** Posterior mean change-fraction per tile. */
  readonly mean: Float32Array;
  /** Tiles granted full perception this tick (top-K + sweep + instruments). */
  readonly attended: readonly number[];
  /** The fixation tile (bright settle); a move is the saccade (fast sweep). */
  readonly fixation: number | null;
  /** D2 meter: reading-changes over match attempts — or the LOUD flat state. */
  readonly usefulWork: number | "ambiguous";
  /** Measured society belief-similarity (never assumed decorrelated). */
  readonly rho: { readonly mean: number; readonly max: number; readonly pairs: number };
  /** K, displayed per the spec ("a constant, tunable, and displayed"). */
  readonly topK: number;
}

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
  | { readonly type: "KEY_UP"; readonly payload: { readonly key: number } }
  /** D6 (?study=1): freeze the sim at a probe point / release it after. */
  | { readonly type: "PAUSE"; readonly payload: Record<string, never> }
  | { readonly type: "RESUME"; readonly payload: Record<string, never> };

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
  /** The attention field — where the agent is SPENDING perception. */
  readonly attention: AttentionFramePayload | null;
  /**
   * D5: the state that drove this tick's decision. The WHY button's answers
   * are generated FROM THIS OBJECT — the same one the wire carried — so an
   * answer can only cite what the frame actually knew.
   */
  readonly why: WhyContext | null;
}

export interface WorkerToMainMessage {
  readonly type: "FRAME";
  readonly payload: FramePayload;
}
