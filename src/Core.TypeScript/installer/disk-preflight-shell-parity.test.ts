/**
 * disk-preflight-shell-parity.test.ts
 *
 * The falsifier that keeps disk-preflight.ts from being a dead specification.
 *
 * It EXTRACTS the block between the ZETA-PREFLIGHT-PARITY markers out of the
 * real zeta-install.sh, RUNS it under bash, and compares the shell decisions
 * against the TypeScript decisions over the same fixtures.
 *
 * The block is kept to a bash-3.2 subset precisely so this test can run on the
 * maintainer macOS bash (3.2.57). Nothing here touches a device: the extracted
 * functions consume fact records on stdin and print decisions on stdout.
 *
 * SCOPE OF THE PARITY CLAIM, stated so it is not read wider than it is:
 * disposition, wipe scope, refusals, cancel-window seconds, cancel default,
 * mode, and the ledger verdict are compared. Evidence PROSE is not; the two
 * sides render findings for a human independently and a wording difference is
 * not a safety property.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  classifyDisk,
  decideWipeScope,
  DEFAULT_CANCEL_WINDOW_SECS,
  BLANK_DISK_CANCEL_WINDOW_SECS,
  type DiskFacts,
  type DiskDisposition,
} from "./disk-preflight.ts";
import { validateAttemptLedger, decideBreaker } from "./install-circuit-breaker.ts";

const INSTALL_SH = new URL("../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh", import.meta.url).pathname;
const BEGIN = "# ZETA-PREFLIGHT-PARITY-BEGIN";
const END = "# ZETA-PREFLIGHT-PARITY-END";

function extractParityBlock(): string {
  const src = readFileSync(INSTALL_SH, "utf8");
  const b = src.indexOf(BEGIN);
  const e = src.indexOf(END);
  if (b < 0) throw new Error("parity BEGIN marker missing from zeta-install.sh");
  if (e < 0) throw new Error("parity END marker missing from zeta-install.sh");
  if (e < b) throw new Error("parity markers out of order in zeta-install.sh");
  return src.slice(b, e + END.length);
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-parity-"));
const blockPath = join(workdir, "parity-block.sh");
writeFileSync(blockPath, extractParityBlock() + "\n", "utf8");

function runShell(script: string, stdin: string): string {
  const runner = join(workdir, "runner.sh");
  writeFileSync(runner, "set -uo pipefail\nsource " + blockPath + "\n" + script + "\n", "utf8");
  const r = spawnSync("bash", [runner], { input: stdin, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error("shell block exited " + String(r.status) + ": " + String(r.stderr));
  }
  return String(r.stdout).trim();
}

function facts(over: Partial<DiskFacts>): DiskFacts {
  return {
    device: "/dev/nvme0n1",
    sizeBytes: 1024 * 1024 * 1024 * 1024,
    transport: "nvme",
    ptType: "",
    volumeLabels: [],
    partitions: [],
    esp: null,
    probeErrors: [],
    ...over,
  };
}

/** Render DiskFacts into the line record zeta_pf_classify consumes. */
function toFactRecord(f: DiskFacts): string {
  const lines: string[] = [];
  lines.push("pttype=" + f.ptType);
  for (const l of f.volumeLabels) lines.push("volumelabel=" + l);
  for (const p of f.partitions) {
    lines.push("part=" + p.name + "|" + p.fstype + "|" + p.label + "|" + p.partlabel);
  }
  if (f.esp !== null) {
    const creds = f.esp.hasCredsBlob ? "1" : "0";
    const efi = f.esp.hasZetaEfiDir ? "1" : "0";
    const factor = f.esp.recordedBindingFactor ?? "-";
    lines.push("esp=" + f.esp.partition + "|" + creds + "|" + factor + "|" + efi);
  }
  for (const e of f.probeErrors) lines.push("err=" + e);
  return lines.join("\n") + "\n";
}

type Fixture = { readonly name: string; readonly facts: DiskFacts; readonly expected: DiskDisposition };

