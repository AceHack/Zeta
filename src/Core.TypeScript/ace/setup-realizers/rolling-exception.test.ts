// Falsifiers for the declared rolling auto-accept exception.
//
// WHAT A TEST HERE HAS TO BE ABLE TO PROVE. This mechanism DECLINES a security
// check, so a green suite is worth nothing unless the refusals are the part
// under test. Every permissive path below is paired with the refusal it is
// supposed to be one hair away from, and the mutation log names which line each
// mutant changed.
//
// ── MUTATION LOG (2026-09-09) — 18 mutants applied, 17 killed, 1 DISCLOSED ───
//
// Applied to rolling-exception.ts one at a time, `bun test` after each:
//
//  M1  activeExceptionFor: `row.accept !== "auto"` -> `row.accept === "never"`
//      KILLED — "refuses an unknown accept= mode"
//  M2  activeExceptionFor: drop the expiry comparison entirely
//      KILLED — "an EXPIRED exception is inert"
//  M3  activeExceptionFor: `daysBetween(today, expires) < 0` -> `<= 0`
//      KILLED — "an exception expiring TODAY is still live"
//  M4  activeExceptionFor: `matches.length !== 1` -> `matches.length === 0`
//      KILLED — "two rows for one dest refuse BOTH"
//  M5  activeExceptionFor: `row.dest === dest` -> `dest.startsWith(row.dest)`
//      KILLED — "a wildcard row matches only the literal dest"
//  M6  decideRollingAccept: accept when exception is null
//      KILLED — "no exception ⇒ the unchanged rollingRemedy, fail closed"
//  M7  decideRollingAccept: verdict `run.ok ? "pass" : "fail"` -> always "pass"
//      KILLED — "a FAILED verify refuses the bytes"
//  M8  decideRollingAccept: skip appendRecord on the refusal path
//      KILLED — "the refusal is recorded too"
//  M9  decideRollingAccept: outcome `verdict === "fail"` -> `verdict === "not-run"`
//      KILLED — "verify=deferred accepts and records verdict=not-run"
// M10  verifyArgv: treat "deferred" as an argv
//      KILLED — "verify=deferred runs nothing"
// M11  appendAcceptanceRecord: drop the dedup scan (always append)
//      KILLED — "re-recording the same acceptance is idempotent"
// M12  isCalendarDate: drop the round-trip check (regex only)
//      KILLED — "2026-02-31 is not a calendar date"
// M13  appendAcceptanceRecord: header write `wx` -> plain write (re-stamps)
//      KILLED — "the header is stamped ONCE, not once per acceptance" and
//               "an existing ledger is APPENDED to, never truncated"
// M14  appendAcceptanceRecord: swallow every header-write error, not just EEXIST
//      **SURVIVED — disclosed rather than dressed up.** No test kills it, and
//      after trying I believe none can: every non-EEXIST failure of the header
//      write (EACCES, EISDIR, EROFS) resurfaces immediately at the `readFileSync`
//      or the `appendFileSync` on the same path, so swallowing it changes WHICH
//      error is reported, not WHETHER one is. The discrimination is kept because
//      "unknown is not absent" is the right disposition and the reported error is
//      the accurate one -- but by this repo's own standard a line no test can
//      kill is near the vacuity class, and saying so is better than a green tick
//      that would be a lie. If someone finds the killer, delete this note.
//
// M15  foldAcceptanceRecords: return `rows` unfolded
//      KILLED — "two racing writers' duplicate lines fold to ONE fact"
// M16  foldAcceptanceRecords: identity = dest only (folds everything together)
//      KILLED — "DIFFERENT facts are NOT folded together"
// M17  foldAcceptanceRecords: keep the LATEST clock instead of the earliest
//      KILLED — "the EARLIEST clock survives the fold"
// M18  readAcceptanceLedger: return raw rows without folding
//      KILLED — "duplicates that BYPASS the write-side scan still fold on read"
//
// ── DECLARED CONTROLS — these MUST SURVIVE every mutant above ────────────────
//
//  C1  "an active exception parses its fields"     — pure parsing, no policy
//  C2  "the banner names both digests"             — formatting, no decision
//
// If a control ever dies, the mutant reached further than its log entry claims
// and the entry is wrong. Controls are marked `CONTROL:` in their names.

import { describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ACCEPTS_LEDGER,
  MAX_EXCEPTION_DAYS,
  acceptBanner,
  acceptanceRecordLine,
  activeExceptionFor,
  appendAcceptanceRecord,
  daysBetween,
  decideRollingAccept,
  foldAcceptanceRecords,
  isCalendarDate,
  loadRollingExceptions,
  parseAcceptanceLedger,
  parseRollingExceptions,
  readAcceptanceLedger,
  rollingRemedy,
  verifyArgv,
  type AcceptEffects,
  type RollingException,
} from "./rolling-exception.ts";

const DEST = "src/Core.TLA/tla2tools.jar";
const PINNED = "a".repeat(64);
const FETCHED = "b".repeat(64);

const LIVE_ROW =
  `${DEST}  accept=auto  verify=deferred  declared=2026-09-09  expires=2026-12-08` +
  "  exitcheck=src/x.ts  tradeoff=docs/y.md";

function rows(text: string): readonly RollingException[] {
  return parseRollingExceptions(text);
}

function recordingEffects(): { effects: AcceptEffects; written: string[]; ran: string[][] } {
  const written: string[] = [];
  const ran: string[][] = [];
  return {
    written,
    ran,
    effects: {
      runVerify: (argv) => {
        ran.push([...argv]);
        return { ok: true, transcript: "ok\n" };
      },
      appendRecord: (line) => written.push(line),
      nowIso: () => "2026-09-09T00:00:00.000Z",
    },
  };
}

describe("parsing", () => {
  test("CONTROL: an active exception parses its fields", () => {
    const parsed = rows(LIVE_ROW);
    expect(parsed).toHaveLength(1);
    const row = parsed[0] as RollingException;
    expect(row.dest).toBe(DEST);
    expect(row.accept).toBe("auto");
    expect(row.verify).toBe("deferred");
    expect(row.declared).toBe("2026-09-09");
    expect(row.expires).toBe("2026-12-08");
    expect(row.exitcheck).toBe("src/x.ts");
    expect(row.tradeoff).toBe("docs/y.md");
    expect(row.line).toBe(1);
  });

  test("comments and blank lines are not rows", () => {
    expect(rows("# a comment\n\n   \n")).toHaveLength(0);
  });

  test("a row reports its 1-based line so a finding can name a place", () => {
    const parsed = rows("# header\n# more\n" + LIVE_ROW);
    expect((parsed[0] as RollingException).line).toBe(3);
  });
});

describe("dates", () => {
  test("2026-02-31 is not a calendar date", () => {
    expect(isCalendarDate("2026-02-31")).toBe(false);
    expect(isCalendarDate("2026-02-28")).toBe(true);
  });

  test("shapes that are not YYYY-MM-DD are refused", () => {
    for (const bad of ["", "2026-9-9", "20260909", "next-tuesday", "2026-12-08T00:00:00Z"]) {
      expect(isCalendarDate(bad)).toBe(false);
    }
  });

  test("daysBetween is signed", () => {
    expect(daysBetween("2026-09-09", "2026-12-08")).toBe(90);
    expect(daysBetween("2026-12-08", "2026-09-09")).toBe(-90);
    expect(daysBetween("2026-09-09", "2026-09-09")).toBe(0);
  });

  test("the ceiling is exactly the window this repo's one row uses", () => {
    expect(daysBetween("2026-09-09", "2026-12-08")).toBe(MAX_EXCEPTION_DAYS);
  });
});

