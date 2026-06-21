import { describe, expect, test } from "bun:test";
import { oracleParticipant, testPersonaParticipant, humanParticipant, observeWithParticipant, } from "./participant";
import { buildMenu } from "./observe";
const WORK_WORLD = {
    backlog: [{ id: "081KTEST001", title: "test item", ready: true, ambiguous: false }],
};
const EMPTY_WORLD = { backlog: [] };
describe("Participant — oracle", () => {
    test("always picks index 0 (the oracle default)", async () => {
        const p = oracleParticipant();
        const menu = buildMenu(WORK_WORLD);
        const result = await p.choose(WORK_WORLD, menu);
        expect(result.index).toBe(0);
        expect(result.fallback).toBe(false);
    });
    test("observeWithParticipant returns the oracle's pick", async () => {
        const action = await observeWithParticipant(WORK_WORLD, oracleParticipant());
        expect(action.kind).toBe("do_item");
    });
    test("empty backlog → oracle picks explore", async () => {
        const action = await observeWithParticipant(EMPTY_WORLD, oracleParticipant());
        expect(action.kind).toBe("explore");
    });
});
describe("Participant — test persona (inline)", () => {
    test("always picks free_time (custom chooser)", async () => {
        const p = testPersonaParticipant("always-rest", (_world, menu) => {
            return menu.findIndex(a => a.kind === "free_time");
        });
        const action = await observeWithParticipant(WORK_WORLD, p);
        expect(action.kind).toBe("free_time");
    });
    test("always picks the last item", async () => {
        const p = testPersonaParticipant("last-picker", (_world, menu) => menu.length - 1);
        const menu = buildMenu(WORK_WORLD);
        const result = await p.choose(WORK_WORLD, menu);
        expect(result.index).toBe(menu.length - 1);
    });
    test("out-of-bounds index is clamped", async () => {
        const p = testPersonaParticipant("oob", () => 999);
        const menu = buildMenu(WORK_WORLD);
        const result = await p.choose(WORK_WORLD, menu);
        expect(result.index).toBe(menu.length - 1);
    });
});
describe("Participant — human (async, notification-gated)", () => {
    test("returns human's choice when response arrives", async () => {
        const notifier = {
            notify: async () => { },
            waitForResponse: async () => ({ choice: 2 }),
        };
        const p = humanParticipant("aaron", notifier, 5000);
        const menu = buildMenu(WORK_WORLD);
        const result = await p.choose(WORK_WORLD, menu);
        expect(result.index).toBe(2);
        expect(result.fallback).toBe(false);
    });
    test("falls back to oracle on timeout (null response)", async () => {
        const notifier = {
            notify: async () => { },
            waitForResponse: async () => null, // timeout
        };
        const p = humanParticipant("aaron", notifier, 100);
        const result = await p.choose(WORK_WORLD, buildMenu(WORK_WORLD));
        expect(result.index).toBe(0); // oracle fallback
        expect(result.fallback).toBe(true);
    });
});
describe("Participant — observeWithParticipant fallback", () => {
    test("falls back to oracle when choose() throws (degrade-toward-correct)", async () => {
        const throwing = {
            kind: "test-persona",
            name: "test:throws",
            choose: async () => {
                throw new Error("chooser exploded");
            },
        };
        // Must not propagate — should return the oracle pick for WORK_WORLD.
        const action = await observeWithParticipant(WORK_WORLD, throwing);
        expect(action.kind).toBe("do_item");
    });
});
describe("Participant — metadata", () => {
    test("each participant reports its kind and name", () => {
        expect(oracleParticipant().kind).toBe("oracle");
        expect(oracleParticipant().name).toBe("oracle");
        expect(testPersonaParticipant("critic", () => 0).kind).toBe("test-persona");
        expect(testPersonaParticipant("critic", () => 0).name).toBe("test:critic");
        expect(humanParticipant("aaron", { notify: async () => { }, waitForResponse: async () => null }).kind).toBe("human");
    });
});