const P_ESP = { name: "/dev/nvme0n1p1", fstype: "vfat", label: "boot", partlabel: "ESP", sizeBytes: 1073741824, fsUsedBytes: null };
const P_ROOT = { name: "/dev/nvme0n1p2", fstype: "ext4", label: "nixos", partlabel: "root", sizeBytes: 900000000000, fsUsedBytes: null };
const P_LH1 = { name: "/dev/nvme0n1p3", fstype: "ext4", label: "longhorn1", partlabel: "longhorn1", sizeBytes: 1073741824, fsUsedBytes: null };
const P_FOREIGN = { name: "/dev/sda1", fstype: "ext4", label: "backup", partlabel: "data", sizeBytes: 2000000000000, fsUsedBytes: 365072220160 };
const P_NTFS = { name: "/dev/sda1", fstype: "ntfs", label: "", partlabel: "Basic data partition", sizeBytes: 500000000000, fsUsedBytes: null };
const P_RAW = { name: "/dev/sdb1", fstype: "", label: "", partlabel: "", sizeBytes: 500000000000, fsUsedBytes: null };

const FIXTURES: readonly Fixture[] = [
  { name: "empty disk, nothing on it", facts: facts({}), expected: "blank" },
  {
    name: "our own installer stick behind a non-usb adapter",
    facts: facts({ transport: "nvme", ptType: "dos", volumeLabels: ["ZETA_INSTALL"] }),
    expected: "installer-medium",
  },
  {
    name: "installer label wins even when a probe failed",
    facts: facts({ volumeLabels: ["ZETA_INSTALL"], probeErrors: ["blkid-failed"] }),
    expected: "installer-medium",
  },
  {
    name: "prior Zeta install, full layout",
    facts: facts({ ptType: "gpt", volumeLabels: ["boot", "nixos", "longhorn1"], partitions: [P_ESP, P_ROOT, P_LH1] }),
    expected: "prior-zeta-install",
  },
  {
    name: "prior Zeta install recognised by the creds blob alone",
    facts: facts({
      ptType: "gpt",
      partitions: [P_ESP],
      volumeLabels: ["boot"],
      esp: { partition: "/dev/nvme0n1p1", hasCredsBlob: true, recordedBindingFactor: "usbUuid", hasZetaEfiDir: false },
    }),
    expected: "prior-zeta-install",
  },
  {
    name: "someone else ext4 with a label and real used space",
    facts: facts({ device: "/dev/sda", ptType: "gpt", volumeLabels: ["backup"], partitions: [P_FOREIGN] }),
    expected: "foreign-data",
  },
  {
    name: "windows ntfs with no label",
    facts: facts({ device: "/dev/sda", ptType: "gpt", partitions: [P_NTFS] }),
    expected: "foreign-data",
  },
  {
    name: "probe failed: never reads as blank",
    facts: facts({ probeErrors: ["blkid-failed"] }),
    expected: "indeterminate",
  },
  {
    name: "partition table with an unformatted partition: not blank, not ours",
    facts: facts({ device: "/dev/sdb", ptType: "gpt", partitions: [P_RAW] }),
    expected: "indeterminate",
  },
  {
    name: "lone Zeta ESP with nothing else is not enough to claim a prior install",
    facts: facts({ ptType: "gpt", volumeLabels: ["boot"], partitions: [P_ESP] }),
    expected: "indeterminate",
  },
];

describe("classification parity: bash block in zeta-install.sh vs disk-preflight.ts", () => {
  for (const f of FIXTURES) {
    test(f.name, () => {
      const ts = classifyDisk(f.facts).disposition;
      const sh = runShell("zeta_pf_classify", toFactRecord(f.facts));
      expect(ts).toBe(f.expected);
      expect(sh).toBe(f.expected);
    });
  }
});

type ScopeCase = {
  readonly name: string;
  readonly disps: readonly (readonly [string, DiskDisposition])[];
  readonly breaker: "closed" | "open" | "blind";
};

const SCOPE_CASES: readonly ScopeCase[] = [
  { name: "all blank, breaker closed", disps: [["/dev/nvme0n1", "blank"], ["/dev/sdb", "blank"]], breaker: "closed" },
  { name: "one foreign disk", disps: [["/dev/nvme0n1", "blank"], ["/dev/sda", "foreign-data"]], breaker: "closed" },
  { name: "prior install present", disps: [["/dev/nvme0n1", "prior-zeta-install"]], breaker: "closed" },
  { name: "installer medium refused", disps: [["/dev/nvme0n1", "blank"], ["/dev/nvme1n1", "installer-medium"]], breaker: "closed" },
  { name: "breaker open over blank disks", disps: [["/dev/nvme0n1", "blank"]], breaker: "open" },
  { name: "breaker blind over blank disks", disps: [["/dev/nvme0n1", "blank"]], breaker: "blind" },
  { name: "indeterminate disk", disps: [["/dev/sdb", "indeterminate"]], breaker: "closed" },
];

