/**
 * Falsifiers for the first-boot replica's dead-node report (081M3HYPQCR087G0R003C2VPRS).
 *
 * Dispatch 36333824468: the constrained replica's container stopped during stage 6, the
 * soak and stage 7 then passed over a refused API server, and stage 8's `docker kill` said
 * only "is not running". These pin that a dead container becomes a NAMED failure carrying
 * Docker's own exit state and the log tail -- and that a running one, or an unreadable
 * state, is never promoted to a death.
 */

import { describe, expect, test } from "bun:test";

import {
  classifyContainerDeath,
  containerDeathReport,
  parseContainerState,
  type Runner,
} from "./first-boot-replica.ts";

const state = (over: Record<string, unknown>): string =>
  JSON.stringify({
    Status: "exited",
    Running: false,
    OOMKilled: false,
    ExitCode: 0,
    Error: "",
    StartedAt: "2026-09-27T16:39:24Z",
    FinishedAt: "2026-09-27T17:12:30Z",
    ...over,
  });

const fakeRunner = (inspect: { status: number; stdout: string; stderr?: string }, logs = "k3s: last line"): Runner & { calls: string[][] } => {
  const calls: string[][] = [];
  return {
    calls,
    run(argv0, args) {
      calls.push([argv0, ...args]);
      if (args[0] === "inspect") return { status: inspect.status, stdout: inspect.stdout, stderr: inspect.stderr ?? "" };
      if (args[0] === "logs") return { status: 0, stdout: logs, stderr: "" };
      return { status: 1, stdout: "", stderr: "unexpected" };
    },
  };
};

describe("parseContainerState", () => {
  test("reads Docker's own State fields", () => {
    const s = parseContainerState(state({ OOMKilled: true, ExitCode: 137 }));
    expect(s).toMatchObject({ running: false, status: "exited", exitCode: 137, oomKilled: true });
  });

  test("anything that is not a State object is null, never a default 'dead' state", () => {
    expect(parseContainerState("")).toBeNull();
    expect(parseContainerState("not json")).toBeNull();
    expect(parseContainerState(JSON.stringify({ Status: "exited" }))).toBeNull();
  });
});

describe("classifyContainerDeath", () => {
  const parsed = (over: Record<string, unknown>) => {
    const s = parseContainerState(state(over));
    if (s === null) throw new Error("fixture did not parse");
    return s;
  };
  test("OOMKilled is named as the cgroup OOM killer taking the whole node", () => {
    expect(classifyContainerDeath(parsed({ OOMKilled: true, ExitCode: 137 }))).toMatch(/^OOMKilled: .*whole-node memory/);
  });
  test("137 without the OOM flag is NOT called an OOM", () => {
    expect(classifyContainerDeath(parsed({ ExitCode: 137 }))).toMatch(/WITHOUT OOMKilled/);
  });
  test("any other exit points at the log tail", () => {
    expect(classifyContainerDeath(parsed({ ExitCode: 1 }))).toMatch(/exited 1/);
  });
});

describe("containerDeathReport", () => {
  test("a RUNNING container yields null and reads no logs", () => {
    const runner = fakeRunner({ status: 0, stdout: state({ Status: "running", Running: true }) });
    expect(containerDeathReport(runner, "c")).toBeNull();
    expect(runner.calls.some((c) => c[1] === "logs")).toBe(false);
  });

  test("a dead container is a CONFIRMED report with exit code, OOM flag and the log tail", () => {
    const runner = fakeRunner({ status: 0, stdout: state({ OOMKilled: true, ExitCode: 137 }) }, "E0927 k3s: fatal");
    const death = containerDeathReport(runner, "zeta-first-boot-replica-constrained");
    expect(death?.confirmed).toBe(true);
    expect(death?.report).toContain("ExitCode=137 OOMKilled=true");
    expect(death?.report).toContain("E0927 k3s: fatal");
  });

  test("an UNREADABLE state is reported but NOT confirmed as a death", () => {
    const runner = fakeRunner({ status: 1, stdout: "", stderr: "Cannot connect to the Docker daemon" });
    const death = containerDeathReport(runner, "c");
    expect(death?.confirmed).toBe(false);
    expect(death?.report).toContain("UNREADABLE");
  });
});
