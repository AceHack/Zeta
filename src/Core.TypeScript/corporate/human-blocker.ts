/**
 * human-blocker.ts — the way OUT of the organization, and the guard on it.
 *
 * Every other escalation in this register is internal. `blocker-taxonomy` routes a blocker to the
 * hat that owns that kind; `escalation` decides that a spinning loop needs a manager. Both end
 * inside the chart, which is correct right up until the answer is not in the chart — a credential
 * nobody here may grant, a product call nobody here may make, a design decision the person who
 * wrote the requirement has to settle. At that point the organization's options are to guess, or to
 * go quiet, and it does not get to choose a third one on its own.
 *
 * This is the third one. An agent raises a blocker that LEAVES, and a person answers it.
 *
 * ── WHY THE HATCH NEEDS A LOCK, AND WHAT KIND ────────────────────────────────
 * An escape hatch that is free to take eventually carries everything: asking a person is cheaper
 * for the agent than exhausting the organization, and the org degrades into a queue of questions
 * with a human at the end. So the claim "this cannot be solved here" is CHECKED where it can be:
 *
 *   - `no_owner_in_org` is checked against the chart. Claim it while a `security_engineer` sits
 *     right there and the raise is REFUSED, with the hat you should have asked.
 *   - `owners_could_not_resolve` must name hats that exist and must name at least one. An
 *     exhaustion that names nobody is the vacuity class in its purest form — diligence asserted at
 *     zero cost, unfalsifiable by construction.
 *   - `outside_org_authority` is NOT checkable here, and says so rather than pretending. Whether a
 *     decision belongs to this organization is not a fact its own chart contains.
 *
 * Two checked, one honestly unchecked. Claiming all three were verified would make this module a
 * broken meter — presenting as an inspectable check while one third of it is a pass-through.
 *
 * ── IT IS NOT A REFUSAL TO BE STUCK ──────────────────────────────────────────
 * `never-assume-malice-where-mistake-is-possible` applies to the agent raising it. Hitting an
 * unknown is the base rate of real work. The refusals above are about the CLAIM being checkable,
 * never about the agent's honesty, and a refused raise tells the agent who to ask instead rather
 * than telling it to try harder.
 */

import { whyItLeft, type Exhaustion, type HumanBlocker } from "../observe/observe";
import { isBlockerKind, ownersFor } from "./blocker-taxonomy";
import { HumanActionKind, type HumanAction } from "./human-action";
import { OrgEventKind, type OrgEvent } from "./org-event";
import type { OrgChart } from "./org-chart";

/** A blocker as it leaves the organization: what it is, plus who raised it and when. */
export interface RaisedBlocker extends HumanBlocker {
  /** The hat that raised it. A person answering deserves to know who is stuck. */
  readonly byHatId: string;
  readonly atMs: number;
  /** The sentence a person reads first — rendered at raise time so the record is self-contained. */
  readonly why: string;
}

export type BlockerResult =
  | { readonly ok: true; readonly blocker: RaisedBlocker }
  | { readonly ok: false; readonly reason: string };

const TRIMMED = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Read an exhaustion off untrusted input, or say what is wrong with it.
 *
 * Separate from `acceptBlocker` so the union's own rules are testable without building a whole
 * blocker around them — and because this is where the one refusal that matters lives.
 */
