/**
 * observe-org.ts — what the organization is doing, read from its own event log.
 *
 *   bun observe-org.ts --store <dir>              print once and exit
 *   bun observe-org.ts --store <dir> --watch      re-read every few seconds
 *   bun observe-org.ts --store <dir> --json       the same numbers, for a UI
 *   bun observe-org.ts --store <dir> --hat <id>   one hat: its duty, its route, what it owes
 *
 * ── WHY THIS READS A LOG AND NOT A RUNNING PROCESS ──────────────────────────
 * Everything the register knows is DERIVED from its events: `foldOrganization` rebuilds the
 * cascade, the calendar, the queues, the gate record and the portfolios out of them, and the fold
 * is order-independent so a half-written log reads correctly.
 *
 * So this holds no state of its own. It cannot drift from the organization, cannot disagree with it
 * about what happened, and cannot become a second thing to keep in step — which is the failure a
 * dashboard with its own store always eventually becomes. It also means the same command works on a
 * run that is still going, a run that finished, and a run that CRASHED, because the log is written
 * as the run is lived rather than at the end of it.
 *
 * NOTHING HERE WRITES. A reader that can change what it reads is not an observer.
 */

import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { readEvents, readRuns } from "./org-store";
import { foldOrganization } from "./org-fold";
import { gateHealth, queueHealth, scheduleHealth } from "./org-status";
import { buildContextPack } from "./context-pack";
import { childrenOf, isLeafType, WorkState, type Cascade, type CascadeNode } from "./goal-cascade";
import { ORDERED_GATES } from "./quality-gate";
import type { OrgEvent } from "./org-event";
import { hatSupply, hatsHeldBy, type AgentRoster, type HatSupply } from "./agent-roster";
import { isPaused, type HumanAction } from "./human-action";
import { humanGatesFor, type HumanCheckpoint } from "./quality-gate";
import { answeredBlockers, openBlockers, type RaisedBlocker } from "./human-blocker";
import {
  approvalViews,
  departmentViews,
  meetingViews,
  roomViews,
  type ApprovalView,
  type DepartmentView,
  type MeetingView,
  type RoomView,
} from "./org-boardroom";
import type { OrgChart } from "./org-chart";
import type { GateEvaluation } from "./quality-gate";
import type { PhaseOutput } from "./org-fold";
import { parseRequestRef } from "./request";
import {
  refusedRequestViews,
  requestViews,
  type RefusedRequestView,
  type RequestView,
} from "./request-view";
import {
  blockerBecause,
  departmentOf,
  gateLabel,
  phaseChecklist,
  gateQuestion,
  hatName,
  stateLabel,
  workTypeLabel,
} from "./org-presentation";
import type { HatBinding } from "./hat-binding";

/** What one work item is doing right now, and what the organization intends next. */
/**
 * One stage of a work item's journey, as a person reads it.
 *
 * THE RAIL IS THE ANSWER to "what gates were approved". A progress ratio says two of fourteen and
 * leaves the reader no better off; this says WHICH two, WHO signed them, and what the next one is
 * going to ask — which is the difference between a status bar and an account.
 */
