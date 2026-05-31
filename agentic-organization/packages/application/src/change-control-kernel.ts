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
  type OrgEventTransitionContext,
  type ReviewPipeline,
  type ReviewStage,
} from "../../domain/src/index.ts";
import {
  allEvidenceRefsContentAddressed,
  createContentAddressedEvidenceRef,
} from "./content-addressed-evidence.ts";
import { chooseWithinLegal, firstLegalChooser, type OrgChooser } from "./org-decision.ts";

export type StageGateEvaluation = { satisfiable: boolean; detail: string; evidenceRefs: readonly string[] };

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
  stageEvidenceRefs?: (cs: ChangeSet, stage: ReviewStage) => readonly string[];
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

function event(
  deps: ReviewKernelDeps,
  kind: OrgEventKind,
  subjectId: string,
  from: string | undefined,
  to: string | undefined,
  decision: string,
  actorHatId?: string,
  evidenceRefs: readonly string[] = [],
  transitionContext?: OrgEventTransitionContext,
): OrgEvent {
  const corr = deps.createId("cccorr");
  return {
    id: deps.createId("ccevt"),
    kind,
    occurredAt: new Date(deps.now).toISOString(),
    organizationId: deps.organizationId,
    subjectId,
    decision,
    supervisorChain: [...MEMORY_CHAIN],
    evidenceRefs: [...evidenceRefs],
    correlationId: corr,
    causationId: corr,
    traceId: corr,
    ...(actorHatId !== undefined ? { actorHatId } : {}),
    ...(from !== undefined ? { fromState: from } : {}),
    ...(to !== undefined ? { toState: to } : {}),
    ...(transitionContext !== undefined ? { transitionContext } : {}),
  };
}

