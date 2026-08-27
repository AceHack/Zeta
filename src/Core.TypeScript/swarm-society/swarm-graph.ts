#!/usr/bin/env bun
// swarm-graph.ts — fold the agent society's durable communication substrate into
// a small-world interaction graph for TROUBLESHOOTING swarm behaviour.
//
// This is NOT DORA (factory velocity, `backlog/dora-metrics.ts`) and NOT the
// society rho / effective-agent-count HEALTH metrics (`society/*`). It answers a
// separate, deliberately non-judgmental question: what does the communication
// TOPOLOGY between named agents look like — who talks to whom, over which
// channel, how clustered, how many hops apart — so a swarm can be debugged by
// the SHAPE of its interactions.
//
// It rests on the identity ROOT OF TRUST this repo already has — the persona
// registry (`registry/personas.yaml`) + AgencySignature commit trailers + the
// agent-bus from/to. That is the built-in, always-on contrast to the METR/OpenAI
// Hugging Face incident, where ~1,200 agents ran an ad-hoc filename-board PKI
// (`zzCDA23AUTH1`, 19 keys, no root of trust) and the interaction graph had to
// be reconstructed forensically after the fact
// (docs/ip-questionable/2026-08-27-metr-openai-hugging-face-swarm-incident-agent-identity-and-coordination-norms.md).
//
// Edge sources (each optional; missing substrate degrades gracefully):
//   - bus       docs/agent-bus/**/*.json      directed  from → to   (topic-labelled)
//   - workitem  workitems/events/**/*.json    undirected co-participation on a shared work item
//   - commit    git log AgencySignature       undirected co-authorship on one commit
//
// The CLI writes data/swarm-graph.json and injects it into the self-contained
// viewer at docs/design/root-site-iris/site/swarm.html.

import { readFileSync, readdirSync, writeFileSync, type Dirent } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parse as parseActor } from "../identity/actor-ref.ts";
import { VALID_PERSONAS, type PersonaId } from "../identity/generated-registry.ts";
import {
  computeTopologyMetrics,
  nodeDegrees,
  reciprocity,
  smallWorldSigma,
  type MetricEdge,
  type SwarmTopologyMetrics,
} from "./swarm-graph-metrics.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export type SwarmChannel = "bus" | "workitem" | "commit";

/** Stable channel legend — label, colour (Iris palette), and directedness. */
export const CHANNELS: readonly { channel: SwarmChannel; label: string; color: string; directed: boolean }[] = [
  { channel: "bus", label: "agent bus (message → recipient)", color: "#5EC8C2", directed: true },
  { channel: "workitem", label: "shared work item (co-participation)", color: "#E8B566", directed: false },
  { channel: "commit", label: "co-authored commit", color: "#A78BFA", directed: false },
];

/** Per-persona colour for nodes (stable, Iris-adjacent). */
export const PERSONA_COLORS: Record<string, string> = {
  aaron: "#E7EBF4",
  otto: "#5EC8C2",
  alexa: "#E8B566",
  riven: "#A78BFA",
  vera: "#7CD992",
  lior: "#6FA8FF",
  soraya: "#F472B6",
  addison: "#F9A03F",
};

/** Co-Authored-By identity → persona. Harness table from AGENTS.md. */
const COAUTHOR_TO_PERSONA: readonly { readonly match: RegExp; readonly persona: PersonaId }[] = [
  { match: /anthropic\.com|\bclaude\b/i, persona: "otto" },
  { match: /openai\.com|\bcodex\b/i, persona: "vera" },
  { match: /x\.ai|\bgrok\b/i, persona: "riven" },
  { match: /google\.com|\bgemini\b/i, persona: "lior" },
  { match: /kiro\.dev|\bkiro\b/i, persona: "alexa" },
];

export interface PersonaMeta {
  readonly id: string;
  readonly role: string;
}

export interface SwarmNode {
  readonly id: string;
  readonly role: string;
  readonly color: string;
  /** Total events this persona emitted across all channels (drives node size). */
  readonly activity: number;
  readonly degree: number;
  readonly strength: number;
}

