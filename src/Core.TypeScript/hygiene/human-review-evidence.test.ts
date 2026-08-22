// human-review-evidence.test.ts — the falsifiers for the review-verification
// gate.
//
// The tests that matter most here are the ones asserting a FAILURE, because the
// defect being fixed was a check that could not fail. A suite that only proved
// "a real review passes" would be the same vacuity one layer out: it would stay
// green if `decide` were rewritten to `return { kind: "verified" }`.
//
// So every rule in the independence filter has a test that goes RED when that
// rule is deleted, and the three-way outcome split (verified / absent /
// indeterminate) is pinned on the EXIT CODE, not just the kind string — a fix
// that collapsed `indeterminate` back into a pass would turn these red.

import { describe, expect, test } from "bun:test";

import { REQUIRED_KEYS } from "./agencysignature-block.ts";
import {
  type FetchResult,
  type ForgeArtifact,
  decide,
  exitCodeFor,
  main,
  rejectionReason,
  toArtifacts,
} from "./human-review-evidence.ts";

function artifact(over: Partial<ForgeArtifact> = {}): ForgeArtifact {
  return {
    authorLogin: "a-reviewer",
    authorType: "User",
    state: "APPROVED",
    commitId: "abc123",
    submittedAt: "2026-08-18T00:00:00Z",
    id: "#1",
    ...over,
  };
}

function block(over: Readonly<Record<string, string>> = {}): string {
  const base: Record<string, string> = {
    "Agency-Signature-Version": "1",
    Agent: "shadow",
    "Agent-Runtime": "Claude Code",
    "Agent-Model": "claude-opus-5",
    "Credential-Identity": "AceHack via gh",
    "Credential-Mode": "dedicated-agent",
    "Human-Review": "not-implied-by-credential",
    "Human-Review-Evidence": "none",
    "Action-Mode": "autonomous-fail-closed",
    Task: "none",
  };
  const merged = { ...base, ...over };
  return REQUIRED_KEYS.map((k) => `${k}: ${merged[k] ?? ""}`).join("\n");
}

describe("the free path — a non-explicit claim costs nothing", () => {
  test("not-implied-by-credential needs no lookup", () => {
    const v = decide({
      humanReview: "not-implied-by-credential",
      evidence: "none",
      prAuthorLogin: "someone",
      artifacts: null,
      fetchError: null,
      prCommitShas: [],
    });
    expect(v.kind).toBe("not-claimed");
    expect(exitCodeFor(v.kind)).toBe(0);
  });

  test("`none` likewise asserts nothing and is not checked", () => {
    const v = decide({
      humanReview: "none",
      evidence: "none",
      prAuthorLogin: "someone",
      artifacts: null,
      fetchError: null,
      prCommitShas: [],
    });
    expect(v.kind).toBe("not-claimed");
  });

  test("a null fetch on the free path does NOT become indeterminate", () => {
    // Guards the ordering in `decide`: the free path must be answered before the
    // fetch-failure branch, or every unsigned-for-review commit in the fleet
    // would start exiting 2 the first time GitHub rate-limited us.
    const v = decide({
      humanReview: "not-implied-by-credential",
      evidence: "none",
      prAuthorLogin: "",
      artifacts: null,
      fetchError: "boom",
      prCommitShas: [],
    });
    expect(v.kind).toBe("not-claimed");
  });
});

describe("THE CORE FALSIFIER — an explicit claim with no review fails", () => {
  test("explicit + pr-review + zero artifacts is VERIFIED ABSENT, exit 1", () => {
    const v = decide({
      humanReview: "explicit",
      evidence: "pr-review",
      prAuthorLogin: "the-author",
      artifacts: [],
      fetchError: null,
      prCommitShas: ["abc123"],
    });
    expect(v.kind).toBe("absent");
    expect(exitCodeFor(v.kind)).toBe(1);
    expect(v.headline).toContain("VERIFIED ABSENT");
  });

  test("a genuine independent review verifies, exit 0", () => {
    const v = decide({
      humanReview: "explicit",
      evidence: "pr-review",
      prAuthorLogin: "the-author",
      artifacts: [artifact({ authorLogin: "a-human" })],
      fetchError: null,
      prCommitShas: ["abc123"],
    });
    expect(v.kind).toBe("verified");
    expect(exitCodeFor(v.kind)).toBe(0);
    expect(v.accepted).toHaveLength(1);
  });
});

