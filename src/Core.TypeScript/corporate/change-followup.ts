/**
 * corporate/change-followup.ts — what happens to a change after it is in front of people.
 *
 * ── THE ORGANIZATION'S PART DOES NOT END AT THE HANDOFF ──────────────────────
 * A merge request is a conversation. Reviewers comment, the request is updated or closed, and the
 * branch it targets moves on without it. Every one of those is something somebody may need to act
 * on, and until this existed the organization handed a change off and never looked at it again.
 *
 * ── AN EVENT IS AN ACTION ITEM, NEVER AN INSTRUCTION ─────────────────────────
 * Whatever arrives — a webhook delivery, a poll of the review system — is recorded as an ACTION ITEM
 * on the work it concerns (`action_item_raised`), and that is all. No event re-runs a gate, reopens a
 * step or starts work by itself: a comment that says "this is fine" and one that says "this breaks
 * checkout" arrive the same way, and telling them apart is judgement. The organization weighs its
 * open items against everything else it has to do and decides, per item, to address it, decline it
 * with a reason, or leave it for later. That decision is an agent's; this module only carries the
 * items to it and checks the answer names items that exist.
 *
 * ── NOTHING HERE KNOWS A REVIEW SYSTEM ───────────────────────────────────────
 * A delivery says which change it is about (a branch, or a review address) or which target moved.
 * How a GitLab note or a GitHub review becomes one is the source's business — a webhook mapping or a
 * poller — so the register can learn another review system without a line changing here.
 */

import type { ActionItem, HandedOffChange } from "./org-fold";
import type { PipelinePolicy } from "./change-request";

/** One thing that happened, normalized, before it is known which work it concerns. */
export interface FeedbackDelivery {
  /** Stable per event: a redelivery of the same event carries the same id, which is what makes raising idempotent. */
  readonly deliveryId: string;
  /** Where it came from — a configured source id, or the review system's name. */
  readonly source: string;
  /** What happened, in the source's words: `comment`, `update`, `closed`, `target_moved`, ... */
  readonly itemKind: string;
  readonly summary: string;
  readonly detail?: string;
  /** Where a person can see it. */
  readonly url?: string;
  readonly author?: string;
  /** The branch of the change it concerns, when the event is about one request. */
  readonly branch?: string;
  /** The review address of the change it concerns — matched as a prefix, so a comment's anchor still finds its request. */
  readonly changeUrl?: string;
  /** A target branch that MOVED. The event concerns every change proposed against it. */
  readonly target?: string;
  /** Where the target moved to, when known. Part of the item's identity: each move is its own item. */
  readonly targetCommit?: string;
}

/** A delivery matched to the work it concerns. */
export interface MatchedFeedback {
  readonly workId: string;
  readonly delivery: FeedbackDelivery;
  /** The id the action item will carry. */
  readonly actionItemId: string;
}

export interface Correlation {
  /** Deliveries about ONE change. */
  readonly aboutChange: readonly MatchedFeedback[];
  /** A target moved: one entry per change proposed against it. Raised only once the change is measured as behind. */
  readonly targetMoved: readonly MatchedFeedback[];
  /** Deliveries that concern no change this organization handed off. Reported, never guessed at. */
  readonly unmatched: readonly FeedbackDelivery[];
}

