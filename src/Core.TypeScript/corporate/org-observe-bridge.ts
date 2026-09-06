/**
 * org-observe-bridge.ts — the organization filling the observe algebra's peer verbs.
 *
 * ── WHAT THIS CONNECTS ───────────────────────────────────────────────────────
 * `observe.ts` gained five verbs for working with other agents — review an artifact, answer one,
 * convene a room, say what is missing, hand work over. They are GENERIC: the core takes strings and
 * knows nothing about hats, gates or anchors, exactly as `MainDeps.surface` already works.
 *
 * This module is what makes them real. One direction derives the surface FROM the organization —
 * what has been asked of this hat, what rooms it is in, what it is blocked on, who it may convene,
 * what it may hand out. The other applies a chosen action BACK: a review becomes a gate's evidence,
 * an ask becomes a routed supervisor signal, an assignment becomes an assignment.
 *
 * Direction is unchanged and non-negotiable: corporate imports the core, never the reverse
 * (`register-boundary.test.ts`).
 *
 * ── EVERY OFFER IS DERIVED, NONE IS DECLARED ─────────────────────────────────
 * A hat is offered `review_artifact` because a `RequestReview` signal is addressed to it and open —
 * not because someone set a flag. It is offered `assign_work` for the items in its own scope and
 * only to its direct reports, because that is what the chart says. The menu is a projection of the
 * organization's actual state, so an agent cannot be offered an act the organization would refuse,
 * and cannot be denied one it is owed.
 *
 * ── WHAT DECIDES WHO DRIVES WHAT ─────────────────────────────────────────────
 * Nothing here names a role. A TPM ends up driving assignment because assignment is offered to hats
 * whose reports can take the work; a director ends up deciding execution because a `RequestDecision`
 * routes to the level that holds it; an engineering manager ends up unblocking people because
 * `AskQuestion` and `ReportBlocker` route to the immediate supervisor. Encoding "TPMs assign" as a
 * rule would freeze one org's shape into the machine — the chart is the shape, and it is data.
 */

import type {
  MissingInformation,
  NextAction,
  OpenDeliberation,
  ReviewAsk,
  World,
} from "../observe/observe";
import { hatsAtLevel, reportsUpTo, type OrgChart } from "./org-chart";
import { SignalTool, sendSupervisorSignal, type SupervisorSignal } from "./supervisor-signal";
import { AnchorState, type AnchorBoard } from "./discussion-anchor";
import { headsOf, type ArtifactHistory } from "./artifact-deliberation";
import { isBlockerKind, resolutionFor, type BlockerKind } from "./blocker-taxonomy";
import { evaluateSteal, type OwnedWork, type WorkTransfer } from "./work-stealing";
import type { BacklogItem } from "../observe/observe";
import type { CascadeNode } from "./goal-cascade";
import { WorkState } from "./goal-cascade";
import { isLeafType } from "./goal-cascade";

/** The organization as this bridge reads it. Everything it needs, nothing it does not. */
export interface OrgView {
  readonly chart: OrgChart;
  readonly board: AnchorBoard;
  readonly signals: readonly SupervisorSignal[];
  readonly cascade: readonly CascadeNode[];
  /** Artifact histories by id, so a review or a turn can name a real revision. */
  readonly artifacts: ReadonlyMap<string, ArtifactHistory>;
  /** What each hat has reported itself blocked on. Absent means nothing is blocking it. */
  readonly blockers?: ReadonlyMap<string, readonly MissingInformation[]>;
  /**
   * What the organization observes about work that already HAS an owner — the input a steal is
   * derived from.
   *
   * The clock and the SLA travel WITH the observations rather than beside them, because they are
   * only meaningful together: a heartbeat age needs a now, and a now with no heartbeats measures
   * nothing. Absent means no reassignment is offered at all, which is the honest default — a
   * register that does not track liveness cannot claim an owner has gone silent.
   */
  readonly assigned?: {
    readonly nowMs: number;
    readonly silenceSlaMs: number;
    readonly work: readonly OwnedWork[];
  };
}

