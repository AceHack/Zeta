/**
 * org-drive.ts — the organization running itself, one tick at a time.
 *
 * ── THE LOOP THIS CLOSES ─────────────────────────────────────────────────────
 *   the organization's state
 *     -> a hat's surface (what has been asked of it, what it may do)
 *     -> its menu, from the observe grammar
 *     -> a choice
 *     -> an EFFECT the organization applies
 *     -> the organization's state
 *
 * Every arrow existed except the last. `org-observe-bridge` derives the surface and turns a choice
 * into an `OrgEffect`, and an effect is a DESCRIPTION — deliberately, so it can be inspected or
 * refused before anything moves. Nothing applied one, so the loop reached the organization's door
 * and stopped there.
 *
 * ── WHY APPLYING IS ITS OWN MODULE ───────────────────────────────────────────
 * Deriving what a choice MEANS and performing it are different responsibilities with different
 * failure modes: a derivation can be wrong about the organization, and an application can be
 * refused by it. Keeping them apart is what lets a caller run the whole loop in dry-run — deriving
 * every effect and applying none — which is the only honest way to ask "what would the organization
 * do next?" without it having done it.
 *
 * ── AND WHY PROGRESS IS MEASURED, NOT ASSUMED ────────────────────────────────
 * A driver that keeps ticking while nothing changes is the failure `autonomy.ts` already names for
 * the delivery loop, one layer up: it burns a budget producing nothing and reports success by never
 * admitting it finished. So a drive reports what each tick DID, and a caller can see a tick that
 * chose something and changed nothing — which is a real and important outcome, not a bug to hide.
 */

import { buildMenu, type NextAction, type World } from "../observe/observe";
import { effectOf, orgSurfaceFor, type OrgEffect, type OrgView } from "./org-observe-bridge";
import type { WorkTransfer } from "./work-stealing";
import type { AlternateAssignment } from "./alternate-work";
import {
  acceptGoal,
  assign,
  decompose,
  reassign,
  restateDirection,
  setState,
  WorkState,
  type Cascade,
} from "./goal-cascade";
import { postToAnchor, type AnchorBoard } from "./discussion-anchor";
import { headsOf, openArtifact } from "./artifact-deliberation";
import { conveneOverArtifact } from "./artifact-meeting";
import { ExpectedOutput } from "./discussion-anchor";
import type { Calendar } from "./work-schedule";
import type { OrgChart } from "./org-chart";
import { detectLag, type LagInput } from "./lag-detection";
import { GateOutcome, runGateChain } from "./quality-gate";
import { preferChooser, type OrgChooser } from "./org-decision";
import { lagSignals } from "./lag-signals";

/** The mutable half of the organization — what a tick can change. */
export interface DriveState {
  readonly view: OrgView;
  readonly cascade: Cascade;
  readonly calendar: Calendar;
}

export interface TickReport {
  readonly hatId: string;
  readonly chosen: NextAction | undefined;
  readonly effect: OrgEffect;
  /** Did the organization actually change? A tick that chose and changed nothing is visible. */
  readonly changed: boolean;
  readonly refusals: readonly string[];
  readonly summary: string;
}

