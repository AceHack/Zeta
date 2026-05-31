/**
 * Phase 2.8 KIND proof: prove hard-control secret scopes are typed onto the
 * observe-act surface and enforced before MCP/tool dispatch.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26261:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26261/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-control-plane-secret-scopes.ts
 */

import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { Pool } from "pg";

import {
  ControlPlaneFlagKind,
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

    const ok =
      activeFlags.length === 1 &&
      providerFreezeDenied.outcome === "rejected" &&
      providerFreezeDenied.message.includes("provider_freeze") &&
      !providerDispatched &&
      secretDenied.outcome === "rejected" &&
      secretDenied.message.includes("secret_scope_unavailable") &&
      !secretDispatched &&
      promptFlowSurface.outcome === "readout" &&
      promptFlowSurface.promptFlows.tasks.length === 0 &&
      promptFlowSurface.promptFlows.vetoedTasks.some((vetoed) =>
        vetoed.ruleName === "prompt-flow-secret-scope" &&
        vetoed.reason.includes("github:write")
      );

    console.log(JSON.stringify({
      track: "Phase 2.8 control-plane secret scopes",
      organizationId,
      activeFlagIds: activeFlags.map((flag) => flag.controlPlaneFlagId),
      providerFreezeDenied,
      providerDispatched,
      secretDenied,
      promptFlowVetoes: promptFlowSurface.outcome === "readout" ? promptFlowSurface.promptFlows.vetoedTasks : [],
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
