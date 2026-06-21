import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isSafeFilename, parseAllowlist, splitRoms, main } from "./split-by-license.js";
function makeTree() {
    const root = mkdtempSync(join(tmpdir(), "zeta-split-roms-"));
    const romDir = join(root, "roms");
    const safeDir = join(root, "safe");
    const unsafeDir = join(root, "unsafe");
    const allowlist = join(root, "allowlist");
    mkdirSync(romDir, { recursive: true });
    return { romDir, safeDir, unsafeDir, allowlist };
}
describe("isSafeFilename", () => {
    test("accepts a plain ROM name", () => {
        expect(isSafeFilename("Halo 2600 (2010) (Ed Fries).bin")).toBe(true);
    });
    test("rejects path-traversal and separator characters", () => {
        expect(isSafeFilename("../escape.bin")).toBe(false);
        expect(isSafeFilename("sub/dir.bin")).toBe(false);
        expect(isSafeFilename("back\\slash.bin")).toBe(false);
        expect(isSafeFilename("")).toBe(false);
        expect(isSafeFilename("..")).toBe(false);
        expect(isSafeFilename("nul\0byte.bin")).toBe(false);
    });
});
describe("parseAllowlist", () => {
    test("keeps bare names, drops comments and blanks", () => {
        const allowed = parseAllowlist("# header\n\nA.bin\n  B.bin  \n# trailing\n");
        expect(allowed.has("A.bin")).toBe(true);
        expect(allowed.has("B.bin")).toBe(true);
        expect(allowed.size).toBe(2);
    });
});
describe("splitRoms", () => {
    test("dry-run classifies without moving", () => {
        const { romDir, safeDir, unsafeDir } = makeTree();
        writeFileSync(join(romDir, "safe.bin"), "");
        writeFileSync(join(romDir, "unsafe.bin"), "");
        const result = splitRoms(romDir, safeDir, unsafeDir, new Set(["safe.bin"]), false);
        expect(result.entries).toHaveLength(2);
        expect(result.movedToSafe).toBe(0);
        expect(result.movedToUnsafe).toBe(0);
        // Files stay put on a dry-run.
        expect(existsSync(join(romDir, "safe.bin"))).toBe(true);
        expect(existsSync(safeDir)).toBe(false);
    });
    test("apply moves ROMs to the correct directories", () => {
        const { romDir, safeDir, unsafeDir } = makeTree();
        writeFileSync(join(romDir, "safe.bin"), "");
        writeFileSync(join(romDir, "unsafe.bin"), "");
        const result = splitRoms(romDir, safeDir, unsafeDir, new Set(["safe.bin"]), true);
        expect(result.movedToSafe).toBe(1);
        expect(result.movedToUnsafe).toBe(1);
        expect(existsSync(join(safeDir, "safe.bin"))).toBe(true);
        expect(existsSync(join(unsafeDir, "unsafe.bin"))).toBe(true);
    });
    test("leaves non-ROM sentinels (README.md, .gitignore) in place", () => {
        const { romDir, safeDir, unsafeDir } = makeTree();
        writeFileSync(join(romDir, "rom.bin"), "");
        writeFileSync(join(romDir, "README.md"), "tracked sentinel");
        writeFileSync(join(romDir, ".gitignore"), "*");
        splitRoms(romDir, safeDir, unsafeDir, new Set(["rom.bin"]), true);
        // Sentinels must NOT be swept into the unsafe directory.
        expect(existsSync(join(romDir, "README.md"))).toBe(true);
        expect(existsSync(join(romDir, ".gitignore"))).toBe(true);
        expect(existsSync(join(unsafeDir, "README.md"))).toBe(false);
    });
});
describe("main", () => {
    test("returns 64 on missing required flag", () => {
        expect(main(["--rom-dir", "x"])).toBe(64);
    });
    test("returns 64 when a flag value is another flag", () => {
        expect(main(["--rom-dir", "--safe-dir", "s", "--unsafe-dir", "u", "--allowlist", "a"])).toBe(64);
    });
    test("returns 1 when the rom directory is missing", () => {
        const { safeDir, unsafeDir, allowlist } = makeTree();
        writeFileSync(allowlist, "x.bin\n");
        expect(main(["--rom-dir", "/no/such/dir", "--safe-dir", safeDir, "--unsafe-dir", unsafeDir, "--allowlist", allowlist])).toBe(1);
    });
    test("dry-run end to end returns 0 and moves nothing", () => {
        const { romDir, safeDir, unsafeDir, allowlist } = makeTree();
        writeFileSync(join(romDir, "ok.bin"), "");
        writeFileSync(allowlist, "# safe\nok.bin\n");
        const code = main([
            "--rom-dir",
            romDir,
            "--safe-dir",
            safeDir,
            "--unsafe-dir",
            unsafeDir,
            "--allowlist",
            allowlist,
        ]);
        expect(code).toBe(0);
        expect(existsSync(join(romDir, "ok.bin"))).toBe(true);
        expect(existsSync(safeDir)).toBe(false);
    });
});
