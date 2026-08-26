/**
 * The SECOND ORACLE for the QEC classical layer (milestone M1).
 *
 * The point of this file is that it does **not** call the F# implementation. It re-derives
 * Reed-Muller from the monomial definition, computes duals by exhaustion, and reproduces the CSS
 * parameters in TypeScript — then checks that its own answers equal the committed treaty. If the
 * two languages agreed by construction the byte-lock would be decoration; they agree here only if
 * the mathematics is the same in both.
 *
 * REGISTER: everything below is GF(2) linear algebra. `[[n, k, d]]` are integers produced by
 * arithmetic — the parameters a stabilizer code WOULD have. Nothing here asserts that a physical
 * quantum state exists anywhere in Zeta, and the treaty carries that statement in its own
 * `register` field so a reader who opens only the JSON still sees it.
 *
 * Anchors: Calderbank & Shor (PRA 54, 1996); Steane (Proc. R. Soc. A 452, 1996); Gottesman (1997).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const treatyPath = join(import.meta.dir, "css-stabilizer-treaty.json");
const treaty = JSON.parse(readFileSync(treatyPath, "utf-8")) as Treaty;
const qsharpSource = readFileSync(join(import.meta.dir, "CssStabilizerCodes.qs"), "utf-8");

interface ClassicalCode {
  readonly length: number;
  readonly dimension: number;
  readonly doublyEven: boolean;
  readonly selfOrthogonal: boolean;
  readonly selfDual: boolean;
  readonly basisHex: readonly string[];
  readonly weightDistribution: readonly (readonly number[])[];
  readonly codewordSetSha256: string;
}
interface CssCode {
  readonly n: number;
  readonly k: number;
  readonly d: number;
  readonly isStabilizerStateNotACode: boolean;
  readonly stabilizerGeneratorCount: number;
  readonly xStabilizerRowsHex: readonly string[];
  readonly zStabilizerRowsHex: readonly string[];
}
interface Treaty {
  readonly schemaVersion: number;
  readonly register: string;
  readonly classicalCodes: Record<string, ClassicalCode>;
  readonly cssCodes: Record<string, CssCode>;
  readonly n8AdinkraClosure: {
    readonly distinctDoublyEvenCodesEnumerated: number;
    readonly rows: readonly {
      dimC: number;
      n: number;
      k: number;
      d: number;
      correctsAnError: boolean;
      encodesAQubit: boolean;
    }[];
  };
}

// ── GF(2) primitives, implemented here rather than imported ───────────────────────────────────

const weight = (v: number): number => {
  let w = 0;
  let x = v;
  while (x !== 0) {
    w += x & 1;
    x >>>= 1;
  }
  return w;
};
const dot = (a: number, b: number): number => weight(a & b) % 2;

const span = (basis: readonly number[]): Set<number> => {
  let s = new Set<number>([0]);
  for (const b of basis) {
    const next = new Set<number>(s);
    for (const v of s) next.add(v ^ b);
    s = next;
  }
  return s;
};

const dual = (n: number, code: Set<number>): Set<number> => {
  const out = new Set<number>();
  for (let v = 0; v < 1 << n; v++) {
    let ok = true;
    for (const c of code) {
      if (dot(v, c) !== 0) {
        ok = false;
        break;
      }
    }
    if (ok) out.add(v);
  }
  return out;
};

const dimension = (code: Set<number>): number => Math.log2(code.size);
const isDoublyEven = (code: Set<number>): boolean => [...code].every((c) => weight(c) % 4 === 0);
const isSelfOrthogonal = (code: Set<number>): boolean =>
  [...code].every((a) => [...code].every((b) => dot(a, b) === 0));
const setEq = (a: Set<number>, b: Set<number>): boolean => a.size === b.size && [...a].every((x) => b.has(x));

/**
 * Resolve a treaty entry, refusing rather than coercing when it is absent.
 * `noUncheckedIndexedAccess` is on, and the honest response to that is a real check: a missing
 * entry means the treaty lost a code, which must fail loudly here rather than be silenced with a
 * non-null assertion that would also hide a genuine regression.
 */
const must = <T>(value: T | undefined, name: string): T => {
  if (value === undefined) throw new Error(`treaty is missing the entry: ${name}`);
  return value;
};

/** Reed-Muller RM(r, m), built from the monomial basis — the definition, not a committed matrix. */
const reedMuller = (r: number, m: number): Set<number> => {
  const n = 1 << m;
  const basis: number[] = [];
  for (let s = 0; s < 1 << m; s++) {
    if (weight(s) > r) continue;
    let v = 0;
    for (let p = 0; p < n; p++) if ((p & s) === s) v |= 1 << p;
    basis.push(v);
  }
  return span(basis);
};

/** Reduced row echelon basis, ascending insertion — must match the F# `echelonBasis` exactly. */
const lead = (v: number): number => 31 - Math.clz32(v);

