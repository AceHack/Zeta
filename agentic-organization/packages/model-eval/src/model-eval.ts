import { OrgEventKind, type OrgEvent } from "../../domain/src/index.ts";

export const ModelEvalCaseClass = {
  NeutralEvidence: "neutral_evidence",
  DirectiveContext: "directive_context",
} as const;
export type ModelEvalCaseClass = (typeof ModelEvalCaseClass)[keyof typeof ModelEvalCaseClass];

export type ModelEvalCase = {
  caseId: string;
  class: ModelEvalCaseClass;
  hatId: string;
  evidence: string;
  allowedActions: readonly string[];
  expectedAction: string;
  directive?: string | undefined;
};

export type ModelEvalScore = {
  total: number;
  correct: number;
  accuracy: number;
};

export type ModelEvalRow = {
  caseId: string;
  class: ModelEvalCaseClass;
  expectedAction: string;
  actualAction: string | undefined;
  legal: boolean;
  correct: boolean;
};

export type ModelEvalReport = {
  runId: string;
  model: string;
  evaluatedAt: string;
  overall: ModelEvalScore;
  byClass: Record<ModelEvalCaseClass, ModelEvalScore>;
  rows: readonly ModelEvalRow[];
};

export type ModelEvalSummary = {
  runId: string;
  model: string;
  evaluatedAt: string;
  overall: ModelEvalScore;
  byClass: Record<ModelEvalCaseClass, ModelEvalScore>;
  failedCaseIds: readonly string[];
  illegalCaseIds: readonly string[];
};

export type ScoreModelEvalRunInput = {
  runId: string;
  model: string;
  cases: readonly ModelEvalCase[];
  decisions: ReadonlyMap<string, string>;
  evaluatedAt: string;
};

export type ModelEvalDecisionPort = (testCase: ModelEvalCase) => Promise<string>;

export type RunModelEvalInput = {
  runId: string;
  model: string;
  cases: readonly ModelEvalCase[];
  decide: ModelEvalDecisionPort;
  evaluatedAt: string;
};

export async function runModelEval(input: RunModelEvalInput): Promise<ModelEvalReport> {
  const decisions = new Map<string, string>();
  for (const testCase of input.cases) {
    decisions.set(testCase.caseId, await input.decide(testCase));
  }

  return scoreModelEvalRun({
    runId: input.runId,
    model: input.model,
    cases: input.cases,
    decisions,
    evaluatedAt: input.evaluatedAt,
  });
}

export function scoreModelEvalRun(input: ScoreModelEvalRunInput): ModelEvalReport {
  const rows = input.cases.map((testCase): ModelEvalRow => {
    const actualAction = input.decisions.get(testCase.caseId);
    const legal = actualAction !== undefined && testCase.allowedActions.includes(actualAction);
    return {
      caseId: testCase.caseId,
      class: testCase.class,
      expectedAction: testCase.expectedAction,
      actualAction,
      legal,
      correct: legal && actualAction === testCase.expectedAction,
    };
  });

  return {
    runId: input.runId,
    model: input.model,
    evaluatedAt: input.evaluatedAt,
    overall: score(rows),
    byClass: {
      [ModelEvalCaseClass.NeutralEvidence]: score(rows.filter((row) => row.class === ModelEvalCaseClass.NeutralEvidence)),
      [ModelEvalCaseClass.DirectiveContext]: score(rows.filter((row) => row.class === ModelEvalCaseClass.DirectiveContext)),
    },
    rows,
  };
}

export function summarizeModelEvalReport(report: ModelEvalReport): ModelEvalSummary {
  return {
    runId: report.runId,
    model: report.model,
    evaluatedAt: report.evaluatedAt,
    overall: report.overall,
    byClass: report.byClass,
    failedCaseIds: report.rows.filter((row) => !row.correct).map((row) => row.caseId),
    illegalCaseIds: report.rows.filter((row) => !row.legal).map((row) => row.caseId),
  };
}

export type ModelEvalOrgEventInput = {
  report: ModelEvalReport;
  organizationId: string;
  eventId: string;
  evidenceRef: string;
  correlationId: string;
};

export function modelEvalReportToOrgEvent(input: ModelEvalOrgEventInput): OrgEvent {
  const summary = summarizeModelEvalReport(input.report);
  const classA = summary.byClass[ModelEvalCaseClass.NeutralEvidence];
  const classB = summary.byClass[ModelEvalCaseClass.DirectiveContext];
  return {
    id: input.eventId,
    kind: OrgEventKind.ModelEvalCompleted,
    occurredAt: summary.evaluatedAt,
    organizationId: input.organizationId,
    actorHatId: "model_eval_reviewer",
    subjectId: summary.runId,
    decision: `model ${summary.model} eval completed: ${scoreText(summary.overall)} overall, Class A ${scoreText(classA)}, Class B ${scoreText(classB)}`,
    supervisorChain: ["executive_board", "coo", "model_eval_reviewer"],
    evidenceRefs: [input.evidenceRef],
    correlationId: input.correlationId,
    causationId: input.correlationId,
    traceId: input.correlationId,
  };
}

function score(rows: readonly ModelEvalRow[]): ModelEvalScore {
  const total = rows.length;
  const correct = rows.filter((row) => row.correct).length;
  return {
    total,
    correct,
    accuracy: total === 0 ? 0 : correct / total,
  };
}

function scoreText(scoreValue: ModelEvalScore): string {
  return `${scoreValue.correct}/${scoreValue.total}`;
}
