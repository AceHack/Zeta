// Typed client for the portal BFF (/api/*). Mirrors the server view models.

export type Health = "ready" | "progressing" | "error" | "unknown";

export interface ResourceVM {
  name: string;
  namespace: string;
  blueprint: string;
  category: string;
  health: Health;
  phase: string;
  expose: string;
  host?: string;
  admin: string;
  message?: string;
  children: string[];
}
export interface CategoryGroupVM {
  category: string;
  count: number;
  resources: ResourceVM[];
}
export interface CatalogVar {
  name: string;
  default?: string;
  description?: string;
}
export interface CatalogEntryVM {
  blueprint: string;
  category: string;
  image: string;
  stateful: boolean;
  defaultExpose: string;
  variables: CatalogVar[];
}
export interface NeedsMeItemVM {
  resource: string;
  requestId: string;
  proposedBy: string;
  gated?: string;
  summary: string;
}
export interface RoomEventVM {
  id: string;
  seq: number;
  weight: 1 | -1;
  proposedBy: { id: string; kind: "human" | "persona" };
  authorizedBy?: { id: string; kind: "human" | "persona" };
  body: Record<string, unknown> & { type: string };
}
export interface RoomVM {
  resource: string;
  phase?: string;
  participants: Array<{ id: string; kind: "human" | "persona" }>;
  events: RoomEventVM[];
  pending: NeedsMeItemVM[];
}

// ── management-plane types (mirror ops.ts) ────────────────────────────
export interface PodInfo {
  name: string;
  phase: string;
  ready: boolean;
  restarts: number;
  node?: string;
  ip?: string;
  ageSeconds: number;
  image: string;
}
export interface MetricPoint { t: number; cpu: number; mem: number }
export interface Metrics {
  cpuMilli: number;
  cpuLimitMilli: number;
  memMi: number;
  memLimitMi: number;
  storageUsedMi: number;
  storageTotalMi: number;
  series: MetricPoint[];
}
export interface LogLine { ts: string; level: "info" | "warn" | "error" | "debug"; text: string }
export interface Span { id: string; name: string; service: string; startMs: number; durationMs: number; status: "ok" | "error" }
export interface Trace { traceId: string; rootName: string; startedAt: string; totalMs: number; status: "ok" | "error"; spans: Span[] }
export interface K8sEvent { ts: string; type: "Normal" | "Warning"; reason: string; message: string }
export interface FileNode { name: string; path: string; type: "file" | "dir"; size: number; modified: string }
export interface ResourceConfig {
  replicas: number;
  cpu: string;
  memory: string;
  storage?: string;
  expose: string;
  host?: string;
  values: Record<string, string>;
  env: Record<string, string>;
}
export interface AccessInfo {
  console: { kind: "shell" | "rcon"; command: string; note: string };
  sftp?: { host: string; port: number; user: string; path: string; note: string };
}
export interface MemoryUsage {
  rooms: Array<{ resource: string; events: number; bytes: number }>;
  totalEvents: number;
  totalBytes: number;
}

export interface QueryResult { columns: string[]; rows: Array<Array<string | number>>; rowCount: number; durationMs: number; error?: string }

export interface NodeVM { name: string; ready: boolean; role: string; cpuAllocMilli: number; cpuCapMilli: number; memAllocMi: number; memCapMi: number; podCapacity: number; podsRunning: number; cpuRequestedMilli: number; memRequestedMi: number }
export interface ClusterCapacity { nodes: NodeVM[]; totals: { nodeCount: number; cpuAllocMilli: number; cpuRequestedMilli: number; memAllocMi: number; memRequestedMi: number; pods: number; podCapacity: number } }
export interface TenantUsage { namespace: string; displayName?: string; cpu: { allocMilli: number; usedMilli: number }; mem: { allocMi: number; usedMi: number }; storage: { allocMi: number; usedMi: number }; pods: { alloc: number; used: number }; hasQuota: boolean }
export interface TenantSpecInput { name: string; namespace: string; displayName?: string; quota: { cpu: string; memory: string; storage: string; pods: number }; isolated?: boolean }

