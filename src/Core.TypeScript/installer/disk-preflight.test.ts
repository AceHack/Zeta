/**
 * disk-preflight.test.ts -- hermetic falsifiers for the pre-format probe
 * decisions that the bash parity test does not cover: the printed report, the
 * credential carry-forward seam, and the window/default policy boundaries.
 *
 * MEASURED vs DESIGNED: everything here is DESIGNED-BUT-UNRUN against real
 * hardware. These tests falsify the DECISIONS. They cannot falsify the
 * PROBING, because no node has booted this code.
 */

import { describe, expect, test } from "bun:test";
import {
  classifyDisk,
  credsCarryForwardDecision,
  decideWipeScope,
  formatPreflightReport,
  BLANK_DISK_CANCEL_WINDOW_SECS,
  DEFAULT_CANCEL_WINDOW_SECS,
  ZETA_INSTALLER_VOLUME_LABEL,
  type DiskFacts,
} from "./disk-preflight.ts";

function facts(over: Partial<DiskFacts>): DiskFacts {
  return {
    device: "/dev/nvme0n1",
    sizeBytes: 1099511627776,
    transport: "nvme",
    ptType: "",
    volumeLabels: [],
    partitions: [],
    esp: null,
    probeErrors: [],
    ...over,
  };
}

describe("R6: the probe PRINTS what is on the disks before they are gone", () => {
  test("a foreign filesystem is named with its label and its used space", () => {
    const c = classifyDisk(
      facts({
        device: "/dev/sda",
        ptType: "gpt",
        partitions: [
          { name: "/dev/sda1", fstype: "ext4", label: "backup", partlabel: "data", sizeBytes: 2000000000000, fsUsedBytes: 365072220160 },
        ],
      }),
    );
    const report = formatPreflightReport([c]).join("\n");
    expect(report).toContain("/dev/sda: foreign-data");
    expect(report).toContain("backup");
    expect(report).toContain("340.0 GiB used");
    expect(report).toContain("NOT OURS");
  });

  test("a prior Zeta install names the creds blob and its binding factor", () => {
    const c = classifyDisk(
      facts({
        ptType: "gpt",
        volumeLabels: ["boot", "nixos"],
        partitions: [
          { name: "/dev/nvme0n1p1", fstype: "vfat", label: "boot", partlabel: "ESP", sizeBytes: 1073741824, fsUsedBytes: null },
          { name: "/dev/nvme0n1p2", fstype: "ext4", label: "nixos", partlabel: "root", sizeBytes: 900000000000, fsUsedBytes: null },
        ],
        esp: { partition: "/dev/nvme0n1p1", hasCredsBlob: true, recordedBindingFactor: "usbUuid", hasZetaEfiDir: true },
      }),
    );
    expect(c.disposition).toBe("prior-zeta-install");
    const report = formatPreflightReport([c]).join("\n");
    expect(report).toContain("zeta-creds.enc present (binding=usbUuid)");
    expect(report).toContain("ZETA-STAMPED");
  });

  test("a probe error is PRINTED, not swallowed", () => {
    const c = classifyDisk(facts({ probeErrors: ["esp-probe-failed:/dev/sda1"] }));
    expect(c.disposition).toBe("indeterminate");
    expect(formatPreflightReport([c]).join("\n")).toContain("probe error: esp-probe-failed:/dev/sda1");
  });
});

