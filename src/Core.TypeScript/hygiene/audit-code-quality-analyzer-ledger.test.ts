import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  ANALYZER_LOGIN,
  ANALYZER_LOGIN_BOT,
  BIAS_CAVEAT,
  LEDGER_PATH,
  SCHEMA_VERSION,
  type FetchedFinding,
  type Ledger,
  type LedgerEntry,
  fetchFindings,
  findingKey,
  loadLedger,
  main,
  mergeIntoLedger,
  parseGraphQlThreads,
  parsePrArgs,
  parseRuleTitle,
  renderHuman,
  repoRoot,
  summarize,
  validateLedger,
} from "./audit-code-quality-analyzer-ledger";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function entry(over: Partial<LedgerEntry> = {}): LedgerEntry {
  const base: LedgerEntry = {
    key: "1:a.ts:1:Rule",
    pr: 1,
    path: "a.ts",
    line: 1,
    rule: "Rule",
    firstSeen: "2026-08-01T00:00:00Z",
    threadResolved: false,
    resolvedBy: null,
    botAutoResolved: false,
    disposition: "unadjudicated",
    evidenceKind: "none",
    evidence: null,
    evidenceNote: null,
    drawReason: "systematic-sweep",
    adjudicatedBy: null,
    adjudicatedAt: null,
  };
  const merged = { ...base, ...over };
  // Keep the natural key consistent with the fields unless a test is deliberately
  // corrupting it — otherwise every fixture would trip the key-mismatch refusal.
  if (over.key === undefined) merged.key = findingKey(merged);
  return merged;
}

function ledgerOf(entries: LedgerEntry[]): Ledger {
  return {
    schemaVersion: SCHEMA_VERSION,
    analyzer: ANALYZER_LOGIN,
    note: "fixture",
    census: {
      method: "fixture",
      completeAsOf: "2026-08-25T00:00:00Z",
      windowStart: "2026-04-29T00:00:00Z",
      windowEnd: "2026-08-24T00:00:00Z",
      threadsEnumerated: entries.length,
      prsCovered: new Set(entries.map((e) => e.pr)).size,
      knownGaps: [],
    },
    entries,
  };
}

function thread(over: {
  login?: string;
  path?: string;
  line?: number | null;
  originalLine?: number | null;
  body?: string;
  isResolved?: boolean;
  resolvedBy?: string | null;
}) {
  return {
    isResolved: over.isResolved ?? false,
    isOutdated: false,
    resolvedBy: over.resolvedBy === undefined ? null : { login: over.resolvedBy },
    comments: {
      nodes: [
        {
          author: { login: over.login ?? ANALYZER_LOGIN },
          path: over.path ?? "src/a.ts",
          line: over.line === undefined ? 10 : over.line,
          originalLine: over.originalLine ?? null,
          body: over.body ?? "## Unused variable, import, function or class\n\nblah",
          createdAt: "2026-08-01T00:00:00Z",
          url: "https://github.com/x/y/pull/1#discussion_r1",
        },
      ],
    },
  };
}

function payload(nodes: ReturnType<typeof thread>[], number = 1) {
  return { data: { repository: { pullRequest: { number, reviewThreads: { nodes } } } } };
}

// ---------------------------------------------------------------------------
// parseRuleTitle
// ---------------------------------------------------------------------------

describe("parseRuleTitle", () => {
  test("takes the `## Title` heading and nothing else", () => {
    expect(parseRuleTitle("## Invocation of non-function\n\n<p>body</p>")).toBe(
      "Invocation of non-function",
    );
  });

  test("body prose after the heading never leaks into the title", () => {
    // FALSIFIER: keying on the whole body would make every re-fetch a new ledger row,
    // because the analyzer rewrites its prose and its permalinks between runs.
    const a = parseRuleTitle("## Unused import\n\nUnused import readFileSync.");
    const b = parseRuleTitle("## Unused import\n\nUnused import mkdirSync.");
    expect(a).toBe(b);
  });

  test("a body with no heading is named, not silently empty", () => {
    expect(parseRuleTitle("no heading here")).toBe("(untitled)");
    expect(parseRuleTitle("")).toBe("(untitled)");
  });
});

