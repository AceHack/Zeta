#!/usr/bin/env bun
// src/Core.TypeScript/cluster/registry-mirror-coverage.ts
//
// HOW MUCH OF THE FIRST-BOOT DOCKER HUB PULL DOES mirror.gcr.io ACTUALLY
// COVER? — WP9 (081M33STPKN087G0R0004B5CAK).
//
// -- REPORT-ONLY, NOT A GATE -------------------------------------------
// `nixos/tests/k3s-registry-mirrors-eval-test.nix` (the CI-gated check) proves
// the MIRROR IS CONFIGURED — that registries.yaml exists, names docker.io,
// and does not disable the upstream fallback. It cannot and does not ask
// whether mirror.gcr.io actually SERVES the images this cluster pulls: that is
// a live network measurement against a cache Google owns and periodically
// evicts ("mirror.gcr.io ... periodically removes images that are no longer
// requested" — https://docs.cloud.google.com/artifact-registry/docs/pull-cached-dockerhub-images),
// so its answer is a snapshot with a date, never a pass/fail a PR should be
// blocked on. This script is that snapshot. Nothing in gate.yml calls it.
//
// -- ONE SOURCE FOR THE MIRROR LIST --------------------------------------
// Reads `full-ai-cluster/k8s/registry-mirrors.json` — the SAME file
// `nixos/modules/k3s-registry-mirrors.nix` renders into
// /etc/rancher/k3s/registries.yaml — so this measurement is always against
// the mirror actually configured on nodes, not a hardcoded assumption.
//
// -- ONE SOURCE FOR THE IMAGE LIST, WITH A DOCUMENTED FALLBACK -----------
// Reads `full-ai-cluster/k8s/image-resolvability.json`, the committed
// snapshot `src/Core.TypeScript/cluster/image-resolvability.ts --refresh`
// writes (added by PR #17475; may not be on `main` yet at the time this
// script first lands — see that PR's own header for why it is not
// re-implemented here rather than duplicated). Filters to `isDockerHub`
// entries, which is exactly the WP9 problem statement's "51 [50, measured
// 2026-09-22] are from Docker Hub". If that file is absent, this script says
// so and exits 0 (report-only — a missing snapshot is not a coverage
// failure, it is a "run the other tool first" instruction) rather than
// re-rendering the whole catalog with helm, which would duplicate
// `image-resolvability.ts`'s own render pipeline for a second time in this
// tree — exactly the "not a fourth scanner" discipline that file's own
// header states.
//
// -- WHY A BARE HEAD IS SOUND HERE ---------------------------------------
// mirror.gcr.io serves public Docker Hub content with NO authentication —
// confirmed live 2026-09-22 (`curl -I https://mirror.gcr.io/v2/library/alpine/manifests/latest`
// returns 200 with no WWW-Authenticate challenge). That is different from
// docker.io's own registry, which requires a bearer token even for public
// anonymous pulls — this script only ever talks to the mirror, so no token
// flow is needed.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const MIRROR_CONFIG_PATH = join(REPO_ROOT, "full-ai-cluster/k8s/registry-mirrors.json");
const IMAGE_RESOLVABILITY_PATH = join(REPO_ROOT, "full-ai-cluster/k8s/image-resolvability.json");

const PROBE_TIMEOUT_MS = 15_000;

interface MirrorConfig {
  readonly mirrors: Readonly<Record<string, { readonly endpoint: readonly string[] }>>;
}

interface ImageResolvabilityEntry {
  readonly reference: string;
  readonly isDockerHub: boolean;
}

interface ImageResolvabilitySnapshot {
  readonly entries: readonly ImageResolvabilityEntry[];
}

interface ParsedDockerHubRef {
  readonly reference: string;
  readonly repo: string;
  readonly tag: string;
}

