// Image footprint — which Applications the runner's disk is actually spent on.
//
// WHY THIS EXISTS
// ---------------
// `storage-profiles.json` §"DISK IS THE TIGHTER CONSTRAINT, AND IT IS NOT PVCs"
// records the measurement that made this the live question: 120 distinct images
// across 45 Applications, 28.77 GB compressed, ~77 GB unpacked at the measured
// x2.67 ratio, against a runner that has ~14 GB free. It records three COHORT
// TOTALS and no per-app breakdown, so the number everyone quotes ("77 GB") could
// not be acted on: nothing said which Applications carried it.
//
// It matters because the answer is extremely concentrated, and concentration
// changes the decision. A footprint spread evenly over 45 apps can only be fixed
// by running fewer of them; a footprint where five apps are 84% of the bytes and
// four of those five are ALREADY excluded from the dev lane is a different
// problem with a different answer.
//
// WHAT IS MEASURED, AND WHAT IS ESTIMATED
// ---------------------------------------
// MEASURED: every image reference is read out of the chart's own `helm template`
// output at its pinned targetRevision (never off a values file in isolation),
// and its size is the sum of `config.size + layers[].size` from the registry's
// linux/amd64 manifest. Those are the compressed bytes the registry serves.
//
// ESTIMATED: what lands on the disk. containerd stores layers UNPACKED, so the
// on-disk figure is the compressed sum times a ratio, and the ratio here is the
// x2.67 aggregate that `storage-profiles.json` measured by streaming and
// gunzipping four real images from this tree. It is a good ratio and it is still
// a ratio: a mostly-binary image compresses differently from a mostly-text one,
// so a per-app on-disk figure carries that error and is labelled `estimated`
// everywhere it is printed.
//
// AN IMAGE THAT COULD NOT BE SIZED IS NOT ZERO
// --------------------------------------------
// Private `ghcr.io` repositories (401), tags withdrawn from Docker Hub (404) and
// rate-limited registries (429) all produce NO number. Every total therefore
// carries an `unsized` count beside it, and an app whose images are entirely
// unsized reports 0.00 GB with `unsized: n` rather than looking small. The
// bitnami 404s are the interesting class: those tags are gone from Docker Hub, so
// they are not merely unmeasured here, they would not pull on a cluster either.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { discoverExpectedApplications } from "./argocd-health-test.ts";
import { applicationDirs, devLaneAppliedDirs, envelopeBudget, loadResourceCatalogue } from "./storage-profiles.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const DEFAULT_MEASUREMENT_PATH = "src/Core.TypeScript/cluster/image-footprint.measured.json";

// ---------------------------------------------------------------------------
// Image references out of a rendered chart
// ---------------------------------------------------------------------------

/** Ordinal string order — the repo default, and stable across locales. */
function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Every `image:` string anywhere in a rendered document tree.
 *
 * Deliberately structural rather than schema-aware: containers, initContainers,
 * sidecars, operator CRs and chart-specific spec blocks all spell it `image`,
 * and a key-path allowlist would silently miss whichever one a new chart uses.
 * The cost is that a CRD field named `image` that is not a container image would
 * be counted; nothing in this tree has one, and over-counting is the direction
 * that fails loudly (a reference the registry does not resolve).
 */
export function imagesInDocuments(documents: readonly unknown[]): readonly string[] {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node === null || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "image" && typeof value === "string" && value.trim() !== "") found.add(value.trim());
      else walk(value);
    }
  };
  walk(documents);
  return [...found].sort(compareStrings);
}

// ---------------------------------------------------------------------------
// Registry references
// ---------------------------------------------------------------------------

export interface ParsedReference {
  readonly host: string;
  readonly repository: string;
  /** A tag or a `sha256:` digest. */
  readonly reference: string;
}

/**
 * Split an image reference the way a registry client must.
 *
 * THE CASE THAT BITES, and the reason this is a named function with its own
 * falsifiers: a reference can carry a tag AND a digest (`repo:v1.2@sha256:...`),
 * which several charts in this tree emit. Strip only the digest and the tag stays
 * glued to the repository name, every request 401s, and the images read as
 * "private" when they are public. That is a measurement manufactured by the
 * measurer, and it cost this module 10 of its 129 images on the first pass.
 */
