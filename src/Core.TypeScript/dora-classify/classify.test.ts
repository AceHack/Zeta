// tools/dora-classify/classify.test.ts
//
// Unit tests for the pure-logic exports of classify.ts.
// I/O surface (git log / git diff-tree) is NOT tested here; only
// the classification logic.

import { describe, expect, test } from "bun:test";

import {
  aggregateAuthorRatios,
  classifyCommit,
  classifyPath,
  type ClassificationResult,
  type CommitMetadata,
  type Lane,
} from "./classify";

describe("classifyPath", () => {
  test("operational: src/", () => {
    expect(classifyPath("src/Core.FSharp/Types.fs")).toBe("operational");
  });

  test("operational: tools/installer/", () => {
    expect(classifyPath("tools/installer/zeta-creds-crypto.ts")).toBe("operational");
  });

  test("operational: full-ai-cluster/", () => {
    expect(classifyPath("full-ai-cluster/nixos/modules/common.nix")).toBe("operational");
  });

  test("operational: tools/setup/", () => {
    expect(classifyPath("tools/setup/install.sh")).toBe("operational");
  });

  test("verbatim-preservation: memory/<persona>/*/conversations/", () => {
    expect(classifyPath("memory/kestrel/conversations/2026-05-27-x.md")).toBe("verbatim-preservation");
  });

  test("memory: memory/*.md (project memory, not persona)", () => {
    expect(classifyPath("memory/CURRENT-otto.md")).toBe("memory");
  });

  test("heartbeat: docs/agent-heartbeats/", () => {
    expect(classifyPath("docs/agent-heartbeats/otto/2026/05/28/zetaid.md")).toBe("heartbeat");
  });

  test("backlog-row: docs/backlog/", () => {
    expect(classifyPath("docs/backlog/P1/081KSKBP80008QG0R000B3Y19A-foo.md")).toBe("backlog-row");
  });

  test("shadow-work: docs/hygiene-history/ticks/", () => {
    expect(classifyPath("docs/hygiene-history/ticks/2026/05/28/0145Z.md")).toBe("shadow-work");
  });

  test("shadow-work: shadow-lesson-log via filename pattern", () => {
    expect(classifyPath("docs/research/2026-05-27-shadow-lesson-log-foo.md")).toBe("shadow-work");
  });

  test("tooling-or-ci: tools/ci/", () => {
    expect(classifyPath("tools/ci/audit-installer-substrate.ts")).toBe("tooling-or-ci");
  });

  test("tooling-or-ci: tools/hygiene/", () => {
    expect(classifyPath("tools/hygiene/audit-x.ts")).toBe("tooling-or-ci");
  });

  // Post-#8050 locations. These MUST beat the `src/` operational rule --
  // without the src/Core.TypeScript/{ci,hygiene,lint}/ rules ordered above it,
  // every hygiene/lint/ci change silently lanes as `operational`.
  test("tooling-or-ci: src/Core.TypeScript/ci/ (post-#8050)", () => {
    expect(classifyPath("src/Core.TypeScript/ci/audit-installer-substrate.ts")).toBe("tooling-or-ci");
  });

  test("tooling-or-ci: src/Core.TypeScript/hygiene/ (post-#8050)", () => {
    expect(classifyPath("src/Core.TypeScript/hygiene/audit-x.ts")).toBe("tooling-or-ci");
  });

  test("tooling-or-ci: src/Core.TypeScript/lint/ (post-#8050)", () => {
    expect(classifyPath("src/Core.TypeScript/lint/no-empty-dirs.ts")).toBe("tooling-or-ci");
  });

  test("operational: src/ outside the tooling subtrees still lanes operational", () => {
    expect(classifyPath("src/Core/ZSet.fs")).toBe("operational");
    expect(classifyPath("src/Core.TypeScript/installer/zeta-creds-persist.ts")).toBe("operational");
  });

  test("tooling-or-ci: .github/workflows/", () => {
    expect(classifyPath(".github/workflows/ci.yml")).toBe("tooling-or-ci");
  });

  test("docs-general: docs/* not matching specific lanes", () => {
    expect(classifyPath("docs/research/2026-05-27-aaron-kestrel-foo.md")).toBe("docs-general");
  });

  test("docs-general: docs/VISION.md", () => {
    expect(classifyPath("docs/VISION.md")).toBe("docs-general");
  });

  test("substrate-cascade: unclassifiable top-level files", () => {
    expect(classifyPath("AGENTS.md")).toBe("substrate-cascade");
  });

  test("substrate-cascade: random root-level file", () => {
    expect(classifyPath("RANDOM-NOTES.md")).toBe("substrate-cascade");
  });
});

