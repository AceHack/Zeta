// report-branch-pigeonholes.test.ts — falsifiers for the branch classifier.
//
// The thing worth testing here is NOT that the labels come out. It is that the classifier
// refuses to conclude "unlanded" from weak evidence, because that conclusion is what licenses
// deleting a branch. Every test below is written so that it FAILS if the classifier is made
// more confident than its evidence supports.

import { describe, expect, it } from "bun:test";
import { classify, laneOf, type BranchEvidence, type PullRecord } from "./report-branch-pigeonholes";

const TIP = "a".repeat(40);
const OTHER = "b".repeat(40);

function pr(over: Partial<PullRecord> = {}): PullRecord {
  return { number: 1, state: "closed", merged: false, headSha: TIP, title: "t", ...over };
}

function ev(over: Partial<BranchEvidence> = {}): BranchEvidence {
  return {
    name: "work/example",
    tip: TIP,
    isAncestorOfBase: false,
    touchedPaths: ["src/a.ts"],
    contentInBase: false,
    patchEquivalent: { landed: 0, total: 1 },
    pulls: [],
    deletionProtected: false,
    ...over,
  };
}

describe("lane is read off the author's own namespace", () => {
  it("treats heartbeat/* as protected automation when the ruleset protects it", () => {
    expect(laneOf("heartbeat/soraya", true)).toBe("protected-automation");
  });

  it("does NOT claim protection the ruleset does not grant", () => {
    // The lane is a self-claim; the protection is a live fact. They must not be conflated,
    // or a ruleset change would leave this file asserting a protection that no longer exists.
    expect(laneOf("heartbeat/soraya", false)).toBe("legacy-automation");
  });

  it("classifies an ordinary ref as work", () => {
    expect(laneOf("fix/thing", false)).toBe("work");
  });
});

describe("the squash trap — the reason this file exists", () => {
  it("a squash-merged branch whose PR head is the tip is LANDED, not unlanded", () => {
    // This is the exact case the three-dot merge-base diff gets wrong 100% of the time.
    // Ancestry is false and content differs, and it is STILL landed, on PR evidence alone.
    const v = classify(
      ev({
        isAncestorOfBase: false,
        contentInBase: false,
        pulls: [pr({ number: 15696, merged: true, headSha: TIP })],
      }),
    );
    expect(v.disposition).toBe("landed-squash");
    expect(v.action).toContain("safe to delete");
  });

  it("a NON-empty content diff never by itself downgrades a branch to unlanded", () => {
    // Non-empty proves nothing: main may simply have moved past those files. If this ever
    // starts returning an unlanded-shaped disposition, the asymmetry has been broken.
    const v = classify(ev({ contentInBase: false, pulls: [pr({ merged: true, headSha: TIP })] }));
    expect(v.disposition).toBe("landed-squash");
  });
});

describe("landed dispositions require positive evidence", () => {
  it("ancestry proves a true merge", () => {
    expect(classify(ev({ isAncestorOfBase: true })).disposition).toBe("landed-merge");
  });

  it("empty content diff on the branch's own touched paths proves landing", () => {
    const v = classify(ev({ contentInBase: true }));
    expect(v.disposition).toBe("landed-equivalent");
    expect(v.action).toContain("safe to delete");
  });

  it("a merged PR at a DIFFERENT sha is partially-landed, never landed", () => {
    // The dangerous rounding-up: "it has a merged PR" is not "its tip landed".
    const v = classify(ev({ pulls: [pr({ number: 5470, merged: true, headSha: OTHER })] }));
    expect(v.disposition).toBe("partially-landed");
    expect(v.action).toContain("FORWARD ACTION");
  });
});

