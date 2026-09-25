// src/Core.TypeScript/zflash/esp-mount-ladder.test.ts
//
// 081M39CJP96087G0R001T4J2R3 (WP29) — falsifiers for the ESP read-only mount
// ladder, run as BASH against the real function text in zeta-install.sh.
//
// Four attempts where there was one, and the value is in which attempt the
// ladder accepts and what it records when it does not. Asserting that in
// TypeScript against a re-implementation would test the re-implementation;
// these tests extract the SHIPPED shell functions and drive them with stubbed
// `mount` / `findmnt` / `lsblk` / `mcopy` / `umount`, so a change to the
// script that breaks the ladder breaks these.
//
// Rungs 1-3 are a mitigation; rung 4 is a fix for a now-MEASURED cause. The
// boot medium is mounted from the WHOLE DISK on some boots (an isohybrid
// partition 1 starts at LBA 0 and carries the same label as the disk, so
// `by-label` resolves to whichever udev processed last), that mount holds the
// device O_EXCL, and every partition of it is then unopenable for the rest of
// the install. Rungs 1-3 all open the partition and all lose. Rung 4 reads the
// ESP through the whole disk at a DERIVED offset and never opens it.
//
// Rung 4 is also verified end to end against a real isohybrid image with the
// claim actually held — these unit falsifiers pin the decision logic, not the
// claim that it works on a real device.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnShellDeclared } from "../io/safe-io.ts";

