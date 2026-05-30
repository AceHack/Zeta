/**
 * The review kernel (CC3) — a review stage IS an observe → decide org cycle.
 *
 *   evaluateStageGate(stage, cs, deps) — OBSERVE: is the gate satisfiable?
 *   decideByAuthority(stage, cs, gate)  — DECIDE: the stage's authority picks within
 *                                          the legal outcomes; hat / quorum / human /
 *                                          external are the four shapes, handled uniformly.
 *   runReviewStage(cs, pipeline, deps)  — observe → decide → clamp → apply → EMIT one event.
 *   advanceChangeSet                    — approve→cursor++/approved | bounce | reject
 *   resumeHumanStage / pullExternalStage — resume a paused human/external stage.
 *
 * THE CLAMP: every authority's outcome is clamped to legalStageOutcomes(gate). An
 * unsatisfiable gate can never be approved; a hat cannot approve a stage it does not
 * own (only the stage's designated authority is consulted); an external approval flows
 * IN as a gate satisfaction — it never bypasses the kernel.
 */

import {
  ChangeSetPhase,
  OrgEventKind,
  ReviewGateKind,
  StageOutcome,
  currentStage,
  isLegalStageOutcome,
  legalStageOutcomes,
  moreStagesRemain,
  type ChangeSet,
  type OrgEvent,
  type ReviewPipeline,
  type ReviewStage,
} from "../../domain/src/index.ts";
import { chooseWithinLegal, firstLegalChooser, type OrgChooser } from "./org-decision.ts";

export type StageGateEvaluation = { satisfiable: boolean; detail: string };

/** The external decision for an `external`-authority stage (from a port poll). */
export const ExternalDecision = {
  Approved: "approved",
  ChangesRequested: "changes_requested",
  Pending: "pending",
} as const;
export type ExternalDecision = (typeof ExternalDecision)[keyof typeof ExternalDecision];

export type ReviewKernelDeps = {
  organizationId: string;
  now: number;
  createId: (prefix: string) => string;
  /** signals the gate evaluator reads — all optional; defaults are conservative. */
  artifactsPresent?: (cs: ChangeSet) => boolean;
  testsGreen?: (cs: ChangeSet, stage: ReviewStage) => boolean;
  blockingFindings?: (cs: ChangeSet, stage: ReviewStage) => number;
  quorumApprovals?: (cs: ChangeSet, stage: ReviewStage) => number;
  externalDecision?: (cs: ChangeSet, stage: ReviewStage) => ExternalDecision;
  /** the hat chooser for `hat`-authority stages (clamped); default = first legal. */
  hatChooser?: OrgChooser<StageOutcome>;
};

export type Decision =
  | { kind: "decided"; outcome: StageOutcome; decidedBy: string }
  | { kind: "pending"; reason: string; by: string };

export type StageResult = {
  changeSet: ChangeSet;
  events: readonly OrgEvent[];
  paused: boolean; // a human/external stage is waiting — the ChangeSet did not advance
  decision: Decision;
  gate: StageGateEvaluation;
};

const MEMORY_CHAIN = ["executive_board", "coo"] as const;

function event(deps: ReviewKernelDeps, kind: OrgEventKind, subjectId: string, from: string | undefined, to: string | undefined, decision: string, actorHatId?: string): OrgEvent {
  const corr = deps.createId("cccorr");
  return {
    id: deps.createId("ccevt"),
    kind,
    occurredAt: new Date(deps.now).toISOString(),
    organizationId: deps.organizationId,
    subjectId,
    decision,
    supervisorChain: [...MEMORY_CHAIN],
    evidenceRefs: [],
    correlationId: corr,
    causationId: corr,
    traceId: corr,
    ...(actorHatId !== undefined ? { actorHatId } : {}),
    ...(from !== undefined ? { fromState: from } : {}),
    ...(to !== undefined ? { toState: to } : {}),
  };
}

/** OBSERVE — is the current stage's gate satisfiable? */
export function evaluateStageGate(stage: ReviewStage, cs: ChangeSet, deps: ReviewKernelDeps): StageGateEvaluation {
  switch (stage.gate) {
    case ReviewGateKind.ArtifactsPresent: {
      const ok = deps.artifactsPresent ? deps.artifactsPresent(cs) : cs.artifacts.length > 0;
      return { satisfiable: ok, detail: ok ? "artifacts present" : "no artifacts carried" };
    }
    case ReviewGateKind.TestsGreen: {
      const ok = deps.testsGreen ? deps.testsGreen(cs, stage) : false;
      return { satisfiable: ok, detail: ok ? "tests green" : "tests not green" };
    }
    case ReviewGateKind.NoBlockingFindings: {
      const n = deps.blockingFindings ? deps.blockingFindings(cs, stage) : 0;
      return { satisfiable: n === 0, detail: n === 0 ? "no blocking findings" : `${n} blocking finding(s)` };
    }
    case ReviewGateKind.QuorumAgreed: {
      const need = stage.authority.kind === "quorum" ? stage.authority.threshold : 1;
      const have = deps.quorumApprovals ? deps.quorumApprovals(cs, stage) : 0;
      return { satisfiable: have >= need, detail: `quorum ${have}/${need}` };
    }
    case ReviewGateKind.ExternalApproved: {
      const ext = deps.externalDecision ? deps.externalDecision(cs, stage) : ExternalDecision.Pending;
      return { satisfiable: ext === ExternalDecision.Approved, detail: `external ${ext}` };
    }
    default:
      return { satisfiable: false, detail: "unknown gate" };
  }
}

