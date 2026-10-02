#!/usr/bin/env bun
// metal-secret-production.ts -- does a FRESH METAL install produce every Secret the
// ArgoCD catalogue names?
//
// ---------------------------------------------------------------------------
// WHY A THIRD CHECK, WHEN TWO ALREADY LOOK AT SECRETS
// ---------------------------------------------------------------------------
//
// `audit-existing-secret-is-minted.ts` asks two questions and neither is this one:
//
//   valuesObject scan  -> is the name minted by the DEV/CI roster?
//   raw-manifest scan  -> is the name minted by a Secret/SealedSecret/ExternalSecret
//                          committed under k8s/applications/?
//
// The metal lane has a third producer those two never read: the k3s first-boot
// seeding Jobs in `k8s/bootstrap/internal-secret-seeding.yaml`, which `kubectl
// create` INTERNAL credentials before ArgoCD exists. And the dev-roster question
// lets an Application that is excluded from the dev lane carry an acknowledgement
// ("temporal is dev-excluded, so no cluster in this lane resolves the name") that
// is true of dev and says nothing about metal -- where that Application IS synced.
//
// Measured on a real USB install (node-5b2dfa, 2026-09-27): ArgoCD `temporal`
// Synced/Degraded, every server pod `CreateContainerConfigError: secret
// "temporal-default-store" not found`, no ExternalSecret anywhere, nothing in the
// seeding manifest. Both existing audits were green on that tree. This one is red.
//
// ---------------------------------------------------------------------------
// WHAT COUNTS AS PRODUCED ON METAL
// ---------------------------------------------------------------------------
//
//   1. a `kubectl create secret generic <name> -n <ns>` step in a seeding Job,
//      matched on (namespace, name) -- a Secret in the wrong namespace is not one
//      the consuming pod can mount;
//   2. a Secret / SealedSecret / ExternalSecret committed in the tree;
//   3. a Secret an OPERATOR generates from a CR committed in the tree, matched on
//      (namespace, name) like (1). Today that is CloudNativePG: a `Cluster` bootstrapped
//      with `initdb` makes the operator write `<cluster>-app` (keys CNPG_APP_SECRET_KEYS)
//      holding the owner role's password. Derived from the CR, never listed by hand --
//      so the Secret's name, namespace and the role it authenticates are all read from
//      the same document the operator reads;
//   4. an entry in METAL_NOT_SEEDED below, which is a CLAIM with a reason: the
//      credential is external (operator-supplied), operator-generated at runtime,
//      or mounted `optional: true`. Every entry must still match a reference, or
//      it fails as STALE -- so a lifted exemption forces the question again.
//
// Exit codes: 0 clean, 1 an unproduced Secret or a stale exemption.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import { discoverGitDirectorySources, listSupportingManifests, sourceReconciles } from "./app-of-apps-discovery.ts";
import {
  collectRawSecretReferences,
  collectSecretReferences,
  collectTreeMintedSecretNames,
  referenceKey,
  type SecretReference,
} from "./audit-existing-secret-is-minted.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const METAL_SEEDING_RELATIVE_PATH = "full-ai-cluster/k8s/bootstrap/internal-secret-seeding.yaml";
const APPLICATIONS_DIR = "full-ai-cluster/k8s/applications";

/**
 * `<app>|<secretName>` -> why a fresh metal install legitimately does NOT seed it.
 * Not a to-do list: "someone will add it later" is not a reason, it is the defect.
 */
