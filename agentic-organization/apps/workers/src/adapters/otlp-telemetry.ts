import { randomUUID } from "node:crypto";

import {
  TelemetrySpanStatusCode,
  formatTraceParent,
  parseTraceParent,
  type MetricSample,
  type StartTelemetrySpanInput,
  type StructuredLogRecord,
  type TelemetryAttributes,
  type TelemetryAttributeValue,
  type TelemetryPort,
  type TelemetrySpan,
  type TelemetrySpanStatus,
  type TelemetryTraceContext,
} from "../../../../packages/observability/src/index.ts";

export type OtlpFetchResponse = {
  ok: boolean;
  status: number;
};

export type OtlpFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  },
) => Promise<OtlpFetchResponse>;

export type CreateOtlpTelemetryInput = {
  endpoint: string;
  serviceName: string;
  resourceAttributes?: TelemetryAttributes;
  fetch?: OtlpFetch;
};

export type OtlpTelemetry = TelemetryPort & {
  flush: () => Promise<void>;
};

type PendingExport = Promise<void>;

export function createOtlpTelemetry(input: CreateOtlpTelemetryInput): OtlpTelemetry {
  const exporter = new OtlpTelemetryAdapter(input);
  return exporter;
}

class OtlpTelemetryAdapter implements OtlpTelemetry {
  private readonly endpoint: string;
  private readonly serviceName: string;
  private readonly resourceAttributes: TelemetryAttributes;
  private readonly fetchFn: OtlpFetch;
  private readonly pendingExports: PendingExport[] = [];
  private readonly traceContext: TelemetryTraceContext;

  constructor(input: CreateOtlpTelemetryInput) {
    this.endpoint = input.endpoint.replace(/\/+$/, "");
    this.serviceName = input.serviceName;
    this.resourceAttributes = input.resourceAttributes ?? {};
    this.fetchFn = input.fetch ?? defaultFetch;
    this.traceContext = {
      traceId: randomTraceId(),
      spanId: randomSpanId(),
      traceFlags: "01",
    };
  }

  startSpan(name: string, input: StartTelemetrySpanInput = {}): TelemetrySpan {
    const startedAtUnixNano = nowUnixNano();
    const spanId = randomSpanId();
    const traceContext = input.parent ?? this.traceContext;
    const attributes = { ...(input.attributes ?? {}) };
    const events: OtlpSpanEvent[] = [];
    let status: TelemetrySpanStatus = { code: TelemetrySpanStatusCode.Unset };

    return {
      setAttribute: (key, value) => {
        attributes[key] = value;
      },
      addEvent: (eventName, eventAttributes = {}) => {
        events.push({
          name: eventName,
          timeUnixNano: nowUnixNano(),
          attributes: toOtlpAttributes(eventAttributes),
        });
      },
      setStatus: (nextStatus) => {
        status = nextStatus;
      },
      end: () => {
        this.queueExport(
          "traces",
          {
            resourceSpans: [
              {
                resource: { attributes: this.resourceOtlpAttributes() },
                scopeSpans: [
                  {
                    scope: { name: "agentic-organization" },
                    spans: [
                      {
                        traceId: traceContext.traceId,
                        spanId,
                        parentSpanId: traceContext.spanId,
                        name,
                        kind: 1,
                        startTimeUnixNano: startedAtUnixNano,
                        endTimeUnixNano: nowUnixNano(),
                        attributes: toOtlpAttributes(attributes),
                        events,
                        status: toOtlpStatus(status),
                      },
                    ],
                  },
                ],
              },
            ],
          },
        );
      },
    };
  }

  recordMetric(sample: MetricSample): void {
    this.queueExport(
      "metrics",
      {
        resourceMetrics: [
          {
            resource: { attributes: this.resourceOtlpAttributes() },
            scopeMetrics: [
              {
                scope: { name: "agentic-organization" },
                metrics: [
                  {
                    name: sample.name,
                    sum: {
                      dataPoints: [
                        {
                          timeUnixNano: nowUnixNano(),
                          asDouble: sample.value,
                          attributes: toOtlpAttributes(sample.attributes ?? {}),
                        },
                      ],
                      aggregationTemporality: 2,
                      isMonotonic: sample.kind === "counter",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    );
  }

  log(record: StructuredLogRecord): void {
    this.queueExport(
      "logs",
      {
        resourceLogs: [
          {
            resource: { attributes: this.resourceOtlpAttributes() },
            scopeLogs: [
              {
                scope: { name: "agentic-organization" },
                logRecords: [
                  {
                    timeUnixNano: record.timestamp === undefined ? nowUnixNano() : isoToUnixNano(record.timestamp),
                    severityText: record.severity,
                    body: { stringValue: record.body },
                    attributes: toOtlpAttributes(record.attributes ?? {}),
                  },
                ],
              },
            ],
          },
        ],
      },
    );
  }

  inject(carrier: Record<string, string>): void {
    carrier.traceparent = formatTraceParent(this.traceContext);
  }

  extract(carrier: Record<string, string>): TelemetryTraceContext | null {
    return parseTraceParent(carrier.traceparent);
  }

  async flush(): Promise<void> {
    const exports = this.pendingExports.splice(0);
    await Promise.all(exports);
  }

  private queueExport(signalPath: "traces" | "metrics" | "logs", body: unknown): void {
    const request = this.fetchFn(`${this.endpoint}/v1/${signalPath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`otlp export failed with HTTP ${response.status}`);
      }
    });
    this.pendingExports.push(request.catch(() => undefined));
  }

  private resourceOtlpAttributes(): OtlpAttribute[] {
    return toOtlpAttributes({
      "service.name": this.serviceName,
      ...this.resourceAttributes,
    });
  }
}

function toOtlpStatus(status: TelemetrySpanStatus): { code: number; message?: string } {
  const code = status.code === TelemetrySpanStatusCode.Ok ? 1 : status.code === TelemetrySpanStatusCode.Error ? 2 : 0;

  if (status.message === undefined) {
    return { code };
  }

  return { code, message: status.message };
}

type OtlpAttribute = {
  key: string;
  value: {
    stringValue?: string;
    intValue?: string;
    doubleValue?: number;
    boolValue?: boolean;
  };
};

type OtlpSpanEvent = {
  name: string;
  timeUnixNano: string;
  attributes: OtlpAttribute[];
};

function toOtlpAttributes(attributes: TelemetryAttributes): OtlpAttribute[] {
  return Object.entries(attributes).map(([key, value]) => ({
    key,
    value: toOtlpAnyValue(value),
  }));
}

function toOtlpAnyValue(value: TelemetryAttributeValue): OtlpAttribute["value"] {
  if (typeof value === "boolean") {
    return { boolValue: value };
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { intValue: String(value) };
    }

    return { doubleValue: value };
  }

  return { stringValue: value };
}

function nowUnixNano(): string {
  return `${BigInt(Date.now()) * 1_000_000n}`;
}

function isoToUnixNano(timestamp: string): string {
  return `${BigInt(Date.parse(timestamp)) * 1_000_000n}`;
}

function randomTraceId(): string {
  return randomUUID().replaceAll("-", "");
}

function randomSpanId(): string {
  return randomTraceId().slice(0, 16);
}

const defaultFetch: OtlpFetch = async (url, init) => {
  const response = await fetch(url, init);
  return { ok: response.ok, status: response.status };
};
