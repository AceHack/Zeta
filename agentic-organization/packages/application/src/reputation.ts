import { OrgEventKind, type OrgEvent, type OrgEventTransitionContext } from "../../domain/src/org-event.ts";
import type { RmoHatCandidateReputation } from "./rmo.ts";

export const ReputationOutcomeClass = {
  Quality: "quality",
  Latency: "latency",
  Cost: "cost",
  ReviewReversal: "review_reversal",
  IncidentContribution: "incident_contribution",
  ContextRetention: "context_retention",
  Collaboration: "collaboration",
  ScheduleReliability: "schedule_reliability",
} as const;

export type ReputationOutcomeClass = (typeof ReputationOutcomeClass)[keyof typeof ReputationOutcomeClass];

export const ReputationRiskTier = {
  Normal: "normal",
  High: "high",
  Critical: "critical",
} as const;

export type ReputationRiskTier = (typeof ReputationRiskTier)[keyof typeof ReputationRiskTier];

export type ReputationSignal =
  | {
      kind: "binary";
      success: boolean;
      weight?: number | undefined;
    }
  | {
      kind: "continuous";
      value: number;
      unit: string;
      lowerIsBetter: boolean;
      weight?: number | undefined;
    };

export type ReputationObservation = {
  organizationId: string;
  agentId: string;
  hatId: string;
  workType: string;
  outcomeClass: ReputationOutcomeClass;
  observedAt: string;
  signal: ReputationSignal;
  evidenceRef: string;
};

export type ReputationKey = {
  organizationId: string;
  agentId: string;
  hatId: string;
  workType: string;
  outcomeClass: ReputationOutcomeClass;
};

export type BetaBernoulliReputationSummary = {
  kind: "beta_bernoulli";
  sampleCount: number;
  alpha: number;
  beta: number;
  mean: number;
  lowerConfidenceBound: number;
  uncertainty: number;
  latestObservedAt?: string | undefined;
  evidenceRefs: readonly string[];
};

export type NormalGammaReputationSummary = {
  kind: "normal_gamma";
  sampleCount: number;
  mean: number;
  variance: number;
  posteriorMu: number;
  posteriorKappa: number;
  posteriorAlpha: number;
  posteriorBeta: number;
  posteriorPredictiveVariance: number;
  lowerConfidenceBound: number;
  upperConfidenceBound: number;
  uncertainty: number;
  lowerIsBetter: boolean;
  unit?: string | undefined;
  latestObservedAt?: string | undefined;
  evidenceRefs: readonly string[];
};

export type ReputationPosteriorSummary = BetaBernoulliReputationSummary | NormalGammaReputationSummary;

export type ReputationReadModel = {
  summaryFor: (key: ReputationKey) => ReputationPosteriorSummary;
  observationsFor: (key: ReputationKey) => readonly ReputationObservation[];
};

export type ReputationDecayPolicy = {
  asOf: string;
  halfLifeDays?: number | undefined;
  severeIncidentMinimumWeight?: number | undefined;
};

export type ProjectReputationReadModelInput = {
  observations: readonly ReputationObservation[];
  decay?: ReputationDecayPolicy | undefined;
};

export type ProjectReputationReadModelFromOrgEventsInput = {
  events: readonly OrgEvent[];
};

export type MaterializeRmoCandidateInput = {
  readModel: ReputationReadModel;
  organizationId: string;
  agentId: string;
  hatId: string;
  workType: string;
  currentLoad: number;
  consecutiveAssignmentCount: number;
  recentSameHatAssignments: number;
};

export type ReputationBackedRmoCandidate = RmoHatCandidateReputation & {
  posterior: {
    quality: ReputationPosteriorSummary;
    latency: ReputationPosteriorSummary;
    cost: ReputationPosteriorSummary;
    reviewReversal: ReputationPosteriorSummary;
    incidentContribution: ReputationPosteriorSummary;
    collaboration: ReputationPosteriorSummary;
    contextRetention: ReputationPosteriorSummary;
    scheduleReliability: ReputationPosteriorSummary;
    evidenceRefs: readonly string[];
  };
};

export type SelectRmoCandidateWithExplorationInput = {
  rankedCandidates: readonly import("./rmo.ts").RankedRmoHatCandidate[];
  riskTier: ReputationRiskTier;
  explorationSeed: string;
  explorationRate?: number | undefined;
  minimumLowerConfidenceBound?: number | undefined;
};

