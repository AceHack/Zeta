import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSocietyEventIndex } from "./society-event-index";
import { rebuildSocietyEventIndex } from "./society-event-index-rebuild";

const workspaces: string[] = [];
function workspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-society-index-"));
  workspaces.push(dir);
  return dir;
}
function event(id: string, at: string): string {
  return `${JSON.stringify({ id, at, by: "society", kind: "evolution" }, null, 2)}\n`;
}
afterEach(() => { while (workspaces.length > 0) rmSync(workspaces.pop()!, { recursive: true, force: true }); });

describe("SocietyEventIndexRebuild", () => {
  test("SEIR-1: bootstraps an independently valid chain sorted by event time, not filename", () => {
    const dir = workspace();
    writeFileSync(join(dir, "society-z.json"), event("society-late", "2026-08-12T12:00:00.000Z"));
    writeFileSync(join(dir, "society-a.json"), event("society-early", "2026-08-12T01:00:00.000Z"));
    const index = rebuildSocietyEventIndex(dir, "test-revision");
    validateSocietyEventIndex(index);
    expect(index.events.map(entry => entry.id)).toEqual(["society-early", "society-late"]);
    expect(index.events.every(entry => entry.sourceRevision === "test-revision")).toBeTrue();
  });

  test("SEIR-2 FAULT INJECTION: malformed committed event is rejected instead of being silently omitted", () => {
    const dir = workspace();
    writeFileSync(join(dir, "society-bad.json"), "{not-json}");
    expect(() => rebuildSocietyEventIndex(dir)).toThrow("teaching error");
  });

  test("SEIR-3: a prior society-index manifest is not misread as a society event during rebuild", () => {
    const dir = workspace();
    writeFileSync(join(dir, "society-one.json"), event("society-one", "2026-08-12T01:00:00.000Z"));
    rebuildSocietyEventIndex(dir);
    const rebuilt = rebuildSocietyEventIndex(dir);
    expect(rebuilt.eventCount).toBe(1);
    expect(rebuilt.events[0]!.id).toBe("society-one");
  });
});
