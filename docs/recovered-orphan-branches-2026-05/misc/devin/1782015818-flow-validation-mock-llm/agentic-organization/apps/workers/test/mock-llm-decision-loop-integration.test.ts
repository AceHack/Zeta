/**
 * Mock-LLM decision-loop integration — exercises the agent's model-backed
 * decision flow end-to-end over a real HTTP boundary, with no real model and no
 * credentials. It wires the production Ollama adapter (`createOllamaChatPort`)
 * to a mock Ollama provider, drives it through `createModelBackedComposer`, and
 * asserts the loop's load-bearing invariants:
 *
 *   1. the model's choice actually drives the selection (model-in-the-loop);
 *   2. the model can only ever pick a LEGAL option — an illegal or unreachable
 *      model falls back to the deterministic baseline (the guardrail can never
 *      be widened by the model);
 *   3. the adapter sends the legal moves + temperature 0 + structured format
 *      the decision flow depends on;
 *   4. the same invariants hold when driven through the full documented loop
 *      (`decideAsync`: observe -> menu -> decide -> legality re-check).
 *
 * This is the "use mock LLM providers to start" harness for validating the
 * documented observe -> options -> decide loop without a GPU/model in cluster.
 */

import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ComposerDecision,
  DecideOutcome,
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  createFirstLegalOptionComposer,
  createModelBackedComposer,
  decideAsync,
  type AsyncEphemeralComposerPort,
  type ComposerSelectionRequest,
  type ObserveDependencies,
  type RunSnapshot,
  type RunStateReadout,
} from "../../../packages/application/src/index.ts";
import { createOllamaChatPort } from "../src/adapters/ollama-chat-port.ts";
import {
  decideFirstLegalMove,
  startMockOllamaServer,
  type MockOllamaDecision,
  type MockOllamaServerHandle,
} from "./support/mock-ollama-server.ts";

const MockModelName = "mock-llama";

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
      {
        actionType: "complete",
        toPhase: RunLifecyclePhase.Completed,
        toScope: RunScope.WorkItem,
        requiresGate: false,
        requiresEvidence: true,
        rationale: "reviewer approved",
      },
      {
        actionType: "rework",
        toPhase: RunLifecyclePhase.Executing,
        toScope: RunScope.WorkItem,
        requiresGate: false,
        requiresEvidence: false,
        rationale: "reviewer requested changes",
      },
    ],
  };
}

const request: ComposerSelectionRequest = { readout: readout() };

function composerFor(server: MockOllamaServerHandle): AsyncEphemeralComposerPort {
  return createModelBackedComposer({
    chat: createOllamaChatPort({ baseUrl: server.baseUrl, model: MockModelName, timeoutMs: 5_000 }),
    fallback: createFirstLegalOptionComposer(),
    model: MockModelName,
  });
}

type WithServerOptions = {
  decide?: MockOllamaDecision;
  failureStatus?: number;
};

async function withServer(
  options: WithServerOptions,
  run: (server: MockOllamaServerHandle) => Promise<void>,
): Promise<void> {
  const server = await startMockOllamaServer(options.decide === undefined ? {} : { decide: options.decide });
  if (options.failureStatus !== undefined) {
    server.setFailureStatus(options.failureStatus);
  }
  try {
    await run(server);
  } finally {
    await server.close();
  }
}

test("the model's choice drives the selection (model-in-the-loop, distinct from the deterministic baseline)", async () => {
  // default strategy names the LAST legal move; the deterministic fallback picks the FIRST ("complete").
  await withServer({}, async (server) => {
    const selection = await composerFor(server).compose(request);

    equal(selection.decision, ComposerDecision.Select);
    if (selection.decision !== ComposerDecision.Select) return;
    equal(selection.option.actionType, "rework");
    ok(selection.reason.includes("model selected"));
  });
});

test("the adapter sends the legal moves, temperature 0, and both system+user roles", async () => {
  await withServer({}, async (server) => {
    await composerFor(server).compose(request);

    const last = server.requests[server.requests.length - 1];
    ok(last, "mock server should have received a chat request");
    equal(last.model, MockModelName);
    equal(last.options?.temperature, 0);
    equal(last.stream, false);
    const roles = (last.messages ?? []).map((m) => m.role);
    ok(roles.includes("system"));
    ok(roles.includes("user"));
    const user = last.messages?.find((m) => m.role === "user")?.content ?? "";
    ok(user.includes("complete"));
    ok(user.includes("rework"));
  });
});

