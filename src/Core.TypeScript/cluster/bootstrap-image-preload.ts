#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/bootstrap-image-preload.ts
 *
 * THE BOOTSTRAP IMAGE PRELOAD SET — which container images must be ON THE USB
 * STICK for a first boot to reach ArgoCD-landed with no registry reachable,
 * derived from the real `services.k3s.manifests` roster and never from a list.
 * 081M3BZ111D087G0R000YBMKRY (WP34).
 *
 * -- WHAT THIS DOES NOT DO. READ THIS FIRST. -----------------------------
 * This makes the cluster COME UP without a registry. It does NOT make the
 * roster CONVERGE offline.
 *
 * The first-boot external-dependency inventory (#17670, 081M3BWJ96T087G0R0028WT3S3)
 * measured 134 container images across EIGHT registries, of which the
 * pull-through cache covers ONE (docker.io, via mirror.gcr.io — 48 of 134,
 * 36%). This module covers the ~25 the BOOTSTRAP roster needs. The remaining
 * ~109 are the ArgoCD catalog, and they still pull from quay.io, ghcr.io,
 * registry.gitlab.com, registry.k8s.io and the rest, at whatever per-source-IP
 * budget the operator's NAT shares with strangers.
 *
 * So the improvement is precisely this, and nothing more: a registry outage or
 * a spent rate limit DELAYS THE ROSTER instead of BRICKING THE INSTALL. The
 * operator gets a running cluster with ArgoCD visibly reconciling and visibly
 * behind, rather than a partially provisioned node whose only explanation is a
 * stack location. Claiming an offline install would be worse than not doing
 * this.
 *
 * -- WHY THE BOOTSTRAP SLICE IS THE RIGHT SLICE, MEASURED ----------------
 * The whole roster is ~28.8 GB compressed / ~77 GB unpacked
 * (`image-footprint.ts`) — not an ISO. The bootstrap slice measures ~1.02 GB
 * compressed / ~2.7 GB unpacked at the x2.67 ratio `storage-profiles.json`
 * measured, and it is not an arbitrary cut:
 *
 *   - It is the seven charts the installed-disk verdict already asserts —
 *     cilium, cert-manager, spire, trust-manager, external-secrets, argocd,
 *     plus the local-path provisioner — i.e. the difference between "the
 *     machine boots and nothing happens" and "the cluster is up".
 *   - MEASURED 2026-09-25: every image in it except busybox, the two kubectls
 *     and argocd's redis sits on an UNMIRRORED registry — quay.io (11),
 *     ghcr.io (5), registry.k8s.io (2), cgr.dev (1), ecr-public (1). The
 *     bootstrap set is almost exactly the part of the 134 the mirror does not
 *     cover, which is why 1 GB here buys more than 1 GB anywhere else.
 *
 * -- k3s's OWN IMAGES: ONE IS IN, THE REST ARE NOT, AND A CLAIM IS CORRECTED
 * An earlier version of this header said k3s's built-ins "ship inside the k3s
 * release image and are in containerd before the agent starts". THAT WAS
 * WRONG, and it was wrong in the way this whole work item is about: it was
 * inferred from `ctr images ls` on a booted container, where the images were
 * present because they had just been PULLED. Measured directly afterwards,
 * `rancher/k3s:v1.35.7-k3s1` has no `/var/lib/rancher/k3s/agent/images/` and
 * ships no airgap tarball at all. The falsifier is what caught it.
 *
 * So: the SANDBOX (pause) image IS in this set, derived from the pinned k3s
 * binary by `deriveSandboxImage`, because without it a node cannot start a
 * single pod — including the pods whose own images are preloaded. 0.3 MB, and
 * the best ratio in the payload.
 *
 * `mirrored-coredns-coredns`, `mirrored-metrics-server`, `klipper-lb` and
 * `klipper-helm` are still out. They ARE pulled at first boot, and that is now
 * stated rather than denied — but they are all `docker.io/rancher/*`, i.e. the
 * one registry the mirror covers, and each supports a service that degrades
 * rather than a node that cannot run. Preloading them is a separate ~150 MB
 * decision with a ready mechanism (nixpkgs exposes the official airgap tarball
 * as `k3s.airgapImages`), and it is not made here.
 *
 * -- DERIVED, NEVER LISTED ------------------------------------------------
 * A second hand-maintained copy of a roster is a defect class this repo has
 * paid for repeatedly, so nothing here is spelled out:
 *
 *   `buildRoster()`        (first-boot-replica.ts) — parses
 *                          `services.k3s.manifests` out of k3s-server.nix AND
 *                          local-storage.nix's inline `pkgs.writeText` entry,
 *                          and throws on any shape it cannot see.
 *   `parseHelmChartCrs()`  (render-first-boot-charts.ts) — the HelmChart CRs.
 *   `imagesInDocuments()`  (image-footprint.ts) — every `image:` in a tree.
 *   `measureImage()`       (image-footprint.ts) — the ONE sizer. Not a second.
 *
 * The roster is read through `buildRoster`, so the tree's SECOND, legacy
 * bootstrap directory is excluded automatically and correctly: nothing in the
 * NixOS roster references it, so nothing on a first boot pulls it. That is a
 * consequence of deriving rather than listing — a hand-written set would have
 * had to remember to leave it out.
 *
 * -- VERIFY EARLIER, NOT LESS --------------------------------------------
 * The snapshot pins each image to the DIGEST its linux/amd64 manifest resolved
 * to at refresh time. `--verify` re-resolves every one before an archive is
 * built, so an image that moved under its tag is caught in CI — where there
 * are credentials, no rate limit worth worrying about, and a human reading a
 * red build — rather than on an operator's first boot. The archive is then
 * pulled BY DIGEST, so what ships is what was verified.
 *
 * Usage:
 *   bun src/Core.TypeScript/cluster/bootstrap-image-preload.ts --list
 *   bun src/Core.TypeScript/cluster/bootstrap-image-preload.ts --refresh
 *   bun src/Core.TypeScript/cluster/bootstrap-image-preload.ts --report
 *   bun src/Core.TypeScript/cluster/bootstrap-image-preload.ts --verify
 *   bun src/Core.TypeScript/cluster/bootstrap-image-preload.ts --build-archive --out <path>
 *
 * Exit codes: 0 = ok; 1 = a finding (drift, a digest that moved, a failed
 * pull); 2 = usage/environment error (helm missing, roster unparseable).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parseAllDocuments } from "yaml";

import { stringCompare } from "../collation/collation.ts";
import { buildRoster, k3sVersionToDockerTag, type RosterEntry } from "./first-boot-replica.ts";
import { fetchManifest, imagesInDocuments, measureImage, parseImageReference } from "./image-footprint.ts";
import { parseHelmChartCrs } from "../../../full-ai-cluster/k8s/tests/render-first-boot-charts.ts";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The committed snapshot. TEXT — `no-binary-in-proof-lineage`. */
export const SNAPSHOT_PATH = "full-ai-cluster/k8s/bootstrap-preload-images.json";

/** The two NixOS modules that between them ARE `services.k3s.manifests`. */
export const K3S_SERVER_NIX = "full-ai-cluster/nixos/modules/k3s-server.nix";
export const LOCAL_STORAGE_NIX = "full-ai-cluster/nixos/modules/local-storage.nix";

/** The one declared Kubernetes version — read, never restated. */
export const KUBE_VERSION_PATH = "full-ai-cluster/k8s/kubernetes-version.json";

