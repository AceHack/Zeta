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

  // management plane
  memory: () => j<MemoryUsage>("/api/memory"),
  info: (r: string) => j<{ pods: PodInfo[] }>(`/api/resources/${enc(r)}/info`).then((d) => d.pods),
  metrics: (r: string) => j<Metrics>(`/api/resources/${enc(r)}/metrics`),
  logs: (r: string) => j<{ lines: LogLine[] }>(`/api/resources/${enc(r)}/logs`).then((d) => d.lines),
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