describe("forward actions — a branch with unlanded content is never a silent delete", () => {
  it("no PR ever + content not in base ⇒ forward action, not deletion", () => {
    const v = classify(ev({ pulls: [] }));
    expect(v.disposition).toBe("unlanded-never-proposed");
    expect(v.action).toContain("FORWARD ACTION");
    expect(v.action).toContain("NEVER a silent delete");
  });

  it("closed-unmerged carries a forward action to record the reason first", () => {
    const v = classify(ev({ pulls: [pr({ number: 9871 })] }));
    expect(v.disposition).toBe("retired-by-decision");
    expect(v.action).toContain("FORWARD ACTION");
  });

  it("an open PR is in-flight and gets NO action at all", () => {
    const v = classify(ev({ pulls: [pr({ number: 15583, state: "open" })] }));
    expect(v.disposition).toBe("in-flight");
    expect(v.action).toBeNull();
  });
});

describe("patch equivalence — the cherry-picked-under-another-ref case", () => {
  it("FULL equivalence is landing, even with no PR and an inconclusive content test", () => {
    // Measured live: cursor/rework-pr-13767-9c53 — never had a PR, ancestry false, its files
    // still differ from main because main moved past them, and yet `git cherry` says its one
    // commit is already there. Without this rule it lands in the forward-action bin and a
    // human is asked to re-propose work that is already merged.
    const v = classify(
      ev({ pulls: [], contentInBase: false, patchEquivalent: { landed: 1, total: 1 } }),
    );
    expect(v.disposition).toBe("landed-patch-equivalent");
    expect(v.action).toContain("name the successor ref");
  });

  it("PARTIAL equivalence is NOT landing — the remainder still needs a decision", () => {
    // The rounding-up this guards: 1-of-3 commits present is not "landed". If this ever
    // returns a landed disposition, two commits get silently dropped.
    const v = classify(
      ev({ pulls: [], contentInBase: false, patchEquivalent: { landed: 1, total: 3 } }),
    );
    expect(v.disposition).toBe("unlanded-never-proposed");
    expect(v.because).toContain("1 of 3");
    expect(v.action).toContain("FORWARD ACTION");
  });

  it("zero examined commits never counts as full equivalence", () => {
    // `landed === total` is trivially true at 0/0; a vacuous pass here would mark an
    // unexaminable branch as landed.
    const v = classify(
      ev({ pulls: [], contentInBase: false, patchEquivalent: { landed: 0, total: 0 } }),
    );
    expect(v.disposition).not.toBe("landed-patch-equivalent");
  });

  it("PR evidence still outranks patch equivalence", () => {
    const v = classify(
      ev({ pulls: [pr({ state: "open", number: 9 })], patchEquivalent: { landed: 1, total: 1 } }),
    );
    expect(v.disposition).toBe("in-flight");
  });
});

describe("UNKNOWN is first-class and names its missing evidence", () => {
  it("unrelated history routes to unknown rather than being forced into a landed bin", () => {
    const v = classify(
      ev({ name: "liveness/observations", contentInBase: null, patchEquivalent: null, pulls: [] }),
    );
    expect(v.disposition).toBe("unknown");
    expect(v.missingEvidence).not.toBeNull();
    expect(v.missingEvidence).toContain("undefined");
  });

  it("every unknown verdict states what would resolve it", () => {
    // A bin that cannot say what it is missing is a shrug wearing a label.
    const v = classify(ev({ contentInBase: null, patchEquivalent: null }));
    expect(v.disposition).toBe("unknown");
    expect((v.missingEvidence ?? "").length).toBeGreaterThan(20);
  });
});

describe("deletion-protected refs are never handed a delete action", () => {
  it("suppresses the delete recommendation even when the branch is fully landed", () => {
    // The strongest possible landed evidence must STILL not produce a delete action for a ref
    // the ruleset forbids deleting. Mutating this to emit an action would recommend an
    // operation the API refuses, which is a check that cannot pass.
    const v = classify(ev({ name: "heartbeat/otto", isAncestorOfBase: true, deletionProtected: true }));
    expect(v.disposition).toBe("landed-merge");
    expect(v.action).toBeNull();
  });

  it("suppresses forward-action deletes on protected automation lanes too", () => {
    const v = classify(ev({ name: "heartbeat/x-buffer", deletionProtected: true, pulls: [] }));
    expect(v.disposition).toBe("unlanded-never-proposed");
    expect(v.action).toBeNull();
  });
});
