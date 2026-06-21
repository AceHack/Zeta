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
const GOOD = `---\nid: B-0001\npriority: P1\nstatus: open\ntitle: A good row\n---\n# B-0001\n`;
test("schema-only PASSES on a well-formed row (exit 0)", () => {
    const base = fixture([{ dir: "P1", name: "B-0001-good.md", content: GOOD }]);
    const r = runSchemaOnly(base);
    rmSync(base, { recursive: true, force: true });
    expect(r.status).toBe(0);
});
test("schema-only FAILS on missing frontmatter (the actual root-cause bug)", () => {
    const base = fixture([{ dir: "P0", name: "B-9001-no-fm.md", content: "# no frontmatter\nbody\n" }]);
    const r = runSchemaOnly(base);
    rmSync(base, { recursive: true, force: true });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("Failed to parse frontmatter");
});
test("schema-only FAILS on missing title (empty index title / description loss on regen)", () => {
    const content = `---\nid: B-9002\npriority: P1\nstatus: open\n---\n# no title field\n`;
    const base = fixture([{ dir: "P1", name: "B-9002-missing-title.md", content }]);
    const r = runSchemaOnly(base);
    rmSync(base, { recursive: true, force: true });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("`title:`");
});
test("schema-only FAILS on id that disagrees with filename", () => {
    const content = `---\nid: B-9999\npriority: P1\nstatus: open\ntitle: wrong id\n---\nx\n`;
    const base = fixture([{ dir: "P1", name: "B-9003-id-mismatch.md", content }]);
    const r = runSchemaOnly(base);
    rmSync(base, { recursive: true, force: true });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("does not match filename");
});
test("schema-only FAILS on missing status", () => {
    const content = `---\nid: B-9004\npriority: P1\ntitle: no status\n---\nx\n`;
    const base = fixture([{ dir: "P1", name: "B-9004-no-status.md", content }]);
    const r = runSchemaOnly(base);
    rmSync(base, { recursive: true, force: true });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("`status:`");
});