/** Just the organizational half of a `World` — merged into whatever else the caller has. */
export type OrgSurface = Pick<
  World,
  "reviewsAsked" | "deliberations" | "missing" | "assignable" | "convenable"
>;

/**
 * What this hat is being asked for, right now.
 *
 * A review is offered when a `RequestReview` signal is addressed to this hat AND the artifact it
 * names still exists AND that artifact has exactly one head. The last condition is the interesting
 * one: reviewing a DIVERGED artifact is reviewing a question rather than an answer, since there is
 * no single "the current version" to approve. A diverged artifact needs merging first, and offering
 * a review over it would invite a verdict on text nobody agreed was the text.
 */
export function reviewsAskedOf(view: OrgView, hatId: string): readonly ReviewAsk[] {
  const out: ReviewAsk[] = [];
  for (const signal of view.signals) {
    if (signal.toHatId !== hatId || signal.tool !== SignalTool.RequestReview) continue;
    // The artifact is named by the signal's work item — the register's own linkage.
    const artifactId = signal.workItemId;
    if (artifactId === undefined) continue;
    const history = view.artifacts.get(artifactId);
    if (history === undefined) continue;
    const heads = headsOf(history);
    if (heads.length !== 1) continue;
    out.push({
      artifactId,
      revisionId: heads[0]!.revisionId,
      forGate: signal.title,
      askedByHatId: signal.fromHatId,
    });
  }
  return out;
}

/**
 * The rooms this hat is in and that are still open.
 *
 * A resolved anchor is not offered: answering a concluded deliberation would reopen it by the back
 * door, and `postToAnchor` would refuse anyway — offering an act that is guaranteed to be refused
 * is a menu lying to the agent about what it can do.
 */
export function deliberationsOf(view: OrgView, hatId: string): readonly OpenDeliberation[] {
  const out: OpenDeliberation[] = [];
  for (const anchor of view.board.anchors) {
    if (anchor.state !== AnchorState.Open) continue;
    if (!anchor.participantHatIds.includes(hatId)) continue;
    const artifactId = anchor.workItemId;
    if (artifactId === undefined) continue;
    const history = view.artifacts.get(artifactId);
    if (history === undefined) continue;
    const heads = headsOf(history);
    // The revision a turn would cite. With two heads there is no single "what we are looking at",
    // so the room needs a merge before another opinion helps.
    if (heads.length !== 1) continue;
    // ── YOU SPEAK ONCE PER VERSION ────────────────────────────────────────
    // A hat that has already addressed THIS revision is not offered another turn on it. Without
    // this the menu offers a turn every tick forever and the drive never settles — measured: a
    // ten-round drive that never reached quiescence because two hats posted a fresh turn each
    // round about a document nobody had changed.
    //
    // That is also the difference between deliberation and chatter. A turn is worth taking when
    // there is something new to address; when the artifact moves, the head changes and everyone
    // may speak again, which is exactly when their opinion is worth having.
    const already = view.board.posts.some(
      (p) =>
        p.anchorId === anchor.anchorId &&
        p.byHatId === hatId &&
        p.evidence.some((e) => e.ref.endsWith(heads[0]!.revisionId)),
    );
    if (already) continue;
    out.push({
      anchorId: anchor.anchorId,
      artifactId,
      revisionId: heads[0]!.revisionId,
      title: anchor.title,
    });
  }
  return out;
}

/**
 * Work this hat may hand to someone, and to whom.
 *
 * DIRECT REPORTS ONLY. A hat assigning past its own reports is reaching into another line's queue,
 * which the chart exists to prevent — and `assign_work` is scoped `item_in_scope` in the core's own
 * table, so the item must also be one this room holds.
 *
 * Leaves only, and unassigned only: a parent is not workable (its children carry the work) and
 * re-assigning something already staffed is a reassignment, which is a different act with different
 * consequences for the person holding it.
 */
