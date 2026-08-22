import { describe, expect, it } from "bun:test";
import {
  buildQemuArgsPure,
  classifyBoot,
  combineTranscripts,
  detectFailureMarker,
  furthestBootStage,
  outcomeExitCode,
  stageAtLeast,
  timeoutSecondsFor,
  X86_FIRMWARE_DEBUGCON_PORT,
  type BootStage,
} from "./qemu-boot-test.ts";
import { QEMU_USB_TEST_SERIAL } from "../installer/qemu-usb-storage.ts";

// ── Fixtures ────────────────────────────────────────────────────────
// Excerpts from THREE REAL serial logs captured 2026-08-16, not
// hand-invented strings. Text, never binary (no-binary-in-proof-lineage).
//
//  1. HEALTHY  — the CI aarch64 ISO artifact from run 31953781386,
//     booted locally under HVF on an M2 Ultra: login prompt at t=24s.
//  2. CI_TIMEOUT — the actual serial tail printed by the failing CI job
//     95181165646 (run 31953781386) after its 1800s budget expired.
//  3. NO_BOOT_MEDIA — QEMU booted with a 4MB /dev/urandom "ISO". This
//     is the important one: QEMU DOES NOT EXIT. EDK2 finds no boot
//     option and parks in the UEFI Shell indefinitely (still alive at
//     180s when the harness killed it).
//
// (1) and (2) are what the old code could not tell apart: both ran the
// clock out, both exited 1, both printed "Timeout (Ns) waiting for ...".

const HEALTHY_BOOT = [
  "UEFI firmware (version edk2-stable202408-prebuilt.qemu.org built at 16:28:50 on Sep 12 2024)",
  "BdsDxe: loading Boot0001 ...",
  "  Booting `NixOS 25.11.20260522.b77b3de Installer'",
  "EFI stub: Booting Linux Kernel...",
  "EFI stub: Exiting boot services...",
  "<<< Welcome to NixOS 25.11.20260522.b77b3de (aarch64) - ttyAMA0 >>>",
  "",
  "zeta-installer login: nixos (automatic login)",
  "[nixos@zeta-installer:~]$ ",
].join("\n");

// Verbatim shape of the failing CI run's serial tail: GRUB ran, the EFI
// stub handed off, and then the budget expired mid-kernel-handoff.
const CI_TIMEOUT = [
  "UEFI firmware (version edk2-stable202402 ...)",
  "   The highlighted entry will be executed automatically in 1s.                 ",
  "  Booting `NixOS 25.11.20260522.b77b3de Installer'",
  "",
  "EFI stub: Booting Linux Kernel...",
  "EFI stub: EFI_RNG_PROTOCOL unavailable",
  "EFI stub: Loaded initrd from LINUX_EFI_INITRD_MEDIA_GUID device path",
  "EFI stub: Generating empty DTB",
  "EFI stub: Exiting boot services...",
].join("\n");

const NO_BOOT_MEDIA = [
  "UEFI firmware (version edk2-stable202408-prebuilt.qemu.org built at 16:28:50 on Sep 12 2024)",
  "BdsDxe: No bootable option or device was found.",
  "Press ESC in 2 seconds to skip startup.nsh or any other key to continue.",
  "Shell> ",
].join("\n");

const timedOut = (serial: string) =>
  classifyBoot({
    serial,
    qemuExited: false,
    qemuExitCode: null,
    deadlineReached: true,
    timeoutSeconds: 1800,
  });

describe("furthestBootStage — the ladder that separates slow from broken", () => {
  it("reads `login` off a healthy boot", () => {
    expect(furthestBootStage(HEALTHY_BOOT)).toBe("login");
  });

  it("reads `kernel` off the real CI timeout tail", () => {
    expect(furthestBootStage(CI_TIMEOUT)).toBe("kernel");
  });

  it("reads `firmware` off a non-bootable image — the firmware never handed off", () => {
    expect(furthestBootStage(NO_BOOT_MEDIA)).toBe("firmware");
  });

  it("reads `none` off an empty serial log", () => {
    expect(furthestBootStage("")).toBe("none");
  });

  it("reports the HIGHEST rung reached, not the last marker written", () => {
    // Markers do not arrive in ladder order in a real log (systemd
    // re-prints, agetty redraws); the ladder must be a max, not a scan.
    const scrambled = ["zeta-installer login:", "UEFI firmware"].join("\n");
    expect(furthestBootStage(scrambled)).toBe("login");
  });
});

