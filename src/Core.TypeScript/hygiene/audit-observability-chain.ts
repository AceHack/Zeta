#!/usr/bin/env bun
/**
 * src/Core.TypeScript/hygiene/audit-observability-chain.ts
 *
 * Refuses an observability pipeline that LOOKS configured and moves nothing.
 *
 * WHY THIS EXISTS (2026-08-20, Dejan). Three findings landed together, and
 * all three are one class: a values-only change that nothing renders and
 * nothing asserts.
 *
 *   1. Alloy ran as a DaemonSet on every node with three components in its
 *      config -- loki.write, otelcol.exporter.otlp, prometheus.remote_write.
 *      ALL THREE ARE SINKS. Zero sources. Three pipelines with an output and
 *      no input, under a header claiming it shipped logs, metrics and traces.
 *   2. Its Loki sink named http://loki.loki.svc:3100. Rendering the loki
 *      chart in the configured SimpleScalable mode produces loki-backend,
 *      -canary, -gateway, -memberlist, -read, -write and NO Service named
 *      loki. A one-word error nothing in the repo could see.
 *   3. The rendered Alertmanager config had ONE receiver, named null, and
 *      the default route pointed at it. 35 rule groups fired into it.
 *
 * None of the three is a syntax error, a schema violation, or a bad chart
 * pin, so helm template, kubeconform and yamllint are all green on all of
 * them. This audit is the check that is not.
 *
 * EXTENDED 2026-08-20 (Dejan) with the two links the first pass NAMED and did
 * not close. Same class, one layer further out:
 *
 *   4. NOTHING IN ZETA WAS SCRAPED. Zero ServiceMonitors, zero PodMonitors,
 *      zero PrometheusRules authored anywhere in the repo -- all 35 rule
 *      groups were chart defaults watching kubelet, etcd and CoreDNS. No Zeta
 *      workload declared a metrics port or carried a prometheus.io/scrape
 *      annotation, so the annotation path Alloy had just grown had no users.
 *   5. THE VACUOUS ALERT. An alert or dashboard referencing a metric no Zeta
 *      source emits is a check that cannot fire -- it looks like coverage and
 *      constrains nothing. This is the same defect as a sink with no source,
 *      moved from the transport layer to the query layer, and it is the more
 *      valuable half because a rule is what a human trusts at 3am.
 *
 * EXTENDED 2026-08-21 (shadow) with the link BOTH earlier passes left open:
 *
 *   6. THE SERVICEMONITOR ITSELF WAS NEVER FOLLOWED TO A SERVICE. The audit
 *      proved the ruler selects the object (rule 7) and that Argo applies the
 *      file (rule 8), and never asked whether the selector matches a Service or
 *      whether endpoints[].port names a port that Service declares. Measured
 *      before rule 9 existed: four independent ways of severing the portal
 *      scrape -- renaming the Service port, a selector label no Service
 *      carries, the wrong namespace, and a port NUMBER where a port NAME is
 *      required -- each left the audit printing "PASS: 7 invariants hold".
 *      A ServiceMonitor that resolves to nothing yields a scrape job with zero
 *      endpoints, and zero endpoints is not a DOWN target, it is NO target: the
 *      series is absent rather than 0, so a health panel counting up{} stays
 *      green while nothing is collected.
 *
 * Two silent-ignore traps come with them, and both are refused below because
 * both produce an object that applies cleanly and is never evaluated:
 *   - a ServiceMonitor/PrometheusRule missing the release label the chart's
 *     default selector requires;
 *   - a manifest sitting in an Argo Application directory whose `include`
 *     filter does not match it, so Argo never applies the file at all.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export const DEFAULT_APPS_DIR = "full-ai-cluster/k8s/applications";
export const DEFAULT_ROSTER = "full-ai-cluster/k8s/observability-service-roster.json";
export const KUBE_VERSION = "1.31.0";

/**
 * Receiver names that deliver nothing while reading as configuration.
 * An alert terminating in a receiver named "null" and one terminating in
 * "unrouted-REQUIRES-CONFIGURATION" are equally undelivered; only the
 * second tells the next reader the truth. This list refuses the first.
 */
export const SILENT_NOOP_RECEIVERS = ["null", "none", "noop", "no-op", "devnull", "dev-null", "blackhole", "black-hole", "discard", "drop", "sink"];

/** A receiver with no integrations is allowed ONLY if it says so in its name. */
export const DECLARED_UNDELIVERED = /REQUIRES-[A-Z][A-Z0-9-]*/;

/** Alertmanager receiver keys that actually deliver somewhere. */
export const RECEIVER_INTEGRATION_KEYS = ["email_configs", "pagerduty_configs", "slack_configs", "webhook_configs", "opsgenie_configs", "wechat_configs", "pushover_configs", "victorops_configs", "sns_configs", "telegram_configs", "webex_configs", "msteams_configs", "msteamsv2_configs", "discord_configs", "rocketchat_configs", "jira_configs"];

/** Component kinds that terminate a pipeline. Each MUST have an in-edge. */
export function isSinkKind(kind: string): boolean {
  if (kind === "loki.write") return true;
  if (kind === "prometheus.remote_write") return true;
  return kind.startsWith("otelcol.exporter.");
}

// ---- Alloy config parsing -------------------------------------------------

export interface AlloyComponent {
  id: string;
  kind: string;
  label: string;
  body: string;
}

/** Remove // line comments without touching string literals. */
export function stripAlloyComments(src: string): string {
  let out = "";
  let inStr = false;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (inStr) {
      out += c;
      if (c === "\\") { out += src[i + 1] ?? ""; i += 2; continue; }
      if (c === String.fromCharCode(34)) inStr = false;
      i += 1;
      continue;
    }
    if (c === String.fromCharCode(34)) { inStr = true; out += c; i += 1; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i += 1; continue; }
    out += c;
    i += 1;
  }
  return out;
}

