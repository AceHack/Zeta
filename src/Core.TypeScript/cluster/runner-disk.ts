// Runner disk — the half of the envelope nothing measured.
//
// WHY THIS EXISTS
// ---------------
// `storage-profiles.json`'s `runnerEnvelope` records three capacities for a
// GitHub-hosted `ubuntu-24.04` runner: 4000m CPU, 15360Mi memory, and
// **14 GiB free disk**. Its own `reservationEvidence` says the capacity half is
// "a vendor number, not one we measured, which is why `--measure-runner`
// exists" — and `measureRunner` reads `/proc/cpuinfo` and `/proc/meminfo`.
// It reads NO disk. So two thirds of that sentence were true and the third was
// a claim with no comparator: the number the whole image-footprint argument is
// divided by (`~77 GB against ~14 GB free`) had never been read off a runner.
//
// This module is that comparator, and it answers a second question the CPU one
// never had to: **the disk can be made bigger.** A hosted runner ships a large
// preinstalled toolchain most lanes never touch, and a k8s lane that pulls
// container images cares about bytes, not about whether the Android NDK is
// present. So `--measure` reports what is there, `--reclaim` deletes a NAMED,
// compiled-in set and re-measures, and both print `df` before and after.
//
// WHAT IS DELIBERATELY NOT HERE
// -----------------------------
// A published figure for how much a reclaim frees. Several exist; this tree has
// been bitten repeatedly by vendor numbers read as measurements, and the
// envelope's own disk row is the live example. `--reclaim` prints what it
// measured on THIS machine and nothing else. The measured results from CI runs
// belong in `runner-disk.measured.json`, beside the run id that produced them.
//
// AND RECLAIMING IS NOT FREE. Deleting tens of gigabytes of small files costs
// wall clock on every run that does it, and one lane in this repo already dies
// at a 14-minute cap. `--reclaim` therefore times itself and prints the
// duration next to the bytes, so the trade is visible rather than assumed.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveElevatorPathOrThrow } from "../privilege/elevator.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

// ---------------------------------------------------------------------------
// df
// ---------------------------------------------------------------------------

export interface FilesystemRow {
  readonly filesystem: string;
  readonly totalBytes: number;
  readonly usedBytes: number;
  readonly availableBytes: number;
  readonly mountedOn: string;
}

/**
 * Parse POSIX `df -kP` output. 1024-byte blocks, one row per line, and the
 * mount point is the LAST field — device names contain spaces on some systems
 * and mount points contain them on others, so the parse anchors on the four
 * numeric columns and takes everything after them as the mount point.
 */
export function parseDf(text: string): readonly FilesystemRow[] {
  const rows: FilesystemRow[] = [];
  for (const line of text.split("\n").slice(1)) {
    if (line.trim() === "") continue;
    // Tokenised rather than matched with one big regex: a device name may
    // contain spaces on the left of the capacity column and a mount point may
    // contain them on the right, so the only fixed landmark is the `NN%` field.
    // Anchoring on it also keeps the parse linear — a lazy `(.+?)` prefix over
    // an adversarial line is the super-linear backtracking case.
    const tokens = line.trim().split(/\s+/);
    const percentIndex = tokens.findIndex((token) => token.endsWith("%"));
    if (percentIndex < 4 || percentIndex === tokens.length - 1) continue;
    const total = Number(tokens[percentIndex - 3]);
    const used = Number(tokens[percentIndex - 2]);
    const available = Number(tokens[percentIndex - 1]);
    if (!Number.isFinite(total) || !Number.isFinite(used) || !Number.isFinite(available)) continue;
    rows.push({
      filesystem: tokens.slice(0, percentIndex - 3).join(" "),
      totalBytes: total * 1024,
      usedBytes: used * 1024,
      availableBytes: available * 1024,
      mountedOn: tokens.slice(percentIndex + 1).join(" "),
    });
  }
  return rows;
}

/**
 * The filesystem a path lands on: the row whose mount point is the LONGEST
 * prefix of it.
 *
 * Longest-prefix and not first-match, because `/` is a prefix of everything. A
 * first-match reading would report the root filesystem's free space for a path
 * on `/mnt`, which is the exact mistake that makes a runner look full when it
 * has a second disk sitting idle.
 */
export function filesystemFor(path: string, rows: readonly FilesystemRow[]): FilesystemRow | null {
  let best: FilesystemRow | null = null;
  for (const row of rows) {
    const mount = row.mountedOn;
    const isPrefix = path === mount || path.startsWith(mount.endsWith("/") ? mount : `${mount}/`);
    if (!isPrefix) continue;
    if (best === null || mount.length > best.mountedOn.length) best = row;
  }
  return best;
}

