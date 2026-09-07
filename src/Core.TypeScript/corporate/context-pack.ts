/**
 * context-pack.ts — what a hat wakes up knowing, and what it is told it does NOT know.
 *
 * ── THE DOC ──────────────────────────────────────────────────────────────────
 * `OBSERVE_CONTEXT_PACKS.md` §Thesis:
 *
 *   > The frontier model vendors have largely solved raw intelligence. The unsolved problem for an
 *   > autonomous organization is **context**: which facts, policies, decisions, memories, documents,
 *   > traces, and graph neighborhoods should a specific agent wearing a specific hat see right now?
 *   >
 *   > The pack is **not a search dump**. It is a bounded, policy-checked, hat-scoped slice with
 *   > omissions, contradictions, stale inputs, lifecycle blockers, and curation trace made visible.
 *
 * ── THE NON-NEGOTIABLES, AND WHICH ONES ARE MECHANICAL HERE ──────────────────
 * The doc's list reads like this register's own discipline, so four of them are enforced rather
 * than described:
 *
 *   1. *"A hat-holder must never wake up to an empty implicit context. If no context builder is
 *      wired, the surface returns a DEGRADED pack with an explicit omission."* — `degraded` is
 *      DERIVED from the omissions, never passed in. A caller cannot claim a full pack it did not
 *      build, which is the same rule this register applies to `replayable` and to fidelity.
 *   2. *"Context is scoped by hat authority and current work."* — the scope is derived from the
 *      hat's level in the chart. A caller does not choose what it may see.
 *   3. *"Every active hat receives a deterministic communication brief BEFORE any model-backed
 *      synthesis."* — the brief is a required field, built from the chart, and present in a
 *      degraded pack too. It is the one thing that cannot be missing.
 *   4. *"Omissions are first-class."* — they are a field, not a log line, and they are what makes
 *      the difference between a thin pack and a pack that knows it is thin.
 *
 * ── THE FAILURE THIS SHAPE REFUSES ───────────────────────────────────────────
 * A pack with three items and no omissions and a pack with three items and nine omissions look
 * identical to an agent that only reads `items`. The first is an organization with little to say;
 * the second is one that could not reach most of what it holds. Treating them the same is how an
 * agent confidently acts on a quarter of the picture — and it will not know, because a search dump
 * has no way to report what it failed to find.
 */

import type { EvidenceRef } from "./discussion-anchor";
import { LEVEL_RANK, type OrgChart } from "./org-chart";
import { buildHatCommunicationBrief, type HatCommunicationBrief } from "./supervisor-signal";

/**
 * How wide this hat's context is.
 *
 * DERIVED from the level, following the doc: *"Directors see portfolio, initiative, blocker,
 * staffing, policy, and blast-radius context. Individual contributors see the work item, acceptance
 * criteria, prompt-flow instructions, repo-specific docs, and directly relevant decisions."*
 */
export const ContextScope = {
  /** Executive and C-suite: the whole portfolio. */
  Portfolio: "portfolio",
  /** Director and manager: initiatives, staffing, blockers, policy. */
  Initiative: "initiative",
  /** Lead and individual contributor: the work item and what bears on it. */
  WorkItem: "work_item",
} as const;

export type ContextScope = (typeof ContextScope)[keyof typeof ContextScope];

export function scopeFor(chart: OrgChart, hatId: string): ContextScope | undefined {
  const hat = chart.byId.get(hatId);
  if (hat === undefined) return undefined;
  if (LEVEL_RANK[hat.level] <= LEVEL_RANK.c_suite) return ContextScope.Portfolio;
  if (LEVEL_RANK[hat.level] <= LEVEL_RANK.manager) return ContextScope.Initiative;
  return ContextScope.WorkItem;
}

/** The kinds of thing a pack can carry. Typed so an agent reasons over them without parsing prose. */
export const ContextItemKind = {
  WorkItem: "work_item",
  AcceptanceCriteria: "acceptance_criteria",
  Decision: "decision",
  Policy: "policy",
  Blocker: "blocker",
  Document: "document",
  MemoryPointer: "memory_pointer",
  Artifact: "artifact",
} as const;

export type ContextItemKind = (typeof ContextItemKind)[keyof typeof ContextItemKind];

export interface ContextItem {
  readonly kind: ContextItemKind;
  readonly id: string;
  readonly summary: string;
  /**
   * WHERE THIS CAME FROM. Required, and it is what makes a pack replayable.
   *
   * An item with no pointer is something the pack asserts and cannot support — the same thing a
   * gate approval with no evidence is, one layer out. `replayableOf` derives replayability from
   * these rather than accepting a claim about it.
   */
  readonly source: EvidenceRef;
}