describe("stageAtLeast", () => {
  const cases: [BootStage, BootStage, boolean][] = [
    ["kernel", "bootloader", true],
    ["bootloader", "bootloader", true],
    ["firmware", "bootloader", false],
    ["none", "firmware", false],
    ["login", "userspace", true],
  ];
  for (const [stage, floor, expected] of cases) {
    it(`${stage} >= ${floor} is ${expected}`, () => {
      expect(stageAtLeast(stage, floor)).toBe(expected);
    });
  }
});

describe("classifyBoot — TIMEOUT and BOOT-FAILED are distinguishable", () => {
  // THE REGRESSION. Both of these exhaust the clock. Before 2026-08-16
  // they produced the same exit code and the same sentence, so a real
  // boot break read as "TCG was slow again". If this pair ever collapses
  // back to one outcome, this test fails.
  it("a slow-but-progressing boot is TIMEOUT, not a boot failure", () => {
    const c = timedOut(CI_TIMEOUT);
    expect(c.outcome).toBe("TIMEOUT");
    expect(c.stage).toBe("kernel");
    expect(outcomeExitCode(c.outcome)).toBe(3);
  });

  it("a non-bootable image is BOOT-FAILED even though QEMU never exited", () => {
    const c = timedOut(NO_BOOT_MEDIA);
    expect(c.outcome).toBe("BOOT-FAILED");
    expect(outcomeExitCode(c.outcome)).toBe(1);
  });

  it("the two never share an outcome or an exit code", () => {
    const slow = timedOut(CI_TIMEOUT);
    const broken = timedOut(NO_BOOT_MEDIA);
    expect(slow.outcome).not.toBe(broken.outcome);
    expect(outcomeExitCode(slow.outcome)).not.toBe(outcomeExitCode(broken.outcome));
  });

  it("a healthy boot is BOOTED with exit 0", () => {
    const c = timedOut(HEALTHY_BOOT);
    expect(c.outcome).toBe("BOOTED");
    expect(outcomeExitCode(c.outcome)).toBe(0);
  });

  // The other half of the old conflation: `abandoned` required a
  // NON-ZERO qemu exit code, so a guest that powered itself off cleanly
  // was waited out to the full budget and then called a timeout.
  it("a CLEAN qemu exit (code 0) before the prompt is BOOT-FAILED, not a timeout", () => {
    const c = classifyBoot({
      serial: "UEFI firmware (version ...)\n  Booting `NixOS Installer'\n",
      qemuExited: true,
      qemuExitCode: 0,
      deadlineReached: false,
      timeoutSeconds: 1800,
    });
    expect(c.outcome).toBe("BOOT-FAILED");
    expect(c.reason).toContain("code 0");
  });

  it("a crashing qemu exit before the prompt is BOOT-FAILED", () => {
    const c = classifyBoot({
      serial: "",
      qemuExited: true,
      qemuExitCode: 1,
      deadlineReached: false,
      timeoutSeconds: 1800,
    });
    expect(c.outcome).toBe("BOOT-FAILED");
    expect(c.stage).toBe("none");
  });

  it("a guest that exits AFTER printing the prompt still counts as BOOTED", () => {
    const c = classifyBoot({
      serial: HEALTHY_BOOT,
      qemuExited: true,
      qemuExitCode: 1,
      deadlineReached: true,
      timeoutSeconds: 1800,
    });
    expect(c.outcome).toBe("BOOTED");
  });

  it("timing out below the bootloader is BOOT-FAILED — waiting cannot help", () => {
    const c = timedOut("UEFI firmware (version ...)\n");
    expect(c.outcome).toBe("BOOT-FAILED");
    expect(c.reason).toContain("never reached the bootloader");
  });

  it("a kernel panic is BOOT-FAILED regardless of how far it got", () => {
    const c = timedOut(`${CI_TIMEOUT}\nKernel panic - not syncing: VFS: Unable to mount root fs\n`);
    expect(c.outcome).toBe("BOOT-FAILED");
    expect(c.reason).toContain("kernel panic");
  });

  it("is still unsettled while the guest is running and the clock has not expired", () => {
    const c = classifyBoot({
      serial: CI_TIMEOUT,
      qemuExited: false,
      qemuExitCode: null,
      deadlineReached: false,
      timeoutSeconds: 1800,
    });
    expect(c.reason).toBe("still running");
  });
});

