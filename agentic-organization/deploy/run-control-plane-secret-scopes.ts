/**
 * Phase 2.8 KIND proof: prove hard-control secret scopes and rate limits are
 * typed onto the observe-act surface and enforced before MCP/tool dispatch.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26261:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26261/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-control-plane-secret-scopes.ts
 */

import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { Pool } from "pg";

import { runAgentCliMain } from "../apps/agent-cli/src/agent-cli-main.ts";
import {
  ControlPlaneFlagKind,
  ControlPlaneRateLimitKind,
  ControlPlaneScopeKind,
  RunLifecyclePhase,
  RunScope,
  act,
  asZetaIdDecimal,
  buildHatDefinitions,
  createControlPlaneSlotAuthorizer,
  observeAgentSurface,
  type ControlPlaneFlag,
  type Menu16,
  type PromptFlowTask,
} from "../packages/application/src/index.ts";
import {
  createCockroachControlPlaneStateStore,
  createCockroachCoreStateMigrations,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const proofRunId = randomUUID().slice(0, 8);
const organizationId = `org-control-plane-secrets-${proofRunId}`;
const nowIso = new Date().toISOString();

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    const client: CockroachSqlClient = {
      query: async (sql, parameters) => ({ rows: (await pool.query(sql, parameters as unknown[])).rows }),
      transaction: async (operation) => operation(client),
    };
    const executor = createCockroachSqlExecutor({ client });

    for (const migration of createCockroachCoreStateMigrations()) {
      for (const statement of splitSqlStatements(migration.sql)) {
        await pool.query(statement);
      }
    }

    const controlPlane = createCockroachControlPlaneStateStore({ executor });
    await controlPlane.upsertFlag({
      controlPlaneFlagId: `flag-provider-freeze-${proofRunId}`,
      organizationId,
      scope: { kind: ControlPlaneScopeKind.Provider, providerId: "github" },
      flag: ControlPlaneFlagKind.ProviderFreeze,
      reason: "proof provider freeze",
      setByHatId: "incident_commander",
      setAt: nowIso,
    });
    const activeFlags = await controlPlane.listActiveFlags(organizationId, nowIso);

    let providerDispatched = false;
    const providerFreezeDenied = await act(0, mcpMenu(), {
      authorizeSlot: createControlPlaneSlotAuthorizer({
        organizationId,
        actorHatId: "release_operator",
        providerId: "github",
        boundary: "mcp_dispatch",
        evaluatedAt: nowIso,
        flags: activeFlags as readonly ControlPlaneFlag[],
        availableSecretScopes: ["github:write"],
      }),
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => {
        providerDispatched = true;
        return { status: "should_not_dispatch" };
      },
    });

    let secretDispatched = false;
    const secretDenied = await act(0, mcpMenu(), {
      authorizeSlot: createControlPlaneSlotAuthorizer({
        organizationId,
        actorHatId: "release_operator",
        boundary: "mcp_dispatch",
        evaluatedAt: nowIso,
        flags: [],
        availableSecretScopes: [],
      }),
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => {
        secretDispatched = true;
        return { status: "should_not_dispatch" };
      },
    });

    let rateLimitDispatched = false;
    const rateLimitDenied = await act(0, mcpMenu(), {
      authorizeSlot: createControlPlaneSlotAuthorizer({
        organizationId,
        tenantId: organizationId,
        actorHatId: "release_operator",
        boundary: "mcp_dispatch",
        evaluatedAt: nowIso,
        flags: [],
        rateLimits: [{
          rateLimitId: `rate-limit-provider-${proofRunId}`,
          organizationId,
          scope: { kind: ControlPlaneScopeKind.Tenant, tenantId: organizationId },
          kind: ControlPlaneRateLimitKind.ExternalProviderCalls,
          window: { startedAt: new Date(Date.parse(nowIso) - 60_000).toISOString(), endsAt: new Date(Date.parse(nowIso) + 60_000).toISOString() },
          limit: 1,
          used: 1,
        }],
        availableSecretScopes: ["github:write"],
        usageForSlot: () => ({ externalProviderCallCost: 1 }),
      }),
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => {
        rateLimitDispatched = true;
        return { status: "should_not_dispatch" };
      },
    });

    const promptFlowSurface = await observeAgentSurface(
      {
        runId: asZetaIdDecimal("42"),
        scope: RunScope.WorkItem,
        phase: RunLifecyclePhase.AwaitingGate,
        trace: { correlationId: `corr-${proofRunId}`, causationId: `cause-${proofRunId}`, traceId: `trace-${proofRunId}` },
        hasGateApproval: true,
        hasEvidence: false,
        hatAssignmentId: asZetaIdDecimal("99"),
        hat: buildHatDefinitions().find((hat) => hat.id === "release_operator")!,
        organizationId,
        projectId: "project-1",
        workItemId: "work-1",
      },
      {
        clock: { now: () => nowIso },
        promptFlowTasks: [promptFlowTask()],
        availableSecretScopes: [],
      },
    );

    const cliEvents: unknown[] = [];
    let cliLoadedContext = false;
    const cliExitCode = await runAgentCliMain({
      argv: [
        "observe",
        "--hat",
        "release_operator",
        "--scope",
        RunScope.WorkItem,
        "--phase",
        RunLifecyclePhase.AwaitingGate,
        "--run-id",
        "77",
        "--hat-assignment",
        "99",
        "--agent",
        "agent-release-proof",
        "--organization",
        organizationId,
        "--project",
        "project-1",
        "--work-item",
        "work-1",
        "--gate-approved",
        "--select-index",
        "6",
      ],
      env: { AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: JSON.stringify([promptFlowTask()]) },
      now: () => nowIso,
      writeStdout: () => undefined,
      writeStderr: () => undefined,
      runtime: {
        runCommand: async () => ({ status: "unused" }),
        dispatchTool: async () => ({ status: "unused" }),
        loadPromptFlowContext: async () => {
          cliLoadedContext = true;
          return {
            taskId: "pft-publish-release",
            promptFlowId: "pf-release-publish",
            directions: [],
            toolInjections: [],
            metrics: [],
            contextArtifacts: [],
          };
        },
        loadControlPlaneFlags: async () => activeFlags as readonly ControlPlaneFlag[],
        availableSecretScopes: ["github:write"],
        appendObserveActTick: async (event) => {
          cliEvents.push(event);
        },
        shutdown: async () => undefined,
      },
    });

    const ok =
      activeFlags.length === 1 &&
      providerFreezeDenied.outcome === "rejected" &&
      providerFreezeDenied.message.includes("provider_freeze") &&
      !providerDispatched &&
      secretDenied.outcome === "rejected" &&
      secretDenied.message.includes("secret_scope_unavailable") &&
      !secretDispatched &&
      rateLimitDenied.outcome === "rejected" &&
      rateLimitDenied.message.includes("rate_limit_exceeded") &&
      !rateLimitDispatched &&
      promptFlowSurface.outcome === "readout" &&
      promptFlowSurface.promptFlows.tasks.length === 0 &&
      promptFlowSurface.promptFlows.vetoedTasks.some((vetoed) =>
        vetoed.ruleName === "prompt-flow-secret-scope" &&
        vetoed.reason.includes("github:write")
      ) &&
      cliExitCode === 1 &&
      !cliLoadedContext &&
      JSON.stringify(cliEvents).includes("observe-act:control_bypass_rejected:control_plane_denied:6");

    console.log(JSON.stringify({
      track: "Phase 2.8 control-plane secret scopes and rate limits",
      organizationId,
      activeFlagIds: activeFlags.map((flag) => flag.controlPlaneFlagId),
      providerFreezeDenied,
      providerDispatched,
      secretDenied,
      rateLimitDenied,
      rateLimitDispatched,
      promptFlowVetoes: promptFlowSurface.outcome === "readout" ? promptFlowSurface.promptFlows.vetoedTasks : [],
      cliExitCode,
      cliLoadedContext,
      cliEventCount: cliEvents.length,
      secretDispatched,
      PROOF: ok ? "PASS" : "FAIL",
    }, null, 2));
    process.exitCode = ok ? 0 : 1;
  } finally {
    await pool.end();
  }
}

function mcpMenu(): Menu16 {
  return {
    slots: [
      {
        index: 0,
        direction: "commit.a",
        label: "publish release note",
        availability: "T",
        impl: {
          kind: "mcp",
          tool: "github.publish_release",
          args: { releaseId: "rel-1" },
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
}

function promptFlowTask(): PromptFlowTask {
  return {
    taskId: "pft-publish-release",
    workItemId: "work-1",
    title: "Publish release note",
    promptFlowId: "pf-release-publish",
    label: "publish release note",
    scope: RunScope.WorkItem,
    priority: 90,
    allowedHatIds: ["release_operator"],
    directions: ["Publish the release note"],
    toolInjections: [{
      tool: "github.publish_release",
      args: { releaseId: "rel-1" },
      requiredSecretScopes: ["github:write"],
    }],
    metrics: [],
    contextArtifactRefs: [],
  };
}

await main();
