import { describe, expect, test } from "bun:test";
import { heuristicComposer, defaultComposer } from "./composer";
describe("composer — L2 heuristic scorer", () => {
    const readyItem = { id: "B-0001", title: "Fix bug", ready: true, ambiguous: false };
    const ambiguousItem = { id: "B-0002", title: "Big refactor", ready: true, ambiguous: true };
    const workWorld = { backlog: [readyItem, ambiguousItem] };
    const freeWorld = { backlog: [], mode: "explore" };
    test("scores ready do_item higher than decompose", async () => {
        const menu = [
            { kind: "do_item", item: readyItem },
            { kind: "decompose", item: ambiguousItem },
            { kind: "explore", reason: "nothing else" },
        ];
        const scores = await defaultComposer.score(menu, workWorld);
        expect(scores[0]).toBeGreaterThan(scores[1]);
        expect(scores[0]).toBeGreaterThan(scores[2]);
    });
    test("scores free modes higher when agent is in free mode", async () => {
        const menu = [
            { kind: "do_item", item: readyItem },
            { kind: "explore", reason: "curiosity" },
        ];
        const scores = await defaultComposer.score(menu, freeWorld);
        expect(scores[1]).toBeGreaterThan(0.3);
    });
    test("forge boost lifts merge-pr items", async () => {
        const mergeItem = { id: "merge-pr-42", title: "Merge PR #42", ready: true, ambiguous: false };
        const regularItem = { id: "B-0099", title: "Some task", ready: true, ambiguous: false };
        const menu = [
            { kind: "do_item", item: regularItem },
            { kind: "do_item", item: mergeItem },
        ];
        const composer = heuristicComposer({ forgeBoost: 0.5, priority: 0.05 });
        const scores = await composer.score(menu, workWorld);
        expect(scores[1]).toBeGreaterThan(scores[0]);
    });
    test("all scores between 0 and 1", async () => {
        const menu = [
            { kind: "do_item", item: readyItem },
            { kind: "decompose", item: ambiguousItem },
            { kind: "explore", reason: "x" },
            { kind: "play", reason: "y" },
            { kind: "free_time", reason: "z" },
        ];
        const scores = await defaultComposer.score(menu, workWorld);
        for (const s of scores) {
            expect(s).toBeGreaterThanOrEqual(0);
            expect(s).toBeLessThanOrEqual(1);
        }
    });
    test("custom weights shift scoring", async () => {
        const freeFirst = heuristicComposer({ modeCoherence: 0.9, readiness: 0.05 });
        const menu = [
            { kind: "do_item", item: readyItem },
            { kind: "explore", reason: "curiosity" },
        ];
        const scores = await freeFirst.score(menu, freeWorld);
        expect(scores[1]).toBeGreaterThan(scores[0]);
    });
});
