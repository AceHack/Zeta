/**
 * work-stealing.ts — an idle hat helping, WITHOUT the chaos.
 *
 * ── THE DOC'S SENTENCE ───────────────────────────────────────────────────────
 * `ANTI_STALL_PRIORITY_RUNTIME.md` §"Work Stealing and Reassignment":
 *
 *   > The Organization needs **controlled** reassignment so idle hats can help without chaos.
 *
 * and then gives six conditions it is allowed under, plus seven checks it must pass. Both halves
 * matter, and they fail differently: the six say WHEN a steal is even on the table, the seven say
 * what a steal must not destroy on its way through.
 *
 * ── WHAT THE REGISTER ALREADY HAD, AND WHY IT IS NOT THIS ────────────────────
 * `work-market.ts` reaps stale claims: a lease expires, the shard returns to `Ready`, and the
 * fencing token makes the old claimant's later write refused. That keeps work from being lost when
 * an agent dies, and it is the right mechanism for that.
 *
 * It is not reassignment. Reaping returns work to NOBODY and waits for someone to claim it; a steal
 * hands it to a NAMED hat, on purpose, while the current owner may still believe it holds the work.
 * The second one can destroy things the first cannot — partial artifacts, a live session, a
 * dependent queue nobody updated — which is why the doc gives it its own checks.
 *
 * ── THE TRIGGER IS DERIVED, NEVER DECLARED ───────────────────────────────────
 * The failure this module is shaped against: a caller passing `reason: "owner is silent"` and the
 * steal proceeding. That is a gate that cannot fail — the caller states the justification and the
 * check believes it, so every steal is permitted and the six conditions decorate a decision already
 * made.
 *
 * So `triggersFor` DERIVES which conditions hold from observed state — a heartbeat age against an
 * SLA, a token expiry against the clock, a refresh that actually failed. `evaluateSteal` refuses
 * when none of them do. A caller cannot assert its way past this, and the refusal is the module's
 * whole reason to exist: an uncontrolled reassignment is exactly a steal with no trigger.
 *
 * ── AUTHORITY COMES FROM THE TRIGGER, NOT FROM SENIORITY ─────────────────────
 * Who may decide a steal depends on WHY it is being made. A silent owner is a line-management fact
 * and its supervisor decides. Scarce hat supply is the RMO's. A blocker another hat could clear is
 * the blocker owner's — which is `blocker-taxonomy.ts`'s table, reused rather than restated, so the
 * organization keeps ONE roster of who owns what. Two rosters that must agree are two that can
 * disagree, silently, in the permissive direction.
 *
 * Note what this rules out: a peer cannot take a peer's work however idle it is, and a director
 * cannot take work outside the line it is senior to. Seniority is not standing.
 */

import { BlockerKind, ownersFor } from "./blocker-taxonomy";
import { ActionClass, preflightHatAction } from "./hat-guardrails";
import { type OrgChart, type OrgHat, reportsUpTo } from "./org-chart";

/** The six conditions the doc allows a steal under. */
export const StealTrigger = {
  /** The owner has not been heard from inside its SLA. */
  OwnerSilentPastSla: "owner_silent_past_sla",
  /** The assignment token expired and the refresh failed — the owner holds nothing. */
  AssignmentTokenExpired: "assignment_token_expired",
  /** Hat supply is scarce and higher-priority work needs the capacity. */
  ScarceSupplyHigherPriority: "scarce_supply_higher_priority",
  /** The work is blocked and a different hat can clear the blocker. */
  BlockerResolvableByOther: "blocker_resolvable_by_other",
  /** A queue SLO is violated. */
  QueueSloViolated: "queue_slo_violated",
  /** Incident policy requires preemption. */
  IncidentPreemption: "incident_preemption",
} as const;

export type StealTrigger = (typeof StealTrigger)[keyof typeof StealTrigger];

