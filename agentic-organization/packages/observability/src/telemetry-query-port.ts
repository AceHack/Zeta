export type TelemetryTimeRange = {
  start: string;
  end: string;
};

export type MetricPoint = {
  timestamp: string;
  value: number;
};

export type MetricSeries = {
  labels: Readonly<Record<string, string>>;
  points: readonly MetricPoint[];
};

export type TraceSummary = {
  traceId: string;
  rootName: string;
  spanCount: number;
};

export type LogLine = {
  timestamp: string;
  line: string;
  labels: Readonly<Record<string, string>>;
};

export type TelemetryQuerySource = "mimir" | "tempo" | "loki" | "recording";

export type TelemetryQueryOk<T> = {
  status: "ok";
  source: TelemetryQuerySource;
  data: readonly T[];
};

export type TelemetryQueryDegraded = {
  status: "degraded";
  source: TelemetryQuerySource;
  reason: "http_error" | "fetch_error" | "decode_error" | "bad_response" | "timeout";
  message: string;
  httpStatus?: number;
};

export type TelemetryQueryResult<T> = TelemetryQueryOk<T> | TelemetryQueryDegraded;

export type TelemetryQueryPort = {
  queryMetrics: (promql: string, range: TelemetryTimeRange) => Promise<TelemetryQueryResult<MetricSeries>>;
  queryTraces: (traceql: string, range: TelemetryTimeRange) => Promise<TelemetryQueryResult<TraceSummary>>;
  queryLogs: (logql: string, range: TelemetryTimeRange) => Promise<TelemetryQueryResult<LogLine>>;
};

export type TelemetryQueryCall =
  | { kind: "metrics"; query: string; range: TelemetryTimeRange }
  | { kind: "traces"; query: string; range: TelemetryTimeRange }
  | { kind: "logs"; query: string; range: TelemetryTimeRange };

export type RecordingTelemetryQueryPortInput = {
  metrics?: readonly MetricSeries[];
  traces?: readonly TraceSummary[];
  logs?: readonly LogLine[];
};

export type LgtmTelemetryQueryPortInput = {
  mimirBaseUrl: string;
  mimirTenantId?: string | undefined;
  tempoBaseUrl: string;
  lokiBaseUrl: string;
  stepSeconds?: number;
  fetchImpl?: typeof fetch;
};

export class RecordingTelemetryQueryPort implements TelemetryQueryPort {
  readonly calls: TelemetryQueryCall[] = [];
  private readonly metrics: readonly MetricSeries[];
  private readonly traces: readonly TraceSummary[];
  private readonly logs: readonly LogLine[];

  constructor(input: RecordingTelemetryQueryPortInput = {}) {
    this.metrics = input.metrics ?? [];
    this.traces = input.traces ?? [];
    this.logs = input.logs ?? [];
  }

  async queryMetrics(promql: string, range: TelemetryTimeRange): Promise<TelemetryQueryResult<MetricSeries>> {
    this.calls.push({ kind: "metrics", query: promql, range });
    return { status: "ok", source: "recording", data: this.metrics };
  }

  async queryTraces(traceql: string, range: TelemetryTimeRange): Promise<TelemetryQueryResult<TraceSummary>> {
    this.calls.push({ kind: "traces", query: traceql, range });
    return { status: "ok", source: "recording", data: this.traces };
  }

  async queryLogs(logql: string, range: TelemetryTimeRange): Promise<TelemetryQueryResult<LogLine>> {
    this.calls.push({ kind: "logs", query: logql, range });
    return { status: "ok", source: "recording", data: this.logs };
  }
}

export function createLgtmTelemetryQueryPort(input: LgtmTelemetryQueryPortInput): TelemetryQueryPort {
  const fetchImpl = input.fetchImpl ?? fetch;
  const stepSeconds = input.stepSeconds ?? 60;

  return {
    queryMetrics: async (promql, range) =>
      await queryJson(fetchImpl, "mimir", createPrometheusRangeUrl(input.mimirBaseUrl, promql, range, stepSeconds), mapPrometheusRange, mimirHeaders(input.mimirTenantId)),
    queryTraces: async (traceql, range) =>
      await queryJson(fetchImpl, "tempo", createTempoSearchUrl(input.tempoBaseUrl, traceql, range), mapTempoSearch),
    queryLogs: async (logql, range) =>
      await queryJson(fetchImpl, "loki", createLokiRangeUrl(input.lokiBaseUrl, logql, range), mapLokiRange),
  };
}

