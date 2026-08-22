/**
 * inert-valuesobject-keys.test.ts — a `valuesObject` key the chart has no
 * schema for is a declaration that governs NOTHING, and reads exactly like one
 * that governs something.
 *
 * WHY THIS FILE EXISTS.
 *
 * This tree has now been bitten by the same defect four times, each found by a
 * different route and none of them by a check:
 *
 *   hindsight  `postgresql.primary.persistence.*` — the bitnami subchart layout,
 *              against a chart that ships its own StatefulSet reading
 *              `postgresql.persistence.*`. Declared 10Gi on longhorn; rendered
 *              8Gi with no storageClassName.
 *   nats       a TOP-LEVEL `cluster: {enabled, replicas: 3}`, against a chart
 *              that reads `config.cluster`. Rendered `replicas: 1` — a
 *              single-node JetStream wearing a three-node HA claim.
 *   oz         `adminSecret: {name, key}` — a key ziti-controller has never had
 *              in ANY published version; the real pair is
 *              `useCustomAdminSecret` + `customAdminSecretName`.
 *   headscale  an entire top-level `config:` block — `server_url`,
 *              `listen_addr`, `metrics_listen_addr`, `prefixes` — against a
 *              chart whose values.yaml has six top-level keys and no `config`.
 *              The pod ran with NO server_url from any source and was
 *              CrashLoopBackOff in the included-proof lane.
 *
 * THE FIRST THREE WERE CAUGHT BY A STORAGE CHECK, AND THAT IS THE POINT.
 * `rendered-storage-claims.ts` compares a declared PVC against a rendered one,
 * so it catches an inert key only when that key happens to govern storage.
 * headscale's did not: it governed whether the process could start. Nothing in
 * the repo asked whether a `valuesObject` key exists in the chart's schema at
 * all, which is why the same defect kept arriving wearing different clothes.
 *
 * WHAT THIS FILE IS. Two layers, and the second one arrived later.
 *
 * The narrow half — the `describe` blocks for headscale and oz below — pins the
 * SPECIFIC measured facts for the two manifests repaired on 2026-08-22, offline,
 * so a revert cannot be silent. It was written when the general guard did not
 * exist, on the principle that a narrow falsifier that runs beats a broad one
 * that does not, and it is kept: it states things the general guard cannot, such
 * as WHY `env.HEADSCALE_SERVER_URL` is load-bearing only while the Ingress is
 * off.
 *
 * The general half is `inert-valuesobject-keys.ts`, which this file's header
 * used to disclaim: *"the general guard compares every Application's
 * `valuesObject` key set against its pinned chart's `values.yaml`... That is
 * worth building and is not built here."* It is built now, and the tests below
 * §THE GENERAL GUARD hold it to the bar the sentence implies — it goes RED on
 * all four instances as they stood before their fixes, reconstructed from git
 * history rather than paraphrased. It also goes red on two MORE (hindsight's
 * `api.llm` and top-level `service`, found independently in PR #13524), which is
 * the closest thing available to evidence that the class is real rather than
 * fitted to four remembered cases.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const APPS = join(REPO_ROOT, "full-ai-cluster", "k8s", "applications");

function valuesObject(dir: string): Record<string, unknown> {
  const doc = parse(readFileSync(join(APPS, dir, "Application.yaml"), "utf8")) as {
    spec?: { source?: { helm?: { valuesObject?: Record<string, unknown> } } };
  };
  return doc.spec?.source?.helm?.valuesObject ?? {};
}

describe("headscale — the value the container needs reaches the chart", () => {
  // MEASURED 2026-08-22 by `helm template` of headscale 0.4.0 against this
  // Application's own valuesObject: the chart declares exactly `image`, `env`,
  // `service`, `ingress`, `persistence`, `postgresql`. A top-level `config:` is
  // read by nothing, and the render contained ZERO occurrences of `server_url`.
  test("no top-level `config:` — the chart has no such key, so it would be inert", () => {
    expect(Object.keys(valuesObject("headscale"))).not.toContain("config");
  });

  test("`env.HEADSCALE_SERVER_URL` is set — headscale has no default for it", () => {
    // The chart emits HEADSCALE_SERVER_URL itself ONLY under
    // `ingress.main.enabled` (templates/common.yaml). This Application does not
    // enable an Ingress, so if this key goes away the container is started with
    // no server_url from any source again.
    const env = valuesObject("headscale")["env"] as Record<string, unknown> | undefined;
    expect(env).toBeDefined();
    expect(typeof env?.["HEADSCALE_SERVER_URL"]).toBe("string");
    expect(String(env?.["HEADSCALE_SERVER_URL"])).toMatch(/^https?:\/\/\S+$/);
  });

  test("the ingress is still NOT enabled — which is what makes the key load-bearing", () => {
    // Guards the test above from passing for the wrong reason. If someone
    // enables the Ingress, the chart supplies SERVER_URL from the host and this
    // file's reasoning has to be re-derived rather than silently inherited.
    const ingress = valuesObject("headscale")["ingress"] as Record<string, { enabled?: unknown }> | undefined;
    expect(ingress?.["main"]?.enabled).not.toBe(true);
  });
});

describe("oz — the admin credential is declared on keys ziti-controller actually reads", () => {
  // `adminSecret:` was inert in every published ziti-controller version. The
  // chart reads `useCustomAdminSecret` + `customAdminSecretName`
  // (values.yaml:198,210) and the init container reads the fixed secret keys
  // `admin-user` / `admin-password`.
  test("no `adminSecret:` key — the chart has never had one", () => {
    expect(Object.keys(valuesObject("oz"))).not.toContain("adminSecret");
  });

  test("the pair the chart does read is set, and set together", () => {
    const values = valuesObject("oz");
    expect(values["useCustomAdminSecret"]).toBe(true);
    // `useCustomAdminSecret: true` with no name is worse than not setting it:
    // the chart then skips generating a Secret AND references an empty name.
    expect(typeof values["customAdminSecretName"]).toBe("string");
    expect(String(values["customAdminSecretName"]).length).toBeGreaterThan(0);
  });

  test("`clientApi.advertisedHost` is set — every published version refuses to template without it", () => {
    const clientApi = valuesObject("oz")["clientApi"] as Record<string, unknown> | undefined;
    expect(typeof clientApi?.["advertisedHost"]).toBe("string");
  });
});

// ===========================================================================
// THE GENERAL GUARD — inert-valuesobject-keys.ts
// ===========================================================================

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  chartKey,
  classifyPath,
  dependencyValueKeys,
  findingsForApplication,
  foldChart,
  leafPaths,
  literalSubscripts,
  loadBaseline,
  loadSchemaSnapshot,
  loadStoredSchema,
  minimalPrefixes,
  adjudicate,
  auditAgainstSnapshot,
  auditExitCode,
  pathsToTree,
  schemaOfEntry,
  templateValuesRefs,
  treeToPaths,
  valuesTreePaths,
  walkValuesObject,
  type ChartSchema,
  type InertFinding,
} from "./inert-valuesobject-keys.ts";

const HISTORY = join(import.meta.dir, "testdata", "inert-valuesobject-history");

const SNAPSHOT = loadSchemaSnapshot(undefined, REPO_ROOT);

/** The schema of one pinned chart, straight out of the checked-in snapshot. */
function snapshotSchema(repoURL: string, chart: string, targetRevision: string): ChartSchema {
  const key = chartKey(repoURL, chart, targetRevision);
  const stored = SNAPSHOT?.charts[key];
  if (stored === undefined) {
    // NOT a skip. The historical proof cannot be run at a pin the snapshot no
    // longer carries, and "the proof could not run" must fail rather than pass.
    throw new Error(
      `the schema snapshot does not carry ${key} — the four-instance proof cannot run against a chart nobody ` +
        `measured. Re-measure with --write-snapshot, or say out loud that the historical case is no longer checkable.`,
    );
  }
  return loadStoredSchema(stored);
}

