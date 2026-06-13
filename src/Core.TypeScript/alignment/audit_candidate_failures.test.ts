// audit_candidate_failures.test.ts — tests for failure-log reconstruction.
//
// Run: bun test tools/alignment/audit_candidate_failures.test.ts

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { auditCandidateFailures, type CandidateFailureAudit, main } from "./audit_candidate_failures.ts";
import type { FilterGateEntry } from "./filter_gate_log.ts";

function tempLog(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), "candidate-failure-audit-"));
  return join(dir, name);
}

function cleanup(path: string): void {
  rmSync(dirname(path), { recursive: true, force: true });
}

function entry(overrides: Partial<FilterGateEntry> = {}): FilterGateEntry {
  return {
    schema: "filter-gate-v1",
    timestamp: "2026-05-08T00:00:00.000Z",
    candidate: "skill:test",
    source: "B-0058",
    decision: "fail",
    rationale: "Candidate was rejected with enough context to reconstruct it",
    clauses: ["HC-1"],
    author: "test",
    ...overrides,
  };
}

function writeJsonl(path: string, lines: readonly unknown[]): void {
  writeFileSync(path, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
}

describe("auditCandidateFailures", () => {
  test("returns a clean empty audit for missing log", () => {
    const path = tempLog("missing.jsonl");
    const audit = auditCandidateFailures(path);
    expect(audit.totalEntries).toBe(0);
    expect(audit.violations).toBe(0);
    expect(audit.warnings).toBe(0);
    cleanup(path);
  });

  test("counts pass, fail, defer, and non-pass entries", () => {
    const path = tempLog("counts.jsonl");
    writeJsonl(path, [
      entry({ candidate: "skill:pass", decision: "pass" }),
      entry({ candidate: "skill:fail", decision: "fail" }),
      entry({ candidate: "skill:defer", decision: "defer" }),
    ]);

    const audit = auditCandidateFailures(path);
    expect(audit.totalLines).toBe(3);
    expect(audit.totalEntries).toBe(3);
    expect(audit.passEntries).toBe(1);
    expect(audit.failEntries).toBe(1);
    expect(audit.deferEntries).toBe(1);
    expect(audit.nonPassEntries).toBe(2);
    expect(audit.violations).toBe(0);
    cleanup(path);
  });

  test("reports malformed JSON as a violation", () => {
    const path = tempLog("malformed.jsonl");
    writeFileSync(path, `${JSON.stringify(entry())}\nnot-json\n`);

    const audit = auditCandidateFailures(path);
    expect(audit.violations).toBe(1);
    expect(audit.findings[0]?.code).toBe("malformed-json");
    cleanup(path);
  });

  test("reports missing rationale as a reconstruction violation", () => {
    const path = tempLog("missing-rationale.jsonl");
    writeJsonl(path, [{ ...entry(), rationale: "" }]);

    const audit = auditCandidateFailures(path);
    expect(audit.violations).toBe(1);
    expect(audit.findings[0]?.code).toBe("missing-rationale");
    cleanup(path);
  });

  test("warns but does not fail when a non-pass entry lacks clauses", () => {
    const path = tempLog("warning.jsonl");
    writeJsonl(path, [entry({ decision: "fail", clauses: [] })]);

    const audit = auditCandidateFailures(path);
    expect(audit.violations).toBe(0);
    expect(audit.warnings).toBe(1);
    expect(audit.findings[0]?.code).toBe("non-pass-without-clauses");
    cleanup(path);
  });

  test("reports invalid clause arrays as violations", () => {
    const path = tempLog("bad-clauses.jsonl");
    writeJsonl(path, [{ ...entry(), clauses: ["HC-1", ""] }]);

    const audit = auditCandidateFailures(path);
    expect(audit.violations).toBe(1);
    expect(audit.findings[0]?.code).toBe("invalid-clauses");
    cleanup(path);
  });

  test("returns a stable schema name", () => {
    const path = tempLog("schema.jsonl");
    const audit: CandidateFailureAudit = auditCandidateFailures(path);
    expect(audit.schema).toBe("candidate-failure-audit-v1");
    cleanup(path);
  });
});

describe("main() CLI", () => {
  test("returns 0 with --help", () => {
    expect(main(["--help"])).toBe(0);
  });

  test("returns 2 for unknown flags", () => {
    expect(main(["--bad-flag"])).toBe(2);
  });

  test("returns 2 when --log has no value", () => {
    expect(main(["--log"])).toBe(2);
  });

  test("returns 2 when both output formats are requested", () => {
    expect(main(["--json", "--md"])).toBe(2);
  });

  test("returns 0 for a clean log in human, json, and markdown modes", () => {
    const path = tempLog("clean.jsonl");
    writeJsonl(path, [entry({ decision: "pass" })]);

    expect(main(["--log", path])).toBe(0);
    expect(main(["--log", path, "--json"])).toBe(0);
    expect(main(["--log", path, "--md"])).toBe(0);
    cleanup(path);
  });

  test("returns 1 when violations are present", () => {
    const path = tempLog("invalid.jsonl");
    writeFileSync(path, "not-json\n");

    expect(main(["--log", path])).toBe(1);
    cleanup(path);
  });
});
