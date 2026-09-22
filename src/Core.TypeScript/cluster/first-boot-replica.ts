#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/first-boot-replica.ts
 *
 * FIRST-BOOT REPLICA — boot the REAL k3s manifest roster the USB installer's
 * control-plane node applies, in a Docker container configured to match
 * `full-ai-cluster/nixos/modules/k3s-server.nix` (+ `local-storage.nix`) as
 * closely as a container can, and report NAMED verdicts on whether the
 * roster converges.
 *
 * WHY THIS EXISTS. Nothing in CI boots this roster today:
 *   - `argocd-health-test.ts` (the Docker/k3d and Docker/kind lanes) installs
 *     ArgoCD through `dev-cluster/use-cases.ts`, a DIFFERENT bring-up path —
 *     it never runs `services.k3s.manifests` at all.
 *   - `full-ai-cluster/nixos/tests/k3s-first-boot-roster.nix` runs the real
 *     roster inside a NixOS VM test, but nothing in `.github/workflows/`
 *     builds it (it needs a KVM host + ~45-70 min + ~10GB of pulls).
 *   - `full-ai-cluster/nixos/tests/k3s-first-boot-apply-order-eval-test.nix`
 *     checks the roster's apply ORDER at the Nix-value level, with no VM.
 *
 * This harness sits between the two Nix tests: cheaper than the VM test (a
 * container, not a QEMU VM — no KVM host required), and unlike the eval test
 * it actually BOOTS k3s and answers the open question in k3s-server.nix
 * comment block #5 — does the k3s deploy controller retry the unknown-kind
 * apply of `root-application.yaml`? — empirically, with a named verdict.
 *
 * DERIVATION, NOT A SECOND COPY. Every flag, every roster entry, and the k3s
 * version come from PARSING the real Nix/JSON sources at run time:
 *   - `nixos/modules/k3s-server.nix`   -> extraFlags[] + 10 manifest entries
 *   - `nixos/modules/local-storage.nix` -> the 11th (inline `pkgs.writeText`)
 *   - `k8s/kubernetes-version.json`     -> the k3s version (already the ONE
 *     declared version per that file's own header; no second pin is added)
 *   - `cluster-identity.json` + `cluster-cidr.ts` -> --cluster-cidr /
 *     --service-cidr (same derivation the Nix twin `cluster-network.nix` and
 *     the golden vectors hold to)
 * A parser that cannot see a shape fails LOUDLY (never silently skips) —
 * `.claude/rules/never-assume-malice-where-mistake-is-possible.md` aside,
 * a parser that goes quiet on an unrecognised line is the vacuity class:
 * it looks like coverage and provides none.
 *
 * Usage:
 *   bun src/Core.TypeScript/cluster/first-boot-replica.ts --dry-run
 *   bun src/Core.TypeScript/cluster/first-boot-replica.ts --run
 *   bun src/Core.TypeScript/cluster/first-boot-replica.ts --run --keep --json-out report.json
 *
 * Exit codes: 0 = every required stage verdict passed; 1 = a required stage
 * failed; 2 = usage/environment error (docker missing, parse failure).
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parseAllDocuments } from "yaml";
import { deriveClusterNetwork } from "./cluster-cidr.ts";
import { stringCompare } from "../collation/collation.ts";
// The stage-6 "serve the dev rung" override reuses the SAME override point
// `argocd-health-test.ts`'s kind/k3d included lanes already built and proved —
// imported, never re-derived. `buildLaneTreeForProfile` is the whole rung +
// rung-overrides + in-cluster-git-server pipeline; `rootDevCatalogExcludeGlobFor`
// is the SAME exclude glob (minus cilium, which this replica already runs for
// real via its own k3s bootstrap roster — see `applyServeTreeOverride` below)
// the included dev/CI ArgoCD lane applies, so a directory excluded there and a
// directory excluded here can never silently drift apart into two answers for
// "what does the dev/CI catalog actually apply".
import { buildLaneTreeForProfile } from "./argocd-health-test.ts";
import { rootDevCatalogExcludeGlobFor } from "./ports.ts";

// ───────────────────────────── Small helpers ────────────────────────────

function firstLine(text: string): string {
  return text.split("\n", 1)[0] ?? text;
}

function reason(e: unknown): string {
  return firstLine(e instanceof Error ? e.message : String(e));
}

function compareOrdinal(a: string, b: string): number {
  return stringCompare(a, b);
}

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// ─────────────────────────── Nix parsing (pure) ─────────────────────────

/**
 * Locate a `<anchor> {` ... `}` block by brace matching, starting the search
 * at `anchor`'s first occurrence. Shared shape with
 * `full-ai-cluster/k8s/tests/validate-bootstrap.ts`'s `extractManifestsAttrset` —
 * kept as a separate copy here (not imported) because that file lives under
 * `full-ai-cluster/k8s/tests/` for a different roster shape (the legacy
 * `infra/` tree) and importing across that boundary would couple two
 * deliberately-independent checks to one parser's bugs.
 */
export function extractBracedBlock(source: string, anchor: string, openChar = "{", closeChar = "}"): string {
  const anchorIdx = source.indexOf(anchor);
  if (anchorIdx === -1) {
    throw new Error(`no \`${anchor}\` block found`);
  }
  const openIdx = source.indexOf(openChar, anchorIdx);
  if (openIdx === -1) {
    throw new Error(`\`${anchor}\` has no opening \`${openChar}\``);
  }
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return source.slice(anchorIdx, i + 1);
    }
  }
  throw new Error(`unterminated \`${anchor}\` block`);
}

/**
 * Strip nix's `''...''` indentation the way nix itself does: the minimal
 * leading whitespace across all non-blank lines is removed from every line,
 * and a wholly-blank first/last line (immediately after the opening `''` /
 * before the closing `''`) is dropped. Anchor: the Nix manual, "Indented
 * strings" — https://nix.dev/manual/nix/2.24/language/string-literals —
 * this is the same stripping rule, reimplemented because Nix cannot be
 * shelled out to in CI without installing it (this harness must run from a
 * plain `git clone`, `.claude/rules/clone-at-tag-stays-sufficient.md`).
 */
export function dedentNixIndentedString(raw: string): string {
  const lines = raw.split("\n");
  let start = 0;
  let end = lines.length;
  if (lines[0] !== undefined && lines[0].trim() === "") start = 1;
  if (end > start && lines[end - 1] !== undefined && (lines[end - 1] as string).trim() === "") end -= 1;
  const body = lines.slice(start, end);
  const indents = body.filter((l) => l.trim() !== "").map((l) => (/^[ \t]*/.exec(l) as RegExpExecArray)[0].length);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  return body.map((l) => l.slice(minIndent)).join("\n");
}

/**
 * The `extraFlags = [ ... ];` list from `k3s-server.nix`, resolved to plain
 * strings. Handles the two `${config.zeta.cluster.podCidr}` /
 * `${config.zeta.cluster.serviceCidr}` interpolations via `substitutions`
 * (an exact-string map); any OTHER `${...}` interpolation is a parse
 * failure, never a silently-dropped flag — an extraFlags entry this parser
 * cannot resolve is a flag the replica would boot WITHOUT, which is exactly
 * the drift `.claude/rules/dv2-data-split-discipline-activated.md` #6
 * (idempotency: derive once, reuse) exists to prevent.
 */
export function parseExtraFlags(nixSource: string, substitutions: ReadonlyMap<string, string>): string[] {
  const block = extractBracedBlock(nixSource, "extraFlags = ", "[", "]");
  const inner = block.slice(block.indexOf("[") + 1, block.lastIndexOf("]"));
  const flags: string[] = [];
  for (const rawLine of inner.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const firstQuote = line.indexOf('"');
    if (firstQuote === -1) continue; // a bare comment continuation or blank
    const lastQuote = line.lastIndexOf('"');
    if (lastQuote === firstQuote) {
      throw new Error(`extraFlags: unterminated string literal on line: ${line}`);
    }
    let value = line.slice(firstQuote + 1, lastQuote);
    const interpolation = /\$\{[^}]*\}/g;
    value = value.replace(interpolation, (match) => {
      const resolved = substitutions.get(match);
      if (resolved === undefined) {
        throw new Error(
          `extraFlags: unresolved Nix interpolation ${match} in \`${value}\` — this parser only resolves ` +
            `${[...substitutions.keys()].join(", ")}; add a substitution or the replica would boot without this flag`,
        );
      }
      return resolved;
    });
    flags.push(value);
  }
  return flags;
}

export interface ManifestSourceEntry {
  readonly attr: string;
  readonly literal: string;
  readonly path: string;
}

/** `<attr>.source = <path literal>;` bindings inside a `manifests = { ... }` attrset — same shape `validate-bootstrap.ts` reads. */
export function parseManifestSourceRoster(nixSource: string, moduleDir: string): ManifestSourceEntry[] {
  const block = extractBracedBlock(nixSource, "manifests = {", "{", "}");
  const entries: ManifestSourceEntry[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const lhs = line.slice(0, eq).trim();
    const SOURCE_ATTR = ".source";
    if (!lhs.endsWith(SOURCE_ATTR)) continue;
    const attr = lhs.slice(0, lhs.length - SOURCE_ATTR.length);
    if (attr.length === 0) continue;
    const semi = line.indexOf(";", eq);
    if (semi === -1) continue;
    const literal = line.slice(eq + 1, semi).trim();
    const isPathLiteral = literal.startsWith("./") || literal.startsWith("../") || literal.startsWith("/");
    if (!isPathLiteral) continue; // the inline pkgs.writeText entry is handled separately
    const path = isAbsolute(literal) ? resolve(literal) : resolve(join(moduleDir, literal));
    entries.push({ attr, literal, path });
  }
  return entries;
}

/**
 * The ONE inline `<attr>.source = pkgs.writeText "<filename>" '' ... '';`
 * entry `local-storage.nix` declares (`local-path-provisioner`). Narrow on
 * purpose: a second inline entry appearing anywhere would silently escape
 * this parser, so `buildRoster` below cross-checks the roster's total count
 * against what both files declare (see its own docstring).
 */
export function parseInlineWriteTextManifest(nixSource: string, attr: string): { filename: string; content: string } {
  const marker = `${attr}.source = pkgs.writeText "`;
  const markerIdx = nixSource.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error(`no inline \`${attr}.source = pkgs.writeText "..."\` binding found`);
  }
  const filenameStart = markerIdx + marker.length;
  const filenameEnd = nixSource.indexOf('"', filenameStart);
  if (filenameEnd === -1) throw new Error(`unterminated filename literal after \`${marker}\``);
  const filename = nixSource.slice(filenameStart, filenameEnd);
  const openStrIdx = nixSource.indexOf("''", filenameEnd);
  if (openStrIdx === -1) throw new Error(`no opening \`''\` found for ${attr}'s inline manifest`);
  const contentStart = openStrIdx + 2;
  // The closing `''` for THIS binding is the first `''` at or before the next
  // top-level `;` that terminates the attribute — walked as the first `\n<ws>'';`
  // after contentStart, which is how every writeText call in this tree is laid out.
  const closeMatch = /\n[ \t]*''/.exec(nixSource.slice(contentStart));
  if (closeMatch === null) throw new Error(`no closing \`''\` found for ${attr}'s inline manifest`);
  const contentEnd = contentStart + closeMatch.index;
  const raw = nixSource.slice(contentStart, contentEnd);
  return { filename, content: dedentNixIndentedString(raw) };
}

