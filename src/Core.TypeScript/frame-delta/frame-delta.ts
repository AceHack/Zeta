// FrameDelta — TS oracle (#? of TS/F#/C#/Rust) of the traveler-frame transformation group.
// Grown FROM the shared seed (golden-vectors.json); F# is the canonical peer (src/Core/FrameDelta.fs).
// Frames and deltas are per-actor int maps; deltas are normalized (zero shifts dropped); apply keeps
// zero coordinates (the union of keys). Values are int64 in F#/C#; the seed values stay within JS
// safe-integer range, so `number` agrees.

export type FrameMap = Record<string, number>;

const get = (m: FrameMap, k: string): number => m[k] ?? 0;

const unionKeys = (a: FrameMap, b: FrameMap): string[] => [
  ...new Set([...Object.keys(a), ...Object.keys(b)]),
];

const normalize = (m: FrameMap): FrameMap => {
  const out: FrameMap = {};
  for (const k of Object.keys(m)) {
    const value = m[k]!;
    if (value !== 0) out[k] = value;
  }
  return out;
};

/** Compose two transformations (the group op): pointwise add, normalized. */
export const compose = (a: FrameMap, b: FrameMap): FrameMap => {
  const out: FrameMap = {};
  for (const k of unionKeys(a, b)) out[k] = get(a, k) + get(b, k);
  return normalize(out);
};

/** The group inverse: negate every shift. */
export const inverse = (d: FrameMap): FrameMap => {
  const out: FrameMap = {};
  for (const k of Object.keys(d)) out[k] = -d[k]!;
  return normalize(out);
};

/** The transformation taking frame `from` to `to`: per-actor (to − from). */
export const between = (from: FrameMap, to: FrameMap): FrameMap => {
  const out: FrameMap = {};
  for (const k of unionKeys(from, to)) out[k] = get(to, k) - get(from, k);
  return normalize(out);
};

/** Apply a transformation to a frame (group action by translation); keeps zero coordinates. */
export const apply = (delta: FrameMap, frame: FrameMap): FrameMap => {
  const out: FrameMap = {};
  for (const k of unionKeys(delta, frame)) out[k] = get(frame, k) + get(delta, k);
  return out;
};

/** The L1 magnitude of a transformation: total absolute shift. */
export const magnitude = (d: FrameMap): number =>
  Object.values(d).reduce((s, v) => s + Math.abs(v), 0);

/** The range between two frames: the L1 distance of their offset. */
export const distance = (from: FrameMap, to: FrameMap): number => magnitude(between(from, to));
