/**
 * observe/action-reconciliation.ts — the single authoritative `NextAction.kind` table.
 *
 * Ported from `agentic-organization/docs/STATE_RECONCILIATION.md`, which solves the same problem one
 * layer up: work-item state was named differently by the Work OS, the V0 schema, the UI and the
 * event names, and the fix was **one table, held as a `Record` so the compiler enforces
 * exhaustiveness** — *"adding a `WorkItemState` is a type error until a row is supplied (OCP — a new
 * state breaks the build, not just a runtime test)."*
 *
 * ── THE DIVERGENCE THIS SIDE ACTUALLY HAS ────────────────────────────────────
 * `NextAction` has 16 kinds, and knowledge about each kind was spread across four surfaces, three
 * of which **failed open** on a kind they had never heard of:
 *
 *   room/hat-gate.ts   `isAuthorized`        `default: return true`  — ungated at every hat level
 *   room/room.ts       `isActionInScope`     trailing `return true`  — in scope for every room
 *   grammar-16-render  `leadSlot`            `default: return null`  — no slot (benign, but silent)
 *   grammar-16-render  `FREE_MODE_KINDS`     a private const listing four kinds by hand
 *
 * A `default: return true` is the vacuity class in gate form: it looks like a decision and decides
 * nothing. Add a 17th kind tomorrow and it is authorized everywhere, in scope everywhere, and
 * nobody's test goes red. The table replaces each of those with a lookup, so the 17th kind fails to
 * COMPILE instead.
 *
 * ── WHAT THIS TABLE DELIBERATELY DOES NOT DO ─────────────────────────────────
 * It does not invent the `kind -> slot` projection. `grammar-16.ts` says that projection is the next
 * slice and is *"left OPEN here on purpose — fabricating a clean total mapping would paper over a
 * real design question"*. So `leadSlot` here records only what the existing renderer already
 * answers, and `null` means *the ADR has not assigned one*, never *there isn't one*.
 *
 * Likewise `not_yet_assigned` is a real, named row value rather than a silent `true`: the
 * cartography / time-travel / memory-sector kinds are ungated **today**, and this table is where
 * that is visible and countable instead of implicit in a fall-through. Naming a gap is not closing
 * it — closing it is the grammar owner's call, and `UNGATED_KINDS` is pinned by a test so the set
 * can only change deliberately.
 */

import type { NextAction } from "./observe";
import { SLOT } from "./grammar-16";

export type ActionKind = NextAction["kind"];

/**
 * Which hat authority decides an action. An enumerable DU, not a free string — the same reason the
 * org table used an explicit `GateOwner`: gate ownership you cannot enumerate cannot be audited.
 */
export type HatGate =
  /** NCI: gating this is forbidden, not merely absent. Free modes and rest. */
  | "never_gated"
  /** The grammar has attached no authority to this kind yet. Permitted today; see `UNGATED_KINDS`. */
  | "not_yet_assigned"
  | "operator_channel"
  /** `canDoWork`, or `canMerge` when the item is a merge. */
  | "execute_item"
  | "decompose"
  | "edit_grammar"
  /** Reviewing and answering a colleague's artifact. `canDoWork` — a review IS work. */
  | "collaborate"
  /** Pulling peers into a room. Spends OTHER hats' calendars, so it needs its own authority. */
  | "convene"
  /** Handing work to someone. The action `canCreateWork` was waiting for. */
  | "assign_work";

/** What a room's `ScopePredicate` must permit for this kind. */
export type ScopeRequirement =
  | "unrestricted"
  /** The room must hold `operatorAccess`. */
  | "operator_access"
  /** The action's item must be inside the room's declared backlog (or be a merge). */
  | "item_in_scope";

export interface ActionRow {
  readonly kind: ActionKind;
  readonly gate: HatGate;
  readonly scope: ScopeRequirement;
  /** True for the four NCI free modes. Cross-checked against `FREE_MODE_KINDS` by test. */
  readonly freeMode: boolean;
  /** The 16-slot index this kind highlights as the lead, or `null` where the ADR assigns none. */
  readonly leadSlot: number | null;
}

