/**
 * Compose the organization reaction-plan executor for the deployed worker: the
 * autonomous data plane (a Hermes agent run) + the durable org structure (a
 * supervisor-triage discussion anchor created through the command pipeline,
 * anchored to a real work item). This is where "the agents doing autonomous
 * work" meets "the entire organizational structure."
 *
 * Authorization is permissive in this composition (a hat-authority-backed port
 * swaps in behind the same CommandAuthorizationPort), and the actor is
 * synthesized from the action's required hat — the seams a real hat-assignment
 * system fills later.
 */

import {
  ProjectStatus,
  WorkItemState,
  WorkItemType,
  type AgenticActor,
  type ReactionPlanAction,
} from "../../../packages/domain/src/index.ts";
import {
  CommandResultStatus,
  createApplicationReactionPlanActionExecutor,
  createCommandHandlerRegistry,
  createCommandPipeline,
  createCreateDiscussionAnchorHandler,
  createOrganizationReactionPlanActionExecutor,
  type CommandResult,
  type EnsureWorkItemPort,
} from "../../../packages/application/src/index.ts";
import { PolicyDecisionStatus, createPolicyDecisionObservationPort, type CommandAuthorizationPort } from "../../../packages/policy/src/index.ts";
import {
  createCockroachDurableStateAdapters,
  type CockroachOrganizationSqlExecutor,
} from "../../../packages/state-cockroach/src/index.ts";
import type { ReactionPlanActionExecutorPort } from "../../../packages/runtime/src/index.ts";

export type ComposeOrganizationReactionPlanActionExecutorInput = {
  cockroachExecutor: CockroachOrganizationSqlExecutor;
  /** the Hermes agent-run executor (durable run + memory + agent liveness) */
  agentExecutor: ReactionPlanActionExecutorPort;
  createId: (prefix: string) => string;
  now: () => string;
};

export function composeOrganizationReactionPlanActionExecutor(
  input: ComposeOrganizationReactionPlanActionExecutorInput,
): ReactionPlanActionExecutorPort {
  const stateAdapters = createCockroachDurableStateAdapters<CommandResult>({ executor: input.cockroachExecutor });

  const commandPipeline = createCommandPipeline({
    stateStoreFactory: stateAdapters.commandStateStoreFactory,
    commandAuthorizationPort: createPermissiveCommandAuthorizationPort(input.createId),
    policyDecisionObservationPort: createPolicyDecisionObservationPort({
      store: stateAdapters.policyDecisionObservationStore,
    }),
    handlerRegistry: createCommandHandlerRegistry([createCreateDiscussionAnchorHandler()]),
    workAnchorStateReader: stateAdapters.workAnchorStateStore,
    now: input.now,
    createId: input.createId,
  });

  const organizationExecutor = createApplicationReactionPlanActionExecutor({
    commandPipeline,
    actorResolver: { resolveReactionActor: async (request) => synthesizeActor(request.action, input.createId) },
    createId: input.createId,
  });

  const ensureWorkItem = createCockroachWorkItemSeeder({
    store: stateAdapters.workAnchorStateStore,
    now: input.now,
    createId: input.createId,
  });

  return createOrganizationReactionPlanActionExecutor({
    agentExecutor: input.agentExecutor,
    ensureWorkItem,
    organizationExecutor,
  });
}

/** Allow-all authorization — a hat-authority-backed port swaps in behind this seam. */
function createPermissiveCommandAuthorizationPort(createId: (prefix: string) => string): CommandAuthorizationPort {
  return {
    authorizeCommand: async () => ({
      status: PolicyDecisionStatus.Allowed,
      decisionId: createId("decision"),
      policyVersion: "v0",
    }),
  };
}

function synthesizeActor(action: ReactionPlanAction, createId: (prefix: string) => string): AgenticActor {
  return {
    agentId: createId(`agent-${action.requiredHat}`),
    hatAssignmentId: createId(`hat-${action.requiredHat}`),
  };
}

type WorkAnchorSeederStore = ReturnType<typeof createCockroachDurableStateAdapters<CommandResult>>["workAnchorStateStore"];

function createCockroachWorkItemSeeder(input: {
  store: WorkAnchorSeederStore;
  now: () => string;
  createId: (prefix: string) => string;
}): EnsureWorkItemPort {
  return {
    ensureWorkItem: async (action: ReactionPlanAction) => {
      const existing = await input.store.findWorkItem(action.workItemId);
      if (existing !== undefined) {
        return;
      }

      const actor = synthesizeActor(action, input.createId);
      const ts = input.now();
      const metadata = {
        updatedAt: ts,
        version: 1,
        correlationId: action.triggerEventId,
        causationId: action.triggerEventId,
        traceId: action.triggerEventId,
      };

      // idempotent-best-effort: tolerate a concurrent seeder winning the race
      await input.store
        .createProject({
          projectId: action.projectId,
          organizationId: action.organizationId,
          name: `Project ${action.projectId}`,
          status: ProjectStatus.Active,
          createdAt: ts,
          createdBy: actor,
          metadata,
        })
        .catch(() => undefined);

      await input.store
        .createWorkItem({
          workItemId: action.workItemId,
          organizationId: action.organizationId,
          projectId: action.projectId,
          workItemType: WorkItemType.Task,
          title: `Work item ${action.workItemId}`,
          description: "Seeded so the supervisor-triage discussion anchor has a valid work-item anchor.",
          state: WorkItemState.Created,
          createdAt: ts,
          createdBy: actor,
          metadata,
        })
        .catch(() => undefined);
    },
  };
}

export { CommandResultStatus };