/**
 * The ONE registry `mirror.gcr.io` covers, in `parseImageReference`'s
 * canonical spelling. Every other host in the set is unmirrored, and that is
 * derived rather than declared — see `unmirroredHosts()`.
 */
export const MIRRORED_HOST = "registry-1.docker.io";

/** A command runner that returns stdout too — used only by `deriveSandboxImage`. */
export type RunCommandWithOutput = (cmd: readonly string[]) => {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

const spawnRunWithOutput: RunCommandWithOutput = (cmd) => {
  const r = Bun.spawnSync(cmd as string[], { stdout: "pipe", stderr: "pipe" });
  return { status: r.exitCode ?? 1, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
};

// ---------------------------------------------------------------------------
// Derivation — roster to images
// ---------------------------------------------------------------------------

export interface PreloadImage {
  /** The reference exactly as the chart renders it (tag, digest, or both). */
  readonly reference: string;
  /** Roster attribute names that carry it, e.g. `cilium-install`. */
  readonly rosterAttrs: readonly string[];
}

export interface DerivedSet {
  readonly images: readonly PreloadImage[];
  /** Charts that would not render. NEVER silently dropped — a render failure is a hole in the set. */
  readonly renderFailures: readonly string[];
}

export interface ChartRenderRequest {
  readonly name: string;
  readonly chart: string;
  readonly repo: string;
  readonly version: string;
  readonly namespace: string;
  readonly values: string;
}

export type RenderChart = (
  request: ChartRenderRequest,
) => { readonly ok: true; readonly documents: readonly unknown[] } | { readonly ok: false; readonly detail: string };

export interface DeriveOptions {
  readonly repoRoot?: string;
  readonly helmBin?: string;
  readonly timeoutMs?: number;
  readonly kubeVersion?: string;
  /** Injected by the tests; defaults to a real `helm template`. */
  readonly renderChart?: RenderChart;
  /** Injected by the tests; defaults to reading it out of the pinned k3s binary. */
  readonly sandboxImage?: string;
}

/**
 * The SANDBOX (pause) image k3s pulls before it can start ANY pod.
 *
 * THIS SECTION CORRECTS A CLAIM I MADE AND SHOULD NOT HAVE. An earlier version
 * of this module stated that k3s's own built-ins "ship inside the k3s release
 * image and are in containerd before the agent starts", citing `ctr images ls`
 * on a booted container. That observation was real and the inference was wrong:
 * the images were there because they had just been PULLED. Measured directly:
 * `rancher/k3s:v1.35.7-k3s1` has no `/var/lib/rancher/k3s/agent/images/` at all
 * and ships no airgap tarball anywhere in its filesystem.
 *
 * What made it visible was the falsifier, and only the falsifier. With docker.io
 * blackholed, all twenty-five probes sat in `ContainerCreating` for twelve
 * minutes:
 *
 *     Failed to create pod sandbox: failed to get sandbox image
 *     "rancher/mirrored-pause:3.10.2": ... dial tcp 127.0.0.1:443: connect:
 *     connection refused
 *
 * So the sandbox image is the single most load-bearing image on the node —
 * WITHOUT IT NOTHING RUNS, including the pods whose own images are preloaded —
 * and a preload that omitted it would have produced a node that still could not
 * start a container. It is 0.3 MB. It is the best ratio in the entire payload.
 *
 * DERIVED FROM THE PINNED k3s IMAGE, not written down: the tag is read out of
 * the k3s binary itself, so it follows `kubernetes-version.json` with no second
 * pin to drift. Fully qualified on purpose — CRI normalises the sandbox
 * reference to `docker.io/...` before looking it up, so that is the name the
 * archive must carry.
 *
 * A failure to derive it THROWS. It must never be silently absent: an archive
 * missing the sandbox image is an archive that looks complete and produces a
 * node that cannot run a single pod.
 */
export function deriveSandboxImage(k3sDockerTag: string, run: RunCommandWithOutput = spawnRunWithOutput): string {
  const result = run([
    "docker",
    "run",
    "--rm",
    "--entrypoint",
    "sh",
    `rancher/k3s:${k3sDockerTag}`,
    "-c",
    "grep -ao 'rancher/mirrored-pause:[0-9][0-9.]*' /bin/k3s | sort -u | head -1",
  ]);
  const found = result.stdout.trim().split("\n")[0]?.trim() ?? "";
  if (!/^rancher\/mirrored-pause:[0-9][0-9.]*$/.test(found)) {
    throw new Error(
      `could not derive the k3s sandbox image from rancher/k3s:${k3sDockerTag} ` +
        `(got ${JSON.stringify(found)}; stderr: ${result.stderr.trim().slice(0, 200)}). ` +
        "Refusing to build a preload set without it: without the sandbox image a node cannot start ANY pod, " +
        "so an archive that omits it looks complete and provisions a machine that runs nothing.",
    );
  }
  return `docker.io/${found}`;
}

/** The one declared Kubernetes version; the same read every other renderer here does. */
export function declaredKubeVersion(repoRoot: string = REPO_ROOT): string {
  const parsed = JSON.parse(readFileSync(join(repoRoot, KUBE_VERSION_PATH), "utf8")) as {
    kubernetesVersion?: unknown;
  };
  if (typeof parsed.kubernetesVersion !== "string" || parsed.kubernetesVersion.trim() === "") {
    throw new Error(`${KUBE_VERSION_PATH} declares no \`kubernetesVersion\` string`);
  }
  return parsed.kubernetesVersion;
}

/**
 * Non-HelmChart documents in a roster entry — the plain manifests.
 *
 * `internal-secret-seeding.yaml` and `local-path-provisioner` are the live
 * cases: both are ordinary Kubernetes objects carrying container images that no
 * chart render would ever produce. Scanning only HelmChart CRs would have
 * silently omitted busybox, chainguard/bash and the local-path provisioner —
 * three images whose absence stalls exactly the waves this preload protects.
 */
export function plainDocuments(entry: RosterEntry): readonly unknown[] {
  const documents: unknown[] = [];
  for (const doc of parseAllDocuments(entry.content)) {
    if (doc.errors.length > 0) continue;
    const value = doc.toJS() as unknown;
    if (value === null || typeof value !== "object") continue;
    if ((value as { kind?: unknown }).kind === "HelmChart") continue;
    documents.push(value);
  }
  return documents;
}

/**
 * Images hidden inside a ConfigMap's string values — the local-path helper pod.
 *
 * FOUND BY THIS MODULE, 2026-09-25, and it is the reason this walk exists.
 * `local-storage.nix` embeds the provisioner's `helperPod.yaml` as a STRING
 * inside a ConfigMap, and that string carries `image: busybox`. A structural
 * `image:` walk cannot see it — `imagesInDocuments` is looking at a ConfigMap
 * whose `data` is text, not at a Pod — so the first pass of this derivation
 * produced a set with `rancher/local-path-provisioner` in it and `busybox`
 * missing. Preloading that set would have shipped a provisioner that cannot
 * provision: every PVC waits on a helper pod whose image is not on the stick,
 * on exactly the storage wave the bootstrap roster needs.
 *
 * NOTE WHAT ELSE THAT MEANS: `busybox` here is the bare name, i.e.
 * `busybox:latest`, which is a DIFFERENT containerd image name from the
 * `busybox:1.36@sha256:...` that `internal-secret-seeding.yaml` pins. Two
 * names, two entries, both required — a set deduplicated by "it's busybox
 * either way" would be wrong.
 *
 * Deliberately narrow: only `ConfigMap.data` values, only ones that YAML-parse
 * into objects, and a parse failure is a skip rather than an error (most
 * ConfigMap values are not manifests, and a scanner that threw on the first
 * `.properties` file would be useless). Over-counting fails loudly at the
 * registry; under-counting fails silently at 3am on someone's hardware.
 */
export function imagesInEmbeddedManifests(documents: readonly unknown[]): readonly string[] {
  const found = new Set<string>();
  for (const document of documents) {
    if (document === null || typeof document !== "object") continue;
    if ((document as { kind?: unknown }).kind !== "ConfigMap") continue;
    const data = (document as { data?: unknown }).data;
    if (data === null || typeof data !== "object") continue;
    for (const value of Object.values(data as Record<string, unknown>)) {
      if (typeof value !== "string" || !value.includes("image:")) continue;
      let embedded: unknown[];
      try {
        embedded = parseAllDocuments(value)
          .filter((d) => d.errors.length === 0)
          .map((d) => d.toJS() as unknown)
          .filter((d) => d !== null && typeof d === "object");
      } catch {
        continue;
      }
      for (const image of imagesInDocuments(embedded)) found.add(image);
    }
  }
  return [...found].sort(stringCompare);
}

/** `helm template` one HelmChart CR — the same invocation `image-resolvability.ts` uses. */
export function helmRenderChart(helmBin: string, kubeVersion: string, timeoutMs: number): RenderChart {
  return (request) => {
    if (!request.repo.startsWith("http://") && !request.repo.startsWith("https://")) {
      return { ok: false, detail: `repo "${request.repo}" has no http(s) scheme` };
    }
    const tmp = mkdtempSync(join(tmpdir(), "zeta-bootstrap-preload-"));
    try {
      const valuesPath = join(tmp, "values.yaml");
      writeFileSync(valuesPath, request.values, "utf8");
      const rendered = Bun.spawnSync(
        [
          helmBin,
          "template",
          request.name,
          request.chart,
          "--repo",
          request.repo,
          "--version",
          request.version,
          "--namespace",
          request.namespace,
          "--kube-version",
          kubeVersion,
          "--values",
          valuesPath,
        ],
        { stdout: "pipe", stderr: "pipe", timeout: timeoutMs },
      );
      if (rendered.exitCode !== 0) {
        return { ok: false, detail: rendered.stderr.toString().trim().slice(0, 400) };
      }
      const documents = parseAllDocuments(rendered.stdout.toString())
        .map((d) => d.toJS() as unknown)
        .filter((d): d is Record<string, unknown> => d !== null && typeof d === "object");
      return { ok: true, documents };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  };
}

/**
 * Every image a first boot must have before it can reach ArgoCD-landed.
 *
 * Needs `helm` and the network, because the only honest answer to "what does
 * the cilium chart pull" is to render the cilium chart at the version the
 * roster pins with the values the roster supplies.
 */
export function deriveBootstrapImages(options: DeriveOptions = {}): DerivedSet {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const kubeVersion = options.kubeVersion ?? declaredKubeVersion(repoRoot);
  const renderChart =
    options.renderChart ?? helmRenderChart(options.helmBin ?? "helm", kubeVersion, options.timeoutMs ?? 180_000);

  const roster = buildRoster({
    k3sServerNixPath: join(repoRoot, K3S_SERVER_NIX),
    localStorageNixPath: join(repoRoot, LOCAL_STORAGE_NIX),
  });

  const byImage = new Map<string, Set<string>>();
  const renderFailures: string[] = [];
  const note = (image: string, attr: string): void => {
    const trimmed = image.trim();
    if (trimmed === "") return;
    const existing = byImage.get(trimmed);
    if (existing === undefined) byImage.set(trimmed, new Set([attr]));
    else existing.add(attr);
  };

  for (const entry of roster) {
    const plain = plainDocuments(entry);
    for (const image of imagesInDocuments(plain)) note(image, entry.attr);
    for (const image of imagesInEmbeddedManifests(plain)) note(image, entry.attr);
    for (const cr of parseHelmChartCrs(entry.content, entry.sourceDescription)) {
      const result = renderChart({
        name: cr.name,
        chart: cr.chart,
        repo: cr.repo,
        version: cr.version,
        namespace: cr.namespace,
        values: cr.values,
      });
      if (!result.ok) {
        renderFailures.push(`${entry.attr} (${cr.chart} ${cr.version}): ${result.detail}`);
        continue;
      }
      for (const image of imagesInDocuments(result.documents)) note(image, entry.attr);
      // Charts embed manifests in ConfigMaps too (an operator's templated
      // helper Job is the usual shape); the same blindness applies, so the
      // same walk runs over the render.
      for (const image of imagesInEmbeddedManifests(result.documents)) note(image, entry.attr);
    }
  }

  // The sandbox image is not in the roster and never will be — k3s supplies it
  // — but nothing on the node starts without it, so a preload that omits it is
  // an archive that looks complete and provisions a machine that runs nothing.
  // See `deriveSandboxImage` for the measurement that put it here.
  const pin = JSON.parse(readFileSync(join(repoRoot, KUBE_VERSION_PATH), "utf8")) as { k3sVersion?: unknown };
  if (typeof pin.k3sVersion !== "string") {
    throw new Error(`${KUBE_VERSION_PATH} declares no \`k3sVersion\` string`);
  }
  // `k3sVersionToDockerTag` is the ONE conversion in this tree from a k3s
  // version pin to the tag `rancher/k3s` publishes; a second spelling here is
  // a second thing to get wrong.
  note(options.sandboxImage ?? deriveSandboxImage(k3sVersionToDockerTag(pin.k3sVersion)), "k3s-sandbox-image");

  const images = [...byImage.entries()]
    .map(([reference, attrs]) => ({ reference, rosterAttrs: [...attrs].sort(stringCompare) }))
    .sort((a, b) => stringCompare(a.reference, b.reference));
  return { images, renderFailures };
}

// ---------------------------------------------------------------------------
// The snapshot
// ---------------------------------------------------------------------------

export interface PinnedImage extends PreloadImage {
  /**
   * The digest of the linux/amd64 MANIFEST this reference resolved to.
   *
   * `null` means it could not be resolved and the pin is absent — never a
   * fabricated value. An unresolvable image is reported, not skipped: it is an
   * image the archive cannot carry, which is the same hole a missing pull is.
   */
  readonly amd64Digest: string | null;
  /** `config.size + sum(layers[].size)` from that manifest. `null` = UNSIZED, never zero. */
  readonly compressedBytes: number | null;
  /** Present only when the pin or the size is absent. */
  readonly reason?: string;
}

export interface Snapshot {
  readonly $comment: string;
  readonly resolvedAt: string;
  readonly kubernetesVersion: string;
  readonly derivedFrom: readonly string[];
  readonly totalCompressedBytes: number;
  readonly unsized: number;
  readonly images: readonly PinnedImage[];
}

export const SNAPSHOT_COMMENT =
  "GENERATED by `bun src/Core.TypeScript/cluster/bootstrap-image-preload.ts --refresh`. " +
  "The images a first boot must already have to reach ArgoCD-landed with no registry reachable. " +
  "Derived from services.k3s.manifests — never edit by hand. " +
  "BOOTSTRAP SLICE ONLY: the ~109 ArgoCD catalog images still pull from eight registries.";

export const REFRESH_COMMAND = "bun src/Core.TypeScript/cluster/bootstrap-image-preload.ts --refresh";

export function loadSnapshot(repoRoot: string = REPO_ROOT): Snapshot {
  return JSON.parse(readFileSync(join(repoRoot, SNAPSHOT_PATH), "utf8")) as Snapshot;
}

/**
 * The digest a reference resolves to on linux/amd64.
 *
 * Reuses `fetchManifest` — the ONE token-dance in this tree known to work
 * unmodified against docker.io, ghcr.io, quay.io, registry.k8s.io, cgr.dev and
 * public ECR. A second auth flow here would be a second thing to get wrong on a
 * registry nobody tests.
 */
export async function resolveAmd64Digest(
  reference: string,
  tokens: Map<string, string> = new Map(),
): Promise<{ readonly digest: string | null; readonly reason?: string }> {
  const { host, repository, reference: ref } = parseImageReference(reference);
  // INLINE, not behind a helper: `.github/codeql/codeql-config.yml` records that only a
  // guard CodeQL's DEFAULT taint barriers recognise closes a first-party alert, and its
  // own `guarded.ts` fixture tests the value AT THE SITE THAT USES IT. Delegating the same
  // regex to a named function left the alert open -- measured 2026-09-25, this PR.
  // It is also a real refusal: file data must not steer an outbound request to something
  // that is not a registry.
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?$/.test(host)) {
    throw new Error(`refusing to build a registry URL for ${JSON.stringify(host)}: not a hostname`);
  }
  if (!/^[a-z0-9]+([._-][a-z0-9]+)*(\/[a-z0-9]+([._-][a-z0-9]+)*)*$/.test(repository)) {
    throw new Error(`refusing to build a registry URL for ${JSON.stringify(repository)}: not a repository path`);
  }
  const base = `https://${host}/v2/${repository}/manifests/`;
  // The TAG or DIGEST is the last piece of the URL path, and it comes out of
  // the same committed snapshot the host and repository do. Guarding two of
  // three would be the partly-guarded fixture, which this repo pins as still
  // REPORTED on purpose.
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}$|^sha256:[0-9a-f]{64}$/.test(ref)) {
    throw new Error(`refusing to request ${JSON.stringify(ref)}: not a tag or a digest`);
  }
  const response = await fetchManifest(base + ref, repository, tokens);
  if (!response.ok) return { digest: null, reason: `manifest HTTP ${String(response.status)}` };
  const manifest = (await response.json()) as Record<string, unknown>;
  const index = manifest.manifests;
  if (Array.isArray(index)) {
    const amd64 = index.find((entry) => {
      const platform = (entry as { platform?: { architecture?: string; os?: string } }).platform;
      return platform?.architecture === "amd64" && platform.os === "linux";
    }) as { digest?: string } | undefined;
    if (typeof amd64?.digest !== "string") return { digest: null, reason: "no linux/amd64 entry in the index" };
    return { digest: amd64.digest };
  }
  // A single-arch manifest: the digest IS the one the reference resolved to,
  // and the registry reports it in Docker-Content-Digest.
  const header = response.headers.get("docker-content-digest");
  if (header !== null && header.startsWith("sha256:")) return { digest: header };
  return { digest: null, reason: "single-arch manifest carried no Docker-Content-Digest" };
}

