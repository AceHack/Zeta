/**
 * src/Core.TypeScript/zflash/esp-fat-writer.test.ts
 *
 * The pure-TypeScript FAT writer that bakes ESP payloads into a COPY of the
 * installer ISO before the Windows raw write. Every assertion reads the result
 * back through test-harness/isohybrid-esp-fixture.ts `readFixtureRoot`, a FAT
 * parser that shares no code with the writer — directory entries, the VFAT
 * long name (checksum-verified), and the cluster chain in BOTH FAT copies.
 */
import { describe, expect, test } from "bun:test";
import { closeSync, mkdtempSync, openSync, readSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { bakeEspFiles, fdBlockIo, generateShortName, locateIsohybridEsp, parseFatVolume, type EspFile } from "./esp-fat-writer.ts";
import { pubkeyFileContent } from "./flash-usb-windows.ts";
import {
  buildIsohybridFixture,
  FAT16_SPEC,
  readFixtureRoot,
  REAL_ISO_FAT12,
  type FixtureSpec,
} from "./test-harness/isohybrid-esp-fixture.ts";

const PUBKEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIabc123def456ghi789jkl012mno345pqr678stu90 zeta@operator";

function bakeIntoFixture(spec: FixtureSpec, files: readonly EspFile[], image?: Buffer) {
  const dir = mkdtempSync(join(tmpdir(), "esp-fat-"));
  const path = join(dir, "image.iso");
  const before = image ?? buildIsohybridFixture(spec);
  // ONE descriptor for write, bake and read-back: the image checked is the image baked.
  const fd = openSync(path, "wx+");
  try {
    writeSync(fd, before, 0, before.length, 0);
    const result = bakeEspFiles(fdBlockIo(fd), files);
    const after = Buffer.alloc(before.length);
    readSync(fd, after, 0, after.length, 0);
    return { result, before, after };
  } finally {
    closeSync(fd);
  }
}

describe("bakeEspFiles — FAT12 ESP shaped like the real installer ISO", () => {
  const body = Buffer.from(pubkeyFileContent(PUBKEY), "utf8");

  test("the pubkey lands as zeta-authorized-keys.pub with the exact content, 8.3 alias + LFN, in both FATs", () => {
    const { result, after } = bakeIntoFixture(REAL_ISO_FAT12, [{ name: "zeta-authorized-keys.pub", body }]);
    expect(result.ok).toBe(true);
    const root = readFixtureRoot(after);
    expect(root.fatType).toBe(12);
    const f = root.files.find((x) => x.longName === "zeta-authorized-keys.pub");
    expect(f).toBeDefined();
    expect(f!.content.equals(body)).toBe(true);
    expect(f!.content.toString("utf8").endsWith("zeta@operator\n")).toBe(true);
    expect(f!.content.toString("utf8").includes("\r")).toBe(false);
    // Same alias and cluster mtools chose on the real ISO (2026-09-27): ZETA-A~1PUB @ 721.
    expect(f!.short11).toBe("ZETA-A~1PUB");
    expect(f!.firstCluster).toBe(721);
    expect(f!.lfnOrdinals).toEqual([0x42, 0x01]);
    expect(f!.attr).toBe(0x20);
    expect(f!.chainFat0).toEqual([721]);
    expect(f!.chainFat1).toEqual([721]);
  });

  test("pre-existing entries (label, EFI dir) survive; the deleted 1-slot hole is not used for a 3-slot run", () => {
    const { after } = bakeIntoFixture(REAL_ISO_FAT12, [{ name: "zeta-authorized-keys.pub", body }]);
    const root = readFixtureRoot(after);
    expect(root.files.map((x) => x.short11)).toEqual(["EFIBOOT    ", "EFI        ", "ZETA-A~1PUB"]);
    expect(root.files[1]!.firstCluster).toBe(2);
  });

  test("a multi-cluster file is chained across clusters identically in both FATs", () => {
    const big = Buffer.alloc(5000);
    for (let i = 0; i < big.length; i++) big[i] = (i * 13) & 0xff;
    const { result, after } = bakeIntoFixture(REAL_ISO_FAT12, [{ name: "zeta-firstboot.conf", body: big }]);
    expect(result.ok).toBe(true);
    const f = readFixtureRoot(after).files.find((x) => x.longName === "zeta-firstboot.conf")!;
    expect(f.chainFat0).toEqual([721, 722, 723]); // 5000 B / 2048 B clusters
    expect(f.chainFat1).toEqual(f.chainFat0);
    expect(f.size).toBe(5000);
    expect(f.content.equals(big)).toBe(true);
  });

  test("several payloads, same 8.3 prefix, get distinct numeric tails", () => {
    const files: EspFile[] = [
      { name: "zeta-authorized-keys.pub", body },
      { name: "zeta-hostname.txt", body: Buffer.from("node-a\n") },
      { name: "zeta-firstboot.conf", body: Buffer.from("HOST='control-plane'\n") },
      { name: "zeta-foo.conf", body: Buffer.from("X=1\n") },
      { name: "zeta-repo-pin", body: Buffer.from(`ZETA_ISO_COMMIT='${"a".repeat(40)}'\n`) },
    ];
    const { result, after } = bakeIntoFixture(REAL_ISO_FAT12, files);
    expect(result.ok).toBe(true);
    const root = readFixtureRoot(after);
    for (const want of files) {
      const got = root.files.find((x) => x.longName === want.name);
      expect(got?.content.equals(want.body)).toBe(true);
    }
    const shorts = Object.fromEntries(root.files.filter((x) => x.longName !== null).map((x) => [x.longName, x.short11]));
    expect(shorts["zeta-firstboot.conf"]).toBe("ZETA-F~1CON");
    expect(shorts["zeta-foo.conf"]).toBe("ZETA-F~2CON");
    expect(shorts["zeta-hostname.txt"]).toBe("ZETA-H~1TXT");
    expect(shorts["zeta-repo-pin"]).toBe("ZETA-R~1   ");
  });

  test("writes nothing outside the ESP partition", () => {
    const { before, after } = bakeIntoFixture(REAL_ISO_FAT12, [{ name: "zeta-authorized-keys.pub", body }]);
    const espStart = REAL_ISO_FAT12.espStartLba * 512;
    const espEnd = espStart + REAL_ISO_FAT12.espSectors * 512;
    expect(after.subarray(0, espStart).equals(before.subarray(0, espStart))).toBe(true);
    expect(after.subarray(espEnd).equals(before.subarray(espEnd))).toBe(true);
    expect(after.subarray(espStart, espEnd).equals(before.subarray(espStart, espEnd))).toBe(false);
  });

  test("deterministic: the same payloads baked twice give byte-identical images", () => {
    const a = bakeIntoFixture(REAL_ISO_FAT12, [{ name: "zeta-authorized-keys.pub", body }]).after;
    const b = bakeIntoFixture(REAL_ISO_FAT12, [{ name: "zeta-authorized-keys.pub", body }]).after;
    expect(a.equals(b)).toBe(true);
  });
});

describe("bakeEspFiles — refusals (never a silent green)", () => {
  const body = Buffer.from("x\n");

  test("refuses a name that already exists (case-insensitively) instead of overwriting it", () => {
    const first = bakeIntoFixture(REAL_ISO_FAT12, [{ name: "zeta-hostname.txt", body }]);
    expect(first.result.ok).toBe(true);
    const second = bakeIntoFixture(REAL_ISO_FAT12, [{ name: "ZETA-HOSTNAME.TXT", body }], first.after);
    expect(second.result.ok).toBe(false);
    if (!second.result.ok) expect(second.result.error).toContain("already exists");
    expect(bakeIntoFixture(REAL_ISO_FAT12, [{ name: "efi", body }]).result.ok).toBe(false);
  });

  test("refuses an image whose MBR names no 0xEF partition (no guessed offset)", () => {
    const img = buildIsohybridFixture(REAL_ISO_FAT12);
    img[0x1be + 16 + 4] = 0x83;
    const r = bakeIntoFixture(REAL_ISO_FAT12, [{ name: "zeta-hostname.txt", body }], img);
    expect(r.result.ok).toBe(false);
    if (!r.result.ok) expect(r.result.error).toContain("0xEF");
  });

  test("refuses a FAT32-shaped BPB", () => {
    const img = buildIsohybridFixture(REAL_ISO_FAT12);
    const bs = REAL_ISO_FAT12.espStartLba * 512;
    img.writeUInt16LE(0, bs + 0x16); // FATSz16 = 0 → FAT32 layout
    img.writeUInt16LE(0, bs + 0x11);
    const r = bakeIntoFixture(REAL_ISO_FAT12, [{ name: "zeta-hostname.txt", body }], img);
    expect(r.result.ok).toBe(false);
  });

  test("refuses when the ESP has no free clusters", () => {
    const full: FixtureSpec = { ...REAL_ISO_FAT12, occupiedClusters: 1500 }; // (6144-1-10-32)/4 = 1525 clusters → 25 free
    const tooBig = Buffer.alloc(26 * 2048);
    const r = bakeIntoFixture(full, [{ name: "zeta-firstboot.conf", body: tooBig }]);
    expect(r.result.ok).toBe(false);
    if (!r.result.ok) expect(r.result.error).toContain("ESP full");
  });

  test("refuses duplicate names and names FAT forbids", () => {
    expect(bakeIntoFixture(REAL_ISO_FAT12, [{ name: "a.txt", body }, { name: "A.TXT", body }]).result.ok).toBe(false);
    expect(bakeIntoFixture(REAL_ISO_FAT12, [{ name: "a/b", body }]).result.ok).toBe(false);
  });
});

describe("bakeEspFiles — FAT16", () => {
  test("adds a file with LFN to a FAT16 ESP; both FATs carry the chain", () => {
    const body = Buffer.alloc(1500, 0x61);
    const { result, after } = bakeIntoFixture(FAT16_SPEC, [{ name: "zeta-authorized-keys.pub", body }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.fatType).toBe(16);
    const root = readFixtureRoot(after);
    expect(root.fatType).toBe(16);
    const f = root.files.find((x) => x.longName === "zeta-authorized-keys.pub")!;
    expect(f.chainFat0).toEqual([12, 13, 14]); // 512-byte clusters, clusters 2..11 occupied
    expect(f.chainFat1).toEqual([12, 13, 14]);
    expect(f.content.equals(body)).toBe(true);
  });
});

describe("pieces", () => {
  test("locateIsohybridEsp reads the 0xEF entry of the real ISO's layout", () => {
    const img = buildIsohybridFixture(REAL_ISO_FAT12);
    const r = locateIsohybridEsp(img.subarray(0, 512));
    expect(r).toEqual({ ok: true, value: { startLba: 276, sectorCount: 6144, offsetBytes: 276 * 512 } });
  });
  test("parseFatVolume decides FAT12 by cluster count", () => {
    const img = buildIsohybridFixture(REAL_ISO_FAT12);
    const off = 276 * 512;
    const v = parseFatVolume(img.subarray(off, off + 512), off, 6144);
    expect(v.ok && v.value.fatType).toBe(12);
    expect(v.ok && v.value.clusterCount).toBe(1525);
  });
  test("generateShortName: numeric tails, plain 8.3 kept, collisions skipped", () => {
    expect(generateShortName("zeta-authorized-keys.pub", new Set())).toEqual({ ok: true, value: "ZETA-A~1PUB" });
    expect(generateShortName("zeta-authorized-keys.pub", new Set(["ZETA-A~1PUB"]))).toEqual({ ok: true, value: "ZETA-A~2PUB" });
    expect(generateShortName("README.TXT", new Set())).toEqual({ ok: true, value: "README  TXT" });
    expect(generateShortName("a+b.conf", new Set())).toEqual({ ok: true, value: "A_B~1   CON" });
  });
});