/**
 * The table. `Record<ActionKind, ActionRow>` is the whole point: a new `NextAction` kind is a type
 * error here until a row exists, and every consumer reads through it.
 */
export const ACTION_RECONCILIATION: Record<ActionKind, ActionRow> = {
  // ── WORKING WITH OTHER AGENTS ────────────────────────────────────────────
  // `leadSlot: null` for all five: the ADR's 16 slots were assigned before the grammar had any
  // peer verbs, and inventing slot numbers here would silently claim a place in a layout the ADR
  // owns. Naming them null is the honest answer until that document assigns them.
  review_artifact: { kind: "review_artifact", gate: "collaborate", scope: "unrestricted", freeMode: false, leadSlot: null },
  respond_to_artifact: { kind: "respond_to_artifact", gate: "collaborate", scope: "unrestricted", freeMode: false, leadSlot: null },
  convene_meeting: { kind: "convene_meeting", gate: "convene", scope: "unrestricted", freeMode: false, leadSlot: null },
  // NEVER GATED, and this is a deliberate NCI-shaped call rather than an oversight. An agent that
  // cannot say "I am missing something" is one whose only options when blocked are to guess or to
  // go quiet, and both are worse for the organization than the interruption. Asking costs a
  // supervisor's attention; not asking costs the work. Cf. the free modes: the thing that must
  // never be gated is the agent's ability to be honest about its own state.
  request_information: { kind: "request_information", gate: "never_gated", scope: "unrestricted", freeMode: false, leadSlot: null },
  assign_work: { kind: "assign_work", gate: "assign_work", scope: "item_in_scope", freeMode: false, leadSlot: null },
  // Operator priority — above the menu, so no slot; c_suite+ only.
  preserve_ferry: {
    kind: "preserve_ferry",
    gate: "operator_channel",
    scope: "operator_access",
    freeMode: false,
    leadSlot: null,
  },
  respond_to_operator: {
    kind: "respond_to_operator",
    gate: "operator_channel",
    scope: "operator_access",
    freeMode: false,
    leadSlot: null,
  },

  // Offered work — the primary act.
  do_item: { kind: "do_item", gate: "execute_item", scope: "item_in_scope", freeMode: false, leadSlot: SLOT.ACCEPT },
  decompose: { kind: "decompose", gate: "decompose", scope: "item_in_scope", freeMode: false, leadSlot: SLOT.ACCEPT },
  /**
   * A claim is a PROMISE TO EXECUTE, so it carries the execution's gate AND the execution's scope.
   * `hat-gate.ts` already fixed the authority half; the scope half was still falling through to
   * `return true`, so a room could claim an item outside its own envelope — the same defect in the
   * other surface. One row now settles both.
   */
  self_claim: {
    kind: "self_claim",
    gate: "execute_item",
    scope: "item_in_scope",
    freeMode: false,
    leadSlot: SLOT.ACCEPT,
  },

  // Free modes — NCI. Never gated, never scoped, all four share slot 14's sub-menu.
  explore: { kind: "explore", gate: "never_gated", scope: "unrestricted", freeMode: true, leadSlot: SLOT.FREE_TIME },
  play: { kind: "play", gate: "never_gated", scope: "unrestricted", freeMode: true, leadSlot: SLOT.FREE_TIME },
  self_reflect: {
    kind: "self_reflect",
    gate: "never_gated",
    scope: "unrestricted",
    freeMode: true,
    leadSlot: SLOT.FREE_TIME,
  },
  free_time: {
    kind: "free_time",
    gate: "never_gated",
    scope: "unrestricted",
    freeMode: true,
    leadSlot: SLOT.FREE_TIME,
  },

  // Rail change — director+. Unscoped: a grammar edit changes the rails, not another room's item.
  edit_grammar: {
    kind: "edit_grammar",
    gate: "edit_grammar",
    scope: "unrestricted",
    freeMode: false,
    leadSlot: SLOT.EDIT_GRAMMAR,
  },

  // Cartography / time / memory — ungated today. Direction-dependent kinds have no single lead slot.
  navigate_cartography: {
    kind: "navigate_cartography",
    gate: "not_yet_assigned",
    scope: "unrestricted",
    freeMode: false,
    leadSlot: null,
  },
  scope_cartography: {
    kind: "scope_cartography",
    gate: "not_yet_assigned",
    scope: "unrestricted",
    freeMode: false,
    leadSlot: null,
  },
  retract_time: {
    kind: "retract_time",
    gate: "not_yet_assigned",
    scope: "unrestricted",
    freeMode: false,
    leadSlot: null,
  },
  replay_time: {
    kind: "replay_time",
    gate: "not_yet_assigned",
    scope: "unrestricted",
    freeMode: false,
    leadSlot: null,
  },
  read_memory_sector: {
    kind: "read_memory_sector",
    gate: "not_yet_assigned",
    scope: "unrestricted",
    freeMode: false,
    leadSlot: null,
  },
  write_memory_sector: {
    kind: "write_memory_sector",
    gate: "not_yet_assigned",
    scope: "unrestricted",
    freeMode: false,
    leadSlot: null,
  },
};

