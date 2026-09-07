/**
 * signal-durability.test.ts — the upward channel has to survive a process boundary.
 *
 * ── THE QUESTION THIS ANSWERS ────────────────────────────────────────────────
 * "Do we need the agent bus?" turned on one measurable thing: whether a supervisor signal
 * survives being written down. It did not. `supervisor_signal_sent` carried
 * `decision: "<tool> → <hat>"` and no fact, so the routed, evidenced signal was flattened to a
 * sentence the moment it was logged — fourteen other event kinds carried a value and this one did
 * not. A second process could read THAT a signal happened and not WHAT WAS ASKED.
 *
 * That is what made the gap look bus-shaped. It is not: corporate already has a content-addressed,
 * append-only, idempotent store that folds. The channel needed a fact, not a second substrate.
 *
 * So the load-bearing test here writes a run to disk, reads it back through a SEPARATE fold, and
 * asks the question a second process would ask: what is waiting for me?
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentsFromChart, runOrgRuntime, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { appendRun, readEvents } from "./org-store";
import { conversationOn, foldBoard, foldEscalations, foldSupervisorSignals, signalsTo } from "./org-fold";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

function deps(over: Partial<OrgRuntimeDeps> = {}): OrgRuntimeDeps {
  let n = 0;
  return {
    chart,
    externalEvents: [{ source: "t", externalId: "T-1", title: "checkout double charge", body: "b" }],
    agents: agentsFromChart(chart),
    observations: [],
    acceptingHatId: "cto",
    resourceAuthorityHatId: "rmo_office",
    priorityDeciderHatId: "cto",
    createId: (p) => `${p}-${String(++n).padStart(3, "0")}`,
    nowMs: 0,
    workBlockMs: 3_600_000,
    leaseMs: 300_000,
    priorityInputsFor: () => ({
      executivePriority: 0.5,
      customerImpact: 1,
      severity: 1,
      releaseRisk: 0.2,
      blockedDownstreamCount: 2,
      dependencyFanOut: 1,
      queueAgeMs: 0,
      hatScarcity: 0,
      budgetBurn: 0,
      estimatedEffort: 0.2,
    }),
    ...over,
  } as OrgRuntimeDeps;
}

/** Write a run to a fresh store and read the events back, as a second process would. */
async function roundTrip(runDeps: OrgRuntimeDeps = deps()) {
  const root = mkdtempSync(join(tmpdir(), "zeta-sig-"));
  const report = await runOrgRuntime(runDeps);
  appendRun(
    {
      atMs: 0,
      delivered: report.delivered,
      levelsEngaged: report.levelsEngaged,
      refusals: report.refusals,
      trace: report.trace,
      replayable: report.fidelity.replayable,
      realPorts: report.fidelity.realPorts,
    },
    root,
  );
  // READ FROM DISK. Not `report.trace` — that is the in-memory value, and the whole question is
  // whether the signal survives being written down and read by someone who was not there.
  const fromDisk = readEvents(root);
  rmSync(root, { recursive: true, force: true });
  return { report, fromDisk };
}

describe("A SIGNAL SURVIVES THE STORE — the upward channel crosses a process", () => {
  test("the run sends signals at all", async () => {
    const { report } = await roundTrip();
    expect(report.signals.length).toBeGreaterThan(0);
  });

  test("...and every one of them comes back off DISK as a value, not a sentence", async () => {
    // The defect this replaces: the event carried `decision: "<tool> → <hat>"` and no fact, so
    // this fold returned nothing and the channel ended at the process boundary.
    const { report, fromDisk } = await roundTrip();
    const folded = foldSupervisorSignals(fromDisk);
    expect(folded.length).toBe(report.signals.length);
  });

  test("THE STRUCTURE SURVIVES — tool, routing, evidence and message, not just the fact one was sent", async () => {
    const { report, fromDisk } = await roundTrip();
    const sent = report.signals[0];
    const read = foldSupervisorSignals(fromDisk).find((s) => s.signalId === sent?.signalId);
    expect(read).toBeDefined();
    expect(read?.tool).toBe(sent!.tool);
    expect(read?.fromHatId).toBe(sent!.fromHatId);
    expect(read?.toHatId).toBe(sent!.toHatId);
    expect(read?.message).toBe(sent!.message);
    // Evidence especially: a signal whose evidence did not survive is one the supervisor must
    // re-derive, which is the thing `evidenceSatisfies` refuses to let a sender skip.
    expect(read?.evidence.length).toBe(sent!.evidence.length);
  });

  test("'WHAT IS WAITING FOR ME?' is answerable from disk alone", async () => {
    // The question a second process actually asks. Answering it needs no bus — the store and a
    // fold are enough, because the signal is a fact in the same log as everything else.
    const { report, fromDisk } = await roundTrip();
    const target = report.signals[0]?.toHatId;
    expect(target).toBeDefined();
    const waiting = signalsTo(fromDisk, target!);
    expect(waiting.length).toBeGreaterThan(0);
    for (const s of waiting) expect(s.toHatId).toBe(target!);
  });

  test("a hat nobody signalled has nothing waiting — an empty answer, not a wrong one", async () => {
    const { fromDisk } = await roundTrip();
    expect(signalsTo(fromDisk, "no_such_hat")).toEqual([]);
  });
});

