import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadWorkItemDoraMetrics } from "./work-item-metrics";
import { makeCreatedEvent, mintWorkItemEventIdHex } from "../work-items/types";
import { DETERMINISTIC_ENV } from "../zeta-id/zeta-id";
import { writeEvent } from "../work-items/publish";

describe("loadWorkItemDoraMetrics", () => {
  it("returns null when events dir is absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "wi-metrics-absent-"));
    try {
      expect(loadWorkItemDoraMetrics(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("folds metrics when events exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "wi-metrics-present-"));
    const eventsRoot = join(dir, "events");
    mkdirSync(eventsRoot, { recursive: true });
    try {
      const event = makeCreatedEvent(
        {
          workItemId: "081KSXN940008QG0R002FWR9B2",
          type: "task",
          title: "T",
          slug: "t",
          priority: "P2",
          filename: "081KSXN940008QG0R002FWR9B2-t.md",
        },
        "otto",
        Date.UTC(2026, 6, 2, 12, 0, 0),
        (ms) => mintWorkItemEventIdHex(DETERMINISTIC_ENV, ms),
      );
      writeEvent(event, eventsRoot);
      const m = loadWorkItemDoraMetrics(dir);
      expect(m).not.toBeNull();
      expect(m!.openByType.total).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
