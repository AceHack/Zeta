#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/app-of-apps-discovery.ts
 *
 * WHICH `kind: Application` MANIFESTS DOES AN APP-OF-APPS ROOT ACTUALLY REACH,
 * AND WHICH OF THOSE DOES ANY CHECK ASSERT ON?
 *
 * -- THE CONTRADICTION THIS FILE RESOLVES ----------------------------------
 * Two observations about `full-ai-cluster/k8s/applications/game-hosting/gmod`
 * were on the table at once, and they looked incompatible:
 *
 *   (1) "it sits at depth 2, the root glob is `{*\/Application.yaml,Application.yaml}`,
 *       so ArgoCD never discovers it" -- i.e. a manifest that looks deployed
 *       and is not.
 *   (2) the `--scope included` kind lane's own diagnostics show `gmod` in the
 *       cluster, syncing, and being DENIED:
 *         admission webhook "check-ignore-label.gatekeeper.sh" denied the
 *         request: Only exempt namespace can have the
 *         admission.gatekeeper.sh/ignore label, namespaces "game-hosting" not
 *         found
 *       -- i.e. a manifest that very much was applied.
 *
 * (2) is what happens; (1) is false, and it is false for a reason worth
 * writing down because it is easy to re-derive wrongly. **ArgoCD's `*` is not
 * path-segment bounded.** `reposerver/repository/repository.go` matches the
 * include/exclude patterns with `glob.Match(include, relPath)` -- the relative
 * path, and NO separator runes. `util/glob/glob.go` forwards that empty
 * separator list to `github.com/gobwas/glob`, whose `*` is documented as "any
 * sequence of non-separator characters"; with no separators declared, `/` is
 * not a separator, so `*` crosses directory boundaries. `*\/Application.yaml`
 * therefore matches `game-hosting/gmod/Application.yaml` (with `*` binding the
 * whole `game-hosting/gmod`). This is NOT `filepath.Match`, and it is NOT
 * doublestar; both would have made (1) true.
 *
 * Checked, not cited: the live cluster agrees. In the `--scope included` lane
 * the ONLY thing that creates Applications is the `zeta-root-dev` root, built
 * by `buildRootDevCatalogManifest` in `ports.ts` with that exact include glob
 * -- nothing else applies an Application manifest anywhere in the harness. The
 * `gmod` Application exists in that cluster. So the glob reached depth 2.
 *
 * -- SO WHERE IS THE REAL DEFECT ------------------------------------------
 * The depth-1 assumption is real, but it lives in OUR harness, not in ArgoCD:
 *
 *   - `discoverExpectedApplications()` reads `<dir>/Application.yaml` at depth
 *     1 only, so `gmod` is not in the roster the `included` lane asserts
 *     Synced+Healthy on.
 *   - `auditAppliedButUnasserted()` is built on that same roster, so the
 *     registry that exists precisely to catch "applied but nothing asserts on
 *     it" cannot see `gmod` either.
 *   - `auditSyncPolicyDeclarations()` in `manual-sync-policy.ts` is depth-1 for
 *     the same reason and says so.
 *
 * Net: ArgoCD deploys `gmod`, `gmod` fails to sync on every reconcile, and the
 * lane is green. That is the exact failure the factory keeps paying for -- a
 * check that did not run looking like a check that passed.
 *
 * -- WHAT THIS MODULE ASSERTS ---------------------------------------------
 * Two directions, both offline and pure:
 *
 *   A. NEVER-DISCOVERED. A `kind: Application` manifest under the applications
 *      tree that NO app-of-apps root's `include` glob matches. That is the
 *      class observation (1) described: a manifest that looks deployed and is
 *      not. Refused outright -- there is no registry, because a file nothing
 *      can ever apply is not a deferral, it is dead YAML.
 *
 *   C. ORPHANED SUPPORTING MANIFEST. A NON-Application manifest under the
 *      applications tree that no Application's git source reconciles and no
 *      root glob matches -- a PVC, CronJob or CR that looks deployed and is
 *      applied by nothing. Directions A and B only ever looked at
 *      `kind: Application` files, so this half of the tree (57 manifests) was
 *      never checked at all. Found three on the day it was added, one of them a
 *      whole workload directory with no Application in it. Registry-backed for
 *      the same reason B is: `platform/examples/` is deliberately unapplied.
 *
 *   B. DISCOVERED-BUT-UNASSERTED. A manifest the dev/CI root DOES apply
 *      (include matches, exclude does not) that is absent from the harness
 *      roster, so no lane ever asserts anything about it. Legitimate to defer
 *      -- so this one has a registry, and the registry entry must carry a
 *      reason. Both drift directions bite: an unregistered new one, and a
 *      stale entry for a manifest that is no longer in the gap.
 *
 * Nothing here is derived from a hand-copied list. The roots are found by
 * walking `full-ai-cluster/k8s` for app-of-apps Applications (same shape
 * `single-node-readiness.ts` uses: a git-directory source whose path ends in
 * `applications`) plus the dev catalog, parsed from the generator's own output
 * so a change to `buildRootDevCatalogManifest` moves this check with it.
 *
 * Exit codes: 0 clean, 1 drift, 2 usage/IO.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import { discoverExpectedApplications } from "./argocd-health-test.ts";
