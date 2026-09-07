/**
 * observation-sources.ts — the nine local vocabularies, read into one.
 *
 * ── WHY ADAPTERS AND NOT A REWRITE ───────────────────────────────────────────
 * Each module's own word is RIGHT IN ITS CONTEXT. `notChecked` says the sweep skipped a condition;
 * `not_recorded` says nobody tracked what an agent tried; `UNDERIVED_EDGE_KINDS` says a whole
 * relationship class is uncomputable here. Flattening those into one word at the source would lose
 * information the local reader needs.
 *
 * What was missing is the GLOBAL question — *how much of this report is silence?* — which had to be
 * asked nine times by somebody who already knew all nine existed. These adapters answer it once,
 * without taking anything away from the modules.
 *
 * ── THE ADAPTERS ARE DERIVED, WHICH IS WHAT STOPS THEM DRIFTING ──────────────
 * Every one reads a field the source module already computes from its own structure — `LagReport`'s
 * `checked`/`notChecked` come from its detector table, `UNDERIVED_EDGE_KINDS` is that module's own
 * constant. So a module that adds a condition is reflected here without anybody editing this file.
 *
 * The one place that could drift is a module whose coverage is not represented in its own output.
 * That is exactly the defect being fixed, and it now has a name: such a module contributes
 * `no_detector`, and the ledger reports it rather than omitting it.
 */

import { OmissionKind, type ContextPack } from "./context-pack";
import { type HandoffBrief } from "./handoff-brief";
import { LagKind, type LagReport } from "./lag-detection";
import { ObservationState, type Observation } from "./observation-ledger";
import { EdgeKind, UNDERIVED_EDGE_KINDS, type OrgGraph } from "./org-graph";
import { Fidelity, type Port } from "./providers";
import { partyOf, type ReconciliationReport } from "./reconciliation";

/**
 * The twelve anti-stall conditions, as twelve questions.
 *
 * Derived from the report's own `checked`/`notChecked`, so a thirteenth condition appears here the
 * moment `lag-detection` grows one.
 */
export function fromLagReport(report: LagReport): readonly Observation[] {
  const out: Observation[] = [];
  for (const kind of report.checked) {
    out.push({
      subject: "lag-detection",
      question: kind,
      state: ObservationState.Observed,
      findings: report.findings.filter((f) => f.kind === kind).length,
    });
  }
  for (const kind of report.notChecked) {
    out.push({
      subject: "lag-detection",
      question: kind,
      state: ObservationState.NotRun,
      findings: 0,
      why: whyLagNotRun(kind),
    });
  }
  return out;
}

/** What each unswept condition was missing. Named, because "not run" without a why is the defect. */
function whyLagNotRun(kind: LagKind): string {
  switch (kind) {
    case LagKind.UnassignedReadyWork:
      return "no cascade was supplied";
    case LagKind.ExpiredAssignmentToken:
      return "no assignments were supplied";
    case LagKind.AssignmentSilent:
      return "assignments or a silence SLA were not supplied";
    case LagKind.UnboundRun:
      return "no runs were supplied";
    case LagKind.ReservedSupplyIdle:
      return "reserved supply or a reservation SLA were not supplied";
    case LagKind.ReviewerMissing:
      return "no review queue was supplied";
    case LagKind.QaAssignmentMissing:
      return "no QA queue was supplied";
    case LagKind.ReleaseEvidenceMissing:
      return "no release candidates were supplied";
    case LagKind.BlockerOwnerSilent:
      return "blocked work or a silence SLA were not supplied";
    case LagKind.QueueSaturated:
      return "no queue depths were supplied";
    case LagKind.RepeatedReassignment:
      return "no reassignment counts were supplied";
    case LagKind.AssignmentOverdue:
      return "assignments or an expected duration were not supplied";
  }
  return "the sweep did not say";
}

/**
 * Each party the delivery reconciler could have compared against.
 *
 * `reconciliation.ts` was the first module in this register to keep `notChecked` separate from
 * clean, and it is the reason the discipline exists at all.
 */
export function fromReconciliation(report: ReconciliationReport): readonly Observation[] {
  const out: Observation[] = [];
  for (const party of report.checked) {
    out.push({
      subject: "reconciliation",
      question: party,
      state: ObservationState.Observed,
      // Attributed by KIND, via `reconciliation.partyOf` — the mapping lives there so this
      // adapter cannot hold a second copy that drifts when a kind is added.
      findings: report.disagreements.filter((d) => partyOf(d.kind) === party).length,
    });
  }
  for (const party of report.notChecked) {
    out.push({
      subject: "reconciliation",
      question: party,
      state: ObservationState.NotRun,
      findings: 0,
      why: `'${party}' was never consulted, so its agreement is unknown rather than confirmed`,
    });
  }
  return out;
}

