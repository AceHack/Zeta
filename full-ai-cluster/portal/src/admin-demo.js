// full-ai-cluster/portal/src/admin-demo.ts
//
// A seeded AdminData for local dev (PORTAL_DEMO) — a small 3-node cluster and a
// couple of tenants, run through the SAME pure parsers as the real reads so the
// numbers add up consistently. applyTenant mutates the in-memory tenant list.
import { parseClusterCapacity, parseTenants, } from "./admin.js";
const NODES = [
    { metadata: { name: "zeta-cp-0", labels: { "node-role.kubernetes.io/control-plane": "" } }, status: { allocatable: { cpu: "8", memory: "32Gi", pods: "110" }, capacity: { cpu: "8", memory: "32Gi", pods: "110" }, conditions: [{ type: "Ready", status: "True" }] } },
    { metadata: { name: "zeta-w-1" }, status: { allocatable: { cpu: "16", memory: "64Gi", pods: "110" }, capacity: { cpu: "16", memory: "64Gi", pods: "110" }, conditions: [{ type: "Ready", status: "True" }] } },
    { metadata: { name: "zeta-w-2" }, status: { allocatable: { cpu: "16", memory: "64Gi", pods: "110" }, capacity: { cpu: "16", memory: "64Gi", pods: "110" }, conditions: [{ type: "Ready", status: "True" }] } },
];
const POD = (ns, node, cpu, mem) => ({ metadata: { namespace: ns }, spec: { nodeName: node, containers: [{ resources: { requests: { cpu, memory: mem } } }] }, status: { phase: "Running" } });
const PODS = [
    POD("acme", "zeta-w-1", "2", "4Gi"), POD("acme", "zeta-w-1", "1", "1Gi"), POD("acme", "zeta-w-2", "1", "2Gi"),
    POD("northwind", "zeta-w-2", "4", "8Gi"), POD("northwind", "zeta-cp-0", "500m", "512Mi"),
    POD("zeta-platform", "zeta-cp-0", "250m", "256Mi"),
];
export function demoAdmin() {
    const namespaces = [
        { metadata: { name: "acme", labels: { "platform.zeta.io/tenant": "acme", "platform.zeta.io/display-name": "Acme Corp" } } },
        { metadata: { name: "northwind", labels: { "platform.zeta.io/tenant": "northwind", "platform.zeta.io/display-name": "Northwind Traders" } } },
    ];
    const quotas = [
        { metadata: { namespace: "acme" }, spec: { hard: { "requests.cpu": "8", "requests.memory": "32Gi", "requests.storage": "200Gi", pods: "40" } }, status: { used: { "requests.cpu": "4", "requests.memory": "7Gi", "requests.storage": "60Gi", pods: "3" } } },
        { metadata: { namespace: "northwind" }, spec: { hard: { "requests.cpu": "12", "requests.memory": "48Gi", "requests.storage": "300Gi", pods: "60" } }, status: { used: { "requests.cpu": "4500m", "requests.memory": "8704Mi", "requests.storage": "120Gi", pods: "2" } } },
    ];
    return {
        async cluster() {
            return parseClusterCapacity(NODES, PODS);
        },
        async tenants() {
            return parseTenants(namespaces, quotas);
        },
        async applyTenant(spec) {
            const existing = namespaces.find((n) => n.metadata.name === spec.namespace);
            if (!existing)
                namespaces.push({ metadata: { name: spec.namespace, labels: { "platform.zeta.io/tenant": spec.name, ...(spec.displayName ? { "platform.zeta.io/display-name": spec.displayName } : {}) } } });
            const q = quotas.find((x) => x.metadata.namespace === spec.namespace);
            const hard = { "requests.cpu": spec.quota.cpu, "requests.memory": spec.quota.memory, "requests.storage": spec.quota.storage, pods: String(spec.quota.pods) };
            if (q)
                q.spec = { hard };
            else
                quotas.push({ metadata: { namespace: spec.namespace }, spec: { hard }, status: { used: { "requests.cpu": "0", "requests.memory": "0", "requests.storage": "0", pods: "0" } } });
            return { ok: true, message: `Tenant "${spec.name}" applied — quota set on ${spec.namespace}.` };
        },
    };
}
