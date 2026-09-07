/**
 * run-org.test.ts — the production entry point, driven as a caller would drive it.
 *
 * `main` is what makes "it runs end to end" a statement about a code path something outside a test
 * suite takes. Tested through its EXIT CODE and its real output, because those are what a caller
 * actually consumes.
 */

import { describe, expect, test } from "bun:test";
import { fidelityOf, Port } from "./providers";
import { WorkState, WorkType as WorkTypeValue } from "./goal-cascade";
import { main, parseArgs, providersFromArgs } from "./run-org";
import { RunOutcome } from "./qa";

/** Run `main`, capturing what it printed. */
async function capture(argv: readonly string[]): Promise<{ code: number; out: string }> {
  const lines: string[] = [];
  const log = console.log;
  const err = console.error;
  console.log = (...a: unknown[]) => void lines.push(a.map(String).join(" "));
  console.error = (...a: unknown[]) => void lines.push(a.map(String).join(" "));
  try {
    const code = await main(argv);
    return { code, out: lines.join("\n") };
  } finally {
    console.log = log;
    console.error = err;
  }
}

describe("argument parsing", () => {
  test("defaults are all off", () => {
    // `store` is undefined by default: persisting is a SIDE EFFECT, and a reporting CLI should
    // not have one unless told to.
    expect(parseArgs([])).toEqual({
      qaFails: false, churn: false, json: false, cycleOnly: false, admin: false, store: undefined,
      // Every port unspecified means every port SIMULATED — and `providersFromArgs` is where that
      // becomes an adapter, so the default is a decision made in one visible place.
      inbox: undefined, workCmd: undefined, testCmd: undefined, git: undefined, baseBranch: "main",
      workArgs: [], testArgs: [],
      // Every gate unreviewed means AUTO-APPROVE — the register's own long-standing behaviour,
      // which is now an adapter that says so rather than a constant nobody could see.
      reviewQueue: undefined, reviewCmd: undefined, reviewArgs: [],
      worktrees: undefined,
      // The three ports that had no command-line path until now. Absent still means simulated, and
      // the fidelity block still says so — reaching a tracker, an agent or a model is opt-in.
      reviewModel: undefined, tracker: undefined, trackerItems: undefined,
      trackerHeaders: [], trackerMap: [], trackerSource: "tracker",
      workAgent: undefined, workModel: undefined, until: undefined, windowStart: undefined, windowTarget: undefined, now: undefined, agentDelivers: false, sourceRepos: [], sourceSubdir: undefined, workAgentArgs: [], workVerify: undefined, workVerifyArgs: [],
    });
    expect(parseArgs(["--store", "/tmp/x"]).store).toBe("/tmp/x");
  });

  test("REPEATED --work-arg accumulates IN ORDER — these become argv for a real process", () => {
    // Taking only the last occurrence is the usual shortcut and it silently drops arguments the
    // operator wrote down; reversing them is a different command.
    expect(parseArgs(["--work-arg", "run", "--work-arg", "build"]).workArgs).toEqual(["run", "build"]);
    expect(parseArgs(["--work-arg", "build", "--work-arg", "run"]).workArgs).toEqual(["build", "run"]);
    // A trailing flag with nothing after it contributes nothing rather than an undefined argument.
    expect(parseArgs(["--work-arg"]).workArgs).toEqual([]);
    expect(parseArgs(["--test-arg", "-t"]).testArgs).toEqual(["-t"]);
  });

  test("--churn implies --qa-fails, since churn needs something to fail", () => {
    const a = parseArgs(["--churn"]);
    expect(a.churn).toBe(true);
    expect(a.qaFails).toBe(true);
  });

  test("unknown flags are ignored rather than fatal", () => {
    expect(parseArgs(["--nonsense"]).json).toBe(false);
  });
});

describe("the default run delivers", () => {
  test("exit 0, and the whole pipeline is visible in the output", async () => {
    const { code, out } = await capture([]);
    expect(code).toBe(0);
    expect(out).toContain("=== DELIVERED ===");
    // Every phase left a trace.
    expect(out).toContain("intake accepted");
    expect(out).toContain("accepted 'checkout double-charges");
    expect(out).toContain("owns initiative");
    expect(out).toContain("bound to");
    expect(out).toContain("the accountable chain met");
    expect(out).toContain("offered 1 item(s); picked");
    expect(out).toContain("approved and it merged");
    expect(out).toContain("qa_engineer: 1/1 passed");
    expect(out).toContain("passed all 7 gates");
    expect(out).toContain("DELIVERED");
  });

  test("the levels engaged run from the C-suite to the contributor", async () => {
    const { out } = await capture([]);
    expect(out).toContain("c_suite → director → manager → lead → individual_contributor");
  });

  test("the DUPLICATE and the INCOMPLETE report are both refused", async () => {
    const { out } = await capture([]);
    expect(out).toContain("duplicate");
    expect(out).toContain("missing_reproduction");
  });

  test("the status readout is printed", async () => {
    const { out } = await capture([]);
    expect(out).toContain("--- status ---");
    expect(out).toContain("whitewash:   threshold");
    expect(out).toContain("qa:");
    expect(out).toContain("queue:");
  });

  test("the dev's communication brief names all eight tools", async () => {
    const { out } = await capture([]);
    expect(out).toContain("communication brief");
    for (const tool of [
      "ask_question",
      "report_blocker",
      "request_decision",
      "request_resource",
      "request_review",
      "report_risk",
      "suggest_improvement",
      "request_escalation",
    ]) {
      expect(out).toContain(tool);
    }
  });
});