export function acceptExhaustion(raw: unknown): { ok: true; exhaustion: Exhaustion } | { ok: false; reason: string } {
  if (raw === null || typeof raw !== "object") return { ok: false, reason: "exhaustion must be an object" };
  const it = raw as Record<string, unknown>;
  const kind = TRIMMED(it["kind"]);
  switch (kind) {
    case "no_owner_in_org": {
      const forBlockerKind = TRIMMED(it["forBlockerKind"]);
      if (forBlockerKind === "") {
        return { ok: false, reason: "no_owner_in_org needs forBlockerKind — which kind of blocker has no owner" };
      }
      return { ok: true, exhaustion: { kind: "no_owner_in_org", forBlockerKind } };
    }
    case "owners_could_not_resolve": {
      const rawIds = Array.isArray(it["askedHatIds"]) ? (it["askedHatIds"] as unknown[]) : [];
      const askedHatIds = rawIds.map(TRIMMED).filter((v) => v !== "");
      // THE LOCK ON THE HATCH. "I asked and nobody could help" with no names is a claim that costs
      // nothing to make and cannot be checked by anyone — so it is refused rather than recorded.
      if (askedHatIds.length === 0) {
        return {
          ok: false,
          reason: "owners_could_not_resolve needs askedHatIds — name who was asked, or this claim cannot be checked",
        };
      }
      return { ok: true, exhaustion: { kind: "owners_could_not_resolve", askedHatIds } };
    }
    case "outside_org_authority": {
      const what = TRIMMED(it["what"]);
      if (what === "") {
        return { ok: false, reason: "outside_org_authority needs what — which decision is not the organization's" };
      }
      return { ok: true, exhaustion: { kind: "outside_org_authority", what } };
    }
    default:
      return {
        ok: false,
        reason: `unknown exhaustion '${kind}' — expected no_owner_in_org, outside_org_authority or owners_could_not_resolve`,
      };
  }
}

// `whyItLeft` lives in `observe.ts` and is imported, not restated. The grammar renders the reason
// when the agent chooses the verb and this module renders it again when the raise is recorded; two
// copies would be two answers to one question, and the first to drift would be the one a person
// reads.

/**
 * Accept a raise, or refuse it with the reason.
 *
 * Refused at the door for the same reason `acceptAction` refuses there: the reader is a person who
 * cannot ask a follow-up question, and a blocker that arrives without the work it blocks or without
 * what an answer would unblock is one they can only guess at.
 */
export function acceptBlocker(raw: unknown): BlockerResult {
  if (raw === null || typeof raw !== "object") return { ok: false, reason: "blocker must be an object" };
  const it = raw as Record<string, unknown>;

  const about = TRIMMED(it["about"]);
  if (about === "") return { ok: false, reason: "about is required: say what is not known" };

  // A BLOCKER BLOCKING NOTHING IS AN OPINION. The same rule the supervisor signal already applies
  // to evidence — an ask with no work behind it cannot be prioritised against anything.
  const blocking = TRIMMED(it["blocking"]);
  if (blocking === "") return { ok: false, reason: "blocking is required: say what has stopped" };

  const byHatId = TRIMMED(it["byHatId"]);
  if (byHatId === "") return { ok: false, reason: "byHatId is required: a person answering needs to know who is stuck" };

  const unblocks = TRIMMED(it["unblocks"]);
  if (unblocks === "") {
    return { ok: false, reason: "unblocks is required: say what an answer lets you do, so the ask is worth answering" };
  }

  const ex = acceptExhaustion(it["exhaustion"]);
  if (!ex.ok) return { ok: false, reason: ex.reason };

  const atRaw = it["atMs"];
  const atMs = typeof atRaw === "number" && Number.isFinite(atRaw) ? atRaw : Date.now();
  const kind = TRIMMED(it["kind"]);
  const idRaw = TRIMMED(it["blockerId"]);

  const blocker: RaisedBlocker = {
    // IDEMPOTENT BY DERIVATION when no id is supplied: the same hat, stuck on the same thing, for
    // the same work, produces the same id — so a loop that raises every tick fills one slot in a
    // person's queue instead of a hundred.
    blockerId: idRaw === "" ? `hb-${byHatId}-${blocking}-${about}`.replace(/[^A-Za-z0-9._-]/g, "-") : idRaw,
    about,
    blocking,
    ...(kind === "" ? {} : { kind }),
    exhaustion: ex.exhaustion,
    unblocks,
    byHatId,
    atMs,
    why: "",
  };
  return { ok: true, blocker: { ...blocker, why: whyItLeft(blocker) } };
}

/**
 * Does the exhaustion hold against this chart?
 *
 * `checked: false` is a real answer and not a soft pass — the caller is told the claim was not
 * verified rather than being allowed to read silence as verification.
 */