test("an illegal model choice cannot widen the guardrail (falls back to the deterministic first legal move)", async () => {
  await withServer({ decide: () => "delete_everything" }, async (server) => {
    const selection = await composerFor(server).compose(request);

    equal(selection.decision, ComposerDecision.Select);
    if (selection.decision !== ComposerDecision.Select) return;
    equal(selection.option.actionType, "complete");
  });
});

test("an unreachable/erroring model keeps the agent alive (deterministic fallback)", async () => {
  await withServer({ failureStatus: 503 }, async (server) => {
    const selection = await composerFor(server).compose(request);

    equal(selection.decision, ComposerDecision.Select);
    if (selection.decision !== ComposerDecision.Select) return;
    equal(selection.option.actionType, "complete");
  });
});

test("naming the target phase instead of the actionType still resolves to the legal option", async () => {
  // small models often reply with the phase token ("executing") rather than the actionType ("rework")
  await withServer({ decide: () => "executing" }, async (server) => {
    const selection = await composerFor(server).compose(request);

    equal(selection.decision, ComposerDecision.Select);
    if (selection.decision !== ComposerDecision.Select) return;
    equal(selection.option.actionType, "rework");
  });
});

test("the deterministic-first strategy matches the baseline (mock and fallback agree)", async () => {
  await withServer({ decide: decideFirstLegalMove }, async (server) => {
    const selection = await composerFor(server).compose(request);

    equal(selection.decision, ComposerDecision.Select);
    if (selection.decision !== ComposerDecision.Select) return;
    equal(selection.option.actionType, "complete");
  });
});

/* --------------------------------------------------------------------- */
/* Full observe -> menu -> decide loop driven through decideAsync()       */
/* (the documented agent loop: a deterministic snapshot produces the      */
/*  legal menu, the mock model picks within it, and the legality choke    */
/*  re-validates the choice).                                             */
/* --------------------------------------------------------------------- */

const observeDeps: ObserveDependencies = {
  clock: { now: () => "2026-05-29T00:00:00.000Z" },
};

function observingSnapshot(): RunSnapshot {
  return {
    runId: asZetaIdDecimal("42"),
    scope: RunScope.Run,
    phase: RunLifecyclePhase.Observing,
    trace: { correlationId: "corr-1", causationId: "cause-1", traceId: "trace-1" },
    hasGateApproval: false,
    hasEvidence: false,
  };
}

test("decideAsync drives the whole loop: observe produces the menu, the mock model selects a legal move", async () => {
  // observe() exposes 'compose' as a legal move out of Observing; force the mock to name it.
  await withServer({ decide: () => "compose" }, async (server) => {
    const result = await decideAsync(observingSnapshot(), composerFor(server), observeDeps);

    equal(result.outcome, DecideOutcome.Selected);
    if (result.outcome !== DecideOutcome.Selected) return;
    equal(result.selection.option.actionType, "compose");

    // the model was actually consulted with the observe()-generated menu
    const last = server.requests[server.requests.length - 1];
    ok(last);
    const user = last.messages?.find((m) => m.role === "user")?.content ?? "";
    ok(user.includes("compose"));
  });
});

test("decideAsync keeps the loop legal when the model is unreachable (deterministic move still selected)", async () => {
  await withServer({ failureStatus: 503 }, async (server) => {
    const result = await decideAsync(observingSnapshot(), composerFor(server), observeDeps);

    // the model-backed composer falls back; observe()'s deterministic first legal move is taken
    equal(result.outcome, DecideOutcome.Selected);
    if (result.outcome !== DecideOutcome.Selected) return;
    ok(result.selection.option.actionType.length > 0);
  });
});

test("decideAsync never lets an illegal model choice escape the menu (guardrail choke point)", async () => {
  // even a wildly illegal model reply cannot widen the rules: the model-backed
  // composer rejects it and falls back to a legal move, so the loop still selects.
  await withServer({ decide: () => "rm -rf the_universe" }, async (server) => {
    const result = await decideAsync(observingSnapshot(), composerFor(server), observeDeps);

    equal(result.outcome, DecideOutcome.Selected);
    if (result.outcome !== DecideOutcome.Selected) return;
    ok(result.selection.option.actionType.length > 0);
  });
});