export interface RosterEntry {
  /** The `services.k3s.manifests` attribute name, e.g. `argocd-install`. */
  readonly attr: string;
  /** The filename k3s writes under `/var/lib/rancher/k3s/server/manifests/` — mirrors nixpkgs `mkManifestTarget`. */
  readonly filename: string;
  /** The manifest's YAML text, as k3s would see it on disk. */
  readonly content: string;
  /** Where this harness read the content from, for diagnostics. */
  readonly sourceDescription: string;
}

/** nixpkgs `mkManifestTarget`: append `.yaml` unless the name already ends `.yaml`/`.yml`/`.json`. */
export function manifestTargetFilename(attr: string): string {
  if (attr.endsWith(".yaml") || attr.endsWith(".yml") || attr.endsWith(".json")) return attr;
  return `${attr}.yaml`;
}

export interface RosterBuildInputs {
  readonly k3sServerNixPath: string;
  readonly localStorageNixPath: string;
}

/**
 * Merge `k3s-server.nix`'s path-sourced roster with `local-storage.nix`'s
 * inline `local-path-provisioner` entry — the same two-module union
 * `k3s-first-boot-apply-order-eval-test.nix` P1 checks ("the merged roster
 * is the union of both modules"). Read this harness's file list is a
 * REPLICA of that check, not a substitute for it: that eval test still
 * catches an attr-name collision at Nix level on every PR; this function
 * catches the same collision here so a container boot does not have to.
 */
export function buildRoster(inputs: RosterBuildInputs): RosterEntry[] {
  const k3sServerSource = readFileSync(inputs.k3sServerNixPath, "utf-8");
  const localStorageSource = readFileSync(inputs.localStorageNixPath, "utf-8");
  const moduleDir = dirname(inputs.k3sServerNixPath);

  const pathEntries = parseManifestSourceRoster(k3sServerSource, moduleDir);
  const inline = parseInlineWriteTextManifest(localStorageSource, "local-path-provisioner");

  const seenAttrs = new Set<string>();
  const roster: RosterEntry[] = [];
  for (const entry of pathEntries) {
    if (seenAttrs.has(entry.attr)) {
      throw new Error(`duplicate manifest attribute \`${entry.attr}\` — a silent overwrite in the real roster`);
    }
    seenAttrs.add(entry.attr);
    // One syscall, one answer: read and interpret the failure, rather than
    // existsSync-then-readFileSync (a check-then-use race — the path can be
    // created/deleted/replaced between the two calls, CWE-367).
    let content: string;
    try {
      content = readFileSync(entry.path, "utf-8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`${entry.attr}: source ${entry.literal} resolves to ${entry.path}, which does not exist`);
      }
      throw e;
    }
    roster.push({
      attr: entry.attr,
      filename: manifestTargetFilename(entry.attr),
      content,
      sourceDescription: entry.literal,
    });
  }
  if (seenAttrs.has("local-path-provisioner")) {
    throw new Error("local-path-provisioner declared in BOTH k3s-server.nix and local-storage.nix — collision");
  }
  roster.push({
    attr: "local-path-provisioner",
    filename: manifestTargetFilename("local-path-provisioner"),
    content: inline.content,
    sourceDescription: `local-storage.nix inline pkgs.writeText "${inline.filename}"`,
  });

  // Cross-check against local-storage.nix's OWN services.k3s.manifests attrset
  // shape (mirrors the eval test's "no two modules declare the same name").
  // local-storage.nix declares exactly one attr; if it ever grows a second
  // one, the block-scan below notices even though parseInlineWriteTextManifest
  // only ever looks for the named one.
  const localStorageBlock = extractBracedBlock(localStorageSource, "manifests = {", "{", "}");
  const localStorageAttrCount = (localStorageBlock.match(/^\s*([\w-]+)\.source\s*=/gm) ?? []).length;
  if (localStorageAttrCount !== 1) {
    throw new Error(
      `local-storage.nix declares ${String(localStorageAttrCount)} manifests attribute(s), expected exactly 1 ` +
        `(local-path-provisioner) — this parser needs updating, it is not silently correct for a second entry`,
    );
  }

  return roster.sort((a, b) => compareOrdinal(a.filename, b.filename));
}

// ──────────────────────── HelmChart extraction ──────────────────────────

export interface HelmChartRef {
  readonly rosterAttr: string;
  readonly name: string;
  /** The HelmChart CR's OWN namespace — where its helm-install Job runs. Always kube-system in this roster. */
  readonly namespace: string;
  /**
   * Where the CHART ITSELF is installed (`spec.targetNamespace`) — where the
   * `sh.helm.release.v1.<name>.*` Secret helm/helm-controller creates lives.
   * MEASURED (2026-09-22): five of seven charts here target a DIFFERENT
   * namespace than the CR itself (argocd, cert-manager, external-secrets,
   * spire, trust-manager) — a dual-owner check that queried `namespace` for
   * the release secret found nothing for any of them. Defaults to the CR's
   * own namespace when unset, matching k3s's helm-controller default.
   */
  readonly targetNamespace: string;
  readonly chart: string;
  readonly version: string;
  /** `bootstrap: true` — tolerates the not-ready:NoSchedule taint (only Cilium). */
  readonly bootstrap: boolean;
}

/** `apiVersion` group boundary, anchored: `"helm.cattle.io/v1"` matches, `"helm.cattle.io.evil.example/v1"` does not. */
function isHelmCattleIoApiVersion(apiVersion: string): boolean {
  return apiVersion === "helm.cattle.io" || apiVersion.startsWith("helm.cattle.io/");
}

function isHelmChartDoc(doc: unknown): doc is { apiVersion: string; kind: string; metadata: Record<string, unknown>; spec: Record<string, unknown> } {
  if (typeof doc !== "object" || doc === null) return false;
  const d = doc as Record<string, unknown>;
  // CodeQL js/incomplete-url-substring-sanitization: a bare `startsWith("helm.cattle.io")`
  // also accepts "helm.cattle.io.evil.example/v1" — anchor on the "/" group
  // separator (or an exact match) so only the real API group passes.
  return typeof d["apiVersion"] === "string" && isHelmCattleIoApiVersion(d["apiVersion"]) && d["kind"] === "HelmChart";
}

/** Every `helm.cattle.io/v1 HelmChart` document across the roster's YAML content. */
export function extractHelmCharts(roster: readonly RosterEntry[]): HelmChartRef[] {
  const charts: HelmChartRef[] = [];
  for (const entry of roster) {
    const docs = parseAllDocuments(entry.content, { uniqueKeys: true, strict: true });
    for (const doc of docs) {
      if (doc.errors.length > 0) continue; // non-YAML docs (e.g. the license header) — not this parser's job
      const value = doc.toJS() as unknown;
      if (!isHelmChartDoc(value)) continue;
      const metadata = value.metadata as { name?: unknown; namespace?: unknown };
      const spec = value.spec as { chart?: unknown; version?: unknown; bootstrap?: unknown; targetNamespace?: unknown };
      if (typeof metadata.name !== "string" || typeof spec.chart !== "string" || typeof spec.version !== "string") {
        throw new Error(`${entry.attr}: HelmChart is missing name/chart/version — cannot track its install Job`);
      }
      const namespace = typeof metadata.namespace === "string" ? metadata.namespace : "default";
      charts.push({
        rosterAttr: entry.attr,
        name: metadata.name,
        namespace,
        targetNamespace: typeof spec.targetNamespace === "string" ? spec.targetNamespace : namespace,
        chart: spec.chart,
        version: spec.version,
        bootstrap: spec.bootstrap === true,
      });
    }
  }
  return charts.sort((a, b) => compareOrdinal(a.name, b.name));
}

// ────────────────────── k3s version + CIDR derivation ───────────────────

export interface KubernetesVersionPin {
  readonly kubernetesVersion: string;
  readonly k3sVersion: string;
}

/** Reads the ONE declared k3s version — no second literal, per that file's own header. */
export function readKubernetesVersionPin(path: string): KubernetesVersionPin {
  const parsed = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  const kubernetesVersion = parsed["kubernetesVersion"];
  const k3sVersion = parsed["k3sVersion"];
  if (typeof kubernetesVersion !== "string" || typeof k3sVersion !== "string") {
    throw new Error(`${path}: missing kubernetesVersion/k3sVersion string fields`);
  }
  return { kubernetesVersion, k3sVersion };
}

/** `1.35.6+k3s1` (nixpkgs form) -> `v1.35.6-k3s1` (rancher/k3s Docker Hub tag form). */
export function k3sVersionToDockerTag(k3sVersion: string): string {
  if (!/^\d+\.\d+\.\d+\+k3s\d+$/.test(k3sVersion)) {
    throw new Error(`k3sVersion \`${k3sVersion}\` is not of the form <semver>+k3s<n> this converter understands`);
  }
  return `v${k3sVersion.replace("+", "-")}`;
}

export interface ClusterIdentity {
  readonly clusterName: string;
}

export function readClusterIdentity(path: string): ClusterIdentity {
  const parsed = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  const clusterName = parsed["clusterName"];
  if (typeof clusterName !== "string") throw new Error(`${path}: missing clusterName string field`);
  return { clusterName };
}

// ──────────────────── root-application.yaml patching ────────────────────

/**
 * The ONE permitted modification (WP1 spec): point `root-application.yaml`'s
 * `spec.source.repoURL` / `targetRevision` at the ref under test. Applied by
 * targeted line replacement rather than a full YAML re-serialize, so the
 * file's comments (the "Adding a workload" walkthrough, the either/or-gating
 * note) survive byte-for-byte except the two changed values — a reviewer
 * diffing the rendered manifest against the checked-in one sees exactly the
 * one divergence this harness is allowed to make.
 */
export function patchRootApplicationRevision(content: string, repoUrl: string, targetRevision: string): string {
  let patched = content;
  let repoUrlPatched = false;
  let revisionPatched = false;
  patched = patched.replace(/(^\s*repoURL:\s*).*/m, (_match, prefix: string) => {
    repoUrlPatched = true;
    return `${prefix}${repoUrl}`;
  });
  patched = patched.replace(/(^\s*targetRevision:\s*).*/m, (_match, prefix: string) => {
    revisionPatched = true;
    return `${prefix}${targetRevision}`;
  });
  if (!repoUrlPatched || !revisionPatched) {
    throw new Error(
      `root-application.yaml: could not find ${repoUrlPatched ? "" : "repoURL "}${revisionPatched ? "" : "targetRevision "}` +
        `to patch — the file's shape has changed under this parser`,
    );
  }
  return patched;
}

