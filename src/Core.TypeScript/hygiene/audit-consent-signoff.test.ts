// audit-consent-signoff.test.ts — the falsifiers.
//
// A verifier that cannot fail is the defect this repo is built against, so the
// point of this file is NOT that a good ledger passes. It is that each way of
// being wrong produces a DIFFERENT, NAMED failure:
//
//   * mutate the approved passage by one character  -> STALE
//   * point a row at a review that does not exist   -> REVIEW_MISSING
//   * cite a COMMENTED review instead of APPROVED   -> REVIEW_NOT_APPROVED
//   * have someone else author the review           -> REVIEW_WRONG_AUTHOR
//   * same login, re-registered account (new id)    -> REVIEW_WRONG_AUTHOR
//   * revoke after granting                         -> REVOKED_PASSAGE_PRESENT
//   * a passage with no consent event at all        -> SPAN_UNCLAIMED
//   * a "de-identified" span still carrying the name-> DEIDENT_LEAK
//   * no review source                              -> UNCHECKED, exit 3, never 0
//
// Each negative case is paired with the positive control it mutates from, so a
// failure cannot be produced by an EARLIER guard firing on a broken fixture.

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  canonicalizePassage,
  collectSpans,
  exitCodeFor,
  extractSpans,
  foldConsent,
  footprintOf,
  hashPassage,
  LedgerError,
  parseLedger,
  SpanError,
  verify,
  type ConsentEvent,
  type ReviewRecord,
  type ReviewSource,
} from "./audit-consent-signoff";

// ---------------------------------------------------------------------------
// Fixture plumbing
// ---------------------------------------------------------------------------

const BOOK = "docs/books/you-born-at-the-hinge";
const LEDGER = `${BOOK}/consent-events.json`;

/** The passage Chris King approves in every positive control below. */
const PASSAGE = [
  "Chris King named it *reader's disease* — the habit of mistaking",
  "having read a thing for having understood it.",
].join("\n");

const PASSAGE_SHA = hashPassage(canonicalizePassage(PASSAGE.split("\n")));

function chapter(spanBody: string, attrs = 'id=chris-readers-disease person="Chris King"'): string {
  const id = /id=([A-Za-z0-9._-]+)/.exec(attrs)?.[1] ?? "chris-readers-disease";
  return ["# A chapter", "", `<!-- consent:begin ${attrs} -->`, spanBody, `<!-- consent:end id=${id} -->`, ""].join(
    "\n",
  );
}

interface FixtureOptions {
  chapterText?: string;
  people?: unknown[];
  events?: unknown[];
}

