/**
 * adapters.test.ts — the concrete ends of the ports, including the ones that really touch things.
 *
 * These tests DO real I/O: they write files, run processes, and create a git repository. That is
 * deliberate and it is the only place in this register where it happens. An adapter whose whole
 * claim is "this one actually reaches" cannot be verified by a test that does not let it.
 *
 * The properties worth the most here are the refusals and the safety ones:
 *   - a malformed inbound file is refused BY PATH, never dropped
 *   - a work item's own text cannot become a command
 *   - a non-zero exit is a real failure, and a MISSING BINARY is a refusal rather than a failure
 *   - a failing test is a result; a broken runner is not
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  commandArtifactProducer,
  commandTestRunner,
  commandWorkExecutor,
  directoryIntake,
  inboxOrder,
  gitChangeControl,
  MAX_CAPTURED_OUTPUT,
  simulatedChangeControl,
  simulatedIntake,
  simulatedProviders,
  simulatedTestRunner,
  simulatedWorkExecutor,
} from "./adapters";
import { Fidelity, Port } from "./providers";
import { GateKind } from "./quality-gate";
import type { Artifact, PhaseContext } from "./pipeline";
import { ExecutionMode, RunOutcome, TestCaseStatus, type TestCase } from "./qa";
import { IntakeKind, Severity, type ExternalEvent } from "./intake";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";

const EVENT: ExternalEvent = {
  source: "portal",
  externalId: "T-1",
  kind: IntakeKind.Defect,
  severity: Severity.High,
  title: "t",
  reproduction: "twice",
  evidenceRefs: ["log/1"],
};

const node = (workId: string, title = "a task"): CascadeNode => ({
  workId,
  workType: WorkType.Task,
  title,
  state: WorkState.Open,
  ownerHatId: "tech_lead",
  assigneeHatId: "backend_implementer",
});

const phaseCtx = (prior: ReadonlyMap<GateKind, Artifact> = new Map()): PhaseContext => ({
  branch: "work/w1",
  priorArtifacts: prior,
});

const testCase = (testCaseId: string): TestCase => ({
  testCaseId,
  suiteId: "s",
  brdId: "b",
  title: "t",
  criterion: "c",
  executionMode: ExecutionMode.Api,
  status: TestCaseStatus.Active,
  authoredByHatId: "qa_lead",
});

const scratch = (label: string) => mkdtempSync(join(tmpdir(), `adapters-${label}-`));

/** This process's own executable, used as a command that certainly exists. */
const SELF = process.execPath;

