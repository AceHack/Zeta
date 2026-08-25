// Tests for the coverage gate on the pre-merge AgencySignature check.
//
// THE ONE TEST THAT MATTERS is `the underscan mutation` below: it builds a
// proposal whose first 250 commits agree and whose 251st does not, feeds the
// validator the TRUNCATED prefix the API actually returns, and asserts that the
// validator now REFUSES instead of passing. Delete the coverage gate and that
// test goes green-with-a-PASS — which is precisely the defect, so the test is a
// falsifier rather than a description.
//
// Everything here is pure: the environment arrives through the injected
// `CoverageEnv`, so no forge, no network, no clock (§13 noninterference, §7 DST).

import { describe, expect, test } from "bun:test";

import {
  GITHUB_PR_COMMITS_ENDPOINT_CAP,
  commitCoverage,
  declaredTotalFromEvent,
  refusesPass,
  renderRefusal,
  resolveCoverageFacts,
  type CoverageEnv,
} from "./agencysignature-commit-coverage.ts";
import { main } from "./validate-agencysignature-pr-body.ts";

const CAP = GITHUB_PR_COMMITS_ENDPOINT_CAP;

/** An environment that is not a GitHub Actions pull_request run. */
const LOCAL_ENV: CoverageEnv = {
  vars: {},
  readFile: () => {
    throw new Error("no filesystem in this test env");
  },
};

/** An Actions pull_request run whose event payload declares `commits: n`. */
function actionsEnv(n: number | "absent" | "unreadable", prBody?: string): CoverageEnv {
  return {
    vars: {
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: "/github/workflow/event.json",
      ...(prBody === undefined ? {} : { PR_BODY: prBody }),
    },
    readFile: (path: string): string => {
      expect(path).toBe("/github/workflow/event.json");
      if (n === "unreadable") throw new Error("ENOENT");
      if (n === "absent") return JSON.stringify({ pull_request: { number: 1 } });
      return JSON.stringify({ pull_request: { number: 1, commits: n } });
    },
  };
}

