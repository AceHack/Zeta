/**
 * self-claim-standing.test.ts — the consumer's falsifiers.
 *
 * The point of a consumer is that it *reads* the signal and its output *changes*. So the tests here pin
 * exactly that (a wider menu appears when the record recurs), plus the two things a well-meaning
 * rendering layer is most likely to break: printing a verdict the fold refused to reach, and silently
 * swallowing a refused declaration so a subject believes a claim is being checked when it is not.
 *
 * The git-reading functions are not exercised here — they are the process boundary, and everything below
 * them is pure. `environment-dependent-test-files.ts` exists because tests that shell out are the ones
 * that rot; this file keeps the fold's tests hermetic and leaves the boundary to the CLI's own run.
 */

import { describe, expect, test } from "bun:test";

import { COMMIT_CHECKS, type CommitRecord } from "./commit-practice-evidence";
import { observePractice, type PracticeBinding, type PracticeEvidence } from "./practice-claims";
import {
  loadBindings,
  parseArgs,
  renderReport,
  renderRun,
  selectSubjects,
  type BindingsFile,
} from "./self-claim-standing";

const SUBJECT = "otto-shadow";

function commit(sha: string, subjectLine: string, paths: readonly string[]): CommitRecord {
  return { sha, subjectLine, trailers: new Map([["Agent", SUBJECT]]), hasBody: true, paths };
}

function evidence(phase: number, sha: string, paths: readonly string[]): PracticeEvidence<CommitRecord> {
  return { subject: SUBJECT, evidenceId: sha, phase, record: commit(sha, "feat(x): a thing", paths) };
}

const TESTS_CLAIM: PracticeBinding = {
  subject: SUBJECT,
  practiceId: "otto-shadow/tests-with-source",
  checkId: "tests-accompany-source",
  text: "When I change source in a commit, I change a test in the same commit.",
  boundAt: 100,
};

describe("a refused declaration is surfaced, never silently dropped", () => {
  test("a binding to a check this build cannot evaluate is reported with its reason", () => {
    const file: BindingsFile = {
      bindings: [{ ...TESTS_CLAIM, practiceId: "otto-shadow/vibes", checkId: "vibes-are-good" }],
    };
    const { ledger, refusals } = loadBindings(file);
    expect(ledger.bindings).toEqual([]);
    expect(refusals.length).toBe(1);
    expect(refusals[0]?.refusal.kind).toBe("unknown-check");
  });

  test("a supersession naming a replacement that was never declared is refused", () => {
    const file: BindingsFile = {
      bindings: [TESTS_CLAIM],
      supersessions: [
        { subject: SUBJECT, supersededId: TESTS_CLAIM.practiceId, replacementId: "otto-shadow/ghost", at: 120 },
      ],
    };
    const { ledger, refusals } = loadBindings(file);
    expect(ledger.supersessions).toEqual([]);
    expect(refusals[0]?.refusal.kind).toBe("unknown-practice");
  });

  test("a valid file folds every list through the guarded writes", () => {
    const replacement: PracticeBinding = { ...TESTS_CLAIM, practiceId: "otto-shadow/tests-v2", boundAt: 120 };
    const file: BindingsFile = {
      bindings: [TESTS_CLAIM, replacement],
      supersessions: [
        { subject: SUBJECT, supersededId: TESTS_CLAIM.practiceId, replacementId: replacement.practiceId, at: 120 },
      ],
      exceptions: [
        { subject: SUBJECT, practiceId: TESTS_CLAIM.practiceId, evidenceId: "sha1", acknowledgedAt: 121 },
      ],
    };
    const { ledger, refusals } = loadBindings(file);
    expect(refusals).toEqual([]);
    expect(ledger.bindings.length).toBe(2);
    expect(ledger.supersessions.length).toBe(1);
    expect(ledger.exceptions.length).toBe(1);
  });

  test("an absent optional list is not an error", () => {
    expect(loadBindings({ bindings: [TESTS_CLAIM] }).refusals).toEqual([]);
  });
});

