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

/**
 * A registry credential a dev/CI cluster must hold before an Application whose
 * images live in a PRIVATE registry can pull them.
 *
 * WHY THIS IS A SEPARATE CLASS FROM `DevBootstrapSecretSpec` ABOVE, and not a
 * third entry on that roster. The admin credentials up there are DRAWN: entropy
 * enters at the mint, every cluster gets its own value, and the mint is
 * therefore UNCONDITIONAL -- it can always succeed. A registry credential is
 * SOURCED: it has to be a token some real registry will actually honour, so it
 * comes from the environment and the mint can legitimately find nothing. Those
 * are different failure modes and they want different code. Putting this on the
 * drawn roster would also have falsified that roster's own invariants, which
 * `use-cases.test.ts` asserts by name: "two fresh clusters get different
 * passwords" is FALSE of a sourced token (two clusters get the SAME one, which
 * is correct), and "mints.length === DEV_BOOTSTRAP_SECRETS.length" is false the
 * moment a mint may skip.
 *
 * MEASURED 2026-08-21 (recorded in the `platform` entry of
 * `DEV_EXCLUDED_REASONS`): an anonymous manifest GET against
 * `ghcr.io/v2/lucent-financial-group/zeta-platform-controller/manifests/latest`
 * returns HTTP 401, the same GET with a credential returns HTTP 200, and both
 * GHCR packages are `visibility: private`. Neither `controller.yaml` nor
 * `portal.yaml` declared `imagePullSecrets` -- nothing in `full-ai-cluster` did
 * -- so the kubelet pulled anonymously and took the 401 on EVERY substrate.
 */
export interface DevRegistryPullSecretSpec {
  readonly namespace: string;
  readonly name: string;
  /** Registry host the docker config entry is keyed by, e.g. `ghcr.io`. */
  readonly registry: string;
  /**
   * Environment variables consulted IN ORDER for the token, first non-empty
   * wins. A LIST because CI and a laptop have different names for the same
   * thing and neither should have to know about the other.
   */
  readonly tokenEnvVars: readonly string[];
  /** Environment variable for the username; GHCR ignores it for tokens, other registries do not. */
  readonly userEnvVar: string;
  /** Username when `userEnvVar` is unset. */
  readonly defaultUser: string;
  /** Why this object exists, written into the manifest so it is legible in-cluster. */
  readonly reason: string;
}

/**
 * The GHCR pull credential the `platform` Application's two images need.
 *
 * ONE constant, THREE consumers, for the same reason `DEV_GRAFANA_ADMIN_SECRET`
 * is one constant: `use-cases.ts` mints it, `argocd-health-test.ts` refuses a
 * run that would assert `platform` without it, and the pod specs in
 * `k8s/applications/platform/{controller,portal}.yaml` name it in
 * `imagePullSecrets`. The pod specs are the one consumer this file cannot
 * import, so `use-cases.test.ts` READS THEM and asserts the string matches --
 * a rename here that did not reach the YAML is the half-wiring that would
 * otherwise surface only as an ImagePullBackOff.
 *
 * `zeta-platform` IS THE NAMESPACE AND THAT IS NOT NEGOTIABLE: an
 * `imagePullSecrets` entry is a `LocalObjectReference`, resolved in the POD's
 * own namespace, so this Secret cannot live anywhere else and be found.
 */
export const DEV_GHCR_PULL_SECRET: DevRegistryPullSecretSpec = {
  namespace: "zeta-platform",
  name: "ghcr-pull",
  registry: "ghcr.io",
  tokenEnvVars: ["ZETA_GHCR_PULL_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"],
  userEnvVar: "ZETA_GHCR_PULL_USER",
  defaultUser: "zeta-ci",
  reason:
    "Minted per dev/CI cluster at bring-up so the private GHCR packages behind " +
    "the platform controller and portal images can be pulled.",
} as const;

/**
 * The token for a registry mint, resolved from an environment.
 *
 * PURE AND TOTAL -- takes the environment rather than reading `process.env`, so
 * every branch is testable without mutating the process, and returns `null`
 * rather than throwing because ABSENCE IS AN EXPECTED STATE. A contributor
 * bringing up a dev cluster to work on something unrelated to `platform` has no
 * reason to hold a GHCR token, and refusing their bring-up over it would be the
 * coercion this substrate is supposed to be free of.
 *
 * WHITESPACE-ONLY IS ABSENT, not present. A workflow that sets the variable
 * from a secret that does not exist yields the empty string, and treating that
 * as a token would mint a Secret containing nothing -- which is the WORST of
 * the three states, because it is indistinguishable in-cluster from a real
 * credential that lacks permission.
 */
export function resolveRegistryToken(
  spec: DevRegistryPullSecretSpec,
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  for (const name of spec.tokenEnvVars) {
    const value = env[name]?.trim() ?? "";
    if (value.length > 0) return value;
  }
  return null;
}

/**
 * A dev/CI registry pull Secret, as a manifest.
 *
 * PURE, and the token is a PARAMETER for the same reason the admin password is:
 * the shape is testable without a real credential, and the one place a real one
 * is read is the caller.
 *
 * `kubernetes.io/dockerconfigjson` with a `.dockerconfigjson` key is not a
 * choice -- it is the only Secret type the kubelet consults for image pulls, so
 * an `Opaque` Secret of the same name would be found, ignored, and produce the
 * ImagePullBackOff this exists to remove, with the Secret sitting right there
 * looking correct.
 *
 * `stringData` for the same reason as the admin mint: the API server does the
 * base64 of the outer object, so what is committed to the cluster is readable.
 * The `auth` field inside is base64 by the docker config format itself, which
 * is NOT encryption and is not treated as any -- the value dies with the
 * cluster and is printed nowhere.
 */
export function buildDevRegistryPullSecretManifest(
  spec: DevRegistryPullSecretSpec,
  username: string,
  token: string,
): string {
  const { namespace, name, registry, reason } = spec;
  const auth = Buffer.from(`${username}:${token}`, "utf8").toString("base64");
  const dockerConfig = JSON.stringify({
    auths: { [registry]: { username, password: token, auth } },
  });
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
    "type: kubernetes.io/dockerconfigjson",
    "stringData:",
    `  .dockerconfigjson: ${JSON.stringify(dockerConfig)}`,
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