/** The doc's own list of what must be visible when it is missing. */
export const OmissionKind = {
  /** Nothing was wired to build this pack. The degraded case the doc names first. */
  NoBuilderWired: "no_builder_wired",
  /** The hat's authority does not reach it. */
  AccessDenied: "access_denied",
  /** Present, and older than the policy allows. */
  StaleDocument: "stale_document",
  /** Two sources disagree and nobody has resolved it. */
  UnresolvedContradiction: "unresolved_contradiction",
  /** The handbook this work needs does not exist. */
  MissingHandbook: "missing_handbook",
  /** Memory could not be reached. */
  MemoryUnavailable: "memory_unavailable",
} as const;

export type OmissionKind = (typeof OmissionKind)[keyof typeof OmissionKind];

export interface Omission {
  readonly kind: OmissionKind;
  /** What is missing, in the caller's own ids. */
  readonly about: string;
  readonly why: string;
}

export interface ContextPack {
  readonly hatId: string;
  readonly scope: ContextScope;
  /**
   * The deterministic brief, BEFORE any synthesis.
   *
   * Required, and present in a degraded pack too. Everything else here can be missing; this cannot,
   * because a hat that does not know its own duty, route and evidence requirements has nothing to
   * be careful with.
   */
  readonly brief: HatCommunicationBrief;
  readonly items: readonly ContextItem[];
  readonly omissions: readonly Omission[];
  /**
   * DERIVED, never declared: is anything missing?
   *
   * A caller cannot hand back a pack that claims to be complete. The whole point of the field is
   * that an agent reading only `items` cannot tell a thin organization from an unreachable one, so
   * the answer has to travel with the pack and cannot be an opinion.
   */
  readonly degraded: boolean;
}

export type PackResult =
  | { readonly ok: true; readonly pack: ContextPack }
  | { readonly ok: false; readonly reason: string };

export interface PackRequest {
  readonly hatId: string;
  /** Who the resource authority is — the brief routes `RequestResource` there. */
  readonly resourceAuthorityHatId: string;
  /** Everything the deterministic slice found. Absent means nothing was wired. */
  readonly items?: readonly ContextItem[];
  /** What the retrieval knew it could not get. */
  readonly omissions?: readonly Omission[];
}

/**
 * Build one hat's pack.
 *
 * REFUSES only when the hat is not in the chart, because then there is no duty, no route and no
 * scope — there is nothing to build a pack ABOUT. Everything else degrades and says so, which is
 * the doc's first non-negotiable: a hat must never wake to an empty implicit context.
 */
export function buildContextPack(chart: OrgChart, request: PackRequest): PackResult {
  const scope = scopeFor(chart, request.hatId);
  const brief = buildHatCommunicationBrief(chart, request.hatId, request.resourceAuthorityHatId);
  if (scope === undefined || brief === undefined) {
    return { ok: false, reason: `unknown hat '${request.hatId}'` };
  }

  const omissions = [...(request.omissions ?? [])];
  if (request.items === undefined) {
    // THE DEGRADED PACK. Not an error and not an empty success: the hat still gets its brief, and
    // it is told in the pack itself that nothing else was built. Returning an empty `items` with no
    // omission would be the silent version, and an agent reading it would proceed as though the
    // organization had nothing to say.
    omissions.push({
      kind: OmissionKind.NoBuilderWired,
      about: request.hatId,
      why: "no deterministic context retrieval was wired for this surface",
    });
  }

  const items = ordered(request.items ?? []);
  return {
    ok: true,
    pack: {
      hatId: request.hatId,
      scope,
      brief,
      items,
      omissions: orderedOmissions(omissions),
      degraded: omissions.length > 0,
    },
  };
}

/**
 * Can this pack be rebuilt from what it points at?
 *
 * DERIVED from the items, not declared by whoever built it. A pack is replayable when every item
 * names a source AND nothing was omitted — because an omission is precisely a part of the world the
 * pack could not reach, so replaying it would produce a different pack.
 */
export function replayableOf(pack: ContextPack): boolean {
  return pack.omissions.length === 0 && pack.items.every((i) => i.source.ref.trim() !== "");
}

/** Items of one kind. */
export function itemsOfKind(pack: ContextPack, kind: ContextItemKind): readonly ContextItem[] {
  return pack.items.filter((i) => i.kind === kind);
}

/** ORDINAL by kind then id, so the same organization packs the same way twice. */
function ordered(items: readonly ContextItem[]): readonly ContextItem[] {
  return [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  });
}

function orderedOmissions(omissions: readonly Omission[]): readonly Omission[] {
  return [...omissions].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.about === b.about) return 0;
    return a.about < b.about ? -1 : 1;
  });
}
