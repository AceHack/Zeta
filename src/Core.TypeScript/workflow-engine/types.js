/**
 * src/Core.TypeScript/workflow-engine/types.ts
 *
 * 081KDWZ8TS008QG0R0020NJ9D0 — workflow engine agent-loop PoC scaffold (TS-side per
 * zeta-ships-with-skills-immediate-value.md; F# crystallization
 * tracked separately as 081KDWZ8TS008QG0R000A4GT2F + 081KDWZ8TS008QG0R000KEB8NQ)
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
 *   - 081KDWZ8TS008QG0R000A4GT2F..0.21 sub-rows
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
 * parser/composer (081KDWZ8TS008QG0R003BD6345), F# 4-corner monad runtime (081KDWZ8TS008QG0R000KEB8NQ),
 * full agent-loop runtime (081KDWZ8TS008QG0R0020NJ9D0 phase 2) all deferred to operator-
 * authorized follow-up work.
 */
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
export function validateStateOtto5Mods(state, actionCatalog) {
    const stateActions = state.availableActions
        .map((id) => actionCatalog.find((a) => a.id === id))
        .filter((a) => a !== undefined);
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
export function validateCatalog(actionCatalog, states) {
    const ids = new Set();
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
    const stateIds = new Set();
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
export function determineReviewLevel(action) {
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
 * catalog ships per 081KDWZ8TS008QG0R003BD6345 grammar parser/composer when authored.
 */
export const SEED_ACTION_CATALOG = [
    {
        id: "advance",
        class: "transition",
        gate: "append-only",
        label: "advance",
        description: "standard forward state transition",
        composesWith: ["081KDWZ8TS008QG0R0020NJ9D0"],
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
 * per 081KDWZ8TS008QG0R000A4GT2F (F#) + 081KSNY2Z0008QG0R001K6HJ7Z (TS state-persist).
 */
export const SEED_STATES = [
    {
        id: "initial",
        label: "Initial state",
        description: "agent-loop entry point",
        tickCyclePattern: "discriminated-union-surface", // PER Mika 2026-05-28 latest direction
        availableActions: ["advance", "escape-hatch", "menu-contribute"],
        composesWith: ["081KSKBP80008QG0R000B3Y19A", "081KDWZ8TS008QG0R0020NJ9D0"],
    },
    {
        id: "advancing",
        label: "Advancing state",
        description: "agent in active execute → CYOA loop",
        tickCyclePattern: "discriminated-union-surface",
        availableActions: ["advance", "escape-hatch", "menu-contribute", "grammar-extend"],
        composesWith: ["081KSKBP80008QG0R000B3Y19A", "081KDWZ8TS008QG0R0020NJ9D0"],
    },
];
