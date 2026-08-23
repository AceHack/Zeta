// Validation for the Helm charts this repository OWNS (a Chart.yaml in-tree).
//
// WHY THIS EXISTS (Dejan, 2026-08-23). Aaron: "we want our k8s helm charts all
// tested." Measured before writing a line of it, at 3a0510ddcd:
//
//   - in-repo charts (directories containing a Chart.yaml) ............ 2
//   - of those, covered by ANY CI check ............................... 0
//   - occurrences of `helm lint` anywhere in the repository ........... 0
//   - workflows whose `paths:` filter matches examples/ ............... 0
//
// HOME. This deliberately does NOT live in infra/k8s/tests/ alongside the
// Application validators, even though that is the k8s test directory. That tree
// is scheduled for deletion and its own roster entry in
// hygiene/cluster-tree-consumers.json already carries the instruction "move the
// validator out of infra/k8s/tests/". Landing new code there would have created
// fresh coupling to a doomed tree -- which `audit-cluster-tree-consumers.ts`
// caught on the first CI run of this change, correctly. These charts live under
// examples/ and have nothing to do with infra/k8s anyway.
//
// The existing helm-validate.yml lane is real and does render charts, but it
// validates ArgoCD *Application* manifests that pin THIRD-PARTY charts. It
// filters on infra/k8s/**, full-ai-cluster/** and infra/nixos/**, so the two
// charts we actually author -- examples/helm-dependency-graph/charts/{my-app,
// postgres} -- were never linted, never rendered, never parsed by anything.
// `Chart.yaml` is not read by a single line of code in the tree: ace/deps.ts
// takes a --charts-dir but opens only `zeta-chart-outputs.yaml` under it.
//
// WHAT THIS DELIBERATELY DOES NOT CLAIM. Both charts are metadata-only: no
// templates/ directory and no values.yaml. `helm template` on them renders ZERO
// documents and exits 0. So piping that render into kubeconform would
// schema-check nothing while printing a green tick -- the vacuous-check defect
// class this repo is built to refuse. This validator therefore COUNTS rendered
// documents, prints the count per chart, and reports charts that rendered
// nothing as an explicit SKIP line naming the reason. A chart that renders zero
// manifests is never reported as schema-validated.
//
// MEASURED COST (local, warm, 2026-08-23): offline pass over 2 charts 0.05 s;
// with --helm (lint + template + kubeconform) 0.6 s. Both are noise against the
// toolchain install the job already pays for, which is why this is added to two
// existing jobs rather than given a workflow of its own.
//
// EXIT CODES: 0 all checks passed. 1 at least one check failed, or discovery
// found no charts at all (an empty run is not zero failures).

import { readdirSync, readFileSync, existsSync, type Dirent } from "node:fs";
import { join, resolve, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { parse as parseYaml } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, "../../..");

/** Directories never worth walking when hunting for a Chart.yaml. */
const PRUNE = new Set([
  ".git",
  "node_modules",
  "bin",
  "obj",
  "references",
  "dist",
  ".mise",
  "target",
]);

export interface Finding {
  readonly chart: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** Recursively locate every directory holding a Chart.yaml. */
export function discoverCharts(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    // `withFileTypes` so the entry KIND arrives with the listing. Reading the
    // names and then statSync-ing each one asks the filesystem a question it
    // already answered, and an entry can vanish or change kind in between --
    // flagged as [readdir-then-stat] by lint-check-then-use-file-races.ts.
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.name === "Chart.yaml" && e.isFile())) found.push(dir);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (PRUNE.has(entry.name) || entry.name.startsWith(".")) continue;
      walk(join(dir, entry.name));
    }
  };
  walk(root);
  return found.sort();
}

// Helm accepts only these two. Anything else fails `helm lint`, but we check it
// offline too so the base-tier job (which has no helm) still catches it.
const VALID_API_VERSIONS = new Set(["v1", "v2"]);

