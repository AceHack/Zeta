/**
 * composition-read.ts — the READ-PATH for composition: what A needs to decide whether to
 * build on B.
 *
 * Aaron 2026-08-17: *"lego like building for one intelligence to connect together and build
 * on other intelligences based on past reliability."* This module is the **consumption**
 * half of that. It answers *"what is on the record about B, in the capability A needs?"* and
 * it deliberately does **not** answer *"is B reliable enough?"* — see §4.
 *
 * `participantId` is an opaque string throughout. Nothing here assumes a model, a prompt, a
 * tick, or a process, because Aaron's ask covers humans and AI on the same surface: a human
 * consultant and an agent are both just an id with a conferred record.
 *
 * REGISTER: `unmetered`. The read is exact over whatever records exist; the records
 * themselves ship EMPTY (`competence-attribution.ts`), so every read today returns `unknown`
 * — which is the honest answer and the reason `unknown` is a first-class constructor rather
 * than a zero.
 *
 * ── 1. WHAT THIS IS BUILT ON, AND WHAT IT DOES NOT RE-DERIVE ───────────────────────
 *
 * The estimator already exists and is not duplicated here:
 *   - `traveler-rank-ledger.ts` / `src/Core/TravelerRankLedger.fs` — the ADF/TrueSkill probit
 *     posterior per (traveler, hat-domain). `trustBand` and `temperedUpdate` are imported,
 *     never re-implemented, so a composition read and a rank read cannot silently diverge.
 *   - `competence-attribution.ts` — the event source, the typed treatment edges, canonical
 *     order, the self-labeled guard, and the jurisdiction/persuasive-weight machinery.
 *     `attribute()` is called, not re-written.
 *
 * What is genuinely new is the **shape of the answer**: a per-scope partition addressed to a
 * *consumer* with a *specific capability need*, rather than a single number about a person.
 *
 * ── 2. CONFERRED, NEVER SELF-ASSERTED ──────────────────────────────────────────────
 *
 * There is no parameter on any function here through which B can supply a number about B.
 * That is the design, not an oversight: a composition surface where the provider advertises
 * its own reliability would be a Sybil's cheapest attack and would break the standing pattern
 * (the privacy budget, the naming eigenvector, and the rank ledger are all *conferred*).
 *
 * The only inputs are `OutcomeRecord`s (which carry a REQUIRED `labeler`) and
 * `TreatmentEdge`s. `attribute()` already refuses an outcome whose labeler is the agent it
 * would update; this module surfaces that refusal as `selfAttestedExcluded` so a caller can
 * see that B tried, and reads `unknown` when the self-attestations were all there was.
 *
 * ── 3. BINDING AND PERSUASIVE ARE NEVER SUMMED ─────────────────────────────────────
 *
 * `TravelerRankLedger`'s domain isolation exists so that *standing as a verifier does not buy
 * standing as a signer*. A read that collapsed B's record across scopes into one number would
 * destroy exactly that property while looking more helpful. So the read returns:
 *
 *   - `binding` — B's record in the capability A actually needs (weight 1), possibly absent;
 *   - `persuasive` — one block PER other scope, each with its own weight and its own
 *     posterior, never folded into `binding`.
 *
 * `binding === undefined` with a non-empty `persuasive` is a real and common answer: *"B has
 * a record, but not in the thing you are asking for."* Collapsing that into a number is the
 * failure this partition prevents.
 *
 * ── 4. NO VERDICT, NO THRESHOLD — THE CALLER'S ORACLE DECIDES ──────────────────────
 *
 * *"Is B reliable enough for A to depend on?"* implies a constant, and a constant here would
 * be a hidden oracle deciding who gets built upon. This module ships **no** such constant and
 * **no** `isGoodEnough`. Precedent: `chip9/consult-census.ts` computes a total-variation
 * distance and returns no verdict, because *"how different is too different"* has no
 * defensible constant; *"how reliable is reliable enough"* has less of one, because it also
 * varies by what A is risking.
 *
 * A caller that genuinely needs a gate brings its own `DependencyPolicy`, and `applyPolicy`
 * REFUSES one that does not name what its numbers were derived from. The attribution is
 * mechanically required, so this surface cannot mint an unattributed gating constant.
 *
 * ── 5. THE CHAIN IS REPORTED, NOT MULTIPLIED ───────────────────────────────────────
 *
 * A builds on B builds on C. `readCompositionChain` returns the per-link reads and the
 * indices of the unknown links. It does NOT return a product of trust bands: multiplying
 * across links asserts independence between links that nobody measured, and a stack of
 * agents that all learned from the same substrate is precisely the correlated case where
 * that product is most wrong (`numerology-vs-number-theory.md`: many correlated
 * observations are not many observations).
 *
 * Composes with:
 *   - src/Core.TypeScript/planning/competence-attribution.ts (the event source + attribution)
 *   - src/Core.TypeScript/planning/traveler-rank-ledger.ts (the estimator; ADF probit)
 *   - src/Core.TypeScript/planning/calibration-bridge.ts (the write-path that produces outcomes)
 */

