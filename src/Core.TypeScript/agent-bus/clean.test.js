import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { cleanExpired } from "./clean";
let ROOT;
beforeEach(() => {
    ROOT = mkdtempSync(join(tmpdir(), "agent-bus-clean-test-"));
});
afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
});
describe("cleanExpired", () => {
    it("prunes expired envelopes and leaves non-expired envelopes", () => {
        const expiredPath = join(ROOT, "otto-cli", "2026", "05", "31", "expired.json");
        const activePath = join(ROOT, "otto-cli", "2026", "05", "31", "active.json");
        mkdirSync(dirname(expiredPath), { recursive: true });
        // Expiry: 1 hour ago
        const expiredContent = {
            id: "expired",
            expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        };
        // Expiry: 1 hour from now
        const activeContent = {
            id: "active",
            expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        };
        writeFileSync(expiredPath, JSON.stringify(expiredContent, null, 2));
        writeFileSync(activePath, JSON.stringify(activeContent, null, 2));
        expect(existsSync(expiredPath)).toBe(true);
        expect(existsSync(activePath)).toBe(true);
        const pruned = cleanExpired(ROOT, true); // noPush = true
        expect(pruned).toContain(expiredPath);
        expect(pruned).not.toContain(activePath);
        expect(existsSync(expiredPath)).toBe(false);
        expect(existsSync(activePath)).toBe(true);
    });
});