describe("the rendering states the fact and no verdict", () => {
  const file: BindingsFile = { bindings: [TESTS_CLAIM] };

  test("a single counterexample prints only charitable readings and no moral word", () => {
    const { ledger } = loadBindings(file);
    const rendered = renderReport(
      observePractice(ledger, COMMIT_CHECKS, SUBJECT, [evidence(101, "sha1", ["src/a.ts"])]),
    );
    expect(rendered).toContain("does not match");
    expect(rendered).toContain("accidental");
    for (const forbidden of ["malicious", "deceptive", "dishonest", "bad faith", "violation", "fail"]) {
      expect(rendered.toLowerCase()).not.toContain(forbidden);
    }
  });

  test("the subject's own sentence is printed verbatim, never paraphrased", () => {
    const { ledger } = loadBindings(file);
    const rendered = renderReport(
      observePractice(ledger, COMMIT_CHECKS, SUBJECT, [evidence(101, "sha1", ["src/a.ts"])]),
    );
    expect(rendered).toContain(TESTS_CLAIM.text);
  });

  test("the menu printed for a pattern is strictly wider than for one record", () => {
    const { ledger } = loadBindings(file);
    const one = renderReport(
      observePractice(ledger, COMMIT_CHECKS, SUBJECT, [evidence(101, "sha1", ["src/a.ts"])]),
    );
    const many = renderReport(
      observePractice(ledger, COMMIT_CHECKS, SUBJECT, [
        evidence(101, "sha1", ["src/a.ts"]),
        evidence(102, "sha2", ["src/b.ts"]),
      ]),
    );
    expect(one).not.toContain("restate");
    expect(many).toContain("restate");
    expect(many).toContain("release");
  });

  test("a clean record says so without congratulating anyone", () => {
    const { ledger } = loadBindings(file);
    const rendered = renderReport(
      observePractice(ledger, COMMIT_CHECKS, SUBJECT, [
        evidence(101, "sha1", ["src/a.ts", "src/a.test.ts"]),
      ]),
    );
    expect(rendered).toContain("does not contradict anything you claimed");
  });

  test("records that predate the claim are shown as not examined", () => {
    const { ledger } = loadBindings(file);
    const rendered = renderReport(
      observePractice(ledger, COMMIT_CHECKS, SUBJECT, [evidence(99, "old", ["src/a.ts"])]),
    );
    expect(rendered).toContain("records that predate the claim, not examined: 1");
  });
});

describe("argument parsing refuses before it reads", () => {
  test("an unrecognised flag is refused", () => {
    expect(() => parseArgs(["--gate"], "/repo")).toThrow("unrecognised argument");
  });

  test("a non-positive max-count is refused", () => {
    expect(() => parseArgs(["--max-count", "0"], "/repo")).toThrow("--max-count");
  });

  test("defaults land on the repo-relative bindings path", () => {
    expect(parseArgs([], "/repo").bindingsPath).toBe("/repo/db/self-claims/practice-bindings.json");
  });
});

describe("who gets reported on", () => {
  test("only subjects who bound something — an unclaiming subject is absent, not a zero row", () => {
    const { ledger } = loadBindings({ bindings: [TESTS_CLAIM] });
    expect(selectSubjects(ledger, undefined)).toEqual([SUBJECT]);
  });

  test("an empty ledger yields nobody", () => {
    expect(selectSubjects(loadBindings({ bindings: [] }).ledger, undefined)).toEqual([]);
  });

  test("subjects are ordinal-sorted, so the report order is deterministic (DST)", () => {
    const other: PracticeBinding = { ...TESTS_CLAIM, subject: "alexa", practiceId: "alexa/tests" };
    const { ledger } = loadBindings({ bindings: [TESTS_CLAIM, other] });
    expect(selectSubjects(ledger, undefined)).toEqual(["alexa", SUBJECT]);
  });

  test("an explicit subject is honoured even with no bindings — the answer is still a real answer", () => {
    expect(selectSubjects(loadBindings({ bindings: [] }).ledger, "nobody")).toEqual(["nobody"]);
  });
});

