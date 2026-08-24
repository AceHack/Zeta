/**
 * src/Core.TypeScript/zflash/flash-usb-linux.test.ts
 *
 * Runs on ANY OS (bun test). Exercises the whole dangerous decision surface of the Linux
 * flasher — device enumeration, every safety rail, the consent challenge, the escalation
 * gate and the argv it builds — with no USB stick, no root, and no finger on a sensor.
 *
 * Sibling of flash-usb-windows.test.ts, which does the same for the Windows arm.
 */
import { describe, expect, test } from "bun:test";
import {
  MIN_ISO_BYTES,
  MAX_ISO_BYTES,
  MIN_USB_BYTES,
  MAX_USB_BYTES,
  SYSTEM_MOUNTPOINTS,
  FPRINTD_MODULE,
  human,
  lsblkArgv,
  parseLsblkJson,
  allMountpoints,
  isSafeWholeDiskPath,
  hostsRootFilesystem,
  selectUsbCandidate,
  validateIso,
  buildLongChallenge,
  buildShortChallenge,
  makeNonce,
  parseFprintdList,
  planEscalation,
  escalationArgv,
  ddArgs,
  unmountTargets,
  type LinuxBlockDevice,
  type EscalationInputs,
} from "./flash-usb-linux.ts";
import { analyzePamAuthChain, type PamAuthChainAnalysis } from "../pam/auth-chain.ts";

const GiB = 1024 * 1024 * 1024;
const MiB = 1024 * 1024;

function dev(p: Partial<LinuxBlockDevice> = {}): LinuxBlockDevice {
  return {
    name: "sdb",
    path: "/dev/sdb",
    sizeBytes: 32 * GiB,
    type: "disk",
    transport: "usb",
    removable: true,
    readOnly: false,
    hotplug: true,
    model: "Ultra Fit",
    vendor: "SanDisk",
    serial: "4C530001",
    partitionTable: "gpt",
    fsType: "",
    label: "",
    mountpoints: [],
    children: [],
    ...p,
  };
}

/** A chain with no fprintd at all — the shape on a host that never installed it. */
const NO_FPRINTD: PamAuthChainAnalysis = {
  targetConfigured: false,
  competingEntries: ["required pam_unix.so"],
  unresolvedIncludes: [],
  targetIsOnlySatisfier: false,
};

/** The realistic Linux shape: fprintd IS configured, and pam_unix shares the chain. */
const FPRINTD_WITH_PASSWORD: PamAuthChainAnalysis = {
  targetConfigured: true,
  competingEntries: ["[success=1 default=ignore] pam_unix.so"],
  unresolvedIncludes: [],
  targetIsOnlySatisfier: false,
};

/** The only shape that licenses the word "biometric" — contrived, but not vacuous. */
const FPRINTD_ONLY: PamAuthChainAnalysis = {
  targetConfigured: true,
  competingEntries: [],
  unresolvedIncludes: [],
  targetIsOnlySatisfier: true,
};

function inputs(p: Partial<EscalationInputs> = {}): EscalationInputs {
  return {
    sudoAvailable: true,
    pkexecAvailable: true,
    sudoChain: NO_FPRINTD,
    polkitChain: NO_FPRINTD,
    enrollment: "none-enrolled",
    hasTty: true,
    ...p,
  };
}

// ── lsblk parsing ────────────────────────────────────────────────────────────────────────

