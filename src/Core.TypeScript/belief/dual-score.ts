// dual-score.ts -- a belief is TWO independent chances in [0,1], never one probability.
//
// ============================================================================================
// THE OBSERVATION THAT COMMISSIONED THIS FILE
// ============================================================================================
// Aaron 2026-09-11, quoted because the wording IS the specification:
//
//   "refutations should also have a numerical score not just true false as well, probablities
//    over true false is really an extension of keep uncertainy open, we should also track
//    TRUE CHANCE AND FALSE CHANCE SEPRATLY, there is a lot of good data there WHEN THEY DON'T
//    ADD UP TO 1, THAT IS SIGNAL ITSELF, around false positives and negatives similar to our
//    DUAL BLOOM FILTER DESIGN, we should let them FLOAT INDEPENDLY of each other."
//
//   "we should try to make our numbers CONSTRAINED BETWEEN 0 AND 1, regularize it to a belief
//    if possible."
//
//   "this is the same for ANY true/false belief even our numeric claims."
//
// The last line is why this lives in `belief/` and not in the refutation ledger that is its
// first consumer. One primitive, many callers.
//
// ============================================================================================
// SCOPE, AND IT IS NARROW ON PURPOSE: THIS IS A DATA STRUCTURE, NOT AN ALGEBRA
// ============================================================================================
// >> THERE IS NO COMBINATION RULE IN THIS FILE. No `and`, no `or`, no `combine`, no
// >> `normalise`. That is a deliberate refusal, not an omission, and it is the single most
// >> important thing to know before extending this module.
//
// The algebra is UNDER REVIEW BY THE MATH TEAM (Lumen), against named prior art:
//
//   - Dempster-Shafer belief functions (Dempster 1967; Shafer, *A Mathematical Theory of
//     Evidence*, 1976) -- belief/plausibility, with the gap between them as IGNORANCE. The
//     closest published match to the shape below.
//   - Josang subjective logic (*Subjective Logic*, 2016) -- opinions as (belief, disbelief,
//     uncertainty, base rate), i.e. the gap carried explicitly as a fourth component.
//   - Belnap's FOUR (*A Useful Four-Valued Logic*, 1977) -- the four-element bilattice
//     {none, true, false, BOTH}. `BOTH` is exactly the sum > 1 case this type refuses to
//     collapse.
//   - Walley, *Statistical Reasoning with Imprecise Probabilities* (1991) -- lower and upper
//     previsions; the two legs as an interval rather than a point.
//   - Quasi-probability and Wigner negativity -- the physics-side precedent for a
//     "probability" that legitimately leaves the simplex.
//
// >> AND THE REASON A RULE CANNOT BE PICKED CASUALLY IS PUBLISHED: DEMPSTER'S RULE IS
// >> PATHOLOGICAL UNDER HIGH CONFLICT. Zadeh's counterexample (1979/1986) has two experts who
// >> each assign 0.99 to a different diagnosis and 0.01 to a third; Dempster's rule returns the
// >> third with probability 1 -- the option both experts thought nearly impossible. Choosing a
// >> combination rule today would be guessing, and a guessed rule shipped under a plain name is
// >> how a `toy` becomes `metered` by nobody deciding
// >> (`.claude/rules/toy-is-free-metered-must-be-earned.md`).
//
// So this module supplies: construction with refusal, the two legs, and the pure arithmetic of
// the gap. Nothing that fuses two beliefs into one.
//
// ============================================================================================
// THE OPEN QUESTION, STATED PLAINLY -- IS THIS A FOURTH `'W` FOR `src/Core/WSet.fs`?
// ============================================================================================
// `src/Core/WSet.fs` is already ring-generic, and its own header names three instances, each
// with its own BOUNDARY NONLINEARITY applied at the outer edge and never inside the loop:
//
//   'W = Z    -> the DBSP Z-set (signed counts;   boundary nonlinearity = Distinct)
//   'W = C    -> amplitudes     (interference;    boundary nonlinearity = measurement/Born)
//   'W = R>=0 -> probabilities  (sum-product;     boundary nonlinearity = EP projection)
//
// The open question, routed to the math team and NOT answered here:
//
//   1. Is `(trueChance, falseChance)` a FOURTH `'W` for that calculus -- does it carry the
//      semiring structure `WSet` demands (Add/Mul/Zero/One), and if so, which ones?
//   2. Is Aaron's "regularize it to a belief" precisely that ring's MISSING BOUNDARY
//      NONLINEARITY -- the counterpart of Distinct, Born and EP projection, applied once at the
//      outer boundary rather than at every step?
//
// A named open question is worth more here than a chosen answer. If (1) has an answer, the
// combination rule follows from the ring rather than from somebody's preference, and it arrives
// with `WSet`'s existing rung-honesty discipline attached. Until then: no operators.
//
// ============================================================================================
// THE ANALOGUE IS NAMED, SO IT IS CITED: BLOOM vs ANTI-BLOOM
// ============================================================================================
// `docs/research/bloom-filter-frontier.md`, Assess row "Bloom vs anti-bloom (2026-09-05)":
//
//   "two grow-only Bloom filters over ever-inserted and ever-deleted keys; three-valued
//    {present, absent, unknown}; unknown region fp(I) x fp(D). G-set shaped; no counter
//    saturation. ... Resurrection (insert after delete) is UNKNOWN."
//
// Work item `081M1T9SMM9087G0R002FS29S4` (ZD10). The structural echo is exact and deliberate:
//
//   bloom / anti-bloom                        this primitive
//   -------------------------------------     ---------------------------------------------
//   two filters, neither derived from the     `trueChance` and `falseChance`, neither derived
//   other                                     from the other -- NO `1 - p` ANYWHERE
//   three-valued {present, absent, unknown}   `massShape` reports ignorant / coherent /
//   plus the unknown region fp(I) x fp(D)     contradictory -- the IGNORANCE is that unknown
//                                             region, priced as 1 - (tc + fc)
//   resurrection (in BOTH filters) = UNKNOWN  both legs high = CONTRADICTION, reported as a
//                                             first-class quantity, never resolved here
//
// What does NOT transfer, and it is the same gap as the missing algebra: a Bloom filter's
// false-positive rate is an ANALYTIC function of (m, k, n), and a dual Bloom's UNION is a
// defined operation on bit sets. Here the two chances are supplied by callers and there is no
// defined union. The SHAPE is borrowed; the calibration and the algebra are not.
//
// ============================================================================================
// THE GAP IS THE PRODUCT
// ============================================================================================
// A single probability `p` with `1 - p` implied CANNOT represent two of the four states a
// two-sided measurement actually produces:
//
//   tc + fc <  1   IGNORANCE     no evidence has landed on the difference. `{0, 0}` is a claim
//                                nobody has looked at, and it is NOT `{0.5, 0.5}`.
//   tc + fc == 1   COHERENT      the classical probability case -- one point in a 2-D space,
//                                not the whole space.
//   tc + fc >  1   CONTRADICTION two sources both landed, pointing opposite ways. Under a
//                                single `p` this state is unrepresentable, so it is silently
//                                rendered as its own average -- which reads identically to
//                                "no evidence", the one state it is furthest from.
//
// `ignorance` and `contradiction` are therefore the point of the type, not a diagnostic on it.
// They are pure arithmetic over the two legs and carry no threshold.
//
// ============================================================================================
// REGISTER: `toy` FOR ANY READING, PLAIN ARITHMETIC FOR THE FACTS
// ============================================================================================
// `.claude/rules/toy-is-free-metered-must-be-earned.md`. NO CALIBRATION STUDY BACKS THIS FILE.
// Nothing here measures what a `trueChance` of 0.7 predicts about the world, so:
//
//   - The FACTS carry no threshold and no judgement: `mass`, `ignorance`, `contradiction`,
//     `massShape` are arithmetic and are honest at any register.
//   - The only function that JUDGES is `toyClassify`, it is named `toy`, and IT SHIPS NO
//     DEFAULT MARGIN. A default would be a calibrated threshold asserted without a
//     calibration, which is the silent-promotion failure that rule exists to prevent. The
//     caller supplies the margin and owns it.
//
// That split is also `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`: the
// mechanism reports the fact, the caller's oracle attaches the meaning. `contradiction` is a
// measured quantity; whether a contradiction means "one source is lying" or "the question was
// underspecified" is not this file's call and there is deliberately no enum for it.
//
// ============================================================================================
// CONSTRUCTORS REFUSE, THEY DO NOT CLAMP
// ============================================================================================
// A clamp turns a caller's bug into a plausible number. `dualScore(1.4, 0)` is a defect in the
// caller; clamping it to 1.0 produces a confident belief out of an arithmetic error and leaves
// nothing to find later. Every refusal below is a falsifier -- delete it and a test in
// `dual-score.test.ts` goes red.

