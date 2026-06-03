import type {
  ChatCompletionPort,
  ChatCompletionResult,
} from "./model-backed-composer.ts";
import { HatLevel } from "../../domain/src/index.ts";
import type {
  ContextPackEphemeralGapHypothesis,
  ContextPackEphemeralQuestion,
  ContextPackEphemeralRankedContextRef,
  ContextPackEphemeralRecommendedActionRef,
  ContextPackEphemeralSynthesisBriefing,
  ContextPackEphemeralSynthesisPort,
  ContextPackEphemeralSynthesisRequest,
  ContextPackEphemeralSynthesisResult,
} from "./context-pack-builder.ts";
import type {
  ContextPackItem,
  ContextPackOmittedItem,
} from "./observe.ts";
import { ContextPackAttentionLaneRefKind } from "./observe.ts";
import { ContextPackUncertaintySeverity } from "./observe.ts";

export type CreateModelBackedContextPackSynthesisInput = {
  chat: ChatCompletionPort;
  maxEvidenceItems?: number | undefined;
  maxOmissions?: number | undefined;
  maxContradictions?: number | undefined;
  maxAdvisoryItems?: number | undefined;
  maxLaneRefDetails?: number | undefined;
  maxUncertaintySignals?: number | undefined;
};

const DEFAULT_MAX_EVIDENCE_ITEMS = 8;
const DEFAULT_MAX_OMISSIONS = 5;
const DEFAULT_MAX_CONTRADICTIONS = 5;
const DEFAULT_MAX_ADVISORY_ITEMS = 8;
const DEFAULT_MAX_LANE_REF_DETAILS = 3;
const DEFAULT_MAX_UNCERTAINTY_SIGNALS = 6;
const CONTEXT_PACK_SYNTHESIS_SYSTEM_PROMPT =
  "You are a deterministic organization context curator. You may summarize, rank, and brief only the supplied context. Return JSON only. Do not invent facts, sources, tools, authority, or missing documents. Any briefing or advisory must cite supplied evidence refs.";
const INVALID_JSON_MESSAGE = "context-pack synthesis model returned invalid JSON";
const SUMMARY_REQUIRED_MESSAGE = "context-pack synthesis requires a non-empty summary";
const BRIEFING_EVIDENCE_REQUIRED_MESSAGE = "context-pack synthesis briefing requires evidenceRefs";

type ParsedSynthesisPayload = {
  summary?: unknown;
  briefing?: unknown;
  rankedContextRefs?: unknown;
  gapHypotheses?: unknown;
  questions?: unknown;
  recommendedActionRefs?: unknown;
  curationEvidenceRefs?: unknown;
};

type ParsedBriefingPayload = {
  title?: unknown;
  summary?: unknown;
  evidenceRefs?: unknown;
  confidence?: unknown;
  uncertaintyExplanation?: unknown;
  reasons?: unknown;
};

type ParsedRankedContextRefPayload = {
  itemId?: unknown;
  reason?: unknown;
  evidenceRefs?: unknown;
  uncertaintyExplanation?: unknown;
};

type ParsedGapHypothesisPayload = {
  message?: unknown;
  evidenceRefs?: unknown;
  suggestedNextStep?: unknown;
  confidence?: unknown;
  uncertaintyExplanation?: unknown;
};

type ParsedQuestionPayload = {
  audienceHatLevel?: unknown;
  question?: unknown;
  evidenceRefs?: unknown;
  uncertaintyExplanation?: unknown;
};

type ParsedRecommendedActionRefPayload = {
  actionType?: unknown;
  direction?: unknown;
  reason?: unknown;
  evidenceRefs?: unknown;
  uncertaintyExplanation?: unknown;
};

export function createModelBackedContextPackSynthesisPort(
  input: CreateModelBackedContextPackSynthesisInput,
): ContextPackEphemeralSynthesisPort {
  return {
    synthesize: async (request): Promise<ContextPackEphemeralSynthesisResult> => {
      const completion = await input.chat.complete({
        system: CONTEXT_PACK_SYNTHESIS_SYSTEM_PROMPT,
        user: contextPackSynthesisPrompt(request, input),
        format: "json",
      });
      return parseContextPackSynthesisCompletion(completion, input.maxAdvisoryItems ?? DEFAULT_MAX_ADVISORY_ITEMS);
    },
  };
}

