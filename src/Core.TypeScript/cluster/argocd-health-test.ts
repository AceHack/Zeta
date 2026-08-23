#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/argocd-health-test.ts
 *
 * 081KSXN940008QG0R000SCP2H1 - Kubernetes + ArgoCD health integration harness.
 *
 * This is the cluster-health lane carved away from the 081KSNY2Z0008QG0R0008PN7RQ USB/ISO
 * zflash harness. It proves a real local Kubernetes cluster can reconcile
 * the Zeta GitOps substrate to ArgoCD Application health, while zflash keeps
 * owning boot/reformat/key-retention semantics.
 *
 * Usage:
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --dry-run
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --preflight
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --run --provider kind --git-ref main
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --run --provider k3d --git-ref main
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --run --existing --cluster-name zeta-dev
 *
 * Exit codes:
 *   0 - dry-run/preflight/run succeeded
 *   1 - health check failed after a cluster was reachable
 *   2 - usage error or named dependency/preflight failure
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { bootstrapKindClusterInProcess, bootstrapK3dClusterInProcess } from "./harness/bootstrap.ts";
import {
  DEV_BOOTSTRAP_SECRETS,
  DEV_GHCR_PULL_SECRET,
  DEV_LONGHORN_ALIAS_CLASS_NAME,
  DEV_SATISFIABLE_PROVISIONERS,
  DEV_STORAGE_ALIAS_MANIFEST_RELPATHS,
  type DevBootstrapSecretSpec,
} from "./dev-cluster/lib.ts";
import { DEFAULT_ROOT_DEV_CATALOG } from "./ports.ts";
// Ordinal (code-point) ordering, per .claude/rules/culture-invariant-by-default.md.
// NOT localeCompare: it is culture-SENSITIVE, so the same directory names sort
// differently per machine locale. That matters here because this ordering is not
// display -- it is the canonical order of the Application roster every caller of
// discoverExpectedApplications() iterates, so a locale-dependent order is a
// locale-dependent roster. `stringCompare` also walks code points rather than
// UTF-16 code units, so astral characters order the way the other oracles order them.
import { stringCompare } from "../collation/collation.ts";
import { classifySyncPolicy, manualSyncAssertion, type AssertionOutcome } from "./manual-sync-policy.ts";
import {
  ephemeralVaultInitGate,
  kubectlVaultExec,
  runEphemeralVaultInit,
  type EphemeralVaultInitReport,
} from "./ephemeral-vault-init.ts";

export type Provider = "k3d" | "kind";
export type Mode = "dry-run" | "preflight" | "run";
export type Scope = "smoke" | "included" | "full";
export type ContainerRuntime = "docker" | "podman";

export type FailureKind =
  | "UsageError"
  | "ApplicationManifestInvalid"
  | "UnsupportedArchitecture"
  | "UnsupportedProvider"
  | "MissingTool"
  | "ContainerRuntimeUnavailable"
  | "ClusterBootstrapFailed"
  | "DevStorageClassMissing"
  | "DevBootstrapSecretMissing"
  | "DevRegistryPullSecretMissing"
  | "KubectlFailed"
  | "ArgoCdTimeout"
  | "ApplicationMissing"
  | "ApplicationUnhealthy"
  | "EphemeralVaultInitFailed"
  | "DriftRepairTimeout";

export interface Failure {
  readonly kind: FailureKind;
  readonly message: string;
  readonly command?: readonly string[];
  readonly detail?: unknown;
}

export interface CliOptions {
  readonly mode: Mode;
  readonly provider: Provider;
  readonly gitRef: string;
  readonly clusterName: string | null;
  readonly configPath: string;
  readonly existing: boolean;
  readonly timeoutSeconds: number;
  readonly pollSeconds: number;
  readonly driftCheck: boolean;
  readonly scope: Scope;
  readonly scopeExplicit: boolean;
  readonly runtime: ContainerRuntime;
  /**
   * Run the ephemeral Vault init+unseal ceremony against the cluster THIS
   * process created (`./ephemeral-vault-init.ts`). Opt-in only: never defaulted
   * on, and refused outright with `--existing`.
   */
  readonly ephemeralVaultInit: boolean;
}

export interface ToolCheck {
  readonly tool: "docker" | "podman" | "kubectl" | "helm" | Provider;
  readonly ok: boolean;
  readonly detail: string;
}

export interface ExpectedApplication {
  readonly dir: string;
  readonly name: string;
  readonly excludedFromDev: boolean;
  /**
   * Declared `zeta.io/sync-policy: manual` + a non-empty reason, with no
   * `automated:` block (see `./manual-sync-policy.ts`). Such an Application is
   * asserted DIFFERENTLY, never skipped: it must still exist and ArgoCD must
   * still have compared it, but it is not required to have auto-synced -- in a
   * lane where nothing ever syncs it, that requirement was unsatisfiable.
   *
   * Fail-closed: a malformed declaration is NOT manual here, so it keeps the
   * full Synced+Healthy assertion.
   */
  readonly manualSync: boolean;
  readonly path: string;
}

export interface ArgoApplicationSnapshot {
  readonly name: string;
  readonly syncStatus: string;
  readonly healthStatus: string;
  readonly message: string;
  readonly operationPhase?: string;
  readonly syncRevision?: string;
}

export interface ApplicationVerdict {
  readonly name: string;
  readonly ok: boolean;
  readonly syncStatus: string;
  readonly healthStatus: string;
  readonly reason?: string;
}

export interface HarnessPlan {
  readonly rowId: "081KSXN940008QG0R000SCP2H1";
  readonly mode: Mode;
  readonly provider: Provider;
  readonly clusterName: string;
  readonly gitRef: string;
  readonly configPath: string;
  readonly scope: Scope;
  readonly runtime: ContainerRuntime;
  readonly expectedApplications: readonly ExpectedApplication[];
  readonly checks: readonly string[];
  readonly notes: readonly string[];
}

export type HarnessResult =
  | {
      readonly ok: true;
      readonly plan: HarnessPlan;
      readonly preflight?: readonly ToolCheck[];
      readonly applications?: readonly ApplicationVerdict[];
      readonly ephemeralVaultInit?: EphemeralVaultInitReport;
      readonly driftRepair?: "not-requested" | "passed";
    }
  | {
      readonly ok: false;
      readonly plan?: HarnessPlan;
      readonly preflight?: readonly ToolCheck[];
      readonly applications?: readonly ApplicationVerdict[];
      readonly ephemeralVaultInit?: EphemeralVaultInitReport;
      readonly driftRepair?: "not-requested" | "failed";
      readonly failure: Failure;
    };

interface MutableCliOptions {
  mode: Mode;
  provider: Provider;
  gitRef: string;
  clusterName: string | null;
  configPath: string;
  configExplicit: boolean;
  existing: boolean;
  timeoutSeconds: number;
  pollSeconds: number;
  driftCheck: boolean;
  scope: Scope;
  scopeExplicit: boolean;
  runtime: ContainerRuntime;
  ephemeralVaultInit: boolean;
}

interface ParseNumberSuccess {
  readonly ok: true;
  readonly value: number;
}

interface ParseStringSuccess {
  readonly ok: true;
  readonly value: string;
}

interface ParseFailure {
  readonly ok: false;
  readonly failure: Failure;
}

interface ParseArgSuccess {
  readonly ok: true;
  readonly nextIndex: number;
}

interface ParseRuntimeEnvSuccess {
  readonly ok: true;
  readonly value: ContainerRuntime | null;
}

interface ParseOptionsSuccess {
  readonly ok: true;
  readonly value: MutableCliOptions;
}

type ParseNumberResult = ParseNumberSuccess | ParseFailure;
type ParseStringResult = ParseStringSuccess | ParseFailure;
type ParseArgResult = ParseArgSuccess | ParseFailure;
type ParseRuntimeEnvResult = ParseRuntimeEnvSuccess | ParseFailure;
type ParseOptionsResult = ParseOptionsSuccess | ParseFailure;

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const DEFAULT_K3D_CONFIG = "full-ai-cluster/dev-cluster/k3d-config.yaml";
const DEFAULT_KIND_CONFIG = "full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml";
const DEFAULT_TIMEOUT_SECONDS = 900;
const DEFAULT_POLL_SECONDS = 10;
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const HELP_TEXT =
  "usage: bun src/Core.TypeScript/cluster/argocd-health-test.ts [--dry-run|--preflight|--run] [--provider k3d|kind] [--scope smoke|included|full] [--runtime docker|podman] [--git-ref REF] [--cluster-name NAME] [--config PATH] [--existing] [--timeout-sec N] [--poll-sec N] [--drift-check] [--ephemeral-vault-init]";
const MODE_FLAGS: Readonly<Record<string, Mode>> = {
  "--dry-run": "dry-run",
  "--preflight": "preflight",
  "--run": "run",
};
const STRING_FLAGS = new Set(["--git-ref", "--cluster-name", "--config"]);
const INTEGER_FLAGS = new Set(["--timeout-sec", "--poll-sec"]);
const K3D_CLUSTER_NAME_PATTERN = /^\s+name:\s*([A-Za-z\d-]+)\s*$/;
const DNS_LABEL_PATTERN = /^[a-z\d]([-a-z\d]*[a-z\d])?$/;
const SMOKE_MIN_APPLICATIONS = 20;

/**
 * Applications the dev/CI lane neither applies nor asserts, WITH THE REASON
 * AND THE CONDITION THAT LIFTS EACH ONE.
 *
 * This was a bare `Set` of seven directory names until 2026-08-21 -- membership
 * with no recorded why, so no reader could tell a deliberate deferral from an
 * accident, and no check could tell whether a deferral had outlived its cause.
 * That is the same defect `APPLIED_BUT_UNASSERTED_REASONS` below was built to
 * fix for the OTHER exclusion list, and the reason it was built is written
 * there: an implicit deferral grows silently. It grew to 14 directories once
 * already before anyone measured it.
 *
 * Every value must contain a `LIFTS WHEN:` clause naming a condition someone
 * could actually bring about. "It does not work yet" is not a condition; it is
 * the observation that produced the entry.
 *
 * These directories are ALSO named in `DEFAULT_ROOT_DEV_CATALOG.excludeGlob`
 * (ports.ts), so they never reach the cluster either -- excluded on both sides,
 * which is why they are not part of the applied-but-unasserted shadow.
 *
 * 2026-08-21: `deepseek-coder` and `qwen-coder` LEFT this set (081M0JXXFV0087G0R001PGEEM4).
 * They were listed under a blanket "GPU model-serving" label, but neither
 * declares a GPU, an image, a pod or a volume -- between them they render one
 * Namespace and two ConfigMaps. The GPU is a property of `ollama`/`vllm`, which
 * SERVE those models; it was never a property of the two structural
 * Applications that describe them. They are asserted under the full contract now.
 */
/**
 * The `platform` Application's directory, as ONE constant.
 *
 * Three surfaces need this exact string and they must not drift: its deferral
 * reason in `DEV_EXCLUDED_REASONS` below, and the glob gate in
 * `assertDevRegistryPullSecretPresent`, which asserts nothing while this
 * directory is excluded and starts biting the moment it is not. A retyped
 * literal in the gate would keep the check inert after the deferral lifted --
 * silently, since an inert check and a passing one look identical.
 */
export const PLATFORM_APP_DIR = "platform";

