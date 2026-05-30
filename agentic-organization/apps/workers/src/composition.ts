import type { KeepAliveLane } from "../../../packages/keepalive/src/index.ts";
import type { NatsJetStreamEventConsumer } from "../../../packages/messaging-nats/src/index.ts";
import type { OrganizationWorkerHost } from "../../../packages/workers/src/index.ts";
import {
  createWorkerRuntime,
  type WorkerRuntime,
  type WorkerRuntimeConfig,
  type WorkerRuntimeTelemetrySink,
} from "./worker-runtime.ts";

export type WorkerRuntimePorts = {
  organizationWorkerHost: OrganizationWorkerHost;
  natsEventConsumer: NatsJetStreamEventConsumer;
  telemetrySink: WorkerRuntimeTelemetrySink;
  /** optional so in-memory composition paths can omit the durable keep-alive lane */
  keepAliveLane?: KeepAliveLane;
};

export type ComposeWorkerRuntimeInput = {
  config: WorkerRuntimeConfig;
  ports: WorkerRuntimePorts;
};

export function composeWorkerRuntime(input: ComposeWorkerRuntimeInput): WorkerRuntime {
  return createWorkerRuntime({
    config: input.config,
    organizationWorkerHost: input.ports.organizationWorkerHost,
    natsEventConsumer: input.ports.natsEventConsumer,
    telemetrySink: input.ports.telemetrySink,
    ...(input.ports.keepAliveLane === undefined ? {} : { keepAliveLane: input.ports.keepAliveLane }),
  });
}