/**
 * What a hat's context pack could not reach.
 *
 * A pack's `omissions` are exactly its blind spots. `NoBuilderWired` is the one that is a system
 * gap rather than a run gap — nothing was built to retrieve, which is `no_detector` and not
 * `not_run`, and the difference is what a backlog needs to prioritise them apart.
 */
export function fromContextPack(pack: ContextPack): readonly Observation[] {
  const out: Observation[] = [
    {
      subject: "context-pack",
      question: `retrieval:${pack.hatId}`,
      state: pack.degraded ? ObservationState.NotRun : ObservationState.Observed,
      findings: pack.degraded ? 0 : pack.items.length,
      ...(pack.degraded ? { why: `${String(pack.omissions.length)} omission(s) in this hat's pack` } : {}),
    },
  ];
  for (const o of pack.omissions) {
    out.push({
      subject: "context-pack",
      question: `${o.kind}:${o.about}`,
      state: o.kind === OmissionKind.NoBuilderWired ? ObservationState.NoDetector : ObservationState.NotRun,
      findings: 0,
      why: o.why,
    });
  }
  return out;
}

/**
 * Which relationships the graph can see, and which it structurally cannot.
 *
 * The clearest `no_detector` in the register: `UNDERIVED_EDGE_KINDS` is a list of questions nothing
 * here answers, each with its reason, and it was already written that way — this only gives it the
 * same name every other gap now has.
 */
export function fromOrgGraph(graph: OrgGraph): readonly Observation[] {
  const out: Observation[] = [];
  for (const kind of Object.values(EdgeKind)) {
    out.push({
      subject: "org-graph",
      question: kind,
      state: ObservationState.Observed,
      findings: graph.edges.filter((e) => e.kind === kind).length,
    });
  }
  for (const [kind, why] of Object.entries(UNDERIVED_EDGE_KINDS)) {
    out.push({ subject: "org-graph", question: kind, state: ObservationState.NoDetector, findings: 0, why });
  }
  return out;
}

/**
 * Whether the previous holder's attempts are known.
 *
 * `not_recorded` is `not_run` in this vocabulary: something could have tracked the attempts and did
 * not. `none_attempted` is genuinely observed — somebody looked and there was nothing.
 */
export function fromHandoffBrief(brief: HandoffBrief): readonly Observation[] {
  const attempts = brief.attemptedPaths;
  return [
    {
      subject: "handoff-brief",
      question: `attempted-paths:${brief.workId}`,
      state: attempts.kind === "not_recorded" ? ObservationState.NotRun : ObservationState.Observed,
      findings: attempts.kind === "recorded" ? attempts.paths.length : 0,
      ...(attempts.kind === "not_recorded" ? { why: attempts.why } : {}),
    },
    {
      subject: "handoff-brief",
      question: `contradictions:${brief.workId}`,
      state: ObservationState.Observed,
      findings: brief.unresolvedContradictions.length,
    },
  ];
}

/**
 * Whether each seam actually reaches anything.
 *
 * A port with no recorded fidelity is `not_run`: nothing established what it is, and reading that
 * as simulated would be a guess while reading it as real would be a lie. `providers.ts` has only
 * two fidelities, so ABSENCE is the third state and it lives here rather than there.
 */
export function fromPortFidelity(
  fidelity: ReadonlyMap<Port, Fidelity>,
  expected: readonly Port[],
): readonly Observation[] {
  return expected.map((port) => {
    const known = fidelity.get(port);
    if (known === undefined) {
      return {
        subject: "providers",
        question: `fidelity:${port}`,
        state: ObservationState.NotRun,
        findings: 0,
        why: "no fidelity was recorded for this port; it is unresolved rather than simulated",
      };
    }
    // A SIMULATED port is observed and IS a finding: everything downstream of it measures a
    // stand-in, which is a fact about the run rather than a gap in the looking.
    return {
      subject: "providers",
      question: `fidelity:${port}`,
      state: ObservationState.Observed,
      findings: known === Fidelity.Real ? 0 : 1,
    };
  });
}
