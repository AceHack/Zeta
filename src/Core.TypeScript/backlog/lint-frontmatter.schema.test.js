import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
// Spawns the real CLI in --schema-only mode against crafted per-row fixtures.
// Guards the chronic backlog-index-integrity recurrence (missing frontmatter /
// missing required fields / id-filename mismatch).
const TOOL = join(import.meta.dir, "lint-frontmatter.ts");
function runSchemaOnly(baseDir) {
    return spawnSync("bun", [TOOL, "--schema-only", "--base-dir", baseDir], { encoding: "utf8" });
}
function fixture(rows) {
    const base = mkdtempSync(join(tmpdir(), "lint-fm-"));
    for (const r of rows) {
        mkdirSync(join(base, r.dir), { recursive: true });
        writeFileSync(join(base, r.dir, r.name), r.content, "utf8");
    }
    return base;
}
const GOOD = `---\nid: 081KPYCJH0008QG0R003MDS51N\npriority: P1\nstatus: open\ntitle: A good row\n---\n# 081KPYCJH0008QG0R003MDS51N\n`;
test("schema-only PASSES on a well-formed row (exit 0)", () => {
    const base = fixture([{ dir: "P1", name: "081KPYCJH0008QG0R003MDS51N-good.md", content: GOOD }]);
    const r = runSchemaOnly(base);
    rmSync(base, { recursive: true, force: true });
    expect(r.status).toBe(0);
});
test("schema-only FAILS on missing frontmatter (the actual root-cause bug)", () => {
    const base = fixture([{ dir: "P0", name: "081KEBGPMB008QG0R0034HV56E-no-fm.md", content: "# no frontmatter\nbody\n" }]);
    const r = runSchemaOnly(base);
    rmSync(base, { recursive: true, force: true });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("Failed to parse frontmatter");
});
test("schema-only FAILS on missing title (empty index title / description loss on regen)", () => {
    const content = `---\nid: 081KEBGREY008QG0R00008DC9Q\npriority: P1\nstatus: open\n---\n# no title field\n`;
    const base = fixture([{ dir: "P1", name: "081KEBGREY008QG0R00008DC9Q-missing-title.md", content }]);
    const r = runSchemaOnly(base);
    rmSync(base, { recursive: true, force: true });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("`title:`");
});
test("schema-only FAILS on id that disagrees with filename", () => {
    const content = `---\nid: 081KED9T0X008QG0R003SZN0FB\npriority: P1\nstatus: open\ntitle: wrong id\n---\nx\n`;
    const base = fixture([{ dir: "P1", name: "081KEBGT9H008QG0R00005MST8-id-mismatch.md", content }]);
    const r = runSchemaOnly(base);
    rmSync(base, { recursive: true, force: true });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("does not match filename");
});
test("schema-only FAILS on missing status", () => {
    const content = `---\nid: 081KEBGW44008QG0R001ZF0W78\npriority: P1\ntitle: no status\n---\nx\n`;
    const base = fixture([{ dir: "P1", name: "081KEBGW44008QG0R001ZF0W78-no-status.md", content }]);
    const r = runSchemaOnly(base);
    rmSync(base, { recursive: true, force: true });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("`status:`");
});
