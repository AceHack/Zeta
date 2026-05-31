import {
  CommandType,
  HatBindingPhase,
  SupervisorSignalToolType,
  type AgenticActor,
  type HatBinding,
  type SupervisorChainLevel,
} from "../../domain/src/index.ts";
import type { SendSupervisorSignalCommand } from "./handlers/send-supervisor-signal.ts";
import { ScheduleCorrectiveActionKind, type ScheduleCorrectiveAction } from "./schedule-optimizer.ts";

export type CreateReassignAfterExpirySupervisorSignalCommandInput = {
  readonly organizationId: string;
  readonly projectId: string;
  readonly teamId: string;
  readonly workItemId: string;
  readonly actor: AgenticActor;
  readonly targetHatAssignmentId: string;
  readonly sourceLevel: SupervisorChainLevel;
  readonly targetLevel: SupervisorChainLevel;
  readonly correctiveAction: ScheduleCorrectiveAction;
  readonly expiredBinding: HatBinding;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly traceId: string;
};

export type ReassignAfterExpirySupervisorSignalCommandResult =
  | { readonly outcome: "created"; readonly command: SendSupervisorSignalCommand }
  | {
      readonly outcome: "rejected";
      readonly reason:
        | "unsupported_corrective_action"
        | "binding_not_expired"
        | "hat_mismatch"
        | "organization_mismatch";
    };

export function createReassignAfterExpirySupervisorSignalCommand(
  input: CreateReassignAfterExpirySupervisorSignalCommandInput,
): ReassignAfterExpirySupervisorSignalCommandResult {
  if (input.correctiveAction.kind !== ScheduleCorrectiveActionKind.ReassignAfterExpiry) {
    return { outcome: "rejected", reason: "unsupported_corrective_action" };
  }
  if (input.expiredBinding.phase !== HatBindingPhase.Expired) {
    return { outcome: "rejected", reason: "binding_not_expired" };
  }
  if (input.expiredBinding.organizationId !== input.organizationId) {
    return { outcome: "rejected", reason: "organization_mismatch" };
  }
  if (input.expiredBinding.hatId !== input.correctiveAction.hatId) {
    return { outcome: "rejected", reason: "hat_mismatch" };
  }

  return {
    outcome: "created",
    command: {
      commandId: input.commandId,
      type: CommandType.SendSupervisorSignal,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      correlationId: input.correlationId,
      causationId: input.causationId,
      traceId: input.traceId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      actor: input.actor,
      targetHatAssignmentId: input.targetHatAssignmentId,
      title: `Reassign expired ${input.expiredBinding.hatId} capacity`,
      message: [
        `Hat binding ${input.expiredBinding.id} for ${input.expiredBinding.hatId} expired while worn by ${input.expiredBinding.wearerAgentId}.`,
        `Route this vacated capacity through RMO reassignment before more ${input.expiredBinding.hatId} work is scheduled.`,
        `Corrective action ${input.correctiveAction.actionId}: ${input.correctiveAction.rationale}`,
      ].join(" "),
      policyContext: {
        scope: {
          teamId: input.teamId,
          workItemId: input.workItemId,
        },
        toolType: SupervisorSignalToolType.RequestResource,
        supervisorChain: {
          sourceLevel: input.sourceLevel,
          targetLevel: input.targetLevel,
        },
      },
    },
  };
}
