#!/usr/bin/env bun
/**
 * hat-constraint-roster.ts -- the seven Hat policies, derived from the committed
 * YAML rather than restated.
 *
 * -- THE DEFECT THIS CLOSES -------------------------------------------------
 * A Gatekeeper policy is TWO objects, and only one of them was ever asserted:
 *
 *   1. a `ConstraintTemplate` -- Rego. Gatekeeper compiles it and, only if it
 *      compiles, generates a CRD for the Constraint kind it declares.
 *   2. a `Constraint` -- an instance of that generated CRD. THE POLICY. A
 *      compiled template with no Constraint enforces exactly nothing.
 *
 * `k8s-argocd-health-test.yml` grew a real check for (1) on 2026-09-09
 * ("Gatekeeper compiled every ConstraintTemplate"), after two runs -- 34323056405
 * red and 34338106811 GREEN -- in which `hatconflict` and `hatnocycle` never
 * compiled. Nothing asserts (2), and the reason (2) is the harder half is that
 * ArgoCD assigns Constraints NO HEALTH: an Application whose Constraints are all
 * unapplied reports `OutOfSync + Healthy`, which `isApplicationSynced` admits for
 * git-directory apps with benign drift. So the policy engine can hold zero
 * installed policies inside a green lane, which is what it did.
 *
 * RE-MEASURED 2026-09-09 on run 34390707656 -- the GREEN 37/37 main run, after
 * the template check landed. At proof time `hat-system` was `OutOfSync/Healthy`
 * and its per-resource dump read `ConstraintTemplate/hatconflict: sync=OutOfSync
 * health=-`, and so on for all seven -- while NOT ONE of the seven Constraints
 * appeared in the resource list at all, because ArgoCD cannot render a Constraint
 * whose CRD does not yet exist. The template step then passed 31 seconds later
 * ("all 7 ConstraintTemplates compiled and created") because it waits. So the
 * half that is checked recovers on retry and says so; the half that is not
 * checked has never been observed either way.
 *
 * -- WHAT THIS MODULE IS ----------------------------------------------------
 * The roster, parsed from `full-ai-cluster/k8s/applications/hat-system/policies/`.
 * It is derived, never restated, because a hardcoded list of seven names is the
 * drift shape this tree has already been bitten by: an eighth policy file would
 * be added and the check would keep passing over seven.
 *
 * It also cross-checks the two halves against each other STATICALLY: every
 * Constraint's `kind` must be declared by some ConstraintTemplate's
 * `spec.crd.spec.names.kind`. A Constraint naming a kind no template defines can
 * never be applied on any cluster, and that is knowable from the text alone.
 *
 * -- REFUSALS (each one exists because its absence makes the check vacuous) --
 *   - an EMPTY roster is a failure, never a skip. A loop over zero constraints
 *     passes trivially, which is the check-that-cannot-fail this file exists to
 *     remove -- the same rule the template step already states for itself.
 *   - a Constraint whose kind no template declares is a failure.
 *   - a ConstraintTemplate declaring a kind no Constraint instantiates is a
 *     failure: an installed template enforcing nothing reads as coverage.
 *
 *
 * -- THE THIRD LAYER, added the same day -----------------------------------
 * Six of the seven templates are REFERENTIAL: their Rego reads other cluster
 * objects out of `data.inventory`, which Gatekeeper populates only for kinds a
 * `config.gatekeeper.sh` Config names in `spec.sync.syncOnly`. NO SUCH CONFIG
 * EXISTED. So the inventory was empty, every comprehension over it yielded the
 * empty list, and every `count(...) >= threshold` compared 0 to a positive
 * number: six policies that compiled, applied, and could not deny anything.
 *
 * Three layers, and each one reconciles perfectly and reports Healthy:
 *   1. the template did not COMPILE
 *   2. the Constraint was never APPLIED
 *   3. the Constraint ENFORCES NOTHING
 *
 * `referentialFailures` closes (3) statically, in both directions and on three
 * axes: a read with no sync, a sync with no read, and a read whose inventory
 * SCOPE disagrees with the CRD scope (well-formed, wrong sub-tree, forever
 * empty).
 *
 * Run:   bun src/Core.TypeScript/cluster/hat-constraint-roster.ts [--json]
 * Exit:  0 -- roster is well-formed and the two halves agree
 *        1 -- empty, or the halves disagree
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";
// Ordinal (code-point) ordering, per .claude/rules/culture-invariant-by-default.md:
// this roster is iterated by a CI step, not displayed, so a locale-dependent order
// would be a locale-dependent roster.
import { stringCompare } from "../collation/collation.ts";

/** Where the policies live, relative to the repo root. */
export const HAT_POLICY_DIR = "full-ai-cluster/k8s/applications/hat-system/policies";

