// src/Core.TypeScript/zflash/verify.ts
//
// The verify half of "initial format" = VERIFY, WRITE, VERIFY BACK.
//
// zflash's existing safety rails are all about *which* device gets written and
// whether a human consented. Three things they never established:
//
//   1. Is the ISO the one we think it is?       -> checkIsoAgainstManifest
//   2. Is the device the one the caller NAMED?  -> checkDeviceIdentity
//   3. Did the bytes actually land?             -> verifyReadBack
//
// plus the fact the old code read and then threw away:
//
//   4. What state is the device in right now?   -> classifyDeviceState
//
// Everything here is PURE. Digests, plists and block reads are supplied by the
// caller through injected readers (the ports.ts / CommandRunner idiom already
// used elsewhere in this directory), so every branch below is testable with no
// hardware attached and the only unrun code is the syscall edge in the adapter.
//
// DUAL-USE NOTE (.claude/rules/dual-use-detection-is-neutral-oracle-decides.md):
// classifyDeviceState reports a FACT about the device -- "half-provisioned" --
// never a verdict such as "safe to overwrite". Whether a given state authorizes
// a write is caller policy, not a property of the classifier.

import { parseSha256Sums } from "../installer/multiboot/sha256sums.ts";

// -- Shared size floor -----------------------------------------------
//
// Re-exported from ./size-bounds.ts, which is the single definition. The
// classifier rule "less is allocated than the smallest ISO we would ever
// write" and flash-usb.ts's sanity gate therefore cannot drift apart --
// previously this comment claimed that while the Linux and Windows arms
// each defined their own copy.
import { MAX_ISO_BYTES, MIN_ISO_BYTES } from "./size-bounds.ts";
export { MAX_ISO_BYTES, MIN_ISO_BYTES };

/** Volume label stamped by the installer. See configuration.nix volumeID. */
export const ZETA_INSTALL_VOLUME_LABEL = "ZETA_INSTALL";

// =====================================================================
// 1. VERIFY BEFORE WRITE -- refuse an ISO whose integrity is unestablished
// =====================================================================

export type IsoRefusalReason =
  | "manifest-missing"
  | "manifest-unparseable"
  | "iso-not-in-manifest"
  | "digest-mismatch";

export type IsoIntegrityResult =
  | { readonly ok: true; readonly sha256: string; readonly filename: string }
  | { readonly ok: false; readonly reason: IsoRefusalReason; readonly error: string };

/**
 * Establish an ISO's integrity against a GNU-style SHA256SUMS manifest.
 *
 * REUSE DECISION. The manifest is parsed by parseSha256Sums from
 * installer/multiboot/sha256sums.ts rather than by a second parser written
 * here, and the digest is computed by sha256FileHex from
 * installer/multiboot/resolve-artifacts.ts -- the caller passes the hex in.
 *
 * What is deliberately NOT reused is that module's resolveLatestFromSha256Sums,
 * which picks the highest-VERSION entry matching a glob. That is the right
 * shape for "fetch me the newest upstream image" and the wrong shape here: it
 * would happily attest a DIFFERENT filename than the one about to be written.
 * This function looks the file up by exact basename.
 *
 * The default is REFUSAL. A missing manifest, an unparseable manifest, and a
 * file the manifest does not mention are all refusals, never warnings -- an
 * unverifiable ISO is precisely the case this gate exists for.
 */
export function checkIsoAgainstManifest(
  manifestText: string | null,
  isoBasename: string,
  actualDigestHex: string,
): IsoIntegrityResult {
  if (manifestText === null) {
    return {
      ok: false,
      reason: "manifest-missing",
      error:
        "no SHA256SUMS manifest beside " +
        isoBasename +
        " -- refusing to write an ISO whose integrity has not been established",
    };
  }
  const entries = parseSha256Sums(manifestText);
  if (entries.length === 0) {
    return {
      ok: false,
      reason: "manifest-unparseable",
      error: "SHA256SUMS beside " + isoBasename + " has no parseable entries -- refusing",
    };
  }
  const entry = entries.find((e) => e.filename === isoBasename);
  if (entry === undefined) {
    return {
      ok: false,
      reason: "iso-not-in-manifest",
      error:
        "SHA256SUMS does not mention " +
        isoBasename +
        " -- it lists: " +
        entries.map((e) => e.filename).join(", ") +
        " -- refusing",
    };
  }
  const actual = actualDigestHex.toLowerCase();
  if (actual !== entry.sha256) {
    return {
      ok: false,
      reason: "digest-mismatch",
      error:
        "sha256 mismatch for " +
        isoBasename +
        ": manifest says " +
        entry.sha256 +
        ", file is " +
        actual +
        " -- refusing",
    };
  }
  return { ok: true, sha256: entry.sha256, filename: entry.filename };
}

