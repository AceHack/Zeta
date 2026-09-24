/**
 * longhorn-capacity-preflight-shell-parity.test.ts — 081M393B9TB087G0R000Y529Z8 (WP28).
 *
 * Extracts the ZETA-LONGHORN-CAPACITY block out of the real zeta-install.sh,
 * runs its functions under bash, and compares them to
 * `longhorn-capacity-preflight.ts` over every input class — same harness and
 * same reason as `repo-pin-shell-parity.test.ts` and
 * `disk-preflight-shell-parity.test.ts`.
 *
 * WHY THE SHELL IS THE IMPLEMENTATION AND THE TS IS THE SPEC: the installer ISO
 * ships no bun and no nodejs, and the repo is not cloned until AFTER the wipe,
 * so nothing on the pre-wipe path can execute TypeScript. A module the shell
 * "called" would be a golden vector nothing reads.
 *
 * What this file cannot prove: that the CALL SITE
 * (`assert_longhorn_pool_holds_the_roster`, which runs `blockdev` over the real
 * devices and bails) is wired correctly. Its ORDERING against the wipe is
 * pinned by `preflights-precede-the-wipe.test.ts`; its end-to-end behaviour is
 * the QEMU full-install lane's to exercise.
 *
 * Fixture VALUES cross into bash through the child process's ENVIRONMENT, never
 * by interpolation into the script text — see the long note in
 * repo-pin-shell-parity.test.ts for the `$(rm -rf /)` incident that discipline
 * exists to prevent.
 */

import { describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  autoLonghornTailGib,
  COMMITTED_LONGHORN_DEMAND_GIB,
  COMMITTED_LONGHORN_SCHEDULABLE_GIB,
  ESP_GIB,
  LOCAL_PATH_ADVISORY_GIB,
  LONGHORN_MIN_TAIL_GIB,
  LONGHORN_USABLE_PERCENT,
  ROOT_FLOOR_GIB,
  bytesToGib,
  clampGibFromText,
  longhornCapacityVerdict,
  provisionedLonghornGib,
  schedulableLonghornGib,
} from "./longhorn-capacity-preflight.ts";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const INSTALL_SH = join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh");
const SRC = readFileSync(INSTALL_SH, "utf8");
const BEGIN = "# ZETA-LONGHORN-CAPACITY-BEGIN";
const END = "# ZETA-LONGHORN-CAPACITY-END";

function extractParityBlock(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0) throw new Error("ZETA-LONGHORN-CAPACITY BEGIN marker missing from zeta-install.sh");
  if (e < 0) throw new Error("ZETA-LONGHORN-CAPACITY END marker missing from zeta-install.sh");
  if (e < b) throw new Error("ZETA-LONGHORN-CAPACITY markers out of order in zeta-install.sh");
  return SRC.slice(b, e + END.length);
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-longhorn-capacity-"));
const blockPath = join(workdir, "parity-block.sh");
writeFileSync(blockPath, extractParityBlock() + "\n", "utf8");

/**
 * Runs `script` with the parity block sourced, passing fixture values via the ENVIRONMENT.
 *
 * `cwd: workdir` plus a RELATIVE `source ./parity-block.sh`, never an absolute
 * path interpolated into the script text: on Windows that path carries
 * backslashes, which bash reads as escapes, so the source line resolves to a
 * file that does not exist and every function silently goes missing. The whole
 * file would then fail for a reason that has nothing to do with the parity it
 * measures — a red test that is not evidence about its subject.
 */
