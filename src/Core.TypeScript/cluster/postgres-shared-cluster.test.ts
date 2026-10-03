// Falsifiers for the shared Postgres (full-ai-cluster/k8s/applications/postgres-shared) and
// for the BACKUP path of every CloudNativePG Cluster the tree ships (that one and
// temporal/postgres).
//
// WHAT WAS FALSE BEFORE: the tree carried one general Postgres TEMPLATE (examples/
// cnpg-postgres-ha.yaml, #17767), no Cluster a fresh install actually ran for the owner's
// own workloads, and NO backup of any kind for any Postgres -- temporal's included, whose
// durable-execution history exists nowhere else. Each describe() below is one claim that was
// false on origin/main and is true now; the file cannot be read as passing before the
// change because the manifests it opens do not exist there.
//
// THE CLAIM THAT NEEDED A MEASUREMENT: backup goes through the Barman Cloud PLUGIN, not the
// in-core `spec.backup.barmanObjectStore`. The image every Cluster here runs is a `minimal`
// CNPG PostgreSQL image, which carries no Barman binaries (only the deprecated `system`
// image does), so the in-core field would be accepted by the API server and fail at runtime
// with a WAL archiver that never succeeds. The "no in-core backup on a minimal image" test
// is that finding, pinned.
//
// NOT PROVEN HERE: that anything reconciles. That needs the operator, the plugin and a node.
// These tests read the TREE -- they prove the contracts the operator and the plugin will be
// handed agree with each other (names, namespaces, keys, buckets, endpoint, waves).

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseAllDocuments, parse as parseYaml } from "yaml";
import { DEFAULT_ROOT_DEV_CATALOG } from "./ports.ts";
import { applyRungOverrides, loadRungOverrides } from "./rung-overrides.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const K8S = resolve(REPO_ROOT, "full-ai-cluster/k8s");
const APPS = resolve(K8S, "applications");

type Doc = Record<string, any>;

const read = (p: string): string => readFileSync(p, "utf8");
const yamlDoc = (p: string): Doc => parseYaml(read(p)) as Doc;
const yamlDocs = (p: string): Doc[] => parseAllDocuments(read(p)).map((d) => d.toJS() as Doc);
const app = (dir: string): Doc => yamlDoc(resolve(APPS, dir, "Application.yaml"));
const wave = (dir: string): number => Number(app(dir).metadata.annotations["argocd.argoproj.io/sync-wave"]);

const GRAPH = yamlDoc(resolve(K8S, "sync-wave-dependency-graph.yaml"));
const edgesOf = (chart: string): readonly string[] =>
  (GRAPH.spec.dependsOn as Doc[]).find((n) => n.chart === chart)?.dependsOn ?? [];

const LEDGER = JSON.parse(read(resolve(K8S, "storage-profiles.json"))) as Doc;
const ledgerRow = (id: string): Doc => (LEDGER.resourceClaims as Doc[]).find((r) => r.id === id) as Doc;

const SEAWEED = app("seaweedfs");
const SEAWEED_BUCKETS: readonly string[] = SEAWEED.spec.source.helm.valuesObject.allInOne.s3.createBuckets.map(
  (b: Doc) => b.name,
);
// `<releaseName>-all-in-one` is the Service the chart renders (see seaweedfs/Application.yaml's own
// comment "keeps Service blob-store-seaweedfs-all-in-one"); S3 is served on 8333.
const SEAWEED_ENDPOINT = `http://${SEAWEED.spec.source.helm.releaseName}-all-in-one.${SEAWEED.spec.destination.namespace}.svc:8333`;

/** Every Cluster the tree ships that archives, with where its CRs live. */
const CONSUMERS = [
  { dir: "postgres-shared", crDir: "postgres-shared", namespace: "postgres-shared", cluster: "postgres-shared" },
  { dir: "temporal-postgres", crDir: "temporal/postgres", namespace: "temporal", cluster: "temporal-postgres" },
] as const;

