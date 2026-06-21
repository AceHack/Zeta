import { choose } from "../../chooser";
import { defaultComposer } from "../../composer";
export function createBacklogRoom(item) {
    const state = { step: "not-started", ticksInStep: 0 };
    return {
        id: `backlog-${item.id}`,
        scope: { backlogIds: new Set([item.id]), prNumbers: new Set(), operatorAccess: false, writeAccess: true },
        state,
        tick: async (scopedWorld) => {
            const result = await choose(scopedWorld, { composer: defaultComposer });
            const s = state;
            s.ticksInStep++;
            s.lastAction = result.action.kind;
            if (result.action.kind === "do_item" || result.action.kind === "decompose")
                s.step = "in-progress";
            else if (s.ticksInStep > 3)
                s.step = "blocked";
            return result;
        },
    };
}
export function createShadowRoom() {
    const state = { ticksSinceReport: 0, driftSignals: [] };
    return {
        id: "shadow-observer",
        scope: { backlogIds: new Set(), prNumbers: new Set(), operatorAccess: false, writeAccess: false },
        state,
        tick: async () => {
            state.ticksSinceReport++;
            return { action: { kind: "explore", reason: "shadow observation" }, tier: "oracle", confidence: 1.0 };
        },
    };
}