export interface StageView {
  readonly gate: string;
  readonly label: string;
  /** What this gate asks, so somebody being asked to approve it knows what they are answering. */
  readonly asks: string;
  /**
   * Where this stage stands.
   *
   * `waiting` is deliberately separate from `next`: both are un-crossed, and only one of them is
   * the reader's move. Merging them would put the organization's turn and the person's turn in the
   * same colour, which is the whole thing a checkpoint exists to distinguish.
   */
  readonly state: "passed" | "rejected" | "waiting" | "next" | "pending";
  readonly byName: string | undefined;
  readonly byHatId: string | undefined;
  readonly reason: string | undefined;
  readonly atMs: number | undefined;
  /** True when a person, not the organization, gave this verdict. */
  readonly byHuman: boolean;
  /**
   * WHAT THIS PHASE MADE — the thing a reviewer is being asked to judge.
   *
   * `undefined` means nothing was produced for this gate, which is a fact and not a gap: it is what
   * lets the page say "there is nothing here to approve" instead of showing an Approve button over
   * an empty phase.
   */
  readonly produced: { readonly summary: string; readonly refs: readonly string[] } | undefined;
  /**
   * WHAT THE ADAPTER PRINTED while producing it, and how long it took.
   *
   * The captured stdout and stderr of the command behind the phase. For a model-backed author this
   * is the closest thing to a transcript the register holds, and it was being dropped between the
   * producer and the gate — so a run could say a phase succeeded and never say what it said.
   */
  readonly output: readonly string[];
  readonly durationMs: number | undefined;
  /**
   * WHAT THIS STEP SAID IT WOULD DO, from the producer's own declaration.
   *
   * Empty when the producer declared nothing, which is not the same as a step with nothing to do —
   * the standard below says what it was supposed to do either way, and the gap between the two is
   * the thing worth looking at.
   */
  readonly plan: readonly string[];
  /** What this step is responsible for doing, in any organization running this chain. */
  readonly checklist: readonly string[];
  /**
   * True when the verdict was a SIMULATED reviewer's default rather than anybody's judgement.
   *
   * Derived from the evidence the register itself wrote (`auto-approved:`), never from a flag. A
   * page that showed these the same as a real approval would be reporting that fourteen gates
   * examined the work when none of them did.
   */
  readonly rubberStamped: boolean;
}

export interface WorkView {
  readonly workId: string;
  readonly title: string;
  readonly state: WorkState;
  readonly assigneeHatId: string | undefined;
  readonly gatesPassed: number;
  readonly gatesTotal: number;
  readonly nextGate: string | undefined;
  readonly recoveryIfRejected: string | undefined;
  readonly merged: boolean;
  /**
   * The gate this item is WAITING ON A PERSON at, if any.
   *
   * Derived: the next legal gate is a configured checkpoint and nobody has answered it. Derived
   * rather than read off an event, because an event says what happened once and this has to stay
   * true as the queue changes underneath it.
   */
  readonly awaitingHumanAt: string | undefined;
  /** The gate waiting on a person, as a person would name it. */
  readonly awaitingHumanLabel: string | undefined;
  /** What that gate is actually asking, so the reader can answer it without going looking. */
  readonly awaitingHumanAsks: string | undefined;
  /** Evaluations recorded by a hat that does not hold the scope — should always be zero. */
  readonly unauthorized: number;
  // ── THE READABLE HALF ──────────────────────────────────────────────────────
  // Ids stay, because an action is addressed to one. Names travel beside them, because nobody runs
  // a company by reading keys.
  readonly typeLabel: string;
  readonly stateLabel: string;
  readonly assigneeName: string | undefined;
  readonly assigneeDepartment: string | undefined;
  /** What asked for this, so a work item can be navigated back to its request. */
  readonly requestKey: string | undefined;
  readonly requestLabel: string | undefined;
  readonly nextGateLabel: string | undefined;
  /** Every stage, in order, with who signed it. */
  readonly stages: readonly StageView[];
  /**
   * How many of the passed stages were a simulated reviewer's default.
   *
   * Surfaced on the item rather than left to be counted from the stages, because the headline claim
   * a board makes about a delivered item is "it passed fourteen gates", and that claim means
   * something very different when thirteen of them consulted nobody.
   */
  readonly rubberStamped: number;
  /**
   * WHERE THE WORK IS — branch, merge request, worktree.
   *
   * The first question anybody reading this as a developer asks, and the one the log threw away
   * until `change_opened` existed.
   */
  readonly change: { readonly branch: string; readonly url: string | undefined; readonly workdir: string | undefined } | undefined;
  /** Every test that ran against this item, with its outcome and how long it took. */
  readonly tests: readonly {
    readonly testCaseId: string;
    readonly outcome: string;
    readonly durationMs: number;
    readonly byHatId: string;
    readonly evidence: readonly string[];
  }[];
  /** What the organization refused, about this item. Named here so it is not only in a global list. */
  readonly refusals: readonly string[];
}

