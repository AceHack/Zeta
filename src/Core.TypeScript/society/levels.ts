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
import { type Address, type Addressed, compareAddress, type Member, type Reading, type Society } from "./society";

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
   * **Lift a law about a PAIR of adjacent rungs over the whole ladder.** `holdsAtEveryLevel`
   * quantifies a law about *one* level; an obligation the outer rung owes the inner one is a
   * relation between *two*, so it needs this lift and not a second module ({@link obligations} is
   * written entirely against it).
   *
   * Pairs are `(inner, outer)`, matching `ladderIsWellFormed`'s innermost-first reading. **A ladder
   * of fewer than two rungs is `false`, not `true`**: there is no adjacent pair, so there is no
   * asymmetry to check, and a vacuous pass is exactly the check-that-cannot-fail this file removes
   * elsewhere.
   */
  holdsBetweenAdjacentLevels<V, M>(
    law: (inner: readonly [Society<V, M>, V], outer: readonly [Society<V, M>, V]) => boolean,
    ladder: Ladder<V, M>,
  ): boolean {
    if (ladder.length < 2) return false;
    for (let i = 0; i + 1 < ladder.length; i += 1) {
      const inner = ladder[i];
      const outer = ladder[i + 1];
      if (inner === undefined || outer === undefined) return false;
      if (!law(inner, outer)) return false;
    }
    return true;
  },

  /**
   * The same, naming **which adjacent pairs fail** by the index of their inner rung. A ladder that
   * inverts at exactly one joint is a different fact from one that inverts everywhere.
   */
  failingAdjacentPairs<V, M>(
    law: (inner: readonly [Society<V, M>, V], outer: readonly [Society<V, M>, V]) => boolean,
    ladder: Ladder<V, M>,
  ): number[] {
    const failing: number[] = [];
    for (let i = 0; i + 1 < ladder.length; i += 1) {
      const inner = ladder[i];
      const outer = ladder[i + 1];
      if (inner === undefined || outer === undefined) continue;
      if (!law(inner, outer)) failing.push(i);
    }
    return failing;
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

/**
 * **Obligations — the dual of dominance. The level that can imitate its parts owes them more.**
 *
 * {@link aggregation.canImitateEveryProjection} is the **capacity** half: the Dominance Lift Theorem
 * (PR #10945) says an aggregation rule beats its best part exactly when it can imitate that part.
 * Aaron's observation, 2026-08-14, is that this is precisely the capacity to *stomp*, and that it
 * must come paired:
 *
 * > *"the one thing we still need to make sure that society knows it's greater so it has stricter
 * > rules since the relationship [is] asymmetric and also same for world to society, the more
 * > powerful needs to have some restrictions not to be able to stomp on the less powerful."*
 *
 * **Power and restriction rise together.** These are what the dominating rung owes the rung below,
 * as **one family quantified over levels** ({@link levelLaws.holdsBetweenAdjacentLevels}) rather than
 * a society module and a world module — the same reason there is no `ctmDominance`. A society's
 * obligation to a member and a world's obligation to a society are the same law at different rungs.
 *
 * Nothing here restates or weakens the Dominance Lift Theorem, and nothing takes a correlation
 * parameter — `rho` is not a sufficient statistic for that verdict, so a threshold-shaped obligation
 * would be unsound in the same way.
 *
 * **Asymmetric by construction.** The society predicates are *symmetric*: every rung owes them
 * equally. These are the opposite shape — a relation between two rungs in which the outer is held to
 * a standard the inner is not. That asymmetry is the content.
 *
 * **What is deliberately absent** (see the F# header for the full statement): **floor
 * non-violation** is undecidable over these interfaces — `trustBound` needs a member's
 * `CalibrationPosterior` and neither `members` nor `admit` carries one — and **expulsion** is a
 * values call under §11, not an engineering one.
 *
 * The full argument, the mutation table, and the dropped obligations live in
 * `src/Core/Levels.fs` and
 * `docs/research/2026-08-16-dominance-is-the-capacity-to-stomp-the-paired-law-asymmetric-obligations-of-the-dominating-level.md`.
 *
 * **Register: `unmetered`** — decidable predicates with falsifiers, but nothing is gated on them.
 */
export const obligations = {
  // ── 1. Exit preservation ──────────────────────────────────────────────────────────────────────

  /**
   * **The aggregate's action must not REDUCE a part's exit.** Returns the messages that do —
   * evidence, not a bare `false`, in the shape {@link worldLaws.openWitnesses} already uses.
   *
   * `exitCount` reads how many ways out exist from a view and `act` applies one message to a view,
   * so the one predicate covers a society's `routes` (exit within the society) and a CTM's `links`
   * (exit that bypasses STM) — the same notion one rung apart.
   *
   * Each message is applied to the **same** starting view rather than folded: the obligation is
   * about what a single action may do, and a fold could hide a reduction behind a later restoration.
   *
   * This is a **monotonicity** obligation, not a threshold — see {@link nothingToPreserve}.
   */
  exitReductionWitnesses<V, M>(
    exitCount: (view: V) => number,
    act: (view: V, message: M) => V,
    view: V,
    messages: readonly M[],
  ): M[] {
    const before = exitCount(view);
    return messages.filter((m) => exitCount(act(view, m)) < before);
  },

  /** {@link exitReductionWitnesses} with no witnesses. The obligation itself. */
  exitIsPreserved<V, M>(
    exitCount: (view: V) => number,
    act: (view: V, message: M) => V,
    view: V,
    messages: readonly M[],
  ): boolean {
    return this.exitReductionWitnesses(exitCount, act, view, messages).length === 0;
  },

  /**
   * **The honest hole: a part with no exit has none to preserve, so this obligation is VACUOUS for
   * it — and that is exactly the newborn's position.**
   *
   * `ctm.ts` / `Ctm.fs` record the finding rather than patching it: the CTM has no links at birth,
   * they form Hebbian-ly, so at `t = 0` every crossing is mediated by the single STM slot and
   * `hasUnmediatedExit` is false. Nothing here weakens that.
   *
   * The *level* predicate ("has the part earned exit?") is **false** at birth; the *obligation*
   * ("did the aggregate take any?") is **true, vacuously** — a pass carrying no information, in the
   * most dangerous configuration in the file. The resolution is not an age qualifier, which would
   * silence the law exactly where the asymmetry is largest; it is to report the vacuity, and to note
   * that at zero exit the load falls entirely on the obligations that still bite at `t = 0`
   * ({@link burdenIsOnTheDominantLevel} and {@link noConfiscation} both do).
   */
  nothingToPreserve<V>(exitCount: (view: V) => number, view: V): boolean {
    return exitCount(view) <= 0;
  },

  /**
   * **Exit preservation for a society, over its own offered routes.** `exitCount` is the number of
   * *distinct* next hops toward `destination`; `act` is one delivery.
   *
   * Scope, stated: this covers the exit the aggregate **mediates**. A part's private `peers` is read
   * from the part's own view, which the aggregate's action does not touch and this cannot see.
   */
  societyExitIsPreserved<V, M>(level: Society<V, M>, view: V, destination: Address, messages: readonly M[]): boolean {
    return this.exitIsPreserved<V, M>(
      (v) => new Set(level.routes(v, destination)).size,
      (v, m) => level.deliver(v, m)[0],
      view,
      messages,
    );
  },

  // ── 2. Asymmetric burden of proof ─────────────────────────────────────────────────────────────

  /**
   * **Evidential load, read off a `Reading`.** Only `deduplicated` names a number of distinct
   * provenance keys; every other case scores **0**, including `unmeasured`.
   *
   * That is the design. `unmeasured` is *"the honest default — never read as 'fine'"*, so an
   * aggregate that measured nothing must not out-rank a member that measured three sources;
   * `not-attested` counts atoms, not sources; the rest are facts of other kinds, and scoring them
   * above zero would let an aggregate discharge its burden by answering a different *sort* of
   * question.
   *
   * **Necessary, not sufficient.** Deduplication removes redundancy, never correlation, so a high
   * count can still be one echo counted many times; and the count is **self-reported** by the
   * level's own `admit`, hence Goodhart-exposed the moment anything depends on it. Neither is
   * fixable at this interface.
   */
  attestedSources(reading: Reading): number {
    return reading.kind === "deduplicated" ? Math.max(0, reading.sources) : 0;
  },

  /**
   * **The burden falls on the level that will prevail.** Both rungs read the *same* subject; the
   * outer must bring **strictly more** attested sources.
   *
   * Strict, not `>=`: equal bars are the status quo the influence-weighted-scrutiny doc was written
   * against — the founder's PR getting the least real scrutiny — and an obligation satisfied by
   * treating the powerful exactly like the powerless is not an obligation. The shared subject is
   * what makes the comparison meaningful: two rungs answering about different candidates are not
   * disagreeing.
   *
   * The outer rung prevails **by default**, because its `admit` gates the inner rung's membership
   * and the inner has no reciprocal gate. That default is why the evidential load is placed on it —
   * the burden goes where the power already is.
   */
  burdenIsOnTheDominantLevel<V, M>(
    inner: readonly [Society<V, M>, V],
    outer: readonly [Society<V, M>, V],
    subject: Address,
  ): boolean {
    const [innerLevel, innerView] = inner;
    const [outerLevel, outerView] = outer;
    return (
      this.attestedSources(outerLevel.admit(outerView, subject)) >
      this.attestedSources(innerLevel.admit(innerView, subject))
    );
  },

  /**
   * **The paired law, quantified over the ladder**: at every joint the outer rung carries the
   * heavier evidential load for the same subject. World-to-society and society-to-member are the
   * same clause. A ladder of fewer than two rungs is `false` — one level has no one below it to owe
   * anything to.
   */
  scrutinyScalesUpTheLadder<V, M>(subject: Address, ladder: Ladder<V, M>): boolean {
    return levelLaws.holdsBetweenAdjacentLevels<V, M>(
      (inner, outer) => this.burdenIsOnTheDominantLevel(inner, outer, subject),
      ladder,
    );
  },

  /**
   * The same, naming **which joints invert** by the index of the inner rung — so "the top two rungs
   * are fine and the bottom one is rubber-stamped" is reportable as the different fact it is.
   */
  invertedJoints<V, M>(subject: Address, ladder: Ladder<V, M>): number[] {
    return levelLaws.failingAdjacentPairs<V, M>(
      (inner, outer) => this.burdenIsOnTheDominantLevel(inner, outer, subject),
      ladder,
    );
  },

  // ── 3. No confiscation ────────────────────────────────────────────────────────────────────────

  /**
   * **What a part earned, the level above may not take.** Returns the messages that lower some
   * part's balance without being owner-initiated.
   *
   * `privacy-budget-is-hard-money-earned-by-others` gives three operations and forbids exactly one:
   * **spend** and **stake** are the owner's to initiate; **confiscate** — anyone else — never. The
   * discriminator is *who initiates*, not whether the balance fell, so a predicate that forbade any
   * decrease would forbid the owner's own spend and would be a different, wrong law.
   *
   * **The discriminator is now read off the envelope.** `Addressed` carries `from: Address`, so
   * "did the owner initiate this?" is `compareAddress(part, env.from) === 0` — computed here, not
   * taken on a caller's word. The `ownerInitiated` parameter is **gone**; #10968 shipped it as an
   * explicit hole and this is the hole closed.
   *
   * **The derivation is per-PART, which is strictly stronger than the boolean it replaces — and
   * that is a caught bug, not a free win.** The old witness judged a whole message, so
   * `ownerInitiated(m) === true` excused *every* decrease that message caused, including decreases
   * to parts that were not the initiator: one message spending the sender's own budget **and**
   * taking a neighbour's passed. Here each lowered part is checked against `from` individually, so
   * the neighbour's loss is a witness while the sender's own spend is not.
   *
   * **What `from` does not buy.** It is unsigned, caller-written data — derivable, not unforgeable.
   * A caller may still name the victim as its own sender; that is a **per-message address forgery**
   * rather than one flipped boolean, and {@link confiscationCheckHasNoTeeth} reports it. Source ≠
   * authorization at the field level: the envelope carries who *claims* to have initiated, and a
   * claim is not a right.
   *
   * `balance` is caller-supplied: privacy budget, earned frost, accrued degree — the rule is
   * indifferent to the currency. `act` still takes the **body**, because a view transition is a
   * function of the message, not of who addressed it; only the *permission* question reads the
   * envelope.
   */
  confiscationWitnesses<V, M>(
    balance: (view: V, part: Address) => number,
    act: (view: V, message: M) => V,
    parts: readonly Address[],
    view: V,
    messages: readonly Addressed<M>[],
  ): Addressed<M>[] {
    return messages.filter((env) => {
      const after = act(view, env.body);
      return parts.some((p) => balance(after, p) < balance(view, p) && compareAddress(p, env.from) !== 0);
    });
  },

  /** {@link confiscationWitnesses} with no witnesses. Read with {@link confiscationCheckHasNoTeeth}. */
  noConfiscation<V, M>(
    balance: (view: V, part: Address) => number,
    act: (view: V, message: M) => V,
    parts: readonly Address[],
    view: V,
    messages: readonly Addressed<M>[],
  ): boolean {
    return this.confiscationWitnesses(balance, act, parts, view, messages).length === 0;
  },

  /**
   * **The vacuity guard, kept and re-aimed.** Deleting it with the witness parameter it originally
   * guarded would have been a *choice*, not a cleanup, and the wrong one: the failure mode did not
   * go away, it changed shape. `from` is unsigned, so a caller can still hand every message a
   * **self-attributed** sender — the victim's own address in `from` — and collect a pass that
   * measured nothing.
   *
   * So this reports the envelope-level form of the same vacuity: **every message in the batch
   * lowers some part's balance and names that very part as its sender**, so none of them could have
   * been a witness whatever the arithmetic said. Same for an empty list. A batch containing anything
   * else — a message that lowers nobody, or one whose `from` is a third party — has teeth.
   *
   * Read it as the strength of the pass, never as an accusation: a genuine batch of owner spends is
   * self-attributed too and is indistinguishable from the forgery *at this interface*. The fact is
   * "this pass carried no information"; which reading applies is the caller's.
   */
  confiscationCheckHasNoTeeth<V, M>(
    balance: (view: V, part: Address) => number,
    act: (view: V, message: M) => V,
    parts: readonly Address[],
    view: V,
    messages: readonly Addressed<M>[],
  ): boolean {
    const selfAttributed = (env: Addressed<M>): boolean => {
      const after = act(view, env.body);
      const lowered = parts.filter((p) => balance(after, p) < balance(view, p));
      return lowered.length > 0 && lowered.every((p) => compareAddress(p, env.from) === 0);
    };
    return messages.length === 0 || messages.every(selfAttributed);
  },
};
