// dual-score-treaty-transcript.test.ts -- the TypeScript half of the `DualScore` treaty replay.
//
// The generator WRITES this transcript from `dual-score.ts`, so this file's job is not to
// re-derive the same numbers a second time -- that would be `f(x) === f(x)`, which proves
// nothing. Its job is to make the COMMITTED FILE load-bearing:
//
//   * a change to `dual-score.ts` that alters any pinned value goes RED here until somebody
//     regenerates the transcript deliberately, which puts the change in a `git` diff a reviewer
//     can read (`.claude/rules/no-binary-in-proof-lineage.md` -- the whole point of text vectors);
//   * the hex and the decimal annotation beside it are checked against EACH OTHER, so a
//     hand-edited decimal cannot drift away from the value it describes;
//   * the vector ROSTER is checked, so deleting a hazard vector is a visible failure rather than
//     a quietly smaller treaty.
//
// The F# half (`tests/Tests.FSharp/DualScoreTreaty.Tests.fs`) is the one that makes it a treaty:
// it replays the same file through an independently written implementation.

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  BOTH,
  CORNERS,
  ONLY_FALSE,
  ONLY_TRUE,
  VACUOUS,
  contradiction,
  dualScore,
  ignorance,
  mass,
  massShape,
  massShapeWithin,
  parseDualScore,
  residual,
  swapLegs,
  toyClassify,
  toyJoin,
  type DualScore,
  type DualScoreResult,
} from "./dual-score";

/**
 * The mutants this treaty was verified against -- 8 applied, 8 KILLED. Each was written into
 * `dual-score.ts` or `src/Core/DualScore.fs`, both replays were run against the UNCHANGED
 * committed transcript, and the failure was recorded. A treaty nothing can refute is the vacuity
 * class with a JSON file attached, and `audit-cross-language-pairs.ts` says so in its own header:
 * it checks that a pin EXISTS, never that it is any good.
 *
 * | mutant                                        | side | verdict | how it died                 |
 * |-----------------------------------------------|------|---------|-----------------------------|
 * | residual-sign-flipped (`mass - 1`)            | F#   | KILLED  | 10 of 20 replay facts failed |
 * | swapLegs-is-the-identity                      | F#   | KILLED  | 1 (the moved-score control) |
 * | toyJoin-is-the-truth-order-join (`min` on f)  | F#   | KILLED  | 2, incl. the glut vector    |
 * | massShapeWithin-drops-the-tolerance (`tol=0`) | F#   | KILLED  | 1 (the absorbed-ULP vector) |
 * | nan-tolerance-fold-uses-max                   | F#   | KILLED  | 2 (the NaN-fold vectors)    |
 * | fsharp-legs-assigned-in-the-wrong-order       | F#   | KILLED  | 7                           |
 * | constructor-clamps-instead-of-refusing        | TS   | KILLED  | 2                           |
 * | parseDualScore-defaults-a-missing-leg-to-zero | TS   | KILLED  | 1                           |
 *
 * An honest note on the RUN, because the first pass of it was itself the failure this repo names
 * as its worst: the runner originally decided "killed" from a shell pipeline that could not tell
 * a FAILING TEST from a FAILING BUILD, and reported 8/8 while every F# row had only failed to
 * compile. A build that never ran the check is not a check that failed. The numbers above come
 * from the corrected runner, which gates on the build's exit code first and reports the xUnit
 * failure count.
 */
export const TREATY_MUTANTS = [
  "residual-sign-flipped",
  "swapLegs-is-the-identity",
  "toyJoin-is-the-truth-order-join",
  "massShapeWithin-drops-the-tolerance",
  "nan-tolerance-fold-uses-max",
  "fsharp-legs-assigned-in-the-wrong-order",
  "constructor-clamps-instead-of-refusing",
  "parseDualScore-defaults-a-missing-leg-to-zero",
] as const;

const TRANSCRIPT_PATH = join(dirname(import.meta.path), "dual-score-treaty-transcript.json");

interface WireDouble {
  readonly hex: string;
  readonly dec: string;
}
interface Vector {
  readonly vectorType: string;
  readonly name: string;
  readonly [k: string]: unknown;
}
interface Transcript {
  readonly vectors: readonly Vector[];
}

