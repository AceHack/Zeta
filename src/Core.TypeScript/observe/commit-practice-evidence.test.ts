/**
 * commit-practice-evidence.test.ts — the adapter's falsifiers.
 *
 * Two of these are the load-bearing ones. **A commit with no `Agent:` trailer must produce no subject**
 * — if it ever fell back to the committer identity, this whole surface would start attributing records
 * to people who never claimed them, which is the assignment it exists to refuse. And **`undetermined`
 * must not collapse into a verdict**: a check that answers "does-not-hold" where it should answer "I
 * cannot tell" turns a silent record into evidence against someone.
 */

import { describe, expect, test } from "bun:test";

import {
  COMMIT_CHECKS,
  FIELD_SEP,
  RECORD_SEP,
  agencySignatureComplete,
  conventionalSubject,
  parseCommitLog,
  parseTrailers,
  subjectOfCommit,
  testsAccompanySource,
  toEvidence,
  workItemNamed,
  type CommitRecord,
} from "./commit-practice-evidence";

const FULL_BLOCK = [
  "Agency-Signature-Version: 1",
  "Agent: otto-shadow",
  "Agent-Runtime: Claude Code",
  "Agent-Model: claude-opus-5",
  "Credential-Identity: acehack00@gmail.com",
  "Credential-Mode: shared-human-credential",
  "Human-Review: not-implied-by-credential",
  "Human-Review-Evidence: none",
  "Action-Mode: autonomous-fail-open",
  "Task: 081M0AHS6PJ087G0R0039T9PFW",
].join("\n");

function record(over: Partial<CommitRecord> = {}): CommitRecord {
  return {
    sha: "abc123",
    subjectLine: "feat(x): a thing",
    trailers: parseTrailers(`subject\n\n${FULL_BLOCK}`),
    hasBody: true,
    paths: [],
    ...over,
  };
}

describe("trailer parsing is bottom-contiguous", () => {
  test("a Key: value line in the middle of the body is not a trailer", () => {
    const body = ["subject", "", "Task: not-a-trailer-here", "prose after it", "", "Agent: otto-shadow"].join("\n");
    const trailers = parseTrailers(body);
    expect(trailers.get("Agent")).toBe("otto-shadow");
    expect(trailers.has("Task")).toBe(false);
  });

  test("a trailing blank line does not break the block", () => {
    expect(parseTrailers(`subject\n\n${FULL_BLOCK}\n\n`).get("Agent")).toBe("otto-shadow");
  });

  test("a message that is ONLY trailers is fully read — the walk reaches line 0", () => {
    // A mutation sweep (2026-08-18) found `i >= 0` could become `i > 0` with every test still green,
    // because every fixture had a subject line above the block. This is the record that notices.
    const trailers = parseTrailers("Agent: otto-shadow");
    expect(trailers.get("Agent")).toBe("otto-shadow");
  });

  test("all ten AgencySignature fields are read from a real-shaped message", () => {
    const trailers = parseTrailers(`subject\n\n${FULL_BLOCK}`);
    expect(trailers.size).toBe(10);
  });
});

describe("a record with no Agent trailer is evidence about nobody", () => {
  test("subjectOfCommit returns undefined rather than a fallback identity", () => {
    expect(subjectOfCommit(record({ trailers: new Map() }))).toBeUndefined();
  });

  test("an empty Agent value is also nobody", () => {
    expect(subjectOfCommit(record({ trailers: new Map([["Agent", "  "]]) }))).toBeUndefined();
  });

  test("toEvidence drops unattributed commits instead of defaulting them", () => {
    const evidence = toEvidence([record(), record({ sha: "def", trailers: new Map() })], 100);
    expect(evidence.length).toBe(1);
    expect(evidence[0]?.subject).toBe("otto-shadow");
  });
});

describe("phase is a logical position, not a date", () => {
  test("the newest record gets the head depth and older ones descend", () => {
    const evidence = toEvidence([record({ sha: "new" }), record({ sha: "old" })], 500);
    expect(evidence.map((e) => e.phase)).toEqual([500, 499]);
  });

  test("the same commit gets the same phase for the same head — repeatable", () => {
    const once = toEvidence([record()], 42);
    const twice = toEvidence([record()], 42);
    expect(twice[0]?.phase).toBe(once[0]?.phase ?? -1);
  });
});