// ───────────────────────────── The plan ─────────────────────────────────

export interface Divergence {
  readonly id: string;
  readonly reason: string;
}

export interface ReplicaPlan {
  readonly clusterName: string;
  readonly podCidr: string;
  readonly serviceCidr: string;
  readonly k3sVersion: string;
  readonly image: string;
  readonly extraFlags: readonly string[];
  readonly roster: readonly RosterEntry[];
  readonly applyOrder: readonly string[];
  readonly helmCharts: readonly HelmChartRef[];
  readonly rootRepoUrl: string;
  readonly rootTargetRevision: string;
  readonly divergences: readonly Divergence[];
}

export interface BuildPlanOptions {
  readonly repoRoot: string;
  readonly targetRevision: string;
  readonly repoUrlOverride?: string;
  readonly imageOverride?: string;
}

const K3S_SERVER_NIX = "full-ai-cluster/nixos/modules/k3s-server.nix";
const LOCAL_STORAGE_NIX = "full-ai-cluster/nixos/modules/local-storage.nix";
const KUBERNETES_VERSION_JSON = "full-ai-cluster/k8s/kubernetes-version.json";
const CLUSTER_IDENTITY_JSON = "full-ai-cluster/cluster-identity.json";
const ROOT_APPLICATION_ATTR = "root-application";

export function buildPlan(options: BuildPlanOptions): ReplicaPlan {
  const { repoRoot } = options;
  const k3sServerNixPath = join(repoRoot, K3S_SERVER_NIX);
  const localStorageNixPath = join(repoRoot, LOCAL_STORAGE_NIX);

  const { clusterName } = readClusterIdentity(join(repoRoot, CLUSTER_IDENTITY_JSON));
  const networkResult = deriveClusterNetwork(clusterName);
  if (!networkResult.ok) {
    throw new Error(`deriveClusterNetwork(${clusterName}) failed: ${networkResult.error}`);
  }
  const network = networkResult.value;

  const { k3sVersion } = readKubernetesVersionPin(join(repoRoot, KUBERNETES_VERSION_JSON));
  const image = options.imageOverride ?? `rancher/k3s:${k3sVersionToDockerTag(k3sVersion)}`;

  const substitutions = new Map<string, string>([
    ["${config.zeta.cluster.podCidr}", network.podCidr],
    ["${config.zeta.cluster.serviceCidr}", network.serviceCidr],
  ]);
  const extraFlags = parseExtraFlags(readFileSync(k3sServerNixPath, "utf-8"), substitutions);

  let roster = buildRoster({ k3sServerNixPath, localStorageNixPath });
  const helmCharts = extractHelmCharts(roster);

  const rootEntry = roster.find((e) => e.attr === ROOT_APPLICATION_ATTR);
  if (rootEntry === undefined) {
    throw new Error(`roster has no \`${ROOT_APPLICATION_ATTR}\` entry — this harness cannot answer its own question`);
  }
  const originalRootDoc = parseAllDocuments(rootEntry.content)[0]?.toJS() as
    | { spec?: { source?: { repoURL?: unknown; targetRevision?: unknown } } }
    | undefined;
  const originalRepoUrl = originalRootDoc?.spec?.source?.repoURL;
  if (typeof originalRepoUrl !== "string") {
    throw new Error("root-application.yaml: spec.source.repoURL is not a string");
  }
  const rootRepoUrl = options.repoUrlOverride ?? originalRepoUrl;
  const patchedContent = patchRootApplicationRevision(rootEntry.content, rootRepoUrl, options.targetRevision);
  roster = roster.map((e) => (e.attr === ROOT_APPLICATION_ATTR ? { ...e, content: patchedContent } : e));

  const applyOrder = roster.map((e) => e.filename);

  const divergences: Divergence[] = [
    {
      id: "container-not-nixos-vm",
      reason:
        "Running the rancher/k3s Docker image, not a NixOS VM: no systemd, no real disk device, no NixOS-managed " +
        "/etc/hosts (this harness passes --add-host control-plane:127.0.0.1 to reproduce the one entry that matters), " +
        "and none of k3s-server.nix's preflight units (k3sDatastorePreflight, k3sJoinIntentPreflight) run.",
    },
    {
      id: "root-application-target-revision",
      reason:
        `root-application.yaml's spec.source.targetRevision is patched from the committed value to ` +
        `\`${options.targetRevision}\` (repoURL: ${rootRepoUrl}) so ArgoCD reconciles the ref under test, per the ` +
        `WP1 spec's one permitted modification. Everything else in the roster is byte-identical to what k3s-server.nix declares.`,
    },
    {
      id: "no-longhorn-disks",
      reason:
        "No real/extra block devices are attached to the container, so Longhorn (an ArgoCD-owned child Application, " +
        "not in this bootstrap roster) cannot provide replicated storage here. Applications requesting " +
        "storageClass: longhorn will stay Pending unless the dev-cluster longhorn alias " +
        "(full-ai-cluster/dev-cluster/manifests/longhorn.yaml) is applied by --with-longhorn-alias.",
    },
    {
      id: "no-gpu",
      reason: "No nvidia.com/gpu device plugin or GPU hardware; worker-gpu-only manifests and GPU-requesting child Applications cannot schedule.",
    },
    {
      id: "mount-propagation-forced-shared-post-start",
      reason:
        "MEASURED (2026-09-22): a container-create-time --mount of the host's /sys/fs/bpf with propagation=rshared " +
        "is refused by Docker ('is not a shared mount') unless the DOCKER HOST's own /sys/fs/bpf is already a " +
        "shared mount, which NixOS metal guarantees (systemd mounts the root shared by default) but Docker " +
        "Desktop and a bare CI runner do not. Cilium bind-mounts TWO paths for its sibling envoy container to " +
        "share (bpffs at /sys/fs/bpf, a cgroup2 view at /run/cilium/cgroupv2), each failing the same way in turn. " +
        "This harness execs `mount --make-rshared /` INSIDE the replica right after it starts, achieving the " +
        "same node-level property metal's shared root gives Cilium for free, without touching the Docker host.",
    },
  ];

  return {
    clusterName,
    podCidr: network.podCidr,
    serviceCidr: network.serviceCidr,
    k3sVersion,
    image,
    extraFlags,
    roster,
    applyOrder,
    helmCharts,
    rootRepoUrl,
    rootTargetRevision: options.targetRevision,
    divergences,
  };
}

/**
 * Insert a `directory.exclude: '<glob>'` line into `root-application.yaml`, anchored
 * on its existing `include:` line (same indentation). The real metal manifest never
 * carries an exclude — every child Application is meant to land on metal — so this is
 * additive rather than a replacement, and it throws rather than silently no-op'ing if
 * the anchor line is not found (a parser that goes quiet on a shape it cannot see is
 * the vacuity class `first-boot-replica.ts`'s own docstring already refuses).
 */
export function injectRootApplicationExclude(content: string, excludeGlob: string): string {
  const includeLine = /^([ \t]*)include:[ \t]*.*$/m.exec(content);
  if (includeLine === null) {
    throw new Error(
      "root-application.yaml: could not find the `include:` line to anchor a `directory.exclude` insertion — " +
        "the file's shape has changed under this parser",
    );
  }
  const indent = includeLine[1] ?? "";
  const insertAt = includeLine.index + includeLine[0].length;
  return `${content.slice(0, insertAt)}\n${indent}exclude: '${excludeGlob}'${content.slice(insertAt)}`;
}

export interface ServeTreeOverride {
  readonly manifests: string;
  readonly repoUrl: string;
  readonly gitRef: string;
  readonly excludeGlob: string;
}

/**
 * Point the roster's `root-application` entry at an in-cluster, rung-overlaid tree
 * instead of the committed metal tree on GitHub, and exclude the same directories the
 * included dev/CI ArgoCD lane excludes — so stage 6 measures whether the catalog
 * converges at a resource budget this replica can actually schedule, not whether a
 * 4-vCPU runner can satisfy metal-sized requests plus real, disk-less Longhorn.
 *
 * TWO SEPARATE re-patches of `root-application`'s content, applied in order:
 *   1. `patchRootApplicationRevision` — same function `buildPlan` already used to
 *      point at the GitHub ref under test; called again here to point at the served
 *      tree instead. Idempotent-compatible: it replaces whichever `repoURL:` /
 *      `targetRevision:` values are currently there.
 *   2. `injectRootApplicationExclude` — adds the one line the metal manifest never
 *      carries.
 *
 * Each override is recorded as its OWN named `Divergence` (WP1b spec item 1: "Each
 * exclusion prints as a named DIVERGENCE"), so `--dry-run` and the run-start log both
 * say plainly that this run is not testing the metal tree byte-for-byte.
 */
export function applyServeTreeOverride(plan: ReplicaPlan, override: ServeTreeOverride): ReplicaPlan {
  const rootEntry = plan.roster.find((e) => e.attr === ROOT_APPLICATION_ATTR);
  if (rootEntry === undefined) {
    throw new Error(`applyServeTreeOverride: roster has no \`${ROOT_APPLICATION_ATTR}\` entry`);
  }
  const revisionPatched = patchRootApplicationRevision(rootEntry.content, override.repoUrl, override.gitRef);
  const content = injectRootApplicationExclude(revisionPatched, override.excludeGlob);
  const roster = plan.roster.map((e) => (e.attr === ROOT_APPLICATION_ATTR ? { ...e, content } : e));
  const divergences: Divergence[] = [
    ...plan.divergences,
    {
      id: "serve-tree-dev-rung",
      reason:
        `root-application.yaml's repoURL/targetRevision are RE-patched (on top of the WP1 permitted ` +
        `repoURL/targetRevision patch above) to an in-cluster git server (${override.repoUrl}, ref ` +
        `${override.gitRef}) serving a copy of full-ai-cluster/k8s with the "dev" resource rung and its ` +
        `rung-overrides applied (src/Core.TypeScript/cluster/lane-tree-source.ts, storage-profiles.ts, ` +
        `rung-overrides.ts — the SAME pipeline the live-kind/live-k3d included ArgoCD lanes use). Everything ` +
        `else in the roster, including the k3s bootstrap HelmCharts stage 1-3 already asserted, is unaffected.`,
    },
    {
      id: "serve-tree-exclude-glob",
      reason:
        `root-application.yaml gained a directory.exclude: '${override.excludeGlob}' it does not carry on ` +
        `metal, imported unchanged from ports.ts's DEFAULT_ROOT_DEV_CATALOG.excludeGlob via ` +
        `rootDevCatalogExcludeGlobFor -- the SAME glob the included dev/CI ArgoCD lane excludes, with "cilium" ` +
        `already dropped because THIS replica already runs a real Cilium via its own k3s bootstrap roster ` +
        `(stage 2), the same condition that drops it for k3d/kind --cni cilium. Each excluded directory's own ` +
        `named reason (why it cannot converge in CI, and what lifts it) lives in argocd-health-test.ts's ` +
        `DEV_EXCLUDED_REASONS / DEV_INCLUDED_PROOF_DEFERRED_DIRS / APPLIED_BUT_UNASSERTED_REASONS -- imported ` +
        `by reference here, not restated, so the two lanes cannot silently disagree about what "excluded" means.`,
    },
  ];
  return { ...plan, roster, applyOrder: roster.map((e) => e.filename), divergences };
}