import { stringCompare } from "../collation/collation";
import {
  type Admission,
  type AttributedObservation,
  type CompetenceSeries,
  type Jurisdiction,
  type AttributionRule,
  FOLDED_SERIES,
  STANCE_BEARING,
  type OutcomeRecord,
  type TreatmentEdge,
  attribute,
  temperedUpdate,
} from "./competence-attribution";
import { SIGMA_0, type SkillBelief, freshBelief, trustBand } from "./traveler-rank-ledger";

// ─────────────────────────────────────────────────────────────────────────────
// The question A asks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One composition question: *"I am A; may I build on B for this capability?"*
 *
 * Both ids are opaque — a human's id and an agent's id are the same kind of thing here.
 */
export interface CompositionQuery {
  /** A — the participant considering the dependency. Recorded for provenance; never scored. */
  readonly consumerId: string;
  /** B — the participant whose record is being read. */
  readonly providerId: string;
  /** The hat-domain of the capability B would supply. */
  readonly hatDomain: string;
  /** The scope A needs it in. Evidence from elsewhere enters as `persuasive`, never binding. */
  readonly capability: Jurisdiction;
  /** Which evidence series to read. `review-vote` is refused — see `readDependency`. */
  readonly series: CompetenceSeries;
}

// ─────────────────────────────────────────────────────────────────────────────
// The answer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * B's record within ONE scope. One block per scope; blocks are never merged, because
 * merging is what would let standing in one domain pay for standing in another.
 */
export interface EvidenceBlock {
  /** The scope these observations were recorded in. */
  readonly jurisdiction: Jurisdiction;
  /** `1` when this scope is the queried capability; `1/(1+distance)` otherwise. */
  readonly weight: number;
  readonly obsCount: number;
  readonly hits: number;
  readonly misses: number;
  readonly mu: number;
  readonly sigma2: number;
  /** Φ(μ/√(σ²+β²)) over THIS block alone. Never an aggregate across blocks. */
  readonly trustBand: number;
  /** σ²/σ₀² — how much of this block is still prior. `1` would mean nothing moved it. */
  readonly priorShare: number;
}

/** What A is told. `unknown` carries no score field, so it cannot be read as one. */
export type DependencyRead =
  | {
      readonly kind: "unknown";
      readonly consumerId: string;
      readonly providerId: string;
      readonly hatDomain: string;
      readonly capability: Jurisdiction;
      readonly series: CompetenceSeries;
      readonly ruleId: string;
      /** `0` by construction — the constructor exists precisely because there is nothing to read. */
      readonly conferredCount: 0;
      /** Outcomes B labeled about B. Reported so a caller sees the attempt; never scored. */
      readonly selfAttestedExcluded: number;
      /** Outcomes below `MIN_PERSUASIVE_WEIGHT` — too far out of scope to bear on this read. */
      readonly scopedOut: number;
      /** Outcomes that attributed to nobody. Non-zero is a mechanism finding, not a clean record. */
      readonly unattributable: number;
      readonly note: string;
    }
  | {
      readonly kind: "recorded";
      readonly consumerId: string;
      readonly providerId: string;
      readonly hatDomain: string;
      readonly capability: Jurisdiction;
      readonly series: CompetenceSeries;
      readonly ruleId: string;
      /**
       * B's record IN THE QUERIED CAPABILITY. `undefined` means B has a record, but not in
       * the thing A asked for — a real answer, and not a bad one.
       */
      readonly binding: EvidenceBlock | undefined;
      /** One block per other scope, ordered by jurisdiction. Never folded into `binding`. */
      readonly persuasive: readonly EvidenceBlock[];
      readonly conferredCount: number;
      readonly selfAttestedExcluded: number;
      readonly scopedOut: number;
      readonly unattributable: number;
    };

// ─────────────────────────────────────────────────────────────────────────────
// The read
// ─────────────────────────────────────────────────────────────────────────────