/** Top-level components: `kind "label" { ... }` at brace depth 0. */
export function parseAlloyComponents(configRaw: string): AlloyComponent[] {
  const src = stripAlloyComments(configRaw);
  const comps: AlloyComponent[] = [];
  let depth = 0;
  let inStr = false;
  let headerStart = 0;
  let bodyStart = 0;
  let header = "";
  const QUOTE = String.fromCharCode(34);
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") { i += 1; continue; }
      if (c === QUOTE) inStr = false;
      continue;
    }
    if (c === QUOTE) { inStr = true; continue; }
    if (c === "{") {
      if (depth === 0) { header = src.slice(headerStart, i); bodyStart = i + 1; }
      depth += 1;
      continue;
    }
    if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        const body = src.slice(bodyStart, i);
        const m = /([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*)[ \t]*(?:"([^"]*)")?[ \t]*$/.exec(header.trim());
        if (m) { const kind = m[1] ?? ""; const label = m[2] ?? ""; comps.push({ kind, label, id: label === "" ? kind : kind + "." + label, body }); }
        headerStart = i + 1;
      }
    }
  }
  return comps;
}

export interface AlloyEdge { from: string; to: string; }

/** Reference edges: consumer body naming `<producer-id>.<export>`. */
export function alloyEdges(comps: AlloyComponent[]): AlloyEdge[] {
  const edges: AlloyEdge[] = [];
  for (const consumer of comps) {
    for (const producer of comps) {
      if (producer.id === consumer.id) continue;
      if (producer.label === "") continue;
      // Escape EVERY regex metacharacter, not just `.`. CodeQL flagged the
      // original (`replace(/\./g, "\\.")`) as "Incomplete string escaping" and
      // it was right: `producer.id` is parsed out of a Helm valuesObject, so a
      // component label containing `\`, `(`, `[` or `*` built a malformed or
      // silently-misbehaving pattern -- and a reference-edge check that
      // mis-matches reports a sink as sourced when it is not, which is the exact
      // false-green this audit exists to prevent.
      const esc = producer.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(esc + "\\.[a-z][a-z0-9_]*", "g");
      if (re.test(consumer.body)) edges.push({ from: consumer.id, to: producer.id });
    }
  }
  return edges;
}

export interface Endpoint { service: string; namespace: string; port: number; raw: string; }

/** In-cluster DNS targets named anywhere in an Alloy config. */
export function parseAlloyEndpoints(configRaw: string): Endpoint[] {
  const src = stripAlloyComments(configRaw);
  const re = /([a-z0-9][a-z0-9-]*)\.([a-z0-9][a-z0-9-]*)\.svc(?:\.cluster\.local)?:([0-9]+)/g;
  const out: Endpoint[] = [];
  for (const m of src.matchAll(re)) {
    out.push({ service: m[1] ?? "", namespace: m[2] ?? "", port: Number(m[3] ?? "0"), raw: m[0] });
  }
  return out;
}

// ---- Checks ---------------------------------------------------------------

/**
 * Rule 1 -- no ISOLATED component. A labelled component with no in-edge and
 * no out-edge is wired to nothing. Kind-agnostic on purpose: it caught all
 * three original sinks without a roster of sink names to keep current.
 *
 * Rule 2 -- every SINK has an in-edge. Sharper than rule 1 and stated
 * separately so the failure message names the actual defect.
 */
export function checkAlloyGraph(configRaw: string): string[] {
  const comps = parseAlloyComponents(configRaw).filter((c) => c.label !== "");
  const edges = alloyEdges(comps);
  const fails: string[] = [];
  if (comps.length === 0) return ["alloy: config declares no labelled components at all"];
  const outDeg = new Map<string, number>();
  const inDeg = new Map<string, number>();
  for (const c of comps) { outDeg.set(c.id, 0); inDeg.set(c.id, 0); }
  for (const e of edges) {
    outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }
  for (const c of comps) {
    const din = inDeg.get(c.id) ?? 0;
    const dout = outDeg.get(c.id) ?? 0;
    // Sinks first, and NOT guarded on out-degree. A pure sink with no source
    // is also isolated, so guarding this branch behind the isolation branch
    // made it unreachable -- the mutation suite caught exactly that on
    // 2026-08-20 and this ordering is the fix. Naming the defect precisely
    // is the whole value: ISOLATED says wired to nothing, NO SOURCE says
    // this thing was built to ship data and nothing feeds it.
    if (isSinkKind(c.kind)) {
      if (din === 0) fails.push("alloy: sink " + c.id + " has NO SOURCE -- a pipeline with an output and no input moves zero bytes");
      continue;
    }
    if (din === 0 && dout === 0) {
      fails.push("alloy: component " + c.id + " is ISOLATED -- nothing forwards to it and it forwards to nothing");
    }
  }
  return fails;
}

export interface RosterApp {
  namespace: string;
  chart: string;
  repoURL: string;
  version: string;
  valuesHash: string;
  services: Record<string, number[]>;
}
export interface Roster { $comment?: string[]; kubeVersion: string; apps: Record<string, RosterApp>; }

export const ROSTER_PROVENANCE = [
  "DERIVED FILE -- regenerate with:",
  "  bun src/Core.TypeScript/hygiene/audit-observability-chain.ts --refresh",
  "",
  "The rendered Service surface of every chart an Alloy sink points at. It",
  "exists because the bug that motivated it -- an Alloy sink naming Service",
  "loki at :3100, which the loki chart does not render in SimpleScalable mode",
  "-- is invisible to helm template, kubeconform and yamllint. All three were",
  "green on it.",
  "",
  "valuesHash is the freshness key: chart + repo + version + releaseName +",
  "the whole valuesObject of the target Application. Change any of them",
  "without re-running --refresh and the audit fails as STALE rather than",
  "asserting a render that no longer happens. That is what keeps this a",
  "DERIVED fact rather than a hand-written allowlist that drifts.",
  "",
  "Service names and ports only. No credential material.",
];

