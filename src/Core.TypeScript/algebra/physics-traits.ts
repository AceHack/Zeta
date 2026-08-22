/**
 * src/Core.TypeScript/algebra/physics-traits.ts — CSLib → Physics trait mapping.
 *
 * Every data structure has a thermodynamic character: its operations are either
 * reversible (Adj, zero heat) or irreversible (non-Adj, Landauer cost). This
 * file classifies the standard collection types by their Physics trait and wires
 * them to the entropy tracker so operations are metered.
 *
 * The three Physics traits (proven orthogonal in Lean: AdjCtlOrthogonality.lean):
 *
 *   Adj    — reversible random-access. Read/write at index is invertible (the
 *            index IS the inverse lookup). No information erased. Zero heat.
 *            Exemplar: Array (index-addressed, bijective access).
 *
 *   non-Adj — irreversible hash/collapse. The hash function maps many keys to
 *            one bucket — information is erased at insertion. Landauer cost per op.
 *            Exemplar: HashMap (hash = erasure, collision = branch collapse).
 *
 *   Ferry  — batched commit at the boundary. Accumulates uncertainty (branches)
 *            then flushes in one measurement (the ferry commit). Cost is amortized
 *            over the batch — predictive advantage when batch size is known ahead.
 *            Exemplar: Queue (enqueue = branch, dequeue-batch = ferry commit).
 *
 * This maps DIRECTLY onto the entropy tracker:
 *   - Adj ops call tracker.observe() (free, Bennett)
 *   - non-Adj ops call tracker.measure(mapMutationErasureBits(...)) (Landauer)
 *   - Ferry ops call tracker.branch() on enqueue; the drain legs pay nothing (see below)
 *
 * ## The bit counts are DERIVED now, not asserted (2026-08-14)
 *
 * Every `measure()` below used to take a literal — `measure(1)` per mutation, `measure(batchSize)`
 * per flush. Nothing computed what an operation actually destroys, so the ledger was only as
 * honest as its constants. Each charge now comes from `erasure-derivation.ts`, where the number
 * has a derivation, and each is checked against an exhaustive sweep in `erasure-derivation.test.ts`
 * that measures the class from the operation itself.
 *
 * Two of the four charges were pointed at **reversible** operations:
 *
 *   - `FerryQueue.dequeue` returned the item and charged 1 bit.
 *   - `FerryQueue.flush` returned the whole batch and charged `batchSize` bits.
 *
 * Both hand their payload back to the caller, so `(post-state, returned value)` determines the
 * pre-state: they are bijections, and Bennett 1973 gives a bijection no floor. A meter there is not
 * an imprecise meter, it is a meter with no signal — it must read zero for every input, forever.
 * That is the same siting error PR #10611 found on `WSet.negate`, and it is the structural reason a
 * Landauer check degenerates into a tautology. Both now call `tracker.permutation()`, the tracker's
 * existing word for "bijective, no entropy change". A queue that returns what it stored destroys
 * nothing; the erasure belongs to whoever drops the batch, and that is not this structure's charge
 * to make.
 *
 * The map's `measure(1)` survives — but as the *floor* of `log2(|V| + 1)`, named and derived, and
 * it becomes the exact figure as soon as a caller declares `valueDomainBits`.
 *
 * Composes with:
 *   - src/Core.TypeScript/algebra/entropy-tracker.ts (the metered door)
 *   - src/Core.TypeScript/algebra/erasure-derivation.ts (where each bit count is derived)
 *   - src/Core.TypeScript/algebra/interfaces.ts (IGroup, IJoinSemilattice)
 *   - src/Core.Lean4/Lean4/AdjCtlOrthogonality.lean (the proof: Adj ⊥ Ctl)
 *   - src/Core.Lean4/Lean4/LandauerFloor.lean (the cost contract)
 *   - src/Core.TypeScript/observe/event-sink-folder.ts (the ferry commit in production)
 */

import type { EntropyTracker } from "./entropy-tracker";
import { mapMutationErasureBits } from "./erasure-derivation";

// ═══ Physics Trait Classification ══════════════════════════════════════════════

/** The three physics traits a data structure can exhibit. */
export type PhysicsTrait = "adj" | "non-adj" | "ferry";

/** A metered collection: wraps a data structure with entropy accounting. */
export interface MeteredCollection {
  readonly trait: PhysicsTrait;
  readonly tracker: EntropyTracker;
}

