/**
 * storage-profile-shell-parity.test.ts — docs/ops/INSTALL-TIME-CONFIG.md row 29.
 *
 * Replays the ZETA-STORAGE-PROFILE block of the REAL zeta-install.sh under bash and compares it to
 * `storage-profile-selection.ts` over every input class, then EXECUTES the real
 * `assert_longhorn_pool_holds_the_roster` (with `blockdev` stubbed) on the owner's exact numbers.
 *
 * WHY THE SHELL IS THE IMPLEMENTATION AND THE TS IS THE SPEC: the installer ISO ships no bun and no
 * nodejs and the repo is not cloned until AFTER the wipe, so nothing on the pre-wipe path can execute
 * TypeScript. Same reason, same harness as longhorn-capacity-preflight-shell-parity.test.ts.
 *
 * What this file cannot prove: that the function's CALL SITE is ordered before the wipe
 * (preflights-precede-the-wipe.test.ts pins that), or that a real `blockdev --getsize64` prints what the
 * stub prints. The end-to-end behaviour is the QEMU install lanes' to exercise.
 *
 * Fixture VALUES cross into bash through the ENVIRONMENT, never by interpolation into the script text
 * (see the `$(rm -rf /)` note in repo-pin-shell-parity.test.ts).
 */

import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { closeSync, existsSync, fstatSync, mkdtempSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  decideStorageProfile,
  selectStorageProfile,
  STORAGE_PROFILE_COMMITTED,
  STORAGE_PROFILE_LADDER,
  storageProfileDemandGib,
  storageProfileRank,
} from "./storage-profile-selection.ts";

// Each case below forks bash, and on Windows a fork costs tens of milliseconds: a test that runs the real
// installer function takes seconds there and milliseconds on the Linux runner CI uses.
setDefaultTimeout(120_000);

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const INSTALL_SH = join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh");
const SRC = readFileSync(INSTALL_SH, "utf8");

function block(begin: string, end: string): string {
  const b = SRC.indexOf(begin);
  const e = SRC.indexOf(end);
  if (b < 0 || e < 0 || e < b) throw new Error(`${begin} / ${end} markers missing or out of order in zeta-install.sh`);
  return SRC.slice(b, e + end.length);
}

const CAPACITY = block("# ZETA-LONGHORN-CAPACITY-BEGIN", "# ZETA-LONGHORN-CAPACITY-END");
const PROFILE = block("# ZETA-STORAGE-PROFILE-BEGIN", "# ZETA-STORAGE-PROFILE-END");

const workdir = mkdtempSync(join(tmpdir(), "zeta-storage-profile-"));
writeFileSync(join(workdir, "parity-block.sh"), `${CAPACITY}\n${PROFILE}\n`, "utf8");

/** Runs `script` with both blocks sourced; fixture values via the ENVIRONMENT. */
function runShell(script: string, env: Readonly<Record<string, string>> = {}): string {
  writeFileSync(join(workdir, "runner.sh"), `set -uo pipefail\nsource ./parity-block.sh\n${script}\n`, "utf8");
  const result = spawnSync("bash", ["runner.sh"], { cwd: workdir, encoding: "utf8", env: { ...process.env, ...env } });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error(`bash exited ${String(result.status)}: ${result.stderr}`);
  return result.stdout.trim();
}

// The rung demands (279 / 671 / 1043 / 1701 since 2026-10-02) and one GiB either side of each.
const SCHEDULABLE = [0, 1, 100, 278, 279, 280, 670, 671, 672, 607, 1042, 1043, 1044, 1700, 1701, 1702, 5000];
const REQUESTED = ["", "auto", "minimal", "standard", "measured", "large", "huge", "ci", "Standard", "AUTO", "standard "];
const FLOORS = ["", "minimal", "standard", "measured", "large", "none", "garbage"];
const OVERRIDES = ["", "1", "0", "yes"];

