/**
 * org-graph.ts — the organization's own structures, read as one typed graph.
 *
 * ── THE DOC ──────────────────────────────────────────────────────────────────
 * `AGENT_NATIVE_KNOWLEDGE_GRAPH.md` §"Core Principle":
 *
 *   > Every important organizational object should be a graph node. Every important relationship
 *   > should be a typed edge. […] The task board is not only a board. It is an **index into the
 *   > Organization's working memory**.
 *
 * ── WHY THIS IS A PROJECTION AND NOT A STORE ─────────────────────────────────
 * The obvious build is a graph database agents write to. That would be a SECOND place the same
 * facts live: the cascade already knows which task belongs to which initiative, the anchor board
 * already knows which decision was taken where, the artifact history already knows which revision
 * came from which. Writing them again produces two answers to every question and no way to tell
 * which is stale — and the stale one is always the copy.
 *
 * So the graph is DERIVED, every time, from the structures that already hold the facts. Which makes
 * the doc's sentence literally true rather than aspirational: the board IS the index, because the
 * index is a view of the board and cannot drift from it.
 *
 * ── THE HONEST HALF: THE DOC LISTS FORTY EDGE KINDS AND THIS DERIVES EIGHT ───
 * Declaring all forty and populating eight would be a schema that lies — a reader would take an
 * empty `contradicts` set as "no contradictions" when it means "nothing here computes that". So
 * `EdgeKind` names ONLY what this register can derive, and `UNDERIVED_EDGE_KINDS` records the rest
 * with the reason. A taxonomy that overstates its coverage is the vacuity class wearing a schema,
 * and it is worse than a small one because it invites exactly the wrong inference.
 */

import type { ArtifactHistory } from "./artifact-deliberation";
import type { AnchorBoard } from "./discussion-anchor";
import type { CascadeNode } from "./goal-cascade";
import type { OrgChart } from "./org-chart";
import type { MissingInformation } from "../observe/observe";

/** What a node IS. Only kinds this register actually holds. */
export const NodeKind = {
  Hat: "hat",
  Department: "department",
  WorkItem: "work_item",
  Anchor: "anchor",
  Decision: "decision",
  Artifact: "artifact",
  Revision: "revision",
} as const;

export type NodeKind = (typeof NodeKind)[keyof typeof NodeKind];

/**
 * Typed relationships this register can DERIVE.
 *
 * Eight, taken from the doc's list — not a reduced vocabulary of its own, so a consumer that knows
 * the doc's names knows these. What is absent is absent on purpose; see `UNDERIVED_EDGE_KINDS`.
 */
export const EdgeKind = {
  /** A task to its initiative; a hat to its department. */
  BelongsTo: "belongs_to",
  /** Work to the contributor doing it. */
  AssignedTo: "assigned_to",
  /** A reported blocker to the work it stops. */
  Blocks: "blocks",
  /** Work to the thread it is being discussed on. */
  DiscussedIn: "discussed_in",
  /** A decision to the anchor it was taken on. */
  DecidedIn: "decided_in",
  /** A revision to the hat that wrote it. */
  ProducedBy: "produced_by",
  /** A revision to the revision it came from. */
  DerivedFrom: "derived_from",
  /** Two heads of one artifact that nobody has reconciled. */
  Contradicts: "contradicts",
} as const;

export type EdgeKind = (typeof EdgeKind)[keyof typeof EdgeKind];

/**
 * Edge kinds the doc names that this register cannot derive, and WHY.
 *
 * Recorded rather than silently omitted. A consumer asking "does this graph know about approvals?"
 * gets an answer here instead of inferring one from an empty result — which is the difference
 * between a gap and a finding.
 */
export const UNDERIVED_EDGE_KINDS: Readonly<Record<string, string>> = {
  approves: "gate evaluations are not part of the projected view; `quality-gate.ts` holds them",
  rejects: "same as approves",
  reviewed_by: "same as approves",
  supersedes: "the artifact history is a G-Set of revisions; nothing marks one as replacing another",
  superseded_by: "same as supersedes",
  recalls_memory: "no memory port is projected here",
  writes_memory: "same as recalls_memory",
  uses_skill: "skills are not organizational objects in this register",
  observed_in_trace: "traces live outside the organization's own state",
  scheduled_for: "the calendar is held by the drive state, not by the view this projects",
  released_by: "release is a pipeline concern; `work-delivery.ts` holds it",
};