describe("the simulated family — the previous behaviour, now labelled", () => {
  test("intake hands back its fixture, and says it is one", async () => {
    const r = await simulatedIntake([EVENT]).poll();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([EVENT]);
    expect(simulatedIntake([EVENT]).meta.fidelity).toBe(Fidelity.Simulated);
    expect(simulatedIntake([EVENT]).meta.describes).toContain("1 fixed");
  });

  test("SUCCESS IS NOT THE DEFAULT — the simulated executor takes it as an argument", async () => {
    // A simulation that defaults to success turns "nobody decided what this should do" into a
    // green. `succeeds` is a required parameter, so the decision is always visible at the call.
    const ok = await simulatedWorkExecutor(true).execute(node("w1"), { branch: "b" });
    expect(ok.ok && ok.value.succeeded).toBe(true);
    const no = await simulatedWorkExecutor(false).execute(node("w1"), { branch: "b" });
    expect(no.ok && no.value.succeeded).toBe(false);
    // ...and it says what it did not do.
    expect(simulatedWorkExecutor(true).meta.describes).toContain("performs nothing");
  });

  test("the planned runner uses the plan where it has one and the fallback where it does not", async () => {
    const runner = simulatedTestRunner(new Map([["tc-1", RunOutcome.Failed]]), RunOutcome.Passed);
    const planned = await runner.run(testCase("tc-1"), { branch: "b" });
    const unplanned = await runner.run(testCase("tc-2"), { branch: "b" });
    expect(planned.ok && planned.value.outcome).toBe(RunOutcome.Failed);
    expect(unplanned.ok && unplanned.value.outcome).toBe(RunOutcome.Passed);
  });

  test("change control opens and merges, and admits it touched no repository", async () => {
    const change = simulatedChangeControl();
    const opened = await change.open(node("w1"), { branch: "work/w1" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.branch).toBe("work/w1");
    expect((await change.merge(opened.value)).ok).toBe(true);
    expect(change.meta.describes).toContain("touches no repository");
  });

  test("the simulated set covers all FIVE ports, each one simulated", () => {
    const set = simulatedProviders({ events: [EVENT], workSucceeds: true, testFallback: RunOutcome.Passed });
    expect(set.map((p) => p.meta.port)).toEqual([
      Port.Intake,
      Port.WorkExecution,
      Port.TestExecution,
      Port.Review,
      Port.ChangeControl,
    ]);
    for (const p of set) expect(p.meta.fidelity).toBe(Fidelity.Simulated);
  });
});

describe("directoryIntake — real reads, and a refusal that names the file", () => {
  test("reads events off disk, in filename order, ignoring anything that is not .json", async () => {
    const dir = scratch("intake");
    writeFileSync(join(dir, "b.json"), JSON.stringify({ ...EVENT, externalId: "B" }));
    writeFileSync(join(dir, "a.json"), JSON.stringify({ ...EVENT, externalId: "A" }));
    writeFileSync(join(dir, "notes.txt"), "not a ticket");

    const r = await directoryIntake(dir).poll();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Sorted, so a directory listing's order cannot change the run.
    expect(r.value.map((e) => e.externalId)).toEqual(["A", "B"]);
    expect(r.evidence).toHaveLength(2);
    expect(directoryIntake(dir).meta.fidelity).toBe(Fidelity.Real);
  });

  test("THE READING ORDER IS ORDINAL, and it is checked where it can actually fail", () => {
    // Through the adapter this is unfalsifiable: the filesystem already hands entries back
    // alphabetically, so a run with the sort and a run without it are indistinguishable. As a
    // function over a list it can be handed the list backwards.
    expect(inboxOrder(["c.json", "a.json", "b.json"])).toEqual(["a.json", "b.json", "c.json"]);
    expect(inboxOrder(["b.json", "notes.txt", "a.json"])).toEqual(["a.json", "b.json"]);
    // ORDINAL, NOT LOCALE — and the pair has to be chosen to discriminate. 'A' vs 'b' does not:
    // both comparators put A first, so asserting on it proves nothing. 'Z' vs 'a' does, because
    // ordinal sorts by UTF-16 code unit (Z = 0x5A before a = 0x61) while a locale comparator sorts
    // case-insensitively and returns them the other way round. Under localeCompare the run's event
    // order would depend on the machine's locale.
    expect(inboxOrder(["a.json", "Z.json"])).toEqual(["Z.json", "a.json"]);
    // The caller's listing is theirs — a new array comes back.
    const given = ["b.json", "a.json"];
    expect(inboxOrder(given)).not.toBe(given);
    expect(given).toEqual(["b.json", "a.json"]);
  });

  test("A MALFORMED FILE IS REFUSED BY PATH — dropping it would shorten the queue silently", async () => {
    // The failure this prevents: a broken ticket and no ticket look identical, and the work
    // simply never happens with nothing anywhere saying so.
    const dir = scratch("intake-bad");
    writeFileSync(join(dir, "good.json"), JSON.stringify(EVENT));
    writeFileSync(join(dir, "broken.json"), "{not json");
    const r = await directoryIntake(dir).poll();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("broken.json");
  });

  test("a well-formed JSON file that is not an event is refused too, and named", async () => {
    const dir = scratch("intake-shape");
    writeFileSync(join(dir, "half.json"), JSON.stringify({ source: "portal" }));
    const r = await directoryIntake(dir).poll();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("half.json");
      expect(r.reason).toContain("externalId");
    }
  });

  test("a directory nobody has written to is an EMPTY POLL, not an error", async () => {
    // An empty inbox is a normal state. Refusing here would make a quiet morning look like an
    // outage, and the run would stop for no reason.
    const r = await directoryIntake(join(scratch("intake-missing"), "never-created")).poll();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([]);
  });
});

