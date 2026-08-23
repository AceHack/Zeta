// Lane footprints — the MEASURED image facts a lane partition is priced against.
//
// WHY THIS EXISTS
// ---------------
// `full-ai-cluster/k8s/storage-profiles.json` prices CPU and memory per
// Application and says, in its own `$comment_resources`, that disk is the
// tighter constraint:
//
//   cohort         distinct images   compressed   on disk at x2.67
//   all 45                     120     28.77 GB          ~77 GB
//
// against ~14 GB of free runner SSD. That measurement was a one-off: three
// numbers in a prose comment, with no per-Application breakdown and nothing
// that re-derives them. A partition into independently-testable lanes needs the
// breakdown, because the question "does THIS lane fit" is per-lane, not global.
//
// This module produces that breakdown. It renders every Application the
// app-of-apps roster reaches, collects the container images each one renders,
// and asks each image's registry for its manifest — summing config + layer
// sizes, which is the COMPRESSED wire size. `lane-partition.ts` reads the
// result offline; nothing in CI runs this.
//
// COMPRESSED IS NOT WHAT LANDS ON THE DISK
// ----------------------------------------
// containerd stores layers UNCOMPRESSED. The catalogue measured the ratio by
// streaming and gunzipping four images (argocd v2.13.2 x2.69, loki 3.3.2 x3.21,
// kube-state-metrics v2.14.0 x3.39, cockroach v24.2.4 x2.49 — aggregate x2.67)
// and that aggregate is the multiplier recorded here. It is an ESTIMATE with a
// measured basis, not a measurement of each image, and it is carried as a named
// field rather than folded into the byte counts so a reader can see which half
// is which. A Go binary in a scratch image compresses very differently from a
// CUDA userspace, so per-image error is real; the four samples span x2.49-x3.39
// and 2.67 is the low end of that spread applied uniformly.
//
// UNKNOWN IS REFUSED, NEVER COUNTED AS ZERO
// -----------------------------------------
// Some images cannot be sized: private ghcr repositories (401), tags withdrawn
// upstream (404), registries that rate-limit anonymous manifest reads (429).
// Each is recorded with its HTTP status and its image reference, and a lane
// containing one is reported UNKNOWN rather than FITS — its measured bytes are
// a FLOOR. Counting an unsizable image as zero is how a lane that does not fit
// reads as one that does, which is the failure this whole exercise exists to
// avoid. 3 of 126 images are in that state today; they are named in the
// output, not summarised.
//
// THE MEASUREMENT IS ANONYMOUS ON PURPOSE — AND 401 IS NOT ABSENCE
// ----------------------------------------------------------------
// The Docker Registry v2 API answers 401 to an unauthenticated manifest read
// EVEN FOR A PUBLIC IMAGE. The caller is expected to walk the challenge, fetch
// a free anonymous pull token from the realm it names, and retry — which
// `fetchAuthed` does, and which `measure-lane-footprints.test.ts` now proves it
// does. It presents NO other credential: not `GITHUB_TOKEN`, not a docker
// config. That is deliberate. A tool that fell back on an ambient credential
// would produce a footprint that depends on WHO RAN IT — two people, two
// numbers, both looking like measurements — and "unmeasurable" would stop being
// a fact about the image.
//
// The cost of anonymity is that three realities collapse onto one status, and
// the reason string is written to keep them apart as far as it honestly can:
//
//   private repository        401, anonymous grant REFUSED
//   repository never existed   401, anonymous grant REFUSED   <- ghcr answers 401,
//                                                                not 404, so as to
//                                                                not leak which
//                                                                names exist
//   this tool never asked      401, no grant attempted        <- OURS, a defect
//
// The first two are genuinely indistinguishable from outside and are reported
// as one. The third is not, and `refusalReason` names it — because on
// 2026-08-23 two `lucent-financial-group` packages sat in this file as
// `manifest HTTP 401` AFTER being made public, and a bare status gave a reader
// no way to tell a stale row from a private one. (Live consequence, still true:
// `zeta-orleans-silo` and `hat-system-operator` are not private — the org
// publishes no such packages at all. Their references dangle.)
//
// `:latest` MOVES, AND THAT IS WHY `--check` IS NOT A GATE
// --------------------------------------------------------
// Several references in this tree are `:latest` against registries we push to.
// Two measurements minutes apart legitimately differ (zeta-portal read
// 43240320 then 43241230 on 2026-08-23 — a rebuild landed between them). A
// `--check` wired into CI would go red for that. See the section above.
//
// `--check` IS A MAINTAINER TOOL AND MUST NOT BECOME A GATE
// ---------------------------------------------------------
// It re-measures and diffs, which means its verdict depends on 129 third-party
// registries being reachable and not rate-limiting at that moment. A transient
// 429 turns a size into `null` and the diff goes red for a reason that has
// nothing to do with the tree. Wiring that into CI would manufacture exactly
// the noise that teaches people to ignore a red gate. What IS a gate is
// `lane-partition.ts`, which reads the checked-in result offline and REFUSES
// when the roster and the footprints disagree — that catches the drift this
// file exists to prevent, without depending on anyone else's uptime.
//
// USAGE
//   bun src/Core.TypeScript/cluster/measure-lane-footprints.ts            # write
//   bun src/Core.TypeScript/cluster/measure-lane-footprints.ts --check    # diff only
//
// Needs `helm` on PATH and network reach to every registry in the tree.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { discoverApplications, renderApplication } from "./rendered-storage-claims.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const FOOTPRINTS_PATH = "full-ai-cluster/k8s/lane-footprints.json";

