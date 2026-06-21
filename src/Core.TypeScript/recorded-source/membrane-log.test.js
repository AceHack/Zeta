/** Membrane-log cross-verify — the TS oracle re-serializes the SAME locked wire lines byte-for-byte. */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ofLine, toLine } from "./membrane-log";
const lines = readFileSync(join(import.meta.dir, "golden-vectors.lines"), "utf-8")
    .split("\n")
    .filter((l) => !l.startsWith("#") && l.length > 0);
describe("membrane-log — treaty byte-lock (TS oracle)", () => {
    it("BYTE-LOCK: every golden line parses and re-serializes identically", () => {
        expect(lines.length).toBe(10);
        for (const line of lines) {
            const parsed = ofLine(line);
            expect(parsed).not.toBeNull();
            expect(toLine(parsed)).toBe(line);
        }
    });
    it("malformed and unknown kinds are refused honestly", () => {
        expect(ofLine("garbage")).toBeNull();
        expect(ofLine("x\tTimerElapsed\t17")).toBeNull();
        expect(ofLine("0\tNotAKind\t1")).toBeNull();
        expect(ofLine("0\tTimerElapsed")).toBeNull();
        expect(ofLine("0\tSentinelMissing\tjunk")).toBeNull();
    });
});
