import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exitCodeFor, formatOutcome, mutationByName, recordKill, verifyKill } from "./verify-kill";
import { readTranscript } from "./mutation-freedoms";
import type { Mutation } from "./mutation-runner";

// This module exists because the "did it actually die?" check was a habit rather than a mechanism,
// and habits skip. Its OWN failure mode is the one it was built to prevent: reporting a verdict on
// a run that never happened. Every test here defends that boundary.

const SRC_WITH_GTE = `export const atLeast = (a: number, b: number) => a >= b;\n`;

const deps = (kind: string, why?: string, src = SRC_WITH_GTE) => {
  const calls: Mutation[] = [];
  return {
    calls,
    d: {
      readSource: () => src,
      run: (_r: string, _t: { source: string; test: string }, m: Mutation) => {
        calls.push(m);
        return why === undefined ? { kind } : { kind, why };
      },
    },
  };
};

describe("the four outcomes are distinct — none may be mistaken for another", () => {
  test("a suite that separates the variant is KILLED", () => {
    const t = deps("distinguished-by-suite");
    expect(verifyKill("/r", "a.ts", "a.test.ts", "gte-to-gt", t.d).kind).toBe("killed");
  });

  test("a suite that cannot is STILL ALIVE, not a pass", () => {
    const t = deps("indistinguishable-under-suite");
    expect(verifyKill("/r", "a.ts", "a.test.ts", "gte-to-gt", t.d).kind).toBe("still-alive");
  });

  test("no signal is UNRESOLVED, carrying the reason forward", () => {
    const t = deps("unresolved", "the suite was ALREADY failing before any mutation");
    const o = verifyKill("/r", "a.ts", "a.test.ts", "gte-to-gt", t.d);
    expect(o.kind).toBe("unresolved");
    expect(o.kind === "unresolved" && o.why).toContain("ALREADY failing");
  });

  test("every outcome has its own exit code", () => {
    const codes = [
      exitCodeFor({ kind: "killed" }),
      exitCodeFor({ kind: "still-alive" }),
      exitCodeFor({ kind: "not-applicable", why: "x" }),
      exitCodeFor({ kind: "unresolved", why: "x" }),
    ];
    expect(new Set(codes).size).toBe(4); // collapsing any two would hide a distinction
    expect(exitCodeFor({ kind: "killed" })).toBe(0); // only success is 0
  });
});

describe("APPLICABILITY — the guard this module exists for", () => {
  test("an absent pattern is NOT-APPLICABLE and never reaches the suite", () => {
    // The failure that motivated this file: a mutation that silently does not match produces a
    // mutant identical to the original, which then "survives" — indistinguishable from both a real
    // finding and a test that failed to bite. It must be its own outcome, and it must not burn a
    // suite run pretending to measure something.
    const t = deps("distinguished-by-suite", undefined, `export const f = () => 1;\n`);
    const o = verifyKill("/r", "a.ts", "a.test.ts", "gte-to-gt", t.d);

    expect(o.kind).toBe("not-applicable");
    expect(o.kind === "not-applicable" && o.why).toContain("does not appear");
    expect(t.calls).toHaveLength(0); // the suite was never run — nothing was measured
  });

  test("a pattern that appears ONLY IN A COMMENT is not applicable either", () => {
    // Mutating a comment yields a semantically identical program. Counting that as a survivor is
    // the oldest false positive in this apparatus.
    const t = deps("distinguished-by-suite", undefined, `// guards with a >= b here\nexport const f = () => 1;\n`);
    expect(verifyKill("/r", "a.ts", "a.test.ts", "gte-to-gt", t.d).kind).toBe("not-applicable");
    expect(t.calls).toHaveLength(0);
  });

  test("an unknown mutation name is refused with the list of real ones", () => {
    const t = deps("distinguished-by-suite");
    const o = verifyKill("/r", "a.ts", "a.test.ts", "not-a-real-mutation", t.d);
    expect(o.kind).toBe("not-applicable");
    expect(o.kind === "not-applicable" && o.why).toContain("gte-to-gt");
    expect(t.calls).toHaveLength(0);
  });

  test("an unreadable source is not-applicable rather than a crash or a verdict", () => {
    const o = verifyKill("/r", "missing.ts", "a.test.ts", "gte-to-gt", {
      readSource: () => {
        throw new Error("ENOENT");
      },
      run: () => ({ kind: "distinguished-by-suite" }),
    });
    expect(o.kind).toBe("not-applicable");
  });

  test("an APPLICABLE pattern does reach the suite — the guard is not vacuous", () => {
    // Without this, the applicability check could reject everything and all tests above would
    // still pass while the tool measured nothing, ever.
    const t = deps("distinguished-by-suite");
    expect(verifyKill("/r", "a.ts", "a.test.ts", "gte-to-gt", t.d).kind).toBe("killed");
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0]?.name).toBe("gte-to-gt");
  });
});

