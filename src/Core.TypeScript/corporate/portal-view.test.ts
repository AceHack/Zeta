/**
 * portal-view.test.ts — the page may not be told anything the log does not know.
 *
 * These views feed a delivery portal, which is the situation where a backend usually grows fields
 * because a design asked for them. The properties under test are the three absences that keep that
 * from happening here: an unpriced run has no cost, an adapter that cannot diff is distinguishable
 * from a branch with no changes, and a document list contains only things that can be opened.
 */

import { describe, expect, test } from "bun:test";

import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { OrgEventKind, type OrgEvent } from "./org-event";
import { foldOrganization } from "./org-fold";
import { externalRefOf } from "./intake";
import { Fidelity, Port } from "./providers";
import type { PortMeter } from "./meter";
import {
  activityViews,
  answeredNotApplied,
  baseName,
  agentViews,
  changeViews,
  documentViews,
  portalSummary,
  spendForWork,
  unattributedSpend,
  workIdsForRequest,
} from "./portal-view";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const REF = externalRefOf("jira", "AIAGENT-1637");

let seq = 0;
function ev(
  atMs: number,
  fact: NonNullable<OrgEvent["fact"]>,
  subjectId = "task-1",
  actorHatId?: string,
): OrgEvent {
  return {
    id: `e-${String(seq++)}`,
    kind: OrgEventKind.DecisionRecorded,
    atMs,
    subjectId,
    decision: "recorded",
    supervisorChain: [],
    evidenceRefs: [],
    ...(actorHatId === undefined ? {} : { actorHatId }),
    fact,
  };
}

const meter = (over: Partial<PortMeter> = {}): PortMeter => ({
  port: Port.WorkExecution,
  provider: "artifact",
  fidelity: Fidelity.Real,
  startedMs: 0,
  durationMs: 100,
  ok: true,
  ...over,
});

/** A work item under a request, so the per-request folds have something to key on. */
function created(workId: string, ownerHatId: string, requestRef?: string): OrgEvent {
  return ev(1, {
    kind: "work_created",
    workId,
    workType: "task",
    title: `do ${workId}`,
    ownerHatId,
    ...(requestRef === undefined ? {} : { requestRef }),
  } as NonNullable<OrgEvent["fact"]>, workId);
}

