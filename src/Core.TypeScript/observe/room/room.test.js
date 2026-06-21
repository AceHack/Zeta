import { describe, expect, test } from "bun:test";
import { scopeWorld, tickRooms } from "./room";
describe("room framework", () => {
    const fullWorld = {
        backlog: [
            { id: "B-0001", title: "Fix bug", ready: true, ambiguous: false },
            { id: "B-0002", title: "Add feature", ready: true, ambiguous: false },
            { id: "B-0003", title: "Refactor", ready: true, ambiguous: false },
        ],
        forgeState: { openPrCount: 2, cleanPrCount: 1, cleanPrNumbers: [42, 99] },
    };
    test("scopeWorld filters backlog to declared IDs", () => {
        const scope = {
            backlogIds: new Set(["B-0001"]),
            prNumbers: new Set(),
            operatorAccess: false,
            writeAccess: true,
        };
        const scoped = scopeWorld(fullWorld, scope);
        expect(scoped.backlog).toHaveLength(1);
        expect(scoped.backlog[0].id).toBe("B-0001");
    });
    test("scopeWorld filters PR numbers in forgeState", () => {
        const scope = {
            backlogIds: new Set(),
            prNumbers: new Set([42]),
            operatorAccess: false,
            writeAccess: true,
        };
        const scoped = scopeWorld(fullWorld, scope);
        expect(scoped.forgeState.cleanPrNumbers).toEqual([42]);
    });
    test("tickRooms runs rooms in parallel with scoped worlds", async () => {
        const room1 = {
            id: "pr-42",
            scope: { backlogIds: new Set(), prNumbers: new Set([42]), operatorAccess: false, writeAccess: true },
            state: {},
            tick: async () => ({ action: { kind: "explore", reason: "checking PR" }, tier: "oracle", confidence: 1 }),
        };
        const room2 = {
            id: "backlog-B-0001",
            scope: { backlogIds: new Set(["B-0001"]), prNumbers: new Set(), operatorAccess: false, writeAccess: true },
            state: {},
            tick: async (w) => ({
                action: { kind: "do_item", item: w.backlog[0] },
                tier: "oracle",
                confidence: 0.95,
            }),
        };
        const results = await tickRooms([room1, room2], fullWorld);
        expect(results).toHaveLength(2);
        expect(results[0].roomId).toBe("pr-42");
        expect(results[0].scopeViolation).toBe(false);
        expect(results[1].roomId).toBe("backlog-B-0001");
        expect(results[1].scopeViolation).toBe(false);
    });
    test("tickRooms detects scope overlap", async () => {
        const room1 = {
            id: "a",
            scope: { backlogIds: new Set(["B-0001"]), prNumbers: new Set(), operatorAccess: false, writeAccess: true },
            state: {},
            tick: async () => ({ action: { kind: "explore", reason: "x" }, tier: "oracle", confidence: 1 }),
        };
        const room2 = {
            id: "b",
            scope: { backlogIds: new Set(["B-0001"]), prNumbers: new Set(), operatorAccess: false, writeAccess: true },
            state: {},
            tick: async () => ({ action: { kind: "explore", reason: "y" }, tier: "oracle", confidence: 1 }),
        };
        expect(() => tickRooms([room1, room2], fullWorld)).toThrow("Scope overlap");
    });
    test("tickRooms flags scope violations", async () => {
        const room = {
            id: "narrow",
            scope: { backlogIds: new Set(["B-0001"]), prNumbers: new Set(), operatorAccess: false, writeAccess: false },
            state: {},
            tick: async () => ({
                // Tries to act on B-0002 which is NOT in its scope
                action: { kind: "do_item", item: { id: "B-0002", title: "Add feature", ready: true, ambiguous: false } },
                tier: "oracle",
                confidence: 0.9,
            }),
        };
        const results = await tickRooms([room], fullWorld);
        expect(results[0].scopeViolation).toBe(true);
    });
});
