// full-ai-cluster/portal/src/ops-demo.ts
//
// A rich, deterministic ResourceOps for local dev / design review (PORTAL_DEMO).
// Data is seeded from the resource name (no wall-clock / RNG) so the console is
// fully populated and replayable. Lifecycle / config writes mutate an in-memory
// overlay so the UI reacts (restart bumps restarts, scale changes replicas, …).

import type {
  AccessInfo,
  K8sEvent,
  LifecycleAction,
  LifecycleResult,
  LogLine,
  Metrics,
  PodInfo,
  ResourceConfig,
  ResourceOps,
} from "./ops.ts";

const seed = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

interface Overlay {
  replicas?: number;
  restarts?: number;
  phase?: string;
  cpu?: string;
  memory?: string;
  storage?: string;
  values?: Record<string, string>;
}

const GAME = (r: string) => r.includes("sandbox") || r.includes("gmod") || r.includes("game");
// NB: "sandbox" contains the substring "db" — match a db on a word boundary only.
const DB = (r: string) => /(^|[-/])db($|[-/])|-db$|postgres|sql/.test(r) && !GAME(r);

export class DemoOps implements ResourceOps {
  private overlay = new Map<string, Overlay>();
  private ov(r: string): Overlay {
    let o = this.overlay.get(r);
    if (!o) this.overlay.set(r, (o = {}));
    return o;
  }

  async info(resource: string): Promise<{ pods: PodInfo[] }> {
    const o = this.ov(resource);
    const replicas = o.replicas ?? (GAME(resource) ? 1 : DB(resource) ? 1 : 2);
    const crashing = resource.includes("sandbox");
    const image = GAME(resource) ? "ghcr.io/ich777/steamcmd:gmod" : DB(resource) ? "postgres:16-alpine" : "nginx:1.27-alpine";
    const pods: PodInfo[] = Array.from({ length: Math.max(replicas, 1) }, (_, i) => ({
      name: `${resource.split("/")[1]}-${i}`,
      phase: o.phase ?? (crashing ? "CrashLoopBackOff" : "Running"),
      ready: !crashing,
      restarts: o.restarts ?? (crashing ? 7 : 0),
      node: `zeta-node-${(seed(resource) + i) % 3}`,
      ip: `10.42.${seed(resource) % 4}.${20 + i}`,
      ageSeconds: 3600 * (6 + (seed(resource) % 40)) + i * 37,
      image,
    }));
    return { pods };
  }

  async metrics(resource: string): Promise<Metrics> {
    const base = seed(resource);
    const cpuLimit = GAME(resource) ? 2000 : DB(resource) ? 1000 : 1000;
    const memLimit = GAME(resource) ? 4096 : DB(resource) ? 1024 : 512;
    // a deterministic 30-point window
    const series = Array.from({ length: 30 }, (_, i) => {
      const wob = Math.sin((i + base) / 3) * 0.18 + Math.sin((i + base) / 7) * 0.1;
      const load = GAME(resource) ? 0.55 : DB(resource) ? 0.4 : 0.25;
      return { t: i - 29, cpu: Math.round(cpuLimit * Math.max(0.05, load + wob)), mem: Math.round(memLimit * Math.max(0.1, load * 0.9 + wob * 0.5)) };
    });
    const last = series[series.length - 1]!;
    const storageTotal = GAME(resource) ? 20480 : DB(resource) ? 20480 : 0;
    return {
      cpuMilli: last.cpu,
      cpuLimitMilli: cpuLimit,
      memMi: last.mem,
      memLimitMi: memLimit,
      storageUsedMi: storageTotal ? Math.round(storageTotal * (0.2 + (base % 50) / 100)) : 0,
      storageTotalMi: storageTotal,
      series,
    };
  }

  async logs(resource: string, opts?: { tail?: number }): Promise<LogLine[]> {
    const lines: LogLine[] = GAME(resource)
      ? [
          { ts: "12:00:01", level: "info", text: "SteamCMD: app 4020 fully installed" },
          { ts: "12:00:03", level: "info", text: "Server 'friday-sandbox' starting on map gm_flatgrass" },
          { ts: "12:00:05", level: "info", text: "Network: UDP 27015 bound (LB 10.42.0.40)" },
          { ts: "12:01:22", level: "warn", text: "Lua: addon 'pac3' slow to load (1.8s)" },
          { ts: "12:04:11", level: "info", text: "Player 'acehack' connected (1/32)" },
          { ts: "12:09:48", level: "error", text: "OOM: srcds exceeded 6Gi memory limit, container killed" },
          { ts: "12:09:50", level: "warn", text: "kubelet: Back-off restarting failed container" },
        ]
      : DB(resource)
        ? [
            { ts: "08:00:00", level: "info", text: "PostgreSQL 16.2 starting" },
            { ts: "08:00:01", level: "info", text: "database system is ready to accept connections" },
            { ts: "08:14:09", level: "info", text: "checkpoint complete: wrote 142 buffers" },
            { ts: "09:31:55", level: "warn", text: "connection count 78/100" },
          ]
        : [
            { ts: "06:00:00", level: "info", text: "nginx 1.27 started, worker processes 2" },
            { ts: "06:00:00", level: "info", text: "listening on 0.0.0.0:8080" },
            { ts: "10:22:31", level: "info", text: 'GET / 200 12ms "Mozilla/5.0"' },
          ];
    const tail = opts?.tail ?? 200;
    return lines.slice(-tail);
  }

