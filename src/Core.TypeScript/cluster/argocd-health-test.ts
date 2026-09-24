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
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --run --provider kind --cni cilium --scope included --git-ref main
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --run --provider k3d --git-ref main
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --run --existing --cluster-name zeta-dev
 *
 * Exit codes:
 *   0 - dry-run/preflight/run succeeded
 *   1 - health check failed after a cluster was reachable
 *   2 - usage error or named dependency/preflight failure
 */

import {
  applyRungOverrides,
  type ClusterSelection,
  loadOverrideDimensions,
  loadRungOverrides,
  validateSelection,
} from "./rung-overrides.ts";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { bootstrapKindClusterInProcess, bootstrapK3dClusterInProcess } from "./harness/bootstrap.ts";
import { listApplicationDirs, parseLaneDirs } from "./application-dirs.ts";
import {
  DEV_BOOTSTRAP_SECRETS,
  DEV_SHARED_SECRETS,
  type DevSharedSecretSpec,
  DEV_CILIUM_LB_KIND_MANIFEST_RELPATH,
  DEV_CILIUM_LB_KIND_POOL_NAME,
  DEV_GHCR_PULL_SECRET,
  DEV_SATISFIABLE_PROVISIONERS,
  DEV_STORAGE_ALIAS_CLASS_NAMES,
  DEV_STORAGE_ALIAS_MANIFEST_RELPATHS,
  type DevBootstrapSecretSpec,
} from "./dev-cluster/lib.ts";
import { DEFAULT_ROOT_DEV_CATALOG, ciliumOwnsCniSlot, type KindCni } from "./ports.ts";
import { buildLaneTreeBundle, laneTreeRepoUrl, SERVED_GIT_REF } from "./lane-tree-source.ts";
import {
  applyProfile,
  applyResourceProfile,
  loadCatalogue,
  loadResourceCatalogue,
  storageProfileForResourceRung,
} from "./storage-profiles.ts";
import { storageClassValues } from "./storage-capabilities.ts";
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
export type { KindCni };

export type FailureKind =
  | "UsageError"
  | "ApplicationManifestInvalid"
  | "UnsupportedArchitecture"
  | "UnsupportedProvider"
  | "MissingTool"
  | "ContainerRuntimeUnavailable"
  | "ClusterBootstrapFailed"
  | "DevStorageClassMissing"
  | "DevCiliumLbPoolMissing"
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
  /**
   * When true, `waitFor` returns this failure on the current poll instead of
   * retrying until timeout. Use for defects that cannot heal by waiting
   * (MEASURED run 33695849211: zeta-root-dev ComparisonError
   * `Could not resolve host: github.com` was already present at T+0 of the
   * 180s child wait).
   */
  readonly terminal?: boolean;
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
   * kind-only CNI. Default kindnetd. `cilium` selects the no-default-CNI
   * profile and helm-installs the shipped Cilium surface during bring-up so
   * the included proof does not need `--existing` (081M1DFQ2MZ).
   */
  readonly kindCni: KindCni;
  /**
   * Run the ephemeral Vault init+unseal ceremony against the cluster THIS
   * process created (`./ephemeral-vault-init.ts`). Opt-in only: never defaulted
   * on, and refused outright with `--existing`.
   */
  readonly ephemeralVaultInit: boolean;
  /**
   * Resource rung to SERVE to the lane, instead of syncing the committed tree.
   *
   * `null` -- the default -- syncs the committed tree, which is what every caller
   * did before this flag existed. A rung name builds a copy of
   * `full-ai-cluster/k8s` with that rung applied, serves it in-cluster, and points
   * ArgoCD there. Aaron 2026-09-03: "we don't have to test metal on our CI, metal
   * is for our real hardware, dev is for testing on our github runners."
   */
  readonly serveTreeProfile: string | null;
  /**
   * Scope the run to ONE lane: these Application directories are applied AND
   * asserted, every other directory is excluded from the root catalogue. `null`
   * -- the default -- is the whole roster, exactly as before this flag existed.
   * Apply and assert both derive from this one list (`application-dirs.ts`).
   */
  readonly laneDirs: readonly string[] | null;
  /**
   * Seconds to keep watching AFTER the all-Healthy verdict for a container
   * restartCount increase or an Application leaving Healthy/Synced -- "does
   * it crash-loop?", which the all-Healthy verdict alone cannot answer
   * (Task B, 081KSXN940008QG0R000SCP2H1). `0` -- the default -- disables the
   * soak phase entirely, so every caller that does not pass `--soak-sec` sees
   * no behaviour change.
   */
  readonly soakSeconds: number;
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

export interface ArgoApplicationCondition {
  readonly type: string;
  readonly message: string;
}

export interface ArgoApplicationSnapshot {
  readonly name: string;
  readonly syncStatus: string;
  readonly healthStatus: string;
  readonly message: string;
  readonly operationPhase?: string;
  readonly syncRevision?: string;
  readonly conditions?: readonly ArgoApplicationCondition[];
  /**
   * `spec.destination.namespace`. Used to attribute live pods to the
   * Application that owns them (see `podsBelongingToApplication` /
   * `081M...` evidence-based Degraded terminal logic below) -- ArgoCD
   * declares this on every Application object, it is always present the
   * moment the object exists (no comparison has to have run), and it does
   * not depend on a chart's own label conventions the way
   * `app.kubernetes.io/instance` does. `""` (or absent, for the many
   * hand-written test fixtures that predate this field) means a
   * cluster-scoped Application or simply "not measured here" -- callers
   * treat both the same way, via `snapshot.namespace ?? ""`.
   */
  readonly namespace?: string;
  /**
   * `${kind}/${name}` for every entry in `status.resources[]` whose own
   * `status` field is `"OutOfSync"` -- ArgoCD's per-resource diff verdict,
   * distinct from the Application-level `syncStatus` above (an Application can
   * be OutOfSync because of exactly one resource, or several; this is which
   * ones). Ordinal-sorted (`.claude/rules/culture-invariant-by-default.md`) so
   * the list a failure message prints is deterministic across runs and OSes.
   * `[]` when the Application is Synced or `status.resources` is absent
   * (081KSXN940008QG0R000SCP2H1 Task B -- see `soakRegressionFailure`, the
   * consumer this was added for: naming the RESOURCE a soak-phase regression
   * traces to, not only the Application).
   */
  readonly outOfSyncResources?: readonly string[];
  /**
   * `${kind}/${name} ${health}: ${message}` for every `status.resources[]` entry
   * whose OWN `health.status` is present and not `Healthy`. The sync-side twin
   * of `outOfSyncResources`: that field names which resources DIVERGED, this one
   * names which resources are NOT HEALTHY -- the only way to explain an
   * Application that went `Synced/Progressing` during the soak with nothing
   * out of sync. Measured 2026-09-23: 12 of 18 `included` failures since the
   * soak phase landed were such flips, and for the `Synced/Progressing` ones the
   * verdict named no resource at all. Ordinal-sorted; absent when none.
   */
  readonly unhealthyResources?: readonly string[];
}