/** The unit interval's ends, named so the refusal messages and the tests quote one source. */
export const UNIT_MIN = 0;
export const UNIT_MAX = 1;

/**
 * Two independent chances, each in [0,1]. They are NOT complementary: `falseChance` is never
 * `1 - trueChance`, and no function in this module derives either from the other.
 */
export interface DualScore {
  /** Chance the claim holds, as supplied by whatever evidence landed FOR it. */
  readonly trueChance: number;
  /** Chance the claim fails, as supplied by whatever evidence landed AGAINST it. Independent. */
  readonly falseChance: number;
}

/** Which leg a refusal is about. Both legs are checked, so a caller learns about both. */
export type DualScoreLeg = "trueChance" | "falseChance";

export type DualScoreRefusal =
  | { readonly reason: "not-finite"; readonly leg: DualScoreLeg | "margin"; readonly detail: string }
  | { readonly reason: "outside-unit-interval"; readonly leg: DualScoreLeg | "margin"; readonly detail: string }
  | { readonly reason: "not-a-dual-score"; readonly leg: null; readonly detail: string };

export type DualScoreResult =
  { readonly ok: true; readonly score: DualScore } | { readonly ok: false; readonly refusal: DualScoreRefusal };

function refuseUnit(leg: DualScoreLeg | "margin", value: number): DualScoreRefusal | null {
  if (!Number.isFinite(value)) {
    return {
      reason: "not-finite",
      leg,
      detail:
        `${leg} must be a finite number in [${UNIT_MIN}, ${UNIT_MAX}], got ${String(value)}. ` +
        `NaN and Infinity are refused rather than coerced: a coerced leg reads downstream as a ` +
        `measurement somebody took.`,
    };
  }
  if (value < UNIT_MIN || value > UNIT_MAX) {
    return {
      reason: "outside-unit-interval",
      leg,
      detail:
        `${leg} must lie in [${UNIT_MIN}, ${UNIT_MAX}], got ${value}. This is REFUSED, not ` +
        `clamped -- clamping turns a caller's arithmetic bug into a plausible belief and ` +
        `leaves nothing to find. Note the SUM of the two legs is NOT constrained: legs float ` +
        `independently, and a sum above 1 is contradiction, which is legal and is the signal.`,
    };
  }
  return null;
}