describe("activeExceptionFor — the only function that can widen the hole", () => {
  test("a live row for the exact dest is returned", () => {
    expect(activeExceptionFor(rows(LIVE_ROW), DEST, "2026-09-09")).not.toBeNull();
  });

  test("an EXPIRED exception is inert", () => {
    expect(activeExceptionFor(rows(LIVE_ROW), DEST, "2026-12-09")).toBeNull();
  });

  test("an exception expiring TODAY is still live", () => {
    expect(activeExceptionFor(rows(LIVE_ROW), DEST, "2026-12-08")).not.toBeNull();
  });

  test("refuses an unknown accept= mode", () => {
    const row = LIVE_ROW.replace("accept=auto", "accept=always");
    expect(activeExceptionFor(rows(row), DEST, "2026-09-09")).toBeNull();
  });

  test("refuses a row with no accept= at all", () => {
    const row = LIVE_ROW.replace("accept=auto  ", "");
    expect(activeExceptionFor(rows(row), DEST, "2026-09-09")).toBeNull();
  });

  test("refuses a malformed expires=", () => {
    const row = LIVE_ROW.replace("expires=2026-12-08", "expires=whenever");
    expect(activeExceptionFor(rows(row), DEST, "2026-09-09")).toBeNull();
  });

  test("refuses a row with no expires= at all", () => {
    const row = LIVE_ROW.replace("  expires=2026-12-08", "");
    expect(activeExceptionFor(rows(row), DEST, "2026-09-09")).toBeNull();
  });

  test("a malformed TODAY is an unanswerable question, not a yes", () => {
    expect(activeExceptionFor(rows(LIVE_ROW), DEST, "not-a-date")).toBeNull();
  });

  test("a wildcard row matches only the literal dest", () => {
    const wild = "*  accept=auto  verify=deferred  declared=2026-09-09  expires=2026-12-08";
    expect(activeExceptionFor(rows(wild), DEST, "2026-09-09")).toBeNull();
    expect(activeExceptionFor(rows(wild), "*", "2026-09-09")).not.toBeNull();
  });

  test("a prefix of a declared dest does NOT inherit its exception", () => {
    const parsed = rows("src/  accept=auto  verify=deferred  declared=2026-09-09  expires=2026-12-08");
    expect(activeExceptionFor(parsed, DEST, "2026-09-09")).toBeNull();
  });

  test("two rows for one dest refuse BOTH", () => {
    const parsed = rows(LIVE_ROW + "\n" + LIVE_ROW);
    expect(parsed).toHaveLength(2);
    expect(activeExceptionFor(parsed, DEST, "2026-09-09")).toBeNull();
  });

  test("an unrelated dest gets nothing", () => {
    expect(activeExceptionFor(rows(LIVE_ROW), "src/Core.Alloy/alloy.jar", "2026-09-09")).toBeNull();
  });
});

describe("verifyArgv", () => {
  test("verify=deferred runs nothing", () => {
    expect(verifyArgv("deferred")).toBeNull();
  });

  test("null and empty run nothing", () => {
    expect(verifyArgv(null)).toBeNull();
    expect(verifyArgv("")).toBeNull();
    expect(verifyArgv("::")).toBeNull();
  });

  test("a colon-encoded argv splits", () => {
    expect(verifyArgv("a/b.ts:--all:--fast")).toEqual(["a/b.ts", "--all", "--fast"]);
  });
});

describe("decideRollingAccept", () => {
  test("no exception ⇒ the unchanged rollingRemedy, fail closed", () => {
    const { effects, written } = recordingEffects();
    const decision = decideRollingAccept(
      { dest: DEST, rolling: "tag", pinned: PINNED, fetched: FETCHED, exception: null },
      effects,
    );
    expect(decision.accepted).toBe(false);
    expect(decision.message).toBe(rollingRemedy(DEST, PINNED, FETCHED, "tag"));
    // Nothing happened, so nothing is recorded: a record of a non-event would
    // make the ledger's own count meaningless.
    expect(written).toHaveLength(0);
  });

  test("verify=deferred accepts and records verdict=not-run", () => {
    const { effects, written, ran } = recordingEffects();
    const exception = activeExceptionFor(rows(LIVE_ROW), DEST, "2026-09-09");
    const decision = decideRollingAccept(
      { dest: DEST, rolling: "tag", pinned: PINNED, fetched: FETCHED, exception },
      effects,
    );
    expect(decision.accepted).toBe(true);
    expect(ran).toHaveLength(0);
    expect(written).toHaveLength(1);
    expect(written[0]).toContain("verdict=not-run");
    expect(written[0]).toContain("outcome=accepted");
    // The honest-value guard: a deferred verification must never read as a pass.
    expect(written[0]).not.toContain("verdict=pass");
  });

  test("a declared verify= is RUN, and a pass accepts", () => {
    const { effects, written, ran } = recordingEffects();
    const row = LIVE_ROW.replace("verify=deferred", "verify=tools/x.ts:--all");
    const exception = activeExceptionFor(rows(row), DEST, "2026-09-09");
    const decision = decideRollingAccept(
      { dest: DEST, rolling: "tag", pinned: PINNED, fetched: FETCHED, exception },
      effects,
    );
    expect(decision.accepted).toBe(true);
    expect(ran).toEqual([["tools/x.ts", "--all"]]);
    expect(written[0]).toContain("verdict=pass");
  });

  test("a FAILED verify refuses the bytes", () => {
    const written: string[] = [];
    const effects: AcceptEffects = {
      runVerify: () => ({ ok: false, transcript: "model X disagreed\n" }),
      appendRecord: (line) => written.push(line),
      nowIso: () => "2026-09-09T00:00:00.000Z",
    };
    const row = LIVE_ROW.replace("verify=deferred", "verify=tools/x.ts");
    const exception = activeExceptionFor(rows(row), DEST, "2026-09-09");
    const decision = decideRollingAccept(
      { dest: DEST, rolling: "tag", pinned: PINNED, fetched: FETCHED, exception },
      effects,
    );
    expect(decision.accepted).toBe(false);
    expect(decision.message).toContain("FAILED");
    expect(decision.message).toContain("model X disagreed");
  });

  test("the refusal is recorded too", () => {
    const written: string[] = [];
    const effects: AcceptEffects = {
      runVerify: () => ({ ok: false, transcript: "" }),
      appendRecord: (line) => written.push(line),
      nowIso: () => "2026-09-09T00:00:00.000Z",
    };
    const row = LIVE_ROW.replace("verify=deferred", "verify=tools/x.ts");
    const exception = activeExceptionFor(rows(row), DEST, "2026-09-09");
    decideRollingAccept(
      { dest: DEST, rolling: "tag", pinned: PINNED, fetched: FETCHED, exception },
      effects,
    );
    expect(written).toHaveLength(1);
    expect(written[0]).toContain("verdict=fail");
    expect(written[0]).toContain("outcome=refused");
  });

  test("an expired exception reaches decideRollingAccept as null and fails closed", () => {
    const { effects } = recordingEffects();
    const exception = activeExceptionFor(rows(LIVE_ROW), DEST, "2027-01-01");
    const decision = decideRollingAccept(
      { dest: DEST, rolling: "tag", pinned: PINNED, fetched: FETCHED, exception },
      effects,
    );
    expect(decision.accepted).toBe(false);
  });
});