export function parseImageReference(image: string): ParsedReference {
  let rest = image;
  let host = "registry-1.docker.io";
  const slash = rest.indexOf("/");
  const first = slash === -1 ? "" : rest.slice(0, slash);
  if (first !== "" && (first.includes(".") || first.includes(":") || first === "localhost")) {
    host = first === "docker.io" || first === "index.docker.io" ? "registry-1.docker.io" : first;
    rest = rest.slice(slash + 1);
  }
  let reference = "latest";
  const at = rest.indexOf("@");
  if (at !== -1) {
    reference = rest.slice(at + 1);
    rest = rest.slice(0, at);
  }
  const colon = rest.lastIndexOf(":");
  if (colon !== -1 && !rest.slice(colon + 1).includes("/")) {
    if (at === -1) reference = rest.slice(colon + 1);
    rest = rest.slice(0, colon);
  }
  if (host === "registry-1.docker.io" && !rest.includes("/")) rest = `library/${rest}`;
  return { host, repository: rest, reference };
}

// ---------------------------------------------------------------------------
// The measured record
// ---------------------------------------------------------------------------

export interface MeasuredImage {
  readonly reference: string;
  /** `null` means UNSIZED, never zero. `reason` says which refusal it was. */
  readonly compressedBytes: number | null;
  readonly layers: number | null;
  readonly reason?: string;
}

export interface MeasuredApp {
  readonly appId: string;
  /** Directory under `full-ai-cluster/k8s/applications/`, or `null` for a source outside it. */
  readonly dir: string | null;
  readonly images: readonly string[];
}

/**
 * An image that was actually PULLED on a runner, not multiplied by a ratio.
 *
 * Both numbers are here because they answer different questions and disagree:
 * `extractedBytes` is what docker reports the image weighs, `diskDeltaBytes` is
 * what `df` lost — smaller, because layers already in the store are not written
 * twice. The second is the one that decides whether the next pull fits.
 */
export interface VerifiedPull {
  readonly reference: string;
  readonly compressedBytes: number;
  readonly extractedBytes: number;
  readonly diskDeltaBytes: number;
  readonly measuredRatio: number;
  readonly pullSeconds: number;
  readonly runId: string;
  readonly note: string;
}

export interface Measurement {
  readonly measuredOn: string;
  readonly method: string;
  readonly uncompressedRatio: number;
  readonly ratioEvidence: string;
  readonly images: readonly MeasuredImage[];
  readonly apps: readonly MeasuredApp[];
  readonly verifiedPulls?: readonly VerifiedPull[];
  readonly verifiedPullsNote?: string;
}

export function loadMeasurement(path = DEFAULT_MEASUREMENT_PATH, repoRoot = REPO_ROOT): Measurement {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8")) as Measurement;
}

// ---------------------------------------------------------------------------
// Cohorts — read from the TREE, never restated
// ---------------------------------------------------------------------------

export interface Cohorts {
  readonly all: ReadonlySet<string>;
  readonly applied: ReadonlySet<string>;
  readonly asserted: ReadonlySet<string>;
}

/**
 * The three cohorts, derived from the same functions the readiness auditor and
 * the health test use. Restating them here would create a fourth list free to
 * drift from the three that already exist.
 */
