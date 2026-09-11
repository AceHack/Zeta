/**
 * lag-signals.ts — turning a lag finding into the signal the doc asks for.
 *
 * `WORK_AND_RELEASE_MANAGEMENT_OS.md`: *"Each condition should produce a **signal, not a hidden log
 * line**."* `lag-detection.ts` produces findings; on their own those are the log line. This is the
 * other half: each finding becomes a durable, addressed, evidenced `SupervisorSignal` that joins
 * the organization's own list, so the hat that owns it sees it on its next tick.
 *
 * ── WHY THESE DO NOT GO THROUGH `routeSignal` ────────────────────────────────
 * `sendSupervisorSignal` derives a target from WHO IS SENDING — an agent names the tool and the
 * chart names the recipient, which is what stops an agent shopping for an agreeable answerer. That
 * is the right rule for a signal a hat sends.
 *
 * A lag finding has no sender. It is the organization observing itself, and its target is already
 * derived — from WHAT THE PROBLEM IS, through the same `blocker-taxonomy.ts` roster. Pushing it
 * through the sender's chain would send every finding to one observer's supervisor and lose the
 * routing that was the point.
 *
 * So the discipline holds and is reached by a different relation, exactly as `blocker_owner` does:
 * **routing is derived, never chosen.** What must not happen — and what a test pins — is a caller
 * being able to name the recipient.
 *
 * ── THE OBSERVER IS NAMED ────────────────────────────────────────────────────
 * A signal needs a sender for the record to mean anything, so the sweep is attributed to an
 * explicit observer hat rather than to a blank. "The system noticed" is how an accountability trail
 * ends at nobody.
 */

import type { OrgChart } from "./org-chart";
import { type LagFinding, type LagReport, LagKind } from "./lag-detection";
import { evidenceSatisfies, SignalTool, type SupervisorSignal } from "./supervisor-signal";
import type { EvidenceRef } from "./discussion-anchor";

/**
 * The tool each condition speaks through.
 *
 * `ReportRisk` for most: the organization is telling a hat that something it owns is going wrong,
 * which is a risk before it is anything else. Two exceptions, and both are about what the recipient
 * is being asked to DO:
 *
 *   - a saturated queue and idle reserved supply are RESOURCE problems — the ask is capacity, and
 *     `RequestResource` is the tool the organization already has for that;
 *   - an unanswered blocker owner is an ESCALATION by construction: somebody was asked, did not
 *     answer, and the finding is addressed past them.
 */
const TOOL_FOR: Readonly<Record<LagKind, SignalTool>> = {
  [LagKind.UnassignedReadyWork]: SignalTool.ReportRisk,
  [LagKind.ExpiredAssignmentToken]: SignalTool.ReportRisk,
  [LagKind.AssignmentSilent]: SignalTool.ReportRisk,
  [LagKind.UnboundRun]: SignalTool.ReportRisk,
  [LagKind.ReservedSupplyIdle]: SignalTool.RequestResource,
  [LagKind.ReviewerMissing]: SignalTool.ReportRisk,
  [LagKind.QaAssignmentMissing]: SignalTool.ReportRisk,
  [LagKind.ReleaseEvidenceMissing]: SignalTool.ReportRisk,
  [LagKind.BlockerOwnerSilent]: SignalTool.RequestEscalation,
  [LagKind.QueueSaturated]: SignalTool.RequestResource,
  [LagKind.RepeatedReassignment]: SignalTool.ReportRisk,
  [LagKind.AssignmentOverdue]: SignalTool.ReportRisk,
};

/**
 * What KIND of evidence each condition offers.
 *
 * Not decoration: `SIGNAL_POLICY` accepts different evidence per tool, and `RequestResource` takes
 * `measurement` or `document` and REFUSES a trace. The first version of this module attached a
 * trace to everything, which produced two signals the organization would have thrown away — found
 * by a test asserting the sweep never manufactures a refusable signal.
 *
 * And the mapping is honest rather than convenient: a saturated queue and an idle reservation ARE
 * measurements — a depth against a capacity, an age against an SLA. The rest are traces, pointers
 * to a thing that happened.
 */
