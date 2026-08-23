// full-ai-cluster/portal/src/blueprint-agent.ts
//
// The Blueprint agent — turns "set up an Arma Reforger server" into a complete,
// deployable Blueprint, and iterates on follow-ups ("expose on LAN", "give it
// more memory", "add a MAXPLAYERS variable"). Pure: build(request, draft?) →
// { reply, spec? }. A deterministic builder for the demo, with a real game-server
// knowledge base (SteamCMD app ids + ports + the usual knobs); a real LLM slots
// in behind the same contract. This is what makes blueprint creation agentic —
// users and automated agent tasks both drive it.

export interface BlueprintVariable { name: string; default?: string; description?: string }
export interface BlueprintPort { name: string; port: number; protocol?: "TCP" | "UDP"; web?: boolean }
export interface BlueprintSidecar { name: string; image: string; mountDataAt?: string }
export interface BlueprintProposal {
  name: string;
  category: string; // game | database | web | app
  image: string;
  install?: string;
  command?: string[];
  args?: string[];
  env?: Record<string, string>;
  ports?: BlueprintPort[];
  storage?: { size: string; mountPath: string };
  resources?: { cpu?: string; memory?: string };
  variables?: BlueprintVariable[];
  sidecars?: BlueprintSidecar[];
  defaultExpose?: "none" | "cluster" | "lan" | "public";
}

const SFTP: BlueprintSidecar = { name: "sftp", image: "atmoz/sftp:alpine", mountDataAt: "/home/zeta/data" };
const steam = (appId: number, dir = "/data") => `/opt/steamcmd/steamcmd.sh +force_install_dir ${dir} +login anonymous +app_update ${appId} validate +quit`;

// ── the game-server knowledge base (real SteamCMD specs) ───────────────
interface GameDef { match: RegExp; build: () => BlueprintProposal; note: string }

