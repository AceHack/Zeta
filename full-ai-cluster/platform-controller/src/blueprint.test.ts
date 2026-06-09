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
import { API_VERSION } from "./types.ts";
import {
  type Blueprint,
  type Deployable,
  GATEWAY,
  renderDeployable,
  resolveValues,
  substitute,
} from "./blueprint.ts";

// ── helpers ───────────────────────────────────────────────────────────
function instance(name: string, spec: Deployable["spec"]): Deployable {
  return {
    apiVersion: API_VERSION,
    kind: "Deployable",
    metadata: { name, namespace: "tenant-a", uid: `uid-${name}` },
    spec,
  };
}
const byKind = (objs: ReturnType<typeof renderDeployable>, kind: string) => objs.filter((o) => o.kind === kind);
const one = (objs: ReturnType<typeof renderDeployable>, kind: string) => {
  const m = byKind(objs, kind);
  expect(m.length, `expected exactly one ${kind}`).toBe(1);
  return m[0]!;
};
const none = (objs: ReturnType<typeof renderDeployable>, kind: string) => expect(byKind(objs, kind).length).toBe(0);

// ── substitute / resolveValues ────────────────────────────────────────
describe("substitute", () => {
  test("replaces ${VAR} but leaves shell $VAR and unknown ${X} alone", () => {
    expect(substitute("port=${PORT} keep $HOME and ${UNKNOWN}", { PORT: "27015" })).toBe(
      "port=27015 keep $HOME and ${UNKNOWN}",
    );
  });
});

describe("resolveValues", () => {
  const bp: Blueprint = {
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
  const gmod: Blueprint = {
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
    const vct = (ss.spec as any).volumeClaimTemplates;
    expect(vct[0].metadata.name).toBe("data");
    expect(vct[0].spec.storageClassName).toBe("longhorn");
    expect(vct[0].spec.resources.requests.storage).toBe("20Gi");
  });
  test("install becomes an initContainer; main has templated args/env", () => {
    const podSpec = (one(objs, "StatefulSet").spec as any).template.spec;
    expect(podSpec.initContainers[0].args[0]).toContain("steamcmd");
    const main = podSpec.containers.find((c: any) => c.name === "main");
    expect(main.args).toEqual(["-maxplayers", "32", "+map", "gm_flatgrass"]); // ${} resolved
    expect(main.env).toContainEqual({ name: "SRCDS_PORT", value: "27015" });
    expect(main.image).toBe("ghcr.io/example/gmod:latest");
  });
  test("sidecar is co-scheduled and mounts the shared data volume", () => {
    const podSpec = (one(objs, "StatefulSet").spec as any).template.spec;
    const sftp = podSpec.containers.find((c: any) => c.name === "sftp");
    expect(sftp.image).toBe("atmoz/sftp");
    expect(sftp.volumeMounts).toContainEqual({ name: "data", mountPath: "/home/sftp/data" });
  });
  test("lan exposure -> LoadBalancer Service preserving UDP protocol", () => {
    const svc = one(objs, "Service");
    expect((svc.spec as any).type).toBe("LoadBalancer");
    expect((svc.spec as any).ports[0].protocol).toBe("UDP");
    expect((svc.spec as any).ports[0].port).toBe(27015);
  });
  test("no web routing for a non-public, non-web server", () => {
    none(objs, "Certificate");
    none(objs, "HTTPRoute");
  });
  test("resource limits honor instance size override > blueprint > default", () => {
    const sized = renderDeployable(gmod, instance("big", { blueprint: "gmod", size: { memory: "8Gi" } }));
    const main = (one(sized, "StatefulSet").spec as any).template.spec.containers[0];
    expect(main.resources.limits.memory).toBe("8Gi"); // instance override
    expect(main.resources.limits.cpu).toBe("2"); // blueprint default kept
  });
});

// ── 2. stateless public web app ───────────────────────────────────────
describe("web app blueprint (stateless, web port, public host)", () => {
  const web: Blueprint = {
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
    expect((one(objs, "Deployment").spec as any).replicas).toBe(3);
  });
  test("public host -> Certificate + HTTPRoute attached to the shared Gateway", () => {
    const cert = one(objs, "Certificate");
    expect((cert.spec as any).dnsNames).toEqual(["www.example.com"]);
    const route = one(objs, "HTTPRoute");
    expect((route.spec as any).parentRefs[0]).toEqual({ name: GATEWAY.name, namespace: GATEWAY.namespace });
    expect((route.spec as any).hostnames).toEqual(["www.example.com"]);
    expect((route.spec as any).rules[0].backendRefs[0]).toEqual({ name: "marketing", port: 8080 });
  });
  test("no storage -> no PVC, no volumes", () => {
    none(objs, "PersistentVolumeClaim");
    expect((one(objs, "Deployment").spec as any).template.spec.volumes).toBeUndefined();
  });
});

// ── 3. stateless worker (no ports) ────────────────────────────────────
describe("worker blueprint (stateless, no ports, no exposure)", () => {
  const worker: Blueprint = {
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
  const pg: Blueprint = {
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
    expect((svc.spec as any).type).toBe("ClusterIP");
    expect((svc.spec as any).ports[0].protocol).toBe("TCP");
  });
  test("default TCP protocol applied when blueprint omits it", () => {
    const main = (one(objs, "StatefulSet").spec as any).template.spec.containers[0];
    expect(main.ports[0].protocol).toBe("TCP");
    expect(main.env).toContainEqual({ name: "POSTGRES_DB", value: "orders" });
  });
});

// ── ownership + labels (shared across all archetypes) ─────────────────
describe("ownership + AI labels are stamped on every child", () => {
  const bp: Blueprint = { name: "x", image: "img", ports: [{ name: "p", port: 80 }], defaultExpose: "cluster" };
  const cr = instance("res", { blueprint: "x", ai: { admin: "otto", policy: "default", room: "enabled" } });
  const objs = renderDeployable(bp, cr);
  test("every object carries an ownerReference back to the CR", () => {
    for (const o of objs) {
      const owners = (o.metadata as any).ownerReferences;
      expect(owners?.[0]?.name).toBe("res");
      expect(owners?.[0]?.controller).toBe(true);
    }
  });
  test("the AI admin persona is a label for the portal to query by", () => {
    for (const o of objs) {
      expect((o.metadata as any).labels["platform.zeta.io/admin"]).toBe("otto");
    }
  });
});
