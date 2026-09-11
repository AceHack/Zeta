/**
 * asks-and-resumes.test.ts — the two properties that make long-running, human-light work possible.
 *
 * An organization that cannot ask has to guess. An organization that cannot resume forgets what it
 * asked. Both were missing, and each hid the other: the answer channel looked broken when in fact
 * the questions were being addressed to work the next run had already replaced.
 *
 * Neither property is about software delivery, and nothing here names a question, a hat, or a
 * stage. That is the point — an organization configured with different SDLC steps gets different
 * behaviour out of exactly this code.
 */

import { describe, expect, test } from "bun:test";
import { ASK_PREFIX, commandArtifactProducer, learningsFrom } from "./adapters";
import { GateKind } from "./quality-gate";
import { WorkState, WorkType, type Cascade, type CascadeNode } from "./goal-cascade";
import { runUntilSettled } from "./autonomy";
import type { OrgRuntimeDeps, OrgRuntimeReport } from "./org-runtime";

const NODE = process.execPath;

function nodeAt(over: Partial<CascadeNode> = {}): CascadeNode {
  return {
    workId: "w-1",
    workType: WorkType.Task,
    title: "a piece of work",
    state: WorkState.Open,
    ownerHatId: "tech_lead",
    ...over,
  } as CascadeNode;
}

