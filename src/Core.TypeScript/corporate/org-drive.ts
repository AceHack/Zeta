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
import type { Method } from "../observe/observe";
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
import {
  firstCommonFreeSlot,
  scheduleBlock,
  scheduleMeeting,
  ScheduleBlockState,
  ScheduleBlockType,
  type Calendar,
} from "./work-schedule";
import type { OrgChart } from "./org-chart";
import { detectLag, type LagInput } from "./lag-detection";
import { spend as chargeBudget } from "./budget";
import { GateKind, GateOutcome, runGateChain } from "./quality-gate";
import type { RaisedBlocker } from "./human-blocker";
import { costGateOutcome, type SpendVerdict } from "./spend-decision";
import { SignalTool, type SupervisorSignal } from "./supervisor-signal";
import { preferChooser, type OrgChooser } from "./org-decision";
import type { EscalationAction } from "./escalation";
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
  readonly choose?: (
    menu: readonly NextAction[],
    hatId: string,
    /**
     * How this organization wants particular verbs taken.
     *
     * Handed to the chooser rather than only rendered, because a MODEL-backed chooser builds its
     * own prompt and would otherwise never see them. Optional third parameter so every existing
     * deterministic chooser keeps compiling and keeps behaving identically.
     */
    methods?: readonly Method[],
  ) => NextAction | undefined;
  /**
   * The methods this drive offers, if any. Absent means every verb is taken the way it always was.
   *
   * Supplied by whoever holds the organization's record — this module does not read a registry.
   */
  readonly methods?: readonly Method[];
  /** Derive effects and apply NONE. The honest way to ask what would happen next. */
  readonly dryRun?: boolean;
  /**
   * Carry a raised blocker OUT to wherever a person will see it.
   *
   * An injected effect rather than a write in `apply`, for the same reason `onEvent` is: the drive
   * stays a pure function of its state and the one thing that has to leave the process leaves
   * through a declared door. Absent means the raise is recorded in the run and reaches nobody —
   * honest, and visible in the report, rather than silently discarded.
   */
  readonly onRaisedBlocker?: (blocker: RaisedBlocker) => void;
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
  /**
   * How a manager rules on churn. Absent takes the first legal action for the trigger and level.
   *
   * Named for the same reason as `gateChooser`: the deterministic ruling always CHANGES THE INPUT,
   * so a drive without this can never show the other half — a ruling that HALTS the loop, cancels
   * the work, and frees its domain for something else.
   */
  readonly escalationChooser?: OrgChooser<EscalationAction>;
  /**
   * How long a block of work is, and therefore how the calendar fills.
   *
   * ABSENT MEANS NO SCHEDULING AT ALL, which is the honest default: a register that does not know
   * how long work takes cannot book time for it, and picking an hour on its behalf would put a
   * number nobody chose into the one surface that decides whether a hat is busy.
   */
  readonly workBlockMs?: number;
  /**
   * How far ahead a block may be booked. Absent is one day from `nowMs`.
   *
   * Bounded on purpose. An unbounded search would always find a slot — by booking work into a week
   * the cadence will never reach — so a calendar that is genuinely full would look fine.
   */
  readonly scheduleHorizonMs?: number;
  /**
   * How long a chain meeting takes.
   *
   * ABSENT MEANS NO MEETING IS EVER OFFERED, matching `workBlockMs` rather than quietly defaulting.
   * A caught inconsistency: this used to fall back to half an hour, so a caller who had declared no
   * scheduling at all still had its calendar filled with meetings. Absent is a caller saying it
   * does not schedule, and honouring that in one place and not the other is worse than either
   * choice made consistently.
   */
  readonly meetingMs?: number;
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
      // THE CALENDAR TRAVELS WITH THE VIEW, one-directionally, AND ONLY WHEN MEETINGS ARE ON.
      //
      // `DriveState.calendar` is where bookings are made; the surface only needs to read it, and
      // giving the menu its own copy to write would be two calendars that disagree the first time
      // one of them was updated.
      //
      // Withheld when the caller has declared no meeting length, because that is what gates the
      // chain-meeting offer — the same shape as `gateAttempts` gating submissions. Offering a
      // meeting this drive would then refuse to book is the livelock it has produced four times.
      deps.meetingMs === undefined ? state.view : { ...state.view, calendar: state.calendar },
      hatId,
      deps.resourceAuthorityHatId,
      deps.directionReviewMs === undefined
        ? undefined
        : { nowMs: deps.nowMs, reviewIntervalMs: deps.directionReviewMs },
      // WITHOUT THIS LINE the whole seam is decorative: the surface would accept methods and never
      // be given any, so no agent would ever see one.
      deps.methods,
    ),
  };
  const menu = buildMenu(world);
  const chosen = (deps.choose ?? ((m) => m[0]))(menu, hatId, world.methods);
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
    deps.escalationChooser === undefined ? {} : { escalationChooser: deps.escalationChooser },
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

    case "reply_to_person": {
      // The reply goes on the BOARD, which is what makes it an answer rather than a claim to have
      // answered: `awaitingReplyFrom` reads the transcript back, so the message stops being
      // outstanding because a reply is visibly there, never because something marked it read.
      const posted = postToAnchor(state.view.board, {
        postId: deps.createId("post"),
        anchorId: effect.anchorId,
        byHatId: effect.byHatId,
        atMs: deps.nowMs,
        body: effect.body,
        evidence: [],
      });
      if (!posted.ok) return { state, changed: false, refusals: [posted.reason] };
      return { state: { ...state, view: { ...state.view, board: posted.board } }, changed: true, refusals: [] };
    }

    case "raise_blocker": {
      // THE ONE EFFECT THAT LEAVES. Everything else here lands on a hat's surface so some hat picks
      // it up next tick; this one lands on nobody's, because the addressee is not in the chart. All
      // the organization does is record that it has stopped and stop offering the blocker to the hat
      // that raised it — the runtime carries it to the outbox, and a person answers or does not.
      //
      // `changed: true` even though no work moved. The organization asking for help IS a change of
      // state, and reporting it as an idle tick is how a stall reads as progress.
      const already = (state.view.raisedBlockers ?? []).some((b) => b.blockerId === effect.blocker.blockerId);
      if (already) return { state, changed: false, refusals: [] };
      // ONCE, on the transition — not on every tick that finds it still open. The outbox is
      // idempotent by id anyway, so a double write is harmless; a write per tick would still be a
      // hundred file writes for one question.
      deps.onRaisedBlocker?.(effect.blocker);
      const view: OrgView = {
        ...state.view,
        raisedBlockers: [...(state.view.raisedBlockers ?? []), effect.blocker],
      };
      return { state: { ...state, view }, changed: true, refusals: [] };
    }

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
      const booked = bookWork({ ...state, cascade: assigned.cascade, view }, effect.workId, effect.toHatId, deps);
      return { state: booked.state, changed: true, refusals: booked.refusals };
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
        // THE COST GATE IS NOT AN OPINION. Whether this work implies a cost, and whether the hat
        // that holds the money has ruled on it, are facts the organization already carries — so
        // this gate reads them instead of asking an evaluator to form a view. Every other gate
        // still goes through `deps.gateChooser`, including a rejecting one, which is why this is a
        // per-gate override rather than a replacement.
        chooserFor: (gate) =>
          gate !== GateKind.CostApproval
            ? undefined
            : preferChooser<GateOutcome>(
                costGateOutcome(effect.workId, state.view.spend?.proposals ?? [], spendRulings(state.view.signals))
                  .outcome,
                "the cost ruling",
              ),
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

    case "escalation": {
      // THE RULING IS RECORDED FIRST, whatever it decided. The signal is what closes this act's own
      // opening — `escalationOpenings` reads the escalation signals back — and an escalation that
      // changed the work without leaving a record would be a manager acting invisibly.
      const withSignal: OrgView = { ...state.view, signals: [...state.view.signals, effect.signal] };

      if (effect.haltsTheLoop) {
        // PAUSE AND ACCEPT-RISK BOTH STOP THE LOOP, and this cascade has no state for "stopped but
        // not finished" — so the work is CANCELLED, which is the nearest true thing it can say.
        //
        // That is a real consequence and not a tidy-up: `deliveredSet` skips cancelled children, so
        // a domain whose only failing task is cancelled becomes deliverable, its cascade completes,
        // and its executive is asked for a new direction. An organization deciding to stop is how
        // it gets to do something else.
        const stopped = setState(state.cascade, effect.workId, WorkState.Canceled);
        if (!stopped.ok) {
          return { state: { ...state, view: withSignal }, changed: true, refusals: [stopped.reason] };
        }
        return {
          state: { ...state, cascade: stopped.cascade, view: { ...withSignal, cascade: stopped.cascade.nodes } },
          changed: true,
          refusals: [],
        };
      }

      // `changes_the_input`: the manager changed something, so the work gets its attempts back.
      //
      // ONCE. `escalationOpenings` refuses a second escalation for the same item, which is what
      // stops this becoming a pump — exhaust, escalate, reset, exhaust — doing real work forever.
      // If the changed input still cannot pass, the exhaustion blocker stands and a human reads it.
      const gates = state.view.gateAttempts;
      if (gates === undefined) return { state: { ...state, view: withSignal }, changed: true, refusals: [] };
      const counts = new Map(gates.counts);
      counts.delete(effect.workId);
      return {
        state: { ...state, view: { ...withSignal, gateAttempts: { ...gates, counts } } },
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

    case "spend_ruling": {
      // THE RULING IS RECORDED WHATEVER IT DECIDED, and that is what closes this act's own opening —
      // `spendOpenings` reads the decision signals back. A ruling that changed the budget without
      // leaving a record would be money moving with nobody's name on it.
      const withSignal: OrgView = { ...state.view, signals: [...state.view.signals, effect.signal] };
      const spend = state.view.spend;
      if (spend === undefined || spend.budget === undefined || effect.ruling.charged <= 0) {
        // Nothing to charge: the free way won, the money was not there, or the work was set aside.
        // A ruling that spends nothing is still a ruling and still a change — the organization now
        // knows something it did not, and reporting it as idle would let a drive settle mid-decision.
        return { state: { ...state, view: withSignal }, changed: true, refusals: [] };
      }
      // CHARGED THROUGH `budget.spend`, keyed on the proposal. That function is idempotent by
      // design — a replayed action must not be billed twice — so re-applying this effect commits
      // once, and the second attempt says so rather than silently doing nothing.
      const charged = chargeBudget(spend.budget, `spend:${effect.ruling.proposalId}`, effect.ruling.charged);
      return {
        state: { ...state, view: { ...withSignal, spend: { ...spend, budget: charged.budget } } },
        changed: true,
        refusals: charged.charged ? [] : [charged.reason],
      };
    }

    case "convene_chain": {
      // AT A TIME THEY ARE ALL FREE, or not at all. `firstCommonFreeSlot` is what makes this a
      // booking rather than an announcement — a meeting placed over somebody's existing work is a
      // conflict the calendar exists to refuse, and forcing it would make "is this hat busy"
      // unanswerable.
      const duration = deps.meetingMs;
      // A GUARD ON A PUBLIC FUNCTION, not a defensive shrug. `apply` is exported and a caller can
      // hand it any effect; from the drive's own menu this is unreachable, because the offer is
      // gated on the same field.
      if (duration === undefined) {
        return { state, changed: false, refusals: ["no meeting length was declared, so none can be booked"] };
      }
      const horizon = deps.scheduleHorizonMs ?? 24 * 60 * 60 * 1000;
      const start = firstCommonFreeSlot(
        state.calendar,
        effect.attendeeHatIds,
        deps.nowMs,
        deps.nowMs + horizon,
        duration,
        duration,
      );
      if (start === undefined) {
        return {
          state,
          changed: false,
          refusals: [`no slot in the next ${String(horizon)}ms when all ${String(effect.attendeeHatIds.length)} are free`],
        };
      }
      const booked = scheduleMeeting(state.calendar, {
        meetingId: deps.createId("mtg"),
        attendeeHatIds: effect.attendeeHatIds,
        blockIds: effect.attendeeHatIds.map(() => deps.createId("blk")),
        startMs: start,
        endMs: start + duration,
        workItemId: effect.workId,
      });
      if (!booked.ok) return { state, changed: false, refusals: [booked.reason] };
      return { state: { ...state, calendar: booked.calendar }, changed: true, refusals: [] };
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

/**
 * Reserve time for work that has just landed on somebody.
 *
 * ── WHY THIS IS A CONSEQUENCE AND NOT A CHOICE ───────────────────────────────
 * `org-cycle.ts` books work blocks as its own phase, and it was the last thing it did that no tick
 * could. It is not a menu item here, deliberately: an assignment that reserves no time is an
 * assignment nobody can honour, and making it a separate act the assignee might not choose would
 * put "was this scheduled" back into the class of things that can be silently skipped. The schedule
 * is runtime authority — after this, "is this hat busy" has an answer.
 *
 * A FAILURE TO BOOK DOES NOT UNDO THE ASSIGNMENT. Refusing the placement because the calendar is
 * full would stall the organization over a fact about one week; the work is assigned, the failure
 * is reported, and a full calendar shows up as a refusal rather than as an assignment that quietly
 * has no time behind it.
 */
function bookWork(state: DriveState, workId: string, hatId: string, deps: DriveDeps): ApplyResult {
  const duration = deps.workBlockMs;
  if (duration === undefined) return { state, changed: true, refusals: [] };
  const horizon = deps.scheduleHorizonMs ?? 24 * 60 * 60 * 1000;
  const start = firstCommonFreeSlot(state.calendar, [hatId], deps.nowMs, deps.nowMs + horizon, duration, duration);
  if (start === undefined) {
    return { state, changed: true, refusals: [`no free slot for '${hatId}' to work on '${workId}'`] };
  }
  const booked = scheduleBlock(state.calendar, {
    blockId: deps.createId("blk"),
    hatId,
    blockType: ScheduleBlockType.PrioritizedWork,
    startMs: start,
    endMs: start + duration,
    state: ScheduleBlockState.Scheduled,
    workItemId: workId,
  });
  if (!booked.ok) return { state, changed: true, refusals: [booked.reason] };
  return { state: { ...state, calendar: booked.calendar }, changed: true, refusals: [] };
}

/**
 * What the money hat has decided so far, keyed by proposal.
 *
 * REBUILT FROM THE SIGNALS, which are the organization's own record of its rulings. A second map
 * held beside them could disagree the first time either was written, and the gate below is about to
 * let work through on the strength of it.
 */
function spendRulings(signals: readonly SupervisorSignal[]): ReadonlyMap<string, SpendVerdict> {
  const out = new Map<string, SpendVerdict>();
  for (const signal of signals) {
    if (signal.tool !== SignalTool.RequestDecision) continue;
    if (signal.workItemId === undefined) continue;
    out.set(signal.workItemId, signal.title as SpendVerdict);
  }
  return out;
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
  // The new owner needs time on it just as much as a first assignee does. Work that moves and
  // keeps the old holder's slot is work nobody has booked.
  const booked = bookWork({ ...state, cascade: moved.cascade, view }, t.workId, t.toHatId, deps);
  return { state: booked.state, changed: true, refusals: booked.refusals };
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
  // Alternate work is still work, and it still needs an hour in somebody's day. Skipping the
  // booking here would make the one placement path that exists for a BLOCKED hat the one that
  // reserves nothing — which is the shape where a calendar quietly stops describing anything.
  const booked = bookWork({ ...state, cascade: placed.cascade, view }, a.candidate.workId, a.agentHatId, deps);
  return { state: booked.state, changed: true, refusals: booked.refusals };
}
