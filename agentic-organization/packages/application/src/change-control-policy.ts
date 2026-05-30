/**
 * ChangeControlPolicy (CC4) — the review pipelines as DATA (tenant configuration,
 * per the Adaptive Platform's everything-as-config). The SAME kernel runs any
 * pipeline; selecting which one a ChangeSet runs is a config lookup, not code.
 *
 * Two reference pipelines ship by default:
 *   internal-only — code review → QA → security quorum. NO external, NO human.
 *                   A fully self-contained org ships with zero projections.
 *   github-gated  — the above PLUS an external-code-review stage (projects a GitHub
 *                   PR; satisfied by an external human) and a human QA sign-off.
 *
 * The PR-using org differs from the internal-only org by exactly two appended
 * stages — that is the whole "PRs are an optional port" claim, in data.
 */

import { ExternalSystem, ReviewGateKind, stageRequiresHuman, type AutonomyPolicy, type ReviewPipeline, type ReviewStage } from "../../domain/src/index.ts";

export const ReviewPipelineId = {
  InternalOnly: "internal-only",
  GitHubGated: "github-gated",
} as const;
export type ReviewPipelineId = (typeof ReviewPipelineId)[keyof typeof ReviewPipelineId];

export type ChangeControlPolicy = {
  organizationId: string;
  /** which pipeline a given work-item type runs through (default falls back to InternalOnly) */
  pipelineByWorkType: Record<string, ReviewPipelineId>;
  pipelines: Record<string, ReviewPipeline>;
};

function internalStages(): readonly ReviewStage[] {
  return [
    { id: "internal-code-review", ownerLabel: "code_reviewer", authority: { kind: "hat", hatId: "code_reviewer" }, gate: ReviewGateKind.NoBlockingFindings, blocking: true },
    { id: "internal-qa", ownerLabel: "qa_reviewer", authority: { kind: "hat", hatId: "qa_reviewer" }, gate: ReviewGateKind.TestsGreen, blocking: true },
    { id: "security", ownerLabel: "security_review", authority: { kind: "quorum", hatIds: ["security_a", "security_b", "security_c"], threshold: 3 }, gate: ReviewGateKind.QuorumAgreed, blocking: true },
  ];
}

export function buildInternalOnlyPipeline(organizationId: string): ReviewPipeline {
  return { pipelineId: ReviewPipelineId.InternalOnly, organizationId, stages: internalStages() };
}

export function buildGitHubGatedPipeline(organizationId: string): ReviewPipeline {
  return {
    pipelineId: ReviewPipelineId.GitHubGated,
    organizationId,
    stages: [
      ...internalStages(),
      { id: "external-code-review", ownerLabel: "external:github", authority: { kind: "external", system: ExternalSystem.GitHub }, gate: ReviewGateKind.ExternalApproved, blocking: true, projectTo: ExternalSystem.GitHub },
      { id: "human-qa-signoff", ownerLabel: "human:qa_lead", authority: { kind: "human", role: "qa_lead" }, gate: ReviewGateKind.NoBlockingFindings, blocking: true },
    ],
  };
}

/**
 * C1 — apply a tenant's AutonomyPolicy to a pipeline so WHICH stages require a human is config,
 * not hardcoded. A stage the policy gates → human authority; a human stage the policy does NOT
 * gate → downgraded to the agent (a hat) that would otherwise do it. The same base pipeline thus
 * runs fully-autonomous for one tenant and human-gated for another, by data alone.
 */
export function applyAutonomyPolicy(pipeline: ReviewPipeline, policy: AutonomyPolicy): ReviewPipeline {
  return {
    ...pipeline,
    stages: pipeline.stages.map((stage): ReviewStage => {
      // The autonomy dial flips ONLY the agent↔human axis (hat ↔ human), which is a lossless,
      // gate-preserving round-trip. A `quorum` stage (its own threshold gate) and an `external`
      // stage (an external system gate) carry semantics the dial must NOT strip — Manual layers
      // human review on top of those via a separate stage, it does not replace their authority.
      if (stage.authority.kind === "quorum" || stage.authority.kind === "external") return stage;
      const needsHuman = stageRequiresHuman(policy, stage.id);
      if (needsHuman && stage.authority.kind === "hat") {
        return { ...stage, authority: { kind: "human", role: stage.authority.hatId } };
      }
      if (!needsHuman && stage.authority.kind === "human") {
        return { ...stage, authority: { kind: "hat", hatId: stage.authority.role } };
      }
      return stage;
    }),
  };
}

export function buildDefaultChangeControlPolicy(organizationId: string): ChangeControlPolicy {
  const internal = buildInternalOnlyPipeline(organizationId);
  const github = buildGitHubGatedPipeline(organizationId);
  return {
    organizationId,
    pipelineByWorkType: {}, // default → InternalOnly
    pipelines: { [internal.pipelineId]: internal, [github.pipelineId]: github },
  };
}

export function pipelineForWorkType(policy: ChangeControlPolicy, workItemType: string): ReviewPipeline {
  const id = policy.pipelineByWorkType[workItemType] ?? ReviewPipelineId.InternalOnly;
  const pipeline = policy.pipelines[id];
  if (pipeline === undefined) throw new Error(`change-control policy has no pipeline '${id}'`);
  return pipeline;
}