// ---------------------------------------------------------------------------
// What may be deleted, and what may not
// ---------------------------------------------------------------------------

export interface ReclaimCandidate {
  readonly path: string;
  /** Why a k8s lane does not need it. Never "it is big". */
  readonly why: string;
}

/**
 * The compiled-in allowlist. A path not on this list is NEVER deleted, however
 * large `--measure` reports it to be, because the only safe deletion is one
 * someone reasoned about in advance.
 *
 * Each entry is a preinstalled toolchain that the kind/ArgoCD lanes do not
 * invoke. That is a claim about THIS repo's lanes, not about runners in
 * general, which is why the reason is recorded per path.
 */
export const RECLAIM_CANDIDATES: readonly ReclaimCandidate[] = [
  {
    path: "/usr/local/lib/android",
    why: "Android SDK/NDK. No workflow in this repo builds for Android; nothing in the k8s lanes calls `sdkmanager`, `adb` or an NDK toolchain.",
  },
  {
    path: "/opt/ghc",
    why: "GHC/Haskell toolchain. This tree has no Haskell source and no lane invokes `ghc`, `cabal` or `stack`.",
  },
  {
    path: "/usr/local/.ghcup",
    why: "The ghcup installation that manages /opt/ghc. Same reason, and leaving it behind leaves a manager with nothing to manage.",
  },
  {
    path: "/opt/hostedtoolcache/CodeQL",
    why: "Preinstalled CodeQL bundles. Code scanning runs in its own workflow, which downloads the bundle it needs; the k8s lanes never load one.",
  },
  {
    path: "/usr/share/swift",
    why: "Swift toolchain. No Swift source in the tree and no lane invokes `swift` or `swiftc`.",
  },
  {
    path: "/usr/local/share/powershell",
    why: "PowerShell modules. The workflows run `bash`; no `shell: pwsh` step exists in this repo's k8s lanes.",
  },
];

export interface RefusedCandidate {
  readonly path: string;
  /** What in THIS repo uses it. A refusal with no named user is a guess. */
  readonly usedBy: string;
}

/**
 * Large preinstalled trees that are deliberately NOT deleted, each with the
 * thing in this repo that uses it.
 *
 * This list is the honest half of the allowlist above. A reclaim tool that
 * printed only what it frees invites "why not delete that one too" on every
 * read; naming the user of each big directory answers it once. `/usr/share/dotnet`
 * is the load-bearing entry: `dotnet build -c Release` is the repo's build gate.
 */
export const REFUSED_CANDIDATES: readonly RefusedCandidate[] = [
  {
    path: "/usr/share/dotnet",
    usedBy: "`dotnet build -c Release` / `dotnet test Zeta.sln` — CLAUDE.md §4 build gate, and the binding constraint of the low-memory lane.",
  },
  {
    path: "/opt/hostedtoolcache/node",
    usedBy: "Node runtimes some actions shell out to; bun is separate but actions/checkout and friends are not.",
  },
  {
    path: "/var/lib/docker",
    usedBy: "The container runtime the kind cluster runs on. Deleting it is deleting the lane.",
  },
];

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

export interface DirectorySize {
  readonly path: string;
  /** `null` when the path does not exist on this machine — NOT zero. */
  readonly bytes: number | null;
  readonly why: string;
}

export interface DiskMeasurement {
  readonly filesystems: readonly FilesystemRow[];
  /** The filesystem container images actually land on. */
  readonly dockerRoot: string;
  readonly dockerRootFilesystem: FilesystemRow | null;
  readonly candidates: readonly DirectorySize[];
  /** Sum over candidates that exist. Candidates that do not exist contribute nothing and are not guessed at. */
  readonly candidateBytes: number;
}

export type Runner = (
  command: string,
  args: readonly string[],
) => { status: number; stdout: string; stderr: string };

export const defaultRunner: Runner = (command, args) => {
  const result = spawnSync(command, [...args], { encoding: "utf8", timeout: 600_000 });
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
};

/** `docker info` knows where images live; `/var/lib/docker` is the fallback, and it is labelled as one. */
export function dockerRootDir(run: Runner = defaultRunner): string {
  const result = run("docker", ["info", "--format", "{{.DockerRootDir}}"]);
  const trimmed = result.stdout.trim();
  return result.status === 0 && trimmed.startsWith("/") ? trimmed : "/var/lib/docker";
}

