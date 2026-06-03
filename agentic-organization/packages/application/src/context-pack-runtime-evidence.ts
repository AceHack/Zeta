import { GraphNodeKind, graphNodeId } from "../../domain/src/index.ts";
import type {
  LogLine,
  MetricSeries,
  TelemetryQueryDegraded,
  TelemetryQueryPort,
  TelemetryTimeRange,
  TraceSummary,
} from "../../observability/src/index.ts";
import {
  ContextPackFreshness,
  ContextPackItemKind,
  ContextPackOmissionReason,
  ContextPackSourcePointerKind,
  type ContextPackItem,
  type ContextPackOmittedItem,
} from "./context-pack-contracts.ts";
import type {
  ContextPackGraphRootSeed,
  ContextPackTelemetryEvidencePort,
  ContextPackTelemetryEvidenceRequest,
  ContextPackTelemetryEvidenceResult,
} from "./context-pack-builder.ts";

export type CreateLgtmContextPackRuntimeEvidencePortInput = {
  telemetry: TelemetryQueryPort;
  range: TelemetryTimeRange;
  maxTraceItems?: number | undefined;
};

const DEFAULT_CONTEXT_PACK_RUNTIME_EVIDENCE_TRACE_LIMIT = 5;
const RUNTIME_EVIDENCE_SOURCE_ID = "lgtm";
const RUNTIME_EVIDENCE_NODE_ID = "telemetry_evidence";
const RuntimeEvidenceQueryKind = {
  Trace: "trace",
  Log: "log",
  Metric: "metric",
} as const;

type RuntimeTraceAnchor = {
  traceId: string;
  workItemId: string;
};

type RuntimeEvidenceQueryResults = {
  traces: readonly TraceSummary[];
  logs: readonly LogLine[];
  metrics: readonly MetricSeries[];
  omissions: readonly ContextPackOmittedItem[];
};

export function createLgtmContextPackRuntimeEvidencePort(
  input: CreateLgtmContextPackRuntimeEvidencePortInput,
): ContextPackTelemetryEvidencePort {
  const maxTraceItems = input.maxTraceItems ?? DEFAULT_CONTEXT_PACK_RUNTIME_EVIDENCE_TRACE_LIMIT;
  return {
    async load(request): Promise<ContextPackTelemetryEvidenceResult> {
      const anchors = runtimeTraceAnchorsFor(request).slice(0, maxTraceItems);
      if (anchors.length === 0) return { items: [], omittedItemsWithReason: [], graphRootSeeds: [] };

      const queryResults = await runtimeEvidenceQueryResults(input.telemetry, input.range, anchors);
      const traceById = new Map(queryResults.traces.map((trace) => [trace.traceId, trace]));
      const items = anchors.flatMap((anchor) => {
        const trace = traceById.get(anchor.traceId);
        return trace === undefined
          ? []
          : [runtimeTraceContextItem(anchor, trace, queryResults.logs, queryResults.metrics)];
      });
      return {
        items,
        omittedItemsWithReason: queryResults.omissions,
        graphRootSeeds: items.map((item) => runtimeTraceGraphRootSeed(request, item)),
      };
    },
  };
}

function runtimeTraceAnchorsFor(request: ContextPackTelemetryEvidenceRequest): RuntimeTraceAnchor[] {
  const activeWorkItemId = request.request.snapshot.workItemId;
  if (activeWorkItemId === undefined) return [];
  const anchors = new Map<string, RuntimeTraceAnchor>();
  for (const item of request.items) {
    const hasActiveWorkPointer = (item.sourcePointers ?? []).some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.WorkItem && pointer.workItemId === activeWorkItemId
    );
    if (!hasActiveWorkPointer) continue;
    for (const pointer of item.sourcePointers ?? []) {
      if (pointer.kind !== ContextPackSourcePointerKind.Trace) continue;
      anchors.set(pointer.traceId, { traceId: pointer.traceId, workItemId: activeWorkItemId });
    }
  }
  return [...anchors.values()];
}

async function runtimeEvidenceQueryResults(
  telemetry: TelemetryQueryPort,
  range: TelemetryTimeRange,
  anchors: readonly RuntimeTraceAnchor[],
): Promise<RuntimeEvidenceQueryResults> {
  const traceQuery = traceQueryFor(anchors);
  const logQuery = logQueryFor(anchors);
  const metricQuery = metricQueryFor(anchors);
  const [traceResult, logResult, metricResult] = await Promise.all([
    telemetry.queryTraces(traceQuery, range),
    telemetry.queryLogs(logQuery, range),
    telemetry.queryMetrics(metricQuery, range),
  ]);

  return {
    traces: traceResult.status === "ok" ? traceResult.data : [],
    logs: logResult.status === "ok" ? logResult.data : [],
    metrics: metricResult.status === "ok" ? metricResult.data : [],
    omissions: [
      ...(traceResult.status === "degraded" ? [degradedTelemetryOmission(RuntimeEvidenceQueryKind.Trace, traceResult)] : []),
      ...(logResult.status === "degraded" ? [degradedTelemetryOmission(RuntimeEvidenceQueryKind.Log, logResult)] : []),
      ...(metricResult.status === "degraded" ? [degradedTelemetryOmission(RuntimeEvidenceQueryKind.Metric, metricResult)] : []),
    ],
  };
}