/**
 * Who decides a steal made for this reason.
 *
 * `owner_supervisor` is the line-management case; the rest name a row of `BLOCKER_POLICY` whose
 * owners hold the standing, so the two modules share one roster.
 */
type DeciderRule =
  | { readonly kind: "owner_supervisor" }
  | { readonly kind: "blocker_owner"; readonly blocker: BlockerKind }
  /** The blocked work's OWN blocker kind decides — read off the work item, not fixed here. */
  | { readonly kind: "this_works_blocker_owner" };

const DECIDER: Readonly<Record<StealTrigger, DeciderRule>> = {
  // Both of these are facts about an assignment, and an assignment is a line-management object.
  [StealTrigger.OwnerSilentPastSla]: { kind: "owner_supervisor" },
  [StealTrigger.AssignmentTokenExpired]: { kind: "owner_supervisor" },
  // Supply is the RMO's to allocate — the same hats the taxonomy sends an exhausted-supply blocker.
  [StealTrigger.ScarceSupplyHigherPriority]: { kind: "blocker_owner", blocker: BlockerKind.HatSupplyExhausted },
  [StealTrigger.BlockerResolvableByOther]: { kind: "this_works_blocker_owner" },
  // A violated queue SLO is answered by re-sequencing, splitting, or parallelizing — which is the
  // resolution path the taxonomy gives `dependency_incomplete`, and its owners are the program hats.
  [StealTrigger.QueueSloViolated]: { kind: "blocker_owner", blocker: BlockerKind.DependencyIncomplete },
  [StealTrigger.IncidentPreemption]: { kind: "blocker_owner", blocker: BlockerKind.EnvironmentIssue },
};

/** What the organization can observe about a piece of assigned work. */
export interface OwnedWork {
  readonly workId: string;
  readonly ownerHatId: string;
  /** When the owner was last heard from. */
  readonly heartbeatAtMs: number;
  /** When the assignment token stops being valid. */
  readonly tokenExpiresMs: number;
  /** Whether a refresh was ATTEMPTED and failed — not whether one is due. */
  readonly tokenRefreshFailed: boolean;
  /** Work waiting on this one; a transfer must tell their queues. */
  readonly dependents?: readonly string[];
  /** Partial work already produced. A transfer must not drop it. */
  readonly artifacts?: readonly string[];
  /** Where the partial work was preserved. Absent with artifacts present REFUSES the steal. */
  readonly artifactsPreservedAt?: string;
  /** A live run or session belonging to the owner. */
  readonly activeRunId?: string;
  /** Whether that run's state has been reconciled. Unreconciled REFUSES. */
  readonly runReconciled?: boolean;
  /** Some work cannot move at all — the doc's "work item supports reassignment". */
  readonly transferable?: boolean;
  /** What this work is blocked on, when it is. */
  readonly blockerKind?: BlockerKind;
  /** Whether an incident policy is currently preempting. */
  readonly incidentPreemption?: boolean;
  /** Whether a queue SLO covering this work is violated. */
  readonly queueSloViolated?: boolean;
  /** Whether higher-priority work is waiting on scarce supply this hat holds. */
  readonly higherPriorityWaitingOnSupply?: boolean;
}

/**
 * Which of the six conditions actually hold, in the doc's order.
 *
 * DERIVED. `owner_silent_past_sla` is a heartbeat age against an SLA, not a caller's opinion that
 * the owner has gone quiet; `assignment_token_expired` needs BOTH an expired token and a refresh
 * that was tried and failed, because a token that merely lapsed is a refresh nobody has run yet.
 */
