#!/usr/bin/env bun
// audit-existing-secret-is-minted.ts -- an Application that names a Secret it does
// not create has a dependency on something OUTSIDE the manifest, and the dev lane
// has exactly one roster for those.
//
// ---------------------------------------------------------------------------
// THE BREAK THIS WAS WRITTEN FROM, WHICH WAS MINE
// ---------------------------------------------------------------------------
//
// The redis -> valkey migration (#16292) wrote:
//
//     auth:
//       usersExistingSecret: redis-auth   # create via Sealed Secret / Vault
//
// That comment is true of metal and false of the dev lane, and nothing said so.
// `applyDevBootstrapSecrets` mints the credentials Applications expect to find
// ALREADY PRESENT -- `monitoring/grafana-admin-credentials` for
// kube-prometheus-stack, the ziti admin Secret for oz -- and redis was never
// added to it. The chart then refuses to render a user with no credential, the
// Application sat OutOfSync/Progressing in the included proof, and the defect
// reached a lane rather than a check.
//
// The shape is one this repo already knows: change an Application, re-derive
// what is keyed to it. The observability roster taught it for a GENERATED FILE.
// This is the same lesson for a RUNTIME dependency, which is worse, because a
// stale generated file fails in CI in seconds and a missing Secret fails after a
// cluster has been built and an Application has tried to sync.
//
// ---------------------------------------------------------------------------
// WHAT IT CHECKS, AND THE ONE THING IT REFUSES TO GUESS
// ---------------------------------------------------------------------------
//
// Every `*existingSecret`-shaped value in every Application's `valuesObject` is
// a NAME, and a name is a promise that something else creates the object. The
// audit collects them and asks one question of each: does the dev bootstrap
// roster mint it?
//
//   MINTED      the roster carries it. Nothing to do.
//   NOT MINTED  refused, unless the baseline carries a reason -- because the
//               honest answers ("this Application is excluded from the dev lane
//               so it never needs one", "this is metal-only via Vault") are
//               CLAIMS, and a claim in this repo goes in a file with a lift
//               condition rather than in someone's head.
//
// IT DOES NOT decide whether an Application is applied in the dev lane. That
// question has three sources of truth already -- `DEV_EXCLUDED_REASONS`, the
// root catalogue's `excludeGlob`, and `isExcludedFromIncludedProof`'s rules --
// and a fourth reimplementation of it here would be a copy that drifts. So an
// excluded Application's Secret is carried in the baseline WITH its exclusion
// named, which keeps the two facts in one place and makes the entry go stale the
// day the exclusion lifts.
//
// Exit codes: 0 clean, 1 an unminted Secret or a stale acknowledgement, 2 usage.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep as pathSep } from "node:path";
import { parseAllDocuments } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const BASELINE_RELATIVE_PATH = "src/Core.TypeScript/cluster/existing-secret-is-minted.baseline.json";
const APPLICATIONS_DIR = "full-ai-cluster/k8s/applications";

/**
 * A key whose VALUE is the name of a Secret this manifest does not create.
 *
 * WIDENED FROM `existingSecret` ALONE, and the narrow version was wrong in the
 * ACQUITTING direction. `oz` names its credential `customAdminSecretName:
 * ziti-admin-credentials` -- a Secret the dev roster really does mint -- and the
 * first pattern here matched none of it. A guard that only recognises ONE
 * spelling does not prevent the class of defect it was built for; it prevents
 * that defect written one particular way, and the next one arrives spelled
 * differently. Found by noticing the minted count was 1 when the roster mints 2.
 *
 * So the rule is the SHAPE of the key, not a fixed vocabulary: anything ending
 * in `existingSecret` or in `secretName` (either case) is a promise that some
 * other actor creates that object.
 *
 * WIDENED A SECOND TIME, 2026-09-05, and by the same failure mode the paragraph
 * above describes -- which is the argument for the shape rule rather than a
 * refutation of it. `opensearch` references its minted admin credential through
 * `extraEnvs[].valueFrom.secretKeyRef.name`, which is the STANDARD Kubernetes
 * way to name a Secret and is arguably more common than either spelling above.
 * The audit did not recognise it, so a genuinely-referenced credential read as
 * "a minted Secret nobody names".
 *
 * `secretKeyRef.name` is matched by its PARENT, not by the key `name` alone: a
 * bare `name:` means a hundred things in a values file, and matching it would
 * convict half the tree. The same applies to `secretRef` (used by `envFrom`),
 * so both are recognised only in that position.
 *
 * WIDENED AGAIN 2026-09-06, `existingSecret` -> `existing<Anything>Secret`. seaweedfs names
 * its Secret in `s3.existingConfigSecret`, and the old pattern did not match it -- the word
 * is `existing`, then `Config`, then `Secret`, so "existingSecret" is not a substring. That
 * reference was INVISIBLE to this audit: a chart naming an unminted Secret in that field
 * would have passed silently, which is the exact failure this file exists to catch, in this
 * file. Found because 081M1S6Z5S3087G0R000GEPSS2 made seaweedfs use that field and the
 * roster then showed two references where three were expected.
 *
 * The widening is bounded on both sides -- it still requires the name to END in `Secret` and
 * to contain `existing` -- so it does not start matching `secretsDir` or `secretEngine`.
 */
