// full-ai-cluster/portal/src/ops-demo.ts
//
// A rich, deterministic ResourceOps for local dev / design review (PORTAL_DEMO).
// Data is seeded from the resource name (no wall-clock / RNG) so the console is
// fully populated and replayable. Lifecycle / config writes mutate an in-memory
// overlay so the UI reacts (restart bumps restarts, scale changes replicas, …).
const seed = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const GAME = (r) => r.includes("sandbox") || r.includes("gmod") || r.includes("game");
// NB: "sandbox" contains the substring "db" — match a db on a word boundary only.
const DB = (r) => /(^|[-/])db($|[-/])|-db$|postgres|sql/.test(r) && !GAME(r);
export class DemoOps {
    overlay = new Map();
    added = new Map(); // key: `${resource}\0${dir}`
    deleted = new Set(); // key: `${resource}\0${path}`
    ov(r) {
        let o = this.overlay.get(r);
        if (!o)
            this.overlay.set(r, (o = {}));
        return o;
    }
    async info(resource) {
        const o = this.ov(resource);
        const replicas = o.replicas ?? (GAME(resource) ? 1 : DB(resource) ? 1 : 2);
        const crashing = resource.includes("sandbox");
        const image = GAME(resource) ? "ghcr.io/ich777/steamcmd:gmod" : DB(resource) ? "postgres:16-alpine" : "nginx:1.27-alpine";
        const pods = Array.from({ length: Math.max(replicas, 1) }, (_, i) => ({
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
    async dashboard(resource) {
        const o = this.ov(resource);
        const s = seed(resource);
        const crashing = resource.includes("sandbox") && o.phase !== "Running";
        if (GAME(resource)) {
            return {
                kind: "game",
                status: crashing ? "offline" : "online",
                game: "Garry's Mod",
                map: o.values?.MAP ?? "gm_flatgrass",
                gamemode: "sandbox",
                players: { online: crashing ? 0 : (s % 18) + 2, max: Number(o.values?.MAXPLAYERS ?? 32) },
                address: `10.42.0.40:${o.values?.PORT ?? "27015"}`,
                tickrate: 66,
                uptime: crashing ? "—" : `${(s % 12) + 1}h ${(s % 50) + 5}m`,
                recentJoins: crashing ? [] : [
                    { name: "acehack", at: "12:04" },
                    { name: "buildmaster", at: "11:58" },
                    { name: "freeman", at: "11:41" },
                ],
            };
        }
        if (DB(resource)) {
            return {
                kind: "database",
                status: "ready",
                engine: "PostgreSQL 16.2",
                connections: { active: (s % 40) + 6, max: 100 },
                sizeMi: 4096 + (s % 8000),
                tables: (s % 30) + 12,
                queriesPerSec: (s % 400) + 50,
                cacheHitPct: 96 + (s % 4),
                replication: "primary",
                topTables: [
                    { name: "orders", rows: 1_240_000 + s * 100, sizeMi: 820 },
                    { name: "line_items", rows: 5_800_000 + s * 100, sizeMi: 2400 },
                    { name: "customers", rows: 84_000 + s, sizeMi: 96 },
                ],
            };
        }
        if (!GAME(resource) && !DB(resource) && resource.includes("worker")) {
            return {
                kind: "worker",
                status: o.phase === "Stopped" ? "idle" : "running",
                lastRun: "12:00 (3m ago)",
                nextRun: "13:00",
                runsToday: (s % 20) + 4,
                successRatePct: 97 + (s % 3),
                avgDurationSec: (s % 40) + 8,
                queueDepth: s % 5,
            };
        }
        // web app
        return {
            kind: "web",
            status: "serving",
            host: "demo.zeta.example.com",
            tls: { issuer: "Let's Encrypt", expiresInDays: 64 - (s % 30) },
            requestsPerMin: (s % 900) + 120,
            p50ms: (s % 20) + 8,
            p95ms: (s % 80) + 40,
            errorRatePct: (s % 100) / 100,
            routes: [
                { method: "GET", path: "/", hits: 18_400 + s * 10 },
                { method: "GET", path: "/api/health", hits: 9_200 + s * 5 },
                { method: "POST", path: "/api/checkout", hits: 1_120 + s },
            ],
        };
    }
    async query(_resource, sql) {
        const t = sql.trim().toLowerCase();
        const ms = 4 + (seed(sql) % 40);
        if (!t)
            return { columns: [], rows: [], rowCount: 0, durationMs: 0 };
        if (/^(insert|update|delete|create|drop|alter|truncate|grant|revoke)\b/.test(t))
            return { columns: [], rows: [], rowCount: 0, durationMs: ms, error: "read-only console: only SELECT / \\dt are permitted here. Use a migration for writes." };
        if (/^\\dt|information_schema|pg_tables|list tables/.test(t))
            return { columns: ["schema", "name", "rows", "size"], rows: [["public", "orders", 1_240_000, "820 MB"], ["public", "line_items", 5_800_000, "2.4 GB"], ["public", "customers", 84_000, "96 MB"]], rowCount: 3, durationMs: ms };
        if (/count\(\*\).*orders|count.*from orders/.test(t))
            return { columns: ["count"], rows: [[1_240_217]], rowCount: 1, durationMs: ms };
        if (/from\s+orders/.test(t))
            return { columns: ["id", "customer_id", "total", "status", "created_at"], rows: [[10241, 88123, "129.00", "shipped", "2026-06-08 11:02"], [10242, 12009, "54.50", "paid", "2026-06-08 11:14"], [10243, 88123, "212.99", "pending", "2026-06-08 11:41"]], rowCount: 3, durationMs: ms };
        if (/from\s+customers/.test(t))
            return { columns: ["id", "email", "created_at"], rows: [[88123, "ace@example.com", "2025-12-01"], [12009, "freeman@example.com", "2026-02-14"]], rowCount: 2, durationMs: ms };
        if (/^select\s+version|version\(\)/.test(t))
            return { columns: ["version"], rows: [["PostgreSQL 16.2 on x86_64-pc-linux-gnu"]], rowCount: 1, durationMs: ms };
        if (/^(insert|update|delete|create|drop|alter|truncate)/.test(t))
            return { columns: [], rows: [], rowCount: 0, durationMs: ms, error: "read-only console: only SELECT / \\dt are permitted here. Use a migration for writes." };
        if (/^select/.test(t))
            return { columns: ["?column?"], rows: [["ok"]], rowCount: 1, durationMs: ms };
        return { columns: [], rows: [], rowCount: 0, durationMs: ms, error: `syntax error near "${t.split(/\s+/)[0]}"` };
    }
    async metrics(resource) {
        const base = seed(resource);
        const cpuLimit = GAME(resource) ? 2000 : DB(resource) ? 1000 : 1000;
        const memLimit = GAME(resource) ? 4096 : DB(resource) ? 1024 : 512;
        // a deterministic 30-point window
        const series = Array.from({ length: 30 }, (_, i) => {
            const wob = Math.sin((i + base) / 3) * 0.18 + Math.sin((i + base) / 7) * 0.1;
            const load = GAME(resource) ? 0.55 : DB(resource) ? 0.4 : 0.25;
            return { t: i - 29, cpu: Math.round(cpuLimit * Math.max(0.05, load + wob)), mem: Math.round(memLimit * Math.max(0.1, load * 0.9 + wob * 0.5)) };
        });
        const last = series[series.length - 1];
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
    async logs(resource, opts) {
        const lines = GAME(resource)
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
    async traces(resource) {
        const span = (id, name, service, startMs, durationMs, status = "ok") => ({ id, name, service, startMs, durationMs, status });
        if (DB(resource)) {
            return [
                { traceId: "a1f3", rootName: "POST /api/checkout", startedAt: "12:09:41", totalMs: 86, status: "ok", spans: [span("1", "POST /api/checkout", "web", 0, 86), span("2", "BEGIN", "postgres", 6, 2), span("3", "SELECT inventory", "postgres", 9, 18), span("4", "INSERT orders", "postgres", 28, 31), span("5", "COMMIT", "postgres", 60, 9)] },
                { traceId: "b7c2", rootName: "GET /api/orders/:id", startedAt: "12:09:38", totalMs: 22, status: "ok", spans: [span("1", "GET /api/orders/:id", "web", 0, 22), span("2", "SELECT orders JOIN line_items", "postgres", 4, 15)] },
            ];
        }
        if (!GAME(resource) && !DB(resource)) {
            const crash = false;
            return [
                { traceId: "c9e1", rootName: "GET /", startedAt: "12:09:50", totalMs: 12, status: "ok", spans: [span("1", "GET /", "nginx", 0, 12), span("2", "static asset", "nginx", 2, 8)] },
                { traceId: "d4a8", rootName: "POST /api/checkout", startedAt: "12:09:44", totalMs: crash ? 5012 : 142, status: crash ? "error" : "ok", spans: [span("1", "POST /api/checkout", "nginx", 0, 142), span("2", "upstream orders-db", "postgres", 20, 110, "ok")] },
            ];
        }
        // game server — a join/spawn trace
        return [
            { traceId: "e2b9", rootName: "player connect", startedAt: "12:04:11", totalMs: 240, status: "ok", spans: [span("1", "player connect", "srcds", 0, 240), span("2", "steam auth", "steam", 10, 120), span("3", "load player addons", "lua", 140, 90)] },
        ];
    }
    async events(resource) {
        const crashing = resource.includes("sandbox");
        const base = [
            { ts: "12:00:00", type: "Normal", reason: "Scheduled", message: `assigned to zeta-node-${seed(resource) % 3}` },
            { ts: "12:00:02", type: "Normal", reason: "Pulled", message: "container image already present on machine" },
            { ts: "12:00:03", type: "Normal", reason: "Started", message: "started container main" },
        ];
        if (crashing)
            base.push({ ts: "12:09:48", type: "Warning", reason: "OOMKilling", message: "Memory cgroup out of memory: killed process srcds" }, { ts: "12:09:50", type: "Warning", reason: "BackOff", message: "Back-off restarting failed container main" });
        return base;
    }
    async files(resource, path) {
        const p = path || "/data";
        const mk = (name, type, size) => ({ name, path: `${p.replace(/\/$/, "")}/${name}`, type, size, modified: "2026-06-08 11:42" });
        let base;
        if (!GAME(resource) && !DB(resource))
            base = [mk("index.html", "file", 1284), mk("assets", "dir", 0)];
        else if (DB(resource))
            base = [mk("base", "dir", 0), mk("pg_wal", "dir", 0), mk("postgresql.conf", "file", 28_900), mk("pg_hba.conf", "file", 4_096)];
        else if (p === "/data")
            base = [mk("garrysmod", "dir", 0), mk("srcds_run", "file", 9_213), mk("steam_appid.txt", "file", 5), mk("server.cfg", "file", 1_842)];
        else
            base = [mk("addons", "dir", 0), mk("maps", "dir", 0), mk("cfg", "dir", 0), mk("settings.lua", "file", 612)];
        // apply the upload/delete overlay
        const added = this.added.get(`${resource}\0${p}`) ?? [];
        const merged = [...base, ...added].filter((f) => !this.deleted.has(`${resource}\0${f.path}`));
        // dirs first, then files, each alphabetical — native-explorer ordering
        merged.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
        return { path: p, entries: merged };
    }
    async exec(resource, cmd) {
        const line = (level, text) => ({ ts: "now", level, text });
        const c = cmd.trim();
        const word = c.split(/\s+/)[0]?.toLowerCase() ?? "";
        if (c === "")
            return { output: [] };
        if (word === "help")
            return { output: [line("info", GAME(resource) ? "commands: status, players, changelevel <map>, say <msg>, ls, exit" : "commands: ls, cat <file>, ps, env, exit")] };
        if (word === "status" && GAME(resource))
            return { output: [line("info", "hostname: friday-sandbox"), line("info", "map     : gm_flatgrass"), line("info", "players : 1 / 32"), line("info", "uptime  : 9m")] };
        if (word === "players" && GAME(resource))
            return { output: [line("info", "# 1 \"acehack\" STEAM_0:1:42 00:09 64ms")] };
        if (word === "ls")
            return { output: [line("info", (await this.files(resource, GAME(resource) ? "/data" : "/")).entries.map((e) => e.name).join("  "))] };
        if (word === "ps")
            return { output: [line("info", "PID  CMD"), line("info", "1    " + (GAME(resource) ? "srcds_linux" : DB(resource) ? "postgres" : "nginx"))] };
        if (word === "env")
            return { output: Object.entries((await this.config(resource)).env).map(([k, v]) => line("info", `${k}=${v}`)) };
        if (word === "exit")
            return { output: [line("info", "session closed")] };
        return { output: [line("warn", `command not found: ${word} — type 'help'`)] };
    }
    async upload(resource, dir, file) {
        const key = `${resource}\0${dir}`;
        const list = this.added.get(key) ?? [];
        const path = `${dir.replace(/\/$/, "")}/${file.name}`;
        this.deleted.delete(`${resource}\0${path}`);
        const node = { name: file.name, path, type: "file", size: file.size, modified: "just now" };
        this.added.set(key, [...list.filter((f) => f.name !== file.name), node]);
        return { ok: true, message: `Uploaded ${file.name} (${(file.size / 1024).toFixed(1)} KB) to ${dir}.` };
    }
    async deleteFile(resource, path) {
        this.deleted.add(`${resource}\0${path}`);
        return { ok: true, message: `Deleted ${path}.` };
    }
    async access(resource) {
        const pod = `${resource.split("/")[1]}-0`;
        if (GAME(resource))
            return {
                console: { kind: "rcon", command: `kubectl exec -it ${pod} -- ./srcds_run console`, note: "Game console (RCON). Live interactive console lands with the exec WebSocket." },
                sftp: { host: "10.42.0.40", port: 2222, user: "zeta", path: "/data", note: "SFTP sidecar — the game data root (addons, maps, cfg)." },
            };
        return { console: { kind: "shell", command: `kubectl exec -it ${pod} -- /bin/sh`, note: "Pod shell. Live interactive terminal lands with the exec WebSocket." } };
    }
    async config(resource) {
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
    async applyConfig(resource, patch) {
        const o = this.ov(resource);
        if (patch.replicas !== undefined)
            o.replicas = patch.replicas;
        if (patch.cpu)
            o.cpu = patch.cpu;
        if (patch.memory)
            o.memory = patch.memory;
        if (patch.storage)
            o.storage = patch.storage;
        if (patch.values)
            o.values = { ...(o.values ?? {}), ...patch.values };
        o.phase = "Running";
        return { ok: true, message: "Configuration applied — the Deployable was patched and the controller will reconcile." };
    }
    async lifecycle(resource, action, replicas) {
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
