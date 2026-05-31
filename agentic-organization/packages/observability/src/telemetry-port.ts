export const TelemetrySpanStatusCode = {
  Ok: "ok",
  Error: "error",
  Unset: "unset",
} as const;

export type TelemetrySpanStatusCode = (typeof TelemetrySpanStatusCode)[keyof typeof TelemetrySpanStatusCode];

export const TelemetryMetricKind = {
  Counter: "counter",
  Gauge: "gauge",
  Histogram: "histogram",
} as const;

export type TelemetryMetricKind = (typeof TelemetryMetricKind)[keyof typeof TelemetryMetricKind];

export const W3CTraceHeaderName = {
  TraceParent: "traceparent",
} as const;

export type W3CTraceHeaderName = (typeof W3CTraceHeaderName)[keyof typeof W3CTraceHeaderName];

export type TelemetryAttributeValue = string | number | boolean;
export type TelemetryAttributes = Record<string, TelemetryAttributeValue>;

export type TelemetrySpanStatus = {
  code: TelemetrySpanStatusCode;
  message?: string;
};

export type TelemetryTraceContext = {
  traceId: string;
  spanId: string;
  traceFlags: string;
};

export type StartTelemetrySpanInput = {
  attributes?: TelemetryAttributes;
  parent?: TelemetryTraceContext | null;
};

export type TelemetrySpan = {
  setAttribute: (key: string, value: TelemetryAttributeValue) => void;
  addEvent: (name: string, attributes?: TelemetryAttributes) => void;
  setStatus: (status: TelemetrySpanStatus) => void;
  end: () => void;
};

export type MetricSample = {
  kind: TelemetryMetricKind;
  name: string;
  value: number;
  attributes?: TelemetryAttributes;
};

export type StructuredLogRecord = {
  severity: string;
  body: string;
  attributes?: TelemetryAttributes;
  timestamp?: string;
};

export type TelemetryPort = {
  startSpan: (name: string, input?: StartTelemetrySpanInput) => TelemetrySpan;
  recordMetric: (sample: MetricSample) => void;
  log: (record: StructuredLogRecord) => void;
  inject: (carrier: Record<string, string>) => void;
  extract: (carrier: Record<string, string>) => TelemetryTraceContext | null;
};

export type RecordedSpanEvent = {
  name: string;
  attributes: TelemetryAttributes;
};

export type RecordedSpan = {
  name: string;
  attributes: TelemetryAttributes;
  events: RecordedSpanEvent[];
  status: TelemetrySpanStatus;
  ended: boolean;
};

export type RecordingTelemetryInput = {
  traceContext?: TelemetryTraceContext;
};

export class NoopTelemetry implements TelemetryPort {
  startSpan(_name: string, _input?: StartTelemetrySpanInput): TelemetrySpan {
    return noopSpan;
  }

  recordMetric(_sample: MetricSample): void {
    return;
  }

  log(_record: StructuredLogRecord): void {
    return;
  }

  inject(_carrier: Record<string, string>): void {
    return;
  }

  extract(_carrier: Record<string, string>): TelemetryTraceContext | null {
    return null;
  }
}

export class RecordingTelemetry implements TelemetryPort {
  readonly spans: RecordedSpan[] = [];
  readonly metrics: MetricSample[] = [];
  readonly logs: StructuredLogRecord[] = [];
  private readonly traceContext: TelemetryTraceContext | undefined;

  constructor(input: RecordingTelemetryInput = {}) {
    this.traceContext = input.traceContext;
  }

  startSpan(name: string, input: StartTelemetrySpanInput = {}): TelemetrySpan {
    const span: RecordedSpan = {
      name,
      attributes: { ...(input.attributes ?? {}) },
      events: [],
      status: { code: TelemetrySpanStatusCode.Unset },
      ended: false,
    };
    this.spans.push(span);

    return {
      setAttribute: (key, value) => {
        span.attributes[key] = value;
      },
      addEvent: (eventName, attributes = {}) => {
        span.events.push({ name: eventName, attributes });
      },
      setStatus: (status) => {
        span.status = status;
      },
      end: () => {
        span.ended = true;
      },
    };
  }

  recordMetric(sample: MetricSample): void {
    this.metrics.push(sample);
  }

  log(record: StructuredLogRecord): void {
    this.logs.push(record);
  }

  inject(carrier: Record<string, string>): void {
    if (this.traceContext === undefined) {
      return;
    }

    carrier[W3CTraceHeaderName.TraceParent] = formatTraceParent(this.traceContext);
  }

  extract(carrier: Record<string, string>): TelemetryTraceContext | null {
    return parseTraceParent(carrier[W3CTraceHeaderName.TraceParent]);
  }
}

export function formatTraceParent(context: TelemetryTraceContext): string {
  return `00-${context.traceId}-${context.spanId}-${context.traceFlags}`;
}

export function parseTraceParent(value: string | undefined): TelemetryTraceContext | null {
  if (value === undefined) {
    return null;
  }

  const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(value);
  if (match === null) {
    return null;
  }

  const [, traceId, spanId, traceFlags] = match;
  if (traceId === undefined || spanId === undefined || traceFlags === undefined) {
    return null;
  }

  return { traceId, spanId, traceFlags };
}

const noopSpan: TelemetrySpan = {
  setAttribute: () => undefined,
  addEvent: () => undefined,
  setStatus: () => undefined,
  end: () => undefined,
};
