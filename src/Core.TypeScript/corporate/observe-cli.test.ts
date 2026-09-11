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
