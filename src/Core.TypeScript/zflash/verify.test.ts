// src/Core.TypeScript/zflash/verify.test.ts
//
// Falsifiers for the verify half of "verify, write, verify back".
//
// Every test here runs with NO hardware attached. The /dev/disk6 specimen test
// is a pinning test against a real device the maintainer has plugged in --
// the numbers below were read out of `diskutil info` read-only, never written.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkDeviceIdentity,
  checkIsoAgainstManifest,
  classifyDeviceState,
  DEFAULT_READBACK_CHUNK_BYTES,
  MIN_ISO_BYTES,
  openChunkReader,
  verifyReadBack,
  ZETA_INSTALL_VOLUME_LABEL,
  type ChunkReader,
  type DeviceIdentity,
  type DeviceStateEvidence,
  type ObservedPartition,
} from "./verify.ts";

const ISO = "zeta-installer-25.11-x86_64.iso";
const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);

function bufReader(bytes: Uint8Array): ChunkReader {
  return {
    read(offset: number, length: number): Uint8Array {
      return bytes.subarray(offset, offset + length);
    },
  };
}

describe("1. verify BEFORE write -- an unverified ISO is refused, not warned about", () => {
  test("no manifest at all -> REFUSAL (this is the shipped default today)", () => {
    const r = checkIsoAgainstManifest(null, ISO, DIGEST_A);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("manifest-missing");
    expect(r.error).toContain("refusing");
  });

  test("manifest present but unparseable -> REFUSAL, never a fallback to trust", () => {
    const r = checkIsoAgainstManifest("this is not a checksums file\n", ISO, DIGEST_A);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("manifest-unparseable");
  });

  test("manifest does not mention our ISO -> REFUSAL", () => {
    const manifest = DIGEST_B + "  some-other-image.iso\n";
    const r = checkIsoAgainstManifest(manifest, ISO, DIGEST_A);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("iso-not-in-manifest");
  });

  test("digest disagrees -> REFUSAL naming both digests", () => {
    const manifest = DIGEST_B + "  " + ISO + "\n";
    const r = checkIsoAgainstManifest(manifest, ISO, DIGEST_A);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("digest-mismatch");
    expect(r.error).toContain(DIGEST_B);
    expect(r.error).toContain(DIGEST_A);
  });

  test("digest agrees -> ok, and the attested filename comes back", () => {
    const manifest = DIGEST_A + "  " + ISO + "\n";
    const r = checkIsoAgainstManifest(manifest, ISO, DIGEST_A);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.filename).toBe(ISO);
    expect(r.sha256).toBe(DIGEST_A);
  });

  test("uppercase digest in the manifest still matches (case-folded compare)", () => {
    const manifest = DIGEST_A.toUpperCase() + " *" + ISO + "\n";
    const r = checkIsoAgainstManifest(manifest, ISO, DIGEST_A);
    expect(r.ok).toBe(true);
  });

  test(
    "REUSE BOUNDARY: exact-basename lookup, NOT resolveLatestFromSha256Sums. " +
      "A manifest listing a newer ISO must not launder an older file.",
    () => {
      const older = "zeta-installer-25.10-x86_64.iso";
      const newer = "zeta-installer-25.11-x86_64.iso";
      const manifest =
        DIGEST_A + "  " + older + "\n" + DIGEST_B + "  " + newer + "\n";

      // We hold the OLDER file with the OLDER digest. Verifying it must succeed
      // against its own entry -- a glob-and-pick-latest resolver would have
      // reached for the newer entry and reported a mismatch.
      const good = checkIsoAgainstManifest(manifest, older, DIGEST_A);
      expect(good.ok).toBe(true);

      // And the older file carrying the NEWER file's digest must still fail.
      const bad = checkIsoAgainstManifest(manifest, older, DIGEST_B);
      expect(bad.ok).toBe(false);
    },
  );
});

// ---------------------------------------------------------------------

const PNY: DeviceIdentity = {
  devicePath: "/dev/disk6",
  sizeBytes: 123979431936,
  mediaName: "USB 3.2.1 FD",
  busProtocol: "USB",
  removableMedia: true,
  internal: false,
};

