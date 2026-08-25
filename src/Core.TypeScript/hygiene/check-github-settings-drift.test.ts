import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  countLeaves,
  formatReadabilityReport,
  parseArgs,
  partitionByReadability,
} from "./check-github-settings-drift";

const SENTINEL = { _skipped: "insufficient-token-scope" } as const;

let priorGhRepo: string | undefined;

beforeEach(() => {
  priorGhRepo = process.env["GH_REPO"];
  delete process.env["GH_REPO"];
});

afterEach(() => {
  if (priorGhRepo === undefined) delete process.env["GH_REPO"];
  else process.env["GH_REPO"] = priorGhRepo;
});

describe("parseArgs", () => {
  test("--repo OWNER/NAME → success and default expected path", async () => {
    const result = await parseArgs(["--repo", "Lucent-Financial-Group/Zeta"]);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("Lucent-Financial-Group/Zeta");
      expect(result.args.expected).toMatch(/github-settings\.expected\.json$/);
    }
  });

  test("--expected PATH overrides default", async () => {
    const result = await parseArgs([
      "--repo",
      "AceHack/Zeta",
      "--expected",
      "/tmp/custom-snapshot.json",
    ]);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.expected).toBe("/tmp/custom-snapshot.json");
    }
  });

  test("--repo without value returns an error", async () => {
    const result = await parseArgs(["--repo"]);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("--repo requires OWNER/NAME argument");
    }
  });

  test("--expected without value returns an error", async () => {
    const result = await parseArgs(["--repo", "owner/name", "--expected"]);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("--expected requires PATH argument");
    }
  });

  test("unknown flag returns an error", async () => {
    const result = await parseArgs(["--bogus"]);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("unknown arg");
    }
  });

  test("falls back to GH_REPO env var when no argv", async () => {
    process.env["GH_REPO"] = "env/zeta";
    const result = await parseArgs([]);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("env/zeta");
    }
  });

  test("explicit --repo overrides GH_REPO env var", async () => {
    process.env["GH_REPO"] = "env/zeta";
    const result = await parseArgs(["--repo", "argv/zeta"]);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("argv/zeta");
    }
  });
});

// ---------------------------------------------------------------------------
// READABILITY — a scan that compared nothing did not pass.
//
// The defect these pin: the previous implementation stripped unreadable fields
// from BOTH sides and then diffed what was left. Strip everything and the diff
// is empty, so a credential that could read no settings at all produced
// `exit 0, "no drift"`. Reproduced against origin/main at ba92c40373:
// UNFIXED exit 0; fixed exit 3.
// ---------------------------------------------------------------------------

describe("countLeaves", () => {
  test("counts scalars, and a populated array by its elements", () => {
    expect(countLeaves({ a: 1, b: "x", c: [1, 2, 3] })).toBe(5);
  });

  test("an EMPTY array is one leaf — it is a real compared value", () => {
    // `"topics": []` means "no topics" and confirming it is work. Scoring it
    // zero would let a legitimate run be called INDETERMINATE.
    expect(countLeaves({ topics: [] })).toBe(1);
  });

  test("an empty object has zero leaves — the case that must not read as success", () => {
    expect(countLeaves({})).toBe(0);
    expect(countLeaves({ a: {}, b: { c: {} } })).toBe(0);
  });
});

describe("partitionByReadability", () => {
  test("drops live-side sentinels from BOTH sides and names them", () => {
    const live: Record<string, unknown> = { repo: SENTINEL, topics: [] };
    const exp: Record<string, unknown> = { repo: { has_wiki: true }, topics: [] };
    const part = partitionByReadability(live, exp);

    expect(part.unreadableLive).toEqual(["repo"]);
    expect(part.unreadableExpected).toEqual([]);
    expect(live).toEqual({ topics: [] });
    expect(exp).toEqual({ topics: [] });
    expect(part.comparedLeaves).toBe(1);
  });

  test("reports an EXPECTED-side sentinel separately — the old walk could not see it", () => {
    // The previous strip iterated `Object.keys(live)` only. A sentinel sitting
    // in the COMMITTED file was therefore diffed against a real live value and
    // reported as ordinary drift — an unrecorded field wearing the costume of
    // a changed one. They need different fixes: a changed setting is reverted,
    // an unrecorded one is re-snapshotted with a stronger credential.
    const live: Record<string, unknown> = { codeql_default_setup: { state: "configured" } };
    const exp: Record<string, unknown> = { codeql_default_setup: SENTINEL };
    const part = partitionByReadability(live, exp);

    expect(part.unreadableExpected).toEqual(["codeql_default_setup"]);
    expect(part.unreadableLive).toEqual([]);
    expect(part.comparedLeaves).toBe(0);
  });

  test("recurses into nested objects", () => {
    const live: Record<string, unknown> = { counts: { webhooks: SENTINEL, deploy_keys: 0 } };
    const exp: Record<string, unknown> = { counts: { webhooks: 3, deploy_keys: 0 } };
    const part = partitionByReadability(live, exp);

    expect(part.unreadableLive).toEqual(["counts.webhooks"]);
    expect(live).toEqual({ counts: { deploy_keys: 0 } });
    expect(part.comparedLeaves).toBe(1);
  });

  test("everything unreadable ⇒ comparedLeaves 0, which the caller turns into exit 3", () => {
    const live: Record<string, unknown> = { repo: SENTINEL, rulesets: SENTINEL, counts: SENTINEL };
    const exp: Record<string, unknown> = { repo: { a: 1 }, rulesets: [], counts: { webhooks: 0 } };
    const part = partitionByReadability(live, exp);

    expect(part.comparedLeaves).toBe(0);
    expect(part.unreadableLive).toEqual(["counts", "repo", "rulesets"]);
    // And the two sides are now byte-identical — which is precisely why the
    // old code called this "no drift".
    expect(JSON.stringify(live)).toBe(JSON.stringify(exp));
  });
});

