/**
 * storage-profile-selection.test.ts — docs/ops/INSTALL-TIME-CONFIG.md row 29.
 *
 * THE DEFECT, with the owner's exact numbers. node-5b2dfa (one 1 TB boot NVMe + one 1 TB NVMe
 * carrying old Longhorn data) was REFUSED by the installer's Longhorn capacity check:
 *
 *   longhorn1 tail on /dev/nvme0n1   810 GiB   (LONGHORN1_TAIL=810G)
 *   raw pool 810 GiB x 75%           607 GiB schedulable
 *   committed roster DECLARES        943 GiB
 *   ERROR: ... short by 336 GiB.
 *
 * The refusal compared the pool against ONE number as if the storage-profile ladder did not exist.
 * Every test here fails on the tree this change replaces: there was no `selectStorageProfile`, no
 * ladder in the installer, and `longhornCapacityVerdict(607, 943, "")` was the whole decision.
 *
 * What this file is NOT: it does not run the shell (storage-profile-shell-parity.test.ts replays the
 * same cases through the real zeta-install.sh) and it does not boot anything.
 */

import { describe, expect, it } from "bun:test";
import {
  longhornCapacityVerdict,
  provisionedLonghornGib,
  schedulableLonghornGib,
} from "./longhorn-capacity-preflight.ts";
import {
  decideStorageProfile,
  maxStorageProfile,
  planStorageProfile,
  renderStorageProfileConfLine,
  selectStorageProfile,
  STORAGE_PROFILE_COMMITTED,
  STORAGE_PROFILE_LADDER,
  storageProfileDemandGib,
  storageProfileRank,
} from "./storage-profile-selection.ts";

const OWNER_TAIL_GIB = 810;
const OWNER_SCHEDULABLE_GIB = schedulableLonghornGib(provisionedLonghornGib(OWNER_TAIL_GIB, []));
const COMMITTED_DEMAND_GIB = 943;

describe("the owner's box: 607 GiB schedulable against a roster that declares 943", () => {
  it("the arithmetic reproduces the refusal's own numbers", () => {
    expect(OWNER_SCHEDULABLE_GIB).toBe(607);
    // This is what the OLD gate did with them, and it is the thing that must no longer end the install.
    expect(longhornCapacityVerdict(OWNER_SCHEDULABLE_GIB, COMMITTED_DEMAND_GIB, "")).toBe("undersized");
  });

  it("selects a smaller profile that FITS and does NOT refuse", () => {
    const decision = decideStorageProfile(OWNER_SCHEDULABLE_GIB, "", "", "");
    expect(decision.verdict).toBe("ok");
    expect(decision.profile).toBe("standard");
    expect(decision.demandGib).toBe(571);
    expect(decision.demandGib).toBeLessThanOrEqual(OWNER_SCHEDULABLE_GIB);
    // Differs from the committed `measured`, so it is written as install-time config.
    expect(decision.write).toBe(true);
    expect(decision.selection).toEqual({ ok: true, profile: "standard", source: "auto" });
  });

  it("is the LARGEST rung that fits: the next one up does not", () => {
    const next = STORAGE_PROFILE_LADDER[storageProfileRank("standard") ?? 0];
    expect(next?.name).toBe("measured");
    expect(next?.demandGib).toBeGreaterThan(OWNER_SCHEDULABLE_GIB);
  });
});

describe("it refuses ONLY when even the smallest profile does not fit", () => {
  it("a 1 GiB pool (the pre-WP28 single-disk geometry) refuses", () => {
    const decision = decideStorageProfile(schedulableLonghornGib(provisionedLonghornGib(1, [])), "", "", "");
    expect(decision.verdict).toBe("undersized");
    expect(decision.profile).toBe("");
    expect(decision.write).toBe(false);
    // The refusal is reported against the SMALLEST rung: that is the number the remedies are sized from.
    expect(decision.selection).toEqual({ ok: true, profile: "minimal", source: "auto" });
    expect(decision.demandGib).toBe(STORAGE_PROFILE_LADDER[0]?.demandGib ?? null);
  });

  it("one GiB under the smallest rung refuses; exactly at it installs", () => {
    const smallest = STORAGE_PROFILE_LADDER[0]?.demandGib ?? 0;
    expect(decideStorageProfile(smallest - 1, "", "", "").verdict).toBe("undersized");
    const at = decideStorageProfile(smallest, "", "", "");
    expect(at.verdict).toBe("ok");
    expect(at.profile).toBe("minimal");
  });

  it("under ZETA_ALLOW_LONGHORN_UNDERSIZED=1 an auto choice that fits nothing proceeds on the COMMITTED tree", () => {
    // What the override has always meant ("those PVCs will pend"), and what keeps the QEMU lanes that run
    // under it byte-for-byte unchanged: no install-time config, no Application, nothing patched.
    const decision = decideStorageProfile(1, "", "", "1");
    expect(decision.verdict).toBe("override");
    expect(decision.profile).toBe("");
    expect(decision.write).toBe(false);
  });

  it("only the exact token is an override", () => {
    for (const junk of ["0", "yes", "true", " 1", "1 "]) {
      expect(decideStorageProfile(1, "", "", junk).verdict).toBe("undersized");
    }
  });
});

