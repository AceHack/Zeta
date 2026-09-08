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
import { BlockerKind, isBlockerKind, resolutionFor } from "./blocker-taxonomy";
import {
  buildContextPack,
  ContextItemKind,
  OmissionKind,
  type ContextItem,
  type Omission,
  type PackResult,
} from "./context-pack";
import { isDiverged } from "./artifact-deliberation";
import { evaluateSteal, type OwnedWork, type WorkTransfer } from "./work-stealing";
import {
  type AlternateAssignment,
  type AlternateCandidate,
  AlternateWorkKind,
  offerAlternateWork,
} from "./alternate-work";
import { outranksPriority, type PriorityClass } from "./prioritization";
import {
  readinessOf,
  type RequirementMaturity,
  type RequirementProfile,
  type Waiver,
} from "./requirement-maturity";
import type { BacklogItem, GenerativeOpening as GrammarOpening } from "../observe/observe";
import { GenerativeKind, generativeOpeningsFor, type DirectionClock } from "./generative-work";
import {
  decideEscalation,
  EscalationTrigger,
  type EscalationAction,
  type EscalationChange,
} from "./escalation";
import { firstLegalChooser, type OrgChooser } from "./org-decision";
import {
  decideSpend,
  WorkStanding,
  type EffortClass,
  type SpendProposal,
  type SpendRuling,
} from "./spend-decision";
import type { Budget } from "./budget";
import { domainRouting, isDomain, type Domain } from "./domain-ontology";
import { isPriorityClass } from "./prioritization";
import type { CascadeNode } from "./goal-cascade";
import { accountableHatsFor, liveWorkSet, WorkState, WorkType } from "./goal-cascade";
import type { Calendar } from "./work-schedule";
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
  /**
   * Decided priority per work item.
   *
   * Absent means NO ALTERNATE WORK IS OFFERED — the same honest default as liveness. The guardrail
   * against alternate work bypassing the priority policy is a comparison, and a comparison with no
   * priorities is a check that cannot fail.
   */
  readonly priorities?: ReadonlyMap<string, PriorityClass>;
  /**
   * What intake recorded about each work item's REQUIREMENT — how well understood it is.
   *
   * Keyed by work id. An item with no entry is not gated, and neither is anything when the whole
   * map is absent: the organization cannot refuse on a measurement it never took, and recording
   * the profile is intake's job rather than this seam's. Stated because it is the permissive
   * direction — the gate is only as good as what was written down.
   */
  /**
   * How many times each work item has been through the quality gates.
   *
   * ABSENT MEANS NO WORK IS EVER SUBMITTED, and that is the honest default rather than a cautious
   * one. A turned-back submission leaves the work open, so an unbounded offer is a loop — and a
   * register that does not count attempts cannot bound them. `maxAttempts` is the churn threshold
   * `org-cycle.ts` already applied; it is here so a tick obeys the same bound the script did.
   */
  readonly gateAttempts?: { readonly counts: ReadonlyMap<string, number>; readonly maxAttempts: number };
  /**
   * What has been booked, so the surface can tell whether a meeting has already happened.
   *
   * READ-ONLY HERE, and a projection of the drive's own calendar rather than a second copy of it:
   * `DriveState.calendar` is where bookings are made and this is what the menu is shown. Absent
   * means no chain meeting is ever offered, which is the honest default — a register that cannot
   * tell whether a meeting happened would offer to hold one again every round.
   */
  readonly calendar?: Calendar;
  /**
   * Money somebody has asked to spend, the budget it would come out of, and how much effort a free
   * path may cost before paying wins.
   *
   * ABSENT MEANS NO SPEND DECISION IS OFFERED. The register does not invent costs: a proposal is
   * raised by a hat or an operator, exactly as a blocker is, and an organization nobody has asked
   * to buy anything has nothing here. `budget` absent WITHIN this is a different fact again — a
   * proposal exists and nobody declared what it comes out of — and `decideSpend` refuses to rule
   * rather than treating an undeclared budget as permission.
   */
  readonly spend?: {
    readonly proposals: readonly SpendProposal[];
    readonly budget?: Budget;
    readonly effortTolerance: EffortClass;
  };
  readonly requirements?: ReadonlyMap<
    string,
    {
      readonly profile: RequirementProfile;
      readonly maturity: RequirementMaturity;
      readonly waivers?: readonly Waiver[];
    }
  >;
}

