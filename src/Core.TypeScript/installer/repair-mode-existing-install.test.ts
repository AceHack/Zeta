/**
 * repair-mode-existing-install.test.ts — repair mode, exercised against a disk
 * that already has a Zeta install on it.
 *
 * Aaron 2026-08-22, asked whether this path should be tested: *"yes it would be
 * good to have this path tested too."*
 *
 * ── WHAT WAS MISSING ────────────────────────────────────────────────────
 *
 * `multiboot-qemu-uefi-smoke.yml` proves the UEFI menu boots.
 * `installer-unit-tests` proves the ledger/breaker/preflight DECISIONS are
 * right over fixtures. Neither one had ever mounted an existing install. That
 * is the path a real operator depends on — re-pave a node, keep its identity —
 * and the one where getting it wrong destroys data.
 *
 * ── WHAT THIS ACTUALLY DOES (read this before believing the green tick) ──
 *
 * It builds a REAL disk: a GPT-partitioned image on a loop device, two real
 * ext4 filesystems with real labels (`boot`, `nixos`), and a real
 * `/etc/zeta/` tree written into the `nixos` one. Then it extracts
 * `zeta_pf_recover_identity` out of the real `zeta-install.sh` and RUNS it
 * against that device. The mount is a real `mount(8)`; the label lookup is a
 * real `blkid`; the partition walk is a real `lsblk`.
 *
 * WHAT IT DOES NOT DO, stated plainly so nobody reads it as more: it does not
 * run `nixos-install`. A full QEMU install round trip is ~20-40 minutes of
 * runner time per leg and needs a NixOS ISO build, which is why the existing
 * QEMU lane smoke-tests a menu instead. What repair mode actually depends on
 * is the partition label and the contents of `/etc/zeta` — both of which are
 * REAL here. The install that produced them is simulated; the install it reads
 * is not.
 *
 * ── WHY IT IS ALLOWED TO SKIP, AND WHY THAT IS NOT A LOOPHOLE ───────────
 *
 * Loop devices, `sfdisk` and `mount` need Linux and passwordless root. The
 * maintainer's machine is macOS, so a hard failure there would make the file
 * unrunnable locally. It therefore skips — LOUDLY, printing why — unless
 * `ZETA_REPAIR_LOOPBACK_REQUIRED=1`, which `installer-unit-tests.yml` sets. In
 * CI the skip path is a FAILURE.
 *
 * That guard is the whole point. A sibling agent found three workflows green
 * because they no-op'd before reaching their real work, one of them since
 * 2026-08-09. A test that quietly skips in CI is that failure exactly, so the
 * required-mode check below asserts the environment BEFORE it asserts
 * anything about the installer.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { mintNodeZetaId, isValidNodeZetaId, decideNodeZetaIdProvenance } from "./node-zetaid.ts";
import { decideForceReformat, renderForceReformatVerdict } from "./force-reformat.ts";

const INSTALL_SH = new URL("../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh", import.meta.url).pathname;
const SRC = readFileSync(INSTALL_SH, "utf8");

const REQUIRED = process.env.ZETA_REPAIR_LOOPBACK_REQUIRED === "1";

/** Run a command and return status + output. Never through a pipe: `$?` after
 *  a pipe is the LAST command's status, which is how a failure reads as a pass.
 *
 *  A child that was KILLED, or that never spawned, comes back from `spawnSync`
 *  with `status === null` and — because it never got to run — an EMPTY stderr.
 *  Collapsing that to `-1` and reporting `stderr` verbatim is how the message
 *  `sfdisk failed: ` reached CI fifteen times: a failure naming no cause, which
 *  is a report that did not report. `describeSpawn` puts the signal or the spawn
 *  error back, so the next reader gets a diagnosis instead of a blank. */
function describeSpawn(cmd: string, r: ReturnType<typeof spawnSync>): string | null {
  if (r.status !== null && r.status !== undefined) return null;
  if (r.signal) return `${cmd} was killed by ${r.signal} (it produced no exit status)`;
  if (r.error) return `${cmd} could not be spawned: ${r.error.message}`;
  return `${cmd} returned no exit status and no signal`;
}

