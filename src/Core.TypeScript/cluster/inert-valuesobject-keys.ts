// Inert `valuesObject` keys — does every key an Application declares exist in
// the schema of the chart it is pinned to?
//
// WHY THIS EXISTS
// ---------------
// An Application's `helm.valuesObject` is a statement of intent that Helm does
// not check. A key the chart has no schema for is not an error, not a warning,
// and not a diff — it is silently discarded, and the manifest goes on reading
// exactly like one that governs something. This tree was bitten by that defect
// FOUR times in one night, each found by a different route and none of them by
// a check:
//
//   hindsight  `postgresql.primary.persistence.*` — the bitnami subchart
//              layout, against a chart that ships its own StatefulSet reading
//              `postgresql.persistence.*`. Postgres landed on node-local disk
//              with `reclaimPolicy: Delete` while the catalogue said longhorn.
//   nats       a TOP-LEVEL `cluster: {enabled, replicas: 3}`, against a chart
//              that reads `config.cluster`. No JetStream quorum: a stream with
//              `replicas > 1` refuses to create.
//   oz         `adminSecret: {name, key}` — a key ziti-controller has never had
//              in any published version.
//   headscale  an entire top-level `config:` block, against a chart whose
//              values.yaml has six top-level keys and no `config`. ZERO
//              occurrences of `server_url` in the render; CrashLoopBackOff.
//
// THE FIRST THREE WERE CAUGHT BY A STORAGE CHECK, AND THAT IS THE POINT.
// `rendered-storage-claims.ts` compares a declared PVC against a rendered one,
// so it catches an inert key only when that key happens to govern storage.
// headscale's governed whether the process could start, and nothing would have
// caught it. The guard that catches all four is the one this module is:
// compare every Application's `valuesObject` key set against its pinned
// chart's schema.
//
// THE HARD PART IS FALSE POSITIVES, NOT TRUE POSITIVES
// ----------------------------------------------------
// A naive key-set comparison against the parent chart's `values.yaml` cries
// wolf on nearly every app in this tree, and a guard that cries wolf gets
// disabled — which is strictly worse than no guard. Four sources of legitimate
// keys absent from a parent `values.yaml`, all measured in this tree:
//
//   SUBCHARTS       `postgresql.auth.database` is valid for headscale because
//                   headscale declares a postgresql dependency; the key lives
//                   in the SUBCHART's values.yaml under the dependency's name
//                   (or its `alias`). Resolved from `Chart.yaml` + `charts/`.
//   LIBRARY CHARTS  headscale's own values.yaml has six top-level keys, and the
//                   Application legitimately sets `persistence.config.accessMode`
//                   — because `bjw-s.common` is `type: library`, its templates
//                   are evaluated in the PARENT's scope, so its `.Values.x` is
//                   the parent's `x`. A library subchart contributes its schema
//                   at the parent's prefix, not under its own name. Getting
//                   this wrong would flag most of headscale's working values.
//   CONDITIONAL     `ingress.main.hosts[].host` is read only under
//                   `ingress.main.enabled`. Absent from a default render is not
//                   absent from the chart, so acceptance is read from the
//                   TEMPLATES' literal `.Values.a.b.c` references as well as
//                   from the default tree — a path the chart names anywhere is
//                   a path the chart has.
//   OPEN MAPS       `env`, `podAnnotations`, `persistence` (keyed by an
//                   arbitrary item name), `extraObjects`. A key under one of
//                   these is not inert BY DEFINITION: the chart consumes the
//                   whole node. Detected from the chart's own text — a `range`
//                   over the node, a `toYaml` of it, a binding of it to a
//                   variable, or an empty-map default — never from a hardcoded
//                   list of key names, which would be a second schema free to
//                   drift from the charts.
//
// UNDECIDABLE IS A FINDING, NEVER A PASS
// --------------------------------------
// Some charts reach `.Values` dynamically — `index .Values $name`, a range over
// the root — and for those, no key set can be derived and no key can be called
// inert. Some charts cannot be fetched at all. Neither is a pass: an app that
// could not be checked is reported as UNDECIDABLE with its reason, and
// UNDECIDABLE counts toward the exit code exactly like an inert key. The
// precedent is `snapshot-coverage-stale` in the reason-truth work, and the
// failure it prevents is the one this repo names most often: a check that did
// not run wearing the face of one that passed.
//
// OFFLINE BY SNAPSHOT, same split as `rendered-storage-claims.ts`
// --------------------------------------------------------------
// Deriving a schema needs `helm pull`, the network, and an upstream still
// serving the pinned tag. Three ways to be unavailable, and an unavailable gate
// is skipped, and a skipped gate reads like a passing one. So the SCHEMA is
// measured, dated, pinned and checked in as text; the CHECK compares our own
// manifests against it offline and deterministically. Editing a manifest
// without re-measuring goes red in CI with no network at all, and
// `--check-snapshot` re-derives live and refuses drift so the snapshot cannot
// become a comfortable fiction that outlives the charts it describes.

import { readFileSync, readdirSync, mkdirSync, writeFileSync, renameSync, rmSync, type Dirent } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { parse as parseYaml } from "yaml";
import { stringCompare } from "../collation/collation.ts";
import { discoverApplications, type ApplicationSource } from "./rendered-storage-claims.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const DEFAULT_SCHEMA_SNAPSHOT_PATH = "src/Core.TypeScript/cluster/inert-valuesobject-keys.schema.json";
export const DEFAULT_BASELINE_PATH = "src/Core.TypeScript/cluster/inert-valuesobject-keys.baseline.json";

// ---------------------------------------------------------------------------
// The schema of one chart, as a set of accepted key paths
// ---------------------------------------------------------------------------

/**
 * What a chart accepts, expressed over dotted key paths.
 *
 * Three sets rather than one, because they answer three different questions and
 * collapsing them would lose the reason a key was accepted:
 *
 *   `literal`  paths the chart NAMES — every node of its default `values.yaml`
 *              tree, and every `.Values.a.b.c` its templates (and its
 *              subcharts', at the right prefix) reference literally.
 *   `open`     prefixes the chart consumes WHOLESALE — a `range`, a `toYaml`, a
 *              variable binding, an empty-map default. Any key beneath one of
 *              these reaches the chart, so none of them can be inert.
 *   `dynamic`  prefixes the chart reaches by a computed path (`index .Values
 *              $name`). Nothing beneath one of these is decidable, and the
 *              honest answer is UNDECIDABLE rather than either verdict.
 */
export interface ChartSchema {
  readonly literal: readonly string[];
  readonly open: readonly string[];
  readonly dynamic: readonly string[];
  /** Charts folded in, `<prefix>=<name>@<version>` — provenance for the snapshot diff. */
  readonly charts: readonly string[];
}

interface SchemaAccumulator {
  literal: Set<string>;
  open: Set<string>;
  dynamic: Set<string>;
  charts: string[];
}

function emptyAccumulator(): SchemaAccumulator {
  return { literal: new Set<string>(), open: new Set<string>(), dynamic: new Set<string>(), charts: [] };
}

/**
 * The shortest prefixes of a set — its minimal antichain.
 *
 * `persistence` and `persistence.config` both being OPEN says nothing more than
 * `persistence` alone: coverage is by prefix, so a longer entry under a shorter
 * one is dead weight. Dropping them is semantics-preserving and it is what
 * makes the checked-in snapshot readable — the open set fell from ~7000 entries
 * to the handful of roots a human can actually scan and disagree with. An
 * artifact nobody can read is not an artifact anybody checks.
 */
