#!/usr/bin/env bun
/**
 * generate-dual-score-treaty-transcript.ts — the TypeScript half of the `DualScore` treaty.
 *
 * ── WHY THIS PAIR ────────────────────────────────────────────────────────────
 * `src/Core.TypeScript/belief/dual-score.ts` (PR #17308) and `src/Core/DualScore.fs` (PR #17329)
 * are two implementations of ONE idea: a belief is two independent chances in [0,1], never one
 * normalised weight. `audit-cross-language-pairs.ts` reported the pair the day the F# side landed,
 * and it was right to: nothing checked they agreed.
 *
 * The waiver was available and was NOT taken. `DECLARED_UNPINNED` is for a NAME COLLISION — two
 * files sharing an English word and nothing else. This is the opposite case. The whole argument
 * for the dual legs is that a disagreement between two witnesses must survive rather than average
 * away, so two runtimes disagreeing about what a belief SAYS is the failure the type exists to
 * prevent, committed one layer down.
 *
 * ── THE DIVERGENCE RISKS, EACH WITH VECTORS ──────────────────────────────────
 *
 * 1. **FLOAT, and it is the interesting one.** The F# side measured the thing that makes an EXACT
 *    mass-shape read unusable: projecting a normalised `SoftValue` gives a 7/2/1 distribution
 *    summing to 1.000000000000000222 and a `combine` posterior summing to 0.99999999999999988898 —
 *    residuals of −2.220446049250313e-16 and +1.1102230246251565e-16, one ULP on either side of 1.
 *    So `massShape` reads *contradictory* and *ignorant* for two values that are both, in intent,
 *    exactly classical. **Every double in this transcript therefore travels as its exact IEEE-754
 *    big-endian bit pattern in hex**, with a decimal rendering beside it for a human reader. The
 *    hex is authoritative; the decimal is commentary. Neither of the two masses above is
 *    expressible as a short decimal literal, and a treaty that rounded them away would be pinning
 *    a number nobody computes.
 *
 * 2. **REFUSAL vs CLAMP.** Both constructors must REFUSE an out-of-unit leg. A clamp turns a
 *    caller's arithmetic bug into a plausible belief; a side that clamped while the other refused
 *    would make the same wire row a defect in one runtime and a confident belief in the other.
 *    The transcript carries the refusal REASON and the offending LEG, and a both-legs-bad vector
 *    pins that `trueChance` is reported first.
 *
 * 3. **THE RESIDUAL'S SIGN.** `r = 1 − t − f` is signed, and the sign is the meaning: `r > 0` is
 *    Boole slack (imprecision), `r < 0` is de Finetti incoherence (a Dutch book, with `−r` the
 *    loss per unit stake). A side that shipped `|r|`, or flipped the convention to `t + f − 1`,
 *    would still produce two plausible non-negative readings through `ignorance`/`contradiction`
 *    and be wrong about which of the two epistemic states it was in.
 *
 * 4. **TWO DERIVATIONS OF ONE QUANTITY — AND THE TREATY FOUND THE HOLE IN THE ARGUMENT.** F#
 *    computes `contradiction` as `max 0 (−(1 − mass))`; this file computes it as `mass − 1`.
 *    IEEE-754 round-to-nearest is symmetric under negation, so away from zero the two are the
 *    same double. **At `r = 0` they are `−0.0` and `+0.0`** — numerically equal, not bit-equal.
 *    It does not escape: both clamps route the zero through a `> 0` test and return a positive
 *    literal, so `ignorance` and `contradiction` agree everywhere. The `negatedResidual` and
 *    `massMinusOne` fields carry both intermediates so the exception stays visible rather than
 *    being re-derived (wrongly, as it was here first) by the next reader.
 *
 * 5. **`swapLegs` IS AN INVOLUTION, NOT A COMPLEMENT.** `¬(t,f) = (f,t)`, never `1 − p`. Order 2
 *    is also what separates Belnap's FOUR from the `C₄` compass in `src/Core/FourCornerC4.fs`.
 *
 * 6. **`toyJoin` IS THE KNOWLEDGE-ORDER JOIN (componentwise max), NOT THE TRUTH-ORDER ONE.** The
 *    `≤_t` join `(max t, min f)` DECIDES; the `≤_k` join SURFACES. `toyJoin(onlyTrue, onlyFalse)`
 *    must be `both` with contradiction 1. If one side quietly shipped the truth-order join, two
 *    witnesses who disagree would silently become a confident `true`, which is the exact collapse
 *    the primitive exists to prevent.
 *
 * 7. **`massShapeWithin`'s TOLERANCE FOLD.** A negative tolerance folds to 0 in both runtimes, and
 *    so does a NaN one — F#'s `max 0.0 nan` returns `0.0` (`0.0 < nan` is false) while JavaScript's
 *    `Math.max(0, NaN)` returns `NaN`, which would make every reading `coherent`. The TypeScript
 *    side spells the fold `tolerance > 0 ? tolerance : 0` for that reason, and the transcript
 *    carries a NaN-tolerance vector so the reason is checked rather than asserted.
 *
 * 8. **PARSE REFUSES ABSENCE.** A missing leg must never default to 0 — `0` is a real measurement
 *    ("evidence landed and found nothing") and absence is not. The two parsers read different
 *    carriers (an `unknown` JSON value here, a `DynamicValue` there), so the transcript encodes
 *    the input STRUCTURALLY and each side builds its own carrier from that encoding.
 *
 * ── WHAT IS DELIBERATELY NOT PINNED ──────────────────────────────────────────
 * The refusal PROSE. F# formats its `Refusal` DU, TypeScript writes an English `detail` string;
 * the two are independently authored diagnostics for a human reader, not protocol. What IS pinned
 * is everything a caller branches on: that a refusal happened, its REASON code, and its LEG. The
 * F# replay additionally asserts the detail is non-empty, which is a real property rather than a
 * byte equality that would misdescribe what the two modules promise.
 *
 * Field SPELLINGS are not pinned either — F# carries `T`/`F` behind `TrueChance`/`FalseChance`
 * accessors, TypeScript carries `trueChance`/`falseChance`. The transcript pins VALUES.
 *
 * Usage: bun src/Core.TypeScript/belief/generate-dual-score-treaty-transcript.ts
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
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

// ── The carrier: every double is its exact big-endian IEEE-754 bit pattern ───
//
// `.claude/rules/no-binary-in-proof-lineage.md`: verification artifacts are TEXT. A bit pattern in
// hex is text, diffable in a `git` diff, and EXACT — which a decimal literal is not, at the one
// ULP scale where this treaty does its most interesting work.

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

interface WireDouble {
  readonly hex: string;
  readonly dec: string;
}

/**
 * The wire form of a double. `dec` is produced with an INVARIANT renderer — JavaScript's
 * `Number.prototype.toString` is locale-independent by specification, unlike `toLocaleString` —
 * so the file's bytes do not depend on the machine that generated it. The F# replay parses it
 * with `CultureInfo.InvariantCulture` for the same reason.
 */
