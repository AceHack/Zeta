/**
 * corporate/portal-view.ts — everything a delivery portal shows, derived.
 *
 * ── WHY THIS MODULE, AND WHAT IT REFUSES TO DO ───────────────────────────────
 * A page was designed first and this was written to feed it, which is the order that normally
 * produces a backend full of fields the UI wanted and the organization never knew. So the rule this
 * module is built to keep is the inverse: **every field here is a fold of the event log, and a field
 * the log cannot answer is absent rather than defaulted.**
 *
 * That shows up as three deliberate absences a caller has to handle:
 *
 *   - `spend.costUsd` is `undefined` unless a price table was configured. Never `0`.
 *   - `files` is `undefined` when the change-control adapter cannot diff, and `[]` when it diffed
 *     and found nothing. Those are different facts and the page says different things about them.
 *   - `documents` lists only refs that RESOLVED to bytes. A phase that cited a plan line contributes
 *     no document, because a documents list you cannot open is worse than a short one.
 *
 * ── DERIVED, NEVER DECLARED ──────────────────────────────────────────────────
 * Nothing here is stored. `agentActivity` is not a status field somebody sets — it is computed from
 * what the log last saw that hat do, and from whether a checkpoint is holding its work. A stored
 * status is a field that goes stale exactly when it matters, which is while a run is moving.
 */

import type { Cascade, CascadeNode } from "./goal-cascade";
import { childrenOf, isLeafType, WorkState } from "./goal-cascade";
import type { OrgChart } from "./org-chart";
import type { FoldedOrganization, MeteredCall } from "./org-fold";
import type { OrgEvent } from "./org-event";
import { addSpend, NO_SPEND, spendOf, type PortMeter, type Spend } from "./meter";
import { departmentOf, departmentRank, gateLabel, hatName, humanise } from "./org-presentation";
import { parseRequestRef, sourceLabel } from "./request";

// ─── Documents ──────────────────────────────────────────────────────────────

/** One document an agent wrote, as a reader meets it. */
export interface DocumentView {
  readonly workId: string;
  readonly path: string;
  /** The last path segment — what a file list shows. Both separators, because runs are on Windows too. */
  readonly name: string;
  readonly gate: string;
  readonly gateLabel: string;
  readonly producedByHatId: string;
  readonly producedBy: string;
  readonly bytes: number;
  readonly atMs: number;
  /**
   * Whether a person is being asked to decide about THIS file.
   *
   * Derived by joining the document's gate against the gates actually holding for a person, never
   * stored on the document. A stored flag would survive the approval that cleared it.
   */
  readonly awaitingDecision: boolean;
}

/**
 * Every document written for a set of work items, oldest first.
 *
 * Ordered by when it was written rather than by gate, because that is the order the work happened
 * in and a reader following a ticket is following time.
 */
/**
 * The last segment of a path, under either separator.
 *
 * `split("/")` alone left a Windows run rendering `C:\Users\...\brd_approval.md` as the file's
 * NAME in a list twelve characters wide. Caught by looking at a real payload rather than a fixture,
 * because every fixture in this repo uses forward slashes.
 */
export function baseName(path: string): string {
  const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return at < 0 ? path : path.slice(at + 1);
}

