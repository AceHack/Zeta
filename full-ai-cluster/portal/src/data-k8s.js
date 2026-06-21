// full-ai-cluster/portal/src/data-k8s.ts
//
// A k8s-backed PlatformData: reads Deployables + Blueprints from the cluster API
// using the mounted service-account token (same approach as the controller's
// k8s client — no heavy dependency). Rooms come from the git-native event store
// once the persona runtime lands (COLLABORATION-MODEL §9); until then a Room
// source is injected (empty in-cluster, in-memory in dev), so the portal renders
// resources + catalog for real today and gains the collaboration pane unchanged.
import { readFileSync } from "node:fs";
import { K8sOps } from "./ops-k8s.js";
const SA = "/var/run/secrets/kubernetes.io/serviceaccount";
const GROUP = "platform.zeta.io";
const VERSION = "v1alpha1";
export class K8sPlatform {
    host;
    token;
    ca;
    rooms;
    /** Live per-resource ops (pods/logs/events/config/lifecycle from the cluster). */
    ops = new K8sOps();
    constructor(rooms) {
        this.rooms = rooms;
        const h = process.env.KUBERNETES_SERVICE_HOST;
        const p = process.env.KUBERNETES_SERVICE_PORT_HTTPS ?? process.env.KUBERNETES_SERVICE_PORT ?? "443";
        if (!h)
            throw new Error("not running in-cluster: KUBERNETES_SERVICE_HOST unset");
        this.host = `https://${h}:${p}`;
        this.token = readFileSync(`${SA}/token`, "utf8").trim();
        this.ca = readFileSync(`${SA}/ca.crt`, "utf8");
    }
    async listCR(plural) {
        const url = `${this.host}/apis/${GROUP}/${VERSION}/${plural}`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" }, tls: { ca: this.ca } });
        if (!r.ok)
            throw new Error(`list ${plural}: ${r.status} ${await r.text()}`);
        return (await r.json()).items;
    }
    listDeployables() {
        return this.listCR("deployables");
    }
    listBlueprints() {
        return this.listCR("blueprints");
    }
    /** Save a Blueprint by server-side-applying the Blueprint CR. */
    async createBlueprint(bp) {
        const ns = bp.namespace ?? "zeta-platform";
        const body = { apiVersion: `${GROUP}/${VERSION}`, kind: "Blueprint", metadata: { name: bp.name, namespace: ns }, spec: bp.spec };
        const path = `/apis/${GROUP}/${VERSION}/namespaces/${ns}/blueprints/${bp.name}`;
        const r = await fetch(`${this.host}${path}?fieldManager=zeta-portal&force=true`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/apply-patch+yaml", Accept: "application/json" },
            body: JSON.stringify(body),
            tls: { ca: this.ca },
        });
        if (!r.ok)
            return { ok: false, message: `save Blueprint ${bp.name}: ${r.status} ${await r.text()}` };
        return { ok: true, message: `Blueprint "${bp.name}" applied to ${ns} — it's in the catalog.` };
    }
    /** Create a Deployable by server-side-applying the Deployable CR — the deploy write path. */
    async createDeployable(d) {
        const ns = d.namespace ?? "zeta-platform";
        const body = { apiVersion: `${GROUP}/${VERSION}`, kind: "Deployable", metadata: { name: d.name, namespace: ns }, spec: d.spec };
        const path = `/apis/${GROUP}/${VERSION}/namespaces/${ns}/deployables/${d.name}`;
        const r = await fetch(`${this.host}${path}?fieldManager=zeta-portal&force=true`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/apply-patch+yaml", Accept: "application/json" },
            body: JSON.stringify(body),
            tls: { ca: this.ca },
        });
        if (!r.ok)
            return { ok: false, message: `create Deployable ${d.name}: ${r.status} ${await r.text()}` };
        return { ok: true, message: `Deployable "${d.name}" applied to ${ns} — the controller is rendering it.` };
    }
    listRooms() {
        return this.rooms.listRooms();
    }
    getRoom(resource) {
        return this.rooms.getRoom(resource);
    }
    grant(resource, requestId, by, granted, note) {
        return this.rooms.grant(resource, requestId, by, granted, note);
    }
    async appendEvent(resource, by, body) {
        if (!this.rooms.append)
            return null;
        return (await this.rooms.append(resource, by, body)).id;
    }
}