describe("the acceptance record", () => {
  test("carries both digests, the verdict and the outcome", () => {
    const line = acceptanceRecordLine({
      dest: DEST,
      from: PINNED,
      to: FETCHED,
      when: "2026-09-09T12:00:00.000Z",
      verify: "deferred",
      verdict: "not-run",
      outcome: "accepted",
      expires: "2026-12-08",
    });
    expect(line).toContain("from=" + PINNED);
    expect(line).toContain("to=" + FETCHED);
    expect(line).toContain("verdict=not-run");
    expect(line).toContain("outcome=accepted");
    expect(line).toContain("expires=2026-12-08");
  });

  test("re-recording the same acceptance is idempotent", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-accepts-"));
    const first = acceptanceRecordLine({
      dest: DEST, from: PINNED, to: FETCHED, when: "2026-09-09T12:00:00.000Z",
      verify: "deferred", verdict: "not-run", outcome: "accepted", expires: "2026-12-08",
    });
    const laterClock = acceptanceRecordLine({
      dest: DEST, from: PINNED, to: FETCHED, when: "2026-09-10T09:00:00.000Z",
      verify: "deferred", verdict: "not-run", outcome: "accepted", expires: "2026-12-08",
    });
    expect(appendAcceptanceRecord(root, first)).toBe(true);
    // Same fact, different clock: already recorded.
    expect(appendAcceptanceRecord(root, laterClock)).toBe(false);
    const text = readFileSync(join(root, ACCEPTS_LEDGER), "utf8");
    const dataLines = text.split("\n").filter((l) => l.trim() !== "" && !l.startsWith("#"));
    expect(dataLines).toHaveLength(1);
  });

  test("a DIFFERENT acceptance is appended, not swallowed", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-accepts-"));
    const base = {
      dest: DEST, from: PINNED, when: "2026-09-09T12:00:00.000Z",
      verify: "deferred", verdict: "not-run" as const, outcome: "accepted" as const,
      expires: "2026-12-08",
    };
    expect(appendAcceptanceRecord(root, acceptanceRecordLine({ ...base, to: FETCHED }))).toBe(true);
    expect(appendAcceptanceRecord(root, acceptanceRecordLine({ ...base, to: "c".repeat(64) }))).toBe(true);
    const text = readFileSync(join(root, ACCEPTS_LEDGER), "utf8");
    const dataLines = text.split("\n").filter((l) => l.trim() !== "" && !l.startsWith("#"));
    expect(dataLines).toHaveLength(2);
  });

  test("the header is stamped ONCE, not once per acceptance", () => {
    // The header is created with an atomic `wx` create-if-absent rather than an
    // existence check followed by a write. Two acceptances (and, on a shared CI
    // runner, two concurrent writers) must not each stamp one.
    const root = mkdtempSync(join(tmpdir(), "zeta-accepts-"));
    const base = {
      dest: DEST, from: PINNED, when: "2026-09-09T12:00:00.000Z",
      verify: "deferred", verdict: "not-run" as const, outcome: "accepted" as const,
      expires: "2026-12-08",
    };
    appendAcceptanceRecord(root, acceptanceRecordLine({ ...base, to: FETCHED }));
    appendAcceptanceRecord(root, acceptanceRecordLine({ ...base, to: "c".repeat(64) }));
    const text = readFileSync(join(root, ACCEPTS_LEDGER), "utf8");
    const headers = text.split("\n").filter((l) => l.includes("NOT A RE-MEASURE RECEIPT"));
    expect(headers).toHaveLength(1);
  });

  test("an existing ledger is APPENDED to, never truncated", () => {
    // The `wx` create must not clobber a ledger that already holds records --
    // this file is the audit trail for a declined security check, so losing a
    // row is losing the only evidence that the decline happened.
    const root = mkdtempSync(join(tmpdir(), "zeta-accepts-"));
    const base = {
      dest: DEST, from: PINNED, when: "2026-09-09T12:00:00.000Z",
      verify: "deferred", verdict: "not-run" as const, outcome: "accepted" as const,
      expires: "2026-12-08",
    };
    appendAcceptanceRecord(root, acceptanceRecordLine({ ...base, to: FETCHED }));
    appendAcceptanceRecord(root, acceptanceRecordLine({ ...base, to: "d".repeat(64) }));
    const text = readFileSync(join(root, ACCEPTS_LEDGER), "utf8");
    expect(text).toContain("to=" + FETCHED);
    expect(text).toContain("to=" + "d".repeat(64));
  });

  test("the ledger is created with a header that says it is NOT a receipt", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-accepts-"));
    appendAcceptanceRecord(root, acceptanceRecordLine({
      dest: DEST, from: PINNED, to: FETCHED, when: "2026-09-09T12:00:00.000Z",
      verify: "deferred", verdict: "not-run", outcome: "accepted", expires: "2026-12-08",
    }));
    const text = readFileSync(join(root, ACCEPTS_LEDGER), "utf8");
    expect(text).toContain("NOT A RE-MEASURE RECEIPT");
  });
});

