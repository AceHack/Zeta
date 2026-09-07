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
import { assign, type Cascade } from "./goal-cascade";
import { postToAnchor, type AnchorBoard } from "./discussion-anchor";
import { headsOf } from "./artifact-deliberation";
import { conveneOverArtifact } from "./artifact-meeting";
import { ExpectedOutput } from "./discussion-anchor";
import type { Calendar } from "./work-schedule";
import type { OrgChart } from "./org-chart";

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
  const world: World = { backlog: [], ...orgSurfaceFor(state.view, hatId) };
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
    summary:
      `${String(ticks.filter((t) => t.chosen !== undefined).length)} of ${String(hatIds.length)} hat(s) acted; ` +
      `${String(changes)} change(s)` +
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
