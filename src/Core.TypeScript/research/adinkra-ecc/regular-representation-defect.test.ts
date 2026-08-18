import { describe, expect, test } from "bun:test";
import {
  PRIMES,
  popcount,
  cliffordSign,
  enumerateCode,
  isDoublyEven,
  isSelfOrthogonal,
  selfOrthogonalBound,
  buildCodedAdinkra,
  algebraDimension,
  edgeGroupOrder,
  freeOverSubalgebra,
  enumerateDoublyEvenCodes,
  cliffordRelationsHold,
  signedCodeGroup,
} from "./regular-representation-defect";

const P = PRIMES[0];
const SIGS = [1, -1] as const;

/** The [8,4,4] extended Hamming generator, transcribed from `src/Core/AdinkraCode.fs`. */
const EXT_HAMMING_8_4_4_ROWS = [
  [1, 0, 0, 0, 0, 1, 1, 1],
  [0, 1, 0, 0, 1, 0, 1, 1],
  [0, 0, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 1, 1, 1, 1, 0],
];
const EXT_HAMMING_MASKS = EXT_HAMMING_8_4_4_ROWS.map((r) => r.reduce((acc, b, i) => acc | (b << i), 0));

describe("Clifford bookkeeping (the substrate the two routes both stand on)", () => {
  test("gamma_i squares to the signature", () => {
    expect(cliffordSign(1, 1, -1)).toBe(-1);
    expect(cliffordSign(1, 1, 1)).toBe(1);
  });
  test("distinct generators anticommute", () => {
    expect(cliffordSign(0b01, 0b10, -1)).toBe(1);
    expect(cliffordSign(0b10, 0b01, -1)).toBe(-1);
  });
});

describe("the code side", () => {
  test("the AdinkraCode.fs generator is the [8,4,4] doubly-even self-dual code", () => {
    const code = enumerateCode(EXT_HAMMING_MASKS);
    expect(code.length).toBe(16);
    expect(isDoublyEven(code)).toBe(true);
    expect(isSelfOrthogonal(code)).toBe(true);
    expect(EXT_HAMMING_MASKS.length).toBe(selfOrthogonalBound(8)); // k = N/2: the self-dual point
    const weights = code.map(popcount).sort((a, b) => a - b);
    expect(weights.filter((w) => w === 4).length).toBe(14);
    expect(weights.filter((w) => w === 8).length).toBe(1);
  });
});

describe("the construction is an ADINKRA before any rank is measured", () => {
  test.each([...SIGS])(
    "L_I L_J + L_J L_I = 2 delta_IJ * square * Id, signature %d",
    (square) => {
      for (let n = 1; n <= 8; n++) {
        for (const gens of enumerateDoublyEvenCodes(n)) {
          expect(cliffordRelationsHold(buildCodedAdinkra(n, gens, square), square)).toBe(true);
        }
      }
    },
    120_000,
  );
});

describe("the signed code group (what makes the projector e nonzero)", () => {
  test("it is a genuine character: a homomorphism into +/-1, never hitting -1 at a codeword", () => {
    for (const square of SIGS) {
      for (let n = 1; n <= 8; n++) {
        for (const gens of enumerateDoublyEvenCodes(n)) {
          const eps = signedCodeGroup(gens, square); // throws if -1 is reachable
          expect(eps.size).toBe(1 << gens.length); // order 2^k, so e = prod (1+eps c)/2 != 0
          expect(eps.get(0)).toBe(1);
          for (const v of eps.values()) expect(Math.abs(v)).toBe(1);
        }
      }
    }
  }, 60_000);

  test("eps is genuinely nontrivial — it is not a constant dressed up as a correction", () => {
    // n=6, generators 001111 and 110011: their product is -gamma_{111100}.
    const eps = signedCodeGroup([0b001111, 0b110011], -1);
    expect(eps.get(0b111100)).toBe(-1);
  });
});