// ──────────────── Stage 6: pod/app convergence classification ───────────
//
// PURE, unit-tested classification of "why is this pod not Running/Ready yet" —
// the WP1b spec's item 3. Each rule is checked by a test that fails if the rule
// is inverted (a CrashLoopBackOff read as CAPACITY would pass the harness on a
// genuinely broken app, which is the exact false-green stage 6 exists to remove).

/** One `helm.cattle.io` job-pod OR ArgoCD child-Application pod, as `kubectl get pods -A -o json` reports it. */
export interface PodSummary {
  readonly namespace: string;
  readonly name: string;
  readonly phase: string;
  /** True once the pod has a `PodScheduled: True` condition OR at least one container status (i.e. a node was assigned). */
  readonly scheduled: boolean;
  /** `containerStatuses[].state.waiting.reason` across every container, e.g. `CrashLoopBackOff`, `ImagePullBackOff`. */
  readonly containerWaitingReasons: readonly string[];
  /** Max restartCount across this pod's containers. */
  readonly restartCount: number;
}

/** A `FailedScheduling` Warning event against a Pod, as `kubectl get events -A -o json` reports it. */
export interface FailedSchedulingEvent {
  readonly namespace: string;
  readonly podName: string;
  readonly message: string;
}

export type PodIssueCategory = "CAPACITY" | "STORAGE" | "IMAGE" | "SECRET" | "CRASHLOOP" | "UNKNOWN";

export interface PodVerdict {
  readonly namespace: string;
  readonly name: string;
  /** `null` for a healthy/succeeded pod that needs no classification. */
  readonly category: PodIssueCategory | null;
  /** CAPACITY/STORAGE are named-and-tolerated substrate gaps (a DIVERGENCE); everything else FAILs the app. */
  readonly isFailure: boolean;
  readonly detail: string;
}

const CAPACITY_MESSAGE = /Insufficient (?:cpu|memory)/i;
const STORAGE_MESSAGE = /unbound(?: immediate)? persistentvolumeclaim|persistentvolumeclaim ".*" not found/i;

/**
 * Classify ONE pod. Rule order matters: a container already scheduled and
 * waiting on a concrete reason (CrashLoopBackOff/ImagePullBackOff/ErrImagePull/
 * CreateContainerConfigError) is checked BEFORE the not-yet-scheduled branch,
 * because a pod can accumulate both a stale FailedScheduling event from an
 * earlier attempt and a live container-level reason — the container state is
 * the more current signal once one exists.
 *
 * Succeeded pods (completed Jobs — WP1b spec item 2, "exclude Succeeded pods
 * from crash-loop counting") and Running pods with zero restarts return
 * `category: null` — nothing to classify, converged.
 */
export function classifyPod(pod: PodSummary, failedScheduling: readonly FailedSchedulingEvent[]): PodVerdict {
  const base = { namespace: pod.namespace, name: pod.name };
  if (pod.phase === "Succeeded") {
    return { ...base, category: null, isFailure: false, detail: "Succeeded (completed Job pod)" };
  }
  if (pod.containerWaitingReasons.includes("CrashLoopBackOff")) {
    return { ...base, category: "CRASHLOOP", isFailure: true, detail: "CrashLoopBackOff" };
  }
  const imageReason = pod.containerWaitingReasons.find((r) => r === "ImagePullBackOff" || r === "ErrImagePull");
  if (imageReason !== undefined) {
    return { ...base, category: "IMAGE", isFailure: true, detail: imageReason };
  }
  if (pod.containerWaitingReasons.includes("CreateContainerConfigError")) {
    return { ...base, category: "SECRET", isFailure: true, detail: "CreateContainerConfigError" };
  }
  if (pod.phase === "Running" && pod.restartCount === 0) {
    return { ...base, category: null, isFailure: false, detail: "Running, no restarts" };
  }
  if (!pod.scheduled) {
    const event = failedScheduling.find((e) => e.namespace === pod.namespace && e.podName === pod.name);
    if (event !== undefined) {
      if (CAPACITY_MESSAGE.test(event.message)) {
        return { ...base, category: "CAPACITY", isFailure: false, detail: event.message };
      }
      if (STORAGE_MESSAGE.test(event.message)) {
        return { ...base, category: "STORAGE", isFailure: false, detail: event.message };
      }
      return { ...base, category: "UNKNOWN", isFailure: true, detail: `FailedScheduling: ${event.message}` };
    }
  }
  return {
    ...base,
    category: "UNKNOWN",
    isFailure: true,
    detail: `not converged: phase=${pod.phase} scheduled=${String(pod.scheduled)} restartCount=${String(pod.restartCount)}`,
  };
}

/** Classify every pod; drops the converged (`category: null`) ones — callers only need the issues. */
export function classifyPods(
  pods: readonly PodSummary[],
  failedScheduling: readonly FailedSchedulingEvent[],
): readonly PodVerdict[] {
  return pods.map((p) => classifyPod(p, failedScheduling)).filter((v): v is PodVerdict & { category: PodIssueCategory } => v.category !== null);
}

export type AppVerdictLabel = "Healthy" | "DIVERGENCE" | "FAIL";

export interface AppConvergenceSnapshot {
  readonly name: string;
  readonly sync: string;
  readonly health: string;
}

export interface AppVerdict {
  readonly name: string;
  readonly sync: string;
  readonly health: string;
  readonly verdict: AppVerdictLabel;
  readonly reason: string;
}

/**
 * One Application's verdict, from ArgoCD's own sync/health plus every classified pod
 * issue attributed to it. Pod-to-Application attribution is by NAMESPACE — every
 * workload directory under `full-ai-cluster/k8s/applications/` deploys into a
 * namespace named after itself (measured across the roster this harness excludes and
 * asserts), so `pod.namespace === app.name` is the same correlation
 * `collectFailureDiagnostics`-style per-Application diagnostics already assume
 * elsewhere in this cluster tooling. An app with issues this rule cannot attribute
 * (no pod in a same-named namespace) still FAILs rather than reading as silently
 * Healthy — see the final branch.
 */
export function computeAppVerdict(app: AppConvergenceSnapshot, podIssues: readonly PodVerdict[]): AppVerdict {
  const mine = podIssues.filter((p) => p.namespace === app.name);
  if (app.health === "Healthy") {
    return { ...app, verdict: "Healthy", reason: "sync/health OK" };
  }
  if (mine.length === 0) {
    return {
      ...app,
      verdict: "FAIL",
      reason: `health=${app.health} with no classified pod issue in namespace "${app.name}" to explain it`,
    };
  }
  const failing = mine.filter((p) => p.isFailure);
  const summary = (list: readonly PodVerdict[]) => list.map((p) => `${p.name}:${String(p.category)}(${p.detail})`).join("; ");
  if (failing.length > 0) {
    return { ...app, verdict: "FAIL", reason: summary(failing) };
  }
  return { ...app, verdict: "DIVERGENCE", reason: summary(mine) };
}

export function computeAppVerdicts(
  apps: readonly AppConvergenceSnapshot[],
  podIssues: readonly PodVerdict[],
): readonly AppVerdict[] {
  return apps.map((a) => computeAppVerdict(a, podIssues));
}

/** Convergence-wait stop condition: no Application is still mid-reconcile. */
export function allApplicationsSettled(apps: readonly { readonly health: string }[]): boolean {
  return apps.every((a) => a.health !== "Progressing");
}

/** One container's restart count, sampled during the soak phase. */
export interface RestartSample {
  readonly namespace: string;
  readonly pod: string;
  readonly container: string;
  readonly restartCount: number;
}

/**
 * WP1b spec item 4: "FAIL if any container restartCount increases during the soak."
 * Pure diff between a `before` and `after` sample set, keyed on namespace/pod/container.
 * A container present in `after` but absent from `before` (a pod that appeared mid-soak)
 * is not a regression — there is nothing to compare it against, and a soak's job is to
 * catch something getting WORSE, not to catch new arrivals (stage 6's classifier already
 * covers those).
 */
export function restartCountRegressions(
  before: readonly RestartSample[],
  after: readonly RestartSample[],
): readonly RestartSample[] {
  const key = (s: RestartSample) => `${s.namespace}/${s.pod}/${s.container}`;
  const priorCounts = new Map(before.map((s) => [key(s), s.restartCount]));
  return after.filter((s) => {
    const prior = priorCounts.get(key(s));
    return prior !== undefined && s.restartCount > prior;
  });
}

// ═══════════════════════ Everything below needs Docker ═══════════════════

export interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export interface Runner {
  run(argv0: string, args: readonly string[], opts?: { timeoutMs?: number; stdin?: string }): CommandResult;
}