export const DEV_EXCLUDED_REASONS: ReadonlyMap<string, string> = new Map([
  [
    "agent-memory",
    "HELD BY THE GLOB, NOT BY A MEASUREMENT -- and that distinction is the honest part of this entry. It " +
      "went into `excludeGlob` because statefulset.yaml:71-83 asks RWO/8Gi on `storageClassName: longhorn`, " +
      "and at the time nothing in the dev lane answered to that name. `dev-cluster/manifests/longhorn.yaml` " +
      "now does, and RWO/8Gi is exactly what `rancher.io/local-path` behind that alias serves -- the same " +
      "condition that un-deferred ten other Applications on 2026-08-21. So the recorded blocker is very " +
      "likely spent, and NOBODY HAS MEASURED IT, because the glob keeps this Application off every CI " +
      "cluster and an app that never syncs never produces a verdict to read. " +
      "LIFTS WHEN: `agent-memory/**` is dropped from `DEFAULT_ROOT_DEV_CATALOG.excludeGlob` and one included " +
      "run reports its actual verdict -- pass or fail, either is information; the current state is neither. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: path statefulset.yaml:83] " +
      "[cite: path full-ai-cluster/dev-cluster/manifests/longhorn.yaml] " +
      "[cite: pvc-class full-ai-cluster/agent-memory longhorn] " +
      "[cite: pvc-total full-ai-cluster/agent-memory 8] " +
      "[cite: glob-defers agent-memory] ",
  ],
  [
    "cilium",
    "The CNI itself. The default kind profile brings up kind's own CNI (kindnetd) BEFORE ArgoCD exists -- " +
      "nothing can schedule otherwise -- so applying this Application there would install a second CNI over a " +
      "working one. Meanwhile the configuration is not untested: the `live kind Cilium CNI` job installs it " +
      "from THIS Application's own valuesObject on a profile with no default CNI " +
      "(full-ai-cluster/dev-cluster/profiles/ci.cilium.kind-config.yaml). " +
      "LIFTS WHEN: the app-of-apps included proof runs on that profile, so ArgoCD is reconciling a cluster " +
      "whose CNI slot Cilium already owns. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: path full-ai-cluster/dev-cluster/profiles/ci.cilium.kind-config.yaml] " +
      '[cite: workflow-job k8s-argocd-health-test.yml "live kind Cilium CNI"] ' +
      "[cite: glob-defers cilium] ",
  ],
  [
    "cilium-lb-ipam",
    "CiliumLoadBalancerIPPool + CiliumL2AnnouncementPolicy are Cilium CRDs, so this Application cannot sync " +
      "at all until Cilium is the CNI. Its pool is also hard-coded to 192.168.1.240-250, a LAN range with no " +
      "meaning inside a container network -- LB IPs would be ASSIGNED (enough for ArgoCD to call it Healthy) " +
      "and routable from nothing, which is a worse outcome than not running it. " +
      "LIFTS WHEN: `cilium` above lifts AND the pool is parameterised per substrate rather than pinned to one " +
      "maintainer's subnet. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: glob-defers cilium-lb-ipam] " +
      "[cite: glob-defers cilium] ",
  ],
  [
    "gitlab",
    "HALF OF THIS REASON WAS SPENT ON 2026-08-22 AND THE SENTENCE OUTLIVED IT -- caught by " +
      "`reason-truth.ts`, in the change that added it, on the tree it was written against. " +
      "WHAT IT SAID: `IT DOES NOT EVEN RENDER` -- `helm template` of charts.gitlab.io/gitlab 8.7.0 against this " +
      "Application's own valuesObject failing on `You must provide an email to associate with your TLS " +
      "certificates`, carried as an acknowledged `helm-template-failed` row in the rendered-storage-claims " +
      "baseline. WHAT HAPPENED: #13471 put `global.ingress.configureCertmanager: false` into this manifest, the " +
      "chart rendered, and that acknowledgement was DELETED from the baseline. The reason kept citing it. This " +
      "is the third instance of one defect in two days -- `platform` (#13472), `temporal` (#13483), and now " +
      "this -- and it is the instance that a check found rather than a person. " +
      "WHAT IS MEASURED NOW: it renders, and what it renders is 76 GiB of PersistentVolumeClaims across four " +
      "workloads -- gitaly 50Gi, minio 10Gi, postgresql 8Gi, redis 8Gi -- every one of them declaring NO " +
      "storageClassName, so all four land on the cluster default (`zeta-local-path`: the node's own disk) and " +
      "none of them is on a replicated class at all. " +
      "THE BLOCKER THAT REMAINS, and it is one blocker rather than the two claimed. NO SOURCE FOR THE " +
      "ROOT-PASSWORD SECRET: the manifest reads `initialRootPassword.secret: gitlab-initial-root-password`, and " +
      "nothing in this tree creates that Secret -- outside the two Application manifests that consume it, its " +
      "only occurrence is an instruction to a human at infra/README.md:165. Without it the webservice never " +
      "reaches Ready, and ArgoCD reports Progressing until the timeout. " +
      "CAPACITY IS CARRIED OVER, NOT MEASURED, and that is said rather than implied: 76 GiB of node-local " +
      "claims plus GitLab's multi-GB images on one kind node is the earlier reason's estimate, and no run in " +
      "this lane has ever produced a verdict for this Application to check it against. It is a prediction. " +
      "LIFTS WHEN: `gitlab-initial-root-password` has a source in the tree -- a SealedSecret or an " +
      "ExternalSecret, the same shape the other credentialled apps use -- AND one included run reports this " +
      "Application's actual verdict, which is also what would settle the capacity prediction either way. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that " +
      "outlives its artifact goes red instead of reading on. " +
      "[cite: no-unrenderable full-ai-cluster/gitlab] " +
      "[cite: renders full-ai-cluster/gitlab] " +
      "[cite: pvc-total full-ai-cluster/gitlab 76] " +
      "[cite: chart-pin full-ai-cluster/gitlab gitlab 8.7.0] " +
      "[cite: published gitlab 8.7.0] " +
      "[cite: path infra/README.md:165] " +
      "[cite: glob-defers gitlab] ",
  ],
  [
    "longhorn",
    "Replicated block storage wants real disks and more than one node; a single kind node inside a runner has " +
      "neither -- it needs real block devices plus open-iscsi on the node. This entry is also the ROOT of the " +
      "largest deferral group in this file: every " +
      "APPLIED_BUT_UNASSERTED_REASONS row reading 'requests storageClass: longhorn' is downstream of it, so " +
      "lifting this one collapses several. " +
      "LIFTS WHEN: a dev StorageClass provides the `longhorn` name in this lane, or the Applications that " +
      "request it are parameterised to the substrate's default class. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: path full-ai-cluster/dev-cluster/manifests/longhorn.yaml] " +
      "[cite: chart-pin full-ai-cluster/longhorn longhorn 1.7.2] " +
      "[cite: glob-defers longhorn] ",
  ],
  [
    "ollama",
    "Requests nvidia.com/gpu with nodeSelector zeta.io/gpu, and a 200Gi longhorn PVC. A GitHub-hosted runner " +
      "has neither, and the multi-GiB image pull alone outruns the job timeout -- so the Application would " +
      "HANG rather than fail, which is the worse of the two. " +
      "LIFTS WHEN: the lane runs on a GPU-bearing self-hosted runner (arc-runner-set), or this Application " +
      "grows a CPU-only dev profile with a small model and a substrate-default StorageClass. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: pvc-class full-ai-cluster/ollama longhorn] " +
      "[cite: pvc-total full-ai-cluster/ollama 200] " +
      "[cite: glob-defers ollama] ",
  ],
  [
    PLATFORM_APP_DIR,
    "ITS TWO IMAGES ARE REAL AND FRESHLY PUBLISHED; WHAT IT LACKS IS A CREDENTIAL. The reason this " +
      "Application carried until 2026-08-21 said it `runs two images no registry serves`, and that was " +
      "FALSE in the way that matters -- it pointed at building an image that already exists. Measured: " +
      "`full-ai-cluster/platform-controller/` is 20 committed files including six test files and a " +
      "Dockerfile; `.github/workflows/build-platform-images.yml` builds BOTH images on every push to main " +
      "touching those paths, pushes `:latest` + `:sha-<12>` to GHCR and cosign-signs by digest; its last " +
      "push-to-main run (32454324648) was green at 2026-08-21T06:25:22Z, and both GHCR packages carry 36 " +
      "versions updated at 06:25:5x the same morning. " +
      "THE ACTUAL BLOCKER: both packages are `visibility: private`, and neither controller.yaml nor " +
      "portal.yaml declares `imagePullSecrets` -- there is no `imagePullSecrets` on any pod spec in " +
      "full-ai-cluster at all. An anonymous manifest GET against " +
      "ghcr.io/v2/lucent-financial-group/zeta-platform-controller/manifests/latest returns HTTP 401; the " +
      "same GET with a credential returns HTTP 200 and digest " +
      "sha256:a4f3a81511b5eaec5c67761adb5f23121dfec472956bb3e37f2f18ce7c5fafaf. So the registry serves them " +
      "to a principal that can log in, and the kubelet is not one -- the pods take ImagePullBackOff on " +
      "EVERY substrate, CI and metal alike. This is not a dev-lane gap; it is why the metal cluster's " +
      "platform control plane has never started either. " +
      "SEPARATELY AND ALREADY KNOWN: both manifests pin `:latest`, so two syncs of one commit can land " +
      "different bytes -- recorded as a follow-up at `full-ai-cluster/portal/DEPLOY.md:122` " +
      "(`Digest-pin the manifests + have CI bump them, instead of :latest + Always`). Not fixed here " +
      "because pinning replaces the documented `push -> rebuild -> rollout restart` delivery model with one " +
      "that needs a manifest commit per build, and that is a maintainer's trade, not a lint's. " +
      "THE CREDENTIAL HALF IS NOW BUILT, AND THE DEFERRAL STILL STANDS -- deliberately. Both pod specs " +
      "declare `imagePullSecrets: [ghcr-pull]`; `applyDevRegistryPullSecret` mints that Secret into " +
      "`zeta-platform` at dev/CI bring-up from a token in the environment; the health-test job now grants " +
      "`packages: read` and maps `github.token` into `ZETA_GHCR_PULL_TOKEN`; and " +
      "`assertDevRegistryPullSecretPresent` refuses an included run whose cluster lacks the Secret -- gated " +
      "on this directory leaving the exclude glob, so it arms itself on the same edit that lifts this entry " +
      "rather than needing a second one. " +
      "WHAT IS STILL UNMEASURED, AND IS WHY THIS IS NOT LIFTED HERE. The linkage that governs whether a " +
      "repo-scoped `GITHUB_TOKEN` may read these packages IS measured and it is favourable: `gh api " +
      "/orgs/Lucent-Financial-Group/packages/container/zeta-{platform-controller,portal}` reports both as " +
      "`visibility: private` with `repository.full_name = Lucent-Financial-Group/Zeta` (2026-08-22, and the " +
      "anonymous 401 reproduced the same day). What has NOT happened is a pull: no job has presented that " +
      "token to GHCR and been served a layer, and an API field reporting a grant is not the registry " +
      "honouring it. Lifting on the strength of the wiring would be asserting a pull nobody has performed " +
      "-- the same round-up this entry was rewritten on 2026-08-21 to remove. " +
      "LIFTS WHEN: a run measures the pull succeeding -- `platform/**` is dropped from " +
      "`DEFAULT_ROOT_DEV_CATALOG.excludeGlob` and the Application reaches Healthy. Note the gate this lane " +
      "actually applies accepts `sync=Unknown health=Healthy` (`Unknown` is a ComparisonError on the diff, " +
      "not a sync failure), so `Healthy` is the condition, NOT `Synced+Healthy` -- a LIFTS WHEN stricter " +
      "than its gate is how a deferral outlives its cause. If the token is refused, the exit is a " +
      "package-level grant to this repository, a PAT in `ZETA_GHCR_PULL_TOKEN`, or making the packages " +
      "public -- the last being a disclosure decision that is the maintainer's alone. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: path full-ai-cluster/portal/DEPLOY.md:122] " +
      "[cite: path .github/workflows/build-platform-images.yml] " +
      "[cite: glob-defers platform] ",
  ],
  [
    "temporal",
    "CORRECTED WITHIN THE HOUR, BY ITS OWN AUTHOR (#13472 -> this). The reason written into #13472 said " +
      "temporal's chart HAS NO PERSISTENCE STORE CONFIGURED and does not render. That was true when it was " +
      "measured and FALSE when it merged: #13469 landed between the two, wired the datastore to the " +
      "CockroachDB already in the cluster, and re-measured the render as OK -- 6 Deployments, 8 Services, " +
      "2 ConfigMaps, 1 Job, ZERO PVCs -- retiring the `helm-template-failed` acknowledgement this reason " +
      "cited. Writing that down rather than quietly overwriting it is the point: a stale reason is the " +
      "exact defect #13472 existed to remove from `platform`, and it took ten minutes to reintroduce. " +
      "THE REAL BLOCKERS, both established by #13469 and both in temporal/Application.yaml's header with " +
      "their own exits. (1) THE VISIBILITY SCHEMA DOES NOT APPLY TO COCKROACHDB: temporal v1.27.2's " +
      "`schema/postgresql/v12/visibility/versioned/v1.2/advanced_visibility.sql` opens with " +
      "`CREATE EXTENSION IF NOT EXISTS btree_gin` and uses a plpgsql function inside " +
      "`GENERATED ALWAYS AS (...) STORED` columns; CockroachDB implements neither " +
      "(cockroachdb/cockroach#51992 open; computed columns may not reference UDFs, #122945). The DEFAULT " +
      "store is unaffected, which is why this is a split rather than 'temporal does not work on " +
      "CockroachDB'. It fails at the `update-visibility-store` init container of `temporal-schema-1`. " +
      "(2) NO TLS MATERIAL, AND THIS COCKROACHDB IS TLS-ONLY: the cockroachdb Application sets " +
      "`tls.enabled: true` with the selfSigner, so the SQL port refuses a plaintext client; the CA lives " +
      "in a Secret in the `cockroachdb` namespace, this app runs in `temporal`, and no `temporal` SQL user " +
      "exists. Declaring `sql.tls` today would point a values block at a Secret nothing creates -- the " +
      "declaration-governing-a-nonexistent-path defect -- so it is named instead of declared. " +
      "LIFTS WHEN: the CRDB CA is distributed into the `temporal` namespace (trust-manager is already in " +
      "the cluster for exactly this) and a `temporal` SQL user plus its sealed password Secret exist, AND " +
      "the visibility store is pointed somewhere that accepts its schema; then `temporal/**` can leave " +
      "`DEFAULT_ROOT_DEV_CATALOG.excludeGlob` and a live run reports the rest. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: no-unrenderable full-ai-cluster/temporal] " +
      "[cite: renders full-ai-cluster/temporal] " +
      "[cite: no-pvc full-ai-cluster/temporal] " +
      "[cite: chart-pin full-ai-cluster/temporal temporal 0.59.0] " +
      "[cite: glob-defers temporal] ",
  ],
  [
    "vllm",
    "Same class as ollama: CUDA image, nvidia.com/gpu request, 200Gi longhorn PVC. " +
      "LIFTS WHEN: a GPU-bearing self-hosted runner exists for this lane, or a CPU-only dev profile ships. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: pvc-class full-ai-cluster/vllm longhorn] " +
      "[cite: pvc-total full-ai-cluster/vllm 200] " +
      "[cite: glob-defers vllm] ",
  ],
]);

const DEV_EXCLUDED_DIRS: ReadonlySet<string> = new Set(DEV_EXCLUDED_REASONS.keys());

export interface DevExclusionDrift {
  /** Excluded directories with no reason, or a reason naming no lift condition. */
  readonly unreasoned: readonly string[];
  /** Reasons for directories that no longer exist under the applications tree. */
  readonly stale: readonly string[];
  /**
   * Named in `DEFAULT_ROOT_DEV_CATALOG.excludeGlob` -- so the dev/CI lane never
   * applies them -- and carrying NO reason in this registry. The glob is what
   * actually defers; this registry is what has to say why.
   */
  readonly globExcludedWithoutReason: readonly string[];
  /**
   * The reverse: a reason claiming the lane does not apply a directory that the
   * glob does apply. A deferral that stopped being real still reads as one.
   */
  readonly reasonedButApplied: readonly string[];
}

/**
 * All four directions on the reasoned-exclusion registry.
 *
 * `unreasoned` cannot fire while `DEV_EXCLUDED_DIRS` is derived from the map's
 * own keys -- that derivation is what makes an unreasoned entry unwritable, and
 * the check stays so the property is asserted rather than merely arranged. It
 * DOES fire on a reason with no `LIFTS WHEN:` clause, which is the failure mode
 * that survives the derivation: a sentence that explains and commits to nothing.
 *
 * THE TWO GLOB DIRECTIONS WERE MISSING, AND THAT WAS THE HOLE
 * (081M0M9TRQ8087G0R000CS3F1X). This registry's own header says it describes
 * "Applications the dev/CI lane neither applies nor asserts", and the thing
 * that decides what the lane applies is `DEFAULT_ROOT_DEV_CATALOG.excludeGlob`
 * in `ports.ts` -- which this function never read. So the registry was checked
 * against the filesystem and against itself, and never against the list that
 * actually defers. Measured 2026-08-21 on `main`: the glob excluded NINE
 * directories and the registry reasoned about FIVE. `agent-memory`, `gitlab`,
 * `platform` and `temporal` were excluded from every CI cluster with no
 * recorded why and no lift condition, and both audit directions were green.
 *
 * That is the same vacuity the registry was built to remove, one list over: a
 * check that cannot fail is not a check. `platform` is the instance that
 * exposed it -- its only recorded reason was a source comment claiming its two
 * images were served by no registry, which was FALSE (see the corrected reason
 * in the map above), and no audit could notice because no audit looked.
 *
 * THE HONEST LIMIT, AND IT IS NOT SMALL: all four directions check that a
 * reason is PRESENT and names a lift condition. NONE of them checks that the
 * reason is TRUE. Nothing here can, and the proof arrived immediately -- the
 * `temporal` reason written in #13472 was refuted by #13469 in the interval
 * between measuring it and merging it, and this audit stayed green through
 * both, because a false sentence with a `LIFTS WHEN:` clause satisfies every
 * mechanical property it has. What the registry buys is that a reason is
 * WRITTEN DOWN and therefore refutable by a reader; what it cannot buy is the
 * reading. Reasons citing a render, a run id or an HTTP status are cheap to
 * re-check on purpose -- that is the mitigation, and it is a convention, not
 * an enforcement.
 */
export function auditDevExclusionReasons(
  repoRoot = REPO_ROOT,
  excludeGlob: string = DEFAULT_ROOT_DEV_CATALOG.excludeGlob,
): DevExclusionDrift {
  const applicationsRoot = join(repoRoot, "full-ai-cluster/k8s/applications");
  const present = existsSync(applicationsRoot)
    ? new Set(
        readdirSync(applicationsRoot, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name),
      )
    : new Set<string>();
  const globExcluded = rootDevCatalogExcludedDirs(excludeGlob);

  return {
    unreasoned: [...DEV_EXCLUDED_DIRS]
      .filter((dir) => !(DEV_EXCLUDED_REASONS.get(dir) ?? "").includes("LIFTS WHEN:"))
      .sort(),
    stale: [...DEV_EXCLUDED_REASONS.keys()].filter((dir) => !present.has(dir)).sort(),
    globExcludedWithoutReason: [...globExcluded].filter((dir) => !DEV_EXCLUDED_REASONS.has(dir)).sort(),
    reasonedButApplied: [...DEV_EXCLUDED_REASONS.keys()].filter((dir) => !globExcluded.has(dir)).sort(),
  };
}

/** Deferred from included Synced+Healthy proof until dev wiring/substrate exists (081KSXN940008QG0R000SCP2H1). */

/**
 * Deferred from the included Synced+Healthy proof until dev wiring/substrate
 * exists (081KSXN940008QG0R000SCP2H1).
 *
 * EVERY entry states WHY, and the why must name a BLOCKER -- a missing
 * dependency, secret, CRD, storage class or ceremony -- never "not wired yet".
 * Six of these carried no recorded reason at all until 2026-08-21; the reasons
 * below were established FROM the manifests and are written up in
 * `docs/research/2026-08-21-what-each-deferred-argocd-application-needs-to-boot.md`.
 *
 * `orleans` LEFT this set on 2026-08-21: every resource it declares reconciles
 * on a bare kind cluster, and its StatefulSet ships `replicas: 0`, which
 * gitops-engine's `getAppsv1StatefulSetHealth` reports Healthy (`ReadyReplicas
 * 0 < Replicas 0` is false, and the API-server-defaulted RollingUpdate
 * partition is 0 so `UpdatedReplicas 0 < 0 - 0` is false too). It was deferred
 * for a silo image it never pulls.
 *
 * TWO OF THE FOUR MEASURED DEFERRALS LEFT this set on 2026-08-21, and each
 * left because its DEFECT WAS FIXED -- never because the assertion was
 * weakened. They are asserted under the same full auto-sync contract as every
 * other member of the roster:
 *
 *   `cockroachdb`           -- the chart's own `cockroachdb-init` Job carries
 *      `helm.sh/hook: post-install`, which ArgoCD maps to PostSync, which runs
 *      only after the Sync phase is HEALTHY, which cannot happen until init has
 *      run. The Application now names `argocd.argoproj.io/hook: Sync` on that
 *      Job (gitops-engine `Types()`: "we ignore Helm hooks if we have Argo
 *      hook"), so the Job runs alongside the StatefulSet it unblocks.
 *   `kube-prometheus-stack` -- Grafana's `admin.existingSecret` is now MINTED
 *      per dev cluster by `applyDevBootstrapSecrets`, and
 *      `assertDevBootstrapSecretsPresent` below refuses an included run whose
 *      cluster does not have it.
 *   `oz` -- deferred 2026-08-22 and lifted the same day. Its two blockers were
 *      a trust-manager `Bundle` whose source Secret lived in a namespace
 *      trust-manager was not pointed at, and the SAME missing-admin-Secret
 *      shape as Grafana's. Both are closed at their source rather than waived;
 *      the record sits where the deferral used to, in
 *      DEV_INCLUDED_PROOF_DEFERRED_DIRS.
 *
 * `weaviate` was in that list for a few hours on 2026-08-21 and IS NOT NOW. The
 * live run refuted it: two `type: LoadBalancer` Services can never be Healthy on
 * a kind node, which no amount of sync convergence changes. It is deferred below
 * on that measurement, and that episode is why this paragraph says TWO.
 *
 * `hindsight` stays, with a reason that now names three independent blockers
 * instead of one -- see APPLIED_BUT_UNASSERTED_REASONS.
 */
