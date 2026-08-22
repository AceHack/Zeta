/**
 * workflow-triggers.test.ts — falsifiers for the expected-absent / unexpectedly-absent
 * split. If this file is wrong, the dashboard's unknowns become a grey wall and its
 * reds become noise, so the fixtures below are real workflow headers from this repo.
 */

import { describe, expect, it } from "bun:test";

import {
  cronPeriodSeconds,
  expectationFromWorkflow,
  extractOnBlock,
  branchesMatchRef,
  globMatches,
  inlineTriggerNames,
  listValuesFor,
  triggerSubBlock,
  UNDERIVABLE_CRON_PERIOD_SECONDS,
} from "./workflow-triggers.ts";

describe("cronPeriodSeconds", () => {
  it("reads step minutes", () => expect(cronPeriodSeconds("*/15 * * * *")).toBe(900));
  it("reads step hours", () => expect(cronPeriodSeconds("0 */6 * * *")).toBe(6 * 3600));
  it("reads daily", () => expect(cronPeriodSeconds("17 3 * * *")).toBe(86_400));
  it("reads weekly", () => expect(cronPeriodSeconds("0 9 * * 1")).toBe(7 * 86_400));
  it("reads monthly", () => expect(cronPeriodSeconds("0 0 1 * *")).toBe(30 * 86_400));
  it("halves for a two-entry minute list", () => expect(cronPeriodSeconds("0,30 * * * *")).toBe(1800));
  it("refuses a shape it does not understand rather than inventing one", () => {
    expect(cronPeriodSeconds("0 0 * * 1-5")).toBeNull();
    expect(cronPeriodSeconds("nonsense")).toBeNull();
  });
});

describe("extractOnBlock", () => {
  it("finds the indented mapping form", () => {
    const block = extractOnBlock("name: x\non:\n  push:\n    branches: [main]\n\njobs:\n  a: {}\n");
    expect(block).toContain("push:");
    expect(block).not.toContain("jobs:");
  });
  it("finds the form a YAML 1.1 parser would have coerced to `true:`", () => {
    expect(extractOnBlock("true:\n  schedule:\n    - cron: '0 * * * *'\n")).toContain("cron");
  });
  it("returns null when there is no top-level on:", () => {
    expect(extractOnBlock("name: x\njobs:\n  a: {}\n")).toBeNull();
  });
});

describe("inlineTriggerNames", () => {
  it("reads the flow-sequence form", () => expect(inlineTriggerNames("[push, pull_request]")).toEqual(["push", "pull_request"]));
  it("reads the bare-scalar form", () => expect(inlineTriggerNames("push")).toEqual(["push"]));
  it("returns null for the mapping form", () => expect(inlineTriggerNames("  push:\n    branches: [main]")).toBeNull());
});