function runtimeTraceContextItem(
  anchor: RuntimeTraceAnchor,
  trace: TraceSummary,
  logs: readonly LogLine[],
  metrics: readonly MetricSeries[],
): ContextPackItem {
  const matchingLogs = logs.filter((log) => logMatchesTrace(log, anchor.traceId));
  return {
    id: `telemetry:runtime:${anchor.traceId}`,
    kind: ContextPackItemKind.Trace,
    title: `Runtime trace: ${trace.rootName}`,
    summary: `LGTM trace ${anchor.traceId} has ${trace.spanCount} spans, ${matchingLogs.length} correlated logs, and ${metrics.length} metric series.`,
    sourceRef: `trace:${anchor.traceId}`,
    required: false,
    freshness: ContextPackFreshness.Live,
    confidence: 0.93,
    reasons: [
      "lgtm:runtime_evidence",
      `trace_root:${trace.rootName}`,
      `span_count:${trace.spanCount}`,
    ],
    citationRefs: [
      `trace:${anchor.traceId}`,
      ...matchingLogs.map((log) => logCitationRef(log, anchor.traceId)),
      ...metrics.map((series, index) => metricCitationRef(series, index)),
    ],
    sourcePointers: [
      { kind: ContextPackSourcePointerKind.Trace, traceId: anchor.traceId },
      { kind: ContextPackSourcePointerKind.WorkItem, workItemId: anchor.workItemId },
      ...matchingLogs.map((log) => ({
        kind: ContextPackSourcePointerKind.Log,
        source: "loki",
        query: logQueryFor([anchor]),
        logRef: logCitationRef(log, anchor.traceId),
      } as const)),
      ...metrics.map((series, index) => ({
        kind: ContextPackSourcePointerKind.Metric,
        source: "mimir",
        query: metricQueryFor([anchor]),
        seriesId: metricSeriesId(series, index),
      } as const)),
    ],
  };
}

function runtimeTraceGraphRootSeed(
  request: ContextPackTelemetryEvidenceRequest,
  item: ContextPackItem,
): ContextPackGraphRootSeed {
  const organizationId = request.request.snapshot.organizationId ?? RUNTIME_EVIDENCE_SOURCE_ID;
  return {
    nodeId: graphNodeId(organizationId, GraphNodeKind.Trace, item.sourceRef.replace(/^trace:/, "")),
    title: item.title,
    citationRefs: item.citationRefs ?? [item.sourceRef],
    reasons: ["lgtm runtime evidence root"],
  };
}

function degradedTelemetryOmission(
  queryKind: typeof RuntimeEvidenceQueryKind[keyof typeof RuntimeEvidenceQueryKind],
  result: TelemetryQueryDegraded,
): ContextPackOmittedItem {
  return {
    nodeId: `${RUNTIME_EVIDENCE_NODE_ID}:${queryKind}`,
    reason: ContextPackOmissionReason.RetrievalFailed,
    message: `${result.source} ${queryKind} telemetry degraded: ${result.message}`,
  };
}

function traceQueryFor(anchors: readonly RuntimeTraceAnchor[]): string {
  return `{ traceID =~ "${tracePatternFor(anchors)}" }`;
}

function logQueryFor(anchors: readonly RuntimeTraceAnchor[]): string {
  return `{trace_id=~"${tracePatternFor(anchors)}"}`;
}

function metricQueryFor(anchors: readonly RuntimeTraceAnchor[]): string {
  return `sum by (trace_id) (agentic_runtime_signal{trace_id=~"${tracePatternFor(anchors)}"})`;
}

function tracePatternFor(anchors: readonly RuntimeTraceAnchor[]): string {
  return anchors.map((anchor) => escapeRegex(anchor.traceId)).join("|");
}

function logMatchesTrace(log: LogLine, traceId: string): boolean {
  return log.labels.trace_id === traceId || log.labels.traceId === traceId || log.line.includes(traceId);
}

function logCitationRef(log: LogLine, traceId: string): string {
  return `log:loki:${traceId}:${log.timestamp}`;
}

function metricCitationRef(series: MetricSeries, index: number): string {
  return `metric:mimir:${metricSeriesId(series, index)}`;
}

function metricSeriesId(series: MetricSeries, index: number): string {
  return series.labels.trace_id ?? series.labels.traceId ?? series.labels.__name__ ?? `series-${index}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
