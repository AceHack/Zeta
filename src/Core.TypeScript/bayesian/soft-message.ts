/**
 * soft-message.ts — the missing message family: a CATEGORICAL belief that can
 * travel a factor graph, with no participant able to silence a candidate.
 *
 * ## Why this exists
 *
 * `docs/VISION.md:3117` names Soft (a distribution over candidates) as *the*
 * Bayesian layer, and `src/Bayesian/FactorGraph.fs:33` already carries a
 * `Factor<'M>` generic over its message family. But `Zeta.Bayesian`'s only
 * message family is `Gaussian` (continuous), and `SoftValue` is categorical
 * over `DynamicValue`. There is no call path between them — a grep for `bayes`
 * across every `src/Core/Soft*.fs` returns only doc comments. A layer graph
 * whose layers hold different KINDS of belief needs a categorical message, and
 * this is it.
 *
 * ## Why it is not `SoftValue` itself
 *
 * `SoftValue` is NORMALIZED by construction — its private representation
 * enforces weights summing to 1. A message must be UNNORMALIZED: the whole
 * point of natural parameters is that they form a group under addition, and
 * the product of two normalized densities is not normalized. So a normalized
 * type cannot be a message without breaking the algebra it is being asked to
 * join. `SoftMessage` is the unnormalized companion; `SoftValue` is what you
 * get when you normalize one for a decision.
 *
 * ## Integer log-weights, and why exactness is not fussiness here
 *
 * For a categorical family the natural parameters ARE log-weights, so
 * `Product` is pointwise addition and `Divide` (the EP cavity, Minka 2001) is
 * pointwise subtraction. Stored as INTEGERS in units of 1/`SCALE` nats, which
 * buys three things floats would not:
 *
 *   - the group laws hold EXACTLY — no float associativity drift, so a
 *     different message ordering cannot change a decision;
 *   - it byte-locks across oracles, which the existing TS SoftValue oracle
 *     cannot do and says so in its own header (floats do not byte-lock, so it
 *     cross-verifies only decisions);
 *   - the influence bound below is an exact integer, so "no one can be
 *     silenced" is a checkable arithmetic fact rather than an approximate one.
 *
 * ## THE ATTACK, and the one line that closes it
 *
 * In log-space, `Product` is addition. A message that assigns log-weight −∞
 * (weight zero) to candidate `c` therefore VETOES `c` PERMANENTLY: −∞ plus
 * anything is −∞, so no amount of later evidence can revive it. One
 * participant, one message, and a candidate is gone from the society's
 * consideration for good. That is a memetic attack expressed in three
 * characters of arithmetic.
 *
 * It is also the ordinary failure mode with no adversary at all: a sensor that
 * has simply never seen `c` reports zero, not "I have no information", and the
 * distinction is invisible downstream.
 *
 * The fix is BOUNDED INFLUENCE (Huber 1964; Hampel's influence function): every
 * message's log-weights are clamped to [−`MAX_INFLUENCE`, +`MAX_INFLUENCE`].
 * A single message can then push a candidate down by at most `MAX_INFLUENCE`,
 * and enough other messages can always outvote it. No veto exists.
 *
 * The same clamp closes the EP cavity problem, which is why it is one
 * mechanism and not two: `Divide` subtracts, so dividing by a near-zero-mass
 * message would produce +∞ and poison the graph. Bounded operands cannot.
 *
 * ## Outliers are members, not errors
 *
 * The values reading and the statistics agree here, which is the reason to
 * trust the design rather than a decoration on top of it. Robust inference
 * DOWN-WEIGHTS rather than REJECTS — a Student-t likelihood gives weight
 * `w = (ν+1)/(ν+z²)`, which shrinks with distance and never reaches zero.
 * Bounded influence is that same discipline for categorical messages: a
 * candidate everyone disbelieves gets quiet, never deleted.
 *
 * That is `manifesto §11` default moral regard, stated in arithmetic — and it
 * is also just correct, because the minority candidate is the one carrying the
 * information when the majority is wrong. Discarding outliers is the ρ→1
 * collapse that `anti-babel-preserve-reconcilability.md` warns about, applied
 * to belief instead of vocabulary.
 *
 * ## Dual-use: this module reports facts and refuses verdicts
 *
 * `atInfluenceFloor` says a message clamped a candidate. It does NOT say
 * whether that is an attack, an honest sensor with no data, or a correct
 * assessment of a bad candidate — those are different readings of one
 * measurement and the caller's oracle decides between them
 * (`dual-use-detection-is-neutral-oracle-decides.md`). A function named
 * `detectSuppressionAttack` would smuggle a morality the substrate is not
 * allowed to hold.
 *
 * ## Anchors (Beacon)
 *
 * - Kschischang, Frey & Loeliger 2001 — factor graphs and sum-product; product
 *   of messages = addition of natural parameters.
 * - Minka 2001 — Expectation Propagation; `Divide` is the cavity.
 * - Huber 1964; Hampel 1974 — bounded influence; the influence function of an
 *   unbounded-score estimator is why one observation can move a Gaussian
 *   posterior arbitrarily far.
 * - Robust-EP line of work (relaxed moment matching under outliers, and the
 *   2025 heavy-tailed robustness results showing bounded sensitivity: a single
 *   large outlier has vanishing influence under Student-t errors).
 *
 * @see src/Bayesian/Message.fs:55 — the `IMessage<'M>` contract this satisfies
 * @see src/Bayesian/FactorGraph.fs:33 — `Factor<'M>`, generic over this
 * @see src/Core/SoftValue.fs:42 — the normalized F# peer
 * @see docs/research/2026-08-25-the-layer-graph-already-exists-three-unwired-seams-between-rx-soft-and-bayesian.md
 */