/** Stable hash of everything that can change what a chart renders. */
export function valuesHash(app: Record<string, unknown>): string {
  const src = (app.spec as Record<string, unknown>).source as Record<string, unknown>;
  const helm = (src.helm ?? {}) as Record<string, unknown>;
  const payload = stringifyYaml({
    chart: src.chart,
    repoURL: src.repoURL,
    targetRevision: String(src.targetRevision),
    releaseName: helm.releaseName,
    values: helm.valuesObject ?? {},
  }, { sortMapEntries: true });
  return "sha256:" + createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Rule 3 -- every endpoint an Alloy sink names must resolve to a Service the
 * TARGET chart actually renders, at that port.
 *
 * The roster is DERIVED (regenerate with --refresh, which runs helm template)
 * and FRESHNESS-KEYED: each entry carries the hash of the target Application
 * that produced it, so bumping a chart version or flipping deploymentMode
 * without refreshing fails as STALE rather than silently asserting the old
 * render. That is what keeps this hermetic without becoming a hand-written
 * allowlist that drifts away from what helm does.
 */
export function checkEndpoints(endpoints: Endpoint[], roster: Roster, appHashes: Map<string, string>): string[] {
  const fails: string[] = [];
  const byNamespace = new Map<string, [string, RosterApp]>();
  for (const [name, entry] of Object.entries(roster.apps)) byNamespace.set(entry.namespace, [name, entry]);
  for (const ep of endpoints) {
    const hit = byNamespace.get(ep.namespace);
    if (!hit) {
      fails.push("alloy: endpoint " + ep.raw + " names namespace " + ep.namespace + " which no rostered application owns (run --refresh)");
      continue;
    }
    const [appName, entry] = hit;
    const live = appHashes.get(appName);
    if (live !== undefined && live !== entry.valuesHash) {
      fails.push("roster: entry for " + appName + " is STALE -- its Application changed since the roster was rendered (run --refresh)");
      continue;
    }
    const ports = entry.services[ep.service];
    if (ports === undefined) {
      const have = Object.keys(entry.services).sort().join(", ");
      fails.push("alloy: endpoint " + ep.raw + " names Service " + ep.service + " which the " + appName + " chart does not render. It renders: " + have);
      continue;
    }
    if (!ports.includes(ep.port)) {
      fails.push("alloy: endpoint " + ep.raw + " names port " + String(ep.port) + " but Service " + ep.service + " exposes " + ports.join(", "));
    }
  }
  return fails;
}

/**
 * Rule 4 -- alerting must not terminate silently.
 *
 * The chart default is the failure: one receiver named null, default route
 * pointed at it. So an ABSENT alertmanager.config is a failure, not a
 * default -- there is no such thing as declining to decide here.
 */
export function checkAlertmanager(values: Record<string, unknown> | undefined): string[] {
  const fails: string[] = [];
  const am = (values?.alertmanager ?? undefined) as Record<string, unknown> | undefined;
  const cfg = (am?.config ?? undefined) as Record<string, unknown> | undefined;
  if (cfg === undefined) {
    return ["alertmanager: no explicit alertmanager.config -- the chart default routes EVERY alert to a receiver named null"];
  }
  const route = (cfg.route ?? undefined) as Record<string, unknown> | undefined;
  const receivers = (cfg.receivers ?? []) as Record<string, unknown>[];
  if (route === undefined) return ["alertmanager: alertmanager.config has no route"];
  const names = new Set(receivers.map((r) => String(r.name)));
  const used: string[] = [];
  const walk = (r: Record<string, unknown>): void => {
    if (typeof r.receiver === "string") used.push(r.receiver);
    for (const child of (r.routes ?? []) as Record<string, unknown>[]) walk(child);
  };
  walk(route);
  const dflt = String(route.receiver ?? "");
  if (dflt === "") fails.push("alertmanager: default route names no receiver");
  if (SILENT_NOOP_RECEIVERS.includes(dflt.toLowerCase())) {
    fails.push("alertmanager: default route targets receiver " + JSON.stringify(dflt) + " -- a silent no-op name. Undelivered is allowed; PRETENDING to be routed is not. Rename it to say so (…-REQUIRES-CONFIGURATION) or give it an integration.");
  }
  for (const name of used) {
    if (!names.has(name)) fails.push("alertmanager: route targets receiver " + JSON.stringify(name) + " which is not defined");
  }
  for (const r of receivers) {
    const name = String(r.name);
    const wired = RECEIVER_INTEGRATION_KEYS.some((k) => Array.isArray(r[k]) && (r[k] as unknown[]).length > 0);
    const declares = DECLARED_UNDELIVERED.test(name);
    if (!wired && !declares) {
      fails.push("alertmanager: receiver " + JSON.stringify(name) + " has no integration and does not say so in its name (…-REQUIRES-CONFIGURATION)");
    }
    if (wired && declares) {
      fails.push("alertmanager: receiver " + JSON.stringify(name) + " HAS an integration but is still named REQUIRES- -- the name now lies the other way; drop the suffix");
    }
  }
  return fails;
}

// ---- Scrape opt-in + non-vacuous alerting ---------------------------------

/** Where the metric names Zeta actually emits are DECLARED, not guessed. */
/**
 * Image prefixes that mark a workload as OURS.
 *
 * The reverse scrape check (a metrics port nobody collects) applies only to
 * workloads running images this project builds. Vendored third-party operator
 * manifests -- cdi, kubevirt -- also declare metrics ports, and the right fix
 * there is the ServiceMonitor their own chart ships, not an annotation we add
 * by hand to a file we re-vendor from upstream. Demanding one would trade a
 * real check for permanent upstream drift.
 */
export const ZETA_IMAGE_PREFIXES = ["ghcr.io/lucent-financial-group/"];
export const PORTAL_METRICS_SOURCE = "full-ai-cluster/portal/src/metrics.ts";
export const DOTNET_METRICS_SOURCE = "src/Core/Metrics.fs";

/**
 * Series every scrape produces by construction, regardless of what the target
 * exposes. Allowed in an authored rule because they are not claims about an
 * emitter -- they are facts about the scrape itself. Deliberately tiny: this
 * list is the one place the audit could turn into a drifting allowlist, so it
 * carries only series Prometheus synthesises and nothing a workload emits.
 */
export const SCRAPE_SYNTHETIC_SERIES = ["up", "scrape_duration_seconds", "scrape_samples_scraped", "scrape_samples_post_metric_relabeling", "scrape_series_added"];

/** PromQL words that are syntax, not series. */
export const PROMQL_KEYWORDS = ["by", "without", "on", "ignoring", "group_left", "group_right", "offset", "bool", "and", "or", "unless", "start", "end", "inf", "nan"];

export interface MonitoringObject {
  file: string;
  app: string;
  kind: string;
  name: string;
  labels: Record<string, string>;
  doc: Record<string, unknown>;
}

/** Read every non-Application YAML doc under an application directory. */
export function readAuthoredDocs(appsDir: string): { file: string; app: string; doc: Record<string, unknown> }[] {
  const out: { file: string; app: string; doc: Record<string, unknown> }[] = [];
  for (const app of readdirSync(appsDir).sort()) {
    const dir = join(appsDir, app);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries.sort()) {
      if (!entry.endsWith(".yaml") && !entry.endsWith(".yml")) continue;
      if (entry === "Application.yaml") continue;
      const p = join(dir, entry);
      let text: string;
      try {
        text = readFileSync(p, "utf8");
      } catch {
        continue;
      }
      for (const chunk of text.split(/^---$/m)) {
        if (chunk.trim() === "") continue;
        let doc: unknown;
        try {
          doc = parseYaml(chunk);
        } catch {
          continue;
        }
        if (doc === null || typeof doc !== "object") continue;
        out.push({ file: entry, app, doc: doc as Record<string, unknown> });
      }
    }
  }
  return out;
}