/** The whole picture, derived. Every field here is a fold over the log, never a stored opinion. */
export interface OrgView {
  readonly atMs: number;
  readonly runs: number;
  readonly events: number;
  readonly facts: number;
  readonly work: readonly WorkView[];
  readonly pending: readonly WorkView[];
  readonly inFlight: readonly WorkView[];
  readonly done: readonly WorkView[];
  readonly queue: { readonly ready: number; readonly inFlight: number; readonly merged: number; readonly awaitingReview: number; readonly staleClaims: number };
  readonly busyHats: readonly { readonly hatId: string; readonly booked: number; readonly missed: number; readonly busyNow: boolean; readonly doingNow: string | undefined }[];
  readonly refusals: readonly string[];
  /** Ports that reached something real in the most recent run, so a view says what was simulated. */
  readonly realPorts: readonly string[];
  /** Who exists, what they may wear, and what they hold. Empty when no roster was declared. */
  readonly agents: readonly AgentView[];
  /** Per-hat capacity and bench. Only hats somebody is provisioned for — the rest is noise. */
  readonly supply: readonly HatSupply[];
  /** What a person has asked the organization to do, and whether it has been taken up. */
  readonly actions: readonly HumanAction[];
  /** Requests that could not be read, so a lost instruction is visible rather than silent. */
  readonly actionProblems: readonly { readonly file: string; readonly reason: string }[];
  readonly paused: boolean;
  /**
   * Blockers the organization has handed OUT — the questions waiting on a person.
   *
   * The one section of this view that is not a report on the organization. It is a report on what
   * the organization is waiting for FROM THE READER, and it sits at the top of the page for that
   * reason: everything else here is watching, and this is the part that only moves if they move.
   *
   * Derived by subtracting the answers from the raises, so an answered blocker leaves the list
   * without anything having to mark it closed.
   */
  readonly awaitingPeople: readonly BlockerCardView[];
  /** Raised blockers a person HAS answered, newest last — what the run will act on. */
  readonly answeredForPeople: readonly { readonly blocker: RaisedBlocker; readonly answer: HumanAction }[];
  /** Outbox files that were not readable blockers. A question that vanished is worse than a refusal. */
  readonly blockerProblems: readonly { readonly file: string; readonly reason: string }[];
  // ── THE COMPANY, TOP DOWN ──────────────────────────────────────────────────
  /** Every department, in wall-chart order, with who is working and what they decided. */
  readonly departments: readonly DepartmentView[];
  /** Every gate verdict, newest first, with the person and department behind it. */
  readonly approvals: readonly ApprovalView[];
  /** Conversations the organization is holding — open ones first. */
  readonly rooms: readonly RoomView[];
  /** Meetings that were actually booked, with the attendees named. */
  readonly meetings: readonly MeetingView[];
  /** Work stopped at a checkpoint, waiting for a person to answer it. */
  readonly awaitingDecisions: readonly WorkView[];
  // ── THE SPINE ──────────────────────────────────────────────────────────────
  /**
   * Every request the organization has work for — the index a person actually navigates by.
   *
   * "Request" rather than "ticket" because the source is an ordinary string: Jira is one, a
   * directory drop is another, and nothing below this line knows the difference.
   */
  readonly requests: readonly RequestView[];
  /** Requests the organization DECLINED, with the reason. The filer is owed this. */
  readonly refusedRequests: readonly RefusedRequestView[];
}

/**
 * A raised blocker as a card: the record, plus the two things a reader needs that it does not carry.
 *
 * The record stores a HAT ID because that is what routes; a person reading it wants the hat's name.
 * And it stores the whole `why` sentence, which repeats the question the card already headlines.
 */
export interface BlockerCardView extends RaisedBlocker {
  readonly byName: string;
  /** The reason it left, without restating the question above it. */
  readonly because: string;
}

/** One row of the Agent Directory. */
export interface AgentView {
  readonly agentId: string;
  readonly label: string | undefined;
  readonly eligibleHatIds: readonly string[];
  readonly wearing: readonly string[];
  readonly concurrentHats: number;
}

/**
 * The stage rail for one work item.
 *
 * Built from the canonical gate order and the verdicts recorded against it, so a gate with no
 * verdict is `pending` rather than absent — the reader sees the whole journey and where along it
 * the work stands, not just the part that has happened.
 */