describe("STALLED — a cost bound on an intermittent lane, not a diagnosis", () => {
  // TWO instrumented CI runs disagree, and that disagreement IS the
  // finding:
  //   job 95208551157 — kernel handoff at t=17s, then nothing for 4184s, never booted
  //   job 95218377728 — kernel handoff at t=17s, login at t=192s, booted
  // Same image, same runner type, >24x swing in the same segment. So the
  // lane is intermittent. STALLED bounds the wasted time on the bad runs;
  // it does NOT claim to know whether the guest hung or was starved.
  const stalled = (serial: string, silentFor: number) =>
    classifyBoot({
      serial,
      qemuExited: false,
      qemuExitCode: null,
      deadlineReached: false,
      timeoutSeconds: 4200,
      secondsSinceSerialGrowth: silentFor,
    });

  it("calls the real CI signature STALLED, not TIMEOUT", () => {
    const c = stalled(CI_TIMEOUT, 4184);
    expect(c.outcome).toBe("STALLED");
    expect(c.stage).toBe("kernel");
    expect(outcomeExitCode(c.outcome)).toBe(4);
  });

  it("does not fire before the silence threshold", () => {
    expect(stalled(CI_TIMEOUT, 1199).outcome).not.toBe("STALLED");
  });

  it("fires at the threshold", () => {
    expect(stalled(CI_TIMEOUT, 1200).outcome).toBe("STALLED");
  });

  // The measured good run booted end-to-end in 192s. The threshold must
  // sit far enough above a whole healthy boot that a contended-but-
  // progressing run is not cut off and mislabelled.
  it("leaves >6x headroom over a whole healthy CI boot (192s)", () => {
    expect(stalled(CI_TIMEOUT, 192).outcome).not.toBe("STALLED");
    expect(stalled(CI_TIMEOUT, 1000).outcome).not.toBe("STALLED");
  });

  // Detection is dual-use: report the fact, do not attach the verdict.
  it("states the silence as a FACT and does not assert 'hang'", () => {
    const c = stalled(CI_TIMEOUT, 4184);
    expect(c.reason).toContain("produced nothing for 4184s");
    expect(c.reason).toContain("cannot tell those apart");
  });

  it("does NOT fire below the kernel handoff — that is BOOT-FAILED territory", () => {
    // Silence in the firmware is a different fact and must not be
    // relabelled a kernel hang.
    const c = stalled("UEFI firmware (version ...)\n", 4184);
    expect(c.outcome).not.toBe("STALLED");
  });

  it("never fires on a booted guest, however long it has been quiet", () => {
    expect(stalled(HEALTHY_BOOT, 99999).outcome).toBe("BOOTED");
  });

  it("is disabled when growth is not tracked (undefined)", () => {
    const c = classifyBoot({
      serial: CI_TIMEOUT,
      qemuExited: false,
      qemuExitCode: null,
      deadlineReached: true,
      timeoutSeconds: 4200,
    });
    expect(c.outcome).toBe("TIMEOUT");
  });

  it("STALLED, TIMEOUT and BOOT-FAILED are three distinct exit codes", () => {
    const codes = new Set([
      outcomeExitCode("BOOT-FAILED"),
      outcomeExitCode("TIMEOUT"),
      outcomeExitCode("STALLED"),
    ]);
    expect(codes.size).toBe(3);
  });
});

