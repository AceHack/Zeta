#!/usr/bin/env bun
// src/Core.TypeScript/cluster/image-resolvability.ts
//
// -- THE FAILURE THIS EXISTS FOR -------------------------------------------
// A user plugs in the Zeta USB installer, boots bare metal, and K3S applies the
// first-boot HelmChart roster (`full-ai-cluster/k8s/bootstrap/*.yaml`) followed
// by ArgoCD syncing every Application under `full-ai-cluster/k8s/applications/`.
// If ANY container image those manifests reference does not actually exist at
// the pinned tag, or exists but carries no linux/amd64 layer, the pod that needs
// it sits in `ImagePullBackOff` forever — on a box with nobody watching a CI log,
// no rollback, and no second machine to compare against. That is a guaranteed
// crash-loop-equivalent at first boot, and nothing in this tree catches it before
// today: `validate-applications.ts --render` proves a chart TEMPLATES against its
// values and is SCHEMA-valid; neither step asks the registry whether the images
// inside that render can be pulled.
//
// -- PRIOR ART, AND WHY THIS IS NOT A FOURTH SCANNER ------------------------
// Checked before writing this file, per its own header's discipline:
//
//   image-source-provenance.ts   IS EVERY IMAGE OBTAINABLE BY AN OUTSIDER
//                                 (public vs private)? A TEXTUAL scan of every
//                                 tracked `*.yaml`'s literal `image:` strings —
//                                 deliberately offline, because provenance is a
//                                 property of the REPOSITORY, not of what a chart's
//                                 DEFAULT values happen to resolve to.
//   image-footprint.ts           HOW MANY BYTES does each Application's images
//                                 cost the runner's disk? Renders every Application
//                                 via `helm template` at its pinned targetRevision
//                                 and sizes the linux/amd64 manifest.
//   k8s-lane-partition.ts        CAN THIS LANE BE PRICED (docker pull footprint)?
//
// None of the three asks "does the tag/digest EXIST, and does its manifest cover
// the arches we actually boot?" — image-source-provenance's textual scan only
// sees images that are LITERAL strings in the committed tree, which misses every
// image a chart resolves from ITS OWN default `values.yaml` (repository + tag
// never overridden in our valuesObject — the common case). image-footprint reads
// the SAME rendered manifests this file does, but only ever fetches the
// linux/amd64 leg to size it, and a fetch that 404s is folded into "unsized",
// indistinguishable from a private repo or a rate limit. Reused rather than
// duplicated: `imagesInDocuments` and `parseImageReference` (image-footprint.ts),
// `fetchManifest` + `MANIFEST_ACCEPT` (image-footprint.ts — the GENERIC
// WWW-Authenticate challenge/response flow, not image-source-provenance's
// docker.io-shaped one), `discoverApplications` + `renderApplication`
// (rendered-storage-claims.ts), `parseHelmChartCrs` + `bootstrapDirs`
// (render-first-boot-charts.ts / declared-cluster-trees.ts). There is exactly one
// image walker, one reference parser and one registry-auth flow in this
// repository and this file is not a new one of any of them.
//
// -- WHAT "METAL RUNG" MEANS HERE --------------------------------------------
// `lane-tree-source.ts`: "The committed tree is `metal`" — the two resource rungs
// (`dev`/`metal`, see `storage-profiles.ts`) are a CI-only override point that
// rewrites requests/limits on a STAGED COPY; they never touch image references.
// So rendering the COMMITTED tree, with no rung override applied — exactly what
// `discoverApplications` + `renderApplication` already do with no extra
// arguments — IS the metal-rung render. Nothing here needs to know the rung
// mechanism exists.
//
// -- WHICH ARCHES ARE REQUIRED, AND WHY ARM64 IS REPORTED, NOT GATED --------
// `src/Core.TypeScript/zflash/cli.ts:1174-1236`: `--iso-arch` defaults to
// `x86_64` — "the cluster nodes" — and aarch64 is offered only for "the
// Raspberry Pi rung". The k8s resource-rung catalogue
// (`storage-profiles.ts`/`lane-tree-source.ts`) declares exactly two rungs, `dev`
// and `metal`, neither arm64; there is no declared arm64/Pi rung for the
// Applications or bootstrap roster this file renders. So REQUIRED_ARCHES is
// `linux/amd64` alone — the arch every cluster node this tree deploys to actually
// runs — and linux/arm64 presence is measured and reported for every image
// (a Pi-rung consumer will want it) without gating the check. If a k8s-level
// arm64 rung is ever declared, REQUIRED_ARCHES is the one line that changes.
//
// -- OPERATOR-INJECTED IMAGES: THE GENERIC WALKER'S BLIND SPOT --------------
// `imagesInDocuments` finds every mapping key literally spelled `image` in the
// RENDERED documents. That misses an image an operator constructs AT RUNTIME
// from a field that is not `image` at all, or from nothing in this tree — the
// operator's own binary derives it. Checked against every CR in this tree
// (2026-09-22): KubeVirt's `kubevirt-cr.yaml` sets no `spec.image` — the operator
// deployment (`kubevirt-operator.yaml:8545-8554`) derives virt-api/virt-controller
// /virt-handler/virt-launcher/virt-exportproxy/virt-exportserver/
// virt-synchronization-controller/pr-helper/sidecar-shim from its OWN image
// coordinate at the SAME tag (`VIRT_OPERATOR_IMAGE` env var; component names
// read out of upstream's own `const` blocks, not guessed — see
// `KUBEVIRT_COMPONENTS` below). No `Cluster` CR (cnpg) and no bare
// `Prometheus`/`Alertmanager` CR exist in this tree today — `cloudnativepg`
// ships the operator only (no database yet), and `kube-prometheus-stack`
// templates its CR's `spec.image` as a literal string the generic walker already
// catches. `OPERATOR_INJECTED_RULES` below is the explicit, reasoned table this
// task asked for; it is small because the blind spot, measured, is small.
//
// -- OFFLINE (PR-BLOCKING) vs NETWORK (`--refresh`, DAILY CRON) -------------
// Same DV2.0 split as `image-source-provenance.ts`, for the same reason: probing
// ~150 images across six registries on every PR makes the gate depend on other
// people's uptime. The render half (helm template against pinned chart
// versions) still runs every time — it needs only the Helm chart repos, which
// `validate-applications.ts --render` already pays for in the same CI job and
// which is genuinely part of "does this tree still make sense", not "is a third
// party's registry up right now". What is deferred to `--refresh` is exactly the
// six-registry existence probe:
//
//   OFFLINE (default, PR-blocking). Renders the CURRENT tree (fresh image list),
//   then looks each one up in the checked-in snapshot
//   (`full-ai-cluster/k8s/image-resolvability.json`). `missing`/`arch-missing` →
//   FAIL. `unknown` or an image not yet in the snapshot → WARN, counted, does not
//   block (a brand-new image needs a `--refresh` to be measured at all; failing a
//   PR for that would make adding any new image a two-PR dance).
//
//   NETWORK (`--refresh`, daily cron; tags get deleted upstream — the identical
//   rationale `image-source-provenance.ts` and `helm-validate.yml`'s own cron
//   already state for their neighbours). Resolves every current image live,
//   DoP-limited, retried, and rewrites the snapshot. `missing`/`arch-missing` →
//   FAIL (this is what actually catches an upstream deletion); unknown is
//   reported with a count and does not gate — a registry that timed out three
//   retries in a row is not evidence the tag is gone.
//
// -- A FAILED PROBE IS `unknown`, NEVER `missing` ----------------------------
// Same stance `DerivationProtocol.fs` takes for licences and
// `image-source-provenance.ts` takes for provenance: an unchecked reference must
// never be indistinguishable, in the output, from a checked one. A registry
// 404 (repository open, tag/digest not in it — MANIFEST_UNKNOWN) is `missing`.
// Network errors, timeouts, 429, 5xx (after retry) are `unknown`.
//
// 401/403 is AMBIGUOUS on its own — MEASURED 2026-09-22: `minio/minio` and
// `minio/mc` were DELETED from Docker Hub around 2026-09-11 and every tag now
// answers 401, indistinguishable at the OCI distribution API from a genuinely
// private repository. `image-source-provenance.ts` owns the public/private
// question for repositories that DO exist; a repository that no longer
// exists at all is this file's business (a guaranteed ImagePullBackOff either
// way), so a 401/403 on `docker.io` is disambiguated against Docker Hub's own
// catalog API (`dockerHubDisambiguate`) before settling for `unknown` — a
// DEFINITIVE 404 from that API promotes it to `missing`; anything else
// (exists, unreachable, ambiguous) stays `unknown`. ghcr.io/quay.io/etc. keep
// the plain 401/403 → `unknown` reading; they have no equivalent public
// catalog API this checker consults (`image-source-provenance.ts` already
// covers ghcr.io's packages API for the provenance question).
//
// Usage:
//   bun src/Core.TypeScript/cluster/image-resolvability.ts             # offline, snapshot-gated
//   bun src/Core.TypeScript/cluster/image-resolvability.ts --json
//   bun src/Core.TypeScript/cluster/image-resolvability.ts --refresh   # live, rewrites the snapshot
//   bun src/Core.TypeScript/cluster/image-resolvability.ts --refresh --dop 12
//
// Exit codes: 0 clean, 1 findings (missing/arch-missing among currently-rendered
// images; under --refresh also when the snapshot changed), 2 usage/IO.

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseAllDocuments } from "yaml";

