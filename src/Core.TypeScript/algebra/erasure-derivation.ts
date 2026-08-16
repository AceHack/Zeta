/**
 * erasure-derivation.ts — derive the bit count a Landauer meter is charged, instead of asserting it.
 *
 * ## The defect this module exists to close
 *
 * `entropy-tracker.ts` was repaired on 2026-08-13: `verifyLandauer().holds` had reduced to
 * `x >= x` and was replaced by `auditEntropyLedger`, whose heat-monotonicity field an exhaustive
 * sweep genuinely falsifies. That fixed the **instrument**. It did not fix the **input**:
 *
 * ```
 * measure(bitsErased: number): void   // the caller supplies the number
 * ```
 *
 * Every shipped caller handed it a literal — `measure(1)` per map mutation, `measure(1)` per event
 * append, `measure(batchSize)` per queue flush. A sound meter with an asserted input is the same
 * defect one layer in: nothing anywhere computed the bits an operation actually destroys, so the
 * ledger was only ever as honest as its constants.
 *
 * ## The quantity, and how it is computed
 *
 * Landauer 1961 prices **logical irreversibility**: a step whose output does not determine its
 * input dissipates at least `kT ln 2` per bit lost. Bennett 1973 is the converse — a bijective
 * step erases nothing and is thermodynamically free. So the bit count is a **property of the
 * operation**, not a policy choice, and it is measurable:
 *
 *   group the swept domain by the operation's **observable output**; the largest fibre is the
 *   number of inputs that become indistinguishable; `bitsErased = log2(largest fibre)`.
 *
 * `maxFibre === 1` is exactly injectivity, so it is exactly `Reversible`.
 *
 * This is the TypeScript twin of `tests/Tests.FSharp/Formal/WSet.ErasureClassification.Laws.Tests.fs`
 * (PR #10611), which measured the same quantity over the ℤ corner of `WSet` — 43 states, 1849 pairs
 * — and found `negate` (the retraction) at exactly 0.000 bits while `consolidate` reads 3.459 and
 * `tensor` 6.409. Same rule, same arithmetic, different substrate.
 *
 * ## Observable output — the one modelling choice, stated
 *
 * The observable output of an operation is **the post-state together with everything the operation
 * returns to its caller**. That choice is what makes `dequeue` reversible: the item is handed back,
 * so `(post-state, returned item)` determines the pre-state, so nothing was destroyed — the queue
 * moved information, it did not erase it. An operation that drops a payload on the floor is the
 * one that erases it, and it is a different operation.
 *
 * ## What is NOT modelled, deliberately
 *
 * This computes the **operation-level** figure: the worst case over the swept domain, with no
 * assumption about what the caller already knows. A finer, per-instance figure exists — writing to
 * a map slot that was empty destroys less than writing over an occupied one — but computing it
 * requires modelling caller-retained side information, which the two-ledger tracker does not carry.
 * Naming that boundary here is the point; silently picking one of the two readings is how a bit
 * count becomes a guess again.
 *
 * ## Anchors (Beacon)
 *
 * - Landauer 1961, *Irreversibility and Heat Generation in the Computing Process* — the `kT ln 2`
 *   floor per **erased** bit. The word doing the work is "erased".
 * - Bennett 1973, *Logical Reversibility of Computation* — a bijection pays nothing. This is why a
 *   meter on a reversible operation is not a weak meter but a meter with no signal: it reads zero
 *   for every input, forever, which is the structural reason a Landauer check degenerates into a
 *   tautology.
 * - Shapiro et al. 2011 (G-Set) — an append-only set is monotone and injective; that is the
 *   derivation for `APPEND_ONLY_ERASURE_BITS`.
 * - Goguen & Meseguer 1982 — noninterference (§13): the charge crosses a declared, metered door.
 *
 * Composes with: `entropy-tracker.ts` (the ledger charged), `physics-traits.ts` and
 * `../observe/event-sink-folder.ts` (the call sites), `key-erasure-meter.ts` (the guarded path).
 */