describe("THE VERDICT — no nontrivial code preserves rank-1 freeness", () => {
  // Route A (algebra dimension, from the matrices) vs Route V (module dimension, from the
  // cosets). Disjoint procedures; the equality below is a prediction that can fail.
  test.each([...SIGS])(
    "exhaustive over every doubly-even code of length <= 8, signature %d",
    (square) => {
      let checked = 0;
      for (let n = 1; n <= 8; n++) {
        for (const gens of enumerateDoublyEvenCodes(n)) {
          const a = buildCodedAdinkra(n, gens, square);
          const dimA = algebraDimension(a, P); // Route A
          const dimM = a.reps.length; // Route V
          const codeIndex = a.code.length;
          expect(dimA).toBe(1 << n); // the representation is FAITHFUL
          expect(dimA / dimM).toBe(codeIndex); // the defect IS the code index
          expect(dimA === dimM).toBe(gens.length === 0); // free of rank 1 <=> k = 0
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(1000);
    },
    120_000,
  );

  test("the two primes agree (the F_p rank is a lower bound; the target is the maximum)", () => {
    const a = buildCodedAdinkra(8, EXT_HAMMING_MASKS, -1);
    for (const p of PRIMES) expect(algebraDimension(a, p)).toBe(256);
  });

  test("the code does not shrink the operator GROUP either: |G| = 2^(N+1) at every k", () => {
    for (let n = 4; n <= 8; n++) {
      for (const gens of enumerateDoublyEvenCodes(n)) {
        expect(edgeGroupOrder(buildCodedAdinkra(n, gens, -1))).toBe(1 << (n + 1));
      }
    }
  }, 120_000);

  test("self-dual is the WORST case, not the rescue: A = End(M) there", () => {
    const a = buildCodedAdinkra(8, EXT_HAMMING_MASKS, -1);
    const dimM = a.reps.length;
    expect(dimM).toBe(16);
    expect(algebraDimension(a, P)).toBe(dimM * dimM); // A is the full matrix algebra
    // ...so M is IRREDUCIBLE, which is the maximal distance from a regular representation.
  });
});

describe("the verdict does not depend on the choice of coset representatives", () => {
  test("several representative-scan seeds: same relations, same defect", () => {
    let compared = 0,
      signsDiffered = 0;
    for (let n = 4; n <= 8; n++) {
      for (const gens of enumerateDoublyEvenCodes(n)) {
        if (gens.length === 0) continue;
        const base = buildCodedAdinkra(n, gens, -1, 0);
        const baseDim = algebraDimension(base, P);
        for (const seed of [1, 5, (1 << n) - 1]) {
          const alt = buildCodedAdinkra(n, gens, -1, seed);
          expect(cliffordRelationsHold(alt, -1)).toBe(true);
          expect(alt.reps.length).toBe(base.reps.length);
          expect(algebraDimension(alt, P)).toBe(baseDim);
          compared++;
          for (let i = 0; i < n; i++) {
            const x = alt.L[i],
              y = base.L[i];
            if (x === undefined || y === undefined) continue;
            if (x.sign.some((v, j) => v !== y.sign[j])) {
              signsDiffered++;
              break;
            }
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(1000);
    expect(signsDiffered).toBeGreaterThan(0); // the alternatives really are different data
  }, 200_000);
});

describe("THE POSITIVE RESIDUE — free of rank 1 over a Cl(0,N-k) subalgebra", () => {
  test("free over Cl(0,T) exactly when no nonzero codeword is supported inside T", () => {
    let tested = 0;
    for (const square of SIGS) {
      for (let n = 1; n <= 7; n++) {
        for (const gens of enumerateDoublyEvenCodes(n)) {
          const a = buildCodedAdinkra(n, gens, square);
          const k = gens.length;
          for (let m = 0; m < 1 << n; m++) {
            if (popcount(m) !== n - k) continue;
            const T = [...Array(n).keys()].filter((i) => (m >> i) & 1);
            const free = freeOverSubalgebra(a, T, P) === a.reps.length;
            const clean = !a.code.some((c) => c !== 0 && (c & ~m) === 0);
            expect(free).toBe(clean);
            tested++;
          }
        }
      }
    }
    expect(tested).toBeGreaterThan(1000);
  }, 120_000);

  test("a subalgebra of the wrong size is never free of rank 1", () => {
    for (let n = 4; n <= 6; n++) {
      for (const gens of enumerateDoublyEvenCodes(n)) {
        const a = buildCodedAdinkra(n, gens, -1);
        for (let m = 0; m < 1 << n; m++) {
          const sz = popcount(m);
          if (sz === n - gens.length) continue;
          const T = [...Array(n).keys()].filter((i) => (m >> i) & 1);
          const surjective = freeOverSubalgebra(a, T, P) === a.reps.length;
          const injective = 1 << sz === a.reps.length;
          expect(surjective && injective).toBe(false);
        }
      }
    }
  }, 120_000);

  test("[8,4]: 56 of the 70 four-colour subalgebras work — the 14 failures carry a codeword", () => {
    const a = buildCodedAdinkra(8, EXT_HAMMING_MASKS, -1);
    let good = 0;
    for (let m = 0; m < 256; m++) {
      if (popcount(m) !== 4) continue;
      if (
        freeOverSubalgebra(
          a,
          [...Array(8).keys()].filter((i) => (m >> i) & 1),
          P,
        ) === 16
      )
        good++;
    }
    expect(good).toBe(56);
    expect(70 - good).toBe(a.code.filter((c) => popcount(c) === 4).length);
  });
});

describe("the N=4 quotient graph — the failed correction, pinned so it cannot recur", () => {
  test("(Z/2)^4 / d4 is the folded 4-cube K_4,4: 4-regular, bipartite 4+4, complete across", () => {
    const a = buildCodedAdinkra(4, [0b1111], -1);
    expect(a.reps.length).toBe(8);
    const nbr = a.reps.map((_, v) => new Set(a.L.map((op) => op.to[v])));
    for (const s of nbr) expect(s.size).toBe(4);
    const part = a.reps.map((r) => popcount(r) % 2);
    expect(part.filter((x) => x === 0).length).toBe(4);
    expect(part.filter((x) => x === 1).length).toBe(4);
    for (let v = 0; v < 8; v++) for (let w = 0; w < 8; w++) if (part[v] !== part[w]) expect(nbr[v]?.has(w)).toBe(true);
  });
});

describe("THE GAP — the code identifies operators at the BASE POINT, never as OPERATORS", () => {
  test("N=4 / d4: L_4 and L_1L_2L_3 agree on e and disagree on half the module", () => {
    const a = buildCodedAdinkra(4, [0b1111], -1);
    const dim = a.reps.length;
    const apply = (cols: number[], seed: number): number[] => {
      let v = new Int32Array(dim);
      v[seed] = 1;
      for (const c of cols) {
        const op = a.L[c];
        if (op === undefined) throw new Error(`no colour ${c}`);
        const w = new Int32Array(dim);
        for (let j = 0; j < dim; j++) {
          const vj = v[j] ?? 0;
          if (vj !== 0) w[op.to[j] ?? 0] = (w[op.to[j] ?? 0] ?? 0) + (op.sign[j] ?? 0) * vj;
        }
        v = w;
      }
      return [...v];
    };
    const base = a.repOf[0] ?? 0;
    expect(apply([3], base)).toEqual(apply([2, 1, 0], base)); // base-point identity: holds
    let differ = 0;
    for (let b = 0; b < dim; b++) {
      if (JSON.stringify(apply([3], b)) !== JSON.stringify(apply([2, 1, 0], b))) differ++;
    }
    expect(differ).toBe(dim / 2); // operator identity: fails, on exactly half the module
  });
});