export function assignableBy(
  view: OrgView,
  hatId: string,
): readonly { readonly item: BacklogItem; readonly toHatIds: readonly string[] }[] {
  // INDIVIDUAL CONTRIBUTORS IN THIS HAT'S ORG, not its direct reports.
  //
  // Two corrections in one line, both found by the organization refusing what this offered. Work is
  // executed by an IC — `assign` says so — so offering a lead is offering an act that will be
  // refused, and the menu's own rule is that it must never do that. And DIRECT reports are too
  // narrow: an engineering manager's only direct report may be a tech lead, which would leave the
  // manager unable to place any of the work it owns. Transitive reporting is what "my org can take
  // this" actually means.
  //
  // SELF IS EXCLUDED, and that is not a detail. `supervisorChainOf` includes the hat itself, so
  // without this an IC is offered "assign this work to me" — which is not an assignment, it is
  // picking work up, and it routes around the manager whose job the placement is. Measured: an IC
  // was offered exactly one target, itself.
  const reports = hatsAtLevel(view.chart, "individual_contributor")
    .filter((h) => h.id !== hatId && reportsUpTo(view.chart, h.id, hatId))
    .map((h) => h.id);
  if (reports.length === 0) return [];
  return view.cascade
    .filter(
      (n) =>
        isLeafType(n.workType) &&
        n.state === WorkState.Open &&
        n.assigneeHatId === undefined &&
        n.ownerHatId === hatId,
    )
    .map((n) => ({
      // The cascade node AS a backlog item. `ready` is true because the filter above already
      // required it open and leaf; `ambiguous` is false because an ambiguous item is one to
      // decompose, and handing an unclear task to a report is how work comes back untouched.
      item: { id: n.workId, title: n.title, ready: true, ambiguous: false },
      toHatIds: reports,
    }));
}

/**
 * Artifacts this hat could pull people into a room over, and who.
 *
 * Offered when an artifact has DIVERGED — two heads and no agreed version is exactly the situation
 * a room is for, and it is the one case where convening is obviously better than another solo
 * revision. Everyone who has touched the artifact is a candidate attendee, because they are the
 * people whose work is in it.
 */
export function convenableBy(
  view: OrgView,
  hatId: string,
): readonly { readonly artifactId: string; readonly withHatIds: readonly string[] }[] {
  const out: { artifactId: string; withHatIds: readonly string[] }[] = [];
  for (const [artifactId, history] of view.artifacts) {
    if (headsOf(history).length < 2) continue;
    const touched = [...new Set(history.revisions.map((r) => r.byHatId))].filter((h) => h !== hatId);
    // A room needs someone else in it; `scheduleMeeting` refuses fewer than two attendees anyway.
    if (touched.length === 0) continue;
    out.push({ artifactId, withHatIds: [hatId, ...touched].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) });
  }
  return out;
}

/**
 * Work that ALREADY HAS AN OWNER and that this hat may nonetheless place elsewhere.
 *
 * Reassignment offered on the same menu key as assignment, because from the deciding hat's side it
 * is the same act: this work needs to be with someone else. What differs is that it must be EARNED
 * — `evaluateSteal` derives whether one of the doc's six conditions holds, whether this hat has
 * standing over that condition, and whether the move would drop partial work or strand a session.
 * Nothing here is offered on the strength of the hat being senior or the work looking stuck.
 *
 * A target is offered only if the steal to THAT target would be granted, so the menu never contains
 * an act the organization will refuse — the same rule `assignableBy` was corrected to obey.
 */
export function stealableBy(
  view: OrgView,
  hatId: string,
): readonly { readonly item: BacklogItem; readonly toHatIds: readonly string[] }[] {
  const observed = view.assigned;
  if (observed === undefined) return [];
  const ics = hatsAtLevel(view.chart, "individual_contributor").filter((h) => h.id !== hatId);
  const out: { item: BacklogItem; toHatIds: readonly string[] }[] = [];
  for (const work of observed.work) {
    const node = view.cascade.find((n) => n.workId === work.workId);
    // Work the cascade does not have is work this bridge cannot describe as a backlog item. Better
    // to omit it than to invent a title for something nobody can look up.
    if (node === undefined) continue;
    const toHatIds = ics
      .filter(
        (h) =>
          evaluateSteal(view.chart, {
            work,
            toHatId: h.id,
            decidedByHatId: hatId,
            nowMs: observed.nowMs,
            silenceSlaMs: observed.silenceSlaMs,
          }).ok,
      )
      .map((h) => h.id);
    if (toHatIds.length === 0) continue;
    out.push({ item: { id: node.workId, title: node.title, ready: true, ambiguous: false }, toHatIds });
  }
  return out;
}