function foldBlock(jurisdiction: Jurisdiction, obs: readonly AttributedObservation[]): EvidenceBlock {
  let belief: SkillBelief = freshBelief;
  let hits = 0;
  let misses = 0;
  let weight = 1;
  for (const o of obs) {
    belief = temperedUpdate(o.hit, belief, o.weight);
    if (o.hit) hits += 1;
    else misses += 1;
    weight = o.weight;
  }
  return {
    jurisdiction,
    weight,
    obsCount: belief.obsCount,
    hits,
    misses,
    mu: belief.mu,
    sigma2: belief.sigma2,
    trustBand: trustBand(belief),
    priorShare: belief.sigma2 / (SIGMA_0 * SIGMA_0),
  };
}

/**
 * Read what is on the record about B, for the capability A needs.
 *
 * Returns a `Result`, never throws: `review-vote` is refused, because folding the review
 * vote into a composition decision is how a popular participant becomes depended-upon by
 * construction — the circularity `competence-attribution.ts` keeps `review-vote` unfoldable
 * to prevent. Refusing it here too keeps that guard from being routed around by asking the
 * question a different way.
 *
 * There is no parameter through which B supplies anything about B.
 */
export function readDependency(
  outcomes: readonly OutcomeRecord[],
  edges: readonly TreatmentEdge[],
  query: CompositionQuery,
  rule: AttributionRule = STANCE_BEARING,
): Admission<DependencyRead> {
  if (!FOLDED_SERIES.includes(query.series)) {
    return {
      ok: false,
      reason: `composition-read: series ${JSON.stringify(query.series)} is recorded, never folded — a composition decision may not rest on it`,
    };
  }
  if (query.providerId.length === 0) return { ok: false, reason: "empty providerId" };
  if (query.consumerId.length === 0) return { ok: false, reason: "empty consumerId" };

  const result = attribute(outcomes, edges, query.series, query.capability, rule);

  const mine = result.observations.filter(
    (o) =>
      stringCompare(o.agentId, query.providerId) === 0 &&
      stringCompare(o.hatDomain, query.hatDomain) === 0,
  );

  // The provider's own attempts to certify itself, surfaced rather than silently dropped.
  const selfAttestedExcluded = result.noUpdate.filter(
    (n) => n.reason === "self-labeled" && n.agentId !== undefined && stringCompare(n.agentId, query.providerId) === 0,
  ).length;
  const scopedOut = result.noUpdate.filter((n) => n.reason === "scoped-out").length;
  const unattributable = result.noUpdate.filter((n) => n.reason === "unattributable").length;

  const common = {
    consumerId: query.consumerId,
    providerId: query.providerId,
    hatDomain: query.hatDomain,
    capability: query.capability,
    series: query.series,
    ruleId: result.ruleId,
    selfAttestedExcluded,
    scopedOut,
    unattributable,
  } as const;

  if (mine.length === 0) {
    return {
      ok: true,
      value: {
        kind: "unknown",
        ...common,
        conferredCount: 0,
        note:
          "no conferred observations about this provider in this hat-domain — a statement about what is unrecorded, NOT a low score and NOT a clean record",
      },
    };
  }

  // Partition by the scope the evidence was recorded in; blocks are never merged.
  const byScope = new Map<Jurisdiction, AttributedObservation[]>();
  for (const o of mine) {
    const list = byScope.get(o.jurisdiction);
    if (list) list.push(o);
    else byScope.set(o.jurisdiction, [o]);
  }

  const bindingObs = byScope.get(query.capability);
  const persuasive: EvidenceBlock[] = [];
  for (const [scope, obs] of [...byScope.entries()].sort((a, b) => stringCompare(a[0], b[0]))) {
    if (stringCompare(scope, query.capability) === 0) continue;
    persuasive.push(foldBlock(scope, obs));
  }

  return {
    ok: true,
    value: {
      kind: "recorded",
      ...common,
      binding: bindingObs === undefined ? undefined : foldBlock(query.capability, bindingObs),
      persuasive,
      conferredCount: mine.length,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Explanation — for a human reading the same surface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A one-paragraph rendering of a read, for a human or an agent that wants prose.
 * States the `unknown` case as an absence, explicitly, because *"no record"* read as
 * *"bad record"* is the whitewash window reopened from the consumer side.
 */
export function explain(read: DependencyRead): string {
  const who = `${read.providerId} in ${read.hatDomain} @ ${read.capability}`;
  if (read.kind === "unknown") {
    return (
      `${who}: UNKNOWN — nothing conferred is on the record. This is not a low score and not a clean record; ` +
      `it is an absence. ${String(read.selfAttestedExcluded)} self-attested outcome(s) were excluded, ` +
      `${String(read.scopedOut)} scoped out, ${String(read.unattributable)} unattributable. ` +
      `No threshold is applied here — what to do about an unknown is ${read.consumerId}'s call.`
    );
  }
  const b = read.binding;
  const bindingText =
    b === undefined
      ? "no record in the queried capability itself"
      : `${String(b.hits)} hit / ${String(b.misses)} miss over ${String(b.obsCount)} conferred observation(s), trustBand ${b.trustBand.toFixed(3)}, priorShare ${b.priorShare.toFixed(3)}`;
  const persuasiveText =
    read.persuasive.length === 0
      ? "no adjacent-scope record"
      : read.persuasive
          .map(
            (p) =>
              `${p.jurisdiction} (weight ${p.weight.toFixed(3)}): ${String(p.hits)}/${String(p.misses)}, trustBand ${p.trustBand.toFixed(3)}`,
          )
          .join("; ");
  return (
    `${who}: binding — ${bindingText}. Persuasive (NOT added to the binding figure) — ${persuasiveText}. ` +
    `${String(read.selfAttestedExcluded)} self-attested excluded. No verdict is offered; ${read.consumerId} decides.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy — the caller's own oracle, and the attribution it must carry
// ─────────────────────────────────────────────────────────────────────────────

/** What a caller's policy concluded. The vocabulary is the caller's; nothing here names one. */
export interface PolicyDecision {
  readonly choice: string;
  readonly because: string;
}

/**
 * A consumer-supplied decision rule. This module ships none — not even a default — because a
 * default here would be the hidden oracle deciding who gets built upon.
 *
 * `derivedFrom` is REQUIRED and checked: whatever constant the policy uses must name what it
 * came from, inline, at the point of use. An audit merged 2026-08-16 (#11534) found 112
 * unattributed gating constants; this surface is closed to the 113th by construction.
 */
export interface DependencyPolicy {
  readonly id: string;
  /** Where this policy's numbers come from — a measurement, a paper, a named human's call. */
  readonly derivedFrom: string;
  readonly decide: (read: DependencyRead) => PolicyDecision;
}

/** A policy's decision, carried together with the read and the attribution that licensed it. */
export interface PolicyOutcome {
  readonly policyId: string;
  readonly derivedFrom: string;
  readonly decision: PolicyDecision;
  readonly read: DependencyRead;
}

/**
 * Apply a caller's policy to a read. Refuses an unattributed policy — that refusal is the
 * whole reason this indirection exists rather than callers reading `trustBand` directly.
 */
export function applyPolicy(read: DependencyRead, policy: DependencyPolicy): Admission<PolicyOutcome> {
  if (policy.id.trim().length === 0) return { ok: false, reason: "policy has no id" };
  if (policy.derivedFrom.trim().length === 0) {
    return {
      ok: false,
      reason: `policy ${JSON.stringify(policy.id)} names no derivation for its numbers — an unattributed gating constant is refused`,
    };
  }
  return {
    ok: true,
    value: { policyId: policy.id, derivedFrom: policy.derivedFrom, decision: policy.decide(read), read },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The lego stack — reported, never multiplied
// ─────────────────────────────────────────────────────────────────────────────

/** A composition chain: A→B, B→C, … one query per link, in build order. */
export interface ChainRead {
  readonly links: readonly DependencyRead[];
  /** Indices of links that read `unknown`. Empty is not a guarantee; it is an absence of absences. */
  readonly unknownLinks: readonly number[];
  /** Indices of `recorded` links with no `binding` block — a record, but not in the queried capability. */
  readonly offCapabilityLinks: readonly number[];
}

/**
 * Read a whole stack. Returns the per-link reads and where the gaps are.
 *
 * Deliberately absent: any aggregate. A product of per-link trust bands would assert
 * independence between links nobody measured, and would read as more confident the longer
 * the chain is examined — the look-elsewhere effect wearing a score.
 */
export function readCompositionChain(
  outcomes: readonly OutcomeRecord[],
  edges: readonly TreatmentEdge[],
  chain: readonly CompositionQuery[],
  rule: AttributionRule = STANCE_BEARING,
): Admission<ChainRead> {
  const links: DependencyRead[] = [];
  const unknownLinks: number[] = [];
  const offCapabilityLinks: number[] = [];
  for (let i = 0; i < chain.length; i += 1) {
    const q = chain[i];
    if (q === undefined) continue;
    const r = readDependency(outcomes, edges, q, rule);
    if (!r.ok) return { ok: false, reason: `link ${String(i)}: ${r.reason}` };
    links.push(r.value);
    if (r.value.kind === "unknown") unknownLinks.push(i);
    else if (r.value.binding === undefined) offCapabilityLinks.push(i);
  }
  return { ok: true, value: { links, unknownLinks, offCapabilityLinks } };
}
