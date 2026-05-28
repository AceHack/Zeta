import type { AgenticActor } from "../../domain/src/index.ts";
import type { CommandAuthorizationSupervisorChain } from "../../policy/src/index.ts";

export type PipelineCommandPolicyScope = {
  teamId?: string | undefined;
  workItemId?: string | undefined;
};

export type PipelineCommandPolicyContext = {
  scope?: PipelineCommandPolicyScope | undefined;
  toolType?: string | undefined;
  supervisorChain?: CommandAuthorizationSupervisorChain | undefined;
};

export type PipelineCommand = {
  commandId: string;
  type: string;
  idempotencyKey: string;
  requestHash: string;
  correlationId: string;
  causationId: string;
  traceId: string;
  organizationId: string;
  projectId: string;
  actor: AgenticActor;
  policyContext?: PipelineCommandPolicyContext | undefined;
};
