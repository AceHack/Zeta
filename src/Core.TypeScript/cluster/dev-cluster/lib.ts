#!/usr/bin/env bun
// Pure validation, config parsing, and substrate paths for dev-cluster CLIs.
// No process spawn — external deps flow through cluster/ports.ts adapters only.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dir, "../../../..");
export const DEV_CLUSTER_SUBSTRATE_DIR = join(REPO_ROOT, "full-ai-cluster/dev-cluster");

/**
 * Repo-relative paths of the dev/CI alias StorageClass manifests.
 *
 * ONE constant, TWO consumers, and that is the whole point. `use-cases.ts`
 * APPLIES these at bring-up; `argocd-health-test.ts` reads the longhorn one to
 * decide whether an Application that requests `storageClass: longhorn` may be
 * asserted in the dev lane. If those two named the file separately, the harness
 * could believe a StorageClass exists that bring-up no longer creates -- an
 * assertion resting on absent substrate, which is the exact shape of a check
 * that did not run looking like a check that passed.
 *
 * Repo-RELATIVE (not absolute) because the harness resolves them against a
 * caller-supplied `repoRoot`, which its unit tests point at fixture trees.
 */
export const DEV_STORAGE_ALIAS_MANIFEST_RELPATHS = {
  zetaLocalPath: "full-ai-cluster/dev-cluster/manifests/zeta-local-path.yaml",
  longhorn: "full-ai-cluster/dev-cluster/manifests/longhorn.yaml",
} as const;

/** The StorageClass name the dev/CI longhorn alias is required to declare. */
export const DEV_LONGHORN_ALIAS_CLASS_NAME = "longhorn";

/**
 * Provisioners a dev/CI substrate can actually satisfy.
 *
 * The alias check is NOT "is there a StorageClass by that name" -- that is
 * satisfied by `provisioner: driver.longhorn.io`, which is exactly the thing a
 * kind node cannot run. An edit that "restored parity" by pointing the dev
 * manifest at the real Longhorn driver would then unlock ten Applications onto
 * a class that can provision nothing, and every one of their PVCs would pend.
 * So the provisioner is pinned to what the dev substrate ships.
 */
export const DEV_SATISFIABLE_PROVISIONERS: ReadonlySet<string> = new Set(["rancher.io/local-path"]);

/** Absolute path of a dev alias manifest, for the bring-up use-cases. */
export function devStorageAliasManifestPath(key: keyof typeof DEV_STORAGE_ALIAS_MANIFEST_RELPATHS): string {
  return join(REPO_ROOT, DEV_STORAGE_ALIAS_MANIFEST_RELPATHS[key]);
}

/**
 * The Grafana admin credential `kube-prometheus-stack` expects to ALREADY EXIST.
 *
 * ONE constant, THREE consumers, for the same reason the StorageClass relpaths
 * above are one constant: `use-cases.ts` MINTS this Secret at bring-up,
 * `argocd-health-test.ts` REFUSES an included run whose cluster does not have
 * it, and `argocd-health-test.test.ts` reads
 * `applications/kube-prometheus-stack/Application.yaml` and asserts the chart
 * asks for exactly these strings. If the three named it separately, a rename on
 * either side would leave bring-up minting a Secret nothing reads while Grafana
 * waited for one nobody mints -- and the symptom would be the
 * `CreateContainerConfigError` this exists to remove.
 *
 * MEASURED (run 32519516070): with the dev longhorn alias in place, that
 * Application's prometheus and alertmanager PVCs bound and both pods ran 2/2.
 * Grafana alone was `CreateContainerConfigError`, `secret
 * "grafana-admin-credentials" not found`, because the chart is configured with
 * `grafana.admin.existingSecret` -- deliberately, so no credential is committed
 * -- and nothing in the dev lane ever created one.
 *
 * WHY THE FIX IS HERE AND NOT IN THE CHART VALUES. Weakening `existingSecret`
 * (letting the chart generate its own admin password, or inlining one) would
 * change what the METAL cluster deploys in order to make a CI lane green --
 * asserting less about the app rather than fixing it. `full-ai-cluster/dev-cluster/`
 * is never read by ArgoCD, so a credential minted from here reaches dev/CI
 * clusters only, structurally rather than by convention.
 */