const DEV_INCLUDED_PROOF_DEFERRED_DIRS = new Set([
  // volumeClaimTemplates pin `storageClassName: longhorn`, which is excluded
  // above, so the PVC never binds. Independently caught by the longhorn rule
  // in isExcludedFromIncludedProof -- this entry is redundant, and kept only so
  // the deferral stays legible next to its siblings.
  "agent-memory",
  // Needs a GitHub App credential + a live runner registration that CI has no
  // secret to bind. Listed EXPLICITLY even though `requestsReadWriteMany` below
  // also excludes it: that rule is about storage and this reason is not, so if
  // the RWX claim were ever narrowed to RWO the credential blocker would still
  // stand and must not silently stop applying.
  "arc-runner-set",
  // ----------------------------------------------------------------------
  // ONE OF FOUR MEASURED DEFERRALS SURVIVES, and it is `hindsight` below.
  // Run 32519516070 was the first in which the four were asserted at all: the
  // dev `longhorn` alias WORKED for every one -- their PVCs bound and their
  // pods ran -- and each then failed for a reason that had nothing to do with
  // storage. `cockroachdb`, `kube-prometheus-stack` and `weaviate` were FIXED
  // rather than re-deferred (see the header above); `hindsight` is the one
  // whose blockers this lane cannot reach.
  // ----------------------------------------------------------------------
  // Standby half of the either/or Git-host pair (gitlab is the default-on one),
  // so it ships manual-sync BY DESIGN. Asserting it here would assert the
  // manual-sync contract -- exists + compared, never synced -- which is exactly
  // the cdi/kubevirt vacuity #13084 had to fix. Testing it for real means
  // running BOTH Git hosts at once, the configuration its own header forbids.
  "forgejo",
  // charts.gitlab.io/gitlab 8.7.0: ~40 subcharts, a `gitlab-initial-root-password`
  // Secret CI has no source for, and a Postgres/Redis/Gitaly/MinIO stack wanting
  // several PVCs plus multi-GB images. A kind runner cannot schedule that inside
  // the lane's assertion budget.
  "gitlab",
  // `headscale` is NOT here. It LEFT this set on 2026-08-22 after ONE cycle, and
  // the entry is recorded as closed rather than the lines silently deleted.
  //
  //   WAS: applied and asserted for the first time by #13471 (before that it
  //   could not even render), and immediately found CrashLoopBackOff with 12
  //   restarts. Root cause, measured by rendering the Application against its
  //   own valuesObject: the entire `config:` block was INERT -- headscale 0.4.0
  //   has no top-level `config` key and the render carried ZERO occurrences of
  //   `server_url`, while the chart emits HEADSCALE_SERVER_URL only under
  //   `ingress.main.enabled`. The container ran with no server_url from any
  //   source. Fixed in #13550 by moving the value to the chart's own `env:` path.
  //
  //   IT WAS DEFERRED ANYWAY, on purpose: the repair was verified to RENDER and
  //   not to make the pod HEALTHY (no container runtime on the host that wrote
  //   it), and asserting a repair nobody ran is the failure this lane refuses.
  //
  //   CLOSED BY MEASUREMENT, run 32553963034 on `98c66c6cb8`:
  //     === headscale: sync=Unknown health=Healthy
  //         PersistentVolumeClaim/headscale-config: Healthy
  //         Service/headscale:                      Healthy
  //         Deployment/headscale:                   Healthy
  //   A 12-restart CrashLoopBackOff became a Healthy Deployment across exactly
  //   one manifest change, which is a state change rather than a timing flake.
  //
  //   AND THE EXIT CONDITION I WROTE WAS SLIGHTLY WRONG, which is worth more
  //   than the entry was. It said "prints `sync=Synced health=Healthy`". The
  //   lane does not require Synced: `argocd`, `cert-manager`, `external-secrets`,
  //   `headlamp`, `loki`, `minio` and `node-feature-discovery` are all asserted
  //   at `sync=Unknown health=Healthy` in the same passing run -- `Unknown` here
  //   is an ArgoCD ComparisonError on the diff, not a sync failure. A LIFTS WHEN
  //   stricter than the gate it names would have kept this deferral alive after
  //   its defect was gone, which is the exact shape of the acknowledgement that
  //   outlives its cause.
  // MEASURED 2026-08-21: hindsight-postgresql-0 FailedScheduling "Insufficient
  // cpu" on the 1-node runner; api + control-plane CrashLoop waiting on it.
  // THREE independent blockers now, only the first of which is capacity -- see
  // APPLIED_BUT_UNASSERTED_REASONS, which carries the finding that this
  // Application's valuesObject is written against a chart schema hindsight
  // 0.3.0 does not have, so almost none of it takes effect.
  "hindsight",
  // `orleans` is NOT here: main established by measurement that its
  // `replicas: 0` StatefulSet reaches Synced+Healthy, and removed it. Recorded
  // so the deferral is not reinstated by a future merge.
  //
  // CORRECTED 2026-08-21 (081M0M9TRQ8087G0R000CS3F1X). This comment used to end
  // "runs two images NO REGISTRY SERVES", and that clause was false. Both
  // images are built and pushed by `.github/workflows/build-platform-images.yml`
  // on every push to main touching their paths, and both GHCR packages exist
  // with 36 versions each, last updated the same morning this was written. What
  // is true is that the packages are PRIVATE and no pod spec in full-ai-cluster
  // declares `imagePullSecrets`, so an anonymous pull takes HTTP 401 while a
  // credentialed one takes HTTP 200. The full measurement, and why the two read
  // differently for anyone deciding what to do about it, is the `platform` entry
  // in DEV_EXCLUDED_REASONS -- which is where this Application's reason now
  // lives, because `platform/**` is in `DEFAULT_ROOT_DEV_CATALOG.excludeGlob`
  // and that registry is the one the glob audit checks.
  //
  // Still true, and independent: it renders `monitoring.coreos.com/v1`
  // ServiceMonitor + PrometheusRule (CRDs owned by kube-prometheus-stack, which
  // IS asserted here as of 2026-08-21, so this half no longer stands on its
  // own) and a `gateway.networking.k8s.io/v1` Gateway, and portal.yaml pins
  // `storageClassName: longhorn`.
  "platform",
  // `oz` (openziti-controller) is NOT here. It LEFT this set on 2026-08-22,
  // hours after it entered, and both blockers are recorded as CLOSED rather
  // than the lines silently deleted -- the same treatment `spire` gets below.
  //
  //   WAS: "(1) THE TRUST BUNDLE CANNOT RESOLVE ... `MountVolume.SetUp failed
  //   for volume \"ziti-controller-ctrl-plane-cas\": configmap
  //   \"ziti-controller-ctrl-plane-cas\" not found` ... trust-manager resolves
  //   Bundle secret sources from ITS OWN trust namespace, and ours is pinned to
  //   `cert-manager`, while the certificate that mints that secret is issued
  //   into `openziti`. (2) THE ADMIN CREDENTIAL IS OPERATOR-SUPPLIED BY DESIGN,
  //   and CI has no source for it."
  //
  //   BLOCKER 1 CLOSED BY: k8s/applications/trust-manager/Application.yaml +
  //   k8s/bootstrap/trust-manager-install.yaml, both now
  //   `app.trust.namespace: openziti`. The old reason said the fix was "a
  //   wiring decision between two charts", and it was -- but the wiring is not
  //   ours to choose: at the pinned trust-manager v0.15.0 the Bundle CRD's only
  //   served version offers NO per-source namespace, `deployment.yaml:86` takes
  //   a single `--trust-namespace`, and `role.yaml` grants Secret reads in that
  //   namespace ALONE, so the trust namespace is an RBAC boundary and not a
  //   default. ziti-controller's own README:33 states the requirement in the
  //   same words ("You must set the Trust Manager's 'trust namespace' to the
  //   namespace of the Ziti controller"). The cost is named where it is paid:
  //   the trust namespace is a cluster-wide singleton and openziti is now
  //   spending it, which is affordable only because `kind: Bundle` appears
  //   nowhere else in this tree and `defaultPackage.enabled` is false.
  //
  //   BLOCKER 2 CLOSED BY: `DEV_ZITI_ADMIN_SECRET` in dev-cluster/lib.ts, minted
  //   per cluster by `applyDevBootstrapSecrets` -- the SAME mechanism that
  //   closed Grafana's, one Application over, and NOT a new one. The manifest's
  //   intent is unchanged: `useCustomAdminSecret: true` stays, because the
  //   alternative is worse rather than merely different. MEASURED 2026-08-22:
  //   with `useCustomAdminSecret: false`, two `helm template` runs of the same
  //   chart against the same values differ in `admin-password` -- the chart
  //   builds it from `lookup` with a `randAlphaNum 32` fallback, ArgoCD's
  //   repo-server has no cluster for `lookup` to hit, and `selfHeal: true`
  //   would then rotate the controller's admin credential every reconcile.
  //
  //   AND THE `LIFTS WHEN` IT SATISFIES IS THE ONE THAT WAS WRITTEN: "(1) the
  //   Bundle's source secret and trust-manager's trust namespace are made to
  //   meet -- either trust-manager is given `openziti` in scope ... AND (2) the
  //   lane is given a `ziti-admin-credentials` Secret ... Both, not either."
  //   Both, and the first disjunct of each. A deferral whose stated condition is
  //   met and which stays anyway is the acknowledgement that outlives its cause.
  // `spire` is NOT here. It LEFT this set on 2026-08-22, and both blockers that
  // held it are recorded as CLOSED rather than the lines silently deleted.
  //
  //   WAS (corrected 2026-08-21 from an older reason that was stale on both
  //   halves -- it blamed a Vault upstream-CA dependency that does not exist and
  //   a kind PVC gap this lane already serves):
  //     "1. No `spire-crds` source in the ArgoCD/kind lane. Chart 0.24.2 ships
  //      no `crds/` and no `spire-crds` dependency, yet renders 3
  //      ClusterSPIFFEID resources. 2. The chart's `pre-upgrade` hook Job --
  //      DERIVED, not observed."
  //
  //   BLOCKER 1 CLOSED BY: full-ai-cluster/k8s/applications/spire-crds/
  //   Application.yaml -- the same spire-crds 0.5.0 chart the k3s bootstrap
  //   installs, at sync-wave -55, with the edge `spire -> spire-crds` DECLARED
  //   in sync-wave-dependency-graph.yaml so derive-sync-waves.ts refuses if the
  //   ordering ever stops being a linear extension. The ordering is declared,
  //   not timed.
  //
  //   BLOCKER 2 CONFIRMED, THEN CLOSED. It was recorded as a derivation because
  //   blocker 1 aborted the sync before it could fire. With blocker 1 fixed it
  //   fired exactly as derived, and is now OBSERVED (kind + argo-cd 2.13.2,
  //   2026-08-22): five `spire-server-pre-upgrade` pods in Error with
  //     Error from server (NotFound): validatingwebhookconfigurations
  //     .admissionregistration.k8s.io
  //     "spire-spire-controller-manager-webhook" not found
  //   and the Application pinned at `waiting for completion of hook
  //   batch/Job/spire-server-pre-upgrade` with zero workload pods. Closed with
  //   the chart's own documented setting for template-rendering consumers,
  //   `global.installAndUpgradeHooks.enabled: false`.
  //
  //   A THIRD blocker was found only because the first two were fixed, and it
  //   was invisible behind them: `ServerSideApply=true` makes the spire-server
  //   StatefulSet permanently OutOfSync on a `volumeClaimTemplates` artifact
  //   ArgoCD's own `ignoreDifferences` cannot reach. The 2x2 is measured in the
  //   Application. This is the weaviate lesson applied in advance -- one
  //   confirmed cause is not THE cause -- and it is why the verification below
  //   is a clean-slate run rather than a patch on the cluster that found it.
  //
  //   PROVEN, clean cluster, both Applications applied together so nothing
  //   depended on hand-timing: spire-crds Synced/Healthy, spire Synced/Healthy,
  //   spire-server 2/2, spire-agent 1/1, spire-spiffe-csi-driver 2/2, all three
  //   ClusterSPIFFEIDs bound, and -- past what ArgoCD can tell you -- one agent
  //   attested `k8s_psat` holding
  //   `spiffe://zeta.local/spire/agent/k8s_psat/zeta/...` with 7 registration
  //   entries issued.
  // go.temporal.io/temporal 0.59.0 with `cassandra.enabled: false` and no
  // `server.config.persistence` override: the chart is left with NO datastore,
  // so the schema-setup job has nothing to migrate against. The commented-out
  // CockroachDB wiring is the missing half -- and as of 2026-08-21 the reason it
  // is commented out has changed: cockroachdb now reaches Synced+Healthy in this
  // lane, so the blocker is the unwritten `server.config.persistence` block
  // alone, not an unavailable datastore. That is the next one to close, and it
  // is a manifest change nobody has made rather than a substrate gap.
  "temporal",
  // `vault` is NOT here. It LEFT this set on 2026-08-21, and the condition that
  // lifted it is recorded rather than the line silently deleted.
  //
  //   WAS: "comes up SEALED by design; readiness needs the gated operator-init
  //   ceremony CI must not run -- `vault operator init` + `unseal` MINT root and
  //   unseal key material, a gated class (vault/Application.yaml, TOPOLOGY.md).
  //   Not a wiring gap: a lane that could make Vault Healthy would be a lane
  //   that performs the ceremony, and it must not."
  //
  //   LIFTED BY: the maintainer authorising the EPHEMERAL case on 2026-08-20 --
  //   "if we init key materials and throw it away not a bit deal". The old
  //   reason's last sentence is still true for the METAL cluster and
  //   vault/TOPOLOGY.md section 5 is unchanged: that ceremony is still a human
  //   one, behind the biometric gate. What changed is that a kind cluster
  //   destroyed at the end of the run is not custody, so the lane may perform
  //   the same procedure there. `./ephemeral-vault-init.ts` is that lane, its
  //   gate refuses `--existing`, and its leak scan runs holding the material.
  // MEASURED live, run 32532470499 -- and NOT the reason this Application was
  // deferred for earlier on 2026-08-21, which is exactly why it is back.
  //
  // weaviate renders TWO `type: LoadBalancer` Services (`weaviate`,
  // `weaviate-grpc`). gitops-engine `getCorev1ServiceHealth` reports a
  // LoadBalancer Service whose `status.loadBalancer.ingress` is empty as
  // PROGRESSING, unconditionally and forever. A kind node runs no LoadBalancer
  // implementation, so those two Services never receive an address and this
  // Application can never be Healthy in this lane -- whatever its sync status
  // does. `weaviate-0` was 1/1 Running for 39 minutes while that held, which is
  // exactly how the blocker stayed invisible behind the one that was found.
  //
  // THE HONEST ACCOUNTING OF THE ATTEMPT THAT FAILED: the `randAlphaNum` render
  // nondeterminism is real and stays proven by byte diff, and its
  // `ignoreDifferences` rule is KEPT (see the Application) because on metal,
  // where cilium-lb-ipam does assign LB addresses, it may well be the whole
  // story. What was wrong was the inference, not the measurement -- the
  // OutOfSync cause was established and the PROGRESSING cause was never
  // checked, so one confirmed cause was read as THE cause. The live run also
  // shows the resync loop survived the ignore rule, so "that rule closes the
  // loop" is UNMETERED -- implemented, plausible, unfalsified -- and this lane
  // cannot meter it until the health half lifts.
  //
  // LIFTS WHEN: the dev/CI substrate provides a LoadBalancer implementation
  // (cloud-provider-kind or MetalLB), the same shape as the dev `longhorn`
  // StorageClass alias one resource type over, AND the residual OutOfSync is
  // then NAMED by the per-resource diagnostics added alongside this entry
  // rather than guessed at a second time.
  "weaviate",
]);

