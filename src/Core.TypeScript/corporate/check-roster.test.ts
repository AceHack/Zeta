/**
 * check-roster.test.ts — a gate answered by checks, and the two ways that goes wrong.
 *
 * ── THE TWO PROPERTIES WORTH PINNING ─────────────────────────────────────────
 * 1. A VERDICT BELONGS TO A TREE. Reuse is only safe if changed content cannot claim an old
 *    answer, so the tests here care much more about the cache MISSING than about it hitting.
 * 2. A GREEN THAT NOTHING CAN FALSIFY IS NOT EVIDENCE. `Unproven` exists so a check with no
 *    falsifier, or with a broken one, cannot be counted as a pass — because once it is a green
 *    tick in a list, "told you nothing" and "told you it is fine" are indistinguishable.
 *
 * Every check here runs through an INJECTED executor. Spawning real processes would make the suite
 * slow, machine-dependent, and — worse — would test bash rather than this module's decisions.
 */

import { describe, expect, test } from "bun:test";
import {
  CheckOutcome,
  checkKey,
  checksFromRoster,
  isEvidence,
  runCheck,
  runRoster,
  selectChecks,
  summarize,
  type CheckResult,
  type CheckSpec,
  type RosterEntry,
} from "./check-roster";

const TREE_A = "a".repeat(40);
const TREE_B = "b".repeat(40);

/** An executor scripted per command, so a test states exactly what the world does. */
function scripted(answers: Readonly<Record<string, { status: number; stdout?: string; stderr?: string; error?: string }>>) {
  const seen: string[] = [];
  const exec = (command: string): { status: number | null; stdout: string; stderr: string; error?: Error } => {
    seen.push(command);
    const a = answers[command] ?? { status: 0 };
    return {
      status: a.status,
      stdout: a.stdout ?? "",
      stderr: a.stderr ?? "",
      ...(a.error === undefined ? {} : { error: new Error(a.error) }),
    };
  };
  return { exec, seen };
}

const spec = (over: Partial<CheckSpec> = {}): CheckSpec => ({
  id: "no-vacuous-assertions",
  title: "a check may not claim what it does not test",
  command: "audit",
  ...over,
});

describe("A GREEN THAT NOTHING CAN FALSIFY IS NOT EVIDENCE", () => {
  test("a passing check with a PASSING falsifier is evidence", () => {
    const { exec } = scripted({ audit: { status: 0 }, "audit-tests": { status: 0 } });
    const r = runCheck(spec({ falsifier: "audit-tests" }), TREE_A, { workdir: "/w", exec });
    expect(r.outcome).toBe(CheckOutcome.Passed);
    expect(r.falsifierPassed).toBe(true);
    expect(isEvidence(r)).toBe(true);
  });

  test("a passing check with NO falsifier is UNPROVEN, not passed", () => {
    // The whole point. A green tick nobody can falsify looks exactly like a green tick that means
    // something, and the difference only shows up when the check has been broken for months.
    const { exec } = scripted({ audit: { status: 0 } });
    const r = runCheck(spec(), TREE_A, { workdir: "/w", exec });
    expect(r.outcome).toBe(CheckOutcome.Unproven);
    expect(isEvidence(r)).toBe(false);
    expect(r.detail).toContain("no falsifier");
  });

  test("a passing check whose FALSIFIER FAILS is unproven, and says so", () => {
    const { exec } = scripted({ audit: { status: 0 }, "audit-tests": { status: 1, stderr: "mutation survived" } });
    const r = runCheck(spec({ falsifier: "audit-tests" }), TREE_A, { workdir: "/w", exec });
    expect(r.outcome).toBe(CheckOutcome.Unproven);
    expect(r.falsifierPassed).toBe(false);
    expect(r.detail).toContain("not evidence");
  });

  test("the falsifier is NOT run when the check itself failed", () => {
    // There is nothing to prove about a check that already found something, and running its suite
    // anyway would double the cost of every real finding.
    const { exec, seen } = scripted({ audit: { status: 1, stderr: "found it" } });
    const r = runCheck(spec({ falsifier: "audit-tests" }), TREE_A, { workdir: "/w", exec });
    expect(r.outcome).toBe(CheckOutcome.Failed);
    expect(seen).toEqual(["audit"]);
  });

  test("a check that could not RUN is errored, not failed", () => {
    // Blaming the change for a missing binary sends an agent to rework code that is fine.
    const { exec } = scripted({ audit: { status: 0, error: "spawn bash ENOENT" } });
    const r = runCheck(spec({ falsifier: "audit-tests" }), TREE_A, { workdir: "/w", exec });
    expect(r.outcome).toBe(CheckOutcome.Errored);
    expect(isEvidence(r)).toBe(false);
    expect(r.exitCode).toBeUndefined();
  });

  test("a failing check keeps the reason, stderr first", () => {
    const { exec } = scripted({ audit: { status: 2, stderr: "line 41: claim of arity 2", stdout: "scanning…" } });
    const r = runCheck(spec(), TREE_A, { workdir: "/w", exec });
    expect(r.exitCode).toBe(2);
    expect(r.detail.indexOf("arity 2")).toBeLessThan(r.detail.indexOf("scanning"));
  });
});

