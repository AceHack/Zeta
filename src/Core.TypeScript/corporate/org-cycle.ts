/**
 * corporate/org-cycle.ts — ONE SCRIPTED STORY, not the organization's loop.
 *
 * ── READ THIS FIRST: THIS MODULE HAS BEEN DEMOTED ────────────────────────────
 * For most of this register's life the nine phases below were the ONLY way the acts that create
 * work could happen. Accepting a goal, deciding a priority, sizing hat supply, submitting finished
 * work — every one of them was reachable from here and from nowhere else. That had a consequence
 * nobody wrote down and everybody could read off a run:
 *
 *   > **The C-suite did not set direction. This file set direction, in a fixed order, and named a
 *   > C-suite hat as the one it happened to.**
 *
 * That is no longer true. `generative-work.ts` derives those acts as OPENINGS on a hat's own menu,
 * `org-drive.ts` applies them, and `org-cadence.ts` runs the result across a span of time. An empty
 * company now decides what it is for, breaks that down, documents it, prices it, staffs it, submits
 * it through the same gate chain this file calls, and reports what it could not staff — with no
 * script anywhere in the path.
 *
 * **So `runOrgCycle` is a FIXTURE now: one deterministic story, useful because it is the same story
 * every time.** It is not what the organization does. If you are asking "what would this
 * organization do next", the answer is `driveRound`; over a week, `runCadence`.
 *
 * ── WHAT THIS FILE UNIQUELY COVERS: NOTHING, ANY MORE ────────────────────────
 * This section used to list four capabilities only the script could reach. All four are now
 * reachable from a tick, and the list is kept as a record of what closing them took rather than
 * deleted as if it had never been true:
 *
 *   - **Scheduled work blocks** (phase 5) — `org-drive.bookWork`. Not a menu item: an assignment
 *     that reserves no time is one nobody can honour, so it is a consequence of placement rather
 *     than an act the assignee might not choose.
 *   - **The accountable chain meeting** (phase 6) — `convene_chain`, the 29th grammar verb. The
 *     drive could already convene over a DIVERGED artifact, which is a repair; this is a planned
 *     review across every accountable level's calendar, at a time they are all free.
 *   - **The churn escalation** (phase 8) — `escalate_churn`, the 28th. A manager or above rules on
 *     work that has spent its gate attempts, from the legal set for the trigger and the level, ONCE
 *     per item.
 *   - **A configurable outcome per task** (`outcomeFor`) — this one was never true, and the claim
 *     is corrected rather than closed. `DriveDeps.choose` already let a caller decide per hat and
 *     per tick which offered act to take, including holding one item back while submitting
 *     another. `org-cadence.test.ts` pins that.
 *
 * ── SO WHY IS IT STILL HERE ──────────────────────────────────────────────────
 * Because it is a good FIXTURE and a bad organization. One deterministic story, the same every
 * time, exercising the nine phases in a fixed order with every refusal surfaced — which is exactly
 * what four test files want and exactly what an organization must not be. Deleting it would trade
 * real coverage for the satisfaction of saying the script was gone.
 *
 * ── THE NINE PHASES ──────────────────────────────────────────────────────────
 * It runs the whole loop the corporate register describes, in order, with every step's refusal
 * surfaced rather than skipped:
 *
 *   1. the C-suite ACCEPTS a goal                              (goal-cascade)
 *   2. it CASCADES to initiative → project → task, each rung owned by the accountable level
 *   3. the lead asks the RMO to STAFF the unassigned tasks     (supervisor-signal, routed)
 *   4. the RMO DECIDES on the anchor, and the decision is the record
 *   5. assignees are SCHEDULED prioritized-work blocks         (work-schedule)
 *   6. the accountable chain MEETS — one booking across every calendar, atomic
 *   7. a dev hits a BLOCKER and signals upward with evidence
 *   8. the supervisor cannot resolve it, so it ESCALATES past them
 *   9. work completes and DELIVERY ROLLS UP from the leaves to the goal
 *
 * ── IT IS A FUNCTION OF ITS INPUTS ───────────────────────────────────────────
 * No clock, no randomness, no I/O. `nowMs` and `createId` are supplied, so the same inputs produce
 * the same report — which is what lets the cycle be a test rather than a demo, and what
 * `.claude/rules/local-time-never-enters-the-shared-fold.md` requires of anything two hats must
 * agree about.
 *
 * ── REFUSALS ARE RESULTS ─────────────────────────────────────────────────────
 * Every step that can be refused records the refusal and the cycle CONTINUES where continuing is
 * meaningful. A cycle that threw on the first refusal would only ever report the happy path, and
 * the interesting question about an organization is what it does when a step does not go through.
 */

