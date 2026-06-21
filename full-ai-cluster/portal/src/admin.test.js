// full-ai-cluster/portal/src/admin.test.ts
//
// The pure parsers that turn real Kubernetes object shapes into cluster capacity
// + per-tenant allocation. These are the verifiable core of the real k8s reads.
import { describe, expect, test } from "bun:test";
import { parseClusterCapacity, parseCpu, parseMemMi, parseTenants } from "./admin.js";
import { demoAdmin } from "./admin-demo.js";
import { handle } from "./api.js";
describe("admin BFF + demo", () => {
    const data = { admin: demoAdmin() };
    const get = (p) => handle(new Request(`http://x${p}`), data);
    const body = async (r) => (r ? r.json() : null);
    test("GET /api/admin/cluster returns capacity totals", async () => {
        const j = await body(await get("/api/admin/cluster"));
        expect(j.totals.nodeCount).toBe(3);
        expect(j.totals.cpuAllocMilli).toBe(40000); // 8+16+16 cores
        expect(j.totals.cpuRequestedMilli).toBeGreaterThan(0);
    });
    test("GET /api/admin/tenants returns per-tenant alloc vs used", async () => {
        const j = await body(await get("/api/admin/tenants"));
        const acme = j.tenants.find((t) => t.namespace === "acme");
        expect(acme.cpu.allocMilli).toBe(8000);
        expect(acme.cpu.usedMilli).toBe(4000);
    });
    test("POST /api/admin/tenants applies a tenant + it appears with the new quota", async () => {
        const r = await handle(new Request("http://x/api/admin/tenants", { method: "POST", body: JSON.stringify({ name: "globex", namespace: "globex", quota: { cpu: "6", memory: "24Gi", storage: "150Gi", pods: 30 } }) }), data);
        expect((await r.json()).ok).toBe(true);
        const j = await body(await get("/api/admin/tenants"));
        expect(j.tenants.find((t) => t.namespace === "globex")?.cpu.allocMilli).toBe(6000);
    });
    test("POST without quota → 400", async () => {
        const r = await handle(new Request("http://x/api/admin/tenants", { method: "POST", body: JSON.stringify({ name: "x", namespace: "x" }) }), data);
        expect(r.status).toBe(400);
    });
});
describe("k8s quantity parsing", () => {
    test("cpu → millicores", () => {
        expect(parseCpu("8")).toBe(8000);
        expect(parseCpu("500m")).toBe(500);
        expect(parseCpu("2.5")).toBe(2500);
        expect(parseCpu("250000000n")).toBe(250); // nanocores
        expect(parseCpu(undefined)).toBe(0);
    });
    test("memory → MiB across binary + decimal suffixes", () => {
        expect(parseMemMi("32Gi")).toBe(32768);
        expect(parseMemMi("512Mi")).toBe(512);
        expect(parseMemMi("1Ti")).toBe(1024 * 1024);
        expect(parseMemMi("2000000Ki")).toBe(Math.round((2_000_000 * 1024) / 1024 ** 2));
        expect(parseMemMi("1G")).toBe(Math.round(1e9 / 1024 ** 2)); // decimal G ≈ 953 MiB
    });
});
describe("parseClusterCapacity", () => {
    const nodes = [
        { metadata: { name: "cp-0", labels: { "node-role.kubernetes.io/control-plane": "" } }, status: { allocatable: { cpu: "8", memory: "32Gi", pods: "110" }, capacity: { cpu: "8", memory: "32Gi", pods: "110" }, conditions: [{ type: "Ready", status: "True" }] } },
        { metadata: { name: "w-1" }, status: { allocatable: { cpu: "16", memory: "64Gi", pods: "110" }, capacity: { cpu: "16", memory: "64Gi", pods: "110" }, conditions: [{ type: "Ready", status: "True" }] } },
    ];
    const pods = [
        { metadata: { namespace: "tenant-a" }, spec: { nodeName: "w-1", containers: [{ resources: { requests: { cpu: "2", memory: "4Gi" } } }] }, status: { phase: "Running" } },
        { metadata: { namespace: "tenant-a" }, spec: { nodeName: "cp-0", containers: [{ resources: { requests: { cpu: "500m", memory: "512Mi" } } }] }, status: { phase: "Running" } },
        { metadata: { namespace: "old" }, spec: { nodeName: "w-1", containers: [{ resources: { requests: { cpu: "8", memory: "16Gi" } } }] }, status: { phase: "Succeeded" } }, // ignored (terminal)
    ];
    test("sums allocatable across nodes + requested across live pods", () => {
        const c = parseClusterCapacity(nodes, pods);
        expect(c.totals.nodeCount).toBe(2);
        expect(c.totals.cpuAllocMilli).toBe(24000); // 8 + 16 cores
        expect(c.totals.memAllocMi).toBe(98304); // 32 + 64 GiB
        expect(c.totals.cpuRequestedMilli).toBe(2500); // 2 + 0.5 (Succeeded pod ignored)
        expect(c.totals.memRequestedMi).toBe(4096 + 512);
        expect(c.totals.pods).toBe(2); // terminal pod not counted
    });
    test("per-node requested + role + ready", () => {
        const c = parseClusterCapacity(nodes, pods);
        const cp = c.nodes.find((n) => n.name === "cp-0");
        expect(cp.role).toBe("control-plane");
        expect(cp.ready).toBe(true);
        expect(cp.cpuRequestedMilli).toBe(500);
        const w = c.nodes.find((n) => n.name === "w-1");
        expect(w.cpuRequestedMilli).toBe(2000);
        expect(w.role).toBe("worker");
    });
});
describe("parseTenants", () => {
    const namespaces = [
        { metadata: { name: "tenant-acme", labels: { "platform.zeta.io/tenant": "acme", "platform.zeta.io/display-name": "Acme Corp" } } },
        { metadata: { name: "kube-system" } }, // not a tenant, no quota → excluded
    ];
    const quotas = [
        { metadata: { namespace: "tenant-acme" }, spec: { hard: { "requests.cpu": "8", "requests.memory": "32Gi", "requests.storage": "200Gi", pods: "40" } }, status: { used: { "requests.cpu": "2500m", "requests.memory": "6Gi", "requests.storage": "50Gi", pods: "7" } } },
    ];
    test("joins namespace + quota into allocated-vs-used per resource", () => {
        const t = parseTenants(namespaces, quotas);
        expect(t.length).toBe(1); // kube-system excluded
        const acme = t[0];
        expect(acme.displayName).toBe("Acme Corp");
        expect(acme.cpu).toEqual({ allocMilli: 8000, usedMilli: 2500 });
        expect(acme.mem).toEqual({ allocMi: 32768, usedMi: 6144 });
        expect(acme.storage.allocMi).toBe(200 * 1024);
        expect(acme.pods).toEqual({ alloc: 40, used: 7 });
        expect(acme.hasQuota).toBe(true);
    });
    test("a tenant namespace with no quota still appears (unbounded)", () => {
        const t = parseTenants([{ metadata: { name: "tenant-free", labels: { "platform.zeta.io/tenant": "free" } } }], []);
        expect(t.length).toBe(1);
        expect(t[0].hasQuota).toBe(false);
        expect(t[0].cpu.allocMilli).toBe(0);
    });
});
