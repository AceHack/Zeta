// full-ai-cluster/portal/src/admin.ts
//
// The cluster-admin substrate: total cluster capacity/usage and per-tenant
// (per-namespace) hardware allocation vs consumption. The PARSERS here are pure
// and unit-tested against real Kubernetes object shapes (Node, Pod, Namespace,
// ResourceQuota) so the aggregation is proven even where the live API calls
// aren't reachable from a dev box. The k8s-backed AdminData (data-admin-k8s.ts)
// feeds these parsers real lists; the demo feeds seeded ones.
// ── Kubernetes quantity parsing ────────────────────────────────────────
/** Parse a CPU quantity → millicores. "8" → 8000, "500m" → 500, "2.5" → 2500. */
export function parseCpu(q) {
    if (!q)
        return 0;
    const s = q.trim();
    if (s.endsWith("m"))
        return Math.round(parseFloat(s.slice(0, -1)) || 0);
    if (s.endsWith("n"))
        return Math.round((parseFloat(s.slice(0, -1)) || 0) / 1e6); // nanocores
    return Math.round((parseFloat(s) || 0) * 1000);
}
const MEM_SUFFIX = {
    Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, Pi: 1024 ** 5,
    K: 1e3, M: 1e6, G: 1e9, T: 1e12, k: 1e3,
};
/** Parse a memory/storage quantity → MiB. "32Gi" → 32768, "512Mi" → 512. */
export function parseMemMi(q) {
    if (!q)
        return 0;
    const s = q.trim();
    const m = s.match(/^([0-9.]+)\s*([A-Za-z]+)?$/);
    if (!m)
        return 0;
    const n = parseFloat(m[1]) || 0;
    const bytes = m[2] ? n * (MEM_SUFFIX[m[2]] ?? 1) : n;
    return Math.round(bytes / (1024 ** 2));
}
const nodeRole = (labels) => {
    if (!labels)
        return "worker";
    if ("node-role.kubernetes.io/control-plane" in labels || "node-role.kubernetes.io/master" in labels)
        return "control-plane";
    return "worker";
};
/** Aggregate Node + Pod lists into cluster capacity + live requested totals. */
export function parseClusterCapacity(nodes, pods) {
    // sum pod requests per node + per cluster
    const reqByNode = new Map();
    let totalPods = 0;
    for (const p of pods) {
        if (p.status?.phase === "Succeeded" || p.status?.phase === "Failed")
            continue;
        totalPods++;
        const node = p.spec?.nodeName ?? "";
        const agg = reqByNode.get(node) ?? { cpu: 0, mem: 0, count: 0 };
        agg.count++;
        for (const c of p.spec?.containers ?? []) {
            agg.cpu += parseCpu(c.resources?.requests?.cpu);
            agg.mem += parseMemMi(c.resources?.requests?.memory);
        }
        reqByNode.set(node, agg);
    }
    const nodeVMs = nodes.map((n) => {
        const req = reqByNode.get(n.metadata.name) ?? { cpu: 0, mem: 0, count: 0 };
        return {
            name: n.metadata.name,
            ready: n.status?.conditions?.some((c) => c.type === "Ready" && c.status === "True") ?? false,
            role: nodeRole(n.metadata.labels),
            cpuAllocMilli: parseCpu(n.status?.allocatable?.cpu),
            cpuCapMilli: parseCpu(n.status?.capacity?.cpu),
            memAllocMi: parseMemMi(n.status?.allocatable?.memory),
            memCapMi: parseMemMi(n.status?.capacity?.memory),
            podCapacity: parseInt(n.status?.allocatable?.pods ?? "0", 10) || 0,
            podsRunning: req.count,
            cpuRequestedMilli: req.cpu,
            memRequestedMi: req.mem,
        };
    });
    return {
        nodes: nodeVMs,
        totals: {
            nodeCount: nodeVMs.length,
            cpuAllocMilli: nodeVMs.reduce((s, n) => s + n.cpuAllocMilli, 0),
            cpuRequestedMilli: nodeVMs.reduce((s, n) => s + n.cpuRequestedMilli, 0),
            memAllocMi: nodeVMs.reduce((s, n) => s + n.memAllocMi, 0),
            memRequestedMi: nodeVMs.reduce((s, n) => s + n.memRequestedMi, 0),
            pods: totalPods,
            podCapacity: nodeVMs.reduce((s, n) => s + n.podCapacity, 0),
        },
    };
}
/** Join Namespaces with their ResourceQuota into per-tenant allocated-vs-used. */
export function parseTenants(namespaces, quotas) {
    const qByNs = new Map();
    for (const q of quotas)
        qByNs.set(q.metadata.namespace, q); // first quota per ns
    return namespaces
        .filter((ns) => !!ns.metadata.labels?.["platform.zeta.io/tenant"] || qByNs.has(ns.metadata.name))
        .map((ns) => {
        const q = qByNs.get(ns.metadata.name);
        const hard = q?.spec?.hard ?? q?.status?.hard ?? {};
        const used = q?.status?.used ?? {};
        return {
            namespace: ns.metadata.name,
            ...(ns.metadata.labels?.["platform.zeta.io/display-name"] ? { displayName: ns.metadata.labels["platform.zeta.io/display-name"] } : {}),
            cpu: { allocMilli: parseCpu(hard["requests.cpu"] ?? hard["limits.cpu"]), usedMilli: parseCpu(used["requests.cpu"] ?? used["limits.cpu"]) },
            mem: { allocMi: parseMemMi(hard["requests.memory"] ?? hard["limits.memory"]), usedMi: parseMemMi(used["requests.memory"] ?? used["limits.memory"]) },
            storage: { allocMi: parseMemMi(hard["requests.storage"]), usedMi: parseMemMi(used["requests.storage"]) },
            pods: { alloc: parseInt(hard["pods"] ?? "0", 10) || 0, used: parseInt(used["pods"] ?? "0", 10) || 0 },
            hasQuota: !!q,
        };
    });
}