import {
  EMPTY_BOARD,
  postToAnchor,
  recordDecision,
  resolveAnchor,
  type AnchorBoard,
  type EvidenceRef,
} from "./discussion-anchor";
import {
  accountableHatsFor,
  acceptGoal,
  assign,
  decompose,
  EMPTY_CASCADE,
  isDelivered,
  nodeById,
  setState,
  unstaffedTasks,
  WorkState,
  type Cascade,
  type CascadeNode,
} from "./goal-cascade";
import { supervisorOf, type HatLevel, type OrgChart } from "./org-chart";
import { decideSupply, endorseRecommendation, DEFAULT_LOAD_PER_WEARER, type SupplyVote } from "./rmo";
import { assignableAgents, hatSupply, type AgentRoster } from "./agent-roster";
import type { HatBinding } from "./hat-binding";
import type { PriorityDecision } from "./prioritization";
import {
  EMPTY_CALENDAR,
  ScheduleBlockState,
  ScheduleBlockType,
  firstCommonFreeSlot,
  scheduleBlock,
  scheduleMeeting,
  type Calendar,
} from "./work-schedule";
import { sendSupervisorSignal, SignalTool, type SupervisorSignal } from "./supervisor-signal";
import { firstLegalChooser, preferChooser, type OrgChooser } from "./org-decision";
import {
  GateOutcome,
  NO_PROPOSER,
  humanGatesFor,
  runGateChain,
  type GateEvaluation,
  type GateKind,
  type GateRunResult,
  type HumanCheckpoint,
  type RecoveryPath,
} from "./quality-gate";
import {
  DEFAULT_CHURN_THRESHOLD,
  decideEscalation,
  detectChurn,
  escalationDeciderFor,
  EscalationTrigger,
  type EscalationAction,
  type EscalationEffect,
} from "./escalation";

export interface OrgCyclePlan {
  readonly goalTitle: string;
  readonly acceptingHatId: string;
  readonly initiativeTitles: readonly string[];
  /** Per initiative, in order. */
  readonly projectTitles: readonly string[];
  /** Per project, in order. */
  readonly taskTitles: readonly string[];
}

export interface OrgCycleDeps {
  readonly chart: OrgChart;
  readonly plan: OrgCyclePlan;
  readonly createId: (prefix: string) => string;
  readonly nowMs: number;
  readonly workBlockMs: number;
  readonly resourceAuthorityHatId: string;
  /** The RMO's staffing choice for a task. `undefined` means it could not staff it. */
  readonly contributorFor: (task: CascadeNode) => string | undefined;
  /**
   * How the work is ranked, so the RMO weights the queue instead of counting it.
   *
   * Absent means every item weighs the "unranked" 0.5 — deliberately not zero, because staffing
   * nobody for work nobody has ranked yet is how an unranked backlog justifies an empty team.
   */
  readonly priorities?: readonly PriorityDecision[];
  /** Open tasks one wearer carries. Shared with the RMO so both sides use one number. */
  readonly loadPerWearer?: number;
  /**
   * How each eligible supervisor votes on a hat's supply. Absent endorses the workload.
   *
   * The RMO used to be computed AFTER the run and printed in a report, which meant staffing was
   * never actually constrained by it: `assignment-engine` picked whoever was eligible and the
   * supply figure was a number nobody consulted. A resource office that cannot refuse is not one.
   */
  readonly supplyVoteBy?: (voterHatId: string, recommended: number) => SupplyVote | undefined;
  /**
   * The agents that EXIST, and which hats each is provisioned for.
   *
   * Absent means the old behaviour — an agent conjured per hat, so no hat is ever short-staffed.
   * Supplying one makes staffing refusable: a hat with nobody free stays unstaffed and the cycle
   * says which agents were blocked and why, instead of assigning somebody who cannot hold it.
   */
  readonly roster?: AgentRoster;
  /** Live hat bindings, so capacity and cooldown are read from what is actually worn. */
  readonly bindings?: readonly HatBinding[];
  /**
   * The optional human checkpoints — grooming, the approach, both, or (the default) neither.
   *
   * Empty means the organization runs the whole chain agentically. That is the default because it
   * is what every existing caller does, and because a checkpoint nobody asked for would stop a run
   * that had no one waiting to unblock it.
   */
  readonly checkpoints?: readonly HumanCheckpoint[];
  /**
   * What a person has decided about a work item's gate, if anything.
   *
   * Supplied by the caller, because the caller is what read the action queue. The cycle does not
   * reach for the queue itself: a run that could read new instructions mid-cycle would be deciding
   * against a moving input, and its trace would not replay.
   */
  readonly humanDecisionFor?: (
    workId: string,
    gate: GateKind,
  ) => { readonly outcome: GateOutcome; readonly actionRef: string } | undefined;
  /** What happened when the assignee did the work. */
  readonly outcomeFor: (task: CascadeNode) => "done" | "blocked";
  /**
   * How each quality gate is decided. Absent = approve.
   *
   * A task the assignee calls finished still has to cross the seven gates before the organization
   * calls it done. Until this existed the cycle went from assigned straight to `done` on the
   * assignee's own say-so — "delivered" meant "the dev said so", which is the shape every other
   * refusal in this register exists to remove.
   */
  readonly gateChooser?: OrgChooser<GateOutcome>;
  /**
   * How many times the assignee may rework and re-present a task before the cycle stops retrying.
   *
   * A cycle with no retry cannot churn, and a cycle with unbounded retry never stops — the first
   * makes escalation unreachable, the second makes it unnecessary because nothing ever gives up.
   */
  readonly maxGateAttempts?: number;
  /** Bounce-backs before the loop is declared churning. */
  readonly churnThreshold?: number;
  /** How a management hat picks its escalation. Absent = the first legal action. */
  readonly escalationChooser?: OrgChooser<EscalationAction>;
}