describe("wipe scope and cancel window parity", () => {
  for (const c of SCOPE_CASES) {
    test(c.name, () => {
      const classifications = c.disps.map(([device, disposition]) => ({ device, disposition, evidence: [] }));
      const ts = decideWipeScope({ classifications, breaker: { state: c.breaker, reason: "fixture" } });
      const stdin = c.disps.map(([d, p]) => d + "|" + p).join("\n") + "\n";
      const cmd = "zeta_pf_decide_scope " + c.breaker + " " + String(DEFAULT_CANCEL_WINDOW_SECS) + " " + String(BLANK_DISK_CANCEL_WINDOW_SECS);
      const out = runShell(cmd, stdin);
      const get = (k: string) => out.split("\n").filter((l) => l.startsWith(k + "=")).map((l) => l.slice(k.length + 1));
      expect(get("mode")[0]).toBe(ts.mode);
      expect(Number(get("window")[0])).toBe(ts.cancelWindowSecs);
      expect(get("default")[0]).toBe(ts.cancelDefault);
      expect(get("wipe")).toEqual([...ts.wipe]);
      expect(get("refused")).toEqual(ts.refused.map((r) => r.device));
    });
  }
});

const LEDGERS: readonly (readonly [string, string])[] = [
  ["", "trusted 0"],
  ["1|2026-08-21T00:00:00Z|ok|wipe", "trusted 0"],
  ["1|2026-08-21T00:00:00Z|started|wipe", "trusted 1"],
  ["1|2026-08-21T00:00:00Z|failed|wipe\n2|2026-08-21T00:10:00Z|failed|wipe", "trusted 2"],
  ["1|2026-08-21T00:00:00Z|ok|wipe\n2|2026-08-21T00:10:00Z|failed|wipe", "trusted 1"],
  ["not-a-ledger", "untrusted"],
  ["2|2026-08-21T00:00:00Z|failed|wipe", "untrusted"],
  ["1|2026-08-21T00:00:00Z|exploded|wipe", "untrusted"],
  ["1||failed|wipe", "untrusted"],
  ["x|2026-08-21T00:00:00Z|failed|wipe", "untrusted"],
];

describe("attempt ledger validation parity (R9 validate-before-wipe)", () => {
  for (const [raw, expectedPrefix] of LEDGERS) {
    test("ledger: " + JSON.stringify(raw), () => {
      const sh = runShell("zeta_pf_validate_ledger", raw === "" ? "" : raw + "\n");
      expect(sh.startsWith(expectedPrefix)).toBe(true);
      const ts = validateAttemptLedger(raw);
      expect(ts.trusted).toBe(expectedPrefix.startsWith("trusted"));
      if (ts.trusted) {
        const tsFails = decideBreaker({ validation: ts, ledgerWritable: true, maxAttempts: 99 }).consecutiveFailures;
        expect(String(tsFails)).toBe(String(sh.split(" ")[1]));
      }
    });
  }
});

describe("breaker state parity", () => {
  const cases = [
    { trusted: 1, fails: 0, max: 3, writable: 1, expect: "closed" },
    { trusted: 1, fails: 2, max: 3, writable: 1, expect: "closed" },
    { trusted: 1, fails: 3, max: 3, writable: 1, expect: "open" },
    { trusted: 1, fails: 9, max: 3, writable: 1, expect: "open" },
    { trusted: 0, fails: 0, max: 3, writable: 1, expect: "open" },
    { trusted: 1, fails: 0, max: 3, writable: 0, expect: "blind" },
    { trusted: 0, fails: 0, max: 3, writable: 0, expect: "open" },
  ];
  for (const c of cases) {
    test("trusted=" + String(c.trusted) + " fails=" + String(c.fails) + " writable=" + String(c.writable), () => {
      const sh = runShell("zeta_pf_breaker " + String(c.trusted) + " " + String(c.fails) + " " + String(c.max) + " " + String(c.writable), "");
      expect(sh).toBe(c.expect);
    });
  }
});

