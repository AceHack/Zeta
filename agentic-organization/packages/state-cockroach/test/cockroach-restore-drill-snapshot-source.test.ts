import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import type { CockroachAnySqlResult, CockroachAnySqlStatement } from "../src/index.ts";
import { createCockroachRestoreDrillSnapshotSource } from "../src/index.ts";

describe("cockroach restore-drill snapshot source", () => {
  test("captures stable tenant-scoped projections for restore checksum comparison", async () => {
    const statements: CockroachAnySqlStatement[] = [];
    const source = createCockroachRestoreDrillSnapshotSource({
      organizationId: "org-restore",
      capturedAt: () => "2026-05-31T23:50:00.000Z",
      executor: {
        execute: async <Row>(statement: CockroachAnySqlStatement): Promise<CockroachAnySqlResult<Row>> => {
          statements.push(statement);
          if (statement.name === "restore_drill_snapshot_org_events") {
            return rows<Row>([
              {
                org_event_id: "evt-1",
                kind: "observe_act_tick",
                subject_id: "work-1",
                from_state: null,
                to_state: null,
                decision: "selected",
                correlation_id: "corr-1",
                causation_id: "cause-1",
                trace_id: "trace-1",
                occurred_at: "2026-05-31T23:49:00.000Z",
              },
            ]);
          }
          if (statement.name === "restore_drill_snapshot_control_plane_flags") {
            return rows<Row>([
              {
                control_plane_flag_id: "flag-1",
                scope_kind: "provider",
                scope_id: "github",
                flag: "provider_freeze",
                reason: "proof",
                set_by_hat_id: "incident_commander",
                set_at: "2026-05-31T23:48:00.000Z",
                expires_at: null,
              },
            ]);
          }
          if (statement.name === "restore_drill_snapshot_control_plane_rate_limits") {
            return rows<Row>([
              {
                control_plane_rate_limit_id: "limit-1",
                scope_kind: "tenant",
                scope_id: "org-restore",
                kind: "external_provider_calls",
                window_started_at: "2026-05-31T23:00:00.000Z",
                window_ends_at: "2026-06-01T00:00:00.000Z",
                limit_count: "1",
                used_count: "1",
                requested_count: null,
              },
            ]);
          }
          throw new Error(`unexpected statement ${statement.name}`);
        },
        executeTransaction: async () => {
          throw new Error("restore snapshot source should not need a transaction");
        },
      },
    });

    const snapshot = await source.captureSnapshot();

    equal(snapshot.organizationId, "org-restore");
    equal(snapshot.capturedAt, "2026-05-31T23:50:00.000Z");
    deepEqual(snapshot.projections.map((projection) => projection.name), [
      "org_events",
      "control_plane_flags",
      "control_plane_rate_limits",
    ]);
    deepEqual(statements.map((statement) => [statement.name, statement.parameters]), [
      ["restore_drill_snapshot_org_events", ["org-restore"]],
      ["restore_drill_snapshot_control_plane_flags", ["org-restore"]],
      ["restore_drill_snapshot_control_plane_rate_limits", ["org-restore"]],
    ]);
    deepEqual(snapshot.projections[2]?.rows[0], {
      controlPlaneRateLimitId: "limit-1",
      scopeKind: "tenant",
      scopeId: "org-restore",
      kind: "external_provider_calls",
      windowStartedAt: "2026-05-31T23:00:00.000Z",
      windowEndsAt: "2026-06-01T00:00:00.000Z",
      limit: 1,
      used: 1,
      requested: null,
    });
  });
});

function rows<Row>(value: readonly Record<string, unknown>[]): CockroachAnySqlResult<Row> {
  return {
    rows: value as readonly Row[],
  };
}