const INSTALL_SH = join(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh");
const FIRST_BOOT_SH = join(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh");

/**
 * Slice one top-level shell function out of a script by name.
 *
 * Top-level here means the closing brace is in column 0, which is how both
 * scripts are written. A miss throws rather than returning "" — an extractor
 * that silently yields nothing would make every test below pass against an
 * empty function, which is the vacuity class wearing a test harness.
 */
export function sliceShellFunction(rawSource: string, name: string): string {
  // Line endings are normalised first: a CRLF checkout would otherwise make
  // every slice miss its column-0 close, and every test below would fail for
  // a reason that has nothing to do with the ladder.
  const source = rawSource.replace(/\r\n/gu, "\n");
  const start = source.indexOf(`${name}() {`);
  if (start < 0) throw new Error(`shell function ${name}() not found`);
  const end = source.indexOf("\n}\n", start);
  if (end < 0) throw new Error(`shell function ${name}() has no column-0 close`);
  return source.slice(start, end + 3);
}

interface LadderScenario {
  /** Exit status + stderr for each `mount` invocation, in order. */
  readonly mounts: readonly { readonly status: number; readonly stderr?: string }[];
  /** What `findmnt -n -o FSTYPE` prints (empty string = findmnt fails). */
  readonly fstype?: string;
  /** `lsblk -bno START` — the partition's first sector. "" = unreadable. */
  readonly start?: string;
  /** `lsblk -bno PKNAME` — the parent whole disk. "" = unreadable. */
  readonly pkname?: string;
  /** Exit status of rung 4's `mcopy` copy-out (default 0 = the ESP was read). */
  readonly mcopyStatus?: number;
}

interface LadderOutcome {
  readonly status: number;
  readonly via: string;
  readonly why: string;
  /** Every `mount` argv the ladder issued, in order. */
  readonly mountCalls: readonly string[];
  readonly umounts: number;
  /** Every `mcopy` argv rung 4 issued. Empty when it never got that far. */
  readonly mcopyCalls: readonly string[];
}

/** Run the SHIPPED ladder from zeta-install.sh with mount/findmnt stubbed. */
function runLadder(scenario: LadderScenario): LadderOutcome {
  const src = readFileSync(INSTALL_SH, "utf8");
  const script = [
    "set -uo pipefail",
    'CALLS="$(mktemp)"',
    'UMOUNTS="$(mktemp)"',
    'MCOPIES="$(mktemp)"',
    'MOUNTN="$(mktemp)"',
    `MOUNT_STATUSES=(${scenario.mounts.map((m) => String(m.status)).join(" ")})`,
    // Apostrophes are escaped for the shell, not deleted: `Can't open blockdev`
    // is the exact wording util-linux uses, and a harness that quietly turns it
    // into `Cant` cannot assert on the string the guest will actually print.
    `MOUNT_STDERRS=(${scenario.mounts.map((m) => `'${(m.stderr ?? "").replace(/'/gu, "'\\''")}'`).join(" ")})`,
    // `sudo` is a no-op passthrough so the shipped text runs unchanged.
    "sudo() { \"$@\"; }",
    // The ladder calls `mount` inside `$( )`, i.e. in a SUBSHELL, so a shell
    // variable counter would reset on every attempt and hand attempt 3 the
    // answer meant for attempt 1. The call log file is the counter.
    "mount() {",
    '  printf "%s\\n" "$*" >> "$CALLS"',
    // rung 4 mounts a tmpfs at the caller's mountpoint to hold the copy-out.
    // That is not one of the scripted partition attempts, so it must neither
    // consume a scripted status nor fail, or rung 4 could never be exercised.
    '  case "$*" in *tmpfs*) return 0 ;; esac',
    '  printf "x\\n" >> "$MOUNTN"',
    '  local n; n=$(( $(wc -l < "$MOUNTN") - 1 ))',
    // Past the end of the scripted list is a REFUSAL, never an unbound-array
    // abort: under `set -u` that would kill the harness mid-run and every
    // field would parse to empty — the exact failure this file exists to
    // refuse, and it bit this harness once already.
    '  if [ "$n" -ge "${#MOUNT_STATUSES[@]}" ]; then return 32; fi',
    '  local s="${MOUNT_STATUSES[$n]}" e="${MOUNT_STDERRS[$n]}"',
    '  [ -n "$e" ] && printf "%s\\n" "$e" >&2',
    '  return "$s"',
    "}",
    'umount() { printf "x" >> "$UMOUNTS"; return 0; }',
    `findmnt() { ${scenario.fstype === undefined || scenario.fstype === "" ? "return 1" : `printf '%s\\n' '${scenario.fstype}'`}; }`,
    // rung 4 reads the partition geometry out of SYSFS via lsblk, which is the
    // whole point: the partition cannot be opened, and sysfs does not need it
    // to be.
    "lsblk() {",
    '  case "$*" in',
    `    *START*) ${scenario.start === undefined ? `printf '268\n'` : scenario.start === "" ? "return 1" : `printf '%s\n' '${scenario.start}'`} ;;`,
    `    *PKNAME*) ${scenario.pkname === undefined ? `printf 'sda\n'` : scenario.pkname === "" ? "return 1" : `printf '%s\n' '${scenario.pkname}'`} ;;`,
    '    *) return 1 ;;',
    "  esac",
    "}",
    "mcopy() {",
    '  printf "%s\n" "$*" >> "$MCOPIES"',
    `  ${(scenario.mcopyStatus ?? 0) === 0 ? `printf "Could not get geometry of device\n" >&2; return 0` : `printf "init ::: non DOS media\n" >&2; return ${String(scenario.mcopyStatus)}`}`,
    "}",
    sliceShellFunction(src, "zeta_squeeze_mount_error"),
    sliceShellFunction(src, "zeta_esp_copy_out_mtools"),
    sliceShellFunction(src, "zeta_mount_fat_ro"),
    "ZETA_FAT_MOUNT_VIA=''",
    "ZETA_FAT_MOUNT_WHY=''",
    "zeta_mount_fat_ro /dev/sda2 /run/probe",
    "rc=$?",
    'printf "STATUS=%s\\nVIA=%s\\nWHY=%s\\n" "$rc" "$ZETA_FAT_MOUNT_VIA" "$ZETA_FAT_MOUNT_WHY"',
    'printf "UMOUNTS=%s\\n" "$(wc -c < "$UMOUNTS" | tr -d " ")"',
    'while IFS= read -r line; do printf "MOUNTCALL=%s\\n" "$line"; done < "$CALLS"',
    'while IFS= read -r line; do printf "MCOPYCALL=%s\\n" "$line"; done < "$MCOPIES"',
  ].join("\n");

  // `spawnShellDeclared` and not a raw `bash -c`: here the command line
  // genuinely IS the contract — the "program" is the shipped shell function
  // text plus stubs, and there is nothing to turn into an argv. Going through
  // the declared primitive keeps the reason a VALUE rather than a comment, so
  // every deliberate shell in the tree stays enumerable
  // (lint-hand-rolled-io / io/safe-io.ts).
  //
  // Note it pins `/bin/bash`, so this suite runs on Linux and macOS and not on
  // a Windows dev host — the same limit the repo's other bash-parity suites
  // already carry. That is a worse local signal and a better primitive, and
  // "it runs on my machine" is not a reason to route around a security lint.
  const run = spawnShellDeclared("bash", script, {
    reason:
      "081M39CJP96087G0R001T4J2R3: drives the SHIPPED zeta-install.sh mount ladder under stubbed " +
      "mount/findmnt/umount. The script is composed in-process from repo text and test literals; " +
      "there is no argv form of 'run this synthesized shell program'.",
  });
  // Loud, not lenient: an unspawnable shell would otherwise parse to empty
  // strings in every field and fail these tests with the wrong story.
  if (!run.ok) throw new Error(`ladder harness could not run bash: ${JSON.stringify(run.error)}`);
  if (run.value.truncated) throw new Error("ladder harness output was truncated; the assertions below would be partial");
  const out = run.value.stdout;
  const field = (key: string): string => new RegExp(`^${key}=(.*)$`, "mu").exec(out)?.[1] ?? "";
  return {
    status: Number(field("STATUS")),
    via: field("VIA"),
    why: field("WHY"),
    mountCalls: [...out.matchAll(/^MOUNTCALL=(.*)$/gmu)].map((m) => m[1] ?? ""),
    mcopyCalls: [...out.matchAll(/^MCOPYCALL=(.*)$/gmu)].map((m) => m[1] ?? ""),
    umounts: Number(field("UMOUNTS") || "0"),
  };
}