const GAMES: GameDef[] = [
  {
    match: /gmod|garry'?s ?mod|garrys/i,
    note: "Garry's Mod (Source dedicated, SteamCMD app 4020) — UDP 27015, world+addons persist, SFTP for the data root.",
    build: () => ({
      name: "gmod", category: "game", image: "ghcr.io/ich777/steamcmd:gmod",
      install: steam(4020), command: ["/data/srcds_run"],
      args: ["-game", "garrysmod", "-port", "${PORT}", "+maxplayers", "${MAXPLAYERS}", "+gamemode", "${GAMEMODE}", "+map", "${MAP}"],
      env: { SRCDS_PORT: "${PORT}" }, ports: [{ name: "game", port: 27015, protocol: "UDP" }],
      storage: { size: "20Gi", mountPath: "/data" }, resources: { cpu: "2", memory: "4Gi" },
      variables: [{ name: "PORT", default: "27015" }, { name: "MAP", default: "gm_construct" }, { name: "GAMEMODE", default: "sandbox" }, { name: "MAXPLAYERS", default: "16" }],
      sidecars: [SFTP], defaultExpose: "lan",
    }),
  },
  {
    match: /unturned/i,
    note: "Unturned (SteamCMD app 1110390) — UDP 27015 (+ query 27016/27017), Rocket-friendly, SFTP for Servers/<name>/.",
    build: () => ({
      name: "unturned", category: "game", image: "ghcr.io/ich777/steamcmd:unturned",
      install: steam(1110390), command: ["/data/ServerHelper.sh"],
      args: ["+InternetServer/${SERVERNAME}", "+map/${MAP}", "+Max_Players/${MAXPLAYERS}"],
      ports: [{ name: "game", port: 27015, protocol: "UDP" }, { name: "query", port: 27016, protocol: "UDP" }, { name: "query2", port: 27017, protocol: "UDP" }],
      storage: { size: "10Gi", mountPath: "/data" }, resources: { cpu: "2", memory: "3Gi" },
      variables: [{ name: "SERVERNAME", default: "Zeta", description: "instance name (folder under Servers/)" }, { name: "MAP", default: "PEI" }, { name: "MAXPLAYERS", default: "24" }],
      sidecars: [SFTP], defaultExpose: "lan",
    }),
  },
  {
    // Arma Reforger is the one game here whose SteamCMD-base image does not
    // exist: `ghcr.io/ich777/steamcmd:armareforger` is a 404 and that publisher
    // ships no Arma Reforger image under any name (94 tags enumerated
    // 2026-08-23; only `arma3` and `arma3exilemod` are arma-family). It is
    // therefore the one entry that is NOT `steam(appid)`-shaped: ACE Mod's
    // image installs and launches the app itself from `STEAM_APPID`, so the
    // draft configures by environment and issues no install/command. Pinned by
    // digest with the tag kept beside it for legibility; the digest is what the
    // registry resolves. Provenance and the full measurement live in the
    // Blueprint itself — full-ai-cluster/k8s/applications/platform/blueprints.yaml.
    match: /arma ?reforger|reforger|arma/i,
    note: "Arma Reforger Dedicated (Steam app 1874900) — UDP 2001 game + 17777 A2S query, env-configured, heavier (6Gi).",
    build: () => ({
      name: "arma-reforger", category: "game",
      image: "ghcr.io/acemod/arma-reforger:sha-cd226c0@sha256:90883ce2f3d8b3b5b132ae7f4b3377afdc9e6be7e7c8cb1a290f8bd7b39d079c",
      env: {
        STEAM_APPID: "1874900", GAME_NAME: "${SERVERNAME}", GAME_SCENARIO_ID: "${SCENARIO}",
        GAME_MAX_PLAYERS: "${MAXPLAYERS}", SERVER_BIND_PORT: "${GAME_PORT}",
        SERVER_PUBLIC_PORT: "${GAME_PORT}", SERVER_A2S_PORT: "17777", ARMA_CONFIG: "${CONFIG}",
      },
      ports: [{ name: "game", port: 2001, protocol: "UDP" }, { name: "query", port: 17777, protocol: "UDP" }],
      storage: { size: "15Gi", mountPath: "/reforger" }, resources: { cpu: "4", memory: "6Gi" },
      variables: [{ name: "SERVERNAME", default: "Zeta Reforger" }, { name: "SCENARIO", default: "{ECC61978EDCC2B5A}Missions/23_Campaign.conf", description: "GAME_SCENARIO_ID — the image's documented default scenario id" }, { name: "MAXPLAYERS", default: "32" }, { name: "CONFIG", default: "docker_generated", description: "ARMA_CONFIG — `docker_generated` builds the config from these variables; anything else is a filename under /reforger/Configs" }, { name: "GAME_PORT", default: "2001" }],
      sidecars: [SFTP], defaultExpose: "lan",
    }),
  },
  {
    match: /valheim/i,
    note: "Valheim Dedicated (SteamCMD app 896660) — UDP 2456-2458, world saves persist.",
    build: () => ({
      name: "valheim", category: "game", image: "ghcr.io/ich777/steamcmd:valheim",
      install: steam(896660), command: ["/data/valheim_server.x86_64"],
      args: ["-name", "${SERVERNAME}", "-world", "${WORLD}", "-password", "${PASSWORD}", "-port", "2456"],
      ports: [{ name: "game", port: 2456, protocol: "UDP" }, { name: "query", port: 2457, protocol: "UDP" }],
      storage: { size: "8Gi", mountPath: "/data" }, resources: { cpu: "2", memory: "4Gi" },
      variables: [{ name: "SERVERNAME", default: "Zeta" }, { name: "WORLD", default: "Dedicated" }, { name: "PASSWORD", default: "change-me", description: "min 5 chars" }],
      sidecars: [SFTP], defaultExpose: "lan",
    }),
  },
  {
    match: /\brust\b/i,
    note: "Rust Dedicated (SteamCMD app 258550) — UDP 28015, RAM-hungry (8Gi+).",
    build: () => ({
      name: "rust", category: "game", image: "ghcr.io/ich777/steamcmd:rust",
      install: steam(258550), command: ["/data/RustDedicated"],
      args: ["-batchmode", "+server.port", "28015", "+server.maxplayers", "${MAXPLAYERS}", "+server.hostname", "${SERVERNAME}", "+server.worldsize", "${WORLDSIZE}"],
      ports: [{ name: "game", port: 28015, protocol: "UDP" }], storage: { size: "20Gi", mountPath: "/data" }, resources: { cpu: "4", memory: "8Gi" },
      variables: [{ name: "SERVERNAME", default: "Zeta Rust" }, { name: "MAXPLAYERS", default: "50" }, { name: "WORLDSIZE", default: "3000" }],
      sidecars: [SFTP], defaultExpose: "lan",
    }),
  },
  {
    match: /minecraft|mc server/i,
    note: "Minecraft (itzg/minecraft-server) — TCP 25565, mod/plugin friendly via env.",
    build: () => ({
      name: "minecraft", category: "game", image: "itzg/minecraft-server:latest",
      env: { EULA: "TRUE", TYPE: "${TYPE}", VERSION: "${VERSION}", MOTD: "${MOTD}", MAX_PLAYERS: "${MAXPLAYERS}", MEMORY: "3G" },
      ports: [{ name: "game", port: 25565, protocol: "TCP" }], storage: { size: "10Gi", mountPath: "/data" }, resources: { cpu: "2", memory: "4Gi" },
      variables: [{ name: "TYPE", default: "PAPER", description: "VANILLA | PAPER | FABRIC | FORGE" }, { name: "VERSION", default: "LATEST" }, { name: "MOTD", default: "A Zeta server" }, { name: "MAXPLAYERS", default: "20" }],
      sidecars: [SFTP], defaultExpose: "lan",
    }),
  },
];

