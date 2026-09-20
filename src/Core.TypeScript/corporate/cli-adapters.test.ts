/**
 * cli-adapters.test.ts — the three ports that had no command line, and the mapping that gives them one.
 *
 * `httpIntake`, `agentWorkExecutor` and `modelReview` were exported, tested and mutation-checked, and
 * reachable from nothing but tests. `run-org.ts` exists because of exactly that, in its own words:
 * *"an entry point nothing outside a test suite invokes is a library nobody has shipped."*
 *
 * THIS SENTENCE SAID `agentReview` UNTIL 2026-09-04 AND WAS FALSE. The adapter actually given a
 * command line was `modelReview`; `run-org.ts` has never referenced `agentReview`. A file that
 * claims to have closed a gap it did not close is worse than one that never mentioned it, because
 * the claim is what stops anyone checking — so it is corrected here rather than quietly widened.
 *
 * `agentReview` takes a JUDGE FUNCTION, and a function cannot come from argv. It is an embedder
 * seam, exercised in `review-adapters.test.ts`, and its CLI-expressible siblings are the three that
 * do have flags: `directoryReview` (--review-queue), `commandReview` (--review-cmd) and
 * `modelReview` (--review-model). Inventing a fourth flag that spawned a process would be
 * `commandReview` under another name.
 *
 * The interesting half is `trackerMapper`, because it is where a real tracker's schema meets this
 * register's, and where the temptation to GUESS lives. It refuses instead.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { atPath, headersFrom, parseArgs, providersFromArgs, trackerMapper } from "./run-org";
import { commandProposal, modelReview } from "./adapters";
import { Fidelity, Port, type ReviewRequest } from "./providers";
import { GateKind, GateOutcome } from "./quality-gate";
import { RunOutcome } from "./qa";
import { Severity } from "./intake";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";

const scratch = (label: string) => mkdtempSync(join(tmpdir(), `cli-${label}-`));
const SELF = process.execPath;

const node = (workId = "task-1"): CascadeNode => ({
  workId,
  workType: WorkType.Task,
  title: "stall at capture",
  state: WorkState.Open,
  ownerHatId: "tech_lead",
  assigneeHatId: "backend_implementer",
});

describe("atPath", () => {
  test("walks a dotted path, and stops at the first missing hop rather than throwing", () => {
    const body = { issues: [1, 2], fields: { summary: "s", nested: { deep: "d" } } };
    expect(atPath(body, "fields.summary")).toBe("s");
    expect(atPath(body, "fields.nested.deep")).toBe("d");
    expect(atPath(body, "issues")).toEqual([1, 2]);
    expect(atPath(body, "fields.missing.deeper")).toBeUndefined();
    expect(atPath(body, "nope")).toBeUndefined();
    // A path INTO a non-object stops rather than exploding.
    expect(atPath(body, "fields.summary.length")).toBeUndefined();
    expect(atPath(null, "anything")).toBeUndefined();
  });
});

describe("headersFrom", () => {
  test("`k:v` pairs become headers; a value may contain colons", () => {
    expect(headersFrom(["authorization: Bearer abc", "x-trace:1"])).toEqual({
      authorization: "Bearer abc",
      "x-trace": "1",
    });
  });

  test("A PAIR WITH NO COLON IS DROPPED, not turned into a header named ''", () => {
    // An empty header name is rejected by the fetch layer at best and silently sent at worst; either
    // way an operator's typo should not become part of the request.
    expect(headersFrom(["nonsense", ":novalue", ""])).toEqual({});
  });
});

describe("trackerMapper — where a real tracker's schema meets this one", () => {
  const jira = { key: "OPS-77", fields: { summary: "orders stall at capture", priority: "critical", steps: "twice" } };
  const map = [
    "externalId=key",
    "title=fields.summary",
    "severity=fields.priority",
    "reproduction=fields.steps",
  ];

  test("A JIRA-SHAPED ITEM MAPS ONTO AN ExternalEvent — this is the whole feature", () => {
    const event = trackerMapper("jira", map)(jira);
    expect(event.externalId).toBe("OPS-77");
    expect(event.title).toBe("orders stall at capture");
    expect(event.severity).toBe(Severity.Critical);
    expect(event.reproduction).toBe("twice");
    expect(event.source).toBe("jira");
    expect(event.evidenceRefs).toEqual(["jira/OPS-77"]);
  });

  test("NO externalId IS REFUSED, naming the path that was tried", () => {
    // Substituting a placeholder id would put an unidentifiable ticket in the queue — worse than
    // not accepting it, because nobody could ever match it back to the tracker.
    expect(() => trackerMapper("jira", map)({ fields: { summary: "x" } })).toThrow("no externalId at 'key'");
  });

  test("no title is refused, naming the item AND the path", () => {
    expect(() => trackerMapper("jira", map)({ key: "OPS-9" })).toThrow("OPS-9 has no title at 'fields.summary'");
  });

  test("AN UNMAPPED SEVERITY BECOMES LOW, never invented upward", () => {
    // Over-stating urgency from a field nobody mapped would let the tracker's noise set this
    // organization's priorities.
    expect(trackerMapper("jira", ["externalId=key", "title=fields.summary"])(jira).severity).toBe(Severity.Low);
    // ...and an unrecognised value is treated the same way rather than passed through.
    const weird = { key: "K", fields: { summary: "s", priority: "P1-URGENT-!!" } };
    expect(trackerMapper("jira", map)(weird).severity).toBe(Severity.Low);
  });

  test("with no map at all it reads the register's OWN field names", () => {
    // So a tracker that already speaks this vocabulary needs no mapping flags.
    const native = { externalId: "N-1", title: "native", severity: Severity.High, reproduction: "r" };
    const event = trackerMapper("portal", [])(native);
    expect(event.externalId).toBe("N-1");
    expect(event.severity).toBe(Severity.High);
  });

  test("a malformed `--tracker-map` entry is ignored rather than mapping to garbage", () => {
    expect(trackerMapper("t", ["=nopath", "nofield", "externalId=key", "title=fields.summary"])(jira).externalId).toBe("OPS-77");
  });
});

describe("commandProposal — an agent that is a command", () => {
  test("whatever it prints becomes the proposal", () => {
    const perform = commandProposal({
      command: SELF,
      argsFor: () => ["-e", "console.log('I added an idempotency key')"],
      cwd: scratch("prop"),
    });
    const attempt = perform(node(), { branch: "b" });
    expect(attempt.summary).toContain("I added an idempotency key");
  });

  test("IT RUNS IN `ctx.workdir` — the agent and the verifier must judge the SAME tree", () => {
    // Found by the first end-to-end run rather than by reading: the agent wrote into the shared
    // repository while the verifier looked in the change's worktree, so every item failed with the
    // agent confidently reporting success.
    const home = scratch("prop-home");
    const work = scratch("prop-work");
    writeFileSync(join(work, "marker.txt"), "here\n");
    const perform = commandProposal({
      command: SELF,
      argsFor: () => ["-e", "console.log(require('node:fs').existsSync('marker.txt') ? 'in the worktree' : 'in the wrong place')"],
      cwd: home,
    });
    expect(perform(node(), { branch: "b", workdir: work }).summary).toContain("in the worktree");
    expect(perform(node(), { branch: "b" }).summary).toContain("in the wrong place");
  });

  test("A NON-ZERO EXIT THROWS — an agent that failed to run did not produce an empty proposal", () => {
    const perform = commandProposal({
      command: SELF,
      argsFor: () => ["-e", "console.error('model unavailable'); process.exit(2)"],
      cwd: scratch("prop-fail"),
    });
    expect(() => perform(node(), { branch: "b" })).toThrow("exited 2");
  });

  test("an EMPTY proposal throws too — silence beside a passing verifier reads as work done", () => {
    const perform = commandProposal({ command: SELF, argsFor: () => ["-e", "void 0"], cwd: scratch("prop-empty") });
    expect(() => perform(node("task-9"), { branch: "b" })).toThrow("no proposal for task-9");
  });

  test("a missing agent throws rather than returning nothing", () => {
    const perform = commandProposal({
      command: join(scratch("prop-missing"), "nope"),
      argsFor: () => [],
      cwd: scratch("prop-missing-cwd"),
    });
    expect(() => perform(node(), { branch: "b" })).toThrow("could not run");
  });
});

describe("modelReview — a gate judged by a model, clamped to two words", () => {
  const ask = (gate: GateKind = GateKind.ArchitectureApproval): ReviewRequest => ({
    gate,
    workId: "task-1",
    evidence: [{ kind: "trace", ref: "qa:1/1" }],
  });
  const saying = (response: string) => ({ name: "fake-model", complete: async () => response });

  test("approve and reject are honoured, and the model's words are kept as the reason", async () => {
    const yes = await modelReview(saying("approve"), () => "p").review(ask());
    expect(yes.ok && yes.value.outcome).toBe(GateOutcome.Approved);

    const no = await modelReview(saying("reject — no rollback plan"), () => "p").review(ask());
    expect(no.ok).toBe(true);
    if (no.ok) {
      expect(no.value.outcome).toBe(GateOutcome.Rejected);
      expect(no.value.reason).toContain("no rollback plan");
    }
  });

  test("AN UNPARSEABLE ANSWER IS REFUSED IN BOTH DIRECTIONS", async () => {
    // Defaulting to Approved would make a confused model the fastest path to shipping. Defaulting
    // to Rejected would let a flaky endpoint halt an organization while looking like a quality
    // signal. Neither is a verdict, so neither is returned.
    for (const said of ["maybe", "", "I am not sure about this one", "42"]) {
      const r = await modelReview(saying(said), () => "p").review(ask());
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("no clear verdict");
    }
  });

  test("BOTH words in one answer is not a verdict either", async () => {
    const r = await modelReview(saying("I would approve but I might reject"), () => "p").review(ask());
    expect(r.ok).toBe(false);
  });

  test("a model that throws refuses rather than taking the organization down", async () => {
    const r = await modelReview(
      { name: "fake-model", complete: async () => { throw new Error("connection refused"); } },
      () => "p",
    ).review(ask());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("connection refused");
  });

  test("the gate reaches the PROMPT, and the port says it is real", async () => {
    const prompts: string[] = [];
    const port = modelReview(
      { name: "fake-model", complete: async (p: string) => { prompts.push(p); return "approve"; } },
      (request) => `judging ${request.gate}`,
    );
    await port.review(ask(GateKind.ReleaseReadiness));
    expect(prompts).toEqual(["judging release_readiness"]);
    expect(port.meta.fidelity).toBe(Fidelity.Real);
    expect(port.meta.describes).toContain("never defaulted");
  });
});

describe("the flags reach the ports", () => {
  test("--tracker makes intake REAL and http-backed", () => {
    const set = providersFromArgs(parseArgs(["--tracker", "http://tracker.invalid/x"]), [], RunOutcome.Passed);
    expect(set.intake.meta.fidelity).toBe(Fidelity.Real);
    expect(set.intake.meta.describes).toContain("tracker.invalid");
  });

  test("--work-agent AND --work-verify together make work an agent; either alone does not", () => {
    // Deliberate: an agent with no verifier would be an agent judging itself, which is the one
    // arrangement this port exists to refuse. Half the flags is a mistake, not a mode.
    const both = providersFromArgs(parseArgs(["--work-agent", "a", "--work-verify", "v"]), [], RunOutcome.Passed);
    expect(both.work.meta.name).toBe("agent");
    expect(both.work.meta.fidelity).toBe(Fidelity.Real);

    const agentOnly = providersFromArgs(parseArgs(["--work-agent", "a"]), [], RunOutcome.Passed);
    expect(agentOnly.work.meta.fidelity).toBe(Fidelity.Simulated);
    const verifyOnly = providersFromArgs(parseArgs(["--work-verify", "v"]), [], RunOutcome.Passed);
    expect(verifyOnly.work.meta.fidelity).toBe(Fidelity.Simulated);
  });

  test("--review-model makes review REAL; absent it is the labelled rubber stamp", () => {
    const model = providersFromArgs(parseArgs(["--review-model", "qwen2.5:0.5b"]), [], RunOutcome.Passed);
    expect(model.review.meta.port).toBe(Port.Review);
    expect(model.review.meta.fidelity).toBe(Fidelity.Real);

    const none = providersFromArgs(parseArgs([]), [], RunOutcome.Passed);
    expect(none.review.meta.fidelity).toBe(Fidelity.Simulated);
    expect(none.review.meta.describes).toContain("consults nobody");
  });

  test("a tracker beats an inbox when both are given, and the run says which one it used", () => {
    const set = providersFromArgs(
      parseArgs(["--tracker", "http://tracker.invalid/x", "--inbox", "/tmp/in"]),
      [],
      RunOutcome.Passed,
    );
    expect(set.intake.meta.name).toBe("http");
  });
});

describe("commandProposal — its own argv is not an artifact", () => {
  // MEASURED on the Waypoint run, 2026-09-20: every code item listed three attachments —
  // `agent.cjs`, `work`, `task-021` — the command line the performer was invoked with, recorded
  // as what it produced. A reviewer opened them, found a script and two words, and rejected the
  // gate for want of a deliverable. What an agent produced is in its checkout and its testimony;
  // the way it was called is nobody's evidence.
  test("a proposal carries the agent's testimony and no argv", () => {
    const perform = commandProposal({ command: process.execPath, argsFor: () => ["-e", "process.stdout.write('done')"], cwd: process.cwd() });
    const a = perform({ workId: "task-1", workType: "task", title: "t", state: "open", ownerHatId: "lead" } as never, { branch: "b" });
    expect(a.summary).toContain("done");
    expect(a.artifacts).toEqual([]);
  });
});
