// A git-directory ArgoCD Application that server-side-applies a StatefulSet with
// `volumeClaimTemplates` is permanently OutOfSync -- refuse that pairing offline.
//
// THE DEFECT (argo-cd#11143 / #18568). Under `ServerSideApply=true`, ArgoCD's
// LOCAL diff predicts the live object by running the desired manifest through
// the API server's internal conversion path, and that path adds fields to the
// embedded PersistentVolumeClaim template the manifest never wrote:
//
//   .spec.volumeClaimTemplates[N].apiVersion                 v1
//   .spec.volumeClaimTemplates[N].kind                       PersistentVolumeClaim
//   .spec.volumeClaimTemplates[N].metadata.creationTimestamp null
//
// plus the defaulted `spec.volumeMode: Filesystem` and `status.phase: Pending`
// the live object carries. The last one ArgoCD introduces *downstream* of both
// the manifest and any `ignoreDifferences` normalizer (Go's non-pointer
// `ObjectMeta.CreationTimestamp` marshals as `null`), so neither declaring the
// defaulted fields in the manifest nor an ignore rule can close it -- MEASURED
// as a 2x2 in `full-ai-cluster/k8s/applications/spire/Application.yaml`. The
// Application then reads OutOfSync forever while Healthy, and `selfHeal: true`
// re-applies it on every retry window (every ~5 min, seen live).
//
// THE TWO CLOSURES THIS TREE ALREADY USES, both accepted here:
//   1. drop `ServerSideApply=true` (client-side apply) -- spire, cockroachdb,
//      headscale, hindsight, nats, opensearch, weaviate. Free while every
//      resource is far under the 262144-byte last-applied-configuration cap.
//   2. `argocd.argoproj.io/compare-options: ServerSideDiff=true` -- the diff is
//      then a real dry-run apply, not a local prediction (argo-workflows, keda).
//
// SCOPE, honestly: git-directory Applications only, because their manifests are
// on disk and can be read without a network. A Helm Application's StatefulSets
// exist only after a chart render; those are covered by the per-Application
// comments above, not by this check.

import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import { applicationManifestPaths, includeMatcher } from "./rendered-storage-claims.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export interface SsaVctFinding {
  /** Repo-relative Application.yaml. */
  readonly manifestPath: string;
  readonly application: string;
  /** Repo-relative manifest carrying the StatefulSet. */
  readonly statefulSetFile: string;
  readonly statefulSet: string;
}

/**
 * Applications whose finding is KNOWN and owned elsewhere. Each entry must still
 * produce a finding -- an entry that no longer does is reported as stale, so the
 * list cannot outlive the defect it excuses.
 */
// EMPTY. `platform` (StatefulSet/portal) was the one entry; closed by
// `argocd.argoproj.io/compare-options: ServerSideDiff=true` on
// platform/Application.yaml (081M3JG74G0087G0R001XJC837), keeping SSA for its CRDs.
export const DEFERRED: Readonly<Record<string, string>> = {};

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

function usesServerSideApply(app: Obj): boolean {
  const options = asObj(asObj(app["spec"])["syncPolicy"])["syncOptions"];
  return Array.isArray(options) && options.some((o) => typeof o === "string" && o.trim() === "ServerSideApply=true");
}

function usesServerSideDiff(app: Obj): boolean {
  const compare = asObj(asObj(app["metadata"])["annotations"])["argocd.argoproj.io/compare-options"];
  return typeof compare === "string" && compare.split(",").some((o) => o.trim() === "ServerSideDiff=true");
}

/** StatefulSets with a non-empty `volumeClaimTemplates` in one YAML text. */
export function statefulSetsWithClaimTemplates(text: string): readonly string[] {
  const out: string[] = [];
  for (const doc of parseAllDocuments(text)) {
    const obj = asObj(doc.toJS());
    if (obj["kind"] !== "StatefulSet") continue;
    const vct = asObj(obj["spec"])["volumeClaimTemplates"];
    if (!Array.isArray(vct) || vct.length === 0) continue;
    const name = asObj(obj["metadata"])["name"];
    out.push(typeof name === "string" ? name : "(unnamed)");
  }
  return out;
}

/** Judge one parsed Application against the files its directory source syncs. */
export function findingsForApplication(
  manifestPath: string,
  app: Obj,
  readSyncedFiles: (gitPath: string, include: string) => readonly { path: string; text: string }[],
): readonly SsaVctFinding[] {
  if (app["kind"] !== "Application") return [];
  if (!usesServerSideApply(app) || usesServerSideDiff(app)) return [];
  const spec = asObj(app["spec"]);
  const sources = Array.isArray(spec["sources"]) ? (spec["sources"] as unknown[]) : [spec["source"]];
  const name = asObj(app["metadata"])["name"];
  const application = typeof name === "string" ? name : manifestPath;
  const out: SsaVctFinding[] = [];
  for (const raw of sources) {
    const source = asObj(raw);
    if (typeof source["chart"] === "string" && source["chart"] !== "") continue;
    const gitPath = source["path"];
    if (typeof gitPath !== "string" || gitPath === "") continue;
    const include = asObj(source["directory"])["include"];
    for (const file of readSyncedFiles(gitPath, typeof include === "string" ? include : "")) {
      for (const statefulSet of statefulSetsWithClaimTemplates(file.text)) {
        out.push({ manifestPath, application, statefulSetFile: file.path, statefulSet });
      }
    }
  }
  return out;
}

function readSyncedFilesFromDisk(repoRoot: string) {
  return (gitPath: string, include: string): readonly { path: string; text: string }[] => {
    const matches = includeMatcher(include);
    let names: string[];
    try {
      names = readdirSync(resolve(repoRoot, gitPath));
    } catch {
      return [];
    }
    return names
      .filter((n) => (n.endsWith(".yaml") || n.endsWith(".yml")) && basename(n) !== "Application.yaml" && matches(n))
      .sort()
      .map((n) => ({ path: `${gitPath}/${n}`, text: readFileSync(join(resolve(repoRoot, gitPath), n), "utf8") }));
  };
}

/** Every git-directory Application in the tree that pairs SSA with a claim-templated StatefulSet. */
export function auditSsaVolumeClaimTemplateDrift(repoRoot = REPO_ROOT): readonly SsaVctFinding[] {
  const read = readSyncedFilesFromDisk(repoRoot);
  const out: SsaVctFinding[] = [];
  for (const manifestPath of applicationManifestPaths(repoRoot)) {
    const text = readFileSync(resolve(repoRoot, manifestPath), "utf8");
    for (const doc of parseAllDocuments(text)) {
      out.push(...findingsForApplication(manifestPath, asObj(doc.toJS()), read));
    }
  }
  return out;
}
