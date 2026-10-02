/**
 * src/Core.TypeScript/cluster/storage-profile-install.ts
 *
 * docs/ops/INSTALL-TIME-CONFIG.md row 29 — the storage profile as INSTALL-TIME
 * configuration, derived from the ONE existing ladder.
 *
 * WHAT THIS MODULE IS
 * -------------------
 * The storage-profile catalogue (`k8s/storage-profiles.json`) prices every Longhorn
 * claim at `ci` / `minimal` / `standard` / `measured` / `large`. Until now the rung a
 * cluster ran was decided in GIT (`--profile <name> --apply` rewrites the manifests,
 * `activeStorageProfile` records it), so a box whose pool could not hold the
 * committed rung could not install at all. This module is everything the install-time
 * choice needs that is DERIVED from that catalogue, so none of it can drift from it:
 *
 *   1. the install LADDER and what each rung really demands of Longhorn
 *      (`installLadder`, `installDemandGib`) — the numbers the installer's shell
 *      table and `installer/storage-profile-selection.ts` carry;
 *   2. which claims an install-time choice can actually REACH (`classifyClaim`);
 *   3. the committed kit the cluster applies (`k8s/storage-profile/`): one ConfigMap of
 *      merge patches, one Job per patched Application, the RBAC, and the exact
 *      `ignoreDifferences` the root needs (`buildStorageProfileKit`);
 *   4. a mirror of the template substitution (`storageProfileObjects`) so SET is
 *      testable with no cluster, no nix and no kustomize.
 *
 * THE MECHANISM IS public-tls / lb-ipam's, NOT A SECOND ONE
 * ---------------------------------------------------------
 * zeta-install.sh writes `/etc/zeta/storage-profile`; `nixos/modules/injected-storage-profile.nix`
 * reads it at evaluation time and, on a k3s server, adds ONE roster entry: the
 * `zeta-storage-profile` ArgoCD Application, rendered from
 * `k8s/storage-profile/argocd-application.yaml.in`. Its kustomize base carries no
 * profile; the choice arrives only as an inline patch to one ConfigMap key. The
 * Jobs then merge-patch the git-owned Applications' size leaves — the
 * `gitlab-lan-address` shape — and the root ignores exactly those leaves.
 *
 * WHAT AN INSTALL-TIME CHOICE CAN AND CANNOT REACH (the honest part)
 * ------------------------------------------------------------------
 *   values      an Application whose size lives under `spec.source.helm.valuesObject`:
 *               a merge patch moves it.                                        14 claims
 *   kustomize   a git-path Application on a KUSTOMIZE source (vllm): its
 *               `spec.source.kustomize.patches` is the patch surface.           1 claim
 *   committed   a git-path Application on a `directory` source (agent-memory, gmod,
 *               headscale, portal): a directory source has no patch surface, so these
 *               keep the COMMITTED size and the ladder charges them at it.        4 claims
 *   unapplied   no Application reconciles the file (`arc-runner-set/model-cache-pvc.yaml`,
 *               registered in app-of-apps-discovery.ts ORPHANED_SUPPORTING_REASONS):
 *               it cannot consume Longhorn bytes today. It is charged at the rung's
 *               size anyway, and the moment someone wires it up this module
 *               reclassifies it from the SAME derivation and the drift test fails
 *               until the generated tables are regenerated.                     1 claim
 *
 * Never shrinks — see `installer/storage-profile-selection.ts`.
 *
 * THE RESIDUAL RISK, STATED: the Jobs patch an Application AFTER `zeta-root` creates
 * it. ArgoCD begins reconciling a new Application as soon as it exists, so a patch
 * that lands after the first sync has already created a StatefulSet at the committed
 * size is a shrink the API server refuses. The Job's init container is already
 * waiting when the Application appears and patches within a second, and a new
 * Application first has to be rendered by the repo-server, so the window is small —
 * but it is a window, and it is unproven off-cluster. For the rung an ordinary box
 * lands on (`standard`) every bring-up claim already equals the committed size, so
 * the race can only matter for `minimal`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { discoverGitDirectorySources, sourceReconciles } from "./app-of-apps-discovery.ts";
import { applyPatch, yamlDocs, type K8sObject, type PatchOp } from "./public-tls.ts";
import {
  claimGib,
  DEFAULT_CATALOGUE_PATH,
  loadCatalogue,
  parseFieldPath,
  podsScalarFor,
  type ProfileCatalogue,
  type ProfileClaim,
} from "./storage-profiles.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const STORAGE_PROFILE_TEMPLATE = "full-ai-cluster/k8s/storage-profile/argocd-application.yaml.in";
export const STORAGE_PROFILE_NIX_MODULE = "full-ai-cluster/nixos/modules/injected-storage-profile.nix";
export const STORAGE_PROFILE_KIT_DIR = "full-ai-cluster/k8s/storage-profile";
export const STORAGE_PROFILE_APPLICATION_NAME = "zeta-storage-profile";
export const STORAGE_PROFILE_CONFIGMAP_NAME = "zeta-storage-profile";
export const STORAGE_PROFILE_CONFIGMAP_KEY = "profile";
/** The one token the Nix module replaces. The test pins the Nix side. */
export const STORAGE_PROFILE_TOKEN = "@ZETA_STORAGE_PROFILE@";
export const LEDGER_PATH = "full-ai-cluster/k8s/single-node-budget.json";
export const ROOT_APPLICATION_PATH = "full-ai-cluster/k8s/bootstrap/root-application.yaml";
export const INSTALL_SH_PATH = "full-ai-cluster/usb-nixos-installer/zeta-install.sh";
export const SELECTION_TS_PATH = "src/Core.TypeScript/installer/storage-profile-selection.ts";

