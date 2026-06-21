// full-ai-cluster/platform-controller/src/tenant.test.ts
//
// renderTenant: a Tenant becomes Namespace + ResourceQuota (the sold hardware) +
// LimitRange + NetworkPolicy + Policy, with quota caps and isolation honored.
import { describe, expect, test } from "bun:test";
import { API_VERSION } from "./types.js";
import { renderTenant } from "./tenant.js";
function tenant(name, spec) {
    return { apiVersion: API_VERSION, kind: "Tenant", metadata: { name, namespace: "", uid: `u-${name}` }, spec };
}
const byKind = (objs, kind) => objs.find((o) => o.kind === kind);
describe("renderTenant", () => {
    const cr = tenant("acme", { namespace: "tenant-acme", displayName: "Acme Corp", quota: { cpu: "8", memory: "32Gi", storage: "200Gi", pods: 40 } });
    const objs = renderTenant(cr);
    test("provisions a Namespace named from spec.namespace", () => {
        const ns = byKind(objs, "Namespace");
        expect(ns.metadata.name).toBe("tenant-acme");
        expect(ns.metadata.labels["platform.zeta.io/display-name"]).toBe("Acme Corp");
    });
    test("ResourceQuota encodes the sold CPU/RAM/storage/pods caps", () => {
        const rq = byKind(objs, "ResourceQuota");
        const hard = rq.spec.hard;
        expect(hard["requests.cpu"]).toBe("8");
        expect(hard["requests.memory"]).toBe("32Gi");
        expect(hard["requests.storage"]).toBe("200Gi");
        expect(hard["pods"]).toBe("40");
        expect(rq.metadata.namespace).toBe("tenant-acme");
    });
    test("LimitRange caps a single pod at the tenant quota", () => {
        const lr = byKind(objs, "LimitRange");
        const max = lr.spec.limits[0].max;
        expect(max.cpu).toBe("8");
        expect(max.memory).toBe("32Gi");
    });
    test("isolated tenants get a default-deny-cross-tenant NetworkPolicy", () => {
        const np = byKind(objs, "NetworkPolicy");
        expect(np).toBeDefined();
        const ingress = np.spec.ingress;
        expect(ingress[0].from[0].namespaceSelector.matchLabels["platform.zeta.io/namespace"]).toBe("tenant-acme");
    });
    test("isolated:false omits the NetworkPolicy", () => {
        expect(byKind(renderTenant(tenant("open", { namespace: "tenant-open", isolated: false })), "NetworkPolicy")).toBeUndefined();
    });
    test("a default Policy lands in the tenant namespace with the no-directives gated classes", () => {
        const p = byKind(objs, "Policy");
        expect(p.metadata.namespace).toBe("tenant-acme");
        expect(p.spec.gatedClasses).toContain("budget");
        expect(p.spec.domains.find((d) => d.name === "data")?.autonomy).toBe("forbidden");
    });
    test("defaults apply when quota is omitted", () => {
        const rq = byKind(renderTenant(tenant("def", { namespace: "tenant-def" })), "ResourceQuota");
        const hard = rq.spec.hard;
        expect(hard["requests.cpu"]).toBe("4");
        expect(hard["requests.memory"]).toBe("16Gi");
        expect(hard["pods"]).toBe("30");
    });
    test("every child carries an ownerReference to the Tenant (cascade delete)", () => {
        for (const o of objs) {
            const owners = o.metadata.ownerReferences;
            expect(owners?.[0]?.kind).toBe("Tenant");
            expect(owners?.[0]?.controller).toBe(true);
        }
    });
});
