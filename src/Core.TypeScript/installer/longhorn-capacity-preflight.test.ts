/**
 * longhorn-capacity-preflight.test.ts — 081M393B9TB087G0R000Y529Z8 (WP28).
 *
 * The falsifier for the Longhorn capacity refusal. Three groups:
 *
 *   1. The arithmetic, over fixtures — including THE case: a 1 GiB longhorn1
 *      tail on a single-disk install against the committed roster. That case
 *      is written as the real installer's default, so it fails against the
 *      pre-fix tree by construction (there was no refusal at all).
 *   2. The two constants pinned to what they claim to be derived from, so
 *      neither can go stale quietly. `LONGHORN_USABLE_PERCENT` against the
 *      deployed Longhorn Application's own reserve settings, and
 *      `COMMITTED_LONGHORN_DEMAND_GIB` against the render snapshot + the
 *      YAML-derived claims over the classes `local-storage.nix` actually binds
 *      to `driver.longhorn.io`.
 *   3. The installer's geometry, read out of zeta-install.sh rather than
 *      restated — the literal this whole work package is about.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  autoLonghornTailGib,
  COMMITTED_LONGHORN_DEMAND_GIB,
  ESP_GIB,
  LONGHORN_MIN_TAIL_GIB,
  LONGHORN1_TAIL_AUTO,
  LONGHORN_USABLE_PERCENT,
  ROOT_FLOOR_GIB,
  LONGHORN_UNDERSIZED_OVERRIDE_TOKEN,
  bytesToGib,
  longhornCapacityVerdict,
  provisionedLonghornGib,
  schedulableLonghornGib,
} from "./longhorn-capacity-preflight.ts";
import {
  collectLonghornReserves,
  installerLonghornTailGib,
  longhornPoolDemandGib,
  mostConservativeUsableFraction,
  loadManifests,
  DEFAULT_ROOTS,
  REPO_ROOT,
} from "../cluster/single-node-readiness.ts";

const GIB = 1024 ** 3;

describe("provisionedLonghornGib — the installer's geometry, not the block devices", () => {
  it("a single-disk install provisions ONLY the longhorn1 tail", () => {
    // The whole defect in one assertion. The boot disk can be any size at all;
    // ESP + root take everything but the tail, and the root filesystem is never
    // a Longhorn data path.
    expect(provisionedLonghornGib(1, [])).toBe(1);
  });

  it("every non-boot internal disk is added whole", () => {
    expect(provisionedLonghornGib(1, [931, 465])).toBe(1397);
  });

  it("junk, negative and fractional sizes collapse to 0 rather than manufacturing headroom", () => {
    expect(provisionedLonghornGib(-5, [])).toBe(0);
    expect(provisionedLonghornGib(1.5, [])).toBe(0);
    expect(provisionedLonghornGib(1, [-931, Number.NaN, 465])).toBe(466);
  });
});

describe("schedulableLonghornGib — capacity rounds DOWN", () => {
  it("applies the usable percent and floors", () => {
    expect(schedulableLonghornGib(1000, 75)).toBe(750);
    // 1 GiB x 75% = 0.75 GiB, which floors to 0. A fractional GiB must not acquit.
    expect(schedulableLonghornGib(1, 75)).toBe(0);
  });

  it("a zero or junk pool is zero, never negative", () => {
    expect(schedulableLonghornGib(0, 75)).toBe(0);
    expect(schedulableLonghornGib(-100, 75)).toBe(0);
    expect(schedulableLonghornGib(1000, 0)).toBe(0);
  });
});

describe("longhornCapacityVerdict — fails closed", () => {
  it("REFUSES the measured defect: a 1 GiB tail against the committed roster", () => {
    const raw = provisionedLonghornGib(1, []);
    const schedulable = schedulableLonghornGib(raw, LONGHORN_USABLE_PERCENT);
    expect(schedulable).toBe(0);
    expect(longhornCapacityVerdict(schedulable, COMMITTED_LONGHORN_DEMAND_GIB, "")).toBe("undersized");
  });

  it("REFUSES the maintainer's registered hardware read as generously as possible", () => {
    // node-ad1efd: /dev/sda 115.5G + /dev/nvme0n1 931.5G. Most generous shape —
    // boot is the SMALLEST device, so the 931 GiB NVMe becomes longhorn2 whole.
    // It still convicts, which is the point: this is not a marginal call.
    const raw = provisionedLonghornGib(1, [931]);
    const schedulable = schedulableLonghornGib(raw, LONGHORN_USABLE_PERCENT);
    expect(schedulable).toBe(699);
    expect(schedulable).toBeLessThan(COMMITTED_LONGHORN_DEMAND_GIB);
    expect(longhornCapacityVerdict(schedulable, COMMITTED_LONGHORN_DEMAND_GIB, "")).toBe("undersized");
  });

  it("passes when the pool genuinely covers the roster", () => {
    const raw = provisionedLonghornGib(1, [1400]);
    expect(longhornCapacityVerdict(schedulableLonghornGib(raw, LONGHORN_USABLE_PERCENT))).toBe("ok");
  });

  it("the override is the EXACT token and nothing else", () => {
    expect(longhornCapacityVerdict(0, 943, LONGHORN_UNDERSIZED_OVERRIDE_TOKEN)).toBe("override");
    for (const nearMiss of ["", "0", "yes", "true", "11", " 1"]) {
      expect(longhornCapacityVerdict(0, 943, nearMiss)).toBe("undersized");
    }
  });

  it("an override never turns a fitting pool into a warning", () => {
    expect(longhornCapacityVerdict(1000, 943, LONGHORN_UNDERSIZED_OVERRIDE_TOKEN)).toBe("ok");
  });
});

describe("bytesToGib", () => {
  it("floors", () => {
    expect(bytesToGib(931 * GIB)).toBe(931);
    expect(bytesToGib(GIB - 1)).toBe(0);
    expect(bytesToGib(-1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The constants, pinned to what they are derived FROM.
//
// A literal in shell-reachable TypeScript is only acceptable here because
// nothing on the pre-wipe path can compute it (the ISO ships no bun). What
// makes it honest rather than stale is that these three tests recompute it.
// ---------------------------------------------------------------------------

describe("LONGHORN_USABLE_PERCENT is derived from the deployed chart, not chosen", () => {
  it("equals the most conservative usable fraction of the Longhorn Applications in the tree", () => {
    const manifests = loadManifests(DEFAULT_ROOTS, REPO_ROOT);
    const reserves = collectLonghornReserves(manifests);
    expect(reserves.length).toBeGreaterThan(0);
    expect(Math.round(mostConservativeUsableFraction(reserves) * 100)).toBe(LONGHORN_USABLE_PERCENT);
  });
});

describe("COMMITTED_LONGHORN_DEMAND_GIB is derived from the roster, not typed into a comment", () => {
  it("equals the per-class max(rendered, derived) over the driver.longhorn.io classes", () => {
    const demand = longhornPoolDemandGib(REPO_ROOT);
    expect(demand).not.toBeNull();
    expect(demand?.totalGib).toBe(COMMITTED_LONGHORN_DEMAND_GIB);
  });

  it("scopes to the classes local-storage.nix binds to Longhorn, and zeta-block-local is NOT one", () => {
    const demand = longhornPoolDemandGib(REPO_ROOT);
    const classes = (demand?.perClass ?? []).map((row) => row.storageClass);
    expect(classes).toContain("zeta-block-replicated");
    expect(classes).not.toContain("zeta-block-local");
  });
});

describe("the installer's own default tail is what the refusal is measured against", () => {
  it("zeta-install.sh's LONGHORN1_TAIL default is readable, and is now `auto`", () => {
    // Read, never restated. Until the geometry fix this was the literal `1G`,
    // and the assertion below is what that literal could not survive. If the
    // line is deleted or obfuscated the read returns null and the readiness
    // auditor's longhorn-geometry check REFUSES rather than guessing.
    expect(installerLonghornTailGib(REPO_ROOT)).toBe(LONGHORN1_TAIL_AUTO);
  });

  it("the OLD fixed 1 GiB default could not hold the roster — the defect, as arithmetic", () => {
    // Kept as a regression: a 1 GiB tail on a single-disk install is 0 GiB
    // schedulable against 943 of demand. If anyone reinstates a fixed small
    // tail, `installerLonghornTailGib` reports it and the geometry comparator
    // convicts on exactly this shape.
    const schedulable = schedulableLonghornGib(provisionedLonghornGib(1, []), LONGHORN_USABLE_PERCENT);
    expect(schedulable).toBe(0);
    expect(schedulable).toBeLessThan(COMMITTED_LONGHORN_DEMAND_GIB);
  });

  it("the computed tail on a 1 TiB single disk clears the roster's BRING-UP total", () => {
    // The property the whole USB-installer effort is for: plug it in, and the
    // applications a fresh sync actually applies come up. 931 − 1 − 120 = 810
    // raw, x75% = 607 schedulable, against 443 GiB at bring-up.
    const schedulable = schedulableLonghornGib(
      provisionedLonghornGib(autoLonghornTailGib(931, ROOT_FLOOR_GIB), []),
      LONGHORN_USABLE_PERCENT,
    );
    expect(schedulable).toBe(607);
    // Still short of the 943 GiB STEADY-STATE total, and deliberately so: the
    // geometry fix is necessary and is not sufficient, which is why the
    // shortfall stays recorded as debt rather than being papered over here.
    expect(schedulable).toBeLessThan(COMMITTED_LONGHORN_DEMAND_GIB);
  });
});

// ---------------------------------------------------------------------------
// THE DELIBERATELY-SMALL DISK — WP28 (081M393B9TB087G0R000Y529Z8).
//
// The QEMU install lanes create ONE virtual disk of 40 GiB (or 64 GiB for the
// WP11 installed-disk first-boot verify). Both are SMALLER than the 120 GiB
// root floor, so the auto-tail resolver refuses them — which would have failed
// every install-to-disk lane, including the one this whole effort depends on.
//
// That case is now named and tested rather than discovered. The sizes are read
// out of the harness rather than restated, so a lane that resizes its disk
// re-checks this arithmetic instead of silently leaving it stale.
// ---------------------------------------------------------------------------

const QEMU_HARNESS = join(REPO_ROOT, "src/Core.TypeScript/ci/qemu-full-install-test.ts");

function harnessDiskGib(constName: string): number {
  const source = readFileSync(QEMU_HARNESS, "utf8");
  const match = new RegExp(`^const ${constName} = (\\d+);`, "m").exec(source);
  if (match === null) throw new Error(`${constName} not found in qemu-full-install-test.ts`);
  return Number(match[1]);
}

describe("a boot disk smaller than the root floor never produces a negative tail", () => {
  it("the QEMU lanes' disks are BOTH below the root floor — which is why this group exists", () => {
    // If a lane ever grows its disk past the floor this assertion records it,
    // and the override below stops being load-bearing for that lane.
    expect(harnessDiskGib("DISK_SIZE_GB")).toBeLessThan(ROOT_FLOOR_GIB);
    expect(harnessDiskGib("K3S_VERIFY_DISK_SIZE_GB")).toBeLessThan(ROOT_FLOOR_GIB);
  });

  for (const constName of ["DISK_SIZE_GB", "K3S_VERIFY_DISK_SIZE_GB"] as const) {
    it(`${constName} yields 0, never a negative remainder`, () => {
      // 0 is the REFUSE signal. A negative would reach `sgdisk -n "2:0:-<n>G"`
      // as an end code computed from a negative remainder, which is how a
      // partitioner is asked to do something nobody intended.
      const tail = autoLonghornTailGib(harnessDiskGib(constName), ROOT_FLOOR_GIB);
      expect(tail).toBe(0);
      expect(tail).toBeGreaterThanOrEqual(0);
    });
  }

  it("the boundary is exactly ESP + floor + 1, and one GiB either side behaves", () => {
    expect(autoLonghornTailGib(ROOT_FLOOR_GIB + ESP_GIB, ROOT_FLOOR_GIB)).toBe(0);
    expect(autoLonghornTailGib(ROOT_FLOOR_GIB + ESP_GIB + 1, ROOT_FLOOR_GIB)).toBe(LONGHORN_MIN_TAIL_GIB);
  });

  it("the minimum tail matches the lower bound an explicit LONGHORN1_TAIL already has", () => {
    // One minimum in the installer, not two that agree by coincidence.
    expect(LONGHORN_MIN_TAIL_GIB).toBe(1);
  });
});

describe("the small-disk fallback is gated on the SAME named override, not on a test mode", () => {
  const INSTALL_SH = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh"), "utf8");

  it("the resolver checks ZETA_ALLOW_LONGHORN_UNDERSIZED before falling back", () => {
    // Structural, and it says what it cannot prove: it does not execute the
    // resolver (that needs `blockdev` and a real device). What it does prove is
    // that the fallback is reachable only through the named override, and the
    // arithmetic itself is executed by the parity test against real bash.
    const resolver = INSTALL_SH.slice(
      INSTALL_SH.indexOf("resolve LONGHORN1_TAIL=auto"),
      INSTALL_SH.indexOf("About to FULL-WIPE"),
    );
    expect(resolver).toContain('"${ZETA_ALLOW_LONGHORN_UNDERSIZED:-}" == "1"');
    expect(resolver).toContain("ZETA_LONGHORN_MIN_TAIL_GIB");
    expect(resolver).toContain("bail ");
  });

  it("it does NOT detect CI, a container, or a virtual disk", () => {
    // A check that disables itself when it notices it is being tested is a
    // check that cannot fail where it matters most — the vacuity class built
    // into the guard that exists to refuse it. The override is named by the
    // caller; the installer never infers it.
    //
    // COMMENTS ARE STRIPPED FIRST, and that is not a convenience: the bail text
    // legitimately explains why the QEMU lanes set the override, and a scan
    // that failed on the word rather than on the BRANCH would be measuring
    // prose. It is the executable lines that must contain no sniffing.
    const resolver = INSTALL_SH.slice(
      INSTALL_SH.indexOf("resolve LONGHORN1_TAIL=auto"),
      INSTALL_SH.indexOf("About to FULL-WIPE"),
    )
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    for (const sniff of ["$CI", "GITHUB_ACTIONS", "/sys/class/dmi", "systemd-detect-virt", "hypervisor"]) {
      expect(resolver).not.toContain(sniff);
    }
    // The only condition the fallback branches on is the named override.
    const conditions = resolver.match(/^\s*(?:el)?if .*$/gm) ?? [];
    expect(conditions.some((line) => line.includes("ZETA_ALLOW_LONGHORN_UNDERSIZED"))).toBe(true);
  });

  it("the override still PRINTS the arithmetic — it clears the exit, not the report", () => {
    const resolver = INSTALL_SH.slice(
      INSTALL_SH.indexOf("resolve LONGHORN1_TAIL=auto"),
      INSTALL_SH.indexOf("About to FULL-WIPE"),
    );
    expect(resolver).toContain("debt you named, not a cleared check");
  });
});

describe("the override REACHES the installer — a pass-through with no policy", () => {
  const FIRST_BOOT = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh"), "utf8");

  it("zeta-first-boot.sh exports it, because sourced vars are not inherited", () => {
    // The ESP conf is SOURCED, so a value set there reaches this script's shell
    // and not the child `zeta-install` process. Without this export the
    // override could be set correctly and still do nothing — a knob that turns
    // and is not connected.
    expect(FIRST_BOOT).toContain('export ZETA_ALLOW_LONGHORN_UNDERSIZED="${ZETA_ALLOW_LONGHORN_UNDERSIZED:-}"');
  });

  it("unset stays unset — the pass-through sets no policy of its own", () => {
    // `${VAR:-}` and nothing else. If this line ever grew a default, every USB
    // install would clear the guard.
    expect(FIRST_BOOT).not.toContain("export ZETA_ALLOW_LONGHORN_UNDERSIZED=1");
  });

  it("it is NOT baked into the ISO's own zeta-firstboot.conf", () => {
    // That file ships on every USB, so a value there would clear the guard for
    // every operator install as well — the guard deleting itself.
    const isoConfig = readFileSync(
      join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix"),
      "utf8",
    );
    expect(isoConfig).not.toContain("ZETA_ALLOW_LONGHORN_UNDERSIZED");
  });
});