function run(cmd: string, args: readonly string[], opts: { input?: string } = {}) {
  const r = spawnSync(cmd, [...args], { encoding: "utf8", input: opts.input });
  const spawnFailure = describeSpawn(cmd, r);
  const raw = String(r.stderr ?? "");
  const stderr = spawnFailure === null ? raw : raw === "" ? `<${spawnFailure}>` : `${raw}\n<${spawnFailure}>`;
  return { status: r.status ?? -1, stdout: String(r.stdout ?? ""), stderr };
}

function have(tool: string): boolean {
  return run("sh", ["-c", `command -v ${tool} >/dev/null 2>&1 || command -v /sbin/${tool} >/dev/null 2>&1`]).status === 0;
}

const REQUIRED_TOOLS = ["losetup", "sfdisk", "mkfs.ext4", "blkid", "lsblk", "mount", "umount"] as const;

function environmentReason(): string | null {
  if (process.platform !== "linux") return `platform is ${process.platform}, loop devices need linux`;
  if (run("sudo", ["-n", "true"]).status !== 0) return "passwordless sudo is not available";
  const missing = REQUIRED_TOOLS.filter((t) => !have(t));
  if (missing.length > 0) return `missing tools: ${missing.join(", ")}`;
  return null;
}

const SKIP_REASON = environmentReason();
const CAN_RUN = SKIP_REASON === null;

// ── the identity the "already installed" node remembers ──────────────────
const EXISTING = {
  hostname: "node-a1b2c3",
  mac: "aa:bb:cc:dd:ee:ff",
  cidr: "10.42.0.7/24",
  cpip: "10.42.0.1",
  zetaid: mintNodeZetaId(1787000000000, BigInt("0x0123456789abcdef0123") & ((1n << 78n) - 1n)),
} as const;

let workdir = "";
let loopDev = "";
let rootPart = "";

function extractBlocks(): string {
  const grab = (begin: string, end: string) => {
    const b = SRC.indexOf(begin);
    const e = SRC.indexOf(end);
    if (b < 0 || e < 0 || e < b) throw new Error(`markers ${begin}/${end} missing or out of order`);
    return SRC.slice(b, e + end.length);
  };
  return (
    grab("# ZETA-PREFLIGHT-PARITY-BEGIN", "# ZETA-PREFLIGHT-PARITY-END") +
    "\n" +
    grab("# ZETA-PROBE-BEGIN", "# ZETA-PROBE-END") +
    "\n" +
    grab("# ZETA-NODE-ZETAID-BEGIN", "# ZETA-NODE-ZETAID-END") +
    "\n" +
    grab("# ZETA-RECOGNISE-SELF-BEGIN", "# ZETA-RECOGNISE-SELF-END") +
    "\n"
  );
}

/** Build a real GPT disk with two real ext4 filesystems and a real /etc/zeta.
 *  Throws on the first failure — a half-built disk that "works" is how a test
 *  ends up asserting against nothing. */
