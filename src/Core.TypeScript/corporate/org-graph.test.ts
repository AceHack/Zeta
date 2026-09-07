/**
 * org-graph.test.ts — "the task board is not only a board, it is an index into working memory".
 *
 * That is true only if the index cannot drift from the board, which is why this is a projection and
 * why the tests are mostly about DERIVATION: change the cascade and the graph changes, with nothing
 * to keep in step by hand.
 *
 * The other half is the honest one. The doc names about forty edge kinds and this derives eight, so
 * a test pins that the vocabulary does not overstate itself — an empty `contradicts` set must mean
 * "no contradictions", never "nothing here computes that".
 */

import { describe, expect, test } from "bun:test";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { AnchorState, AnchorType, EMPTY_BOARD, ExpectedOutput, openAnchor, recordDecision } from "./discussion-anchor";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import { headsOf, mergeHistories, openArtifact, revise, type ArtifactHistory } from "./artifact-deliberation";
import {
  EdgeKind,
  edgesOfKind,
  neighborsOf,
  nodeById,
  NodeKind,
  pathExists,
  projectGraph,
  UNDERIVED_EDGE_KINDS,
  type GraphSource,
} from "./org-graph";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const INITIATIVE: CascadeNode = {
  workId: "initiative-7",
  workType: WorkType.Initiative,
  title: "billing",
  state: WorkState.Open,
  ownerHatId: "tech_lead",
};

const CASCADE: readonly CascadeNode[] = [
  INITIATIVE,
  {
    workId: "task-1",
    workType: WorkType.Task,
    title: "stop the double charge",
    state: WorkState.Open,
    ownerHatId: "tech_lead",
    parentWorkId: "initiative-7",
    assigneeHatId: "backend_implementer",
  },
];

function board() {
  const opened = openAnchor(EMPTY_BOARD, {
    anchorId: "anchor-1",
    anchorType: AnchorType.WorkItem,
    title: "task-1 thread",
    purpose: "decide the store",
    expectedOutput: ExpectedOutput.Decision,
    participantHatIds: ["tech_lead", "backend_implementer"],
    openedByHatId: "tech_lead",
    openedAtMs: 1,
    state: AnchorState.Open,
    workItemId: "task-1",
  });
  if (!opened.ok) throw new Error(opened.reason);
  const decided = recordDecision(opened.board, {
    decisionId: "dec-1",
    anchorId: "anchor-1",
    decision: "write to the ledger store",
    byHatId: "tech_lead",
    atMs: 2,
    rationale: "it is the one with retention",
    evidence: [{ kind: "document", ref: "adr-4" }],
  });
  if (!decided.ok) throw new Error(decided.reason);
  return decided.board;
}

function settled(): ArtifactHistory {
  const base = openArtifact({ artifactId: "doc-1", byHatId: "tech_lead", atMs: 1, content: "v1", note: "first" });
  if (!base.ok) throw new Error(base.reason);
  return base.history;
}

function diverged(): ArtifactHistory {
  const base = settled();
  const root = headsOf(base)[0]?.revisionId;
  if (root === undefined) throw new Error("a fresh artifact has a head");
  const a = revise(base, { parents: [root], byHatId: "tech_lead", atMs: 2, content: "A", note: "a" });
  const b = revise(base, { parents: [root], byHatId: "qa_director", atMs: 3, content: "B", note: "b" });
  if (!a.ok || !b.ok) throw new Error("revise refused");
  const m = mergeHistories(a.history, b.history);
  if (!m.ok) throw new Error(m.reason);
  return m.history;
}

function project(over: GraphSource = {}) {
  return projectGraph({ chart, cascade: CASCADE, board: board(), ...over });
}

describe("THE GRAPH IS DERIVED, so it cannot drift from what it indexes", () => {
  test("a task belongs to its initiative and is assigned to its contributor", () => {
    const g = project();
    expect(edgesOfKind(g, EdgeKind.BelongsTo)).toContainEqual({
      kind: EdgeKind.BelongsTo,
      from: "task-1",
      to: "initiative-7",
      derivedFrom: "cascade",
    });
    expect(edgesOfKind(g, EdgeKind.AssignedTo)).toContainEqual({
      kind: EdgeKind.AssignedTo,
      from: "task-1",
      to: "backend_implementer",
      derivedFrom: "cascade",
    });
  });

  test("CHANGE THE CASCADE AND THE GRAPH CHANGES — nothing is kept in step by hand", () => {
    const unassigned: readonly CascadeNode[] = [
      INITIATIVE,
      {
        workId: "task-1",
        workType: WorkType.Task,
        title: "stop the double charge",
        state: WorkState.Open,
        ownerHatId: "tech_lead",
        parentWorkId: "initiative-7",
      },
    ];
    expect(edgesOfKind(project({ cascade: unassigned }), EdgeKind.AssignedTo)).toEqual([]);
  });

  test("EVERY EDGE SAYS WHICH STRUCTURE IT WAS READ FROM", () => {
    // Without it a reader cannot tell a derived edge from one somebody wrote by hand, which is the
    // distinction the whole design rests on.
    for (const e of project({ artifacts: new Map([["doc-1", settled()]]) }).edges) {
      expect(e.derivedFrom.trim()).not.toBe("");
    }
  });

  test("a decision points at the anchor it was taken on, and the work at the thread", () => {
    const g = project();
    expect(edgesOfKind(g, EdgeKind.DecidedIn)).toContainEqual({
      kind: EdgeKind.DecidedIn,
      from: "dec-1",
      to: "anchor-1",
      derivedFrom: "board",
    });
    expect(edgesOfKind(g, EdgeKind.DiscussedIn)).toContainEqual({
      kind: EdgeKind.DiscussedIn,
      from: "task-1",
      to: "anchor-1",
      derivedFrom: "board",
    });
  });

  test("a revision points at its artifact, its author, and what it came from", () => {
    const g = project({ artifacts: new Map([["doc-1", diverged()]]) });
    expect(edgesOfKind(g, EdgeKind.ProducedBy).some((e) => e.to === "qa_director")).toBe(true);
    expect(edgesOfKind(g, EdgeKind.DerivedFrom).length).toBeGreaterThan(0);
    expect(nodeById(g, "doc-1")?.kind).toBe(NodeKind.Artifact);
  });

  test("a reported blocker points at the work it stops", () => {
    const g = project({
      blockers: new Map([["backend_implementer", [{ about: "which store", blocking: "task-1" }]]]),
    });
    expect(edgesOfKind(g, EdgeKind.Blocks)).toContainEqual({
      kind: EdgeKind.Blocks,
      from: "blocker:which store",
      to: "task-1",
      derivedFrom: "blockers",
    });
  });

  test("a blocker naming no work item produces no edge — it would point at nothing", () => {
    const g = project({ blockers: new Map([["backend_implementer", [{ about: "which store", blocking: "" }]]]) });
    expect(edgesOfKind(g, EdgeKind.Blocks)).toEqual([]);
  });
});