describe("detectFailureMarker", () => {
  it("names the UEFI Shell fallthrough", () => {
    expect(detectFailureMarker(NO_BOOT_MEDIA)).toContain("UEFI Shell");
  });
  it("stays silent on a healthy boot", () => {
    expect(detectFailureMarker(HEALTHY_BOOT)).toBeNull();
  });
  it("stays silent on the CI timeout tail", () => {
    expect(detectFailureMarker(CI_TIMEOUT)).toBeNull();
  });
});

describe("outcomeExitCode — the contract the workflow branches on", () => {
  it("maps each outcome to a distinct code", () => {
    expect(outcomeExitCode("BOOTED")).toBe(0);
    expect(outcomeExitCode("BOOT-FAILED")).toBe(1);
    expect(outcomeExitCode("TIMEOUT")).toBe(3);
    expect(outcomeExitCode("STALLED")).toBe(4);
  });
});

describe("timeoutSecondsFor", () => {
  it("gives aarch64-without-same-arch-KVM the long TCG budget", () => {
    expect(timeoutSecondsFor("aarch64", { kvmAvailable: false, hostArch: "arm64" })).toBe(4200);
  });

  it("does NOT give the long budget to an x86_64 host emulating aarch64 by mistake", () => {
    // /dev/kvm present but the host is x86_64 => still TCG for aarch64.
    expect(timeoutSecondsFor("aarch64", { kvmAvailable: true, hostArch: "x64" })).toBe(4200);
  });

  it("uses the short budget for same-arch accelerated aarch64", () => {
    expect(timeoutSecondsFor("aarch64", { kvmAvailable: true, hostArch: "arm64" })).toBe(300);
  });

  it("uses the short budget for x86_64", () => {
    expect(timeoutSecondsFor("x86_64", { kvmAvailable: true, hostArch: "x64" })).toBe(300);
  });
});

describe("buildQemuArgsPure", () => {
  const iso = { kind: "iso", path: "/tmp/x.iso" } as const;

  it("drops the NIC on aarch64 (efi-virtio.rom is absent under --no-install-recommends)", () => {
    const args = buildQemuArgsPure("aarch64", iso, "/tmp/s.log", {
      kvmAvailable: false,
      hostArch: "arm64",
      efiPath: "/usr/share/qemu-efi-aarch64/QEMU_EFI.fd",
    });
    expect(args).toContain("-nic");
    expect(args[args.indexOf("-nic") + 1]).toBe("none");
  });

  it("falls back to TCG -cpu max when /dev/kvm is absent", () => {
    const args = buildQemuArgsPure("aarch64", iso, "/tmp/s.log", {
      kvmAvailable: false,
      hostArch: "arm64",
    });
    expect(args).not.toContain("-enable-kvm");
    expect(args[args.indexOf("-cpu") + 1]).toBe("max");
  });

  it("uses same-arch KVM when /dev/kvm is present on an arm64 host", () => {
    const args = buildQemuArgsPure("aarch64", iso, "/tmp/s.log", {
      kvmAvailable: true,
      hostArch: "arm64",
    });
    expect(args).toContain("-enable-kvm");
    expect(args[args.indexOf("-cpu") + 1]).toBe("host");
  });

  it("never enables KVM for aarch64 on a non-arm64 host", () => {
    const args = buildQemuArgsPure("aarch64", iso, "/tmp/s.log", {
      kvmAvailable: true,
      hostArch: "x64",
    });
    expect(args).not.toContain("-enable-kvm");
  });

  it("refuses aarch64 --usb-image (unsupported)", () => {
    expect(() =>
      buildQemuArgsPure("aarch64", { kind: "usb-image", path: "/tmp/x.img" }, "/tmp/s.log", {
        kvmAvailable: false,
        hostArch: "arm64",
      }),
    ).toThrow("not supported");
  });

  it("builds the xhci usb-storage chain for an x86_64 usb-image", () => {
    const args = buildQemuArgsPure("x86_64", { kind: "usb-image", path: "/tmp/x.img" }, "/tmp/s.log", {
      kvmAvailable: false,
      hostArch: "x64",
    });
    expect(args.join(" ")).toContain("usb-storage,bus=xhci.0,drive=zflashboot,bootindex=1");
    expect(args.join(" ")).toContain(`serial=${QEMU_USB_TEST_SERIAL}`);
  });
});

