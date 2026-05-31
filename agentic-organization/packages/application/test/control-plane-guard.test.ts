import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ActRejectionReason,
  CommandErrorCode,
  CommandResultStatus,
  ControlPlaneFlagKind,
  ControlPlaneScopeKind,
  createControlPlaneDeterministicRule,
  createControlPlaneSlotAuthorizer,
  evaluateControlPlaneAccess,
  createCommandHandlerRegistry,
  createCommandPipeline,
  asZetaIdDecimal,
  observe,
  renderMenu16,
  act,
  RunLifecyclePhase,
  RunScope,
  type CommandResult,
  type ControlPlaneFlag,
  type ControlPlaneUsage,
  type CommandHandler,
  type Menu16,
} from "../src/index.ts";
import { type AgenticActor } from "../../domain/src/index.ts";
import {
  PolicyDecisionObservationPersistenceStatus,
  PolicyDecisionStatus,
  type CommandAuthorizationPort,
  type PolicyDecisionObservationPort,
} from "../../policy/src/index.ts";
import type { PipelineCommand } from "../src/command-contract.ts";
import {
  CommandOutcomePersistenceStatus,
  type CommandStateStoreFactory,
  type RecordCommandOutcomeInput,
} from "../src/ports.ts";

const NOW = "2026-05-31T19:00:00.000Z";
const Actor: AgenticActor = { agentId: "agent-1", hatAssignmentId: "hat-assignment-1" };
const Usage: ControlPlaneUsage = {
  tokenCost: 80,
  toolCallCost: 1,
  modelCallCost: 1,
  externalProviderCallCost: 0,
  releaseActionCost: 0,
  secretScopes: ["repo:write"],
};

test("control-plane guard propagates ESTOP, tenant, hat, provider, budget, and secret vetoes", () => {
  const flags: readonly ControlPlaneFlag[] = [
    flag("flag-estop", ControlPlaneFlagKind.Estop, { kind: ControlPlaneScopeKind.Organization }, "operator estop"),
    flag("flag-tenant", ControlPlaneFlagKind.Freeze, { kind: ControlPlaneScopeKind.Tenant, tenantId: "org-lfg" }, "tenant frozen"),
    flag("flag-hat", ControlPlaneFlagKind.Freeze, { kind: ControlPlaneScopeKind.Hat, hatId: "backend_implementer" }, "hat frozen"),
    flag("flag-provider", ControlPlaneFlagKind.ProviderFreeze, { kind: ControlPlaneScopeKind.Provider, providerId: "github" }, "provider frozen"),
  ];

  const denied = evaluateControlPlaneAccess({
    organizationId: "org-lfg",
    actorHatId: "backend_implementer",
    providerId: "github",
    boundary: "command_dispatch",
    actionType: "execute",
    evaluatedAt: NOW,
    flags,
    budgets: [{ kind: "tokens", limit: 100, used: 95, requested: 10 }],
    usage: Usage,
    availableSecretScopes: [],
  });

  equal(denied.status, "denied");
  if (denied.status !== "denied") return;
  deepEqual(denied.reasonCodes, [
    "estop",
    "tenant_freeze",
    "hat_freeze",
    "provider_freeze",
    "budget_ceiling",
    "secret_scope_unavailable",
  ]);
  ok(denied.message.includes("operator estop"));

  const controlLane = evaluateControlPlaneAccess({
    organizationId: "org-lfg",
    actorHatId: "backend_implementer",
    boundary: "cadence_tick_start",
    actionType: "control_tick",
    evaluatedAt: NOW,
    flags,
    isControlPlaneExempt: true,
    usage: Usage,
    budgets: [],
    availableSecretScopes: ["repo:write"],
  });

  equal(controlLane.status, "allowed");
  equal(controlLane.audit.exempted, true);
});

test("control-plane deterministic rule vetoes observe slots before rendering selectable actions", () => {
  const rule = createControlPlaneDeterministicRule({
    flags: [flag("flag-tenant", ControlPlaneFlagKind.Freeze, { kind: ControlPlaneScopeKind.Tenant, tenantId: "org-lfg" }, "tenant frozen")],
    organizationId: "org-lfg",
    actorHatId: "backend_implementer",
    evaluatedAt: NOW,
    boundary: "observe",
  });

  const readout = observe({
    runId: asZetaIdDecimal("1"),
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingGate,
    hasGateApproval: true,
    hasEvidence: false,
    trace: { correlationId: "corr-1", causationId: "cause-1", traceId: "trace-1" },
  }, {
    clock: { now: () => NOW },
    deterministicRules: [rule],
  });

  equal(readout.outcome, "readout");
  if (readout.outcome !== "readout") return;
  const menu = renderMenu16(readout.readout);
  equal(menu.slots[4]?.availability, "F");
  ok(menu.slots[4]?.reason?.includes("tenant frozen"));
});

