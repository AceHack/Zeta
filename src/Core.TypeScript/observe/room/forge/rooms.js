export function createPrRoom(prNumber) {
    const state = { prNumber, unresolvedThreads: 0, ciStatus: "unknown", autoMergeArmed: false };
    return {
        id: `pr-${prNumber}`,
        scope: { backlogIds: new Set(), prNumbers: new Set([prNumber]), operatorAccess: false, writeAccess: true },
        state,
        tick: async (scopedWorld) => {
            const isClean = scopedWorld.forgeState?.cleanPrNumbers.includes(prNumber) ?? false;
            if (isClean && !state.autoMergeArmed) {
                return {
                    action: { kind: "do_item", item: { id: `merge-pr-${prNumber}`, title: `Merge PR #${prNumber}`, ready: true, ambiguous: false } },
                    tier: "oracle", confidence: 1.0,
                };
            }
            return { action: { kind: "explore", reason: `PR #${prNumber} not ready` }, tier: "oracle", confidence: 0.9 };
        },
    };
}
export function createMergeRoom() {
    const state = { queueDepth: 0 };
    return {
        id: "merge-queue",
        scope: { backlogIds: new Set(), prNumbers: new Set(), operatorAccess: false, writeAccess: true },
        state,
        tick: async (scopedWorld) => {
            const cleanPrs = scopedWorld.forgeState?.cleanPrNumbers ?? [];
            state.queueDepth = cleanPrs.length;
            if (cleanPrs.length > 0) {
                const pr = cleanPrs[0];
                state.lastArmedPr = pr;
                return {
                    action: { kind: "do_item", item: { id: `merge-pr-${pr}`, title: `Merge PR #${pr}`, ready: true, ambiguous: false } },
                    tier: "oracle", confidence: 1.0,
                };
            }
            return { action: { kind: "explore", reason: "merge queue empty" }, tier: "oracle", confidence: 1.0 };
        },
    };
}