describe("the ZETA-STORAGE-PROFILE block is extractable and self-contained", () => {
  it("carries every function the installer calls", () => {
    for (const fn of [
      "zeta_storage_profile_demand",
      "zeta_storage_profile_names",
      "zeta_storage_profile_rank",
      "zeta_storage_profile_select",
      "zeta_storage_profile_decide",
    ]) {
      expect(PROFILE).toContain(`${fn}()`);
    }
  });

  it("sources cleanly beside the capacity block and nothing else", () => {
    expect(runShell("echo sourced")).toBe("sourced");
  });
});

describe("the shell constants ARE the TypeScript oracle's (and the catalogue's, via storage-profile-install.test.ts)", () => {
  it("ladder names and demands, in order", () => {
    expect(runShell('echo "$ZETA_STORAGE_PROFILE_LADDER"')).toBe(
      STORAGE_PROFILE_LADDER.map((r) => `${r.name}:${String(r.demandGib)}`).join(" "),
    );
  });

  it("the committed rung", () => {
    expect(runShell('echo "$ZETA_STORAGE_PROFILE_COMMITTED"')).toBe(STORAGE_PROFILE_COMMITTED);
  });

  it("zeta_storage_profile_names", () => {
    expect(runShell("zeta_storage_profile_names")).toBe(STORAGE_PROFILE_LADDER.map((r) => r.name).join(" "));
  });

  for (const rung of STORAGE_PROFILE_LADDER) {
    it(`demand and rank of ${rung.name}`, () => {
      expect(runShell('zeta_storage_profile_demand "$N"', { N: rung.name })).toBe(String(rung.demandGib));
      expect(runShell('zeta_storage_profile_rank "$N"', { N: rung.name })).toBe(String(storageProfileRank(rung.name)));
    });
  }

  it("a name that is not a rung has no demand and rank 0 on both sides", () => {
    for (const junk of ["", "ci", "huge", "Standard", "none"]) {
      expect(runShell('zeta_storage_profile_demand "$N"', { N: junk })).toBe("");
      expect(runShell('zeta_storage_profile_rank "$N"', { N: junk })).toBe("0");
      expect(storageProfileDemandGib(junk)).toBeNull();
      expect(storageProfileRank(junk)).toBe(0);
    }
  });
});

/**
 * Replay `cases` (the fields of each case, in order) through ONE bash process, calling `fn` per case with the
 * fields as arguments and with no command substitution around it: a subshell per case is the slow part on
 * Windows, where every fork costs tens of milliseconds.
 */
function replay(fn: string, cases: ReadonlyArray<readonly string[]>): Map<string, string> {
  const unique = [...new Set(cases.map((c) => c.join("|")))];
  writeFileSync(join(workdir, "cases.txt"), `${unique.join("\n")}\n`, "utf8");
  const names = ["a", "b", "c", "d"].slice(0, cases[0]?.length ?? 0);
  const out = runShell(
    [
      ": > out.txt",
      `while IFS="|" read -r ${names.join(" ")}; do`,
      `  printf "%s => " "${names.map((n) => `$${n}`).join("|")}" >> out.txt`,
      `  ${fn} ${names.map((n) => `"$${n}"`).join(" ")} >> out.txt`,
      "done < ./cases.txt",
      "cat out.txt",
    ].join("\n"),
  );
  const got = new Map(out.split("\n").map((line) => line.split(" => ") as [string, string]));
  expect(got.size).toBe(unique.length);
  return got;
}

describe("zeta_storage_profile_select agrees with selectStorageProfile over every input class", () => {
  // Two structured slices rather than the full cross product (see `replay`):
  //   slice 1: every schedulable value x the three requests that matter x with/without a floor
  //   slice 2: every request x every floor, at the owner's 607 GiB
  const cases: string[][] = [];
  for (const s of SCHEDULABLE) for (const r of ["", "standard", "huge"]) for (const f of ["", "standard"]) cases.push([String(s), r, f]);
  for (const r of REQUESTED) for (const f of FLOORS) cases.push(["607", r, f]);

  it("every case", () => {
    const got = replay("zeta_storage_profile_select", cases);
    for (const [s = "", r = "", f = ""] of cases) {
      const spec = selectStorageProfile(Number(s), r, f);
      const expected = spec.ok ? `ok ${spec.profile} ${spec.source}` : `refused ${spec.reason}`;
      expect(got.get(`${s}|${r}|${f}`)).toBe(expected);
    }
  }, 300_000);
});

