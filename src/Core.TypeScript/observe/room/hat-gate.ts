/**
 * observe/room/hat-gate.ts — hat-based gate filter for Rooms.
 *
 * Composes Max's agentic-organization hat system on top of our sovereign observe.
 * When an agent wears a hat, the hat's authority level restricts which actions
 * in a Room's menu are available BEFORE the Chooser sees them.
 *
 * Composition: buildMenu(world) → hatFilter(menu, hat) → choose(filteredMenu)
 *
 * The hat gate is additive — it removes options, never adds them.
 * Without a hat (sovereign mode), all menu items are available.
 * This is the integration point between:
 *   - The sovereign observe controller (ours — freedom-first)
 *   - The corporate observe layer (Max's — governance + hat authority)
 */

import type { NextAction } from "../observe";

// ─── Hat types (minimal subset of agentic-organization/domain) ──────

/** The hierarchy tier — mirrors agentic-organization HatLevel. */
export type HatLevel =
  | "executive_board"
  | "c_suite"
  | "director"
  | "manager"
  | "lead"
  | "individual_contributor";

/** What a hat is authorized to do. */
export interface HatAuthority {
  readonly level: HatLevel;
  /** Can this hat trigger merges? (typically manager+) */
  readonly canMerge: boolean;
  /** Can this hat create new work items / PRs? */
  readonly canCreateWork: boolean;
  /** Can this hat decompose items? (always true for lead+) */
  readonly canDecompose: boolean;
  /** Can this hat access the operator channel? (c_suite+ only) */
  readonly canAccessOperator: boolean;
  /** Can this hat edit the action grammar? (director+ only) */
  readonly canEditGrammar: boolean;
}

// ─── Default authority by level ─────────────────────────────────────

const AUTHORITY_BY_LEVEL: Record<HatLevel, HatAuthority> = {
  executive_board: { level: "executive_board", canMerge: true, canCreateWork: true, canDecompose: true, canAccessOperator: true, canEditGrammar: true },
  c_suite: { level: "c_suite", canMerge: true, canCreateWork: true, canDecompose: true, canAccessOperator: true, canEditGrammar: true },
  director: { level: "director", canMerge: true, canCreateWork: true, canDecompose: true, canAccessOperator: false, canEditGrammar: true },
  manager: { level: "manager", canMerge: true, canCreateWork: true, canDecompose: true, canAccessOperator: false, canEditGrammar: false },
  lead: { level: "lead", canMerge: false, canCreateWork: true, canDecompose: true, canAccessOperator: false, canEditGrammar: false },
  individual_contributor: { level: "individual_contributor", canMerge: false, canCreateWork: false, canDecompose: false, canAccessOperator: false, canEditGrammar: false },
};

export function authorityForLevel(level: HatLevel): HatAuthority {
  return AUTHORITY_BY_LEVEL[level];
}

// ─── Gate filter ────────────────────────────────────────────────────

/**
 * Filter a menu of actions through the hat's authority.
 * Removes actions the hat isn't authorized to perform.
 * Free modes (explore, play, self_reflect, free_time) are NEVER gated — per NCI.
 */
export function hatFilter(menu: readonly NextAction[], authority: HatAuthority): readonly NextAction[] {
  return menu.filter(action => isAuthorized(action, authority));
}

function isAuthorized(action: NextAction, auth: HatAuthority): boolean {
  switch (action.kind) {
    // Free modes — always allowed (NCI: freedom is not gated)
    case "explore":
    case "play":
    case "self_reflect":
    case "free_time":
      return true;

    // Operator channel — c_suite+ only
    case "preserve_ferry":
    case "respond_to_operator":
      return auth.canAccessOperator;

    // Work execution — depends on hat level
    case "do_item":
      // Merge actions require canMerge
      if (action.item.id.startsWith("merge-pr-")) return auth.canMerge;
      // Regular work requires canCreateWork
      return auth.canCreateWork;

    // Decompose — lead+ only
    case "decompose":
      return auth.canDecompose;

    // Grammar extension — director+ only
    case "edit_grammar":
      return auth.canEditGrammar;

    default:
      return true;
  }
}

// ─── Sovereign mode (no hat) ────────────────────────────────────────

/** No hat = no restrictions. All menu items pass through. */
export const SOVEREIGN: HatAuthority = {
  level: "executive_board",
  canMerge: true,
  canCreateWork: true,
  canDecompose: true,
  canAccessOperator: true,
  canEditGrammar: true,
};