export function minimalPrefixes(paths: readonly string[]): string[] {
  const sorted = [...new Set(paths)].sort((a, b) => stringCompare(a, b));
  const out: string[] = [];
  for (const path of sorted) {
    if (out.some((kept) => kept === "" || path === kept || path.startsWith(`${kept}.`))) continue;
    out.push(path);
  }
  return out;
}

/**
 * Freeze the accumulator, minimising both prefix sets and dropping literal
 * paths that sit STRICTLY BELOW an open prefix.
 *
 * A literal under an open prefix is already accepted by the open rule, so
 * storing it changes no verdict. What it would change is the size of a
 * checked-in artifact by roughly half, on paths that carry no information.
 *
 * The one thing this must not break is the LITERAL-ANCESTOR rule — "the chart
 * reads `a.b.c`, so `a` is a real path" — because the evidence for `a` may have
 * been the pruned `a.b.c`. `classifyPath` therefore consults the open set for
 * ancestry too, which is correct independently: if `a.b` is open then `a` is a
 * path the chart has.
 */
function freeze(accumulator: SchemaAccumulator): ChartSchema {
  const open = minimalPrefixes([...accumulator.open]);
  const dynamic = minimalPrefixes([...accumulator.dynamic]);
  const literal = [...accumulator.literal]
    .filter((path) => !open.some((prefix) => prefix !== "" && path.startsWith(`${prefix}.`)))
    .sort((a, b) => stringCompare(a, b));
  return {
    literal,
    open,
    dynamic,
    charts: [...accumulator.charts].sort((a, b) => stringCompare(a, b)),
  };
}

function joinPath(prefix: string, key: string): string {
  return prefix === "" ? key : `${prefix}.${key}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Every node of a default `values.yaml` tree, as dotted paths.
 *
 * An EMPTY map or an empty array is recorded as OPEN, not as a leaf: `env: {}`
 * and `extraObjects: []` are the chart saying "put whatever you like here", and
 * calling a key beneath one of them inert would be the guard inventing a defect.
 * A `null` default is a LEAF and stays literal — `storageClass:` with no value
 * is a scalar the chart reads, not an invitation to nest under it.
 *
 * Array elements are not indexed. A chart that ships `hosts: [{host: a}]`
 * accepts `hosts` and everything under it; enumerating `hosts[0].host` would
 * make the guard's answer depend on how many elements the DEFAULT happens to
 * carry, which is a fact about the chart's example rather than its schema.
 */
export function valuesTreePaths(values: unknown, prefix = ""): { literal: string[]; open: string[] } {
  const literal: string[] = [];
  const open: string[] = [];
  if (Array.isArray(values)) {
    if (prefix !== "") open.push(prefix);
    return { literal, open };
  }
  if (!isRecord(values)) return { literal, open };
  if (Object.keys(values).length === 0) {
    if (prefix !== "") open.push(prefix);
    return { literal, open };
  }
  for (const [key, child] of Object.entries(values)) {
    const path = joinPath(prefix, key);
    literal.push(path);
    const nested = valuesTreePaths(child, path);
    literal.push(...nested.literal);
    open.push(...nested.open);
  }
  return { literal, open };
}

/**
 * `.Values` usages in one template's text.
 *
 * LITERAL — `.Values.a.b.c`. Every ANCESTOR is recorded too: a chart that reads
 * `.Values.clientApi.advertisedHost` has `clientApi`, and a manifest that sets
 * the parent map is not declaring a key the chart lacks.
 *
 * OPEN — the chart consumes a node wholesale. Four forms, all measured in this
 * tree's charts rather than imagined:
 *
 *   `range $k, $v := .Values.persistence`   bjw-s common, keyed by item name
 *   `toYaml .Values.podAnnotations`         a passthrough map
 *   `.Values.worker.config | toYaml`        the SAME act, piped — and leaving
 *                                           this form out flagged
 *                                           node-feature-discovery's whole
 *                                           worker configuration as inert
 *   `$values := .Values.env`                bound, then ranged elsewhere —
 *                                           bjw-s `_env_vars.tpl` does exactly
 *                                           this, and a rule that only saw the
 *                                           direct `range` would flag every
 *                                           environment variable in the tree
 * A FIFTH RULE WAS CONSIDERED AND NOT WRITTEN: "the chart names `x` but never
 * names any `x.<child>`, so `x` must be consumed as a unit." It is plausible
 * and it is not measured — no chart in this tree needs it that the four rules
 * above do not already cover — and an unmeasured widening of what counts as
 * accepted is exactly how a guard quietly stops finding things.
 *
 * DYNAMIC — `index .Values ...`, `get .Values ...`, a range over the bare root.
 * A computed path means no key set can be derived, and the honest verdict for
 * everything beneath it is UNDECIDABLE.
 */
export function templateValuesRefs(text: string): { literal: string[]; open: string[]; dynamic: string[] } {
  const literal: string[] = [];
  const open: string[] = [];
  const dynamic: string[] = [];

  for (const match of text.matchAll(/\.Values((?:\.[A-Za-z_][A-Za-z0-9_-]*)+)/g)) {
    const path = (match[1] ?? "").slice(1);
    if (path === "") continue;
    const segments = path.split(".");
    for (let index = 1; index <= segments.length; index += 1) {
      literal.push(segments.slice(0, index).join("."));
    }
  }

  // Wholesale consumption. Each alternative captures the path AFTER `.Values.`.
  const openForms = [
    /range\s+[^}]*?:=\s*\.Values\.([A-Za-z_][A-Za-z0-9_.-]*)/g,
    /(?:toYaml|toJson|toPrettyJson|tpl)\s+\.Values\.([A-Za-z_][A-Za-z0-9_.-]*)/g,
    // THE PIPELINE FORM, and leaving it out was a MEASURED false positive.
    // node-feature-discovery 0.17.1 writes `.Values.worker.config | toYaml`,
    // which hands the whole worker configuration to the ConfigMap verbatim —
    // so every key beneath it reaches the chart. Without this alternative the
    // guard reported `worker.config.sources` as inert, which is exactly the
    // cry-wolf that gets a guard disabled. Helm templates use the pipeline form
    // at least as often as the prefix form; both are the same act.
    /\.Values\.([A-Za-z_][A-Za-z0-9_.-]*)\s*\|\s*(?:toYaml|toJson|toPrettyJson|tpl|nindent|indent)/g,
    /\$[A-Za-z_][A-Za-z0-9_]*\s*:?=\s*\.Values\.([A-Za-z_][A-Za-z0-9_.-]*)/g,
  ];
  for (const form of openForms) {
    for (const match of text.matchAll(form)) {
      const path = (match[1] ?? "").replace(/\.$/, "");
      if (path !== "") open.push(path);
    }
  }

  // COMPUTED REACH -- and `get .Values "edition"` IS NOT ONE.
  //
  // `index`/`get`/`pluck`/`dig` on `.Values` is the dynamic-path form, but only
  // when the SUBSCRIPT is computed. ziti-controller 3.1.1 `_helpers.tpl:141`
  // writes `get .Values "edition"` -- a quoted literal, exactly equivalent to
  // `.Values.edition`. Treating every `get .Values` as dynamic marked that
  // chart's whole root undecidable, which turned `oz`'s `adminSecret:` (a key
  // ziti-controller has never had) from a caught defect into an unanswered
  // question. Measured, not supposed: it is why this branch reads the arguments.
  // The match does NOT consume the subscript list, and that matters: a single
  // line can carry TWO reaches — gitlab's NOTES.txt writes
  // `(index .Values "gitlab-runner").install` and
  // `(index .Values "gitlab-runner").runners.privileged` in one `if and`. A
  // pattern that swallowed the rest of the line found only the first, and the
  // second path then looked absent from the chart. The verdict that produced
  // was true by accident, which is not a verdict this module is allowed to
  // reach: the subscripts are read from a slice AFTER the match instead.
  for (const match of text.matchAll(/(?:index|get|pluck|dig)\s+\.Values((?:\.[A-Za-z_][A-Za-z0-9_-]*)*)/g)) {
    const base = (match[1] ?? "").replace(/^\./, "");
    const after = text.slice(match.index + match[0].length);
    const read = literalSubscripts(after.slice(0, after.search(/\n|$/)));
    const path = [base, ...read.literals].filter((segment) => segment !== "").join(".");
    if (!read.complete) {
      // THE DYNAMIC PREFIX IS AS DEEP AS THE LITERALS GO, and this precision is
      // the difference between a useful verdict and a useless one. gitlab
      // writes `index .Values "global" "communityImages" .Chart.Name
      // "repository"` — two literal subscripts, then a computed one. Recording
      // the dynamic reach at the ROOT (which is what stopping at the first
      // `index` does) makes every undecided key in a 30-subchart umbrella
      // UNDECIDABLE, and "undecidable" is not an actionable report. Recording
      // it at `global.communityImages` leaves the rest of the chart decidable.
      // Measured on spire: the root-level version reported
      // `spire-agent.workloadAttestors.k8s.skipKubeletVerification` as
      // undecidable; the precise version reports it as INERT, which is what it
      // is — spire's own README says the setting was REMOVED in 0.23.x.
      dynamic.push(path);
      continue;
    }
    if (path === "") continue;
    const segments = path.split(".");
    for (let index = 1; index <= segments.length; index += 1) literal.push(segments.slice(0, index).join("."));
  }
  if (/range\s+\$[A-Za-z0-9_]+\s*,\s*\$[A-Za-z0-9_]+\s*:=\s*\.Values\s*[}|]/.test(text)) dynamic.push("");

  return { literal, open, dynamic };
}