/** DECIDE — the stage's authority chooses within the legal outcomes (clamped). */
export function decideByAuthority(stage: ReviewStage, cs: ChangeSet, gate: StageGateEvaluation, deps: ReviewKernelDeps): Decision {
  const legal = legalStageOutcomes(stage, gate.satisfiable);
  switch (stage.authority.kind) {
    case "hat": {
      const chooser = deps.hatChooser ?? firstLegalChooser<StageOutcome>();
      const choice = chooseWithinLegal(legal, `stage:${stage.id}`, chooser);
      if (choice.outcome === "no_legal_option") return { kind: "decided", outcome: StageOutcome.RequestChanges, decidedBy: stage.authority.hatId };
      return { kind: "decided", outcome: choice.option, decidedBy: stage.authority.hatId };
    }
    case "quorum": {
      // the board's agreement IS the gate; satisfiable → approve, else request changes (clamped)
      const outcome = gate.satisfiable ? StageOutcome.Approve : StageOutcome.RequestChanges;
      return { kind: "decided", outcome, decidedBy: `quorum:${stage.authority.threshold}` };
    }
    case "human":
      // the org PAUSES for a human — the ChangeSet does not advance until resumeHumanStage
      return { kind: "pending", reason: `human sign-off required (${stage.authority.role})`, by: `human:${stage.authority.role}` };
    case "external": {
      const ext = deps.externalDecision ? deps.externalDecision(cs, stage) : ExternalDecision.Pending;
      if (ext === ExternalDecision.Approved && isLegalStageOutcome(stage, gate.satisfiable, StageOutcome.Approve))
        return { kind: "decided", outcome: StageOutcome.Approve, decidedBy: `external:${stage.authority.system}` };
      if (ext === ExternalDecision.ChangesRequested)
        return { kind: "decided", outcome: StageOutcome.RequestChanges, decidedBy: `external:${stage.authority.system}` };
      return { kind: "pending", reason: `awaiting external approval (${stage.authority.system})`, by: `external:${stage.authority.system}` };
    }
    default:
      return { kind: "pending", reason: "unknown authority", by: "unknown" };
  }
}

/** Apply a clamped outcome to the ChangeSet (advance cursor / approve / bounce / reject) + emit. */
export function advanceChangeSet(cs: ChangeSet, pipeline: ReviewPipeline, stage: ReviewStage, outcome: StageOutcome, decidedBy: string, deps: ReviewKernelDeps): { changeSet: ChangeSet; events: readonly OrgEvent[] } {
  const at = new Date(deps.now).toISOString();
  const base = { ...cs, updatedAt: at };
  const events: OrgEvent[] = [];

  if (outcome === StageOutcome.Reject) {
    events.push(event(deps, OrgEventKind.ChangeSetRejected, cs.changeSetId, cs.phase, ChangeSetPhase.Rejected, `rejected at stage ${stage.id} by ${decidedBy}: ${stage.id} is blocking`, actorOf(decidedBy)));
    return { changeSet: { ...base, phase: ChangeSetPhase.Rejected }, events };
  }
  if (outcome === StageOutcome.RequestChanges) {
    events.push(event(deps, OrgEventKind.ChangesRequested, cs.changeSetId, cs.phase, ChangeSetPhase.ChangesRequested, `changes requested at stage ${stage.id} by ${decidedBy}`, actorOf(decidedBy)));
    return { changeSet: { ...base, phase: ChangeSetPhase.ChangesRequested }, events };
  }
  // approve
  events.push(event(deps, OrgEventKind.StageApproved, cs.changeSetId, stage.id, undefined, `stage ${stage.id} approved by ${decidedBy}`, actorOf(decidedBy)));
  if (moreStagesRemain(cs, pipeline)) {
    const nextIndex = cs.currentStageIndex + 1;
    events.push(event(deps, OrgEventKind.ReviewStageAdvanced, cs.changeSetId, stage.id, pipeline.stages[nextIndex]!.id, `advanced ${stage.id} → ${pipeline.stages[nextIndex]!.id}`, actorOf(decidedBy)));
    return { changeSet: { ...base, currentStageIndex: nextIndex }, events };
  }
  events.push(event(deps, OrgEventKind.ChangeSetApproved, cs.changeSetId, undefined, undefined, `all blocking stages passed — change set approved`));
  return { changeSet: { ...base, phase: ChangeSetPhase.Approved }, events };
}

function actorOf(decidedBy: string): string | undefined {
  return decidedBy.includes(":") ? undefined : decidedBy; // hats are bare ids; human:/external:/quorum: are not actor hats
}