/**
 * containerd stores layers uncompressed; registries report them compressed.
 * Sourced from storage-profiles.json `$comment_resources`, which measured it
 * over four images. See the header — this is an estimate with a measured basis.
 */
export const COMPRESSION_RATIO = 2.67;

export interface ImageSize {
  /** Sum of config.size + every layer.size, in bytes, as the registry reports it. */
  readonly compressedBytes: number | null;
  /** Present exactly when `compressedBytes` is null. The tool's own status, never paraphrased. */
  readonly unmeasurableReason?: string;
}

/**
 * What happened when the registry demanded a bearer token.
 *
 * Recorded, and carried into the refusal string, because the failure this file
 * exists to prevent has a mirror image: a 401 that was NEVER CHALLENGED is a
 * defect in this tool, and a 401 that survived a REFUSED anonymous grant is a
 * fact about the repository. Both read "HTTP 401" at the wire and they are not
 * the same finding. Without this the artifact cannot tell you which it is, and
 * on 2026-08-23 that is exactly what happened: two ghcr packages were recorded
 * `manifest HTTP 401`, were made public, and the checked-in row went on saying
 * 401 with nothing in it to show whether the tool had even asked.
 */
export type AnonymousGrant =
  /** The registry served the manifest without asking for anything. */
  | "not-required"
  /** It asked, we fetched a free anonymous pull token, and presented it. */
  | "granted"
  /** It asked, and then refused to issue an anonymous pull token. */
  | "refused"
  /** It answered 401 with no parseable `WWW-Authenticate` challenge to walk. */
  | "no-challenge";

/**
 * The one network seam.
 *
 * Injected rather than reached for, so the token dance has a falsifier: before
 * this existed nothing could exercise `fetchAuthed` without 129 live registries,
 * which is why the handshake shipped for months with no test able to catch its
 * removal. Defaults to the global `fetch`; `measure-lane-footprints.test.ts`
 * passes a GHCR-shaped stub.
 */
export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

