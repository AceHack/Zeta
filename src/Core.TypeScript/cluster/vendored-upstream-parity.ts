/**
 * src/Core.TypeScript/cluster/vendored-upstream-parity.ts
 *
 * The "vendored VERBATIM from upstream" claim, made CHECKABLE.
 *
 * -- WHY THIS EXISTS --------------------------------------------------------
 * Two Applications in this tree do not reference an upstream chart; they carry
 * a copy of an upstream release manifest:
 *
 *   full-ai-cluster/k8s/applications/cdi/cdi-operator.yaml       (356707 bytes)
 *   full-ai-cluster/k8s/applications/kubevirt/kubevirt-operator.yaml (490554 bytes)
 *
 * Both file headers say they are byte-for-byte upstream, and a THIRD file leans
 * on that claim to refuse a change: `full-ai-cluster/k8s/single-node-budget.json`
 * declines to edit kubevirt's replica count because doing so "would make the
 * checked-in copy diverge from the cluster it documents, which is a worse lie
 * than this one". So a load-bearing refusal rests on a sentence in a YAML
 * comment, and nothing re-measured it after the day it was typed.
 *
 * That is the shape this repo already names elsewhere: a number whose
 * provenance is a one-time manual check goes stale silently. `helm` gives the
 * 33 chart-referencing Applications this property for free -- the pin IS the
 * proof, and `helm pull` at a pinned version cannot return someone else's
 * bytes. A vendored copy has no such property unless something checks it.
 *
 * This module is that check. It is the reason the vendored pair can be treated
 * as a CACHE of a pinned immutable URL rather than as a fork: cache-vs-fork is
 * not a matter of intent, it is a matter of whether anything would notice the
 * difference.
 *
 * -- WHAT IT CHECKS ---------------------------------------------------------
 *   1. every rostered upstream URL is IMMUTABLY pinned (a release tag or a
 *      40-hex commit; never `main`, `master`, `latest`, or a bare branch)
 *   2. the committed bytes hash to the pinned digest                (offline)
 *   3. every file the Application's own `directory.include` glob selects is
 *      CLASSIFIED -- upstream-verbatim, or ours with a stated why      (offline)
 *   4. every rostered path is actually selected by that glob -- the mirror
 *      image, a roster entry pricing a file the cluster never gets     (offline)
 *   5. `--fetch`: the pinned URL's bytes STILL hash to the pinned digest.
 *      A GitHub release asset can be deleted and re-uploaded in place; the same
 *      failure mode `lint-verifier-jar-provenance.ts` records for tlaplus. The
 *      digest, not the URL, is the pin.
 *
 * Check 3 is what keeps the roster from becoming a hand-written allowlist that
 * drifts from the tree: the file set is DERIVED from the same `directory.include`
 * glob ArgoCD reads (via `discoverApplications`, which is also what
 * `kubevirt-cdi-emulation-test.ts` derives its apply list from), so a third file
 * added to `cdi`'s glob fails this check until someone says which kind it is.
 *
 * -- WHAT IT DOES NOT PROVE -------------------------------------------------
 * Stated because a check that hides what it gave up is worse than no check.
 * This proves committed-bytes == upstream-bytes. It does NOT prove
 * committed-bytes == what is running on node-5b2dfa. That second gap is real,
 * is named in `manual-sync-policy.ts` ("drift between the vendored bytes and
 * the operator actually running on node-5b2dfa"), and nothing offline can close
 * it -- it needs the cluster. Do not read a green run here as a statement about
 * metal.
 *
 * Nor is it an argument FOR vendoring. Upstream ships these as raw release YAML
 * and publishes no Helm chart (measured 2026-08-23 against the release assets of
 * kubevirt v1.8.4 and containerized-data-importer v1.65.0: four and two YAML
 * assets respectively, no chart, no kustomize base). Referencing is the standing
 * preference; where upstream offers nothing to reference, this is what keeps the
 * copy honest.
 *
 * Exit codes: 0 clean, 1 findings, 2 usage/IO.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { resolve } from "node:path";
import { stringCompare } from "../collation/collation.ts";
import { discoverApplications, includeMatcher } from "./rendered-storage-claims.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

// ---------------------------------------------------------------------------
// The roster
// ---------------------------------------------------------------------------

/** A file copied verbatim from an upstream release, pinned by digest. */
export interface UpstreamFile {
  /** Repo-relative path of the committed copy. */
  readonly path: string;
  /** The immutable URL the bytes came from. */
  readonly upstreamUrl: string;
  /** sha256 of the UPSTREAM bytes, which the copy must reproduce exactly. */
  readonly sha256: string;
}

/** A file in the same directory that is OURS, and why it is not upstream's. */
export interface OurFile {
  readonly path: string;
  readonly why: string;
}

const CDI = "full-ai-cluster/k8s/applications/cdi";
const KUBEVIRT = "full-ai-cluster/k8s/applications/kubevirt";

