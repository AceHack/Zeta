/**
 * Workflow-engine universal action grammar.
 *
 * Faithful port of `src/Core.TypeScript/workflow-engine/types.ts`
 * (Merge1 §05): the `ActionGate` / `ActionClass` / `Action` /
 * `TickCyclePattern` / `WorkflowState` / `Tick` substrate plus Otto's
 * 5-Mods validation and the trajectory-push-vs-PR-review discriminator.
 *
 * The donor's `ActionClass` is renamed `WorkflowActionClass` here because
 * `hat-guardrails.ts` already exports an unrelated `ActionClass`
 * (hat tool-bundle taxonomy). The donor's throw-on-violation validators
 * are re-expressed as `Result`-returning functions per MP-7
 * (result-over-exception); the throwing variants are preserved for
 * fail-fast engine-init callers.
 */

import type { FourCornerOwnership } from "./four-corner-ownership.ts";

/**
 * Action gate per Mod 4 — append-only-vs-PR discriminator IN the grammar.
 * Each action declares whether it lands via direct append-only push OR via
 * PR-gated review.
 */
export type ActionGate =
  | "append-only" // state-machine-internal transitions; direct push
  | "pr-gated"; // cross-cutting substrate (rules, public APIs); PR review required

/**
 * Action class — universal action grammar surface (Otto's 5 mods):
 *   - Mod 1: escape-hatch action in every state
 *   - Mod 2: grammar-extension is itself an action (first-class transition)
 *   - Mod 5: contributable menu-generation
 */
export type WorkflowActionClass =
  | "transition"
  | "escape-hatch"
  | "grammar-extension"
  | "menu-contribution"
  | "operator-decision"
  | "agent-decision";

/**
 * Action — the universal-action-grammar atom.
 *
 * Per asymmetric-authorship: the action AUTHORS its own TOutFeedback
 * discriminator-channel via the `feedbackVariants` set.
 */
export interface Action {
  readonly id: string;
  readonly class: WorkflowActionClass;
  readonly gate: ActionGate;
  readonly label: string;
  readonly description: string;
  readonly composesWith: ReadonlyArray<string>;
  readonly feedbackVariants: ReadonlyArray<string>;
}

/**
 * Tick cycle pattern — how the room's tick loop is structured.
 */
export type TickCyclePattern =
  | "observe-simulate-choose-emit"
  | "move-next-named-function"
  | "discriminated-union-surface"
  | "ople-primitives";

/**
 * Workflow state node — a node in the workflow-engine state machine.
 */
export interface WorkflowState {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly tickCyclePattern: TickCyclePattern;
  readonly availableActions: ReadonlyArray<string>; // Action.id references
  readonly composesWith: ReadonlyArray<string>;
}

/**
 * Tick — one cycle of the workflow-engine agent loop.
 */
export interface Tick<TIn, TOut, TOutFeedback, TInFeedback> {
  readonly state: WorkflowState;
  readonly ownership: FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>;
  readonly chosenAction?: Action;
  readonly timestamp: string; // ISO 8601
}

/**
 * Validation result per MP-7 (result-over-exception). Mirrors the
 * `observe-work-item.ts` `{ outcome }` discriminator convention.
 */
export type ValidationResult =
  | { readonly outcome: "ok" }
  | { readonly outcome: "feedback"; readonly feedback: string };

/**
 * Validate Mod 1 (escape-hatch in every state).
 *
 * A state must reference at least one action, and at least one of those
 * actions must be an `escape-hatch`. Port of the donor
 * `validateStateOtto5Mods`, returning a `Result` instead of throwing.
 */
export function validateStateOtto5Mods(
  state: WorkflowState,
  actionCatalog: ReadonlyArray<Action>,
): ValidationResult {
  const stateActions = state.availableActions
    .map((id) => actionCatalog.find((a) => a.id === id))
    .filter((a): a is Action => a !== undefined);
  if (stateActions.length === 0) {
    return { outcome: "feedback", feedback: `state ${state.id} references no actions found in catalog` };
  }
  const hasEscapeHatch = stateActions.some((a) => a.class === "escape-hatch");
  if (!hasEscapeHatch) {
    return { outcome: "feedback", feedback: `state ${state.id} violates Mod 1 — no escape-hatch action in availableActions` };
  }
  return { outcome: "ok" };
}

/**
 * Validate catalog-level invariants:
 *   - all action ids are unique
 *   - Mod 2: catalog includes at least one grammar-extension action
 *   - every state references only defined action ids
 *   - every state satisfies Mod 1 (escape-hatch present)
 *
 * Port of the donor `validateCatalog`, returning a `Result`.
 */