/** A pre-fix Application fixture, as `{ valuesObject, chart, targetRevision, repoURL }`. */
function historicalCase(app: string): {
  valuesObject: Record<string, unknown>;
  chart: string;
  targetRevision: string;
  repoURL: string;
} {
  const doc = parse(readFileSync(join(HISTORY, `${app}.Application.yaml`), "utf8")) as {
    spec?: {
      source?: {
        chart?: string;
        targetRevision?: string;
        repoURL?: string;
        helm?: { valuesObject?: Record<string, unknown> };
      };
    };
  };
  const source = doc.spec?.source ?? {};
  return {
    valuesObject: source.helm?.valuesObject ?? {},
    chart: String(source.chart ?? ""),
    targetRevision: String(source.targetRevision ?? ""),
    repoURL: String(source.repoURL ?? ""),
  };
}

function inertPaths(findings: readonly InertFinding[]): string[] {
  return findings.filter((finding) => finding.kind === "inert-key").map((finding) => finding.path);
}

describe("THE BAR — red on all four instances as they stood before their fixes", () => {
  // Each of these reconstructs a `valuesObject` from git history (the fixture
  // files are verbatim `git show` output, provenance in testdata/README.md) and
  // requires the checker to REFUSE it. A guard that cannot catch the four cases
  // that motivated it has not been demonstrated to work.

  test("hindsight — `postgresql.primary.*` is refused (the chart reads postgresql.persistence)", () => {
    const historical = historicalCase("hindsight");
    const findings = findingsForApplication(
      "full-ai-cluster/hindsight",
      historical.valuesObject,
      snapshotSchema(historical.repoURL, historical.chart, historical.targetRevision),
      historical.chart,
      historical.targetRevision,
    );
    expect(inertPaths(findings)).toContain("postgresql.primary");
    // The finding must SAY what was lost, not merely that something was wrong:
    // the storageClass is the half that put Postgres on a Delete-reclaim disk.
    const finding = findings.find((entry) => entry.path === "postgresql.primary");
    expect(finding?.problem).toContain("postgresql.primary.persistence.storageClass");
  });

  test("hindsight — the SAME run also catches `api.llm` and `service`, found later and independently", () => {
    // PR #13524 found these two after PR #13457 had fixed the storage half and
    // said honestly that they were "narrowed, not cleared". The checker was
    // written against the four table rows and catches these as well — which is
    // the evidence that it implements a CLASS rather than four remembered cases.
    const historical = historicalCase("hindsight");
    const paths = inertPaths(
      findingsForApplication(
        "full-ai-cluster/hindsight",
        historical.valuesObject,
        snapshotSchema(historical.repoURL, historical.chart, historical.targetRevision),
        historical.chart,
        historical.targetRevision,
      ),
    );
    expect(paths).toContain("api.llm");
    expect(paths).toContain("service");
  });

  test("nats — the top-level `cluster:` is refused (the chart reads config.cluster)", () => {
    const historical = historicalCase("nats");
    const findings = findingsForApplication(
      "full-ai-cluster/nats",
      historical.valuesObject,
      snapshotSchema(historical.repoURL, historical.chart, historical.targetRevision),
      historical.chart,
      historical.targetRevision,
    );
    expect(inertPaths(findings)).toContain("cluster");
    expect(findings.find((entry) => entry.path === "cluster")?.problem).toContain("cluster.replicas");
    // And `config.jetstream.fileStore.pvc.*` in the SAME manifest is accepted —
    // a checker that refused the whole file would "catch" this case by refusing
    // everything, which is the vacuity class wearing a success story.
    expect(inertPaths(findings)).not.toContain("config");
  });

  test("oz at its own pin — REFUSED as chart-unavailable, because 1.4.5 is a version no registry serves", () => {
    const historical = historicalCase("oz");
    expect(historical.targetRevision).toBe("1.4.5");
    const findings = findingsForApplication(
      "full-ai-cluster/oz",
      historical.valuesObject,
      { ok: false, reason: "helm-pull-failed", detail: "chart version 1.4.5 not found" },
      historical.chart,
      historical.targetRevision,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("chart-unavailable");
    // The wording has to make clear that nothing was checked. "Unavailable"
    // reported as a pass is the failure this whole module exists to prevent.
    expect(findings[0]?.problem).toContain("NO key");
  });

  test("oz at a pin that EXISTS — `adminSecret` is refused, which is the key-set comparison itself", () => {
    // The demonstration the case above cannot give. Same historical
    // valuesObject, checked against ziti-controller 3.1.1 — a published version,
    // and the one the repair moved to. `adminSecret` is a key ziti-controller
    // has never had in ANY published version.
    const historical = historicalCase("oz");
    const findings = findingsForApplication(
      "full-ai-cluster/oz",
      historical.valuesObject,
      snapshotSchema(historical.repoURL, "ziti-controller", "3.1.1"),
      "ziti-controller",
      "3.1.1",
    );
    expect(inertPaths(findings)).toContain("adminSecret");
    // `persistence`, `clientApi` and `ctrlPlane` in the same manifest are real
    // keys and must NOT be refused.
    expect(inertPaths(findings)).not.toContain("persistence");
    expect(inertPaths(findings)).not.toContain("clientApi");
    expect(inertPaths(findings)).not.toContain("ctrlPlane");
  });

  test("headscale — the top-level `config:` is refused, and `persistence.config` beside it is NOT", () => {
    const historical = historicalCase("headscale");
    const findings = findingsForApplication(
      "full-ai-cluster/headscale",
      historical.valuesObject,
      snapshotSchema(historical.repoURL, historical.chart, historical.targetRevision),
      historical.chart,
      historical.targetRevision,
    );
    expect(inertPaths(findings)).toContain("config");
    expect(findings.find((entry) => entry.path === "config")?.problem).toContain("config.server_url");
    // THE FALSE-POSITIVE HALF, and it is the harder one. The same manifest sets
    // `persistence.config.accessMode` — a key that appears nowhere in
    // headscale's own six-key values.yaml and is legitimate because the bjw-s
    // `common` LIBRARY subchart reads it in the parent's scope. A guard that
    // refused it would be refusing a working value, and would be turned off.
    expect(inertPaths(findings)).not.toContain("persistence");
    expect(inertPaths(findings).filter((path) => path.startsWith("persistence"))).toEqual([]);
  });

  test("the fixtures are the real history — verified against git, not trusted", () => {
    // A fixture edited to make a test pass would be invisible without this.
    //
    // SHALLOW CLONES: CI checks out with `fetch-depth: 1`, so these objects are
    // absent and the first version of this test failed there — correctly, and
    // uselessly. It now FETCHES the missing object by SHA (GitHub serves
    // `git fetch --depth=1 origin <sha>` for any commit reachable from the
    // default branch; measured against a real shallow clone of this repo on
    // 2026-08-22), so the check RUNS in CI rather than degrading there.
    //
    // Only a genuinely network-less clone can leave it unanswered. That case is
    // reported by name and does not fail: a checkout with no remote cannot be
    // asked what the history says, and refusing to run the whole guard over it
    // would make an offline gate impossible. What NEVER passes is a reachable
    // object whose bytes disagree — that is the defect this test exists for,
    // and it is asserted unconditionally below.
    const provenance = [
      ["hindsight", "5e74c2939f6e4749a5e457d64091ec53e29efd61"],
      ["nats", "5e74c2939f6e4749a5e457d64091ec53e29efd61"],
      ["oz", "c4d78f2da4316c7fb8d8350789aec3c2d259ba86"],
      ["headscale", "006b58ab7b2f666537adbd4305ec1704dde824d3"],
    ] as const;

    const git = (args: readonly string[], timeout = 120_000): { status: number; stdout: string } => {
      const result = spawnSync("git", [...args], { cwd: REPO_ROOT, encoding: "utf8", timeout });
      return { status: result.status ?? -1, stdout: result.stdout ?? "" };
    };

    // ONE fetch for every missing object, not one per fixture. Each `git fetch`
    // pays a full negotiation round trip, and four of them in series against a
    // cold shallow clone was measurably too slow -- the fourth came back empty
    // and the fixture reported NOT VERIFIED for a reason that had nothing to do
    // with its provenance. A batched request is both faster and honest: what is
    // missing after it is genuinely unavailable.
    const missing = [...new Set(provenance.map(([, sha]) => sha))].filter(
      (sha) => git(["cat-file", "-e", sha], 30_000).status !== 0,
    );
    if (missing.length > 0) git(["fetch", "--no-tags", "--depth=1", "origin", ...missing], 300_000);

    const unverifiable: string[] = [];
    let verified = 0;
    for (const [app, sha] of provenance) {
      const path = `full-ai-cluster/k8s/applications/${app}/Application.yaml`;
      const shown = git(["show", `${sha}:${path}`]);
      if (shown.status !== 0) {
        unverifiable.push(`${app}@${sha.slice(0, 9)}`);
        continue;
      }
      // UNCONDITIONAL. A reachable object that disagrees fails, always.
      expect(readFileSync(join(HISTORY, `${app}.Application.yaml`), "utf8")).toBe(shown.stdout);
      verified += 1;
    }

    if (unverifiable.length > 0) {
      // Loud, and in the test output rather than swallowed — an unverified
      // provenance claim that says nothing is the shape this repo calls a check
      // that did not run wearing the face of one that passed.
      process.stderr.write(
        `NOT VERIFIED (no reachable git object, and the fetch did not resolve it): ${unverifiable.join(", ")}. ` +
          `${String(verified)} of ${String(provenance.length)} fixtures were checked against history.\n`,
      );
    }
    // The fixtures must at least BE the four cases, whatever git could answer.
    expect(provenance.length).toBe(4);
    for (const [app] of provenance) {
      expect(readFileSync(join(HISTORY, `${app}.Application.yaml`), "utf8").length).toBeGreaterThan(500);
    }
  });
});

describe("false positives — the four legitimate sources of a key absent from the parent values.yaml", () => {
  // These are the reason the guard is worth keeping. A naive key-set comparison
  // is red on nearly every app here, and a guard that cries wolf gets disabled,
  // which is strictly worse than no guard.

  test("SUBCHART — headscale accepts `postgresql.auth.database`, which is in the SUBCHART's values", () => {
    const schema = snapshotSchema("https://charts.gabe565.com", "headscale", "0.4.0");
    expect(classifyPath("postgresql.auth.database", schema)).toBe("accepted");
  });

  test("LIBRARY CHART — headscale accepts `persistence.config.accessMode`, from bjw-s common at the PARENT prefix", () => {
    // headscale's own values.yaml has six top-level keys and no `accessMode`
    // anywhere. The key is real because `common` is `type: library`, so its
    // templates run in the parent's scope. Fold it under its own name instead
    // and this returns "inert" — flagging a value that is load-bearing enough
    // that the chart REFUSES TO TEMPLATE without it.
    const schema = snapshotSchema("https://charts.gabe565.com", "headscale", "0.4.0");
    expect(classifyPath("persistence.config.accessMode", schema)).toBe("accepted");
    expect(classifyPath("persistence.config.storageClass", schema)).toBe("accepted");
  });

  test("CONDITIONAL — headscale accepts `ingress.main.hosts`, read only under `ingress.main.enabled`", () => {
    // The Application does not enable the Ingress, so this path is absent from
    // any default render. Absent from a render is not absent from the chart.
    const schema = snapshotSchema("https://charts.gabe565.com", "headscale", "0.4.0");
    expect(classifyPath("ingress.main.hosts", schema)).toBe("accepted");
    expect(classifyPath("ingress.main.tls", schema)).toBe("accepted");
  });

  test("OPEN MAP — an arbitrary env var and an arbitrary persistence item are accepted", () => {
    const schema = snapshotSchema("https://charts.gabe565.com", "headscale", "0.4.0");
    // `env` is consumed wholesale by bjw-s `_env_vars.tpl` (`$values :=
    // .Values.env`, then ranged). A key nobody could enumerate is not inert.
    expect(classifyPath("env.HEADSCALE_SERVER_URL", schema)).toBe("accepted");
    expect(classifyPath("env.SOME_VARIABLE_INVENTED_FOR_THIS_TEST", schema)).toBe("accepted");
    // `persistence` is keyed by an arbitrary item name (`range $index,
    // $persistence := .Values.persistence`).
    expect(classifyPath("persistence.whatever.enabled", schema)).toBe("accepted");
  });

  test("PIPELINE toYaml — node-feature-discovery's whole `worker.config` subtree is accepted", () => {
    // `.Values.worker.config | toYaml` — the SAME wholesale consumption as
    // `toYaml .Values.x`, written the other way round. Leaving the pipeline
    // form out was a measured false positive on this exact key.
    const schema = snapshotSchema(
      "https://kubernetes-sigs.github.io/node-feature-discovery/charts",
      "node-feature-discovery",
      "0.17.1",
    );
    expect(classifyPath("worker.config.sources", schema)).toBe("accepted");
    expect(classifyPath("worker.config.core.sleepInterval", schema)).toBe("accepted");
  });

  test("GLOBAL — `global.*` is accepted for every chart, because Helm propagates it regardless", () => {
    const schema = snapshotSchema("https://charts.gabe565.com", "headscale", "0.4.0");
    expect(classifyPath("global.imageRegistry", schema)).toBe("accepted");
  });

  test("MULTI-ALIAS SUBCHART — spire depends on `spire-agent` TWICE, and both value keys resolve", () => {
    // spire 0.24.2 declares `spire-agent` unaliased AND as
    // `upstream-spire-agent`. A `name -> key` map lets the second overwrite the
    // first and leaves the whole `spire-agent.*` subtree with no schema, which
    // reported a key the subchart plainly has as UNDECIDABLE.
    const schema = snapshotSchema("https://spiffe.github.io/helm-charts-hardened/", "spire", "0.24.2");
    expect(classifyPath("spire-agent.workloadAttestors.k8s.enabled", schema)).toBe("accepted");
    expect(classifyPath("upstream-spire-agent.workloadAttestors.k8s.enabled", schema)).toBe("accepted");
    // And the removed key is still caught — the widening did not blunt it.
    expect(classifyPath("spire-agent.workloadAttestors.k8s.skipKubeletVerification", schema)).toBe("inert");
  });

  test("an EMPTY valuesObject produces no findings, even when the chart could not be resolved", () => {
    // Twelve of this tree's 54 Applications are git-path sources syncing raw
    // manifests: no chart, no valuesObject. Reporting "could not resolve the
    // chart" for an Application that declares NOTHING is the guard inventing
    // work, and it was the single biggest false-positive source measured.
    expect(findingsForApplication("x/y", {}, { ok: false, reason: "no-chart-yaml", detail: "" }, "", "")).toEqual([]);
    // ...and the asymmetry that keeps it from being an escape hatch:
    expect(
      findingsForApplication("x/y", { anything: 1 }, { ok: false, reason: "no-chart-yaml", detail: "" }, "", ""),
    ).toHaveLength(1);
  });
});

describe("undecidable is a finding, never a pass", () => {
  const schema: ChartSchema = { literal: ["a.b"], open: [], dynamic: ["d"], charts: [] };

  test("a path under a computed reach is UNDECIDABLE, and undecidable counts toward the exit code", () => {
    expect(classifyPath("d.whatever", schema)).toBe("undecidable");
    const findings = findingsForApplication("x/y", { d: { whatever: 1 } }, schema, "c", "1");
    expect(findings.map((finding) => finding.kind)).toEqual(["undecidable-key"]);
    const result = {
      appsDiscovered: 1,
      appsChecked: 1,
      refused: findings,
      acknowledged: [],
      staleBaselineKeys: [],
      uncovered: [],
    };
    expect(auditExitCode(result)).toBe(1);
  });

  test("OPEN outranks DYNAMIC — a node the chart consumes wholesale is decided, not undecidable", () => {
    // Measured on bjw-s common, which BOTH ranges `.Values.service` and does
    // `get .Values.service (include ...)`. Ranking dynamic first marked
    // headscale's entire service and ingress trees undecidable.
    const both: ChartSchema = { literal: [], open: ["s"], dynamic: ["s"], charts: [] };
    expect(classifyPath("s.anything", both)).toBe("accepted");
  });

  test("an app the snapshot does not cover is NOT COVERED, and that fails too", () => {
    const result = {
      appsDiscovered: 2,
      appsChecked: 1,
      refused: [],
      acknowledged: [],
      staleBaselineKeys: [],
      uncovered: ["some/app (chart@1.0.0)"],
    };
    expect(auditExitCode(result)).toBe(1);
  });

  test("a snapshot row pointing at a missing schema reports unavailable, never silence", () => {
    const schemaResult = schemaOfEntry(
      { measuredOn: "2026-08-22", appsDiscovered: 1, charts: {}, entries: [] },
      { appId: "x/y", chart: "c", targetRevision: "1", repoURL: "r", chartKey: "r|c|1" },
    );
    expect("ok" in schemaResult && schemaResult.reason).toBe("schema-missing-from-snapshot");
  });
});

describe("the extraction rules, at the unit", () => {
  test("valuesTreePaths — an empty map is OPEN, a null leaf is LITERAL", () => {
    const tree = valuesTreePaths({ env: {}, storageClass: null, image: { tag: "1" }, extras: [] });
    expect(tree.open).toContain("env");
    expect(tree.open).toContain("extras");
    expect(tree.literal).toContain("storageClass");
    expect(tree.literal).toContain("image.tag");
    // `storageClass: null` must NOT become an open prefix — it is a scalar the
    // chart reads, not an invitation to nest arbitrary keys under it.
    expect(tree.open).not.toContain("storageClass");
  });

  test("templateValuesRefs — every ancestor of a literal reference is itself literal", () => {
    const refs = templateValuesRefs("{{ .Values.clientApi.advertisedHost }}");
    expect(refs.literal).toContain("clientApi");
    expect(refs.literal).toContain("clientApi.advertisedHost");
  });

  test('templateValuesRefs — `get .Values "edition"` is a LITERAL read, not a computed one', () => {
    // ziti-controller 3.1.1 `_helpers.tpl:141`. Reading it as computed marked
    // that chart's whole root undecidable, which turned oz's `adminSecret:`
    // from a caught defect into an unanswered question.
    const refs = templateValuesRefs('{{- $edition := (get .Values "edition") | default dict -}}');
    expect(refs.literal).toContain("edition");
    expect(refs.dynamic).toEqual([]);
  });

  test('templateValuesRefs — `(index .Values "a").b.c` is literal `a.b.c`', () => {
    const refs = templateValuesRefs('{{- if (index .Values "spire-agent").unsupportedBuiltInPlugins }}');
    expect(refs.literal).toContain("spire-agent.unsupportedBuiltInPlugins");
    expect(refs.dynamic).toEqual([]);
  });

  test('templateValuesRefs — a paren INSIDE the tail still parses (spire\'s `((index .Values "x").y).z`)', () => {
    const refs = templateValuesRefs(
      '{{- if (eq (((index .Values "spire-server").experimental).enabled | toString) "true") }}',
    );
    expect(refs.literal).toContain("spire-server.experimental.enabled");
    expect(refs.dynamic).toEqual([]);
  });

  test("templateValuesRefs — a computed subscript is dynamic AT THE LITERAL PREFIX, not at the root", () => {
    // gitlab: `index .Values "global" "communityImages" .Chart.Name "repository"`.
    // Recording the reach at the root makes every key in a 30-subchart umbrella
    // undecidable, and "undecidable" is not an actionable report.
    const refs = templateValuesRefs('{{ index .Values "global" "communityImages" .Chart.Name "repository" }}');
    expect(refs.dynamic).toEqual(["global.communityImages"]);
  });

  test("templateValuesRefs — TWO reaches on one line are both found", () => {
    // gitlab's NOTES.txt. A pattern that swallowed the rest of the line found
    // only the first, and the second path then looked absent from the chart —
    // a true verdict reached by accident, which is not a verdict this module is
    // allowed to reach.
    const refs = templateValuesRefs(
      '{{- if and (index .Values "gitlab-runner").install (not (index .Values "gitlab-runner").runners.privileged) }}',
    );
    expect(refs.literal).toContain("gitlab-runner.install");
    expect(refs.literal).toContain("gitlab-runner.runners.privileged");
  });

  test("literalSubscripts — reports the literals read BEFORE it gave up, and that it gave up", () => {
    expect(literalSubscripts('"a" "b" }}')).toEqual({ literals: ["a", "b"], complete: true });
    expect(literalSubscripts('"a" $var }}')).toEqual({ literals: ["a"], complete: false });
    expect(literalSubscripts("$var }}")).toEqual({ literals: [], complete: false });
  });

  test("dependencyValueKeys — an alias wins, and the SAME name can carry two keys", () => {
    const keys = dependencyValueKeys({
      dependencies: [
        { name: "postgresql", alias: "primary" },
        { name: "spire-agent" },
        { name: "spire-agent", alias: "upstream-spire-agent" },
      ],
    });
    expect(keys.get("postgresql")).toEqual(["primary"]);
    expect(keys.get("spire-agent")).toEqual(["spire-agent", "upstream-spire-agent"]);
  });

  test("walkValuesObject reports the SHALLOWEST bad path, carrying the leaves beneath it", () => {
    const schema: ChartSchema = {
      literal: ["postgresql", "postgresql.persistence"],
      open: [],
      dynamic: [],
      charts: [],
    };
    const verdicts = walkValuesObject(
      { postgresql: { primary: { persistence: { size: "10Gi", storageClass: "longhorn" } } } },
      schema,
    );
    // ONE finding, not four. hindsight's defect is one mistake, and reporting
    // it as four buries the fact under its own consequences.
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]?.path).toBe("postgresql.primary");
    expect(verdicts[0]?.leaves).toEqual([
      "postgresql.primary.persistence.size",
      "postgresql.primary.persistence.storageClass",
    ]);
  });

  test("leafPaths — an empty map is its own leaf, not nothing", () => {
    expect(leafPaths({ a: { b: 1 }, c: {} }, "x")).toEqual(["x.a.b", "x.c"]);
  });

  test("minimalPrefixes — a longer prefix under a shorter one is dropped", () => {
    expect(minimalPrefixes(["a.b", "a", "c", "a.b.c"])).toEqual(["a", "c"]);
    // The empty prefix covers everything, and must swallow the rest.
    expect(minimalPrefixes(["", "a"])).toEqual([""]);
  });

  test("pathsToTree / treeToPaths round-trip every path", () => {
    const paths = ["a", "a.b", "a.b.c", "d"];
    expect(treeToPaths(pathsToTree(paths)).sort()).toEqual([...paths].sort());
  });
});

