/**
 * ir-vs-handwritten.test.ts — IR-generated code vs the HAND-WRITTEN ports.
 *
 * The existing cross-verification harness proves the generators agree with each
 * other. That is not evidence the IR is right: a wrong IR propagates identically
 * into every lane and they agree anyway. The hand-written ports are the
 * independent oracle, so this file is what can actually falsify IR *adequacy*.
 *
 * DISCIPLINE THIS FILE HOLDS ITSELF TO
 * ------------------------------------
 *   * ONE TEST PER PRIMITIVE, BY NAME. No `>= N primitives agreed` floor —
 *     redundancy in a numerator hides a zero (the #10754 aggregate-floor trap).
 *     A primitive that stops being compared fails as itself.
 *   * NO SILENT SKIPS. Primitives with no hand-written port are not quietly
 *     passed over; the set is DECLARED (`NO_INDEPENDENT_ORACLE`) and asserted to
 *     equal the scan in BOTH directions, so adding a bare IR, or a bare IR
 *     growing a port, is a visible diff either way.
 *   * THE CHECK IS SHOWN TO DISCRIMINATE. Six mutation classes — width, a
 *     constant, a dropped op, a reordered pair, a shift amount, a rotation
 *     amount — must each turn the comparison red, and an unknown op must be
 *     refused at generation time. A comparison that cannot fail is not an oracle.
 */

import { describe, expect, test } from "bun:test";
import {
  compareGeneratedVsHandWritten,
  differentialCorpus,
  discoverPrimitives,
  handWrittenLanes,
  NO_INDEPENDENT_ORACLE,
  type IrOpLike,
  type Primitive,
} from "./ir-vs-handwritten.ts";

const PRIMITIVES = discoverPrimitives();
const WITH_ORACLE = PRIMITIVES.filter((p) => handWrittenLanes(p.dir).length > 0);
const WITHOUT_ORACLE = PRIMITIVES.filter((p) => handWrittenLanes(p.dir).length === 0);

/** Mutate one primitive's IR without touching the repo. */
function mutate(p: Primitive, ops: IrOpLike[], width = p.ir.width): Primitive {
  return { ...p, ir: { ...p.ir, width, ops } };
}

describe("ir-vs-handwritten — the IR generates what the hand-written ports compute", () => {
  test("discovery found IR-carrying primitives at all (a zero here would make every row below vacuous)", () => {
    expect(PRIMITIVES.length).toBeGreaterThan(0);
    expect(WITH_ORACLE.length).toBeGreaterThan(0);
  });

  // ── the honest scope statement, asserted rather than narrated ──────────────
  test("the set of IR primitives with NO independent oracle is exactly the declared set", () => {
    const scanned = WITHOUT_ORACLE.map((p) => p.name).sort();
    const declared = [...NO_INDEPENDENT_ORACLE].sort();
    // Both directions: an undeclared bare primitive fails, and a declared one
    // that has since grown a hand-written port also fails (stale declaration).
    expect(scanned).toEqual(declared);
  });

  test("every primitive is either compared or declared oracle-less — none is silently dropped", () => {
    const accounted = new Set([...WITH_ORACLE, ...WITHOUT_ORACLE].map((p) => p.name));
    expect([...accounted].sort()).toEqual(PRIMITIVES.map((p) => p.name).sort());
  });

  // ── one named row per primitive that HAS an independent oracle ─────────────
  for (const p of WITH_ORACLE) {
    test(`${p.name} (width ${String(p.ir.width)}): IR-generated output equals every hand-written port`, () => {
      const r = compareGeneratedVsHandWritten(p);

      // The comparison must have actually compared something, in both bars.
      expect(r.generatedLanes.length).toBeGreaterThan(0);
      expect(r.handWrittenLanes.length).toBeGreaterThan(0);
      expect(r.sharedVectors.length).toBeGreaterThan(0);
      expect(r.differentialInputs).toBeGreaterThan(0);

      // Fail by name, with the divergence in the message.
      const named = r.divergences.map(
        (d) => `${d.comparison} @ ${d.vector}: generated=${d.generated} hand-written=${d.handWritten}`,
      );
      expect(named).toEqual([]);
      // Slow BY NATURE: this row spawns bun + python3 per lane, twice (committed
      // corpus, then the differential corpus). bunfig's default per-test cap is
      // 5s and is deliberately not raised globally, so the row carries its own.
    }, 60_000);
  }

  // ── the corpus itself must be non-degenerate ───────────────────────────────
  test("the differential corpus is deterministic, de-duplicated, and in range", () => {
    for (const width of [32, 64]) {
      const a = differentialCorpus(width, 500);
      const b = differentialCorpus(width, 500);
      expect(a).toEqual(b); // DST: same seed, same corpus
      expect(a.length).toBe(500);
      const MASK = (1n << BigInt(width)) - 1n;
      const values = a.map(([, v]) => BigInt(v));
      expect(new Set(values.map(String)).size).toBe(500); // no duplicate inputs padding the count
      expect(values.every((v) => v >= 0n && v <= MASK)).toBe(true);
      expect(values).toContain(0n);
      expect(values).toContain(MASK);
      expect(values).toContain(1n << BigInt(width - 1));
    }
  });
});

