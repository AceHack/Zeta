/**
 * weak-point.ts — the organization noticing what is wrong with ITSELF, in a type agents can reason
 * over.
 *
 * ── THE DOC ──────────────────────────────────────────────────────────────────
 * `OBSERVABILITY_AND_SELF_HEALING.md` §"Weak-Point Indicators" opens with the requirement:
 *
 *   > Weak points should be **typed so agents can reason over them without parsing prose**.
 *
 * gives eight, and closes with the sentence that is the whole safety property:
 *
 *   > The next action is still routed through the supervisor chain or normal work commands; the
 *   > indicator **does not bypass hierarchy, policy, or review**.
 *
 * ── THIS IS A CLASSIFIER, NOT A NINTH DETECTOR ───────────────────────────────
 * The register already measures most of what the eight describe: `lag-detection.ts` sweeps for
 * stalls, `inefficiency.ts` counts recurrence across items, `quality-gate.ts` knows which approvals
 * went unattested, `providers.ts` knows which seams are simulated. Building a second set of
 * measurements would produce two answers to the same question and no way to tell which is stale.
 *
 * So this folds what exists into the doc's vocabulary, and the fold is where the value is: an agent
 * reasoning about "is this local, team-level, or platform-level" needs ONE taxonomy, not five
 * report shapes.
 *
 * ── THE SUGGESTED ACTION CANNOT BE A MUTATION ────────────────────────────────
 * The doc's safety sentence is enforced in the TYPE rather than in a comment: a `SuggestedAction`
 * is a signal through the chain or a work command, and there is no third case. An indicator that
 * wanted to say "restart the runner" has no way to spell it.
 *
 * That matters because self-healing is exactly where a system talks itself into acting directly —
 * the problem is visible, the fix is obvious, and the chain looks like ceremony. It is not: the
 * chain is what makes the repair auditable, and a repair nobody can audit is indistinguishable
 * from drift.
 */

import type { EvidenceRef } from "./discussion-anchor";
import type { Inefficiency } from "./inefficiency";
import { type LagReport, LagKind } from "./lag-detection";
import { Fidelity, type Port } from "./providers";
import type { GateEvaluation } from "./quality-gate";
import { SignalTool } from "./supervisor-signal";

/** The doc's eight, in its own order. */
export const WeakPoint = {
  /** Work cannot proceed without supervisor triage, dependency, or input. */
  BlockedWork: "blocked_work",
  /** A queue, gate, review, or escalation is exceeding its SLO. */
  SlowTriage: "slow_triage",
  /** The same workflow, test, run, or gate is failing repeatedly. */
  RepeatedFailure: "repeated_failure",
  /** A reviewer or agent cannot prove that acceptance criteria were met. */
  MissingEvidence: "missing_evidence",
  /** The hat lacks a safe existing tool or prompt flow for repeated work. */
  MissingTool: "missing_tool",
  /** Policy rejected an attempted action and needs triage or education. */
  PolicyDenied: "policy_denied",
  /** Agent runtime, MCP, prompt-flow, or orchestration harness broke. */
  HarnessFailure: "harness_failure",
  /** A required event, trace, metric, log, artifact, or link is missing. */
  TelemetryGap: "telemetry_gap",
} as const;

export type WeakPoint = (typeof WeakPoint)[keyof typeof WeakPoint];

/**
 * What to do about an indicator — and the only two shapes it may take.
 *
 * THE DOC'S SAFETY SENTENCE, AS A TYPE. There is no `{ kind: "repair" }`. An indicator that wanted
 * to restart a runner, widen a credential, or edit a policy has no way to say so, which is a
 * stronger guarantee than a rule somebody has to remember while looking at a broken system.
 */
export type SuggestedAction =
  /** Say it up the chain. The tool decides who — `routeSignal` derives the target, as always. */
  | { readonly kind: "signal"; readonly tool: SignalTool; readonly ask: string }
  /** Put it in the backlog as ordinary work, which is then assigned, gated and reviewed. */
  | { readonly kind: "work_item"; readonly title: string; readonly why: string };

export interface WeakPointIndicator {
  readonly kind: WeakPoint;
  /** One line, for a human or an agent that is not going to read the evidence. */
  readonly summary: string;
  readonly suggested: SuggestedAction;
  /** What can be checked. An indicator pointing at nothing is an opinion about the system. */
  readonly evidence: readonly EvidenceRef[];
}