const wire = (x: number): WireDouble => ({ hex: bitsOf(x), dec: Number.isFinite(x) ? x.toString() : String(x) });

const score = (tHex: string, fHex: string): DualScore => {
  const r = dualScore(fromBits(tHex), fromBits(fHex));
  if (!r.ok) throw new Error(`fixture is not a legal score: ${tHex}/${fHex} — ${r.refusal.detail}`);
  return r.score;
};

// ── Named bit patterns, so a vector table reads as values rather than as hex ─

const HEX = {
  zero: "0000000000000000",
  one: "3FF0000000000000",
  half: "3FE0000000000000",
  // 0.5 + 2^-53 — two of these sum to 1 + 2^-52 EXACTLY, reproducing the 7/2/1 mass the F# side
  // measured (1.000000000000000222, residual −2.220446049250313e-16, reads "contradictory").
  halfUp1Ulp: "3FE0000000000001",
  // 0.5 − 2^-53 — with 0.5 it sums to 1 − 2^-53 EXACTLY, reproducing the `combine` posterior
  // (0.9999999999999999, residual +1.1102230246251565e-16, reads "ignorant").
  halfDown1Ulp: "3FDFFFFFFFFFFFFE",
  p1: "3FB999999999999A",
  p2: "3FC999999999999A",
  p3: "3FD3333333333333",
  p4: "3FD999999999999A",
  p6: "3FE3333333333333",
  p7: "3FE6666666666666",
  p8: "3FE999999999999A",
  p9: "3FECCCCCCCCCCCCD",
  // |residual| of the two ULP masses above, and the doubles one ULP below each.
  ulp2: "3CB0000000000000", // 2.220446049250313e-16
  ulp2Down: "3CAFFFFFFFFFFFFF",
  ulp1: "3CA0000000000000", // 1.1102230246251565e-16
  ulp1Down: "3C9FFFFFFFFFFFFF",
  tol1e12: "3D719799812DEA11", // 1e-12 — a tolerance a caller might plausibly own
  aboveOne: "3FF6666666666666", // 1.4
  negQuarter: "BFD0000000000000", // -0.25
  nan: "7FF8000000000000",
  posInf: "7FF0000000000000",
  negInf: "FFF0000000000000",
} as const;