describe("AN AGENT CAN ASK — the channel, never the questionnaire", () => {
  // THE DEFECT: a producer that could not proceed had exactly one way to say so — fail — and the
  // refusal reached nobody. The first repair was worse: a module that decided, by regular
  // expression, what makes a requirement ambiguous and wrote out the ten questions to ask about it.
  // That org could only ever ask what its author had thought of.
  test("a step that asks REFUSES, and the questions travel with the refusal", async () => {
    const producer = commandArtifactProducer({
      command: NODE,
      gate: GateKind.BusinessContextGrooming,
      cwd: process.cwd(),
      argsFor: () => [
        "-e",
        `process.stdout.write("${ASK_PREFIX}Who is this for?\\n${ASK_PREFIX}What is done?\\n")`,
      ],
    });

    const r = await producer.produce(nodeAt(), { branch: "b", priorArtifacts: new Map() });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.questions).toEqual(["Who is this for?", "What is done?"]);
  });

  test("asking and producing at once is REFUSED — a guess with the uncertainty stripped off", async () => {
    // An agent that writes the document AND asks what should have been in it has produced a guess.
    // Letting both through would hand a reviewer the guess and not the doubt.
    const producer = commandArtifactProducer({
      command: NODE,
      gate: GateKind.BrdApproval,
      cwd: process.cwd(),
      argsFor: () => ["-e", `process.stdout.write("/tmp/brd.md\\n${ASK_PREFIX}But who signs it off?\\n")`],
    });
    const r = await producer.produce(nodeAt(), { branch: "b", priorArtifacts: new Map() });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.questions).toEqual(["But who signs it off?"]);
  });

  test("a step that asks nothing is unaffected — the line shape is additive", async () => {
    const producer = commandArtifactProducer({
      command: NODE,
      gate: GateKind.BrdApproval,
      cwd: process.cwd(),
      argsFor: () => ["-e", 'process.stdout.write("/tmp/brd.md\\n")'],
    });
    const r = await producer.produce(nodeAt(), { branch: "b", priorArtifacts: new Map() });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.refs).toEqual(["/tmp/brd.md"]);
  });

  test("an ordinary failure asks NOTHING — the person is not the error handler", async () => {
    // The direction that matters: an internal failure must not leave through the escape hatch, or
    // every broken tool becomes a question somebody has to answer.
    const producer = commandArtifactProducer({
      command: NODE,
      gate: GateKind.BrdApproval,
      cwd: process.cwd(),
      argsFor: () => ["-e", "process.exit(1)"],
    });
    const r = await producer.produce(nodeAt(), { branch: "b", priorArtifacts: new Map() });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.questions ?? []).toEqual([]);
  });

  test("the brief and prior answers reach the step, so it need not ask twice", async () => {
    // The other half of the channel. Without it an agent asks the same question forever and the
    // organization looks like it is consulting a person while learning nothing from them.
    const producer = commandArtifactProducer({
      command: NODE,
      gate: GateKind.BusinessContextGrooming,
      cwd: process.cwd(),
      argsFor: () => [
        "-e",
        'process.stdout.write("title=" + process.env.ORG_WORK_TITLE + " answers=" + process.env.ORG_ANSWERS + "\\n")',
      ],
      answersFor: () => [{ question: "Who is this for?", answer: "Support staff." }],
    });
    const r = await producer.produce(nodeAt({ title: "Ship a shortener" }), {
      branch: "b",
      priorArtifacts: new Map(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    const said = r.value.refs.join(" ");
    expect(said).toContain("title=Ship a shortener");
    expect(said).toContain("Support staff.");
  });
});

describe("WHAT A PERSON SAID REACHES THE AGENT THAT MUST ACT ON IT", () => {
  // THE DEFECT: a queued rejection reached the runtime as `{ outcome, actionRef }`. The review
  // itself — the sentences saying what was wrong — stayed on the action and reached nobody, so an
  // author redoing the step was told it had been rejected and not why. An organization that turns
  // work back without saying why is not reviewing it.
  test("a reviewer's objection is handed to the author, verbatim", async () => {
    const producer = commandArtifactProducer({
      command: NODE,
      gate: GateKind.BrdApproval,
      cwd: process.cwd(),
      argsFor: () => ["-e", 'process.stdout.write("said=" + process.env.ORG_FEEDBACK)'],
      feedbackFor: () => [{ gate: "brd_approval", said: "No mention of what happens to expired links." }],
    });
    const r = await producer.produce(nodeAt(), { branch: "b", priorArtifacts: new Map() });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.refs.join(" ")).toContain("No mention of what happens to expired links.");
  });

  test("no rejection means no feedback variable at all — absence is not an empty review", async () => {
    const producer = commandArtifactProducer({
      command: NODE,
      gate: GateKind.BrdApproval,
      cwd: process.cwd(),
      argsFor: () => ["-e", 'process.stdout.write("has=" + String(process.env.ORG_FEEDBACK !== undefined))'],
    });
    const r = await producer.produce(nodeAt(), { branch: "b", priorArtifacts: new Map() });
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.refs.join(" ")).toContain("has=false");
  });

  // THE DEFECT: `skill-binding.resolve` was called by the configure planner and by `org skill list`,
  // and by nothing that runs work. An operator could bind a skill, see it listed against the right
  // gate, and no agent would ever hear about it.
  test("the skill this organization bound reaches the step, with the reason it was chosen", async () => {
    const producer = commandArtifactProducer({
      command: NODE,
      gate: GateKind.ImplementationReview,
      cwd: process.cwd(),
      argsFor: () => [
        "-e",
        'process.stdout.write([process.env.ORG_SKILL, process.env.ORG_SKILL_SOURCE, process.env.ORG_SKILL_WHY].join("|"))',
      ],
      skillFor: () => ({ bound: true, skill: "add-test", source: "repo", because: "bound organization-wide" }),
    });
    const r = await producer.produce(nodeAt(), { branch: "b", priorArtifacts: new Map() });
    if (!r.ok) throw new Error("unreachable");
    // The `because` travels too: a fallback nobody can see is what makes people distrust config.
    expect(r.value.refs.join(" ")).toContain("add-test|repo|bound organization-wide");
  });
});

