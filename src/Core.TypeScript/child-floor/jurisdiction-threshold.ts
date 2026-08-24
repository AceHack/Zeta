// jurisdiction-threshold.ts — the executable mirror of `src/Core.Lean4/Safety/ChildFloorPolicy.lean`.
//
// THE SHAPE. The child floor has two halves that must not be confused for one another:
//
//   * the PREDICATE — protect children — is INVARIANT. It is not a competing morality submitted
//     to the Multi-Oracle Principle (manifesto §11); it is the floor every oracle stands on.
//   * the THRESHOLD — roughly 16 to 21 — is JURISDICTIONAL. A parameter, and disagreement about
//     it is expected and legitimate.
//
//   Aaron 2026-08-24: "the fixed moral floor is always protect children and disagree on their
//   age around 16-21."
//
// WHAT THIS FILE IS AND IS NOT. The Lean module PROVES, for every registry, that no reading can
// lower the floor and that an unknown jurisdiction denies. This file is the running copy of the
// same functions, so a deployment can call it — it does not add a guarantee, it inherits one,
// and if the two ever disagree the Lean is right. `jurisdiction-threshold.test.ts` is what keeps
// them from disagreeing: the same sabotage registries appear in both.
//
// NOT LEGAL ADVICE, and the data is not law. See db/child-floor/README.md.

/** Slash-separated scope path — the shape `planning/competence-attribution.ts` already uses. */
export type Jurisdiction = string;

/**
 * The lowest threshold a jurisdiction may declare. Byte-locked to `bandLow` in
 * `Safety/ChildFloorPolicy.lean` and to `band.low` in `db/child-floor/jurisdiction-readings.json`;
 * `hygiene/lint-child-floor-registry.ts` fails if the three disagree.
 */
export const BAND_LOW = 16;

/**
 * The highest threshold a jurisdiction may declare — and therefore the value taken whenever the
 * jurisdiction is unknown or its reading was rejected. Unknown resolves UP, never down.
 */
export const BAND_HIGH = 21;

/**
 * One jurisdiction's declared threshold. `attributedTo` and `dated` are required because a
 * threshold is somebody's reading at a moment, not a fact of nature — an anonymous entry would
 * read as a statement of law, which it is not.
 */
export interface Reading {
  readonly jurisdiction: Jurisdiction;
  /** Age in whole years at or above which a child-gated effect is admitted. */
  readonly threshold: number;
  readonly attributedTo: string;
  /** ISO-8601 date the reading was made. */
  readonly dated: string;
  /** What the reading rests on. Free text; nothing interprets it. */
  readonly basis?: string;
}

/**
 * A reading counts only if its threshold is inside the declared band. THIS is where "no
 * jurisdiction may turn the floor off" is enforced: `threshold: 0` is not accepted, and the
 * resolver falls through to the protective bound. Non-integer and non-finite are rejected too —
 * `17.5` is not a reading, it is a typo, and silently flooring it would be the resolver deciding
 * a legal question.
 */
export function accepted(r: Reading): boolean {
  return (
    Number.isInteger(r.threshold) && r.threshold >= BAND_LOW && r.threshold <= BAND_HIGH
  );
}

/**
 * The effective threshold for one jurisdiction. Unknown code, or a code whose only readings were
 * rejected, resolves to `BAND_HIGH`.
 *
 * Deliberately NOT hierarchical: `world/us/oh` does not inherit `world/us`. Inheritance is a
 * fallback path, and a fallback path is where a permissive answer gets in.
 */
export function resolve(registry: readonly Reading[], j: Jurisdiction): number {
  const hit = registry.find((r) => r.jurisdiction === j && accepted(r));
  return hit === undefined ? BAND_HIGH : hit.threshold;
}

/**
 * Several jurisdictions in play — take the MAX, the protective bound on disagreement. The empty
 * list is the nothing-named case and resolves to `BAND_HIGH`, not to anything permissive.
 *
 * The seed is `BAND_LOW`, not `BAND_HIGH`: every resolution is `>= BAND_LOW`, so the seed can
 * never win. Seeding at `BAND_HIGH` would pin every answer at 21 and the jurisdiction parameter
 * would silently do nothing — which is what the Lean's `resolveAll_singleton` and this module's
 * "a single jurisdiction resolves to its own reading" test exist to catch.
 */
export function resolveAll(registry: readonly Reading[], js: readonly Jurisdiction[]): number {
  if (js.length === 0) return BAND_HIGH;
  return js.reduce((acc, j) => Math.max(acc, resolve(registry, j)), BAND_LOW);
}