describe("the ratchet", () => {
  const finding: InertFinding = { kind: "inert-key", key: "app k", appId: "app", path: "k", problem: "P" };

  test("an unacknowledged finding is refused", () => {
    expect(adjudicate([finding], { findings: [] }).refused).toHaveLength(1);
  });

  test("an acknowledgement whose `observed` no longer matches stops covering the finding", () => {
    const result = adjudicate([finding], {
      findings: [{ key: "app k", reason: "r", liftsWhen: "l", observed: "SOMETHING ELSE" }],
    });
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.problem).toContain("what was acknowledged has CHANGED");
  });

  test("a baseline entry matching nothing is STALE and fails in its own right", () => {
    const result = adjudicate([], { findings: [{ key: "gone", reason: "r", liftsWhen: "l", observed: "o" }] });
    expect(result.staleBaselineKeys).toEqual(["gone"]);
    expect(
      auditExitCode({
        appsDiscovered: 0,
        appsChecked: 0,
        refused: [],
        acknowledged: [],
        staleBaselineKeys: result.staleBaselineKeys,
        uncovered: [],
      }),
    ).toBe(1);
  });

  test("every checked-in entry carries a reason and a liftsWhen, and the loader refuses one without", () => {
    const baseline = loadBaseline(undefined, REPO_ROOT);
    expect(baseline.findings.length).toBeGreaterThan(0);
    for (const entry of baseline.findings) {
      expect(entry.reason.length).toBeGreaterThan(40);
      expect(entry.liftsWhen).toMatch(/^LIFTS WHEN /);
    }
  });

  test("every `liftsWhen` names THIS entry's own key — the stricter-than-the-gate trap", () => {
    // A `LIFTS WHEN` stricter than the gate it names keeps a deferral alive
    // after its defect is gone. Checked mechanically: the condition has to
    // mention the key path it excuses, so it cannot be a tree-wide condition
    // that this entry's repair would not satisfy.
    for (const entry of loadBaseline(undefined, REPO_ROOT).findings) {
      const path = entry.key.split(" ").slice(1).join(" ");
      const leaf = path.split(".").slice(-1)[0] ?? path;
      expect(entry.liftsWhen, `"${entry.liftsWhen}" never mentions "${path}" or "${leaf}"`).toMatch(
        new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${leaf.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      );
    }
  });

  test("the checked-in tree is GREEN against the checked-in snapshot and baseline", () => {
    // The gate itself, run offline. If this fails, either a manifest grew an
    // inert key or a baseline entry went stale — both are the point.
    expect(SNAPSHOT).not.toBeNull();
    const result = auditAgainstSnapshot(SNAPSHOT!, { repoRoot: REPO_ROOT });
    expect(result.uncovered).toEqual([]);
    expect(result.refused.map((entry) => entry.key)).toEqual([]);
    expect(result.staleBaselineKeys).toEqual([]);
    expect(auditExitCode(result)).toBe(0);
  });
});

