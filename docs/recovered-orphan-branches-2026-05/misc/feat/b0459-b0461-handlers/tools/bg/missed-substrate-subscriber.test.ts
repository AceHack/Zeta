import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { missedSubstrateCascadeHandler } from "./missed-substrate-subscriber";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("missed-substrate-cascade subscriber (B-0461 slice 5.3)", () => {
  const testShardPath = join(require("node:os").tmpdir(), "zeta-test-ticks-cascade-" + Date.now());
  
  beforeEach(() => {
    try { rmSync(testShardPath, { recursive: true, force: true }); } catch {}
  });

  afterEach(() => {
    try { rmSync(testShardPath, { recursive: true, force: true }); } catch {}
  });

  test("Envelope present -> logged to shard, no error", async () => {
    const envelope = {
      id: "env-1",
      topic: "missed-substrate-cascade",
      payload: { prNumber: 2980, branchRef: "otto/section-2980", missedCommitCount: 1, rationale: "testing rationale" }
    };

    const originalCwd = process.cwd;
    process.cwd = () => testShardPath;
    await missedSubstrateCascadeHandler(envelope);
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
    expect(content).toContain("[bus/missed-substrate-cascade] Consumed envelope env-1");
    expect(content).toContain("prNumber=2980");
    expect(content).toContain("branchRef=otto/section-2980");
    expect(content).toContain("missedCommitCount=1");
    expect(content).toContain("testing rationale");
  });

  test("Malformed envelope -> logged as warning, consumed, no throw", async () => {
    const envelope = {
      id: "env-2",
      topic: "missed-substrate-cascade",
      payload: { rationale: "malformed" }
    };
    
    const originalCwd = process.cwd;
    process.cwd = () => testShardPath;
    await missedSubstrateCascadeHandler(envelope);
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