// =====================================================================
// 2. DEVICE IDENTITY -- checked against a caller expectation, not discovered
// =====================================================================

/**
 * The five identifying fields flash-usb.ts already reads from diskutil info
 * and, until now, only PRINTED.
 *
 * The principle this type exists to encode: a tool that selects "the external
 * disk" is one plugged-in phone away from destroying it. The target is stated
 * by the caller and CHECKED. It is never discovered dynamically.
 */
export interface DeviceIdentity {
  readonly devicePath: string;
  readonly sizeBytes: number;
  readonly mediaName: string;
  readonly busProtocol: string;
  readonly removableMedia: boolean;
  readonly internal: boolean;
}

export interface DeviceIdentityMismatch {
  readonly field: keyof DeviceIdentity;
  readonly expected: string;
  readonly observed: string;
}

export type DeviceIdentityResult =
  | { readonly ok: true; readonly identity: DeviceIdentity }
  | {
      readonly ok: false;
      readonly mismatches: readonly DeviceIdentityMismatch[];
      readonly error: string;
    };

/**
 * Compare an observed device against the caller's stated expectation.
 *
 * All five identifying fields must match, plus the device path itself. String
 * comparison is ordinal (===) per .claude/rules/culture-invariant-by-default.md
 * -- a locale-sensitive compare on a vendor string is a way for two different
 * sticks to look like one.
 *
 * Call this TWICE: once when showing the operator what will be destroyed, and
 * again immediately before the write. The second call is the one that matters,
 * because USB enumeration is not stable across a replug and /dev/diskN is
 * recycled.
 */
export function checkDeviceIdentity(
  expected: DeviceIdentity,
  observed: DeviceIdentity,
): DeviceIdentityResult {
  const mismatches: DeviceIdentityMismatch[] = [];
  const note = (field: keyof DeviceIdentity, e: unknown, o: unknown): void => {
    mismatches.push({ field, expected: String(e), observed: String(o) });
  };
  if (expected.devicePath !== observed.devicePath) {
    note("devicePath", expected.devicePath, observed.devicePath);
  }
  if (expected.sizeBytes !== observed.sizeBytes) {
    note("sizeBytes", expected.sizeBytes, observed.sizeBytes);
  }
  if (expected.mediaName !== observed.mediaName) {
    note("mediaName", expected.mediaName, observed.mediaName);
  }
  if (expected.busProtocol !== observed.busProtocol) {
    note("busProtocol", expected.busProtocol, observed.busProtocol);
  }
  if (expected.removableMedia !== observed.removableMedia) {
    note("removableMedia", expected.removableMedia, observed.removableMedia);
  }
  if (expected.internal !== observed.internal) {
    note("internal", expected.internal, observed.internal);
  }

  if (mismatches.length > 0) {
    return {
      ok: false,
      mismatches,
      error:
        "device identity does NOT match the expectation the caller stated -- refusing.\n" +
        mismatches
          .map((m) => "  " + m.field + ": expected " + m.expected + ", observed " + m.observed)
          .join("\n"),
    };
  }
  return { ok: true, identity: observed };
}

/**
 * The three fields an operator (or a wrapper) can STATE about a target before
 * anything is enumerated: which device, how big, what model.
 *
 * These are separated from DeviceIdentity on purpose. The other three fields
 * (busProtocol, removableMedia, internal) are RAILS -- the flasher already
 * refuses a non-USB or internal device outright -- so they are not something a
 * caller states, and folding them into the stated pin would have forced a
 * default, and a default here means comparing the observed value to itself.
 */
export interface StatedTargetPin {
  readonly devicePath: string;
  readonly sizeBytes: number;
  readonly mediaName: string;
}

/**
 * Compare the CALLER-STATED pin against what enumeration actually found.
 *
 * This is the check that must not have a fallback. checkDeviceIdentity below
 * compares two OBSERVATIONS taken at different times (the enumeration snapshot
 * versus a fresh read immediately before the write), which is meaningful; this
 * one compares a STATEMENT against an observation, which is the only form that
 * can catch "the tool picked a different disk than the one you meant".
 *
 * A missing field is not defaulted. There is no expectation to check when the
 * caller stated nothing, and calling that a pass is how a guard becomes
 * decorative.
 */