describe("the independence filter — each rule must be load-bearing", () => {
  test("SELF-REVIEW is rejected (the audited defect, one call further out)", () => {
    const why = rejectionReason(artifact({ authorLogin: "the-author" }), "the-author", []);
    expect(why).not.toBeNull();
    expect(why).toContain("self-review");
  });

  test("self-review is case- and whitespace-insensitive", () => {
    expect(rejectionReason(artifact({ authorLogin: " The-Author " }), "the-author", [])).not.toBeNull();
  });

  test("a self-review-only PR reaches ABSENT, not verified", () => {
    // The end-to-end statement of the finding: the author cannot certify itself.
    const v = decide({
      humanReview: "explicit",
      evidence: "pr-review",
      prAuthorLogin: "the-author",
      artifacts: [artifact({ authorLogin: "the-author" })],
      fetchError: null,
      prCommitShas: ["abc123"],
    });
    expect(v.kind).toBe("absent");
    expect(v.rejected).toHaveLength(1);
  });

  test("a bot review is not human-generated evidence (by type)", () => {
    expect(rejectionReason(artifact({ authorType: "Bot" }), "author", [])).toContain("bot");
  });

  test("a bot review is not human-generated evidence (by [bot] suffix)", () => {
    expect(rejectionReason(artifact({ authorLogin: "github-actions[bot]", authorType: "" }), "author", [])).toContain(
      "bot",
    );
  });

  test("a PENDING review is not evidence — nobody can see it", () => {
    expect(rejectionReason(artifact({ state: "PENDING" }), "author", [])).toContain("PENDING");
  });

  test("a DISMISSED review is not evidence — it was withdrawn", () => {
    expect(rejectionReason(artifact({ state: "DISMISSED" }), "author", [])).toContain("DISMISSED");
  });

  test("CHANGES_REQUESTED and COMMENTED still count — the claim is `reviewed`, not `approved`", () => {
    for (const state of ["CHANGES_REQUESTED", "COMMENTED"]) {
      expect(rejectionReason(artifact({ state }), "author", ["abc123"])).toBeNull();
    }
  });

  test("a review against a commit no longer in the PR is stale and rejected", () => {
    const why = rejectionReason(artifact({ commitId: "deadbeef" }), "author", ["abc123"]);
    expect(why).not.toBeNull();
    expect(why).toContain("no longer in the proposal");
  });

  test("staleness is SKIPPED when the commit list could not be supplied", () => {
    // Not silently: `decide` adds a note to the report. But it must not invent a
    // rejection from data it does not have.
    expect(rejectionReason(artifact({ commitId: "deadbeef" }), "author", [])).toBeNull();
  });

  test("an artifact with no author is rejected", () => {
    expect(rejectionReason(artifact({ authorLogin: "" }), "author", [])).not.toBeNull();
  });

  test("an empty PR-author does not accidentally match an empty reviewer login", () => {
    // Both empty must not read as "same person"; the no-author rule catches it
    // first, and this pins that ordering.
    expect(rejectionReason(artifact({ authorLogin: "" }), "", [])).toContain("no author");
  });
});

describe("THE DISTINCTION THAT IS THE FINDING — absent vs could-not-verify", () => {
  test("a fetch error is INDETERMINATE, never a pass", () => {
    const v = decide({
      humanReview: "explicit",
      evidence: "pr-review",
      prAuthorLogin: "the-author",
      artifacts: null,
      fetchError: "rate limited",
      prCommitShas: [],
    });
    expect(v.kind).toBe("indeterminate");
    expect(exitCodeFor(v.kind)).toBe(2);
  });

  test("indeterminate is a DIFFERENT code from absent — they must not collapse", () => {
    expect(exitCodeFor("indeterminate")).not.toBe(exitCodeFor("absent"));
    expect(exitCodeFor("indeterminate")).not.toBe(exitCodeFor("verified"));
  });

  test("a failed lookup does not convict the claim either", () => {
    const v = decide({
      humanReview: "explicit",
      evidence: "pr-review",
      prAuthorLogin: "the-author",
      artifacts: null,
      fetchError: "network",
      prCommitShas: [],
    });
    expect(v.kind).not.toBe("absent");
    expect(v.headline).toContain("COULD NOT VERIFY");
  });

  test("null artifacts with no stated error is still indeterminate, not verified", () => {
    const v = decide({
      humanReview: "explicit",
      evidence: "pr-review",
      prAuthorLogin: "a",
      artifacts: null,
      fetchError: null,
      prCommitShas: [],
    });
    expect(v.kind).toBe("indeterminate");
  });
});

describe("the unverifiable categories are LABELLED, not silently passed", () => {
  for (const ev of ["chat", "signed-policy"]) {
    test(`${ev} reports UNVERIFIABLE and says it did not check`, () => {
      const v = decide({
        humanReview: "explicit",
        evidence: ev,
        prAuthorLogin: "the-author",
        artifacts: null,
        fetchError: null,
        prCommitShas: [],
      });
      expect(v.kind).toBe("unverifiable");
      expect(exitCodeFor(v.kind)).toBe(0);
      // The whole point: it must not be able to read as a verification.
      expect(v.headline).toContain("NOT VERIFIED");
      expect(v.detail.join(" ")).toContain("did NOT check");
    });
  }

  test("unverifiable is a distinct kind from verified", () => {
    // A refactor that mapped `chat` onto `verified` because both exit 0 would
    // turn this red. Exit-code equality is not outcome equality.
    const chat = decide({
      humanReview: "explicit",
      evidence: "chat",
      prAuthorLogin: "a",
      artifacts: null,
      fetchError: null,
      prCommitShas: [],
    });
    const real = decide({
      humanReview: "explicit",
      evidence: "pr-review",
      prAuthorLogin: "a",
      artifacts: [artifact({ authorLogin: "b" })],
      fetchError: null,
      prCommitShas: ["abc123"],
    });
    expect(chat.kind).not.toBe(real.kind);
  });
});