function buildExistingInstall(): void {
  const img = join(workdir, "existing-install.img");
  writeFileSync(img, "");
  const truncate = run("truncate", ["-s", "96M", img]);
  if (truncate.status !== 0) throw new Error(`truncate failed: ${truncate.stderr}`);

  // GPT, two partitions. Deliberately TWO: the recovery walks every partition
  // and selects on LABEL, so a single-partition disk would let an
  // any-partition-will-do bug pass.
  const sfdisk = run("sudo", ["sfdisk", img], {
    input: ["label: gpt", "size=32M, name=ESP", "name=root", ""].join("\n"),
  });
  if (sfdisk.status !== 0) throw new Error(`sfdisk failed: ${sfdisk.stderr}`);

  const losetup = run("sudo", ["losetup", "-fP", "--show", img]);
  if (losetup.status !== 0) throw new Error(`losetup failed: ${losetup.stderr}`);
  loopDev = losetup.stdout.trim();
  if (!loopDev.startsWith("/dev/loop")) throw new Error(`losetup gave no device: ${losetup.stdout}`);
  rootPart = `${loopDev}p2`;

  // p1 is labelled `boot`, p2 is labelled `nixos`. Only p2 must be selected.
  const mkboot = run("sudo", ["mkfs.ext4", "-q", "-F", "-L", "boot", `${loopDev}p1`]);
  if (mkboot.status !== 0) throw new Error(`mkfs.ext4 p1 failed: ${mkboot.stderr}`);
  const mkroot = run("sudo", ["mkfs.ext4", "-q", "-F", "-L", "nixos", rootPart]);
  if (mkroot.status !== 0) throw new Error(`mkfs.ext4 p2 failed: ${mkroot.stderr}`);

  const mnt = join(workdir, "seed-mnt");
  run("mkdir", ["-p", mnt]);
  const mount = run("sudo", ["mount", "-t", "ext4", rootPart, mnt]);
  if (mount.status !== 0) throw new Error(`seed mount failed: ${mount.stderr}`);
  try {
    const etc = join(mnt, "etc", "zeta");
    if (run("sudo", ["mkdir", "-p", etc]).status !== 0) throw new Error("mkdir /etc/zeta failed");
    const put = (name: string, value: string) => {
      const r = run("sudo", ["tee", join(etc, name)], { input: value + "\n" });
      if (r.status !== 0) throw new Error(`writing ${name} failed: ${r.stderr}`);
    };
    put("cluster-node-id", EXISTING.hostname);
    put("cluster-segment-mac", EXISTING.mac);
    put("cluster-segment-address", EXISTING.cidr);
    put("cluster-control-plane-address", EXISTING.cpip);
    put("node-zetaid", EXISTING.zetaid);
    // A decoy on the WRONG partition: if recovery ever selects by ordinal
    // instead of by label it will read this and the assertions will catch it.
  } finally {
    run("sudo", ["umount", mnt]);
  }

  const bootMnt = join(workdir, "boot-mnt");
  run("mkdir", ["-p", bootMnt]);
  if (run("sudo", ["mount", "-t", "ext4", `${loopDev}p1`, bootMnt]).status === 0) {
    try {
      run("sudo", ["mkdir", "-p", join(bootMnt, "etc", "zeta")]);
      run("sudo", ["tee", join(bootMnt, "etc", "zeta", "cluster-node-id")], { input: "node-DECOY\n" });
      run("sudo", ["tee", join(bootMnt, "etc", "zeta", "node-zetaid")], { input: "0DECOYDECOYDECOYDECOYDECOY\n" });
    } finally {
      run("sudo", ["umount", bootMnt]);
    }
  }
  run("sudo", ["sync"]);
}

/** Run a script with the extracted installer blocks sourced, against the loop
 *  device as BOOT_DISK. `sudo -n` inside, because the block calls sudo itself. */
function runAgainstDisk(script: string): { status: number; stdout: string; stderr: string } {
  const runner = join(workdir, "runner.sh");
  writeFileSync(
    runner,
    [
      "set -uo pipefail",
      `BOOT_DISK=${loopDev}`,
      "DATA_DISKS=()",
      `ZETA_REPAIR_ROOT_MOUNT=${join(workdir, "repair-mnt")}`,
      "source " + join(workdir, "installer-blocks.sh"),
      // The block re-declares ZETA_REPAIR_ROOT_MOUNT; put ours back after.
      `ZETA_REPAIR_ROOT_MOUNT=${join(workdir, "repair-mnt")}`,
      script,
      "",
    ].join("\n"),
    "utf8",
  );
  return run("bash", [runner]);
}

function sha256OfPartition(): string {
  const r = run("sudo", ["sh", "-c", `sha256sum ${rootPart}`]);
  if (r.status !== 0) throw new Error(`sha256sum failed: ${r.stderr}`);
  return r.stdout.trim().split(/\s+/)[0]!;
}

