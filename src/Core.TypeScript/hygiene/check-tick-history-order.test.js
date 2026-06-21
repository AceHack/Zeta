import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const TMPDIR = mkdtempSync(join(tmpdir(), "tick-history-order-test-"));
const SCRIPT = join(import.meta.dir, "check-tick-history-order.ts");
afterAll(() => {
    rmSync(TMPDIR, { recursive: true, force: true });
});
function runOrderCheck(content) {
    const path = join(TMPDIR, `tick-${randomUUID()}.md`);
    writeFileSync(path, content);
    return Bun.spawnSync(["bun", SCRIPT, path], {
        stdout: "pipe",
        stderr: "pipe",
    });
}
describe("check-tick-history-order", () => {
    test("accepts minute and second precision rows in chronological order", () => {
        const result = runOrderCheck([
            "| 2026-05-17T12:34Z | a | b | c | d | e |",
            "| 2026-05-17T12:34:56Z | a | b | c | d | e |",
            "| 2026-05-17T12:35Z | a | b | c | d | e |",
        ].join("\n"));
        expect(result.exitCode).toBe(0);
    });
    test("flags out-of-order minute precision rows", () => {
        const result = runOrderCheck(["| 2026-05-17T12:35Z | a | b | c | d | e |", "| 2026-05-17T12:34Z | a | b | c | d | e |"].join("\n"));
        expect(result.exitCode).toBe(1);
        expect(result.stderr?.toString()).toContain("2026-05-17T12:34Z");
    });
    test("sorts minute precision as the start of that minute", () => {
        const result = runOrderCheck(["| 2026-05-17T12:34:56Z | a | b | c | d | e |", "| 2026-05-17T12:34Z | a | b | c | d | e |"].join("\n"));
        expect(result.exitCode).toBe(1);
    });
});
