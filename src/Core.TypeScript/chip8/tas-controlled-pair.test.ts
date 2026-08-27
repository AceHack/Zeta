import { describe, expect, test } from "bun:test";
import { create as createFrame, loadRom, step } from "./chip8";
import { injectCode } from "./cheat-engine";
import { createChannelSet, meterCrossingRange, type ChannelGrantResult } from "./channel-grant";
import {
  runTasControlledPair,
  type TasExecutionResult,
  type TasRunContext,
  type TasRunOutcome,
} from "./tas-controlled-pair";
import { CLEAN_RUN_CHANNEL_LABEL, type RunKey } from "../chip9/chip8-cross-run-store";

function value<T>(result: ChannelGrantResult<T>): T {
  if (!result.ok) throw new Error(`${result.feedback.code}:${result.feedback.detail}`);
  return result.value;
}

function cleanRunKey(): RunKey {
  return {
    romSha256: "ab".repeat(32),
    seedHex: "0000000000000004",
    loadAddrHex: "0200",
    dialect: "chip8",
    channelLabel: CLEAN_RUN_CHANNEL_LABEL,
    stepMapVersion: "chip8cow-step-v1",
  };
}

const channels = value(
  createChannelSet([
    { channel: "ram", direction: "read", startAddress: 0x200, endAddress: 0x2ff },
    { channel: "ram", direction: "write", startAddress: 0x200, endAddress: 0x2ff },
  ]),
);

const budget = Object.freeze({ maxAgentActions: 40, maxEnvironmentSteps: 80, attribution: "rung-k-test" });

function success(value: TasRunOutcome): TasExecutionResult {
  return { ok: true, value };
}

describe("TAS controlled pair", () => {
  test("holds subject, run identity, and budget fixed while reporting the assistance delta", async () => {
    const contexts: TasRunContext[] = [];
    const report = await runTasControlledPair({
      issuedBy: "arc-pair-harness",
      subjectId: "agent-under-test",
      cleanRunKey: cleanRunKey(),
      channels,
      budget,
      execute: async (context) => {
        contexts.push(context);
        if (context.mode === "clean") {
          return success({ normalizedScore: 0.25, agentActions: 20, environmentSteps: 40 });
        }
        const metered = meterCrossingRange(context.grant, {
          channel: "ram",
          direction: "read",
          startAddress: 0x200,
          endAddress: 0x202,
        });
        if (!metered.ok) return { ok: false, feedback: metered.feedback };
        return success({ normalizedScore: 0.75, agentActions: 12, environmentSteps: 40 });
      },
    });

    expect(report).toMatchObject({
      ok: true,
      value: {
        subjectId: "agent-under-test",
        scoreDelta: 0.5,
        agentActionDelta: -8,
        environmentStepDelta: 0,
        crossings: { read: 3, write: 0, total: 3 },
      },
    });
    expect(contexts).toHaveLength(2);
    const cleanContext = contexts[0];
    const assistedContext = contexts[1];
    if (cleanContext === undefined || assistedContext === undefined) throw new Error("missing pair context");
    expect(cleanContext.grant).toBeNull();
    expect(assistedContext.grant).not.toBeNull();
    expect(cleanContext.budget).toBe(assistedContext.budget);
    expect(cleanContext.runKey).toEqual({ ...assistedContext.runKey, channelLabel: CLEAN_RUN_CHANNEL_LABEL });
  });

  test("runs a real CHIP-8 instruction pair and meters only the assisted injection", async () => {
    const rom = new Uint8Array([0x60, 0x01]);
    const report = await runTasControlledPair({
      issuedBy: "chip8-pair-harness",
      subjectId: "fixed-chip8-policy",
      cleanRunKey: cleanRunKey(),
      channels,
      budget,
      execute: async (context) => {
        const frame = loadRom(rom, createFrame(4));
        if (context.mode === "assisted") {
          const injected = injectCode(context.grant, frame, 0x200, "6002");
          if (!injected.ok) return { ok: false, feedback: injected.feedback };
        }
        step(frame);
        return success({ normalizedScore: (frame.v[0] ?? 0) / 10, agentActions: 1, environmentSteps: 1 });
      },
    });

    expect(report.ok).toBeTrue();
    if (!report.ok) return;
    expect(report.value.clean.normalizedScore).toBeCloseTo(0.1);
    expect(report.value.assisted.normalizedScore).toBeCloseTo(0.2);
    expect(report.value.scoreDelta).toBeCloseTo(0.1);
    expect(report.value.crossings).toEqual({ read: 0, write: 2, total: 2 });
  });

  test("refuses a non-clean baseline before either run executes", async () => {
    let calls = 0;
    const report = await runTasControlledPair({
      issuedBy: "arc-pair-harness",
      subjectId: "agent-under-test",
      cleanRunKey: { ...cleanRunKey(), channelLabel: "assisted:ram-read@0200-02ff" },
      channels,
      budget,
      execute: async () => {
        calls += 1;
        return success({ normalizedScore: 0, agentActions: 0, environmentSteps: 0 });
      },
    });

    expect(report).toEqual({
      ok: false,
      feedback: { code: "clean-run-key-required", detail: "assisted:ram-read@0200-02ff" },
    });
    expect(calls).toBe(0);
  });

  test("does not run the assisted leg after a typed clean refusal", async () => {
    const modes: string[] = [];
    const report = await runTasControlledPair({
      issuedBy: "arc-pair-harness",
      subjectId: "agent-under-test",
      cleanRunKey: cleanRunKey(),
      channels,
      budget,
      execute: async (context) => {
        modes.push(context.mode);
        return { ok: false, feedback: { code: "fixture-refusal", detail: "no observation" } };
      },
    });

    expect(report).toEqual({
      ok: false,
      feedback: { code: "run-refused", detail: "clean:fixture-refusal:no observation" },
    });
    expect(modes).toEqual(["clean"]);
  });

  test("refuses outcomes that claim more actions than the shared budget", async () => {
    const report = await runTasControlledPair({
      issuedBy: "arc-pair-harness",
      subjectId: "agent-under-test",
      cleanRunKey: cleanRunKey(),
      channels,
      budget,
      execute: async () => success({ normalizedScore: 0.5, agentActions: 41, environmentSteps: 1 }),
    });

    expect(report).toEqual({
      ok: false,
      feedback: { code: "agent-action-budget-exceeded", detail: "clean:41>40" },
    });
  });
});