export interface ApplicationVerdict {
  readonly name: string;
  readonly ok: boolean;
  readonly syncStatus: string;
  readonly healthStatus: string;
  readonly reason?: string;
  /** Carried straight from `ArgoApplicationSnapshot.outOfSyncResources` -- see its docstring. */
  readonly outOfSyncResources?: readonly string[];
  /** Carried straight from `ArgoApplicationSnapshot.unhealthyResources` -- see its docstring. */
  readonly unhealthyResources?: readonly string[];
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
      readonly soak?: SoakReport;
    }
  | {
      readonly ok: false;
      readonly plan?: HarnessPlan;
      readonly preflight?: readonly ToolCheck[];
      readonly applications?: readonly ApplicationVerdict[];
      readonly ephemeralVaultInit?: EphemeralVaultInitReport;
      readonly driftRepair?: "not-requested" | "failed";
      readonly soak?: SoakReport;
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
  kindCni: KindCni;
  ephemeralVaultInit: boolean;
  serveTreeProfile: string | null;
  laneDirs: readonly string[] | null;
  soakSeconds: number;
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

/**
 * Image the lane-tree server runs. Pinned by DIGEST, not by tag: `busybox:1.37.0`
 * is a moving target on Docker Hub and the whole point of this pod is to be the
 * least surprising thing in the lane. busybox supplies tar, gzip and nc in one
 * public ~4MB image, so the server needs nothing built and nothing private.
 * busybox httpd is not used: it 200s `?service=` (MEASURED 33824995558).
 */
const LANE_TREE_IMAGE = "busybox:1.37.0";
const DEFAULT_K3D_CONFIG = "full-ai-cluster/dev-cluster/k3d-config.yaml";
const DEFAULT_KIND_CONFIG = "full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml";
const DEFAULT_KIND_CILIUM_CONFIG = "full-ai-cluster/dev-cluster/profiles/ci.cilium.kind-config.yaml";
const DEFAULT_TIMEOUT_SECONDS = 900;
const DEFAULT_POLL_SECONDS = 10;
/** `0` disables the soak phase (Task B, 081KSXN940008QG0R000SCP2H1) -- see CliOptions.soakSeconds. */
export const DEFAULT_SOAK_SECONDS = 0;
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const HELP_TEXT =
  "usage: bun src/Core.TypeScript/cluster/argocd-health-test.ts [--dry-run|--preflight|--run] [--provider k3d|kind] [--cni kindnetd|cilium] [--scope smoke|included|full] [--runtime docker|podman] [--git-ref REF] [--cluster-name NAME] [--config PATH] [--serve-tree RUNG] [--lane-dirs D1,D2] [--existing] [--timeout-sec N] [--poll-sec N] [--soak-sec N] [--drift-check] [--ephemeral-vault-init]";
const MODE_FLAGS: Readonly<Record<string, Mode>> = {
  "--dry-run": "dry-run",
  "--preflight": "preflight",
  "--run": "run",
};
const STRING_FLAGS = new Set(["--git-ref", "--cluster-name", "--config", "--serve-tree", "--lane-dirs"]);
const INTEGER_FLAGS = new Set(["--timeout-sec", "--poll-sec", "--soak-sec"]);
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
    "game-hosting/gmod",
    "A GARRY'S MOD DEDICATED SERVER, and the SINGLE LARGEST MEMORY RESERVATION the dev lane " +
      "carried: 2048Mi of a 9216Mi budget -- 18% -- to prove a Source-engine server loads a map " +
      "and idles. Its own manifest calls it 'a game-server sample workload, not on the PoC " +
      "critical path'. It is not the platform under test. " +
      "WHY EXCLUDED RATHER THAN SHRUNK, which was tried first and reverted: the lane measured " +
      "11148Mi against 9216Mi, over by 1932Mi, and gmod is the obvious 2048Mi -- but " +
      "storage-profiles.json had already declined that cut per app, in writing. gmod: 'MEMORY IS " +
      "UNCHANGED AT BOTH RUNGS AND DELIBERATELY SO ... cutting this request would trade a Pending " +
      "pod for an evicted one.' mimir/kafka: 'an OOMKill here loses the un-consumed tail.' " +
      "orleans/silo: 'evicting the silo does not slow the cluster down, it dissolves the " +
      "membership the cluster IS.' Three reasoned refusals is not an obstacle to route around; the " +
      "lane does not need a smaller game server, it needs one fewer. " +
      "MEASURED: the lane becomes 40 Applications at 1715m / 9100Mi and FITS with 116Mi of spare, " +
      "and NO REQUEST ANYWHERE CHANGES -- the metal rung the committed tree carries, and the " +
      "16-core box deploys, is untouched. Applying the dev rung to the tree would have lowered " +
      "metal too, which this file calls 'a maintainer call, not a CI convenience'. " +
      "WHAT IS LOST: the lane stops applying and asserting gmod. That assertion is FAILING today " +
      "anyway -- 'gmod did not schedule TODAY because its sync fails on gatekeeper's webhook' -- " +
      "so a red assertion is given up, not a green one. " +
      "LIFTS WHEN: the lane has 2048Mi of headroom again (a larger runner, or the metal cluster), " +
      "at which point gmod returns UNCHANGED, because nothing about it was modified to make it leave. " +
      "ANCHORS, CHECKED BY `reason-truth.ts` -- each names an artifact this tree holds, so a claim " +
      "that outlives its artifact goes red instead of reading on: " +
      "[cite: path full-ai-cluster/k8s/applications/game-hosting/gmod/statefulset.yaml] " +
      "[cite: glob-defers game-hosting/gmod] " +
      "[cite: resource-rung game-hosting/gmod dev 100] " +
      "[cite: resource-rung game-hosting/gmod metal 1000] " +
      "[cite: lane-cpu dev 1715 fits]",
  ],
  // `agent-memory` is NOT here. It LEFT this map on 2026-09-03, and the entry is
  // recorded as closed rather than the lines silently deleted.
  //
  //   WAS: "HELD BY THE GLOB, NOT BY A MEASUREMENT". It went into `excludeGlob`
  //   because statefulset.yaml:71-83 asks RWO/8Gi on `storageClassName: longhorn`
  //   and at the time nothing in the dev lane answered to that name. Its own text
  //   said the blocker was "very likely spent" once
  //   `dev-cluster/manifests/longhorn.yaml` shipped (2026-08-21 -- the same
  //   condition that un-deferred ten other Applications that day), and that
  //   NOBODY HAD MEASURED IT, because the glob kept the Application off every CI
  //   cluster and an app that never syncs never produces a verdict to read.
  //
  //   LIFTED ON ITS OWN STATED CONDITION, verbatim: "`agent-memory/**` is dropped
  //   from `DEFAULT_ROOT_DEV_CATALOG.excludeGlob` and one included run reports its
  //   actual verdict -- pass or fail, either is information; the current state is
  //   neither." The first half is this change. The second half is the NEXT
  //   included run, which this change cannot contain: it is a MEASUREMENT, not a
  //   repair -- nothing about the Application was fixed, because nothing was known
  //   to be broken. If that run goes red the deferral comes back with a real
  //   reason attached, which is strictly more than it had.
  //
  //   Checked before lifting: RWO (not RWX, so `yamlTreeRequestsReadWriteMany`
  //   does not catch it), 8Gi on the `longhorn` alias, `busybox:1.36`, one
  //   replica, 50m/64Mi requested at the rung the tree carries. No registry
  //   credential, no GPU. Its dev-lane cost is in the lane totals below.
  [
    "cilium",
    "The CNI itself. The default kind profile brings up kind's own CNI (kindnetd) BEFORE ArgoCD exists -- " +
      "nothing can schedule otherwise -- so applying this Application there would install a second CNI over a " +
      "working one. Meanwhile the configuration is not untested: the `live kind Cilium CNI` job installs it " +
      "from THIS Application's own valuesObject on a profile with no default CNI " +
      "(full-ai-cluster/dev-cluster/profiles/ci.cilium.kind-config.yaml). " +
      "LIFTS WHEN: the app-of-apps included proof runs on that profile, so ArgoCD is reconciling a cluster " +
      "whose CNI slot Cilium already owns. kind `--cni cilium` is the flag that selects the profile; the " +
      "default kind lane stays kindnetd, so this glob still defers cilium there. " +
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
      "KIND HAS A BRING-UP ALIAS that is NOT this Application: " +
      "full-ai-cluster/dev-cluster/manifests/cilium-lb-ipam.kind.yaml is applied by bringUpKindCiCluster when " +
      '`cni === "cilium"`, after Cilium helm, before the catalogue. Lifting THIS Application on kind would ' +
      "selfHeal the metal pool over that alias. " +
      "LIFTS WHEN: `cilium` above lifts AND the pool is parameterised per substrate rather than pinned to one " +
      "maintainer's subnet. The kind alias existing is not that parameterisation. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: glob-defers cilium-lb-ipam] " +
      "[cite: glob-defers cilium] " +
      "[cite: path full-ai-cluster/dev-cluster/manifests/cilium-lb-ipam.kind.yaml] ",
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
      "WHAT WAS MEASURED 2026-08-22: it renders, and what it rendered then was 76 GiB of PersistentVolumeClaims " +
      "across four workloads -- gitaly 50Gi, minio 10Gi, postgresql 8Gi, redis 8Gi -- every one of them " +
      "declaring NO storageClassName, so all four land on the cluster default (`zeta-local-path`: the node's " +
      "own disk) and none of them is on a replicated class at all. " +
      "WHAT IS MEASURED NOW, 2026-09-22: 66 GiB across THREE workloads -- gitaly 50Gi, postgresql 8Gi, redis " +
      "8Gi. `minio` dropped out: `global.minio.enabled: false` (gitlab/Application.yaml) disables the bundled " +
      "minio subchart entirely -- both its images, `minio/minio` and `minio/mc`, were withdrawn from Docker " +
      "Hub ~2026-09-11, so a first-boot sync with it enabled ImagePullBackOffs. GitLab's object storage now " +
      "addresses the cluster's shared SeaweedFS instead (object-store/BLOB-STORE-CONTRACT.md), same as loki " +
      "and mimir; the storageClassName conclusion is otherwise unchanged. " +
      "THE BLOCKER THAT REMAINS, and it is one blocker rather than the two claimed. NO SOURCE FOR THE " +
      "ROOT-PASSWORD SECRET: the manifest reads `initialRootPassword.secret: gitlab-initial-root-password`, and " +
      "nothing in this tree creates that Secret -- outside the two Application manifests that consume it, its " +
      "only occurrence is an instruction to a human at infra/README.md:165. Without it the webservice never " +
      "reaches Ready, and ArgoCD reports Progressing until the timeout. " +
      "CAPACITY IS CARRIED OVER, NOT MEASURED, and that is said rather than implied: 66 GiB of node-local " +
      "claims plus GitLab's multi-GB images on one kind node is the earlier reason's estimate, updated for the " +
      "minio removal above, and no run in this lane has ever produced a verdict for this Application to check " +
      "it against. It is a prediction. " +
      "LIFTS WHEN: `gitlab-initial-root-password` has a source in the tree -- a SealedSecret or an " +
      "ExternalSecret, the same shape the other credentialled apps use -- AND one included run reports this " +
      "Application's actual verdict, which is also what would settle the capacity prediction either way. " +
      "UPDATE 2026-09-22 (WP24, 081M35K4PV6087G0R001Z3E0P8): THE ROOT-PASSWORD HALF OF THIS BLOCKER IS " +
      "CLOSED -- `k8s/bootstrap/internal-secret-seeding.yaml` now mints `gitlab-initial-root-password` on a " +
      "real metal first boot (a create-only Job, same shape as every sibling credential in that file), and " +
      "`DEV_GITLAB_ROOT_SECRET` mints it in dev/CI. The reference itself was found to be invisible to " +
      "`audit-existing-secret-is-minted.ts` (a bare `secret:` leaf, not `existingSecret`/`secretName`), which " +
      "is why it read as unsourced above -- that detection gap is also fixed. This Application STAYS " +
      "glob-deferred: the capacity reason below (chart size, multi-GB images, a kind runner's assertion " +
      "budget) is untouched and is the reason that remains. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that " +
      "outlives its artifact goes red instead of reading on. " +
      "[cite: no-unrenderable full-ai-cluster/gitlab] " +
      "[cite: renders full-ai-cluster/gitlab] " +
      "[cite: pvc-total full-ai-cluster/gitlab 66] " +
      "[cite: chart-pin full-ai-cluster/gitlab gitlab 8.7.0] " +
      "[cite: published gitlab 8.7.0] " +
      "[cite: path infra/README.md:165] " +
      "[cite: glob-defers gitlab] " +
      "UPDATE 2026-09-23 -- THE CAPACITY HALF IS MEASURED NOW, AND IT IS MEMORY, NOT CPU. At chart defaults " +
      "gitlab requests 2375m / 5605Mi (storage-profiles.json ungoverned row, 15 workloads); the dev lane at " +
      "`dev` already reserves 9100Mi of its 9216Mi application budget " +
      "[cite: lane-memory dev 9100 fits] -- 116Mi of room. CPU is compressible and could be floored at the dev rung; " +
      "memory is not, so no CPU override makes gitlab fit THIS lane. Its images add ~12.4 GiB on disk " +
      "(image-footprint.ts). SHARPENED LIFTS WHEN: a lane with >= 5.6 GiB of memory headroom runs it (the " +
      "lane-partition work is where that comes from) AND its workloads get a dev form sized for that lane.",
  ],
  [
    "longhorn",
    "THE CHART ITSELF, and only the chart: replicated block storage wants real block devices plus open-iscsi " +
      "on the node, and a kind node inside a runner has neither. " +
      "IT NO LONGER HOLDS ANY OTHER APPLICATION OUT, and that half of this entry is CLOSED. It used to be the " +
      "root of the largest deferral group in this file (every row reading 'requests storageClass: longhorn'). " +
      "The first exit was a dev StorageClass NAMED `longhorn` over local-path (2026-08-21); since 2026-09-23 " +
      "no chart names a provider at all -- charts request the capability `zeta-block-replicated`, metal binds it " +
      "to Longhorn and dev to rancher.io/local-path (storage-capabilities.ts), so the consumers are asserted " +
      "with no Longhorn anywhere in the lane. " +
      "WHERE LONGHORN IS PROVEN INSTEAD: the NixOS QEMU test attaches real virtual disks and binds a volume " +
      "through the chart (full-ai-cluster/nixos/tests/longhorn-volume-binds.nix). " +
      "LIFTS WHEN: a CI lane attaches block devices to its node (a VM-backed runner, or the metal cluster) -- " +
      "not by any change to this Application. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: path full-ai-cluster/nixos/tests/longhorn-volume-binds.nix] " +
      "[cite: path full-ai-cluster/dev-cluster/manifests/zeta-block-replicated.yaml] " +
      "[cite: chart-pin full-ai-cluster/longhorn longhorn 1.12.1] " +
      "[cite: glob-defers longhorn] ",
  ],
  [
    "ollama",
    "Requests nvidia.com/gpu with nodeSelector zeta.io/gpu, and a 200Gi PVC on the replicated capability " +
      "(`zeta-block-replicated`, Longhorn on metal). A GitHub-hosted runner " +
      "has neither, and the multi-GiB image pull alone outruns the job timeout -- so the Application would " +
      "HANG rather than fail, which is the worse of the two. " +
      "LIFTS WHEN: the lane runs on a GPU-bearing self-hosted runner (arc-runner-set), or this Application " +
      "grows a CPU-only dev profile with a small model and a substrate-default StorageClass. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: pvc-class full-ai-cluster/ollama zeta-block-replicated] " +
      "[cite: pvc-total full-ai-cluster/ollama 200] " +
      "[cite: glob-defers ollama] " +
      "UPDATE 2026-09-23 -- A DEV FORM AND AN AMD FORM EXIST NOW, and what still holds it out is written " +
      "here rather than implied. rung-overrides.yaml `ollama/cpu-only-dev` turns the GPU off, drops the " +
      "selector and sizes it 250m / 512Mi at one replica; `ollama/amd-gpu-metal` is the ROCm form for an AMD " +
      "cluster. Two blockers remain, either sufficient: (1) it is MANUAL-SYNC BY DESIGN -- the local-models " +
      "phase is deferred by the maintainer -- so a lane could assert only the weaker manual-sync contract; " +
      "(2) the dev form's 512Mi does not fit the lane's remaining memory " +
      "[cite: lane-memory dev 9100 fits] and the lane budget prices ollama at its stale ungoverned row (0m / 0Mi, " +
      "written when resources were unset) rather than the override's request. LIFTS WHEN: the maintainer " +
      "re-enables automated sync for the local-models phase AND a lane with that memory headroom exists.",
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
      "[cite: glob-defers platform] " +
      "UPDATE 2026-09-23: even with the pull measured, it needs 160Mi at `dev` and the lane has 116Mi left " +
      "[cite: lane-memory dev 9100 fits] -- so the lift also needs lane room, not only a credential.",
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
      "[cite: glob-defers temporal] " +
      "UPDATE 2026-09-23: independently of both blockers, it requests 1184Mi at `dev` against 116Mi left in " +
      "the lane [cite: lane-memory dev 9100 fits] -- the schema/TLS fixes alone would not fit it into this lane.",
  ],
  [
    "vllm",
    "Same class as ollama: CUDA image, nvidia.com/gpu request, 200Gi PVC on `zeta-block-replicated`. " +
      "LIFTS WHEN: a GPU-bearing self-hosted runner exists for this lane, or a CPU-only dev profile ships. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: pvc-class full-ai-cluster/vllm zeta-block-replicated] " +
      "[cite: pvc-total full-ai-cluster/vllm 200] " +
      "[cite: glob-defers vllm] " +
      "UPDATE 2026-09-23 -- MEASURED, AND DISK BINDS BEFORE THE GPU DOES. The CUDA image is ~23 GiB on disk " +
      "(image-footprint.ts); beside the dev lane's ~32 GiB of images that leaves nothing inside a hosted " +
      "runner's 66 GiB, so a CPU form would still need its own lane. vLLM's CPU backend is a different image " +
      "and needs a model downloaded at start; neither has been measured on a hosted runner, so no dev form is " +
      "claimed. An AMD form exists (`vllm/amd-gpu-metal`, rocm/vllm). LIFTS WHEN: a GPU-bearing self-hosted " +
      "runner serves a lane, or a CPU image + tiny model is measured on a hosted runner in a lane with the disk.",
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
  // DEPTH 2, and this is the same blindness the resource ladder already had. A
  // non-recursive walk reported a reason keyed on `game-hosting/gmod` as STALE --
  // "a reason for a directory that no longer exists" -- about a directory that
  // exists and that ArgoCD applies, because the include glob is not path-segment
  // bounded (established against a live cluster in app-of-apps-discovery.ts). The
  // ladder was widened when that cost 1000m; this audit was not. Depth 2 is where
  // the tree actually stops, so that is where this stops.
  const applicationsRoot = join(repoRoot, "full-ai-cluster/k8s/applications");
  const topLevel = existsSync(applicationsRoot)
    ? readdirSync(applicationsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];
  const present = new Set([
    ...topLevel,
    ...topLevel.flatMap((dir) =>
      readdirSync(join(applicationsRoot, dir), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${dir}/${entry.name}`),
    ),
  ]);
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
  // `agent-memory` is NOT here. It LEFT this set on 2026-09-03 together with its
  // DEV_EXCLUDED_REASONS entry, and the comment it carried was WRONG WHEN READ.
  //
  //   It claimed the entry was "redundant ... independently caught by the
  //   longhorn rule in isExcludedFromIncludedProof". That rule sits BEHIND
  //   `if (aliasDeclared) return false;`, and `devLonghornStorageClassAliasDeclared()`
  //   has returned true since `dev-cluster/manifests/longhorn.yaml` shipped on
  //   2026-08-21 -- so for the whole interval the longhorn rule was unreachable
  //   for this dir and caught nothing. Two entries claiming to back each other
  //   up while one was inert is exactly the shape a redundant-looking check hides
  //   in, which is why the stale claim is written down rather than the line just
  //   deleted. The mechanism itself is correct (rule 4 is MEANT to be dormant
  //   while the alias is declared); the prose that leaned on it was not.
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
  // `forgejo` is NOT here. It LEFT this set on 2026-09-06, and the entry is recorded
  // as closed rather than the lines silently deleted.
  //
  //   It read: "Standby half of the either/or Git-host pair (gitlab is the default-on
  //   one), so it ships manual-sync BY DESIGN ... Testing it for real means running
  //   BOTH Git hosts at once, the configuration its own header forbids."
  //
  // Every clause was true when written and the last one is what changed. Aaron
  // 2026-09-05: "gitlab and forgejo we will be testing both over time so we want both
  // up, neither is standby." So the header no longer forbids it, forgejo declares
  // `automated:`, and the two preconditions the old entry implied are both met:
  // `DEV_FORGEJO_ADMIN_SECRET` mints the credential the chart's init container reads,
  // and the dev lane already ensures the `zeta-local-path` alias StorageClass its 20Gi
  // PVC binds. Asserting it now asserts a real sync rather than the manual-sync
  // contract, which is the #13084 vacuity this deferral was protecting against.
  //
  // WHAT THIS BUYS AND WHAT IT COSTS: the lane will now go red if forgejo does not
  // reach Synced/Healthy, which is the point -- "both up" that nothing checks is the
  // same claim the standby posture was making. gitlab STAYS deferred below, for
  // reasons that are about chart size rather than about the pair.
  // charts.gitlab.io/gitlab 8.7.0: ~40 subcharts, and a Postgres/Redis/Gitaly/MinIO
  // stack wanting several PVCs plus multi-GB images. A kind runner cannot schedule
  // that inside the lane's assertion budget.
  //
  // WP24 (081M35K4PV6087G0R001Z3E0P8), 2026-09-22: `gitlab-initial-root-password`
  // is NO LONGER a reason gitlab is deferred -- `k8s/bootstrap/internal-secret-
  // seeding.yaml` mints it on metal and `DEV_GITLAB_ROOT_SECRET` mints it in
  // dev/CI (see argocd-health-test.ts's `gitlab` entry in `DEV_EXCLUDED_REASONS`
  // for the full trace). Chart size alone is what keeps this entry.
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
  //   `headlamp`, `loki` and `node-feature-discovery` are all asserted
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
  // PROGRESSING, unconditionally and forever. kindnetd has no LoadBalancer
  // implementation, so on the default kind lane those two Services never
  // receive an address. kind `--cni cilium` applies a Cilium LB-IPAM alias;
  // that alias existing is not a measurement that these Services receive one.
  // `weaviate-0` was 1/1 Running for 39 minutes while the kindnetd case held,
  // which is exactly how the blocker stayed invisible behind the one that was found.
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
  // LIFTS WHEN on kindnetd: never. kindnetd has no LoadBalancer implementation.
  // CLOSED ON kind `--cni cilium` by run 33697305243: both Services received
  // `status.loadBalancer.ingress` from zeta-lb-pool, Application OutOfSync/
  // Healthy, residual OutOfSync named as StatefulSet/weaviate rolling update
  // complete. `isExcludedFromIncludedProof` returns false for this dir when
  // `kindCni === "cilium"`. The metal Application `cilium-lb-ipam` stays
  // excluded. This set entry remains so kindnetd does not assert it.
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
  // `forgejo`'s row is GONE, 2026-09-06. It read "deferred until dev wiring exists
  // (DEV_INCLUDED_PROOF_DEFERRED_DIRS)", and that dev wiring now exists: the
  // credential is minted (`DEV_FORGEJO_ADMIN_SECRET`) and the StorageClass its PVC
  // binds is already ensured by the lane. A reason kept past its condition is a stale
  // excuse, and `auditAppliedButUnasserted().stale` is the check that says so -- it
  // went red the moment forgejo left the deferred set, which is how this row was found
  // rather than remembered.
  [
    "hindsight",
    "THREE independent blockers, established 2026-08-21 by rendering hindsight 0.3.0 against this Application's own valuesObject; any ONE of them defers it. " +
      "(1) CAPACITY -- AND HINDSIGHT IS THE SYMPTOM, NOT THE CAUSE. MEASURED run 32519516070: hindsight-postgresql-0 never scheduled -- FailedScheduling `0/1 nodes are available: 1 Insufficient cpu` -- so hindsight-api and hindsight-control-plane CrashLoopBackOff waiting on a database with nowhere to run. Its three requests are 500m (api) + 250m (control-plane) + 250m (postgresql), re-rendered 2026-08-22 from chart 0.3.0 against this Application's own valuesObject; every one is a CHART DEFAULT (`metalSource: chart-default` on all three rows), so no number here is a measurement of hindsight's working set and neither rung claims to be -- both are reservations. " +
      "THE ARITHMETIC THAT SAYS `SYMPTOM`, and it is why the deferral does not lift by shrinking this app: the dev lane APPLIES 38 Applications totalling 5231m at the rung the tree ships, against a 2500m budget (4000m runner less 1500m reserved). Hindsight is 1000m of that. Take hindsight to ZERO and the lane is still 4231m -- over by 1731m. Take hindsight alone to its `dev` rung (400m) and the lane is 4631m. Take the WHOLE lane to `dev` and it is 1081m, which FITS with 1419m of spare. THAT IS THE THIRD ANSWER THIS SENTENCE HAS CARRIED and the earlier two are kept rather than overwritten: 1906m fits, then 2906m over by 406m (gmod became visible), then 2006m fits (the rung learned to reach raw in-repo manifests), and now 1081m -- because 18 governed `cpuMillis.dev` rows were floored at 25m on 2026-08-23 (-1250m across all 47; -925m inside this lane), which is Aaron's observation that CPU is compressible taken at the rung where it is true. So the only cut that closes this is lane-wide -- and lane-wide is SUFFICIENT again, which is the second change of answer this sentence has carried and is written as a sequence rather than as a replacement: it closed at 1906m, then did NOT close at 2906m, and now closes at 2006m. mimir, at 1610m, is the larger single reservation. WHY IT MOVED TWICE: every number in that paragraph rose by 1000m on 2026-08-22 and nothing grew -- applicationDirs() enumerated depth 1, ArgoCD's include glob is not path-segment bounded (established against a LIVE cluster in app-of-apps-discovery.ts), and `game-hosting/gmod` -- an in-repo StatefulSet whose manifest carries a literal cpu 1 / memory 2Gi -- had been applied by this root since it was written and counted by nothing. This catalogue asserted in writing that it contributes 0m / 0Mi. It was then recorded here that `NO RUNG REACHES IT: it is a git-path source with no valuesObject, so `--resource-profile dev --apply` cannot touch it`. THE FIRST CLAUSE WAS TRUE AND THE SECOND WAS FALSE: `applyResourceProfile` writes a dotted path into an arbitrary manifest and always could reach statefulset.yaml; only the render-side reader demanded a valuesObject coordinate. Since 2026-08-23 three git-path Applications we own (1150m in total) are governed rows addressing their own manifests, gmod is 100m at `dev` and the unchanged 1000m at `metal`, and the lane closes. gmod did not schedule TODAY because its sync fails on gatekeeper's webhook -- a reprieve of the same shape as the one in the next paragraph, one resource type over -- and it was priced and governed rather than waited out. THE FOURTH ANSWER, 2026-09-03, and the three before it are kept: the lane is 39 Applications now, 6390m at the rung the tree ships and 1165m at `dev` (1335m of spare), because `agent-memory` LIFTED from the dev root's excludeGlob on its own recorded condition -- held by the glob, not by a measurement -- and brought 50m at `metal` / 25m at the `dev` floor with it. Between the third answer and this one the citations below moved 1081m -> 1056m -> 1115m -> 1140m without this sentence following (minio removed; mimir kafka + the nfd prune Job + alloy re-measured; cloudnativepg added), which is the drift the citations exist to catch and the prose did not. Nothing in this paragraph's argument changes: hindsight to ZERO still leaves 5390m, over by 2890m; lane-wide `dev` still closes it. " +
      "AND THE LANE HAS BEEN OVER-COMMITTED SINCE THE LONGHORN ALIAS LANDED, which storage-profiles.json predicted in writing: `the only reason that has not bitten is that 14 of them hang Missing on a longhorn StorageClass the dev catalog excludes, so they never schedule a pod. That is a reprieve, not a fit, and it evaporates the moment the StorageClass exists.` The dev lane now applies a `longhorn` StorageClass over rancher.io/local-path, so it has evaporated, and hindsight-postgresql-0 is the first pod to be handed the bill. " +
      "THE TWO SUBSTRATES ARE NOT CLOSE, which is why a fix for one is wrong for the other: the runner is 4000m (envelope, and `--measure-runner` convicts a smaller machine, so it is checked rather than trusted), while the checked-in ClusterNode registrations measure 16 cores (maintainers/Addisons820/cluster-nodes/node-ad1efd, node-b1e1b5) and 22 cores (maintainers/maximdolphin/cluster-nodes/node-5b2dfa, node-f82aa6). ~4x. The whole 47-app catalogue at `metal` is 9256m, which does not fit one runner and fits one 16-core box comfortably. THAT SECOND HALF IS CHECKED NOW, and it was not when this reason was first written: `compute-provenance` in single-node-readiness.ts compares the ACTIVE resource rung's total over the metal cohort against `spec.hardware.cores` and `spec.hardware.memory` on the smallest registered node, the same one-way way `capacity-provenance` compares the storage ladder against `spec.hardware.storage`. It REFUSES when no registration carries both. Green today -- 9256m against 16000m raw -- and the arithmetic is printed on every auditor run rather than only when it fails. Two units traps were found building it and are recorded at the parser: `cores` is `nproc`, i.e. LOGICAL CPUs (22 on a 16-core Ultra 9 185H), and `memory` is captured with `free -h --si`, i.e. DECIMAL, so `66G` is 62942Mi and not 67584Mi -- reading it as binary would have inflated the bound, which is the acquitting direction. " +
      "(2) THE `dev` RESOURCE RUNG CANNOT REACH THIS LANE, which is the part that looked like the fix and is not. `storage-profiles.ts --resource-profile dev --apply` rewrites the WORKING TREE; ArgoCD syncs the COMMITTED tree at `--git-ref`, and `bootstrap/root-application.yaml` points the METAL cluster at the same `main`/`full-ai-cluster/k8s/applications` path. One committed tree, two substrates, no override point -- so lowering these numbers lowers them for the 16-core box too, where the cost of an under-request is a pod evictable under node pressure rather than one refused a node. That trade is a maintainer call, not a CI convenience. " +
      'AND THE GREEN BUDGET GATE IS ABOUT A RUNG THE TREE DOES NOT CARRY, which is the part nothing had written down. MEASURED 2026-08-22, exit codes read directly: `--resource-profile metal --check` exits 0 (`manifests match resource profile "metal"`) and `--resource-profile dev --check` exits 1 with 54 drifts -- the committed tree IS `metal`. `--resource-profile metal --budget` exits 1; `--resource-profile dev --budget` exits 0. The `plan + unit tests` job runs the `dev` one. So the gate that is green is arithmetic about a configuration nobody applied, standing in front of a lane that then runs the configuration that exits 1. Nobody misreported it -- the workflow comment said `the same audit against the metal rung exits 1 today` -- but no check compared the two. `findRungCoverage` is that comparison now: the ledger declares `activeResourceProfile` (REQUIRED, refused if absent), `ciBudgetedProfile` reads the budgeted rung off the workflow\'s own run line rather than restating it, and a disagreement between them is a blocker unless the gap is carried as `acknowledgedRungBudgetGap` with all four numbers pinned. It IS carried today -- `metal@dev-lane=5231m/13475Mi>>2500m/9216Mi` -- so this remains a stated debt with a maintainer decision behind it rather than a hidden one, and moving any of those four numbers re-reddens it. ' +
      "EVERY CAPACITY NUMBER IN THIS REASON ROSE BY 1000m ON 2026-08-22 AND NOTHING GREW, which is the one part here that the two checks above do not already say: applicationDirs() enumerated depth 1, ArgoCD's include glob is not path-segment bounded (established against a LIVE cluster in app-of-apps-discovery.ts, in this repo, before this reason was written), and `game-hosting/gmod` -- an in-repo StatefulSet whose own manifest carries a literal cpu 1 / memory 2Gi -- had been applied by this root since it was written and counted by nothing. storage-profiles.json asserted in writing that it contributes 0m / 0Mi. The consequence for THIS reason was not cosmetic: it put the whole lane at `dev` at 2906m against a 2500m budget, STILL OVER by 406m, so taking the lane to `dev` was NECESSARY BUT NOT SUFFICIENT. THAT HALF IS CLOSED AS OF 2026-08-23 AND THE CORRECTION IS RECORDED RATHER THAN OVERWRITTEN. This reason said `NO RUNG REACHES gmod, because it is a git-path source with no valuesObject, so `--resource-profile dev --apply` cannot touch it`. The premise was right and the conclusion was WRONG ABOUT THIS REPO'S OWN APPLIER: `applyResourceProfile` addresses `path` + `docIndex` + `requestsField` as a dotted path into an ARBITRARY manifest and could always have written into statefulset.yaml; only the render-side reader (`overlayRung`) required the `spec.source.helm.valuesObject.` prefix, and it is that reader -- not the applier -- that has been widened. Three git-path Applications we own, carrying 1150m of hardcoded requests no rung could reach (gmod 1000m, platform 100m, agent-memory 50m), are now governed resourceClaims addressing their own manifests. `cdi` (100m) and `kubevirt` (20m x 2 pods) are reachable by the same mechanism and were governed for one draft before being backed out: both manifests are vendored byte-for-byte from upstream, and single-node-budget.json says of kubevirt's that editing it `would make the checked-in copy diverge from the cluster it documents, which is a worse lie than this one`. REACHING A FILE IS NOT A LICENCE TO EDIT IT, so those 120m stay ACKNOWLEDGED rather than governed. The dev lane is 1081m and FITS with 1419m of spare, after the 2026-08-23 dev CPU floor; `metal` is unchanged at 5231m, because the rows reproduce the committed literals exactly and `--resource-profile metal --verify` is clean. gmod did not schedule TODAY because its sync fails on gatekeeper's webhook -- a reprieve of exactly the shape the longhorn paragraph above describes, one resource type over, and it was NOT treated as a fit: the 1000m was priced and then governed rather than waited out. " +
      "(3) THE valuesObject WAS PARTLY INERT against this chart, and that half is NOW FIXED TOO -- so this blocker is narrowed a SECOND time rather than left standing. Fixed 2026-08-22: the Application wrote `postgresql.primary.persistence.{storageClass,size}` (the bitnami subchart layout) where the chart reads `postgresql.persistence.*`; the `.primary` level is gone and the re-render is 10Gi on `longhorn` instead of the chart default 8Gi with NO storageClassName. RE-CHECKED 2026-09-02 AGAINST 0.9.2, and the previously-inert keys are GONE FROM THE MANIFEST: it now writes `api.env.HINDSIGHT_API_LLM_PROVIDER` and `api.service`, the spellings the chart actually reads, and the rendered api Deployment carries HINDSIGHT_API_LLM_PROVIDER -- so the old sentence here (`api.llm.{provider,existingSecret}` and a top-level `service` remain inert) described keys this Application no longer has and has been removed rather than re-stated. WHAT SURVIVES IS THE SUBSTANTIVE HALF, and it is unchanged: no HINDSIGHT_API_LLM_API_KEY env reaches the api container (it carries only HINDSIGHT_API_DATABASE_URL, HINDSIGHT_API_LLM_MODEL and HINDSIGHT_API_LLM_PROVIDER). ALSO FIXED 2026-09-02, and NOT by the version bump: the chart defaults postgres to `ankane/pgvector:latest`, a repository Docker Hub reports as ARCHIVED with no push since 2023-10-11, and it still does so at 0.9.2 -- the Application now overrides it to the maintained `pgvector/pgvector`. AND THE HONEST LIMIT ON THIS THIRD BLOCKER, written because the exit condition below is the thing most likely to outlive its defect: nobody has measured whether hindsight-api can reach Healthy WITHOUT an LLM API key. It may start and fail only on first extraction, or it may crash at boot. Unknown, and left unknown rather than guessed -- so (3) is recorded as a DEFECT in its own right and is deliberately not claimed as a scheduling blocker. " +
      "TWO OF THE THREE BLOCKERS ARE SPENT AS OF 2026-09-05, measured, and this reason is narrowed rather than left standing at its original width. (1) CAPACITY IS CLOSED. This reason's own arithmetic says it: \"Take the WHOLE lane to `dev` and it is 1081m, which FITS\". CI now DOES take the whole lane to dev -- `--serve-tree dev` builds a copy of the tree with the rung applied and serves it from an in-cluster git server -- and the lane measures 1490m against a 2500m budget, 1010m of spare. The condition the paragraph named has been met by the substrate rather than by shrinking this app, exactly as it predicted. (2) THE RUNG-REACH BLOCKER IS CLOSED. It said \"One committed tree, two substrates, no override point\". There is an override point now, and it is the same `--serve-tree`: it rewrites a STAGED copy, never the committed tree, so the 16-core box keeps `metal` while CI gets `dev`. (3) IS THE ONLY ONE LEFT, and it is still genuinely UNKNOWN rather than quietly assumed: nobody has measured whether hindsight-api reaches Healthy WITHOUT an LLM API key. An attempt was made to read it from the last green proof run (33917879207) and FAILED -- job logs return empty and the check-run carries no annotations -- so the verdict is unread, not green. It is NOT lifted on the strength of (1) and (2) being closed, because a Healthy nobody observed is the vacuity class and this file exists to refuse it. WHAT WOULD LIFT IT is now one measurement rather than a capacity argument: one live run that reads hindsight's health line. " +
      "LIFTS WHEN: this lane reports hindsight at `health=Healthy` -- NOT `sync=Synced health=Healthy`. The lane accepts `sync=Unknown health=Healthy` (argocd, cert-manager, external-secrets, headlamp, loki and node-feature-discovery all pass that way in the same green run; minio was in that list until 2026-09-01 and is not an app any more), and a LIFTS WHEN stricter than the gate it names is exactly what kept `headscale` deferred for a cycle after its defect was gone. Reaching it needs (a) the lane-wide capacity trade in (1)/(2) settled by the maintainer, and (b) whatever (3) turns out to cost once (a) lets a pod run long enough to find out. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. The four capacity numbers above are citations rather than prose FOR THAT REASON -- they are the numbers a reader is most likely to act on, so they are the ones that must not be allowed to go quietly stale. " +
      "[cite: glob-applies hindsight] " +
      "[cite: pvc-class full-ai-cluster/hindsight zeta-block-replicated] " +
      "[cite: pvc-total full-ai-cluster/hindsight 10] " +
      "[cite: chart-pin full-ai-cluster/hindsight hindsight 0.9.2] " +
      "[cite: resource-rung hindsight metal 1000] " +
      "[cite: resource-rung hindsight dev 75] " +
      "[cite: lane-cpu metal 7390 over] " +
      "[cite: lane-cpu dev 1715 fits] " +
      "[cite: workflow-job k8s-argocd-health-test.yml dry-run] " +
      "[cite: path full-ai-cluster/k8s/bootstrap/root-application.yaml] " +
      "[cite: path maintainers/Addisons820/cluster-nodes/node-ad1efd/node.yaml] " +
      "[cite: path maintainers/maximdolphin/cluster-nodes/node-5b2dfa/node.yaml] ",
  ],
  [
    "weaviate",
    "NOT the sync loop it was briefly un-deferred for, and not storage -- MEASURED LIVE on run 32532470499, the run that refuted the fix. " +
      "weaviate renders TWO `type: LoadBalancer` Services (`weaviate`, `weaviate-grpc`), and gitops-engine `getCorev1ServiceHealth` reports a LoadBalancer Service whose `status.loadBalancer.ingress` is empty as PROGRESSING, unconditionally. kindnetd has no LoadBalancer implementation, so on the default kind lane those two Services never get an address. kind `--cni cilium` applies a Cilium LB-IPAM alias; that alias existing is not a measurement that these Services receive an address. `weaviate-0` was 1/1 Running for 39m while the kindnetd case held, which is how the blocker stayed hidden behind the one that was found. " +
      "The `randAlphaNum` render nondeterminism established by byte diff is real and its narrow `ignoreDifferences` rule is KEPT, because on metal cilium-lb-ipam does assign LB addresses and it may there be the whole story. But the resync loop SURVIVED that rule live, so 'the rule closes the loop' is UNMETERED rather than proven: the OutOfSync cause was checked and the Progressing cause was not, and one confirmed cause was read as THE cause. " +
      "CLOSED ON kind `--cni cilium` by run 33697305243: weaviate=172.18.255.201, weaviate-grpc=172.18.255.202, Application OutOfSync/Healthy, residual OutOfSync named StatefulSet/weaviate rolling update complete. `isExcludedFromIncludedProof` returns false for weaviate when kindCni is cilium. Do not lift the metal cilium-lb-ipam Application. " +
      "LIFTS WHEN: never on kindnetd -- that lane has no LoadBalancer implementation. The cilium-lane lift is already in code. " +
      "ANCHORS, CHECKED BY `reason-truth.ts`: each names an artifact this tree holds, so a claim that outlives its artifact goes red instead of reading on. " +
      "[cite: glob-applies weaviate] " +
      "[cite: renders full-ai-cluster/weaviate] " +
      "[cite: path full-ai-cluster/dev-cluster/manifests/cilium-lb-ipam.kind.yaml] ",
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

/**
 * Every StorageClass NAME an Application's text requests. Since 2026-09-23 a
 * name is a capability (`zeta-block-replicated` ...), never a provider -- see
 * storage-capabilities.ts, whose line scanner this reuses so the lint and this
 * rule read `storageClass:` identically.
 */
function requestedStorageClasses(yamlText: string): readonly string[] {
  return storageClassValues(yamlText).map((entry) => entry.value);
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

function yamlTreeRequestedStorageClasses(appDir: string): readonly string[] {
  return listYamlFilesUnder(appDir).flatMap((file) => requestedStorageClasses(readFileSync(file, "utf8")));
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
/**
 * Does the RENDERED snapshot show this Application asking for `ReadWriteMany`?
 *
 * The second detector, and it sees what the first structurally cannot.
 * `yamlTreeRequestsReadWriteMany` reads the CHECKED-IN tree, but most
 * Applications are `spec.source.chart` against an external `repoURL` -- the
 * repo holds a `valuesObject` and the PVC's access mode lives in the upstream
 * chart -- so for exactly the Applications it protects it scans files that
 * cannot contain the answer. That limit was written down in this file and is
 * now closed from the other side: `helm template` renders the chart, and
 * `rendered-storage-claims.snapshot.json` carries the `accessModes` it emits.
 *
 * READS THE COMMITTED SNAPSHOT, never helm. `isExcludedFromIncludedProof` is a
 * pure offline predicate that `app-of-apps-discovery.ts` and the unit tests
 * call with no cluster and no network in sight; rendering here would break
 * that. The snapshot is regenerated by `rendered-storage-claims.ts
 * --write-snapshot` and reviewed in the diff like any other committed
 * measurement.
 *
 * THE TWO ARE COMPLEMENTARY, NOT REDUNDANT -- measured 2026-09-19:
 *   - the render covers 23 Applications, 38 claims, and found ZERO RWX;
 *   - `arc-runner-set` is NOT in the render set and declares
 *     `accessModes: [ ReadWriteMany ]` in its own committed `model-cache-pvc.yaml`.
 * So each detector catches a case the other misses, and the guard asks both.
 *
 * Silence is not clearance. An Application the snapshot does not mention gets
 * `false` HERE -- this function answers only "did the render show RWX" -- and
 * the residual unknown is reported by `appsTheRenderIsSilentAbout` rather than
 * being quietly read as safe.
 */
export function renderedClaimsRequestReadWriteMany(dir: string, repoRoot = REPO_ROOT): boolean {
  for (const claim of loadRenderedClaims(repoRoot)) {
    if (claim.appId.split("/").at(-1) !== dir) continue;
    if (claim.accessModes.includes("ReadWriteMany")) return true;
  }
  return false;
}

/**
 * Cached parse of the committed render snapshot; `[]` when it is absent or unreadable.
 *
 * KEYED BY `repoRoot`. A single cached value would make the first caller's root
 * the answer for every later one and silently ignore the parameter -- which the
 * tests, that point this at fixture trees, would then be unable to see past.
 */
const renderedClaimsCache = new Map<string, readonly { appId: string; accessModes: readonly string[] }[]>();
function loadRenderedClaims(repoRoot: string): readonly { appId: string; accessModes: readonly string[] }[] {
  const hit = renderedClaimsCache.get(repoRoot);
  if (hit !== undefined) return hit;
  // FAIL OPEN HERE, DELIBERATELY, AND ONLY HERE. A missing or unparseable
  // snapshot must not make every Application look RWX-free by accident, but it
  // also must not make them all look RWX -- that would exclude the entire
  // roster from the proof on a file-read error. So this returns `[]`, the
  // checked-in scan continues to apply unchanged, and the snapshot's absence is
  // a REPORTING gap surfaced by `appsTheRenderIsSilentAbout`, not a silent
  // verdict flip in either direction.
  try {
    const raw = readFileSync(resolve(repoRoot, "src/Core.TypeScript/cluster/rendered-storage-claims.snapshot.json"), "utf8");
    const parsed = JSON.parse(raw) as { rendered?: { appId?: unknown; accessModes?: unknown }[] };
    renderedClaimsCache.set(repoRoot, (parsed.rendered ?? []).flatMap((c) =>
      typeof c.appId === "string"
        ? [{ appId: c.appId, accessModes: Array.isArray(c.accessModes) ? c.accessModes.filter((m): m is string => typeof m === "string") : [] }]
        : [],
    ));
  } catch {
    renderedClaimsCache.set(repoRoot, []);
  }
  return renderedClaimsCache.get(repoRoot) ?? [];
}

/**
 * Applications the render says nothing about — the honest residual.
 *
 * Neither detector can clear these: the render did not cover them and the
 * checked-in scan can only see in-repo manifests. They are NOT excluded from
 * the proof on that basis, because excluding an Application for being
 * unmeasured would quietly shrink the roster the proof covers, which is the
 * failure this file refuses everywhere else. They are reported so the gap has
 * a number instead of a silence.
 */
export function appsTheRenderIsSilentAbout(dirs: readonly string[], repoRoot = REPO_ROOT): readonly string[] {
  const covered = new Set(loadRenderedClaims(repoRoot).map((c) => c.appId.split("/").at(-1)));
  return dirs.filter((d) => !covered.has(d)).toSorted(stringCompare);
}

function yamlTreeRequestsReadWriteMany(appDir: string): boolean {
  return listYamlFilesUnder(appDir).some((file) => readFileSync(file, "utf8").includes("ReadWriteMany"));
}

/**
 * Which storage CAPABILITIES does the repo bind for the dev/CI substrate?
 *
 * Since 2026-09-23 charts name a capability, never a provider
 * (storage-capabilities.ts), and dev binds the two RWO ones in
 * `dev-cluster/manifests/`. The question used to be "is there a class NAMED
 * `longhorn`"; it is now "which of the names charts ask for can this lane
 * serve", and the answer is a set. `zeta-shared` is never in it.
 *
 * This is the SUBSTRATE CONDITION the storage exclusion hangs on. It is
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
export function devBoundStorageCapabilities(repoRoot = REPO_ROOT): ReadonlySet<string> {
  const bound = new Set<string>();
  for (const key of Object.keys(DEV_STORAGE_ALIAS_MANIFEST_RELPATHS) as (keyof typeof DEV_STORAGE_ALIAS_MANIFEST_RELPATHS)[]) {
    const expectedName = DEV_STORAGE_ALIAS_CLASS_NAMES[key];
    if (devBindingManifestDeclares(resolve(repoRoot, DEV_STORAGE_ALIAS_MANIFEST_RELPATHS[key]), expectedName)) {
      bound.add(expectedName);
    }
  }
  return bound;
}

/** One dev binding file, fail-closed in every direction (see the doc above). */
function devBindingManifestDeclares(path: string, expectedName: string): boolean {
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
  return (metadata as { name?: unknown }).name === expectedName;
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
/**
 * Applications whose exclusion is PROVIDER-CONDITIONAL.
 *
 * WHY THIS EXISTS. `cilium`'s recorded LIFTS WHEN reads "the app-of-apps
 * included proof runs on that profile, so ArgoCD is reconciling a cluster whose
 * CNI slot Cilium already owns." `ciliumOwnsCniSlot` is that condition: true on
 * k3d always, and on kind only with `--cni cilium`. A lift condition the
 * mechanism cannot evaluate is a latent vacuity: it reads like a promise and
 * can never be kept.
 *
 * `cilium-lb-ipam` IS DELIBERATELY NOT HERE, and that is the interesting half.
 * Its lift is CONJUNCTIVE -- "`cilium` above lifts AND the pool is parameterised
 * per substrate rather than pinned to one maintainer's subnet." The second
 * conjunct is measurably false: `cilium-lb-ipam/ip-pool.yaml` pins
 * 192.168.1.240-250, a home LAN range with no meaning on a hosted runner.
 * Kind has a bring-up alias (`dev-cluster/manifests/cilium-lb-ipam.kind.yaml`);
 * that is not this Application, and lifting this Application would selfHeal the
 * metal range over it.
 */
export function isExcludedFromIncludedProof(
  dir: string,
  appText: string,
  appDir: string,
  /**
   * The capabilities the dev substrate binds (`devBoundStorageCapabilities`).
   * An Application requesting ANY class outside this set is excluded: its PVC
   * could never bind here, and a pending PVC reads as Progressing, not failed.
   */
  devBound: ReadonlySet<string> = devBoundStorageCapabilities(),
  /**
   * The provider the proof is running on, when known.
   *
   * OPTIONAL AND DEFAULTS TO `null` ON PURPOSE. Sixteen call sites reach
   * `discoverExpectedApplications`, several of them (`app-of-apps-discovery`,
   * `image-footprint`) answering REPO-level questions that have no business
   * knowing about a CI substrate. Threading a required provider through those
   * would put a lane concern into functions that are not about lanes. `null`
   * means "provider unknown", and an unknown provider lifts NOTHING -- the
   * conservative direction, and identical to the behaviour before this change.
   */
  provider: Provider | null = null,
  kindCni: KindCni = "kindnetd",
): boolean {
  if (dir === "cilium" && ciliumOwnsCniSlot(provider, kindCni)) return false;
  // MEASURED run 33697305243 on kind --cni cilium: both weaviate LoadBalancer
  // Services received ingress from zeta-lb-pool (weaviate 172.18.255.201,
  // weaviate-grpc 172.18.255.202) and the Application was OutOfSync/Healthy.
  // Residual OutOfSync is StatefulSet/weaviate rolling-update complete.
  // kindnetd still has no LoadBalancer implementation -- keep deferred there.
  if (dir === "weaviate" && kindCni === "cilium") return false;
  if (DEV_EXCLUDED_DIRS.has(dir)) return true;
  if (DEV_INCLUDED_PROOF_DEFERRED_DIRS.has(dir)) return true;
  // BOTH detectors, because each sees a case the other cannot: the checked-in
  // scan catches in-repo manifests (arc-runner-set), the render catches
  // upstream charts (where most of these Applications keep their PVCs).
  if (yamlTreeRequestsReadWriteMany(appDir) || renderedClaimsRequestReadWriteMany(dir)) return true;
  const requested = [...requestedStorageClasses(appText), ...yamlTreeRequestedStorageClasses(appDir)];
  return requested.some((storageClass) => !devBound.has(storageClass));
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
      kindCni: "kindnetd",
      ephemeralVaultInit: false,
      serveTreeProfile: null,
      laneDirs: null,
      soakSeconds: DEFAULT_SOAK_SECONDS,
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
  if (flag === "--serve-tree") options.serveTreeProfile = value;
  if (flag === "--lane-dirs") options.laneDirs = parseLaneDirs(value);
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
  if (flag === "--soak-sec") options.soakSeconds = value;
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

function isKindCni(value: string): value is KindCni {
  return value === "kindnetd" || value === "cilium";
}

function parseCniFlag(argv: readonly string[], index: number, options: MutableCliOptions): ParseArgResult {
  const parsed = readFlagValue(argv, index, "--cni", "kindnetd or cilium");
  if (!parsed.ok) return parsed;
  if (!isKindCni(parsed.value)) {
    return { ok: false, failure: usageFailure(`unsupported cni: ${parsed.value}`) };
  }
  options.kindCni = parsed.value;
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
  if (arg === "--cni") return parseCniFlag(argv, index, options);
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
  if (options.provider === "k3d" && options.kindCni !== "kindnetd") {
    return usageFailure("--cni is kind-only; k3d always installs Cilium");
  }
  if (options.provider === "kind" && options.kindCni === "cilium") {
    const cfg = basename(options.configPath).toLowerCase();
    if (!cfg.includes("cilium")) {
      return usageFailure("--cni cilium requires a no-default-CNI kind profile (ci.cilium.kind-config.yaml)");
    }
  }
  if (options.provider === "kind" && options.kindCni === "kindnetd") {
    const cfg = basename(options.configPath).toLowerCase();
    if (cfg.includes("cilium")) {
      return usageFailure("kindnetd cannot use the Cilium kind profile; pass --cni cilium");
    }
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
  if (!options.configExplicit && options.provider === "kind") {
    options.configPath = options.kindCni === "cilium" ? DEFAULT_KIND_CILIUM_CONFIG : DEFAULT_KIND_CONFIG;
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

export function discoverExpectedApplications(
  repoRoot = REPO_ROOT,
  /** See `isExcludedFromIncludedProof`'s `provider` note: optional, `null` lifts nothing. */
  provider: Provider | null = null,
  kindCni: KindCni = "kindnetd",
  /**
   * One lane's Application directories, or `null` for the whole roster. The
   * SAME list scopes what the root catalogue applies (`laneScopedExcludeGlob`),
   * so apply and assert cannot disagree about which charts a lane owns.
   */
  laneDirs: readonly string[] | null = null,
): readonly ExpectedApplication[] {
  // Read the substrate condition ONCE for the whole roster: it is a property of
  // the repo, not of any one Application, and re-reading it per directory would
  // let two Applications in the same run disagree about which storage
  // capabilities dev binds.
  const devBound = devBoundStorageCapabilities(repoRoot);
  const appsDir = resolve(repoRoot, "full-ai-cluster/k8s/applications");
  // DEPTH 2, via the module the root catalogue also uses. Depth 1 missed
  // `game-hosting/gmod`, which ArgoCD's non-segment-bounded glob does apply --
  // see `application-dirs.ts`.
  const all = listApplicationDirs(repoRoot);
  const lane = laneDirs === null ? null : new Set(laneDirs);
  const dirs = lane === null ? all : all.filter((d) => lane.has(d));

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
        excludedFromDev: isExcludedFromIncludedProof(dir, appText, appDir, devBound, provider, kindCni),
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
    // PASS THE PROVIDER. Without this the provider-conditional lift added for
    // `cilium` would exist and never fire -- a capability with no consumer,
    // which is the same defect (a lift condition nothing can evaluate) one
    // layer up. `buildPlan` is the only caller that knows which substrate the
    // proof is about; the repo-level callers keep the `null` default.
    expectedApplications = discoverExpectedApplications(repoRoot, options.provider, options.kindCni, options.laneDirs);
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
            `assert the dev storage-capability StorageClasses (${Object.values(DEV_STORAGE_ALIAS_CLASS_NAMES).join(", ")}) the repo binds are actually present, before anything waits on a PVC that needs one`,
            ...DEV_BOOTSTRAP_SECRETS.map(
              (spec) =>
                `assert the dev credential ${spec.namespace}/${spec.name} the bring-up mints is actually present, before its Application waits on a Secret that must pre-exist`,
            ),
            ...(options.provider === "kind" && options.kindCni === "cilium"
              ? [
                  `assert the kind Cilium LB-IPAM pool "${DEV_CILIUM_LB_KIND_POOL_NAME}" is present, before any LoadBalancer Service waits for an address`,
                ]
              : []),
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
      "Dev health assertions exclude cilium (except k3d, and kind --cni cilium), the Longhorn chart itself, GPU model-SERVING (ollama/vllm), ReadWriteMany claims, and apps deferred on a named blocker recorded in APPLIED_BUT_UNASSERTED_REASONS; k3d and kind --cni cilium bootstrap Cilium directly, kind --cni kindnetd uses kind's default CNI.",
      "Storage is by CAPABILITY, not provider (since 2026-09-23; storage-capabilities.ts): charts request zeta-block-replicated / zeta-block-local / zeta-shared, and dev binds the two RWO capabilities to rancher.io/local-path (dev-cluster/manifests/zeta-block-*.yaml) where it used to fake a class NAMED longhorn, so those PVCs bind. Served dev trees carry the `ci` storage rung + dev resize overrides so the declared disk fits the runner. MEASURED on run 32519516070: 6 of the 11 formerly-excluded apps reached Synced+Healthy (headscale, mimir, nats, oz, redis, tempo); the other 5 bound their volumes and then failed for named NON-storage defects, visible for the first time. TWO of those five are fixed as of 2026-08-21 and are PROVEN so by live run 32532470499 -- cockroachdb (the chart init Job moved out of ArgoCD PostSync, which deadlocks against the health it is needed to produce) and kube-prometheus-stack (Grafana admin Secret minted at bring-up). weaviate was asserted alongside them for a few hours and the same run refuted it: two `type: LoadBalancer` Services can never be Healthy on a kind node, a blocker independent of the render nondeterminism that was fixed. hindsight remains, on three independent blockers. Still excluded outright are ReadWriteMany claims (zeta-shared is deliberately unbound in dev), and any class dev does not bind -- including a provider name -- keeps its Application out (081M0JXF6MS087G0R001HC34TM).",
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

export function isTerminalFailure(failure: Failure | null): boolean {
  return failure !== null && failure.terminal === true;
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
    if (isTerminalFailure(lastFailure)) return lastFailure;
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
  const startedAt = Date.now();
  let lastProgressAt = startedAt;
  console.log(`Waiting: ${message}`);
  return waitFor(timeoutSeconds, pollSeconds, () => {
    const now = Date.now();
    if (now - lastProgressAt >= 60_000) {
      const elapsedSec = Math.floor((now - startedAt) / 1000);
      console.log(`still waiting (${elapsedSec}s): ${message}`);
      lastProgressAt = now;
    }
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

/**
 * Build the in-cluster tree source for `--serve-tree <rung>`, or `null` when the
 * flag is absent.
 *
 * WHY THIS IS A FUNCTION AND NOT THREE LINES INLINE: every failure here has to be
 * a THROW, not a null. Returning `null` on a build failure would fall back to the
 * committed tree, which is the `metal` rung -- the lane would then reproduce the
 * exact `Insufficient cpu` failure the flag exists to remove, with nothing saying
 * the override had been skipped. `lane-tree-source` already refuses a zero-file
 * copy, a zero-edit rung apply, an un-rewritten repoURL and an over-budget pack;
 * this keeps those refusals fatal rather than absorbing them.
 *
 * EXPORTED (081KSXN940008QG0R000SCP2H1 WP1b) so `first-boot-replica.ts` can serve the
 * same rung-overlaid tree its real k3s roster's `root-application.yaml` points at,
 * rather than re-deriving the rung/override/bundle pipeline a second time. Both
 * callers get the SAME staged tree, the SAME refusals (zero-file copy, zero-edit
 * rung apply, un-rewritten repoURL, over-budget pack), and the same `LANE_TREE_IMAGE`.
 */
/**
 * Everything `--serve-tree <rung>` does to the STAGED copy, in order, as one
 * function the unit tests can drive against a staged tree without building the
 * bare repository: the resource rung, then the storage profile the catalogue maps
 * the rung to, then the rung overrides. Never touches the committed tree.
 */
export function applyServeTreeRung(
  profile: string,
  stagedRoot: string,
  /**
   * Non-rung cluster properties (`rung-overrides.yaml` `dimensions`), e.g.
   * `{gpuVendor: "amd"}` for an AMD GPU cluster. Empty = every dimension at its
   * committed value (NVIDIA), i.e. exactly the tree this built before
   * dimensions existed. Validated: an undeclared name or value THROWS rather
   * than silently building the committed tree under another label.
   */
  selection: ClusterSelection = {},
): { readonly rungEdits: number; readonly storageEdits: number; readonly overrideEdits: number; readonly storageProfile: string | null } {
  validateSelection(selection, loadOverrideDimensions(stagedRoot));
  const catalogue = loadResourceCatalogue(undefined, stagedRoot);
  const rungEdits = applyResourceProfile(catalogue, profile, stagedRoot).length;
  const storageProfile = storageProfileForResourceRung(profile, undefined, stagedRoot);
  const storageEdits =
    storageProfile === null ? 0 : applyProfile(loadCatalogue(undefined, stagedRoot), storageProfile, stagedRoot).length;
  const overrideEdits = applyRungOverrides(
    loadRungOverrides(catalogue.profiles, stagedRoot),
    profile,
    stagedRoot,
    true,
    selection,
  ).length;
  return { rungEdits, storageEdits, overrideEdits, storageProfile };
}

export function buildLaneTreeForProfile(
  profile: string | null,
  gitRef: string,
): { readonly manifests: string; readonly repoUrl: string; readonly gitRef: string } | null {
  if (profile === null) return null;
  const catalogue = loadResourceCatalogue();
  if (!catalogue.profiles.includes(profile)) {
    throw new Error(`--serve-tree ${profile}: unknown resource profile; known: ${catalogue.profiles.join(", ")}`);
  }
  const workDir = mkdtempSync(join(tmpdir(), "zeta-lane-tree-"));
  const bundle = buildLaneTreeBundle({
    repoRoot: REPO_ROOT,
    workDir,
    // Provenance only (commit message). The served BRANCH is always
    // SERVED_GIT_REF (`main`). Naming it after a GitHub SHA made ArgoCD fetch
    // that SHA as an object the served repo does not contain (33822942615).
    gitRef,
    image: LANE_TREE_IMAGE,
    // TWO OVERRIDE POINTS, applied in order, both to the STAGED copy only.
    //
    // The rung writes `<requestsField>.cpu` and `.memory` and nothing else. That
    // was the whole vocabulary the dev lane had, so an Application whose
    // dev/metal difference was anything else -- a GPU selector, a replica count,
    // a resource key whose NAME contains dots -- had no expressible dev form and
    // could only be excluded from CI entirely. Twelve were.
    //
    // `applyRungOverrides` is the second point: arbitrary dotted-path set/remove,
    // declared in `rung-overrides.yaml`, each entry carrying a substrate reason
    // and a lift condition, and each REFUSED if it produces no edits. It runs
    // AFTER the rung so a resource claim and an override can address the same
    // manifest without the override being silently reverted.
    //
    // A THIRD, BETWEEN THEM (2026-09-23): the STORAGE profile the catalogue maps
    // this rung to (`storageProfileForResourceRung`, today `dev -> ci`). The
    // committed tree carries the metal box's disk sizes; the staged dev tree
    // carries sizes a hosted runner can actually hold. Same `applyProfile` the
    // `--apply` path uses, so the numbers are the ones `--verify` checks.
    applyRung: (stagedRoot: string) => {
      const applied = applyServeTreeRung(profile, stagedRoot);
      console.log(
        `[serve-tree] rung edits=${String(applied.rungEdits)} storage edits=${String(applied.storageEdits)} ` +
          `(profile ${applied.storageProfile ?? "unchanged"}) override edits=${String(applied.overrideEdits)}`,
      );
      return applied.rungEdits + applied.storageEdits + applied.overrideEdits;
    },
  });
  console.log(
    `[serve-tree] rung=${profile} files=${String(bundle.staged.files)} ` +
      `repoURL-rewrites=${String(bundle.staged.rewritten.length)} ` +
      `packed=${String(bundle.packedBytes)}B commit=${bundle.repo.sha.slice(0, 12)} ` +
      `targetRevision=${SERVED_GIT_REF}`,
  );
  return { manifests: bundle.manifests, repoUrl: laneTreeRepoUrl(), gitRef: SERVED_GIT_REF };
}

function bootstrapCluster(plan: HarnessPlan, options: CliOptions): Failure | null {
  if (options.provider === "kind") {
    if (options.existing) {
      return runOrFail("kubectl", ["config", "use-context", `kind-${plan.clusterName}`], "KubectlFailed", 30);
    }
    try {
      const laneTree = buildLaneTreeForProfile(options.serveTreeProfile, options.gitRef);
      bootstrapKindClusterInProcess({
        configPath: options.configPath,
        clusterName: plan.clusterName,
        gitRef: options.gitRef,
        containerRuntime: options.runtime,
        cni: options.kindCni,
        ...(laneTree === null ? {} : { laneTree }),
        ...(options.laneDirs === null ? {} : { laneDirs: options.laneDirs }),
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
    const laneTree = buildLaneTreeForProfile(options.serveTreeProfile, options.gitRef);
    bootstrapK3dClusterInProcess({
      configPath: options.configPath,
      gitRef: options.gitRef,
      ...(laneTree === null ? {} : { laneTree }),
      ...(options.laneDirs === null ? {} : { laneDirs: options.laneDirs }),
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
  const bound = devBoundStorageCapabilities();
  for (const key of Object.keys(DEV_STORAGE_ALIAS_MANIFEST_RELPATHS) as (keyof typeof DEV_STORAGE_ALIAS_MANIFEST_RELPATHS)[]) {
    const className = DEV_STORAGE_ALIAS_CLASS_NAMES[key];
    if (!bound.has(className)) continue;
    const args = ["get", "storageclass", className, "-o", "jsonpath={.provisioner}"];
    const result = runCommand("kubectl", args, 60_000);
    const provisioner = result.stdout.trim();
    const satisfiable = result.status === 0 && DEV_SATISFIABLE_PROVISIONERS.has(provisioner);
    if (satisfiable) continue;
    const cause =
      result.status === 0
        ? `it is bound to provisioner "${provisioner}", which this lane cannot run`
        : "it is not present";
    return {
      kind: "DevStorageClassMissing",
      message:
        `${DEV_STORAGE_ALIAS_MANIFEST_RELPATHS[key]} binds the storage capability "${className}" over ` +
        `${[...DEV_SATISFIABLE_PROVISIONERS].join("/")}, and the included proof asserts Applications that request ` +
        `it, but in cluster ${plan.clusterName} ${cause}. Those PVCs would stay Pending, which ArgoCD reports as ` +
        `Progressing rather than Degraded, so the run would burn its whole timeout instead of failing. Failing ` +
        `now instead. Check that the bring-up path still applies the binding manifest.`,
      command: ["kubectl", ...args],
      detail: {
        stdout: result.stdout.slice(-2000),
        stderr: result.stderr.slice(-2000),
        clusterName: plan.clusterName,
        observedProvisioner: provisioner,
      },
    };
  }
  return null;
}

/**
 * Kind `--cni cilium` apply of the LB-IPAM alias is a claim about CODE THAT
 * RUNS. `type: LoadBalancer` Services sit Progressing forever without a pool.
 * Fail now if bring-up dropped the apply, rather than waiting for weaviate
 * (or Cilium's own ingress) to burn the health timeout.
 */
function assertKindCiliumLbPoolPresent(options: CliOptions): Failure | null {
  if (options.provider !== "kind" || options.kindCni !== "cilium") return null;
  const args = ["get", "ciliumloadbalancerippools.cilium.io", DEV_CILIUM_LB_KIND_POOL_NAME];
  const result = runCommand("kubectl", args, 60_000);
  if (result.status === 0) return null;
  return {
    kind: "DevCiliumLbPoolMissing",
    message:
      `${DEV_CILIUM_LB_KIND_MANIFEST_RELPATH} declares CiliumLoadBalancerIPPool ` +
      `"${DEV_CILIUM_LB_KIND_POOL_NAME}", and kind --cni cilium bring-up is supposed to apply it ` +
      `after Cilium helm, but kubectl get returned exit ${String(result.status)}. ` +
      `LoadBalancer Services would stay Progressing. Failing now instead.`,
    command: ["kubectl", ...args],
    detail: {
      stdout: result.stdout.slice(-2000),
      stderr: result.stderr.slice(-2000),
    },
  };
}

/**
 * The LIVE half of lifting `kube-prometheus-stack` and `oz` out of the deferred
 * set.
 *
 * `applyDevBootstrapSecrets` mints `monitoring/grafana-admin-credentials`,
 * `openziti/ziti-admin-credentials`, and `redis/redis-auth` at bring-up, and
 * `use-cases.test.ts` proves the loop is wired into all three doors. None of
 * those observes a CLUSTER.
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

/**
 * SHARED credentials are checked in EVERY namespace they are minted into, not
 * just the producer's.
 *
 * This walk did not exist until 2026-09-09, and its absence is what let the
 * Orleans silo crash-loop for days. `redis-auth` was minted only into namespace
 * `redis`; the silo projects it in namespace `orleans`, where a `secretKeyRef`
 * actually resolves. The bootstrap walk above passed -- the Secret WAS present,
 * in the one namespace it looked at -- so the assertion that exists to catch a
 * missing credential reported green for a missing credential. A per-namespace
 * walk is the only form that can see it.
 */
function devSharedSecretFailure(plan: HarnessPlan, spec: DevSharedSecretSpec, namespace: string): Failure | null {
  return devBootstrapSecretFailure(plan, {
    namespace,
    name: spec.name,
    userKey: "",
    passwordKey: "",
    user: "",
    reason: spec.reason,
  });
}

function assertDevBootstrapSecretsPresent(plan: HarnessPlan): Failure | null {
  if (!isIncludedScope(plan.scope)) return null;
  for (const spec of DEV_BOOTSTRAP_SECRETS) {
    const failure = devBootstrapSecretFailure(plan, spec);
    if (failure !== null) return failure;
  }
  for (const spec of DEV_SHARED_SECRETS) {
    for (const namespace of spec.namespaces) {
      const failure = devSharedSecretFailure(plan, spec, namespace);
      if (failure !== null) return failure;
    }
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

/**
 * kubectl surfaces dumped when App-of-Apps never produces children.
 *
 * MEASURED on run 33684309073 (kind+Cilium included, `--cni cilium`, no
 * `--existing`): Cilium 1.20.1 installed, ArgoCD rollouts succeeded, root
 * App-of-Apps applied, then 2400s of silence waiting for `hat-system`.
 * Failure JSON was only `NotFound`. The four-app table printed ZERO VERDICTS
 * PARSED. Kindnetd included on the same SHA DID create children. Without this
 * dump the next probe is another 40-minute non-measurement (081M1DFQ2MZ).
 *
 * `hat-system` is sync-wave `-10` (the HEAD of the catalog). Pinning the wait
 * to that one name made a missing catalog spend the entire health budget on
 * one NotFound. The wait is now ANY child, capped below the health timeout.
 */
export const ROOT_DEV_APPLICATION_NAME = "zeta-root-dev";

/**
 * How long to wait for App-of-Apps to produce ANY child before git-ref patch.
 *
 * NOT `options.timeoutSeconds`. That budget is for Synced+Healthy of the
 * included roster. Run 33684309073 spent all 2400s of it on `kubectl get
 * application hat-system` returning NotFound. Kindnetd on the same SHA had
 * children in well under three minutes. Three minutes is enough to know the
 * catalog is producing objects; forty is the health wait, used later.
 */
export const REPO_BACKED_CHILD_APPEAR_TIMEOUT_SECONDS = 180;

export function repoBackedChildNames(snapshots: readonly ArgoApplicationSnapshot[]): readonly string[] {
  return snapshots.map((snapshot) => snapshot.name).filter((name) => name !== ROOT_DEV_APPLICATION_NAME);
}

/**
 * Catalog DNS is already broken: waiting 180s (or 2400s) cannot clone
 * github.com. MEASURED run 33695849211 had this ComparisonError at T+0 of
 * the child wait; the wait still burned the full 180s cap.
 */
const GITHUB_HOST_UNRESOLVABLE =
  /could not resolve host:\s*github\.com|lookup github\.com|error resolving git hostname/i;

export function applicationConditionTexts(snapshot: ArgoApplicationSnapshot): readonly string[] {
  const fromConditions = (snapshot.conditions ?? []).map((condition) =>
    condition.type.length > 0 ? `${condition.type}: ${condition.message}` : condition.message,
  );
  return snapshot.message.length > 0 ? [snapshot.message, ...fromConditions] : fromConditions;
}

export function isGitHubHostUnresolvableText(text: string): boolean {
  // Hostname match is the regex, not `text.includes("github.com")`.
  // `includes` is js/incomplete-url-substring-sanitization (CodeQL on #16419):
  // the host can sit anywhere in a longer URL. The measured strings bind it
  // after `host:` / `lookup ` / `git hostname`.
  return GITHUB_HOST_UNRESOLVABLE.test(text);
}

export function rootCatalogGitHostFailure(snapshots: readonly ArgoApplicationSnapshot[]): Failure | null {
  const root = snapshots.find((snapshot) => snapshot.name === ROOT_DEV_APPLICATION_NAME);
  if (root === undefined) return null;
  const hit = applicationConditionTexts(root).find(isGitHubHostUnresolvableText);
  if (hit === undefined) return null;
  return {
    kind: "ArgoCdTimeout",
    message: "zeta-root-dev cannot clone github.com (ComparisonError); waiting will not produce children",
    terminal: true,
    detail: {
      syncStatus: root.syncStatus,
      healthStatus: root.healthStatus,
      evidence: hit,
      conditions: root.conditions ?? [],
    },
  };
}

/**
 * Overlay git is up (readiness GET /info/refs succeeded) but the smart-HTTP
 * probe was answered as dumb HTTP. MEASURED live-kind-included + live-k3d
 * 33824995558: `failed to list refs: unexpected EOF`, child-application-count
 * 0/Count, argocd=Missing. Waiting 900s for vault or 1200s for health cannot
 * create Applications that were never listed. Same shape as
 * `rootCatalogGitHostFailure`. This is NOT missing helm chart deps.
 */
const REFS_UNEXPECTED_EOF = /failed to list refs:\s*unexpected EOF/i;

export function isLaneTreeRefsListFailureText(text: string): boolean {
  return REFS_UNEXPECTED_EOF.test(text);
}

export function rootCatalogRefsFailure(snapshots: readonly ArgoApplicationSnapshot[]): Failure | null {
  const root = snapshots.find((snapshot) => snapshot.name === ROOT_DEV_APPLICATION_NAME);
  if (root === undefined) return null;
  const hit = applicationConditionTexts(root).find(isLaneTreeRefsListFailureText);
  if (hit === undefined) return null;
  return {
    kind: "ArgoCdTimeout",
    message:
      "zeta-root-dev cannot list refs on the catalog git (ComparisonError unexpected EOF); waiting will not produce children",
    terminal: true,
    detail: {
      syncStatus: root.syncStatus,
      healthStatus: root.healthStatus,
      evidence: hit,
      conditions: root.conditions ?? [],
    },
  };
}

export const HEALTH_WAIT_LAGGARD_LIMIT = 8;

export function formatHealthWaitProgress(elapsedSec: number, verdicts: readonly ApplicationVerdict[]): string {
  const okCount = verdicts.filter((verdict) => verdict.ok).length;
  const laggards = verdicts.filter((verdict) => !verdict.ok);
  const shown = laggards
    .slice(0, HEALTH_WAIT_LAGGARD_LIMIT)
    .map((verdict) => `${verdict.name}=${verdict.syncStatus}/${verdict.healthStatus}`);
  const extra =
    laggards.length > HEALTH_WAIT_LAGGARD_LIMIT ? ` +${String(laggards.length - HEALTH_WAIT_LAGGARD_LIMIT)}` : "";
  const laggardText = shown.length === 0 ? "none" : `${shown.join(", ")}${extra}`;
  return (
    `still waiting (${String(elapsedSec)}s): health ${String(okCount)}/` +
    `${String(verdicts.length)} ok; laggards: ${laggardText}`
  );
}

/**
 * ArgoCD `Synced/Degraded` is a terminal health class. Progressing and
 * Missing can still become Healthy if we wait. Once an Application has
 * compared cleanly AND reports Degraded, the workload already failed its
 * probes; the remaining `--timeout-sec` (2400s in CI) cannot heal it.
 *
 * MEASURED live-kind-included 33817974673 on PR #16533: at T+799s the wait
 * printed `mimir=Synced/Degraded` (Otto's `081M1FG1RCW`, seaweedfs auth) and
 * `agent-memory=OutOfSync/Progressing`, then kept polling through T+1044s+
 * toward the 2400s cap. `gate (required)` was already green. The job looked
 * stuck because this failure was not marked `terminal`. Same shape as
 * `rootCatalogGitHostFailure`: waiting cannot produce children / health.
 *
 * MEASURED live-kind-included 33830308187 on PR #16533: overlay git listed
 * refs (children appeared; live-k3d smoke on the same SHA was green). The
 * wait then aborted on `openziti-controller=OutOfSync/Degraded` while the
 * ziti pod was still `Init:0/1` / `PodInitializing`. Events after the abort
 * went Degraded -> Progressing -> Synced. OutOfSync/Degraded is rollout,
 * not a finished failed sync. Only Synced/Degraded is terminal.
 *
 * Progressing-only laggards still wait. Missing still waits (apps appear).
 * OutOfSync/Degraded still waits. This does not repair mimir and does not
 * re-defer agent-memory.
 */
/** The Applications a single poll reports as `Synced/Degraded`. One sample. */
export function degradedApplicationNames(verdicts: readonly ApplicationVerdict[]): readonly string[] {
  return verdicts
    .filter((verdict) => !verdict.ok && verdict.healthStatus === "Degraded" && verdict.syncStatus === "Synced")
    .map((verdict) => verdict.name);
}

export function degradedHealthTerminalFailure(verdicts: readonly ApplicationVerdict[]): Failure | null {
  const degraded = verdicts.filter(
    (verdict) => !verdict.ok && verdict.healthStatus === "Degraded" && verdict.syncStatus === "Synced",
  );
  if (degraded.length === 0) return null;
  const names = degraded.map((verdict) => `${verdict.name}=${verdict.syncStatus}/${verdict.healthStatus}`).join(", ");
  return {
    kind: "ApplicationUnhealthy",
    message: `asserted Application is Degraded (${names}); waiting the remaining health budget cannot heal it`,
    terminal: true,
    detail: degraded,
  };
}

/**
 * A DEGRADED READ ON ONE POLL IS NOT A DEGRADED APPLICATION.
 *
 * The predicate above is correct about what `Synced/Degraded` MEANS and wrong
 * about how many samples it takes to know. Acting on a single poll converts a
 * rollout blip into a hard stop, and the run then reports a failure the cluster
 * had already recovered from -- the same shape as a check that did not run
 * looking like one that passed, pointed the other way.
 *
 * MEASURED, run 34369317553 (main, `de612352`). The wait aborted at T+123s of a
 * 2400s budget on `openziti-controller=Synced/Degraded`. The cluster events
 * captured seconds later, in the same job:
 *
 *   49s  Updated health status: Progressing -> Degraded
 *   32s  Updated health status: Degraded -> Progressing
 *
 * It had already left Degraded when the abort was printed. 2277 seconds of
 * budget went unspent on an Application that was recovering.
 *
 * AND THE SAME APPLICATION DID THIS BEFORE. The docstring above records run
 * 33830308187: the wait aborted on `openziti-controller=OutOfSync/Degraded`
 * while the pod was still `Init:0/1`, and "events after the abort went
 * Degraded -> Progressing -> Synced". The remedy then was to narrow the rule
 * from any Degraded to `Synced/Degraded`. That narrowing was right and was not
 * enough, because the defect was never WHICH sync status -- it was trusting one
 * sample.
 *
 * So the abort now needs the SAME Application degraded on TWO CONSECUTIVE polls.
 * The fail-fast property this exists for is kept: a genuinely dead workload is
 * still abandoned after roughly one poll interval (15s in CI) instead of 2400s.
 * What is removed is the single-sample false positive.
 *
 * Not a debounce over time, deliberately: consecutive POLLS, so the guarantee
 * does not silently change when `--poll-sec` moves.
 *
 * SUPERSEDED at the `waitForApplications` call site by
 * `evidenceBasedDegradedTerminalFailure` below (081KSXN940008QG0R000SCP2H1,
 * run 35628762464) -- kept, exported, and still under test rather than
 * deleted, because it is the regression pin for the false positive it fixed
 * (run 34369317553) and its own tests are the record of that measurement.
 */
export function confirmedDegradedTerminalFailure(
  previous: readonly ApplicationVerdict[],
  current: readonly ApplicationVerdict[],
): Failure | null {
  const previouslyDegraded = new Set(degradedApplicationNames(previous));
  if (previouslyDegraded.size === 0) return null;
  const confirmed = current.filter((verdict) => previouslyDegraded.has(verdict.name));
  return degradedHealthTerminalFailure(confirmed);
}

/**
 * EVIDENCE-BASED TERMINAL DEGRADED (081KSXN940008QG0R000SCP2H1, daily schedule red
 * since 2026-09-19: runs 35456502519 / 35524259964 / 35628762464).
 *
 * `confirmedDegradedTerminalFailure` above narrowed the false-positive class from
 * "one Degraded poll" to "two consecutive Degraded polls" (~15s in CI), which
 * fixed the openziti-controller flake it was measured against. It is still a
 * SAMPLE-COUNT rule, and sample count is the wrong axis: MEASURED run
 * 35628762464 aborted at ~T+10min of a 2400s budget on
 * `kube-prometheus-stack=Synced/Degraded` while every one of its pods was
 * simply `PodInitializing` -- still pulling images / provisioning a Longhorn
 * PVC. Two consecutive polls of an ordinary, still-in-progress first rollout
 * satisfy the old rule exactly as well as two polls of a genuinely dead
 * workload; the rule cannot tell them apart because it never looks past the
 * Application's own `health.status` string. Argo's health for
 * Prometheus/Alertmanager CRs (and any Deployment before its
 * `progressDeadlineSeconds`) legitimately reports Degraded for MINUTES during
 * a first rollout -- this is documented Argo behaviour, not a bug in Argo.
 *
 * So: terminal-ness is now a question about the WORKLOAD, not about how many
 * times ArgoCD printed the word. An Application is terminally Degraded only
 * when
 *
 *   (a) a pod it owns shows HARD evidence waiting cannot fix --
 *       `podBlockingReason` below: CrashLoopBackOff at/above a restart
 *       threshold, ImagePullBackOff/ErrImagePull, CreateContainerConfigError,
 *       or FailedScheduling on insufficient resources -- fires on the FIRST
 *       poll that sees it, which is MORE fail-fast than the two-poll rule for
 *       a genuinely dead workload; or
 *
 *   (b) it has been continuously Synced/Degraded past a bounded ceiling
 *       (`DEGRADED_CEILING_SECONDS`) with NO pod making progress -- i.e. none
 *       of its pods are in an ordinary still-starting state
 *       (`podStillProvisioning`).
 *
 * A pod that is Pending/ContainerCreating/PodInitializing/`Init:N/M`, or
 * Running-but-not-Ready inside a short startup grace window, blocks BOTH
 * paths: it is evidence of an ordinary rollout, not of a stuck one, so the
 * wait keeps waiting.
 */

export interface PodContainerState {
  readonly name: string;
  readonly restartCount: number;
  readonly ready: boolean;
  readonly running: boolean;
  readonly waitingReason: string;
  readonly waitingMessage: string;
  readonly terminatedReason: string;
  readonly terminatedExitCode: number | null;
}

export interface PodSnapshot {
  readonly namespace: string;
  readonly name: string;
  /** `status.phase`: Pending | Running | Succeeded | Failed | Unknown | "". */
  readonly phase: string;
  /** `metadata.labels["app.kubernetes.io/instance"]`, `""` if absent. */
  readonly instanceLabel: string;
  /** `metadata.creationTimestamp`, parsed; `null` if absent/unparseable. */
  readonly startedAtMs: number | null;
  /** `status.conditions[type=PodScheduled, status=False].reason`, `""` if scheduled or unknown. */
  readonly scheduledFailureReason: string;
  readonly scheduledFailureMessage: string;
  readonly initContainers: readonly PodContainerState[];
  readonly containers: readonly PodContainerState[];
}

function podContainerState(raw: unknown): PodContainerState | null {
  const c = asRecord(raw);
  if (c === null) return null;
  const name = typeof c["name"] === "string" ? c["name"] : "";
  if (name === "") return null;
  const state = asRecord(c["state"]);
  const waiting = state ? asRecord(state["waiting"]) : null;
  const terminated = state ? asRecord(state["terminated"]) : null;
  return {
    name,
    restartCount: typeof c["restartCount"] === "number" ? c["restartCount"] : 0,
    ready: c["ready"] === true,
    running: state !== null && asRecord(state["running"]) !== null,
    waitingReason: waiting && typeof waiting["reason"] === "string" ? waiting["reason"] : "",
    waitingMessage: waiting && typeof waiting["message"] === "string" ? waiting["message"] : "",
    terminatedReason: terminated && typeof terminated["reason"] === "string" ? terminated["reason"] : "",
    terminatedExitCode: terminated && typeof terminated["exitCode"] === "number" ? terminated["exitCode"] : null,
  };
}

const POD_INSTANCE_LABEL = "app.kubernetes.io/instance";

/** Exported for unit tests: parse `kubectl get pods -A -o json` into full pod snapshots. */
export function podsFromPodsJson(stdout: string): readonly PodSnapshot[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  const items = asRecord(parsed)?.["items"];
  if (!Array.isArray(items)) return [];
  const out: PodSnapshot[] = [];
  for (const item of items) {
    const pod = asRecord(item);
    if (pod === null) continue;
    const meta = asRecord(pod["metadata"]);
    const status = asRecord(pod["status"]);
    const namespace = meta && typeof meta["namespace"] === "string" ? meta["namespace"] : "";
    const name = meta && typeof meta["name"] === "string" ? meta["name"] : "";
    if (namespace === "" || name === "") continue;
    const labels = meta ? asRecord(meta["labels"]) : null;
    const instanceLabel = labels && typeof labels[POD_INSTANCE_LABEL] === "string" ? labels[POD_INSTANCE_LABEL] : "";
    const creationTimestamp = meta && typeof meta["creationTimestamp"] === "string" ? meta["creationTimestamp"] : "";
    const parsedStart = creationTimestamp === "" ? NaN : Date.parse(creationTimestamp);
    const phase = status && typeof status["phase"] === "string" ? status["phase"] : "";
    const conditions = status && Array.isArray(status["conditions"]) ? status["conditions"] : [];
    let scheduledFailureReason = "";
    let scheduledFailureMessage = "";
    for (const cond of conditions) {
      const c = asRecord(cond);
      if (c !== null && c["type"] === "PodScheduled" && c["status"] === "False") {
        scheduledFailureReason = typeof c["reason"] === "string" ? c["reason"] : "";
        scheduledFailureMessage = typeof c["message"] === "string" ? c["message"] : "";
      }
    }
    const initRaw = status && Array.isArray(status["initContainerStatuses"]) ? status["initContainerStatuses"] : [];
    const containersRaw = status && Array.isArray(status["containerStatuses"]) ? status["containerStatuses"] : [];
    out.push({
      namespace,
      name,
      phase,
      instanceLabel,
      startedAtMs: Number.isNaN(parsedStart) ? null : parsedStart,
      scheduledFailureReason,
      scheduledFailureMessage,
      initContainers: initRaw.flatMap((c) => {
        const s = podContainerState(c);
        return s === null ? [] : [s];
      }),
      containers: containersRaw.flatMap((c) => {
        const s = podContainerState(c);
        return s === null ? [] : [s];
      }),
    });
  }
  return out;
}

/**
 * Which live pods belong to a given Application.
 *
 * ROBUSTNESS CHOICE, and why namespace rather than owner-reference chains or
 * the instance label alone: ArgoCD's default resource-tracking method writes
 * `app.kubernetes.io/instance: <app-name>` onto the TOP-LEVEL manifests it
 * applies directly, but a Pod is normally created by a Deployment/StatefulSet
 * CONTROLLER, not applied by ArgoCD itself -- so the label reaches a Pod only
 * when the chart's own template also carries it, and that varies chart to
 * chart. It does NOT hold for kube-prometheus-stack's
 * prometheus-operator-generated Prometheus/Alertmanager StatefulSets (one of
 * the two measured false positives this evidence pipeline exists to fix,
 * alongside openziti-controller) -- prometheus-operator names and labels
 * those pods itself. Walking owner references (Pod -> ReplicaSet ->
 * Deployment) would be exact regardless of chart convention, but costs a
 * second live `kubectl get replicasets -A` call plus chain-resolution on
 * every poll.
 *
 * `spec.destination.namespace` is ArgoCD's own declaration of where an
 * Application's resources land: always present the instant the Application
 * object exists (no comparison has to have run first, unlike `status.resources`),
 * one field already inside the Application list this poll loop already
 * fetches, and true ground truth rather than a chart convention. Measured
 * against this repo's own catalogue (every `full-ai-cluster/k8s/applications/<dir>/Application.yaml`),
 * destination namespace is EXCLUSIVE to one Application for all but four
 * namespaces (`cert-manager`: cert-manager+trust-manager; `kube-system`:
 * cilium+cilium-lb-ipam+sealed-secrets; `models`: deepseek-coder+qwen-coder;
 * `spire`: spire+spire-crds) -- for those, the instance label (present or
 * not) disambiguates: a labelled pod is attributed to the Application it
 * names, and an UNLABELLED pod in a shared namespace is attributed to NONE of
 * the Applications sharing it, never guessed. That is the fail-closed
 * direction for a function feeding a terminal-failure decision: an unmatched
 * pod cannot manufacture false "terminal" evidence, it can only cost a missed
 * one, which the bounded ceiling (case (b) above) still catches.
 */
export function podsBelongingToApplication(
  app: { readonly name: string; readonly namespace?: string },
  allApplications: readonly { readonly name: string; readonly namespace?: string }[],
  pods: readonly PodSnapshot[],
): readonly PodSnapshot[] {
  const namespace = app.namespace ?? "";
  if (namespace === "") return [];
  const sharedNamespace = allApplications.some(
    (other) => other.name !== app.name && (other.namespace ?? "") === namespace,
  );
  return pods.filter((pod) => {
    if (pod.namespace !== namespace) return false;
    return sharedNamespace ? pod.instanceLabel === app.name : true;
  });
}

/**
 * Restarts this low are ordinary during a first rollout (a dependency not up
 * yet, a slow migration retried once). Kubernetes itself does not report the
 * `CrashLoopBackOff` waiting reason until the kubelet's own backoff has
 * already run a few cycles, so requiring the reason ALONE (no restart floor)
 * already excludes the single-crash case; the floor is a second, explicit
 * margin against flagging a pod still inside its first few attempts.
 */
export const CRASHLOOP_RESTART_TERMINAL_THRESHOLD = 3;

const HARD_FAILURE_WAITING_REASONS: ReadonlySet<string> = new Set([
  "ImagePullBackOff",
  "ErrImagePull",
  "CreateContainerConfigError",
]);

/**
 * A single pod-level reason waiting CANNOT fix: CrashLoopBackOff at/above the
 * restart threshold, ImagePullBackOff/ErrImagePull, CreateContainerConfigError
 * (a referenced Secret/ConfigMap key is missing), or FailedScheduling on
 * insufficient resources. `null` for everything else -- including a pod that
 * is simply unhealthy for a reason not on this list, which is a "no opinion"
 * result, not a "healthy" one; that distinction is what keeps the bounded
 * ceiling in `degradedApplicationTerminalEvidence` load-bearing.
 */
export function podBlockingReason(pod: PodSnapshot): string | null {
  if (pod.scheduledFailureReason === "Unschedulable" && /insufficient/i.test(pod.scheduledFailureMessage)) {
    return `FailedScheduling (${pod.scheduledFailureMessage})`;
  }
  for (const container of [...pod.initContainers, ...pod.containers]) {
    if (
      container.waitingReason === "CrashLoopBackOff" &&
      container.restartCount >= CRASHLOOP_RESTART_TERMINAL_THRESHOLD
    ) {
      return `container ${container.name} CrashLoopBackOff (restarts=${String(container.restartCount)})`;
    }
    if (HARD_FAILURE_WAITING_REASONS.has(container.waitingReason)) {
      const detail = container.waitingMessage.length > 0 ? `: ${container.waitingMessage}` : "";
      return `container ${container.name} ${container.waitingReason}${detail}`;
    }
  }
  return null;
}

/**
 * Grace window for "Running but not yet Ready". A heuristic, not a probe-spec
 * reader: reading each container's `readinessProbe.initialDelaySeconds` would
 * be exact, but this only needs to separate "just started" from "stuck", and
 * 90s comfortably covers the measured false positive (kube-prometheus-stack's
 * default probes) without stretching the ceiling rule's own 600s budget so
 * far that a genuinely stuck Application waits nearly as long as before.
 */
export const STILL_STARTING_GRACE_SECONDS = 90;

/**
 * True when a pod's current state is ordinary rollout/startup -- the cases
 * the task names as explicitly NOT terminal: Pending (awaiting scheduling or
 * provisioning), an init container that has not yet terminated (`Init:N/M`),
 * a main container waiting on `PodInitializing`/`ContainerCreating`, or
 * Running-but-not-Ready inside the startup grace window. Hard evidence
 * (`podBlockingReason`) always wins over "still provisioning" -- a
 * CrashLoopBackOff init container is not a pod making progress.
 */
export function podStillProvisioning(pod: PodSnapshot, nowMs: number): boolean {
  if (podBlockingReason(pod) !== null) return false;
  if (pod.phase === "Pending" || pod.phase === "") return true;
  if (pod.initContainers.some((c) => c.terminatedReason === "")) return true; // Init:N/M
  if (pod.containers.some((c) => c.waitingReason === "PodInitializing" || c.waitingReason === "ContainerCreating")) {
    return true;
  }
  const ageMs = pod.startedAtMs === null ? null : nowMs - pod.startedAtMs;
  const stillYoung = ageMs === null || ageMs < STILL_STARTING_GRACE_SECONDS * 1000;
  return pod.phase === "Running" && stillYoung && pod.containers.some((c) => !c.ready);
}

export const DEGRADED_CEILING_SECONDS = 600;

export interface DegradedAppEvidence {
  readonly name: string;
  readonly syncStatus: string;
  readonly healthStatus: string;
  /** Seconds this Application has been CONTINUOUSLY Synced/Degraded, tracked across polls. */
  readonly degradedForSec: number;
  /** Live pods already filtered to this Application via `podsBelongingToApplication`. */
  readonly pods: readonly PodSnapshot[];
}

/** Pure per-Application decision; `null` means "not (yet) terminal, keep waiting". */
export function degradedApplicationTerminalEvidence(
  evidence: DegradedAppEvidence,
  nowMs: number,
): { readonly reason: string; readonly detail: unknown } | null {
  if (evidence.syncStatus !== "Synced" || evidence.healthStatus !== "Degraded") return null;
  for (const pod of evidence.pods) {
    const hard = podBlockingReason(pod);
    if (hard !== null) {
      return {
        reason: `${evidence.name}: pod ${pod.namespace}/${pod.name} ${hard}`,
        detail: { application: evidence.name, pod: `${pod.namespace}/${pod.name}`, evidence: hard },
      };
    }
  }
  if (evidence.degradedForSec < DEGRADED_CEILING_SECONDS) return null;
  if (evidence.pods.some((pod) => podStillProvisioning(pod, nowMs))) return null;
  return {
    reason:
      `${evidence.name}: Synced/Degraded for ${String(evidence.degradedForSec)}s ` +
      `(ceiling ${String(DEGRADED_CEILING_SECONDS)}s) with no pod making progress`,
    detail: {
      application: evidence.name,
      degradedForSec: evidence.degradedForSec,
      pods: evidence.pods.map((p) => `${p.namespace}/${p.name}`),
    },
  };
}

/** Orchestrates `degradedApplicationTerminalEvidence` over every currently-Degraded Application. */
export function evidenceBasedDegradedTerminalFailure(
  evidences: readonly DegradedAppEvidence[],
  nowMs: number,
): Failure | null {
  const hits = evidences.flatMap((evidence) => {
    const hit = degradedApplicationTerminalEvidence(evidence, nowMs);
    return hit === null ? [] : [hit];
  });
  if (hits.length === 0) return null;
  return {
    kind: "ApplicationUnhealthy",
    message: `asserted Application is Degraded with terminal evidence: ${hits.map((hit) => hit.reason).join("; ")}`,
    terminal: true,
    detail: hits.map((hit) => hit.detail),
  };
}

/**
 * SOAK PHASE (Task B, 081KSXN940008QG0R000SCP2H1): "does it crash-loop?"
 *
 * The all-Healthy verdict `waitForApplications` returns says every asserted
 * Application reached Synced/Healthy ONCE. It says nothing about what happens
 * a minute later -- a container that starts, passes its readiness probe, and
 * then crash-loops is indistinguishable from a genuinely stable one at the
 * moment the wait stops polling. `runSoakPhase` (the impure driver, below the
 * pure functions here) keeps watching for a bounded window after that verdict
 * and turns "still Healthy after N seconds, never restarted" into part of the
 * proof rather than an assumption.
 *
 * Two independent regressions, both pure and both fixture-testable:
 *
 *   (a) `soakRestartRegressions` -- ANY container's restartCount rising above
 *       the baseline taken at the all-Healthy moment.
 *   (b) `soakApplicationInstabilityStep` -- an Application that WAS ok at the
 *       all-Healthy moment leaving Healthy/Synced for MORE THAN ONE poll (a
 *       single blip is tolerated, for the same one-sample-is-not-a-verdict
 *       reason `degradedApplicationTerminalEvidence` above does not trust one
 *       poll either).
 */

/** `${namespace}/${pod}/${container}` -> restartCount, captured once at the soak baseline. */
export function podRestartBaseline(pods: readonly PodSnapshot[]): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const pod of pods) {
    for (const container of [...pod.initContainers, ...pod.containers]) {
      map.set(`${pod.namespace}/${pod.name}/${container.name}`, container.restartCount);
    }
  }
  return map;
}

export interface SoakRestartRegression {
  readonly namespace: string;
  readonly pod: string;
  readonly container: string;
  readonly baselineRestartCount: number;
  readonly currentRestartCount: number;
  readonly terminatedReason: string;
  readonly terminatedExitCode: number | null;
}

/** Pure: which containers' restartCount rose above the soak baseline. */
export function soakRestartRegressions(
  baseline: ReadonlyMap<string, number>,
  currentPods: readonly PodSnapshot[],
): readonly SoakRestartRegression[] {
  const out: SoakRestartRegression[] = [];
  for (const pod of currentPods) {
    for (const container of [...pod.initContainers, ...pod.containers]) {
      const before = baseline.get(`${pod.namespace}/${pod.name}/${container.name}`);
      if (before !== undefined && container.restartCount > before) {
        out.push({
          namespace: pod.namespace,
          pod: pod.name,
          container: container.name,
          baselineRestartCount: before,
          currentRestartCount: container.restartCount,
          terminatedReason: container.terminatedReason,
          terminatedExitCode: container.terminatedExitCode,
        });
      }
    }
  }
  return out;
}

/**
 * Pure step: given the consecutive-not-ok streak per Application BEFORE this
 * poll (only Applications that WERE ok at the soak baseline are tracked at
 * all), and this poll's verdicts, returns the updated streak and exactly the
 * Applications this poll pushed from 1 to 2 -- so a regression is reported
 * once, on the poll that confirms it, not on every poll after.
 */
export function soakApplicationInstabilityStep(
  previousStreak: ReadonlyMap<string, number>,
  baselineOkNames: ReadonlySet<string>,
  currentVerdicts: readonly ApplicationVerdict[],
): { readonly streak: ReadonlyMap<string, number>; readonly newlyUnstable: readonly ApplicationVerdict[] } {
  const streak = new Map<string, number>();
  const newlyUnstable: ApplicationVerdict[] = [];
  for (const verdict of currentVerdicts) {
    if (!baselineOkNames.has(verdict.name) || verdict.ok) continue;
    const count = (previousStreak.get(verdict.name) ?? 0) + 1;
    streak.set(verdict.name, count);
    if (count === 2) newlyUnstable.push(verdict);
  }
  return { streak, newlyUnstable };
}

/** Shapes a soak-phase regression (either kind, or both) into one Failure. `null` if neither fired. */
export function soakRegressionFailure(
  restartRegressions: readonly SoakRestartRegression[],
  newlyUnstableApps: readonly ApplicationVerdict[],
): Failure | null {
  if (restartRegressions.length === 0 && newlyUnstableApps.length === 0) return null;
  const restartLines = restartRegressions.map((r) => {
    const termination =
      r.terminatedReason.length === 0
        ? ""
        : ` (last termination: ${r.terminatedReason}${r.terminatedExitCode === null ? "" : ` exit ${String(r.terminatedExitCode)}`})`;
    return (
      `${r.namespace}/${r.pod} [${r.container}] restartCount ${String(r.baselineRestartCount)} -> ` +
      `${String(r.currentRestartCount)}${termination}`
    );
  });
  // Names the RESOURCE, not only the Application (081M34AW07F087G0R001KATSP6):
  // run 35713533700 named the app-level failure ("argo-workflows left
  // Healthy/Synced (OutOfSync/Progressing)") with nothing to grep for in the
  // `##[error]` line itself -- the resource that actually drifted
  // (`CustomResourceDefinition/workfloweventbindings.argoproj.io`) only
  // appeared several thousand log lines later, in a separate diagnostics dump
  // this same line does not draw from. `outOfSyncResources` is absent (not
  // `[]`) whenever the Application went unstable for a reason `status.resources`
  // cannot carry -- health regressed with no OutOfSync resource, or the poll
  // that produced this verdict never populated it -- so that case still reads
  // exactly as it did before this field existed, rather than claiming a
  // resource-level cause nothing measured.
  const appLines = newlyUnstableApps.map((a) => {
    const resources =
      a.outOfSyncResources !== undefined && a.outOfSyncResources.length > 0
        ? ` [${a.outOfSyncResources.join(", ")}]`
        : "";
    // The HEALTH side, which the line above cannot carry: an Application that
    // went Synced/Progressing had no out-of-sync resource to name, so this is
    // the only thing that says which Deployment/StatefulSet regressed and why.
    const unhealthy =
      a.unhealthyResources !== undefined && a.unhealthyResources.length > 0
        ? ` {unhealthy: ${a.unhealthyResources.join("; ")}}`
        : "";
    return `${a.name} left Healthy/Synced (${a.syncStatus}/${a.healthStatus})${resources}${unhealthy}`;
  });
  return {
    kind: "ApplicationUnhealthy",
    message: `soak phase detected instability after the all-Healthy verdict: ${[...restartLines, ...appLines].join("; ")}`,
    detail: { restartRegressions, newlyUnstableApps },
  };
}

/**
 * STARTUP-RESTARTS report (Task B): every container with restartCount>0 AT
 * THE all-Healthy MOMENT -- i.e. it already crash-looped and self-healed
 * BEFORE the wait ever stopped polling. Not itself a soak-phase regression
 * (see `soakRestartRegressions` above, which measures increases FROM this
 * baseline); this is the ordering-smell report -- "mimir crash-looping on
 * 'ring doesn't exist in KV store'" is the measured example.
 */
export interface StartupRestartEntry {
  /** Owning Application name, or `""` if `podsBelongingToApplication` could not attribute it. */
  readonly app: string;
  readonly namespace: string;
  readonly pod: string;
  readonly container: string;
  readonly restartCount: number;
}

export function startupRestartEntries(
  pods: readonly PodSnapshot[],
  applications: readonly { readonly name: string; readonly namespace?: string }[],
): readonly StartupRestartEntry[] {
  const owners = new Map<string, string>(); // `${namespace}/${pod}` -> app name
  for (const app of applications) {
    for (const pod of podsBelongingToApplication(app, applications, pods)) {
      owners.set(`${pod.namespace}/${pod.name}`, app.name);
    }
  }
  const out: StartupRestartEntry[] = [];
  for (const pod of pods) {
    const app = owners.get(`${pod.namespace}/${pod.name}`) ?? "";
    for (const container of [...pod.initContainers, ...pod.containers]) {
      if (container.restartCount > 0) {
        out.push({ app, namespace: pod.namespace, pod: pod.name, container: container.name, restartCount: container.restartCount });
      }
    }
  }
  // Ordinal, per .claude/rules/culture-invariant-by-default.md -- this ordering
  // is compared against a checked-in baseline file, not just displayed.
  return [...out].sort((a, b) =>
    stringCompare(`${a.app}/${a.namespace}/${a.pod}/${a.container}`, `${b.app}/${b.namespace}/${b.pod}/${b.container}`),
  );
}

/**
 * STARTUP-RESTART POLICY -- threshold-based, not a both-directions exact
 * ratchet.
 *
 * MEASURED, 081KSXN940008QG0R000SCP2H1: run 35692573183 (the first live run
 * with --soak-sec) named 8 (app, container) pairs, all restartCount 1-3. Run
 * 35695291413 -- the SAME tree, one push later -- named two DIFFERENT pairs
 * (argocd/repo-server, spire/spire-controller-manager) that had not restarted
 * the first time. A both-directions exact-match ratchet (the original design
 * here) treats a 1-2-restart dependency-ordering wait as equivalent in
 * severity to a genuine crash loop, and BOTH directions of "the set changed"
 * as a failure -- which cannot be right for a signal this run-to-run
 * nondeterministic: it would flake red on an unrelated PR most nights.
 *
 * So the policy is a THRESHOLD, per (app, container), not a set-equality
 * ratchet:
 *
 *   restartCount >= STARTUP_RESTART_HARD_FAIL_THRESHOLD (a real crash loop,
 *   not a single dependency-ordering retry) -- FAIL, unless the baseline
 *   names this (app, container) with a `maxRestarts` at or above the
 *   observed count (a KNOWN, bounded startup race, already investigated).
 *
 *   restartCount below the threshold and not covered by the baseline -- a
 *   WARNING (annotation + summary line), never a failure. This is the
 *   ordinary, expected shape of a first-rollout dependency wait.
 *
 *   A baseline entry NOT measured this run -- a NOTICE, never a failure.
 *   Absence is the expected case most runs (the dependency happened to come
 *   up in the right order this time). Its `lastSeen` date is what stops a
 *   baseline entry from silently documenting a container that no longer
 *   exists: unseen for more than STARTUP_RESTART_STALE_DAYS is flagged
 *   `stale`, a prompt to re-verify or retire the row, not a failure either.
 */
export interface StartupRestartBaselineEntry {
  readonly app: string;
  readonly container: string;
  /** Tolerated restartCount for this (app, container): observed <= maxRestarts is covered, never fails or warns. */
  readonly maxRestarts: number;
  readonly reason: string;
  /** ISO date (YYYY-MM-DD) this entry was last actually measured. */
  readonly lastSeen: string;
}

/** A real crash loop, never a single dependency-ordering retry: kubelet does not usually report CrashLoopBackOff below this either. */
export const STARTUP_RESTART_HARD_FAIL_THRESHOLD = 3;
/** A baseline row unseen this long is a prompt to re-verify or retire it, not evidence it is still true. */
export const STARTUP_RESTART_STALE_DAYS = 14;

function startupRestartKey(app: string, container: string): string {
  return `${app}::${container}`;
}

/** `null` when the baseline covers this entry (observed <= maxRestarts): no action. */
export function classifyStartupRestartEntry(
  entry: StartupRestartEntry,
  baseline: ReadonlyMap<string, StartupRestartBaselineEntry>,
): "ok" | "warn" | "fail" {
  const known = baseline.get(startupRestartKey(entry.app, entry.container));
  const covered = known !== undefined && known.maxRestarts >= entry.restartCount;
  if (covered) return "ok";
  return entry.restartCount >= STARTUP_RESTART_HARD_FAIL_THRESHOLD ? "fail" : "warn";
}

export interface StartupRestartFailureDetail {
  readonly entry: StartupRestartEntry;
  /** `null` when this (app, container) is not in the baseline at all. */
  readonly baselineMaxRestarts: number | null;
}

export interface AbsentBaselineEntry {
  readonly entry: StartupRestartBaselineEntry;
  readonly daysSinceLastSeen: number;
  readonly stale: boolean;
}

export interface StartupRestartClassification {
  readonly failures: readonly StartupRestartFailureDetail[];
  readonly warnings: readonly StartupRestartEntry[];
  readonly absent: readonly AbsentBaselineEntry[];
}

/** Pure: the whole policy above, applied to one measurement against one baseline. */
export function classifyStartupRestarts(
  measured: readonly StartupRestartEntry[],
  baseline: readonly StartupRestartBaselineEntry[],
  nowMs: number,
): StartupRestartClassification {
  const byKey = new Map(baseline.map((entry) => [startupRestartKey(entry.app, entry.container), entry]));
  const failures: StartupRestartFailureDetail[] = [];
  const warnings: StartupRestartEntry[] = [];
  for (const entry of measured) {
    const verdict = classifyStartupRestartEntry(entry, byKey);
    if (verdict === "ok") continue;
    if (verdict === "fail") {
      failures.push({ entry, baselineMaxRestarts: byKey.get(startupRestartKey(entry.app, entry.container))?.maxRestarts ?? null });
    } else {
      warnings.push(entry);
    }
  }
  const measuredKeys = new Set(measured.map((entry) => startupRestartKey(entry.app, entry.container)));
  const absent: AbsentBaselineEntry[] = baseline
    .filter((entry) => !measuredKeys.has(startupRestartKey(entry.app, entry.container)))
    .map((entry) => {
      const lastSeenMs = Date.parse(entry.lastSeen);
      const daysSinceLastSeen = Number.isNaN(lastSeenMs) ? Number.POSITIVE_INFINITY : (nowMs - lastSeenMs) / 86_400_000;
      return { entry, daysSinceLastSeen, stale: daysSinceLastSeen > STARTUP_RESTART_STALE_DAYS };
    });
  return { failures, warnings, absent };
}

/** `null` when nothing crossed the hard-fail threshold -- warnings and absences never produce a Failure. */
export function startupRestartFailure(classification: StartupRestartClassification): Failure | null {
  if (classification.failures.length === 0) return null;
  const lines = classification.failures.map((f) => {
    const covered =
      f.baselineMaxRestarts === null ? "not in the baseline" : `exceeds baseline maxRestarts=${String(f.baselineMaxRestarts)}`;
    return `${f.entry.app === "" ? "(unmatched)" : f.entry.app}/${f.entry.container}: restartCount=${String(f.entry.restartCount)} (${covered})`;
  });
  return {
    kind: "ApplicationUnhealthy",
    message:
      `startup restart(s) at or above the crash-loop threshold (${String(STARTUP_RESTART_HARD_FAIL_THRESHOLD)}): ` +
      lines.join("; "),
    detail: classification,
  };
}

export const REPO_BACKED_CHILD_WAIT_DIAGNOSTIC_COMMANDS: readonly {
  readonly label: string;
  readonly args: readonly string[];
}[] = [
  { label: "zeta-root-dev", args: ["-n", "argocd", "get", "application", "zeta-root-dev", "-o", "yaml"] },
  { label: "applications", args: ["-n", "argocd", "get", "applications.argoproj.io", "-o", "wide"] },
  { label: "argocd-pods", args: ["-n", "argocd", "get", "pods", "-o", "wide"] },
  { label: "repo-server-logs", args: ["-n", "argocd", "logs", "deploy/argocd-repo-server", "--tail=150"] },
  {
    label: "application-controller-logs",
    args: ["-n", "argocd", "logs", "statefulset/argocd-application-controller", "--tail=150"],
  },
  { label: "kube-system-pods", args: ["-n", "kube-system", "get", "pods", "-o", "wide"] },
  // THE TWO BELOW ANSWER "WHY IS A POD NOT RUNNING", which this roster could not.
  //
  // Added 2026-09-06 out of `081M1TFG81G087G0R001XPQGQZ`: orleans reported
  // `Synced/Progressing` on the live lane, no crash-loop logs were captured, and the
  // bug had to be filed saying the pod was "MOST LIKELY Pending" with a "LEADING
  // HYPOTHESIS" about its CPU request. Every surface above is ArgoCD-side or
  // kube-system; nothing looked at the workload pods, so a Pending pod was diagnosed
  // by guesswork. A diagnostic bundle that cannot distinguish Pending from
  // CrashLoopBackOff is not a diagnosis, it is a prompt to speculate.
  //
  // `status.phase!=Succeeded` is on the first one deliberately: without it every
  // completed Job pod in the cluster lands in the dump and buries the one pod that
  // matters. Warning events carry the WHY -- FailedScheduling names the exact
  // insufficient resource, ImagePullBackOff names the image, FailedMount names the
  // volume -- and they are what turns "most likely Pending" into a reading.
  {
    label: "not-running-pods",
    args: [
      "get",
      "pods",
      "-A",
      "-o",
      "wide",
      "--field-selector",
      "status.phase!=Running,status.phase!=Succeeded",
    ],
  },
  {
    label: "warning-events",
    args: ["get", "events", "-A", "--field-selector", "type=Warning", "--sort-by=.lastTimestamp"],
  },
  { label: "cilium-lb-pool", args: ["get", "ciliumloadbalancerippools.cilium.io", "-o", "wide"] },
  { label: "loadbalancer-services", args: ["get", "svc", "-A", "--field-selector", "spec.type=LoadBalancer"] },
  {
    label: "coredns-corefile",
    args: ["-n", "kube-system", "get", "configmap", "coredns", "-o", "jsonpath={.data.Corefile}"],
  },
];

export function mergeArgoCdTimeoutDiagnostics(failure: Failure, dumps: Readonly<Record<string, string>>): Failure {
  // `failure.detail` has TWO shapes at the two call sites, and only one of them
  // is a record. The ArgoCd-timeout site passes `{stdout, stderr, childCount}`;
  // the health-wait site passes an ARRAY -- the verdicts for exactly the
  // Applications that missed. `asRecord` returns null for an array, so spreading
  // `existing` alone silently DROPPED the only field naming which app failed,
  // leaving `ApplicationUnhealthy` reading "one or more included dev ArgoCD
  // Applications are not Synced/Healthy" with no way to tell which. The names
  // were computed and then thrown away one line before they were printed.
  const existing = asRecord(failure.detail) ?? {};
  const unhealthy = Array.isArray(failure.detail) ? { unhealthy: failure.detail } : {};
  return {
    ...failure,
    detail: {
      ...existing,
      ...unhealthy,
      diagnostics: dumps,
    },
  };
}

/**
 * Containers that are RESTARTING, with the log line that says why.
 *
 * The static roster above answers "why is a pod not running". It cannot answer
 * "why does this pod keep dying", and the difference is not academic: a
 * CrashLoopBackOff pod is in phase **Running** between restarts, so it does not
 * appear in `not-running-pods` at all. Measured 2026-09-08 on the live lane --
 * `headscale` and `orleans` were the two Applications holding the whole
 * `included Synced+Healthy` proof open, and neither showed up in that dump. Only
 * `warning-events` caught them, with `BackOff restarting failed container`, which
 * names the SYMPTOM. The container's own last words were nowhere in the bundle.
 *
 * `--previous` is the point: the current attempt is usually still starting or
 * already dead, and the useful output is the exit of the attempt BEFORE this one.
 *
 * Bounded on purpose: the pod scan is one call, only restarting containers are
 * logged, at most `MAX_CRASHLOOP_LOGS` of them, tail-limited. A diagnostic bundle
 * that can itself hang or explode is a second failure on top of the first.
 */
const MAX_CRASHLOOP_LOGS = 8;
const CRASHLOOP_LOG_TAIL = 60;

interface RestartingContainer {
  readonly namespace: string;
  readonly pod: string;
  readonly container: string;
  readonly restarts: number;
  readonly reason: string;
}

/** Exported for unit tests: parse `kubectl get pods -A -o json` into restarting containers. */
export function restartingContainersFromPodsJson(stdout: string): RestartingContainer[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  const items = asRecord(parsed)?.["items"];
  if (!Array.isArray(items)) return [];
  const out: RestartingContainer[] = [];
  for (const item of items) {
    const pod = asRecord(item);
    const meta = asRecord(pod?.["metadata"]);
    const status = asRecord(pod?.["status"]);
    const namespace = typeof meta?.["namespace"] === "string" ? meta["namespace"] : "";
    const name = typeof meta?.["name"] === "string" ? meta["name"] : "";
    const statuses = status?.["containerStatuses"];
    if (namespace === "" || name === "" || !Array.isArray(statuses)) continue;
    for (const cs of statuses) {
      const c = asRecord(cs);
      const container = typeof c?.["name"] === "string" ? c["name"] : "";
      const restarts = typeof c?.["restartCount"] === "number" ? c["restartCount"] : 0;
      const waiting = asRecord(asRecord(c?.["state"])?.["waiting"]);
      const reason = typeof waiting?.["reason"] === "string" ? waiting["reason"] : "";
      // Either signal alone is enough: a container can be mid-restart with an
      // empty waiting state, and one that has settled into backoff may have been
      // counted already.
      if (container !== "" && (restarts > 0 || reason === "CrashLoopBackOff")) {
        out.push({ namespace, pod: name, container, restarts, reason });
      }
    }
  }
  return out.sort((a, b) => b.restarts - a.restarts);
}

function collectCrashLoopLogs(): Record<string, string> {
  const dumps: Record<string, string> = {};
  const listed = kubectl(["get", "pods", "-A", "-o", "json"], 20);
  const restarting = restartingContainersFromPodsJson(listed.stdout);
  if (restarting.length === 0) {
    // A measurement, not an absence: saying so beats an empty key that reads as
    // "nothing was looked at".
    dumps["crashloop-logs"] = "(no restarting containers found)";
    return dumps;
  }
  dumps["crashloop-summary"] = restarting
    .map((r) => `${r.namespace}/${r.pod} [${r.container}] restarts=${String(r.restarts)} ${r.reason}`)
    .join("\n");
  for (const r of restarting.slice(0, MAX_CRASHLOOP_LOGS)) {
    const result = kubectl(
      ["-n", r.namespace, "logs", r.pod, "-c", r.container, "--previous", `--tail=${String(CRASHLOOP_LOG_TAIL)}`],
      20,
    );
    const text = [result.stdout, result.stderr]
      .filter((part) => part.length > 0)
      .join("\n")
      .slice(-4000);
    dumps[`crashloop:${r.namespace}/${r.pod}/${r.container}`] =
      text.length > 0 ? text : `(no previous-container log, exit ${String(result.status)})`;
  }
  return dumps;
}

function collectRepoBackedChildWaitDiagnostics(): Record<string, string> {
  const dumps: Record<string, string> = {};
  for (const { label, args } of REPO_BACKED_CHILD_WAIT_DIAGNOSTIC_COMMANDS) {
    const result = kubectl(args, 20);
    const text = [result.stdout, result.stderr]
      .filter((part) => part.length > 0)
      .join("\n")
      .slice(-4000);
    dumps[label] = text.length > 0 ? text : `(empty, exit ${String(result.status)})`;
  }
  return { ...dumps, ...collectCrashLoopLogs() };
}

/**
 * Dump the bundle and attach it to a failure.
 *
 * TAKES THE CONTEXT LINE AS A PARAMETER BECAUSE THERE ARE TWO CALL SITES, and until
 * 2026-09-06 there was one. The bundle hung only off the repo-backed child-wait timeout,
 * so the failure class it was extended for -- `orleans is Synced/Progressing -- expected
 * Synced/Healthy`, 081M1TFG81G087G0R001XPQGQZ -- never reached it. The pod-level commands
 * were added to the roster in the same week and wired to a path that failure does not
 * take: a diagnostic that cannot fire for the case it was built for is the vacuity class
 * pointed at instrumentation, and it is worse than none, because the roster reads as
 * coverage. Measured on the included proof for #16740 (check-run 101435639577): the run
 * failed with orleans and headscale Progressing and dumped no pod state at all.
 */
function attachClusterDiagnostics(failure: Failure, context: string): Failure {
  const dumps = collectRepoBackedChildWaitDiagnostics();
  console.log(`=== ${context}; cluster state at failure ===`);
  for (const { label } of REPO_BACKED_CHILD_WAIT_DIAGNOSTIC_COMMANDS) {
    console.log(`--- ${label} ---`);
    console.log(dumps[label] ?? "");
  }
  return mergeArgoCdTimeoutDiagnostics(failure, dumps);
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

  // `--serve-tree` already pointed every rewritten Application at SERVED_GIT_REF
  // (`main`) on a repo whose only branch is `main`. Patching those to the GitHub
  // SHA is 33822942615: ArgoCD fetches the SHA as an object the served repo does
  // not contain. GitHub-hosted PR trees still take the patch below.
  if (options.serveTreeProfile !== null) return null;
  if (plan.gitRef === "main") return null;

  const childFailure = await waitForRepoBackedChild(poll);
  if (childFailure !== null) return attachClusterDiagnostics(childFailure, "repo-backed child wait timed out");

  return patchGitBackedApplicationsToGitRef(plan.gitRef);
}

/**
 * First child, not a named one. `hat-system` is wave -10 so it is usually
 * that head -- but waiting for the NAME made a silent catalog look like a
 * slow hat-system, and consumed the health timeout doing it.
 */
async function waitForRepoBackedChild(pollSeconds: number): Promise<Failure | null> {
  const message = "timed out waiting for repo-backed child Applications before git-ref patch";
  const startedAt = Date.now();
  let lastProgressAt = startedAt;
  console.log(`Waiting: ${message} (cap ${String(REPO_BACKED_CHILD_APPEAR_TIMEOUT_SECONDS)}s, any child)`);
  return waitFor(REPO_BACKED_CHILD_APPEAR_TIMEOUT_SECONDS, pollSeconds, () => {
    const now = Date.now();
    if (now - lastProgressAt >= 60_000) {
      const elapsedSec = Math.floor((now - startedAt) / 1000);
      console.log(`still waiting (${elapsedSec}s): ${message}`);
      lastProgressAt = now;
    }
    const command = ["-n", "argocd", "get", "applications.argoproj.io", "-o", "json"];
    const result = kubectl(command, Math.max(pollSeconds, 10));
    if (result.status !== 0) {
      return kubectlFailure("could not list ArgoCD Applications while waiting for children", command, result);
    }
    const snapshots = parseApplicationListOrFailure(result.stdout, command);
    if (isFailure(snapshots)) return snapshots;
    const catalogDns = rootCatalogGitHostFailure(snapshots);
    if (catalogDns !== null) return catalogDns;
    const catalogRefs = rootCatalogRefsFailure(snapshots);
    if (catalogRefs !== null) return catalogRefs;
    if (repoBackedChildNames(snapshots).length > 0) return null;
    return {
      kind: "ArgoCdTimeout",
      message,
      command: ["kubectl", ...command],
      detail: {
        stdout: result.stdout.slice(-2000),
        stderr: result.stderr.slice(-2000),
        childCount: 0,
      },
    };
  });
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

function parseApplicationConditions(status: Record<string, unknown> | null): readonly ArgoApplicationCondition[] {
  if (status === null) return [];
  const raw = status.conditions;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const record = asRecord(item);
    if (record === null) return [];
    const type = stringAt(record, "type");
    const message = stringAt(record, "message");
    if (type.length === 0 && message.length === 0) return [];
    return [{ type, message }];
  });
}

/**
 * `${kind}/${name}` for every `status.resources[]` entry whose own `status`
 * is `"OutOfSync"` -- see `ArgoApplicationSnapshot.outOfSyncResources`.
 * Ordinal-sorted, per `.claude/rules/culture-invariant-by-default.md`, and NOT
 * `localeCompare` for the same reason `stringCompare` is used elsewhere in
 * this file: this ordering feeds a failure message that must read identically
 * on every runner locale, not merely display consistently on one.
 */
function parseOutOfSyncResources(status: Record<string, unknown> | null): readonly string[] {
  if (status === null) return [];
  const raw = status.resources;
  if (!Array.isArray(raw)) return [];
  const names = raw.flatMap((item) => {
    const record = asRecord(item);
    if (record === null) return [];
    if (stringAt(record, "status") !== "OutOfSync") return [];
    const kind = stringAt(record, "kind");
    const name = stringAt(record, "name");
    if (kind.length === 0 && name.length === 0) return [];
    return [`${kind}/${name}`];
  });
  return [...names].sort(stringCompare);
}

/**
 * `${kind}/${name} ${health}: ${message}` for every `status.resources[]` entry
 * whose own `health.status` is present and not `Healthy` -- see
 * `ArgoApplicationSnapshot.unhealthyResources`. Resources ArgoCD assesses no
 * health for (CRDs, ConfigMaps, most RBAC) carry no `health` and are skipped:
 * absence of a health verdict is not an unhealthy one. Ordinal-sorted.
 */
export function parseUnhealthyResources(status: Record<string, unknown> | null): readonly string[] {
  if (status === null) return [];
  const raw = status.resources;
  if (!Array.isArray(raw)) return [];
  const lines = raw.flatMap((item) => {
    const record = asRecord(item);
    if (record === null) return [];
    const health = recordAt(record, "health");
    if (health === null) return [];
    const h = stringAt(health, "status");
    if (h.length === 0 || h === "Healthy") return [];
    const kind = stringAt(record, "kind");
    const name = stringAt(record, "name");
    const message = stringAt(health, "message");
    return [`${kind}/${name} ${h}${message.length > 0 ? `: ${message}` : ""}`];
  });
  return [...lines].sort(stringCompare);
}

export function parseApplicationList(jsonText: string): readonly ArgoApplicationSnapshot[] {
  const root = asRecord(JSON.parse(jsonText));
  const items = Array.isArray(root?.items) ? root.items : [];
  return items.flatMap((item) => {
    const itemRecord = asRecord(item);
    const metadata = itemRecord ? recordAt(itemRecord, "metadata") : null;
    const spec = itemRecord ? recordAt(itemRecord, "spec") : null;
    const destination = spec ? recordAt(spec, "destination") : null;
    const status = itemRecord ? recordAt(itemRecord, "status") : null;
    const sync = status ? recordAt(status, "sync") : null;
    const health = status ? recordAt(status, "health") : null;
    const operationState = status ? recordAt(status, "operationState") : null;
    const name = metadata ? stringAt(metadata, "name") : "";
    if (name.length === 0) return [];
    const operationPhase = operationState ? stringAt(operationState, "phase") : "";
    const syncRevision = sync ? stringAt(sync, "revision") : "";
    const conditions = parseApplicationConditions(status);
    const outOfSyncResources = parseOutOfSyncResources(status);
    const unhealthyResources = parseUnhealthyResources(status);
    const snapshot: ArgoApplicationSnapshot = {
      name,
      syncStatus: sync ? stringAt(sync, "status") : "",
      healthStatus: health ? stringAt(health, "status") : "",
      message: health ? stringAt(health, "message") : "",
      namespace: destination ? stringAt(destination, "namespace") : "",
      ...(operationPhase.length > 0 ? { operationPhase } : {}),
      ...(syncRevision.length > 0 ? { syncRevision } : {}),
      ...(conditions.length > 0 ? { conditions } : {}),
      ...(outOfSyncResources.length > 0 ? { outOfSyncResources } : {}),
      ...(unhealthyResources.length > 0 ? { unhealthyResources } : {}),
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

/**
 * ArgoCD's own name for "the sync operation FAILED", written into
 * `status.conditions` and cleared when a later sync succeeds.
 */
export const SYNC_ERROR_CONDITION_TYPE = "SyncError";

/**
 * A FAILED SYNC IS NEVER RECONCILED, WHATEVER HEALTH SAYS.
 *
 * `isApplicationSynced` below accepts `OutOfSync + Healthy` -- deliberately,
 * for benign StatefulSet and git-directory drift. But health is assessed per
 * RESOURCE KIND, and the kinds ArgoCD has no health check for contribute
 * nothing to it. Gatekeeper Constraints are such a kind. So an Application
 * whose sync genuinely failed, and whose unapplied resources are all
 * health-less, reads as `OutOfSync + Healthy` -- indistinguishable, to every
 * predicate below, from an app that synced fine and drifted afterwards.
 *
 * MEASURED, on the lane this file is the proof for. `hat-system` carried
 *
 *   SyncError: Failed last sync attempt to [c73cc49e...]: one or more
 *   synchronization tasks completed unsuccessfully (retried 10 times).
 *
 * in run 34323056405, with all seven Hat Constraints `OutOfSync`, and the same
 * seven Constraints unapplied in run 34338106811 -- which the proof PASSED.
 * The policy engine held zero installed policies in a green run, for as long
 * as the lane has existed.
 *
 * The condition is what closes it, because it is ArgoCD stating the failure
 * rather than us inferring it from two status strings that cannot carry it.
 * Scoped to the auto-sync contract: a declared manual-sync app is judged by
 * `manualSyncAssertion`, a different and weaker contract on purpose
 * (./manual-sync-policy.ts).
 *
 * NOT TERMINAL. ArgoCD retries, and clears the condition when a sync succeeds,
 * so an app carrying one stays a LAGGARD and the wait keeps waiting -- a
 * transient failure still self-heals. Only one that survives the timeout fails
 * the proof, which is the honest reading of "it never synced".
 */
export function failedSyncMessage(snapshot: ArgoApplicationSnapshot): string | null {
  const condition = (snapshot.conditions ?? []).find(
    (candidate) => candidate.type === SYNC_ERROR_CONDITION_TYPE,
  );
  if (condition === undefined) return null;
  return condition.message.length > 0 ? condition.message : "sync operation failed";
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
  const syncFailure = failedSyncMessage(snapshot);
  if (syncFailure !== null) {
    return { ok: false, reason: SYNC_ERROR_CONDITION_TYPE + ": " + syncFailure };
  }
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
        ...(snapshot.outOfSyncResources !== undefined ? { outOfSyncResources: snapshot.outOfSyncResources } : {}),
    ...(snapshot.unhealthyResources !== undefined ? { unhealthyResources: snapshot.unhealthyResources } : {}),
        ...(snapshot.unhealthyResources !== undefined ? { unhealthyResources: snapshot.unhealthyResources } : {}),
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
    ...(snapshot.outOfSyncResources !== undefined ? { outOfSyncResources: snapshot.outOfSyncResources } : {}),
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
  // How long (continuous polls) each Application has been Synced/Degraded.
  // See evidenceBasedDegradedTerminalFailure's docstring: this REPLACES the
  // two-consecutive-poll rule that used to live here, which could not tell a
  // dead workload from an ordinary first-rollout Degraded blip (081KSXN940008QG0R000SCP2H1,
  // run 35628762464: kube-prometheus-stack aborted while its pods were merely
  // PodInitializing).
  const degradedSinceMs = new Map<string, number>();
  const startedAt = Date.now();
  let lastProgressAt = startedAt;
  console.log(`Waiting: ArgoCD Applications Synced+Healthy (cap ${String(options.timeoutSeconds)}s)`);
  const failure = await waitFor(options.timeoutSeconds, options.pollSeconds, () => {
    const command = ["-n", "argocd", "get", "applications.argoproj.io", "-o", "json"];
    const result = kubectl(command, Math.max(options.pollSeconds, 10));
    if (result.status !== 0) {
      return kubectlFailure("could not list ArgoCD Applications", command, result);
    }
    const snapshots = parseApplicationListOrFailure(result.stdout, command);
    if (isFailure(snapshots)) return snapshots;
    const catalogDns = rootCatalogGitHostFailure(snapshots);
    if (catalogDns !== null) return catalogDns;
    const catalogRefs = rootCatalogRefsFailure(snapshots);
    if (catalogRefs !== null) return catalogRefs;
    lastVerdicts =
      plan.scope === "smoke"
        ? classifySmokeApplications(snapshots)
        : isIncludedScope(plan.scope)
          ? classifyApplications(plan.expectedApplications, snapshots)
          : classifyApplications(plan.expectedApplications, snapshots);
    if (lastVerdicts.every((verdict) => verdict.ok)) return null;
    const now = Date.now();
    // EVIDENCE-BASED, not sample-count-based -- see evidenceBasedDegradedTerminalFailure.
    const currentlyDegraded = new Set(degradedApplicationNames(lastVerdicts));
    for (const name of degradedSinceMs.keys()) {
      if (!currentlyDegraded.has(name)) degradedSinceMs.delete(name);
    }
    for (const name of currentlyDegraded) {
      if (!degradedSinceMs.has(name)) degradedSinceMs.set(name, now);
    }
    if (currentlyDegraded.size > 0) {
      // Only fetches live pods (a second kubectl call) when there is a
      // Degraded Application to explain -- the common all-healthy-eventually
      // path pays nothing extra.
      const podsResult = kubectl(["get", "pods", "-A", "-o", "json"], Math.max(options.pollSeconds, 10));
      if (podsResult.status === 0) {
        const pods = podsFromPodsJson(podsResult.stdout);
        const appsByName = new Map(snapshots.map((snapshot) => [snapshot.name, snapshot]));
        const allApplications = snapshots.map((snapshot) => ({ name: snapshot.name, namespace: snapshot.namespace ?? "" }));
        const evidences: DegradedAppEvidence[] = [...currentlyDegraded].map((name) => {
          const verdict = lastVerdicts.find((v) => v.name === name);
          const app = appsByName.get(name);
          const since = degradedSinceMs.get(name) ?? now;
          return {
            name,
            syncStatus: verdict?.syncStatus ?? "",
            healthStatus: verdict?.healthStatus ?? "",
            degradedForSec: Math.floor((now - since) / 1000),
            pods: app === undefined ? [] : podsBelongingToApplication(app, allApplications, pods),
          };
        });
        const terminal = evidenceBasedDegradedTerminalFailure(evidences, now);
        if (terminal !== null) return terminal;
      }
      // A failed pod-list fetch is not itself terminal: fall through to the
      // ordinary "still waiting" verdict below rather than manufacturing a
      // second failure mode on top of whatever ArgoCD already reported.
    }
    if (now - lastProgressAt >= 60_000) {
      const elapsedSec = Math.floor((now - startedAt) / 1000);
      console.log(formatHealthWaitProgress(elapsedSec, lastVerdicts));
      lastProgressAt = now;
    }
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
  // THE SECOND CALL SITE, and the reason the bundle exists at all. This is where
  // `<app> is Synced/Progressing -- expected Synced/Healthy` gives up, which is the
  // failure the pod-level commands were added for. Attaching here is what makes
  // `not-running-pods` and `warning-events` reachable from it: a Pending pod's
  // FailedScheduling event is one line and it replaces a paragraph of hypothesis.
  if (failure !== null) return attachClusterDiagnostics(failure, "ArgoCD health wait gave up");
  return lastVerdicts;
}

const STARTUP_RESTART_BASELINE_PATH = join(REPO_ROOT, "src/Core.TypeScript/cluster/startup-restart-baseline.json");

interface StartupRestartBaselineFile {
  readonly measured: string;
  readonly allowed: readonly StartupRestartBaselineEntry[];
}

/**
 * A missing or unparseable baseline reads as EMPTY, never as "skip the
 * policy" -- an empty baseline covers nothing, so every currently-restarting
 * container is classified fresh against the hard-fail threshold (see
 * `classifyStartupRestarts`), which is the correct behaviour on a tree with
 * no baseline committed yet, not a silently-passing gate.
 */
function readStartupRestartBaseline(): readonly StartupRestartBaselineEntry[] {
  // READ, then interpret failure -- rather than existsSync() then read, which
  // is a check-then-use race (the file can vanish, or be created, between the
  // two calls; CWE-367). A missing file (ENOENT) and an unparseable one are
  // both folded into the same "empty baseline" result on purpose: this is not
  // a fatal-error path, it is what makes every currently-restarting container
  // classify fresh (uncovered) rather than silently skip the policy.
  try {
    const parsed = JSON.parse(readFileSync(STARTUP_RESTART_BASELINE_PATH, "utf8")) as Partial<StartupRestartBaselineFile>;
    return Array.isArray(parsed.allowed) ? parsed.allowed : [];
  } catch {
    return [];
  }
}

export interface SoakReport {
  readonly soakSeconds: number;
  readonly startupRestarts: readonly StartupRestartEntry[];
  readonly classification: StartupRestartClassification;
}

/**
 * The soak phase's impure driver: fetches the baseline pod/Application
 * snapshot, prints + classifies the STARTUP-RESTARTS report, then polls for
 * `options.soakSeconds` watching for a restartCount regression or an
 * Application leaving Healthy/Synced for more than one poll. All DECISIONS
 * are the pure functions above (`soakRestartRegressions`,
 * `soakApplicationInstabilityStep`, `soakRegressionFailure`,
 * `classifyStartupRestarts`, `startupRestartFailure`); this function only
 * fetches and loops.
 *
 * `options.soakSeconds <= 0` (the default -- see `DEFAULT_SOAK_SECONDS`) is a
 * full no-op: no extra kubectl calls, no report, no ratchet. Every caller
 * that does not pass `--soak-sec` sees zero behaviour change.
 */
async function runSoakPhase(
  plan: HarnessPlan,
  options: CliOptions,
  applications: readonly ApplicationVerdict[],
): Promise<{ readonly report: SoakReport | null; readonly failure: Failure | null }> {
  if (options.soakSeconds <= 0) return { report: null, failure: null };

  console.log(
    `Soak: watching for restartCount regressions and Application instability for ${String(options.soakSeconds)}s`,
  );
  const podsCommand = ["get", "pods", "-A", "-o", "json"];
  const appsCommand = ["-n", "argocd", "get", "applications.argoproj.io", "-o", "json"];

  const baselinePodsResult = kubectl(podsCommand, Math.max(options.pollSeconds, 10));
  if (baselinePodsResult.status !== 0) {
    return { report: null, failure: kubectlFailure("could not list pods for the soak baseline", podsCommand, baselinePodsResult) };
  }
  const baselinePods = podsFromPodsJson(baselinePodsResult.stdout);
  const restartBaseline = podRestartBaseline(baselinePods);

  const appsResult = kubectl(appsCommand, Math.max(options.pollSeconds, 10));
  if (appsResult.status !== 0) {
    return { report: null, failure: kubectlFailure("could not list ArgoCD Applications for the soak baseline", appsCommand, appsResult) };
  }
  const baselineSnapshots = parseApplicationListOrFailure(appsResult.stdout, appsCommand);
  // A malformed Application list here is not itself a soak-phase FINDING --
  // report it as the JSON-shaped Failure it already is, rather than silently
  // matching every pod to no Application, which would make the ratchet
  // compare a real baseline against an artificially empty one.
  if (isFailure(baselineSnapshots)) return { report: null, failure: baselineSnapshots };
  const applicationsForMatch = baselineSnapshots;

  // STARTUP-RESTARTS report + threshold policy. Measured ONCE, at the all-Healthy
  // moment these pods were already retrieved for -- restarts the workload
  // recovered from BEFORE the soak started, an ordering smell, not a
  // soak-phase regression (that is `soakRestartRegressions` in the poll loop
  // below, which measures increases FROM this same baseline).
  const startupRestarts = startupRestartEntries(
    baselinePods,
    applicationsForMatch.map((snapshot) => ({ name: snapshot.name, namespace: snapshot.namespace ?? "" })),
  );
  console.log(
    `STARTUP-RESTARTS (restartCount>0 at the all-Healthy moment -- self-healed before the wait stopped polling): ${String(startupRestarts.length)}`,
  );
  for (const entry of startupRestarts) {
    console.log(`  ${entry.app === "" ? "(unmatched)" : entry.app} ${entry.namespace}/${entry.pod} [${entry.container}] restarts=${String(entry.restartCount)}`);
  }
  const baseline = readStartupRestartBaseline();
  const classification = classifyStartupRestarts(startupRestarts, baseline, Date.now());
  const report: SoakReport = { soakSeconds: options.soakSeconds, startupRestarts, classification };
  // WARNINGS never fail the run -- a 1-2 restart dependency-ordering wait is
  // the ordinary shape of a first rollout (081KSXN940008QG0R000SCP2H1: run
  // 35695291413 named two such pairs the immediately preceding run had not,
  // on the identical tree). Printed as GitHub Actions annotations (`::warning::`)
  // so they surface in the Checks UI without failing the job.
  for (const entry of classification.warnings) {
    console.log(
      `::warning::startup restart below the crash-loop threshold, not yet in the baseline: ` +
        `${entry.app === "" ? "(unmatched)" : entry.app}/${entry.container} restartCount=${String(entry.restartCount)} ` +
        `(namespace ${entry.namespace}, pod ${entry.pod})`,
    );
  }
  // ABSENT baseline entries are a notice, not a failure -- absence is the
  // expected case most runs. Only flagged when stale, as a prompt to
  // re-verify or retire the row.
  for (const absent of classification.absent) {
    const staleNote = absent.stale ? ` -- STALE (unseen ${String(Math.floor(absent.daysSinceLastSeen))}d > ${String(STARTUP_RESTART_STALE_DAYS)}d)` : "";
    console.log(`  baseline entry not measured this run: ${absent.entry.app}/${absent.entry.container}${staleNote}`);
  }
  const startupFailure = startupRestartFailure(classification);
  if (startupFailure !== null) return { report, failure: startupFailure };

  // The soak polling loop: does anything crash-loop, or leave Healthy/Synced,
  // AFTER the all-Healthy verdict.
  const baselineOkNames = new Set(applications.filter((app) => app.ok).map((app) => app.name));
  let streak: ReadonlyMap<string, number> = new Map();
  const deadline = Date.now() + options.soakSeconds * 1000;
  while (Date.now() < deadline) {
    await Bun.sleep(options.pollSeconds * 1000);

    const podsPoll = kubectl(podsCommand, Math.max(options.pollSeconds, 10));
    const currentPods = podsPoll.status === 0 ? podsFromPodsJson(podsPoll.stdout) : [];
    const restartRegressions = soakRestartRegressions(restartBaseline, currentPods);

    const appsPoll = kubectl(appsCommand, Math.max(options.pollSeconds, 10));
    const currentSnapshots = appsPoll.status === 0 ? parseApplicationListOrFailure(appsPoll.stdout, appsCommand) : [];
    const currentVerdicts = isFailure(currentSnapshots)
      ? []
      : plan.scope === "smoke"
        ? classifySmokeApplications(currentSnapshots)
        : classifyApplications(plan.expectedApplications, currentSnapshots);
    const step = soakApplicationInstabilityStep(streak, baselineOkNames, currentVerdicts);
    streak = step.streak;

    const regressionFailure = soakRegressionFailure(restartRegressions, step.newlyUnstable);
    if (regressionFailure !== null) {
      return { report, failure: attachClusterDiagnostics(regressionFailure, "soak phase detected instability") };
    }
  }
  console.log(`Soak: ${String(options.soakSeconds)}s elapsed with no restartCount regression and no Application instability.`);
  return { report, failure: null };
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

  const exec = kubectlVaultExec("openbao", "openbao-0");

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

/** Same `exactOptionalPropertyTypes` discipline as `vaultReportField`: absent, not null, when the soak phase did not run. */
function soakReportField(report: SoakReport | null): { readonly soak?: SoakReport } {
  return report === null ? {} : { soak: report };
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

  const lbPoolFailure = assertKindCiliumLbPoolPresent(options);
  if (lbPoolFailure !== null) {
    return { ok: false, plan, preflight, failure: lbPoolFailure };
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

  // SOAK PHASE (Task B, 081KSXN940008QG0R000SCP2H1): "does it crash-loop?",
  // placed after the all-Healthy verdict and before the optional drift check
  // -- a no-op unless `--soak-sec` was passed (see runSoakPhase).
  const soak = await runSoakPhase(plan, options, apps);
  if (soak.failure !== null) {
    return {
      ok: false,
      plan,
      preflight,
      applications: apps,
      ...vaultReportField(vault.report),
      ...soakReportField(soak.report),
      failure: soak.failure,
    };
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
        ...soakReportField(soak.report),
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
      ...soakReportField(soak.report),
      driftRepair: "passed",
    };
  }

  return {
    ok: true,
    plan,
    preflight,
    applications: apps,
    ...vaultReportField(vault.report),
    ...soakReportField(soak.report),
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
