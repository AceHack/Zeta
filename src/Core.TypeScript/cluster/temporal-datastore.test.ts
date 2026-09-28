// temporal-datastore.test.ts -- does temporal point at a datastore this tree actually creates?
//
// RED on 2026-09-27 origin/main, for the three reasons the live USB install
// (node-5b2dfa) showed temporal Synced/Degraded:
//
//   (a) both persistence stores pointed at `cockroachdb-public...:26257`, where no
//       `temporal` SQL user exists, the TLS-only listener refuses a client with no CA,
//       and Temporal's SQL visibility schema (btree_gin + a UDF inside generated
//       columns) cannot apply at all;
//   (b) the password Secret was seeded by a first-boot Job that nothing on the
//       database side ever read -- a credential with no account behind it;
//   (c) nothing ordered a PostgreSQL between the CNPG operator and temporal.
//
// These tests read the TREE, not a cluster: "the host temporal dials is one some
// Application in this tree creates" is checkable offline, and it is exactly the
// property that was false.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import { readShippedApplications } from "./derive-sync-waves.ts";
import {
  CNPG_APP_SECRET_KEYS,
  auditMetalSecretProduction,
  collectCnpgClusters,
} from "./metal-secret-production.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const TEMPORAL_APP = "full-ai-cluster/k8s/applications/temporal/Application.yaml";
const POSTGRES_PLUGINS: ReadonlySet<string> = new Set(["postgres12", "postgres12_pgx"]);

interface SqlStore {
  readonly driver: string;
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly existingSecret: string;
  readonly secretKey: string;
}

function temporalStores(): { readonly default: SqlStore; readonly visibility: SqlStore } {
  const docs = parseAllDocuments(readFileSync(resolve(REPO_ROOT, TEMPORAL_APP), "utf8"));
  // biome-ignore lint/suspicious/noExplicitAny: a YAML tree walked by known path.
  const app = docs.map((d) => d.toJS() as any).find((v) => v?.kind === "Application");
  const persistence = app.spec.source.helm.valuesObject.server.config.persistence;
  const read = (store: "default" | "visibility"): SqlStore => {
    const s = persistence[store];
    expect(s.driver, `${store}.driver`).toBe("sql");
    return {
      driver: s.sql.driver,
      host: s.sql.host,
      port: s.sql.port,
      database: s.sql.database,
      user: s.sql.user,
      existingSecret: s.sql.existingSecret,
      // The chart (0.59.0 _helpers.tpl `temporal.persistence.sql.secretKey`) reads
      // `password` whenever `existingSecret` is set and no `secretKey` overrides it.
      secretKey: s.sql.secretKey ?? "password",
    };
  };
  return { default: read("default"), visibility: read("visibility") };
}

describe("temporal's datastore is a PostgreSQL this tree creates", () => {
  const stores = temporalStores();
  const clusters = collectCnpgClusters();

  test("(a) both stores use a Postgres plugin and dial a CNPG Cluster's -rw service", () => {
    for (const [name, s] of Object.entries(stores)) {
      expect(POSTGRES_PLUGINS.has(s.driver), `${name}: plugin ${s.driver}`).toBe(true);
      const cluster = clusters.find((c) => c.rwHosts.includes(s.host));
      expect(cluster, `${name}: no CNPG Cluster in the tree serves ${s.host}`).toBeDefined();
      expect(s.port).toBe(5432);
      // The database must exist on THAT cluster and be owned by the user temporal
      // logs in as -- otherwise the schema Job is refused with a permission error.
      expect(cluster?.databases.get(s.database), `${name}: database ${s.database} owner`).toBe(s.user);
    }
  });

  test("(b) the Secret temporal reads is produced on a fresh metal install, with the key the chart reads", () => {
    const audit = auditMetalSecretProduction();
    for (const [name, s] of Object.entries(stores)) {
      const produced = audit.operatorGenerated.find((r) => r.app === "temporal" && r.secretName === s.existingSecret);
      expect(produced, `${name}: ${s.existingSecret} is not an operator-generated Secret`).toBeDefined();
      expect(CNPG_APP_SECRET_KEYS).toContain(s.secretKey);
      // And the password in it belongs to the role temporal logs in as.
      const cluster = clusters.find((c) => c.appSecret === s.existingSecret);
      expect(cluster?.owner, `${name}: ${s.existingSecret} owner`).toBe(s.user);
    }
    // ONE source of truth: nothing else may mint a second, diverging password
    // under a name temporal no longer reads.
    const seeded = [...audit.seeded].filter((r) => r.app === "temporal");
    expect(seeded).toEqual([]);
  });

  test("(c) sync waves order CNPG operator < the Cluster's Application < temporal", () => {
    const apps = readShippedApplications();
    const wave = (name: string): number => {
      const w = apps.find((a) => a.name === name)?.wave;
      expect(w, `${name} has a sync wave`).toBeDefined();
      return w ?? Number.NaN;
    };
    const cluster = clusters.find((c) => c.rwHosts.includes(stores.default.host));
    expect(cluster).toBeDefined();
    const clusterApp = cluster?.app ?? "";
    expect(wave("cloudnativepg")).toBeLessThan(wave(clusterApp));
    expect(wave(clusterApp)).toBeLessThan(wave("temporal"));
  });
});
