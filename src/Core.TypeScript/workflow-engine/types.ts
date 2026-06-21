/**
 * src/Core.TypeScript/workflow-engine/types.ts
 *
 * 081KSKBP80008QG0R000B3Y19A.5 — workflow engine agent-loop PoC scaffold (TS-side per
 * zeta-ships-with-skills-immediate-value.md; F# crystallization
 * tracked separately as 081KSKBP80008QG0R000B3Y19A.1 + 081KSKBP80008QG0R000B3Y19A.4)
 *
 * Declarative type substrate for the workflow engine v1 spec:
 *   - Otto's 5 modifications baked in as type-level invariants
 *   - Four-corner ownership (TIn / TInFeedback / TOut / TOutFeedback)
 *     per .claude/rules/asymmetric-authorship-substrate-entity-defines-
 *     consent-channel-recipient-acknowledges.md (PR #5516 substrate)
 *   - Hook point for Mika's "clean minimal tick" spec integration
 *     (the cycle pattern — whether Observe/Simulate/Choose/Emit OR
 *     move-next OR DU-as-surface — is INTEGRATION_PENDING; declared
 *     as TickCyclePattern variant set so Mika's spec can extend the
 *     union when forwarded)
 *
 * Composes with:
 *   - 081KSKBP80008QG0R000B3Y19A row (workflow engine v1 canonical design)
 *   - 081KSKBP80008QG0R000B3Y19A.1..0.21 sub-rows
 *   - 081KSNY2Z0008QG0R0017JSTGD + 081KSNY2Z0008QG0R000E5KTPX (fast-lane + folders-not-branches)
 *   - 081KSNY2Z0008QG0R0034FR5FG + 081KSNY2Z0008QG0R001DFZK4V (ASAP cluster + Zeta-native review)
 *   - asymmetric-authorship rule (four-corner ownership)
 *   - ople-primitives-surface-t-and-tfeedback rule (OPLE+TFeedback)
 *   - monad-propagation-pattern-cross-language-substrate-shape rule
 *   - function-is-tiny-control-flow-generator-ocp-applied-to-control-flow rule
 *   - forgetting-costs-energy-remembering-is-cheap-landauer-bounded
 *     (Signal 2 rule shipped PR #5727; axiom-preservation discipline)
 *
 * PoC scope (this file): declarative type substrate ONLY. Runtime
 * dispatcher in `cli.ts`. State persistence (081KSNY2Z0008QG0R001K6HJ7Z), grammar
 * parser/composer (081KSKBP80008QG0R000B3Y19A.3), F# 4-corner monad runtime (081KSKBP80008QG0R000B3Y19A.4),
 * full agent-loop runtime (081KSKBP80008QG0R000B3Y19A.5 phase 2) all deferred to operator-
 * authorized follow-up work.
 */

/**
 * Action gate per Mod 4 — append-only-vs-PR discriminator IN the grammar.
 * Each action declares whether it lands via direct append-only push
 * OR via PR-gated review.
 */
export type ActionGate =
  | "append-only" // state-machine-internal transitions; direct push
  | "pr-gated"; // cross-cutting substrate (rules, public APIs); PR review required

/**
 * Action class — universal action grammar surface.
 * Per Otto's 5 modifications (081KSKBP80008QG0R000B3Y19A):
 *   - Mod 1: escape-hatch action in every state
 *   - Mod 2: grammar-extension is itself an action (first-class state transition)
 *   - Mod 5: contributable menu-generation (anyone can append-only append "at state X, also offer action W")
 */
export type ActionClass =
  | "transition" // standard state-machine transition
  | "escape-hatch" // Mod 1: "I observed pattern not fitting any offered action; here's what I propose"
  | "grammar-extension" // Mod 2: propose new action; first-class
  | "menu-contribution" // Mod 5: append-only contribute "at state X also offer W"
  | "operator-decision" // operator-only authority (ban-if applies)
  | "agent-decision"; // agent-side authority within bounds

/**
 * Action — the universal-action-grammar atom.
 *
 * Per asymmetric-authorship rule: the action AUTHORS its own
 * TOutFeedback discriminator-channel via the `feedback` variant set.
 */
export interface Action {
  readonly id: string;
  readonly class: ActionClass;
  readonly gate: ActionGate;
  readonly label: string;
  readonly description: string;
  readonly composesWith: ReadonlyArray<string>;
  readonly feedbackVariants: ReadonlyArray<string>; // declares the substrate-entity's authorial feedback channel
}