  async events(resource: string): Promise<K8sEvent[]> {
    const crashing = resource.includes("sandbox");
    const base: K8sEvent[] = [
      { ts: "12:00:00", type: "Normal", reason: "Scheduled", message: `assigned to zeta-node-${seed(resource) % 3}` },
      { ts: "12:00:02", type: "Normal", reason: "Pulled", message: "container image already present on machine" },
      { ts: "12:00:03", type: "Normal", reason: "Started", message: "started container main" },
    ];
    if (crashing)
      base.push(
        { ts: "12:09:48", type: "Warning", reason: "OOMKilling", message: "Memory cgroup out of memory: killed process srcds" },
        { ts: "12:09:50", type: "Warning", reason: "BackOff", message: "Back-off restarting failed container main" },
      );
    return base;
  }

  async files(resource: string, path: string): Promise<{ path: string; entries: import("./ops.ts").FileNode[] }> {
    const p = path || "/data";
    const mk = (name: string, type: "file" | "dir", size: number) => ({ name, path: `${p.replace(/\/$/, "")}/${name}`, type, size, modified: "2026-06-08 11:42" });
    if (!GAME(resource) && !DB(resource)) return { path: p, entries: [mk("index.html", "file", 1284), mk("assets", "dir", 0)] };
    if (DB(resource)) return { path: p, entries: [mk("base", "dir", 0), mk("pg_wal", "dir", 0), mk("postgresql.conf", "file", 28_900), mk("pg_hba.conf", "file", 4_096)] };
    // game server data root (the SFTP root)
    if (p === "/data")
      return { path: p, entries: [mk("garrysmod", "dir", 0), mk("srcds_run", "file", 9_213), mk("steam_appid.txt", "file", 5), mk("server.cfg", "file", 1_842)] };
    return { path: p, entries: [mk("addons", "dir", 0), mk("maps", "dir", 0), mk("cfg", "dir", 0), mk("settings.lua", "file", 612)] };
  }

  async access(resource: string): Promise<AccessInfo> {
    const pod = `${resource.split("/")[1]}-0`;
    if (GAME(resource))
      return {
        console: { kind: "rcon", command: `kubectl exec -it ${pod} -- ./srcds_run console`, note: "Game console (RCON). Live interactive console lands with the exec WebSocket." },
        sftp: { host: "10.42.0.40", port: 2222, user: "zeta", path: "/data", note: "SFTP sidecar — the game data root (addons, maps, cfg)." },
      };
    return { console: { kind: "shell", command: `kubectl exec -it ${pod} -- /bin/sh`, note: "Pod shell. Live interactive terminal lands with the exec WebSocket." } };
  }

  async config(resource: string): Promise<ResourceConfig> {
    const o = this.ov(resource);
    const game = GAME(resource), db = DB(resource);
    const storage = o.storage ?? (game ? "20Gi" : db ? "20Gi" : undefined);
    const host = !game && !db ? "demo.zeta.example.com" : undefined;
    return {
      replicas: o.replicas ?? (game || db ? 1 : 2),
      cpu: o.cpu ?? (game ? "2" : "1"),
      memory: o.memory ?? (game ? "6Gi" : db ? "1Gi" : "256Mi"),
      ...(storage !== undefined ? { storage } : {}),
      expose: game ? "lan" : db ? "cluster" : "public",
      ...(host !== undefined ? { host } : {}),
      values: o.values ?? (game ? { MAP: "gm_flatgrass", MAXPLAYERS: "32" } : db ? { DB: "orders" } : {}),
      env: game ? { SRCDS_PORT: "27015" } : db ? { POSTGRES_DB: "orders" } : {},
    };
  }

  async applyConfig(resource: string, patch: Partial<ResourceConfig>): Promise<LifecycleResult> {
    const o = this.ov(resource);
    if (patch.replicas !== undefined) o.replicas = patch.replicas;
    if (patch.cpu) o.cpu = patch.cpu;
    if (patch.memory) o.memory = patch.memory;
    if (patch.storage) o.storage = patch.storage;
    if (patch.values) o.values = { ...(o.values ?? {}), ...patch.values };
    o.phase = "Running";
    return { ok: true, message: "Configuration applied — the Deployable was patched and the controller will reconcile." };
  }

  async lifecycle(resource: string, action: LifecycleAction, replicas?: number): Promise<LifecycleResult> {
    const o = this.ov(resource);
    switch (action) {
      case "restart":
        o.restarts = 0; // rollout restart → fresh pods, restart counter resets
        o.phase = "Running";
        return { ok: true, message: "Rollout restart triggered — fresh pods, crash loop cleared." };
      case "stop":
        o.replicas = 0;
        o.phase = "Stopped";
        return { ok: true, message: "Scaled to 0 — the resource is stopped (storage preserved)." };
      case "start":
        o.replicas = Math.max(o.replicas ?? 0, 1);
        o.phase = "Running";
        return { ok: true, message: "Scaled up — the resource is starting." };
      case "scale":
        o.replicas = Math.max(0, replicas ?? 1);
        return { ok: true, message: `Scaled to ${o.replicas} replica(s).` };
      case "delete":
        return { ok: true, message: "Delete requested — this removes the Deployable and cascades to its children (storage included)." };
    }
  }
}
