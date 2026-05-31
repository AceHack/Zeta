import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ChangeSetPhase,
  ChangeArtifactKind,
  ExternalSystem,
  ReviewGateKind,
  StageOutcome,
  isTerminalChangeSet,
  isGitRepresentable,
  moreStagesRemain,
  currentStage,
  legalChangeSetTransitions,
  isLegalChangeSetTransition,
  legalStageOutcomes,
  type ChangeSet,
  type ChangeArtifact,
  type ReviewPipeline,
  type ReviewStage,
} from "../src/change-control.ts";

function stage(over: Partial<ReviewStage> & { id: string }): ReviewStage {
  return { ownerLabel: "code_reviewer", authority: { kind: "hat", hatId: "code_reviewer" }, gate: ReviewGateKind.NoBlockingFindings, blocking: true, ...over };
}

function pipeline(stages: readonly ReviewStage[]): ReviewPipeline {
  return { pipelineId: "pl-1", organizationId: "org-lfg", stages };
}

function changeSet(over: Partial<ChangeSet> = {}): ChangeSet {
  return {
    changeSetId: "cs-1", organizationId: "org-lfg", workItemId: "work-1", proposerHatId: "code_author",
    title: "t", targetRef: "feat/x", phase: ChangeSetPhase.InReview, pipelineId: "pl-1", currentStageIndex: 0,
    artifacts: [], projections: [], revision: 1, openedAt: "2026-05-30T00:00:00Z", updatedAt: "2026-05-30T00:00:00Z", ...over,
  };
}

test("Applied/Rejected/Withdrawn are terminal; no transitions out", () => {
  for (const p of [ChangeSetPhase.Applied, ChangeSetPhase.Rejected, ChangeSetPhase.Withdrawn]) {
    ok(isTerminalChangeSet(p));
    deepEqual(legalChangeSetTransitions(changeSet({ phase: p }), pipeline([stage({ id: "s" })])), []);
  }
  ok(!isTerminalChangeSet(ChangeSetPhase.InReview));
});

test("drafted can only enter review or withdraw", () => {
  const next = legalChangeSetTransitions(changeSet({ phase: ChangeSetPhase.Drafted }), pipeline([stage({ id: "s" })]));
  deepEqual([...next].sort(), [ChangeSetPhase.InReview, ChangeSetPhase.Withdrawn].sort());
});

test("in_review with stages remaining can advance/bounce/reject/withdraw — but NOT jump to approved", () => {
  const pl = pipeline([stage({ id: "a" }), stage({ id: "b" })]); // 2 stages, cursor 0 → more remain
  const cs = changeSet({ currentStageIndex: 0 });
  ok(moreStagesRemain(cs, pl));
  ok(isLegalChangeSetTransition(cs, pl, ChangeSetPhase.InReview));
  ok(isLegalChangeSetTransition(cs, pl, ChangeSetPhase.ChangesRequested));
  ok(!isLegalChangeSetTransition(cs, pl, ChangeSetPhase.Approved), "cannot approve while stages remain");
});

test("in_review on the LAST stage can approve (not advance)", () => {
  const pl = pipeline([stage({ id: "a" }), stage({ id: "b" })]);
  const cs = changeSet({ currentStageIndex: 1 }); // last stage
  ok(!moreStagesRemain(cs, pl));
  ok(isLegalChangeSetTransition(cs, pl, ChangeSetPhase.Approved));
  equal(currentStage(cs, pl)!.id, "b");
});

test("changes_requested returns to the proposer (in_review or withdraw)", () => {
  const next = legalChangeSetTransitions(changeSet({ phase: ChangeSetPhase.ChangesRequested }), pipeline([stage({ id: "s" })]));
  deepEqual([...next].sort(), [ChangeSetPhase.InReview, ChangeSetPhase.Withdrawn].sort());
});

test("approved can apply, return for release fixes, or withdraw", () => {
  const next = legalChangeSetTransitions(changeSet({ phase: ChangeSetPhase.Approved }), pipeline([stage({ id: "s" })]));
  deepEqual([...next].sort(), [ChangeSetPhase.Applied, ChangeSetPhase.ChangesRequested, ChangeSetPhase.Withdrawn].sort());
});

test("THE CLAMP: an unsatisfiable gate can never be approved — only bounced or rejected", () => {
  const s = stage({ id: "s", blocking: true });
  deepEqual([...legalStageOutcomes(s, false)].sort(), [StageOutcome.RequestChanges, StageOutcome.Reject].sort());
  // satisfiable blocking stage may approve/bounce/reject
  deepEqual([...legalStageOutcomes(s, true)].sort(), [StageOutcome.Approve, StageOutcome.RequestChanges, StageOutcome.Reject].sort());
  // advisory stage may not reject
  deepEqual([...legalStageOutcomes(stage({ id: "s2", blocking: false }), true)].sort(), [StageOutcome.Approve, StageOutcome.RequestChanges].sort());
});

test("change payload is Git-agnostic — schema/decision artifacts are NOT git-representable", () => {
  const code: ChangeArtifact = { kind: ChangeArtifactKind.CodeDiff, path: "a.ts", diff: "+x", language: "ts" };
  const schema: ChangeArtifact = { kind: ChangeArtifactKind.SchemaMigration, migrationId: "m1", sql: "CREATE …" };
  const decision: ChangeArtifact = { kind: ChangeArtifactKind.DecisionRecord, decisionId: "d1", summary: "use X" };
  ok(isGitRepresentable(code));
  ok(!isGitRepresentable(schema), "a schema migration cannot be a Git file diff — it stays internal");
  ok(!isGitRepresentable(decision));
});

test("the external-system DU enumerates the projection targets including none", () => {
  ok([ExternalSystem.GitHub, ExternalSystem.GitLab, ExternalSystem.Jira, ExternalSystem.None].every((s) => typeof s === "string"));
});

test("M4 clamp property: every change-set phase returns a closed legal target set", () => {
  const phases = new Set<string>(Object.values(ChangeSetPhase));
  const pl = pipeline([stage({ id: "a" }), stage({ id: "b" })]);
  for (const phase of Object.values(ChangeSetPhase)) {
    const cursors = phase === ChangeSetPhase.InReview ? [0, 1] : [0];
    for (const currentStageIndex of cursors) {
      const next = legalChangeSetTransitions(changeSet({ phase, currentStageIndex }), pl);
      ok(Array.isArray(next));
      for (const target of next) {
        ok(phases.has(target));
        ok(target !== phase || phase === ChangeSetPhase.InReview);
      }
    }
  }
});

test("M4 clamp property: terminal change-set phases cannot escape", () => {
  const pl = pipeline([stage({ id: "s" })]);
  for (const phase of Object.values(ChangeSetPhase)) {
    if (!isTerminalChangeSet(phase)) continue;
    deepEqual(legalChangeSetTransitions(changeSet({ phase }), pl), []);
  }
});

test("M4 clamp property: stage outcomes are closed and unsatisfied gates never approve", () => {
  const outcomes = new Set<string>(Object.values(StageOutcome));
  for (const blocking of [true, false]) {
    for (const gateSatisfiable of [true, false]) {
      const next = legalStageOutcomes(stage({ id: `${blocking}-${gateSatisfiable}`, blocking }), gateSatisfiable);
      for (const outcome of next) ok(outcomes.has(outcome));
      if (!gateSatisfiable) ok(!next.includes(StageOutcome.Approve));
    }
  }
});