const normUrl = (u: string): string => u.trim().replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();
/** `url` is the change's address or something beneath it — never merely a longer number (`/16` must not own `/162`). */
const within = (url: string, change: string): boolean => {
  const u = normUrl(url);
  const c = normUrl(change);
  return u === c || (u.startsWith(c) && (u[c.length] === "/" || u[c.length] === "?"));
};
const branchName = (ref: string): string => ref.trim().replace(/^refs\/heads\//, "");

/**
 * Which handed-off work each delivery concerns.
 *
 * A delivery about a change is matched by its branch, or by a review address that starts with the
 * change's own; a delivery about a target is matched to every change proposed against that branch
 * (`defaultBase` for a handoff recorded before its base was). Anything else is UNMATCHED and says so:
 * attaching a comment to the wrong work would be worse than attaching it to none.
 */
export function correlateFeedback(
  deliveries: readonly FeedbackDelivery[],
  handedOff: ReadonlyMap<string, HandedOffChange>,
  defaultBase: string,
): Correlation {
  const aboutChange: MatchedFeedback[] = [];
  const targetMoved: MatchedFeedback[] = [];
  const unmatched: FeedbackDelivery[] = [];
  const changes = [...handedOff.values()];
  for (const d of deliveries) {
    const id = `${d.source}:${d.deliveryId}`;
    if (d.target !== undefined && d.target.trim() !== "") {
      const target = branchName(d.target);
      const against = changes.filter((c) => branchName(c.base ?? defaultBase) === target);
      if (against.length === 0) unmatched.push(d);
      for (const c of against) {
        targetMoved.push({ workId: c.workId, delivery: d, actionItemId: `${id}@${c.workId}` });
      }
      continue;
    }
    const match = changes.find(
      (c) =>
        (d.branch !== undefined && branchName(d.branch) === branchName(c.branch)) ||
        (d.changeUrl !== undefined && c.url !== undefined && within(d.changeUrl, c.url)),
    );
    if (match === undefined) unmatched.push(d);
    else aboutChange.push({ workId: match.workId, delivery: d, actionItemId: id });
  }
  return { aboutChange, targetMoved, unmatched };
}

/** What the organization decided about one open item. */
export interface ItemDecision {
  readonly actionItemId: string;
  /** `deferred` leaves the item OPEN: the organization has weighed it and it is not the most important thing yet. */
  readonly outcome: "addressed" | "declined" | "deferred";
  /** What was done, or why not. Required: an item closed with no account is an item nobody can check. */
  readonly how: string;
  /**
   * Whether the person who raised it is answered where they raised it (default: yes). `false` is for
   * an item that asked nothing of the change - a review-trigger keyword, a bot saying it has started.
   */
  readonly respond?: boolean;
}

/**
 * A follow-up's CODE, put through the same review the original work passed before it is pushed.
 *
 * MEASURED on MR !164: a follow-up commit claimed two review findings were fixed with tests; removing
 * one half of the fix left every test green. It went from "the tests pass" straight to the reviewer's
 * inbox, because a follow-up had no review step at all - the original work's implementation_review
 * and qa_uat were never asked about the commits that came after them.
 */
export interface FollowUpReviewRequest {
  readonly gate: string;
  /** Who reviews: an owner of the gate who is NOT the hat that made the follow-up. */
  readonly reviewerHatId: string;
  readonly workId: string;
  readonly branch: string;
  readonly workdir?: string;
  /** The last commit in front of people. Everything after it is unreviewed, whoever made it. */
  readonly from: string;
  readonly to: string;
  /** What the follow-up says those commits do, item by item. */
  readonly items: readonly { readonly summary: string; readonly outcome: string; readonly how: string }[];
}

export interface FollowUpReviewVerdict {
  readonly approved: boolean;
  readonly reason: string;
}

/**
 * Every answer checked before a reviewer reads it. MEASURED on MR !162: a reply said "the Rollout
 * note [is] now appended to the description" - it was not, and nothing between the session that wrote
 * the account and the thread it was posted to looked. A checker confirms each factual claim in an
 * answer against the change's checkout and the request's CURRENT description; an answer with a claim
 * it cannot confirm is not posted, and its item is reopened with what did not hold.
 */
export interface AnswerCheckRequest {
  readonly workId: string;
  readonly branch: string;
  readonly workdir?: string;
  /** The request's description as it stands now - what "the description says" is checked against. */
  readonly description?: string;
  readonly items: readonly { readonly actionItemId: string; readonly summary: string; readonly outcome: string; readonly how: string; readonly commit?: string }[];
}

export interface AnswerCheck {
  readonly actionItemId: string;
  readonly confirmed: boolean;
  /** The claims that did not hold, in the checker's words. Empty when confirmed. */
  readonly unconfirmed: readonly string[];
}

/** One settled item to answer where it was raised. */
export interface AnswerItem {
  readonly actionItemId: string;
  readonly source: string;
  readonly itemKind: string;
  /** Where it was raised - the address the answer goes to. */
  readonly url?: string;
  readonly outcome: string;
  readonly how: string;
  readonly commit?: string;
  /**
   * `always`: the organization decided to answer it. `if_thread`: settled before answering existed,
   * so nobody decided - answer only where it is a thread a reviewer can resolve, which is where an
   * unanswered comment actually waits on somebody.
   */
  readonly when: "always" | "if_thread";
}

/** What an answerer is asked to do for one handed-off change. */
export interface AnswerRequest {
  readonly workId: string;
  readonly changeUrl?: string;
  readonly branch: string;
  readonly workdir?: string;
  /** Resolve each thread after replying (`reply_and_resolve`), or leave that to the reviewers (`reply`). */
  readonly resolve: boolean;
  readonly items: readonly AnswerItem[];
}

/** What came of answering one item. An `error` is not recorded, so the item is tried again next time. */
export type AnswerResult =
  | { readonly actionItemId: string; readonly replyId?: string; readonly resolved: boolean; readonly skipped?: string }
  | { readonly actionItemId: string; readonly error: string };

/**
 * A place on the machine the organization runs on, named in text meant for a reviewer: an absolute
 * local path, or the organization's own store. MEASURED on MR !162: an account written for the
 * organization's record pointed at `C:\Users\...\.agent-org\stores\...\evidence\...` - a reviewer can
 * open none of it, and posting it publishes the operator's filesystem. What the prompt forbids, this
 * refuses mechanically.
 */
export function placeOnThisMachine(text: string): string | undefined {
  const m = /(?:^|[\s(`'"])((?:[A-Za-z]:[\\/]|\/(?:Users|home|tmp|var\/folders)\/)[^\s`'")]*)|(\.agent-org[\\/][^\s`'")]*)/.exec(text);
  if (m === null) return undefined;
  return (m[1] ?? m[2] ?? "").slice(0, 60);
}

/**
 * UNDER `until_green`, A RED PIPELINE CANNOT BE DECLINED.
 *
 * MEASURED on agentic-tpm !164: pipelines 189179 and 189289 were raised as action items, diagnosed
 * as a MongoMemoryServer flake - carefully, with the whole suite green locally at the same SHA - and
 * DECLINED. The reasoning may well be right. The request was still red, and the organization
 * considered itself finished with it; the person who merges reads the pipeline, not the argument.
 *
 * So the decision is KEPT, with its reasoning, and turned into a DEFERRAL: the item stays open, and
 * the organization is asked about it again after the next pipeline, until it passes or a person is
 * told. The follow-up prompt says the same thing; this is what holds when the session says it anyway.
 * Everything else - addressed, deferred, any decision on any other kind of item - passes through
 * untouched: this narrows one outcome on one kind of item, and decides nothing about the work.
 */
export function keepRedPipelinesOpen(
  items: readonly ActionItem[],
  decisions: readonly ItemDecision[],
  policy: PipelinePolicy | undefined,
): { readonly decisions: readonly ItemDecision[]; readonly kept: readonly string[] } {
  if (policy !== "until_green") return { decisions, kept: [] };
  const pipelines = new Set(items.filter((i) => i.itemKind === "pipeline_failed").map((i) => i.actionItemId));
  const kept: string[] = [];
  const out = decisions.map((d) => {
    if (d.outcome !== "declined" || !pipelines.has(d.actionItemId)) return d;
    kept.push(d.actionItemId);
    return { ...d, outcome: "deferred" as const, how: `${d.how} (kept open: this organization's work is not done until the pipeline passes)` };
  });
  return { decisions: out, kept };
}

/**
 * The settled items on one change still owed an answer, and those the organization decided to leave
 * unanswered (recorded as such without asking anyone, so they are not owed forever).
 *
 * ORDER IS THE POINT: only a SETTLED item is answered, and an item is settled only once what settles
 * it is in front of people - so a reply saying "fixed in abc123" is never posted before abc123 is.
 */
export function answersOwed(items: readonly ActionItem[]): {
  readonly owed: readonly AnswerItem[];
  readonly unanswered: readonly { readonly actionItemId: string; readonly why: string }[];
  /** Settlements that cannot be answered as written - they are REOPENED with this reason, never dropped. */
  readonly withheld: readonly { readonly actionItemId: string; readonly why: string }[];
} {
  const owed: AnswerItem[] = [];
  const unanswered: { actionItemId: string; why: string }[] = [];
  const withheld: { actionItemId: string; why: string }[] = [];
  for (const i of items) {
    if (i.settled === undefined) continue;
    const leak = placeOnThisMachine(i.settled.how);
    // A WITHHELD ANSWER IS NOT A DEAD END. MEASURED on MR !162: the account named the organization's
    // own evidence directory, the guard below refused to post it, and the item was recorded as
    // skipped - so a blocking finding stayed unanswered for good. What settles a reviewer's comment
    // has to be somewhere the reviewer can see, so the item goes back to be decided again. An item
    // already recorded as skipped for this reason (before reopening existed) is reopened the same way.
    if (leak !== undefined && i.settled.respond !== false && (i.answered === undefined || i.answered.skipped?.startsWith(WITHHELD) === true)) {
      withheld.push({
        actionItemId: i.actionItemId,
        why:
          `your account could not be posted to the reviewer: it names ${leak}, which they cannot open. ` +
          "Whatever settles this has to be where the reviewer can see it - in the change, in the request's description, or in the reply itself.",
      });
      continue;
    }
    if (i.answered !== undefined) continue;
    if (i.settled.respond === false) {
      unanswered.push({ actionItemId: i.actionItemId, why: "the organization decided it asked nothing of the change" });
      continue;
    }
    owed.push({
      actionItemId: i.actionItemId,
      source: i.source,
      itemKind: i.itemKind,
      ...(i.url === undefined ? {} : { url: i.url }),
      outcome: i.settled.outcome,
      how: i.settled.how,
      ...(i.settled.commit === undefined ? {} : { commit: i.settled.commit }),
      when: i.settled.respond === true ? "always" : "if_thread",
    });
  }
  return { owed, unanswered, withheld };
}

/** How a withheld answer was recorded before reopening existed - recognised so those items reopen too. */
const WITHHELD = "its account names a place the reviewer cannot open";

/** What a follow-up session was asked to look at. */
export interface FollowUpRequest {
  readonly workId: string;
  readonly hatId: string;
  readonly branch: string;
  readonly base?: string;
  readonly workdir?: string;
  readonly items: readonly ActionItem[];
  /**
   * `triage`: decide about the open items, change the branch where that is the decision.
   * `resolve`: a merge of the target is in progress with these conflicts — resolve them and commit.
   */
  readonly mode: "triage" | "resolve";
  readonly conflicts?: readonly string[];
  /** Whether bringing the change up to date is on offer here (`merge_target`), or only noting it (`flag_only`). */
  readonly canSync: boolean;
  /**
   * What a red pipeline means here. Under `until_green` a pipeline item cannot be finished by
   * explaining it: the session is told so, because a careful diagnosis is exactly what it reached
   * for the last time (agentic-tpm !164, pipelines 189179 and 189289, both declined as flakes).
   */
  readonly pipelines?: PipelinePolicy;
}

export interface FollowUpOutcome {
  readonly decisions: readonly ItemDecision[];
  /** The organization wants the change brought level with its target. Honoured only where syncing is configured. */
  readonly syncWithTarget: boolean;
  readonly summary: string;
}

/**
 * Keep only decisions about items that were actually put to the session, each once, with an account.
 *
 * An agent that answers about an item it was never shown, or settles one with no reason, would close
 * something nobody can check. Items it did not mention stay open: silence is not a decision.
 */
export function acceptedDecisions(items: readonly ActionItem[], decisions: readonly ItemDecision[]): {
  readonly accepted: readonly ItemDecision[];
  readonly refused: readonly string[];
} {
  const known = new Set(items.map((i) => i.actionItemId));
  const seen = new Set<string>();
  const accepted: ItemDecision[] = [];
  const refused: string[] = [];
  for (const d of decisions) {
    if (!known.has(d.actionItemId)) {
      refused.push(`'${d.actionItemId}' was not one of the open items`);
      continue;
    }
    if (seen.has(d.actionItemId)) {
      refused.push(`'${d.actionItemId}' was decided twice`);
      continue;
    }
    seen.add(d.actionItemId);
    if (d.outcome !== "addressed" && d.outcome !== "declined" && d.outcome !== "deferred") {
      refused.push(`'${d.actionItemId}': '${String(d.outcome)}' is not addressed, declined or deferred`);
      continue;
    }
    if (d.how.trim() === "") {
      refused.push(`'${d.actionItemId}' was ${d.outcome} with no account of how or why`);
      continue;
    }
    accepted.push(d);
  }
  return { accepted, refused };
}

/**
 * The order handed-off work is followed up in when there is more than one: the work whose oldest
 * open item has waited longest first. A person who commented yesterday has waited longer than one
 * who commented a minute ago; nothing about the item's words is weighed here — that is the session's job.
 */
export function followUpOrder(open: ReadonlyMap<string, readonly ActionItem[]>): readonly string[] {
  const oldest = (items: readonly ActionItem[]): number => Math.min(...items.map((i) => i.raisedAtMs));
  return [...open.entries()]
    .filter(([, items]) => items.length > 0)
    .sort(([a, ia], [b, ib]) => oldest(ia) - oldest(ib) || (a < b ? -1 : a > b ? 1 : 0))
    .map(([workId]) => workId);
}

/** One handed-off change the organization followed up, and what came of it. */
export interface FollowUpReport {
  readonly workId: string;
  /** Decisions accepted and recorded. `deferred` ones are listed; their items stay open. */
  readonly decided: readonly ItemDecision[];
  /** Where the change stood against its target, when that was measured or acted on. */
  readonly synced?: { readonly target: string; readonly behindBy: number; readonly applied: boolean; readonly conflicts: readonly string[] };
  /** The change was pushed and its request updated again. */
  readonly handedOffAgain: boolean;
  /** Why anything that was attempted did not happen. */
  readonly refused: readonly string[];
}