/** The API group every Gatekeeper Constraint instance carries. */
export const CONSTRAINT_GROUP = "constraints.gatekeeper.sh";
/** The API group every Gatekeeper ConstraintTemplate carries. */
export const TEMPLATE_GROUP = "templates.gatekeeper.sh";
/** The API group every Gatekeeper Config carries. */
export const CONFIG_GROUP = "config.gatekeeper.sh";

/** Where the Gatekeeper sync Config lives, relative to the repo root. */
export const HAT_SYNC_CONFIG =
  "full-ai-cluster/k8s/applications/hat-system/gatekeeper-sync-config.yaml";

/** Where the Hat CRDs live, relative to the repo root. */
export const HAT_CRD_DIR = "full-ai-cluster/k8s/applications/hat-system/crds";

/** One live policy object the lane must be able to find. */
export interface ConstraintRef {
  /** e.g. `HatCooldown` -- the generated CRD kind. */
  readonly kind: string;
  /** e.g. `hat-cooldown-default`. */
  readonly name: string;
  /** The file it was parsed out of, for a diagnosable failure message. */
  readonly source: string;
}

/** One ConstraintTemplate and the Constraint kind it declares. */
export interface TemplateRef {
  /** `metadata.name`, e.g. `hatcooldown`. */
  readonly name: string;
  /** `spec.crd.spec.names.kind`, e.g. `HatCooldown`. */
  readonly declaresKind: string;
  readonly source: string;
}

interface CrdNames {
  readonly kind?: string;
}
interface CrdSpec {
  readonly names?: CrdNames;
}
interface Crd {
  readonly spec?: CrdSpec;
}
interface SyncSpec {
  readonly syncOnly?: readonly SyncEntry[];
}
interface TemplateSpec {
  readonly crd?: Crd;
  readonly sync?: SyncSpec;
  /** On a CustomResourceDefinition: `Cluster` or `Namespaced`. */
  readonly scope?: string;
  /** On a CustomResourceDefinition: `spec.names`. */
  readonly names?: CrdNames;
}
interface YamlDoc {
  readonly apiVersion?: string;
  readonly kind?: string;
  readonly metadata?: { readonly name?: string };
  readonly spec?: TemplateSpec;
}

/** Every YAML document in a multi-doc body, nulls dropped. */
function documents(text: string): YamlDoc[] {
  const out: YamlDoc[] = [];
  for (const doc of parseAllDocuments(text)) {
    const value = doc.toJS() as unknown;
    if (value === null) continue;
    if (typeof value === "object") out.push(value as YamlDoc);
  }
  return out;
}

/**
 * The Constraint instances in one file body.
 *
 * Matched on the API GROUP, not on a kind allowlist: the whole point is that a
 * new policy file is picked up without editing this one.
 */
export function parseConstraints(text: string, source: string): ConstraintRef[] {
  const out: ConstraintRef[] = [];
  for (const doc of documents(text)) {
    const apiVersion = doc.apiVersion ?? "";
    if (apiVersion.startsWith(CONSTRAINT_GROUP + "/") === false) continue;
    const kind = doc.kind ?? "";
    const name = doc.metadata?.name ?? "";
    if (kind.length === 0) continue;
    if (name.length === 0) continue;
    out.push({ kind, name, source });
  }
  return out;
}

