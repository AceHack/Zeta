// src/Core.TypeScript/installer/boot-medium-verdict-shell-parity.test.ts
//
// 081M3B7Z38Q087G0R003F9X7HM, run 36870188468 -- falsifiers for
// `zeta_boot_medium_verdict` in zeta-first-boot.sh, run as BASH against the real
// function text with a FAKE sysfs tree. The function decides from
// /sys/class/block alone (the kernel's `partition` attribute and a disk's
// partition children) and never opens the device, because the case it exists
// for is the one where the device holds itself O_EXCL.
//
// The layouts below include the exact one the failed WP11 USB guest had:
// `/iso` mounted from `/dev/sda`, a whole disk with `sda1` (the LBA-0 alias of
// the iso9660) and `sda2` (the ESP) as children.
//
// What this does NOT prove: that a real kernel's sysfs has this shape on the
// ISO. It does (`partition` is documented sysfs ABI, and lsblk's PKNAME/START in
// the sibling ESP ladder already read the same tree); but this is a fixture, and
// the live proof is the guest printing the verdict on a built ISO.
//
// Like the sibling bash-parity suites it pins /bin/bash, so it runs on Linux and
// macOS. (A Windows dev host needs a /bin/bash shim; CI is Linux.)

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnShellDeclared } from "../io/safe-io.ts";