/** The whole organizational surface for one hat. */
export function orgSurfaceFor(view: OrgView, hatId: string): OrgSurface {
  return {
    reviewsAsked: reviewsAskedOf(view, hatId),
    deliberations: deliberationsOf(view, hatId),
    missing: view.blockers?.get(hatId) ?? [],
    assignable: [...assignableBy(view, hatId), ...stealableBy(view, hatId)],
    convenable: convenableBy(view, hatId),
  };
}

// ─── Applying what the agent chose ──────────────────────────────────────────

/**
 * What an organization must do because an agent chose something.
 *
 * A DESCRIPTION, not a mutation. The runtime owns the state; this says what the choice means, so
 * the same decision can be replayed, inspected, or refused before anything moves. It is the same
 * shape as a reaction plan: derive the consequence, then let the executor apply it.
 */
export type OrgEffect =
  | { readonly kind: "signal"; readonly signal: SupervisorSignal }
  | { readonly kind: "assign"; readonly workId: string; readonly toHatId: string }
  /**
   * The same verb over work that already had an owner — a controlled steal.
   *
   * A separate effect rather than an `assign` with an extra field, because it carries obligations
   * an assignment does not: a notice owed to the previous owner, where its partial work was kept,
   * and the dependent queues that must be told. A caller that handled `assign` and forgot this
   * would fail to compile rather than silently drop them.
   */
  | { readonly kind: "reassign"; readonly transfer: WorkTransfer }
  | {
      readonly kind: "convene";
      readonly artifactId: string;
      readonly withHatIds: readonly string[];
    }
  | {
      readonly kind: "turn";
      readonly anchorId: string;
      readonly artifactId: string;
      readonly revisionId: string;
      /**
       * WHO IS SPEAKING. Carried rather than re-derived at the point of application, because the
       * applier had no way to know: it attributed every turn to the anchor's first participant, so
       * a room of three recorded one hat saying everything.
       */
      readonly byHatId: string;
    }
  | {
      readonly kind: "review";
      readonly artifactId: string;
      readonly revisionId: string;
      readonly forGate: string;
    }
  /** The action was not one of the organizational verbs — the register has nothing to do. */
  | { readonly kind: "none" };

export type EffectResult =
  | { readonly ok: true; readonly effect: OrgEffect }
  | { readonly ok: false; readonly reason: string };

/**
 * Turn a chosen action into what the organization must do.
 *
 * `request_information` becomes a ROUTED signal rather than a message to a chosen recipient: the
 * agent names the tool, the chart names the target. That is `supervisor-signal.ts`'s whole
 * discipline — *"routing is derived, never chosen"* — and it is why an agent asking for help cannot
 * accidentally ask the wrong person, or shop for a more agreeable one.
 *
 * A blocker and a question route differently, so which tool it is matters: `ReportBlocker` is a
 * statement that work has stopped and `AskQuestion` is not. The agent says which by whether it
 * named the work that is blocked.
 */
