import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { infiniteBacklogNudgeHandler } from "./infinite-backlog-subscriber";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("infinite-backlog-nudge subscriber (B-0459 slice 5.1)", () => {
  const testShardPath = join(require("node:os").tmpdir(), "zeta-test-ticks-nudge-" + Date.now());
  
  beforeEach(() => {
    try { rmSync(testShardPath, { recursive: true, force: true }); } catch {}
  });

  afterEach(() => {
    try { rmSync(testShardPath, { recursive: true, force: true }); } catch {}
  });

  test("Envelope present -> logged to shard, no error", async () => {
    const envelope = {
      id: "env-1",
      topic: "infinite-backlog-nudge",
      payload: { idleMinutes: 18.3, rationale: "testing rationale" }
    };

    const originalCwd = process.cwd;
    process.cwd = () => testShardPath;
    await infiniteBacklogNudgeHandler(envelope);
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
    expect(content).toContain("[bus/infinite-backlog-nudge] Consumed envelope env-1");
    expect(content).toContain("idleMinutes=18.3");
    expect(content).toContain("testing rationale");
  });

  test("Malformed envelope -> logged as warning, consumed, no throw", async () => {
    const envelope = {
      id: "env-2",
      topic: "infinite-backlog-nudge",
      payload: { rationale: "malformed" }
    };
    
    const originalCwd = process.cwd;
    process.cwd = () => testShardPath;
    await infiniteBacklogNudgeHandler(envelope);
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
    expect(content).toContain("WARNING: Consumed malformed envelope env-2");
  });
});
