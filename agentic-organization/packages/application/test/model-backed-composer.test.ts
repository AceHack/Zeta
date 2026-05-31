import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { RecordingTelemetry, TelemetryMetricKind } from "../../observability/src/index.ts";
import {
  ComposerDecision,
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  type ComposerSelectionRequest,
  type RunStateReadout,
} from "../src/observe.ts";
import { createFirstLegalOptionComposer } from "../src/reaction-decision.ts";
import { createModelBackedComposer, type ChatCompletionPort, type ChatCompletionResult } from "../src/model-backed-composer.ts";

function readout(): RunStateReadout {
  return {
    runId: asZetaIdDecimal("123"),
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingReview,
    trace: { correlationId: "c", causationId: "c", traceId: "t" },
    observedAt: "2026-05-30T07:00:00.000Z",
    deterministicRulesApplied: ["gate-precondition", "evidence-precondition"],
    vetoedOptions: [],
    options: [
      { actionType: "complete", toPhase: RunLifecyclePhase.Completed, toScope: RunScope.WorkItem, requiresGate: false, requiresEvidence: true, rationale: "reviewer approved" },
      { actionType: "rework", toPhase: RunLifecyclePhase.Executing, toScope: RunScope.WorkItem, requiresGate: false, requiresEvidence: false, rationale: "reviewer requested changes" },
    ],
  };
}

const request: ComposerSelectionRequest = { readout: readout() };

function chat(reply: ChatCompletionResult | (() => Promise<ChatCompletionResult>)): ChatCompletionPort {
  return { complete: async () => (typeof reply === "function" ? reply() : reply) };
}

test("selects the legal option the model names", async () => {
  const composer = createModelBackedComposer({ chat: chat("rework"), fallback: createFirstLegalOptionComposer() });
  const selection = await composer.compose(request);

  equal(selection.decision, ComposerDecision.Select);
  if (selection.decision !== ComposerDecision.Select) return;
  equal(selection.option.actionType, "rework");
  ok(selection.reason.includes("model selected"));
});

test("tolerates chatty model output and still extracts the legal token", async () => {
  const composer = createModelBackedComposer({
    chat: chat("I think the best move here is: complete. That closes it out."),
    fallback: createFirstLegalOptionComposer(),
  });
  const selection = await composer.compose(request);

  equal(selection.decision, ComposerDecision.Select);
  if (selection.decision !== ComposerDecision.Select) return;
  equal(selection.option.actionType, "complete");
});

test("accepts the model naming the target phase instead of the actionType", async () => {
  // a small model often replies with the phase ("rework" -> phase "executing")
  const composer = createModelBackedComposer({ chat: chat("ActionType: Executing"), fallback: createFirstLegalOptionComposer() });
  const selection = await composer.compose(request);

  equal(selection.decision, ComposerDecision.Select);
  if (selection.decision !== ComposerDecision.Select) return;
  // 'executing' is the toPhase of the 'rework' option
  equal(selection.option.actionType, "rework");
});

test("falls back to the deterministic composer when the model names an illegal move", async () => {
  const composer = createModelBackedComposer({ chat: chat("delete_everything"), fallback: createFirstLegalOptionComposer() });
  const selection = await composer.compose(request);

  // illegal/unparseable → deterministic first legal option (complete)
  equal(selection.decision, ComposerDecision.Select);
  if (selection.decision !== ComposerDecision.Select) return;
  equal(selection.option.actionType, "complete");
});

test("falls back when the model call throws (model unreachable keeps the agent alive)", async () => {
  const composer = createModelBackedComposer({
    chat: chat(async () => {
      throw new Error("connection refused");
    }),
    fallback: createFirstLegalOptionComposer(),
  });
  const selection = await composer.compose(request);

  equal(selection.decision, ComposerDecision.Select);
  if (selection.decision !== ComposerDecision.Select) return;
  equal(selection.option.actionType, "complete");
});

test("records model token and cost telemetry with hat and model labels", async () => {
  const telemetry = new RecordingTelemetry();
  const composer = createModelBackedComposer({
    chat: chat({
      content: "rework",
      model: "llama3.1",
      promptTokens: 11,
      completionTokens: 7,
      costUsd: 0.0025,
    }),
    fallback: createFirstLegalOptionComposer(),
    telemetry,
    model: "configured-model",
  });

  const selection = await composer.compose({
    ...request,
    telemetry: {
      hat: "engineering_manager",
    },
  });

  equal(selection.decision, ComposerDecision.Select);
  deepEqual(telemetry.metrics, [
    {
      kind: TelemetryMetricKind.Counter,
      name: "org_agent_tokens_total",
      value: 18,
      attributes: {
        "agentic.hat": "engineering_manager",
        "llm.model": "llama3.1",
      },
    },
    {
      kind: TelemetryMetricKind.Counter,
      name: "org_agent_cost_usd",
      value: 0.0025,
      attributes: {
        "agentic.hat": "engineering_manager",
        "llm.model": "llama3.1",
      },
    },
  ]);
});
