// Rendered storage claims — does a DECLARED storage claim correspond to a PVC
// the chart actually produces?
//
// WHY THIS EXISTS
// ---------------
// `full-ai-cluster/k8s/storage-profiles.json` declares a per-app storage ladder
// and `storage-profiles.ts` reads it. Both sides of that pair read OUR YAML:
// the catalogue records what we wrote into an Application's `valuesObject`, and
// the readiness extractor reads the same scalar back out. Neither one has ever
// asked the chart whether that value reaches a PersistentVolumeClaim.
//
// It does not always. PR #13410 measured `hindsight`'s `valuesObject` as
// largely inert against chart 0.3.0: the row declared
// `postgresql.primary.persistence.{storageClass: longhorn, size: 10Gi}` and the
// chart rendered a PVC with NO storageClassName at 8Gi. The declaration had been
// governing a path that does not exist, and every check in the repo agreed with
// it, because every check was reading the declaration.
//
// That one, and nats's inert top-level `cluster: {replicas: 3}`, were FIXED on
// 2026-08-22 (the manifests moved, the snapshot was re-measured, and their three
// baseline entries were retired). The motivating case is kept in the past tense
// rather than deleted: a module's reason to exist should not evaporate the first
// time it works.
//
// The `$comment_resources` block in the same catalogue already carries numbers
// that WERE rendered — CPU and memory, "MEASURED 2026-08-21 by `helm pull` at
// each pinned targetRevision followed by `helm template`". Storage had no
// equivalent. This module is that equivalent.
//
// WHAT IT CHECKS, AND WHY BOTH DIRECTIONS
// ---------------------------------------
//   1. a declared claim that no rendered PVC matches  -> the ladder is
//      governing nothing, and its GiB are counted against a volume that will
//      not exist (or will exist at a different size, on a different disk)
//   2. a rendered PVC that no declaration covers      -> a real disk consumer
//      that no total includes; this is how capacity stays invisible
//
// One direction is half a check. Direction 1 alone lets an undeclared PVC eat
// the disk; direction 2 alone lets a stale row inflate the total. The existing
// `crossCheckClaims` makes exactly this argument against the YAML extractor;
// this module makes it against the renderer.
//
// SIZE **AND** STORAGECLASS
// -------------------------
// Comparing size alone would have passed hindsight on three of four rungs
// (`minimal` declares 8Gi and the chart renders 8Gi). The defect is visible in
// the storageClass, and on metal a wrong storageClass is not cosmetic: it puts
// the volume on a different disk, or on no disk at all when the class does not
// exist. Both are compared.
//
// POD COUNT IS PART OF THE CLAIM
// ------------------------------
// A StatefulSet with `replicas: 3` and a volumeClaimTemplate provisions THREE
// PVCs. The catalogue's `$comment_claims` and `podsSource` field already carry
// this, and mimir is the worked trap: `mimir-distributed` 5.5.1 renders three
// zone StatefulSets for the ingester and three more for the store-gateway, so
// what looks like one claim is six PVCs. Rendering gets that right for free —
// the zone StatefulSets are separate objects in the output — which is why this
// module counts rendered PVCs rather than trusting a replica scalar.
//
// UNRENDERABLE IS A THIRD ANSWER, NEVER A SKIP
// --------------------------------------------
// Some charts cannot be rendered here: private ghcr repositories, tags
// withdrawn upstream, charts whose templates call `lookup` (which returns empty
// under `helm template` and can change what renders). An app that could not be
// checked must never read as an app that passed. Every such app is named, with
// its reason, in the report and in the exit status.
//
// AND "UNRENDERABLE" IS NOT ONE CLASS — 2026-08-21
// -----------------------------------------------
// The list read as one bucket, and it was hiding two very different things:
//
//   DEFECT     the manifest is wrong, and ArgoCD would fail on the same values
//              in the same place. Nothing about the checker is involved.
//   TOOL LIMIT the chart needs something only a live cluster has, so `helm
//              template` cannot answer and a real sync could.
//
// Conflating them is expensive in both directions: a defect filed as a tool
// limit never gets fixed, and a tool limit filed as a defect sends someone
// looking for a bug in a working manifest. The reason codes already draw the
// line — `helm-pull-failed` means the PIN names nothing a registry serves,
// `helm-template-failed` means the chart is there and our VALUES are wrong —
// and as of `adjudicateUnrenderable` below that line is CHECKED: an
// acknowledgement pins the class it was written about and stops covering the
// app if the class changes.
//
// THE MEASURED ANSWER, for the five apps that were on this list: all five were
// DEFECTS. Four are fixed in the change that wrote this paragraph, and the fix
// was one or two values in our own manifest every time —
//
//   headscale      `persistence.data` (a key the chart mounts at /data and
//                  never writes to) with no `accessMode`, while the sqlite DB
//                  and both private keys sat on ephemeral disk under
//                  /etc/headscale. Now `persistence.config` + accessMode.
//   oz             a targetRevision (1.4.5) no registry has ever served,
//                  MASKING a second defect: every published version also
//                  requires `clientApi.advertisedHost`, and the manifest's
//                  `adminSecret:` block is a key ziti-controller has never had.
//   gitlab         missing `global.ingress.configureCertmanager: false` — the
//                  key its own sibling in infra/ already carries, which is
//                  precisely why that one rendered and this one did not.
//   arc-runner-set the `lookup` case, and the one that LOOKED structural. It is
//                  not: the chart ships `controllerServiceAccount.{name,
//                  namespace}` to skip the discovery, its own failure message
//                  recommends them, and the values are derivable by rendering
//                  the sibling controller chart at the same pin. A `lookup`
//                  makes a chart unrenderable only when the chart offers no way
//                  to supply what the lookup would have found.
//
// So no app in this tree is currently in the TOOL LIMIT class, and none is
// recorded as being in it. An empty class with a member invented to justify it
// would be the same failure one level up.