describe("2. device identity is CHECKED against a caller expectation", () => {
  test("expectation matches observation -> ok", () => {
    const r = checkDeviceIdentity(PNY, { ...PNY });
    expect(r.ok).toBe(true);
  });

  test(
    "THE WHOLE POINT: a phone enumerating at the same /dev/diskN is REFUSED. " +
      "A tool that selects the external disk is one plugged-in phone away from " +
      "destroying it.",
    () => {
      const phone: DeviceIdentity = {
        devicePath: "/dev/disk6",
        sizeBytes: 512110190592,
        mediaName: "iPhone",
        busProtocol: "USB",
        removableMedia: false,
        internal: false,
      };
      const r = checkDeviceIdentity(PNY, phone);
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("unreachable");
      const fields = r.mismatches.map((m) => m.field);
      expect(fields).toContain("sizeBytes");
      expect(fields).toContain("mediaName");
      expect(fields).toContain("removableMedia");
      expect(r.error).toContain("refusing");
    },
  );

  test("each of the six fields independently refuses on mismatch", () => {
    const variants: readonly DeviceIdentity[] = [
      { ...PNY, devicePath: "/dev/disk7" },
      { ...PNY, sizeBytes: PNY.sizeBytes + 512 },
      { ...PNY, mediaName: "USB 3.2.1 FD " },
      { ...PNY, busProtocol: "USB-C" },
      { ...PNY, removableMedia: false },
      { ...PNY, internal: true },
    ];
    for (const v of variants) {
      const r = checkDeviceIdentity(PNY, v);
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("unreachable");
      expect(r.mismatches.length).toBe(1);
    }
    expect(variants.length).toBe(6);
  });

  test("media-name compare is ORDINAL -- case is not folded, so a lookalike refuses", () => {
    const lookalike = checkDeviceIdentity(PNY, { ...PNY, mediaName: "usb 3.2.1 fd" });
    expect(lookalike.ok).toBe(false);
    const spaced = checkDeviceIdentity(PNY, { ...PNY, mediaName: "USB 3.2.1 FD " });
    expect(spaced.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------

describe("3. device-state classifier", () => {
  test(
    "PINNING TEST -- the real /dev/disk6 specimen classifies half-provisioned. " +
      "PNY USB 3.2.1 FD, 124.0 GB, FDisk_partition_scheme, a lone 0xEF partition " +
      "at 3.1 MB, ~124 GB unallocated, no filesystem, nothing mounted. Numbers " +
      "read out of diskutil read-only on 2026-08-20.",
    () => {
      const specimen: DeviceStateEvidence = {
        partitionScheme: "FDisk_partition_scheme",
        totalSizeBytes: 123979431936,
        partitions: [
          {
            identifier: "disk6s2",
            content: "0xEF",
            sizeBytes: 3145728,
            volumeName: null,
            filesystem: null,
          },
        ],
      };
      const c = classifyDeviceState(specimen);
      expect(c.state).toBe("half-provisioned");
      expect(c.rule).toBe("R4");
      expect(c.allocatedBytes).toBe(3145728);
      // The signature in one sentence: something is allocated, but far less
      // than the smallest ISO we would ever write.
      expect(c.allocatedBytes).toBeGreaterThan(0);
      expect(c.allocatedBytes).toBeLessThan(MIN_ISO_BYTES);
    },
  );

  test("raw device, no scheme, no partitions -> blank (R3)", () => {
    const c = classifyDeviceState({
      partitionScheme: "",
      partitions: [],
      totalSizeBytes: 123979431936,
    });
    expect(c.state).toBe("blank");
    expect(c.rule).toBe("R3");
  });

  test("a partition carrying the ZETA_INSTALL label -> provisioned (R2)", () => {
    const parts: readonly ObservedPartition[] = [
      {
        identifier: "disk6s1",
        content: "0x00",
        sizeBytes: 1_825_361_920,
        volumeName: ZETA_INSTALL_VOLUME_LABEL,
        filesystem: "ISO9660",
      },
      { identifier: "disk6s2", content: "0xEF", sizeBytes: 3145728, volumeName: null, filesystem: null },
    ];
    const c = classifyDeviceState({
      partitionScheme: "FDisk_partition_scheme",
      partitions: parts,
      totalSizeBytes: 123979431936,
    });
    expect(c.state).toBe("provisioned");
    expect(c.rule).toBe("R2");
  });

  test("labelled BUT the head digest disagrees -> half-provisioned (R1), never provisioned", () => {
    const c = classifyDeviceState({
      partitionScheme: "FDisk_partition_scheme",
      totalSizeBytes: 123979431936,
      partitions: [
        {
          identifier: "disk6s1",
          content: "0x00",
          sizeBytes: 1_825_361_920,
          volumeName: ZETA_INSTALL_VOLUME_LABEL,
          filesystem: "ISO9660",
        },
      ],
      headDigestHex: DIGEST_A,
      expectedHeadDigestHex: DIGEST_B,
    });
    expect(c.state).toBe("half-provisioned");
    expect(c.rule).toBe("R1");
  });

  test(
    "SAFETY DEFAULT: somebody's photo drive -> unrecognized (R5), NEVER blank",
    () => {
      const c = classifyDeviceState({
        partitionScheme: "GUID_partition_scheme",
        totalSizeBytes: 2_000_398_934_016,
        partitions: [
          {
            identifier: "disk9s2",
            content: "Apple_HFS",
            sizeBytes: 1_999_000_000_000,
            volumeName: "Photos Backup",
            filesystem: "HFS+",
          },
        ],
      });
      expect(c.state).toBe("unrecognized");
      expect(c.rule).toBe("R5");
      expect(c.reason).toContain("somebody else");
    },
  );

  test("a scheme with no partitions is NOT blank -- unrecognized (R5)", () => {
    const c = classifyDeviceState({
      partitionScheme: "GUID_partition_scheme",
      partitions: [],
      totalSizeBytes: 123979431936,
    });
    expect(c.state).toBe("unrecognized");
  });

  test("the union is closed -- every verdict is one of exactly four states", () => {
    const seen = new Set<string>();
    const cases: readonly DeviceStateEvidence[] = [
      { partitionScheme: "", partitions: [], totalSizeBytes: 1 },
      {
        partitionScheme: "FDisk_partition_scheme",
        totalSizeBytes: 123979431936,
        partitions: [{ identifier: "d", content: "0xEF", sizeBytes: 3145728, volumeName: null, filesystem: null }],
      },
      {
        partitionScheme: "FDisk_partition_scheme",
        totalSizeBytes: 123979431936,
        partitions: [
          { identifier: "d", content: "0x00", sizeBytes: 9, volumeName: ZETA_INSTALL_VOLUME_LABEL, filesystem: "ISO9660" },
        ],
      },
      {
        partitionScheme: "GUID_partition_scheme",
        totalSizeBytes: 9,
        partitions: [{ identifier: "d", content: "Apple_HFS", sizeBytes: 9, volumeName: "X", filesystem: "HFS+" }],
      },
    ];
    for (const c of cases) seen.add(classifyDeviceState(c).state);
    expect([...seen].sort()).toEqual(["blank", "half-provisioned", "provisioned", "unrecognized"]);
  });
});

// ---------------------------------------------------------------------

describe("4. read-back verify on macOS/Linux (the Windows arm's guarantee, ported)", () => {
  const iso = new Uint8Array(10_000);
  for (let i = 0; i < iso.length; i++) iso[i] = (i * 7 + 3) % 251;

  test("device is byte-identical -> ok, and it says how much it compared", () => {
    const r = verifyReadBack(bufReader(iso), bufReader(iso.slice()), iso.length, 1024);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.bytesCompared).toBe(iso.length);
  });

  test(
    "corrupt write is caught by read-back verify -> ok=false (NO silent green). " +
      "One flipped byte deep in the image, mirroring flash-usb-windows.test.ts.",
    () => {
      const device = iso.slice();
      device[7_777] = (device[7_777] ?? 0) ^ 0xff;
      const r = verifyReadBack(bufReader(iso), bufReader(device), iso.length, 1024);
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("unreachable");
      expect(r.firstMismatchOffset).toBe(7_777);
      expect(r.error).toContain("DO NOT trust this USB");
    },
  );

  test("a truncated device is a FAILURE, not a pass on the bytes that were there", () => {
    const short = iso.slice(0, 5_000);
    const r = verifyReadBack(bufReader(iso), bufReader(short), iso.length, 1024);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.firstMismatchOffset).toBeNull();
    expect(r.error).toContain("smaller than the image");
  });

  test("a zero-byte comparison REFUSES rather than reporting a vacuous green", () => {
    const r = verifyReadBack(bufReader(iso), bufReader(iso), 0, 1024);
    expect(r.ok).toBe(false);
  });

  test("chunk size does not change the verdict (1, 3, default all agree)", () => {
    const device = iso.slice();
    device[9_999] = (device[9_999] ?? 0) ^ 0x01;
    for (const cs of [1, 3, 4096, DEFAULT_READBACK_CHUNK_BYTES]) {
      const r = verifyReadBack(bufReader(iso), bufReader(device), iso.length, cs);
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("unreachable");
      expect(r.firstMismatchOffset).toBe(9_999);
    }
  });

  test("a mismatch in the FIRST byte is caught (no off-by-one skip at offset 0)", () => {
    const device = iso.slice();
    device[0] = (device[0] ?? 0) ^ 0xff;
    const r = verifyReadBack(bufReader(iso), bufReader(device), iso.length, 1024);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.firstMismatchOffset).toBe(0);
  });
});

// ---------------------------------------------------------------------

describe("5. the adapter -- covered against a regular file, unrun against /dev/rdiskN", () => {
  test("openChunkReader round-trips a real file through the same code path", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-verify-"));
    try {
      const bytes = new Uint8Array(3_000);
      for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 13 + 5) % 253;
      const p = join(dir, "image.bin");
      writeFileSync(p, bytes);

      const a = openChunkReader(p);
      const b = openChunkReader(p);
      try {
        const r = verifyReadBack(a, b, bytes.length, 512);
        expect(r.ok).toBe(true);
        if (!r.ok) throw new Error(r.error);
        expect(r.bytesCompared).toBe(bytes.length);
      } finally {
        a.close();
        b.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("openChunkReader reports EOF as a SHORT read, which verifyReadBack fails on", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-verify-"));
    try {
      const p = join(dir, "short.bin");
      writeFileSync(p, new Uint8Array(100));
      const r = openChunkReader(p);
      try {
        expect(r.read(0, 100).length).toBe(100);
        expect(r.read(50, 100).length).toBe(50);
        expect(r.read(100, 10).length).toBe(0);
      } finally {
        r.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
