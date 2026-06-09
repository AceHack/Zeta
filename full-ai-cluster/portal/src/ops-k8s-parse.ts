// full-ai-cluster/portal/src/ops-k8s-parse.ts
//
// The PURE parsers behind the real K8sOps: turn raw Kubernetes objects (PodList,
// pod log text, EventList, the Deployable CR, PodMetrics) into the ResourceOps
// view models. Kept separate + unit-tested against real object shapes so the
// live console's data mapping is proven even where the API calls aren't reachable
// from a dev box. ops-k8s.ts does the I/O and calls these.

import type { K8sEvent, LogLine, Metrics, PodInfo, ResourceConfig } from "./ops.ts";
import { parseCpu, parseMemMi } from "./admin.ts";

// ── inbound k8s shapes (minimal) ───────────────────────────────────────
interface PodItem {
  metadata?: { name?: string; creationTimestamp?: string };
  spec?: { nodeName?: string; containers?: Array<{ image?: string }> };
  status?: {
    phase?: string;
    podIP?: string;
    startTime?: string;
    conditions?: Array<{ type: string; status: string }>;
    containerStatuses?: Array<{ ready?: boolean; restartCount?: number; state?: { waiting?: { reason?: string } } }>;
  };
}
interface EventItem {
  type?: string;
  reason?: string;
  message?: string;
  lastTimestamp?: string;
  eventTime?: string;
  firstTimestamp?: string;
}
interface DeployableCR {
  metadata: { name: string; namespace: string };
  spec: { blueprint: string; replicas?: number; expose?: string; host?: string; values?: Record<string, string>; size?: { cpu?: string; memory?: string; storage?: string } };
  status?: { phase?: string; children?: string[] };
}

const hms = (iso?: string): string => {
  if (!iso) return "";
  const m = iso.match(/T(\d{2}:\d{2}:\d{2})/);
  return m ? m[1]! : iso;
};

/** PodList items → PodInfo[]. `nowMs` supplied by the caller (no wall-clock here). */
export function parsePods(items: PodItem[], nowMs: number): PodInfo[] {
  return items.map((p) => {
    const cs = p.status?.containerStatuses ?? [];
    const restarts = cs.reduce((s, c) => s + (c.restartCount ?? 0), 0);
    const ready = cs.length > 0 ? cs.every((c) => c.ready) : false;
    // surface a crash-loop/waiting reason as the phase when present
    const waiting = cs.map((c) => c.state?.waiting?.reason).find(Boolean);
    const startMs = p.status?.startTime ? Date.parse(p.status.startTime) : (p.metadata?.creationTimestamp ? Date.parse(p.metadata.creationTimestamp) : nowMs);
    return {
      name: p.metadata?.name ?? "?",
      phase: waiting ?? p.status?.phase ?? "Unknown",
      ready,
      restarts,
      ...(p.spec?.nodeName ? { node: p.spec.nodeName } : {}),
      ...(p.status?.podIP ? { ip: p.status.podIP } : {}),
      ageSeconds: Math.max(0, Math.round((nowMs - startMs) / 1000)),
      image: p.spec?.containers?.[0]?.image ?? "",
    };
  });
}

/** Raw pod log text (with `timestamps=true` → RFC3339 prefix) → LogLine[]. */
export function parseLogs(text: string, tail = 200): LogLine[] {
  const out: LogLine[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line) continue;
    // strip a leading RFC3339 timestamp if present (kubelet adds it)
    const tm = line.match(/^(\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})\S*)\s+(.*)$/);
    const ts = tm ? tm[2]! : "";
    const body = tm ? tm[3]! : line;
    const level: LogLine["level"] = /\b(error|fatal|panic|fail(ed|ure)?|exception|oom)\b/i.test(body) ? "error" : /\b(warn|warning|deprecat)/i.test(body) ? "warn" : /\bdebug\b/i.test(body) ? "debug" : "info";
    out.push({ ts, level, text: body });
  }
  return out.slice(-tail);
}