describe("A DIVERGED ARTIFACT IS SHOWN, NOT RESOLVED", () => {
  test("its two heads contradict each other, in both directions", () => {
    // Recording one direction would make the graph pick a winner by ordering, which is the same
    // silent resolution the context pack refuses.
    const contradictions = edgesOfKind(project({ artifacts: new Map([["doc-1", diverged()]]) }), EdgeKind.Contradicts);
    expect(contradictions).toHaveLength(2);
    expect(contradictions[0]?.to).toBe(contradictions[1]?.from);
  });

  test("A SETTLED ARTIFACT CONTRADICTS NOTHING — this is not a check that always fires", () => {
    expect(edgesOfKind(project({ artifacts: new Map([["doc-1", settled()]]) }), EdgeKind.Contradicts)).toEqual([]);
  });
});

describe("THE VOCABULARY DOES NOT OVERSTATE ITSELF", () => {
  test("eight derived kinds, and the rest recorded with a REASON", () => {
    // A schema declaring forty kinds and populating eight would make an empty `contradicts` set
    // read as "no contradictions" when it means "nothing here computes that". A consumer asking
    // whether this graph knows about approvals gets an answer instead of inferring one.
    expect(Object.values(EdgeKind)).toHaveLength(8);
    expect(Object.keys(UNDERIVED_EDGE_KINDS).length).toBeGreaterThan(5);
    for (const reason of Object.values(UNDERIVED_EDGE_KINDS)) expect(reason.trim()).not.toBe("");
  });

  test("NO KIND IS BOTH DERIVED AND RECORDED AS UNDERIVED", () => {
    const derived = new Set<string>(Object.values(EdgeKind));
    for (const name of Object.keys(UNDERIVED_EDGE_KINDS)) expect(derived.has(name)).toBe(false);
  });
});

describe("reading the graph", () => {
  test("neighbours are edges in BOTH directions", () => {
    // A blocker points AT the work and the work points at its thread, so this fixture has one of
    // each. Asking only about outgoing edges would leave a hat unable to see what is holding its
    // own item up, which is the direction that matters most.
    const around = neighborsOf(
      project({ blockers: new Map([["backend_implementer", [{ about: "which store", blocking: "task-1" }]]]) }),
      "task-1",
    );
    expect(around.some((e) => e.from === "task-1")).toBe(true);
    expect(around.some((e) => e.to === "task-1")).toBe(true);
  });

  test("A PATH FOLLOWS ONLY THE KINDS ASKED FOR", () => {
    // "What work is under this initiative" and "what does this revision descend from" are different
    // questions; a search walking every edge answers both with "yes, everything is connected".
    const g = project();
    expect(pathExists(g, "task-1", "initiative-7", [EdgeKind.BelongsTo])).toBe(true);
    expect(pathExists(g, "task-1", "initiative-7", [EdgeKind.AssignedTo])).toBe(false);
  });

  test("paths are DIRECTED", () => {
    const g = project();
    expect(pathExists(g, "initiative-7", "task-1", [EdgeKind.BelongsTo])).toBe(false);
  });

  test("a path over several hops is found, and a cycle does not hang it", () => {
    const cyclic: readonly CascadeNode[] = [
      { workId: "a", workType: WorkType.Task, title: "a", state: WorkState.Open, ownerHatId: "tech_lead", parentWorkId: "b" },
      { workId: "b", workType: WorkType.Task, title: "b", state: WorkState.Open, ownerHatId: "tech_lead", parentWorkId: "a" },
    ];
    const g = project({ cascade: cyclic });
    expect(pathExists(g, "a", "b", [EdgeKind.BelongsTo])).toBe(true);
    expect(pathExists(g, "a", "nowhere", [EdgeKind.BelongsTo])).toBe(false);
  });

  test("nodes and edges are ORDINAL, so two projections can be diffed", () => {
    const g = project({ artifacts: new Map([["doc-1", diverged()]]) });
    const kinds = g.edges.map((e) => e.kind);
    expect([...kinds].sort()).toEqual(kinds);
    const nodeKinds = g.nodes.map((n) => n.kind);
    expect([...nodeKinds].sort()).toEqual(nodeKinds);
  });

  test("an empty source projects an empty graph rather than refusing", () => {
    const g = projectGraph({});
    expect(g.nodes).toEqual([]);
    expect(g.edges).toEqual([]);
  });
});