/** Re-derive, re-resolve, and return the snapshot that would be written. */
export async function buildSnapshot(options: DeriveOptions = {}): Promise<{
  readonly snapshot: Snapshot;
  readonly renderFailures: readonly string[];
}> {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const derived = deriveBootstrapImages(options);
  const tokens = new Map<string, string>();
  const images: PinnedImage[] = [];
  let total = 0;
  let unsized = 0;
  for (const image of derived.images) {
    const measured = await measureImage(image.reference, tokens);
    const pin = await resolveAmd64Digest(image.reference, tokens);
    if (typeof measured.compressedBytes === "number") total += measured.compressedBytes;
    else unsized++;
    const reason = measured.reason ?? pin.reason;
    images.push({
      ...image,
      amd64Digest: pin.digest,
      compressedBytes: measured.compressedBytes,
      ...(reason === undefined ? {} : { reason }),
    });
  }
  return {
    snapshot: {
      $comment: SNAPSHOT_COMMENT,
      resolvedAt: new Date().toISOString().slice(0, 10),
      kubernetesVersion: options.kubeVersion ?? declaredKubeVersion(repoRoot),
      derivedFrom: [K3S_SERVER_NIX, LOCAL_STORAGE_NIX],
      totalCompressedBytes: total,
      unsized,
      images,
    },
    renderFailures: derived.renderFailures,
  };
}

