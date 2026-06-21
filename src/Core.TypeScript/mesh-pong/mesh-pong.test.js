/**
 * MeshPong cross-verify — the TS oracle replays the SAME game-state treaty session the F# oracle locked
 * (./golden-vectors.lines): four compilers, one match, one world.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { create, ofLine, parseInputs, step, toLine } from "./mesh-pong";
const golden = readFileSync(join(import.meta.dir, "golden-vectors.lines"), "utf-8")
    .split("\n")
    .filter((l) => !l.startsWith("#") && l.length > 0)
    .map((l) => {
    const i1 = l.indexOf("\t");
    const i2 = l.indexOf("\t", i1 + 1);
    return { kind: l.slice(0, i1), rest: l.slice(i2 + 1) };
});
describe("MeshPong — game-state treaty (TS oracle)", () => {
    it("BYTE-LOCK: replaying the golden session hits every checkpoint exactly", () => {
        let g = create();
        let inputs = 0;
        let checks = 0;
        for (const { kind, rest } of golden) {
            if (kind === "i") {
                const p = parseInputs(rest);
                expect(p).not.toBeNull();
                g = step(p[0], p[1], g);
                inputs++;
            }
            else {
                expect(toLine(g)).toBe(rest);
                checks++;
            }
        }
        expect(inputs).toBe(300);
        expect(checks).toBe(5);
    });
    it("state codec round-trips and refuses malformed", () => {
        const g = create();
        expect(ofLine(toLine(g))).toEqual(g);
        expect(ofLine("garbage")).toBeNull();
        expect(ofLine("ponggame2\t1\t2\t3\t4\t5\t6\t7\t8")).toBeNull();
        expect(ofLine("ponggame1\t1\t2\t3\t4\t5\t6\t7")).toBeNull();
    });
});