export class SpawnRunner implements Runner {
  run(argv0: string, args: readonly string[], opts: { timeoutMs?: number; stdin?: string } = {}): CommandResult {
    const result = spawnSync(argv0, [...args], {
      timeout: opts.timeoutMs,
      input: opts.stdin,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return {
      status: result.status,
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stderr: typeof result.stderr === "string" ? result.stderr : "",
    };
  }
}

export interface StageVerdict {
  readonly stage: number;
  readonly name: string;
  readonly ok: boolean | null; // null = inconclusive/not-attempted (never treated as pass)
  readonly elapsedSeconds: number;
  readonly detail: string;
  readonly evidence?: Record<string, unknown>;
}

export interface HelmChartAttempt {
  readonly name: string;
  readonly namespace: string;
  readonly succeeded: boolean;
  readonly failedAttempts: number;
  readonly elapsedSeconds: number;
  readonly detail: string;
}

/** Parse `kubectl get pods -A -o json` stdout into the shape `classifyPod` needs. Never throws — an unparseable/empty listing yields `[]`. */
export function parsePodSummaries(stdout: string): readonly PodSummary[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  const items = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const out: PodSummary[] = [];
  for (const item of items) {
    const record = item as {
      metadata?: { name?: unknown; namespace?: unknown };
      status?: {
        phase?: unknown;
        conditions?: { type?: unknown; status?: unknown }[];
        containerStatuses?: { restartCount?: unknown; state?: { waiting?: { reason?: unknown } } }[];
      };
    };
    const namespace = record.metadata?.namespace;
    const name = record.metadata?.name;
    if (typeof namespace !== "string" || typeof name !== "string") continue;
    const phase = typeof record.status?.phase === "string" ? record.status.phase : "Unknown";
    const statuses = record.status?.containerStatuses ?? [];
    const scheduledByCondition = (record.status?.conditions ?? []).some(
      (c) => c.type === "PodScheduled" && c.status === "True",
    );
    const containerWaitingReasons = statuses
      .map((cs) => cs.state?.waiting?.reason)
      .filter((r): r is string => typeof r === "string");
    const restartCount = statuses.reduce((max, cs) => Math.max(max, typeof cs.restartCount === "number" ? cs.restartCount : 0), 0);
    out.push({
      namespace,
      name,
      phase,
      scheduled: scheduledByCondition || statuses.length > 0,
      containerWaitingReasons,
      restartCount,
    });
  }
  return out;
}

/** Parse `kubectl get events -A -o json` stdout into `FailedScheduling` Warning events against Pods only. Never throws. */
export function parseFailedSchedulingEvents(stdout: string): readonly FailedSchedulingEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  const items = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const out: FailedSchedulingEvent[] = [];
  for (const item of items) {
    const record = item as {
      reason?: unknown;
      message?: unknown;
      involvedObject?: { kind?: unknown; name?: unknown; namespace?: unknown };
      metadata?: { namespace?: unknown };
    };
    if (record.reason !== "FailedScheduling") continue;
    if (record.involvedObject?.kind !== "Pod") continue;
    const podName = record.involvedObject.name;
    const namespace = record.involvedObject.namespace ?? record.metadata?.namespace;
    const message = record.message;
    if (typeof podName !== "string" || typeof namespace !== "string" || typeof message !== "string") continue;
    out.push({ namespace, podName, message });
  }
  return out;
}

/** Parse `kubectl get pods -A -o json` stdout into per-CONTAINER restart samples, for the soak phase's before/after diff. */
export function parseRestartSamples(stdout: string): readonly RestartSample[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  const items = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const out: RestartSample[] = [];
  for (const item of items) {
    const record = item as {
      metadata?: { name?: unknown; namespace?: unknown };
      status?: { containerStatuses?: { name?: unknown; restartCount?: unknown }[] };
    };
    const namespace = record.metadata?.namespace;
    const pod = record.metadata?.name;
    if (typeof namespace !== "string" || typeof pod !== "string") continue;
    for (const cs of record.status?.containerStatuses ?? []) {
      if (typeof cs.name !== "string" || typeof cs.restartCount !== "number") continue;
      out.push({ namespace, pod, container: cs.name, restartCount: cs.restartCount });
    }
  }
  return out;
}

/** `docker run` argv for the replica, matching the official rancher/k3s single-node Docker recipe plus this roster's flags. */
export function buildDockerRunArgs(opts: {
  readonly containerName: string;
  readonly image: string;
  readonly manifestsHostDir: string;
  readonly hostApiPort: number;
  readonly extraFlags: readonly string[];
}): string[] {
  return [
    "run",
    "-d",
    "--name",
    opts.containerName,
    "--hostname",
    "control-plane",
    "--privileged",
    "--tmpfs",
    "/run",
    "--tmpfs",
    "/var/run",
    "-v",
    `${opts.containerName}-data:/var/lib/rancher/k3s`,
    // NOT read-only. MEASURED (2026-09-22): a read-only mount here makes k3s
    // fail hard at startup — "failed to write to /ccm.yaml: open
    // .../manifests/ccm.yaml: read-only file system" — because k3s itself
    // writes additional static manifests (the cloud-controller-manager addon,
    // etc.) into this SAME directory at boot, on top of whatever
    // services.k3s.manifests declared. Real NixOS metal mounts this directory
    // read-write for the same reason; `:ro` was an artificial divergence from
    // metal, not a safety measure, and it made the replica fail before stage 1.
    "-v",
    `${opts.manifestsHostDir}:/var/lib/rancher/k3s/server/manifests`,
    // NOTE: no --mount of the HOST's /sys/fs/bpf here. A bind-mount with
    // propagation=rshared at container-CREATE time requires the SOURCE to
    // already be a shared mount on the Docker daemon's own host — which fails
    // outright ("path /sys/fs/bpf is mounted on /sys/fs/bpf but it is not a
    // shared mount", MEASURED 2026-09-22) on Docker Desktop and is not
    // guaranteed on a bare Linux CI runner either. Fixed differently, AFTER
    // the container starts — see the `mount --make-rshared /` call in
    // `runReplica` below, right after the container is confirmed exec-able.
    "--add-host",
    "control-plane:127.0.0.1",
    "-p",
    `127.0.0.1:${String(opts.hostApiPort)}:6443`,
    opts.image,
    "server",
    ...opts.extraFlags,
  ];
}

function nowSeconds(): number {
  return Date.now() / 1000;
}

function kubectl(runner: Runner, kubeconfigPath: string, args: readonly string[], timeoutMs = 30_000): CommandResult {
  return runner.run("kubectl", ["--kubeconfig", kubeconfigPath, ...args], { timeoutMs });
}

async function waitUntil(
  deadlineSeconds: number,
  pollMs: number,
  probe: () => boolean,
): Promise<boolean> {
  while (nowSeconds() < deadlineSeconds) {
    if (probe()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return probe();
}

export interface RunOptions {
  readonly plan: ReplicaPlan;
  readonly runner: Runner;
  readonly scratchDir: string;
  readonly containerName: string;
  readonly hostApiPort: number;
  readonly keep: boolean;
  readonly withLonghornAlias: boolean;
  readonly stage3TimeoutSec: number;
  readonly stage4TimeoutSec: number;
  readonly stage567TimeoutSec: number;
  /**
   * Soak window, seconds (WP1b spec item 4): after stage 6's convergence wait ends
   * (settled or timed out), re-sample every container's restartCount every `pollMs`
   * for this long and FAIL if any of them increases. `0` skips the soak entirely —
   * used by callers (and this harness's own tests-by-inspection) that only care about
   * the point-in-time convergence snapshot.
   */
  readonly soakSec: number;
  readonly pollMs: number;
  /**
   * Rendered `Namespace + ConfigMap×2 + Service + Deployment` manifests for the
   * in-cluster lane-tree git server (`argocd-health-test.ts`'s `buildLaneTreeForProfile`,
   * imported — see `applyServeTreeOverride`). Applied via `kubectl apply --server-side
   * --force-conflicts` right after stage 1 (API up), same flags
   * `kubectl-control-plane.ts`'s `applyInlineManifest(..., true)` uses for the identical
   * payload in the kind/k3d lanes. `undefined` when `--serve-tree` was not passed.
   */
  readonly laneTreeManifests?: string;
  readonly log: (line: string) => void;
}

export interface RunReport {
  readonly plan: {
    readonly clusterName: string;
    readonly podCidr: string;
    readonly serviceCidr: string;
    readonly k3sVersion: string;
    readonly image: string;
    readonly extraFlags: readonly string[];
    readonly applyOrder: readonly string[];
    readonly helmCharts: readonly { readonly name: string; readonly namespace: string; readonly chart: string; readonly version: string }[];
    readonly divergences: readonly Divergence[];
  };
  readonly stages: readonly StageVerdict[];
  /** Per-app verdict table (WP1b spec item 5) — `[]` when stage 6 never ran (an earlier stage failed first). */
  readonly appVerdicts: readonly AppVerdict[];
  readonly ok: boolean;
}

/** docker exec into the container and read /etc/rancher/k3s/k3s.yaml, rewriting the server URL to the published host port. */
function fetchKubeconfig(runner: Runner, containerName: string, hostApiPort: number): string {
  const result = runner.run("docker", ["exec", containerName, "cat", "/etc/rancher/k3s/k3s.yaml"], { timeoutMs: 15_000 });
  if (result.status !== 0) throw new Error(`could not read kubeconfig from ${containerName}: ${result.stderr}`);
  return result.stdout.replace(/server:\s*https:\/\/127\.0\.0\.1:6443/, `server: https://127.0.0.1:${String(hostApiPort)}`);
}

export async function runReplica(opts: RunOptions): Promise<RunReport> {
  const { plan, runner, log } = opts;
  const stages: StageVerdict[] = [];
  const t0 = nowSeconds();

  mkdirSync(opts.scratchDir, { recursive: true });
  const manifestsDir = join(opts.scratchDir, "manifests");
  mkdirSync(manifestsDir, { recursive: true });
  for (const entry of plan.roster) {
    writeFileSync(join(manifestsDir, entry.filename), entry.content, "utf-8");
  }
  if (opts.withLonghornAlias) {
    const aliasPath = join(REPO_ROOT, "full-ai-cluster/dev-cluster/manifests/longhorn.yaml");
    // One syscall, one answer — see the identical fix (and its reason) in buildRoster above.
    try {
      writeFileSync(join(manifestsDir, "zz-longhorn-alias.yaml"), readFileSync(aliasPath, "utf-8"), "utf-8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      // --with-longhorn-alias is best-effort: the alias manifest not existing
      // is a recorded divergence, not a fatal error for the replica run.
    }
  }

  log(`pulling ${plan.image} ...`);
  const pull = runner.run("docker", ["pull", plan.image], { timeoutMs: 600_000 });
  if (pull.status !== 0) {
    return {
      plan: planSummary(plan),
      stages: [{ stage: 0, name: "docker pull", ok: false, elapsedSeconds: nowSeconds() - t0, detail: pull.stderr || pull.stdout }],
      appVerdicts: [],
      ok: false,
    };
  }

  const runArgs = buildDockerRunArgs({
    containerName: opts.containerName,
    image: plan.image,
    manifestsHostDir: manifestsDir,
    hostApiPort: opts.hostApiPort,
    extraFlags: [...plan.extraFlags],
  });
  log(`docker ${runArgs.join(" ")}`);
  const started = runner.run("docker", runArgs, { timeoutMs: 60_000 });
  if (started.status !== 0) {
    return {
      plan: planSummary(plan),
      stages: [{ stage: 0, name: "docker run", ok: false, elapsedSeconds: nowSeconds() - t0, detail: started.stderr || started.stdout }],
      appVerdicts: [],
      ok: false,
    };
  }

  const kubeconfigPath = join(opts.scratchDir, "kubeconfig.yaml");

  // Make the replica's ENTIRE mount tree recursively SHARED, inside its OWN
  // mount namespace (not the Docker host's — see buildDockerRunArgs' note on
  // why a container-create-time --mount rshared bind fails on Docker Desktop
  // and is not portable to a bare-Linux CI runner either).
  //
  // MEASURED (2026-09-22), in order, each only visible once the previous one
  // was fixed: Cilium's agent bind-mounts (1) bpffs at /sys/fs/bpf and (2) a
  // cgroup2 view at /run/cilium/cgroupv2, EACH so its sibling envoy container
  // in the same pod can see it. Docker's default propagation is PRIVATE for
  // both --tmpfs (/run) and the image's own /sys, so every cilium/
  // cilium-envoy container failed with "is not a shared [or slave] mount" —
  // first on /sys/fs/bpf, then on /run/cilium/cgroupv2 the moment the first
  // one was fixed. Rather than chase each bind mount Cilium creates
  // one-by-one, `mount --make-rshared /` covers this one and any future one
  // the same way NixOS metal's systemd-managed shared root does.
  for (let attempt = 0; attempt < 10; attempt++) {
    const probe = runner.run("docker", ["exec", opts.containerName, "true"], { timeoutMs: 5_000 });
    if (probe.status === 0) break;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  const shareResult = runner.run("docker", ["exec", opts.containerName, "mount", "--make-rshared", "/"], {
    timeoutMs: 10_000,
  });
  if (shareResult.status !== 0) {
    log(`WARNING: could not make / recursively shared (${shareResult.stderr || shareResult.stdout}) — Cilium will likely fail with CreateContainerError`);
  }

  try {
    // ── Stage 1: k3s API up ───────────────────────────────────────────
    const s1Start = nowSeconds();
    const s1Deadline = s1Start + 300;
    let kubeconfigReady = false;
    let apiUp = false;
    await waitUntil(s1Deadline, opts.pollMs, () => {
      if (!kubeconfigReady) {
        const check = runner.run("docker", ["exec", opts.containerName, "test", "-f", "/etc/rancher/k3s/k3s.yaml"]);
        if (check.status === 0) {
          writeFileSync(kubeconfigPath, fetchKubeconfig(runner, opts.containerName, opts.hostApiPort), "utf-8");
          kubeconfigReady = true;
        } else {
          return false;
        }
      }
      const ready = kubectl(runner, kubeconfigPath, ["get", "--raw=/readyz"], 10_000);
      apiUp = ready.status === 0;
      return apiUp;
    });
    stages.push({
      stage: 1,
      name: "k3s API up",
      ok: apiUp,
      elapsedSeconds: nowSeconds() - s1Start,
      detail: apiUp ? "GET /readyz OK" : "kubeconfig or /readyz never became available",
    });
    if (!apiUp) {
      return { plan: planSummary(plan), stages, appVerdicts: [], ok: false };
    }

    // ── Serve tree (WP1b): apply the in-cluster lane-tree git server ──
    //
    // Same flags `kubectl-control-plane.ts`'s `applyInlineManifest(yaml, true)`
    // uses for the identical payload on the kind/k3d lanes: `--server-side
    // --force-conflicts`, because the packed tree ConfigMap's payload is well
    // over the 262144-byte last-applied-configuration ceiling a client-side
    // apply would try to write (lane-tree-source.ts's own docstring measured
    // this at 411676B). Applied here — right after the API is reachable, before
    // Cilium/node-Ready — because it has no dependency beyond API availability;
    // ArgoCD will not attempt to clone it until stage 3/4 land helm-controller's
    // ArgoCD chart and root-application respectively, by which point Cilium has
    // long since given the lane-tree pods a real IP.
    if (opts.laneTreeManifests !== undefined) {
      log("applying in-cluster lane-tree git server (Namespace+ConfigMap+ConfigMap+Service+Deployment) ...");
      const laneTreeApply = runner.run(
        "kubectl",
        ["--kubeconfig", kubeconfigPath, "apply", "--server-side", "--force-conflicts", "-f", "-"],
        { timeoutMs: 60_000, stdin: opts.laneTreeManifests },
      );
      stages.push({
        stage: 1,
        name: "lane-tree-serve apply",
        ok: laneTreeApply.status === 0,
        elapsedSeconds: nowSeconds() - s1Start,
        detail: laneTreeApply.status === 0 ? "applied" : laneTreeApply.stderr || laneTreeApply.stdout,
      });
      if (laneTreeApply.status !== 0) {
        return { plan: planSummary(plan), stages, appVerdicts: [], ok: false };
      }
    }

    // ── Stage 2: Cilium Running, node Ready ───────────────────────────
    const s2Start = nowSeconds();
    const s2Deadline = s2Start + 900;
    let ciliumRunning = false;
    await waitUntil(s2Deadline, opts.pollMs, () => {
      const pods = kubectl(runner, kubeconfigPath, [
        "-n",
        "kube-system",
        "get",
        "pods",
        "-l",
        "k8s-app=cilium",
        "--no-headers",
      ]);
      ciliumRunning = pods.status === 0 && / Running /.test(pods.stdout);
      return ciliumRunning;
    });
    let nodeReady = false;
    if (ciliumRunning) {
      await waitUntil(s2Deadline, opts.pollMs, () => {
        const wait = kubectl(runner, kubeconfigPath, ["wait", "--for=condition=Ready", "node", "--all", "--timeout=5s"]);
        nodeReady = wait.status === 0;
        return nodeReady;
      });
    }
    stages.push({
      stage: 2,
      name: "Cilium Running and node Ready",
      ok: ciliumRunning && nodeReady,
      elapsedSeconds: nowSeconds() - s2Start,
      detail: `cilium=${String(ciliumRunning)} nodeReady=${String(nodeReady)}`,
    });

    // ── Stage 3: every HelmChart CR's helm-install Job Succeeded ─────
    const s3Start = nowSeconds();
    const s3Deadline = s3Start + opts.stage3TimeoutSec;
    const attempts: HelmChartAttempt[] = [];
    for (const chart of plan.helmCharts) {
      const chartStart = nowSeconds();
      let succeeded = false;
      let failedAttempts = 0;
      let lastDetail = "job never appeared";
      await waitUntil(Math.min(s3Deadline, chartStart + opts.stage3TimeoutSec), opts.pollMs, () => {
        const job = kubectl(runner, kubeconfigPath, [
          "-n",
          chart.namespace,
          "get",
          "job",
          `helm-install-${chart.name}`,
          "-o",
          "json",
        ]);
        if (job.status !== 0) {
          lastDetail = "job not created yet";
          return false;
        }
        // MEASURED (2026-09-22): k3s's helm-install Jobs use restartPolicy:
        // OnFailure with a SINGLE pod, not one fresh pod per attempt — so
        // job.status.failed (which counts failed PODS) stays 0 even after a
        // chart retried repeatedly (trust-manager: 3 retries waiting for
        // cert-manager's webhook to come up, cert-manager: 3 retries waiting
        // for Cilium). The real retry count lives in that one pod's
        // containerStatuses[].restartCount, which is what "attempts" reports.
        const pods = kubectl(runner, kubeconfigPath, [
          "-n",
          chart.namespace,
          "get",
          "pods",
          "-l",
          `job-name=helm-install-${chart.name}`,
          "-o",
          "json",
        ]);
        let podRestarts = 0;
        try {
          const podsParsed = JSON.parse(pods.stdout) as {
            items?: { status?: { containerStatuses?: { restartCount?: number }[] } }[];
          };
          for (const pod of podsParsed.items ?? []) {
            for (const cs of pod.status?.containerStatuses ?? []) {
              podRestarts = Math.max(podRestarts, cs.restartCount ?? 0);
            }
          }
        } catch {
          /* pod query best-effort; job succeeded/failed below is the authoritative signal */
        }
        try {
          const parsed = JSON.parse(job.stdout) as { status?: { succeeded?: number; failed?: number } };
          failedAttempts = Math.max(parsed.status?.failed ?? 0, podRestarts);
          succeeded = (parsed.status?.succeeded ?? 0) > 0;
          lastDetail = succeeded
            ? `Job Succeeded after ${String(failedAttempts)} failed attempt(s)`
            : `Job running, ${String(failedAttempts)} failed attempt(s) so far`;
        } catch (e) {
          lastDetail = `could not parse Job status: ${reason(e)}`;
        }
        return succeeded;
      });
      attempts.push({
        name: chart.name,
        namespace: chart.namespace,
        succeeded,
        failedAttempts,
        elapsedSeconds: nowSeconds() - chartStart,
        detail: lastDetail,
      });
      log(`  helm-install-${chart.name}: ${succeeded ? "SUCCEEDED" : "DID NOT SUCCEED"} (${lastDetail})`);
    }
    const allChartsOk = attempts.every((a) => a.succeeded);
    stages.push({
      stage: 3,
      name: "every HelmChart CR's helm-install Job Succeeded",
      ok: allChartsOk,
      elapsedSeconds: nowSeconds() - s3Start,
      detail: attempts.map((a) => `${a.name}=${a.succeeded ? "OK" : "FAIL"}(${String(a.failedAttempts)} retries)`).join(", "),
      evidence: { attempts },
    });

    // ── Stage 4: root-application lands — ROOT_LANDED / ROOT_NEVER_LANDED ──
    const s4Start = nowSeconds();
    const s4Deadline = s4Start + opts.stage4TimeoutSec;
    let crdSeen = false;
    let applied = false;
    await waitUntil(s4Deadline, opts.pollMs, () => {
      if (!crdSeen) {
        crdSeen = kubectl(runner, kubeconfigPath, ["get", "crd", "applications.argoproj.io"]).status === 0;
      }
      applied = kubectl(runner, kubeconfigPath, ["-n", "argocd", "get", "application", "zeta-root"]).status === 0;
      return applied;
    });
    const verdict = applied ? "ROOT_LANDED" : crdSeen ? "ROOT_NEVER_LANDED" : "INCONCLUSIVE_CRD_NEVER_APPEARED";
    stages.push({
      stage: 4,
      name: "root-application lands (deploy-controller retry verdict)",
      ok: applied ? true : crdSeen ? false : null,
      elapsedSeconds: nowSeconds() - s4Start,
      detail: verdict,
      evidence: { crdSeen, applied },
    });

    if (!applied) {
      return { plan: planSummary(plan), stages, appVerdicts: [], ok: false };
    }

    // ── Stage 5: child Applications appear ────────────────────────────
    const s5Start = nowSeconds();
    const s5Deadline = s5Start + Math.min(opts.stage567TimeoutSec, 300);
    let childCount = 0;
    await waitUntil(s5Deadline, opts.pollMs, () => {
      const apps = kubectl(runner, kubeconfigPath, ["-n", "argocd", "get", "applications.argoproj.io", "-o", "name"]);
      childCount = apps.status === 0 ? apps.stdout.split("\n").filter((l) => l.trim().length > 0).length - 1 : 0;
      return childCount > 0;
    });
    stages.push({
      stage: 5,
      name: "child Applications appear",
      ok: childCount > 0,
      elapsedSeconds: nowSeconds() - s5Start,
      detail: `${String(Math.max(childCount, 0))} child Application(s) beyond zeta-root itself`,
    });

    // ── Stage 6: bounded convergence wait, classified per-app verdicts, soak ──
    //
    // Replaces the old "sleep stage567TimeoutSec, then snapshot once" shape (which
    // could not tell CAPACITY-Pending-by-design from a genuine crash loop, and
    // counted a Succeeded helm-install Job pod's already-reported retries as a
    // "crash loop"). Three parts, in order:
    //   1. Poll (up to stage567TimeoutSec, ~1800s in CI) until every Application's
    //      health has left "Progressing", or the deadline hits — WHICHEVER FIRST,
    //      so a fast-converging catalog does not pay the full budget every run.
    //   2. Classify: every non-Healthy Application gets a per-pod-issue reason via
    //      `classifyPod` (CAPACITY/STORAGE = DIVERGENCE, IMAGE/SECRET/CRASHLOOP/
    //      UNKNOWN = FAIL), producing the per-app verdict table (WP1b spec item 5).
    //   3. Soak (~300s in CI): re-sample every container's restartCount and FAIL if
    //      any of them increases while otherwise steady — a converged snapshot that
    //      then crash-loops is not convergence.
    const s6Start = nowSeconds();
    const s6Deadline = s6Start + opts.stage567TimeoutSec;
    let appConvergence: AppConvergenceSnapshot[] = [];
    let settled = false;
    await waitUntil(s6Deadline, opts.pollMs, () => {
      const appsJson = kubectl(runner, kubeconfigPath, ["-n", "argocd", "get", "applications.argoproj.io", "-o", "json"], 30_000);
      if (appsJson.status !== 0) return false;
      try {
        const parsed = JSON.parse(appsJson.stdout) as {
          items?: { metadata?: { name?: string }; status?: { sync?: { status?: string }; health?: { status?: string } } }[];
        };
        appConvergence = (parsed.items ?? [])
          .filter((a): a is typeof a & { metadata: { name: string } } => typeof a.metadata?.name === "string")
          .map((a) => ({
            name: a.metadata.name,
            sync: a.status?.sync?.status ?? "Unknown",
            health: a.status?.health?.status ?? "Unknown",
          }));
      } catch (e) {
        log(`WARNING: stage 6 could not parse Applications JSON: ${reason(e)}`);
        return false;
      }
      settled = appConvergence.length > 0 && allApplicationsSettled(appConvergence);
      return settled;
    });

    const podsJsonAtSettle = kubectl(runner, kubeconfigPath, ["get", "pods", "-A", "-o", "json"], 30_000);
    const eventsJson = kubectl(runner, kubeconfigPath, ["get", "events", "-A", "-o", "json"], 30_000);
    const podIssues = classifyPods(parsePodSummaries(podsJsonAtSettle.stdout), parseFailedSchedulingEvents(eventsJson.stdout));
    const appVerdicts = computeAppVerdicts(appConvergence, podIssues);
    const failingApps = appVerdicts.filter((v) => v.verdict === "FAIL");
    const divergentApps = appVerdicts.filter((v) => v.verdict === "DIVERGENCE");
    const healthyCount = appVerdicts.length - failingApps.length - divergentApps.length;

    log(
      `stage 6: settled=${String(settled)} apps=${String(appVerdicts.length)} Healthy=${String(healthyCount)} ` +
        `DIVERGENCE=${String(divergentApps.length)} FAIL=${String(failingApps.length)}`,
    );
    for (const v of [...failingApps, ...divergentApps]) log(`  [${v.verdict}] ${v.name}: ${v.reason}`);

    let soakRegressions: readonly RestartSample[] = [];
    if (opts.soakSec > 0) {
      const before = parseRestartSamples(podsJsonAtSettle.stdout);
      const soakDeadline = nowSeconds() + opts.soakSec;
      while (nowSeconds() < soakDeadline && soakRegressions.length === 0) {
        const remainingMs = Math.max(0, (soakDeadline - nowSeconds()) * 1000);
        await new Promise((r) => setTimeout(r, Math.min(opts.pollMs, remainingMs) || 1));
        if (nowSeconds() >= soakDeadline) break;
        const afterJson = kubectl(runner, kubeconfigPath, ["get", "pods", "-A", "-o", "json"], 30_000);
        soakRegressions = restartCountRegressions(before, parseRestartSamples(afterJson.stdout));
      }
      log(
        soakRegressions.length === 0
          ? `stage 6 soak: ${String(opts.soakSec)}s held with no restartCount regressions`
          : `stage 6 soak: restartCount regression on ${soakRegressions.map((r) => `${r.namespace}/${r.pod}[${r.container}]`).join(", ")}`,
      );
    }

    stages.push({
      stage: 6,
      name: "convergence report (per-Application verdict: Healthy/DIVERGENCE/FAIL) + soak",
      ok: failingApps.length === 0 && soakRegressions.length === 0,
      elapsedSeconds: nowSeconds() - s6Start,
      detail:
        `settled=${String(settled)}; ${String(appVerdicts.length)} Applications: ${String(healthyCount)} Healthy, ` +
        `${String(divergentApps.length)} DIVERGENCE, ${String(failingApps.length)} FAIL` +
        (opts.soakSec > 0
          ? `; soak ${String(opts.soakSec)}s: ${soakRegressions.length === 0 ? "steady" : `${String(soakRegressions.length)} restartCount regression(s)`}`
          : "; soak skipped (soakSec=0)"),
      evidence: { appVerdicts, podIssues, soakRegressions },
    });

    // ── Stage 7: dual-owner churn check ───────────────────────────────
    //
    // Six components in this roster are installed BOTH by k3s's
    // helm-controller (the bootstrap HelmChart CR) AND, once zeta-root lands,
    // by an ArgoCD Application: argocd, cilium, cert-manager, spire (+
    // spire-crds), trust-manager, external-secrets.
    //
    // Two independent signals, because they watch different owners:
    //   (a) the k3s-side Helm release Secret's resourceVersion — churns only
    //       if helm-controller re-installs/upgrades the release. MEASURED
    //       (2026-09-22): this secret lives in `spec.targetNamespace`, NOT
    //       the HelmChart CR's own namespace (kube-system) — five of the six
    //       target a DIFFERENT namespace, so a check that queried kube-system
    //       for all of them found nothing for any but cilium.
    //   (b) the ArgoCD Application's sync-status SEQUENCE — a healthy
    //       one-time reconcile goes OutOfSync -> Synced and stays there.
    //       Oscillating back to OutOfSync repeatedly (with no user-initiated
    //       change) is what "two reconcilers fighting" looks like from
    //       ArgoCD's own side, and it is visible even though ArgoCD's plain
    //       `kubectl apply`-style reconciliation never touches (a)'s secret.
    const DUAL_OWNED = plan.helmCharts.filter((c) =>
      ["argocd", "cilium", "cert-manager", "spire", "spire-crds", "trust-manager", "external-secrets"].includes(c.name),
    );
    const helmSecretSamples: Record<string, string[]> = {};
    const argoSyncSamples: Record<string, string[]> = {};
    for (const chart of DUAL_OWNED) {
      helmSecretSamples[chart.name] = [];
      argoSyncSamples[chart.name] = [];
    }
    const s7Start = nowSeconds();
    const sampleWindowSec = Math.min(opts.stage567TimeoutSec, 180);
    const sampleDeadline = s7Start + sampleWindowSec;
    while (nowSeconds() < sampleDeadline) {
      for (const chart of DUAL_OWNED) {
        const secret = kubectl(runner, kubeconfigPath, [
          "-n",
          chart.targetNamespace,
          "get",
          "secret",
          "-l",
          `owner=helm,name=${chart.name}`,
          "-o",
          "jsonpath={.items[*].metadata.resourceVersion}",
        ]);
        if (secret.status === 0 && secret.stdout.trim().length > 0) {
          (helmSecretSamples[chart.name] ?? []).push(secret.stdout.trim());
        }
        // The ArgoCD Application for this component, if one exists under
        // k8s/applications/<name>/ — not guaranteed to match the HelmChart's
        // own name 1:1, so a miss here is reported as "no Application" rather
        // than treated as a parse error.
        const app = kubectl(runner, kubeconfigPath, [
          "-n",
          "argocd",
          "get",
          "application",
          chart.name,
          "-o",
          "jsonpath={.status.sync.status}",
        ]);
        if (app.status === 0 && app.stdout.trim().length > 0) {
          (argoSyncSamples[chart.name] ?? []).push(app.stdout.trim());
        }
      }
      await new Promise((r) => setTimeout(r, 20_000));
    }
    // (a) helm release Secret resourceVersion changed more than once — helm-controller re-installed/upgraded.
    const helmChurning = Object.entries(helmSecretSamples)
      .filter(([, versions]) => new Set(versions).size > 1)
      .map(([name]) => name);
    // (b) ArgoCD's OWN sync-status oscillated — changed more than once, which a
    // one-time "OutOfSync -> Synced" settle does NOT trigger (that is exactly
    // one change). Two or more changes means it left Synced again on its own.
    const argoOscillating = Object.entries(argoSyncSamples)
      .filter(([, statuses]) => statuses.filter((s, i) => i > 0 && s !== statuses[i - 1]).length >= 2)
      .map(([name]) => name);
    const churning = [...new Set([...helmChurning, ...argoOscillating])];
    stages.push({
      stage: 7,
      name: "dual-owner churn check (helm-controller vs ArgoCD)",
      ok: churning.length === 0,
      elapsedSeconds: nowSeconds() - s7Start,
      detail:
        churning.length === 0
          ? "no release resourceVersion churn and no ArgoCD sync-status oscillation observed"
          : `CHURNING: ${churning.join(", ")} (helm-secret: ${helmChurning.join(", ") || "none"}; argo-sync-oscillation: ${argoOscillating.join(", ") || "none"})`,
      evidence: { helmSecretSamples, argoSyncSamples },
    });

    return {
      plan: planSummary(plan),
      stages,
      appVerdicts,
      ok: stages.every((s) => s.ok !== false),
    };
  } catch (e) {
    // Diagnostics on failure: not-running pods, warning events, helm-controller job logs.
    log(`ERROR: ${reason(e)}`);
    collectFailureDiagnostics(runner, kubeconfigPath, opts.containerName, log);
    throw e;
  } finally {
    if (!opts.keep) {
      runner.run("docker", ["rm", "-f", opts.containerName], { timeoutMs: 30_000 });
      runner.run("docker", ["volume", "rm", "-f", `${opts.containerName}-data`], { timeoutMs: 30_000 });
    } else {
      log(`--keep set: leaving ${opts.containerName} running. Tear down with: docker rm -f ${opts.containerName} && docker volume rm -f ${opts.containerName}-data`);
    }
  }
}

function collectFailureDiagnostics(runner: Runner, kubeconfigPath: string, containerName: string, log: (line: string) => void): void {
  if (!existsSync(kubeconfigPath)) {
    log("no kubeconfig was ever fetched — nothing to diagnose via kubectl");
    return;
  }
  const commands: [string, string[]][] = [
    ["not-running pods", ["get", "pods", "-A", "-o", "wide", "--field-selector=status.phase!=Running"]],
    ["warning events", ["get", "events", "-A", "--field-selector=type=Warning", "--sort-by=.lastTimestamp"]],
    ["helm-controller jobs", ["-n", "kube-system", "get", "jobs", "-l", "helmcharts.helm.cattle.io/chart"]],
  ];
  for (const [label, args] of commands) {
    const result = kubectl(runner, kubeconfigPath, args, 20_000);
    log(`=== ${label} ===`);
    log(result.stdout || result.stderr || "(no output)");
  }
  const helmInstallLogs = kubectl(runner, kubeconfigPath, ["-n", "kube-system", "get", "pods", "-o", "name", "--field-selector=status.phase!=Running", "-l", "job-name"], 20_000);
  log("=== helm-install job pod names (fetch logs with kubectl logs) ===");
  log(helmInstallLogs.stdout);
  log("=== docker logs (tail) ===");
  log(runner.run("docker", ["logs", "--tail", "200", containerName]).stdout);
}

function planSummary(plan: ReplicaPlan): RunReport["plan"] {
  return {
    clusterName: plan.clusterName,
    podCidr: plan.podCidr,
    serviceCidr: plan.serviceCidr,
    k3sVersion: plan.k3sVersion,
    image: plan.image,
    extraFlags: plan.extraFlags,
    applyOrder: plan.applyOrder,
    helmCharts: plan.helmCharts.map((h) => ({ name: h.name, namespace: h.namespace, chart: h.chart, version: h.version })),
    divergences: plan.divergences,
  };
}

// ─────────────────────────────── CLI ─────────────────────────────────────

/** Render the per-app verdict table (WP1b spec item 5) as GitHub-flavoured markdown, for `$GITHUB_STEP_SUMMARY`. */
export function renderAppVerdictMarkdown(appVerdicts: readonly AppVerdict[]): string {
  const heading = "## first-boot replica: catalog convergence (stage 6)\n\n";
  if (appVerdicts.length === 0) {
    return `${heading}_no Application verdicts were produced — an earlier stage failed before stage 6 ran._\n`;
  }
  const sorted = [...appVerdicts].sort((a, b) => stringCompare(a.name, b.name));
  const healthy = sorted.filter((v) => v.verdict === "Healthy").length;
  const divergence = sorted.filter((v) => v.verdict === "DIVERGENCE").length;
  const fail = sorted.filter((v) => v.verdict === "FAIL").length;
  const rows = sorted
    .map((v) => `| \`${v.name}\` | ${v.sync} | ${v.health} | ${v.verdict} | ${v.reason.replaceAll("|", "\\|")} |`)
    .join("\n");
  return (
    `${heading}${String(sorted.length)} Applications: **${String(healthy)} Healthy**, ` +
    `**${String(divergence)} DIVERGENCE**, **${String(fail)} FAIL**\n\n` +
    `| Application | sync | health | verdict | reason |\n| --- | --- | --- | --- | --- |\n${rows}\n`
  );
}

function currentGitBranch(runner: Runner, repoRoot: string): string | null {
  const result = runner.run("git", ["-C", repoRoot, "rev-parse", "--abbrev-ref", "HEAD"]);
  if (result.status !== 0) return null;
  const branch = result.stdout.trim();
  return branch === "" || branch === "HEAD" ? null : branch;
}

async function main(): Promise<void> {
  const { values: args } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      run: { type: "boolean", default: false },
      "target-revision": { type: "string" },
      "repo-url": { type: "string" },
      "k3s-image": { type: "string" },
      "container-name": { type: "string", default: "zeta-first-boot-replica" },
      "host-api-port": { type: "string", default: "16443" },
      keep: { type: "boolean", default: false },
      "with-longhorn-alias": { type: "boolean", default: false },
      // Stage 6's "serve the dev rung" override (WP1b). See `applyServeTreeOverride`
      // and `buildLaneTreeForProfile` (imported from argocd-health-test.ts) for what
      // this actually does; a rung name must be one `storage-profiles.ts` declares
      // (CI passes "dev"). Implies `--with-longhorn-alias`.
      "serve-tree": { type: "string" },
      // WP1b spec item 4: hold steady this long after convergence (or timeout) and
      // FAIL if any container's restartCount increases. 0 skips the soak.
      "soak-sec": { type: "string", default: "300" },
      "json-out": { type: "string" },
      "stage3-timeout-sec": { type: "string", default: "2400" },
      "stage4-timeout-sec": { type: "string", default: "900" },
      "stage567-timeout-sec": { type: "string", default: "600" },
    },
    strict: true,
  });

  const runner = new SpawnRunner();
  const targetRevision = args["target-revision"] ?? currentGitBranch(runner, REPO_ROOT) ?? "main";

  let plan: ReplicaPlan;
  try {
    plan = buildPlan({
      repoRoot: REPO_ROOT,
      targetRevision,
      ...(args["repo-url"] === undefined ? {} : { repoUrlOverride: args["repo-url"] }),
      ...(args["k3s-image"] === undefined ? {} : { imageOverride: args["k3s-image"] }),
    });
  } catch (e) {
    console.error(`plan construction failed: ${reason(e)}`);
    process.exit(2);
  }

  if (args["dry-run"] || !args["run"]) {
    console.log("=== PLAN (dry-run) ===");
    console.log(`cluster: ${plan.clusterName}  podCidr=${plan.podCidr}  serviceCidr=${plan.serviceCidr}`);
    console.log(`k3s: ${plan.k3sVersion}  image=${plan.image}`);
    console.log(`extraFlags:`);
    for (const f of plan.extraFlags) console.log(`  ${f}`);
    console.log(`apply order (${String(plan.applyOrder.length)} manifests):`);
    for (const f of plan.applyOrder) console.log(`  ${f}`);
    console.log(`HelmChart CRs (${String(plan.helmCharts.length)}):`);
    for (const c of plan.helmCharts) {
      console.log(`  ${c.name} (ns=${c.namespace}) chart=${c.chart} version=${c.version} bootstrap=${String(c.bootstrap)}`);
    }
    console.log(`root-application -> repoURL=${plan.rootRepoUrl} targetRevision=${plan.rootTargetRevision}`);
    console.log(`DIVERGENCES from metal:`);
    for (const d of plan.divergences) console.log(`  [${d.id}] ${d.reason}`);
    if (!args["run"]) return;
  }

  if (runner.run("docker", ["info"], { timeoutMs: 15_000 }).status !== 0) {
    console.error("docker is not available/usable — cannot --run (use --dry-run to see the plan without it)");
    process.exit(2);
  }

  // ── Stage 6 "serve the dev rung" override (WP1b) ─────────────────────
  //
  // Built here (needs `git`/`tar`, not Docker, but is only worth paying for on
  // `--run`) and folded into `plan` BEFORE `runReplica` is called, so the
  // DIVERGENCES log line right below already reflects it — same divergences
  // list either way, no separate print path to keep in sync.
  const serveTreeProfile = args["serve-tree"] ?? null;
  let withLonghornAlias = args["with-longhorn-alias"] ?? false;
  let laneTreeManifests: string | undefined;
  if (serveTreeProfile !== null) {
    console.log(`[serve-tree] building lane tree for resource rung "${serveTreeProfile}" ...`);
    const laneTree = buildLaneTreeForProfile(serveTreeProfile, targetRevision);
    if (laneTree === null) {
      // Unreachable: buildLaneTreeForProfile(profile, ref) only returns null when
      // profile === null, and serveTreeProfile is checked non-null just above.
      console.error("[serve-tree] internal error: buildLaneTreeForProfile returned null for a non-null profile");
      process.exit(2);
    }
    laneTreeManifests = laneTree.manifests;
    // "k3d" here is not a provider claim — first-boot-replica boots neither kind nor
    // k3d. It is the one input `rootDevCatalogExcludeGlobFor` reads to decide whether
    // Cilium already owns the CNI slot, and passing it forces that branch true, which
    // is the correct answer here: stage 2 already asserts a REAL Cilium, installed by
    // this replica's own k3s bootstrap roster, same as k3d always does.
    const excludeGlob = rootDevCatalogExcludeGlobFor("k3d");
    plan = applyServeTreeOverride(plan, {
      manifests: laneTree.manifests,
      repoUrl: laneTree.repoUrl,
      gitRef: laneTree.gitRef,
      excludeGlob,
    });
    // The dev rung's storage claims need the dev longhorn StorageClass alias this
    // replica would otherwise never apply; --with-longhorn-alias is redundant once
    // --serve-tree is given, so it is simply implied rather than requiring both flags.
    withLonghornAlias = true;
  }

  const scratchDir = mkdtempSync(join(tmpdir(), "zeta-first-boot-replica-"));
  console.log(`scratch dir: ${scratchDir}`);
  console.log(`DIVERGENCES from metal:`);
  for (const d of plan.divergences) console.log(`  [${d.id}] ${d.reason}`);

  const report = await runReplica({
    plan,
    runner,
    scratchDir,
    containerName: args["container-name"] ?? "zeta-first-boot-replica",
    hostApiPort: Number(args["host-api-port"] ?? "16443"),
    keep: args["keep"] ?? false,
    withLonghornAlias,
    stage3TimeoutSec: Number(args["stage3-timeout-sec"] ?? "2400"),
    stage4TimeoutSec: Number(args["stage4-timeout-sec"] ?? "900"),
    stage567TimeoutSec: Number(args["stage567-timeout-sec"] ?? "600"),
    soakSec: Number(args["soak-sec"] ?? "300"),
    ...(laneTreeManifests === undefined ? {} : { laneTreeManifests }),
    pollMs: 10_000,
    log: (line) => console.log(line),
  });

  console.log("\n=== STAGE VERDICTS ===");
  for (const s of report.stages) {
    const label = s.ok === true ? "PASS" : s.ok === false ? "FAIL" : "INCONCLUSIVE";
    console.log(`  [${label}] stage ${String(s.stage)} ${s.name} (${s.elapsedSeconds.toFixed(1)}s): ${s.detail}`);
  }

  const verdictMarkdown = renderAppVerdictMarkdown(report.appVerdicts);
  console.log(`\n${verdictMarkdown}`);
  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath !== undefined && summaryPath !== "") {
    appendFileSync(summaryPath, verdictMarkdown, "utf-8");
  }

  if (args["json-out"] !== undefined) {
    writeFileSync(args["json-out"], JSON.stringify(report, null, 2), "utf-8");
    console.log(`\nfull report written to ${args["json-out"]}`);
  }

  process.exit(report.ok ? 0 : 1);
}

if (import.meta.main) {
  await main();
}