export interface DriveDeps {
  readonly chart: OrgChart;
  readonly nowMs: number;
  readonly createId: (prefix: string) => string;
  readonly resourceAuthorityHatId: string;
  /**
   * Which option this hat takes. Defaults to the FIRST — the deterministic driver.
   *
   * First rather than random: a drive has to be replayable, and the menu is already ordered by the
   * grammar so that the more urgent thing comes first. A caller wiring a model in supplies its own.
   */
  readonly choose?: (menu: readonly NextAction[], hatId: string) => NextAction | undefined;
  /** Derive effects and apply NONE. The honest way to ask what would happen next. */
  readonly dryRun?: boolean;
  /**
   * What to sweep for lag before the round, and who the sweep is attributed to.
   *
   * ABSENT MEANS NO SWEEP, and that is honest rather than convenient: the sweep needs observations
   * nothing else in this state carries — heartbeats, tokens, queue depths — and running it over an
   * empty input would report an organization with nothing wrong, which is precisely the lie
   * `lag-detection.ts` is built to refuse.
   */
  /**
   * How long a direction may stand before its owner is asked to restate it.
   *
   * ABSENT MEANS NO DIRECTION IS EVER REVISITED, and that is the honest default rather than a
   * conservative one: a drive with a frozen `nowMs` — which every existing caller has — would
   * otherwise find every direction stale the moment the interval elapsed in wall-clock terms it
   * never observes. A cadence supplies both this and a moving clock, together.
   */
  readonly directionReviewMs?: number;
  /**
   * How each gate decides. Absent approves, which is the deterministic driver.
   *
   * Named rather than hardcoded because a drive whose gates always pass cannot show a turn-back,
   * and a turn-back is the interesting half: it is what bounds the submission loop and what the
   * churn escalation exists for.
   */
  readonly gateChooser?: OrgChooser<GateOutcome>;
  readonly lagSweep?: {
    readonly observerHatId: string;
    readonly anchorId: string;
    readonly input: LagInput;
  };
}

/**
 * One hat, one tick.
 *
 * The menu comes from the observe grammar over a world whose organizational half this register
 * filled. The hat's own backlog is empty here on purpose: this drive is about the ORGANIZATIONAL
 * verbs, and offering `do_item` would have the hat pick up work through a path that bypasses
 * assignment — the delivery pipeline is what does work, and it is driven by `deliverWorkItem`.
 */
export function tick(state: DriveState, hatId: string, deps: DriveDeps): TickReport {
  const world: World = {
    backlog: [],
    ...orgSurfaceFor(
      state.view,
      hatId,
      deps.resourceAuthorityHatId,
      deps.directionReviewMs === undefined
        ? undefined
        : { nowMs: deps.nowMs, reviewIntervalMs: deps.directionReviewMs },
    ),
  };
  const menu = buildMenu(world);
  const chosen = (deps.choose ?? ((m) => m[0]))(menu, hatId);
  if (chosen === undefined) {
    return {
      hatId,
      chosen: undefined,
      effect: { kind: "none" },
      changed: false,
      refusals: [],
      summary: `${hatId}: nothing on the menu`,
    };
  }
  const derived = effectOf(
    state.view,
    hatId,
    chosen,
    { signalId: deps.createId("sig"), anchorId: deps.createId("anchor") },
    deps.nowMs,
    deps.resourceAuthorityHatId,
  );
  if (!derived.ok) {
    // A DERIVATION THAT REFUSED IS NOT A TICK THAT DID NOTHING. The hat chose something the
    // organization would not accept — most often a signal with no legal target — and that is
    // reported rather than smoothed into an idle tick.
    return {
      hatId,
      chosen,
      effect: { kind: "none" },
      changed: false,
      refusals: [derived.reason],
      summary: `${hatId} chose ${chosen.kind} and the organization refused it: ${derived.reason}`,
    };
  }
  return {
    hatId,
    chosen,
    effect: derived.effect,
    changed: false,
    refusals: [],
    summary: `${hatId} -> ${chosen.kind}`,
  };
}

export interface ApplyResult {
  readonly state: DriveState;
  readonly changed: boolean;
  readonly refusals: readonly string[];
}

/**
 * Perform what a tick decided.
 *
 * Every branch REPORTS whether it changed anything, because "the organization accepted this" and
 * "the organization was already in that state" are different facts and a driver that cannot tell
 * them apart cannot detect that it has stalled.
 */