export const DEV_GRAFANA_ADMIN_SECRET = {
  namespace: "monitoring",
  name: "grafana-admin-credentials",
  userKey: "admin-user",
  passwordKey: "admin-password",
  user: "admin",
} as const;

/**
 * The dev/CI Grafana admin Secret, as a manifest.
 *
 * PURE, and the password is a PARAMETER rather than drawn in here, so the shape
 * is testable without entropy and the one place entropy enters is the caller in
 * `use-cases.ts`. NO CREDENTIAL IS COMMITTED to this repository: the value is
 * minted per cluster at bring-up, printed nowhere, and dies with the cluster.
 *
 * `stringData` rather than `data` on purpose -- the API server does the base64,
 * so nothing here is an encoded blob a reader has to decode before auditing it.
 *
 * The annotations are the dev-only label the alias StorageClass carries for the
 * same reason: this object has to be legible as a CI artefact at a glance, so
 * that nobody promotes the pattern anywhere near metal.
 */
export function buildDevGrafanaAdminSecretManifest(password: string): string {
  const { namespace, name, userKey, passwordKey, user } = DEV_GRAFANA_ADMIN_SECRET;
  return [
    "apiVersion: v1",
    "kind: Secret",
    "metadata:",
    `  name: ${name}`,
    `  namespace: ${namespace}`,
    "  annotations:",
    '    zeta.io/dev-substrate-credential: "true"',
    "    zeta.io/dev-substrate-credential-reason: >-",
    "      Minted per dev/CI cluster at bring-up so kube-prometheus-stack's",
    "      grafana.admin.existingSecret resolves. Never applied to the bare-metal",
    "      cluster, never committed to git, never reused across clusters.",
    "type: Opaque",
    "stringData:",
    `  ${userKey}: ${user}`,
    `  ${passwordKey}: ${password}`,
    "",
  ].join("\n");
}

const GITHUB_REPO_URL =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/;

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function isDnsLabel(value: string): boolean {
  return /^[a-z\d]([-a-z\d]*[a-z\d])?$/.test(value);
}

export function isSafeGitRef(value: string): boolean {
  return (
    /^[A-Za-z\d._/-]+$/.test(value) &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.endsWith("/") &&
    !value.includes("//")
  );
}

export function isGitHubRepoUrl(value: string): boolean {
  return GITHUB_REPO_URL.test(value);
}

export function assertSafeGitRef(gitRef: string): void {
  if (!isSafeGitRef(gitRef)) {
    fail(`ERROR: git-ref must match [a-zA-Z0-9._/-]+ (got: '${gitRef}')`);
  }
}

export function assertGitHubRepoUrl(gitRepoUrl: string): void {
  if (!isGitHubRepoUrl(gitRepoUrl)) {
    fail(`ERROR: git repo URL must be an https://github.com/<owner>/<repo> URL (got: '${gitRepoUrl}')`);
  }
}

export function assertDnsLabel(name: string, label: string): void {
  if (!isDnsLabel(name)) {
    fail(`ERROR: ${label} must be a DNS label (got: '${name}')`);
  }
}

export function assertFileExists(path: string, label: string): void {
  if (!existsSync(path)) {
    fail(`ERROR: ${label} not found: ${path}`);
  }
}

export function parseK3dClusterName(configPath: string): string {
  const text = readFileSync(configPath, "utf8");
  let inMetadata = false;
  for (const line of text.split("\n")) {
    if (/^metadata:\s*$/.test(line)) {
      inMetadata = true;
      continue;
    }
    if (inMetadata && /^[^\s]/.test(line)) break;
    if (inMetadata) {
      const match = line.match(/^\s+name:\s*(\S+)/);
      if (match) return match[1]!;
    }
  }
  fail(`ERROR: k3d config metadata.name not found: ${configPath}`);
}

export function parseK3dAgentCount(configPath: string): number {
  const text = readFileSync(configPath, "utf8");
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*agents:\s*(\d+)\s*$/);
    if (match) return Number(match[1]);
  }
  return 0;
}

export function readFlagValue(argv: readonly string[], index: number, flag: string): string | null {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("-")) {
    console.error(`usage: ${flag} requires a value`);
    process.exit(1);
  }
  return value;
}

export const DEFAULT_GIT_REPO_URL =
  process.env.ZETA_ARGOCD_GIT_REPO_URL ?? "https://github.com/Lucent-Financial-Group/Zeta";