describe("the readout says what to do next", () => {
  test("STILL ALIVE points at the redundant reading, not just 'write a better test'", () => {
    // The lesson from two real findings: a masked guard cannot be held by ANY test, so telling the
    // reader to try harder sends them somewhere that does not exist.
    const text = formatOutcome({ kind: "still-alive" }, "a.ts", "a.test.ts", "gte-to-gt");
    expect(text).toContain("STILL ALIVE");
    expect(text).toContain("REDUNDANT");
  });

  test("NOT APPLICABLE says plainly that nothing was measured", () => {
    const text = formatOutcome({ kind: "not-applicable", why: "pattern absent" }, "a.ts", "a.test.ts", "x");
    expect(text).toContain("nothing was measured");
  });

  test("mutationByName resolves the real catalogue", () => {
    expect(mutationByName("gte-to-gt")?.find).toBe(" >= ");
    expect(mutationByName("nope")).toBeUndefined();
  });
});

// Recording a PROVEN kill is what makes `resolutionCoverage` computable at all. Findings accrue
// every tick; before this, resolutions only landed as PRs, so coverage read near-zero forever and
// the false-alarm rate stayed permanently withheld. These tests defend the two properties that
// make the recorded number trustworthy: it is idempotent, and it only records what was proven.
describe("RECORDING a proven kill — the numerator must not be inflatable", () => {
  const room = { source: "a.ts", test: "a.test.ts", mutation: "gte-to-gt" };
  const scratch = () => mkdtempSync(join(tmpdir(), "vk-record-"));

  test("a kill is recorded as a write-test resolution", () => {
    const root = scratch();
    const r = recordKill(root, "otto", room);
    expect(r.recorded).toBe(true);

    const entries = readTranscript(root, "otto") as { action: { kind: string } }[];
    expect(entries).toHaveLength(1);
    expect(entries[0]!.action.kind).toBe("write-test");
  });

  test("IDEMPOTENT — recording the same kill twice appends nothing", () => {
    // A duplicated resolution silently inflates `resolved` and deflates the false-alarm rate
    // computed from it. Re-running verification over the same fix is a normal thing to do.
    const root = scratch();
    expect(recordKill(root, "otto", room).recorded).toBe(true);
    expect(recordKill(root, "otto", room).recorded).toBe(false);
    expect(readTranscript(root, "otto")).toHaveLength(1);
  });

  test("a DIFFERENT dimension is a different resolution", () => {
    const root = scratch();
    recordKill(root, "otto", room);
    recordKill(root, "otto", { ...room, mutation: "and-to-or" });
    expect(readTranscript(root, "otto")).toHaveLength(2);
  });

  test("each declarer records into their own transcript", () => {
    const root = scratch();
    recordKill(root, "otto", room);
    recordKill(root, "vera", room);
    expect(readTranscript(root, "otto")).toHaveLength(1);
    expect(readTranscript(root, "vera")).toHaveLength(1);
  });
});
