// full-ai-cluster/portal/src/ops.ts
//
// The management-plane view models + the ResourceOps interface: everything the
// per-resource console needs beyond the basic listing — pod info, metrics, logs,
// events, a file tree (FTP/SFTP), editable config, and lifecycle actions. The
// server provides a k8s-backed impl (data-ops-k8s.ts); the demo provides rich
// deterministic data so the whole console renders with no cluster.

export interface PodInfo {
  name: string;
  phase: string; // Running | Pending | CrashLoopBackOff | …
  ready: boolean;
  restarts: number;
  node?: string;
  ip?: string;
  ageSeconds: number;
  image: string;
}

export interface MetricPoint {
  t: number; // minutes ago (negative → most recent is the largest index)
  cpu: number; // millicores
  mem: number; // MiB
}
export interface Metrics {
  cpuMilli: number;
  cpuLimitMilli: number;
  memMi: number;
  memLimitMi: number;
  storageUsedMi: number;
  storageTotalMi: number;
  series: MetricPoint[]; // recent window for sparklines/charts
}

export interface LogLine {
  ts: string;
  level: "info" | "warn" | "error" | "debug";
  text: string;
}

export interface K8sEvent {
  ts: string;
  type: "Normal" | "Warning";
  reason: string;
  message: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number; // bytes
  modified: string;
}

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

export type LifecycleAction = "restart" | "stop" | "start" | "scale" | "delete";
export interface LifecycleResult {
  ok: boolean;
  message: string;
}

/** Access-channel info for "entering" a server (console + file transfer). */
export interface AccessInfo {
  console: { kind: "shell" | "rcon"; command: string; note: string };
  sftp?: { host: string; port: number; user: string; path: string; note: string };
}

export interface ResourceOps {
  info(resource: string): Promise<{ pods: PodInfo[] }>;
  metrics(resource: string): Promise<Metrics>;
  logs(resource: string, opts?: { tail?: number }): Promise<LogLine[]>;
  events(resource: string): Promise<K8sEvent[]>;
  files(resource: string, path: string): Promise<{ path: string; entries: FileNode[] }>;
  access(resource: string): Promise<AccessInfo>;
  config(resource: string): Promise<ResourceConfig>;
  applyConfig(resource: string, patch: Partial<ResourceConfig>): Promise<LifecycleResult>;
  lifecycle(resource: string, action: LifecycleAction, replicas?: number): Promise<LifecycleResult>;
  /** Run a console/RCON/shell command in the resource; returns output lines. */
  exec(resource: string, cmd: string): Promise<{ output: LogLine[] }>;
  /** Record an uploaded file at a path (the file-explorer upload). */
  upload(resource: string, dir: string, file: { name: string; size: number }): Promise<LifecycleResult>;
  /** Delete a file at a path. */
  deleteFile(resource: string, path: string): Promise<LifecycleResult>;
}

/** Aggregate memory view — the durable Room logs + agent-memory volumes (#5). */
export interface MemoryUsage {
  rooms: Array<{ resource: string; events: number; bytes: number }>;
  totalEvents: number;
  totalBytes: number;
}