export type RmoExplorationSelection =
  | {
      outcome: "selected";
      selected: import("./rmo.ts").RankedRmoHatCandidate;
      reason: string;
    }
  | {
      outcome: "no_legal_candidate";
      reason: string;
    };

type ReputationBucket =
  | {
      kind: "binary";
      successes: number;
      failures: number;
      sampleCount: number;
      latestObservedAt?: string | undefined;
      evidenceRefs: string[];
    }
  | {
      kind: "continuous";
      values: WeightedContinuousObservation[];
      lowerIsBetter: boolean;
      unit?: string | undefined;
      latestObservedAt?: string | undefined;
      evidenceRefs: string[];
    };

type WeightedContinuousObservation = {
  value: number;
  weight: number;
};

const BinaryOutcomeClasses = new Set<ReputationOutcomeClass>([
  ReputationOutcomeClass.Quality,
  ReputationOutcomeClass.ReviewReversal,
  ReputationOutcomeClass.IncidentContribution,
  ReputationOutcomeClass.ContextRetention,
  ReputationOutcomeClass.Collaboration,
  ReputationOutcomeClass.ScheduleReliability,
]);

export function projectReputationReadModel(input: ProjectReputationReadModelInput): ReputationReadModel {
  const buckets = new Map<string, ReputationBucket>();
  const observationsByKey = new Map<string, ReputationObservation[]>();

  for (const observation of input.observations) {
    const key = keyOf(observation);
    const observations = observationsByKey.get(key) ?? [];
    observations.push(observation);
    observationsByKey.set(key, observations);

    const weight = effectiveObservationWeight(observation, input.decay);
    const existing = buckets.get(key);
    const latestObservedAt = laterIso(existing?.latestObservedAt, observation.observedAt);
    if (observation.signal.kind === "binary") {
      const bucket = existing?.kind === "binary"
        ? existing
        : { kind: "binary" as const, successes: 0, failures: 0, sampleCount: 0, evidenceRefs: [] };
      const success = normalizeBinarySuccess(observation);
      if (success) bucket.successes += weight;
      else bucket.failures += weight;
      bucket.sampleCount += weight;
      bucket.latestObservedAt = latestObservedAt;
      bucket.evidenceRefs.push(observation.evidenceRef);
      buckets.set(key, bucket);
      continue;
    }

    const bucket = existing?.kind === "continuous"
      ? existing
      : {
          kind: "continuous" as const,
          values: [],
          lowerIsBetter: observation.signal.lowerIsBetter,
          unit: observation.signal.unit,
          evidenceRefs: [],
        };
    if (weight > 0) bucket.values.push({ value: observation.signal.value, weight });
    bucket.lowerIsBetter = observation.signal.lowerIsBetter;
    bucket.unit = observation.signal.unit;
    bucket.latestObservedAt = latestObservedAt;
    bucket.evidenceRefs.push(observation.evidenceRef);
    buckets.set(key, bucket);
  }

  return {
    summaryFor: (key) => summarizeBucket(key.outcomeClass, buckets.get(keyOf(key))),
    observationsFor: (key) => observationsByKey.get(keyOf(key)) ?? [],
  };
}

export function projectReputationReadModelFromOrgEvents(input: ProjectReputationReadModelFromOrgEventsInput): ReputationReadModel {
  return projectReputationReadModel({
    observations: input.events.flatMap((event) => {
      const observation = reputationObservationFromOrgEvent(event);
      return observation === undefined ? [] : [observation];
    }),
  });
}

