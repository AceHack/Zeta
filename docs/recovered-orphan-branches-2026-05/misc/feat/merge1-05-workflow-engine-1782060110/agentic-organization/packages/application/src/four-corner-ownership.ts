/**
 * Four-corner ownership — the asymmetric-authorship primitive.
 *
 * Faithful port of `src/Core.TypeScript/workflow-engine/types.ts`
 * `FourCornerOwnership` (Merge1 §05).
 *
 * Per the asymmetric-authorship rule:
 *   - TIn          — caller authors; flows caller   → function
 *   - TOut         — function produces; flows function → caller (value-branch)
 *   - TOutFeedback — function authors; flows function → caller (control-flow signals)
 *   - TInFeedback  — CO-OWNED (both caller AND function contribute variants)
 *
 * The substrate-entity (action, state, channel) AUTHORS its own
 * TOutFeedback discriminator-channel; the caller ACKNOWLEDGES it.
 */
export interface FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback> {
  readonly tIn: TIn;
  readonly tOut?: TOut;
  readonly tOutFeedback?: TOutFeedback;
  readonly tInFeedback?: TInFeedback;
}

/**
 * Construct a four-corner ownership from just the caller-authored input.
 * The function-authored corners (tOut / tOutFeedback) and the co-owned
 * corner (tInFeedback) are filled in as the cycle progresses.
 */
export function ownershipFromInput<TIn, TOut = never, TOutFeedback = string, TInFeedback = string>(
  tIn: TIn,
): FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback> {
  return { tIn };
}

/**
 * The substrate-entity authors the value-branch (TOut) + its control-flow
 * feedback channel (TOutFeedback), acknowledging the caller's input.
 * Returns a NEW ownership (immutable — retraction-native).
 */
export function authorOutput<TIn, TOut, TOutFeedback, TInFeedback>(
  ownership: FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>,
  tOut: TOut,
  tOutFeedback: TOutFeedback,
): FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback> {
  return { ...ownership, tOut, tOutFeedback };
}

/**
 * The caller acknowledges the function's feedback by contributing to the
 * co-owned corner (TInFeedback). Returns a NEW ownership (immutable).
 */
export function acknowledgeFeedback<TIn, TOut, TOutFeedback, TInFeedback>(
  ownership: FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>,
  tInFeedback: TInFeedback,
): FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback> {
  return { ...ownership, tInFeedback };
}