export function effectOf(
  view: OrgView,
  hatId: string,
  action: NextAction,
  ids: { readonly signalId: string; readonly anchorId: string },
  atMs: number,
  resourceAuthorityHatId: string,
): EffectResult {
  switch (action.kind) {
    case "request_information": {
      const tool = action.blocking.trim() === "" ? SignalTool.AskQuestion : SignalTool.ReportBlocker;
      // THE TITLE CARRIES THE CLASSIFICATION for a blocker, because that is the field
      // `routeSignal` reads as the scope. A classified blocker reaches the hat that owns that KIND
      // — a credential problem to security, a missing design to an architect — instead of every
      // blocker landing on one manager who can act on almost none of them.
      //
      // Unclassified keeps the agent's own words and falls through to the supervisor, which is the
      // doc's triage step rather than a failure to route.
      const classified = action.blockerKind !== undefined && isBlockerKind(action.blockerKind);
      const title = classified ? action.blockerKind! : action.about;
      const sent = sendSupervisorSignal(
        view.chart,
        view.board,
        {
          signalId: ids.signalId,
          anchorId: ids.anchorId,
          fromHatId: hatId,
          tool,
          title,
          // The resolution path travels WITH the ask, so the owner is told what resolving it looks
          // like rather than being handed a problem and left to infer the shape of the answer.
          message: classified
            ? `${action.about} — ${resolutionFor(action.blockerKind as BlockerKind)}`
            : action.reason,
          // The blocked work IS the evidence: a blocker report naming no work is an opinion, and
          // `evidenceSatisfies` refuses the signal rather than letting it travel unsupported.
          evidence: [{ kind: "trace", ref: `blocked:${action.blocking}` }],
          atMs,
          ...(action.blocking.trim() === "" ? {} : { workItemId: action.blocking }),
        },
        resourceAuthorityHatId,
      );
      if (!sent.ok) return { ok: false, reason: sent.reason };
      return { ok: true, effect: { kind: "signal", signal: sent.signal } };
    }
    case "assign_work":
      return placementEffect(view, hatId, action.item.id, action.toHatId, atMs);
    case "convene_meeting":
      return {
        ok: true,
        effect: { kind: "convene", artifactId: action.artifactId, withHatIds: action.withHatIds },
      };
    case "respond_to_artifact":
      return {
        ok: true,
        effect: {
          kind: "turn",
          anchorId: action.anchorId,
          artifactId: action.artifactId,
          revisionId: action.revisionId,
          byHatId: hatId,
        },
      };
    case "review_artifact":
      return {
        ok: true,
        effect: {
          kind: "review",
          artifactId: action.artifactId,
          revisionId: action.revisionId,
          forGate: action.forGate,
        },
      };
    default:
      // Every other verb is the agent's own business — work, decomposition, the free modes. The
      // organization has nothing to apply, and saying so explicitly beats a silent fall-through.
      return { ok: true, effect: { kind: "none" } };
  }
}

/**
 * Placing work: an assignment when nobody holds it, a controlled steal when somebody does.
 *
 * WORK WITH AN OWNER IS NOT ASSIGNED, IT IS TAKEN. The verdict is re-derived here rather than
 * trusted from the menu: the surface was built at some earlier moment, and the owner may have
 * spoken since. A steal permitted by a stale observation is why this check exists at the point of
 * application and not only at the point of offer.
 */
function placementEffect(
  view: OrgView,
  hatId: string,
  workId: string,
  toHatId: string,
  atMs: number,
): EffectResult {
  const observed = view.assigned;
  const owned = observed?.work.find((w) => w.workId === workId);
  if (observed === undefined || owned === undefined) {
    return { ok: true, effect: { kind: "assign", workId, toHatId } };
  }
  // AN OBSERVATION OLDER THAN THE SLA CANNOT ESTABLISH SILENCE.
  //
  // The elapsed-time triggers are judged at the APPLICATION's clock, which is the only "now" there
  // is when the move actually happens. But the heartbeats being judged were read when the surface
  // was built, and the owner may have spoken in the gap. Once that gap reaches the SLA the two are
  // indistinguishable: an owner that has been quiet the whole time and one that answered a moment
  // after the read produce the same record. Refusing is the only honest answer, and the caller's
  // remedy is to re-read rather than to wait.
  if (atMs - observed.nowMs >= observed.silenceSlaMs) {
    return {
      ok: false,
      reason: `stale_observations: liveness was read ${String(atMs - observed.nowMs)}ms ago, at or past the ${String(observed.silenceSlaMs)}ms SLA`,
    };
  }
  const verdict = evaluateSteal(view.chart, {
    work: owned,
    toHatId,
    decidedByHatId: hatId,
    nowMs: atMs,
    silenceSlaMs: observed.silenceSlaMs,
  });
  if (!verdict.ok) return { ok: false, reason: `${verdict.refusal}: ${verdict.reason}` };
  return { ok: true, effect: { kind: "reassign", transfer: verdict.transfer } };
}