export function checkStatedPin(
  stated: StatedTargetPin,
  observed: DeviceIdentity,
): DeviceIdentityResult {
  const mismatches: DeviceIdentityMismatch[] = [];
  if (stated.devicePath !== observed.devicePath) {
    mismatches.push({
      field: "devicePath",
      expected: stated.devicePath,
      observed: observed.devicePath,
    });
  }
  if (stated.sizeBytes !== observed.sizeBytes) {
    mismatches.push({
      field: "sizeBytes",
      expected: String(stated.sizeBytes),
      observed: String(observed.sizeBytes),
    });
  }
  if (stated.mediaName !== observed.mediaName) {
    mismatches.push({
      field: "mediaName",
      expected: stated.mediaName,
      observed: observed.mediaName,
    });
  }
  if (mismatches.length > 0) {
    return {
      ok: false,
      mismatches,
      error:
        "the device found is NOT the device the caller pinned -- refusing.\n" +
        mismatches
          .map((m) => "  " + m.field + ": pinned " + m.expected + ", found " + m.observed)
          .join("\n"),
    };
  }
  return { ok: true, identity: observed };
}

// =====================================================================
// 3. DEVICE STATE -- the partition-table read that used to be only printed
// =====================================================================

/** Closed union. "unrecognized" is the default so a novel shape never reads as safe. */
export type DeviceState = "blank" | "half-provisioned" | "provisioned" | "unrecognized";

export interface ObservedPartition {
  readonly identifier: string;
  /** diskutil Content -- e.g. "0xEF", "Apple_HFS", "Windows_NTFS". */
  readonly content: string;
  readonly sizeBytes: number;
  /** diskutil VolumeName. null when there is no filesystem. */
  readonly volumeName: string | null;
  /** diskutil FilesystemName. null when unformatted. */
  readonly filesystem: string | null;
}

export interface DeviceStateEvidence {
  /** diskutil Content of the whole disk, e.g. "FDisk_partition_scheme". */
  readonly partitionScheme: string;
  readonly partitions: readonly ObservedPartition[];
  readonly totalSizeBytes: number;
  /** Digest of the head region read back off the device. null when not sampled. */
  readonly headDigestHex?: string | null;
  /** Digest of the same-length head region of the ISO we expect to be there. */
  readonly expectedHeadDigestHex?: string | null;
  /**
   * Why the head region could NOT be sampled, when it could not be.
   *
   * Absent digests are ambiguous on their own -- "the bytes match" and "nobody
   * looked" produce the same evidence object -- so the caller says which, and
   * the verdict below repeats it out loud rather than letting a label-only
   * pass read as a byte-checked one.
   */
  readonly headSampleError?: string | null;
}


export interface DeviceStateClassification {
  readonly state: DeviceState;
  /** Which rule fired -- makes the verdict auditable rather than a bare label. */
  readonly rule: string;
  readonly reason: string;
  readonly allocatedBytes: number;
  /**
   * True only when the device head was actually read and compared with the
   * ISO head. False means R1 never got the chance to fire -- either the device
   * carries no ZETA_INSTALL label (nothing to check) or the sample failed.
   * A "provisioned" verdict with this false is a LABEL-ONLY verdict.
   */
  readonly headDigestChecked: boolean;
}


function sumAllocated(partitions: readonly ObservedPartition[]): number {
  let total = 0;
  for (const p of partitions) total += p.sizeBytes;
  return total;
}

function hasNoPartitionScheme(scheme: string): boolean {
  const s = scheme.trim();
  return s === "" || s === "?" || s === "none";
}