/** Candidate identity. Opaque string key, as in the TS SoftValue oracle. */
export type CandidateKey = string;

/**
 * Fixed-point scale for log-weights: 1 unit = 1/1000 nat ("millinats").
 *
 * Chosen so that the whole useful dynamic range is integers. A likelihood
 * ratio of e^20 (~4.8e8, far past any evidence a single sensor should carry)
 * is 20000 units — comfortably inside a double's exact-integer range, so
 * addition and subtraction stay exact.
 */
export const SCALE = 1000;

/**
 * The most any SINGLE message may move a candidate, in millinats.
 *
 * 10 nats ≈ a likelihood ratio of 22026:1. That is a very loud opinion — and
 * still finite, which is the entire point. Twelve messages of equal strength
 * outvote eleven; nothing outvotes −∞.
 *
 * THIS IS A VALUES PARAMETER WEARING A NUMBER, and it is named rather than
 * buried: it fixes how much authority one participant may hold over one
 * candidate. Raising it toward infinity restores the veto by degrees.
 */
export const MAX_INFLUENCE = 10 * SCALE;

/**
 * An unnormalized categorical message: candidate → log-weight in millinats.
 *
 * A key that is ABSENT means log-weight 0 — no opinion — not weight 0. That
 * distinction is the whole difference between "I have no information about
 * this candidate" and "this candidate is impossible", and conflating them is
 * how the veto gets in through the back door.
 */
export type SoftMessage = Readonly<Record<CandidateKey, number>>;

/** The flat message: the identity for {@link product}. No opinion about anything. */
export const uniform: SoftMessage = Object.freeze({});

const clampInfluence = (v: number): number =>
  v > MAX_INFLUENCE ? MAX_INFLUENCE : v < -MAX_INFLUENCE ? -MAX_INFLUENCE : v;

/**
 * Build a message from log-weights, clamping each to the influence bound.
 *
 * This is the ONLY constructor, deliberately: a `SoftMessage` that skipped the
 * clamp would be indistinguishable from one that passed it, and the veto would
 * be back. Non-finite input is rejected rather than clamped — `-Infinity` is
 * exactly the veto this exists to prevent, and silently reinterpreting it as
 * "very unlikely" would hide a caller bug that deserves to surface.
 */
export const fromLogWeights = (w: Readonly<Record<CandidateKey, number>>): SoftMessage => {
  const out: Record<CandidateKey, number> = {};
  for (const k of Object.keys(w).sort()) {
    const v = w[k]!;
    if (!Number.isFinite(v)) {
      throw new Error(
        `soft-message: log-weight for ${JSON.stringify(k)} is ${String(v)}. ` +
          "An infinite log-weight is a permanent veto — no later evidence can " +
          "revive the candidate. Express strong disbelief as a large finite " +
          "value; it will be clamped to MAX_INFLUENCE.",
      );
    }
    out[k] = clampInfluence(Math.round(v));
  }
  return Object.freeze(out);
};

