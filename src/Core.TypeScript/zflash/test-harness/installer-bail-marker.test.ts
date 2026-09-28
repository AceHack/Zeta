// 081M3K1K24B087G0R003XXKEMX — the installer's fatal-refusal line is a FAILURE
// MARKER in both QEMU harnesses, and the marker is derived from what `bail()`
// actually prints rather than from its name.
//
// THE DEFECT. Both harnesses carried the literal marker "bail". The installer's
// `bail()` prints `ERROR: <reason>` and exits 1 — it never prints the word
// "bail". So that marker could not catch the thing it was named for (zero true
// positives) and was pure false-positive surface: any healthy line that happens
// to contain the substring "bail" (a store path, a retry message) would kill a
// good install. `ci/qemu-full-install-test.ts` recorded this as STILL SUSPECT;
// work item 081M3JG8ZRN087G0R00001RG0J noted it again.
//
// THE FIX, AND WHY IT IS LINE-ANCHORED. Markers are substring-scanned over the
// whole serial log. A bare "ERROR: " would match the installer's NON-fatal lines
// too — `      PROBE ERROR: ...` (a failure-closed disk probe the installer
// survives) and `[iter-5.4.1]   ERROR: ...` (a registration refusal after the
// install is already on disk). `bail()` is the only emitter that puts
// `ERROR: ` at the START of a line, so the marker is `\nERROR: `.
//
// The bail prefix is READ from zeta-install.sh, not restated here, so if bail()
// ever changes what it prints this test goes red instead of the marker going
// silently blind again.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FULL_INSTALL_FAILURE_MARKERS } from "../../ci/qemu-full-install-test.ts";
import { INSTALLER_BAIL_SERIAL_MARKER, RETENTION_FAILURE_SERIAL_MARKERS } from "./serial-markers";

const REPO_ROOT = resolve(import.meta.dir, "../../../..");
const INSTALLER = readFileSync(resolve(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh"), "utf8");

/** What `bail()` prints before its argument, read from the installer's own definition. */
function bailPrefix(): string {
  const m = /^bail\(\)\s*\{\s*echo "([^"$]*)\$\*"/m.exec(INSTALLER);
  if (m === null || m[1] === undefined) throw new Error("zeta-install.sh no longer defines bail() as `echo \"<prefix>$*\"`");
  return m[1];
}

/** First marker of `markers` found in `serial`, or undefined — the harnesses' own scan shape. */
function firstMatch(serial: string, markers: readonly string[]): string | undefined {
  return markers.find((marker) => serial.includes(marker));
}

const HEALTHY_PREFIX = [
  "[iter-5.1] nixos-install starting",
  "  /nix/store/abc-unit-panic-on-fail.service.drv",
  "",
].join("\n");

const LISTS: readonly (readonly [string, readonly string[]])[] = [
  ["ci/qemu-full-install-test.ts FAILURE_MARKERS", FULL_INSTALL_FAILURE_MARKERS],
  ["zflash RETENTION_FAILURE_SERIAL_MARKERS", RETENTION_FAILURE_SERIAL_MARKERS],
];

describe("installer bail() line is a failure marker in both QEMU harnesses", () => {
  test("the marker is derived from bail()'s real output", () => {
    expect(INSTALLER_BAIL_SERIAL_MARKER).toBe(`\n${bailPrefix()}`);
  });

  for (const [name, markers] of LISTS) {
    test(`${name}: a real bail line stops the run`, () => {
      // Real bail reason, measured on run 36097366591 (scenario 3/4 serial).
      const serial = `${HEALTHY_PREFIX}${bailPrefix()}BOOT disk /dev/vda is 20 GiB, which cannot hold ESP ...\n`;
      expect(firstMatch(serial, markers)).toBe(INSTALLER_BAIL_SERIAL_MARKER);
    });

    test(`${name}: survives CRLF serial line endings`, () => {
      const serial = `${HEALTHY_PREFIX}\r\n${bailPrefix()}not booted in UEFI mode\r\n`;
      expect(firstMatch(serial, markers)).toBe(INSTALLER_BAIL_SERIAL_MARKER);
    });

    test(`${name}: carries no literal "bail" marker (it can only false-positive)`, () => {
      expect(markers).not.toContain("bail");
      const healthy = `${HEALTHY_PREFIX}cilium-operator: bailing out of leader election retry, will re-acquire\n`;
      expect(firstMatch(healthy, markers)).toBeUndefined();
    });

    test(`${name}: the installer's NON-fatal ERROR lines do not stop a healthy run`, () => {
      const healthy = [
        HEALTHY_PREFIX,
        "      PROBE ERROR: blkid timed out   (failure-closed: this disk cannot read as blank)",
        "[iter-5.4.1]   ERROR: node.yaml absent/empty at /mnt/etc/zeta — not registering (nothing pushed).",
        "mise ERROR Failed to install node@22",
        "",
      ].join("\n");
      expect(firstMatch(healthy, markers)).toBeUndefined();
    });
  }
});
