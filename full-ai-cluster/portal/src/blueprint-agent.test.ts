// full-ai-cluster/portal/src/blueprint-agent.test.ts
import { describe, expect, test } from "bun:test";
import { build } from "./blueprint-agent.ts";
import { handle } from "./api.ts";
import { InMemoryPlatform } from "./data-memory.ts";

describe("blueprint builder BFF", () => {
  test("POST /api/blueprints/build proposes a spec from NL", async () => {
    const r = await handle(new Request("http://x/api/blueprints/build", { method: "POST", body: JSON.stringify({ message: "arma reforger server" }) }), {} as never);
    const j = (await r!.json()) as { spec?: { name: string } };
    expect(j.spec?.name).toBe("arma-reforger");
  });
  test("POST /api/blueprints saves it; the catalog then lists it", async () => {
    const data = new InMemoryPlatform([], [], []);
    const r = await handle(new Request("http://x/api/blueprints", { method: "POST", body: JSON.stringify({ name: "arma-reforger", spec: { category: "game", image: "ghcr.io/x/arma", storage: { size: "15Gi" }, defaultExpose: "lan", variables: [{ name: "SCENARIO" }] } }) }), data);
    expect((await r!.json() as { ok: boolean }).ok).toBe(true);
    const cat = await handle(new Request("http://x/api/catalog"), data);
    const j = (await cat!.json()) as { catalog: Array<{ blueprint: string }> };
    expect(j.catalog.some((b) => b.blueprint === "arma-reforger")).toBe(true);
  });
  test("POST /api/blueprints without image → 400", async () => {
    const r = await handle(new Request("http://x/api/blueprints", { method: "POST", body: JSON.stringify({ name: "x", spec: {} }) }), new InMemoryPlatform());
    expect(r!.status).toBe(400);
  });
});

describe("blueprint agent — game knowledge base", () => {
  test("Arma Reforger → app 1874900, UDP 2001 game port, scenario/maxplayers vars", () => {
    const r = build("set up an arma reforger server");
    expect(r.spec).toBeDefined();
    expect(r.spec!.name).toBe("arma-reforger");
    // The appid moved from a hand-written steamcmd line into STEAM_APPID,
    // because the ACE Mod image runs steamcmd itself. Same fact, checked where
    // it now lives — see the comment on the GAMES entry.
    expect(r.spec!.env!.STEAM_APPID).toBe("1874900");
    expect(r.spec!.ports!.some((p) => p.port === 2001 && p.protocol === "UDP")).toBe(true);
    expect(r.spec!.variables!.some((v) => v.name === "SCENARIO")).toBe(true);
    expect(r.spec!.resources!.memory).toBe("6Gi");
  });
  // The falsifier for the fix, not a restatement of it: overriding the image's
  // Cmd would skip both its SteamCMD install and its config generation, and the
  // `/opt/steamcmd/steamcmd.sh` install line this replaced pointed at a path no
  // image in this catalogue ships. Re-adding either turns this red.
  test("Arma Reforger issues no install script and no command override, and pins by digest", () => {
    const spec = build("arma reforger").spec!;
    expect(spec.install).toBeUndefined();
    expect(spec.command).toBeUndefined();
    expect(spec.image).toContain("@sha256:");
    expect(spec.image.startsWith("ghcr.io/acemod/arma-reforger")).toBe(true);
    expect(spec.storage!.mountPath).toBe("/reforger");
  });
  test("Unturned → app 1110390, three UDP ports", () => {
    const r = build("I want an unturned server");
    expect(r.spec!.install).toContain("1110390");
    expect(r.spec!.ports!.filter((p) => p.protocol === "UDP").length).toBe(3);
  });
  test("Garry's Mod → app 4020, sandbox/map vars, SFTP sidecar", () => {
    const r = build("gmod sandbox server");
    expect(r.spec!.install).toContain("4020");
    expect(r.spec!.variables!.some((v) => v.name === "GAMEMODE")).toBe(true);
    expect(r.spec!.sidecars!.some((s) => s.name === "sftp")).toBe(true);
  });
  test("unknown request → asks what to build, no spec", () => {
    const r = build("hello");
    expect(r.spec).toBeUndefined();
    expect(r.reply).toMatch(/Arma Reforger|game server|database/);
  });
  test("generic: 'a postgres database' → database blueprint", () => {
    expect(build("a postgres database").spec!.category).toBe("database");
  });
});

describe("blueprint agent — iteration on a draft", () => {
  const draft = build("arma reforger").spec!;
  test("expose public", () => {
    expect(build("expose it publicly", draft).spec!.defaultExpose).toBe("public");
  });
  test("more memory bumps the limit", () => {
    expect(build("give it more memory", draft).spec!.resources!.memory).toBe("8Gi");
  });
  test("set memory to a value", () => {
    expect(build("set memory to 12Gi", draft).spec!.resources!.memory).toBe("12Gi");
  });
  test("add a variable", () => {
    const r = build("add a variable RCON_PASSWORD", draft);
    expect(r.spec!.variables!.some((v) => v.name === "RCON_PASSWORD")).toBe(true);
  });
  test("add a port", () => {
    const r = build("add port 19999 udp", draft);
    expect(r.spec!.ports!.some((p) => p.port === 19999 && p.protocol === "UDP")).toBe(true);
  });
  test("rename", () => {
    expect(build("rename it to clan-reforger", draft).spec!.name).toBe("clan-reforger");
  });
});
