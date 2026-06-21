// full-ai-cluster/platform-controller/src/tenant.ts
//
// The tenant reconcile — the multi-tenancy half of the platform (PLATFORM-
// ARCHITECTURE.md §4.2). A Tenant is the customer boundary; renderTenant() turns
// it into the Kubernetes objects that SELL and ISOLATE hardware:
//   • Namespace      — where everything the tenant owns lives.
//   • ResourceQuota  — the hard CPU/RAM/storage/pods caps (the hardware sold).
//   • LimitRange     — per-pod defaults + max so one pod can't eat the quota.
//   • NetworkPolicy  — default-deny cross-tenant traffic (tenants can't see each
//                      other) when isolated.
//   • Policy         — the default agent-autonomy Policy for the namespace.
// Pure + unit-tested. Editing a Tenant's quota re-patches the ResourceQuota.
import { API_VERSION, MANAGED_BY } from "./types.js";
const DEFAULTS = { cpu: "4", memory: "16Gi", storage: "100Gi", pods: 30 };
function ownerRef(cr) {
    return { apiVersion: API_VERSION, kind: "Tenant", name: cr.metadata.name, uid: cr.metadata.uid ?? "", controller: true, blockOwnerDeletion: true };
}
const labels = (tenant, ns) => ({
    "app.kubernetes.io/managed-by": MANAGED_BY,
    "platform.zeta.io/tenant": tenant,
    "platform.zeta.io/namespace": ns,
});
/** Render a Tenant into the namespace + quota + isolation objects. */
export function renderTenant(cr) {
    const tenant = cr.metadata.name;
    const ns = cr.spec.namespace;
    const q = { ...DEFAULTS, ...(cr.spec.quota ?? {}) };
    const isolated = cr.spec.isolated !== false;
    const lbls = labels(tenant, ns);
    const owner = ownerRef(cr);
    const out = [];
    // ── Namespace ──────────────────────────────────────────────────────
    out.push({
        apiVersion: "v1",
        kind: "Namespace",
        metadata: { name: ns, labels: { ...lbls, ...(cr.spec.displayName ? { "platform.zeta.io/display-name": cr.spec.displayName } : {}) }, ownerReferences: [owner] },
    });
    // ── ResourceQuota — the hardware sold to this tenant ───────────────
    out.push({
        apiVersion: "v1",
        kind: "ResourceQuota",
        metadata: { name: "tenant-quota", namespace: ns, labels: lbls, ownerReferences: [owner] },
        spec: {
            hard: {
                "requests.cpu": String(q.cpu),
                "requests.memory": String(q.memory),
                "limits.cpu": String(q.cpu),
                "limits.memory": String(q.memory),
                "requests.storage": String(q.storage),
                pods: String(q.pods),
                "persistentvolumeclaims": String(q.pods), // at most one PVC per pod by default
            },
        },
    });
    // ── LimitRange — per-pod defaults + max ────────────────────────────
    out.push({
        apiVersion: "v1",
        kind: "LimitRange",
        metadata: { name: "tenant-limits", namespace: ns, labels: lbls, ownerReferences: [owner] },
        spec: {
            limits: [
                { type: "Container", default: { cpu: "500m", memory: "512Mi" }, defaultRequest: { cpu: "100m", memory: "128Mi" }, max: { cpu: String(q.cpu), memory: String(q.memory) } },
            ],
        },
    });
    // ── NetworkPolicy — default-deny cross-tenant (allow same-ns + DNS) ─
    if (isolated) {
        out.push({
            apiVersion: "networking.k8s.io/v1",
            kind: "NetworkPolicy",
            metadata: { name: "tenant-isolation", namespace: ns, labels: lbls, ownerReferences: [owner] },
            spec: {
                podSelector: {},
                policyTypes: ["Ingress"],
                // ingress only from the same namespace (cross-tenant denied by omission)
                ingress: [{ from: [{ namespaceSelector: { matchLabels: { "platform.zeta.io/namespace": ns } } }] }],
            },
        });
    }
    // ── default Policy in the tenant namespace ─────────────────────────
    out.push({
        apiVersion: API_VERSION,
        kind: "Policy",
        metadata: { name: cr.spec.policy ?? "default", namespace: ns, labels: lbls, ownerReferences: [owner] },
        spec: {
            domains: [
                { name: "lifecycle", autonomy: "auto" },
                { name: "scaling", autonomy: "auto" },
                { name: "config", autonomy: "auto" },
                { name: "mods", autonomy: "propose" },
                { name: "spend", autonomy: "propose" },
                { name: "data", autonomy: "forbidden" },
                { name: "security", autonomy: "forbidden" },
            ],
            gatedClasses: ["budget", "non-reversible", "wont-do", "hard-limits", "force-push", "external-repo"],
        },
    });
    return out;
}
/** The children renderTenant emits, by kind → REST plural (for SSA). */
export const TENANT_KIND_PLURAL = {
    Namespace: "namespaces",
    ResourceQuota: "resourcequotas",
    LimitRange: "limitranges",
    NetworkPolicy: "networkpolicies",
    Policy: "policies",
};
