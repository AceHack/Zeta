/**
 * Seeded PRNG — the only entropy source any model in this package may use.
 *
 * Discipline #13 (noninterference): entropy enters through a declared, metered
 * channel and nowhere else. `Math.random()` is an ambient source — it cannot be
 * replayed, so a run using it is not a DST run and a "the BNN beat the forest"
 * claim built on it cannot be reproduced by anyone, including its author.
 * Every model here takes a seed and threads this generator explicitly.
 *
 * mulberry32 — public-domain 32-bit generator (Tommy Ettinger). Chosen for
 * being short enough to audit by eye and identical across engines; it is not a
 * cryptographic generator and nothing here needs one.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n: number) => Math.floor(next() * n) % n };
}

/** In-place Fisher-Yates using the supplied generator. */
export function shuffle<T>(xs: T[], rng: Rng): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}
