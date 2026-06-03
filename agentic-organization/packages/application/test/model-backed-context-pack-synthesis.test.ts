import { deepEqual, equal, rejects } from "node:assert/strict";
import { test } from "node:test";

import {
  ContextPackFreshness,
  ContextPackAttentionLaneKind,
  ContextPackAttentionLaneRefKind,
  ContextPackCurationProfileId,
  ContextPackCurationProfileInstruction,
  ContextPackItemKind,
  ContextPackSourcePointerKind,
  ContextPackUncertaintySeverity,
  ContextPackUncertaintySignalKind,
  DEFAULT_CONTEXT_PACK_CURATION_PROFILE_POLICY_VERSION,
  RunLifecyclePhase,
  RunScope,
  createModelBackedContextPackSynthesisPort,
  type ChatCompletionRequest,
  type ContextPackEphemeralSynthesisRequest,
} from "../src/index.ts";
import { HatLevel } from "../../domain/src/index.ts";

test("model-backed context-pack synthesis sends bounded hat-scoped evidence and parses a briefing", async () => {
  const calls: ChatCompletionRequest[] = [];
  const port = createModelBackedContextPackSynthesisPort({
    chat: {
      complete: async (request) => {
        calls.push(request);
        return JSON.stringify({
          summary: "Director should resolve ownership using the BRD and graph evidence.",
          briefing: {
            title: "Director blocker brief",
            summary: "Billing recovery is blocked by owner ambiguity.",
            evidenceRefs: ["doc:billing-brd", "graph:work-billing"],
            confidence: 0.84,
            uncertaintyExplanation: "BRD and graph evidence are current, but owner data is still indirect.",
            reasons: ["director-decision", "blocked-work"],
          },
          curationEvidenceRefs: ["doc:billing-brd", "graph:work-billing"],
          rankedContextRefs: [{
            itemId: "doc:billing-brd",
            reason: "Business requirements govern this blocker.",
            evidenceRefs: ["doc:billing-brd"],
            uncertaintyExplanation: "BRD is governing context, but it does not name the recovery owner.",
          }],
          gapHypotheses: [{
            message: "Owner decision may be missing.",
            evidenceRefs: ["graph:work-billing"],
            suggestedNextStep: "Ask the engineering manager for the owner record.",
            uncertaintyExplanation: "Graph evidence points to missing ownership rather than proving it.",
          }],
          questions: [{
            audienceHatLevel: "manager",
            question: "Who owns invoice recovery?",
            evidenceRefs: ["doc:billing-brd"],
            uncertaintyExplanation: "The question is needed because the BRD omits the assignee.",
          }],
          recommendedActionRefs: [{
            actionType: "meta.escalate",
            direction: "Open a manager escalation.",
            reason: "Ownership is not present in the supplied context.",
            evidenceRefs: ["doc:billing-brd", "graph:work-billing"],
            uncertaintyExplanation: "Escalation is advisory until manager-owned owner evidence is returned.",
          }],
        });
      },
    },
    maxEvidenceItems: 2,
  });

  const result = await port.synthesize(request());

  equal(calls.length, 1);
  equal(calls[0]?.format, "json");
  equal(calls[0]?.system.includes("deterministic organization context curator"), true);
  equal(calls[0]?.user.includes("hat=engineering_director"), true);
  equal(calls[0]?.user.includes("hatLevel=director"), true);
  equal(calls[0]?.user.includes("scope=project"), true);
  equal(calls[0]?.user.includes("wakeReason=hat_assignment_changed"), true);
  equal(calls[0]?.user.includes("previousContextPack=ctx-previous-director"), true);
  equal(calls[0]?.user.includes("doc:billing-brd"), true);
  equal(calls[0]?.user.includes("graph:work-billing"), true);
  equal(calls[0]?.user.includes("title=Extra memory"), true);
  equal(calls[0]?.user.includes("may cite omission node refs only when they also cite at least one supplied evidence item ref"), true);
  equal(calls[0]?.user.includes("Never report confidence above the weakest cited evidence item confidence"), true);
  equal(calls[0]?.user.includes("Uncertainty signals:"), true);
  equal(calls[0]?.user.includes("kind=low_confidence_evidence | severity=medium | refs=memory:extra"), true);
  equal(calls[0]?.user.includes("Treat uncertainty signals as deterministic bounds; do not resolve them from model judgment."), true);
  equal(calls[0]?.user.includes("Deterministic curation plan:"), true);
  equal(calls[0]?.user.includes(`profile=${ContextPackCurationProfileId.ManagementBlocker}`), true);
  equal(calls[0]?.user.includes(`policyVersion=${DEFAULT_CONTEXT_PACK_CURATION_PROFILE_POLICY_VERSION}`), true);
  equal(calls[0]?.user.includes(`lane=${ContextPackAttentionLaneKind.RequiredDocuments}`), true);
  equal(calls[0]?.user.includes("objective=Resolve the blocker against approved business and architecture context."), true);
  equal(calls[0]?.user.includes(`instruction=${ContextPackCurationProfileInstruction.ManagementBlocker}`), true);
  equal(calls[0]?.user.includes("rankedContextRefs"), true);
  equal(calls[0]?.user.includes("gapHypotheses"), true);
  equal(calls[0]?.user.includes("recommendedActionRefs"), true);
  equal(calls[0]?.user.includes("legalAction=meta.escalate"), true);
  equal(result.summary, "Director should resolve ownership using the BRD and graph evidence.");
  equal(result.briefing?.title, "Director blocker brief");
  equal(result.briefing?.uncertaintyExplanation, "BRD and graph evidence are current, but owner data is still indirect.");
  deepEqual(result.briefing?.evidenceRefs, ["doc:billing-brd", "graph:work-billing"]);
  deepEqual(result.rankedContextRefs, [{
    itemId: "doc:billing-brd",
    reason: "Business requirements govern this blocker.",
    evidenceRefs: ["doc:billing-brd"],
    uncertaintyExplanation: "BRD is governing context, but it does not name the recovery owner.",
  }]);
  deepEqual(result.gapHypotheses, [{
    message: "Owner decision may be missing.",
    evidenceRefs: ["graph:work-billing"],
    suggestedNextStep: "Ask the engineering manager for the owner record.",
    uncertaintyExplanation: "Graph evidence points to missing ownership rather than proving it.",
  }]);
  deepEqual(result.questions, [{
    audienceHatLevel: HatLevel.Manager,
    question: "Who owns invoice recovery?",
    evidenceRefs: ["doc:billing-brd"],
    uncertaintyExplanation: "The question is needed because the BRD omits the assignee.",
  }]);
  deepEqual(result.recommendedActionRefs, [{
    actionType: "meta.escalate",
    direction: "Open a manager escalation.",
    reason: "Ownership is not present in the supplied context.",
    evidenceRefs: ["doc:billing-brd", "graph:work-billing"],
    uncertaintyExplanation: "Escalation is advisory until manager-owned owner evidence is returned.",
  }]);
  deepEqual(result.curationEvidenceRefs, ["doc:billing-brd", "graph:work-billing"]);
});

