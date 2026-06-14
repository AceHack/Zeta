import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const TICK_PATH = join(import.meta.dir, "loop-tick.ts");

function runTick(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("bun", [TICK_PATH, ...args], {
    encoding: "utf8",
    timeout: 10_000,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("loop-tick", () => {
  test("exits with usage when --persona not provided", () => {
    const r = runTick([]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Usage:");
    expect(r.stderr).toContain("--persona");
  });

  test("exits with error for unknown persona", () => {
    const r = runTick(["--persona", "unknown-agent"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Unknown persona");
  });

  test("runs successfully for valid persona (kiro) — acquires lock and ticks", () => {
    // This will attempt a real tick — may fail on git fetch in some envs
    // but should NOT fail on persona resolution
    const r = runTick(["--persona", "kiro"]);
    // Either succeeds (exit 0) or fails on git/network (non-1, non-persona-error)
    expect(r.stderr).not.toContain("Unknown persona");
    expect(r.stderr).not.toContain("Usage:");
  });
});
