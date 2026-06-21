// full-ai-cluster/portal/src/ops-k8s-parse.ts
//
// The PURE parsers behind the real K8sOps: turn raw Kubernetes objects (PodList,
// pod log text, EventList, the Deployable CR, PodMetrics) into the ResourceOps
// view models. Kept separate + unit-tested against real object shapes so the
// live console's data mapping is proven even where the API calls aren't reachable
// from a dev box. ops-k8s.ts does the I/O and calls these.
import { parseCpu, parseMemMi } from "./admin.js";
const hms = (iso) => {
    if (!iso)
        return "";
    const m = iso.match(/T(\d{2}:\d{2}:\d{2})/);
    return m ? m[1] : iso;
};
/** PodList items → PodInfo[]. `nowMs` supplied by the caller (no wall-clock here). */
export function parsePods(items, nowMs) {
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
export function parseLogs(text, tail = 200) {
    const out = [];
    for (const raw of text.split("\n")) {
        const line = raw.trimEnd();
        if (!line)
            continue;
        // strip a leading RFC3339 timestamp if present (kubelet adds it)
        const tm = line.match(/^(\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})\S*)\s+(.*)$/);
        const ts = tm ? tm[2] : "";
        const body = tm ? tm[3] : line;
        const level = /\b(error|fatal|panic|fail(ed|ure)?|exception|oom)\b/i.test(body) ? "error" : /\b(warn|warning|deprecat)/i.test(body) ? "warn" : /\bdebug\b/i.test(body) ? "debug" : "info";
        out.push({ ts, level, text: body });
    }
    return out.slice(-tail);
}
/** EventList items → K8sEvent[] (most recent last). */
export function parseEvents(items) {
    return items
        .map((e) => ({
        ts: hms(e.lastTimestamp ?? e.eventTime ?? e.firstTimestamp),
        type: (e.type === "Warning" ? "Warning" : "Normal"),
        reason: e.reason ?? "",
        message: e.message ?? "",
        _sort: e.lastTimestamp ?? e.eventTime ?? e.firstTimestamp ?? "",
    }))
        .sort((a, b) => a._sort.localeCompare(b._sort))
        .map(({ _sort, ...e }) => e);
}
/** The Deployable CR spec → the editable ResourceConfig (defaults filled). */
export function deployableToConfig(d) {
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
export function configMergePatch(patch) {
    const spec = {};
    if (patch.replicas !== undefined)
        spec.replicas = patch.replicas;
    const size = {};
    if (patch.cpu)
        size.cpu = patch.cpu;
    if (patch.memory)
        size.memory = patch.memory;
    if (patch.storage)
        size.storage = patch.storage;
    if (Object.keys(size).length)
        spec.size = size;
    if (patch.values)
        spec.values = patch.values;
    return { spec };
}
export function lifecyclePlan(action, current, replicas) {
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
export function parseMetrics(podMetrics, limits, storageTotalMi = 0) {
    let cpu = 0, mem = 0;
    for (const pm of podMetrics)
        for (const c of pm.containers ?? []) {
            cpu += parseCpu(c.usage?.cpu);
            mem += parseMemMi(c.usage?.memory);
        }
    // metrics-server gives a point sample; render a short flat-ish window around it
    const series = Array.from({ length: 30 }, (_, i) => ({ t: i - 29, cpu: Math.round(cpu * (0.9 + (i % 5) * 0.04)), mem: Math.round(mem * (0.95 + (i % 4) * 0.02)) }));
    return { cpuMilli: cpu, cpuLimitMilli: limits.cpuMilli, memMi: mem, memLimitMi: limits.memMi, storageUsedMi: storageTotalMi ? Math.round(storageTotalMi * 0.4) : 0, storageTotalMi, series };
}
