import { describe, expect, test } from "bun:test";
import {
  buildTlcArgv,
  invocationLine,
  judgeToolchainBanner,
  judgeTlcRun,
  loadTlcRegistry,
  tlcJvmArguments,
  type TlcModel,
  type TlcRegistry,
} from "./tlc-invocation";
import { spawnSync } from "node:child_process";

function root(): string {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : process.cwd();
}

const registry: TlcRegistry = loadTlcRegistry(root());

const validModel: TlcModel = {
  id: "X", module: "X", config: "X.cfg", expect: "valid", exitCode: 0,
  tier: "gate", deadlock: "on", distinctStates: 48,
};

const violationModel: TlcModel = {
  id: "Y", module: "Y", config: "Ycase.cfg", expect: "violation",
  expectDetail: "Invariant NoFullCancellation is violated", exitCode: 12,
  tier: "gate", deadlock: "off-cfg",
};

const CLEAN = "Model checking completed. No error has been found.\n48 distinct states found, 0 states left on queue.";

describe("buildTlcArgv", () => {
  test("always passes -config, so the twelve ungated configs cannot recur", () => {
    const argv = buildTlcArgv(registry, violationModel, "/j.jar", "/tmp/m", "linux", "x64");
    expect(argv).toContain("-config");
    expect(argv[argv.indexOf("-config") + 1]).toBe("Ycase.cfg");
    expect(argv[argv.length - 1]).toBe("Y");
  });

  test("pins the worker count, because halt-on-violation counts move with it", () => {
    const argv = buildTlcArgv(registry, violationModel, "/j.jar", "/tmp/m", "linux", "x64");
    expect(argv[argv.indexOf("-workers") + 1]).toBe(String(registry.invocation.workers));
  });

  test("never passes -deadlock -- deadlock policy lives in the .cfg", () => {
    for (const model of registry.models) {
      const argv = buildTlcArgv(registry, model, "/j.jar", "/tmp/m", "linux", "x64");
      expect(argv).not.toContain("-deadlock");
    }
  });

  test("keeps the macOS arm64 C2 workaround and nowhere else", () => {
    expect(tlcJvmArguments(registry, "darwin", "arm64")).toContain("-XX:-UseTypeSpeculation");
    expect(tlcJvmArguments(registry, "linux", "x64")).not.toContain("-XX:-UseTypeSpeculation");
  });

  test("invocationLine is copy-pasteable next to a recorded result", () => {
    const line = invocationLine(registry, violationModel);
    expect(line).toContain("-config Ycase.cfg");
    expect(line).toContain("tlc2.TLC");
  });
});

describe("judgeTlcRun", () => {
  test("accepts the pinned clean shape", () => {
    expect(judgeTlcRun(validModel, 0, CLEAN).ok).toBe(true);
  });

  test("REFUSES a witness that has stopped firing", () => {
    // The sharp one. A negative config that comes back clean means the model has
    // stopped modelling anything; under the old runner it would not have run at all.
    const j = judgeTlcRun(violationModel, 0, CLEAN);
    expect(j.ok).toBe(false);
    expect(j.reason).toContain("stopped firing");
  });

  test("REFUSES a witness that fires on a DIFFERENT property", () => {
    const j = judgeTlcRun(violationModel, 12, "Error: Invariant SomethingElse is violated.");
    expect(j.ok).toBe(false);
    expect(j.reason).toContain("different one");
  });

  test("accepts the pinned violation", () => {
    const j = judgeTlcRun(violationModel, 12, "Error: Invariant NoFullCancellation is violated.");
    expect(j.ok).toBe(true);
  });

  test("REFUSES an exit code the registry did not pin -- exit 11 is deadlock, 12 invariant, 13 temporal", () => {
    const j = judgeTlcRun(violationModel, 11, "Error: Deadlock reached.");
    expect(j.ok).toBe(false);
    expect(j.reason).toContain("exit code 11");
  });

  test("REFUSES exhaustive state-count drift", () => {
    const drifted = "Model checking completed. No error has been found.\n49 distinct states found, 0 states left on queue.";
    const j = judgeTlcRun(validModel, 0, drifted);
    expect(j.ok).toBe(false);
    expect(j.reason).toContain("registry pins 48");
  });

  test("parses comma-grouped counts", () => {
    const big: TlcModel = { ...validModel, distinctStates: 4665495 };
    const out = "Model checking completed. No error has been found.\n4,665,495 distinct states found, 0 states left on queue.";
    expect(judgeTlcRun(big, 0, out).ok).toBe(true);
  });

  test("does NOT assert a count for halt-on-violation models", () => {
    // haltDistinctStates is history, not a contract: exploration order depends on
    // worker count, and the 4-worker figures recorded on 2026-08-13 differ.
    const m: TlcModel = { ...violationModel, haltDistinctStates: 42 };
    expect(judgeTlcRun(m, 12, "Error: Invariant NoFullCancellation is violated.\n99 distinct states found, 7 states left on queue.").ok).toBe(true);
  });
});

describe("judgeToolchainBanner", () => {
  test("accepts the pinned jar banner", () => {
    expect(judgeToolchainBanner(registry, registry.toolchain.versionBanner + "\nrest").ok).toBe(true);
  });

  test("REFUSES a swapped jar", () => {
    const j = judgeToolchainBanner(registry, "TLC2 Version 1.7.0 (rev: deadbee)\nrest");
    expect(j.ok).toBe(false);
    expect(j.reason).toContain("registry pins");
  });
});

describe("judgeTlcRun state-count parsing", () => {
  test("reads the FINAL summary, not a progress line", () => {
    // Regression. TLC prints a progress line every minute with the same
    // shape as the summary. Matching the first occurrence read 122647 off
    // BftConsensus and reported it against the pinned 4665495 -- a false
    // red that would have been fixed by relaxing the pin if the cause had
    // not been chased. Found by the assertion on its first real run.
    const out = [
      "Progress(12) at 00:00: 64,560 states generated (64,560 s/min), 122,647 distinct states found (18,376 ds/min), 6,214 states left on queue.",
      "Progress(21) at 00:01: 209,321 states generated, 4,665,495 distinct states found, 0 states left on queue.",
      "Model checking completed. No error has been found.",
      "209321 states generated, 4665495 distinct states found, 0 states left on queue.",
    ].join("\n");
    const m: TlcModel = { ...validModel, distinctStates: 4665495 };
    expect(judgeTlcRun(m, 0, out).ok).toBe(true);
  });

  test("still fails when the FINAL count drifts, progress lines notwithstanding", () => {
    const out = [
      "Progress(12) at 00:00: 64,560 states generated (64,560 s/min), 48 distinct states found (48 ds/min), 6 states left on queue.",
      "Model checking completed. No error has been found.",
      "99 states generated, 77 distinct states found, 0 states left on queue.",
    ].join("\n");
    expect(judgeTlcRun(validModel, 0, out).ok).toBe(false);
  });
});