export const METAL_NOT_SEEDED: ReadonlyMap<string, string> = new Map([
  [
    "hindsight|hindsight-llm-api-key",
    "EXTERNAL: a real LLM provider API key. Operator-supplied; the cluster cannot draw it for itself.",
  ],
  [
    "arc-runner-set|arc-github-app",
    "EXTERNAL: a GitHub App id/installation/private key the maintainer provisions (see the baseline entry in existing-secret-is-minted.baseline.json).",
  ],
  [
    "platform|ghcr-pull",
    "EXTERNAL: a GHCR pull credential; tracked as workitem 081M33TN49G087G0R000X5ZJ75.",
  ],
  [
    "openbao|openbao-unseal-shares",
    "OPTIONAL: mounted `optional: true`; written by the gated init ceremony, never by a first-boot Job.",
  ],
  [
    "gitlab|gitlab-redis-secret",
    "CHART-MINTED: the gitlab chart's shared-secrets Job (a Helm pre-install/pre-upgrade hook, run by every ArgoCD sync) generates it; the dedicated Valkey in gitlab/Application.yaml reads the same password the chart's `global.redis.auth` does.",
  ],
  [
    "gitlab|gitlab-rails-db-app",
    "OPERATOR-GENERATED: CloudNativePG mints `<cluster>-app` with the `gitlab` role's password when it creates Cluster gitlab-rails-db -- which is declared in the gitlab release's extraObjects, so collectCnpgClusters (directory-source Applications only) does not see it.",
  ],
  [
    "gitlab|gitlab-backup-s3cmd",
    "RELEASE-MINTED: Job gitlab-backup-s3cmd (gitlab/Application.yaml extraObjects, Sync hook, wave -1) derives it from zeta-blob-store/connection on every sync, ahead of the toolbox that mounts it. Not seeded: there is no second credential.",
  ],
  [
    "kubevirt|kubevirt-operator-certs",
    "OPERATOR-GENERATED: virt-operator creates its own webhook cert Secret at startup.",
  ],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every `<namespace>/<name>` a first-boot seeding Job `kubectl create`s. */
export function collectMetalSeededSecrets(repoRoot = REPO_ROOT): ReadonlySet<string> {
  const text = readFileSync(resolve(repoRoot, METAL_SEEDING_RELATIVE_PATH), "utf8");
  const out = new Set<string>();
  for (const doc of parseAllDocuments(text)) {
    const value = doc.toJS() as unknown;
    if (!isRecord(value) || value.kind !== "Job") continue;
    const podSpec = (value.spec as { template?: { spec?: Record<string, unknown> } } | undefined)?.template?.spec;
    const containers = [
      ...((podSpec?.initContainers as readonly { args?: readonly string[] }[] | undefined) ?? []),
      ...((podSpec?.containers as readonly { args?: readonly string[] }[] | undefined) ?? []),
    ];
    for (const c of containers) {
      const args = c.args ?? [];
      if (args[0] !== "create" || args[1] !== "secret" || args[2] !== "generic") continue;
      const name = args[3];
      const nsIndex = args.indexOf("-n");
      const ns = nsIndex >= 0 ? args[nsIndex + 1] : undefined;
      if (name !== undefined && ns !== undefined) out.add(`${ns}/${name}`);
    }
  }
  return out;
}

/** The namespace an Application's pods run in -- where a referenced Secret must exist. */
export function applicationNamespace(app: string, repoRoot = REPO_ROOT): string | null {
  let text: string;
  try {
    text = readFileSync(join(resolve(repoRoot, APPLICATIONS_DIR), app, "Application.yaml"), "utf8");
  } catch {
    return null;
  }
  for (const doc of parseAllDocuments(text)) {
    const value = doc.toJS() as unknown;
    if (!isRecord(value) || value.kind !== "Application") continue;
    const ns = ((value.spec as Record<string, unknown> | undefined)?.destination as Record<string, unknown> | undefined)
      ?.namespace;
    if (typeof ns === "string" && ns !== "") return ns;
  }
  return null;
}

/**
 * The keys CloudNativePG writes into a Cluster's `<cluster>-app` Secret
 * (CNPG 1.30, "Connecting from an application"). `password` is the one every
 * consumer here reads; the rest are listed so a consumer pointing `secretKey` at
 * one of them is still checkable, and one pointing anywhere else is not.
 */
export const CNPG_APP_SECRET_KEYS: readonly string[] = [
  "username",
  "user",
  "password",
  "dbname",
  "host",
  "port",
  "uri",
  "jdbc-uri",
  "pgpass",
  "fqdn-uri",
  "fqdn-jdbc-uri",
];

/** A CNPG `Cluster` committed in the tree, and what the operator will make of it. */
export interface CnpgCluster {
  /** The ArgoCD Application whose directory source applies the Cluster CR. */
  readonly app: string;
  readonly name: string;
  readonly namespace: string;
  /** The read-write Service, in every spelling a pod's resolver accepts. */
  readonly rwHosts: readonly string[];
  /** `<name>-app` when bootstrapped with initdb (CNPG's default), else null. */
  readonly appSecret: string | null;
  /** The initdb owner role -- the role `appSecret`'s password authenticates. */
  readonly owner: string;
  /** database -> owner, from initdb plus every `Database` CR naming this Cluster. */
  readonly databases: ReadonlyMap<string, string>;
  readonly manifest: string;
}

/** The CNPG API GROUP, compared as a whole `group/version` segment -- never a substring. */
const CNPG_API_GROUP = "postgresql.cnpg.io";
/** Cheap prefilter: a document line `apiVersion: postgresql.cnpg.io/...`. */
const CNPG_API_LINE = /^apiVersion:\s*postgresql\.cnpg\.io\//m;
const isCnpgApiVersion = (apiVersion: unknown): boolean =>
  typeof apiVersion === "string" && apiVersion.split("/")[0] === CNPG_API_GROUP;

/**
 * Every CNPG `Cluster` a directory-source Application in this tree applies.
 *
 * A Cluster CR no Application reconciles is not collected: the operator never sees
 * it, so the Secret it would generate never exists -- counting it would be the
 * declaration-governs-a-path-that-does-not-exist defect.
 */
export function collectCnpgClusters(repoRoot = REPO_ROOT): readonly CnpgCluster[] {
  // The dev root catalogue is itself a directory source over the whole tree; it
  // applies Application manifests, never a supporting CR, so it owns nothing here.
  const sources = discoverGitDirectorySources(repoRoot).filter((s) => !s.origin.startsWith("src/"));
  const clusters: {
    app: string;
    name: string;
    namespace: string;
    bootstrap: Record<string, unknown>;
    manifest: string;
  }[] = [];
  const databases: { cluster: string; namespace: string; name: string; owner: string }[] = [];
  for (const rel of listSupportingManifests(repoRoot)) {
    const repoRel = `${APPLICATIONS_DIR}/${rel.split("\\").join("/")}`;
    const text = readFileSync(resolve(repoRoot, repoRel), "utf8");
    if (!CNPG_API_LINE.test(text)) continue;
    const owner = sources.find((s) => sourceReconciles(s, repoRel));
    if (owner === undefined) continue;
    const appNs = applicationNamespaceFromManifest(resolve(repoRoot, owner.origin));
    for (const doc of parseAllDocuments(text)) {
      const value = doc.toJS() as unknown;
      if (!isRecord(value) || !isCnpgApiVersion(value.apiVersion)) {
        continue;
      }
      const metadata = isRecord(value.metadata) ? value.metadata : {};
      const spec = isRecord(value.spec) ? value.spec : {};
      const name = typeof metadata.name === "string" ? metadata.name : "";
      const namespace = typeof metadata.namespace === "string" ? metadata.namespace : (appNs ?? "");
      if (name === "" || namespace === "") continue;
      if (value.kind === "Cluster") {
        const bootstrap = isRecord(spec.bootstrap) ? spec.bootstrap : {};
        clusters.push({ app: owner.app, name, namespace, bootstrap, manifest: repoRel });
      } else if (value.kind === "Database" && spec.ensure !== "absent") {
        const cluster = isRecord(spec.cluster) && typeof spec.cluster.name === "string" ? spec.cluster.name : "";
        if (typeof spec.name === "string" && typeof spec.owner === "string" && cluster !== "") {
          databases.push({ cluster, namespace, name: spec.name, owner: spec.owner });
        }
      }
    }
  }
  return clusters.map((c) => {
    // CNPG: no bootstrap section means initdb with database `app`; `owner`
    // defaults to the database name. Any other bootstrap method (recovery,
    // pg_basebackup) generates no `-app` Secret of its own.
    const other = Object.keys(c.bootstrap).some((k) => k !== "initdb");
    const initdb = isRecord(c.bootstrap.initdb) ? c.bootstrap.initdb : {};
    const database = typeof initdb.database === "string" ? initdb.database : "app";
    const owner = typeof initdb.owner === "string" ? initdb.owner : database;
    const dbs = new Map<string, string>([[database, owner]]);
    for (const d of databases) if (d.cluster === c.name && d.namespace === c.namespace) dbs.set(d.name, d.owner);
    const rw = `${c.name}-rw.${c.namespace}`;
    return {
      app: c.app,
      name: c.name,
      namespace: c.namespace,
      rwHosts: [rw, `${rw}.svc`, `${rw}.svc.cluster.local`],
      appSecret: other ? null : `${c.name}-app`,
      owner,
      databases: dbs,
      manifest: c.manifest,
    };
  });
}

function applicationNamespaceFromManifest(absPath: string): string | null {
  for (const doc of parseAllDocuments(readFileSync(absPath, "utf8"))) {
    const value = doc.toJS() as unknown;
    if (!isRecord(value) || value.kind !== "Application") continue;
    const ns = ((value.spec as Record<string, unknown> | undefined)?.destination as Record<string, unknown> | undefined)
      ?.namespace;
    if (typeof ns === "string" && ns !== "") return ns;
  }
  return null;
}

/** Every `<namespace>/<name>` an operator generates from a CR committed in the tree. */
export function collectOperatorGeneratedSecrets(repoRoot = REPO_ROOT): ReadonlySet<string> {
  const out = new Set<string>();
  for (const c of collectCnpgClusters(repoRoot)) if (c.appSecret !== null) out.add(`${c.namespace}/${c.appSecret}`);
  return out;
}

export interface MetalAudit {
  readonly seeded: readonly SecretReference[];
  /** Generated at runtime by an operator from a CR this tree commits (CNPG `<cluster>-app`). */
  readonly operatorGenerated: readonly SecretReference[];
  readonly treeMinted: readonly SecretReference[];
  readonly exempt: readonly SecretReference[];
  /** Referenced, and nothing on a fresh metal install produces it. */
  readonly unproduced: readonly (SecretReference & { readonly namespace: string | null })[];
  readonly staleExemptions: readonly string[];
}

export function auditMetalSecretProduction(
  repoRoot = REPO_ROOT,
  exemptions: ReadonlyMap<string, string> = METAL_NOT_SEEDED,
): MetalAudit {
  const seededSet = collectMetalSeededSecrets(repoRoot);
  const operatorSet = collectOperatorGeneratedSecrets(repoRoot);
  const treeMintedSet = collectTreeMintedSecretNames(repoRoot);
  const references = [...collectSecretReferences(repoRoot), ...collectRawSecretReferences(repoRoot)];
  const seeded: SecretReference[] = [];
  const operatorGenerated: SecretReference[] = [];
  const treeMinted: SecretReference[] = [];
  const exempt: SecretReference[] = [];
  const unproduced: (SecretReference & { namespace: string | null })[] = [];
  const used = new Set<string>();
  for (const r of references) {
    const namespace = applicationNamespace(r.app, repoRoot);
    if (namespace !== null && seededSet.has(`${namespace}/${r.secretName}`)) {
      seeded.push(r);
      continue;
    }
    if (namespace !== null && operatorSet.has(`${namespace}/${r.secretName}`)) {
      operatorGenerated.push(r);
      continue;
    }
    if (treeMintedSet.has(r.secretName)) {
      treeMinted.push(r);
      continue;
    }
    const key = referenceKey(r.app, r.secretName);
    if (exemptions.has(key)) {
      used.add(key);
      exempt.push(r);
      continue;
    }
    unproduced.push({ ...r, namespace });
  }
  const staleExemptions = [...exemptions.keys()].filter((k) => !used.has(k)).sort();
  return { seeded, operatorGenerated, treeMinted, exempt, unproduced, staleExemptions };
}

function main(): void {
  const a = auditMetalSecretProduction();
  const lines = ["Secrets the metal catalogue names vs what a fresh metal install produces", ""];
  for (const r of a.unproduced) {
    lines.push(
      `  UNPRODUCED ${r.app} — names Secret \`${String(r.namespace)}/${r.secretName}\` at ${r.field}`,
      `             ${r.manifest}`,
      `             Seed it in ${METAL_SEEDING_RELATIVE_PATH}, commit an ExternalSecret/SealedSecret,`,
      `             or exempt it in METAL_NOT_SEEDED with a reason.`,
      "",
    );
  }
  for (const k of a.staleExemptions) lines.push(`  STALE EXEMPTION ${k} — matches no unproduced reference; delete it`, "");
  lines.push(
    `  seeded (${String(a.seeded.length)}) · operator-generated (${String(a.operatorGenerated.length)}) · tree-minted (${String(a.treeMinted.length)}) · exempt (${String(a.exempt.length)})`,
  );
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exit(a.unproduced.length > 0 || a.staleExemptions.length > 0 ? 1 : 0);
}

if (import.meta.main) main();