function contextPackSynthesisPrompt(
  request: ContextPackEphemeralSynthesisRequest,
  input: CreateModelBackedContextPackSynthesisInput,
): string {
  return [
    "Curate the context pack for this hat and moment.",
    [
      `hat=${request.hatId}`,
      `hatLevel=${request.hatLevel}`,
      `scope=${request.scope}`,
      `phase=${request.phase}`,
      `agent=${request.agentId ?? "unknown"}`,
      `org=${request.organizationId ?? "unknown"}`,
      `project=${request.projectId ?? "unknown"}`,
      `team=${request.teamId ?? "unknown"}`,
      `workItem=${request.workItemId ?? "unknown"}`,
      `wakeReason=${request.wakeContext?.reason ?? "unknown"}`,
      `wakeRequiresBuild=${String(request.wakeContext?.requiresBuild ?? false)}`,
      `previousContextPack=${request.wakeContext?.previousContextPackId ?? "unknown"}`,
      `previousContextStatus=${request.wakeContext?.previousStatus ?? "unknown"}`,
      `observedAt=${request.observedAt}`,
    ].join("\n"),
    "",
    `retrievalQuery=${request.query}`,
    "",
    "Deterministic curation plan:",
    `profile=${request.curationPlan.profileId ?? "unknown"}`,
    `policyVersion=${request.curationPlan.policyVersion ?? "unknown"}`,
    ...request.curationPlan.lanes.map(formatCurationLane),
    ...request.curationPlan.deterministicInstructions.map((instruction) => `- instruction=${instruction}`),
    "",
    "Lane details:",
    ...formatCurationLaneDetails(request, input.maxLaneRefDetails ?? DEFAULT_MAX_LANE_REF_DETAILS),
    "",
    "Evidence items:",
    ...boundedItems(request.items, input.maxEvidenceItems ?? DEFAULT_MAX_EVIDENCE_ITEMS).map(formatEvidenceItem),
    "",
    "Omissions:",
    ...boundedOmissions(request.omissions, input.maxOmissions ?? DEFAULT_MAX_OMISSIONS).map(formatOmission),
    "Gap hypotheses, questions, ranked refs, and recommended action refs may cite omission node refs only when they also cite at least one supplied evidence item ref.",
    "Never report confidence above the weakest cited evidence item confidence; omit confidence when uncertain.",
    "",
    "Uncertainty signals:",
    ...boundedUncertaintySignals(request.uncertaintySignals, input.maxUncertaintySignals ?? DEFAULT_MAX_UNCERTAINTY_SIGNALS)
      .map(formatUncertaintySignal),
    "Treat uncertainty signals as deterministic bounds; do not resolve them from model judgment.",
    "",
    "Known contradictions:",
    ...request.contradictions.slice(0, input.maxContradictions ?? DEFAULT_MAX_CONTRADICTIONS).map((item) => `- ${item}`),
    "",
    "Legal observe actions:",
    ...request.legalActions.map(formatLegalAction),
    "",
    "Return this JSON shape:",
    JSON.stringify({
      summary: "one concise hat-specific synthesis",
      briefing: {
        title: "briefing title",
        summary: "briefing summary",
        evidenceRefs: ["doc:example"],
        confidence: 0.8,
        uncertaintyExplanation: "why confidence is bounded by the cited evidence",
        reasons: ["hat-specific reason"],
      },
      rankedContextRefs: [{
        itemId: "doc:example",
        reason: "why this context matters most",
        evidenceRefs: ["doc:example"],
        uncertaintyExplanation: "what remains uncertain about this ranking",
      }],
      gapHypotheses: [{
        message: "missing or weak context hypothesis",
        evidenceRefs: ["doc:example"],
        suggestedNextStep: "who or what to consult next",
        confidence: 0.7,
        uncertaintyExplanation: "what the cited evidence does and does not prove",
      }],
      questions: [{
        audienceHatLevel: "manager",
        question: "one precise question",
        evidenceRefs: ["doc:example"],
        uncertaintyExplanation: "why this question is still unresolved",
      }],
      recommendedActionRefs: [{
        actionType: "meta.escalate",
        direction: "legal next action to consider",
        reason: "why this action fits the supplied evidence",
        evidenceRefs: ["doc:example"],
        uncertaintyExplanation: "why this action remains advisory",
      }],
      curationEvidenceRefs: ["doc:example"],
    }),
  ].join("\n");
}