// Helm requires a strict SemVer 2 version. Deliberately not a loose regex: a
// version helm rejects must be rejected here, or the offline job disagrees with
// the full-tier job and one of them is lying.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Offline structural checks on one chart directory.
 *
 * The name-equals-directory check is here because `helm lint` does NOT catch it
 * -- verified 2026-08-23: a chart in dir `c` whose Chart.yaml says
 * `name: WRONGNAME` lints clean, rc=0. It matters in this tree specifically
 * because zeta-deps.yaml addresses charts BY NAME, so a mismatch silently
 * detaches the dependency graph from the chart it believes it is wiring.
 */
export function checkChartStructure(chartDir: string, root: string): Finding[] {
  const rel = relative(root, chartDir) || ".";
  const out: Finding[] = [];
  const add = (ok: boolean, detail: string): void => {
    out.push({ chart: rel, ok, detail });
  };

  const chartYamlPath = join(chartDir, "Chart.yaml");
  let doc: Record<string, unknown>;
  try {
    doc = parseYaml(readFileSync(chartYamlPath, "utf8")) as Record<string, unknown>;
  } catch (err) {
    add(false, `Chart.yaml does not parse as YAML: ${(err as Error).message}`);
    return out;
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    add(false, "Chart.yaml is not a YAML mapping");
    return out;
  }

  const apiVersion = doc["apiVersion"];
  if (typeof apiVersion !== "string" || !VALID_API_VERSIONS.has(apiVersion)) {
    add(false, `apiVersion must be "v1" or "v2", got ${JSON.stringify(apiVersion)}`);
  } else {
    add(true, `apiVersion ${apiVersion}`);
  }

  const name = doc["name"];
  if (name === undefined || name === null) {
    add(false, "name is required");
  } else if (typeof name !== "string") {
    // Match helm's own wording: it reports the TYPE, because an unquoted value
    // is the usual cause and "required" would send the reader hunting for a
    // missing line that is right there.
    add(false, `name should be of type string but it is ${typeof name} (quote it?)`);
  } else if (name.length === 0) {
    add(false, "name is required and must be non-empty");
  } else if (name !== basename(chartDir)) {
    add(false, `name "${name}" does not match its directory "${basename(chartDir)}"`);
  } else {
    add(true, `name ${name} matches directory`);
  }

  const version = doc["version"];
  if (version === undefined || version === null) {
    add(false, "version is required");
  } else if (typeof version !== "string") {
    // `version: 1.0` is YAML float 1.0, which helm rejects with
    // "version should be of type string but it's of type float64". Saying the
    // same thing here keeps the offline job and the helm job in agreement --
    // two checks that disagree about the same file mean one of them is lying.
    add(false, `version should be of type string but it is ${typeof version} (quote it?)`);
  } else if (version.length === 0) {
    add(false, "version is required and must be non-empty");
  } else if (!SEMVER.test(version)) {
    add(false, `version "${version}" is not valid SemVer 2`);
  } else {
    add(true, `version ${version} is valid SemVer`);
  }

  return out;
}

interface DepEdge {
  readonly file: string;
  readonly chart: string;
  readonly version: string | undefined;
}

/** Collect every `dependsOn` edge declared by an AppDependencyGraph in the tree. */
export function collectDependencyEdges(root: string): DepEdge[] {
  const edges: DepEdge[] = [];
  const walk = (dir: string): void => {
    // Same withFileTypes discipline as discoverCharts above.
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (PRUNE.has(name) || name.startsWith(".")) continue;
      const full = join(dir, name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile() || name !== "zeta-deps.yaml") continue;
      let doc: any;
      try {
        doc = parseYaml(readFileSync(full, "utf8"));
      } catch {
        continue;
      }
      if (doc?.kind !== "AppDependencyGraph") continue;
      for (const dep of doc?.spec?.dependsOn ?? []) {
        if (typeof dep?.chart !== "string") continue;
        edges.push({
          file: relative(root, full),
          chart: dep.chart,
          version: typeof dep.version === "string" ? dep.version : undefined,
        });
      }
    }
  };
  walk(root);
  return edges;
}

/**
 * Every dependsOn edge naming a chart we own must agree with that chart's
 * Chart.yaml on the version. Unchecked before today: zeta-deps.yaml pins
 * postgres "15.2.0" and postgres/Chart.yaml says 15.2.0, two independent
 * literals with nothing binding them. Bump one and the example silently lies.
 *
 * An edge naming a chart we do NOT own is out of scope here (that is the
 * upstream-pin job's territory) and is reported as informational, not failed.
 */