describe("the CLI's exit code — the thing CI actually reads", () => {
  // Every assertion above is on a function. CI runs a PROCESS, and a `main`
  // that always exits 0 would leave all of them passing while the gate stopped
  // gating. That is the shape of failure this repo names most often, so it gets
  // its own falsifier at the process boundary.
  const MODULE = join(import.meta.dir, "inert-valuesobject-keys.ts");

  function runCli(args: readonly string[]): { status: number; stdout: string } {
    const result = spawnSync("bun", [MODULE, ...args], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
    return { status: result.status ?? -1, stdout: result.stdout ?? "" };
  }

  test("exits 0 on the tree as checked in", () => {
    expect(runCli(["--offline"]).status).toBe(0);
  });

  test("exits 1 when the baseline is empty — the 11 acknowledged findings are REAL, not absent", () => {
    // Points the run at a baseline path that does not exist, which loads as an
    // empty baseline. If this exits 0, either the findings evaporated or the
    // exit code stopped depending on them.
    const run = runCli(["--offline", "--baseline", "src/Core.TypeScript/cluster/testdata/no-such-baseline.json"]);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("REFUSED (11)");
    expect(run.stdout).toContain("FAILED");
  });
});

describe("foldChart over a SYNTHETIC chart — the extraction itself, not a pre-measured snapshot", () => {
  // WHY THIS BLOCK EXISTS. Every test above this point reads the checked-in
  // schema snapshot, so mutating `foldChart` changed nothing they could see:
  // the mutation harness found `subchart-resolution-disabled`,
  // `library-chart-folded-under-its-own-name` and `pipeline-toYaml-form-dropped`
  // all SURVIVING. A snapshot is a record of what the extractor once said, so
  // asserting against it can never falsify the extractor. These build a chart on
  // disk and fold it.

  function writeChart(root: string): void {
    mkdirSync(join(root, "templates"), { recursive: true });
    writeFileSync(
      join(root, "Chart.yaml"),
      [
        "name: parent",
        "version: 1.0.0",
        "type: application",
        "dependencies:",
        "  - name: sub",
        "  - name: sub",
        "    alias: aliased-sub",
        "  - name: lib",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(join(root, "values.yaml"), ["own:", "  key: 1", "wideOpen: {}"].join("\n"), "utf8");
    writeFileSync(
      join(root, "templates", "main.yaml"),
      ["{{ .Values.conditionalOnly.host }}", "{{- .Values.piped.subtree | toYaml | nindent 4 }}"].join("\n"),
      "utf8",
    );

    mkdirSync(join(root, "charts", "sub", "templates"), { recursive: true });
    writeFileSync(join(root, "charts", "sub", "Chart.yaml"), "name: sub\nversion: 1.0.0\ntype: application\n", "utf8");
    writeFileSync(join(root, "charts", "sub", "values.yaml"), "subKey:\n  nested: true\n", "utf8");

    mkdirSync(join(root, "charts", "lib", "templates"), { recursive: true });
    writeFileSync(join(root, "charts", "lib", "Chart.yaml"), "name: lib\nversion: 1.0.0\ntype: library\n", "utf8");
    writeFileSync(join(root, "charts", "lib", "values.yaml"), "libProvided:\n  accessMode: ReadWriteOnce\n", "utf8");
  }

  const root = mkdtempSync(join(tmpdir(), "zeta-inert-chart-"));
  writeChart(root);
  const accumulator = {
    literal: new Set<string>(),
    open: new Set<string>(),
    dynamic: new Set<string>(),
    charts: [] as string[],
  };
  foldChart(root, "", accumulator as never);
  const schema: ChartSchema = {
    literal: [...accumulator.literal].sort(),
    open: minimalPrefixes([...accumulator.open]),
    dynamic: minimalPrefixes([...accumulator.dynamic]),
    charts: accumulator.charts,
  };

  test("the parent's own values are literal", () => {
    expect(classifyPath("own.key", schema)).toBe("accepted");
  });

  test("SUBCHART values land under the subchart's name", () => {
    expect(classifyPath("sub.subKey.nested", schema)).toBe("accepted");
    // ...and NOT at the parent's prefix, which would accept anything.
    expect(classifyPath("subKey.nested", schema)).toBe("inert");
  });

  test("an ALIASED dependency lands under the ALIAS, and the un-aliased copy still lands too", () => {
    expect(classifyPath("aliased-sub.subKey.nested", schema)).toBe("accepted");
    expect(classifyPath("sub.subKey.nested", schema)).toBe("accepted");
  });

  test("a LIBRARY subchart lands at the PARENT's prefix, not under its own name", () => {
    // This is the rule that makes headscale's working values readable. Fold the
    // library under its own name and `libProvided.accessMode` reads as inert.
    expect(classifyPath("libProvided.accessMode", schema)).toBe("accepted");
    expect(classifyPath("lib.libProvided.accessMode", schema)).toBe("inert");
  });

  test("a CONDITIONAL path named only in a template is accepted", () => {
    expect(classifyPath("conditionalOnly.host", schema)).toBe("accepted");
  });

  test("an EMPTY-MAP default is an open prefix", () => {
    expect(classifyPath("wideOpen.anything.at.all", schema)).toBe("accepted");
  });

  test("the PIPELINE `| toYaml` form opens the subtree", () => {
    expect(classifyPath("piped.subtree.anything", schema)).toBe("accepted");
  });

  test("and a key nobody names is still INERT — the extractor did not just accept everything", () => {
    // Without this the block above would pass under a `foldChart` that opened
    // the root, which is the vacuity class wearing eight green ticks.
    expect(classifyPath("neverMentionedAnywhere", schema)).toBe("inert");
    expect(classifyPath("own.notAKey", schema)).toBe("inert");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("an Application the snapshot does not cover is reported, not skipped", () => {
  test("auditAgainstSnapshot lists it as uncovered, and the exit code is 1", () => {
    // The mutation harness found `uncovered-app-is-a-pass` surviving: every
    // assertion about `uncovered` built an AuditResult by hand, so nothing
    // exercised the branch that fills it. This runs the real audit against a
    // snapshot with its entries removed.
    expect(SNAPSHOT).not.toBeNull();
    const truncated = { ...SNAPSHOT!, entries: [] };
    const result = auditAgainstSnapshot(truncated, { repoRoot: REPO_ROOT });
    expect(result.uncovered.length).toBe(result.appsDiscovered);
    expect(result.appsChecked).toBe(0);
    expect(auditExitCode(result)).toBe(1);
  });
});

describe("the literal-ancestor rule — measured as never firing on this tree, so pinned directly", () => {
  // Across all 54 Applications and 736 declared key paths, neither ancestry
  // branch of `classifyPath` fires: every ancestor is already an exact literal.
  // The mutation harness therefore reported `literal-ancestor-rule-removed` as
  // SURVIVING — the branch was real, documented, and unfalsifiable. These pin
  // the contract at the unit, where the shape can be constructed on purpose.

  test("a manifest may set a PARENT map whose children the chart names", () => {
    const schema: ChartSchema = { literal: ["clientApi.advertisedHost"], open: [], dynamic: [], charts: [] };
    // `clientApi` itself is not in the literal set here — only its child is.
    expect(schema.literal).not.toContain("clientApi");
    expect(classifyPath("clientApi", schema)).toBe("accepted");
    // ...and the rule must not accept a SIBLING that shares no path.
    expect(classifyPath("clientApiOther", schema)).toBe("inert");
    // Nor a prefix that merely shares characters — the boundary is the dot.
    expect(classifyPath("client", schema)).toBe("inert");
  });

  test("an OPEN prefix is ancestry evidence too, since `freeze` prunes literals below one", () => {
    const schema: ChartSchema = { literal: [], open: ["persistence.config"], dynamic: [], charts: [] };
    expect(classifyPath("persistence", schema)).toBe("accepted");
    expect(classifyPath("persistenceOther", schema)).toBe("inert");
  });
});
