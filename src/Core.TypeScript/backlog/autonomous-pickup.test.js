import { describe, expect, test } from "bun:test";
import { selectNextBacklogItem } from "./autonomous-pickup";
function item(partial) {
    return {
        legacyId: null,
        status: "open",
        relativePath: `docs/backlog/${partial.priority}/${partial.id}.md`,
        dependsOn: [],
        parent: null,
        created: null,
        lastUpdated: null,
        decomposition: null,
        bodyLineCount: 20,
        ...partial,
    };
}
describe("selectNextBacklogItem", () => {
    test("selects the highest priority open unclaimed item", () => {
        const selection = selectNextBacklogItem([
            item({ id: "081KQB8J40008QG0R0023DKTFJ", priority: "P1", title: "P1 work" }),
            item({ id: "081KQTPYE0008QG0R0009F20NN", priority: "P2", title: "P2 work" }),
            item({ id: "081KPYCJH0008QG0R003MDS51N", priority: "P0", title: "P0 work" }),
        ], []);
        expect(selection.status).toBe("selected");
        expect(selection.selected?.id).toBe("081KPYCJH0008QG0R003MDS51N");
        expect(selection.action).toBe("claim-and-implement");
    });
    test("returns decompose for blob rows before implementation", () => {
        const selection = selectNextBacklogItem([
            item({
                id: "081KQZVQW0008QG0R000C35RNY",
                priority: "P0",
                title: "Autonomous pickup",
                decomposition: "blob",
            }),
        ], []);
        expect(selection.status).toBe("selected");
        expect(selection.selected?.id).toBe("081KQZVQW0008QG0R000C35RNY");
        expect(selection.action).toBe("decompose-first");
        expect(selection.executionPrompt).toContain("Decompose 081KQZVQW0008QG0R000C35RNY");
    });
    test("returns decompose for large legacy rows without explicit blob frontmatter", () => {
        const selection = selectNextBacklogItem([
            item({
                id: "081KQ8P5D0008QG0R002XFQ305",
                priority: "P0",
                title: "legacy punch list",
                bodyLineCount: 217,
            }),
        ], []);
        expect(selection.status).toBe("selected");
        expect(selection.selected?.id).toBe("081KQ8P5D0008QG0R002XFQ305");
        expect(selection.action).toBe("decompose-first");
    });
    test("blocks rows with open dependencies", () => {
        const selection = selectNextBacklogItem([
            item({ id: "081KPYCJH0008QG0R003MDS51N", priority: "P0", title: "dependency" }),
            item({
                id: "081KQ0YZ80008QG0R002T6TM7Z",
                priority: "P0",
                title: "blocked by dependency",
                dependsOn: ["081KPYCJH0008QG0R003MDS51N"],
            }),
            item({ id: "081KQB8J40008QG0R0023DKTFJ", priority: "P1", title: "fallback" }),
        ], []);
        expect(selection.status).toBe("selected");
        expect(selection.selected?.id).toBe("081KPYCJH0008QG0R003MDS51N");
        expect(selection.blocked).toEqual([]);
    });
    test("skips claimed matching rows", () => {
        const selection = selectNextBacklogItem([
            item({ id: "081KQ8P5D0008QG0R002XFQ305", priority: "P0", title: "claimed" }),
            item({ id: "081KQDTYV0008QG0R002H74QXZ", priority: "P0", title: "fallback" }),
        ], ["claim/backlog-081KQ8P5D0008QG0R002XFQ305-wallet"]);
        expect(selection.status).toBe("selected");
        expect(selection.selected?.id).toBe("081KQDTYV0008QG0R002H74QXZ");
        expect(selection.blocked[0]?.reason).toContain("claim/backlog-081KQ8P5D0008QG0R002XFQ305-wallet");
    });
    test("orders equal-priority candidates by creation age before item number", () => {
        const selection = selectNextBacklogItem([
            item({
                id: "081KPYCJH0008QG0R003MDS51N",
                priority: "P1",
                title: "newer lower id",
                created: "2026-05-08",
            }),
            item({
                id: "081KED9T0X008QG0R003SZN0FB",
                priority: "P1",
                title: "older higher id",
                created: "2026-04-30",
            }),
        ], []);
        expect(selection.status).toBe("selected");
        expect(selection.selected?.id).toBe("081KED9T0X008QG0R003SZN0FB");
    });
    test("skips decomposed parents while open children remain", () => {
        const selection = selectNextBacklogItem([
            item({
                id: "081KQZVQW0008QG0R000C35RNY",
                priority: "P0",
                title: "parent",
                decomposition: "decomposed",
            }),
            item({
                id: "081KR2E4K0008QG0R001GFXN05",
                priority: "P0",
                title: "child",
                parent: "081KQZVQW0008QG0R000C35RNY",
            }),
            item({
                id: "081KR2E4K0008QG0R002MFK6AW",
                priority: "P1",
                title: "fallback",
            }),
        ], []);
        expect(selection.status).toBe("selected");
        expect(selection.selected?.id).toBe("081KR2E4K0008QG0R001GFXN05");
        expect(selection.blocked[0]?.reason).toContain("open child 081KR2E4K0008QG0R001GFXN05");
    });
});
