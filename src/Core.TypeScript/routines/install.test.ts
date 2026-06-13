import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { readCloudSchedule } from "./install.ts";
import { join } from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

// Each test gets an isolated mkdtempSync directory and cleans it up in afterEach.
// Fixes both:
//   * concurrent / stale test-run collisions (each test gets a unique path)
//   * CodeQL "Insecure creation of file in os temp dir" alerts (87-90):
//     fixed-name paths under tmpdir() are racy on multi-user systems.

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cloud-schedule-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("readCloudSchedule", () => {
  test("happy path - api trigger", () => {
    writeFileSync(
      join(dir, "cloud-schedule.json"),
      JSON.stringify({
        taskId: "test-1",
        trigger: { type: "api" },
      }),
    );

    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(false);
    expect(result.parseError).toBeUndefined();
    expect(result.trigger).toEqual({ type: "api" });
  });

  test("happy path - scheduled trigger", () => {
    writeFileSync(
      join(dir, "cloud-schedule.json"),
      JSON.stringify({
        taskId: "test-2",
        trigger: { type: "scheduled", cronExpression: "0 9 * * *" },
      }),
    );

    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(false);
    expect(result.parseError).toBeUndefined();
    expect(result.trigger).toEqual({ type: "scheduled", cronExpression: "0 9 * * *" });
  });

  test("happy path - github_event trigger", () => {
    writeFileSync(
      join(dir, "cloud-schedule.json"),
      JSON.stringify({
        trigger: {
          type: "github_event",
          event: "pull_request.opened",
          repos: ["Lucent-Financial-Group/Zeta"],
        },
      }),
    );

    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(false);
    expect(result.parseError).toBeUndefined();
    expect(result.trigger).toEqual({
      type: "github_event",
      event: "pull_request.opened",
      repos: ["Lucent-Financial-Group/Zeta"],
    });
  });

  test("missing file", () => {
    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(true);
    expect(result.parseError).toBeUndefined();
    expect(result.trigger).toBeUndefined();
  });

  test("parse error - invalid json", () => {
    writeFileSync(join(dir, "cloud-schedule.json"), "{ invalid json ");

    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(false);
    expect(result.parseError).toBeDefined();
  });

  test("parse error - missing trigger field", () => {
    writeFileSync(
      join(dir, "cloud-schedule.json"),
      JSON.stringify({
        taskId: "test-5",
      }),
    );

    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(false);
    expect(result.parseError).toBe("cloud-schedule.json is missing required field: trigger");
  });

  test("parse error - scheduled trigger missing cronExpression", () => {
    writeFileSync(join(dir, "cloud-schedule.json"), JSON.stringify({ trigger: { type: "scheduled" } }));

    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(false);
    expect(result.parseError).toContain("scheduled missing required field: cronExpression");
    expect(result.trigger).toBeUndefined();
  });

  test("parse error - scheduled trigger with empty cronExpression", () => {
    writeFileSync(
      join(dir, "cloud-schedule.json"),
      JSON.stringify({ trigger: { type: "scheduled", cronExpression: "   " } }),
    );

    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(false);
    expect(result.parseError).toContain("scheduled missing required field: cronExpression");
  });

  test("parse error - github_event trigger missing event", () => {
    writeFileSync(
      join(dir, "cloud-schedule.json"),
      JSON.stringify({ trigger: { type: "github_event", repos: ["foo/bar"] } }),
    );

    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(false);
    expect(result.parseError).toContain("github_event missing required field: event");
  });

  test("parse error - github_event trigger missing repos", () => {
    writeFileSync(
      join(dir, "cloud-schedule.json"),
      JSON.stringify({ trigger: { type: "github_event", event: "issues.opened" } }),
    );

    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(false);
    expect(result.parseError).toContain("github_event missing required field: repos");
  });

  test("parse error - github_event trigger with empty repos array", () => {
    writeFileSync(
      join(dir, "cloud-schedule.json"),
      JSON.stringify({ trigger: { type: "github_event", event: "issues.opened", repos: [] } }),
    );

    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(false);
    expect(result.parseError).toContain("github_event missing required field: repos");
  });

  test("parse error - unknown trigger type", () => {
    writeFileSync(join(dir, "cloud-schedule.json"), JSON.stringify({ trigger: { type: "webhook" } }));

    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(false);
    expect(result.parseError).toContain('trigger.type "webhook" is not recognized');
  });

  test("parse error - trigger.type is not a string", () => {
    writeFileSync(join(dir, "cloud-schedule.json"), JSON.stringify({ trigger: { type: 42 } }));

    const result = readCloudSchedule(dir);
    expect(result.missing).toBe(false);
    expect(result.parseError).toBe("cloud-schedule.json trigger.type must be a string");
  });
});