/**
 * The quoted-literal subscripts of an `index`/`get` call, or `null` when any of
 * them is computed.
 *
 * Reads tokens up to the end of the action (`}}`, `-}}`) or the start of a
 * pipeline (`|`), which is where the subscript list ends in every form Helm
 * accepts. `complete: false` — "the next subscript is an expression" — is the
 * honest answer that makes the caller record a DYNAMIC reach, and it is
 * deliberately what an unrecognised token produces rather than an optimistic
 * "that was the end of the list". The literals read BEFORE the stop are still
 * returned, because they still name a real prefix.
 */
export function literalSubscripts(rest: string): { literals: readonly string[]; complete: boolean } {
  const out: string[] = [];
  for (const raw of rest.trim().split(/\s+/)) {
    if (raw === "" || raw.startsWith("|") || raw.startsWith("}}") || raw.startsWith("-}}") || raw.startsWith(")"))
      break;
    // A PARENTHESISED call ends the subscript list: ziti-controller writes
    // `(get .Values "edition") | default dict`, so the token carrying the last
    // subscript also carries the closing paren. Stripping it and stopping is
    // what makes that a LITERAL read of `edition` rather than a computed reach
    // that marks the chart's whole root undecidable.
    // `(index .Values "spire-agent").enabled` — the closing paren ends the
    // subscript list AND a dotted tail continues the path. spire 0.24.2 writes
    // exactly this for every one of its six subcharts (their names contain
    // hyphens, so `.Values.spire-agent` is not expressible), and gitlab does it
    // for `gitlab-runner`. Reading only up to the paren marked those charts'
    // whole roots undecidable — an honest answer, and a needlessly weak one for
    // a path the chart names literally.
    // Parens are STRIPPED before matching rather than pinned to one position.
    // spire's NOTES.txt writes `((index .Values "spire-server").experimental).enabled`
    // — a closing paren in the MIDDLE of the dotted tail — and a pattern that
    // only allowed them at the ends read that as a computed reach, marking the
    // whole spire root undecidable. Stripping them and requiring what remains
    // to be exactly `"name"` followed by a dotted tail keeps the rule checkable
    // while matching Helm's actual grammar, where `(index .Values "x")` always
    // closes immediately after the subscript.
    const closing = /^"([^"]*)"((?:\.[A-Za-z_][A-Za-z0-9_-]*)*)$/.exec(raw.replace(/\)/g, ""));
    if (closing !== null && raw.includes(")")) {
      out.push(closing[1] ?? "");
      for (const segment of (closing[2] ?? "").split(".")) if (segment !== "") out.push(segment);
      return { literals: out, complete: true };
    }
    const quoted = /^"([^"]*)"$/.exec(raw);
    if (quoted === null) return { literals: out, complete: false };
    out.push(quoted[1] ?? "");
  }
  return { literals: out, complete: true };
}

// ---------------------------------------------------------------------------
// Folding a chart directory (and its subcharts) into one schema
// ---------------------------------------------------------------------------

function readIfPresent(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
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

/** Every file under a directory, recursively, sorted — templates live in subdirectories. */
function filesUnder(abs: string): string[] {
  const out: string[] = [];
  for (const entry of (readdirIfPresent(abs) ?? []).sort((a, b) => stringCompare(a.name, b.name))) {
    const child = join(abs, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(child));
    else if (entry.isFile()) out.push(child);
  }
  return out;
}

/**
 * `dependencies:` from `Chart.yaml`, as `name -> values key`.
 *
 * The values key is the dependency's `alias` when it has one, and its `name`
 * otherwise. This is not cosmetic: a chart aliased as `primary` is configured
 * under `primary.*` and its own name appears nowhere in the parent's values, so
 * reading the directory name would flag every one of its keys.
 *
 * A LIST PER NAME, NOT ONE KEY — measured on spire 0.24.2, which depends on
 * `spire-agent` TWICE: once unaliased (configured under `spire-agent.*`) and
 * once as `upstream-spire-agent`. A `name -> key` map lets the second
 * declaration overwrite the first, and the whole `spire-agent.*` subtree then
 * has no schema at all — which is how `spire-agent.workloadAttestors`, a key
 * the subchart plainly has, came back as UNDECIDABLE. One directory, two value
 * keys, both real.
 */
export function dependencyValueKeys(chartYaml: unknown): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();
  if (!isRecord(chartYaml)) return out;
  const dependencies = chartYaml["dependencies"];
  if (!Array.isArray(dependencies)) return out;
  for (const dependency of dependencies) {
    if (!isRecord(dependency)) continue;
    const name = typeof dependency["name"] === "string" ? dependency["name"] : "";
    if (name === "") continue;
    const alias = typeof dependency["alias"] === "string" && dependency["alias"] !== "" ? dependency["alias"] : name;
    const keys = out.get(name) ?? [];
    if (!keys.includes(alias)) keys.push(alias);
    out.set(name, keys);
  }
  return out;
}

/**
 * Fold one unpacked chart directory into the accumulator at `prefix`.
 *
 * THE LIBRARY-CHART RULE IS THE ONE THAT MATTERS. A `type: library` subchart's
 * templates are `include`d from the parent with the PARENT's context, so its
 * `.Values.persistence` is the parent's `persistence` — it contributes at
 * `prefix`, not at `prefix.<name>`. An application subchart is rendered in its
 * own scope, so it contributes at `prefix.<alias-or-name>`. Getting this
 * backwards produces a guard that flags most of headscale's working values and
 * accepts none of postgresql's, which is a guard nobody would keep.
 */