import { stringCompare } from "../collation/collation.ts";
import { bootstrapDirs } from "./declared-cluster-trees.ts";
import { fetchManifest, imagesInDocuments, parseImageReference } from "./image-footprint.ts";
import { discoverApplications, type RenderResult, renderApplication } from "./rendered-storage-claims.ts";
import { type HelmChartCr, parseHelmChartCrs } from "../../../full-ai-cluster/k8s/tests/render-first-boot-charts.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const SNAPSHOT_PATH = "full-ai-cluster/k8s/image-resolvability.json";

export const KUBE_VERSION_PATH = "full-ai-cluster/k8s/kubernetes-version.json";

/**
 * The ONE declared Kubernetes version — same file, same field, same "read it,
 * never hardcode it" discipline `validate-applications.ts`'s own
 * `declaredKubeVersion()` already applies. Duplicated here (a five-line pure
 * reader) rather than imported, because that copy lives in a `k8s/tests/*.ts`
 * driver script, not a library module.
 *
 * WHY THIS MATTERS FOR RESOLVABILITY, SPECIFICALLY: a real first-boot VM
 * (2026-09-22) found `spire`'s bootstrap chart deriving a hook image's TAG from
 * `.Capabilities.KubeVersion` (`docker.io/rancher/kubectl:v1.35.7`, which did
 * not exist upstream) — a class of failure this checker could not have
 * reproduced while it rendered at a hardcoded version instead of the one the
 * real node runs. Render at whatever THIS FILE says, always — when it is
 * wrong (it was: `1.35.6` here, `1.35.7` on the node, tracked separately on
 * `claude/pin-kube-version-derived-images`), that staleness is exactly what
 * this checker exists to make loud rather than silently render around.
 */
export function declaredKubeVersion(repoRoot: string = REPO_ROOT): string {
  const path = resolve(repoRoot, KUBE_VERSION_PATH);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { kubernetesVersion?: unknown };
  const version = parsed.kubernetesVersion;
  if (typeof version !== "string" || version.trim() === "") {
    throw new Error(`${KUBE_VERSION_PATH} declares no kubernetesVersion`);
  }
  return version;
}

function stripV(v: string): string {
  return v.startsWith("v") ? v.slice(1) : v;
}

/**
 * Is this reference's TAG exactly the kube-version we rendered with (`v`-prefix
 * either way)? A precise, low-noise signal on purpose — a chart that derives an
 * image tag from `.Capabilities.KubeVersion` breaks the moment the declared
 * version and the real cluster diverge, and the tag matching the render
 * version exactly (not merely sharing a major.minor) is what actually
 * indicates that derivation, not a coincidence of two unrelated version
 * numbers. Report-only: it never gates, same as `:latest`/no-digest.
 */
export function isKubeVersionDerived(image: string, kubeVersion: string): boolean {
  const { reference } = parseImageReference(image);
  if (reference.startsWith("sha256:")) return false;
  return stripV(reference) === stripV(kubeVersion);
}
export const REFRESH_COMMAND = "bun src/Core.TypeScript/cluster/image-resolvability.ts --refresh";

/** The one arch every node this tree deploys to actually runs. See the module header. */
export const REQUIRED_ARCHES: readonly string[] = ["linux/amd64"];

/** Measured and reported for every image; never gates. See the module header. */
export const REPORTED_ARCHES: readonly string[] = ["linux/amd64", "linux/arm64"];

// ---------------------------------------------------------------------------
// Operator-injected images
// ---------------------------------------------------------------------------

export interface OperatorInjectedRule {
  readonly name: string;
  readonly reason: string;
  /** Extra image references this trigger implies, or `[]` if it does not match. */
  readonly derive: (image: string) => readonly string[];
}

