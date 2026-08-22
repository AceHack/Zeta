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
 * A credential a dev/CI cluster must ALREADY HOLD before the app-of-apps root
 * syncs, because the Application that consumes it does not mint its own.
 *
 * TWO Applications are in this class today, and they are in it for the SAME
 * reason expressed by two different chart values: `kube-prometheus-stack` sets
 * `grafana.admin.existingSecret`, and `oz` sets `useCustomAdminSecret: true` +
 * `customAdminSecretName`. Both were deliberate -- neither chart should invent
 * an admin password this repository then has to commit -- and in both cases the
 * consequence is that kubelet resolves a `secretKeyRef` at container-create
 * time and a missing Secret is a HARD config error, not a retry.
 */
export interface DevBootstrapSecretSpec {
  readonly namespace: string;
  readonly name: string;
  readonly userKey: string;
  readonly passwordKey: string;
  readonly user: string;
  /** Why this object exists, written into the manifest so it is legible in-cluster. */
  readonly reason: string;
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
export const DEV_GRAFANA_ADMIN_SECRET: DevBootstrapSecretSpec = {
  namespace: "monitoring",
  name: "grafana-admin-credentials",
  userKey: "admin-user",
  passwordKey: "admin-password",
  user: "admin",
  reason:
    "Minted per dev/CI cluster at bring-up so kube-prometheus-stack's " +
    "grafana.admin.existingSecret resolves.",
} as const;

/**
 * The OpenZiti controller admin credential `oz` expects to ALREADY EXIST.
 *
 * SAME SHAPE AS GRAFANA ABOVE, and the same three consumers. The Application
 * sets `useCustomAdminSecret: true` + `customAdminSecretName:
 * ziti-admin-credentials`, and ziti-controller 3.1.1's `templates/secrets.yaml`
 * guards its generated Secret on `not .Values.useCustomAdminSecret` -- so with
 * the custom secret asked for, the render emits NO admin Secret at all
 * (MEASURED 2026-08-22: `helm template` of that chart against this
 * Application's own valuesObject yields exactly one Secret,
 * `ziti-controller-trust-domain`). The Deployment's init and main containers
 * both read `secretKeyRef` name `ziti-admin-credentials`, keys `admin-user` and
 * `admin-password`, which is why those exact strings are here and not guessed.
 *
 * WHY NOT JUST LET THE CHART GENERATE ONE. Because the generated Secret is
 * NON-DETERMINISTIC UNDER ARGOCD, which is strictly worse than the deferral it
 * would lift. `secrets.yaml` builds the password as
 * `(lookup ...).admin-password | default (randAlphaNum 32 | b64enc)`, and
 * ArgoCD's repo-server templates with no cluster access, so `lookup` returns
 * empty every time and the fallback draws fresh entropy. MEASURED the same day:
 * two `helm template` runs of the same chart, same values, with
 * `useCustomAdminSecret: false` differ in `admin-password`. With
 * `selfHeal: true` on this Application that is a credential rotating under a
 * running controller on every reconcile. So the manifest's stated intent is
 * KEPT and the dev lane supplies the source, exactly as it does for Grafana.
 *
 * THE NAMESPACE IS LOAD-BEARING BEYOND THIS SECRET. `openziti` must exist
 * before the app-of-apps root syncs for a second, independent reason:
 * trust-manager's Role over Secrets is created IN ITS TRUST NAMESPACE, which
 * this tree now points at `openziti` (see the trust-manager Application). A
 * Role applied into a namespace that does not exist is a sync failure at
 * wave -45, long before `oz` at wave 0 would have created it with
 * `CreateNamespace=true`. `ensureNamespace` in the mint is what makes the
 * ordering hold in the dev lane; `k8s/bootstrap/openziti-namespace.yaml` is
 * what makes it hold on metal.
 */
export const DEV_ZITI_ADMIN_SECRET: DevBootstrapSecretSpec = {
  namespace: "openziti",
  name: "ziti-admin-credentials",
  userKey: "admin-user",
  passwordKey: "admin-password",
  user: "admin",
  reason:
    "Minted per dev/CI cluster at bring-up so the ziti-controller chart's " +
    "useCustomAdminSecret/customAdminSecretName resolves.",
} as const;

/**
 * Every credential the dev/CI bring-up mints, in mint order.
 *
 * A LIST rather than two call sites, so that adding a third Application in this
 * class is one entry and cannot be half-wired: `use-cases.ts` loops this,
 * `argocd-health-test.ts` refuses an included run for any member that is absent
 * from the cluster, and `use-cases.test.ts` asserts the loop covers all of it.
 */
export const DEV_BOOTSTRAP_SECRETS: readonly DevBootstrapSecretSpec[] = [
  DEV_GRAFANA_ADMIN_SECRET,
  DEV_ZITI_ADMIN_SECRET,
] as const;

/**
 * A dev/CI admin Secret, as a manifest.
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
export function buildDevAdminSecretManifest(spec: DevBootstrapSecretSpec, password: string): string {
  const { namespace, name, userKey, passwordKey, user, reason } = spec;
  return [
    "apiVersion: v1",
    "kind: Secret",
    "metadata:",
    `  name: ${name}`,
    `  namespace: ${namespace}`,
    "  annotations:",
    '    zeta.io/dev-substrate-credential: "true"',
    "    zeta.io/dev-substrate-credential-reason: >-",
    `      ${reason}`,
    "      Never applied to the bare-metal cluster, never committed to git,",
    "      never reused across clusters.",
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