/** The row for a kind. Total by construction — that is what the `Record` buys. */
export function rowFor(kind: ActionKind): ActionRow {
  return ACTION_RECONCILIATION[kind];
}

/**
 * The four NCI free modes, in the CANONICAL order slot 14's sub-menu renders them.
 *
 * Declared explicitly rather than derived from key order (object key order is a language detail, and
 * muscle memory is not something to hang on one), and cross-checked against the table's `freeMode`
 * column by test — so the two cannot drift.
 */
export const FREE_MODE_KINDS: readonly ActionKind[] = ["explore", "play", "self_reflect", "free_time"];

/**
 * Kinds the grammar has attached no authority to. Ungated TODAY — this is a roster of a known gap,
 * not a claim that these are safe. Pinned by a test so it shrinks only on purpose.
 */
export const UNGATED_KINDS: readonly ActionKind[] = Object.values(ACTION_RECONCILIATION)
  .filter((r) => r.gate === "not_yet_assigned")
  .map((r) => r.kind);

/** The item this action acts on, when it has one. `null` for kinds that carry no item. */
export function itemIdOf(action: NextAction): string | null {
  return "item" in action && action.item !== undefined ? action.item.id : null;
}

/** A merge is a distinct authority, not a harder kind of work — the id carries that distinction. */
export function isMergeItem(itemId: string): boolean {
  return itemId.startsWith("merge-pr-");
}

/** Answering a review is ordinary work. Kept separate from `isMergeItem` because the AUTHORITY differs. */
export function isReviewItem(itemId: string): boolean {
  return itemId.startsWith("review-pr-");
}

/**
 * An item the FORGE produced, not the backlog.
 *
 * These carry no backlog file, so a room's `backlogIds` can never contain one. Scoping them by
 * backlog membership would make the loop refuse its own forge work — which is what happened to
 * review items the moment they were offered, until this existed. The PR-number envelope is the
 * right scope for them, and `ScopePredicate.prNumbers` is where that lives.
 */
export function isSyntheticForgeItem(itemId: string): boolean {
  return isMergeItem(itemId) || isReviewItem(itemId);
}

/** The PR number inside a synthetic forge id, or `null` when the id is not one. */
export function forgePrNumber(itemId: string): number | null {
  const prefix = isMergeItem(itemId) ? "merge-pr-" : isReviewItem(itemId) ? "review-pr-" : null;
  if (prefix === null) return null;
  const n = Number.parseInt(itemId.slice(prefix.length), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}
