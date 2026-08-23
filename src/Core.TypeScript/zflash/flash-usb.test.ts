// src/Core.TypeScript/zflash/flash-usb.test.ts -- the macOS arm's safety rails,
// asserted for the first time.
//
// WHAT THIS FILE IS FOR, stated plainly because the gap it closes was invisible:
//
// zflash has three host arms. flash-usb-linux.ts and flash-usb-windows.ts each
// export their decision logic and each has a test file (565 and 554 lines).
// flash-usb.ts -- the macOS arm, the one the maintainer's own laptop runs --
// exported NOTHING and had NO test file. MEASURED before this change: it did not
// appear in `bun test --coverage src/Core.TypeScript/zflash/` at all, because no
// test ever imported it, so it was never even loaded. Zero percent, reported as
// absence rather than as a low number.
//
// It could not have had one either. The module called `main()` at file scope with
// no `import.meta.main` guard, so importing it enumerated disks and ran the
// flasher. That is fixed in the same change, and the first test below is the
// falsifier for the fix.
//
// SCOPE -- what is asserted here and what is NOT:
//   HERE (no hardware needed): flag parsing and its refusals, the plist parse,
//   the USB bus filter, zero/one/many target selection, the ISO gate, the size
//   bound, the boot-disk parse and comparison, device-path shapes, and the
//   consent-challenge construction and comparison.
//
//   NOT HERE (needs a real stick in a real port): that diskutil enumerates the
//   device at all, that `sudo dd` writes it, that the read-back verify passes on
//   written media, that Touch ID fires at the sudo gate, that eject succeeds.
//   Those are enumerated by name in usb-hardware-manual-lane.ts and written up
//   as a runnable procedure in docs/security/USB-HARDWARE-SETUP-TEST-PROCEDURE.md.
//   They are NOT silently absent: usb-hardware-manual-lane.test.ts prints every
//   one of them, by id, on every run of this suite.

import { describe, expect, test } from "bun:test";
import {
  acceptanceMatches,
  ALLOWED_FLAGS,
  buildChallenge,
  buildLongChallenge,
  buildShortChallenge,
  HALF_PROVISIONED_ACK,
  human,
  isSafeDevicePath,
  isSafeRawDevicePath,
  isUsbCandidate,
  makeNonce,
  parseBootDiskIdentifier,
  parseExternalDevices,
  parseFlags,
  rawDevicePathFor,
  selectUsbTarget,
  targetIsBootDisk,
  validateIso,
  validateUsbSize,
  VALUE_FLAGS,
} from "./flash-usb.ts";
import {
  MAX_ISO_BYTES,
  MAX_USB_BYTES,
  MIN_ISO_BYTES,
  MIN_USB_BYTES,
} from "./size-bounds.ts";

const GiB = 1024 * 1024 * 1024;
const MiB = 1024 * 1024;

// ============================================================================
// 0. THE ENTRY GUARD -- the fix that made every test below possible
// ============================================================================

describe("module import is inert", () => {
  test("FU-0: importing this module does not run the flasher", () => {
    // If the `import.meta.main` guard regresses, this file never reaches its
    // first assertion: the import at the top runs main(), which either prints
    // usage and calls process.exit(2) (no argv under `bun test`) or blocks on a
    // prompt. The proof that this test discriminates is that it cannot report a
    // failure -- it reports the ABSENCE of the whole suite. That is why the
    // fix is also asserted textually below.
    expect(HALF_PROVISIONED_ACK).toBe("ack half-provisioned");
  });

  test("FU-0b: the guard is present in the source, not merely working today", () => {
    // The behavioural check above cannot distinguish "guard present" from
    // "guard absent but main() happened to exit 0". Read the source.
    const src = Bun.file(new URL("./flash-usb.ts", import.meta.url)).text();
    return src.then((text: string) => {
      expect(text).toContain("if (import.meta.main) {");
      // And that no UNGUARDED call survives at file scope.
      expect(text).not.toMatch(/^main\(\)\.catch/mu);
    });
  });
});

