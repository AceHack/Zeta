import { createOtlpTelemetry, type OtlpFetch } from "../apps/workers/src/adapters/otlp-telemetry.ts";
import { TelemetryMetricKind, type TelemetryMetricKind as TelemetryMetricKindValue } from "../packages/observability/src/index.ts";

export type ObservabilitySmokeFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type ObservabilitySmokeFetch = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<ObservabilitySmokeFetchResponse>;

export type GrafanaBasicAuth = {
  username: string;
  password: string;
};

export type RunObservabilitySmokeInput = {
  otlpEndpoint: string;
  tempoApiUrl: string;
  grafanaApiUrl: string;
  grafanaBasicAuth?: GrafanaBasicAuth | undefined;
  tempoQueryMaxAttempts?: number | undefined;
  tempoQueryRetryDelayMs?: number | undefined;
  now: () => string;
  fetch: ObservabilitySmokeFetch;
};

export type ObservabilitySmokeProof = {
  track: "OBS0/OBS4 observability smoke";
  probeId: string;
  traceId: string;
  spanExported: boolean;
  metricPostsAccepted: boolean;
  metricKindMappings: ObservabilitySmokeMetricKindMapping[];
  traceQueryable: boolean;
  dashboardConfigured: boolean;
  PROOF: "PASS" | "FAIL";
};

export type ObservabilitySmokeMetricKindMapping = {
  kind: TelemetryMetricKindValue;
  otlpShape: "sum" | "gauge" | "histogram";
  metricName: string;
};

export async function runObservabilitySmoke(input: RunObservabilitySmokeInput): Promise<ObservabilitySmokeProof> {
  const probeId = `observability-smoke-${input.now()}`;
  let traceExportAttempts = 0;
  let traceExportFailures = 0;
  let metricExportAttempts = 0;
  let metricExportFailures = 0;
  const fetchForOtlp: OtlpFetch = async (url, init) => {
    const response = await input.fetch(url, init);
    if (url.endsWith("/v1/traces")) {
      traceExportAttempts += 1;
      if (!response.ok) {
        traceExportFailures += 1;
      }
    }
    if (url.endsWith("/v1/metrics")) {
      metricExportAttempts += 1;
      if (!response.ok) {
        metricExportFailures += 1;
      }
    }
    return { ok: response.ok, status: response.status };
  };
  const telemetry = createOtlpTelemetry({
    endpoint: input.otlpEndpoint,
    serviceName: "agentic-org-worker-smoke",
    resourceAttributes: {
      "deployment.environment": "smoke",
      "agentic.probe.id": probeId,
    },
    fetch: fetchForOtlp,
  });
  const carrier: Record<string, string> = {};
  telemetry.inject(carrier);
  const traceId = carrier.traceparent?.split("-")[1] ?? "unknown-trace";
  const span = telemetry.startSpan("org.observability.smoke", {
    attributes: {
      "agentic.probe.id": probeId,
      "agentic.trace.id": traceId,
    },
  });
  span.setAttribute("result.status", "probe");
  span.end();
  for (const metric of SmokeMetricKindMappings) {
    telemetry.recordMetric({
      kind: metric.kind,
      name: metric.metricName,
      value: metric.value,
      attributes: { "agentic.probe.id": probeId },
    });
  }
  await telemetry.flush();

  const traceQueryable = await queryTempoForProbe(input, probeId, traceId);
  const dashboardConfigured = await queryGrafanaForDashboard(input);
  const spanExported = traceId !== "unknown-trace" && traceExportAttempts === 1 && traceExportFailures === 0;
  const metricPostsAccepted = metricExportAttempts === SmokeMetricKindMappings.length && metricExportFailures === 0;

  return {
    track: "OBS0/OBS4 observability smoke",
    probeId,
    traceId,
    spanExported,
    metricPostsAccepted,
    metricKindMappings: SmokeMetricKindMappings.map(({ kind, otlpShape, metricName }) => ({ kind, otlpShape, metricName })),
    traceQueryable,
    dashboardConfigured,
    PROOF: spanExported && metricPostsAccepted && traceQueryable && dashboardConfigured ? "PASS" : "FAIL",
  };
}

async function queryTempoForProbe(input: RunObservabilitySmokeInput, probeId: string, traceId: string): Promise<boolean> {
  const url = `${input.tempoApiUrl.replace(/\/+$/, "")}/api/search?tags=${encodeURIComponent(`agentic.probe.id=${probeId}`)}`;
  const maxAttempts = input.tempoQueryMaxAttempts ?? 20;
  const retryDelayMs = input.tempoQueryRetryDelayMs ?? 250;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await input.fetch(url);
    if (response.ok) {
      const body = await response.json();
      if (tempoSearchIncludesTrace(body, traceId)) {
        return true;
      }
    }

    if (attempt < maxAttempts) {
      await sleepMs(retryDelayMs);
    }
  }

  return false;
}

