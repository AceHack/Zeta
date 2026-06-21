/**
 * CHIP-9 cross-verify — the TS oracle replays the treaty ROM the F# oracle locked
 * (./golden-vectors.lines) and must reproduce the 32×64 hex color grid + plane register exactly.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { colorAt, create, H, loadRom, step, W } from "./chip9";
const lines = readFileSync(join(import.meta.dir, "golden-vectors.lines"), "utf-8")
    .split("\n")
    .filter((l) => !l.startsWith("#") && l.length > 0);
describe("CHIP-9 — the color-plane treaty (TS oracle)", () => {
    it("BYTE-LOCK: replaying the treaty ROM reproduces the golden color grid exactly", () => {
        const romLine = lines[0];
        const planeLine = lines[1];
        expect(romLine).toBeDefined();
        expect(planeLine).toBeDefined();
        if (romLine === undefined || planeLine === undefined)
            return;
        const romHex = romLine.split("\t")[1];
        const planeText = planeLine.split("\t")[1];
        expect(romHex).toBeDefined();
        expect(planeText).toBeDefined();
        if (romHex === undefined || planeText === undefined)
            return;
        const rom = new Uint8Array((romHex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));
        const goldenPlane = parseInt(planeText, 10);
        const goldenRows = lines.slice(2, 2 + H); // the fault-treaty keys follow the grid
        expect(goldenRows.length).toBe(H);
        let f = create();
        f = loadRom(rom, f);
        for (let k = 0; k < 8; k++)
            f.mem.set(0x300 + k, 0xff); // solid 8x8 treaty sprite (B-1031)
        for (let s = 0; s < 30; s++)
            f = step(f);
        expect(f.plane).toBe(goldenPlane);
        for (let y = 0; y < H; y++) {
            let row = "";
            for (let x = 0; x < W; x++)
                row += colorAt(x, y, f).toString(16);
            const expected = goldenRows[y];
            expect(expected).toBeDefined();
            if (expected === undefined)
                return;
            expect(row).toBe(expected);
        }
    });
    const keyed = (key) => {
        const line = lines.find((l) => l.startsWith(key + "\t"));
        expect(line).toBeDefined();
        return line?.split("\t")[1] ?? "";
    };
    for (const which of ["underflow", "overflow"]) {
        it(`FAULT TREATY (${which}): recorded never fatal; refused CALL falls through; text/pc/depth byte-locked`, () => {
            const rom = new Uint8Array((keyed(`fault-rom-${which}`).match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));
            const steps = parseInt(keyed(`fault-steps-${which}`), 10);
            let f = loadRom(rom, create());
            for (let s = 0; s < steps; s++)
                f = step(f);
            expect(f.fault).toBe(keyed(`fault-text-${which}`));
            expect(f.pc.toString(16).padStart(4, "0")).toBe(keyed(`fault-pc-${which}`));
            expect(f.stack.length).toBe(parseInt(keyed(`fault-depth-${which}`), 10));
        });
    }
});