/** Run the current stage: observe → decide → clamp → apply → emit. */
export function runReviewStage(cs: ChangeSet, pipeline: ReviewPipeline, deps: ReviewKernelDeps): StageResult {
  const stage = currentStage(cs, pipeline);
  if (cs.phase !== ChangeSetPhase.InReview || stage === undefined) {
    return { changeSet: cs, events: [], paused: false, decision: { kind: "pending", reason: "not in review", by: "kernel" }, gate: { satisfiable: false, detail: "n/a" } };
  }
  const gate = evaluateStageGate(stage, cs, deps);
  const decision = decideByAuthority(stage, cs, gate, deps);

  if (decision.kind === "pending") {
    const kind = stage.authority.kind === "human" ? OrgEventKind.HumanSignoffRequested : OrgEventKind.ProjectionSynced;
    const ev = event(deps, kind, cs.changeSetId, stage.id, undefined, decision.reason);
    return { changeSet: cs, events: [ev], paused: true, decision, gate };
  }
  // clamp: the decided outcome MUST be legal for this gate (anti-fabrication)
  if (!isLegalStageOutcome(stage, gate.satisfiable, decision.outcome)) {
    const ev = event(deps, OrgEventKind.ReviewFindingRaised, cs.changeSetId, stage.id, undefined, `illegal outcome ${decision.outcome} clamped — gate not satisfiable`);
    const forced = advanceChangeSet(cs, pipeline, stage, StageOutcome.RequestChanges, decision.decidedBy, deps);
    return { changeSet: forced.changeSet, events: [ev, ...forced.events], paused: false, decision, gate };
  }
  const applied = advanceChangeSet(cs, pipeline, stage, decision.outcome, decision.decidedBy, deps);
  return { changeSet: applied.changeSet, events: applied.events, paused: false, decision, gate };
}

/** Resume a PAUSED human stage with the human's clamped decision. */
export function resumeHumanStage(cs: ChangeSet, pipeline: ReviewPipeline, humanOutcome: StageOutcome, role: string, deps: ReviewKernelDeps): { changeSet: ChangeSet; events: readonly OrgEvent[] } {
  const stage = currentStage(cs, pipeline);
  if (cs.phase !== ChangeSetPhase.InReview || stage === undefined || stage.authority.kind !== "human") {
    return { changeSet: cs, events: [] };
  }
  // a human gate is satisfiable by definition of the human acting; clamp to {approve,request_changes,reject}
  const legal = legalStageOutcomes(stage, true);
  const outcome = legal.includes(humanOutcome) ? humanOutcome : StageOutcome.RequestChanges;
  return advanceChangeSet(cs, pipeline, stage, outcome, `human:${role}`, deps);
}

/** Apply an approved ChangeSet — the materialize step (runtime does the artifact write + external merge). */
export function applyChangeSet(cs: ChangeSet, deps: ReviewKernelDeps): { changeSet: ChangeSet; events: readonly OrgEvent[] } {
  if (cs.phase !== ChangeSetPhase.Approved) return { changeSet: cs, events: [] };
  const at = new Date(deps.now).toISOString();
  const ev = event(deps, OrgEventKind.ChangeSetApplied, cs.changeSetId, cs.phase, ChangeSetPhase.Applied, `change set applied — artifacts materialized to ${cs.targetRef}`);
  return { changeSet: { ...cs, phase: ChangeSetPhase.Applied, updatedAt: at }, events: [ev] };
}

/** Open a ChangeSet into review (drafted → in_review at stage 0). */
export function openChangeSet(cs: ChangeSet, deps: ReviewKernelDeps): { changeSet: ChangeSet; events: readonly OrgEvent[] } {
  const at = new Date(deps.now).toISOString();
  const ev = event(deps, OrgEventKind.ChangeSetOpened, cs.changeSetId, ChangeSetPhase.Drafted, ChangeSetPhase.InReview, `change set opened: ${cs.title} (${cs.artifacts.length} artifact(s))`, cs.proposerHatId);
  return { changeSet: { ...cs, phase: ChangeSetPhase.InReview, currentStageIndex: 0, updatedAt: at }, events: [ev] };
}

/** Resubmit after changes-requested (changes_requested → in_review, revision++, cursor 0). */
export function resubmitChangeSet(cs: ChangeSet, deps: ReviewKernelDeps): { changeSet: ChangeSet; events: readonly OrgEvent[] } {
  if (cs.phase !== ChangeSetPhase.ChangesRequested) return { changeSet: cs, events: [] };
  const at = new Date(deps.now).toISOString();
  const ev = event(deps, OrgEventKind.ReviewStageAdvanced, cs.changeSetId, undefined, undefined, `resubmitted at revision ${cs.revision + 1} — re-entering review`, cs.proposerHatId);
  return { changeSet: { ...cs, phase: ChangeSetPhase.InReview, currentStageIndex: 0, revision: cs.revision + 1, updatedAt: at }, events: [ev] };
}