test("model-backed context-pack synthesis rejects malformed model output", async () => {
  const port = createModelBackedContextPackSynthesisPort({
    chat: {
      complete: async () => "not json",
    },
  });

  await rejects(
    async () => await port.synthesize(request()),
    errorMessageIncludes("context-pack synthesis model returned invalid JSON"),
  );
});

test("model-backed context-pack synthesis rejects briefings without evidence", async () => {
  const port = createModelBackedContextPackSynthesisPort({
    chat: {
      complete: async () => JSON.stringify({
        summary: "A summary exists.",
        briefing: {
          title: "No citations",
          summary: "This should not enter context.",
          evidenceRefs: [],
        },
      }),
    },
  });

  await rejects(
    async () => await port.synthesize(request()),
    errorMessageIncludes("context-pack synthesis briefing requires evidenceRefs"),
  );
});

test("model-backed context-pack synthesis caps advisory arrays from model output", async () => {
  const port = createModelBackedContextPackSynthesisPort({
    chat: {
      complete: async () => JSON.stringify({
        summary: "Capped advisories.",
        rankedContextRefs: [
          { itemId: "doc:billing-brd", reason: "first", evidenceRefs: ["doc:billing-brd"] },
          { itemId: "graph:work-billing", reason: "second", evidenceRefs: ["graph:work-billing"] },
        ],
        gapHypotheses: [
          { message: "first gap", evidenceRefs: ["doc:billing-brd"] },
          { message: "second gap", evidenceRefs: ["graph:work-billing"] },
        ],
        questions: [
          { question: "first question", evidenceRefs: ["doc:billing-brd"] },
          { question: "second question", evidenceRefs: ["graph:work-billing"] },
        ],
        recommendedActionRefs: [
          { actionType: "meta.escalate", direction: "first action", reason: "first reason", evidenceRefs: ["doc:billing-brd"] },
          { actionType: "work.merge", direction: "second action", reason: "second reason", evidenceRefs: ["graph:work-billing"] },
        ],
      }),
    },
    maxAdvisoryItems: 1,
  });

  const result = await port.synthesize(request());

  deepEqual(result.rankedContextRefs, [{
    itemId: "doc:billing-brd",
    reason: "first",
    evidenceRefs: ["doc:billing-brd"],
  }]);
  deepEqual(result.gapHypotheses, [{
    message: "first gap",
    evidenceRefs: ["doc:billing-brd"],
  }]);
  deepEqual(result.questions, [{
    question: "first question",
    evidenceRefs: ["doc:billing-brd"],
  }]);
  deepEqual(result.recommendedActionRefs, [{
    actionType: "meta.escalate",
    direction: "first action",
    reason: "first reason",
    evidenceRefs: ["doc:billing-brd"],
  }]);
});