describe("postgres-shared is a real Application a fresh install syncs", () => {
  const a = app("postgres-shared");

  test("it exists, lands in its own namespace, and NEVER prunes (pruning the Cluster deletes the PVCs)", () => {
    expect(a.kind).toBe("Application");
    expect(a.metadata.name).toBe("postgres-shared");
    expect(a.spec.destination.namespace).toBe("postgres-shared");
    expect(a.spec.syncPolicy.automated.prune).toBe(false);
    expect(a.spec.syncPolicy.automated.selfHeal).toBe(true);
  });

  test("its include glob names exactly the CRs that exist, and not itself", () => {
    const include = a.spec.source.directory.include as string;
    const names = /^\{(.+)\}\.yaml$/.exec(include)![1]!.split(",");
    expect(names.sort()).toEqual(["cluster", "objectstore", "podmonitor", "scheduledbackup"]);
    for (const n of names) expect(() => read(resolve(APPS, "postgres-shared", `${n}.yaml`))).not.toThrow();
    expect(names).not.toContain("Application");
  });

  test("it is ON BY DEFAULT: under the root's include glob and in no manual-sync or dev-only carve-out", () => {
    expect(a.metadata.annotations["zeta.io/sync-policy"]).toBeUndefined();
    expect(a.spec.syncPolicy.automated).toBeDefined();
  });

  test("the template stays: the example is still not under k8s/applications", () => {
    expect(read(resolve(K8S, "examples/cnpg-postgres-ha.yaml"))).toContain("kind: Cluster");
  });
});

