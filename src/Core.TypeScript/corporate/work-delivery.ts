/**
 * work-delivery.ts — running the pipeline for ONE work item, because an agent picked it.
 *
 * ── THE GAP THIS CLOSES, STATED PLAINLY ──────────────────────────────────────
 * The pipeline could take a ticket to a merged MR, and the agent loop could choose real work off a
 * real cascade, and the two **met at the surface and not at the return**. An agent's `PickWork`
 * caused nothing:
 *
 *   run-agent.ts   supplied no dispatcher at all — the state machine advanced to `ExecutingWork`
 *                  and the work was never done and never reported done
 *   run-org.ts     supplied `{ success: true, doraContribution: 0.5 }`, and later a lookup into
 *                  the report of a pipeline that had ALREADY run
 *
 * The second is the subtler one and it was mine. Replacing a hardcoded success with a *reading* of
 * an earlier run still leaves the agent's decision decorative: the pipeline ran because the runtime
 * iterated its own list, and the agent's choice was consulted by nobody. A dispatcher that reports
 * an outcome it did not cause is a narrower version of the same lie.
 *
 * ── SO THIS IS THE VERB ──────────────────────────────────────────────────────
 * `deliverWorkItem` opens a change, walks the pipeline for that node, and merges what passed. It is
 * the whole delivery for one item, and it is what a chosen slot DOES. Both CLIs call it, so there
 * is one definition of "deliver a work item" rather than two that agree today.
 *
 * ── WHAT IT REFUSES TO PRETEND ───────────────────────────────────────────────
 * Every failure is a distinct, reported outcome rather than a false negative:
 *
 *   the change would not open    nothing was attempted; not a failed delivery
 *   a producer refused           the pipeline stopped AT a phase, and the phase is named
 *   a gate rejected              the work was judged and did not pass — a real failure
 *   the merge refused            the gates passed and the repository disagrees; `landed` is false
 *                                even though `complete` is true, and both are reported
 *
 * `doraContribution` is 1 only when the change actually MERGED. Gates passing over a merge the port
 * refused is precisely the disagreement `changesUnlanded` exists to catch, and scoring it as
 * delivered would launder that disagreement into a metric.
 */

import type { OrgChart } from "./org-chart";
import type { CascadeNode } from "./goal-cascade";
import { GateKind, type GateEvaluation, GateOutcome } from "./quality-gate";
import { runPipeline, type Artifact, type Pipeline } from "./pipeline";
import type { ProviderSet, ReviewVerdict } from "./providers";
// The chooser is the RUNTIME'S definition, imported rather than rewritten. A second chooser that
// agreed today would be a second place for "runtime validation is decided by the evidence" to drift
// out of. The dependency runs one way — org-runtime must never import this module, or the pair
// becomes a cycle; if the runtime is ever wired to `deliverWorkItem`, move `gateChooserFrom` to a
// neutral home first.
import { gateChooserFrom } from "./org-runtime";

/** What one delivery needs. Everything injected: no ambient providers, no ambient clock. */
export interface DeliveryInput {
  readonly chart: OrgChart;
  readonly node: CascadeNode;
  readonly pipeline: Pipeline;
  readonly providers: ProviderSet;
  readonly atMs: number;
  /** The hat that did the work, so no gate is evaluated by its author. */
  readonly proposerHatId: string;
  /** Branch name for the change. Defaults to `work/<workId>`. */
  readonly branch?: string;
  /** Evidence for gates whose producer is not the source of it — the test runs, typically. */
  readonly extraEvidenceFor?: (gate: GateKind) => readonly string[];
  /**
   * The TEST verdict, which decides `runtime_validation` — and it is REQUIRED.
   *
   * Not optional with a default, in either direction. Defaulting to approval would let an item
   * with no tests pass the one gate whose verdict is earned rather than opined; defaulting to
   * rejection would silently block every caller that forgot it, which reads as a broken pipeline
   * rather than a missing argument. Making it required means a delivery cannot happen without
   * someone stating what the tests said.
   */
  readonly qaVerdict: { readonly outcome: GateOutcome; readonly reason: string };
}

/**
 * What a delivery DID — every field measured, none assumed.
 *
 * `complete` and `landed` are separate because they answer different questions. The gates passing
 * is the organization's verdict; the merge succeeding is the repository's. When they disagree the
 * disagreement is the finding, and collapsing them into one boolean would destroy it.
 */
export interface DeliveryOutcome {
  readonly workId: string;
  /** Every gate crossed the pipeline judged. */
  readonly complete: boolean;
  /** The change-control port actually merged it. */
  readonly landed: boolean;
  /** The phase the pipeline stopped at, when it stopped. */
  readonly blockedAt: GateKind | undefined;
  readonly evaluations: readonly GateEvaluation[];
  readonly evidenceRefs: readonly string[];
  readonly refusals: readonly string[];
  readonly summary: string;
  /**
   * What landed, measured. 1 only on a real merge.
   *
   * Never a constant, and never derived from the gates alone: gates passing over a merge the port
   * refused is the organization and the repository disagreeing, and scoring that as delivered
   * would launder the disagreement into a number.
   */
  readonly doraContribution: number;
}

/**
 * Deliver one work item: open a change, walk the pipeline, merge what passed.
 *
 * The reviewer is asked through the pipeline's `prepare` hook — after each phase produced, before
 * its gate is judged — so a reviewer never judges a thing that does not exist yet. That ordering is
 * the pipeline's contract and this function does not get to weaken it.
 */