describe("the gates are actually WIRED into the destructive path", () => {
  const src = readFileSync(INSTALL_SH, "utf8");
  const wipeIdx = src.indexOf("sudo wipefs -af");

  test("wipefs is still there (this test is about ordering, not removal)", () => {
    expect(wipeIdx).toBeGreaterThan(0);
  });

  test("the pre-format probe runs BEFORE the first destructive call", () => {
    const probeIdx = src.indexOf("Pre-format probe (R6)");
    expect(probeIdx).toBeGreaterThan(0);
    expect(probeIdx).toBeLessThan(wipeIdx);
  });

  test("the cancel window runs BEFORE the first destructive call", () => {
    const windowIdx = src.indexOf("ZETA_CANCEL_REMAIN");
    expect(windowIdx).toBeGreaterThan(0);
    expect(windowIdx).toBeLessThan(wipeIdx);
  });

  test("the countdown is NOT gated on ZETA_AUTO_CONFIRM: it runs headless too", () => {
    const head = src.slice(0, wipeIdx);
    const windowIdx = head.indexOf("ZETA_CANCEL_REMAIN");
    const tail = head.slice(windowIdx);
    expect(tail).not.toContain("ZETA_AUTO_CONFIRM");
    const before = head.lastIndexOf("ZETA_AUTO_CONFIRM", windowIdx);
    const ifDepth = head.slice(before, windowIdx);
    expect(ifDepth).toContain("fi");
  });

  test("the breaker is consulted before the window", () => {
    const breakerIdx = src.indexOf("ZETA_BREAKER_STATE=");
    const windowIdx = src.indexOf("ZETA_CANCEL_REMAIN");
    expect(breakerIdx).toBeGreaterThan(0);
    expect(breakerIdx).toBeLessThan(windowIdx);
  });
});

describe("zeta-first-boot.sh no longer describes a window that does not exist", () => {
  const FB = new URL("../../../full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh", import.meta.url).pathname;
  const fb = readFileSync(FB, "utf8");
  test("the false consent claim survives only as a QUOTATION of what was wrong", () => {
    const hits = fb.split("consent is the 10-second role").length - 1;
    expect(hits).toBe(1);
    const idx = fb.indexOf("consent is the 10-second role");
    const before = fb.slice(Math.max(0, idx - 200), idx);
    expect(before).toContain("used to read");
  });

  test("the correction names what was wrong rather than quietly replacing it", () => {
    expect(fb).toContain("described a window that did not exist");
    expect(fb).toContain("zero-width");
  });

  test("ZETA_AUTO_CONFIRM=WIPE is still exported, and the comment says what it does NOT skip", () => {
    expect(fb).toContain("export ZETA_AUTO_CONFIRM=WIPE");
    expect(fb).toContain("it does not skip the window");
  });
});

describe("R4 wiring: the random-hostname generator is where HWR-2 came from", () => {
  const src = readFileSync(INSTALL_SH, "utf8");

  test("the recovered node id is preferred OVER generating a fresh random one", () => {
    const genIdx = src.indexOf("GENERATED_HOSTNAME=\"node-$(head -c 3 /dev/urandom");
    const reuseIdx = src.indexOf("ZETA_REPAIR_NODE_ID:-");
    expect(genIdx).toBeGreaterThan(0);
    expect(reuseIdx).toBeGreaterThan(0);
    expect(reuseIdx).toBeLessThan(genIdx);
  });

  test("the node id is recovered BEFORE the wipe, not after", () => {
    const recoverIdx = src.indexOf("zeta_pf_recover_identity || true");
    const wipeIdx = src.indexOf("sudo wipefs -af");
    expect(recoverIdx).toBeGreaterThan(0);
    expect(recoverIdx).toBeLessThan(wipeIdx);
  });

  test("the prior root is mounted noload: a plain ro mount still replays the journal", () => {
    expect(src).toContain("mount -t ext4 -o ro,noload");
  });

  test("HOST is not conflated with the recovered node id", () => {
    expect(src).not.toContain("HOST=\"${ZETA_REPAIR_HOSTNAME:-$HOST}\"");
  });
});