describe("the read-side fold — where idempotency actually lives", () => {
  const row = (to: string, when: string): string =>
    acceptanceRecordLine({
      dest: DEST, from: PINNED, to, when,
      verify: "deferred", verdict: "not-run", outcome: "accepted", expires: "2026-12-08",
    });

  test("two racing writers' duplicate lines fold to ONE fact", () => {
    // This is the property that lets the write path stay lock-free: the
    // duplicate is not prevented, it is made harmless.
    const rows = parseAcceptanceLedger(
      row(FETCHED, "2026-09-09T12:00:00.000Z") + "\n" + row(FETCHED, "2026-09-09T12:00:00.900Z"),
    );
    expect(rows).toHaveLength(2);
    const folded = foldAcceptanceRecords(rows);
    expect(folded).toHaveLength(1);
    expect((folded[0] as { occurrences: number }).occurrences).toBe(2);
  });

  test("the EARLIEST clock survives the fold", () => {
    const folded = foldAcceptanceRecords(
      parseAcceptanceLedger(
        row(FETCHED, "2026-09-09T18:00:00.000Z") + "\n" + row(FETCHED, "2026-09-09T09:00:00.000Z"),
      ),
    );
    expect((folded[0] as { when: string | null }).when).toBe("2026-09-09T09:00:00.000Z");
  });

  test("fold(fold(x)) === fold(x) — the fold is idempotent", () => {
    // `f(f(x)) = f(x)`, discipline #6 stated as the algebra rather than as a
    // promise about writers. A second fold must be the identity on records.
    const once = foldAcceptanceRecords(
      parseAcceptanceLedger(
        row(FETCHED, "2026-09-09T12:00:00.000Z") + "\n" +
        row(FETCHED, "2026-09-09T12:00:00.900Z") + "\n" +
        row("c".repeat(64), "2026-09-09T13:00:00.000Z"),
      ),
    );
    const twice = foldAcceptanceRecords(once);
    expect(twice).toEqual(once);
  });

  test("DIFFERENT facts are NOT folded together", () => {
    // The control on the fold: collapsing everything would be a fold that
    // cannot fail, and it would erase the second acceptance entirely.
    const folded = foldAcceptanceRecords(
      parseAcceptanceLedger(
        row(FETCHED, "2026-09-09T12:00:00.000Z") + "\n" + row("c".repeat(64), "2026-09-09T13:00:00.000Z"),
      ),
    );
    expect(folded).toHaveLength(2);
    expect(folded.every((r) => r.occurrences === 1)).toBe(true);
  });

  test("a differing VERDICT is a different fact and stays separate", () => {
    const accepted = row(FETCHED, "2026-09-09T12:00:00.000Z");
    const refused = acceptanceRecordLine({
      dest: DEST, from: PINNED, to: FETCHED, when: "2026-09-09T13:00:00.000Z",
      verify: "tools/x.ts", verdict: "fail", outcome: "refused", expires: "2026-12-08",
    });
    expect(foldAcceptanceRecords(parseAcceptanceLedger(accepted + "\n" + refused))).toHaveLength(2);
  });

  test("order is by FIRST appearance, so the ledger still reads chronologically", () => {
    const folded = foldAcceptanceRecords(
      parseAcceptanceLedger(
        row("c".repeat(64), "2026-09-09T13:00:00.000Z") + "\n" +
        row(FETCHED, "2026-09-09T12:00:00.000Z") + "\n" +
        row("c".repeat(64), "2026-09-09T14:00:00.000Z"),
      ),
    );
    expect(folded.map((r) => r.to)).toEqual(["c".repeat(64), FETCHED]);
  });

  test("comments and blanks are not records", () => {
    expect(parseAcceptanceLedger("# header\n\n   \n")).toHaveLength(0);
  });

  test("an ABSENT ledger reads as no acceptances, not a throw", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-noledger-"));
    expect(readAcceptanceLedger(root)).toHaveLength(0);
  });

  test("readAcceptanceLedger folds what appendAcceptanceRecord wrote", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-ledger-"));
    appendAcceptanceRecord(root, row(FETCHED, "2026-09-09T12:00:00.000Z"));
    appendAcceptanceRecord(root, row("c".repeat(64), "2026-09-09T13:00:00.000Z"));
    const read = readAcceptanceLedger(root);
    expect(read).toHaveLength(2);
    expect(read[0]?.dest).toBe(DEST);
  });

  test("duplicates that BYPASS the write-side scan still fold on read", () => {
    // Simulates the racing-writer case the scan cannot prevent: append the raw
    // line twice, straight to the file, as two concurrent O_APPEND writes would.
    const root = mkdtempSync(join(tmpdir(), "zeta-race-"));
    appendAcceptanceRecord(root, row(FETCHED, "2026-09-09T12:00:00.000Z"));
    appendFileSync(join(root, ACCEPTS_LEDGER), row(FETCHED, "2026-09-09T12:00:00.900Z") + "\n");
    const raw = parseAcceptanceLedger(readFileSync(join(root, ACCEPTS_LEDGER), "utf8"));
    expect(raw).toHaveLength(2);
    const read = readAcceptanceLedger(root);
    expect(read).toHaveLength(1);
    expect(read[0]?.occurrences).toBe(2);
  });
});