import { stringCompare } from "../collation/collation";

// ─── The sweep ───────────────────────────────────────────────────────────────

/** Thermodynamic class of an operation under Landauer/Bennett. */
export type ThermoClass =
  /** Injective on the swept domain — the observable output determines the input. Pays nothing. */
  | "reversible"
  /** Non-injective — distinct inputs collapse to one observable output. Pays per bit lost. */
  | "erasing";

export interface ErasureMeasurement {
  readonly thermoClass: ThermoClass;
  /** `log2(maxFibre)` — the bits an application of this operation destroys. */
  readonly bitsErased: number;
  /** Size of the largest set of inputs sharing one observable output. `1` ⇔ injective. */
  readonly maxFibre: number;
  /** Number of distinct observable outputs the domain produced. */
  readonly imageCount: number;
  /** Size of the swept domain. A sweep over 0 or 1 inputs proves nothing; see `sweptStates`. */
  readonly sweptStates: number;
}

/**
 * Measure an operation's erasure by exhaustive sweep.
 *
 * `observable` must render the operation's post-state **and its return value** as a string, and
 * must be injective on that pair — two different observable outputs must not collide in the
 * rendering, or the sweep will over-report erasure. Renderings use invariant formatting
 * (`.claude/rules/culture-invariant-by-default.md`).
 *
 * A domain of fewer than two states cannot exhibit a collision, so it cannot report `erasing`;
 * `sweptStates` is returned so a caller (and the test suite) can refuse a vacuous sweep rather
 * than read `reversible` off an empty domain.
 */
export function measureErasure<T>(
  domain: readonly T[],
  observable: (input: T) => string,
): ErasureMeasurement {
  const fibres = new Map<string, number>();
  for (const input of domain) {
    const image = observable(input);
    fibres.set(image, (fibres.get(image) ?? 0) + 1);
  }
  let maxFibre = 0;
  for (const count of fibres.values()) if (count > maxFibre) maxFibre = count;
  return {
    thermoClass: maxFibre > 1 ? "erasing" : "reversible",
    bitsErased: maxFibre > 1 ? Math.log2(maxFibre) : 0,
    maxFibre,
    imageCount: fibres.size,
    sweptStates: domain.length,
  };
}

/** Deterministic, locale-independent rendering of a list of parts for use as an image key. */
export function imageKey(parts: readonly string[]): string {
  return parts.join("");
}

/** Ordinal (code-point) sort — the canonical collation, never a locale one. */
export function sortOrdinal(values: readonly string[]): readonly string[] {
  return [...values].sort(stringCompare);
}

// ─── Derived charges, each with its derivation stated in its name and its doc ───

/**
 * The charge for an operation that hands its payload back to the caller: **exactly zero**.
 *
 * Derivation, not convention: if an operation returns its payload, `(post-state, returned value)`
 * determines the pre-state, so the operation is injective, so Bennett 1973 gives it no floor. A
 * meter attached here must read zero for every input forever — which is why attaching one is the
 * error, not merely an imprecision.
 *
 * Call sites: `FerryQueue.dequeue` and `FerryQueue.flush` (both return the items they remove),
 * `AdjArray.set` (returns the overwritten value as its own inverse).
 */
export const PAYLOAD_RETURNED_ERASURE_BITS = 0;

/**
 * The charge for an append to an append-only log: **exactly zero**.
 *
 * Derivation: the post-state contains the appended event, so the pre-state is the post-state minus
 * that event — injective. A G-Set never deletes, so a re-append of the same id is the identity,
 * which is injective as well. Nothing is destroyed by recording a fact.
 *
 * Call site: `../observe/event-sink-folder.ts` `folderSink.append`. What the append does NOT see is
 * the decision that produced the action — collapsing `buildMenu()`'s N candidates to one IS
 * erasing, at `log2(N)`, and it happens upstream of the sink. See `decisionErasureBits`.
 */