/** What the gate knows about the subject. `unknown` is a real state and must stay one. */
export type Subject = { readonly kind: "age"; readonly years: number } | { readonly kind: "unknown" };

export const unknownAge: Subject = { kind: "unknown" };
export function age(years: number): Subject {
  return { kind: "age", years };
}

/** Whether an effect is in the child-floor-gated class. Supplied by the deployment's classifier. */
export type EffectClass = "child-gated" | "ungated";

/** The gate's verdict — the same two values as `ChildFloor.Verdict`. */
export type Verdict = "admit" | "deny";

/**
 * The floor. Unknown age denies; below the threshold denies; at or above admits.
 *
 * A non-integer or non-finite age denies: an age the caller could not establish as a whole number
 * is an age the caller does not have, and that is the unknown case wearing a number.
 */
export function floorVerdict(threshold: number, s: Subject): Verdict {
  if (s.kind === "unknown") return "deny";
  if (!Number.isInteger(s.years)) return "deny";
  return s.years < threshold ? "deny" : "admit";
}

/**
 * The concrete policy. A child-gated effect faces the floor at the resolved threshold; anything
 * else is not this policy's business and passes through — other red lines are other policies, and
 * composing them can only remove admissions, never add one.
 */
export function childFloorPolicy(
  registry: readonly Reading[],
  js: readonly Jurisdiction[],
  cls: EffectClass,
  s: Subject,
): Verdict {
  if (cls === "ungated") return "admit";
  return floorVerdict(resolveAll(registry, js), s);
}

/** A refusal from `validateRegistry`, one per offending entry. */
export interface RegistryViolation {
  readonly kind:
    | "threshold-below-band"
    | "threshold-above-band"
    | "threshold-not-integer"
    | "missing-attribution"
    | "missing-or-malformed-date"
    | "duplicate-jurisdiction"
    | "empty-jurisdiction";
  readonly jurisdiction: string;
  readonly detail: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Refuse a malformed registry LOUDLY, rather than letting `resolve` silently skip the entry.
 *
 * The two behaviours are deliberately different and both are wanted. `resolve` must fail closed
 * at runtime whatever it is handed — that is the safety property, and it holds unconditionally.
 * `validateRegistry` is the authoring-time check that says the entry is broken instead of letting
 * it sit in the file looking effective: an out-of-band reading that is quietly ignored is a
 * jurisdiction that believes it declared 15 and got 21.
 */
export function validateRegistry(registry: readonly Reading[]): RegistryViolation[] {
  const out: RegistryViolation[] = [];
  const seen = new Set<string>();
  for (const r of registry) {
    const j = r.jurisdiction;
    if (typeof j !== "string" || j.trim().length === 0) {
      out.push({ kind: "empty-jurisdiction", jurisdiction: String(j), detail: "jurisdiction is required" });
    } else if (seen.has(j)) {
      out.push({
        kind: "duplicate-jurisdiction",
        jurisdiction: j,
        detail: "a second reading for the same jurisdiction; the resolver would use the first and the second would be invisible",
      });
    } else {
      seen.add(j);
    }
    if (!Number.isInteger(r.threshold)) {
      out.push({
        kind: "threshold-not-integer",
        jurisdiction: j,
        detail: `threshold ${String(r.threshold)} is not a whole number of years`,
      });
    } else if (r.threshold < BAND_LOW) {
      out.push({
        kind: "threshold-below-band",
        jurisdiction: j,
        detail: `threshold ${r.threshold} is below the floor ${BAND_LOW}; the predicate is not a parameter`,
      });
    } else if (r.threshold > BAND_HIGH) {
      out.push({
        kind: "threshold-above-band",
        jurisdiction: j,
        detail: `threshold ${r.threshold} is above the declared band high ${BAND_HIGH}`,
      });
    }
    if (typeof r.attributedTo !== "string" || r.attributedTo.trim().length === 0) {
      out.push({
        kind: "missing-attribution",
        jurisdiction: j,
        detail: "a reading with no named author reads as a statement of law; it is not one",
      });
    }
    if (typeof r.dated !== "string" || !ISO_DATE.test(r.dated)) {
      out.push({
        kind: "missing-or-malformed-date",
        jurisdiction: j,
        detail: "dated must be an ISO-8601 calendar date (YYYY-MM-DD); a reading without a date cannot be revised against",
      });
    }
  }
  return out;
}