export type Dashboard =
  | { kind: "game"; status: string; game: string; map: string; gamemode: string; players: { online: number; max: number }; address: string; tickrate: number; uptime: string; recentJoins: Array<{ name: string; at: string }> }
  | { kind: "database"; status: string; engine: string; connections: { active: number; max: number }; sizeMi: number; tables: number; queriesPerSec: number; cacheHitPct: number; replication: string; topTables: Array<{ name: string; rows: number; sizeMi: number }> }
  | { kind: "web"; status: string; host: string; tls: { issuer: string; expiresInDays: number }; requestsPerMin: number; p50ms: number; p95ms: number; errorRatePct: number; routes: Array<{ method: string; path: string; hits: number }> }
  | { kind: "worker"; status: string; lastRun: string; nextRun: string; runsToday: number; successRatePct: number; avgDurationSec: number; queueDepth: number };
export interface LifecycleResult { ok: boolean; message: string }
export type LifecycleAction = "restart" | "stop" | "start" | "scale" | "delete";

const j = async <T>(p: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(p, init);
  if (!r.ok) throw new Error(`${init?.method ?? "GET"} ${p} → ${r.status}`);
  return r.json() as Promise<T>;
};

const enc = (resource: string) => resource.replace("/", "~");
const post = (p: string, body: unknown, method = "POST") => j<LifecycleResult>(p, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  resources: () => j<{ groups: CategoryGroupVM[] }>("/api/resources").then((d) => d.groups),
  catalog: () => j<{ catalog: CatalogEntryVM[] }>("/api/catalog").then((d) => d.catalog),
  needsMe: () => j<{ items: NeedsMeItemVM[] }>("/api/needs-me").then((d) => d.items),
  room: (resource: string) => j<{ room: RoomVM }>(`/api/rooms/${enc(resource)}`).then((d) => d.room),
  grant: (resource: string, requestId: string, by: string, granted: boolean, note?: string) =>
    j<{ ok: boolean }>(`/api/rooms/${enc(resource)}/grant`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, by, granted, note }),
    }),
  chat: (resource: string, text: string, by = "you") =>
    j<{ room: RoomVM }>(`/api/rooms/${enc(resource)}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, by }),
    }).then((d) => d.room),

  // admin plane
  cluster: () => j<ClusterCapacity>("/api/admin/cluster"),
  tenants: () => j<{ tenants: TenantUsage[] }>("/api/admin/tenants").then((d) => d.tenants),
  applyTenant: (spec: TenantSpecInput) => post("/api/admin/tenants", spec),

  // management plane
  memory: () => j<MemoryUsage>("/api/memory"),
  info: (r: string) => j<{ pods: PodInfo[] }>(`/api/resources/${enc(r)}/info`).then((d) => d.pods),
  dashboard: (r: string) => j<Dashboard>(`/api/resources/${enc(r)}/dashboard`),
  query: (r: string, sql: string) => j<QueryResult>(`/api/resources/${enc(r)}/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sql }) }),
  metrics: (r: string) => j<Metrics>(`/api/resources/${enc(r)}/metrics`),
  logs: (r: string) => j<{ lines: LogLine[] }>(`/api/resources/${enc(r)}/logs`).then((d) => d.lines),
  traces: (r: string) => j<{ traces: Trace[] }>(`/api/resources/${enc(r)}/traces`).then((d) => d.traces),
  events: (r: string) => j<{ events: K8sEvent[] }>(`/api/resources/${enc(r)}/events`).then((d) => d.events),
  files: (r: string, path: string) => j<{ path: string; entries: FileNode[] }>(`/api/resources/${enc(r)}/files?path=${encodeURIComponent(path)}`),
  access: (r: string) => j<AccessInfo>(`/api/resources/${enc(r)}/access`),
  config: (r: string) => j<ResourceConfig>(`/api/resources/${enc(r)}/config`),
  applyConfig: (r: string, patch: Partial<ResourceConfig>) => post(`/api/resources/${enc(r)}/config`, patch),
  lifecycle: (r: string, action: LifecycleAction, replicas?: number) => post(`/api/resources/${enc(r)}/lifecycle`, { action, replicas }),
  exec: (r: string, cmd: string) => j<{ output: LogLine[] }>(`/api/resources/${enc(r)}/exec`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cmd }) }).then((d) => d.output),
  upload: (r: string, dir: string, file: { name: string; size: number }) => post(`/api/resources/${enc(r)}/files`, { dir, file }),
  deleteFile: (r: string, path: string) => post(`/api/resources/${enc(r)}/files?path=${encodeURIComponent(path)}`, {}, "DELETE"),
};
