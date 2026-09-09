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
 * Repo-relative path of the kind-only Cilium LB-IPAM alias.
 *
 * THE APPLICATION stays excluded: `cilium-lb-ipam/ip-pool.yaml` pins
 * 192.168.1.240-250. Applying that Application on kind would assign IPs that
 * ArgoCD calls Healthy and that nothing can route, AND would selfHeal over
 * this alias. So bring-up applies THIS file, and the catalogue keeps the
 * Application glob-excluded.
 *
 * ONE constant, TWO consumers: `use-cases.ts` applies it; the bring-up tests
 * assert that kind `--cni cilium` is the only path that does.
 */
export const DEV_CILIUM_LB_KIND_MANIFEST_RELPATH = "full-ai-cluster/dev-cluster/manifests/cilium-lb-ipam.kind.yaml";

/**
 * Cilium CRDs the kind LB alias needs Established before apply.
 *
 * Helm `wait: true` waits for the agent/operator pods, not for these names.
 * Applying the pool before they exist is a NotFound that looks like "Cilium
 * does not do LoadBalancer" rather than "we raced the CRD install".
 */
export const DEV_CILIUM_LB_KIND_CRDS = [
  "ciliumloadbalancerippools.cilium.io",
  "ciliuml2announcementpolicies.cilium.io",
] as const;

/** Object name the kind alias declares. Bring-up and the harness both use this. */
export const DEV_CILIUM_LB_KIND_POOL_NAME = "zeta-lb-pool";

