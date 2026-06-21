// Tri-boolean core primitive -- the digital qubit cell (B-0944).
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
// non-Byzantine oracles for the "summonable BFT" cross-language consensus (B-0944).
/** True. */
export const T = { s: "T" };
/** False. */
export const F = { s: "F" };
/** Null = held superposition / living uncertainty. Never silently collapsed. */
export const N = { s: "N" };
