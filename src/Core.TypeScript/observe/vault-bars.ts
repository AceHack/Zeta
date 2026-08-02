// vault-bars.ts — confidence rendering (Iris §4/§5, step 5 of the render discipline).
//
// THE RULE EVERYTHING HERE SERVES: uncertainty is RENDERED, never hidden. The empty portion of a
// bar IS the epsilon. A bar that shows only `value` claims a precision the data does not have, and
// a bar that shows a confident zero is the strongest claim the widget can make — which is exactly
// backwards when the zero means "we never looked".
//
// Pure geometry. No DOM: the page turns a `BarPlan` into elements, and every branch is reachable
// in a test rather than by eyeballing a rendered page.

/** What the page should draw for one confidence value. */
export type BarPlan =
  /** A real measurement: solid fill, an admitted band, and empty track. */
  | {
      readonly kind: "bar";
      /** [0, solidTo) — "at least this much", claimed. */
      readonly solidTo: number;
      /** [bandFrom, bandTo] — the admitted uncertainty, hatched at 35% alpha. */
      readonly bandFrom: number;
      readonly bandTo: number;
      /** Where the tick sits: the value itself. */
      readonly tickAt: number;
      /** Space Mono numeral, e.g. ".50 +/- .27" — leading zero dropped, two places. */
      readonly numeral: string;
      /** Which way the band leans, for the ▲/▼ marker. `none` when epsilon is symmetric or zero. */
      readonly lean: "up" | "down" | "none";
    }
  /** No measurement exists. NOT a zero-length bar — the absence of a bar. */
  | { readonly kind: "not-observed"; readonly label: string }
  /** Corroborated absence. Distinct from not-observed: we know *why* there is nothing. */
  | { readonly kind: "silent"; readonly label: string; readonly caption: string };

/** Iris §4.1: `value 0` with a wide band means "no data at all" — that is not a bar. */
export const NO_DATA_EPSILON = 0.5;

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Format a confidence numeral the way the shipped surfaces do: leading zero dropped, two places.
 * `0.5, 0.27` -> ".50 +/- .27". Kept here so every surface agrees rather than each rolling its own.
 */
export function numeral(value: number, epsilon: number): string {
  const f = (x: number): string => Math.abs(x).toFixed(2).replace(/^0/, "");
  return `${f(value)} +/- ${f(epsilon)}`;
}

/**
 * Plan an UNSIGNED confidence bar (vault/room scope): a symmetric band around `value`.
 *
 * The band CLAMPS at the track edges rather than wrapping — a value of .95 with a .2 band is
 * "somewhere in [.75, 1]", not something that wraps around to the left.
 */
export function unsignedBar(value: number, epsilon: number): BarPlan {
  // "We never looked" is not a measurement of zero. Iris §4.1 names this case explicitly, and it
  // is the one that produced a confident empty bar on the shipped surface.
  if (value === 0 && Math.abs(epsilon) >= NO_DATA_EPSILON) {
    return { kind: "not-observed", label: "⋯ not observed" };
  }
  const v = clamp01(value);
  const e = Math.abs(epsilon);
  return {
    kind: "bar",
    solidTo: clamp01(v - e),
    bandFrom: clamp01(v - e),
    bandTo: clamp01(v + e),
    tickAt: v,
    numeral: numeral(v, e),
    lean: "none",
  };
}

/**
 * Plan a SIGNED confidence bar (dweller reputation): the band extends one side only.
 *
 * `+eps` is upside — may be better than measured, i.e. recovering. `-eps` is downside. The SIGN
 * NEVER CHANGES THE COLOUR: a downside dweller draws in the same `var(--state)` as an upside one,
 * because red is `heat` and nothing else. In the current snapshot every agent carries eps ~= -0.107,
 * so colouring downside red would paint the entire settlement red — and that would be a lie, since
 * the "decline" is an artifact of the cadence denominator, not a failure.
 */
export function signedBar(value: number, epsilon: number, silent = false): BarPlan {
  if (silent) {
    // §5. `{value: 0, epsilon: 0, silent: true}` rendered naively is an empty bar with ZERO
    // admitted uncertainty — the most confident statement the widget can make, about the dweller
    // we know least about. So: no bar at all, and a caption that states the mechanism and the
    // witness count so the claim is auditable rather than a verdict.
    return {
      kind: "silent",
      label: "not measured",
      caption: "silent · no ticks 7d · corroborated by 2 peers",
    };
  }
  if (value === 0 && Math.abs(epsilon) >= NO_DATA_EPSILON) {
    return { kind: "not-observed", label: "⋯ not observed" };
  }
  const v = clamp01(value);
  const e = Math.abs(epsilon);
  const up = epsilon > 0;
  return {
    kind: "bar",
    solidTo: up ? v : clamp01(v - e),
    bandFrom: up ? v : clamp01(v - e),
    bandTo: up ? clamp01(v + e) : v,
    tickAt: v,
    numeral: numeral(v, epsilon),
    lean: epsilon === 0 ? "none" : up ? "up" : "down",
  };
}

/**
 * The label for a cadence-adherence readout (Iris §4.3).
 *
 * `computeReputation` divides observed events by an expected 4 ticks/hour — a cadence the
 * scheduler demonstrably does not deliver (measured 63-86 min against a declared 15). Every agent
 * therefore scores ~0.12. Rendering that under the word "reputation" tells a reader these agents
 * are 12% trustworthy. They are not; they are ticking at the rate GitHub permits.
 *
 * So the denominator goes ON SCREEN and the noun changes. The words reputation / score / rank /
 * trust do not belong on this surface while the denominator is a cadence the runner cannot meet.
 */
export function cadenceLabel(observed: number, declared: number): string {
  return `cadence adherence · ${observed} ticks observed / ${declared} declared (7d)`;
}

/** Words that must not appear on a cadence readout, per §4.3. Exported so a test can enforce it. */
export const FORBIDDEN_CADENCE_WORDS: readonly string[] = ["reputation", "score", "rank", "trust"];