// Verified against upstream v1.8.4 source (2026-09-22), NOT guessed from naming
// convention — the first draft of this table wrote "virt-pr-helper", which
// quay.io answers 401/no-such-repository for; the real component names came
// out of `pkg/virt-operator/resource/generate/components/{deployments,
// daemonsets}.go`'s own `const` blocks (`VirtAPIName`, `VirtControllerName`,
// `VirtHandlerName`, `VirtExportProxyName`, `VirtSynchronizationControllerName`,
// `PrHelperName`, `SidecarShimName`) and confirmed public, one repository at a
// time, against `https://quay.io/api/v1/repository/kubevirt/<name>`. Two of the
// eight carry NO `virt-` prefix (`pr-helper`, `sidecar-shim`) and
// `virt-synchronization-controller` is new since earlier releases — a naming
// convention was not a safe way to derive this list, checking upstream was.
const KUBEVIRT_COMPONENTS: readonly string[] = [
  "virt-api",
  "virt-controller",
  "virt-handler",
  "virt-launcher",
  "virt-exportproxy",
  "virt-exportserver",
  "virt-synchronization-controller",
  "pr-helper",
  "sidecar-shim",
];

export const OPERATOR_INJECTED_RULES: readonly OperatorInjectedRule[] = [
  {
    name: "kubevirt-component-images",
    reason:
      "KubeVirt's virt-operator derives every component image from its OWN image coordinate at the SAME " +
      "tag, at runtime (VIRT_OPERATOR_IMAGE env var; kubevirt-operator.yaml:8545-8554). None of these is a " +
      "literal `image:` string anywhere in this tree, so the generic walker cannot see them. Component " +
      "names verified against upstream source, not guessed — see KUBEVIRT_COMPONENTS.",
    derive: (image) => {
      const m = /^quay\.io\/kubevirt\/virt-operator:(.+)$/.exec(image);
      if (m === null) return [];
      const tag = m[1] ?? "";
      return KUBEVIRT_COMPONENTS.map((c) => `quay.io/kubevirt/${c}:${tag}`);
    },
  },
];

// ---------------------------------------------------------------------------
// Discovery — render every Application + every first-boot HelmChart CR
// ---------------------------------------------------------------------------

export interface DiscoveredImage {
  /** The reference exactly as rendered (tag or digest, whichever the manifest carries). */
  readonly image: string;
  /** Application ids / bootstrap file paths / `operator-injected:<rule> (from <image>)` that carry it. */
  readonly sources: readonly string[];
  /** Risk flag, report-only: this tag exactly equals the kube-version we rendered with. */
  readonly kubeVersionDerived: boolean;
}

export interface DiscoverOptions {
  readonly repoRoot?: string;
  readonly helmBin?: string;
  readonly timeoutMs?: number;
  readonly kubeVersion?: string;
}

function addImage(byImage: Map<string, Set<string>>, image: string, source: string): void {
  const trimmed = image.trim();
  if (trimmed === "") return;
  const existing = byImage.get(trimmed);
  if (existing === undefined) byImage.set(trimmed, new Set([source]));
  else existing.add(source);
}

function yamlFilesIn(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((n) => n.endsWith(".yaml") || n.endsWith(".yml")).sort(stringCompare);
}