/**
 * Tick cycle pattern — INTEGRATION_PENDING for Mika's "clean minimal
 * tick" spec.
 *
 * Per operator + Mika substrate-engineering thread 2026-05-28: the
 * cycle pattern (whether Observe/Simulate/Choose/Emit cycle OR
 * older move-next-named-function OR newer DU-as-surface) is in
 * active substrate-engineering. The PoC scaffold declares the union
 * with the patterns surfaced so far; Mika's spec extends the union
 * when forwarded.
 *
 * Per .claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-
 * asymmetric-authorship-at-framework-primitive-scope.md: Observe /
 * Persist / Limit / Emit are the canonical 4 OPLE primitives at
 * framework-primitive scope. The tick-cycle pattern composes with
 * but is distinct from the OPLE substrate.
 */
export type TickCyclePattern =
  | "observe-simulate-choose-emit" // operator-named cycle pattern
  | "move-next-named-function" // older pattern; Mika says basically gone
  | "discriminated-union-surface" // Mika's latest direction (per 2026-05-28 question)
  | "ople-primitives"; // composes with OPLE substrate

/**
 * State — node in the workflow engine state machine.
 *
 * Per 081KSKBP80008QG0R000B3Y19A: hierarchy IS state; state-machine substrate is
 * Git-append-only-persisted; menu of available actions at this state
 * is contributable per Mod 5.
 */
export interface State {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly tickCyclePattern: TickCyclePattern;
  readonly availableActions: ReadonlyArray<string>; // Action.id references
  readonly composesWith: ReadonlyArray<string>;
}

/**
 * Four-corner ownership type per asymmetric-authorship rule +
 * the 4-corner-monad 081KSKBP80008QG0R000B3Y19A substrate.
 *
 * Per operator + Mika substrate-engineering thread (PR #5516
 * substrate + Prism iterator/generator-asymmetry extension):
 *   - TIn — caller authors; flows caller → function
 *   - TOut — function produces; flows function → caller (value-branch)
 *   - TOutFeedback — function authors; flows function → caller (control-flow signals)
 *   - TInFeedback — CO-OWNED (both caller AND function contribute variants;
 *     stream/observable context per asymmetric-authorship four-corner
 *     ownership extension)
 *
 * PoC scaffold uses these as type parameters; full F# 4-corner monad CE
 * builder is 081KSKBP80008QG0R000B3Y19A.4 (deferred).
 */
export interface FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback> {
  readonly tIn: TIn;
  readonly tOut?: TOut;
  readonly tOutFeedback?: TOutFeedback;
  readonly tInFeedback?: TInFeedback;
}

/**
 * Tick — one cycle of the workflow engine agent loop.
 *
 * Per 081KSKBP80008QG0R000B3Y19A.5: agent-loop dispatches execute → CYOA. Per Mod 1:
 * every state MUST include escape-hatch in availableActions.
 */
export interface Tick<TIn, TOut, TOutFeedback, TInFeedback> {
  readonly state: State;
  readonly ownership: FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>;
  readonly chosenAction?: Action;
  readonly timestamp: string; // ISO 8601
}

/**
 * Validate Otto's 5 modifications are satisfied for a state.
 *
 * Mod 1 (escape-hatch in every state): availableActions must include
 *   at least one action with class === "escape-hatch"
 * Mod 2 (grammar-extension as first-class action): catalog must
 *   include at least one action with class === "grammar-extension"
 *   if any state references it (checked at catalog scope, not per-state)
 *
 * Throws on violation — fail-fast at engine-init time.
 */
export function validateStateOtto5Mods(state: State, actionCatalog: ReadonlyArray<Action>): void {
  const stateActions = state.availableActions
    .map((id) => actionCatalog.find((a) => a.id === id))
    .filter((a): a is Action => a !== undefined);
  if (stateActions.length === 0) {
    throw new Error(`state ${state.id} references no actions found in catalog`);
  }
  const hasEscapeHatch = stateActions.some((a) => a.class === "escape-hatch");
  if (!hasEscapeHatch) {
    throw new Error(`state ${state.id} violates Mod 1 — no escape-hatch action in availableActions`);
  }
}

/**
 * Validate catalog-level invariants:
 *   - all action ids are unique
 *   - Mod 2: catalog must include at least one grammar-extension action
 *     (the surface for action-grammar evolution)
 *   - all states reference only defined action ids
 */
