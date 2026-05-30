/**
 * Org cadence lanes (A1–A3) — the proven cycles exposed as CadenceLanes so the
 * always-on worker DRIVES them on their own cadences, joining the keep-alive lane.
 * Each factory inverts its dependencies (stores, hats, event sink) so the lane is
 * unit-testable with fakes and composed with real Cockroach adapters in the worker.
 *
 *   createWorkOsCadenceLane          — the living work loop (runWorkOsCycle) per tick
 *   createMemoryMaintenanceCadenceLane — decay/archive/reinforce + hat-decided moves
 *   createChangeControlCadenceLane   — advance in_review ChangeSets; open at release
 *
 * Every lane catches its own errors into the CadenceLaneTickResult.failures — a
 * lane must never throw (the cadence driver isolates throws, but lanes report
 * cleanly so the trace is honest).
 */

import {
  ChangeSetPhase,
  StageOutcome,
  currentStage,
  type ChangeSet,
  type HatDefinition,
  type MemoryRecord,
  type MemoryState,
  type OrgEvent,
  type ReviewPipeline,
} from "../../../packages/domain/src/index.ts";
import {
  runWorkOsCycle,
  runMemoryMaintenanceCycle,
  runReviewStage,
  resumeHumanStage,
  resubmitChangeSet,
  applyChangeSet,
  ExternalDecision,
  type ChangeControlPort,
  type ReviewKernelDeps,
} from "../../../packages/application/src/index.ts";
import type { CadenceLane, CadenceLaneTickResult } from "./cadence-lane.ts";

function degraded(message: string): CadenceLaneTickResult {
  return { status: "degraded", failures: [{ message }] };
}

// ── A1: Work OS living loop ──────────────────────────────────────────────────

/** A unit of pending work to drive through the living loop, or null if idle. */
export type WorkIntake = { projectId: string; initiativeId: string; initiativeBranch: string };
export type WorkIntakeSource = () => Promise<WorkIntake | null>;

export type WorkOsCadenceDeps = {
  organizationId: string;
  hats: readonly HatDefinition[];
  now: () => number;
  createId: (prefix: string) => string;
  /** real pending-work source; the worker stays IDLE when this returns null (no synthetic flood) */
  intake: WorkIntakeSource;
  appendEvent: (event: OrgEvent) => Promise<void>;
};