/** `helm template` one first-boot HelmChart CR, exactly as `render-first-boot-charts.ts` does. */
function renderBootstrapChart(
  cr: HelmChartCr,
  kubeVersion: string,
  helmBin: string,
  timeoutMs: number,
): RenderResult {
  if (!cr.repo.startsWith("http://") && !cr.repo.startsWith("https://")) {
    return { ok: false, reason: "no-http-repo", detail: `repo "${cr.repo}" has no http(s) scheme` };
  }
  const tmp = mkdtempSync(join(tmpdir(), "zeta-image-resolvability-"));
  try {
    const valuesPath = join(tmp, "values.yaml");
    writeFileSync(valuesPath, cr.values, "utf8");
    const rendered = Bun.spawnSync(
      [
        helmBin,
        "template",
        cr.name,
        cr.chart,
        "--repo",
        cr.repo,
        "--version",
        cr.version,
        "--namespace",
        cr.namespace,
        "--kube-version",
        kubeVersion,
        "--values",
        valuesPath,
      ],
      { stdout: "pipe", stderr: "pipe", timeout: timeoutMs },
    );
    if (rendered.exitCode !== 0) {
      return { ok: false, reason: "helm-template-failed", detail: rendered.stderr.toString().trim().slice(0, 400) };
    }
    const documents = parseAllDocuments(rendered.stdout.toString())
      .map((d) => d.toJS() as unknown)
      .filter((d): d is Record<string, unknown> => d !== null && typeof d === "object");
    return { ok: true, documents };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * `renderApplication`'s default runner is `node:child_process.spawnSync`,
 * which read the whole child's stdout through a synchronous OS pipe with no
 * `maxBuffer` set. MEASURED locally: `cloudnative-pg`/`kube-prometheus-stack`/
 * `argo-cd`/`external-secrets`/`argo-rollouts`/`gha-runner-scale-set-controller`
 * rendered with `--include-crds` all exceed it and the render dies
 * `ENOBUFS` with an EMPTY stderr — a render failure this checker would
 * otherwise misreport as "chart doesn't template" when the chart is fine and
 * the runner's pipe is the defect. `Bun.spawnSync`'s pipes carry no such
 * ceiling (confirmed: the bootstrap-chart render path above, which already
 * uses it, hit no failures of this shape). Supplied via `RenderOptions.runHelm`
 * rather than editing the shared renderer, which several other validators use
 * unmodified.
 *
 * RESOLVED UPSTREAM 2026-09-24, and the history is worth keeping because it is
 * the reason the bug survived. This comment is a correct diagnosis of a real
 * defect -- the same six charts, the same ENOBUFS, the same empty stderr -- and
 * it was fixed HERE, privately, by handing this one caller a different runner.
 * The shared renderer was left alone precisely BECAUSE "several other
 * validators use it unmodified", so three of them kept the defect: the
 * storage-claims renderer, a byte-identical clone in inert-valuesobject-keys.ts,
 * and audit-local-helm-charts.ts, where a truncated render fed `kubeconform`
 * and made a schema validator pass over material it never saw. A local
 * workaround for a shared defect leaves the shared defect.
 *
 * `defaultRunHelm` now sets `maxBuffer: DEFAULT_MAX_BYTES` and reports
 * `error.message` when stderr is blank, so this Bun runner is no longer
 * load-bearing for that failure. It is kept because it is not wrong and
 * swapping a working render path buys nothing -- and `Bun.spawnSync` genuinely
 * does not carry Node's 1 MiB ceiling, so the `uncapped-renderer-spawn` lint
 * deliberately does NOT flag it. Do not "fix" this call by adding `maxBuffer`;
 * Bun's options do not have one.
 */
function bunRunHelm(
  helmBin: string,
  timeoutMs: number,
): (args: readonly string[], cwd: string) => { status: number; stdout: string; stderr: string } {
  return (args, cwd) => {
    const result = Bun.spawnSync([helmBin, ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      timeout: timeoutMs,
      env: { ...process.env, HELM_EXPERIMENTAL_OCI: "1" },
    });
    return { status: result.exitCode ?? 1, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  };
}

/**
 * Every image referenced by the first-boot roster + every ArgoCD Application,
 * at the committed (metal) rung, plus operator-injected derivatives.
 */
export function discoverImages(
  options: DiscoverOptions = {},
): { readonly images: readonly DiscoveredImage[]; readonly renderFailures: readonly string[] } {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const helmBin = options.helmBin ?? "helm";
  const timeoutMs = options.timeoutMs ?? 240_000;
  // Read, never hardcode — see declaredKubeVersion()'s header for the incident
  // this guards (spire's kubectl hook image, derived from this capability).
  const kubeVersion = options.kubeVersion ?? declaredKubeVersion(repoRoot);

  const byImage = new Map<string, Set<string>>();
  const renderFailures: string[] = [];

  for (const source of discoverApplications(repoRoot)) {
    const rendered = renderApplication(source, {
      repoRoot,
      timeoutMs,
      helmBin,
      runHelm: bunRunHelm(helmBin, timeoutMs),
      kubeVersion,
    });
    if (!rendered.ok) {
      renderFailures.push(`${source.appId}: ${rendered.reason} — ${rendered.detail}`);
      continue;
    }
    for (const image of imagesInDocuments(rendered.documents)) addImage(byImage, image, source.appId);
  }

  for (const dir of bootstrapDirs(repoRoot)) {
    for (const name of yamlFilesIn(join(repoRoot, dir))) {
      const rel = `${dir}/${name}`;
      for (const cr of parseHelmChartCrs(readFileSync(join(repoRoot, rel), "utf8"), rel)) {
        const result = renderBootstrapChart(cr, kubeVersion, helmBin, Math.min(timeoutMs, 180_000));
        if (!result.ok) {
          renderFailures.push(`${rel} (${cr.chart} ${cr.version}): ${result.reason} — ${result.detail}`);
          continue;
        }
        for (const image of imagesInDocuments(result.documents)) addImage(byImage, image, rel);
      }
    }
  }

  // Operator-injected derivatives, over the roster JUST discovered — a second
  // pass, because a rule may fire off an image the render itself produced.
  for (const image of [...byImage.keys()]) {
    for (const rule of OPERATOR_INJECTED_RULES) {
      for (const derived of rule.derive(image)) {
        addImage(byImage, derived, `operator-injected:${rule.name} (from ${image})`);
      }
    }
  }

  const images = [...byImage.entries()]
    .map(([image, sources]) => ({
      image,
      sources: [...sources].sort(stringCompare),
      kubeVersionDerived: isKubeVersionDerived(image, kubeVersion),
    }))
    .sort((a, b) => stringCompare(a.image, b.image));
  return { images, renderFailures };
}

// ---------------------------------------------------------------------------
// Registry resolution — the network half
// ---------------------------------------------------------------------------

export type ResolutionStatus = "ok" | "missing" | "arch-missing" | "unknown";

export interface ResolvedImage {
  /** Canonical `host/repository:tag` or `host/repository@digest` key. */
  readonly reference: string;
  readonly status: ResolutionStatus;
  readonly httpStatus: number | null;
  /** `os/arch` strings the registry declared. Empty when unresolved. */
  readonly arches: readonly string[];
  readonly requiredArchesMissing: readonly string[];
  readonly reason: string;
  readonly isDockerHub: boolean;
  readonly isLatestOrUntagged: boolean;
  readonly hasDigest: boolean;
  readonly resolvedAt: string;
}

/** `host/repository:tag` (or `@digest`) — the property provenance/footprint/resolvability all key by. */
export function canonicalRef(image: string): string {
  const { host, repository, reference } = parseImageReference(image);
  const sep = reference.startsWith("sha256:") ? "@" : ":";
  return `${host}/${repository}${sep}${reference}`;
}

/**
 * The clock this module waits on between retries. INJECTABLE, never hardcoded
 * to a real timer at the call site — per `audit-ambient-time-in-tests.ts` /
 * `.claude/rules/local-time-never-enters-the-shared-fold.md`, a real backoff
 * wait is an undeclared ambient time channel, and this is the declared door
 * it enters through. Production (`resolveImage`'s default) uses the real
 * clock; tests inject a no-op so the RETRY COUNT and CLASSIFICATION are still
 * exercised for real while zero wall-clock time is spent proving it.
 */
export type SleepFn = (ms: number) => Promise<void>;

function realSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(4000, 250 * 2 ** attempt) + Math.floor(Math.random() * 200);
}

type FetchOutcome = { readonly ok: true; readonly response: Response } | { readonly ok: false; readonly reason: string };

/**
 * `fetchManifest`, retried on the TRANSIENT classes only (network throw, 429,
 * 5xx). 404/401/403 are deterministic registry answers and are returned as-is
 * on the first attempt — retrying them would only spend the rate-limit budget
 * `--json` risk-reports on.
 */
async function fetchWithRetry(
  url: string,
  repository: string,
  tokens: Map<string, string>,
  maxAttempts = 4,
  sleepFn: SleepFn = realSleep,
): Promise<FetchOutcome> {
  let lastReason = "no attempt made";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchManifest(url, repository, tokens);
      if (response.status === 429 || response.status >= 500) {
        lastReason = `HTTP ${String(response.status)}`;
        if (attempt < maxAttempts) {
          await sleepFn(backoffMs(attempt));
          continue;
        }
        return { ok: false, reason: lastReason };
      }
      return { ok: true, response };
    } catch (e) {
      lastReason = e instanceof Error ? e.message : String(e);
      if (attempt < maxAttempts) {
        await sleepFn(backoffMs(attempt));
        continue;
      }
      return { ok: false, reason: lastReason };
    }
  }
  return { ok: false, reason: lastReason };
}

interface RegistryManifest {
  readonly manifests?: readonly {
    readonly digest: string;
    readonly platform?: { readonly os?: string; readonly architecture?: string };
  }[];
  readonly config?: { readonly digest?: string };
}

interface RegistryConfig {
  readonly architecture?: string;
  readonly os?: string;
}

function unresolved(
  canonical: string,
  status: ResolutionStatus,
  httpStatus: number | null,
  reason: string,
  isDockerHub: boolean,
  isLatestOrUntagged: boolean,
  hasDigest: boolean,
  today: string,
): ResolvedImage {
  return {
    reference: canonical,
    status,
    httpStatus,
    arches: [],
    requiredArchesMissing: [...REQUIRED_ARCHES],
    reason,
    isDockerHub,
    isLatestOrUntagged,
    hasDigest,
    resolvedAt: today,
  };
}

export interface DockerHubVerdict {
  readonly verdict: "missing" | null;
  readonly detail: string;
}

