/**
 * corporate/reputation-from-log.ts — the writer `reputation.ts` never had.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * `reputation.ts` is a complete system: Beta posteriors per (agent, hat, outcome class), a decay
 * policy, a whitewash threshold, an exploration bonus. `assignment-engine.rankCandidates` reads it
 * to choose who gets work. And NOTHING EVER CONSTRUCTED A `ReputationObservation` outside a test —
 * `run-org.ts` passes `observations: []` at both call sites.
 *
 * The consequence is measurable and was measured: every candidate scores the same uniform prior, so
 * two assignments in one run both came back `score 0.400` and both went to the same agent out of
 * eighty-five eligible, which then wore two implementation hats at once. The RMO was not choosing.
 * It was taking the first name on a list.
 *
 * ── A GATE VERDICT IS ALREADY THE SIGNAL ─────────────────────────────────────
 * Nothing new needs to be invented or asserted. The log already records, for each gate, who
 * authored the work (`phase_output.producedByHatId`) and what an independent hat decided about it
 * (`gates_evaluated`). "Work this agent did in this hat was approved" is exactly a success, and it
 * is a JUDGEMENT BY SOMEBODY ELSE — which is what makes it reputation rather than self-report.
 *
 * ── WHICH CLASS A GATE SPEAKS TO ─────────────────────────────────────────────
 * Gates are not interchangeable evidence. Passing `qa_uat` says something about quality; passing
 * `release_readiness` says something about reliability; `adversarial_review` and the security-facing
 * gates speak to safety. Mapping every gate onto one class would make the four posteriors four
 * copies of the same number, which is worse than having one.
 */

import { GateKind, isPassing, type GateEvaluation } from "./quality-gate";
import { OutcomeClass, type ReputationObservation } from "./reputation";

/**
 * What a gate's verdict is evidence ABOUT.
 *
 * Deliberately not exhaustive-by-default: a gate absent from this table contributes to `Quality`,
 * which is the honest fallback — it says the work was judged and passed, without claiming the
 * verdict measured timeliness or safety when nothing about the gate speaks to those.
 */
export const GATE_SPEAKS_TO: Readonly<Partial<Record<GateKind, OutcomeClass>>> = {
  [GateKind.QaUat]: OutcomeClass.Quality,
  [GateKind.RuntimeValidation]: OutcomeClass.Reliability,
  [GateKind.ReleaseReadiness]: OutcomeClass.Reliability,
  [GateKind.AdversarialReview]: OutcomeClass.Safety,
  [GateKind.ArchitectureApproval]: OutcomeClass.Safety,
  [GateKind.FinalArchitectureReview]: OutcomeClass.Safety,
};

export function outcomeClassFor(gate: GateKind): OutcomeClass {
  return GATE_SPEAKS_TO[gate] ?? OutcomeClass.Quality;
}

/** Who authored the work a gate judged: `<workId>::<gate>` -> hat. */
export type AuthorIndex = ReadonlyMap<string, string>;

/** Which agent was wearing a hat: hat -> agent. */
export type WearerIndex = ReadonlyMap<string, string>;

/**
 * Reputation observations derived from gate verdicts.
 *
 * An evaluation contributes only when BOTH are known: who authored the work, and which agent wore
 * that hat. Either missing and the observation would name the wrong party — crediting an agent for
 * a gate somebody else's work passed is worse than having no reputation at all, because the ranker
 * would act on it confidently.
 *
 * A REJECTION IS EVIDENCE TOO, and is recorded as a failure rather than skipped. A reputation that
 * only accumulates successes is a counter, not a posterior: it can never fall, so an agent that
 * fails every gate outranks one that has not been tried.
 */
export function observationsFrom(input: {
  readonly evaluations: readonly GateEvaluation[];
  readonly authorOf: AuthorIndex;
  readonly wearerOf: WearerIndex;
}): readonly ReputationObservation[] {
  const out: ReputationObservation[] = [];
  for (const e of input.evaluations) {
    const hatId = input.authorOf.get(`${e.workId}::${String(e.gate)}`);
    if (hatId === undefined) continue;
    const agentId = input.wearerOf.get(hatId);
    if (agentId === undefined) continue;
    // THE APPROVER IS NOT THE AUTHOR. A hat judging its own work would be rating itself, and
    // `evaluate` refuses that anyway — this guard means a mis-recorded evaluation cannot slip a
    // self-assessment into the reputation of the one hat that must not supply it.
    if (e.byHatId === hatId) continue;
    out.push({
      agentId,
      hatId,
      outcomeClass: outcomeClassFor(e.gate),
      success: isPassing(e.outcome),
      atMs: e.atMs,
    });
  }
  return out;
}

/**
 * The author index, from the phase outputs the log already carries.
 *
 * `phase_output` records `producedByHatId` per gate — put there by the phase-staffing work so that
 * a Backend Implementer could no longer be recorded as the author of a customer RFP review. That
 * field is what makes this derivation possible at all.
 */
export function authorIndexFrom(
  phaseOutputs: ReadonlyMap<string, { readonly gate: string; readonly producedByHatId: string; readonly workId: string }>,
): AuthorIndex {
  const out = new Map<string, string>();
  for (const p of phaseOutputs.values()) out.set(`${p.workId}::${p.gate}`, p.producedByHatId);
  return out;
}