export function documentViews(
  chart: OrgChart,
  folded: FoldedOrganization,
  workIds: readonly string[],
  awaiting: readonly { readonly workId: string; readonly gate: string }[] = [],
): readonly DocumentView[] {
  const wanted = new Set(workIds);
  const heldWork = new Set(awaiting.map((a) => a.workId));
  const mine = [...folded.documents.values()].filter((d) => wanted.has(d.workId));

  // ── WHICH FILE IS THE DECISION ────────────────────────────────────────────
  // Not "the document produced AT the holding gate": a checkpoint gate frequently has no producer
  // of its own — `architecture_approval` judges what `architecture_design` wrote — so keying on the
  // gate name left the flag permanently false, which is a check that cannot fire. Measured on a
  // real run: ten documents, a genuine hold, and not one of them marked.
  //
  // The walk STOPS at the checkpoint, so the last document written for that work item is exactly
  // what the person is being asked about. Derived from the log's own ordering, no gate table.
  const decisionDoc = new Map<string, string>();
  for (const doc of mine) {
    if (!heldWork.has(doc.workId)) continue;
    const prior = decisionDoc.get(doc.workId);
    const priorAt = prior === undefined ? -1 : (folded.documents.get(`${doc.workId}::${prior}`)?.atMs ?? -1);
    if (doc.atMs >= priorAt) decisionDoc.set(doc.workId, doc.path);
  }

  const out: DocumentView[] = [];
  for (const doc of mine) {
    out.push({
      workId: doc.workId,
      path: doc.path,
      name: baseName(doc.path),
      gate: doc.gate,
      gateLabel: gateLabel(doc.gate),
      producedByHatId: doc.producedByHatId,
      producedBy: hatName(chart, doc.producedByHatId),
      bytes: doc.bytes,
      atMs: doc.atMs,
      awaitingDecision: decisionDoc.get(doc.workId) === doc.path,
    });
  }
  return out.sort((a, b) => a.atMs - b.atMs);
}

// ─── Changes ────────────────────────────────────────────────────────────────

export interface ChangeView {
  readonly workId: string;
  readonly changeId: string;
  readonly branch: string;
  readonly url: string | undefined;
  readonly workdir: string | undefined;
  /**
   * The files, or `undefined` when the adapter cannot diff.
   *
   * `undefined` and `[]` are NOT interchangeable: the first says nobody can tell you, the second
   * says somebody looked and the branch is empty — which is a finding worth showing loudly.
   */
  readonly files: readonly { readonly path: string; readonly added: number; readonly removed: number }[] | undefined;
  readonly added: number | undefined;
  readonly removed: number | undefined;
}

export function changeViews(folded: FoldedOrganization, workIds: readonly string[]): readonly ChangeView[] {
  const out: ChangeView[] = [];
  for (const workId of workIds) {
    const address = folded.changes.get(workId);
    if (address === undefined) continue;
    const files = folded.changedFiles.get(workId);
    out.push({
      workId,
      changeId: address.changeId,
      branch: address.branch,
      url: address.url,
      workdir: address.workdir,
      files,
      added: files === undefined ? undefined : files.reduce((n, f) => n + f.added, 0),
      removed: files === undefined ? undefined : files.reduce((n, f) => n + f.removed, 0),
    });
  }
  return out;
}

// ─── Spend ──────────────────────────────────────────────────────────────────

/** What a set of work items cost, over every metered crossing attributed to them. */
export function spendForWork(folded: FoldedOrganization, workIds: readonly string[]): Spend {
  const wanted = new Set(workIds);
  return spendOf(
    folded.meters.filter((m) => m.workId !== undefined && wanted.has(m.workId)).map((m) => m.meter),
  );
}

export function spendForHat(folded: FoldedOrganization, hatId: string): Spend {
  return spendOf(folded.meters.filter((m) => m.hatId === hatId).map((m) => m.meter));
}

/**
 * Everything the run spent, including the calls attributed to no work item.
 *
 * Deliberately NOT the sum of the per-request totals: an intake poll belongs to no request, so a
 * dashboard that added the requests together would under-report the bill and never say by how much.
 */
export function spendForRun(folded: FoldedOrganization): Spend {
  return spendOf(folded.meters.map((m) => m.meter));
}

/** What the run spent that no work item can be charged for. `total - attributed`, as a fact. */
export function unattributedSpend(folded: FoldedOrganization): Spend {
  return spendOf(folded.meters.filter((m) => m.workId === undefined).map((m) => m.meter));
}

// ─── Agents ─────────────────────────────────────────────────────────────────

export const AgentActivity = {
  /** Its work is held at a checkpoint. Nothing it can do until a person answers. */
  Held: "held",
  /** It produced something inside the window this fold covers. */
  Working: "working",
  /** Nothing in the log has it doing anything. */
  Idle: "idle",
} as const;

export type AgentActivity = (typeof AgentActivity)[keyof typeof AgentActivity];