export function apply(state: DriveState, effect: OrgEffect, deps: DriveDeps): ApplyResult {
  switch (effect.kind) {
    case "none":
      return { state, changed: false, refusals: [] };

    case "signal": {
      // The signal joins the organization's own list, so the NEXT tick of the hat it was routed to
      // sees it on its surface. That is the whole mechanism by which asking upward turns into
      // somebody else's menu item.
      const view: OrgView = { ...state.view, signals: [...state.view.signals, effect.signal] };
      return { state: { ...state, view }, changed: true, refusals: [] };
    }

    case "assign": {
      const assigned = assign(state.cascade, deps.chart, effect.workId, effect.toHatId);
      if (!assigned.ok) return { state, changed: false, refusals: [assigned.reason] };
      const view: OrgView = { ...state.view, cascade: assigned.cascade.nodes };
      return { state: { ...state, cascade: assigned.cascade, view }, changed: true, refusals: [] };
    }

    case "reassign":
      return applyReassign(state, effect.transfer, deps);

    case "alternate":
      return applyAlternate(state, effect.assignment, deps);

    case "turn": {
      const history = state.view.artifacts.get(effect.artifactId);
      if (history === undefined) {
        return { state, changed: false, refusals: [`no artifact '${effect.artifactId}'`] };
      }
      const head = headsOf(history)[0];
      if (head === undefined) return { state, changed: false, refusals: ["the artifact has no head"] };
      const posted = postToAnchor(state.view.board, {
        postId: deps.createId("post"),
        anchorId: effect.anchorId,
        // THE HAT THAT SPOKE. This read the anchor's first participant, so every turn in a
        // three-hat room was recorded as one hat saying everything — and the "you speak once per
        // version" rule could never match the hat that actually ticked.
        byHatId: effect.byHatId,
        atMs: deps.nowMs,
        body: `addressing ${effect.revisionId}`,
        evidence: [{ kind: "document", ref: `artifact:${effect.artifactId}@${effect.revisionId}` }],
      });
      if (!posted.ok) return { state, changed: false, refusals: [posted.reason] };
      return { state: { ...state, view: { ...state.view, board: posted.board } }, changed: true, refusals: [] };
    }

    case "convene": {
      const convened = conveneOverArtifact({
        meetingId: deps.createId("mtg"),
        anchorId: deps.createId("anchor"),
        calendar: state.calendar,
        board: state.view.board,
        attendeeHatIds: effect.withHatIds,
        calledByHatId: effect.withHatIds[0]!,
        artifactId: effect.artifactId,
        title: `reconcile ${effect.artifactId}`,
        purpose: "the artifact has two heads and needs one",
        // A room called over a diverged artifact owes a DECISION: which version stands. Convening
        // to "discuss" it would let everyone leave with the divergence intact.
        expectedOutput: ExpectedOutput.Decision,
        fromMs: deps.nowMs,
        untilMs: deps.nowMs + 7 * 24 * 60 * 60 * 1000,
        blockIds: effect.withHatIds.map(() => deps.createId("blk")),
        workItemId: effect.artifactId,
      });
      if (!convened.ok) return { state, changed: false, refusals: [convened.reason] };
      return {
        state: { ...state, calendar: convened.calendar, view: { ...state.view, board: convened.board } },
        changed: true,
        refusals: [],
      };
    }

    case "direction": {
      const accepted = acceptGoal(state.cascade, deps.chart, {
        workId: effect.workId,
        title: effect.title,
        acceptingHatId: effect.byHatId,
        atMs: deps.nowMs,
        ...(effect.domain === undefined ? {} : { domain: effect.domain }),
      });
      if (!accepted.ok) return { state, changed: false, refusals: [accepted.reason] };
      const view: OrgView = { ...state.view, cascade: accepted.cascade.nodes };
      return { state: { ...state, cascade: accepted.cascade, view }, changed: true, refusals: [] };
    }

    case "redirection": {
      const restated = restateDirection(state.cascade, deps.chart, {
        workId: effect.workId,
        title: effect.title,
        byHatId: effect.byHatId,
        atMs: deps.nowMs,
      });
      if (!restated.ok) return { state, changed: false, refusals: [restated.reason] };
      const view: OrgView = { ...state.view, cascade: restated.cascade.nodes };
      return { state: { ...state, cascade: restated.cascade, view }, changed: true, refusals: [] };
    }

    case "document": {
      // THE FIRST REVISION IS THE DOCUMENT. `artifact-deliberation` already owns what a revision
      // is and who may add one; creating a bare entry here would be a second way for an artifact to
      // come into existence, and the two would disagree about authorship the moment one changed.
      const created = openArtifact({
        artifactId: effect.artifactId,
        byHatId: effect.byHatId,
        atMs: deps.nowMs,
        content: `draft for ${effect.workId}`,
        note: `first draft, written for ${effect.workId}`,
      });
      if (!created.ok) return { state, changed: false, refusals: [created.reason] };
      const artifacts = new Map(state.view.artifacts);
      artifacts.set(effect.artifactId, created.history);
      return { state: { ...state, view: { ...state.view, artifacts } }, changed: true, refusals: [] };
    }

    case "breakdown": {
      // The DOMAIN IS NOT PASSED, and that is the point of inheritance: `decompose` reads it off
      // the parent. Passing it here would be a second copy of a fact the cascade already holds,
      // and the two would disagree the first time somebody re-domained a branch.
      const split = decompose(state.cascade, deps.chart, effect.parentWorkId, [
        { workId: effect.childWorkId, title: effect.title },
      ]);
      if (!split.ok) return { state, changed: false, refusals: [split.reason] };
      const view: OrgView = { ...state.view, cascade: split.cascade.nodes };
      return { state: { ...state, cascade: split.cascade, view }, changed: true, refusals: [] };
    }

    case "submission": {
      // THE ORGANIZATION DECIDES WHETHER IT IS DONE, not the hat that says so. Seven gates, each
      // evaluated by a hat holding that gate's approval scope, and never by the proposer. This is
      // the same call `org-cycle.ts` makes — deliberately the same call and not a second
      // implementation of it, because a submission path that judged work differently from the
      // scripted one would be a second, weaker route to a passed gate.
      const run = runGateChain(deps.chart, {
        workId: effect.workId,
        chooser: deps.gateChooser ?? preferChooser<GateOutcome>(GateOutcome.Approved, "approve"),
        atMs: deps.nowMs,
        proposerHatId: effect.proposerHatId,
      });

      // THE ATTEMPT IS RECORDED WHETHER OR NOT IT PASSED. Counting only failures would leave a
      // rejected-then-passed item looking untried, and counting only successes would never bound
      // anything — the count is what closes this act's own opening.
      const attempts = state.view.gateAttempts ?? { counts: new Map<string, number>(), maxAttempts: 3 };
      const counts = new Map(attempts.counts);
      counts.set(effect.workId, (counts.get(effect.workId) ?? 0) + 1);
      const withAttempt: OrgView = { ...state.view, gateAttempts: { ...attempts, counts } };

      if (!run.merged) {
        // TURNED BACK IS A CHANGE. The work stayed open, but the organization now knows something
        // it did not — which gate stopped it, and that an attempt was spent. Reporting this as
        // "nothing happened" would make a drive settle while a hat was still being turned back.
        return {
          state: { ...state, view: withAttempt },
          changed: true,
          refusals: run.refusals.map((r) => `gates for ${effect.workId}: ${r}`),
        };
      }

      const done = setState(state.cascade, effect.workId, WorkState.Done);
      if (!done.ok) {
        return { state: { ...state, view: withAttempt }, changed: true, refusals: [done.reason] };
      }
      return {
        state: { ...state, cascade: done.cascade, view: { ...withAttempt, cascade: done.cascade.nodes } },
        changed: true,
        refusals: [],
      };
    }

    case "priced": {
      const priorities = new Map(state.view.priorities ?? []);
      if (priorities.get(effect.workId) === effect.priority) {
        return { state, changed: false, refusals: [] };
      }
      priorities.set(effect.workId, effect.priority);
      return { state: { ...state, view: { ...state.view, priorities } }, changed: true, refusals: [] };
    }

    case "review":
      // A REVIEW IS NOT APPLIED HERE. Its verdict belongs to the pipeline's gate, which is where
      // separation of duties, evidence and the legal-outcome clamp all live. Recording an approval
      // from this side would create a second path to a passed gate that bypasses every one of them
      // — the exact shape of defect this register keeps finding. The tick reports the review was
      // chosen; `deliverWorkItem` is what judges.
      return { state, changed: false, refusals: [] };
  }
}

