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
  DEV_GRAFANA_ADMIN_SECRET,
  DEV_LONGHORN_ALIAS_CLASS_NAME,
  DEV_SATISFIABLE_PROVISIONERS,
  DEV_STORAGE_ALIAS_MANIFEST_RELPATHS,
} from "./dev-cluster/lib.ts";
import { DEFAULT_ROOT_DEV_CATALOG } from "./ports.ts";
import { classifySyncPolicy, manualSyncAssertion, type AssertionOutcome } from "./manual-sync-policy.ts";

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
  | "DevGrafanaAdminSecretMissing"
  | "KubectlFailed"
  | "ArgoCdTimeout"
  | "ApplicationMissing"
  | "ApplicationUnhealthy"
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
      readonly driftRepair?: "not-requested" | "passed";
    }
  | {
      readonly ok: false;
      readonly plan?: HarnessPlan;
      readonly preflight?: readonly ToolCheck[];
      readonly applications?: readonly ApplicationVerdict[];
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
  "usage: bun src/Core.TypeScript/cluster/argocd-health-test.ts [--dry-run|--preflight|--run] [--provider k3d|kind] [--scope smoke|included|full] [--runtime docker|podman] [--git-ref REF] [--cluster-name NAME] [--config PATH] [--existing] [--timeout-sec N] [--poll-sec N] [--drift-check]";
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
export const DEV_EXCLUDED_REASONS: ReadonlyMap<string, string> = new Map([
  [
    "cilium",
    "The CNI itself. The default kind profile brings up kind's own CNI (kindnetd) BEFORE ArgoCD exists -- " +
      "nothing can schedule otherwise -- so applying this Application there would install a second CNI over a " +
      "working one. Meanwhile the configuration is not untested: the `live kind Cilium CNI` job installs it " +
      "from THIS Application's own valuesObject on a profile with no default CNI " +
      "(full-ai-cluster/dev-cluster/profiles/ci.cilium.kind-config.yaml). " +
      "LIFTS WHEN: the app-of-apps included proof runs on that profile, so ArgoCD is reconciling a cluster " +
      "whose CNI slot Cilium already owns.",
  ],
  [
    "cilium-lb-ipam",
    "CiliumLoadBalancerIPPool + CiliumL2AnnouncementPolicy are Cilium CRDs, so this Application cannot sync " +
      "at all until Cilium is the CNI. Its pool is also hard-coded to 192.168.1.240-250, a LAN range with no " +
      "meaning inside a container network -- LB IPs would be ASSIGNED (enough for ArgoCD to call it Healthy) " +
      "and routable from nothing, which is a worse outcome than not running it. " +
      "LIFTS WHEN: `cilium` above lifts AND the pool is parameterised per substrate rather than pinned to one " +
      "maintainer's subnet.",
  ],
  [
    "longhorn",
    "Replicated block storage wants real disks and more than one node; a single kind node inside a runner has " +
      "neither -- it needs real block devices plus open-iscsi on the node. This entry is also the ROOT of the " +
      "largest deferral group in this file: every " +
      "APPLIED_BUT_UNASSERTED_REASONS row reading 'requests storageClass: longhorn' is downstream of it, so " +
      "lifting this one collapses several. " +
      "LIFTS WHEN: a dev StorageClass provides the `longhorn` name in this lane, or the Applications that " +
      "request it are parameterised to the substrate's default class.",
  ],
  [
    "ollama",
    "Requests nvidia.com/gpu with nodeSelector zeta.io/gpu, and a 200Gi longhorn PVC. A GitHub-hosted runner " +
      "has neither, and the multi-GiB image pull alone outruns the job timeout -- so the Application would " +
      "HANG rather than fail, which is the worse of the two. " +
      "LIFTS WHEN: the lane runs on a GPU-bearing self-hosted runner (arc-runner-set), or this Application " +
      "grows a CPU-only dev profile with a small model and a substrate-default StorageClass.",
  ],
  [
    "vllm",
    "Same class as ollama: CUDA image, nvidia.com/gpu request, 200Gi longhorn PVC. " +
      "LIFTS WHEN: a GPU-bearing self-hosted runner exists for this lane, or a CPU-only dev profile ships.",
  ],
]);

const DEV_EXCLUDED_DIRS: ReadonlySet<string> = new Set(DEV_EXCLUDED_REASONS.keys());

export interface DevExclusionDrift {
  /** Excluded directories with no reason, or a reason naming no lift condition. */
  readonly unreasoned: readonly string[];
  /** Reasons for directories that no longer exist under the applications tree. */
  readonly stale: readonly string[];
}

/**
 * Both directions on the reasoned-exclusion registry.
 *
 * `unreasoned` cannot fire while `DEV_EXCLUDED_DIRS` is derived from the map's
 * own keys -- that derivation is what makes an unreasoned entry unwritable, and
 * the check stays so the property is asserted rather than merely arranged. It
 * DOES fire on a reason with no `LIFTS WHEN:` clause, which is the failure mode
 * that survives the derivation: a sentence that explains and commits to nothing.
 */
export function auditDevExclusionReasons(repoRoot = REPO_ROOT): DevExclusionDrift {
  const applicationsRoot = join(repoRoot, "full-ai-cluster/k8s/applications");
  const present = existsSync(applicationsRoot)
    ? new Set(
        readdirSync(applicationsRoot, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name),
      )
    : new Set<string>();

  return {
    unreasoned: [...DEV_EXCLUDED_DIRS]
      .filter((dir) => !(DEV_EXCLUDED_REASONS.get(dir) ?? "").includes("LIFTS WHEN:"))
      .sort(),
    stale: [...DEV_EXCLUDED_REASONS.keys()].filter((dir) => !present.has(dir)).sort(),
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
 * THREE OF THE FOUR MEASURED DEFERRALS LEFT this set on 2026-08-21, and each
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
 *      `assertDevGrafanaAdminSecretPresent` below refuses an included run whose
 *      cluster does not have it.
 *   `weaviate`              -- the chart mints `randAlphaNum` credentials on
 *      every render because ArgoCD's `helm template` cannot run its `lookup`,
 *      so the DESIRED state moved every reconcile. Two named keys of one named
 *      Secret are now in `ignoreDifferences`; the byte diff proving that is the
 *      whole drift is in the Application.
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
  // Renders `monitoring.coreos.com/v1` ServiceMonitor + PrometheusRule (CRDs
  // owned by kube-prometheus-stack, which IS asserted here as of 2026-08-21, so
  // this half of the reason no longer stands on its own) and a
  // `gateway.networking.k8s.io/v1` Gateway, and runs two images no registry
  // serves: ghcr.io/lucent-financial-group/zeta-platform-controller:latest and
  // .../zeta-portal:latest. portal.yaml also pins `storageClassName: longhorn`,
  // so the longhorn rule catches it independently.
  "platform",
  // Vault upstream CA + kind PVC wiring not ready in included CI
  // (081KSXN940008QG0R000SCP2H1). The chart's `upstreamAuthority.vault` block is
  // commented out pending a Vault that is INITIALISED -- which is why this one
  // cannot be unblocked ahead of `vault` below.
  "spire",
  // go.temporal.io/temporal 0.59.0 with `cassandra.enabled: false` and no
  // `server.config.persistence` override: the chart is left with NO datastore,
  // so the schema-setup job has nothing to migrate against. The commented-out
  // CockroachDB wiring is the missing half -- and as of 2026-08-21 the reason it
  // is commented out has changed: cockroachdb now reaches Synced+Healthy in this
  // lane, so the blocker is the unwritten `server.config.persistence` block
  // alone, not an unavailable datastore. That is the next one to close, and it
  // is a manifest change nobody has made rather than a substrate gap.
  "temporal",
  // comes up SEALED by design; readiness needs the gated operator-init ceremony
  // CI must not run -- `vault operator init` + `unseal` MINT root and unseal key
  // material, a gated class (vault/Application.yaml, TOPOLOGY.md). Not a wiring
  // gap: a lane that could make Vault Healthy would be a lane that performs the
  // ceremony, and it must not.
  "vault",
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
    "TWO independent blockers, either alone sufficient: it needs a GitHub App credential + a live runner registration that CI has no secret to bind, AND model-cache-pvc.yaml claims ReadWriteMany, which rancher.io/local-path behind the dev longhorn alias cannot serve (081KSXN940008QG0R000SCP2H1).",
  ],
  ["forgejo", "deferred until dev wiring exists (DEV_INCLUDED_PROOF_DEFERRED_DIRS)."],
  [
    "hindsight",
    "THREE independent blockers, established 2026-08-21 by rendering hindsight 0.3.0 against this Application's own valuesObject; any ONE of them defers it. " +
      "(1) CAPACITY, MEASURED run 32519516070: hindsight-postgresql-0 never scheduled -- FailedScheduling `0/1 nodes are available: 1 Insufficient cpu` -- so hindsight-api and hindsight-control-plane CrashLoopBackOff waiting on a database with nowhere to run. The chart's own defaults are 500m (api) + 250m (control-plane) + 250m (postgresql), against an applied-set total of 4131m on a 4-vCPU runner whose kind system pods already reserve ~950m. " +
      "(2) THE `dev` RESOURCE RUNG CANNOT REACH THIS LANE, which is the part that looked like the fix and is not. `storage-profiles.ts --resource-profile dev --apply` rewrites the WORKING TREE; ArgoCD syncs the COMMITTED tree at `--git-ref`, and the only rung CI runs is `--budget`, a report. So there is no dev-only resource override today -- lowering these numbers would lower them for the metal cluster too, where the cost of an under-request is a pod that is evictable under node pressure rather than one that is refused a node. That trade is a maintainer call, not a CI convenience. " +
      "(3) THE valuesObject IS LARGELY INERT against this chart, which is a defect in its own right: it sets `postgresql.primary.persistence.{storageClass,size}`, `api.llm.{provider,existingSecret}` and a top-level `service`, and hindsight 0.3.0 reads `postgresql.persistence.*`, `api.env`/`api.secrets`/top-level `existingSecret`, and `api.service`/`controlPlane.service`. Rendered proof: the PVC comes out with NO storageClassName (so it takes the cluster default, not longhorn) at 8Gi (the chart default, not the 10Gi the storage profile governs), and no HINDSIGHT_API_LLM_API_KEY env reaches the api container. LIFTS WHEN: the valuesObject is rewritten against the schema the pinned chart actually has, AND a per-substrate resource override exists (or the maintainer accepts the metal-side cost of the dev numbers).",
  ],
  ["spire", "Vault upstream CA + kind PVC wiring not ready in included CI (DEV_INCLUDED_PROOF_DEFERRED_DIRS)."],
  [
    "vault",
    "storage moved to zeta-local-path, so it now SYNCS in this lane -- but it comes up SEALED by design and readiness requires the gated operator-init ceremony, which CI must never run (081M0H19QD3087G0R003GV76ZY).",
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
    .sort((a, b) => a.localeCompare(b));

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
            `assert the dev credential ${DEV_GRAFANA_ADMIN_SECRET.namespace}/${DEV_GRAFANA_ADMIN_SECRET.name} the bring-up mints is actually present, before Grafana waits on a Secret that must pre-exist`,
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
      "Longhorn-BACKED manifests are no longer storage-excluded: dev applies a StorageClass named longhorn over rancher.io/local-path (dev-cluster/manifests/longhorn.yaml), so those PVCs bind. MEASURED on run 32519516070: 6 of the 11 formerly-excluded apps reached Synced+Healthy (headscale, mimir, nats, oz, redis, tempo); the other 5 bound their volumes and then failed for named NON-storage defects, visible for the first time. THREE of those five are fixed as of 2026-08-21 and are asserted here now -- cockroachdb (the chart init Job moved out of ArgoCD PostSync, which deadlocks against the health it is needed to produce), kube-prometheus-stack (Grafana admin Secret minted at bring-up), weaviate (the chart re-mints randAlphaNum credentials on every render because ArgoCD cannot run Helm lookup, so two named keys are in ignoreDifferences). hindsight remains, on three independent blockers. Still excluded outright are ReadWriteMany claims, which no dev provisioner can serve, and the whole rule returns if that manifest is absent (081M0JXF6MS087G0R001HC34TM).",
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
 * The LIVE half of lifting `kube-prometheus-stack` out of the deferred set.
 *
 * `applyDevBootstrapSecrets` mints `monitoring/grafana-admin-credentials` at
 * bring-up, and `use-cases.test.ts` proves the call is wired into all three
 * doors. Neither of those observes a CLUSTER. If the Secret is absent anyway --
 * a bring-up that predates this change, an `--existing` run against a
 * hand-built cluster, a kubectl apply that silently failed -- Grafana returns to
 * `CreateContainerConfigError`, ArgoCD reports the Deployment as Progressing,
 * and the proof burns its whole 2400s and reports a symptom instead of a cause.
 *
 * So this refuses in seconds and NAMES the missing object, exactly as
 * `assertDevStorageClassPresent` does for the StorageClass. Same shape, same
 * reason: the repo-side and code-side claims are about the repo and the code;
 * only this one is about the cluster the assertions will actually run against.
 *
 * Scoped to included/full, because the smoke roster does not assert
 * kube-prometheus-stack and has no business failing on its credential.
 */
function assertDevGrafanaAdminSecretPresent(plan: HarnessPlan): Failure | null {
  if (!isIncludedScope(plan.scope)) return null;
  const { namespace, name } = DEV_GRAFANA_ADMIN_SECRET;
  const args = ["get", "secret", name, "-n", namespace, "-o", "name"];
  const result = runCommand("kubectl", args, 60_000);
  if (result.status === 0) return null;
  return {
    kind: "DevGrafanaAdminSecretMissing",
    message:
      `kube-prometheus-stack sets grafana.admin.existingSecret: "${name}", so the chart never mints an admin ` +
      `credential and kubelet cannot start Grafana without one. The dev/CI bring-up mints it into namespace ` +
      `"${namespace}", but in cluster ${plan.clusterName} it is not present. Grafana would sit in ` +
      `CreateContainerConfigError, which ArgoCD reports as Progressing rather than Degraded, so the run would ` +
      `burn its whole timeout instead of failing. Failing now instead. Check that the bring-up path still ` +
      `calls applyDevBootstrapSecrets before the app-of-apps root.`,
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

  const grafanaSecretFailure = assertDevGrafanaAdminSecretPresent(plan);
  if (grafanaSecretFailure !== null) {
    return { ok: false, plan, preflight, failure: grafanaSecretFailure };
  }

  const argoFailure = await waitForArgoCd(plan, options);
  if (argoFailure !== null) {
    return { ok: false, plan, preflight, failure: argoFailure };
  }

  const apps = await waitForApplications(plan, options);
  if (isFailure(apps)) {
    return { ok: false, plan, preflight, failure: apps };
  }

  if (options.driftCheck) {
    const driftFailure = await runDriftRepairCheck(options);
    if (driftFailure !== null) {
      return {
        ok: false,
        plan,
        preflight,
        applications: apps,
        driftRepair: "failed",
        failure: driftFailure,
      };
    }
    return { ok: true, plan, preflight, applications: apps, driftRepair: "passed" };
  }

  return { ok: true, plan, preflight, applications: apps, driftRepair: "not-requested" };
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