const EVIDENCE_KIND_FOR: Readonly<Record<LagKind, EvidenceRef["kind"]>> = {
  [LagKind.UnassignedReadyWork]: "trace",
  [LagKind.ExpiredAssignmentToken]: "trace",
  [LagKind.AssignmentSilent]: "trace",
  [LagKind.UnboundRun]: "trace",
  [LagKind.ReservedSupplyIdle]: "measurement",
  [LagKind.ReviewerMissing]: "trace",
  [LagKind.QaAssignmentMissing]: "trace",
  [LagKind.ReleaseEvidenceMissing]: "trace",
  [LagKind.BlockerOwnerSilent]: "trace",
  [LagKind.QueueSaturated]: "measurement",
  [LagKind.RepeatedReassignment]: "trace",
  [LagKind.AssignmentOverdue]: "trace",
};

export interface LagSignalInput {
  /** The hat the sweep is attributed to. A signal from nobody is a trail that ends at nobody. */
  readonly observerHatId: string;
  readonly atMs: number;
  readonly createId: (prefix: string) => string;
  /** The anchor these hang from — the doc's "no discussion may be unanchored". */
  readonly anchorId: string;
}

export type LagSignalResult =
  | { readonly ok: true; readonly signals: readonly SupervisorSignal[] }
  | { readonly ok: false; readonly reason: string };

/**
 * Every finding, as a signal addressed to the hat that owns it.
 *
 * REFUSES rather than dropping a finding it cannot address: an observer hat the chart does not have
 * makes every signal unattributable, and a finding whose owner is absent would be a signal sent
 * nowhere. Both are the silent-loss shape this whole sweep exists to remove, and losing a lag
 * finding to a bad id would be the detector failing in exactly the way it detects.
 */
export function lagSignals(chart: OrgChart, report: LagReport, input: LagSignalInput): LagSignalResult {
  const observer = chart.byId.get(input.observerHatId);
  if (observer === undefined) {
    return { ok: false, reason: `unknown observer hat '${input.observerHatId}'` };
  }
  const signals: SupervisorSignal[] = [];
  for (const finding of report.findings) {
    const target = chart.byId.get(finding.ownerHatId);
    if (target === undefined) {
      return { ok: false, reason: `'${finding.kind}' names owner '${finding.ownerHatId}', which this chart does not have` };
    }
    const evidence: readonly EvidenceRef[] = [
      // The subject IS the evidence: a lag report naming nothing checkable is an opinion.
      { kind: EVIDENCE_KIND_FOR[finding.kind], ref: `lag:${finding.kind}:${finding.subjectId}` },
    ];
    const tool = TOOL_FOR[finding.kind];
    // THE SWEEP CHECKS ITS OWN OUTPUT against the rule that would reject it downstream. A signal
    // built here and refused there is a finding lost between two modules that each did their job,
    // which is the quietest way this whole mechanism could fail.
    if (!evidenceSatisfies(tool, evidence)) {
      return { ok: false, reason: `'${finding.kind}' would send '${tool}' evidence the policy refuses` };
    }
    signals.push({
      signalId: input.createId("lag"),
      fromHatId: observer.id,
      fromLevel: observer.level,
      toHatId: target.id,
      toLevel: target.level,
      tool,
      // The KIND is the title, because that is the field routing and grouping read as the scope —
      // the same choice `org-observe-bridge` makes for a classified blocker.
      title: finding.kind,
      message: finding.detail,
      evidence,
      atMs: input.atMs,
      anchorId: input.anchorId,
      ...(isWorkSubject(finding) ? { workItemId: finding.subjectId } : {}),
    });
  }
  return { ok: true, signals };
}

/**
 * Whether this finding's subject is a work item.
 *
 * Three of the twelve are not: a run id, a hat id, and a queue name. Putting those in `workItemId`
 * would make a queue look like a task to everything downstream that groups by it.
 */
function isWorkSubject(finding: LagFinding): boolean {
  return (
    finding.kind !== LagKind.UnboundRun &&
    finding.kind !== LagKind.ReservedSupplyIdle &&
    finding.kind !== LagKind.QueueSaturated
  );
}

/** Signals addressed to one hat. */
export function lagSignalsFor(signals: readonly SupervisorSignal[], hatId: string): readonly SupervisorSignal[] {
  return signals.filter((s) => s.toHatId === hatId);
}