const VALUES_PREFIX = "spec.source.helm.valuesObject.";

// ---------------------------------------------------------------------------
// Reach
// ---------------------------------------------------------------------------

export type ClaimReach =
  | { readonly kind: "values"; readonly app: string }
  | {
      readonly kind: "kustomize";
      readonly app: string;
      readonly target: { readonly kind: string; readonly name: string };
      readonly pointer: string;
    }
  | { readonly kind: "committed"; readonly app: string }
  | { readonly kind: "unapplied" };

/**
 * Every git-directory source in the tree, discovered ONCE per tree: it walks and parses every manifest, and
 * `classifyClaim` runs per claim, per rung, per consumer. Keyed by root so a test that builds a second tree
 * does not read the first's.
 */
const sourcesByRoot = new Map<string, ReturnType<typeof discoverGitDirectorySources>>();
function directorySources(repoRoot: string): ReturnType<typeof discoverGitDirectorySources> {
  const cached = sourcesByRoot.get(repoRoot);
  if (cached !== undefined) return cached;
  const found = discoverGitDirectorySources(repoRoot);
  sourcesByRoot.set(repoRoot, found);
  return found;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function readDocs(repoRoot: string, path: string): K8sObject[] {
  return yamlDocs(readFileSync(join(repoRoot, path), "utf8"));
}

/** `spec.volumeClaimTemplates[0].spec.x` -> `/spec/volumeClaimTemplates/0/spec/x` (RFC 6901). */
function jsonPointer(field: string): string {
  return parseFieldPath(field)
    .map((part) => `/${String(part).replaceAll("~", "~0").replaceAll("/", "~1")}`)
    .join("");
}

/**
 * How an install-time choice reaches `claim`. Derived from the manifests and the
 * app-of-apps discovery — nothing is stated by hand, so a claim cannot be
 * "reachable" in a table while the tree says otherwise.
 */
export function classifyClaim(claim: ProfileClaim, repoRoot = REPO_ROOT): ClaimReach {
  if (/(^|\/)Application\.yaml$/.test(claim.path)) {
    const doc = readDocs(repoRoot, claim.path)[claim.docIndex];
    const name = asRecord(doc?.["metadata"])?.["name"];
    if (typeof name !== "string") throw new Error(`${claim.id}: ${claim.path} doc ${String(claim.docIndex)} has no metadata.name`);
    const fields = [claim.sizeField, ...Object.keys(claim.governors), ...(claim.podsField === null ? [] : [claim.podsField])];
    for (const field of fields) {
      if (!field.startsWith(VALUES_PREFIX)) {
        throw new Error(
          `${claim.id}: ${field} is not under ${VALUES_PREFIX} — a merge patch on the Application can only move a ` +
            `helm valuesObject leaf, so this claim has no install-time form`,
        );
      }
      if (parseFieldPath(field).some((part) => typeof part === "number")) {
        throw new Error(`${claim.id}: ${field} indexes an array, which a JSON merge patch cannot address`);
      }
    }
    return { kind: "values", app: name };
  }
  const sources = directorySources(repoRoot).filter((source) => sourceReconciles(source, claim.path));
  if (sources.length === 0) return { kind: "unapplied" };
  const names = [...new Set(sources.map((s) => s.app))];
  if (names.length !== 1) {
    throw new Error(`${claim.id}: ${claim.path} is reconciled by more than one Application (${names.join(", ")})`);
  }
  const source = sources[0];
  if (source === undefined) return { kind: "unapplied" };
  const appDoc = readDocs(repoRoot, source.origin).find((doc) => asRecord(doc["metadata"])?.["name"] === source.app);
  const kustomize = asRecord(asRecord(asRecord(appDoc?.["spec"])?.["source"])?.["kustomize"]);
  if (kustomize === undefined) return { kind: "committed", app: source.app };
  const manifest = readDocs(repoRoot, claim.path)[claim.docIndex];
  const kind = manifest?.["kind"];
  const name = asRecord(manifest?.["metadata"])?.["name"];
  if (typeof kind !== "string" || typeof name !== "string") {
    throw new Error(`${claim.id}: ${claim.path} doc ${String(claim.docIndex)} has no kind/metadata.name to target`);
  }
  if (claim.podsField !== null || Object.keys(claim.governors).length > 0) {
    throw new Error(`${claim.id}: a kustomize-reached claim with a podsField or governors has no install-time form yet`);
  }
  return { kind: "kustomize", app: source.app, target: { kind, name }, pointer: jsonPointer(claim.sizeField) };
}

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

/** The profile the committed tree is written at (`activeStorageProfile`). */
export function committedProfile(repoRoot = REPO_ROOT): string {
  const parsed = JSON.parse(readFileSync(join(repoRoot, LEDGER_PATH), "utf8")) as { activeStorageProfile?: unknown };
  if (typeof parsed.activeStorageProfile !== "string") throw new Error(`${LEDGER_PATH}: activeStorageProfile missing`);
  return parsed.activeStorageProfile;
}

/**
 * Profiles that exist to serve a RESOURCE rung's hosted runner
 * (`storageProfileForResourceRung`) — `ci` — are not a choice for a node.
 */
export function runnerOnlyProfiles(repoRoot = REPO_ROOT, path = DEFAULT_CATALOGUE_PATH): ReadonlySet<string> {
  const parsed = JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as { storageProfileForResourceRung?: unknown };
  const mapping = asRecord(parsed.storageProfileForResourceRung) ?? {};
  return new Set(Object.values(mapping).filter((v): v is string => typeof v === "string"));
}

/**
 * GiB an install at `profile` ACTUALLY asks of the Longhorn pool.
 *
 *   values / kustomize   the rung's own size x pods — the install-time choice moves them
 *   committed            the COMMITTED rung's size x pods — nothing here can move it, so
 *                        charging the rung's smaller number would be a lie in the
 *                        direction that fills a disk
 *   unapplied            the rung's size — it cannot consume bytes today (see header)
 */
export function installDemandGib(
  catalogue: ProfileCatalogue,
  profile: string,
  committed: string,
  repoRoot = REPO_ROOT,
): number {
  let total = 0;
  for (const claim of catalogue.claims) {
    const reach = classifyClaim(claim, repoRoot);
    total += claimGib(claim, reach.kind === "committed" ? committed : profile);
  }
  return total;
}

export interface InstallRung {
  readonly name: string;
  readonly demandGib: number;
}

/** The ladder an install chooses from, smallest first. Refuses a ladder that does not climb. */
export function installLadder(repoRoot = REPO_ROOT): readonly InstallRung[] {
  const catalogue = loadCatalogue(DEFAULT_CATALOGUE_PATH, repoRoot);
  const committed = committedProfile(repoRoot);
  const runnerOnly = runnerOnlyProfiles(repoRoot);
  const rungs = catalogue.profiles
    .filter((name) => !runnerOnly.has(name))
    .map((name) => ({ name, demandGib: installDemandGib(catalogue, name, committed, repoRoot) }));
  if (!rungs.some((rung) => rung.name === committed)) {
    throw new Error(`the committed profile "${committed}" is not an installable rung`);
  }
  for (let i = 1; i < rungs.length; i += 1) {
    const prev = rungs[i - 1];
    const cur = rungs[i];
    if (prev !== undefined && cur !== undefined && cur.demandGib < prev.demandGib) {
      throw new Error(`install ladder does not climb: ${cur.name} (${String(cur.demandGib)}) < ${prev.name} (${String(prev.demandGib)})`);
    }
  }
  return rungs;
}

// ---------------------------------------------------------------------------
// What a rung changes (the banner's "what it shrinks")
// ---------------------------------------------------------------------------

function shortId(claim: ProfileClaim): string {
  return claim.id.replace(/^full-ai-cluster\//, "");
}

/**
 * Per-claim differences between the committed rung and `profile`, for the claims an
 * install-time choice reaches. `->` is part of the text the shell prints.
 */
export function rungChanges(
  catalogue: ProfileCatalogue,
  profile: string,
  committed: string,
  repoRoot = REPO_ROOT,
): readonly string[] {
  const out: string[] = [];
  for (const claim of catalogue.claims) {
    const reach = classifyClaim(claim, repoRoot);
    if (reach.kind === "committed" || reach.kind === "unapplied") continue;
    const from = claim.sizes[committed];
    const to = claim.sizes[profile];
    if (from !== undefined && to !== undefined && from !== to) out.push(`${shortId(claim)} ${from}->${to}`);
    const podsFrom = claim.pods[committed];
    const podsTo = claim.pods[profile];
    if (podsFrom !== undefined && podsTo !== undefined && podsFrom !== podsTo) {
      out.push(`${shortId(claim)} pods ${String(podsFrom)}->${String(podsTo)}`);
    }
    for (const [field, byProfile] of Object.entries(claim.governors)) {
      const gFrom = byProfile[committed];
      const gTo = byProfile[profile];
      if (gFrom !== undefined && gTo !== undefined && gFrom !== gTo) {
        out.push(`${shortId(claim)} ${field.split(".").at(-1) ?? field} ${gFrom}->${gTo}`);
      }
    }
  }
  return out;
}

/** Claims an install-time choice cannot resize, with the size they keep. */
export function keptAtCommitted(
  catalogue: ProfileCatalogue,
  committed: string,
  repoRoot = REPO_ROOT,
): readonly string[] {
  return catalogue.claims
    .filter((claim) => classifyClaim(claim, repoRoot).kind === "committed")
    .map((claim) => `${shortId(claim)} ${claim.sizes[committed] ?? "?"}`);
}

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------

/** Nest `path` (object keys only) into `into`, creating objects on the way. */
function setNested(into: Record<string, unknown>, path: readonly (string | number)[], value: unknown): void {
  let cur = into;
  for (const [i, part] of path.entries()) {
    const key = String(part);
    if (i === path.length - 1) {
      cur[key] = value;
      return;
    }
    const next = asRecord(cur[key]) ?? {};
    cur[key] = next;
    cur = next;
  }
}

export interface PatchedApplication {
  readonly app: string;
  /** profile -> compact JSON merge patch. */
  readonly patches: ReadonlyMap<string, string>;
  /** Every JSON pointer the root must ignore on this Application. */
  readonly pointers: readonly string[];
}

/** One merge patch per (installable profile, patched Application), plus the root's ignore set. */
export function patchedApplications(repoRoot = REPO_ROOT): readonly PatchedApplication[] {
  const catalogue = loadCatalogue(DEFAULT_CATALOGUE_PATH, repoRoot);
  const ladder = installLadder(repoRoot);
  const byApp = new Map<string, { claim: ProfileClaim; reach: ClaimReach }[]>();
  for (const claim of catalogue.claims) {
    const reach = classifyClaim(claim, repoRoot);
    if (reach.kind !== "values" && reach.kind !== "kustomize") continue;
    const bucket = byApp.get(reach.app);
    if (bucket === undefined) byApp.set(reach.app, [{ claim, reach }]);
    else bucket.push({ claim, reach });
  }
  const out: PatchedApplication[] = [];
  for (const [app, members] of [...byApp.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    const patches = new Map<string, string>();
    const pointers = new Set<string>();
    for (const rung of ladder) {
      const patch: Record<string, unknown> = {};
      const kustomizePatches: unknown[] = [];
      for (const { claim, reach } of members) {
        if (reach.kind === "kustomize") {
          const size = claim.sizes[rung.name];
          if (size === undefined) throw new Error(`${claim.id}: no size for ${rung.name}`);
          const ops: PatchOp[] = [{ op: "replace", path: reach.pointer, value: size }];
          kustomizePatches.push({ target: reach.target, patch: JSON.stringify(ops) });
          pointers.add("/spec/source/kustomize/patches");
          continue;
        }
        const size = claim.sizes[rung.name];
        if (size === undefined) throw new Error(`${claim.id}: no size for ${rung.name}`);
        setNested(patch, parseFieldPath(claim.sizeField), size);
        pointers.add(jsonPointer(claim.sizeField));
        for (const [field, byProfile] of Object.entries(claim.governors)) {
          const value = byProfile[rung.name];
          if (value === undefined) throw new Error(`${claim.id}: no governor value for ${rung.name}`);
          setNested(patch, parseFieldPath(field), value);
          pointers.add(jsonPointer(field));
        }
        if (claim.podsField !== null) {
          const counts = new Set(ladder.map((r) => claim.pods[r.name]));
          if (counts.size > 1) {
            const pods = claim.pods[rung.name];
            if (pods === undefined) throw new Error(`${claim.id}: no pod count for ${rung.name}`);
            setNested(patch, parseFieldPath(claim.podsField), podsScalarFor(claim, pods));
            pointers.add(jsonPointer(claim.podsField));
          }
        }
      }
      if (kustomizePatches.length > 0) setNested(patch, ["spec", "source", "kustomize", "patches"], kustomizePatches);
      patches.set(rung.name, JSON.stringify(patch));
    }
    out.push({ app, patches, pointers: [...pointers].sort() });
  }
  return out;
}

const KUBECTL_IMAGE = "docker.io/rancher/kubectl:v1.35.6";
const CONTAINER_SECURITY = `            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: [ALL] }`;

function renderConfigMap(apps: readonly PatchedApplication[], ladder: readonly InstallRung[]): string {
  const lines = [
    "# GENERATED by `bun src/Core.TypeScript/cluster/storage-profile-install.ts --write`. DO NOT EDIT BY HAND:",
    "# storage-profile-install.test.ts fails when this file is not byte-for-byte what the generator emits.",
    "#",
    "# One JSON merge patch per (profile, Application): exactly the size / governor / pod-count leaves",
    "# k8s/storage-profiles.json prices that profile at, for the claims an install-time choice reaches.",
    "# The Job for an Application reads `<profile>--<application>.json` where <profile> is the ConfigMap's",
    "# own `profile` key, which the Application's inline patch (argocd-application.yaml.in) writes from",
    "# /etc/zeta/storage-profile. THIS FILE CARRIES NO PROFILE: with no install-time choice there is no",
    "# `profile` key, the Jobs cannot start (CreateContainerConfigError, loud), and the Application that",
    "# would apply this directory does not exist.",
    "apiVersion: v1",
    "kind: ConfigMap",
    "metadata:",
    `  name: ${STORAGE_PROFILE_CONFIGMAP_NAME}`,
    "  namespace: kube-system",
    "data:",
  ];
  for (const rung of ladder) {
    for (const { app, patches } of apps) {
      lines.push(`  ${rung.name}--${app}.json: |-`, `    ${patches.get(rung.name) ?? ""}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function renderRbac(apps: readonly PatchedApplication[]): string {
  return `# GENERATED by \`bun src/Core.TypeScript/cluster/storage-profile-install.ts --write\`. DO NOT EDIT BY HAND.
#
# The Jobs may PATCH exactly the Applications the storage profile moves, and nothing else.
apiVersion: v1
kind: ServiceAccount
metadata:
  name: zeta-storage-profile
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: zeta-storage-profile
  namespace: argocd
rules:
  # \`kubectl wait --for=create\` lists+watches; the only WRITE is the next rule.
  - apiGroups: ["argoproj.io"]
    resources: ["applications"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["argoproj.io"]
    resources: ["applications"]
    resourceNames: [${apps.map((a) => `"${a.app}"`).join(", ")}]
    verbs: ["patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: zeta-storage-profile
  namespace: argocd
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: zeta-storage-profile
subjects:
  - kind: ServiceAccount
    name: zeta-storage-profile
    namespace: kube-system
`;
}

function renderJob(app: string): string {
  return `apiVersion: batch/v1
kind: Job
metadata:
  name: zeta-storage-profile-${app}
  namespace: kube-system
  annotations:
    # A Job that waits for an Application which may never exist (an install that removed it, or a lane
    # whose envelope excludes it) must not hold the \`zeta-storage-profile\` Application Progressing.
    # Same reason, same annotation as k8s/lb-ipam/gitlab-lan-address.yaml.
    argocd.argoproj.io/ignore-healthcheck: "true"
spec:
  backoffLimit: 6
  template:
    spec:
      serviceAccountName: zeta-storage-profile
      restartPolicy: OnFailure
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        seccompProfile: { type: RuntimeDefault }
      volumes:
        - name: kubecache
          emptyDir: {}
        - name: patch
          configMap: { name: ${STORAGE_PROFILE_CONFIGMAP_NAME} }
      initContainers:
        - name: wait-for-${app}-application
          image: ${KUBECTL_IMAGE}
          securityContext:
${CONTAINER_SECURITY}
          env:
            - { name: HOME, value: /tmp/kubecache }
          volumeMounts:
            - { name: kubecache, mountPath: /tmp/kubecache }
          command: ["/bin/kubectl"]
          args: ["wait", "--for=create", "applications.argoproj.io/${app}", "-n", "argocd", "--timeout=24h"]
      containers:
        - name: patch
          image: ${KUBECTL_IMAGE}
          securityContext:
${CONTAINER_SECURITY}
          env:
            - { name: HOME, value: /tmp/kubecache }
            - name: ZETA_STORAGE_PROFILE
              valueFrom:
                configMapKeyRef: { name: ${STORAGE_PROFILE_CONFIGMAP_NAME}, key: ${STORAGE_PROFILE_CONFIGMAP_KEY} }
          resources:
            requests: { cpu: 10m, memory: 32Mi }
            limits: { memory: 128Mi }
          volumeMounts:
            - { name: kubecache, mountPath: /tmp/kubecache }
            - { name: patch, mountPath: /patch, readOnly: true }
          command: ["/bin/kubectl"]
          args: ["patch", "applications.argoproj.io", "${app}", "-n", "argocd", "--type", "merge", "--patch-file", "/patch/$(ZETA_STORAGE_PROFILE)--${app}.json"]
`;
}

function renderJobs(apps: readonly PatchedApplication[]): string {
  return `# GENERATED by \`bun src/Core.TypeScript/cluster/storage-profile-install.ts --write\`. DO NOT EDIT BY HAND.
#
# One Job per Application the storage profile moves. Each waits for its Application to EXIST (zeta-root
# creates it at its own sync wave) and then merge-patches the profile's leaves into it, so one absent
# Application never blocks the others. The patch is the ConfigMap key \`<profile>--<app>.json\`.
${apps.map((a) => renderJob(a.app)).join("---\n")}`;
}

function renderKustomization(): string {
  return `# Kustomize base for the install-time \`zeta-storage-profile\` Application. It carries NO profile: the
# choice arrives as that Application's inline patch (argocd-application.yaml.in). GENERATED siblings
# (configmap.yaml, rbac.yaml, jobs.yaml, ladder.json) come from storage-profile-install.ts.
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - configmap.yaml
  - rbac.yaml
  - jobs.yaml
`;
}

/** The root Application's ignoreDifferences entries for the patched Applications, as YAML text. */
export function renderRootIgnoreEntries(apps: readonly PatchedApplication[]): string {
  return apps
    .map(
      (a) =>
        `    - group: argoproj.io\n      kind: Application\n      name: ${a.app}\n      namespace: argocd\n      jsonPointers:\n${a.pointers
          .map((p) => `        - ${p}`)
          .join("\n")}\n`,
    )
    .join("");
}

export const TEMPLATE_JOBS_BEGIN = "        # ZETA-STORAGE-PROFILE-JOBS-BEGIN";
export const TEMPLATE_JOBS_END = "        # ZETA-STORAGE-PROFILE-JOBS-END";

/**
 * The template's per-Job rename patches. A Job is immutable and a COMPLETED Job is never re-run, so a
 * profile change (growing the profile later) would re-run nothing. Putting the profile in each Job's
 * NAME makes a change a new Job: ArgoCD prunes the old one and the new one runs against the new
 * profile. The token is the same one the ConfigMap's `profile` key uses.
 */
export function renderTemplateJobPatches(apps: readonly PatchedApplication[]): string {
  return apps
    .map((a) => {
      const base = `zeta-storage-profile-${a.app}`;
      return (
        `        - target: { group: batch, version: v1, kind: Job, name: ${base} }\n` +
        `          patch: '[{"op":"replace","path":"/metadata/name","value":"${base}-${STORAGE_PROFILE_TOKEN}"}]'`
      );
    })
    .join("\n");
}

export const ROOT_IGNORE_BEGIN = "    # ZETA-STORAGE-PROFILE-IGNORE-BEGIN";
export const ROOT_IGNORE_END = "    # ZETA-STORAGE-PROFILE-IGNORE-END";

export interface KitFile {
  readonly path: string;
  readonly text: string;
}

export function buildStorageProfileKit(repoRoot = REPO_ROOT): readonly KitFile[] {
  const apps = patchedApplications(repoRoot);
  const ladder = installLadder(repoRoot);
  return [
    { path: `${STORAGE_PROFILE_KIT_DIR}/kustomization.yaml`, text: renderKustomization() },
    { path: `${STORAGE_PROFILE_KIT_DIR}/configmap.yaml`, text: renderConfigMap(apps, ladder) },
    { path: `${STORAGE_PROFILE_KIT_DIR}/rbac.yaml`, text: renderRbac(apps) },
    { path: `${STORAGE_PROFILE_KIT_DIR}/jobs.yaml`, text: renderJobs(apps) },
    {
      path: `${STORAGE_PROFILE_KIT_DIR}/ladder.json`,
      text: `${JSON.stringify({ committed: committedProfile(repoRoot), profiles: ladder.map((r) => r.name) }, null, 2)}\n`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Generated regions inside hand-written files
// ---------------------------------------------------------------------------

export const SHELL_DATA_BEGIN = "# ZETA-STORAGE-PROFILE-DATA-BEGIN";
export const SHELL_DATA_END = "# ZETA-STORAGE-PROFILE-DATA-END";
export const TS_LADDER_BEGIN = "// STORAGE-PROFILE-LADDER-BEGIN";
export const TS_LADDER_END = "// STORAGE-PROFILE-LADDER-END";

/** The shell's data lines: committed rung, the ladder with demands, and what each rung changes. */
export function renderShellData(repoRoot = REPO_ROOT): string {
  const catalogue = loadCatalogue(DEFAULT_CATALOGUE_PATH, repoRoot);
  const committed = committedProfile(repoRoot);
  const ladder = installLadder(repoRoot);
  const lines = [
    `ZETA_STORAGE_PROFILE_COMMITTED="${committed}"`,
    `ZETA_STORAGE_PROFILE_LADDER="${ladder.map((r) => `${r.name}:${String(r.demandGib)}`).join(" ")}"`,
  ];
  for (const rung of ladder) {
    const changes = rungChanges(catalogue, rung.name, committed, repoRoot);
    lines.push(`ZETA_STORAGE_PROFILE_CHANGES_${rung.name}="${changes.join("; ")}"`);
  }
  lines.push(`ZETA_STORAGE_PROFILE_KEPT="${keptAtCommitted(catalogue, committed, repoRoot).join("; ")}"`);
  for (const line of lines) {
    if (/[`$\\]/.test(line)) throw new Error(`generated shell data line is not safe inside double quotes: ${line}`);
  }
  return lines.join("\n");
}

export function renderTsLadder(repoRoot = REPO_ROOT): string {
  const ladder = installLadder(repoRoot);
  const rows = ladder.map((r) => `  { name: "${r.name}", demandGib: ${String(r.demandGib)} },`).join("\n");
  return `export const STORAGE_PROFILE_LADDER: readonly StorageProfileRung[] = [\n${rows}\n];\n\nexport const STORAGE_PROFILE_COMMITTED = "${committedProfile(repoRoot)}";`;
}

/** Replace the text between two marker lines, keeping the markers. Throws when either is missing. */
export function replaceRegion(source: string, begin: string, end: string, body: string): string {
  const b = source.indexOf(begin);
  const e = source.indexOf(end);
  if (b < 0 || e < 0 || e < b) throw new Error(`markers ${begin} / ${end} missing or out of order`);
  const afterBegin = source.indexOf("\n", b) + 1;
  return `${source.slice(0, afterBegin)}${body}\n${source.slice(e)}`;
}

/** The text between two marker lines, or `null` when a marker is missing. */
export function readRegion(source: string, begin: string, end: string): string | null {
  const b = source.indexOf(begin);
  const e = source.indexOf(end);
  if (b < 0 || e < 0 || e < b) return null;
  const afterBegin = source.indexOf("\n", b) + 1;
  return source.slice(afterBegin, e).replace(/\n$/, "");
}

// ---------------------------------------------------------------------------
// Mirror of the template substitution (what the Nix module hands to k3s)
// ---------------------------------------------------------------------------

export function renderStorageProfileApplicationText(profile: string, repoRoot = REPO_ROOT): string {
  return readFileSync(join(repoRoot, STORAGE_PROFILE_TEMPLATE), "utf8").replaceAll(STORAGE_PROFILE_TOKEN, profile);
}

/** The kit's objects as ArgoCD applies them for `profile`: the base, patched as the Application instructs. */
export function storageProfileObjects(profile: string, repoRoot = REPO_ROOT): K8sObject[] {
  const app = yamlDocs(renderStorageProfileApplicationText(profile, repoRoot))[0];
  if (app === undefined) throw new Error("storage-profile template rendered no document");
  const source = asRecord(asRecord(app["spec"])?.["source"]) ?? {};
  const base = join(repoRoot, STORAGE_PROFILE_KIT_DIR);
  const kustomization = parseYaml(readFileSync(join(base, "kustomization.yaml"), "utf8")) as Record<string, unknown>;
  const objects = ((kustomization["resources"] as string[]) ?? []).flatMap((r) =>
    yamlDocs(readFileSync(join(base, r), "utf8")),
  );
  const patches = ((asRecord(source["kustomize"])?.["patches"] as unknown[]) ?? []).filter(
    (p): p is Record<string, unknown> => asRecord(p) !== undefined,
  );
  for (const p of patches) {
    const t = p["target"] as Record<string, unknown>;
    const ops = JSON.parse(p["patch"] as string) as PatchOp[];
    const matches = objects.filter((o) => o["kind"] === t["kind"] && asRecord(o["metadata"])?.["name"] === t["name"]);
    if (matches.length !== 1) throw new Error(`patch target ${String(t["kind"])}/${String(t["name"])} matched ${matches.length} objects`);
    const match = matches[0];
    if (match !== undefined) applyPatch(match, ops);
  }
  return objects;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function writeIfChanged(repoRoot: string, path: string, text: string): boolean {
  const abs = join(repoRoot, path);
  let current = "";
  try {
    current = readFileSync(abs, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  if (current === text) return false;
  writeFileSync(abs, text, "utf8");
  return true;
}

function rootIgnoreRegionText(repoRoot: string): string {
  return renderRootIgnoreEntries(patchedApplications(repoRoot)).replace(/\n$/, "");
}

function main(argv: readonly string[]): void {
  const repoRoot = REPO_ROOT;
  if (argv.includes("--ladder")) {
    for (const rung of installLadder(repoRoot)) console.log(`${rung.name.padEnd(10)} ${String(rung.demandGib).padStart(5)} GiB`);
    return;
  }
  if (argv.includes("--write")) {
    const changed: string[] = [];
    for (const file of buildStorageProfileKit(repoRoot)) if (writeIfChanged(repoRoot, file.path, file.text)) changed.push(file.path);
    const install = readFileSync(join(repoRoot, INSTALL_SH_PATH), "utf8");
    if (writeIfChanged(repoRoot, INSTALL_SH_PATH, replaceRegion(install, SHELL_DATA_BEGIN, SHELL_DATA_END, renderShellData(repoRoot)))) {
      changed.push(INSTALL_SH_PATH);
    }
    const selection = readFileSync(join(repoRoot, SELECTION_TS_PATH), "utf8");
    if (writeIfChanged(repoRoot, SELECTION_TS_PATH, replaceRegion(selection, TS_LADDER_BEGIN, TS_LADDER_END, renderTsLadder(repoRoot)))) {
      changed.push(SELECTION_TS_PATH);
    }
    const root = readFileSync(join(repoRoot, ROOT_APPLICATION_PATH), "utf8");
    if (writeIfChanged(repoRoot, ROOT_APPLICATION_PATH, replaceRegion(root, ROOT_IGNORE_BEGIN, ROOT_IGNORE_END, rootIgnoreRegionText(repoRoot)))) {
      changed.push(ROOT_APPLICATION_PATH);
    }
    const template = readFileSync(join(repoRoot, STORAGE_PROFILE_TEMPLATE), "utf8");
    const jobPatches = renderTemplateJobPatches(patchedApplications(repoRoot));
    if (writeIfChanged(repoRoot, STORAGE_PROFILE_TEMPLATE, replaceRegion(template, TEMPLATE_JOBS_BEGIN, TEMPLATE_JOBS_END, jobPatches))) {
      changed.push(STORAGE_PROFILE_TEMPLATE);
    }
    console.log(changed.length === 0 ? "storage-profile kit already current." : `wrote:\n  ${changed.join("\n  ")}`);
    return;
  }
  const stale: string[] = [];
  for (const file of buildStorageProfileKit(repoRoot)) {
    let current = "";
    try {
      current = readFileSync(join(repoRoot, file.path), "utf8");
    } catch {
      /* missing counts as stale */
    }
    if (current !== file.text) stale.push(file.path);
  }
  const install = readFileSync(join(repoRoot, INSTALL_SH_PATH), "utf8");
  if (readRegion(install, SHELL_DATA_BEGIN, SHELL_DATA_END) !== renderShellData(repoRoot)) stale.push(INSTALL_SH_PATH);
  const selection = readFileSync(join(repoRoot, SELECTION_TS_PATH), "utf8");
  if (readRegion(selection, TS_LADDER_BEGIN, TS_LADDER_END) !== renderTsLadder(repoRoot)) stale.push(SELECTION_TS_PATH);
  const root = readFileSync(join(repoRoot, ROOT_APPLICATION_PATH), "utf8");
  if (readRegion(root, ROOT_IGNORE_BEGIN, ROOT_IGNORE_END) !== rootIgnoreRegionText(repoRoot)) stale.push(ROOT_APPLICATION_PATH);
  const template = readFileSync(join(repoRoot, STORAGE_PROFILE_TEMPLATE), "utf8");
  if (readRegion(template, TEMPLATE_JOBS_BEGIN, TEMPLATE_JOBS_END) !== renderTemplateJobPatches(patchedApplications(repoRoot))) {
    stale.push(STORAGE_PROFILE_TEMPLATE);
  }
  if (stale.length > 0) {
    console.error(`storage-profile kit is STALE (run --write): ${stale.join(", ")}`);
    process.exit(1);
  }
  console.log("storage-profile kit is current.");
}

if (import.meta.main) main(process.argv.slice(2));
