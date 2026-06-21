// full-ai-cluster/platform-controller/src/k8s.ts
//
// A tiny in-cluster Kubernetes client — no heavy dependency. Reads the mounted
// service-account token + CA, talks to the in-cluster API over HTTPS, and does
// the four verbs the reconciler needs: list, watch (streaming), get, and
// server-side apply. Server-side apply is the whole reconcile strategy: we
// declare the desired child objects and let the API server compute the diff,
// owned by our fieldManager.
import { readFileSync } from "node:fs";
const SA = "/var/run/secrets/kubernetes.io/serviceaccount";
export const FIELD_MANAGER = "zeta-platform-controller";
/** Build a client config from the in-cluster service-account mount. */
export function inClusterConfig() {
    const host = process.env.KUBERNETES_SERVICE_HOST;
    const port = process.env.KUBERNETES_SERVICE_PORT_HTTPS ?? process.env.KUBERNETES_SERVICE_PORT ?? "443";
    if (!host)
        throw new Error("not running in-cluster: KUBERNETES_SERVICE_HOST unset");
    return {
        host: `https://${host}:${port}`,
        token: readFileSync(`${SA}/token`, "utf8").trim(),
        ca: readFileSync(`${SA}/ca.crt`, "utf8"),
    };
}
/** The REST path for a group resource. plural is lowercase (e.g. "deployables"). */
function resourcePath(group, version, plural, namespace, name) {
    const base = group ? `/apis/${group}/${version}` : `/api/${version}`;
    const ns = namespace ? `/namespaces/${namespace}` : "";
    const n = name ? `/${name}` : "";
    return `${base}${ns}/${plural}${n}`;
}
export class K8sClient {
    cfg;
    constructor(cfg) {
        this.cfg = cfg;
    }
    async req(method, path, init) {
        const url = new URL(this.cfg.host + path);
        for (const [k, v] of Object.entries(init?.query ?? {}))
            url.searchParams.set(k, v);
        const headers = { Authorization: `Bearer ${this.cfg.token}`, Accept: "application/json" };
        if (init?.contentType)
            headers["Content-Type"] = init.contentType;
        // Bun honors NODE_EXTRA_CA_CERTS / the tls option; pass the CA explicitly.
        const tls = this.cfg.ca ? { ca: this.cfg.ca } : undefined;
        return fetch(url, { method, headers, body: init?.body, tls });
    }
    async list(group, version, plural, namespace) {
        const r = await this.req("GET", resourcePath(group, version, plural, namespace));
        if (!r.ok)
            throw new Error(`list ${plural} failed: ${r.status} ${await r.text()}`);
        const body = (await r.json());
        return { items: body.items, resourceVersion: body.metadata.resourceVersion };
    }
    /** Watch a resource from resourceVersion; yields {type, object} events as they arrive. */
    async *watch(group, version, plural, namespace, resourceVersion, signal) {
        const url = new URL(this.cfg.host + resourcePath(group, version, plural, namespace));
        url.searchParams.set("watch", "true");
        url.searchParams.set("resourceVersion", resourceVersion);
        url.searchParams.set("allowWatchBookmarks", "true");
        const tls = this.cfg.ca ? { ca: this.cfg.ca } : undefined;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${this.cfg.token}` }, signal, tls });
        if (!r.ok || !r.body)
            throw new Error(`watch ${plural} failed: ${r.status}`);
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                return;
            buf += decoder.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf("\n")) >= 0) {
                const line = buf.slice(0, nl).trim();
                buf = buf.slice(nl + 1);
                if (line)
                    yield JSON.parse(line);
            }
        }
    }
    /** Server-side apply an object (the reconcile primitive). Idempotent by construction. */
    async apply(obj, plural, opts) {
        const [group, version] = obj.apiVersion.includes("/") ? obj.apiVersion.split("/") : ["", obj.apiVersion];
        const path = resourcePath(group, version, plural, obj.metadata.namespace, obj.metadata.name);
        const r = await this.req("PATCH", path, {
            body: JSON.stringify(obj),
            contentType: "application/apply-patch+yaml",
            query: { fieldManager: FIELD_MANAGER, force: String(opts?.force ?? true) },
        });
        if (!r.ok)
            throw new Error(`apply ${obj.kind}/${obj.metadata.name} failed: ${r.status} ${await r.text()}`);
        return (await r.json());
    }
    /** Patch a CR's /status subresource (merge patch). */
    async patchStatus(group, version, plural, namespace, name, status) {
        const path = resourcePath(group, version, plural, namespace, name) + "/status";
        const r = await this.req("PATCH", path, { body: JSON.stringify({ status }), contentType: "application/merge-patch+json" });
        if (!r.ok && r.status !== 404)
            throw new Error(`patchStatus ${name} failed: ${r.status} ${await r.text()}`);
    }
}
/** Map an object kind to its REST plural (the children renderDeployable emits). */
export const KIND_PLURAL = {
    Deployment: "deployments",
    StatefulSet: "statefulsets",
    Service: "services",
    PersistentVolumeClaim: "persistentvolumeclaims",
    Secret: "secrets",
    ConfigMap: "configmaps",
    Certificate: "certificates",
    HTTPRoute: "httproutes",
    Blueprint: "blueprints",
    Deployable: "deployables",
};
