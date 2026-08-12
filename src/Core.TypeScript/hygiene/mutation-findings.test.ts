import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FINDINGS_DIR,
  alarmKeys,
  appendFinding,
  findingAddress,
  findingAgents,
  makeFinding,
  readAllFindings,
  readFindings,
} from "./mutation-findings";

// The findings ledger supplies the DENOMINATOR. Every property here protects a count that a rate is
// later divided by, so a bug in this file silently rescales a published percentage.

const scratch = () => mkdtempSync(join(tmpdir(), "findings-"));
const obs = (over: Partial<Parameters<typeof makeFinding>[0]> = {}) =>
  makeFinding({
    source: "a.ts",
    test: "a.test.ts",
    mutation: "gte-to-gt",
    agent: "otto",
    tick: 100,
    outcome: "indistinguishable",
    ...over,
  });

describe("IDEMPOTENCY — a re-run must not inflate the denominator", () => {
  test("appending the same observation twice writes one line", () => {
    // Selection is deterministic in (agent, tick), so a re-run — manual dispatch over the same
    // commit, a retried job, a resumed run — observes the IDENTICAL finding. Appending it again
    // would inflate the population and silently DEFLATE every rate computed from it.
    const root = scratch();
    expect(appendFinding(root, obs())).toBe(true);
    expect(appendFinding(root, obs())).toBe(false);
    expect(readFindings(root, "otto")).toHaveLength(1);
  });

  test("the address ignores the clock, so the same tick collapses across runs", () => {
    // Including a timestamp would make every re-run "new" and defeat the guard entirely.
    expect(findingAddress(obs())).toBe(findingAddress(obs()));
  });

  test("a genuinely different observation is NOT collapsed", () => {
    const root = scratch();
    appendFinding(root, obs());
    appendFinding(root, obs({ tick: 101 }));
    appendFinding(root, obs({ outcome: "distinguished" }));
    appendFinding(root, obs({ mutation: "and-to-or" }));
    expect(readFindings(root, "otto")).toHaveLength(4);
  });

  test("the outcome is part of the identity — the same dimension flipping is a new fact", () => {
    // A dimension that was indistinguishable and now distinguishes is the SPECIFICATION TIGHTENED
    // signal. Collapsing it into the earlier record would erase the very transition worth seeing.
    expect(findingAddress(obs())).not.toBe(findingAddress(obs({ outcome: "distinguished" })));
  });

  test("FIELD BOUNDARIES are unambiguous — neighbours cannot merge into one address", () => {
    // Caught for real while falsifying this file: a stray edit turned the address encoding from a
    // separated join into a bare concatenation, and EVERY existing test still passed, because they
    // all vary one field at a time. Concatenation makes ("ab","c") and ("a","bc") the same
    // observation — two distinct dimensions collapsing into one denominator entry, which silently
    // deflates every rate computed from it.
    expect(findingAddress(obs({ source: "ab", test: "c" }))).not.toBe(
      findingAddress(obs({ source: "a", test: "bc" })),
    );
    expect(findingAddress(obs({ mutation: "xy", agent: "z" }))).not.toBe(
      findingAddress(obs({ mutation: "x", agent: "yz" })),
    );
  });
});

describe("ALARMS — what the rate is a fraction of", () => {
  test("only indistinguishable findings are alarms", () => {
    // `distinguished` is not an alarm: the suite did its job. Counting it would pad the denominator
    // and make the false-alarm rate look better every time the runner succeeded.
    const keys = alarmKeys([obs(), obs({ source: "b.ts", outcome: "distinguished" }), obs({ source: "c.ts", outcome: "unresolved" })]);
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBe("a.ts::a.test.ts::gte-to-gt");
  });

  test("the same dimension re-reported on a later tick is ONE alarm", () => {
    // Otherwise an UNFIXED finding looks like a growing population of correct reports, which would
    // drive the measured false-alarm rate down precisely when nothing is being resolved.
    expect(alarmKeys([obs({ tick: 1 }), obs({ tick: 2 }), obs({ tick: 3 })]).size).toBe(1);
  });

  test("the same dimension found by different agents is still ONE alarm", () => {
    expect(alarmKeys([obs({ agent: "otto" }), obs({ agent: "alexa" })]).size).toBe(1);
  });
});

describe("storage — per-agent files, missing is empty", () => {
  test("agents write to separate files, so concurrent ticks never contend", () => {
    const root = scratch();
    appendFinding(root, obs({ agent: "otto" }));
    appendFinding(root, obs({ agent: "alexa" }));
    expect(findingAgents(root)).toEqual(["alexa", "otto"]);
    expect(readAllFindings(root)).toHaveLength(2);
    expect(readFileSync(join(root, FINDINGS_DIR, "otto.jsonl"), "utf8").trim().split("\n")).toHaveLength(1);
  });

  test("a missing ledger is empty, never an error — most roots have none", () => {
    expect(readFindings(scratch(), "nobody")).toEqual([]);
    expect(readAllFindings(scratch())).toEqual([]);
    expect(findingAgents(scratch())).toEqual([]);
  });

  test("agent names that would escape the directory are refused", () => {
    expect(() => readFindings(scratch(), "../../etc/passwd")).toThrow(/unsafe agent/);
  });
});