const transcript = JSON.parse(readFileSync(TRANSCRIPT_PATH, "utf8")) as Transcript;

const bitsOf = (x: number): string => {
  const b = new DataView(new ArrayBuffer(8));
  b.setFloat64(0, x, false);
  return b.getBigUint64(0, false).toString(16).toUpperCase().padStart(16, "0");
};
const fromBits = (hex: string): number => {
  const b = new DataView(new ArrayBuffer(8));
  b.setBigUint64(0, BigInt(`0x${hex}`), false);
  return b.getFloat64(0, false);
};

const wd = (v: Vector, key: string): WireDouble => v[key] as WireDouble;
const num = (v: Vector, key: string): number => fromBits(wd(v, key).hex);
/** Compared as labelled strings so a failure names the vector instead of printing two doubles. */
const sameBits = (label: string, actual: number, expected: WireDouble): void => {
  expect(`${label}=${bitsOf(actual)}`).toBe(`${label}=${expected.hex}`);
};

const of = (kind: string): Vector[] => transcript.vectors.filter((v) => v.vectorType === kind);

const scoreOf = (v: Vector, tKey = "t", fKey = "f"): DualScore => {
  const r = dualScore(num(v, tKey), num(v, fKey));
  if (!r.ok) throw new Error(`vector ${v.name}: fixture is not a legal score`);
  return r.score;
};

const checkResult = (label: string, actual: DualScoreResult, expected: Record<string, unknown>): void => {
  if (expected["ok"] === true) {
    expect(`${label} ok=${String(actual.ok)}`).toBe(`${label} ok=true`);
    if (!actual.ok) return;
    sameBits(`${label}.t`, actual.score.trueChance, expected["t"] as WireDouble);
    sameBits(`${label}.f`, actual.score.falseChance, expected["f"] as WireDouble);
    return;
  }
  expect(`${label} ok=${String(actual.ok)}`).toBe(`${label} ok=false`);
  if (actual.ok) return;
  expect(`${label} ${actual.refusal.reason}/${String(actual.refusal.leg)}`).toBe(
    `${label} ${String(expected["reason"])}/${String(expected["leg"])}`,
  );
  // The PROSE is not pinned (two independently authored diagnostics). That it says SOMETHING is.
  expect(actual.refusal.detail.length).toBeGreaterThan(0);
};