function formatCurationLane(lane: ContextPackEphemeralSynthesisRequest["curationPlan"]["lanes"][number]): string {
  return [
    `- lane=${lane.kind}`,
    `priority=${lane.priority}`,
    `required=${String(lane.required)}`,
    `objective=${lane.objective}`,
    `refs=${lane.refs.map(formatLaneRef).join(",")}`,
  ].join(" | ");
}

function formatLaneRef(ref: ContextPackEphemeralSynthesisRequest["curationPlan"]["lanes"][number]["refs"][number]): string {
  switch (ref.kind) {
    case ContextPackAttentionLaneRefKind.Item:
      return `item:${ref.itemId}`;
    case ContextPackAttentionLaneRefKind.Omission:
      return `omission:${ref.omissionRef}`;
    case ContextPackAttentionLaneRefKind.LegalAction:
      return `legal_action:${ref.actionType}`;
    case ContextPackAttentionLaneRefKind.ScopeAnchor:
      return `scope_anchor:${ref.anchorRef}`;
  }
}

function formatCurationLaneDetails(
  request: ContextPackEphemeralSynthesisRequest,
  maxLaneRefDetails: number,
): readonly string[] {
  return request.curationPlan.lanes.flatMap((lane) =>
    lane.refs.slice(0, maxLaneRefDetails).map((ref) => formatCurationLaneRefDetail(lane.kind, ref, request))
  );
}

function formatCurationLaneRefDetail(
  laneKind: ContextPackEphemeralSynthesisRequest["curationPlan"]["lanes"][number]["kind"],
  ref: ContextPackEphemeralSynthesisRequest["curationPlan"]["lanes"][number]["refs"][number],
  request: ContextPackEphemeralSynthesisRequest,
): string {
  switch (ref.kind) {
    case ContextPackAttentionLaneRefKind.Item: {
      const item = request.items.find((candidate) => candidate.id === ref.itemId);
      return item === undefined
        ? `- lane=${laneKind} | missingItem=${ref.itemId}`
        : `- lane=${laneKind} | ${formatEvidenceItem(item)}`;
    }
    case ContextPackAttentionLaneRefKind.Omission: {
      const omission = request.omissions.find((candidate) =>
        candidate.nodeId === ref.omissionRef || `omission:${candidate.reason}` === ref.omissionRef
      );
      return omission === undefined
        ? `- lane=${laneKind} | missingOmission=${ref.omissionRef}`
        : `- lane=${laneKind} | ${formatOmission(omission)}`;
    }
    case ContextPackAttentionLaneRefKind.LegalAction: {
      const action = request.legalActions.find((candidate) => candidate.actionType === ref.actionType);
      return action === undefined
        ? `- lane=${laneKind} | missingLegalAction=${ref.actionType}`
        : `- lane=${laneKind} | ${formatLegalAction(action)}`;
    }
    case ContextPackAttentionLaneRefKind.ScopeAnchor:
      return `- lane=${laneKind} | scopeAnchor=${ref.anchorRef}`;
  }
}

function boundedItems(items: readonly ContextPackItem[], maxItems: number): readonly ContextPackItem[] {
  return items
    .slice()
    .sort((left, right) => Number(right.required) - Number(left.required) || right.confidence - left.confidence)
    .slice(0, maxItems);
}

function boundedOmissions(
  omissions: readonly ContextPackOmittedItem[],
  maxOmissions: number,
): readonly ContextPackOmittedItem[] {
  return omissions.slice(0, maxOmissions);
}

function boundedUncertaintySignals(
  signals: ContextPackEphemeralSynthesisRequest["uncertaintySignals"],
  maxSignals: number,
): ContextPackEphemeralSynthesisRequest["uncertaintySignals"] {
  return signals
    .slice()
    .sort((left, right) => uncertaintySeverityRank(right.severity) - uncertaintySeverityRank(left.severity))
    .slice(0, maxSignals);
}

function uncertaintySeverityRank(severity: ContextPackEphemeralSynthesisRequest["uncertaintySignals"][number]["severity"]): number {
  switch (severity) {
    case ContextPackUncertaintySeverity.High:
      return 3;
    case ContextPackUncertaintySeverity.Medium:
      return 2;
    case ContextPackUncertaintySeverity.Low:
      return 1;
  }
}

function formatUncertaintySignal(signal: ContextPackEphemeralSynthesisRequest["uncertaintySignals"][number]): string {
  return [
    `- kind=${signal.kind}`,
    `severity=${signal.severity}`,
    `refs=${signal.evidenceRefs.join(",")}`,
    `message=${signal.message}`,
  ].join(" | ");
}