import { DEFAULT_ROOT_DEV_CATALOG, buildRootDevCatalogManifest } from "./ports.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CLUSTER_TREE = "full-ai-cluster/k8s";
const APPLICATIONS_TREE = "full-ai-cluster/k8s/applications";

// ---------------------------------------------------------------------------
// ArgoCD's glob, and an honest boundary around the part we implement
// ---------------------------------------------------------------------------

/**
 * Metacharacters gobwas/glob supports that this translator does not.
 *
 * Refused loudly rather than approximated. A glob checker that silently answers
 * the wrong thing for a pattern it does not understand is worse than one that
 * refuses: the wrong answer here is invisible, and it is exactly the class of
 * mistake that produced the contradiction at the top of this file.
 */
const UNSUPPORTED_GLOB_METACHARACTERS: readonly string[] = ["[", "]", "\\"];

function escapeRegExpLiteral(character: string): string {
  return character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Translate an ArgoCD `directory.include` / `directory.exclude` pattern into a
 * RegExp with gobwas-no-separator semantics.
 *
 * The load-bearing line is the `*` case: `*` and `**` are BOTH `.*` here,
 * because ArgoCD declares no separators, so neither one stops at `/`. If a
 * future ArgoCD passes separators, this function is where that changes.
 */
export function compileArgocdGlob(pattern: string): RegExp {
  for (const metacharacter of UNSUPPORTED_GLOB_METACHARACTERS) {
    if (pattern.includes(metacharacter)) {
      throw new Error(
        `app-of-apps glob uses '${metacharacter}', which this translator does not implement: ${JSON.stringify(pattern)}`,
      );
    }
  }
  let source = "";
  let braceDepth = 0;
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index] ?? "";
    if (character === "*") {
      // `**` collapses to the same thing; consume the second star so it is not
      // emitted twice.
      if (pattern[index + 1] === "*") index += 1;
      source += ".*";
      continue;
    }
    if (character === "?") {
      source += ".";
      continue;
    }
    if (character === "{") {
      braceDepth += 1;
      source += "(?:";
      continue;
    }
    if (character === "}") {
      if (braceDepth === 0) throw new Error(`unbalanced '}' in glob: ${JSON.stringify(pattern)}`);
      braceDepth -= 1;
      source += ")";
      continue;
    }
    if (character === "," && braceDepth > 0) {
      source += "|";
      continue;
    }
    source += escapeRegExpLiteral(character);
  }
  if (braceDepth !== 0) throw new Error(`unbalanced '{' in glob: ${JSON.stringify(pattern)}`);
  return new RegExp(`^${source}$`);
}

