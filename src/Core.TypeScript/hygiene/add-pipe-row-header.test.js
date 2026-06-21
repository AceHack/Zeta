import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { alreadyCompliant, buildHeader, parseShardPath, } from "./add-pipe-row-header";
const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");
const SHARD_PREFIX = "docs/hygiene-history/ticks";
function shardPath(rel) {
    return resolve(REPO_ROOT, rel);
}
function infoFor(rel) {
    const info = parseShardPath(shardPath(rel));
    if (!info)
        throw new Error(`fixture path did not parse: ${rel}`);
    return info;
}
describe("parseShardPath", () => {
    test("accepts HHMMZ.md form (bare)", () => {
        const info = parseShardPath(shardPath(`${SHARD_PREFIX}/2026/05/17/0012Z.md`));
        expect(info).not.toBeNull();
        expect(info?.iso).toBe("2026-05-17T00:12Z");
    });
    test("accepts HHMMZ-<hex>.md form (minute-grain + hash)", () => {
        const info = parseShardPath(shardPath(`${SHARD_PREFIX}/2026/05/17/0012Z-abc123.md`));
        expect(info).not.toBeNull();
        expect(info?.iso).toBe("2026-05-17T00:12Z");
    });
    test("accepts HHMMSSZ-<hex>.md form (second-grain + hash)", () => {
        const info = parseShardPath(shardPath(`${SHARD_PREFIX}/2026/05/17/001234Z-abc123.md`));
        expect(info).not.toBeNull();
        expect(info?.iso).toBe("2026-05-17T00:12:34Z");
    });
    test("rejects README.md", () => {
        const info = parseShardPath(shardPath(`${SHARD_PREFIX}/README.md`));
        expect(info).toBeNull();
    });
    test("rejects files outside the shard prefix", () => {
        const info = parseShardPath(shardPath("docs/hygiene-history/loop-tick-history.md"));
        expect(info).toBeNull();
    });
    test("rejects non-.md extensions", () => {
        const info = parseShardPath(shardPath(`${SHARD_PREFIX}/2026/05/17/0012Z.txt`));
        expect(info).toBeNull();
    });
    test("rejects malformed filename (no HHMMZ pattern)", () => {
        const info = parseShardPath(shardPath(`${SHARD_PREFIX}/2026/05/17/something.md`));
        expect(info).toBeNull();
    });
    test("rejects malformed path date components", () => {
        const info = parseShardPath(shardPath(`${SHARD_PREFIX}/abcd/05/17/0012Z.md`));
        expect(info).toBeNull();
    });
});
describe("alreadyCompliant", () => {
    const info = infoFor(`${SHARD_PREFIX}/2026/05/17/0012Z.md`);
    test("true for valid pipe-row matching path timestamp (HH:MM)", () => {
        const content = "| 2026-05-17T00:12Z | retrofit | unknown | retrofit | none | none |\n\n# Body\n";
        expect(alreadyCompliant(content, info)).toBe(true);
    });
    test("true for HH:MM:SS form matching path date+hour+min (validator ignores seconds)", () => {
        const content = "| 2026-05-17T00:12:34Z | retrofit | unknown | retrofit | none | none |\n";
        expect(alreadyCompliant(content, info)).toBe(true);
    });
    test("false when pipe-row timestamp date does NOT match path", () => {
        const content = "| 2020-01-01T00:12Z | wrong | wrong | wrong | wrong | wrong |\n# Body\n";
        expect(alreadyCompliant(content, info)).toBe(false);
    });
    test("false when pipe-row timestamp hour/min does NOT match filename", () => {
        const content = "| 2026-05-17T05:30Z | retrofit | unknown | retrofit | none | none |\n";
        expect(alreadyCompliant(content, info)).toBe(false);
    });
    test("false for H1 first line", () => {
        const content = "# Tick 0012Z — example\n\nBody\n";
        expect(alreadyCompliant(content, info)).toBe(false);
    });
    test("false for empty content", () => {
        expect(alreadyCompliant("", info)).toBe(false);
    });
    test("false for whitespace-only content", () => {
        expect(alreadyCompliant("\n\n   \n", info)).toBe(false);
    });
    test("false for too-few pipes (< 7)", () => {
        const content = "| 2026-05-17T00:12Z | a | b | c | d |\n";
        expect(alreadyCompliant(content, info)).toBe(false);
    });
    test("false when first line has pipes but bad timestamp format", () => {
        const content = "| not-a-timestamp | a | b | c | d | e |\n";
        expect(alreadyCompliant(content, info)).toBe(false);
    });
    test("skips leading blank lines to find first non-empty", () => {
        const content = "\n\n| 2026-05-17T00:12Z | a | b | c | d | e |\n\n# Body\n";
        expect(alreadyCompliant(content, info)).toBe(true);
    });
});
describe("buildHeader", () => {
    test("produces a 7-pipe row with the given ISO timestamp", () => {
        const header = buildHeader("2026-05-17T00:12Z");
        const firstLine = header.split("\n")[0];
        expect(firstLine).toBeDefined();
        const pipeCount = (firstLine?.match(/\|/g) ?? []).length;
        expect(pipeCount).toBeGreaterThanOrEqual(7);
    });
    test("first row matches the validator's COL1_RE pattern", () => {
        const header = buildHeader("2026-05-17T00:12Z");
        const firstLine = header.split("\n")[0] ?? "";
        expect(firstLine).toMatch(/^\|\s\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z\s\|\s/);
    });
    test("ends with double newline to separate from existing body", () => {
        const header = buildHeader("2026-05-17T00:12Z");
        expect(header.endsWith("\n\n")).toBe(true);
    });
    test("prepending makes a non-compliant body compliant for the matching shard", () => {
        const info = infoFor(`${SHARD_PREFIX}/2026/05/17/0012Z.md`);
        const body = "# Tick 0012Z — example\n\nbody text\n";
        const prepended = buildHeader("2026-05-17T00:12Z") + body;
        expect(alreadyCompliant(prepended, info)).toBe(true);
    });
    test("uses honest 'retrofit' placeholders rather than fabricated content", () => {
        const header = buildHeader("2026-05-17T00:12Z");
        expect(header).toContain("retrofit");
        expect(header).toContain("none");
    });
});
describe("atomic write behavior (processOne with --write)", () => {
    // These tests exercise the script via REPO_ROOT override + tmpdir
    // fixtures, validating that:
    //   - the tempfile rename pattern produces durable shard content
    //   - the body of the original file is preserved below the new header
    function makeRepo() {
        return mkdtempSync(join(tmpdir(), "add-pipe-row-header-test-"));
    }
    test("--write produces a validator-compliant first line for an H1 shard", async () => {
        const repo = makeRepo();
        try {
            const shardRel = `${SHARD_PREFIX}/2026/05/17/0001Z.md`;
            const shardAbs = join(repo, shardRel);
            mkdirSync(join(repo, `${SHARD_PREFIX}/2026/05/17`), { recursive: true });
            writeFileSync(shardAbs, "# Tick 0001Z — fixture\n\nbody\n", "utf8");
            const proc = Bun.spawn([
                "bun",
                "src/Core.TypeScript/hygiene/add-pipe-row-header.ts",
                "--write",
                "--files",
                shardRel,
            ], {
                cwd: REPO_ROOT,
                env: { ...process.env, REPO_ROOT: repo },
                stdout: "pipe",
                stderr: "pipe",
            });
            await proc.exited;
            const content = readFileSync(shardAbs, "utf8");
            const firstLine = content.split("\n")[0] ?? "";
            expect(firstLine).toMatch(/^\| 2026-05-17T00:01Z \| retrofit \| unknown \| retrofit/);
            // Original body must be preserved.
            expect(content).toContain("# Tick 0001Z — fixture");
            expect(content).toContain("body");
        }
        finally {
            rmSync(repo, { recursive: true, force: true });
        }
    });
    test("--write leaves no tempfile behind after success", async () => {
        const repo = makeRepo();
        try {
            const shardRel = `${SHARD_PREFIX}/2026/05/17/0002Z.md`;
            const shardAbs = join(repo, shardRel);
            mkdirSync(join(repo, `${SHARD_PREFIX}/2026/05/17`), { recursive: true });
            writeFileSync(shardAbs, "# Tick 0002Z\nbody\n", "utf8");
            const proc = Bun.spawn([
                "bun",
                "src/Core.TypeScript/hygiene/add-pipe-row-header.ts",
                "--write",
                "--files",
                shardRel,
            ], {
                cwd: REPO_ROOT,
                env: { ...process.env, REPO_ROOT: repo },
                stdout: "pipe",
                stderr: "pipe",
            });
            await proc.exited;
            // Only the shard should exist in the parent dir — no `.tmp-*` siblings.
            const { readdirSync } = await import("node:fs");
            const entries = readdirSync(join(repo, `${SHARD_PREFIX}/2026/05/17`));
            const tempLeaks = entries.filter((e) => e.includes(".tmp-"));
            expect(tempLeaks).toEqual([]);
            expect(entries).toContain("0002Z.md");
        }
        finally {
            rmSync(repo, { recursive: true, force: true });
        }
    });
});
describe("argument-parser fail-closed behaviors (via subprocess)", () => {
    // Each test exercises main() via Bun.spawn to surface real exit codes.
    async function run(args) {
        const proc = Bun.spawn(["bun", "src/Core.TypeScript/hygiene/add-pipe-row-header.ts", ...args], {
            cwd: REPO_ROOT,
            env: { ...process.env, REPO_ROOT: "/nonexistent-tmpdir-for-test" },
            stdout: "pipe",
            stderr: "pipe",
        });
        await proc.exited;
        const stderr = await new Response(proc.stderr).text();
        return { exit: proc.exitCode ?? 0, stderr };
    }
    test("--files with no paths exits non-zero", async () => {
        const { exit, stderr } = await run(["--files"]);
        expect(exit).toBe(1);
        expect(stderr).toContain("--files specified but no paths");
    });
    test("unknown flag --file (typo) exits non-zero", async () => {
        const { exit, stderr } = await run(["--file", "foo"]);
        expect(exit).toBe(1);
        expect(stderr).toContain("unrecognized flag");
    });
    test("stray positional outside --files exits non-zero", async () => {
        const { exit, stderr } = await run(["random-arg"]);
        expect(exit).toBe(1);
        expect(stderr).toContain("unexpected positional");
    });
});
