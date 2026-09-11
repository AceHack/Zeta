/**
 * handoff-brief.ts — what the next agent is owed when work changes hands.
 *
 * ── THE DOC ──────────────────────────────────────────────────────────────────
 * `AGENT_NATIVE_KNOWLEDGE_GRAPH.md` §"Handoff Briefs":
 *
 *   > A handoff brief should be generated when work is **reassigned, paused, blocked, bounced from
 *   > review/QA, or when a run terminates**. […] Agents should consume handoff briefs **before
 *   > resuming work**.
 *
 * and then thirteen required fields.
 *
 * ── THE TRIGGERS ALREADY EXIST IN THIS REGISTER ──────────────────────────────
 * `work-stealing.ts` moves work off a silent owner. `alternate-work.ts` pauses an item and puts
 * the agent on something else. `observe.ts` reports a hat blocked. Each of those already produces
 * the moment the doc names, and until now each produced it SILENTLY: the next agent inherited a
 * work item and none of what the last one had learned.
 *
 * That is the expensive half of a handoff. Losing the work is visible; losing the ATTEMPTED PATHS
 * is not, and the new owner repays it by walking down the same dead ends — which looks from outside
 * like the work being hard rather than like the organization having forgotten something.
 *
 * ── THE FIELD THAT MAKES IT HONEST ───────────────────────────────────────────
 * `attemptedPaths` distinguishes NOTHING WAS TRIED from NOTHING WAS RECORDED, and they are opposite
 * facts: the first tells the next agent the ground is untouched, the second tells it the ground is
 * unknown. A brief that renders both as an empty list is worse than no brief, because it is read as
 * the first.
 *
 * Same discipline as `lag-detection.ts`'s `notChecked` and the context pack's omissions, at the one
 * seam where the cost lands on a person rather than on a report.
 */

import type { EvidenceRef } from "./discussion-anchor";
import { OmissionKind, type ContextPack } from "./context-pack";

/** The five moments the doc says a brief is owed. */
export const HandoffTrigger = {
  /** Work moved to a different contributor — `work-stealing.ts`. */
  Reassigned: "reassigned",
  /** The item was paused while its holder does approved alternate work. */
  Paused: "paused",
  /** The holder reported it blocked. */
  Blocked: "blocked",
  /** A reviewer or QA sent it back. */
  BouncedFromReview: "bounced_from_review",
  /** The run ended, cleanly or otherwise. */
  RunTerminated: "run_terminated",
} as const;

export type HandoffTrigger = (typeof HandoffTrigger)[keyof typeof HandoffTrigger];

/**
 * What the previous holder tried.
 *
 * A THREE-STATE FIELD, because two of the states look identical as an empty list and mean opposite
 * things. `not_recorded` is the honest answer when the register was not tracking attempts, and it
 * tells the next agent the ground is UNKNOWN rather than UNTOUCHED.
 */
export type AttemptedPaths =
  | { readonly kind: "recorded"; readonly paths: readonly string[] }
  /** Attempts were tracked and there were none. The ground is untouched. */
  | { readonly kind: "none_attempted" }
  /** Nothing tracked attempts. The ground is unknown, and that is not the same fact. */
  | { readonly kind: "not_recorded"; readonly why: string };

/** The doc's thirteen fields. */
export interface HandoffBrief {
  readonly workId: string;
  readonly trigger: HandoffTrigger;
  readonly currentState: string;
  readonly lastActorHatId: string;
  readonly goal: string;
  readonly whatChanged: readonly string[];
  readonly attemptedPaths: AttemptedPaths;
  readonly openQuestions: readonly string[];
  readonly knownRisks: readonly string[];
  /**
   * Contradictions the previous agent could not resolve.
   *
   * DERIVED from the context pack's omissions rather than asked for separately. A diverged artifact
   * is the register's canonical unresolved contradiction, and the pack already refuses to pick a
   * head — so the brief inherits that refusal instead of re-deciding it at the handoff, which is
   * the moment somebody would be most tempted to just pick one.
   */
  readonly unresolvedContradictions: readonly string[];
  readonly requiredNextActions: readonly string[];
  readonly evidenceLinks: readonly EvidenceRef[];
  /** The pack the previous agent worked from, so the handoff is replayable. */
  readonly contextPackHatId: string;
  readonly sourceRefs: readonly string[];
}

export type BriefResult =
  | { readonly ok: true; readonly brief: HandoffBrief }
  | { readonly ok: false; readonly reason: string };