describe("every flag is parsed as itself", () => {
  test("--repo, --subject, --bindings and --json each take effect", () => {
    const options = parseArgs(
      ["--repo", "/r", "--subject", "s", "--bindings", "/b.json", "--json", "--max-count", "7"],
      "/cwd",
    );
    expect(options.repo).toBe("/r");
    expect(options.subject).toBe("s");
    expect(options.bindingsPath).toBe("/b.json");
    expect(options.json).toBe(true);
    expect(options.maxCount).toBe(7);
  });

  test("a flag with no value is refused rather than silently consuming the next flag", () => {
    expect(() => parseArgs(["--subject"], "/repo")).toThrow("unrecognised argument");
  });

  test("--repo without --bindings resolves the default path under the repo, not the cwd", () => {
    expect(parseArgs(["--repo", "/r"], "/cwd").bindingsPath).toBe("/r/db/self-claims/practice-bindings.json");
  });

  test("defaults: no subject filter, human output, a bounded window", () => {
    const options = parseArgs([], "/repo");
    expect(options.subject).toBeUndefined();
    expect(options.json).toBe(false);
    expect(options.maxCount).toBeGreaterThan(0);
  });
});

describe("a claim this build cannot evaluate says so in the rendering", () => {
  test("a standing whose check is absent from the registry is marked, not scored", () => {
    const rendered = renderReport({
      subject: SUBJECT,
      observation: { kind: "no-counterexample" },
      held: [],
      standings: [
        {
          binding: { ...TESTS_CLAIM, checkId: "retired-check" },
          conforming: 0,
          counterexamples: 0,
          undetermined: 3,
          precedingBinding: 0,
        },
      ],
      retiredBindings: 0,
      evidenceVolume: 3,
    });
    expect(rendered).toContain("(not evaluable here)");
  });

  test("a standing whose check IS present is not marked", () => {
    const { ledger } = loadBindings({ bindings: [TESTS_CLAIM] });
    const rendered = renderReport(observePractice(ledger, COMMIT_CHECKS, SUBJECT, []));
    expect(rendered).not.toContain("(not evaluable here)");
  });
});

describe("the whole run renders as a pure function of what was read", () => {
  test("a file with no bindings says nothing is checked, rather than printing an empty report", () => {
    expect(renderRun(loadBindings({ bindings: [] }), [], undefined, false)).toContain(
      "No subject has bound a practice",
    );
  });

  test("refusals are printed even when nothing else is", () => {
    const loaded = loadBindings({ bindings: [{ ...TESTS_CLAIM, checkId: "vibes-are-good" }] });
    const out = renderRun(loaded, [], undefined, false);
    expect(out).toContain("refused");
    expect(out).toContain("unknown-check");
    expect(out).toContain("No subject has bound a practice");
  });

  test("one bound subject with a failing record renders their report", () => {
    const loaded = loadBindings({ bindings: [TESTS_CLAIM] });
    const out = renderRun(loaded, [evidence(101, "sha1", ["src/a.ts"])], undefined, false);
    expect(out).toContain(`subject: ${SUBJECT}`);
    expect(out).toContain("does not match");
  });

  test("--json emits parseable JSON carrying the same observation", () => {
    const loaded = loadBindings({ bindings: [TESTS_CLAIM] });
    const out = renderRun(loaded, [evidence(101, "sha1", ["src/a.ts"])], undefined, true);
    const parsed = JSON.parse(out) as { reports: { observation: { kind: string } }[] };
    expect(parsed.reports[0]?.observation.kind).toBe("counterexample");
  });
});
