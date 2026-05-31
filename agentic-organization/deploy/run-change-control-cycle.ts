/**
 * Prove ORG-NATIVE CHANGE CONTROL end-to-end in kind. A work item produces a
 * canonical ChangeSet that runs the org's internal review pipeline; PRs/MRs are an
 * optional port. Two runs in one script:
 *
 *   RUN A — internal-only (ExternalSystem.none, ZERO projections):
 *     open → internal-code-review (hat) → internal-qa FAILS on rev 1 → changes
 *     requested → resubmit (rev 2) → internal-qa passes → security quorum (3/3) →
 *     approved → applied. The org shipped with no external system at all.
 *
 *   RUN B — github-gated (the SAME pipeline + 2 stages), with a FAKE external port:
 *     …security quorum → external-code-review PROJECTS a PR (pending) → a human
 *     "approves the PR" → the approval flows IN as a gate satisfaction → human QA
 *     sign-off (HITL, auto-approved here) → approved → applied + PR merged.
 *
 * Everything persists to agentic_org_change_sets + review_stage_status + org_events.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26257:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26257/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-change-control-cycle.ts
 */

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { env } from "node:process";

import {
  ChangeSetPhase,
  ExternalSystem,
  StageOutcome,
  currentStage,
  type ChangeArtifact,
  type ChangeSet,
  type OrgEvent,
  type ProjectionRef,
  type ReviewPipeline,
} from "../packages/domain/src/index.ts";
import {
  contentAddressedChangeSetId,
  openChangeSet,
  runReviewStage,
  resumeHumanStage,
  resubmitChangeSet,
  applyChangeSet,
  buildInternalOnlyPipeline,
  buildGitHubGatedPipeline,
  createFakeExternalPort,
  ExternalDecision,
  type FakeExternalPort,
  type ReviewKernelDeps,
} from "../packages/application/src/index.ts";
import {
  createCockroachCoreStateMigrations,
  createCockroachOrgEventStore,
  createCockroachChangeSetStore,
  createCockroachReviewStageStatusStore,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const ORG = "org-lfg";
const NOW = Date.now();
const id = (p: string) => `${p}-${randomUUID()}`;

const ARTIFACTS: readonly ChangeArtifact[] = [
  { kind: "code_diff", path: "src/coupon.ts", diff: "export const couponRate = 0.1;", language: "ts" },
  { kind: "doc_change", path: "docs/coupon.md", before: "", after: "Coupons apply at checkout." },
  { kind: "schema_migration", migrationId: "m-coupon", sql: "CREATE TABLE coupons (id STRING PRIMARY KEY);" },
];

type Deps = {
  changeSetStore: ReturnType<typeof createCockroachChangeSetStore>;
  stageStatusStore: ReturnType<typeof createCockroachReviewStageStatusStore>;
  appendEvent: (e: OrgEvent) => Promise<void>;
};

/** Drive a ChangeSet through its pipeline to a terminal phase. Returns the final cs. */
async function drive(initial: ChangeSet, pipeline: ReviewPipeline, port: FakeExternalPort | undefined, deps: Deps): Promise<ChangeSet> {
  // the external decision is pre-pulled into this stash before each external stage runs,
  // so the kernel's synchronous callback reflects the live port state.
  let externalState: ExternalDecision = ExternalDecision.Pending;
  const externalApproved = new Set<string>(); // projections we've already simulated a human approving

  const kernel: ReviewKernelDeps = {
    organizationId: ORG, now: NOW, createId: id,
    blockingFindings: () => 0,
    testsGreen: (cs) => cs.revision >= 2, // fails on rev 1 → one bounce → passes on rev 2
    quorumApprovals: () => 3,
    externalDecision: () => (port === undefined ? ExternalDecision.Approved : externalState),
  };

  let cs = (await commit(openChangeSet(initial, kernel), deps)).cs;
  let guard = 0;
  while (cs.phase === ChangeSetPhase.InReview && guard++ < 40) {
    const stage = currentStage(cs, pipeline)!;

    if (port !== undefined && stage.projectTo !== undefined) {
      // lazily materialize the projection (the PR) once
      let ref = cs.projections.find((p) => p.system === stage.projectTo);
      if (ref === undefined) {
        ref = await port.project(cs, stage);
        cs = { ...cs, projections: [...cs.projections, ref] };
        await deps.appendEvent(event(kernel, "projection_created", cs.changeSetId, `projected ${stage.id} → ${stage.projectTo} (${ref.url})`));
        await deps.changeSetStore.upsert(cs);
      }
      // pre-pull the live external state for the kernel's sync callback
      externalState = (await port.pull(ref)).decision;
    } else {
      externalState = ExternalDecision.Pending;
    }

    const result = runReviewStage(cs, pipeline, kernel);
    cs = (await commit(result, deps, stage.id)).cs;

    if (result.paused) {
      const cur = currentStage(cs, pipeline);
      if (cur?.authority.kind === "human") {
        // HITL: a human signs off (auto-approved in this proof)
        cs = (await commit(resumeHumanStage(cs, pipeline, StageOutcome.Approve, "qa_lead", kernel), deps, stage.id)).cs;
      } else if (cur?.authority.kind === "external" && port !== undefined) {
        // simulate the external human approving the PR — next loop re-pulls → approved → advances
        const ref = cs.projections.find((p) => p.system === cur.projectTo);
        if (ref !== undefined && !externalApproved.has(ref.externalId)) {
          port.approve(ref.externalId);
          externalApproved.add(ref.externalId);
          await deps.appendEvent(event(kernel, "projection_synced", cs.changeSetId, `external human approved ${ref.externalId} — approval flowing back into the gate`));
        }
      }
    }
    if (cs.phase === ChangeSetPhase.ChangesRequested) {
      cs = (await commit(resubmitChangeSet(cs, kernel), deps)).cs;
    }
  }

  if (cs.phase === ChangeSetPhase.Approved) {
    cs = (await commit(applyChangeSet(cs, kernel), deps)).cs;
    if (port !== undefined) for (const ref of cs.projections) await port.merge(ref.externalId);
  }
  return cs;
}

function event(deps: ReviewKernelDeps, kind: string, subjectId: string, decision: string): OrgEvent {
  const corr = deps.createId("cccorr");
  return { id: deps.createId("ccevt"), kind: kind as OrgEvent["kind"], occurredAt: new Date(deps.now).toISOString(), organizationId: ORG, subjectId, decision, supervisorChain: ["executive_board", "coo"], evidenceRefs: [], correlationId: corr, causationId: corr, traceId: corr };
}

async function commit(step: { changeSet: ChangeSet; events: readonly OrgEvent[] }, deps: Deps, stageId?: string): Promise<{ cs: ChangeSet }> {
  await deps.changeSetStore.upsert(step.changeSet);
  for (const e of step.events) await deps.appendEvent(e);
  if (stageId !== undefined) {
    const last = step.events[step.events.length - 1];
    await deps.stageStatusStore.record({
      changeSetId: step.changeSet.changeSetId, stageId, revision: step.changeSet.revision,
      ...(last?.toState !== undefined || last !== undefined ? { outcome: inferOutcome(step.changeSet.phase) } : {}),
      ...(last?.actorHatId !== undefined ? { decidedBy: last.actorHatId } : {}),
      decidedAt: new Date(NOW).toISOString(),
    });
  }
  return { cs: step.changeSet };
}

function inferOutcome(phase: ChangeSetPhase): StageOutcome {
  if (phase === ChangeSetPhase.ChangesRequested) return StageOutcome.RequestChanges;
  if (phase === ChangeSetPhase.Rejected) return StageOutcome.Reject;
  return StageOutcome.Approve;
}

function seedChangeSet(workItemId: string, pipelineId: string): ChangeSet {
  const changeSetId = contentAddressedChangeSetId(ORG, workItemId, "feat/coupon", 1);
  const at = new Date(NOW).toISOString();
  return {
    changeSetId, organizationId: ORG, workItemId, proposerHatId: "code_author", title: "Add coupon flow",
    targetRef: "feat/coupon", phase: ChangeSetPhase.Drafted, pipelineId, currentStageIndex: 0,
    artifacts: ARTIFACTS, projections: [], revision: 1, openedAt: at, updatedAt: at,
  };
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const client: CockroachSqlClient = { query: async (sql, p) => ({ rows: (await pool.query(sql, p as unknown[])).rows }), transaction: async (op) => op(client) };
  const executor = createCockroachSqlExecutor({ client });
  for (const migration of createCockroachCoreStateMigrations()) {
    for (const s of splitSqlStatements(migration.sql)) await pool.query(s);
  }

  const deps: Deps = {
    changeSetStore: createCockroachChangeSetStore({ executor }),
    stageStatusStore: createCockroachReviewStageStatusStore({ executor }),
    appendEvent: (e) => createCockroachOrgEventStore({ executor }).append(e),
  };

  // RUN A — internal-only, zero external systems
  const workA = `work-internal-${randomUUID().slice(0, 8)}`;
  const pipelineA = buildInternalOnlyPipeline(ORG);
  const finalA = await drive(seedChangeSet(workA, pipelineA.pipelineId), pipelineA, undefined, deps);

  // RUN B — github-gated, with the fake external port (the PR is a projection)
  const workB = `work-github-${randomUUID().slice(0, 8)}`;
  const pipelineB = buildGitHubGatedPipeline(ORG);
  const fakeGitHub = createFakeExternalPort(ExternalSystem.GitHub, () => NOW);
  const finalB = await drive(seedChangeSet(workB, pipelineB.pipelineId), pipelineB, fakeGitHub, deps);

  console.log(JSON.stringify({
    changeControlCycle: {
      runA_internalOnly: { workItem: workA, changeSet: finalA.changeSetId, finalPhase: finalA.phase, finalRevision: finalA.revision, projections: finalA.projections.length },
      runB_githubGated: { workItem: workB, changeSet: finalB.changeSetId, finalPhase: finalB.phase, finalRevision: finalB.revision, projections: finalB.projections.map((p) => ({ system: p.system, externalId: p.externalId })) },
    },
  }, null, 2));
  await pool.end();
}

await main();
