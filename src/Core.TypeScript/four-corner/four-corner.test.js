/**
 * FourCorner cross-verify — the TS oracle conforms to the SAME treaty golden lines the F# oracle locked
 * and the C# oracle confirmed (./golden-vectors.lines). Third oracle, identical bytes.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasFeedback, hasOutput, ofIn, ofLine, toLine } from "./four-corner";
const goldenLines = readFileSync(join(import.meta.dir, "golden-vectors.lines"), "utf-8")
    .split("\n")
    .filter((l) => !l.startsWith("#") && l.length > 0);
const vectors = [
    { tIn: "operator-message", tOut: "emitted", tOutFeedback: "conv-feedback", tInFeedback: "co-owned-ack" },
    { tIn: "only-input", tOut: null, tOutFeedback: null, tInFeedback: null },
    { tIn: "tab\there\nand-newline", tOut: "back\\slash", tOutFeedback: null, tInFeedback: "ends-with-tab\t" },
    { tIn: "", tOut: "", tOutFeedback: null, tInFeedback: null },
    { tIn: "héllo-wörld-⊕-unicode", tOut: null, tOutFeedback: "反馈", tInFeedback: null },
];
describe("FourCorner — treaty byte-lock (third oracle)", () => {
    it("BYTE-LOCK: every vector serializes to its golden line exactly", () => {
        expect(goldenLines.length).toBe(vectors.length);
        for (let i = 0; i < vectors.length; i++) {
            expect(toLine(vectors[i])).toBe(goldenLines[i]);
        }
    });
    it("round-trip: every golden line parses back to its vector", () => {
        for (let i = 0; i < vectors.length; i++) {
            const parsed = ofLine(goldenLines[i]);
            expect(parsed).not.toBeNull();
            expect(parsed).toEqual(vectors[i]);
        }
    });
    it("malformed lines are refused honestly", () => {
        expect(ofLine("garbage")).toBeNull();
        expect(ofLine("fourcorner1\tonly-three\t-\t-")).toBeNull();
        expect(ofLine("fourcorner2\ta\t-\t-\t-")).toBeNull(); // wrong version tag
        expect(ofLine("fourcorner1\ta\t?\t-\t-")).toBeNull(); // malformed opt
    });
    it("the corner helpers behave (ofIn/hasOutput/hasFeedback)", () => {
        const o = ofIn("msg");
        expect(hasOutput(o)).toBe(false);
        expect(hasFeedback(o)).toBe(false);
        expect(hasOutput({ ...o, tOut: "x" })).toBe(true);
        expect(hasFeedback({ ...o, tInFeedback: "ack" })).toBe(true);
    });
});