describe("lsblk enumeration", () => {
  test("lsblkArgv asks for BYTES, so no human-readable size ever needs parsing", () => {
    expect(lsblkArgv()).toContain("--bytes");
    expect(lsblkArgv()).toContain("--json");
  });

  test("parses a nested disk → partition tree", () => {
    const parsed = parseLsblkJson(
      JSON.stringify({
        blockdevices: [
          {
            name: "/dev/sdb",
            path: "/dev/sdb",
            size: 32 * GiB,
            type: "disk",
            tran: "usb",
            rm: true,
            ro: false,
            hotplug: true,
            model: "Ultra Fit",
            vendor: "SanDisk",
            serial: "4C53",
            pttype: "gpt",
            mountpoints: [null],
            children: [
              {
                name: "/dev/sdb1",
                path: "/dev/sdb1",
                size: 512 * MiB,
                type: "part",
                fstype: "vfat",
                label: "ESP",
                mountpoints: ["/media/u/ESP"],
              },
            ],
          },
        ],
      }),
    );
    expect(parsed.length).toBe(1);
    const disk = parsed[0]!;
    expect(disk.transport).toBe("usb");
    expect(disk.sizeBytes).toBe(32 * GiB);
    // `[null]` is lsblk's UNMOUNTED encoding — reading it as one mount point would make
    // every unmounted partition look mounted.
    expect(disk.mountpoints).toEqual([]);
    expect(disk.children[0]!.mountpoints).toEqual(["/media/u/ESP"]);
    expect(allMountpoints(disk)).toEqual(["/media/u/ESP"]);
  });

  test("the OLDER scalar `mountpoint` form is read too (util-linux < 2.37)", () => {
    const parsed = parseLsblkJson(
      JSON.stringify({ blockdevices: [{ name: "sda1", type: "part", mountpoint: "/" }] }),
    );
    // Missing this form is the direction that destroys a boot disk: a mounted `/` would
    // read as unmounted and the system-mountpoint rail would never fire.
    expect(parsed[0]!.mountpoints).toEqual(["/"]);
  });

  test("string-encoded sizes and 0/1 flags are normalized", () => {
    const parsed = parseLsblkJson(
      JSON.stringify({ blockdevices: [{ name: "sdb", size: "8589934592", rm: "1", ro: "0" }] }),
    );
    expect(parsed[0]!.sizeBytes).toBe(8 * GiB);
    expect(parsed[0]!.removable).toBe(true);
    expect(parsed[0]!.readOnly).toBe(false);
  });

  test("a payload with no blockdevices array yields no devices (not a throw)", () => {
    expect(parseLsblkJson(JSON.stringify({}))).toEqual([]);
  });

  test("transport is lower-cased, so `USB` and `usb` are the same transport", () => {
    const parsed = parseLsblkJson(JSON.stringify({ blockdevices: [{ name: "sdb", tran: "USB" }] }));
    expect(parsed[0]!.transport).toBe("usb");
  });
});

// ── device-path whitelist ────────────────────────────────────────────────────────────────

describe("isSafeWholeDiskPath", () => {
  test("accepts whole disks across the naming schemes", () => {
    for (const p of ["/dev/sda", "/dev/sdab", "/dev/vdb", "/dev/hdc", "/dev/nvme0n1", "/dev/mmcblk0"]) {
      expect(isSafeWholeDiskPath(p)).toBe(true);
    }
  });

  test("rejects partitions — a partition is never a flash target", () => {
    for (const p of ["/dev/sda1", "/dev/nvme0n1p2", "/dev/mmcblk0p1"]) {
      expect(isSafeWholeDiskPath(p)).toBe(false);
    }
  });

  test("rejects traversal, mapper and anything that is not a bare device node", () => {
    for (const p of ["/dev/../etc/passwd", "/dev/mapper/vg-root", "sda", "/dev/loop0", "/dev/sda;rm"]) {
      expect(isSafeWholeDiskPath(p)).toBe(false);
    }
  });
});

// ── root-filesystem guard ────────────────────────────────────────────────────────────────

describe("hostsRootFilesystem", () => {
  test("an UNKNOWN root source makes every disk suspect (fail-closed)", () => {
    expect(hostsRootFilesystem(dev(), "")).toBe(true);
  });

  test("a non-/dev root spec (LVM mapper, ZFS dataset) is unresolvable ⇒ suspect", () => {
    expect(hostsRootFilesystem(dev(), "/dev/mapper/vg0-root")).toBe(true);
    expect(hostsRootFilesystem(dev(), "rpool/ROOT/default")).toBe(true);
  });

  test("matches the disk itself and any of its partitions", () => {
    const d = dev({ path: "/dev/sda", children: [dev({ path: "/dev/sda2", type: "part" })] });
    expect(hostsRootFilesystem(d, "/dev/sda")).toBe(true);
    expect(hostsRootFilesystem(d, "/dev/sda2")).toBe(true);
  });

  test("a btrfs `[/subvol]` suffix is stripped before matching", () => {
    const d = dev({ path: "/dev/sda", children: [dev({ path: "/dev/sda2", type: "part" })] });
    expect(hostsRootFilesystem(d, "/dev/sda2[/@]")).toBe(true);
  });

  test("PREFIX IS NOT PARENTHOOD: /dev/sda is not the parent of /dev/sdaa", () => {
    // A `startsWith` test would refuse the correct stick and, worse, would accept a disk
    // whose name merely extends the root device's.
    expect(hostsRootFilesystem(dev({ path: "/dev/sda", children: [] }), "/dev/sdaa")).toBe(false);
  });
});

