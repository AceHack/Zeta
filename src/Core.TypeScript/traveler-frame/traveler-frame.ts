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
  Object.keys(b).every((k) => coord(a, k) >= b[k]);

/** The common frame of a set: fold `transform` from the origin (the LUB). */
export const converge = (frames: readonly Frame[]): Frame => frames.reduce(transform, {} as Frame);