export interface SwarmEdge {
  readonly source: string;
  readonly target: string;
  readonly channel: SwarmChannel;
  readonly weight: number;
  readonly directed: boolean;
  readonly lastAt: string | null;
}

export interface SwarmGraph {
  readonly generatedAt: string;
  readonly windowDays: number | null;
  readonly channels: typeof CHANNELS;
  readonly nodes: readonly SwarmNode[];
  readonly edges: readonly SwarmEdge[];
  readonly metrics: SwarmTopologyMetrics & {
    readonly reciprocityBus: number;
    readonly smallWorldSigma: number | null;
  };
  /** Per-channel observability coverage — the "do we have the right knobs" audit. */
  readonly coverage: Record<SwarmChannel, { readonly records: number; readonly edges: number; readonly skipped: number }>;
}

// ---------------------------------------------------------------------------
// Pure normalisation
// ---------------------------------------------------------------------------

/** Normalise any actor projection (otto-cli, riven/cursor, "Riven") to a persona
 * id, or null if it is not a known persona (broadcast "*", "society", garbage). */
export function personaOf(actor: string | undefined | null): PersonaId | null {
  if (!actor) return null;
  const lowered = actor.trim().toLowerCase();
  if (lowered === "" || lowered === "*" || lowered === "society") return null;
  try {
    const ref = parseActor(lowered);
    return ref.persona;
  } catch {
    return VALID_PERSONAS.has(lowered) ? (lowered as PersonaId) : null;
  }
}

/** Map a Co-Authored-By trailer line's identity to a persona. */
export function coauthorPersona(identity: string): PersonaId | null {
  for (const { match, persona } of COAUTHOR_TO_PERSONA) {
    if (match.test(identity)) return persona;
  }
  return personaOf(identity);
}

// ---------------------------------------------------------------------------
// Pure folds (one per channel) → intermediate edge accumulators
// ---------------------------------------------------------------------------

interface EdgeAccum {
  weight: number;
  lastAt: string | null;
}

function bumpEdge(map: Map<string, EdgeAccum>, key: string, at: string | null): void {
  const cur = map.get(key);
  if (cur === undefined) {
    map.set(key, { weight: 1, lastAt: at });
  } else {
    cur.weight += 1;
    if (at !== null && (cur.lastAt === null || at > cur.lastAt)) cur.lastAt = at;
  }
}

export interface BusMessageLike {
  readonly from?: string;
  readonly to?: string;
  readonly topic?: string;
  readonly timestamp?: string;
}

/** Directed bus edges from → to (specific recipients only; "*" broadcasts count
 * as sender activity but form no pairwise edge). */
export function foldBusEdges(messages: readonly BusMessageLike[]): {
  edges: SwarmEdge[];
  activity: Map<string, number>;
  directedPairs: { from: string; to: string }[];
  records: number;
  skipped: number;
} {
  const accum = new Map<string, EdgeAccum>();
  const activity = new Map<string, number>();
  const directedPairs: { from: string; to: string }[] = [];
  let skipped = 0;
  for (const m of messages) {
    const from = personaOf(m.from);
    if (from === null) {
      skipped += 1;
      continue;
    }
    activity.set(from, (activity.get(from) ?? 0) + 1);
    const to = personaOf(m.to);
    if (to === null || to === from) continue; // broadcast / self
    bumpEdge(accum, `${from}\u0000${to}`, m.timestamp ?? null);
    directedPairs.push({ from, to });
  }
  const edges: SwarmEdge[] = [...accum.entries()].map(([k, v]) => {
    const [source, target] = k.split("\u0000");
    return { source: source!, target: target!, channel: "bus", weight: v.weight, directed: true, lastAt: v.lastAt };
  });
  return { edges, activity, directedPairs, records: messages.length, skipped };
}

export interface WorkItemEventLike {
  readonly by?: string;
  readonly at?: string;
  readonly payload?: { readonly workItemId?: string };
}

/** Undirected co-participation edges: two personas that both touched the same
 * work item get one edge per shared work item. */