/** The monitoring objects THIS repo authors (never the ones a chart renders). */
export function authoredMonitoringObjects(appsDir: string): MonitoringObject[] {
  const kinds = new Set(["ServiceMonitor", "PodMonitor", "PrometheusRule"]);
  const out: MonitoringObject[] = [];
  for (const { file, app, doc } of readAuthoredDocs(appsDir)) {
    const kind = String(doc.kind ?? "");
    if (!kinds.has(kind)) continue;
    const md = (doc.metadata ?? {}) as Record<string, unknown>;
    out.push({
      file,
      app,
      kind,
      name: String(md.name ?? "<unnamed>"),
      labels: ((md.labels ?? {}) as Record<string, string>),
      doc,
    });
  }
  return out;
}
export interface EmitterRoster {
  /** Exact names a Zeta process exposes in Prometheus exposition format. */
  exact: string[];
  /**
   * Prefixes from the .NET meter. The OTel Prometheus exporter appends unit
   * and _total suffixes whose exact spelling depends on the collector version,
   * so the instrument name is matched as a PREFIX rather than pretending to
   * model a normalisation this audit cannot verify. Refusing dbsp_frobnicate
   * is the value; guessing dbsp_ticks_tick_total is not.
   */
  prefixes: string[];
}

/**
 * Build the roster of metrics Zeta actually emits, FROM THE SOURCE that emits
 * them. A missing source file is a failure, never an empty roster: an empty
 * roster would make the vacuity check itself vacuous.
 */
export function zetaEmitterRoster(repoRoot: string): { roster: EmitterRoster; failures: string[] } {
  const failures: string[] = [];
  const exact: string[] = [];
  const prefixes: string[] = [];

  const portalPath = join(repoRoot, PORTAL_METRICS_SOURCE);
  if (!existsSync(portalPath)) {
    failures.push("emitters: " + PORTAL_METRICS_SOURCE + " is missing -- the metric roster cannot be derived, so every alert would pass unchecked");
  } else {
    const src = readFileSync(portalPath, "utf8");
    const m = /EMITTED_METRICS\s*=\s*\[([\s\S]*?)\]/.exec(src);
    if (m === null) {
      failures.push("emitters: " + PORTAL_METRICS_SOURCE + " no longer declares EMITTED_METRICS -- the roster is derived from that array");
    } else {
      for (const lit of (m[1] ?? "").matchAll(/"([a-zA-Z_:][a-zA-Z0-9_:]*)"/g)) exact.push(lit[1] ?? "");
      if (exact.length === 0) failures.push("emitters: EMITTED_METRICS is empty -- an empty roster makes the alert check vacuous");
    }
  }

  const dotnetPath = join(repoRoot, DOTNET_METRICS_SOURCE);
  if (!existsSync(dotnetPath)) {
    failures.push("emitters: " + DOTNET_METRICS_SOURCE + " is missing");
  } else {
    const src = readFileSync(dotnetPath, "utf8");
    for (const m of src.matchAll(/Create(?:Counter|UpDownCounter|Histogram|ObservableGauge|ObservableCounter)<[^>]*>\(\s*"([^"]+)"/g)) {
      prefixes.push((m[1] ?? "").split(".").join("_"));
    }
    if (prefixes.length === 0) failures.push("emitters: " + DOTNET_METRICS_SOURCE + " declares no instruments -- the meter that motivated the OTLP exporter is gone");
  }

  return { roster: { exact, prefixes }, failures };
}
/** Metric identifiers referenced by a PromQL expression. */
export function promqlMetricNames(expr: string): string[] {
  // Strip label matchers, RANGE SELECTORS and string literals first: a label
  // NAME is not a series, a matcher VALUE certainly is not, and the h in [1h]
  // is a duration unit that read as a metric named h on the first run.
  const stripped = expr
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\b(?:by|without|on|ignoring|group_left|group_right)\s*\([^()]*\)/g, " ")
    .replace(/"[^"]*"/g, " ")
    .replace(new RegExp(String.fromCharCode(39) + "[^" + String.fromCharCode(39) + "]*" + String.fromCharCode(39), "g"), " ");
  const keywords = new Set(PROMQL_KEYWORDS);
  const out = new Set<string>();
  for (const m of stripped.matchAll(/([a-zA-Z_:][a-zA-Z0-9_:]*)\s*(\(?)/g)) {
    const name = m[1] ?? "";
    // A name immediately followed by ( is a FUNCTION call, not a series.
    if ((m[2] ?? "") === "(") continue;
    if (keywords.has(name.toLowerCase())) continue;
    out.add(name);
  }
  return [...out].sort();
}