function runShell(script: string, env: Readonly<Record<string, string>> = {}): string {
  const runner = join(workdir, "runner.sh");
  writeFileSync(runner, `set -uo pipefail\nsource ./parity-block.sh\n${script}\n`, "utf8");
  const result = spawnSync("bash", ["runner.sh"], {
    cwd: workdir,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error(`bash exited ${String(result.status)}: ${result.stderr}`);
  return result.stdout.trim();
}

describe("the parity block is extractable and self-contained", () => {
  it("both markers are present and carry all four functions", () => {
    const block = extractParityBlock();
    for (const fn of [
      "zeta_clamp_gib",
      "zeta_bytes_to_gib",
      "zeta_provisioned_longhorn_gib",
      "zeta_auto_longhorn1_tail_gib",
      "zeta_schedulable_longhorn_gib",
      "zeta_longhorn_capacity_verdict",
    ]) {
      expect(block).toContain(`${fn}()`);
    }
  });

  it("it sources cleanly on its own — no dependency on the rest of the installer", () => {
    expect(runShell("echo sourced")).toBe("sourced");
  });
});

describe("zeta_bytes_to_gib agrees with bytesToGib", () => {
  const GIB = 1024 ** 3;
  for (const bytes of [0, 1, GIB - 1, GIB, 115.5 * GIB, 931.5 * GIB, 2048 * GIB]) {
    it(`${String(bytes)} bytes`, () => {
      const whole = Math.trunc(bytes);
      expect(runShell('zeta_bytes_to_gib "$FIXTURE"', { FIXTURE: String(whole) })).toBe(String(bytesToGib(whole)));
    });
  }
});

describe("zeta_provisioned_longhorn_gib agrees with provisionedLonghornGib", () => {
  const cases: readonly (readonly [number, readonly number[]])[] = [
    [1, []], // THE case: a single-disk install
    [1, [931]], // the maintainer's registered hardware, read generously
    [1, [931, 465]],
    [64, []],
    [1024, [1024, 1024]],
  ];
  for (const [tail, data] of cases) {
    it(`tail=${String(tail)} data=[${data.join(",")}]`, () => {
      const shell = runShell('zeta_provisioned_longhorn_gib "$TAIL" $DATA', {
        TAIL: String(tail),
        DATA: data.join(" "),
      });
      expect(shell).toBe(String(provisionedLonghornGib(tail, data)));
    });
  }
});

describe("zeta_clamp_gib agrees with clampGibFromText — the TEXT parser, not JS coercion", () => {
  // The shell only ever holds strings, so its clamp is a parser and what it
  // accepts is part of the spec. This group caught a real divergence while it
  // was being written: comparing against `Number(raw)` passed for most inputs
  // and disagreed on " 931" (JS 931, shell 0) and "1e3" (JS 1000, shell 0),
  // because JavaScript's coercion is materially more permissive than bash's
  // digits-only `case`. A misread device size crossing as capacity is exactly
  // what this pair exists to prevent, so the oracle was made a parser too.
  for (const raw of ["", "-931", "931.5", "abc", "0", " 931", "931 ", "931G", "1e3", "+931", "0x10", "١٢٣"]) {
    it(`refuses ${JSON.stringify(raw)}`, () => {
      expect(runShell('zeta_clamp_gib "$FIXTURE"', { FIXTURE: raw })).toBe("0");
      expect(clampGibFromText(raw)).toBe(0);
    });
  }

  for (const raw of ["1", "931", "1400", "2048"]) {
    it(`accepts ${JSON.stringify(raw)}`, () => {
      expect(runShell('zeta_clamp_gib "$FIXTURE"', { FIXTURE: raw })).toBe(String(clampGibFromText(raw)));
      expect(clampGibFromText(raw)).toBe(Number(raw));
    });
  }
});

describe("zeta_schedulable_longhorn_gib agrees with schedulableLonghornGib", () => {
  for (const raw of [0, 1, 4, 100, 932, 1397, 2049]) {
    it(`${String(raw)} GiB raw at ${String(LONGHORN_USABLE_PERCENT)}%`, () => {
      const shell = runShell('zeta_schedulable_longhorn_gib "$RAW" "$PCT"', {
        RAW: String(raw),
        PCT: String(LONGHORN_USABLE_PERCENT),
      });
      expect(shell).toBe(String(schedulableLonghornGib(raw, LONGHORN_USABLE_PERCENT)));
    });
  }
});

describe("zeta_longhorn_capacity_verdict agrees with longhornCapacityVerdict", () => {
  const cases: readonly (readonly [number, string])[] = [
    [0, ""], // the measured defect, no override
    [0, "1"],
    [699, ""], // the maintainer's hardware, read generously
    [942, ""],
    [943, ""],
    [944, ""],
    [100, "0"],
    [100, "yes"],
    [100, "true"],
    [100, " 1"],
    [2000, "1"],
  ];
  for (const [schedulable, override] of cases) {
    it(`schedulable=${String(schedulable)} override=${JSON.stringify(override)}`, () => {
      const shell = runShell('zeta_longhorn_capacity_verdict "$S" "$D" "$O"', {
        S: String(schedulable),
        D: String(COMMITTED_LONGHORN_DEMAND_GIB),
        O: override,
      });
      expect(shell).toBe(longhornCapacityVerdict(schedulable, COMMITTED_LONGHORN_DEMAND_GIB, override));
    });
  }
});

describe("zeta_auto_longhorn1_tail_gib agrees with autoLonghornTailGib", () => {
  // The geometry fix, across the shapes that matter: the single 1 TiB disk this
  // whole work package is about, a disk exactly at the refusal boundary, and
  // one either side of it.
  // 40 and 64 are the QEMU install lanes' virtual disks, named explicitly
  // because both are BELOW the root floor and both are now on the critical path
  // for every ISO run. 121/122 straddle the refusal boundary.
  for (const diskGib of [0, 40, 64, 120, 121, 122, 256, 931, 2048, 4096]) {
    it(`${String(diskGib)} GiB boot disk`, () => {
      const shell = runShell('zeta_auto_longhorn1_tail_gib "$DISK" "$FLOOR"', {
        DISK: String(diskGib),
        FLOOR: String(ROOT_FLOOR_GIB),
      });
      expect(shell).toBe(String(autoLonghornTailGib(diskGib, ROOT_FLOOR_GIB)));
    });
  }

  it("both sides return 0 — meaning REFUSE — on a disk too small for ESP + floor + 1 GiB", () => {
    // 0 is not a tail, on either side. A shell that clamped to 1 would put the
    // original defect back while the oracle said otherwise.
    expect(runShell('zeta_auto_longhorn1_tail_gib "$DISK" "$FLOOR"', { DISK: "120", FLOOR: "120" })).toBe("0");
    expect(autoLonghornTailGib(120, 120)).toBe(0);
  });

  it("junk collapses to 0 on both sides rather than manufacturing a tail", () => {
    for (const junk of ["", "-931", "931.5", "abc"]) {
      expect(runShell('zeta_auto_longhorn1_tail_gib "$DISK" "$FLOOR"', { DISK: junk, FLOOR: "120" })).toBe("0");
    }
  });
});

describe("the shell constants agree with the TypeScript oracle", () => {
  it("ZETA_ROOT_FLOOR_GIB == ROOT_FLOOR_GIB", () => {
    expect(runShell('echo "$ZETA_ROOT_FLOOR_GIB"')).toBe(String(ROOT_FLOOR_GIB));
  });

  it("ZETA_ESP_GIB == ESP_GIB", () => {
    expect(runShell('echo "$ZETA_ESP_GIB"')).toBe(String(ESP_GIB));
  });

  it("ZETA_LONGHORN_MIN_TAIL_GIB == LONGHORN_MIN_TAIL_GIB", () => {
    // The small-disk fallback's tail. Pinned across the pair because it is the
    // one number that, as a DEFAULT, would be the original defect.
    expect(runShell('echo "$ZETA_LONGHORN_MIN_TAIL_GIB"')).toBe(String(LONGHORN_MIN_TAIL_GIB));
  });

  it("ZETA_LOCAL_PATH_ADVISORY_GIB == LOCAL_PATH_ADVISORY_GIB", () => {
    expect(runShell('echo "$ZETA_LOCAL_PATH_ADVISORY_GIB"')).toBe(String(LOCAL_PATH_ADVISORY_GIB));
  });

  it("ZETA_LONGHORN_SCHEDULABLE_GIB == COMMITTED_LONGHORN_SCHEDULABLE_GIB", () => {
    // The number the refusal is measured against. Equal to declared today
    // because nothing is PROVEN unschedulable; it drops when a node
    // re-registers under the enumerating capture.
    expect(runShell('echo "$ZETA_LONGHORN_SCHEDULABLE_GIB"')).toBe(String(COMMITTED_LONGHORN_SCHEDULABLE_GIB));
  });

  it("the installer convicts on SCHEDULABLE and prints DECLARED beside it", () => {
    // Convicting on one number while showing only the other is how a figure
    // stops meaning what its reader thinks it means.
    expect(SRC).toContain('zeta_longhorn_capacity_verdict "$schedulable" "$ZETA_LONGHORN_SCHEDULABLE_GIB"');
    expect(SRC).toContain("committed roster DECLARES");
    expect(SRC).toContain("SCHEDULABLE on registered nodes");
  });

  it("ZETA_LONGHORN_DEMAND_GIB == COMMITTED_LONGHORN_DEMAND_GIB", () => {
    expect(runShell('echo "$ZETA_LONGHORN_DEMAND_GIB"')).toBe(String(COMMITTED_LONGHORN_DEMAND_GIB));
  });

  it("ZETA_LONGHORN_USABLE_PERCENT == LONGHORN_USABLE_PERCENT", () => {
    expect(runShell('echo "$ZETA_LONGHORN_USABLE_PERCENT"')).toBe(String(LONGHORN_USABLE_PERCENT));
  });
});

describe("THE MEASURED DEFECT, end to end through the shell", () => {
  it("a single-disk install with the committed LONGHORN1_TAIL default REFUSES", () => {
    // 1 GiB tail, no data disks, chart-default usable percent, committed roster.
    // This is exactly what zeta-install.sh computes on a one-disk box today, and
    // it is what the pre-wipe check now bails on. Against the pre-fix tree there
    // was no block to extract and this file cannot even be constructed — which
    // is the sense in which it fails before the fix.
    const verdict = runShell(
      [
        'raw="$(zeta_provisioned_longhorn_gib 1)"',
        'sched="$(zeta_schedulable_longhorn_gib "$raw" "$ZETA_LONGHORN_USABLE_PERCENT")"',
        'zeta_longhorn_capacity_verdict "$sched" "$ZETA_LONGHORN_DEMAND_GIB" ""',
      ].join("\n"),
    );
    expect(verdict).toBe("undersized");
  });

  it("adding one 1.4 TiB data disk is enough to clear it — the remedy the bail names first", () => {
    const verdict = runShell(
      [
        'raw="$(zeta_provisioned_longhorn_gib 1 1400)"',
        'sched="$(zeta_schedulable_longhorn_gib "$raw" "$ZETA_LONGHORN_USABLE_PERCENT")"',
        'zeta_longhorn_capacity_verdict "$sched" "$ZETA_LONGHORN_DEMAND_GIB" ""',
      ].join("\n"),
    );
    expect(verdict).toBe("ok");
  });
});
