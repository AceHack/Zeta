import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  endpointForPath,
  INSUFFICIENT_TOKEN_SCOPE,
  isInsufficientTokenScope403,
  normalizeBypassActors,
  parseArgs,
  parseJsonSafe,
  unreadablePaths,
} from "./snapshot-github-settings";

const NULL_RESOLVER = async (): Promise<string> => "";

let priorGhRepo: string | undefined;

beforeEach(() => {
  priorGhRepo = process.env["GH_REPO"];
  delete process.env["GH_REPO"];
});

afterEach(() => {
  if (priorGhRepo === undefined) delete process.env["GH_REPO"];
  else process.env["GH_REPO"] = priorGhRepo;
});

describe("parseJsonSafe", () => {
  test("parses a valid JSON object", () => {
    expect(parseJsonSafe('{"a":1}')).toEqual({ a: 1 });
  });

  test("parses a valid JSON array", () => {
    expect(parseJsonSafe("[1,2,3]")).toEqual([1, 2, 3]);
  });

  test("returns fallback (null by default) for null input", () => {
    expect(parseJsonSafe(null)).toBeNull();
  });

  test("returns fallback (null by default) for empty string input", () => {
    expect(parseJsonSafe("")).toBeNull();
  });

  test("honours an explicit fallback", () => {
    expect(parseJsonSafe(null, [])).toEqual([]);
    expect(parseJsonSafe("", { skipped: true })).toEqual({ skipped: true });
  });

  test("returns fallback for invalid JSON instead of throwing", () => {
    expect(parseJsonSafe("not-json", [])).toEqual([]);
    expect(parseJsonSafe("{unterminated", null)).toBeNull();
  });
});

describe("isInsufficientTokenScope403", () => {
  test("matches GitHub Actions token-scope 403s", () => {
    expect(isInsufficientTokenScope403("gh: Resource not accessible by integration (HTTP 403)")).toBe(true);
  });

  test("matches fine-grained PAT token-scope 403s", () => {
    expect(isInsufficientTokenScope403("gh: Resource not accessible by personal access token (HTTP 403)")).toBe(true);
  });

  test("matches admin-permission 403s", () => {
    expect(isInsufficientTokenScope403("gh: Must have admin rights to Repository. (HTTP 403)")).toBe(true);
  });

  test("does not match secondary rate limits", () => {
    expect(isInsufficientTokenScope403("gh: You have exceeded a secondary rate limit. (HTTP 403)")).toBe(false);
  });

  test("does not match generic 403s without a token-scope signature", () => {
    expect(isInsufficientTokenScope403("gh: Forbidden (HTTP 403)")).toBe(false);
  });

  test("does not match non-403 errors", () => {
    expect(isInsufficientTokenScope403("gh: Not Found (HTTP 404)")).toBe(false);
  });
});

describe("parseArgs", () => {
  test("--repo OWNER/NAME → success", async () => {
    const result = await parseArgs(["--repo", "Lucent-Financial-Group/Zeta"], NULL_RESOLVER);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("Lucent-Financial-Group/Zeta");
    }
  });

  test("positional arg is accepted as repo", async () => {
    const result = await parseArgs(["AceHack/Zeta"], NULL_RESOLVER);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("AceHack/Zeta");
    }
  });

  test("--repo without value returns an error", async () => {
    const result = await parseArgs(["--repo"], NULL_RESOLVER);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("--repo requires OWNER/NAME argument");
    }
  });

  test("falls back to GH_REPO env var when no argv", async () => {
    process.env["GH_REPO"] = "env/zeta";
    const result = await parseArgs([], NULL_RESOLVER);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("env/zeta");
    }
  });

  test("explicit --repo overrides GH_REPO env var", async () => {
    process.env["GH_REPO"] = "env/zeta";
    const result = await parseArgs(["--repo", "argv/zeta"], NULL_RESOLVER);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("argv/zeta");
    }
  });

  test("falls back to the resolveDefault function when argv and env are empty", async () => {
    const resolver = async (): Promise<string> => "resolver/zeta";
    const result = await parseArgs([], resolver);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("resolver/zeta");
    }
  });

  test("returns error when argv, env, and resolver all yield empty", async () => {
    const result = await parseArgs([], NULL_RESOLVER);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("cannot determine repo");
    }
  });

  test("argv > env > resolver precedence ordering", async () => {
    // argv wins
    process.env["GH_REPO"] = "env/zeta";
    const resolver = async (): Promise<string> => "resolver/zeta";
    const r1 = await parseArgs(["argv/zeta"], resolver);
    expect(r1.kind === "args" && r1.args.repo).toBe("argv/zeta");

    // env wins over resolver
    const r2 = await parseArgs([], resolver);
    expect(r2.kind === "args" && r2.args.repo).toBe("env/zeta");

    // resolver wins when env unset
    delete process.env["GH_REPO"];
    const r3 = await parseArgs([], resolver);
    expect(r3.kind === "args" && r3.args.repo).toBe("resolver/zeta");
  });
});