describe("DOCUMENTS: only what a reader can actually open", () => {
  const base = [
    created("task-1", "test_first_engineer", REF),
    ev(10, {
      kind: "document_written",
      workId: "task-1",
      gate: "brd_approval",
      path: "docs/1637/business-case.md",
      bytes: 1900,
      producedByHatId: "test_first_engineer",
    }),
    ev(20, {
      kind: "document_written",
      workId: "task-1",
      gate: "architecture_approval",
      path: "docs/1637/approach.md",
      bytes: 1400,
      producedByHatId: "test_first_engineer",
    }),
  ];

  test("a document carries its step, its author's NAME, and its size", () => {
    const folded = foldOrganization(base);
    const docs = documentViews(chart, folded, ["task-1"]);
    expect(docs.length).toBe(2);
    expect(docs[0]?.name).toBe("business-case.md");
    expect(docs[0]?.bytes).toBe(1900);
    // The hat id is the key; the page shows the name. A page that shows `backend_engineer` is the
    // readability complaint this whole redesign started from.
    expect(docs[0]?.producedBy).not.toBe("test_first_engineer");
    expect(docs[0]?.gateLabel.length).toBeGreaterThan(0);
  });

  test("oldest first, because a reader following a ticket is following time", () => {
    expect(documentViews(chart, foldOrganization(base), ["task-1"]).map((d) => d.name)).toEqual([
      "business-case.md",
      "approach.md",
    ]);
  });

  test("awaitingDecision is DERIVED from what is actually held, not stored on the file", () => {
    const folded = foldOrganization(base);
    const held = documentViews(chart, folded, ["task-1"], [
      { workId: "task-1", gate: "architecture_approval" },
    ]);
    expect(held.find((d) => d.name === "approach.md")?.awaitingDecision).toBe(true);
    expect(held.find((d) => d.name === "business-case.md")?.awaitingDecision).toBe(false);
    // Once the checkpoint clears, nothing has to be un-set: the flag was never stored.
    expect(documentViews(chart, folded, ["task-1"]).every((d) => !d.awaitingDecision)).toBe(true);
  });

  test("a WINDOWS path still yields a file name, not the whole path", () => {
    // Every fixture in this repo uses forward slashes, so `split("/")` passed all of them and
    // rendered `C:\Users\...\brd_approval.md` as the NAME on a real run.
    expect(baseName(String.raw`C:\Users\me\docs\task-1\brd_approval.md`)).toBe("brd_approval.md");
    expect(baseName("docs/1637/approach.md")).toBe("approach.md");
    expect(baseName("no-separators.md")).toBe("no-separators.md");
  });

  test("the decision is the LAST file written, not one matching the gate's name", () => {
    // The checkpoint gate usually has no producer of its own — `architecture_approval` judges what
    // `architecture_design` wrote — so keying the flag on the gate name made it unfireable.
    //
    // The holding gate here appears on NO document, which is what makes this discriminating: under
    // the old gate-keyed join nothing at all would be marked. Asserted below, because a fixture
    // that happened to contain the gate would pass either way — my first version of this test did.
    const holdingGate = "cost_review";
    expect(base.every((e) => (e.fact as { gate?: string }).gate !== holdingGate)).toBe(true);
    const docs = documentViews(chart, foldOrganization(base), ["task-1"], [
      { workId: "task-1", gate: holdingGate },
    ]);
    expect(docs.filter((d) => d.awaitingDecision).map((d) => d.name)).toEqual(["approach.md"]);
  });

  test("exactly one document per held item is the decision", () => {
    const docs = documentViews(chart, foldOrganization(base), ["task-1"], [
      { workId: "task-1", gate: "cost_review" },
    ]);
    expect(docs.filter((d) => d.awaitingDecision).length).toBe(1);
  });

  test("a hold on a DIFFERENT work item does not light up this one's document", () => {
    const docs = documentViews(chart, foldOrganization(base), ["task-1"], [
      { workId: "task-9", gate: "architecture_approval" },
    ]);
    expect(docs.every((d) => !d.awaitingDecision)).toBe(true);
  });

  test("documents belonging to other work are not listed", () => {
    const folded = foldOrganization([
      ...base,
      ev(30, {
        kind: "document_written",
        workId: "task-2",
        gate: "brd_approval",
        path: "docs/other/x.md",
        bytes: 10,
        producedByHatId: "test_first_engineer",
      }),
    ]);
    expect(documentViews(chart, folded, ["task-1"]).map((d) => d.workId)).toEqual(["task-1", "task-1"]);
  });

  test("a rewritten document shows the latest version, not the one already turned down", () => {
    const folded = foldOrganization([
      ...base,
      ev(99, {
        kind: "document_written",
        workId: "task-1",
        gate: "architecture_approval",
        path: "docs/1637/approach.md",
        bytes: 2600,
        producedByHatId: "test_first_engineer",
      }),
    ]);
    const approach = documentViews(chart, folded, ["task-1"]).filter((d) => d.name === "approach.md");
    expect(approach.length).toBe(1);
    expect(approach[0]?.bytes).toBe(2600);
  });
});

describe("CHANGES: 'cannot tell you' is not 'nothing changed'", () => {
  const opened = ev(5, {
    kind: "change_opened",
    workId: "task-1",
    changeId: "c1",
    branch: "agent/1637",
  });

  test("an adapter that cannot diff yields undefined files, never an empty list", () => {
    const view = changeViews(foldOrganization([opened]), ["task-1"])[0];
    expect(view?.branch).toBe("agent/1637");
    // The distinction the whole field exists for.
    expect(view?.files).toBeUndefined();
    expect(view?.added).toBeUndefined();
  });

  test("an adapter that diffed and found nothing yields an EMPTY list, which is a finding", () => {
    const folded = foldOrganization([
      opened,
      ev(6, { kind: "change_files", workId: "task-1", changeId: "c1", files: [] }),
    ]);
    const view = changeViews(folded, ["task-1"])[0];
    expect(view?.files).toEqual([]);
    expect(view?.added).toBe(0);
  });

  test("counts are summed from the adapter's own diff", () => {
    const folded = foldOrganization([
      opened,
      ev(6, {
        kind: "change_files",
        workId: "task-1",
        changeId: "c1",
        files: [
          { path: "a.ts", added: 37, removed: 8 },
          { path: "b.ts", added: 11, removed: 2 },
        ],
      }),
    ]);
    const view = changeViews(folded, ["task-1"])[0];
    expect(view?.added).toBe(48);
    expect(view?.removed).toBe(10);
  });

  test("a re-diff replaces the old one — a diff describes the branch as it stands", () => {
    const folded = foldOrganization([
      opened,
      ev(6, { kind: "change_files", workId: "task-1", changeId: "c1", files: [{ path: "a.ts", added: 1, removed: 0 }] }),
      ev(9, { kind: "change_files", workId: "task-1", changeId: "c1", files: [{ path: "a.ts", added: 40, removed: 3 }] }),
    ]);
    expect(changeViews(folded, ["task-1"])[0]?.added).toBe(40);
  });
});

