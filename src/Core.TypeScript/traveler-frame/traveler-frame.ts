// TravelerFrame — TS oracle of the causal vector-clock frame. Grown FROM the shared seed
// (golden-vectors.json); F# is the canonical peer (src/Core/TravelerFrame.fs). A frame is a per-actor
// int map; transform = causal-join (pointwise max = LUB); dominates = the semilattice order; converge =
// fold transform to the LUB. Values are int64 in F#/C#; the seed values stay within JS safe-integer range.

export type Frame = Record<string, number>;

const coord = (f: Frame, k: string): number => f[k] ?? 0;

const unionKeys = (a: Frame, b: Frame): string[] => [
  ...new Set([...Object.keys(a), ...Object.keys(b)]),
];

/** The inter-frame transformation: the causal-join (pointwise max over the union of keys). */
export const transform = (a: Frame, b: Frame): Frame => {
  const out: Frame = {};
  for (const k of unionKeys(a, b)) out[k] = Math.max(coord(a, k), coord(b, k));
  return out;
};

/** `a` dominates `b`: a ≥ b on every coordinate of b (the semilattice order). */
export const dominates = (a: Frame, b: Frame): boolean =>
  Object.keys(b).every((k) => coord(a, k) >= b[k]!);

/**
 * `a` and `b` are concurrent (spacelike / causally incomparable): a ‖ b — neither dominates the
 * other, i.e. each has seen something the other has not (a genuine fork). Exactly one of
 * {equal, a▷b, b▷a, a‖b} holds for any pair; this is the last cell. Symmetric and irreflexive.
 * The sole legal gate for spacelike pair-selection (e.g. the CHSH monitor): concurrency is decided
 * by the vector-clock order ONLY, never wall-clock — two observers must classify a pair identically.
 */
export const concurrent = (a: Frame, b: Frame): boolean => !dominates(a, b) && !dominates(b, a);

/** The common frame of a set: fold `transform` from the origin (the LUB). */
export const converge = (frames: readonly Frame[]): Frame => frames.reduce(transform, {} as Frame);