/**
 * Each of these spawns `bash` at least once. Measured at 15-24 ms per test on
 * Linux, so Bun's 5 s default is ample — this is headroom for a loaded runner,
 * not a workaround. A suite that goes red under load teaches people to ignore
 * it, and an ignored falsifier is not one.
 */
const BASH_TEST_TIMEOUT_MS = 30_000;

describe("ESP read-only mount ladder (081M39CJP96087G0R001T4J2R3)", () => {
  test("the extractor fails loud rather than yielding an empty function", () => {
    const src = readFileSync(INSTALL_SH, "utf8");
    expect(() => sliceShellFunction(src, "zeta_no_such_function")).toThrow("not found");
    expect(sliceShellFunction(src, "zeta_mount_fat_ro")).toContain("iocharset=ascii,codepage=437");
  }, BASH_TEST_TIMEOUT_MS);

  test("attempt 1 succeeding is the healthy shape: one mount, via=vfat, nothing recorded", () => {
    const got = runLadder({ mounts: [{ status: 0 }] });
    expect(got.status).toBe(0);
    expect(got.via).toBe("vfat");
    expect(got.why).toBe("");
    expect(got.mountCalls).toEqual(["-t vfat -o ro /dev/sda2 /run/probe"]);
    expect(got.umounts).toBe(0);
  }, BASH_TEST_TIMEOUT_MS);

  test("attempt 1 refused, autodetect lands on FAT: mounted, and the refusal is KEPT", () => {
    // The mitigation firing must never look like a healthy run — `via` is what
    // tells a reader that plain `mount -t vfat` was refused on this boot.
    const got = runLadder({
      mounts: [{ status: 32, stderr: "mount: /run/probe: wrong fs type, bad option, bad superblock" }, { status: 0 }],
      fstype: "vfat",
    });
    expect(got.status).toBe(0);
    expect(got.via).toBe("auto-vfat");
    expect(got.via).not.toBe("vfat");
    expect(got.why).toContain("vfat=");
    expect(got.why).toContain("wrong_fs_type");
    expect(got.mountCalls).toHaveLength(2);
    expect(got.mountCalls[1]).toBe("-o ro /dev/sda2 /run/probe");
  }, BASH_TEST_TIMEOUT_MS);

  test("autodetect that mounts a NON-FAT filesystem is unmounted and refused", () => {
    // This loop walks iso9660 partitions too. Accepting whatever autodetect
    // mounts would let the probe read a firstboot conf off the wrong
    // filesystem, so a non-FAT success is a failure with an extra umount.
    const got = runLadder({
      mounts: [{ status: 32, stderr: "no vfat" }, { status: 0 }, { status: 32, stderr: "no vfat either" }],
      fstype: "iso9660",
      // Rung 4 disabled: this test is about attempt 2's FAT confirmation, and
      // a rung that rescues the call would hide the refusal being asserted.
      mcopyStatus: 1,
    });
    expect(got.status).toBe(1);
    expect(got.via).toBe("");
    expect(got.why).toContain("auto=mounted-as-iso9660-not-FAT");
    // Two umounts: attempt 2's non-FAT mount, and rung 4's own tmpfs after its
    // copy-out was refused. Neither may be left behind shadowing the caller's
    // mountpoint.
    expect(got.umounts).toBe(2);
  }, BASH_TEST_TIMEOUT_MS);

  test("autodetect succeeds but the type CANNOT be confirmed — treated as failure, not as a pass", () => {
    const got = runLadder({
      mounts: [{ status: 32, stderr: "no vfat" }, { status: 0 }, { status: 32, stderr: "no vfat either" }],
      fstype: "",
      mcopyStatus: 1,
    });
    expect(got.status).toBe(1);
    expect(got.why).toContain("auto=mounted-as-unknown-not-FAT");
    expect(got.umounts).toBe(2);
  }, BASH_TEST_TIMEOUT_MS);

  test("charset attempt is what a missing NLS module would need, and it is tried LAST", () => {
    const got = runLadder({
      mounts: [
        { status: 32, stderr: "mount: /run/probe: wrong fs type" },
        { status: 32, stderr: "mount: /run/probe: can't read superblock" },
        { status: 0 },
      ],
    });
    expect(got.status).toBe(0);
    expect(got.via).toBe("vfat-ascii");
    expect(got.mountCalls[2]).toBe("-t vfat -o ro,iocharset=ascii,codepage=437 /dev/sda2 /run/probe");
  }, BASH_TEST_TIMEOUT_MS);

  test("all three MOUNTS refused: every attempt is named, and the reason stays SPACE-FREE", () => {
    // `espConfScanOutcome` parses `tried=(\S*)`. One space in this string
    // truncates the field and loses the rest of the device list — the WP27
    // scan output would go back to saying less than it knows.
    const got = runLadder({
      mounts: [
        { status: 32, stderr: "FAT-fs (sda2): IO charset iso8859-1 not found" },
        { status: 32, stderr: "mount: unknown filesystem type" },
        { status: 32, stderr: "FAT-fs (sda2): codepage cp437 not found" },
      ],
      // Rung 4 disabled so the ladder genuinely exhausts; it has its own tests.
      mcopyStatus: 1,
    });
    expect(got.status).toBe(1);
    expect(got.via).toBe("");
    expect(got.why).toContain("vfat=");
    expect(got.why).toContain("auto=");
    expect(got.why).toContain("ascii=");
    expect(got.why).toContain("mtools=");
    expect(got.why).not.toMatch(/\s/u);
    expect(got.why).toContain("IO_charset_iso8859-1_not_found");
    // Four: the three partition attempts, then rung 4's tmpfs for the copy-out.
    expect(got.mountCalls).toHaveLength(4);
    expect(got.mountCalls[3]).toContain("tmpfs");
  }, BASH_TEST_TIMEOUT_MS);

  test("a mount that fails with NO stderr still records something falsifiable", () => {
    const got = runLadder({ mounts: [{ status: 1 }, { status: 1 }, { status: 1 }], mcopyStatus: 1 });
    expect(got.status).toBe(1);
    expect(got.why).toBe("vfat=no-stderr|auto=no-stderr|ascii=no-stderr|mtools=init_:::_non_DOS_media");
  }, BASH_TEST_TIMEOUT_MS);


  test("RUNG 4 carries it when the partition cannot be opened at all (081M39CJP96087G0R001T4J2R3)", () => {
    // The measured root cause: the boot medium is mounted from the WHOLE DISK,
    // which holds it O_EXCL, so every partition of it is unopenable for the
    // rest of the install. Rungs 1-3 all open the partition and all lose.
    // Rung 4 reads the ESP through the whole disk at a DERIVED offset and
    // never opens the partition, so the claim does not block it.
    //
    // Verified against the shipped function on a real isohybrid image with the
    // claim actually held (`mount <wholedisk>` + loop device), not only here.
    const ebusy = "mount: /run/probe: /dev/sda2 already mounted or mount point busy.";
    const got = runLadder({
      mounts: [{ status: 32, stderr: ebusy }, { status: 32, stderr: ebusy }, { status: 32, stderr: ebusy }],
      start: "268",
      pkname: "sda",
    });
    expect(got.status).toBe(0);
    expect(got.via).toBe("mtools-copy:/dev/sda@@137216");
    // 268 sectors x 512. Derived from sysfs, never a constant — the constant
    // that could not disagree with itself is what started this work item.
    expect(got.mcopyCalls).toEqual(["-s -n -o -i /dev/sda@@137216 ::/ /run/probe/"]);
    // A tmpfs was mounted at the caller's mountpoint to hold the copy, so the
    // caller's own `umount` still cleans up and no consumer changes.
    expect(got.mountCalls[3]).toBe("-t tmpfs -o size=16m,mode=0700 zeta-esp-copyout /run/probe");
    expect(got.umounts).toBe(0);
  }, BASH_TEST_TIMEOUT_MS);

  test("rung 4 REFUSES an unreadable partition start rather than guessing an offset", () => {
    const got = runLadder({
      mounts: [{ status: 32 }, { status: 32 }, { status: 32 }],
      start: "",
    });
    expect(got.status).toBe(1);
    expect(got.via).toBe("");
    expect(got.why).toContain("mtools=no-partition-start-in-sysfs");
    expect(got.mcopyCalls).toEqual([]);
  }, BASH_TEST_TIMEOUT_MS);

  test("rung 4 REFUSES a partition that starts at LBA 0 — that is the whole-disk alias", () => {
    // An isohybrid partition 1 starts at LBA 0 and spans the whole image. It
    // is the same iso9660 the disk itself exposes, not an ESP, and `@@0` would
    // be meaningless. Reproduced against the shipped function on a real image.
    const got = runLadder({
      mounts: [{ status: 32 }, { status: 32 }, { status: 32 }],
      start: "0",
    });
    expect(got.status).toBe(1);
    expect(got.why).toContain("mtools=start-lba-0-not-a-partition");
    expect(got.mcopyCalls).toEqual([]);
  }, BASH_TEST_TIMEOUT_MS);

  test("rung 4 REFUSES when the parent disk cannot be resolved", () => {
    const got = runLadder({
      mounts: [{ status: 32 }, { status: 32 }, { status: 32 }],
      pkname: "",
    });
    expect(got.status).toBe(1);
    expect(got.why).toContain("mtools=no-parent-disk-in-sysfs");
    expect(got.mcopyCalls).toEqual([]);
  }, BASH_TEST_TIMEOUT_MS);

  test("rung 4 unmounts its own tmpfs when the copy-out fails, and keeps mcopy's words", () => {
    // A non-FAT offset makes mcopy exit non-zero, so a successful copy-out is
    // itself evidence that a real FAT lives at the derived offset. The failure
    // path must not leave a tmpfs shadowing the caller's mountpoint.
    const got = runLadder({
      mounts: [{ status: 32 }, { status: 32 }, { status: 32 }],
      mcopyStatus: 1,
    });
    expect(got.status).toBe(1);
    expect(got.via).toBe("");
    expect(got.why).toContain("mtools=init_:::_non_DOS_media");
    expect(got.umounts).toBe(1);
  }, BASH_TEST_TIMEOUT_MS);

  test("rung 4 is NOT reached when an earlier rung works — it is a last resort", () => {
    const got = runLadder({ mounts: [{ status: 0 }] });
    expect(got.via).toBe("vfat");
    expect(got.mcopyCalls).toEqual([]);
  }, BASH_TEST_TIMEOUT_MS);

  test("the squeeze drops util-linux's mountpoint prefix and keeps the kernel's answer", () => {
    // Measured on run 36073981145: the 64-char cap spent 36 characters on
    // `mount:_/run/zeta-boot-esp:_` and cut the answer at `Can_t_o`. The
    // mountpoint is ours and constant; the tail is the evidence.
    const got = runLadder({
      mounts: [
        { status: 32, stderr: "mount: /run/probe: fsconfig system call failed: /dev/sda2: Can't open blockdev." },
        { status: 32 },
        { status: 32 },
      ],
      mcopyStatus: 1,
    });
    expect(got.why).toContain("vfat=fsconfig_system_call_failed:_/dev/sda2:_Can_t_open_blockdev.");
    expect(got.why).not.toContain("/run/probe");
  }, BASH_TEST_TIMEOUT_MS);

  test("zeta-first-boot.sh carries the same ladder — the two probes must not diverge", () => {
    // iter-4.2 mounting via the mitigation while the first-boot scan still
    // gives up on attempt 1 would produce exactly the split-brain this work
    // item is about: one reader finds the ESP and the next reports (no-vfat).
    const firstBoot = sliceShellFunction(readFileSync(FIRST_BOOT_SH, "utf8"), "zeta_try_mount_esp_ro");
    for (const attempt of ["-t vfat -o ro", "mount -o ro", "iocharset=ascii,codepage=437"]) {
      expect(firstBoot).toContain(attempt);
    }
    expect(firstBoot).toContain("findmnt");
    expect(firstBoot).toContain("not-FAT");
    expect(firstBoot).toContain("zeta_esp_copy_out_mtools");
    const firstBootRung4 = sliceShellFunction(readFileSync(FIRST_BOOT_SH, "utf8"), "zeta_esp_copy_out_mtools");
    for (const piece of ["lsblk -bno START", "lsblk -bno PKNAME", "mcopy -s -n -o -i", "start-lba-0-not-a-partition"]) {
      expect(firstBootRung4).toContain(piece);
    }
  }, BASH_TEST_TIMEOUT_MS);
});
