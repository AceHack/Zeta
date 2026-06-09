// full-ai-cluster/portal/src/ops.test.ts
//
// DemoOps + the management-plane BFF routes: info/metrics/logs/events/files/
// config/lifecycle, the config + lifecycle write paths (which mutate the overlay
// so the UI reacts), and the memory-usage aggregation.

import { beforeEach, describe, expect, test } from "bun:test";
import { encodeResource, handle } from "./api.ts";
import { InMemoryPlatform } from "./data-memory.ts";
import { DemoOps } from "./ops-demo.ts";
import type { BlueprintCR, DeployableCR, RoomData } from "./viewmodel.ts";

describe("DemoOps", () => {
  const ops = new DemoOps();
  const game = "acme/friday-sandbox";

  test("info reports crashing game pods with restarts", async () => {
    const { pods } = await ops.info(game);
    expect(pods.length).toBeGreaterThanOrEqual(1);
    expect(pods[0]!.phase).toBe("CrashLoopBackOff");
    expect(pods[0]!.restarts).toBeGreaterThan(0);
    expect(pods[0]!.image).toContain("gmod");
  });

  test("metrics are deterministic and within limits", async () => {
    const m1 = await ops.metrics(game);
    const m2 = await ops.metrics(game);
    expect(m1).toEqual(m2); // deterministic (no RNG/clock)
    expect(m1.series.length).toBe(30);
    expect(m1.cpuMilli).toBeLessThanOrEqual(m1.cpuLimitMilli);
    expect(m1.storageTotalMi).toBeGreaterThan(0); // game server has a volume
  });

  test("files lists the game data root (the SFTP root)", async () => {
    const { entries } = await ops.files(game, "/data");
    expect(entries.some((e) => e.name === "garrysmod" && e.type === "dir")).toBe(true);
    expect(entries.some((e) => e.name === "server.cfg")).toBe(true);
  });

  test("access surfaces an RCON console + SFTP for a game server", async () => {
    const a = await ops.access(game);
    expect(a.console.kind).toBe("rcon");
    expect(a.sftp?.port).toBe(2222);
  });

  test("restart clears the crash loop; stop scales to 0; scale sets replicas", async () => {
    const o = new DemoOps();
    expect((await o.config(game)).replicas).toBe(1);
    expect((await o.info(game)).pods[0]!.restarts).toBe(7); // crashing baseline
    await o.lifecycle(game, "restart");
    const after = (await o.info(game)).pods[0]!;
    expect(after.restarts).toBe(0); // fresh pods
    expect(after.phase).toBe("Running");
    await o.lifecycle(game, "stop");
    expect((await o.config(game)).replicas).toBe(0);
    await o.lifecycle(game, "scale", 3);
    expect((await o.config(game)).replicas).toBe(3);
  });

  test("applyConfig patches values + sizing in the overlay", async () => {
    const o = new DemoOps();
    await o.applyConfig(game, { memory: "8Gi", values: { MAXPLAYERS: "64" } });
    const c = await o.config(game);
    expect(c.memory).toBe("8Gi");
    expect(c.values.MAXPLAYERS).toBe("64");
  });
});

describe("management BFF routes", () => {
  let data: InMemoryPlatform;
  const blueprints: BlueprintCR[] = [{ metadata: { name: "gmod", namespace: "zeta-platform" }, spec: { category: "game", image: "gmod" } }];
  const deployables: DeployableCR[] = [{ metadata: { name: "friday-sandbox", namespace: "acme" }, spec: { blueprint: "gmod" }, status: { phase: "CrashLoopBackOff" } }];
  const rooms: RoomData[] = [{ resource: "acme/friday-sandbox", events: [{ id: "evt-0", seq: 0, weight: 1, proposedBy: { id: "otto", kind: "persona" }, body: { type: "message", text: "hi" } }] }];
  beforeEach(() => {
    data = new InMemoryPlatform(structuredClone(deployables), structuredClone(blueprints), structuredClone(rooms));
  });
  const r = encodeResource("acme", "friday-sandbox");
  const get = (p: string) => handle(new Request(`http://x${p}`), data);
  const post = (p: string, b: unknown) => handle(new Request(`http://x${p}`, { method: "POST", body: JSON.stringify(b) }), data);
  const body = async (resp: Response | null) => (resp ? resp.json() : null) as any;

  test("GET info / metrics / logs / events / files / access / config", async () => {
    expect((await body(await get(`/api/resources/${r}/info`))).pods.length).toBeGreaterThan(0);
    expect((await body(await get(`/api/resources/${r}/metrics`))).series.length).toBe(30);
    expect((await body(await get(`/api/resources/${r}/logs`))).lines.length).toBeGreaterThan(0);
    expect((await body(await get(`/api/resources/${r}/events`))).events.length).toBeGreaterThan(0);
    expect((await body(await get(`/api/resources/${r}/files?path=/data`))).entries.length).toBeGreaterThan(0);
    expect((await body(await get(`/api/resources/${r}/access`))).console.kind).toBe("rcon");
    expect((await body(await get(`/api/resources/${r}/config`))).replicas).toBe(1);
  });

  test("POST lifecycle scale updates the reported replicas", async () => {
    const resp = await post(`/api/resources/${r}/lifecycle`, { action: "scale", replicas: 4 });
    expect((await body(resp)).ok).toBe(true);
    expect((await body(await get(`/api/resources/${r}/config`))).replicas).toBe(4);
  });

  test("POST lifecycle with a bad action → 400", async () => {
    const resp = await post(`/api/resources/${r}/lifecycle`, { action: "nuke" });
    expect(resp!.status).toBe(400);
  });

  test("POST config applies a patch", async () => {
    await post(`/api/resources/${r}/config`, { memory: "8Gi" });
    expect((await body(await get(`/api/resources/${r}/config`))).memory).toBe("8Gi");
  });

  test("GET /api/memory aggregates room-log bytes + events", async () => {
    const m = await body(await get("/api/memory"));
    expect(m.totalEvents).toBe(1);
    expect(m.totalBytes).toBeGreaterThan(0);
    expect(m.rooms[0].resource).toBe("acme/friday-sandbox");
  });
});