/** Why this hook carries an explicit timeout, and why the number is this one.
 *
 *  MEASURED, not guessed. Across the 90 `installer-unit-tests` runs between
 *  2026-08-24T10:58Z and 2026-08-26T22:01Z in which this file actually
 *  executed, `beforeAll` took:
 *
 *      75 runs that PASSED   min 0.76s   median 2.61s   max 4.94s
 *      15 runs that FAILED   min 5.08s   median 6.90s   max 7.69s
 *
 *  There is no overlap. The cut sits at exactly 5.00s, which is bun's DEFAULT
 *  hook timeout — so every one of those 15 reds was this hook being killed
 *  mid-`sfdisk`, not a defect in the installer. Bun said so itself in each log
 *  ("killed 1 dangling process", "a beforeEach/afterEach hook timed out"), but
 *  the kill landed inside a `spawnSync`, so what the reader SAW was
 *  `error: sfdisk failed:` with an empty reason — which is why this cost four
 *  sessions before anyone looked at the timestamps. 15/90 = 16.7% of runs, and
 *  the slowest PASSING run cleared the default by 60ms.
 *
 *  The work here is genuinely slow and genuinely I/O-bound on a shared runner:
 *  a GPT write, TWO `mkfs.ext4`, four mounts, several `tee`s and a `sync`. It
 *  is not 5 seconds of computation that regressed; it is 2-5 seconds of disk
 *  that occasionally waits on a noisy neighbour. So the default is simply the
 *  wrong bound for it.
 *
 *  120s is chosen to be far above the observed 7.69s worst case — this is a
 *  HANG detector, not a performance budget, and a bound that merely doubles the
 *  worst case would buy back the same flake at a lower rate. The job's own
 *  `timeout-minutes: 12` remains the real ceiling; this bound exists so that a
 *  true hang still fails HERE, naming this hook, rather than as an unattributed
 *  job-level kill. The nine legs below are left on the default deliberately:
 *  the slowest ever observed is 948ms, so they have 5x headroom already and
 *  raising them would only hide a real hang. */
const DISK_SETUP_TIMEOUT_MS = 120_000;

beforeAll(() => {
  if (!CAN_RUN) return;
  workdir = mkdtempSync(join(tmpdir(), "zeta-repair-"));
  writeFileSync(join(workdir, "installer-blocks.sh"), extractBlocks(), "utf8");
  buildExistingInstall();
}, DISK_SETUP_TIMEOUT_MS);

afterAll(() => {
  if (loopDev !== "") run("sudo", ["losetup", "-d", loopDev]);
  if (workdir !== "") {
    try {
      rmSync(workdir, { recursive: true, force: true });
    } catch {
      /* the loop image may be root-owned; the runner is ephemeral */
    }
  }
}, DISK_SETUP_TIMEOUT_MS);