// ── x86_64: the same crux on the other boot road ────────────────────
// Everything above was measured on aarch64 (EDK2 → GRUB → EFI stub).
// x86_64 takes a different road entirely — SeaBIOS → ISOLINUX → a BIOS
// kernel handoff — and the aarch64 ladder could not see any of it.
//
// Fixtures are VERBATIM lines from real captures, 2026-08-16:
//   X86_HEALTHY  — run 31975465756's uploaded `qemu-full-install-serial.log`
//                  (170KB, a SUCCESSFUL x86_64 boot).
//   X86_NO_BOOT  — SeaBIOS rel-1.17.0 under QEMU 11.0.1 on this machine,
//                  booting a 1MB image with no 0x55AA signature over the
//                  harness's own xhci/usb-storage chain. Reached
//                  `No bootable device.` at t=1s while QEMU STAYED ALIVE.

const X86_HEALTHY = [
  "ISOLINUX 6.04   Copyright (C) 1994-2015 H. Peter Anvin et al",
  "Loading /boot//nix/store/jb4hy7pal9zx0r417y8bkb5lhhj8fml0-linux-6.12.90/bzImage... ok",
  "[    0.000000] Linux version 6.12.90 (nixbld@localhost) (gcc (GCC) 14.3.0) #1-NixOS SMP",
  "<<< Welcome to NixOS 25.11.20260522.b77b3de (x86_64) - ttyS0 >>>",
  "zeta-installer login: nixos (automatic login)",
].join("\n");

// The firmware transcript, not the serial log — SeaBIOS speaks on the
// debugcon channel. Note it contains THREE "Boot failed:" lines and then
// the terminal verdict; that ordering is the whole reason the harness
// matches only the last one.
const X86_NO_BOOT_FIRMWARE = [
  "SeaBIOS (version rel-1.17.0-0-gb52ca86e094d-prebuilt.qemu.org)",
  "Booting from Hard Disk...",
  "Boot failed: not a bootable disk",
  "Booting from DVD/CD...",
  "Boot failed: Could not read from CDROM (code 0003)",
  "Booting from Floppy...",
  "Boot failed: could not read the boot disk",
  "No bootable device.",
].join("\n");

// A healthy boot whose USB device is not SeaBIOS's first candidate: the
// firmware rejects the hard disk, then boots the real image. This is the
// false-positive shape that "Boot failed:" would have produced.
const X86_HEALTHY_AFTER_REJECTED_CANDIDATE = combineTranscripts(
  X86_HEALTHY,
  ["SeaBIOS (version rel-1.17.0-0-gb52ca86e094d-prebuilt.qemu.org)", "Booting from Hard Disk...", "Boot failed: not a bootable disk", "Booting from USB..."].join("\n"),
);

describe("x86_64 boot road — the ladder must not read a constant", () => {
  // THE DEFECT. Before 2026-08-16 the ladder's firmware/bootloader/
  // kernel rungs matched EDK2, GRUB and EFI-stub strings, none of which
  // a NixOS x86_64 BIOS boot emits. Counted on the real 170KB log:
  // "UEFI firmware" 0, "Booting `NixOS" 0, "EFI stub: Exiting boot
  // services" 0. So the ladder could only report `none` or `login`, and
  // 19 consecutive CI runs confirmed it by printing exactly one stage
  // line each. An instrument reading a constant is not an instrument.
  it("does not match ANY aarch64-road marker on a real x86_64 boot", () => {
    for (const aarch64Marker of ["UEFI firmware", "Booting `NixOS", "EFI stub: Exiting boot services"]) {
      expect(X86_HEALTHY.includes(aarch64Marker)).toBe(false);
    }
  });

  it("climbs every rung on a real successful x86_64 log", () => {
    expect(furthestBootStage(X86_HEALTHY)).toBe("login");
    // Each prefix must land on its own rung — the point is that the
    // intermediate rungs are now REACHABLE, not merely that the top is.
    const lines = X86_HEALTHY.split("\n");
    expect(furthestBootStage(lines[0]!)).toBe("bootloader");
    expect(furthestBootStage(lines.slice(0, 3).join("\n"))).toBe("kernel");
    expect(furthestBootStage(lines.slice(0, 4).join("\n"))).toBe("userspace");
  });

  it("reads `firmware` off SeaBIOS's banner — the rung x86_64 never had", () => {
    expect(furthestBootStage("SeaBIOS (version rel-1.17.0-0-gb52ca86e094d-prebuilt.qemu.org)")).toBe(
      "firmware",
    );
  });
});

