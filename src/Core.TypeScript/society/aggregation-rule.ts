/**
 * aggregation-rule.ts — **the building blocks, typed so the non-dominating choice has to say its
 * name.** The TypeScript twin of `src/Core/AggregationRule.fs`, which carries the full argument.
 *
 * In one line:
 *
 * > **k-of-n is the generator and the dominating rules are its endpoints** — `union` is `k = 1`,
 * > `veto` is `k = n`, unweighted majority is `k = ceil(n/2)` — **but the family is smooth in `k` and
 * > the dominance property is not.** It holds at both endpoints and fails everywhere strictly
 * > between, so the strict middle is a separate case and it must carry a **justification**.
 *
 * Depends on, and does not re-derive:
 *
 * - **PR #10945**, the Dominance Lift Theorem: an aggregation rule beats its best part **iff it can
 *   imitate that part**. Unweighted k-of-n cannot, and loses to its best member in 58.8% of 20 000
 *   exact draws at `rho = 0` — heterogeneity, not correlation, is what kills it.
 * - **PR #10955**, the inventory of 21 live aggregation sites. The classification table for those
 *   sites is a fixture in the tests, not in this module: the module ships the algebra, the tests ship
 *   the repo-meta.
 * - **`aggregation.canImitateEveryProjection`** in `./levels` — the witness-level check, which this
 *   module hands rules to rather than duplicating. See `imitationWitnesses`, and see the honest limit
 *   in the F# header: the witness check is weak enough that unweighted 2-of-3 discharges it with
 *   cherry-picked witnesses, which is exactly why the structural verdict below is not redundant.
 *
 * The justification field is what keeps **BFT honest**: `k = 2f+1` is correct in a Byzantine quorum,
 * justified by **fault tolerance**, not by accuracy over heterogeneous competences. Without it the
 * type would be calling BFT a defect, which the inventory verified it is not.
 *
 * **No correlation threshold appears here and none should be added** — PR #10945 showed `rho` is not
 * a sufficient statistic for the verdict (counterexample at `m = 9`, `rho = 0.2495`, inside the
 * published safe `rho*(9) = 0.25`, 40M trials).
 *
 * **No behaviour.** Nothing here aggregates anything; it classifies rules that already exist.
 *
 * **Register: `unmetered`** (`toy-is-free-metered-must-be-earned`) — a classification with no
 * consumer that changes a decision.
 */

/**
 * **Where a set of weights comes from** — the half of "weighted majority" that decides whether the
 * Dominance Lift hypothesis is actually discharged. The rule class of weighted rules contains every
 * projection whatever the weights are (weight 1 on `i`, 0 elsewhere); the theorem additionally needs
 * the rule to be **optimal** in that class, which is a fact about the weights, not the shape.
 */
export type WeightBasis =
  /**
   * Nitzan–Paroush: `w_i = log(c_i / (1 - c_i))` from a **measured** per-unit competence. Optimal
   * under conditional independence, so the rule is deferential and the lift holds. **No site in this
   * repo has one** — nobody has measured a competence.
   */
  | { readonly kind: "log-odds-competence" }
  /**
   * The weight is read off the evidence itself rather than estimated from a track record — a
   * likelihood ratio, an inverse variance. That is the log-odds quantity computed per observation, so
   * it is deferential *and* needs nothing estimated: an uninformative unit contributes a near-flat
   * factor and drops out, a sharp one dictates.
   */
  | { readonly kind: "endogenous-evidence"; readonly quantity: string }
  /**
   * The weight measures exposure, tenure, or evidence seen — something that accrues **without the
   * unit having been right**. Deference is reachable and is not chosen.
   */
  | { readonly kind: "experience-proxy"; readonly quantity: string }
  /**
   * The claimant sets its own weight. Deference is reachable, is not chosen, and the failure mode is
   * the theorem's cost 2: deferring to a unit *believed* best but which is not.
   */
  | { readonly kind: "self-asserted"; readonly quantity: string };

/**
 * **Why a strict-middle threshold is nonetheless the right rule** — or the admission that nothing
 * says so. Doubles as the statement of what a site is *for* when it is not aggregating competences at
 * all (`Purpose` `non-accuracy`), because those are the same question.
 */
