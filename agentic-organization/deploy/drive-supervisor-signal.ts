/**
 * Drive one supervisor-signal flow end to end against the in-cluster substrate.
 *
 * Publishes a single `supervisor_signal.sent` AgenticEventEnvelope onto the
 * JetStream stream the worker consumes. The worker's V0 automation rules turn it
 * into a `CreateSupervisorTriage` reaction plan, executes it through the Hermes
 * agent run, and the agent's model-backed composer asks the in-cluster Ollama
 * model which legal move to make (the decision kernel re-checks the choice, so
 * the model can never widen the rules). This is the loop the docs describe:
 * observe -> legal menu -> model decides -> legality re-check.
 *
 * Run from the host against a port-forwarded NATS (mirrors provision-nats.ts):
 *
 *   kubectl -n agentic-org port-forward svc/nats 4222:4222 &
 *   node --experimental-strip-types deploy/drive-supervisor-signal.ts
 *
 * Config (env overrides):
 *   NATS_PROVISION_SERVERS (default nats://127.0.0.1:4222)
 *   NATS_PROVISION_ENV     (default dev)
 *   NATS_PROVISION_ORG     (default org-lfg)
 */

import { randomUUID } from "node:crypto";
import { env } from "node:process";

import { connect } from "@nats-io/transport-node";
import { jetstream } from "@nats-io/jetstream";

import {
  AgenticAggregateType,
  AgenticEventType,
  EventSchemaVersion,
  SupervisorChainLevel,
  createAgenticEventEnvelope,
} from "../packages/domain/src/index.ts";
import { AgenticMessagingDomain, buildAgenticEventSubject } from "../packages/messaging/src/index.ts";

const servers = env.NATS_PROVISION_SERVERS ?? "nats://127.0.0.1:4222";
const environment = env.NATS_PROVISION_ENV ?? "dev";
const organizationId = env.NATS_PROVISION_ORG ?? "org-lfg";

async function main(): Promise<void> {
  const runId = randomUUID();
  const subject = buildAgenticEventSubject({
    environment,
    organizationId,
    domain: AgenticMessagingDomain.SupervisorSignal,
    eventType: AgenticEventType.SupervisorSignalSent,
  });

  const envelope = createAgenticEventEnvelope({
    eventId: `evt-${runId}`,
    eventType: AgenticEventType.SupervisorSignalSent,
    schemaVersion: EventSchemaVersion.AgenticOrgEventV1,
    occurredAt: new Date().toISOString(),
    actor: {
      agentId: `agent-driver-${runId}`,
      hatAssignmentId: `hat-assignment-driver-${runId}`,
    },
    scope: {
      organizationId,
      projectId: `project-${runId}`,
      teamId: `team-${runId}`,
      workItemId: `work-item-${runId}`,
    },
    aggregate: {
      aggregateId: `supervisor-signal-${runId}`,
      aggregateType: AgenticAggregateType.SupervisorSignal,
      aggregateVersion: 1,
    },
    trace: {
      commandId: `command-${runId}`,
      correlationId: `correlation-${runId}`,
      causationId: `causation-${runId}`,
      traceId: `trace-${runId}`,
      idempotencyKey: `idempotency-${runId}`,
    },
    payload: {
      targetHatAssignmentId: `hat-assignment-target-${runId}`,
      targetLevel: SupervisorChainLevel.Manager,
    },
  });

  const connection = await connect({ servers });
  try {
    const js = jetstream(connection);
    const ack = await js.publish(subject, JSON.stringify(envelope));
    console.log(
      JSON.stringify({
        published: true,
        subject,
        eventId: envelope.eventId,
        stream: ack.stream,
        seq: ack.seq,
      }),
    );
  } finally {
    await connection.drain();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
