import {
  SupervisorChainLevel,
  SupervisorSignalToolType,
  type SupervisorSignalToolType as SupervisorSignalToolTypeValue,
} from "./supervisor-communication.ts";

export type SupervisorSignalToolBrief = {
  toolType: SupervisorSignalToolTypeValue;
  useWhen: string;
  requiredEvidence: readonly string[];
};

export type HatCommunicationBrief = {
  hatId: string;
  duty: string;
  sourceLevel: SupervisorChainLevel;
  supervisor: {
    targetLevel: SupervisorChainLevel;
    targetHatId: string;
  };
  availableTools: readonly SupervisorSignalToolBrief[];
};

export type BuildHatCommunicationBriefInput = {
  hatId: string;
  duty: string;
  sourceLevel: SupervisorChainLevel;
  targetLevel: SupervisorChainLevel;
  targetHatId: string;
  availableTools: readonly SupervisorSignalToolBrief[];
};

export function buildHatCommunicationBrief(input: BuildHatCommunicationBriefInput): HatCommunicationBrief {
  assertNonEmpty("hatId", input.hatId);
  assertNonEmpty("duty", input.duty);
  assertNonEmpty("targetHatId", input.targetHatId);

  if (input.availableTools.length === 0) {
    throw new Error("hat communication brief requires at least one tool");
  }

  return {
    hatId: input.hatId,
    duty: input.duty,
    sourceLevel: input.sourceLevel,
    supervisor: {
      targetLevel: input.targetLevel,
      targetHatId: input.targetHatId,
    },
    availableTools: input.availableTools,
  };
}

export const DefaultTeamMemberSupervisorTools = [
  {
    toolType: SupervisorSignalToolType.AskQuestion,
    useWhen: "clarification is needed before continuing scoped work",
    requiredEvidence: ["question", "current work context"],
  },
  {
    toolType: SupervisorSignalToolType.ReportBlocker,
    useWhen: "work cannot move without supervisor triage or routing",
    requiredEvidence: ["blocking condition", "attempted workaround"],
  },
  {
    toolType: SupervisorSignalToolType.RequestDecision,
    useWhen: "multiple valid paths exist and authority sits above the hat",
    requiredEvidence: ["options", "recommended path", "tradeoffs"],
  },
  {
    toolType: SupervisorSignalToolType.RequestResource,
    useWhen: "work needs additional hats, time, budget, infrastructure, or access",
    requiredEvidence: ["resource needed", "work impact", "urgency"],
  },
  {
    toolType: SupervisorSignalToolType.RequestReview,
    useWhen: "a supervisor or reviewer decision is needed before lifecycle progress",
    requiredEvidence: ["review target", "acceptance criteria", "evidence"],
  },
  {
    toolType: SupervisorSignalToolType.ReportRisk,
    useWhen: "risk could affect scope, schedule, quality, security, or cost",
    requiredEvidence: ["risk", "impact", "mitigation"],
  },
  {
    toolType: SupervisorSignalToolType.SuggestImprovement,
    useWhen: "the hat sees a process, memory, prompt-flow, tool, or workflow gap",
    requiredEvidence: ["observed friction", "repeatability", "suggested improvement"],
  },
  {
    toolType: SupervisorSignalToolType.RequestEscalation,
    useWhen: "the current supervisor level cannot resolve the issue alone",
    requiredEvidence: ["why escalation is needed", "prior triage", "requested level"],
  },
] as const satisfies readonly SupervisorSignalToolBrief[];

function assertNonEmpty(fieldName: string, value: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
}