/**
 * The only constructor. Refuses out-of-range and non-finite legs; NEVER clamps, NEVER derives
 * one leg from the other, and NEVER constrains the SUM -- `{1, 1}` is a legal, maximally
 * contradictory belief and building it must succeed.
 */
export function dualScore(trueChance: number, falseChance: number): DualScoreResult {
  const t = refuseUnit("trueChance", trueChance);
  if (t !== null) return { ok: false, refusal: t };
  const f = refuseUnit("falseChance", falseChance);
  if (f !== null) return { ok: false, refusal: f };
  return { ok: true, score: { trueChance, falseChance } };
}

/**
 * Nothing has been observed either way -- maximal ignorance.
 *
 * This is the value a single-probability encoding cannot express, which is the whole argument
 * for the type: under one `p` "I have no evidence" collapses onto `0.5`, i.e. onto "I have
 * balanced evidence", and the two are opposite epistemic states.
 */
export const VACUOUS: DualScore = { trueChance: UNIT_MIN, falseChance: UNIT_MIN };

// ============================================================================================
// THE OTHER THREE CORNERS, NAMED -- ADDED BY THE CROSS-LANGUAGE TREATY
// ============================================================================================
// `src/Core/DualScore.fs` named all four of Belnap's corners from its first commit; this file
// named only `VACUOUS`, and the F# header recorded that as "declared divergence 3". A treaty is
// where a declared divergence gets paid off rather than re-documented: a corner that cannot be
// NAMED cannot be quantified over, and all four being reachable is the entire claim of the type.
//
// Falsifiers: `dual-score-treaty-transcript.test.ts` and `tests/Tests.FSharp/DualScoreTreaty.Tests.fs`
// both replay the `Corner` vectors POSITIONALLY out of `dual-score-treaty-transcript.json`, so a
// reordering or a re-valuing of any corner goes red in both runtimes.

