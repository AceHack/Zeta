/**
 * erasure-charge.ts — the CHARGE side of the erasure vocabulary, and the TypeScript oracle for
 * `src/Core/ErasureCharge.fs`.
 *
 * `erasure-class.ts` says what an operation *is*. `entropy-tracker.ts` is a ledger that charges.
 * Nothing joined them: the tracker's five call sites each hand it a number computed by
 * `erasure-derivation.ts`, and the declared classifications — the ones backed by an exhaustive
 * sweep, checked in both directions — were charged by nobody at all. This module is the join, and
 * it holds **no roster of its own**: `dispositionOf` reads `classification` and `evidence`, never
 * `representation`, `operation`, or `observation`.
 *
 * That restriction is the whole lesson of the correction that produced this apparatus. A list of
 * erasing operations keyed by NAME was written twice and was wrong twice, and cannot be made right
 * in principle, because `TruncateAsync` is erasing under one backend and reversible under another.
 * A second list is the defect, so there is no second list.
 *
 * ## `unmeasured` does not charge zero
 *
 * Three treatments were available for an operation nobody has swept: charge `0` (the demon —
 * a channel that reads as free because the ledger is closed), charge a stated upper bound (there
 * is none to state without **inventing a coefficient**), or refuse the fold and carry the hole in
 * the total's type. The third is taken. `settle` returns a `Reading` that is either `complete`
 * with a total, or incomplete with the measured sum **and the named holes**; `readTotal` refuses
 * to hand back the number without the flag. A `LowerBound` is also the physically correct
 * direction, since Landauer's `kT ln 2` is a floor.
 *
 * ## Bits are never summed across observations
 *
 * A representation's operation can carry opposite classes under two observations and both be
 * honest — `ZetaFsDeltaLog.TruncateAsync` is erasing through the log's read surface and unmeasured
 * on the physical medium. Summing those produces a number describing no observer, so `settleAll`
 * returns one reading **per observation** and offers no way to collapse them.
 *
 * ## Cross-oracle agreement is the point (BP-16)
 *
 * The F# module and this one implement the same four-case disposition rule over the same
 * declaration shape. `erasure-charge.test.ts` and
 * `tests/Tests.FSharp/Formal/Erasure.Charge.Laws.Tests.fs` assert the same dispositions on the
 * same fixture profiles, so a divergence in either implementation is caught by the other. Two
 * independent tools on one property is what makes this evidence rather than a claim.
 *
 * Anchors (Beacon): Landauer 1961 (`kT ln 2` per *erased* bit — a floor, hence the lower bound);
 * Bennett 1973 (a bijection pays nothing, hence `free` requires a *measured* fibre of 1);
 * Goguen-Meseguer 1982 (noninterference — the charge crosses a declared, metered door).
 */

import {
  bitsErasedPpm,
  largestFibre,
  profileKey,
  type ErasureProfile,
} from "./erasure-class.ts";
import type { EntropyTracker } from "./entropy-tracker.ts";

/** What a ledger does with one declared profile. Four cases, and only the first is free. */
export type Disposition =
  /** Measured injective — fibre 1, exactly 0 bits. Bennett-free, and the only route to zero. */
  | { readonly kind: "free" }
  /** Measured non-injective — charge the declared `log2(largest fibre)` in ppm. Always > 0. */
  | { readonly kind: "charged"; readonly bitsPpm: number }
  /** No admissible measurement. **Not zero, not free.** Carries the declaration's written reason. */
  | { readonly kind: "unmeasured"; readonly reason: string }
  /** The declaration contradicts its own evidence. Fails closed into the hole set. */
  | { readonly kind: "malformed"; readonly complaint: string };

/**
 * The disposition of one profile, derived from `classification` and `evidence` **only**.
 *
 * A maintainer who adds a name-based special case here reintroduces the list this module exists to
 * delete, and the rename test in `erasure-charge.test.ts` goes red the moment they do.
 */