// ── the rails ────────────────────────────────────────────────────────────────────────────

describe("selectUsbCandidate", () => {
  const ctx = { rootSource: "/dev/nvme0n1p2" };

  test("the happy path: exactly one clean USB disk", () => {
    const s = selectUsbCandidate([dev()], ctx);
    expect(s.ok).toBe(true);
    if (s.ok) expect(s.device.path).toBe("/dev/sdb");
  });

  test("refuses when ZERO candidates survive, and shows what it saw", () => {
    const s = selectUsbCandidate([dev({ transport: "nvme", path: "/dev/nvme0n1" })], ctx);
    expect(s.ok).toBe(false);
    if (!s.ok) {
      expect(s.code).toBe(2);
      expect(s.message).toContain("/dev/nvme0n1");
    }
  });

  test("refuses to GUESS when two candidates survive", () => {
    const s = selectUsbCandidate([dev(), dev({ path: "/dev/sdc", name: "sdc" })], ctx);
    expect(s.ok).toBe(false);
    if (!s.ok) expect(s.message).toContain("Unplug all but the target");
  });

  test("a partition is never a candidate, only a whole disk", () => {
    expect(selectUsbCandidate([dev({ type: "part", path: "/dev/sdb1" })], ctx).ok).toBe(false);
  });

  test("`removable` is NOT enough — the transport must be usb", () => {
    // An internal SATA disk in a hot-swap bay reports rm/hotplug true. Gating on those
    // instead of the transport is how a data disk becomes a flash target.
    expect(selectUsbCandidate([dev({ transport: "sata", removable: true, hotplug: true })], ctx).ok).toBe(false);
  });

  test("a read-only device is refused rather than attempted", () => {
    expect(selectUsbCandidate([dev({ readOnly: true })], ctx).ok).toBe(false);
  });

  test("size bounds hold on both ends — an external SSD is not a USB stick", () => {
    expect(selectUsbCandidate([dev({ sizeBytes: MIN_USB_BYTES - 1 })], ctx).ok).toBe(false);
    expect(selectUsbCandidate([dev({ sizeBytes: MAX_USB_BYTES + 1 })], ctx).ok).toBe(false);
    expect(selectUsbCandidate([dev({ sizeBytes: MIN_USB_BYTES })], ctx).ok).toBe(true);
    expect(selectUsbCandidate([dev({ sizeBytes: MAX_USB_BYTES })], ctx).ok).toBe(true);
  });

  test("every system mount point is fatal, at any depth of the tree", () => {
    for (const m of SYSTEM_MOUNTPOINTS) {
      const d = dev({ children: [dev({ type: "part", path: "/dev/sdb1", mountpoints: [m] })] });
      expect(selectUsbCandidate([d], ctx).ok).toBe(false);
    }
  });

  test("a USB stick that BACKS THE ROOT FILESYSTEM is refused (booted-from-USB host)", () => {
    const d = dev({ children: [dev({ type: "part", path: "/dev/sdb2" })] });
    expect(selectUsbCandidate([d], { rootSource: "/dev/sdb2" }).ok).toBe(false);
  });

  test("an unknown root source refuses everything rather than guessing", () => {
    expect(selectUsbCandidate([dev()], { rootSource: "" }).ok).toBe(false);
  });

  test("an ordinary data partition mounted under /media does NOT disqualify the stick", () => {
    const d = dev({ children: [dev({ type: "part", path: "/dev/sdb1", mountpoints: ["/media/u/DATA"] })] });
    expect(selectUsbCandidate([d], ctx).ok).toBe(true);
  });
});