export type Justification =
  /** A Byzantine quorum, `k = 2f+1`. Safety against adversarial nodes; unweighted is correct and deliberate. Not an accuracy claim. */
  | { readonly kind: "fault-tolerance"; readonly toleratedFaults: number }
  /** Units are supposed to produce identical output; disagreement is corruption, not competence. A unanimous-but-wrong result still fails, by design. */
  | { readonly kind: "integrity-check" }
  /** Counts **independent sources**, not votes — it refuses pseudo-consensus. It checks the theorem's independence hypothesis rather than aggregating under it. */
  | { readonly kind: "independence-check" }
  /** Consent / ratification: that a decision was made properly, not that it is true. */
  | { readonly kind: "legitimacy" }
  /** Permission for an act, not assertion of a claim. "May this proceed", not "is this so". */
  | { readonly kind: "authorization" }
  /** Enough participants to proceed at all. A precondition, not a verdict. */
  | { readonly kind: "liveness-precondition" }
  /** The rule exists to be **studied**, not to decide — a model of a pathology, or the artifact whose defect is the subject. */
  | { readonly kind: "model-not-mechanism" }
  /**
   * A **deliberate, priced** precision-over-recall trade, with the rationale saying what is being
   * bought. The defence a quorum gate is entitled to make. **No site in this repo makes it** — the
   * inventory looked.
   */
  | { readonly kind: "priced-precision-trade"; readonly rationale: string }
  /** **Nothing at the site names a reason.** The finding case: a trade-off made without being priced. */
  | { readonly kind: "unstated"; readonly note: string };

/**
 * **The rule.** `union` and `veto` are the endpoints of the k-of-n generator and are free;
 * `threshold` is its strict middle and must be justified; `weighted` is a different family whose
 * standing depends entirely on its basis.
 *
 * `all-of` / `any-of` are conjunction and disjunction over the same parts. They exist because the
 * constitution gate is genuinely `all-of [veto, threshold(quorum, legitimacy)]` — "any objection
 * vetoes, and k distinct agreements are needed" — and without them that site would have to be
 * mislabelled as one arm or the other. Their dominance laws are exact duals, which is why both ship
 * even though `any-of` currently has **no site in the inventory**; that it is unpopulated is a
 * register label, not a hidden mechanism.
 */
export type Rule =
  /** `k = 1`. Dominates on **recall** by set monotonicity: the union contains what the best finder found, on every sample path. */
  | { readonly kind: "union" }
  /** `k = n`. Dominates on **safety** by the mirror argument: any single unit can stop it. */
  | { readonly kind: "veto" }
  /** Deferential in *shape*; whether the lift holds is the basis. */
  | { readonly kind: "weighted"; readonly basis: WeightBasis }
  /** The strict middle, `1 < k < n`. **Dominates on nothing**, whatever `k` is. The justification is mandatory — that is the point of the type. */
  | { readonly kind: "threshold"; readonly k: number; readonly why: Justification }
  /**
   * **Argmax over a tally with no floor** — "the most-supported value wins", whatever its support.
   * Not a k-of-n threshold: a threshold at least *refuses* when unmet, and plurality never refuses.
   * Over more than two candidates it can return a value backed by a minority of a minority.
   * Dominates on nothing, for the same reason the strict middle does and then some, so it carries a
   * justification too.
   *
   * The case exists because two sites use it and neither is a threshold: `Diversity.coerciveStep`
   * (`countBy` then `maxBy snd`), and the n-way diff's reference fallback — whose helper is **named**
   * `majority` and is in fact plurality, returning the most common value with no absolute-majority
   * test.
   */
  | { readonly kind: "plurality"; readonly why: Justification }
  /** Conjunction. Safety-dominance survives if any arm has it (the accept set only shrinks). An empty list is not a rule. */
  | { readonly kind: "all-of"; readonly rules: readonly Rule[] }
  /** Disjunction. Recall-dominance survives if any arm has it (the accept set only grows). An empty list is not a rule. */
  | { readonly kind: "any-of"; readonly rules: readonly Rule[] };

/** **The axis a rule can dominate its best part on.** A property of the rule alone. */
export type Dominance = "recall" | "safety" | "accuracy";

