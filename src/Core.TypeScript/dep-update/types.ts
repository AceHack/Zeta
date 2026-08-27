// TOY MODEL — dependency-update transitions as a typed, total decision.
//
// `toy` per `.claude/rules/toy-is-free-metered-must-be-earned.md`: there is no
// measured adherence data anywhere in this repo yet, so every number this module
// produces is a number about a fixture. It sheds `toy` when a real registry
// history has been folded into a real ledger and the estimator has a falsifier
// against observed reality — not before.
//
// TWO NEUTRAL SIGNALS, held apart BY THE TYPES:
//
//   1. semver adherence  — did this publisher's PAST CLAIMS hold?   (the registry)
//   2. provenance        — is this artifact WHAT IT SAYS IT IS?     (sigstore /
//                          in-toto / npm provenance / reproducible builds)
//
// They are two separate lists on the transition and there is deliberately no
// arithmetic between them. See `toy-classify.ts` for why that is the design and
// not an omission.
//
// Every fact row names a FACT, never an intent
// (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`). There is no
// `Compromised`, no `Malicious`, no `Attacker` in this file, and adding one would
// be attaching a verdict the measurement cannot support.

/// The kind of change the publisher CLAIMS this is. A semver range is a claim,
/// not a guarantee: `^1.2.3` is the publisher asserting minors will not break you.
export type ClaimedBump = "patch" | "minor" | "major";

/// A human-declared hold on a specific dependency — the `ignore:` entries in
/// `.github/dependabot.yml`. Orthogonal to both signals: it is a statement about
/// a coupling in THIS repo, never a statement about the publisher.
export type DeclaredPin = {
  readonly reason: string;
  /// Which bump kinds the declaration holds back.
  readonly heldBumps: readonly ClaimedBump[];
};

export type UpdateProposal = {
  readonly publisher: string;
  readonly ecosystem: string;
  readonly packageName: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly claimedBump: ClaimedBump;
  readonly declaredPin?: DeclaredPin;
};

// ── Signal 1: semver adherence ────────────────────────────────────────────────

/// The Gaussian posterior over one (publisher × ecosystem) pair's adherence.
/// Same shape as `SkillBelief` in `src/Core/TravelerRankLedger.fs` — see
/// `toy-adherence.ts` for exactly how far that generalisation actually goes.
export type ToyAdherenceBelief = {
  readonly mu: number;
  readonly sigma2: number;
  readonly obsCount: number;
};

export type AdherenceRecord = {
  readonly publisher: string;
  readonly ecosystem: string;
  /// The posterior AS OF the last recorded observation.
  readonly belief: ToyAdherenceBelief;
  /// Declared distance since that observation, in release-interval units.
  /// This is how "time" reaches the decision function: as a number the caller
  /// supplies, never as a clock the function reads. `classify` ages the belief
  /// by this gap before scoring it, which is TrueSkill's dynamics factor between
  /// time slices. Absent means "current".
  readonly gapSinceLastObservation?: number;
};

/// Facts about the semver CLAIM. Neutral rows only.
export type AdherenceFact =
  /// No record was supplied for this (publisher, ecosystem). Not a judgement —
  /// an absence.
  | { readonly t: "NoAdherenceRecord" }
  /// A record exists but for a different pair than the proposal names.
  | {
      readonly t: "AdherenceRecordMismatched";
      readonly recordKey: string;
      readonly proposalKey: string;
    }
  /// Fewer observations than the policy requires to distinguish this publisher
  /// from the honest prior. A fresh name sits here — which is the whitewash
  /// window staying closed, not an accusation.
  | { readonly t: "NewPublisher"; readonly observations: number; readonly required: number }
  /// The posterior mean is below the policy floor: past minor/patch claims have
  /// measurably not held.
  | { readonly t: "AdherenceBelowFloor"; readonly score: number; readonly floor: number }
  /// The record has not been refreshed in a long time. Named as the fact it is —
  /// an observation gap — rather than as a property of the publisher. This is the
  /// row that makes the dynamics factor visible at the surface.
  | { readonly t: "AdherenceStale"; readonly gap: number; readonly ceiling: number }
  /// The publisher has DECLARED breakage. A major bump makes no compatibility
  /// claim, so adherence does not underwrite it.
  | { readonly t: "SemverMajorDeclared" };