async function queryJson<Result>(
  fetchImpl: typeof fetch,
  source: TelemetryQuerySource,
  url: URL,
  map: (body: unknown) => readonly Result[],
  headers?: Record<string, string> | undefined,
): Promise<TelemetryQueryResult<Result>> {
  try {
    const response = await fetchImpl(url, headers === undefined ? undefined : { headers });
    if (!response.ok) {
      return {
        status: "degraded",
        source,
        reason: "http_error",
        message: `${source} telemetry query failed with HTTP ${response.status} ${response.statusText}`.trim(),
        httpStatus: response.status,
      };
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      return {
        status: "degraded",
        source,
        reason: "decode_error",
        message: `${source} telemetry query decode failed: ${errorMessage(error)}`,
      };
    }
    const badResponse = validateLgtmResponseBody(source, body);
    if (badResponse !== undefined) {
      return badResponse;
    }
    try {
      return { status: "ok", source, data: map(body) };
    } catch (error) {
      return {
        status: "degraded",
        source,
        reason: "bad_response",
        message: `${source} telemetry query returned malformed response: ${errorMessage(error)}`,
      };
    }
  } catch (error) {
    if (isTimeoutError(error)) {
      return {
        status: "degraded",
        source,
        reason: "timeout",
        message: `${source} telemetry query timed out: ${errorMessage(error)}`,
      };
    }
    return {
      status: "degraded",
      source,
      reason: "fetch_error",
      message: `${source} telemetry query fetch failed: ${errorMessage(error)}`,
    };
  }
}

function mimirHeaders(tenantId: string | undefined): Record<string, string> | undefined {
  return tenantId === undefined ? undefined : { "X-Scope-OrgID": tenantId };
}

function validateLgtmResponseBody(
  source: TelemetryQuerySource,
  body: unknown,
): TelemetryQueryDegraded | undefined {
  if (source === "recording") {
    return undefined;
  }
  if (!isRecord(body)) {
    return badTelemetryResponse(source, "top-level body is not an object");
  }
  if (source === "mimir" || source === "loki") {
    const status = readOptionalString(body.status);
    if (status === "error") {
      return badTelemetryResponse(source, readOptionalString(body.error) ?? readOptionalString(body.errorType) ?? "unknown error");
    }
    if (status !== "success") {
      return badTelemetryResponse(source, `expected status=success, got ${status ?? "missing"}`);
    }
    const data = readPath(body, ["data"]);
    if (!isRecord(data) || !Array.isArray(data.result)) {
      return badTelemetryResponse(source, "missing data.result array");
    }
  }
  if (source === "tempo" && !Array.isArray(body.traces)) {
    return badTelemetryResponse(source, "missing traces array");
  }
  return undefined;
}

function badTelemetryResponse(source: TelemetryQuerySource, detail: string): TelemetryQueryDegraded {
  return {
    status: "degraded",
    source,
    reason: "bad_response",
    message: `${source} telemetry query returned error response: ${detail}`,
  };
}

function createPrometheusRangeUrl(
  baseUrl: string,
  query: string,
  range: TelemetryTimeRange,
  stepSeconds: number,
): URL {
  const url = new URL("api/v1/query_range", ensureTrailingSlash(baseUrl));
  url.searchParams.set("query", query);
  url.searchParams.set("start", toUnixSeconds(range.start));
  url.searchParams.set("end", toUnixSeconds(range.end));
  url.searchParams.set("step", String(stepSeconds));
  return url;
}

