/**
 * levels.ts — one shape, many rungs. **There is no `World` interface, and that is the finding.**
 *
 * The TypeScript mirror of `src/Core/Levels.fs`, which carries the full argument. In one line:
 *
 * > A world is not a different kind of thing from a society. It is a society that is **closed**.
 *
 * Closed means no outbound message is addressed outside the membership and no offered route leaves
 * it. `worldLaws.isWorld` below is exactly that conjunction — defined *in terms of* the society
 * predicates, never re-derived, so a proof pointed at one is pointed at the other for free.
 *
 * The F# header also records what happened to the `ISociety <: CTM` claim: the fixpoint closes, but
 * it is carried by `Member`, and `Society <: Ctm` is **refuted** by a counterexample already in this
 * repo (the gossip salon is a society with no global broadcast). `Society` and `Ctm` are sibling
 * refinements of `Member`, neither below the other.
 *
 * **Register: `unmetered`** (`toy-is-free-metered-must-be-earned`) — predicates with no consumer.
 */
import type { Chunk, Ctm } from "./ctm";
import type { Address, Member, Society } from "./society";

/**
 * **A ladder** — the levels a caller wants reasoned about, innermost first, each paired with its own
 * view. A plain array: a value passed to a law, holding nothing. There is no registry of levels and
 * no ambient world; a level is reachable only because someone handed it over.
 */
export type Ladder<V, M> = readonly (readonly [Society<V, M>, V])[];

/**
 * **Direct nesting, the Composite relation**: the inner level's own address is a member of the outer
 * level. Note what this deliberately does *not* say — the outer level does not contain the inner
 * level's members. A society sees its sub-society as one member, which is why nesting does not
 * flatten.
 */
export function nestsDirectly<V, M>(inner: readonly [Society<V, M>, V], outer: readonly [Society<V, M>, V]): boolean {
  const [innerLevel, innerView] = inner;
  const [outerLevel, outerView] = outer;
  return outerLevel.members(outerView).includes(innerLevel.address(innerView));
}

/**
 * **The ladder is well formed**: each rung nests directly in the next. A ladder that fails this is a
 * list of unrelated levels, and any conclusion drawn across it is about nothing.
 */
export function ladderIsWellFormed<V, M>(ladder: Ladder<V, M>): boolean {
  for (let i = 0; i + 1 < ladder.length; i += 1) {
    const inner = ladder[i];
    const outer = ladder[i + 1];
    if (inner === undefined || outer === undefined) return false;
    if (!nestsDirectly(inner, outer)) return false;
  }
  return true;
}

/** The outermost rung, if the ladder has one. */
export function outermost<V, M>(ladder: Ladder<V, M>): readonly [Society<V, M>, V] | undefined {
  return ladder[ladder.length - 1];
}

/** Every outbound message this level would emit for `message` is addressed to one of its members. */
function outboundStaysInside<V, M>(level: Society<V, M>, view: V, message: M): boolean {
  const members = new Set(level.members(view));
  const [, outbound] = level.deliver(view, message);
  return outbound.every((o) => members.has(o.to));
}

/** Every next hop this level offers toward `destination` is one of its members — no outside broker. */
function routesAreMembers<V, M>(level: Society<V, M>, view: V, destination: Address): boolean {
  const members = new Set(level.members(view));
  return level.routes(view, destination).every((hop) => members.has(hop));
}

/**
 * **Closure — the single predicate that distinguishes a world from a society.**
 *
 * The witnesses are supplied because the predicate is decidable only over a finite sample, and
 * pretending otherwise would be a check that cannot fail.
 */
export function isClosed<V, M>(
  level: Society<V, M>,
  view: V,
  messages: readonly M[],
  destinations: readonly Address[],
): boolean {
  return (
    messages.every((m) => outboundStaysInside(level, view, m)) &&
    destinations.every((d) => routesAreMembers(level, view, d))
  );
}

/**
 * **Level-generic laws.** The point of this module: a per-level predicate becomes a level-indexed
 * family with no new code, so a formal argument instantiates rather than re-derives. Nothing here
 * asserts that a law holding at one rung implies it holds at the next — that implication is the open
 * question, and it is left decidable rather than assumed.
 */
export const levelLaws = {
  /** Lift any per-level predicate over a whole ladder. */
  holdsAtEveryLevel<V, M>(law: (level: Society<V, M>, view: V) => boolean, ladder: Ladder<V, M>): boolean {
    return ladder.every(([level, view]) => law(level, view));
  },

  /**
   * The same, reporting **which rungs fail** rather than a bare `false`. A law that fails at rung 3
   * of 5 is a different fact from one that fails everywhere, and collapsing them throws away the
   * diagnosis.
   */
  failingLevels<V, M>(law: (level: Society<V, M>, view: V) => boolean, ladder: Ladder<V, M>): number[] {
    const failing: number[] = [];
    ladder.forEach(([level, view], index) => {
      if (!law(level, view)) failing.push(index);
    });
    return failing;
  },

  /**
   * **Exit at every rung.** `k >= 2` is the Hirschman discriminator: a level with exactly one route
   * to a destination is one whose members must defer, whether or not anyone appointed the node they
   * defer to. Checked at *every* rung, because a ladder with exit at the top and none at the bottom
   * is captured where it matters.
   */
  exitAtEveryLevel<V, M>(k: number, destination: Address, ladder: Ladder<V, M>): boolean {
    return this.holdsAtEveryLevel<V, M>(
      (level, view) => new Set(level.routes(view, destination)).size >= Math.max(1, k),
      ladder,
    );
  },

  /**
   * **A CTM's links are the peers of its processors** — the cross-level coherence obligation. Both
   * views are supplied by the caller; nothing here reaches into a member to fetch its state. If the
   * two disagree, the machine's model of its own topology is wrong, which is how an exit gets
   * reported that does not exist.
   */
  linksAreProcessorPeers<V, G, M>(
    machine: Ctm<V, G, M>,
    machineView: V,
    processor: Address,
    processorMember: Member<V, M>,
    processorView: V,
  ): boolean {
    const fromMachine = new Set(machine.links(machineView, processor));
    const fromProcessor = new Set(processorMember.peers(processorView));
    if (fromMachine.size !== fromProcessor.size) return false;
    for (const a of fromMachine) if (!fromProcessor.has(a)) return false;
    return true;
  },
};