export function isEmittedMetric(name: string, roster: EmitterRoster): boolean {
  if (roster.exact.includes(name)) return true;
  if (SCRAPE_SYNTHETIC_SERIES.includes(name)) return true;
  return roster.prefixes.some((p) => name === p || name.startsWith(p + "_"));
}
/**
 * Rule 5 -- scrape opt-in must be COHERENT with what the pod serves.
 *
 * Two directions, because both halves lie:
 *   - annotated but the annotated port is not a declared containerPort: the
 *     scrape 404s or connects to nothing, the target reads DOWN, and the
 *     manifest reads as instrumented;
 *   - a container port literally named "metrics" with no scrape annotation:
 *     an endpoint built, deployed, and read by nobody. That is the same
 *     finding as a sink with no source, pointed the other way.
 */
export function checkScrapeOptIn(docs: { file: string; app: string; doc: Record<string, unknown> }[]): string[] {
  const fails: string[] = [];
  for (const { file, app, doc } of docs) {
    const kind = String(doc.kind ?? "");
    if (kind !== "Deployment" && kind !== "StatefulSet" && kind !== "DaemonSet") continue;
    const spec = (doc.spec ?? {}) as Record<string, unknown>;
    const template = (spec.template ?? {}) as Record<string, unknown>;
    const meta = (template.metadata ?? {}) as Record<string, unknown>;
    const annotations = ((meta.annotations ?? {}) as Record<string, unknown>);
    const podSpec = (template.spec ?? {}) as Record<string, unknown>;
    const containers = ((podSpec.containers ?? []) as Record<string, unknown>[]);

    const declared: { name: string; port: number }[] = [];
    for (const c of containers) {
      for (const p of ((c.ports ?? []) as Record<string, unknown>[])) {
        declared.push({ name: String(p.name ?? ""), port: Number(p.containerPort ?? 0) });
      }
    }

    const where = app + "/" + file + " " + kind + " " + String(((doc.metadata ?? {}) as Record<string, unknown>).name ?? "");
    const scrape = String(annotations["prometheus.io/scrape"] ?? "");

    if (scrape === "true") {
      const wanted = Number(annotations["prometheus.io/port"] ?? 0);
      if (wanted === 0) {
        fails.push("scrape: " + where + " is annotated prometheus.io/scrape=true with no prometheus.io/port -- the scraper has no address to try");
      } else if (!declared.some((d) => d.port === wanted)) {
        const have = declared.map((d) => String(d.port)).join(", ");
        fails.push("scrape: " + where + " is annotated for port " + String(wanted) + " but declares containerPort(s) " + (have === "" ? "<none>" : have) + " -- an annotated pod that serves nothing reads as instrumented and shows DOWN");
      }
    } else if (declared.some((d) => d.name === "metrics") && containers.some((c) => ZETA_IMAGE_PREFIXES.some((p) => String(c.image ?? "").startsWith(p)))) {
      fails.push("scrape: " + where + " declares a container port named metrics and carries no prometheus.io/scrape annotation -- an exposition endpoint nothing collects is a sink with no source, inverted");
    }
  }
  return fails;
}
/**
 * Rule 6 -- an authored alert must reference a metric something EMITS.
 *
 * The valuable half. A PrometheusRule naming a series no Zeta source produces
 * never fires and never resolves; it renders as coverage on a dashboard and
 * constrains nothing, which is the vacuity class this whole audit chases. The
 * roster is DERIVED from the emitting sources (EMITTED_METRICS in the portal,
 * the meter instruments in Metrics.fs), so deleting an emitter turns its alerts
 * red rather than leaving them quietly unfirable.
 *
 * Scoped to rules WE author. Chart-shipped rules watch software we do not
 * emit for and are none of this audit business.
 */
export function checkAuthoredRules(objects: MonitoringObject[], roster: EmitterRoster): string[] {
  const fails: string[] = [];
  for (const obj of objects) {
    if (obj.kind !== "PrometheusRule") continue;
    const spec = (obj.doc.spec ?? {}) as Record<string, unknown>;
    const groups = ((spec.groups ?? []) as Record<string, unknown>[]);
    if (groups.length === 0) {
      fails.push("alerting: PrometheusRule " + obj.name + " declares no groups");
      continue;
    }
    for (const g of groups) {
      for (const rule of ((g.rules ?? []) as Record<string, unknown>[])) {
        const label = String(rule.alert ?? rule.record ?? "<unnamed>");
        const expr = String(rule.expr ?? "");
        if (expr.trim() === "") {
          fails.push("alerting: rule " + label + " in " + obj.name + " has an empty expr");
          continue;
        }
        const referenced = promqlMetricNames(expr);
        if (referenced.length === 0) {
          fails.push("alerting: rule " + label + " in " + obj.name + " references no metric at all");
          continue;
        }
        for (const metric of referenced) {
          if (!isEmittedMetric(metric, roster)) {
            fails.push("alerting: rule " + label + " in " + obj.name + " references metric " + metric + " which NO Zeta source emits -- an alert on a series nothing produces can never fire. Emitters are declared in " + PORTAL_METRICS_SOURCE + " (EMITTED_METRICS) and " + DOTNET_METRICS_SOURCE + ".");
          }
        }
      }
    }
  }
  return fails;
}

/**
 * Rule 7 -- a monitoring object the ruler never selects is not applied, it is
 * IGNORED.
 *
 * kube-prometheus-stack defaults serviceMonitorSelectorNilUsesHelmValues and
 * ruleSelectorNilUsesHelmValues to true, so the Prometheus CR selects only
 * objects labelled release=<helm release name>. Without that label the object
 * applies cleanly, appears in kubectl get, and is never evaluated -- silent,
 * and indistinguishable from working until an incident. The expected value is
 * DERIVED from the Application helm.releaseName so renaming the release breaks
 * loudly here instead of quietly in the cluster.
 */
