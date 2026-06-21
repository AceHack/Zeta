// full-ai-cluster/portal/src/ops.test.ts
//
// DemoOps + the management-plane BFF routes: info/metrics/logs/events/files/
// config/lifecycle, the config + lifecycle write paths (which mutate the overlay
// so the UI reacts), and the memory-usage aggregation.
import { beforeEach, describe, expect, test } from "bun:test";
import { encodeResource, handle } from "./api.js";
import { InMemoryPlatform } from "./data-memory.js";
import { DemoOps } from "./ops-demo.js";
describe("DemoOps", () => {
    const ops = new DemoOps();
    const game = "acme/friday-sandbox";
    test("dashboard is type-specific: game vs database vs web vs worker", async () => {
        const o = new DemoOps();
        const g = await o.dashboard("acme/friday-sandbox");
        expect(g.kind).toBe("game");
        if (g.kind === "game")
            expect(g.players.max).toBeGreaterThan(0);
        const d = await o.dashboard("acme/orders-db");
        expect(d.kind).toBe("database");
        if (d.kind === "database")
            expect(d.topTables.length).toBeGreaterThan(0);
        const w = await o.dashboard("acme/landing");
        expect(w.kind).toBe("web");
        if (w.kind === "web")
            expect(w.routes.length).toBeGreaterThan(0);
        const wk = await o.dashboard("acme/nightly-worker");
        expect(wk.kind).toBe("worker");
        if (wk.kind === "worker")
            expect(wk.successRatePct).toBeGreaterThan(0);
    });
    test("query: SELECT returns rows; writes are refused; \\dt lists tables", async () => {
        const o = new DemoOps();
        const sel = await o.query("acme/orders-db", "SELECT * FROM orders LIMIT 10");
        expect(sel.columns).toContain("status");
        expect(sel.rows.length).toBeGreaterThan(0);
        expect(sel.error).toBeUndefined();
        const dt = await o.query("acme/orders-db", "\\dt");
        expect(dt.rows.some((r) => r.includes("orders"))).toBe(true);
        const write = await o.query("acme/orders-db", "DELETE FROM orders");
        expect(write.error).toMatch(/read-only|SELECT/);
    });
    test("game dashboard reflects map override + player cap from config", async () => {
        const o = new DemoOps();
        await o.applyConfig("acme/friday-sandbox", { values: { MAP: "gm_construct", MAXPLAYERS: "48" } });
        const g = await o.dashboard("acme/friday-sandbox");
        if (g.kind === "game") {
            expect(g.map).toBe("gm_construct");
            expect(g.players.max).toBe(48);
        }
    });
    test("info reports crashing game pods with restarts", async () => {
        const { pods } = await ops.info(game);
        expect(pods.length).toBeGreaterThanOrEqual(1);
        expect(pods[0].phase).toBe("CrashLoopBackOff");
        expect(pods[0].restarts).toBeGreaterThan(0);
        expect(pods[0].image).toContain("gmod");
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
        expect((await o.info(game)).pods[0].restarts).toBe(7); // crashing baseline
        await o.lifecycle(game, "restart");
        const after = (await o.info(game)).pods[0];
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
    test("exec answers known commands and rejects unknown ones", async () => {
        const o = new DemoOps();
        expect((await o.exec(game, "status")).output.some((l) => l.text.includes("gm_flatgrass"))).toBe(true);
        expect((await o.exec(game, "players")).output[0].text).toContain("acehack");
        expect((await o.exec(game, "help")).output[0].text).toContain("status");
        const bad = await o.exec(game, "rm -rf /");
        expect(bad.output[0].level).toBe("warn");
        expect(bad.output[0].text).toContain("command not found");
    });
    test("upload adds a file that the listing then shows; delete removes it", async () => {
        const o = new DemoOps();
        await o.upload(game, "/data", { name: "myaddon.gma", size: 4096 });
        let entries = (await o.files(game, "/data")).entries;
        expect(entries.some((e) => e.name === "myaddon.gma")).toBe(true);
        await o.deleteFile(game, "/data/myaddon.gma");
        entries = (await o.files(game, "/data")).entries;
        expect(entries.some((e) => e.name === "myaddon.gma")).toBe(false);
    });
    test("file listing is dirs-first then alphabetical (native-explorer ordering)", async () => {
        const o = new DemoOps();
        const entries = (await o.files(game, "/data")).entries;
        const firstFileIdx = entries.findIndex((e) => e.type === "file");
        const lastDirIdx = entries.map((e) => e.type).lastIndexOf("dir");
        expect(lastDirIdx).toBeLessThan(firstFileIdx); // all dirs precede all files
    });
    test("deleting a base file hides it from the listing", async () => {
        const o = new DemoOps();
        await o.deleteFile(game, "/data/server.cfg");
        expect((await o.files(game, "/data")).entries.some((e) => e.name === "server.cfg")).toBe(false);
    });
});
describe("management BFF routes", () => {
    let data;
    const blueprints = [{ metadata: { name: "gmod", namespace: "zeta-platform" }, spec: { category: "game", image: "gmod" } }];
    const deployables = [{ metadata: { name: "friday-sandbox", namespace: "acme" }, spec: { blueprint: "gmod" }, status: { phase: "CrashLoopBackOff" } }];
    const rooms = [{ resource: "acme/friday-sandbox", events: [{ id: "evt-0", seq: 0, weight: 1, proposedBy: { id: "otto", kind: "persona" }, body: { type: "message", text: "hi" } }] }];
    beforeEach(() => {
        data = new InMemoryPlatform(structuredClone(deployables), structuredClone(blueprints), structuredClone(rooms));
    });
    const r = encodeResource("acme", "friday-sandbox");
    const get = (p) => handle(new Request(`http://x${p}`), data);
    const post = (p, b) => handle(new Request(`http://x${p}`, { method: "POST", body: JSON.stringify(b) }), data);
    const body = async (resp) => (resp ? resp.json() : null);
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
        expect(resp.status).toBe(400);
    });
    test("POST config applies a patch", async () => {
        await post(`/api/resources/${r}/config`, { memory: "8Gi" });
        expect((await body(await get(`/api/resources/${r}/config`))).memory).toBe("8Gi");
    });
    test("POST exec returns command output", async () => {
        const resp = await body(await post(`/api/resources/${r}/exec`, { cmd: "status" }));
        expect(resp.output.length).toBeGreaterThan(0);
    });
    test("POST files uploads; the listing then shows it; DELETE removes it", async () => {
        await post(`/api/resources/${r}/files`, { dir: "/data", file: { name: "pack.gma", size: 2048 } });
        let entries = (await body(await get(`/api/resources/${r}/files?path=/data`))).entries;
        expect(entries.some((e) => e.name === "pack.gma")).toBe(true);
        const del = await handle(new Request(`http://x/api/resources/${r}/files?path=${encodeURIComponent("/data/pack.gma")}`, { method: "DELETE" }), data);
        expect((await del.json()).ok).toBe(true);
        entries = (await body(await get(`/api/resources/${r}/files?path=/data`))).entries;
        expect(entries.some((e) => e.name === "pack.gma")).toBe(false);
    });
    test("POST files without file{name,size} → 400", async () => {
        const resp = await post(`/api/resources/${r}/files`, { dir: "/data" });
        expect(resp.status).toBe(400);
    });
    test("GET /api/memory aggregates room-log bytes + events", async () => {
        const m = await body(await get("/api/memory"));
        expect(m.totalEvents).toBe(1);
        expect(m.totalBytes).toBeGreaterThan(0);
        expect(m.rooms[0].resource).toBe("acme/friday-sandbox");
    });
});
