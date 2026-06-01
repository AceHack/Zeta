import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { ToolBundle } from "../../domain/src/index.ts";
import {
  ActionClass,
  PromptFlowGateKind,
  PromptFlowRunState,
  RunScope,
  advancePromptFlowRun,
  buildProductionIncidentRunbookPromptFlowDefinitions,
  compilePromptFlowTasks,
  createContentAddressedEvidenceRef,
  lintPromptFlowDefinition,
  promptFlowReadoutForHat,
  type PromptFlowDefinition,
} from "../src/index.ts";
import { buildHatDefinitions } from "../src/org-seed.ts";

test("lintPromptFlowDefinition requires production registry fields", () => {
  const diagnostics = lintPromptFlowDefinition({
    ...definition(),
    ownerDepartmentId: "",
    allowedHatIds: [],
    phases: [
      {
        ...definition().phases[0]!,
        requiredEvidenceRefs: [],
      },
    ],
  });

  deepEqual(diagnostics.map((diagnostic) => diagnostic.code), [
    "missing_owner_department",
    "missing_allowed_hats",
    "missing_required_evidence",
    "evidence_gate_mismatch",
  ]);
});

test("compilePromptFlowTasks compiles the active phase into an observe-visible task", () => {
  const tasks = compilePromptFlowTasks({
    definitions: [definition()],
    runs: [
      {
        runId: "pfr-1",
        promptFlowId: "flow-code-change",
        definitionVersion: "1.0.0",
        workItemId: "work-1",
        scope: RunScope.WorkItem,
        currentPhaseId: "execute",
        state: PromptFlowRunState.RunningPhase,
        priority: 50,
      },
    ],
  });

  equal(tasks.length, 1);
  const task = tasks[0]!;
  equal(task.taskId, "pfr-1");
  equal(task.promptFlowId, "flow-code-change");
  equal(task.label, "Execute implementation");
  equal(task.phaseId, "execute");
  equal(task.runState, PromptFlowRunState.RunningPhase);
  deepEqual(task.allowedHatIds, ["backend_implementer"]);
  deepEqual(task.requiredEvidenceRefs, ["tests.green", "diff.reviewable"]);
  equal(task.gate?.kind, PromptFlowGateKind.Evidence);
  deepEqual(task.reviewerHatIds, ["code_reviewer"]);
  equal(task.timeoutSeconds, 900);
  equal(task.rollbackPolicy?.kind, "compensating_action");
});

test("compilePromptFlowTasks filters runs outside the definition scope", () => {
  const tasks = compilePromptFlowTasks({
    definitions: [definition()],
    runs: [
      {
        runId: "pfr-project",
        promptFlowId: "flow-code-change",
        definitionVersion: "1.0.0",
        workItemId: "work-1",
        scope: RunScope.Project,
        currentPhaseId: "execute",
        state: PromptFlowRunState.RunningPhase,
        priority: 50,
      },
    ],
  });

  equal(tasks.length, 0);
});

test("lintPromptFlowDefinition rejects divergent phase and gate evidence contracts", () => {
  const diagnostics = lintPromptFlowDefinition(definition({
    phases: [
      {
        ...definition().phases[0]!,
        requiredEvidenceRefs: ["shown-to-agent"],
        gate: { kind: PromptFlowGateKind.Evidence, requiredEvidenceRefs: ["gate-enforces"] },
      },
    ],
  }));

  deepEqual(diagnostics.map((diagnostic) => diagnostic.code), ["evidence_gate_mismatch"]);
});

test("promptFlowReadoutForHat vetoes definitions outside allowed hats", () => {
  const backendImplementer = buildHatDefinitions().find((hat) => hat.id === "backend_implementer")!;
  const qaReviewer = buildHatDefinitions().find((hat) => hat.id === "qa_reviewer")!;
  const tasks = compilePromptFlowTasks({
    definitions: [definition()],
    runs: [
      {
        runId: "pfr-1",
        promptFlowId: "flow-code-change",
        definitionVersion: "1.0.0",
        workItemId: "work-1",
        scope: RunScope.WorkItem,
        currentPhaseId: "execute",
        state: PromptFlowRunState.RunningPhase,
        priority: 50,
      },
    ],
  });

  equal(promptFlowReadoutForHat(backendImplementer, tasks).tasks.length, 1);
  const qaReadout = promptFlowReadoutForHat(qaReviewer, tasks);
  equal(qaReadout.tasks.length, 0);
  equal(qaReadout.vetoedTasks[0]?.ruleName, "prompt-flow-allowed-hat");
  ok(qaReadout.vetoedTasks[0]?.reason.includes("backend_implementer"));
});