describe("boundaries: every rung installs exactly at its demand and not a GiB under", () => {
  for (const [index, rung] of STORAGE_PROFILE_LADDER.entries()) {
    it(`${rung.name} (${String(rung.demandGib)} GiB)`, () => {
      const at = selectStorageProfile(rung.demandGib, "", "");
      expect(at).toEqual({ ok: true, profile: rung.name, source: "auto" });
      if (index > 0) {
        const below = selectStorageProfile(rung.demandGib - 1, "", "");
        expect(below).toEqual({ ok: true, profile: STORAGE_PROFILE_LADDER[index - 1]?.name ?? "", source: "auto" });
      }
    });
  }

  it("a huge pool picks the top rung", () => {
    const top = STORAGE_PROFILE_LADDER.at(-1);
    expect(selectStorageProfile(1_000_000, "", "")).toEqual({ ok: true, profile: top?.name ?? "", source: "auto" });
  });

  it("selecting the committed rung writes nothing: the committed tree already is it", () => {
    const decision = decideStorageProfile(COMMITTED_DEMAND_GIB, "", "", "");
    expect(decision.profile).toBe(STORAGE_PROFILE_COMMITTED);
    expect(decision.write).toBe(false);
  });
});

describe("an explicit request (ZETA_STORAGE_PROFILE=<name>) forces that rung", () => {
  it("a bigger profile than auto would pick is honoured when the pool holds it", () => {
    const decision = decideStorageProfile(2000, "large", "", "");
    expect(decision.profile).toBe("large");
    expect(decision.verdict).toBe("ok");
    expect(decision.write).toBe(true);
    expect(decision.selection).toEqual({ ok: true, profile: "large", source: "explicit" });
  });

  it("is refused when the pool cannot hold it, and says which rung it was judged against", () => {
    const decision = decideStorageProfile(OWNER_SCHEDULABLE_GIB, "large", "", "");
    expect(decision.verdict).toBe("undersized");
    expect(decision.profile).toBe("");
    expect(decision.demandGib).toBe(storageProfileDemandGib("large"));
  });

  it("under the override an EXPLICIT rung is kept (the operator named it), unlike an auto one", () => {
    const decision = decideStorageProfile(OWNER_SCHEDULABLE_GIB, "large", "", "1");
    expect(decision.verdict).toBe("override");
    expect(decision.profile).toBe("large");
    expect(decision.write).toBe(true);
  });

  it("`auto` spelled out is the same as unset", () => {
    expect(selectStorageProfile(OWNER_SCHEDULABLE_GIB, "auto", "")).toEqual(
      selectStorageProfile(OWNER_SCHEDULABLE_GIB, "", ""),
    );
  });

  it("a name that is not a rung is REFUSED, never quietly treated as auto", () => {
    for (const bad of ["Standard", "AUTO", "huge", "ci", "none", "standard ", "1"]) {
      expect(selectStorageProfile(2000, bad, "")).toEqual({ ok: false, reason: "unknown" });
      expect(decideStorageProfile(2000, bad, "", "1").verdict).toBe("refused");
    }
  });

  it("`ci` is not on the ladder: it serves a hosted runner, not a node", () => {
    expect(STORAGE_PROFILE_LADDER.map((r) => r.name)).not.toContain("ci");
  });
});

