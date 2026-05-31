import { deepEqual, rejects } from "node:assert/strict";
import { describe, test } from "node:test";

import { KeepAliveActionKind } from "../../keepalive/src/index.ts";
import {
  ControlPlaneAlertKind,
  createCockroachKeepAliveActionSink,
  type AppendControlPlaneAlertInput,
  type CockroachControlPlaneStateStore,
} from "../src/index.ts";

describe("cockroach keep-alive action sink (routes engine actions to durable state)", () => {
  test("EmitHeartbeat ticks the org heartbeat — the org proves it is alive", async () => {
    const recorder = createRecordingStore();
    const sink = createCockroachKeepAliveActionSink({
      store: recorder.store,
      organizationId: "org-1",
      generateAlertId: () => "alert-x",
    });

    await sink.applyAction({ kind: KeepAliveActionKind.EmitHeartbeat, ageMs: 100 });

    deepEqual(recorder.ticks, ["org-1"]);
    deepEqual(recorder.alerts, []);
  });

  test("RaiseOrgStallAlert appends an org-stall alert with the age + deadline detail", async () => {
    const recorder = createRecordingStore();
    const sink = createCockroachKeepAliveActionSink({
      store: recorder.store,
      organizationId: "org-1",
      generateAlertId: () => "alert-1",
    });

    await sink.applyAction({ kind: KeepAliveActionKind.RaiseOrgStallAlert, ageMs: 9000, deadlineMs: 5000 });

    deepEqual(recorder.alerts, [
      {
        alertId: "alert-1",
        organizationId: "org-1",
        kind: ControlPlaneAlertKind.OrgStall,
        detail: { ageMs: 9000, deadlineMs: 5000 },
      },
    ]);
  });

  test("ReassignStaleWork appends a reassignment alert naming the stale agent's work", async () => {
    const recorder = createRecordingStore();
    const sink = createCockroachKeepAliveActionSink({
      store: recorder.store,
      organizationId: "org-1",
      generateAlertId: () => "alert-2",
    });

    await sink.applyAction({
      kind: KeepAliveActionKind.ReassignStaleWork,
      staleAgentId: "agent-7",
      hatAssignmentId: "hat-3",
      workItemId: "work-9",
      heartbeatAgeMs: 12000,
    });

    deepEqual(recorder.alerts, [
      {
        alertId: "alert-2",
        organizationId: "org-1",
        kind: ControlPlaneAlertKind.StaleWorkReassignment,
        detail: { staleAgentId: "agent-7", hatAssignmentId: "hat-3", workItemId: "work-9", heartbeatAgeMs: 12000 },
      },
    ]);
  });

  test("ReapLease appends a lease-reap alert naming the reaped resource + fencing token", async () => {
    const recorder = createRecordingStore();
    const sink = createCockroachKeepAliveActionSink({
      store: recorder.store,
      organizationId: "org-1",
      generateAlertId: () => "alert-3",
    });

    await sink.applyAction({
      kind: KeepAliveActionKind.ReapLease,
      leaseId: "lease-5",
      resource: "build-runner",
      holderAgentId: "agent-2",
      fencingToken: 42,
    });

    deepEqual(recorder.alerts, [
      {
        alertId: "alert-3",
        organizationId: "org-1",
        kind: ControlPlaneAlertKind.LeaseReap,
        detail: { leaseId: "lease-5", resource: "build-runner", holderAgentId: "agent-2", fencingToken: 42 },
      },
    ]);
  });

  test("rejects an unknown action kind as a programmer error (exhaustive DU)", async () => {
    const recorder = createRecordingStore();
    const sink = createCockroachKeepAliveActionSink({
      store: recorder.store,
      organizationId: "org-1",
      generateAlertId: () => "alert-x",
    });

    await rejects(
      // deliberately bypass the type to prove the exhaustive default throws
      async () => sink.applyAction({ kind: "not_a_real_kind" } as never),
    );
  });
});

function createRecordingStore(): {
  store: CockroachControlPlaneStateStore;
  ticks: string[];
  alerts: AppendControlPlaneAlertInput[];
} {
  const ticks: string[] = [];
  const alerts: AppendControlPlaneAlertInput[] = [];

  return {
    ticks,
    alerts,
    store: {
      readOrgHeartbeatAgeMs: async () => undefined,
      tickOrgHeartbeat: async (organizationId: string) => {
        ticks.push(organizationId);
      },
      appendAlert: async (alert: AppendControlPlaneAlertInput) => {
        alerts.push(alert);
      },
      recordAgentHeartbeat: async () => {},
      readAgentHeartbeats: async () => [],
      upsertFlag: async () => {},
      listActiveFlags: async () => [],
      upsertRateLimit: async () => {},
      listActiveRateLimits: async () => [],
    },
  };
}