export function createWorkOsCadenceLane(deps: WorkOsCadenceDeps): CadenceLane {
  return {
    name: "work-os",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const work = await deps.intake();
        if (work === null) return { status: "work-os:idle", failures: [] };
        const report = await runWorkOsCycle({
          organizationId: deps.organizationId,
          projectId: work.projectId,
          initiativeId: work.initiativeId,
          initiativeBranch: work.initiativeBranch,
          hats: deps.hats,
          baseTimeMs: deps.now(),
          createId: deps.createId,
          appendEvent: deps.appendEvent,
        });
        return { status: `work-os:${report.finalState}`, failures: [] };
      } catch (error) {
        return degraded(`work-os lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

// ── A2: memory maintenance ───────────────────────────────────────────────────

export type MemoryEnvelopeReader = {
  listAll: (organizationId: string) => Promise<readonly import("../../../packages/domain/src/index.ts").MemoryEnvelope[]>;
};
export type MemoryStateWriter = {
  upsert: (record: MemoryRecord, state: MemoryState) => Promise<void>;
};

export type MemoryMaintenanceCadenceDeps = {
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
  reader: MemoryEnvelopeReader;
  writer: MemoryStateWriter;
  appendEvent: (event: OrgEvent) => Promise<void>;
};

export function createMemoryMaintenanceCadenceLane(deps: MemoryMaintenanceCadenceDeps): CadenceLane {
  return {
    name: "memory-maintenance",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const envelopes = await deps.reader.listAll(deps.organizationId);
        const result = runMemoryMaintenanceCycle(envelopes, { organizationId: deps.organizationId, now: deps.now(), createId: deps.createId });
        const byId = new Map(envelopes.map((e) => [e.memoryId, e]));
        for (const upd of result.updates) {
          const env = byId.get(upd.memoryId);
          if (env === undefined) continue;
          const record: MemoryRecord = { memoryId: env.memoryId, organizationId: env.organizationId, tier: env.tier, scope: env.scope, key: env.key, value: "", protected: env.protected, writtenBy: env.writtenBy, writtenAt: env.writtenAt };
          const nextState: MemoryState = { ...env.state, phase: upd.nextPhase, weight: upd.nextWeight, confidence: upd.nextConfidence, ...(upd.archivedAt !== undefined ? { archivedAt: upd.archivedAt } : {}) };
          await deps.writer.upsert(record, nextState);
        }
        for (const e of result.events) await deps.appendEvent(e);
        return { status: `memory:${result.recomputed}recomputed/${result.archived.length}archived`, failures: [] };
      } catch (error) {
        return degraded(`memory lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

// ── A3: change control ───────────────────────────────────────────────────────

export type ChangeSetReader = {
  listByOrgPhase: (organizationId: string, phase: ChangeSetPhase) => Promise<readonly ChangeSet[]>;
};
export type ChangeSetWriter = {
  upsert: (cs: ChangeSet) => Promise<void>;
};

export type ChangeControlCadenceDeps = {
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
  reader: ChangeSetReader;
  writer: ChangeSetWriter;
  pipelineFor: (cs: ChangeSet) => ReviewPipeline;
  appendEvent: (event: OrgEvent) => Promise<void>;
  /**
   * live external review port (L0). When present, an `external` stage projects a real
   * PR/card (if not yet projected) and the external decision is PULLED from it instead
   * of auto-approved. Absent (the default deploy) → external stages auto-approve.
   */
  externalPort?: ChangeControlPort;
};

export function createChangeControlCadenceLane(deps: ChangeControlCadenceDeps): CadenceLane {
  return {
    name: "change-control",
    async runOnce(): Promise<CadenceLaneTickResult> {
      // kernel fields shared across ChangeSets this tick; `now` is the CURRENT time
      // (built fresh per tick, not factory-time). externalDecision is resolved per
      // ChangeSet below (live port pull when configured, else auto-approved).
      const baseKernel = {
        organizationId: deps.organizationId,
        now: deps.now(),
        createId: deps.createId,
        blockingFindings: () => 0,
        testsGreen: (cs: ChangeSet) => cs.revision >= 2,
        quorumApprovals: () => 3,
      };
      try {
        // advance every in_review ChangeSet one step; auto-resume human/external in this lane
        const inReview = await deps.reader.listByOrgPhase(deps.organizationId, ChangeSetPhase.InReview);
        let advanced = 0;
        for (const cs of inReview) {
          const pipeline = deps.pipelineFor(cs);
          let next = cs;

          // resolve the external decision for THIS ChangeSet's current stage: when a live
          // port is configured and the stage is external, project a real PR/card (once) and
          // PULL the decision; otherwise auto-approve (internal-only default).
          let externalDecision: ExternalDecision = ExternalDecision.Approved;
          const stage = currentStage(next, pipeline);
          if (deps.externalPort !== undefined && stage !== undefined && stage.authority.kind === "external") {
            const externalSystem = stage.authority.system; // capture before the closure (narrowing won't survive into it)
            let ref = next.projections.find((p) => p.system === externalSystem);
            if (ref === undefined) {
              ref = await deps.externalPort.project(next, stage);
              next = { ...next, projections: [...next.projections, ref], updatedAt: new Date(deps.now()).toISOString() };
              await deps.writer.upsert(next);
            }
            const externalState = await deps.externalPort.pull(ref);
            externalDecision = externalState.decision;
          }
          const kernel: ReviewKernelDeps = { ...baseKernel, externalDecision: () => externalDecision };

          const result = runReviewStage(next, pipeline, kernel);
          next = result.changeSet;
          await deps.writer.upsert(next);
          for (const e of result.events) await deps.appendEvent(e);
          if (result.paused && currentStage(next, pipeline)?.authority.kind === "human") {
            const resumed = resumeHumanStage(next, pipeline, StageOutcome.Approve, "qa_lead", kernel);
            next = resumed.changeSet;
            await deps.writer.upsert(next);
            for (const e of resumed.events) await deps.appendEvent(e);
          }
          if (next.phase === ChangeSetPhase.ChangesRequested) {
            const re = resubmitChangeSet(next, kernel);
            next = re.changeSet;
            await deps.writer.upsert(next);
            for (const e of re.events) await deps.appendEvent(e);
          }
          if (next.phase === ChangeSetPhase.Approved) {
            const ap = applyChangeSet(next, kernel);
            await deps.writer.upsert(ap.changeSet);
            for (const e of ap.events) await deps.appendEvent(e);
          }
          advanced += 1;
        }
        return { status: `change-control:${advanced}advanced`, failures: [] };
      } catch (error) {
        return degraded(`change-control lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

// ── D4: document maintenance ─────────────────────────────────────────────────

import {
  DocLifecycleState,
  type DocUnit,
} from "../../../packages/domain/src/index.ts";
import { runDocMaintenanceCycle } from "../../../packages/application/src/index.ts";

export type DocUnitMaintenanceReader = {
  listByOrgStatus: (organizationId: string, status: DocLifecycleState) => Promise<readonly DocUnit[]>;
};
export type DocUnitMaintenanceWriter = {
  upsert: (unit: DocUnit) => Promise<void>;
};

export type DocMaintenanceCadenceDeps = {
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
  reader: DocUnitMaintenanceReader;
  writer: DocUnitMaintenanceWriter;
  appendEvent: (event: OrgEvent) => Promise<void>;
  stalenessFloorMs?: number;
  archiveFloorMs?: number;
};

const DOC_DAY_MS = 86_400_000;

/**
 * D4 lane: the Documentation department's maintenance cycle on its own cadence — flags
 * stale, supersedes by recency, archives the long-dead, surfaces conflicts. Persists each
 * status update + emits the doc_* events. Never throws (failures → CadenceLaneTickResult).
 */
export function createDocMaintenanceCadenceLane(deps: DocMaintenanceCadenceDeps): CadenceLane {
  return {
    name: "doc-maintenance",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const active = await deps.reader.listByOrgStatus(deps.organizationId, DocLifecycleState.Active);
        const stale = await deps.reader.listByOrgStatus(deps.organizationId, DocLifecycleState.Stale);
        const superseded = await deps.reader.listByOrgStatus(deps.organizationId, DocLifecycleState.Superseded);
        const units = [...active, ...stale, ...superseded];
        const byId = new Map(units.map((d) => [d.docUnitId, d]));

        const result = runDocMaintenanceCycle(units, {
          organizationId: deps.organizationId, now: deps.now(), createId: deps.createId,
          stalenessFloorMs: deps.stalenessFloorMs ?? 30 * DOC_DAY_MS,
          archiveFloorMs: deps.archiveFloorMs ?? 180 * DOC_DAY_MS,
        });
        const nowIso = new Date(deps.now()).toISOString();
        for (const upd of result.updates) {
          const unit = byId.get(upd.docUnitId);
          if (unit === undefined) continue;
          await deps.writer.upsert({ ...unit, status: upd.nextStatus, updatedAt: nowIso, version: unit.version + 1 });
        }
        for (const e of result.events) await deps.appendEvent(e);
        return { status: `doc:${result.staleFlagged}stale/${result.superseded}superseded/${result.archived}archived/${result.conflicts.length}conflicts`, failures: [] };
      } catch (error) {
        return degraded(`doc-maintenance lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