/** Belnap `True` -- full support, no refutation. Residual 0, the classical point. */
export const ONLY_TRUE: DualScore = { trueChance: UNIT_MAX, falseChance: UNIT_MIN };

/** Belnap `False` -- full refutation, no support. Residual 0, the other classical point. */
export const ONLY_FALSE: DualScore = { trueChance: UNIT_MIN, falseChance: UNIT_MAX };

/**
 * Belnap `Both` -- the glut. Two sources both landed, pointing opposite ways. Residual -1, the
 * maximal Dutch book. Reported, never resolved.
 */
export const BOTH: DualScore = { trueChance: UNIT_MAX, falseChance: UNIT_MAX };

/**
 * The four corners in knowledge (`<=_k`) order: least informative first, then the two classical
 * points, then the glut. A roster, so callers and treaties quantify over the corners rather than
 * listing them. The ORDER is part of the contract -- `DualScore.corners` in F# is the same
 * sequence and the transcript pins it by position.
 */
export const CORNERS: readonly DualScore[] = [VACUOUS, ONLY_TRUE, ONLY_FALSE, BOTH];

/** Total mass on the two legs, in [0,2]. 1 is the classical-probability slice, not the norm. */
export function mass(s: DualScore): number {
  return s.trueChance + s.falseChance;
}

/**
 * `1 - (tc + fc)` when the legs under-fill, else 0. The bloom analogue's UNKNOWN region and
 * Dempster-Shafer's belief/plausibility gap: the part of the question no evidence has reached.
 */
export function ignorance(s: DualScore): number {
  const gap = 1 - mass(s);
  return gap > 0 ? gap : 0;
}

/**
 * `(tc + fc) - 1` when the legs over-fill, else 0. Two sources both landed and disagree; the
 * bloom analogue is a key present in BOTH the insert and the delete filter, and the logic
 * analogue is Belnap's `BOTH`.
 *
 * Reported, never resolved. `.claude/rules/dv2-data-split-discipline-activated.md` raw vault:
 * a single version of the facts, never a single version of the truth -- picking a winner here
 * would destroy the disagreement, which is the information. It is also the exact regime in
 * which Dempster's rule misbehaves (Zadeh's counterexample), so it is the last place to reach
 * for an unreviewed combination rule.
 */
export function contradiction(s: DualScore): number {
  const excess = mass(s) - 1;
  return excess > 0 ? excess : 0;
}

/**
 * `1 - (tc + fc)`, SIGNED -- the quantity `ignorance` and `contradiction` are the two clamped
 * halves of. Added by the cross-language treaty, which recorded it as F#'s declared divergence 2.
 *
 * The SIGN is the meaning, and both signs are priced:
 *
 *   r > 0  IGNORANCE     slack in Boole's conditions of possible experience (Boole 1854): a
 *                        polytope of classical joints fits, so the pair is imprecise, not wrong.
 *   r = 0  CLASSICAL     a classical assignment with P(A)=tc, P(!A)=fc exists exactly here.
 *   r < 0  CONTRADICTION de Finetti (1937) incoherence: a Dutch book exists, and `-r` is the
 *                        guaranteed loss per unit stake.
 *
 * `ignorance` and `contradiction` above are deliberately NOT rewritten in terms of this function.
 * They compute `1 - mass` and `mass - 1` independently, which is a second derivation of the same
 * quantity, and the treaty's `Facts` vectors check the two derivations against each other by BITS
 * rather than by value.
 *
 * >> THAT CHECK FOUND SOMETHING ON ITS FIRST RUN, WHICH IS WHY IT IS WORDED CAREFULLY HERE.
 * >> IEEE-754 round-to-nearest is symmetric under negation, so `-(1 - m)` and `m - 1` are the same
 * >> double AWAY FROM ZERO -- but at `r = 0` exactly they are `-0.0` and `+0.0`, which are not the
 * >> same bits. It does not escape: both clamps route the zero through their `> 0` branch and
 * >> return a literal positive zero, so `ignorance` and `contradiction` agree everywhere. A
 * >> refactor that returned the negated intermediate directly would break that, and the vectors
 * >> are what would say so.
 */
