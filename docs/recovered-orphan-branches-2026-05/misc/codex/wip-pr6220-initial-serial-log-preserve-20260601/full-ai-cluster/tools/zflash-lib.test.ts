// full-ai-cluster/tools/zflash-lib.test.ts
//
// CI test cascade #2 (per the maintainer 2026-05-26 — substrate
// engineerable in isolation gets unit-tested cheaply before paying
// for slower integration tests). Pure-logic Bun unit tests for the
// zflash-lib extractions. Catches:
//
//   - RFC1123 hostname regex regressions (iter-5.2 + iter-5.2.2
//     mirrored in zflash.ts + zeta-install.sh; drift detection)
//   - diskutil-output parser regressions (iter-4.4 mount_msdos
//     added MBR 0xEF support after 2026-05-26 empirical test;
//     these tests pin the parser against representative outputs)
//   - auto-name format regressions (iter-5.2.1; node-<6hex>)
//
// Run via: bun test full-ai-cluster/tools/zflash-lib.test.ts
// Or as part of the full suite: bun test

import { describe, expect, test } from "bun:test";
import {
  generateRandomNodeName,
  isValidHostname,
  parseFatPartitionFromDiskutilList,
  parseOutputFileMarker,
  parseUuidFromDiskutilInfo,
  VALID_HOSTNAME_REGEX,
} from "./zflash-lib";

describe("VALID_HOSTNAME_REGEX / isValidHostname", () => {
  test("exports the regex directly for cross-substrate sync verification", () => {
    // The bash equivalent in zeta-install.sh greps with the regex pattern
    // `^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$`. Pin the JS source
    // shape so cross-substrate drift surfaces here.
    expect(VALID_HOSTNAME_REGEX.source).toBe(
      "^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$",
    );
  });

  test("accepts simple lowercase name", () => {
    expect(isValidHostname("pikachu")).toBe(true);
  });

  test("accepts mixed-case name", () => {
    expect(isValidHostname("PikachuNode")).toBe(true);
  });

  test("accepts name with hyphens (internal)", () => {
    expect(isValidHostname("worker-gpu-1")).toBe(true);
    expect(isValidHostname("control-plane")).toBe(true);
    expect(isValidHostname("node-a3f9c2")).toBe(true);
  });

  test("accepts single character", () => {
    expect(isValidHostname("a")).toBe(true);
    expect(isValidHostname("Z")).toBe(true);
    expect(isValidHostname("9")).toBe(true);
  });

  test("accepts 63-character name (max length)", () => {
    const name63 = "a".repeat(63);
    expect(name63.length).toBe(63);
    expect(isValidHostname(name63)).toBe(true);
  });

  test("rejects empty string", () => {
    expect(isValidHostname("")).toBe(false);
  });

  test("rejects 64-character name (over max length)", () => {
    const name64 = "a".repeat(64);
    expect(name64.length).toBe(64);
    expect(isValidHostname(name64)).toBe(false);
  });

  test("rejects leading hyphen", () => {
    expect(isValidHostname("-pikachu")).toBe(false);
  });

  test("rejects trailing hyphen", () => {
    expect(isValidHostname("pikachu-")).toBe(false);
  });

  test("rejects leading + trailing hyphen", () => {
    expect(isValidHostname("-pikachu-")).toBe(false);
  });

  test("rejects underscore", () => {
    expect(isValidHostname("pi_kachu")).toBe(false);
  });

  test("rejects dot", () => {
    expect(isValidHostname("pikachu.local")).toBe(false);
  });

  test("rejects space", () => {
    expect(isValidHostname("pikachu node")).toBe(false);
  });

  test("rejects slash", () => {
    expect(isValidHostname("worker/gpu")).toBe(false);
  });
});

