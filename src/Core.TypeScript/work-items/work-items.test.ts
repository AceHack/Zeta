import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DETERMINISTIC_ENV, unpack } from "../zeta-id/zeta-id";
import { Category } from "../zeta-id/types";
import { eventPath, makeCreatedEvent, mintWorkItemEventIdHex, serializeEvent } from "./types";
import { writeEvent } from "./publish";

let ROOT: string;

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "work-items-test-"));
});
afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe("mintWorkItemEventIdHex", () => {
  it("is 32 hex in WorkItem category", () => {
    const hex = mintWorkItemEventIdHex(DETERMINISTIC_ENV, 1_700_000_000_000);
    expect(hex).toMatch(/^[0-9a-f]{32}$/);
    expect(unpack(BigInt(`0x${hex}`) as never).category).toBe(Category.WorkItem);
  });
});

describe("writeEvent", () => {
  it("creates a dated json file and is idempotent on identical content", () => {
    const event = makeCreatedEvent(
      {
        workItemId: "081KSXN940008QG0R002FWR9B2",
        type: "task",
        title: "Test item",
        slug: "test-item",
        priority: "P2",
        filename: "081KSXN940008QG0R002FWR9B2-test-item.md",
      },
      "otto-cli",
      Date.UTC(2026, 6, 2, 12, 0, 0),
      (ms) => mintWorkItemEventIdHex(DETERMINISTIC_ENV, ms),
    );
    const first = writeEvent(event, ROOT);
    expect(first.kind).toBe("created");
    expect(existsSync(first.path)).toBe(true);
    expect(readFileSync(first.path, "utf-8")).toBe(serializeEvent(event));

    const second = writeEvent(event, ROOT);
    expect(second.kind).toBe("exists-identical");
    expect(second.path).toBe(first.path);
  });

  it("surfaces collision when same id has different content", () => {
    const atMs = Date.UTC(2026, 6, 2, 12, 0, 0);
    const mintAt = (ms: number) => mintWorkItemEventIdHex(DETERMINISTIC_ENV, ms);
    const a = makeCreatedEvent(
      {
        workItemId: "081KSXN940008QG0R002FWR9B2",
        type: "task",
        title: "A",
        slug: "a",
        priority: "P2",
        filename: "081KSXN940008QG0R002FWR9B2-a.md",
      },
      "otto-cli",
      atMs,
      mintAt,
    );
    const b = { ...a, payload: { ...a.payload, title: "B" } };
    writeEvent(a, ROOT);
    expect(writeEvent(b, ROOT).kind).toBe("collision");
  });

  it("partitions by event.at (not wall clock)", () => {
    const atMs = Date.UTC(2026, 6, 2, 0, 0, 0);
    const id = mintWorkItemEventIdHex(DETERMINISTIC_ENV, atMs);
    expect(eventPath(ROOT, id, new Date(atMs))).toBe(join(ROOT, "2026", "07", "02", `${id}.json`));
  });
});
