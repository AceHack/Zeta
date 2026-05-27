import type { WorkerRuntimeTelemetryRecord, WorkerRuntimeTelemetrySink } from "../worker-runtime.ts";

export type JsonWorkerTelemetryRecord = {
  timestamp: string;
  eventName: WorkerRuntimeTelemetryRecord["eventName"];
  attributes: WorkerRuntimeTelemetryRecord["attributes"];
};

export type JsonLineWriter = {
  write: (record: JsonWorkerTelemetryRecord) => Promise<void>;
};

export type CreateJsonWorkerTelemetrySinkInput = {
  writer: JsonLineWriter;
  now: () => string;
};

export function createJsonWorkerTelemetrySink(input: CreateJsonWorkerTelemetrySinkInput): WorkerRuntimeTelemetrySink {
  return {
    record: async (record) => {
      await input.writer.write({
        timestamp: input.now(),
        eventName: record.eventName,
        attributes: record.attributes,
      });
    },
  };
}