/**
 * The two exclusion lists, linked (081M00QCNYM087G0R000ZS3CE2).
 *
 * There are TWO independent lists governing this lane and nothing used to keep
 * them in agreement:
 *
 *   1. WHAT ARGOCD APPLIES  - `DEFAULT_ROOT_DEV_CATALOG.excludeGlob` (ports.ts).
 *      Ground truth: a directory named there never reaches the CI cluster.
 *   2. WHAT THE HARNESS ASSERTS - `DEV_EXCLUDED_DIRS` +
 *      `DEV_INCLUDED_PROOF_DEFERRED_DIRS` + the derived, now
 *      SUBSTRATE-CONDITIONAL "requests `storageClass: longhorn` that this lane
 *      cannot serve" rule, via `isExcludedFromIncludedProof`.
 *
 * The difference between them is a SHADOW: Applications that are applied to
 * every CI cluster and asserted by nothing. Measured on 2026-08-16 it was 14
 * directories wide, and it contained most of the stateful core of the hardware
 * PoC (cockroachdb, vault, nats, redis, spire, ...). `cockroachdb` could not
 * even sync in that lane - it wants `storageClass: longhorn`, `longhorn` was
 * glob-excluded, so the StorageClass never existed and the Application hung
 * `Missing` forever while the harness reported `ok: true`.
 *
 * 2026-08-21 (081M0JXF6MS087G0R001HC34TM): ten of those entries are gone, not
 * because the reason was waived but because the reason stopped being true. The
 * dev clusters now apply a StorageClass NAMED `longhorn` backed by
 * `rancher.io/local-path` (`dev-cluster/manifests/longhorn.yaml`), so those
 * Applications bind and are asserted like any other. What survives here is what
 * the alias genuinely cannot fix.
 *
 * The shadow is not a bug on its own - deferring an Application is legitimate.
 * The bug is that the deferral was IMPLICIT, so it could grow silently. This
 * registry makes each one explicit and REASONED, and
 * `auditAppliedButUnasserted` goes red the moment the two lists drift apart in
 * either direction: a newly-applied Application nobody asserted, or a stale
 * entry here for a directory that no longer exists.
 *
 * Adding an entry is cheap and honest; adding one WITHOUT a reason is refused.
 */
export const APPLIED_BUT_UNASSERTED_REASONS: ReadonlyMap<string, string> = new Map([
  [
    "arc-runner-set",
    "TWO independent blockers, either alone sufficient: it needs a GitHub App credential + a live runner registration that CI has no secret to bind, AND model-cache-pvc.yaml claims ReadWriteMany, which rancher.io/local-path behind the dev longhorn alias cannot serve (081KSXN940008QG0R000SCP2H1). " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: path full-ai-cluster/k8s/applications/arc-runner-set/model-cache-pvc.yaml] " +
      "[cite: glob-applies arc-runner-set] ",
  ],
  [
    "forgejo",
    "deferred until dev wiring exists (DEV_INCLUDED_PROOF_DEFERRED_DIRS). " +
      "[cite: glob-applies forgejo] [cite: renders full-ai-cluster/forgejo]",
  ],
  [
    "hindsight",
    "THREE independent blockers, established 2026-08-21 by rendering hindsight 0.3.0 against this Application's own valuesObject; any ONE of them defers it. " +
      "(1) CAPACITY -- AND HINDSIGHT IS THE SYMPTOM, NOT THE CAUSE. MEASURED run 32519516070: hindsight-postgresql-0 never scheduled -- FailedScheduling `0/1 nodes are available: 1 Insufficient cpu` -- so hindsight-api and hindsight-control-plane CrashLoopBackOff waiting on a database with nowhere to run. Its three requests are 500m (api) + 250m (control-plane) + 250m (postgresql), re-rendered 2026-08-22 from chart 0.3.0 against this Application's own valuesObject; every one is a CHART DEFAULT (`metalSource: chart-default` on all three rows), so no number here is a measurement of hindsight's working set and neither rung claims to be -- both are reservations. " +
      "THE ARITHMETIC THAT SAYS `SYMPTOM`, and it is why the deferral does not lift by shrinking this app: the dev lane APPLIES 38 Applications totalling 5231m at the rung the tree ships, against a 2500m budget (4000m runner less 1500m reserved). Hindsight is 1000m of that. Take hindsight to ZERO and the lane is still 4231m -- over by 1731m. Take hindsight alone to its `dev` rung (400m) and the lane is 4631m. Take the WHOLE lane to `dev` and it is 1081m, which FITS with 1419m of spare. THAT IS THE THIRD ANSWER THIS SENTENCE HAS CARRIED and the earlier two are kept rather than overwritten: 1906m fits, then 2906m over by 406m (gmod became visible), then 2006m fits (the rung learned to reach raw in-repo manifests), and now 1081m -- because 18 governed `cpuMillis.dev` rows were floored at 25m on 2026-08-23 (-1250m across all 47; -925m inside this lane), which is Aaron's observation that CPU is compressible taken at the rung where it is true. So the only cut that closes this is lane-wide -- and lane-wide is SUFFICIENT again, which is the second change of answer this sentence has carried and is written as a sequence rather than as a replacement: it closed at 1906m, then did NOT close at 2906m, and now closes at 2006m. mimir, at 1610m, is the larger single reservation. WHY IT MOVED TWICE: every number in that paragraph rose by 1000m on 2026-08-22 and nothing grew -- applicationDirs() enumerated depth 1, ArgoCD's include glob is not path-segment bounded (established against a LIVE cluster in app-of-apps-discovery.ts), and `game-hosting/gmod` -- an in-repo StatefulSet whose manifest carries a literal cpu 1 / memory 2Gi -- had been applied by this root since it was written and counted by nothing. This catalogue asserted in writing that it contributes 0m / 0Mi. It was then recorded here that `NO RUNG REACHES IT: it is a git-path source with no valuesObject, so `--resource-profile dev --apply` cannot touch it`. THE FIRST CLAUSE WAS TRUE AND THE SECOND WAS FALSE: `applyResourceProfile` writes a dotted path into an arbitrary manifest and always could reach statefulset.yaml; only the render-side reader demanded a valuesObject coordinate. Since 2026-08-23 three git-path Applications we own (1150m in total) are governed rows addressing their own manifests, gmod is 100m at `dev` and the unchanged 1000m at `metal`, and the lane closes. gmod did not schedule TODAY because its sync fails on gatekeeper's webhook -- a reprieve of the same shape as the one in the next paragraph, one resource type over -- and it was priced and governed rather than waited out. " +
      "AND THE LANE HAS BEEN OVER-COMMITTED SINCE THE LONGHORN ALIAS LANDED, which storage-profiles.json predicted in writing: `the only reason that has not bitten is that 14 of them hang Missing on a longhorn StorageClass the dev catalog excludes, so they never schedule a pod. That is a reprieve, not a fit, and it evaporates the moment the StorageClass exists.` The dev lane now applies a `longhorn` StorageClass over rancher.io/local-path, so it has evaporated, and hindsight-postgresql-0 is the first pod to be handed the bill. " +
      "THE TWO SUBSTRATES ARE NOT CLOSE, which is why a fix for one is wrong for the other: the runner is 4000m (envelope, and `--measure-runner` convicts a smaller machine, so it is checked rather than trusted), while the checked-in ClusterNode registrations measure 16 cores (maintainers/Addisons820/cluster-nodes/node-ad1efd, node-b1e1b5) and 22 cores (maintainers/maximdolphin/cluster-nodes/node-5b2dfa, node-f82aa6). ~4x. The whole 47-app catalogue at `metal` is 9256m, which does not fit one runner and fits one 16-core box comfortably. THAT SECOND HALF IS CHECKED NOW, and it was not when this reason was first written: `compute-provenance` in single-node-readiness.ts compares the ACTIVE resource rung's total over the metal cohort against `spec.hardware.cores` and `spec.hardware.memory` on the smallest registered node, the same one-way way `capacity-provenance` compares the storage ladder against `spec.hardware.storage`. It REFUSES when no registration carries both. Green today -- 9256m against 16000m raw -- and the arithmetic is printed on every auditor run rather than only when it fails. Two units traps were found building it and are recorded at the parser: `cores` is `nproc`, i.e. LOGICAL CPUs (22 on a 16-core Ultra 9 185H), and `memory` is captured with `free -h --si`, i.e. DECIMAL, so `66G` is 62942Mi and not 67584Mi -- reading it as binary would have inflated the bound, which is the acquitting direction. " +
      "(2) THE `dev` RESOURCE RUNG CANNOT REACH THIS LANE, which is the part that looked like the fix and is not. `storage-profiles.ts --resource-profile dev --apply` rewrites the WORKING TREE; ArgoCD syncs the COMMITTED tree at `--git-ref`, and `bootstrap/root-application.yaml` points the METAL cluster at the same `main`/`full-ai-cluster/k8s/applications` path. One committed tree, two substrates, no override point -- so lowering these numbers lowers them for the 16-core box too, where the cost of an under-request is a pod evictable under node pressure rather than one refused a node. That trade is a maintainer call, not a CI convenience. " +
      'AND THE GREEN BUDGET GATE IS ABOUT A RUNG THE TREE DOES NOT CARRY, which is the part nothing had written down. MEASURED 2026-08-22, exit codes read directly: `--resource-profile metal --check` exits 0 (`manifests match resource profile "metal"`) and `--resource-profile dev --check` exits 1 with 54 drifts -- the committed tree IS `metal`. `--resource-profile metal --budget` exits 1; `--resource-profile dev --budget` exits 0. The `plan + unit tests` job runs the `dev` one. So the gate that is green is arithmetic about a configuration nobody applied, standing in front of a lane that then runs the configuration that exits 1. Nobody misreported it -- the workflow comment said `the same audit against the metal rung exits 1 today` -- but no check compared the two. `findRungCoverage` is that comparison now: the ledger declares `activeResourceProfile` (REQUIRED, refused if absent), `ciBudgetedProfile` reads the budgeted rung off the workflow\'s own run line rather than restating it, and a disagreement between them is a blocker unless the gap is carried as `acknowledgedRungBudgetGap` with all four numbers pinned. It IS carried today -- `metal@dev-lane=5231m/13475Mi>>2500m/9216Mi` -- so this remains a stated debt with a maintainer decision behind it rather than a hidden one, and moving any of those four numbers re-reddens it. ' +
      "EVERY CAPACITY NUMBER IN THIS REASON ROSE BY 1000m ON 2026-08-22 AND NOTHING GREW, which is the one part here that the two checks above do not already say: applicationDirs() enumerated depth 1, ArgoCD's include glob is not path-segment bounded (established against a LIVE cluster in app-of-apps-discovery.ts, in this repo, before this reason was written), and `game-hosting/gmod` -- an in-repo StatefulSet whose own manifest carries a literal cpu 1 / memory 2Gi -- had been applied by this root since it was written and counted by nothing. storage-profiles.json asserted in writing that it contributes 0m / 0Mi. The consequence for THIS reason was not cosmetic: it put the whole lane at `dev` at 2906m against a 2500m budget, STILL OVER by 406m, so taking the lane to `dev` was NECESSARY BUT NOT SUFFICIENT. THAT HALF IS CLOSED AS OF 2026-08-23 AND THE CORRECTION IS RECORDED RATHER THAN OVERWRITTEN. This reason said `NO RUNG REACHES gmod, because it is a git-path source with no valuesObject, so `--resource-profile dev --apply` cannot touch it`. The premise was right and the conclusion was WRONG ABOUT THIS REPO'S OWN APPLIER: `applyResourceProfile` addresses `path` + `docIndex` + `requestsField` as a dotted path into an ARBITRARY manifest and could always have written into statefulset.yaml; only the render-side reader (`overlayRung`) required the `spec.source.helm.valuesObject.` prefix, and it is that reader -- not the applier -- that has been widened. Three git-path Applications we own, carrying 1150m of hardcoded requests no rung could reach (gmod 1000m, platform 100m, agent-memory 50m), are now governed resourceClaims addressing their own manifests. `cdi` (100m) and `kubevirt` (20m x 2 pods) are reachable by the same mechanism and were governed for one draft before being backed out: both manifests are vendored byte-for-byte from upstream, and single-node-budget.json says of kubevirt's that editing it `would make the checked-in copy diverge from the cluster it documents, which is a worse lie than this one`. REACHING A FILE IS NOT A LICENCE TO EDIT IT, so those 120m stay ACKNOWLEDGED rather than governed. The dev lane is 1081m and FITS with 1419m of spare, after the 2026-08-23 dev CPU floor; `metal` is unchanged at 5231m, because the rows reproduce the committed literals exactly and `--resource-profile metal --verify` is clean. gmod did not schedule TODAY because its sync fails on gatekeeper's webhook -- a reprieve of exactly the shape the longhorn paragraph above describes, one resource type over, and it was NOT treated as a fit: the 1000m was priced and then governed rather than waited out. " +
      "(3) THE valuesObject IS STILL PARTLY INERT against this chart, which is a defect in its own right -- and the STORAGE half of it is now FIXED, so this reason is narrowed rather than left standing. Fixed 2026-08-22: the Application wrote `postgresql.primary.persistence.{storageClass,size}` (the bitnami subchart layout) where hindsight 0.3.0 reads `postgresql.persistence.*`; the `.primary` level is gone and the re-render is 10Gi on `longhorn` instead of the chart default 8Gi with NO storageClassName. What REMAINS inert, re-checked against the same render on the same day: `api.llm.{provider,existingSecret}` and a top-level `service`, against a chart that reads `api.env`/`api.secrets`/top-level `existingSecret` and `api.service`/`controlPlane.service` -- rendered proof, still true, is that no HINDSIGHT_API_LLM_API_KEY env reaches the api container (the api Deployment carries only HINDSIGHT_API_DATABASE_URL and HINDSIGHT_API_LLM_MODEL). AND THE HONEST LIMIT ON THIS THIRD BLOCKER, written because the exit condition below is the thing most likely to outlive its defect: nobody has measured whether hindsight-api can reach Healthy WITHOUT an LLM API key. It may start and fail only on first extraction, or it may crash at boot. Unknown, and left unknown rather than guessed -- so (3) is recorded as a DEFECT in its own right and is deliberately not claimed as a scheduling blocker. " +
      "LIFTS WHEN: this lane reports hindsight at `health=Healthy` -- NOT `sync=Synced health=Healthy`. The lane accepts `sync=Unknown health=Healthy` (argocd, cert-manager, external-secrets, headlamp, loki, minio and node-feature-discovery all pass that way in the same green run), and a LIFTS WHEN stricter than the gate it names is exactly what kept `headscale` deferred for a cycle after its defect was gone. Reaching it needs (a) the lane-wide capacity trade in (1)/(2) settled by the maintainer, and (b) whatever (3) turns out to cost once (a) lets a pod run long enough to find out. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. The four capacity numbers above are citations rather than prose FOR THAT REASON -- they are the numbers a reader is most likely to act on, so they are the ones that must not be allowed to go quietly stale. " +
      "[cite: glob-applies hindsight] " +
      "[cite: pvc-class full-ai-cluster/hindsight longhorn] " +
      "[cite: pvc-total full-ai-cluster/hindsight 10] " +
      "[cite: chart-pin full-ai-cluster/hindsight hindsight 0.3.0] " +
      "[cite: resource-rung hindsight metal 1000] " +
      "[cite: resource-rung hindsight dev 75] " +
      "[cite: lane-cpu metal 5231 over] " +
      "[cite: lane-cpu dev 1081 fits] " +
      "[cite: workflow-job k8s-argocd-health-test.yml dry-run] " +
      "[cite: path full-ai-cluster/k8s/bootstrap/root-application.yaml] " +
      "[cite: path maintainers/Addisons820/cluster-nodes/node-ad1efd/node.yaml] " +
      "[cite: path maintainers/maximdolphin/cluster-nodes/node-5b2dfa/node.yaml] ",
  ],
  [
    "weaviate",
    "NOT the sync loop it was briefly un-deferred for, and not storage -- MEASURED LIVE on run 32532470499, the run that refuted the fix. " +
      "weaviate renders TWO `type: LoadBalancer` Services (`weaviate`, `weaviate-grpc`), and gitops-engine `getCorev1ServiceHealth` reports a LoadBalancer Service whose `status.loadBalancer.ingress` is empty as PROGRESSING, unconditionally. A kind node runs no LoadBalancer implementation, so those two Services never get an address and this Application can NEVER be Healthy in this lane whatever its sync status does -- `weaviate-0` was 1/1 Running for 39m while that held, which is how the blocker stayed hidden behind the one that was found. " +
      "The `randAlphaNum` render nondeterminism established by byte diff is real and its narrow `ignoreDifferences` rule is KEPT, because on metal cilium-lb-ipam does assign LB addresses and it may there be the whole story. But the resync loop SURVIVED that rule live, so 'the rule closes the loop' is UNMETERED rather than proven: the OutOfSync cause was checked and the Progressing cause was not, and one confirmed cause was read as THE cause. " +
      "LIFTS WHEN: the dev/CI substrate provides a LoadBalancer implementation (cloud-provider-kind or MetalLB) -- the same shape as the dev `longhorn` StorageClass alias, one resource type over -- AND the residual OutOfSync is NAMED by the per-resource diagnostics rather than guessed at a second time. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: glob-applies weaviate] " +
      "[cite: renders full-ai-cluster/weaviate] ",
  ],
]);

