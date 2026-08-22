/**
 * ctm.ts — the Conscious Turing Machine as a typed interface, v0. DECLARATION ONLY.
 *
 * The TypeScript mirror of `src/Core/Ctm.fs`. **The F# is the reference** — the algebraic
 * obligations live there as `Ctm.CtmLaws`, stated as predicates a property test or a proof can be
 * pointed at. Read that module's header for the full derivation from the paper, for the honest
 * finding that a newborn CTM has no exit, and for what is deliberately left undeclared.
 *
 * ## Anchor (Beacon)
 *
 * Lenore Blum and Manuel Blum, *"A Theory of Consciousness from a Theoretical Computer Science
 * Perspective: Insights from the Conscious Turing Machine"*, PNAS 119(21) e2115934119, 2022
 * (doi:10.1073/pnas.2115934119); formal statement checked against the same authors'
 * *"AI Consciousness is Inevitable"* (arXiv:2403.17101) §2.1 and Appendix §6.2. Roots: Baars
 * (Global Workspace), Avrim Blum (Sleeping Experts), Hebb 1949 (link formation).
 *
 * The forwarded transcript under `docs/research/ip-questionable/` was **not opened** for this work
 * and nothing here derives from it (`cleanroom-two-team-separation`).
 *
 * ## Two things this file must get exactly right, or the oracles diverge silently
 *
 * 1. **The draw convention.** `draw < p(left)` selects `left`, identically to
 *    `Ctm.probabilisticMatch` in F#. Flipping the comparison would make both languages "work" and
 *    disagree on the same seed.
 * 2. **The bracket order.** `tournament` sorts submissions through the collation treaty
 *    ({@link compareAddress}, Unicode code-point order) before folding. Sorting any other way —
 *    `localeCompare`, bare `<` — reorders the bracket and, because the draws are consumed
 *    positionally, changes the winner.
 *
 * Interfaces only: zero instance state, no `class`, no module-level `let`, no registry, no
 * singleton. Entropy arrives as a parameter, never from `Math.random()` — that is the §13 door, and
 * it is what makes the competition DST-replayable.
 *
 * **Register: `unmetered`** (`toy-is-free-metered-must-be-earned`) — declarations with no consumer.
 */
import { type Address, type Addressed, compareAddress, type Member } from "./society";

/**
 * **A chunk** — the unit that competes for the single STM slot.
 *
 * The paper's tuple is `address, time, gist, value; aux`, with `aux = intensity, mood` for the
 * probabilistic CTM. At entry `intensity = |value|` and `mood = value`; both accumulate by **sum**
 * as a chunk wins matches, so the winner's aux carries global context.
 *
 * `tick` is the machine's own logical clock, never a node's wall clock
 * (`local-time-never-enters-the-shared-fold`). `G` is the caller's gist type and is never inspected.
 */
export interface Chunk<G> {
  /** The originating processor's address. Preserved unchanged through every match. */
  readonly address: Address;
  /** The logical tick at which the chunk was created. */
  readonly tick: number;
  /** The succinct representation that competes. Opaque here. */
  readonly gist: G;
  /** A **valenced** number: importance/urgency/confidence. May be negative; the sign is the valence. */
  readonly value: number;
  /** Aux, first component. `|value|` at entry; the sum of both sides after a match. */
  readonly intensity: number;
  /** Aux, second component. `value` at entry; the sum of both sides after a match. */
  readonly mood: number;
}

/**
 * Build an entry chunk with the aux invariants the paper states at the start of a competition:
 * `intensity = |value|`, `mood = value`. Going through here is what keeps `|mood| <= intensity`,
 * which is what keeps every disposition's rank non-negative.
 */
export function entryChunk<G>(address: Address, tick: number, gist: G, value: number): Chunk<G> {
  return { address, tick, gist, value, intensity: Math.abs(value), mood: value };
}

/**
 * The paper's general rank family, `f(chunk) = intensity + d * mood` with `-1 <= d <= 1`. `d = 0`
 * is the simple natural choice, `f = intensity`. `d` is the machine's **disposition** — a parameter
 * of the implementation, never of this module.
 */
export function rankByDisposition<G>(d: number, chunk: Chunk<G>): number {
  return chunk.intensity + d * chunk.mood;
}

/**
 * **`Ctm` — the Conscious Turing Machine contract, v0.**
 *
 * Extending `Member` is the load-bearing line and it is what closes the fixpoint: a CTM presents the
 * member face, so a CTM may be a processor of another CTM with no special case. The recursion is
 * carried by `Member`, not by `Ctm` and not by `Society` — see `src/Core/Levels.fs`.
 */
