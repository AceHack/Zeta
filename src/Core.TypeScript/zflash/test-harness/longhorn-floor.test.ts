/**
 * 081M3CAJD7J087G0R0021H6WRS (WP35) — falsifiers for the two decisions that keep
 * scenarios 3 and 4 (reformat-with-retention, path-fork migrate-vs-fresh) able to
 * install at all, and able to fail fast when they cannot.
 *
 * THE DEFECT THESE PIN. #17616 added a pre-wipe root-floor refusal to
 * `zeta-install.sh`: a boot disk that cannot hold ESP + root floor + a 1 GiB minimum
 * longhorn1 tail is refused before anything is wiped. The plain-install lanes were
 * unblocked twice (staged override in #17618, then a disk that genuinely fits in
 * #17631). These two lanes were unblocked neither time, so they refused on their
 * 20 GiB disk and then dead-waited the full 1,800,000 ms marker timeout — measured on
 * run 36097366591, ~55 runner-minutes per dispatch.
 *
 * Two independent things had to be true for that to cost half an hour rather than
 * three minutes, so there are two groups of tests below: the override must be staged,
 * AND a first-boot failure must be audible to the wait loop.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  harnessDiskNeedsLonghornOverride,
  INSTALLER_PRE_WIPE_FLOOR_GIB,
} from "./run";
import { DEFAULT_DISK_SIZE_GB } from "./qemu-state";
import {
  FIRST_BOOT_INSTALL_FAILED_TERMINAL_MARKER,
  RETENTION_ABSENT_TERMINAL_MARKERS,
  serialFirstBootInProgress,
} from "./serial-markers";

const INSTALLER_DIR = join(import.meta.dir, "../../../../full-ai-cluster/usb-nixos-installer");
const ZETA_INSTALL_SH = readFileSync(join(INSTALLER_DIR, "zeta-install.sh"), "utf8");
const ZETA_FIRST_BOOT_SH = readFileSync(join(INSTALLER_DIR, "zeta-first-boot.sh"), "utf8");

function shellConstant(source: string, name: string): number {
  const match = new RegExp(`^${name}=(\\d+)$`, "m").exec(source);
  if (match?.[1] === undefined) {
    throw new Error(`${name} not found as a bare integer assignment in zeta-install.sh`);
  }
  return Number.parseInt(match[1], 10);
}

describe("081M3CAJD7J087G0R0021H6WRS — the pre-wipe floor is READ from the installer, not guessed", () => {
  test("INSTALLER_PRE_WIPE_FLOOR_GIB equals the installer's own ESP + root floor + minimum tail", () => {
    // The refusal's own arithmetic, from zeta-install.sh:
    //   need >= ZETA_ESP_GIB + ZETA_ROOT_FLOOR_GIB + 1
    const esp = shellConstant(ZETA_INSTALL_SH, "ZETA_ESP_GIB");
    const rootFloor = shellConstant(ZETA_INSTALL_SH, "ZETA_ROOT_FLOOR_GIB");
    const minTail = shellConstant(ZETA_INSTALL_SH, "ZETA_LONGHORN_MIN_TAIL_GIB");

    expect(INSTALLER_PRE_WIPE_FLOOR_GIB).toBe(esp + rootFloor + minTail);
  });

  test("the refusal that fires below the floor still names the override this harness stages", () => {
    // If the installer ever renames the variable, staging the old name would be a
    // check that cannot pass — silently back to a 30-minute dead wait.
    expect(ZETA_INSTALL_SH).toContain('"${ZETA_ALLOW_LONGHORN_UNDERSIZED:-}" == "1"');
  });
});

describe("081M3CAJD7J087G0R0021H6WRS — the override is DERIVED from the disk, so it disarms itself", () => {
  test("the harness's own 20 GiB disk is below the floor and therefore needs the override", () => {
    expect(DEFAULT_DISK_SIZE_GB).toBeLessThan(INSTALLER_PRE_WIPE_FLOOR_GIB);
    expect(harnessDiskNeedsLonghornOverride()).toBe(true);
  });

  test("a disk exactly at the floor does NOT take the override", () => {
    // The boundary is the whole point: `bail` fires when the auto tail would be < 1 GiB,
    // i.e. strictly below ESP + root floor + 1. At the floor the install proceeds
    // honestly, so the override must switch itself off rather than persist as debt.
    expect(harnessDiskNeedsLonghornOverride(INSTALLER_PRE_WIPE_FLOOR_GIB)).toBe(false);
    expect(harnessDiskNeedsLonghornOverride(INSTALLER_PRE_WIPE_FLOOR_GIB - 1)).toBe(true);
  });

  test("the plain-install lanes' 1400 GiB disk would not take the override — the two lanes really do diverge", () => {
    // Cross-check against WP27's constant rather than restating it: these lanes take
    // the override BECAUSE their disk is small, not as a blanket CI concession. If
    // someone ever points this harness at the big disk, the override goes away.
    const fullInstall = readFileSync(join(import.meta.dir, "../../ci/qemu-full-install-test.ts"), "utf8");
    const match = /^const QEMU_DISK_SIZE_GB = (\d+);$/m.exec(fullInstall);
    expect(match?.[1]).toBeDefined();
    const plainInstallDiskGb = Number.parseInt(match?.[1] ?? "0", 10);

    expect(plainInstallDiskGb).toBeGreaterThanOrEqual(INSTALLER_PRE_WIPE_FLOOR_GIB);
    expect(harnessDiskNeedsLonghornOverride(plainInstallDiskGb)).toBe(false);
  });
});

describe("081M3CAJD7J087G0R0021H6WRS — a failed first boot is AUDIBLE instead of a 30-minute silence", () => {
  test("the terminal marker is a substring of the line zeta-first-boot.sh actually emits", () => {
    // Pinned to the emitter's format string. A marker nothing prints is the vacuity
    // class: it looks like a fail-fast and can never fire.
    expect(ZETA_FIRST_BOOT_SH).toContain('echo "[zeta-first-boot] Install failed (rc=$ZETA_INSTALL_RC).');
    expect(`[zeta-first-boot] Install failed (rc=1). See output above.`).toContain(
      FIRST_BOOT_INSTALL_FAILED_TERMINAL_MARKER,
    );
  });

  test("it is carried in the terminal list all three lanes share", () => {
    expect(RETENTION_ABSENT_TERMINAL_MARKERS).toContain(FIRST_BOOT_INSTALL_FAILED_TERMINAL_MARKER);
  });

  test("THE REPLAY: the serial output measured on run 36097366591 trips it, and the old marker could not", () => {
    // Verbatim shape of the captured scenario-3 serial log, trimmed to the lines that
    // decide the question. The two facts that made it a dead wait are both here:
    // first-boot IS in progress (so `nixos@zeta-installer:~` is suppressed), and the
    // install has nonetheless already lost.
    const measured = [
      "[3/3] Running zeta-install control-plane (non-interactive) ...",
      "Internal storage devices (fixed; USB and hot-plug bays excluded):",
      "  /dev/vda              HDD        20G    serial=",
      "ERROR: BOOT disk /dev/vda is 20 GiB, which cannot hold ESP 1 GiB + root floor 120 GiB",
      "[zeta-first-boot] Install failed (rc=1). See output above.",
      "[zeta-first-boot] Dropping to interactive shell.",
      "nixos@zeta-installer:~]$",
    ].join("\n");

    // Why it used to hang: the only terminal marker present was the shell prompt, and
    // the wait loop suppresses that one while first boot is in progress.
    expect(serialFirstBootInProgress(measured)).toBe(true);
    expect(measured).toContain("nixos@zeta-installer:~");

    // Why it now stops: the new marker is not suppressed and is unambiguously terminal.
    const tripped = RETENTION_ABSENT_TERMINAL_MARKERS.filter((marker) => measured.includes(marker));
    expect(tripped).toContain(FIRST_BOOT_INSTALL_FAILED_TERMINAL_MARKER);
  });

  test("a healthy in-progress install does NOT trip it", () => {
    // The falsifier's other half: a marker that fires on a passing run would trade a
    // dead wait for a false red, which is strictly worse.
    const healthy = [
      "[3/3] Running zeta-install control-plane (non-interactive) ...",
      "nixos@zeta-installer:~]$",
      "Partitioning /dev/vda ...",
    ].join("\n");

    expect(serialFirstBootInProgress(healthy)).toBe(true);
    expect(healthy).not.toContain(FIRST_BOOT_INSTALL_FAILED_TERMINAL_MARKER);
  });

  test("the pre-wipe CANCELLED path is not swept up with it", () => {
    // rc=10 is a deliberate operator cancel at the pre-wipe window and has its own
    // line; it must not be matched by the failure marker.
    const cancelled = "[zeta-first-boot] CANCELLED at the pre-wipe window. Nothing was wiped.";
    expect(cancelled).not.toContain(FIRST_BOOT_INSTALL_FAILED_TERMINAL_MARKER);
    expect(ZETA_FIRST_BOOT_SH).toContain('"$ZETA_INSTALL_RC" = "10"');
  });
});
