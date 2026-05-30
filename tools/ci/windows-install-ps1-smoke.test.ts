import { test, expect } from "bun:test";
import {
  taskHasDurationAndNextRun,
  miseProvidesTool,
  SHARED_COMMANDS,
  CONTAINER_SKIPS,
} from "./windows-install-ps1-smoke";

test("taskHasDurationAndNextRun: healthy task (Repetition Duration + populated Next Run)", () => {
  const xml = "<Repetition><Interval>PT1M</Interval><Duration>P3650D</Duration></Repetition>";
  const v = "Next Run Time:                        5/30/2026 11:00:00 AM";
  expect(taskHasDurationAndNextRun(xml, v)).toEqual({ durationPresent: true, nextRunPopulated: true });
});

test("taskHasDurationAndNextRun: degenerate repetition (no Duration) + N/A next run", () => {
  // This is exactly the broken state the conhost/repetition fixes addressed.
  const xml = "<Repetition><Interval>PT1M</Interval></Repetition>";
  const v = "Next Run Time:                        N/A";
  expect(taskHasDurationAndNextRun(xml, v)).toEqual({ durationPresent: false, nextRunPopulated: false });
});

test("miseProvidesTool: token match, no substring false-positives", () => {
  const out = "bun       1.3.0   ~/.mise.toml\ndotnet    10.0.0  ~/.mise.toml";
  expect(miseProvidesTool(out, "bun")).toBe(true);
  expect(miseProvidesTool(out, "dotnet")).toBe(true);
  expect(miseProvidesTool(out, "python")).toBe(false);
  expect(miseProvidesTool(out, "do")).toBe(false); // not a substring of "dotnet"
});

test("container mode documents its skip (loop-task) — never silent", () => {
  expect(Object.keys(CONTAINER_SKIPS)).toContain("loop-task");
  expect(CONTAINER_SKIPS["loop-task"]).toMatch(/interactive session/);
});

test("shared commands are scoop, git, mise", () => {
  expect([...SHARED_COMMANDS]).toEqual(["scoop", "git", "mise"]);
});