export function foldChart(chartDir: string, prefix: string, accumulator: SchemaAccumulator): void {
  const chartYaml = parseYaml(readIfPresent(join(chartDir, "Chart.yaml")) ?? "") as unknown;
  const chartName = isRecord(chartYaml) && typeof chartYaml["name"] === "string" ? chartYaml["name"] : "";
  const chartVersion = isRecord(chartYaml) && typeof chartYaml["version"] === "string" ? chartYaml["version"] : "";
  accumulator.charts.push(`${prefix === "" ? "<root>" : prefix}=${chartName}@${chartVersion}`);

  const valuesText = readIfPresent(join(chartDir, "values.yaml")) ?? readIfPresent(join(chartDir, "values.yml"));
  if (valuesText !== null) {
    const tree = valuesTreePaths(parseYaml(valuesText) as unknown, prefix);
    for (const path of tree.literal) accumulator.literal.add(path);
    for (const path of tree.open) accumulator.open.add(path);
  }

  // `values.schema.json` is a SECOND declaration of the same schema, and where
  // a chart ships one it is the authoritative list of keys it will accept —
  // including keys absent from the defaults. Read when present; never required.
  const schemaText = readIfPresent(join(chartDir, "values.schema.json"));
  if (schemaText !== null) {
    try {
      for (const path of jsonSchemaPaths(JSON.parse(schemaText) as unknown, prefix)) accumulator.literal.add(path);
    } catch {
      // A chart whose schema file is not JSON tells us nothing; the defaults and
      // the templates still do. Never fatal — an unparseable extra source must
      // not turn a checkable chart into an unchecked one.
    }
  }

  for (const file of [...filesUnder(join(chartDir, "templates")), ...filesUnder(join(chartDir, "files"))]) {
    const text = readIfPresent(file);
    if (text === null) continue;
    const refs = templateValuesRefs(text);
    for (const path of refs.literal) accumulator.literal.add(joinPath(prefix, path));
    for (const path of refs.open) accumulator.open.add(joinPath(prefix, path));
    for (const path of refs.dynamic) accumulator.dynamic.add(path === "" ? prefix : joinPath(prefix, path));
  }

  const aliases = dependencyValueKeys(chartYaml);
  for (const entry of readdirIfPresent(join(chartDir, "charts")) ?? []) {
    if (!entry.isDirectory()) continue;
    const subDir = join(chartDir, "charts", entry.name);
    const subChartYaml = parseYaml(readIfPresent(join(subDir, "Chart.yaml")) ?? "") as unknown;
    const subName =
      isRecord(subChartYaml) && typeof subChartYaml["name"] === "string" ? subChartYaml["name"] : entry.name;
    const isLibrary = isRecord(subChartYaml) && subChartYaml["type"] === "library";
    const valueKeys = aliases.get(subName) ?? [subName];
    if (isLibrary) {
      // Parent scope — AND its own name, because a library chart may still be
      // given a values block of its own by convention.
      for (const key of valueKeys) accumulator.literal.add(joinPath(prefix, key));
      foldChart(subDir, prefix, accumulator);
      continue;
    }
    // EVERY alias, not the last one. The subchart's schema is identical under
    // each, and folding only one leaves the others unmeasured.
    for (const key of valueKeys) foldChart(subDir, joinPath(prefix, key), accumulator);
  }
}

/** Property paths declared by a `values.schema.json`, including `additionalProperties` openness. */
export function jsonSchemaPaths(schema: unknown, prefix: string): string[] {
  const out: string[] = [];
  if (!isRecord(schema)) return out;
  const properties = schema["properties"];
  if (isRecord(properties)) {
    for (const [key, child] of Object.entries(properties)) {
      const path = joinPath(prefix, key);
      out.push(path);
      out.push(...jsonSchemaPaths(child, path));
    }
  }
  return out;
}

/**
 * `global.*` is accepted for every chart, unconditionally.
 *
 * Helm propagates `global` into every subchart's scope whether or not any of
 * them declares it, so a `global` key can be meaningful to a chart that names
 * it nowhere. That is a property of Helm, not of any chart, so it is added here
 * rather than discovered — and it is the one hardcoded acceptance in this
 * module, which is why it is called out instead of buried.
 */
export const HELM_RESERVED_OPEN_PREFIXES = ["global"] as const;

// ---------------------------------------------------------------------------
// Fetching the pinned chart
// ---------------------------------------------------------------------------

export interface ChartUnavailable {
  readonly ok: false;
  /** Machine-stable class: `helm-pull-failed`, `no-pinned-version`, `no-chart-yaml`. */
  readonly reason: string;
  readonly detail: string;
}

export interface ChartFetched {
  readonly ok: true;
  readonly dir: string;
}

export type ChartFetchResult = ChartFetched | ChartUnavailable;