async function queryGrafanaForDashboard(input: RunObservabilitySmokeInput): Promise<boolean> {
  const url = `${input.grafanaApiUrl.replace(/\/+$/, "")}/api/search?query=Agentic%20Organization%20Health`;
  const response = await input.fetch(url, {
    headers: input.grafanaBasicAuth === undefined ? {} : { Authorization: basicAuthHeader(input.grafanaBasicAuth) },
  });
  if (!response.ok) {
    return false;
  }

  const body = await response.json();
  return JSON.stringify(body).includes("agentic-org-health");
}

function basicAuthHeader(input: GrafanaBasicAuth): string {
  return `Basic ${base64Ascii(`${input.username}:${input.password}`)}`;
}

function parseGrafanaBasicAuth(value: string | undefined): GrafanaBasicAuth | undefined {
  if (value === undefined) {
    return undefined;
  }
  const separator = value.indexOf(":");
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error("GRAFANA_BASIC_AUTH must be 'username:password'");
  }
  return {
    username: value.slice(0, separator),
    password: value.slice(separator + 1),
  };
}

function base64Ascii(value: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < value.length; index += 3) {
    const first = asciiByte(value, index);
    const second = index + 1 < value.length ? asciiByte(value, index + 1) : 0;
    const third = index + 2 < value.length ? asciiByte(value, index + 2) : 0;
    const bits = (first << 16) | (second << 8) | third;
    output += alphabet[(bits >> 18) & 63];
    output += alphabet[(bits >> 12) & 63];
    output += index + 1 < value.length ? alphabet[(bits >> 6) & 63] : "=";
    output += index + 2 < value.length ? alphabet[bits & 63] : "=";
  }
  return output;
}

function asciiByte(value: string, index: number): number {
  const byte = value.charCodeAt(index);
  if (byte > 0xff) {
    throw new Error("GRAFANA_BASIC_AUTH must contain only single-byte characters");
  }
  return byte;
}

export function tempoSearchIncludesTrace(body: unknown, traceId: string): boolean {
  if (traceId === "unknown-trace") {
    return false;
  }

  const traces = (body as { traces?: unknown }).traces;
  if (!Array.isArray(traces)) {
    return false;
  }

  return traces.some((trace) => {
    const candidate = trace as { traceID?: unknown; traceId?: unknown };
    return traceIdsMatch(candidate.traceID, traceId) || traceIdsMatch(candidate.traceId, traceId);
  });
}

function traceIdsMatch(candidate: unknown, expected: string): boolean {
  if (typeof candidate !== "string") {
    return false;
  }

  return normalizeTraceId(candidate) === normalizeTraceId(expected);
}

function normalizeTraceId(traceId: string): string {
  const normalized = traceId.toLowerCase().replace(/^0+/, "");
  return normalized.length === 0 ? "0" : normalized;
}

async function sleepMs(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

type SmokeMetricKindMapping = ObservabilitySmokeMetricKindMapping & {
  value: number;
};

const SmokeMetricKindMappings: SmokeMetricKindMapping[] = [
  {
    kind: TelemetryMetricKind.Counter,
    otlpShape: "sum",
    metricName: "org_observability_smoke_total",
    value: 1,
  },
  {
    kind: TelemetryMetricKind.Gauge,
    otlpShape: "gauge",
    metricName: "org_observability_smoke_pressure_ratio",
    value: 0.5,
  },
  {
    kind: TelemetryMetricKind.Histogram,
    otlpShape: "histogram",
    metricName: "org_observability_smoke_latency_ms",
    value: 1,
  },
];

async function main(): Promise<void> {
  const proof = await runObservabilitySmoke({
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://otel-collector:4318",
    tempoApiUrl: process.env.TEMPO_API_URL ?? "http://tempo:3200",
    grafanaApiUrl: process.env.GRAFANA_API_URL ?? "http://grafana:3000",
    ...(process.env.GRAFANA_BASIC_AUTH === undefined ? {} : { grafanaBasicAuth: parseGrafanaBasicAuth(process.env.GRAFANA_BASIC_AUTH) }),
    now: () => new Date().toISOString(),
    fetch: async (url, init) => {
      const response = await fetch(url, init);
      return {
        ok: response.ok,
        status: response.status,
        json: async () => await response.json(),
      };
    },
  });

  console.log(JSON.stringify(proof, null, 2));
  if (proof.PROOF !== "PASS") {
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("run-observability-smoke.ts") === true) {
  void main();
}