/** The ConstraintTemplates in one file body, with the kind each declares. */
export function parseTemplates(text: string, source: string): TemplateRef[] {
  const out: TemplateRef[] = [];
  for (const doc of documents(text)) {
    const apiVersion = doc.apiVersion ?? "";
    if (apiVersion.startsWith(TEMPLATE_GROUP + "/") === false) continue;
    if (doc.kind !== "ConstraintTemplate") continue;
    const name = doc.metadata?.name ?? "";
    const declaresKind = doc.spec?.crd?.spec?.names?.kind ?? "";
    if (name.length === 0) continue;
    if (declaresKind.length === 0) continue;
    out.push({ name, declaresKind, source });
  }
  return out;
}

/** Both halves, read off the committed policy directory. */
export interface HatPolicyRoster {
  readonly constraints: readonly ConstraintRef[];
  readonly templates: readonly TemplateRef[];
  /** Every `data.inventory` read the templates make. */
  readonly reads: readonly InventoryRead[];
  /** Every kind the Gatekeeper sync Config populates. */
  readonly synced: readonly SyncEntry[];
  /** Each CRD kind mapped to the inventory sub-tree gatekeeper files it under. */
  readonly scopes: ReadonlyMap<string, string>;
}

/** Read and sort both halves. Sorting keeps the CI output diffable run-to-run. */
export function readHatPolicyRoster(repoRoot: string): HatPolicyRoster {
  const dir = join(repoRoot, HAT_POLICY_DIR);
  const constraints: ConstraintRef[] = [];
  const templates: TemplateRef[] = [];
  const reads: InventoryRead[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (file.endsWith(".yaml") === false) continue;
    const text = readFileSync(join(dir, file), "utf8");
    constraints.push(...parseConstraints(text, file));
    templates.push(...parseTemplates(text, file));
    reads.push(...parseInventoryReads(text, file));
  }
  const configPath = join(repoRoot, HAT_SYNC_CONFIG);
  // Read-and-catch rather than exists-then-read: two syscalls would be a
  // check-then-use window, and a MISSING Config is the defect this reports, not
  // an error to propagate. Empty text parses to an empty syncOnly, which
  // `referentialFailures` then names per policy.
  let configText = "";
  try {
    configText = readFileSync(configPath, "utf8");
  } catch {
    configText = "";
  }
  const synced = parseSyncOnly(configText);
  constraints.sort((a, b) => stringCompare(a.kind + a.name, b.kind + b.name));
  templates.sort((a, b) => stringCompare(a.name, b.name));
  const scopes = crdScopes(repoRoot);
  return { constraints, templates, reads, synced, scopes };
}

/**
 * Everything wrong with a roster. An empty array means the roster is sound.
 *
 * Returned rather than thrown so a caller can report ALL of them at once: a run
 * that names one defect per attempt turns a five-minute fix into five CI cycles.
 */
export function rosterFailures(roster: HatPolicyRoster): string[] {
  const failures: string[] = [];
  const emptyRoster =
    "a loop over an empty roster passes trivially, so an empty roster is a failure and never a skip";
  if (roster.constraints.length === 0) {
    failures.push("no Constraint under " + HAT_POLICY_DIR + " -- " + emptyRoster);
  }
  if (roster.templates.length === 0) {
    failures.push("no ConstraintTemplate under " + HAT_POLICY_DIR + " -- " + emptyRoster);
  }
  const declared = new Set(roster.templates.map((t) => t.declaresKind));
  const instantiated = new Set(roster.constraints.map((c) => c.kind));
  for (const c of roster.constraints) {
    if (declared.has(c.kind)) continue;
    failures.push(
      c.source +
        ": Constraint " +
        c.kind +
        "/" +
        c.name +
        " names a kind no ConstraintTemplate declares -- gatekeeper never generates that CRD, so this policy can never be applied on any cluster",
    );
  }
  for (const t of roster.templates) {
    if (instantiated.has(t.declaresKind)) continue;
    failures.push(
      t.source +
        ": ConstraintTemplate " +
        t.name +
        " declares kind " +
        t.declaresKind +
        " that no Constraint instantiates -- a compiled template with no instance enforces nothing while reading as coverage",
    );
  }
  failures.push(...referentialFailures(roster.reads, roster.synced, roster.scopes));
  return failures;
}

/**
 * The lines the CI step consumes: `<kind> <name>`, one per Constraint.
 *
 * Deliberately not JSON by default. The consumer is a `while read` loop in bash,
 * and a shape a shell can read without `jq` is one fewer place an empty list can
 * be produced silently -- which is the failure this whole module exists to make
 * impossible.
 */
