import { createHash } from "node:crypto";
import { patchPaths, type GatedCommitRejection } from "./proposal-gated-commit";

export const AGENT_PROPOSAL_REPOSITORY = "Lucent-Financial-Group/Zeta" as const;
export const AGENT_PROPOSAL_BASE_REF = "main" as const;

export interface AgentProposalIntent {
  readonly schema: "zeta.agent-proposal.v1";
  readonly proposalId: string;
  readonly repository: typeof AGENT_PROPOSAL_REPOSITORY;
  readonly baseRef: typeof AGENT_PROPOSAL_BASE_REF;
  readonly baseSha: string;
  readonly workflowRef: string;
  readonly patchDigest: string;
}

export interface AgentProposalPlan {
  readonly ok: true;
  readonly branch: string;
  readonly commitMessage: string;
  readonly paths: readonly string[];
}

export type AgentProposalRejection = GatedCommitRejection | {
  readonly ok: false;
  readonly code: "agent-schema" | "agent-source" | "agent-id" | "agent-digest";
  readonly message: string;
  readonly retraction: { readonly weight: -1; readonly belief: string };
  readonly generator: string;
};

export type AgentProposalPlanningResult = AgentProposalPlan | AgentProposalRejection;

function reject(
  code: "agent-schema" | "agent-source" | "agent-id" | "agent-digest",
  message: string,
  belief: string,
  generator: string,
): AgentProposalRejection {
  return { ok: false, code, message, retraction: { weight: -1, belief }, generator };
}

function digest(payload: string): string {
  return createHash("sha256").update(payload.trim()).digest("hex");
}

function validProposalId(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/u.test(value);
}

function isRejection(value: readonly string[] | GatedCommitRejection): value is GatedCommitRejection {
  return !Array.isArray(value);
}

/**
 * Plans a bounded agent-originated change. The workflow source is the authority:
 * only code already running from protected main may use the ephemeral Action token.
 * It can create a review branch, never write protected main, workflows, or author keys.
 */
export function planAgentProposal(input: {
  readonly intent: AgentProposalIntent;
  readonly payload: string;
  readonly currentMainSha: string;
}): AgentProposalPlanningResult {
  const { intent } = input;
  if (intent.schema !== "zeta.agent-proposal.v1" || intent.repository !== AGENT_PROPOSAL_REPOSITORY || intent.baseRef !== AGENT_PROPOSAL_BASE_REF) {
    return reject("agent-schema", "teaching error: agent proposal does not bind the canonical Zeta protected-main contract; generator: createAgentProposalIntent", "agent-proposal-contract", "createAgentProposalIntent");
  }
  if (!validProposalId(intent.proposalId)) {
    return reject("agent-id", "teaching error: agent proposal ID is not a bounded lower-case branch component; generator: createAgentProposalIntent", "agent-proposal-id", "createAgentProposalIntent");
  }
  if (!intent.workflowRef.endsWith("@refs/heads/main")) {
    return reject("agent-source", "teaching error: agent proposal was not emitted by a protected-main workflow revision; generator: invoke the committed agent proposal adapter from main", "agent-proposal-source", "trustedMainWorkflow");
  }
  if (intent.baseSha.toLowerCase() !== input.currentMainSha.toLowerCase()) {
    return {
      ok: false,
      code: "stale-base",
      message: "teaching error: protected main advanced before the agent proposal could stage; generator: regenerate the patch against current main",
      retraction: { weight: -1, belief: "agent-proposal-stale-base" },
      generator: "bindCurrentMainAndGeneratePatch",
    };
  }
  if (intent.patchDigest !== digest(input.payload)) {
    return reject("agent-digest", "teaching error: agent patch bytes differ from the declared digest; generator: re-hash the exact unified patch before staging", "agent-proposal-digest", "createAgentProposalIntent");
  }
  const paths = patchPaths(input.payload);
  if (isRejection(paths)) return paths;
  return {
    ok: true,
    branch: `agent-proposal/${intent.proposalId}`,
    commitMessage: `agent-proposal: ${intent.proposalId}\n\nworkflow: ${intent.workflowRef}\npatch-digest: ${intent.patchDigest}`,
    paths,
  };
}
