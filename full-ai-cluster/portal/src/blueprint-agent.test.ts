// full-ai-cluster/portal/src/blueprint-agent.test.ts
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "./blueprint-agent.ts";
import { handle } from "./api.ts";
import { InMemoryPlatform } from "./data-memory.ts";
import { type Blueprint, renderDeployable } from "../../platform-controller/src/blueprint.ts";
import { API_VERSION } from "../../platform-controller/src/types.ts";
import { ICH777_IMAGE_PREFIX, ich777ContractViolations, sftpGateViolations } from "../../platform-controller/src/steamcmd-contract.ts";

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
    expect(r.spec!.env!.GAME_ID).toBe("1110390");
    expect(r.spec!.ports!.filter((p) => p.protocol === "UDP").length).toBe(3);
  });
  test("Garry's Mod → app 4020, sandbox/map vars, SFTP sidecar", () => {
    const r = build("gmod sandbox server");
    expect(r.spec!.env!.GAME_ID).toBe("4020");
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

// ── drafts satisfy the SAME contract as the shipped library ─────────────
// Every game draft is rendered through the platform controller's own
// renderDeployable() and judged by the same helpers blueprint.test.ts uses
// (platform-controller/src/steamcmd-contract.ts), so the generator and the
// library cannot drift apart. Evidence for each expectation lives in that file:
//   * ich777 images: Entrypoint /opt/scripts/start.sh, no /opt/steamcmd, GAME_ID
//     drives the install into /serverdata/serverfiles; UID=99 GID=100 (read from
//     the registry config of garrysmod / unturned / valheim / rust, 2026-09-28).
//     `:gmod` is not a tag (manifest fetch fails); the publisher's tag is `garrysmod`.
//   * atmoz/sftp sidecars are opt-in via the optional <resource>-sftp-keys ConfigMap.
//   * sftp user = the data owner: 99:100 for ich777; 1000:1000 for itzg/minecraft-server
//     (registry config of :latest, index sha256:83c076bb24c8…, Env UID=1000 GID=1000,
//     no User); 1000:1000 (fsGroup) for arma-reforger, whose image runs as root.
describe("blueprint agent — drafts satisfy the rendered-pod contract (shared with blueprint.test.ts)", () => {
  const ICH777: Record<string, { appId: string; gamePort: string; tag: string }> = {
    gmod: { appId: "4020", gamePort: "27015", tag: "garrysmod" },
    unturned: { appId: "1110390", gamePort: "27015", tag: "unturned" },
    valheim: { appId: "896660", gamePort: "2456", tag: "valheim" },
    rust: { appId: "258550", gamePort: "28015", tag: "rust" },
  };
  const PROMPTS: Record<string, string> = {
    gmod: "gmod server", unturned: "unturned server", valheim: "valheim server", rust: "rust server",
    "arma-reforger": "arma reforger server", minecraft: "minecraft server",
  };
  const SFTP_USER: Record<string, string> = {
    gmod: "zeta::99:100", unturned: "zeta::99:100", valheim: "zeta::99:100", rust: "zeta::99:100",
    "arma-reforger": "zeta::1000:1000", minecraft: "zeta::1000:1000",
  };
  const ROOT = mkdtempSync(join(tmpdir(), "portal-sftp-keys-")).replaceAll("\\", "/");
  afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

  // biome-ignore lint/suspicious/noExplicitAny: rendered pod spec
  const renderPod = (name: string): any => {
    const spec = build(PROMPTS[name]!).spec!;
    expect(spec.name).toBe(name);
    const objs = renderDeployable(spec as Blueprint, {
      apiVersion: API_VERSION, kind: "Deployable",
      metadata: { name: `${name}-srv`, namespace: "tenant-a", uid: `uid-${name}` },
      spec: { blueprint: name },
    });
    const sts = objs.filter((o) => o.kind === "StatefulSet");
    expect(sts.length).toBe(1);
    // biome-ignore lint/suspicious/noExplicitAny: rendered object
    return (sts[0]!.spec as any).template.spec;
  };

  for (const [name, want] of Object.entries(ICH777)) {
    test(`${name}: names a real ich777 tag (${want.tag})`, () => {
      expect(build(PROMPTS[name]!).spec!.image).toBe(`${ICH777_IMAGE_PREFIX}${want.tag}`);
    });
    test(`${name}: rendered draft satisfies the ich777 contract`, () => {
      expect(ich777ContractViolations(renderPod(name), want)).toEqual([]);
    });
  }

  test("'add sftp' on a draft without one adds the opt-in sidecar, not a bare atmoz", async () => {
    const draft = { ...build("postgres database").spec!, name: "pg", sidecars: [] };
    const spec = build("add sftp access", draft).spec!;
    const objs = renderDeployable(spec as Blueprint, {
      apiVersion: API_VERSION, kind: "Deployable", metadata: { name: "pg-srv", namespace: "tenant-a", uid: "uid-pg" }, spec: { blueprint: "pg" },
    });
    // biome-ignore lint/suspicious/noExplicitAny: rendered object
    const podSpec = (objs.find((o) => o.kind === "StatefulSet")!.spec as any).template.spec;
    expect(await sftpGateViolations(podSpec, "pg-srv", "zeta::1000:1000", ROOT)).toEqual([]);
  });

  for (const [name, user] of Object.entries(SFTP_USER)) {
    test(`${name}: sftp sidecar is opt-in and starts atmoz as ${user}`, async () => {
      expect(await sftpGateViolations(renderPod(name), `${name}-srv`, user, ROOT)).toEqual([]);
    });
  }
});
