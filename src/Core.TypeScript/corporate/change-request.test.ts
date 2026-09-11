import { describe, expect, test } from "bun:test";
import {
  keptOutPaths,
  missingSections,
  sectionsBrief,
  SyncMethod,
  validateChangeRequests,
  type ChangeRequestConfig,
} from "./change-request";

const config: ChangeRequestConfig = {
  sections: [
    { heading: "Problem statement", states: "what the reporter saw" },
    { heading: "Root cause", states: "why it happened, with file:line" },
  ],
  keepOut: ["*.png", "docs/task-*/**"],
  sync: SyncMethod.MergeTarget,
  why: "reviewers read the problem before the diff",
};

describe("A CONFIGURATION MUST BE ABLE TO MEAN WHAT IT SAYS", () => {
  test("a well-formed configuration passes", () => {
    expect(validateChangeRequests(config)).toEqual({ ok: true });
  });
  test("no sections, an empty 'states', a repeated heading, an unknown sync, or no reason are each refused", () => {
    expect(validateChangeRequests({ ...config, sections: [] }).ok).toBe(false);
    expect(validateChangeRequests({ ...config, sections: [{ heading: "Root cause", states: " " }] }).ok).toBe(false);
    expect(validateChangeRequests({ ...config, sections: [...config.sections, { heading: "root cause", states: "x" }] }).ok).toBe(false);
    expect(validateChangeRequests({ ...config, sync: "rebase" as never }).ok).toBe(false);
    expect(validateChangeRequests({ ...config, why: "" }).ok).toBe(false);
    expect(validateChangeRequests({ ...config, sections: [{ heading: "# Title", states: "x" }] }).ok).toBe(false);
  });
});

describe("A SECTION IS A HEADING, NOT A WORD IN A PARAGRAPH", () => {
  test("every configured heading present as a markdown heading satisfies the check, whatever its level or trailing colon", () => {
    expect(missingSections("## Problem statement\nx\n\n### Root cause:\ny", config.sections)).toEqual([]);
  });
  test("a heading mentioned only in prose is still missing, and missing ones come back in configured order", () => {
    expect(missingSections("The root cause was a race.\n## Something else", config.sections)).toEqual(["Problem statement", "Root cause"]);
  });
});

describe("WHAT A CHANGE MAY NEVER ADD", () => {
  test("a name pattern matches anywhere; a path pattern is anchored; ** spans directories", () => {
    const added = ["e2e/features/AIAGENT-1662/screenshots/after-nav.png", "docs/task-012/reproduction.md", "docs/adr/0001.md", "src/logo.PNG", "server/a.ts"];
    expect(keptOutPaths(added, config.keepOut)).toEqual(["e2e/features/AIAGENT-1662/screenshots/after-nav.png", "docs/task-012/reproduction.md", "src/logo.PNG"]);
  });
  test("nothing configured keeps nothing out", () => {
    expect(keptOutPaths(["a.png"], [])).toEqual([]);
  });
});

test("the author's brief carries each exact heading with what it must state", () => {
  expect(sectionsBrief(config.sections)).toBe("## Problem statement\nwhat the reporter saw\n\n## Root cause\nwhy it happened, with file:line");
});