export function cohorts(repoRoot = REPO_ROOT): Cohorts {
  const all = new Set(applicationDirs(repoRoot));
  const applied = new Set(devLaneAppliedDirs(repoRoot));
  const asserted = new Set(
    discoverExpectedApplications(repoRoot)
      .filter((app) => !app.excludedFromDev && applied.has(app.dir))
      .map((app) => app.dir),
  );
  return { all, applied, asserted };
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

export interface AppFootprint {
  readonly dir: string;
  readonly cohort: "asserted" | "applied" | "excluded";
  readonly compressedBytes: number;
  readonly unsized: readonly string[];
  readonly imageCount: number;
}

export interface CohortTotal {
  readonly label: string;
  readonly apps: number;
  readonly distinctImages: number;
  readonly compressedBytes: number;
  readonly unsized: number;
}

function sizeIndex(measurement: Measurement): ReadonlyMap<string, MeasuredImage> {
  return new Map(measurement.images.map((image) => [image.reference, image]));
}

/** Which cohort a directory is in. Named rather than nested-ternaried at the call site. */
function cohortOf(dir: string, sets: Cohorts): AppFootprint["cohort"] {
  if (sets.asserted.has(dir)) return "asserted";
  if (sets.applied.has(dir)) return "applied";
  return "excluded";
}

export function appFootprints(measurement: Measurement, sets: Cohorts): readonly AppFootprint[] {
  const sizes = sizeIndex(measurement);
  const rows: AppFootprint[] = [];
  for (const app of measurement.apps) {
    if (app.dir === null || !sets.all.has(app.dir)) continue;
    let compressedBytes = 0;
    const unsized: string[] = [];
    for (const reference of app.images) {
      const bytes = sizes.get(reference)?.compressedBytes ?? null;
      if (bytes === null) unsized.push(reference);
      else compressedBytes += bytes;
    }
    rows.push({
      dir: app.dir,
      cohort: cohortOf(app.dir, sets),
      compressedBytes,
      unsized,
      imageCount: app.images.length,
    });
  }
  return rows.sort((a, b) => b.compressedBytes - a.compressedBytes || compareStrings(a.dir, b.dir));
}

/**
 * A cohort's total counts each DISTINCT image once.
 *
 * Per-app rows deliberately do not: an image two apps both render is part of
 * both their footprints, and attributing it to one of them would make the other
 * look free. So the per-app column sums to MORE than the cohort total, and that
 * is the correct relationship rather than an inconsistency — shared base images
 * are exactly where the difference lives.
 */
export function cohortTotal(
  measurement: Measurement,
  label: string,
  dirs: ReadonlySet<string>,
): CohortTotal {
  const sizes = sizeIndex(measurement);
  const images = new Set<string>();
  for (const app of measurement.apps) {
    if (app.dir === null || !dirs.has(app.dir)) continue;
    for (const reference of app.images) images.add(reference);
  }
  let compressedBytes = 0;
  let unsized = 0;
  for (const reference of images) {
    const bytes = sizes.get(reference)?.compressedBytes ?? null;
    if (bytes === null) unsized += 1;
    else compressedBytes += bytes;
  }
  return { label, apps: dirs.size, distinctImages: images.size, compressedBytes, unsized };
}

/** How much of a cohort's bytes the biggest `n` apps carry. */
export function concentration(
  rows: readonly AppFootprint[],
  total: number,
  n: number,
): { topBytes: number; fraction: number; dirs: readonly string[] } {
  const top = rows.slice(0, n);
  const topBytes = top.reduce((sum, row) => sum + row.compressedBytes, 0);
  return { topBytes, fraction: total === 0 ? 0 : topBytes / total, dirs: top.map((row) => row.dir) };
}

// ---------------------------------------------------------------------------
// The registry client — used only by `--measure`
// ---------------------------------------------------------------------------

const MANIFEST_ACCEPT = [
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
].join(",");

/**
 * Fetch a manifest, performing the Docker registry v2 token dance when the
 * registry asks for one.
 *
 * The challenge is READ rather than assumed: `registry-1.docker.io`, `ghcr.io`,
 * `quay.io` and `registry.k8s.io` all publish different realms and services, and
 * a hardcoded token endpoint would work for whichever one it was written against
 * and silently 401 the rest — which reads as "private image" and undercounts.
 */
async function fetchManifest(url: string, repository: string, tokens: Map<string, string>): Promise<Response> {
  const headers: Record<string, string> = { Accept: MANIFEST_ACCEPT, "User-Agent": "zeta-image-footprint/1" };
  const cached = tokens.get(repository);
  if (cached !== undefined) headers.Authorization = `Bearer ${cached}`;
  const first = await fetch(url, { headers });
  if (first.status !== 401) return first;
  const challenge = first.headers.get("www-authenticate") ?? "";
  const realm = /realm="([^"]+)"/.exec(challenge)?.[1];
  if (realm === undefined) return first;
  const tokenUrl = new URL(realm);
  const service = /service="([^"]+)"/.exec(challenge)?.[1];
  if (service !== undefined) tokenUrl.searchParams.set("service", service);
  tokenUrl.searchParams.set("scope", /scope="([^"]+)"/.exec(challenge)?.[1] ?? `repository:${repository}:pull`);
  const tokenResponse = await fetch(tokenUrl.toString(), { headers: { "User-Agent": "zeta-image-footprint/1" } });
  if (!tokenResponse.ok) return first;
  const body = (await tokenResponse.json()) as { token?: string; access_token?: string };
  const token = body.token ?? body.access_token;
  if (token === undefined) return first;
  tokens.set(repository, token);
  headers.Authorization = `Bearer ${token}`;
  return fetch(url, { headers });
}