// ---------------------------------------------------------------------------
// Drift — the set the roster produces vs the set the snapshot claims
// ---------------------------------------------------------------------------

export interface Drift {
  /** In the roster, absent from the snapshot: an image that would NOT be preloaded. */
  readonly missingFromSnapshot: readonly string[];
  /** In the snapshot, absent from the roster: an image being carried for nothing. */
  readonly staleInSnapshot: readonly string[];
}

export function compareToSnapshot(derived: readonly PreloadImage[], snapshot: Snapshot): Drift {
  const inSnapshot = new Set(snapshot.images.map((i) => i.reference));
  const inRoster = new Set(derived.map((i) => i.reference));
  return {
    missingFromSnapshot: derived
      .map((i) => i.reference)
      .filter((r) => !inSnapshot.has(r))
      .sort(stringCompare),
    staleInSnapshot: snapshot.images
      .map((i) => i.reference)
      .filter((r) => !inRoster.has(r))
      .sort(stringCompare),
  };
}

export function hasDrift(drift: Drift): boolean {
  return drift.missingFromSnapshot.length > 0 || drift.staleInSnapshot.length > 0;
}

// ---------------------------------------------------------------------------
// Registry coverage — the fact that makes this slice worth 1 GB
// ---------------------------------------------------------------------------

export interface HostCoverage {
  readonly host: string;
  readonly images: number;
  readonly bytes: number;
  /** `mirror.gcr.io` serves docker.io and nothing else. */
  readonly mirrored: boolean;
}

export function hostCoverage(snapshot: Snapshot): readonly HostCoverage[] {
  const byHost = new Map<string, { images: number; bytes: number }>();
  for (const image of snapshot.images) {
    const { host } = parseImageReference(image.reference);
    const entry = byHost.get(host) ?? { images: 0, bytes: 0 };
    entry.images++;
    entry.bytes += image.compressedBytes ?? 0;
    byHost.set(host, entry);
  }
  return [...byHost.entries()]
    .map(([host, e]) => ({ host, images: e.images, bytes: e.bytes, mirrored: host === MIRRORED_HOST }))
    .sort((a, b) => b.bytes - a.bytes || stringCompare(a.host, b.host));
}

/**
 * The registry hosts a preload-proving test must BLACKHOLE.
 *
 * This is the falsifier's input, and the reason it is derived rather than
 * typed: a test that blackholes a hand-written host list proves nothing about
 * an image that moved to a host nobody added to the list. Excludes the one
 * mirrored host, because a blackhole there would be testing the mirror rather
 * than the preload — and excludes nothing else.
 */
export function unmirroredHosts(snapshot: Snapshot): readonly string[] {
  return [
    ...new Set(snapshot.images.map((i) => parseImageReference(i.reference).host).filter((h) => h !== MIRRORED_HOST)),
  ].sort(stringCompare);
}

