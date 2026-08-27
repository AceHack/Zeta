// filter_gate_log.test.ts — tests for filter-gate decision log.
//
// 081KQ3HBZ0008QG0R002S674CG responsibility #3: candidate-failure honesty log.
// Tests CLI arg parsing, entry recording, log reading, and summary.
//
// Run: bun test src/Core.TypeScript/alignment/filter_gate_log.test.ts

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeSummary,
  type FilterGateEntry,
  main,
  parseArgs,
  readLog,
} from "./filter_gate_log.ts";

/**
 * A fresh 0700 directory per call.
 *
 * These paths were hardcoded `/tmp/filter-gate-test-*.jsonl` — fixed names in a world-writable
 * shared directory (CodeQL `js/insecure-temporary-file`). Two concurrent runs of this suite would
 * write the same file, and any local user could pre-create it as a symlink and redirect the write.
 * `mkdtempSync` is atomic and unique by construction, so neither is possible.
 */
function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-filter-gate-"));
  createdDirs.push(dir);
  return dir;
}

const createdDirs: string[] = [];
afterAll(() => {
  for (const d of createdDirs) rmSync(d, { recursive: true, force: true });
});


describe("parseArgs", () => {
  test("returns help for -h", () => {
    expect(parseArgs(["-h"])).toEqual({ kind: "help" });
  });

  test("returns help for --help", () => {
    expect(parseArgs(["--help"])).toEqual({ kind: "help" });
  });

  test("errors when no mode specified", () => {
    const result = parseArgs([]);
    expect(result.kind).toBe("error");
  });

  test("parses --list mode", () => {
    const result = parseArgs(["--list"]);
    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.mode).toBe("list");
    }
  });

  test("parses --list --json", () => {
    const result = parseArgs(["--list", "--json"]);
    expect(result.kind).toBe("args");
    if (result.kind === "args" && result.args.mode === "list") {
      expect(result.args.json).toBe(true);
      expect(result.args.md).toBe(false);
    }
  });

  test("parses --list --md", () => {
    const result = parseArgs(["--list", "--md"]);
    expect(result.kind).toBe("args");
    if (result.kind === "args" && result.args.mode === "list") {
      expect(result.args.md).toBe(true);
      expect(result.args.json).toBe(false);
    }
  });

  test("parses --summary mode", () => {
    const result = parseArgs(["--summary"]);
    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.mode).toBe("summary");
    }
  });

  test("parses full --record with all fields", () => {
    const result = parseArgs([
      "--record",
      "--candidate", "skill:foo",
      "--source", "081KQ3HBZ0008QG0R0034DHWTQ",
      "--decision", "fail",
      "--rationale", "Breaks retractibility",
      "--clauses", "HC-1,SD-3",
    ]);
    expect(result.kind).toBe("args");
    if (result.kind === "args" && result.args.mode === "record") {
      expect(result.args.candidate).toBe("skill:foo");
      expect(result.args.source).toBe("081KQ3HBZ0008QG0R0034DHWTQ");
      expect(result.args.decision).toBe("fail");
      expect(result.args.rationale).toBe("Breaks retractibility");
      expect(result.args.clauses).toEqual(["HC-1", "SD-3"]);
    }
  });

  test("parses --record without --clauses (defaults to empty)", () => {
    const result = parseArgs([
      "--record",
      "--candidate", "glossary:bar",
      "--source", "081KQ3HBZ0008QG0R003GTG5P2",
      "--decision", "pass",
      "--rationale", "Additive and retractible",
    ]);
    expect(result.kind).toBe("args");
    if (result.kind === "args" && result.args.mode === "record") {
      expect(result.args.clauses).toEqual([]);
    }
  });

  test("errors when --record missing --candidate", () => {
    const result = parseArgs([
      "--record",
      "--source", "081KQ3HBZ0008QG0R0034DHWTQ",
      "--decision", "fail",
      "--rationale", "missing candidate",
    ]);
    expect(result.kind).toBe("error");
  });

  test("errors when --record missing --source", () => {
    const result = parseArgs([
      "--record",
      "--candidate", "skill:foo",
      "--decision", "fail",
      "--rationale", "missing source",
    ]);
    expect(result.kind).toBe("error");
  });

  test("errors when --record missing --decision", () => {
    const result = parseArgs([
      "--record",
      "--candidate", "skill:foo",
      "--source", "081KQ3HBZ0008QG0R0034DHWTQ",
      "--rationale", "missing decision",
    ]);
    expect(result.kind).toBe("error");
  });

  test("errors when --record missing --rationale", () => {
    const result = parseArgs([
      "--record",
      "--candidate", "skill:foo",
      "--source", "081KQ3HBZ0008QG0R0034DHWTQ",
      "--decision", "pass",
    ]);
    expect(result.kind).toBe("error");
  });

  test("errors on invalid decision value", () => {
    const result = parseArgs([
      "--record",
      "--candidate", "skill:foo",
      "--source", "081KQ3HBZ0008QG0R0034DHWTQ",
      "--decision", "maybe",
      "--rationale", "invalid decision",
    ]);
    expect(result.kind).toBe("error");
  });

  test("errors on unknown arg", () => {
    const result = parseArgs(["--bad-flag"]);
    expect(result.kind).toBe("error");
  });

  test("accepts all three valid decisions", () => {
    for (const d of ["pass", "fail", "defer"] as const) {
      const result = parseArgs([
        "--record",
        "--candidate", "skill:test",
        "--source", "081KQ3HBZ0008QG0R0034DHWTQ",
        "--decision", d,
        "--rationale", `testing ${d}`,
      ]);
      expect(result.kind).toBe("args");
      if (result.kind === "args" && result.args.mode === "record") {
        expect(result.args.decision).toBe(d);
      }
    }
  });
});