/** One decision the cycle made, and where the answer actually came from. */
export interface CycleDecisionSource {
  readonly decision: "gate" | "escalation" | "staffing" | "work_outcome";
  /**
   * `caller` — a function the caller supplied answered it.
   * `preference` — nobody supplied one, so a stated default answered it.
   */
  readonly from: "caller" | "preference";
  readonly detail: string;
}

/**
 * What this cycle's answers were made of.
 *
 * ── WHY A PURE PATH STILL NEEDS THIS ─────────────────────────────────────────
 * `runOrgCycle` is deliberately a function of its inputs — no clock, no randomness, no I/O — and
 * that is a feature, not a gap. It performs no work and reaches nothing, by design.
 *
 * The problem was never the behaviour. It was the SILENCE. `runOrgRuntime` gained a fidelity block
 * that names its five adapters, so a reader can tell a run that shipped something from one that
 * decided it had. This path had no equivalent, and `run-org.ts --cycle` printed "task-004 passed the
 * gates" and "goal DELIVERED" in exactly the same voice as the real path. Measured before this
 * existed: 14 of 14 gate verdicts approved — runtime validation included — and no field anywhere in
 * the report from which a reader could learn that.
 *
 * ── DERIVED, NOT DECLARED ────────────────────────────────────────────────────
 * Every entry is computed from which deps were actually supplied, so supplying a chooser CHANGES the
 * report. There is deliberately no `replayable: true` field: a flag whose type is the literal `true`
 * is the vacuity class this repo has already caught once, and it would be exactly that here.
 */
export interface CycleFidelity {
  readonly decisions: readonly CycleDecisionSource[];
  /** One line for an operator, rendered from `decisions` rather than written alongside them. */
  readonly summary: string;
}

/** What answered each decision, from the deps alone. Supplying a chooser changes what this says. */
export function cycleFidelity(deps: OrgCycleDeps): CycleFidelity {
  const decisions: readonly CycleDecisionSource[] = [
    deps.gateChooser === undefined
      ? { decision: "gate", from: "preference", detail: "every gate takes 'approved' where it is legal" }
      : { decision: "gate", from: "caller", detail: "a caller-supplied chooser decides each gate" },
    deps.escalationChooser === undefined
      ? { decision: "escalation", from: "preference", detail: "the first legal action is taken" }
      : { decision: "escalation", from: "caller", detail: "a caller-supplied chooser picks the action" },
    // These two have no default at all — the caller must supply them — so they are always `caller`.
    // Listed anyway: a reader asking "did the organization decide this?" needs the answer for every
    // decision, and an omitted row reads as "not applicable" rather than "somebody else answered".
    { decision: "staffing", from: "caller", detail: "`contributorFor` names the assignee" },
    { decision: "work_outcome", from: "caller", detail: "`outcomeFor` says whether the work succeeded" },
  ];
  const byCaller = decisions.filter((d) => d.from === "caller").length;
  return {
    decisions,
    summary:
      `this cycle PERFORMED NOTHING and reached nothing: ${String(byCaller)} of ${String(decisions.length)} ` +
      `decisions came from the caller, the rest from a stated preference`,
  };
}

export interface OrgCycleReport {
  readonly goalWorkId: string;
  readonly delivered: boolean;
  /**
   * Where this cycle's answers came from. Derived from the deps — see `cycleFidelity`.
   *
   * Present so `delivered: true` can never be read as a claim that an organization did something.
   */
  readonly fidelity: CycleFidelity;
  /** Every level that actually took an action this cycle, senior first. */
  readonly levelsEngaged: readonly HatLevel[];
  readonly cascade: Cascade;
  readonly calendar: Calendar;
  readonly board: AnchorBoard;
  readonly signals: readonly SupervisorSignal[];
  /** What happened, in order. The organization's account of itself. */
  readonly events: readonly string[];
  /** Every step that was refused, and why. */
  readonly refusals: readonly string[];
  readonly staffedTaskIds: readonly string[];
  readonly escalatedTaskIds: readonly string[];
  /** One gate run per task the assignee claimed finished. */
  readonly gateRuns: readonly { readonly taskId: string; readonly run: GateRunResult }[];
  /** Tasks whose work was finished but which a gate turned back, with where they go. */
  readonly gateBlocked: readonly { readonly taskId: string; readonly gate: GateKind; readonly recovery?: RecoveryPath }[];
  /** Every gate verdict across every attempt — the record churn is counted from. */
  readonly gateEvaluations: readonly GateEvaluation[];
  /** Loops broken structurally rather than endured. */
  readonly escalations: readonly {
    readonly taskId: string;
    readonly action: EscalationAction;
    readonly effect: EscalationEffect;
    readonly byHatId: string;
  }[];
}

