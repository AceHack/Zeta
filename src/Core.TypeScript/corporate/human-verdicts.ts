/**
 * corporate/human-verdicts.ts — a person's "no" stands at any step, not only at a checkpoint.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * A person's `reject_gate` was consulted only at the gates the organization stops at for a person
 * (its checkpoints). Anywhere else it reached the NEXT author as feedback and changed nothing about
 * the verdict already on the record. MEASURED on AIAGENT-1658: the QA reviewer approved a
 * reproduction that ran against a hand-written REPLICA of the component; the requester rejected it;
 * the approval stood, and the organization was about to build a fix against the replica.
 *
 * ── HOW IT STANDS ────────────────────────────────────────────────────────────
 * The rejection is written into the log ONCE, as that step's newest verdict, carrying the person's
 * reason and the action as its evidence. Nothing else changes: the latest verdict decides whether a
 * step is owed, so the step is owed again; its author is handed the reason (the existing feedback
 * path); and a later approval of NEW work is newer still and stands - a person's rejection turns back
 * the work it was given for, and does not veto every future attempt.
 *
 * Checkpoint gates are left to their own mechanism (`humanDecisionFor`), which already waits for a
 * person there and would otherwise see the same decision twice.
 *
 * Idempotent: an action already on the record (its `human-action/<id>` is in some verdict's
 * evidence) is never written again, so re-reading the queue each run adds nothing.
 */

import type { HumanAction } from "./human-action";
import { HumanActionKind } from "./human-action";
import type { OrgEvent } from "./org-event";
import { GateOutcome, type GateEvaluation, type GateKind } from "./quality-gate";

export interface HumanRejectionToRecord {
  readonly workId: string;
  readonly evaluation: GateEvaluation;
  readonly actionId: string;
}

/**
 * The person's rejections that must still be written onto the record, oldest first.
 *
 * `known` is the work that exists (a rejection of work the organization does not have is left on
 * the queue, where a person can see it did nothing); `checkpointGates` are left to their own path;
 * `atMs` places the verdict after everything already recorded.
 */
export function humanRejectionsToRecord(input: {
  readonly actions: readonly HumanAction[];
  readonly evaluations: readonly GateEvaluation[];
  readonly known: ReadonlySet<string>;
  readonly checkpointGates: ReadonlySet<string>;
  readonly atMs: number;
}): readonly HumanRejectionToRecord[] {
  const recorded = new Set(input.evaluations.flatMap((e) => e.evidenceRefs));
  return input.actions
    .filter((a) => a.kind === HumanActionKind.RejectGate)
    .filter((a) => input.known.has(a.subjectId))
    .filter((a) => {
      const gate = (a.detail?.["gate"] ?? "").trim();
      return gate !== "" && !input.checkpointGates.has(gate);
    })
    .filter((a) => !recorded.has(`human-action/${a.actionId}`))
    .sort((x, y) => (x.atMs === y.atMs ? (x.actionId < y.actionId ? -1 : 1) : x.atMs - y.atMs))
    .map((a, i) => ({
      workId: a.subjectId,
      actionId: a.actionId,
      evaluation: {
        workId: a.subjectId,
        gate: String(a.detail?.["gate"]) as GateKind,
        outcome: GateOutcome.Rejected,
        byHatId: `person:${a.byHuman}`,
        reason: a.reason,
        atMs: input.atMs + i,
        evidenceRefs: [`human-action/${a.actionId}`],
      },
    }));
}

/** The events that record them - one verdict each, on the work it turns back. */
export function humanRejectionEvents(
  toRecord: readonly HumanRejectionToRecord[],
  mintId: () => string,
): readonly OrgEvent[] {
  return toRecord.map(
    (r) =>
      ({
        id: mintId(),
        kind: "quality_gate_evaluation",
        subjectId: r.workId,
        decision: `${String(r.evaluation.gate)} turned back by ${r.evaluation.byHatId.slice("person:".length)}: ${r.evaluation.reason.split(/\s+/).join(" ").slice(0, 200)}`,
        atMs: r.evaluation.atMs,
        evidenceRefs: r.evaluation.evidenceRefs,
        supervisorChain: [],
        fact: { kind: "gates_evaluated", evaluations: [r.evaluation] },
      }) as unknown as OrgEvent,
  );
}
