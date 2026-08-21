#!/usr/bin/env bun
/**
 * Mutation suite for audit-observability-chain.ts.
 *
 * An audit is only worth its CI slot if it can go red, so every rule below is
 * planted as a mutation and asserted to fail with its own reason, plus a
 * control asserting the real tree passes -- an audit that failed
 * unconditionally would be just as useless as one that cannot fail.
 *
 * The sharpest case is `pre-fix tree`: the audit is pointed at the ACTUAL
 * content of full-ai-cluster/k8s/applications before 2026-08-20 and must
 * report all three shipped defects. That is not a synthetic mutation -- it is
 * the state the repo was in.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  DEFAULT_APPS_DIR,
  DEFAULT_ROSTER,
  DOTNET_METRICS_SOURCE,
  PORTAL_METRICS_SOURCE,
  alloyEdges,
  authoredMonitoringObjects,
  authoredServices,
  checkAlertmanager,
  checkAlloyGraph,
  checkAuthoredRules,
  checkEndpoints,
  checkIncludedByApplication,
  checkMonitoringSelectorLabel,
  checkScrapeOptIn,
  checkServiceMonitorTargets,
  isEmittedMetric,
  parseAlloyComponents,
  parseAlloyEndpoints,
  promqlMetricNames,
  readAuthoredDocs,
  runAudit,
  stripAlloyComments,
  valuesHash,
  zetaEmitterRoster,
  type AuthoredService,
  type MonitoringObject,
  type Roster,
} from "./audit-observability-chain.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const APPS = join(REPO_ROOT, DEFAULT_APPS_DIR);
const ROSTER = join(REPO_ROOT, DEFAULT_ROSTER);

function tempTree(): string {
  const dir = mkdtempSync(join(tmpdir(), "obs-chain-"));
  cpSync(APPS, join(dir, "applications"), { recursive: true });
  return dir;
}

function readApp(dir: string, app: string): Record<string, unknown> {
  const p = join(dir, "applications", app, "Application.yaml");
  return parseYaml(readFileSync(p, "utf8"), { uniqueKeys: true }) as Record<string, unknown>;
}

function writeApp(dir: string, app: string, doc: Record<string, unknown>): void {
  writeFileSync(join(dir, "applications", app, "Application.yaml"), stringifyYaml(doc));
}

function values(doc: Record<string, unknown>): Record<string, unknown> {
  const src = (doc.spec as Record<string, unknown>).source as Record<string, unknown>;
  return ((src.helm as Record<string, unknown>).valuesObject ?? {}) as Record<string, unknown>;
}

describe("CONTROL", () => {
  test("the real tree passes -- an audit that always fails is not a check", () => {
    const r = runAudit(APPS, ROSTER, REPO_ROOT);
    expect(r.failures).toEqual([]);
    // 3 chain invariants + 4 scrape/alerting invariants added 2026-08-20
    // + the ServiceMonitor -> Service resolution added 2026-08-21.
    expect(r.checked.length).toBe(8);
  });
});

describe("THE STATE THAT SHIPPED (pre-fix, 2026-08-20)", () => {
  const preAlloy = [
    `logging { level = "info" }`,
    `loki.write "loki" {`,
    `  endpoint { url = "http://loki.loki.svc.cluster.local:3100/loki/api/v1/push" }`,
    `}`,
    `otelcol.exporter.otlp "tempo" {`,
    `  client { endpoint = "http://tempo.tempo.svc.cluster.local:4317" }`,
    `}`,
    `prometheus.remote_write "mimir" {`,
    `  endpoint { url = "http://mimir-distributor.mimir.svc.cluster.local:8080/api/v1/push" }`,
    `}`,
  ].join(String.fromCharCode(10));

  test("all three sinks report NO SOURCE (finding 1)", () => {
    const fails = checkAlloyGraph(preAlloy);
    expect(fails.length).toBe(3);
    expect(fails.every((f) => f.includes("NO SOURCE"))).toBe(true);
    expect(fails.some((f) => f.includes("loki.write.loki"))).toBe(true);
    expect(fails.some((f) => f.includes("otelcol.exporter.otlp.tempo"))).toBe(true);
    expect(fails.some((f) => f.includes("prometheus.remote_write.mimir"))).toBe(true);
  });

  test("the loki endpoint names a Service the chart does not render (finding 2)", () => {
    const roster = JSON.parse(readFileSync(ROSTER, "utf8")) as Roster;
    const eps = parseAlloyEndpoints(preAlloy);
    const fails = checkEndpoints(eps, roster, new Map());
    expect(fails.length).toBe(1);
    expect(fails[0]).toContain("names Service loki which the loki chart does not render");
    expect(fails[0]).toContain("loki-gateway");
  });

  test("an absent alertmanager.config is a failure, not a default (finding 3)", () => {
    const fails = checkAlertmanager({});
    expect(fails.length).toBe(1);
    expect(fails[0]).toContain("routes EVERY alert to a receiver named null");
  });
});

describe("MUTATION -- alloy pipeline graph", () => {
  test("deleting the log source leaves loki.write with no in-edge", () => {
    const dir = tempTree();
    const doc = readApp(dir, "alloy");
    const v = values(doc);
    const cm = ((v.alloy as Record<string, unknown>).configMap) as Record<string, unknown>;
    const cfg = String(cm.content);
    const cut = cfg.replace(/loki\.source\.kubernetes "pod_logs" \{[^}]*\}/, "");
    expect(cut).not.toBe(cfg);
    cm.content = cut.replace(/otelcol\.exporter\.loki "to_loki" \{[^}]*\}/, "").replace(/logs {4}= \[otelcol\.exporter\.loki\.to_loki\.input\]/, "");
    writeApp(dir, "alloy", doc);
    const r = runAudit(join(dir, "applications"), ROSTER);
    expect(r.failures.some((f) => f.includes("loki.write.loki") && f.includes("NO SOURCE"))).toBe(true);
  });

  test("a component wired to nothing at all is ISOLATED", () => {
    const cfg = [
      `prometheus.exporter.unix "orphan" {`,
      `  endpoint { url = "http://x.y.svc:80/api/v1/push" }`,
      `}`,
    ].join(String.fromCharCode(10));
    const fails = checkAlloyGraph(cfg);
    expect(fails.length).toBe(1);
    expect(fails[0]).toContain("ISOLATED");
  });

  test("a wired sink passes -- the rule is not vacuous", () => {
    const cfg = [
      `loki.source.api "in" { forward_to = [loki.write.out.receiver] }`,
      `loki.write "out" { endpoint { url = "http://a.b.svc:80/loki/api/v1/push" } }`,
    ].join(String.fromCharCode(10));
    expect(checkAlloyGraph(cfg)).toEqual([]);
  });
});

describe("MUTATION -- endpoint vs rendered Service", () => {
  const roster = (): Roster => JSON.parse(readFileSync(ROSTER, "utf8")) as Roster;

  test("a Service name the chart does not render fails", () => {
    const eps = parseAlloyEndpoints(`url = "http://loki-frontend.loki.svc.cluster.local:80/x"`);
    const fails = checkEndpoints(eps, roster(), new Map());
    expect(fails.length).toBe(1);
    expect(fails[0]).toContain("does not render");
  });

  test("the right Service at the wrong port fails", () => {
    const eps = parseAlloyEndpoints(`url = "http://loki-gateway.loki.svc.cluster.local:3100/x"`);
    const fails = checkEndpoints(eps, roster(), new Map());
    expect(fails.length).toBe(1);
    expect(fails[0]).toContain("exposes 80");
  });

  test("the corrected endpoint passes", () => {
    const eps = parseAlloyEndpoints(`url = "http://loki-gateway.loki.svc.cluster.local:80/x"`);
    expect(checkEndpoints(eps, roster(), new Map())).toEqual([]);
  });

  test("bumping a target chart version without --refresh fails as STALE", () => {
    const dir = tempTree();
    const doc = readApp(dir, "loki");
    const src = (doc.spec as Record<string, unknown>).source as Record<string, unknown>;
    src.targetRevision = "6.19.0";
    writeApp(dir, "loki", doc);
    const r = runAudit(join(dir, "applications"), ROSTER);
    expect(r.failures.some((f) => f.includes("STALE"))).toBe(true);
  });

  test("valuesHash moves when the values move -- staleness is detectable at all", () => {
    const doc = readApp(tempTree(), "loki");
    const before = valuesHash(doc);
    const src = (doc.spec as Record<string, unknown>).source as Record<string, unknown>;
    ((src.helm as Record<string, unknown>).valuesObject as Record<string, unknown>).deploymentMode = "SingleBinary";
    expect(valuesHash(doc)).not.toBe(before);
  });
});

describe("MUTATION -- alertmanager routing", () => {
  const base = (): Record<string, unknown> => ({
    alertmanager: {
      config: {
        route: { receiver: "unrouted-REQUIRES-CONFIGURATION", routes: [] },
        receivers: [{ name: "unrouted-REQUIRES-CONFIGURATION" }],
      },
    },
  });

  test("the declared-undelivered shape passes", () => {
    expect(checkAlertmanager(base())).toEqual([]);
  });

  test("a silent no-op receiver name fails", () => {
    for (const noop of ["null", "none", "blackhole", "devnull", "NULL"]) {
      const v = base();
      const cfg = ((v.alertmanager as Record<string, unknown>).config) as Record<string, unknown>;
      (cfg.route as Record<string, unknown>).receiver = noop;
      cfg.receivers = [{ name: noop }];
      const fails = checkAlertmanager(v);
      expect(fails.some((f) => f.includes("silent no-op name"))).toBe(true);
    }
  });

  test("an integration-less receiver with an innocuous name fails", () => {
    const v = base();
    const cfg = ((v.alertmanager as Record<string, unknown>).config) as Record<string, unknown>;
    (cfg.route as Record<string, unknown>).receiver = "default";
    cfg.receivers = [{ name: "default" }];
    const fails = checkAlertmanager(v);
    expect(fails.some((f) => f.includes("does not say so in its name"))).toBe(true);
  });

  test("a REQUIRES- name that HAS an integration fails -- the name lies the other way", () => {
    const v = base();
    const cfg = ((v.alertmanager as Record<string, unknown>).config) as Record<string, unknown>;
    cfg.receivers = [{ name: "unrouted-REQUIRES-CONFIGURATION", webhook_configs: [{ url: "http://example.invalid" }] }];
    const fails = checkAlertmanager(v);
    expect(fails.some((f) => f.includes("drop the suffix"))).toBe(true);
  });

  test("a route targeting an undefined receiver fails", () => {
    const v = base();
    const cfg = ((v.alertmanager as Record<string, unknown>).config) as Record<string, unknown>;
    (cfg.route as Record<string, unknown>).routes = [{ receiver: "typo-REQUIRES-CONFIGURATION" }];
    const fails = checkAlertmanager(v);
    expect(fails.some((f) => f.includes("is not defined"))).toBe(true);
  });

  test("a real integration on a plainly-named receiver passes", () => {
    const v = base();
    const cfg = ((v.alertmanager as Record<string, unknown>).config) as Record<string, unknown>;
    (cfg.route as Record<string, unknown>).receiver = "oncall";
    cfg.receivers = [{ name: "oncall", pagerduty_configs: [{ routing_key: "x" }] }];
    expect(checkAlertmanager(v)).toEqual([]);
  });

  test("deleting alertmanager.config from the real tree goes red", () => {
    const dir = tempTree();
    const doc = readApp(dir, "kube-prometheus-stack");
    delete (values(doc).alertmanager as Record<string, unknown>).config;
    writeApp(dir, "kube-prometheus-stack", doc);
    const r = runAudit(join(dir, "applications"), ROSTER);
    expect(r.failures.some((f) => f.includes("receiver named null"))).toBe(true);
  });
});

describe("PARSER", () => {
  test("comments do not create phantom components or endpoints", () => {
    const cfg = [
      `// loki.write "ghost" { endpoint { url = "http://ghost.ghost.svc:80/x" } }`,
      `loki.write "real" { endpoint { url = "http://a.b.svc:80/x" } }`,
    ].join(String.fromCharCode(10));
    expect(parseAlloyComponents(cfg).map((c) => c.id)).toEqual(["loki.write.real"]);
    expect(parseAlloyEndpoints(cfg).map((e) => e.service)).toEqual(["a"]);
  });

  test("a // inside a string literal is not a comment", () => {
    const cfg = `loki.write "real" { endpoint { url = "http://a.b.svc:80/x" } }`;
    expect(stripAlloyComments(cfg)).toBe(cfg);
  });

  test("nested blocks do not end the component early", () => {
    const comps = parseAlloyComponents(`otelcol.receiver.otlp "in" { grpc { endpoint = "0.0.0.0:4317" } http { endpoint = "0.0.0.0:4318" } }`);
    expect(comps.length).toBe(1);
    expect(comps[0]?.body ?? "").toContain("4318");
  });
});

// ===================================================================
// THE SCRAPE HALF (added 2026-08-20).
//
// Same discipline as above: every rule is planted as a mutation and
// asserted to fail with its own reason. The rule worth the most here
// is the last one -- an alert naming a metric nothing emits, which is
// the vacuity class at the query layer.
// ===================================================================

function appFile(dir: string, app: string, file: string): string {
  return join(dir, "applications", app, file);
}

function readFile(dir: string, app: string, file: string): string {
  return readFileSync(appFile(dir, app, file), "utf8");
}

function writeFile(dir: string, app: string, file: string, text: string): void {
  writeFileSync(appFile(dir, app, file), text);
}

function appsOf(dir: string): string {
  return join(dir, "applications");
}

describe("CONTROL -- the scrape half", () => {
  test("the real tree has at least one authored monitoring object", () => {
    // The state this rule was written against: ZERO. Every alert in the
    // cluster belonged to a chart, so nothing watched Zeta at all.
    const objects = authoredMonitoringObjects(APPS);
    expect(objects.length).toBeGreaterThan(0);
    expect(objects.some((o) => o.kind === "PrometheusRule")).toBe(true);
  });

  test("the emitter roster is derived from real sources and is not empty", () => {
    const { roster, failures } = zetaEmitterRoster(REPO_ROOT);
    expect(failures).toEqual([]);
    expect(roster.exact).toContain("zeta_portal_build_info");
    expect(roster.prefixes).toContain("dbsp_ticks");
  });
});

describe("PROMQL -- what counts as a metric reference", () => {
  test("function names are not series", () => {
    expect(promqlMetricNames("rate(foo_total[5m])")).toEqual(["foo_total"]);
  });

  test("duration units inside a range selector are not series", () => {
    // Caught live on the first run: changes(x[1h]) reported a metric named h.
    expect(promqlMetricNames("changes(zeta_portal_start_time_seconds[1h]) > 3")).toEqual([
      "zeta_portal_start_time_seconds",
    ]);
  });

  test("label names and matcher values are not series", () => {
    const names = promqlMetricNames("sum(rate(a_total{route=\"api\",job=\"portal\"}[5m]))");
    expect(names).toEqual(["a_total"]);
  });

  test("aggregation keywords are not series", () => {
    expect(promqlMetricNames("sum by (namespace) (a_total)")).toEqual(["a_total"]);
  });
});

describe("EMITTER ROSTER -- membership", () => {
  test("an exact portal metric is emitted", () => {
    const roster = { exact: ["zeta_portal_build_info"], prefixes: ["dbsp_ticks"] };
    expect(isEmittedMetric("zeta_portal_build_info", roster)).toBe(true);
  });

  test("a .NET instrument matches by prefix -- the exporter adds unit and _total suffixes", () => {
    const roster = { exact: [], prefixes: ["dbsp_ticks"] };
    expect(isEmittedMetric("dbsp_ticks_tick_total", roster)).toBe(true);
    expect(isEmittedMetric("dbsp_ticks", roster)).toBe(true);
  });

  test("a near-miss is NOT emitted -- prefix matching must still discriminate", () => {
    const roster = { exact: [], prefixes: ["dbsp_ticks"] };
    expect(isEmittedMetric("dbsp_frobnicate_total", roster)).toBe(false);
    expect(isEmittedMetric("dbsp_ticksomething", roster)).toBe(false);
  });

  test("scrape-synthetic series are allowed -- they are facts about the scrape", () => {
    expect(isEmittedMetric("up", { exact: [], prefixes: [] })).toBe(true);
  });
});

describe("MUTATION -- scrape opt-in coherence", () => {
  test("the real tree passes both directions", () => {
    expect(checkScrapeOptIn(readAuthoredDocs(APPS))).toEqual([]);
  });

  test("annotating a port the pod does not declare fails", () => {
    const dir = tempTree();
    const text = readFile(dir, "platform", "portal.yaml").replace(
      String.fromCharCode(34) + "8080" + String.fromCharCode(34),
      String.fromCharCode(34) + "9999" + String.fromCharCode(34),
    );
    writeFile(dir, "platform", "portal.yaml", text);
    const fails = checkScrapeOptIn(readAuthoredDocs(appsOf(dir)));
    expect(fails.join(" ")).toContain("annotated for port 9999");
  });

  test("scrape=true with no port annotation fails", () => {
    const dir = tempTree();
    const text = readFile(dir, "platform", "portal.yaml")
      .split("\n")
      .filter((l) => !l.includes("prometheus.io/port"))
      .join("\n");
    writeFile(dir, "platform", "portal.yaml", text);
    const fails = checkScrapeOptIn(readAuthoredDocs(appsOf(dir)));
    expect(fails.join(" ")).toContain("no prometheus.io/port");
  });

  test("OUR workload with a metrics port and no annotation fails -- the inverted sink", () => {
    const dir = tempTree();
    const text = readFile(dir, "hat-system", "deployment.yaml")
      .split("\n")
      .filter((l) => !/^\s*"?prometheus\.io\//.test(l))
      .join("\n");
    writeFile(dir, "hat-system", "deployment.yaml", text);
    const fails = checkScrapeOptIn(readAuthoredDocs(appsOf(dir)));
    expect(fails.join(" ")).toContain("hat-system-operator");
    expect(fails.join(" ")).toContain("sink with no source, inverted");
  });

  test("a VENDORED third-party workload with a metrics port is out of scope", () => {
    // cdi and kubevirt declare metrics ports and carry no annotation. The fix
    // there is their own chart ServiceMonitor, not hand-edits to a file we
    // re-vendor. If this ever fails, the rule has started producing upstream
    // drift instead of finding defects.
    const fails = checkScrapeOptIn(readAuthoredDocs(APPS)).join(" ");
    expect(fails).not.toContain("virt-operator");
    expect(fails).not.toContain("cdi-operator");
  });
});

describe("MUTATION -- an alert on a metric nothing emits", () => {
  test("the authored rules pass against the real emitter roster", () => {
    const { roster } = zetaEmitterRoster(REPO_ROOT);
    expect(checkAuthoredRules(authoredMonitoringObjects(APPS), roster)).toEqual([]);
  });

  test("a rule naming a metric no source emits FAILS -- the vacuity class", () => {
    const dir = tempTree();
    const text = readFile(dir, "platform", "monitoring.yaml").replace(
      "zeta_portal_build_info",
      "zeta_portal_definitely_not_emitted",
    );
    writeFile(dir, "platform", "monitoring.yaml", text);
    const { roster } = zetaEmitterRoster(REPO_ROOT);
    const fails = checkAuthoredRules(authoredMonitoringObjects(appsOf(dir)), roster).join(" ");
    expect(fails).toContain("zeta_portal_definitely_not_emitted");
    expect(fails).toContain("can never fire");
  });

  test("deleting the emitter turns its alerts red -- the roster is DERIVED", () => {
    // The point of deriving rather than allowlisting: removing a metric from
    // the source that emits it must break the alerts that watch it, in the
    // same PR, rather than leaving them silently unfirable.
    const fakeRoot = mkdtempSync(join(tmpdir(), "obs-emitters-"));
    mkdirSync(join(fakeRoot, "full-ai-cluster", "portal", "src"), { recursive: true });
    mkdirSync(join(fakeRoot, "src", "Core"), { recursive: true });
    writeFileSync(
      join(fakeRoot, PORTAL_METRICS_SOURCE),
      "export const EMITTED_METRICS = [" + String.fromCharCode(34) + "zeta_portal_something_else" + String.fromCharCode(34) + "] as const;",
    );
    writeFileSync(join(fakeRoot, DOTNET_METRICS_SOURCE), readFileSync(join(REPO_ROOT, DOTNET_METRICS_SOURCE), "utf8"));
    const { roster, failures } = zetaEmitterRoster(fakeRoot);
    expect(failures).toEqual([]);
    const fails = checkAuthoredRules(authoredMonitoringObjects(APPS), roster).join(" ");
    expect(fails).toContain("zeta_portal_build_info");
  });

  test("a missing emitter source is a FAILURE, not an empty roster", () => {
    // An empty roster would make this whole check pass everything, which is
    // the vacuity failure wearing the audit as a costume.
    const emptyRoot = mkdtempSync(join(tmpdir(), "obs-noemitters-"));
    const { failures } = zetaEmitterRoster(emptyRoot);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.join(" ")).toContain("cannot be derived");
  });
});

describe("MUTATION -- objects the ruler never selects", () => {
  test("the authored objects carry the release label the chart selects on", () => {
    expect(checkMonitoringSelectorLabel(authoredMonitoringObjects(APPS), "kube-prometheus-stack")).toEqual([]);
  });

  test("dropping the release label fails -- applied and never evaluated", () => {
    const dir = tempTree();
    const text = readFile(dir, "platform", "monitoring.yaml")
      .split("\n")
      .filter((l) => !l.includes("release: kube-prometheus-stack"))
      .join("\n");
    writeFile(dir, "platform", "monitoring.yaml", text);
    const fails = checkMonitoringSelectorLabel(authoredMonitoringObjects(appsOf(dir)), "kube-prometheus-stack").join(" ");
    expect(fails).toContain("carries no release label");
    expect(fails).toContain("never evaluated");
  });

  test("renaming the helm release fails the objects that still name the old one", () => {
    const fails = checkMonitoringSelectorLabel(authoredMonitoringObjects(APPS), "kps-renamed").join(" ");
    expect(fails).toContain("kps-renamed");
  });
});

describe("MUTATION -- Argo never applies the file", () => {
  test("the authored monitoring manifest is inside its include filter", () => {
    expect(checkIncludedByApplication(APPS, authoredMonitoringObjects(APPS))).toEqual([]);
  });

  test("dropping the file from the include glob fails -- it exists only in git", () => {
    const dir = tempTree();
    const text = readFile(dir, "platform", "Application.yaml").replace(",monitoring}", "}");
    writeFile(dir, "platform", "Application.yaml", text);
    const fails = checkIncludedByApplication(appsOf(dir), authoredMonitoringObjects(appsOf(dir))).join(" ");
    expect(fails).toContain("never applies the file");
  });
});

// ===================================================================
// THE SERVICEMONITOR -> SERVICE LINK (added 2026-08-21).
//
// Every mutation below was RUN against the audit before rule 9 existed
// and every one of them printed "PASS: 7 invariants hold". They are
// recorded here as the four ways a ServiceMonitor stops resolving, so
// that the rule cannot regress into the false-green it was written for.
//
// What makes this class nastier than a broken target: an unresolved
// ServiceMonitor produces a scrape job with ZERO endpoints. The target
// is not DOWN, it is absent -- up{} has no series at all -- so a panel
// counting healthy targets is green because nothing reported.
// ===================================================================
describe("MUTATION -- a ServiceMonitor that resolves to nothing", () => {
  test("the real tree resolves: the portal ServiceMonitor finds its Service and port", () => {
    const fails = checkServiceMonitorTargets(authoredMonitoringObjects(APPS), authoredServices(APPS));
    expect(fails).toEqual([]);
  });

  test("the control is not vacuous -- the tree really does author a ServiceMonitor and a Service", () => {
    // Guards the rule against passing because it had nothing to look at:
    // an empty object list would make every assertion above trivially true.
    expect(authoredMonitoringObjects(APPS).some((o) => o.kind === "ServiceMonitor")).toBe(true);
    expect(authoredServices(APPS).some((s) => s.name === "portal" && s.portNames.includes("metrics"))).toBe(true);
  });

  test("[1] renaming the Service port leaves the ServiceMonitor scraping a name nothing declares", () => {
    const dir = tempTree();
    const text = readFile(dir, "platform", "portal.yaml").replace(
      "{ name: metrics, port: 8080, targetPort: http }",
      "{ name: http-metrics, port: 8080, targetPort: http }",
    );
    writeFile(dir, "platform", "portal.yaml", text);
    const r = runAudit(appsOf(dir), ROSTER, REPO_ROOT);
    expect(r.failures.join(" ")).toContain("http-metrics");
    expect(r.failures.join(" ")).toContain("zero targets silently");
  });

  test("[2] a selector label no Service carries selects nothing", () => {
    const dir = tempTree();
    const text = readFile(dir, "platform", "monitoring.yaml").replace(
      "matchLabels: { app.kubernetes.io/name: portal }",
      "matchLabels: { app.kubernetes.io/name: portal-typo }",
    );
    writeFile(dir, "platform", "monitoring.yaml", text);
    const r = runAudit(appsOf(dir), ROSTER, REPO_ROOT);
    expect(r.failures.join(" ")).toContain("NO Service authored in this tree matches");
    expect(r.failures.join(" ")).toContain("not even DOWN");
  });

  test("[3] a namespaceSelector naming the wrong namespace selects nothing", () => {
    const dir = tempTree();
    const text = readFile(dir, "platform", "monitoring.yaml").replace(
      "matchNames: [ zeta-platform ]",
      "matchNames: [ zeta-nowhere ]",
    );
    writeFile(dir, "platform", "monitoring.yaml", text);
    const r = runAudit(appsOf(dir), ROSTER, REPO_ROOT);
    expect(r.failures.join(" ")).toContain("zeta-nowhere");
    expect(r.failures.join(" ")).toContain("NO Service authored in this tree matches");
  });

  test("[4] a port NUMBER where a port NAME is required fails -- the classic operator bug", () => {
    const dir = tempTree();
    const text = readFile(dir, "platform", "monitoring.yaml").replace("- port: metrics", "- port: 8080");
    writeFile(dir, "platform", "monitoring.yaml", text);
    const r = runAudit(appsOf(dir), ROSTER, REPO_ROOT);
    expect(r.failures.join(" ")).toContain("numerically");
    expect(r.failures.join(" ")).toContain("must be a Service port NAME");
  });

  test("a ServiceMonitor with no endpoints at all fails", () => {
    const objects = authoredMonitoringObjects(APPS)
      .filter((o) => o.kind === "ServiceMonitor")
      .map((o) => ({ ...o, doc: { ...o.doc, spec: { ...(o.doc.spec as Record<string, unknown>), endpoints: [] } } }));
    const fails = checkServiceMonitorTargets(objects, authoredServices(APPS)).join(" ");
    expect(fails).toContain("declares no endpoints");
  });

  test("matchExpressions-only selectors are NOT silently claimed as verified", () => {
    // The candidate set is computed from matchLabels alone, which is a
    // SUPERSET of the true set (matchExpressions only narrows). So a
    // selector with no matchLabels matches every in-scope Service and this
    // rule makes no claim about it -- an honest incompleteness, asserted
    // here so it cannot later be mistaken for coverage.
    const svc: AuthoredService[] = [
      { app: "x", file: "s.yaml", name: "s", namespace: "n", labels: {}, portNames: ["metrics"] },
    ];
    const obj: MonitoringObject = {
      file: "m.yaml",
      app: "x",
      kind: "ServiceMonitor",
      name: "sm",
      labels: {},
      doc: {
        metadata: { namespace: "n" },
        spec: { selector: { matchExpressions: [{ key: "a", operator: "Exists" }] }, endpoints: [{ port: "metrics" }] },
      },
    };
    expect(checkServiceMonitorTargets([obj], svc)).toEqual([]);
  });
});

describe("MUTATION -- nothing watching Zeta at all", () => {
  test("deleting every authored monitoring object goes red", () => {
    // This is not a synthetic mutation either: it is the state of the repo
    // before 2026-08-20. 35 rule groups, all of them a chart default.
    const dir = tempTree();
    rmSync(appFile(dir, "platform", "monitoring.yaml"));
    const r = runAudit(appsOf(dir), ROSTER, REPO_ROOT);
    expect(r.failures.join(" ")).toContain("no ServiceMonitor / PodMonitor / PrometheusRule is authored");
  });
});

describe("alloyEdges escapes EVERY regex metacharacter, not just `.`", () => {
  // The escaping in alloyEdges had no falsifier until now: reverting it to the
  // original `.replace(/\./g, "\\.")` left the whole suite green, so a CodeQL
  // HIGH ("Incomplete string escaping") was fixed with nothing able to prove the
  // fix mattered or catch its regression. `producer.id` comes out of a Helm
  // valuesObject, so a label carrying a metacharacter is reachable input.
  //
  // The interesting failure is NOT the crash -- it is the FALSE EDGE. This
  // function decides whether a sink has a source, so a pattern that matches text
  // it should not reports a sink as sourced when it is not: precisely the
  // false-green the audit exists to prevent.

  const mk = (kind: string, label: string, body: string) => ({
    kind,
    label,
    id: label === "" ? kind : kind + "." + label,
    body,
  });

  test("a `+` in a label does not quantify into a spurious edge", () => {
    // Under `.`-only escaping the pattern becomes `prometheus\.scrape\.a+\.…`,
    // where `a+` means "one or more a" -- so it matches `…scrape.aaa.receiver`
    // and invents an edge to a producer that is not referenced at all.
    const producer = mk("prometheus.scrape", "a+", "");
    const consumer = mk("prometheus.remote_write", "sink", "forward_to = prometheus.scrape.aaa.receiver");
    const edges = alloyEdges([producer, consumer]);
    expect(edges.filter((e) => e.to === "prometheus.scrape.a+")).toEqual([]);
  });

  test("a literal reference to a metacharacter label IS still found", () => {
    // The guard above must not be satisfied by matching nothing ever: the real
    // reference to the same producer still has to produce its edge.
    const producer = mk("prometheus.scrape", "a+", "");
    const consumer = mk("prometheus.remote_write", "sink", "forward_to = prometheus.scrape.a+.receiver");
    const edges = alloyEdges([producer, consumer]);
    expect(edges).toContainEqual({ from: "prometheus.remote_write.sink", to: "prometheus.scrape.a+" });
  });

  // A third case was written and REMOVED: an unbalanced `[` in a label, asserting
  // `new RegExp` does not throw. It passed under the pre-fix escaping too --
  // `a[` followed by `\.` happens to form a VALID character class -- so it
  // guarded nothing and would have padded the suite with a test that cannot
  // fail. Recorded rather than silently dropped: the crash case is not the
  // reachable defect here; the false edge is.

});