export function checkMonitoringSelectorLabel(objects: MonitoringObject[], releaseName: string): string[] {
  const fails: string[] = [];
  for (const obj of objects) {
    const got = obj.labels["release"] ?? "";
    if (got === releaseName) continue;
    const detail = got === "" ? "carries no release label" : "carries release=" + got;
    fails.push("selector: " + obj.kind + " " + obj.name + " (" + obj.app + "/" + obj.file + ") " + detail + " but the Prometheus CR selects release=" + releaseName + " -- it would be applied and never evaluated");
  }
  return fails;
}
/**
 * Rule 8 -- Argo must actually APPLY the file.
 *
 * Several Applications in this tree use a directory source with an explicit
 * include glob. A manifest added to such a directory and left out of the glob
 * is committed, reviewed, merged -- and never applied to anything. The file
 * exists, the alert does not. Checked for monitoring objects specifically,
 * because those are the ones whose absence is invisible by construction.
 */
export function checkIncludedByApplication(appsDir: string, objects: MonitoringObject[]): string[] {
  const fails: string[] = [];
  const seen = new Set<string>();
  for (const obj of objects) {
    const key = obj.app + "/" + obj.file;
    if (seen.has(key)) continue;
    seen.add(key);
    const app = readApplication(appsDir, obj.app);
    if (app === undefined) continue;
    const src = ((app.spec as Record<string, unknown>).source ?? {}) as Record<string, unknown>;
    const directory = (src.directory ?? undefined) as Record<string, unknown> | undefined;
    const include = directory === undefined ? undefined : directory.include;
    if (typeof include !== "string") continue;
    const stem = obj.file.replace(/\.(yaml|yml)$/, "");
    const inner = /\{([^}]*)\}/.exec(include);
    const names = inner === null ? [include.replace(/\.(yaml|yml)$/, "")] : (inner[1] ?? "").split(",").map((x) => x.trim());
    if (!names.includes(stem) && !include.includes("*")) {
      fails.push("argo: " + obj.app + "/" + obj.file + " holds a " + obj.kind + " but the " + obj.app + " Application include filter does not match it -- Argo never applies the file, so the object exists only in git");
    }
  }
  return fails;
}
/**
 * Rule 9 -- a ServiceMonitor must actually RESOLVE to a Service, at a port
 * name that Service declares.
 *
 * WHY THIS IS THE SHARPEST REMAINING CASE. A ServiceMonitor IS a scrape
 * target -- the literal subject of this file's opening sentence -- and until
 * now it was the one link nothing checked. Rule 7 proves the ruler SELECTS
 * the object; rule 8 proves Argo APPLIES the file. Neither asks the only
 * question that decides whether a single byte moves: does the selector match a
 * Service, and does `endpoints[].port` name a port that Service declares?
 *
 * `endpoints[].port` is a **Service port name**, not a container port name and
 * not a number. Get it wrong and prometheus-operator emits a scrape job whose
 * endpoint role selects zero addresses. The result is worse than a broken
 * target: the job does not appear as DOWN on the targets page, it does not
 * appear AT ALL -- so `up` is not 0, it is absent, and a dashboard counting
 * healthy targets stays green. That is this repo's defining failure mode --
 * green meaning "nothing reported" -- at the one layer that had no guard.
 *
 * Measured on 2026-08-21 before this rule existed: renaming the portal Service
 * port `metrics` -> `http-metrics`, pointing the selector at a label no Service
 * carries, naming a namespace the Service is not in, and replacing the port
 * name with the number 8080 ALL left the audit reporting "PASS: 7 invariants
 * hold". Four ways to sever the scrape, zero of them visible.
 *
 * SOUNDNESS. Candidate Services are matched on `selector.matchLabels` only.
 * `matchExpressions` can merely NARROW the matched set, so the candidate set
 * computed here is a superset of the true one -- which makes every failure
 * below a real failure (no false positives) while leaving the rule incomplete
 * against selectors that rely on matchExpressions alone.
 *
 * SCOPE, and it is the same scope `checkScrapeOptIn` already uses: a
 * ServiceMonitor authored HERE must target a Service authored HERE. A
 * chart-rendered workload's ServiceMonitor is that chart's job to ship, and
 * the roster carries port NUMBERS only, so it cannot answer a port-NAME
 * question. Named limits, not silent ones: PodMonitor is not modelled (the
 * tree authors none, and an unexercised branch is the vacuity this audit
 * exists to refuse), and an endpoint selecting by `targetPort` rather than
 * `port` is left unjudged rather than guessed at.
 */
export interface AuthoredService {
  app: string;
  file: string;
  name: string;
  namespace: string;
  labels: Record<string, string>;
  portNames: string[];
}

/** Every Service THIS repo authors (never one a chart renders). */
export function authoredServices(appsDir: string): AuthoredService[] {
  const out: AuthoredService[] = [];
  for (const { file, app, doc } of readAuthoredDocs(appsDir)) {
    if (String(doc.kind ?? "") !== "Service") continue;
    const md = (doc.metadata ?? {}) as Record<string, unknown>;
    const spec = (doc.spec ?? {}) as Record<string, unknown>;
    out.push({
      app,
      file,
      name: String(md.name ?? "<unnamed>"),
      namespace: String(md.namespace ?? ""),
      labels: ((md.labels ?? {}) as Record<string, string>),
      portNames: ((spec.ports ?? []) as Record<string, unknown>[]).map((p) => String(p.name ?? "")),
    });
  }
  return out;
}

