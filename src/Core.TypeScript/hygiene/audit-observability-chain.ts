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

export function runAudit(appsDir: string, rosterPath: string): AuditResult {
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
  let refresh = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--apps-dir") { appsDir = argv[i + 1] ?? appsDir; i += 1; continue; }
    if (argv[i] === "--roster") { rosterPath = argv[i + 1] ?? rosterPath; i += 1; continue; }
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
  const { failures, checked } = runAudit(appsDir, rosterPath);
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
