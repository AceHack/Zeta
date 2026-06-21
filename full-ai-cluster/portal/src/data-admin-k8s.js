// full-ai-cluster/portal/src/data-admin-k8s.ts
//
// The REAL cluster-admin reads. Talks to the in-cluster API with the mounted
// service-account token: lists Nodes + Pods (cluster capacity + live requests),
// Namespaces + ResourceQuotas (per-tenant allocation vs usage), and server-side-
// applies a Tenant CR (the controller reconciles it into ns + quota + isolation).
// Aggregation is the pure, unit-tested admin.ts parsers; this only does the I/O.
import { readFileSync } from "node:fs";
import { parseClusterCapacity, parseTenants, } from "./admin.js";
const SA = "/var/run/secrets/kubernetes.io/serviceaccount";
const GROUP = "platform.zeta.io";
const VERSION = "v1alpha1";
export class K8sAdmin {
    host;
    token;
    ca;
    constructor() {
        const h = process.env.KUBERNETES_SERVICE_HOST;
        const p = process.env.KUBERNETES_SERVICE_PORT_HTTPS ?? process.env.KUBERNETES_SERVICE_PORT ?? "443";
        if (!h)
            throw new Error("not running in-cluster: KUBERNETES_SERVICE_HOST unset");
        this.host = `https://${h}:${p}`;
        this.token = readFileSync(`${SA}/token`, "utf8").trim();
        this.ca = readFileSync(`${SA}/ca.crt`, "utf8");
    }
    async get(path) {
        const r = await fetch(`${this.host}${path}`, { headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" }, tls: { ca: this.ca } });
        if (!r.ok)
            throw new Error(`GET ${path}: ${r.status} ${await r.text()}`);
        return (await r.json());
    }
    async cluster() {
        const [nodes, pods] = await Promise.all([
            this.get("/api/v1/nodes"),
            this.get("/api/v1/pods"),
        ]);
        return parseClusterCapacity(nodes.items, pods.items);
    }
    async tenants() {
        const [ns, rq] = await Promise.all([
            this.get("/api/v1/namespaces"),
            this.get("/api/v1/resourcequotas"),
        ]);
        return parseTenants(ns.items, rq.items).sort((a, b) => a.namespace.localeCompare(b.namespace));
    }
    async applyTenant(spec) {
        const body = {
            apiVersion: `${GROUP}/${VERSION}`,
            kind: "Tenant",
            metadata: { name: spec.name },
            spec: {
                ...(spec.displayName ? { displayName: spec.displayName } : {}),
                namespace: spec.namespace,
                quota: spec.quota,
                isolated: spec.isolated !== false,
            },
        };
        const path = `/apis/${GROUP}/${VERSION}/tenants/${spec.name}`;
        const r = await fetch(`${this.host}${path}?fieldManager=zeta-portal&force=true`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/apply-patch+yaml", Accept: "application/json" },
            body: JSON.stringify(body),
            tls: { ca: this.ca },
        });
        if (!r.ok)
            return { ok: false, message: `apply Tenant ${spec.name}: ${r.status} ${await r.text()}` };
        return { ok: true, message: `Tenant "${spec.name}" applied — the controller is provisioning ${spec.namespace} with its quota.` };
    }
}
