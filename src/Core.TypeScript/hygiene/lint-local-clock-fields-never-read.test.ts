// lint-local-clock-fields-never-read.test.ts — proves the guard can FAIL.
//
// A check that cannot fail is not a check. These tests pin the three things that make this guard
// worth having: it fires on the real mutant, it stays quiet on the shapes that are not reads, and
// its scan floor refuses to report success when it inspected nothing.
//
// The end-to-end mutant proof (plant `|> List.sortBy (fun v -> v.LocalObservedAt)` in
// `Consensus.decide`, observe exit 1; remove it, observe exit 0) was run against the live tree on
// 2026-08-14 and is additionally pinned in F# by
// `tests/Tests.FSharp/Consensus.Tests.fs` — "decide ignores LocalObservedAt".

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { blankNonCode, listScannedFiles, readsField } from "./lint-local-clock-fields-never-read.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");
const SCRIPT = resolve(HERE, "lint-local-clock-fields-never-read.ts");
const FIELD = "LocalObservedAt";

describe("readsField — the mutant it exists to catch", () => {
  test("THE MUTANT: sortBy on the local clock inside the fold is a read", () => {
    expect(readsField(FIELD, "            |> List.sortBy (fun v -> v.LocalObservedAt)")).toBe(true);
  });

  test("every other way the field could steer the fold is also a read", () => {
    const mutants = [
      "|> List.sortByDescending (fun v -> v.LocalObservedAt)",
      "|> List.filter (fun v -> v.LocalObservedAt > cutoff)",
      "|> List.distinctBy (fun v -> v.LocalObservedAt)",
      "|> List.groupBy (fun v -> v.LocalObservedAt)",
      "|> List.maxBy (fun v -> v.LocalObservedAt)",
      "if a.LocalObservedAt > b.LocalObservedAt then a else b",
      "let stale = votes |> List.filter (fun v -> now - v.LocalObservedAt < window)",
      "let ts = vote.LocalObservedAt",
    ];
    for (const m of mutants) {
      expect({ line: m, read: readsField(FIELD, m) }).toEqual({ line: m, read: true });
    }
  });
});

describe("readsField — the shapes that are NOT reads (false-positive floor)", () => {
  test("the declaration is not a read", () => {
    expect(readsField(FIELD, "          LocalObservedAt: DateTimeOffset }")).toBe(false);
  });

  test("record construction is not a read", () => {
    expect(readsField(FIELD, "                      LocalObservedAt = now }")).toBe(false);
  });

  test("MODULE-QUALIFIED construction is not a read (the cross-verify test's shape)", () => {
    // Regression: the first draft of this guard flagged this line, because `C.` made the
    // occurrence look dotted. Classification is per-occurrence on what FOLLOWS the name.
    expect(
      readsField(FIELD, '{ C.Node = C.NodeId "n"; C.Value = e.GetString(); C.LocalObservedAt = DateTimeOffset.UnixEpoch } ]'),
    ).toBe(false);
  });

  test("an F# backtick test NAME mentioning the field is not a read", () => {
    // Regression: the first draft flagged its own regression tests by their names.
    expect(readsField(FIELD, "let ``decide ignores LocalObservedAt — stamps do not move it`` () =")).toBe(false);
  });

  test("doc comments and comment tails are not reads", () => {
    expect(readsField(FIELD, "          /// a `sortBy` on v.LocalObservedAt would break exactly that.")).toBe(false);
    expect(readsField(FIELD, "let x = 1 // never sort by v.LocalObservedAt")).toBe(false);
    expect(readsField(FIELD, "(* v.LocalObservedAt *)")).toBe(false);
  });

  test("a construction on the same line as a read still reports the READ", () => {
    // This is why classification is per-occurrence and not per-line: a line-level "looks like a
    // construction, skip it" verdict would let a mutant hide beside a construction.
    const line = "{ Node = n; LocalObservedAt = now } |> fun v -> v.LocalObservedAt";
    expect(readsField(FIELD, line)).toBe(true);
  });
});

describe("blankNonCode", () => {
  test("preserves length so offsets stay meaningful", () => {
    const line = "let ``a name`` = 1 // trailing";
    expect(blankNonCode(line).length).toBe(line.length);
  });
});

describe("portability — the guard must run where CI runs it", () => {
  test("REGRESSION: does not shell out to ripgrep", () => {
    // The first version used `rg`, which is NOT installed on the GitHub runner. The scan floor
    // caught it honestly (exit 2, "inspected 0 files") instead of reporting a false green — but a
    // guard that cannot run is still a guard that does not guard. Enumeration is now `git ls-files`
    // (git is guaranteed present wherever the repo is checked out); matching is in-process.
    const src = readFileSync(SCRIPT, "utf8");
    expect(src).not.toMatch(/spawnSync\(\s*"rg"/);
    expect(src).toMatch(/spawnSync\(\s*"git"/);
  });
});

describe("scan floor — the guard must refuse to pass when it inspected nothing", () => {
  test("the scan really enumerates the tree (in-process — no subprocess to be flaky)", () => {
    const files = listScannedFiles();
    expect(files.length).toBeGreaterThan(200);
    expect(files).toContain("src/Core/Consensus.fs");
  });

  test("clean tree: the lint exits 0", () => {
    // Subprocess, because the exit CODE is the contract CI consumes. Given a generous timeout and
    // a diagnostic message: this spawns `git ls-files`, and on a machine running many agent loops
    // at once it was observed taking >5s and failing spuriously. A flaky guard gets disabled, so
    // the flake is fixed here rather than tolerated.
    const r = spawnSync("bun", [SCRIPT], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
    expect({ status: r.status, stderr: (r.stderr ?? "").slice(0, 800) }).toEqual({ status: 0, stderr: "" });
    expect(r.stdout ?? "").toMatch(/files scanned/);
  }, 180_000);

  test("EXIT 2 when the registered field is no longer declared where the registry says", () => {
    // The no-op failure mode this floor exists for: rename the field, and a naive grep-guard goes
    // permanently green because its pattern stops matching anything. Here it must go RED.
    const patched = spawnSync(
      "bun",
      [
        "-e",
        `
        const fs = require("node:fs");
        const src = fs.readFileSync(${JSON.stringify(SCRIPT)}, "utf8");
        // point the registry at a file that does not declare the field
        const broken = src.replace('declaredIn: "src/Core/Consensus.fs"', 'declaredIn: "README.md"');
        if (broken === src) { console.error("anchor missing"); process.exit(9); }
        fs.writeFileSync("/tmp/lint-floor-probe.ts", broken);
        `,
      ],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(patched.status).toBe(0);

    const r = spawnSync("bun", ["/tmp/lint-floor-probe.ts"], { cwd: REPO_ROOT, encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("SCAN FLOOR");
  });

  test("EXIT 2 when the registry is emptied (an empty claim is a no-op, not a pass)", () => {
    const patched = spawnSync(
      "bun",
      [
        "-e",
        `
        const fs = require("node:fs");
        const src = fs.readFileSync(${JSON.stringify(SCRIPT)}, "utf8");
        const broken = src.replace(
          /const REGISTRY: readonly LocalClockField\\[\\] = \\[[\\s\\S]*?\\n\\];/,
          "const REGISTRY: readonly LocalClockField[] = [];",
        );
        if (broken === src) { console.error("anchor missing"); process.exit(9); }
        fs.writeFileSync("/tmp/lint-empty-probe.ts", broken);
        `,
      ],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(patched.status).toBe(0);

    const r = spawnSync("bun", ["/tmp/lint-empty-probe.ts"], { cwd: REPO_ROOT, encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("SCAN FLOOR");
  });
});