// ── ISO validation ───────────────────────────────────────────────────────────────────────

describe("validateIso", () => {
  test("accepts a sane ISO", () => {
    expect(validateIso("/tmp/zeta.iso", 2 * GiB, true).ok).toBe(true);
  });
  test("rejects a non-.iso, a directory, and both size extremes", () => {
    expect(validateIso("/tmp/zeta.img", 2 * GiB, true).ok).toBe(false);
    expect(validateIso("/tmp/zeta.iso", 2 * GiB, false).ok).toBe(false);
    expect(validateIso("/tmp/zeta.iso", MIN_ISO_BYTES - 1, true).ok).toBe(false);
    expect(validateIso("/tmp/zeta.iso", MAX_ISO_BYTES + 1, true).ok).toBe(false);
  });
  test("the extension check is case-insensitive", () => {
    expect(validateIso("/tmp/ZETA.ISO", 2 * GiB, true).ok).toBe(true);
  });
});

// ── the consent challenge ────────────────────────────────────────────────────────────────

describe("runtime consent challenge", () => {
  test("the long form binds the consent to a SPECIFIC device", () => {
    expect(buildLongChallenge("/dev/sdb", "a3f9c1d2")).toBe("accept-destroy /dev/sdb a3f9c1d2");
  });
  test("the short form matches flash-usb.ts --short", () => {
    expect(buildShortChallenge("a3f9")).toBe("yes a3f9");
  });
  test("a malformed nonce throws rather than producing a weaker challenge", () => {
    expect(() => buildLongChallenge("/dev/sdb", "a3f9")).toThrow();
    expect(() => buildShortChallenge("A3F9")).toThrow();
    expect(() => buildShortChallenge("a3f9c1d2")).toThrow();
  });
  test("makeNonce draws from the injected randomness at the documented width", () => {
    const long = makeNonce(false, (n) => Buffer.alloc(n, 0xab));
    const short = makeNonce(true, (n) => Buffer.alloc(n, 0xab));
    expect(long).toBe("abababab");
    expect(short).toBe("abab");
  });
  test("real nonces differ between runs, so an answer cannot be pre-baked", () => {
    expect(makeNonce(false)).not.toBe(makeNonce(false));
  });
});

// ── fprintd enrollment ───────────────────────────────────────────────────────────────────

describe("parseFprintdList", () => {
  test("recognises an enrolled finger", () => {
    const out = [
      "found 1 devices",
      "Device at /net/reactivated/Fprint/Device/0",
      "Fingerprints for user aaron on Synaptics Sensors (press):",
      " - #0: right-index-finger",
    ].join("\n");
    expect(parseFprintdList(out)).toBe("enrolled");
  });
  test("recognises a device with nothing enrolled", () => {
    expect(parseFprintdList("User aaron has no fingers enrolled for Synaptics Sensors.")).toBe("none-enrolled");
  });
  test("recognises no reader at all", () => {
    expect(parseFprintdList("No devices available")).toBe("no-device");
    expect(parseFprintdList("found 0 devices")).toBe("no-device");
  });
  test("anything unrecognised is UNKNOWN, never rounded up to enrolled", () => {
    expect(parseFprintdList("")).toBe("unknown");
    expect(parseFprintdList("Failed to connect to session bus: no such file")).toBe("unknown");
  });
});

// ── the escalation gate ──────────────────────────────────────────────────────────────────

