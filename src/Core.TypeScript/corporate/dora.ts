/**
 * corporate/dora.ts — the four DORA metrics, folded from what the organization actually did.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * `WorkflowEngine.fs` carries `DoraMetrics` as the status surface the whole agent loop is steered
 * by — the README calls it the *"DORA mandate — menu generator weights options by DORA
 * contribution"*. The corporate register produced runs, queues, gate verdicts and QA cycles and
 * computed none of it, so the menu had nothing to weigh.
 *
 * ── THE HONEST PART, AND IT IS THE POINT ─────────────────────────────────────
 * Two of the five fields CANNOT be computed from an org run as it stands, and the tempting move is
 * to return `0` for them and hand back a struct that looks fully measured.
 * `.claude/rules/toy-is-free-metered-must-be-earned.md` names that exactly: unlabelled work reads
 * as `metered` by default, and a zero is indistinguishable from a measurement of zero.
 *
 * So the derivation returns BOTH the metrics and the list of fields it could not measure, with the
 * reason. `isFullyMeasured` is the one-line question, and `metrics` alone is never the whole answer.
 * A caller that ignores `unmeasured` is making a claim the data does not support, and now that is a
 * thing it had to choose to do rather than a thing it fell into.
 *
 *   | field                 | measured? | from                                                |
 *   |-----------------------|-----------|-----------------------------------------------------|
 *   | deploymentCount       | yes       | shards that reached `Merged`                        |
 *   | leadTimeMedianSeconds | yes       | claim → completion, per claim                       |
 *   | changeFailureRate     | yes       | delivered work that failed QA or bounced a gate     |
 *   | mttrMedianSeconds     | **no**    | nothing records an incident, so nothing records its restore |
 *   | substrateRatio        | **no**    | the register has no lane taxonomy; `Lane` is a core type the org never assigns |
 *
 * ── MEDIAN, NOT MEAN ─────────────────────────────────────────────────────────
 * DORA's lead time and MTTR are medians in the original research (Forsgren, Humble & Kim,
 * *Accelerate*, 2018), and the difference is not pedantry: one item that sat in the queue over a
 * weekend moves a mean and does not move a median, so a mean would report a delivery problem the
 * organization does not have.
 *
 * Time arrives as `nowMs` and per-record timestamps — never read here, per
 * `.claude/rules/local-time-never-enters-the-shared-fold.md`.
 */

import { ClaimState, ShardState, type WorkQueue } from "./work-market";
import { isPassing, type GateEvaluation } from "./quality-gate";
import type { QaCycleReport } from "./qa";
import type { DoraMetrics } from "../protocol/agent-loop-contract";
import type { ClassificationResult } from "../dora-classify/classify";

/** A field the run could not measure, and why not. */
export interface UnmeasuredField {
  readonly field: keyof DoraMetrics;
  readonly why: string;
}

export interface DoraDerivation {
  readonly metrics: DoraMetrics;
  /** Empty only when every field was genuinely computed. */
  readonly unmeasured: readonly UnmeasuredField[];
}

export interface DoraInput {
  readonly queue: WorkQueue;
  readonly gateEvaluations: readonly GateEvaluation[];
  readonly qa: readonly QaCycleReport[];
  /**
   * The run's work, classified into lanes — supply it and `substrateRatio` becomes a measurement.
   *
   * Absent, the field stays in `unmeasured` with its reason. This is what keeps that list from
   * being a constant: it varies with what the caller could actually provide, so a test asserting
   * two unmeasured fields is asserting something about THIS run rather than about the source.
   */
  readonly classifications?: readonly ClassificationResult[];
  /**
   * Incidents and when each was restored — supply them and `mttrMedianSeconds` becomes a
   * measurement.
   *
   * This became expressible only once `Incident` was a work type of its own. While every inbound
   * kind collapsed onto `Task`, an incident was indistinguishable from a feature request the moment
   * it entered the cascade, so a restoration time had nothing to attach to and MTTR was not merely
   * unmeasured — it was unmeasurable in principle.
   */
  readonly incidents?: readonly IncidentWindow[];
}

/** One incident: when it was detected, and when service was restored (absent while still open). */
export interface IncidentWindow {
  readonly workId: string;
  readonly detectedAtMs: number;
  readonly restoredAtMs?: number;
}

/**
 * The median of a sample, or 0 for an empty one.
 *
 * An even-sized sample averages the two middle values rather than taking the lower — otherwise the
 * "median" of `[10, 20]` is 10, which is not a median and biases every even sample downward.
 */
export function median(values: readonly number[]): number {
  const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (finite.length === 0) return 0;
  const mid = Math.floor(finite.length / 2);
  if (finite.length % 2 === 1) return finite[mid] ?? 0;
  return ((finite[mid - 1] ?? 0) + (finite[mid] ?? 0)) / 2;
}

/**
 * Fold a run into DORA.
 *
 * Every number here is recomputed from records the organization wrote while working. None is a
 * counter something incremented alongside the work, because a counter can disagree with the thing
 * it counts and the disagreement is invisible — the counter is what gets read.
 */