export interface LaneFootprints {
  readonly measuredOn: string;
  readonly compressionRatio: number;
  /** appId -> rendered container images, sorted, deduplicated. */
  readonly imagesByApp: Readonly<Record<string, readonly string[]>>;
  /** image reference -> its size, or the refusal. */
  readonly imageSizes: Readonly<Record<string, ImageSize>>;
  /** Applications that could not be rendered at all. Named, never skipped. */
  readonly unrenderable: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------- registry ---

const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

export interface ParsedRef {
  readonly registry: string;
  readonly repository: string;
  readonly reference: string;
}

/**
 * Split an image reference the way the OCI distribution spec does.
 *
 * The two traps, both live in this tree: a bare `nats:2.10.23-alpine` is
 * `docker.io/library/nats`, and a `host:port/repo` prefix must not be mistaken
 * for a `repo:tag` — which is why the host test is "contains a dot or a colon",
 * the rule the Docker CLI itself uses.
 */
export function parseImageRef(ref: string): ParsedRef {
  let rest = ref;
  let digest = "";
  const at = rest.indexOf("@");
  if (at >= 0) {
    digest = rest.slice(at + 1);
    rest = rest.slice(0, at);
  }
  const slash = rest.indexOf("/");
  const head = slash >= 0 ? rest.slice(0, slash) : "";
  const headIsHost = head.includes(".") || head.includes(":") || head === "localhost";
  const host = headIsHost ? head : "docker.io";
  let path = headIsHost ? rest.slice(slash + 1) : rest;
  let tag = "latest";
  const colon = path.lastIndexOf(":");
  if (colon > path.lastIndexOf("/")) {
    tag = path.slice(colon + 1);
    path = path.slice(0, colon);
  }
  if (host === "docker.io" && !path.includes("/")) path = `library/${path}`;
  return {
    registry: host === "docker.io" ? "registry-1.docker.io" : host,
    repository: path,
    reference: digest !== "" ? digest : tag,
  };
}

const tokenCache = new Map<string, string>();

interface AuthedResponse {
  readonly response: Response;
  readonly grant: AnonymousGrant;
}

async function fetchAuthed(
  url: string,
  accept: string,
  cacheKey: string,
  doFetch: FetchLike,
  tokens: Map<string, string>,
): Promise<AuthedResponse> {
  const cached = tokens.get(cacheKey);
  const headers: Record<string, string> = { Accept: accept };
  if (cached !== undefined) headers.Authorization = `Bearer ${cached}`;
  const first = await doFetch(url, { headers });
  if (first.status !== 401) return { response: first, grant: cached === undefined ? "not-required" : "granted" };

  // Walk the WWW-Authenticate challenge. Anonymous pull tokens only — this tool
  // never presents a credential, so a private repository stays UNKNOWN rather
  // than becoming a number that depends on who ran it.
  const challenge = first.headers.get("www-authenticate") ?? "";
  // Deliberately NOT `/Bearer\s+(.*)/`: that shape backtracks, and the input is
  // a header from a remote registry. A prefix test plus a bounded key="value"
  // scan gives the same parse with no super-linear path.
  const marker = "bearer ";
  const at = challenge.toLowerCase().indexOf(marker);
  if (at < 0) return { response: first, grant: "no-challenge" };
  const params = new Map<string, string>();
  // Bounded quantifiers, not `\w+` / `[^"]*`: a registry-supplied header is
  // remote input, and an unbounded scan over it is a denial-of-service surface
  // for a tool that runs against 129 registries.
  for (const kv of challenge.slice(at + marker.length).matchAll(/(\w{1,64})="([^"]{0,4096})"/g)) {
    const key = kv[1];
    const value = kv[2];
    if (key !== undefined && value !== undefined) params.set(key, value);
  }
  const realm = params.get("realm");
  if (realm === undefined) return { response: first, grant: "no-challenge" };
  const tokenUrl = new URL(realm);
  const service = params.get("service");
  const scope = params.get("scope");
  if (service !== undefined) tokenUrl.searchParams.set("service", service);
  if (scope !== undefined) tokenUrl.searchParams.set("scope", scope);
  const tokenRes = await doFetch(tokenUrl.toString());
  if (!tokenRes.ok) return { response: first, grant: "refused" };
  const body = (await tokenRes.json()) as { token?: string; access_token?: string };
  const token = body.token ?? body.access_token;
  // ghcr.io answers a denied anonymous grant with HTTP 200 and an `errors` body,
  // not a non-2xx — so `tokenRes.ok` alone does NOT mean a token arrived.
  if (token === undefined || token === "") return { response: first, grant: "refused" };
  tokens.set(cacheKey, token);
  return {
    response: await doFetch(url, { headers: { Accept: accept, Authorization: `Bearer ${token}` } }),
    grant: "granted",
  };
}

/**
 * The refusal string, carrying WHY the status is what it is.
 *
 * A bare `manifest HTTP 401` is the shape that let a stale verdict stand: it is
 * equally consistent with "private", "does not exist", and "this tool never
 * asked for a token". The first two a registry can genuinely not distinguish
 * for us — ghcr.io answers 401 for an unknown repository on purpose, so it does
 * not leak which names exist — but the third is ours, and naming it is what
 * makes a regression to a bare-401 read visible in the checked-in artifact
 * instead of only in a test.
 */
export function refusalReason(stage: string, status: number, grant: AnonymousGrant): string {
  const base = `${stage} HTTP ${String(status)}`;
  if (status !== 401) return base;
  if (grant === "refused") {
    return (
      `${base}; the registry REFUSED an anonymous pull token — the repository is private or does not exist, ` +
      `and a registry that answers 401 for an unknown repository cannot distinguish the two`
    );
  }
  if (grant === "no-challenge") return `${base}; no parseable WWW-Authenticate challenge to walk`;
  return `${base} WITH an anonymous pull token — the grant succeeded and the manifest was still refused`;
}

/**
 * Compressed wire size of `linux/amd64` for one image reference.
 *
 * Multi-platform indexes are resolved to the amd64 child before summing: an
 * index's own size is a few hundred bytes and summing it would price nothing.
 * amd64 is hardcoded because that is what a GitHub-hosted `ubuntu-24.04` runner
 * is; a lane measured on arm64 would be pricing a different set of layers, and
 * "no linux/amd64" is therefore a refusal and not a fallback.
 */