/** Every candidate either message mentions, in deterministic (sorted) order. */
const keysOf = (a: SoftMessage, b: SoftMessage): CandidateKey[] =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();

/**
 * Message product — the BP combine. Pointwise addition of log-weights.
 *
 * **ASSUMES THE TWO MESSAGES ARE INDEPENDENT EVIDENCE**, and that assumption is
 * the whole reason {@link productAll} exists. Addition is only the right combine
 * for independent likelihoods; adding correlated ones counts the same
 * observation twice. Use this for a pair you know to be distinct sources, and
 * `productAll` when you do not.
 *
 * NOT re-clamped. The bound limits what ONE message may assert; the product of
 * many messages is the society's accumulated view and is allowed to be as
 * confident as the evidence makes it. Clamping here would cap what any
 * majority could conclude, which is a different and much worse rule.
 */
export const product = (a: SoftMessage, b: SoftMessage): SoftMessage => {
  const out: Record<CandidateKey, number> = {};
  for (const k of keysOf(a, b)) out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  return Object.freeze(out);
};

/**
 * EP cavity — remove one message's contribution. Pointwise subtraction.
 *
 * Total by construction: operands are bounded, so this cannot produce ±∞ or
 * NaN. That is the near-zero-mass problem solved by the same clamp that
 * removes the veto, which is why bounded influence is one mechanism rather
 * than two patches.
 */
export const divide = (a: SoftMessage, b: SoftMessage): SoftMessage => {
  const out: Record<CandidateKey, number> = {};
  for (const k of keysOf(a, b)) out[k] = (a[k] ?? 0) - (b[k] ?? 0);
  return Object.freeze(out);
};

/**
 * Candidates this message pushed all the way to the floor — a NEUTRAL FACT.
 *
 * It reports that a message's opinion was clamped. It does NOT report why, and
 * the readings are genuinely different: an adversary suppressing a candidate, a
 * sensor with no data reporting zero, and a correct assessment of a bad
 * candidate all look identical here. Attaching a verdict would bake in a
 * morality the substrate may not hold; the caller's oracle decides.
 */
export const atInfluenceFloor = (m: SoftMessage): CandidateKey[] =>
  Object.keys(m)
    .filter((k) => m[k] === -MAX_INFLUENCE)
    .sort();

/**
 * Normalize to a decision-ready distribution: candidate → probability.
 *
 * The exit from message space to `SoftValue` space. Softmax over log-weights,
 * shifted by the max for numerical stability. Floats appear HERE and only here
 * — every operation above is exact integer arithmetic, so the whole inference
 * is reproducible and only the final read-out is approximate.
 */
export const toDistribution = (m: SoftMessage): Record<CandidateKey, number> => {
  const keys = Object.keys(m).sort();
  if (keys.length === 0) return {};
  const top = Math.max(...keys.map((k) => m[k]!));
  const exps = keys.map((k) => Math.exp((m[k]! - top) / SCALE));
  const total = exps.reduce((s, v) => s + v, 0);
  const out: Record<CandidateKey, number> = {};
  keys.forEach((k, i) => (out[k] = exps[i]! / total));
  return out;
};

/**
 * The argmax candidate, ties broken by ascending key.
 *
 * Same tie-break as the TS SoftValue oracle, which F# got wrong until
 * 2026-08-23 — matching it here is deliberate so the two agree.
 */
export const argmax = (m: SoftMessage): CandidateKey | null => {
  const keys = Object.keys(m).sort();
  if (keys.length === 0) return null;
  let best = keys[0]!;
  for (const k of keys) if (m[k]! > m[best]!) best = k;
  return best;
};