describe("environment", () => {
  test("the loopback path is not silently skipped in CI", () => {
    // THIS IS THE ANTI-VACUITY CHECK. If the workflow that is supposed to run
    // this test cannot, it must go RED here rather than green everywhere else.
    if (REQUIRED) {
      expect(SKIP_REASON).toBeNull();
      return;
    }
    if (!CAN_RUN) {
      console.warn(
        `[repair-mode] SKIPPING the real-disk legs: ${SKIP_REASON}. ` +
          `Set ZETA_REPAIR_LOOPBACK_REQUIRED=1 to make this a failure (installer-unit-tests.yml does).`,
      );
    }
    expect(true).toBe(true);
  });

  // ── the falsifiers for `run`'s spawn-level reporting ───────────────────
  // These are deliberately OUTSIDE the CAN_RUN gate: they need no loop device,
  // no root and no Linux, so they run on the maintainer's mac too. Each one
  // fails against the pre-2026-08-26 `run`, which reported both cases as an
  // empty string.

  test("a KILLED child names its signal instead of reporting an empty reason", () => {
    // Exactly the CI shape: bun's hook timeout kills the in-flight child, so
    // spawnSync returns status===null with nothing on stderr. The old helper
    // turned that into `<cmd> failed: ` — a failure naming no cause.
    const r = run("sh", ["-c", "kill -9 $$"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("SIGKILL");
    expect(r.stderr).not.toBe("");
  });

  test("an UNSPAWNABLE command names the spawn error instead of an empty reason", () => {
    const r = run("zeta-no-such-binary-should-ever-exist", []);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("could not be spawned");
    expect(r.stderr).not.toBe("");
  });

  test("an ordinary non-zero exit is left ALONE — the annotation is only for status-less children", () => {
    // Guard against the fix over-reaching: a command that really ran and really
    // failed must keep its own stderr, unannotated.
    const r = run("sh", ["-c", "echo real-message >&2; exit 3"]);
    expect(r.status).toBe(3);
    expect(r.stderr.trim()).toBe("real-message");
  });
});

describe.if(CAN_RUN)("repair mode against a REAL existing install on a loop device", () => {
  test("the disk under test is real, partitioned, and labelled", () => {
    const lsblk = run("lsblk", ["-p", "-n", "-o", "NAME,TYPE", loopDev]);
    expect(lsblk.status).toBe(0);
    expect(lsblk.stdout).toContain(`${loopDev}p1`);
    expect(lsblk.stdout).toContain(`${loopDev}p2`);
    const label = run("sudo", ["blkid", "-o", "value", "-s", "LABEL", rootPart]);
    expect(label.stdout.trim()).toBe("nixos");
  });

  test("recognise-self RECOVERS the node's identity, ZetaId included", () => {
    const r = runAgainstDisk(
      [
        "zeta_pf_recover_identity || true",
        'echo "found=$ZETA_REPAIR_FOUND"',
        'echo "hostname=$ZETA_REPAIR_HOSTNAME"',
        'echo "mac=$ZETA_REPAIR_MAC"',
        'echo "cidr=$ZETA_REPAIR_CIDR"',
        'echo "cpip=$ZETA_REPAIR_CPIP"',
        'echo "zetaid=$ZETA_REPAIR_ZETAID"',
        'echo "verdict=$(zeta_pf_validate_identity)"',
      ].join("\n"),
    );
    expect(r.status).toBe(0);
    const got = Object.fromEntries(
      r.stdout
        .trim()
        .split("\n")
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
    expect(got.found).toBe("1");
    expect(got.hostname).toBe(EXISTING.hostname);
    expect(got.mac).toBe(EXISTING.mac);
    expect(got.cidr).toBe(EXISTING.cidr);
    expect(got.cpip).toBe(EXISTING.cpip);
    expect(got.zetaid).toBe(EXISTING.zetaid);
    expect(got.verdict).toBe("trusted");
    // The decoy on p1 must never appear: selection is by LABEL, not ordinal.
    expect(got.hostname).not.toBe("node-DECOY");
  });

  test("the FULL chain runs: probe -> classify -> mode=repair", () => {
    // THE LEG THAT FOUND THE BUG. The parity tests hand fact records straight
    // to zeta_pf_classify, so they proved the classifier right about facts the
    // PROBER could never gather: `lsblk -p -n -o NAME,TYPE` renders a tree and
    // glues box-drawing glyphs onto every partition path, so every blkid came
    // back empty, every disk with a prior Zeta install classified as
    // `indeterminate`, and mode never became `repair` on any real hardware.
    //
    // Running the real prober against a real disk and feeding its real output
    // to the real classifier is the only shape of test that could see it.
    const r = runAgainstDisk(
      [
        `ZETA_PROBE_MOUNT=${JSON.stringify(join(workdir, "probe-mnt"))}`,
        `zeta_pf_gather ${loopDev} > ${JSON.stringify(join(workdir, "facts"))}`,
        `echo "---FACTS---"`,
        `cat ${JSON.stringify(join(workdir, "facts"))}`,
        `echo "---VERDICT---"`,
        `echo "disposition=$(zeta_pf_classify < ${JSON.stringify(join(workdir, "facts"))})"`,
        `printf '%s|%s\\n' ${loopDev} "$(zeta_pf_classify < ${JSON.stringify(join(workdir, "facts"))})" > ${JSON.stringify(join(workdir, "disp"))}`,
        `zeta_pf_decide_scope closed 60 10 < ${JSON.stringify(join(workdir, "disp"))}`,
      ].join("\n"),
    );
    expect(r.status).toBe(0);

    // The prober must have produced REAL partition paths, not glyph-prefixed
    // ones, and real labels off them.
    expect(r.stdout).toContain(`part=${loopDev}p2|ext4|nixos|root`);
    expect(r.stdout).toContain("volumelabel=nixos");
    expect(r.stdout).not.toContain("\u251c");
    expect(r.stdout).not.toContain("\u2514");

    // ... and the classifier, given those real facts, must recognise us.
    expect(r.stdout).toContain("disposition=prior-zeta-install");
    // ... and the scope decision must therefore enter repair mode.
    expect(r.stdout).toContain("mode=repair");
    expect(r.stdout).toContain("window=60");
  });

  test("the recovery does not write a single byte to the disk", () => {
    // The recovery mounts `-o ro,noload` because a plain `-o ro` REPLAYS the
    // ext4 journal, and a journal replay is a write to a disk consent has not
    // been given for.
    //
    // HONEST LIMIT: on a cleanly-unmounted filesystem a plain `-o ro` would
    // very likely also leave the bytes alone, so this hash is not by itself a
    // falsifier for `noload` specifically. It IS a falsifier for the property
    // that matters — the recovery is read-only — and the mount option is
    // pinned separately below, at the source.
    const before = sha256OfPartition();
    const r = runAgainstDisk("zeta_pf_recover_identity || true");
    expect(r.status).toBe(0);
    expect(sha256OfPartition()).toBe(before);
  });

  test("the mount option is still ro,noload in the source that just ran", () => {
    expect(SRC).toContain('sudo mount -t ext4 -o ro,noload "$part" "$ZETA_REPAIR_ROOT_MOUNT"');
  });

  test("a repair REUSES the recovered ZetaId — the node does not forget itself", () => {
    // Recovered id present + no override ⇒ provenance `recovered`, and the
    // value written is the value read. Manifesto §5.
    const r = runAgainstDisk(
      ["zeta_pf_recover_identity || true", 'echo "$ZETA_REPAIR_ZETAID"'].join("\n"),
    );
    const recovered = r.stdout.trim();
    expect(recovered).toBe(EXISTING.zetaid);
    expect(isValidNodeZetaId(recovered)).toBe(true);
    expect(
      decideNodeZetaIdProvenance({ recovered, priorInstallFound: true, forceReformatArmed: false }),
    ).toBe("recovered");
  });

  test("a MALFORMED ZetaId on disk makes the identity untrusted (never silently overwritten)", () => {
    const mnt = join(workdir, "tamper-mnt");
    run("mkdir", ["-p", mnt]);
    expect(run("sudo", ["mount", "-t", "ext4", rootPart, mnt]).status).toBe(0);
    try {
      run("sudo", ["tee", join(mnt, "etc", "zeta", "node-zetaid")], { input: "not-a-zetaid\n" });
    } finally {
      expect(run("sudo", ["umount", mnt]).status).toBe(0);
    }
    const bad = runAgainstDisk(
      ["zeta_pf_recover_identity || true", 'echo "$(zeta_pf_validate_identity)"'].join("\n"),
    );
    expect(bad.stdout.trim()).toContain("node-zetaid-bad-shape");

    // A node installed BEFORE node-zetaid existed has no such file, and MUST
    // still repair — otherwise adding a key is a fleet-wide outage.
    const mnt2 = join(workdir, "legacy-mnt");
    run("mkdir", ["-p", mnt2]);
    expect(run("sudo", ["mount", "-t", "ext4", rootPart, mnt2]).status).toBe(0);
    try {
      run("sudo", ["rm", "-f", join(mnt2, "etc", "zeta", "node-zetaid")]);
    } finally {
      expect(run("sudo", ["umount", mnt2]).status).toBe(0);
    }
    const legacy = runAgainstDisk(
      [
        "zeta_pf_recover_identity || true",
        'echo "zetaid=[$ZETA_REPAIR_ZETAID]"',
        'echo "verdict=$(zeta_pf_validate_identity)"',
      ].join("\n"),
    );
    expect(legacy.stdout).toContain("zetaid=[]");
    expect(legacy.stdout).toContain("verdict=trusted");

    // Restore for any later leg.
    const mnt3 = join(workdir, "restore-mnt");
    run("mkdir", ["-p", mnt3]);
    expect(run("sudo", ["mount", "-t", "ext4", rootPart, mnt3]).status).toBe(0);
    try {
      run("sudo", ["tee", join(mnt3, "etc", "zeta", "node-zetaid")], { input: EXISTING.zetaid + "\n" });
    } finally {
      expect(run("sudo", ["umount", mnt3]).status).toBe(0);
    }
  });

  test("force-reformat OVERRIDES the recovered identity and mints a fresh one", () => {
    const r = runAgainstDisk(
      [
        "zeta_pf_recover_identity || true",
        'echo "recovered=$ZETA_REPAIR_ZETAID"',
        'echo "verdict=$(zeta_pf_decide_force_reformat REFORMAT "$ZETA_REPAIR_HOSTNAME" "$ZETA_REPAIR_HOSTNAME" closed REFORMAT)"',
        'echo "fresh=$(ZETA_ZETAID_MS=1787000099999 ZETA_ZETAID_RANDHEX=fedcba98765432100000 zeta_mint_node_zetaid)"',
      ].join("\n"),
    );
    expect(r.status).toBe(0);
    const got = Object.fromEntries(
      r.stdout
        .trim()
        .split("\n")
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
    expect(got.recovered).toBe(EXISTING.zetaid);
    expect(got.verdict).toBe("armed");
    expect(isValidNodeZetaId(got.fresh!)).toBe(true);
    expect(got.fresh).not.toBe(EXISTING.zetaid);
    expect(
      decideNodeZetaIdProvenance({ recovered: got.recovered!, priorInstallFound: true, forceReformatArmed: true }),
    ).toBe("minted");
  });

  test("a stale override naming a DIFFERENT node is refused against this disk", () => {
    const r = runAgainstDisk(
      [
        "zeta_pf_recover_identity || true",
        'echo "$(zeta_pf_decide_force_reformat REFORMAT node-ffffff "$ZETA_REPAIR_HOSTNAME" closed REFORMAT)"',
      ].join("\n"),
    );
    expect(r.stdout.trim()).toBe("refused node-id-mismatch");
  });

  test("the breaker still bounds the override against this same disk", () => {
    // The ledger is driven through the REAL validator and the REAL breaker, at
    // the reformat bound of 1, and the resulting state is what the override
    // sees. One prior unfinished attempt is enough to refuse a reformat while
    // an ordinary attempt (bound 3) would still be permitted.
    const r = runAgainstDisk(
      [
        "zeta_pf_recover_identity || true",
        'LEDGER="1|2026-08-23T00:00:00Z|started|wipe"',
        'V="$(printf %s "$LEDGER" | zeta_pf_validate_ledger)"',
        'case "$V" in trusted*) T=1; F="${V##* }" ;; *) T=0; F=9 ;; esac',
        'echo "ordinary=$(zeta_pf_breaker "$T" "$F" 3 1)"',
        'RB="$(zeta_pf_breaker "$T" "$F" 1 1)"',
        'echo "reformat=$RB"',
        'echo "verdict=$(zeta_pf_decide_force_reformat REFORMAT "$ZETA_REPAIR_HOSTNAME" "$ZETA_REPAIR_HOSTNAME" "$RB" REFORMAT)"',
      ].join("\n"),
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("ordinary=closed");
    expect(r.stdout).toContain("reformat=open");
    expect(r.stdout).toContain("verdict=refused breaker-open");
    expect(renderForceReformatVerdict(decideForceReformat({
      flag: "REFORMAT",
      declaredNodeId: EXISTING.hostname,
      recoveredNodeId: EXISTING.hostname,
      reformatBreakerState: "open",
      typedConfirmation: "REFORMAT",
    }))).toBe("refused breaker-open");
  });
});