/** OBSERVE — is the current stage's gate satisfiable? */
export function evaluateStageGate(stage: ReviewStage, cs: ChangeSet, deps: ReviewKernelDeps): StageGateEvaluation {
  switch (stage.gate) {
    case ReviewGateKind.ArtifactsPresent: {
      const ok = deps.artifactsPresent ? deps.artifactsPresent(cs) : cs.artifacts.length > 0;
      const evidenceRefs = ok ? artifactEvidenceRefs(cs) : [];
      return gateEvaluation(ok, ok ? "artifacts present" : "no artifacts carried", evidenceRefs);
    }
    case ReviewGateKind.TestsGreen: {
      const ok = deps.testsGreen ? deps.testsGreen(cs, stage) : false;
      return gateEvaluation(ok, ok ? "tests green" : "tests not green", explicitEvidenceRefs(cs, stage, deps));
    }
    case ReviewGateKind.NoBlockingFindings: {
      const n = deps.blockingFindings ? deps.blockingFindings(cs, stage) : 0;
      return gateEvaluation(
        n === 0,
        n === 0 ? "no blocking findings" : `${n} blocking finding(s)`,
        explicitEvidenceRefs(cs, stage, deps),
      );
    }
    case ReviewGateKind.QuorumAgreed: {
      const need = stage.authority.kind === "quorum" ? stage.authority.threshold : 1;
      const have = deps.quorumApprovals ? deps.quorumApprovals(cs, stage) : 0;
      return gateEvaluation(have >= need, `quorum ${have}/${need}`, explicitEvidenceRefs(cs, stage, deps));
    }
    case ReviewGateKind.ExternalApproved: {
      const ext = deps.externalDecision ? deps.externalDecision(cs, stage) : ExternalDecision.Pending;
      return gateEvaluation(
        ext === ExternalDecision.Approved,
        `external ${ext}`,
        explicitEvidenceRefs(cs, stage, deps),
      );
    }
    default:
      return { satisfiable: false, detail: "unknown gate", evidenceRefs: [] };
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
export function advanceChangeSet(cs: ChangeSet, pipeline: ReviewPipeline, stage: ReviewStage, outcome: StageOutcome, decidedBy: string, deps: ReviewKernelDeps, evidenceRefs: readonly string[] = []): { changeSet: ChangeSet; events: readonly OrgEvent[] } {
  const at = new Date(deps.now).toISOString();
  const base = { ...cs, updatedAt: at };
  const events: OrgEvent[] = [];

  if (outcome === StageOutcome.Reject) {
    events.push(event(deps, OrgEventKind.ChangeSetRejected, cs.changeSetId, cs.phase, ChangeSetPhase.Rejected, `rejected at stage ${stage.id} by ${decidedBy}: ${stage.id} is blocking`, actorOf(decidedBy), evidenceRefs));
    return { changeSet: { ...base, phase: ChangeSetPhase.Rejected }, events };
  }
  if (outcome === StageOutcome.RequestChanges) {
    events.push(event(deps, OrgEventKind.ChangesRequested, cs.changeSetId, cs.phase, ChangeSetPhase.ChangesRequested, `changes requested at stage ${stage.id} by ${decidedBy}`, actorOf(decidedBy), evidenceRefs));
    return { changeSet: { ...base, phase: ChangeSetPhase.ChangesRequested }, events };
  }
  // approve
  events.push(event(deps, OrgEventKind.StageApproved, cs.changeSetId, stage.id, undefined, `stage ${stage.id} approved by ${decidedBy}`, actorOf(decidedBy), evidenceRefs));
  if (moreStagesRemain(cs, pipeline)) {
    const nextIndex = cs.currentStageIndex + 1;
    events.push(event(deps, OrgEventKind.ReviewStageAdvanced, cs.changeSetId, stage.id, pipeline.stages[nextIndex]!.id, `advanced ${stage.id} → ${pipeline.stages[nextIndex]!.id}`, actorOf(decidedBy), evidenceRefs));
    return { changeSet: { ...base, currentStageIndex: nextIndex }, events };
  }
  events.push(event(
    deps,
    OrgEventKind.ChangeSetApproved,
    cs.changeSetId,
    cs.phase,
    ChangeSetPhase.Approved,
    `all blocking stages passed — change set approved`,
    undefined,
    evidenceRefs,
    { kind: "change_set_review", currentStageIndex: cs.currentStageIndex, stageCount: pipeline.stages.length },
  ));
  return { changeSet: { ...base, phase: ChangeSetPhase.Approved }, events };
}

function actorOf(decidedBy: string): string | undefined {
  return decidedBy.includes(":") ? undefined : decidedBy; // hats are bare ids; human:/external:/quorum: are not actor hats
}

/** Run the current stage: observe → decide → clamp → apply → emit. */
export function runReviewStage(cs: ChangeSet, pipeline: ReviewPipeline, deps: ReviewKernelDeps): StageResult {
  const stage = currentStage(cs, pipeline);
  if (cs.phase !== ChangeSetPhase.InReview || stage === undefined) {
    return { changeSet: cs, events: [], paused: false, decision: { kind: "pending", reason: "not in review", by: "kernel" }, gate: { satisfiable: false, detail: "n/a", evidenceRefs: [] } };
  }
  const gate = evaluateStageGate(stage, cs, deps);
  const decision = decideByAuthority(stage, cs, gate, deps);

  if (decision.kind === "pending") {
    const kind = stage.authority.kind === "human" ? OrgEventKind.HumanSignoffRequested : OrgEventKind.ProjectionSynced;
    const ev = event(deps, kind, cs.changeSetId, stage.id, undefined, decision.reason, undefined, gate.evidenceRefs);
    return { changeSet: cs, events: [ev], paused: true, decision, gate };
  }
  // clamp: the decided outcome MUST be legal for this gate (anti-fabrication)
  if (!isLegalStageOutcome(stage, gate.satisfiable, decision.outcome)) {
    const ev = event(deps, OrgEventKind.ReviewFindingRaised, cs.changeSetId, stage.id, undefined, `illegal outcome ${decision.outcome} clamped — gate not satisfiable`, undefined, gate.evidenceRefs);
    const forced = advanceChangeSet(cs, pipeline, stage, StageOutcome.RequestChanges, decision.decidedBy, deps, gate.evidenceRefs);
    return { changeSet: forced.changeSet, events: [ev, ...forced.events], paused: false, decision, gate };
  }
  const applied = advanceChangeSet(cs, pipeline, stage, decision.outcome, decision.decidedBy, deps, gate.evidenceRefs);
  return { changeSet: applied.changeSet, events: applied.events, paused: false, decision, gate };
}

function gateEvaluation(signalSatisfied: boolean, detail: string, evidenceRefs: readonly string[]): StageGateEvaluation {
  if (!signalSatisfied) {
    return { satisfiable: false, detail, evidenceRefs: [] };
  }

  if (!allEvidenceRefsContentAddressed(evidenceRefs)) {
    return { satisfiable: false, detail: `${detail}; missing content-addressed evidence`, evidenceRefs: [] };
  }

  return { satisfiable: true, detail, evidenceRefs: [...evidenceRefs] };
}

function explicitEvidenceRefs(
  cs: ChangeSet,
  stage: ReviewStage,
  deps: ReviewKernelDeps,
): readonly string[] {
  return deps.stageEvidenceRefs === undefined ? [] : deps.stageEvidenceRefs(cs, stage);
}

function artifactEvidenceRefs(cs: ChangeSet): readonly string[] {
  return cs.artifacts.map((artifact, index) =>
    createContentAddressedEvidenceRef("change-artifact", {
      artifact,
      changeSetId: cs.changeSetId,
      index,
      revision: cs.revision,
    }),
  );
}

/** Resume a PAUSED human stage with the human's clamped decision. */
export function resumeHumanStage(cs: ChangeSet, pipeline: ReviewPipeline, humanOutcome: StageOutcome, role: string, deps: ReviewKernelDeps): { changeSet: ChangeSet; events: readonly OrgEvent[] } {
  const stage = currentStage(cs, pipeline);
  if (cs.phase !== ChangeSetPhase.InReview || stage === undefined || stage.authority.kind !== "human") {
    return { changeSet: cs, events: [] };
  }
  const gate = evaluateStageGate(stage, cs, deps);
  const legal = legalStageOutcomes(stage, gate.satisfiable);
  const outcome = legal.includes(humanOutcome) ? humanOutcome : StageOutcome.RequestChanges;
  return advanceChangeSet(cs, pipeline, stage, outcome, `human:${role}`, deps, gate.evidenceRefs);
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