/**
 * Classify a device's current state from evidence flash-usb.ts already reads.
 *
 * Rules, in order. First match wins.
 *
 *   R1  a partition labelled ZETA_INSTALL, and a head digest that DISAGREES
 *       with the ISO -> half-provisioned. The label landed, the bytes did not.
 *   R2  a partition labelled ZETA_INSTALL -> provisioned.
 *   R3  no partitions and no partition scheme -> blank.
 *   R4  a scheme and at least one partition, NO filesystem anywhere, and less
 *       allocated than MIN_ISO_BYTES -> half-provisioned. The separator is
 *       principled rather than tuned: a complete write allocates at least the
 *       smallest ISO we would ever write, so "something is allocated, but less
 *       than any ISO" is exactly the signature of a write that started and
 *       stopped.
 *   R5  anything else -> unrecognized.
 *
 * R5 as the default is the safety property. Somebody's phone, a photo backup,
 * an unfamiliar scheme -- all land in "unrecognized", never in "blank".
 *
 * R1 needs two inputs no caller supplied until 2026-08-21, which made it dead
 * code on the live path: a stick that was labelled and then written wrong
 * classified as "provisioned". The marker below is what
 * hygiene/lint-guards-are-reachable.ts reads, so that the day some refactor
 * drops the digests at the call site again, a check fails instead of a rule
 * silently going quiet.
 *
 * @guard-input classifyDeviceState requires headDigestHex, expectedHeadDigestHex -- rule R1, the labelled-but-wrong-bytes case
 */
export function classifyDeviceState(ev: DeviceStateEvidence): DeviceStateClassification {
  const allocated = sumAllocated(ev.partitions);
  const labelled = ev.partitions.some((p) => p.volumeName === ZETA_INSTALL_VOLUME_LABEL);

  if (labelled) {
    const head = ev.headDigestHex ?? null;
    const want = ev.expectedHeadDigestHex ?? null;
    if (head !== null && want !== null && head.toLowerCase() !== want.toLowerCase()) {
      return {
        state: "half-provisioned",
        rule: "R1",
        reason:
          ZETA_INSTALL_VOLUME_LABEL +
          " label present but the head digest disagrees with the ISO (device " +
          head +
          ", iso " +
          want +
          ") -- the write did not complete correctly",
        allocatedBytes: allocated,
        headDigestChecked: true,
      };
    }
    if (head !== null && want !== null) {
      return {
        state: "provisioned",
        rule: "R2",
        reason:
          "a partition carries the " +
          ZETA_INSTALL_VOLUME_LABEL +
          " volume label AND the head digest matches the ISO (" +
          head +
          ")",
        allocatedBytes: allocated,
        headDigestChecked: true,
      };
    }
    return {
      state: "provisioned",
      rule: "R2",
      reason:
        "a partition carries the " +
        ZETA_INSTALL_VOLUME_LABEL +
        " volume label, but the head region was NOT sampled (" +
        (ev.headSampleError ?? "no digests supplied by the caller") +
        ") -- this verdict is LABEL-ONLY and cannot distinguish correct bytes " +
        "from wrong ones",
      allocatedBytes: allocated,
      headDigestChecked: false,
    };
  }


  if (ev.partitions.length === 0 && hasNoPartitionScheme(ev.partitionScheme)) {
    return {
      state: "blank",
      rule: "R3",
      reason: "no partition scheme and no partitions -- raw or freshly-erased device",
      allocatedBytes: 0,
      headDigestChecked: false,
    };
  }

  const anyFilesystem = ev.partitions.some((p) => p.filesystem !== null && p.filesystem !== "");
  if (
    !hasNoPartitionScheme(ev.partitionScheme) &&
    ev.partitions.length > 0 &&
    !anyFilesystem &&
    allocated < MIN_ISO_BYTES
  ) {
    return {
      state: "half-provisioned",
      rule: "R4",
      reason:
        ev.partitionScheme +
        " with " +
        String(ev.partitions.length) +
        " partition(s) totalling " +
        String(allocated) +
        " bytes, no filesystem, and " +
        String(ev.totalSizeBytes - allocated) +
        " bytes unallocated -- less is allocated than the smallest ISO we would " +
        "write (" +
        String(MIN_ISO_BYTES) +
        "), so a write started and stopped",
      allocatedBytes: allocated,
      headDigestChecked: false,
    };
  }

  return {
    state: "unrecognized",
    rule: "R5",
    reason:
      (ev.partitionScheme || "(no scheme)") +
      " with " +
      String(ev.partitions.length) +
      " partition(s), " +
      String(allocated) +
      " bytes allocated" +
      (anyFilesystem ? ", carrying a filesystem" : "") +
      " -- this is not a shape zflash put here, treat it as somebody else's data",
    allocatedBytes: allocated,
    headDigestChecked: false,
  };
}

// =====================================================================
// 4. READ-BACK VERIFY -- the Windows arm's guarantee, ported to macOS/Linux
// =====================================================================

/**
 * A byte source. The ISO side is a file. The device side is /dev/rdiskN.
 *
 * The verify logic below is a PURE comparison over two of these, so it is
 * testable with in-memory buffers and the only unrun code in the whole path is
 * the adapter that turns openSync/readSync into this interface.
 */