describe("planEscalation — degrade, never bypass", () => {
  test("no usable mechanism is a REFUSAL, and says so in those words", () => {
    const p = planEscalation(inputs({ sudoAvailable: false, pkexecAvailable: false }));
    expect(p.ok).toBe(false);
    if (!p.ok) {
      expect(p.message).toContain("refusing to continue");
      expect(p.message).toContain("NOPASSWD");
    }
  });

  test("no fingerprint anywhere still ESCALATES — the gate degrades to a password", () => {
    const p = planEscalation(inputs());
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.mechanism).toBe("sudo");
      expect(p.fingerprintOffered).toBe(false);
      expect(p.factor).toBe("unattributed");
      expect(p.rationale).toContain("degraded");
    }
  });

  test("THE HONEST CASE: fprintd configured alongside pam_unix ⇒ offered, but UNATTRIBUTED", () => {
    const p = planEscalation(inputs({ sudoChain: FPRINTD_WITH_PASSWORD, enrollment: "enrolled" }));
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.fingerprintOffered).toBe(true);
      // A fingerprint being OFFERED is not a fingerprint being USED. sudo reports its own
      // exit status and never names the module that satisfied PAM.
      expect(p.factor).toBe("unattributed");
      expect(p.rationale).toContain("pam_unix.so");
      expect(p.rationale).toContain("not observable at this seam");
    }
  });

  test("the biometric claim is not vacuously false — an fprintd-ONLY chain licenses it", () => {
    const p = planEscalation(inputs({ sudoChain: FPRINTD_ONLY, enrollment: "enrolled" }));
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.factor).toBe("biometric");
  });

  test("a configured chain with NOTHING enrolled does not claim the fingerprint", () => {
    const p = planEscalation(inputs({ sudoChain: FPRINTD_ONLY, enrollment: "none-enrolled" }));
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.fingerprintOffered).toBe(false);
      expect(p.factor).toBe("unattributed");
    }
  });

  test("an UNKNOWN enrollment never licenses the claim either", () => {
    const p = planEscalation(inputs({ sudoChain: FPRINTD_ONLY, enrollment: "unknown" }));
    expect(p.ok && p.factor).toBe("unattributed");
  });

  test("a mechanism that OFFERS the fingerprint outranks one that does not", () => {
    const p = planEscalation(inputs({ polkitChain: FPRINTD_WITH_PASSWORD, enrollment: "enrolled" }));
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.mechanism).toBe("pkexec");
      expect(p.fingerprintOffered).toBe(true);
    }
  });

  test("ties break toward sudo — the prompt lands in the terminal the operator is watching", () => {
    const p = planEscalation(
      inputs({ sudoChain: FPRINTD_WITH_PASSWORD, polkitChain: FPRINTD_WITH_PASSWORD, enrollment: "enrolled" }),
    );
    expect(p.ok && p.mechanism).toBe("sudo");
  });

  test("no TTY disqualifies sudo (nowhere to prompt) and falls through to pkexec", () => {
    const p = planEscalation(inputs({ hasTty: false }));
    expect(p.ok && p.mechanism).toBe("pkexec");
  });

  test("no TTY and no pkexec is a refusal, not an unprivileged write", () => {
    const p = planEscalation(inputs({ hasTty: false, pkexecAvailable: false }));
    expect(p.ok).toBe(false);
  });

  test("an UNREADABLE include keeps the claim at unattributed", () => {
    const chain: PamAuthChainAnalysis = {
      targetConfigured: true,
      competingEntries: [],
      unresolvedIncludes: ["common-auth"],
      targetIsOnlySatisfier: false,
    };
    const p = planEscalation(inputs({ sudoChain: chain, enrollment: "enrolled" }));
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.factor).toBe("unattributed");
      expect(p.rationale).toContain("unreadable");
    }
  });

  test("END TO END on a real Debian stack: enrolled, offered, and still unattributed", () => {
    // The exact reason auth-chain.ts is shared rather than copied — read with the wrong
    // dialect this file resolves to an empty chain and the claim is inverted.
    const files: Record<string, string> = {
      "/etc/pam.d/sudo": "#%PAM-1.0\n@include common-auth\n",
      "/etc/pam.d/common-auth": [
        "auth\t[success=2 default=ignore]\tpam_fprintd.so max_tries=3",
        "auth\t[success=1 default=ignore]\tpam_unix.so nullok",
        "auth\trequisite\t\t\tpam_deny.so",
      ].join("\n"),
    };
    const read = (p: string): string => {
      const t = files[p];
      if (t === undefined) throw new Error(`ENOENT: ${p}`);
      return t;
    };
    const sudoChain = analyzePamAuthChain(read, {
      service: "sudo",
      targetModule: FPRINTD_MODULE,
      syntax: "linux-pam",
      targetControlFlags: ["[success=2 default=ignore]"],
    });
    expect(sudoChain.targetConfigured).toBe(true);

    const p = planEscalation(inputs({ sudoChain, enrollment: "enrolled" }));
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.fingerprintOffered).toBe(true);
      expect(p.factor).toBe("unattributed");
    }
  });
});

