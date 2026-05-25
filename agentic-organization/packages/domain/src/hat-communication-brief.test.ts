import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { DefaultTeamMemberSupervisorTools, buildHatCommunicationBrief } from "./hat-communication-brief.ts";
import { SupervisorChainLevel, SupervisorSignalToolType } from "./supervisor-communication.ts";

describe("hat communication brief", () => {
  test("explains duty, supervisor line, and efficient upward tools", () => {
    const brief = buildHatCommunicationBrief({
      hatId: "developer",
      duty: "Implement scoped work, surface blockers quickly, and keep evidence attached to the work item.",
      sourceLevel: SupervisorChainLevel.TeamMember,
      targetLevel: SupervisorChainLevel.Manager,
      targetHatId: "engineering-manager",
      availableTools: DefaultTeamMemberSupervisorTools,
    });

    equal(brief.supervisor.targetLevel, SupervisorChainLevel.Manager);
    deepEqual(
      brief.availableTools.map((tool) => tool.toolType),
      [
        SupervisorSignalToolType.AskQuestion,
        SupervisorSignalToolType.ReportBlocker,
        SupervisorSignalToolType.RequestDecision,
        SupervisorSignalToolType.RequestResource,
        SupervisorSignalToolType.RequestReview,
        SupervisorSignalToolType.ReportRisk,
        SupervisorSignalToolType.SuggestImprovement,
        SupervisorSignalToolType.RequestEscalation,
      ],
    );
    equal(brief.availableTools[1]?.useWhen, "work cannot move without supervisor triage or routing");
  });
});
