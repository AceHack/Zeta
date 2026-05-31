import { createOtlpTelemetry, type OtlpFetch } from "../apps/workers/src/adapters/otlp-telemetry.ts";

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

export type RunObservabilitySmokeInput = {
  otlpEndpoint: string;
  tempoApiUrl: string;
  grafanaApiUrl: string;
  now: () => string;
  fetch: ObservabilitySmokeFetch;
};

export type ObservabilitySmokeProof = {
  track: "OBS0/OBS4 observability smoke";
  probeId: string;
  traceId: string;
  spanExported: boolean;
  traceQueryable: boolean;
  dashboardConfigured: boolean;
  PROOF: "PASS" | "FAIL";
};

export async function runObservabilitySmoke(input: RunObservabilitySmokeInput): Promise<ObservabilitySmokeProof> {
  const probeId = `observability-smoke-${input.now()}`;
  const fetchForOtlp: OtlpFetch = async (url, init) => {
    const response = await input.fetch(url, init);
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
  await telemetry.flush();

  const traceQueryable = await queryTempoForProbe(input, probeId);
  const dashboardConfigured = await queryGrafanaForDashboard(input);
  const spanExported = traceId !== "unknown-trace";

  return {
    track: "OBS0/OBS4 observability smoke",
    probeId,
    traceId,
    spanExported,
    traceQueryable,
    dashboardConfigured,
    PROOF: spanExported && traceQueryable && dashboardConfigured ? "PASS" : "FAIL",
  };
}

async function queryTempoForProbe(input: RunObservabilitySmokeInput, probeId: string): Promise<boolean> {
  const url = `${input.tempoApiUrl.replace(/\/+$/, "")}/api/search?tags=${encodeURIComponent(`agentic.probe.id=${probeId}`)}`;
  const response = await input.fetch(url);
  if (!response.ok) {
    return false;
  }

  const body = await response.json();
  return JSON.stringify(body).includes("trace");
}

async function queryGrafanaForDashboard(input: RunObservabilitySmokeInput): Promise<boolean> {
  const url = `${input.grafanaApiUrl.replace(/\/+$/, "")}/api/search?query=Agentic%20Organization%20Health`;
  const response = await input.fetch(url);
  if (!response.ok) {
    return false;
  }

  const body = await response.json();
  return JSON.stringify(body).includes("agentic-org-health");
}

async function main(): Promise<void> {
  const proof = await runObservabilitySmoke({
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://otel-collector:4318",
    tempoApiUrl: process.env.TEMPO_API_URL ?? "http://tempo:3200",
    grafanaApiUrl: process.env.GRAFANA_API_URL ?? "http://grafana:3000",
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
