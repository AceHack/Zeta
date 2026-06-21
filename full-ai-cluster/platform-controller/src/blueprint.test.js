// full-ai-cluster/platform-controller/src/blueprint.test.ts
//
// Proves renderDeployable() is genuinely GENERIC: one engine renders wildly
// different deployable archetypes from DATA alone (no per-type code).
//   1. a stateful game server (UDP port + storage + SFTP sidecar + install)
//   2. a stateless public web app  (web port + host -> Service+Cert+HTTPRoute)
//   3. a stateless worker          (no ports -> Deployment only)
//   4. a stateful database         (TCP port + storage, cluster-only)
// Plus the value-substitution and resolution rules each on their own.
import { expect, test, describe } from "bun:test";
import { API_VERSION } from "./types.js";
import { GATEWAY, renderDeployable, resolveValues, substitute, } from "./blueprint.js";
// ── helpers ───────────────────────────────────────────────────────────
function instance(name, spec) {
    return {
        apiVersion: API_VERSION,
        kind: "Deployable",
        metadata: { name, namespace: "tenant-a", uid: `uid-${name}` },
        spec,
    };
}
const byKind = (objs, kind) => objs.filter((o) => o.kind === kind);
const one = (objs, kind) => {
    const m = byKind(objs, kind);
    expect(m.length, `expected exactly one ${kind}`).toBe(1);
    return m[0];
};
const none = (objs, kind) => expect(byKind(objs, kind).length).toBe(0);
// ── substitute / resolveValues ────────────────────────────────────────
describe("substitute", () => {
    test("replaces ${VAR} but leaves shell $VAR and unknown ${X} alone", () => {
        expect(substitute("port=${PORT} keep $HOME and ${UNKNOWN}", { PORT: "27015" })).toBe("port=27015 keep $HOME and ${UNKNOWN}");
    });
});
describe("resolveValues", () => {
    const bp = {
        name: "x",
        image: "img",
        variables: [
            { name: "PORT", default: "27015" },
            { name: "MAP", default: "gm_construct" },
        ],
    };
    test("layers blueprint defaults < instance values < built-ins", () => {
        const cr = instance("srv1", { blueprint: "x", values: { MAP: "gm_flatgrass" } });
        const v = resolveValues(bp, cr);
        expect(v.PORT).toBe("27015"); // default kept
        expect(v.MAP).toBe("gm_flatgrass"); // instance override wins
        expect(v.RESOURCE_NAME).toBe("srv1"); // built-in
        expect(v.NAMESPACE).toBe("tenant-a"); // built-in
    });
});
// ── 1. stateful game server ───────────────────────────────────────────
describe("game server blueprint (stateful, UDP, storage, sidecar, install)", () => {
    const gmod = {
        name: "gmod",
        stateful: true,
        image: "ghcr.io/example/gmod:latest",
        install: "steamcmd +app_update 4020 validate +quit",
        command: ["/start.sh"],
        args: ["-maxplayers", "${MAXPLAYERS}", "+map", "${MAP}"],
        env: { SRCDS_PORT: "${PORT}" },
        ports: [{ name: "game", port: 27015, protocol: "UDP" }],
        storage: { size: "20Gi", mountPath: "/data" },
        resources: { cpu: "2", memory: "4Gi" },
        variables: [
            { name: "PORT", default: "27015" },
            { name: "MAP", default: "gm_construct" },
            { name: "MAXPLAYERS", default: "16" },
        ],
        sidecars: [{ name: "sftp", image: "atmoz/sftp", mountDataAt: "/home/sftp/data" }],
        defaultExpose: "lan",
    };
    const cr = instance("clan-server", { blueprint: "gmod", values: { MAP: "gm_flatgrass", MAXPLAYERS: "32" } });
    const objs = renderDeployable(gmod, cr);
    test("renders a StatefulSet, not a Deployment", () => {
        one(objs, "StatefulSet");
        none(objs, "Deployment");
    });
    test("storage becomes a volumeClaimTemplate, not an inline PVC", () => {
        none(objs, "PersistentVolumeClaim");
        const ss = one(objs, "StatefulSet");
        const vct = ss.spec.volumeClaimTemplates;
        expect(vct[0].metadata.name).toBe("data");
        expect(vct[0].spec.storageClassName).toBe("longhorn");
        expect(vct[0].spec.resources.requests.storage).toBe("20Gi");
    });
    test("install becomes an initContainer; main has templated args/env", () => {
        const podSpec = one(objs, "StatefulSet").spec.template.spec;
        expect(podSpec.initContainers[0].args[0]).toContain("steamcmd");
        const main = podSpec.containers.find((c) => c.name === "main");
        expect(main.args).toEqual(["-maxplayers", "32", "+map", "gm_flatgrass"]); // ${} resolved
        expect(main.env).toContainEqual({ name: "SRCDS_PORT", value: "27015" });
        expect(main.image).toBe("ghcr.io/example/gmod:latest");
    });
    test("sidecar is co-scheduled and mounts the shared data volume", () => {
        const podSpec = one(objs, "StatefulSet").spec.template.spec;
        const sftp = podSpec.containers.find((c) => c.name === "sftp");
        expect(sftp.image).toBe("atmoz/sftp");
        expect(sftp.volumeMounts).toContainEqual({ name: "data", mountPath: "/home/sftp/data" });
    });
    test("lan exposure -> LoadBalancer Service preserving UDP protocol", () => {
        const svc = one(objs, "Service");
        expect(svc.spec.type).toBe("LoadBalancer");
        expect(svc.spec.ports[0].protocol).toBe("UDP");
        expect(svc.spec.ports[0].port).toBe(27015);
    });
    test("no web routing for a non-public, non-web server", () => {
        none(objs, "Certificate");
        none(objs, "HTTPRoute");
    });
    test("resource limits honor instance size override > blueprint > default", () => {
        const sized = renderDeployable(gmod, instance("big", { blueprint: "gmod", size: { memory: "8Gi" } }));
        const main = one(sized, "StatefulSet").spec.template.spec.containers[0];
        expect(main.resources.limits.memory).toBe("8Gi"); // instance override
        expect(main.resources.limits.cpu).toBe("2"); // blueprint default kept
    });
});
// ── 2. stateless public web app ───────────────────────────────────────
describe("web app blueprint (stateless, web port, public host)", () => {
    const web = {
        name: "static-site",
        stateful: false,
        image: "nginx:1.27",
        ports: [{ name: "http", port: 8080, web: true }],
        defaultExpose: "public",
    };
    const cr = instance("marketing", { blueprint: "static-site", host: "www.example.com", replicas: 3 });
    const objs = renderDeployable(web, cr);
    test("renders a Deployment, not a StatefulSet", () => {
        one(objs, "Deployment");
        none(objs, "StatefulSet");
    });
    test("honors replica count", () => {
        expect(one(objs, "Deployment").spec.replicas).toBe(3);
    });
    test("public host -> Certificate + HTTPRoute attached to the shared Gateway", () => {
        const cert = one(objs, "Certificate");
        expect(cert.spec.dnsNames).toEqual(["www.example.com"]);
        const route = one(objs, "HTTPRoute");
        expect(route.spec.parentRefs[0]).toEqual({ name: GATEWAY.name, namespace: GATEWAY.namespace });
        expect(route.spec.hostnames).toEqual(["www.example.com"]);
        expect(route.spec.rules[0].backendRefs[0]).toEqual({ name: "marketing", port: 8080 });
    });
    test("no storage -> no PVC, no volumes", () => {
        none(objs, "PersistentVolumeClaim");
        expect(one(objs, "Deployment").spec.template.spec.volumes).toBeUndefined();
    });
});
// ── 3. stateless worker (no ports) ────────────────────────────────────
describe("worker blueprint (stateless, no ports, no exposure)", () => {
    const worker = {
        name: "batch-worker",
        stateful: false,
        image: "ghcr.io/example/worker:1",
        command: ["/worker"],
    };
    const objs = renderDeployable(worker, instance("nightly", { blueprint: "batch-worker" }));
    test("renders only a Deployment — no Service, PVC, Cert, or Route", () => {
        one(objs, "Deployment");
        none(objs, "Service");
        none(objs, "PersistentVolumeClaim");
        none(objs, "Certificate");
        none(objs, "HTTPRoute");
        expect(objs.length).toBe(1);
    });
});
// ── 4. stateful database (cluster-only) ───────────────────────────────
describe("database blueprint (stateful, TCP, storage, cluster expose)", () => {
    const pg = {
        name: "postgres",
        stateful: true,
        image: "postgres:16",
        env: { POSTGRES_DB: "${DB}" },
        ports: [{ name: "sql", port: 5432 }],
        storage: { size: "50Gi", mountPath: "/var/lib/postgresql/data" },
        variables: [{ name: "DB", default: "app" }],
        defaultExpose: "cluster",
    };
    const objs = renderDeployable(pg, instance("orders-db", { blueprint: "postgres", values: { DB: "orders" } }));
    test("StatefulSet + volumeClaimTemplate + ClusterIP Service, no LoadBalancer", () => {
        one(objs, "StatefulSet");
        const svc = one(objs, "Service");
        expect(svc.spec.type).toBe("ClusterIP");
        expect(svc.spec.ports[0].protocol).toBe("TCP");
    });
    test("default TCP protocol applied when blueprint omits it", () => {
        const main = one(objs, "StatefulSet").spec.template.spec.containers[0];
        expect(main.ports[0].protocol).toBe("TCP");
        expect(main.env).toContainEqual({ name: "POSTGRES_DB", value: "orders" });
    });
});
// ── 5. production-grade fields: env-from-Secret, probes, storageClassName ──
// Phase 2: credentialed, production deployables — additive + backward-compatible.
describe("production fields: envFrom (Secret), probes, storageClassName", () => {
    // (a) envFrom on the blueprint renders a secretKeyRef env entry.
    describe("envFrom sources env from a Secret (not plaintext)", () => {
        const api = {
            name: "api",
            stateful: false,
            image: "ghcr.io/example/api:1",
            env: { LOG_LEVEL: "info" },
            envFrom: [{ name: "DATABASE_URL", secret: "api-db", key: "url" }],
        };
        const objs = renderDeployable(api, instance("orders-api", { blueprint: "api" }));
        const main = () => one(objs, "Deployment").spec.template.spec.containers[0];
        test("a container env entry uses valueFrom.secretKeyRef with the right name + key", () => {
            expect(main().env).toContainEqual({
                name: "DATABASE_URL",
                valueFrom: { secretKeyRef: { name: "api-db", key: "url" } },
            });
        });
        test("plaintext env still renders, and comes before the Secret-sourced env", () => {
            const env = main().env;
            expect(env[0]).toEqual({ name: "LOG_LEVEL", value: "info" });
            expect(env[1]).toEqual({ name: "DATABASE_URL", valueFrom: { secretKeyRef: { name: "api-db", key: "url" } } });
        });
        test("the instance may append additional Secret-sourced env (flows like values)", () => {
            const objs2 = renderDeployable(api, instance("orders-api", {
                blueprint: "api",
                envFrom: [{ name: "API_TOKEN", secret: "api-token", key: "token" }],
            }));
            const env = one(objs2, "Deployment").spec.template.spec.containers[0].env;
            expect(env).toContainEqual({ name: "DATABASE_URL", valueFrom: { secretKeyRef: { name: "api-db", key: "url" } } });
            expect(env).toContainEqual({ name: "API_TOKEN", valueFrom: { secretKeyRef: { name: "api-token", key: "token" } } });
        });
    });
    // (b) probe.readiness.httpGet renders a readinessProbe.
    describe("probe renders readinessProbe / livenessProbe on the main container", () => {
        const web = {
            name: "web",
            stateful: false,
            image: "nginx:1.27",
            ports: [{ name: "http", port: 8080 }],
            probe: {
                readiness: { httpGet: { path: "/healthz", port: 8080 }, initialDelaySeconds: 5, periodSeconds: 10 },
                liveness: { tcpSocket: { port: 8080 }, failureThreshold: 3 },
            },
        };
        const main = () => {
            const objs = renderDeployable(web, instance("frontend", { blueprint: "web" }));
            return one(objs, "Deployment").spec.template.spec.containers[0];
        };
        test("readiness httpGet + timing fields land on readinessProbe", () => {
            const rp = main().readinessProbe;
            expect(rp.httpGet).toEqual({ path: "/healthz", port: 8080 });
            expect(rp.initialDelaySeconds).toBe(5);
            expect(rp.periodSeconds).toBe(10);
            expect(rp.timeoutSeconds).toBeUndefined(); // omitted fields stay omitted
        });
        test("liveness tcpSocket lands on livenessProbe", () => {
            const lp = main().livenessProbe;
            expect(lp.tcpSocket).toEqual({ port: 8080 });
            expect(lp.failureThreshold).toBe(3);
        });
        test("exec-handler probes render their command", () => {
            const dbBp = {
                name: "db",
                stateful: false,
                image: "postgres:16",
                probe: { readiness: { exec: { command: ["pg_isready", "-U", "app"] } } },
            };
            const m = one(renderDeployable(dbBp, instance("db1", { blueprint: "db" })), "Deployment").spec
                .template.spec.containers[0];
            expect(m.readinessProbe.exec).toEqual({ command: ["pg_isready", "-U", "app"] });
        });
    });
    // (c) storageClassName overrides the longhorn default on the PVC / volumeClaimTemplate.
    describe("storageClassName overrides the longhorn default", () => {
        test("StatefulSet volumeClaimTemplate uses the named class", () => {
            const db = {
                name: "pg",
                stateful: true,
                image: "postgres:16",
                storage: { size: "50Gi", mountPath: "/var/lib/postgresql/data" },
                storageClassName: "zeta-local-path",
            };
            const ss = one(renderDeployable(db, instance("fast-db", { blueprint: "pg" })), "StatefulSet");
            expect(ss.spec.volumeClaimTemplates[0].spec.storageClassName).toBe("zeta-local-path");
        });
        test("stateless PVC also honors the named class", () => {
            const cache = {
                name: "cache",
                stateful: false,
                image: "redis:7",
                storage: { size: "5Gi", mountPath: "/data" },
                storageClassName: "zeta-local-path",
            };
            const pvc = one(renderDeployable(cache, instance("kv", { blueprint: "cache" })), "PersistentVolumeClaim");
            expect(pvc.spec.storageClassName).toBe("zeta-local-path");
        });
    });
    // (d) a blueprint WITHOUT any of the new fields renders exactly as before.
    describe("backward-compatibility: no new fields -> identical render", () => {
        const legacy = {
            name: "legacy-db",
            stateful: true,
            image: "postgres:16",
            env: { POSTGRES_DB: "app" },
            storage: { size: "10Gi", mountPath: "/var/lib/postgresql/data" },
            defaultExpose: "cluster",
        };
        const objs = renderDeployable(legacy, instance("plain-db", { blueprint: "legacy-db" }));
        const main = () => one(objs, "StatefulSet").spec.template.spec.containers[0];
        test("longhorn stays the default storageClassName", () => {
            const vct = one(objs, "StatefulSet").spec.volumeClaimTemplates;
            expect(vct[0].spec.storageClassName).toBe("longhorn");
        });
        test("no probes are rendered", () => {
            expect(main().readinessProbe).toBeUndefined();
            expect(main().livenessProbe).toBeUndefined();
        });
        test("env has no secretKeyRef entries (plaintext only)", () => {
            for (const e of main().env)
                expect(e.valueFrom).toBeUndefined();
            expect(main().env).toEqual([{ name: "POSTGRES_DB", value: "app" }]);
        });
    });
});
// ── ownership + labels (shared across all archetypes) ─────────────────
describe("ownership + AI labels are stamped on every child", () => {
    const bp = { name: "x", image: "img", ports: [{ name: "p", port: 80 }], defaultExpose: "cluster" };
    const cr = instance("res", { blueprint: "x", ai: { admin: "otto", policy: "default", room: "enabled" } });
    const objs = renderDeployable(bp, cr);
    test("every object carries an ownerReference back to the CR", () => {
        for (const o of objs) {
            const owners = o.metadata.ownerReferences;
            expect(owners?.[0]?.name).toBe("res");
            expect(owners?.[0]?.controller).toBe(true);
        }
    });
    test("the AI admin persona is a label for the portal to query by", () => {
        for (const o of objs) {
            expect(o.metadata.labels["platform.zeta.io/admin"]).toBe("otto");
        }
    });
});