function errorMessageIncludes(expected: string): (error: unknown) => boolean {
  return (error): boolean => error instanceof Error && error.message.includes(expected);
}

function request(): ContextPackEphemeralSynthesisRequest {
  return {
    query: "engineering_director blocked billing",
    observedAt: "2026-05-31T12:00:00.000Z",
    hatId: "engineering_director",
    hatLevel: HatLevel.Director,
    scope: RunScope.Project,
    phase: RunLifecyclePhase.Blocked,
    agentId: "agent-director",
    organizationId: "org-lfg",
    projectId: "project-billing",
    workItemId: "work-billing",
    wakeContext: {
      reason: "hat_assignment_changed",
      requiresBuild: true,
      previousContextPackId: "ctx-previous-director",
    },
    legalActions: [
      {
        actionType: "meta.escalate",
        toPhase: RunLifecyclePhase.Blocked,
        toScope: RunScope.Project,
        rationale: "Escalate blocker to the supervisor chain.",
      },
    ],
    curationPlan: {
      profileId: ContextPackCurationProfileId.ManagementBlocker,
      policyVersion: DEFAULT_CONTEXT_PACK_CURATION_PROFILE_POLICY_VERSION,
      lanes: [
        {
          kind: ContextPackAttentionLaneKind.RequiredDocuments,
          priority: 20,
          objective: "Resolve the blocker against approved business and architecture context.",
          required: true,
          refs: [{ kind: ContextPackAttentionLaneRefKind.Item, itemId: "doc:billing-brd" }],
        },
        {
          kind: ContextPackAttentionLaneKind.Memory,
          priority: 50,
          objective: "Use scoped memory only as advisory color after source-of-truth context.",
          required: false,
          refs: [{ kind: ContextPackAttentionLaneRefKind.Item, itemId: "memory:extra" }],
        },
      ],
      deterministicInstructions: [
        ContextPackCurationProfileInstruction.ManagementBlocker,
      ],
    },
    items: [
      {
        id: "doc:billing-brd",
        kind: ContextPackItemKind.BusinessDocument,
        title: "Billing BRD",
        summary: "Recover failed invoices.",
        sourceRef: "git://docs/billing-brd.md",
        required: true,
        freshness: ContextPackFreshness.Current,
        confidence: 1,
        reasons: ["business requirement"],
        citationRefs: ["doc:billing-brd"],
        sourcePointers: [{
          kind: ContextPackSourcePointerKind.DocUnit,
          docUnitId: "billing-brd",
          contentRef: "git://docs/billing-brd.md",
          contentHash: "hash-brd",
          sourceId: "source-main",
          version: 1,
        }],
      },
      {
        id: "graph:work-billing",
        kind: ContextPackItemKind.GraphNeighborhood,
        title: "Work graph",
        summary: "outbound=1; inbound=0; changes=0",
        sourceRef: "graph:work-billing",
        required: false,
        freshness: ContextPackFreshness.Live,
        confidence: 0.9,
        reasons: ["work root"],
        citationRefs: ["graph:work-billing"],
        sourcePointers: [{ kind: ContextPackSourcePointerKind.GraphNode, nodeId: "work-billing" }],
      },
      {
        id: "memory:extra",
        kind: ContextPackItemKind.MemoryPointer,
        title: "Extra memory",
        summary: "This should be outside the bounded model prompt.",
        sourceRef: "hindsight:extra",
        required: false,
        freshness: ContextPackFreshness.Current,
        confidence: 0.7,
        reasons: ["memory"],
        citationRefs: ["memory:extra"],
        sourcePointers: [{
          kind: ContextPackSourcePointerKind.HindsightMemory,
          providerId: "hindsight",
          memoryId: "extra",
          advisory: true,
        }],
      },
    ],
    omissions: [],
    contradictions: [],
    uncertaintySignals: [{
      kind: ContextPackUncertaintySignalKind.LowConfidenceEvidence,
      severity: ContextPackUncertaintySeverity.Medium,
      evidenceRefs: ["memory:extra"],
      message: "Memory is useful but below the strong-evidence threshold.",
    }],
  };
}