describe("checks answer `undetermined` rather than convicting on silence", () => {
  test("a bodiless commit does not fail the signature check", () => {
    expect(agencySignatureComplete.evaluate(record({ hasBody: false, trailers: new Map() }))).toBe("undetermined");
  });

  test("a missing Task trailer is unsettled, not a broken work-item claim", () => {
    expect(workItemNamed.evaluate(record({ trailers: new Map() }))).toBe("undetermined");
  });

  test("a Task trailer that names no work item is a counterexample", () => {
    expect(workItemNamed.evaluate(record({ trailers: new Map([["Task", "none"]]) }))).toBe("does-not-hold");
  });

  test("a Task trailer naming a ZetaId holds", () => {
    expect(workItemNamed.evaluate(record({ trailers: new Map([["Task", "081M0AHS6PJ087G0R0039T9PFW"]]) }))).toBe(
      "holds",
    );
  });

  test("a commit with no paths read is unsettled for the tests check", () => {
    expect(testsAccompanySource.evaluate(record({ paths: [] }))).toBe("undetermined");
  });

  test("a docs-only commit is unsettled — the practice was not exercised, so it is not conformance", () => {
    expect(testsAccompanySource.evaluate(record({ paths: ["docs/a.md", "README.md"] }))).toBe("undetermined");
  });

  test("source without a test is a counterexample; source with a test holds", () => {
    expect(testsAccompanySource.evaluate(record({ paths: ["src/a.ts"] }))).toBe("does-not-hold");
    expect(testsAccompanySource.evaluate(record({ paths: ["src/a.ts", "src/a.test.ts"] }))).toBe("holds");
  });

  test("a test-only commit is unsettled, not conformance", () => {
    expect(testsAccompanySource.evaluate(record({ paths: ["src/a.test.ts"] }))).toBe("undetermined");
  });

  test("an incomplete signature block does not hold", () => {
    const partial = new Map([
      ["Agent", "otto-shadow"],
      ["Task", "none"],
    ]);
    expect(agencySignatureComplete.evaluate(record({ trailers: partial }))).toBe("does-not-hold");
  });

  test("conventional subjects are recognised and prose subjects are not", () => {
    expect(conventionalSubject.evaluate(record({ subjectLine: "fix(ci): a thing" }))).toBe("holds");
    expect(conventionalSubject.evaluate(record({ subjectLine: "Fixed the thing" }))).toBe("does-not-hold");
    expect(conventionalSubject.evaluate(record({ subjectLine: "" }))).toBe("undetermined");
  });
});

describe("checks are pure and total", () => {
  test("every registry check returns one of the three verdicts on an empty-ish record", () => {
    const bare: CommitRecord = { sha: "z", subjectLine: "", trailers: new Map(), hasBody: false, paths: [] };
    for (const check of COMMIT_CHECKS.checks) {
      expect(["holds", "does-not-hold", "undetermined"]).toContain(check.evaluate(bare));
    }
  });

  test("evaluating twice gives the same answer (DST)", () => {
    const r = record({ paths: ["src/a.ts"] });
    for (const check of COMMIT_CHECKS.checks) {
      expect(check.evaluate(r)).toBe(check.evaluate(r));
    }
  });
});

describe("the log parser round-trips the format it declares", () => {
  test("two records with bodies and paths parse into the right shape", () => {
    const raw =
      `${RECORD_SEP}sha1${FIELD_SEP}feat(a): one\n\n${FULL_BLOCK}${FIELD_SEP}\nsrc/a.ts\nsrc/a.test.ts\n` +
      `${RECORD_SEP}sha2${FIELD_SEP}chore: two${FIELD_SEP}\n`;
    const parsed = parseCommitLog(raw);
    expect(parsed.length).toBe(2);
    expect(parsed[0]?.sha).toBe("sha1");
    expect(parsed[0]?.subjectLine).toBe("feat(a): one");
    expect(parsed[0]?.paths).toEqual(["src/a.ts", "src/a.test.ts"]);
    expect(parsed[0]?.hasBody).toBe(true);
    expect(parsed[1]?.paths).toEqual([]);
    expect(parsed[1]?.hasBody).toBe(false);
  });

  test("empty input parses to no records rather than one blank one", () => {
    expect(parseCommitLog("")).toEqual([]);
  });
});
