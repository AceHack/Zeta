// Unit tests for FAT12 + VFAT LFN byte logic behind raw ESP key injection.
//
// Run: bun test src/Core.TypeScript/zflash/fat12-lib.test.ts
import { test, expect, describe } from "bun:test";
import { fat12Get, fat12Set, lfnChecksum, buildDirEntries, reconstructLongName, firstFreeCluster, firstFreeDirSlots, LFN_SLOTS, } from "./fat12-lib.js";
describe("FAT12 cluster table (12-bit nibble packing)", () => {
    test("round-trips even and odd cluster entries independently", () => {
        const fat = Buffer.alloc(64, 0);
        // Even cluster
        fat12Set(fat, 2, 0x123);
        expect(fat12Get(fat, 2)).toBe(0x123);
        // Odd cluster sharing a byte with cluster 2
        fat12Set(fat, 3, 0xabc);
        expect(fat12Get(fat, 3)).toBe(0xabc);
        // Setting the odd one must NOT have corrupted the even one (shared byte)
        expect(fat12Get(fat, 2)).toBe(0x123);
    });
    test("EOC marker (0xFFF) reads back exactly at the real cluster 719", () => {
        // Mirror the real ESP FAT size (fatSz16=5 * 512 = 2560 B); cluster 719's
        // 12-bit entry lives at byte offset floor(719*3/2)=1078.
        const fat = Buffer.alloc(2560, 0);
        fat12Set(fat, 719, 0xfff);
        expect(fat12Get(fat, 719)).toBe(0xfff);
    });
    test("a free entry reads as 0; a chain of sets is independent", () => {
        const fat = Buffer.alloc(64, 0);
        expect(fat12Get(fat, 5)).toBe(0);
        for (const [c, v] of [[2, 0x3], [3, 0xfff], [4, 0x5], [5, 0x6]])
            fat12Set(fat, c, v);
        expect(fat12Get(fat, 2)).toBe(0x3);
        expect(fat12Get(fat, 3)).toBe(0xfff);
        expect(fat12Get(fat, 4)).toBe(0x5);
        expect(fat12Get(fat, 5)).toBe(0x6);
    });
});
describe("VFAT LFN checksum", () => {
    test("matches the value the live flash logged (ZETA-A~1PUB => 0x4b)", () => {
        // node-09485d, 2026-06-07: "wrote dir entries (short='ZETA-A~1PUB' ... cksum=0x4b)"
        expect(lfnChecksum(Buffer.from("ZETA-A~1PUB", "latin1"))).toBe(0x4b);
    });
    test("is deterministic and 8-bit", () => {
        const v = lfnChecksum(Buffer.from("ABCDEFGH123", "latin1"));
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(0xff);
        expect(lfnChecksum(Buffer.from("ABCDEFGH123", "latin1"))).toBe(v);
    });
});
describe("LFN write -> read symmetry (what the installer does)", () => {
    // Build the dir entries for a long name, then reconstruct it from the LFN
    // pieces exactly as Linux vfat would. The two must be identical.
    const roundTrip = (name) => {
        const short11 = Buffer.from("ZETA-A~1PUB", "latin1");
        const shortEntry = Buffer.alloc(32, 0);
        short11.copy(shortEntry, 0);
        const entries = buildDirEntries(name, short11, shortEntry);
        const lfns = entries.slice(0, -1); // drop the short entry
        return reconstructLongName(lfns);
    };
    test("the real key filename round-trips", () => {
        expect(roundTrip("zeta-authorized-keys.pub")).toBe("zeta-authorized-keys.pub");
    });
    test("boundary lengths round-trip (13, 14, 26 chars)", () => {
        expect(roundTrip("a".repeat(13))).toBe("a".repeat(13)); // exactly one LFN entry
        expect(roundTrip("a".repeat(14))).toBe("a".repeat(14)); // spills to a 2nd entry
        expect(roundTrip("a".repeat(26))).toBe("a".repeat(26)); // fills two entries exactly
    });
    test("mixed names with dots/dashes/digits round-trip", () => {
        for (const n of ["server.cfg", "gm_construct-v2.dat", "x.y", "addons.workshop.123"]) {
            expect(roundTrip(n)).toBe(n);
        }
    });
});
describe("LFN on-disk ordering", () => {
    test("highest ordinal first with the 0x40 LAST flag; short entry last", () => {
        const name = "zeta-authorized-keys.pub"; // 24 chars => 2 LFN entries
        const short11 = Buffer.from("ZETA-A~1PUB", "latin1");
        const shortEntry = Buffer.alloc(32, 0);
        short11.copy(shortEntry, 0);
        const e = buildDirEntries(name, short11, shortEntry);
        expect(e.length).toBe(3); // 2 LFN + 1 short
        expect(e[0][0]).toBe(0x40 | 2); // last piece first, LAST flag set
        expect(e[1][0]).toBe(0x01); // then seq 1
        expect(e[0][11]).toBe(0x0f); // LFN attr
        expect(e[2]).toBe(shortEntry); // short entry trails
    });
});
describe("FAT free-space planning", () => {
    test("firstFreeCluster skips allocated entries", () => {
        const fat = Buffer.alloc(512, 0);
        for (let c = 2; c < 50; c++)
            fat12Set(fat, c, 0xfff); // 2..49 allocated
        expect(firstFreeCluster(fat, 200)).toBe(50);
    });
    test("firstFreeDirSlots finds N consecutive free 32-byte slots", () => {
        const root = Buffer.alloc(512 * 32, 0); // all free
        root[0] = 0x41; // entry 0 used
        root[32] = 0x42; // entry 1 used
        expect(firstFreeDirSlots(root, 512, 3)).toBe(2); // first run of 3 starts at 2
    });
});
describe("LFN slot table", () => {
    test("covers 13 UTF-16LE positions within the 32-byte entry", () => {
        expect(LFN_SLOTS.length).toBe(13);
        for (const s of LFN_SLOTS)
            expect(s + 1).toBeLessThanOrEqual(32);
    });
});
