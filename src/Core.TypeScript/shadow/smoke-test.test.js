import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
const ZETA_SHADOW = join(import.meta.dir, "zeta-shadow.ts");
const REPO_ROOT = resolve(import.meta.dir, "../../..");
describe("shadow — B-0433 distribution smoke tests", () => {
    let SMOKE_DIR;
    beforeEach(() => {
        SMOKE_DIR = mkdtempSync(join(tmpdir(), "zeta-shadow-b0433-smoke-"));
    });
    afterEach(() => {
        if (existsSync(SMOKE_DIR))
            rmSync(SMOKE_DIR, { recursive: true, force: true });
    });
    test("zeta-shadow.ts --once --dry-run --detect-cmd 'echo hello' exits 0", () => {
        const logFile = join(SMOKE_DIR, "shadow.log");
        const r = spawnSync("bun", [ZETA_SHADOW, "--once", "--dry-run", "--delay", "0", "--detect-cmd", "echo hello", "--log-file", logFile], { encoding: "utf-8" });
        expect(r.status).toBe(0);
    });
    test("log file written with (shadow) attribution after dry-run acceptance", () => {
        const logFile = join(SMOKE_DIR, "shadow.log");
        spawnSync("bun", [ZETA_SHADOW, "--once", "--dry-run", "--delay", "0", "--detect-cmd", "echo hello", "--log-file", logFile], { encoding: "utf-8" });
        expect(existsSync(logFile)).toBe(true);
        const contents = readFileSync(logFile, "utf-8");
        expect(contents).toContain("(shadow");
    });
    test("package.json bin[\"zeta-shadow\"] entry points to an existing file", () => {
        const pkgJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8"));
        expect(pkgJson.bin).toBeDefined();
        const entry = pkgJson.bin?.["zeta-shadow"];
        expect(entry).toBeDefined();
        expect(existsSync(join(REPO_ROOT, entry))).toBe(true);
    });
});