describe("parseFatPartitionFromDiskutilList", () => {
  test("matches GPT EFI EFI format", () => {
    const out = `/dev/disk6 (external, physical):
   #:                       TYPE NAME                    SIZE       IDENTIFIER
   0:      GUID_partition_scheme                        *124.0 GB   disk6
   1:                        EFI EFI                   209.7 MB   disk6s1
   2:                  Apple_APFS Container disk7      123.8 GB   disk6s2`;
    expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk6s1");
  });

  test("matches real-world MS-DOS FAT32 format (diskutil empirical output shape)", () => {
    const out = `/dev/disk6 (external, physical):
   #:                       TYPE NAME                    SIZE       IDENTIFIER
   0:      GUID_partition_scheme                        *124.0 GB   disk6
   1:                   MS-DOS FAT32 NIXOS_ISO           65.5 MB    disk6s1`;
    expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk6s1");
  });

  test("matches DOS_FAT_32 (cascade-2 fix: regex broadened from `\\bDOS_FAT\\b` to `\\bDOS_FAT(_\\d+)?\\b`)", () => {
    // Cascade-#2 test finding (2026-05-26): the original regex
    // `\bDOS_FAT\b` couldn't match `DOS_FAT_32` because underscore is
    // a word-char (no \b boundary). The docstring claimed it matched.
    // Resolution in this PR: broaden to `DOS_FAT(_\d+)?` to match BOTH
    // bare `DOS_FAT` AND the underscore-suffix `DOS_FAT_32` shape that
    // the prior docstring documented.
    const out = `   1:                  DOS_FAT_32 NIXOS_ISO              65.5 MB    disk6s1`;
    expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk6s1");
  });

  test("matches DOS_FAT_16 (suffix variant)", () => {
    const out = `   1:                  DOS_FAT_16 STUFF                  32.0 MB    disk7s2`;
    expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk7s2");
  });

  test("matches MBR 0xEF format (NixOS isohybrid post-dd; iter-4.4 fix)", () => {
    // This is the exact output shape that broke iter-4.2 on 2026-05-26
    // empirical test and motivated the iter-4.4 0xEF support.
    const out = `/dev/disk6 (external, physical):
   #:                       TYPE NAME                    SIZE       IDENTIFIER
   0:     FDisk_partition_scheme                        *124.0 GB   disk6
   1:                       0xEF                         3.1 MB     disk6s2`;
    expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk6s2");
  });

  test("matches MBR 0xEF lowercase", () => {
    const out = `   1:                       0xef                         3.1 MB     disk7s1`;
    expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk7s1");
  });

  test("matches MBR 0x0C (FAT32-LBA)", () => {
    const out = `   1:                       0x0C                         100 MB     disk5s2`;
    expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk5s2");
  });

  test("matches MBR 0x06 (FAT16)", () => {
    const out = `   1:                       0x06                         32 MB      disk8s3`;
    expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk8s3");
  });

  test("returns null when no FAT/EFI partition present", () => {
    const out = `/dev/disk6 (external, physical):
   #:                       TYPE NAME                    SIZE       IDENTIFIER
   0:     FDisk_partition_scheme                        *124.0 GB   disk6
   1:                  Apple_APFS Container disk7      123.8 GB   disk6s1`;
    expect(parseFatPartitionFromDiskutilList(out)).toBe(null);
  });

  test("returns null for empty input", () => {
    expect(parseFatPartitionFromDiskutilList("")).toBe(null);
  });

  test("returns first match when multiple FAT/EFI partitions present", () => {
    // E.g., a disk with both an EFI System Partition and a separate
    // FAT32 data partition — parser returns the first one diskutil lists.
    const out = `   1:                       EFI EFI                   200 MB     disk6s1
   2:                  DOS_FAT_32 DATA                  4.0 GB     disk6s2`;
    expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk6s1");
  });

  test("does not false-positive on 0xEF inside a longer hex string", () => {
    // Defensive: \b boundary prevents matching '0xEFFFFF' or similar.
    const out = `   1:                       0xEFFFFF                     100 MB     disk6s2`;
    // The \b at the end of 0x(EF) is on hex-char boundary which counts
    // as word-char; 'EF' followed by 'F' is NOT a word boundary. So no
    // match expected.
    expect(parseFatPartitionFromDiskutilList(out)).toBe(null);
  });
});

describe("parseUuidFromDiskutilInfo", () => {
  test("prefers Volume UUID for USB-bound credential KDF", () => {
    const out = `   Device Identifier:         disk6s2
   Volume Name:               NIXOS_ISO
   Volume UUID:               1234-ABCD
   Disk / Partition UUID:     DEADBEEF-0000-1111-2222-333344445555`;
    expect(parseUuidFromDiskutilInfo(out)).toBe("1234-ABCD");
  });

  test("falls back to Disk / Partition UUID when Volume UUID is absent", () => {
    const out = `   Device Identifier:         disk6s2
   Disk / Partition UUID:     DEADBEEF-0000-1111-2222-333344445555`;
    expect(parseUuidFromDiskutilInfo(out)).toBe("DEADBEEF-0000-1111-2222-333344445555");
  });

  test("returns null when no UUID field is present", () => {
    const out = `   Device Identifier:         disk6s2
   Volume Name:               NIXOS_ISO`;
    expect(parseUuidFromDiskutilInfo(out)).toBe(null);
  });
});

describe("generateRandomNodeName", () => {
  test("produces `node-` prefix", () => {
    const name = generateRandomNodeName();
    expect(name.startsWith("node-")).toBe(true);
  });

  test("produces 6-hex suffix (11 chars total: 'node-' + 6 hex)", () => {
    const name = generateRandomNodeName();
    expect(name.length).toBe(11);
    expect(/^node-[0-9a-f]{6}$/.test(name)).toBe(true);
  });

  test("output passes RFC1123 validation", () => {
    const name = generateRandomNodeName();
    expect(isValidHostname(name)).toBe(true);
  });

  test("deterministic with injected RNG (testability check)", () => {
    const fixedRng = (_n: number): Uint8Array => new Uint8Array([0xa3, 0xf9, 0xc2]);
    const name = generateRandomNodeName(fixedRng);
    expect(name).toBe("node-a3f9c2");
  });

  test("different injected RNG inputs produce different names (deterministic; no flake risk)", () => {
    // Replaces the prior probabilistic "two calls with default RNG"
    // test (1-in-16M collision flake risk in CI). Asserts the SAME
    // property — RNG variance produces output variance — via
    // deterministic injected RNGs, so the test is reproducible.
    const a = generateRandomNodeName((_n) => new Uint8Array([0x00, 0x00, 0x00]));
    const b = generateRandomNodeName((_n) => new Uint8Array([0xff, 0xff, 0xff]));
    expect(a).toBe("node-000000");
    expect(b).toBe("node-ffffff");
    expect(a).not.toBe(b);
  });
});

describe("parseOutputFileMarker", () => {
  test("matches standard peer-call output-file marker", () => {
    const line = "OUTPUT-FILE: /tmp/peer-call-output/2026-05-26-grok-build-a3f9c2.md";
    expect(parseOutputFileMarker(line)).toBe(
      "/tmp/peer-call-output/2026-05-26-grok-build-a3f9c2.md",
    );
  });

  test("returns null for non-matching line", () => {
    expect(parseOutputFileMarker("some other line")).toBe(null);
    expect(parseOutputFileMarker("")).toBe(null);
    expect(parseOutputFileMarker("output-file: lowercase fails")).toBe(null);
  });

  test("trims trailing whitespace from path", () => {
    expect(parseOutputFileMarker("OUTPUT-FILE: /tmp/out.md   ")).toBe("/tmp/out.md");
  });
});