export async function deliverWorkItem(input: DeliveryInput): Promise<DeliveryOutcome> {
  const workId = input.node.workId;
  const refusals: string[] = [];
  const branch = input.branch ?? `work/${workId}`;

  // ── THE CHANGE IS OPENED FIRST ──────────────────────────────────────────
  // Producers write inside it, so the branch has to exist before the first phase runs.
  const opened = await input.providers.change.open(input.node, { branch });
  if (!opened.ok) {
    // NOTHING WAS ATTEMPTED. Distinct from a failed delivery, and the summary says which — an
    // agent told "your work failed" when no branch could be made would look for a defect in the
    // work rather than in the change-control port.
    return {
      workId,
      complete: false,
      landed: false,
      blockedAt: undefined,
      evaluations: [],
      evidenceRefs: [],
      refusals: [`change control '${input.providers.change.meta.name}' could not open ${branch}: ${opened.reason}`],
      summary: `no change could be opened for ${workId}; nothing was attempted`,
      doraContribution: 0,
    };
  }
  const handle = opened.value;

  // The reviewer's verdicts, gathered at the right moment and read synchronously by the chooser.
  const reviewed = new Map<GateKind, ReviewVerdict>();
  const reviewEvidence = new Map<GateKind, readonly string[]>();
  const askTheReviewer = async (
    gate: GateKind,
    produced: Artifact | undefined,
    soFar: ReadonlyMap<GateKind, Artifact>,
  ): Promise<void> => {
    // WHAT THIS PHASE MADE, PLUS THE TRAIL BEHIND IT. A late reviewer judging only its own phase
    // would be nearly as blind as one judging from a title.
    const trail = [...soFar.values()].flatMap((a) => a.refs);
    const shown = [...new Set([...(produced?.refs ?? []), ...trail])];
    const verdict = await input.providers.review.review({
      gate,
      workId,
      evidence: shown.map((ref) => ({ kind: "document" as const, ref })),
    });
    if (!verdict.ok) {
      // A REVIEW THAT COULD NOT BE OBTAINED IS NOT AN APPROVAL. "Nobody was available to review
      // this" and "this was reviewed and approved" are two sentences an organization must never
      // confuse, and defaulting the unavailable one to approval is how a gate becomes decorative.
      refusals.push(`review '${input.providers.review.meta.name}' on ${gate} for ${workId}: ${verdict.reason}`);
      reviewed.set(gate, { outcome: GateOutcome.Rejected, reason: `not reviewed: ${verdict.reason}` });
      return;
    }
    reviewed.set(gate, verdict.value);
    reviewEvidence.set(gate, verdict.evidence.map((e) => e.ref));
  };

  // Synchronous, per the menu discipline: it READS what `askTheReviewer` already put in place. The
  // first draft here guessed the current gate from map insertion order, which is not the gate being
  // judged — it is the last one a reviewer answered for. The runtime's chooser reads the gate out
  // of the decision CONTEXT, which is the only place it is actually stated.
  const chooser = gateChooserFrom(reviewed, input.qaVerdict);

  const walked = await runPipeline(input.chart, {
    workId,
    node: input.node,
    pipeline: input.pipeline,
    chooser,
    atMs: input.atMs,
    proposerHatId: input.proposerHatId,
    handle,
    prepare: askTheReviewer,
    extraEvidenceFor: (gate) => [
      ...(reviewEvidence.get(gate) ?? []),
      ...(input.extraEvidenceFor?.(gate) ?? []),
    ],
  });
  refusals.push(...walked.refusals);

  const evidenceRefs = [
    ...new Set([
      ...[...walked.artifacts.values()].flatMap((a) => a.refs),
      ...walked.evaluations.flatMap((e) => e.evidenceRefs),
    ]),
  ];

  if (!walked.complete) {
    return {
      workId,
      complete: false,
      landed: false,
      blockedAt: walked.blockedAt,
      evaluations: walked.evaluations,
      evidenceRefs,
      refusals,
      summary: `${workId} stopped at '${walked.blockedAt ?? "an unnamed phase"}' after ${String(walked.evaluations.length)} gate verdict(s)`,
      doraContribution: 0,
    };
  }

  // ── AND THEN THE PORT MAKES IT TRUE SOMEWHERE REAL ──────────────────────
  const landed = await input.providers.change.merge(handle);
  if (!landed.ok) {
    // THE GATES PASSED AND THE REPOSITORY DISAGREES. Reported as both — complete and not landed —
    // because that disagreement is the one thing change control exists to catch.
    refusals.push(
      `change control '${input.providers.change.meta.name}' could not merge ${handle.branch}: ${landed.reason}`,
    );
    return {
      workId,
      complete: true,
      landed: false,
      blockedAt: undefined,
      evaluations: walked.evaluations,
      evidenceRefs,
      refusals,
      summary: `${workId} passed every gate and did NOT merge: ${landed.reason}`,
      doraContribution: 0,
    };
  }

  return {
    workId,
    complete: true,
    landed: true,
    blockedAt: undefined,
    evaluations: walked.evaluations,
    evidenceRefs: [...new Set([...evidenceRefs, `merge:${handle.branch}`])],
    refusals,
    summary: `${workId} passed ${String(walked.evaluations.length)} gate(s) and merged on ${handle.branch}`,
    doraContribution: 1,
  };
}