/**
 * Directories the dev/CI app-of-apps root never applies, derived FROM the
 * `excludeGlob` rather than restated by hand — the whole point is that there is
 * one source of truth for "what reaches the cluster".
 */
export function rootDevCatalogExcludedDirs(
  excludeGlob: string = DEFAULT_ROOT_DEV_CATALOG.excludeGlob,
): ReadonlySet<string> {
  return new Set(
    excludeGlob
      .replace(/^\{/, "")
      .replace(/\}$/, "")
      .split(",")
      .map((entry) => entry.trim().replace(/\/\*\*$/, ""))
      .filter((entry) => entry.length > 0),
  );
}

export interface AppliedButUnassertedDrift {
  /** Applied to the CI cluster, not asserted, and carrying no stated reason. */
  readonly unexplained: readonly string[];
  /** Listed in the registry but no longer applied-but-unasserted (stale entry). */
  readonly stale: readonly string[];
}

/**
 * Compare the two lists. Returns the drift in BOTH directions; empty/empty is
 * the green state. Pure, offline, reads only the checked-in manifests.
 */
export function auditAppliedButUnasserted(repoRoot = REPO_ROOT): AppliedButUnassertedDrift {
  const globExcluded = rootDevCatalogExcludedDirs();
  const applied = discoverExpectedApplications(repoRoot).filter((app) => !globExcluded.has(app.dir));
  const unasserted = applied.filter((app) => app.excludedFromDev).map((app) => app.dir);
  const unassertedSet = new Set(unasserted);

  return {
    unexplained: unasserted.filter((dir) => !APPLIED_BUT_UNASSERTED_REASONS.has(dir)).sort(),
    stale: [...APPLIED_BUT_UNASSERTED_REASONS.keys()].filter((dir) => !unassertedSet.has(dir)).sort(),
  };
}

export function isIncludedScope(scope: Scope): boolean {
  return scope === "included" || scope === "full";
}

function requestsLonghornStorageClass(yamlText: string): boolean {
  return yamlText.split("\n").some((line) => {
    const trimmed = line.trim();
    const separator = trimmed.indexOf(":");
    if (separator < 0) return false;
    const key = trimmed.slice(0, separator);
    if (key !== "storageClass" && key !== "storageClassName") return false;
    const rawValue =
      trimmed
        .slice(separator + 1)
        .split("#", 1)[0]
        ?.trim() ?? "";
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
    return value === "longhorn";
  });
}

function listYamlFilesUnder(dir: string, depth = 0): readonly string[] {
  if (depth > 2 || !existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listYamlFilesUnder(path, depth + 1);
    if (entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) return [path];
    return [];
  });
}

function yamlTreeReferencesLonghorn(appDir: string): boolean {
  return listYamlFilesUnder(appDir).some((file) => requestsLonghornStorageClass(readFileSync(file, "utf8")));
}

/**
 * `ReadWriteMany` anywhere in the Application's checked-in YAML tree.
 *
 * EVERY class a dev cluster offers is `rancher.io/local-path` -- the `longhorn`
 * alias, `zeta-local-path`, and kind's default `standard` alike -- and
 * local-path is node-local and RWO-ONLY. An RWX claim against any of them never
 * binds, the pod stays `Pending`, and ArgoCD reports a pending PVC as
 * Progressing rather than Degraded, so the Application does not fail: it never
 * finishes. That is why this gates on its own rather than inside the longhorn
 * branch -- the hazard is the access mode, not the class name.
 *
 * Deliberately a plain substring scan rather than a structural walk:
 * `accessModes` appears under Helm values, StatefulSet volumeClaimTemplates,
 * bare PVCs, and inline flow sequences, and this must FAIL CLOSED -- a shape it
 * cannot parse must read as "might need RWX", not as "safe to assert".
 *
 * HONEST LIMIT, and it is a large one. This reads only the CHECKED-IN tree, and
 * every Application the alias unlocks is `spec.source.chart` against an external
 * `repoURL` -- the repo holds a `valuesObject`, and the PVC's access mode lives
 * in the upstream chart. So for exactly the Applications this guard exists to
 * protect, it scans files that usually cannot contain the claim. It is a FLOOR
 * (it catches the in-repo case, which is how `arc-runner-set` is caught), not a
 * proof. A chart bump that introduces an RWX claim passes it, and the symptom
 * would be a hang. The thing that would actually close this is rendering the
 * chart, which `helm-validate.yml` already does for the k8s tree; wiring the
 * access mode out of that render is the real fix and is not done here.
 */
function yamlTreeRequestsReadWriteMany(appDir: string): boolean {
  return listYamlFilesUnder(appDir).some((file) => readFileSync(file, "utf8").includes("ReadWriteMany"));
}

/**
 * Does the repo DECLARE a dev/CI substrate StorageClass named `longhorn`?
 *
 * This is the SUBSTRATE CONDITION the longhorn exclusion now hangs on. It is
 * deliberately a fact about the checked-in tree rather than about a live
 * cluster, because `isExcludedFromIncludedProof` is a pure, offline predicate
 * that `app-of-apps-discovery.ts` and the unit tests call with no cluster in
 * sight. The live half is `assertDevStorageClassPresent`, below, which refuses
 * to run the proof if the class the repo promised is not actually in the
 * cluster.
 *
 * Fail-closed in every direction: file missing, unparseable (which is also what
 * a multi-document file yields -- `parseYaml` THROWS on `---` separators rather
 * than silently returning the first document), not a StorageClass, named
 * something else, or bound to a provisioner the dev substrate cannot run. Any
 * of those is `false`, which restores the old blanket exclusion. The exclusion
 * is made CONDITIONAL, never removed.
 *
 * THE PROVISIONER IS CHECKED, not merely present. "Is there a StorageClass named
 * longhorn" is satisfied by `provisioner: driver.longhorn.io` -- precisely the
 * thing a kind node cannot run. Accepting any non-empty string would make an
 * edit that "restores parity" by naming the real driver silently unlock ten
 * Applications onto a class that provisions nothing.
 */
export function devLonghornStorageClassAliasDeclared(repoRoot = REPO_ROOT): boolean {
  const path = resolve(repoRoot, DEV_STORAGE_ALIAS_MANIFEST_RELPATHS.longhorn);
  if (!existsSync(path)) return false;
  let document: unknown;
  try {
    document = parseYaml(readFileSync(path, "utf8"));
  } catch {
    return false;
  }
  if (typeof document !== "object" || document === null) return false;
  const record = document as { kind?: unknown; metadata?: unknown; provisioner?: unknown };
  if (record.kind !== "StorageClass") return false;
  if (typeof record.provisioner !== "string") return false;
  if (!DEV_SATISFIABLE_PROVISIONERS.has(record.provisioner)) return false;
  const metadata = record.metadata;
  if (typeof metadata !== "object" || metadata === null) return false;
  return (metadata as { name?: unknown }).name === DEV_LONGHORN_ALIAS_CLASS_NAME;
}

/**
 * `dir` is applied by the dev root but NOT asserted by the included proof.
 *
 * Three mechanisms, and the third one is now SUBSTRATE-CONDITIONAL
 * (081M0JXF6MS087G0R001HC34TM):
 *
 *   1. `DEV_EXCLUDED_DIRS`                  -- no dev substrate at all (GPU, CNI).
 *   2. `DEV_INCLUDED_PROOF_DEFERRED_DIRS`   -- a named non-storage blocker.
 *   3. claims `ReadWriteMany`               -- unservable by EVERY dev class.
 *   4. requests `storageClass: longhorn`    -- ONLY while dev has no class by
 *                                              that name.
 *
 * Rule 4 used to be unconditional, and it was circular: the apps were excluded
 * because Longhorn was excluded, and Longhorn was excluded because a kind node
 * has no second disk. `full-ai-cluster/dev-cluster/manifests/longhorn.yaml`
 * cuts the circle by giving dev a StorageClass that answers to the name, so the
 * question stops being "does this request longhorn" and becomes "can this lane
 * satisfy what it requests".
 *
 * RULE 3 IS NOT NESTED INSIDE RULE 4, and the ordering is deliberate. Every dev
 * class is `rancher.io/local-path`, so an RWX claim is unservable whether it
 * names `longhorn`, `zeta-local-path`, kind's default, or no class at all.
 * Checking the access mode only for longhorn-requesting apps would leave the
 * other three shapes able to hang.
 *
 * WHY THIS IS NOT A DELETION OF RULE 4, which would be the dangerous change: a
 * PVC that cannot bind stays `Pending`, and ArgoCD reports a pending PVC as
 * Progressing -- never Degraded. So the Application does not fail; it burns the
 * whole `--timeout-sec` (2400s in CI) and is then reported as
 * `ApplicationUnhealthy` naming the SYMPTOM (still Progressing) rather than the
 * cause (no such StorageClass) -- and if the 60-minute job cap trips first,
 * there is no verdict at all. The rule therefore still applies in full whenever
 * the substrate is absent (`aliasDeclared === false`).
 *
 * @param aliasDeclared substrate condition; defaults to reading the repo, and
 *   is threaded explicitly by `discoverExpectedApplications` so one filesystem
 *   read serves the whole roster and the unit tests can drive both branches.
 *   NOTE the default reads the REAL repo root, so a caller passing a fixture
 *   `appDir` must pass this explicitly or the two disagree about which tree
 *   they are describing.
 */
export function isExcludedFromIncludedProof(
  dir: string,
  appText: string,
  appDir: string,
  aliasDeclared: boolean = devLonghornStorageClassAliasDeclared(),
): boolean {
  if (DEV_EXCLUDED_DIRS.has(dir)) return true;
  if (DEV_INCLUDED_PROOF_DEFERRED_DIRS.has(dir)) return true;
  if (yamlTreeRequestsReadWriteMany(appDir)) return true;
  if (aliasDeclared) return false;
  return requestsLonghornStorageClass(appText) || yamlTreeReferencesLonghorn(appDir);
}

function usageFailure(message: string): Failure {
  return { kind: "UsageError", message };
}

function isProvider(value: string): value is Provider {
  return value === "k3d" || value === "kind";
}

function isScope(value: string): value is Scope {
  return value === "smoke" || value === "included" || value === "full";
}

function isContainerRuntime(value: string): value is ContainerRuntime {
  return value === "docker" || value === "podman";
}

function containerRuntimeFromEnv(env: NodeJS.ProcessEnv): ParseRuntimeEnvResult {
  if (env.CONTAINER_RUNTIME !== undefined && env.CONTAINER_RUNTIME !== "") {
    return {
      ok: false,
      failure: usageFailure("CONTAINER_RUNTIME is not supported; use ZETA_CONTAINER_RUNTIME"),
    };
  }

  const raw = env.ZETA_CONTAINER_RUNTIME;
  if (raw === undefined || raw === "") return { ok: true, value: null };
  if (isContainerRuntime(raw)) return { ok: true, value: raw };
  return {
    ok: false,
    failure: usageFailure(`ZETA_CONTAINER_RUNTIME must be docker or podman (got: ${raw})`),
  };
}

function parsePositiveInteger(raw: string, flag: string): ParseNumberResult {
  if (!/^[1-9]\d*$/.test(raw)) {
    return { ok: false, failure: usageFailure(`${flag} requires a positive integer`) };
  }
  return { ok: true, value: Number(raw) };
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

function defaultCliOptions(env: NodeJS.ProcessEnv): ParseOptionsResult {
  const envRuntime = containerRuntimeFromEnv(env);
  if (!envRuntime.ok) return envRuntime;
  const runtime = envRuntime.value ?? "docker";
  const provider: Provider = runtime === "podman" ? "kind" : "k3d";
  return {
    ok: true,
    value: {
      mode: "dry-run",
      provider,
      gitRef: "main",
      clusterName: null,
      configPath: provider === "kind" ? DEFAULT_KIND_CONFIG : DEFAULT_K3D_CONFIG,
      configExplicit: false,
      existing: false,
      timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
      pollSeconds: DEFAULT_POLL_SECONDS,
      driftCheck: false,
      scope: provider === "kind" ? "smoke" : "full",
      scopeExplicit: false,
      runtime,
      ephemeralVaultInit: false,
    },
  };
}

function readFlagValue(argv: readonly string[], index: number, flag: string, description: string): ParseStringResult {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("-")) {
    return { ok: false, failure: usageFailure(`${flag} requires ${description}`) };
  }
  return { ok: true, value };
}

function assignStringFlag(options: MutableCliOptions, flag: string, value: string): void {
  if (flag === "--git-ref") options.gitRef = value;
  if (flag === "--cluster-name") options.clusterName = value;
  if (flag === "--config") {
    options.configPath = value;
    options.configExplicit = true;
  }
}

function assignIntegerFlag(options: MutableCliOptions, flag: string, value: number): void {
  if (flag === "--timeout-sec") options.timeoutSeconds = value;
  if (flag === "--poll-sec") options.pollSeconds = value;
}

function parseStringFlag(argv: readonly string[], index: number, options: MutableCliOptions): ParseArgResult {
  const flag = argv[index] ?? "";
  const description = flag === "--config" ? "a repo-relative path" : "a value";
  const parsed = readFlagValue(argv, index, flag, description);
  if (!parsed.ok) return parsed;
  assignStringFlag(options, flag, parsed.value);
  return { ok: true, nextIndex: index + 2 };
}

function parseIntegerFlag(argv: readonly string[], index: number, options: MutableCliOptions): ParseArgResult {
  const flag = argv[index] ?? "";
  const value = readFlagValue(argv, index, flag, "a value");
  if (!value.ok) return value;
  const parsed = parsePositiveInteger(value.value, flag);
  if (!parsed.ok) return parsed;
  assignIntegerFlag(options, flag, parsed.value);
  return { ok: true, nextIndex: index + 2 };
}

function parseProviderFlag(argv: readonly string[], index: number, options: MutableCliOptions): ParseArgResult {
  const parsed = readFlagValue(argv, index, "--provider", "k3d or kind");
  if (!parsed.ok) return parsed;
  if (!isProvider(parsed.value)) {
    return { ok: false, failure: usageFailure(`unsupported provider: ${parsed.value}`) };
  }
  options.provider = parsed.value;
  return { ok: true, nextIndex: index + 2 };
}

function parseScopeFlag(argv: readonly string[], index: number, options: MutableCliOptions): ParseArgResult {
  const parsed = readFlagValue(argv, index, "--scope", "smoke, included, or full");
  if (!parsed.ok) return parsed;
  if (!isScope(parsed.value)) {
    return { ok: false, failure: usageFailure(`unsupported scope: ${parsed.value}`) };
  }
  options.scope = parsed.value;
  options.scopeExplicit = true;
  return { ok: true, nextIndex: index + 2 };
}

function parseRuntimeFlag(argv: readonly string[], index: number, options: MutableCliOptions): ParseArgResult {
  const parsed = readFlagValue(argv, index, "--runtime", "docker or podman");
  if (!parsed.ok) return parsed;
  if (!isContainerRuntime(parsed.value)) {
    return { ok: false, failure: usageFailure(`unsupported runtime: ${parsed.value}`) };
  }
  options.runtime = parsed.value;
  return { ok: true, nextIndex: index + 2 };
}

function parseArg(argv: readonly string[], index: number, options: MutableCliOptions): ParseArgResult {
  const arg = argv[index] ?? "";
  const mode = MODE_FLAGS[arg];
  if (mode !== undefined) {
    options.mode = mode;
    return { ok: true, nextIndex: index + 1 };
  }
  if (arg === "--provider") return parseProviderFlag(argv, index, options);
  if (arg === "--scope") return parseScopeFlag(argv, index, options);
  if (arg === "--runtime") return parseRuntimeFlag(argv, index, options);
  if (STRING_FLAGS.has(arg)) return parseStringFlag(argv, index, options);
  if (INTEGER_FLAGS.has(arg)) return parseIntegerFlag(argv, index, options);
  if (arg === "--existing") {
    options.existing = true;
    return { ok: true, nextIndex: index + 1 };
  }
  if (arg === "--drift-check") {
    options.driftCheck = true;
    return { ok: true, nextIndex: index + 1 };
  }
  if (arg === "--ephemeral-vault-init") {
    options.ephemeralVaultInit = true;
    return { ok: true, nextIndex: index + 1 };
  }
  if (arg === "--help" || arg === "-h") {
    return { ok: false, failure: usageFailure(HELP_TEXT) };
  }
  return { ok: false, failure: usageFailure(`unknown argument: ${arg}`) };
}