// ---------------------------------------------------------------------------
// bypass_actors — the field the snapshot did not capture until 2026-08-25.
//
// It names WHO MAY MERGE PAST A RULE. A drift detector blind to it cannot see
// the change that matters most on a ruleset, which is why these are the first
// tests in this block and why the committed-record assertions below are
// phrased as refusals rather than as expectations.
// ---------------------------------------------------------------------------

describe("normalizeBypassActors", () => {
  test("projects the three fields the API returns", () => {
    expect(
      normalizeBypassActors([{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request", extra: 1 }]),
    ).toEqual([{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request" }]);
  });

  test("sorts ordinally so the snapshot is byte-stable across runs", () => {
    // The API promises no order. An unstable order would make every run report
    // drift, and a detector that always cries drift is a detector that gets
    // muted — the failure this sort exists to prevent.
    const a = normalizeBypassActors([
      { actor_id: 2, actor_type: "Team", bypass_mode: "always" },
      { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request" },
      { actor_id: 1, actor_type: "OrganizationAdmin", bypass_mode: "always" },
    ]);
    const b = normalizeBypassActors([
      { actor_id: 1, actor_type: "OrganizationAdmin", bypass_mode: "always" },
      { actor_id: 2, actor_type: "Team", bypass_mode: "always" },
      { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request" },
    ]);
    expect(a).toEqual(b);
    // Narrowing, not a cast: the return type is `... | null` precisely so an
    // unreadable list cannot be mistaken for an empty one, and a test that
    // asserted through it with `!` would be spending the guarantee it checks.
    expect(a).not.toBeNull();
    if (a === null) throw new Error("unreachable: a populated input is readable");
    expect(a.map((x) => x.actor_type)).toEqual(["OrganizationAdmin", "RepositoryRole", "Team"]);
  });

  test("ABSENT is null, not [] — the defect this whole change is about", () => {
    // `GET /rulesets/{id}` OMITS `bypass_actors` for a reader without admin
    // rights. It does not 403 and it does not return []. Verified
    // unauthenticated against ruleset 16134995 on 2026-08-25: the key is
    // simply not in the response, while an admin credential sees one actor.
    //
    // Coercing that to [] would make a credential that CANNOT SEE the bypass
    // list report "nobody may bypass" — absence reading as the safe value.
    // This function returned [] here in the first draft of the fix and CI
    // caught it: under GITHUB_TOKEN the check reported the live admin bypass
    // as REMOVED, and recording [] would have erased the finding.
    expect(normalizeBypassActors(undefined)).toBeNull();
    expect(normalizeBypassActors(null)).toBeNull();
    expect(normalizeBypassActors("nope")).toBeNull();
  });

  test("[] keeps its real meaning: read successfully, nobody bypasses", () => {
    expect(normalizeBypassActors([])).toEqual([]);
  });

  test("a malformed element is projected, never thrown on", () => {
    expect(normalizeBypassActors([null])).toEqual([{ actor_id: null, actor_type: "", bypass_mode: "" }]);
  });
});

describe("unreadablePaths", () => {
  test("finds sentinels at top level and nested, ordinally sorted", () => {
    expect(
      unreadablePaths({
        zeta: { _skipped: INSUFFICIENT_TOKEN_SCOPE },
        counts: { webhooks: { _skipped: INSUFFICIENT_TOKEN_SCOPE }, deploy_keys: 0 },
        alpha: 1,
      }),
    ).toEqual(["counts.webhooks", "zeta"]);
  });

  test("returns [] when everything was readable", () => {
    expect(unreadablePaths({ a: 1, b: { c: [1, 2] } })).toEqual([]);
  });

  test("does not mistake an unrelated _skipped value for the sentinel", () => {
    expect(unreadablePaths({ a: { _skipped: "some-other-reason" } })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// THE COMMITTED RECORD ITSELF.
//
// These assert properties of `github-settings.expected.json` rather than of
// any function, because the defect class they guard is a FILE that looks
// complete and is not. Both fail against the record as it stood on
// origin/main at ba92c40373.
// ---------------------------------------------------------------------------

describe("github-settings.expected.json — the record must not lie by omission", () => {
  const EXPECTED_PATH = join(import.meta.dir, "github-settings.expected.json");
  const record = JSON.parse(readFileSync(EXPECTED_PATH, "utf8")) as Record<string, unknown>;

  test("every recorded ruleset carries bypass_actors", () => {
    const rulesets = record["rulesets"] as Array<Record<string, unknown>>;
    expect(Array.isArray(rulesets)).toBe(true);
    expect(rulesets.length).toBeGreaterThan(0);
    for (const rs of rulesets) {
      expect(
        Array.isArray(rs["bypass_actors"]),
        `ruleset ${String(rs["id"])} "${String(rs["name"])}" has no bypass_actors — ` +
          "the record cannot say who may merge past it",
      ).toBe(true);
    }
  });

  test("the record contains NO insufficient-token-scope sentinel", () => {
    // This is the guard on the REFUSED fix. When the drift check goes red, the
    // cheapest way to make it green is to re-snapshot with the CI token: every
    // admin-only field becomes a sentinel, the checker drops sentinels from
    // both sides, and the diff is empty. That turns "recorded and unchecked"
    // into "absent and unchecked" and calls it success.
    //
    // So the committed record is required to have been produced by a
    // credential that could read everything. If this test is red, the fix is
    // to re-snapshot with an admin credential — never to relax this test.
    const sentinels = unreadablePaths(record);
    expect(sentinels, `record was captured by a credential that could not read: ${sentinels.join(", ")}`).toEqual([]);
  });

  test("the recorded workflow inventory is not truncated below the in-tree one", () => {
    // `/actions/workflows` pages at 30. Before pagination was fixed this file
    // recorded 30 of 90 workflows and looked whole.
    //
    // Stated limit, so nobody reads more into this than it carries: `>=`, not
    // `===`. GitHub keeps listing a workflow after its file is deleted, and a
    // PR that ADDS a workflow file cannot re-snapshot (the workflow does not
    // exist in the API until the PR merges). So the two sets legitimately
    // differ at the margin; what may NOT happen is the record falling below
    // the committed inventory, which is exactly what truncation causes.
    const workflowFiles = readdirSync(join(import.meta.dir, "..", "..", "..", ".github", "workflows")).filter((f) =>
      f.endsWith(".yml") || f.endsWith(".yaml"),
    );
    const recorded = record["workflows"] as unknown[];
    expect(
      recorded.length,
      `record lists ${recorded.length} workflows; ${workflowFiles.length} workflow files are committed`,
    ).toBeGreaterThanOrEqual(workflowFiles.length);
  });
});

describe("unreadablePaths — inside arrays", () => {
  test("reports a sentinel nested in an array element", () => {
    expect(
      unreadablePaths({ rulesets: [{ id: 1 }, { id: 2, bypass_actors: { _skipped: INSUFFICIENT_TOKEN_SCOPE } }] }),
    ).toEqual(["rulesets[1].bypass_actors"]);
  });
});

describe("endpointForPath", () => {
  test("strips array indices so an indexed path still resolves", () => {
    expect(endpointForPath("rulesets[3].bypass_actors", "o/r")).toContain("/repos/o/r/rulesets");
  });

  test("falls back to the first segment, then admits it does not know", () => {
    expect(endpointForPath("pages", "o/r")).toBe("GET /repos/o/r/pages");
    expect(endpointForPath("no_such_field", "o/r")).toBe("(endpoint unmapped)");
  });
});