/**
 * What the register already measured.
 *
 * EVERY FIELD OPTIONAL, and absent means the indicators derived from it are simply not produced.
 * Same discipline as `lag-detection.ts`, and for the same reason — but note the difference this
 * time: `classifyWeakPoints` does NOT report what it could not classify, because unlike a sweep it
 * makes no claim to be complete. It says what the supplied measurements imply and nothing about
 * what was not measured, which is why the caller has to be the one holding that question.
 */
export interface WeakPointInput {
  /** From `detectLag`. */
  readonly lag?: LagReport;
  /** From `findInefficiencies`. */
  readonly inefficiencies?: readonly Inefficiency[];
  /** Gate approvals that carried no evidence — from `unattestedApprovals`. */
  readonly unattestedApprovals?: readonly GateEvaluation[];
  /** Refusals the organization produced, verbatim. */
  readonly refusals?: readonly string[];
  /** Which seam each port is currently on. */
  readonly portFidelity?: ReadonlyMap<Port, Fidelity>;
  /** Ports the run expected to be real. A simulated one among these is a gap in what was observed. */
  readonly portsExpectedReal?: readonly Port[];
  /** Work a hat did by hand more than once because no tool existed for it. */
  readonly manualRepeats?: readonly { readonly hatId: string; readonly what: string; readonly times: number }[];
}

/**
 * How many times a hat must do the same thing by hand before it is a MISSING TOOL.
 *
 * TWO. Once is a task. Twice is the shape the doc means by *"a safe existing tool or prompt flow
 * for repeated work"* — and the same unit as everywhere else in this register: distinct
 * occurrences, not a feeling that something was tedious.
 */
export const MANUAL_REPEAT_THRESHOLD = 2;

/** Which lag conditions are a stall, and which are a queue running slow. Nothing is both. */
const SLOW_TRIAGE_LAG: ReadonlySet<string> = new Set<string>([
  LagKind.QueueSaturated,
  LagKind.ReviewerMissing,
  LagKind.QaAssignmentMissing,
  LagKind.AssignmentOverdue,
]);

/**
 * Fold the register's measurements into the doc's eight.
 *
 * Ordered by indicator kind so two machines classifying the same organization produce the same
 * list — a self-healing loop that reads its own findings in a different order every run cannot tell
 * a new problem from a reshuffled one.
 */
export function classifyWeakPoints(input: WeakPointInput): readonly WeakPointIndicator[] {
  const out = [
    ...fromLag(input),
    ...fromInefficiencies(input),
    ...fromUnattestedApprovals(input),
    ...fromRefusals(input),
    ...fromPorts(input),
    ...fromManualRepeats(input),
  ];
  return [...out].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.summary === b.summary) return 0;
    return a.summary < b.summary ? -1 : 1;
  });
}

function fromLag(input: WeakPointInput): readonly WeakPointIndicator[] {
  return (input.lag?.findings ?? []).map((finding) => {
    const slow = SLOW_TRIAGE_LAG.has(finding.kind);
    return {
      kind: slow ? WeakPoint.SlowTriage : WeakPoint.BlockedWork,
      summary: finding.detail,
      suggested: {
        kind: "signal" as const,
        // A slow queue is a capacity ask; a stall is a blocker report. Both go UP, neither repairs.
        tool: slow ? SignalTool.RequestResource : SignalTool.ReportBlocker,
        ask: `${finding.kind} on '${finding.subjectId}' — ${finding.ownerHatId} owns it`,
      },
      evidence: [{ kind: "trace" as const, ref: `lag:${finding.kind}:${finding.subjectId}` }],
    };
  });
}

function fromInefficiencies(input: WeakPointInput): readonly WeakPointIndicator[] {
  return (input.inefficiencies ?? []).map((i) => ({
    kind: WeakPoint.RepeatedFailure,
    summary: i.summary,
    // The doc's own routing for this one: a repeatable inefficiency is a request to CHANGE THE
    // SYSTEM, which is `SuggestImprovement` — and it proposes nothing, exactly as `inefficiency.ts`
    // refuses to. Naming the fix from here would make that call from the bottom of the chain, with
    // the least context about what else is in flight.
    suggested: { kind: "signal" as const, tool: SignalTool.SuggestImprovement, ask: i.summary },
    evidence: i.workIds.map((id) => ({ kind: "trace" as const, ref: `recurred:${i.pattern}:${id}` })),
  }));
}