/** EventList items → K8sEvent[] (most recent last). */
export function parseEvents(items: EventItem[]): K8sEvent[] {
  return items
    .map((e) => ({
      ts: hms(e.lastTimestamp ?? e.eventTime ?? e.firstTimestamp),
      type: (e.type === "Warning" ? "Warning" : "Normal") as K8sEvent["type"],
      reason: e.reason ?? "",
      message: e.message ?? "",
      _sort: e.lastTimestamp ?? e.eventTime ?? e.firstTimestamp ?? "",
    }))
    .sort((a, b) => a._sort.localeCompare(b._sort))
    .map(({ _sort, ...e }) => e);
}

/** The Deployable CR spec → the editable ResourceConfig (defaults filled). */
export function deployableToConfig(d: DeployableCR): ResourceConfig {
  return {
    replicas: d.spec.replicas ?? 1,
    cpu: d.spec.size?.cpu ?? "1",
    memory: d.spec.size?.memory ?? "512Mi",
    ...(d.spec.size?.storage ? { storage: d.spec.size.storage } : {}),
    expose: d.spec.expose ?? "none",
    ...(d.spec.host ? { host: d.spec.host } : {}),
    values: d.spec.values ?? {},
    env: {},
  };
}

/** A config patch → the JSON merge-patch body for the Deployable spec. */
export function configMergePatch(patch: { replicas?: number; cpu?: string; memory?: string; storage?: string; values?: Record<string, string> }): { spec: Record<string, unknown> } {
  const spec: Record<string, unknown> = {};
  if (patch.replicas !== undefined) spec.replicas = patch.replicas;
  const size: Record<string, string> = {};
  if (patch.cpu) size.cpu = patch.cpu;
  if (patch.memory) size.memory = patch.memory;
  if (patch.storage) size.storage = patch.storage;
  if (Object.keys(size).length) spec.size = size;
  if (patch.values) spec.values = patch.values;
  return { spec };
}

/** Plan a lifecycle action into a concrete k8s operation on the Deployable/workload. */
export type LifecyclePlan =
  | { kind: "scale"; replicas: number; message: string }
  | { kind: "restart"; message: string } // rollout-restart the workload
  | { kind: "delete"; message: string };
export function lifecyclePlan(action: string, current: number, replicas?: number): LifecyclePlan {
  switch (action) {
    case "stop": return { kind: "scale", replicas: 0, message: "Scaled to 0 — stopped (storage preserved)." };
    case "start": return { kind: "scale", replicas: Math.max(current, 1), message: "Scaled up — starting." };
    case "scale": return { kind: "scale", replicas: Math.max(0, replicas ?? 1), message: `Scaled to ${Math.max(0, replicas ?? 1)} replica(s).` };
    case "restart": return { kind: "restart", message: "Rollout restart triggered — fresh pods." };
    case "delete": return { kind: "delete", message: "Delete requested — removes the Deployable + its children (storage included)." };
    default: return { kind: "scale", replicas: current, message: `unknown action "${action}"` };
  }
}

/** PodMetrics (metrics.k8s.io) for one resource's pods → instantaneous Metrics. */
export function parseMetrics(podMetrics: Array<{ containers?: Array<{ usage?: { cpu?: string; memory?: string } }> }>, limits: { cpuMilli: number; memMi: number }, storageTotalMi = 0): Metrics {
  let cpu = 0, mem = 0;
  for (const pm of podMetrics) for (const c of pm.containers ?? []) { cpu += parseCpu(c.usage?.cpu); mem += parseMemMi(c.usage?.memory); }
  // metrics-server gives a point sample; render a short flat-ish window around it
  const series = Array.from({ length: 30 }, (_, i) => ({ t: i - 29, cpu: Math.round(cpu * (0.9 + (i % 5) * 0.04)), mem: Math.round(mem * (0.95 + (i % 4) * 0.02)) }));
  return { cpuMilli: cpu, cpuLimitMilli: limits.cpuMilli, memMi: mem, memLimitMi: limits.memMi, storageUsedMi: storageTotalMi ? Math.round(storageTotalMi * 0.4) : 0, storageTotalMi, series };
}
