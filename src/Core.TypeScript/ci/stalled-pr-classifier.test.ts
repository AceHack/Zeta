// Falsifiers for the stalled-PR classifier.
//
// Each test pins a behaviour whose removal turns the classifier into the thing
// it exists to prevent: a healer that acts on a red the PR did not cause. The
// cases are drawn from the nine PRs measured on 2026-08-26, so the fixtures are
// observations, not inventions.

import { test, expect, describe } from "bun:test";
import {
  classify,
  rootFailures,
  isAttributable,
  missingRequiredChecks,
  isRegenerable,
  AGGREGATOR_CHECK,
  type PrFacts,
  type CheckFact,
} from "./stalled-pr-classifier.ts";

const REQUIRED = [AGGREGATOR_CHECK, "cross-verify (task-zetaid-resolves)"];

function facts(over: Partial<PrFacts> = {}): PrFacts {
  return {
    number: 1,
    headSha: "a".repeat(40),
    autoMergeArmed: true,
    localMerge: "clean",
    conflictPaths: [],
    checks: REQUIRED.map((name): CheckFact => ({ name, conclusion: "success" })),
    requiredCheckNames: REQUIRED,
    diffPaths: ["src/Core.TypeScript/thing.ts"],
    branchHeldElsewhere: false,
    behindBy: 0,
    ...over,
  };
}

describe("the aggregator is never a cause", () => {
  test(`${AGGREGATOR_CHECK} is excluded from root failures`, () => {
    const checks: CheckFact[] = [
      { name: AGGREGATOR_CHECK, conclusion: "failure" },
      { name: "drift (loud)", conclusion: "failure" },
    ];
    expect(rootFailures(checks)).toEqual(["drift (loud)"]);
  });

  test("a PR whose ONLY red is the aggregator has no root failure", () => {
    // Measured shape: `gate (required)` is red downstream of a need. Counting it
    // as a cause would invent a failure the PR does not have.
    expect(rootFailures([{ name: AGGREGATOR_CHECK, conclusion: "failure" }])).toEqual([]);
  });
});

describe("attribution — the predicate the retraction actuator lacks", () => {
  test("a failure whose subject is outside the diff is NOT attributable", () => {
    // The 2026-08-26 gnupg outage in miniature: a real red, a real unique
    // candidate, and a completely unrelated cause.
    const c: CheckFact = { name: "build-and-test", conclusion: "failure", subjectPaths: ["tools/setup/linux.sh"] };
    expect(isAttributable(c, ["docs/research/thing.md"])).toBe(false);
  });

  test("a failure with NO derivable subject is NOT attributable", () => {
    // The asymmetry that makes this safe: an underivable subject WITHHOLDS the
    // remedy. Flip this to `true` and an infrastructure outage licenses action.
    const c: CheckFact = { name: "build-and-test", conclusion: "failure" };
    expect(isAttributable(c, ["anything.ts"])).toBe(false);
  });

  test("a failure whose subject intersects the diff IS attributable", () => {
    const c: CheckFact = { name: "test (TS hermetic)", conclusion: "failure", subjectPaths: ["full-ai-cluster/tests/x.test.ts"] };
    expect(isAttributable(c, ["full-ai-cluster/tests/x.test.ts"])).toBe(true);
  });

  test("unattributable failures never yield an author report", () => {
    // PR #15551 shape: `drift (loud)` red while reporting repo-wide drift.
    const v = classify(
      facts({
        behindBy: 138,
        checks: [
          ...REQUIRED.map((name): CheckFact => ({ name, conclusion: "success" })),
          { name: "drift (loud)", conclusion: "failure", subjectPaths: ["data/platform-drift.json"] },
        ],
      }),
    );
    expect(v.attributable).toEqual([]);
    expect(v.classification).toBe("STALE_FIX_LANDED");
    expect(v.suggestedRemedy).toBe("merge-main-and-push");
  });
});