interface Vector {
  readonly vectorType: string;
  readonly name: string;
  readonly [k: string]: unknown;
}

const vectors: Vector[] = [];

// ── 1. The four corners, BY NAME and IN ORDER ───────────────────────────────

const CORNER_NAMES = ["vacuous", "onlyTrue", "onlyFalse", "both"] as const;
const CORNER_VALUES = [VACUOUS, ONLY_TRUE, ONLY_FALSE, BOTH];

if (CORNERS.length !== CORNER_NAMES.length) throw new Error("CORNERS roster changed shape");
for (let i = 0; i < CORNERS.length; i++) {
  if (CORNERS[i] !== CORNER_VALUES[i]) throw new Error(`CORNERS[${String(i)}] is not ${CORNER_NAMES[i]}`);
}

for (let i = 0; i < CORNERS.length; i++) {
  const s = CORNERS[i] as DualScore;
  // `noUncheckedIndexedAccess` types a tuple read as possibly-undefined. The two rosters were
  // asserted the same length above, so this read is total -- but throwing here rather than
  // widening the vector's `name` to `string | undefined` keeps the failure loud if they part.
  const cornerName = CORNER_NAMES[i];
  if (cornerName === undefined) throw new Error(`CORNER_NAMES has no entry ${String(i)}`);
  vectors.push({
    vectorType: "Corner",
    name: cornerName,
    index: i,
    t: wire(s.trueChance),
    f: wire(s.falseChance),
    mass: wire(mass(s)),
    residual: wire(residual(s)),
    ignorance: wire(ignorance(s)),
    contradiction: wire(contradiction(s)),
    massShape: massShape(s),
    note:
      i === 0
        ? "maximal ignorance, r = 1. NOT {0.5,0.5}: a single p cannot tell 'nobody looked' from 'perfectly balanced'."
        : i === 3
          ? "the glut, r = -1. Reported, never resolved."
          : "classical: r = 0 exactly.",
  });
}

// ── 2. Construction: what is accepted, and what is REFUSED rather than clamped ─

const wireResult = (r: DualScoreResult) =>
  r.ok
    ? { ok: true, t: wire(r.score.trueChance), f: wire(r.score.falseChance) }
    : { ok: false, reason: r.refusal.reason, leg: r.refusal.leg };

const CONSTRUCT: { readonly name: string; readonly t: string; readonly f: string; readonly note: string }[] = [
  { name: "interior-pair", t: HEX.p7, f: HEX.p2, note: "CONTROL: a legal interior pair is ACCEPTED" },
  { name: "both-ends-low", t: HEX.zero, f: HEX.zero, note: "CONTROL: both closed ends are legal" },
  { name: "both-ends-high", t: HEX.one, f: HEX.one, note: "CONTROL: the glut is legal and must BUILD" },
  { name: "sum-above-one", t: HEX.p9, f: HEX.p7, note: "the SUM is unconstrained: 1.6 is contradiction, which is the signal" },
  { name: "sum-below-one", t: HEX.p1, f: HEX.p2, note: "under-fill is ignorance, not an incomplete input" },
  { name: "true-above-one", t: HEX.aboveOne, f: HEX.zero, note: "REFUSED, not clamped to 1" },
  { name: "false-negative", t: HEX.zero, f: HEX.negQuarter, note: "REFUSED, not clamped to 0" },
  { name: "true-nan", t: HEX.nan, f: HEX.zero, note: "NaN is not-finite, and not-finite is checked BEFORE range" },
  { name: "false-nan", t: HEX.zero, f: HEX.nan, note: "the second leg is checked too" },
  { name: "true-positive-infinity", t: HEX.posInf, f: HEX.zero, note: "+Inf reads not-finite, never outside-unit-interval" },
  { name: "false-negative-infinity", t: HEX.zero, f: HEX.negInf, note: "-Inf likewise" },
  {
    name: "both-legs-out-of-range",
    t: HEX.aboveOne,
    f: HEX.negQuarter,
    note: "ORDERING: trueChance is reported first when both are bad — a stable contract, not an accident",
  },
];

