/**
 * Spin up a task: publish a canonical SupervisorSignalSent event to the org's
 * JetStream subject. The deployed worker's NATS consumer ingests it, the V0
 * automation planner reacts (CreateSupervisorTriage), and a reaction plan is
 * created + executed — exercising the autonomous data-plane pipeline end to end.
 *
 *   kubectl -n agentic-org port-forward svc/nats 14222:4222 &
 *   node --experimental-strip-types deploy/spin-up-task.ts
 */

import { jetstream } from "@nats-io/jetstream";
import { connect } from "@nats-io/transport-node";
import { randomUUID } from "node:crypto";
import { env } from "node:process";

import {
  AgenticAggregateType,
  AgenticEventType,
  EventSchemaVersion,
  SupervisorChainLevel,
  createAgenticEventEnvelope,
} from "../packages/domain/src/index.ts";
import { AgenticMessagingDomain, buildAgenticEventSubject } from "../packages/messaging/src/index.ts";

const servers = env.NATS_PROVISION_SERVERS ?? "nats://127.0.0.1:14222";
const environment = env.NATS_PROVISION_ENV ?? "dev";
const organizationId = env.NATS_PROVISION_ORG ?? "org-lfg";

async function main(): Promise<void> {
  const runId = randomUUID();
  const eventId = `evt-${runId}`;

  const envelope = createAgenticEventEnvelope({
    eventId,
    eventType: AgenticEventType.SupervisorSignalSent,
    schemaVersion: EventSchemaVersion.AgenticOrgEventV1,
    occurredAt: "2026-05-30T06:30:00.000Z",
    actor: { agentId: `agent-${runId}`, hatAssignmentId: `hat-${runId}` },
    scope: {
      organizationId,
      projectId: `project-${runId}`,
      teamId: `team-${runId}`,
      workItemId: `work-${runId}`,
    },
    aggregate: {
      aggregateId: `supervisor-signal-${runId}`,
      aggregateType: AgenticAggregateType.SupervisorSignal,
      aggregateVersion: 1,
    },
    trace: {
      commandId: `cmd-${runId}`,
      correlationId: `corr-${runId}`,
      causationId: `cause-${runId}`,
      traceId: `trace-${runId}`,
      idempotencyKey: `idem-${runId}`,
    },
    replay: { isReplay: false },
    payload: {
      targetHatAssignmentId: `target-hat-${runId}`,
      targetLevel: SupervisorChainLevel.Manager,
    },
  });

  const subject = buildAgenticEventSubject({
    environment,
    organizationId,
    domain: AgenticMessagingDomain.SupervisorSignal,
    eventType: AgenticEventType.SupervisorSignalSent,
  });

  const connection = await connect({ servers });
  try {
    const js = jetstream(connection);
    const ack = await js.publish(subject, new TextEncoder().encode(JSON.stringify(envelope)), {
      msgID: eventId,
    });
    console.log(
      JSON.stringify({
        published: true,
        subject,
        eventId,
        stream: ack.stream,
        seq: ack.seq,
        workItemId: envelope.scope.workItemId,
        teamId: envelope.scope.teamId,
        targetLevel: envelope.payload.targetLevel,
      }),
    );
  } finally {
    await connection.drain();
  }
}

await main();