const SECRET_NAME_KEY = /(^|\.)[A-Za-z]*([Ee]xisting[A-Za-z]*Secret|[Ss]ecretName)$/;

/** `...secretKeyRef.name` / `...secretRef.name` — the standard env-var forms. */
const SECRET_REF_NAME_KEY = /(^|\.)(secretKeyRef|secretRef)(\.[0-9]+)?\.name$/;

export interface SecretReference {
  /** Application directory — the name an operator sees. */
  readonly app: string;
  readonly manifest: string;
  /** Dotted path inside `valuesObject`. */
  readonly field: string;
  /** The Secret NAME the Application promises will exist. */
  readonly secretName: string;
}

export interface BaselineEntry {
  /** `<app>|<secretName>`. */
  readonly key: string;
  readonly reason: string;
  readonly liftsWhen: string;
}

export interface Adjudicated {
  readonly minted: readonly SecretReference[];
  readonly refused: readonly SecretReference[];
  readonly acknowledged: readonly SecretReference[];
  readonly staleKeys: readonly string[];
}

export function referenceKey(app: string, secretName: string): string {
  return `${app}|${secretName}`;
}

/** Walk a values tree, yielding `[dottedPath, value]` for every scalar leaf. */
function* leaves(node: unknown, path = ""): Generator<readonly [string, unknown]> {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const [index, item] of node.entries()) yield* leaves(item, `${path}[${String(index)}]`);
    return;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      yield* leaves(value, path === "" ? key : `${path}.${key}`);
    }
    return;
  }
  yield [path, node];
}

/**
 * Every Secret NAME promised by an Application's `valuesObject`.
 *
 * Only non-empty strings count. An empty `existingSecret: ""` is the chart's own
 * "generate one for me" idiom in several charts, and refusing it would report a
 * working default as a missing dependency -- cry-wolf on the first run.
 */
export function collectSecretReferences(repoRoot = REPO_ROOT): readonly SecretReference[] {
  const root = resolve(repoRoot, APPLICATIONS_DIR);
  const out: SecretReference[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = join(APPLICATIONS_DIR, entry.name, "Application.yaml");
    let text: string;
    try {
      text = readFileSync(resolve(repoRoot, manifest), "utf8");
    } catch {
      continue;
    }
    for (const doc of parseAllDocuments(text)) {
      const value = doc.toJS() as Record<string, unknown> | null;
      if (value === null || typeof value !== "object") continue;
      const spec = value.spec as Record<string, unknown> | undefined;
      const source = spec?.source as Record<string, unknown> | undefined;
      const helm = source?.helm as Record<string, unknown> | undefined;
      const values = helm?.valuesObject;
      if (values === undefined) continue;
      for (const [field, leaf] of leaves(values)) {
        if (!SECRET_NAME_KEY.test(field) && !SECRET_REF_NAME_KEY.test(field)) continue;
        if (typeof leaf !== "string" || leaf.trim() === "") continue;
        out.push({ app: entry.name, manifest, field, secretName: leaf });
      }
    }
  }
  return out.sort((a, b) => (referenceKey(a.app, a.secretName) < referenceKey(b.app, b.secretName) ? -1 : 1));
}