describe("a check that never ran is not a check that passed", () => {
  test("an absent required check is reported as missing", () => {
    const present: CheckFact[] = [{ name: AGGREGATOR_CHECK, conclusion: "success" }];
    expect(missingRequiredChecks(present, REQUIRED)).toEqual(["cross-verify (task-zetaid-resolves)"]);
  });

  test("absent required checks ALONGSIDE failures classify UNKNOWN, never actionable", () => {
    const v = classify(
      facts({
        checks: [{ name: "lint (TS)", conclusion: "failure", subjectPaths: ["x.ts"] }],
        behindBy: 5,
      }),
    );
    expect(v.classification).toBe("UNKNOWN");
    expect(v.suggestedRemedy).toBe("none");
  });

  test("no failures + missing required checks is UNDISPATCHED", () => {
    // PR #15588: 7 checks where a healthy PR carries ~95.
    const v = classify(facts({ number: 15588, checks: [], behindBy: 34 }));
    expect(v.classification).toBe("UNDISPATCHED");
    expect(v.suggestedRemedy).toBe("merge-main-and-push");
  });
});

describe("mergeability comes from a local probe, and unknown is not clean", () => {
  test("an unanswered merge probe refuses, it does not assume clean", () => {
    // GitHub returned `mergeable_state: unknown` for 9 of 9 PRs across two polls
    // on 2026-08-26. Assuming clean there would have missed a real conflict.
    const v = classify(facts({ localMerge: "unknown" }));
    expect(v.classification).toBe("UNKNOWN");
    expect(v.suggestedRemedy).toBe("none");
  });
});

describe("conflict resolution is confined to generated files", () => {
  test("flake.lock is regenerable", () => {
    expect(isRegenerable("flake.lock")).toBe(true);
    expect(isRegenerable("full-ai-cluster/flake.lock")).toBe(true);
  });

  test("hand-authored content is NOT regenerable", () => {
    expect(isRegenerable("docs/research/thing.md")).toBe(false);
    expect(isRegenerable("src/Core/ZSet.fs")).toBe(false);
  });

  test("a generated-only conflict is resolvable", () => {
    // PR #15585: add/add on `flake.lock`, zero failing checks.
    const v = classify(
      facts({ number: 15585, localMerge: "conflict", conflictPaths: ["flake.lock"], behindBy: 117 }),
    );
    expect(v.classification).toBe("CONFLICTED_CLEAN_CHECKS");
    expect(v.suggestedRemedy).toBe("resolve-generated-conflict");
  });

  test("a conflict touching prose goes to the author, never auto-resolved", () => {
    const v = classify(
      facts({ localMerge: "conflict", conflictPaths: ["flake.lock", "docs/research/x.md"], behindBy: 3 }),
    );
    expect(v.suggestedRemedy).toBe("report-to-author");
  });
});

describe("ownership outranks every other verdict", () => {
  test("a branch held elsewhere is refused even when it looks mechanical", () => {
    // PR #15636: its branch was checked out in another agent's worktree.
    const v = classify(facts({ number: 15636, branchHeldElsewhere: true, checks: [], behindBy: 61 }));
    expect(v.classification).toBe("REFUSED_OWNERSHIP");
    expect(v.suggestedRemedy).toBe("none");
  });
});

describe("the PR's own failures are reported, never fixed", () => {
  test("an attributable failure yields report-to-author and nothing else", () => {
    // PR #15583: a literal NUL byte in its own added file.
    const v = classify(
      facts({
        number: 15583,
        behindBy: 111,
        diffPaths: ["src/Core.TypeScript/dep-update/toy-classify.ts"],
        checks: [
          ...REQUIRED.map((name): CheckFact => ({ name, conclusion: "success" })),
          {
            name: "cross-verify (no-raw-nul-in-source)",
            conclusion: "failure",
            subjectPaths: ["src/Core.TypeScript/dep-update/toy-classify.ts"],
          },
        ],
      }),
    );
    expect(v.classification).toBe("OWN_FAILURES");
    expect(v.suggestedRemedy).toBe("report-to-author");
  });
});

describe("determinism (DST §7)", () => {
  test("classification is a pure function of the facts", () => {
    const f = facts({ behindBy: 7, localMerge: "conflict", conflictPaths: ["bun.lock"] });
    expect(classify(f)).toEqual(classify(f));
  });

  test("no verdict for any input suggests an action on an unclassifiable PR", () => {
    const unknowns: PrFacts[] = [
      facts({ localMerge: "unknown" }),
      facts({ branchHeldElsewhere: true }),
      facts({ checks: [{ name: "x", conclusion: "failure" }], behindBy: 0 }),
    ];
    for (const f of unknowns) {
      const v = classify(f);
      if (v.classification === "UNKNOWN" || v.classification === "REFUSED_OWNERSHIP") {
        expect(v.suggestedRemedy).toBe("none");
      }
    }
  });
});