export function validateCatalog(actionCatalog: ReadonlyArray<Action>, states: ReadonlyArray<State>): void {
  const ids = new Set<string>();
  for (const a of actionCatalog) {
    if (ids.has(a.id)) {
      throw new Error(`duplicate action id in catalog: ${a.id}`);
    }
    ids.add(a.id);
  }
  const hasGrammarExtension = actionCatalog.some((a) => a.class === "grammar-extension");
  if (!hasGrammarExtension) {
    throw new Error("catalog violates Mod 2 — no grammar-extension action present");
  }
  const stateIds = new Set<string>();
  for (const s of states) {
    if (stateIds.has(s.id)) {
      throw new Error(`duplicate state id: ${s.id}`);
    }
    stateIds.add(s.id);
    for (const aId of s.availableActions) {
      if (!ids.has(aId)) {
        throw new Error(`state ${s.id} references unknown action: ${aId}`);
      }
    }
  }
  // Per-state Mod 1 check after catalog validity:
  for (const s of states) {
    validateStateOtto5Mods(s, actionCatalog);
  }
}

/**
 * 081KSNY2Z0008QG0R003WFDCJ9 — lifecycle DU split: trajectory-push vs PR-review.
 *
 * Per Kestrel substantive substrate-engineering substrate (13th ferry
 * §33.5 + 14th ferry §33.20): the framework's load-bearing distinction
 * is state-machine-events-direct-push (no PR; for heartbeats + agent-
 * events branches + lifecycle transitions) vs system-modifications-
 * full-PR-review (full ceremony; multi-AI reviewers + auto-review
 * pipeline + error class extraction). Collapsing the distinction into
 * "no PRs ever" loses the auto-review pipeline that IS the training
 * data substrate for the cross-vendor benchmark (081KSKBP80008QG0R003NM9XEC + 081KSNY2Z0008QG0R0002BEZMR).
 *
 * `determineReviewLevel(action)` IS the discriminator. Maps each
 * action to its required review treatment per the workflow engine
 * spec.
 *
 * Composes with:
 *   - 081KSNY2Z0008QG0R003WFDCJ9 backlog row (lifecycle-DU-split discriminator)
 *   - 081KSKBP80008QG0R003NM9XEC + 081KSNY2Z0008QG0R0002BEZMR (benchmark substrate; auto-review pipeline
 *     generates training data the benchmark scores against)
 *   - asymmetric-authorship rule (substrate-entity authors review-
 *     level via gate field; recipient acknowledges via dispatch)
 *   - monad-propagation rule (ReviewLevel IS a TFeedback variant set
 *     at workflow-engine-substrate scope)
 *   - architecture-is-safety-mechanism-not-discipline rule (PR #5745)
 *     — the framework enforces review-level structurally
 *
 * Per `.claude/rules/holding-without-named-dependency-is-standing-by-
 * failure.md` counter-with-escalation: shipped after operator
 * substrate-check "so you finished the 3 lanes?" (Amara ferry
 * preservation PR #5757); substantive lane work per standing PoC
 * permission.
 */

/**
 * ReviewLevel — discriminated union for the trajectory-push-vs-PR-review
 * lifecycle DU. Each action's required review treatment.
 */
export type ReviewLevel =
  | "trajectory-push" // direct push to agent-events branch; no PR ceremony
  | "pr-review-light" // PR review; single-reviewer OR auto-review pipeline only
  | "pr-review-full" // PR review; multi-AI reviewer ensemble + auto-review pipeline + error class extraction
  | "operator-required"; // requires explicit operator authorization (e.g., force-push-with-lease without listed-acceptable-situation)

/**
 * `determineReviewLevel` — discriminator that maps an Action to its
 * required ReviewLevel.
 *
 * Discriminator policy:
 *   - "append-only" + "transition" → trajectory-push (state-machine-event
 *     direct push; cheap; the existing pattern for heartbeats per
 *     Aaron's 13th-ferry §33.6 disclosure)
 *   - "append-only" + "menu-contribution" → trajectory-push (Mod 5
 *     contributable menu generation; safe at append-only scope)
 *   - "append-only" + "escape-hatch" → pr-review-light (Mod 1
 *     escape-hatch surfaces substrate-engineering observation worth
 *     reviewer eyes even though gate is append-only)
 *   - "pr-gated" + "grammar-extension" → pr-review-full (Mod 2 grammar
 *     evolution touches the framework's universal action grammar;
 *     full ceremony required to preserve auto-review pipeline)
 *   - "pr-gated" + "transition" → pr-review-full (cross-cutting
 *     substrate modification; full ceremony)
 *   - "operator-decision" class (any gate) → operator-required (per
 *     ban-if-SHIPPED-only Mod 3 + operator-authority preservation)
 *   - "agent-decision" + "append-only" → trajectory-push
 *   - "agent-decision" + "pr-gated" → pr-review-light
 *
 * Discriminator is exhaustive over the cross-product of ActionGate ×
 * ActionClass; future extensions to either union must update this
 * function to maintain exhaustiveness.
 */