// ---------------------------------------------------------------------------
// RAW MANIFEST references -- WP3 extension.
//
// `collectSecretReferences` above only looks at an Application's OWN Helm
// `valuesObject` -- a chart's declared credential fields. It never looks at
// the PLAIN Kubernetes manifests an Application also ships (Deployments,
// StatefulSets, CronJobs, ...), which is where a pod spec names a Secret
// directly: `imagePullSecrets`, `envFrom[].secretRef`, `env[].valueFrom.
// secretKeyRef`, `volumes[].secret.secretName`. `platform/{controller,
// portal}.yaml` reference `imagePullSecrets: [{name: ghcr-pull}]` this way,
// and nothing above would ever see it.
//
// THE MINTED SET IS DELIBERATELY DIFFERENT FROM THE VALUESOBJECT CHECK'S.
// `collectSecretReferences` above accepts DEV_BOOTSTRAP_SECRETS/DEV_SHARED_SECRETS
// as "minted" -- a CI/dev-lane runtime action. For a raw manifest that ships
// verbatim to METAL, that action never runs: nothing about DEV_GHCR_PULL_SECRET
// touches a real cluster. So this scan checks raw references against
// `collectTreeMintedSecretNames` -- Secrets/SealedSecrets/ExternalSecrets
// actually COMMITTED in the tree -- never the dev roster. `ghcr-pull` is
// exactly the case this distinguishes: minted for CI (DEV_GHCR_PULL_SECRET),
// not minted anywhere in the committed manifests, and referenced directly by
// two pod specs. The valuesObject check would call it fine; this one must not.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Walk a parsed manifest document looking for the FOUR standard shapes a pod
 * spec (of any workload kind -- Pod/Deployment/StatefulSet/DaemonSet/Job/
 * CronJob) names a Secret by. Deliberately shape-matched rather than
 * path-anchored to one workload kind's exact field nesting: the four key
 * names below (`imagePullSecrets`, `envFrom`+`secretRef`, `secretKeyRef`,
 * `volumes`+`secret`+`secretName`) are how every core/v1 API object spells
 * "I need this Secret", regardless of which controller kind wraps the pod
 * template.
 */
function* rawSecretNames(node: unknown, path = ""): Generator<readonly [string, string]> {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const [index, item] of node.entries()) yield* rawSecretNames(item, `${path}[${String(index)}]`);
    return;
  }
  if (!isRecord(node)) return;

  const name = asNonEmptyString(node.name);
  if (name !== null && /imagePullSecrets\[\d+\]$/.test(path)) yield [`${path}.name`, name];

  if (/envFrom\[\d+\]$/.test(path) && isRecord(node.secretRef)) {
    const n = asNonEmptyString(node.secretRef.name);
    if (n !== null) yield [`${path}.secretRef.name`, n];
  }
  if (isRecord(node.secretKeyRef)) {
    const n = asNonEmptyString(node.secretKeyRef.name);
    if (n !== null) yield [`${path}.secretKeyRef.name`, n];
  }
  if (isRecord(node.secret)) {
    const n = asNonEmptyString(node.secret.secretName);
    if (n !== null) yield [`${path}.secret.secretName`, n];
  }

  for (const [key, value] of Object.entries(node)) {
    yield* rawSecretNames(value, path === "" ? key : `${path}.${key}`);
  }
}

function listYamlFilesRecursive(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listYamlFilesRecursive(abs, base));
    } else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
      out.push(relative(base, abs).split(pathSep).join("/"));
    }
  }
  return out;
}

/**
 * Every Secret name a RAW (non-Application, non-valuesObject) manifest names
 * directly on a pod spec, across every Application's full manifest tree --
 * not just `Application.yaml`.
 */