export interface AgentView {
  readonly hatId: string;
  readonly name: string;
  readonly department: string;
  readonly departmentRank: number;
  readonly activity: AgentActivity;
  /** What it is doing, in a sentence, or absent when it is doing nothing. */
  readonly doing: string | undefined;
  /** The work item that sentence is about. */
  readonly onWorkId: string | undefined;
  /** How many phases this hat produced across the whole log. A count of facts, not a rating. */
  readonly stepsProduced: number;
  readonly spend: Spend;
}

/**
 * The roster, with what each hat is actually doing.
 *
 * `stepsProduced` counts `phase_output` facts, which is a count of work done and NOT a score. The
 * register already has a reputation model with an honest prior; a raw count presented beside a name
 * reads as a ranking, so it is named for what it is.
 */
export function agentViews(
  chart: OrgChart,
  folded: FoldedOrganization,
  awaiting: readonly { readonly workId: string; readonly gate: string }[] = [],
): readonly AgentView[] {
  const heldWork = new Map(awaiting.map((a) => [a.workId, a.gate]));
  const steps = new Map<string, number>();
  const latest = new Map<string, { gate: string; workId: string; atMs: number }>();
  for (const out of folded.phaseOutputs.values()) {
    steps.set(out.producedByHatId, (steps.get(out.producedByHatId) ?? 0) + 1);
    const prior = latest.get(out.producedByHatId);
    if (prior === undefined || out.atMs >= prior.atMs) {
      latest.set(out.producedByHatId, { gate: out.gate, workId: out.workId, atMs: out.atMs });
    }
  }

  const out: AgentView[] = [];
  for (const hat of chart.hats) {
    const owned = folded.cascade.nodes.filter((n) => n.ownerHatId === hat.id);
    const heldNode = owned.find((n) => heldWork.has(n.workId));
    const last = latest.get(hat.id);
    const department = departmentOf(chart, hat.id) ?? "unassigned";

    let activity: AgentActivity = AgentActivity.Idle;
    let doing: string | undefined;
    let onWorkId: string | undefined;
    if (heldNode !== undefined) {
      activity = AgentActivity.Held;
      doing = `held at ${gateLabel(heldWork.get(heldNode.workId) ?? "")} on ${heldNode.workId}`;
      onWorkId = heldNode.workId;
    } else if (last !== undefined) {
      activity = AgentActivity.Working;
      doing = `${gateLabel(last.gate)} on ${last.workId}`;
      onWorkId = last.workId;
    }

    out.push({
      hatId: hat.id,
      name: hatName(chart, hat.id),
      department: humanise(department),
      departmentRank: departmentRank(department),
      activity,
      doing,
      onWorkId,
      stepsProduced: steps.get(hat.id) ?? 0,
      spend: spendForHat(folded, hat.id),
    });
  }
  // Department order first so the roster reads like an org chart, then the busy before the idle.
  const RANK: Readonly<Record<AgentActivity, number>> = { held: 0, working: 1, idle: 2 };
  return out.sort(
    (a, b) =>
      a.departmentRank - b.departmentRank ||
      RANK[a.activity] - RANK[b.activity] ||
      a.name.localeCompare(b.name),
  );
}

// ─── Activity ───────────────────────────────────────────────────────────────

export const ActivityTone = {
  Good: "good",
  Working: "working",
  NeedsPerson: "needs_person",
  Bad: "bad",
  Neutral: "neutral",
} as const;

export type ActivityTone = (typeof ActivityTone)[keyof typeof ActivityTone];

export interface ActivityView {
  readonly atMs: number;
  readonly tone: ActivityTone;
  readonly text: string;
  /** The work item or request this was about, for a link. */
  readonly subjectId: string;
  readonly workId: string | undefined;
}

/**
 * The feed, newest first.
 *
 * Built from the FACTS rather than from `event.decision`, which is prose written for a log line.
 * A feed built on prose is a feed that changes whenever somebody rewords a message, and cannot be
 * filtered by what happened.
 */