export function materializeRmoCandidateReputation(input: MaterializeRmoCandidateInput): ReputationBackedRmoCandidate {
  const quality = input.readModel.summaryFor(key(input, ReputationOutcomeClass.Quality));
  const latency = input.readModel.summaryFor(key(input, ReputationOutcomeClass.Latency));
  const cost = input.readModel.summaryFor(key(input, ReputationOutcomeClass.Cost));
  const reviewReversal = input.readModel.summaryFor(key(input, ReputationOutcomeClass.ReviewReversal));
  const incidentContribution = input.readModel.summaryFor(key(input, ReputationOutcomeClass.IncidentContribution));
  const collaboration = input.readModel.summaryFor(key(input, ReputationOutcomeClass.Collaboration));
  const contextRetention = input.readModel.summaryFor(key(input, ReputationOutcomeClass.ContextRetention));
  const scheduleReliability = input.readModel.summaryFor(key(input, ReputationOutcomeClass.ScheduleReliability));
  const evidenceRefs = uniqueSorted([
    ...quality.evidenceRefs,
    ...latency.evidenceRefs,
    ...cost.evidenceRefs,
    ...reviewReversal.evidenceRefs,
    ...incidentContribution.evidenceRefs,
    ...collaboration.evidenceRefs,
    ...contextRetention.evidenceRefs,
    ...scheduleReliability.evidenceRefs,
  ]);

  const qualityScore = summaryScore(quality);
  const latencyScore = continuousLowerIsBetterScore(latency, 60);
  const costScore = continuousLowerIsBetterScore(cost, 10);
  const reviewReversalScore = summaryScore(reviewReversal);
  const incidentContributionScore = summaryScore(incidentContribution);
  const safetyAdjustedQuality = clamp01((qualityScore * 3 + reviewReversalScore + incidentContributionScore) / 5);
  const collaborationScore = summaryScore(collaboration);
  const contextScore = summaryScore(contextRetention);
  const scheduleScore = Math.max(summaryScore(scheduleReliability), latencyScore);
  const evidenceCount = evidenceRefs.length;
  const reviewReversalUncertainty = reviewReversal.evidenceRefs.length === 0 ? 0 : reviewReversal.uncertainty;
  const incidentContributionUncertainty = incidentContribution.evidenceRefs.length === 0 ? 0 : incidentContribution.uncertainty;
  const uncertainty = Math.max(
    quality.uncertainty,
    reviewReversalUncertainty * 0.75,
    incidentContributionUncertainty,
    collaboration.uncertainty * 0.75,
    contextRetention.uncertainty * 0.5,
  );

  return {
    agentId: input.agentId,
    hatId: input.hatId,
    agentHatReputation: safetyAdjustedQuality,
    recentOutcomeScore: clamp01((safetyAdjustedQuality * 2 + collaborationScore + contextScore + costScore) / 5),
    scheduleReliability: scheduleScore,
    reviewQuality: clamp01((qualityScore + reviewReversalScore) / 2),
    qaPassRate: qualityScore,
    completionRate: qualityScore,
    contextFit: contextScore,
    currentLoad: input.currentLoad,
    freshness: freshnessScore([quality, latency, cost, collaboration, contextRetention, scheduleReliability]),
    explorationBonus: boundedExplorationBonus(uncertainty, evidenceCount),
    consecutiveAssignmentCount: input.consecutiveAssignmentCount,
    recentSameHatAssignments: input.recentSameHatAssignments,
    posterior: {
      quality,
      latency,
      cost,
      reviewReversal,
      incidentContribution,
      collaboration,
      contextRetention,
      scheduleReliability,
      evidenceRefs,
    },
  };
}

export function selectRmoCandidateWithExploration(input: SelectRmoCandidateWithExplorationInput): RmoExplorationSelection {
  if (input.rankedCandidates.length === 0) {
    return { outcome: "no_legal_candidate", reason: "no ranked candidates" };
  }

  if (input.riskTier === ReputationRiskTier.High || input.riskTier === ReputationRiskTier.Critical) {
    const threshold = input.minimumLowerConfidenceBound ?? (input.riskTier === ReputationRiskTier.Critical ? 0.7 : 0.55);
    const eligible = input.rankedCandidates.filter((candidate) => qualityLowerConfidenceBound(candidate) >= threshold);
    if (eligible.length === 0) {
      return {
        outcome: "no_legal_candidate",
        reason: `no candidate cleared reputation lower-confidence threshold ${threshold}`,
      };
    }
    return {
      outcome: "selected",
      selected: eligible[0]!,
      reason: `selected highest-ranked candidate above lower-confidence threshold ${threshold}`,
    };
  }

  const explorationRate = clamp01(input.explorationRate ?? 0.2);
  if (stableUnitInterval(input.explorationSeed) >= explorationRate) {
    return {
      outcome: "selected",
      selected: input.rankedCandidates[0]!,
      reason: `selected exploitation candidate; exploration draw outside rate ${explorationRate}`,
    };
  }

  const explorationCandidates = input.rankedCandidates.filter((candidate) =>
    candidate.reasonCodes.includes("exploration_candidate") && qualityLowerConfidenceBound(candidate) >= 0.2);
  if (explorationCandidates.length === 0) {
    return {
      outcome: "selected",
      selected: input.rankedCandidates[0]!,
      reason: "selected highest-ranked candidate; no bounded exploration candidates",
    };
  }
  const explorationPool = highestUncertaintyPool(explorationCandidates);
  const selected = explorationPool[stableIndex(input.explorationSeed, explorationPool.length)]!;
  return {
    outcome: "selected",
    selected,
    reason: `selected bounded exploration candidate using seed ${input.explorationSeed}`,
  };
}