/** `du -sk` for one path, or `null` when it is absent. Absent is not zero: it is unmeasured. */
export function directoryBytes(path: string, run: Runner = defaultRunner): number | null {
  const result = run("du", ["-sk", path]);
  if (result.status !== 0) return null;
  const match = /^(\d+)/.exec(result.stdout.trim());
  return match?.[1] === undefined ? null : Number(match[1]) * 1024;
}

export function measureDisk(run: Runner = defaultRunner): DiskMeasurement {
  const df = run("df", ["-kP"]);
  const filesystems = df.status === 0 ? parseDf(df.stdout) : [];
  const dockerRoot = dockerRootDir(run);
  const candidates = RECLAIM_CANDIDATES.map((candidate) => ({
    path: candidate.path,
    bytes: directoryBytes(candidate.path, run),
    why: candidate.why,
  }));
  return {
    filesystems,
    dockerRoot,
    dockerRootFilesystem: filesystemFor(dockerRoot, filesystems),
    candidates,
    candidateBytes: candidates.reduce((sum, candidate) => sum + (candidate.bytes ?? 0), 0),
  };
}

// ---------------------------------------------------------------------------
// The envelope's disk row, checked
// ---------------------------------------------------------------------------

export interface EnvelopeDiskFinding {
  readonly problem: string;
}

const GIB = 1024 ** 3;

/**
 * Convict when the machine has LESS free disk than the envelope claims.
 *
 * One-directional for the same reason `auditEnvelopeAgainstMachine` is: a
 * bigger disk is slack, a smaller one means every "it fits" computed from the
 * declared number was computed against a machine that does not exist.
 *
 * `null` measurement is a finding, never a pass. An unread comparator is an
 * absent check.
 */