export function checkDependencyCoupling(root: string, chartDirs: string[]): Finding[] {
  const owned = new Map<string, { dir: string; version: string | undefined; readable: boolean }>();
  for (const dir of chartDirs) {
    // Register under the DIRECTORY name unconditionally, then refine with the
    // declared name. Registering only on a successful parse was a vacuity found
    // by breaking postgres/Chart.yaml on 2026-08-23: the chart vanished from
    // `owned`, so the edge pointing at it reported "not a chart we own" as a
    // PASS. An unparseable chart must not launder a dependency edge into
    // somebody else's problem.
    owned.set(basename(dir), { dir: relative(root, dir), version: undefined, readable: false });
    try {
      const doc = parseYaml(readFileSync(join(dir, "Chart.yaml"), "utf8")) as Record<string, unknown>;
      const name = typeof doc?.["name"] === "string" ? (doc["name"] as string) : basename(dir);
      const version = typeof doc?.["version"] === "string" ? (doc["version"] as string) : undefined;
      const entry = { dir: relative(root, dir), version, readable: true };
      // Register under BOTH the declared name and the directory name. If they
      // disagree, checkChartStructure already fails on the mismatch; this
      // check's job is the version pin, and it can still do that job honestly.
      // Registering only the declared name made an edge naming the DIRECTORY
      // report "could not be read", which was simply untrue.
      owned.set(name, entry);
      owned.set(basename(dir), entry);
    } catch {
      // Left registered as unreadable; reported below, not silently dropped.
    }
  }

  const out: Finding[] = [];
  for (const edge of collectDependencyEdges(root)) {
    const target = owned.get(edge.chart);
    if (!target) {
      out.push({
        chart: edge.file,
        ok: true,
        detail: `dependsOn "${edge.chart}" is not a chart we own (upstream pin; out of scope here)`,
      });
      continue;
    }
    if (!target.readable) {
      out.push({
        chart: edge.file,
        ok: false,
        detail:
          `dependsOn "${edge.chart}" names ${target.dir}, whose Chart.yaml could not be read; ` +
          "the version pin cannot be checked",
      });
      continue;
    }
    if (edge.version === undefined) {
      out.push({ chart: edge.file, ok: true, detail: `dependsOn "${edge.chart}" pins no version` });
      continue;
    }
    if (edge.version !== target.version) {
      out.push({
        chart: edge.file,
        ok: false,
        detail:
          `dependsOn "${edge.chart}" pins version "${edge.version}" but ` +
          `${target.dir}/Chart.yaml declares "${target.version}"`,
      });
    } else {
      out.push({
        chart: edge.file,
        ok: true,
        detail: `dependsOn "${edge.chart}" version ${edge.version} agrees with Chart.yaml`,
      });
    }
  }
  return out;
}