export function activityViews(
  chart: OrgChart,
  events: readonly OrgEvent[],
  limit = 50,
): readonly ActivityView[] {
  const out: ActivityView[] = [];
  for (const event of events) {
    const fact = event.fact;
    if (fact === undefined) continue;
    const who = event.actorHatId === undefined ? undefined : hatName(chart, event.actorHatId);
    if (fact.kind === "phase_output") {
      out.push({
        atMs: event.atMs,
        tone: ActivityTone.Working,
        text: `${who ?? hatName(chart, fact.producedByHatId)} produced ${gateLabel(fact.gate)}`,
        subjectId: event.subjectId,
        workId: fact.workId,
      });
    } else if (fact.kind === "document_written") {
      out.push({
        atMs: event.atMs,
        tone: ActivityTone.Neutral,
        text: `${hatName(chart, fact.producedByHatId)} wrote ${baseName(fact.path)}`,
        subjectId: event.subjectId,
        workId: fact.workId,
      });
    } else if (fact.kind === "change_opened") {
      out.push({
        atMs: event.atMs,
        tone: ActivityTone.Working,
        text: `opened ${fact.branch}`,
        subjectId: event.subjectId,
        workId: fact.workId,
      });
    } else if (fact.kind === "change_files") {
      const added = fact.files.reduce((n, f) => n + f.added, 0);
      const removed = fact.files.reduce((n, f) => n + f.removed, 0);
      out.push({
        atMs: event.atMs,
        tone: ActivityTone.Neutral,
        text: `${String(fact.files.length)} file(s) changed, +${String(added)} −${String(removed)}`,
        subjectId: event.subjectId,
        workId: fact.workId,
      });
    } else if (fact.kind === "intake_accepted") {
      out.push({
        atMs: event.atMs,
        tone: ActivityTone.Good,
        text: `accepted ${fact.item.title}`,
        subjectId: event.subjectId,
        workId: undefined,
      });
    } else if (fact.kind === "intake_refused") {
      out.push({
        atMs: event.atMs,
        tone: ActivityTone.Bad,
        text: `declined "${fact.title}" — ${humanise(fact.reason)}`,
        subjectId: event.subjectId,
        workId: undefined,
      });
    } else if (fact.kind === "gates_evaluated") {
      for (const evaluation of fact.evaluations) {
        const approved = String(evaluation.outcome) === "approved";
        out.push({
          atMs: event.atMs,
          tone: approved ? ActivityTone.Good : ActivityTone.Bad,
          text: `${gateLabel(String(evaluation.gate))} ${approved ? "approved" : "rejected"}`,
          subjectId: event.subjectId,
          workId: event.subjectId,
        });
      }
    }
  }
  return out.sort((a, b) => b.atMs - a.atMs).slice(0, limit);
}

// ─── The home summary ───────────────────────────────────────────────────────

export interface PortalSummary {
  readonly waitingOnPeople: number;
  readonly running: number;
  readonly delivered: number;
  readonly refused: number;
  readonly spend: Spend;
  /** What the run spent that belongs to no work item, so the parts can be seen not to sum. */
  readonly unattributed: Spend;
  readonly requests: number;
}

export function portalSummary(
  folded: FoldedOrganization,
  awaiting: readonly { readonly workId: string; readonly gate: string }[],
  refusedCount: number,
): PortalSummary {
  const leaves = folded.cascade.nodes.filter(
    (n) => isLeafType(n.workType) && childrenOf(folded.cascade, n.workId).length === 0,
  );
  const keys = new Set<string>();
  for (const node of folded.cascade.nodes) if (node.requestRef !== undefined) keys.add(node.requestRef);
  return {
    waitingOnPeople: awaiting.length,
    running: leaves.filter((n) => n.state !== WorkState.Done && n.state !== WorkState.Canceled).length,
    delivered: leaves.filter((n) => n.state === WorkState.Done).length,
    refused: refusedCount,
    spend: spendForRun(folded),
    unattributed: unattributedSpend(folded),
    requests: keys.size,
  };
}