import {
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  rmSync,
  openSync,
  closeSync,
  type Dirent,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { parseAllDocuments, stringify as yamlStringify } from "yaml";
import { stringCompare } from "../collation/collation.ts";
import { quantityToGib } from "./single-node-readiness.ts";
import {
  loadCatalogue,
  parseFieldPath,
  type ProfileCatalogue,
  type ProfileClaim,
  type ProfileFinding,
} from "./storage-profiles.ts";
import { clusterDefaultStorageClass, effectiveStorageClass } from "./cluster-default-storage-class.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const DEFAULT_BASELINE_PATH = "src/Core.TypeScript/cluster/rendered-storage-claims.baseline.json";

/** Directories whose depth-1 entries are `<app>/Application.yaml`. */
const APPLICATION_ROOTS = ["full-ai-cluster/k8s/applications", "infra/k8s/applications"] as const;

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export type SourceKind = "helm-remote" | "git-path";

export interface ApplicationSource {
  /** `<tree>/<app>` — `full-ai-cluster/mimir`, `infra/cockroachdb`. Stable identity. */
  readonly appId: string;
  /** Repo-relative path of the Application.yaml that declares it. */
  readonly manifestPath: string;
  readonly kind: SourceKind;
  readonly repoURL: string;
  readonly chart: string;
  readonly targetRevision: string;
  readonly releaseName: string;
  readonly namespace: string;
  readonly valuesObject: unknown;
  /** For `git-path`: repo-relative directory the Application syncs. */
  readonly gitPath: string;
  /** For `git-path`: the `directory.include` glob, or "" when absent. */
  readonly includeGlob: string;
}

/**
 * Read a file, or `null` when it is not there.
 *
 * NOT `existsSync` then `readFileSync`: between the check and the use the path
 * can be created, deleted, or replaced, so the answer the check returned is
 * already stale when the read runs. One syscall, one answer, no window —
 * `lint-check-then-use-file-races.ts` is the standing guard.
 */
function readIfPresent(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/**
 * Is the chart archive already in the cache?
 *
 * `openSync`/`closeSync` rather than `existsSync`, so the answer comes from an
 * operation that either succeeded or failed rather than from a prediction about
 * a later one — the same one-syscall-one-answer discipline as `readIfPresent`,
 * for a file whose bytes we do not want to read.
 */
function archiveIsCached(abs: string): boolean {
  try {
    closeSync(openSync(abs, "r"));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/**
 * `readdirSync` with Dirents, or `null` when the directory is not there.
 *
 * `null` and `[]` are DIFFERENT answers — "no such directory" and "an empty
 * one" — and a caller that needs to tell them apart must not have to ask the
 * filesystem a second time to find out.
 */
function readdirIfPresent(abs: string): Dirent[] | null {
  try {
    return readdirSync(abs, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function treeOf(manifestPath: string): string {
  return manifestPath.startsWith("infra/") ? "infra" : "full-ai-cluster";
}

/** Enumerate every `Application.yaml` under the roots, depth 1 AND depth 2. */
export function applicationManifestPaths(repoRoot = REPO_ROOT): readonly string[] {
  const out: string[] = [];
  for (const root of APPLICATION_ROOTS) {
    const abs = resolve(repoRoot, root);
    // `withFileTypes` so the kind arrives WITH the listing: a separate stat is
    // a second syscall racing a fact the first one already returned.
    const entries = readdirIfPresent(abs) ?? [];
    for (const entry of entries.sort((a, b) => stringCompare(a.name, b.name))) {
      if (!entry.isDirectory()) continue;
      const entryAbs = join(abs, entry.name);
      for (const nested of (readdirIfPresent(entryAbs) ?? []).sort((a, b) => stringCompare(a.name, b.name))) {
        if (nested.isFile() && nested.name === "Application.yaml") {
          out.push(`${root}/${entry.name}/Application.yaml`);
          continue;
        }
        if (!nested.isDirectory()) continue;
        for (const deeper of readdirIfPresent(join(entryAbs, nested.name)) ?? []) {
          if (deeper.isFile() && deeper.name === "Application.yaml") {
            out.push(`${root}/${entry.name}/${nested.name}/Application.yaml`);
          }
        }
      }
    }
  }
  return out;
}

/**
 * Every Application source in the tree.
 *
 * An Application may carry `source` or `sources` (multi-source); both are
 * enumerated, because a PVC can come from either. `appId` is derived from the
 * manifest's directory rather than from `metadata.name` so it survives a rename
 * of the release without changing the identity a baseline is keyed on.
 */
export function discoverApplications(repoRoot = REPO_ROOT): readonly ApplicationSource[] {
  const out: ApplicationSource[] = [];
  for (const manifestPath of applicationManifestPaths(repoRoot)) {
    const text = readIfPresent(resolve(repoRoot, manifestPath));
    if (text === null) continue;
    const segments = manifestPath.split("/");
    const appDir = segments.slice(3, -1).join("/");
    const appId = `${treeOf(manifestPath)}/${appDir}`;
    for (const doc of parseAllDocuments(text)) {
      const obj = doc.toJS() as Record<string, unknown> | null;
      if (obj === null || obj["kind"] !== "Application") continue;
      const spec = (obj["spec"] ?? {}) as Record<string, unknown>;
      const metadata = (obj["metadata"] ?? {}) as Record<string, unknown>;
      const destination = (spec["destination"] ?? {}) as Record<string, unknown>;
      const sources = Array.isArray(spec["sources"])
        ? (spec["sources"] as Record<string, unknown>[])
        : spec["source"] !== undefined
          ? [spec["source"] as Record<string, unknown>]
          : [];
      for (const source of sources) {
        const helm = (source["helm"] ?? {}) as Record<string, unknown>;
        const directory = (source["directory"] ?? {}) as Record<string, unknown>;
        const chart = typeof source["chart"] === "string" ? source["chart"] : "";
        out.push({
          appId,
          manifestPath,
          kind: chart === "" ? "git-path" : "helm-remote",
          repoURL: typeof source["repoURL"] === "string" ? source["repoURL"] : "",
          chart,
          targetRevision: typeof source["targetRevision"] === "string" ? source["targetRevision"] : "",
          releaseName:
            typeof helm["releaseName"] === "string"
              ? helm["releaseName"]
              : typeof metadata["name"] === "string"
                ? metadata["name"]
                : appDir,
          namespace: typeof destination["namespace"] === "string" ? destination["namespace"] : "default",
          valuesObject: helm["valuesObject"] ?? {},
          gitPath: typeof source["path"] === "string" ? source["path"] : "",
          includeGlob: typeof directory["include"] === "string" ? directory["include"] : "",
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderOk {
  readonly ok: true;
  readonly documents: readonly Record<string, unknown>[];
}

export interface RenderFailed {
  readonly ok: false;
  /** Short machine-stable class, e.g. "helm-pull-failed". */
  readonly reason: string;
  /** The tool's own words, trimmed. Never paraphrased into something reassuring. */
  readonly detail: string;
}

export type RenderResult = RenderOk | RenderFailed;

export interface RenderOptions {
  readonly repoRoot?: string | undefined;
  readonly cacheDir?: string | undefined;
  readonly helmBin?: string | undefined;
  readonly timeoutMs?: number | undefined;
  /** Injected for tests: replaces the real `helm` invocation. */
  readonly runHelm?: (args: readonly string[], cwd: string) => { status: number; stdout: string; stderr: string };
  /**
   * Rung values to write into a `git-path` source's own manifests before
   * parsing them — the git-path analogue of `valuesObject`. Ignored for
   * `helm-remote`, which has a values surface of its own.
   */
  readonly manifestOverlays?: readonly ManifestOverlay[] | undefined;
}

function defaultRunHelm(
  helmBin: string,
  timeoutMs: number,
): (args: readonly string[], cwd: string) => { status: number; stdout: string; stderr: string } {
  return (args, cwd) => {
    const result = spawnSync(helmBin, [...args], {
      cwd,
      encoding: "utf8",
      timeout: timeoutMs,
      env: { ...process.env, HELM_EXPERIMENTAL_OCI: "1" },
    });
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? (result.error === undefined ? "" : String(result.error.message)),
    };
  };
}

/** `{a,b}.yaml` -> a matcher over BASE NAMES. Empty glob matches every `.yaml`. */
export function includeMatcher(glob: string): (baseName: string) => boolean {
  if (glob.trim() === "") return (name) => name.endsWith(".yaml") || name.endsWith(".yml");
  const alternatives: string[] = [];
  const braced = /\{([^}]*)\}/.exec(glob);
  if (braced?.[1] !== undefined) {
    for (const piece of braced[1].split(",")) {
      alternatives.push(glob.replace(braced[0], piece.trim()));
    }
  } else {
    alternatives.push(glob);
  }
  const regexes = alternatives.map(
    (alternative) =>
      new RegExp(
        `^${alternative
          .replace(/[.+^$()|[\]\\]/g, "\\$&")
          .replace(/\*/g, "[^/]*")
          .replace(/\?/g, ".")}$`,
      ),
  );
  return (name) => regexes.some((re) => re.test(name));
}

/**
 * One overlay onto an in-repo manifest, applied at RENDER time and never on disk.
 *
 * A helm-remote Application has a `valuesObject` a rung can be written into
 * before templating. A git-path Application has no such surface — ArgoCD reads
 * the committed YAML verbatim — so the only place a rung can enter its render
 * is here, at exactly the coordinate the catalogue row names.
 *
 * `value: null` means DELETE the key. A zero reservation in Kubernetes is an
 * absent request, not `cpu: 0`, and `applyResourceProfile` reads zero the same
 * way; the two readings have to agree or the checker and the applier would
 * disagree about a rung neither of them got wrong.
 */
export interface ManifestOverlay {
  /** Repo-relative path of the manifest the coordinate lives in. */
  readonly path: string;
  /** Index of the YAML document WITHIN that file. */
  readonly docIndex: number;
  /** Dotted/bracketed field path, as `parseFieldPath` reads it. */
  readonly field: string;
  readonly value: string | null;
}

interface OverlayableDocument {
  setIn: (path: readonly (string | number)[], value: unknown) => void;
  deleteIn: (path: readonly (string | number)[]) => void;
  getIn: (path: readonly (string | number)[], keepScalar?: boolean) => unknown;
}

/**
 * Apply the overlays for one file to its parsed documents, in memory.
 *
 * Returns the coordinates that MISSED — a field path addressing nothing. A miss
 * is returned rather than swallowed because an overlay that lands nowhere is
 * the vacuity class exactly: the render would agree with every rung equally and
 * would look like a rung that had been applied.
 */
function applyManifestOverlays(
  docs: readonly OverlayableDocument[],
  overlays: readonly ManifestOverlay[],
): string[] {
  const missed: string[] = [];
  for (const overlay of overlays) {
    const doc = docs[overlay.docIndex];
    if (doc === undefined) {
      missed.push(`${overlay.path}#${String(overlay.docIndex)}: no document at that index`);
      continue;
    }
    const fieldPath = parseFieldPath(overlay.field);
    if (overlay.value === null) {
      doc.deleteIn(fieldPath);
      continue;
    }
    // The PARENT must exist. Creating one would invent a `resources.requests`
    // on a container the manifest never gave one, which is a request the
    // cluster will never see reported as a request it will.
    const parent = fieldPath.slice(0, -1);
    if (parent.length > 0 && doc.getIn(parent) === undefined) {
      missed.push(`${overlay.path}#${String(overlay.docIndex)} has nothing at ${parent.join(".")}`);
      continue;
    }
    doc.setIn(fieldPath, overlay.value);
  }
  return missed;
}

function renderGitPath(
  source: ApplicationSource,
  repoRoot: string,
  overlays: readonly ManifestOverlay[],
): RenderResult {
  const abs = resolve(repoRoot, source.gitPath);
  const entries = readdirIfPresent(abs);
  if (entries === null) {
    return { ok: false, reason: "git-path-missing", detail: `${source.gitPath} does not exist in the tree` };
  }
  const matches = includeMatcher(source.includeGlob);
  const documents: Record<string, unknown>[] = [];
  const missed: string[] = [];
  const applied = new Set<string>();
  for (const entry of entries.sort((a, b) => stringCompare(a.name, b.name))) {
    if (!entry.isFile() || !matches(entry.name)) continue;
    const relative = `${source.gitPath}/${entry.name}`;
    const text = readIfPresent(join(abs, entry.name));
    if (text === null) continue;
    const docs = parseAllDocuments(text);
    const mine = overlays.filter((overlay) => overlay.path === relative);
    if (mine.length > 0) {
      applied.add(relative);
      missed.push(...applyManifestOverlays(docs, mine));
    }
    for (const doc of docs) {
      const obj = doc.toJS() as Record<string, unknown> | null;
      if (obj !== null && typeof obj === "object") documents.push(obj);
    }
  }
  // An overlay whose FILE was never read is a worse miss than one whose field
  // missed: the file is outside the Application's `directory.include` glob, so
  // ArgoCD does not apply it either and the catalogue is pricing a manifest the
  // cluster never gets.
  for (const overlay of overlays) {
    if (!applied.has(overlay.path)) {
      missed.push(`${overlay.path} is not among the files ${source.gitPath} syncs (directory.include)`);
    }
  }
  if (missed.length > 0) {
    return {
      ok: false,
      reason: "manifest-overlay-missed",
      detail: [...new Set(missed)].sort((a, b) => stringCompare(a, b)).join(" / "),
    };
  }
  return { ok: true, documents };
}

function chartArchivePath(cacheDir: string, source: ApplicationSource): string {
  const safe = `${source.chart}-${source.targetRevision}`.replace(/[^A-Za-z0-9._-]/g, "_");
  return join(cacheDir, `${safe}.tgz`);
}

/**
 * Render one Application the way ArgoCD would: the chart at its PINNED
 * targetRevision, templated against that Application's own valuesObject.
 *
 * Not "close enough to" ArgoCD — the pin and the values are the two things that
 * decide whether a declared number reaches a PVC, and both come from the
 * manifest. Chart archives are cached by (chart, version) so a re-run is local.
 */
export function renderApplication(source: ApplicationSource, options: RenderOptions = {}): RenderResult {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  if (source.kind === "git-path") return renderGitPath(source, repoRoot, options.manifestOverlays ?? []);

  const cacheDir = options.cacheDir ?? join(repoRoot, ".helm-render-cache");
  mkdirSync(cacheDir, { recursive: true });
  const helm = options.runHelm ?? defaultRunHelm(options.helmBin ?? "helm", options.timeoutMs ?? 180_000);

  if (source.targetRevision.trim() === "") {
    return { ok: false, reason: "no-pinned-version", detail: `${source.chart} has no targetRevision` };
  }

  const archive = chartArchivePath(cacheDir, source);
  // ATTEMPT the cached read; do not `existsSync` first. The check-then-use pair
  // is a TOCTOU window (`js/file-system-race`, and the repo's own
  // `lint-check-then-use-file-races`): between the check and the write the path
  // can be created, deleted or replaced, so the answer the check returned is
  // already stale. One syscall, one answer — a miss IS the ENOENT.
  if (!archiveIsCached(archive)) {
    // Pull into a per-chart scratch directory rather than guessing the archive
    // name. `helm pull node-feature-discovery` writes
    // `node-feature-discovery-chart-0.17.1.tgz` -- the PACKAGED chart name, not
    // the name the repository index is keyed by -- so a guessed filename
    // reports "pull produced nothing" for a chart that pulled fine. That is an
    // UNRENDERABLE verdict manufactured by the checker, which is the one thing
    // an unrenderable list must never contain.
    const scratch = join(cacheDir, `pull-${source.appId.replace(/[^A-Za-z0-9._-]/g, "_")}`);
    rmSync(scratch, { recursive: true, force: true });
    mkdirSync(scratch, { recursive: true });
    const isOci = !source.repoURL.startsWith("http");
    const pullArgs = isOci
      ? [
          "pull",
          `oci://${source.repoURL}/${source.chart}`,
          "--version",
          source.targetRevision,
          "--destination",
          scratch,
        ]
      : ["pull", "--repo", source.repoURL, source.chart, "--version", source.targetRevision, "--destination", scratch];
    const pulled = helm(pullArgs, cacheDir);
    if (pulled.status !== 0) {
      return {
        ok: false,
        reason: "helm-pull-failed",
        detail: `${source.chart}@${source.targetRevision} from ${source.repoURL}: ${pulled.stderr.trim().split("\n").slice(0, 3).join(" / ")}`,
      };
    }
    const produced = readdirSync(scratch).filter((entry) => entry.endsWith(".tgz"));
    if (produced.length !== 1) {
      return {
        ok: false,
        reason: "helm-pull-produced-nothing",
        detail: `${source.chart}@${source.targetRevision}: pull reported success and left ${String(produced.length)} archives`,
      };
    }
    // `renameSync` rather than read-then-write: one syscall that either moves
    // the archive into the cache or fails, with no window in which the bytes
    // exist under two names or under neither.
    renameSync(join(scratch, produced[0] ?? ""), archive);
    rmSync(scratch, { recursive: true, force: true });
  }

  const valuesFile = join(cacheDir, `values-${source.appId.replace(/[^A-Za-z0-9._-]/g, "_")}.yaml`);
  writeFileSync(valuesFile, yamlStringify(source.valuesObject ?? {}), "utf8");
  const templated = helm(
    [
      "template",
      source.releaseName,
      archive,
      "--namespace",
      source.namespace,
      "--values",
      valuesFile,
      "--include-crds",
    ],
    cacheDir,
  );
  if (templated.status !== 0) {
    return {
      ok: false,
      reason: "helm-template-failed",
      detail: `${source.chart}@${source.targetRevision}: ${templated.stderr.trim().split("\n").slice(0, 4).join(" / ")}`,
    };
  }
  const documents: Record<string, unknown>[] = [];
  for (const doc of parseAllDocuments(templated.stdout)) {
    const obj = doc.toJS() as Record<string, unknown> | null;
    if (obj !== null && typeof obj === "object") documents.push(obj);
  }
  return { ok: true, documents };
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export type PvcOrigin = "PersistentVolumeClaim" | "volumeClaimTemplate" | "operatorStorageSpec";

export interface RenderedPvc {
  readonly appId: string;
  readonly origin: PvcOrigin;
  /** The PVC name (standalone) or `<template>/<workload>` (volumeClaimTemplate). */
  readonly name: string;
  /** For a volumeClaimTemplate: the workload kind and name it hangs off. */
  readonly workload: string;
  /** `""` when the manifest sets no storageClassName — which is NOT the same as "default". */
  readonly storageClassName: string;
  readonly size: string;
  /**
   * `null` when the rendered quantity could not be parsed. NOT zero: an
   * unparseable size is an UNKNOWN, and counting an unknown as zero is how a
   * disk consumer becomes invisible. Every consumer of this field has to say
   * what it does with `null`, and none of them may treat it as free.
   */
  readonly gibibytes: number | null;
  /** How many PVC objects this entry provisions: 1 standalone, `replicas` for a template. */
  readonly count: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function claimShape(spec: Record<string, unknown>): { storageClassName: string; size: string } {
  const resources = asRecord(spec["resources"]);
  const requests = asRecord(resources["requests"]);
  return {
    storageClassName: typeof spec["storageClassName"] === "string" ? spec["storageClassName"] : "",
    size: typeof requests["storage"] === "string" ? requests["storage"] : String(requests["storage"] ?? ""),
  };
}

/**
 * Every PersistentVolumeClaim a render produces, standalone AND templated.
 *
 * `volumeClaimTemplates` is where most of them live and where the count is: a
 * StatefulSet with `replicas: 3` provisions three PVCs per template, and an
 * absent `replicas` means one (the Kubernetes default), not zero.
 */
export function extractRenderedPvcs(
  appId: string,
  documents: readonly Record<string, unknown>[],
): readonly RenderedPvc[] {
  const out: RenderedPvc[] = [];
  for (const doc of documents) {
    const kind = typeof doc["kind"] === "string" ? doc["kind"] : "";
    const metadata = asRecord(doc["metadata"]);
    const name = typeof metadata["name"] === "string" ? metadata["name"] : "";
    const spec = asRecord(doc["spec"]);
    if (kind === "PersistentVolumeClaim") {
      const shape = claimShape(spec);
      out.push({
        appId,
        origin: "PersistentVolumeClaim",
        name,
        workload: "",
        storageClassName: shape.storageClassName,
        size: shape.size,
        gibibytes: shape.size === "" ? null : quantityToGib(shape.size),
        count: 1,
      });
      continue;
    }
    const replicas = typeof spec["replicas"] === "number" ? spec["replicas"] : 1;

    // OPERATOR CRs. kube-prometheus-stack renders NO PersistentVolumeClaim for
    // prometheus or alertmanager: the volume lives at
    // `spec.storage.volumeClaimTemplate` inside a `Prometheus` /
    // `Alertmanager` custom resource, and prometheus-operator creates the real
    // StatefulSet (and therefore the PVCs) at runtime. Reading only the two
    // shapes above would have reported both rows as "declared, never rendered"
    // -- a false conviction, and the mirror image of the failure this module
    // exists to catch. Matched by SHAPE (`spec.storage.volumeClaimTemplate`)
    // rather than by a hardcoded kind list, so a different operator with the
    // same convention is seen too.
    const storageSpec = asRecord(spec["storage"]);
    const operatorTemplate = storageSpec["volumeClaimTemplate"];
    if (operatorTemplate !== undefined && operatorTemplate !== null) {
      const shape = claimShape(asRecord(asRecord(operatorTemplate)["spec"]));
      out.push({
        appId,
        origin: "operatorStorageSpec",
        name: `storage/${name}`,
        workload: `${kind}/${name}`,
        storageClassName: shape.storageClassName,
        size: shape.size,
        gibibytes: shape.size === "" ? null : quantityToGib(shape.size),
        count: replicas,
      });
    }

    const templates = spec["volumeClaimTemplates"];
    if (!Array.isArray(templates)) continue;
    for (const template of templates) {
      const record = asRecord(template);
      const templateMeta = asRecord(record["metadata"]);
      const templateName = typeof templateMeta["name"] === "string" ? templateMeta["name"] : "";
      const shape = claimShape(asRecord(record["spec"]));
      out.push({
        appId,
        origin: "volumeClaimTemplate",
        name: `${templateName}/${name}`,
        workload: `${kind}/${name}`,
        storageClassName: shape.storageClassName,
        size: shape.size,
        gibibytes: shape.size === "" ? null : quantityToGib(shape.size),
        count: replicas,
      });
    }
  }
  return [...out].sort((a, b) => stringCompare(a.name, b.name) || stringCompare(a.workload, b.workload));
}

// ---------------------------------------------------------------------------
// The cluster's default StorageClass
// ---------------------------------------------------------------------------
//
// MOVED to `cluster-default-storage-class.ts` on 2026-08-22 and re-exported
// here, so this module's public surface is unchanged. It moved because
// `single-node-readiness.ts` now resolves a blank class the same way, and a
// second copy of the reading would let the two oracles drift apart on the one
// term that has to mean the same thing in both.

export {
  DEFAULT_STORAGE_CLASS_SOURCE,
  clusterDefaultStorageClass,
  effectiveStorageClass,
} from "./cluster-default-storage-class.ts";


// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export type MismatchKind =
  | "declared-never-rendered"
  | "size-mismatch"
  | "storage-class-mismatch"
  | "pod-count-mismatch"
  | "undeclared-rendered-pvc"
  | "unknown-default-storage-class"
  | "unparseable-rendered-size";

export interface RenderedFinding extends ProfileFinding {
  readonly kind: MismatchKind;
  /** Stable identity a baseline entry is keyed on. Never a line number. */
  readonly key: string;
  /** Signed GiB the render differs from the declaration by. Positive = the render is BIGGER. */
  readonly deltaGib: number;
}

export interface UnrenderableApp {
  readonly appId: string;
  readonly chart: string;
  readonly targetRevision: string;
  readonly reason: string;
  readonly detail: string;
  /** Claim ids the failure leaves UNCHECKED. */
  readonly unchecked: readonly string[];
}

/** What the catalogue says one row will produce, at one rung. */
export interface DeclaredExpectation {
  readonly claimId: string;
  readonly app: string;
  readonly pattern: string;
  readonly size: string;
  readonly gibibytes: number;
  readonly storageClass: string;
  readonly pods: number;
}

function readManifestScalar(repoRoot: string, path: string, docIndex: number, field: string): string {
  const text = readIfPresent(resolve(repoRoot, path));
  if (text === null) return "";
  const docs = parseAllDocuments(text);
  const doc = docs[docIndex];
  if (doc === undefined) return "";
  let node: unknown = doc.toJS();
  for (const segment of parseFieldPathLocal(field)) {
    if (node === null || node === undefined) return "";
    node = typeof segment === "number" ? (node as unknown[])[segment] : (node as Record<string, unknown>)[segment];
  }
  return node === undefined || node === null ? "" : String(node);
}

/** Local copy of the catalogue's coordinate parser — same grammar, no import cycle risk. */
function parseFieldPathLocal(field: string): readonly (string | number)[] {
  const out: (string | number)[] = [];
  for (const part of field.split(".")) {
    const match = /^([^[\]]*)((?:\[\d+\])*)$/.exec(part);
    if (match === null) throw new Error(`malformed field path: ${field}`);
    if ((match[1] ?? "") !== "") out.push(match[1] ?? "");
    for (const index of (match[2] ?? "").matchAll(/\[(\d+)\]/g)) out.push(Number(index[1]));
  }
  return out;
}

/** The catalogue's rows, resolved to what they claim a render will contain at `profile`. */
export function declaredExpectations(
  catalogue: ProfileCatalogue,
  profile: string,
  repoRoot = REPO_ROOT,
): readonly DeclaredExpectation[] {
  return catalogue.claims.map((claim: ProfileClaim) => {
    const size = claim.sizes[profile] ?? "";
    return {
      claimId: claim.id,
      app: claim.renderedApp,
      pattern: claim.renderedPvcPattern,
      size,
      // `loadCatalogue` already refuses a row whose size is not a positive
      // quantity, so this `?? 0` is unreachable rather than lenient — the
      // refusal happens one layer up and is tested there.
      gibibytes: size === "" ? 0 : (quantityToGib(size) ?? 0),
      storageClass: readManifestScalar(repoRoot, claim.path, claim.docIndex, claim.storageClassField),
      pods: claim.pods[profile] ?? 0,
    };
  });
}

/**
 * The rung THIS deployment runs, from the ledger rather than from the ladder.
 *
 * Defaulting to the last profile would audit `large` — a planning ceiling
 * nothing applies — and report a 1599 GiB declaration against an 861 GiB
 * render as if that gap were a defect. The gap the operator cares about is at
 * the rung the cluster is actually on, and `single-node-budget.json` is where
 * that is recorded.
 */
export function activeStorageProfile(repoRoot = REPO_ROOT): string | null {
  const text = readIfPresent(resolve(repoRoot, "full-ai-cluster/k8s/single-node-budget.json"));
  if (text === null) return null;
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return typeof parsed["activeStorageProfile"] === "string" ? parsed["activeStorageProfile"] : null;
}

export interface ComparisonInput {
  readonly expectations: readonly DeclaredExpectation[];
  readonly rendered: readonly RenderedPvc[];
  readonly unrenderable: readonly UnrenderableApp[];
  readonly clusterDefault: string | null;
}

/**
 * Both directions, and the second one is not optional.
 *
 *   1. a declared claim whose pattern matches no rendered PVC
 *   2. a rendered PVC matched by no declared claim
 *
 * Direction 1 alone lets an undeclared volume eat the disk unseen; direction 2
 * alone lets a stale row inflate a total nobody can spend. A checker with only
 * one of them reads as a check and is half of one.
 *
 * Apps that could not be RENDERED contribute neither: their claims are reported
 * as unchecked by the caller, never folded into the matched set. An app that
 * could not be checked must not read as an app that passed.
 */
export function compareRenderedToDeclared(input: ComparisonInput): readonly RenderedFinding[] {
  const findings: RenderedFinding[] = [];
  const unrenderableApps = new Set(input.unrenderable.map((entry) => entry.appId));
  const matchedRendered = new Set<RenderedPvc>();

  for (const expectation of input.expectations) {
    if (unrenderableApps.has(expectation.app)) continue;
    const regex = new RegExp(expectation.pattern);
    const hits = input.rendered.filter((pvc) => pvc.appId === expectation.app && regex.test(pvc.name));
    if (hits.length === 0) {
      findings.push({
        kind: "declared-never-rendered",
        key: `declared ${expectation.claimId}`,
        claimId: expectation.claimId,
        deltaGib: -expectation.gibibytes * expectation.pods,
        problem:
          `declares ${expectation.size} on "${expectation.storageClass || "<unset>"}" x${String(expectation.pods)} ` +
          `pods, but rendering ${expectation.app} produces NO PersistentVolumeClaim matching ` +
          `/${expectation.pattern}/ — the row governs a path that does not exist, and its ` +
          `${(expectation.gibibytes * expectation.pods).toFixed(0)} GiB are counted against nothing`,
      });
      continue;
    }
    for (const hit of hits) matchedRendered.add(hit);
    const renderedPods = hits.reduce((sum, hit) => sum + hit.count, 0);
    // An unparseable rendered quantity is UNKNOWN, and an unknown folded into a
    // sum as zero is a disk consumer that vanishes from the total. Refuse it
    // and stop comparing this row rather than arithmetic over a hole.
    const unparseable = hits.filter((hit) => hit.gibibytes === null);
    if (unparseable.length > 0) {
      findings.push({
        kind: "unparseable-rendered-size",
        key: `unparseable ${expectation.claimId}`,
        claimId: expectation.claimId,
        deltaGib: 0,
        problem:
          `the chart renders ${unparseable.map((hit) => `${hit.name}="${hit.size}"`).join(", ")} — not a parseable ` +
          `Kubernetes quantity, so the capacity is UNKNOWN and is refused rather than folded in as zero`,
      });
      continue;
    }
    const renderedGib = hits.reduce((sum, hit) => sum + (hit.gibibytes ?? 0) * hit.count, 0);

    const distinctSizes = [...new Set(hits.map((hit) => hit.size))];
    if (distinctSizes.length !== 1 || distinctSizes[0] !== expectation.size) {
      findings.push({
        kind: "size-mismatch",
        key: `size ${expectation.claimId}`,
        claimId: expectation.claimId,
        deltaGib: renderedGib - expectation.gibibytes * expectation.pods,
        problem:
          `declares ${expectation.size}, but the chart renders ${distinctSizes.join(" + ")} at ` +
          `${hits.map((hit) => hit.name).join(", ")} — the declared number never reaches the PVC`,
      });
    }

    const declaredClass = expectation.storageClass;
    for (const hit of hits) {
      const effective = effectiveStorageClass(hit.storageClassName, input.clusterDefault);
      if (effective === null) {
        findings.push({
          kind: "unknown-default-storage-class",
          key: `default-class ${expectation.claimId} ${hit.name}`,
          claimId: expectation.claimId,
          deltaGib: 0,
          problem:
            `${hit.name} renders with NO storageClassName and the tree declares no default StorageClass, so ` +
            `which disk it lands on is UNKNOWN — refused rather than assumed to be "${declaredClass}"`,
        });
        continue;
      }
      if (effective === declaredClass) continue;
      findings.push({
        kind: "storage-class-mismatch",
        key: `class ${expectation.claimId} ${hit.name}`,
        claimId: expectation.claimId,
        deltaGib: 0,
        problem:
          `declares storageClass "${declaredClass}", but ${hit.name} renders ` +
          `${hit.storageClassName === "" ? `NO storageClassName, so it binds the cluster default "${effective}"` : `"${hit.storageClassName}"`}` +
          ` — a different disk, and on a Delete-reclaim local class a different durability`,
      });
    }

    if (renderedPods !== expectation.pods) {
      findings.push({
        kind: "pod-count-mismatch",
        key: `pods ${expectation.claimId}`,
        claimId: expectation.claimId,
        deltaGib: renderedGib - expectation.gibibytes * expectation.pods,
        problem:
          `declares ${String(expectation.pods)} pod(s), but the chart renders ${String(renderedPods)} ` +
          `(${hits.map((hit) => `${hit.name} x${String(hit.count)}`).join(", ")}) — ` +
          `a claim's cost is size x pod count, so the total is off by ` +
          `${(renderedGib - expectation.gibibytes * expectation.pods).toFixed(0)} GiB`,
      });
    }
  }

  for (const pvc of input.rendered) {
    if (matchedRendered.has(pvc)) continue;
    const effective = effectiveStorageClass(pvc.storageClassName, input.clusterDefault);
    const gib = pvc.gibibytes === null ? null : pvc.gibibytes * pvc.count;
    findings.push({
      kind: "undeclared-rendered-pvc",
      key: `undeclared ${pvc.appId} ${pvc.name}`,
      claimId: `${pvc.appId} (${pvc.name})`,
      deltaGib: gib ?? 0,
      problem:
        `the chart renders a PersistentVolumeClaim of ${pvc.size} x${String(pvc.count)} on ` +
        `"${effective ?? "<unknown default>"}"${pvc.storageClassName === "" ? " (no storageClassName; cluster default)" : ""} ` +
        `that NO catalogue row covers — ${gib === null ? "an UNPARSEABLE amount" : `${gib.toFixed(0)} GiB`} of real ` +
        `disk that no profile total includes`,
    });
  }

  return [...findings].sort((a, b) => stringCompare(a.key, b.key));
}

// ---------------------------------------------------------------------------
// Baseline — grandfathering, keyed by identity, with a reason and an exit
// ---------------------------------------------------------------------------

/**
 * One acknowledged finding.
 *
 * `key` is the finding's stable identity (app + claim identity), never a line
 * number: a file that grows a line must not silently re-arm or re-suppress a
 * different defect. `observed` PINS what was acknowledged — the size and class
 * as measured on the day — so an entry stops covering the finding the moment
 * the render changes. A baseline that keeps matching after the thing it excused
 * has moved is the vacuity class with a filename.
 *
 * `liftsWhen` is required and is not decoration: an acknowledgement with no
 * stated exit is a permanent exemption wearing a temporary word.
 */
export interface BaselineEntry {
  readonly key: string;
  readonly reason: string;
  readonly liftsWhen: string;
  readonly observed: string;
}

export interface Baseline {
  readonly findings: readonly BaselineEntry[];
  /** Keyed `<appId>@<targetRevision>`, so a version bump invalidates rather than inherits. */
  readonly unrenderable: readonly BaselineEntry[];
}

export function loadBaseline(path = DEFAULT_BASELINE_PATH, repoRoot = REPO_ROOT): Baseline {
  const text = readIfPresent(resolve(repoRoot, path));
  if (text === null) return { findings: [], unrenderable: [] };
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const read = (field: string): BaselineEntry[] => {
    const raw = parsed[field];
    if (!Array.isArray(raw)) return [];
    return raw.map((entry, index) => {
      const record = entry as Record<string, unknown>;
      for (const required of ["key", "reason", "liftsWhen", "observed"]) {
        if (typeof record[required] !== "string" || (record[required] as string).trim() === "") {
          throw new Error(
            `${path}: ${field}[${String(index)}] has no "${required}" — an acknowledgement without one is an ` +
              `exemption nobody can audit or retire`,
          );
        }
      }
      return {
        key: record["key"] as string,
        reason: record["reason"] as string,
        liftsWhen: record["liftsWhen"] as string,
        observed: record["observed"] as string,
      };
    });
  };
  return { findings: read("findings"), unrenderable: read("unrenderable") };
}

export interface Adjudicated {
  readonly refused: readonly RenderedFinding[];
  readonly acknowledged: readonly RenderedFinding[];
  /** Baseline entries that matched nothing — stale, and refused in their own right. */
  readonly staleBaselineKeys: readonly string[];
}

/**
 * Split findings against the baseline, and refuse a STALE entry too.
 *
 * An acknowledgement that no longer matches anything is not harmless: it is a
 * claim about the tree that has stopped being true, and leaving it in place is
 * how a baseline becomes a wish list. Same refusal the catalogue already makes
 * of a row matching no claim.
 */
export function adjudicate(findings: readonly RenderedFinding[], baseline: Baseline): Adjudicated {
  const byKey = new Map(baseline.findings.map((entry) => [entry.key, entry]));
  const used = new Set<string>();
  const refused: RenderedFinding[] = [];
  const acknowledged: RenderedFinding[] = [];
  for (const finding of findings) {
    const entry = byKey.get(finding.key);
    if (entry === undefined) {
      refused.push(finding);
      continue;
    }
    used.add(entry.key);
    if (entry.observed !== finding.problem) {
      refused.push({
        ...finding,
        problem:
          `${finding.problem}\n      (acknowledged, but what was acknowledged has CHANGED — the baseline pinned: ` +
          `${entry.observed})`,
      });
      continue;
    }
    acknowledged.push(finding);
  }
  const stale = baseline.findings.filter((entry) => !used.has(entry.key)).map((entry) => entry.key);
  return { refused, acknowledged, staleBaselineKeys: [...stale].sort((a, b) => stringCompare(a, b)) };
}

/**
 * Acknowledged UNRENDERABLE apps that no longer match anything.
 *
 * `adjudicate` above computes staleness over `baseline.findings` only. The
 * `unrenderable` list had no equivalent, so a chart that STARTED rendering left
 * its acknowledgement behind and the gate stayed green — while the baseline
 * file's own `$comment` says "STALE ENTRIES FAIL. An entry matching nothing is
 * a claim about the tree that stopped being true, and it is refused exactly
 * like a catalogue row matching no claim." That sentence was true of one of the
 * two lists.
 *
 * MEASURED 2026-08-22 while wiring temporal's datastore: the change's whole
 * point was to RETIRE `full-ai-cluster/temporal@0.59.0` from that list, and
 * re-adding the retired entry as a mutation was NOT refused. Nothing in the
 * repo would have made anyone delete it — the acknowledgement would simply have
 * kept asserting that a chart which renders does not, forever, in a file whose
 * job is to be believed.
 *
 * FOUND TWICE, INDEPENDENTLY, ON THE SAME DAY. The unrenderable-apps change
 * reached this hole from the other side — it retired FOUR entries by hand and
 * noticed nothing had required the hand — and the two branches met in a merge.
 * That is worth recording rather than smoothing over: two agents auditing
 * different apps derived the same missing check, which is the strongest evidence
 * available that it was missing. The two implementations are folded into one
 * here rather than kept side by side, because two copies of a rule are two
 * copies free to drift.
 *
 * Keyed `<appId>@<targetRevision>`, matching the acknowledgement lookup, so
 * bumping a pin invalidates the old entry rather than letting it inherit.
 */
export function staleUnrenderableKeys(baseline: Baseline, unrenderable: readonly UnrenderableApp[]): readonly string[] {
  const live = new Set(unrenderable.map((app) => `${app.appId}@${app.targetRevision}`));
  return baseline.unrenderable.filter((entry) => !live.has(entry.key)).map((entry) => entry.key);
}

export interface AdjudicatedUnrenderable {
  /** Apps whose failure NO baseline entry covers — including ones covered by a DISAGREEING entry. */
  readonly unacknowledged: readonly UnrenderableApp[];
  /** `unrenderable` baseline keys that matched no still-unrenderable app. Stale, and refused. */
  readonly staleKeys: readonly string[];
}

/**
 * Adjudicate the UNRENDERABLE list the same way findings are adjudicated.
 *
 * Staleness is `staleUnrenderableKeys` above — ONE implementation, called from
 * here, not a second one that agrees today. What this adds is the other half of
 * the same hole:
 *
 *   `observed` WAS INERT ON THIS LIST. Every unrenderable entry carries one
 *   (they read `helm-pull-failed`, `helm-template-failed`), the loader REQUIRES
 *   it non-empty, and nothing ever compared it. So an app could stop failing at
 *   `helm-pull` — the pin resolves now — and start failing at `helm-template`
 *   for an entirely unrelated reason, and the acknowledgement written about the
 *   FIRST defect would go on quietly covering the SECOND. That is the vacuity
 *   class inside the file whose own header calls a baseline that keeps matching
 *   after the thing it excused has moved "the vacuity class with a filename".
 *   It was true of the findings half and not of this one.
 *
 * WHAT `observed` IS COMPARED AGAINST, and why it is the REASON and not the
 * DETAIL. The reason is the failure CLASS — `helm-pull-failed` means the pin
 * names nothing a registry serves; `helm-template-failed` means the chart is
 * there and our values are wrong. Those are the two classes an operator has to
 * tell apart, and they need different fixes. The detail is upstream's stderr:
 * it carries template line numbers and helm's own phrasing, so pinning it would
 * re-red the gate on a helm upgrade that changed nothing about the tree. Class
 * is checked; detail is reported.
 */
export function adjudicateUnrenderable(
  unrenderable: readonly UnrenderableApp[],
  baseline: Baseline,
): AdjudicatedUnrenderable {
  const byKey = new Map(baseline.unrenderable.map((entry) => [entry.key, entry]));
  const unacknowledged: UnrenderableApp[] = [];
  for (const app of unrenderable) {
    const entry = byKey.get(`${app.appId}@${app.targetRevision}`);
    if (entry === undefined) {
      unacknowledged.push(app);
      continue;
    }
    if (entry.observed !== app.reason) {
      unacknowledged.push({
        ...app,
        detail:
          `${app.detail}\n      (acknowledged, but this is a DIFFERENT failure than the one acknowledged — ` +
          `the baseline pinned "${entry.observed}" and this is "${app.reason}")`,
      });
    }
  }
  return { unacknowledged, staleKeys: staleUnrenderableKeys(baseline, unrenderable) };
}

// ---------------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------------

export interface AuditResult {
  readonly profile: string;
  readonly appsDiscovered: number;
  readonly appsRendered: number;
  readonly unrenderable: readonly UnrenderableApp[];
  readonly unacknowledgedUnrenderable: readonly UnrenderableApp[];
  readonly rendered: readonly RenderedPvc[];
  readonly expectations: readonly DeclaredExpectation[];
  readonly refused: readonly RenderedFinding[];
  readonly acknowledged: readonly RenderedFinding[];
  readonly staleBaselineKeys: readonly string[];
  readonly clusterDefault: string | null;
}

export interface AuditOptions extends RenderOptions {
  readonly cataloguePath?: string | undefined;
  readonly baselinePath?: string | undefined;
  readonly profile?: string | undefined;
}

export function auditRenderedStorageClaims(options: AuditOptions = {}): AuditResult {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const catalogue = loadCatalogue(options.cataloguePath, repoRoot);
  const profile =
    options.profile ?? activeStorageProfile(repoRoot) ?? catalogue.profiles[catalogue.profiles.length - 1] ?? "";
  const baseline = loadBaseline(options.baselinePath, repoRoot);
  const expectations = declaredExpectations(catalogue, profile, repoRoot);

  const claimsByApp = new Map<string, string[]>();
  for (const expectation of expectations) {
    claimsByApp.set(expectation.app, [...(claimsByApp.get(expectation.app) ?? []), expectation.claimId]);
  }

  const rendered: RenderedPvc[] = [];
  const unrenderable: UnrenderableApp[] = [];
  const sources = discoverApplications(repoRoot);
  for (const source of sources) {
    const result = renderApplication(source, { ...options, repoRoot });
    if (!result.ok) {
      unrenderable.push({
        appId: source.appId,
        chart: source.chart,
        targetRevision: source.targetRevision,
        reason: result.reason,
        detail: result.detail,
        unchecked: claimsByApp.get(source.appId) ?? [],
      });
      continue;
    }
    rendered.push(...extractRenderedPvcs(source.appId, result.documents));
  }

  const findings = compareRenderedToDeclared({
    expectations,
    rendered,
    unrenderable,
    clusterDefault: clusterDefaultStorageClass(repoRoot),
  });
  const adjudicated = adjudicate(findings, baseline);

  const adjudicatedUnrenderable = adjudicateUnrenderable(unrenderable, baseline);

  return {
    profile,
    appsDiscovered: sources.length,
    appsRendered: sources.length - unrenderable.length,
    unrenderable,
    unacknowledgedUnrenderable: adjudicatedUnrenderable.unacknowledged,
    rendered,
    expectations,
    refused: adjudicated.refused,
    acknowledged: adjudicated.acknowledged,
    staleBaselineKeys: [...adjudicated.staleBaselineKeys, ...adjudicatedUnrenderable.staleKeys].sort((a, b) =>
      stringCompare(a, b),
    ),
    clusterDefault: clusterDefaultStorageClass(repoRoot),
  };
}

/** GiB the RENDER actually asks for, by effective storage class. */
export function renderedTotalsByClass(
  rendered: readonly RenderedPvc[],
  clusterDefault: string | null,
): ReadonlyMap<string, number> {
  const totals = new Map<string, number>();
  for (const pvc of rendered) {
    const key = effectiveStorageClass(pvc.storageClassName, clusterDefault) ?? "<unknown default>";
    // An unparseable size is counted under its own key, never silently added as
    // zero to a class total that then reads as complete.
    const bucket = pvc.gibibytes === null ? `${key} (UNPARSEABLE SIZE)` : key;
    totals.set(bucket, (totals.get(bucket) ?? 0) + (pvc.gibibytes ?? 0) * pvc.count);
  }
  return totals;
}

/** GiB the CATALOGUE declares for a set of rows. */
export function declaredTotalGib(expectations: readonly DeclaredExpectation[]): number {
  return expectations.reduce((sum, entry) => sum + entry.gibibytes * entry.pods, 0);
}

export function auditExitCode(result: AuditResult): number {
  return result.refused.length > 0 ||
    result.unacknowledgedUnrenderable.length > 0 ||
    result.staleBaselineKeys.length > 0
    ? 1
    : 0;
}

// ---------------------------------------------------------------------------
// The measured snapshot — so the gate runs OFFLINE and deterministically
// ---------------------------------------------------------------------------

export const DEFAULT_SNAPSHOT_PATH = "src/Core.TypeScript/cluster/rendered-storage-claims.snapshot.json";

export interface RenderSnapshot {
  readonly measuredOn: string;
  readonly clusterDefaultStorageClass: string | null;
  readonly rendered: readonly RenderedPvc[];
  readonly unrenderable: readonly UnrenderableApp[];
  readonly appsDiscovered: number;
}

/**
 * WHY A SNAPSHOT AND NOT JUST THE LIVE RENDER.
 *
 * A gate that needs `helm pull` needs the network, an upstream repository that
 * is still serving the pinned tag, and ~2 minutes. Three ways to be
 * unavailable, and an unavailable gate is skipped, and a skipped gate reads
 * like a passing one. `clone-at-tag-stays-sufficient` says the same thing from
 * the other end: the tree has to be checkable from a clone with nothing
 * installed.
 *
 * So the measurement and the check are split by change rate (DV2.0): the
 * SNAPSHOT is what `helm template` produced, dated and pinned, checked in as
 * TEXT so every byte of it is a readable diff; the CHECK compares the catalogue
 * against it offline and deterministically. Editing a declaration without
 * re-measuring goes red in CI with no network at all.
 *
 * The snapshot is not trusted blindly: `--check-snapshot` re-renders live and
 * refuses any drift, which is what stops it from becoming a comfortable fiction
 * that outlives the charts it describes.
 */
export function loadSnapshot(path = DEFAULT_SNAPSHOT_PATH, repoRoot = REPO_ROOT): RenderSnapshot | null {
  const text = readIfPresent(resolve(repoRoot, path));
  if (text === null) return null;
  return JSON.parse(text) as RenderSnapshot;
}

export function writeSnapshot(snapshot: RenderSnapshot, path = DEFAULT_SNAPSHOT_PATH, repoRoot = REPO_ROOT): void {
  const abs = resolve(repoRoot, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

/** Live render vs the checked-in snapshot, as a list of human-readable differences. */
export function snapshotDrift(live: RenderSnapshot, snapshot: RenderSnapshot): readonly string[] {
  const drift: string[] = [];
  const key = (pvc: RenderedPvc): string => `${pvc.appId} ${pvc.name}`;
  const liveByKey = new Map(live.rendered.map((pvc) => [key(pvc), pvc]));
  const snapByKey = new Map(snapshot.rendered.map((pvc) => [key(pvc), pvc]));
  for (const [id, pvc] of liveByKey) {
    const was = snapByKey.get(id);
    if (was === undefined) {
      drift.push(
        `NEW rendered PVC not in the snapshot: ${id} (${pvc.size} x${String(pvc.count)} on "${pvc.storageClassName || "<default>"}")`,
      );
      continue;
    }
    if (was.size !== pvc.size || was.count !== pvc.count || was.storageClassName !== pvc.storageClassName) {
      drift.push(
        `CHANGED ${id}: snapshot ${was.size} x${String(was.count)} on "${was.storageClassName || "<default>"}" -> ` +
          `live ${pvc.size} x${String(pvc.count)} on "${pvc.storageClassName || "<default>"}"`,
      );
    }
  }
  for (const id of snapByKey.keys()) {
    if (!liveByKey.has(id)) drift.push(`GONE from the render but still in the snapshot: ${id}`);
  }
  const liveUnrenderable = new Set(live.unrenderable.map((app) => `${app.appId}@${app.targetRevision}`));
  const snapUnrenderable = new Set(snapshot.unrenderable.map((app) => `${app.appId}@${app.targetRevision}`));
  for (const id of liveUnrenderable) if (!snapUnrenderable.has(id)) drift.push(`NEWLY unrenderable: ${id}`);
  for (const id of snapUnrenderable) if (!liveUnrenderable.has(id)) drift.push(`NO LONGER unrenderable: ${id}`);
  // COVERAGE, not content -- and it was missing (081M0KRQP56087G0R000BK28QS).
  //
  // Everything above compares the ROWS, so an Application that renders no
  // PersistentVolumeClaim at all is invisible to every one of those loops. On
  // 2026-08-22 the tree grew `spire-crds` (#13488), which renders none; the
  // snapshot went on saying `appsDiscovered: 53` against a tree of 54, and
  // `--check-snapshot` printed "snapshot matches the live render" -- true of the
  // rows and false of the scope. A snapshot that no longer covers the tree is
  // the load-bearing artifact for two offline gates, and under-coverage is
  // precisely a check that did not run wearing the face of one that passed.
  if (live.appsDiscovered !== snapshot.appsDiscovered) {
    drift.push(
      `COVERAGE: the snapshot measured ${String(snapshot.appsDiscovered)} Applications, the tree now has ` +
        `${String(live.appsDiscovered)} -- rows can agree while the snapshot no longer covers the tree`,
    );
  }
  return [...drift].sort((a, b) => stringCompare(a, b));
}

/** The audit, run against a snapshot instead of live charts. Same comparison, no network. */
export function auditAgainstSnapshot(
  snapshot: RenderSnapshot,
  options: {
    cataloguePath?: string | undefined;
    baselinePath?: string | undefined;
    profile?: string | undefined;
    repoRoot?: string | undefined;
  } = {},
): AuditResult {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const catalogue = loadCatalogue(options.cataloguePath, repoRoot);
  const profile =
    options.profile ?? activeStorageProfile(repoRoot) ?? catalogue.profiles[catalogue.profiles.length - 1] ?? "";
  const baseline = loadBaseline(options.baselinePath, repoRoot);
  const expectations = declaredExpectations(catalogue, profile, repoRoot);
  const findings = compareRenderedToDeclared({
    expectations,
    rendered: snapshot.rendered,
    unrenderable: snapshot.unrenderable,
    clusterDefault: snapshot.clusterDefaultStorageClass,
  });
  const adjudicated = adjudicate(findings, baseline);
  // The snapshot records WHICH apps failed to render; only the catalogue knows
  // which claims that leaves unchecked, so the join happens here. A snapshot
  // that carried the answer would go stale against a catalogue edit.
  const claimsByApp = new Map<string, string[]>();
  for (const expectation of expectations) {
    claimsByApp.set(expectation.app, [...(claimsByApp.get(expectation.app) ?? []), expectation.claimId]);
  }
  const unrenderable = snapshot.unrenderable.map((app) => ({ ...app, unchecked: claimsByApp.get(app.appId) ?? [] }));
  // SAME adjudication as the live path, not a second one that agrees today.
  // Two copies of this rule would be free to drift, and the offline gate is the
  // one CI actually runs -- so a weaker copy here would be the check that reads
  // like the check that ran.
  const adjudicatedUnrenderable = adjudicateUnrenderable(unrenderable, baseline);
  return {
    profile,
    appsDiscovered: snapshot.appsDiscovered,
    appsRendered: snapshot.appsDiscovered - snapshot.unrenderable.length,
    unrenderable,
    unacknowledgedUnrenderable: adjudicatedUnrenderable.unacknowledged,
    rendered: snapshot.rendered,
    expectations,
    refused: adjudicated.refused,
    acknowledged: adjudicated.acknowledged,
    staleBaselineKeys: [...adjudicated.staleBaselineKeys, ...adjudicatedUnrenderable.staleKeys].sort((a, b) =>
      stringCompare(a, b),
    ),
    clusterDefault: snapshot.clusterDefaultStorageClass,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE =
  "usage: bun src/Core.TypeScript/cluster/rendered-storage-claims.ts [--profile <name>] [--helm <bin>] [--cache-dir <dir>] [--json]\n" +
  "  Renders every Application at its pinned targetRevision with its own valuesObject and\n" +
  "  refuses any declared claim that no rendered PVC matches, any rendered PVC no claim covers,\n" +
  "  and any app that could not be rendered without an acknowledgement.";

export function formatReport(result: AuditResult): string {
  const lines: string[] = [];
  const totals = renderedTotalsByClass(result.rendered, result.clusterDefault);
  lines.push(
    `profile: ${result.profile}   cluster default StorageClass: ${result.clusterDefault ?? "<none declared>"}`,
  );
  lines.push(
    `applications: ${String(result.appsDiscovered)} discovered, ${String(result.appsRendered)} rendered, ` +
      `${String(result.unrenderable.length)} UNRENDERABLE`,
  );
  const uncheckedGib = result.expectations
    .filter((expectation) => result.unrenderable.some((app) => app.appId === expectation.app))
    .reduce((sum, expectation) => sum + expectation.gibibytes * expectation.pods, 0);
  lines.push(
    `declared (catalogue, "${result.profile}"): ${declaredTotalGib(result.expectations).toFixed(0)} GiB across ` +
      `${String(result.expectations.length)} rows, of which ${uncheckedGib.toFixed(0)} GiB is UNCHECKED because ` +
      `the claim's app would not render — not verified, not refuted, and counted as neither`,
  );
  for (const [storageClass, gib] of [...totals].sort((a, b) => stringCompare(a[0], b[0]))) {
    lines.push(`rendered on "${storageClass}": ${gib.toFixed(0)} GiB`);
  }
  if (result.unrenderable.length > 0) {
    lines.push("");
    lines.push("UNRENDERABLE — checked NOTHING here, which is not the same as passing:");
    for (const app of result.unrenderable) {
      const ack = result.unacknowledgedUnrenderable.some((entry) => entry.appId === app.appId)
        ? "UNACKNOWLEDGED"
        : "acknowledged";
      lines.push(`  ${app.appId}@${app.targetRevision} [${app.reason}] ${ack}`);
      lines.push(`      ${app.detail}`);
      if (app.unchecked.length > 0) lines.push(`      leaves UNCHECKED: ${app.unchecked.join(", ")}`);
    }
  }
  if (result.refused.length > 0) {
    lines.push("");
    lines.push(`REFUSED (${String(result.refused.length)}):`);
    for (const finding of result.refused) {
      lines.push(`  [${finding.kind}] ${finding.claimId}`);
      lines.push(`      ${finding.problem}`);
    }
  }
  if (result.acknowledged.length > 0) {
    const declaredSide = result.acknowledged
      .filter((finding) => finding.kind !== "undeclared-rendered-pvc")
      .reduce((sum, finding) => sum + Math.abs(finding.deltaGib), 0);
    const undeclaredSide = result.acknowledged
      .filter((finding) => finding.kind === "undeclared-rendered-pvc")
      .reduce((sum, finding) => sum + finding.deltaGib, 0);
    lines.push("");
    lines.push(
      `acknowledged (${String(result.acknowledged.length)}) — STILL TRUE. An acknowledgement buys a non-red gate, ` +
        `never a smaller number: ${declaredSide.toFixed(0)} GiB of declared capacity does not render as declared, ` +
        `and ${undeclaredSide.toFixed(0)} GiB renders that no row declares.`,
    );
    for (const finding of result.acknowledged) lines.push(`  [${finding.kind}] ${finding.claimId}`);
  }
  if (result.staleBaselineKeys.length > 0) {
    lines.push("");
    lines.push(
      "STALE BASELINE ENTRIES — they match nothing, so they are claims about the tree that stopped being true:",
    );
    for (const key of result.staleBaselineKeys) lines.push(`  ${key}`);
  }
  lines.push("");
  lines.push(
    auditExitCode(result) === 0
      ? result.acknowledged.length === 0
        ? "OK — every declaration corresponds to a rendered PVC, and every rendered PVC to a declaration."
        : `OK — no UNACKNOWLEDGED findings. ${String(result.acknowledged.length)} acknowledged findings above are ` +
          `still true and still cost what they cost; see rendered-storage-claims.baseline.json for why each is ` +
          `open and what lifts it.`
      : "FAILED",
  );
  return lines.join("\n");
}

/** Flags that take NO value. A boolean read as "takes the next argument" eats the flag after it. */
const BOOLEAN_FLAGS = new Set(["--json", "--offline", "--write-snapshot", "--check-snapshot"]);

export function parseArgs(argv: readonly string[]): AuditOptions & { json: boolean } {
  const options: Record<string, string> = {};
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (BOOLEAN_FLAGS.has(arg)) {
      if (arg === "--json") json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
    }
    const match = /^--([a-z-]+)$/.exec(arg);
    if (match?.[1] !== undefined) {
      options[match[1]] = argv[index + 1] ?? "";
      index += 1;
    }
  }
  return {
    json,
    profile: options["profile"],
    helmBin: options["helm"],
    cacheDir: options["cache-dir"],
    cataloguePath: options["catalogue"],
    baselinePath: options["baseline"],
  };
}

/** Render everything live and package it as a snapshot. */
export function measureSnapshot(options: RenderOptions & { repoRoot?: string | undefined } = {}): RenderSnapshot {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const sources = discoverApplications(repoRoot);
  const rendered: RenderedPvc[] = [];
  const unrenderable: UnrenderableApp[] = [];
  for (const source of sources) {
    const result = renderApplication(source, { ...options, repoRoot });
    if (!result.ok) {
      unrenderable.push({
        appId: source.appId,
        chart: source.chart,
        targetRevision: source.targetRevision,
        reason: result.reason,
        detail: result.detail,
        unchecked: [],
      });
      continue;
    }
    rendered.push(...extractRenderedPvcs(source.appId, result.documents));
  }
  return {
    measuredOn: new Date().toISOString().slice(0, 10),
    clusterDefaultStorageClass: clusterDefaultStorageClass(repoRoot),
    rendered,
    unrenderable,
    appsDiscovered: sources.length,
  };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);
  if (argv.includes("--write-snapshot")) {
    writeSnapshot(measureSnapshot(parsed), undefined, parsed.repoRoot);
    process.stdout.write("snapshot written\n");
    process.exit(0);
  }
  if (argv.includes("--check-snapshot")) {
    const snapshot = loadSnapshot(undefined, parsed.repoRoot);
    if (snapshot === null) {
      process.stderr.write("no snapshot checked in — run --write-snapshot\n");
      process.exit(1);
    }
    const drift = snapshotDrift(measureSnapshot(parsed), snapshot);
    if (drift.length === 0) {
      process.stdout.write("snapshot matches the live render\n");
      process.exit(0);
    }
    process.stdout.write(`snapshot DRIFT (${String(drift.length)}):\n${drift.map((line) => `  ${line}`).join("\n")}\n`);
    process.exit(1);
  }
  const offline = argv.includes("--offline");
  const snapshot = offline ? loadSnapshot(undefined, parsed.repoRoot) : null;
  if (offline && snapshot === null) {
    process.stderr.write("--offline needs a checked-in snapshot, and there is none\n");
    process.exit(1);
  }
  const result =
    snapshot === null
      ? auditRenderedStorageClaims(parsed)
      : auditAgainstSnapshot(snapshot, { profile: parsed.profile });
  process.stdout.write(parsed.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatReport(result)}\n`);
  process.exit(auditExitCode(result));
}