/**
 * EVERY DNS name a pull of this set could ask a resolver for.
 *
 * This is the falsifier's input, and it is deliberately NOT `unmirroredHosts`.
 * That distinction answers "why is this slice worth carrying"; this one answers
 * "what must be unreachable for the proof to mean anything", and the claim
 * under test is *no registry reachable* — which includes the mirrored one. Four
 * of the twenty-five images are on docker.io, and leaving it up makes those
 * four unjudgeable: a probe that succeeds because the image was PULLED looks
 * exactly like a probe that succeeds because the image was PRELOADED. MEASURED
 * 2026-09-25: the first run of the harness left docker.io reachable and
 * returned `UNDECIDED` for all four, which is the honest answer to a question
 * the setup made unanswerable.
 *
 * Docker Hub answers to three spellings and a client may use any of them, so
 * all three are blackholed. `parseImageReference` canonicalises to
 * `registry-1.docker.io`; a resolver is asked for whichever the client wrote.
 *
 * Safe for k3s itself: its own built-ins (`rancher/mirrored-pause`,
 * `mirrored-coredns-coredns`, `mirrored-metrics-server`, `klipper-*`) ship
 * INSIDE the k3s release image and are already in containerd before the agent
 * starts — confirmed by `ctr images ls` on a container booted with every
 * registry blackholed.
 */
export function blackholeHostnames(snapshot: Snapshot): readonly string[] {
  const hosts = new Set<string>();
  for (const image of snapshot.images) {
    const { host } = parseImageReference(image.reference);
    if (host === MIRRORED_HOST) {
      hosts.add("docker.io");
      hosts.add("index.docker.io");
      hosts.add("registry-1.docker.io");
      continue;
    }
    hosts.add(host);
  }
  return [...hosts].sort(stringCompare);
}

// ---------------------------------------------------------------------------
// The archive — pulled BY DIGEST, so what ships is what was verified
// ---------------------------------------------------------------------------

export interface ArchiveItem {
  readonly host: string;
  readonly repository: string;
  /** The TOP manifest reference — the tag or digest the chart itself wrote. */
  readonly topReference: string;
  /** The name containerd must know it by: the reference the pod spec carries. */
  readonly destinationName: string;
}

/**
 * What to fetch, and under what name.
 *
 * THE NAME IS THE LOAD-BEARING HALF, AND IT WAS MEASURED THE HARD WAY.
 * containerd resolves a pod's `image:` string against its own image store, so
 * an archive whose entries differ from the rendered reference is an archive the
 * kubelet ignores entirely — a preload that silently does nothing, which is the
 * exact failure class this whole effort exists to refuse.
 *
 * MEASURED 2026-09-25, k3s v1.35.7+k3s1 in Docker with quay.io blackholed to
 * 127.0.0.1: an archive built with `skopeo copy ... oci:<dir>:<ref>` carried a
 * PLAIN TAG correctly — kubelet logged "already present on machine" — and did
 * NOT carry a `repo:tag@sha256:...` reference, which went ImagePullBackOff on
 * `dial tcp 127.0.0.1:443`.
 *
 * The cause is exact, and worth writing down because it is invisible from the
 * tarball. An OCI-layout destination forces OCI media types, so skopeo REWRITES
 * an `application/vnd.docker.distribution.manifest.list.v2+json` index into an
 * OCI index — new bytes, new digest. The kubelet normalises `repo:tag@sha256:X`
 * to `repo@sha256:X` and asks containerd for content with digest X. X is the
 * INDEX digest; what the archive held was the rewritten index, or with
 * `--override-arch amd64` only the amd64 CHILD. Neither is X, so containerd
 * goes to the network. `--preserve-digests` does not rescue it: skopeo refuses
 * the conversion rather than performing it, so the index cannot be written at
 * all.
 *
 * That is FIVE of the twenty-five images — every cilium one, 389 MB, 38% of the
 * payload, and the single chart without which nothing else schedules. A preload
 * built the obvious way would have shipped, looked right, imported cleanly, and
 * left the CNI pulling from a registry on every first boot.
 *
 * So the archive is assembled BYTE-FOR-BYTE from the registry instead, by
 * `buildArchive` below: the index manifest is written exactly as served, which
 * preserves its digest by construction. Re-measured the same day against the
 * same blackhole: the digest-pinned pod reached `Succeeded`.
 */
/**
 * The name to put in the archive — the rendered reference, except when it has
 * no tag at all.
 *
 * MEASURED 2026-09-25, and it took down the whole archive rather than one
 * image. `local-storage.nix`'s helper pod names `busybox` bare, and k3s's
 * importer refuses it outright:
 *
 *     failed to import .../zeta-bootstrap-images.tar: failed to retag images:
 *     failed to parse tag for image busybox: can't cast reference.repository
 *     to NamedTagged
 *
 * k3s retags every entry as it imports, and a reference with no tag and no
 * digest is not a `NamedTagged`, so the retag pass errors and the import does
 * not complete. ONE untagged entry therefore costs all twenty-five — which is
 * why this normalisation is not cosmetic.
 *
 * The canonical form is what the kubelet will ask for anyway: CRI normalises a
 * pod's `image: busybox` to `docker.io/library/busybox:latest` before looking
 * it up, so naming the archive entry that way is naming it what the lookup
 * uses. Everything that already carries a tag or a digest is left VERBATIM,
 * because verbatim is what was measured to work and a normalisation applied
 * where it is not needed is a chance to be wrong.
 */
export function containerdImageName(reference: string): string {
  const parsed = parseImageReference(reference);
  const firstSegment = reference.includes("/") ? (reference.split("/")[0] ?? "") : "";
  const hasExplicitHost =
    firstSegment !== "" && (firstSegment.includes(".") || firstSegment.includes(":") || firstSegment === "localhost");
  // A reference that already names its registry is left VERBATIM. Verbatim is
  // what was measured to work for the five digest-pinned cilium references, and
  // a normalisation applied where it is not needed is a chance to be wrong.
  if (hasExplicitHost) return reference;

  const host = parsed.host === MIRRORED_HOST ? "docker.io" : parsed.host;
  // Split the bare name from whatever tag/digest suffix it carries, and keep
  // the suffix EXACTLY as written — a `repo:tag@sha256:...` must stay that way.
  const withoutDigest = reference.split("@")[0] ?? reference;
  const nameOnly = withoutDigest.replace(/:[^/]+$/, "");
  const suffix = reference.slice(nameOnly.length);
  const repository = nameOnly.includes("/") ? nameOnly : `library/${nameOnly}`;
  return `${host}/${repository}${suffix === "" ? ":latest" : suffix}`;
}

export function archivePlan(snapshot: Snapshot): {
  readonly plan: readonly ArchiveItem[];
  readonly unpinned: readonly string[];
} {
  const plan: ArchiveItem[] = [];
  const unpinned: string[] = [];
  for (const image of snapshot.images) {
    if (image.amd64Digest === null) {
      unpinned.push(image.reference);
      continue;
    }
    const { host, repository, reference } = parseImageReference(image.reference);
    plan.push({
      host,
      repository,
      // The TOP reference — tag or digest, whichever the chart wrote. NOT the
      // amd64 child: the child is what gets unpacked, the top is what gets
      // named, and conflating them is the defect described above.
      topReference: reference,
      destinationName: containerdImageName(image.reference),
    });
  }
  return { plan, unpinned };
}

// ---------------------------------------------------------------------------
// Byte-preserving OCI layout
// ---------------------------------------------------------------------------

/** Injected by the tests so `tar` is not required to exercise the plan. */
export type RunCommand = (cmd: readonly string[]) => { readonly status: number; readonly stderr: string };

const spawnRun: RunCommand = (cmd) => {
  const r = Bun.spawnSync(cmd as string[], { stdout: "pipe", stderr: "pipe" });
  return { status: r.exitCode ?? 1, stderr: r.stderr.toString() };
};

/** The media types a registry may answer a manifest request with. */
const MANIFEST_ACCEPT_TYPES: readonly string[] = [
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
];