export function residual(s: DualScore): number {
  return 1 - mass(s);
}

/** The three-valued readout, structural and threshold-free: it depends only on `mass` vs 1. */
export type MassShape = "ignorant" | "coherent" | "contradictory";

export function massShape(s: DualScore): MassShape {
  const m = mass(s);
  if (m < 1) return "ignorant";
  if (m > 1) return "contradictory";
  return "coherent";
}

/**
 * The shape with a CALLER-SUPPLIED tolerance: a residual within +/-`tolerance` of zero reads
 * `coherent`. Added by the cross-language treaty, mirroring `DualScore.massShapeWithin`.
 *
 * >> WHY IT EXISTS: `massShape` IS THE WRONG READING FOR LEGS THAT CAME OUT OF FLOAT ARITHMETIC,
 * >> AND THAT WAS MEASURED RATHER THAN GUESSED. Projecting a normalised `SoftValue` through the
 * >> F# side's `SoftValueBelief.beliefOf` does not land on `coherent`: a 7/2/1 distribution sums
 * >> to 1.000000000000000222 (residual -2.220446049250313e-16, reading "contradictory") and a
 * >> `combine` posterior to 0.99999999999999988898 (residual +1.1102230246251565e-16, reading
 * >> "ignorant"). Those two signs are one ULP of float noise on either side of 1 and carry no
 * >> evidence whatever. Both masses are in the transcript, as bit patterns, for exactly that
 * >> reason -- neither is expressible as a short decimal literal.
 *
 * THERE IS NO DEFAULT TOLERANCE AND THERE WILL NOT BE ONE. The honest value depends on how the
 * legs were produced: a directly-stated pair wants 0, a sum of n floats wants something near
 * n ULP, a calibrated lane wants whatever its calibration says. Inventing one here would be an
 * unearned constant asserted as a measurement.
 *
 * Two implementation notes, both pinned by the treaty because both are places the two runtimes
 * could silently part company:
 *
 *   1. The comparison is on the RESIDUAL, never on a shifted mass. `mass < 1 - tol` rounds twice
 *      (once forming `1 - tol`, once in the sum) and disagrees with `residual > tol` at the ULP
 *      scale -- which is the only scale this function exists to serve.
 *   2. A negative tolerance folds to 0 and is NOT refused: it is a degenerate input to a total
 *      arithmetic function, not a belief that could mislead anyone downstream. `tolerance > 0 ?
 *      tolerance : 0` rather than `Math.max` is deliberate -- it sends NaN to 0, where
 *      `Math.max(0, NaN)` returns NaN, under which EVERY score would read `coherent`. F#'s `max`
 *      propagates NaN the same way (measured: `max 0.0 nan = NaN`), and its side was FIXED by
 *      this treaty to fold the same way. The transcript carries a NaN-tolerance vector, so this
 *      paragraph is a check rather than a claim.
 */
export function massShapeWithin(tolerance: number, s: DualScore): MassShape {
  const tol = tolerance > 0 ? tolerance : 0;
  const r = residual(s);
  if (r > tol) return "ignorant";
  if (r < -tol) return "contradictory";
  return "coherent";
}

/**
 * Swap the legs -- the belief about the negated claim. An involution: `swapLegs(swapLegs(s))`
 * is `s`, and it is NOT `1 - p` on either leg. Mass, ignorance and contradiction are all
 * invariant under it, which is the check that the two legs really are symmetric in the type.
 *
 * This is a RELABELLING of one score, not a combination of two, so it is safe to ship while the
 * algebra is under review: it introduces no rule for fusing evidence.
 */
export function swapLegs(s: DualScore): DualScore {
  return { trueChance: s.falseChance, falseChance: s.trueChance };
}

/** Structural equality on the two legs. */
export function equals(a: DualScore, b: DualScore): boolean {
  return a.trueChance === b.trueChance && a.falseChance === b.falseChance;
}