/**
 * **What a site is trying to be right about** — the axis it *needs*. This is what makes a mirror
 * defect visible: a safety-shaped task carrying an accept-dominant rule is a **pairing**, and a
 * pairing can be wrong in a way a rule alone cannot.
 */
export type Purpose =
  /** A miss is the expensive error; a false positive costs nearly nothing. Discovery, bug-finding, refutation. */
  | { readonly kind: "recall" }
  /** A false pass is the expensive error; a false block costs nearly nothing. */
  | { readonly kind: "safety" }
  /** Both errors cost. The objective the theorem is stated for, and the only one needing the full projection property. */
  | { readonly kind: "two-sided-accuracy" }
  /** Not aggregating competences at all; carries what it *is* doing. */
  | { readonly kind: "non-accuracy"; readonly what: Justification };

/** **The classification of a (purpose, rule) pairing.** */
export type Verdict =
  /** The rule dominates on the axis the purpose needs. */
  | { readonly kind: "dominates"; readonly axis: Dominance }
  /**
   * **The mirror defect.** The rule dominates on the *opposite one-sided axis* to the one needed: a
   * veto on a discovery task, or a union on a safety task. Never previously swept for, because
   * nothing named it.
   */
  | { readonly kind: "mirror-mismatch"; readonly needed: Dominance; readonly offered: Dominance }
  /** Dominates on an axis that is neither the needed one nor its mirror — usually two-sided against one-sided. */
  | { readonly kind: "wrong-axis"; readonly needed: Dominance; readonly offered: Dominance }
  /** Weighted, but the weights are not a competence estimate: deference is **reachable**, not **chosen**. */
  | { readonly kind: "deference-reachable-not-chosen"; readonly basis: WeightBasis }
  /** Dominates on no axis. Carries the reason the site gives; `unstated` is the finding. */
  | { readonly kind: "does-not-dominate"; readonly why: Justification }
  /** Not an accuracy aggregator. The theorem has nothing to say about it, and saying so is not a euphemism for a pass. */
  | { readonly kind: "out-of-scope"; readonly what: Justification }
  /** A threshold inside a non-accuracy site names a *different* purpose than the site does — the guard against relabelling a defect with a comfortable justification. */
  | { readonly kind: "justification-disagrees"; readonly purpose: Purpose; readonly found: Justification };

// ── Constructors (plain object literals; no classes, no instance state) ────────────────────────

export const union: Rule = { kind: "union" };
export const veto: Rule = { kind: "veto" };
export function weighted(basis: WeightBasis): Rule {
  return { kind: "weighted", basis };
}
export function threshold(k: number, why: Justification): Rule {
  return { kind: "threshold", k, why };
}
export function plurality(why: Justification): Rule {
  return { kind: "plurality", why };
}
export function allOf(rules: readonly Rule[]): Rule {
  return { kind: "all-of", rules };
}
export function anyOf(rules: readonly Rule[]): Rule {
  return { kind: "any-of", rules };
}

/**
 * **The generator, and it normalises.** `k` at or below 1 is `union`, `k` at or above `n` is `veto`,
 * and only the strict middle is a `threshold` — so the two dominating rules are not special cases
 * bolted on beside the family, they are the family's endpoints, recovered.
 *
 * `why` is consumed only by the middle case. `n` is clamped to at least 1: a rule over no units is
 * not a rule, and returning something accept-always for it would be a check that cannot fail.
 *
 * This is the function that makes the mirror sweep fall out for free. A gate configured with `k = n`
 * on a discovery task normalises to `veto`, and classifying a recall purpose against `veto` is
 * `mirror-mismatch` — nobody has to notice the coincidence.
 *
 * On a **totally ordered** result the same family is the **order statistics**: `max` is `k = 1`,
 * `min` is `k = n`, the median is `k = ceil(n/2)`. So a median-of-estimates is the same strict middle
 * as an unweighted majority wearing a different statistic, and inherits the same verdict.
 */
export function ofKOfN(k: number, n: number, why: Justification): Rule {
  const members = Math.max(1, n);
  if (k <= 1) return union;
  if (k >= members) return veto;
  return threshold(k, why);
}