describe("ir-vs-handwritten — the check discriminates (mutate the IR, it must go red)", () => {
  // splitmix64 (v1: mul/xorshr, width 64), fmix32 (v1, width 32) and nasam
  // (v3: xrotxor/xshrxor, width 64) between them exercise every op family.
  const sm = WITH_ORACLE.find((p) => p.name === "splitmix64");
  const fm = WITH_ORACLE.find((p) => p.name === "fmix32");
  const na = WITH_ORACLE.find((p) => p.name === "nasam");

  test("the three mutation subjects were found (otherwise the mutations below test nothing)", () => {
    expect(sm?.name).toBe("splitmix64");
    expect(fm?.name).toBe("fmix32");
    expect(na?.name).toBe("nasam");
  });

  /** Run a mutated primitive and return the divergence count (0 = the check did NOT bite). */
  function divergencesUnder(p: Primitive): number {
    return compareGeneratedVsHandWritten(p, { differentialCount: 200 }).divergences.length;
  }

  test("baseline: the UNMUTATED IRs agree (so a red below is the mutation, not the harness)", () => {
    expect(divergencesUnder(sm!)).toBe(0);
    expect(divergencesUnder(fm!)).toBe(0);
    expect(divergencesUnder(na!)).toBe(0);
  }, 60_000);

  test("MUTATION width 32 -> 64 on fmix32 diverges (the defect this harness was built to catch)", () => {
    expect(divergencesUnder(mutate(fm!, fm!.ir.ops as IrOpLike[], 64))).toBeGreaterThan(0);
  }, 30_000);

  test("MUTATION one multiplier constant flipped diverges", () => {
    const ops = (fm!.ir.ops as IrOpLike[]).map((o) =>
      o.op === "mul" && BigInt(o.k ?? 0) === 2246822507n ? { ...o, k: 2246822506n } : o,
    );
    expect(divergencesUnder(mutate(fm!, ops))).toBeGreaterThan(0);
  }, 30_000);

  test("MUTATION a dropped round diverges", () => {
    expect(divergencesUnder(mutate(fm!, (fm!.ir.ops as IrOpLike[]).slice(0, -1)))).toBeGreaterThan(0);
  }, 30_000);

  test("MUTATION two ops transposed diverges (order is semantics, not decoration)", () => {
    const ops = fm!.ir.ops as IrOpLike[];
    expect(divergencesUnder(mutate(fm!, [ops[1]!, ops[0]!, ...ops.slice(2)]))).toBeGreaterThan(0);
  }, 30_000);

  test("MUTATION a shift amount changed diverges (splitmix64 xorshr 30 -> 29)", () => {
    const ops = (sm!.ir.ops as IrOpLike[]).map((o) => (o.op === "xorshr" && o.s === 30 ? { ...o, s: 29 } : o));
    expect(divergencesUnder(mutate(sm!, ops))).toBeGreaterThan(0);
  }, 30_000);

  test("MUTATION a rotation amount changed diverges (nasam xrotxor [39,17] -> [38,17])", () => {
    const ops = (na!.ir.ops as IrOpLike[]).map((o) => (o.op === "xrotxor" ? { ...o, rs: [38, 17] } : o));
    expect(divergencesUnder(mutate(na!, ops))).toBeGreaterThan(0);
  }, 30_000);

  test("an op OUTSIDE the v1..v4 grammar is REFUSED at generation time, not mis-emitted", () => {
    const ops = [{ op: "frobnicate", k: 1n } as unknown as IrOpLike, ...(fm!.ir.ops as IrOpLike[])];
    expect(() => divergencesUnder(mutate(fm!, ops))).toThrow(/not in the v1\.\.v4 grammar/);
  }, 30_000);

  test("an unsupported WIDTH is REFUSED rather than silently approximated", () => {
    expect(() => divergencesUnder(mutate(fm!, fm!.ir.ops as IrOpLike[], 24))).toThrow(/width 24 is not supported/);
  }, 30_000);
});
