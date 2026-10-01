// Falsifiers for full-ai-cluster/k8s/examples/cnpg-postgres-ha.yaml -- the template
// a consumer copies to get a highly-available PostgreSQL.
//
// WHY A TEMPLATE AND NOT A DEPLOYED CLUSTER: the tree ships ONE Cluster CR
// (temporal/postgres/cluster.yaml: instances 1, no backup), and CloudNativePG's own
// model is one cluster per application. A shared always-on one would be an appointed
// hub (manifesto section 1) costing 750m / 1.5 GiB on every install. So what must
// not rot is the template -- these tests are what keeps "HA" from meaning a number
// someone typed once.
//
// WHAT "HA" IS PINNED TO, and what is deliberately NOT claimed: three instances, a
// switchover-based rolling update, anti-affinity that PREFERS spreading (a required
// one would leave pods Pending on one node), and an operator-minted credential.
// There is no backup in the template and a test pins that the header SAYS so --
// replication is not a backup, and a template that read as durable would be the
// vacuity class.
//
// NOT PROVEN HERE: that the Cluster reconciles. That needs the operator and a node;
// this is the render-level contract the operator would then be handed.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAllDocuments, parse as parseYaml } from "yaml";
import { STORAGE_CAPABILITIES } from "./storage-capabilities.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const EXAMPLE = join(REPO_ROOT, "full-ai-cluster/k8s/examples/cnpg-postgres-ha.yaml");
const TEMPORAL = join(REPO_ROOT, "full-ai-cluster/k8s/applications/temporal/postgres/cluster.yaml");

type Doc = Record<string, any>;

const text = readFileSync(EXAMPLE, "utf8");
const docs = parseAllDocuments(text).map((d) => d.toJS() as Doc);
const cluster = docs.find((d) => d.kind === "Cluster")!;

describe("shape", () => {
  test("is a Namespace and one CNPG Cluster, in that namespace", () => {
    expect(docs.map((d) => d.kind)).toEqual(["Namespace", "Cluster"]);
    expect(cluster.apiVersion).toBe("postgresql.cnpg.io/v1");
    expect(cluster.metadata.namespace).toBe(docs[0]!.metadata.name);
  });

  test("lives OUTSIDE k8s/applications: nothing syncs it and no audit prices it", () => {
    // Inside the tree, rendered-storage-claims / rendered-resource-requests would read
    // the Cluster as 30Gi + 750m of demand that no sync provisions.
    expect(EXAMPLE.startsWith(join(REPO_ROOT, "full-ai-cluster/k8s/applications"))).toBe(false);
  });
});

describe("it is highly available, to the extent one node allows, and says where that stops", () => {
  test("three instances: one primary and two replicas, so one loss still leaves a majority", () => {
    expect(cluster.spec.instances).toBeGreaterThanOrEqual(3);
  });

  test("a rolling update SWITCHES OVER; it never just restarts the primary under the application", () => {
    expect(cluster.spec.primaryUpdateMethod).toBe("switchover");
    expect(cluster.spec.primaryUpdateStrategy).toBe("unsupervised");
  });

  test("anti-affinity is on and PREFERRED -- required would leave 2 of 3 Pending on one node", () => {
    expect(cluster.spec.affinity.enablePodAntiAffinity).toBe(true);
    expect(cluster.spec.affinity.podAntiAffinityType).toBe("preferred");
    expect(cluster.spec.affinity.topologyKey).toBe("kubernetes.io/hostname");
  });

  test("the header states that replication is not a backup and that there is none", () => {
    expect(text).toContain("THERE IS NO BACKUP");
    expect(text).toContain("Replication is not a backup");
    expect(cluster.spec.backup).toBeUndefined();
    expect(cluster.spec.plugins).toBeUndefined();
  });

  test("replication is asynchronous by default, and synchronous is named as a three-node choice", () => {
    expect(cluster.spec.minSyncReplicas ?? 0).toBe(0);
    expect(text).toContain("minSyncReplicas: 1");
  });
});

describe("credentials are minted with the role, never written down", () => {
  test("no password, no superuser access, no pre-supplied secret", () => {
    // A POSITIVE claim over the whole document, not an absence in one rendering: walk every
    // key at every depth and require the set of credential-shaped keys to be exactly empty.
    const keysOf = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.flatMap(keysOf)
        : v !== null && typeof v === "object"
          ? Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => [k, ...keysOf(x)])
          : [];
    expect(keysOf(cluster).filter((k) => /pass(word|wd)/i.test(k))).toEqual([]);
    // enableSuperuserAccess defaults to false; a template must not turn it on.
    expect(cluster.spec.enableSuperuserAccess).not.toBe(true);
    // `bootstrap.initdb.secret` would point at a Secret something else must mint.
    expect(cluster.spec.bootstrap.initdb.secret).toBeUndefined();
    expect(cluster.spec.bootstrap.initdb.owner).toBe(cluster.spec.bootstrap.initdb.database);
  });
});

describe("resources are explicit: requests AND a memory limit, never BestEffort", () => {
  test("cpu+memory requests, a memory limit at or above the request, and NO cpu limit", () => {
    const { requests, limits } = cluster.spec.resources;
    expect(requests.cpu).toBeDefined();
    expect(requests.memory).toBeDefined();
    expect(limits.memory).toBeDefined();
    expect(limits.cpu).toBeUndefined(); // a CFS quota throttles a database into missing its probe

    const mib = (q: string): number => Number(/^(\d+)(Mi|Gi)$/.exec(q)![1]) * (q.endsWith("Gi") ? 1024 : 1);
    expect(mib(limits.memory)).toBeGreaterThanOrEqual(mib(requests.memory));
  });
});

describe("storage follows the tree's own rules", () => {
  test("names a storage CAPABILITY and a concrete size, per instance", () => {
    expect(STORAGE_CAPABILITIES as readonly string[]).toContain(cluster.spec.storage.storageClass);
    expect(cluster.spec.storage.size).toMatch(/^\d+(Gi|Ti)$/);
  });

  test("is node-local, matching CNPG's shared-nothing guidance (durability comes from instances)", () => {
    expect(cluster.spec.storage.storageClass).toBe("zeta-block-local");
  });
});

describe("one PostgreSQL image for every CNPG consumer in the tree", () => {
  test("the template pins the SAME imageName as temporal-postgres, by tag, never latest", () => {
    const temporal = parseYaml(readFileSync(TEMPORAL, "utf8")) as Doc;
    expect(cluster.spec.imageName).toBe(temporal.spec.imageName);
    expect(cluster.spec.imageName).toMatch(/:\d+\.\d+-/);
    expect(cluster.spec.imageName).not.toContain(":latest");
  });
});
