/**
 * End-to-end model-backed decision path: model-backed composer driven through
 * the deterministic kernel (decideAsync -> resolveSelection).
 *
 * The sibling model-backed-composer.test.ts asserts what the composer PORT
 * returns. This file asserts the kernel-level invariant the brain depends on:
 * whatever the model-backed composer chooses, it is re-checked against the
 * deterministic legal set by resolveSelection before it can become a Selected
 * decision. The model can never widen the rules.
 *
 *   (a) parseable + legal model choice -> kernel admits exactly that option
 *   (b) illegal / unparseable / throwing model -> deterministic first-legal
 *       fallback; the run still produces a legal Selected decision
 *   (c) resolveSelection is the choke point that enforces (b): even a composer
 *       that returns an option NOT in the readout is rejected as a
 *       deterministic-rule violation (feedback), not action.
 */

import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ComposerDecision,
  DecideOutcome,
  ObserveFeedbackReason,
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  decideAsync,
  type AsyncEphemeralComposerPort,
  type ObserveDependencies,
  type RunSnapshot,
} from "../src/observe.ts";
import { createFirstLegalOptionComposer } from "../src/reaction-decision.ts";
import {
  createModelBackedComposer,
  toAsyncComposer,
  type ChatCompletionPort,
  type ChatCompletionResult,
} from "../src/model-backed-composer.ts";

// Observing phase: a clean two-option legal set with no preconditions, so the
// DefaultDeterministicRules veto nothing. PHASE_OPTIONS[Observing] is, in order:
//   [0] compose -> composing   (the deterministic first-legal-option choice)
//   [1] block   -> blocked
const snapshot: RunSnapshot = {
  runId: asZetaIdDecimal("987"),
  scope: RunScope.Run,
  phase: RunLifecyclePhase.Observing,
  trace: { correlationId: "c", causationId: "c", traceId: "t" },
  hasGateApproval: false,
  hasEvidence: false,
};

const deps: ObserveDependencies = { clock: { now: () => "2026-05-30T07:00:00.000Z" } };

function chat(reply: ChatCompletionResult | (() => Promise<ChatCompletionResult>)): ChatCompletionPort {
  return { complete: async () => (typeof reply === "function" ? reply() : reply) };
}

function modelBacked(chatPort: ChatCompletionPort): AsyncEphemeralComposerPort {
  return createModelBackedComposer({ chat: chatPort, fallback: createFirstLegalOptionComposer() });
}

// (a) parseable + legal choice -> kernel admits exactly that option
test("kernel selects exactly the legal option the model names (the non-first one)", async () => {
  // 'block' is the SECOND legal option; proving the model's choice (not the
  // deterministic first) is what gets selected through the kernel.
  const result = await decideAsync(snapshot, modelBacked(chat("block")), deps);

  equal(result.outcome, DecideOutcome.Selected);
  if (result.outcome !== DecideOutcome.Selected) return;
  equal(result.selection.option.actionType, "block");
  equal(result.selection.option.toPhase, RunLifecyclePhase.Blocked);
  ok(result.selection.reason.includes("model selected"));
  // determinism stays visible: the rules that shaped the legal set are recorded
  ok(result.readout.deterministicRulesApplied.includes("gate-precondition"));
});

// (b) illegal model choice -> deterministic first-legal fallback, still legal
test("illegal model token falls back to deterministic first-legal option through the kernel", async () => {
  const result = await decideAsync(snapshot, modelBacked(chat("escalate_to_ceo")), deps);

  equal(result.outcome, DecideOutcome.Selected);
  if (result.outcome !== DecideOutcome.Selected) return;
  // 'compose' is PHASE_OPTIONS[Observing][0] — the first-legal-option fallback
  equal(result.selection.option.actionType, "compose");
});

// (b) unparseable model output -> deterministic first-legal fallback, still legal
test("unparseable model output falls back to deterministic first-legal option through the kernel", async () => {
  const result = await decideAsync(snapshot, modelBacked(chat("hmm, let me think about this for a while")), deps);

  equal(result.outcome, DecideOutcome.Selected);
  if (result.outcome !== DecideOutcome.Selected) return;
  equal(result.selection.option.actionType, "compose");
});

// (b) throwing model (unreachable) -> deterministic first-legal fallback, still legal
test("throwing model call falls back to deterministic first-legal option through the kernel", async () => {
  const result = await decideAsync(
    snapshot,
    modelBacked(chat(async () => {
      throw new Error("ollama unreachable");
    })),
    deps,
  );

  equal(result.outcome, DecideOutcome.Selected);
  if (result.outcome !== DecideOutcome.Selected) return;
  equal(result.selection.option.actionType, "compose");
});

// (c) resolveSelection is the enforcement: a composer that fabricates an option
// NOT in the readout is rejected as a deterministic-rule violation, NOT action.
// This proves the re-check is what makes the model-can-never-widen-the-rules
// guarantee hold — independent of any parsing the model-backed composer does.
test("resolveSelection rejects an out-of-set option even when the composer returns Select", async () => {
  const rogueAsync: AsyncEphemeralComposerPort = {
    compose: async () => ({
      decision: ComposerDecision.Select,
      option: {
        actionType: "execute",
        toPhase: RunLifecyclePhase.Executing,
        toScope: RunScope.WorkItem,
        requiresGate: true,
        requiresEvidence: false,
        rationale: "skip straight to executing",
      },
      reason: "trying to escape the rules",
    }),
  };

  const result = await decideAsync(snapshot, rogueAsync, deps);

  // out-of-set choice becomes feedback, never a Selected action
  equal(result.outcome, DecideOutcome.Feedback);
  if (result.outcome !== DecideOutcome.Feedback) return;
  equal(result.feedback.reason, ObserveFeedbackReason.DeterministicRuleViolation);
  ok(result.feedback.message.includes("illegal option"));
});

// Cross-check: the deterministic-only path (toAsyncComposer over the first-legal
// composer) is identical to the model-backed fallback target — confirming the
// fallback in (b) is genuinely the deterministic baseline, not a coincidence.
test("model-backed fallback target equals the standalone deterministic composer", async () => {
  const deterministicOnly = toAsyncComposer(createFirstLegalOptionComposer());
  const result = await decideAsync(snapshot, deterministicOnly, deps);

  equal(result.outcome, DecideOutcome.Selected);
  if (result.outcome !== DecideOutcome.Selected) return;
  equal(result.selection.option.actionType, "compose");
});