for (const c of CONSTRUCT) {
  vectors.push({
    vectorType: "Construct",
    name: c.name,
    t: wire(fromBits(c.t)),
    f: wire(fromBits(c.f)),
    expected: wireResult(dualScore(fromBits(c.t), fromBits(c.f))),
    note: c.note,
  });
}

// ── 3. The facts: mass, the SIGNED residual, and its two clamped halves ──────

const FACTS: { readonly name: string; readonly t: string; readonly f: string; readonly note: string }[] = [
  { name: "ignorant-ordinary", t: HEX.p1, f: HEX.p2, note: "r > 0: Boole slack" },
  { name: "coherent-exact", t: HEX.p7, f: HEX.p3, note: "r = 0 exactly: 0.7 + 0.3 is 1.0 on the nose in double" },
  { name: "contradictory-ordinary", t: HEX.p9, f: HEX.p7, note: "r < 0: a Dutch book, -r the loss per unit stake" },
  { name: "asymmetric-ignorant", t: HEX.p8, f: HEX.p1, note: "legs float independently: falseChance is not 1 - trueChance" },
  {
    name: "float-one-ulp-above-one",
    t: HEX.halfUp1Ulp,
    f: HEX.halfUp1Ulp,
    note:
      "THE MEASURED HAZARD. mass = 1.0000000000000002, r = -2.220446049250313e-16 -> 'contradictory'. " +
      "Same mass the F# side measured projecting a normalised 7/2/1 SoftValue. The sign is float noise.",
  },
  {
    name: "float-one-ulp-below-one",
    t: HEX.half,
    f: HEX.halfDown1Ulp,
    note:
      "THE MEASURED HAZARD, other side. mass = 0.9999999999999999, r = +1.1102230246251565e-16 -> 'ignorant'. " +
      "Same mass as a combine posterior. Two intended-classical values reading as opposite epistemic states.",
  },
];

for (const fx of FACTS) {
  const s = score(fx.t, fx.f);
  const r = residual(s);
  vectors.push({
    vectorType: "Facts",
    name: fx.name,
    t: wire(s.trueChance),
    f: wire(s.falseChance),
    mass: wire(mass(s)),
    residual: wire(r),
    ignorance: wire(ignorance(s)),
    contradiction: wire(contradiction(s)),
    massShape: massShape(s),
    // Risk 4 made checkable: the two independent derivations of the same quantity, as BITS.
    negatedResidual: wire(-r),
    massMinusOne: wire(mass(s) - 1),
    note: fx.note,
  });
}

// ── 4. massShapeWithin, on BOTH sides of the tolerance boundary ──────────────