export function rosterLines(roster: HatPolicyRoster): string[] {
  return roster.constraints.map((c) => c.kind + " " + c.name);
}

/** Repo root, from this file's location. Overridable for tests. */
export function defaultRepoRoot(): string {
  return join(import.meta.dir, "..", "..", "..");
}

if (import.meta.main) {
  const roster = readHatPolicyRoster(defaultRepoRoot());
  const failures = rosterFailures(roster);
  for (const failure of failures) console.error("::error::" + failure);
  if (failures.length > 0) process.exit(1);
  for (const line of rosterLines(roster)) console.log(line);
}

/**
 * -- THE THIRD LAYER: A POLICY THAT COMPILES, APPLIES, AND ENFORCES NOTHING --
 *
 * Six of the seven Hat templates are REFERENTIAL -- their Rego reads other
 * cluster objects out of `data.inventory` rather than deciding from the
 * admission review alone. Gatekeeper populates that inventory ONLY for kinds
 * named in a `config.gatekeeper.sh` Config's `spec.sync.syncOnly`.
 *
 * MEASURED 2026-09-09: no such Config existed anywhere in the tree, and the
 * gatekeeper chart does not create one. So the inventory was empty, every
 * comprehension over it produced the empty list, and every
 * `count(...) >= threshold` compared 0 against a positive number. Six policies
 * that compiled, applied, and could not deny anything on any input.
 *
 * The checks below tie the two halves together, in both directions, because
 * either half alone is satisfiable while the system does nothing:
 *   - a kind the Rego READS that the Config does not SYNC -- the defect above;
 *   - a kind the Config SYNCS that no Rego reads -- a cache paid for and unused,
 *     which is a real memory cost on gatekeeper's audit pod and, worse, reads as
 *     evidence that a policy is wired up when nothing queries it.
 */

/** The API group every Gatekeeper Config carries. */

/** Where the sync Config lives, relative to the repo root. */

/** One `data.inventory` read, as the Rego spells it. */
export interface InventoryRead {
  /** `cluster` or `namespace` -- must match the CRD scope. */
  readonly scope: string;
  /** e.g. `society.zeta.io/v1alpha1`. */
  readonly apiVersion: string;
  /** e.g. `HatBinding`. */
  readonly kind: string;
  readonly source: string;
}

/**
 * Every `data.inventory` read in a policy file body.
 *
 * Matched on the two shapes gatekeeper actually serves, with the index between
 * `namespace` and the apiVersion allowed to be any Rego expression (it is
 * usually a bound variable such as `ns`):
 *
 *   data.inventory.cluster["<apiVersion>"]["<Kind>"]
 *   data.inventory.namespace[<expr>]["<apiVersion>"]["<Kind>"]
 *
 * A text match rather than a Rego parse, and the limit is stated because it
 * decides what this check can promise: a path assembled at runtime from
 * variables would not be seen. Every policy in the tree spells it literally, so
 * the match is complete TODAY -- and `rosterFailures` refuses a syncOnly entry
 * nothing reads, which is what turns a future miss into a red check rather than
 * a silent one.
 */
export function parseInventoryReads(text: string, source: string): InventoryRead[] {
  const out: InventoryRead[] = [];
  const clusterRe = /data\.inventory\.cluster\["([^"]+)"\]\["([^"]+)"\]/g;
  for (const m of text.matchAll(clusterRe)) {
    if (m[1] === undefined) continue;
    if (m[2] === undefined) continue;
    const apiVersion = m[1];
    const kind = m[2];
    const scope = "cluster";
    out.push({ scope, apiVersion, kind, source });
  }
  const nsRe = /data\.inventory\.namespace\[[^\]]+\]\["([^"]+)"\]\["([^"]+)"\]/g;
  for (const m of text.matchAll(nsRe)) {
    if (m[1] === undefined) continue;
    if (m[2] === undefined) continue;
    const apiVersion = m[1];
    const kind = m[2];
    const scope = "namespace";
    out.push({ scope, apiVersion, kind, source });
  }
  return out;
}

