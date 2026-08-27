/**
 * workflow-triggers.test.ts — falsifiers for the expected-absent / unexpectedly-absent
 * split. If this file is wrong, the dashboard's unknowns become a grey wall and its
 * reds become noise, so the fixtures below are real workflow headers from this repo.
 */

import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "bun:test";

import {
  cronPeriodSeconds,
  expectationFromWorkflow,
  extractCrons,
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

// A cron expression is mostly asterisks, and `detail` is rendered into
// docs/DRIFT-DASHBOARD.md. Unquoted, `11 3 * * *` reads to markdownlint as
// emphasis markers with spaces inside (MD037), and the generated dashboard
// went red on main the first time it flushed after 2026-08-24. Single quotes
// are not a code span; backticks are.
//
// Asserted on expectationFromWorkflow's OWN output, not on a literal rebuilt
// here — a test that reconstructs the format it is checking would pass while
// the shipped generator emitted anything at all.
describe("cron detail is markdown-safe", () => {
  const outsideCodeSpans = (s: string): string => s.replace(/`[^`]*`/g, "");

  it("the underivable-period branch emits crons inside code spans", () => {
    const e = expectationFromWorkflow("on:\n  schedule:\n    - cron: '11 3 * * 1-5'\n", "main");
    expect(e.kind).toBe("periodic");
    const detail = e.kind === "periodic" ? e.detail : "";
    expect(detail).toContain("not fully derivable");
    expect(detail).toContain("`11 3 * * 1-5`");
    expect(outsideCodeSpans(detail)).not.toContain("*");
  });

  it("the derivable-period branch does too, including multiple crons", () => {
    const e = expectationFromWorkflow(
      "on:\n  schedule:\n    - cron: '*/15 * * * *'\n    - cron: '23 */6 * * *'\n",
      "main",
    );
    expect(e.kind).toBe("periodic");
    const detail = e.kind === "periodic" ? e.detail : "";
    expect(detail).toContain("`*/15 * * * *`");
    expect(detail).toContain("`23 */6 * * *`");
    expect(outsideCodeSpans(detail)).not.toContain("*");
  });
});

// The workflows whose COMMENTS document this parser are the workflows that broke it.
// Six install shields carry the line
//
//     # (src/Core.TypeScript/forge-host/github/workflow-triggers.ts) turns a `cron:`
//
// inside their `on:` block. The extractor was unanchored, so it matched `cron:` in that
// sentence and carried off the following backtick as a cron expression; the dashboard
// rendered ``schedule: '`', '11 3 * * *'`` and `lint (markdownlint)` went red on `main`
// with MD037. The code-span fix above is right and cannot help here — the value itself
// was a backtick, so the span put around it closed on it.
describe("a `cron:` in prose is not a declaration", () => {
  // A faithful reduction of .github/workflows/docker-ubuntu-install-sh-test.yml's `on:`
  // block: the real prose, the real cron, the real ordering.
  const commentedWorkflow = [
    "name: docker-ubuntu-install-sh-test",
    "",
    "on:",
    "  # THIS IS NON-BLOCKING AND STILL LOUD, and the loudness needs no wiring here.",
    "  # `drift-dashboard-cadence.yml` enumerates every active workflow and derives its",
    "  # expectation from this `on:` block: `expectationFromWorkflow`",
    "  # (src/Core.TypeScript/forge-host/github/workflow-triggers.ts) turns a `cron:`",
    '  # into `{ kind: "periodic", periodSeconds }` -- and it treats a workflow that is',
    "  # BOTH scheduled and PR-triggered as `periodic`.",
    "  schedule:",
    '    - cron: "11 3 * * *"',
    "  pull_request:",
    "    types: [opened, reopened, synchronize]",
    "  workflow_dispatch:",
    "",
    "jobs:",
    "  a: {}",
    "",
  ].join("\n");

  it("reads the declared cron and only the declared cron", () => {
    const e = expectationFromWorkflow(commentedWorkflow, "main");
    expect(e.kind).toBe("periodic");
    expect(e.kind === "periodic" && e.periodSeconds).toBe(86_400);
    const detail = e.kind === "periodic" ? e.detail : "";
    expect(detail).toContain("`11 3 * * *`");
    // The bogus value. Before the fix this read ``schedule: `\``, `11 3 * * *` ...``.
    expect(detail).not.toContain("``");
    expect(detail).not.toContain("not fully derivable");
  });

  it("emits markdown a linter accepts — no unmatched or nested code span", () => {
    const e = expectationFromWorkflow(commentedWorkflow, "main");
    const detail = e.kind === "periodic" ? e.detail : "";
    // Balanced spans, and nothing markup-active left outside them.
    expect((detail.match(/`/g) ?? []).length % 2).toBe(0);
    expect(detail.replace(/`[^`]*`/g, "")).not.toContain("*");
  });
});

describe("extractCrons — declarations only, and a value it cannot read is refused", () => {
  it("names a rejected value instead of rendering it as a cron", () => {
    const x = extractCrons("  schedule:\n    - cron: not-a-cron\n    - cron: '0 6 * * *'\n");
    expect(x.crons).toEqual(["0 6 * * *"]);
    expect(x.rejected).toEqual(["not-a-cron"]);
    expect(x.scheduleDeclared).toBe(true);
  });

  it("reads a scalar that begins on the following line", () => {
    // low-memory.yml's real shape. The old newline-greedy `\s*` read this by accident;
    // an anchored rewrite that dropped it would have swapped one silent defect for another.
    const x = extractCrons('  schedule:\n    - cron:\n        "0 6 * * *" # 06:00 UTC daily\n        # (continued)\n');
    expect(x.crons).toEqual(["0 6 * * *"]);
    expect(x.rejected).toEqual([]);
  });

  it("strips a trailing comment from an unquoted scalar", () => {
    expect(extractCrons("  schedule:\n    - cron: 0 6 * * *  # daily\n").crons).toEqual(["0 6 * * *"]);
  });

  it("every workflow in this repo declares only readable crons", () => {
    // The end-to-end falsifier: the reduction above is a fixture, this is the substrate.
    // A workflow whose `on:` prose or malformed cron feeds junk to the dashboard fails HERE.
    const dir = ".github/workflows";
    const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
    expect(files.length).toBeGreaterThan(20);
    const bad: string[] = [];
    for (const f of files) {
      const on = extractOnBlock(readFileSync(`${dir}/${f}`, "utf8"));
      if (on === null) continue;
      const x = extractCrons(on);
      if (x.rejected.length > 0) bad.push(`${f}: ${JSON.stringify(x.rejected)}`);
      if (x.scheduleDeclared && x.crons.length === 0) bad.push(`${f}: schedule with no readable cron`);
    }
    expect(bad).toEqual([]);
  });
});

describe("a `schedule:` we cannot read is unknown, never quietly on-change", () => {
  it("does not fall through to the push arm", () => {
    // Falling through would downgrade a cadence claim to `on-change`, and the dashboard
    // would stop asking why the clock went quiet — a check that cannot fail.
    const e = expectationFromWorkflow("on:\n  schedule:\n    - cron: junk\n  push:\n    branches: [main]\n", "main");
    expect(e.kind).toBe("unknown");
    expect(e.detail).toContain("junk");
  });

  it("shows the unreadable value without breaking the markdown that shows it", () => {
    const e = expectationFromWorkflow("on:\n  schedule:\n    - cron: '`'\n", "main");
    expect(e.kind).toBe("unknown");
    // A BACKSLASH-ESCAPED backtick is inert in CommonMark, so parity is checked on what
    // is left after the escapes are consumed — the raw count is 7 here and that is fine.
    const live = e.detail.replace(/\\./g, "");
    expect((live.match(/`/g) ?? []).length % 2).toBe(0);
    expect(e.detail).toContain("\\`");
  });
});

describe("key matches are comment-blind, by anchor and not by accident", () => {
  it("listValuesFor ignores a commented-out key", () => {
    const sub = "    # branches: [never]\n    branches: [main]\n";
    expect(listValuesFor(sub, "branches")).toEqual(["main"]);
  });

  it("triggerSubBlock ignores a commented-out trigger", () => {
    expect(triggerSubBlock("  # push:\n  pull_request:\n    types: [opened]\n", "push")).toBeNull();
  });
});