function hexDigest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/**
 * A digest is a PATH COMPONENT here, so it is validated before it becomes one.
 *
 * Every digest written into the layout arrives from a registry response — a
 * manifest's `layers[].digest`, its `config.digest`, an index's child digest.
 * That is network data being used to build a filesystem path, which CodeQL
 * flags as `js/http-to-file-access` and is right to: a registry that answered
 * with `sha256:../../../etc/anything` would write outside the layout. The
 * registries this pulls from are not the adversary anybody expects, which is
 * exactly why the check is cheap to add and worth having.
 *
 * `^sha256:[0-9a-f]{64}$` admits nothing that contains a separator or a dot,
 * so the joined path cannot escape `blobs/sha256/`.
 */
export function assertContentAddress(digest: string): string {
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new Error(
      `refusing to use ${JSON.stringify(digest.slice(0, 120))} as a content address: ` +
        "it is not a bare sha256 digest, and it would be written to the filesystem as a path component.",
    );
  }
  return digest;
}

/**
 * The registry-host shape, as a NAMED predicate.
 *
 * The production guards are INLINE at each URL-building site, because that is
 * the only shape CodeQL's default taint barriers recognise (measured in this
 * PR: the same regex behind this function left the alert open). This export is
 * therefore not the guard -- it is the guard's DEFINITION, kept so the shape
 * has one readable home and so the falsifiers have something to call.
 *
 * The test file asserts the inline copies and this one are
 * the same literal, so the duplication cannot drift silently. A duplicated
 * constant with no drift check would be the defect this module is otherwise
 * about.
 *
 * Same reasoning as `assertContentAddress` one layer over: the host comes out
 * of a committed snapshot and is interpolated into a URL, so it is file data
 * steering an outbound request (`js/file-access-to-http`). The snapshot is
 * reviewed, which is an argument about process; this is the same argument made
 * at run time, where it also catches a typo.
 */
export function assertRegistryHost(host: string): string {
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?$/.test(host)) {
    throw new Error(`refusing to build a registry URL for ${JSON.stringify(host.slice(0, 120))}: not a hostname`);
  }
  return host;
}

/** The repository-path shape, as a named predicate. See assertRegistryHost for why. */
export function assertRepository(repository: string): string {
  if (!/^[a-z0-9]+([._-][a-z0-9]+)*(\/[a-z0-9]+([._-][a-z0-9]+)*)*$/.test(repository)) {
    throw new Error(
      `refusing to build a registry URL for repository ${JSON.stringify(repository.slice(0, 160))}: ` +
        "not a registry repository path",
    );
  }
  return repository;
}

/**
 * `<layout>/blobs/sha256/<digest>` — with the digest checked RIGHT HERE.
 *
 * The regex test is inline rather than delegated, and that is deliberate on two
 * counts. It is the shape `.github/codeql/codeql-config.yml` records as the one
 * that actually closes a first-party alert ("a guard in the code that CodeQL's
 * DEFAULT taint barriers already recognise — an allowlist membership test, a
 * regular-expression test"), and it is a real refusal at run time: a registry
 * answering `sha256:../../../etc/x` would otherwise write outside the layout.
 */
function blobFile(layout: string, digest: string): string {
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new Error(
      `refusing to use ${JSON.stringify(digest.slice(0, 120))} as a content address: ` +
        "it is not a bare sha256 digest, and it would be written to the filesystem as a path component.",
    );
  }
  return join(layout, "blobs", "sha256", digest.slice("sha256:".length));
}

/**
 * GET a blob, completing the same anonymous-pull token dance `fetchManifest`
 * does — and VERIFYING what came back against the digest that asked for it.
 *
 * The verification is not ceremony. The whole point of shipping these bytes on
 * a USB stick is that nobody re-checks them at first boot, so a blob that did
 * not match here would be a corrupt image nothing ever catches. Failing in CI
 * is the "verify EARLIER, not LESS" half of this feature.
 */
/**
 * THE CONTENT CHECK THE CodeQL DISMISSAL RESTS ON — refuse any bytes that do not
 * hash to the address that asked for them.
 *
 * -- READ THIS BEFORE CHANGING ANYTHING BELOW ----------------------------
 * `js/http-to-file-access` fires three times in this module: "Write to file
 * system depends on Untrusted DATA". THAT IS A TRUE DESCRIPTION OF THE FLOW.
 * Registry bytes are fetched and written to disk, because that is the entire
 * feature. There is no path guard that answers it — the path is separately
 * guarded and content-addressed, and the alert is about the CONTENT.
 *
 * Those three alerts were DISMISSED, and this function is the whole reason the
 * dismissal is defensible: the content is constrained rather than the
 * destination, which is a strictly stronger mitigation than any path check and
 * one CodeQL cannot model because it is semantic, not syntactic. Nothing is
 * written until it has hashed to the digest that requested it.
 *
 * -- WHAT WOULD MAKE THE DISMISSAL WRONG ---------------------------------
 * IF THIS VERIFICATION IS EVER REMOVED OR WEAKENED, THE DISMISSAL IS VOID AND
 * THE ALERTS MUST BE REINSTATED. Weakened includes: comparing a prefix,
 * catching and continuing past a mismatch, making the check conditional on a
 * flag, or writing the bytes anywhere before this function has returned them.
 * A dismissal typed into a GitHub UI is invisible to anyone reading the tree;
 * this comment is the version a future reader can check, and the falsifiers in
 * `bootstrap-image-preload.test.ts` §"the content check" are the version a
 * future BUILD can check. They assert REFUSAL, not acceptance: a blob whose
 * bytes do not hash to the requested digest must throw.
 *
 * Precedent and its bar: `no-binary-in-proof-lineage.md` records six Scorecard
 * alerts closed by DELETING the binaries rather than dismissing, and names that
 * the disposition to prefer "whenever it is reachable". Here it is not
 * reachable without a worse trade (the alternative moved a bearer token onto a
 * command line), so the fallback applies — and that rule's own sentence sets
 * what a dismissal then has to be: "a dismissal is a claim about the alert".
 * This is the claim, in writing, where it can be audited.
 */
export function verifyContentAddress(bytes: Uint8Array, digest: string, source: string): Uint8Array {
  const actual = hexDigest(bytes);
  if (actual !== digest) {
    throw new Error(
      `content from ${source} hashed to ${actual} but was requested as ${digest} — ` +
        "refusing it. Nothing is written to disk that did not hash to the address that asked for it.",
    );
  }
  return bytes;
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

export async function fetchBlob(
  host: string,
  repository: string,
  digest: string,
  tokens: Map<string, string>,
  // Injected ONLY by the falsifiers. `verifyContentAddress` is what the CodeQL
  // dismissal rests on, and a claim about a refusal that nothing exercises is
  // the defect class this whole work item is about — so the refusal is proven
  // end to end, with a registry that lies about what it is serving.
  fetchImpl: FetchLike = fetch,
): Promise<Uint8Array> {
  // INLINE, not behind a helper: `.github/codeql/codeql-config.yml` records that only a
  // guard CodeQL's DEFAULT taint barriers recognise closes a first-party alert, and its
  // own `guarded.ts` fixture tests the value AT THE SITE THAT USES IT. Delegating the same
  // regex to a named function left the alert open -- measured 2026-09-25, this PR.
  // It is also a real refusal: file data must not steer an outbound request to something
  // that is not a registry.
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?$/.test(host)) {
    throw new Error(`refusing to build a registry URL for ${JSON.stringify(host)}: not a hostname`);
  }
  if (!/^[a-z0-9]+([._-][a-z0-9]+)*(\/[a-z0-9]+([._-][a-z0-9]+)*)*$/.test(repository)) {
    throw new Error(`refusing to build a registry URL for ${JSON.stringify(repository)}: not a repository path`);
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new Error(`refusing to request ${JSON.stringify(digest)}: not a content address`);
  }
  const url = `https://${host}/v2/${repository}/blobs/${digest}`;
  const headers: Record<string, string> = { "User-Agent": "zeta-bootstrap-image-preload/1" };
  const cached = tokens.get(repository);
  if (cached !== undefined) headers.Authorization = `Bearer ${cached}`;
  let response = await fetchImpl(url, { headers });
  if (response.status === 401) {
    // Warm the token through the manifest path, which already knows every
    // registry's realm/service shape, then retry exactly once.
    await fetchManifest(`https://${host}/v2/${repository}/manifests/${digest}`, repository, tokens);
    const refreshed = tokens.get(repository);
    if (refreshed !== undefined) headers.Authorization = `Bearer ${refreshed}`;
    response = await fetchImpl(url, { headers });
  }
  if (!response.ok) throw new Error(`blob ${digest} HTTP ${String(response.status)}`);
  return verifyContentAddress(new Uint8Array(await response.arrayBuffer()), digest, `${host}/${repository}`);
}