const FIRST_BOOT_SH = join(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh");

const BASH_TEST_TIMEOUT_MS = 30_000;

/** Slice one top-level shell function out of a script; a miss throws (never an empty function). */
function sliceShellFunction(rawSource: string, name: string): string {
  const source = rawSource.replace(/\r\n/gu, "\n");
  const start = source.indexOf(`${name}() {`);
  if (start < 0) throw new Error(`shell function ${name}() not found`);
  const end = source.indexOf("\n}\n", start);
  if (end < 0) throw new Error(`shell function ${name}() has no column-0 close`);
  return source.slice(start, end + 3);
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-boot-medium-verdict-"));
afterAll(() => rmSync(workdir, { recursive: true, force: true }));

/** Git Bash on a Windows dev host accepts C:/... paths; Linux and macOS pass through unchanged. */
function toShellPath(p: string): string {
  return process.platform === "win32" ? p.replaceAll("\\", "/") : p;
}

interface FakeSysfs {
  /** disk kernel name -> its partition kernel names (children dirs carry a `partition` file). */
  readonly disks: Readonly<Record<string, readonly string[]>>;
  /** Extra directories to create under /sys/class/block/<disk>/ (noise that must NOT count as a partition). */
  readonly noise?: Readonly<Record<string, readonly string[]>>;
}

let sysfsCounter = 0;
function makeSysfs(layout: FakeSysfs): string {
  const root = join(workdir, `sysfs-${sysfsCounter++}`, "class", "block");
  mkdirSync(root, { recursive: true });
  for (const [disk, parts] of Object.entries(layout.disks)) {
    mkdirSync(join(root, disk), { recursive: true });
    for (const part of parts) {
      // /sys/class/block/<disk>/<part>/partition  AND  /sys/class/block/<part>/partition
      mkdirSync(join(root, disk, part), { recursive: true });
      writeFileSync(join(root, disk, part, "partition"), "1\n");
      mkdirSync(join(root, part), { recursive: true });
      writeFileSync(join(root, part, "partition"), "1\n");
    }
    for (const n of layout.noise?.[disk] ?? []) mkdirSync(join(root, disk, n), { recursive: true });
  }
  return root;
}

interface Verdict {
  readonly verdict: string;
  readonly source: string;
  readonly partitionAttr: string;
  readonly partitions: string;
  readonly raw: string;
}

function verdictFor(source: string, sysfsRoot: string): Verdict {
  const fn = sliceShellFunction(readFileSync(FIRST_BOOT_SH, "utf8"), "zeta_boot_medium_verdict");
  const script = [
    "set -uo pipefail",
    `ZETA_SYS_CLASS_BLOCK='${toShellPath(sysfsRoot)}'`,
    fn,
    `zeta_boot_medium_verdict '${source}'`,
    'printf "\\nRC=%s\\n" "$?"',
  ].join("\n");
  const run = spawnShellDeclared("bash", script, {
    reason:
      "081M3B7Z38Q087G0R003F9X7HM: drives the SHIPPED zeta-first-boot.sh boot-medium verdict function " +
      "against a fake sysfs tree; the program is composed in-process from repo text and test literals.",
  });
  if (!run.ok) throw new Error(`verdict harness could not run bash: ${JSON.stringify(run.error)}`);
  const out = run.value.stdout;
  expect(out).toContain("RC=0"); // the function reports; it never fails the caller
  const line = out.split("\n")[0] ?? "";
  const kv = (k: string): string => new RegExp(`(?:^| )${k}=(\\S*)`, "u").exec(line)?.[1] ?? "";
  return {
    verdict: kv("verdict"),
    source: kv("source"),
    partitionAttr: kv("partition-attr"),
    partitions: kv("partitions"),
    raw: line,
  };
}

describe("zeta_boot_medium_verdict (081M3B7Z38Q087G0R003F9X7HM)", () => {
  test("the extractor fails loud rather than yielding an empty function", () => {
    expect(() => sliceShellFunction("echo hi\n", "zeta_boot_medium_verdict")).toThrow(/not found/u);
    const src = readFileSync(FIRST_BOOT_SH, "utf8");
    expect(sliceShellFunction(src, "zeta_boot_medium_verdict")).toContain("verdict=WHOLE-DISK-CLAIMED");
  });

  test(
    "THE FAILED RUN: /iso mounted from /dev/sda, a disk whose children are sda1 (LBA-0 alias) and sda2 (ESP) -> WHOLE-DISK-CLAIMED",
    () => {
      const root = makeSysfs({ disks: { sda: ["sda1", "sda2"] } });
      const v = verdictFor("/dev/sda", root);
      expect(v.verdict).toBe("WHOLE-DISK-CLAIMED");
      expect(v.source).toBe("/dev/sda");
      expect(v.partitionAttr).toBe("no");
      expect(v.partitions).toBe("2");
    },
    BASH_TEST_TIMEOUT_MS,
  );

  test(
    "the healthy run: /iso mounted from /dev/sda1 -> PARTITION (the kernel's own `partition` attribute)",
    () => {
      const root = makeSysfs({ disks: { sda: ["sda1", "sda2"] } });
      const v = verdictFor("/dev/sda1", root);
      expect(v.verdict).toBe("PARTITION");
      expect(v.source).toBe("/dev/sda1");
      expect(v.partitionAttr).toBe("yes");
    },
    BASH_TEST_TIMEOUT_MS,
  );

  test(
    "nvme naming: the namespace is whole-disk-claimed, the pN node is the partition",
    () => {
      const root = makeSysfs({ disks: { nvme0n1: ["nvme0n1p1", "nvme0n1p2"] } });
      expect(verdictFor("/dev/nvme0n1", root).verdict).toBe("WHOLE-DISK-CLAIMED");
      expect(verdictFor("/dev/nvme0n1p1", root).verdict).toBe("PARTITION");
    },
    BASH_TEST_TIMEOUT_MS,
  );

  test(
    "an optical drive (sr0, never partitioned by the kernel) is a whole disk with nothing to lock out -> WHOLE-DISK-UNPARTITIONED",
    () => {
      const root = makeSysfs({ disks: { sr0: [] } });
      const v = verdictFor("/dev/sr0", root);
      expect(v.verdict).toBe("WHOLE-DISK-UNPARTITIONED");
      expect(v.partitions).toBe("0");
    },
    BASH_TEST_TIMEOUT_MS,
  );

  test(
    "a plain iso9660 stick with no partition table is UNPARTITIONED, not claimed",
    () => {
      const root = makeSysfs({ disks: { sdb: [] } });
      expect(verdictFor("/dev/sdb", root).verdict).toBe("WHOLE-DISK-UNPARTITIONED");
    },
    BASH_TEST_TIMEOUT_MS,
  );

  test(
    "another disk's partitions are not this disk's: sda is UNPARTITIONED even though sdaa has sdaa1",
    () => {
      const root = makeSysfs({ disks: { sda: [], sdaa: ["sdaa1"] } });
      expect(verdictFor("/dev/sda", root).verdict).toBe("WHOLE-DISK-UNPARTITIONED");
      expect(verdictFor("/dev/sdaa", root).verdict).toBe("WHOLE-DISK-CLAIMED");
    },
    BASH_TEST_TIMEOUT_MS,
  );

  test(
    "a sysfs directory that merely STARTS with the disk's name is not a partition without the `partition` attribute",
    () => {
      const root = makeSysfs({ disks: { sda: [] }, noise: { sda: ["sda-stats", "sdaX"] } });
      expect(verdictFor("/dev/sda", root).verdict).toBe("WHOLE-DISK-UNPARTITIONED");
    },
    BASH_TEST_TIMEOUT_MS,
  );

  test(
    "nothing mounted at /iso -> NOT-MOUNTED; a source the kernel does not know -> UNRESOLVABLE (neither is a pass or a conviction)",
    () => {
      const root = makeSysfs({ disks: { sda: ["sda1"] } });
      expect(verdictFor("", root).verdict).toBe("NOT-MOUNTED");
      expect(verdictFor("/dev/mapper/nothing-here", root).verdict).toBe("UNRESOLVABLE");
    },
    BASH_TEST_TIMEOUT_MS,
  );
});

describe("the call site in zeta-first-boot.sh (081M3B7Z38Q087G0R003F9X7HM)", () => {
  const src = readFileSync(FIRST_BOOT_SH, "utf8").replace(/\r\n/gu, "\n");

  test("the verdict is printed on every boot, right after the scan line the harness already parses", () => {
    const scan = src.indexOf("[081M392JR97087G0R003QAFH0Y-esp-conf] esp-conf=");
    const verdict = src.indexOf('echo "[081M3B7Z38Q087G0R003F9X7HM-boot-medium] ${ZETA_BOOT_MEDIUM_VERDICT}"');
    expect(scan).toBeGreaterThan(0);
    expect(verdict).toBeGreaterThan(scan);
    // and it is computed from the same /iso source the scan line reports, not re-derived
    expect(src).toContain('zeta_boot_medium_verdict "${ZETA_ESP_BOOT_MEDIUM}"');
  });

  test("a whole-disk claim is LOUD but never exits: this script's header forbids `exit 1`", () => {
    const start = src.indexOf("*verdict=WHOLE-DISK-CLAIMED*)");
    const end = src.indexOf("esac", start);
    expect(start).toBeGreaterThan(0);
    const banner = src.slice(start, end);
    expect(banner).toContain("BOOT MEDIUM MOUNTED FROM ITS WHOLE DISK");
    expect(banner).not.toMatch(/^\s*exit\b/mu);
  });
});