export function determineReviewLevel(action: Action): ReviewLevel {
  switch (action.class) {
    case "operator-decision":
      return "operator-required";
    case "escape-hatch":
      // Escape-hatch ALWAYS gets reviewer eyes regardless of gate —
      // it's the substrate-engineering observation surface per Mod 1
      return "pr-review-light";
    case "grammar-extension":
      // Grammar evolution always full ceremony — touches the universal
      // action grammar shared across all travelers per Mod 2
      return "pr-review-full";
    case "menu-contribution":
      // Mod 5 menu contributions are safe at append-only scope
      return action.gate === "append-only" ? "trajectory-push" : "pr-review-light";
    case "transition":
      return action.gate === "append-only" ? "trajectory-push" : "pr-review-full";
    case "agent-decision":
      return action.gate === "append-only" ? "trajectory-push" : "pr-review-light";
  }
}

/**
 * Seed catalog — minimal scaffold demonstrating the 5 mods. Real
 * catalog ships per 081KSKBP80008QG0R000B3Y19A.3 grammar parser/composer when authored.
 */
export const SEED_ACTION_CATALOG: ReadonlyArray<Action> = [
  {
    id: "advance",
    class: "transition",
    gate: "append-only",
    label: "advance",
    description: "standard forward state transition",
    composesWith: ["081KSKBP80008QG0R000B3Y19A.5"],
    feedbackVariants: ["Advanced", "BlockedOnGate", "InvalidTransition"],
  },
  {
    id: "escape-hatch",
    class: "escape-hatch",
    gate: "append-only",
    label: "propose-out-of-grammar-action",
    description: "Mod 1 — observed pattern not fitting any offered action; propose what should fit",
    composesWith: ["081KSKBP80008QG0R000B3Y19A Mod 1"],
    feedbackVariants: ["ProposalLogged", "PromotedToCatalog"],
  },
  {
    id: "grammar-extend",
    class: "grammar-extension",
    gate: "pr-gated",
    label: "extend-action-grammar",
    description: "Mod 2 — propose new action as first-class grammar member; requires PR review",
    composesWith: ["081KSKBP80008QG0R000B3Y19A Mod 2"],
    feedbackVariants: ["GrammarExtensionProposed", "GrammarExtensionMerged", "GrammarExtensionRejected"],
  },
  {
    id: "menu-contribute",
    class: "menu-contribution",
    gate: "append-only",
    label: "contribute-state-menu-entry",
    description: 'Mod 5 — append-only "at state X also offer action W"',
    composesWith: ["081KSKBP80008QG0R000B3Y19A Mod 5"],
    feedbackVariants: ["MenuEntryAppended", "DuplicateEntry"],
  },
];

/**
 * Seed states — minimal scaffold. Real state-machine substrate ships
 * per 081KSKBP80008QG0R000B3Y19A.1 (F#) + 081KSNY2Z0008QG0R001K6HJ7Z (TS state-persist).
 */
export const SEED_STATES: ReadonlyArray<State> = [
  {
    id: "initial",
    label: "Initial state",
    description: "agent-loop entry point",
    tickCyclePattern: "discriminated-union-surface", // PER Mika 2026-05-28 latest direction
    availableActions: ["advance", "escape-hatch", "menu-contribute"],
    composesWith: ["081KSKBP80008QG0R000B3Y19A", "081KSKBP80008QG0R000B3Y19A.5"],
  },
  {
    id: "advancing",
    label: "Advancing state",
    description: "agent in active execute → CYOA loop",
    tickCyclePattern: "discriminated-union-surface",
    availableActions: ["advance", "escape-hatch", "menu-contribute", "grammar-extend"],
    composesWith: ["081KSKBP80008QG0R000B3Y19A", "081KSKBP80008QG0R000B3Y19A.5"],
  },
];