/**
 * The compressed bytes a registry would serve for this image on linux/amd64.
 *
 * Every failure returns a REASON and a null size. There is no path that returns
 * a number it did not read.
 */
export async function measureImage(image: string, tokens = new Map<string, string>()): Promise<MeasuredImage> {
  const { host, repository, reference } = parseImageReference(image);
  const base = `https://${host}/v2/${repository}/manifests/`;
  let response = await fetchManifest(base + reference, repository, tokens);
  if (!response.ok) {
    return { reference: image, compressedBytes: null, layers: null, reason: `manifest HTTP ${String(response.status)}` };
  }
  let manifest = (await response.json()) as Record<string, unknown>;
  const index = manifest.manifests;
  if (Array.isArray(index)) {
    const amd64 = index.find((entry) => {
      const platform = (entry as { platform?: { architecture?: string; os?: string } }).platform;
      return platform?.architecture === "amd64" && platform.os === "linux";
    }) as { digest?: string } | undefined;
    if (amd64?.digest === undefined) {
      return { reference: image, compressedBytes: null, layers: null, reason: "no linux/amd64 entry in the index" };
    }
    response = await fetchManifest(base + amd64.digest, repository, tokens);
    if (!response.ok) {
      return {
        reference: image,
        compressedBytes: null,
        layers: null,
        reason: `amd64 manifest HTTP ${String(response.status)}`,
      };
    }
    manifest = (await response.json()) as Record<string, unknown>;
  }
  const layers = manifest.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    return { reference: image, compressedBytes: null, layers: null, reason: "manifest carries no layers" };
  }
  const config = manifest.config as { size?: number } | undefined;
  const total = layers.reduce(
    (sum: number, layer) => sum + ((layer as { size?: number }).size ?? 0),
    config?.size ?? 0,
  );
  return { reference: image, compressedBytes: total, layers: layers.length };
}

/**
 * Render every Application and price its images. Needs `helm` and the network.
 *
 * The render is `renderApplication` — the SAME function the storage snapshot
 * uses, at the same pins, against the same valuesObject. Two measurements of the
 * same cluster that disagreed about what it runs would be worse than one.
 */