export function triggersFor(work: OwnedWork, nowMs: number, silenceSlaMs: number): readonly StealTrigger[] {
  const out: StealTrigger[] = [];
  if (nowMs - work.heartbeatAtMs >= silenceSlaMs) out.push(StealTrigger.OwnerSilentPastSla);
  if (nowMs >= work.tokenExpiresMs && work.tokenRefreshFailed) out.push(StealTrigger.AssignmentTokenExpired);
  if (work.higherPriorityWaitingOnSupply === true) out.push(StealTrigger.ScarceSupplyHigherPriority);
  if (work.blockerKind !== undefined) out.push(StealTrigger.BlockerResolvableByOther);
  if (work.queueSloViolated === true) out.push(StealTrigger.QueueSloViolated);
  if (work.incidentPreemption === true) out.push(StealTrigger.IncidentPreemption);
  return out;
}

/** Hats that may decide a steal made for this trigger, in the order authority is offered. */
export function decidersFor(chart: OrgChart, work: OwnedWork, trigger: StealTrigger): readonly OrgHat[] {
  const rule = DECIDER[trigger];
  switch (rule.kind) {
    case "owner_supervisor":
      // Everyone the owner reports to, transitively. `reportsUpTo` rather than a level comparison:
      // a director in another line is senior and has no standing over this assignment.
      return [...chart.byId.values()].filter((h) => h.id !== work.ownerHatId && reportsUpTo(chart, work.ownerHatId, h.id));
    case "blocker_owner":
      return ownersFor(chart, rule.blocker);
    case "this_works_blocker_owner":
      // The trigger only fires with a blocker present, so this is total where it is reachable.
      return work.blockerKind === undefined ? [] : ownersFor(chart, work.blockerKind);
  }
  return assertNeverRule(rule);
}

function assertNeverRule(x: never): never {
  throw new Error(`unhandled decider rule: ${JSON.stringify(x)}`);
}

export const StealRefusal = {
  /** None of the six conditions hold. The uncontrolled reassignment this module exists to refuse. */
  NoTrigger: "no_trigger",
  /** The work item does not support reassignment. */
  NotTransferable: "not_transferable",
  /** The target already holds it. */
  SameOwner: "same_owner",
  UnknownHat: "unknown_hat",
  /** The target cannot execute this class of work. */
  TargetCannotImplement: "target_cannot_implement",
  /** Nobody with standing over this trigger authorized it. */
  DeciderLacksAuthority: "decider_lacks_authority",
  /** Partial work exists and nowhere records where it was kept. */
  ArtifactsUnpreserved: "artifacts_unpreserved",
  /** A live run of the previous owner's is unreconciled. */
  RunUnreconciled: "run_unreconciled",
} as const;

export type StealRefusal = (typeof StealRefusal)[keyof typeof StealRefusal];

/** What a granted steal produces — every one of the doc's required checks, as a value. */
export interface WorkTransfer {
  readonly workId: string;
  readonly fromHatId: string;
  readonly toHatId: string;
  readonly decidedByHatId: string;
  /** Every condition that held, not only the first. The audit records why it was permitted. */
  readonly triggers: readonly StealTrigger[];
  readonly atMs: number;
  /**
   * The notice owed to the previous owner.
   *
   * NOT optional, and not left to the caller to remember. The doc requires the current owner be
   * notified, and a notification a caller may omit is one that will be omitted — the transfer
   * carries it so it cannot be dropped without deleting a field.
   */
  readonly notice: string;
  /** Where the previous owner's partial work is. Absent only when there was none. */
  readonly artifactsPreservedAt?: string;
  /** Queues that must be told the owner changed. */
  readonly dependentsToUpdate: readonly string[];
  /** One line for the decision log. */
  readonly audit: string;
}

export type StealVerdict =
  | { readonly ok: true; readonly transfer: WorkTransfer }
  | { readonly ok: false; readonly refusal: StealRefusal; readonly reason: string };

export interface StealInput {
  readonly work: OwnedWork;
  readonly toHatId: string;
  readonly decidedByHatId: string;
  readonly nowMs: number;
  readonly silenceSlaMs: number;
}

/**
 * May this work move, and to whom — with everything the move must carry.
 *
 * Checks run in a FIXED order, so a call refused for several reasons always names the same one.
 * A refusal that varies with input order is one nobody can write a test against.
 */