// ═══ Adj: Array (reversible random-access, zero heat) ══════════════════════════

/**
 * AdjArray — an entropy-metered array where every operation is reversible.
 *
 * WHY Array = Adj: index-based access is a BIJECTION between positions and values.
 * Reading `arr[i]` and writing `arr[i] = v` are each other's inverse (given the
 * index). No information is erased — the index IS the undo key. This is the
 * Maxwell's demon reading for free: `observe()` on every access, zero heat.
 *
 * In Q# terms: Array operations carry `is Adj` — they are self-adjoint at each index.
 */
export interface AdjArray<T> extends MeteredCollection {
  readonly trait: "adj";
  readonly length: number;
  /** Read at index — Adj (reversible peek, zero heat). */
  get(index: number): T | undefined;
  /** Write at index — Adj (reversible overwrite: old value is the inverse). */
  set(index: number, value: T): T | undefined; // returns old value (the inverse)
  /** Iterate — Adj (sequential observation, zero heat). */
  toArray(): readonly T[];
}

/**
 * Create an entropy-metered Adj array. Every access calls `tracker.observe()`.
 */
export function createAdjArray<T>(tracker: EntropyTracker, initial: T[] = []): AdjArray<T> {
  const data = [...initial];

  return {
    trait: "adj",
    tracker,
    get length() { return data.length; },

    get(index: number): T | undefined {
      // Adj read: observe without destroying. Free (Bennett).
      tracker.observe();
      return data[index];
    },

    set(index: number, value: T): T | undefined {
      // Adj write: the OLD value is preserved (returned) — reversible.
      // The index is the undo key; the old value is the inverse.
      tracker.observe(); // read the old value (Adj)
      const old = data[index];
      data[index] = value;
      // No measure(), and now for a derived reason rather than a stated one: the old value is
      // RETURNED, so (post-state, returned value) determines the pre-state — injective, so
      // PAYLOAD_RETURNED_ERASURE_BITS = 0. The sweep in erasure-derivation.test.ts measures it.
      return old;
    },

    toArray(): readonly T[] {
      // Sequential observation — each element peeked, zero heat.
      tracker.observe();
      return [...data];
    },
  };
}

// ═══ Non-Adj: HashMap (irreversible hash, Landauer cost) ═══════════════════════

/**
 * NonAdjMap — an entropy-metered hash map where every mutation is irreversible.
 *
 * WHY HashMap = non-Adj: the hash function maps a large key space to a small
 * bucket space — information is ERASED (many keys → one bucket). Insertion is
 * a measurement: the key's identity collapses into its hash. This is the
 * Maxwell's demon ERASING: `measure(1)` on every mutating op, Landauer heat paid.
 *
 * In Q# terms: HashMap operations are NOT `is Adj` — they cannot be undone
 * without external memory (you'd need to remember the pre-hash key).
 *
 * The Lean proof (AdjCtlOrthogonality): join-semilattice operations (merge/put)
 * are idempotent + monotone + non-invertible = non-Adj. HashMap's put is exactly
 * this: `put(k, v)` is idempotent (put twice = put once) and non-invertible
 * (you can't recover the previous value without external log).
 */
export interface NonAdjMap<K, V> extends MeteredCollection {
  readonly trait: "non-adj";
  readonly size: number;
  /** Get — observe (Adj read, zero heat). */
  get(key: K): V | undefined;
  /** Has — observe (Adj read, zero heat). */
  has(key: K): boolean;
  /** Put — non-Adj (hash = erasure, Landauer cost). */
  put(key: K, value: V): void;
  /** Delete — non-Adj (erasure of the entry, Landauer cost). */
  delete(key: K): boolean;
  /** Entries — observe (sequential read, zero heat). */
  entries(): ReadonlyMap<K, V>;
}

/** How a `NonAdjMap` declares what its values are, so the erasure figure can be exact. */
export interface NonAdjMapOptions {
  /**
   * `log2` of the number of distinct values this map can hold, if the caller knows it.
   *
   * Supplying it turns the mutation charge from a floor into the derived figure
   * `log2(2 ** valueDomainBits + 1)`. Omitting it is allowed and is not a silent guess: the charge
   * falls back to `MAP_MUTATION_ERASURE_FLOOR_BITS`, a named constant whose doc carries the
   * derivation showing it is a lower bound rather than a measurement.
   */
  readonly valueDomainBits?: number;
}