test("advancePromptFlowRun blocks awaiting gate until content-addressed evidence satisfies the phase", () => {
  const testEvidence = createContentAddressedEvidenceRef("test-result", { run: "pfr-1", status: "green" });
  const diffEvidence = createContentAddressedEvidenceRef("diff", { run: "pfr-1", status: "reviewable" });
  const flow = definition({
    phases: [
      {
        ...definition().phases[0]!,
        requiredEvidenceRefs: [testEvidence, diffEvidence],
        gate: { kind: PromptFlowGateKind.Evidence, requiredEvidenceRefs: [testEvidence, diffEvidence] },
      },
    ],
  });
  const run = {
    runId: "pfr-1",
    promptFlowId: "flow-code-change",
    definitionVersion: "1.0.0",
    workItemId: "work-1",
    scope: RunScope.WorkItem,
    currentPhaseId: "context",
    state: PromptFlowRunState.AwaitingGate,
    priority: 50,
  };

  const missingEvidence = advancePromptFlowRun(flow, run, [testEvidence]);
  equal(missingEvidence.outcome, "blocked");
  if (missingEvidence.outcome === "blocked") {
    deepEqual(missingEvidence.missingEvidenceRefs, [diffEvidence]);
  }

  const plainEvidence = advancePromptFlowRun(flow, run, [testEvidence, diffEvidence, "manual-note"]);
  equal(plainEvidence.outcome, "blocked");
  if (plainEvidence.outcome === "blocked") {
    deepEqual(plainEvidence.invalidEvidenceRefs, ["manual-note"]);
  }

  const advanced = advancePromptFlowRun(flow, run, [testEvidence, diffEvidence]);
  equal(advanced.outcome, "advanced");
  if (advanced.outcome === "advanced") {
    equal(advanced.run.state, PromptFlowRunState.Completed);
  }
});

test("advancePromptFlowRun requires explicit human approval for human-approval gates", () => {
  const approvalEvidence = createContentAddressedEvidenceRef("human-approval", {
    run: "pfr-incident-1",
    approver: "human-ops-1",
  });
  const runbookEvidence = createContentAddressedEvidenceRef("incident-runbook-phase", {
    run: "pfr-incident-1",
    phase: "operator-approval",
  });
  const flow = definition({
    promptFlowId: "flow-incident-runbook",
    allowedHatIds: ["incident_commander"],
    reviewerHatIds: ["director_engineering"],
    phases: [
      {
        ...definition().phases[0]!,
        phaseId: "operator-approval",
        requiredEvidenceRefs: [runbookEvidence],
        gate: {
          kind: PromptFlowGateKind.HumanApproval,
          requiredEvidenceRefs: [runbookEvidence],
          approverHatIds: ["director_engineering"],
          requiredHumanApprovalCount: 1,
        },
      },
    ],
  });
  const run = {
    runId: "pfr-incident-1",
    promptFlowId: "flow-incident-runbook",
    definitionVersion: "1.0.0",
    workItemId: "incident-1",
    scope: RunScope.WorkItem,
    currentPhaseId: "operator-approval",
    state: PromptFlowRunState.AwaitingGate,
    priority: 100,
  };

  const missingApproval = advancePromptFlowRun(flow, run, { evidenceRefs: [runbookEvidence] });
  equal(missingApproval.outcome, "blocked");
  if (missingApproval.outcome === "blocked") {
    equal(missingApproval.reason, "missing_human_approval");
    equal(missingApproval.missingHumanApprovalCount, 1);
  }

  const forgedApproval = advancePromptFlowRun(flow, run, {
    evidenceRefs: [runbookEvidence],
    humanApprovals: [
      {
        approverId: "human-ops-1",
        approverHatId: "director_engineering",
        approved: true,
        approvedAt: "2026-05-31T00:00:00.000Z",
        evidenceRef: "plain-approval-note",
      },
    ],
  });
  equal(forgedApproval.outcome, "blocked");
  if (forgedApproval.outcome === "blocked") {
    equal(forgedApproval.reason, "invalid_evidence");
    deepEqual(forgedApproval.invalidEvidenceRefs, ["plain-approval-note"]);
  }

  const wrongHatApproval = advancePromptFlowRun(flow, run, {
    evidenceRefs: [runbookEvidence],
    humanApprovals: [
      {
        approverId: "human-ops-1",
        approverHatId: "backend_implementer",
        approved: true,
        approvedAt: "2026-05-31T00:00:00.000Z",
        evidenceRef: approvalEvidence,
      },
    ],
  });
  equal(wrongHatApproval.outcome, "blocked");
  if (wrongHatApproval.outcome === "blocked") {
    equal(wrongHatApproval.reason, "missing_human_approval");
  }

  const approved = advancePromptFlowRun(flow, run, {
    evidenceRefs: [runbookEvidence],
    humanApprovals: [
      {
        approverId: "human-ops-1",
        approverHatId: "director_engineering",
        approved: true,
        approvedAt: "2026-05-31T00:00:00.000Z",
        evidenceRef: approvalEvidence,
      },
    ],
  });
  equal(approved.outcome, "advanced");
  if (approved.outcome === "advanced") {
    equal(approved.run.state, PromptFlowRunState.Completed);
  }
});