// ---------------------------------------------------------------------------
// THE DECISION
// ---------------------------------------------------------------------------
describe("commitCoverage", () => {
  const base = { applies: true, whyNotApplicable: "", cap: CAP } as const;

  test("counted: supplied covers the declared total", () => {
    const v = commitCoverage({ ...base, declaredTotal: 475, suppliedCount: 475 });
    expect(v).toEqual({ kind: "complete", total: 475, basis: "counted" });
    expect(refusesPass(v)).toBe(false);
  });

  test("counted: one commit short is an underscan, even far below the cap", () => {
    const v = commitCoverage({ ...base, declaredTotal: 12, suppliedCount: 11 });
    expect(v).toEqual({ kind: "underscan", total: 12, seen: 11, cap: CAP });
    expect(refusesPass(v)).toBe(true);
  });

  test("under-cap: an uncounted list of a small proposal is accepted", () => {
    const v = commitCoverage({ ...base, declaredTotal: CAP, suppliedCount: null });
    expect(v).toEqual({ kind: "complete", total: CAP, basis: "under-cap" });
  });

  test("the cap boundary is exact: 250 passes, 251 refuses", () => {
    expect(
      commitCoverage({ ...base, declaredTotal: CAP, suppliedCount: null }).kind,
    ).toBe("complete");
    expect(
      commitCoverage({ ...base, declaredTotal: CAP + 1, suppliedCount: null }).kind,
    ).toBe("underscan");
  });

  test("PR #11528's real numbers refuse", () => {
    // 475 declared, 250 readable. The live instance this whole change is about.
    const v = commitCoverage({ ...base, declaredTotal: 475, suppliedCount: null });
    expect(v).toEqual({ kind: "underscan", total: 475, seen: null, cap: CAP });
    expect(renderRefusal(v)).toContain("475 commits on this proposal");
  });

  test("an unknown total FAILS CLOSED — it never reads as 'few enough'", () => {
    const v = commitCoverage({ ...base, declaredTotal: null, suppliedCount: null });
    expect(v.kind).toBe("unknown-total");
    expect(refusesPass(v)).toBe(true);
  });

  test("not-applicable carries its reason, so an exemption is never silent", () => {
    const v = commitCoverage({
      applies: false,
      whyNotApplicable: "input IS the PR body",
      declaredTotal: null,
      suppliedCount: null,
      cap: CAP,
    });
    expect(v).toEqual({ kind: "not-applicable", why: "input IS the PR body" });
    expect(refusesPass(v)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// READING THE FACTS
// ---------------------------------------------------------------------------
describe("declaredTotalFromEvent", () => {
  test("reads pull_request.commits", () => {
    expect(declaredTotalFromEvent(actionsEnv(475))).toBe(475);
  });

  test("null when the payload cannot be read", () => {
    expect(declaredTotalFromEvent(actionsEnv("unreadable"))).toBeNull();
  });

  test("null when the field is absent", () => {
    expect(declaredTotalFromEvent(actionsEnv("absent"))).toBeNull();
  });

  test("null when GITHUB_EVENT_PATH is unset", () => {
    expect(declaredTotalFromEvent(LOCAL_ENV)).toBeNull();
  });

  test("null on a non-integer count — a string '475' is not a measurement", () => {
    const env: CoverageEnv = {
      vars: { GITHUB_EVENT_PATH: "/e.json" },
      readFile: () => JSON.stringify({ pull_request: { commits: "475" } }),
    };
    expect(declaredTotalFromEvent(env)).toBeNull();
  });
});

describe("resolveCoverageFacts — which lane am I?", () => {
  const args = { commitTotal: null, commitsSupplied: null };

  test("the PR-body lane is exempt: stdin IS the declared body", () => {
    const body = "## Summary\n\nwork\n";
    const facts = resolveCoverageFacts(args, body, actionsEnv(475, body));
    expect(facts.applies).toBe(false);
    expect(facts.whyNotApplicable).toContain("IS the declared PR body");
  });

  test("the preimage lane applies: stdin is NOT the declared body", () => {
    const facts = resolveCoverageFacts(args, "commit messages...", actionsEnv(475, "body"));
    expect(facts.applies).toBe(true);
    expect(facts.declaredTotal).toBe(475);
  });

  test("yaml drift fails toward MORE refusal: no PR_BODY ⇒ body lane is checked too", () => {
    const facts = resolveCoverageFacts(args, "## Summary\n", actionsEnv(475));
    expect(facts.applies).toBe(true);
  });

  test("a local run claims nothing about a commit list", () => {
    const facts = resolveCoverageFacts(args, "anything", LOCAL_ENV);
    expect(facts.applies).toBe(false);
    expect(facts.declaredTotal).toBeNull();
  });

  test("--commit-total is authoritative anywhere, including locally", () => {
    const facts = resolveCoverageFacts(
      { commitTotal: 475, commitsSupplied: 475 },
      "anything",
      LOCAL_ENV,
    );
    expect(facts.applies).toBe(true);
    expect(facts.declaredTotal).toBe(475);
    expect(facts.suppliedCount).toBe(475);
  });
});

// ---------------------------------------------------------------------------
// THE MUTATION — truncation must not be able to read as success.
//
// Shape taken from the live artifact (PR #11528: 475 commits, 250 readable, the
// oldest ones first): a long run of identical blocks with the divergence past
// the ceiling, which is exactly where a heartbeat lane's hand-corrected tail
// lands. The proposal is invalid; the prefix looks perfect.
// ---------------------------------------------------------------------------
//
// THE DIVERGING FIELD IS `Credential-Mode`, and it has now moved TWICE — from
// `Action-Mode` (2026-08-23) to `Human-Review` (same day) to here (2026-08-24).
// Both predecessors became RECONCILABLE: a squash mixing `human-directed` with
// `autonomous-*`, or `explicit` with `not-implied-by-credential`, now resolves to
// the weakest claim instead of erroring (`agencysignature-block.ts` §THE THIRD
// CASE: RECONCILABLE and §GENERALISATION). A reconcilable field makes the FULL
// list textually clean, so the mutation stops mutating and this suite measures
// only itself — the vacuity class, reached by a change in a different file.
//
// THE LESSON, since twice is a pattern: this fixture needs a field that is
// governance-critical AND STRUCTURALLY UNRESOLVABLE, not one that merely happens
// to be loud today. `Credential-Mode` qualifies for a stated reason rather than by
// elimination — it says WHOSE CREDENTIAL ACTED, which is not a per-commit causal
// fact about how the work was made, and its values carry no ordering by human
// backing, so there is no weakest to take and no direction in which a resolution
// could be safe. `agencysignature-block.test.ts` §SCOPE pins that from both sides.
function block(reviewDiverges: boolean, n: number): string {
  return [
    `metrics: append tick frame ${String(n)}`,
    "",
    "Agency-Signature-Version: 1",
    "Agent: Otto",
    "Agent-Runtime: Claude Code",
    "Agent-Model: claude-opus-5",
    "Credential-Identity: acehack00@gmail.com",
    reviewDiverges ? "Credential-Mode: dedicated-agent" : "Credential-Mode: shared",
    "Human-Review: not-implied-by-credential",
    "Human-Review-Evidence: none",
    "Action-Mode: autonomous-fail-closed",
    "Task: agencysignature-250-commit-underscan",
  ].join("\n");
}

/** `n` commit messages, concatenated the way `--jq '.[].commit.message'` emits them. */
function preimage(n: number, divergeAt: number): string {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    out.push(block(i === divergeAt, i));
  }
  return `${out.join("\n")}\n`;
}

const TOTAL = 300;
const DIVERGE_AT = 251; // one past the ceiling — invisible to the API fetch
const TRUNCATED = preimage(CAP, DIVERGE_AT); // what CI actually receives
const FULL = preimage(TOTAL, DIVERGE_AT); // what squash-merge actually lands

describe("the underscan mutation", () => {
  test("the full list FAILS — the cross-commit rule is correct and untouched", () => {
    const status = main([], FULL, actionsEnv(TOTAL, "body"));
    expect(status).toBe(1);
  });

  test("the truncated list is textually clean — this is why it used to pass", () => {
    // Same bytes, no coverage facts available: the old behaviour, reproduced.
    const status = main([], TRUNCATED, LOCAL_ENV);
    expect(status).toBe(0);
  });

  test("REFUSES the truncated list under the real CI facts (475-shaped: 300 > 250)", () => {
    const status = main([], TRUNCATED, actionsEnv(TOTAL, "body"));
    expect(status).toBe(3);
  });

  test("REFUSES when the shortfall is counted rather than inferred", () => {
    const status = main(
      ["--commit-total", String(TOTAL), "--commits-supplied", String(CAP)],
      TRUNCATED,
      LOCAL_ENV,
    );
    expect(status).toBe(3);
  });

  test("PASSES the same bytes once coverage is COMPLETE — the gate is not a blanket ban", () => {
    const status = main(
      ["--commit-total", String(CAP), "--commits-supplied", String(CAP)],
      TRUNCATED,
      LOCAL_ENV,
    );
    expect(status).toBe(0);
  });

  test("an ordinary small PR under CI still passes", () => {
    const small = preimage(3, 0);
    expect(main([], small, actionsEnv(3, "body"))).toBe(0);
  });

  test("REFUSES when the event payload cannot say how many commits there are", () => {
    expect(main([], TRUNCATED, actionsEnv("absent", "body"))).toBe(3);
    expect(main([], TRUNCATED, actionsEnv("unreadable", "body"))).toBe(3);
  });

  test("a FAIL keeps its own exit code and diagnosis even when coverage is short", () => {
    // Soundness asymmetry: a violation seen in a prefix really is in the PR, so
    // it is reported as a violation (1), not laundered into an unmeasured (3).
    const shortAndBroken = preimage(CAP, 7);
    expect(main([], shortAndBroken, actionsEnv(TOTAL, "body"))).toBe(1);
  });

  test("a malformed count is a usage error, not a bought exemption", () => {
    expect(main(["--commit-total", "many"], TRUNCATED, LOCAL_ENV)).toBe(2);
    expect(main(["--commit-total"], TRUNCATED, LOCAL_ENV)).toBe(2);
  });
});