function stagesFor(
  chart: OrgChart,
  workId: string,
  evaluations: readonly GateEvaluation[],
  outputs: ReadonlyMap<string, PhaseOutput>,
  nextGate: string | undefined,
  waitingAt: string | undefined,
): readonly StageView[] {
  const mine = evaluations.filter((e) => e.workId === workId);
  return ORDERED_GATES.map((gate) => {
    const key = String(gate);
    // THE LATEST VERDICT for this gate, not the first. Work that was rejected and came back has two,
    // and showing the older one would report a stage as failed after it had been fixed and passed.
    const verdicts = mine.filter((e) => String(e.gate) === key).sort((a, b) => a.atMs - b.atMs);
    const last = verdicts[verdicts.length - 1];
    const state: StageView["state"] =
      last !== undefined && (last.outcome === "approved" || last.outcome === "waived")
        ? "passed"
        : last !== undefined
          ? "rejected"
          : key === waitingAt
            ? "waiting"
            : key === nextGate
              ? "next"
              : "pending";
    return {
      gate: key,
      label: gateLabel(key),
      asks: gateQuestion(key),
      state,
      byName: last === undefined ? undefined : hatName(chart, last.byHatId),
      byHatId: last?.byHatId,
      reason: last?.reason,
      atMs: last?.atMs,
      byHuman: last?.evidenceRefs.some((r: string) => r.startsWith("human-action/")) ?? false,
      produced: ((o) => (o === undefined ? undefined : { summary: o.summary, refs: o.refs }))(
        outputs.get(`${workId}::${key}`),
      ),
      // The plan is carried in the transcript as `plan:` entries, so it survives without a second
      // channel that could disagree with the output it came from.
      output: (outputs.get(`${workId}::${key}`)?.output ?? []).filter((o) => !o.startsWith("plan:")),
      durationMs: outputs.get(`${workId}::${key}`)?.durationMs,
      plan: (outputs.get(`${workId}::${key}`)?.output ?? [])
        .filter((o) => o.startsWith("plan:"))
        .map((o) => o.slice("plan:".length)),
      checklist: phaseChecklist(key),
      rubberStamped: last?.evidenceRefs.some((r: string) => r.startsWith("auto-approved:")) ?? false,
    };
  });
}

/**
 * Every test run recorded against one work item.
 *
 * Read from the EVENT's subject rather than from the run itself: a `TestRun` names its case and not
 * the work, and the link between the two lives in the cycle the runtime recorded against the item.
 * Reading it from the event is what makes "which tests ran for this change" answerable at all.
 */
function testsFor(
  events: readonly OrgEvent[],
  workId: string,
): readonly {
  testCaseId: string;
  outcome: string;
  durationMs: number;
  byHatId: string;
  evidence: readonly string[];
}[] {
  const out: {
    testCaseId: string;
    outcome: string;
    durationMs: number;
    byHatId: string;
    evidence: readonly string[];
  }[] = [];
  for (const event of events) {
    if (event.subjectId !== workId || event.fact?.kind !== "qa_cycle") continue;
    for (const run of event.fact.report.runs) {
      out.push({
        testCaseId: run.testCaseId,
        outcome: String(run.outcome),
        durationMs: Math.max(0, run.finishedAtMs - run.startedAtMs),
        byHatId: run.executorHatId,
        evidence: run.evidence.map((e) => `${e.kind}:${e.ref}`),
      });
    }
  }
  return out;
}

const leavesOf = (cascade: Cascade): readonly CascadeNode[] =>
  cascade.nodes.filter((n) => isLeafType(n.workType) && childrenOf(cascade, n.workId).length === 0);

/**
 * Build the view.
 *
 * Exported and pure so a CLI, an HTTP handler and a test all read the SAME numbers. Two renderers
 * over one fold cannot disagree; two renderers over two queries eventually do.
 */
