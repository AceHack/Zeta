import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkFile } from "./check-semantic-equivalence.js";
function setupTmpDir() {
    const root = mkdtempSync(join(tmpdir(), "check-semantic-equivalence-"));
    return {
        root,
        cleanup: () => {
            try {
                rmSync(root, { recursive: true, force: true });
            }
            catch {
                // Best-effort cleanup
            }
        },
    };
}
describe("check-semantic-equivalence", () => {
    test("finds standard equivalence claims", () => {
        const fx = setupTmpDir();
        try {
            const file = join(fx.root, "test.md");
            writeFileSync(file, [
                "# Test Claims",
                "",
                "Some prose here.",
                "We claim that `ll` is an alias for `ls -l` and also that `bun ci` is equivalent to `bun install --frozen-lockfile`.",
                "Another claim: `foo` is the same as `bar`.",
                "",
            ].join("\n"));
            const result = checkFile(file);
            expect(result.ok).toBe(true);
            expect(result.findings).toHaveLength(3);
            expect(result.findings[0].left).toBe("ll");
            expect(result.findings[0].relation).toBe("is an alias for");
            expect(result.findings[0].right).toBe("ls -l");
            expect(result.findings[1].left).toBe("bun ci");
            expect(result.findings[1].relation).toBe("is equivalent to");
            expect(result.findings[1].right).toBe("bun install --frozen-lockfile");
            expect(result.findings[2].left).toBe("foo");
            expect(result.findings[2].relation).toBe("is the same as");
            expect(result.findings[2].right).toBe("bar");
        }
        finally {
            fx.cleanup();
        }
    });
    test("ignores claims inside backtick-fenced code blocks", () => {
        const fx = setupTmpDir();
        try {
            const file = join(fx.root, "test-fenced.md");
            writeFileSync(file, [
                "# Test Fenced",
                "",
                "```bash",
                "`ll` is an alias for `ls -l`",
                "```",
                "",
                "Prose outside block: `foo` is the same as `bar`.",
            ].join("\n"));
            const result = checkFile(file);
            expect(result.ok).toBe(true);
            expect(result.findings).toHaveLength(1);
            expect(result.findings[0].left).toBe("foo");
            expect(result.findings[0].right).toBe("bar");
        }
        finally {
            fx.cleanup();
        }
    });
    test("ignores claims inside tilde-fenced code blocks", () => {
        const fx = setupTmpDir();
        try {
            const file = join(fx.root, "test-tilde.md");
            writeFileSync(file, [
                "# Test Tilde",
                "",
                "~~~md",
                "`ll` is an alias for `ls -l`",
                "~~~",
                "",
                "Prose outside block: `foo` is the same as `bar`.",
            ].join("\n"));
            const result = checkFile(file);
            expect(result.ok).toBe(true);
            expect(result.findings).toHaveLength(1);
            expect(result.findings[0].left).toBe("foo");
            expect(result.findings[0].right).toBe("bar");
        }
        finally {
            fx.cleanup();
        }
    });
    test("ignores files without correct extensions", () => {
        const fx = setupTmpDir();
        try {
            const file = join(fx.root, "test.txt");
            writeFileSync(file, "`ll` is an alias for `ls -l`\n");
            const result = checkFile(file);
            expect(result.ok).toBe(true);
            expect(result.findings).toHaveLength(0);
        }
        finally {
            fx.cleanup();
        }
    });
    test("returns ok=false for non-existent file", () => {
        const result = checkFile("/non/existent/path/for/sure/file.md");
        expect(result.ok).toBe(false);
        expect(result.findings).toHaveLength(0);
    });
});