/**
 * An answer somebody gave that the organisation has not acted on yet.
 *
 * ── WHY THIS STATE HAS TO BE VISIBLE ─────────────────────────────────────────
 * Answering a checkpoint writes to a QUEUE; the organisation reads that queue the next time it
 * runs. Between those two moments the work is still stopped, and the portal must say so — a person
 * who cannot see that their approval has not landed will either answer again or assume it is done.
 *
 * ── THE FIRST VERSION OF THIS FUNCTION COULD NOT FIRE ────────────────────────
 * It asked whether the gate was still in `awaitingHuman`. It never is: `observe-org` already clears
 * `awaitingHumanAt` as soon as an ANSWER EXISTS, which is a different question from whether the
 * answer was applied. So the guard was a reader with no writer — a check that cannot fail, in code
 * written to prevent exactly that. Caught by approving from the browser and watching the portal
 * report one blocked item when two were stopped.
 *
 * ── THE HONEST TEST ──────────────────────────────────────────────────────────
 * The runtime writes `human-action/<actionId>` into the gate evaluation's own `evidenceRefs` when
 * it applies an answer — that is what makes an approval traceable. So an answer is APPLIED exactly
 * when the log carries its id, and pending otherwise. One source, no second bookkeeping to drift.
 */
export interface AnsweredNotApplied {
  readonly workId: string;
  readonly gate: string;
  readonly outcome: string;
  readonly byHuman: string;
  readonly reason: string;
  readonly atMs: number;
  readonly actionId: string;
}

export function answeredNotApplied(
  actions: readonly {
    readonly kind: string;
    readonly subjectId: string;
    readonly reason: string;
    readonly byHuman: string;
    readonly atMs: number;
    readonly actionId: string;
    readonly detail?: Readonly<Record<string, string>>;
  }[],
  evaluations: readonly { readonly evidenceRefs: readonly string[] }[],
): readonly AnsweredNotApplied[] {
  // Every action id the log has actually consumed.
  const applied = new Set<string>();
  for (const evaluation of evaluations) {
    for (const ref of evaluation.evidenceRefs) {
      if (ref.startsWith("human-action/")) applied.add(ref.slice("human-action/".length));
    }
  }

  const byKey = new Map<string, AnsweredNotApplied>();
  for (const a of actions) {
    if (a.kind !== "approve_gate" && a.kind !== "reject_gate") continue;
    const gate = a.detail?.["gate"];
    if (gate === undefined) continue;
    if (applied.has(a.actionId)) continue;
    const key = `${a.subjectId}::${gate}`;
    const prior = byKey.get(key);
    // LAST WORD WINS, matching how the runtime itself resolves two answers for one gate.
    if (prior !== undefined && prior.atMs > a.atMs) continue;
    byKey.set(key, {
      workId: a.subjectId,
      gate,
      outcome: a.kind === "approve_gate" ? "approved" : "rejected",
      byHuman: a.byHuman,
      reason: a.reason,
      atMs: a.atMs,
      actionId: a.actionId,
    });
  }
  return [...byKey.values()].sort((x, y) => y.atMs - x.atMs);
}

/** Every work id beneath a request, so the per-request folds above have their key set. */
export function workIdsForRequest(cascade: Cascade, requestKey: string): readonly string[] {
  return cascade.nodes.filter((n: CascadeNode) => n.requestRef === requestKey).map((n) => n.workId);
}

/** A request's source, named for a person. Kept here so every surface labels it identically. */
export function requestSourceLabel(requestKey: string): string {
  const ref = parseRequestRef(requestKey);
  return ref === undefined ? "unknown" : sourceLabel(ref.source);
}

/** Metered calls for one work item, newest first — the receipt behind a per-item total. */
export function metersForWork(folded: FoldedOrganization, workId: string): readonly MeteredCall[] {
  return folded.meters.filter((m) => m.workId === workId).slice().sort((a, b) => b.atMs - a.atMs);
}

/** Roll a set of spends into one, keeping the denominators. */
export function totalSpend(spends: readonly Spend[]): Spend {
  return spends.reduce(addSpend, NO_SPEND);
}

export type { PortMeter, Spend };