/** `registry-1.docker.io/library/alpine:latest` -> { repo: "library/alpine", tag: "latest" }. */
function parseDockerHubReference(reference: string): ParsedDockerHubRef {
  const noHost = reference.replace(/^registry-1\.docker\.io\//, "");
  const atIndex = noHost.lastIndexOf("@");
  if (atIndex !== -1) {
    return { reference, repo: noHost.slice(0, atIndex), tag: noHost.slice(atIndex + 1) };
  }
  const colonIndex = noHost.lastIndexOf(":");
  if (colonIndex === -1) {
    return { reference, repo: noHost, tag: "latest" };
  }
  return { reference, repo: noHost.slice(0, colonIndex), tag: noHost.slice(colonIndex + 1) };
}

// -- ALLOW-LIST VALIDATION, before any of this reaches `fetch` --------------
//
// `registry-mirrors.json` and `image-resolvability.json` are both committed,
// repo-local files, but CodeQL (js/request-forgery, "File data in outbound
// network request") does not know that, and its concern is real regardless
// of provenance: nothing between `JSON.parse` and the `fetch` call was
// checking that a `repo`/`tag` (from a parsed reference) or a mirror
// `endpoint` (from the mirror config) look like the things they are supposed
// to be. A corrupted or maliciously-edited JSON file could otherwise steer
// this script's outbound HEAD request at an arbitrary host or path — an SSRF
// shape, not merely a lint nit. Every component that reaches the request URL
// is now checked against the grammar the OCI distribution spec actually
// defines for it (https://github.com/opencontainers/distribution-spec) before
// it is used; anything that does not match is refused, not fetched.
const OCI_NAME_COMPONENT = "[a-z0-9]+(?:[._-]+[a-z0-9]+)*";
const REPO_PATTERN = new RegExp(`^${OCI_NAME_COMPONENT}(?:\\/${OCI_NAME_COMPONENT})*$`);
const TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const DIGEST_PATTERN = /^[A-Za-z0-9]+:[A-Fa-f0-9]{32,}$/;
/** A bare `https://host[:port]` — no path, no query, no userinfo, no IP-literal tricks. */
const MIRROR_BASE_URL_PATTERN =
  /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::[0-9]{1,5})?$/;

function isValidRepo(repo: string): boolean {
  return REPO_PATTERN.test(repo);
}

function isValidTagOrDigest(tag: string): boolean {
  return TAG_PATTERN.test(tag) || DIGEST_PATTERN.test(tag);
}

function isValidMirrorBaseUrl(url: string): boolean {
  return MIRROR_BASE_URL_PATTERN.test(url);
}

// The SECOND, HOST-LEVEL barrier: a hardcoded allowlist of hostnames this
// script is willing to send a request to, checked against a `URL` object's
// `.hostname` AFTER parsing — the shape CodeQL's js/request-forgery query
// models as a sanitizing "URL whitelist check"
// (https://codeql.github.com/codeql-query-help/javascript/js-request-forgery/,
// "Validate the URL against a list of trusted values"). `mirrorBaseUrl` is
// still read from `registry-mirrors.json` (the single-source discipline), but
// it is no longer trusted merely for having come from that file: it must ALSO
// name a host this script already knows about. A mirror added to the JSON
// without a matching entry here is refused, loudly, rather than silently
// trusted.
const KNOWN_SAFE_MIRROR_HOSTNAMES: ReadonlySet<string> = new Set(["mirror.gcr.io"]);

const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.docker.distribution.manifest.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
].join(",");

/**
 * Build the manifest-HEAD request URL, or refuse. Three independent
 * barriers, all required before a `URL` is returned:
 *
 *   1. `repo`/`tag` must match the OCI distribution-spec grammar (the
 *      charset barrier — refuses anything that isn't a legal image
 *      reference to begin with).
 *   2. Each already-validated segment is ALSO passed through
 *      `encodeURIComponent` before it is placed in the path (repo's `/`
 *      separators are preserved by encoding segment-by-segment, never the
 *      whole string) — belt-and-suspenders against the path grammar having a
 *      gap, since charset validation and percent-encoding guard against
 *      overlapping but not identical failure modes.
 *   3. The parsed URL's `.hostname` must be in the hardcoded
 *      `KNOWN_SAFE_MIRROR_HOSTNAMES` allowlist (the host barrier — a fixed
 *      hostname, not merely "whatever registry-mirrors.json said").
 *
 * A `URL` object — not a template-literal string — is what `probeMirror`
 * actually fetches, which is the CodeQL-recognized shape for "this value was
 * validated as a URL, not merely as a string that looks like one".
 */
function buildManifestUrl(mirrorBaseUrl: string, ref: ParsedDockerHubRef): URL | undefined {
  if (!isValidRepo(ref.repo) || !isValidTagOrDigest(ref.tag)) {
    return undefined;
  }
  const encodedRepo = ref.repo.split("/").map(encodeURIComponent).join("/");
  const encodedTag = encodeURIComponent(ref.tag);
  let url: URL;
  try {
    url = new URL(`/v2/${encodedRepo}/manifests/${encodedTag}`, mirrorBaseUrl);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || !KNOWN_SAFE_MIRROR_HOSTNAMES.has(url.hostname)) {
    return undefined;
  }
  return url;
}

async function probeMirror(mirrorBaseUrl: string, ref: ParsedDockerHubRef): Promise<number | "error" | "invalid"> {
  const url = buildManifestUrl(mirrorBaseUrl, ref);
  if (url === undefined) {
    return "invalid";
  }
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { Accept: MANIFEST_ACCEPT },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return res.status;
  } catch {
    return "error";
  }
}