function validateOptions(options: CliOptions): Failure | null {
  if (!isSafeGitRef(options.gitRef)) {
    return usageFailure(
      "git ref must match [A-Za-z0-9._/-]+ and cannot be absolute, empty, end with '/', or contain '//'",
    );
  }
  if (options.clusterName !== null && !DNS_LABEL_PATTERN.test(options.clusterName)) {
    return usageFailure("cluster name must be a DNS label");
  }
  if (options.provider === "k3d" && options.runtime === "podman") {
    return usageFailure("k3d + podman is not wired yet; use --provider kind --runtime podman for the Podman lane");
  }
  if (options.provider === "kind" && options.scope === "full") {
    return usageFailure(
      "kind provider supports smoke or included scope; use --scope included or --provider k3d for full",
    );
  }
  if (options.ephemeralVaultInit && options.existing) {
    return usageFailure(
      "--ephemeral-vault-init cannot be combined with --existing: the ceremony is authorised only for a " +
        "cluster this process creates and destroys. See ephemeral-vault-init.ts and vault/TOPOLOGY.md section 5.",
    );
  }
  if (options.ephemeralVaultInit && options.mode !== "run") {
    return usageFailure("--ephemeral-vault-init requires --run");
  }
  const configFile = basename(options.configPath).toLowerCase();
  if (options.provider === "kind" && configFile.includes("k3d")) {
    return usageFailure("kind provider requires a kind config; got a k3d config path");
  }
  if (options.provider === "k3d" && configFile.includes("kind")) {
    return usageFailure("k3d provider requires a k3d config; got a kind config path");
  }
  return null;
}

function normalizeProviderDefaults(options: MutableCliOptions): void {
  if (!options.configExplicit && options.provider === "kind" && options.configPath === DEFAULT_K3D_CONFIG) {
    options.configPath = DEFAULT_KIND_CONFIG;
  }
  if (!options.scopeExplicit && options.provider === "kind" && options.scope === "full") {
    options.scope = "smoke";
  }
}

export function parseArgs(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): CliOptions | Failure {
  const defaulted = defaultCliOptions(env);
  if (!defaulted.ok) return defaulted.failure;
  const options = defaulted.value;
  let index = 0;
  while (index < argv.length) {
    const parsed = parseArg(argv, index, options);
    if (!parsed.ok) return parsed.failure;
    index = parsed.nextIndex;
  }

  normalizeProviderDefaults(options);
  const failure = validateOptions(options);
  return failure ?? options;
}

export function parseK3dClusterName(configText: string): string | null {
  const lines = configText.split("\n");
  let inMetadata = false;
  for (const line of lines) {
    if (/^metadata:\s*$/.test(line)) {
      inMetadata = true;
      continue;
    }
    if (inMetadata && /^[A-Za-z]/.test(line)) {
      return null;
    }
    const match = inMetadata ? K3D_CLUSTER_NAME_PATTERN.exec(line) : null;
    if (match !== null) return match[1] ?? null;
  }
  return null;
}

/**
 * Read `metadata.name` with a real YAML parser (081M00QCNYM087G0R000ZS3CE2).
 *
 * This used to be a line regex anchored after a `metadata:` line. On every
 * manifest currently in the tree the regex and a real parse agree (measured
 * 2026-08-16: 46 Application.yaml files, 0 disagreements), so this is a
 * defect-CLASS fix, not a live wrong answer — the same class PR #10647 removed
 * from infra/k8s/tests/validate-applications.ts. The regex takes the first
 * `name:` at any indentation inside `metadata:`, so a nested block that carries
 * its own `name` key (`labels:`, `ownerReferences:`) silently wins over the
 * real one, and a quoted or flow-mapped name is missed entirely.
 */
export function parseApplicationName(yamlText: string): string | null {
  let document: unknown;
  try {
    document = parseYaml(yamlText);
  } catch {
    return null;
  }
  if (typeof document !== "object" || document === null) return null;
  const metadata = (document as { metadata?: unknown }).metadata;
  if (typeof metadata !== "object" || metadata === null) return null;
  const name = (metadata as { name?: unknown }).name;
  return typeof name === "string" && name.length > 0 ? name : null;
}

export function discoverExpectedApplications(repoRoot = REPO_ROOT): readonly ExpectedApplication[] {
  // Read the substrate condition ONCE for the whole roster: it is a property of
  // the repo, not of any one Application, and re-reading it per directory would
  // let two Applications in the same run disagree about whether dev has a
  // `longhorn` StorageClass.
  const aliasDeclared = devLonghornStorageClassAliasDeclared(repoRoot);
  const appsDir = resolve(repoRoot, "full-ai-cluster/k8s/applications");
  const dirs = readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(stringCompare);

  return dirs.flatMap((dir) => {
    const appPath = join(appsDir, dir, "Application.yaml");
    if (!existsSync(appPath)) return [];
    const appText = readFileSync(appPath, "utf8");
    const name = parseApplicationName(appText);
    if (name === null) {
      throw new Error(`Application name not found: ${appPath}`);
    }
    const appDir = join(appsDir, dir);
    return [
      {
        dir,
        name,
        path: appPath.slice(repoRoot.length + 1),
        excludedFromDev: isExcludedFromIncludedProof(dir, appText, appDir, aliasDeclared),
        manualSync: classifySyncPolicy(appText).kind === "manual",
      },
    ];
  });
}

function readClusterNameFromConfig(configPath: string): ParseStringResult {
  const absConfig = resolve(REPO_ROOT, configPath);
  if (!existsSync(absConfig)) {
    return { ok: false, failure: usageFailure(`k3d config not found: ${configPath}`) };
  }
  const parsed = parseK3dClusterName(readFileSync(absConfig, "utf8"));
  if (parsed === null) {
    return { ok: false, failure: usageFailure(`metadata.name not found in k3d config: ${configPath}`) };
  }
  return { ok: true, value: parsed };
}

function resolveClusterName(options: CliOptions): ParseStringResult {
  if (options.clusterName !== null) {
    return { ok: true, value: options.clusterName };
  }
  if (options.provider === "kind") {
    return { ok: true, value: "zeta-ci" };
  }
  return readClusterNameFromConfig(options.configPath);
}

export function buildPlan(options: CliOptions, repoRoot = REPO_ROOT): HarnessPlan | Failure {
  const clusterName = resolveClusterName(options);
  if (!clusterName.ok) return clusterName.failure;

  let expectedApplications: readonly ExpectedApplication[];
  try {
    expectedApplications = discoverExpectedApplications(repoRoot);
  } catch (error) {
    return {
      kind: "ApplicationManifestInvalid",
      message: "failed to discover expected ArgoCD Applications from full-ai-cluster/k8s/applications",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  return {
    rowId: "081KSXN940008QG0R000SCP2H1",
    mode: options.mode,
    provider: options.provider,
    clusterName: clusterName.value,
    gitRef: options.gitRef,
    configPath: options.configPath,
    scope: options.scope,
    runtime: options.runtime,
    expectedApplications,
    checks: [
      "preflight named dependencies: container runtime, provider CLI, kubectl, helm",
      "bootstrap or select ephemeral cluster",
      "wait for argocd namespace and ArgoCD control-plane readiness",
      "wait for applications.argoproj.io CRD establishment",
      ...(isIncludedScope(options.scope)
        ? [
            `assert the dev alias StorageClass "${DEV_LONGHORN_ALIAS_CLASS_NAME}" the repo declares is actually present, before anything waits on a PVC that needs it`,
            ...DEV_BOOTSTRAP_SECRETS.map(
              (spec) =>
                `assert the dev credential ${spec.namespace}/${spec.name} the bring-up mints is actually present, before its Application waits on a Secret that must pre-exist`,
            ),
          ]
        : []),
      "assert root App-of-Apps exists",
      options.scope === "smoke"
        ? "assert smoke anchors and a broad child Application graph"
        : isIncludedScope(options.scope)
          ? "assert every non-excluded dev Application is Synced and Healthy; a declared manual-sync app must instead exist, compare cleanly, and not be Degraded"
          : "assert expected dev Applications are Healthy/Synced",
      "optional safe drift-repair check through root App-of-Apps self-heal",
    ],
    notes: [
      "081KSXN940008QG0R000SCP2H1 is separate from 081KSNY2Z0008QG0R0008PN7RQ; this harness does not test USB reformat retention.",
      "Dev health assertions exclude cilium, the Longhorn chart itself, GPU model-SERVING (ollama/vllm), ReadWriteMany claims, and apps deferred on a named blocker recorded in APPLIED_BUT_UNASSERTED_REASONS; k3d bootstraps Cilium directly and kind CI uses its default CNI.",
      "Longhorn-BACKED manifests are no longer storage-excluded: dev applies a StorageClass named longhorn over rancher.io/local-path (dev-cluster/manifests/longhorn.yaml), so those PVCs bind. MEASURED on run 32519516070: 6 of the 11 formerly-excluded apps reached Synced+Healthy (headscale, mimir, nats, oz, redis, tempo); the other 5 bound their volumes and then failed for named NON-storage defects, visible for the first time. TWO of those five are fixed as of 2026-08-21 and are PROVEN so by live run 32532470499 -- cockroachdb (the chart init Job moved out of ArgoCD PostSync, which deadlocks against the health it is needed to produce) and kube-prometheus-stack (Grafana admin Secret minted at bring-up). weaviate was asserted alongside them for a few hours and the same run refuted it: two `type: LoadBalancer` Services can never be Healthy on a kind node, a blocker independent of the render nondeterminism that was fixed. hindsight remains, on three independent blockers. Still excluded outright are ReadWriteMany claims, which no dev provisioner can serve, and the whole rule returns if that manifest is absent (081M0JXF6MS087G0R001HC34TM).",
      "ZETA_CONTAINER_RUNTIME is the repo-wide OCI runtime switch; use --runtime for one-off explicit harness runs.",
    ],
  };
}

export function architectureFailure(arch = process.arch): Failure | null {
  if (arch === "x64" || arch === "arm64") return null;
  return {
    kind: "UnsupportedArchitecture",
    message: `unsupported architecture: ${arch}; 081KSXN940008QG0R000SCP2H1 supports x86_64 and ARM64/aarch64`,
  };
}

interface CommandOutput {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly signal: NodeJS.Signals | null;
  readonly errorCode?: string;
}

function isFailure(value: unknown): value is Failure {
  const record = asRecord(value);
  return record !== null && typeof record.kind === "string" && typeof record.message === "string";
}

function kubectlFailure(message: string, args: readonly string[], result: CommandOutput): Failure {
  return {
    kind: "KubectlFailed",
    message,
    command: ["kubectl", ...args],
    detail: {
      stderr: result.stderr.slice(-2000),
      stdout: result.stdout.slice(-2000),
      errorCode: result.errorCode,
    },
  };
}

function kubectlJsonFailure(message: string, args: readonly string[], stdout: string, error: unknown): Failure {
  return {
    kind: "KubectlFailed",
    message,
    command: ["kubectl", ...args],
    detail: {
      stdout: stdout.slice(-2000),
      error: error instanceof Error ? error.message : String(error),
    },
  };
}

function runCommand(
  command: string,
  args: readonly string[],
  timeoutMs?: number,
  envOverride?: NodeJS.ProcessEnv,
): CommandOutput {
  // sonarjs/no-os-command-from-path suppression rationale: this harness
  // intentionally spawns local cluster CLIs (`docker`/`podman`, `kind`/`k3d`,
  // `kubectl`, `helm`) from PATH because those tools are the named dependency
  // surface under test. Commands are fixed constants, user-controlled values
  // are passed as argv elements, and git refs / cluster names / config-provider
  // pairings are validated before any live spawn.
  const result = spawnSync(command, [...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: envOverride === undefined ? process.env : { ...process.env, ...envOverride },
    maxBuffer: SPAWN_MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: timeoutMs,
  });
  const pipes = result as unknown as { readonly stdout: string | null; readonly stderr: string | null };
  const output = {
    status: result.status,
    stdout: pipes.stdout ?? "",
    stderr: pipes.stderr ?? "",
    signal: result.signal,
  };
  const errorCode = (result.error as NodeJS.ErrnoException | undefined)?.code;
  return errorCode === undefined ? output : { ...output, errorCode };
}

function checkTool(tool: ToolCheck["tool"], args: readonly string[]): ToolCheck {
  const result = runCommand(tool, args, 15_000);
  const ok = result.status === 0;
  const text = (ok ? result.stdout : result.stderr || result.stdout).trim();
  return {
    tool,
    ok,
    detail: ok ? firstLine(text) : firstLine(text) || "not found or not executable",
  };
}

function firstLine(text: string): string {
  return (
    text
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim() ?? ""
  );
}

export function runPreflight(provider: Provider, runtime: ContainerRuntime): readonly ToolCheck[] {
  const checks: ToolCheck[] = [
    runtime === "docker"
      ? checkTool("docker", ["version", "--format", "{{.Server.Version}}"])
      : checkTool("podman", ["version"]),
    checkTool("kubectl", ["version", "--client=true", "--output=yaml"]),
    checkTool("helm", ["version", "--short"]),
    checkTool(provider, ["version"]),
  ];

  const runtimeOk = checks[0]?.ok === true;
  if (runtimeOk) {
    const infoArgs =
      runtime === "docker"
        ? ["info", "--format", "{{json .ServerVersion}}"]
        : ["info", "--format", "{{.Host.OCIRuntime.Name}} {{.Host.Arch}} {{.Host.OS}}"];
    const info = runCommand(runtime, infoArgs, 15_000);
    if (info.status !== 0) {
      checks[0] = {
        tool: runtime,
        ok: false,
        detail: firstLine(info.stderr || info.stdout) || `${runtime} CLI present but runtime unavailable`,
      };
    }
  }

  return checks;
}

function isRuntimeUnavailable(detail: string): boolean {
  const normalized = detail.toLowerCase();
  return (
    normalized.includes("unavailable") ||
    normalized.includes("cannot connect to the docker daemon") ||
    normalized.includes("is the docker daemon running") ||
    normalized.includes("connection refused") ||
    normalized.includes("podman machine") ||
    normalized.includes("cannot connect to podman")
  );
}

export function preflightFailure(preflight: readonly ToolCheck[]): Failure | null {
  const missing = preflight.find((check) => !check.ok);
  if (missing === undefined) return null;
  if ((missing.tool === "docker" || missing.tool === "podman") && isRuntimeUnavailable(missing.detail)) {
    return {
      kind: "ContainerRuntimeUnavailable",
      message: `${missing.tool} is unavailable: ${missing.detail}`,
      detail: missing,
    };
  }
  return {
    kind: "MissingTool",
    message: `${missing.tool} is required for 081KSXN940008QG0R000SCP2H1 ArgoCD health tests: ${missing.detail}`,
    detail: missing,
  };
}

function runOrFail(
  command: string,
  args: readonly string[],
  failureKind: FailureKind,
  timeoutSeconds: number,
  envOverride?: NodeJS.ProcessEnv,
): Failure | null {
  const result = runCommand(command, args, timeoutSeconds * 1000, envOverride);
  if (result.status === 0) return null;
  const signal = result.signal === null ? "" : ` signal ${result.signal}`;
  return {
    kind: failureKind,
    message: `${command} ${args.join(" ")} failed with exit ${String(result.status)}${signal}`,
    command: [command, ...args],
    detail: {
      stdout: result.stdout.slice(-4000),
      stderr: result.stderr.slice(-4000),
      errorCode: result.errorCode,
    },
  };
}

async function waitFor(
  timeoutSeconds: number,
  pollSeconds: number,
  action: () => Failure | null,
): Promise<Failure | null> {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let lastFailure: Failure | null = null;
  while (Date.now() <= deadline) {
    lastFailure = action();
    if (lastFailure === null) return null;
    await Bun.sleep(pollSeconds * 1000);
  }
  return lastFailure;
}

function kubectl(args: readonly string[], timeoutSeconds: number): CommandOutput {
  return runCommand("kubectl", args, timeoutSeconds * 1000);
}

function waitForKubectl(
  args: readonly string[],
  timeoutSeconds: number,
  pollSeconds: number,
  message: string,
): Promise<Failure | null> {
  return waitFor(timeoutSeconds, pollSeconds, () => {
    const result = kubectl(args, Math.max(pollSeconds, 10));
    if (result.status === 0) return null;
    return {
      kind: "ArgoCdTimeout",
      message,
      command: ["kubectl", ...args],
      detail: {
        stdout: result.stdout.slice(-2000),
        stderr: result.stderr.slice(-2000),
      },
    };
  });
}

function bootstrapCluster(plan: HarnessPlan, options: CliOptions): Failure | null {
  if (options.provider === "kind") {
    if (options.existing) {
      return runOrFail("kubectl", ["config", "use-context", `kind-${plan.clusterName}`], "KubectlFailed", 30);
    }
    try {
      bootstrapKindClusterInProcess({
        configPath: options.configPath,
        clusterName: plan.clusterName,
        gitRef: options.gitRef,
        containerRuntime: options.runtime,
      });
      return null;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        kind: "ClusterBootstrapFailed",
        message: `kind bootstrap failed: ${message}`,
        detail: { provider: "kind", clusterName: plan.clusterName },
      };
    }
  }
  if (options.existing) {
    return runOrFail("kubectl", ["config", "use-context", `k3d-${plan.clusterName}`], "KubectlFailed", 30);
  }
  try {
    bootstrapK3dClusterInProcess({
      configPath: options.configPath,
      gitRef: options.gitRef,
    });
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      kind: "ClusterBootstrapFailed",
      message: `k3d bootstrap failed: ${message}`,
      detail: { provider: "k3d", clusterName: plan.clusterName },
    };
  }
}