/** One `spec.sync.syncOnly` entry. */
export interface SyncEntry {
  readonly group: string;
  readonly version: string;
  readonly kind: string;
}

/**
 * The `syncOnly` list out of a Gatekeeper Config body.
 *
 * Returns an EMPTY list both when the file has no Config and when the Config
 * syncs nothing -- the caller treats both as the defect, because they have the
 * same consequence: an empty `data.inventory`.
 */
export function parseSyncOnly(text: string): SyncEntry[] {
  const out: SyncEntry[] = [];
  for (const doc of documents(text)) {
    const apiVersion = doc.apiVersion ?? "";
    if (apiVersion.startsWith(CONFIG_GROUP + "/") === false) continue;
    if (doc.kind !== "Config") continue;
    for (const entry of doc.spec?.sync?.syncOnly ?? []) {
      out.push(entry);
    }
  }
  return out;
}

/**
 * Everything wrong with the referential half: reads with no sync, and syncs no
 * read. Empty array means the two halves agree.
 *
 * Checked in BOTH directions on purpose. A read with no sync is the measured
 * defect -- a policy that cannot fire. A sync with no read is the mirror: a
 * cached kind nobody queries, which costs gatekeeper's audit pod real memory and
 * reads as evidence that a policy is wired up when nothing consults it.
 */
export function referentialFailures(
  reads: readonly InventoryRead[],
  synced: readonly SyncEntry[],
  scopes: ReadonlyMap<string, string> = new Map(),
): string[] {
  const failures: string[] = [];
  const syncedKeys = new Set(synced.map((e) => e.group + "/" + e.version + "/" + e.kind));
  const readKeys = new Set<string>();
  for (const read of reads) {
    const key = read.apiVersion + "/" + read.kind;
    readKeys.add(key);
    const wantScope = scopes.get(read.kind);
    if (wantScope !== undefined && wantScope !== read.scope) {
      const mism =
        " reads data.inventory." +
        read.scope +
        " for " +
        read.kind +
        ", whose CRD is " +
        wantScope +
        "-scoped -- gatekeeper files it under the OTHER sub-tree, so the query is well-formed and forever empty";
      failures.push(read.source + ":" + mism);
    }
    if (syncedKeys.has(key)) continue;
    const why = " reads data.inventory." + read.scope + " for " + key + ", which no Gatekeeper Config syncOnly entry populates -- the comprehension yields the empty list on every input, so the policy compiles, applies, and CANNOT DENY ANYTHING";
    failures.push(read.source + ":" + why);
  }
  for (const entry of synced) {
    const key = entry.group + "/" + entry.version + "/" + entry.kind;
    if (readKeys.has(key)) continue;
    const why = "syncOnly caches " + key + " that no policy reads -- gatekeeper's audit pod pays memory for it, and a cached kind reads as evidence a policy is wired up when nothing queries it";
    failures.push(HAT_SYNC_CONFIG + ": " + why);
  }
  return failures;
}


/**
 * Each CRD's kind mapped to the `data.inventory` sub-tree gatekeeper files it
 * under: `Cluster` scope lands in `data.inventory.cluster`, `Namespaced` in
 * `data.inventory.namespace[ns]`.
 *
 * Derived from the CRDs rather than restated, because a Rego path whose scope
 * disagrees with the CRD's is a THIRD way to read forever-empty -- the data is
 * synced, the query is well-formed, and it looks in the wrong sub-tree. That
 * failure is silent and identical in effect to the one this file already names.
 */
export function crdScopes(repoRoot: string): Map<string, string> {
  const out = new Map<string, string>();
  const dir = join(repoRoot, HAT_CRD_DIR);
  for (const file of readdirSync(dir).sort()) {
    if (file.endsWith(".yaml") === false) continue;
    const text = readFileSync(join(dir, file), "utf8");
    for (const doc of documents(text)) {
      if (doc.kind !== "CustomResourceDefinition") continue;
      const kind = doc.spec?.names?.kind ?? "";
      const scope = doc.spec?.scope ?? "";
      if (kind.length === 0) continue;
      if (scope === "Cluster") out.set(kind, "cluster");
      if (scope === "Namespaced") out.set(kind, "namespace");
    }
  }
  return out;
}