export interface ChunkReader {
  /** Read up to length bytes at offset. Returning fewer means EOF. */
  read(offset: number, length: number): Uint8Array;
}

export const DEFAULT_READBACK_CHUNK_BYTES = 4 * 1024 * 1024;

export type ReadBackResult =
  | { readonly ok: true; readonly bytesCompared: number }
  | {
      readonly ok: false;
      readonly bytesCompared: number;
      readonly firstMismatchOffset: number | null;
      readonly error: string;
    };

/**
 * Compare totalBytes of the device against the ISO, chunk by chunk.
 *
 * Fail-loud by contract, exactly like the Windows arm. A short read, a
 * truncated device, or a single differing byte returns ok=false. There is no
 * skip path that can produce a green result -- "could not read it back" is a
 * FAILURE, not an exemption. That is the lesson the Windows test pins as
 * "corrupt write is caught by read-back verify -> ok=false (NO silent green)".
 */
export function verifyReadBack(
  isoReader: ChunkReader,
  deviceReader: ChunkReader,
  totalBytes: number,
  chunkBytes: number = DEFAULT_READBACK_CHUNK_BYTES,
): ReadBackResult {
  if (totalBytes <= 0) {
    return {
      ok: false,
      bytesCompared: 0,
      firstMismatchOffset: null,
      error: "refusing to call a " + String(totalBytes) + "-byte comparison a verification",
    };
  }
  if (chunkBytes <= 0) {
    return {
      ok: false,
      bytesCompared: 0,
      firstMismatchOffset: null,
      error: "invalid chunk size " + String(chunkBytes),
    };
  }
  let offset = 0;
  while (offset < totalBytes) {
    const want = Math.min(chunkBytes, totalBytes - offset);
    const isoChunk = isoReader.read(offset, want);
    const devChunk = deviceReader.read(offset, want);

    if (isoChunk.length !== want) {
      return {
        ok: false,
        bytesCompared: offset,
        firstMismatchOffset: null,
        error:
          "short read from ISO at offset " +
          String(offset) +
          ": wanted " +
          String(want) +
          ", got " +
          String(isoChunk.length) +
          ". Cannot verify, treating as FAILURE.",
      };
    }
    if (devChunk.length !== want) {
      return {
        ok: false,
        bytesCompared: offset,
        firstMismatchOffset: null,
        error:
          "short read from device at offset " +
          String(offset) +
          ": wanted " +
          String(want) +
          ", got " +
          String(devChunk.length) +
          ". The device is smaller than the image or the read failed, treating as FAILURE.",
      };
    }
    for (let i = 0; i < want; i++) {
      if (isoChunk[i] !== devChunk[i]) {
        const at = offset + i;
        return {
          ok: false,
          bytesCompared: at,
          firstMismatchOffset: at,
          error:
            "read-back MISMATCH at byte " +
            String(at) +
            ": iso=0x" +
            (isoChunk[i] ?? 0).toString(16) +
            " device=0x" +
            (devChunk[i] ?? 0).toString(16) +
            ". DO NOT trust this USB, re-flash.",
        };
      }
    }
    offset += want;
  }
  return { ok: true, bytesCompared: offset };
}

// =====================================================================
// 4b. HEAD DIGEST SAMPLE -- the input R1 needs, and never had
// =====================================================================
//
// R1 ("labelled ZETA_INSTALL but the head bytes disagree with the ISO") was
// dead code on the live path: its two digest fields were supplied only by the
// test file, so a stick that was labelled and then written wrong classified as
// "provisioned" -- the exact misread R1 exists to prevent.
//
// This is the missing supply. It is a PURE comparison over two injected
// ChunkReaders, deliberately the same shape verifyReadBack already uses, so
// every branch is exercised with in-memory buffers and the only unrun code is
// the adapter that turns a device into a reader.

import { createHash } from "node:crypto";

/**
 * How much of the head to sample.
 *
 * 1 MiB rather than a sector: an isohybrid image puts the MBR, the partition
 * table and the start of the bootloader in the first few hundred KiB, so a
 * 512-byte sample would agree between two DIFFERENT Zeta ISOs, and a check
 * that cannot tell two candidates apart is not a check. It is also small
 * enough to read in one go.
 */
export const DEFAULT_HEAD_SAMPLE_BYTES = 1024 * 1024;