const TOLERANCE: {
  readonly name: string;
  readonly t: string;
  readonly f: string;
  readonly tol: string;
  readonly note: string;
}[] = [
  {
    name: "zero-tolerance-is-massShape",
    t: HEX.halfUp1Ulp,
    f: HEX.halfUp1Ulp,
    tol: HEX.zero,
    note: "tolerance 0 must agree with the exact reading, whatever that is",
  },
  {
    name: "ulp-above-one-inside-1e-12",
    t: HEX.halfUp1Ulp,
    f: HEX.halfUp1Ulp,
    tol: HEX.tol1e12,
    note: "the hazard, absorbed: a tolerance the caller owns turns ULP noise back into 'coherent'",
  },
  {
    name: "ulp-below-one-inside-1e-12",
    t: HEX.half,
    f: HEX.halfDown1Ulp,
    tol: HEX.tol1e12,
    note: "same, other side",
  },
  {
    name: "boundary-exactly-at-tolerance-negative-r",
    t: HEX.halfUp1Ulp,
    f: HEX.halfUp1Ulp,
    tol: HEX.ulp2,
    note: "r == -tol EXACTLY: the comparison is strict, so this reads coherent. ON the boundary.",
  },
  {
    name: "boundary-one-ulp-inside-tolerance-negative-r",
    t: HEX.halfUp1Ulp,
    f: HEX.halfUp1Ulp,
    tol: HEX.ulp2Down,
    note: "tolerance one ULP smaller: now r < -tol and it reads contradictory. THE OTHER SIDE of the boundary.",
  },
  {
    name: "boundary-exactly-at-tolerance-positive-r",
    t: HEX.half,
    f: HEX.halfDown1Ulp,
    tol: HEX.ulp1,
    note: "r == +tol EXACTLY: coherent",
  },
  {
    name: "boundary-one-ulp-inside-tolerance-positive-r",
    t: HEX.half,
    f: HEX.halfDown1Ulp,
    tol: HEX.ulp1Down,
    note: "tolerance one ULP smaller: ignorant",
  },
  {
    name: "wide-tolerance-does-not-absorb-a-real-disagreement",
    t: HEX.p9,
    f: HEX.p7,
    tol: HEX.tol1e12,
    note: "a genuine glut (r = -0.6) stays contradictory: the tolerance absorbs noise, never evidence",
  },
  {
    name: "negative-tolerance-folds-to-zero",
    t: HEX.halfUp1Ulp,
    f: HEX.halfUp1Ulp,
    tol: HEX.negQuarter,
    note: "degenerate input to a total function: folded to 0, NOT refused — and the exact reading returns",
  },
  {
    name: "nan-tolerance-folds-to-zero",
    t: HEX.halfUp1Ulp,
    f: HEX.halfUp1Ulp,
    tol: HEX.nan,
    note:
      "RISK 7. F#'s `max 0.0 nan` is 0.0; JavaScript's `Math.max(0, NaN)` is NaN, which would make " +
      "EVERY reading coherent. Both sides must fold NaN to 0 and return the exact reading.",
  },
];

for (const tv of TOLERANCE) {
  const s = score(tv.t, tv.f);
  const tol = fromBits(tv.tol);
  vectors.push({
    vectorType: "Tolerance",
    name: tv.name,
    t: wire(s.trueChance),
    f: wire(s.falseChance),
    residual: wire(residual(s)),
    tolerance: wire(tol),
    expectedShape: massShapeWithin(tol, s),
    exactShape: massShape(s),
    note: tv.note,
  });
}

// ── 5. swapLegs — an involution, and every fact is invariant under it ────────

const SWAP: { readonly name: string; readonly t: string; readonly f: string; readonly note: string }[] = [
  { name: "asymmetric", t: HEX.p2, f: HEX.p7, note: "swapping {0.2,0.7} gives {0.7,0.2}, NOT the complement {0.8,0.3}" },
  { name: "onlyTrue-becomes-onlyFalse", t: HEX.one, f: HEX.zero, note: "negation moves between the two classical corners" },
  { name: "glut-is-fixed", t: HEX.one, f: HEX.one, note: "`both` is a fixed point of negation" },
  { name: "vacuous-is-fixed", t: HEX.zero, f: HEX.zero, note: "so is `vacuous` — the two <=_k extremes are self-negating" },
  { name: "float-ulp-case", t: HEX.half, f: HEX.halfDown1Ulp, note: "invariance must hold at the ULP scale too" },
];

for (const sv of SWAP) {
  const s = score(sv.t, sv.f);
  const once = swapLegs(s);
  const twice = swapLegs(once);
  vectors.push({
    vectorType: "Swap",
    name: sv.name,
    t: wire(s.trueChance),
    f: wire(s.falseChance),
    swappedT: wire(once.trueChance),
    swappedF: wire(once.falseChance),
    // The involution, as VALUES rather than as a claim.
    twiceT: wire(twice.trueChance),
    twiceF: wire(twice.falseChance),
    // Every fact is invariant under negation — that is what makes the legs symmetric in the type.
    swappedMass: wire(mass(once)),
    swappedResidual: wire(residual(once)),
    swappedIgnorance: wire(ignorance(once)),
    swappedContradiction: wire(contradiction(once)),
    swappedMassShape: massShape(once),
    note: sv.note,
  });
}

// ── 6. toyJoin — the KNOWLEDGE-order join, which surfaces conflict ───────────