export function foldWorkItemEdges(events: readonly WorkItemEventLike[]): {
  edges: SwarmEdge[];
  activity: Map<string, number>;
  records: number;
  skipped: number;
} {
  const activity = new Map<string, number>();
  // workItemId → Map<persona, latestAt>
  const perItem = new Map<string, Map<string, string | null>>();
  let skipped = 0;
  for (const e of events) {
    const persona = personaOf(e.by);
    const itemId = e.payload?.workItemId;
    if (persona === null || itemId === undefined) {
      skipped += 1;
      continue;
    }
    activity.set(persona, (activity.get(persona) ?? 0) + 1);
    let m = perItem.get(itemId);
    if (m === undefined) {
      m = new Map<string, string | null>();
      perItem.set(itemId, m);
    }
    const at = e.at ?? null;
    const prev = m.get(persona) ?? null;
    m.set(persona, at !== null && (prev === null || at > prev) ? at : prev);
  }
  const accum = new Map<string, EdgeAccum>();
  for (const [, participants] of perItem) {
    const people = [...participants.keys()].sort();
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const at = maxNullable(participants.get(people[i]!) ?? null, participants.get(people[j]!) ?? null);
        bumpEdge(accum, `${people[i]}\u0000${people[j]}`, at);
      }
    }
  }
  const edges: SwarmEdge[] = [...accum.entries()].map(([k, v]) => {
    const [source, target] = k.split("\u0000");
    return { source: source!, target: target!, channel: "workitem", weight: v.weight, directed: false, lastAt: v.lastAt };
  });
  return { edges, activity, records: events.length, skipped };
}

function maxNullable(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

export interface CommitLike {
  readonly personas: readonly string[];
  readonly at?: string;
}

/** Undirected co-authorship edges between distinct personas appearing on one
 * commit (shared-branch weaving / squash of multiple agents' blocks). */
export function foldCommitEdges(commits: readonly CommitLike[]): {
  edges: SwarmEdge[];
  activity: Map<string, number>;
  records: number;
} {
  const activity = new Map<string, number>();
  const accum = new Map<string, EdgeAccum>();
  for (const c of commits) {
    const people = [...new Set(c.personas.map((p) => personaOf(p)).filter((p): p is PersonaId => p !== null))].sort();
    for (const p of people) activity.set(p, (activity.get(p) ?? 0) + 1);
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        bumpEdge(accum, `${people[i]}\u0000${people[j]}`, c.at ?? null);
      }
    }
  }
  const edges: SwarmEdge[] = [...accum.entries()].map(([k, v]) => {
    const [source, target] = k.split("\u0000");
    return { source: source!, target: target!, channel: "commit", weight: v.weight, directed: false, lastAt: v.lastAt };
  });
  return { edges, activity, records: commits.length };
}

// ---------------------------------------------------------------------------
// Assemble the graph (pure)
// ---------------------------------------------------------------------------

export function buildSwarmGraph(input: {
  readonly personas: readonly PersonaMeta[];
  readonly bus: readonly BusMessageLike[];
  readonly workItems: readonly WorkItemEventLike[];
  readonly commits: readonly CommitLike[];
  readonly windowDays: number | null;
  readonly now: Date;
}): SwarmGraph {
  const bus = foldBusEdges(input.bus);
  const wi = foldWorkItemEdges(input.workItems);
  const commit = foldCommitEdges(input.commits);

  const edges: SwarmEdge[] = [...bus.edges, ...wi.edges, ...commit.edges];

  // Activity per persona across channels.
  const activity = new Map<string, number>();
  for (const src of [bus.activity, wi.activity, commit.activity]) {
    for (const [p, n] of src) activity.set(p, (activity.get(p) ?? 0) + n);
  }

  // Nodes: the full roster (so isolated agents are visible as unconnected), plus
  // any persona that appeared only in data.
  const nodeIds = new Set<string>(input.personas.map((p) => p.id));
  for (const e of edges) {
    nodeIds.add(e.source);
    nodeIds.add(e.target);
  }
  for (const p of activity.keys()) nodeIds.add(p);
  const ids = [...nodeIds].sort();

  const metricEdges: MetricEdge[] = edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight }));
  const degrees = new Map(nodeDegrees(ids, metricEdges).map((d) => [d.id, d]));
  const roleOf = new Map(input.personas.map((p) => [p.id, p.role]));

  const nodes: SwarmNode[] = ids.map((id) => {
    const d = degrees.get(id);
    return {
      id,
      role: roleOf.get(id) ?? "unknown",
      color: PERSONA_COLORS[id] ?? "#94A0BC",
      activity: activity.get(id) ?? 0,
      degree: d?.degree ?? 0,
      strength: d?.strength ?? 0,
    };
  });

  const topo = computeTopologyMetrics(ids, metricEdges);
  const metrics = {
    ...topo,
    reciprocityBus: reciprocity(bus.directedPairs),
    smallWorldSigma: smallWorldSigma(topo),
  };

  const coverage = {
    bus: { records: bus.records, edges: bus.edges.length, skipped: bus.skipped },
    workitem: { records: wi.records, edges: wi.edges.length, skipped: wi.skipped },
    commit: { records: commit.records, edges: commit.edges.length, skipped: 0 },
  };

  return {
    generatedAt: input.now.toISOString(),
    windowDays: input.windowDays,
    channels: CHANNELS,
    nodes,
    edges,
    metrics,
    coverage,
  };
}

