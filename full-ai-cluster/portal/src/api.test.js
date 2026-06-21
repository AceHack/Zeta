// full-ai-cluster/portal/src/api.test.ts
//
// The BFF endpoints over the in-memory platform: resource view, catalog,
// needs-me board, a single Room, the human grant write (which clears the
// pending item), and the deploy write path (create a Deployable). Non-/api
// paths pass through (null) for static serving.
import { beforeEach, describe, expect, test } from "bun:test";
import { encodeResource, handle } from "./api.js";
import { InMemoryPlatform } from "./data-memory.js";
const BLUEPRINTS = [
    { metadata: { name: "gmod", namespace: "zeta-platform" }, spec: { category: "game", image: "gmod", stateful: true, defaultExpose: "lan", variables: [{ name: "MAP", default: "gm_construct" }] } },
    { metadata: { name: "web", namespace: "zeta-platform" }, spec: { category: "web", image: "nginx", defaultExpose: "public" } },
];
const DEPLOYABLES = [
    { metadata: { name: "clan", namespace: "tenant-a" }, spec: { blueprint: "gmod", expose: "lan" }, status: { phase: "Running" } },
    { metadata: { name: "site", namespace: "tenant-a" }, spec: { blueprint: "web", host: "x.example.com" }, status: { phase: "Error", message: "image pull" } },
];
const room = () => ({
    resource: "tenant-a/clan",
    events: [
        { id: "evt-0", seq: 0, weight: 1, proposedBy: { id: "system", kind: "persona" }, body: { type: "state-change", phase: "CrashLoopBackOff" } },
        { id: "evt-1", seq: 1, weight: 1, proposedBy: { id: "otto", kind: "persona" }, body: { type: "authorization-request", gated: "budget", action: { summary: "bump mem 6→8Gi" } } },
    ],
});
let data;
beforeEach(() => {
    data = new InMemoryPlatform(structuredClone(DEPLOYABLES), structuredClone(BLUEPRINTS), [room()]);
});
const get = (p) => handle(new Request(`http://x${p}`), data);
const body = async (r) => (r ? r.json() : null);
describe("read endpoints", () => {
    test("GET /api/resources returns category groups", async () => {
        const r = await get("/api/resources");
        const j = (await body(r));
        expect(j.groups.map((g) => g.category)).toEqual(["game", "web"]);
        expect(j.groups[1].resources[0]).toMatchObject({ name: "site", health: "error", message: "image pull" });
    });
    test("GET /api/catalog surfaces blueprints + variables", async () => {
        const j = (await body(await get("/api/catalog")));
        expect(j.catalog.map((e) => e.blueprint)).toEqual(["gmod", "web"]);
        expect(j.catalog[0].variables[0].name).toBe("MAP");
    });
    test("GET /api/needs-me lists the pending budget authorization", async () => {
        const j = (await body(await get("/api/needs-me")));
        expect(j.items.length).toBe(1);
        expect(j.items[0]).toMatchObject({ resource: "tenant-a/clan", gated: "budget", proposedBy: "otto" });
    });
    test("GET /api/rooms/:resource returns the room view", async () => {
        const j = (await body(await get(`/api/rooms/${encodeResource("tenant-a", "clan")}`)));
        expect(j.room.resource).toBe("tenant-a/clan");
        expect(j.room.phase).toBe("CrashLoopBackOff");
        expect(j.room.pending.length).toBe(1);
    });
    test("GET an unknown room is 404", async () => {
        const r = await get(`/api/rooms/${encodeResource("tenant-z", "nope")}`);
        expect(r.status).toBe(404);
    });
    test("non-/api paths pass through as null (static serving)", async () => {
        expect(await get("/index.html")).toBeNull();
        expect(await get("/")).toBeNull();
    });
});
describe("grant (the only write — human authorizes)", () => {
    const post = (p, b) => handle(new Request(`http://x${p}`, { method: "POST", body: JSON.stringify(b) }), data);
    test("a valid grant clears the needs-me item", async () => {
        const before = (await body(await get("/api/needs-me"))).items.length;
        expect(before).toBe(1);
        const r = await post(`/api/rooms/${encodeResource("tenant-a", "clan")}/grant`, { requestId: "evt-1", by: "aaron", granted: true });
        expect(r.status).toBe(200);
        const after = (await body(await get("/api/needs-me"))).items.length;
        expect(after).toBe(0);
    });
    test("missing fields → 400", async () => {
        const r = await post(`/api/rooms/${encodeResource("tenant-a", "clan")}/grant`, { requestId: "evt-1" });
        expect(r.status).toBe(400);
    });
    test("unknown request → 404", async () => {
        const r = await post(`/api/rooms/${encodeResource("tenant-a", "clan")}/grant`, { requestId: "evt-999", by: "aaron", granted: true });
        expect(r.status).toBe(404);
    });
});
describe("append events (controller / personas write the room log)", () => {
    const post = (p, b) => handle(new Request(`http://x${p}`, { method: "POST", body: JSON.stringify(b) }), data);
    test("a state-change event is appended and shows up in the room", async () => {
        const r = await post(`/api/rooms/${encodeResource("tenant-a", "clan")}/events`, { by: "otto", kind: "persona", body: { type: "state-change", phase: "Ready" } });
        expect(r.status).toBe(200);
        const j = (await body(await get(`/api/rooms/${encodeResource("tenant-a", "clan")}`)));
        expect(j.room.phase).toBe("Ready"); // the latest state-change wins
    });
    test("a missing/invalid body → 400", async () => {
        const r = await post(`/api/rooms/${encodeResource("tenant-a", "clan")}/events`, { by: "otto", body: { type: "bogus" } });
        expect(r.status).toBe(400);
    });
});
describe("create Deployable (the deploy write path — a human deploys a service)", () => {
    const post = (p, b) => handle(new Request(`http://x${p}`, { method: "POST", body: JSON.stringify(b) }), data);
    test("a valid create returns ok and the resource appears, Running (ready)", async () => {
        const r = await post("/api/deployables", { name: "billing", namespace: "tenant-a", spec: { blueprint: "web", expose: "public", size: { cpu: "500m", memory: "1Gi" }, ai: { admin: "otto", policy: "default", room: "enabled" } } });
        expect(r.status).toBe(200);
        const j = (await body(r));
        expect(j.ok).toBe(true);
        // the new resource shows up in the top-down list, healthy/ready (status phase Running)
        const groups = (await body(await get("/api/resources"))).groups;
        const all = groups.flatMap((g) => g.resources);
        const billing = all.find((res) => res.name === "billing" && res.namespace === "tenant-a");
        expect(billing).toBeDefined();
        expect(billing.health).toBe("ready");
        expect(billing.blueprint).toBe("web");
    });
    test("missing name or spec.blueprint → 400", async () => {
        expect((await post("/api/deployables", { namespace: "tenant-a", spec: { blueprint: "web" } })).status).toBe(400);
        expect((await post("/api/deployables", { name: "x", spec: { expose: "public" } })).status).toBe(400);
    });
    test("create is idempotent — same ns/name upserts, not duplicates", async () => {
        await post("/api/deployables", { name: "dup", namespace: "tenant-a", spec: { blueprint: "web" } });
        await post("/api/deployables", { name: "dup", namespace: "tenant-a", spec: { blueprint: "web" } });
        const groups = (await body(await get("/api/resources"))).groups;
        const dups = groups.flatMap((g) => g.resources).filter((res) => res.name === "dup" && res.namespace === "tenant-a");
        expect(dups.length).toBe(1);
    });
    test("405 when the backend has no createDeployable", async () => {
        const noWrite = { listDeployables: async () => [], listBlueprints: async () => [], listRooms: async () => [], getRoom: async () => undefined, grant: async () => false };
        const r = await handle(new Request("http://x/api/deployables", { method: "POST", body: JSON.stringify({ name: "z", spec: { blueprint: "web" } }) }), noWrite);
        expect(r.status).toBe(405);
    });
});
describe("management plane: the :resource path segment is URL-decoded", () => {
    // Regression for the live Logs/Events breakage: the web client builds the
    // management URL by percent-encoding the resource id's slash (`ns/name` →
    // `ns%2Fname`). URL.pathname keeps `%2F` literal, so the server MUST decode
    // it before the ops layer — otherwise `K8sOps.split`'s `resource.split("/")`
    // never splits and it builds `/namespaces/ns%2Fname/pods` → 403 → 500.
    // A spy ops layer that captures the exact `resource` string each op receives,
    // so we can assert the decoded `namespace/name` reaches the ops call.
    const makeSpy = () => {
        const seen = {};
        const ops = {
            logs: async (resource) => {
                seen.logs = resource;
                return [{ ts: "t", level: "info", text: "ok" }];
            },
            events: async (resource) => {
                seen.events = resource;
                return [];
            },
        };
        const platform = {
            listDeployables: async () => [],
            listBlueprints: async () => [],
            listRooms: async () => [],
            getRoom: async () => undefined,
            grant: async () => false,
            ops,
        };
        return { platform, seen };
    };
    test("GET /api/resources/flowdent%2Fflowdent-webapp/logs → ns=flowdent name=flowdent-webapp", async () => {
        const { platform, seen } = makeSpy();
        const r = await handle(new Request("http://x/api/resources/flowdent%2Fflowdent-webapp/logs"), platform);
        expect(r.status).toBe(200);
        // the decoded `namespace/name` (NOT the still-encoded `%2F`) reaches data.ops.logs,
        // which is exactly what K8sOps.split needs to yield ["flowdent","flowdent-webapp"].
        expect(seen.logs).toBe("flowdent/flowdent-webapp");
        expect((seen.logs ?? "").split("/")).toEqual(["flowdent", "flowdent-webapp"]);
    });
    test("GET /api/resources/flowdent%2Fflowdent-webapp/events also decodes", async () => {
        const { platform, seen } = makeSpy();
        const r = await handle(new Request("http://x/api/resources/flowdent%2Fflowdent-webapp/events"), platform);
        expect(r.status).toBe(200);
        expect(seen.events).toBe("flowdent/flowdent-webapp");
    });
    test("the canonical `~` separator still resolves (no double-decode regression)", async () => {
        const { platform, seen } = makeSpy();
        const r = await handle(new Request("http://x/api/resources/flowdent~flowdent-webapp/logs"), platform);
        expect(r.status).toBe(200);
        expect(seen.logs).toBe("flowdent/flowdent-webapp");
    });
});