export const APPEND_ONLY_ERASURE_BITS = 0;

/**
 * Floor for a hash-map mutation (`put` / `delete`) when the value domain is **not declared**: 1 bit.
 *
 * Derivation, and why it is a floor rather than the value: for a fixed key `k`, `put(k, v)` sends
 * every pre-state agreeing off `k` to one post-state, so its fibre has `|V| + 1` members — one for
 * each value `k` could have held, plus the case where `k` was absent. Hence
 * `bitsErased = log2(|V| + 1)`, which for any non-empty value domain is at least `log2(2) = 1`.
 * `delete(k)` has the same fibre and therefore the same figure.
 *
 * So the `measure(1)` that shipped was not wrong — it was the **floor of a quantity nobody had
 * computed**, and it is exact only when `|V| = 1`. Declare `valueDomainBits` and
 * `mapMutationErasureBits` returns the actual number instead.
 */
export const MAP_MUTATION_ERASURE_FLOOR_BITS = 1;

/**
 * Bits erased by one hash-map mutation over a value domain of `2 ** valueDomainBits` values.
 *
 * `log2(2 ** valueDomainBits + 1)` — the `+1` is the "key was absent" pre-image, which the
 * post-state cannot distinguish from any occupied one. Returns the stated floor when the caller
 * does not declare a domain, because the honest answer there is "at least one bit, exact value
 * unknown", and a named floor with a derivation beats a bare literal.
 */
export function mapMutationErasureBits(valueDomainBits?: number): number {
  if (valueDomainBits === undefined) return MAP_MUTATION_ERASURE_FLOOR_BITS;
  if (!Number.isFinite(valueDomainBits) || valueDomainBits < 0) {
    return MAP_MUTATION_ERASURE_FLOOR_BITS;
  }
  return Math.log2(Math.pow(2, valueDomainBits) + 1);
}

/**
 * Bits erased by collapsing a decision from `candidateCount` candidates to one: `log2(N)`.
 *
 * This is the erasure that `event-sink-folder`'s `measure(1)` was pointed at and could not see —
 * the sink receives an action already chosen, so `N` is not available to it. Only the chooser knows
 * `N` (`observe.ts` `buildMenu`), which is why the sink takes this as an injected supplier rather
 * than guessing. `N <= 1` is not a decision at all and erases nothing.
 */
export function decisionErasureBits(candidateCount: number): number {
  if (!Number.isFinite(candidateCount) || candidateCount <= 1) return 0;
  return Math.log2(candidateCount);
}

/**
 * Bits erased by destroying key material of `keyBits` bits: exactly `keyBits`.
 *
 * Derivation: after the erasure the post-state is the same whichever of the `2 ** keyBits` keys was
 * held, so the fibre has `2 ** keyBits` members and `log2` of it is `keyBits`. This is the one
 * shipped call site whose constant was already the derived value —
 * `key-erasure-meter.ts` `meterKeyErasure` charges `record.bits`, taken from the admission record
 * rather than from the claimant.
 */
export function keyMaterialErasureBits(keyBits: number): number {
  if (!Number.isFinite(keyBits) || keyBits <= 0) return 0;
  return keyBits;
}

// ─── The declared classification (what the sweep is checked against) ─────────

/**
 * A declared thermodynamic class for one operation of one algebra surface.
 *
 * The declaration is the claim; the sweep in `erasure-derivation.test.ts` is the check. The pair
 * fails in **both** directions — a "reversible" operation made lossy, and an "erasing" operation
 * made bijective — and a coverage guard fails when an operation is added without a row, so the
 * table cannot silently go stale the way an unread counter does.
 */
export interface DeclaredErasure {
  readonly surface: string;
  readonly operation: string;
  readonly declared: ThermoClass;
  /** Why — the derivation in one line, so a reader is not asked to take the row on trust. */
  readonly basis: string;
}