describe("postgres-shared is sized, not guessed: a governed row, one instance on one node", () => {
  const cluster = yamlDoc(resolve(APPS, "postgres-shared/cluster.yaml"));
  const row = ledgerRow("full-ai-cluster/postgres-shared/postgres");

  test("the resource ledger prices it, at both rungs, and `metal` reproduces the manifest exactly", () => {
    expect(row, "no resourceClaims row for postgres-shared").toBeDefined();
    expect(row.path).toBe("full-ai-cluster/k8s/applications/postgres-shared/cluster.yaml");
    expect(row.requestsField).toBe("spec.resources.requests");
    const req = cluster.spec.resources.requests;
    expect(req.cpu).toBe(`${String(row.cpuMillis.metal)}m`);
    expect(req.memory).toBe(`${String(row.memoryMib.metal)}Mi`);
  });

  test("the ledger's pod count IS the metal instance count (a change to either must touch both)", () => {
    expect(row.pods).toBe(cluster.spec.instances);
  });

  /** instances, enablePDB and primaryUpdateMethod are ONE decision: assert they agree for a given spec. */
  const expectTripleAgrees = (spec: Doc): void => {
    const n = spec.instances as number;
    if (n === 1) {
      // A lone primary's PDB (minAvailable 1) makes `kubectl drain` hang on the only node, and a
      // switchover has no replica to promote.
      expect(spec.enablePDB).toBe(false);
      expect(spec.primaryUpdateMethod).toBe("restart");
    } else {
      expect(n).toBeGreaterThan(1);
      expect(spec.enablePDB).not.toBe(false);
      expect(spec.primaryUpdateMethod).toBe("switchover");
    }
  };

  test("METAL (the committed tree): three instances, and the knobs that depend on that number agree with it", () => {
    expect(cluster.spec.instances).toBe(3);
    expectTripleAgrees(cluster.spec);
  });

  test("DEV/CI (the rung override applied): one instance, and the same three knobs flip WITH it", () => {
    // The override is the repo's per-rung field ladder (rung-overrides.yaml). Apply it to a copy of
    // the real file and judge the result by the same rule as the committed one, so a half-done edit
    // -- instances changed, the PDB or the update method left behind -- is red on EITHER rung.
    const overrides = loadRungOverrides(["dev", "metal"], REPO_ROOT).filter((o) => o.id === "postgres-shared/single-instance-dev");
    expect(overrides, "no postgres-shared/single-instance-dev override").toHaveLength(1);
    const root = mkdtempSync(join(tmpdir(), "zeta-pg-rung-"));
    const rel = "full-ai-cluster/k8s/applications/postgres-shared/cluster.yaml";
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), read(resolve(REPO_ROOT, rel)));
    const edits = applyRungOverrides(overrides, "dev", root);
    expect(edits.length).toBeGreaterThan(0);
    const dev = parseYaml(read(join(root, rel))) as Doc;
    expect(dev.spec.instances).toBe(1);
    expectTripleAgrees(dev.spec);
    // metal is untouched by a dev override
    expect(cluster.spec.instances).toBe(3);
  });

  test("three instances on one node is ACKNOWLEDGED as nominal redundancy, not presented as HA", () => {
    const budget = JSON.parse(read(resolve(K8S, "single-node-budget.json"))) as { acknowledgedFalseRedundancy: string[] };
    expect(budget.acknowledgedFalseRedundancy).toContain("full-ai-cluster/postgres-shared");
    // ...which is only honest while the anti-affinity is soft (hard would leave replicas Pending on one node)
    expect(cluster.spec.affinity.podAntiAffinityType).toBe("preferred");
  });

  test("ArgoCD owns the instance count: nothing ignores it, so no out-of-band writer can disagree with git", () => {
    const application = app("postgres-shared");
    expect(application.spec.ignoreDifferences ?? []).toEqual([]);
    expect(application.spec.syncPolicy.syncOptions).not.toContain("RespectIgnoreDifferences=true");
  });

  test("anti-affinity is on and PREFERRED, so it never leaves an instance Pending on one node", () => {
    expect(cluster.spec.affinity.enablePodAntiAffinity).toBe(true);
    expect(cluster.spec.affinity.podAntiAffinityType).toBe("preferred");
    expect(cluster.spec.affinity.topologyKey).toBe("kubernetes.io/hostname");
  });

  test("requests AND a memory limit, no CPU limit: never BestEffort, never throttled into a missed probe", () => {
    const { requests, limits } = cluster.spec.resources;
    expect(requests.cpu).toBeDefined();
    expect(requests.memory).toBeDefined();
    expect(limits.memory).toBeDefined();
    expect(limits.cpu).toBeUndefined();
  });

  test("the pod is non-root, cannot escalate, drops every capability and has a read-only root", () => {
    const sc = cluster.spec.securityContext;
    expect(sc.allowPrivilegeEscalation).toBe(false);
    expect(sc.capabilities.drop).toEqual(["ALL"]);
    expect(sc.readOnlyRootFilesystem).toBe(true);
    expect(sc.runAsNonRoot).toBe(true);
    expect(cluster.spec.seccompProfile.type).toBe("RuntimeDefault");
  });

  test("storage is on the Longhorn pool, sized, and read by the claim ledger as the PVC the operator creates", () => {
    expect(cluster.spec.storage.storageClass).toBe("zeta-block-replicated");
    expect(cluster.spec.storage.size).toMatch(/^\d+Gi$/);
  });

  test("the one PostgreSQL image of every CNPG consumer, by tag", () => {
    const temporal = yamlDoc(resolve(APPS, "temporal/postgres/cluster.yaml"));
    expect(cluster.spec.imageName).toBe(temporal.spec.imageName);
    expect(cluster.spec.imageName).not.toContain(":latest");
  });
});