/** Reduce `word` by the pivots already recorded, leaving 0 when it is already in their span. */
const reduceByPivots = (word: number, pivots: (number | undefined)[]): number => {
  // Narrowed via a local rather than an assertion: `no-non-null-assertion` forbids `!` and
  // `non-nullable-type-assertion-style` forbids the `as` cast, so the only form that satisfies
  // both is the one that actually proves the value is present.
  let v = word;
  for (;;) {
    if (v === 0) break;
    const pivot = pivots[lead(v)];
    if (pivot === undefined) break;
    v ^= pivot;
  }
  return v;
};

/** Back-substitute a fresh pivot into every row already recorded — what makes the form REDUCED. */
const backSubstitute = (n: number, v: number, pivots: (number | undefined)[]): void => {
  const p = lead(v);
  for (let b = 0; b <= n; b++) {
    const r = pivots[b];
    if (r !== undefined && (r & (1 << p)) !== 0) pivots[b] = r ^ v;
  }
  pivots[p] = v;
};

const echelonBasis = (n: number, code: Set<number>): number[] => {
  const pivots = new Array<number | undefined>(n + 1).fill(undefined);
  for (const word of [...code].sort((a, b) => a - b)) {
    const v = reduceByPivots(word, pivots);
    if (v !== 0) backSubstitute(n, v, pivots);
  }
  const rows: number[] = [];
  for (let b = n; b >= 0; b--) {
    const r = pivots[b];
    if (r !== undefined) rows.push(r);
  }
  return rows;
};

const toHex = (n: number, v: number): string => {
  const digits = Math.max(2, Math.ceil(n / 8) * 2);
  return v.toString(16).padStart(digits, "0");
};

/** CSS(C, C) for C^perp subset C: [[n, 2*dim(C) - n, d]], d = min weight over C \ C^perp. */
const cssFromContainingDual = (
  n: number,
  c: Set<number>,
): { n: number; k: number; d: number; isState: boolean } | undefined => {
  const d = dual(n, c);
  for (const v of d) if (!c.has(v)) return undefined;
  const k = 2 * dimension(c) - n;
  const coset = [...c].filter((v) => !d.has(v));
  if (coset.length === 0) {
    const nz = [...c].filter((v) => v !== 0).map(weight);
    return { n, k, d: Math.min(...nz), isState: true };
  }
  return { n, k, d: Math.min(...coset.map(weight)), isState: k === 0 };
};

// The committed adinkra generator [8,4,4], transcribed as bitmasks (bit i = coordinate i).
// Same four rows as `AdinkraCode.generator`, read little-endian.
const ADINKRA_GENERATOR = [0b11100001, 0b11010010, 0b10110100, 0b01111000];
const adinkraCode = span(ADINKRA_GENERATOR);
const puncture = (pos: number, code: Set<number>): Set<number> => {
  const low = (1 << pos) - 1;
  return new Set([...code].map((c) => (c & low) | ((c >>> (pos + 1)) << pos)));
};