export function evaluateSteal(chart: OrgChart, input: StealInput): StealVerdict {
  const { work, toHatId, decidedByHatId, nowMs } = input;

  const triggers = triggersFor(work, nowMs, input.silenceSlaMs);
  if (triggers.length === 0) {
    return {
      ok: false,
      refusal: StealRefusal.NoTrigger,
      reason: `no condition permits taking '${work.workId}' from '${work.ownerHatId}'`,
    };
  }

  // DEFAULT DENY on transferability. An item that never said whether it can move is one nobody
  // decided about, and moving it on that silence is the permissive reading of an unknown.
  if (work.transferable !== true) {
    return {
      ok: false,
      refusal: StealRefusal.NotTransferable,
      reason: `'${work.workId}' does not support reassignment`,
    };
  }

  if (toHatId === work.ownerHatId) {
    return { ok: false, refusal: StealRefusal.SameOwner, reason: `'${toHatId}' already owns '${work.workId}'` };
  }

  const target = chart.byId.get(toHatId);
  if (target === undefined) return { ok: false, refusal: StealRefusal.UnknownHat, reason: `unknown hat '${toHatId}'` };
  if (chart.byId.get(decidedByHatId) === undefined) {
    return { ok: false, refusal: StealRefusal.UnknownHat, reason: `unknown hat '${decidedByHatId}'` };
  }

  const canImplement = preflightHatAction(chart, { hatId: toHatId, action: ActionClass.ImplementWork });
  if (!canImplement.ok) {
    return { ok: false, refusal: StealRefusal.TargetCannotImplement, reason: canImplement.reason };
  }

  // The decider needs standing over AT LEAST ONE trigger that holds. Not all of them: a steal
  // justified by a silent owner does not stop being the supervisor's call because an incident
  // happens to be running too.
  const authorizing = triggers.filter((t) => decidersFor(chart, work, t).some((h) => h.id === decidedByHatId));
  if (authorizing.length === 0) {
    return {
      ok: false,
      refusal: StealRefusal.DeciderLacksAuthority,
      reason: `'${decidedByHatId}' has no standing over ${triggers.join(", ")} for '${work.workId}'`,
    };
  }

  const artifacts = work.artifacts ?? [];
  if (artifacts.length > 0 && work.artifactsPreservedAt === undefined) {
    return {
      ok: false,
      refusal: StealRefusal.ArtifactsUnpreserved,
      reason: `'${work.workId}' has ${String(artifacts.length)} partial artifact(s) and no preservation record`,
    };
  }

  if (work.activeRunId !== undefined && work.runReconciled !== true) {
    return {
      ok: false,
      refusal: StealRefusal.RunUnreconciled,
      reason: `run '${work.activeRunId}' is still live and unreconciled`,
    };
  }

  return {
    ok: true,
    transfer: {
      workId: work.workId,
      fromHatId: work.ownerHatId,
      toHatId,
      decidedByHatId,
      // ONLY the triggers this decider had standing over. Listing a trigger it could not act on
      // would put a justification in the audit that this decision did not rest on.
      triggers: authorizing,
      atMs: nowMs,
      notice: `'${work.workId}' reassigned to '${toHatId}' by '${decidedByHatId}' — ${authorizing.join(", ")}`,
      ...(work.artifactsPreservedAt === undefined ? {} : { artifactsPreservedAt: work.artifactsPreservedAt }),
      dependentsToUpdate: ordinal(work.dependents ?? []),
      audit: `${decidedByHatId} moved ${work.workId} from ${work.ownerHatId} to ${toHatId} at ${String(nowMs)} for ${authorizing.join(", ")}`,
    },
  };
}

/** ORDINAL. Two machines reporting the same transfer must list its queues in the same order. */
function ordinal(xs: readonly string[]): readonly string[] {
  return [...xs].sort((a, b) => {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  });
}