// ---------------------------------------------------------------------------
// findingKey
// ---------------------------------------------------------------------------

describe("findingKey", () => {
  test("two findings differing ONLY in line get different keys", () => {
    // FALSIFIER: dropping `line` from the key collapses the ten rho-star findings
    // (lines 40..123 of one file, one rule) into a single row and divides the real
    // denominator by ten.
    const a = findingKey({ pr: 13767, path: "t.ts", line: 40, rule: "Invocation of non-function" });
    const b = findingKey({ pr: 13767, path: "t.ts", line: 45, rule: "Invocation of non-function" });
    expect(a).not.toBe(b);
  });

  test("two findings differing ONLY in rule get different keys", () => {
    const a = findingKey({ pr: 1, path: "t.ts", line: 1, rule: "Unused import" });
    const b = findingKey({ pr: 1, path: "t.ts", line: 1, rule: "Identical operands" });
    expect(a).not.toBe(b);
  });

  test("two findings differing ONLY in PR get different keys", () => {
    // The same defect flagged on two PRs is two observations, not one.
    expect(findingKey({ pr: 1, path: "t.ts", line: 1, rule: "R" })).not.toBe(
      findingKey({ pr: 2, path: "t.ts", line: 1, rule: "R" }),
    );
  });

  test("identical fields give a byte-identical key (upsert depends on it)", () => {
    const f = { pr: 7, path: "t.ts", line: null, rule: "R" };
    expect(findingKey(f)).toBe(findingKey({ ...f }));
  });
});

// ---------------------------------------------------------------------------
// parseGraphQlThreads
// ---------------------------------------------------------------------------

