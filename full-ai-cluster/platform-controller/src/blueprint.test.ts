// full-ai-cluster/platform-controller/src/blueprint.test.ts
//
// Proves renderDeployable() is genuinely GENERIC: one engine renders wildly
// different deployable archetypes from DATA alone (no per-type code).
//   1. a stateful game server (UDP port + storage + SFTP sidecar + install)
//   2. a stateless public web app  (web port + host -> Service+Cert+HTTPRoute)
//   3. a stateless worker          (no ports -> Deployment only)
//   4. a stateful database         (TCP port + storage, cluster-only)
// Plus the value-substitution and resolution rules each on their own.

import { expect, test, describe, afterAll } from "bun:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { API_VERSION } from "./types.ts";
import {
  type Blueprint,
  type Deployable,
  GATEWAY,
  renderDeployable,
  resolveValues,
  substitute,
} from "./blueprint.ts";
import { ICH777_IMAGE_PREFIX, ich777ContractViolations, sftpGateViolations } from "./steamcmd-contract.ts";

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
    expect(vct[0].spec.storageClassName).toBe("zeta-block-replicated");
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

// ── 5. production-grade fields: env-from-Secret, probes, storageClassName ──
// Phase 2: credentialed, production deployables — additive + backward-compatible.
describe("production fields: envFrom (Secret), probes, storageClassName", () => {
  // (a) envFrom on the blueprint renders a secretKeyRef env entry.
  describe("envFrom sources env from a Secret (not plaintext)", () => {
    const api: Blueprint = {
      name: "api",
      stateful: false,
      image: "ghcr.io/example/api:1",
      env: { LOG_LEVEL: "info" },
      envFrom: [{ name: "DATABASE_URL", secret: "api-db", key: "url" }],
    };
    const objs = renderDeployable(api, instance("orders-api", { blueprint: "api" }));
    const main = () => (one(objs, "Deployment").spec as any).template.spec.containers[0];

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
      const env = (one(objs2, "Deployment").spec as any).template.spec.containers[0].env;
      expect(env).toContainEqual({ name: "DATABASE_URL", valueFrom: { secretKeyRef: { name: "api-db", key: "url" } } });
      expect(env).toContainEqual({ name: "API_TOKEN", valueFrom: { secretKeyRef: { name: "api-token", key: "token" } } });
    });
  });

  // (b) probe.readiness.httpGet renders a readinessProbe.
  describe("probe renders readinessProbe / livenessProbe on the main container", () => {
    const web: Blueprint = {
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
      return (one(objs, "Deployment").spec as any).template.spec.containers[0];
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
      const dbBp: Blueprint = {
        name: "db",
        stateful: false,
        image: "postgres:16",
        probe: { readiness: { exec: { command: ["pg_isready", "-U", "app"] } } },
      };
      const m = (one(renderDeployable(dbBp, instance("db1", { blueprint: "db" })), "Deployment").spec as any)
        .template.spec.containers[0];
      expect(m.readinessProbe.exec).toEqual({ command: ["pg_isready", "-U", "app"] });
    });
  });

  // (c) storageClassName overrides the zeta-block-replicated default on the PVC / volumeClaimTemplate.
  describe("storageClassName overrides the zeta-block-replicated default", () => {
    test("StatefulSet volumeClaimTemplate uses the named class", () => {
      const db: Blueprint = {
        name: "pg",
        stateful: true,
        image: "postgres:16",
        storage: { size: "50Gi", mountPath: "/var/lib/postgresql/data" },
        storageClassName: "zeta-block-local",
      };
      const ss = one(renderDeployable(db, instance("fast-db", { blueprint: "pg" })), "StatefulSet");
      expect((ss.spec as any).volumeClaimTemplates[0].spec.storageClassName).toBe("zeta-block-local");
    });
    test("stateless PVC also honors the named class", () => {
      const cache: Blueprint = {
        name: "cache",
        stateful: false,
        image: "redis:7",
        storage: { size: "5Gi", mountPath: "/data" },
        storageClassName: "zeta-block-local",
      };
      const pvc = one(renderDeployable(cache, instance("kv", { blueprint: "cache" })), "PersistentVolumeClaim");
      expect((pvc.spec as any).storageClassName).toBe("zeta-block-local");
    });
  });

  // (d) a blueprint WITHOUT any of the new fields renders exactly as before.
  describe("backward-compatibility: no new fields -> identical render", () => {
    const legacy: Blueprint = {
      name: "legacy-db",
      stateful: true,
      image: "postgres:16",
      env: { POSTGRES_DB: "app" },
      storage: { size: "10Gi", mountPath: "/var/lib/postgresql/data" },
      defaultExpose: "cluster",
    };
    const objs = renderDeployable(legacy, instance("plain-db", { blueprint: "legacy-db" }));
    const main = () => (one(objs, "StatefulSet").spec as any).template.spec.containers[0];

    test("zeta-block-replicated stays the default storageClassName", () => {
      const vct = (one(objs, "StatefulSet").spec as any).volumeClaimTemplates;
      expect(vct[0].spec.storageClassName).toBe("zeta-block-replicated");
    });
    test("no probes are rendered", () => {
      expect(main().readinessProbe).toBeUndefined();
      expect(main().livenessProbe).toBeUndefined();
    });
    test("env has no secretKeyRef entries (plaintext only)", () => {
      for (const e of main().env) expect(e.valueFrom).toBeUndefined();
      expect(main().env).toEqual([{ name: "POSTGRES_DB", value: "app" }]);
    });
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

/** The shipped Blueprint library, as Blueprint values. */
function library(): Blueprint[] {
  const docs = Bun.YAML.parse(readFileSync(new URL("../../k8s/applications/platform/blueprints.yaml", import.meta.url), "utf8")) as Array<{ metadata: { name: string }; spec: Omit<Blueprint, "name"> }>;
  return docs.map((d) => ({ name: d.metadata.name, ...d.spec }) as Blueprint);
}

// ── ich777 SteamCMD blueprints: identity + image contract ───────────────
// Workitems 081M3K1408D087G0R000WP4NDE (identity, PR #17721) and
// 081M0QB1ZCV087G0R001P9YCPX (the steamcmd path).
//
// IDENTITY. PR #17708 fixed gmod's hand-written StatefulSet by forcing
// runAsUser 1000, because cm2network/steamcmd owns its tree as uid 1000. The
// controller-rendered `ghcr.io/ich777/steamcmd:*` Blueprints must NOT copy that:
// their registry configs carry no `User`, so the process starts as root, and the
// image's own `/opt/scripts/start.sh` does `usermod` / `groupmod` /
// `chown -R ${UID}:${GID} ${DATA_DIR}` and then `su steam` to drop to UID=99,
// GID=100. That drop REQUIRES starting as root. So the controller imposes NO
// process identity: pod securityContext is exactly { fsGroup: 1000 }, and no
// container carries a securityContext of its own.
//
// IMAGE CONTRACT. Read 2026-09-28 from the registry (config blob + every layer),
// not from a README — ghcr.io/ich777/steamcmd, linux/amd64:
//   garrysmod  index sha256:8b7aa732d5317ea6ea3cd0c53d599af9121fd438fa6c4c536e48cc1f2cb4bfc7
//   unturned   index sha256:7aad70045a425c8f14262305b0f5e5d7832bc8e930be8b61c1c2e3e193972840
//   both  Entrypoint ["/opt/scripts/start.sh"], no Cmd, no User
//         Env DATA_DIR=/serverdata STEAMCMD_DIR=/serverdata/steamcmd
//             SERVER_DIR=/serverdata/serverfiles GAME_ID=template
//             GAME_NAME=template GAME_PARAMS=template GAME_PORT=27015
//             VALIDATE= UID=99 GID=100
//   layers: the only steamcmd-shaped path is the EMPTY directory
//     `serverdata/steamcmd/` (beside `serverdata/serverfiles/`); `opt/` holds
//     only `opt/scripts/start.sh` and `opt/scripts/start-server.sh`. There is
//     no `/opt/steamcmd` and no steamcmd binary anywhere in the image.
//   The two scripts extracted from the last layer are byte-identical (modulo
//   CRLF) to the `garrysmod` / `unturned` branches of ich777/docker-steamcmd-server.
// `start-server.sh` is what installs the game. If `${STEAMCMD_DIR}/steamcmd.sh`
// is missing it wgets steamcmd_linux.tar.gz INTO `${STEAMCMD_DIR}` (it never
// mkdirs it), runs `+force_install_dir ${SERVER_DIR} +app_update ${GAME_ID}`
// (plus `validate` iff VALIDATE == "true"), then starts the server from
// `${SERVER_DIR}`:
//   garrysmod  srcds_run -game ${GAME_NAME} ${GAME_PARAMS} -console +port ${GAME_PORT}
//   unturned   Unturned_Headless.x86_64 -nographics ${GAME_PARAMS} -port:${GAME_PORT} -sv
// So, pinned below:
//   * no `command` / `args` on main and no install initContainer — an override
//     skips start.sh, steamcmd is never fetched, and nothing is installed;
//   * GAME_ID is the Steam appid (never the image's `template`);
//   * the PVC mounts at SERVER_DIR, not DATA_DIR: a volume over /serverdata
//     would hide the image's `serverdata/steamcmd/` directory, and the wget
//     into it would fail on a fresh volume.
//
// NOT pinned here (needs the network): that a future tag keeps this contract.
// Re-read the image config and layers when bumping a tag.
describe("ich777 SteamCMD blueprints: the image's own entrypoint installs the game (library data)", () => {
  const steamcmd = library().filter((bp) => bp.image.startsWith(ICH777_IMAGE_PREFIX));
  const EXPECT: Record<string, { appId: string; gamePort: string }> = {
    gmod: { appId: "4020", gamePort: "27015" },
    unturned: { appId: "1110390", gamePort: "27015" },
  };

  test("the library actually contains the ich777 SteamCMD blueprints (not vacuous)", () => {
    expect(steamcmd.map((b) => b.name).sort()).toEqual(["gmod", "unturned"]);
  });

  for (const bp of steamcmd) {
    test(`${bp.name}: satisfies the ich777 contract (steamcmd-contract.ts)`, () => {
      const podSpec = (one(renderDeployable(bp, instance(`${bp.name}-srv`, { blueprint: bp.name })), "StatefulSet").spec as any).template.spec;
      expect(ich777ContractViolations(podSpec, EXPECT[bp.name]!)).toEqual([]);
    });
  }

  test("gmod: GAME_NAME is the srcds game directory", () => {
    expect(steamcmd.find((b) => b.name === "gmod")?.env?.GAME_NAME).toBe("garrysmod");
  });

  // The helper must be able to fail: the pre-#17729 gmod shape trips it.
  test("control: the pre-#17729 gmod shape is reported, not passed", () => {
    const old: Blueprint = {
      name: "gmod-old", stateful: true, image: "ghcr.io/ich777/steamcmd:garrysmod",
      install: "/opt/steamcmd/steamcmd.sh +force_install_dir /data +login anonymous +app_update 4020 validate +quit",
      command: ["/data/srcds_run"], storage: { size: "1Gi", mountPath: "/data" },
    };
    const podSpec = (one(renderDeployable(old, instance("old", { blueprint: "gmod-old" })), "StatefulSet").spec as any).template.spec;
    expect(ich777ContractViolations(podSpec, { appId: "4020", gamePort: "27015" }).length).toBeGreaterThanOrEqual(5);
  });
});

// ── atmoz/sftp sidecars are opt-in (library data, rendered) ──────────────
// PR #17736 / workitem 081M3K57P0A087G0R000AZ486D; the full contract, the uid:gid
// reasoning and the stub-based runner live in steamcmd-contract.ts.
//   gmod/unturned: 99:100 (ich777 start.sh chowns DATA_DIR to UID=99 GID=100)
//   arma-reforger: 1000:1000 (acemod image runs as root; SFTP is not served as root,
//                  so the fsGroup — read via the group, write to game files NOT guaranteed)
describe("atmoz/sftp sidecars are opt-in: idle without a key, start atmoz with a user spec once one exists", () => {
  const withSftp = library().filter((bp) => (bp.sidecars ?? []).some((s) => s.image.startsWith("atmoz/sftp")));
  const OWNER: Record<string, string> = { gmod: "99:100", unturned: "99:100", "arma-reforger": "1000:1000" };
  const ROOT = mkdtempSync(join(tmpdir(), "bp-sftp-keys-")).replaceAll("\\", "/");
  afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

  test("the library has the three atmoz/sftp sidecar blueprints (not vacuous)", () => {
    expect(withSftp.map((b) => b.name).sort()).toEqual(["arma-reforger", "gmod", "unturned"]);
  });

  for (const bp of withSftp) {
    test(`${bp.name}: opt-in gate, optional keys ConfigMap, key-only user zeta::${OWNER[bp.name]}`, async () => {
      const podSpec = (one(renderDeployable(bp, instance(`${bp.name}-srv`, { blueprint: bp.name })), "StatefulSet").spec as any).template.spec;
      expect(await sftpGateViolations(podSpec, `${bp.name}-srv`, `zeta::${OWNER[bp.name]}`, ROOT)).toEqual([]);
    });
  }

  // The runner must be able to fail: a bare sidecar (the pre-#17736 shape) trips it.
  test("control: the pre-#17736 bare sidecar is reported, not passed", async () => {
    const bare: Blueprint = {
      name: "bare", stateful: true, image: "x", storage: { size: "1Gi", mountPath: "/d" },
      sidecars: [{ name: "sftp", image: "atmoz/sftp:alpine", mountDataAt: "/home/zeta/data" }],
    };
    const podSpec = (one(renderDeployable(bare, instance("bare", { blueprint: "bare" })), "StatefulSet").spec as any).template.spec;
    expect((await sftpGateViolations(podSpec, "bare", "zeta::99:100", ROOT)).length).toBeGreaterThanOrEqual(3);
  });
});