export interface FetchOptions {
  readonly repoRoot?: string | undefined;
  readonly cacheDir?: string | undefined;
  readonly helmBin?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly runHelm?: (args: readonly string[], cwd: string) => { status: number; stdout: string; stderr: string };
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

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

/**
 * The pinned chart, unpacked, from the cache or from the registry.
 *
 * `helm pull --untar` rather than pull-then-tar so the unpacking is helm's own
 * — a chart whose archive helm accepts and our tar reader does not would be an
 * UNAVAILABLE verdict manufactured by the checker, which is the one thing an
 * undecidable list must never contain.
 *
 * A `git-path` Application is resolved from the tree instead: its chart is in
 * this repo, so there is nothing to fetch and nothing that can be unavailable.
 */
export function fetchChart(source: ApplicationSource, options: FetchOptions = {}): ChartFetchResult {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  if (source.kind === "git-path") {
    const abs = resolve(repoRoot, source.gitPath);
    if (readIfPresent(join(abs, "Chart.yaml")) === null) {
      return {
        ok: false,
        reason: "no-chart-yaml",
        detail: `${source.gitPath || "<no path>"} is a git-path source with no Chart.yaml — nothing declares a schema`,
      };
    }
    return { ok: true, dir: abs };
  }
  if (source.targetRevision.trim() === "") {
    return { ok: false, reason: "no-pinned-version", detail: `${source.chart} has no targetRevision` };
  }

  const cacheDir = options.cacheDir ?? join(repoRoot, ".helm-schema-cache");
  mkdirSync(cacheDir, { recursive: true });
  const unpacked = join(cacheDir, `${safeName(`${source.chart}-${source.targetRevision}`)}`);
  if (readIfPresent(join(unpacked, source.chart, "Chart.yaml")) !== null) {
    return { ok: true, dir: join(unpacked, source.chart) };
  }

  const helm = options.runHelm ?? defaultRunHelm(options.helmBin ?? "helm", options.timeoutMs ?? 180_000);
  const scratch = `${unpacked}.partial`;
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  const isOci = !source.repoURL.startsWith("http");
  const pullArgs = isOci
    ? [
        "pull",
        `oci://${source.repoURL}/${source.chart}`,
        "--version",
        source.targetRevision,
        "--untar",
        "--untardir",
        scratch,
      ]
    : [
        "pull",
        "--repo",
        source.repoURL,
        source.chart,
        "--version",
        source.targetRevision,
        "--untar",
        "--untardir",
        scratch,
      ];
  const pulled = helm(pullArgs, cacheDir);
  if (pulled.status !== 0) {
    rmSync(scratch, { recursive: true, force: true });
    return {
      ok: false,
      reason: "helm-pull-failed",
      detail: `${source.chart}@${source.targetRevision} from ${source.repoURL}: ${pulled.stderr.trim().split("\n").slice(0, 3).join(" / ")}`,
    };
  }
  // The unpacked directory is named after the PACKAGED chart, which is not
  // always the name the repository index is keyed by — `helm pull
  // node-feature-discovery` unpacks `node-feature-discovery-chart/`. Read what
  // is there rather than guessing.
  const produced = (readdirIfPresent(scratch) ?? []).filter((entry) => entry.isDirectory());
  if (produced.length !== 1) {
    rmSync(scratch, { recursive: true, force: true });
    return {
      ok: false,
      reason: "helm-pull-produced-nothing",
      detail: `${source.chart}@${source.targetRevision}: pull reported success and unpacked ${String(produced.length)} directories`,
    };
  }
  rmSync(unpacked, { recursive: true, force: true });
  renameSync(scratch, unpacked);
  const dir = join(unpacked, (readdirIfPresent(unpacked) ?? [])[0]?.name ?? "");
  if (readIfPresent(join(dir, "Chart.yaml")) === null) {
    return {
      ok: false,
      reason: "no-chart-yaml",
      detail: `${source.chart}@${source.targetRevision} unpacked without a Chart.yaml`,
    };
  }
  return { ok: true, dir };
}

/** The full schema of one Application's pinned chart, subcharts folded in. */
export function chartSchemaFor(source: ApplicationSource, options: FetchOptions = {}): ChartSchema | ChartUnavailable {
  const fetched = fetchChart(source, options);
  if (!fetched.ok) return fetched;
  const accumulator = emptyAccumulator();
  foldChart(fetched.dir, "", accumulator);
  for (const reserved of HELM_RESERVED_OPEN_PREFIXES) accumulator.open.add(reserved);
  return freeze(accumulator);
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export type Verdict = "accepted" | "inert" | "undecidable";

function coveredBy(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => prefix === "" || path === prefix || path.startsWith(`${prefix}.`));
}

/**
 * One `valuesObject` path against one chart schema.
 *
 * ORDER IS THE SEMANTICS, and it is not arbitrary:
 *
 *   1. OPEN first, and this order was MEASURED rather than assumed. bjw-s
 *      common both ranges `.Values.service` (so every key under it reaches the
 *      chart) AND does `get .Values.service (include ...)` with a computed
 *      member. Ranking dynamic above open marked headscale's entire `service`
 *      and `ingress` trees undecidable — a chart that demonstrably consumes
 *      every key under a node leaves nothing undecidable about INERTNESS there.
 *      Wholesale consumption is a decided answer; a computed subscript is not.
 *   2. LITERAL exact.
 *   3. LITERAL ANCESTOR: the chart reads `clientApi.advertisedHost`, the
 *      manifest sets `clientApi` — a manifest may declare a parent map whose
 *      children the chart names. Without this, every map-valued key in the tree
 *      is a false positive.
 *   4. DYNAMIC last — nothing above decided, and a computed reach means the
 *      chart CAN read a key that appears nowhere in its text. UNDECIDABLE, and
 *      undecidable counts toward the exit code exactly like INERT.
 *
 * Anything else is INERT: the chart names no path at or under it, no node
 * containing it is consumed wholesale, and nothing reaches it dynamically.
 */
export function classifyPath(path: string, schema: ChartSchema): Verdict {
  if (coveredBy(path, schema.open)) return "accepted";
  if (schema.literal.includes(path)) return "accepted";
  // ANCESTRY over BOTH sets. `open` counts here because an open prefix is a
  // path the chart has — and because `freeze` prunes literals below one, so the
  // open entry may be the only surviving evidence that the ancestor is real.
  //
  // MEASURED 2026-08-22, and the measurement is stated because it is awkward:
  // across all 54 Applications and 736 declared key paths, these two branches
  // fire ZERO times (295 accepted by an open prefix, 430 by an exact literal,
  // 11 inert). Every path-producing rule above adds each ANCESTOR of a
  // reference, so an ancestor is normally an exact literal already.
  //
  // They are kept anyway, and not because "it might help one day". A branch
  // that never fires is usually dead weight, but this one is a FALSE-POSITIVE
  // guard, and a false positive is the failure that gets the whole guard turned
  // off — the asymmetry is real. It is also one extraction change away from
  // being reachable: a `values.schema.json`-only path, or any future rule that
  // records a leaf without its ancestors, lands here immediately. What it is
  // NOT allowed to be is untested, so it is pinned directly in
  // `inert-valuesobject-keys.test.ts` §"the literal-ancestor rule"; without
  // that test the mutation harness reported it SURVIVING, which is how a branch
  // this quiet would have rotted unnoticed.
  const prefix = `${path}.`;
  if (schema.literal.some((literal) => literal.startsWith(prefix))) return "accepted";
  if (schema.open.some((open) => open.startsWith(prefix))) return "accepted";
  if (coveredBy(path, schema.dynamic)) return "undecidable";
  return "inert";
}

export interface PathVerdict {
  readonly path: string;
  readonly verdict: Verdict;
  /** Every leaf the manifest actually declares beneath this path — what the finding costs. */
  readonly leaves: readonly string[];
}

/** Every leaf path beneath a node, or the node itself when it is a scalar. */
export function leafPaths(value: unknown, prefix: string): string[] {
  if (!isRecord(value) || Object.keys(value).length === 0) return [prefix];
  const out: string[] = [];
  for (const [key, child] of Object.entries(value)) out.push(...leafPaths(child, joinPath(prefix, key)));
  return out;
}

/**
 * The SHALLOWEST non-accepted paths of a `valuesObject`, never the deepest.
 *
 * hindsight's defect is one mistake — `postgresql.primary` — and reporting it
 * as four (`...primary.persistence`, `...storageClass`, `...size`, and the
 * parents) would bury the one fact under its own consequences. So the walk
 * descends only through ACCEPTED nodes and stops at the first node that is not,
 * carrying the leaves beneath it so the report still says what was lost.
 */
export function walkValuesObject(values: unknown, schema: ChartSchema, prefix = ""): readonly PathVerdict[] {
  if (!isRecord(values)) return [];
  const out: PathVerdict[] = [];
  for (const [key, child] of Object.entries(values)) {
    const path = joinPath(prefix, key);
    const verdict = classifyPath(path, schema);
    if (verdict === "accepted") {
      out.push(...walkValuesObject(child, schema, path));
      continue;
    }
    out.push({ path, verdict, leaves: leafPaths(child, path) });
  }
  return [...out].sort((a, b) => stringCompare(a.path, b.path));
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

export type FindingKind = "inert-key" | "undecidable-key" | "chart-unavailable";

export interface InertFinding {
  readonly kind: FindingKind;
  /** Stable identity: `<appId> <keyPath>`. Never a line number. */
  readonly key: string;
  readonly appId: string;
  /** The `valuesObject` path, or `""` for a whole-app finding. */
  readonly path: string;
  readonly problem: string;
}

/**
 * One Application's `valuesObject` against one chart schema.
 *
 * A chart that could not be fetched produces exactly ONE finding for the whole
 * app rather than none: an app whose schema is unknown has been CHECKED FOR
 * NOTHING, and the difference between that and a pass is the entire point of
 * this module. `oz` before its repair is the worked case — it was pinned to
 * ziti-controller 1.4.5, a version no registry has ever served, so its
 * `adminSecret:` was undetectable AND its pin was broken, and a guard that
 * reported neither would have been green on an app that could not sync.
 *
 * AN EMPTY `valuesObject` IS NOT A FINDING, EVEN WITH NO CHART — and this is
 * the single biggest false-positive source measured on this tree. Twelve of the
 * 54 Applications are `git-path` sources that sync raw manifests: no chart, no
 * Chart.yaml, and no `helm.valuesObject` at all. Reporting "the chart could not
 * be resolved" for an Application that declares NOTHING is the guard inventing
 * work — there are zero keys, so zero of them can govern nothing, and the
 * question this module asks does not arise.
 *
 * It is not an escape hatch, and the asymmetry is what keeps it honest: the
 * exemption is bought by DELETING the claims, which is a repair and not a
 * suppression. A NON-EMPTY `valuesObject` against an unresolvable chart stays a
 * finding — that is exactly `oz` before its repair, and it is the case that
 * must never go quiet.
 */
export function findingsForApplication(
  appId: string,
  valuesObject: unknown,
  schema: ChartSchema | ChartUnavailable,
  chart: string,
  targetRevision: string,
): readonly InertFinding[] {
  if (!isRecord(valuesObject) || Object.keys(valuesObject).length === 0) return [];
  if ("ok" in schema) {
    return [
      {
        kind: "chart-unavailable",
        key: `${appId} <chart>`,
        appId,
        path: "",
        problem:
          `the pinned chart ${chart}@${targetRevision} could not be resolved [${schema.reason}], so NO key of this ` +
          `Application's valuesObject was checked against any schema — not verified, not refuted, and counted as ` +
          `neither: ${schema.detail}`,
      },
    ];
  }
  const out: InertFinding[] = [];
  for (const verdict of walkValuesObject(valuesObject, schema)) {
    if (verdict.verdict === "inert") {
      out.push({
        kind: "inert-key",
        key: `${appId} ${verdict.path}`,
        appId,
        path: verdict.path,
        problem:
          `\`${verdict.path}\` is not a key ${chart}@${targetRevision} has: the chart's own values, its subcharts' ` +
          `values, and every \`.Values\` reference in its templates name no path at or under it, and no node ` +
          `containing it is consumed wholesale. Helm discards it silently, so ` +
          `${verdict.leaves.length === 1 ? "the value declared here governs" : `all ${String(verdict.leaves.length)} values declared here govern`} ` +
          `NOTHING: ${verdict.leaves.join(", ")}`,
      });
      continue;
    }
    out.push({
      kind: "undecidable-key",
      key: `${appId} ${verdict.path}`,
      appId,
      path: verdict.path,
      problem:
        `\`${verdict.path}\` cannot be decided against ${chart}@${targetRevision}: the chart reaches \`.Values\` at ` +
        `or above this path by a COMPUTED subscript, so a key absent from its text may still be read. UNDECIDABLE ` +
        `is reported rather than passed — a key nobody could check must not read as one that checked out ` +
        `(declares: ${verdict.leaves.join(", ")})`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Baseline — the ratchet
// ---------------------------------------------------------------------------

/**
 * One acknowledged finding.
 *
 * `observed` pins the finding's TEXT, so an entry stops covering it the moment
 * what it excused changes shape. `liftsWhen` is required, and the trap it is
 * written against is specific and was found in this tree on 2026-08-22: a
 * `LIFTS WHEN` STRICTER THAN THE GATE IT NAMES keeps a deferral alive after its
 * defect is gone. "lifts when every chart in the tree renders offline" does not
 * lift when THIS app's key is fixed, so the entry outlives its own subject and
 * the ratchet stops ratcheting. Each condition here names the change that would
 * actually clear THIS entry, and nothing larger.
 */
export interface BaselineEntry {
  readonly key: string;
  readonly reason: string;
  readonly liftsWhen: string;
  readonly observed: string;
}

export interface Baseline {
  readonly findings: readonly BaselineEntry[];
}

export function loadBaseline(path = DEFAULT_BASELINE_PATH, repoRoot = REPO_ROOT): Baseline {
  const text = readIfPresent(resolve(repoRoot, path));
  if (text === null) return { findings: [] };
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const raw = parsed["findings"];
  if (!Array.isArray(raw)) return { findings: [] };
  const findings = raw.map((entry, index) => {
    const record = entry as Record<string, unknown>;
    for (const required of ["key", "reason", "liftsWhen", "observed"]) {
      const value = record[required];
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(
          `${path}: findings[${String(index)}] has no "${required}" — an acknowledgement without one is an ` +
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
  return { findings };
}

export interface Adjudicated {
  readonly refused: readonly InertFinding[];
  readonly acknowledged: readonly InertFinding[];
  readonly staleBaselineKeys: readonly string[];
}

/** Split findings against the baseline, and refuse a STALE entry in its own right. */
export function adjudicate(findings: readonly InertFinding[], baseline: Baseline): Adjudicated {
  const byKey = new Map(baseline.findings.map((entry) => [entry.key, entry]));
  const used = new Set<string>();
  const refused: InertFinding[] = [];
  const acknowledged: InertFinding[] = [];
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
  return {
    refused,
    acknowledged,
    staleBaselineKeys: baseline.findings
      .filter((entry) => !used.has(entry.key))
      .map((entry) => entry.key)
      .sort((a, b) => stringCompare(a, b)),
  };
}

// ---------------------------------------------------------------------------
// The measured schema snapshot — so the gate runs OFFLINE
// ---------------------------------------------------------------------------

/**
 * The literal path set, as a TREE rather than a list of dotted strings.
 *
 * Two reasons, and the second is the load-bearing one:
 *
 *   SIZE. The paths share prefixes by nature — `gitlab` alone contributes 7978
 *   of them across 30 subcharts — and a flat list repeats every prefix once per
 *   descendant. Flat and pretty-printed the snapshot was 2.0 MB; as a tree it
 *   is a third of that, with no information removed.
 *
 *   DIFF SHAPE. A chart that gains one key changes ONE line of a tree and one
 *   line of a sorted flat list — but a chart that gains an intermediate node
 *   moves every descendant in a flat list and nothing in a tree. The artifact
 *   has to stay readable in a `git` diff to be worth checking in at all
 *   (`no-binary-in-proof-lineage`), and the tree is the shape the data is.
 */
export type PathTree = { [segment: string]: PathTree };

export function pathsToTree(paths: readonly string[]): PathTree {
  const root: PathTree = {};
  for (const path of paths) {
    let node = root;
    for (const segment of path.split(".")) {
      node[segment] = node[segment] ?? {};
      node = node[segment];
    }
  }
  return root;
}

export function treeToPaths(tree: PathTree, prefix = ""): string[] {
  const out: string[] = [];
  for (const [segment, child] of Object.entries(tree)) {
    const path = joinPath(prefix, segment);
    out.push(path);
    out.push(...treeToPaths(child, path));
  }
  return out;
}

/** A chart's schema as stored: literal paths as a tree, the rest as sorted lists. */
export interface StoredChartSchema {
  readonly literal: PathTree;
  readonly open: readonly string[];
  readonly dynamic: readonly string[];
  readonly charts: readonly string[];
}

export function storeSchema(schema: ChartSchema): StoredChartSchema {
  return { literal: pathsToTree(schema.literal), open: schema.open, dynamic: schema.dynamic, charts: schema.charts };
}

export function loadStoredSchema(stored: StoredChartSchema): ChartSchema {
  return {
    literal: treeToPaths(stored.literal).sort((a, b) => stringCompare(a, b)),
    open: stored.open,
    dynamic: stored.dynamic,
    charts: stored.charts,
  };
}

/**
 * `<repoURL>|<chart>|<targetRevision>` — the identity a SCHEMA belongs to.
 *
 * Keyed by the chart rather than by the app because a schema is a fact about
 * the chart, and this tree pins the same chart from two trees: `gitlab` and
 * `infra/gitlab` are one 8000-path schema stored once instead of twice. It is
 * DV2.0 on the snapshot itself — the chart schema is the hub (changes only when
 * a pin moves), the per-app row is the link.
 */
export function chartKey(repoURL: string, chart: string, targetRevision: string): string {
  return `${repoURL}|${chart}|${targetRevision}`;
}

export interface SchemaSnapshotEntry {
  readonly appId: string;
  readonly chart: string;
  readonly targetRevision: string;
  readonly repoURL: string;
  /** Key into `charts`. Present when the chart resolved; mutually exclusive with `unavailable`. */
  readonly chartKey?: string | undefined;
  readonly unavailable?: { readonly reason: string; readonly detail: string } | undefined;
}

export interface SchemaSnapshot {
  readonly measuredOn: string;
  readonly appsDiscovered: number;
  readonly charts: Readonly<Record<string, StoredChartSchema>>;
  readonly entries: readonly SchemaSnapshotEntry[];
}

/** The schema an entry names, or `null` when the entry records an unavailable chart. */
export function schemaOfEntry(snapshot: SchemaSnapshot, entry: SchemaSnapshotEntry): ChartSchema | ChartUnavailable {
  if (entry.unavailable !== undefined) return { ok: false, ...entry.unavailable };
  const stored = entry.chartKey === undefined ? undefined : snapshot.charts[entry.chartKey];
  if (stored === undefined) {
    // A row pointing at a schema the snapshot does not carry is a BROKEN
    // snapshot, and it is reported as an unavailable chart rather than skipped:
    // the app was not checked, and "not checked" never reads as "passed".
    return {
      ok: false,
      reason: "schema-missing-from-snapshot",
      detail: `${entry.appId} names chart schema "${entry.chartKey ?? "<none>"}", which the snapshot does not contain`,
    };
  }
  return loadStoredSchema(stored);
}

export function loadSchemaSnapshot(path = DEFAULT_SCHEMA_SNAPSHOT_PATH, repoRoot = REPO_ROOT): SchemaSnapshot | null {
  const text = readIfPresent(resolve(repoRoot, path));
  if (text === null) return null;
  return JSON.parse(text) as SchemaSnapshot;
}

/**
 * Write the snapshot, then hand it to Prettier.
 *
 * `JSON.stringify(x, null, 2)` and Prettier disagree on exactly one thing —
 * Prettier collapses a short array onto one line — so a snapshot written the
 * plain way is checked in in a form the repo's own formatting gate rejects.
 * That trap costs the NEXT person a red CI run for a re-measurement that was
 * entirely correct, which is how a re-measurement stops being routine.
 *
 * Prettier failing is a WARNING, not a throw: this is the developer-side path
 * (`--write-snapshot`), never the gate, and refusing to write a correct
 * measurement because a formatter is absent would be the tail wagging the dog.
 * But it is not silent either — the exact command to run is printed, because a
 * skipped format step that says nothing is how the trap comes back.
 */
export function writeSchemaSnapshot(
  snapshot: SchemaSnapshot,
  path = DEFAULT_SCHEMA_SNAPSHOT_PATH,
  repoRoot = REPO_ROOT,
): void {
  const abs = resolve(repoRoot, path);
  writeFileSync(abs, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  const formatted = spawnSync("bunx", ["prettier", "--write", path], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120_000,
  });
  if (formatted.status !== 0) {
    process.stderr.write(
      `WARNING: wrote ${path} but could not format it (${formatted.stderr?.trim().split("\n")[0] ?? "prettier unavailable"}).\n` +
        `         Run \`bunx prettier --write ${path}\` before committing, or the formatting gate will refuse it.\n`,
    );
  }
}

/** Derive every Application's chart schema live. Needs `helm` and the network. */
export function measureSchemaSnapshot(options: FetchOptions & { repoRoot?: string | undefined } = {}): SchemaSnapshot {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const sources = discoverApplications(repoRoot);
  const entries: SchemaSnapshotEntry[] = [];
  const charts: Record<string, StoredChartSchema> = {};
  for (const source of sources) {
    const key = chartKey(source.repoURL, source.chart, source.targetRevision);
    const row = {
      appId: source.appId,
      chart: source.chart,
      targetRevision: source.targetRevision,
      repoURL: source.repoURL,
    };
    if (charts[key] !== undefined) {
      entries.push({ ...row, chartKey: key });
      continue;
    }
    const schema = chartSchemaFor(source, { ...options, repoRoot });
    if ("ok" in schema) {
      entries.push({ ...row, unavailable: { reason: schema.reason, detail: schema.detail } });
      continue;
    }
    charts[key] = storeSchema(schema);
    entries.push({ ...row, chartKey: key });
  }
  return {
    measuredOn: new Date().toISOString().slice(0, 10),
    appsDiscovered: sources.length,
    charts: Object.fromEntries(Object.entries(charts).sort((a, b) => stringCompare(a[0], b[0]))),
    entries: [...entries].sort((a, b) => stringCompare(a.appId, b.appId) || stringCompare(a.chart, b.chart)),
  };
}

/**
 * Live re-derivation vs the checked-in snapshot.
 *
 * COVERAGE IS CHECKED, NOT JUST CONTENT. An Application added to the tree whose
 * chart the snapshot never measured is invisible to a row-by-row comparison —
 * the rows all agree and the snapshot no longer covers the tree. That is the
 * `snapshot-coverage-stale` failure by name: a check that did not run wearing
 * the face of one that passed. `rendered-storage-claims.ts` grew this the hard
 * way on 2026-08-22 when `spire-crds` landed; it is here from the start.
 */
export function schemaSnapshotDrift(live: SchemaSnapshot, snapshot: SchemaSnapshot): readonly string[] {
  const drift: string[] = [];
  const identity = (entry: SchemaSnapshotEntry): string => `${entry.appId} ${entry.chart}@${entry.targetRevision}`;
  const liveByKey = new Map(live.entries.map((entry) => [identity(entry), entry]));
  const snapByKey = new Map(snapshot.entries.map((entry) => [identity(entry), entry]));
  for (const [id, entry] of liveByKey) {
    const was = snapByKey.get(id);
    if (was === undefined) {
      drift.push(`NEW pin not in the snapshot: ${id}`);
      continue;
    }
    if ((was.unavailable === undefined) !== (entry.unavailable === undefined)) {
      drift.push(
        `AVAILABILITY changed for ${id}: snapshot ${was.unavailable === undefined ? "resolved" : was.unavailable.reason} -> ` +
          `live ${entry.unavailable === undefined ? "resolved" : entry.unavailable.reason}`,
      );
      continue;
    }
    const wasSchema = schemaOfEntry(snapshot, was);
    const liveSchema = schemaOfEntry(live, entry);
    if ("ok" in wasSchema || "ok" in liveSchema) continue;
    const shape = (schema: ChartSchema): string => JSON.stringify([schema.literal, schema.open, schema.dynamic]);
    if (shape(wasSchema) !== shape(liveSchema)) {
      drift.push(`SCHEMA changed for ${id} — the chart at this pin no longer accepts the same keys`);
    }
  }
  for (const id of snapByKey.keys())
    if (!liveByKey.has(id)) drift.push(`GONE from the tree but still in the snapshot: ${id}`);
  if (live.appsDiscovered !== snapshot.appsDiscovered) {
    drift.push(
      `COVERAGE: the snapshot measured ${String(snapshot.appsDiscovered)} Applications, the tree now has ` +
        `${String(live.appsDiscovered)} — rows can agree while the snapshot no longer covers the tree`,
    );
  }
  return [...drift].sort((a, b) => stringCompare(a, b));
}

// ---------------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------------

export interface AuditResult {
  readonly appsDiscovered: number;
  readonly appsChecked: number;
  readonly refused: readonly InertFinding[];
  readonly acknowledged: readonly InertFinding[];
  readonly staleBaselineKeys: readonly string[];
  /** Apps present in the tree that the snapshot does not cover — never a pass. */
  readonly uncovered: readonly string[];
}

function auditFrom(
  sources: readonly ApplicationSource[],
  schemaOf: (source: ApplicationSource) => ChartSchema | ChartUnavailable | null,
  baseline: Baseline,
): AuditResult {
  const findings: InertFinding[] = [];
  const uncovered: string[] = [];
  let checked = 0;
  for (const source of sources) {
    const schema = schemaOf(source);
    if (schema === null) {
      // NOT a skip. A source the snapshot never measured is an app whose keys
      // nobody compared, and it is reported with the same weight as an inert
      // key: `uncovered` feeds the exit code.
      uncovered.push(`${source.appId} (${source.chart}@${source.targetRevision})`);
      continue;
    }
    checked += 1;
    findings.push(
      ...findingsForApplication(source.appId, source.valuesObject, schema, source.chart, source.targetRevision),
    );
  }
  const sorted = [...findings].sort((a, b) => stringCompare(a.key, b.key));
  const adjudicated = adjudicate(sorted, baseline);
  return {
    appsDiscovered: sources.length,
    appsChecked: checked,
    refused: adjudicated.refused,
    acknowledged: adjudicated.acknowledged,
    staleBaselineKeys: adjudicated.staleBaselineKeys,
    uncovered: [...uncovered].sort((a, b) => stringCompare(a, b)),
  };
}

/** The audit against the checked-in schema snapshot. Offline, deterministic, no helm. */
export function auditAgainstSnapshot(
  snapshot: SchemaSnapshot,
  options: { repoRoot?: string | undefined; baselinePath?: string | undefined } = {},
): AuditResult {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const byKey = new Map(
    snapshot.entries.map((entry) => [`${entry.appId} ${entry.chart}@${entry.targetRevision}`, entry] as const),
  );
  return auditFrom(
    discoverApplications(repoRoot),
    (source) => {
      const entry = byKey.get(`${source.appId} ${source.chart}@${source.targetRevision}`);
      if (entry === undefined) return null;
      return schemaOfEntry(snapshot, entry);
    },
    loadBaseline(options.baselinePath, repoRoot),
  );
}

/** The audit against live charts. Needs `helm` and the network. */
export function auditLive(options: FetchOptions & { baselinePath?: string | undefined } = {}): AuditResult {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  return auditFrom(
    discoverApplications(repoRoot),
    (source) => chartSchemaFor(source, { ...options, repoRoot }),
    loadBaseline(options.baselinePath, repoRoot),
  );
}

/**
 * The exit code, and all four inputs are load-bearing.
 *
 * `uncovered` and `staleBaselineKeys` are in here for the same reason the
 * findings are: an app nobody compared and an acknowledgement that excuses
 * nothing are both claims about the tree that stopped being true, and a gate
 * that stayed green on either would be the vacuity class with an exit status.
 */
export function auditExitCode(result: AuditResult): number {
  return result.refused.length > 0 || result.staleBaselineKeys.length > 0 || result.uncovered.length > 0 ? 1 : 0;
}

export function formatReport(result: AuditResult): string {
  const lines: string[] = [];
  lines.push(
    `applications: ${String(result.appsDiscovered)} discovered, ${String(result.appsChecked)} checked against a ` +
      `chart schema, ${String(result.uncovered.length)} NOT COVERED by the snapshot`,
  );
  if (result.uncovered.length > 0) {
    lines.push("");
    lines.push("NOT COVERED — checked NOTHING here, which is not the same as passing:");
    for (const app of result.uncovered) lines.push(`  ${app}`);
    lines.push("  (re-measure with --write-snapshot)");
  }
  if (result.refused.length > 0) {
    lines.push("");
    lines.push(`REFUSED (${String(result.refused.length)}):`);
    for (const finding of result.refused) {
      lines.push(`  [${finding.kind}] ${finding.key}`);
      lines.push(`      ${finding.problem}`);
    }
  }
  if (result.acknowledged.length > 0) {
    lines.push("");
    lines.push(
      `acknowledged (${String(result.acknowledged.length)}) — STILL TRUE. An acknowledgement buys a non-red gate, ` +
        `never a working key; every one of these still governs nothing.`,
    );
    for (const finding of result.acknowledged) lines.push(`  [${finding.kind}] ${finding.key}`);
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
        ? "OK — every valuesObject key exists in the schema of the chart its Application is pinned to."
        : `OK — no UNACKNOWLEDGED findings. The ${String(result.acknowledged.length)} above are still inert; see ` +
          `inert-valuesobject-keys.baseline.json for why each is open and what lifts it.`
      : "FAILED",
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** `--flag value` from argv, or `undefined`. */
export function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

const USAGE =
  "usage: bun src/Core.TypeScript/cluster/inert-valuesobject-keys.ts [--offline] [--json] [--baseline <path>]\n" +
  "       ... --write-snapshot   derive every pinned chart's schema live and check it in\n" +
  "       ... --check-snapshot   re-derive live and refuse any drift from the checked-in schema\n" +
  "  Refuses any valuesObject key that the pinned chart has no schema for, any key it cannot\n" +
  "  decide, and any Application the snapshot does not cover.";

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }
  const json = argv.includes("--json");
  if (argv.includes("--write-snapshot")) {
    writeSchemaSnapshot(measureSchemaSnapshot());
    process.stdout.write("schema snapshot written\n");
    process.exit(0);
  }
  if (argv.includes("--check-snapshot")) {
    const snapshot = loadSchemaSnapshot();
    if (snapshot === null) {
      process.stderr.write("no schema snapshot checked in — run --write-snapshot\n");
      process.exit(1);
    }
    const drift = schemaSnapshotDrift(measureSchemaSnapshot(), snapshot);
    if (drift.length === 0) {
      process.stdout.write("schema snapshot matches the live charts\n");
      process.exit(0);
    }
    process.stdout.write(
      `schema snapshot DRIFT (${String(drift.length)}):\n${drift.map((line) => `  ${line}`).join("\n")}\n`,
    );
    process.exit(1);
  }
  const snapshot = loadSchemaSnapshot();
  if (snapshot === null && argv.includes("--offline")) {
    process.stderr.write("--offline needs a checked-in schema snapshot, and there is none\n");
    process.exit(1);
  }
  const baselinePath = flagValue(argv, "--baseline");
  const result = snapshot === null ? auditLive({ baselinePath }) : auditAgainstSnapshot(snapshot, { baselinePath });
  process.stdout.write(json ? `${JSON.stringify(result, null, 2)}\n` : `${formatReport(result)}\n`);
  process.exit(auditExitCode(result));
}