/**
 * Docker Hub's own catalog API, consulted ONLY when the OCI distribution
 * registry answered 401/403 for a docker.io TAG reference — the ambiguous
 * case `image-source-provenance.ts`'s own header already names: "Both
 * ghcr.io and Docker Hub answer 401 ... for a repository that was never
 * created". Left alone, that reading swallows a real deletion: MEASURED
 * 2026-09-22 — `minio/minio` and `minio/mc` were DELETED from Docker Hub
 * around 2026-09-11, every tag now 401s at the OCI registry exactly like a
 * private repo would, and this checker's first cut classified both as
 * `unknown` rather than the `missing` they actually are.
 *
 * Unlike the OCI distribution API, Docker Hub's catalog
 * (`hub.docker.com/v2/repositories/...`) is a plain, anonymous-readable REST
 * API that answers a real 404 when the repository or the tag is gone — it is
 * not gated by the same pull-scope check that produces the ambiguous 401.
 *
 * Returns `verdict: "missing"` ONLY on a DEFINITIVE 404 (repository or tag).
 * A 200 (the repo/tag exists — the 401 is then a genuine access
 * restriction), a network failure, or any other status returns
 * `verdict: null`: the caller stays `unknown`, never promoted to `missing`
 * on an inconclusive signal — the same "a failed probe is `unknown`, never
 * `missing`" stance this file's header already commits to, extended one
 * level: an INCONCLUSIVE disambiguation is exactly as failed as no probe at
 * all.
 */
