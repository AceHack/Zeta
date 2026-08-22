// full-ai-cluster/portal/src/metrics.ts
//
// The Prometheus exposition endpoint for the portal.
//
// WHY THIS EXISTS (2026-08-20, Dejan). The Alloy DaemonSet scrapes any pod
// carrying the prometheus.io/scrape annotation, and the kube-prometheus-stack
// Prometheus scrapes any Service a ServiceMonitor selects. Both paths existed
// and NOTHING IN ZETA WAS SCRAPED -- no metrics port, no annotation, and no
// ServiceMonitor or PrometheusRule authored anywhere in this tree. All 35 alert
// rules in the cluster came from a chart default and watched somebody else.
//
// Annotating a pod that serves no metrics endpoint is WORSE than not annotating
// it: the scrape 404s, the target shows DOWN, and the manifest reads as
// instrumented. So the endpoint comes FIRST and the annotation points at
// something real.
//
// ## Cardinality is a cost, and it is decided here
//
// A route label carrying the raw URL path would mint one time series per static
// asset the SPA ever serves -- unbounded, client-influenceable, and the classic
// way a metrics endpoint becomes the most expensive thing in a cluster. Requests
// are bucketed into a CLOSED set of route classes instead. The series count is
// bounded by ROUTE_CLASSES.length * 3 status classes = 12, a number you read off
// the source rather than discover on a bill.
//
// ## Format
//
// Prometheus text exposition format 0.0.4 (HELP / TYPE / sample). Hand-written
// rather than pulled from a client library: it is forty lines, and the portal
// dependency budget is one of the few things in this repo still at zero.
//
// Anchors (Beacon): Brian Brazil, Prometheus: Up and Running (O Reilly, 2018),
// ch. 3 exposition format and ch. 5 label cardinality; the OpenMetrics
// specification (CNCF) for the _total counter-suffix convention.

/** The closed set of route classes. Adding one is a deliberate cost decision. */
export const ROUTE_CLASSES = ["api", "metrics", "ui", "unknown"] as const;
export type RouteClass = (typeof ROUTE_CLASSES)[number];

/**
 * Every metric name this endpoint can emit.
 *
 * ENUMERABLE ON PURPOSE. audit-observability-chain.ts parses this array to build
 * the roster of metrics Zeta actually emits, and refuses an authored
 * PrometheusRule referencing a name outside it. An alert pointed at a metric
 * nothing emits is a check that cannot fire -- the same vacuity class as an
 * Alloy sink with no source, one layer up.
 */
export const EMITTED_METRICS = [
  "zeta_portal_build_info",
  "zeta_portal_start_time_seconds",
  "zeta_portal_http_requests_total",
  "zeta_portal_http_request_errors_total",
] as const;

/** The path the scrape annotation and the ServiceMonitor both point at. */
export const METRICS_PATH = "/metrics";

export interface MetricsState {
  /** Unix seconds at process start. Set once at construction. */
  readonly startedAtSeconds: number;
  readonly version: string;
  /** Keyed "routeClass|statusClass"; statusClass is 2xx, 4xx or 5xx. */
  readonly requests: Map<string, number>;
  readonly errors: Map<string, number>;
}

export function newMetricsState(version: string, startedAtSeconds: number): MetricsState {
  return {
    startedAtSeconds,
    version,
    requests: new Map<string, number>(),
    errors: new Map<string, number>(),
  };
}

/** Bucket a URL path into the closed route-class set. */
export function classifyRoute(pathname: string): RouteClass {
  if (pathname === METRICS_PATH) return "metrics";
  if (pathname.startsWith("/api/")) return "api";
  if (pathname.startsWith("/")) return "ui";
  return "unknown";
}

/** Bucket an HTTP status into 2xx / 4xx / 5xx. Three values, never more. */
export function classifyStatus(status: number): string {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  return "2xx";
}

function bump(m: Map<string, number>, key: string): void {
  m.set(key, (m.get(key) ?? 0) + 1);
}

/** Record one served request. Called from the fetch handler in server.ts. */
export function recordRequest(state: MetricsState, pathname: string, status: number): void {
  const route = classifyRoute(pathname);
  const outcome = classifyStatus(status);
  bump(state.requests, route + "|" + outcome);
  if (outcome !== "2xx") bump(state.errors, route);
}

const BACKSLASH = String.fromCharCode(92);
const QUOTE = String.fromCharCode(34);
const NEWLINE = String.fromCharCode(10);

/** Escape a label value per the exposition format. */
export function escapeLabel(v: string): string {
  return v
    .split(BACKSLASH)
    .join(BACKSLASH + BACKSLASH)
    .split(QUOTE)
    .join(BACKSLASH + QUOTE)
    .split(NEWLINE)
    .join(BACKSLASH + "n");
}

/** Render the current state as Prometheus text exposition format. */
export function renderMetrics(state: MetricsState): string {
  const lines: string[] = [];

  lines.push("# HELP zeta_portal_build_info Portal build information; always 1.");
  lines.push("# TYPE zeta_portal_build_info gauge");
  lines.push("zeta_portal_build_info{version=" + QUOTE + escapeLabel(state.version) + QUOTE + "} 1");

  lines.push("# HELP zeta_portal_start_time_seconds Unix time at which the portal started.");
  lines.push("# TYPE zeta_portal_start_time_seconds gauge");
  lines.push("zeta_portal_start_time_seconds " + String(state.startedAtSeconds));

  lines.push("# HELP zeta_portal_http_requests_total Requests served, by route and status class.");
  lines.push("# TYPE zeta_portal_http_requests_total counter");
  for (const key of [...state.requests.keys()].sort()) {
    const parts = key.split("|");
    lines.push(
      "zeta_portal_http_requests_total{route=" +
        QUOTE + escapeLabel(parts[0] ?? "") + QUOTE +
        ",status=" + QUOTE + escapeLabel(parts[1] ?? "") + QUOTE +
        "} " + String(state.requests.get(key) ?? 0),
    );
  }

  lines.push("# HELP zeta_portal_http_request_errors_total Non-2xx responses, by route class.");
  lines.push("# TYPE zeta_portal_http_request_errors_total counter");
  for (const key of [...state.errors.keys()].sort()) {
    lines.push(
      "zeta_portal_http_request_errors_total{route=" + QUOTE + escapeLabel(key) + QUOTE + "} " +
        String(state.errors.get(key) ?? 0),
    );
  }

  return lines.join(NEWLINE) + NEWLINE;
}

/** The metrics response. Content-Type is the one Prometheus expects. */
export function metricsResponse(state: MetricsState): Response {
  return new Response(renderMetrics(state), {
    status: 200,
    headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}
