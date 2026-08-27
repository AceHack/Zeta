/**
 * Heartbeat schedule contract tests.
 *
 * These tests exercise the repository workflow rather than a duplicate YAML
 * model. They reject both removal of the schedule and restoration of the
 * top-of-hour cadence; passing does not claim GitHub will deliver every tick.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertOffBoundaryHeartbeatSchedule, OFF_BOUNDARY_HEARTBEAT_CRON } from "./heartbeat-schedule";

const WORKFLOW_PATH = join(import.meta.dir, "..", "..", "..", ".github", "workflows", "agent-heartbeat.yml");

describe("agent-heartbeat off-boundary schedule", () => {
  test("declares the documented off-boundary 15-minute cadence", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");
    assertOffBoundaryHeartbeatSchedule(workflow);
    expect(OFF_BOUNDARY_HEARTBEAT_CRON).toBe("7,22,37,52 * * * *");
  });

  test("FAULT INJECTION: rejects the top-of-hour cadence even when the expected schedule is also present", () => {
    const duplicatedRiskWorkflow = `on:\n  schedule:\n    - cron: "${OFF_BOUNDARY_HEARTBEAT_CRON}"\n    - cron: "*/15 * * * *"`;
    expect(() => assertOffBoundaryHeartbeatSchedule(duplicatedRiskWorkflow)).toThrow("retains the top-of-hour");
  });

  test("FAULT INJECTION: rejects an absent schedule instead of treating manual dispatch as cadence", () => {
    expect(() => assertOffBoundaryHeartbeatSchedule("on:\n  workflow_dispatch:"))
      .toThrow("has no declared schedule");
  });
});