export interface DriveResult {
  readonly state: DriveState;
  readonly ticks: readonly TickReport[];
  /** Ticks that changed the organization. Zero over a whole round means it has settled or stalled. */
  readonly changes: number;
  /** Why the lag sweep produced nothing, when it was asked to and could not. Empty is the norm. */
  readonly sweepRefusals: readonly string[];
  readonly summary: string;
}

/**
 * Give every hat a turn, in chart order, and apply what they decide.
 *
 * ORDER IS THE CHART'S, not arrival order, so a drive is replayable. Applying each effect before
 * the next hat ticks is deliberate and is what makes the chain work: an engineering manager's tick
 * can see the blocker its report raised a moment earlier, rather than a snapshot from before the
 * round began.
 */
export function driveRound(state: DriveState, hatIds: readonly string[], deps: DriveDeps): DriveResult {
  let current = state;
  const ticks: TickReport[] = [];
  let changes = 0;
  const sweepRefusals: string[] = [];

  // THE SWEEP RUNS FIRST, so a finding reaches its owner's surface in the SAME round it was found.
  // After the ticks it would be a report about a round nobody could act in, which is the hidden log
  // line under another name.
  const sweep = deps.lagSweep;
  if (sweep !== undefined) {
    const report = detectLag(deps.chart, sweep.input);
    const produced = lagSignals(deps.chart, report, {
      observerHatId: sweep.observerHatId,
      atMs: deps.nowMs,
      createId: deps.createId,
      anchorId: sweep.anchorId,
    });
    if (produced.ok) {
      current = { ...current, view: { ...current.view, signals: [...current.view.signals, ...produced.signals] } };
    } else {
      // REPORTED, not swallowed. A sweep that could not address its findings has found nothing as
      // far as anyone downstream can tell, and that is the one outcome this module may not hide.
      sweepRefusals.push(`lag sweep: ${produced.reason}`);
    }
  }

  for (const hatId of hatIds) {
    const report = tick(current, hatId, deps);
    if (report.chosen === undefined || deps.dryRun === true) {
      ticks.push(report);
      continue;
    }
    const applied = apply(current, report.effect, deps);
    current = applied.state;
    if (applied.changed) changes += 1;
    ticks.push({
      ...report,
      changed: applied.changed,
      refusals: [...report.refusals, ...applied.refusals],
    });
  }

  return {
    state: current,
    ticks,
    changes,
    sweepRefusals,
    summary:
      `${String(ticks.filter((t) => t.chosen !== undefined).length)} of ${String(hatIds.length)} hat(s) acted; ` +
      `${String(changes)} change(s)` +
      (sweepRefusals.length === 0 ? "" : `; ${String(sweepRefusals.length)} sweep refusal(s)`) +
      (deps.dryRun === true ? " (DRY RUN — nothing was applied)" : ""),
  };
}