describe("formatReadabilityReport", () => {
  test("names the field, the endpoint that produced it, and the remedy", () => {
    const lines = formatReadabilityReport(
      { unreadableLive: ["default_branch_protection"], unreadableExpected: [], comparedLeaves: 12 },
      "Lucent-Financial-Group/Zeta",
    ).join("\n");

    expect(lines).toContain("RECORDED BUT NOT CHECKED — 1 field(s)");
    expect(lines).toContain("default_branch_protection");
    expect(lines).toContain("/repos/Lucent-Financial-Group/Zeta/branches/");
    expect(lines).toContain("DRIFT_DETECTOR_PAT");
  });

  test("always states the denominator, even on a fully readable run", () => {
    // A check that will not say how much it covered is not reporting a result.
    const lines = formatReadabilityReport(
      { unreadableLive: [], unreadableExpected: [], comparedLeaves: 71 },
      "o/r",
    ).join("\n");

    expect(lines).toContain("compared 71 readable leaf value(s)");
  });

  test("distinguishes unrecorded from unverified in the wording", () => {
    const lines = formatReadabilityReport(
      { unreadableLive: [], unreadableExpected: ["actions_permissions"], comparedLeaves: 3 },
      "o/r",
    ).join("\n");

    expect(lines).toContain("NOT RECORDED AT ALL");
    expect(lines).toContain("there is no recorded value to compare against");
  });
});

describe("parseArgs — --live-from", () => {
  test("accepts a replay path", async () => {
    const result = await parseArgs(["--repo", "o/r", "--live-from", "/tmp/live.json"]);
    expect(result.kind).toBe("args");
    if (result.kind === "args") expect(result.args.liveFrom).toBe("/tmp/live.json");
  });

  test("--live-from without value returns an error", async () => {
    const result = await parseArgs(["--live-from"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.message).toContain("--live-from requires PATH argument");
  });
});

describe("partitionByReadability — inside arrays", () => {
  test("finds an unreadable bypass_actors inside rulesets[i]", () => {
    // The exact CI condition of PR #15369: GITHUB_TOKEN reads the rulesets but
    // NOT their bypass actors. Without the array descent this sentinel is
    // diffed literally and reported as "the admin bypass was REMOVED" — a
    // false finding whose cheapest fix is to record [] and erase the true one.
    const live: Record<string, unknown> = {
      rulesets: [{ id: 1, enforcement: "active", bypass_actors: SENTINEL }],
    };
    const exp: Record<string, unknown> = {
      rulesets: [
        {
          id: 1,
          enforcement: "active",
          bypass_actors: [{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request" }],
        },
      ],
    };
    const part = partitionByReadability(live, exp);

    expect(part.unreadableLive).toEqual(["rulesets[0].bypass_actors"]);
    expect(JSON.stringify(live)).toBe(JSON.stringify(exp));
    expect(part.comparedLeaves).toBe(2); // id + enforcement; bypass_actors was stripped
  });

  test("does NOT strip inside arrays of unequal length — that is real drift", () => {
    // A ruleset added or removed must reach the diff whole. A mis-aligned
    // element-wise walk would delete fields off both sides at shifted indices
    // and could make a genuine addition look partly reconciled.
    const live: Record<string, unknown> = { rulesets: [{ id: 1 }, { id: 2 }] };
    const exp: Record<string, unknown> = { rulesets: [{ id: 1 }] };
    const part = partitionByReadability(live, exp);

    expect(part.unreadableLive).toEqual([]);
    expect(live["rulesets"]).toEqual([{ id: 1 }, { id: 2 }]);
    expect(exp["rulesets"]).toEqual([{ id: 1 }]);
  });

  test("the report resolves an indexed path to its endpoint", () => {
    const lines = formatReadabilityReport(
      { unreadableLive: ["rulesets[1].bypass_actors"], unreadableExpected: [], comparedLeaves: 4 },
      "o/r",
    ).join("\n");

    expect(lines).toContain("rulesets[1].bypass_actors");
    expect(lines).not.toContain("(endpoint unmapped)");
    expect(lines).toContain("/repos/o/r/rulesets");
  });
});