/** True when ArgoCD would consider `relPath` matched by `pattern`. */
export function argocdGlobMatches(pattern: string, relPath: string): boolean {
  if (pattern.length === 0) return false;
  return compileArgocdGlob(pattern).test(relPath);
}

// ---------------------------------------------------------------------------
// Finding the roots and the manifests, both by walking rather than by listing
// ---------------------------------------------------------------------------

export interface AppOfAppsRoot {
  /** Where the root manifest lives; the dev catalog is code, so it says so. */
  readonly origin: string;
  readonly name: string;
  /** `spec.source.directory.include`, "" when the root sets none. */
  readonly include: string;
  /** `spec.source.directory.exclude`, "" when the root sets none. */
  readonly exclude: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringAt(record: Record<string, unknown> | undefined, key: string): string {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function recordAt(record: Record<string, unknown> | undefined, key: string): Record<string, unknown> | undefined {
  const value = record?.[key];
  return isRecord(value) ? value : undefined;
}

function listYamlFiles(dir: string): readonly string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listYamlFiles(path);
    if (entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) return [path];
    return [];
  });
}

/**
 * Cheap pre-filter before paying for a YAML parse.
 *
 * The tree carries vendored multi-megabyte operator manifests (kubevirt, cdi);
 * parsing every one of them to learn they contain no Application would make
 * this check slow enough that someone eventually stops running it.
 */