describe("readLog", () => {
  test("returns empty array for nonexistent file", () => {
    expect(readLog(join(tmpDir(), "definitely-does-not-exist-file.jsonl"))).toEqual([]);
  });

  test("returns empty array for empty file", () => {
    const path = join(tmpDir(), "empty.jsonl");
    writeFileSync(path, "");
    expect(readLog(path)).toEqual([]);
    rmSync(path, { force: true });
  });

  test("parses valid JSONL entries", () => {
    const path = join(tmpDir(), "parse.jsonl");
    const entry: FilterGateEntry = {
      schema: "filter-gate-v1",
      timestamp: "2026-05-08T00:00:00.000Z",
      candidate: "skill:test",
      source: "081KQ3HBZ0008QG0R0034DHWTQ",
      decision: "pass",
      rationale: "test entry",
      clauses: ["HC-1"],
      author: "test",
    };
    writeFileSync(path, `${JSON.stringify(entry)}\n`);
    const entries = readLog(path);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.candidate).toBe("skill:test");
    expect(entries[0]!.decision).toBe("pass");
    rmSync(path, { force: true });
  });

  test("skips malformed lines", () => {
    const path = join(tmpDir(), "malformed.jsonl");
    const good: FilterGateEntry = {
      schema: "filter-gate-v1",
      timestamp: "2026-05-08T00:00:00.000Z",
      candidate: "skill:good",
      source: "081KQ3HBZ0008QG0R0034DHWTQ",
      decision: "pass",
      rationale: "good",
      clauses: [],
      author: "test",
    };
    writeFileSync(path, `${JSON.stringify(good)}\nnot-json\n${JSON.stringify(good)}\n`);
    const entries = readLog(path);
    expect(entries).toHaveLength(2);
    rmSync(path, { force: true });
  });
});