export function validateCatalog(
  actionCatalog: ReadonlyArray<Action>,
  states: ReadonlyArray<WorkflowState>,
): ValidationResult {
  const ids = new Set<string>();
  for (const a of actionCatalog) {
    if (ids.has(a.id)) {
      return { outcome: "feedback", feedback: `duplicate action id in catalog: ${a.id}` };
    }
    ids.add(a.id);
  }
  const hasGrammarExtension = actionCatalog.some((a) => a.class === "grammar-extension");
  if (!hasGrammarExtension) {
    return { outcome: "feedback", feedback: "catalog violates Mod 2 — no grammar-extension action present" };
  }
  const stateIds = new Set<string>();
  for (const s of states) {
    if (stateIds.has(s.id)) {
      return { outcome: "feedback", feedback: `duplicate state id: ${s.id}` };
    }
    stateIds.add(s.id);
    for (const aId of s.availableActions) {
      if (!ids.has(aId)) {
        return { outcome: "feedback", feedback: `state ${s.id} references unknown action: ${aId}` };
      }
    }
  }
  for (const s of states) {
    const modResult = validateStateOtto5Mods(s, actionCatalog);
    if (modResult.outcome === "feedback") {
      return modResult;
    }
  }
  return { outcome: "ok" };
}

/**
 * ReviewLevel — discriminated union for the trajectory-push-vs-PR-review
 * lifecycle DU. Each action's required review treatment.
 */
export type ReviewLevel =
  | "trajectory-push"
  | "pr-review-light"
  | "pr-review-full"
  | "operator-required";

/**
 * `determineReviewLevel` — maps an Action to its required ReviewLevel.
 * Exhaustive over `WorkflowActionClass × ActionGate`; faithful port of
 * the donor discriminator.
 */
export function determineReviewLevel(action: Action): ReviewLevel {
  switch (action.class) {
    case "operator-decision":
      return "operator-required";
    case "escape-hatch":
      return "pr-review-light";
    case "grammar-extension":
      return "pr-review-full";
    case "menu-contribution":
      return action.gate === "append-only" ? "trajectory-push" : "pr-review-light";
    case "transition":
      return action.gate === "append-only" ? "trajectory-push" : "pr-review-full";
    case "agent-decision":
      return action.gate === "append-only" ? "trajectory-push" : "pr-review-light";
  }
}

/**
 * Seed catalog — minimal scaffold demonstrating the 5 mods (port of the
 * donor `SEED_ACTION_CATALOG`).
 */
export const SEED_ACTION_CATALOG: ReadonlyArray<Action> = [
  {
    id: "advance",
    class: "transition",
    gate: "append-only",
    label: "advance",
    description: "standard forward state transition",
    composesWith: [],
    feedbackVariants: ["Advanced", "BlockedOnGate", "InvalidTransition"],
  },
  {
    id: "escape-hatch",
    class: "escape-hatch",
    gate: "append-only",
    label: "propose-out-of-grammar-action",
    description: "Mod 1 — observed pattern not fitting any offered action; propose what should fit",
    composesWith: [],
    feedbackVariants: ["ProposalLogged", "PromotedToCatalog"],
  },
  {
    id: "grammar-extend",
    class: "grammar-extension",
    gate: "pr-gated",
    label: "extend-action-grammar",
    description: "Mod 2 — propose new action as first-class grammar member; requires PR review",
    composesWith: [],
    feedbackVariants: ["GrammarExtensionProposed", "GrammarExtensionMerged", "GrammarExtensionRejected"],
  },
  {
    id: "menu-contribute",
    class: "menu-contribution",
    gate: "append-only",
    label: "contribute-state-menu-entry",
    description: 'Mod 5 — append-only "at state X also offer action W"',
    composesWith: [],
    feedbackVariants: ["MenuEntryAppended", "DuplicateEntry"],
  },
];

/**
 * Seed states — minimal scaffold (port of the donor `SEED_STATES`).
 */
export const SEED_STATES: ReadonlyArray<WorkflowState> = [
  {
    id: "initial",
    label: "Initial state",
    description: "agent-loop entry point",
    tickCyclePattern: "discriminated-union-surface",
    availableActions: ["advance", "escape-hatch", "menu-contribute"],
    composesWith: [],
  },
  {
    id: "advancing",
    label: "Advancing state",
    description: "agent in active execute → CYOA loop",
    tickCyclePattern: "discriminated-union-surface",
    availableActions: ["advance", "escape-hatch", "menu-contribute", "grammar-extend"],
    composesWith: [],
  },
];