const APPLICATION_KIND_LINE = /(^|\n)kind:\s*["']?Application["']?\s*(#[^\n]*)?(\n|$)/;

function argoApplicationDocs(text: string): readonly Record<string, unknown>[] {
  if (!APPLICATION_KIND_LINE.test(text)) return [];
  return parseAllDocuments(text)
    .map((doc) => doc.toJS({ maxAliasCount: -1 }) as unknown)
    .filter(isRecord)
    .filter((doc) => stringAt(doc, "kind") === "Application" && stringAt(doc, "apiVersion").startsWith("argoproj.io/"));
}

/**
 * Every app-of-apps root that governs the applications tree.
 *
 * "App-of-apps" is recognised the same way `single-node-readiness.ts`
 * recognises it -- a git-directory source whose `path` ends in `applications`
 * -- so a newly added root is picked up by existing, not by editing a list
 * here.
 */
export function discoverAppOfAppsRoots(repoRoot = REPO_ROOT): readonly AppOfAppsRoot[] {
  const roots: AppOfAppsRoot[] = [];
  for (const file of listYamlFiles(resolve(repoRoot, CLUSTER_TREE))) {
    for (const doc of argoApplicationDocs(readFileSync(file, "utf8"))) {
      const source = recordAt(recordAt(doc, "spec"), "source");
      if (source === undefined) continue;
      if (!stringAt(source, "path").endsWith("applications")) continue;
      const directory = recordAt(source, "directory");
      roots.push({
        origin: relative(repoRoot, file),
        name: stringAt(recordAt(doc, "metadata"), "name"),
        include: stringAt(directory, "include"),
        exclude: stringAt(directory, "exclude"),
      });
    }
  }
  // The dev/CI root is generated in code, never checked in as YAML. Parsing the
  // generator's own output keeps this check honest if that generator changes.
  for (const doc of argoApplicationDocs(buildRootDevCatalogManifest(DEFAULT_ROOT_DEV_CATALOG))) {
    const directory = recordAt(recordAt(recordAt(doc, "spec"), "source"), "directory");
    roots.push({
      origin: "src/Core.TypeScript/cluster/ports.ts (buildRootDevCatalogManifest)",
      name: stringAt(recordAt(doc, "metadata"), "name"),
      include: stringAt(directory, "include"),
      exclude: stringAt(directory, "exclude"),
    });
  }
  return roots.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * Every `kind: argoproj.io Application` manifest under the applications tree,
 * as a path relative to that tree -- which is exactly the string ArgoCD globs
 * against (`filepath.Rel(appPath, path)`).
 */
export function listApplicationManifests(repoRoot = REPO_ROOT): readonly string[] {
  const appsDir = resolve(repoRoot, APPLICATIONS_TREE);
  return listYamlFiles(appsDir)
    .filter((file) => argoApplicationDocs(readFileSync(file, "utf8")).length > 0)
    .map((file) => relative(appsDir, file))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Direction C: the SUPPORTING manifests, and whether anything reconciles them
// ---------------------------------------------------------------------------

/**
 * A source that reconciles PLAIN MANIFESTS OUT OF THIS GIT REPO.
 *
 * Directions A and B ask which `Application` manifests a root reaches. That
 * leaves the other half of the tree unexamined: the 57 supporting manifests
 * (PVCs, CronJobs, namespaces, CRs) sitting beside those Applications. The root
 * glob deliberately does NOT match them -- `app-of-apps-discovery.test.ts`
 * already pins that -- because each is supposed to be reconciled by ITS OWN
 * Application's git source. Nothing has ever checked that such an Application
 * exists.
 *
 * `chart` sources are excluded: a remote OCI/Helm-repo chart reconciles nothing
 * out of this repository, which is precisely how a manifest ends up orphaned
 * next to an Application that looks like it owns it.
 */
export interface GitDirectorySource {
  readonly app: string;
  /** Where the Application manifest lives, repo-relative. */
  readonly origin: string;
  /** `spec.source.path`, repo-relative, no trailing slash. */
  readonly path: string;
  readonly include: string;
  readonly exclude: string;
  readonly recurse: boolean;
  /** Helm-rendered from git: `directory` filters do not apply to it. */
  readonly rendersAsChart: boolean;
}

function gitDirectorySourcesInDoc(doc: Record<string, unknown>, origin: string): readonly GitDirectorySource[] {
  const spec = recordAt(doc, "spec");
  const single = recordAt(spec, "source");
  const multi = Array.isArray(spec?.["sources"]) ? (spec["sources"] as unknown[]).filter(isRecord) : [];
  const found: GitDirectorySource[] = [];
  for (const source of [...(single === undefined ? [] : [single]), ...multi]) {
    // A `chart` source is a remote Helm chart: it reconciles nothing from git.
    if (stringAt(source, "chart").length > 0) continue;
    const path = stringAt(source, "path").replace(/\/+$/, "");
    if (path.length === 0) continue;
    const directory = recordAt(source, "directory");
    found.push({
      app: stringAt(recordAt(doc, "metadata"), "name"),
      origin,
      path,
      include: stringAt(directory, "include"),
      exclude: stringAt(directory, "exclude"),
      recurse: directory?.["recurse"] === true,
      rendersAsChart: recordAt(source, "helm") !== undefined,
    });
  }
  return found;
}

/**
 * Every git-directory source declared anywhere in the cluster tree, including
 * the app-of-apps roots themselves and the generated dev catalog.
 *
 * The roots are deliberately NOT special-cased here: a root is just a source
 * with a very restrictive include glob, so one coverage rule answers "does
 * anything apply this file" for roots and leaf apps alike.
 */
export function discoverGitDirectorySources(repoRoot = REPO_ROOT): readonly GitDirectorySource[] {
  const sources: GitDirectorySource[] = [];
  for (const file of listYamlFiles(resolve(repoRoot, CLUSTER_TREE))) {
    const origin = relative(repoRoot, file);
    for (const doc of argoApplicationDocs(readFileSync(file, "utf8"))) {
      sources.push(...gitDirectorySourcesInDoc(doc, origin));
    }
  }
  for (const doc of argoApplicationDocs(buildRootDevCatalogManifest(DEFAULT_ROOT_DEV_CATALOG))) {
    sources.push(...gitDirectorySourcesInDoc(doc, "src/Core.TypeScript/cluster/ports.ts (buildRootDevCatalogManifest)"));
  }
  return sources;
}

/**
 * Would `source` apply the repo-relative file `repoRelPath`?
 *
 * THE EMPTY-INCLUDE CASE IS INVERTED RELATIVE TO `argocdGlobMatches`, and the
 * inversion is real ArgoCD semantics rather than a convenience. An absent
 * `directory.include` is NO FILTER -- every file under the path is applied. But
 * an app-of-apps root that declares an EMPTY include string matches nothing,
 * which is what `argocdGlobMatches("")` returns and what Direction A wants.
 * Same empty string, opposite meaning, because one is "field absent" and the
 * other is "field present and empty". Collapsing them would make every
 * unfiltered app look like it applies nothing, and every supporting manifest
 * would be reported as an orphan.
 */
export function sourceReconciles(source: GitDirectorySource, repoRelPath: string): boolean {
  if (repoRelPath !== source.path && !repoRelPath.startsWith(`${source.path}/`)) return false;
  // Helm-from-git renders the whole chart directory; `directory` filters are
  // ignored by ArgoCD for such a source, so treat the subtree as consumed.
  if (source.rendersAsChart) return true;
  const withinPath = relative(source.path, repoRelPath);
  if (!source.recurse && withinPath.includes("/")) return false;
  if (source.include.length > 0 && !argocdGlobMatches(source.include, withinPath)) return false;
  if (source.exclude.length > 0 && argocdGlobMatches(source.exclude, withinPath)) return false;
  return true;
}

/**
 * Every NON-Application manifest under the applications tree, relative to that
 * tree -- the complement of `listApplicationManifests`.
 */
export function listSupportingManifests(repoRoot = REPO_ROOT): readonly string[] {
  const appsDir = resolve(repoRoot, APPLICATIONS_TREE);
  return listYamlFiles(appsDir)
    .filter((file) => argoApplicationDocs(readFileSync(file, "utf8")).length === 0)
    .map((file) => relative(appsDir, file))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ---------------------------------------------------------------------------
// The registry + the audit
// ---------------------------------------------------------------------------

/**
 * Manifests an app-of-apps root APPLIES but no harness roster asserts on.
 *
 * Keyed by the manifest's path relative to the applications tree. A reason is
 * mandatory: an entry without one is a mute button, not a declaration -- the
 * same refusal `manual-sync-policy.ts` makes for `zeta.io/sync-policy`.
 */
export const DISCOVERED_BUT_UNASSERTED_REASONS: ReadonlyMap<string, string> = new Map([
  [
    "game-hosting/gmod/Application.yaml",
    "Nested one level below the depth-1 roster in discoverExpectedApplications(); ArgoCD's non-segment-bounded " +
      "glob DOES apply it, and it FAILS TO SYNC on every reconcile in the included lane: gatekeeper's " +
      "check-ignore-label webhook denies the admission.gatekeeper.sh/ignore label that " +
      "game-hosting/gmod/namespace.yaml carries, because `game-hosting` is absent from the exemptNamespaces list " +
      "in applications/open-policy-agent/Application.yaml (`zeta-platform` is the worked precedent there). That " +
      "is a live defect, not a deferral -- it is registered rather than fixed here because the fix is a policy " +
      "change that only a live cluster can confirm, and this module's job is to stop it being INVISIBLE. " +
      "Deepening the roster instead would change what the live lane asserts, which also cannot be verified " +
      "off-cluster (081KSXN940008QG0R000SCP2H1).",
  ],
]);

/**
 * Supporting manifests that NO Application reconciles, kept visible on purpose.
 *
 * Same contract as the map above: a reason is mandatory, because an entry with
 * no why is a mute button. An orphan is dead YAML -- it looks deployed and is
 * applied by nothing -- so an entry here is an admission, never an exemption.
 */
export const ORPHANED_SUPPORTING_REASONS: ReadonlyMap<string, string> = new Map([
  [
    "arc-runner-set/model-cache-pvc.yaml",
    "LIVE DEFECT, open as 081M0JM6SSG087G0R0029X3F6Z (P2). arc-runner-set/Application.yaml sources a REMOTE OCI " +
      "chart (ghcr.io/actions/actions-runner-controller-charts), so it has no git path and cannot reconcile its " +
      "own sibling; the root glob wants the basename `Application.yaml`, which this is not. Registered rather " +
      "than fixed here because the two candidate fixes differ in WHO OWNS THE VOLUME LIFECYCLE -- a separate " +
      "Application (the 12-app idiom in this tree) versus converting this Application to `spec.sources` " +
      "(no other Application here uses multi-source, and ~10 tests in arc-runner-manifests.test.ts read " +
      "`spec.source.*`). That is a product call, and neither shape can be confirmed off-cluster: the metal k8s " +
      "layer has never been reconciled (applications/vault/TOPOLOGY.md: 'Nothing has been applied to any " +
      "cluster'), and the kind lane excludes arc-runner-set outright (argocd-health-test.ts: no GitHub App " +
      "credential to bind, and ReadWriteMany is unservable by rancher.io/local-path).",
  ],
  [
    "ddns/cronjob.yaml",
    "LIVE DEFECT, open as 081M0Z5M416087G0R003XGWM5T (P2). `full-ai-cluster/k8s/applications/ddns/` holds this " +
      "CronJob and NOTHING ELSE -- there is no Application.yaml in the directory at all, so no root glob and no " +
      "app source reaches it. Landed unreconciled in #7432 alongside zeta-gateway and the Let's Encrypt issuer. " +
      "Not fixed here: authoring the missing Application is a deployment change to a workload outside this " +
      "change's scope, and the Namecheap DDNS credential it would need is not one this repo can mint.",
  ],
  [
    "platform/examples/gmod-server.yaml",
    "INTENTIONAL, not a defect. Three `kind: Deployable` CRs used as documentation of the platform CRD surface. " +
      "applications/platform/Application.yaml sets recurse:false and an explicit include list of the 15 " +
      "manifests it owns, so `examples/` is excluded by construction rather than by accident. Applying these " +
      "would create real game-server workloads from a doc sample.",
  ],
]);

export interface DiscoveryDrift {
  /** Matched by no root's include glob: looks deployed, never is. */
  readonly neverDiscovered: readonly string[];
  /** Applied by the dev/CI root, absent from the harness roster, unregistered. */
  readonly unexplained: readonly string[];
  /** Registered, but no longer in the gap. */
  readonly stale: readonly string[];
  /** Non-Application manifests no Application reconciles, unregistered. */
  readonly orphanedSupporting: readonly string[];
  /** Registered as orphaned, but something reconciles them now. */
  readonly staleOrphans: readonly string[];
}

export function auditAppOfAppsDiscovery(repoRoot = REPO_ROOT): DiscoveryDrift {
  const roots = discoverAppOfAppsRoots(repoRoot);
  const manifests = listApplicationManifests(repoRoot);
  const roster = new Set(
    discoverExpectedApplications(repoRoot).map((app) =>
      app.path.startsWith(`${APPLICATIONS_TREE}/`) ? app.path.slice(APPLICATIONS_TREE.length + 1) : app.path,
    ),
  );

  const neverDiscovered = manifests.filter(
    (relPath) => !roots.some((root) => argocdGlobMatches(root.include, relPath)),
  );

  // Direction B is judged against the DEV/CI root specifically: it is the only
  // root any automated lane ever stands up, so it is the only one whose reach
  // can outrun what a lane asserts.
  const devRoots = roots.filter((root) => root.origin.endsWith("ports.ts (buildRootDevCatalogManifest)"));
  const applied = manifests.filter((relPath) =>
    devRoots.some(
      (root) =>
        argocdGlobMatches(root.include, relPath) &&
        !(root.exclude.length > 0 && argocdGlobMatches(root.exclude, relPath)),
    ),
  );
  const gap = applied.filter((relPath) => !roster.has(relPath));
  const gapSet = new Set(gap);

  // Direction C. Judged against EVERY git-directory source in the tree, not just
  // the roots: a supporting manifest is reconciled if anything at all applies
  // it, and which Application does so is not this check's business.
  const gitSources = discoverGitDirectorySources(repoRoot);
  const orphans = listSupportingManifests(repoRoot).filter(
    (relPath) => !gitSources.some((source) => sourceReconciles(source, `${APPLICATIONS_TREE}/${relPath}`)),
  );
  const orphanSet = new Set(orphans);

  return {
    neverDiscovered,
    unexplained: gap.filter((relPath) => !DISCOVERED_BUT_UNASSERTED_REASONS.has(relPath)),
    stale: [...DISCOVERED_BUT_UNASSERTED_REASONS.keys()]
      .filter((relPath) => !gapSet.has(relPath))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    orphanedSupporting: orphans.filter((relPath) => !ORPHANED_SUPPORTING_REASONS.has(relPath)),
    staleOrphans: [...ORPHANED_SUPPORTING_REASONS.keys()]
      .filter((relPath) => !orphanSet.has(relPath))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  };
}

export function formatDiscoveryDrift(drift: DiscoveryDrift): string {
  const lines: string[] = [];
  for (const relPath of drift.neverDiscovered) {
    lines.push(
      `NEVER-DISCOVERED ${APPLICATIONS_TREE}/${relPath}: no app-of-apps root's directory.include glob matches it, ` +
        "so nothing applies it. Move it where a root reaches, or widen a root's include glob.",
    );
  }
  for (const relPath of drift.unexplained) {
    lines.push(
      `UNASSERTED ${APPLICATIONS_TREE}/${relPath}: the dev/CI app-of-apps root applies it, but it is outside the ` +
        "roster discoverExpectedApplications() asserts on, so no lane can see it fail. Bring it into the roster, " +
        "or register it with a reason in DISCOVERED_BUT_UNASSERTED_REASONS.",
    );
  }
  for (const relPath of drift.stale) {
    lines.push(
      `STALE ${APPLICATIONS_TREE}/${relPath}: registered in DISCOVERED_BUT_UNASSERTED_REASONS but no longer in the ` +
        "gap. Delete the entry.",
    );
  }
  for (const relPath of drift.orphanedSupporting) {
    lines.push(
      `ORPHANED ${APPLICATIONS_TREE}/${relPath}: no Application's git source reconciles it and no root glob ` +
        "matches it, so nothing applies this manifest. Give it an owning Application, bring it under an existing " +
        "one's include glob, or register it with a reason in ORPHANED_SUPPORTING_REASONS.",
    );
  }
  for (const relPath of drift.staleOrphans) {
    lines.push(
      `STALE-ORPHAN ${APPLICATIONS_TREE}/${relPath}: registered in ORPHANED_SUPPORTING_REASONS but something ` +
        "reconciles it now. Delete the entry.",
    );
  }
  return lines.join("\n");
}

function main(): void {
  let drift: DiscoveryDrift;
  try {
    drift = auditAppOfAppsDiscovery();
  } catch (error) {
    console.error(
      `app-of-apps discovery audit could not run: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(2);
  }
  const total =
    drift.neverDiscovered.length +
    drift.unexplained.length +
    drift.stale.length +
    drift.orphanedSupporting.length +
    drift.staleOrphans.length;
  if (total === 0) {
    const manifests = listApplicationManifests();
    const supporting = listSupportingManifests();
    console.log(
      `app-of-apps discovery: ${manifests.length} Application manifests, ` +
        `${DISCOVERED_BUT_UNASSERTED_REASONS.size} registered as applied-but-unasserted, ` +
        `${supporting.length} supporting manifests, ` +
        `${ORPHANED_SUPPORTING_REASONS.size} registered as orphaned, 0 drift.`,
    );
    process.exit(0);
  }
  console.error(formatDiscoveryDrift(drift));
  process.exit(1);
}

if (import.meta.main) {
  main();
}