// ════════════════════════════════════════════════════════════════════════════════════════════
describe("the transcript is a roster, and it is complete", () => {
  it("carries every vector type, and the counts do not silently shrink", () => {
    const counts = new Map<string, number>();
    for (const v of transcript.vectors) counts.set(v.vectorType, (counts.get(v.vectorType) ?? 0) + 1);
    // Minimums, not equalities: adding a vector is good and must not be a failure. Deleting one is
    // what this guards, because a treaty gets weaker silently and stronger loudly.
    expect(counts.get("Corner")).toBe(4);
    expect(counts.get("Construct") ?? 0).toBeGreaterThanOrEqual(12);
    expect(counts.get("Facts") ?? 0).toBeGreaterThanOrEqual(6);
    expect(counts.get("Tolerance") ?? 0).toBeGreaterThanOrEqual(10);
    expect(counts.get("Swap") ?? 0).toBeGreaterThanOrEqual(5);
    expect(counts.get("Join") ?? 0).toBeGreaterThanOrEqual(6);
    expect(counts.get("Classify") ?? 0).toBeGreaterThanOrEqual(10);
    expect(counts.get("Parse") ?? 0).toBeGreaterThanOrEqual(17);
  });

  it("keeps the two MEASURED float hazards, by their exact bit patterns", () => {
    // These are the two masses the F# side measured projecting a normalised SoftValue: one ULP
    // above and one ULP below 1. They are why `massShapeWithin` exists, and why every double in
    // this file is a bit pattern. A treaty that lost them would be pinning only the easy cases.
    const masses = of("Facts").map((v) => wd(v, "mass").hex);
    expect(masses).toContain("3FF0000000000001"); // 1.0000000000000002
    expect(masses).toContain("3FEFFFFFFFFFFFFF"); // 0.9999999999999999
  });

  it("every decimal annotation agrees with the hex it annotates", () => {
    // A hand-edited decimal that drifted from its hex would make the file lie to a human reader
    // while still passing every value check, because the hex is what the replays use.
    let checked = 0;
    const walk = (node: unknown): void => {
      if (node === null || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const x of node) walk(x);
        return;
      }
      const o = node as Record<string, unknown>;
      if (typeof o["hex"] === "string" && typeof o["dec"] === "string" && Object.keys(o).length === 2) {
        const x = fromBits(o["hex"]);
        const annotated = o["dec"] === "NaN" ? NaN : Number(o["dec"]);
        expect(`${o["hex"]} -> ${o["dec"]}`).toBe(`${o["hex"]} -> ${Number.isFinite(x) ? x.toString() : String(x)}`);
        // `===`, not `toBe` (which is `Object.is`): a decimal rendering cannot carry the sign of
        // zero -- `(-0).toString()` is `"0"` -- so demanding Object.is here would fail on negative
        // zero for a reason that has nothing to do with the annotation. The hex pins the sign.
        if (Number.isFinite(x)) expect(annotated === x).toBe(true);
        checked++;
        return;
      }
      for (const x of Object.values(o)) walk(x);
    };
    walk(transcript.vectors);
    expect(checked).toBeGreaterThan(200);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe("Corner: all four of Belnap's corners, by name and in <=_k order", () => {
  const byName: Record<string, DualScore> = {
    vacuous: VACUOUS,
    onlyTrue: ONLY_TRUE,
    onlyFalse: ONLY_FALSE,
    both: BOTH,
  };

  it("each named corner holds the pinned legs and the pinned facts", () => {
    for (const v of of("Corner")) {
      const s = byName[v.name];
      expect(s).toBeDefined();
      if (s === undefined) continue;
      sameBits(`${v.name}.t`, s.trueChance, wd(v, "t"));
      sameBits(`${v.name}.f`, s.falseChance, wd(v, "f"));
      sameBits(`${v.name}.mass`, mass(s), wd(v, "mass"));
      sameBits(`${v.name}.residual`, residual(s), wd(v, "residual"));
      sameBits(`${v.name}.ignorance`, ignorance(s), wd(v, "ignorance"));
      sameBits(`${v.name}.contradiction`, contradiction(s), wd(v, "contradiction"));
      expect(`${v.name} shape=${massShape(s)}`).toBe(`${v.name} shape=${String(v["massShape"])}`);
    }
  });

  it("the CORNERS roster is in the pinned order -- the order is contract, not incidental", () => {
    for (const v of of("Corner")) {
      const i = v["index"] as number;
      const s = CORNERS[i];
      expect(s).toBeDefined();
      if (s === undefined) continue;
      sameBits(`CORNERS[${String(i)}].t`, s.trueChance, wd(v, "t"));
      sameBits(`CORNERS[${String(i)}].f`, s.falseChance, wd(v, "f"));
    }
    expect(CORNERS.length).toBe(of("Corner").length);
  });

  it("VACUOUS is {0,0} and is NOT the balanced {0.5,0.5} a single probability would give", () => {
    const vac = of("Corner").find((v) => v.name === "vacuous");
    expect(vac).toBeDefined();
    expect(wd(vac as Vector, "t").hex).toBe("0000000000000000");
    expect(wd(vac as Vector, "residual").hex).toBe("3FF0000000000000"); // r = 1
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe("Construct: the constructor REFUSES rather than clamping", () => {
  it("replays every construction vector, accepted and refused alike", () => {
    const vs = of("Construct");
    expect(vs.length).toBeGreaterThan(0);
    // CONTROL: a constructor that refused everything would satisfy every refusal vector. At least
    // one vector must be ACCEPTED, and the roster below asserts it.
    expect(vs.filter((v) => (v["expected"] as Record<string, unknown>)["ok"] === true).length).toBeGreaterThan(0);
    for (const v of vs) {
      checkResult(v.name, dualScore(num(v, "t"), num(v, "f")), v["expected"] as Record<string, unknown>);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe("Facts: mass, the SIGNED residual, and its two clamped halves", () => {
  it("replays every fact vector by exact bits", () => {
    for (const v of of("Facts")) {
      const s = scoreOf(v);
      sameBits(`${v.name}.mass`, mass(s), wd(v, "mass"));
      sameBits(`${v.name}.residual`, residual(s), wd(v, "residual"));
      sameBits(`${v.name}.ignorance`, ignorance(s), wd(v, "ignorance"));
      sameBits(`${v.name}.contradiction`, contradiction(s), wd(v, "contradiction"));
      expect(`${v.name} shape=${massShape(s)}`).toBe(`${v.name} shape=${String(v["massShape"])}`);
    }
  });

  it("the two independent derivations of the excess agree bit for bit AWAY FROM ZERO", () => {
    // F# computes contradiction as `max 0 (-(1 - mass))`; this file computes it as `mass - 1`.
    // IEEE-754 round-to-nearest is symmetric under negation, so away from zero they are the same
    // double -- an argument that was worth nothing until this check was written.
    //
    // >> AND THE TREATY IMMEDIATELY FOUND THE PLACE THE ARGUMENT IS FALSE. At `r = 0` exactly
    // >> (the `coherent-exact` vector, 0.7 + 0.3, which lands on 1.0 on the nose) the two
    // >> derivations are `-0.0` (bits 8000000000000000) and `+0.0` (bits 0000000000000000). Not
    // >> bit-identical. It does not reach either module's OUTPUT -- both clamps send the zero
    // >> through the `> 0` branch and return a positive literal zero -- so `ignorance` and
    // >> `contradiction` still agree everywhere, which is what the vectors above pin. But the
    // >> intermediate does differ, and a future refactor that returned the intermediate directly
    // >> (`contradiction = -residual` when the residual is known non-positive, say) would hand
    // >> one runtime a `-0` the other never produces.
    for (const v of of("Facts")) {
      const s = scoreOf(v);
      sameBits(`${v.name}.negatedResidual`, -residual(s), wd(v, "negatedResidual"));
      sameBits(`${v.name}.massMinusOne`, mass(s) - 1, wd(v, "massMinusOne"));
      if (residual(s) !== 0) {
        expect(`${v.name} ${bitsOf(-residual(s))}`).toBe(`${v.name} ${bitsOf(mass(s) - 1)}`);
      }
      // Numerically equal EVERYWHERE, including at zero, because `===` identifies -0 with +0 --
      // which is exactly why the clamped halves survive the difference above.
      expect(-residual(s) === mass(s) - 1).toBe(true);
    }
  });

  it("the signed zero does NOT escape: both clamps emit POSITIVE zero at r = 0", () => {
    // The finding above is only benign because of this. If a clamp ever returned its negated
    // intermediate rather than a literal, `contradiction` would be -0 in one runtime and +0 in
    // the other on every classical belief -- invisible to `===`, visible in a byte-lock, and a
    // real cross-language divergence in any consumer that serialises the number.
    const v = of("Facts").find((x) => x.name === "coherent-exact");
    expect(v).toBeDefined();
    if (v === undefined) return;
    const s = scoreOf(v);
    expect(residual(s)).toBe(0);
    expect(bitsOf(ignorance(s))).toBe("0000000000000000");
    expect(bitsOf(contradiction(s))).toBe("0000000000000000");
    expect(wd(v, "negatedResidual").hex).toBe("8000000000000000");
    expect(wd(v, "massMinusOne").hex).toBe("0000000000000000");
  });

  it("the SIGN carries the meaning: ignorance and contradiction are never both positive", () => {
    for (const v of of("Facts")) {
      const s = scoreOf(v);
      expect(Math.min(ignorance(s), contradiction(s))).toBe(0);
      expect(ignorance(s)).toBeGreaterThanOrEqual(0);
      expect(contradiction(s)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe("Tolerance: massShapeWithin on BOTH sides of the boundary", () => {
  it("replays every tolerance vector", () => {
    const vs = of("Tolerance");
    // The boundary is only pinned if the roster carries both readings on each side of it.
    const shapes = new Set(vs.map((v) => String(v["expectedShape"])));
    expect(shapes.has("coherent")).toBe(true);
    expect(shapes.has("ignorant")).toBe(true);
    expect(shapes.has("contradictory")).toBe(true);
    for (const v of vs) {
      const s = scoreOf(v);
      sameBits(`${v.name}.residual`, residual(s), wd(v, "residual"));
      expect(`${v.name} within=${massShapeWithin(num(v, "tolerance"), s)}`).toBe(
        `${v.name} within=${String(v["expectedShape"])}`,
      );
      expect(`${v.name} exact=${massShape(s)}`).toBe(`${v.name} exact=${String(v["exactShape"])}`);
    }
  });

  it("a NaN tolerance folds to ZERO, not to NaN -- `Math.max` would get this wrong", () => {
    const v = of("Tolerance").find((x) => x.name === "nan-tolerance-folds-to-zero");
    expect(v).toBeDefined();
    if (v === undefined) return;
    expect(Number.isNaN(num(v, "tolerance"))).toBe(true);
    // Under `Math.max(0, NaN)` the tolerance would be NaN, every comparison false, and the reading
    // `coherent` for EVERY score. The pinned value is the exact reading instead.
    expect(String(v["expectedShape"])).toBe(String(v["exactShape"]));
    expect(massShapeWithin(NaN, scoreOf(v))).toBe(massShape(scoreOf(v)));
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe("Swap: an involution, and every fact is invariant under it", () => {
  it("replays every swap vector, including the double application", () => {
    for (const v of of("Swap")) {
      const s = scoreOf(v);
      const once = swapLegs(s);
      sameBits(`${v.name}.swappedT`, once.trueChance, wd(v, "swappedT"));
      sameBits(`${v.name}.swappedF`, once.falseChance, wd(v, "swappedF"));
      const twice = swapLegs(once);
      sameBits(`${v.name}.twiceT`, twice.trueChance, wd(v, "twiceT"));
      sameBits(`${v.name}.twiceF`, twice.falseChance, wd(v, "twiceF"));
      sameBits(`${v.name}.swappedMass`, mass(once), wd(v, "swappedMass"));
      sameBits(`${v.name}.swappedResidual`, residual(once), wd(v, "swappedResidual"));
      sameBits(`${v.name}.swappedIgnorance`, ignorance(once), wd(v, "swappedIgnorance"));
      sameBits(`${v.name}.swappedContradiction`, contradiction(once), wd(v, "swappedContradiction"));
      expect(`${v.name} swappedShape=${massShape(once)}`).toBe(`${v.name} swappedShape=${String(v["swappedMassShape"])}`);
    }
  });

  it("the roster contains a vector where swapping actually MOVES the score", () => {
    // Without this, `swapLegs = id` passes every invariance check above -- the fixed points
    // (`vacuous`, `both`) are genuinely invariant, so a roster of only those proves nothing.
    const moved = of("Swap").filter((v) => wd(v, "t").hex !== wd(v, "swappedT").hex);
    expect(moved.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe("Join: the KNOWLEDGE-order join, which surfaces conflict rather than deciding it", () => {
  it("replays every join vector, and its commuted form", () => {
    for (const v of of("Join")) {
      const a = scoreOf(v, "aT", "aF");
      const b = scoreOf(v, "bT", "bF");
      const j = toyJoin(a, b);
      sameBits(`${v.name}.joinT`, j.trueChance, wd(v, "joinT"));
      sameBits(`${v.name}.joinF`, j.falseChance, wd(v, "joinF"));
      const c = toyJoin(b, a);
      sameBits(`${v.name}.commutedT`, c.trueChance, wd(v, "commutedT"));
      sameBits(`${v.name}.commutedF`, c.falseChance, wd(v, "commutedF"));
      sameBits(`${v.name}.joinResidual`, residual(j), wd(v, "joinResidual"));
      sameBits(`${v.name}.joinContradiction`, contradiction(j), wd(v, "joinContradiction"));
      expect(`${v.name} joinShape=${massShape(j)}`).toBe(`${v.name} joinShape=${String(v["joinMassShape"])}`);
    }
  });

  it("two witnesses who disagree land on the GLUT, not on a confident `true`", () => {
    const v = of("Join").find((x) => x.name === "two-witnesses-who-disagree");
    expect(v).toBeDefined();
    if (v === undefined) return;
    // The truth-order join `(max t, min f)` would give {1,0} here -- a decision manufactured out
    // of a standoff. The knowledge-order join gives {1,1}, contradiction 1.
    expect(wd(v, "joinF").hex).toBe("3FF0000000000000");
    expect(wd(v, "joinContradiction").hex).toBe("3FF0000000000000");
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe("Classify: the one judging function, and it ships no default margin", () => {
  it("replays every classification vector, readings and margin refusals alike", () => {
    for (const v of of("Classify")) {
      const s = scoreOf(v);
      const r = toyClassify(s, num(v, "margin"));
      const exp = v["expected"] as Record<string, unknown>;
      if (exp["ok"] === true) {
        expect(`${v.name} ok=${String(r.ok)}`).toBe(`${v.name} ok=true`);
        if (r.ok) expect(`${v.name} reading=${r.reading}`).toBe(`${v.name} reading=${String(exp["reading"])}`);
      } else {
        expect(`${v.name} ok=${String(r.ok)}`).toBe(`${v.name} ok=false`);
        if (!r.ok) {
          expect(`${v.name} ${r.refusal.reason}/${String(r.refusal.leg)}`).toBe(
            `${v.name} ${String(exp["reason"])}/${String(exp["leg"])}`,
          );
        }
      }
    }
  });

  it("the SAME legs read differently at two margins -- the judgement is the caller's", () => {
    const low = of("Classify").find((v) => v.name === "same-score-different-margin-low");
    const high = of("Classify").find((v) => v.name === "same-score-different-margin-high");
    expect(low).toBeDefined();
    expect(high).toBeDefined();
    if (low === undefined || high === undefined) return;
    expect(wd(low, "t").hex).toBe(wd(high, "t").hex);
    expect(wd(low, "f").hex).toBe(wd(high, "f").hex);
    expect((low["expected"] as Record<string, unknown>)["reading"]).not.toBe(
      (high["expected"] as Record<string, unknown>)["reading"],
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe("Parse: refuses absence rather than defaulting it", () => {
  // The two parsers read different carriers, so the transcript encodes the input STRUCTURALLY and
  // each runtime builds its own. This is the TypeScript builder; F# builds a `DynamicValue`.
  const build = (input: Record<string, unknown>): unknown => {
    switch (String(input["shape"])) {
      case "array":
        return [];
      case "null":
        return null;
      case "number":
        return fromBits(String(input["hex"]));
      case "string":
        return "not a score";
      case "bool":
        return true;
      default: {
        const o: Record<string, unknown> = {};
        for (const fld of (input["fields"] ?? []) as Record<string, unknown>[]) {
          const val = fld["value"] as Record<string, unknown>;
          const key = String(fld["key"]);
          switch (String(val["kind"])) {
            case "float":
              o[key] = fromBits(String(val["hex"]));
              break;
            case "int":
              o[key] = Number(String(val["value"]));
              break;
            case "string":
              o[key] = String(val["value"]);
              break;
            case "bool":
              o[key] = val["value"] === true;
              break;
            default:
              o[key] = null;
          }
        }
        return o;
      }
    }
  };

  it("replays every parse vector", () => {
    const vs = of("Parse");
    // CONTROL again: a parser that refused every input would satisfy every refusal vector here.
    expect(vs.filter((v) => (v["expected"] as Record<string, unknown>)["ok"] === true).length).toBeGreaterThan(0);
    for (const v of vs) {
      checkResult(v.name, parseDualScore(build(v["input"] as Record<string, unknown>)), v["expected"] as Record<string, unknown>);
    }
  });

  it("a NaN leg is expressible ONLY because legs travel as bit patterns", () => {
    // JSON has no NaN literal. A transcript carrying raw decimals could not state this vector at
    // all, so the hex carrier buys a case the treaty would otherwise be blind to.
    const v = of("Parse").find((x) => x.name === "nan-leg-reaches-the-constructor");
    expect(v).toBeDefined();
    if (v === undefined) return;
    expect((v["expected"] as Record<string, unknown>)["reason"]).toBe("not-finite");
  });

  it("a missing leg is REFUSED, never defaulted to 0", () => {
    for (const name of ["missing-false-leg", "missing-true-leg", "empty-object"]) {
      const v = of("Parse").find((x) => x.name === name);
      expect(v).toBeDefined();
      if (v === undefined) continue;
      expect((v["expected"] as Record<string, unknown>)["ok"]).toBe(false);
    }
  });
});