/** Absolute path of the kind Cilium LB-IPAM alias, for the bring-up use-case. */
export function devCiliumLbKindManifestPath(): string {
  return join(REPO_ROOT, DEV_CILIUM_LB_KIND_MANIFEST_RELPATH);
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
    "Minted per dev/CI cluster at bring-up so kube-prometheus-stack's " + "grafana.admin.existingSecret resolves.",
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
 * The Valkey ACL credential `redis` expects to ALREADY EXIST.
 *
 * SAME SHAPE AS GRAFANA AND ZITI: the Application sets
 * `auth.usersExistingSecret: redis-auth` and both ACL users (`default` and
 * `replicator`) read `passwordKey: password`. The chart does not mint that
 * Secret. MEASURED 2026-09-02 (k8s-argocd-health-test run 33657954802):
 * `live kind included` failed with `redis is OutOfSync/Progressing` -- the
 * exact ArgoCD report a missing `secretKeyRef` produces, and the reason the
 * included proof already refuses a missing grafana/ziti Secret in seconds
 * instead of burning 2400s.
 *
 * WHY NOT INLINE THE PASSWORD IN valuesObject. That would put a credential
 * in git so metal and CI share it. The Application already names an existing
 * Secret for metal (Sealed Secret / Vault). Dev/CI mint the same name here.
 * Orleans stays at replicas 0 because metal still has no secret in the tree.
 *
 * `username` is unused by the chart (ACL usernames live in values). It is
 * present so this object stays on the same DevBootstrapSecretSpec as the
 * other two rather than growing a password-only fork for one consumer.
 */
/** The ACL user the Valkey chart's `default` entry carries, and Orleans authenticates as. */
export const REDIS_AUTH_DEFAULT_USER = "default";
/** The key the Valkey chart reads (`aclUsers.default.passwordKey`) and Orleans projects. */
export const REDIS_AUTH_PASSWORD_KEY = "password";
/** Unused by the chart; kept so the Secret's shape matches the admin secrets. */
export const REDIS_AUTH_USER_KEY = "username";

/**
 * MOVED FROM `DEV_BOOTSTRAP_SECRETS` TO `DEV_SHARED_SECRETS` on 2026-09-09,
 * because it acquired a SECOND consumer and a Secret reference is
 * namespace-local (081M22P1265087G0R001VVYSWZ).
 *
 * The mint put `redis-auth` in namespace `redis`, where the Valkey chart reads
 * it as `auth.usersExistingSecret`. That was correct while Valkey was the only
 * consumer. Then `orleans/statefulset.yaml` began projecting the SAME name via
 * `secretKeyRef: { name: redis-auth, key: password, optional: true }` -- and a
 * `secretKeyRef` resolves in the POD's namespace, which is `orleans`. Nothing
 * ever minted it there.
 *
 * `optional: true` then converted the miss into silence: the env var was simply
 * unset, the silo connected with no password, and Valkey answered
 * `NOAUTH Returned - connection has not yet authenticated`. Measured in run
 * 34323056405 -- `orleans-silo-0` CrashLoopBackOff x10, the silo's own stack
 * trace naming `RedisClusteringOptions.DefaultCreateMultiplexer`. One absence
 * (Secret not in this namespace) wearing another absence's meaning (Redis has
 * no auth), which is the failure class this repo keeps finding.
 *
 * `applyDevSharedSecrets` draws ONCE and applies to every namespace, which is
 * exactly what a producer plus its consumers require: drawing per namespace
 * would mint two different values and leave the silo authenticating with a key
 * Valkey does not know. That mechanism already existed for the blob store; this
 * entry is not a new one, it is this credential moved to the list it belongs on.
 */
export const DEV_REDIS_AUTH_SECRET: DevSharedSecretSpec = {
  name: "redis-auth",
  // The producer (Valkey) and its consumer (the Orleans silo). Order is the
  // mint order and carries no other meaning.
  namespaces: ["redis", "orleans"],
  keys: (value) => ({
    [REDIS_AUTH_USER_KEY]: REDIS_AUTH_DEFAULT_USER,
    [REDIS_AUTH_PASSWORD_KEY]: value,
  }),
  reason:
    "Minted per dev/CI cluster at bring-up so the Valkey chart's auth.usersExistingSecret " +
    "resolves in namespace redis AND the Orleans silo's secretKeyRef resolves in namespace " +
    "orleans. Both must present the same value or the silo fails membership with NOAUTH.",
} as const;

/**
 * Every credential the dev/CI bring-up mints, in mint order.
 *
 * A LIST rather than N call sites, so that adding another Application in this
 * class is one entry and cannot be half-wired: `use-cases.ts` loops this,
 * `argocd-health-test.ts` refuses an included run for any member that is absent
 * from the cluster, and `use-cases.test.ts` asserts the loop covers all of it.
 */
/**
 * The OpenSearch initial admin credential, WITHOUT WHICH THE CONTAINER REFUSES
 * TO BOOT.
 *
 * OpenSearch ships `securityConfig.enabled: true` and `protocol: https`, and
 * since 2.12 the image will not start unless `OPENSEARCH_INITIAL_ADMIN_PASSWORD`
 * is set to a strong value. The chart's own `values.yaml` leaves that key
 * COMMENTED OUT, so a chart taken at its defaults cannot come up -- which is
 * precisely what our live lane reported as `OutOfSync/Progressing` on run
 * 33936923932. Upstream's three `ci/*-values.yaml` all set it; that is how the
 * cause was found.
 *
 * MINTED, NEVER COMMITTED, AND THIS IS THE POINT. Aaron 2026-09-05: "passwords
 * can be auto generated on cluster started never stored and then just the same
 * secrets can be injected to the pod that need them". `applyDevBootstrapSecrets`
 * generates `randomBytes(24).toString("base64url")` per cluster at bring-up. The
 * value is never logged, never written to the tree, and dies with the cluster.
 *
 * IT REPLACES A WEAKER FIX. The first pass turned the security plugin OFF at the
 * dev rung to avoid needing a password at all. That worked and tested less: dev
 * then exercised a configuration metal never runs. Minting the credential lets
 * dev run the SAME posture as metal, which is the whole argument for having a
 * dev rung rather than a dev fork.
 *
 * ON METAL, the value is reachable exactly as Aaron described -- `kubectl get
 * secret` into the cluster, or ssh to a node -- because it exists only in the
 * cluster's own store and nowhere else.
 */
export const DEV_OPENSEARCH_ADMIN_SECRET: DevBootstrapSecretSpec = {
  namespace: "opensearch",
  name: "opensearch-admin-credentials",
  userKey: "admin-user",
  passwordKey: "admin-password",
  user: "admin",
  reason:
    "Minted per dev/CI cluster at bring-up because OpenSearch >= 2.12 refuses to start without " +
    "OPENSEARCH_INITIAL_ADMIN_PASSWORD while the security plugin is on.",
} as const;

/**
 * The Forgejo initial-admin credential the chart expects to ALREADY EXIST.
 *
 * WHY IT ARRIVES NOW. `forgejo/Application.yaml` sets
 * `gitea.admin.existingSecret: forgejo-initial-admin`, and until 2026-09-06 nothing
 * minted it -- acknowledged in `existing-secret-is-minted.baseline.json` with a
 * STRUCTURAL reason: forgejo was the standby half of an either/or Git-host pair and
 * shipped manual-sync, so no pod ever looked for the Secret. That entry named its own
 * lift condition exactly: "forgejo is synced in any lane ... At that moment a pod
 * really does need this credential, and the honest fix is to add it to
 * DEV_BOOTSTRAP_SECRETS rather than to re-acknowledge it." Aaron 2026-09-05, retiring
 * the standby posture: "gitlab and forgejo we will be testing both over time so we
 * want both up, neither is standby." So the condition is met and this is the fix it
 * asked for, rather than a fresh acknowledgement.
 *
 * THE KEY NAMES ARE MEASURED, NOT GUESSED. `helm template` at the pinned chart 17.1.5
 * renders the init container reading `secretKeyRef.key: username` and
 * `secretKeyRef.key: password` from this Secret -- so a rename on either side breaks
 * the pod rather than being absorbed. `gitea_admin` is the chart's own default
 * username (`gitea.admin.username` in its values.yaml), kept rather than invented
 * because Forgejo reserves some names and the default is known to be accepted.
 *
 * MINTED, NEVER COMMITTED, exactly as the four above: `applyDevBootstrapSecrets`
 * draws `randomBytes(24).toString("base64url")` per cluster at bring-up, logs
 * nothing, writes nothing to the tree, and the value dies with the cluster.
 */
export const DEV_FORGEJO_ADMIN_SECRET: DevBootstrapSecretSpec = {
  namespace: "forgejo",
  name: "forgejo-initial-admin",
  userKey: "username",
  passwordKey: "password",
  user: "gitea_admin",
  reason:
    "Minted per dev/CI cluster at bring-up because the Forgejo chart's init container reads " +
    "GITEA_ADMIN_USERNAME/GITEA_ADMIN_PASSWORD from gitea.admin.existingSecret and will not " +
    "provision the admin account without it.",
} as const;

/**
 * ONE DRAWN VALUE, LANDED IN SEVERAL NAMESPACES, IN THE SHAPE EACH CONSUMER READS.
 *
 * -- WHY THIS EXISTS AND WHY IT IS NOT A `DevBootstrapSecretSpec` -----------
 * Every spec above is one credential for one consumer, so `applyDevBootstrapSecrets` draws
 * fresh entropy PER SPEC. That is correct for them and WRONG for a shared credential: the
 * blob store's S3 secret key is presented by a producer (seaweedfs) and three consumers
 * (loki, mimir x3) that must all agree on the SAME string. Adding three
 * `DevBootstrapSecretSpec` entries would mint three different values and leave two services
 * authenticating with a key the store does not know.
 *
 * So this is a second, narrow shape rather than a widened first one: `namespaces` is a list,
 * the value is drawn ONCE by the caller, and `keys` says how each namespace's Secret is
 * spelled -- because the consumers do not agree on that either. seaweedfs's chart wants
 * `existingConfigSecret` pointing at a Secret whose `seaweedfs_s3_config` key holds an INLINE
 * JSON identities document; loki and mimir want a plain env var they can expand with
 * `-config.expand-env=true`.
 *
 * `keys` is a FUNCTION of the drawn value rather than a template, so the JSON is built in
 * TypeScript and cannot drift from the string it embeds.
 *
 * 081M1S6Z5S3087G0R000GEPSS2. The value is `randomBytes(24).toString("base64url")` per
 * cluster, logged nowhere, written nowhere, and dies with the cluster -- exactly the pattern
 * Aaron named: "passwords can be auto generated on cluster started never stored and then just
 * the same secrets can be injected to the pod that need them".
 */
export interface DevSharedSecretSpec {
  readonly name: string;
  readonly namespaces: readonly string[];
  /** Given the one drawn value, the `stringData` each namespace's Secret carries. */
  readonly keys: (value: string) => Readonly<Record<string, string>>;
  readonly reason: string;
}

/** The S3 access-key ID. NOT a secret -- an identifier, committed on purpose. */
export const BLOB_STORE_ACCESS_KEY = "zeta-blob-store";

/** The env var loki and mimir expand into their `secret_access_key` fields. */
export const BLOB_STORE_ENV_KEY = "BLOB_STORE_SECRET_KEY";

/** The key the seaweedfs chart reads out of `s3.existingConfigSecret`. */
export const SEAWEEDFS_S3_CONFIG_KEY = "seaweedfs_s3_config";

/**
 * The identities document seaweedfs's S3 gateway authenticates against.
 *
 * ONE IDENTITY, not the chart's default two. The chart's own template also mints an
 * `anvReadOnly` pair with `randAlphaNum` on every render; nothing in this tree consumes it,
 * and `existingConfigSecret` replaces the generated document entirely, so it does not come
 * along. Fewer identities is the correct outcome, not a regression.
 */
export function seaweedfsS3Config(secretKey: string): string {
  return JSON.stringify({
    identities: [
      {
        name: "anvAdmin",
        credentials: [{ accessKey: BLOB_STORE_ACCESS_KEY, secretKey }],
        actions: ["Admin", "Read", "Write"],
      },
    ],
  });
}

export const DEV_BLOB_STORE_SECRET: DevSharedSecretSpec = {
  name: "zeta-blob-store",
  // The producer and every consumer. `applyDevSharedSecrets` draws once and applies to all
  // three, which is the entire reason this shape exists.
  namespaces: ["object-store", "loki", "mimir"],
  keys: (value) => ({
    [SEAWEEDFS_S3_CONFIG_KEY]: seaweedfsS3Config(value),
    [BLOB_STORE_ENV_KEY]: value,
  }),
  reason:
    "Minted per dev/CI cluster at bring-up. seaweedfs authenticates its S3 gateway against " +
    "seaweedfs_s3_config; loki and mimir expand BLOB_STORE_SECRET_KEY into their " +
    "secret_access_key with -config.expand-env=true. All four must agree on one value.",
} as const;

export const DEV_HINDSIGHT_LLM_SECRET: DevSharedSecretSpec = {
  name: "hindsight-llm-api-key",
  namespaces: ["hindsight"],
  // `envFrom: [secretRef]` makes the Secret's KEY NAMES the env var names, so this
  // key must be spelled exactly as the app reads it. MEASURED against chart 0.9.2:
  // templates/api-deployment.yaml:42-45 and worker-statefulset.yaml:42-45 both
  // render `envFrom` under `.Values.existingSecret`.
  keys: (value) => ({ HINDSIGHT_API_LLM_API_KEY: value }),
  reason:
    "Minted per dev/CI cluster so hindsight's api and worker containers START. THE VALUE IS A " +
    "PLACEHOLDER, NOT A WORKING GROQ KEY: the app's boot check is presence-only " +
    "(ValueError: LLM API key is required), so a drawn value clears the crash loop and NO " +
    "LLM CALL WILL SUCCEED. Healthy here therefore means the process runs, never that the " +
    "extraction path works -- CI must not be read as covering it. On metal the same Secret " +
    "NAME is supplied by ESO from a real key (Aaron 2026-09-07: ESO on metal plus a minted " +
    "dev Secret), so the Application names one Secret and only the provenance differs.",
} as const;

export const DEV_SHARED_SECRETS: readonly DevSharedSecretSpec[] = [
  DEV_BLOB_STORE_SECRET,
  DEV_HINDSIGHT_LLM_SECRET,
  DEV_REDIS_AUTH_SECRET,
] as const;

/**
 * A shared Secret, as a manifest, for ONE namespace.
 *
 * PURE and the value is a PARAMETER, exactly like `buildDevAdminSecretManifest` -- so the
 * shape is testable without entropy, and the one place entropy enters is the caller.
 * `stringData` rather than `data` for the same reason as above: the API server does the
 * base64, so nothing here is an encoded blob a reader must decode before auditing it.
 */
export function buildDevSharedSecretManifest(
  spec: DevSharedSecretSpec,
  namespace: string,
  value: string,
): string {
  const entries = Object.entries(spec.keys(value));
  return [
    "apiVersion: v1",
    "kind: Secret",
    "metadata:",
    `  name: ${spec.name}`,
    `  namespace: ${namespace}`,
    "  annotations:",
    `    zeta.io/dev-only: "true"`,
    `    zeta.io/minted-reason: ${JSON.stringify(spec.reason)}`,
    "type: Opaque",
    "stringData:",
    ...entries.map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`),
    "",
  ].join("\n");
}

export const DEV_BOOTSTRAP_SECRETS: readonly DevBootstrapSecretSpec[] = [
  DEV_GRAFANA_ADMIN_SECRET,
  DEV_ZITI_ADMIN_SECRET,
  DEV_OPENSEARCH_ADMIN_SECRET,
  DEV_FORGEJO_ADMIN_SECRET,
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

const GITHUB_REPO_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/;

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

/**
 * The ONE repository URL that is not on GitHub and is still allowed.
 *
 * `assertGitHubRepoUrl` refuses anything that is not `https://github.com/<o>/<r>`,
 * and that refusal is load-bearing: ArgoCD clones what it is handed, so a lane
 * that could be pointed anywhere is a lane that could be pointed at anything.
 * Serving the rung-applied tree in-cluster needs exactly one exception, so it
 * gets exactly one -- a literal, not a relaxation of the predicate.
 *
 * Matching the literal rather than a pattern like "any http:// on .svc.cluster.local"
 * is the point. A pattern would accept every in-cluster service, including one an
 * Application could stand up; a literal accepts the address this repository's own
 * code generates and nothing else. `lane-tree-source.ts` builds the same string
 * from the same constants, and a test pins that the two agree -- so this cannot
 * drift into accepting a URL nothing produces, which would be an exception with no
 * subject.
 */
export const LANE_TREE_REPO_URL = "http://zeta-lane-tree.zeta-lane-tree.svc.cluster.local:8080/tree.git";

export function isLaneTreeRepoUrl(value: string): boolean {
  return value === LANE_TREE_REPO_URL;
}

export function assertLaneTreeRepoUrl(value: string): void {
  if (!isLaneTreeRepoUrl(value)) {
    fail(`ERROR: lane tree repo URL must be exactly '${LANE_TREE_REPO_URL}' (got: '${value}')`);
  }
}

export const DEFAULT_GIT_REPO_URL =
  process.env.ZETA_ARGOCD_GIT_REPO_URL ?? "https://github.com/Lucent-Financial-Group/Zeta";