describe("zeta_storage_profile_decide agrees with decideStorageProfile over every input class", () => {
  it("every case, including the override", () => {
    const cases: string[][] = [];
    for (const s of [0, 1, 279, 607, 1043, 1701])
      for (const r of ["", "large", "huge"])
        for (const f of ["", "large"])
          for (const o of ["", "1"]) cases.push([String(s), r, f, o]);
    for (const o of OVERRIDES) cases.push(["607", "", "none", o]);
    const got = replay("zeta_storage_profile_decide", cases);
    for (const [s = "", r = "", f = "", o = ""] of cases) {
      const d = decideStorageProfile(Number(s), r, f, o);
      const expected = !d.selection.ok
        ? `refused ${d.selection.reason}`
        : [
            d.verdict,
            d.profile === "" ? "-" : d.profile,
            String(d.demandGib),
            d.write ? "1" : "0",
            d.selection.source,
            d.selection.profile,
          ].join(" ");
      expect(got.get(`${s}|${r}|${f}|${o}`)).toBe(expected);
    }
  }, 300_000);
});

// ---------------------------------------------------------------------------
// THE REAL FUNCTION, EXECUTED. `blockdev` is the only thing stubbed.
// ---------------------------------------------------------------------------

const GIB = 1024 ** 3;

/** The globals + the function body, exactly as zeta-install.sh defines them, minus the trailing call. */
function assertFunctionText(): string {
  const begin = SRC.indexOf('ZETA_STORAGE_PROFILE_CHOSEN=""\nZETA_STORAGE_PROFILE_WRITE=0');
  const callMarker = "assert_longhorn_pool_holds_the_roster\n\n# ── Step 2.9";
  const end = SRC.indexOf(callMarker);
  if (begin < 0 || end < 0 || end < begin) throw new Error("assert_longhorn_pool_holds_the_roster not found");
  return SRC.slice(begin, end);
}

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Run the real pool check. `tailGib` is what LONGHORN1_TAIL resolved to, `dataGib` the whole non-boot disks.
 * `set -euo pipefail` is the installer's own, so a function that only works with errexit off fails here too.
 */
function runAssert(
  tailGib: number,
  dataGib: readonly number[],
  env: Readonly<Record<string, string>> = {},
): Run {
  const script = [
    "set -euo pipefail",
    "source ./parity-block.sh",
    'bail() { echo "ERROR: $*" >&2; exit 1; }',
    // blockdev is called as `blockdev --getsize64 <disk>`; the disk name IS the size, in GiB.
    'blockdev() { echo $(( ${2##*/disk} * 1073741824 )); }',
    'BOOT_DISK="/dev/nvme0n1"',
    `LONGHORN1_TAIL_BYTES=${String(tailGib * GIB)}`,
    `LONGHORN1_TAIL="${String(tailGib)}G"`,
    `DATA_DISKS=(${dataGib.map((g) => `"/dev/disk${String(g)}"`).join(" ")})`,
    assertFunctionText(),
    "assert_longhorn_pool_holds_the_roster",
    'echo "RESULT chosen=[${ZETA_STORAGE_PROFILE_CHOSEN}] write=[${ZETA_STORAGE_PROFILE_WRITE}] source=[${ZETA_STORAGE_PROFILE_SOURCE}]"',
  ].join("\n");
  writeFileSync(join(workdir, "assert-runner.sh"), `${script}\n`, "utf8");
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith("ZETA_")) clean[k] = v;
  }
  const result = spawnSync("bash", ["assert-runner.sh"], { cwd: workdir, encoding: "utf8", env: { ...clean, ...env } });
  if (result.error !== undefined) throw result.error;
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