describe("the failure modes exit non-zero", () => {
  test("--qa-fails does not deliver", async () => {
    const { code, out } = await capture(["--qa-fails"]);
    expect(code).toBe(1);
    expect(out).toContain("=== NOT DELIVERED ===");
    expect(out).toContain("runtime_validation");
  });

  test("--churn escalates, and says what the escalation DID", async () => {
    const { code, out } = await capture(["--churn"]);
    expect(code).toBe(1);
    expect(out).toContain("escalated");
    expect(out).toContain("changes_the_input");
  });

  test("--cycle runs the delivery loop alone and delivers", async () => {
    const { code, out } = await capture(["--cycle"]);
    expect(code).toBe(0);
    expect(out).toContain("DELIVERED");
  });

  test("--json emits parseable JSON carrying the report", async () => {
    const { code, out } = await capture(["--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(out) as { delivered: boolean; events: string[]; bindings: unknown[] };
    expect(parsed.delivered).toBe(true);
    expect(parsed.events.length).toBeGreaterThan(0);
    expect(parsed.bindings).toHaveLength(2);
  });
});

describe("--admin exercises the operator surface, refusals included", () => {
  test("every authority check is shown refusing where it should", async () => {
    const { out } = await capture(["--admin"]);
    expect(out).toContain("--- operator surface ---");
    // The refusals are the point: a surface that only demonstrates success has not shown what
    // makes it safe.
    expect(out).toContain("revoke by a stranger:   refused");
    expect(out).toContain("revoke by a supervisor: done");
    expect(out).toContain("approve an ACTIVE binding: refused");
    expect(out).toContain("heartbeat a finished claim: refused");
    expect(out).toContain("NaN → refused");
    expect(out).toContain("evidence ok: false");
    expect(out).toContain("missing_reproduction");
  });

  test("it shows the authority ladder differing by level", async () => {
    const { out } = await capture(["--admin"]);
    // A manager gets three verdicts; a director additionally gets `waived`.
    expect(out).toContain("a manager's gate verdicts:  approved, changes_requested, rejected");
    expect(out).toContain("a director's:              approved, changes_requested, rejected, waived");
    expect(out).toContain("a lead's priority options: (none");
    expect(out).toContain("a manager may set it: false");
  });

  test("the accountability chain is printed for real work", async () => {
    const { out } = await capture(["--admin"]);
    expect(out).toContain("--- accountability for");
    expect(out).toContain("chain:");
    expect(out).toContain("rung:      lead");
  });
});

describe("PROVIDERS ARE CHOSEN AT THE COMMAND LINE, and never fall back", () => {
  test("no flags means every port simulated — and the run is replayable", () => {
    const set = providersFromArgs(parseArgs([]), [], RunOutcome.Passed);
    const report = fidelityOf(set);
    expect(report.replayable).toBe(true);
    expect(report.realPorts).toEqual([]);
  });

  test("ONE flag makes ONE port real, and the others stay simulated", () => {
    // The property that matters: asking for a real inbox does not quietly upgrade anything else,
    // and it does not quietly downgrade the inbox either.
    const report = fidelityOf(providersFromArgs(parseArgs(["--inbox", "/tmp/in"]), [], RunOutcome.Passed));
    expect(report.realPorts).toEqual([Port.Intake]);
    expect(report.replayable).toBe(false);
  });

  test("every flag together makes every port real", () => {
    const args = parseArgs(["--inbox", "/tmp/in", "--work-cmd", "w", "--test-cmd", "t", "--git", "/tmp/repo"]);
    const report = fidelityOf(providersFromArgs(args, [], RunOutcome.Passed));
    expect([...report.realPorts].sort()).toEqual([Port.ChangeControl, Port.Intake, Port.TestExecution, Port.WorkExecution].sort());
  });

  test("the QA fallback reaches the SIMULATED runner, and is ignored by the real one", () => {
    // `--qa-fails` is a property of the simulation. Once a command runs the tests, the command's
    // exit code decides and a configured fallback would be a lie about what was observed.
    expect(providersFromArgs(parseArgs([]), [], RunOutcome.Failed).tests.meta.describes).toContain("failed");
    expect(providersFromArgs(parseArgs(["--test-cmd", "t"]), [], RunOutcome.Failed).tests.meta.describes).not.toContain("falling back");
  });

  test("--work-arg values become LEADING arguments; the work id is appended last", async () => {
    // Order is the whole point: `bun build.ts <workId>` and `bun <workId> build.ts` are different
    // commands, and the id has to be last so a script can read it positionally.
    const args = parseArgs(["--work-cmd", process.execPath, "--work-arg", "-e", "--work-arg", "process.exit(0)"]);
    const r = await providersFromArgs(args, [], RunOutcome.Passed).work.execute(
      { workId: "task-9", workType: WorkTypeValue.Task, title: "t", state: WorkState.Open, ownerHatId: "tech_lead" },
      { branch: "b" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.artifacts).toEqual(["-e", "process.exit(0)", "task-9"]);
  });
});