const JOIN: {
  readonly name: string;
  readonly a: readonly [string, string];
  readonly b: readonly [string, string];
  readonly note: string;
}[] = [
  {
    name: "two-witnesses-who-disagree",
    a: [HEX.one, HEX.zero],
    b: [HEX.zero, HEX.one],
    note:
      "RISK 6. onlyTrue join onlyFalse must be `both`, contradiction 1. The TRUTH-order join would give " +
      "{1,0} — a confident `true` manufactured out of a standoff, which is the collapse this type prevents.",
  },
  { name: "componentwise-max", a: [HEX.p2, HEX.p9], b: [HEX.p7, HEX.p3], note: "each leg takes its own max, independently" },
  { name: "vacuous-is-the-identity", a: [HEX.zero, HEX.zero], b: [HEX.p7, HEX.p2], note: "the <=_k least element is the unit" },
  { name: "idempotent", a: [HEX.p7, HEX.p2], b: [HEX.p7, HEX.p2], note: "G-set join: a join a = a. Safe under replay (DST #4, #6)" },
  {
    name: "does-not-accumulate-evidence",
    a: [HEX.p3, HEX.p1],
    b: [HEX.p3, HEX.p1],
    note: "two weak witnesses stay weak — proof by value that max is NOT a fusion rule",
  },
  { name: "float-ulp-legs", a: [HEX.half, HEX.halfDown1Ulp], b: [HEX.halfUp1Ulp, HEX.half], note: "max at the ULP scale" },
];

for (const jv of JOIN) {
  const a = score(jv.a[0], jv.a[1]);
  const b = score(jv.b[0], jv.b[1]);
  const j = toyJoin(a, b);
  const swapped = toyJoin(b, a);
  vectors.push({
    vectorType: "Join",
    name: jv.name,
    aT: wire(a.trueChance),
    aF: wire(a.falseChance),
    bT: wire(b.trueChance),
    bF: wire(b.falseChance),
    joinT: wire(j.trueChance),
    joinF: wire(j.falseChance),
    // Commutativity as values, so a side that special-cased argument order is caught.
    commutedT: wire(swapped.trueChance),
    commutedF: wire(swapped.falseChance),
    joinResidual: wire(residual(j)),
    joinContradiction: wire(contradiction(j)),
    joinMassShape: massShape(j),
    note: jv.note,
  });
}

// ── 7. toyClassify — the one judging function, and its margin refusals ───────

const CLASSIFY: {
  readonly name: string;
  readonly t: string;
  readonly f: string;
  readonly margin: string;
  readonly note: string;
}[] = [
  { name: "leans-true-at-half", t: HEX.p8, f: HEX.p1, margin: HEX.half, note: "support over the margin, refutation under it" },
  { name: "leans-false-at-half", t: HEX.p1, f: HEX.p8, margin: HEX.half, note: "the mirror case" },
  { name: "unknown-both-under", t: HEX.p1, f: HEX.p2, margin: HEX.half, note: "neither leg reaches the margin" },
  {
    name: "contradiction-is-checked-first",
    t: HEX.p9,
    f: HEX.p7,
    margin: HEX.half,
    note: "both legs clear 0.5, so a naive order would say leans-true. A glut is NOT a weak lean.",
  },
  {
    name: "same-score-different-margin-low",
    t: HEX.p6,
    f: HEX.p3,
    margin: HEX.p4,
    note: "THE JUDGEMENT IS THE CALLER'S: at margin 0.4 this pair reads one way…",
  },
  { name: "same-score-different-margin-high", t: HEX.p6, f: HEX.p3, margin: HEX.p8, note: "…and at margin 0.8 it reads another" },
  { name: "margin-zero-is-legal", t: HEX.zero, f: HEX.zero, margin: HEX.zero, note: "0 is in the unit interval and is accepted" },
  { name: "margin-above-one-refused", t: HEX.p7, f: HEX.p2, margin: HEX.aboveOne, note: "the margin is refused by the SAME rule as a leg" },
  { name: "margin-negative-refused", t: HEX.p7, f: HEX.p2, margin: HEX.negQuarter, note: "…and so is a negative one" },
  { name: "margin-nan-refused", t: HEX.p7, f: HEX.p2, margin: HEX.nan, note: "not-finite, reported against the `margin` leg" },
];

for (const cv of CLASSIFY) {
  const s = score(cv.t, cv.f);
  const margin = fromBits(cv.margin);
  const r = toyClassify(s, margin);
  vectors.push({
    vectorType: "Classify",
    name: cv.name,
    t: wire(s.trueChance),
    f: wire(s.falseChance),
    margin: wire(margin),
    expected: r.ok ? { ok: true, reading: r.reading } : { ok: false, reason: r.refusal.reason, leg: r.refusal.leg },
    note: cv.note,
  });
}