export function dispositionOf(p: ErasureProfile): Disposition {
  const fibre = largestFibre(p);
  const ppm = bitsErasedPpm(p);

  if (p.classification === "reversible" && fibre === 1 && ppm === 0) return { kind: "free" };
  if (p.classification === "erasing" && fibre !== undefined && ppm !== undefined && fibre > 1 && ppm > 0) {
    return { kind: "charged", bitsPpm: ppm };
  }
  if (p.classification === "unmeasured" && fibre === undefined && ppm === undefined) {
    const reason = p.evidence.kind === "no-admissible-measurement" ? p.evidence.reason.trim() : "";
    return reason.length > 0
      ? { kind: "unmeasured", reason }
      : { kind: "malformed", complaint: "unmeasured with no written reason — a hole must say why it is a hole" };
  }
  // Everything else is a declaration at war with its own evidence: reversible over a wide fibre,
  // erasing over a fibre of 1, unmeasured carrying a sweep. Charging any of them would be picking
  // a side in a contradiction.
  return {
    kind: "malformed",
    complaint:
      `classification ${p.classification} does not agree with its evidence ` +
      `(fibre=${fibre ?? "none"}, ppm=${ppm ?? "none"})`,
  };
}

/** One hole: the profile key, and why its cost is unknown. */
export interface Hole {
  readonly key: string;
  readonly why: string;
}

/**
 * A settled total for ONE observation.
 *
 * `complete: false` means `bitsPpm` is a **lower bound**: it is what the measured postings cost,
 * and `holes` names every operation whose cost is unknown. Never quote `bitsPpm` without `complete`.
 */
export interface Reading {
  readonly bitsPpm: number;
  readonly complete: boolean;
  readonly holes: readonly Hole[];
  /** Postings by disposition — a hole hit ten times is visibly not a hole hit once. */
  readonly chargedPostings: number;
  readonly freePostings: number;
  readonly holePostings: number;
}

/**
 * Fold a list of postings for a single observation into a reading.
 *
 * Each element is one INVOCATION. Repeating a profile charges again (bits accumulate) while the
 * hole SET stays keyed, so identity is idempotent and use is cumulative.
 */
export function settle(postings: readonly ErasureProfile[]): Reading {
  let bitsPpm = 0;
  let chargedPostings = 0;
  let freePostings = 0;
  let holePostings = 0;
  const holes = new Map<string, string>();

  for (const p of postings) {
    const d = dispositionOf(p);
    switch (d.kind) {
      case "free":
        freePostings += 1;
        break;
      case "charged":
        bitsPpm += d.bitsPpm;
        chargedPostings += 1;
        break;
      case "unmeasured":
        holes.set(profileKey(p), `unmeasured: ${d.reason}`);
        holePostings += 1;
        break;
      case "malformed":
        holes.set(profileKey(p), `malformed: ${d.complaint}`);
        holePostings += 1;
        break;
    }
  }

  return {
    bitsPpm,
    complete: holes.size === 0,
    holes: [...holes].map(([key, why]) => ({ key, why })),
    chargedPostings,
    freePostings,
    holePostings,
  };
}

/**
 * Settle postings per DECLARED OBSERVATION. Bits measured against different observers are never
 * added, so the return is a map and there is no operation that collapses it.
 */
export function settleAll(postings: readonly ErasureProfile[]): ReadonlyMap<string, Reading> {
  const byObservation = new Map<string, ErasureProfile[]>();
  for (const p of postings) {
    const bucket = byObservation.get(p.observation);
    if (bucket === undefined) byObservation.set(p.observation, [p]);
    else bucket.push(p);
  }
  const out = new Map<string, Reading>();
  for (const [observation, ps] of byObservation) out.set(observation, settle(ps));
  return out;
}

/**
 * Post one invocation of a classified operation to the two-ledger tracker.
 *
 * This is the wire the thread was missing: the bit count handed to `measure` comes from the
 * profile's own **measurement**, not from a caller's constant, and an operation nobody swept goes
 * through `unmeasured()` rather than through `permutation()` or a silent `measure(0)`. The three
 * doors are distinguishable in the audit precisely so this routing cannot be lossy.
 *
 * Bits are charged in whole bits, since that is the tracker's unit; the ppm figure is the
 * declaration's. Rounding is `Math.round`, matching `bitsPpmOfLargestFibre`'s own rounding, and
 * the ppm-precise figure remains available through `settle` for anyone who needs it.
 */
export function postToTracker(tracker: EntropyTracker, p: ErasureProfile): Disposition {
  const d = dispositionOf(p);
  switch (d.kind) {
    case "free":
      // A MEASURED bijection. This is the one honest zero.
      tracker.permutation();
      break;
    case "charged":
      tracker.measure(d.bitsPpm / 1_000_000);
      break;
    case "unmeasured":
      tracker.unmeasured(`${profileKey(p)} — ${d.reason}`);
      break;
    case "malformed":
      // A self-contradicting declaration is not free either. Fail closed into the hole set.
      tracker.unmeasured(`${profileKey(p)} — malformed declaration: ${d.complaint}`);
      break;
  }
  return d;
}