function formatEvidenceItem(item: ContextPackItem): string {
  return [
    `- ref=${item.id}`,
    `kind=${item.kind}`,
    `required=${String(item.required)}`,
    `freshness=${item.freshness}`,
    `confidence=${item.confidence}`,
    `title=${item.title}`,
    `summary=${item.summary}`,
    `citations=${(item.citationRefs ?? [item.sourceRef]).join(",")}`,
  ].join(" | ");
}

function formatOmission(omission: ContextPackOmittedItem): string {
  return `- reason=${omission.reason} | node=${omission.nodeId ?? "unknown"} | message=${omission.message}`;
}

function formatLegalAction(action: ContextPackEphemeralSynthesisRequest["legalActions"][number]): string {
  return [
    `- legalAction=${action.actionType}`,
    `toPhase=${action.toPhase}`,
    `toScope=${action.toScope}`,
    `rationale=${action.rationale}`,
  ].join(" | ");
}

function parseContextPackSynthesisCompletion(
  completion: ChatCompletionResult,
  maxAdvisoryItems: number,
): ContextPackEphemeralSynthesisResult {
  const parsed = parseJsonObject(completionContent(completion));
  const summary = parseRequiredString(parsed.summary, SUMMARY_REQUIRED_MESSAGE);
  return {
    summary,
    ...optionalBriefing(parsed.briefing),
    ...optionalRankedContextRefs(parsed.rankedContextRefs, maxAdvisoryItems),
    ...optionalGapHypotheses(parsed.gapHypotheses, maxAdvisoryItems),
    ...optionalQuestions(parsed.questions, maxAdvisoryItems),
    ...optionalRecommendedActionRefs(parsed.recommendedActionRefs, maxAdvisoryItems),
    ...optionalCurationEvidenceRefs(parsed.curationEvidenceRefs),
  };
}

function optionalBriefing(value: unknown): { briefing?: ContextPackEphemeralSynthesisBriefing } {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error("context-pack synthesis briefing must be an object");
  const payload = value as ParsedBriefingPayload;
  const title = parseRequiredString(payload.title, "context-pack synthesis briefing requires title");
  const summary = parseRequiredString(payload.summary, "context-pack synthesis briefing requires summary");
  const evidenceRefs = parseStringArray(payload.evidenceRefs);
  if (evidenceRefs.length === 0) throw new Error(BRIEFING_EVIDENCE_REQUIRED_MESSAGE);
  return {
    briefing: {
      title,
      summary,
      evidenceRefs,
      ...optionalConfidence(payload.confidence),
      ...optionalStringField("uncertaintyExplanation", payload.uncertaintyExplanation),
      ...optionalReasons(payload.reasons),
    },
  };
}

function optionalRankedContextRefs(
  value: unknown,
  maxItems: number,
): { rankedContextRefs?: readonly ContextPackEphemeralRankedContextRef[] } {
  if (value === undefined) return {};
  return {
    rankedContextRefs: parseObjectArray(value, "rankedContextRefs").slice(0, maxItems).map((entry) => {
      const payload = entry as ParsedRankedContextRefPayload;
      return {
        itemId: parseRequiredString(payload.itemId, "context-pack synthesis rankedContextRefs require itemId"),
        reason: parseRequiredString(payload.reason, "context-pack synthesis rankedContextRefs require reason"),
        evidenceRefs: parseNonEmptyEvidenceRefs(payload.evidenceRefs, "context-pack synthesis rankedContextRefs require evidenceRefs"),
        ...optionalStringField("uncertaintyExplanation", payload.uncertaintyExplanation),
      };
    }),
  };
}

function optionalGapHypotheses(
  value: unknown,
  maxItems: number,
): { gapHypotheses?: readonly ContextPackEphemeralGapHypothesis[] } {
  if (value === undefined) return {};
  return {
    gapHypotheses: parseObjectArray(value, "gapHypotheses").slice(0, maxItems).map((entry) => {
      const payload = entry as ParsedGapHypothesisPayload;
      return {
        message: parseRequiredString(payload.message, "context-pack synthesis gapHypotheses require message"),
        evidenceRefs: parseNonEmptyEvidenceRefs(payload.evidenceRefs, "context-pack synthesis gapHypotheses require evidenceRefs"),
        ...optionalStringField("suggestedNextStep", payload.suggestedNextStep),
        ...optionalConfidence(payload.confidence),
        ...optionalStringField("uncertaintyExplanation", payload.uncertaintyExplanation),
      };
    }),
  };
}