// ── 8. Parsing untrusted input ──────────────────────────────────────────────
//
// The two parsers read DIFFERENT CARRIERS: `parseDualScore` takes an `unknown` JSON value, and
// F#'s `ofDynamicValue` takes the repo's own `DynamicValue`. So the input is encoded STRUCTURALLY
// and each side builds its own carrier from the encoding. A transcript that carried raw JSON could
// not express a NaN leg at all — JSON has no such literal — and the NaN leg is one of the vectors
// that matters, because it is the only way a well-shaped row reaches `not-finite` through the parser.

type Field = { readonly key: string; readonly value: Encoded };
type Encoded =
  | { readonly kind: "float"; readonly hex: string }
  | { readonly kind: "int"; readonly value: string }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "bool"; readonly value: boolean }
  | { readonly kind: "null" };

interface ParseInput {
  readonly shape: "object" | "array" | "null" | "number" | "string" | "bool";
  readonly fields?: readonly Field[];
  readonly hex?: string;
}

/** Build the TypeScript carrier the encoding describes. */
function buildTs(input: ParseInput): unknown {
  switch (input.shape) {
    case "array":
      return [];
    case "null":
      return null;
    case "number":
      return fromBits(input.hex ?? HEX.zero);
    case "string":
      return "not a score";
    case "bool":
      return true;
    case "object": {
      const o: Record<string, unknown> = {};
      for (const fld of input.fields ?? []) {
        switch (fld.value.kind) {
          case "float":
            o[fld.key] = fromBits(fld.value.hex);
            break;
          case "int":
            o[fld.key] = Number(fld.value.value);
            break;
          case "string":
            o[fld.key] = fld.value.value;
            break;
          case "bool":
            o[fld.key] = fld.value.value;
            break;
          case "null":
            o[fld.key] = null;
            break;
        }
      }
      return o;
    }
  }
}

const flt = (hex: string): Encoded => ({ kind: "float", hex });

const PARSE: { readonly name: string; readonly input: ParseInput; readonly note: string }[] = [
  {
    name: "well-formed",
    input: {
      shape: "object",
      fields: [
        { key: "trueChance", value: flt(HEX.p7) },
        { key: "falseChance", value: flt(HEX.p2) },
      ],
    },
    note: "CONTROL: a parser that refused everything would pass every refusal vector below",
  },
  {
    name: "key-order-does-not-matter",
    input: {
      shape: "object",
      fields: [
        { key: "falseChance", value: flt(HEX.p2) },
        { key: "trueChance", value: flt(HEX.p7) },
      ],
    },
    note: "lookup is by ordinal key, not by position",
  },
  {
    name: "extra-keys-are-ignored",
    input: {
      shape: "object",
      fields: [
        { key: "trueChance", value: flt(HEX.p7) },
        { key: "falseChance", value: flt(HEX.p2) },
        { key: "provenance", value: { kind: "string", value: "witness-3" } },
      ],
    },
    note: "a row carrying more than the two legs still parses",
  },
  {
    name: "integer-legs-accepted",
    input: {
      shape: "object",
      fields: [
        { key: "trueChance", value: { kind: "int", value: "1" } },
        { key: "falseChance", value: { kind: "int", value: "0" } },
      ],
    },
    note: "an encoder that emitted `1` rather than `1.0` is READ, not rejected",
  },
  {
    name: "missing-false-leg",
    input: { shape: "object", fields: [{ key: "trueChance", value: flt(HEX.p7) }] },
    note: "RISK 8: a missing leg is REFUSED, never defaulted to 0 — 0 is a measurement, absence is not",
  },
  {
    name: "missing-true-leg",
    input: { shape: "object", fields: [{ key: "falseChance", value: flt(HEX.p2) }] },
    note: "…and the other leg likewise",
  },
  {
    name: "empty-object",
    input: { shape: "object", fields: [] },
    note: "neither leg present",
  },
  {
    name: "string-leg",
    input: {
      shape: "object",
      fields: [
        { key: "trueChance", value: { kind: "string", value: "0.7" } },
        { key: "falseChance", value: flt(HEX.p2) },
      ],
    },
    note: "a numeric-LOOKING string is still not a number",
  },
  {
    name: "bool-leg",
    input: {
      shape: "object",
      fields: [
        { key: "trueChance", value: { kind: "bool", value: true } },
        { key: "falseChance", value: flt(HEX.p2) },
      ],
    },
    note: "`true` is not 1",
  },
  {
    name: "null-leg",
    input: {
      shape: "object",
      fields: [
        { key: "trueChance", value: { kind: "null" } },
        { key: "falseChance", value: flt(HEX.p2) },
      ],
    },
    note: "an explicit null is a present-but-wrong field, and is refused like any other",
  },
  {
    name: "out-of-range-leg-reaches-the-constructor",
    input: {
      shape: "object",
      fields: [
        { key: "trueChance", value: flt(HEX.aboveOne) },
        { key: "falseChance", value: flt(HEX.p2) },
      ],
    },
    note: "a well-SHAPED row still passes through the refusing constructor: reason outside-unit-interval",
  },
  {
    name: "nan-leg-reaches-the-constructor",
    input: {
      shape: "object",
      fields: [
        { key: "trueChance", value: flt(HEX.nan) },
        { key: "falseChance", value: flt(HEX.p2) },
      ],
    },
    note: "THE VECTOR JSON CANNOT EXPRESS — reason not-finite, reachable only because legs travel as bits",
  },
  { name: "bare-number", input: { shape: "number", hex: HEX.p7 }, note: "not an object at all" },
  { name: "bare-string", input: { shape: "string" }, note: "…nor is a string" },
  { name: "null-value", input: { shape: "null" }, note: "…nor null" },
  { name: "array-value", input: { shape: "array" }, note: "…nor an array, which IS an object to `typeof`" },
  { name: "bool-value", input: { shape: "bool" }, note: "…nor a bare boolean" },
];