/**
 * >> THE ONE COMBINING OPERATION IN THIS MODULE, AND IT IS `toy` IN ITS NAME BECAUSE IT IS A
 * >> PLACEHOLDER FOR A DECISION NOBODY HAS MADE YET.
 *
 * Componentwise max. It is here because the refutation ledger has to DISPLAY several rows about
 * one hypothesis on one line, and the honest alternative -- printing nothing joint at all --
 * hides the case the whole primitive exists for (two witnesses who disagree).
 *
 * Why max rather than something cleverer: max is the weakest thing that is definitely not a
 * probabilistic fusion. It is the grow-only G-set join, so it is idempotent, commutative and
 * associative, which makes it safe under replay and reorder (DV2.0 #4, #6); and it SURFACES
 * conflict instead of resolving it -- `toyJoin({1,0}, {0,1})` is `{1,1}`, contradiction 1,
 * which is precisely what Dempster's rule gets famously wrong under Zadeh's counterexample.
 *
 * What it is NOT, and must not be read as: a belief-combination rule, a consensus operator, or
 * an answer to the `WSet` question above. It does not model independent evidence accumulating
 * (two weak witnesses stay weak under max, where any real fusion rule would strengthen them).
 * When the math team rules on the algebra, THIS FUNCTION IS THE ONE THAT GETS REPLACED, and the
 * `toy` prefix is what makes that search cheap.
 */
export function toyJoin(a: DualScore, b: DualScore): DualScore {
  return {
    trueChance: a.trueChance > b.trueChance ? a.trueChance : b.trueChance,
    falseChance: a.falseChance > b.falseChance ? a.falseChance : b.falseChance,
  };
}

/**
 * The one JUDGING function, and it is `toy`.
 *
 * A reading needs a margin, a margin is a calibrated threshold, and NOTHING IN THIS REPO HAS
 * CALIBRATED ONE for this primitive. So there is no default: the caller passes the margin and
 * owns the judgement. Shipping `margin = 0.5` here would be a `toy` number asserted as
 * `metered`, inside the file that argues against exactly that.
 */
export type ToyReading = "leans-true" | "leans-false" | "unknown" | "contradicted";

export type ToyClassifyResult =
  { readonly ok: true; readonly reading: ToyReading } | { readonly ok: false; readonly refusal: DualScoreRefusal };

export function toyClassify(s: DualScore, margin: number): ToyClassifyResult {
  const bad = refuseUnit("margin", margin);
  if (bad !== null) return { ok: false, refusal: bad };
  if (contradiction(s) > 0) return { ok: true, reading: "contradicted" };
  if (s.trueChance >= margin && s.falseChance < margin) return { ok: true, reading: "leans-true" };
  if (s.falseChance >= margin && s.trueChance < margin) return { ok: true, reading: "leans-false" };
  return { ok: true, reading: "unknown" };
}

/**
 * Parse an untrusted value (a JSON row, a network message) into a `DualScore`, refusing
 * anything that is not two in-range legs. Shape errors and range errors are both refusals --
 * a row with a missing leg must not default the missing one to 0, because 0 is a real and
 * meaningful value here ("no evidence landed") and would be indistinguishable from absence.
 */
export function parseDualScore(value: unknown): DualScoreResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      ok: false,
      refusal: {
        reason: "not-a-dual-score",
        leg: null,
        detail:
          `expected an object with trueChance and falseChance, got ` +
          `${value === null ? "null" : Array.isArray(value) ? "an array" : typeof value}`,
      },
    };
  }
  const r = value as Record<string, unknown>;
  for (const leg of ["trueChance", "falseChance"] as const) {
    if (typeof r[leg] !== "number") {
      return {
        ok: false,
        refusal: {
          reason: "not-a-dual-score",
          leg: null,
          detail:
            `'${leg}' must be present and a number, got ${r[leg] === undefined ? "nothing" : typeof r[leg]}. ` +
            `A missing leg is NOT defaulted to 0 -- 0 means "no evidence landed", which is a ` +
            `measurement, and absence is not.`,
        },
      };
    }
  }
  return dualScore(r["trueChance"] as number, r["falseChance"] as number);
}
