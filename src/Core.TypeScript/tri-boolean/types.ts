// Tri-boolean core primitive -- the digital qubit cell (081KSV2WD0008QG0R00051XS0N).
//
// Three-valued state: True | False | Null. Null is the HELD living-uncertainty
// (superposition) state -- it is never silently collapsed. measure() is the only
// collapsing operation, and collapsing a living (Null) cell is surfaced as feedback
// rather than performed silently (asymmetric-authorship / Result<T, TFeedback>).
//
// Spec source: memory/mika/conversations/2026-05-30-mika-grok-driver-swap-arc-
//   ...-uncertainty-in-priors-aaron-forwarded.md (batch 6).
// Composes: .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md
//   + .claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-...md.
//
// This is the TS (distribution) implementation. F#/C#/Rust parity impls are the other
// non-Byzantine oracles for the "summonable BFT" cross-language consensus (081KSV2WD0008QG0R00051XS0N).

/** The three-valued state. 'N' (Null) is the held / superposed living-uncertainty state. */
export type Tri = { readonly s: "T" } | { readonly s: "F" } | { readonly s: "N" };

/** True. */
export const T: Tri = { s: "T" };
/** False. */
export const F: Tri = { s: "F" };
/** Null = held superposition / living uncertainty. Never silently collapsed. */
export const N: Tri = { s: "N" };

/** Feedback surfaced when measure() is asked to collapse a living (Null) cell -- the
 *  forbidden move, surfaced rather than silently performed. */
export type CollapseFeedback = { readonly reason: "collapsed-living-uncertainty" };

/** Result of measure(): Ok(boolean) for already-certain cells; Err(feedback) when asked
 *  to collapse a living (Null) cell. */
export type MeasureResult =
  | { readonly ok: true; readonly value: boolean }
  | { readonly ok: false; readonly feedback: CollapseFeedback };