function createTempoSearchUrl(baseUrl: string, query: string, range: TelemetryTimeRange): URL {
  const url = new URL("api/search", ensureTrailingSlash(baseUrl));
  url.searchParams.set("q", query);
  url.searchParams.set("query", query);
  url.searchParams.set("start", toUnixSeconds(range.start));
  url.searchParams.set("end", toUnixSeconds(range.end));
  return url;
}

function createLokiRangeUrl(baseUrl: string, query: string, range: TelemetryTimeRange): URL {
  const url = new URL("loki/api/v1/query_range", ensureTrailingSlash(baseUrl));
  url.searchParams.set("query", query);
  url.searchParams.set("start", toUnixNanoseconds(range.start));
  url.searchParams.set("end", toUnixNanoseconds(range.end));
  return url;
}

function mapPrometheusRange(body: unknown): readonly MetricSeries[] {
  const result = requireArray(readPath(body, ["data", "result"]), "expected Prometheus data.result array");
  return result.map((series) => ({
    labels: readStringRecord(readPath(series, ["metric"])),
    points: requireArray(readPath(series, ["values"]), "expected Prometheus series values array").map(mapPrometheusPoint),
  }));
}

function mapPrometheusPoint(value: unknown): MetricPoint {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error("expected Prometheus point tuple");
  }
  const timestamp = Number(value[0]);
  const sample = Number(value[1]);
  if (!Number.isFinite(timestamp) || !Number.isFinite(sample)) {
    throw new Error("expected numeric Prometheus point");
  }
  return { timestamp: new Date(timestamp * 1000).toISOString(), value: sample };
}

function mapTempoSearch(body: unknown): readonly TraceSummary[] {
  return requireArray(readPath(body, ["traces"]), "expected Tempo traces array").map(mapTempoTrace);
}

function mapTempoTrace(value: unknown): TraceSummary {
  const traceId = readOptionalString(readPath(value, ["traceID"])) ?? readOptionalString(readPath(value, ["traceId"]));
  if (traceId === undefined) {
    throw new Error("expected Tempo trace id");
  }
  return {
    traceId,
    rootName:
      readOptionalString(readPath(value, ["rootTraceName"])) ??
      readOptionalString(readPath(value, ["rootName"])) ??
      "unknown",
    spanCount: readTempoSpanCount(value),
  };
}

function readTempoSpanCount(value: unknown): number {
  const explicit = readOptionalNumber(readPath(value, ["spanCount"]));
  if (explicit !== undefined) {
    return explicit;
  }
  const spanSetSpans = readArray(readPath(value, ["spanSet", "spans"]));
  if (spanSetSpans.length > 0) {
    return spanSetSpans.length;
  }
  return readArray(readPath(value, ["spans"])).length;
}

function mapLokiRange(body: unknown): readonly LogLine[] {
  return requireArray(readPath(body, ["data", "result"]), "expected Loki data.result array").flatMap((stream) => {
    const labels = readStringRecord(readPath(stream, ["stream"]));
    return requireArray(readPath(stream, ["values"]), "expected Loki stream values array").map((value) =>
      mapLokiLine(value, labels)
    );
  });
}

function mapLokiLine(value: unknown, labels: Readonly<Record<string, string>>): LogLine {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error("expected Loki line tuple");
  }
  const timestampNs = readOptionalString(value[0]);
  const line = readOptionalString(value[1]);
  if (timestampNs === undefined || line === undefined) {
    throw new Error("expected Loki timestamp and line strings");
  }
  const timestampMs = Number(timestampNs) / 1_000_000;
  if (!Number.isFinite(timestampMs)) {
    throw new Error("expected numeric Loki timestamp");
  }
  return { timestamp: new Date(timestampMs).toISOString(), line, labels };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function toUnixSeconds(value: string): string {
  return String(Math.floor(Date.parse(value) / 1000));
}

function toUnixNanoseconds(value: string): string {
  return `${Date.parse(value)}000000`;
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function readArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function requireArray(value: unknown, message: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }
  return value;
}

function readStringRecord(value: unknown): Readonly<Record<string, string>> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    /\btime(?:d)?\s*out\b/i.test(error.message);
}
