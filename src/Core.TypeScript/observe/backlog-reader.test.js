/**
 * src/Core.TypeScript/observe/backlog-reader.test.ts
 *
 * Two layers:
 *  - `pickupToAction` mapping (pure, exact) — PickupSelection → observe DU; and
 *  - a real-backlog integration smoke for `nextActionFromBacklog` (reads the
 *    actual docs/backlog via the reused autonomous-pickup selector).
 */
import { describe, expect, it } from "bun:test";
import { pickupToAction, nextActionFromBacklog } from "./backlog-reader";
const richItem = (id, title) => ({
    id,
    legacyId: null,
    priority: "P2",
    status: "open",
    title,
    relativePath: `docs/backlog/P2/${id}.md`,
    dependsOn: [],
    parent: null,
    created: null,
    lastUpdated: null,
    decomposition: null,
    bodyLineCount: 10,
});
const sel = (over) => ({
    status: "empty",
    selected: null,
    action: null,
    reason: "r",
    blocked: [],
    activeClaims: [],
    executionPrompt: null,
    ...over,
});
describe("pickupToAction — map the reused backlog selector onto the observe DU", () => {
    it("empty selection → free_time (reason passes through)", () => {
        const a = pickupToAction(sel({ status: "empty", reason: "nothing ready" }));
        expect(a.kind).toBe("free_time");
        if (a.kind === "free_time")
            expect(a.reason).toBe("nothing ready");
    });
    it("selected + claim-and-implement → do_item (ready, not ambiguous)", () => {
        const a = pickupToAction(sel({ status: "selected", selected: richItem("B-1", "do me"), action: "claim-and-implement" }));
        expect(a.kind).toBe("do_item");
        if (a.kind === "do_item") {
            expect(a.item.id).toBe("B-1");
            expect(a.item.ready).toBe(true);
            expect(a.item.ambiguous).toBe(false);
        }
    });
    it("selected + decompose-first → decompose (ambiguous)", () => {
        const a = pickupToAction(sel({ status: "selected", selected: richItem("B-2", "big one"), action: "decompose-first" }));
        expect(a.kind).toBe("decompose");
        if (a.kind === "decompose") {
            expect(a.item.id).toBe("B-2");
            expect(a.item.ambiguous).toBe(true);
        }
    });
});
describe("nextActionFromBacklog — real-backlog integration smoke", () => {
    it("returns a valid observe action from the actual docs/backlog", () => {
        const action = nextActionFromBacklog(process.cwd());
        expect(["do_item", "decompose", "free_time"]).toContain(action.kind);
    });
});