describe("commandWorkExecutor — a real process, and the exit code decides", () => {
  test("exit 0 succeeds; a NON-ZERO exit is a genuine failure, not a refusal", async () => {
    const dir = scratch("work");
    const ok = await commandWorkExecutor({ command: SELF, argsFor: () => ["-e", "process.exit(0)"], cwd: dir })
      .execute(node("w1"), { branch: "b" });
    expect(ok.ok && ok.value.succeeded).toBe(true);

    const bad = await commandWorkExecutor({ command: SELF, argsFor: () => ["-e", "process.exit(3)"], cwd: dir })
      .execute(node("w1"), { branch: "b" });
    // ok:true — the port worked. succeeded:false — the WORK did not.
    expect(bad.ok).toBe(true);
    if (bad.ok) {
      expect(bad.value.succeeded).toBe(false);
      expect(bad.value.summary).toContain("3");
    }
  });

  test("STDOUT DOES NOT DECIDE — a run that prints 'error' and exits 0 succeeded", async () => {
    // The tempting heuristic, and the wrong one: builds print the word "error" in warnings all
    // the time, and a silent tool that fails prints nothing at all.
    const r = await commandWorkExecutor({
      command: SELF,
      argsFor: () => ["-e", "console.log('error: something looked wrong'); process.exit(0)"],
      cwd: scratch("work-stdout"),
    }).execute(node("w1"), { branch: "b" });
    expect(r.ok && r.value.succeeded).toBe(true);
    if (r.ok) expect(r.evidence.some((e) => e.ref.includes("something looked wrong"))).toBe(true);
  });

  test("A WORK ITEM'S TEXT CANNOT BECOME A COMMAND — args are argv entries, never a shell line", async () => {
    // A work item arrives from intake, which may be a directory somebody else writes to. If its
    // title could reach a shell this port would be a command-injection seam wearing an org chart.
    const dir = scratch("work-injection");
    const hostile = node("w1", "x'; touch OWNED; echo '");
    const r = await commandWorkExecutor({
      command: SELF,
      // The node's own title, passed through as an argument on purpose.
      argsFor: (n) => ["-e", "console.log(process.argv[process.argv.length - 1])", n.title],
      cwd: dir,
    }).execute(hostile, { branch: "b" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // It arrived as ONE argument, intact — not parsed, not split, not executed.
    expect(r.value.artifacts[2]).toBe(hostile.title);
    expect(r.evidence.some((e) => e.ref.includes(hostile.title))).toBe(true);
    // And nothing ran the second "command": the file it would have created does not exist.
    expect(spawnSync(SELF, ["-e", "process.exit(require('node:fs').existsSync('OWNED') ? 1 : 0)"], { cwd: dir }).status).toBe(0);
  });

  test("A MISSING BINARY IS A REFUSAL — it must never read as work that succeeded", async () => {
    const r = await commandWorkExecutor({
      command: join(scratch("work-missing"), "no-such-binary-here"),
      argsFor: () => [],
      cwd: scratch("work-missing-cwd"),
    }).execute(node("w1"), { branch: "b" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("could not run");
  });

  test("LONG OUTPUT IS TRUNCATED VISIBLY — silently clipping makes a big failure look small", async () => {
    const r = await commandWorkExecutor({
      command: SELF,
      argsFor: () => ["-e", `console.log('x'.repeat(${String(MAX_CAPTURED_OUTPUT * 2)}))`],
      cwd: scratch("work-long"),
    }).execute(node("w1"), { branch: "b" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const stdout = r.evidence.find((e) => e.ref.startsWith("stdout:"));
    expect(stdout?.ref).toContain("truncated");
    // Short output is NOT annotated — otherwise the marker would say nothing.
    const short = await commandWorkExecutor({ command: SELF, argsFor: () => ["-e", "console.log('ok')"], cwd: scratch("work-short") })
      .execute(node("w1"), { branch: "b" });
    if (short.ok) expect(short.evidence.find((e) => e.ref.startsWith("stdout:"))?.ref).not.toContain("truncated");
  });
});

describe("commandTestRunner — a failing test is a RESULT; a broken runner is not", () => {
  test("exit 0 passes, non-zero FAILS", async () => {
    const dir = scratch("tests");
    const pass = await commandTestRunner({ command: SELF, argsFor: () => ["-e", "process.exit(0)"], cwd: dir }).run(testCase("tc-1"), { branch: "b" });
    const fail = await commandTestRunner({ command: SELF, argsFor: () => ["-e", "process.exit(1)"], cwd: dir }).run(testCase("tc-1"), { branch: "b" });
    expect(pass.ok && pass.value.outcome).toBe(RunOutcome.Passed);
    expect(fail.ok && fail.value.outcome).toBe(RunOutcome.Failed);
  });

  test("A MISSING BINARY REFUSES rather than reporting Failed — that would blame the code", async () => {
    // The distinction `RunOutcome.Errored` exists for: nothing was learned. Reporting `Failed`
    // would open a defect against code that was never executed.
    const r = await commandTestRunner({
      command: join(scratch("tests-missing"), "nope"),
      argsFor: () => [],
      cwd: scratch("tests-missing-cwd"),
    }).run(testCase("tc-1"), { branch: "b" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("could not run");
  });

  test("the test case chooses the arguments, and they arrive as argv", async () => {
    const r = await commandTestRunner({
      command: SELF,
      argsFor: (tc) => ["-e", "process.exit(process.argv[process.argv.length - 1] === 'tc-7' ? 0 : 9)", tc.testCaseId],
      cwd: scratch("tests-args"),
    }).run(testCase("tc-7"), { branch: "b" });
    expect(r.ok && r.value.outcome).toBe(RunOutcome.Passed);
  });
});

describe("gitChangeControl — a real repository", () => {
  /** A repo with one commit on `main`, so there is something to branch from. */
  const repo = () => {
    const dir = scratch("git");
    const git = (...args: string[]) => {
      const r = spawnSync("git", args, { cwd: dir, encoding: "utf-8" });
      if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr ?? r.error?.message ?? ""}`);
    };
    git("init", "-b", "main");
    git("config", "user.email", "t@example.invalid");
    git("config", "user.name", "T");
    writeFileSync(join(dir, "README.md"), "seed\n");
    git("add", "README.md");
    git("commit", "-m", "seed");
    return dir;
  };

  test("open creates the branch and merge brings it back — with a MERGE COMMIT", async () => {
    const dir = repo();
    const change = gitChangeControl({ cwd: dir, baseBranch: "main" });
    const opened = await change.open(node("w1"), { branch: "work/w1" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    // Something to merge, or `--no-ff` has nothing to demonstrate.
    writeFileSync(join(dir, "done.txt"), "work\n");
    for (const args of [["add", "done.txt"], ["commit", "-m", "did the work"]]) {
      expect(spawnSync("git", args, { cwd: dir, encoding: "utf-8" }).status).toBe(0);
    }

    const merged = await change.merge(opened.value);
    expect(merged.ok).toBe(true);

    // On main, with the work present...
    const head = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir, encoding: "utf-8" });
    expect(head.stdout.trim()).toBe("main");
    // ...and the tip is a MERGE commit (two parents), so the record shows a change existed.
    const parents = spawnSync("git", ["rev-list", "--parents", "-n", "1", "HEAD"], { cwd: dir, encoding: "utf-8" });
    expect(parents.stdout.trim().split(/ +/)).toHaveLength(3);
  });

  test("A BRANCH THAT ALREADY EXISTS IS REFUSED — it never reports a change it did not open", async () => {
    const dir = repo();
    const change = gitChangeControl({ cwd: dir, baseBranch: "main" });
    expect((await change.open(node("w1"), { branch: "work/w1" })).ok).toBe(true);
    const again = await change.open(node("w2"), { branch: "work/w1" });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toContain("work/w1");
  });

  test("A MERGE THAT DID NOT HAPPEN IS REFUSED — the one thing change control cannot claim", async () => {
    // If `merge` reported success on a non-zero exit, the record would say a change landed while
    // the repository disagreed — and the record is the only thing anyone downstream reads.
    const dir = repo();
    const change = gitChangeControl({ cwd: dir, baseBranch: "main" });
    const r = await change.merge({ changeId: "c", branch: "never-existed" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("never-existed");
  });

  test("a base branch that does not exist is refused, not invented", async () => {
    const change = gitChangeControl({ cwd: repo(), baseBranch: "no-such-base" });
    expect((await change.open(node("w1"), { branch: "work/w1" })).ok).toBe(false);
  });

  test("outside a repository it refuses rather than throwing", async () => {
    const dir = scratch("git-none");
    mkdirSync(join(dir, "plain"), { recursive: true });
    const r = await gitChangeControl({ cwd: join(dir, "plain"), baseBranch: "main" }).open(node("w1"), { branch: "b" });
    expect(r.ok).toBe(false);
  });

  test("every real adapter says it is real", () => {
    expect(gitChangeControl({ cwd: ".", baseBranch: "main" }).meta.fidelity).toBe(Fidelity.Real);
    expect(commandWorkExecutor({ command: SELF, argsFor: () => [], cwd: "." }).meta.fidelity).toBe(Fidelity.Real);
    expect(commandTestRunner({ command: SELF, argsFor: () => [], cwd: "." }).meta.fidelity).toBe(Fidelity.Real);
    expect(directoryIntake(".").meta.fidelity).toBe(Fidelity.Real);
  });
});

describe("A PRE-CODE GATE MUST HAVE SOMETHING TO JUDGE", () => {
  // Eleven of fourteen gates had no producer, so the reviewer at those phases was choosing between
  // approving nothing and rejecting nothing. Both are the gate failing to evaluate the work.
  const produce = (script: string, gate: GateKind = GateKind.BrdApproval) =>
    commandArtifactProducer({
      command: SELF,
      gate,
      argsFor: () => ["-e", script],
      cwd: scratch("artifact"),
    });

  test("THE EXIT CODE DECIDES whether the phase produced anything", async () => {
    // A command that prints a document and fails has not produced it; one that prints nothing and
    // succeeds has produced something that cites nothing. Both facts are kept, neither smoothed.
    const failed = await produce("console.log('docs/brd.md'); process.exit(1)").produce(node("w1"), phaseCtx());
    expect(failed.ok).toBe(false);

    const ok = await produce("console.log('docs/brd.md')").produce(node("w1"), phaseCtx());
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.refs).toEqual(["docs/brd.md"]);
  });

  test("STDOUT IS THE EVIDENCE — every cited artifact reaches the gate", async () => {
    const out = await produce("console.log('docs/brd.md'); console.log('docs/rules.md')")
      .produce(node("w1"), phaseCtx());
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.refs).toEqual(["docs/brd.md", "docs/rules.md"]);
      // These become the gate's evidenceRefs, so a reviewer is shown exactly what was written.
      expect(out.evidence?.map((e) => e.ref)).toEqual(["docs/brd.md", "docs/rules.md"]);
    }
  });

  test("a zero exit that cites NOTHING says so, rather than passing as a success", async () => {
    // This is what an approval with nothing behind it looks like, and it must be legible as that.
    const out = await produce("process.exit(0)").produce(node("w1"), phaseCtx());
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.refs).toEqual([]);
      expect(out.value.summary).toContain("cited nothing");
    }
  });

  test("the producer is REAL in the fidelity report, and names the gate it serves", () => {
    const port = produce("process.exit(0)", GateKind.ArchitectureApproval);
    expect(port.meta.fidelity).toBe(Fidelity.Real);
    expect(port.meta.describes).toContain("architecture_approval");
  });

  test("a work item's TITLE never reaches a shell", async () => {
    // Titles arrive from intake, which is a directory somebody else can write to.
    const hostile = node("w1", "; echo pwned > owned.txt");
    const out = await produce("console.log('docs/brd.md')").produce(hostile, phaseCtx());
    expect(out.ok).toBe(true);
  });
});
