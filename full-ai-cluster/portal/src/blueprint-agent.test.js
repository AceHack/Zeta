// full-ai-cluster/portal/src/blueprint-agent.test.ts
import { describe, expect, test } from "bun:test";
import { build } from "./blueprint-agent.js";
import { handle } from "./api.js";
import { InMemoryPlatform } from "./data-memory.js";
describe("blueprint builder BFF", () => {
    test("POST /api/blueprints/build proposes a spec from NL", async () => {
        const r = await handle(new Request("http://x/api/blueprints/build", { method: "POST", body: JSON.stringify({ message: "arma reforger server" }) }), {});
        const j = (await r.json());
        expect(j.spec?.name).toBe("arma-reforger");
    });
    test("POST /api/blueprints saves it; the catalog then lists it", async () => {
        const data = new InMemoryPlatform([], [], []);
        const r = await handle(new Request("http://x/api/blueprints", { method: "POST", body: JSON.stringify({ name: "arma-reforger", spec: { category: "game", image: "ghcr.io/x/arma", storage: { size: "15Gi" }, defaultExpose: "lan", variables: [{ name: "SCENARIO" }] } }) }), data);
        expect((await r.json()).ok).toBe(true);
        const cat = await handle(new Request("http://x/api/catalog"), data);
        const j = (await cat.json());
        expect(j.catalog.some((b) => b.blueprint === "arma-reforger")).toBe(true);
    });
    test("POST /api/blueprints without image → 400", async () => {
        const r = await handle(new Request("http://x/api/blueprints", { method: "POST", body: JSON.stringify({ name: "x", spec: {} }) }), new InMemoryPlatform());
        expect(r.status).toBe(400);
    });
});
describe("blueprint agent — game knowledge base", () => {
    test("Arma Reforger → app 1874900, UDP 2001 game port, scenario/maxplayers vars", () => {
        const r = build("set up an arma reforger server");
        expect(r.spec).toBeDefined();
        expect(r.spec.name).toBe("arma-reforger");
        expect(r.spec.install).toContain("1874900");
        expect(r.spec.ports.some((p) => p.port === 2001 && p.protocol === "UDP")).toBe(true);
        expect(r.spec.variables.some((v) => v.name === "SCENARIO")).toBe(true);
        expect(r.spec.resources.memory).toBe("6Gi");
    });
    test("Unturned → app 1110390, three UDP ports", () => {
        const r = build("I want an unturned server");
        expect(r.spec.install).toContain("1110390");
        expect(r.spec.ports.filter((p) => p.protocol === "UDP").length).toBe(3);
    });
    test("Garry's Mod → app 4020, sandbox/map vars, SFTP sidecar", () => {
        const r = build("gmod sandbox server");
        expect(r.spec.install).toContain("4020");
        expect(r.spec.variables.some((v) => v.name === "GAMEMODE")).toBe(true);
        expect(r.spec.sidecars.some((s) => s.name === "sftp")).toBe(true);
    });
    test("unknown request → asks what to build, no spec", () => {
        const r = build("hello");
        expect(r.spec).toBeUndefined();
        expect(r.reply).toMatch(/Arma Reforger|game server|database/);
    });
    test("generic: 'a postgres database' → database blueprint", () => {
        expect(build("a postgres database").spec.category).toBe("database");
    });
});
describe("blueprint agent — iteration on a draft", () => {
    const draft = build("arma reforger").spec;
    test("expose public", () => {
        expect(build("expose it publicly", draft).spec.defaultExpose).toBe("public");
    });
    test("more memory bumps the limit", () => {
        expect(build("give it more memory", draft).spec.resources.memory).toBe("8Gi");
    });
    test("set memory to a value", () => {
        expect(build("set memory to 12Gi", draft).spec.resources.memory).toBe("12Gi");
    });
    test("add a variable", () => {
        const r = build("add a variable RCON_PASSWORD", draft);
        expect(r.spec.variables.some((v) => v.name === "RCON_PASSWORD")).toBe(true);
    });
    test("add a port", () => {
        const r = build("add port 19999 udp", draft);
        expect(r.spec.ports.some((p) => p.port === 19999 && p.protocol === "UDP")).toBe(true);
    });
    test("rename", () => {
        expect(build("rename it to clan-reforger", draft).spec.name).toBe("clan-reforger");
    });
});
