/**
 * WSet (Weighted Set) - Categorical Tensors over arbitrary *-rings.
 * Based on the August 2026 Multilayer BNN / Factor Graph design.
 */

export interface IStarRing<W> {
  zero: W;
  one: W;
  add(a: W, b: W): W;
  mul(a: W, b: W): W;
  negate(a: W): W;
  conj(a: W): W;
}

export const RealAlgebra: IStarRing<number> = {
  zero: 0,
  one: 1,
  add: (a, b) => a + b,
  mul: (a, b) => a * b,
  negate: (a) => -a,
  conj: (a) => a, // Reals are their own conjugate
};

export type KVPair<K, W> = { key: K; weight: W };

export class WSet<K, W> {
  public readonly ring: IStarRing<W>;
  public readonly entries: KVPair<K, W>[];

  constructor(ring: IStarRing<W>, entries: KVPair<K, W>[]) {
    this.ring = ring;
    this.entries = entries;
  }

  /** Δ fan-out (Comonoid copy) */
  copy(): WSet<[K, K], W> {
    const newEntries = this.entries.map((e) => ({
      key: [e.key, e.key] as [K, K],
      weight: e.weight,
    }));
    return new WSet(this.ring, newEntries);
  }

  /** ε marginalization (Comonoid discard) */
  discard(): W {
    return this.entries.reduce((acc, curr) => this.ring.add(acc, curr.weight), this.ring.zero);
  }

  /** ⊗ Kronecker product (Comonoid tensor) */
  tensor<K2>(other: WSet<K2, W>): WSet<[K, K2], W> {
    const newEntries: KVPair<[K, K2], W>[] = [];
    for (const e1 of this.entries) {
      for (const e2 of other.entries) {
        newEntries.push({
          key: [e1.key, e2.key],
          weight: this.ring.mul(e1.weight, e2.weight),
        });
      }
    }
    return new WSet(this.ring, newEntries);
  }

  /** Filter or aggregate by key equality, returning a normalized / consolidated set. */
  consolidate(): WSet<K, W> {
    const map = new Map<string, W>();
    for (const e of this.entries) {
      const kStr = JSON.stringify(e.key);
      const existing = map.get(kStr);
      if (existing !== undefined) {
        map.set(kStr, this.ring.add(existing, e.weight));
      } else {
        map.set(kStr, e.weight);
      }
    }
    const consolidatedEntries = Array.from(map.entries()).map(([kStr, w]) => ({
      key: JSON.parse(kStr) as K,
      weight: w,
    }));
    return new WSet(this.ring, consolidatedEntries);
  }
}