export function viewOf(
  events: readonly OrgEvent[],
  runCount: number,
  nowMs: number,
  // The participation half. Absent means the run declared no roster and accepted no actions, which
  // is the state before any of this existed — reported as empty rather than invented.
  extra: {
    readonly roster?: AgentRoster;
    readonly bindings?: readonly HatBinding[];
    readonly actions?: readonly HumanAction[];
    readonly actionProblems?: readonly { readonly file: string; readonly reason: string }[];
    /** Which optional checkpoints the run was started with. Empty means fully agentic. */
    readonly checkpoints?: readonly HumanCheckpoint[];
    /** Blockers the organization raised out to a person, from the outbox. */
    readonly raisedBlockers?: readonly RaisedBlocker[];
    /**
     * Where each source's items can be read, as `{source: "https://…/{id}"}`.
     *
     * Supplied, never guessed — a link invented from a source name points at somebody else's
     * tracker, and a wrong link is worse than a plain id.
     */
    readonly requestUrls?: Readonly<Record<string, string>>;
    readonly blockerProblems?: readonly { readonly file: string; readonly reason: string }[];
  } = {},
): OrgView {
  const chartResult = buildOrgChart(SEED_HATS);
  if (!chartResult.ok) throw new Error(chartResult.reason);
  const chart = chartResult.chart;
  const folded = foldOrganization(events);

  const humanGates = humanGatesFor(extra.checkpoints ?? []);
  const answered = new Set(
    (extra.actions ?? [])
      .filter((a) => a.kind === "approve_gate" || a.kind === "reject_gate")
      .map((a) => `${a.subjectId}::${a.detail?.["gate"] ?? ""}`),
  );

  const work: WorkView[] = leavesOf(folded.cascade).map((node) => {
    // The node's OWN type: without it this reports against every canonical gate and tells a
    // reader a task still needs a gate its type never walks.
    const health = gateHealth(chart, node.workId, folded.gateEvaluations, node.workType);
    const next = health.nextGate;
    const waiting =
      next !== undefined && humanGates.has(next) && !answered.has(`${node.workId}::${String(next)}`)
        ? String(next)
        : undefined;
    const stages = stagesFor(
      chart,
      node.workId,
      folded.gateEvaluations,
      folded.phaseOutputs,
      health.nextGate,
      waiting,
    );
    return {
      workId: node.workId,
      title: node.title,
      state: node.state,
      assigneeHatId: node.assigneeHatId,
      gatesPassed: Math.round(health.progress * ORDERED_GATES.length),
      gatesTotal: ORDERED_GATES.length,
      nextGate: health.nextGate,
      recoveryIfRejected: health.recoveryIfRejected,
      merged: health.merged,
      awaitingHumanAt: waiting,
      awaitingHumanLabel: waiting === undefined ? undefined : gateLabel(waiting),
      awaitingHumanAsks: waiting === undefined ? undefined : gateQuestion(waiting),
      unauthorized: health.unauthorizedEvaluations,
      rubberStamped: stages.filter((st) => st.rubberStamped).length,
      change: ((c) => (c === undefined ? undefined : { branch: c.branch, url: c.url, workdir: c.workdir }))(
        folded.changes.get(node.workId),
      ),
      tests: testsFor(events, node.workId),
      // Matched on the work id appearing in the refusal's own text, because refusals are sentences
      // the register writes about itself and are not keyed. Reported globally as well, so a refusal
      // that names no item is never lost by being filed under one.
      refusals: folded.refusals.filter((r) => r.includes(node.workId)),
      typeLabel: workTypeLabel(String(node.workType)),
      stateLabel: stateLabel(String(node.state)),
      assigneeName: node.assigneeHatId === undefined ? undefined : hatName(chart, node.assigneeHatId),
      assigneeDepartment: node.assigneeHatId === undefined ? undefined : departmentOf(chart, node.assigneeHatId),
      requestKey: node.requestRef,
      requestLabel: ((r) => (r === undefined ? undefined : r.externalId))(
        node.requestRef === undefined ? undefined : parseRequestRef(node.requestRef),
      ),
      nextGateLabel: health.nextGate === undefined ? undefined : gateLabel(String(health.nextGate)),
      stages,
    };
  });

  const q = folded.queues.length === 0
    ? { ready: 0, inFlight: 0, merged: 0, awaitingReview: 0, staleClaims: 0 }
    : folded.queues
        .map((queue) => queueHealth(queue, nowMs))
        .reduce(
          (a, h) => ({
            ready: a.ready + h.ready,
            inFlight: a.inFlight + h.inFlight,
            merged: a.merged + h.merged,
            awaitingReview: a.awaitingReview + h.awaitingReview.length,
            staleClaims: a.staleClaims + h.staleClaims.length,
          }),
          { ready: 0, inFlight: 0, merged: 0, awaitingReview: 0, staleClaims: 0 },
        );

  // Only hats the calendar actually knows about. Listing all 124 with zeroes would bury the four
  // that are working, which is the same as not reporting them.
  const hatIds = [...new Set(folded.calendar.blocks.map((b) => b.hatId))].sort();
  const busyHats = hatIds.map((hatId) => {
    const health = scheduleHealth(folded.calendar, hatId, nowMs);
    return { hatId, booked: health.booked, missed: health.missed, busyNow: health.busyNow, doingNow: health.doingNow };
  });

  return {
    atMs: nowMs,
    runs: runCount,
    events: events.length,
    facts: folded.factCount,
    work,
    pending: work.filter((w) => w.state === WorkState.Open && w.assigneeHatId === undefined),
    inFlight: work.filter((w) => w.state !== WorkState.Done && w.state !== WorkState.Canceled && w.assigneeHatId !== undefined),
    done: work.filter((w) => w.state === WorkState.Done),
    queue: q,
    busyHats,
    refusals: folded.refusals,
    realPorts: folded.fidelities.at(-1)?.realPorts ?? [],
    agents: (extra.roster?.agents ?? []).map((a) => ({
      agentId: a.agentId,
      label: a.label,
      eligibleHatIds: a.eligibleHatIds,
      wearing: hatsHeldBy(extra.bindings ?? [], a.agentId).map((b) => b.hatId),
      concurrentHats: a.concurrentHats ?? 1,
    })),
    // Only hats somebody is provisioned for. Listing all 124 with an empty bench would bury the
    // handful that matter, which is the same as not reporting them.
    supply: [...new Set((extra.roster?.agents ?? []).flatMap((a) => a.eligibleHatIds))]
      .sort()
      .map((hatId) =>
        hatSupply({ roster: extra.roster ?? { agents: [] }, bindings: extra.bindings ?? [], chart, hatId, nowMs }),
      ),
    actions: extra.actions ?? [],
    actionProblems: extra.actionProblems ?? [],
    paused: isPaused(extra.actions ?? []),
    // DERIVED, not stored. A blocker leaves this list because somebody answered it, never because
    // something marked it closed — a stored flag and the answer queue can disagree, and the way
    // that disagreement shows up is a person being asked something they already answered.
    awaitingPeople: openBlockers(extra.raisedBlockers ?? [], extra.actions ?? []).map((b) => ({
      ...b,
      byName: hatName(chart, b.byHatId),
      because: blockerBecause(b.exhaustion),
    })),
    answeredForPeople: answeredBlockers(extra.raisedBlockers ?? [], extra.actions ?? []),
    blockerProblems: extra.blockerProblems ?? [],
    departments: departmentViews(chart, folded.calendar, folded.gateEvaluations, leavesOf(folded.cascade), nowMs),
    approvals: approvalViews(chart, folded.gateEvaluations),
    rooms: roomViews(chart, events, folded.gateEvaluations, extra.actions ?? []),
    meetings: meetingViews(chart, events),
    // The reader's own queue, derived the same way the rail is — so what the page highlights and
    // what the rail shows can never be two different answers to "whose turn is it".
    awaitingDecisions: work.filter((w) => w.awaitingHumanAt !== undefined),
    requests: requestViews(folded.cascade, events, {
      ...(extra.requestUrls === undefined ? {} : { urlTemplates: extra.requestUrls }),
      waitingWorkIds: work.filter((w) => w.awaitingHumanAt !== undefined).map((w) => w.workId),
    }),
    refusedRequests: refusedRequestViews(events),
  };
}