describe("classifyCommit", () => {
  function makeCommit(files: readonly string[], author: string = "otto"): CommitMetadata {
    return {
      sha: "deadbeef",
      author,
      authorEmail: `${author}@example.com`,
      timestampIso: "2026-05-28T00:00:00Z",
      subject: "test commit",
      changedFiles: files,
    };
  }

  test("single-lane commit returns that lane", () => {
    const r = classifyCommit(makeCommit(["src/foo.fs", "src/bar.fs"]));
    expect(r.lane).toBe("operational");
    expect(r.distinctLanes).toEqual(["operational"]);
  });

  test("multi-lane commit returns mixed + distinct lanes", () => {
    const r = classifyCommit(makeCommit([
      "src/foo.fs",
      "docs/backlog/P1/081KSKBP80008QG0R000B3Y19A-x.md",
    ]));
    expect(r.lane).toBe("mixed");
    expect([...r.distinctLanes].sort()).toEqual([
      "backlog-row",
      "operational",
    ]);
  });

  test("empty changedFiles → substrate-cascade", () => {
    const r = classifyCommit(makeCommit([]));
    expect(r.lane).toBe("substrate-cascade");
  });

  test("verbatim-preservation single-lane", () => {
    const r = classifyCommit(makeCommit([
      "memory/kestrel/conversations/2026-05-27-x.md",
      "memory/mika/conversations/2026-05-27-y.md",
    ]));
    expect(r.lane).toBe("verbatim-preservation");
  });

  test("preserves per-file lane assignment for audit", () => {
    const r = classifyCommit(makeCommit([
      "src/foo.fs",
      "docs/backlog/P1/081KSKBP80008QG0R000B3Y19A-x.md",
      "memory/otto/cli/claude/conversations/foo.md",
    ]));
    expect(r.perFileLanes).toHaveLength(3);
    expect(r.perFileLanes[0]?.lane).toBe("operational");
    expect(r.perFileLanes[1]?.lane).toBe("backlog-row");
    expect(r.perFileLanes[2]?.lane).toBe("verbatim-preservation");
  });

  test("preserves author for per-agent ratio tracking", () => {
    const r = classifyCommit(makeCommit(["src/foo.fs"], "alexa"));
    expect(r.author).toBe("alexa");
  });
});

describe("aggregateAuthorRatios", () => {
  function makeResult(author: string, lane: Lane, distinctLanes?: readonly Lane[]): ClassificationResult {
    return {
      sha: "x",
      author,
      lane,
      perFileLanes: [],
      distinctLanes: distinctLanes ?? [lane],
    };
  }

  test("computes operational-ratio per author", () => {
    const stats = aggregateAuthorRatios([
      makeResult("otto", "operational"),
      makeResult("otto", "operational"),
      makeResult("otto", "backlog-row"),
      makeResult("otto", "verbatim-preservation"),
    ]);
    expect(stats).toHaveLength(1);
    expect(stats[0]?.author).toBe("otto");
    expect(stats[0]?.totalCommits).toBe(4);
    expect(stats[0]?.operationalCount).toBe(2);
    expect(stats[0]?.operationalRatio).toBe(0.5);
  });

  test("mixed-with-operational counts toward operational", () => {
    const stats = aggregateAuthorRatios([
      makeResult("otto", "mixed", ["operational", "backlog-row"]),
      makeResult("otto", "mixed", ["backlog-row", "memory"]),
      makeResult("otto", "operational"),
    ]);
    expect(stats[0]?.operationalCount).toBe(2);
    expect(stats[0]?.operationalRatio).toBeCloseTo(2 / 3);
  });

  test("separates authors", () => {
    const stats = aggregateAuthorRatios([
      makeResult("otto", "operational"),
      makeResult("alexa", "operational"),
      makeResult("alexa", "backlog-row"),
    ]);
    expect(stats).toHaveLength(2);
    const otto = stats.find((s) => s.author === "otto");
    const alexa = stats.find((s) => s.author === "alexa");
    expect(otto?.operationalRatio).toBe(1);
    expect(alexa?.operationalRatio).toBe(0.5);
  });

  test("zero commits → empty stats array", () => {
    const stats = aggregateAuthorRatios([]);
    expect(stats).toHaveLength(0);
  });

  test("per-lane count tracked", () => {
    const stats = aggregateAuthorRatios([
      makeResult("otto", "operational"),
      makeResult("otto", "operational"),
      makeResult("otto", "verbatim-preservation"),
      makeResult("otto", "heartbeat"),
    ]);
    expect(stats[0]?.perLaneCount.operational).toBe(2);
    expect(stats[0]?.perLaneCount["verbatim-preservation"]).toBe(1);
    expect(stats[0]?.perLaneCount.heartbeat).toBe(1);
  });
});