test("control-plane slot authorizer rejects act-time ESTOP that appears after observe", async () => {
  const readout = observe({
    runId: asZetaIdDecimal("1"),
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingGate,
    hasGateApproval: true,
    hasEvidence: false,
    trace: { correlationId: "corr-1", causationId: "cause-1", traceId: "trace-1" },
  }, { clock: { now: () => NOW } });
  equal(readout.outcome, "readout");
  if (readout.outcome !== "readout") return;
  const menu = renderMenu16(readout.readout);
  let dispatched = false;

  const result = await act(4, menu, {
    authorizeSlot: createControlPlaneSlotAuthorizer({
      flags: [flag("flag-estop", ControlPlaneFlagKind.Estop, { kind: ControlPlaneScopeKind.Organization }, "operator estop")],
      organizationId: "org-lfg",
      actorHatId: "backend_implementer",
      evaluatedAt: NOW,
      boundary: "act",
    }),
    runCommand: async () => {
      dispatched = true;
      return { ok: true };
    },
    dispatchTool: async () => {
      dispatched = true;
      return { ok: true };
    },
  });

  equal(result.outcome, "rejected");
  if (result.outcome !== "rejected") return;
  equal(result.reason, ActRejectionReason.ControlPlaneDenied);
  equal(dispatched, false);
});

test("control-plane slot authorizer merges caller usage with slot-declared secret scopes", async () => {
  const menu: Menu16 = {
    slots: [
      {
        index: 0,
        direction: "commit.a",
        label: "publish provider update",
        availability: "T",
        impl: {
          kind: "mcp",
          tool: "github.publish",
          requiredSecretScopes: ["github:write"],
        },
      },
      ...Array.from({ length: 15 }, (_, offset) => ({
        index: offset + 1,
        direction: `empty.${offset}`,
        label: "empty",
        availability: "N" as const,
      })),
    ],
  };
  let dispatched = false;

  const result = await act(0, menu, {
    authorizeSlot: createControlPlaneSlotAuthorizer({
      flags: [],
      organizationId: "org-lfg",
      actorHatId: "release_operator",
      evaluatedAt: NOW,
      boundary: "mcp_dispatch",
      availableSecretScopes: [],
      usageForSlot: () => ({ tokenCost: 5 }),
    }),
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => {
      dispatched = true;
      return { ok: true };
    },
  });

  equal(result.outcome, "rejected");
  if (result.outcome !== "rejected") return;
  equal(result.reason, ActRejectionReason.ControlPlaneDenied);
  ok(result.message.includes("secret_scope_unavailable"));
  equal(dispatched, false);
});

test("command dispatch fails closed under tenant freeze without recording command effects", async () => {
  const store = createRecordingCommandStateStoreFactory<CommandResult>();
  const authorization = createRecordingAllowingCommandAuthorizationPort();
  const pipeline = createCommandPipeline<TestCommand>({
    stateStoreFactory: store,
    commandAuthorizationPort: authorization,
    policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
    handlerRegistry: createCommandHandlerRegistry<TestCommand, CommandResult>([createTestCommandHandler()]),
    now: () => NOW,
    createId: (prefix) => `${prefix}-1`,
    controlPlane: {
      flags: [flag("flag-tenant", ControlPlaneFlagKind.Freeze, { kind: ControlPlaneScopeKind.Tenant, tenantId: "org-lfg" }, "tenant frozen")],
      now: () => NOW,
    },
  });

  const result = await pipeline.execute(createTestCommand({ commandId: "cmd-frozen" }));

  equal(result.status, CommandResultStatus.Rejected);
  equal(result.error?.code, CommandErrorCode.ControlPlaneDenied);
  equal(result.error?.reason, "tenant_freeze");
  equal(authorization.calls, 1);
  equal(store.recordedOutcomes.length, 0);
});

