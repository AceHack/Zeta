/**
 * context-pack-wiring.test.ts — the pack has to come from the organization, not from a caller.
 *
 * `buildContextPack` shapes and guards a pack; on its own it would be a container waiting for
 * somebody to fill it, and a container nothing fills is a reader with no writer. `contextPackFor`
 * is the deterministic retrieval the doc asks for — the world narrowed from state the register
 * already holds, before any model helps.
 *
 * The load-bearing test is the diverged artifact: it is an unresolved contradiction, and picking a
 * head to hand over would silently resolve it in the one place a wrong resolution is invisible.
 */

import { describe, expect, test } from "bun:test";
import { contextPackFor, type OrgView } from "./org-observe-bridge";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { EMPTY_BOARD } from "./discussion-anchor";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import { headsOf, mergeHistories, openArtifact, revise, type ArtifactHistory } from "./artifact-deliberation";
import { ContextItemKind, ContextScope, itemsOfKind, OmissionKind, replayableOf } from "./context-pack";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const MINE: CascadeNode = {
  workId: "task-1",
  workType: WorkType.Task,
  title: "stop the double charge",
  state: WorkState.Open,
  ownerHatId: "tech_lead",
  assigneeHatId: "backend_implementer",
};

const SOMEONE_ELSE: CascadeNode = { ...MINE, workId: "task-2", assigneeHatId: "frontend_implementer" };

function settled(id: string, byHatId: string): ArtifactHistory {
  const base = openArtifact({ artifactId: id, byHatId, atMs: 1, content: "v1", note: "n" });
  if (!base.ok) throw new Error(base.reason);
  return base.history;
}

function diverged(id: string, byHatId: string): ArtifactHistory {
  const base = settled(id, byHatId);
  const root = headsOf(base)[0]?.revisionId;
  if (root === undefined) throw new Error("a fresh artifact has a head");
  const a = revise(base, { parents: [root], byHatId, atMs: 2, content: "A", note: "n" });
  const b = revise(base, { parents: [root], byHatId: "qa_director", atMs: 3, content: "B", note: "n" });
  if (!a.ok || !b.ok) throw new Error("revise refused");
  const m = mergeHistories(a.history, b.history);
  if (!m.ok) throw new Error(m.reason);
  return m.history;
}

function view(over: Partial<OrgView> = {}): OrgView {
  return { chart, board: EMPTY_BOARD, signals: [], cascade: [MINE, SOMEONE_ELSE], artifacts: new Map(), ...over };
}

function packFor(hatId: string, over: Partial<OrgView> = {}) {
  const r = contextPackFor(view(over), hatId, "rmo_office");
  if (!r.ok) throw new Error(r.reason);
  return r.pack;
}

describe("RETRIEVAL COMES FROM THE ORGANIZATION'S OWN STATE", () => {
  test("a hat sees the work it holds, and NOT work it does not", () => {
    const p = packFor("backend_implementer");
    expect(itemsOfKind(p, ContextItemKind.WorkItem).map((i) => i.id)).toEqual(["task-1"]);
  });

  test("an owner sees what it owns, even when someone else is doing it", () => {
    // A tech lead owns both. Scoping to the assignee alone would leave a lead blind to its own
    // line, which is the hat the escalation chain routes everything to.
    expect(itemsOfKind(packFor("tech_lead"), ContextItemKind.WorkItem).map((i) => i.id)).toEqual(["task-1", "task-2"]);
  });

  test("blockers this hat reported are context, not just a menu entry", () => {
    const p = packFor("backend_implementer", {
      blockers: new Map([["backend_implementer", [{ about: "which store the port writes to", blocking: "task-1" }]]]),
    });
    expect(itemsOfKind(p, ContextItemKind.Blocker)).toHaveLength(1);
  });

  test("an artifact this hat touched is carried; one it never touched is not", () => {
    const artifacts = new Map([
      ["doc-mine", settled("doc-mine", "backend_implementer")],
      ["doc-theirs", settled("doc-theirs", "frontend_implementer")],
    ]);
    expect(itemsOfKind(packFor("backend_implementer", { artifacts }), ContextItemKind.Artifact).map((i) => i.id)).toEqual([
      "doc-mine",
    ]);
  });

  test("EVERY ITEM CARRIES A SOURCE, so the pack replays", () => {
    const p = packFor("backend_implementer");
    expect(p.items.every((i) => i.source.ref.trim() !== "")).toBe(true);
    expect(replayableOf(p)).toBe(true);
  });

  test("the scope still comes from the chart, not from what was retrieved", () => {
    expect(packFor("backend_implementer").scope).toBe(ContextScope.WorkItem);
    expect(packFor("cto").scope).toBe(ContextScope.Portfolio);
  });
});

describe("A DIVERGED ARTIFACT IS AN OMISSION, NOT A CHOICE", () => {
  const artifacts = new Map([["doc-1", diverged("doc-1", "backend_implementer")]]);

  test("it is reported as an unresolved contradiction, and NOT handed over as an item", () => {
    // Picking a head would resolve the divergence silently, in the one place a wrong resolution is
    // invisible: the agent would act on a version nobody agreed was the version and have no way to
    // know a second one existed.
    const p = packFor("backend_implementer", { artifacts });
    expect(itemsOfKind(p, ContextItemKind.Artifact)).toEqual([]);
    expect(p.omissions.map((o) => o.kind)).toEqual([OmissionKind.UnresolvedContradiction]);
  });

  test("...which DEGRADES the pack and makes it non-replayable", () => {
    const p = packFor("backend_implementer", { artifacts });
    expect(p.degraded).toBe(true);
    expect(replayableOf(p)).toBe(false);
  });

  test("a SETTLED artifact is an item and degrades nothing", () => {
    const p = packFor("backend_implementer", { artifacts: new Map([["doc-1", settled("doc-1", "backend_implementer")]]) });
    expect(itemsOfKind(p, ContextItemKind.Artifact)).toHaveLength(1);
    expect(p.degraded).toBe(false);
  });
});

describe("what the bridge does NOT claim", () => {
  test("A HAT WITH NOTHING IS NOT DEGRADED — retrieval ran and found nothing", () => {
    // Different from the unwired case, which `buildContextPack` reports as an omission. Here the
    // organization was actually consulted, and it had nothing for this hat.
    const p = packFor("qa_director");
    expect(p.items).toEqual([]);
    expect(p.degraded).toBe(false);
    expect(p.brief.hatId).toBe("qa_director");
  });

  test("an unknown hat refuses, as it must", () => {
    expect(contextPackFor(view(), "not_a_hat", "rmo_office").ok).toBe(false);
  });
});
