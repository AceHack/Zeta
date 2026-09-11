/**
 * corporate/phase-staffing.ts — who does each PHASE, decided rather than assumed.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * Every phase of a walk was attributed to the task's assignee: `producedByHatId:
 * task.assigneeHatId`. So a Backend Implementer "wrote" the Customer & RFP Review, the business
 * context, and the architecture. Reported by a reader looking at a real document — and it is the
 * precise shape of "too pipeliney, not a living org": a chart of a hundred and twenty hats with
 * one agent doing all fourteen steps, and the chart is decoration.
 *
 * ── DERIVED FROM THE CHART, NEVER A TABLE ────────────────────────────────────
 * The obvious fix is a `gate -> hat` table. It is also wrong: it is the hardcoding the chart
 * exists to replace, and it goes stale the moment somebody adds a hat. Instead the DISCIPLINE is
 * read off the chart — a gate's approvers sit in a department, and that department is the
 * discipline that owns the phase. The candidates are that department's other hats.
 *
 * ── SEPARATION OF DUTIES IS THE REASON FOR "OTHER" ───────────────────────────
 * The approvers are excluded from authoring. `evaluate` already refuses a gate whose only holder
 * is the hat that did the work, so an author drawn from the approvers would either be refused or —
 * worse — be a gate signing off its own output. A Product Director approves the RFP review; a
 * Requirement Clarifier writes it.
 *
 * ── AND THE RMO PICKS, ON A RECORD ───────────────────────────────────────────
 * This module computes WHO IS QUALIFIED. It does not choose. `assignment-engine.ts` already ranks
 * a pairing of (agent, hat) on its reputation with an exploration bonus and clamps the choice
 * through `chooseWithinLegal` — that is the RMO, and it is what decides. Splitting it this way is
 * the same split the rest of the register keeps: determinism computes the legal set, the agent
 * picks inside it.
 */

import { stringCompare } from "../collation/collation.ts";
import type { OrgChart, OrgHat } from "./org-chart";
import { GateKind, gateOwners } from "./quality-gate";

/** A hat that could author this phase, and the reason it is in the running. */
export interface PhaseCandidate {
  readonly hatId: string;
  readonly name: string;
  readonly departmentId: string;
}

export interface PhaseStaffing {
  readonly gate: GateKind;
  /** The discipline that owns this phase, read off the gate's approvers. */
  readonly departmentIds: readonly string[];
  /** Hats qualified to author it. Empty is a real answer and is reported, never filled in. */
  readonly candidates: readonly PhaseCandidate[];
  /**
   * Why there is nobody, when there is nobody.
   *
   * A staffing function that returned an empty list with no reason would leave a caller unable to
   * tell "this gate needs no author" from "this organisation has nobody who could write it", and
   * those want opposite responses — proceed, or hire.
   */
  readonly because?: string;
}

/**
 * Who in this organisation could author the artifact this gate judges.
 *
 * Ordered by hat id so the same chart yields the same candidate list — the RMO's ranking is what
 * introduces preference, and a list that reshuffled underneath it would make its choice
 * unreplayable.
 */
export function candidatesFor(chart: OrgChart, gate: GateKind): PhaseStaffing {
  const approvers = gateOwners(chart, gate);
  if (approvers.length === 0) {
    return {
      gate,
      departmentIds: [],
      candidates: [],
      because: `no hat in this chart holds '${String(gate)}', so nothing says which discipline owns it`,
    };
  }

  const departmentIds = [...new Set(approvers.map((h) => h.departmentId).filter((d): d is string => d !== undefined))].sort(
    (a, b) => stringCompare(a, b),
  );
  if (departmentIds.length === 0) {
    return {
      gate,
      departmentIds: [],
      candidates: [],
      because: `the hats holding '${String(gate)}' belong to no department, so the discipline cannot be read off the chart`,
    };
  }

  const approverIds = new Set(approvers.map((h) => h.id));
  const candidates = chart.hats
    .filter((h: OrgHat) => h.departmentId !== undefined && departmentIds.includes(h.departmentId))
    // SEPARATION OF DUTIES. An author drawn from the approvers is a gate approving its own output,
    // and `evaluate` refuses that anyway — so including them would produce candidates that are
    // guaranteed to fail at the gate they were picked for.
    .filter((h) => !approverIds.has(h.id))
    .map((h) => ({ hatId: h.id, name: h.name, departmentId: h.departmentId as string }))
    .sort((a, b) => stringCompare(a.hatId, b.hatId));

  return {
    gate,
    departmentIds,
    candidates,
    ...(candidates.length === 0
      ? {
          because:
            `every hat in ${departmentIds.join(", ")} also approves '${String(gate)}', so nobody there ` +
            `could author it without reviewing their own work`,
        }
      : {}),
  };
}

/**
 * The hat that should author this phase, given who the RMO is willing to use.
 *
 * `preferred` is the RMO's ranking, highest first — normally the agents' hats ordered by
 * `rankCandidates`. The first candidate that appears in it wins; if the RMO offers nobody from the
 * qualified set, this returns `undefined` and the caller reports an UNSTAFFED PHASE rather than
 * falling back to whoever holds the task.
 *
 * That fallback is the whole defect being removed. Quietly using the task's assignee is how a
 * Backend Implementer came to write a customer RFP review, and it would make this function
 * decorative — it would compute a qualified set and then not matter.
 */
export function authorFor(
  staffing: PhaseStaffing,
  preferred: readonly string[],
): { readonly hatId: string; readonly rank: number } | undefined {
  for (const [rank, hatId] of preferred.entries()) {
    if (staffing.candidates.some((c) => c.hatId === hatId)) return { hatId, rank };
  }
  return undefined;
}
