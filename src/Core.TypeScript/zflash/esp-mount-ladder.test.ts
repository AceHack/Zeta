// src/Core.TypeScript/zflash/esp-mount-ladder.test.ts
//
// 081M39CJP96087G0R001T4J2R3 (WP29) — falsifiers for the ESP read-only mount
// ladder, run as BASH against the real function text in zeta-install.sh.
//
// The mitigation is three `mount` attempts where there was one, and its whole
// value is in which attempt it accepts and what it records when it does not.
// Asserting that in TypeScript against a re-implementation would test the
// re-implementation; these tests extract the shipped shell function and drive
// it with stubbed `mount` / `findmnt` / `umount`, so a change to the script
// that breaks the ladder breaks these.
//
// What is deliberately NOT claimed here: that the ladder fixes anything. It is
// a mitigation for a kernel-side refusal whose cause is still unknown, and the
// work item stays open.

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
}

interface LadderOutcome {
  readonly status: number;
  readonly via: string;
  readonly why: string;
  /** Every `mount` argv the ladder issued, in order. */
  readonly mountCalls: readonly string[];
  readonly umounts: number;
}

/** Run the SHIPPED ladder from zeta-install.sh with mount/findmnt stubbed. */
function runLadder(scenario: LadderScenario): LadderOutcome {
  const src = readFileSync(INSTALL_SH, "utf8");
  const script = [
    "set -uo pipefail",
    'CALLS="$(mktemp)"',
    'UMOUNTS="$(mktemp)"',
    `MOUNT_STATUSES=(${scenario.mounts.map((m) => String(m.status)).join(" ")})`,
    `MOUNT_STDERRS=(${scenario.mounts.map((m) => `'${(m.stderr ?? "").replace(/'/gu, "")}'`).join(" ")})`,
    // `sudo` is a no-op passthrough so the shipped text runs unchanged.
    "sudo() { \"$@\"; }",
    // The ladder calls `mount` inside `$( )`, i.e. in a SUBSHELL, so a shell
    // variable counter would reset on every attempt and hand attempt 3 the
    // answer meant for attempt 1. The call log file is the counter.
    "mount() {",
    '  printf "%s\\n" "$*" >> "$CALLS"',
    '  local n; n=$(( $(wc -l < "$CALLS") - 1 ))',
    '  local s="${MOUNT_STATUSES[$n]}" e="${MOUNT_STDERRS[$n]}"',
    '  [ -n "$e" ] && printf "%s\\n" "$e" >&2',
    '  return "$s"',
    "}",
    'umount() { printf "x" >> "$UMOUNTS"; return 0; }',
    `findmnt() { ${scenario.fstype === undefined || scenario.fstype === "" ? "return 1" : `printf '%s\\n' '${scenario.fstype}'`}; }`,
    sliceShellFunction(src, "zeta_squeeze_mount_error"),
    sliceShellFunction(src, "zeta_mount_fat_ro"),
    "ZETA_FAT_MOUNT_VIA=''",
    "ZETA_FAT_MOUNT_WHY=''",
    "zeta_mount_fat_ro /dev/sda2 /run/probe",
    "rc=$?",
    'printf "STATUS=%s\\nVIA=%s\\nWHY=%s\\n" "$rc" "$ZETA_FAT_MOUNT_VIA" "$ZETA_FAT_MOUNT_WHY"',
    'printf "UMOUNTS=%s\\n" "$(wc -c < "$UMOUNTS" | tr -d " ")"',
    'while IFS= read -r line; do printf "MOUNTCALL=%s\\n" "$line"; done < "$CALLS"',
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
    });
    expect(got.status).toBe(1);
    expect(got.via).toBe("");
    expect(got.why).toContain("auto=mounted-as-iso9660-not-FAT");
    expect(got.umounts).toBe(1);
  }, BASH_TEST_TIMEOUT_MS);

  test("autodetect succeeds but the type CANNOT be confirmed — treated as failure, not as a pass", () => {
    const got = runLadder({
      mounts: [{ status: 32, stderr: "no vfat" }, { status: 0 }, { status: 32, stderr: "no vfat either" }],
      fstype: "",
    });
    expect(got.status).toBe(1);
    expect(got.why).toContain("auto=mounted-as-unknown-not-FAT");
    expect(got.umounts).toBe(1);
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

  test("all three refused: every attempt is named, and the reason stays SPACE-FREE", () => {
    // `espConfScanOutcome` parses `tried=(\S*)`. One space in this string
    // truncates the field and loses the rest of the device list — the WP27
    // scan output would go back to saying less than it knows.
    const got = runLadder({
      mounts: [
        { status: 32, stderr: "FAT-fs (sda2): IO charset iso8859-1 not found" },
        { status: 32, stderr: "mount: unknown filesystem type" },
        { status: 32, stderr: "FAT-fs (sda2): codepage cp437 not found" },
      ],
    });
    expect(got.status).toBe(1);
    expect(got.via).toBe("");
    expect(got.why).toContain("vfat=");
    expect(got.why).toContain("auto=");
    expect(got.why).toContain("ascii=");
    expect(got.why).not.toMatch(/\s/u);
    expect(got.why).toContain("IO_charset_iso8859-1_not_found");
    expect(got.mountCalls).toHaveLength(3);
  }, BASH_TEST_TIMEOUT_MS);

  test("a mount that fails with NO stderr still records something falsifiable", () => {
    const got = runLadder({ mounts: [{ status: 1 }, { status: 1 }, { status: 1 }] });
    expect(got.status).toBe(1);
    expect(got.why).toBe("vfat=no-stderr|auto=no-stderr|ascii=no-stderr");
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
  }, BASH_TEST_TIMEOUT_MS);
});