/** Just the organizational half of a `World` — merged into whatever else the caller has. */
export type OrgSurface = Pick<
  World,
  "reviewsAsked" | "deliberations" | "missing" | "assignable" | "convenable" | "generative"
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
    // A BLOCKED HAT IS NOT AN ASSIGNMENT TARGET. Giving work to one is ALTERNATE work — it goes
    // through a different door (`alternateWorkFor`), which offers it only when the guardrails can
    // actually be satisfied.
    //
    // Measured: without this, a tech lead was offered `assign_work` to a blocked implementer every
    // round, `placementEffect` correctly routed it through those guardrails, and they refused for
    // want of decided priorities — the same act offered and refused 200 times in 200 rounds, which
    // is a livelock rather than an organization. The menu's own rule is never to offer an act the
    // organization will refuse, and this is the second place it had to be enforced.
    .filter((h) => blockedOn(view, h.id) === undefined)
    .map((h) => h.id);
  if (reports.length === 0) return [];
  return view.cascade
    .filter(
      (n) =>
        isLeafType(n.workType) &&
        n.state === WorkState.Open &&
        n.assigneeHatId === undefined &&
        n.ownerHatId === hatId &&
        // An ambiguous or customer-facing item whose requirement is not understood yet is not
        // ready to be given to anybody. Offering it would put the menu's own rule — never offer an
        // act the organization will refuse — against the gate one line downstream.
        requirementGate(view, n.workId).ok,
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

/**
 * Work this hat may hand to a BLOCKED report so it is not idle — the doc's alternate work.
 *
 * The scope is DERIVED, not configured: an agent blocked on a task may work on other tasks under
 * the SAME PARENT, which is the doc's "adjacent backlog items in the same initiative" and is the
 * only widening the organization already approved by putting the work there. Anything further out
 * is scope creep with a good excuse, and this is the moment it is easiest to wave through.
 *
 * Only the HIGHEST-priority candidate is offered, because offering the rest is offering the agent
 * a choice the priority policy already made.
 */
export function alternateWorkFor(
  view: OrgView,
  hatId: string,
): readonly { readonly item: BacklogItem; readonly toHatIds: readonly string[] }[] {
  const priorities = view.priorities;
  if (priorities === undefined || view.blockers === undefined) return [];
  const out: { item: BacklogItem; toHatIds: readonly string[] }[] = [];
  for (const [blockedHatId, missing] of view.blockers) {
    // A fast path over the whole blocker map. HONEST LIMIT: `offerAlternateWork` refuses on the
    // same relation, so deleting this changes only how much work is done before the same empty
    // answer — an equivalent mutant rather than an untested check, and it stops being equivalent
    // the moment the two conditions differ.
    if (!reportsUpTo(view.chart, blockedHatId, hatId) || blockedHatId === hatId) continue;
    for (const m of missing) {
      const offer = offerFor(view, hatId, blockedHatId, m.blocking, priorities);
      if (offer !== undefined) out.push(offer);
    }
  }
  return out;
}

/** The one thing this manager may hand this blocked hat, or nothing. */
function offerFor(
  view: OrgView,
  hatId: string,
  blockedHatId: string,
  blockedWorkId: string,
  priorities: ReadonlyMap<string, PriorityClass>,
): { readonly item: BacklogItem; readonly toHatIds: readonly string[] } | undefined {
  const blocked = view.cascade.find((n) => n.workId === blockedWorkId);
  if (blocked?.parentWorkId === undefined) return undefined;
  const blockedPriority = priorities.get(blocked.workId);
  if (blockedPriority === undefined) return undefined;
  const scopes = [blocked.parentWorkId];
  const candidates = openCandidates(view, blocked.workId, priorities);
  const best = bestCandidateIndex(candidates, scopes);
  if (best === undefined) return undefined;
  const verdict = offerAlternateWork(view.chart, {
    agentHatId: blockedHatId,
    blockedWorkId: blocked.workId,
    blockedPriority,
    candidates,
    chosenIndex: best,
    approvedScopes: scopes,
    approvedByHatId: hatId,
    atMs: 0,
  });
  if (!verdict.ok) return undefined;
  const node = view.cascade.find((n) => n.workId === verdict.assignment.candidate.workId);
  if (node === undefined) return undefined;
  return {
    item: { id: node.workId, title: node.title, ready: true, ambiguous: false },
    toHatIds: [blockedHatId],
  };
}

/**
 * EVERY open, unassigned leaf task with a decided priority — deliberately NOT filtered by scope.
 *
 * The first version built this list from the blocked item's own parent and then handed the same
 * parent to `offerAlternateWork` as the approved scope. That made the scope guardrail VACUOUS: a
 * candidate list constructed inside the scope can never contain anything outside it, so the check
 * could not fail, and a mutation matrix found it exactly there. A guardrail that cannot refuse is
 * the same defect as a gate that cannot fail, and it is worse here because it reads as protection.
 *
 * Each candidate carries its OWN scope. The module compares them against what was approved, which
 * is the comparison it exists to make.
 */
function openCandidates(
  view: OrgView,
  exceptWorkId: string,
  priorities: ReadonlyMap<string, PriorityClass>,
): readonly AlternateCandidate[] {
  const out: AlternateCandidate[] = [];
  for (const n of view.cascade) {
    if (n.workId === exceptWorkId || n.parentWorkId === undefined) continue;
    if (!isLeafType(n.workType) || n.state !== WorkState.Open || n.assigneeHatId !== undefined) continue;
    // Alternate work is still work. An item nobody understands yet is not a safe way to fill a
    // blocked agent's time — it is a second stall with a head start.
    if (!requirementGate(view, n.workId).ok) continue;
    const priority = priorities.get(n.workId);
    if (priority === undefined) continue;
    out.push({
      kind: AlternateWorkKind.AdjacentBacklogItem,
      workId: n.workId,
      priority,
      scope: n.parentWorkId,
    });
  }
  return out;
}

/**
 * The highest-priority IN-SCOPE candidate, ties broken ORDINALLY so two machines offer the same one.
 *
 * Scope is applied HERE rather than left to the refusal, because picking the best overall and then
 * being refused for scope would offer the blocked agent nothing at all whenever something more
 * urgent existed elsewhere — the guardrail turning into a stall.
 */
function bestCandidateIndex(
  candidates: readonly AlternateCandidate[],
  approvedScopes: readonly string[],
): number | undefined {
  let best: number | undefined;
  let incumbent: AlternateCandidate | undefined;
  candidates.forEach((c, i) => {
    if (!approvedScopes.includes(c.scope)) return;
    if (incumbent !== undefined && !beats(c, incumbent)) return;
    best = i;
    incumbent = c;
  });
  return best;
}

/** Higher priority wins; equal priority breaks ORDINALLY on the work id. */
function beats(challenger: AlternateCandidate, incumbent: AlternateCandidate): boolean {
  if (outranksPriority(challenger.priority, incumbent.priority)) return true;
  return challenger.priority === incumbent.priority && challenger.workId < incumbent.workId;
}

/**
 * Generative acts open to this hat, in the grammar's own shape.
 *
 * The register's `GenerativeOpening` and the grammar's are DIFFERENT TYPES on purpose. The core
 * does not know what a `Domain` or a `PriorityClass` is and must not learn — it takes strings and a
 * register decides what they name, exactly as `MainDeps.surface` already works. This function is
 * the one place the two vocabularies meet.
 *
 * `resourceAuthorityHatId` is absent here because `OrgView` does not carry it: supply openings are
 * the RMO's and reach the surface through `generativeInputFor` below, which the drive supplies.
 */
export function generativeFor(
  view: OrgView,
  hatId: string,
  resourceAuthorityHatId: string,
  directionClock?: DirectionClock,
): readonly GrammarOpening[] {
  const openings = generativeOpeningsFor(
    {
      chart: view.chart,
      cascade: view.cascade,
      artifactIds: new Set(view.artifacts.keys()),
      pricedWorkIds: new Set(view.priorities?.keys() ?? []),
      resourceAuthorityHatId,
      // GOALS ARE EXCLUDED, and this is a correction rather than a convenience. A direction is held
      // by an executive BY RULE — `acceptGoal` refuses one accepted below c_suite — and an
      // executive is in the governance department, not in the department that owns the domain. So
      // every one of the sixteen directions read as an out-of-domain fallback and the RMO was told
      // about all sixteen: seventeen supply reports of which sixteen were the design working.
      //
      // A signal that fires on the ordinary case stops being read, which would have cost the ONE
      // real fallback in that list. The question "did this reach the owning department" is a
      // question about work that is DELEGATED, and a direction is what delegation starts from.
      routings: domainRouting(
        view.cascade.filter((n) => n.workType !== WorkType.Goal),
        (id) => view.chart.byId.get(id)?.departmentId,
      ),
      // Read back off the organization's own record, never held beside it. A second list of what
      // has been raised is a list that can disagree with the signals themselves.
      ...(directionClock === undefined ? {} : { directionClock }),
      ...(view.gateAttempts === undefined
        ? {}
        : { gates: { attempts: view.gateAttempts.counts, maxAttempts: view.gateAttempts.maxAttempts } }),
      // READ BACK OFF THE ORGANISATION'S OWN RECORD, never held beside it. An escalation is a
      // routed signal, so the signals ARE the list of what has been ruled on — and a second list
      // could disagree with them.
      // THE CALENDAR IS THE RECORD OF WHAT MET. Reading it back beats a second list, which could
      // disagree with the bookings themselves — and a meeting that exists is a meeting that
      // happened.
      // ABSENT WHEN THERE IS NO CALENDAR, not an empty set. `?? []` made this always DEFINED, so
      // `meetingOpenings` ran for callers who had declared no scheduling at all and the drive
      // offered meetings it would then refuse to book — the livelock, arriving through a nullish
      // coalescing operator. An empty set means "nothing has met yet"; absent means "this
      // organization does not keep a calendar", and they are different facts.
      ...(view.calendar === undefined
        ? {}
        : {
            met: new Set(
              view.calendar.blocks
                .filter((b) => b.meetingId !== undefined && b.workItemId !== undefined)
                .map((b) => b.workItemId)
                .filter((id): id is string => id !== undefined),
            ),
          }),
      // RULED-ON PROPOSALS COME BACK OFF THE SIGNALS, like every other "has this been raised" here.
      // A ruling travels as a `request_decision`, so the signals ARE the record of what has been
      // decided and a second list could disagree with them.
      ...(view.spend === undefined
        ? {}
        : {
            spend: {
              proposals: view.spend.proposals,
              ruled: new Set(
                view.signals
                  .filter((sig) => sig.tool === SignalTool.RequestDecision)
                  .map((sig) => sig.workItemId)
                  .filter((id): id is string => id !== undefined),
              ),
            },
          }),
      escalated: new Set(
        view.signals
          .filter((sig) => sig.tool === SignalTool.RequestEscalation)
          .map((sig) => sig.workItemId)
          .filter((id): id is string => id !== undefined),
      ),
      raisedSupplySubjects: new Set(
        view.signals.filter((sig) => sig.tool === SignalTool.SuggestImprovement).map((sig) => sig.title),
      ),
    },
    hatId,
  );
  const out: GrammarOpening[] = [];
  for (const o of openings) {
    switch (o.kind) {
      case GenerativeKind.SetDirection:
        out.push({
          kind: "set_direction",
          subjectId: o.subjectId,
          prompt: o.prompt,
          ...(o.domain === undefined ? {} : { domain: o.domain }),
          ...(o.restates === undefined ? {} : { restates: o.restates }),
        });
        break;
      case GenerativeKind.DraftBusinessDoc:
        // `doc-<workId>` is the register's own convention, and the work id is recovered from it
        // rather than carried twice. Two fields that must agree are two fields that can disagree.
        out.push({
          kind: "draft_business_doc",
          subjectId: o.subjectId,
          prompt: o.prompt,
          forWorkId: o.subjectId.startsWith("doc-") ? o.subjectId.slice("doc-".length) : o.subjectId,
        });
        break;
      case GenerativeKind.DecidePriority:
        out.push({ kind: "decide_priority", subjectId: o.subjectId, prompt: o.prompt, options: o.options ?? [] });
        break;
      case GenerativeKind.SizeHatSupply:
        out.push({ kind: "size_hat_supply", subjectId: o.subjectId, prompt: o.prompt });
        break;
      case GenerativeKind.SubmitWork:
        out.push({ kind: "submit_work", subjectId: o.subjectId, prompt: o.prompt });
        break;
      case GenerativeKind.EscalateChurn:
        out.push({ kind: "escalate_churn", subjectId: o.subjectId, prompt: o.prompt });
        break;
      case GenerativeKind.ConveneChain:
        out.push({ kind: "convene_chain", subjectId: o.subjectId, prompt: o.prompt });
        break;
      case GenerativeKind.DecideSpend:
        out.push({ kind: "decide_spend", subjectId: o.subjectId, prompt: o.prompt });
        break;
      case GenerativeKind.BreakDownWork:
        // DERIVED FROM THE PARENT, so the same undecomposed rung yields the same child id every
        // round. A minted id would make the opening look new each time, and `decompose` would
        // accept a second child for a rung that already had one — which is not a livelock, it is
        // worse: an organization that grows a new sub-project every round forever.
        out.push({
          kind: "break_down_work",
          subjectId: o.subjectId,
          prompt: o.prompt,
          childId: `${o.subjectId}-1`,
        });
        break;
    }
  }
  return out;
}

/**
 * The whole organizational surface for one hat.
 *
 * `resourceAuthorityHatId` defaults to the hat itself, which offers NO supply openings unless the
 * caller says who the resource authority is — the honest default. A register that guessed the RMO
 * would put chart-changing acts on somebody's menu on the strength of a guess.
 */
export function orgSurfaceFor(
  view: OrgView,
  hatId: string,
  resourceAuthorityHatId?: string,
  directionClock?: DirectionClock,
): OrgSurface {
  return {
    reviewsAsked: reviewsAskedOf(view, hatId),
    deliberations: deliberationsOf(view, hatId),
    missing: unraisedBlockers(view, hatId),
    assignable: [...assignableBy(view, hatId), ...stealableBy(view, hatId), ...alternateWorkFor(view, hatId)],
    convenable: convenableBy(view, hatId),
    generative: generativeFor(view, hatId, resourceAuthorityHatId ?? hatId, directionClock),
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
  /**
   * Work given to a hat that is currently BLOCKED, so it is not idle.
   *
   * Also a distinct effect, and for the same reason: it carries the blocked item it is standing in
   * for, which is what makes the resumption question answerable later. An `assign` would land the
   * work and forget what it was instead of.
   */
  | { readonly kind: "alternate"; readonly assignment: AlternateAssignment }
  | {
      readonly kind: "convene";
      readonly artifactId: string;
      readonly withHatIds: readonly string[];
    }
  /**
   * Every level accountable for a piece of work, in one room, at a time they are all free.
   *
   * A distinct effect from `convene`, and not a variation on it. That one repairs a DIVERGED
   * ARTIFACT and its attendees are whoever touched it; this one is a planned review of WORK and its
   * attendees are derived from the cascade. Collapsing them would make the attendee rule depend on
   * which caller happened to build the effect.
   */
  | {
      readonly kind: "convene_chain";
      readonly workId: string;
      readonly title: string;
      readonly attendeeHatIds: readonly string[];
      readonly calledByHatId: string;
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
  // ── THE GENERATIVE EFFECTS ───────────────────────────────────────────────
  // Each one is what its verb MEANS, still as a description. `direction` is an accepted goal;
  // `document` is an artifact's first revision; `priced` is one entry in the priority map;
  // `size_hat_supply` has NO effect of its own and produces a `signal` instead. A tick that could
  // add a hat to the chart would let the organization grow itself with no approval anywhere, which
  // is what `rmo.ts`'s quorum lifecycle exists to prevent — and a bespoke "request" effect that
  // nothing applied would have been a promise the drive counted as an act. Routed as
  // `SuggestImprovement`, so it travels to the supervisor: a missing hat is a structural gap only
  // the level above the RMO can close.
  | {
      readonly kind: "direction";
      readonly workId: string;
      readonly title: string;
      readonly byHatId: string;
      readonly domain?: Domain;
    }
  | { readonly kind: "document"; readonly artifactId: string; readonly workId: string; readonly byHatId: string }
  | {
      readonly kind: "redirection";
      readonly workId: string;
      readonly title: string;
      readonly byHatId: string;
    }
  /**
   * Work its assignee says is finished, on its way to the gates.
   *
   * The effect carries the PROPOSER, because `runGateChain` needs it to keep any gate from being
   * evaluated by the hat that did the work — and re-deriving it at the point of application would
   * be reading the assignee back out of a cascade that the submission itself is about to change.
   */
  | { readonly kind: "submission"; readonly workId: string; readonly proposerHatId: string }
  /**
   * A manager's ruling on work that keeps failing, and what it does to the loop.
   *
   * `haltsTheLoop` is carried rather than re-derived at the point of application, because it is the
   * only part of an escalation this register can act on today and losing it would leave the ruling
   * as a note. `escalation.ts` computes it exhaustively over the action set — the compiler refuses
   * a ninth action until somebody says whether it changes the input or stops it.
   */
  | {
      readonly kind: "escalation";
      readonly workId: string;
      readonly byHatId: string;
      readonly action: EscalationAction;
      readonly change: EscalationChange;
      readonly haltsTheLoop: boolean;
      readonly signal: SupervisorSignal;
    }
  /**
   * A ruling on money, and what it commits.
   *
   * `charged` is carried rather than re-derived, because it is what `budget.spend` will be handed
   * and a second computation of it at the point of application could disagree with the ruling that
   * was recorded. The ruling is the decision; this effect is the decision plus its consequence.
   */
  | {
      readonly kind: "spend_ruling";
      readonly ruling: SpendRuling;
      readonly workId: string;
      readonly signal: SupervisorSignal;
    }
  | { readonly kind: "priced"; readonly workId: string; readonly priority: PriorityClass }
  | {
      readonly kind: "breakdown";
      readonly parentWorkId: string;
      readonly childWorkId: string;
      readonly title: string;
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
  /**
   * How a management choice is made, where the register has one to make.
   *
   * Only `escalate_churn` reads it today. Injectable for the same reason `DriveDeps.gateChooser`
   * is: a drive whose escalations always `change the input` cannot exercise the branch where one
   * HALTS it, and a branch no caller can reach is a branch no falsifier can kill — measured
   * exactly that way, as a surviving mutant that left the halting path untested.
   */
  policy?: { readonly escalationChooser?: OrgChooser<EscalationAction> },
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
    case "set_direction": {
      // REFUSED HERE, NOT ONLY AT THE MENU. `acceptGoal` will refuse a hat below c_suite, and this
      // check exists so the refusal names the same rule at the point the choice is made rather
      // than three layers down where the reason has become "unknown hat".
      const hat = view.chart.byId.get(hatId);
      if (hat === undefined) return { ok: false, reason: `unknown hat '${hatId}'` };
      if (hat.level !== "c_suite" && hat.level !== "executive_board") {
        return { ok: false, reason: `direction is set at the top: '${hatId}' is ${hat.level}` };
      }
      if (action.objective.trim() === "") return { ok: false, reason: "a direction with no objective states nothing" };
      // A RESTATEMENT IS A DIFFERENT EFFECT, and it is chosen by what the ACTION says rather than
      // by whether the id happens to be taken. Inferring it would make a caller that meant to state
      // a new direction, and picked a colliding id, silently overwrite an existing one.
      if (action.restates === true) {
        return { ok: true, effect: { kind: "redirection", workId: action.subjectId, title: action.objective, byHatId: hatId } };
      }
      const domain = action.domain !== undefined && isDomain(action.domain) ? action.domain : undefined;
      return {
        ok: true,
        effect: {
          kind: "direction",
          workId: action.subjectId,
          title: action.objective,
          byHatId: hatId,
          ...(domain === undefined ? {} : { domain }),
        },
      };
    }
    case "draft_business_doc": {
      if (view.artifacts.has(action.subjectId)) {
        return { ok: false, reason: `'${action.subjectId}' already exists; a draft does not overwrite one` };
      }
      const node = view.cascade.find((n) => n.workId === action.forWorkId);
      if (node === undefined) return { ok: false, reason: `no work item '${action.forWorkId}' to document` };
      return {
        ok: true,
        effect: { kind: "document", artifactId: action.subjectId, workId: action.forWorkId, byHatId: hatId },
      };
    }
    case "decide_priority": {
      // AN UNRECOGNISED CLASS IS REFUSED, never coerced. See `isPriorityClass` for why a silently
      // defaulted priority is worse than an absent one.
      if (!isPriorityClass(action.priority)) {
        return { ok: false, reason: `'${action.priority}' is not a priority class` };
      }
      if (view.priorities?.has(action.subjectId) === true) {
        return { ok: false, reason: `'${action.subjectId}' is already priced; changing it is a re-prioritization` };
      }
      if (view.cascade.find((n) => n.workId === action.subjectId) === undefined) {
        return { ok: false, reason: `no work item '${action.subjectId}' to price` };
      }
      return { ok: true, effect: { kind: "priced", workId: action.subjectId, priority: action.priority } };
    }
    case "break_down_work": {
      const parent = view.cascade.find((n) => n.workId === action.subjectId);
      if (parent === undefined) return { ok: false, reason: `no work item '${action.subjectId}' to break down` };
      // REFUSED AT THE POINT OF CHOICE. `decompose` refuses a duplicate id too, but this hat may
      // have been offered the opening before another hat's tick created the child, and a refusal
      // that names the real reason beats one that says "duplicate work id".
      if (view.cascade.some((n) => n.parentWorkId === action.subjectId)) {
        return { ok: false, reason: `'${action.subjectId}' is already broken down` };
      }
      if (parent.ownerHatId !== hatId) {
        return { ok: false, reason: `'${action.subjectId}' is owned by '${parent.ownerHatId}', not '${hatId}'` };
      }
      return {
        ok: true,
        effect: { kind: "breakdown", parentWorkId: action.subjectId, childWorkId: action.childId, title: action.title },
      };
    }
    case "submit_work": {
      const node = view.cascade.find((n) => n.workId === action.subjectId);
      if (node === undefined) return { ok: false, reason: `no work item '${action.subjectId}' to submit` };
      if (node.assigneeHatId === undefined) {
        return { ok: false, reason: `'${action.subjectId}' has no assignee; nobody has done it` };
      }
      // ONLY THE HAT THAT DID IT. Re-derived here rather than trusted from the menu, because the
      // surface was built at an earlier moment and the work may have been reassigned since — and a
      // submission from a hat that no longer holds the work would put the real assignee's name on
      // somebody else's claim.
      if (node.assigneeHatId !== hatId) {
        return { ok: false, reason: `'${action.subjectId}' is assigned to '${node.assigneeHatId}', not '${hatId}'` };
      }
      if (node.state === WorkState.Done || node.state === WorkState.Canceled) {
        return { ok: false, reason: `'${action.subjectId}' is already ${node.state}` };
      }
      return { ok: true, effect: { kind: "submission", workId: action.subjectId, proposerHatId: hatId } };
    }
    case "decide_spend": {
      const spend = view.spend;
      if (spend === undefined) return { ok: false, reason: "this organization records no spend proposals" };
      const proposal = spend.proposals.find((p) => p.proposalId === action.subjectId);
      if (proposal === undefined) return { ok: false, reason: `no spend proposal '${action.subjectId}'` };
      const decided = decideSpend({
        chart: view.chart,
        proposal,
        byHatId: hatId,
        budget: spend.budget,
        nowMs: atMs,
        // THE WORK'S OWN PRICE, read from what the organization decided rather than guessed here.
        // `decideSpend` refuses when it is absent, which makes `decide_priority` a precondition of
        // buying anything — the organization must say the work matters before it pays for it.
        priority: view.priorities?.get(proposal.workId),
        effortTolerance: spend.effortTolerance,
        // DERIVED FROM THE CASCADE, using the same roll-up every other liveness question here uses.
        // A second notion of "is this work still going" would disagree with `liveWorkSet` the first
        // time either changed.
        standing: !view.cascade.some((n) => n.workId === proposal.workId)
          ? WorkStanding.Unknown
          : liveWorkSet({ nodes: view.cascade }).has(proposal.workId)
            ? WorkStanding.Live
            : WorkStanding.Finished,
      });
      // REFUSED IS NOT A VERDICT. A proposal where nobody looked for a free way comes back here, and
      // the reason says so — that is the whole forcing function, and swallowing it into a
      // "not worth it" would record a judgement nobody made.
      if (!decided.ok) return { ok: false, reason: decided.reason };

      const said = sendSupervisorSignal(
        view.chart,
        view.board,
        {
          signalId: ids.signalId,
          anchorId: ids.anchorId,
          fromHatId: hatId,
          tool: SignalTool.RequestDecision,
          title: decided.ruling.verdict,
          message: decided.ruling.reason,
          evidence: [{ kind: "document", ref: `spend:${proposal.proposalId}` }],
          atMs,
          // KEYED ON THE PROPOSAL, not the work: a work item can carry several proposals over its
          // life, and keying on the work would silence every one after the first.
          workItemId: proposal.proposalId,
        },
        resourceAuthorityHatId,
      );
      if (!said.ok) return { ok: false, reason: said.reason };
      return {
        ok: true,
        effect: { kind: "spend_ruling", ruling: decided.ruling, workId: proposal.workId, signal: said.signal },
      };
    }
    case "convene_chain": {
      const node = view.cascade.find((n) => n.workId === action.subjectId);
      if (node === undefined) return { ok: false, reason: `no work item '${action.subjectId}'` };
      if (node.ownerHatId !== hatId) {
        return { ok: false, reason: `'${action.subjectId}' is owned by '${node.ownerHatId}', not '${hatId}'` };
      }
      // DERIVED FROM THE CASCADE, never from the caller. The attendees of a review of this work ARE
      // the hats accountable for it, and letting the convener name them would let a hat hold a
      // review of its own work with nobody who could question it.
      const attendees = accountableHatsFor({ nodes: view.cascade }, action.subjectId);
      if (attendees.length < 2) {
        return { ok: false, reason: `'${action.subjectId}' has no accountable chain above its owner` };
      }
      return {
        ok: true,
        effect: {
          kind: "convene_chain",
          workId: action.subjectId,
          title: node.title,
          attendeeHatIds: attendees,
          calledByHatId: hatId,
        },
      };
    }
    case "escalate_churn": {
      const node = view.cascade.find((n) => n.workId === action.subjectId);
      if (node === undefined) return { ok: false, reason: `no work item '${action.subjectId}' to escalate` };
      const decided = decideEscalation(view.chart, {
        trigger: EscalationTrigger.RepeatedGateRejection,
        workId: action.subjectId,
        ownerHatIds: [node.ownerHatId],
        deciderHatId: hatId,
        // FIRST LEGAL, deterministically, unless the caller has a policy. What must not happen is
        // this seam inventing a preference: the legal set is already narrowed by the trigger and
        // the decider's level, and a second opinion here would be an unrecorded policy.
        chooser: policy?.escalationChooser ?? firstLegalChooser(),
      });
      // REFUSED, not degraded. `decideEscalation` says no when the chosen action cannot be carried
      // out in this organization — most importantly bringing in an architect where none exists —
      // and recording a structural fix nobody can perform is worse than the churn it claims to end.
      if (!decided.ok) return { ok: false, reason: decided.reason };

      // THE RULING TRAVELS AS AN ESCALATION SIGNAL, which routes deliberately PAST the immediate
      // supervisor: `request_escalation` exists because that level could not resolve it alone, so
      // handing it back to them would be a no-op that reports success.
      const raised = sendSupervisorSignal(
        view.chart,
        view.board,
        {
          signalId: ids.signalId,
          anchorId: ids.anchorId,
          fromHatId: hatId,
          tool: SignalTool.RequestEscalation,
          title: decided.action,
          message: decided.reason,
          evidence: [{ kind: "trace", ref: `gates-exhausted:${action.subjectId}` }],
          atMs,
          workItemId: action.subjectId,
        },
        resourceAuthorityHatId,
      );
      if (!raised.ok) return { ok: false, reason: raised.reason };
      return {
        ok: true,
        effect: {
          kind: "escalation",
          workId: action.subjectId,
          byHatId: hatId,
          action: decided.action,
          change: decided.change,
          haltsTheLoop: decided.effect === "halts_the_loop",
          signal: raised.signal,
        },
      };
    }
    case "size_hat_supply": {
      const raised = sendSupervisorSignal(
        view.chart,
        view.board,
        {
          signalId: ids.signalId,
          anchorId: ids.anchorId,
          fromHatId: hatId,
          tool: SignalTool.SuggestImprovement,
          // THE TITLE IS THE SUBJECT, and that is what makes the gap raiseable exactly once:
          // `raisedSupplySubjects` reads these titles back, so a second offer of the same gap is
          // filtered before it reaches the menu.
          title: action.subjectId,
          message: action.reason,
          evidence: [{ kind: "trace", ref: `routing-gap:${action.subjectId}` }],
          atMs,
        },
        resourceAuthorityHatId,
      );
      if (!raised.ok) return { ok: false, reason: raised.reason };
      return { ok: true, effect: { kind: "signal", signal: raised.signal } };
    }
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
  // THE REQUIREMENT GATE COMES FIRST, and applies to every door.
  //
  // Placing work on a contributor is this register's version of the doc's move to `ready`, and the
  // gate has to sit at the moment rather than on one path to it — a steal and an alternate-work
  // placement put the same not-yet-understood item in front of the same agent.
  const gate = requirementGate(view, workId);
  if (!gate.ok) return { ok: false, reason: gate.reason };

  const observed = view.assigned;
  const owned = observed?.work.find((w) => w.workId === workId);
  const blocking = blockedOn(view, toHatId);
  if (blocking !== undefined) {
    // GIVING WORK TO A BLOCKED HAT IS ALTERNATE WORK, whatever the caller meant by it. The
    // guardrails are not opt-in: the condition that makes them necessary is the target being
    // stuck, and that is observable here.
    if (owned !== undefined) {
      return {
        ok: false,
        reason: `alternate_work: '${workId}' is held by '${owned.ownerHatId}'; a blocked hat is given free work, not someone else's`,
      };
    }
    return alternateEffect(view, hatId, workId, toHatId, blocking, atMs);
  }
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

/** The work item this hat says it is blocked on, if any. */
function blockedOn(view: OrgView, hatId: string): string | undefined {
  for (const m of view.blockers?.get(hatId) ?? []) {
    if (m.blocking.trim() !== "") return m.blocking;
  }
  return undefined;
}

/**
 * Work for a blocked hat, put through the doc's four guardrails.
 *
 * The candidate set is rebuilt here rather than taken from the caller, so the priority comparison
 * is made against what was ACTUALLY available — a caller supplying its own shortlist could satisfy
 * "highest of these" while the organization had something more important open.
 */
function alternateEffect(
  view: OrgView,
  hatId: string,
  workId: string,
  toHatId: string,
  blockedWorkId: string,
  atMs: number,
): EffectResult {
  const priorities = view.priorities;
  if (priorities === undefined) {
    return { ok: false, reason: "alternate_work: no priorities are decided, so the policy cannot be checked" };
  }
  const blocked = view.cascade.find((n) => n.workId === blockedWorkId);
  if (blocked?.parentWorkId === undefined) {
    return { ok: false, reason: `alternate_work: '${blockedWorkId}' has no parent, so no scope is approved` };
  }
  const blockedPriority = priorities.get(blockedWorkId);
  if (blockedPriority === undefined) {
    return { ok: false, reason: `alternate_work: '${blockedWorkId}' has no decided priority to rank against` };
  }
  const candidates = openCandidates(view, blockedWorkId, priorities);
  const chosenIndex = candidates.findIndex((c) => c.workId === workId);
  if (chosenIndex < 0) {
    return { ok: false, reason: `alternate_work: '${workId}' is not an open, unassigned, prioritized task` };
  }
  const verdict = offerAlternateWork(view.chart, {
    agentHatId: toHatId,
    blockedWorkId,
    blockedPriority,
    candidates,
    chosenIndex,
    approvedScopes: [blocked.parentWorkId],
    approvedByHatId: hatId,
    atMs,
  });
  if (!verdict.ok) return { ok: false, reason: `${verdict.refusal}: ${verdict.reason}` };
  return { ok: true, effect: { kind: "alternate", assignment: verdict.assignment } };
}

/**
 * Is this work item's REQUIREMENT ready to be worked on?
 *
 * The doc's gate — maturity gates the work item state — landed at the moment work is placed on a
 * contributor, which is this register's version of moving to `ready`. Everything before that is the
 * organization thinking about the item; assignment is when it becomes somebody's work.
 */
function requirementGate(view: OrgView, workId: string): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  const recorded = view.requirements?.get(workId);
  if (recorded === undefined) return { ok: true };
  const verdict = readinessOf(view.chart, recorded.profile, recorded.maturity, recorded.waivers ?? []);
  return verdict.ok ? { ok: true } : { ok: false, reason: `${verdict.refusal}: ${verdict.reason}` };
}

/**
 * The context half of this hat's surface, retrieved DETERMINISTICALLY from the organization's own
 * state.
 *
 * `OBSERVE_CONTEXT_PACKS.md` puts the pack beside the menu and the metrics — *"the third half of
 * the same surface"* — and requires the retrieval to narrow the world before any model helps. This
 * is that retrieval: it reads the cascade, the blockers and the artifacts this register already
 * holds, and it invents nothing.
 *
 * WHAT IT REPORTS AS AN OMISSION IS THE INTERESTING PART. A DIVERGED artifact is an unresolved
 * contradiction by construction — two heads, no single current version — and handing an agent one
 * of them as context would have it act on a version nobody agreed was the version. That is exactly
 * the omission class the doc wants first-class rather than silently resolved by picking a head.
 */
export function contextPackFor(view: OrgView, hatId: string, resourceAuthorityHatId: string): PackResult {
  const items: ContextItem[] = [];
  const omissions: Omission[] = [];

  for (const n of view.cascade) {
    if (n.assigneeHatId !== hatId && n.ownerHatId !== hatId) continue;
    items.push({
      kind: ContextItemKind.WorkItem,
      id: n.workId,
      summary: n.title,
      source: { kind: "document", ref: `cascade:${n.workId}` },
    });
  }

  for (const m of view.blockers?.get(hatId) ?? []) {
    items.push({
      kind: ContextItemKind.Blocker,
      id: m.blocking.trim() === "" ? m.about : m.blocking,
      summary: m.about,
      source: { kind: "trace", ref: `blocked:${m.blocking}` },
    });
  }

  for (const [artifactId, history] of view.artifacts) {
    if (!history.revisions.some((r) => r.byHatId === hatId)) continue;
    if (isDiverged(history)) {
      omissions.push({
        kind: OmissionKind.UnresolvedContradiction,
        about: artifactId,
        why: "the artifact has two heads; there is no single current version to hand over",
      });
      continue;
    }
    items.push({
      kind: ContextItemKind.Artifact,
      id: artifactId,
      summary: `artifact '${artifactId}'`,
      source: { kind: "document", ref: `artifact:${artifactId}` },
    });
  }

  return buildContextPack(view.chart, { hatId, resourceAuthorityHatId, items, omissions });
}

/**
 * What this hat is blocked on and has NOT already said so about.
 *
 * ── REPEATING A REPORT IS NOT ESCALATING IT ──────────────────────────────────
 * Measured over a 200-round drive: a blocked implementer chose `request_information` every single
 * round and the organization accumulated 200 identical signals about one blocker. Nothing was
 * wrong with any individual step — the hat was blocked, the surface said so, the signal routed —
 * and the aggregate was a livelock wearing the appearance of activity.
 *
 * The rule is the one `deliberationsOf` already uses for turns: YOU SPEAK ONCE. A blocker the hat
 * has raised stays off its surface until the blocker itself clears, because the organization's
 * record already holds it and a second copy adds nothing a reader did not have.
 *
 * ── AND THE UNANSWERED CASE IS SOMEBODY ELSE'S JOB ───────────────────────────
 * The obvious objection is that a report nobody acts on should be raised again. It should — by
 * ESCALATION, not by repetition, and `lag-detection.ts` already does exactly that:
 * `blocker_owner_silent` fires when the owner has not answered inside the SLA and addresses the
 * finding PAST them. Re-reporting to the same hat is the thing that already went unanswered.
 */
/**
 * Work that has run out of attempts at the gates, as a blocker its assignee has not yet raised.
 *
 * ── A COUNTER NOBODY READ AT THE LIMIT ───────────────────────────────────────
 * `submissionOpenings` bounds resubmission so a turned-back item is not offered forever. Correct,
 * and by itself it produced a new defect of a familiar kind: the count reached the bound, the
 * opening closed, and NOTHING HAPPENED. The work sat open, nobody was told, and the organization
 * looked settled — a reader with no writer, which is the shape this register keeps finding.
 *
 * So exhaustion becomes what it actually is: a hat that cannot get its work through, which is a
 * blocker. It travels the path blockers already travel — classified, routed by
 * `blocker-taxonomy.ts` to the hats that own that kind, raised ONCE by the existing dedupe — rather
 * than through a new channel that would need its own routing and its own de-duplication.
 *
 * WHAT THIS IS NOT: the churn escalation. `escalation.ts` decides what to DO about repeated
 * rejection — add agents, bring in an architect, re-scope — and that decision belongs to a manager
 * and is still `org-cycle.ts`'s alone. This delivers the fact to a hat that can act on it, and
 * saying it does more than that would be the promise this comment exists to refuse.
 */
function exhaustedAtGates(view: OrgView, hatId: string): readonly MissingInformation[] {
  const gates = view.gateAttempts;
  if (gates === undefined) return [];
  return view.cascade
    .filter(
      (n) =>
        n.assigneeHatId === hatId &&
        (n.state === WorkState.Open || n.state === WorkState.InProgress) &&
        (gates.counts.get(n.workId) ?? 0) >= gates.maxAttempts,
    )
    .map((n) => ({
      about: `'${n.title}' has been turned back by the gates ${String(gates.counts.get(n.workId) ?? 0)} time(s)`,
      blocking: n.workId,
      kind: BlockerKind.ReleaseBlocked,
    }));
}

function unraisedBlockers(view: OrgView, hatId: string): readonly MissingInformation[] {
  const mine = [...(view.blockers?.get(hatId) ?? []), ...exhaustedAtGates(view, hatId)];
  if (mine.length === 0) return mine;
  const raised = new Set(
    view.signals
      .filter((s) => s.fromHatId === hatId && (s.tool === SignalTool.ReportBlocker || s.tool === SignalTool.AskQuestion))
      .map((s) => `${s.workItemId ?? ""}:${s.title}`),
  );
  // The key is what `effectOf` puts on the signal: the blocked work item, and the TITLE it derives
  // — the blocker kind when classified, the agent's own words when not. Matching on the work item
  // alone would silence a second, different blocker on the same task.
  return mine.filter((m) => {
    const classified = m.kind !== undefined && isBlockerKind(m.kind);
    const title = classified ? m.kind! : m.about;
    return !raised.has(`${m.blocking}:${title}`);
  });
}
