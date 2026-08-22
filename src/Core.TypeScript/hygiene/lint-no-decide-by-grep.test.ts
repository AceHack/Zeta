/**
 * lint-no-decide-by-grep.test.ts
 *
 * The point of these tests is that the guard CAN FAIL, and that it fails on the
 * right polarity. A lint whose positive cases are never exercised is a check
 * that cannot fail — which is the same defect this lint is about.
 *
 * The mutant is the exact line that was live on main:
 *     if lake env lean /tmp/toymodel_axiom_audit.lean 2>&1 | grep -q 'sorryAx'; then
 * and the near-miss is the require-polarity line that is also live on main and
 * must NOT be flagged:
 *     ollama list | awk 'NR>1 {print $1}' | grep -qx "$MODEL"
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  isDenyPolarity,
  MIN_WORKFLOWS_EXPECTED,
  producerOf,
  scanRepo,
  scanText,
  TEXT_PRODUCERS,
} from "./lint-no-decide-by-grep.ts";

const WF = ".github/workflows/example.yml";
const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");

describe("the live defect is caught", () => {
  test("the lean-proof line verbatim", () => {
    const live = "          if lake env lean /tmp/toymodel_axiom_audit.lean 2>&1 | grep -q 'sorryAx'; then";
    const f = scanText(WF, live);
    expect(f.length).toBe(1);
    expect(f[0]?.producer).toBe("lake");
  });

  test("the loop form over a variable path", () => {
    const live = `            if lake env lean "$f" 2>&1 | grep -q 'Unknown constant'; then`;
    expect(scanText(WF, live).length).toBe(1);
  });

  test("a tsc gate written the same way", () => {
    const live = `if bunx tsc --noEmit 2>&1 | grep -q "error TS"; then`;
    // `bun` is a text producer for the allowlist's purposes, `bunx` is not.
    expect(scanText(WF, live).length).toBe(1);
  });

  test("an assignment prefix does not hide the producer", () => {
    const live = `if FOO=1 lake env lean x.lean 2>&1 | grep -q 'sorryAx'; then`;
    expect(scanText(WF, live)[0]?.producer).toBe("lake");
  });

  test("a path-qualified producer is reduced to its basename", () => {
    expect(producerOf("/usr/local/bin/lake env lean x")).toBe("lake");
  });
});

describe("polarity — the require form is fail-closed and must NOT be flagged", () => {
  test("the ollama assertion live on main is not a finding", () => {
    const live = `          ollama list | awk 'NR>1 {print $1}' | grep -qx "$MODEL"`;
    expect(scanText(WF, live)).toEqual([]);
  });

  test("an explicitly negated condition is not a finding", () => {
    const live = `if ! some-prover check 2>&1 | grep -q 'PROVED'; then`;
    expect(scanText(WF, live)).toEqual([]);
    expect(isDenyPolarity(live)).toBe(false);
  });

  test("isDenyPolarity separates the two forms", () => {
    expect(isDenyPolarity("if lake env lean x | grep -q y; then")).toBe(true);
    expect(isDenyPolarity("if ! lake env lean x | grep -q y; then")).toBe(false);
    expect(isDenyPolarity("lake env lean x | grep -q y")).toBe(false);
  });
});

describe("near-misses that must stay quiet", () => {
  test("a pure-text producer is fine — echo cannot half-run", () => {
    expect(scanText(WF, `if echo "$ALLOWED" | grep -qw "$ACTOR"; then`)).toEqual([]);
    expect(scanText(WF, `if head -5 docs/BACKLOG.md | grep -q "AUTO-GENERATED"; then`)).toEqual([]);
    expect(scanText(WF, `if printf '%s' "$X" | grep -Eq '^[0-9]+$'; then`)).toEqual([]);
  });

  test("a non-boolean grep (no -q) is not a decision", () => {
    expect(scanText(WF, "          some-tool run | grep sorryAx")).toEqual([]);
  });

  test("a comment quoting the defect is documentation, not execution", () => {
    expect(scanText(WF, "          # if lake env lean x 2>&1 | grep -q 'sorryAx'; then")).toEqual([]);
  });

  test("a producer we cannot name is not guessed at", () => {
    expect(scanText(WF, `if "$TOOL" run | grep -q 'BAD'; then`)).toEqual([]);
    expect(producerOf('"$TOOL" run')).toBeNull();
  });

  test("the allowlist holds the shapes the repo actually uses", () => {
    for (const p of ["echo", "printf", "cat", "head", "git", "jq"]) {
      expect(TEXT_PRODUCERS.has(p)).toBe(true);
    }
    expect(TEXT_PRODUCERS.has("lake")).toBe(false);
    expect(TEXT_PRODUCERS.has("bunx")).toBe(false);
  });

  test("this lint and its own test are exempt so they may quote the pattern", () => {
    const live = "if lake env lean x 2>&1 | grep -q 'sorryAx'; then";
    expect(scanText("src/Core.TypeScript/hygiene/lint-no-decide-by-grep.ts", live)).toEqual([]);
    expect(scanText("src/Core.TypeScript/hygiene/lint-no-decide-by-grep.test.ts", live)).toEqual([]);
  });
});

describe("live tripwire over the real tracked tree", () => {
  const result = scanRepo(REPO_ROOT);

  test("it scans a real number of workflows, not zero", () => {
    expect(result.filesScanned).toBeGreaterThanOrEqual(MIN_WORKFLOWS_EXPECTED);
  });

  test("no workflow decides a gate by a discarded exit status", () => {
    const rendered = result.findings.map((f) => `${f.file}:${f.line} ${f.text}`).join("\n");
    expect(rendered).toBe("");
  });
});