describe("x86_64 BOOT-FAILED vs TIMEOUT — demonstrated live, pinned here", () => {
  // Live 2026-08-16 through the real harness on real QEMU:
  //   no-signature image  -> BOOT-FAILED, exit 1, stage firmware, t=10s
  //   bootloader fixture  -> TIMEOUT,     exit 3, stage bootloader, budget 20s
  // These pin the classification those runs produced.
  it("calls SeaBIOS's exhausted-boot-options verdict BOOT-FAILED", () => {
    const c = classifyBoot({
      serial: combineTranscripts("", X86_NO_BOOT_FIRMWARE),
      qemuExited: false, // it does NOT exit — that is the whole crux
      qemuExitCode: null,
      deadlineReached: false,
      timeoutSeconds: 300,
    });
    expect(c.outcome).toBe("BOOT-FAILED");
    expect(outcomeExitCode(c.outcome)).toBe(1);
    expect(c.reason).toContain("no bootable device");
  });

  it("settles BOOT-FAILED with the clock untouched — the point is not waiting", () => {
    // deadlineReached false and qemuExited false: the verdict comes from
    // evidence alone. Without the firmware channel this input is the
    // empty string, which cannot settle at all.
    const withChannel = classifyBoot({
      serial: combineTranscripts("", X86_NO_BOOT_FIRMWARE),
      qemuExited: false,
      qemuExitCode: null,
      deadlineReached: false,
      timeoutSeconds: 300,
    });
    const withoutChannel = classifyBoot({
      serial: "",
      qemuExited: false,
      qemuExitCode: null,
      deadlineReached: false,
      timeoutSeconds: 300,
    });
    expect(withChannel.outcome).toBe("BOOT-FAILED");
    expect(withoutChannel.reason).toBe("still running");
  });

  it("a partly-booted x86_64 guest out of budget is TIMEOUT, not BOOT-FAILED", () => {
    const c = classifyBoot({
      serial: "ISOLINUX 6.04   Copyright (C) 1994-2015 H. Peter Anvin et al\n",
      qemuExited: false,
      qemuExitCode: null,
      deadlineReached: true,
      timeoutSeconds: 300,
    });
    expect(c.outcome).toBe("TIMEOUT");
    expect(outcomeExitCode(c.outcome)).toBe(3);
  });

  it("x86_64 STALLED needs the kernel rung, which `Linux version` now supplies", () => {
    const stalledInput = {
      serial: X86_HEALTHY.split("\n").slice(0, 3).join("\n"),
      qemuExited: false,
      qemuExitCode: null,
      deadlineReached: false,
      timeoutSeconds: 300,
      secondsSinceSerialGrowth: 60,
      stallSeconds: 8,
    } as const;
    const c = classifyBoot(stalledInput);
    expect(c.outcome).toBe("STALLED");
    expect(c.stage).toBe("kernel");
    expect(outcomeExitCode(c.outcome)).toBe(4);
  });

  it("the four x86_64 outcomes hold four distinct exit codes", () => {
    const codes = new Set([
      outcomeExitCode("BOOTED"),
      outcomeExitCode("BOOT-FAILED"),
      outcomeExitCode("TIMEOUT"),
      outcomeExitCode("STALLED"),
    ]);
    expect(codes.size).toBe(4);
  });
});