// ---------------------------------------------------------------------------
// I/O layer (CLI only)
// ---------------------------------------------------------------------------

function walkJsonFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    // withFileTypes returns the kind of each entry from the SAME syscall that
    // lists it — no second statSync to race against for an answer the listing
    // already had (check-then-use, per AceHack's finding on this file).
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
    }
  }
  return out;
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function withinWindow(at: string | undefined, cutoffMs: number | null): boolean {
  if (cutoffMs === null) return true;
  if (at === undefined) return true;
  const t = Date.parse(at);
  return Number.isNaN(t) ? true : t >= cutoffMs;
}

function loadPersonas(root: string): PersonaMeta[] {
  const path = join(root, "registry/personas.yaml");
  const out: PersonaMeta[] = [];
  try {
    const text = readFileSync(path, "utf8");
    // Lightweight parse: entries are "- id / name / role" blocks. We only need
    // name + role, so scan for `name:` then the following `role:`.
    const lines = text.split("\n");
    let name: string | null = null;
    for (const line of lines) {
      const nm = line.match(/^\s*name:\s*(\S+)/);
      if (nm) {
        name = nm[1]!;
        continue;
      }
      const rl = line.match(/^\s*role:\s*(\S+)/);
      if (rl && name) {
        out.push({ id: name, role: rl[1]! });
        name = null;
      }
    }
  } catch {
    // fall back to the compiled roster with unknown roles
  }
  if (out.length === 0) {
    for (const p of VALID_PERSONAS) out.push({ id: p, role: "unknown" });
  }
  return out;
}

function loadBus(root: string, cutoffMs: number | null): BusMessageLike[] {
  const dir = join(root, "docs/agent-bus");
  // No existsSync guard: walkJsonFiles already returns [] for a missing dir via
  // its own catch, so a guard here just answers a question the next call answers
  // again a moment later (check-then-use — do not restore it).
  const out: BusMessageLike[] = [];
  for (const f of walkJsonFiles(dir)) {
    const m = readJson<BusMessageLike>(f);
    if (m && withinWindow(m.timestamp, cutoffMs)) out.push(m);
  }
  return out;
}

function loadWorkItems(root: string, cutoffMs: number | null): WorkItemEventLike[] {
  const dir = join(root, "workitems/events");
  // No existsSync guard — walkJsonFiles returns [] for a missing dir (see loadBus).
  const out: WorkItemEventLike[] = [];
  for (const f of walkJsonFiles(dir)) {
    const e = readJson<WorkItemEventLike>(f);
    if (e && withinWindow(e.at, cutoffMs)) out.push(e);
  }
  return out;
}

