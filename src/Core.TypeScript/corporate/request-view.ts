/**
 * request-view.ts — the organization indexed by WHAT ASKED, not by what it did.
 *
 * Every other projection here is organised the way the register thinks: runs, cascades, gates, hats.
 * This one is organised the way the person who filed the thing thinks — *"where is AIAGENT-1637"* —
 * and it is the only index that can answer across runs, because a request outlives the run that
 * happened to pick it up.
 *
 * ── IT IS DERIVED, AND IT IS DERIVED FROM WORK ───────────────────────────────
 * A request appears here because WORK carries its key, never because an intake event mentioned it.
 * That ordering matters: an intake event says something arrived, and a `requestRef` on a cascade
 * node says the organization actually did something about it. A page built on the first would list
 * requests it had silently dropped as though they were in flight.
 *
 * Requests that were REFUSED at the door are folded separately and shown as such — they have no
 * work by definition, and the person who filed them is waiting to hear that.
 */

import type { Cascade, CascadeNode } from "./goal-cascade";
import { childrenOf, isLeafType, WorkState } from "./goal-cascade";
import type { OrgEvent } from "./org-event";
import { parseRequestRef, requestUrl, sourceLabel, type RequestRef } from "./request";

/** One request, with everything the organization has done about it. */
export interface RequestView {
  readonly key: string;
  readonly source: string;
  readonly sourceLabel: string;
  readonly externalId: string;
  /** A link to the original, when an operator declared a URL template for this source. */
  readonly url: string | undefined;
  /** The request's own words, taken from the goal it produced. */
  readonly title: string;
  /** Every work item that answers it, at every rung. */
  readonly workIds: readonly string[];
  /** Just the leaves — the things somebody actually does. */
  readonly leafIds: readonly string[];
  readonly delivered: number;
  readonly inFlight: number;
  readonly blocked: number;
  /**
   * Whether anything about this request is waiting on a person.
   *
   * Supplied by the caller rather than derived here, because "waiting" is a function of the
   * configured checkpoints and the answer queue — neither of which is a property of the cascade.
   */
  readonly waiting: number;
  readonly firstSeenMs: number | undefined;
}

/** A request the organization declined, and why. Shown because the filer is owed the answer. */
export interface RefusedRequestView {
  readonly key: string | undefined;
  readonly source: string | undefined;
  readonly externalId: string | undefined;
  readonly title: string;
  readonly reason: string;
  readonly message: string;
  readonly atMs: number;
}

/**
 * Every request the organization has work for.
 *
 * `urlTemplates` maps a source to a link pattern containing `{id}`. Absent for a source ⇒ no link,
 * which is the honest default: a URL guessed from a source name is a link to somebody else's
 * tracker, and a page that produces plausible wrong links is worse than one that produces none.
 */
export function requestViews(
  cascade: Cascade,
  events: readonly OrgEvent[],
  options: {
    readonly urlTemplates?: Readonly<Record<string, string>>;
    /** Work ids currently held at a human checkpoint, so a request can say it needs somebody. */
    readonly waitingWorkIds?: readonly string[];
  } = {},
): readonly RequestView[] {
  const templates = options.urlTemplates ?? {};
  const waiting = new Set(options.waitingWorkIds ?? []);
  const firstSeen = firstSeenByRef(events);

  const byKey = new Map<string, { ref: RequestRef; nodes: CascadeNode[] }>();
  for (const node of cascade.nodes) {
    if (node.requestRef === undefined) continue;
    const ref = parseRequestRef(node.requestRef);
    // A ref that does not parse is a key from another scheme. Skipped rather than shown under an
    // invented source — see `parseRequestRef`.
    if (ref === undefined) continue;
    const bucket = byKey.get(ref.key) ?? { ref, nodes: [] };
    bucket.nodes.push(node);
    byKey.set(ref.key, bucket);
  }

  const out: RequestView[] = [];
  for (const [key, { ref, nodes }] of byKey) {
    const leaves = nodes.filter((n) => isLeafType(n.workType) && childrenOf(cascade, n.workId).length === 0);
    // THE GOAL'S TITLE IS THE REQUEST'S TITLE. It is the rung that was accepted from the request, so
    // it is the closest thing to the filer's own words the cascade holds.
    const goal = nodes.find((n) => n.parentWorkId === undefined);
    out.push({
      key,
      source: ref.source,
      sourceLabel: sourceLabel(ref.source),
      externalId: ref.externalId,
      url: requestUrl(ref, templates),
      title: goal?.title ?? nodes[0]?.title ?? ref.externalId,
      workIds: nodes.map((n) => n.workId),
      leafIds: leaves.map((n) => n.workId),
      delivered: leaves.filter((n) => n.state === WorkState.Done).length,
      inFlight: leaves.filter((n) => n.state !== WorkState.Done && n.state !== WorkState.Canceled).length,
      blocked: leaves.filter((n) => n.state === WorkState.Canceled).length,
      // COUNTED OVER EVERY RUNG, not just the leaves. A checkpoint holds a task today, and
      // counting only leaves would silently report zero if one ever held a project — an
      // under-report on the one number that decides whether somebody opens the page.
      waiting: nodes.filter((n) => waiting.has(n.workId)).length,
      firstSeenMs: firstSeen.get(key),
    });
  }
  // NEEDS-A-PERSON FIRST, then most recent. A request nobody has to touch is history; one that is
  // holding is the reason somebody opened the page.
  return out.sort((a, b) =>
    a.waiting === b.waiting ? (b.firstSeenMs ?? 0) - (a.firstSeenMs ?? 0) : b.waiting - a.waiting,
  );
}

/** When each request was first accepted, from the intake events. */
function firstSeenByRef(events: readonly OrgEvent[]): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  for (const event of events) {
    if (event.fact?.kind !== "intake_accepted") continue;
    const key = event.fact.item.externalRef;
    if (!out.has(key)) out.set(key, event.atMs);
  }
  return out;
}

/**
 * Requests the organization DECLINED, with the reason.
 *
 * These have no work by construction — that is what refusal means — so they cannot appear in the
 * index above, and until now they existed only as a sentence in a refusals list nobody reads. The
 * person who filed a duplicate or a defect with no reproduction steps is waiting, and does not know.
 */
export function refusedRequestViews(events: readonly OrgEvent[]): readonly RefusedRequestView[] {
  const out: RefusedRequestView[] = [];
  for (const event of events) {
    if (event.fact?.kind !== "intake_refused") continue;
    const f = event.fact;
    const ref = f.externalRef === undefined ? undefined : parseRequestRef(f.externalRef);
    out.push({
      key: f.externalRef,
      source: ref?.source,
      externalId: ref?.externalId,
      title: f.title,
      reason: f.reason,
      message: f.message,
      atMs: event.atMs,
    });
  }
  return out.sort((a, b) => b.atMs - a.atMs);
}