export function createReputationOutcomeOrgEvent(input: {
  eventId: string;
  observedAt: string;
  organizationId: string;
  observation: ReputationObservation;
  correlationId: string;
  causationId: string;
  traceId: string;
}): OrgEvent {
  const observation = input.observation;
  return {
    id: input.eventId,
    kind: OrgEventKind.ReputationOutcomeObserved,
    occurredAt: input.observedAt,
    organizationId: input.organizationId,
    actorHatId: observation.hatId,
    actorAgentId: observation.agentId,
    subjectId: `${observation.agentId}:${observation.hatId}:${observation.workType}:${observation.outcomeClass}`,
    transitionContext: {
      kind: "reputation_observation",
      agentId: observation.agentId,
      hatId: observation.hatId,
      workType: observation.workType,
      outcomeClass: observation.outcomeClass,
      observedAt: observation.observedAt,
      signal: observation.signal,
      evidenceRef: observation.evidenceRef,
    },
    decision: `reputation outcome observed for ${observation.agentId}/${observation.hatId}/${observation.workType}/${observation.outcomeClass}`,
    supervisorChain: ["rmo_office", observation.hatId],
    evidenceRefs: [reputationEvidenceRef(observation), observation.evidenceRef],
    correlationId: input.correlationId,
    causationId: input.causationId,
    traceId: input.traceId,
  };
}

export function reputationObservationFromOrgEvent(event: OrgEvent): ReputationObservation | undefined {
  if (event.kind !== OrgEventKind.ReputationOutcomeObserved) return undefined;
  const context = event.transitionContext;
  if (!isReputationObservationContext(context)) return undefined;
  if (!isReputationOutcomeClass(context.outcomeClass)) return undefined;
  if (!isReputationSignal(context.signal)) return undefined;
  return {
    organizationId: event.organizationId,
    agentId: context.agentId,
    hatId: context.hatId,
    workType: context.workType,
    outcomeClass: context.outcomeClass,
    observedAt: context.observedAt,
    signal: context.signal,
    evidenceRef: context.evidenceRef,
  };
}

function summarizeBucket(outcomeClass: ReputationOutcomeClass, bucket: ReputationBucket | undefined): ReputationPosteriorSummary {
  if (bucket === undefined) {
    if (BinaryOutcomeClasses.has(outcomeClass)) return betaSummary(1, 1, 0, undefined, []);
    return normalSummary([], true, undefined, undefined, []);
  }
  if (bucket.kind === "binary") {
    return betaSummary(1 + bucket.successes, 1 + bucket.failures, bucket.sampleCount, bucket.latestObservedAt, bucket.evidenceRefs);
  }
  return normalSummary(bucket.values, bucket.lowerIsBetter, bucket.unit, bucket.latestObservedAt, bucket.evidenceRefs);
}

function betaSummary(
  alpha: number,
  beta: number,
  sampleCount: number,
  latestObservedAt: string | undefined,
  evidenceRefs: readonly string[],
): BetaBernoulliReputationSummary {
  const total = alpha + beta;
  const mean = alpha / total;
  const variance = (alpha * beta) / (total * total * (total + 1));
  return {
    kind: "beta_bernoulli",
    sampleCount,
    alpha: rounded(alpha),
    beta: rounded(beta),
    mean: rounded(mean),
    lowerConfidenceBound: rounded(clamp01(mean - Math.sqrt(variance))),
    uncertainty: rounded(1 / Math.sqrt(total)),
    latestObservedAt,
    evidenceRefs: uniqueSorted(evidenceRefs),
  };
}