describe("A VERDICT BELONGS TO ONE TREE", () => {
  const cached = (over: Partial<CheckResult> = {}): CheckResult => ({
    checkId: "no-vacuous-assertions",
    outcome: CheckOutcome.Passed,
    tree: TREE_A,
    exitCode: 0,
    detail: "from the log",
    durationMs: 1,
    falsifierPassed: true,
    ...over,
  });

  test("the same tree reuses the recorded answer and runs nothing", () => {
    const { exec, seen } = scripted({});
    const known = new Map([[checkKey(TREE_A, "no-vacuous-assertions"), cached()]]);
    const run = runRoster([spec({ falsifier: "audit-tests" })], TREE_A, { workdir: "/w", exec }, known);
    expect(run.reused).toEqual(["no-vacuous-assertions"]);
    expect(seen).toEqual([]);
    expect(run.results[0]?.detail).toBe("from the log");
  });

  test("a DIFFERENT tree cannot reuse it — this is the half that matters", () => {
    // If a changed tree could claim an old verdict, the gate would be certifying content nobody
    // ever checked. That is the failure the key exists to make impossible.
    const { exec, seen } = scripted({ audit: { status: 0 }, "audit-tests": { status: 0 } });
    const known = new Map([[checkKey(TREE_A, "no-vacuous-assertions"), cached()]]);
    const run = runRoster([spec({ falsifier: "audit-tests" })], TREE_B, { workdir: "/w", exec }, known);
    expect(run.reused).toEqual([]);
    expect(seen).toEqual(["audit", "audit-tests"]);
    expect(run.results[0]?.tree).toBe(TREE_B);
  });

  test("a different CHECK on the same tree is not reused either", () => {
    const { exec, seen } = scripted({ other: { status: 0 } });
    const known = new Map([[checkKey(TREE_A, "no-vacuous-assertions"), cached()]]);
    const run = runRoster([spec({ id: "something-else", command: "other" })], TREE_A, { workdir: "/w", exec }, known);
    expect(run.reused).toEqual([]);
    expect(seen).toEqual(["other"]);
  });

  test("the key is unambiguous in both halves", () => {
    expect(checkKey("a", "b:c")).not.toBe(checkKey("a:b", "c"));
  });

  test("a recorded FAILURE is reused too — it is a verdict, not a cache of successes", () => {
    const { exec, seen } = scripted({});
    const known = new Map([[checkKey(TREE_A, "no-vacuous-assertions"), cached({ outcome: CheckOutcome.Failed })]]);
    const run = runRoster([spec()], TREE_A, { workdir: "/w", exec }, known);
    expect(seen).toEqual([]);
    expect(run.clean).toBe(false);
  });
});