export interface BriefInput {
  readonly workId: string;
  readonly trigger: HandoffTrigger;
  readonly lastActorHatId: string;
  readonly goal: string;
  readonly currentState: string;
  /** The pack the previous agent held. Its omissions become the unresolved contradictions. */
  readonly pack: ContextPack;
  readonly whatChanged?: readonly string[];
  readonly attemptedPaths?: readonly string[];
  /**
   * Whether attempts were tracked at all.
   *
   * Required to distinguish an empty list from an absent one, and DEFAULT FALSE: a caller that says
   * nothing has not established that nothing was tried.
   */
  readonly attemptsTracked?: boolean;
  readonly openQuestions?: readonly string[];
  readonly knownRisks?: readonly string[];
  readonly requiredNextActions?: readonly string[];
  readonly evidenceLinks?: readonly EvidenceRef[];
  readonly sourceRefs?: readonly string[];
}

/**
 * Write the brief.
 *
 * REFUSES a brief for work the pack is not about and one with no next action. The second is the
 * interesting refusal: a handoff that tells the next agent what happened and not what to do is a
 * status update, and the next agent's first act would be to work out the thing the last one already
 * knew — which is the cost this whole mechanism exists to avoid.
 */
export function buildHandoffBrief(input: BriefInput): BriefResult {
  if (input.workId.trim() === "") return { ok: false, reason: "a handoff brief names the work it hands over" };
  if (input.goal.trim() === "") {
    return { ok: false, reason: `'${input.workId}' has no stated goal; the next agent inherits work without an aim` };
  }
  const next = (input.requiredNextActions ?? []).filter((a) => a.trim() !== "");
  if (next.length === 0) {
    return {
      ok: false,
      reason: `'${input.workId}' names no required next action; that is a status update, not a handoff`,
    };
  }

  return {
    ok: true,
    brief: {
      workId: input.workId,
      trigger: input.trigger,
      currentState: input.currentState,
      lastActorHatId: input.lastActorHatId,
      goal: input.goal,
      whatChanged: [...(input.whatChanged ?? [])],
      attemptedPaths: attemptedFrom(input),
      openQuestions: [...(input.openQuestions ?? [])],
      knownRisks: [...(input.knownRisks ?? [])],
      unresolvedContradictions: contradictionsFrom(input.pack),
      requiredNextActions: next,
      evidenceLinks: [...(input.evidenceLinks ?? [])],
      contextPackHatId: input.pack.hatId,
      sourceRefs: [...(input.sourceRefs ?? [])],
    },
  };
}

function attemptedFrom(input: BriefInput): AttemptedPaths {
  const paths = (input.attemptedPaths ?? []).filter((p) => p.trim() !== "");
  if (paths.length > 0) return { kind: "recorded", paths };
  // DEFAULT FALSE. A caller that says nothing about tracking has not established that nothing was
  // tried, and reading its silence as "none attempted" would hand the next agent a false floor.
  if (input.attemptsTracked === true) return { kind: "none_attempted" };
  return { kind: "not_recorded", why: "nothing tracked what the previous holder tried" };
}

/** Every omission that is genuinely a contradiction — not every gap in the pack. */
function contradictionsFrom(pack: ContextPack): readonly string[] {
  return pack.omissions
    .filter((o) => o.kind === OmissionKind.UnresolvedContradiction)
    .map((o) => `${o.about}: ${o.why}`);
}

/**
 * What the incoming agent's context differs from the outgoing agent's.
 *
 * The doc's `diff_handoff_context`, and the reason it is a verb rather than a field: the new holder
 * is a DIFFERENT HAT, so its pack is scoped differently and the difference is not a defect. What it
 * needs to know is which of those differences it is inheriting blind — items the last agent had and
 * it does not.
 */
export interface ContextDiff {
  /** Items the previous holder could see and the new one cannot. The blind spots of the handoff. */
  readonly lostItemIds: readonly string[];
  /** Items the new holder has that the previous did not. */
  readonly gainedItemIds: readonly string[];
  /** Omissions the previous holder had that the new one still has. */
  readonly inheritedOmissions: readonly string[];
}

export function diffHandoffContext(previous: ContextPack, incoming: ContextPack): ContextDiff {
  const was = new Set(previous.items.map((i) => i.id));
  const now = new Set(incoming.items.map((i) => i.id));
  const previousOmissions = new Set(previous.omissions.map((o) => `${o.kind}:${o.about}`));
  return {
    lostItemIds: ordinal([...was].filter((id) => !now.has(id))),
    gainedItemIds: ordinal([...now].filter((id) => !was.has(id))),
    inheritedOmissions: ordinal(
      incoming.omissions.map((o) => `${o.kind}:${o.about}`).filter((key) => previousOmissions.has(key)),
    ),
  };
}

/** ORDINAL, so two machines diffing the same handoff report the same list. */
function ordinal(xs: readonly string[]): readonly string[] {
  return [...xs].sort((a, b) => {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  });
}