function normalSummary(
  values: readonly WeightedContinuousObservation[],
  lowerIsBetter: boolean,
  unit: string | undefined,
  latestObservedAt: string | undefined,
  evidenceRefs: readonly string[],
): NormalGammaReputationSummary {
  const sampleWeight = values.reduce((acc, value) => acc + value.weight, 0);
  if (values.length === 0 || sampleWeight <= 0) {
    return {
      kind: "normal_gamma",
      sampleCount: 0,
      mean: 0,
      variance: 0,
      posteriorMu: 0,
      posteriorKappa: 1,
      posteriorAlpha: 1,
      posteriorBeta: 1,
      posteriorPredictiveVariance: 2,
      lowerConfidenceBound: 0,
      upperConfidenceBound: 0,
      uncertainty: 1,
      lowerIsBetter,
      unit,
      latestObservedAt,
      evidenceRefs: uniqueSorted(evidenceRefs),
    };
  }
  const mean = values.reduce((acc, value) => acc + value.value * value.weight, 0) / sampleWeight;
  const variance = values.reduce((acc, value) => acc + value.weight * (value.value - mean) ** 2, 0) / Math.max(1, sampleWeight - 1);
  const priorMu = mean;
  const priorKappa = 1;
  const priorAlpha = 1;
  const priorBeta = 1;
  const posteriorKappa = priorKappa + sampleWeight;
  const posteriorMu = (priorKappa * priorMu + sampleWeight * mean) / posteriorKappa;
  const sumSquaredDeviation = values.reduce((acc, value) => acc + value.weight * (value.value - mean) ** 2, 0);
  const posteriorAlpha = priorAlpha + sampleWeight / 2;
  const posteriorBeta =
    priorBeta +
    0.5 * sumSquaredDeviation +
    (priorKappa * sampleWeight * (mean - priorMu) ** 2) / (2 * posteriorKappa);
  const posteriorPredictiveVariance = posteriorBeta * (posteriorKappa + 1) / (posteriorAlpha * posteriorKappa);
  const predictiveStdDev = Math.sqrt(posteriorPredictiveVariance);
  return {
    kind: "normal_gamma",
    sampleCount: rounded(sampleWeight),
    mean: rounded(mean),
    variance: rounded(variance),
    posteriorMu: rounded(posteriorMu),
    posteriorKappa: rounded(posteriorKappa),
    posteriorAlpha: rounded(posteriorAlpha),
    posteriorBeta: rounded(posteriorBeta),
    posteriorPredictiveVariance: rounded(posteriorPredictiveVariance),
    lowerConfidenceBound: rounded(mean - predictiveStdDev),
    upperConfidenceBound: rounded(mean + predictiveStdDev),
    uncertainty: rounded(1 / Math.sqrt(posteriorKappa)),
    lowerIsBetter,
    unit,
    latestObservedAt,
    evidenceRefs: uniqueSorted(evidenceRefs),
  };
}

function normalizeBinarySuccess(observation: ReputationObservation): boolean {
  if (observation.signal.kind !== "binary") return false;
  if (
    observation.outcomeClass === ReputationOutcomeClass.ReviewReversal ||
    observation.outcomeClass === ReputationOutcomeClass.IncidentContribution
  ) {
    return !observation.signal.success;
  }
  return observation.signal.success;
}

function effectiveObservationWeight(
  observation: ReputationObservation,
  decay: ReputationDecayPolicy | undefined,
): number {
  const baseWeight = Math.max(0, observation.signal.weight ?? 1);
  if (decay === undefined || baseWeight === 0) return baseWeight;
  const decayed = baseWeight * decayMultiplier(observation.observedAt, decay);
  if (isSevereIncidentContribution(observation)) {
    return Math.max(decayed, decay.severeIncidentMinimumWeight ?? 0);
  }
  return decayed;
}

function decayMultiplier(observedAt: string, decay: ReputationDecayPolicy): number {
  const halfLifeDays = decay.halfLifeDays ?? 90;
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) return 1;
  const ageMs = Date.parse(decay.asOf) - Date.parse(observedAt);
  if (!Number.isFinite(ageMs) || ageMs <= 0) return 1;
  const ageDays = ageMs / 86_400_000;
  return 0.5 ** (ageDays / halfLifeDays);
}