export async function measureImage(
  ref: string,
  deps: { readonly fetch?: FetchLike; readonly tokens?: Map<string, string> } = {},
): Promise<ImageSize> {
  const doFetch = deps.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const tokens = deps.tokens ?? tokenCache;
  const { registry, repository, reference } = parseImageRef(ref);
  const cacheKey = `${registry}/${repository}`;
  const base = `https://${registry}/v2/${repository}`;
  let res = await fetchAuthed(
    `${base}/manifests/${encodeURIComponent(reference)}`,
    MANIFEST_ACCEPT,
    cacheKey,
    doFetch,
    tokens,
  );
  if (!res.response.ok) {
    return { compressedBytes: null, unmeasurableReason: refusalReason("manifest", res.response.status, res.grant) };
  }
  let doc = (await res.response.json()) as {
    manifests?: { digest: string; platform?: { os?: string; architecture?: string } }[];
    layers?: { size?: number }[];
    config?: { size?: number };
  };
  if (Array.isArray(doc.manifests)) {
    const amd64 = doc.manifests.find((m) => m.platform?.os === "linux" && m.platform.architecture === "amd64");
    if (amd64 === undefined) return { compressedBytes: null, unmeasurableReason: "index has no linux/amd64" };
    res = await fetchAuthed(`${base}/manifests/${amd64.digest}`, MANIFEST_ACCEPT, cacheKey, doFetch, tokens);
    if (!res.response.ok) {
      return {
        compressedBytes: null,
        unmeasurableReason: refusalReason("child manifest", res.response.status, res.grant),
      };
    }
    doc = (await res.response.json()) as typeof doc;
  }
  if (!Array.isArray(doc.layers)) return { compressedBytes: null, unmeasurableReason: "manifest declares no layers" };
  let total = doc.config?.size ?? 0;
  for (const layer of doc.layers) total += layer.size ?? 0;
  return { compressedBytes: total };
}

// ------------------------------------------------------------------ render ---

/**
 * Every `image:` string anywhere in a rendered document.
 *
 * Deliberately structural rather than a regex over the YAML text: charts put
 * images under `spec.template.spec.containers[].image`, under
 * `initContainers[]`, inside CRD spec blocks a CRD-aware walk would miss, and
 * inside ConfigMap values. The key name is what identifies them, at any depth.
 * A ConfigMap holding the literal key `image` would be a false positive; it
 * costs an over-count, which is the safe direction for a capacity bound.
 */
export function collectImages(value: unknown, sink = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectImages(item, sink);
    return sink;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "image" && typeof child === "string" && child.trim() !== "") sink.add(child.trim());
      else collectImages(child, sink);
    }
  }
  return sink;
}

export async function measureAll(repoRoot = REPO_ROOT): Promise<LaneFootprints> {
  const apps = discoverApplications(repoRoot);
  const imagesByApp: Record<string, readonly string[]> = {};
  const unrenderable: Record<string, string> = {};
  for (const app of apps) {
    const rendered = renderApplication(app, { repoRoot });
    if (!rendered.ok) {
      unrenderable[app.appId] = rendered.reason;
      imagesByApp[app.appId] = [];
      continue;
    }
    const sink = new Set<string>();
    for (const doc of rendered.documents) collectImages(doc, sink);
    imagesByApp[app.appId] = [...sink].sort();
  }
  const all = [...new Set(Object.values(imagesByApp).flat())].sort();
  const imageSizes: Record<string, ImageSize> = {};
  for (const ref of all) {
    try {
      imageSizes[ref] = await measureImage(ref);
    } catch (err) {
      imageSizes[ref] = { compressedBytes: null, unmeasurableReason: `fetch threw: ${String(err).slice(0, 120)}` };
    }
  }
  return {
    measuredOn: new Date().toISOString().slice(0, 10),
    compressionRatio: COMPRESSION_RATIO,
    imagesByApp,
    imageSizes,
    unrenderable,
  };
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const target = resolve(REPO_ROOT, FOOTPRINTS_PATH);
  const measured = await measureAll();
  const serialized = `${JSON.stringify(measured, null, 2)}\n`;
  const known = Object.values(measured.imageSizes).filter((s) => s.compressedBytes !== null).length;
  const total = Object.keys(measured.imageSizes).length;
  console.log(
    `measured ${String(known)}/${String(total)} images across ${String(Object.keys(measured.imagesByApp).length)} applications`,
  );
  for (const [ref, size] of Object.entries(measured.imageSizes)) {
    if (size.compressedBytes === null)
      console.log(`  UNMEASURABLE ${ref} — ${size.unmeasurableReason ?? "(no reason recorded)"}`);
  }
  if (check) {
    const onDisk = readFileSync(target, "utf8");
    // measuredOn moves on every run and is not a fact about the tree.
    const strip = (s: string): string => s.replace(/"measuredOn": "[^"]*"/, '"measuredOn": "-"');
    if (strip(onDisk) !== strip(serialized)) {
      console.error(`${FOOTPRINTS_PATH} is STALE against a fresh measurement.`);
      process.exit(1);
    }
    console.log(`${FOOTPRINTS_PATH} matches a fresh measurement.`);
    process.exit(0);
  }
  writeFileSync(target, serialized);
  console.log(`wrote ${FOOTPRINTS_PATH}`);
}
