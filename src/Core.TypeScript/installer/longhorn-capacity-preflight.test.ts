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

import {
  COMMITTED_LONGHORN_DEMAND_GIB,
  LONGHORN_USABLE_PERCENT,
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
  it("zeta-install.sh's LONGHORN1_TAIL default is readable, and today is 1 GiB", () => {
    // Read, never restated. If somebody raises the default this test records the
    // new number; if they delete or obfuscate it, the read returns null and the
    // readiness auditor's longhorn-geometry check REFUSES rather than guessing.
    expect(installerLonghornTailGib(REPO_ROOT)).toBe(1);
  });

  it("that default cannot hold the roster — the defect, stated as arithmetic", () => {
    const tail = installerLonghornTailGib(REPO_ROOT);
    expect(tail).not.toBeNull();
    const schedulable = schedulableLonghornGib(provisionedLonghornGib(tail ?? 0, []), LONGHORN_USABLE_PERCENT);
    expect(schedulable).toBeLessThan(COMMITTED_LONGHORN_DEMAND_GIB);
  });
});