// ── THE SYBIL HOLE, AND THE FORMULA THAT CLOSES IT ────────────────────────────
//
// Bounded influence stops ONE message from vetoing a candidate. It does nothing
// about an attacker who sends N messages, because `product` adds and N * BOUND
// grows without limit. Per-message bounds without identity are worthless against
// a Sybil (Douceur 2002), and "enough others will outvote it" quietly assumes
// the others are DISTINCT.
//
// The fix is not an identity registry bolted on the side. It is that ADDING
// LOG-WEIGHTS IS ONLY CORRECT FOR INDEPENDENT EVIDENCE, and clones are not
// independent — which is the same sentence as `numerology-vs-number-theory.md`'s
// "N correlated observations are not N observations", and the same sentence as
// `SocietyUsefulWork.fs:95`, which states it and then warns that it has TWO
// correct quantifications and picking the wrong one is itself the error.
//
// It composes with the anti-Sybil substrate rather than duplicating it.
// `AntiSybil.fs` establishes that forging k identities from s < k entropy
// sources forces, by pigeonhole, two CORRELATED bit-streams — so a Sybil is
// detectable AS correlation. That measured correlation is exactly the ρ this
// combine consumes. Detection and pricing meet at one number.
//
// And it stays dual-use neutral, which is the part worth noticing: high ρ might
// be a Sybil, or two honest cameras pointed at the same thing. This discounts
// both, CORRECTLY, because correlated evidence really is worth less either way.
// The anti-Sybil property falls out of getting the statistics right rather than
// out of accusing anybody.

/**
 * Kish effective sample size — how many INDEPENDENT messages n correlated ones
 * are worth.
 *
 *     deff = 1 + (n - 1) * rho          (Kish 1965, Survey Sampling, ch. 5)
 *     nEff = n / deff
 *
 * `rho = 0` gives `nEff = n` (independent); `rho = 1` gives `nEff = 1` — one
 * observation counted n times, which is precisely a Sybil fleet.
 *
 * DELIBERATELY KISH AND NOT `unionEquivalentAgentCount`, because
 * `SocietyUsefulWork.fs:95-98` requires the choice be deliberate: the two agree
 * only at the endpoints. The question here is how much independent INFORMATION
 * n correlated voices carry when their log-evidence is summed — an
 * effective-sample-size question. It is not "what fraction of facts would this
 * many independent agents have discovered", which is the union question and a
 * different formula.
 *
 * `rho` is clamped to [0,1], matching the F# peer: negative intraclass
 * correlation is real in survey work but is not a regime this substrate
 * produces, so it is refused rather than silently extrapolated.
 */
export const effectiveCount = (n: number, rho: number): number => {
  if (n < 1) return 0;
  const r = rho < 0 ? 0 : rho > 1 ? 1 : rho;
  return n / (1 + (n - 1) * r);
};

/**
 * Combine many messages, DISCOUNTED BY THEIR CORRELATION.
 *
 * The sum is scaled by `nEff / n`, so n messages correlated at `rho` carry the
 * evidence of `nEff` independent ones.
 *
 *   - `rho = 0` reproduces {@link product} folded over the list, exactly.
 *   - `rho = 1` makes N identical clones worth ONE message. **Cloning buys
 *     nothing**, which is the Sybil defence stated as arithmetic rather than as
 *     a policy.
 *
 * Rounded back to integers so the exactness the whole module rests on survives
 * the scaling — a fractional log-weight would reintroduce the float
 * associativity drift that integer natural parameters exist to prevent.
 *
 * HONEST LIMIT: this takes `rho` as given. It does not measure it, and a caller
 * that passes `rho = 0` for a colluding fleet gets no protection at all. The
 * measurement is `AntiSybil`'s job (correlated drift streams); this is the
 * pricing. Wiring the two together is not done here, and until it is, this is
 * a mechanism awaiting its sensor.
 */
export const productAll = (messages: readonly SoftMessage[], rho: number): SoftMessage => {
  if (messages.length === 0) return uniform;
  const summed = messages.reduce<SoftMessage>((acc, m) => product(acc, m), uniform);
  const n = messages.length;
  const scale = effectiveCount(n, rho) / n;
  const out: Record<CandidateKey, number> = {};
  for (const k of Object.keys(summed).sort()) out[k] = Math.round(summed[k]! * scale);
  return Object.freeze(out);
};

