import { describe, test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tree } from "../healer-harness";
import { computePlan, describePlan, DEFAULT_MAX_FILES } from "./run-tier0";

const SCRIPT = join(import.meta.dir, "run-tier0.ts");

/** A scratch repo root with the given files, so the bound is exercised end-to-end. */
function scratch(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "tier0-bound-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

/** A file the unused-import healer will definitely rewrite. */
const DIRTY = (n: number) => `import { gone${n} } from "./lib";\n\nconsole.log(${n});\n`;

function run(root: string, ...args: string[]) {
  const r = spawnSync("bun", [SCRIPT, "--repo-root", root, ...args], { encoding: "utf8" });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

describe("computePlan — pure diff of before/after trees", () => {
  test("counts a rewrite", () => {
    const before = tree({ "a.ts": "x" });
    const after = tree({ "a.ts": "y" });
    const plan = computePlan(before, after);
    expect(plan.rewrites.size).toBe(1);
    expect(plan.removals).toHaveLength(0);
    expect(plan.touched).toBe(1);
  });

  test("counts a removal", () => {
    const plan = computePlan(tree({ "a.ts": "x" }), tree({}));
    expect(plan.rewrites.size).toBe(0);
    expect(plan.removals).toEqual(["a.ts"]);
    expect(plan.touched).toBe(1);
  });

  test("an unchanged file is not in the plan", () => {
    const plan = computePlan(tree({ "a.ts": "x" }), tree({ "a.ts": "x" }));
    expect(plan.touched).toBe(0);
  });

  test("touched === rewrites + removals (what the bound is checked against)", () => {
    const plan = computePlan(
      tree({ "a.ts": "x", "b.ts": "y", "c.ts": "z" }),
      tree({ "a.ts": "X", "b.ts": "Y" }),
    );
    expect(plan.rewrites.size).toBe(2);
    expect(plan.removals).toEqual(["c.ts"]);
    expect(plan.touched).toBe(3);
  });

  test("describePlan lists every entry — never truncates", () => {
    const plan = computePlan(
      tree(Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`f${i}.ts`, "a"]))),
      tree(Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`f${i}.ts`, "b"]))),
    );
    expect(describePlan(plan).split("\n")).toHaveLength(40);
  });
});

describe("the bound — all-or-nothing, never partial", () => {
  test("EXCEEDED: exits 2 and writes NOTHING", () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 8; i++) files[`src/f${i}.ts`] = DIRTY(i);
    const root = scratch(files);
    const originals = Object.fromEntries(
      Object.keys(files).map((f) => [f, readFileSync(join(root, f), "utf8")]),
    );

    const { code, out } = run(root, "--max-files", "3");

    expect(code).toBe(2);
    expect(out).toContain("BLAST RADIUS EXCEEDED");
    expect(out).toContain("NOTHING WAS WRITTEN");
    // The load-bearing assertion: the tree is byte-identical. Not "mostly" untouched.
    for (const [f, before] of Object.entries(originals)) {
      expect(readFileSync(join(root, f), "utf8")).toBe(before);
    }
  });

  test("the refusal prints the FULL plan, so oversized drift stays visible", () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 8; i++) files[`src/f${i}.ts`] = DIRTY(i);
    const { out } = run(scratch(files), "--max-files", "2");
    for (let i = 0; i < 8; i++) expect(out).toContain(`src/f${i}.ts`);
  });

  test("WITHIN BOUND: actually heals — the negative control", () => {
    // Without this, a guard that refused EVERYTHING would pass every test above. This is the
    // could-not-fail check applied to the guard itself: prove the permitted path really permits.
    const root = scratch({ "src/a.ts": DIRTY(1) });
    const { code, out } = run(root, "--max-files", "25");

    expect(code).toBe(0);
    expect(out).toContain("HEALED");
    expect(readFileSync(join(root, "src/a.ts"), "utf8")).not.toContain("gone1");
  });

  test("a clean tree is not a refusal — it is a no-op exit 0", () => {
    const { code, out } = run(scratch({ "src/a.ts": "console.log(1);\n" }), "--max-files", "1");
    expect(code).toBe(0);
    expect(out).toContain("No drift found");
  });
});

describe("--dry-run", () => {
  test("reports the plan and writes nothing", () => {
    const root = scratch({ "src/a.ts": DIRTY(1) });
    const before = readFileSync(join(root, "src/a.ts"), "utf8");

    const { code, out } = run(root, "--dry-run");

    expect(code).toBe(0);
    expect(out).toContain("DRY RUN");
    expect(readFileSync(join(root, "src/a.ts"), "utf8")).toBe(before);
  });
});

describe("a malformed bound must not become 'unbounded'", () => {
  // The failure mode this guards: `--max-files ""` parsing to NaN, NaN > n being false, and the
  // bound silently vanishing. That is exactly the could-not-fail shape.
  for (const bad of ["abc", "0", "-5", ""]) {
    test(`--max-files "${bad}" is rejected, not ignored`, () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 6; i++) files[`src/f${i}.ts`] = DIRTY(i);
      const root = scratch(files);
      const originals = Object.fromEntries(
        Object.keys(files).map((f) => [f, readFileSync(join(root, f), "utf8")]),
      );

      const { code } = run(root, "--max-files", bad);

      expect(code).not.toBe(0); // never silently proceeds
      for (const [f, b] of Object.entries(originals)) {
        expect(readFileSync(join(root, f), "utf8")).toBe(b);
      }
    });
  }
});

describe("--plan-out — precise staging instead of `git add -A`", () => {
  test("lists exactly the touched paths", () => {
    const root = scratch({ "src/a.ts": DIRTY(1), "src/clean.ts": "console.log(2);\n" });
    const planFile = join(root, "plan.txt");

    run(root, "--plan-out", planFile);

    const listed = readFileSync(planFile, "utf8").trim().split("\n").filter(Boolean);
    expect(listed).toContain("src/a.ts");
    expect(listed).not.toContain("src/clean.ts"); // untouched files must not be staged
  });
});

describe("the default bound", () => {
  test("is a stated constant, not a magic number in the flow", () => {
    expect(DEFAULT_MAX_FILES).toBe(25);
  });
});