function loadCommits(root: string, windowDays: number | null, maxCommits: number): CommitLike[] {
  const sep = "\u001e";
  const args = ["-C", root, "log", `--format=%H%x1f%aI%x1f%B${sep}`, `-n`, String(maxCommits)];
  if (windowDays !== null) args.push(`--since=${windowDays} days ago`);
  let raw = "";
  try {
    raw = execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  } catch {
    return [];
  }
  const commits: CommitLike[] = [];
  for (const rec of raw.split(sep)) {
    const trimmed = rec.trim();
    if (trimmed === "") continue;
    const parts = trimmed.split("\u001f");
    if (parts.length < 3) continue;
    const at = parts[1]!;
    const body = parts.slice(2).join("\u001f");
    const personas: string[] = [];
    for (const line of body.split("\n")) {
      const agent = line.match(/^\s*Agent:\s*(.+?)\s*$/);
      if (agent) personas.push(agent[1]!);
      const co = line.match(/^\s*Co-authored-by:\s*(.+?)\s*$/i);
      if (co) {
        const p = coauthorPersona(co[1]!);
        if (p) personas.push(p);
      }
    }
    if (personas.length > 0) commits.push({ personas, at });
  }
  return commits;
}

function injectIntoViewer(root: string, graph: SwarmGraph): boolean {
  const viewer = join(root, "docs/design/root-site-iris/site/swarm.html");
  // Read directly and interpret a missing file, rather than gating on a separate
  // existsSync whose answer is stale the instant it returns (check-then-use).
  let html: string;
  try {
    html = readFileSync(viewer, "utf8");
  } catch {
    return false;
  }
  const open = '<script id="swarm-data" type="application/json">';
  const close = "</script>";
  const start = html.indexOf(open);
  if (start === -1) return false;
  const dataStart = start + open.length;
  const end = html.indexOf(close, dataStart);
  if (end === -1) return false;
  const next = html.slice(0, dataStart) + "\n" + JSON.stringify(graph, null, 2) + "\n" + html.slice(end);
  writeFileSync(viewer, next);
  return true;
}

function parseArgs(argv: readonly string[]): { windowDays: number | null; maxCommits: number; out: string; dryRun: boolean } {
  let windowDays: number | null = 30;
  let maxCommits = 4000;
  let out = "data/swarm-graph.json";
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--window-days") windowDays = Number(argv[++i]);
    else if (a === "--all-time") windowDays = null;
    else if (a === "--max-commits") maxCommits = Number(argv[++i]);
    else if (a === "--out") out = argv[++i]!;
    else if (a === "--dry-run") dryRun = true;
  }
  return { windowDays, maxCommits, out, dryRun };
}

function main(argv: readonly string[]): number {
  const { windowDays, maxCommits, out, dryRun } = parseArgs(argv);
  const now = new Date();
  const cutoffMs = windowDays === null ? null : now.getTime() - windowDays * 24 * 60 * 60 * 1000;

  const graph = buildSwarmGraph({
    personas: loadPersonas(REPO_ROOT),
    bus: loadBus(REPO_ROOT, cutoffMs),
    workItems: loadWorkItems(REPO_ROOT, cutoffMs),
    commits: loadCommits(REPO_ROOT, windowDays, maxCommits),
    windowDays,
    now,
  });

  const m = graph.metrics;
  process.stderr.write(
    [
      `swarm-graph: window=${windowDays === null ? "all-time" : windowDays + "d"} ` +
        `nodes=${m.nodeCount} edges=${m.edgeCount} components=${m.componentCount}`,
      `  density=${m.density.toFixed(3)} clustering=${m.clusteringCoefficient.toFixed(3)} ` +
        `avgPath=${m.averagePathLength === null ? "n/a" : m.averagePathLength.toFixed(2)} ` +
        `sigma=${m.smallWorldSigma === null ? "n/a" : m.smallWorldSigma.toFixed(2)}`,
      `  coverage: bus ${graph.coverage.bus.records}rec/${graph.coverage.bus.edges}e ` +
        `workitem ${graph.coverage.workitem.records}rec/${graph.coverage.workitem.edges}e ` +
        `commit ${graph.coverage.commit.records}rec/${graph.coverage.commit.edges}e`,
    ].join("\n") + "\n",
  );

  if (dryRun) {
    process.stdout.write(JSON.stringify(graph, null, 2) + "\n");
    return 0;
  }

  writeFileSync(join(REPO_ROOT, out), JSON.stringify(graph, null, 2) + "\n");
  const injected = injectIntoViewer(REPO_ROOT, graph);
  process.stderr.write(`swarm-graph: wrote ${out}${injected ? " + injected into swarm.html" : " (viewer not found)"}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