export interface Ctm<V, G, M> extends Member<V, M> {
  /**
   * **LTM** — the processors, as routing addresses. The Up-Tree is a perfect binary tree with one
   * leaf per processor, so this roll is **fixed for the machine's life**: there is no `admit` here
   * and there must not be one. That fixedness is what makes a CTM a *closed* level.
   *
   * Callers that fold over this MUST order it through `canonicalSortAddresses`.
   */
  processors(view: V): readonly Address[];

  /** The chunk this machine offers into the competition for the given tick. */
  submit(view: V, tick: number): Chunk<G>;

  /**
   * **`f`** — the ranking function, mapping a chunk to a non-negative real. The implementation
   * chooses its disposition; the interface declines to, because a disposition is a values call.
   */
  rank(chunk: Chunk<G>): number;

  /**
   * **One match of the winner-take-all tournament.** `draw` is a value in `[0, 1)` supplied by the
   * caller — the coin-toss neuron's entropy, injected, never ambient. The result must be one of the
   * two inputs, carrying the **summed** intensity and mood. {@link probabilisticMatch} is the
   * paper's rule written out.
   */
  match(left: Chunk<G>, right: Chunk<G>, draw: number): Chunk<G>;

  /**
   * **The Down-Tree.** Given the chunk that reached STM, **return** the messages carrying it to the
   * processors — one per processor. It returns rather than sends, for the same reason
   * `Member.deliver` does: no transport parameter, so no transport can leak in.
   */
  broadcast(view: V, winner: Chunk<G>): readonly Addressed<M>[];

  /**
   * **Links** — bi-directional edges along which a processor reaches another **without passing
   * through STM**. Empty at birth by the paper's construction; formed Hebbian-ly between processors
   * that broadcast on consecutive ticks. This is the machine's *internal* exit; `Member.peers` is
   * its own exit within whatever encloses it — the same notion, one rung apart.
   */
  links(view: V, processor: Address): readonly Address[];
}

/**
 * **The paper's coin-toss neuron, written out.** Picks `left` with probability
 * `f(left) / (f(left) + f(right))`, or 1/2 when the sum is zero, and returns the winner carrying the
 * summed intensity and mood. The winner's address, tick, gist and value are its own — only the aux
 * accumulates.
 *
 * `draw < p(left)` selects `left`. That convention is part of the byte-lock with
 * `Ctm.probabilisticMatch` in F#; do not "simplify" it to `<=`.
 */
export function probabilisticMatch<G>(
  rank: (chunk: Chunk<G>) => number,
  left: Chunk<G>,
  right: Chunk<G>,
  draw: number,
): Chunk<G> {
  const fl = rank(left);
  const fr = rank(right);
  const total = fl + fr;
  const pLeft = total <= 0 ? 0.5 : fl / total;
  const winner = draw < pLeft ? left : right;

  return { ...winner, intensity: left.intensity + right.intensity, mood: left.mood + right.mood };
}

/**
 * **The tournament, folded.** Sorts submissions into the collation-treaty canonical order and folds
 * `match` left over them, consuming one supplied draw per match.
 *
 * A linear bracket is faithful because the paper's theorem is bracket-independent: with `f` additive
 * under a match, a chunk's win probability is `f(chunk) / sum of all f` in any winner-take-all
 * bracket. Bracket-independence is associativity, and it is why this can be a fold at all.
 *
 * Returns `undefined` when there are no submissions, or when `draws` supplies fewer than
 * `length - 1` values. Running out of entropy is **not** papered over with `Math.random()`: the
 * caller owns the entropy budget, and refusing is the honest failure.
 */
export function tournament<V, G, M>(
  machine: Ctm<V, G, M>,
  draws: readonly number[],
  submissions: readonly Chunk<G>[],
): Chunk<G> | undefined {
  const ordered = [...submissions].sort((a, b) => {
    const byAddress = compareAddress(a.address, b.address);
    return byAddress !== 0 ? byAddress : a.tick - b.tick;
  });

  const first = ordered[0];
  if (first === undefined) return undefined;
  if (draws.length < ordered.length - 1) return undefined;

  let accumulated = first;
  for (let i = 1; i < ordered.length; i += 1) {
    // Non-null assertions avoided: the loop bound guarantees both are present.
    const next = ordered[i];
    const draw = draws[i - 1];
    if (next === undefined || draw === undefined) return undefined;
    accumulated = machine.match(accumulated, next, draw);
  }
  return accumulated;
}