describe("SPEND: attributed, and honest about what it leaves out", () => {
  const events = [
    created("task-1", "test_first_engineer", REF),
    ev(10, { kind: "metered_call", meter: meter({ costUsd: 1.5, durationMs: 300 }), workId: "task-1", hatId: "test_first_engineer" }),
    ev(11, { kind: "metered_call", meter: meter({ costUsd: 0.5 }), workId: "task-1", hatId: "test_first_engineer" }),
    // An intake poll belongs to no work item and no hat.
    ev(12, { kind: "metered_call", meter: meter({ port: Port.Intake, costUsd: 0.25 }) }),
  ];

  test("a work item is charged only for its own calls", () => {
    expect(spendForWork(foldOrganization(events), ["task-1"]).costUsd).toBeCloseTo(2, 6);
  });

  test("what belongs to no work item is reported, so the parts are seen not to sum", () => {
    // A dashboard that added the per-request totals would under-report the bill by exactly this.
    const un = unattributedSpend(foldOrganization(events));
    expect(un.calls).toBe(1);
    expect(un.costUsd).toBeCloseTo(0.25, 6);
  });

  test("retries are counted twice, because they cost twice", () => {
    const folded = foldOrganization([
      ...events,
      ev(13, { kind: "metered_call", meter: meter({ costUsd: 1.5 }), workId: "task-1", gate: "brd_approval" }),
    ]);
    expect(spendForWork(folded, ["task-1"]).calls).toBe(3);
    expect(spendForWork(folded, ["task-1"]).costUsd).toBeCloseTo(3.5, 6);
  });

  test("an unpriced run reports its calls and no dollars", () => {
    const folded = foldOrganization([
      created("task-1", "test_first_engineer", REF),
      ev(10, { kind: "metered_call", meter: meter(), workId: "task-1" }),
    ]);
    const spend = spendForWork(folded, ["task-1"]);
    expect(spend.calls).toBe(1);
    expect(spend.costUsd).toBeUndefined();
  });
});

describe("AGENTS: what a hat is doing is computed, never set", () => {
  const events = [
    created("task-1", "test_first_engineer", REF),
    ev(20, {
      kind: "phase_output",
      workId: "task-1",
      gate: "implementation_review",
      refs: ["a.md"],
      summary: "did it",
      producedByHatId: "test_first_engineer",
    }),
  ];

  test("a hat that produced something is working, and says on what", () => {
    const view = agentViews(chart, foldOrganization(events)).find((a) => a.hatId === "test_first_engineer");
    expect(view?.activity).toBe("working");
    expect(view?.doing).toContain("task-1");
    expect(view?.stepsProduced).toBe(1);
  });

  test("a hat whose work is held reads as held, which outranks working", () => {
    const folded = foldOrganization(events);
    const owner = folded.cascade.nodes.find((n) => n.workId === "task-1")?.ownerHatId;
    const view = agentViews(chart, folded, [{ workId: "task-1", gate: "architecture_approval" }]).find(
      (a) => a.hatId === owner,
    );
    expect(view?.activity).toBe("held");
  });

  test("a hat the log never saw act is idle, with nothing invented for it to be doing", () => {
    const view = agentViews(chart, foldOrganization(events)).find((a) => a.hatId !== "test_first_engineer");
    expect(view?.activity).toBe("idle");
    expect(view?.doing).toBeUndefined();
    expect(view?.stepsProduced).toBe(0);
  });

  test("the roster is ordered by department, so it reads like an org chart", () => {
    const ranks = agentViews(chart, foldOrganization(events)).map((a) => a.departmentRank);
    expect([...ranks].sort((x, y) => x - y)).toEqual(ranks);
  });
});