/**
 * The `tar` argv to try, in order.
 *
 * GNU tar reads a `host:path` argument as a REMOTE archive, and a Windows
 * absolute path begins `C:` — so `tar -cf C:/out/x.tar` fails with
 * `Cannot connect to C: resolve failed`, MEASURED on this tree's own Windows
 * developer machine 2026-09-25. `--force-local` fixes it and is GNU-only, so
 * it cannot simply be added: BSD tar (the default on macOS) rejects the flag
 * and would break a platform that works today.
 *
 * Hence an ordered pair rather than a conditional on the platform string: try
 * the portable invocation, and fall back to the GNU one only when the portable
 * one failed. A platform check would be a guess about which tar is installed;
 * this is a measurement of which one answered.
 */
export function tarInvocations(outPath: string, layout: string): readonly (readonly string[])[] {
  return [
    ["tar", "-cf", outPath, "-C", layout, "."],
    ["tar", "--force-local", "-cf", outPath, "-C", layout, "."],
  ];
}

/** One image's manifests + blobs, written into an OCI layout with digests intact. */
async function stageImage(
  layout: string,
  item: ArchiveItem,
  tokens: Map<string, string>,
): Promise<{ readonly mediaType: string; readonly digest: string; readonly size: number }> {
  // INLINE, not behind a helper: `.github/codeql/codeql-config.yml` records that only a
  // guard CodeQL's DEFAULT taint barriers recognise closes a first-party alert, and its
  // own `guarded.ts` fixture tests the value AT THE SITE THAT USES IT. Delegating the same
  // regex to a named function left the alert open -- measured 2026-09-25, this PR.
  // It is also a real refusal: file data must not steer an outbound request to something
  // that is not a registry.
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?$/.test(item.host)) {
    throw new Error(`refusing to build a registry URL for ${JSON.stringify(item.host)}: not a hostname`);
  }
  if (!/^[a-z0-9]+([._-][a-z0-9]+)*(\/[a-z0-9]+([._-][a-z0-9]+)*)*$/.test(item.repository)) {
    throw new Error(`refusing to build a registry URL for ${JSON.stringify(item.repository)}: not a repository path`);
  }
  const base = `https://${item.host}/v2/${item.repository}/manifests/`;
  // The TAG or DIGEST is the last piece of the URL path, and it comes out of
  // the same committed snapshot the host and repository do. Guarding two of
  // three would be the partly-guarded fixture, which this repo pins as still
  // REPORTED on purpose.
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}$|^sha256:[0-9a-f]{64}$/.test(item.topReference)) {
    throw new Error(`refusing to request ${JSON.stringify(item.topReference)}: not a tag or a digest`);
  }
  const response = await fetchManifest(base + item.topReference, item.repository, tokens);
  if (!response.ok) throw new Error(`manifest HTTP ${String(response.status)}`);
  const mediaType = (response.headers.get("content-type") ?? "").split(";")[0] ?? "";
  if (!MANIFEST_ACCEPT_TYPES.includes(mediaType)) {
    throw new Error(`unexpected manifest media type "${mediaType}"`);
  }
  // THE BYTES AS SERVED. Re-serialising the parsed JSON here would change the
  // digest and re-introduce the defect this function exists to avoid.
  const topBytes = new Uint8Array(await response.arrayBuffer());
  const topDigest = hexDigest(topBytes);
  writeFileSync(blobFile(layout, topDigest), topBytes);

  const parsed = JSON.parse(new TextDecoder().decode(topBytes)) as {
    manifests?: readonly { digest?: string; platform?: { architecture?: string; os?: string } }[];
    config?: { digest?: string };
    layers?: readonly { digest?: string }[];
  };

  let child = parsed;
  if (Array.isArray(parsed.manifests)) {
    const amd64 = parsed.manifests.find((m) => m.platform?.architecture === "amd64" && m.platform.os === "linux");
    if (typeof amd64?.digest !== "string") throw new Error("no linux/amd64 entry in the index");
    // The TAG or DIGEST is the last piece of the URL path, and it comes out of
    // the same committed snapshot the host and repository do. Guarding two of
    // three would be the partly-guarded fixture, which this repo pins as still
    // REPORTED on purpose.
    if (!/^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}$|^sha256:[0-9a-f]{64}$/.test(amd64.digest)) {
      throw new Error(`refusing to request ${JSON.stringify(amd64.digest)}: not a tag or a digest`);
    }
    const childResponse = await fetchManifest(base + amd64.digest, item.repository, tokens);
    if (!childResponse.ok) throw new Error(`amd64 manifest HTTP ${String(childResponse.status)}`);
    const childBytes = new Uint8Array(await childResponse.arrayBuffer());
    const childDigest = hexDigest(childBytes);
    if (childDigest !== amd64.digest) {
      throw new Error(`amd64 manifest hashed to ${childDigest}, index said ${amd64.digest}`);
    }
    writeFileSync(blobFile(layout, childDigest), childBytes);
    child = JSON.parse(new TextDecoder().decode(childBytes)) as typeof parsed;
  }

  // ONLY the amd64 child's blobs are fetched, so an index's arm64 children stay
  // absent. That is deliberate and is what keeps the payload near 1 GB rather
  // than 2: containerd unpacks the platform it runs on and never touches the
  // others. The INDEX is still present under its own digest, which is the only
  // part the kubelet's by-digest resolve needs.
  for (const blob of [child.config, ...(child.layers ?? [])]) {
    const digest = blob?.digest;
    if (typeof digest !== "string") throw new Error("manifest carries a blob with no digest");
    writeFileSync(blobFile(layout, digest), await fetchBlob(item.host, item.repository, digest, tokens));
  }

  return { mediaType, digest: topDigest, size: topBytes.length };
}

/**
 * Fetch every planned image into one OCI layout and tar it.
 *
 * Not `skopeo` and not `docker save`, for two separately-measured reasons:
 * skopeo's OCI destination rewrites docker manifest lists and breaks the five
 * digest-pinned cilium references (see `archivePlan`), and `docker save`
 * re-materialises layers UNCOMPRESSED unless the daemon runs the containerd
 * image store, which would turn a ~1.0 GB payload into ~2.7 GB on the stick.
 * Fetching the registry's own bytes avoids both and needs no container tooling
 * at all — only `tar`, to pack a directory.
 */