describe("AN EMPTY ROSTER IS NOT A PASS", () => {
  test("binding no checks to a gate does NOT report clean", () => {
    // `[].every()` is vacuously true, so a gate bound to nothing would pass having verified
    // nothing — approval by having no requirement, which `change-control` already refuses for gates.
    const { exec } = scripted({});
    const run = runRoster([], TREE_A, { workdir: "/w", exec });
    expect(run.clean).toBe(false);
    expect(summarize(run)).toContain("nothing was verified");
  });

  test("a roster of one passing, proven check IS clean", () => {
    const { exec } = scripted({ audit: { status: 0 }, "audit-tests": { status: 0 } });
    expect(runRoster([spec({ falsifier: "audit-tests" })], TREE_A, { workdir: "/w", exec }).clean).toBe(true);
  });

  test("one unproven check is enough to make the run not clean", () => {
    const { exec } = scripted({ audit: { status: 0 }, good: { status: 0 }, "good-tests": { status: 0 } });
    const run = runRoster(
      [spec({ id: "good", command: "good", falsifier: "good-tests" }), spec()],
      TREE_A,
      { workdir: "/w", exec },
    );
    expect(run.clean).toBe(false);
    expect(run.unproven).toEqual(["no-vacuous-assertions"]);
    expect(summarize(run)).toContain("UNPROVEN");
  });
});

describe("THE ROSTER'S OWN PAIRING CONVENTION IS DERIVED, NOT GUESSED", () => {
  const entries: readonly RosterEntry[] = [
    { id: "argocd-pin-parity", title: "pins match", command: "bun audit-argocd.ts" },
    { id: "argocd-pin-parity-tests", title: "…and it goes red", command: "bun test audit-argocd.test.ts" },
    { id: "reason-truth", title: "a stated reason is the reason", command: "bun audit-reason.ts" },
  ];

  test("an audit is paired with its `-tests` sibling", () => {
    const { specs } = checksFromRoster(entries);
    const argo = specs.find((s) => s.id === "argocd-pin-parity");
    expect(argo?.falsifier).toBe("bun test audit-argocd.test.ts");
  });

  test("the `-tests` entry is not ALSO run as a check of its own", () => {
    // Otherwise every suite runs twice and each one is reported as an unproven check.
    const { specs } = checksFromRoster(entries);
    expect(specs.map((s) => s.id)).toEqual(["argocd-pin-parity", "reason-truth"]);
  });

  test("an audit with no sibling is REPORTED as unpaired rather than quietly assumed proven", () => {
    const { specs, unpaired } = checksFromRoster(entries);
    expect(unpaired).toEqual(["reason-truth"]);
    expect(specs.find((s) => s.id === "reason-truth")?.falsifier).toBeUndefined();
  });

  test("a `-tests` entry with NO base is kept as a check in its own right", () => {
    // MEASURED on this repository's roster: `heartbeat-lane-audit-tests` and `tech-radar-audit-tests`
    // do not match their bases by the suffix rule. Dropping them because their name ends in `-tests`
    // would silently remove two checks; guessing at their bases would pair a check with a suite that
    // tests something else, and report it proven on that basis. Keeping them is the only honest one.
    const odd: readonly RosterEntry[] = [{ id: "tech-radar-audit-tests", title: "t", command: "bun t" }];
    const { specs, unpaired } = checksFromRoster(odd);
    expect(specs.map((s) => s.id)).toEqual(["tech-radar-audit-tests"]);
    expect(unpaired).toEqual(["tech-radar-audit-tests"]);
  });
});

describe("A BINDING THAT MATCHES NOTHING IS A GATE THAT VERIFIES NOTHING", () => {
  const specs = [spec({ id: "a", command: "a" }), spec({ id: "b", command: "b" })];

  test("named checks are selected in the roster's order", () => {
    expect(selectChecks(specs, ["b", "a"]).selected.map((s) => s.id)).toEqual(["a", "b"]);
  });

  test("an id nobody recognises is REPORTED, not skipped", () => {
    // A typo in a binding otherwise produces a gate that runs fewer checks than its operator
    // believes, and says nothing about it — configuration entering the vacuity class.
    const out = selectChecks(specs, ["a", "no-such-check"]);
    expect(out.selected.map((s) => s.id)).toEqual(["a"]);
    expect(out.unknown).toEqual(["no-such-check"]);
  });

  test("selecting nothing selects nothing — and `runRoster` then refuses to call it clean", () => {
    const { exec } = scripted({});
    const out = selectChecks(specs, []);
    expect(out.selected).toEqual([]);
    expect(runRoster(out.selected, TREE_A, { workdir: "/w", exec }).clean).toBe(false);
  });
});
