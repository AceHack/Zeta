/**
 * Org cadence composition (A0) — wires the proven cycles (Work OS, memory
 * maintenance, change control) as concurrent CadenceLanes driven on their own
 * intervals, exactly like the keep-alive loop. main.ts calls this once and stops
 * it after the work loop finishes, keeping the entrypoint thin (single
 * responsibility: lane wiring lives here, not in main).
 *
 * Each lane runs on a configurable interval; a slow lane never delays another
 * (independent loops), and a thrown/degraded tick is isolated by the driver.
 */

import {
  buildDefaultChangeControlPolicy,
  buildInternalOnlyPipeline,
  buildHatDefinitions,
  applyAutonomyPolicy,
  type ChangeControlPort,
} from "../../../packages/application/src/index.ts";
import { AutonomyLevel, type AutonomyPolicy } from "../../../packages/domain/src/index.ts";
import {
  createCockroachOrgEventStore,
  createCockroachMemoryStateStore,
  createCockroachChangeSetStore,
  createCockroachWorkIntakeSource,
  createCockroachDocUnitStore,
} from "../../../packages/state-cockroach/src/index.ts";
import type { CockroachGenericSqlExecutor } from "../../../packages/state-cockroach/src/cockroach-sql-executor.ts";
import { runCadenceLane, type CadenceLane, type CadenceLaneObserver } from "./cadence-lane.ts";
import {
  createWorkOsCadenceLane,
  createMemoryMaintenanceCadenceLane,
  createChangeControlCadenceLane,
  createDocMaintenanceCadenceLane,
  type WorkIntakeSource,
} from "./org-cadence-lanes.ts";

export type OrgCadenceIntervals = {
  workOsMs: number;
  memoryMaintenanceMs: number;
  changeControlMs: number;
  docMaintenanceMs: number;
};

export const OrgCadenceIntervalDefault: OrgCadenceIntervals = {
  workOsMs: 60_000,
  memoryMaintenanceMs: 6 * 60 * 60 * 1000, // 6h (memory decay is slow)
  changeControlMs: 30_000,
  docMaintenanceMs: 6 * 60 * 60 * 1000, // 6h (doc lifecycle is slow, like memory)
};

export type ComposeOrgCadenceInput = {
  executor: CockroachGenericSqlExecutor;
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
  intervals?: OrgCadenceIntervals;
  /** sleep that wakes early when the cadence is stopped (the stop check is supplied) */
  sleep: (ms: number, isStopRequested: () => boolean) => Promise<void>;
  observer?: CadenceLaneObserver;
  /**
   * pending-work source for the Work OS lane. Defaults to the Cockroach intake source
   * (claims a `proposed` initiative → `active`, dequeue-once). Tests/proofs override it.
   */
  intake?: WorkIntakeSource;
  /**
   * live external review port (L0). When present, the change-control lane projects real
   * PRs/cards for `external` stages and pulls the decision; absent → internal-only.
   */
  externalPort?: ChangeControlPort;
  /**
   * the tenant's autonomy dial (C1). Applied to every change-control pipeline so WHICH stages
   * require a human is config, not hardcoded. Defaults to assisted (the QA sign-off stays human).
   */
  autonomy?: AutonomyPolicy;
  /** bound each lane for tests/proofs; unbounded in the worker */
  maxTicksPerLane?: number;
};

export type OrgCadenceHandle = {
  stop: () => void;
  done: Promise<unknown>;
};

export function composeOrgCadenceLoops(input: ComposeOrgCadenceInput): OrgCadenceHandle {
  const intervals = input.intervals ?? OrgCadenceIntervalDefault;
  const orgEvents = createCockroachOrgEventStore({ executor: input.executor });
  const memoryState = createCockroachMemoryStateStore({ executor: input.executor });
  const changeSets = createCockroachChangeSetStore({ executor: input.executor });
  const docUnits = createCockroachDocUnitStore({ executor: input.executor });
  const policy = buildDefaultChangeControlPolicy(input.organizationId);
  const appendEvent = (e: Parameters<typeof orgEvents.append>[0]) => orgEvents.append(e);

  // real intake by default: claim a `proposed` initiative from Cockroach (dequeue-once);
  // the worker idles only when nothing is proposed — no synthetic flood, no manual runner.
  const intake =
    input.intake ??
    createCockroachWorkIntakeSource({
      executor: input.executor,
      organizationId: input.organizationId,
      nowIso: () => new Date(input.now()).toISOString(),
    });
  const workOs = createWorkOsCadenceLane({
    organizationId: input.organizationId, hats: buildHatDefinitions(), now: input.now, createId: input.createId, appendEvent,
    intake,
  });
  const memory = createMemoryMaintenanceCadenceLane({
    organizationId: input.organizationId, now: input.now, createId: input.createId,
    reader: memoryState, writer: memoryState, appendEvent,
  });
  // the autonomy dial as config (C1): apply the tenant policy to every resolved pipeline
  const autonomy: AutonomyPolicy = input.autonomy ?? { level: AutonomyLevel.Assisted, humanGatedStageIds: ["human-qa-signoff"] };
  const changeControl = createChangeControlCadenceLane({
    organizationId: input.organizationId, now: input.now, createId: input.createId,
    reader: changeSets, writer: changeSets,
    pipelineFor: (cs) => applyAutonomyPolicy(policy.pipelines[cs.pipelineId] ?? buildInternalOnlyPipeline(input.organizationId), autonomy),
    appendEvent,
    ...(input.externalPort ? { externalPort: input.externalPort } : {}),
  });
  const docMaintenance = createDocMaintenanceCadenceLane({
    organizationId: input.organizationId, now: input.now, createId: input.createId,
    reader: docUnits, writer: docUnits, appendEvent,
  });

  const stopped = { value: false };
  const isStopRequested = () => stopped.value;
  const start = (lane: CadenceLane, intervalMs: number): Promise<unknown> =>
    runCadenceLane({
      lane, intervalMs, isStopRequested,
      sleep: (ms) => input.sleep(ms, isStopRequested), // sleep + loop check share ONE stop flag
      ...(input.observer ? { observer: input.observer } : {}),
      ...(input.maxTicksPerLane !== undefined ? { maxTicks: input.maxTicksPerLane } : {}),
    });

  const done = Promise.all([
    start(workOs, intervals.workOsMs),
    start(memory, intervals.memoryMaintenanceMs),
    start(changeControl, intervals.changeControlMs),
    start(docMaintenance, intervals.docMaintenanceMs),
  ]);

  return { stop: () => { stopped.value = true; }, done };
}
