/**
 * observe-cli.test.ts — an agent's worldview is the record, asked for; nothing is pushed into it.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderDashboard, renderItem, turnedBackOn, type ItemContext, type World } from "../observe/observe";
import { chainOf } from "./gate-demand";
import { IntakeKind, Severity } from "./intake";
import { buildOrgChart } from "./org-chart";
import type { OrgEvent } from "./org-event";
import { agentsFromChart, runOrgRuntime } from "./org-runtime";
import { SEED_HATS } from "./org-seed";
import { holdingOf, navigationFor, readAttachment, worldFor } from "./observe-cli";
import { WorkType, type CascadeNode } from "./goal-cascade";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

async function recordedRun(): Promise<readonly OrgEvent[]> {
  const events: OrgEvent[] = [];
  let n = 0;
  await runOrgRuntime({
    chart,
    externalEvents: [
      { source: "jira", externalId: "AIAGENT-1", kind: IntakeKind.Defect, severity: Severity.High, title: "order resets", reproduction: "1. reorder 2. wait", evidenceRefs: ["u"], body: "It resets after 30s." },
    ],
    agents: agentsFromChart(chart),
    observations: [],
    acceptingHatId: "cto",
    resourceAuthorityHatId: "rmo_office",
    priorityDeciderHatId: "cto",
    createId: (p) => `${p}-${String(++n).padStart(3, "0")}`,
    nowMs: 0,
    workBlockMs: 3_600_000,
    leaseMs: 300_000,
    onEvent: (e) => events.push(e),
  });
  return events;
}

const nav = navigationFor("observe --store S", "qa_engineer");

describe("THE RECORD OF A WORK ITEM, as an agent opens it", () => {
  test("every work item is an item, with ITS OWN steps — the chain it owes — and its links", async () => {
    const events = await recordedRun();
    const { items } = worldFor({ events, hatId: "qa_engineer", actions: [] });
    const defect = items.find((i) => i.kind === WorkType.Defect);
    expect(defect).toBeDefined();
    expect(defect?.steps.map((s) => s.name)).toEqual(chainOf({ workType: WorkType.Defect }).map(String));
    expect(defect?.description).toContain("It resets after 30s.");
    expect(defect?.where?.some((w) => w.includes("AIAGENT-1"))).toBe(true);
    // A LINK to the parent, not a copy of it.
    const parent = items.find((i) => i.id === defect?.parentId);
    expect(parent?.childIds).toContain(defect?.id);
  }, 60_000);

  test("AN ATTACHMENT IS SOMETHING THAT CAN BE OPENED: a step's inline log is not offered as one", async () => {
    // MEASURED on agentic-tpm task-032, 2026-09-12: a listed attachment was 4,031 characters of a test
    // run's stdout - a `log:` evidence ref, which carries its text INSIDE the ref. It was offered as
    // openable, and opening it resolved the blob as a path and reported it missing.
    const recorded = await recordedRun();
    const anyGate = recorded.find((e) => e.fact?.kind === "phase_output");
    expect(anyGate).toBeDefined();
    const f = (anyGate as { fact: { workId: string; gate: string; refs: readonly string[]; producedByHatId: string } }).fact;
    // The shape the runner really produces: `capture` puts up to four thousand characters of the
    // command's own output INSIDE the ref, beside a genuine path.
    const inlineLog = "stdout:" + ("mongod 7.0.14 binary cached for test workers" + String.fromCharCode(10)).repeat(80);
    const events = [
      ...recorded,
      { ...(anyGate as object), id: "injected-1", atMs: Number.MAX_SAFE_INTEGER - 1, fact: { ...f, refs: [...f.refs, inlineLog, "exit:0"] } },
    ] as typeof recorded;
    const { items } = worldFor({ events, hatId: "qa_engineer", actions: [] });
    const withGate = items.find((i) => i.id === f.workId);
    expect(withGate).toBeDefined();
    expect(withGate?.steps.some((st) => (st.attachments ?? []).includes(inlineLog))).toBe(true);
    for (const it of items) {
      for (const a of it.attachments) {
        expect(a.ref.includes(String.fromCharCode(10))).toBe(false);
        expect(a.ref.length).toBeLessThanOrEqual(400);
        // And what IS offered can actually be found: the lookup accepts the name it was shown.
        const got = readAttachment(items, it.id, a.ref);
        expect(got.ok || !got.reason.includes("is not attached")).toBe(true);
      }
    }
  }, 60_000);

  test("NO INHERITANCE: a child's attachments are its own, never its parent's", async () => {
    const events = await recordedRun();
    const { items } = worldFor({ events, hatId: "qa_engineer", actions: [] });
    for (const it of items) {
      const parent = items.find((p) => p.id === it.parentId);
      if (parent === undefined) continue;
      const mine = new Set(it.attachments.map((a) => a.ref));
      for (const a of parent.attachments) {
        // A ref may legitimately appear on both only if this item's own steps left it.
        if (mine.has(a.ref)) expect(it.steps.some((s) => (s.attachments ?? []).includes(a.ref))).toBe(true);
      }
    }
  }, 60_000);

  test("why a step stopped is a comment on the item it stopped — never on another", async () => {
    const events = await recordedRun();
    const leaf = worldFor({ events, hatId: "qa_engineer", actions: [] }).items?.find((i) => i.kind === WorkType.Defect);
    expect(leaf).toBeDefined();
    const stopped = {
      id: "evt-refusal-x", kind: "refusal", subjectId: leaf?.id ?? "", actorHatId: "backend_implementer",
      decision: "stopped at implementation_review (attempt 1): producer 'agent' refused: out of turns",
      atMs: 99, evidenceRefs: [], supervisorChain: [],
    } as unknown as OrgEvent;
    const items = worldFor({ events: [...events, stopped], hatId: "qa_engineer", actions: [] }).items ?? [];
    const mine = items.find((i) => i.id === leaf?.id);
    expect(mine?.comments.some((c) => c.text.includes("out of turns") && c.about === "refused")).toBe(true);
    for (const other of items.filter((i) => i.id !== leaf?.id)) {
      expect(other.comments.some((c) => c.text.includes("out of turns"))).toBe(false);
    }
  }, 60_000);

  test("an ACTION ITEM on a handed-off change is on its item, with its id, open until it is settled - and counted where the item says where it is", async () => {
    const events = await recordedRun();
    const leaf = worldFor({ events, hatId: "qa_engineer", actions: [] }).items?.find((i) => i.kind === WorkType.Defect);
    const id = leaf?.id ?? "";
    const raised = {
      id: "evt-ai-1", kind: "change_projected", subjectId: id, decision: "", atMs: 100, evidenceRefs: [], supervisorChain: [],
      fact: { kind: "action_item_raised", workId: id, actionItemId: "gitlab:note-8", source: "gitlab", itemKind: "comment", summary: "please explain the race", author: "reviewer" },
    } as unknown as OrgEvent;
    const open = worldFor({ events: [...events, raised], hatId: "qa_engineer", actions: [] }).items?.find((i) => i.id === id);
    expect(open?.comments.some((c) => c.about === "action item" && c.text.includes("[gitlab:note-8]") && c.text.endsWith("- OPEN") && c.by === "reviewer")).toBe(true);
    expect(open?.where?.some((w) => w.includes("1 open action item"))).toBe(true);
    const settled = {
      id: "evt-ai-2", kind: "change_projected", subjectId: id, decision: "", atMs: 101, evidenceRefs: [], supervisorChain: [],
      fact: { kind: "action_item_settled", workId: id, actionItemId: "gitlab:note-8", outcome: "addressed", how: "added a comment on the lock" },
    } as unknown as OrgEvent;
    const closed = worldFor({ events: [...events, raised, settled], hatId: "qa_engineer", actions: [] }).items?.find((i) => i.id === id);
    expect(closed?.comments.some((c) => c.text.includes("addressed: added a comment on the lock"))).toBe(true);
    expect(closed?.where?.some((w) => w.includes("open action item"))).toBe(false);
  }, 60_000);

  test("WHAT A PERSON ANSWERED IS ON THE ITEM: a question from the blocker outbox and its answer both show - a reviewer can find the instruction the author cites", async () => {
    // MEASURED on AIAGENT-1659: answers are filed against the QUESTION, the question lived only in
    // the outbox, and a reviewer rejected the author's citation of the requester as fabricated.
    const events = await recordedRun();
    const leaf = worldFor({ events, hatId: "qa_engineer", actions: [] }).items?.find((i) => i.kind === WorkType.Defect);
    const id = leaf?.id ?? "";
    const blocker = { blockerId: "ask-x-1", byHatId: "backend_implementer", about: "which epic key?", blocking: id, unblocks: "reproduction", atMs: 1, why: "w", exhaustion: { kind: "outside_org_authority", what: "reproduction" } } as never;
    const answer = { actionId: "answer-ask-x-1", kind: "answer_blocker", byHuman: "max", atMs: 2, subjectId: "ask-x-1", reason: "r", detail: { answer: "chase the code; the transcript is gone" } } as never;
    const item = worldFor({ events, hatId: "qa_director", actions: [answer], blockers: [blocker] }).items?.find((i) => i.id === id);
    expect(item?.comments.some((c) => c.about === "question" && c.text.includes("which epic key?"))).toBe(true);
    expect(item?.comments.some((c) => c.about === "answer" && c.by === "max" && c.text.includes("chase the code"))).toBe(true);
    // Without the outbox the question and its answer are invisible - which is the defect.
    const blind = worldFor({ events, hatId: "qa_director", actions: [answer] }).items?.find((i) => i.id === id);
    expect(blind?.comments.some((c) => c.about === "answer")).toBe(false);
  }, 60_000);

  test("what a hat holds is what is assigned to it or owned by it while open", () => {
    const nodes = [
      { workId: "a", workType: WorkType.Defect, title: "a", state: "in_progress", ownerHatId: "lead", assigneeHatId: "dev" },
      { workId: "b", workType: WorkType.Project, title: "b", state: "open", ownerHatId: "dev" },
      { workId: "c", workType: WorkType.Defect, title: "c", state: "done", ownerHatId: "lead", assigneeHatId: "dev" },
    ] as unknown as CascadeNode[];
    expect(holdingOf(nodes, "dev", [])).toEqual(["a", "b"]);
    expect(holdingOf(nodes, "lead", [])).toEqual([]);
  });
});

describe("AN ATTACHMENT IS READ ONLY IF THE RECORD LISTS IT", () => {
  const dir = mkdtempSync(join(tmpdir(), "obs-att-"));
  const doc = join(dir, "repro.md");
  writeFileSync(doc, "steps: 1. reorder");
  const items: ItemContext[] = [
    { id: "t1", title: "t", status: "open", steps: [], attachments: [{ ref: doc, from: "reproduction" }], comments: [] },
  ];

  test("a listed document is printed", () => {
    const got = readAttachment(items, "t1", doc);
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.text).toContain("reorder");
  });

  test("anything else is refused — the argument is untrusted and must not become 'read the disk'", () => {
    expect(readAttachment(items, "t1", join(dir, "..", "..", "secret.txt")).ok).toBe(false);
    expect(readAttachment(items, "t1", "C:/Windows/win.ini").ok).toBe(false);
    expect(readAttachment(items, "nope", doc).ok).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("THE DASHBOARD SAYS WHAT YOU HAVE, WHAT IS WAITING, WHAT MATTERS, AND WHERE TO LOOK", () => {
  const back: ItemContext = {
    id: "t9",
    title: "fix archive",
    status: "in_progress",
    steps: [
      { name: "reproduction", state: "passed", done: true, by: "QA" },
      { name: "implementation_review", state: "rejected", done: false, by: "Code Reviewer", note: "the test passes without the fix" },
    ],
    attachments: [],
    comments: [],
  };
  const world: World = {
    backlog: [{ id: "t9", title: "fix archive", ready: true, ambiguous: false }],
    reviewsAsked: [{ artifactId: "t4", revisionId: "r1", forGate: "reproduction", askedByHatId: "tech_lead" }],
    items: [back, { id: "t4", title: "other", status: "open", steps: [], attachments: [], comments: [] }],
    holding: ["t9"],
  };
  const page = renderDashboard(world, "qa_engineer", nav);

  test("every section is there", () => {
    for (const heading of ["INBOX", "YOU HOLD", "IMPORTANT", "ACTIONS", "WHERE TO LOOK"]) expect(page).toContain(heading);
  });

  test("somebody else's request is in the inbox, with how to open it", () => {
    expect(page).toContain("review asked   t4");
    expect(page).toContain(nav.item("t4"));
  });

  test("work that came back is IMPORTANT, with who sent it back and why", () => {
    expect(turnedBackOn(back)?.name).toBe("implementation_review");
    expect(page).toContain("t9 came BACK at 'implementation_review' — Code Reviewer: the test passes without the fix");
  });

  test("the next step of what you hold, and the commands to reach everything", () => {
    expect(page).toContain("next: implementation_review");
    expect(page).toContain(nav.dashboard);
    expect(page).toContain(nav.attachment("<id>", "<ref>"));
  });

  test("an opened item shows its steps with what was said, its attachments and its thread", () => {
    const opened = renderItem(back, nav);
    expect(opened).toContain("STEPS (1/2 done)");
    expect(opened).toContain("said: the test passes without the fix");
    expect(opened).toContain("ATTACHMENTS (0)");
    expect(opened).toContain("COMMENTS (0)");
  });
});

describe("AN OPENED ITEM IS BOUNDED, AND SAYS WHERE THE REST IS", () => {
  // MEASURED on agentic-tpm task-032, 2026-09-12: this view printed 71,565 characters - about 18,000
  // tokens - into every session that opened the item, and the session then spent four turns slicing
  // it. The comment bodies were duplicated besides: a follow-up is handed them in full in its prompt.
  const bounded = { dashboard: "obs dashboard", item: (id: string) => `obs item ${id}`, attachment: (id: string, ref: string) => `obs attachment ${id} ${ref}` };
  const long = (n: number, seed: string) => seed.repeat(n);
  const big = {
    id: "task-1",
    status: "doing",
    title: "a defect",
    description: long(3000, "d"),
    steps: [{ name: "qa_uat", state: "approved", done: true, note: long(1200, "n"), attachments: ["C:/Users/max/Work/AIAGENT-1595/org-work/wt-agentic-tpm/defect-AIAGENT-1661/docs/a.md", "C:/Users/max/Work/AIAGENT-1595/org-work/wt-agentic-tpm/defect-AIAGENT-1661/docs/b.md"] }],
    attachments: [
      { ref: "C:/Users/max/Work/AIAGENT-1595/org-work/wt-agentic-tpm/defect-AIAGENT-1661/docs/a.md", from: "qa_uat" },
      { ref: "C:/Users/max/Work/AIAGENT-1595/org-work/wt-agentic-tpm/defect-AIAGENT-1661/docs/b.md", from: "qa_uat" },
    ],
    comments: [{ by: "jenkins", about: "review", text: long(2000, "c") }],
  } as unknown as ItemContext;

  test("long passages are cut, each says its own size, and the way to read it whole is said ONCE", () => {
    const out = renderItem(big, bounded);
    expect(out.length).toBeLessThan(6000);
    expect(out).toContain("characters were cut from the passages above");
    expect(out.split("obs item task-1 --full").length - 1).toBe(1);
    expect(out).toContain("(+1600)");
  });

  test("--full prints every passage whole", () => {
    const out = renderItem(big, bounded, { full: true });
    expect(out).toContain(long(2000, "c"));
    expect(out).toContain(long(3000, "d"));
    expect(out).not.toContain("characters were cut");
  });

  test("a step does not reprint the files ATTACHMENTS lists, and their shared root is said once", () => {
    const out = renderItem(big, bounded);
    expect(out).toContain("left: 2 file(s), listed under ATTACHMENTS");
    expect(out).not.toContain("left: C:/Users/max/Work/AIAGENT-1595/org-work/wt-agentic-tpm/defect-AIAGENT-1661/docs/a.md");
    expect(out).toContain("all under C:/Users/max/Work/AIAGENT-1595/org-work/wt-agentic-tpm/defect-AIAGENT-1661/docs/");
    expect(out.split("C:/Users/max/Work/AIAGENT-1595/org-work/wt-agentic-tpm/defect-AIAGENT-1661/docs/").length - 1).toBe(1);
  });
});