describe("loadRollingExceptions", () => {
  test("an ABSENT manifest is the strict state: no exceptions", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-noexc-"));
    expect(loadRollingExceptions(root)).toHaveLength(0);
  });

  test("a present manifest is parsed", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-exc-"));
    mkdirSync(join(root, "tools/setup/manifests"), { recursive: true });
    writeFileSync(join(root, "tools/setup/manifests/from-url-rolling-exceptions"), LIVE_ROW + "\n");
    expect(loadRollingExceptions(root)).toHaveLength(1);
  });
});

describe("the banner", () => {
  test("CONTROL: the banner names both digests", () => {
    const exception = activeExceptionFor(rows(LIVE_ROW), DEST, "2026-09-09") as RollingException;
    const banner = acceptBanner({
      dest: DEST, rolling: "tag", pinned: PINNED, fetched: FETCHED, exception, verdict: "not-run",
    });
    expect(banner).toContain(PINNED);
    expect(banner).toContain(FETCHED);
  });

  test("says the pin has NOT moved, which is the whole limit of the concession", () => {
    const exception = activeExceptionFor(rows(LIVE_ROW), DEST, "2026-09-09") as RollingException;
    const banner = acceptBanner({
      dest: DEST, rolling: "tag", pinned: PINNED, fetched: FETCHED, exception, verdict: "not-run",
    });
    expect(banner).toContain("THE PIN HAS NOT MOVED");
    expect(banner).toContain("repin-rolling.ts");
  });
});
