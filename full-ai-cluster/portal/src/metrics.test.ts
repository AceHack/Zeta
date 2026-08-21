// full-ai-cluster/portal/src/metrics.test.ts
//
// The falsifier for the portal exposition endpoint.
//
// The failure this guards is not "the endpoint 500s" -- it is the quieter one:
// a manifest annotated prometheus.io/scrape pointing at an endpoint that serves
// nothing, or serves names no alert references, or mints a series per URL. Each
// of those reads as instrumented and measures nothing.

import { describe, expect, test } from "bun:test";
import {
  EMITTED_METRICS,
  METRICS_PATH,
  ROUTE_CLASSES,
  classifyRoute,
  classifyStatus,
  metricsResponse,
  newMetricsState,
  recordRequest,
  renderMetrics,
} from "./metrics.ts";

describe("exposition", () => {
  test("renders every declared metric name -- an empty scrape is a dead target", () => {
    const s = newMetricsState("test", 1_700_000_000);
    const body = renderMetrics(s);
    for (const name of EMITTED_METRICS) {
      expect(body).toContain(name);
    }
  });

  test("EMITTED_METRICS is exactly what renders -- the roster cannot drift", () => {
    const s = newMetricsState("test", 1);
    recordRequest(s, "/api/catalog", 200);
    recordRequest(s, "/api/catalog", 500);
    const declared = new Set<string>(EMITTED_METRICS);
    const rendered = new Set<string>();
    for (const line of renderMetrics(s).split("\n")) {
      const m = /^([a-z_][a-z0-9_]*)[{ ]/.exec(line);
      if (m && m[1]) rendered.add(m[1]);
    }
    expect([...rendered].sort()).toEqual([...declared].sort());
  });

  test("counts are the counts -- a metric that arrives wrong is worse than absent", () => {
    const s = newMetricsState("v1", 1);
    recordRequest(s, "/api/a", 200);
    recordRequest(s, "/api/b", 200);
    recordRequest(s, "/api/c", 503);
    const body = renderMetrics(s);
    expect(body).toContain("zeta_portal_http_requests_total{route=\"api\",status=\"2xx\"} 2");
    expect(body).toContain("zeta_portal_http_requests_total{route=\"api\",status=\"5xx\"} 1");
    expect(body).toContain("zeta_portal_http_request_errors_total{route=\"api\"} 1");
  });

  test("the content type is the one Prometheus parses", async () => {
    const r = metricsResponse(newMetricsState("v1", 1));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/plain");
    expect(await r.text()).toContain("zeta_portal_build_info");
  });
});

describe("cardinality is bounded -- the cost is a property, not a hope", () => {
  test("a thousand distinct static paths produce ONE ui series per status class", () => {
    const s = newMetricsState("v1", 1);
    for (let i = 0; i < 1000; i += 1) recordRequest(s, "/assets/chunk-" + String(i) + ".js", 200);
    expect(s.requests.size).toBe(1);
    const sampleLines = renderMetrics(s)
      .split("\n")
      .filter((l) => l.startsWith("zeta_portal_http_requests_total{"));
    expect(sampleLines).toHaveLength(1);
  });

  test("the whole endpoint cannot exceed ROUTE_CLASSES * 3 request series", () => {
    const s = newMetricsState("v1", 1);
    const paths = ["/api/x", "/metrics", "/index.html", "/api/y", "/other"];
    for (const p of paths) {
      for (const code of [200, 404, 500]) recordRequest(s, p, code);
    }
    expect(s.requests.size).toBeLessThanOrEqual(ROUTE_CLASSES.length * 3);
  });

  test("every path lands in the closed set -- classifyRoute is total", () => {
    const closed = new Set<string>(ROUTE_CLASSES);
    for (const p of ["/api/z", METRICS_PATH, "/", "/a/b/c", "no-leading-slash"]) {
      expect(closed.has(classifyRoute(p))).toBe(true);
    }
  });

  test("status classification is three-valued and total", () => {
    expect(classifyStatus(200)).toBe("2xx");
    expect(classifyStatus(301)).toBe("2xx");
    expect(classifyStatus(404)).toBe("4xx");
    expect(classifyStatus(503)).toBe("5xx");
  });
});

describe("the annotation contract", () => {
  test("METRICS_PATH is what the manifests annotate", () => {
    // If this constant moves, portal.yaml prometheus.io/path and the
    // ServiceMonitor path move with it or the scrape 404s silently.
    expect(METRICS_PATH).toBe("/metrics");
  });
});