function run(cmd: string, args: string[]): { rc: number; out: string } {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.error) return { rc: 127, out: String(r.error.message) };
  return { rc: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/** Count YAML documents in a helm render, ignoring separators and comments. */
export function countRenderedDocs(rendered: string): number {
  let count = 0;
  for (const chunk of rendered.split(/^---\s*$/m)) {
    const meaningful = chunk
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    if (meaningful.length > 0) count += 1;
  }
  return count;
}

interface HelmResult {
  readonly findings: Finding[];
  /** Charts that rendered zero documents: reported loudly, never silently. */
  readonly emptyRenders: string[];
  readonly schemaChecked: number;
}

/**
 * helm lint + helm template + kubeconform over the render.
 *
 * A missing helm or kubeconform is a HARD FAILURE, not a skip. A check that
 * degrades to green when its tool is absent is a check that did not run wearing
 * the costume of one that passed.
 */
export function checkWithHelm(chartDirs: string[], root: string): HelmResult {
  const findings: Finding[] = [];
  const emptyRenders: string[] = [];
  let schemaChecked = 0;

  for (const bin of ["helm", "kubeconform"]) {
    const probe = run(bin, ["version"]);
    if (probe.rc === 127) {
      findings.push({ chart: "(toolchain)", ok: false, detail: `${bin} is not on PATH` });
      return { findings, emptyRenders, schemaChecked };
    }
  }

  for (const dir of chartDirs) {
    const rel = relative(root, dir) || ".";

    const lint = run("helm", ["lint", dir]);
    findings.push({
      chart: rel,
      ok: lint.rc === 0,
      detail: lint.rc === 0 ? "helm lint clean" : `helm lint exited ${lint.rc}: ${lint.out.trim()}`,
    });

    const tpl = run("helm", ["template", basename(dir), dir]);
    if (tpl.rc !== 0) {
      findings.push({ chart: rel, ok: false, detail: `helm template exited ${tpl.rc}: ${tpl.out.trim()}` });
      continue;
    }
    const docs = countRenderedDocs(tpl.out);
    findings.push({ chart: rel, ok: true, detail: `helm template rendered ${docs} document(s)` });

    if (docs === 0) {
      const hasTemplates = existsSync(join(dir, "templates"));
      emptyRenders.push(
        `${rel} -- rendered 0 manifests` +
          (hasTemplates
            ? " despite having a templates/ directory"
            : " (metadata-only chart: no templates/ directory)"),
      );
      continue;
    }

    // kubeconform reads the render on stdin.
    const kcr = spawnSync("kubeconform", ["-strict", "-summary", "-"], {
      encoding: "utf8",
      input: tpl.out,
    });
    const kcRc = kcr.status ?? 1;
    findings.push({
      chart: rel,
      ok: kcRc === 0,
      detail:
        kcRc === 0
          ? `kubeconform validated ${docs} manifest(s)`
          : `kubeconform exited ${kcRc}: ${`${kcr.stdout ?? ""}${kcr.stderr ?? ""}`.trim()}`,
    });
    if (kcRc === 0) schemaChecked += docs;
  }

  return { findings, emptyRenders, schemaChecked };
}

export function main(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      helm: { type: "boolean", default: false },
      root: { type: "string" },
    },
    allowPositionals: false,
  });

  const root = resolve(values.root ?? DEFAULT_ROOT);
  const chartDirs = discoverCharts(root);

  console.log(`Scanning ${root}`);
  console.log(`Discovered ${chartDirs.length} in-repo chart(s) (directories with a Chart.yaml)`);

  // An empty run is not zero failures. If discovery breaks -- a moved tree, a
  // bad --root -- this must go red rather than print a serene "0 failed".
  if (chartDirs.length === 0) {
    console.log("FAIL: no charts discovered; refusing to report success on an empty set");
    console.log("Results: 0 passed, 1 failed");
    return 1;
  }

  const findings: Finding[] = [];
  for (const dir of chartDirs) findings.push(...checkChartStructure(dir, root));
  findings.push(...checkDependencyCoupling(root, chartDirs));

  let emptyRenders: string[] = [];
  let schemaChecked = 0;
  if (values.helm) {
    const r = checkWithHelm(chartDirs, root);
    findings.push(...r.findings);
    emptyRenders = r.emptyRenders;
    schemaChecked = r.schemaChecked;
  }

  for (const f of findings) {
    console.log(`${f.ok ? "PASS" : "FAIL"}: ${f.chart}: ${f.detail}`);
  }

  // The honesty section. These lines exist so that "kubeconform passed" can
  // never be read as "the manifests were schema-checked" when there were no
  // manifests to check.
  if (!values.helm) {
    console.log(
      "SKIPPED (stated, not silent): helm lint, helm template and kubeconform " +
        "were not run -- pass --helm on a host with both tools installed.",
    );
  } else {
    console.log(`Schema-validated manifests: ${schemaChecked}`);
    if (emptyRenders.length > 0) {
      console.log(
        `NOT SCHEMA-VALIDATED (stated, not silent): ${emptyRenders.length} chart(s) rendered no manifests, ` +
          "so kubeconform checked nothing for them:",
      );
      for (const line of emptyRenders) console.log(`  - ${line}`);
    }
  }

  const failed = findings.filter((f) => !f.ok);
  console.log(`Results: ${findings.length - failed.length} passed, ${failed.length} failed`);
  return failed.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