/**
 * The drive state of an organization that has just RUN.
 *
 * The join between the two halves of this register: `runOrgRuntime` produces a report, and the
 * driver needs a view. Written here rather than in the bridge because it is about a RUN — the
 * bridge deals in organizational state generally, and a report is one particular way of having
 * some.
 *
 * ARTIFACTS COME FROM THE RUN. A report now carries what each item's phases produced, so the
 * default is the run's own — and a caller may still pass its own map to drive against artifacts
 * from somewhere else. An item whose phases produced nothing is absent rather than present and
 * empty, so no hat is offered a turn about a document that does not exist.
 */
export function driveStateFrom(
  report: {
    readonly cascade: Cascade;
    readonly calendar: Calendar;
    readonly board: AnchorBoard;
    readonly signals: readonly import("./supervisor-signal").SupervisorSignal[];
    readonly artifacts?: ReadonlyMap<string, import("./artifact-deliberation").ArtifactHistory>;
  },
  chart: OrgChart,
  artifacts?: ReadonlyMap<string, import("./artifact-deliberation").ArtifactHistory>,
  blockers?: ReadonlyMap<string, readonly import("../observe/observe").MissingInformation[]>,
): DriveState {
  return {
    view: {
      chart,
      board: report.board,
      signals: report.signals,
      cascade: report.cascade.nodes,
      // The caller's map wins when given; otherwise the run's own. Neither is fabricated.
      artifacts: artifacts ?? report.artifacts ?? new Map(),
      ...(blockers === undefined ? {} : { blockers }),
    },
    cascade: report.cascade,
    calendar: report.calendar,
  };
}