// ── WIRING THE SENSOR TO THE PRICING ─────────────────────────────────────────
//
// `productAll` takes rho as GIVEN, so a caller who passes 0 for a colluding
// fleet gets no protection. This is the other half: consume a distinctness
// readout produced by the anti-Sybil probe and collapse messages that came from
// one source, so the discount is MEASURED rather than asserted.
//
// WHY NOT ESTIMATE CORRELATION FROM THE MESSAGES THEMSELVES. It is the obvious
// move and it is wrong. Message content cannot distinguish collusion from
// genuine agreement, so an in-band estimator penalises honest consensus — the
// rho->1 collapse that `anti-babel-preserve-reconcilability.md` warns about,
// arrived at by trying to prevent it. `AntiSybil.fs` avoids this by measuring
// an UNFORGEABLE EXTERNAL TRACE (clock-drift entropy, non-fungible across
// identities) rather than what the messages say. Two honest sensors that agree
// have uncorrelated drift; two puppets of one clock do not.
//
// The claim that substrate rests on (AntiSybil.fs:10-14): forging k identities
// from s < k entropy sources must, by pigeonhole, re-use a source, so two
// emitted streams are correlated and a discriminator catches them.

/**
 * A batch-local source assignment: claimed-identity index → source component id.
 *
 * This is `AntiSybil.DistinctnessReadout.SourceOf` — and the shape carries a
 * trap that `dual-use-detection-is-neutral-oracle-decides.md` documents from a
 * live incident: components are numbered `0 .. DistinctCount-1` **per
 * invocation, over one batch**, so the same physical source can be numbered
 * differently next time. It is NOT a durable identity. Recognising sameness and
 * assigning identity are two different functions, and using this as the latter
 * produces silently-merged evidence under a colliding key.
 *
 * Using it HERE is the legitimate case, because combining a batch of messages
 * IS one batch. Do not persist it.
 */
export type SourceAssignment = ReadonlyMap<number, number>;

/**
 * Combine messages, collapsing those the probe traced to a single source.
 *
 * Messages sharing a source id are averaged into ONE message's worth before the
 * cross-source product, so a fleet of n puppets from one clock carries exactly
 * what one participant carries. Averaging rather than summing within a group is
 * the point: summing would let a source amplify itself by splitting its opinion
 * across puppets, which is the attack restated.
 *
 * Cross-source combination is the plain independent product, which is now
 * CORRECT rather than assumed — the probe has established the sources are
 * distinct, which is exactly `product`'s stated precondition.
 *
 * `sourceOf` missing an index is treated as its own distinct source. That is
 * the fail-OPEN direction and it is deliberate: an unmeasured participant is
 * given the benefit of the doubt, matching `manifesto §11` default regard and
 * `TravelerRankLedger`'s honest 0.5 prior for a fresh identity rather than a
 * pessimistic clamp. The cost is stated plainly — a participant the probe never
 * saw is not discounted, so coverage of the probe is load-bearing.
 */
export const productByDistinctSource = (
  messages: readonly SoftMessage[],
  sourceOf: SourceAssignment,
): SoftMessage => {
  if (messages.length === 0) return uniform;

  const groups = new Map<number, SoftMessage[]>();
  let nextSyntheticSource = -1;
  messages.forEach((m, i) => {
    // Unmeasured => its own source (fail-open, see above). Negative ids cannot
    // collide with the probe's `0 .. DistinctCount-1`.
    const src = sourceOf.get(i) ?? nextSyntheticSource--;
    const bucket = groups.get(src);
    if (bucket) bucket.push(m);
    else groups.set(src, [m]);
  });

  let joint: SoftMessage = uniform;
  for (const src of [...groups.keys()].sort((a, b) => a - b)) {
    const members = groups.get(src)!;
    const summed = members.reduce<SoftMessage>((acc, m) => product(acc, m), uniform);
    const collapsed: Record<CandidateKey, number> = {};
    for (const k of Object.keys(summed).sort()) {
      collapsed[k] = Math.round(summed[k]! / members.length);
    }
    joint = product(joint, Object.freeze(collapsed));
  }
  return joint;
};

/**
 * How many distinct sources a batch actually had — the forgery-cost floor.
 *
 * A NEUTRAL COUNT, not a verdict. `AntiSybil.DistinctnessReadout` names this the
 * floor on how many independent clocks an adversary needed; it is equally the
 * count of honest participants who happen to share a machine. The mechanism
 * reports the number; the oracle decides what it means.
 */
export const distinctSourceCount = (
  messageCount: number,
  sourceOf: SourceAssignment,
): number => {
  const seen = new Set<number>();
  let unmeasured = 0;
  for (let i = 0; i < messageCount; i++) {
    const s = sourceOf.get(i);
    if (s === undefined) unmeasured++;
    else seen.add(s);
  }
  return seen.size + unmeasured;
};