export async function measureAll(repoRoot = REPO_ROOT): Promise<Measurement> {
  const { discoverApplications, renderApplication } = await import("./rendered-storage-claims.ts");
  const apps: MeasuredApp[] = [];
  for (const source of discoverApplications(repoRoot)) {
    const rendered = renderApplication(source, { repoRoot, timeoutMs: 240_000 });
    const dir = source.appId.startsWith("full-ai-cluster/")
      ? (source.appId.slice("full-ai-cluster/".length).split("/")[0] ?? null)
      : null;
    apps.push({
      appId: source.appId,
      dir,
      images: rendered.ok ? imagesInDocuments(rendered.documents) : [],
    });
    if (!rendered.ok) console.error(`UNRENDERABLE ${source.appId}: ${rendered.reason} — ${rendered.detail}`);
  }
  const distinct = [...new Set(apps.flatMap((app) => app.images))].sort(compareStrings);
  const tokens = new Map<string, string>();
  const images: MeasuredImage[] = [];
  for (const reference of distinct) {
    images.push(await measureImage(reference, tokens));
    console.error(`${String(images.length)}/${String(distinct.length)} ${reference}`);
  }
  return {
    measuredOn: new Date().toISOString().slice(0, 10),
    method:
      "every image read out of `helm template` at the Application's pinned targetRevision against its own " +
      "valuesObject; size = config.size + sum(layers[].size) from the registry's linux/amd64 manifest",
    uncompressedRatio: 2.67,
    ratioEvidence:
      "the aggregate measured in storage-profiles.json by streaming and gunzipping four images from this tree " +
      "(argocd v2.13.2 x2.69, loki 3.3.2 x3.21, kube-state-metrics v2.14.0 x3.39, cockroach v24.2.4 x2.49); " +
      "containerd stores layers UNPACKED, so this is the multiplier that decides whether a pull fits",
    images,
    apps,
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function gb(bytes: number): string {
  return (bytes / 1e9).toFixed(2);
}

const GIB = 1024 ** 3;

/**
 * Does a cohort's image estimate fit the disk the envelope declares?
 *
 * THE UNITS ARE THE POINT. Registry sizes are DECIMAL bytes summed into GB;
 * `df` and the envelope's `freeDiskGib` are BINARY GiB. 80 "GB" of images
 * against "77 GiB" free looks like a 3-unit overrun and is actually 80 against
 * 82.7 — it fits. Getting that backwards is how a lane gets partitioned to
 * solve a problem it does not have, so the comparison is computed here, once, in
 * bytes, rather than left to whoever is reading two numbers in two units.
 */
export function fitsDeclaredDisk(
  compressedBytes: number,
  ratio: number,
  budgetGib: number,
): { estimatedBytes: number; budgetBytes: number; fits: boolean; headroomBytes: number } {
  const estimatedBytes = compressedBytes * ratio;
  const budgetBytes = budgetGib * GIB;
  return {
    estimatedBytes,
    budgetBytes,
    fits: estimatedBytes <= budgetBytes,
    headroomBytes: budgetBytes - estimatedBytes,
  };
}

/**
 * `runnerEnvelope.measuredFreeDiskGib` — READ off runners, and priced against by
 * nothing. `null` when absent, never a default: a measurement that is not there
 * must not be invented.
 */
export function measuredFreeDiskGib(repoRoot = REPO_ROOT): number | null {
  const parsed = JSON.parse(
    readFileSync(resolve(repoRoot, "full-ai-cluster/k8s/storage-profiles.json"), "utf8"),
  ) as { runnerEnvelope?: { measuredFreeDiskGib?: unknown } };
  const value = parsed.runnerEnvelope?.measuredFreeDiskGib;
  return typeof value === "number" ? value : null;
}

/** One FITS/OVER line per cohort against a given disk figure, in bytes. */
function verdictLines(
  totals: readonly CohortTotal[],
  ratio: number,
  budgetGib: number,
): readonly string[] {
  return totals.map((total) => {
    const verdict = fitsDeclaredDisk(total.compressedBytes, ratio, budgetGib);
    return (
      `  ${total.label.padEnd(9)} est. ${gb(verdict.estimatedBytes).padStart(6)} GB  ` +
      `${verdict.fits ? "FITS" : "OVER"} by ${gb(Math.abs(verdict.headroomBytes)).padStart(6)} GB`
    );
  });
}

/** The rows that were pulled rather than multiplied. Empty when none were. */
function verifiedPullLines(measurement: Measurement): readonly string[] {
  const pulls = measurement.verifiedPulls ?? [];
  if (pulls.length === 0) return [];
  const lines = [
    "",
    "VERIFIED BY PULLING IT — the estimate above vs what a runner actually paid",
    "  image                                        compressed   est x2.67   ACTUAL extracted   df delta   ratio",
  ];
  for (const pull of pulls) {
    lines.push(
      `  ${pull.reference.padEnd(42)} ${gb(pull.compressedBytes).padStart(8)} GB  ` +
        `${gb(pull.compressedBytes * measurement.uncompressedRatio).padStart(6)} GB  ` +
        `${gb(pull.extractedBytes).padStart(13)} GB  ${gb(pull.diskDeltaBytes).padStart(6)} GB  ` +
        `x${pull.measuredRatio.toFixed(2)}`,
    );
  }
  if (measurement.verifiedPullsNote !== undefined) lines.push(`  ${measurement.verifiedPullsNote}`);
  return lines;
}

export function formatReport(measurement: Measurement, sets: Cohorts): string {
  const rows = appFootprints(measurement, sets);
  const lines: string[] = [];
  lines.push(`IMAGE FOOTPRINT — measured ${measurement.measuredOn}`);
  lines.push(`  ${measurement.method}`);
  lines.push(`  on-disk figures are ESTIMATED at x${String(measurement.uncompressedRatio)}: ${measurement.ratioEvidence}`);
  lines.push("");
  lines.push("cohort     apps  images   compressed GB   est. on disk GB   unsized");
  const totals = [
    cohortTotal(measurement, "asserted", sets.asserted),
    cohortTotal(measurement, "applied", sets.applied),
    cohortTotal(measurement, "all", sets.all),
  ];
  for (const total of totals) {
    lines.push(
      `${total.label.padEnd(9)} ${String(total.apps).padStart(4)}  ${String(total.distinctImages).padStart(6)}   ` +
        `${gb(total.compressedBytes).padStart(13)}   ${gb(total.compressedBytes * measurement.uncompressedRatio).padStart(15)}   ${String(total.unsized).padStart(7)}`,
    );
  }
  lines.push("");
  lines.push("PER APP — its own rendered images; an image two apps render is in both rows");
  lines.push("rank  app                        cohort     compressed GB   est. on disk GB  images  unsized");
  let rank = 0;
  for (const row of rows) {
    rank += 1;
    lines.push(
      `${String(rank).padStart(4)}  ${row.dir.padEnd(26)} ${row.cohort.padEnd(9)}  ${gb(row.compressedBytes).padStart(13)}   ` +
        `${gb(row.compressedBytes * measurement.uncompressedRatio).padStart(15)}  ${String(row.imageCount).padStart(6)}  ${String(row.unsized.length).padStart(7)}`,
    );
  }
  const allTotal = totals[2]?.compressedBytes ?? 0;
  const top = concentration(rows, allTotal, 5);
  lines.push("");
  lines.push(
    `CONCENTRATION: the top 5 (${top.dirs.join(", ")}) are ${gb(top.topBytes)} GB of ${gb(allTotal)} GB ` +
      `compressed — ${(top.fraction * 100).toFixed(1)}% — or ~${gb(top.topBytes * measurement.uncompressedRatio)} GB of ` +
      `~${gb(allTotal * measurement.uncompressedRatio)} GB unpacked.`,
  );
  const budget = envelopeBudget(loadResourceCatalogue().envelope);
  const measuredFree = measuredFreeDiskGib();
  lines.push("");
  lines.push(
    `AGAINST THE DECLARED DISK — ${String(budget.diskGib)} GiB usable (envelope freeDiskGib minus reservedDiskGib), ` +
      `which is ${gb(budget.diskGib * GIB)} GB decimal. Image sizes are decimal; disk is binary; the comparison is in bytes.`,
  );
  lines.push(...verdictLines(totals, measurement.uncompressedRatio, budget.diskGib));
  // Two verdicts, printed together because they disagree. The declared bound is
  // what consumers price against; the measurement is what the machine has.
  // Showing one and not the other is how a stale bound stays invisible.
  if (measuredFree !== null) {
    lines.push("");
    lines.push(
      `AGAINST THE MEASURED DISK — ${String(measuredFree)} GiB (runnerEnvelope.measuredFreeDiskGib; nothing prices ` +
        `against it, see its evidence string for why the declared bound did not move with it):`,
    );
    lines.push(...verdictLines(totals, measurement.uncompressedRatio, measuredFree));
  }
  lines.push(...verifiedPullLines(measurement));
  const unsizedRefs = measurement.images.filter((image) => image.compressedBytes === null);
  lines.push("");
  lines.push(`UNSIZED (${String(unsizedRefs.length)}) — counted in no total above, and NOT zero:`);
  for (const image of unsizedRefs) lines.push(`  ${image.reference.padEnd(72)} ${image.reason ?? "no reason recorded"}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = [
  "image-footprint — which Applications the runner's disk is spent on",
  "",
  "  --report   print the ranked per-app footprint from the checked-in measurement (offline)",
  "  --json     the same numbers as JSON",
  "  --measure  re-render every chart, re-price every image, rewrite the measurement (needs helm + network)",
].join("\n");

export function main(argv: readonly string[]): number {
  if (argv.includes("--measure")) {
    // Awaited at the call site below; `main` stays synchronous for every offline
    // path so the report cannot accidentally depend on the network.
    throw new Error("--measure is async; run it through the entrypoint below");
  }
  if (argv.includes("--report") || argv.includes("--json")) {
    const measurement = loadMeasurement();
    const sets = cohorts();
    if (argv.includes("--json")) {
      console.log(
        JSON.stringify(
          {
            measuredOn: measurement.measuredOn,
            cohorts: [
              cohortTotal(measurement, "asserted", sets.asserted),
              cohortTotal(measurement, "applied", sets.applied),
              cohortTotal(measurement, "all", sets.all),
            ],
            apps: appFootprints(measurement, sets),
          },
          null,
          2,
        ),
      );
      return 0;
    }
    console.log(formatReport(measurement, sets));
    return 0;
  }
  console.log(USAGE);
  return 2;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.includes("--measure")) {
    const measurement = await measureAll();
    const path = resolve(REPO_ROOT, DEFAULT_MEASUREMENT_PATH);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path, `${JSON.stringify(measurement, null, 2)}\n`, "utf8");
    console.error(`wrote ${DEFAULT_MEASUREMENT_PATH}`);
    process.exit(0);
  }
  process.exit(main(argv));
}