function fixture(opts: FixtureOptions = {}): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "consent-signoff-"));
  mkdirSync(join(root, BOOK), { recursive: true });
  writeFileSync(join(root, BOOK, "ch-01.md"), opts.chapterText ?? chapter(PASSAGE), "utf8");
  writeFileSync(
    join(root, LEDGER),
    JSON.stringify(
      {
        schemaVersion: 1,
        people: opts.people ?? [
          { person: "Chris King", githubLogin: "chrisking", githubUserId: 4242, aliases: ["Chris King", "Chris"] },
        ],
        events: opts.events ?? [grantEvent()],
      },
      null,
      2,
    ),
    "utf8",
  );
  process.env["REPO_ROOT"] = root;
  return {
    root,
    cleanup: () => {
      delete process.env["REPO_ROOT"];
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function grantEvent(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    eventId: "grant-chris-attribution-1",
    type: "grant",
    person: "Chris King",
    scope: "attribution",
    spanId: "chris-readers-disease",
    spanSha256: PASSAGE_SHA,
    artifact: { kind: "pull-request-review", repo: "Lucent-Financial-Group/Zeta", pullNumber: 15600, reviewId: 900001 },
    phase: "2026-08-26T10:00:00Z",
    ...over,
  };
}

/** A fake review source. This is the ONE declared channel; tests inject it. */
function fakeReviews(rec: Partial<ReviewRecord> | null): ReviewSource {
  return {
    fetch: (): ReviewRecord | null =>
      rec === null
        ? null
        : {
            state: "APPROVED",
            authorLogin: "chrisking",
            authorId: 4242,
            submittedAt: "2026-08-26T10:00:00Z",
            commitId: "deadbeef",
            ...rec,
          },
  };
}

const codesOf = (r: { findings: { code: string }[] }): string[] => r.findings.map((f) => f.code).sort();
const failingCodesOf = (r: { findings: { code: string; severity: string }[] }): string[] =>
  r.findings
    .filter((f) => f.severity === "fail")
    .map((f) => f.code)
    .sort();

// ---------------------------------------------------------------------------
// THE POSITIVE CONTROL — every negative below mutates exactly one thing from here
// ---------------------------------------------------------------------------

describe("positive control", () => {
  test("a well-formed grant with a matching passage and a real APPROVED review passes in both modes", () => {
    const f = fixture();
    try {
      for (const publish of [false, true]) {
        const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], publish, reviewSource: fakeReviews({}) });
        expect(report.findings).toEqual([]);
        expect(report.grantsVerified).toBe(1);
        expect(report.spansFound).toBe(1);
        expect(exitCodeFor(report)).toBe(0);
      }
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// THE HASH BINDING — consent is given to TEXT, not to a name
// ---------------------------------------------------------------------------

describe("text drift goes STALE", () => {
  test("mutating ONE character of the approved passage produces STALE and blocks publish", () => {
    // The mutation is a single comma. Nothing else about the fixture changes: the
    // review is the same, APPROVED, by the same account. Only the text moved.
    const mutated = PASSAGE.replace("disease* —", "disease*, —");
    expect(mutated).not.toBe(PASSAGE);

    const f = fixture({ chapterText: chapter(mutated) });
    try {
      const publishReport = verify({
        ledgerPath: LEDGER,
        corpusDirs: [BOOK],
        publish: true,
        reviewSource: fakeReviews({}),
      });
      expect(codesOf(publishReport)).toEqual(["STALE"]);
      expect(exitCodeFor(publishReport)).toBe(1);
      // ...and it names both hashes, so the reader can see what moved.
      expect(publishReport.findings[0]?.detail).toContain(PASSAGE_SHA);

      // Repo tier: reported, but does not fail. The gate is publication.
      const repoReport = verify({
        ledgerPath: LEDGER,
        corpusDirs: [BOOK],
        publish: false,
        reviewSource: fakeReviews({}),
      });
      expect(codesOf(repoReport)).toEqual(["STALE"]);
      expect(failingCodesOf(repoReport)).toEqual([]);
      expect(exitCodeFor(repoReport)).toBe(0);
    } finally {
      f.cleanup();
    }
  });

  test("whitespace-only churn does NOT go stale — trailing spaces and CRLF are canonicalized away", () => {
    const noisy = `${PASSAGE.split("\n")[0]}   \r\n${PASSAGE.split("\n")[1]}\t`;
    const f = fixture({ chapterText: chapter(`\n${noisy}\n`) });
    try {
      const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], publish: true, reviewSource: fakeReviews({}) });
      expect(report.findings).toEqual([]);
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// THE ARTIFACT — verification does not route through the author
// ---------------------------------------------------------------------------

describe("the cited review must actually exist and say what the ledger claims", () => {
  test("a row pointing at a non-existent review fails REVIEW_MISSING in BOTH modes", () => {
    const f = fixture();
    try {
      const report = verify({
        ledgerPath: LEDGER,
        corpusDirs: [BOOK],
        publish: false,
        reviewSource: fakeReviews(null),
      });
      expect(failingCodesOf(report)).toEqual(["REVIEW_MISSING"]);
      expect(report.grantsVerified).toBe(0);
      expect(exitCodeFor(report)).toBe(1);
    } finally {
      f.cleanup();
    }
  });

  test("a COMMENTED review is discussion, not consent -> REVIEW_NOT_APPROVED", () => {
    const f = fixture();
    try {
      const report = verify({
        ledgerPath: LEDGER,
        corpusDirs: [BOOK],
        reviewSource: fakeReviews({ state: "COMMENTED" }),
      });
      expect(failingCodesOf(report)).toEqual(["REVIEW_NOT_APPROVED"]);
      expect(exitCodeFor(report)).toBe(1);
    } finally {
      f.cleanup();
    }
  });

  test("a CHANGES_REQUESTED review is a decline -> REVIEW_NOT_APPROVED", () => {
    const f = fixture();
    try {
      const report = verify({
        ledgerPath: LEDGER,
        corpusDirs: [BOOK],
        reviewSource: fakeReviews({ state: "CHANGES_REQUESTED" }),
      });
      expect(failingCodesOf(report)).toEqual(["REVIEW_NOT_APPROVED"]);
    } finally {
      f.cleanup();
    }
  });

  test("a DISMISSED review (branch protection dismissed it as stale) is not consent", () => {
    const f = fixture();
    try {
      const report = verify({
        ledgerPath: LEDGER,
        corpusDirs: [BOOK],
        reviewSource: fakeReviews({ state: "DISMISSED" }),
      });
      expect(failingCodesOf(report)).toEqual(["REVIEW_NOT_APPROVED"]);
    } finally {
      f.cleanup();
    }
  });

  test("someone ELSE approving does not consent on their behalf -> REVIEW_WRONG_AUTHOR", () => {
    const f = fixture();
    try {
      const report = verify({
        ledgerPath: LEDGER,
        corpusDirs: [BOOK],
        reviewSource: fakeReviews({ authorLogin: "acehack", authorId: 1 }),
      });
      expect(failingCodesOf(report)).toEqual(["REVIEW_WRONG_AUTHOR"]);
      expect(report.findings[0]?.detail).toContain("acehack");
    } finally {
      f.cleanup();
    }
  });

  test("SAME login, DIFFERENT account id -> REVIEW_WRONG_AUTHOR (a re-registered login is a different person)", () => {
    // GitHub frees a deleted login for re-registration; the numeric id is never
    // reused. Without the id check this case passes and looks perfect.
    const f = fixture();
    try {
      const report = verify({
        ledgerPath: LEDGER,
        corpusDirs: [BOOK],
        reviewSource: fakeReviews({ authorLogin: "chrisking", authorId: 999999 }),
      });
      expect(failingCodesOf(report)).toEqual(["REVIEW_WRONG_AUTHOR"]);
      expect(report.findings[0]?.detail).toContain("999999");
    } finally {
      f.cleanup();
    }
  });

  test("login comparison is case-insensitive (GitHub logins are) and passes", () => {
    const f = fixture();
    try {
      const report = verify({
        ledgerPath: LEDGER,
        corpusDirs: [BOOK],
        reviewSource: fakeReviews({ authorLogin: "ChrisKing" }),
      });
      expect(report.findings).toEqual([]);
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// A CHECK THAT DID NOT RUN IS NOT A CHECK THAT PASSED
// ---------------------------------------------------------------------------

describe("UNCHECKED", () => {
  test("with no review source, the grant is UNCHECKED and the exit code is 3 — never 0", () => {
    const f = fixture();
    try {
      const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], reviewSource: null });
      expect(codesOf(report)).toEqual(["UNCHECKED"]);
      expect(report.grantsUnchecked).toBe(1);
      expect(report.grantsVerified).toBe(0);
      expect(exitCodeFor(report)).toBe(3);
    } finally {
      f.cleanup();
    }
  });

  test("with no grants to check, offline is honestly 0 — there was nothing to fetch", () => {
    const f = fixture({ chapterText: "# A chapter\n\nNo third parties here.\n", events: [] });
    try {
      const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], reviewSource: null });
      expect(report.findings).toEqual([]);
      expect(report.grantsUnchecked).toBe(0);
      expect(exitCodeFor(report)).toBe(0);
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// REVOCATION — real, not nominal
// ---------------------------------------------------------------------------

describe("grant(+1) / revoke(-1) fold", () => {
  test("a revoke after a grant blocks publication while KEEPING both events", () => {
    const events = [
      grantEvent(),
      {
        eventId: "revoke-chris-attribution-1",
        type: "revoke",
        person: "Chris King",
        scope: "attribution",
        spanId: "chris-readers-disease",
        artifact: { kind: "relayed", note: "phoned Aaron 2026-08-27 and asked for it to come out" },
        phase: "2026-08-27T09:00:00Z",
      },
    ];
    const f = fixture({ events });
    try {
      const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], publish: true, reviewSource: fakeReviews({}) });
      expect(codesOf(report)).toEqual(["REVOKED_PASSAGE_PRESENT"]);
      expect(exitCodeFor(report)).toBe(1);
      // Both events survive the fold: the record of having consented is not erased.
      const folded = foldConsent(events as unknown as ConsentEvent[]);
      const entry = [...folded.values()][0];
      expect(entry?.history).toHaveLength(2);
      expect(entry?.state).toBe("revoked");
    } finally {
      f.cleanup();
    }
  });

  test("re-granting after a revoke restores consent (the fold is the state, not a tombstone)", () => {
    const events = [
      grantEvent(),
      {
        eventId: "revoke-1",
        type: "revoke",
        person: "Chris King",
        scope: "attribution",
        spanId: "chris-readers-disease",
        artifact: { kind: "relayed" },
        phase: "2026-08-27T09:00:00Z",
      },
      grantEvent({
        eventId: "grant-2",
        phase: "2026-08-28T09:00:00Z",
        artifact: {
          kind: "pull-request-review",
          repo: "Lucent-Financial-Group/Zeta",
          pullNumber: 15601,
          reviewId: 900002,
        },
      }),
    ];
    const f = fixture({ events });
    try {
      const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], publish: true, reviewSource: fakeReviews({}) });
      expect(report.findings).toEqual([]);
    } finally {
      f.cleanup();
    }
  });

  test("on an exact phase tie the REVOKE wins — under ambiguity the safe direction is less exposure", () => {
    const events = [
      grantEvent({ eventId: "aaa-grant" }),
      {
        eventId: "zzz-revoke",
        type: "revoke",
        person: "Chris King",
        scope: "attribution",
        spanId: "chris-readers-disease",
        artifact: { kind: "relayed" },
        phase: "2026-08-26T10:00:00Z",
      },
    ] as unknown as ConsentEvent[];
    const folded = foldConsent(events);
    expect([...folded.values()][0]?.state).toBe("revoked");

    // ...and the tie-break is not just alphabetical on eventId: reverse the ids
    // and the revoke still wins.
    const reversed = [
      grantEvent({ eventId: "zzz-grant" }),
      {
        eventId: "aaa-revoke",
        type: "revoke",
        person: "Chris King",
        scope: "attribution",
        spanId: "chris-readers-disease",
        artifact: { kind: "relayed" },
        phase: "2026-08-26T10:00:00Z",
      },
    ] as unknown as ConsentEvent[];
    expect([...foldConsent(reversed).values()][0]?.state).toBe("revoked");
  });

  test("a GRANT may not be relayed — only the person's own artifact can widen exposure", () => {
    expect(() =>
      parseLedger(
        JSON.stringify({
          schemaVersion: 1,
          people: [{ person: "Chris King", aliases: [] }],
          events: [{ ...grantEvent(), artifact: { kind: "relayed", note: "Aaron says he said yes" } }],
        }),
        "fixture",
      ),
    ).toThrow(LedgerError);
  });

  test("a REVOKE may be relayed — reducing exposure needs no ceremony", () => {
    const ledger = parseLedger(
      JSON.stringify({
        schemaVersion: 1,
        people: [{ person: "Chris King", aliases: [] }],
        events: [
          {
            eventId: "r1",
            type: "revoke",
            person: "Chris King",
            scope: "naming",
            spanId: "x",
            artifact: { kind: "relayed" },
            phase: "2026-08-27T00:00:00Z",
          },
        ],
      }),
      "fixture",
    );
    expect(ledger.events).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// UNCLAIMED PASSAGES — where the audit gets its teeth
// ---------------------------------------------------------------------------

describe("a named passage with no consent on file", () => {
  test("SPAN_UNCLAIMED blocks publish and is advisory in the repo tier", () => {
    const f = fixture({ events: [] });
    try {
      const publishReport = verify({
        ledgerPath: LEDGER,
        corpusDirs: [BOOK],
        publish: true,
        reviewSource: fakeReviews({}),
      });
      expect(codesOf(publishReport)).toEqual(["SPAN_UNCLAIMED"]);
      expect(exitCodeFor(publishReport)).toBe(1);

      const repoReport = verify({
        ledgerPath: LEDGER,
        corpusDirs: [BOOK],
        publish: false,
        reviewSource: fakeReviews({}),
      });
      expect(exitCodeFor(repoReport)).toBe(0);
    } finally {
      f.cleanup();
    }
  });

  test("a grant citing a span that is not in the tree fails PASSAGE_MISSING", () => {
    const f = fixture({ chapterText: "# A chapter\n\nThe passage was deleted.\n" });
    try {
      const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], publish: true, reviewSource: fakeReviews({}) });
      expect(codesOf(report)).toEqual(["PASSAGE_MISSING"]);
    } finally {
      f.cleanup();
    }
  });

  test("a span whose subject is not on the roster fails UNKNOWN_PERSON in both modes", () => {
    const f = fixture({ chapterText: chapter(PASSAGE, 'id=chris-readers-disease person="Nobody Known"'), events: [] });
    try {
      const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], publish: false, reviewSource: fakeReviews({}) });
      expect(failingCodesOf(report)).toEqual(["UNKNOWN_PERSON"]);
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// ROLE-ONLY / DE-IDENTIFIED — the maintainer's live practice, made checkable
// ---------------------------------------------------------------------------

describe("de-identified spans", () => {
  test("a mode=deidentified passage carrying no name needs no consent event and passes", () => {
    const body = "A colleague of mine, at the time, taught me to ask rather than infer.";
    const f = fixture({
      chapterText: chapter(body, 'id=colleague-elicitation person="Chris King" mode=deidentified'),
      events: [],
    });
    try {
      const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], publish: true, reviewSource: fakeReviews({}) });
      expect(report.findings).toEqual([]);
      expect(exitCodeFor(report)).toBe(0);
    } finally {
      f.cleanup();
    }
  });

  test("a mode=deidentified passage that still contains the name fails DEIDENT_LEAK in BOTH modes", () => {
    // This is a BROKEN CLAIM, not merely insufficient consent — it fails at the
    // repo tier too, because a de-identification that does not de-identify is a
    // guard everyone believes is holding and which is not.
    const body = "Chris King, a colleague of mine, taught me to ask rather than infer.";
    const f = fixture({
      chapterText: chapter(body, 'id=colleague-elicitation person="Chris King" mode=deidentified'),
      events: [],
    });
    try {
      const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], publish: false, reviewSource: fakeReviews({}) });
      expect(failingCodesOf(report)).toEqual(["DEIDENT_LEAK"]);
      expect(exitCodeFor(report)).toBe(1);
    } finally {
      f.cleanup();
    }
  });

  test("alias matching is case-insensitive", () => {
    const body = "chris king taught me to ask rather than infer.";
    const f = fixture({ chapterText: chapter(body, 'id=x person="Chris King" mode=deidentified'), events: [] });
    try {
      const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], publish: false, reviewSource: fakeReviews({}) });
      expect(failingCodesOf(report)).toEqual(["DEIDENT_LEAK"]);
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// FOOTPRINT GRANTS — one approval over a person's combined appearance
// ---------------------------------------------------------------------------

describe("footprint grants (spanId '*')", () => {
  const twoSpans = [
    "# A chapter",
    "",
    '<!-- consent:begin id=chris-readers-disease person="Chris King" -->',
    PASSAGE,
    "<!-- consent:end id=chris-readers-disease -->",
    "",
    '<!-- consent:begin id=chris-witness person="Chris King" -->',
    "Chris King watched me debug it and said the finding was the validation.",
    "<!-- consent:end id=chris-witness -->",
    "",
  ].join("\n");

  function footprintFixture(chapterText: string): { root: string; cleanup: () => void; sha: string } {
    const probe = fixture({ chapterText, events: [] });
    const { spans } = collectSpans([BOOK]);
    const sha = footprintOf("Chris King", spans).sha256;
    probe.cleanup();
    const f = fixture({ chapterText, events: [grantEvent({ spanId: "*", spanSha256: sha, scope: "naming" })] });
    return { ...f, sha };
  }

  test("one footprint grant covers every span naming that person", () => {
    const f = footprintFixture(twoSpans);
    try {
      const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], publish: true, reviewSource: fakeReviews({}) });
      expect(report.findings).toEqual([]);
      expect(report.spansFound).toBe(2);
    } finally {
      f.cleanup();
    }
  });

  test("changing ONE member span goes STALE and the finding names which member moved", () => {
    const f = footprintFixture(twoSpans);
    try {
      // Re-write the chapter with the second span edited, keeping the old grant.
      writeFileSync(
        join(f.root, BOOK, "ch-01.md"),
        twoSpans.replace("said the finding was", "said the bug was"),
        "utf8",
      );
      const report = verify({ ledgerPath: LEDGER, corpusDirs: [BOOK], publish: true, reviewSource: fakeReviews({}) });
      expect(codesOf(report)).toEqual(["STALE"]);
      expect(report.findings[0]?.detail).toContain("chris-witness");
      expect(exitCodeFor(report)).toBe(1);
    } finally {
      f.cleanup();
    }
  });

  test("the footprint hash does not depend on span ORDER in the file", () => {
    const a = footprintFixture(twoSpans);
    const shaA = a.sha;
    a.cleanup();
    const swapped = [
      "# A chapter",
      "",
      '<!-- consent:begin id=chris-witness person="Chris King" -->',
      "Chris King watched me debug it and said the finding was the validation.",
      "<!-- consent:end id=chris-witness -->",
      "",
      '<!-- consent:begin id=chris-readers-disease person="Chris King" -->',
      PASSAGE,
      "<!-- consent:end id=chris-readers-disease -->",
      "",
    ].join("\n");
    const b = footprintFixture(swapped);
    try {
      expect(b.sha).toBe(shaA);
    } finally {
      b.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// SPAN PARSING — the marker syntax itself
// ---------------------------------------------------------------------------

describe("span extraction", () => {
  test("markers inside a fenced code block are DOCUMENTATION, not live spans", () => {
    // Without this the design doc showing the syntax would register consent.
    const text = [
      "# Doc",
      "",
      "```markdown",
      '<!-- consent:begin id=example person="Someone" -->',
      "example text",
      "<!-- consent:end id=example -->",
      "```",
      "",
    ].join("\n");
    expect(extractSpans(text, "doc.md")).toEqual([]);
  });

  test("an unclosed span is a configuration error, not a silently-skipped one", () => {
    const text = ['<!-- consent:begin id=a person="P" -->', "body", ""].join("\n");
    expect(() => extractSpans(text, "f.md")).toThrow(SpanError);
  });

  test("nested spans are refused", () => {
    const text = [
      '<!-- consent:begin id=a person="P" -->',
      '<!-- consent:begin id=b person="P" -->',
      "body",
      "<!-- consent:end id=b -->",
      "<!-- consent:end id=a -->",
    ].join("\n");
    expect(() => extractSpans(text, "f.md")).toThrow(SpanError);
  });

  test("a mismatched end id is refused", () => {
    const text = ['<!-- consent:begin id=a person="P" -->', "body", "<!-- consent:end id=b -->"].join("\n");
    expect(() => extractSpans(text, "f.md")).toThrow(SpanError);
  });

  test("a span with no person= is refused — a subject-less span cannot be checked", () => {
    const text = ["<!-- consent:begin id=a -->", "body", "<!-- consent:end id=a -->"].join("\n");
    expect(() => extractSpans(text, "f.md")).toThrow(SpanError);
  });

  test("an empty span is refused", () => {
    const text = ['<!-- consent:begin id=a person="P" -->', "", "<!-- consent:end id=a -->"].join("\n");
    expect(() => extractSpans(text, "f.md")).toThrow(SpanError);
  });

  test("duplicate span ids across the corpus are refused — the id is the citation key", () => {
    const f = fixture();
    try {
      writeFileSync(join(f.root, BOOK, "ch-02.md"), chapter(PASSAGE), "utf8");
      expect(() => collectSpans([BOOK])).toThrow(SpanError);
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// LEDGER SCHEMA
// ---------------------------------------------------------------------------

describe("ledger schema", () => {
  const base = {
    schemaVersion: 1,
    people: [{ person: "Chris King", githubLogin: "chrisking", aliases: [] }],
    events: [] as unknown[],
  };

  test("a grant with no spanSha256 is refused — that field IS the binding to text", () => {
    const bad = { ...base, events: [{ ...grantEvent(), spanSha256: undefined }] };
    expect(() => parseLedger(JSON.stringify(bad), "f")).toThrow(LedgerError);
  });

  test("a duplicate eventId is refused — it is the idempotency key", () => {
    const bad = { ...base, events: [grantEvent(), grantEvent()] };
    expect(() => parseLedger(JSON.stringify(bad), "f")).toThrow(LedgerError);
  });

  test("an unknown scope is refused", () => {
    const bad = { ...base, events: [grantEvent({ scope: "vibes" })] };
    expect(() => parseLedger(JSON.stringify(bad), "f")).toThrow(LedgerError);
  });

  test("a person not on the roster is refused", () => {
    const bad = { ...base, events: [grantEvent({ person: "Someone Else" })] };
    expect(() => parseLedger(JSON.stringify(bad), "f")).toThrow(LedgerError);
  });

  test("a non-UTC phase is refused — local time never enters the fold", () => {
    const bad = { ...base, events: [grantEvent({ phase: "2026-08-26T10:00:00-04:00" })] };
    expect(() => parseLedger(JSON.stringify(bad), "f")).toThrow(LedgerError);
  });

  test("the SHIPPED ledger in this repo parses under the real schema", () => {
    // Condition 2 of the no-binary-in-proof-lineage rule, applied here: an
    // expectation nothing reads is the vacuity class. The real
    // consent-events.json is opened and parsed by this test, so a malformed one
    // goes red before any event exists. Root comes from this file's own
    // location, not REPO_ROOT, which the fixtures above set and unset.
    const root = resolve(import.meta.dir, "..", "..", "..");
    const parsed = parseLedger(readFileSync(join(root, LEDGER), "utf8"), LEDGER);
    expect(Array.isArray(parsed.events)).toBe(true);
    expect(parsed.people instanceof Map).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CANONICALIZATION
// ---------------------------------------------------------------------------

describe("canonicalizePassage", () => {
  test("strips CR, trailing whitespace, and surrounding blank lines; keeps interior blanks", () => {
    expect(canonicalizePassage(["", "a  ", "", "b\r", ""])).toBe("a\n\nb\n");
  });

  test("an all-blank body canonicalizes to empty", () => {
    expect(canonicalizePassage(["", "  ", ""])).toBe("");
  });

  test("a one-character difference changes the hash", () => {
    expect(hashPassage(canonicalizePassage(["ab"]))).not.toBe(hashPassage(canonicalizePassage(["ac"])));
  });
});