export function collectRawSecretReferences(repoRoot = REPO_ROOT): readonly SecretReference[] {
  const appsRoot = resolve(repoRoot, APPLICATIONS_DIR);
  const out: SecretReference[] = [];
  for (const entry of readdirSync(appsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const appDir = join(appsRoot, entry.name);
    // SCOPED TO THE APP-OF-APPS ROSTER: a directory with no Application.yaml is
    // not reconciled by ArgoCD at all. `ddns/` is the measured instance -- its
    // own header says so outright ("this dir has no Application.yaml on
    // purpose... apply it directly so it stays opt-in for the single-machine
    // bootstrap") and documents the exact `kubectl create secret` step a human
    // runs by hand. Scanning it anyway would refuse a Secret this audit's own
    // subject (the ArgoCD-managed tree) never actually depends on.
    if (!existsSync(join(appDir, "Application.yaml"))) continue;
    for (const relFile of listYamlFilesRecursive(appDir, appDir)) {
      if (relFile === "Application.yaml") continue; // that source is collectSecretReferences's job
      const manifest = `${APPLICATIONS_DIR}/${entry.name}/${relFile}`;
      let text: string;
      try {
        text = readFileSync(join(appDir, relFile), "utf8");
      } catch {
        continue;
      }
      let docs: ReturnType<typeof parseAllDocuments>;
      try {
        docs = parseAllDocuments(text);
      } catch {
        continue;
      }
      for (const doc of docs) {
        let value: unknown;
        try {
          value = doc.toJS({ maxAliasCount: -1 });
        } catch {
          continue;
        }
        if (!isRecord(value)) continue;
        // Skip the CREATING side entirely: a Secret/SealedSecret/ExternalSecret
        // document names itself in `metadata.name`, which matches none of the
        // four consuming shapes above, but skip explicitly so a future shape
        // widening cannot accidentally treat a minter as a consumer.
        if (value.kind === "Secret" || value.kind === "SealedSecret" || value.kind === "ExternalSecret") continue;
        for (const [field, secretName] of rawSecretNames(value)) {
          out.push({ app: entry.name, manifest, field, secretName });
        }
      }
    }
  }
  return out.sort((a, b) => (referenceKey(a.app, a.secretName) < referenceKey(b.app, b.secretName) ? -1 : 1));
}

/**
 * Every Secret NAME actually minted by a manifest committed in the tree --
 * `kind: Secret` (metadata.name), `kind: SealedSecret` (unseals to a Secret of
 * the SAME name -- bitnami's controller preserves it), `kind: ExternalSecret`
 * (external-secrets.io; targets `spec.target.name`, defaulting to
 * `metadata.name` when unset, exactly as the operator itself defaults it).
 * This is the METAL-real minted set -- deliberately NOT the dev/CI bootstrap
 * roster, which mints nothing a real cluster will ever see.
 */
export function collectTreeMintedSecretNames(repoRoot = REPO_ROOT): ReadonlySet<string> {
  const appsRoot = resolve(repoRoot, APPLICATIONS_DIR);
  const out = new Set<string>();
  for (const entry of readdirSync(appsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const appDir = join(appsRoot, entry.name);
    for (const relFile of listYamlFilesRecursive(appDir, appDir)) {
      let text: string;
      try {
        text = readFileSync(join(appDir, relFile), "utf8");
      } catch {
        continue;
      }
      let docs: ReturnType<typeof parseAllDocuments>;
      try {
        docs = parseAllDocuments(text);
      } catch {
        continue;
      }
      for (const doc of docs) {
        let value: unknown;
        try {
          value = doc.toJS({ maxAliasCount: -1 });
        } catch {
          continue;
        }
        if (!isRecord(value)) continue;
        const metadata = isRecord(value.metadata) ? value.metadata : {};
        const ownName = asNonEmptyString(metadata.name);
        if (value.kind === "Secret" || value.kind === "SealedSecret") {
          if (ownName !== null) out.add(ownName);
        } else if (value.kind === "ExternalSecret") {
          const spec = isRecord(value.spec) ? value.spec : {};
          const target = isRecord(spec.target) ? spec.target : {};
          const targetName = asNonEmptyString(target.name) ?? ownName;
          if (targetName !== null) out.add(targetName);
        }
      }
    }
  }
  return out;
}

export function readBaseline(path = BASELINE_RELATIVE_PATH, repoRoot = REPO_ROOT): readonly BaselineEntry[] {
  const raw = JSON.parse(readFileSync(resolve(repoRoot, path), "utf8")) as { entries?: unknown };
  if (!Array.isArray(raw.entries)) throw new Error(`${path}: "entries" must be an array`);
  return raw.entries.map((value, index) => {
    const e = value as Record<string, unknown>;
    for (const field of ["key", "reason", "liftsWhen"] as const) {
      if (typeof e[field] !== "string" || (e[field] as string).trim().length === 0) {
        throw new Error(
          `${path}: entries[${String(index)}] has no "${field}" — an Application that depends on a Secret nobody ` +
            `mints must say WHY that is acceptable and WHAT lifts it, or the dependency is simply undeclared`,
        );
      }
    }
    return e as unknown as BaselineEntry;
  });
}

export function adjudicate(
  references: readonly SecretReference[],
  mintedNames: ReadonlySet<string>,
  baseline: readonly BaselineEntry[],
  /**
   * Keys already "used" by a SIBLING scan sharing this same baseline file --
   * `audit-existing-secret-is-minted.ts`'s two scans (valuesObject references
   * and raw-manifest references) share one baseline, and a key an entry
   * matches only in the OTHER scan must not be reported STALE here. Optional
   * and defaults to empty so every existing single-scan caller is unaffected.
   */
  alsoUsedKeys: ReadonlySet<string> = new Set(),
): Adjudicated {
  const byKey = new Map(baseline.map((e) => [e.key, e]));
  const used = new Set<string>(alsoUsedKeys);
  const minted: SecretReference[] = [];
  const refused: SecretReference[] = [];
  const acknowledged: SecretReference[] = [];
  for (const reference of references) {
    if (mintedNames.has(reference.secretName)) {
      minted.push(reference);
      continue;
    }
    const key = referenceKey(reference.app, reference.secretName);
    if (byKey.has(key)) {
      used.add(key);
      acknowledged.push(reference);
      continue;
    }
    refused.push(reference);
  }
  const staleKeys = baseline
    .filter((e) => !used.has(e.key))
    .map((e) => e.key)
    .sort();
  return { minted, refused, acknowledged, staleKeys };
}

/**
 * Which baseline keys a reference LIST would match, ignoring minted status --
 * used to tell one `adjudicate` scan about keys a SIBLING scan (sharing the
 * same baseline) will independently mark used, so neither scan reports the
 * other's acknowledgement as stale.
 */
export function matchedBaselineKeys(
  references: readonly SecretReference[],
  mintedNames: ReadonlySet<string>,
  baseline: readonly BaselineEntry[],
): ReadonlySet<string> {
  const keys = new Set(baseline.map((e) => e.key));
  const out = new Set<string>();
  for (const r of references) {
    if (mintedNames.has(r.secretName)) continue; // minted, not acknowledged -- would not mark the key used
    const key = referenceKey(r.app, r.secretName);
    if (keys.has(key)) out.add(key);
  }
  return out;
}

export function exitCode(a: Adjudicated): number {
  return a.refused.length > 0 || a.staleKeys.length > 0 ? 1 : 0;
}

export function formatReport(a: Adjudicated): string {
  const lines: string[] = ["Applications that name a Secret they do not create", ""];
  for (const r of a.refused) {
    lines.push(
      `  REFUSED ${r.app} — names Secret \`${r.secretName}\` at ${r.field}`,
      `          ${r.manifest}`,
      `          Nothing mints it. Add it to DEV_BOOTSTRAP_SECRETS so the dev lane creates it,`,
      `          or carry it in ${BASELINE_RELATIVE_PATH} with a reason and a lift condition.`,
      "",
    );
  }
  for (const key of a.staleKeys) {
    lines.push(`  STALE ACKNOWLEDGEMENT ${key} — matches no reference; delete it`, "");
  }
  lines.push(
    `  minted by the dev roster (${String(a.minted.length)}): ${a.minted.map((r) => r.secretName).join(", ") || "none"}`,
    `  acknowledged (${String(a.acknowledged.length)}) — STILL UNMINTED. An acknowledgement buys a non-red gate,`,
    `  never a Secret in a cluster.`,
    "",
    exitCode(a) === 0
      ? "OK — every named Secret is minted by the dev roster, or acknowledged as deliberately not."
      : "FAILED — an Application depends on a Secret nothing creates.",
  );
  return lines.join("\n");
}

export function auditExistingSecretIsMinted(mintedNames: ReadonlySet<string>, repoRoot = REPO_ROOT): Adjudicated {
  return adjudicate(collectSecretReferences(repoRoot), mintedNames, readBaseline(BASELINE_RELATIVE_PATH, repoRoot));
}

/**
 * Both scans TOGETHER, sharing one baseline file WITHOUT cross-reporting each
 * other's acknowledgement as stale.
 *
 * `auditExistingSecretIsMinted` (valuesObject references) and the raw-manifest
 * scan below match the SAME baseline shape (`${app}|${secretName}`), and a
 * baseline entry may exist for a key only ONE of the two scans' reference
 * lists ever contains -- `platform|ghcr-pull` is exactly this: found only by
 * the raw scan, never by the valuesObject scan. Running each scan's
 * `staleKeys` independently would report that entry stale in whichever scan
 * did not happen to touch it. `matchedBaselineKeys` is computed for BOTH scans
 * first, then each `adjudicate` call is told about the OTHER scan's matches.
 */
export function auditBothSecretScans(
  repoRoot = REPO_ROOT,
  devRosterMintedNames: ReadonlySet<string> = new Set(),
): { readonly valuesObject: Adjudicated; readonly raw: Adjudicated } {
  const baseline = readBaseline(BASELINE_RELATIVE_PATH, repoRoot);
  const valuesObjectRefs = collectSecretReferences(repoRoot);
  const rawRefs = collectRawSecretReferences(repoRoot);
  const treeMinted = collectTreeMintedSecretNames(repoRoot);

  const valuesObjectMatched = matchedBaselineKeys(valuesObjectRefs, devRosterMintedNames, baseline);
  const rawMatched = matchedBaselineKeys(rawRefs, treeMinted, baseline);

  return {
    valuesObject: adjudicate(valuesObjectRefs, devRosterMintedNames, baseline, rawMatched),
    raw: adjudicate(rawRefs, treeMinted, baseline, valuesObjectMatched),
  };
}

/**
 * The RAW-MANIFEST sibling of `auditExistingSecretIsMinted` -- pod specs
 * naming a Secret directly, checked against what the TREE ITSELF mints
 * (Secret/SealedSecret/ExternalSecret), never the dev/CI bootstrap roster.
 *
 * Standalone convenience (no cross-scan staleness suppression -- use
 * `auditBothSecretScans` when running both together, which `main()` does).
 */
export function auditRawSecretReferences(repoRoot = REPO_ROOT): Adjudicated {
  return adjudicate(
    collectRawSecretReferences(repoRoot),
    collectTreeMintedSecretNames(repoRoot),
    readBaseline(BASELINE_RELATIVE_PATH, repoRoot),
  );
}

async function main(): Promise<void> {
  // Imported lazily so the pure functions above stay testable without dragging
  // the dev-cluster port surface into every consumer.
  // BOTH ROSTERS. `DEV_SHARED_SECRETS` was added 2026-09-06 for a credential one producer and
  // three consumers must agree on (081M1S6Z5S3087G0R000GEPSS2), and it mints Secrets exactly
  // as the bootstrap roster does. Reading only the first roster would REFUSE a Secret the dev
  // lane really does create -- a false accusation, which trains people to acknowledge things
  // that were never wrong.
  const { DEV_BOOTSTRAP_SECRETS, DEV_SHARED_SECRETS } = (await import("./dev-cluster/lib.ts")) as {
    DEV_BOOTSTRAP_SECRETS: readonly { readonly name: string }[];
    DEV_SHARED_SECRETS: readonly { readonly name: string }[];
  };
  const { valuesObject: valuesObjectResult, raw: rawResult } = auditBothSecretScans(
    REPO_ROOT,
    new Set([...DEV_BOOTSTRAP_SECRETS, ...DEV_SHARED_SECRETS].map((s) => s.name)),
  );
  process.stdout.write("=== valuesObject-referenced Secrets (checked against the dev/CI roster) ===\n");
  process.stdout.write(`${formatReport(valuesObjectResult)}\n\n`);

  process.stdout.write("=== raw-manifest-referenced Secrets (checked against what the TREE itself mints) ===\n");
  process.stdout.write(`${formatReport(rawResult)}\n`);

  process.exit(exitCode(valuesObjectResult) !== 0 || exitCode(rawResult) !== 0 ? 1 : 0);
}

if (import.meta.main) await main();