describe("computeSummary", () => {
  test("returns zeroes for empty log", () => {
    const summary = computeSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.pass).toBe(0);
    expect(summary.fail).toBe(0);
    expect(summary.defer).toBe(0);
    expect(summary.sources.size).toBe(0);
  });

  test("counts decisions correctly", () => {
    const entries: FilterGateEntry[] = [
      { schema: "filter-gate-v1", timestamp: "", candidate: "a", source: "081KQ3HBZ0008QG0R0034DHWTQ", decision: "pass", rationale: "", clauses: [], author: "" },
      { schema: "filter-gate-v1", timestamp: "", candidate: "b", source: "081KQ3HBZ0008QG0R0034DHWTQ", decision: "fail", rationale: "", clauses: [], author: "" },
      { schema: "filter-gate-v1", timestamp: "", candidate: "c", source: "081KQ3HBZ0008QG0R000K3NSX8", decision: "defer", rationale: "", clauses: [], author: "" },
      { schema: "filter-gate-v1", timestamp: "", candidate: "d", source: "081KQ3HBZ0008QG0R000K3NSX8", decision: "pass", rationale: "", clauses: [], author: "" },
    ];
    const summary = computeSummary(entries);
    expect(summary.total).toBe(4);
    expect(summary.pass).toBe(2);
    expect(summary.fail).toBe(1);
    expect(summary.defer).toBe(1);
  });

  test("groups by source", () => {
    const entries: FilterGateEntry[] = [
      { schema: "filter-gate-v1", timestamp: "", candidate: "a", source: "081KQ3HBZ0008QG0R0034DHWTQ", decision: "pass", rationale: "", clauses: [], author: "" },
      { schema: "filter-gate-v1", timestamp: "", candidate: "b", source: "081KQ3HBZ0008QG0R0034DHWTQ", decision: "fail", rationale: "", clauses: [], author: "" },
      { schema: "filter-gate-v1", timestamp: "", candidate: "c", source: "081KQ3HBZ0008QG0R003GTG5P2", decision: "pass", rationale: "", clauses: [], author: "" },
    ];
    const summary = computeSummary(entries);
    expect(summary.sources.get("081KQ3HBZ0008QG0R0034DHWTQ")).toBe(2);
    expect(summary.sources.get("081KQ3HBZ0008QG0R003GTG5P2")).toBe(1);
  });
});

describe("main() CLI", () => {
  test("returns 0 with --help", () => {
    expect(main(["--help"])).toBe(0);
  });

  test("returns 1 with no args", () => {
    expect(main([])).toBe(1);
  });

  test("returns 1 for unknown arg", () => {
    expect(main(["--bad-flag"])).toBe(1);
  });

  test("returns 0 with --list (empty log)", () => {
    expect(main(["--list"])).toBe(0);
  });

  test("returns 0 with --list --json", () => {
    expect(main(["--list", "--json"])).toBe(0);
  });

  test("returns 0 with --list --md", () => {
    expect(main(["--list", "--md"])).toBe(0);
  });

  test("returns 0 with --summary (empty log)", () => {
    expect(main(["--summary"])).toBe(0);
  });

  test("returns 1 for --record with missing fields", () => {
    expect(main(["--record", "--candidate", "skill:foo"])).toBe(1);
  });

  test("returns 1 for --record with invalid decision", () => {
    expect(main([
      "--record",
      "--candidate", "skill:foo",
      "--source", "081KQ3HBZ0008QG0R0034DHWTQ",
      "--decision", "invalid",
      "--rationale", "test",
    ])).toBe(1);
  });

  test("returns 0 for valid --record (writes to tempdir, not production log)", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "filter-gate-test-"));
    const tmpLog = join(tmpDir, "filter-gate-log.jsonl");
    const priorOverride = process.env.FILTER_GATE_LOG_PATH;
    process.env.FILTER_GATE_LOG_PATH = tmpLog;
    try {
      const code = main([
        "--record",
        "--candidate", "skill:test-entry",
        "--source", "081KQ3HBZ0008QG0R0034DHWTQ",
        "--decision", "pass",
        "--rationale", "Integration test entry",
      ]);
      expect(code).toBe(0);
      expect(existsSync(tmpLog)).toBe(true);
      const entries = readLog(tmpLog);
      expect(entries.length).toBe(1);
      expect(entries[0]?.candidate).toBe("skill:test-entry");
    } finally {
      if (priorOverride === undefined) {
        delete process.env.FILTER_GATE_LOG_PATH;
      } else {
        process.env.FILTER_GATE_LOG_PATH = priorOverride;
      }
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