/**
 * Create an entropy-metered non-Adj hash map. Reads call `tracker.observe()`; mutations call
 * `tracker.measure(mapMutationErasureBits(opts.valueDomainBits))`.
 *
 * The mutation charge is derived, not asserted: for a fixed key, `put` and `delete` both send every
 * pre-state agreeing off that key to one post-state, so the fibre has `|V| + 1` members and
 * `bitsErased = log2(|V| + 1)`. With no declared value domain that is at least 1 bit, which is
 * exactly the literal that used to be here — so the old `measure(1)` was the floor of a quantity
 * nobody had computed, and it is exact only for a single-valued domain.
 */
export function createNonAdjMap<K, V>(
  tracker: EntropyTracker,
  opts: NonAdjMapOptions = {},
): NonAdjMap<K, V> {
  const data = new Map<K, V>();
  // Computed once: the figure is a property of the value domain, not of any particular mutation.
  const mutationBits = mapMutationErasureBits(opts.valueDomainBits);

  return {
    trait: "non-adj",
    tracker,
    get size() { return data.size; },

    get(key: K): V | undefined {
      // Read is Adj — the key IS the lookup inverse. Zero heat.
      tracker.observe();
      return data.get(key);
    },

    has(key: K): boolean {
      // Existence check is Adj — no state change. Zero heat.
      tracker.observe();
      return data.has(key);
    },

    put(key: K, value: V): void {
      // non-Adj: the old value is lost (overwritten, never returned), and the post-state cannot
      // distinguish "this key was absent" from "this key held v" for any v. Fibre = |V| + 1, so
      // the charge is log2(|V| + 1) — derived, not asserted.
      tracker.measure(mutationBits);
      data.set(key, value);
    },

    delete(key: K): boolean {
      // non-Adj: same fibre as `put`. After the delete, the post-state is identical whether the
      // key was absent or held any one of the |V| values, so log2(|V| + 1) bits are gone.
      tracker.measure(mutationBits);
      return data.delete(key);
    },

    entries(): ReadonlyMap<K, V> {
      // Sequential observation — zero heat.
      tracker.observe();
      return new Map(data);
    },
  };
}

// ═══ Ferry: Queue (batched commit at dequeue boundary) ══════════════════════════

/**
 * FerryQueue — an entropy-metered queue where enqueue is a branch (adds
 * uncertainty) and dequeue-batch is a ferry commit (pays Landauer for the batch).
 *
 * WHY Queue = Ferry: a queue ACCUMULATES work (enqueue = branching the possibility
 * space — each item is a new possibility the system might act on) and then FLUSHES
 * in batch (dequeue = the ferry commit, collapsing all accumulated branches into
 * one committed batch). The cost is AMORTIZED: `measure(batchSize)` at flush time,
 * not `measure(1)` per item.
 *
 * This IS the event-sink pattern: the observe loop queues actions (branches), then
 * the folder sink commits them as a batch (the ferry). The `accountFerryCommit`
 * function in entropy-tracker.ts computes the finite-time excess for this pattern.
 *
 * Predictive advantage: knowing the batch size B BEFORE the flush lets the
 * scheduler stretch the erasure window τ, reducing L²/τ excess. A reactive queue
 * (flush immediately on each enqueue) pays maximum excess. A predictive queue
 * (accumulate to known B, flush on schedule) approaches the Landauer floor.
 */
export interface FerryQueue<T> extends MeteredCollection {
  readonly trait: "ferry";
  readonly pending: number; // items accumulated (branches taken, not yet committed)
  /** Enqueue — branch (adds 1 bit of uncertainty to the possibility space). */
  enqueue(item: T): void;
  /** Peek — observe (Adj, zero heat). */
  peek(): T | undefined;
  /** Dequeue one — REVERSIBLE. The item is returned, so nothing is erased and nothing is paid. */
  dequeue(): T | undefined;
  /** Flush all — REVERSIBLE. The batch is returned, so nothing is erased and nothing is paid. */
  flush(): readonly T[];
  /** Snapshot without consuming — observe (Adj, zero heat). */
  snapshot(): readonly T[];
}