const bar = (passed: number, total: number): string =>
  "#".repeat(Math.max(0, passed)) + ".".repeat(Math.max(0, total - passed));

/** Render for a terminal. Deliberately plain: this is read over ssh as often as in a window. */
export function render(view: OrgView): string {
  const out: string[] = [];
  const t = new Date(view.atMs).toISOString().slice(11, 19);
  out.push(`ORGANIZATION @ ${t}   ${String(view.runs)} run(s), ${String(view.events)} event(s), ${String(view.facts)} carrying state`);
  out.push("");

  // AT THE TOP, ABOVE THE WORK. Everything below this is a report on what the organization is
  // doing; this is the part that does not move unless the reader moves. A question buried under
  // forty rows of green progress is a question nobody answers.
  if (view.awaitingPeople.length > 0) {
    out.push(`WAITING ON YOU  ${String(view.awaitingPeople.length)} blocker(s) the organization could not resolve`);
    for (const b of view.awaitingPeople) {
      out.push(`  ${b.blockerId}`);
      out.push(`    ${b.why}`);
      out.push(`    raised by ${b.byHatId} — an answer lets it: ${b.unblocks}`);
      out.push(`    answer with: --kind answer_blocker --subject ${b.blockerId} --detail answer=<your answer>`);
    }
    out.push("");
  }
  for (const p of view.blockerProblems) {
    out.push(`  !! a question could not be read: ${p.file} — ${p.reason}`);
  }

  out.push(`WORK   pending ${String(view.pending.length)} | in flight ${String(view.inFlight.length)} | done ${String(view.done.length)}`);
  if (view.work.length === 0) {
    out.push("  (the log holds no work items yet)");
  }
  for (const w of view.work) {
    const who = w.assigneeHatId ?? "unstaffed";
    const next = w.merged
      ? "merged"
      : w.awaitingHumanAt !== undefined
        ? `${w.awaitingHumanAt} (WAITING ON YOU)`
        : (w.nextGate ?? "-");
    out.push(`  ${w.workId.padEnd(10)} ${bar(w.gatesPassed, w.gatesTotal)} ${String(w.gatesPassed).padStart(2)}/${String(w.gatesTotal)}  ${who.padEnd(22)} next: ${next}`);
    out.push(`  ${" ".repeat(10)} ${w.title.slice(0, 82)}`);
    if (w.recoveryIfRejected !== undefined && !w.merged) {
      out.push(`  ${" ".repeat(10)} if rejected -> ${w.recoveryIfRejected}`);
    }
    // Should always be zero. It is shown because a silent zero and an unchecked zero look the same.
    if (w.unauthorized > 0) {
      out.push(`  ${" ".repeat(10)} !! ${String(w.unauthorized)} evaluation(s) by a hat without the scope`);
    }
  }

  out.push("");
  out.push(`QUEUE  ready ${String(view.queue.ready)} | in flight ${String(view.queue.inFlight)} | awaiting review ${String(view.queue.awaitingReview)} | merged ${String(view.queue.merged)} | stale claims ${String(view.queue.staleClaims)}`);

  if (view.busyHats.length > 0) {
    out.push("");
    out.push("HATS WITH BOOKED TIME");
    for (const h of view.busyHats) {
      const doing = h.busyNow ? `busy: ${h.doingNow ?? "?"}` : "free";
      out.push(`  ${h.hatId.padEnd(26)} ${String(h.booked)} booked, ${String(h.missed)} missed, ${doing}`);
    }
  }

  if (view.realPorts.length > 0) {
    out.push("");
    // A view that does not say this lets a simulated run read exactly like a real one.
    out.push(`PORTS THAT REACHED SOMETHING REAL   ${view.realPorts.join(", ")}`);
  }

  if (view.refusals.length > 0) {
    out.push("");
    out.push(`REFUSALS (${String(view.refusals.length)}) — what the organization declined to do, and why`);
    for (const r of view.refusals.slice(0, 12)) out.push(`  ${r.slice(0, 110)}`);
    if (view.refusals.length > 12) out.push(`  ... ${String(view.refusals.length - 12)} more`);
  }
  return out.join("\n");
}

