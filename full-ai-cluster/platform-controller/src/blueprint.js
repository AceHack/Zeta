// full-ai-cluster/platform-controller/src/blueprint.ts
//
// The GENERIC render engine. A Blueprint is a declarative run-recipe (image,
// install, startup, ports, variables, storage, sidecars, web) — the
// Pterodactyl-"egg" idea generalized to ANY deployable: game servers, app pods,
// databases, web/UI hosts. A Deployable is an instance: a Blueprint reference +
// variable values + sizing + exposure.
//
// renderDeployable(blueprint, instance) -> concrete Kubernetes objects. Pure +
// fully unit-tested. New deployable TYPES are added as Blueprint DATA (a CR or a
// library entry) — never new code here. This is the core that lets the platform
// "support wide arrays of deployables, configurable and buildable on top of."
import { labels, ownerRef } from "./types.js";
// The shared Gateway every public WebApp/route attaches to (provisioned once).
export const GATEWAY = { name: "zeta-gateway", namespace: "zeta-platform" };
const isTrue = (v) => v === true;
/** Replace ${NAME} for each provided variable. Leaves shell `$X` (no braces) alone. */
export function substitute(s, values) {
    return s.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, name) => (name in values ? values[name] : m));
}
/** Resolve the effective variable map: blueprint defaults < instance values < built-ins. */
export function resolveValues(bp, cr) {
    const out = {};
    for (const v of bp.variables ?? [])
        if (v.default !== undefined)
            out[v.name] = v.default;
    Object.assign(out, cr.spec.values ?? {});
    out.RESOURCE_NAME = cr.metadata.name;
    out.NAMESPACE = cr.metadata.namespace;
    return out;
}
/** A Secret-sourced env entry -> a Kubernetes container env entry with secretKeyRef. */
function secretEnv(e) {
    return { name: e.name, valueFrom: { secretKeyRef: { name: e.secret, key: e.key } } };
}
/** Shape a Probe into a Kubernetes probe object, dropping the absent timing fields. */
function renderProbe(p) {
    return {
        ...(p.httpGet ? { httpGet: { path: p.httpGet.path, port: p.httpGet.port } } : {}),
        ...(p.tcpSocket ? { tcpSocket: { port: p.tcpSocket.port } } : {}),
        ...(p.exec ? { exec: { command: p.exec.command } } : {}),
        ...(p.initialDelaySeconds !== undefined ? { initialDelaySeconds: p.initialDelaySeconds } : {}),
        ...(p.periodSeconds !== undefined ? { periodSeconds: p.periodSeconds } : {}),
        ...(p.timeoutSeconds !== undefined ? { timeoutSeconds: p.timeoutSeconds } : {}),
        ...(p.failureThreshold !== undefined ? { failureThreshold: p.failureThreshold } : {}),
    };
}
/** Render a Deployable (given its Blueprint) into Kubernetes objects. */
export function renderDeployable(bp, cr) {
    const name = cr.metadata.name;
    const ns = cr.metadata.namespace;
    const ai = cr.spec.ai ?? {};
    const lbls = labels(name, "Deployable", ai);
    const owner = ownerRef({ ...cr, kind: cr.kind });
    const vals = resolveValues(bp, cr);
    const sub = (s) => substitute(s, vals);
    const expose = cr.spec.expose ?? bp.defaultExpose ?? "none";
    const stateful = isTrue(bp.stateful) || (!!bp.storage && stableNeeded(bp));
    const storageSize = cr.spec.size?.storage ?? bp.storage?.size;
    const storageClassName = bp.storageClassName ?? "longhorn";
    const out = [];
    // ── primary container ──────────────────────────────────────────────
    // plaintext env first, then Secret-sourced env (blueprint, then instance) — credentials never inline.
    const env = [
        ...Object.entries(bp.env ?? {}).map(([k, v]) => ({ name: k, value: sub(v) })),
        ...(bp.envFrom ?? []).map(secretEnv),
        ...(cr.spec.envFrom ?? []).map(secretEnv),
    ];
    const ports = (bp.ports ?? []).map((p) => ({ name: p.name, containerPort: p.port, protocol: p.protocol ?? "TCP" }));
    const volumeMounts = bp.storage ? [{ name: "data", mountPath: bp.storage.mountPath }] : [];
    const mainContainer = {
        name: "main",
        image: bp.image,
        ...(bp.command ? { command: bp.command.map(sub) } : {}),
        ...(bp.args ? { args: bp.args.map(sub) } : {}),
        ...(env.length ? { env } : {}),
        ...(ports.length ? { ports } : {}),
        ...(volumeMounts.length ? { volumeMounts } : {}),
        ...(bp.probe?.readiness ? { readinessProbe: renderProbe(bp.probe.readiness) } : {}),
        ...(bp.probe?.liveness ? { livenessProbe: renderProbe(bp.probe.liveness) } : {}),
        resources: {
            requests: { cpu: "100m", memory: "128Mi" },
            limits: { cpu: cr.spec.size?.cpu ?? bp.resources?.cpu ?? "1", memory: cr.spec.size?.memory ?? bp.resources?.memory ?? "512Mi" },
        },
    };
    const containers = [mainContainer];
    for (const sc of bp.sidecars ?? []) {
        containers.push({
            name: sc.name,
            image: sc.image,
            ...(sc.command ? { command: sc.command.map(sub) } : {}),
            ...(sc.args ? { args: sc.args.map(sub) } : {}),
            ...(sc.ports ? { ports: sc.ports.map((p) => ({ name: p.name, containerPort: p.port, protocol: p.protocol ?? "TCP" })) } : {}),
            ...(sc.mountDataAt && bp.storage ? { volumeMounts: [{ name: "data", mountPath: sc.mountDataAt }] } : {}),
        });
    }
    const initContainers = bp.install
        ? [{ name: "install", image: bp.image, command: ["/bin/sh", "-c"], args: [sub(bp.install)], ...(volumeMounts.length ? { volumeMounts } : {}) }]
        : undefined;
    const podSpec = {
        ...(bp.storage ? { securityContext: { fsGroup: 1000 } } : {}),
        ...(initContainers ? { initContainers } : {}),
        containers,
    };
    // ── workload (Deployment | StatefulSet) ────────────────────────────
    const replicas = cr.spec.replicas ?? 1;
    if (stateful) {
        podSpec.volumes = [{ name: "data-extra-cm", emptyDir: {} }]; // placeholder slot; PVC via template
        out.push({
            apiVersion: "apps/v1",
            kind: "StatefulSet",
            metadata: { name, namespace: ns, labels: lbls, ownerReferences: [owner] },
            spec: {
                serviceName: name,
                replicas,
                selector: { matchLabels: { "app.kubernetes.io/name": name } },
                template: { metadata: { labels: lbls }, spec: stripPlaceholder(podSpec) },
                ...(bp.storage
                    ? {
                        volumeClaimTemplates: [
                            {
                                metadata: { name: "data" },
                                spec: { accessModes: ["ReadWriteOnce"], storageClassName, resources: { requests: { storage: storageSize } } },
                            },
                        ],
                    }
                    : {}),
            },
        });
    }
    else {
        if (bp.storage) {
            out.push({
                apiVersion: "v1",
                kind: "PersistentVolumeClaim",
                metadata: { name: `${name}-data`, namespace: ns, labels: lbls, ownerReferences: [owner] },
                spec: { accessModes: ["ReadWriteOnce"], storageClassName, resources: { requests: { storage: storageSize } } },
            });
            podSpec.volumes = [{ name: "data", persistentVolumeClaim: { claimName: `${name}-data` } }];
        }
        out.push({
            apiVersion: "apps/v1",
            kind: "Deployment",
            metadata: { name, namespace: ns, labels: lbls, ownerReferences: [owner] },
            spec: {
                replicas,
                selector: { matchLabels: { "app.kubernetes.io/name": name } },
                template: { metadata: { labels: lbls }, spec: podSpec },
            },
        });
    }
    // ── Service ────────────────────────────────────────────────────────
    if (expose !== "none" && (bp.ports?.length ?? 0) > 0) {
        const svcType = expose === "public" || expose === "lan" ? "LoadBalancer" : "ClusterIP";
        out.push({
            apiVersion: "v1",
            kind: "Service",
            metadata: { name, namespace: ns, labels: lbls, ownerReferences: [owner] },
            spec: {
                type: svcType,
                ...(svcType === "LoadBalancer" ? { externalTrafficPolicy: "Local" } : {}),
                selector: { "app.kubernetes.io/name": name },
                ports: (bp.ports ?? []).map((p) => ({ name: p.name, port: p.port, targetPort: p.port, protocol: p.protocol ?? "TCP" })),
            },
        });
    }
    // ── Web routing (public HTTP host) ─────────────────────────────────
    const webPort = (bp.ports ?? []).find((p) => isTrue(p.web));
    if (expose === "public" && cr.spec.host && webPort) {
        out.push({
            apiVersion: "cert-manager.io/v1",
            kind: "Certificate",
            metadata: { name: `${name}-tls`, namespace: ns, labels: lbls, ownerReferences: [owner] },
            spec: { secretName: `${name}-tls`, dnsNames: [cr.spec.host], issuerRef: { name: "zeta-issuer", kind: "ClusterIssuer" } },
        });
        out.push({
            apiVersion: "gateway.networking.k8s.io/v1",
            kind: "HTTPRoute",
            metadata: { name, namespace: ns, labels: lbls, ownerReferences: [owner] },
            spec: {
                parentRefs: [{ name: GATEWAY.name, namespace: GATEWAY.namespace }],
                hostnames: [cr.spec.host],
                rules: [{ backendRefs: [{ name, port: webPort.port }] }],
            },
        });
    }
    return out;
}
// A blueprint needs stable identity (StatefulSet) when it has storage AND is not
// explicitly stateless — game servers / DBs. Web apps set stateful:false.
function stableNeeded(bp) {
    return bp.stateful !== false;
}
function stripPlaceholder(podSpec) {
    const { volumes, ...rest } = podSpec;
    return rest; // StatefulSet gets its volume from volumeClaimTemplates, not an inline volume
}