describe("THE OWNER'S INSTALL, through the real assert_longhorn_pool_holds_the_roster", () => {
  // node-5b2dfa: 1 TB boot NVMe -> 810 GiB longhorn1 tail; the second NVMe carries old Longhorn data and was
  // NOT adopted, so it contributes nothing. 810 x 75% = 607 GiB schedulable.
  const owner = runAssert(810, []);

  it("does NOT refuse (it used to bail with 'short by 336 GiB', against a roster that declared 943)", () => {
    expect(owner.stderr).toBe("");
    expect(owner.status).toBe(0);
    expect(owner.stdout).not.toContain("ERROR");
  });

  it("prints the measured pool exactly as the refusal did", () => {
    expect(owner.stdout).toContain("longhorn1 tail on /dev/nvme0n1      810 GiB");
    expect(owner.stdout).toContain("x 75% Longhorn will place       607 GiB");
    expect(owner.stdout).toContain("committed roster DECLARES         1043 GiB");
  });

  it("shows the whole ladder with what fits and what does not", () => {
    // Since 2026-10-02 `standard` is 671 (was 571): postgres-shared, seaweedfs and forgejo are Longhorn claims now.
    expect(owner.stdout).toMatch(/minimal\s+279 GiB\s+fits, 328 GiB spare\s+<- auto choice/);
    expect(owner.stdout).toMatch(/standard\s+671 GiB\s+too big, short by 64 GiB/);
    expect(owner.stdout).toMatch(/measured\s+1043 GiB\s+too big, short by 436 GiB/);
    expect(owner.stdout).toMatch(/large\s+1701 GiB\s+too big, short by 1094 GiB/);
  });

  it("names the profile chosen and what it shrinks", () => {
    expect(owner.stdout).toContain("CHOSEN storage profile: minimal (auto)");
    expect(owner.stdout).toContain("ollama/models 200Gi->10Gi");
    expect(owner.stdout).toContain("vllm/hf-cache 200Gi->10Gi");
    expect(owner.stdout).toContain("written as install-time config");
    expect(owner.stdout).toContain("Growing later needs no reinstall");
    expect(owner.stdout).toContain("It NEVER shrinks");
  });

  it("hands the writer the choice: minimal, to be written", () => {
    expect(owner.stdout).toContain("RESULT chosen=[minimal] write=[1] source=[auto]");
  });
});