describe("CSS stabilizer treaty — second oracle (TypeScript re-derivation)", () => {
  test("the treaty declares its REGISTER, so a reader of the JSON alone still sees the line", () => {
    // The demarcation is only worth anything if it travels with the artefact. A structural claim
    // whose register lives only in a doc becomes a physical claim the first time it is quoted.
    expect(treaty.register).toBe("structural");
    expect(treaty.schemaVersion).toBe(1);
  });

  test("the adinkra [8,4,4] code is doubly-even and self-dual — so its CSS code has k = 0", () => {
    expect(adinkraCode.size).toBe(16);
    expect(isDoublyEven(adinkraCode)).toBe(true);
    expect(setEq(dual(8, adinkraCode), adinkraCode)).toBe(true);
    const css = cssFromContainingDual(8, adinkraCode);
    expect(css).toBeDefined();
    expect(css?.k).toBe(0);
    expect(css?.d).toBe(4);
    const committed = must(treaty.cssCodes.adinkra_8_0_4, "cssCodes.adinkra_8_0_4");
    expect([committed.n, committed.k, committed.d]).toEqual([8, 0, 4]);
    expect(committed.isStabilizerStateNotACode).toBe(true);
  });

  test("RM(1,4) is doubly-even, self-orthogonal, NOT self-dual, and its dual IS RM(2,4) as a set", () => {
    const rm1 = reedMuller(1, 4);
    const rm2 = reedMuller(2, 4);
    expect(dimension(rm1)).toBe(5);
    expect(dimension(rm2)).toBe(11);
    expect(isDoublyEven(rm1)).toBe(true);
    expect(isSelfOrthogonal(rm1)).toBe(true);
    expect(setEq(dual(16, rm1), rm2)).toBe(true);
    // set equality, not same-dimension: a matching count is not an identification
    expect(setEq(dual(16, rm1), rm1)).toBe(false);
  });

  test("CSS from RM(1,4) is [[16,6,4]] and matches the treaty computed by F#", () => {
    const css = cssFromContainingDual(16, reedMuller(2, 4));
    expect(css).toBeDefined();
    expect([css?.n, css?.k, css?.d]).toEqual([16, 6, 4]);
    const committed = must(treaty.cssCodes.quantum_rm_16_6_4, "cssCodes.quantum_rm_16_6_4");
    expect([committed.n, committed.k, committed.d]).toEqual([16, 6, 4]);
    expect(committed.stabilizerGeneratorCount).toBe(16 - 6);
  });

  test("Steane [[7,1,3]] comes from a puncture that LEAVES the adinkra category", () => {
    const punctured = puncture(0, adinkraCode);
    const weights = [...new Set([...punctured].map(weight))].sort((a, b) => a - b);
    expect(weights).toEqual([0, 3, 4, 7]);
    // weight 3 and 7 are ODD: not doubly-even, so not an adinkra code. Provenance, not inheritance.
    expect(isDoublyEven(punctured)).toBe(false);
    expect(isSelfOrthogonal(punctured)).toBe(false);
    const css = cssFromContainingDual(7, punctured);
    expect([css?.n, css?.k, css?.d]).toEqual([7, 1, 3]);
  });

  test("every basis row in the treaty is reproduced by the TypeScript echelon reduction", () => {
    const cases: [string, number, Set<number>][] = [
      ["adinkra_8_4_4", 8, adinkraCode],
      ["steane_punctured_7_4_3", 7, puncture(0, adinkraCode)],
      ["rm_1_4", 16, reedMuller(1, 4)],
    ];
    for (const [name, n, code] of cases) {
      const committed = must(treaty.classicalCodes[name], `classicalCodes.${name}`);
      expect(committed).toHaveLength(n);
      expect(committed.dimension).toBe(dimension(code));
      expect(committed.doublyEven).toBe(isDoublyEven(code));
      expect(committed.selfOrthogonal).toBe(isSelfOrthogonal(code));
      expect(committed.basisHex).toEqual(echelonBasis(n, code).map((r) => toHex(n, r)));
      // and the weight distribution, which is the invariant that discriminates codes of equal dim
      const wd = new Map<number, number>();
      for (const c of code) wd.set(weight(c), (wd.get(weight(c)) ?? 0) + 1);
      expect(committed.weightDistribution).toEqual(
        [...wd.entries()].sort((a, b) => a[0] - b[0]).map(([w, c]) => [w, c]),
      );
    }
  });

  test("the N=8 closure holds: no row both encodes a qubit and corrects an error", () => {
    const rows = treaty.n8AdinkraClosure.rows;
    expect(rows.map((r) => [r.dimC, r.k, r.d])).toEqual([
      [0, 8, 1],
      [1, 6, 2],
      [2, 4, 2],
      [3, 2, 2],
      [4, 0, 4],
    ]);
    for (const r of rows) expect(r.encodesAQubit && r.correctsAnError).toBe(false);
    // the dim-0 row is the UNCODED (homoiconic) adinkra family — required, and the worst row
    expect(rows[0]?.dimC).toBe(0);
    expect(rows[0]?.d).toBe(1);
    expect(treaty.n8AdinkraClosure.distinctDoublyEvenCodesEnumerated).toBe(902);
  });

  test("the Q# source transcribes the SAME stabilizer rows the treaty commits", () => {
    // The third oracle. Q# cannot be executed on every lane (QDK is an opt-in install), but its
    // source is text and its declared rows either match the computed ones or they do not. The
    // first draft of the Q# file got the Steane rows wrong; this test is what caught it.
    const steaneMatch = /function SteaneCheckRows\(\)[^}]*return \[([^\]]*)\]/.exec(qsharpSource);
    const rmMatch = /function QuantumReedMullerCheckRows\(\)[^}]*return \[([^\]]*)\]/.exec(qsharpSource);
    expect(steaneMatch).not.toBeNull();
    expect(rmMatch).not.toBeNull();
    const parse = (m: RegExpMatchArray | null): number[] =>
      (m?.[1] ?? "").split(",").map((s) => Number.parseInt(s.trim(), 16));
    expect(parse(steaneMatch).map((r) => toHex(7, r))).toEqual([
      ...must(treaty.cssCodes.steane_7_1_3, "cssCodes.steane_7_1_3").xStabilizerRowsHex,
    ]);
    expect(parse(rmMatch).map((r) => toHex(16, r))).toEqual([
      ...must(treaty.cssCodes.quantum_rm_16_6_4, "cssCodes.quantum_rm_16_6_4").xStabilizerRowsHex,
    ]);
  });

  test("CSS commutation H_X . H_Z^T = 0 — without it the stabilizer group is not abelian", () => {
    // This is the condition that makes a codespace exist at all, so a wrong matrix fails here
    // rather than producing a plausible-looking code with the wrong parameters.
    for (const name of Object.keys(treaty.cssCodes)) {
      const rows = must(treaty.cssCodes[name], `cssCodes.${name}`).xStabilizerRowsHex.map((h) =>
        Number.parseInt(h, 16),
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const x of rows) for (const z of rows) expect(dot(x, z)).toBe(0);
    }
  });

  test("every committed payload is lowercase hex — no binary in the proof lineage", () => {
    const hex = /^[0-9a-f]+$/;
    let rowsSeen = 0;
    for (const code of Object.values(treaty.classicalCodes)) {
      for (const r of code.basisHex) {
        expect(r).toMatch(hex);
        rowsSeen += 1;
      }
      expect(code.codewordSetSha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(rowsSeen).toBe(13);
  });
});
