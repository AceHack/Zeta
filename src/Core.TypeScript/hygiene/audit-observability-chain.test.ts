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
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  DEFAULT_APPS_DIR,
  DEFAULT_ROSTER,
  checkAlertmanager,
  checkAlloyGraph,
  checkEndpoints,
  parseAlloyComponents,
  parseAlloyEndpoints,
  runAudit,
  stripAlloyComments,
  valuesHash,
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
    const r = runAudit(APPS, ROSTER);
    expect(r.failures).toEqual([]);
    expect(r.checked.length).toBe(3);
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