/** One hat: what it is for, who it answers to, and — the point — what it was NOT given. */
export function renderHat(hatId: string, resourceAuthorityHatId: string): string {
  const chartResult = buildOrgChart(SEED_HATS);
  if (!chartResult.ok) return `chart: ${chartResult.reason}`;
  const built = buildContextPack(chartResult.chart, { hatId, resourceAuthorityHatId });
  if (!built.ok) return `no such hat '${hatId}': ${built.reason}`;
  const pack = built.pack;
  const out: string[] = [];
  out.push(`HAT ${pack.hatId}   scope: ${pack.scope}${pack.degraded ? "   [DEGRADED]" : ""}`);
  out.push(`  duty        ${pack.brief.duty}`);
  out.push(`  supervisor  ${pack.brief.supervisorHatId ?? "(none)"}`);
  out.push(`  escalates   ${pack.brief.escalationHatId ?? "(none)"}`);
  out.push("  may");
  for (const route of pack.brief.tools) {
    const needs = route.evidenceAnyOf.length === 0 ? "" : `   needs: ${route.evidenceAnyOf.join("|")}`;
    // "(nowhere)" is not cosmetic: an implementer whose request_review routes nowhere cannot ask
    // for one, and that is exactly the kind of dead route this view exists to surface.
    out.push(`    ${route.tool.padEnd(20)} -> ${route.targetHatId ?? "(nowhere)"}${needs}`);
  }
  if (pack.items.length > 0) {
    out.push("  knows");
    for (const item of pack.items) out.push(`    ${item.kind.padEnd(18)} ${item.summary.slice(0, 70)}`);
  }
  // THE HALF THAT MATTERS. An agent reading only what it knows cannot tell a thin organization from
  // an unreachable one, so the pack carries what is missing and this prints it.
  out.push(pack.omissions.length === 0 ? "  told it does NOT know: (nothing missing)" : "  told it does NOT know");
  for (const omission of pack.omissions) {
    out.push(`    ${omission.kind.padEnd(20)} ${omission.about.slice(0, 40)} — ${omission.why.slice(0, 60)}`);
  }
  return out.join("\n");
}