/**
 * The axes a rule dominates on — structural, from the rule alone.
 *
 * `all-of` keeps only safety (an intersection of accept sets can only shrink, so a veto arm still
 * blocks everything the strictest unit blocks; but conjoining anything onto an optimal rule destroys
 * its optimality, so accuracy does not survive). `any-of` keeps only recall, dually. An empty
 * composite dominates on nothing, because it is not a rule.
 */
export function dominanceAxes(rule: Rule): readonly Dominance[] {
  switch (rule.kind) {
    case "union":
      return ["recall"];
    case "veto":
      return ["safety"];
    case "weighted":
      switch (rule.basis.kind) {
        case "log-odds-competence":
        case "endogenous-evidence":
          return ["accuracy"];
        case "experience-proxy":
        case "self-asserted":
          return [];
      }
      return [];
    case "threshold":
    case "plurality":
      return [];
    case "all-of":
      if (rule.rules.length === 0) return [];
      return rule.rules.flatMap(dominanceAxes).includes("safety") ? ["safety"] : [];
    case "any-of":
      if (rule.rules.length === 0) return [];
      return rule.rules.flatMap(dominanceAxes).includes("recall") ? ["recall"] : [];
  }
}

/** Every justification named anywhere inside a rule, outermost first. */
export function justificationsIn(rule: Rule): readonly Justification[] {
  switch (rule.kind) {
    case "union":
    case "veto":
    case "weighted":
      return [];
    case "threshold":
    case "plurality":
      return [rule.why];
    case "all-of":
    case "any-of":
      return rule.rules.flatMap(justificationsIn);
  }
}

/**
 * **The full, ordinal, culture-invariant key of a justification, free text included.** Identity for
 * justifications runs through this in both oracles so the "does this threshold name the same purpose
 * the site names" question is decided the same way in F# and TypeScript. Plain `+` concatenation and
 * `===`; no `localeCompare` anywhere in this file (`culture-invariant-by-default`).
 */
export function justificationKey(j: Justification): string {
  switch (j.kind) {
    case "fault-tolerance":
      return "fault-tolerance:" + String(j.toleratedFaults);
    case "priced-precision-trade":
      return "priced-precision-trade:" + j.rationale;
    case "unstated":
      return "unstated:" + j.note;
    case "integrity-check":
    case "independence-check":
    case "legitimacy":
    case "authorization":
    case "liveness-precondition":
    case "model-not-mechanism":
      return j.kind;
  }
}

/**
 * The coarse tag — the case name with the free text dropped. This is what the cross-oracle verdict
 * lock compares, so rewording a `note` does not churn a golden table while a change of *case* does.
 */
export function justificationTag(j: Justification): string {
  switch (j.kind) {
    case "fault-tolerance":
      return "fault-tolerance:" + String(j.toleratedFaults);
    default:
      return j.kind;
  }
}

function isMirror(needed: Dominance, offered: Dominance): boolean {
  return (needed === "recall" && offered === "safety") || (needed === "safety" && offered === "recall");
}

function classifyAgainstAxis(needed: Dominance, rule: Rule): Verdict {
  const axes = dominanceAxes(rule);
  if (axes.includes(needed)) return { kind: "dominates", axis: needed };

  const offered = axes[0];
  if (offered !== undefined) {
    return isMirror(needed, offered)
      ? { kind: "mirror-mismatch", needed, offered }
      : { kind: "wrong-axis", needed, offered };
  }

  if (rule.kind === "weighted") return { kind: "deference-reachable-not-chosen", basis: rule.basis };
  if (rule.kind === "threshold" || rule.kind === "plurality") return { kind: "does-not-dominate", why: rule.why };
  return {
    kind: "does-not-dominate",
    why: { kind: "unstated", note: "composite rule, no arm of which dominates on the axis this purpose needs" },
  };
}

/**
 * **Classify a pairing.** Total, pure, and the only place a verdict is produced.
 *
 * A non-accuracy site is `out-of-scope` — but only after checking that every justification written
 * inside its rule agrees with what the site says it is for. That check is what stops a defect being
 * laundered by labelling a bare quorum `fault-tolerance`.
 */