function isSevereIncidentContribution(observation: ReputationObservation): boolean {
  return (
    observation.outcomeClass === ReputationOutcomeClass.IncidentContribution &&
    observation.signal.kind === "binary" &&
    observation.signal.success === true
  );
}

function summaryScore(summary: ReputationPosteriorSummary): number {
  if (summary.kind === "beta_bernoulli") return summary.mean;
  if (summary.sampleCount === 0) return 0.5;
  return continuousLowerIsBetterScore(summary, 60);
}

function continuousLowerIsBetterScore(summary: ReputationPosteriorSummary, scale: number): number {
  if (summary.kind !== "normal_gamma") return summaryScore(summary);
  if (summary.sampleCount === 0) return 0.5;
  const score = summary.lowerIsBetter ? 1 / (1 + Math.max(0, summary.mean) / scale) : summary.mean / (summary.mean + scale);
  return clamp01(score);
}

function freshnessScore(summaries: readonly ReputationPosteriorSummary[]): number {
  const observed = summaries.filter((summary) => summary.latestObservedAt !== undefined);
  if (observed.length === 0) return 0.5;
  return Math.min(1, 0.5 + observed.length / summaries.length / 2);
}

function boundedExplorationBonus(uncertainty: number, evidenceCount: number): number {
  const coldStartBoost = evidenceCount <= 2 ? 0.25 : 0;
  return rounded(clamp01(uncertainty + coldStartBoost));
}

function qualityLowerConfidenceBound(candidate: import("./rmo.ts").RankedRmoHatCandidate): number {
  return candidate.posterior?.quality.lowerConfidenceBound ?? candidate.components.agentHatReputation / 4;
}

function highestUncertaintyPool(
  candidates: readonly import("./rmo.ts").RankedRmoHatCandidate[],
): readonly import("./rmo.ts").RankedRmoHatCandidate[] {
  const maxUncertainty = Math.max(...candidates.map((candidate) => candidate.posterior?.quality.uncertainty ?? 0));
  return candidates.filter((candidate) => (candidate.posterior?.quality.uncertainty ?? 0) === maxUncertainty);
}

function key(input: Omit<ReputationKey, "outcomeClass">, outcomeClass: ReputationOutcomeClass): ReputationKey {
  return {
    organizationId: input.organizationId,
    agentId: input.agentId,
    hatId: input.hatId,
    workType: input.workType,
    outcomeClass,
  };
}

function keyOf(input: ReputationKey): string {
  return `${input.organizationId}\0${input.agentId}\0${input.hatId}\0${input.workType}\0${input.outcomeClass}`;
}

function laterIso(left: string | undefined, right: string): string {
  if (left === undefined) return right;
  return Date.parse(right) >= Date.parse(left) ? right : left;
}

function reputationEvidenceRef(observation: ReputationObservation): string {
  if (observation.signal.kind === "binary") {
    return `reputation:${observation.outcomeClass}:${normalizeBinarySuccess(observation) ? "success" : "failure"}`;
  }
  return `reputation:${observation.outcomeClass}:continuous:${observation.signal.unit}`;
}

function isReputationObservationContext(context: OrgEventTransitionContext | undefined): context is Extract<OrgEventTransitionContext, { kind: "reputation_observation" }> {
  return context?.kind === "reputation_observation";
}

function isReputationOutcomeClass(value: string): value is ReputationOutcomeClass {
  return (Object.values(ReputationOutcomeClass) as readonly string[]).includes(value);
}

function isReputationSignal(value: unknown): value is ReputationSignal {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ReputationSignal>;
  if (candidate.kind === "binary") {
    return typeof candidate.success === "boolean" && optionalFiniteWeight(candidate.weight);
  }
  if (candidate.kind === "continuous") {
    return (
      typeof candidate.value === "number" &&
      Number.isFinite(candidate.value) &&
      typeof candidate.unit === "string" &&
      candidate.unit.length > 0 &&
      typeof candidate.lowerIsBetter === "boolean" &&
      optionalFiniteWeight(candidate.weight)
    );
  }
  return false;
}

function optionalFiniteWeight(value: number | undefined): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function stableIndex(seed: string, length: number): number {
  return stableHash(seed) % length;
}

function stableUnitInterval(seed: string): number {
  return stableHash(seed) / 0xffffffff;
}

function stableHash(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}