export async function dockerHubDisambiguate(namespace: string, repoName: string, tag: string): Promise<DockerHubVerdict> {
  const repoUrl = `https://hub.docker.com/v2/repositories/${namespace}/${repoName}`;
  let repoStatus: number;
  try {
    repoStatus = (await fetch(repoUrl)).status;
  } catch (e) {
    return { verdict: null, detail: `Docker Hub repository API unreachable: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (repoStatus === 404) {
    return { verdict: "missing", detail: `Docker Hub confirms ${namespace}/${repoName} does not exist (catalog API 404)` };
  }
  let tagStatus: number;
  try {
    tagStatus = (await fetch(`${repoUrl}/tags/${encodeURIComponent(tag)}`)).status;
  } catch (e) {
    return { verdict: null, detail: `Docker Hub tags API unreachable: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (tagStatus === 404) {
    return {
      verdict: "missing",
      detail: `Docker Hub confirms the tag "${tag}" does not exist on ${namespace}/${repoName} (catalog API 404)`,
    };
  }
  if (tagStatus === 200) {
    return {
      verdict: null,
      detail: `Docker Hub catalog shows ${namespace}/${repoName}:${tag} exists; the registry 401/403 is a genuine access restriction, not absence`,
    };
  }
  return {
    verdict: null,
    detail: `Docker Hub catalog API gave no definitive answer (repository ${String(repoStatus)}, tag ${String(tagStatus)})`,
  };
}

/**
 * Resolve one reference exactly as a node pulling it at first boot would
 * experience it. `maxAttempts` defaults to 4; tests pass 1 to keep the
 * transient-failure cases fast (no real backoff wait).
 */
export async function resolveImage(
  image: string,
  tokens = new Map<string, string>(),
  maxAttempts = 4,
  sleepFn: SleepFn = realSleep,
): Promise<ResolvedImage> {
  const { host, repository, reference } = parseImageReference(image);
  const canonical = canonicalRef(image);
  const isDockerHub = host === "registry-1.docker.io";
  const isLatestOrUntagged = reference === "latest";
  const hasDigest = reference.startsWith("sha256:");
  const today = new Date().toISOString().slice(0, 10);
  const base = `https://${host}/v2/${repository}/manifests/`;

  const first = await fetchWithRetry(base + reference, repository, tokens, maxAttempts, sleepFn);
  if (!first.ok) return unresolved(canonical, "unknown", null, first.reason, isDockerHub, isLatestOrUntagged, hasDigest, today);
  const response = first.response;
  if (response.status === 404) {
    return unresolved(
      canonical,
      "missing",
      404,
      "registry reports 404 (MANIFEST_UNKNOWN, or the repository does not exist)",
      isDockerHub,
      isLatestOrUntagged,
      hasDigest,
      today,
    );
  }
  if (!response.ok) {
    // docker.io's 401/403 is ambiguous by construction (private repo AND a
    // deleted one both answer it) — disambiguate against Docker Hub's own
    // catalog API before settling for `unknown`. Digest references skip this:
    // the Hub tags API answers by TAG name, and a digest is not one.
    if (isDockerHub && !hasDigest && (response.status === 401 || response.status === 403)) {
      const slash = repository.indexOf("/");
      const namespace = slash === -1 ? "" : repository.slice(0, slash);
      const repoName = slash === -1 ? "" : repository.slice(slash + 1);
      if (namespace !== "" && repoName !== "") {
        const disambiguated = await dockerHubDisambiguate(namespace, repoName, reference);
        if (disambiguated.verdict === "missing") {
          return unresolved(canonical, "missing", response.status, disambiguated.detail, isDockerHub, isLatestOrUntagged, hasDigest, today);
        }
        return unresolved(
          canonical,
          "unknown",
          response.status,
          `registry HTTP ${String(response.status)}; ${disambiguated.detail}`,
          isDockerHub,
          isLatestOrUntagged,
          hasDigest,
          today,
        );
      }
    }
    return unresolved(
      canonical,
      "unknown",
      response.status,
      `registry HTTP ${String(response.status)} (closed door or transient — image-source-provenance.ts owns the public/private question)`,
      isDockerHub,
      isLatestOrUntagged,
      hasDigest,
      today,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (e) {
    return unresolved(
      canonical,
      "unknown",
      response.status,
      `manifest body did not parse: ${e instanceof Error ? e.message : String(e)}`,
      isDockerHub,
      isLatestOrUntagged,
      hasDigest,
      today,
    );
  }
  const manifest = body as RegistryManifest;

  let arches: string[];
  if (Array.isArray(manifest.manifests) && manifest.manifests.length > 0) {
    // A manifest LIST/index declares every platform right here — no further
    // fetch needed. `os`/`architecture` of `unknown` are attestation/SBOM
    // pseudo-entries (buildx provenance), not pullable platforms; excluded.
    arches = [...manifest.manifests]
      .filter((m) => m.platform !== undefined && m.platform.os !== "unknown" && m.platform.architecture !== "unknown")
      .map((m) => `${m.platform?.os ?? "?"}/${m.platform?.architecture ?? "?"}`)
      .sort(stringCompare);
  } else {
    // Single-platform manifest: the platform lives in the CONFIG BLOB, not the
    // manifest itself (OCI image manifests carry no top-level `architecture`).
    const configDigest = manifest.config?.digest;
    if (configDigest === undefined) {
      return unresolved(
        canonical,
        "unknown",
        response.status,
        "manifest carries neither a platform index nor a config digest",
        isDockerHub,
        isLatestOrUntagged,
        hasDigest,
        today,
      );
    }
    const blob = await fetchWithRetry(`https://${host}/v2/${repository}/blobs/${configDigest}`, repository, tokens, maxAttempts, sleepFn);
    if (!blob.ok) return unresolved(canonical, "unknown", null, blob.reason, isDockerHub, isLatestOrUntagged, hasDigest, today);
    if (blob.response.status === 404) {
      return unresolved(
        canonical,
        "missing",
        404,
        "manifest referenced a config blob the registry does not have",
        isDockerHub,
        isLatestOrUntagged,
        hasDigest,
        today,
      );
    }
    if (!blob.response.ok) {
      return unresolved(
        canonical,
        "unknown",
        blob.response.status,
        `config blob HTTP ${String(blob.response.status)}`,
        isDockerHub,
        isLatestOrUntagged,
        hasDigest,
        today,
      );
    }
    let configBody: unknown;
    try {
      configBody = await blob.response.json();
    } catch (e) {
      return unresolved(
        canonical,
        "unknown",
        blob.response.status,
        `config blob did not parse: ${e instanceof Error ? e.message : String(e)}`,
        isDockerHub,
        isLatestOrUntagged,
        hasDigest,
        today,
      );
    }
    const cfg = configBody as RegistryConfig;
    arches = cfg.architecture === undefined ? [] : [`${cfg.os ?? "linux"}/${cfg.architecture}`];
    if (arches.length === 0) {
      return unresolved(
        canonical,
        "unknown",
        response.status,
        "config blob carries no architecture field",
        isDockerHub,
        isLatestOrUntagged,
        hasDigest,
        today,
      );
    }
  }

  const requiredArchesMissing = REQUIRED_ARCHES.filter((a) => !arches.includes(a));
  const status: ResolutionStatus = requiredArchesMissing.length > 0 ? "arch-missing" : "ok";
  return {
    reference: canonical,
    status,
    httpStatus: response.status,
    arches,
    requiredArchesMissing,
    reason: status === "ok" ? "" : `required arch(es) not in manifest: ${requiredArchesMissing.join(", ")}`,
    isDockerHub,
    isLatestOrUntagged,
    hasDigest,
    resolvedAt: today,
  };
}

// ---------------------------------------------------------------------------
// Bounded concurrency — the DoP knob
// ---------------------------------------------------------------------------

/**
 * Process `items` with at most `dop` in flight. DoP=1 drains the queue in a
 * single cooperative loop, deterministic and DST-replayable; DoP=N ferries N
 * workers over the same queue. No raw `Task.Run`-equivalent, no unbounded
 * `Promise.all` — see `.claude/rules/async-all-the-way-truthful-signatures.md`.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  dop: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(dop, items.length === 0 ? 1 : items.length));
  async function worker(): Promise<void> {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      const item = items[i] as T;
      results[i] = await fn(item, i);
    }
  }
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface Snapshot {
  readonly $comment: string;
  readonly requiredArches: readonly string[];
  readonly reportedArches: readonly string[];
  readonly entries: readonly ResolvedImage[];
}

export function loadSnapshot(repoRoot: string = REPO_ROOT): Snapshot {
  const text = readFileSync(resolve(repoRoot, SNAPSHOT_PATH), "utf8");
  return JSON.parse(text) as Snapshot;
}

const SNAPSHOT_COMMENT =
  "MEASURED image resolvability — for every image the first-boot roster + ArgoCD Applications reference at " +
  "the committed (metal) rung, whether an ANONYMOUS client can resolve its manifest and whether that manifest " +
  "covers the required arch(es). Written ONLY by `bun src/Core.TypeScript/cluster/image-resolvability.ts " +
  "--refresh`; never hand-edited. This file is EVIDENCE WITH A DATE, not an oracle — see the module header for " +
  "the offline/--refresh split and why a failed probe is `unknown`, never `missing`.";

// ---------------------------------------------------------------------------
// Acknowledgements — a dated, tracked, EXPIRING allowlist for a finding this
// checker is right about but that a DIFFERENT change already owns fixing.
// ---------------------------------------------------------------------------

export interface Acknowledgement {
  /** The branch, PR, or work-item that owns the fix. Mandatory — this is coordination, not a hiding place. */
  readonly tracking: string;
  readonly recordedOn: string;
  /**
   * ISO date. Once `today > expiresOn` the acknowledgement stops suppressing
   * the finding and the gate goes red again on its own — no second mechanism
   * has to remember to remove it, and a fix that landed late re-reds loudly
   * rather than staying quiet forever.
   */
  readonly expiresOn: string;
  readonly reason: string;
}

/**
 * Keyed by CANONICAL reference (`ResolvedImage.reference`), same key space as
 * the snapshot. An entry here does not mean "ignore" — `formatReport` prints
 * it in its own section on every run, gating or not, and `--json` carries it
 * too. It means "this is tracked elsewhere; don't make an unrelated PR red
 * for it in the meantime."
 *
 * EMPTY AS OF 2026-09-22, AND THAT IS THE RECORD, NOT AN OMISSION. This
 * register carried exactly two entries — `minio/minio` and `minio/mc`,
 * bundled by GitLab's chart at ancient default tags, DELETED from Docker Hub
 * around 2026-09-11 — while `claude/gitlab-minio-image-gone` (a separate
 * change) owned disabling/repointing GitLab's bundled minio subchart. Both
 * lifted exactly as their own `LIFTS WHEN` clauses said: PR #17486 disabled
 * the bundled subchart and repointed GitLab's object storage at seaweedfs, so
 * neither image renders anywhere in this tree any more — `staleAcknowledgements`
 * (below) would have refused a PR that removed the render without also
 * removing the entries here, which is exactly the check that caught this one
 * needing to be filed. An empty register is not a smaller version of a full
 * one; it is what "the mechanism worked" looks like.
 */
export const ACKNOWLEDGED_MISSING: ReadonlyMap<string, Acknowledgement> = new Map([]);

/** Is `reference` acknowledged, and is the acknowledgement still within its stated window? */
export function acknowledgedAndLive(
  reference: string,
  today: string,
  register: ReadonlyMap<string, Acknowledgement> = ACKNOWLEDGED_MISSING,
): boolean {
  const ack = register.get(reference);
  if (ack === undefined) return false;
  return today <= ack.expiresOn;
}

/**
 * Acknowledgements whose target is no longer even a CURRENT finding
 * (missing/arch-missing) at all — dead weight, and this GATES rather than
 * merely reporting it. An entry matching nothing is either a fix that landed
 * without its acknowledgement being removed (this register's own minio
 * incident: PR #17486 disabled GitLab's bundled minio subchart and both
 * entries here should have been deleted in the same change) or a
 * reference that never matched what it claimed to. Either way the register
 * is no longer an honest description of what it is carrying, and honesty is
 * the entire reason it is allowed to suppress a gate at all — so a stale
 * entry does not get to sit quietly; it is cheap to check and cheap to fix
 * (delete the entry), so there is no reason to let it linger.
 */
export function staleAcknowledgements(
  rows: readonly ReportRow[],
  register: ReadonlyMap<string, Acknowledgement> = ACKNOWLEDGED_MISSING,
): readonly (readonly [string, Acknowledgement])[] {
  const liveMissingRefs = new Set(
    rows
      .filter((r) => r.resolution?.status === "missing" || r.resolution?.status === "arch-missing")
      .map((r) => r.resolution?.reference)
      .filter((r): r is string => r !== undefined),
  );
  return [...register.entries()].filter(([ref]) => !liveMissingRefs.has(ref));
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface ReportRow {
  readonly image: string;
  readonly sources: readonly string[];
  readonly resolution: ResolvedImage | null; // null: not yet in the snapshot (offline mode only)
  /** Risk flag, report-only: this tag exactly equals the kube-version we rendered with. */
  readonly kubeVersionDerived: boolean;
}

export interface Report {
  readonly rows: readonly ReportRow[];
  readonly renderFailures: readonly string[];
  readonly mode: "offline" | "refresh";
}

/** A row whose status is `missing`/`arch-missing` and is NOT acknowledged-and-live today. */
export function isGatingRow(
  row: ReportRow,
  today: string = new Date().toISOString().slice(0, 10),
  register: ReadonlyMap<string, Acknowledgement> = ACKNOWLEDGED_MISSING,
): boolean {
  const status = row.resolution?.status;
  if (status !== "missing" && status !== "arch-missing") return false;
  return !acknowledgedAndLive(row.resolution?.reference ?? "", today, register);
}

/**
 * The rows that actually fail the gate — the ONE definition of "gating",
 * shared by `formatReport` and `main`'s exit code so the printed report and
 * the process exit status can never disagree about which rows counted.
 * `register` is injectable (defaults to the production `ACKNOWLEDGED_MISSING`)
 * so a test proving the ACKNOWLEDGED-DOES-NOT-GATE behaviour uses its own
 * fixture entry rather than depending on whatever this file's register
 * happens to contain today — the production register's CONTENTS are a
 * separate concern, covered by its own describe block below.
 */
export function gatingRows(
  rows: readonly ReportRow[],
  today: string = new Date().toISOString().slice(0, 10),
  register: ReadonlyMap<string, Acknowledgement> = ACKNOWLEDGED_MISSING,
): readonly ReportRow[] {
  return rows.filter((r) => isGatingRow(r, today, register));
}

function counts(
  rows: readonly ReportRow[],
  today: string = new Date().toISOString().slice(0, 10),
  register: ReadonlyMap<string, Acknowledgement> = ACKNOWLEDGED_MISSING,
) {
  let ok = 0;
  let missing = 0;
  let archMissing = 0;
  let unknown = 0;
  let notYetMeasured = 0;
  let dockerHub = 0;
  let latestOrUntagged = 0;
  let noDigest = 0;
  let kubeVersionDerived = 0;
  let acknowledged = 0;
  for (const row of rows) {
    // A property of the REFERENCE, not of whether it has been resolved yet —
    // counted for every row, including not-yet-measured ones.
    if (row.kubeVersionDerived) kubeVersionDerived += 1;
    if (row.resolution === null) {
      notYetMeasured += 1;
      continue;
    }
    const r = row.resolution;
    if (r.status === "ok") ok += 1;
    else if (r.status === "missing") missing += 1;
    else if (r.status === "arch-missing") archMissing += 1;
    else unknown += 1;
    if ((r.status === "missing" || r.status === "arch-missing") && acknowledgedAndLive(r.reference, today, register)) acknowledged += 1;
    if (r.isDockerHub) dockerHub += 1;
    if (r.isLatestOrUntagged) latestOrUntagged += 1;
    if (!r.hasDigest) noDigest += 1;
  }
  return { ok, missing, archMissing, unknown, notYetMeasured, dockerHub, latestOrUntagged, noDigest, kubeVersionDerived, acknowledged };
}

export function formatReport(
  report: Report,
  today: string = new Date().toISOString().slice(0, 10),
  register: ReadonlyMap<string, Acknowledgement> = ACKNOWLEDGED_MISSING,
): string {
  const c = counts(report.rows, today, register);
  const lines: string[] = [];
  lines.push(
    `image resolvability (${report.mode}) — ${String(report.rows.length)} distinct image reference(s), ` +
      `required arch(es): ${REQUIRED_ARCHES.join(", ")}`,
  );
  lines.push(
    `  ok=${String(c.ok)} missing=${String(c.missing)} arch-missing=${String(c.archMissing)} ` +
      `unknown=${String(c.unknown)} not-yet-measured=${String(c.notYetMeasured)} ` +
      `acknowledged=${String(c.acknowledged)} (of missing+arch-missing; still printed below, does not gate)`,
  );
  lines.push(
    `  risk (report-only): docker.io=${String(c.dockerHub)} (anonymous pull limit is 100/6h per IP) ` +
      `:latest-or-untagged=${String(c.latestOrUntagged)} no-digest=${String(c.noDigest)} ` +
      `kube-version-derived=${String(c.kubeVersionDerived)} (tag == the kube-version rendered with; fragile to drift)`,
  );
  lines.push("");

  if (report.renderFailures.length > 0) {
    lines.push(`  ${String(report.renderFailures.length)} RENDER FAILURE(S) — could not extract images at all:`);
    for (const f of report.renderFailures) lines.push(`    ${f}`);
    lines.push("");
  }

  const kubeVersionRisk = report.rows.filter((r) => r.kubeVersionDerived);
  if (kubeVersionRisk.length > 0) {
    lines.push(
      `  ${String(kubeVersionRisk.length)} KUBE-VERSION-DERIVED (risk, not gating) — a stale ` +
        `${KUBE_VERSION_PATH} silently changes these tags on the next render:`,
    );
    for (const row of kubeVersionRisk) lines.push(`    ${row.image} (${row.sources.join(", ")})`);
    lines.push("");
  }

  const bad = report.rows.filter((r) => r.resolution?.status === "missing" || r.resolution?.status === "arch-missing");
  const gating = gatingRows(report.rows, today, register);
  const acked = bad.filter((r) => !gating.includes(r));
  if (gating.length > 0) {
    lines.push(`  ${String(gating.length)} MISSING / ARCH-MISSING (GATING) — first boot WILL ImagePullBackOff on these:`);
    for (const row of gating) {
      const r = row.resolution;
      lines.push(`    [${r?.status ?? "?"}] ${row.image} (${row.sources.join(", ")}) — ${r?.reason ?? ""}`);
    }
    lines.push("");
  }

  if (acked.length > 0) {
    lines.push(
      `  ${String(acked.length)} MISSING / ARCH-MISSING, ACKNOWLEDGED (dated, tracked, expiring — does not gate):`,
    );
    for (const row of acked) {
      const r = row.resolution;
      const ack = r === null || r === undefined ? undefined : register.get(r.reference);
      lines.push(
        `    [${r?.status ?? "?"}] ${row.image} (${row.sources.join(", ")}) — tracking ${ack?.tracking ?? "?"}, ` +
          `expires ${ack?.expiresOn ?? "?"}`,
      );
    }
    lines.push("");
  }

  // The OTHER direction of drift: an acknowledgement whose target is no
  // longer a finding at all (fixed) is dead weight and GATES — see
  // staleAcknowledgements()'s own header for why this is cheap to check and
  // cheap to fix, so there is no reason to let it linger as a mere report.
  const staleAcks = staleAcknowledgements(report.rows, register);
  if (staleAcks.length > 0) {
    lines.push(`  ${String(staleAcks.length)} STALE ACKNOWLEDGEMENT(S) (GATING) — matches no current finding, delete the entry:`);
    for (const [ref, ack] of staleAcks) lines.push(`    ${ref} (tracking ${ack.tracking}, recorded ${ack.recordedOn})`);
    lines.push("");
  }

  const warn = report.rows.filter((r) => r.resolution?.status === "unknown");
  if (warn.length > 0) {
    lines.push(`  ${String(warn.length)} UNKNOWN (warn, not gating) — probe failed or auth-required:`);
    for (const row of warn) lines.push(`    ${row.image} — ${row.resolution?.reason ?? ""}`);
    lines.push("");
  }

  const fresh = report.rows.filter((r) => r.resolution === null);
  if (fresh.length > 0) {
    lines.push(
      `  ${String(fresh.length)} NOT YET MEASURED (new since the last --refresh; warn, not gating): ` +
        fresh.map((r) => r.image).join(", "),
    );
    lines.push("");
  }

  if (gating.length === 0 && bad.length === 0) lines.push("  no missing or arch-missing images among currently-rendered manifests.");
  else if (gating.length === 0) lines.push("  no GATING missing/arch-missing images (all are acknowledged above).");
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Offline audit
// ---------------------------------------------------------------------------

type Discovered = { readonly images: readonly DiscoveredImage[]; readonly renderFailures: readonly string[] };

/**
 * `discover` is injectable so tests can exercise the offline-gate and
 * network-refresh logic without invoking real `helm` + real registries — the
 * same discipline `RenderOptions.runHelm` uses above, one level up the stack.
 */
export function audit(repoRoot: string = REPO_ROOT, discover: () => Discovered = () => discoverImages({ repoRoot })): Report {
  const { images, renderFailures } = discover();
  const snapshot = loadSnapshot(repoRoot);
  const byRef = new Map(snapshot.entries.map((e) => [e.reference, e]));
  const rows: ReportRow[] = images.map((d) => ({
    image: d.image,
    sources: d.sources,
    resolution: byRef.get(canonicalRef(d.image)) ?? null,
    kubeVersionDerived: d.kubeVersionDerived,
  }));
  return { rows, renderFailures, mode: "offline" };
}

// ---------------------------------------------------------------------------
// Network refresh
// ---------------------------------------------------------------------------

export async function refresh(
  repoRoot: string = REPO_ROOT,
  dop = 8,
  discover: () => Discovered = () => discoverImages({ repoRoot }),
): Promise<{ report: Report; changed: boolean }> {
  const { images, renderFailures } = discover();
  const byCanonical = new Map<string, string>();
  for (const d of images) byCanonical.set(canonicalRef(d.image), d.image);
  const canonicalRefs = [...byCanonical.keys()].sort(stringCompare);

  const tokens = new Map<string, string>();
  const resolved = await mapWithConcurrency(canonicalRefs, dop, async (ref, i) => {
    const raw = byCanonical.get(ref) ?? ref;
    const r = await resolveImage(raw, tokens);
    process.stderr.write(`${String(i + 1)}/${String(canonicalRefs.length)} [${r.status}] ${ref}\n`);
    return r;
  });

  const entries = [...resolved].sort((a, b) => stringCompare(a.reference, b.reference));
  const next: Snapshot = { $comment: SNAPSHOT_COMMENT, requiredArches: REQUIRED_ARCHES, reportedArches: REPORTED_ARCHES, entries };
  const rendered = JSON.stringify(next, null, 2) + "\n";

  const snapshotPath = resolve(repoRoot, SNAPSHOT_PATH);
  let previous = "";
  try {
    previous = readFileSync(snapshotPath, "utf8");
  } catch {
    previous = "";
  }
  // `resolvedAt` moving alone is not news — same discipline as
  // image-source-provenance.ts's refresh() and chart-version-refresh.
  const stripDates = (s: string): string => s.replace(/"resolvedAt": "[^"]*"/g, "");
  const changed = stripDates(previous) !== stripDates(rendered);
  if (changed) writeFileSync(snapshotPath, rendered);

  const byRef = new Map(entries.map((e) => [e.reference, e]));
  const rows: ReportRow[] = images.map((d) => ({
    image: d.image,
    sources: d.sources,
    resolution: byRef.get(canonicalRef(d.image)) ?? null,
    kubeVersionDerived: d.kubeVersionDerived,
  }));
  return { report: { rows, renderFailures, mode: "refresh" }, changed };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function main(argv: readonly string[], repoRoot: string = REPO_ROOT): Promise<number> {
  const { values: flags, positionals } = parseArgs({
    args: [...argv],
    options: {
      json: { type: "boolean", default: false },
      refresh: { type: "boolean", default: false },
      dop: { type: "string", default: "8" },
    },
    strict: true,
    allowPositionals: true,
  });
  if (positionals.length > 0) {
    process.stderr.write(
      `unknown argument(s): ${positionals.join(" ")}\n` +
        "Usage: bun src/Core.TypeScript/cluster/image-resolvability.ts [--json] [--refresh] [--dop N]\n",
    );
    return 2;
  }
  const dop = Number.parseInt(flags.dop, 10);
  if (!Number.isFinite(dop) || dop < 1) {
    process.stderr.write(`--dop must be a positive integer, got "${flags.dop}"\n`);
    return 2;
  }

  if (flags.refresh) {
    const { report, changed } = await refresh(repoRoot, dop);
    if (flags.json) {
      process.stdout.write(JSON.stringify({ mode: report.mode, changed, ...counts(report.rows) }, null, 2) + "\n");
    } else {
      process.stdout.write(formatReport(report));
      process.stdout.write(changed ? `\nsnapshot REWRITTEN — commit ${SNAPSHOT_PATH}\n` : "\nsnapshot unchanged.\n");
    }
    if (report.renderFailures.length > 0) return 1;
    return gatingRows(report.rows).length > 0 || staleAcknowledgements(report.rows).length > 0 ? 1 : 0;
  }

  const report = audit(repoRoot);
  if (flags.json) {
    process.stdout.write(JSON.stringify({ mode: report.mode, renderFailures: report.renderFailures, ...counts(report.rows), rows: report.rows }, null, 2) + "\n");
  } else {
    process.stdout.write(formatReport(report));
  }
  if (report.renderFailures.length > 0) return 1;
  return gatingRows(report.rows).length > 0 || staleAcknowledgements(report.rows).length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