/**
 * The LIVE half of the substrate condition (081M0JXF6MS087G0R001HC34TM).
 *
 * `devLonghornStorageClassAliasDeclared` reads the repo and answers "did we
 * PROMISE dev a `longhorn` StorageClass". This answers "is it actually THERE",
 * and the gap between those two questions is the whole reason this function
 * exists. The repo can declare the alias while bring-up fails to apply it --
 * the manifest gets renamed, the apply call gets dropped in a refactor, the
 * kubectl apply silently no-ops against a context that is not the cluster under
 * test. In every one of those cases the harness would go on to ASSERT
 * Applications whose PVCs can never bind -- and an unbound PVC does not fail.
 * ArgoCD reports a pending PVC as Progressing, never Degraded, so the run burns
 * the full 2400s and then names the SYMPTOM ("still Progressing") rather than
 * the cause; and if the job's 60-minute cap trips first there is no verdict at
 * all. Three seconds and the right noun is strictly better than either.
 *
 * THE PROVISIONER IS COMPARED, not just the name. `kubectl get storageclass
 * longhorn` exits 0 for a class bound to `driver.longhorn.io` too -- which is
 * exactly the class a kind node cannot run. Checking only existence would let
 * both halves of the substrate condition pass while nothing can provision.
 *
 * Scoped to `included`/`full` because `smoke` asserts a floor of Applications
 * and never depends on the alias.
 */
function assertDevStorageClassPresent(plan: HarnessPlan): Failure | null {
  if (!isIncludedScope(plan.scope)) return null;
  if (!devLonghornStorageClassAliasDeclared()) return null;
  const args = ["get", "storageclass", DEV_LONGHORN_ALIAS_CLASS_NAME, "-o", "jsonpath={.provisioner}"];
  const result = runCommand("kubectl", args, 60_000);
  const provisioner = result.stdout.trim();
  const satisfiable = result.status === 0 && DEV_SATISFIABLE_PROVISIONERS.has(provisioner);
  if (satisfiable) return null;
  const cause =
    result.status === 0
      ? `it is bound to provisioner "${provisioner}", which this lane cannot run`
      : "it is not present";
  return {
    kind: "DevStorageClassMissing",
    message:
      `${DEV_STORAGE_ALIAS_MANIFEST_RELPATHS.longhorn} declares a dev StorageClass named ` +
      `"${DEV_LONGHORN_ALIAS_CLASS_NAME}" over ${[...DEV_SATISFIABLE_PROVISIONERS].join("/")}, and the ` +
      `included proof asserts Applications that request it, but in cluster ${plan.clusterName} ${cause}. ` +
      `Those PVCs would stay Pending, which ArgoCD reports as Progressing rather than Degraded, so the run ` +
      `would burn its whole timeout instead of failing. Failing now instead. Check that the bring-up path ` +
      `still applies the alias manifest.`,
    command: ["kubectl", ...args],
    detail: {
      stdout: result.stdout.slice(-2000),
      stderr: result.stderr.slice(-2000),
      clusterName: plan.clusterName,
      observedProvisioner: provisioner,
    },
  };
}

/**
 * The LIVE half of lifting `kube-prometheus-stack` and `oz` out of the deferred
 * set.
 *
 * `applyDevBootstrapSecrets` mints `monitoring/grafana-admin-credentials` and
 * `openziti/ziti-admin-credentials` at bring-up, and `use-cases.test.ts` proves
 * the loop is wired into all three doors. Neither of those observes a CLUSTER.
 * If a Secret is absent anyway -- a bring-up that predates this change, an
 * `--existing` run against a hand-built cluster, a kubectl apply that silently
 * failed -- the consuming pod returns to `CreateContainerConfigError`, ArgoCD
 * reports its Deployment as Progressing, and the proof burns its whole 2400s
 * and reports a symptom instead of a cause.
 *
 * So this refuses in seconds and NAMES the missing object, exactly as
 * `assertDevStorageClassPresent` does for the StorageClass. Same shape, same
 * reason: the repo-side and code-side claims are about the repo and the code;
 * only this one is about the cluster the assertions will actually run against.
 *
 * IT WALKS THE ROSTER rather than naming two Secrets, so a third entry in
 * `DEV_BOOTSTRAP_SECRETS` is checked here without an edit. A per-Secret list
 * here that drifted from the mint's list would be the half-wiring this file
 * keeps catching elsewhere.
 *
 * Scoped to included/full, because the smoke roster asserts neither Application
 * and has no business failing on their credentials.
 */
function devBootstrapSecretFailure(plan: HarnessPlan, spec: DevBootstrapSecretSpec): Failure | null {
  const { namespace, name } = spec;
  const args = ["get", "secret", name, "-n", namespace, "-o", "name"];
  const result = runCommand("kubectl", args, 60_000);
  if (result.status === 0) return null;
  return {
    kind: "DevBootstrapSecretMissing",
    message:
      `An Application in this lane is configured to read an admin credential from an EXISTING Secret ` +
      `"${name}", so its chart never mints one and kubelet cannot start the pod without it. The dev/CI ` +
      `bring-up mints it into namespace "${namespace}", but in cluster ${plan.clusterName} it is not ` +
      `present. The pod would sit in CreateContainerConfigError, which ArgoCD reports as Progressing ` +
      `rather than Degraded, so the run would burn its whole timeout instead of failing. Failing now ` +
      `instead. Check that the bring-up path still calls applyDevBootstrapSecrets before the app-of-apps ` +
      `root, and that ${namespace}/${name} is still in DEV_BOOTSTRAP_SECRETS.`,
    command: ["kubectl", ...args],
    detail: {
      stdout: result.stdout.slice(-2000),
      stderr: result.stderr.slice(-2000),
      clusterName: plan.clusterName,
      secretNamespace: namespace,
      secretName: name,
    },
  };
}

/**
 * Refuse an included run that will sync `platform` into a cluster holding no
 * GHCR pull credential.
 *
 * SAME SHAPE, SAME REASON as `assertDevBootstrapSecretsPresent` above, one
 * failure mode over. There the Secret is read by `secretKeyRef` and its absence
 * is `CreateContainerConfigError`; here it is read by `imagePullSecrets` and its
 * absence is `ImagePullBackOff`. ArgoCD reports BOTH as `Progressing` rather
 * than `Degraded`, so in both cases a run without this check burns its entire
 * timeout and then reports the symptom instead of the cause.
 *
 * THE GATE IS THE GLOB, NOT A DATE OR A FLAG. This asserts nothing while
 * `platform/**` sits in `DEFAULT_ROOT_DEV_CATALOG.excludeGlob`, because the
 * Application never reaches the cluster and demanding its credential would fail
 * every current run for a workload nobody synced. The moment that glob entry is
 * removed -- the very edit that lifts the deferral -- this check starts biting,
 * with no second edit required. A check wired to fire only after somebody
 * remembers to enable it is the half-wiring this file exists to catch, and a
 * check that can never fire is the vacuity class; deriving the gate from the
 * glob is what avoids both.
 *
 * IT IS DELIBERATELY NOT ON THE `DEV_BOOTSTRAP_SECRETS` WALK. Those are drawn
 * per cluster and their mint cannot fail, so their absence is always a defect.
 * This one is sourced from the environment and a bring-up that legitimately had
 * no token skipped it on purpose (see `applyDevRegistryPullSecret`) -- so the
 * absence is a defect HERE, at the point where a run is about to assert the
 * Application, and nowhere earlier.
 */
function assertDevRegistryPullSecretPresent(plan: HarnessPlan): Failure | null {
  if (!isIncludedScope(plan.scope)) return null;
  if (rootDevCatalogExcludedDirs().has(PLATFORM_APP_DIR)) return null;
  const { namespace, name, tokenEnvVars } = DEV_GHCR_PULL_SECRET;
  const args = ["get", "secret", name, "-n", namespace, "-o", "name"];
  const result = runCommand("kubectl", args, 60_000);
  if (result.status === 0) return null;
  return {
    kind: "DevRegistryPullSecretMissing",
    message:
      `The \`${PLATFORM_APP_DIR}\` Application runs images from PRIVATE GHCR packages and its pod specs ` +
      `reference imagePullSecrets "${name}", but that Secret is not present in namespace "${namespace}" ` +
      `of cluster ${plan.clusterName}. The kubelet would fall back to an anonymous pull, GHCR would answer ` +
      `HTTP 401, and the pods would sit in ImagePullBackOff -- which ArgoCD reports as Progressing rather ` +
      `than Degraded, so this run would burn its whole timeout and report the symptom instead of the ` +
      `cause. Failing now instead. The dev/CI bring-up mints it via applyDevRegistryPullSecret, which ` +
      `SKIPS when no token is in scope: check that one of ${tokenEnvVars.join(", ")} is set for the ` +
      `bring-up step, and that the job grants \`packages: read\` so the token can actually pull.`,
    command: ["kubectl", ...args],
    detail: {
      stdout: result.stdout.slice(-2000),
      stderr: result.stderr.slice(-2000),
      clusterName: plan.clusterName,
      secretNamespace: namespace,
      secretName: name,
      tokenEnvVars: [...tokenEnvVars],
    },
  };
}

function assertDevBootstrapSecretsPresent(plan: HarnessPlan): Failure | null {
  if (!isIncludedScope(plan.scope)) return null;
  for (const spec of DEV_BOOTSTRAP_SECRETS) {
    const failure = devBootstrapSecretFailure(plan, spec);
    if (failure !== null) return failure;
  }
  return null;
}

const ZETA_GITHUB_REPO_MARKER = "Lucent-Financial-Group/Zeta";

export function isZetaGitDirectoryApplicationSource(source: Record<string, unknown>): boolean {
  if (stringAt(source, "chart").length > 0) return false;
  const repoURL = stringAt(source, "repoURL");
  const path = stringAt(source, "path");
  if (!repoURL.includes(ZETA_GITHUB_REPO_MARKER)) return false;
  return path.startsWith("full-ai-cluster/k8s/applications");
}

function patchGitBackedApplicationsToGitRef(gitRef: string): Failure | null {
  if (gitRef === "main") return null;
  const command = ["-n", "argocd", "get", "applications.argoproj.io", "-o", "json"];
  const result = kubectl(command, 30);
  if (result.status !== 0) {
    return kubectlFailure("could not list ArgoCD Applications for git-ref patch", command, result);
  }
  const root = asRecord(JSON.parse(result.stdout));
  const items = Array.isArray(root?.items) ? root.items : [];
  for (const item of items) {
    const itemRecord = asRecord(item);
    const metadata = itemRecord ? recordAt(itemRecord, "metadata") : null;
    const spec = itemRecord ? recordAt(itemRecord, "spec") : null;
    const source = spec ? recordAt(spec, "source") : null;
    const name = metadata ? stringAt(metadata, "name") : "";
    if (name.length === 0 || source === null || !isZetaGitDirectoryApplicationSource(source)) continue;
    const currentRevision = stringAt(source, "targetRevision");
    if (currentRevision === gitRef) continue;
    const patch = JSON.stringify({ spec: { source: { targetRevision: gitRef } } });
    const patchFailure = runOrFail(
      "kubectl",
      ["-n", "argocd", "patch", "application", name, "--type=merge", "-p", patch],
      "KubectlFailed",
      30,
    );
    if (patchFailure !== null) return patchFailure;
  }
  return null;
}

