// full-ai-cluster/portal/src/api.test.ts
//
// The BFF endpoints over the in-memory platform: resource view, catalog,
// needs-me board, a single Room, and the human grant write (which clears the
// pending item). Non-/api paths pass through (null) for static serving.

import { beforeEach, describe, expect, test } from "bun:test";
import { encodeResource, handle } from "./api.ts";
import { InMemoryPlatform } from "./data-memory.ts";
import type { BlueprintCR, DeployableCR, RoomData } from "./viewmodel.ts";

const BLUEPRINTS: BlueprintCR[] = [
  { metadata: { name: "gmod", namespace: "zeta-platform" }, spec: { category: "game", image: "gmod", stateful: true, defaultExpose: "lan", variables: [{ name: "MAP", default: "gm_construct" }] } },
  { metadata: { name: "web", namespace: "zeta-platform" }, spec: { category: "web", image: "nginx", defaultExpose: "public" } },
];
const DEPLOYABLES: DeployableCR[] = [
  { metadata: { name: "clan", namespace: "tenant-a" }, spec: { blueprint: "gmod", expose: "lan" }, status: { phase: "Running" } },
  { metadata: { name: "site", namespace: "tenant-a" }, spec: { blueprint: "web", host: "x.example.com" }, status: { phase: "Error", message: "image pull" } },
];
const room = (): RoomData => ({
  resource: "tenant-a/clan",
  events: [
    { id: "evt-0", seq: 0, weight: 1, proposedBy: { id: "system", kind: "persona" }, body: { type: "state-change", phase: "CrashLoopBackOff" } },
    { id: "evt-1", seq: 1, weight: 1, proposedBy: { id: "otto", kind: "persona" }, body: { type: "authorization-request", gated: "budget", action: { summary: "bump mem 6→8Gi" } } },
  ],
});

let data: InMemoryPlatform;
beforeEach(() => {
  data = new InMemoryPlatform(structuredClone(DEPLOYABLES), structuredClone(BLUEPRINTS), [room()]);
});

const get = (p: string) => handle(new Request(`http://x${p}`), data);
const body = async (r: Response | null) => (r ? r.json() : null);

describe("read endpoints", () => {
  test("GET /api/resources returns category groups", async () => {
    const r = await get("/api/resources");
    const j = (await body(r)) as any;
    expect(j.groups.map((g: any) => g.category)).toEqual(["game", "web"]);
    expect(j.groups[1].resources[0]).toMatchObject({ name: "site", health: "error", message: "image pull" });
  });

  test("GET /api/catalog surfaces blueprints + variables", async () => {
    const j = (await body(await get("/api/catalog"))) as any;
    expect(j.catalog.map((e: any) => e.blueprint)).toEqual(["gmod", "web"]);
    expect(j.catalog[0].variables[0].name).toBe("MAP");
  });

  test("GET /api/needs-me lists the pending budget authorization", async () => {
    const j = (await body(await get("/api/needs-me"))) as any;
    expect(j.items.length).toBe(1);
    expect(j.items[0]).toMatchObject({ resource: "tenant-a/clan", gated: "budget", proposedBy: "otto" });
  });

  test("GET /api/rooms/:resource returns the room view", async () => {
    const j = (await body(await get(`/api/rooms/${encodeResource("tenant-a", "clan")}`))) as any;
    expect(j.room.resource).toBe("tenant-a/clan");
    expect(j.room.phase).toBe("CrashLoopBackOff");
    expect(j.room.pending.length).toBe(1);
  });

  test("GET an unknown room is 404", async () => {
    const r = await get(`/api/rooms/${encodeResource("tenant-z", "nope")}`);
    expect(r!.status).toBe(404);
  });

  test("non-/api paths pass through as null (static serving)", async () => {
    expect(await get("/index.html")).toBeNull();
    expect(await get("/")).toBeNull();
  });
});

describe("grant (the only write — human authorizes)", () => {
  const post = (p: string, b: unknown) => handle(new Request(`http://x${p}`, { method: "POST", body: JSON.stringify(b) }), data);

  test("a valid grant clears the needs-me item", async () => {
    const before = ((await body(await get("/api/needs-me"))) as any).items.length;
    expect(before).toBe(1);
    const r = await post(`/api/rooms/${encodeResource("tenant-a", "clan")}/grant`, { requestId: "evt-1", by: "aaron", granted: true });
    expect(r!.status).toBe(200);
    const after = ((await body(await get("/api/needs-me"))) as any).items.length;
    expect(after).toBe(0);
  });

  test("missing fields → 400", async () => {
    const r = await post(`/api/rooms/${encodeResource("tenant-a", "clan")}/grant`, { requestId: "evt-1" });
    expect(r!.status).toBe(400);
  });

  test("unknown request → 404", async () => {
    const r = await post(`/api/rooms/${encodeResource("tenant-a", "clan")}/grant`, { requestId: "evt-999", by: "aaron", granted: true });
    expect(r!.status).toBe(404);
  });
});