describe("expectationFromWorkflow — derived, never assumed", () => {
  it("a weekly schedule is periodic, so silence on it is RED not unknown", () => {
    const e = expectationFromWorkflow("on:\n  schedule:\n    - cron: '0 9 * * 1'\n", "main");
    expect(e.kind).toBe("periodic");
    expect(e.kind === "periodic" && e.periodSeconds).toBe(7 * 86_400);
  });

  it("a PR-only workflow is on-demand, so silence on main is CORRECT", () => {
    const e = expectationFromWorkflow("on:\n  pull_request:\n    branches: [main]\n", "main");
    expect(e.kind).toBe("on-demand");
  });

  it("push-to-main is on-change", () => {
    const e = expectationFromWorkflow("on:\n  push:\n    branches:\n      - main\n", "main");
    expect(e.kind).toBe("on-change");
  });

  it("push restricted to OTHER branches is on-demand for main — not a false gap", () => {
    const e = expectationFromWorkflow("on:\n  push:\n    branches:\n      - 'heartbeat/**'\n", "main");
    expect(e.kind).toBe("on-demand");
  });

  it("schedule outranks pull_request — the clock is the stronger claim", () => {
    const e = expectationFromWorkflow("on:\n  pull_request:\n  schedule:\n    - cron: '*/30 * * * *'\n", "main");
    expect(e.kind).toBe("periodic");
    expect(e.kind === "periodic" && e.periodSeconds).toBe(1800);
  });

  it("an unreadable cron still says periodic, and SAYS SO in the detail", () => {
    const e = expectationFromWorkflow("on:\n  schedule:\n    - cron: '0 0 * * 1-5'\n", "main");
    expect(e.kind).toBe("periodic");
    expect(e.kind === "periodic" && e.periodSeconds).toBe(UNDERIVABLE_CRON_PERIOD_SECONDS);
    expect(e.detail).toContain("not fully derivable");
  });

  it("a workflow with no on: block is UNKNOWN — never defaulted to the convenient case", () => {
    expect(expectationFromWorkflow("name: x\njobs: {}\n", "main").kind).toBe("unknown");
  });

  it("an unrecognised trigger set is UNKNOWN and quotes what it could not read", () => {
    const e = expectationFromWorkflow("on:\n  some_future_github_event:\n    types: [created]\n", "main");
    expect(e.kind).toBe("unknown");
    expect(e.detail).toContain("some_future_github_event");
  });

  it("workflow_run is on-demand — it chains off another workflow, so silence is not alarming", () => {
    const e = expectationFromWorkflow("on:\n  workflow_run:\n    workflows: [gate]\n    types: [completed]\n", "main");
    expect(e.kind).toBe("on-demand");
    expect(e.detail).toContain("workflow_run");
  });

  it("handles the inline forms", () => {
    expect(expectationFromWorkflow("on: [push, pull_request]\n", "main").kind).toBe("on-change");
    expect(expectationFromWorkflow("on: workflow_dispatch\n", "main").kind).toBe("on-demand");
  });
});

describe("branch filters — the bug this file's first version shipped", () => {
  it("reads the FLOW-SEQUENCE form `branches: [main]` — gate.yml's own form", () => {
    // The first version only recognised the block form and the quoted flow form, so
    // `branches: [main]` read as "does not include main" and the repo's single most
    // important workflow was classified `on-demand`. Caught on the first live pass.
    const gateish = "on:\n  pull_request:\n    types: [opened]\n  push:\n    branches: [main]\n  merge_group:\n  workflow_dispatch:\n";
    expect(expectationFromWorkflow(gateish, "main").kind).toBe("on-change");
  });

  it("does not let a greedy \\s* swallow the key's own line", () => {
    const sub = triggerSubBlock("  push:\n    branches:\n      - main\n", "push");
    expect(sub).toContain("branches:");
    expect(listValuesFor(sub ?? "", "branches")).toEqual(["main"]);
  });

  it("`branches` is not confused with `branches-ignore`", () => {
    const sub = "    branches-ignore:\n      - 'docs/**'\n";
    expect(listValuesFor(sub, "branches")).toBeNull();
    expect(listValuesFor(sub, "branches-ignore")).toEqual(["docs/**"]);
    expect(branchesMatchRef("  push:\n" + sub, "push", "main")).toBe(true);
    expect(branchesMatchRef("  push:\n" + sub, "push", "docs/x")).toBe(false);
  });

  it("a push trigger with no branch filter admits every branch", () => {
    expect(branchesMatchRef("  push:\n", "push", "main")).toBe(true);
    expect(expectationFromWorkflow("on:\n  push:\n", "main").kind).toBe("on-change");
  });

  it("globs match the way GitHub's do", () => {
    expect(globMatches("heartbeat/**", "heartbeat/a/b")).toBe(true);
    expect(globMatches("heartbeat/*", "heartbeat/a/b")).toBe(false);
    expect(globMatches("**", "anything/at/all")).toBe(true);
    expect(globMatches("main", "maintenance")).toBe(false);
  });

  it("an exclusion pattern excludes", () => {
    const block = "  push:\n    branches:\n      - '**'\n      - '!main'\n";
    expect(branchesMatchRef(block, "push", "main")).toBe(false);
    expect(branchesMatchRef(block, "push", "feat/x")).toBe(true);
  });
});
