// full-ai-cluster/portal/src/viewmodel.test.ts
//
// The portal view-model: health mapping, category-grouped resource view, the
// deploy catalog, the per-room view, and the "needs-me" board aggregating
// pending authorizations across rooms (incl. retraction + grant exclusion).
import { describe, expect, test } from "bun:test";
import { catalog, health, needsMe, resourceGroups, toResourceVM, toRoomVM, } from "./viewmodel.js";
const BLUEPRINTS = [
    { metadata: { name: "gmod", namespace: "zeta-platform" }, spec: { category: "game", image: "gmod", stateful: true, defaultExpose: "lan", variables: [{ name: "MAP", default: "gm_construct" }] } },
    { metadata: { name: "web", namespace: "zeta-platform" }, spec: { category: "web", image: "nginx", stateful: false, defaultExpose: "public" } },
    { metadata: { name: "postgres", namespace: "zeta-platform" }, spec: { category: "database", image: "postgres", stateful: true, defaultExpose: "cluster" } },
];
const dep = (name, blueprint, status, spec) => ({
    metadata: { name, namespace: "tenant-a" },
    spec: { blueprint, ...spec },
    ...(status ? { status } : {}),
});
describe("health", () => {
    test("maps phases to badges", () => {
        expect(health("Ready")).toBe("ready");
        expect(health("Running")).toBe("ready");
        expect(health("Error")).toBe("error");
        expect(health("CrashLoopBackOff")).toBe("error");
        expect(health("Provisioning")).toBe("progressing");
        expect(health(undefined)).toBe("unknown");
    });
});
describe("toResourceVM", () => {
    test("resolves category from the blueprint and fills defaults", () => {
        const vm = toResourceVM(dep("clan", "gmod", { phase: "Running", children: ["StatefulSet/clan"] }), BLUEPRINTS);
        expect(vm).toMatchObject({ category: "game", health: "ready", phase: "Running", expose: "lan", admin: "otto" });
        expect(vm.children).toEqual(["StatefulSet/clan"]);
    });
    test("unknown blueprint falls back to category other", () => {
        expect(toResourceVM(dep("x", "mystery"), BLUEPRINTS).category).toBe("other");
    });
    test("carries an error message through for the badge", () => {
        const vm = toResourceVM(dep("bad", "gmod", { phase: "Error", message: "blueprint not found" }), BLUEPRINTS);
        expect(vm.health).toBe("error");
        expect(vm.message).toBe("blueprint not found");
    });
});
describe("resourceGroups", () => {
    test("groups by category in canonical order and sorts resources by name", () => {
        const groups = resourceGroups([dep("zeta-site", "web"), dep("alpha-db", "postgres"), dep("clan", "gmod"), dep("beta-db", "postgres")], BLUEPRINTS);
        expect(groups.map((g) => g.category)).toEqual(["game", "web", "database"]); // canonical order
        const db = groups.find((g) => g.category === "database");
        expect(db.count).toBe(2);
        expect(db.resources.map((r) => r.name)).toEqual(["alpha-db", "beta-db"]); // name-sorted
    });
});
describe("catalog", () => {
    test("one entry per blueprint, category-ordered, with variables surfaced for the form", () => {
        const c = catalog(BLUEPRINTS);
        expect(c.map((e) => e.blueprint)).toEqual(["gmod", "web", "postgres"]);
        expect(c[0].variables.map((v) => v.name)).toEqual(["MAP"]);
    });
});
// ── rooms + needs-me ───────────────────────────────────────────────────
const persona = (id) => ({ id, kind: "persona" });
const human = (id) => ({ id, kind: "human" });
function roomWithPending(resource) {
    return {
        resource,
        events: [
            { id: "evt-0", seq: 0, weight: 1, proposedBy: persona("system"), body: { type: "state-change", phase: "CrashLoopBackOff" } },
            { id: "evt-1", seq: 1, weight: 1, proposedBy: persona("otto"), body: { type: "authorization-request", gated: "budget", action: { summary: "bump mem 6→8Gi" } } },
        ],
    };
}
describe("needsMe board", () => {
    test("aggregates pending authorizations across rooms", () => {
        const board = needsMe([roomWithPending("tenant-a/clan"), roomWithPending("tenant-b/raid")]);
        expect(board.length).toBe(2);
        expect(board[0]).toMatchObject({ resource: "tenant-a/clan", gated: "budget", proposedBy: "otto", summary: "bump mem 6→8Gi" });
    });
    test("a granted request drops off the board", () => {
        const room = roomWithPending("tenant-a/clan");
        room.events.push({ id: "evt-2", seq: 2, weight: 1, proposedBy: human("aaron"), authorizedBy: human("aaron"), body: { type: "authorization-grant", requestId: "evt-1", granted: true } });
        expect(needsMe([room]).length).toBe(0);
    });
    test("a retracted request drops off the board", () => {
        const room = roomWithPending("tenant-a/clan");
        room.events.push({ id: "evt-2", seq: 2, weight: -1, proposedBy: persona("otto"), body: { type: "retraction", retracts: "evt-1" } });
        expect(needsMe([room]).length).toBe(0);
    });
});
describe("toRoomVM", () => {
    test("nets out retractions, reports latest phase, lists participants + pending", () => {
        const room = roomWithPending("tenant-a/clan");
        room.events.push({ id: "evt-2", seq: 2, weight: 1, proposedBy: persona("otto"), body: { type: "message", text: "wrong" } });
        room.events.push({ id: "evt-3", seq: 3, weight: -1, proposedBy: persona("otto"), body: { type: "retraction", retracts: "evt-2" } });
        const vm = toRoomVM(room);
        expect(vm.phase).toBe("CrashLoopBackOff");
        expect(vm.events.some((e) => e.id === "evt-2")).toBe(false); // retracted, not live
        expect(vm.events.some((e) => e.id === "evt-3")).toBe(false); // the retraction itself isn't a live event
        expect(vm.participants.map((p) => p.id).sort()).toEqual(["otto", "system"]);
        expect(vm.pending.length).toBe(1);
    });
});