test("command replay returns the idempotent result even when ESTOP is active", async () => {
  const accepted: CommandResult = {
    commandId: "cmd-replay",
    status: CommandResultStatus.Accepted,
    idempotency: { replayed: false },
  };
  const store = createRecordingCommandStateStoreFactory<CommandResult>({
    idempotencyKey: "idem-cmd-replay",
    requestHash: "hash-cmd-replay",
    result: accepted,
  });
  const authorization = createRecordingAllowingCommandAuthorizationPort();
  const pipeline = createCommandPipeline<TestCommand>({
    stateStoreFactory: store,
    commandAuthorizationPort: authorization,
    policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
    handlerRegistry: createCommandHandlerRegistry<TestCommand, CommandResult>([createTestCommandHandler()]),
    now: () => NOW,
    createId: (prefix) => `${prefix}-1`,
    controlPlane: {
      flags: [flag("flag-estop", ControlPlaneFlagKind.Estop, { kind: ControlPlaneScopeKind.Organization }, "operator estop")],
      now: () => NOW,
    },
  });

  const result = await pipeline.execute(createTestCommand({ commandId: "cmd-replay" }));

  equal(result.status, CommandResultStatus.Accepted);
  equal(result.idempotency.replayed, true);
  equal(authorization.calls, 1);
  equal(store.recordedOutcomes.length, 0);
});

const TestCommandType = "test.controlled_command";

type TestCommand = PipelineCommand & {
  type: typeof TestCommandType;
};

type RecordingCommandStateStoreFactory<Result> = CommandStateStoreFactory<Result> & {
  recordedOutcomes: RecordCommandOutcomeInput<Result>[];
};

function createRecordingCommandStateStoreFactory<Result>(
  existingRecord?: { idempotencyKey: string; requestHash: string; result: Result },
): RecordingCommandStateStoreFactory<Result> {
  const recordedOutcomes: RecordCommandOutcomeInput<Result>[] = [];
  return {
    recordedOutcomes,
    createCommandStateStore: () => ({
      findIdempotencyRecord: async (idempotencyKey) =>
        existingRecord !== undefined && existingRecord.idempotencyKey === idempotencyKey
          ? existingRecord
          : undefined,
      recordCommandOutcome: async (input) => {
        recordedOutcomes.push(input);
        return { status: CommandOutcomePersistenceStatus.Committed, result: input.idempotencyRecord.result };
      },
    }),
  };
}

function createRecordingAllowingCommandAuthorizationPort(): CommandAuthorizationPort & { calls: number } {
  const port = {
    calls: 0,
    authorizeCommand: async () => {
      port.calls += 1;
      return {
        status: PolicyDecisionStatus.Allowed,
        decisionId: "policy-decision-allow",
        policyVersion: "policy-v1",
      };
    },
  } satisfies CommandAuthorizationPort & { calls: number };
  return port;
}

function createRecordingPolicyDecisionObservationPort(): PolicyDecisionObservationPort {
  return {
    observePolicyDecision: async () => ({ status: PolicyDecisionObservationPersistenceStatus.Recorded }),
  };
}

function createTestCommand(input: { commandId: string }): TestCommand {
  return {
    commandId: input.commandId,
    type: TestCommandType,
    idempotencyKey: `idem-${input.commandId}`,
    requestHash: `hash-${input.commandId}`,
    correlationId: `corr-${input.commandId}`,
    causationId: `cause-${input.commandId}`,
    traceId: `trace-${input.commandId}`,
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    actor: Actor,
  };
}

function createTestCommandHandler(): CommandHandler<TestCommand, CommandResult> {
  return {
    commandType: TestCommandType,
    execute: async (command) => ({
      result: {
        commandId: command.commandId,
        status: CommandResultStatus.Accepted,
        idempotency: { replayed: false },
        artifacts: [],
        emittedEvents: [],
        auditEventIds: [],
      },
      effects: {
        supervisorSignals: [],
        discussionAnchors: [],
        decisionRecords: [],
        qualityGateEvaluations: [],
        workScheduleBlocks: [],
        auditEvents: [],
        outboxEvents: [],
      },
    }),
  };
}

function flag(
  controlPlaneFlagId: string,
  flagKind: ControlPlaneFlagKind,
  scope: ControlPlaneFlag["scope"],
  reason: string,
): ControlPlaneFlag {
  return {
    controlPlaneFlagId,
    organizationId: "org-lfg",
    scope,
    flag: flagKind,
    reason,
    setByHatId: "incident_commander",
    setAt: NOW,
  };
}
