/**
 * request-view.test.ts — the spine, and the inheritance that makes it one.
 *
 * The property under test is that a request reaches EVERY rung beneath it. A goal that knows where
 * it came from and a task that does not is not a spine — it is a label on the top of a tree, and the
 * page that matters ("what did we do about this request") reads the leaves.
 */

import { describe, expect, test } from "bun:test";

import { acceptGoal, decompose, EMPTY_CASCADE, WorkType, type Cascade } from "./goal-cascade";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { externalRefOf } from "./intake";
import { refusedRequestViews, requestViews } from "./request-view";
import { OrgEventKind, type OrgEvent } from "./org-event";
import { foldOrganization } from "./org-fold";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const REF = externalRefOf("jira", "AIAGENT-1637");

/** A goal from a request, decomposed two rungs down. */
function tree(requestRef?: string): Cascade {
  const goal = acceptGoal(EMPTY_CASCADE, chart, {
    workId: "goal-1",
    title: "session archival must survive",
    acceptingHatId: "cto",
    ...(requestRef === undefined ? {} : { requestRef }),
  });
  if (!goal.ok) throw new Error(goal.reason);
  const init = decompose(goal.cascade, chart, "goal-1", [{ workId: "init-1", title: "archival reaches storage" }]);
  if (!init.ok) throw new Error(init.reason);
  const proj = decompose(init.cascade, chart, "init-1", [{ workId: "proj-1", title: "blob write ordering" }]);
  if (!proj.ok) throw new Error(proj.reason);
  const tasks = decompose(proj.cascade, chart, "proj-1", [
    { workId: "task-1", title: "implement", workType: WorkType.Task },
    { workId: "task-2", title: "verify", workType: WorkType.Review },
  ]);
  if (!tasks.ok) throw new Error(tasks.reason);
  return tasks.cascade;
}

describe("THE REQUEST REACHES EVERY RUNG — otherwise it is a label, not a spine", () => {
  test("a task four levels down still knows what asked for it", () => {
    // The page that matters reads the LEAVES. A goal that carries the request and a task that does
    // not means "what did we do about AIAGENT-1637" returns one row and no work.
    const c = tree(REF);
    for (const id of ["goal-1", "init-1", "proj-1", "task-1", "task-2"]) {
      expect(c.nodes.find((n) => n.workId === id)?.requestRef).toBe(REF);
    }
  });

  test("work born inside the organization carries nothing, and is not invented", () => {
    const c = tree(undefined);
    expect(c.nodes.every((n) => n.requestRef === undefined)).toBe(true);
    expect(requestViews(c, [])).toEqual([]);
  });

  test("one request, its whole tree, counted by leaves", () => {
    const v = requestViews(tree(REF), [])[0];
    expect(v?.externalId).toBe("AIAGENT-1637");
    expect(v?.source).toBe("jira");
    expect(v?.workIds.length).toBe(5);
    // Leaves only — a goal is not a thing somebody does.
    expect([...(v?.leafIds ?? [])].sort()).toEqual(["task-1", "task-2"]);
    expect(v?.inFlight).toBe(2);
  });

  test("the request's title is the GOAL's, which is the closest thing to the filer's words", () => {
    expect(requestViews(tree(REF), [])[0]?.title).toBe("session archival must survive");
  });
});

describe("IT SURVIVES THE LOG — otherwise the spine is runtime-only", () => {
  test("a folded organization still knows what asked for its work", () => {
    // Every test above builds a cascade in memory. This one goes through the events, because a
    // resumed organization reads nothing else — and a spine that exists only until the process ends
    // is not a spine.
    const events: OrgEvent[] = tree(REF).nodes.map((n, i) => ({
      id: `e-${i}`,
      kind: OrgEventKind.WorkItemTransition,
      atMs: i,
      subjectId: n.workId,
      decision: "created",
      supervisorChain: [],
      evidenceRefs: [],
      fact: {
        kind: "work_created",
        workId: n.workId,
        workType: n.workType,
        title: n.title,
        ownerHatId: n.ownerHatId,
        ...(n.parentWorkId === undefined ? {} : { parentWorkId: n.parentWorkId }),
        ...(n.requestRef === undefined ? {} : { requestRef: n.requestRef }),
      },
    }));
    const folded = foldOrganization(events);
    expect(folded.cascade.nodes.every((n) => n.requestRef === REF)).toBe(true);
    expect(requestViews(folded.cascade, events)[0]?.externalId).toBe("AIAGENT-1637");
  });
});

describe("what the index refuses to invent", () => {
  test("a ref that does not parse is skipped, not shown under a made-up source", () => {
    // Attributing work to a system that never asked for it is worse than omitting it.
    const c = tree("not-a-valid-key");
    expect(requestViews(c, [])).toEqual([]);
  });

  test("no URL template means no link — never a guessed one", () => {
    expect(requestViews(tree(REF), [])[0]?.url).toBeUndefined();
    expect(requestViews(tree(REF), [], { urlTemplates: { jira: "https://x/{id}" } })[0]?.url)
      .toBe("https://x/AIAGENT-1637");
  });

  test("a template for a DIFFERENT source does not leak onto this one", () => {
    expect(requestViews(tree(REF), [], { urlTemplates: { github: "https://gh/{id}" } })[0]?.url)
      .toBeUndefined();
  });
});

describe("SORTED BY WHO NEEDS A PERSON", () => {
  test("a request holding a decision comes before one that does not", () => {
    const a = acceptGoal(EMPTY_CASCADE, chart, {
      workId: "g-a", title: "quiet one", acceptingHatId: "cto",
      requestRef: externalRefOf("jira", "A-1"),
    });
    if (!a.ok) throw new Error(a.reason);
    const b = acceptGoal(a.cascade, chart, {
      workId: "g-b", title: "holding one", acceptingHatId: "cto",
      requestRef: externalRefOf("jira", "B-2"),
    });
    if (!b.ok) throw new Error(b.reason);
    const views = requestViews(b.cascade, [], { waitingWorkIds: ["g-b"] });
    expect(views[0]?.externalId).toBe("B-2");
    expect(views[0]?.waiting).toBe(1);
  });
});

describe("REFUSED REQUESTS ARE ANSWERS SOMEBODY IS OWED", () => {
  const refusal = (reason: string, id: string): OrgEvent => ({
    id: `r-${id}`,
    kind: OrgEventKind.Refusal,
    atMs: 100,
    subjectId: id,
    decision: "refused",
    supervisorChain: [],
    evidenceRefs: [],
    fact: {
      kind: "intake_refused",
      reason,
      message: `${reason} happened`,
      title: "portal is slow sometimes",
      externalRef: externalRefOf("jira", id),
    },
  });

  test("a declined request is listed, with its reason and its id", () => {
    // It has no work by construction, so it cannot appear in the index above — and until this fact
    // existed it was a sentence in a run's refusal list that nobody outside the run ever saw.
    const v = refusedRequestViews([refusal("missing_reproduction", "A-9")])[0];
    expect(v?.reason).toBe("missing_reproduction");
    expect(v?.externalId).toBe("A-9");
    expect(v?.source).toBe("jira");
    expect(v?.title).toBe("portal is slow sometimes");
  });

  test("newest first", () => {
    const old = { ...refusal("duplicate", "A-1"), atMs: 10 };
    const recent = { ...refusal("missing_reproduction", "A-2"), atMs: 900 };
    expect(refusedRequestViews([old, recent]).map((r) => r.externalId)).toEqual(["A-2", "A-1"]);
  });

  test("a log with no refusals lists none rather than throwing", () => {
    expect(refusedRequestViews([])).toEqual([]);
  });
});
