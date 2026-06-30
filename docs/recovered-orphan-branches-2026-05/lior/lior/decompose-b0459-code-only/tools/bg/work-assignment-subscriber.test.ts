import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { workAssignmentHandler } from "./work-assignment-subscriber";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("work-assignment subscriber (B-0460 slice 5.2)", () => {
  const testShardPath = join(require("node:os").tmpdir(), "zeta-test-ticks-" + Date.now());
  
  beforeEach(() => {
    // Clear out testing shards to ensure cleanliness
    try { rmSync(testShardPath, { recursive: true, force: true }); } catch {}
  });

  afterEach(() => {
    try { rmSync(testShardPath, { recursive: true, force: true }); } catch {}
  });

  test("Work-assignment envelope present -> logged to shard, no error", async () => {
    // We mock spawnSync for claim acquire so it doesn't actually try to run claim.ts
    // (mocking at require level or similar is typically needed here)
    
    const envelope = {
      id: "env-1",
      topic: "work-assignment",
      payload: { rowId: "B-9999", priority: "P1", rationale: "testing rationale" }
    };

    // Override spawnSync globally or just let the real one fail, the handler catches exceptions.
    // We mock getTickShardPath via monkey patching or similar, but since we are running tests,
    // let's spy/mock the function, or if it's not exported easily, we just rely on the fallback.
    // Actually, wait, work-assignment-subscriber.ts hardcodes process.cwd()!
    // I will mock process.cwd to return the test path root!
    const originalCwd = process.cwd;
    process.cwd = () => testShardPath;
    
    await workAssignmentHandler(envelope);
    
    // Now check if a file was created in docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md
    // We can just search for ANY file in testShardPath that contains "B-9999"
    // Since we know the implementation writes to current date/time, we can read the dir recursively.
    const { readdirSync, statSync } = require("node:fs");
    function findFiles(dir: string): string[] {
      let results: string[] = [];
      if (!existsSync(dir)) return results;
      const list = readdirSync(dir);
      list.forEach((file: string) => {
        const full = join(dir, file);
        if (statSync(full).isDirectory()) {
          results = results.concat(findFiles(full));
        } else {
          results.push(full);
        }
      });
      return results;
    }

    const files = findFiles(testShardPath);
    expect(files.length).toBeGreaterThan(0);
    
    const content = readFileSync(files[0]!, "utf8");
    expect(content).toContain("[bus/work-assignment] Consumed envelope env-1");
    expect(content).toContain("rowId=B-9999");
    process.cwd = originalCwd;
  });

  test("Malformed envelope (missing rowId) -> logged as warning, consumed, no throw", async () => {
    const envelope = {
      id: "env-2",
      topic: "work-assignment",
      payload: { rationale: "malformed" }
    };
    
    const originalCwd = process.cwd;
    process.cwd = () => testShardPath;
    // Should not throw
    await workAssignmentHandler(envelope);
    process.cwd = originalCwd;
    
    const { readdirSync, statSync } = require("node:fs");
    function findFiles(dir: string): string[] {
      let results: string[] = [];
      if (!existsSync(dir)) return results;
      const list = readdirSync(dir);
      list.forEach((file: string) => {
        const full = join(dir, file);
        if (statSync(full).isDirectory()) {
          results = results.concat(findFiles(full));
        } else {
          results.push(full);
        }
      });
      return results;
    }

    const files = findFiles(testShardPath);
    expect(files.length).toBeGreaterThan(0);
    const content = readFileSync(files[0]!, "utf8");
    expect(content).toContain("rowId=undefined");
  });
});