export interface BuildResult {
  reply: string;
  spec?: BlueprintProposal;
}

const num = (s: string): string | undefined => (s.match(/\b(\d+(?:gi|mi|g|m)?)\b/i) ?? [])[1];

/**
 * Build or refine a Blueprint from a natural-language message.
 * - With no draft: detect a known game (or fall to a generic recipe) and propose one.
 * - With a draft: apply the follow-up edit (expose / memory / variable / port / rename).
 */
export function build(message: string, draft?: BlueprintProposal): BuildResult {
  const t = message.toLowerCase().trim();

  // ── iterate on an existing draft ──────────────────────────────────
  if (draft) {
    const d: BlueprintProposal = structuredClone(draft);
    // exposure (handles "expose it publicly", "make it lan", …)
    if (/expos|publi|reachable|\blan\b|cluster|internal|private|make it (public|private)/.test(t)) {
      let e: BlueprintProposal["defaultExpose"] | undefined;
      if (/publi/.test(t)) e = "public";
      else if (/\blan\b/.test(t)) e = "lan";
      else if (/cluster|internal/.test(t)) e = "cluster";
      else if (/private|none|no expos/.test(t)) e = "none";
      if (e) { d.defaultExpose = e; return { reply: `Set exposure to ${e}.`, spec: d }; }
    }
    if (/memory|ram/.test(t)) {
      let m = num(t);
      if (!m && /\bmore\b/.test(t)) m = `${parseInt(d.resources?.memory ?? "4", 10) + 2}Gi`;
      if (m) {
        m = /[a-z]/i.test(m) ? m.replace(/gi$/i, "Gi").replace(/mi$/i, "Mi").replace(/g$/i, "Gi").replace(/m$/i, "Mi") : `${m}Gi`;
        d.resources = { ...d.resources, memory: m };
        return { reply: `Memory limit set to ${m}.`, spec: d };
      }
    }
    if (/\bcpu\b|\bcores?\b/.test(t)) { const c = num(t); if (c) { d.resources = { ...d.resources, cpu: c.replace(/[a-z]+/i, "") }; return { reply: `CPU limit set to ${d.resources!.cpu}.`, spec: d }; } }
    const v = t.match(/add (?:a )?(?:variable|var|knob)\s+([a-z_][a-z0-9_]*)/i);
    if (v) { d.variables = [...(d.variables ?? []), { name: v[1]!.toUpperCase() }]; return { reply: `Added variable ${v[1]!.toUpperCase()}. Fill its default in the form.`, spec: d }; }
    const port = t.match(/add (?:a )?port\s+(\d+)(?:\s*(udp|tcp))?/i);
    if (port) { d.ports = [...(d.ports ?? []), { name: `port-${port[1]}`, port: Number(port[1]), protocol: (port[2]?.toUpperCase() as "TCP" | "UDP") ?? "TCP" }]; return { reply: `Added ${port[2]?.toUpperCase() ?? "TCP"} port ${port[1]}.`, spec: d }; }
    const rn = t.match(/(?:rename|call|name)\s+(?:it\s+)?(?:to\s+)?([a-z0-9][a-z0-9-]*)/i);
    if (rn && rn[1] !== "it" && rn[1] !== "to") { d.name = rn[1]!; return { reply: `Renamed the blueprint to "${d.name}".`, spec: d }; }
    if (/sftp|file|ftp/.test(t) && !d.sidecars?.length) { d.sidecars = [SFTP]; return { reply: "Added an SFTP sidecar for file access on the data volume.", spec: d }; }
    return { reply: `I can tweak: exposure (lan/public/cluster), memory/cpu, "add variable NAME", "add port N", rename, or SFTP. Or save it as is.`, spec: d };
  }

  // ── fresh build: detect a known game ──────────────────────────────
  const game = GAMES.find((g) => g.match.test(message));
  if (game) {
    const spec = game.build();
    return { reply: `Here's a ready-to-deploy blueprint for ${spec.name}. ${game.note}\nTweak it ("expose public", "more memory", "add variable X") or save it to the catalog.`, spec };
  }

  // ── generic recipes by keyword ────────────────────────────────────
  if (/postgres|database|\bdb\b|sql/.test(t))
    return { reply: "A PostgreSQL blueprint (stateful, cluster-internal). Tweak or save.", spec: { name: "postgres", category: "database", image: "postgres:16-alpine", env: { POSTGRES_DB: "${DB}", POSTGRES_USER: "${USER}", POSTGRES_PASSWORD: "${PASSWORD}", PGDATA: "/var/lib/postgresql/data/pgdata" }, ports: [{ name: "sql", port: 5432, protocol: "TCP" }], storage: { size: "20Gi", mountPath: "/var/lib/postgresql/data" }, resources: { cpu: "1", memory: "1Gi" }, variables: [{ name: "DB", default: "app" }, { name: "USER", default: "app" }, { name: "PASSWORD", default: "change-me" }], defaultExpose: "cluster" } };
  if (/web|site|nginx|static|frontend/.test(t))
    return { reply: "A static web blueprint (stateless, public HTTPS). Tweak or save.", spec: { name: "web", category: "web", image: "nginx:1.27-alpine", ports: [{ name: "http", port: 8080, web: true }], resources: { cpu: "250m", memory: "256Mi" }, defaultExpose: "public" } };

  return { reply: `Tell me what to build — a game server (try "Arma Reforger", "Unturned", "Garry's Mod", "Valheim", "Rust", "Minecraft"), a database, or a web app. I'll draft a complete blueprint you can tweak and save.` };
}

/** The games the agent knows out of the box (for UI quick-picks). */
export const KNOWN_GAMES = ["Garry's Mod", "Unturned", "Arma Reforger", "Valheim", "Rust", "Minecraft"];