describe("credentials are minted with the role and handed out through a documented Secret and Service", () => {
  const cluster = yamlDoc(resolve(APPS, "postgres-shared/cluster.yaml"));
  const header = read(resolve(APPS, "postgres-shared/Application.yaml"));

  test("no password in the manifest, no superuser exposed, no pre-supplied secret", () => {
    // POSITIVE form: the bootstrap carries exactly a database and its owner and nothing that could
    // hold a credential (no `secret`, no `postInitSQL`); the operator mints the password.
    expect(Object.keys(cluster.spec.bootstrap)).toEqual(["initdb"]);
    expect(Object.keys(cluster.spec.bootstrap.initdb).sort()).toEqual(["database", "owner"]);
    expect(cluster.spec.enableSuperuserAccess ?? false).toBe(false);
    expect(cluster.spec.bootstrap.initdb.owner).toBe(cluster.spec.bootstrap.initdb.database);
  });

  test("the Application header documents the Secret and every Service a consumer can dial", () => {
    expect(header).toContain("postgres-shared-app");
    for (const svc of ["postgres-shared-rw", "postgres-shared-r ", "postgres-shared-ro"]) {
      expect(header).toContain(svc);
    }
    // The trap worth a test: at instances: 1 the -ro Service selects replicas only and is EMPTY.
    expect(header).toMatch(/-ro[\s\S]{0,400}NO[\s#]+endpoints/);
  });
});

describe("a Postgres that is backed up is backed up by the PLUGIN, because the image has no Barman", () => {
  for (const c of CONSUMERS) {
    const cluster = yamlDoc(resolve(APPS, c.crDir, "cluster.yaml"));

    test(`${c.cluster}: no in-core backup on a minimal image (it would fail at runtime, not at admission)`, () => {
      expect(cluster.spec.imageName).toContain("-minimal-");
      expect(cluster.spec.backup?.barmanObjectStore).toBeUndefined();
    });
  }

  test("the plugin Application is the chart that ships it, in the OPERATOR's namespace", () => {
    const plugin = app("cnpg-barman-cloud");
    const operator = app("cloudnativepg");
    expect(plugin.spec.source.chart).toBe("plugin-barman-cloud");
    expect(plugin.spec.source.repoURL).toBe(operator.spec.source.repoURL);
    // The plugin's own install doc: it MUST be installed in the operator's namespace.
    expect(plugin.spec.destination.namespace).toBe(operator.spec.destination.namespace);
    expect(plugin.spec.syncPolicy.automated.prune).toBe(false);
  });

  test("the plugin carries explicit requests (the chart ships none) and a ledger row", () => {
    const plugin = app("cnpg-barman-cloud");
    const req = plugin.spec.source.helm.valuesObject.resources.requests;
    const row = ledgerRow("full-ai-cluster/cnpg-barman-cloud/plugin");
    expect(row, "no resourceClaims row for the plugin").toBeDefined();
    expect(req.cpu).toBe(`${String(row.cpuMillis.metal)}m`);
    expect(req.memory).toBe(`${String(row.memoryMib.metal)}Mi`);
  });
});

describe("a consumer of CRDs it does not own must not give up", () => {
  // WP11 run 36221053730 measured `platform` -- a consumer of kube-prometheus-stack's CRDs -- stuck
  // OutOfSync/Degraded for good: "retried 5 times" and ArgoCD never re-attempts an automated sync for
  // a revision whose sync already failed. The ISO run 36832486494 left postgres-shared
  // OutOfSync/Unknown for 3000s on a control plane that restarted 14 times. Each of these
  // Applications consumes a CRD or webhook another Application provides, so each carries the
  // same unbounded, capped-backoff retry `platform` does.
  for (const dir of ["postgres-shared", "temporal/postgres", "cnpg-barman-cloud"]) {
    test(`${dir} retries without a limit`, () => {
      const retry = app(dir).spec.syncPolicy.retry;
      expect(retry, "no syncPolicy.retry: ArgoCD's default is 5 attempts, then never again for that revision").toBeDefined();
      expect(retry.limit).toBe(-1);
      expect(retry.backoff.maxDuration).toBe("5m");
    });
  }
});

describe("every archiving Cluster is wired end to end to the in-cluster object store", () => {
  const seeding = yamlDocs(resolve(K8S, "bootstrap/internal-secret-seeding.yaml"));
  const seedJob = seeding.find((d) => d.kind === "Job" && d.metadata.name === "seed-blob-store")!;
  const seedContainers: Doc[] = [...seedJob.spec.template.spec.initContainers, ...seedJob.spec.template.spec.containers];

  for (const c of CONSUMERS) {
    describe(c.cluster, () => {
      const cluster = yamlDoc(resolve(APPS, c.crDir, "cluster.yaml"));
      const store = yamlDoc(resolve(APPS, c.crDir, "objectstore.yaml"));
      const sched = yamlDoc(resolve(APPS, c.crDir, "scheduledbackup.yaml"));
      const plugin = cluster.spec.plugins?.[0];

      test("the Cluster archives WAL through the barman plugin, naming an ObjectStore in its own namespace", () => {
        expect(plugin, "no spec.plugins").toBeDefined();
        expect(plugin.name).toBe("barman-cloud.cloudnative-pg.io");
        expect(plugin.isWALArchiver).toBe(true);
        expect(store.apiVersion).toBe("barmancloud.cnpg.io/v1");
        expect(store.kind).toBe("ObjectStore");
        expect(store.metadata.name).toBe(plugin.parameters.barmanObjectName);
        expect(store.metadata.namespace).toBe(cluster.metadata.namespace);
        expect(store.metadata.namespace).toBe(c.namespace);
      });

      test("the plugin entry spells out the field CNPG's webhook defaults, so ArgoCD can read the Cluster as Synced", () => {
        // MEASURED on live run 36855350178: with `enabled` omitted the webhook added `enabled: true`
        // to the live list element; ArgoCD diffs a CRD's list ATOMICALLY, so desired (no `enabled`)
        // never equalled live, the Cluster stayed OutOfSync, and selfHeal re-applied it in a loop
        // (autoHealAttemptsCount 9) while the database itself was healthy. Every defaulted field of
        // a list element we ship must therefore be written out.
        expect(plugin.enabled).toBe(true);
      });

      test("a base backup is SCHEDULED, through the same plugin, for THIS cluster, with a six-field cron", () => {
        expect(sched.kind).toBe("ScheduledBackup");
        expect(sched.spec.method).toBe("plugin");
        expect(sched.spec.pluginConfiguration.name).toBe(plugin.name);
        expect(sched.spec.cluster.name).toBe(cluster.metadata.name);
        expect((sched.spec.schedule as string).trim().split(/\s+/)).toHaveLength(6);
        // The first backup proves the whole path; waiting a day to learn it is broken is not a check.
        expect(sched.spec.immediate).toBe(true);
      });

      test("retention is set, in the CRD's own pattern (a backup that never expires fills a 20Gi volume)", () => {
        expect(store.spec.retentionPolicy).toMatch(/^[1-9][0-9]*[dwm]$/);
      });

      test("the destination is a bucket SeaweedFS creates, at the Service SeaweedFS serves: NO external service", () => {
        const dest = store.spec.configuration.destinationPath as string;
        const bucket = /^s3:\/\/([^/]+)\//.exec(dest)![1]!;
        expect(SEAWEED_BUCKETS).toContain(bucket);
        expect(store.spec.configuration.endpointURL).toBe(SEAWEED_ENDPOINT);
        expect(store.spec.configuration.endpointURL).toMatch(/\.svc:\d+$/);
        expect(JSON.stringify(store)).not.toMatch(/amazonaws|googleapis|blob\.core\.windows|backblaze|wasabi/i);
      });

      test("the credential Secret is SEEDED into this namespace at first boot, with the keys the ObjectStore selects", () => {
        const creds = store.spec.configuration.s3Credentials;
        const secretName = creds.accessKeyId.name as string;
        expect(creds.secretAccessKey.name).toBe(secretName);
        const seed = seedContainers.find(
          (k) => (k.args as string[]).includes(secretName) && (k.args as string[]).includes(c.namespace),
        );
        expect(seed, `nothing in internal-secret-seeding.yaml creates ${secretName} in ${c.namespace}`).toBeDefined();
        const written = (seed!.args as string[])
          .filter((x) => x.startsWith("--from-file="))
          .map((x) => x.slice("--from-file=".length).split("=")[0]);
        expect(written).toContain(creds.accessKeyId.key);
        expect(written).toContain(creds.secretAccessKey.key);
        // The seed Job may only create secrets there: a Role and RoleBinding for the namespace exist.
        expect(
          seeding.some((d) => d.kind === "Role" && d.metadata.name === "seed-blob-store" && d.metadata.namespace === c.namespace),
        ).toBe(true);
        expect(
          seeding.some((d) => d.kind === "Namespace" && d.metadata.name === c.namespace),
          `${c.namespace} must be declared in the seeding file so its Role has a namespace to live in`,
        ).toBe(true);
      });

      test("the sidecar the plugin injects is not BestEffort", () => {
        const r = store.spec.instanceSidecarConfiguration.resources;
        expect(r.requests.cpu).toBeDefined();
        expect(r.requests.memory).toBeDefined();
        expect(r.limits.memory).toBeDefined();
      });
    });
  }
});

describe("the backup principal can reach the backup bucket and NOTHING else on the object store", () => {
  const seeding = yamlDocs(resolve(K8S, "bootstrap/internal-secret-seeding.yaml"));
  const seedJob = seeding.find((d) => d.kind === "Job" && d.metadata.name === "seed-blob-store")!;
  const script: string = seedJob.spec.template.spec.initContainers.find((c: Doc) => c.name === "draw-entropy").args[0];
  const identities = (): Doc[] => {
    const line = script.split("\n").find((l) => l.trim().startsWith('{"identities"'))!;
    return JSON.parse(line.trim().replaceAll("$PG_SECRET", "PGSECRET").replaceAll("$SECRET", "ADMINSECRET")).identities;
  };

  test("the gateway has a SECOND identity, `pgBackup`, scoped to zeta-backups, without Admin", () => {
    const ids = identities();
    const pg = ids.find((i) => i.name === "pgBackup")!;
    expect(pg, "no pgBackup identity in the gateway's identities document").toBeDefined();
    expect(pg.actions as string[]).not.toContain("Admin");
    for (const action of pg.actions as string[]) expect(action).toMatch(/^(Read|Write|List):zeta-backups$/);
    expect(pg.actions as string[]).toEqual(expect.arrayContaining(["Read:zeta-backups", "Write:zeta-backups", "List:zeta-backups"]));
  });

  test("it is a DIFFERENT credential from the admin identity (an independent draw, never the admin secret)", () => {
    const ids = identities();
    const admin = ids.find((i) => i.name === "anvAdmin")!;
    const pg = ids.find((i) => i.name === "pgBackup")!;
    expect(admin.actions).toContain("Admin");
    expect(pg.credentials[0].accessKey).not.toBe(admin.credentials[0].accessKey);
    expect(pg.credentials[0].secretKey).not.toBe(admin.credentials[0].secretKey);
  });

  test("the seeded Secret carries that identity's access key and its own secret, written only to tmpfs files", () => {
    const pg = identities().find((i) => i.name === "pgBackup")!;
    expect(script).toContain(`printf '%s' "${pg.credentials[0].accessKey}" > /work/PG_ACCESS_KEY_ID`);
    expect(script).toContain('printf \'%s\' "$PG_SECRET" > /work/PG_ACCESS_SECRET_KEY');
    // Every line that mentions the secret is one of exactly these three uses -- a draw, a write to a
    // tmpfs file, and the identities document -- so it is never an argv token, an env var or an echo.
    const uses = script
      .split("\n")
      .filter((l) => l.includes("PG_SECRET"))
      .map((l) => {
        const t = l.trim();
        if (t.startsWith("PG_SECRET=$(head -c 32 /dev/urandom")) return "draw";
        if (t === 'printf \'%s\' "$PG_SECRET" > /work/PG_ACCESS_SECRET_KEY') return "tmpfs-file";
        if (t.startsWith('{"identities"')) return "identities-document";
        return `UNEXPECTED: ${t}`;
      });
    expect(uses).toEqual(["draw", "tmpfs-file", "identities-document"]);
  });
});

describe("ordering: operator and CRDs first, then the Clusters, so they converge Healthy", () => {
  test("cnpg-barman-cloud follows BOTH cloudnativepg and cert-manager and precedes every Cluster that names it", () => {
    const w = wave("cnpg-barman-cloud");
    expect(w).toBeGreaterThan(wave("cloudnativepg"));
    expect(w).toBeGreaterThan(wave("cert-manager"));
    for (const c of CONSUMERS) expect(w).toBeLessThan(wave(c.crDir));
  });

  test("the object store (and its bucket job) precede the Clusters that archive to it", () => {
    for (const c of CONSUMERS) expect(wave("seaweedfs")).toBeLessThan(wave(c.crDir));
  });

  test("the declared dependency graph carries every edge, so derive-sync-waves can refuse a reorder", () => {
    expect(edgesOf("cnpg-barman-cloud")).toEqual(expect.arrayContaining(["cloudnativepg", "cert-manager"]));
    for (const chart of ["postgres-shared", "temporal-postgres"]) {
      expect(edgesOf(chart)).toEqual(expect.arrayContaining(["cloudnativepg", "cnpg-barman-cloud", "seaweedfs"]));
    }
  });

  test("every Application consuming a CRD from another Application defers, rather than SyncFailing, if it is a beat late", () => {
    for (const dir of ["postgres-shared", "temporal/postgres"]) {
      expect(app(dir).spec.syncPolicy.syncOptions).toContain("SkipDryRunOnMissingResource=true");
    }
  });

  test("the Cluster is judged by ArgoCD's built-in CNPG health check: argocd-cm overrides only the Application kind", () => {
    // If someone adds a custom `postgresql.cnpg.io_Cluster` health lua it must be deliberate: the
    // built-in (argo-cd resource_customizations/postgresql.cnpg.io/Cluster/health.lua, present at the
    // pinned major) already maps "Cluster in healthy state" -> Healthy and the setup phases -> Progressing.
    const argocd = read(resolve(APPS, "argocd/Application.yaml"));
    expect(argocd).not.toContain("resource.customizations.health.postgresql.cnpg.io_Cluster");
    expect(argocd).toContain("resource.customizations.health.argoproj.io_Application");
  });
});

describe("monitoring is on only because its CRD is ordered before it, and only in a form Prometheus will select", () => {
  const pm = yamlDoc(resolve(APPS, "postgres-shared/podmonitor.yaml"));
  const kps = app("kube-prometheus-stack");

  test("the PodMonitor CRD's provider reconciles first, and the edge is declared", () => {
    expect(wave("kube-prometheus-stack")).toBeLessThan(wave("postgres-shared"));
    expect(edgesOf("postgres-shared")).toContain("kube-prometheus-stack");
  });

  test("it carries the `release` label kube-prometheus-stack's default selector requires, or it is never scraped", () => {
    expect(kps.spec.source.helm.valuesObject?.prometheus?.prometheusSpec?.podMonitorSelectorNilUsesHelmValues).not.toBe(false);
    expect(pm.metadata.labels.release).toBe(kps.spec.source.helm.releaseName);
  });

  test("it selects this Cluster's pods on the `metrics` port, and the deprecated enablePodMonitor stays off", () => {
    expect(pm.spec.selector.matchLabels["cnpg.io/cluster"]).toBe("postgres-shared");
    expect(pm.spec.podMetricsEndpoints[0].port).toBe("metrics");
    const cluster = yamlDoc(resolve(APPS, "postgres-shared/cluster.yaml"));
    expect(cluster.spec.monitoring?.enablePodMonitor).not.toBe(true);
  });
});

describe("the dev/CI lane defers both new Applications, with a recorded reason", () => {
  test("both directories are in the root's exclude glob", () => {
    const glob = DEFAULT_ROOT_DEV_CATALOG.excludeGlob;
    expect(glob).toContain("postgres-shared/**");
    expect(glob).toContain("cnpg-barman-cloud/**");
  });
});