export interface GraphNode {
  readonly kind: NodeKind;
  readonly id: string;
  readonly label: string;
}

export interface GraphEdge {
  readonly kind: EdgeKind;
  readonly from: string;
  readonly to: string;
  /**
   * WHICH STRUCTURE THIS WAS READ FROM.
   *
   * The projection's own provenance. Without it a reader cannot tell a derived edge from one
   * somebody wrote by hand, which is the distinction the whole design rests on.
   */
  readonly derivedFrom: string;
}

export interface OrgGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/** What the projection reads. Everything optional; absent simply yields fewer nodes and edges. */
export interface GraphSource {
  readonly chart?: OrgChart;
  readonly cascade?: readonly CascadeNode[];
  readonly board?: AnchorBoard;
  readonly artifacts?: ReadonlyMap<string, ArtifactHistory>;
  /** What each hat reported itself blocked on. */
  readonly blockers?: ReadonlyMap<string, readonly MissingInformation[]>;
}

/**
 * Read the organization as a graph.
 *
 * Pure and total. Nodes and edges are ORDINAL, so the same organization projects identically twice
 * — a graph whose adjacency order changes between runs cannot be diffed, and a graph that cannot be
 * diffed cannot show what changed.
 */
export function projectGraph(source: GraphSource): OrgGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const put = (node: GraphNode): void => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };

  fromChart(source, put, edges);
  fromCascade(source, put, edges);
  fromBoard(source, put, edges);
  fromArtifacts(source, put, edges);
  fromBlockers(source, put, edges);

  return { nodes: orderedNodes([...nodes.values()]), edges: orderedEdges(edges) };
}

type Put = (node: GraphNode) => void;

function fromChart(source: GraphSource, put: Put, edges: GraphEdge[]): void {
  for (const hat of source.chart?.byId.values() ?? []) {
    put({ kind: NodeKind.Hat, id: hat.id, label: hat.name });
    put({ kind: NodeKind.Department, id: hat.departmentId, label: hat.departmentId });
    edges.push({ kind: EdgeKind.BelongsTo, from: hat.id, to: hat.departmentId, derivedFrom: "chart" });
  }
}

function fromCascade(source: GraphSource, put: Put, edges: GraphEdge[]): void {
  for (const n of source.cascade ?? []) {
    put({ kind: NodeKind.WorkItem, id: n.workId, label: n.title });
    if (n.parentWorkId !== undefined) {
      edges.push({ kind: EdgeKind.BelongsTo, from: n.workId, to: n.parentWorkId, derivedFrom: "cascade" });
    }
    if (n.assigneeHatId !== undefined) {
      edges.push({ kind: EdgeKind.AssignedTo, from: n.workId, to: n.assigneeHatId, derivedFrom: "cascade" });
    }
  }
}

function fromBoard(source: GraphSource, put: Put, edges: GraphEdge[]): void {
  for (const anchor of source.board?.anchors ?? []) {
    put({ kind: NodeKind.Anchor, id: anchor.anchorId, label: anchor.title });
    if (anchor.workItemId !== undefined) {
      edges.push({ kind: EdgeKind.DiscussedIn, from: anchor.workItemId, to: anchor.anchorId, derivedFrom: "board" });
    }
  }
  for (const decision of source.board?.decisions ?? []) {
    put({ kind: NodeKind.Decision, id: decision.decisionId, label: decision.decision });
    edges.push({ kind: EdgeKind.DecidedIn, from: decision.decisionId, to: decision.anchorId, derivedFrom: "board" });
  }
}