export function checkServiceMonitorTargets(objects: MonitoringObject[], services: AuthoredService[]): string[] {
  const fails: string[] = [];
  for (const obj of objects) {
    if (obj.kind !== "ServiceMonitor") continue;
    const spec = (obj.doc.spec ?? {}) as Record<string, unknown>;
    const md = (obj.doc.metadata ?? {}) as Record<string, unknown>;
    const where = obj.kind + " " + obj.name + " (" + obj.app + "/" + obj.file + ")";

    const selector = (spec.selector ?? {}) as Record<string, unknown>;
    const matchLabels = ((selector.matchLabels ?? {}) as Record<string, string>);

    const nsSel = (spec.namespaceSelector ?? undefined) as Record<string, unknown> | undefined;
    const anyNs = nsSel?.any === true;
    const nsNames = ((nsSel?.matchNames ?? []) as string[]).map((n) => String(n));
    const scoped = anyNs ? [] : (nsNames.length > 0 ? nsNames : [String(md.namespace ?? "")]);

    const inScope = (s: AuthoredService): boolean => anyNs || scoped.includes(s.namespace);
    const labelled = (s: AuthoredService): boolean =>
      Object.entries(matchLabels).every(([k, v]) => s.labels[k] === String(v));

    const candidates = services.filter((s) => inScope(s) && labelled(s));
    if (candidates.length === 0) {
      const sel = Object.entries(matchLabels).map(([k, v]) => k + "=" + String(v)).join(",");
      const nsWhere = anyNs ? "any namespace" : "namespace(s) " + scoped.join(", ");
      fails.push(
        "servicemonitor: " + where + " selects " + (sel === "" ? "<no labels>" : sel) + " in " + nsWhere +
        " but NO Service authored in this tree matches -- prometheus-operator builds a scrape job with zero endpoints, which never appears on the targets page at all (not even DOWN), so nothing reports and nothing looks wrong",
      );
      continue;
    }

    const endpoints = ((spec.endpoints ?? []) as Record<string, unknown>[]);
    if (endpoints.length === 0) {
      fails.push("servicemonitor: " + where + " declares no endpoints -- it selects a Service and scrapes nothing from it");
      continue;
    }
    const available = [...new Set(candidates.flatMap((s) => s.portNames))].filter((n) => n !== "").sort();
    for (const ep of endpoints) {
      const port = ep.port;
      if (typeof port === "number") {
        fails.push(
          "servicemonitor: " + where + " endpoint names port " + String(port) +
          " numerically, but endpoints[].port must be a Service port NAME. The operator matches names, finds none, and generates zero targets. Available name(s): " + (available.join(", ") || "<none>"),
        );
        continue;
      }
      if (typeof port !== "string" || port === "") {
        if (ep.targetPort === undefined) {
          fails.push("servicemonitor: " + where + " has an endpoint with neither port nor targetPort -- the scraper has no address to try");
        }
        continue;
      }
      if (!available.includes(port)) {
        fails.push(
          "servicemonitor: " + where + " scrapes port " + JSON.stringify(port) +
          " but the Service(s) it selects (" + candidates.map((s) => s.namespace + "/" + s.name).join(", ") +
          ") declare port name(s) " + (available.join(", ") || "<none>") +
          " -- a ServiceMonitor naming a port its Service does not declare produces zero targets silently",
        );
      }
    }
  }
  return fails;
}
// ---- Tree wiring ----------------------------------------------------------

export function readApplication(appsDir: string, app: string): Record<string, unknown> | undefined {
  const p = join(appsDir, app, "Application.yaml");
  if (!existsSync(p)) return undefined;
  return parseYaml(readFileSync(p, "utf8"), { uniqueKeys: true }) as Record<string, unknown>;
}

export function helmValues(app: Record<string, unknown>): Record<string, unknown> {
  const src = (app.spec as Record<string, unknown>).source as Record<string, unknown>;
  const helm = (src.helm ?? {}) as Record<string, unknown>;
  return (helm.valuesObject ?? {}) as Record<string, unknown>;
}

export function alloyConfig(app: Record<string, unknown>): string | undefined {
  const v = helmValues(app);
  const alloy = (v.alloy ?? undefined) as Record<string, unknown> | undefined;
  const cm = (alloy?.configMap ?? undefined) as Record<string, unknown> | undefined;
  const content = cm?.content;
  return typeof content === "string" ? content : undefined;
}

export interface AuditResult { failures: string[]; checked: string[]; }

export function runAudit(appsDir: string, rosterPath: string, repoRoot: string = "."): AuditResult {
  const failures: string[] = [];
  const checked: string[] = [];

  const alloyApp = readApplication(appsDir, "alloy");
  if (alloyApp === undefined) {
    failures.push("alloy: no Application.yaml under " + appsDir);
    return { failures, checked };
  }
  const cfg = alloyConfig(alloyApp);
  if (cfg === undefined) {
    failures.push("alloy: Application declares no alloy.configMap.content");
    return { failures, checked };
  }
  checked.push("alloy: pipeline graph (every sink has a source)");
  failures.push(...checkAlloyGraph(cfg));

  if (!existsSync(rosterPath)) {
    failures.push("roster: " + rosterPath + " is missing -- run --refresh (needs helm)");
  } else {
    const roster = JSON.parse(readFileSync(rosterPath, "utf8")) as Roster;
    const hashes = new Map<string, string>();
    for (const name of Object.keys(roster.apps)) {
      const a = readApplication(appsDir, name);
      if (a === undefined) {
        failures.push("roster: names application " + name + " which does not exist under " + appsDir);
        continue;
      }
      hashes.set(name, valuesHash(a));
    }
    checked.push("alloy: every endpoint resolves to a Service the target chart renders");
    failures.push(...checkEndpoints(parseAlloyEndpoints(cfg), roster, hashes));
  }

  const kps = readApplication(appsDir, "kube-prometheus-stack");
  if (kps === undefined) {
    failures.push("alertmanager: no kube-prometheus-stack Application.yaml under " + appsDir);
  } else {
    checked.push("alertmanager: alerts do not terminate in a silent no-op receiver");
    failures.push(...checkAlertmanager(helmValues(kps)));
  }

  // ---- the scrape half -----------------------------------------------------

  const authoredDocs = readAuthoredDocs(appsDir);
  checked.push("scrape: scrape annotations and declared metrics ports agree");
  failures.push(...checkScrapeOptIn(authoredDocs));

  const monitoring = authoredMonitoringObjects(appsDir);
  if (monitoring.length === 0) {
    // NOT a soft warning. A tree with no authored monitoring object is a tree
    // where every alert belongs to somebody else, which is where this repo was
    // on 2026-08-20: 35 rule groups, all chart defaults, none of them ours.
    failures.push("scrape: no ServiceMonitor / PodMonitor / PrometheusRule is authored anywhere under " + appsDir + " -- every alert in the cluster then belongs to a chart and nothing watches Zeta");
  } else {
    const { roster, failures: rosterFailures } = zetaEmitterRoster(repoRoot);
    failures.push(...rosterFailures);
    checked.push("alerting: every authored rule references a metric a Zeta source emits");
    failures.push(...checkAuthoredRules(monitoring, roster));

    if (kps !== undefined) {
      const src = (kps.spec as Record<string, unknown>).source as Record<string, unknown>;
      const helm = (src.helm ?? {}) as Record<string, unknown>;
      const releaseName = String(helm.releaseName ?? "kube-prometheus-stack");
      checked.push("alerting: authored monitoring objects carry the release label the ruler selects on");
      failures.push(...checkMonitoringSelectorLabel(monitoring, releaseName));
    }

    checked.push("argo: authored monitoring manifests are inside their Application include filter");
    failures.push(...checkIncludedByApplication(appsDir, monitoring));

    checked.push("servicemonitor: every authored ServiceMonitor resolves to a Service at a port name it declares");
    failures.push(...checkServiceMonitorTargets(monitoring, authoredServices(appsDir)));
  }

  return { failures, checked };
}