// ── Signal 2: provenance / continuity ─────────────────────────────────────────

/// Facts about whether the artifact is what it says it is. Neutral rows only:
/// every one of these has a mundane explanation (a handoff, a CI migration,
/// somebody changing jobs) far more often than any other kind.
export type ProvenanceFact =
  | { readonly t: "ProvenanceMissing" }
  /// The signing identity attested by the registry changed between releases.
  | { readonly t: "ProvenanceIdentityChanged"; readonly from: string; readonly to: string }
  /// The publishing account or maintainer set changed.
  | { readonly t: "MaintainerChanged"; readonly from: string; readonly to: string }
  /// A rebuild from the declared source did not reproduce the published bytes.
  | { readonly t: "BuildNotReproducible" }
  /// Release cadence departed sharply from its own history.
  | {
      readonly t: "SuddenReleaseCadenceShift";
      readonly priorMedianIntervalDays: number;
      readonly observedIntervalDays: number;
    };

export type ProvenanceFacts = readonly ProvenanceFact[];

// ── The transitions ───────────────────────────────────────────────────────────

/// What the pipeline does with a proposal.
///
/// NOTE WHAT IS ABSENT: there is no `Blocked`, no `Rejected`, no `Untrusted`,
/// and no row carrying a publisher forward as flagged. Escalation is a property
/// of THIS proposal's facts, never a mark on a publisher, so it clears the
/// moment the facts clear.
/// Aaron: *"we never assume betrayal unless it's self declared by the betrayer
/// and even then the game continues we don't end playing."*
export type Transition =
  /// Flows on the ordinary path.
  | {
      readonly t: "AutoEligible";
      readonly adherenceFacts: readonly AdherenceFact[];
      readonly provenanceFacts: ProvenanceFacts;
    }
  /// Flows, with more checking than the ordinary path — a wider matrix, a longer
  /// soak. Still automatic.
  | {
      readonly t: "ScrutinyRaised";
      readonly adherenceFacts: readonly AdherenceFact[];
      readonly provenanceFacts: ProvenanceFacts;
    }
  /// Does not flow automatically; someone looks. Carries the facts that produced
  /// it so the look starts from evidence rather than from a score.
  | {
      readonly t: "HeldForAttention";
      readonly adherenceFacts: readonly AdherenceFact[];
      readonly provenanceFacts: ProvenanceFacts;
    }
  /// A human already declared this coupling held. Short-circuits both signals:
  /// this is a fact about our tree, not about the publisher.
  | { readonly t: "HeldByDeclaredPin"; readonly reason: string };

/// Severity order on the three publisher-facing rows. `HeldByDeclaredPin` is not
/// on this order — it is orthogonal and short-circuits.
export const TRANSITION_RANK = {
  AutoEligible: 0,
  ScrutinyRaised: 1,
  HeldForAttention: 2,
} as const;

export type RankedTransitionTag = keyof typeof TRANSITION_RANK;

export type ToyPolicy = {
  /// Adherence score at or above which minor/patch flows automatically.
  readonly autoEligibleFloor: number;
  /// Below this, the claim record is treated as measurably broken.
  readonly scrutinyFloor: number;
  /// Observations required before the score is read at all.
  readonly minObservations: number;
  /// Observation gap above which the record is reported as stale.
  readonly stalenessCeiling: number;
};

/// Declared, not ambient. Callers may pass their own — this is an oracle they
/// chose, per manifesto §11.
export const defaultToyPolicy: ToyPolicy = {
  autoEligibleFloor: 0.6,
  scrutinyFloor: 0.4,
  minObservations: 5,
  stalenessCeiling: 10,
};