describe("detectFailureMarker on the x86_64 road", () => {
  it("names SeaBIOS's terminal verdict", () => {
    expect(detectFailureMarker(X86_NO_BOOT_FIRMWARE)).toContain("no bootable device");
  });

  // THE FALSE-POSITIVE GUARD. SeaBIOS prints "Boot failed:" once per
  // rejected candidate and then carries on to the next one, so matching
  // it would fail healthy images whose USB device is not tried first.
  // This lane is a blocking gate; a false BOOT-FAILED here stops the
  // ISO shipping.
  it("stays silent on a HEALTHY boot that rejected an earlier candidate", () => {
    expect(X86_HEALTHY_AFTER_REJECTED_CANDIDATE).toContain("Boot failed: not a bootable disk");
    expect(detectFailureMarker(X86_HEALTHY_AFTER_REJECTED_CANDIDATE)).toBeNull();
  });

  it("and that log still classifies as BOOTED", () => {
    const c = classifyBoot({
      serial: X86_HEALTHY_AFTER_REJECTED_CANDIDATE,
      qemuExited: false,
      qemuExitCode: null,
      deadlineReached: true,
      timeoutSeconds: 300,
    });
    expect(c.outcome).toBe("BOOTED");
  });

  it("stays silent on the real successful x86_64 log", () => {
    expect(detectFailureMarker(X86_HEALTHY)).toBeNull();
  });
});

describe("combineTranscripts — two files, one transcript", () => {
  it("cannot invent a marker neither file contained", () => {
    expect(furthestBootStage(combineTranscripts("", ""))).toBe("none");
  });

  it("returns the serial unchanged when the firmware said nothing", () => {
    expect(combineTranscripts(X86_HEALTHY, "")).toBe(X86_HEALTHY);
  });

  it("lets the firmware supply a rung the serial log lacks", () => {
    expect(furthestBootStage("")).toBe("none");
    expect(furthestBootStage(combineTranscripts("", X86_NO_BOOT_FIRMWARE))).toBe("firmware");
  });
});

describe("buildQemuArgsPure — the x86_64 firmware channel", () => {
  const usb = { kind: "usb-image", path: "/tmp/x.img" } as const;
  const host = { kvmAvailable: false, hostArch: "x64" } as const;

  it("wires isa-debugcon to the firmware log when one is requested", () => {
    const args = buildQemuArgsPure("x86_64", usb, "/tmp/s.log", host, "/tmp/fw.log").join(" ");
    expect(args).toContain("file,id=zetafwlog,path=/tmp/fw.log");
    expect(args).toContain(`isa-debugcon,iobase=${X86_FIRMWARE_DEBUGCON_PORT},chardev=zetafwlog`);
  });

  it("adds nothing at all when no firmware log is requested", () => {
    const withOut = buildQemuArgsPure("x86_64", usb, "/tmp/s.log", host);
    expect(withOut.join(" ")).not.toContain("isa-debugcon");
  });

  // Measuring must not move the thing measured: this lane is a blocking
  // gate that has passed 19 consecutive runs, so the instrument must be
  // additive only. The guest's own UART and boot chain are untouched.
  it("leaves the guest-visible device model byte-identical", () => {
    const withOut = buildQemuArgsPure("x86_64", usb, "/tmp/s.log", host);
    const withIn = buildQemuArgsPure("x86_64", usb, "/tmp/s.log", host, "/tmp/fw.log");
    const stripped = withIn.filter(
      (a, i) =>
        !a.startsWith("file,id=zetafwlog") &&
        !a.startsWith("isa-debugcon") &&
        !(a === "-chardev" && withIn[i + 1]?.startsWith("file,id=zetafwlog")) &&
        !(a === "-device" && withIn[i + 1]?.startsWith("isa-debugcon")),
    );
    expect(stripped).toEqual(withOut);
  });

  it("never wires a firmware channel on aarch64 — EDK2 already uses the PL011", () => {
    const args = buildQemuArgsPure(
      "aarch64",
      { kind: "iso", path: "/tmp/x.iso" },
      "/tmp/s.log",
      { kvmAvailable: false, hostArch: "arm64" },
      "/tmp/fw.log",
    );
    expect(args.join(" ")).not.toContain("isa-debugcon");
  });
});