function fromUnattestedApprovals(input: WeakPointInput): readonly WeakPointIndicator[] {
  return (input.unattestedApprovals ?? []).map((g) => ({
    kind: WeakPoint.MissingEvidence,
    summary: `'${g.gate}' on '${g.workId}' was approved with nothing attached`,
    // NOT a signal. An approval nobody can check is a defect in the work, and the work item is
    // where a defect gets assigned, gated and reviewed like anything else.
    suggested: {
      kind: "work_item" as const,
      title: `attach evidence for '${g.gate}' on '${g.workId}'`,
      why: "the approval cannot be checked by anyone who was not in the room",
    },
    evidence: [{ kind: "trace" as const, ref: `gate:${g.workId}:${g.gate}` }],
  }));
}

function fromRefusals(input: WeakPointInput): readonly WeakPointIndicator[] {
  const out: WeakPointIndicator[] = [];
  for (const refusal of input.refusals ?? []) {
    const kind = refusalKind(refusal);
    if (kind === undefined) continue;
    out.push({
      kind,
      summary: refusal,
      suggested:
        kind === WeakPoint.PolicyDenied
          ? // The doc: policy denial "needs triage or education". Both are somebody's decision.
            { kind: "signal", tool: SignalTool.RequestDecision, ask: `policy refused: ${refusal}` }
          : { kind: "work_item", title: "repair the harness", why: refusal },
      evidence: [{ kind: "log", ref: refusal }],
    });
  }
  return out;
}

function fromPorts(input: WeakPointInput): readonly WeakPointIndicator[] {
  // A seam the run believed was real and is not has produced observations about nothing — the doc's
  // `telemetry_gap` in its most consequential form, because everything downstream of it is a
  // measurement of a stand-in. An UNRESOLVED port counts too: absence is not fidelity.
  return (input.portsExpectedReal ?? [])
    .filter((port) => input.portFidelity?.get(port) !== Fidelity.Real)
    .map((port) => ({
      kind: WeakPoint.TelemetryGap,
      summary: `'${port}' was expected to be real and is ${input.portFidelity?.get(port) ?? "unresolved"}`,
      suggested: {
        kind: "signal" as const,
        tool: SignalTool.ReportRisk,
        ask: `'${port}' is not reaching anything; every measurement downstream of it is of a stand-in`,
      },
      evidence: [{ kind: "trace" as const, ref: `port:${port}` }],
    }));
}

function fromManualRepeats(input: WeakPointInput): readonly WeakPointIndicator[] {
  return (input.manualRepeats ?? [])
    .filter((m) => m.times >= MANUAL_REPEAT_THRESHOLD)
    .map((m) => ({
      kind: WeakPoint.MissingTool,
      summary: `'${m.hatId}' did '${m.what}' by hand ${String(m.times)} times`,
      suggested: {
        kind: "signal" as const,
        tool: SignalTool.RequestResource,
        ask: `a tool or prompt flow for '${m.what}'`,
      },
      evidence: [{ kind: "trace" as const, ref: `manual:${m.hatId}:${m.what}` }],
    }));
}

/**
 * What KIND of failure a refusal is, or `undefined` when it is neither.
 *
 * Refusals are prose, so this reads them for the two shapes the doc distinguishes: a POLICY denial
 * (the organization decided no) and a HARNESS failure (something broke). Most refusals are neither
 * — a gate that legitimately failed, a steal with no trigger — and classifying those would turn
 * every working guard into a weak point, which is the fastest way to make the taxonomy ignored.
 */
function refusalKind(refusal: string): WeakPoint | undefined {
  const text = refusal.toLowerCase();
  if (text.includes("policy") || text.includes("not authorized") || text.includes("may not")) {
    return WeakPoint.PolicyDenied;
  }
  if (text.includes("could not run") || text.includes("crashed") || text.includes("unavailable") || text.includes("timed out")) {
    return WeakPoint.HarnessFailure;
  }
  return undefined;
}

/** Indicators of one kind. */
export function weakPointsOfKind(
  indicators: readonly WeakPointIndicator[],
  kind: WeakPoint,
): readonly WeakPointIndicator[] {
  return indicators.filter((i) => i.kind === kind);
}