/**
 * Drive until the organization settles, or until a bound.
 *
 * Settling means a whole round in which NOTHING changed. That is the same stall condition
 * `autonomy.ts` applies to the delivery loop, for the same reason: a driver that keeps ticking
 * while nothing moves burns a budget producing nothing and reports success by never admitting it
 * finished.
 *
 * `maxRounds` is REQUIRED, with no default — the one number between a self-driving organization
 * and an unbounded one, and a defaulted bound is a bound nobody chose.
 */
export function driveUntilSettled(
  state: DriveState,
  hatIds: readonly string[],
  deps: DriveDeps,
  maxRounds: number,
): { readonly state: DriveState; readonly rounds: readonly DriveResult[]; readonly settled: boolean } {
  if (maxRounds < 1) throw new Error("maxRounds must be at least 1; a loop that cannot run once is not a loop");
  let current = state;
  const rounds: DriveResult[] = [];
  for (let i = 0; i < maxRounds; i += 1) {
    const r = driveRound(current, hatIds, deps);
    rounds.push(r);
    current = r.state;
    // SETTLED, not finished. The organization has nothing further it can do on its own; whether
    // that is because the work is done or because it is stuck is a different question, and one the
    // caller answers by looking at the cascade rather than at the round count.
    if (r.changes === 0) return { state: current, rounds, settled: true };
  }
  return { state: current, rounds, settled: false };
}

/** Land a controlled steal: move the assignee, then tell the hat it was taken from. */
function applyReassign(state: DriveState, t: WorkTransfer, deps: DriveDeps): ApplyResult {
  const moved = reassign(state.cascade, deps.chart, t.workId, t.toHatId);
  if (!moved.ok) return { state, changed: false, refusals: [moved.reason] };
  // THE NOTICE IS DELIVERED, not merely computed. `evaluateSteal` makes it a required field so
  // it cannot be dropped from the transfer; posting it here is the other half — the previous
  // owner learns from the organization that its work moved, rather than from the work being
  // gone. `postToAnchor` refuses an unknown anchor, so a transfer with nowhere to say it is a
  // refusal rather than a silent take.
  const said = postToAnchor(state.view.board, {
    postId: deps.createId("post"),
    anchorId: t.workId,
    byHatId: t.decidedByHatId,
    atMs: deps.nowMs,
    body: t.notice,
    evidence: [{ kind: "trace", ref: t.audit }],
  });
  if (!said.ok) return { state, changed: false, refusals: [said.reason] };
  const view: OrgView = { ...state.view, cascade: moved.cascade.nodes, board: said.board };
  return { state: { ...state, cascade: moved.cascade, view }, changed: true, refusals: [] };
}

/** Land alternate work: place it, then record against the BLOCKED item why the agent moved. */
function applyAlternate(state: DriveState, a: AlternateAssignment, deps: DriveDeps): ApplyResult {
  const placed = assign(state.cascade, deps.chart, a.candidate.workId, a.agentHatId);
  if (!placed.ok) return { state, changed: false, refusals: [placed.reason] };
  // RECORDED AGAINST THE BLOCKED ITEM, not the alternate. What has to survive is *why this
  // agent is doing something else* — that is the fact `onBlockerCleared` needs when it asks
  // whether to resume, and putting it on the alternate's own thread would file it where nobody
  // looks when the blocker lifts.
  const noted = postToAnchor(state.view.board, {
    postId: deps.createId("post"),
    anchorId: a.blockedWorkId,
    byHatId: a.approvedByHatId,
    atMs: deps.nowMs,
    body: a.audit,
    evidence: [{ kind: "trace", ref: `alternate:${a.candidate.workId}` }],
  });
  if (!noted.ok) return { state, changed: false, refusals: [noted.reason] };
  const view: OrgView = { ...state.view, cascade: placed.cascade.nodes, board: noted.board };
  return { state: { ...state, cascade: placed.cascade, view }, changed: true, refusals: [] };
}
