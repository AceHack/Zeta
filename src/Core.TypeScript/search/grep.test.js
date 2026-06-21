import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { grepTree, isExcludedDir, parseArgs, EXCLUDE_BASENAMES } from "./grep.js";
// Fixture tree:
//   src/hit.ts                     -> "needle" (MUST be found)
//   src/nested/also.md             -> "needle" (MUST be found)
//   references/prior-art/noise.ts  -> "needle" (MUST be excluded — the whole point)
//   node_modules/dep/index.ts      -> "needle" (MUST be excluded)
//   bin/output.ts                  -> "needle" (MUST be excluded)
//   artifacts/built.ts             -> "needle" (MUST be excluded)
//   src/case.ts                    -> "NeEdLe" (only matched with -i)
let root;
beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "zeta-grep-test-"));
    const write = (rel, body) => {
        const abs = join(root, rel);
        mkdirSync(join(abs, ".."), { recursive: true });
        writeFileSync(abs, body, "utf8");
    };
    write("src/hit.ts", "const x = 1;\n// needle here\n");
    write("src/nested/also.md", "# doc\nneedle in markdown\n");
    write("references/prior-art/noise.ts", "// needle in vendored upstream — MUST NOT surface\n");
    write("node_modules/dep/index.ts", "// needle in a dep — MUST NOT surface\n");
    write("bin/output.ts", "// needle in build output — MUST NOT surface\n");
    write("artifacts/built.ts", "// needle in artifacts — MUST NOT surface\n");
    write("src/case.ts", "// NeEdLe mixed case\n");
});
afterAll(() => {
    if (root)
        rmSync(root, { recursive: true, force: true });
});
test("finds literal substring in normal source files", () => {
    const m = grepTree({ root, needle: "needle" });
    const files = m.map((x) => x.file).sort();
    expect(files).toContain("src/hit.ts");
    expect(files).toContain("src/nested/also.md");
});
test("EXCLUDES references/prior-art (the load-bearing guarantee)", () => {
    const m = grepTree({ root, needle: "needle" });
    const files = m.map((x) => x.file);
    expect(files.some((f) => f.includes("references/prior-art"))).toBe(false);
});
test("EXCLUDES node_modules + build-output dirs (bin, artifacts)", () => {
    const m = grepTree({ root, needle: "needle" });
    const files = m.map((x) => x.file);
    expect(files.some((f) => f.startsWith("node_modules/"))).toBe(false);
    expect(files.some((f) => f.startsWith("bin/"))).toBe(false);
    expect(files.some((f) => f.startsWith("artifacts/"))).toBe(false);
});
test("case-sensitive by default; -i matches mixed case", () => {
    const sensitive = grepTree({ root, needle: "needle" }).map((x) => x.file);
    expect(sensitive).not.toContain("src/case.ts");
    const insensitive = grepTree({ root, needle: "needle", ignoreCase: true }).map((x) => x.file);
    expect(insensitive).toContain("src/case.ts");
});
test("reports correct 1-based line numbers", () => {
    const m = grepTree({ root, needle: "needle" });
    const hit = m.find((x) => x.file === "src/hit.ts");
    expect(hit?.line).toBe(2);
});
test("--ext filter restricts to given extensions", () => {
    const m = grepTree({ root, needle: "needle", exts: new Set(["md"]) });
    const files = m.map((x) => x.file);
    expect(files).toEqual(["src/nested/also.md"]);
});
test("isExcludedDir: prior-art + node_modules excluded, src kept", () => {
    expect(isExcludedDir(root, join(root, "references", "prior-art"))).toBe(true);
    expect(isExcludedDir(root, join(root, "references", "prior-art", "deep"))).toBe(true);
    expect(isExcludedDir(root, join(root, "node_modules"))).toBe(true);
    expect(isExcludedDir(root, join(root, "src"))).toBe(false);
    // a dir literally named "prior-art" but NOT under references/ is kept
    expect(isExcludedDir(root, join(root, "prior-art"))).toBe(false);
});
test("EXCLUDE_BASENAMES carries the known noise dirs (incl. .NET/Lean/bench outputs)", () => {
    for (const d of [
        ".git",
        "node_modules",
        "bin",
        "obj",
        "target",
        "artifacts",
        "TestResults",
        "BenchmarkDotNet.Artifacts",
        ".lake",
    ]) {
        expect(EXCLUDE_BASENAMES.has(d)).toBe(true);
    }
});
test("parseArgs: needle required", () => {
    const r = parseArgs([]);
    expect("error" in r).toBe(true);
});
test("parseArgs: flags parsed (default repo = cwd, valid)", () => {
    const r = parseArgs(["foo", "bar", "-i", "--ext", "ts,md", "--files"]);
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
        expect(r.needle).toBe("foo bar");
        expect(r.ignoreCase).toBe(true);
        expect(r.filesOnly).toBe(true);
        expect([...(r.exts ?? [])].sort()).toEqual(["md", "ts"]);
    }
});
test("parseArgs: unknown flag errors", () => {
    const r = parseArgs(["x", "--bogus"]);
    expect("error" in r).toBe(true);
});
test("parseArgs: bad --repo errors (no silent 0-hits false-negative)", () => {
    const missing = parseArgs(["x", "--repo", join(root, "does-not-exist-xyz")]);
    expect("error" in missing).toBe(true);
    // a file (non-directory) is also rejected
    const filePath = join(root, "src", "hit.ts");
    const notDir = parseArgs(["x", "--repo", filePath]);
    expect("error" in notDir).toBe(true);
    // a real directory is accepted
    const ok = parseArgs(["x", "--repo", root]);
    expect("error" in ok).toBe(false);
});