function optionalQuestions(value: unknown, maxItems: number): { questions?: readonly ContextPackEphemeralQuestion[] } {
  if (value === undefined) return {};
  return {
    questions: parseObjectArray(value, "questions").slice(0, maxItems).map((entry) => {
      const payload = entry as ParsedQuestionPayload;
      return {
        question: parseRequiredString(payload.question, "context-pack synthesis questions require question"),
        evidenceRefs: parseNonEmptyEvidenceRefs(payload.evidenceRefs, "context-pack synthesis questions require evidenceRefs"),
        ...optionalAudienceHatLevel(payload.audienceHatLevel),
        ...optionalStringField("uncertaintyExplanation", payload.uncertaintyExplanation),
      };
    }),
  };
}

function optionalRecommendedActionRefs(
  value: unknown,
  maxItems: number,
): { recommendedActionRefs?: readonly ContextPackEphemeralRecommendedActionRef[] } {
  if (value === undefined) return {};
  return {
    recommendedActionRefs: parseObjectArray(value, "recommendedActionRefs").slice(0, maxItems).map((entry) => {
      const payload = entry as ParsedRecommendedActionRefPayload;
      return {
        actionType: parseRequiredString(payload.actionType, "context-pack synthesis recommendedActionRefs require actionType"),
        ...optionalStringField("direction", payload.direction),
        reason: parseRequiredString(payload.reason, "context-pack synthesis recommendedActionRefs require reason"),
        evidenceRefs: parseNonEmptyEvidenceRefs(payload.evidenceRefs, "context-pack synthesis recommendedActionRefs require evidenceRefs"),
        ...optionalStringField("uncertaintyExplanation", payload.uncertaintyExplanation),
      };
    }),
  };
}

function parseObjectArray(value: unknown, fieldName: string): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`context-pack synthesis ${fieldName} must be an array`);
  return value.map((entry) => {
    if (!isRecord(entry)) throw new Error(`context-pack synthesis ${fieldName} entries must be objects`);
    return entry;
  });
}

function parseNonEmptyEvidenceRefs(value: unknown, message: string): readonly string[] {
  const refs = parseStringArray(value);
  if (refs.length === 0) throw new Error(message);
  return refs;
}

function optionalStringField<Key extends string>(
  key: Key,
  value: unknown,
): Record<Key, string> | {} {
  if (value === undefined) return {};
  return { [key]: parseRequiredString(value, `context-pack synthesis ${key} must be a string`) } as Record<Key, string>;
}

function optionalAudienceHatLevel(value: unknown): { audienceHatLevel?: HatLevel } {
  if (value === undefined) return {};
  const parsed = parseRequiredString(value, "context-pack synthesis audienceHatLevel must be a string");
  if (!isHatLevel(parsed)) throw new Error(`context-pack synthesis unknown audienceHatLevel '${parsed}'`);
  return { audienceHatLevel: parsed };
}

function isHatLevel(value: string): value is HatLevel {
  return Object.values(HatLevel).includes(value as HatLevel);
}

function optionalConfidence(value: unknown): { confidence?: number } {
  if (value === undefined) return {};
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("context-pack synthesis briefing confidence must be numeric");
  }
  return { confidence: Math.max(0, Math.min(1, value)) };
}

function optionalReasons(value: unknown): { reasons?: readonly string[] } {
  if (value === undefined) return {};
  return { reasons: parseStringArray(value) };
}

function optionalCurationEvidenceRefs(value: unknown): { curationEvidenceRefs?: readonly string[] } {
  if (value === undefined) return {};
  return { curationEvidenceRefs: parseStringArray(value) };
}

function parseJsonObject(raw: string): ParsedSynthesisPayload {
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) throw new Error("not an object");
    return parsed as ParsedSynthesisPayload;
  } catch (error) {
    throw new Error(`${INVALID_JSON_MESSAGE}: ${errorMessage(error)}`);
  }
}

function parseRequiredString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }
  return value.trim();
}

function parseStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) throw new Error("context-pack synthesis expected a string array");
  return uniqueStrings(value.map((entry) => parseRequiredString(entry, "context-pack synthesis array entry must be a string")));
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function completionContent(completion: ChatCompletionResult): string {
  return typeof completion === "string" ? completion : completion.content;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