export const UPSTREAM_FILES: readonly UpstreamFile[] = [
  {
    path: `${CDI}/cdi-operator.yaml`,
    upstreamUrl: "https://github.com/kubevirt/containerized-data-importer/releases/download/v1.65.0/cdi-operator.yaml",
    sha256: "e96d59abdf358c5161cb96adcfdcc6107efc3fb608ec93ade11578c94a222015",
  },
  {
    path: `${KUBEVIRT}/kubevirt-operator.yaml`,
    upstreamUrl: "https://github.com/kubevirt/kubevirt/releases/download/v1.8.4/kubevirt-operator.yaml",
    sha256: "d1d8264eec5b802c122bec6c54d8c3b11e119ee2a5c75602aaa8b53ea3857eda",
  },
];

export const OUR_FILES: readonly OurFile[] = [
  {
    path: `${CDI}/cdi-cr.yaml`,
    why:
      "OURS, and deliberately not upstream's. Upstream's cdi-cr.yaml is a 309-byte stub; " +
      "this one is the spec captured from the live CDI CR on node-5b2dfa plus a sync-wave " +
      "annotation, so adopting the Application is a no-op against the running cluster.",
  },
  {
    path: `${KUBEVIRT}/kubevirt-cr.yaml`,
    why:
      "OURS, same reason as cdi-cr.yaml. Upstream's is a 322-byte stub; this one carries the " +
      "live spec from node-5b2dfa and argocd.argoproj.io/sync-wave: 1, which upstream has no " +
      "reason to ship.",
  },
];

// ---------------------------------------------------------------------------
// Immutability of a pin
// ---------------------------------------------------------------------------

/**
 * A GitHub release-asset URL under a version-like tag, or a URL carrying a
 * 40-hex commit. Everything else is refused.
 *
 * `clone-at-tag-stays-sufficient` is the standing rule this implements at the
 * manifest layer: referencing upstream is only better than copying it if the
 * reference cannot move. A `main` or `latest` in a roster URL trades a stale
 * copy for a build that changes underneath us, which is the worse of the two.
 */
