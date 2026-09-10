// ovmf-firmware.test.ts -- falsifiers for the one firmware resolver.
//
// The defect these guard (081M24BB3TD087G0R001PJTW9A) was a MISSING arg, not a wrong one:
// buildQemuSystemBootArgs emitted no pflash pair, QEMU fell back to SeaBIOS, and the
// installer refused after a 30-minute wait. A missing arg is invisible to any assertion
// about the args that ARE present, so these tests assert PRESENCE and ORDER, and each red
// case is paired with a control that must stay green.

import { describe, expect, test } from "bun:test";
import { OVMF_FIRMWARE_CANDIDATES, buildOvmfPflashArgs, type QemuUefiFirmware } from "./ovmf-firmware.ts";
import { buildQemuSystemBootArgs } from "../zflash/test-harness/qemu-state.ts";
import {
  RETENTION_ABSENT_TERMINAL_MARKERS,
  UEFI_REQUIRED_TERMINAL_MARKER,
} from "../zflash/test-harness/serial-markers.ts";

const OVMF: QemuUefiFirmware = {
  kind: "ovmf",
  codePath: "/usr/share/OVMF/OVMF_CODE_4M.fd",
  varsPath: "/run/vm1/OVMF_VARS.fd",
};

const LEGACY: QemuUefiFirmware = {
  kind: "legacy-bios-no-uefi",
  reason: "synthetic marker image; never reaches a bootloader",
};

describe("the candidate roster", () => {
  test("is non-empty and every entry names BOTH halves", () => {
    expect(OVMF_FIRMWARE_CANDIDATES.length).toBeGreaterThan(0);
    for (const c of OVMF_FIRMWARE_CANDIDATES) {
      expect(c.code.length).toBeGreaterThan(0);
      expect(c.vars.length).toBeGreaterThan(0);
      // A candidate whose code image is also its vars template would resolve and then
      // hand QEMU a read-only NVRAM.
      expect(c.code).not.toBe(c.vars);
    }
  });
});

describe("buildOvmfPflashArgs", () => {
  test("emits the unit-0 read-only CODE and unit-1 writable VARS pair", () => {
    const args = buildOvmfPflashArgs(OVMF);
    expect(args).toEqual([
      "-drive",
      "if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd",
      "-drive",
      "if=pflash,format=raw,unit=1,file=/run/vm1/OVMF_VARS.fd",
    ]);
  });

  test("unit-1 is NOT readonly -- OVMF must be able to write NVRAM", () => {
    const varsArg = buildOvmfPflashArgs(OVMF)[3] ?? "";
    expect(varsArg).toContain("unit=1");
    expect(varsArg).not.toContain("readonly");
  });

  test("legacy emits NOTHING, which is how SeaBIOS is reached", () => {
    expect(buildOvmfPflashArgs(LEGACY)).toEqual([]);
  });
});

// THE REGRESSION TEST THAT DID NOT EXIST. This is the assertion whose absence let
// scenarios 3 and 4 boot legacy for months.
describe("buildQemuSystemBootArgs carries the firmware", () => {
  const base = {
    diskPath: "/run/disk.qcow2",
    serialLogPath: "/run/serial.log",
    memoryMB: 4096,
    cpuCount: 2,
    kvmAvailable: false,
    bootMedia: { kind: "iso", path: "/run/zeta.iso" } as const,
  };

  test("RED-GUARD: a UEFI guest gets the pflash pair", () => {
    const args = buildQemuSystemBootArgs({ ...base, uefiFirmware: OVMF });
    expect(args).toContain("if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd");
    expect(args).toContain("if=pflash,format=raw,unit=1,file=/run/vm1/OVMF_VARS.fd");
  });

  test("the pflash pair sits with -machine, BEFORE the boot media", () => {
    const args = buildQemuSystemBootArgs({ ...base, uefiFirmware: OVMF });
    const machineIdx = args.indexOf("-machine");
    const pflashIdx = args.findIndex((a) => a.startsWith("if=pflash"));
    const cdromIdx = args.indexOf("-cdrom");
    expect(machineIdx).toBeGreaterThanOrEqual(0);
    expect(pflashIdx).toBeGreaterThan(machineIdx);
    expect(cdromIdx).toBeGreaterThan(pflashIdx);
  });

  // MUTATION CONTROL. Same call, legacy firmware: no pflash. This is what the builder did
  // for EVERY caller before the fix, so it must remain reachable -- and reachable only by
  // asking for it in writing.
  test("GREEN (control): a legacy guest gets NO pflash at all", () => {
    const args = buildQemuSystemBootArgs({ ...base, uefiFirmware: LEGACY });
    expect(args.some((a) => a.startsWith("if=pflash"))).toBe(false);
    // Everything else is unchanged, so the control proves the pflash args are the ONLY
    // difference the firmware field makes.
    expect(args).toContain("-machine");
    expect(args).toContain("-cdrom");
  });

  test("the two firmwares differ ONLY by the pflash pair", () => {
    const uefi = buildQemuSystemBootArgs({ ...base, uefiFirmware: OVMF });
    const legacy = buildQemuSystemBootArgs({ ...base, uefiFirmware: LEGACY });
    expect(uefi.filter((a) => !a.startsWith("if=pflash") && a !== "-drive")).toEqual(
      legacy.filter((a) => !a.startsWith("if=pflash") && a !== "-drive"),
    );
  });

  test("a usb-image guest also gets the pflash pair", () => {
    const args = buildQemuSystemBootArgs({
      ...base,
      bootMedia: { kind: "usb-image", path: "/run/boot.img" },
      uefiFirmware: OVMF,
    });
    expect(args.some((a) => a.startsWith("if=pflash"))).toBe(true);
  });
});

// THE FAIL-FAST. The tail already named this line; the wait had no way to hear it.
describe("the UEFI refusal is a terminal marker", () => {
  test("the installer's own refusal string is in the terminal roster", () => {
    expect(RETENTION_ABSENT_TERMINAL_MARKERS).toContain(UEFI_REQUIRED_TERMINAL_MARKER);
  });

  test("it is a SUBSTRING of the line the guest actually printed", () => {
    // Verbatim from dispatch run 34410308790, scenario 3 serial tail.
    const observed =
      "ERROR: not booted in UEFI mode (/sys/firmware/efi absent). This ISO is hybrid, so it " +
      "will boot in legacy/CSM and then fail at bootloader install AFTER the disk has been " +
      "wiped. Reboot and choose the 'UEFI:' entry for this USB device.";
    expect(observed).toContain(UEFI_REQUIRED_TERMINAL_MARKER);
  });

  // MUTATION CONTROL: it must not match ordinary install chatter, or every run dies early.
  test("GREEN (control): it does not match healthy install output", () => {
    const healthy = "[zeta-first-boot] Still offline; proceeding to zeta-install.";
    expect(healthy).not.toContain(UEFI_REQUIRED_TERMINAL_MARKER);
  });

  test("the pre-existing terminal marker is still there", () => {
    expect(RETENTION_ABSENT_TERMINAL_MARKERS).toContain("nixos@zeta-installer:~");
  });
});
