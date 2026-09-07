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
import { isMergeItem, itemIdOf, rowFor } from "../action-reconciliation";

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
  /**
   * Can this hat EXECUTE an offered work item (`do_item`, and therefore `self_claim`)?
   *
   * Separate from `canCreateWork` on purpose. Doing work and creating work are different
   * authorities, and conflating them produced a hierarchy in which the individual contributor —
   * the tier that exists to do the work — could not do any: `do_item` was gated on
   * `canCreateWork`, which is `false` at that level, so an IC's menu contained only free modes.
   * A corporation in which the ICs may not work is not a hierarchy, it is a caste system.
   *
   * True at every level including IC. Merges remain separately gated by `canMerge`.
   */
  readonly canDoWork: boolean;
  /**
   * Can this hat create NEW work items / PRs?
   *
   * HONEST NOTE: after `canDoWork` took over `do_item`, no action in the current 16-slot grammar
   * is gated on this bit — the grammar has no "create a work item" action (`decompose` creates
   * sub-tasks and is gated by `canDecompose`). It is kept because the distinction is real and the
   * grammar is expected to grow one, and it is called out here rather than left as a silently
   * dead field. Wiring it to an action is the grammar owner's call, not this filter's.
   */
  readonly canCreateWork: boolean;
  /** Can this hat decompose items? (always true for lead+) */
  readonly canDecompose: boolean;
  /** Can this hat access the operator channel? (c_suite+ only) */
  readonly canAccessOperator: boolean;
  /** Can this hat edit the action grammar? (director+ only) */
  readonly canEditGrammar: boolean;
  /**
   * Can this hat pull other hats into a room?
   *
   * Its own bit rather than a reuse of `canCreateWork`, because convening spends a resource that
   * belongs to SOMEONE ELSE — the attendees' calendars. An IC may do work, ask for information and
   * answer a review without ever being able to book three directors into a half-hour; those are
   * different kinds of authority and one bit could not tell them apart.
   *
   * Lead and above. An IC that needs a room asks for one — `request_information` is never gated,
   * so the path out is always open.
   */
  readonly canConvene: boolean;
}

// ─── Default authority by level ─────────────────────────────────────

const AUTHORITY_BY_LEVEL: Record<HatLevel, HatAuthority> = {
  executive_board: { level: "executive_board", canMerge: true, canDoWork: true, canCreateWork: true, canDecompose: true, canAccessOperator: true, canEditGrammar: true , canConvene: true },
  c_suite: { level: "c_suite", canMerge: true, canDoWork: true, canCreateWork: true, canDecompose: true, canAccessOperator: true, canEditGrammar: true , canConvene: true },
  director: { level: "director", canMerge: true, canDoWork: true, canCreateWork: true, canDecompose: true, canAccessOperator: false, canEditGrammar: true , canConvene: true },
  manager: { level: "manager", canMerge: true, canDoWork: true, canCreateWork: true, canDecompose: true, canAccessOperator: false, canEditGrammar: false , canConvene: true },
  lead: { level: "lead", canMerge: false, canDoWork: true, canCreateWork: true, canDecompose: true, canAccessOperator: false, canEditGrammar: false , canConvene: true },
  // canDoWork is TRUE here and canCreateWork is FALSE: an IC executes offered work but does not
  // open new work. That distinction is the entire reason the two bits are separate.
  individual_contributor: { level: "individual_contributor", canMerge: false, canDoWork: true, canCreateWork: false, canDecompose: false, canAccessOperator: false, canEditGrammar: false , canConvene: false },
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

/**
 * May this hat act on this item at all? One definition, shared by `do_item` and `self_claim`, so
 * the two can never drift apart — the drift is what let a claim outrank the execution it promises.
 */
function canExecuteItem(itemId: string, auth: HatAuthority): boolean {
  // A merge is a distinct authority, not a harder kind of work.
  if (isMergeItem(itemId)) return auth.canMerge;
  return auth.canDoWork;
}

/**
 * The gate is a LOOKUP, not a switch on the action itself.
 *
 * This used to be a `switch (action.kind)` ending in `default: return true` — which meant a kind
 * nobody had thought about was authorized at every hat level, silently. Reading the gate out of
 * `ACTION_RECONCILIATION` makes a new kind a COMPILE error (the table's `Record` demands a row)
 * instead of a permission.
 */
function isAuthorized(action: NextAction, auth: HatAuthority): boolean {
  const gate = rowFor(action.kind).gate;
  switch (gate) {
    // NCI: freedom is not gated. And a kind with no authority attached yet stays permitted — the
    // table names that gap (`UNGATED_KINDS`) rather than hiding it in a fall-through.
    case "never_gated":
    case "not_yet_assigned":
      return true;
    case "operator_channel":
      return auth.canAccessOperator;
    case "decompose":
      return auth.canDecompose;
    case "edit_grammar":
      return auth.canEditGrammar;
    // A review IS work, so it rides the same bit rather than inventing a second one that would
    // have to be kept in step with it.
    case "collaborate":
      return auth.canDoWork;
    case "convene":
      return auth.canConvene;
    // The action `canCreateWork` was documented as waiting for: assigning work to someone is
    // creating work for them, and an IC (`canCreateWork: false`) does not hand out tasks.
    case "assign_work":
      return auth.canCreateWork;
    case "execute_item": {
      const id = itemIdOf(action);
      return id === null ? auth.canDoWork : canExecuteItem(id, auth);
    }
  }
  return assertNeverGate(gate);
}

/** Exhaustiveness, enforced by the compiler: a new `HatGate` value fails to typecheck here. */
function assertNeverGate(x: never): never {
  throw new Error(`unhandled hat gate: ${String(x)}`);
}

// ─── Sovereign mode (no hat) ────────────────────────────────────────

/** No hat = no restrictions. All menu items pass through. */
export const SOVEREIGN: HatAuthority = {
  level: "executive_board",
  canMerge: true,
  canDoWork: true,
  canCreateWork: true,
  canDecompose: true,
  canAccessOperator: true,
  canEditGrammar: true,
  canConvene: true,
};