export function pinIsImmutable(url: string): boolean {
  if (/\b(?:main|master|latest|HEAD)\b/.test(url)) return false;
  if (/[0-9a-f]{40}/.test(url)) return true;
  return /\/releases\/download\/v?\d+\.\d+\.\d+[^/]*\//.test(url);
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

export type FindingKind =
  | "unpinned-upstream-url"
  | "committed-bytes-differ-from-pin"
  | "committed-file-missing"
  | "unclassified-synced-file"
  | "rostered-file-not-synced"
  | "upstream-bytes-moved";

export interface Finding {
  readonly kind: FindingKind;
  readonly path: string;
  readonly detail: string;
}

/** sha256 of a file's bytes, or `null` when it is not there. */
export function fileSha256(abs: string): string | null {
  try {
    return createHash("sha256").update(readFileSync(abs)).digest("hex");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function readdirIfPresent(abs: string): Dirent[] | null {
  try {
    return readdirSync(abs, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Checks 1, 2 — the roster against the tree. No network. */
export function checkRoster(repoRoot = REPO_ROOT, roster: readonly UpstreamFile[] = UPSTREAM_FILES): Finding[] {
  const findings: Finding[] = [];
  for (const entry of roster) {
    if (!pinIsImmutable(entry.upstreamUrl)) {
      findings.push({
        kind: "unpinned-upstream-url",
        path: entry.path,
        detail: `${entry.upstreamUrl} is not immutably pinned; a roster URL must name a release tag or a 40-hex commit`,
      });
    }
    const actual = fileSha256(resolve(repoRoot, entry.path));
    if (actual === null) {
      findings.push({
        kind: "committed-file-missing",
        path: entry.path,
        detail: `rostered as a verbatim copy of ${entry.upstreamUrl} but the file is not in the tree`,
      });
      continue;
    }
    if (actual !== entry.sha256) {
      findings.push({
        kind: "committed-bytes-differ-from-pin",
        path: entry.path,
        detail:
          `committed sha256 ${actual} != pinned ${entry.sha256} (${entry.upstreamUrl}). ` +
          "The copy is no longer verbatim: either re-pin it deliberately, or take the edit " +
          "upstream and reference the release that carries it.",
      });
    }
  }
  return findings;
}

/**
 * Checks 3, 4 — the classification is COMPLETE and lands on files that are
 * actually synced.
 *
 * Derived from each Application's own `directory.include` glob rather than from
 * a directory listing, because the glob is what decides what ArgoCD applies. A
 * file in the directory that the glob excludes is not applied and is not this
 * check's business; a file the glob DOES select and nobody classified is the
 * gap that lets an unreviewed copy of someone else's YAML into the tree.
 */
export function checkClassificationCoverage(
  repoRoot = REPO_ROOT,
  roster: readonly UpstreamFile[] = UPSTREAM_FILES,
  ours: readonly OurFile[] = OUR_FILES,
): Finding[] {
  const findings: Finding[] = [];
  const classified = new Set<string>([...roster.map((r) => r.path), ...ours.map((o) => o.path)]);
  // Only the directories the roster names are in scope. An Application with no
  // vendored file is not this module's subject, and widening to every git-path
  // app would make the check a repo-wide manifest census wearing a parity
  // check's name.
  const scopedDirs = new Set(roster.map((entry) => entry.path.slice(0, entry.path.lastIndexOf("/"))));
  const synced = new Set<string>();
  for (const source of discoverApplications(repoRoot)) {
    if (source.kind !== "git-path") continue;
    if (!scopedDirs.has(source.gitPath)) continue;
    const matches = includeMatcher(source.includeGlob);
    for (const dirent of (readdirIfPresent(resolve(repoRoot, source.gitPath)) ?? []).sort((a, b) =>
      stringCompare(a.name, b.name),
    )) {
      if (!dirent.isFile() || !matches(dirent.name)) continue;
      synced.add(`${source.gitPath}/${dirent.name}`);
    }
  }
  for (const path of [...synced].sort((a, b) => stringCompare(a, b))) {
    if (classified.has(path)) continue;
    findings.push({
      kind: "unclassified-synced-file",
      path,
      detail:
        "the Application's directory.include glob applies this file and nothing says whether it is " +
        "upstream's bytes or ours; add it to UPSTREAM_FILES with a pinned digest or to OUR_FILES with a why",
    });
  }
  for (const path of [...classified].sort((a, b) => stringCompare(a, b))) {
    const dir = path.slice(0, path.lastIndexOf("/"));
    if (!scopedDirs.has(dir)) continue;
    if (synced.has(path)) continue;
    findings.push({
      kind: "rostered-file-not-synced",
      path,
      detail:
        "classified here but no Application's directory.include glob selects it, so ArgoCD never applies " +
        "it -- the roster is describing a file the cluster does not get",
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// The online half
// ---------------------------------------------------------------------------

export type Fetcher = (url: string) => Promise<Uint8Array>;

const defaultFetcher: Fetcher = async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer());

/**
 * Check 5 — the pinned URL still serves the pinned bytes.
 *
 * OPT-IN, never the default. A gate that needs the network is a gate that can
 * be unavailable, and an unavailable gate reads like a passing one -- the same
 * reason `rendered-storage-claims.ts` renders offline by default. The offline
 * checks above are the gate; this is the periodic re-measurement.
 */
export async function checkUpstreamStillMatches(
  roster: readonly UpstreamFile[] = UPSTREAM_FILES,
  fetcher: Fetcher = defaultFetcher,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const entry of roster) {
    let bytes: Uint8Array;
    try {
      bytes = await fetcher(entry.upstreamUrl);
    } catch (error) {
      findings.push({
        kind: "upstream-bytes-moved",
        path: entry.path,
        detail: `could not fetch ${entry.upstreamUrl}: ${String((error as Error).message)}`,
      });
      continue;
    }
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== entry.sha256) {
      findings.push({
        kind: "upstream-bytes-moved",
        path: entry.path,
        detail:
          `${entry.upstreamUrl} now serves sha256 ${actual}, pinned ${entry.sha256}. ` +
          "A release asset was replaced in place; the digest is the pin, not the URL.",
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function formatReport(findings: readonly Finding[], fetched: boolean): string {
  const lines: string[] = [];
  lines.push(
    `vendored-upstream parity: ${String(UPSTREAM_FILES.length)} upstream-verbatim file(s), ` +
      `${String(OUR_FILES.length)} ours, network=${fetched ? "checked" : "NOT checked (offline)"}`,
  );
  for (const entry of UPSTREAM_FILES) {
    lines.push(`  ${entry.path}`);
    lines.push(`      <- ${entry.upstreamUrl}`);
    lines.push(`      sha256 ${entry.sha256}`);
  }
  if (findings.length === 0) {
    lines.push("OK — every rostered copy reproduces its pinned upstream digest and every synced file is classified.");
    if (!fetched) lines.push("NOTE: --fetch was not passed, so nothing here re-checked what the URL serves TODAY.");
    return lines.join("\n");
  }
  lines.push(`FINDINGS: ${String(findings.length)}`);
  for (const finding of findings) lines.push(`  [${finding.kind}] ${finding.path}\n      ${finding.detail}`);
  return lines.join("\n");
}

if (import.meta.main) {
  const fetched = process.argv.includes("--fetch");
  const findings = [...checkRoster(), ...checkClassificationCoverage()];
  if (fetched) findings.push(...(await checkUpstreamStillMatches()));
  console.log(formatReport(findings, fetched));
  process.exit(findings.length === 0 ? 0 : 1);
}