/**
 * Create an entropy-metered ferry queue. Enqueue calls `tracker.branch()`; `dequeue` and `flush`
 * call `tracker.permutation()` and pay **nothing**.
 *
 * They used to call `tracker.measure(1)` and `tracker.measure(pending)`. Both were meters on
 * bijections: each returns the items it removes, so `(post-state, returned value)` determines the
 * pre-state, and Bennett 1973 gives a bijection no floor. The charge was a counting convention
 * wearing a thermodynamic name. See the module header.
 *
 * `enqueue` still calls `branch()` for a flat +1 per item. That is the ADMISSION side of the
 * ledger, not a heat charge, and its `+1` remains an asserted unit rather than a derived one — the
 * queue does not know how many bits an item carries. It is named here rather than quietly fixed,
 * because deriving it needs a declared item domain the shipped callers do not supply.
 */
export function createFerryQueue<T>(tracker: EntropyTracker): FerryQueue<T> {
  const data: T[] = [];

  return {
    trait: "ferry",
    tracker,
    get pending() { return data.length; },

    enqueue(item: T): void {
      // Branch: +1 bit of uncertainty. A new possibility enters the space.
      // The item is NOT committed yet — it's in the soft lane (Ledger A).
      tracker.branch();
      data.push(item);
    },

    peek(): T | undefined {
      // Observe: read without consuming. Adj, zero heat.
      tracker.observe();
      return data[0];
    },

    dequeue(): T | undefined {
      if (data.length === 0) return undefined;
      // REVERSIBLE, derived: the item is handed to the caller, so (tail, head) determines the
      // queue. `Q -> (head Q, tail Q)` is a bijection on non-empty queues; its inverse is
      // push-front. PAYLOAD_RETURNED_ERASURE_BITS = 0, so this is a permutation, not a
      // measurement. (Was `tracker.measure(1)` — a meter on a bijection.)
      tracker.permutation();
      return data.shift();
    },

    flush(): readonly T[] {
      if (data.length === 0) return [];
      // REVERSIBLE, derived: the whole batch is handed to the caller, so `Q -> ([], Q)` is a
      // bijection. PAYLOAD_RETURNED_ERASURE_BITS = 0. (Was `tracker.measure(batchSize)` — the
      // largest of the asserted charges, on the operation least able to justify one.)
      //
      // Batching is free (Bennett). The Landauer cost of a ferry belongs to whatever DROPS the
      // batch, and this queue never drops anything — a consumer that destroys the batch should
      // meter that destruction where it happens, the way `key-erasure-meter.ts` does.
      tracker.permutation();
      const batch = [...data];
      data.length = 0;
      return batch;
    },

    snapshot(): readonly T[] {
      // Observe: read the queue state without consuming. Zero heat.
      tracker.observe();
      return [...data];
    },
  };
}

// ═══ Utilities ═════════════════════════════════════════════════════════════════

/** Classify a standard JS collection by its physics trait. */
export function classifyTrait(collection: unknown): PhysicsTrait {
  if (Array.isArray(collection)) return "adj";
  if (collection instanceof Map || collection instanceof Set) return "non-adj";
  // Default: if it has push/shift semantics, it's a ferry (queue-like).
  return "ferry";
}

/** Summary of entropy cost for a physics trait. */
export interface TraitCostSummary {
  readonly trait: PhysicsTrait;
  readonly readCost: "zero" | "landauer";     // cost per read operation
  readonly writeCost: "zero" | "landauer";    // cost per write operation
  readonly batchable: boolean;                // whether cost amortizes over batches
  readonly reversible: boolean;               // whether operations have inverses
}

/**
 * Declared costs per trait.
 *
 * `ferry` reads `zero` / `reversible: true` as of 2026-08-14, and the change is the finding rather
 * than a relaxation: every operation `createFerryQueue` implements — enqueue, dequeue, flush — is a
 * bijection once the returned value is counted as part of the output, so the queue has no leg that
 * can pay a Landauer floor. It was declared `landauer` / irreversible while metering two
 * bijections. Batching is still what distinguishes the trait (`batchable: true`); what it does not
 * do is destroy anything. A ferry consumer that DROPS its batch is the erasing operation, and it
 * lives at the consumer, not here.
 */
export const TRAIT_COSTS: Record<PhysicsTrait, TraitCostSummary> = {
  adj: { trait: "adj", readCost: "zero", writeCost: "zero", batchable: false, reversible: true },
  "non-adj": { trait: "non-adj", readCost: "zero", writeCost: "landauer", batchable: false, reversible: false },
  ferry: { trait: "ferry", readCost: "zero", writeCost: "zero", batchable: true, reversible: true },
};
