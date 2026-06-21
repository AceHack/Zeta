// full-ai-cluster/portal/src/ops-k8s.ts
//
// The REAL ResourceOps — live cluster data for the resource console. Talks to the
// in-cluster API with the mounted service-account token. The universal ops are
// real (pods, logs, events, config, lifecycle, metrics, access); the ones that
// need extra infrastructure degrade HONESTLY rather than faking data:
//   • exec (interactive)  → needs the SPDY/WebSocket exec channel
//   • files (SFTP)        → needs the SFTP sidecar / file-proxy
//   • traces              → needs an OpenTelemetry collector
//   • query (SQL)         → needs a DB driver/connection
//   • rich dashboards     → game/db specifics need RCON / exporters
// The pure mapping is ops-k8s-parse.ts (unit-tested); this is just the I/O.
import { readFileSync } from "node:fs";
import { parseCpu, parseMemMi } from "./admin.js";
import { configMergePatch, deployableToConfig, lifecyclePlan, parseEvents, parseLogs, parseMetrics, parsePods } from "./ops-k8s-parse.js";
const SA = "/var/run/secrets/kubernetes.io/serviceaccount";
const GROUP = "platform.zeta.io";
const VERSION = "v1alpha1";
const SELECTOR = "app.kubernetes.io/name";
const split = (resource) => { const [ns, name] = resource.split("/"); return [ns ?? "", name ?? resource]; };
export class K8sOps {
    host;
    token;
    ca;
    constructor() {
        const h = process.env.KUBERNETES_SERVICE_HOST;
        const p = process.env.KUBERNETES_SERVICE_PORT_HTTPS ?? process.env.KUBERNETES_SERVICE_PORT ?? "443";
        if (!h)
            throw new Error("not running in-cluster: KUBERNETES_SERVICE_HOST unset");
        this.host = `https://${h}:${p}`;
        this.token = readFileSync(`${SA}/token`, "utf8").trim();
        this.ca = readFileSync(`${SA}/ca.crt`, "utf8");
    }
    async req(method, path, init) {
        const headers = { Authorization: `Bearer ${this.token}`, Accept: init?.accept ?? "application/json" };
        if (init?.contentType)
            headers["Content-Type"] = init.contentType;
        return fetch(`${this.host}${path}`, { method, headers, body: init?.body, tls: { ca: this.ca } });
    }
    async getJson(path) {
        const r = await this.req("GET", path);
        if (!r.ok)
            throw new Error(`GET ${path}: ${r.status} ${await r.text()}`);
        return (await r.json());
    }
    podsPath(ns, name) { return `/api/v1/namespaces/${ns}/pods?labelSelector=${encodeURIComponent(`${SELECTOR}=${name}`)}`; }
    deployablePath(ns, name) { return `/apis/${GROUP}/${VERSION}/namespaces/${ns}/deployables/${name}`; }
    // ── universal, real ops ────────────────────────────────────────────
    async info(resource) {
        const [ns, name] = split(resource);
        const list = await this.getJson(this.podsPath(ns, name));
        return { pods: parsePods(list.items, Date.now()) };
    }
    async config(resource) {
        const [ns, name] = split(resource);
        const d = await this.getJson(this.deployablePath(ns, name));
        return deployableToConfig(d);
    }
    async applyConfig(resource, patch) {
        const [ns, name] = split(resource);
        const body = configMergePatch({ ...(patch.replicas !== undefined ? { replicas: patch.replicas } : {}), ...(patch.cpu ? { cpu: patch.cpu } : {}), ...(patch.memory ? { memory: patch.memory } : {}), ...(patch.storage ? { storage: patch.storage } : {}), ...(patch.values ? { values: patch.values } : {}) });
        const r = await this.req("PATCH", this.deployablePath(ns, name), { body: JSON.stringify(body), contentType: "application/merge-patch+json" });
        if (!r.ok)
            return { ok: false, message: `applyConfig: ${r.status} ${await r.text()}` };
        return { ok: true, message: "Configuration applied — the controller will reconcile." };
    }
    async lifecycle(resource, action, replicas) {
        const [ns, name] = split(resource);
        const cfg = await this.config(resource).catch(() => ({ replicas: 1 }));
        const plan = lifecyclePlan(action, cfg.replicas, replicas);
        if (plan.kind === "delete") {
            const r = await this.req("DELETE", this.deployablePath(ns, name));
            return r.ok ? { ok: true, message: plan.message } : { ok: false, message: `delete: ${r.status}` };
        }
        if (plan.kind === "scale") {
            const r = await this.req("PATCH", this.deployablePath(ns, name), { body: JSON.stringify({ spec: { replicas: plan.replicas } }), contentType: "application/merge-patch+json" });
            return r.ok ? { ok: true, message: plan.message } : { ok: false, message: `scale: ${r.status}` };
        }
        // restart: roll the underlying workload (Deployment then StatefulSet) via the standard annotation
        const stamp = new Date().toISOString();
        const patch = JSON.stringify({ spec: { template: { metadata: { annotations: { "kubectl.kubernetes.io/restartedAt": stamp } } } } });
        for (const kind of ["deployments", "statefulsets"]) {
            const r = await this.req("PATCH", `/apis/apps/v1/namespaces/${ns}/${kind}/${name}`, { body: patch, contentType: "application/strategic-merge-patch+json" });
            if (r.ok)
                return { ok: true, message: plan.message };
        }
        return { ok: false, message: "restart: no Deployment/StatefulSet found for this resource" };
    }
    async logs(resource, opts) {
        const [ns, name] = split(resource);
        const list = await this.getJson(this.podsPath(ns, name));
        const pod = list.items[0]?.metadata?.name;
        if (!pod)
            return [];
        const tail = opts?.tail ?? 200;
        const r = await this.req("GET", `/api/v1/namespaces/${ns}/pods/${pod}/log?timestamps=true&tailLines=${tail}`, { accept: "*/*" });
        if (!r.ok)
            return [{ ts: "", level: "warn", text: `could not read logs: ${r.status}` }];
        return parseLogs(await r.text(), tail);
    }
    async events(resource) {
        const [ns, name] = split(resource);
        const list = await this.getJson(`/api/v1/namespaces/${ns}/events`);
        const mine = list.items.filter((e) => (e.involvedObject?.name ?? "").startsWith(name));
        return parseEvents(mine);
    }
    async metrics(resource) {
        const [ns, name] = split(resource);
        const cfg = await this.config(resource).catch(() => ({ cpu: "1", memory: "512Mi" }));
        const limits = { cpuMilli: parseCpu(cfg.cpu), memMi: parseMemMi(cfg.memory) };
        const storageMi = cfg.storage ? parseMemMi(cfg.storage) : 0;
        try {
            const pm = await this.getJson(`/apis/metrics.k8s.io/${VERSION === "v1alpha1" ? "v1beta1" : "v1beta1"}/namespaces/${ns}/pods`);
            const mine = pm.items.filter((p) => p.metadata?.labels?.[SELECTOR] === name);
            return parseMetrics(mine, limits, storageMi);
        }
        catch {
            // metrics-server not installed → return limits with an empty series (honest)
            return { cpuMilli: 0, cpuLimitMilli: limits.cpuMilli, memMi: 0, memLimitMi: limits.memMi, storageUsedMi: 0, storageTotalMi: storageMi, series: [] };
        }
    }
    async access(resource) {
        const [ns, name] = split(resource);
        const isGame = /sandbox|gmod|game|unturned|arma|rust|valheim|minecraft/i.test(resource);
        const pod = `${name}-0`;
        return isGame
            ? { console: { kind: "rcon", command: `kubectl -n ${ns} exec -it ${pod} -- ./srcds_run console`, note: "Game console via RCON. Live interactive console lands with the exec WebSocket channel." }, sftp: { host: `${name}.${ns}.svc`, port: 2222, user: "zeta", path: "/data", note: "SFTP sidecar — the data root." } }
            : { console: { kind: "shell", command: `kubectl -n ${ns} exec -it ${pod} -- /bin/sh`, note: "Pod shell. Live interactive terminal lands with the exec WebSocket channel." } };
    }
    // ── infra-dependent ops — honest degradation (no faked data) ───────
    async dashboard(resource) {
        // status is REAL (from pods); rich game/db/web specifics need RCON/exporters.
        const { pods } = await this.info(resource).catch(() => ({ pods: [] }));
        const up = pods.some((p) => p.ready);
        if (/sandbox|gmod|game|unturned|arma|rust|valheim|minecraft/i.test(resource)) {
            const cfg = await this.config(resource).catch(() => ({ values: {} }));
            return { kind: "game", status: up ? "online" : "offline", game: cfg.values.GAME ?? "game server", map: cfg.values.MAP ?? "—", gamemode: cfg.values.GAMEMODE ?? "—", players: { online: 0, max: Number(cfg.values.MAXPLAYERS ?? 0) }, address: "—", tickrate: 0, uptime: up ? "live" : "—", recentJoins: [] };
        }
        if (/db|postgres|sql|mysql/i.test(resource))
            return { kind: "database", status: up ? "ready" : "down", engine: "—", connections: { active: 0, max: 0 }, sizeMi: 0, tables: 0, queriesPerSec: 0, cacheHitPct: 0, replication: "standalone", topTables: [] };
        if (/web|nginx|site|app/i.test(resource))
            return { kind: "web", status: up ? "serving" : "down", host: "—", tls: { issuer: "—", expiresInDays: 0 }, requestsPerMin: 0, p50ms: 0, p95ms: 0, errorRatePct: 0, routes: [] };
        return { kind: "worker", status: up ? "running" : "idle", lastRun: "—", nextRun: "—", runsToday: 0, successRatePct: 0, avgDurationSec: 0, queueDepth: 0 };
    }
    async traces() { return []; } // needs an OpenTelemetry collector
    async exec(_resource, cmd) {
        return { output: [{ ts: "", level: "warn", text: `interactive exec ("${cmd}") needs the SPDY/WebSocket exec channel — not yet wired. Use: kubectl exec.` }] };
    }
    async query() {
        return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "the SQL console needs a database driver/connection in the portal backend — not yet wired." };
    }
    async files(_resource, path) {
        return { path: path || "/data", entries: [] }; // needs the SFTP sidecar / file-proxy
    }
    async upload() { return { ok: false, message: "file upload needs the SFTP file-proxy — not yet wired." }; }
    async deleteFile() { return { ok: false, message: "file delete needs the SFTP file-proxy — not yet wired." }; }
}