describe("ESCALATIONS survive as DECISIONS", () => {
  test("an escalating run's decisions come back off disk", async () => {
    // Forced by making every gate reject, so the churn threshold trips and the runtime escalates.
    const { report, fromDisk } = await roundTrip(deps({ qaFallback: "failed" } as Partial<OrgRuntimeDeps>));
    const folded = foldEscalations(fromDisk);
    // EXPLICITLY NON-ZERO first. `folded.length === report.escalations.length` alone passes as
    // 0 === 0 if this fixture ever stops escalating, and the test would then assert nothing while
    // still looking like a round-trip check. Measured: this deps set produces 2.
    expect(report.escalations.length).toBeGreaterThan(0);
    expect(folded.length).toBe(report.escalations.length);
    for (const e of folded) {
      expect(e.action).not.toBe("");
      expect(e.byHatId).not.toBe("");
      // The trigger too: an escalation without its cause is a decision nobody can review.
      expect(e.trigger).not.toBe("");
    }
  });

  test("a run with no escalations folds to none, rather than to something", async () => {
    const { report, fromDisk } = await roundTrip();
    expect(foldEscalations(fromDisk).length).toBe(report.escalations.length);
  });
});

describe("the folds are separate because the questions are", () => {
  test("SIGNALS ARE ASKING AND ESCALATIONS ARE DECIDING — one list is not the other", async () => {
    // A caller wanting to know what was DECIDED should not have to filter a list of REQUESTS.
    const { fromDisk } = await roundTrip();
    const signals = foldSupervisorSignals(fromDisk);
    const escalations = foldEscalations(fromDisk);
    expect(signals.length).toBeGreaterThan(0);
    // Disjoint by construction — no fact is both kinds.
    expect(escalations.some((e) => signals.some((s) => s.signalId === e.taskId))).toBe(false);
  });

  test("folding an empty log yields empty lists, never undefined", async () => {
    expect(foldSupervisorSignals([])).toEqual([]);
    expect(foldEscalations([])).toEqual([]);
    expect(signalsTo([], "anyone")).toEqual([]);
  });
});