for (const pv of PARSE) {
  vectors.push({
    vectorType: "Parse",
    name: pv.name,
    input: pv.input,
    expected: wireResult(parseDualScore(buildTs(pv.input))),
    note: pv.note,
  });
}

// ── Write ───────────────────────────────────────────────────────────────────

const transcript = {
  description:
    "Cross-language treaty for the DualScore belief primitive. Replayed by BOTH oracles: " +
    "src/Core.TypeScript/belief/dual-score-treaty-transcript.test.ts and " +
    "tests/Tests.FSharp/DualScoreTreaty.Tests.fs. TEXT ONLY per .claude/rules/no-binary-in-proof-lineage.md — " +
    "every double travels as its exact IEEE-754 big-endian bit pattern in hex, with a decimal rendering " +
    "beside it for human audit. THE HEX IS AUTHORITATIVE; the decimal is commentary, and the replays " +
    "check the two agree so a hand-edited annotation cannot drift away from the value it annotates.",
  fsharp: "src/Core/DualScore.fs",
  typescript: "src/Core.TypeScript/belief/dual-score.ts",
  generator: "src/Core.TypeScript/belief/generate-dual-score-treaty-transcript.ts",
  comparison:
    "EXACT bit equality on every double. mass/residual/ignorance/contradiction/swapLegs/toyJoin use only " +
    "addition, subtraction, negation and comparison — IEEE-754 mandates the first three be correctly " +
    "rounded, so bit equality is a guarantee the arithmetic already provides and a tolerance here would " +
    "be strictly weaker than what can be asserted. A treaty that disagreed only in the last ULP would " +
    "still be a disagreement, and this comparison makes it visible rather than rounding it away.",
  fieldNamesAreNotPinned:
    "F# carries T/F behind TrueChance/FalseChance accessors; TypeScript carries trueChance/falseChance. " +
    "The transcript pins VALUES. Refusal PROSE is not pinned either — only the reason code and the leg.",
  vectors,
};

const out = join(import.meta.dir, "dual-score-treaty-transcript.json");
writeFileSync(out, `${JSON.stringify(transcript, null, 2)}\n`);
console.log(`wrote ${String(vectors.length)} vectors to ${out}`);
const byType = new Map<string, number>();
for (const v of vectors) byType.set(v.vectorType, (byType.get(v.vectorType) ?? 0) + 1);
for (const [k, n] of [...byType].sort()) console.log(`  ${k.padEnd(12)} ${String(n)}`);