/** sha256 of a byte range, hex, lowercase. Pure -- no I/O, no hardware. */
export function sha256HexOfBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export type HeadSampleFailure = "short-read-iso" | "short-read-device" | "bad-sample-size";

export type HeadSampleResult =
  | {
      readonly ok: true;
      readonly isoHeadDigestHex: string;
      readonly deviceHeadDigestHex: string;
      readonly bytesSampled: number;
    }
  | { readonly ok: false; readonly reason: HeadSampleFailure; readonly error: string };

/**
 * Digest the first sampleBytes of the ISO and of the device, so R1 has
 * something to compare.
 *
 * A short read is a FAILURE, never a shorter comparison. Digesting whatever
 * came back would let a truncated device produce a confident "the bytes
 * disagree" for the wrong reason, and a truncated ISO produce one for no
 * reason at all. The caller gets ok=false and passes the reason to the
 * classifier, which then says out loud that its verdict is label-only.
 */
export function sampleHeadDigests(
  isoReader: ChunkReader,
  deviceReader: ChunkReader,
  sampleBytes: number = DEFAULT_HEAD_SAMPLE_BYTES,
  digestOf: (bytes: Uint8Array) => string = sha256HexOfBytes,
): HeadSampleResult {
  if (!Number.isSafeInteger(sampleBytes) || sampleBytes <= 0) {
    return {
      ok: false,
      reason: "bad-sample-size",
      error: "refusing to call a " + String(sampleBytes) + "-byte sample a head digest",
    };
  }
  const isoHead = isoReader.read(0, sampleBytes);
  if (isoHead.length !== sampleBytes) {
    return {
      ok: false,
      reason: "short-read-iso",
      error:
        "short read from the ISO head: wanted " +
        String(sampleBytes) +
        ", got " +
        String(isoHead.length),
    };
  }
  const deviceHead = deviceReader.read(0, sampleBytes);
  if (deviceHead.length !== sampleBytes) {
    return {
      ok: false,
      reason: "short-read-device",
      error:
        "short read from the device head: wanted " +
        String(sampleBytes) +
        ", got " +
        String(deviceHead.length),
    };
  }
  return {
    ok: true,
    isoHeadDigestHex: digestOf(isoHead),
    deviceHeadDigestHex: digestOf(deviceHead),
    bytesSampled: sampleBytes,
  };
}

// =====================================================================
// 5. ADAPTERS -- the only unrun code in this file
// =====================================================================
//
// MEASURED vs DESIGNED-BUT-UNRUN, stated plainly so nobody has to guess:
//
//   MEASURED (verify.test.ts exercises every branch, no hardware):
//     checkIsoAgainstManifest, checkStatedPin, checkDeviceIdentity,
//     classifyDeviceState, sampleHeadDigests, sha256HexOfBytes,
//     verifyReadBack -- all of them, including every refusal path.
//
//   DESIGNED BUT UNRUN (needs a real device, cannot be exercised here):
//     openChunkReader below, when pointed at /dev/rdiskN. It is a thin
//     openSync/readSync shim deliberately kept free of logic so that the
//     untested surface is as small as a syscall wrapper can be. Pointed at a
//     regular file it IS covered by the round-trip test in verify.test.ts,
//     which is the closest reachable proxy.
//
//     MEASURED LIMIT, 2026-08-21: on macOS this shim CANNOT open /dev/rdiskN
//     as an unprivileged process. /dev/rdisk6 is crw-r----- root:operator and
//     the maintainer is not in the operator group, so openSync throws EACCES.
//     That is why the macOS arm reads devices through a privileged reader
//     (flash-usb.ts privilegedDeviceReader) rather than through this shim.
//     openChunkReader stays the ISO-side reader, where it works and is tested.


import { closeSync, openSync, readSync } from "node:fs";

export interface CloseableChunkReader extends ChunkReader {
  close(): void;
}

/**
 * Open a path (regular file OR raw block device) as a ChunkReader.
 *
 * Read-only by construction: the flag is "r". This function has no write path
 * and cannot acquire one without an edit that shows up in review.
 */
export function openChunkReader(path: string): CloseableChunkReader {
  const fd = openSync(path, "r");
  return {
    read(offset: number, length: number): Uint8Array {
      const buf = Buffer.alloc(length);
      const got = readSync(fd, buf, 0, length, offset);
      return buf.subarray(0, got);
    },
    close(): void {
      closeSync(fd);
    },
  };
}
