/**
 * observe/composer.ts — L2 Bayesian/heuristic Composer backend for the Chooser.
 *
 * Scores menu options without calling an LLM using cheap signals:
 * readiness, priority, mode coherence, forge boost, operator boost.
 *
 * Composes with: observe/chooser.ts (Sequoia cascade), observe/observe.ts (types).
 */
const DEFAULT_WEIGHTS = {
    readiness: 0.3,
    priority: 0.2,
    modeCoherence: 0.25,
    forgeBoost: 0.15,
    operatorBoost: 0.1,
};
function modeFamily(kind) {
    switch (kind) {
        case "preserve_ferry":
        case "respond_to_operator": return "operator";
        case "do_item":
        case "decompose": return "work";
        case "explore":
        case "play":
        case "self_reflect":
        case "free_time": return "free";
        case "edit_grammar": return "meta";
        default: return "work";
    }
}
function currentModeFamily(mode) {
    if (!mode)
        return "work";
    switch (mode) {
        case "explore":
        case "play":
        case "self_reflect":
        case "free_time": return "free";
        default: return "work";
    }
}
function scoreAction(action, index, menuSize, world, weights) {
    let score = 0;
    if (action.kind === "do_item" && action.item.ready && !action.item.ambiguous)
        score += weights.readiness;
    else if (action.kind === "decompose")
        score += weights.readiness * 0.5;
    else if (modeFamily(action.kind) === "free")
        score += weights.readiness * 0.3;
    score += weights.priority * (1 - (index / Math.max(menuSize - 1, 1)));
    const agentFamily = currentModeFamily(world.mode);
    const actionFamily = modeFamily(action.kind);
    if (agentFamily === actionFamily)
        score += weights.modeCoherence;
    else if (agentFamily === "free" && actionFamily === "work")
        score += weights.modeCoherence * 0.4;
    if (action.kind === "do_item" && action.item.id.startsWith("merge-pr-"))
        score += weights.forgeBoost;
    if (actionFamily === "operator")
        score += weights.operatorBoost;
    return Math.min(1, Math.max(0, score));
}
export function heuristicComposer(weights) {
    const w = { ...DEFAULT_WEIGHTS, ...weights };
    return {
        score: async (menu, world) => {
            return menu.map((action, index) => scoreAction(action, index, menu.length, world, w));
        },
    };
}
export const defaultComposer = heuristicComposer();