export function classify(purpose: Purpose, rule: Rule): Verdict {
  switch (purpose.kind) {
    case "recall":
      return classifyAgainstAxis("recall", rule);
    case "safety":
      return classifyAgainstAxis("safety", rule);
    case "two-sided-accuracy":
      return classifyAgainstAxis("accuracy", rule);
    case "non-accuracy": {
      const stated = justificationKey(purpose.what);
      const found = justificationsIn(rule).find((j) => justificationKey(j) !== stated);
      if (found !== undefined) return { kind: "justification-disagrees", purpose, found };
      return { kind: "out-of-scope", what: purpose.what };
    }
  }
}

/**
 * The boolean reading of a rule, for the rules that have one. `weighted` has none — it needs numbers,
 * not votes — and an empty composite has none, because it is not a rule.
 */
export function toBooleanRule(rule: Rule): ((votes: readonly boolean[]) => boolean) | undefined {
  switch (rule.kind) {
    case "union":
      return (votes) => votes.some((v) => v);
    case "veto":
      return (votes) => votes.length > 0 && votes.every((v) => v);
    case "threshold": {
      const k = rule.k;
      return (votes) => votes.filter((v) => v).length >= k;
    }
    case "weighted":
    case "plurality":
      return undefined;
    case "all-of": {
      if (rule.rules.length === 0) return undefined;
      const parts = rule.rules.map(toBooleanRule);
      if (parts.some((p) => p === undefined)) return undefined;
      const fns = parts as readonly ((votes: readonly boolean[]) => boolean)[];
      return (votes) => fns.every((f) => f(votes));
    }
    case "any-of": {
      if (rule.rules.length === 0) return undefined;
      const parts = rule.rules.map(toBooleanRule);
      if (parts.some((p) => p === undefined)) return undefined;
      const fns = parts as readonly ((votes: readonly boolean[]) => boolean)[];
      return (votes) => fns.some((f) => f(votes));
    }
  }
}

/**
 * **The witness family a rule derives from itself**, for handing to
 * `aggregation.canImitateEveryProjection` in `./levels`.
 *
 * For `union` the witness for index `i` is the input in which only `i` accepts: the rule returns
 * `true`, which is exactly `i`'s answer. For `veto`, only `i` rejects. Both are read off the rule's
 * own definition, not constructed to pass.
 *
 * `undefined` for everything else — and that is **not** a proof that no witness family exists. It
 * cannot be: the witness check is weak enough that unweighted 2-of-3 passes it with cherry-picked
 * witnesses (locked in the tests). `classify` is what discriminates; this only supplies witnesses
 * where they are derivable.
 */
export function imitationWitnesses(memberCount: number, rule: Rule): readonly (readonly boolean[])[] | undefined {
  if (memberCount <= 0) return undefined;
  const indices = Array.from({ length: memberCount }, (_, i) => i);
  if (rule.kind === "union") return indices.map((i) => indices.map((j) => j === i));
  if (rule.kind === "veto") return indices.map((i) => indices.map((j) => j !== i));
  return undefined;
}

/**
 * A canonical, ordinal, culture-invariant text key for a verdict. Exists so the F# and TypeScript
 * classifications can be compared as text across the oracle boundary, per `no-binary-in-proof-lineage`
 * — the byte-lock is a readable string, not a structure. Must stay identical to
 * `AggregationRule.verdictKey` in F#.
 */
export function verdictKey(verdict: Verdict): string {
  const purposeKey = (p: Purpose): string =>
    p.kind === "non-accuracy" ? "non-accuracy:" + justificationTag(p.what) : p.kind;

  const basisKey = (b: WeightBasis): string => (b.kind === "log-odds-competence" ? b.kind : b.kind + ":" + b.quantity);

  switch (verdict.kind) {
    case "dominates":
      return "dominates:" + verdict.axis;
    case "mirror-mismatch":
      return "mirror-mismatch:" + verdict.needed + ":" + verdict.offered;
    case "wrong-axis":
      return "wrong-axis:" + verdict.needed + ":" + verdict.offered;
    case "deference-reachable-not-chosen":
      return "deference-reachable-not-chosen:" + basisKey(verdict.basis);
    case "does-not-dominate":
      return "does-not-dominate:" + justificationTag(verdict.why);
    case "out-of-scope":
      return "out-of-scope:" + justificationTag(verdict.what);
    case "justification-disagrees":
      return "justification-disagrees:" + purposeKey(verdict.purpose) + ":" + justificationTag(verdict.found);
  }
}