export function deriveDora(input: DoraInput): DoraDerivation {
  const unmeasured: UnmeasuredField[] = [];

  // DEPLOYMENTS — work that reached the far end of the market. `Merged` and not `Completed`:
  // completing a claim finishes one agent's turn, merging is what ships.
  const deploymentCount = input.queue.shards.filter((s) => s.state === ShardState.Merged).length;

  // LEAD TIME — claim to completion, per claim, in seconds. Only claims that actually finished:
  // an expired or released claim measures an abandonment, not a delivery.
  const leadTimes: number[] = [];
  for (const claim of input.queue.claims) {
    if (claim.state !== ClaimState.Completed) continue;
    if (claim.releasedAtMs === undefined) continue;
    const seconds = (claim.releasedAtMs - claim.claimedAtMs) / 1000;
    if (seconds >= 0) leadTimes.push(seconds);
  }
  const leadTimeMedianSeconds = median(leadTimes);

  // CHANGE FAILURE RATE — of the work that was delivered, how much failed on the way.
  // Counted per WORK ITEM rather than per event: five rejections on one item is one item that had
  // trouble, and counting events would let a single churning item exceed a rate of 1.
  const delivered = new Set(
    input.queue.shards.filter((s) => s.state === ShardState.Merged).map((s) => s.workId),
  );
  const failedItems = new Set<string>();
  for (const evaluation of input.gateEvaluations) {
    if (!isPassing(evaluation.outcome) && delivered.has(evaluation.workId)) failedItems.add(evaluation.workId);
  }
  for (const cycle of input.qa) {
    for (const id of cycle.failedFeatureIds) if (delivered.has(id)) failedItems.add(id);
    for (const regression of cycle.regressions) {
      const id = regression.testCaseId;
      if (delivered.has(id)) failedItems.add(id);
    }
  }
  const changeFailureRate = delivered.size === 0 ? 0 : failedItems.size / delivered.size;

  // MTTR — the median time from detection to restoration, over incidents that were RESTORED.
  //
  // An incident still open has no restoration time, and treating it as zero would say the outage
  // was fixed instantly at the exact moment it is doing the most damage. Excluded from the sample
  // and reported separately instead.
  let mttrMedianSeconds = 0;
  const incidents = input.incidents ?? [];
  const restored = incidents.filter((i) => i.restoredAtMs !== undefined && i.restoredAtMs >= i.detectedAtMs);
  if (restored.length === 0) {
    unmeasured.push({
      field: "mttrMedianSeconds",
      why:
        incidents.length === 0
          ? "no incident was recorded in this run, so no restoration could be timed"
          : `${incidents.length} incident(s) recorded, none restored yet — an open incident has no restoration time`,
    });
  } else {
    mttrMedianSeconds = median(restored.map((i) => ((i.restoredAtMs ?? 0) - i.detectedAtMs) / 1000));
  }

  // SUBSTRATE RATIO — measurable exactly when the work has been classified into lanes.
  //
  // The share that is NOT operational: substrate work is everything that is not shipping. The
  // classifier's own rule decides what counts as operational, including its partial credit for a
  // mixed commit that touched operational paths — reimplementing that here would produce a second
  // definition of the word that agrees until it does not.
  let substrateRatio = 0;
  const classified = input.classifications;
  if (classified === undefined || classified.length === 0) {
    unmeasured.push({
      field: "substrateRatio",
      why:
        classified === undefined
          ? "no work was classified into lanes, so there is no operational/substrate split"
          : "the classification was empty, so no work could be attributed to a lane",
    });
  } else {
    const operational = classified.filter(
      (c) => c.lane === "operational" || (c.lane === "mixed" && c.distinctLanes.includes("operational")),
    ).length;
    substrateRatio = (classified.length - operational) / classified.length;
  }

  return {
    metrics: {
      deploymentCount,
      leadTimeMedianSeconds,
      changeFailureRate,
      mttrMedianSeconds,
      substrateRatio,
    },
    unmeasured,
  };
}

/** Did every field come from data? Almost always false, and that is the honest answer. */
export function isFullyMeasured(derivation: DoraDerivation): boolean {
  return derivation.unmeasured.length === 0;
}

/** One line per field, saying which are measurements and which are placeholders. */
export function renderDora(derivation: DoraDerivation): readonly string[] {
  const unmeasured = new Map(derivation.unmeasured.map((u) => [u.field, u.why]));
  const line = (field: keyof DoraMetrics, shown: string): string => {
    const why = unmeasured.get(field);
    return why === undefined ? `${field}: ${shown}` : `${field}: UNMEASURED (${why})`;
  };
  const m = derivation.metrics;
  return [
    line("deploymentCount", String(m.deploymentCount)),
    line("leadTimeMedianSeconds", `${m.leadTimeMedianSeconds.toFixed(1)}s`),
    line("changeFailureRate", `${(m.changeFailureRate * 100).toFixed(0)}%`),
    line("mttrMedianSeconds", `${m.mttrMedianSeconds.toFixed(1)}s`),
    line("substrateRatio", m.substrateRatio.toFixed(2)),
  ];
}
