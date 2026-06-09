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

/** A distributed-trace span (for the Traces view + Room-AI reasoning). */
export interface Span {
  id: string;
  name: string;
  service: string;
  startMs: number; // offset from trace start
  durationMs: number;
  status: "ok" | "error";
}
export interface Trace {
  traceId: string;
  rootName: string;
  startedAt: string;
  totalMs: number;
  status: "ok" | "error";
  spans: Span[];
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

/** Result of running a SQL query (the database Query console). */
export interface QueryResult {
  columns: string[];
  rows: Array<Array<string | number>>;
  rowCount: number;
  durationMs: number;
  error?: string;
}

/** Type-specific dashboard data — each resource kind surfaces its own concerns. */
export type Dashboard =
  | {
      kind: "game";
      status: "online" | "offline" | "starting";
      game: string;
      map: string;
      gamemode: string;
      players: { online: number; max: number };
      address: string; // connect address (ip:port)
      tickrate: number;
      uptime: string;
      recentJoins: Array<{ name: string; at: string }>;
    }
  | {
      kind: "database";
      status: "ready" | "degraded" | "down";
      engine: string; // PostgreSQL 16
      connections: { active: number; max: number };
      sizeMi: number;
      tables: number;
      queriesPerSec: number;
      cacheHitPct: number;
      replication: "primary" | "replica" | "standalone";
      topTables: Array<{ name: string; rows: number; sizeMi: number }>;
    }
  | {
      kind: "web";
      status: "serving" | "errors" | "down";
      host: string;
      tls: { issuer: string; expiresInDays: number };
      requestsPerMin: number;
      p50ms: number;
      p95ms: number;
      errorRatePct: number;
      routes: Array<{ method: string; path: string; hits: number }>;
    }
  | {
      kind: "worker";
      status: "running" | "idle" | "failed";
      lastRun: string;
      nextRun: string;
      runsToday: number;
      successRatePct: number;
      avgDurationSec: number;
      queueDepth: number;
    };

export interface ResourceOps {
  info(resource: string): Promise<{ pods: PodInfo[] }>;
  /** Resource-type-specific dashboard (game/database/web/worker). */
  dashboard(resource: string): Promise<Dashboard>;
  /** Run a SQL query against a database resource (the Query console). */
  query(resource: string, sql: string): Promise<QueryResult>;
  metrics(resource: string): Promise<Metrics>;
  logs(resource: string, opts?: { tail?: number }): Promise<LogLine[]>;
  /** Recent distributed traces (most recent first). */
  traces(resource: string): Promise<Trace[]>;
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