const STAFFING_EVIDENCE: readonly EvidenceRef[] = [{ kind: "measurement", ref: "queue/unstaffed" }];
const BLOCKER_EVIDENCE: readonly EvidenceRef[] = [{ kind: "log", ref: "logs/blocked" }];

/**
 * Run one cycle.
 *
 * Long, and deliberately linear: the value of this function is that the whole organizational loop
 * is readable in one place, in the order it happens. Splitting it into nine helpers would hide the
 * one thing it exists to show.
 */
export function runOrgCycle(deps: OrgCycleDeps): OrgCycleReport {
  const { chart, plan } = deps;
  const events: string[] = [];
  const refusals: string[] = [];
  const signals: SupervisorSignal[] = [];
  const levels = new Set<HatLevel>();
  const staffed: string[] = [];
  const escalated: string[] = [];
  const gateRuns: { taskId: string; run: GateRunResult }[] = [];
  const gateBlocked: { taskId: string; gate: GateKind; recovery?: RecoveryPath }[] = [];
  const gateEvaluations: GateEvaluation[] = [];
  const escalations: {
    taskId: string;
    action: EscalationAction;
    effect: EscalationEffect;
    byHatId: string;
  }[] = [];

  let cascade: Cascade = EMPTY_CASCADE;
  let calendar: Calendar = EMPTY_CALENDAR;
  let board: AnchorBoard = EMPTY_BOARD;

  const engage = (hatId: string): void => {
    const level = chart.byId.get(hatId)?.level;
    if (level !== undefined) levels.add(level);
  };

  // ── 1. The C-suite accepts a goal ─────────────────────────────────────────
  const goalId = deps.createId("goal");
  const accepted = acceptGoal(cascade, chart, {
    workId: goalId,
    title: plan.goalTitle,
    acceptingHatId: plan.acceptingHatId,
  });
  if (!accepted.ok) {
    // Nothing downstream is meaningful without a goal, so this is the one step that ends the cycle.
    return {
      goalWorkId: goalId,
      delivered: false,
      fidelity: cycleFidelity(deps),
      levelsEngaged: [],
      cascade,
      calendar,
      board,
      signals,
      events,
      refusals: [`accept goal: ${accepted.reason}`],
      staffedTaskIds: [],
      escalatedTaskIds: [],
      gateRuns: [],
      gateBlocked: [],
      gateEvaluations: [],
      escalations: [],
    };
  }
  cascade = accepted.cascade;
  engage(plan.acceptingHatId);
  events.push(`${plan.acceptingHatId} accepted the goal '${plan.goalTitle}'`);

  // ── 2. Cascade down the ladder ────────────────────────────────────────────
  const decomposeInto = (parentId: string, titles: readonly string[], prefix: string): readonly string[] => {
    if (titles.length === 0) return [];
    const children = titles.map((title) => ({ workId: deps.createId(prefix), title }));
    const step = decompose(cascade, chart, parentId, children);
    if (!step.ok) {
      refusals.push(`decompose ${parentId}: ${step.reason}`);
      return [];
    }
    cascade = step.cascade;
    for (const child of children) {
      const node = nodeById(cascade, child.workId);
      if (node === undefined) continue;
      engage(node.ownerHatId);
      events.push(`${node.ownerHatId} owns ${node.workType} '${node.title}'`);
    }
    return children.map((c) => c.workId);
  };

  const initiativeIds = decomposeInto(goalId, plan.initiativeTitles, "init");
  const projectIds = initiativeIds.flatMap((id) => decomposeInto(id, plan.projectTitles, "proj"));
  // The ids are not needed downstream — `unstaffedTasks(cascade)` is the queue the RMO works from,
  // and reading it off the cascade keeps the staffing loop honest about what is actually unassigned
  // rather than about what this call happened to create.
  projectIds.forEach((id) => decomposeInto(id, plan.taskTitles, "task"));

  // ── 3 & 4. The RMO staffs the tasks ───────────────────────────────────────
  // The request goes to the resource authority, NOT up the line — a lead asking its own supervisor
  // for people is asking someone who must forward it.
  // Captured ONCE: the queue as it stands when staffing begins. Re-deriving it inside the loop
  // would shrink `upcoming` as the loop assigns, so each decision would see less demand than the
  // one before it and the office would under-staff the tail of its own queue.
  const pendingQueue = [...unstaffedTasks(cascade)];
  for (const task of pendingQueue) {
    const sent = sendSupervisorSignal(
      chart,
      board,
      {
        signalId: deps.createId("sig"),
        anchorId: deps.createId("anchor"),
        fromHatId: task.ownerHatId,
        tool: SignalTool.RequestResource,
        title: `staff '${task.title}'`,
        message: `task ${task.workId} has no contributor`,
        evidence: STAFFING_EVIDENCE,
        atMs: deps.nowMs,
        workItemId: task.workId,
      },
      deps.resourceAuthorityHatId,
    );
    if (!sent.ok) {
      refusals.push(`staffing request for ${task.workId}: ${sent.reason}`);
      continue;
    }
    board = sent.board;
    signals.push(sent.signal);
    engage(sent.signal.fromHatId);
    engage(sent.signal.toHatId);
    events.push(`${sent.signal.fromHatId} → ${sent.signal.toHatId}: request_resource for ${task.workId}`);

    const contributor = deps.contributorFor(task);
    if (contributor === undefined) {
      // Left open on purpose. An unanswered staffing request is a real state, and closing it to
      // tidy the report would hide the one thing the RMO needs to see.
      refusals.push(`RMO could not staff ${task.workId}`);
      continue;
    }

    const decided = recordDecision(board, {
      decisionId: deps.createId("dec"),
      anchorId: sent.signal.anchorId,
      byHatId: sent.signal.toHatId,
      atMs: deps.nowMs,
      decision: `assign ${contributor}`,
      rationale: `${contributor} reports into the owning line and is free`,
      evidence: STAFFING_EVIDENCE,
    });
    if (!decided.ok) {
      refusals.push(`RMO decision for ${task.workId}: ${decided.reason}`);
      continue;
    }
    board = decided.board;

    // ── IS THERE ANYBODY TO WEAR IT? ─────────────────────────────────────
    // Asked BEFORE the RMO votes, because a supply decision about a hat nobody can wear is a
    // decision about nothing. Skipped entirely when no roster was supplied, which keeps the old
    // conjure-an-agent-per-hat behaviour available and visible rather than silently imposed.
    if (deps.roster !== undefined) {
      const bench = assignableAgents({
        roster: deps.roster,
        bindings: deps.bindings ?? [],
        chart,
        hatId: contributor,
        nowMs: deps.nowMs,
      });
      if (bench.length === 0) {
        const supplyNow = hatSupply({
          roster: deps.roster,
          bindings: deps.bindings ?? [],
          chart,
          hatId: contributor,
          nowMs: deps.nowMs,
        });
        const why = supplyNow.blocked.length === 0
          ? "no agent is provisioned for it"
          : supplyNow.blocked.map((b) => `${b.agentId}: ${b.reason}`).join("; ");
        refusals.push(`no agent can wear '${contributor}' for ${task.workId} — ${why}`);
        continue;
      }
      events.push(
        `${deps.resourceAuthorityHatId}: ${String(bench.length)} agent(s) available for ${contributor} (${bench.join(", ")})`,
      );
    }

    // ── THE RMO AUTHORIZES, OR THE HAT IS NOT WORN ───────────────────────
    // Supply is computed from the work already assigned to this hat PLUS the queue still waiting
    // that would route to it, so the office staffs for demand rather than one cycle behind it. A
    // quorum of the hat's own supervisors then votes; short of quorum is a refusal, not a default.
    // TASKS and WEARERS are different units, and conflating them is a real refusal: a hat with one
    // authorized wearer holds `loadPerWearer` tasks, so comparing an assigned-task count against a
    // wearer target refused the second task to every hat that had just taken its first.
    const heldTasks = cascade.nodes.filter(
      (n) => n.assigneeHatId === contributor && n.state !== WorkState.Done && n.state !== WorkState.Canceled,
    ).length;
    const perWearer = Math.max(1, deps.loadPerWearer ?? DEFAULT_LOAD_PER_WEARER);
    const wearers = Math.ceil(heldTasks / perWearer);
    const supply = decideSupply({
      chart,
      hatId: contributor,
      currentWearers: wearers,
      supply: {
        cascade,
        priorities: deps.priorities ?? [],
        ...(deps.loadPerWearer === undefined ? {} : { loadPerWearer: deps.loadPerWearer }),
        upcoming: pendingQueue
          .filter((t) => t.workId !== task.workId)
          .map((t) => ({ node: t, hatId: contributor })),
      },
      voteBy: deps.supplyVoteBy ?? endorseRecommendation("workload"),
    });
    if (!supply.ok) {
      refusals.push(`RMO supply for ${contributor}: ${supply.reason}`);
      continue;
    }
    if (heldTasks >= supply.decision.target * perWearer) {
      // Not a failure — the office declining to over-staff. Leaving it unassigned is the honest
      // state; assigning anyway would make the supply decision decorative.
      refusals.push(
        `RMO holds ${contributor} at ${String(supply.decision.target)} wearer(s) ` +
          `(${String(heldTasks)}/${String(supply.decision.target * perWearer)} tasks); ${task.workId} stays unstaffed`,
      );
      continue;
    }
    events.push(
      `${deps.resourceAuthorityHatId}: supply ${contributor} ${supply.decision.action} target ${String(supply.decision.target)} (${String(supply.decision.votesCast)}/${String(supply.decision.quorum)} votes)`,
    );

    const assigned = assign(cascade, chart, task.workId, contributor);
    if (!assigned.ok) {
      refusals.push(`assign ${task.workId}: ${assigned.reason}`);
      continue;
    }
    cascade = assigned.cascade;
    staffed.push(task.workId);
    engage(contributor);
    events.push(`${contributor} assigned to ${task.workId}`);

    const resolved = resolveAnchor(board, sent.signal.anchorId);
    if (resolved.ok) board = resolved.board;
    else refusals.push(`resolve staffing anchor for ${task.workId}: ${resolved.reason}`);
  }

  // ── 5. Assignees get a work block ─────────────────────────────────────────
  // The schedule is runtime authority: after this, "is this hat busy" has an answer.
  //
  // A BLOCK IS A PRECONDITION, NOT A RECEIPT. It used to be neither: a refused block pushed a
  // refusal and the cycle went on to execute the work anyway, so the calendar recorded what the
  // organization intended while the work ignored it. A schedule nothing obeys is not authority.
  let cursor = deps.nowMs;
  const scheduled: string[] = [];
  // Which block holds which task, so the calendar can be told the block was HONOURED.
  const blockOf = new Map<string, string>();
  for (const taskId of staffed) {
    const task = nodeById(cascade, taskId);
    if (task?.assigneeHatId === undefined) continue;
    const blockId = deps.createId("blk");
    const step = scheduleBlock(calendar, {
      blockId,
      hatId: task.assigneeHatId,
      blockType: ScheduleBlockType.PrioritizedWork,
      startMs: cursor,
      endMs: cursor + deps.workBlockMs,
      state: ScheduleBlockState.Scheduled,
      workItemId: taskId,
    });
    if (!step.ok) {
      refusals.push(`schedule ${taskId}: ${step.reason}`);
      continue;
    }
    calendar = step.calendar;
    scheduled.push(taskId);
    blockOf.set(taskId, blockId);
    events.push(`${task.assigneeHatId} scheduled ${deps.workBlockMs}ms on ${taskId}`);
    // Sequential, because one contributor may hold several tasks and the calendar refuses overlap.
    // Stacking them at the same instant would make the second refusal look like a scheduling bug
    // rather than the intended serialization.
    cursor += deps.workBlockMs;
  }

  // ── 6. The accountable chain meets ────────────────────────────────────────
  const firstTask = staffed[0] === undefined ? undefined : nodeById(cascade, staffed[0]);
  if (firstTask !== undefined) {
    const attendees = accountableHatsFor(cascade, firstTask.workId);
    const slot = firstCommonFreeSlot(
      calendar,
      attendees,
      deps.nowMs,
      deps.nowMs + 16 * deps.workBlockMs,
      deps.workBlockMs,
      deps.workBlockMs,
    );
    if (slot === undefined) {
      refusals.push("no common slot for the accountable chain");
    } else {
      const met = scheduleMeeting(calendar, {
        meetingId: deps.createId("mtg"),
        attendeeHatIds: attendees,
        blockIds: attendees.map(() => deps.createId("blk")),
        startMs: slot,
        endMs: slot + deps.workBlockMs,
        workItemId: firstTask.workId,
      });
      if (!met.ok) refusals.push(`chain meeting: ${met.reason}`);
      else {
        calendar = met.calendar;
        for (const a of attendees) engage(a);
        events.push(`the accountable chain met: ${attendees.join(" → ")}`);
      }
    }
  }

  // ── 7 & 8. Work happens; blockers rise, and escalate when they must ───────
  // ONLY WHAT WAS SCHEDULED. A task the calendar refused has no time in which to be done, and doing
  // it anyway would make every downstream claim — the QA record, the gate evidence, the DORA
  // figures — describe work the organization never actually made room for.
  for (const taskId of staffed.filter((id) => !scheduled.includes(id))) {
    refusals.push(`${taskId} was staffed but never scheduled; no work was done on it`);
  }
  for (const taskId of scheduled) {
    const task = nodeById(cascade, taskId);
    if (task === undefined) continue;

    // NOTE, deliberately NOT a fix here: nothing outside tests ever sets a block to `Completed`,
    // so `markMissed` ages every past block into `Missed` and `scheduleHealth.reliability` reads
    // 100% while no block has passed and 0% the moment one has — decided by when you look.
    //
    // Marking the block completed HERE was tried and is wrong: `occupies()` counts scheduled,
    // active and paused, so a completed block stops occupying and the hat reads as not busy during
    // its own booked time — breaking the one question the calendar exists to answer. The honest
    // repair is a block lifecycle that runs as the clock advances (scheduled -> active ->
    // completed), which the single-cycle path has no clock for. Left as a named gap rather than a
    // transition that makes a metric look better and a guarantee false.

    if (deps.outcomeFor(task) === "done") {
      // The assignee claims it is finished. THE ORGANIZATION DECIDES WHETHER IT IS — seven gates,
      // each evaluated by a hat that holds the approval scope for it.
      // Rework and re-present, bounded. Each turn-back is a bounce-back; enough of them is CHURN,
      // and churn is broken structurally rather than endured — the whole point of the retry bound.
      const maxAttempts = Math.max(1, deps.maxGateAttempts ?? 3);
      const threshold = deps.churnThreshold ?? DEFAULT_CHURN_THRESHOLD;
      let merged = false;

      for (let attempt = 1; attempt <= maxAttempts && !merged; attempt += 1) {
        const humanGates = humanGatesFor(deps.checkpoints ?? []);
        const run = runGateChain(chart, {
          ...(humanGates.size === 0 ? {} : { humanRequiredAt: humanGates }),
          ...(deps.humanDecisionFor === undefined
            ? {}
            : { humanDecisionFor: (gate: GateKind) => deps.humanDecisionFor?.(taskId, gate) }),
          workId: taskId,
          chooser: deps.gateChooser ?? preferChooser<GateOutcome>(GateOutcome.Approved, "approve"),
          atMs: deps.nowMs,
          // Separation of duties: whoever did the work does not review it.
          proposerHatId: task.assigneeHatId ?? NO_PROPOSER,
        });
        gateRuns.push({ taskId, run });
        if (run.awaitingHuman !== undefined) {
          // NOT a refusal. Nobody has looked yet, and the work is fine — it is simply not the
          // organization's turn. Recorded as an event so a dashboard can show whose turn it is.
          events.push(
            `${taskId} is waiting for a person at '${String(run.awaitingHuman)}' — the organization has stopped here on purpose`,
          );
          break;
        }
        gateEvaluations.push(...run.evaluations);
        for (const evaluation of run.evaluations) engage(evaluation.byHatId);
        for (const refusal of run.refusals) refusals.push(`gates for ${taskId}: ${refusal}`);

        if (run.merged) {
          merged = true;
          break;
        }

        // Turned back. NOT done — the recovery path says where the work goes instead, and leaving
        // the task open is what keeps `isDelivered` honest about it.
        if (run.blockedAt !== undefined) {
          gateBlocked.push({
            taskId,
            gate: run.blockedAt,
            ...(run.recovery === undefined ? {} : { recovery: run.recovery }),
          });
        }
        events.push(
          `${taskId} turned back at gate ${run.blockedAt ?? "?"} → ${run.recovery ?? "blocked"} (attempt ${attempt})`,
        );

        // A gate nobody owns is not churn — it is a staffing hole, and retrying cannot fix it.
        // Escalating on it would report a broken loop where the loop never ran.
        if (run.refusals.length > 0) break;

        if (!detectChurn(taskId, gateEvaluations, threshold)) continue;

        const decider = escalationDeciderFor(chart, task.ownerHatId);
        if (decider === undefined) {
          refusals.push(`churn on ${taskId}: no hat above '${task.ownerHatId}' may decide an escalation`);
          break;
        }
        const escalation = decideEscalation(chart, {
          trigger: EscalationTrigger.RepeatedGateRejection,
          workId: taskId,
          ownerHatIds: [task.ownerHatId],
          deciderHatId: decider.id,
          chooser: deps.escalationChooser ?? firstLegalChooser(),
          ...(run.blockedAt === undefined ? {} : { reopenGate: run.blockedAt }),
        });
        if (!escalation.ok) {
          refusals.push(`escalating churn on ${taskId}: ${escalation.reason}`);
          break;
        }
        escalations.push({
          taskId,
          action: escalation.action,
          effect: escalation.effect,
          byHatId: escalation.byHatId,
        });
        engage(escalation.byHatId);
        events.push(
          `${escalation.byHatId} escalated ${taskId} on churn → ${escalation.action} (${escalation.effect})`,
        );
        // Stop retrying. The input has changed or the loop has halted; spinning again against the
        // same input is exactly what the escalation exists to prevent.
        break;
      }

      if (!merged) continue;

      events.push(`${taskId} passed the gates`);
      const step = setState(cascade, taskId, WorkState.Done);
      if (!step.ok) refusals.push(`complete ${taskId}: ${step.reason}`);
      else {
        cascade = step.cascade;
        events.push(`${task.assigneeHatId ?? "?"} completed ${taskId}`);
      }
      continue;
    }

    // Blocked. The assignee reports it upward, with evidence.
    const assignee = task.assigneeHatId;
    if (assignee === undefined) continue;
    const blocker = sendSupervisorSignal(
      chart,
      board,
      {
        signalId: deps.createId("sig"),
        anchorId: deps.createId("anchor"),
        fromHatId: assignee,
        tool: SignalTool.ReportBlocker,
        title: `blocked on '${task.title}'`,
        message: `cannot proceed on ${taskId}`,
        evidence: BLOCKER_EVIDENCE,
        atMs: deps.nowMs,
        workItemId: taskId,
      },
      deps.resourceAuthorityHatId,
    );
    if (!blocker.ok) {
      refusals.push(`blocker on ${taskId}: ${blocker.reason}`);
      continue;
    }
    board = blocker.board;
    signals.push(blocker.signal);
    engage(blocker.signal.toHatId);
    events.push(`${assignee} → ${blocker.signal.toHatId}: report_blocker on ${taskId}`);

    // The supervisor triages ON the artifact, and says it cannot resolve this alone.
    const triage = postToAnchor(board, {
      postId: deps.createId("post"),
      anchorId: blocker.signal.anchorId,
      byHatId: blocker.signal.toHatId,
      atMs: deps.nowMs,
      body: "outside this team's authority",
      evidence: BLOCKER_EVIDENCE,
    });
    if (triage.ok) board = triage.board;
    else refusals.push(`triage ${taskId}: ${triage.reason}`);

    // …so it escalates PAST itself. `request_escalation` routes above the supervisor, which is the
    // whole reason that family exists.
    const escalation = sendSupervisorSignal(
      chart,
      board,
      {
        signalId: deps.createId("sig"),
        anchorId: deps.createId("anchor"),
        fromHatId: blocker.signal.toHatId,
        tool: SignalTool.RequestEscalation,
        title: `escalating '${task.title}'`,
        message: `this level cannot resolve ${taskId}`,
        evidence: BLOCKER_EVIDENCE,
        atMs: deps.nowMs,
        workItemId: taskId,
      },
      deps.resourceAuthorityHatId,
    );
    if (!escalation.ok) {
      refusals.push(`escalation for ${taskId}: ${escalation.reason}`);
      continue;
    }
    board = escalation.board;
    signals.push(escalation.signal);
    engage(escalation.signal.toHatId);
    escalated.push(taskId);
    events.push(
      `${escalation.signal.fromHatId} → ${escalation.signal.toHatId}: request_escalation on ${taskId}`,
    );
  }

  // ── 9. Delivery rolls up ──────────────────────────────────────────────────
  const delivered = isDelivered(cascade, goalId);
  events.push(delivered ? `goal ${goalId} DELIVERED` : `goal ${goalId} not delivered`);

  return {
    goalWorkId: goalId,
    delivered,
    // Reported on EVERY cycle, delivered or not. A label that only appeared on the interesting runs
    // would train a reader to skip it — the same reason the runtime prints its fidelity block always.
    fidelity: cycleFidelity(deps),
    levelsEngaged: [...levels].sort(
      (a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b),
    ),
    cascade,
    calendar,
    board,
    signals,
    events,
    refusals,
    staffedTaskIds: staffed,
    escalatedTaskIds: escalated,
    gateRuns,
    gateBlocked,
    gateEvaluations,
    escalations,
  };
}

const LEVEL_ORDER: readonly HatLevel[] = [
  "executive_board",
  "c_suite",
  "director",
  "manager",
  "lead",
  "individual_contributor",
];

/**
 * The default staffing policy: the first IC that reports up to the task's owner.
 *
 * Exported because a caller usually wants to override it — that choice is the RMO's whole job, and
 * a real one ranks on reputation, load and freshness. This is the honest floor: it picks someone in
 * the line, or nobody.
 */
export function firstContributorUnder(chart: OrgChart, ownerHatId: string): string | undefined {
  return chart.hats.find(
    (h) =>
      h.level === "individual_contributor" &&
      // Walk up from the IC; the owner must be on that chain.
      (function reaches(id: string | undefined): boolean {
        let cursor = id;
        const seen = new Set<string>();
        while (cursor !== undefined && !seen.has(cursor)) {
          if (cursor === ownerHatId) return true;
          seen.add(cursor);
          cursor = supervisorOf(chart, cursor)?.id;
        }
        return false;
      })(h.id),
  )?.id;
}
