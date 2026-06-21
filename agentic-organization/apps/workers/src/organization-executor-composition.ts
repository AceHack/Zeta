/**
 * Compose the organization reaction-plan executor for the deployed worker: the
 * autonomous data plane (a Hermes agent run) + the durable org structure (a
 * supervisor-triage discussion anchor created through the command pipeline,
 * anchored to a real work item). This is where "the agents doing autonomous
 * work" meets "the entire organizational structure."
 */

import {
  HatAssignmentAuthorityState,
  ProjectStatus,
  RequiredHat,
  WorkItemState,
  WorkItemType,
  type AgenticActor,
  type ReactionPlanAction,
} from "../../../packages/domain/src/index.ts";
import {
  CommandResultStatus,
  buildHatDefinitions,
  createApplicationReactionPlanActionExecutor,
  createCommandHandlerRegistry,
  createHatAuthorityPort,
  createCommandPipeline,
  createCreateDiscussionAnchorHandler,
  createOrganizationReactionPlanActionExecutor,
  type CommandResult,
  type EnsureWorkItemPort,
  type HatAssignmentAuthorityWriterPort,
} from "../../../packages/application/src/index.ts";
import { createCommandAuthorizationPort, createPolicyDecisionObservationPort } from "../../../packages/policy/src/index.ts";
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
    commandAuthorizationPort: createCommandAuthorizationPort({
      hatAuthorityPort: createHatAuthorityPort({
        hatAssignmentAuthorityReader: stateAdapters.hatAssignmentAuthorityReader,
        hatDefinitions: buildHatDefinitions(),
        createId: input.createId,
      }),
    }),
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
    actorResolver: { resolveReactionActor: async (request) => synthesizeActor(request.action) },
    createId: input.createId,
  });

  const ensureWorkItem = createReactionSubstrateSeeder({
    store: stateAdapters.workAnchorStateStore,
    authorityWriter: stateAdapters.hatAssignmentAuthorityWriter,
    now: input.now,
    createId: input.createId,
  });

  return createOrganizationReactionPlanActionExecutor({
    agentExecutor: input.agentExecutor,
    ensureWorkItem,
    organizationExecutor,
  });
}

function synthesizeActor(action: ReactionPlanAction): AgenticActor {
  const suffix = action.requiredHat;
  return {
    agentId: `agent-reaction-${suffix}`,
    hatAssignmentId: `hat-assignment-reaction-${suffix}`,
  };
}

/**
 * The real org hat the synthetic reaction actor wears. The reaction plan's
 * `requiredHat` is an abstract supervisor LEVEL (RequiredHat.*); the command
 * pipeline authorizes against a concrete hat definition whose tool bundles must
 * cover the action class the reaction command needs (see `toolTypeForReactionAction`):
 *   EngineeringManager -> Prioritize     -> BacklogAndDefect
 *   Reviewer           -> WriteDoc        -> DocumentationContext
 *   CSuite/Director/ExecutiveBoard -> AssignHat -> HatAuthorization
 * Each mapped hat is asserted (in tests) to exist in `buildHatDefinitions()` and
 * to carry the required bundle, so the authority grant is never vacuous.
 */
export const ReactionActorHatId: Readonly<Record<RequiredHat, string>> = {
  [RequiredHat.EngineeringManager]: "engineering_manager",
  [RequiredHat.Reviewer]: "readiness_reviewer",
  [RequiredHat.CSuite]: "cto",
  [RequiredHat.Director]: "engineering_director",
  [RequiredHat.ExecutiveBoard]: "executive_board_member",
};

type WorkAnchorSeederStore = ReturnType<typeof createCockroachDurableStateAdapters<CommandResult>>["workAnchorStateStore"];

function createReactionSubstrateSeeder(input: {
  store: WorkAnchorSeederStore;
  authorityWriter: HatAssignmentAuthorityWriterPort;
  now: () => string;
  createId: (prefix: string) => string;
}): EnsureWorkItemPort {
  return {
    ensureWorkItem: async (action: ReactionPlanAction) => {
      const actor = synthesizeActor(action);

      // Grant the synthetic reaction actor its scoped, auditable hat authority
      // FIRST and unconditionally (idempotent UPSERT) — the org command that
      // follows is gated by the hat-authority policy, and nothing else populates
      // the authority projection for a synthesized actor. Done outside the
      // work-item existence check so a pre-seeded work item still gets authority.
      await input.authorityWriter.grantHatAssignmentAuthority({
        hatAssignmentId: actor.hatAssignmentId,
        hatId: ReactionActorHatId[action.requiredHat],
        organizationId: action.organizationId,
        projectId: action.projectId,
        ...(action.teamId === undefined ? {} : { teamId: action.teamId }),
        assignedAgentId: actor.agentId,
        state: HatAssignmentAuthorityState.Active,
        updatedAt: input.now(),
        version: 1,
        correlationId: action.triggerEventId,
        causationId: action.triggerEventId,
        traceId: action.triggerEventId,
      });

      const existing = await input.store.findWorkItem(action.workItemId);
      if (existing !== undefined) {
        return;
      }

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
