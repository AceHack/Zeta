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
 *   - non-Adj ops call tracker.measure(1) (Landauer, 1 bit per hash collision)
 *   - Ferry ops call tracker.branch() on enqueue, tracker.measure(batchSize) on flush
 *
 * Composes with:
 *   - src/Core.TypeScript/algebra/entropy-tracker.ts (the metered door)
 *   - src/Core.TypeScript/algebra/interfaces.ts (IGroup, IJoinSemilattice)
 *   - src/Core.Lean4/Lean4/AdjCtlOrthogonality.lean (the proof: Adj ⊥ Ctl)
 *   - src/Core.Lean4/Lean4/LandauerFloor.lean (the cost contract)
 *   - src/Core.TypeScript/observe/event-sink-folder.ts (the ferry commit in production)
 */

import type { EntropyTracker } from "./entropy-tracker";

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
      // No measure() — the operation is invertible (set(i, old) undoes it).
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

/**
 * Create an entropy-metered non-Adj hash map. Reads call `tracker.observe()`,
 * mutations call `tracker.measure(1)`.
 */
export function createNonAdjMap<K, V>(tracker: EntropyTracker): NonAdjMap<K, V> {
  const data = new Map<K, V>();

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
      // non-Adj: the hash function erases information (many keys → one slot).
      // Even if the key already exists, the OLD value is lost (overwritten
      // without return). Landauer: 1 bit of heat per mutation.
      tracker.measure(1);
      data.set(key, value);
    },

    delete(key: K): boolean {
      // non-Adj: deletion erases the entry irreversibly. Landauer cost.
      tracker.measure(1);
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
  /** Dequeue one — mini-commit (measure 1 bit; the item leaves the possibility space). */
  dequeue(): T | undefined;
  /** Flush all — the ferry commit. Pay Landauer for the ENTIRE batch at once. */
  flush(): readonly T[];
  /** Snapshot without consuming — observe (Adj, zero heat). */
  snapshot(): readonly T[];
}

/**
 * Create an entropy-metered ferry queue. Enqueue calls `tracker.branch()`,
 * dequeue calls `tracker.measure(1)`, flush calls `tracker.measure(pending)`.
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
      // Mini-commit: 1 item leaves the possibility space. Pay 1 bit Landauer.
      tracker.measure(1);
      return data.shift();
    },

    flush(): readonly T[] {
      if (data.length === 0) return [];
      // The ferry commit: collapse ALL accumulated branches in one measurement.
      // Pay Landauer for the entire batch. This IS accountFerryCommit(batchBits=N, ...).
      const batchSize = data.length;
      tracker.measure(batchSize);
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

export const TRAIT_COSTS: Record<PhysicsTrait, TraitCostSummary> = {
  adj: { trait: "adj", readCost: "zero", writeCost: "zero", batchable: false, reversible: true },
  "non-adj": { trait: "non-adj", readCost: "zero", writeCost: "landauer", batchable: false, reversible: false },
  ferry: { trait: "ferry", readCost: "zero", writeCost: "landauer", batchable: true, reversible: false },
};