// ── the argv that actually runs ──────────────────────────────────────────────────────────

describe("escalationArgv", () => {
  test("sudo terminates option parsing with `--`, so a path can never be read as a flag", () => {
    expect(escalationArgv("sudo", "/usr/bin/dd", ["if=/tmp/a.iso"], "/usr/bin/sudo")).toEqual([
      "/usr/bin/sudo",
      "--",
      "/usr/bin/dd",
      "if=/tmp/a.iso",
    ]);
  });

  test("pkexec takes the resolved path directly (it defines no `--` terminator)", () => {
    expect(escalationArgv("pkexec", "/usr/bin/umount", ["/media/u"], "/usr/bin/pkexec")).toEqual([
      "/usr/bin/pkexec",
      "/usr/bin/umount",
      "/media/u",
    ]);
  });

  test("a RELATIVE command path throws — pkexec resolves its polkit action by path", () => {
    expect(() => escalationArgv("pkexec", "dd", [], "/usr/bin/pkexec")).toThrow();
    expect(() => escalationArgv("sudo", "dd", [], "/usr/bin/sudo")).toThrow();
  });

  // The falsifier for the P1 (docs/BUGS.md 2026-08-24): the ELEVATOR half must be absolute
  // too. A bare name here is what let a `PATH` entry forge the whole escalation, so the
  // builder refuses it rather than trusting its caller to have resolved it.
  test("a BARE ELEVATOR NAME throws — a by-name elevator is PATH-forgeable", () => {
    expect(() => escalationArgv("sudo", "/usr/bin/dd", [], "sudo")).toThrow();
    expect(() => escalationArgv("pkexec", "/usr/bin/dd", [], "pkexec")).toThrow();
  });

  test("the elevator path is used VERBATIM — the argv never contains a bare name", () => {
    const argv = escalationArgv("sudo", "/usr/bin/dd", [], "/run/wrappers/bin/sudo");
    expect(argv[0]).toBe("/run/wrappers/bin/sudo");
    expect(argv).not.toContain("sudo");
  });
});

describe("ddArgs", () => {
  test("conv=fsync, so the exit status means the bytes reached the device", () => {
    expect(ddArgs("/tmp/zeta.iso", "/dev/sdb")).toEqual([
      "if=/tmp/zeta.iso",
      "of=/dev/sdb",
      "bs=4M",
      "conv=fsync",
      "status=progress",
    ]);
  });

  test("re-validates the device path even though selection already did", () => {
    expect(() => ddArgs("/tmp/zeta.iso", "/dev/sdb1")).toThrow();
    expect(() => ddArgs("/tmp/zeta.iso", "/dev/../etc/passwd")).toThrow();
  });
});

describe("unmountTargets", () => {
  test("deepest first — a nested mount must be released before its parent", () => {
    const d = dev({
      mountpoints: ["/media/u"],
      children: [dev({ type: "part", path: "/dev/sdb1", mountpoints: ["/media/u/data"] })],
    });
    expect(unmountTargets(d)).toEqual(["/media/u/data", "/media/u"]);
  });
  test("duplicates collapse, and an unmounted device yields nothing to do", () => {
    expect(unmountTargets(dev())).toEqual([]);
    const twice = dev({
      mountpoints: ["/media/u"],
      children: [dev({ type: "part", path: "/dev/sdb1", mountpoints: ["/media/u"] })],
    });
    expect(unmountTargets(twice)).toEqual(["/media/u"]);
  });
});

describe("human", () => {
  test("scales through the units the readout uses", () => {
    expect(human(0)).toBe("0.00 B");
    expect(human(32 * GiB)).toBe("32.00 GiB");
    expect(human(512 * MiB)).toBe("512.00 MiB");
  });
});