export function exhaustionHolds(
  chart: OrgChart,
  exhaustion: Exhaustion,
): { readonly holds: true; readonly checked: boolean } | { readonly holds: false; readonly reason: string } {
  switch (exhaustion.kind) {
    case "no_owner_in_org": {
      // An unclassified kind cannot be looked up, so the claim is unverifiable rather than false.
      // Refusing it would push agents toward the unchecked branch, which is the wrong incentive.
      if (!isBlockerKind(exhaustion.forBlockerKind)) return { holds: true, checked: false };
      const owners = ownersFor(chart, exhaustion.forBlockerKind);
      if (owners.length > 0) {
        return {
          holds: false,
          reason: `'${exhaustion.forBlockerKind}' has an owner here — ask ${owners.map((o) => o.id).join(" or ")} first`,
        };
      }
      return { holds: true, checked: true };
    }
    case "owners_could_not_resolve": {
      const unknown = exhaustion.askedHatIds.filter((id) => chart.byId.get(id) === undefined);
      if (unknown.length > 0) {
        return { holds: false, reason: `no such hat in this organization: ${unknown.join(", ")}` };
      }
      return { holds: true, checked: true };
    }
    case "outside_org_authority":
      // HONESTLY UNCHECKED. Whether a decision belongs to this organization is not a fact its own
      // chart contains, and a check that returned true here would be a check that cannot fail.
      return { holds: true, checked: false };
  }
}

/** A raise as an org event, so it lands in the one log everything else lands in. */
export function blockerEvent(blocker: RaisedBlocker, eventId: string): OrgEvent {
  return {
    id: eventId,
    kind: OrgEventKind.EscalationDecision,
    atMs: blocker.atMs,
    subjectId: blocker.blocking,
    decision: `raised to a person: ${blocker.why}`,
    actorHatId: blocker.byHatId,
    supervisorChain: [],
    evidenceRefs: [`human-blocker/${blocker.blockerId}`],
    // THE WHOLE BLOCKER, not just a sentence about it. Without this the log records that somebody
    // got stuck and loses what they were stuck on, which makes the raise unanswerable by the one
    // reader that matters — the person on the other end.
    fact: { kind: "blocker_raised", blocker },
  };
}

/** The answer to a blocker, if a person has given one. Keyed by the blocker's own id. */
export function answerFor(blockerId: string, actions: readonly HumanAction[]): HumanAction | undefined {
  // LAST ANSWER WINS: a person who answers twice has changed their mind, and the later word is the
  // one they meant. Ordered by the action's own clock, never by read order.
  const answers = actions
    .filter((a) => a.kind === HumanActionKind.AnswerBlocker && a.subjectId === blockerId)
    .sort((x, y) => (x.atMs === y.atMs ? (x.actionId < y.actionId ? -1 : 1) : x.atMs - y.atMs));
  return answers[answers.length - 1];
}

/**
 * The blockers still waiting on a person — DERIVED from what was raised and what was answered.
 *
 * Derived rather than stored for the reason everything here is: a stored "open" flag and the answer
 * queue can disagree, and the disagreement surfaces as a person being asked something they already
 * answered.
 */
export function openBlockers(
  raised: readonly RaisedBlocker[],
  actions: readonly HumanAction[],
): readonly RaisedBlocker[] {
  return raised.filter((b) => answerFor(b.blockerId, actions) === undefined);
}

/** The blockers a person has answered, with the answer. What the run consumes to get unstuck. */
export function answeredBlockers(
  raised: readonly RaisedBlocker[],
  actions: readonly HumanAction[],
): readonly { readonly blocker: RaisedBlocker; readonly answer: HumanAction }[] {
  const out: { blocker: RaisedBlocker; answer: HumanAction }[] = [];
  for (const blocker of raised) {
    const answer = answerFor(blocker.blockerId, actions);
    if (answer !== undefined) out.push({ blocker, answer });
  }
  return out;
}