describe("R7: the greedy default and the real abort", () => {
  const blank = { device: "/dev/nvme0n1", disposition: "blank" as const, evidence: [] };
  const foreign = { device: "/dev/sda", disposition: "foreign-data" as const, evidence: [] };
  const closed = { state: "closed" as const, reason: "fixture" };

  test("headless is preserved: the default is PROCEED", () => {
    const d = decideWipeScope({ classifications: [blank], breaker: closed });
    expect(d.cancelDefault).toBe("proceed");
  });

  test("all-blank shortens the window; anything else does not", () => {
    expect(decideWipeScope({ classifications: [blank], breaker: closed }).cancelWindowSecs).toBe(BLANK_DISK_CANCEL_WINDOW_SECS);
    expect(decideWipeScope({ classifications: [blank, foreign], breaker: closed }).cancelWindowSecs).toBe(DEFAULT_CANCEL_WINDOW_SECS);
  });

  test("an unreadable disk gets the FULL window: failure closed", () => {
    const ind = { device: "/dev/sdb", disposition: "indeterminate" as const, evidence: [] };
    expect(decideWipeScope({ classifications: [ind], breaker: closed }).cancelWindowSecs).toBe(DEFAULT_CANCEL_WINDOW_SECS);
  });

  test("an OPEN breaker flips the default to ABORT and forces the full window", () => {
    const d = decideWipeScope({ classifications: [blank], breaker: { state: "open", reason: "3 consecutive" } });
    expect(d.cancelDefault).toBe("abort");
    expect(d.cancelWindowSecs).toBe(DEFAULT_CANCEL_WINDOW_SECS);
  });

  test("a BLIND breaker permits the attempt but never shortens the window", () => {
    const d = decideWipeScope({ classifications: [blank], breaker: { state: "blind", reason: "ESP read-only" } });
    expect(d.cancelDefault).toBe("proceed");
    expect(d.cancelWindowSecs).toBe(DEFAULT_CANCEL_WINDOW_SECS);
  });
});

describe("the installer medium is never in the wipe scope", () => {
  test("the ZETA_INSTALL volume label removes a disk from scope with a reason", () => {
    const c = classifyDisk(facts({ device: "/dev/nvme1n1", transport: "nvme", volumeLabels: [ZETA_INSTALLER_VOLUME_LABEL] }));
    expect(c.disposition).toBe("installer-medium");
    const d = decideWipeScope({
      classifications: [c, { device: "/dev/nvme0n1", disposition: "blank", evidence: [] }],
      breaker: { state: "closed", reason: "fixture" },
    });
    expect(d.wipe).toEqual(["/dev/nvme0n1"]);
    expect(d.refused).toHaveLength(1);
    expect(d.refused[0]?.device).toBe("/dev/nvme1n1");
    expect(d.refused[0]?.reason).toContain(ZETA_INSTALLER_VOLUME_LABEL);
  });
});

describe("R8 seam: the credential decision that is NOT made here", () => {
  test("no blob, nothing to decide", () => {
    expect(credsCarryForwardDecision(null).action).toBe("none");
  });

  test("a usbUuid-bound blob is REFUSED: it is provably dead after the reformat", () => {
    const d = credsCarryForwardDecision({
      partition: "/dev/nvme0n1p1",
      hasCredsBlob: true,
      recordedBindingFactor: "usbUuid",
      hasZetaEfiDir: false,
    });
    expect(d.action).toBe("refuse-dead-blob");
    expect(d.reason).toContain("reformat_same_stick");
  });

  test("an unrecorded binding factor is REFUSED rather than assumed", () => {
    const d = credsCarryForwardDecision({
      partition: "/dev/nvme0n1p1",
      hasCredsBlob: true,
      recordedBindingFactor: null,
      hasZetaEfiDir: false,
    });
    expect(d.action).toBe("refuse-dead-blob");
  });

  test("a surviving binding factor is BLOCKED on the open decision, not silently adopted", () => {
    for (const factor of ["usbISerial", "uefiKeyfile", "tpmSeal"] as const) {
      const d = credsCarryForwardDecision({
        partition: "/dev/nvme0n1p1",
        hasCredsBlob: true,
        recordedBindingFactor: factor,
        hasZetaEfiDir: false,
      });
      expect(d.action).toBe("blocked-on-open-decision");
      if (d.action === "blocked-on-open-decision") {
        expect(d.decision).toContain("5.2");
      }
    }
  });
});