function fromArtifacts(source: GraphSource, put: Put, edges: GraphEdge[]): void {
  for (const [artifactId, history] of source.artifacts ?? []) {
    put({ kind: NodeKind.Artifact, id: artifactId, label: `artifact '${artifactId}'` });
    for (const revision of history.revisions) {
      put({ kind: NodeKind.Revision, id: revision.revisionId, label: revision.note });
      edges.push({ kind: EdgeKind.BelongsTo, from: revision.revisionId, to: artifactId, derivedFrom: "artifact" });
      edges.push({ kind: EdgeKind.ProducedBy, from: revision.revisionId, to: revision.byHatId, derivedFrom: "artifact" });
      for (const parent of revision.parents) {
        edges.push({ kind: EdgeKind.DerivedFrom, from: revision.revisionId, to: parent, derivedFrom: "artifact" });
      }
    }
    edges.push(...contradictions(history));
  }
}

/**
 * An artifact's heads, pointed at each other — empty unless it has more than one.
 *
 * NO `isDiverged` GUARD, and that is deliberate rather than an omission. A settled history has one
 * head, the pair loop below produces nothing, and the guard was therefore dead code that read as a
 * check — a mutation matrix found it by deleting it and changing no outcome. One fewer branch is
 * one fewer thing that can be wrong — and this module no longer needs to ask whether an artifact
 * has diverged at all, because the answer is exactly the edges it produces.
 *
 * BOTH DIRECTIONS. Recording one would make the graph pick a winner by ordering, which is the same
 * silent resolution the context pack refuses — the projection SHOWS the disagreement and settles
 * nothing.
 */
function contradictions(history: ArtifactHistory): readonly GraphEdge[] {
  const heads = history.revisions
    .filter((r) => !history.revisions.some((other) => other.parents.includes(r.revisionId)))
    .map((r) => r.revisionId);
  const out: GraphEdge[] = [];
  for (const a of heads) {
    for (const b of heads) {
      if (a !== b) out.push({ kind: EdgeKind.Contradicts, from: a, to: b, derivedFrom: "artifact" });
    }
  }
  return out;
}

function fromBlockers(source: GraphSource, put: Put, edges: GraphEdge[]): void {
  for (const missing of source.blockers?.values() ?? []) {
    for (const m of missing) {
      if (m.blocking.trim() === "") continue;
      // The blocker is named by what is MISSING, not by an id somebody minted — this register has
      // no blocker entity, and inventing one here would put a node in the graph that nothing else
      // in the organization can look up.
      const id = `blocker:${m.about}`;
      put({ kind: NodeKind.WorkItem, id, label: m.about });
      edges.push({ kind: EdgeKind.Blocks, from: id, to: m.blocking, derivedFrom: "blockers" });
    }
  }
}

/** Everything one node points at, and everything pointing at it. */
export function neighborsOf(graph: OrgGraph, nodeId: string): readonly GraphEdge[] {
  return graph.edges.filter((e) => e.from === nodeId || e.to === nodeId);
}

export function edgesOfKind(graph: OrgGraph, kind: EdgeKind): readonly GraphEdge[] {
  return graph.edges.filter((e) => e.kind === kind);
}

export function nodeById(graph: OrgGraph, nodeId: string): GraphNode | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

/**
 * Is there a path from one node to another along edges of these kinds?
 *
 * DIRECTED, and it follows only the kinds asked for — "what work is under this initiative" and
 * "what does this revision descend from" are different questions, and a search that walked every
 * edge would answer both with "yes, everything is connected".
 */
export function pathExists(
  graph: OrgGraph,
  fromId: string,
  toId: string,
  kinds: readonly EdgeKind[],
): boolean {
  const allowed = new Set<string>(kinds);
  const seen = new Set<string>([fromId]);
  const frontier = [fromId];
  while (frontier.length > 0) {
    const current = frontier.pop();
    if (current === undefined) break;
    for (const edge of graph.edges) {
      if (edge.from !== current || !allowed.has(edge.kind)) continue;
      if (edge.to === toId) return true;
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      frontier.push(edge.to);
    }
  }
  return false;
}

function orderedNodes(nodes: readonly GraphNode[]): readonly GraphNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  });
}

function orderedEdges(edges: readonly GraphEdge[]): readonly GraphEdge[] {
  return [...edges].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to === b.to) return 0;
    return a.to < b.to ? -1 : 1;
  });
}