describe("the same function on every other pool shape", () => {
  it("a pool that holds the committed profile chooses it and writes NOTHING", () => {
    // 1391 x 75% = 1043.
    const run = runAssert(1391, []);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("RESULT chosen=[measured] write=[0] source=[auto]");
    expect(run.stdout).toContain("the committed profile; nothing is written");
  });

  it("a pool bigger than every profile chooses the top rung", () => {
    // 1000 tail + a 1400 GiB data disk = 2400 raw -> 1800 schedulable.
    const run = runAssert(1000, [1400]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("RESULT chosen=[large] write=[1] source=[auto]");
  });

  it("a 1 GiB pool REFUSES, naming the smallest profile and the three remedies", () => {
    const run = runAssert(1, []);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("even the SMALLEST storage profile, 'minimal', declares 279 GiB");
    expect(run.stderr).toContain("short by 279 GiB");
    expect(run.stderr).toContain("Nothing has been wiped");
    expect(run.stderr).toContain("(1) ADD A SECOND INTERNAL DISK");
    expect(run.stderr).toContain("(2) raise the boot disk's Longhorn slice, e.g. LONGHORN1_TAIL=373G");
    expect(run.stderr).toContain("(3) install anyway");
    expect(run.stderr).toContain("ZETA_ALLOW_LONGHORN_UNDERSIZED=1");
  });

  it("the smallest profile is the boundary: 372 GiB tail (279 schedulable) installs, 371 refuses", () => {
    expect(runAssert(372, []).stdout).toContain("RESULT chosen=[minimal] write=[1] source=[auto]");
    expect(runAssert(371, []).status).toBe(1);
  });

  it("under ZETA_ALLOW_LONGHORN_UNDERSIZED=1 nothing fits -> the committed tree applies, nothing is written", () => {
    const run = runAssert(1, [], { ZETA_ALLOW_LONGHORN_UNDERSIZED: "1" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("RESULT chosen=[] write=[0] source=[auto]");
    expect(run.stdout).toContain("NONE chosen");
    expect(run.stdout).toContain("proceeding on ZETA_ALLOW_LONGHORN_UNDERSIZED=1 override");
  });

  it("a second internal disk is the remedy the old refusal named first, and it still works", () => {
    const run = runAssert(1, [1400]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("RESULT chosen=[measured] write=[0] source=[auto]");
  });
});

describe("the explicit override (ZETA_STORAGE_PROFILE=<name>) — how the owner forces a bigger profile later", () => {
  it("a bigger profile is honoured when the pool holds it", () => {
    const run = runAssert(1000, [1400], { ZETA_STORAGE_PROFILE: "large" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("RESULT chosen=[large] write=[1] source=[explicit]");
  });

  it("is refused when the pool cannot hold it, saying what auto WOULD have chosen", () => {
    const run = runAssert(810, [], { ZETA_STORAGE_PROFILE: "large" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("ZETA_STORAGE_PROFILE='large' declares 1701 GiB");
    expect(run.stderr).toContain("ZETA_STORAGE_PROFILE=auto would choose: minimal auto");
  });

  it("`auto` spelled out is the same as unset", () => {
    expect(runAssert(810, [], { ZETA_STORAGE_PROFILE: "auto" }).stdout).toContain("RESULT chosen=[minimal] write=[1] source=[auto]");
  });

  it("a name that is not a profile REFUSES before the wipe and lists the real ones", () => {
    const run = runAssert(810, [], { ZETA_STORAGE_PROFILE: "huge" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("ZETA_STORAGE_PROFILE='huge' is neither 'auto' nor a storage profile (known: minimal standard measured large)");
    expect(run.stderr).toContain("Nothing has been wiped");
  });
});

describe("NEVER SHRINKS, through the real function: a re-install over an existing one cannot go below it", () => {
  it("a recovered `large` floors the choice, and an undersized pool then REFUSES instead of shrinking", () => {
    const run = runAssert(810, [], { ZETA_REPAIR_STORAGE_PROFILE: "large" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("The prior install on this node ran storage profile 'large'");
    expect(run.stderr).toContain("a profile is never shrunk");
    expect(run.stderr).toContain("ZETA_STORAGE_PROFILE_FLOOR=none");
  });

  it("the HIGH-WATER mark counts too: the higher of the two recovered values is the floor", () => {
    const run = runAssert(810, [], { ZETA_REPAIR_STORAGE_PROFILE: "standard", ZETA_REPAIR_STORAGE_PROFILE_HW: "large" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("storage profile 'large'");
  });

  it("a floor the pool DOES hold is kept, and a bigger pool grows past it", () => {
    // A 900 GiB tail is 675 schedulable: holds `standard` (671) and not `measured` (1043).
    expect(runAssert(900, [], { ZETA_REPAIR_STORAGE_PROFILE: "standard" }).stdout).toContain("RESULT chosen=[standard] write=[1] source=[auto]");
    expect(runAssert(1000, [1400], { ZETA_REPAIR_STORAGE_PROFILE: "standard" }).stdout).toContain("RESULT chosen=[large] write=[1] source=[auto]");
  });

  it("an explicit request BELOW the floor is refused as a shrink", () => {
    const run = runAssert(810, [], { ZETA_REPAIR_STORAGE_PROFILE: "standard", ZETA_STORAGE_PROFILE: "minimal" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("ZETA_STORAGE_PROFILE='minimal' is SMALLER than 'standard'");
  });

  it("ZETA_STORAGE_PROFILE_FLOOR=none is the NAMED act of someone destroying the old volumes", () => {
    const run = runAssert(810, [], { ZETA_REPAIR_STORAGE_PROFILE: "large", ZETA_STORAGE_PROFILE_FLOOR: "none" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("RESULT chosen=[minimal] write=[1] source=[auto]");
  });

  it("a recovered value that is not a rung is ignored rather than trusted", () => {
    const run = runAssert(810, [], { ZETA_REPAIR_STORAGE_PROFILE: "garbage", ZETA_REPAIR_STORAGE_PROFILE_HW: "<script>" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("RESULT chosen=[minimal] write=[1] source=[auto]");
  });
});

// ---------------------------------------------------------------------------
// THE WRITER (Step 6.64c): executed against a temp directory.
// ---------------------------------------------------------------------------

function writerText(): string {
  const begin = SRC.indexOf('if [ "${ZETA_ROLE:-}" = "joiner" ]; then\n  # The cluster\'s sizes are the FOUNDER\'s');
  // Step 6.64d (the container-store disk, 081M44HD9T2087G0R000G9NR1N) now sits between this writer and Step 6.65.
  const endMarker = "# ── Step 6.64d: put the container store on a data disk";
  const end = SRC.indexOf(endMarker);
  if (begin < 0 || end < 0 || end < begin) throw new Error("Step 6.64c writer not found");
  return SRC.slice(begin, end);
}

function runWriter(env: Readonly<Record<string, string>>): { status: number; stdout: string; stderr: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "zeta-sp-writer-"));
  const text = writerText().replaceAll("/mnt/etc/zeta", `${dir.replaceAll("\\", "/")}/etc-zeta`);
  const script = [
    "set -euo pipefail",
    "source ./parity-block.sh",
    'bail() { echo "ERROR: $*" >&2; exit 1; }',
    'sudo() { "$@"; }',
    text,
  ].join("\n");
  writeFileSync(join(workdir, "writer-runner.sh"), `${script}\n`, "utf8");
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith("ZETA_")) clean[k] = v;
  }
  const result = spawnSync("bash", ["writer-runner.sh"], { cwd: workdir, encoding: "utf8", env: { ...clean, ...env } });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr, dir: `${dir}/etc-zeta` };
}

describe("Step 6.64c writes /etc/zeta/storage-profile only for a rung that differs from the committed one", () => {
  it("WRITE=1 writes the bare rung name, world-readable (a public identifier, like lb-pool)", () => {
    const run = runWriter({ ZETA_STORAGE_PROFILE_WRITE: "1", ZETA_STORAGE_PROFILE_CHOSEN: "standard", ZETA_STORAGE_PROFILE_SOURCE: "auto" });
    expect(run.status).toBe(0);
    const file = join(run.dir, "storage-profile");
    // One handle, both answers: the bytes and the mode describe the same file.
    const fd = openSync(file, "r");
    try {
      expect(readFileSync(fd, "utf8")).toBe("standard\n");
      if (process.platform !== "win32") expect(fstatSync(fd).mode & 0o777).toBe(0o644);
    } finally {
      closeSync(fd);
    }
  });

  it("WRITE=0 writes nothing and says the committed profile applies", () => {
    const run = runWriter({ ZETA_STORAGE_PROFILE_WRITE: "0", ZETA_STORAGE_PROFILE_CHOSEN: "measured" });
    expect(run.status).toBe(0);
    expect(existsSync(join(run.dir, "storage-profile"))).toBe(false);
    expect(run.stdout).toContain("the committed 'measured' profile applies");
  });

  it("a chosen name that is not on the ladder is REFUSED, never written into a manifest", () => {
    const run = runWriter({ ZETA_STORAGE_PROFILE_WRITE: "1", ZETA_STORAGE_PROFILE_CHOSEN: "x'; evil" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("is not on the ladder");
    expect(existsSync(join(run.dir, "storage-profile"))).toBe(false);
  });

  it("a JOINER writes nothing: the founder's cluster owns the sizes and the module acts only on a server", () => {
    const run = runWriter({ ZETA_ROLE: "joiner", ZETA_STORAGE_PROFILE_WRITE: "1", ZETA_STORAGE_PROFILE_CHOSEN: "standard" });
    expect(run.status).toBe(0);
    expect(existsSync(join(run.dir, "storage-profile"))).toBe(false);
    expect(run.stdout).toContain("joiner: the founder's storage profile applies");
  });
});