describe("parseGraphQlThreads", () => {
  test("keeps analyzer threads under BOTH login spellings", () => {
    // FALSIFIER: this is the bug that made the first census return zero. GraphQL reports
    // the author as `github-code-quality`; REST and `resolvedBy` say
    // `github-code-quality[bot]`. Matching only the REST spelling silently finds nothing
    // and looks exactly like "the analyzer posted no findings".
    const got = parseGraphQlThreads(
      payload([thread({ login: ANALYZER_LOGIN }), thread({ login: ANALYZER_LOGIN_BOT })]),
    );
    expect(got).toHaveLength(2);
  });

  test("drops threads written by anyone else", () => {
    // FALSIFIER: `github-advanced-security[bot]` posts on the same PRs — 41 of the last
    // 100 review comments in this repo. Counting it would inflate the denominator with
    // another tool's findings.
    const got = parseGraphQlThreads(
      payload([
        thread({ login: "github-advanced-security" }),
        thread({ login: "AceHack" }),
        thread({ login: ANALYZER_LOGIN }),
      ]),
    );
    expect(got).toHaveLength(1);
    expect(got[0]?.pr).toBe(1);
  });

  test("falls back to originalLine when an outdated thread has line: null", () => {
    // FALSIFIER: 125 of the 269 real threads have `line: null`. Without the fallback they
    // all key as `pr:path:null:rule`, so distinct findings in one file merge into one row.
    const got = parseGraphQlThreads(payload([thread({ line: null, originalLine: 46 })]));
    expect(got[0]?.line).toBe(46);
  });

  test("keeps line null when BOTH line and originalLine are absent", () => {
    const got = parseGraphQlThreads(payload([thread({ line: null, originalLine: null })]));
    expect(got[0]?.line).toBeNull();
  });

  test("carries resolution state through verbatim", () => {
    const got = parseGraphQlThreads(
      payload([thread({ isResolved: true, resolvedBy: ANALYZER_LOGIN_BOT })]),
    );
    expect(got[0]?.threadResolved).toBe(true);
    expect(got[0]?.resolvedBy).toBe(ANALYZER_LOGIN_BOT);
  });

  test("a null pullRequest (deleted / inaccessible) yields no findings, not a throw", () => {
    expect(parseGraphQlThreads({ data: { repository: { pullRequest: null } } })).toEqual([]);
    expect(parseGraphQlThreads({})).toEqual([]);
    expect(parseGraphQlThreads(null)).toEqual([]);
  });

  test("a thread with zero comments is skipped rather than crashing", () => {
    const p = payload([]);
    p.data.repository.pullRequest.reviewThreads.nodes.push({
      isResolved: false,
      isOutdated: false,
      resolvedBy: null,
      comments: { nodes: [] },
    } as unknown as ReturnType<typeof thread>);
    expect(parseGraphQlThreads(p)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mergeIntoLedger — idempotency and the no-clobber invariant
// ---------------------------------------------------------------------------

describe("mergeIntoLedger", () => {
  const fetched: FetchedFinding[] = [
    {
      pr: 5,
      path: "src/a.ts",
      line: 12,
      rule: "Unused import",
      firstSeen: "2026-08-01T00:00:00Z",
      threadResolved: false,
      resolvedBy: null,
      url: "https://example.invalid/1",
    },
  ];

  test("apply-twice == apply-once (DV2.0 #6 idempotency)", () => {
    // FALSIFIER: append-without-dedup would double the denominator on every CI run, so
    // the FP rate would drift purely as a function of how often the meter ran.
    const l = ledgerOf([]);
    const first = mergeIntoLedger(l, fetched);
    expect(first.added).toBe(1);
    const second = mergeIntoLedger(l, fetched);
    expect(second.added).toBe(0);
    expect(second.refreshed).toBe(1);
    expect(l.entries).toHaveLength(1);
  });

  test("a re-fetch REFRESHES resolution state on an existing entry", () => {
    const l = ledgerOf([]);
    mergeIntoLedger(l, fetched);
    expect(l.entries[0]?.threadResolved).toBe(false);
    mergeIntoLedger(l, [
      { ...fetched[0]!, threadResolved: true, resolvedBy: ANALYZER_LOGIN_BOT },
    ]);
    expect(l.entries[0]?.threadResolved).toBe(true);
    expect(l.entries[0]?.botAutoResolved).toBe(true);
  });

  test("a re-fetch NEVER overwrites an adjudication", () => {
    // FALSIFIER — the central no-clobber invariant. A later fetch reports only what the
    // API knows (resolution), and resetting a human's verdict to `unadjudicated` because
    // the bot auto-resolved the thread would delete the one measurement this ledger keeps.
    const l = ledgerOf([]);
    mergeIntoLedger(l, fetched);
    const e = l.entries[0]!;
    e.disposition = "false-positive";
    e.evidenceKind = "measured";
    e.evidence = "https://example.invalid/adjudication";
    e.adjudicatedBy = "otto";
    mergeIntoLedger(l, [
      { ...fetched[0]!, threadResolved: true, resolvedBy: ANALYZER_LOGIN_BOT },
    ]);
    expect(l.entries[0]?.disposition).toBe("false-positive");
    expect(l.entries[0]?.evidenceKind).toBe("measured");
    expect(l.entries[0]?.adjudicatedBy).toBe("otto");
  });

  test("new entries land as unadjudicated with no evidence", () => {
    // A fetch observes; it does not adjudicate. An auto-adjudicating merge would
    // manufacture the exact number the meter exists to measure honestly.
    const l = ledgerOf([]);
    mergeIntoLedger(l, fetched);
    expect(l.entries[0]?.disposition).toBe("unadjudicated");
    expect(l.entries[0]?.evidenceKind).toBe("none");
  });

  test("entries stay sorted by key so the diff is reviewable", () => {
    // THREE entries, deliberately: with two, insertion order [9, 2] REVERSED is also
    // sorted, so a two-entry fixture cannot tell sorting apart from reversing and the
    // test is vacuous. Caught by mutation M11. Three make the two orders disagree.
    const l = ledgerOf([]);
    mergeIntoLedger(l, [
      { ...fetched[0]!, pr: 9 },
      { ...fetched[0]!, pr: 2 },
      { ...fetched[0]!, pr: 5 },
    ]);
    const keys = l.entries.map((e) => e.key);
    expect(keys).toEqual(["2:src/a.ts:12:Unused import", "5:src/a.ts:12:Unused import", "9:src/a.ts:12:Unused import"]);
  });
});

// ---------------------------------------------------------------------------
// summarize — resolution must NEVER enter the split
// ---------------------------------------------------------------------------

describe("summarize", () => {
  test("bot-auto-resolved threads count as ZERO true positives", () => {
    // FALSIFIER — the headline invariant of this whole file. 141 of the 269 real threads
    // were closed by the analyzer itself the moment the code moved under them. If
    // resolution fed the split, this fixture would report 3 true positives and a 0% FP
    // rate; the correct answer is that nothing has been adjudicated at all.
    const l = ledgerOf([
      entry({ pr: 1, threadResolved: true, resolvedBy: ANALYZER_LOGIN_BOT, botAutoResolved: true }),
      entry({ pr: 2, threadResolved: true, resolvedBy: ANALYZER_LOGIN_BOT, botAutoResolved: true }),
      entry({ pr: 3, threadResolved: true, resolvedBy: ANALYZER_LOGIN_BOT, botAutoResolved: true }),
    ]);
    const s = summarize(l);
    expect(s.truePositive).toBe(0);
    expect(s.falsePositive).toBe(0);
    expect(s.adjudicated).toBe(0);
    expect(s.unadjudicated).toBe(3);
    expect(s.botAutoResolved).toBe(3);
  });

  test("human-resolved threads ALSO count as zero until adjudicated", () => {
    // The weaker cousin of the trap: a maintainer resolving a thread to unblock a merge
    // says nothing about whether the finding was real.
    const l = ledgerOf([entry({ threadResolved: true, resolvedBy: "AceHack" })]);
    const s = summarize(l);
    expect(s.adjudicated).toBe(0);
    expect(s.humanResolved).toBe(1);
  });

  test("an UNRESOLVED thread can still be adjudicated true-positive", () => {
    // The inverse direction of the same independence: resolution and disposition are
    // orthogonal, so the split must be readable off an open thread too.
    const l = ledgerOf([
      entry({
        threadResolved: false,
        disposition: "true-positive",
        evidenceKind: "measured",
        evidence: "https://example.invalid/e",
        adjudicatedBy: "otto",
      }),
    ]);
    expect(summarize(l).truePositive).toBe(1);
  });

  test("falsePositiveRate is null — never 0 — when nothing is adjudicated", () => {
    // FALSIFIER: a 0 here reads as "no false positives found", which is the opposite of
    // "no measurement exists". Returning 0/0 as 0 is the vacuity class in one line.
    expect(summarize(ledgerOf([entry(), entry({ pr: 2 })])).falsePositiveRate).toBeNull();
  });

  test("computes the rate over adjudicated entries only", () => {
    const adj = (pr: number, d: "true-positive" | "false-positive") =>
      entry({
        pr,
        disposition: d,
        evidenceKind: "measured",
        evidence: "https://example.invalid/e",
        adjudicatedBy: "otto",
      });
    const l = ledgerOf([adj(1, "false-positive"), adj(2, "false-positive"), adj(3, "true-positive"), entry({ pr: 4 })]);
    const s = summarize(l);
    expect(s.adjudicated).toBe(3);
    expect(s.unadjudicated).toBe(1);
    expect(s.falsePositiveRate).toBeCloseTo(2 / 3, 10);
  });

  test("measured and inferred adjudications are counted separately, not pooled", () => {
    // FALSIFIER: an inference from "the code later changed" is the resolution shortcut in
    // a second disguise. Pooling it with a planted-defect experiment launders a guess
    // into a measurement.
    const mk = (pr: number, k: "measured" | "inferred") =>
      entry({
        pr,
        disposition: "true-positive",
        evidenceKind: k,
        evidence: "https://example.invalid/e",
        adjudicatedBy: "otto",
      });
    const s = summarize(ledgerOf([mk(1, "measured"), mk(2, "inferred"), mk(3, "inferred")]));
    expect(s.measuredAdjudications).toBe(1);
    expect(s.inferredAdjudications).toBe(2);
  });

  test("singleFrameDraw is true for one sampling frame and false for two", () => {
    // FALSIFIER: this flag is what forces the caveat into the report. Hard-coding it
    // false hides that the rate came from a biased draw; hard-coding it true cries wolf
    // once a systematic sample exists.
    const mk = (pr: number, frame: "blocked-a-merge" | "systematic-sweep") =>
      entry({
        pr,
        disposition: "false-positive",
        evidenceKind: "measured",
        evidence: "https://example.invalid/e",
        adjudicatedBy: "otto",
        drawReason: frame,
      });
    expect(summarize(ledgerOf([mk(1, "blocked-a-merge"), mk(2, "blocked-a-merge")])).singleFrameDraw).toBe(true);
    expect(summarize(ledgerOf([mk(1, "blocked-a-merge"), mk(2, "systematic-sweep")])).singleFrameDraw).toBe(false);
  });

  test("singleFrameDraw is false when nothing is adjudicated (no frame to be biased by)", () => {
    expect(summarize(ledgerOf([entry()])).singleFrameDraw).toBe(false);
  });

  test("byRule splits per rule title", () => {
    const mk = (pr: number, rule: string, d: "true-positive" | "false-positive") =>
      entry({
        pr,
        rule,
        disposition: d,
        evidenceKind: "measured",
        evidence: "https://example.invalid/e",
        adjudicatedBy: "otto",
      });
    const s = summarize(ledgerOf([mk(1, "A", "false-positive"), mk(2, "A", "false-positive"), mk(3, "B", "true-positive")]));
    expect(s.byRule["A"]).toEqual({ truePositive: 0, falsePositive: 2, unadjudicated: 0 });
    expect(s.byRule["B"]).toEqual({ truePositive: 1, falsePositive: 0, unadjudicated: 0 });
  });
});

// ---------------------------------------------------------------------------
// validateLedger — the refusals
// ---------------------------------------------------------------------------

describe("validateLedger", () => {
  test("accepts a well-formed ledger", () => {
    expect(validateLedger(ledgerOf([entry()]))).toEqual([]);
  });

  test("REFUSES a disposition with evidenceKind none", () => {
    // FALSIFIER: an unwitnessed verdict is the thing `ledger/measure.ts` refuses, and the
    // thing this repo calls the vacuity class. Without this check the ledger would accept
    // "false-positive, because I said so".
    //
    // The entry deliberately CARRIES a pointer. The first draft left `evidence: null` too,
    // so the pointer refusal also fired and the loose assertion `includes("no evidence")`
    // matched the *other* rule's message "…no evidence pointer…" — the check passed with
    // this refusal deleted. Caught by mutation M12. One fixture must trip exactly one rule,
    // and the assertion pins that rule's exact wording.
    const p = validateLedger(
      ledgerOf([
        entry({
          disposition: "false-positive",
          evidenceKind: "none",
          evidence: "https://example.invalid/e",
          adjudicatedBy: "otto",
        }),
      ]),
    );
    expect(p.some((x) => x.includes("with no evidence — refused"))).toBe(true);
  });

  test("REFUSES a disposition with no evidence POINTER even when evidenceKind is set", () => {
    const p = validateLedger(
      ledgerOf([
        entry({ disposition: "true-positive", evidenceKind: "measured", evidence: null, adjudicatedBy: "otto" }),
      ]),
    );
    expect(p.some((x) => x.includes("no evidence pointer"))).toBe(true);
  });

  test("REFUSES an adjudication with no named adjudicator", () => {
    const p = validateLedger(
      ledgerOf([
        entry({
          disposition: "true-positive",
          evidenceKind: "measured",
          evidence: "https://example.invalid/e",
          adjudicatedBy: null,
        }),
      ]),
    );
    expect(p.some((x) => x.includes("adjudicator"))).toBe(true);
  });

  test("REFUSES an unadjudicated entry that claims evidence", () => {
    const p = validateLedger(ledgerOf([entry({ evidenceKind: "measured" })]));
    expect(p.some((x) => x.includes("unadjudicated but claims"))).toBe(true);
  });

  test("REFUSES duplicate keys", () => {
    // FALSIFIER: duplicates are how a denominator silently inflates.
    const e = entry();
    const p = validateLedger(ledgerOf([e, { ...e }]));
    expect(p.some((x) => x.includes("duplicate key"))).toBe(true);
  });

  test("REFUSES a key that disagrees with its own fields", () => {
    // FALSIFIER: a hand-edited row whose key no longer matches its path/line would defeat
    // the upsert and re-add itself on the next fetch.
    const p = validateLedger(ledgerOf([entry({ key: "999:wrong.ts:1:Rule" })]));
    expect(p.some((x) => x.includes("does not match its own fields"))).toBe(true);
  });

  test("REFUSES a wrong schemaVersion", () => {
    const l = ledgerOf([entry()]);
    l.schemaVersion = 99;
    expect(validateLedger(l).some((x) => x.includes("schemaVersion"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renderHuman
// ---------------------------------------------------------------------------

describe("renderHuman", () => {
  const biased = ledgerOf([
    entry({
      pr: 1,
      disposition: "false-positive",
      evidenceKind: "measured",
      evidence: "https://example.invalid/e",
      adjudicatedBy: "otto",
      drawReason: "blocked-a-merge",
    }),
  ]);

  test("prints the sampling caveat when the draw came from one frame", () => {
    // FALSIFIER: without it the report hands over a bare percentage, which is precisely
    // the "16/18 is the analyzer's rate" error this meter exists to prevent.
    expect(renderHuman(summarize(biased), biased, [])).toContain(BIAS_CAVEAT);
  });

  test("names the frame the draw came from", () => {
    expect(renderHuman(summarize(biased), biased, [])).toContain("blocked-a-merge");
  });

  test("drops the caveat once a second frame exists", () => {
    const mixed = ledgerOf([
      biased.entries[0]!,
      entry({
        pr: 2,
        disposition: "true-positive",
        evidenceKind: "measured",
        evidence: "https://example.invalid/e",
        adjudicatedBy: "otto",
        drawReason: "systematic-sweep",
      }),
    ]);
    expect(renderHuman(summarize(mixed), mixed, [])).not.toContain(BIAS_CAVEAT);
  });

  test("says NOTHING ADJUDICATED rather than printing a 0% rate", () => {
    const l = ledgerOf([entry()]);
    const out = renderHuman(summarize(l), l, []);
    expect(out).toContain("NOTHING ADJUDICATED YET");
    expect(out).not.toContain("FP rate");
  });

  test("states that resolution is not used in the split", () => {
    // FALSIFIER: the report shows the resolution counts; a reader who is not told they
    // are excluded will read them as the measurement.
    expect(renderHuman(summarize(biased), biased, [])).toContain("NOT used in the split");
  });

  test("surfaces validation problems in the report", () => {
    expect(renderHuman(summarize(biased), biased, ["boom"])).toContain("boom");
  });
});

// ---------------------------------------------------------------------------
// parsePrArgs
// ---------------------------------------------------------------------------

describe("parsePrArgs", () => {
  test("parses repeated and comma-joined --pr flags", () => {
    expect(parsePrArgs(["--pr", "1,2", "--pr", "3"])).toEqual([1, 2, 3]);
  });

  test("ignores junk rather than producing NaN PR numbers", () => {
    expect(parsePrArgs(["--pr", "abc,-4,0,7"])).toEqual([7]);
    expect(parsePrArgs(["--pr"])).toEqual([]);
    expect(parsePrArgs([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fetchFindings with an injected runner (no network)
// ---------------------------------------------------------------------------

describe("fetchFindings", () => {
  test("queries each PR once and concatenates", () => {
    const seen: number[] = [];
    const got = fetchFindings([11, 22], (n) => {
      seen.push(n);
      return payload([thread({})], n);
    });
    expect(seen).toEqual([11, 22]);
    expect(got.map((f) => f.pr)).toEqual([11, 22]);
  });
});

// ---------------------------------------------------------------------------
// main — exit codes, and the it-is-not-a-gate property
// ---------------------------------------------------------------------------

describe("main", () => {
  let dir: string;
  const savedPath = process.env["ANALYZER_LEDGER_PATH"];
  const savedRoot = process.env["REPO_ROOT"];

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "cq-ledger-"));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    if (savedPath === undefined) delete process.env["ANALYZER_LEDGER_PATH"];
    else process.env["ANALYZER_LEDGER_PATH"] = savedPath;
    if (savedRoot === undefined) delete process.env["REPO_ROOT"];
    else process.env["REPO_ROOT"] = savedRoot;
  });

  function withLedger(l: Ledger | string, name: string): void {
    const p = join(dir, name);
    writeFileSync(p, typeof l === "string" ? l : JSON.stringify(l, null, 2), "utf8");
    process.env["REPO_ROOT"] = dir;
    process.env["ANALYZER_LEDGER_PATH"] = name;
  }

  const neverCalled = (): unknown => {
    throw new Error("runner must not be called without --fetch");
  };

  test("exit 2 when the ledger is missing", () => {
    process.env["REPO_ROOT"] = dir;
    process.env["ANALYZER_LEDGER_PATH"] = "does-not-exist.json";
    expect(main([], neverCalled)).toBe(2);
  });

  test("exit 2 when the ledger is unparseable", () => {
    withLedger("{not json", "broken.json");
    expect(main([], neverCalled)).toBe(2);
  });

  test("exit 2 when the ledger is internally inconsistent", () => {
    withLedger(ledgerOf([entry({ disposition: "false-positive", adjudicatedBy: "otto" })]), "bad.json");
    expect(main([], neverCalled)).toBe(2);
  });

  test("exit 0 on a valid ledger", () => {
    withLedger(ledgerOf([entry()]), "ok.json");
    expect(main([], neverCalled)).toBe(0);
    expect(main(["--json"], neverCalled)).toBe(0);
  });

  test("exit 2 when --fetch is given no --pr", () => {
    withLedger(ledgerOf([entry()]), "ok2.json");
    expect(main(["--fetch"], neverCalled)).toBe(2);
  });

  test("exit 2 when the fetch itself fails", () => {
    withLedger(ledgerOf([entry()]), "ok3.json");
    expect(
      main(["--fetch", "--pr", "1"], () => {
        throw new Error("gh exploded");
      }),
    ).toBe(2);
  });

  test("IT IS NOT A GATE: a ledger that is 100% false positives still exits 0", () => {
    // FALSIFIER — the maintainer has not decided the policy, so no split may fail a
    // build. If someone later wires `return split.falsePositive > 0 ? 1 : 0`, this test
    // is what stops it. There is no argv and no ledger content that makes this exit 1.
    const allFalse = ledgerOf(
      [1, 2, 3].map((pr) =>
        entry({
          pr,
          disposition: "false-positive",
          evidenceKind: "measured",
          evidence: "https://example.invalid/e",
          adjudicatedBy: "otto",
        }),
      ),
    );
    withLedger(allFalse, "allfalse.json");
    expect(main([], neverCalled)).toBe(0);
    expect(main(["--json"], neverCalled)).toBe(0);
  });

  test("--fetch without --write leaves the ledger file untouched", () => {
    withLedger(ledgerOf([]), "dry.json");
    const before = loadLedger(join(dir, "dry.json"));
    expect(main(["--fetch", "--pr", "1"], () => payload([thread({})]))).toBe(0);
    const after = loadLedger(join(dir, "dry.json"));
    expect(after.entries).toHaveLength(before.entries.length);
  });

  test("--fetch --write persists, and re-running adds nothing (idempotent on disk)", () => {
    withLedger(ledgerOf([]), "wet.json");
    const run = () => payload([thread({})]);
    expect(main(["--fetch", "--pr", "1", "--write"], run)).toBe(0);
    expect(loadLedger(join(dir, "wet.json")).entries).toHaveLength(1);
    expect(main(["--fetch", "--pr", "1", "--write"], run)).toBe(0);
    expect(loadLedger(join(dir, "wet.json")).entries).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// The SHIPPED ledger — these assert facts about the real file, not a fixture
// ---------------------------------------------------------------------------

describe("the shipped ledger", () => {
  const shipped = loadLedger(join(repoRoot(), LEDGER_PATH));

  test("validates", () => {
    expect(validateLedger(shipped)).toEqual([]);
  });

  test("every adjudicated entry carries a real GitHub discussion permalink", () => {
    // FALSIFIER: `validateLedger` only checks a pointer is non-empty. This checks it
    // points at the review comment that actually adjudicated the finding — a citation
    // that does not resolve is the uncited claim wearing a URL.
    for (const e of shipped.entries) {
      if (e.disposition === "unadjudicated") continue;
      expect(e.evidence).toMatch(
        /^https:\/\/github\.com\/Lucent-Financial-Group\/Zeta\/pull\/\d+#discussion_r\d+$/,
      );
      expect(e.evidence).toContain(`/pull/${e.pr}#`);
    }
  });

  test("the census records its own known gaps rather than claiming completeness", () => {
    // FALSIFIER: "a partial census reported as complete" is the failure this repo cares
    // most about. An empty knownGaps array is that failure.
    expect(shipped.census.knownGaps.length).toBeGreaterThan(0);
  });

  test("the ledger is a SUBSET of the census, and says so by the numbers", () => {
    expect(shipped.entries.length).toBeLessThanOrEqual(shipped.census.threadsEnumerated);
    expect(shipped.census.threadsEnumerated).toBe(269);
  });

  test("the seeded split is 2 true-positive / 15 false-positive", () => {
    const s = summarize(shipped);
    expect(s.truePositive).toBe(2);
    expect(s.falsePositive).toBe(15);
    expect(s.adjudicated).toBe(17);
  });

  test("every seeded adjudication is MEASURED, none inferred", () => {
    const s = summarize(shipped);
    expect(s.measuredAdjudications).toBe(17);
    expect(s.inferredAdjudications).toBe(0);
  });

  test("the seed is a single-frame draw, so the report must carry the caveat", () => {
    // FALSIFIER: this is the honest-reporting property stated about the SHIPPED numbers,
    // not a fixture. If someone re-labels the seed's drawReason to make the caveat go
    // away without adjudicating a systematic sample, this fails.
    const s = summarize(shipped);
    expect(s.singleFrameDraw).toBe(true);
    expect(s.drawReasons["blocked-a-merge"]).toBe(17);
    expect(renderHuman(s, shipped, [])).toContain(BIAS_CAVEAT);
  });

  test("the note records the 17-vs-18 discrepancy instead of inventing an 18th entry", () => {
    // FALSIFIER: the brief said 18 findings (16 false / 2 real); the itemisation and the
    // API both say 17 (15 / 2). Padding the ledger to 18 would have closed the arithmetic
    // and corrupted the measurement. This pins the honest choice.
    expect(shipped.note).toContain("17");
    expect(shipped.note).toContain("18");
  });
});