describe("THE DELIBERATION SURVIVES TOO — anchors, decisions and their rationale", () => {
  test("the board comes back off disk with the anchors the run opened", async () => {
    // Before these facts existed the board was an in-memory value returned in the report and
    // recorded nowhere: `decision_recorded` was an event kind with ZERO emitters, so every anchor,
    // post and decision vanished with the process that produced it.
    const { report, fromDisk } = await roundTrip();
    const folded = foldBoard(fromDisk);
    expect(report.board.anchors.length).toBeGreaterThan(0);
    expect(folded.anchors.length).toBe(report.board.anchors.length);
  });

  test("A DECISION KEEPS ITS RATIONALE — the thing that makes it revisitable", async () => {
    const { report, fromDisk } = await roundTrip();
    const folded = foldBoard(fromDisk);
    expect(report.board.decisions.length).toBeGreaterThan(0);
    expect(folded.decisions.length).toBe(report.board.decisions.length);
    for (const d of folded.decisions) {
      // A decision without a recorded reason is permanent by accident: when circumstances change
      // nobody can tell whether the reason still holds.
      expect(d.rationale.trim()).not.toBe("");
      expect(d.decision.trim()).not.toBe("");
    }
  });

  test("ANCHOR STATE IS LAST-WINS — a resolved anchor reads as resolved, not as opened", async () => {
    // The asymmetry the fold encodes: state collapses to the newest, posts and decisions append.
    const { fromDisk } = await roundTrip();
    const folded = foldBoard(fromDisk);
    const resolved = folded.anchors.filter((a) => a.state === "resolved");
    expect(resolved.length).toBeGreaterThan(0);
  });

  test("a state change for an anchor the log never opened is IGNORED, not invented", () => {
    // A fabricated anchor would carry no purpose and no expected output, so it would resolve
    // vacuously — the fold would manufacture a deliberation nobody had.
    const folded = foldBoard([
      {
        id: "e1",
        kind: "decision_recorded",
        atMs: 1,
        subjectId: "ghost",
        decision: "x",
        supervisorChain: [],
        evidenceRefs: [],
        fact: { kind: "anchor_state", anchorId: "ghost", state: "resolved" },
      },
    ] as never);
    expect(folded.anchors).toEqual([]);
  });

  test("re-folding the same log does not duplicate an anchor — idempotent", async () => {
    const { fromDisk } = await roundTrip();
    const once = foldBoard(fromDisk);
    const twice = foldBoard([...fromDisk, ...fromDisk]);
    expect(twice.anchors.length).toBe(once.anchors.length);
  });

  test("a conversation reads back in TIME ORDER, and an anchor nobody spoke on is empty", async () => {
    // `conversationOn` is the question a team member asks: what has been said here? The runtime
    // does not yet POST to anchors — it opens, decides and resolves — so this is empty today and
    // the emptiness is honest rather than hidden.
    const { fromDisk } = await roundTrip();
    const anchorId = foldBoard(fromDisk).anchors[0]?.anchorId;
    expect(anchorId).toBeDefined();
    const said = conversationOn(fromDisk, anchorId!);
    const times = said.map((p) => p.atMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(conversationOn(fromDisk, "no-such-anchor")).toEqual([]);
  });
});

/**
 * Posts, built as facts directly.
 *
 * NOT a convenience: the runtime does not post to anchors at all — it opens, decides and resolves —
 * so a log produced by a real run contains ZERO posts, and every assertion about post handling over
 * such a log is vacuous. Three mutants proved it, surviving a matrix by breaking code no test could
 * reach: dropping posts, unordering a conversation, and ignoring the anchor filter all changed
 * nothing, because there was nothing to change.
 *
 * These falsifiers therefore drive the fold with the facts a conversation WOULD produce. They make
 * the fold trustworthy; they do not make the runtime hold conversations, and the test below says so.
 */
function postEvent(id: string, anchorId: string, atMs: number, byHatId: string, refs: string[]) {
  return {
    id,
    kind: "decision_recorded",
    atMs,
    subjectId: anchorId,
    decision: "said something",
    supervisorChain: [],
    evidenceRefs: refs,
    fact: {
      kind: "anchor_post",
      post: {
        postId: id,
        anchorId,
        byHatId,
        atMs,
        body: `body of ${id}`,
        evidence: refs.map((ref) => ({ kind: "document", ref })),
      },
    },
  } as never;
}

describe("a conversation over ARTIFACTS, folded from the log", () => {
  const log = [
    postEvent("p3", "a1", 300, "tech_lead", ["doc:design@sha3"]),
    postEvent("p1", "a1", 100, "solution_architect", ["doc:design@sha1"]),
    postEvent("p2", "a1", 200, "qa_director", ["doc:design@sha2", "doc:tests@sha2"]),
    postEvent("x1", "a2", 150, "tech_lead", ["doc:other@sha1"]),
  ];

  test("POSTS SURVIVE THE FOLD — a dropped post is a turn nobody can read", () => {
    expect(foldBoard(log).posts.length).toBe(4);
  });

  test("A CONVERSATION IS TIME-ORDERED — iteration only reads as iteration in sequence", () => {
    // Out of order, "the architect proposed and QA answered" becomes two unrelated remarks.
    expect(conversationOn(log, "a1").map((p) => p.postId)).toEqual(["p1", "p2", "p3"]);
  });

  test("...and is SCOPED TO ITS ANCHOR — one deliberation is not another", () => {
    expect(conversationOn(log, "a1").map((p) => p.postId)).not.toContain("x1");
    expect(conversationOn(log, "a2").map((p) => p.postId)).toEqual(["x1"]);
  });

  test("EACH TURN CARRIES THE ARTIFACTS IT POINTED AT, at the revision it saw", () => {
    // This is what makes it iterating over artifacts rather than chatting about them: turn two
    // cites a different revision of the same document than turn one.
    const said = conversationOn(log, "a1");
    expect(said[0]?.evidence.map((e) => e.ref)).toEqual(["doc:design@sha1"]);
    expect(said[1]?.evidence.map((e) => e.ref)).toEqual(["doc:design@sha2", "doc:tests@sha2"]);
    expect(said[2]?.evidence.map((e) => e.ref)).toEqual(["doc:design@sha3"]);
  });

  test("different hats speak on one anchor — the 'team' half of a team conversation", () => {
    expect([...new Set(conversationOn(log, "a1").map((p) => p.byHatId))].length).toBe(3);
  });

  test("THE RUNTIME ITSELF POSTS NOTHING — stated, so this file is not read as proof that it does", async () => {
    // The gap these falsifiers do NOT close. `org-runtime` opens an anchor, records a decision and
    // resolves it: one hop, no turns. Team iteration over artifacts is machinery that exists and is
    // not yet driven, and a passing conversation test over synthetic facts must not be mistaken for
    // evidence that agents are conversing.
    const { fromDisk } = await roundTrip();
    expect(foldBoard(fromDisk).posts).toEqual([]);
  });
});