async function waitForArgoCd(plan: HarnessPlan, options: CliOptions): Promise<Failure | null> {
  const timeout = options.timeoutSeconds;
  const poll = options.pollSeconds;

  const namespace = await waitForKubectl(
    ["get", "namespace", "argocd"],
    timeout,
    poll,
    "timed out waiting for argocd namespace",
  );
  if (namespace !== null) return namespace;

  const crd = runOrFail(
    "kubectl",
    ["wait", "--for=condition=Established", "--timeout=120s", "crd/applications.argoproj.io"],
    "ArgoCdTimeout",
    130,
  );
  if (crd !== null) return crd;

  const rolloutTargets: readonly (readonly string[])[] = [
    ["-n", "argocd", "rollout", "status", "deployment/argocd-server", "--timeout=180s"],
    ["-n", "argocd", "rollout", "status", "deployment/argocd-repo-server", "--timeout=180s"],
    ["-n", "argocd", "rollout", "status", "statefulset/argocd-application-controller", "--timeout=180s"],
  ];
  for (const target of rolloutTargets) {
    const failure = runOrFail("kubectl", target, "ArgoCdTimeout", 190);
    if (failure !== null) return failure;
  }

  const rootFailure = await waitForKubectl(
    ["-n", "argocd", "get", "application", "zeta-root-dev"],
    timeout,
    poll,
    `timed out waiting for zeta-root-dev root Application in ${plan.clusterName}`,
  );
  if (rootFailure !== null) return rootFailure;

  if (plan.gitRef === "main") return null;

  const childFailure = await waitForKubectl(
    ["-n", "argocd", "get", "application", "hat-system"],
    timeout,
    poll,
    "timed out waiting for repo-backed child Applications before git-ref patch",
  );
  if (childFailure !== null) return childFailure;

  return patchGitBackedApplicationsToGitRef(plan.gitRef);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringAt(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function recordAt(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  return asRecord(record[key]);
}

export function parseApplicationList(jsonText: string): readonly ArgoApplicationSnapshot[] {
  const root = asRecord(JSON.parse(jsonText));
  const items = Array.isArray(root?.items) ? root.items : [];
  return items.flatMap((item) => {
    const itemRecord = asRecord(item);
    const metadata = itemRecord ? recordAt(itemRecord, "metadata") : null;
    const status = itemRecord ? recordAt(itemRecord, "status") : null;
    const sync = status ? recordAt(status, "sync") : null;
    const health = status ? recordAt(status, "health") : null;
    const operationState = status ? recordAt(status, "operationState") : null;
    const name = metadata ? stringAt(metadata, "name") : "";
    if (name.length === 0) return [];
    const operationPhase = operationState ? stringAt(operationState, "phase") : "";
    const syncRevision = sync ? stringAt(sync, "revision") : "";
    const snapshot: ArgoApplicationSnapshot = {
      name,
      syncStatus: sync ? stringAt(sync, "status") : "",
      healthStatus: health ? stringAt(health, "status") : "",
      message: health ? stringAt(health, "message") : "",
      ...(operationPhase.length > 0 ? { operationPhase } : {}),
      ...(syncRevision.length > 0 ? { syncRevision } : {}),
    };
    return [snapshot];
  });
}

function parseApplicationListOrFailure(
  jsonText: string,
  command: readonly string[],
): readonly ArgoApplicationSnapshot[] | Failure {
  try {
    return parseApplicationList(jsonText);
  } catch (error) {
    return kubectlJsonFailure("could not parse ArgoCD Application list JSON", command, jsonText, error);
  }
}

function parseApplicationObjectOrFailure(
  jsonText: string,
  command: readonly string[],
): Record<string, unknown> | Failure {
  try {
    const application = asRecord(JSON.parse(jsonText));
    if (application !== null) return application;
    return kubectlJsonFailure(
      "could not parse ArgoCD Application JSON",
      command,
      jsonText,
      "kubectl returned non-object JSON",
    );
  } catch (error) {
    return kubectlJsonFailure("could not parse ArgoCD Application JSON", command, jsonText, error);
  }
}

export function isApplicationSynced(snapshot: ArgoApplicationSnapshot): boolean {
  if (snapshot.syncStatus === "Synced") return true;
  // Helm apps with benign StatefulSet drift often stay OutOfSync while Healthy after a successful sync.
  if (
    snapshot.syncStatus === "OutOfSync" &&
    snapshot.healthStatus === "Healthy" &&
    snapshot.operationPhase === "Succeeded"
  ) {
    return true;
  }
  // Git-directory apps (hat-system) with benign manifest drift stay OutOfSync while Healthy.
  if (
    snapshot.syncStatus === "OutOfSync" &&
    snapshot.healthStatus === "Healthy" &&
    snapshot.syncRevision !== undefined &&
    snapshot.syncRevision.length > 0
  ) {
    return true;
  }
  if (snapshot.syncStatus === "OutOfSync") return false;
  // Helm/OCI Applications often stay Unknown while Healthy after a successful sync.
  if (snapshot.syncStatus === "Unknown" && snapshot.healthStatus === "Healthy") {
    if (snapshot.operationPhase === "Succeeded") return true;
    if (snapshot.syncRevision !== undefined && snapshot.syncRevision.length > 0) return true;
    // kind CI: comparison status may lag while workloads are already Healthy.
    return true;
  }
  return false;
}

/**
 * THE ASSERTION SPLIT (2026-08-21).
 *
 * A declared manual-sync Application is asserted DIFFERENTLY, never skipped --
 * see ./manual-sync-policy.ts for the convention, the weaker contract, and what
 * that contract can and cannot still catch.
 *
 * Fail-closed twice over: expected.manualSync is true only for a WELL-FORMED
 * declaration (annotation + non-empty reason + no automated block), so a
 * malformed one keeps the full Synced+Healthy contract. Adding an app name to a
 * list is not a way in; the app has to say why, in its own manifest.
 */
export function applicationOutcome(expected: ExpectedApplication, snapshot: ArgoApplicationSnapshot): AssertionOutcome {
  if (expected.manualSync) return manualSyncAssertion(snapshot);
  const reconciled = isApplicationSynced(snapshot) ? snapshot.healthStatus === "Healthy" : false;
  if (reconciled) return { ok: true, reason: "" };
  const stated = snapshot.message === "" ? "expected Synced/Healthy" : snapshot.message;
  return { ok: false, reason: stated };
}

export function classifyApplications(
  expectedApplications: readonly ExpectedApplication[],
  snapshots: readonly ArgoApplicationSnapshot[],
): readonly ApplicationVerdict[] {
  const snapshotByName = new Map(snapshots.map((snapshot) => [snapshot.name, snapshot]));
  return expectedApplications
    .filter((app) => !app.excludedFromDev)
    .map((expected) => {
      const snapshot = snapshotByName.get(expected.name);
      if (snapshot === undefined) {
        return {
          name: expected.name,
          ok: false,
          syncStatus: "Missing",
          healthStatus: "Missing",
          reason: `Application not found; expected from ${expected.path}`,
        };
      }
      const outcome = applicationOutcome(expected, snapshot);
      const ok = outcome.ok;
      const base = {
        name: expected.name,
        ok,
        syncStatus: snapshot.syncStatus || "Unknown",
        healthStatus: snapshot.healthStatus || "Unknown",
      };
      return ok ? base : { ...base, reason: outcome.reason };
    });
}

function verdictFromSnapshot(
  name: string,
  snapshot: ArgoApplicationSnapshot | undefined,
  ok: (value: ArgoApplicationSnapshot) => boolean,
  missingReason: string,
  unhealthyReason: string,
): ApplicationVerdict {
  if (snapshot === undefined) {
    return {
      name,
      ok: false,
      syncStatus: "Missing",
      healthStatus: "Missing",
      reason: missingReason,
    };
  }
  const snapshotOk = ok(snapshot);
  const base = {
    name,
    ok: snapshotOk,
    syncStatus: snapshot.syncStatus || "Unknown",
    healthStatus: snapshot.healthStatus || "Unknown",
  };
  return snapshotOk ? base : { ...base, reason: snapshot.message || unhealthyReason };
}

export function classifySmokeApplications(
  snapshots: readonly ArgoApplicationSnapshot[],
): readonly ApplicationVerdict[] {
  const snapshotByName = new Map(snapshots.map((snapshot) => [snapshot.name, snapshot]));
  const childApplicationCount = snapshots.filter((snapshot) => snapshot.name !== "zeta-root-dev").length;
  const graphCountBase = {
    name: "child-application-count",
    ok: childApplicationCount >= SMOKE_MIN_APPLICATIONS,
    syncStatus: String(childApplicationCount),
    healthStatus: "Count",
  };
  const graphCountVerdict = graphCountBase.ok
    ? graphCountBase
    : {
        ...graphCountBase,
        reason: `expected at least ${String(SMOKE_MIN_APPLICATIONS)} child Applications from the root App-of-Apps`,
      };
  return [
    graphCountVerdict,
    verdictFromSnapshot(
      "zeta-root-dev",
      snapshotByName.get("zeta-root-dev"),
      (snapshot) => snapshot.healthStatus === "Healthy",
      "root App-of-Apps not found",
      "expected root App-of-Apps to be Healthy",
    ),
    verdictFromSnapshot(
      "argocd",
      snapshotByName.get("argocd"),
      (snapshot) => snapshot.healthStatus === "Healthy",
      "argocd self-management Application not found",
      "expected argocd self-management Application to be Healthy",
    ),
    verdictFromSnapshot(
      "cert-manager",
      snapshotByName.get("cert-manager"),
      (snapshot) => snapshot.healthStatus === "Healthy" || snapshot.healthStatus === "Progressing",
      "cert-manager Application not found",
      "expected cert-manager to exist and not be Degraded/Missing smoke anchor",
    ),
  ];
}

async function waitForApplications(
  plan: HarnessPlan,
  options: CliOptions,
): Promise<readonly ApplicationVerdict[] | Failure> {
  let lastVerdicts: readonly ApplicationVerdict[] = [];
  const failure = await waitFor(options.timeoutSeconds, options.pollSeconds, () => {
    const command = ["-n", "argocd", "get", "applications.argoproj.io", "-o", "json"];
    const result = kubectl(command, Math.max(options.pollSeconds, 10));
    if (result.status !== 0) {
      return kubectlFailure("could not list ArgoCD Applications", command, result);
    }
    const snapshots = parseApplicationListOrFailure(result.stdout, command);
    if (isFailure(snapshots)) return snapshots;
    lastVerdicts =
      plan.scope === "smoke"
        ? classifySmokeApplications(snapshots)
        : isIncludedScope(plan.scope)
          ? classifyApplications(plan.expectedApplications, snapshots)
          : classifyApplications(plan.expectedApplications, snapshots);
    if (lastVerdicts.every((verdict) => verdict.ok)) return null;
    return {
      kind: lastVerdicts.some((verdict) => verdict.syncStatus === "Missing")
        ? "ApplicationMissing"
        : "ApplicationUnhealthy",
      message:
        plan.scope === "smoke"
          ? "one or more ArgoCD smoke anchors did not become healthy"
          : isIncludedScope(plan.scope)
            ? "one or more included dev ArgoCD Applications are not Synced/Healthy"
            : "one or more expected ArgoCD Applications are not Synced/Healthy",
      detail: lastVerdicts.filter((verdict) => !verdict.ok),
    };
  });
  if (failure !== null) return failure;
  return lastVerdicts;
}

async function runDriftRepairCheck(options: CliOptions): Promise<Failure | null> {
  const appName = "argocd";
  const annotation = "zeta.io/argocd-health-drift-test";
  const stamp = new Date().toISOString().replace(/[.:]/g, "-");
  const patch = JSON.stringify({ metadata: { annotations: { [annotation]: stamp } } });
  const patchFailure = runOrFail(
    "kubectl",
    ["-n", "argocd", "patch", "application", appName, "--type=merge", "-p", patch],
    "KubectlFailed",
    30,
  );
  if (patchFailure !== null) return patchFailure;

  return waitFor(options.timeoutSeconds, options.pollSeconds, () => {
    const command = ["-n", "argocd", "get", "application", appName, "-o", "json"];
    const result = kubectl(command, Math.max(options.pollSeconds, 10));
    if (result.status !== 0) {
      return kubectlFailure("could not read ArgoCD Application drift state", command, result);
    }
    const application = parseApplicationObjectOrFailure(result.stdout, command);
    if (isFailure(application)) return application;
    const metadata = recordAt(application, "metadata");
    const annotations = metadata ? recordAt(metadata, "annotations") : null;
    const stillPresent = annotations?.[annotation] === stamp;
    if (!stillPresent) return null;
    return {
      kind: "DriftRepairTimeout",
      message: `ArgoCD did not remove ${annotation} drift from application/${appName} before timeout`,
      command: ["kubectl", "-n", "argocd", "get", "application", appName],
    };
  });
}

/**
 * Budget for "wait until vault-0 is up and reports SEALED".
 *
 * Bounded SEPARATELY from `--timeout-sec` and deliberately smaller. ArgoCD
 * reconciles asynchronously, so blocking here does not delay any other
 * Application -- but it does consume the 60-minute job cap, and a Vault that
 * never appears must surface as a named failure long before the cap turns the
 * run into "no verdict at all".
 */
const EPHEMERAL_VAULT_SEALED_WAIT_SECONDS = 900;

/**
 * Surfaces the key-material leak scan walks, on top of the in-memory transcript
 * and report.
 *
 * RUNNER_TEMP is where this job's `tee` writes `included-proof.log` -- the one
 * file in CI that receives our stdout verbatim. The `git status` paths are the
 * other realistic vector: anything a later step could commit. Both are computed
 * rather than assumed, and the count of what was actually opened is reported,
 * so a scan that found nothing because it walked nothing is visible as such.
 */
function ephemeralVaultScanRoots(): readonly string[] {
  const roots: string[] = [];
  const runnerTemp = process.env.RUNNER_TEMP;
  if (runnerTemp !== undefined && runnerTemp.length > 0) roots.push(runnerTemp);
  const dirty = runCommand("git", ["status", "--porcelain"], 30_000);
  if (dirty.status === 0) {
    for (const line of dirty.stdout.split("\n")) {
      const path = line.slice(3).trim();
      if (path.length > 0 && !path.includes("->")) roots.push(join(REPO_ROOT, path));
    }
  }
  return roots;
}

/**
 * The ephemeral Vault ceremony, run between "ArgoCD is up" and "assert every
 * Application". Returns null when it was not requested -- the harness behaves
 * exactly as it did before in that case, which keeps the opt-in honest.
 *
 * Placed BEFORE `waitForApplications` on purpose. Vault syncs at wave -60, the
 * earliest wave in the catalogue, so it is running long before the later
 * Applications settle; and because ArgoCD is reconciling the whole tree in the
 * background regardless of what this process is doing, the wait costs nothing
 * the run was not already spending.
 */
async function runEphemeralVaultInitStep(
  options: CliOptions,
  transcript: string,
): Promise<{ readonly report: EphemeralVaultInitReport | null; readonly failure: Failure | null }> {
  if (!options.ephemeralVaultInit) return { report: null, failure: null };

  const gate = ephemeralVaultInitGate({
    existingCluster: options.existing,
    provider: options.provider,
    requested: options.ephemeralVaultInit,
    teardownGuaranteed: !options.existing,
  });
  if (!gate.allowed) {
    return { report: null, failure: { kind: "EphemeralVaultInitFailed", message: gate.reason } };
  }

  const exec = kubectlVaultExec("vault", "vault-0");

  // TOPOLOGY.md section 5 step 1, as a WAIT: exit 2 is the sealed signal, and
  // it is also the only exit this loop accepts. A pod that is not there yet,
  // or a `kubectl exec` into a container that has not started, is neither exit
  // 2 nor a reason to proceed -- so the loop keeps waiting and, if the budget
  // runs out, fails naming the last exit code it saw rather than guessing.
  let lastStatus: number | null = null;
  const sealedFailure = await waitFor(EPHEMERAL_VAULT_SEALED_WAIT_SECONDS, options.pollSeconds, () => {
    lastStatus = exec(["status", "-format=json"]).status;
    if (lastStatus === 2) return null;
    return {
      kind: "EphemeralVaultInitFailed",
      message:
        `vault-0 never reported the sealed signal within ${String(EPHEMERAL_VAULT_SEALED_WAIT_SECONDS)}s ` +
        `(last \`vault status\` exit: ${String(lastStatus)}; TOPOLOGY.md section 5 step 1 wants 2)`,
    };
  });
  if (sealedFailure !== null) return { report: null, failure: sealedFailure };

  const logs = kubectl(["-n", "vault", "logs", "vault-0", "--tail=2000"], 60);

  const outcome = await runEphemeralVaultInit({
    exec,
    gate,
    scanRoots: ephemeralVaultScanRoots(),
    podLogs: `${logs.stdout}\n${logs.stderr}`,
    transcript,
    log: (line) => {
      console.log(line);
    },
  });
  if (outcome.ok) return { report: outcome.report, failure: null };
  return {
    report: outcome.report ?? null,
    failure: {
      kind: "EphemeralVaultInitFailed",
      message: `${outcome.failure.step}: ${outcome.failure.message}`,
      ...(outcome.failure.detail === undefined ? {} : { detail: outcome.failure.detail }),
    },
  };
}

/**
 * Spread helper. Under `exactOptionalPropertyTypes` an ABSENT field and a field
 * present-but-undefined are different types, and absent is the honest one here:
 * a run that did not request the ceremony should carry no ceremony key at all,
 * not a null one that reads like a ceremony which returned nothing.
 */
function vaultReportField(report: EphemeralVaultInitReport | null): {
  readonly ephemeralVaultInit?: EphemeralVaultInitReport;
} {
  return report === null ? {} : { ephemeralVaultInit: report };
}

export async function runHarness(options: CliOptions): Promise<HarnessResult> {
  const arch = architectureFailure();
  const plan = buildPlan(options);
  if (isFailure(plan)) return { ok: false, failure: plan };
  if (arch !== null) return { ok: false, plan, failure: arch };

  if (options.mode === "dry-run") {
    return { ok: true, plan };
  }

  const preflight = runPreflight(options.provider, options.runtime);
  const dependencyFailure = preflightFailure(preflight);
  if (dependencyFailure !== null) {
    return { ok: false, plan, preflight, failure: dependencyFailure };
  }
  if (options.mode === "preflight") {
    return { ok: true, plan, preflight };
  }

  const bootstrapFailure = bootstrapCluster(plan, options);
  if (bootstrapFailure !== null) {
    return { ok: false, plan, preflight, failure: bootstrapFailure };
  }

  const storageFailure = assertDevStorageClassPresent(plan);
  if (storageFailure !== null) {
    return { ok: false, plan, preflight, failure: storageFailure };
  }

  const bootstrapSecretFailure = assertDevBootstrapSecretsPresent(plan);
  if (bootstrapSecretFailure !== null) {
    return { ok: false, plan, preflight, failure: bootstrapSecretFailure };
  }

  const pullSecretFailure = assertDevRegistryPullSecretPresent(plan);
  if (pullSecretFailure !== null) {
    return { ok: false, plan, preflight, failure: pullSecretFailure };
  }

  const argoFailure = await waitForArgoCd(plan, options);
  if (argoFailure !== null) {
    return { ok: false, plan, preflight, failure: argoFailure };
  }

  const vault = await runEphemeralVaultInitStep(options, JSON.stringify(plan));
  if (vault.failure !== null) {
    return { ok: false, plan, preflight, ...vaultReportField(vault.report), failure: vault.failure };
  }

  const apps = await waitForApplications(plan, options);
  if (isFailure(apps)) {
    return { ok: false, plan, preflight, ...vaultReportField(vault.report), failure: apps };
  }

  if (options.driftCheck) {
    const driftFailure = await runDriftRepairCheck(options);
    if (driftFailure !== null) {
      return {
        ok: false,
        plan,
        preflight,
        applications: apps,
        ...vaultReportField(vault.report),
        driftRepair: "failed",
        failure: driftFailure,
      };
    }
    return {
      ok: true,
      plan,
      preflight,
      applications: apps,
      ...vaultReportField(vault.report),
      driftRepair: "passed",
    };
  }

  return {
    ok: true,
    plan,
    preflight,
    applications: apps,
    ...vaultReportField(vault.report),
    driftRepair: "not-requested",
  };
}

function exitCode(result: HarnessResult): 0 | 1 | 2 {
  if (result.ok) return 0;
  return result.failure.kind === "UsageError" ||
    result.failure.kind === "MissingTool" ||
    result.failure.kind === "ContainerRuntimeUnavailable" ||
    result.failure.kind === "UnsupportedProvider" ||
    result.failure.kind === "UnsupportedArchitecture"
    ? 2
    : 1;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if ("kind" in parsed) {
    console.log(JSON.stringify({ ok: false, rowId: "081KSXN940008QG0R000SCP2H1", failure: parsed }, null, 2));
    process.exit(2);
  }
  const result = await runHarness(parsed);
  console.log(JSON.stringify(result, null, 2));
  process.exit(exitCode(result));
}

if (import.meta.main) {
  await main();
}
