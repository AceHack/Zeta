// audit_clause_drift.test.ts — tests for alignment-clause drift detector.
//
// B-0058 slice: adds test coverage for the drift detector's CLI
// interface and baseline no-drift assertion.
//
// Run: bun test tools/alignment/audit_clause_drift.test.ts

import { describe, expect, test } from "bun:test";
import { main } from "./audit_clause_drift.ts";

describe("main() CLI", () => {
  test("returns 0 with --help", () => {
    expect(main(["--help"])).toBe(0);
  });

  test("returns 2 for unknown arg", () => {
    expect(main(["--bad-flag"])).toBe(2);
  });

  test("returns 2 when --base has no value", () => {
    expect(main(["--base"])).toBe(2);
  });

  test("returns 2 when --head has no value", () => {
    expect(main(["--head"])).toBe(2);
  });
});

describe("no-drift baseline", () => {
  test("HEAD vs HEAD shows zero drift", () => {
    const code = main(["--base", "HEAD", "--head", "HEAD"]);
    expect(code).toBe(0);
  });

  test("HEAD vs HEAD with --json returns 0", () => {
    const code = main(["--base", "HEAD", "--head", "HEAD", "--json"]);
    expect(code).toBe(0);
  });

  test("HEAD vs HEAD with --md returns 0", () => {
    const code = main(["--base", "HEAD", "--head", "HEAD", "--md"]);
    expect(code).toBe(0);
  });
});

describe("default base ref", () => {
  test("returns 0 with no args (defaults to main vs HEAD)", () => {
    expect(main([])).toBe(0);
  });
});