export function auditEnvelopeDisk(
  declaredFreeDiskGib: number,
  measured: FilesystemRow | null,
  where: string,
): readonly EnvelopeDiskFinding[] {
  if (measured === null) {
    return [
      {
        problem:
          `could not read a filesystem for ${where}, so the declared ${String(declaredFreeDiskGib)} GiB free-disk row is ` +
          `UNVERIFIED here. Run this on the runner; an unread comparator is an absent check, not a passing one`,
      },
    ];
  }
  if (measured.availableBytes >= declaredFreeDiskGib * GIB) return [];
  return [
    {
      problem:
        `the catalogue declares ${String(declaredFreeDiskGib)} GiB free disk; ${measured.mountedOn} (where ${where} lives) ` +
        `has ${(measured.availableBytes / GIB).toFixed(1)} GiB available. Every image-footprint verdict computed from the ` +
        `declared number is too generous`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Reclaim
// ---------------------------------------------------------------------------

export interface ReclaimOutcome {
  readonly before: DiskMeasurement;
  readonly after: DiskMeasurement;
  readonly deleted: readonly { path: string; bytes: number | null; status: number }[];
  readonly elapsedMs: number;
}

/**
 * Delete every allowlisted candidate that exists, then re-measure.
 *
 * The freed number reported by the caller is the DIFFERENCE in `df`, not the
 * sum of `du` — those disagree (sparse files, hard links, block rounding,
 * anything else writing during the run), and `df` is the one that decides
 * whether an image pull succeeds.
 */
export function reclaim(run: Runner = defaultRunner, now: () => number = Date.now): ReclaimOutcome {
  const before = measureDisk(run);
  const started = now();
  const deleted = before.candidates
    .filter((candidate) => candidate.bytes !== null)
    .map((candidate) => {
      // `rm -rf` as root, so the elevator is resolved ABSOLUTE + root-owned + setuid and
      // never through PATH (docs/BUGS.md P1, 2026-08-24). Note the eslint rule that guards
      // this class cannot see this line at all: the command reaches a `run()` wrapper, not
      // a `spawn*` call, which is exactly why the repo lint below matches on the ARGUMENT
      // rather than on the callee.
      const result = run(resolveElevatorPathOrThrow("sudo"), ["rm", "-rf", candidate.path]);
      return { path: candidate.path, bytes: candidate.bytes, status: result.status };
    });
  const elapsedMs = now() - started;
  return { before, after: measureDisk(run), deleted, elapsedMs };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function gib(bytes: number): string {
  return (bytes / GIB).toFixed(2);
}

/** `absent` is a real answer and must not print as a size. */
function sizeLabel(bytes: number | null): string {
  return bytes === null ? "absent" : `${gib(bytes)} GiB`;
}

export function formatMeasurement(measurement: DiskMeasurement): string {
  const lines: string[] = [];
  lines.push("FILESYSTEMS (df -kP)");
  lines.push("  mount                      total GiB    used GiB   avail GiB");
  for (const row of measurement.filesystems) {
    lines.push(
      `  ${row.mountedOn.padEnd(24)} ${gib(row.totalBytes).padStart(10)}  ${gib(row.usedBytes).padStart(10)}  ${gib(row.availableBytes).padStart(10)}`,
    );
  }
  const dockerFs = measurement.dockerRootFilesystem;
  lines.push("");
  lines.push(`CONTAINER IMAGES LAND ON  ${measurement.dockerRoot}`);
  lines.push(
    dockerFs === null
      ? "  no filesystem matched that path — the free-disk figure below is UNKNOWN, not large"
      : `  filesystem ${dockerFs.mountedOn}: ${gib(dockerFs.availableBytes)} GiB available of ${gib(dockerFs.totalBytes)} GiB`,
  );
  lines.push("");
  lines.push("RECLAIM CANDIDATES (measured, not deleted)");
  for (const candidate of measurement.candidates) {
    lines.push(`  ${candidate.path.padEnd(34)} ${sizeLabel(candidate.bytes)}`);
  }
  lines.push(`  ${"TOTAL".padEnd(34)} ${gib(measurement.candidateBytes)} GiB`);
  lines.push("");
  lines.push("NOT DELETED, and by whom each is used");
  for (const refused of REFUSED_CANDIDATES) lines.push(`  ${refused.path.padEnd(34)} ${refused.usedBy}`);
  return lines.join("\n");
}

export function formatReclaim(outcome: ReclaimOutcome): string {
  const beforeFs = outcome.before.dockerRootFilesystem;
  const afterFs = outcome.after.dockerRootFilesystem;
  const lines: string[] = [];
  lines.push("BEFORE");
  lines.push(formatMeasurement(outcome.before));
  lines.push("");
  lines.push(`DELETED in ${(outcome.elapsedMs / 1000).toFixed(1)}s`);
  for (const entry of outcome.deleted) {
    lines.push(`  ${entry.path.padEnd(34)} ${sizeLabel(entry.bytes)}  rm exit ${String(entry.status)}`);
  }
  lines.push("");
  lines.push("AFTER");
  lines.push(formatMeasurement(outcome.after));
  lines.push("");
  if (beforeFs === null || afterFs === null) {
    lines.push("FREED: unknown — one of the two measurements had no filesystem for the docker root");
  } else {
    lines.push(
      `FREED on ${afterFs.mountedOn}: ${gib(afterFs.availableBytes - beforeFs.availableBytes)} GiB ` +
        `(${gib(beforeFs.availableBytes)} -> ${gib(afterFs.availableBytes)} GiB available), in ${(outcome.elapsedMs / 1000).toFixed(1)}s`,
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = [
  "runner-disk — measure (and optionally reclaim) the disk a hosted runner gives a k8s lane",
  "",
  "  --measure          print df, the docker root's filesystem, and the reclaim candidates",
  "  --reclaim          delete the allowlisted candidates, re-measure, print before/after/freed",
  "  --check-envelope   convict when the docker root's filesystem has less free space than",
  "                     storage-profiles.json's runnerEnvelope.freeDiskGib claims",
].join("\n");

function declaredFreeDiskGib(): number {
  const parsed = JSON.parse(
    readFileSync(resolve(REPO_ROOT, "full-ai-cluster/k8s/storage-profiles.json"), "utf8"),
  ) as Record<string, unknown>;
  const envelope = parsed.runnerEnvelope as Record<string, unknown> | undefined;
  const value = envelope?.freeDiskGib;
  if (typeof value !== "number") throw new Error("storage-profiles.json: runnerEnvelope.freeDiskGib is not a number");
  return value;
}

export function main(argv: readonly string[]): number {
  if (argv.includes("--reclaim")) {
    console.log(formatReclaim(reclaim()));
    return 0;
  }
  if (argv.includes("--check-envelope")) {
    const measurement = measureDisk();
    console.log(formatMeasurement(measurement));
    const findings = auditEnvelopeDisk(declaredFreeDiskGib(), measurement.dockerRootFilesystem, measurement.dockerRoot);
    for (const finding of findings) console.error(`runner-envelope: ${finding.problem}`);
    return findings.length === 0 ? 0 : 1;
  }
  if (argv.includes("--measure")) {
    console.log(formatMeasurement(measureDisk()));
    return 0;
  }
  console.log(USAGE);
  return 2;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
