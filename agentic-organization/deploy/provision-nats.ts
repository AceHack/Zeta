/**
 * Idempotently provision the JetStream stream + durable pull consumer the worker
 * binds to at startup (the worker fails-fast if the durable consumer does not
 * exist). Run from the host against a port-forwarded NATS:
 *
 *   kubectl -n agentic-org port-forward svc/nats 4222:4222 &
 *   node --experimental-strip-types deploy/provision-nats.ts
 *
 * Config mirrors the durable-worker live integration test. Override via env:
 *   NATS_PROVISION_SERVERS (default nats://127.0.0.1:4222)
 *   NATS_PROVISION_STREAM  (default agentic-org-events)
 *   NATS_PROVISION_DURABLE (default agentic-org-v0-automation-planner)
 *   NATS_PROVISION_ENV     (default dev)
 *   NATS_PROVISION_ORG     (default org-lfg)
 */

import {
  AckPolicy,
  DeliverPolicy,
  DiscardPolicy,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
  jetstreamManager,
} from "@nats-io/jetstream";
import { connect } from "@nats-io/transport-node";
import { env } from "node:process";

const servers = env.NATS_PROVISION_SERVERS ?? "nats://127.0.0.1:4222";
const streamName = env.NATS_PROVISION_STREAM ?? "agentic-org-events";
const durableName = env.NATS_PROVISION_DURABLE ?? "agentic-org-v0-automation-planner";
const environment = env.NATS_PROVISION_ENV ?? "dev";
const organizationId = env.NATS_PROVISION_ORG ?? "org-lfg";

// all events for this org/env (incl. dead-letters)
const allSubjects = `agentic-org.${environment}.${organizationId}.>`;
// the V0 automation planner reacts to supervisor signals
const consumerFilter = `agentic-org.${environment}.${organizationId}.supervisor_signal.>`;

async function main(): Promise<void> {
  const connection = await connect({ servers });
  try {
    const manager = await jetstreamManager(connection);

    await upsertStream(manager);
    await upsertConsumer(manager);

    console.log(
      JSON.stringify({
        provisioned: true,
        stream: streamName,
        subjects: [allSubjects],
        durable: durableName,
        filter: consumerFilter,
      }),
    );
  } finally {
    await connection.drain();
  }
}

async function upsertStream(manager: Awaited<ReturnType<typeof jetstreamManager>>): Promise<void> {
  try {
    await manager.streams.add({
      name: streamName,
      subjects: [allSubjects],
      retention: RetentionPolicy.Limits,
      discard: DiscardPolicy.Old,
      storage: StorageType.Memory,
      max_msgs: 1000,
    });
    console.log(`stream created: ${streamName}`);
  } catch (error) {
    if (isAlreadyExists(error)) {
      await manager.streams.update(streamName, { subjects: [allSubjects] });
      console.log(`stream already existed, subjects ensured: ${streamName}`);
      return;
    }
    throw error;
  }
}

async function upsertConsumer(manager: Awaited<ReturnType<typeof jetstreamManager>>): Promise<void> {
  try {
    await manager.consumers.add(streamName, {
      durable_name: durableName,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
      filter_subject: consumerFilter,
      max_deliver: 1,
    });
    console.log(`consumer created: ${durableName}`);
  } catch (error) {
    if (isAlreadyExists(error)) {
      console.log(`consumer already existed: ${durableName}`);
      return;
    }
    throw error;
  }
}

function isAlreadyExists(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("already") || message.includes("in use") || message.includes("exist");
}

await main();