// ============================================================================
// 1. FLAG PARSING -- the allowlist is a safety rail, not ergonomics
// ============================================================================

describe("parseFlags", () => {
  test("FU-1: a bare ISO path parses with every flag off", () => {
    const r = parseFlags(["/srv/images/zeta-installer-x86.iso"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.flags.positional).toEqual(["/srv/images/zeta-installer-x86.iso"]);
    expect(r.flags.short).toBe(false);
    expect(r.flags.noEject).toBe(false);
    expect(r.flags.acceptUnrecognized).toBe(false);
    expect(r.flags.acceptHalfProvisioned).toBe(false);
    expect(r.flags.help).toBe(false);
    expect(r.flags.expectDevice).toBeNull();
    expect(r.flags.expectModel).toBeNull();
    expect(r.flags.expectSize).toBeNull();
  });

  test("FU-2: every allowlisted flag is accepted and sets its own field", () => {
    const r = parseFlags([
      "--short",
      "--no-eject",
      "--accept-unrecognized",
      "--accept-half-provisioned",
      "a.iso",
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.flags.short).toBe(true);
    expect(r.flags.noEject).toBe(true);
    expect(r.flags.acceptUnrecognized).toBe(true);
    expect(r.flags.acceptHalfProvisioned).toBe(true);
  });

  // --- THE REFUSALS. These are the falsifiers; the accepts above are not. ---

  test("FU-3: REFUSES an unknown flag rather than ignoring it", () => {
    // The exact scenario the allowlist exists for: an operator asks for a
    // rehearsal, the flag does not exist, and without this rail the tool
    // proceeds to `sudo dd` having silently dropped the request.
    const r = parseFlags(["--dry-run", "a.iso"]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe(2);
    expect(r.message).toContain("unknown flag(s): --dry-run");
    expect(r.message).toContain("Refusing to proceed");
  });

  test("FU-4: REFUSES a MISSPELLED known flag -- the near-miss, not just the absent", () => {
    // `--shrot` is more dangerous than `--dry-run`: the operator believes they
    // selected the short challenge and would accept a `yes <4hex>` prompt that
    // never appears. Refusing near-misses is the point of an allowlist over a
    // prefix match.
    for (const typo of ["--shrot", "--sho", "--shortt", "--Short", "-short"]) {
      const r = parseFlags([typo, "a.iso"]);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.message).toContain(typo);
    }
  });

  test("FU-5: REFUSES a value flag given with no value", () => {
    // Silently returning null here would hand back the UNPINNED path to an
    // operator who was trying to pin the target. Strictly worse than refusing.
    for (const f of ["--expect-device", "--expect-size", "--expect-model"]) {
      const r = parseFlags([f, "a.iso"]);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.message).toContain(`flag ${f} needs a value`);
    }
    const empty = parseFlags(["--expect-device=", "a.iso"]);
    expect(empty.ok).toBe(false);
  });

  test("FU-6: REFUSES a non-integer --expect-size", () => {
    for (const bad of ["16GB", "1e999", "abc", "1.5", "-0.5"]) {
      const r = parseFlags([`--expect-size=${bad}`, "a.iso"]);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.message).toContain("--expect-size must be a whole number of bytes");
    }
  });

  test("FU-7: accepts a well-formed target pin", () => {
    const r = parseFlags([
      "--expect-device=/dev/disk4",
      "--expect-size=16008609792",
      "--expect-model=SanDisk Ultra",
      "a.iso",
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.flags.expectDevice).toBe("/dev/disk4");
    expect(r.flags.expectSize).toBe(16008609792);
    expect(r.flags.expectModel).toBe("SanDisk Ultra");
  });

  test("FU-8: the allowlist and the value-flag list do not overlap", () => {
    // An overlap would make flagName() ambiguous and could let `--short=x`
    // through on the strength of the wrong list.
    for (const v of VALUE_FLAGS) expect(ALLOWED_FLAGS).not.toContain(v);
  });
});

// ============================================================================
// 2. ENUMERATION AND TARGET SELECTION
// ============================================================================

describe("parseExternalDevices", () => {
  // Shape taken from `diskutil list -plist external physical` after plutil
  // conversion, which is what the tool actually feeds this function.
  const PLIST_JSON = {
    AllDisksAndPartitions: [
      { DeviceIdentifier: "disk4", Content: "FDisk_partition_scheme" },
      { DeviceIdentifier: "disk6", Content: "GUID_partition_scheme" },
    ],
  };

  test("FU-9: extracts whole-disk paths", () => {
    expect(parseExternalDevices(PLIST_JSON)).toEqual(["/dev/disk4", "/dev/disk6"]);
  });

  test("FU-10: a malformed or empty plist yields NO devices, never a crash", () => {
    // A throw here would be reported as a tool bug; returning [] routes into
    // the "no USB devices found" refusal, which is the correct outcome.
    expect(parseExternalDevices({})).toEqual([]);
    expect(parseExternalDevices(null)).toEqual([]);
    expect(parseExternalDevices({ AllDisksAndPartitions: "not-an-array" })).toEqual([]);
    expect(parseExternalDevices({ AllDisksAndPartitions: [{}, { DeviceIdentifier: 7 }] })).toEqual([]);
  });
});

describe("isUsbCandidate", () => {
  test("FU-11: USB and USB-C both count", () => {
    expect(isUsbCandidate("USB", false)).toBe(true);
    expect(isUsbCandidate("USB-C", false)).toBe(true);
  });

  test("FU-12: REFUSES an internal device even when the bus says USB", () => {
    // The load-bearing conjunction. An internal drive on an internal USB bus is
    // exactly the case where a bus-only check destroys the machine.
    expect(isUsbCandidate("USB", true)).toBe(false);
    expect(isUsbCandidate("USB-C", true)).toBe(false);
  });

  test("FU-13: REFUSES every non-USB bus", () => {
    // Thunderbolt in particular: an external SSD on Thunderbolt looks
    // removable and is not a flash stick.
    for (const bus of ["Thunderbolt", "PCI-Express", "SATA", "Apple Fabric", "", "usb", "Usb"]) {
      expect(isUsbCandidate(bus, false)).toBe(false);
    }
  });
});

describe("selectUsbTarget", () => {
  const stick = (device: string): { device: string; sizeBytes: number; model: string } => ({
    device,
    sizeBytes: 16 * GiB,
    model: "SanDisk Ultra",
  });

  test("FU-14: exactly one candidate is selected", () => {
    const s = selectUsbTarget([stick("/dev/disk4")]);
    expect(s.kind).toBe("selected");
    if (s.kind !== "selected") return;
    expect(s.device).toBe("/dev/disk4");
  });

  test("FU-15: REFUSES zero candidates", () => {
    const s = selectUsbTarget([]);
    expect(s.kind).toBe("none");
    if (s.kind === "selected") return;
    expect(s.message).toContain("no USB devices found");
  });

  test("FU-16: REFUSES two candidates -- it does not pick one", () => {
    // The rail Aaron's own runbook leans on. A picker here is one plugged-in
    // phone away from destroying it, and the process cannot know which stick
    // the operator meant.
    const s = selectUsbTarget([stick("/dev/disk4"), stick("/dev/disk6")]);
    expect(s.kind).toBe("ambiguous");
    if (s.kind === "selected") return;
    expect(s.message).toContain("refusing to pick one");
    // Both devices are named, so the operator knows what to unplug.
    expect(s.message).toContain("/dev/disk4");
    expect(s.message).toContain("/dev/disk6");
  });

  test("FU-17: three or more is still a refusal, not a fallback to the first", () => {
    const s = selectUsbTarget([stick("/dev/disk4"), stick("/dev/disk5"), stick("/dev/disk6")]);
    expect(s.kind).toBe("ambiguous");
  });
});

// ============================================================================
// 3. THE ISO GATE AND THE SIZE BOUND
// ============================================================================

describe("validateIso", () => {
  const OK_SIZE = 2 * GiB;

  test("FU-18: a well-formed ISO in range passes", () => {
    expect(validateIso("/srv/images/zeta-installer.iso", OK_SIZE, true, true).ok).toBe(true);
  });

  test("FU-19: REFUSES a missing file", () => {
    const r = validateIso("/srv/images/nope.iso", 0, false, false);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("does not exist");
  });

  test("FU-20: REFUSES a non-.iso name", () => {
    const r = validateIso("/srv/images/installer.img", OK_SIZE, true, true);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("expected *.iso");
  });

  test("FU-21: REFUSES a directory that ends in .iso", () => {
    const r = validateIso("/srv/images/build.iso", OK_SIZE, true, false);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("not a file");
  });

  test("FU-22: REFUSES both ends of the size range, at the exact boundary", () => {
    // Off-by-one on a bound is how a rail silently widens. Check the boundary,
    // not a comfortable value either side of it.
    expect(validateIso("a.iso", MIN_ISO_BYTES - 1, true, true).ok).toBe(false);
    expect(validateIso("a.iso", MIN_ISO_BYTES, true, true).ok).toBe(true);
    expect(validateIso("a.iso", MAX_ISO_BYTES, true, true).ok).toBe(true);
    expect(validateIso("a.iso", MAX_ISO_BYTES + 1, true, true).ok).toBe(false);
    expect(validateIso("a.iso", 0, true, true).ok).toBe(false);
  });

  test("FU-23: the refusal names both bounds so the operator can act", () => {
    const r = validateIso("a.iso", 10 * MiB, true, true);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("200.00 MiB");
    expect(r.message).toContain("8.00 GiB");
  });
});

describe("validateUsbSize", () => {
  test("FU-24: a 16 GiB stick passes", () => {
    expect(validateUsbSize("/dev/disk4", 16 * GiB).ok).toBe(true);
  });

  test("FU-25: REFUSES both ends at the exact boundary", () => {
    expect(validateUsbSize("/dev/disk4", MIN_USB_BYTES - 1).ok).toBe(false);
    expect(validateUsbSize("/dev/disk4", MIN_USB_BYTES).ok).toBe(true);
    expect(validateUsbSize("/dev/disk4", MAX_USB_BYTES).ok).toBe(true);
    expect(validateUsbSize("/dev/disk4", MAX_USB_BYTES + 1).ok).toBe(false);
  });

  test("FU-26: REFUSES a 2 TB external SSD -- the case the bound exists for", () => {
    const r = validateUsbSize("/dev/disk4", 2000 * GiB);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("external SSD");
  });
});

// ============================================================================
// 4. THE BOOT-DISK RAIL
// ============================================================================

describe("parseBootDiskIdentifier", () => {
  // Real `mount` output shape from macOS 14/15 (APFS).
  const REAL_MOUNT = [
    "/dev/disk3s1s1 on / (apfs, sealed, local, read-only, journaled)",
    "devfs on /dev (devfs, local, nobrowse)",
    "/dev/disk3s6 on /System/Volumes/VM (apfs, local, noexec, journaled, noatime, nobrowse)",
    "/dev/disk3s2 on /System/Volumes/Data (apfs, local, journaled, nobrowse)",
    "map auto_home on /System/Volumes/Data/home (autofs, automounted, nobrowse)",
  ].join("\n");

  test("FU-27: finds the disk backing / in real mount output", () => {
    expect(parseBootDiskIdentifier(REAL_MOUNT)).toBe("disk3");
  });

  test("FU-28: is not fooled by a path that merely CONTAINS a slash", () => {
    // "/System/Volumes/Data" must not read as "/". The ` on / (` shape is what
    // discriminates, and this is the test that keeps it that way.
    const noRoot = [
      "/dev/disk3s2 on /System/Volumes/Data (apfs, local, journaled)",
      "map auto_home on /System/Volumes/Data/home (autofs)",
    ].join("\n");
    expect(parseBootDiskIdentifier(noRoot)).toBe("");
  });

  test("FU-29: unparseable output yields the empty identifier, never a guess", () => {
    expect(parseBootDiskIdentifier("")).toBe("");
    expect(parseBootDiskIdentifier("garbage")).toBe("");
    // A root row on a non-/dev source (a VM overlay) must not yield a disk.
    expect(parseBootDiskIdentifier("overlay on / (overlay)")).toBe("");
  });
});

describe("targetIsBootDisk", () => {
  test("FU-30: REFUSES the boot disk itself", () => {
    expect(targetIsBootDisk("/dev/disk3", "disk3")).toBe(true);
  });

  test("FU-31: a different disk is allowed", () => {
    expect(targetIsBootDisk("/dev/disk4", "disk3")).toBe(false);
  });

  test("FU-32: disk3 and disk30 are DIFFERENT disks", () => {
    // Substring matching here would refuse a legitimate target, and the mirror
    // of that bug (matching disk3 against boot disk disk30) would permit
    // overwriting the boot disk. Exact comparison, checked both ways.
    expect(targetIsBootDisk("/dev/disk30", "disk3")).toBe(false);
    expect(targetIsBootDisk("/dev/disk3", "disk30")).toBe(false);
  });

  test("FU-33: an unknown boot disk does not by itself refuse", () => {
    // HONEST LIMIT, stated rather than hidden: when `mount` could not be
    // parsed, this rail abstains. It is the bus + internal + size rails that
    // carry the refusal in that case, not this one. Pinned so that a future
    // reader sees the abstention is deliberate.
    expect(targetIsBootDisk("/dev/disk4", "")).toBe(false);
  });
});

// ============================================================================
// 5. DEVICE-PATH SHAPES
// ============================================================================

describe("device path predicates", () => {
  test("FU-34: accepts whole-disk paths only", () => {
    expect(isSafeDevicePath("/dev/disk4")).toBe(true);
    expect(isSafeDevicePath("/dev/disk40")).toBe(true);
  });

  test("FU-35: REFUSES a partition path, a raw path, and anything crafted", () => {
    // A partition path reaching the dd argv would write an image into a slice.
    for (const bad of [
      "/dev/disk4s1",
      "/dev/rdisk4",
      "/dev/disk",
      "/dev/disk4 ",
      " /dev/disk4",
      "/dev/../dev/disk4",
      "/dev/disk4;rm -rf /",
      "/dev/disk4\n/dev/disk3",
      "",
    ]) {
      expect(isSafeDevicePath(bad)).toBe(false);
    }
  });

  test("FU-36: the raw predicate is the mirror image, not the same predicate", () => {
    expect(isSafeRawDevicePath("/dev/rdisk4")).toBe(true);
    expect(isSafeRawDevicePath("/dev/disk4")).toBe(false);
    expect(isSafeRawDevicePath("/dev/rdisk4s1")).toBe(false);
    expect(isSafeRawDevicePath("/dev/rdisk4\n/dev/rdisk3")).toBe(false);
  });

  test("FU-37: rawDevicePathFor produces a path the raw predicate accepts", () => {
    // The round-trip that keeps the privileged reader reachable: if this ever
    // produced a shape isSafeRawDevicePath rejects, every read-back verify
    // would bail at step 7, AFTER a successful dd.
    for (const d of ["/dev/disk4", "/dev/disk6", "/dev/disk40"]) {
      const raw = rawDevicePathFor(d);
      expect(isSafeRawDevicePath(raw)).toBe(true);
      expect(raw).toBe(`/dev/r${d.slice("/dev/".length)}`);
    }
  });
});

// ============================================================================
// 6. THE CONSENT CHALLENGE
// ============================================================================

describe("consent challenge", () => {
  test("FU-38: long form names the device and carries an 8-hex nonce", () => {
    expect(buildLongChallenge("/dev/disk4", "a3f9c1d2")).toBe(
      "accept-destroy /dev/disk4 a3f9c1d2",
    );
  });

  test("FU-39: short form is 'yes <nonce>' and does NOT name the device", () => {
    // Deliberate: the single-USB rail above already fixed the target, so the
    // short form trades device-naming for keystrokes. Pinned so nobody
    // "improves" it into a bare `yes` -- the nonce is the whole gate.
    expect(buildShortChallenge("a3f9")).toBe("yes a3f9");
    expect(buildShortChallenge("a3f9")).not.toContain("/dev/");
  });

  test("FU-40: nonce width is 8 hex long-form and 4 hex short-form", () => {
    const long = makeNonce(false);
    const short = makeNonce(true);
    expect(long).toMatch(/^[0-9a-f]{8}$/u);
    expect(short).toMatch(/^[0-9a-f]{4}$/u);
  });

  test("FU-41: the nonce is FRESH per run -- it cannot be pre-baked", () => {
    // The entire security argument for the gate is that an agent cannot know
    // the answer before the run prints it. A constant nonce would make the
    // prompt theatre, and would pass every other test in this file.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(makeNonce(false));
    expect(seen.size).toBeGreaterThan(190);
  });

  test("FU-42: makeNonce draws from the injected randomness source, not a counter", () => {
    const calls: number[] = [];
    const fixed = makeNonce(false, (n: number) => {
      calls.push(n);
      return Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    });
    expect(fixed).toBe("deadbeef");
    expect(calls).toEqual([4]);
    expect(makeNonce(true, () => Buffer.from([0x01, 0x02]))).toBe("0102");
  });

  test("FU-43: buildChallenge dispatches on the short flag", () => {
    expect(buildChallenge(false, "/dev/disk4", "aabbccdd")).toBe(
      "accept-destroy /dev/disk4 aabbccdd",
    );
    expect(buildChallenge(true, "/dev/disk4", "aabb")).toBe("yes aabb");
  });

  test("FU-44: acceptance is EXACT -- no trim, no case folding, no prefix", () => {
    // Whitespace tolerance is how a piped answer satisfies a gate that exists
    // to prove a human read this run's nonce. Every near-miss below must fail.
    const phrase = "accept-destroy /dev/disk4 a3f9c1d2";
    expect(acceptanceMatches(phrase, phrase)).toBe(true);
    for (const near of [
      `${phrase} `,
      ` ${phrase}`,
      `${phrase}\n`,
      `${phrase}\t`,
      phrase.toUpperCase(),
      "accept-destroy /dev/disk4 a3f9c1d3",
      "accept-destroy /dev/disk5 a3f9c1d2",
      "accept-destroy  /dev/disk4 a3f9c1d2",
      "accept-destroy",
      "yes",
      "y",
      "",
    ]) {
      expect(acceptanceMatches(near, phrase)).toBe(false);
    }
  });

  test("FU-45: the half-provisioned acknowledgement is fixed text with no nonce", () => {
    // Different job from the destroy challenge: it proves the runner read the
    // VERDICT, not that they observed this run. cli.ts matches this exact line
    // in --agent mode, so the text is a contract.
    expect(HALF_PROVISIONED_ACK).toBe("ack half-provisioned");
    expect(HALF_PROVISIONED_ACK).not.toMatch(/[0-9a-f]{4}/u);
  });
});

// ============================================================================
// 7. human() -- it appears inside refusal messages, so it is load-bearing
// ============================================================================

describe("human", () => {
  test("FU-46: formats the sizes that appear in the rails' refusal texts", () => {
    expect(human(0)).toBe("0.00 B");
    expect(human(MIN_ISO_BYTES)).toBe("200.00 MiB");
    expect(human(MAX_ISO_BYTES)).toBe("8.00 GiB");
    expect(human(MIN_USB_BYTES)).toBe("4.00 GiB");
    expect(human(MAX_USB_BYTES)).toBe("256.00 GiB");
  });

  test("FU-47: does not run off the end of the unit table", () => {
    expect(human(1024 ** 5 * 4)).toContain("TiB");
  });
});