function valueAfter(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at >= 0 && at + 1 < argv.length ? argv[at + 1] : undefined;
}

export async function main(argv: readonly string[]): Promise<number> {
  const store = valueAfter(argv, "--store");
  if (store === undefined) {
    console.error("usage: observe-org.ts --store <dir> [--watch] [--json] [--hat <hatId>] [--every <seconds>] [--now <epochMs>]");
    return 2;
  }
  const hat = valueAfter(argv, "--hat");
  if (hat !== undefined) {
    console.log(renderHat(hat, valueAfter(argv, "--rmo") ?? "rmo_office"));
    return 0;
  }

  const once = (): void => {
    const events = readEvents(store);
    // ── THE ORGANIZATION'S CLOCK, NOT THIS PROCESS'S ────────────────────────
    // `local-time-never-enters-the-shared-fold`: a local wall-clock steers local actions and must
    // never weight the shared conclusion. Passing `Date.now()` here did exactly that — every block
    // in the log's own timeline read as MISSED, because wall-clock had moved past a run that used
    // its own clock. The reading changed with when you looked at it, which is the leak.
    //
    // So the reading is taken at the log's own latest instant. `--now` is available for the
    // genuinely local question ("is this hat busy RIGHT NOW"), and it is opt-in because that is a
    // different question from "what does this log say happened".
    const stated = valueAfter(argv, "--now");
    const atMs = stated !== undefined
      ? Number.parseInt(stated, 10)
      : (events.length === 0 ? Date.now() : Math.max(...events.map((e) => e.atMs)));
    const view = viewOf(events, readRuns(store).length, atMs);
    console.log(argv.includes("--json") ? JSON.stringify(view, null, 2) : render(view));
  };

  if (!argv.includes("--watch")) {
    once();
    return 0;
  }
  const everyMs = Math.max(1, Number.parseInt(valueAfter(argv, "--every") ?? "5", 10)) * 1000;
  // Re-READ, never accumulate. Holding state between ticks is how a watcher starts disagreeing with
  // the log it is supposed to be showing.
  for (;;) {
    console.log("[2J[H");
    once();
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
