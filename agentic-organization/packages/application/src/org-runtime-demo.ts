import {
  type OrgCycleRmoCandidateSource,
  type OrgCycleRmoCandidatesForHat,
} from "./org-runtime.ts";

export function createDemoOrgCycleRmoCandidateSource(): OrgCycleRmoCandidateSource {
  return {
    sourceName: "demo-synthetic-org-cycle",
    candidatesForHat: ({ hatId }): OrgCycleRmoCandidatesForHat => {
      const eligibleCandidates = [0, 1].map((index) => ({
        agentId: `agent-${hatId}-${index}`,
        reputationByHat: { [hatId]: 10 - index },
      }));
      return {
        eligibleCandidates,
        rmoCandidates: eligibleCandidates.map((candidate, index) => {
          const reputation = (candidate.reputationByHat[hatId] ?? 0) / 10;
          return {
            agentId: candidate.agentId,
            hatId,
            agentHatReputation: reputation,
            recentOutcomeScore: Math.max(0.4, reputation - index * 0.05),
            scheduleReliability: index === 0 ? 0.85 : 0.75,
            reviewQuality: 0.75,
            qaPassRate: 0.75,
            completionRate: 0.8,
            contextFit: 0.8,
            currentLoad: 0,
            freshness: index === 0 ? 0.45 : 0.8,
            explorationBonus: index === 0 ? 0 : 0.25,
            consecutiveAssignmentCount: 0,
            recentSameHatAssignments: 0,
          };
        }),
      };
    },
  };
}
