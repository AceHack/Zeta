/**
 * society-rho.ts — measured decorrelation between society members.
 *
 * Aaron's constraint on the arena page (2026-08-23, #14503 §4): "don't
 * assume the swarm is decorrelated because the agents were built
 * separately — measure ρ and display it." Adversarial examples transfer
 * between independently trained models (Szegedy 2014; Papernot 2016;
 * Liu 2017) — that is measured ρ→1 between independently constructed
 * observers, and a swarm that has collapsed to one agent in N masks looks
 * exactly like a working swarm from outside.
 *
 * What is measured here, stated precisely so the number cannot be read as
 * more than it is: the MEAN PAIRWISE PEARSON CORRELATION of the members'
 * belief-mean vectors (per-key μ). It is belief-similarity, not
 * error-correlation — the members share every observation by construction
 * (same screen), so some positive ρ is expected; what the display exists
 * to catch is ρ ≈ 1 (the members have become copies and the ensemble is
 * one vote in N costumes) and its drift over time.
 */

export interface SocietyRho {
  /** Mean pairwise Pearson r over member belief vectors, in [-1, 1]. */
  readonly mean: number;
  /** The single highest pairwise r (the closest pair — collapse shows here first). */
  readonly max: number;
  readonly pairs: number;
}

/** Pearson correlation of two equal-length vectors; 0 for degenerate input. */
export function pearson(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < n; i++) {
    sa += a[i] ?? 0;
    sb += b[i] ?? 0;
  }
  const ma = sa / n;
  const mb = sb / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const da = (a[i] ?? 0) - ma;
    const db = (b[i] ?? 0) - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va <= 0 || vb <= 0) return 0;
  return cov / Math.sqrt(va * vb);
}

/**
 * Mean and max pairwise correlation across society members' belief vectors.
 * Fewer than two members (or empty vectors) → ρ reported as 0 over 0 pairs:
 * a degenerate society has no ensemble to decorrelate.
 */
export function societyRho(memberBeliefs: readonly (readonly number[])[]): SocietyRho {
  let sum = 0;
  let max = -1;
  let pairs = 0;
  for (let i = 0; i < memberBeliefs.length; i++) {
    for (let j = i + 1; j < memberBeliefs.length; j++) {
      const r = pearson(memberBeliefs[i] ?? [], memberBeliefs[j] ?? []);
      sum += r;
      if (r > max) max = r;
      pairs += 1;
    }
  }
  return pairs === 0 ? { mean: 0, max: 0, pairs: 0 } : { mean: sum / pairs, max, pairs };
}