describe("an unknown evidence value never reads as a pass", () => {
  test("a value outside both sets is indeterminate", () => {
    const v = decide({
      humanReview: "explicit",
      evidence: "pr", // a real malformed value measured on main (18 occurrences)
      prAuthorLogin: "a",
      artifacts: [],
      fetchError: null,
      prCommitShas: [],
    });
    expect(v.kind).toBe("indeterminate");
    expect(exitCodeFor(v.kind)).toBe(2);
  });
});

describe("payload flattening", () => {
  test("absent fields degrade to empty strings, never undefined", () => {
    const [a] = toArtifacts([{}]);
    expect(a).toEqual({
      authorLogin: "",
      authorType: "",
      state: "",
      commitId: "",
      submittedAt: "",
      id: "",
    });
  });

  test("a comment payload (created_at, no state) flattens", () => {
    const [a] = toArtifacts([{ id: 7, user: { login: "h", type: "User" }, created_at: "2026-08-18T00:00:00Z" }]);
    expect(a?.authorLogin).toBe("h");
    expect(a?.state).toBe("");
    expect(a?.id).toBe("#7");
  });
});

describe("the CLI boundary", () => {
  const noFetch = (): FetchResult => ({ artifacts: [], error: null });
  const noShas = (): readonly string[] => [];

  test("missing --repo is a usage error (exit 2), not a pass", () => {
    expect(main(["--pr-number", "1"], block(), noFetch, noShas)).toBe(2);
  });

  test("a non-numeric --pr-number is a usage error", () => {
    expect(main(["--repo", "o/n", "--pr-number", "abc"], block(), noFetch, noShas)).toBe(2);
  });

  test("text with no block exits 0 and says the presence gate owns it", () => {
    expect(main(["--repo", "o/n", "--pr-number", "1"], "no block here", noFetch, noShas)).toBe(0);
  });

  test("a default block (not-implied-by-credential) passes without any fetch", () => {
    let called = false;
    const spy = (): FetchResult => {
      called = true;
      return { artifacts: [], error: null };
    };
    expect(main(["--repo", "o/n", "--pr-number", "1"], block(), spy, noShas)).toBe(0);
    expect(called).toBe(false);
  });

  test("an explicit+pr-review block with no reviews exits 1 end-to-end", () => {
    const text = block({ "Human-Review": "explicit", "Human-Review-Evidence": "pr-review" });
    expect(main(["--repo", "o/n", "--pr-number", "1"], text, noFetch, noShas)).toBe(1);
  });

  test("an explicit+pr-review block with an independent review exits 0 end-to-end", () => {
    const text = block({ "Human-Review": "explicit", "Human-Review-Evidence": "pr-review" });
    const fetch = (): FetchResult => ({
      artifacts: [artifact({ authorLogin: "a-human" })],
      error: null,
    });
    expect(main(["--repo", "o/n", "--pr-number", "1", "--pr-author", "the-author"], text, fetch, noShas)).toBe(0);
  });

  test("end-to-end self-review exits 1 — the finding, through the real CLI path", () => {
    const text = block({ "Human-Review": "explicit", "Human-Review-Evidence": "pr-review" });
    const fetch = (): FetchResult => ({
      artifacts: [artifact({ authorLogin: "the-author" })],
      error: null,
    });
    expect(main(["--repo", "o/n", "--pr-number", "1", "--pr-author", "the-author"], text, fetch, noShas)).toBe(1);
  });

  test("a forge failure exits 2 end-to-end, not 0 and not 1", () => {
    const text = block({ "Human-Review": "explicit", "Human-Review-Evidence": "pr-review" });
    const fetch = (): FetchResult => ({ artifacts: null, error: "rate limited" });
    expect(main(["--repo", "o/n", "--pr-number", "1"], text, fetch, noShas)).toBe(2);
  });

  test("an explicit+chat block exits 0 without a fetch, and is reported", () => {
    let called = false;
    const spy = (): FetchResult => {
      called = true;
      return { artifacts: [], error: null };
    };
    const text = block({ "Human-Review": "explicit", "Human-Review-Evidence": "chat" });
    expect(main(["--repo", "o/n", "--pr-number", "1"], text, spy, noShas)).toBe(0);
    expect(called).toBe(false);
  });

  test("the LAST block wins, so a squash preimage is judged on its authoritative block", () => {
    // Inherits `validateText`'s multi-block resolution rather than re-deciding
    // it here — if this instrument picked a different block than the validator,
    // the two would disagree about which claim is under test.
    const quoted = block({ "Human-Review": "explicit", "Human-Review-Evidence": "chat" });
    const real = block({ "Human-Review": "explicit", "Human-Review-Evidence": "pr-review" });
    const fetch = (): FetchResult => ({ artifacts: [], error: null });
    expect(main(["--repo", "o/n", "--pr-number", "1"], `${quoted}\n\n${real}`, fetch, noShas)).toBe(1);
  });
});