describe("ACTIVITY is built from facts, never from a log line's prose", () => {
  test("a refusal reads as bad, an acceptance as good, newest first", () => {
    const feed = activityViews(chart, [
      ev(10, { kind: "intake_refused", reason: "missing_reproduction", message: "m", title: "Portal is slow" }),
      ev(20, {
        kind: "document_written",
        workId: "task-1",
        gate: "brd_approval",
        path: "docs/x/business-case.md",
        bytes: 10,
        producedByHatId: "test_first_engineer",
      }),
    ]);
    expect(feed[0]?.atMs).toBe(20);
    expect(feed[1]?.tone).toBe("bad");
    expect(feed[1]?.text).toContain("Missing Reproduction");
  });

  test("an event with no fact contributes nothing rather than an empty row", () => {
    const bare: OrgEvent = {
      id: "x",
      kind: OrgEventKind.DecisionRecorded,
      atMs: 1,
      subjectId: "task-1",
      decision: "something happened",
      supervisorChain: [],
      evidenceRefs: [],
    };
    expect(activityViews(chart, [bare])).toEqual([]);
  });
});

describe("AN ANSWER THAT IS QUEUED BUT NOT APPLIED", () => {
  const approval = {
    kind: "approve_gate",
    subjectId: "task-1",
    reason: "ordering is right",
    byHuman: "Max Chadaev",
    atMs: 500,
    actionId: "ha-1",
    detail: { gate: "architecture_approval" },
  };

  test("it FIRES — which the first version of this function could never do", () => {
    // That version asked whether the gate was still in `awaitingHuman`. It never is: the view
    // clears that the moment an answer EXISTS. So the guard was a reader with no writer. This
    // test is the falsifier that was missing, and it fails against that implementation.
    const pending = answeredNotApplied([approval], []);
    expect(pending.length).toBe(1);
    expect(pending[0]?.outcome).toBe("approved");
    expect(pending[0]?.byHuman).toBe("Max Chadaev");
    expect(pending[0]?.gate).toBe("architecture_approval");
  });

  test("once the log carries the action id, it is applied and stops being pending", () => {
    // `human-action/<id>` in a gate evaluation's evidence is what makes an approval traceable, so
    // it is also the only honest signal that the organisation consumed it.
    expect(answeredNotApplied([approval], [{ evidenceRefs: ["human-action/ha-1"] }])).toEqual([]);
  });

  test("a DIFFERENT action id in the log does not clear this one", () => {
    expect(answeredNotApplied([approval], [{ evidenceRefs: ["human-action/ha-99"] }]).length).toBe(1);
  });

  test("evidence that is not an action ref clears nothing", () => {
    expect(answeredNotApplied([approval], [{ evidenceRefs: ["docs/x.md", "auto:approved"] }]).length).toBe(1);
  });

  test("an action with no gate cannot be applied to anything, so it is not listed", () => {
    expect(answeredNotApplied([{ ...approval, detail: {} }], [])).toEqual([]);
  });

  test("actions that are not gate answers are ignored", () => {
    expect(answeredNotApplied([{ ...approval, kind: "post_to_room" }], [])).toEqual([]);
  });

  test("answering twice shows the later word, matching how the runtime resolves it", () => {
    const later = { ...approval, kind: "reject_gate", atMs: 900, actionId: "ha-2", reason: "changed my mind" };
    const pending = answeredNotApplied([approval, later], []);
    expect(pending.length).toBe(1);
    expect(pending[0]?.outcome).toBe("rejected");
  });
});

describe("THE SUMMARY counts what the cascade holds", () => {
  test("requests, delivered and waiting all come from the fold", () => {
    const folded = foldOrganization([
      created("task-1", "test_first_engineer", REF),
      created("task-2", "test_first_engineer", REF),
    ]);
    const summary = portalSummary(folded, [{ workId: "task-1", gate: "architecture_approval" }], 2);
    expect(summary.requests).toBe(1);
    expect(summary.waitingOnPeople).toBe(1);
    expect(summary.refused).toBe(2);
    expect([...workIdsForRequest(folded.cascade, REF)].sort()).toEqual(["task-1", "task-2"]);
  });
});