export async function buildArchive(
  snapshot: Snapshot,
  outPath: string,
  run: RunCommand = spawnRun,
): Promise<{ readonly staged: number; readonly failures: readonly string[] }> {
  const { plan, unpinned } = archivePlan(snapshot);
  const failures = unpinned.map((r) => `${r}: no amd64 digest in the snapshot — run \`${REFRESH_COMMAND}\``);
  const layout = mkdtempSync(join(tmpdir(), "zeta-preload-oci-"));
  const tokens = new Map<string, string>();
  const entries: {
    mediaType: string;
    digest: string;
    size: number;
    annotations: Record<string, string>;
  }[] = [];
  let staged = 0;
  try {
    mkdirSync(join(layout, "blobs", "sha256"), { recursive: true });
    writeFileSync(join(layout, "oci-layout"), `${JSON.stringify({ imageLayoutVersion: "1.0.0" })}\n`, "utf8");
    for (const item of plan) {
      try {
        const descriptor = await stageImage(layout, item, tokens);
        entries.push({
          mediaType: descriptor.mediaType,
          digest: descriptor.digest,
          size: descriptor.size,
          // The name containerd will know it by. k3s logs exactly this string
          // as `Imported <name>`, which is how a mismatch is spotted on a boot.
          annotations: { "org.opencontainers.image.ref.name": item.destinationName },
        });
        staged++;
      } catch (e) {
        failures.push(`${item.destinationName}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    writeFileSync(
      join(layout, "index.json"),
      `${JSON.stringify({
        schemaVersion: 2,
        mediaType: "application/vnd.oci.image.index.v1+json",
        manifests: entries,
      })}\n`,
      "utf8",
    );
    mkdirSync(dirname(outPath), { recursive: true });
    const attempts = tarInvocations(outPath, layout);
    let packed = false;
    let lastError = "";
    for (const argv of attempts) {
      const tarred = run(argv);
      if (tarred.status === 0) {
        packed = true;
        break;
      }
      lastError = tarred.stderr.trim().slice(0, 300);
    }
    if (!packed) failures.push(`tar failed — ${lastError}`);
  } finally {
    rmSync(layout, { recursive: true, force: true });
  }
  return { staged, failures };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function gb(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

function mb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** The measured unpacked-to-compressed ratio `storage-profiles.json` established. */
export const UNPACKED_RATIO = 2.67;

export function formatReport(snapshot: Snapshot): string {
  const lines: string[] = [];
  lines.push(`=== Bootstrap image preload set (resolved ${snapshot.resolvedAt}) ===`);
  lines.push("");
  for (const image of snapshot.images) {
    const size = image.compressedBytes === null ? "  UNSIZED" : mb(image.compressedBytes).padStart(9);
    lines.push(`  ${size}  ${image.reference}`);
    lines.push(`             from: ${image.rosterAttrs.join(", ")}`);
  }
  lines.push("");
  lines.push(`  images:            ${String(snapshot.images.length)} (${String(snapshot.unsized)} unsized)`);
  lines.push(`  on the ISO:        ${gb(snapshot.totalCompressedBytes)} compressed`);
  lines.push(
    `  on the disk:       ${gb(snapshot.totalCompressedBytes * UNPACKED_RATIO)} estimated unpacked (x${String(UNPACKED_RATIO)})`,
  );
  lines.push("");
  lines.push("  registry coverage — why this slice:");
  for (const host of hostCoverage(snapshot)) {
    lines.push(
      `    ${host.host.padEnd(28)} ${String(host.images).padStart(3)} images  ${mb(host.bytes).padStart(9)}  ` +
        (host.mirrored ? "mirrored via mirror.gcr.io" : "UNMIRRORED"),
    );
  }
  lines.push("");
  lines.push("  THIS MAKES THE CLUSTER COME UP WITHOUT A REGISTRY.");
  lines.push("  It does NOT make the ArgoCD catalog converge offline — those images still pull.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function writeSnapshot(snapshot: Snapshot, repoRoot: string): void {
  writeFileSync(join(repoRoot, SNAPSHOT_PATH), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export async function main(argv: readonly string[], repoRoot: string = REPO_ROOT): Promise<number> {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      list: { type: "boolean" },
      refresh: { type: "boolean" },
      report: { type: "boolean" },
      verify: { type: "boolean" },
      "build-archive": { type: "boolean" },
      "blackhole-hosts": { type: "boolean" },
      out: { type: "string" },
    },
    strict: true,
  });

  if (values.refresh === true) {
    const { snapshot, renderFailures } = await buildSnapshot({ repoRoot });
    if (renderFailures.length > 0) {
      for (const failure of renderFailures) console.error(`  RENDER FAILED: ${failure}`);
      console.error(
        "refusing to write a snapshot with a hole in it — a chart that did not render is an image nobody preloads",
      );
      return 1;
    }
    writeSnapshot(snapshot, repoRoot);
    console.log(formatReport(snapshot));
    console.log(`\nwrote ${SNAPSHOT_PATH}`);
    return 0;
  }

  if (values.report === true) {
    console.log(formatReport(loadSnapshot(repoRoot)));
    return 0;
  }

  if (values["blackhole-hosts"] === true) {
    for (const host of blackholeHostnames(loadSnapshot(repoRoot))) console.log(host);
    return 0;
  }

  if (values.list === true) {
    for (const image of loadSnapshot(repoRoot).images) console.log(image.reference);
    return 0;
  }

  if (values.verify === true) {
    const snapshot = loadSnapshot(repoRoot);
    const tokens = new Map<string, string>();
    let moved = 0;
    for (const image of snapshot.images) {
      const pin = await resolveAmd64Digest(image.reference, tokens);
      if (pin.digest === null) {
        console.error(`  UNRESOLVABLE  ${image.reference} — ${pin.reason ?? "no reason reported"}`);
        moved++;
        continue;
      }
      if (pin.digest !== image.amd64Digest) {
        console.error(`  MOVED         ${image.reference}`);
        console.error(`                snapshot ${image.amd64Digest ?? "(none)"}`);
        console.error(`                registry ${pin.digest}`);
        moved++;
        continue;
      }
      console.log(`  ok            ${image.reference}`);
    }
    if (moved > 0) {
      console.error(
        `\n${String(moved)} of ${String(snapshot.images.length)} images no longer resolve to the pinned digest. ` +
          `Run \`${REFRESH_COMMAND}\` and review the diff — an image that moved under its tag is a supply-chain event, not a chore.`,
      );
      return 1;
    }
    console.log(`\nall ${String(snapshot.images.length)} images still resolve to their pinned digest`);
    return 0;
  }

  if (values["build-archive"] === true) {
    const out = values.out;
    if (out === undefined || out.trim() === "") {
      console.error("--build-archive needs --out <path>");
      return 2;
    }
    const snapshot = loadSnapshot(repoRoot);
    const outAbsolute = resolve(repoRoot, out);
    const { staged, failures } = await buildArchive(snapshot, outAbsolute);
    console.log(`staged ${String(staged)} of ${String(snapshot.images.length)} images into ${out}`);
    if (failures.length > 0) {
      for (const failure of failures) console.error(`  FAILED: ${failure}`);
      return 1;
    }
    if (!existsSync(outAbsolute)) {
      console.error(`tar reported success but ${out} does not exist`);
      return 1;
    }
    return 0;
  }

  console.error("usage: --list | --refresh | --report | --verify | --blackhole-hosts | --build-archive --out <path>");
  return 2;
}

if (import.meta.main) {
  process.exit(await main(Bun.argv.slice(2)));
}
