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

export type TelemetryQueryPort = {
  queryMetrics: (promql: string, range: TelemetryTimeRange) => Promise<readonly MetricSeries[]>;
  queryTraces: (traceql: string, range: TelemetryTimeRange) => Promise<readonly TraceSummary[]>;
  queryLogs: (logql: string, range: TelemetryTimeRange) => Promise<readonly LogLine[]>;
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

  async queryMetrics(promql: string, range: TelemetryTimeRange): Promise<readonly MetricSeries[]> {
    this.calls.push({ kind: "metrics", query: promql, range });
    return this.metrics;
  }

  async queryTraces(traceql: string, range: TelemetryTimeRange): Promise<readonly TraceSummary[]> {
    this.calls.push({ kind: "traces", query: traceql, range });
    return this.traces;
  }

  async queryLogs(logql: string, range: TelemetryTimeRange): Promise<readonly LogLine[]> {
    this.calls.push({ kind: "logs", query: logql, range });
    return this.logs;
  }
}

export function createLgtmTelemetryQueryPort(input: LgtmTelemetryQueryPortInput): TelemetryQueryPort {
  const fetchImpl = input.fetchImpl ?? fetch;
  const stepSeconds = input.stepSeconds ?? 60;

  return {
    queryMetrics: async (promql, range) =>
      await queryJson(fetchImpl, createPrometheusRangeUrl(input.mimirBaseUrl, promql, range, stepSeconds), mapPrometheusRange),
    queryTraces: async (traceql, range) =>
      await queryJson(fetchImpl, createTempoSearchUrl(input.tempoBaseUrl, traceql, range), mapTempoSearch),
    queryLogs: async (logql, range) =>
      await queryJson(fetchImpl, createLokiRangeUrl(input.lokiBaseUrl, logql, range), mapLokiRange),
  };
}

async function queryJson<Result>(
  fetchImpl: typeof fetch,
  url: URL,
  map: (body: unknown) => readonly Result[],
): Promise<readonly Result[]> {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) {
      return [];
    }
    return map(await response.json());
  } catch {
    return [];
  }
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
  const result = readArray(readPath(body, ["data", "result"]));
  return result.map((series) => ({
    labels: readStringRecord(readPath(series, ["metric"])),
    points: readArray(readPath(series, ["values"])).map(mapPrometheusPoint).filter(isDefined),
  }));
}

function mapPrometheusPoint(value: unknown): MetricPoint | undefined {
  if (!Array.isArray(value) || value.length < 2) {
    return undefined;
  }
  const timestamp = Number(value[0]);
  const sample = Number(value[1]);
  if (!Number.isFinite(timestamp) || !Number.isFinite(sample)) {
    return undefined;
  }
  return { timestamp: new Date(timestamp * 1000).toISOString(), value: sample };
}

function mapTempoSearch(body: unknown): readonly TraceSummary[] {
  return readArray(readPath(body, ["traces"])).map(mapTempoTrace).filter(isDefined);
}

function mapTempoTrace(value: unknown): TraceSummary | undefined {
  const traceId = readOptionalString(readPath(value, ["traceID"])) ?? readOptionalString(readPath(value, ["traceId"]));
  if (traceId === undefined) {
    return undefined;
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
  return readArray(readPath(body, ["data", "result"])).flatMap((stream) => {
    const labels = readStringRecord(readPath(stream, ["stream"]));
    return readArray(readPath(stream, ["values"])).map((value) => mapLokiLine(value, labels)).filter(isDefined);
  });
}

function mapLokiLine(value: unknown, labels: Readonly<Record<string, string>>): LogLine | undefined {
  if (!Array.isArray(value) || value.length < 2) {
    return undefined;
  }
  const timestampNs = readOptionalString(value[0]);
  const line = readOptionalString(value[1]);
  if (timestampNs === undefined || line === undefined) {
    return undefined;
  }
  const timestampMs = Number(timestampNs) / 1_000_000;
  if (!Number.isFinite(timestampMs)) {
    return undefined;
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

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