describe("A HARD-WON PROCEDURE BECOMES SOMETHING THE NEXT AGENT INHERITS", () => {
  // THE DEFECT: memories came from a STUDY session or from a CALIBRATION. Neither covers an agent,
  // mid-task, working out how a difficult thing is actually done here — which is the knowledge that
  // costs the most to reacquire. It died with the process.
  test("a lesson is parsed off the step's own output, with the key it will be found by", () => {
    const got = learningsFrom([
      "/tmp/doc.md",
      "learned: elera-surefire-flag :: surefire 3.x ignores -DfailIfNoTests.",
      "relied on some/ref",
    ]);
    expect(got).toEqual([{ key: "elera-surefire-flag", value: "surefire 3.x ignores -DfailIfNoTests." }]);
  });

  test("a lesson with no key gets a stable one derived from its own words", () => {
    // So the same lesson written twice REINFORCES rather than accumulating near-duplicates that
    // nobody can find. The key must not depend on when it was written.
    const once = learningsFrom(["learned: the maven wrapper must be invoked through the shell here"]);
    const twice = learningsFrom(["learned: the maven wrapper must be invoked through the shell here"]);
    expect(once[0]?.key).toBe(twice[0]?.key);
    expect(once[0]?.key).not.toBe("");
  });

  test("only the FIRST separator splits — a lesson may contain another one", () => {
    const got = learningsFrom(["learned: k :: use a :: b form in the config file"]);
    expect(got[0]?.key).toBe("k");
    expect(got[0]?.value).toBe("use a :: b form in the config file");
  });

  test("a lesson is NOT an artifact — it never stands in for the thing the gate judges", async () => {
    // A step that both did the work and learned something reports both; the gate still judges only
    // what was produced. Counting a lesson as a document would let an agent pass a gate by
    // reflecting on it.
    const producer = commandArtifactProducer({
      command: NODE,
      gate: GateKind.BrdApproval,
      cwd: process.cwd(),
      argsFor: () => [
        "-e",
        'process.stdout.write("/tmp/brd.md" + String.fromCharCode(10) + "learned: k :: something hard")',
      ],
    });
    const r = await producer.produce(nodeAt(), { branch: "b", priorArtifacts: new Map() });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.refs).toEqual(["/tmp/brd.md"]);
    expect(r.value.learned).toEqual([{ key: "k", value: "something hard" }]);
  });

  test("a step that ASKED can still have learned something", async () => {
    // The two are independent: working out that a tool needs a flag does not stop you needing a
    // business decision, and losing the lesson because a question came with it would throw away the
    // expensive half.
    const producer = commandArtifactProducer({
      command: NODE,
      gate: GateKind.BusinessContextGrooming,
      cwd: process.cwd(),
      argsFor: () => [
        "-e",
        'process.stdout.write("ask: who owns this?" + String.fromCharCode(10) + "learned: k :: something hard")',
      ],
    });
    const r = await producer.produce(nodeAt(), { branch: "b", priorArtifacts: new Map() });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.questions).toEqual(["who owns this?"]);
  });
});

describe("THE LOOP CONTINUES ITSELF — cycles that can see each other", () => {
  // THE DEFECT: `priorCascade` was read from the store once, BEFORE the loop, so every cycle saw
  // the same empty history, accepted the same intake again and minted a whole new goal, initiative,
  // project and pair of leaves. MEASURED: one run of five cycles left five parallel cascades for a
  // single request, and questions raised by cycle one were addressed to work cycle two had already
  // replaced. A loop whose iterations cannot see each other is the first cycle run repeatedly.
  test("each cycle is handed what the last one left", async () => {
    const seen: (readonly string[])[] = [];
    let n = 0;

    const cascadeAfter = (count: number): Cascade => ({
      nodes: Array.from({ length: count }, (_, i) => nodeAt({ workId: `w-${String(i)}` })),
    });

    const run = async (deps: OrgRuntimeDeps): Promise<OrgRuntimeReport> => {
      seen.push((deps.priorCascade?.nodes ?? []).map((x) => x.workId));
      n += 1;
      // PROGRESS MUST DIFFER EACH CYCLE, or the loop stops on its own `NoProgress` rule at cycle
      // two — correctly, and this test would then be asserting the stop rather than the carry.
      return {
        delivered: false,
        halted: [],
        cascade: cascadeAfter(n),
        gateEvaluations: Array.from({ length: n }, () => ({}) as never),
        changesLanded: Array.from({ length: n }, (_, i) => `c-${String(i)}`),
        workItemsDone: Array.from({ length: n }, (_, i) => `w-${String(i)}`),
      } as unknown as OrgRuntimeReport;
    };

    await runUntilSettled({ priorCascade: { nodes: [] } } as unknown as OrgRuntimeDeps, { maxCycles: 3 }, run);

    // Cycle 1 sees the empty history it was given; cycle 2 sees cycle 1's result; cycle 3 sees
    // cycle 2's. Anything else means the cycles are independent runs wearing a loop's clothes.
    expect(seen[0]).toEqual([]);
    expect(seen[1]).toEqual(["w-0"]);
    expect(seen[2]).toEqual(["w-0", "w-1"]);
  });
});