describe("NEVER SHRINKS: a re-run on a live cluster cannot select below what is already applied", () => {
  it("an auto choice is RAISED to the floor, not left at what the pool would fit", () => {
    // The pool would pick `standard`; the cluster already runs `large`.
    const selection = selectStorageProfile(OWNER_SCHEDULABLE_GIB, "", "large");
    expect(selection).toEqual({ ok: true, profile: "large", source: "floor" });
  });

  it("... and then the pool is judged against the FLOOR: it does not fit, so the install REFUSES rather than shrinks", () => {
    const decision = decideStorageProfile(OWNER_SCHEDULABLE_GIB, "", "large", "");
    expect(decision.selection).toEqual({ ok: true, profile: "large", source: "floor" });
    expect(decision.verdict).toBe("undersized");
    expect(decision.profile).toBe("");
  });

  it("an explicit request below the floor is refused as a shrink", () => {
    expect(selectStorageProfile(2000, "minimal", "standard")).toEqual({ ok: false, reason: "shrink" });
    expect(selectStorageProfile(2000, "standard", "measured")).toEqual({ ok: false, reason: "shrink" });
    expect(decideStorageProfile(2000, "minimal", "standard", "1").verdict).toBe("refused");
  });

  it("an explicit request AT or ABOVE the floor is fine", () => {
    expect(selectStorageProfile(2000, "standard", "standard")).toEqual({ ok: true, profile: "standard", source: "explicit" });
    expect(selectStorageProfile(2000, "large", "standard")).toEqual({ ok: true, profile: "large", source: "explicit" });
  });

  it("a floor that is not a rung is no floor (`none` is the operator naming that they are destroying the volumes)", () => {
    expect(selectStorageProfile(OWNER_SCHEDULABLE_GIB, "", "none")).toEqual({ ok: true, profile: "standard", source: "auto" });
    expect(selectStorageProfile(2000, "minimal", "none")).toEqual({ ok: true, profile: "minimal", source: "explicit" });
    expect(selectStorageProfile(2000, "minimal", "")).toEqual({ ok: true, profile: "minimal", source: "explicit" });
  });

  it("when the pool is bigger than the floor, auto grows past it: the floor is a floor, not a ceiling", () => {
    expect(selectStorageProfile(5000, "", "standard")).toEqual({ ok: true, profile: "large", source: "auto" });
  });

  it("maxStorageProfile is the join: never-shrink as an operation", () => {
    expect(maxStorageProfile("standard", "large")).toBe("large");
    expect(maxStorageProfile("large", "standard")).toBe("large");
    expect(maxStorageProfile("standard", "")).toBe("standard");
    expect(maxStorageProfile("", "minimal")).toBe("minimal");
    expect(maxStorageProfile("garbage", "minimal")).toBe("minimal");
    expect(maxStorageProfile("", "")).toBe("");
  });
});

describe("the ladder is the catalogue's shape: it climbs, and its committed rung is on it", () => {
  it("demands strictly increase, smallest first", () => {
    for (let i = 1; i < STORAGE_PROFILE_LADDER.length; i += 1) {
      expect(STORAGE_PROFILE_LADDER[i]?.demandGib).toBeGreaterThan(STORAGE_PROFILE_LADDER[i - 1]?.demandGib ?? Infinity);
    }
  });

  it("the committed rung is a rung, and it is the one whose demand is the committed roster's", () => {
    expect(storageProfileRank(STORAGE_PROFILE_COMMITTED)).toBeGreaterThan(0);
    expect(storageProfileDemandGib(STORAGE_PROFILE_COMMITTED)).toBe(COMMITTED_DEMAND_GIB);
  });
});

describe("planStorageProfile (zflash --storage-profile)", () => {
  it("omitted -> no line at all", () => {
    expect(planStorageProfile(undefined)).toEqual({ ok: true, value: null });
  });

  it("auto and every rung pass", () => {
    expect(planStorageProfile("auto")).toEqual({ ok: true, value: "auto" });
    for (const rung of STORAGE_PROFILE_LADDER) expect(planStorageProfile(rung.name)).toEqual({ ok: true, value: rung.name });
  });

  it("anything else is refused on every machine, naming the choices", () => {
    for (const bad of ["", "ci", "Standard", "x'; rm -rf /; '", "$(id)", "standard ", "large\n"]) {
      const plan = planStorageProfile(bad);
      expect(plan.ok).toBe(false);
      if (!plan.ok) expect(plan.error).toContain("minimal, standard, measured, large");
    }
  });

  it("renders a sourceable single-quoted assignment", () => {
    expect(renderStorageProfileConfLine("standard")).toBe("ZETA_STORAGE_PROFILE='standard'\n");
  });
});
