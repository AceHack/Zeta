import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  computeRestoreDrillChecksum,
  verifyRestoreDrill,
  type RestoreDrillSnapshot,
} from "../src/index.ts";

test("restore drill checksum is stable across projection and row ordering", () => {
  const before: RestoreDrillSnapshot = {
    organizationId: "org-lfg",
    capturedAt: "2026-05-31T20:00:00.000Z",
    projections: [
      { name: "work_items", rows: [{ id: "wi-2", state: "ready" }, { state: "done", id: "wi-1" }] },
      { name: "org_events", rows: [{ id: "evt-1", subjectId: "wi-1" }] },
    ],
  };
  const after: RestoreDrillSnapshot = {
    organizationId: "org-lfg",
    capturedAt: "2026-05-31T20:05:00.000Z",
    projections: [
      { name: "org_events", rows: [{ subjectId: "wi-1", id: "evt-1" }] },
      { name: "work_items", rows: [{ id: "wi-1", state: "done" }, { id: "wi-2", state: "ready" }] },
    ],
  };

  const result = verifyRestoreDrill(before, after);

  equal(result.status, "passed");
  equal(result.before.checksum, result.after.checksum);
  equal(result.before.rowCount, 3);
});

test("restore drill fails when replayed projections differ", () => {
  const before: RestoreDrillSnapshot = {
    organizationId: "org-lfg",
    capturedAt: "2026-05-31T20:00:00.000Z",
    projections: [{ name: "work_items", rows: [{ id: "wi-1", state: "ready" }] }],
  };
  const after: RestoreDrillSnapshot = {
    organizationId: "org-lfg",
    capturedAt: "2026-05-31T20:05:00.000Z",
    projections: [{ name: "work_items", rows: [{ id: "wi-1", state: "blocked" }] }],
  };

  const result = verifyRestoreDrill(before, after);

  equal(result.status, "failed");
  if (result.status !== "failed") return;
  equal(result.reason, "checksum_mismatch");
  ok(computeRestoreDrillChecksum(before).checksum !== computeRestoreDrillChecksum(after).checksum);
});