test("production incident runbook prompt flows are lint-clean and expose human approval gates", () => {
  const runbooks = buildProductionIncidentRunbookPromptFlowDefinitions();
  const incidentCommander = buildHatDefinitions().find((hat) => hat.id === "incident_commander")!;
  ok(runbooks.length >= 1);
  for (const runbook of runbooks) {
    deepEqual(lintPromptFlowDefinition(runbook), []);
    ok(runbook.allowedHatIds.includes("incident_commander"));
    ok(runbook.phases.some((phase) => phase.gate.kind === PromptFlowGateKind.HumanApproval));
    const tasks = compilePromptFlowTasks({
      definitions: [runbook],
      runs: runbook.phases.map((phase, index) => ({
        runId: `pfr-incident-${index}`,
        promptFlowId: runbook.promptFlowId,
        definitionVersion: runbook.version,
        workItemId: "incident-1",
        scope: runbook.requiredScope,
        currentPhaseId: phase.phaseId,
        state: PromptFlowRunState.RunningPhase,
        priority: 100 - index,
      })),
    });
    const readout = promptFlowReadoutForHat(incidentCommander, tasks);
    equal(readout.tasks.length, runbook.phases.length);
    deepEqual(readout.vetoedTasks, []);
  }
});

function definition(overrides: Partial<PromptFlowDefinition> = {}): PromptFlowDefinition {
  return {
    promptFlowId: "flow-code-change",
    version: "1.0.0",
    name: "Code change flow",
    ownerDepartmentId: "engineering",
    allowedHatIds: ["backend_implementer"],
    requiredScope: RunScope.WorkItem,
    reviewerHatIds: ["code_reviewer"],
    rollbackPolicy: { kind: "compensating_action", description: "revert patch and release claim" },
    phases: [
      {
        phaseId: "context",
        label: "Load implementation context",
        actionClass: ActionClass.WriteDoc,
        permittedUniversalActions: ["load_context"],
        directions: ["Load work item", "Load initiative constraints"],
        requiredToolBundles: [ToolBundle.Task],
        toolInjections: [{ tool: "repo.search", args: { q: "work-1" } }],
        contextArtifactRefs: ["work:work-1", "initiative:init-1"],
        requiredEvidenceRefs: ["context.loaded"],
        gate: { kind: PromptFlowGateKind.Evidence, requiredEvidenceRefs: ["context.loaded"] },
        timeoutSeconds: 300,
        retryLimit: 1,
        metrics: [{ id: "context.age", label: "context age", value: 3, unit: "minutes" }],
      },
      {
        phaseId: "execute",
        label: "Execute implementation",
        actionClass: ActionClass.WriteCode,
        permittedUniversalActions: ["execute", "submit_evidence"],
        directions: ["Patch the smallest surface", "Run focused tests"],
        requiredToolBundles: [ToolBundle.Delivery],
        toolInjections: [{ tool: "repo.patch" }],
        contextArtifactRefs: ["work:work-1", "decision:observe-act"],
        requiredEvidenceRefs: ["tests.green", "diff.reviewable"],
        gate: { kind: PromptFlowGateKind.Evidence, requiredEvidenceRefs: ["tests.green", "diff.reviewable"] },
        timeoutSeconds: 900,
        retryLimit: 2,
        metrics: [{ id: "test.failures", label: "test failures", value: 0, unit: "count" }],
      },
    ],
    ...overrides,
  };
}
