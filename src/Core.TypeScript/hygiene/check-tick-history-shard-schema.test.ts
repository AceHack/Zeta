import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { ScanResult } from "./check-tick-history-shard-schema";

type ScanOne = (shardPath: string) => ScanResult;

let TMPDIR: string;
let scanOne: ScanOne;
let priorRepoRoot: string | undefined;

beforeAll(async () => {
  TMPDIR = mkdtempSync(join(tmpdir(), "shard-schema-test-"));
  priorRepoRoot = process.env["REPO_ROOT"];
  process.env["REPO_ROOT"] = TMPDIR;
  const mod = await import("./check-tick-history-shard-schema");
  scanOne = mod.scanOne;
});

afterAll(() => {
  if (priorRepoRoot === undefined) delete process.env["REPO_ROOT"];
  else process.env["REPO_ROOT"] = priorRepoRoot;
  if (TMPDIR) rmSync(TMPDIR, { recursive: true, force: true });
});

function writeShard(relPath: string, content: string): string {
  const full = join(TMPDIR, "docs/hygiene-history/ticks", relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

const SIX_COLS = "| 2026-05-17T12:34Z | a | b | c | d | e |\n";

describe("scanOne", () => {
  test("accepts a valid HHMMZ.md shard", () => {
    const path = writeShard("2026/05/17/1234Z.md", SIX_COLS);
    const result = scanOne(path);

    expect(result.ok).toBe(true);
    expect(result.violation).toBeUndefined();
  });

  test("accepts HHMMZ-<hex>.md filename variant", () => {
    const path = writeShard("2026/05/17/1234Z-abc123.md", SIX_COLS);
    const result = scanOne(path);

    expect(result.ok).toBe(true);
  });

  test("accepts col1 with seconds (HH:MM:SSZ) when minutes match filename", () => {
    const content = "| 2026-05-17T12:34:56Z | a | b | c | d | e |\n";
    const path = writeShard("2026/05/17/1234Z.md", content);
    const result = scanOne(path);

    expect(result.ok).toBe(true);
  });

  test("flags filename that does not match any schema regex", () => {
    const path = writeShard("2026/05/17/foo.md", SIX_COLS);
    const result = scanOne(path);

    expect(result.ok).toBe(false);
    expect(result.violation).toContain("filename does not match");
  });

  test("flags col1 date mismatch with path date", () => {
    const content = "| 2026-05-18T12:34Z | a | b | c | d | e |\n";
    const path = writeShard("2026/05/17/1234Z.md", content);
    const result = scanOne(path);

    expect(result.ok).toBe(false);
    expect(result.violation).toContain("does not match path date");
  });

  test("flags col1 time mismatch with filename time", () => {
    const content = "| 2026-05-17T12:35Z | a | b | c | d | e |\n";
    const path = writeShard("2026/05/17/1234Z.md", content);
    const result = scanOne(path);

    expect(result.ok).toBe(false);
    expect(result.violation).toContain("does not match filename");
  });

  test("flags first row with fewer than 6 columns (7+ pipes)", () => {
    const content = "| 2026-05-17T12:34Z | only one col |\n";
    const path = writeShard("2026/05/17/1234Z.md", content);
    const result = scanOne(path);

    expect(result.ok).toBe(false);
    expect(result.violation).toContain("pipes");
  });

  test("flags empty file", () => {
    const path = writeShard("2026/05/17/1234Z.md", "");
    const result = scanOne(path);

    expect(result.ok).toBe(false);
    expect(result.violation).toBe("file is empty");
  });

  test("flags col1 missing leading pipe-space-timestamp format", () => {
    const content = "|2026-05-17T12:34Z | a | b | c | d | e |\n";
    const path = writeShard("2026/05/17/1234Z.md", content);
    const result = scanOne(path);

    expect(result.ok).toBe(false);
    expect(result.violation).toContain("col1 must be exactly");
  });
});