interface CoverageRow extends ParsedDockerHubRef {
  readonly status: number | "error" | "invalid";
  readonly hit: boolean;
}

/**
 * Read a file, distinguishing "does not exist" from every other failure — no
 * `existsSync` check-then-use (CWE-367: the path can be created, deleted, or
 * replaced between the check and the read, so a prior `existsSync` answer is
 * already stale when the read runs). One syscall, one answer, no window.
 */
function tryReadFileSync(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}

async function main(): Promise<void> {
  const mirrorConfigText = tryReadFileSync(MIRROR_CONFIG_PATH);
  if (mirrorConfigText === undefined) {
    console.error(`registry-mirror-coverage: missing ${MIRROR_CONFIG_PATH}`);
    process.exitCode = 1;
    return;
  }
  const mirrorConfig = JSON.parse(mirrorConfigText) as MirrorConfig;
  const dockerIoMirror = mirrorConfig.mirrors["docker.io"];
  if (!dockerIoMirror || dockerIoMirror.endpoint.length === 0) {
    console.error("registry-mirror-coverage: registry-mirrors.json has no docker.io mirror configured");
    process.exitCode = 1;
    return;
  }
  const mirrorBaseUrl = dockerIoMirror.endpoint[0]!;
  if (!isValidMirrorBaseUrl(mirrorBaseUrl)) {
    console.error(
      `registry-mirror-coverage: registry-mirrors.json's docker.io endpoint "${mirrorBaseUrl}" is not a bare ` +
        "https://host[:port] — refusing to build a request URL from it.",
    );
    process.exitCode = 1;
    return;
  }
  // The same hostname allowlist buildManifestUrl() enforces per-request,
  // checked once up front so an unrecognized mirror added to the JSON fails
  // loudly here rather than silently reporting every entry as a miss.
  if (!KNOWN_SAFE_MIRROR_HOSTNAMES.has(new URL(mirrorBaseUrl).hostname)) {
    console.error(
      `registry-mirror-coverage: "${mirrorBaseUrl}" is not in this script's hardcoded mirror allowlist ` +
        `(${[...KNOWN_SAFE_MIRROR_HOSTNAMES].join(", ")}) — add it to KNOWN_SAFE_MIRROR_HOSTNAMES first.`,
    );
    process.exitCode = 1;
    return;
  }

  const imageResolvabilityText = tryReadFileSync(IMAGE_RESOLVABILITY_PATH);
  if (imageResolvabilityText === undefined) {
    console.log(
      "registry-mirror-coverage: no full-ai-cluster/k8s/image-resolvability.json snapshot found " +
        "(the tool that writes it — src/Core.TypeScript/cluster/image-resolvability.ts, PR #17475 " +
        "— may not be merged yet). Run `bun src/Core.TypeScript/cluster/image-resolvability.ts " +
        "--refresh` first, then re-run this script. Nothing to measure; exiting 0 (report-only).",
    );
    return;
  }
  const snapshot = JSON.parse(imageResolvabilityText) as ImageResolvabilitySnapshot;
  const dockerHubEntries = snapshot.entries.filter((e) => e.isDockerHub);

  console.log(
    `registry-mirror-coverage: probing ${dockerHubEntries.length} Docker Hub image(s) against ` +
      `${mirrorBaseUrl} (from registry-mirrors.json)`,
  );

  const rows: CoverageRow[] = [];
  for (const entry of dockerHubEntries) {
    const ref = parseDockerHubReference(entry.reference);
    const status = await probeMirror(mirrorBaseUrl, ref);
    const hit = status === 200;
    rows.push({ ...ref, status, hit });
    console.log(`  ${hit ? "HIT " : "MISS"} ${status.toString().padStart(5)}  ${ref.reference}`);
  }

  const hits = rows.filter((r) => r.hit);
  const misses = rows.filter((r) => !r.hit);

  console.log("");
  console.log(
    `registry-mirror-coverage: ${hits.length}/${rows.length} Docker Hub images hit ${mirrorBaseUrl} ` +
      `(${misses.length} miss${misses.length === 1 ? "" : "es"} fall through to Docker Hub itself — ` +
      "the default-endpoint fallback this module deliberately leaves enabled).",
  );
  if (misses.length > 0) {
    console.log("misses:");
    for (const m of misses) {
      console.log(`  ${m.reference} (status ${m.status})`);
    }
  }
}

if (import.meta.main) {
  await main();
}

export {
  parseDockerHubReference,
  isValidRepo,
  isValidTagOrDigest,
  isValidMirrorBaseUrl,
  buildManifestUrl,
  KNOWN_SAFE_MIRROR_HOSTNAMES,
};