// ---- --refresh: regenerate the roster from helm ---------------------------

export function renderServices(app: Record<string, unknown>, appName: string): Record<string, number[]> {
  const src = (app.spec as Record<string, unknown>).source as Record<string, unknown>;
  const helm = (src.helm ?? {}) as Record<string, unknown>;
  const ns = String(((app.spec as Record<string, unknown>).destination as Record<string, unknown>).namespace);
  const valuesFile = join(process.env.TMPDIR ?? "/tmp", "obs-chain-" + appName + "-values.yaml");
  writeFileSync(valuesFile, stringifyYaml(helm.valuesObject ?? {}));
  const argv = ["helm", "template", String(helm.releaseName ?? appName), String(src.chart)];
  argv.push("--repo", String(src.repoURL), "--version", String(src.targetRevision));
  argv.push("--namespace", ns, "--kube-version", KUBE_VERSION, "--values", valuesFile);
  const r = Bun.spawnSync(argv, { stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error("helm template " + appName + " failed: " + r.stderr.toString().split("\n").slice(0, 3).join(" "));
  const out: Record<string, number[]> = {};
  for (const chunk of r.stdout.toString().split("\n---")) {
    const doc = parseYaml(chunk) as Record<string, unknown> | null;
    if (doc === null || doc.kind !== "Service") continue;
    const md = doc.metadata as Record<string, unknown>;
    const spec = (doc.spec ?? {}) as Record<string, unknown>;
    const ports = ((spec.ports ?? []) as Record<string, unknown>[]).map((p) => Number(p.port));
    out[String(md.name)] = ports;
  }
  return out;
}

export function refreshRoster(appsDir: string, rosterPath: string, appNames: string[]): Roster {
  const apps: Record<string, RosterApp> = {};
  for (const name of appNames.slice().sort()) {
    const a = readApplication(appsDir, name);
    if (a === undefined) throw new Error("cannot refresh: no Application for " + name);
    const src = (a.spec as Record<string, unknown>).source as Record<string, unknown>;
    apps[name] = {
      namespace: String(((a.spec as Record<string, unknown>).destination as Record<string, unknown>).namespace),
      chart: String(src.chart),
      repoURL: String(src.repoURL),
      version: String(src.targetRevision),
      valuesHash: valuesHash(a),
      services: renderServices(a, name),
    };
  }
  const roster: Roster = { $comment: ROSTER_PROVENANCE, kubeVersion: KUBE_VERSION, apps };
  writeFileSync(rosterPath, JSON.stringify(roster, null, 2) + "\n");
  return roster;
}

// ---- CLI ------------------------------------------------------------------

export function main(argv: string[]): number {
  let appsDir = DEFAULT_APPS_DIR;
  let rosterPath = DEFAULT_ROSTER;
  // Where the EMITTING sources live (portal metrics.ts, Core/Metrics.fs).
  let repoRoot = ".";
  let refresh = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--apps-dir") { appsDir = argv[i + 1] ?? appsDir; i += 1; continue; }
    if (argv[i] === "--roster") { rosterPath = argv[i + 1] ?? rosterPath; i += 1; continue; }
    if (argv[i] === "--repo-root") { repoRoot = argv[i + 1] ?? repoRoot; i += 1; continue; }
    if (argv[i] === "--refresh") { refresh = true; continue; }
  }
  if (refresh) {
    const alloyApp = readApplication(appsDir, "alloy");
    if (alloyApp === undefined) { console.log("FAIL: no alloy Application under " + appsDir); return 1; }
    const cfg = alloyConfig(alloyApp) ?? "";
    const namespaces = new Set(parseAlloyEndpoints(cfg).map((e) => e.namespace));
    const names = readdirSync(appsDir).filter((d) => {
      const a = readApplication(appsDir, d);
      if (a === undefined) return false;
      const dest = (a.spec as Record<string, unknown>).destination as Record<string, unknown>;
      return namespaces.has(String(dest.namespace));
    });
    const roster = refreshRoster(appsDir, rosterPath, names);
    console.log("refreshed " + rosterPath + ": " + Object.keys(roster.apps).join(", "));
    return 0;
  }
  const { failures, checked } = runAudit(appsDir, rosterPath, repoRoot);
  console.log("=== observability chain audit (" + appsDir + ") ===");
  for (const c of checked) console.log("  CHECK: " + c);
  if (failures.length === 0) {
    console.log("PASS: " + String(checked.length) + " invariants hold.");
    console.log("NOTE: alert routing is DECLARED UNDELIVERED. Receivers named" );
    console.log("      unrouted-REQUIRES-CONFIGURATION / watchdog-REQUIRES-DEADMANSSWITCH");
    console.log("      deliver to nobody. Supplying a destination is a maintainer decision;" );
    console.log("      see the comment block in kube-prometheus-stack/Application.yaml.");
    return 0;
  }
  console.log("");
  for (const f of failures) console.log("  FAIL: " + f);
  console.log("");
  console.log(String(failures.length) + " failure(s).");
  return 1;
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