/**
 * **Aggregation — where "beats its parts" lives, and it is NOT the level.**
 *
 * The sibling result (PR #10945, the **Dominance Lift Theorem**): an aggregation rule beats its best
 * part **iff it can imitate its best part** — every projection `pi_i` lies in the class the rule is
 * optimal over. No `n`, no `c`, no correlation parameter, no identical-agents assumption, which is
 * why it inducts to arbitrary depth.
 *
 * So `deferential` belongs to the aggregation **rule**, not to the level: there is deliberately no
 * `ctmDominance` and no `worldDominance`, just one predicate about a rule, with
 * `levelLaws.holdsAtEveryLevel` doing the quantification over levels.
 *
 * **No correlation threshold appears here, and none should be added.** The same PR showed `rho` is
 * not a sufficient statistic for the verdict — a counterexample at `m = 9`, `rho = 0.2495` sits
 * inside the published safe `rho*(9) = 0.25` and still loses over 40M trials. A law predicated on
 * `rho < rho*` would be unsound.
 */
export const aggregation = {
  /**
   * **The Dominance Lift hypothesis, made decidable.**
   *
   * `witnesses[i]` is the input under which the rule must reproduce projection `i`. Supplying the
   * witness is the caller's job: "can imitate" is an existential, and a predicate that went looking
   * for it would either be undecidable or be a check that cannot fail.
   *
   * **This is the hypothesis, not the conclusion.** Discharging it says the rule *can* imitate every
   * part. Concluding that it *dominates* its best part additionally needs the theorem's
   * optimality-class premise, which is not checked here and must not be implied by a pass.
   */
  canImitateEveryProjection<P, R>(
    eq: (a: R, b: R) => boolean,
    rule: (parts: readonly P[]) => R,
    project: (part: P) => R,
    witnesses: readonly (readonly P[])[],
  ): boolean {
    if (witnesses.length === 0) return false;
    return witnesses.every((input, i) => {
      const part = input[i];
      if (part === undefined) return false;
      return eq(rule(input), project(part));
    });
  },

  /**
   * **The CTM tournament's imitation witness: concentrate the rank mass.** Because `f` is additive
   * under a match and a chunk wins with probability proportional to `f`, an input in which one
   * processor carries all the mass makes the tournament return that chunk with probability 1, for
   * every draw. Derived from the paper's competition rule, not constructed to pass.
   */
  concentrateMassOn<G>(keep: Address, submissions: readonly Chunk<G>[]): Chunk<G>[] {
    return submissions.map((c) => (c.address === keep ? c : { ...c, intensity: 0, mood: 0 }));
  },
};

/**
 * **World laws — the society predicates at the outermost rung, plus closure. Nothing else.**
 *
 * Every definition is written in terms of something already shipped. That is deliberate and it is
 * the deliverable: if "world" had needed its own algebra, it would have needed its own interface,
 * and the fact that it does not is the answer to the open question.
 */
export const worldLaws = {
  /**
   * **A level is a world exactly when it is closed.** Literally {@link isClosed}. The alias exists so
   * the name "world" has a definition to point at, not so a second predicate can drift from the
   * first.
   */
  isWorld<V, M>(level: Society<V, M>, view: V, messages: readonly M[], destinations: readonly Address[]): boolean {
    return isClosed(level, view, messages, destinations);
  },

  /**
   * **The ladder terminates in a world**: well formed, and its outermost rung closed. An empty
   * ladder is not a world — it is no levels at all, and returning `true` for it would be a check
   * that cannot fail.
   */
  ladderTerminatesInAWorld<V, M>(
    ladder: Ladder<V, M>,
    messages: readonly M[],
    destinations: readonly Address[],
  ): boolean {
    const top = outermost(ladder);
    if (top === undefined) return false;
    const [level, view] = top;
    return ladderIsWellFormed(ladder) && this.isWorld(level, view, messages, destinations);
  },

  /**
   * **The evidence that a rung is NOT a world**: the messages it delivers outside its own
   * membership. The honest companion to {@link isWorld} — absence of a witness is not closure.
   */
  openWitnesses<V, M>(level: Society<V, M>, view: V, messages: readonly M[]): M[] {
    return messages.filter((m) => !outboundStaysInside(level, view, m));
  },
};
