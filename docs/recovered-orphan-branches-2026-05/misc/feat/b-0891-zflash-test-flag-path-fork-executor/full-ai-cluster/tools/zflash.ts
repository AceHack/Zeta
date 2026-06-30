#!/usr/bin/env bun
// full-ai-cluster/tools/zflash.ts
//
// Ultra-short wrapper around flash-usb.ts for the AI-cluster installer.
//
// Auto-discovers the newest `~/Downloads/zeta-installer-*.iso`, invokes
// flash-usb with the `--short` challenge format, and lets sudo's PAM
// stack (Touch ID, after `zflash-setup` ran) gate the dd.
//
// iter-4.2 extension (B-0789): after the dd succeeds, zflash also
// mounts the freshly-flashed USB's FAT ESP partition + writes the
// operator's SSH pubkey to it as `/zeta-authorized-keys.pub` so
// `zeta-install.sh` on the booted installer can pick it up + inject
// into `operator-ssh-keys.nix` before `nixos-install`. Result: full
// zero-typing flow from `zflash` on macOS → bootable USB → boot on
// PC → install completes → SSH-able as `zeta` user with the operator's
// existing key.
//
// End-to-end keystrokes after first-time setup:
//
//   $ bun full-ai-cluster/tools/zflash.ts
//   ISO: ~/Downloads/zeta-installer-25.11.iso (1.70 GiB)
//   USB: /dev/disk6 (115 GiB, USB 3.2.1 FD)
//   *** ALL DATA ON /dev/disk6 WILL BE DESTROYED ***
//   type: yes a3f9
//   > yes a3f9             ← 8 chars; per-run random; can't be pre-baked
//   [Touch ID prompt]       ← finger on trackpad; PAM gate
//   Flash complete.
//   iter-4.2: injecting ~/.ssh/id_ed25519.pub into /dev/disk6 ESP ...
//   iter-4.2: pubkey written; USB ejected. Safe to remove.
//
// Recommended shell alias (set up by zflash-setup) — note the path
// is shell-quoted so checkout paths containing spaces / unicode work
// (zflash-setup emits the quoted form automatically):
//   alias zflash='bun "/Users/acehack/Documents/src/repos/Zeta/full-ai-cluster/tools/zflash.ts"'
// Then just type: zflash
//
// Safety contract — preserved end-to-end:
//   - All flash-usb sanity rails (platform, ISO size + extension, USB
//     protocol, internal-disk + boot-disk refusal, size range)
//   - Random nonce per run (4 hex = 16-bit entropy; not pre-bakeable)
//   - Explicit consent token `yes` (not a stray Enter keypress)
//   - Touch ID PAM gate on the sudo dd (biometric proof of physical
//     presence; replaces password typing)
//   - iter-4.2 inject: macOS-side `diskutil mount` + `sudo tee` write;
//     read-only on the operator's `~/.ssh/id_ed25519.pub` (default) or
//     the path passed via `--ssh-key <path>`. NEVER writes to user keys.
//
// Diagnostic discipline (per maintainer 2026-05-26 *"whenever i have to
// ferry commands by reading and typing i'm going to avoid it like the
// plague and try to get like pictures and auto run and short commands
// pre built in"*): all failure paths AUTO-RUN diagnostics in-place.
// No "now run this command to debug" — diagnostic output is photo-
// friendly + appears immediately so the operator can snap + send.
//
// Agent-driven mode:
//   When the runner is an authorized agent acting on the operator's
//   behalf per the flash-usb.ts authorship contract, the agent
//   auto-types the `yes <nonce>` challenge. The Touch ID PAM gate
//   still fires on the operator's Mac — that's the consent floor for
//   the destructive operation. No physical-access proof can be
//   bypassed by an agent; Touch ID requires the operator's actual
//   finger on the actual trackpad.

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildBlob,
  composeBundle,
  parseArgs as parsePersistArgs,
} from "../../tools/installer/zeta-creds-persist";
import {
  composeAuthorizedKeysFileContent,
  parseUuidFromDiskutilInfo,
  ZETA_TEST_INFRA_PUBKEY_REPO_RELATIVE_PATH,
} from "./zflash-lib";

const ISO_GLOB_PREFIX = "zeta-installer-";
const DEFAULT_SSH_KEY = join(homedir(), ".ssh", "id_ed25519.pub");

function bail(code: number, msg: string): never {
  process.stderr.write(`zflash: ${msg}\n`);
  process.exit(code);
}

function autoDiscoverIso(): string {
  const dl = join(homedir(), "Downloads");
  if (!existsSync(dl)) {
    bail(2, `~/Downloads does not exist; pass an ISO path explicitly`);
  }
  const candidates = readdirSync(dl)
    .filter((f) => f.startsWith(ISO_GLOB_PREFIX) && f.endsWith(".iso"))
    .map((f) => join(dl, f))
    .filter((p) => {
      try {
        return statSync(p).isFile();
      } catch {
        return false;
      }
    });

  if (candidates.length === 0) {
    bail(
      2,
      `no Zeta installer ISO found under ~/Downloads/${ISO_GLOB_PREFIX}*.iso\n` +
        "Either download one from a successful build-ai-cluster-iso workflow\n" +
        "run, or pass an ISO path explicitly: zflash <path/to/iso>",
    );
  }

  // Pick newest by mtime.
  candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const chosen = candidates[0];
  if (chosen === undefined) bail(2, "internal: candidates list non-empty but [0] is undefined");
  return chosen;
}

// ── iter-4.3 freshness checks (B-0789 follow-on) ──────────────────
//
// Two gaps surfaced by the 2026-05-26 empirical iter-4.2 test run:
//
//   1. The operator's checkout was stale (HEAD = 89a39ea55 → pre-iter-4.2
//      zflash.ts). Flash ran the OLD zflash that didn't pass --no-eject
//      and didn't do the iter-4.2 inject step. USB came out bootable
//      but WITHOUT operator-ssh-keys.txt populated. Silent failure of
//      the iter-4.2 zero-typing target. Per maintainer 2026-05-26
//      *"any fixes lets make sure they make it in main"*.
//
//   2. The May 25 ISO in ~/Downloads was iter-3-era (no iter-4.2 install
//      script). Had to manually `gh run download` the fresh CI artifact.
//      Per maintainer 2026-05-26 *"does the script not auto download the
//      latest?"*.
//
// iter-4.3 closes both gaps:
//   - checkLocalCheckoutFreshness(): bails if any install-substrate file
//     differs HEAD..origin/main → forces operator to git-pull before
//     flashing → eliminates the silent-stale-code class
//   - autoDownloadFreshIsoIfNeeded(): pulls latest CI ISO if newer than
//     local newest → contributor never has to remember `gh run download`

const INSTALL_SUBSTRATE_FILES = [
  "full-ai-cluster/tools/zflash.ts",
  "full-ai-cluster/tools/flash-usb.ts",
  "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
  "full-ai-cluster/usb-nixos-installer/flake.nix",
  "full-ai-cluster/nixos/modules/initial-password.nix",
  "full-ai-cluster/nixos/modules/operator-ssh-keys.nix",
  "full-ai-cluster/nixos/modules/operator-ssh-keys.txt",
];

const ZETA_REPO_GH = "Lucent-Financial-Group/Zeta";
const ISO_BUILD_WORKFLOW = "build-ai-cluster-iso.yml";

function findRepoRoot(): string | null {
  // Walk up from zflash.ts's directory to find `.git`. Returns the repo
  // root path or null if not in a git checkout (e.g., script copied out).
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function checkLocalCheckoutFreshness(repoRoot: string): void {
  // Fetch origin/main + content-diff every install-substrate file
  // HEAD..origin/main. If any file differs, bail loud with remediation.
  //
  // Per #5091 Copilot findings, this function is stricter than the
  // first-pass version:
  //   - P0 (Eryew): git diff non-0/1 exit codes are NOT silently
  //     skipped (would defeat the guard if path/repo state was bad)
  //   - P1 (Eryei): git fetch failures capture stderr; only known
  //     network-flavored errors degrade to "offline"; auth / missing-
  //     git / no-origin / etc. → bail unless --skip-freshness-check
  //   - P1 (Erye3): error text says "differs from origin/main" (could
  //     be behind OR ahead OR diverged) + remediation reflects all
  //     three cases
  process.stdout.write("zflash: checking local checkout freshness (iter-4.3) ...\n");

  // Step 1: fetch. Capture stderr so the network-vs-other-failure
  // discriminator has something to read.
  let fetchStderr = "";
  try {
    execFileSync("git", ["-C", repoRoot, "fetch", "origin", "main", "--quiet"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "stderr" in e) {
      const raw = (e as { stderr: Buffer | string }).stderr;
      fetchStderr = typeof raw === "string" ? raw : raw.toString("utf8");
    }
    // Capture exec-level details too — `e.message` + `e.code` are critical
    // when stderr is empty (e.g., ENOENT when git binary is missing).
    // Per #5093 Copilot P1: "(no stderr captured)" hides the actual cause.
    const execMsg = e instanceof Error ? e.message : String(e);
    const execCode =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: unknown }).code)
        : "";

    // Discriminate: network-flavored failures → degrade to "offline" warn.
    // Other failures (git missing, no origin, auth) → bail loud unless
    // operator explicitly opted out via --skip-freshness-check.
    //
    // Per #5093 Copilot P0: "could not read from remote repository" was
    // misclassified as network — that string ALSO appears on auth /
    // permission failures (private repo, expired credential, etc.). Now
    // (a) auth-signals matched FIRST + (if matched) treated as bail-loud,
    // (b) network-signals require an actual host/connectivity word
    // ("host", "connection", "network", "route", "timed out", "unreachable"),
    // (c) "could not read from remote repository" alone no longer enough
    // to call it network — needs a separate host/connectivity signal too.
    const authSignals = [
      "permission denied",
      "authentication failed",
      "fatal: authentication",
      "invalid credentials",
      "bad credentials",
      "could not read username",
      "support for password authentication was removed",
      "403 forbidden",
      "401 unauthorized",
    ];
    const networkSignals = [
      "could not resolve host",
      "connection refused",
      "connection timed out",
      "network is unreachable",
      "no route to host",
      "operation timed out",
      "ssh: connect to host",
    ];
    const lower = fetchStderr.toLowerCase();
    const looksAuth = authSignals.some((s) => lower.includes(s));
    const looksNetwork = !looksAuth && networkSignals.some((s) => lower.includes(s));
    if (looksNetwork) {
      process.stderr.write(
        `zflash: iter-4.3 freshness fetch failed (looks network-related; proceeding offline):\n` +
          `  ${fetchStderr.trim().split("\n").join("\n  ")}\n` +
          `  (proceed at own risk — operator-side stale-substrate hazard is real)\n`,
      );
      return;
    }
    // Either auth-flavored OR ambiguous-non-network — bail loud with
    // diagnostic. Include exec message + code so ENOENT etc. surface
    // even when stderr is empty.
    const causeDetail = fetchStderr.trim()
      ? fetchStderr.trim().split("\n").join("\n  ")
      : `(no stderr; exec error: ${execMsg}${execCode ? ` [code: ${execCode}]` : ""})`;
    bail(
      2,
      `iter-4.3 freshness fetch FAILED${looksAuth ? " (AUTH-flavored)" : " with non-network error"}:\n` +
        `  ${causeDetail}\n\n` +
        `  Common causes:\n` +
        `    - git not installed / not on PATH (e.code === 'ENOENT')\n` +
        `    - 'origin' remote not configured: run 'git -C ${repoRoot} remote -v'\n` +
        `    - SSH/HTTPS auth failure: run 'gh auth status' OR 'ssh -T git@github.com'\n` +
        `    - Private repo + expired credential: re-auth via 'gh auth login'\n` +
        `    - Rate-limited token: 'gh api rate_limit --jq .resources.core'\n\n` +
        `  Escape hatch: zflash --skip-freshness-check (NOT recommended)`,
    );
  }

  // Step 2: per-file content diff HEAD..origin/main. Status semantics:
  //   0 = no diff (file matches origin/main)
  //   1 = diff present (file differs — operator's checkout is out of sync)
  //   anything else = git error (bad path, repo damage, etc.) — HARD FAIL
  //     per Copilot P0; silent-skip would defeat the guard
  const stale: string[] = [];
  const errored: { file: string; status: number; stderr: string }[] = [];
  for (const file of INSTALL_SUBSTRATE_FILES) {
    try {
      execFileSync(
        "git",
        ["-C", repoRoot, "diff", "--quiet", "HEAD", "origin/main", "--", file],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      // exit 0 = no diff
    } catch (e: unknown) {
      const status =
        e && typeof e === "object" && "status" in e
          ? Number((e as { status: number }).status)
          : -1;
      if (status === 1) {
        stale.push(file);
      } else {
        let stderr = "";
        if (e && typeof e === "object" && "stderr" in e) {
          const raw = (e as { stderr: Buffer | string }).stderr;
          stderr = typeof raw === "string" ? raw : raw.toString("utf8");
        }
        errored.push({ file, status, stderr: stderr.trim() });
      }
    }
  }

  if (errored.length > 0) {
    bail(
      2,
      `iter-4.3 freshness check FAILED — ${errored.length} file(s) produced unexpected git diff errors:\n` +
        errored.map((e) => `    ${e.file}  (exit ${e.status})  ${e.stderr || "(no stderr)"}`).join("\n") +
        `\n\n  Refusing to flash — silent-skip would defeat the safety guard.\n\n` +
        `  Common causes:\n` +
        `    - Install-substrate path renamed/moved on main but not in local checkout\n` +
        `    - Local repo in detached HEAD / mid-rebase / corrupted state\n` +
        `    - origin/main ref missing locally (try 'git fetch origin main')\n\n` +
        `  Escape hatch: zflash --skip-freshness-check (NOT recommended)`,
    );
  }

  if (stale.length > 0) {
    // Per #5091 Copilot P1: HEAD might be BEHIND, AHEAD, or DIVERGED
    // from origin/main. The content-diff doesn't discriminate. Say
    // "differs" (true in all three cases) + give remediations for all.
    bail(
      2,
      `iter-4.3 freshness check FAILED — local checkout differs from origin/main on ${stale.length} install-substrate file(s):\n` +
        stale.map((f) => `    ${f}`).join("\n") +
        `\n\n  Refusing to flash — local install-code may produce a USB that diverges from main's substrate (silent flash-without-inject hazard).\n\n` +
        `  Remediation depends on whether local is BEHIND, AHEAD, or DIVERGED:\n` +
        `    BEHIND (most common):\n` +
        `      git -C ${repoRoot} pull --rebase origin main\n` +
        `      (then re-run zflash; this is the recommended path)\n` +
        `    AHEAD or DIVERGED (you have local commits not on main):\n` +
        `      git -C ${repoRoot} log HEAD..origin/main   # what main has that you don't\n` +
        `      git -C ${repoRoot} log origin/main..HEAD   # what you have that main doesn't\n` +
        `      Then push your work as a PR OR rebase / merge as appropriate\n` +
        `    Escape hatch:\n` +
        `      zflash --skip-freshness-check  (only for known-safe situations)\n`,
    );
  }
  process.stdout.write("zflash: local checkout matches origin/main on install substrate ✓\n");
}

function autoDownloadFreshIsoIfNeeded(localIso: string): string {
  // Check the latest successful build-ai-cluster-iso workflow run on main.
  // If its updated_at > localIso.mtime, download via gh run download +
  // return the new path. Offline / no-gh → falls back to local silently.
  const localMtime = statSync(localIso).mtimeMs;
  try {
    const runsJson = execFileSync(
      "gh",
      [
        "api",
        `repos/${ZETA_REPO_GH}/actions/workflows/${ISO_BUILD_WORKFLOW}/runs?branch=main&status=success&per_page=1`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const runs = (JSON.parse(runsJson) as { workflow_runs?: Array<{ id: number; updated_at: string; head_sha: string }> }).workflow_runs ?? [];
    if (runs.length === 0) {
      process.stdout.write("zflash: no successful ISO builds found on origin/main (iter-4.3 skipped)\n");
      return localIso;
    }
    const latest = runs[0]!;
    const ciMtime = new Date(latest.updated_at).getTime();
    if (ciMtime <= localMtime) {
      process.stdout.write(
        `zflash: local ISO is current with latest CI build (run ${latest.id}, ${latest.updated_at}) ✓\n`,
      );
      return localIso;
    }
    process.stdout.write(
      `zflash: CI has fresher ISO — run ${latest.id} updated ${latest.updated_at}, ` +
        `local newest ${new Date(localMtime).toISOString()}\n`,
    );
    process.stdout.write(`zflash: pulling fresh ISO from CI (iter-4.3) ...\n`);
    // Per #5091 Copilot P2: use mkdtemp + finally cleanup instead of a
    // stable /tmp/zflash-ci-iso-<runId> path. Stable path could (a)
    // accumulate over time as a clutter problem, (b) re-use a partial
    // download from a previously-interrupted run. mkdtemp gives a
    // collision-free unique path; the try/finally removes it whether
    // copy succeeded or threw.
    const dlDir = mkdtempSync(join(tmpdir(), `zflash-ci-iso-${latest.id}-`));
    // Per #5093 Copilot P0: TS strict mode rejects `return dlDest` when
    // dlDest is `string | null` but return type is `string`. Initialize
    // to localIso so it's always string; overwrite on copy success.
    let dlDest: string = localIso;
    try {
      execFileSync(
        "gh",
        ["run", "download", String(latest.id), "--dir", dlDir, "-R", ZETA_REPO_GH],
        { stdio: "inherit" },
      );
      // gh run download puts artifact into a directory NAMED after the artifact.
      // Walk dlDir to find the .iso file.
      const findIsoUnder = (d: string): string | null => {
        if (!existsSync(d)) return null;
        const entries = readdirSync(d);
        for (const e of entries) {
          const p = join(d, e);
          try {
            const s = statSync(p);
            if (s.isFile() && e.endsWith(".iso")) return p;
            if (s.isDirectory()) {
              const inner = findIsoUnder(p);
              if (inner) return inner;
            }
          } catch {
            /* skip */
          }
        }
        return null;
      };
      const ciIsoSrc = findIsoUnder(dlDir);
      if (!ciIsoSrc) {
        process.stderr.write(`zflash: (CI artifact downloaded to ${dlDir} but no .iso found; falling back to local)\n`);
        return localIso;
      }
      // Copy to ~/Downloads with a date+run-stamped name so future runs
      // pick the right one. Don't overwrite the original (operator's
      // download history is preserved).
      dlDest = join(
        homedir(),
        "Downloads",
        `zeta-installer-25.11-ci${latest.id}-${latest.updated_at.slice(0, 10)}.iso`,
      );
      if (!existsSync(dlDest)) {
        execFileSync("cp", [ciIsoSrc, dlDest], { stdio: "inherit" });
      }
      process.stdout.write(`zflash: fresh ISO at ${dlDest}\n`);
    } finally {
      // Always clean up the temp dir, whether download / copy succeeded
      // or threw. The ISO has been copied to ~/Downloads already (when
      // successful), so /tmp can go.
      try {
        rmSync(dlDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        process.stderr.write(
          `zflash: (could not clean up ${dlDir}: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}; harmless)\n`,
        );
      }
    }
    return dlDest;
  } catch (e) {
    process.stderr.write(
      `zflash: (iter-4.3 CI ISO pull failed: ${e instanceof Error ? e.message : String(e)}; falling back to local)\n`,
    );
    return localIso;
  }
}

function findFlashUsbPath(): string {
  // Sibling file lookup. import.meta.url is a file:// URL — use
  // fileURLToPath() to get a decoded filesystem path (handles spaces +
  // unicode in the checkout path correctly; raw new URL().pathname
  // would leave percent-encoding intact and existsSync would fail).
  const here = fileURLToPath(import.meta.url);
  const sibling = join(dirname(here), "flash-usb.ts");
  if (!existsSync(sibling)) {
    bail(1, `flash-usb.ts not found at expected sibling path: ${sibling}`);
  }
  return sibling;
}

// ── iter-4.2 helpers (B-0789) ──────────────────────────────────────

interface ExternalDiskBrief {
  device: string; // e.g., /dev/disk6
}

function listExternalDisks(): ExternalDiskBrief[] {
  // diskutil list external prints disk headers like "/dev/disk6 (external, physical):"
  // Per-device, captures the path.
  try {
    const out = execFileSync("diskutil", ["list", "external"], { encoding: "utf8" });
    const matches = [...out.matchAll(/^(\/dev\/disk\d+)\s+\(external/gm)];
    return matches.map((m) => ({ device: m[1]! }));
  } catch {
    return [];
  }
}

function findFatPartition(device: string): string | null {
  // diskutil list <device> output includes lines per partition with
  // type-info that varies by scheme:
  //   GPT:       "2: EFI EFI                  209.7 MB   disk6s1"
  //              "2: DOS_FAT_32 NIXOS_ISO     65.5 MB    disk6s2"
  //   MBR:       "1:           0xEF           3.1 MB     disk6s2"
  //              (FDisk numeric type codes: 0xEF=EFI System Partition,
  //               0x0C=FAT32-LBA, 0x0E=FAT16-LBA, 0x06=FAT16, 0x0B=FAT32,
  //               0x0F=Extended-LBA)
  // NixOS isohybrid + dd produces the MBR form on macOS. Be lenient —
  // accept any FAT/EFI-shaped string OR any of the MBR FAT/ESP type
  // codes. Returns the partition device path (e.g., /dev/disk6s2) or
  // null. iter-4.4 fix-forward (B-0789): added 0xEF MBR matching after
  // 2026-05-26 empirical test surfaced the bug.
  try {
    const out = execFileSync("diskutil", ["list", device], { encoding: "utf8" });
    const lines = out.split("\n");
    for (const line of lines) {
      const matchesGpt = /\b(DOS_FAT|EFI|MS-DOS|FAT16|FAT32|Windows_FAT)\b/i.test(line);
      // MBR partition type codes that indicate FAT or ESP. Bounded with
      // \b on both sides so we don't accidentally match "0xEF" inside
      // a longer hex string. Case-insensitive (0xEF / 0xef both ok).
      const matchesMbr = /\b0x(EF|0C|0E|06|0B|0F)\b/i.test(line);
      if (matchesGpt || matchesMbr) {
        const m = line.match(/\b(disk\d+s\d+)\s*$/);
        if (m) return `/dev/${m[1]}`;
      }
    }
  } catch {
    /* fall through to null */
  }
  return null;
}

// iter-4.4 fix-forward: track which mount method was used so unmount
// matches. macOS's `diskutil mount` works for GPT-formatted ESPs
// (where diskutil's auto-probe recognizes the EFI/FAT inside), but
// fails for MBR 0xEF partitions whose FAT12/FAT16 filesystem is real
// but not auto-probed. The fallback uses `mount_msdos` against a
// mkdtemp mount point, which DOES read the FAT directly.
type EspMountResult = {
  mountPoint: string;
  method: "diskutil" | "mount_msdos";
  /** Only set for mount_msdos; the tmp dir we created + must rmSync */
  tmpdir?: string;
};

interface CredBakeOptions {
  readonly bakeCredArgs: readonly string[];
  readonly passphraseFile: string | null;
  readonly passphraseEnv: string | null;
  readonly persona: string | null;
}

function mountEsp(espPart: string): EspMountResult {
  // Path 1: try diskutil mount (works for GPT-formatted EFI ESPs).
  // Don't dump diagnostics if this fails — fallback is expected for
  // MBR 0xEF cases.
  try {
    execFileSync("diskutil", ["mount", espPart], { stdio: ["ignore", "ignore", "pipe"] });
    const mp = getMountPoint(espPart);
    if (mp) {
      return { mountPoint: mp, method: "diskutil" };
    }
    // diskutil mount succeeded but no mount point reported — try to
    // unmount + fall through to mount_msdos path.
    try {
      execFileSync("diskutil", ["unmount", espPart], { stdio: "ignore" });
    } catch {
      /* ignore */
    }
  } catch {
    /* expected for MBR 0xEF; fall through */
  }
  // Path 2: explicit mount_msdos against tmp mount point. Requires
  // sudo; PAM gates via Touch ID like the dd step did.
  const tmp = mkdtempSync(join(tmpdir(), "zeta-esp-mount-"));
  try {
    execFileSync("sudo", ["mount_msdos", "-o", "nodev,nosuid", espPart, tmp], {
      stdio: ["inherit", "inherit", "inherit"],
    });
    return { mountPoint: tmp, method: "mount_msdos", tmpdir: tmp };
  } catch (e) {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore tmp cleanup; not load-bearing */
    }
    throw e;
  }
}

function unmountEsp(espPart: string, result: EspMountResult): void {
  if (result.method === "diskutil") {
    try {
      execFileSync("diskutil", ["unmount", espPart], { stdio: "inherit" });
    } catch {
      /* unmount errors are usually safe to ignore */
    }
  } else {
    try {
      execFileSync("sudo", ["umount", result.mountPoint], { stdio: "inherit" });
    } catch {
      /* unmount errors are usually safe to ignore */
    }
    if (result.tmpdir) {
      try {
        rmSync(result.tmpdir, { recursive: true, force: true });
      } catch {
        /* ignore tmp cleanup; not load-bearing */
      }
    }
  }
}

function getMountPoint(partition: string): string | null {
  try {
    const out = execFileSync("diskutil", ["info", partition], { encoding: "utf8" });
    const m = out.match(/^\s*Mount Point:\s+(.+)$/m);
    return m && m[1] && m[1].trim() !== "" ? m[1].trim() : null;
  } catch {
    return null;
  }
}

function getPartitionUuid(partition: string): string | null {
  try {
    const out = execFileSync("diskutil", ["info", partition], { encoding: "utf8" });
    return parseUuidFromDiskutilInfo(out);
  } catch {
    return null;
  }
}

function dumpDiagnostics(context: string): void {
  // Photo-friendly compact diagnostic block per maintainer 2026-05-26
  // discipline. Keep section count low + critical info at top so the
  // operator can snap a single screenshot + send.
  process.stderr.write(`\n=== iter-4.2 DIAGNOSTICS ===\n`);
  process.stderr.write(`reason: ${context}\n`);
  process.stderr.write(`\n--- diskutil list external ---\n`);
  try {
    process.stderr.write(execFileSync("diskutil", ["list", "external"], { encoding: "utf8" }));
  } catch (e) {
    process.stderr.write(`(diskutil list external failed: ${e instanceof Error ? e.message : String(e)})\n`);
  }
  process.stderr.write(`--- mounted USB volumes (/Volumes/*) ---\n`);
  try {
    const mountOut = execFileSync("mount", [], { encoding: "utf8" });
    const usbLines = mountOut.split("\n").filter((l) => l.includes("/Volumes/"));
    process.stderr.write(usbLines.length > 0 ? usbLines.join("\n") + "\n" : "(no /Volumes mounts)\n");
  } catch (e) {
    process.stderr.write(`(mount failed: ${e instanceof Error ? e.message : String(e)})\n`);
  }
  process.stderr.write(
    `--- what to do next ---\n` +
      `  - photograph the diagnostic block above + send to your AI collaborator\n` +
      `  - OR re-plug the USB and re-run: zflash\n` +
      `  - OR boot the cluster node + fall back to iter-4 v1 manual SSH-key flow\n` +
      `    (login as zeta/zeta-change-me, passwd zeta, edit operator-ssh-keys.nix,\n` +
      `    sudo nixos-rebuild switch --flake /etc/zeta/full-ai-cluster#<host>)\n` +
      `============================\n\n`,
  );
}

function writeCredBlobToEsp(mountPoint: string, espPart: string, credBake: CredBakeOptions): void {
  if (credBake.bakeCredArgs.length === 0) return;

  const usbUuid = getPartitionUuid(espPart);
  if (!usbUuid) {
    dumpDiagnostics(`diskutil info ${espPart} did not report a FAT Volume UUID`);
    throw new Error(`could not resolve FAT USB UUID for ${espPart}`);
  }

  const target = join(mountPoint, "zeta-creds.enc");
  const persistArgv = [
    "--usb-uuid",
    usbUuid,
    "--output",
    target,
  ];
  if (credBake.passphraseFile !== null) {
    persistArgv.push("--passphrase-file", credBake.passphraseFile);
  }
  if (credBake.passphraseEnv !== null) {
    persistArgv.push("--passphrase-env", credBake.passphraseEnv);
  }
  if (credBake.persona !== null) {
    persistArgv.push("--persona", credBake.persona);
  }
  for (const arg of credBake.bakeCredArgs) {
    persistArgv.push("--bake-cred", arg);
  }

  const parsed = parsePersistArgs(persistArgv, process.env);
  if ("error" in parsed) {
    throw new Error(parsed.error);
  }
  const bundle = composeBundle(parsed);
  if ("error" in bundle) {
    throw new Error(bundle.error);
  }
  const blob = buildBlob(bundle, parsed.usbUuid, parsed.passphrase);

  try {
    execFileSync("sudo", ["tee", target], {
      input: blob,
      stdio: ["pipe", "ignore", "inherit"],
    });
  } catch (e) {
    dumpDiagnostics(`sudo tee ${target} failed`);
    throw new Error(`sudo tee ${target} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    execFileSync("sudo", ["chmod", "600", target], { stdio: "ignore" });
  } catch {
    process.stdout.write(`B-0852: chmod 600 not honored for ${target}; continuing because some FAT mounts ignore POSIX modes\n`);
  }
  process.stdout.write(`B-0852: wrote encrypted credential blob to ${target} (USB UUID ${usbUuid})\n`);
}

function resolveTestInfraPubkeyPath(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, "../../", ZETA_TEST_INFRA_PUBKEY_REPO_RELATIVE_PATH);
}

function readAuthorizedKeysContent(pubkeyPath: string, testMode: boolean): string {
  const lines = [readFileSync(pubkeyPath, "utf8")];
  if (testMode) {
    const testInfraPath = resolveTestInfraPubkeyPath();
    if (!existsSync(testInfraPath)) {
      bail(3, `--test inject failed: test-infra pubkey not found at ${testInfraPath}`);
    }
    lines.push(readFileSync(testInfraPath, "utf8"));
    process.stdout.write(`test-mode: ALSO injecting ${testInfraPath} into authorized_keys union\n`);
  }
  const composed = composeAuthorizedKeysFileContent(lines);
  if (!composed.ok) {
    bail(3, `iter-4.2 inject failed: ${composed.error}`);
  }
  return composed.value;
}

async function injectPubkeyToUsb(
  pubkeyPath: string,
  hostOverride: string | null,
  credBake: CredBakeOptions,
  testMode: boolean,
): Promise<void> {
  process.stdout.write(`\niter-4.2: injecting ${pubkeyPath} into freshly-flashed USB ESP ...\n`);
  if (testMode) {
    process.stdout.write("test-mode: authorized_keys will be operator pubkey ∪ zeta-test-infra (QEMU-only)\n");
  }
  if (hostOverride !== null) {
    process.stdout.write(`iter-5.2: ALSO injecting hostname '${hostOverride}' into ESP ...\n`);
  }
  if (credBake.bakeCredArgs.length > 0) {
    process.stdout.write(`B-0852: ALSO baking ${credBake.bakeCredArgs.length} credential blob entr${credBake.bakeCredArgs.length === 1 ? "y" : "ies"} into ESP ...\n`);
  }

  // Brief settle so macOS re-reads partition table after dd
  await new Promise((r) => setTimeout(r, 2000));

  // Re-scan external disks. flash-usb enforces single-USB-only so after a
  // successful flash (--no-eject) there's exactly one external disk visible.
  const externalDisks = listExternalDisks();
  if (externalDisks.length === 0) {
    dumpDiagnostics("no external USB visible post-flash");
    bail(3, "iter-4.2 inject failed: no external USB disks found after flash. Re-plug + re-run zflash.");
  }
  if (externalDisks.length > 1) {
    dumpDiagnostics(`expected exactly 1 external USB; saw ${externalDisks.length}`);
    bail(
      3,
      `iter-4.2 inject failed: expected 1 external USB post-flash, saw ${externalDisks.length}. Unplug all but the flashed USB and re-run.`,
    );
  }
  const flashedDevice = externalDisks[0]!.device;
  process.stdout.write(`iter-4.2: target device ${flashedDevice}\n`);

  // Find the FAT ESP partition (typical NixOS installer ISO leaves one at partition 2)
  const espPart = findFatPartition(flashedDevice);
  if (!espPart) {
    dumpDiagnostics(`no FAT/EFI partition found on ${flashedDevice}`);
    bail(3, `iter-4.2 inject failed: ${flashedDevice} has no FAT/EFI partition for pubkey-write.`);
  }
  process.stdout.write(`iter-4.2: ESP partition ${espPart}\n`);

  // Mount it via iter-4.4 helper: tries `diskutil mount` first (GPT
  // EFI case), falls back to `mount_msdos` against mkdtemp mount
  // point for MBR 0xEF FAT case (NixOS isohybrid post-dd on macOS).
  let mountResult: EspMountResult;
  try {
    mountResult = mountEsp(espPart);
  } catch (e) {
    dumpDiagnostics(`mountEsp ${espPart} failed (both diskutil + mount_msdos paths)`);
    bail(
      3,
      `iter-4.2 inject failed: could not mount ${espPart}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const mountPoint = mountResult.mountPoint;
  process.stdout.write(`iter-4.2: mounted at ${mountPoint} (via ${mountResult.method})\n`);

  const authorizedKeysContent = readAuthorizedKeysContent(pubkeyPath, testMode);

  // Write via sudo tee (stdin avoids shell-quoting hazards). sudo is
  // required for the mount_msdos path (mount is root-owned); harmless
  // for the diskutil path (target is operator-writable anyway).
  const target = join(mountPoint, "zeta-authorized-keys.pub");
  try {
    execFileSync("sudo", ["tee", target], {
      input: authorizedKeysContent,
      stdio: ["pipe", "ignore", "inherit"],
    });
  } catch (e) {
    dumpDiagnostics(`sudo tee ${target} failed`);
    unmountEsp(espPart, mountResult);
    bail(3, `iter-4.2 inject failed: sudo tee ${target} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  process.stdout.write(`iter-4.2: wrote pubkey to ${target}\n`);

  // iter-5.2 (B-0792): if --host was passed, write zeta-hostname.txt
  // to ESP in the same mount session (covered by the same sudo
  // timestamp window; no additional Touch ID). zeta-install.sh reads
  // this file at install time + writes to /etc/zeta/cluster-node-id;
  // injected-hostname.nix module reads that file at NixOS evaluation
  // time + overrides networking.hostName.
  //
  // Hostname validation already happened at flag-parse time (RFC1123
  // check); re-verify shape here as defense-in-depth before writing.
  if (hostOverride !== null) {
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(hostOverride)) {
      unmountEsp(espPart, mountResult);
      bail(
        3,
        `iter-5.2 inject failed: hostname '${hostOverride}' fails RFC1123 validation at write time (should have caught at flag-parse; internal bug)`,
      );
    }
    const hostnameTarget = join(mountPoint, "zeta-hostname.txt");
    try {
      execFileSync("sudo", ["tee", hostnameTarget], {
        input: hostOverride + "\n",
        stdio: ["pipe", "ignore", "inherit"],
      });
    } catch (e) {
      dumpDiagnostics(`sudo tee ${hostnameTarget} failed`);
      unmountEsp(espPart, mountResult);
      bail(
        3,
        `iter-5.2 inject failed: sudo tee ${hostnameTarget} failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    process.stdout.write(`iter-5.2: wrote hostname '${hostOverride}' to ${hostnameTarget}\n`);
    process.stdout.write(`iter-5.2: installed node will be reachable as ssh zeta@${hostOverride}.local\n`);
  }

  if (credBake.bakeCredArgs.length > 0) {
    try {
      writeCredBlobToEsp(mountPoint, espPart, credBake);
    } catch (e) {
      unmountEsp(espPart, mountResult);
      bail(3, `B-0852 zeta-creds inject failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Unmount via the matching method (diskutil-mounted → diskutil
  // unmount; mount_msdos-mounted → sudo umount + rmSync tmpdir).
  unmountEsp(espPart, mountResult);

  // Eject the whole disk so operator can safely remove
  try {
    execFileSync("diskutil", ["eject", flashedDevice], { stdio: "inherit" });
    process.stdout.write(`iter-4.2: ${flashedDevice} ejected; safe to remove USB.\n`);
  } catch {
    process.stdout.write(
      `(eject ${flashedDevice} reported error; safe to remove USB anyway.)\n`,
    );
  }
}

async function main() {
  if (platform() !== "darwin") {
    bail(2, "zflash is macOS-only; for Linux see the manual flow in flash-usb.ts header");
  }

  // Strict arg validation (Copilot P0 catch): wrapper for destructive tool
  // must NOT silently accept unknown flags or extra positionals; a typo
  // (`zflash --dry-run`) or extra arg (`zflash a.iso b.iso`) would still
  // proceed to sudo dd. Allowlist flags + bail on unrecognized or
  // duplicate-positional.
  const ALLOWED_FLAGS = new Set([
    "-h",
    "--help",
    "--ssh-key",
    "--no-inject",
    "--skip-freshness-check",
    "--skip-iso-pull",
    "--host",
    "--agent",
    "--test",
    "--bake-cred",
    "--bake-passphrase-file",
    "--bake-passphrase-env",
    "--persona",
  ]);
  const argv = process.argv.slice(2);

  // Two-arg flag parsing for --ssh-key <path> and --host <name>
  let sshKeyOverride: string | null = null;
  let noInject = false;
  let skipFreshnessCheck = false;
  let skipIsoPull = false;
  let hostOverride: string | null = null;
  let agentMode = false;
  let testMode = false;
  const bakeCredArgs: string[] = [];
  let bakePassphraseFile: string | null = null;
  let bakePassphraseEnv: string | null = null;
  let bakePersona: string | null = null;
  const rawFlags: string[] = [];
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--ssh-key") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        bail(2, "--ssh-key requires a path argument (e.g., --ssh-key ~/.ssh/id_ed25519.pub)");
      }
      // Per #5083 Copilot P1: Node's path.resolve doesn't expand `~/` to
      // homedir; raw `--ssh-key ~/.ssh/id_ed25519.pub` would resolve to
      // a literal `~/.ssh/...` path under cwd and fail existence checks.
      // Expand leading `~/` (and bare `~`) to homedir() before resolve.
      const expanded = next === "~" || next.startsWith("~/")
        ? join(homedir(), next.slice(next === "~" ? 1 : 2))
        : next;
      sshKeyOverride = resolve(expanded);
      i++;
      continue;
    }
    if (a === "--no-inject") {
      noInject = true;
      continue;
    }
    if (a === "--skip-freshness-check") {
      skipFreshnessCheck = true;
      continue;
    }
    if (a === "--skip-iso-pull") {
      skipIsoPull = true;
      continue;
    }
    if (a === "--agent") {
      agentMode = true;
      continue;
    }
    if (a === "--test") {
      testMode = true;
      continue;
    }
    if (a === "--host") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        bail(2, "--host requires a name argument (e.g., --host pikachu)");
      }
      // iter-5.2 (B-0792): hostname per RFC1123 — alphanumeric + hyphens,
      // no leading/trailing hyphen, 1-63 chars. Reject empty + invalid
      // shapes BEFORE writing to USB so cluster-side substrate doesn't
      // have to handle garbage. Aaron 2026-05-26 architectural framing:
      // hostname is a unique identity, NOT a role label — operator picks
      // any short memorable name (pikachu, charizard, sapphire, etc.).
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(next)) {
        bail(
          2,
          `--host '${next}' is not a valid RFC1123 hostname (alphanumeric + hyphens, 1-63 chars, no leading/trailing hyphen)`,
        );
      }
      hostOverride = next;
      i++;
      continue;
    }
    if (a === "--bake-cred") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        bail(2, "--bake-cred requires an id=value argument (e.g., --bake-cred gh-cli=ghp_xxx)");
      }
      bakeCredArgs.push(next);
      i++;
      continue;
    }
    if (a === "--bake-passphrase-file") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        bail(2, "--bake-passphrase-file requires a path argument");
      }
      const expanded = next === "~" || next.startsWith("~/")
        ? join(homedir(), next.slice(next === "~" ? 1 : 2))
        : next;
      bakePassphraseFile = resolve(expanded);
      i++;
      continue;
    }
    if (a === "--bake-passphrase-env") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        bail(2, "--bake-passphrase-env requires an environment variable name");
      }
      bakePassphraseEnv = next;
      i++;
      continue;
    }
    if (a === "--persona") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        bail(2, "--persona requires a persona name");
      }
      bakePersona = next;
      i++;
      continue;
    }
    if (a.startsWith("-")) {
      rawFlags.push(a);
      continue;
    }
    positional.push(a);
  }

  const unknownFlags = rawFlags.filter((f) => !ALLOWED_FLAGS.has(f));
  if (unknownFlags.length > 0) {
    bail(
      2,
      `unknown flag(s): ${unknownFlags.join(", ")}\n` +
        `Allowed flags: ${[...ALLOWED_FLAGS].join(", ")}\n` +
        `Refusing to proceed — destructive tool requires exact flag match.`,
    );
  }
  if (positional.length > 1) {
    bail(
      2,
      `too many positional arguments: ${positional.length} provided; expected at most 1 ISO path.\n` +
        `  got: ${positional.join(" ")}\n` +
        `Refusing to proceed — destructive tool requires exact arg count.`,
    );
  }
  const credBake: CredBakeOptions = {
    bakeCredArgs,
    passphraseFile: bakePassphraseFile,
    passphraseEnv: bakePassphraseEnv,
    persona: bakePersona,
  };
  if (credBake.bakeCredArgs.length === 0) {
    if (credBake.passphraseFile !== null || credBake.passphraseEnv !== null || credBake.persona !== null) {
      bail(2, "--bake-passphrase-* and --persona require at least one --bake-cred");
    }
  } else {
    if (credBake.passphraseFile !== null && credBake.passphraseEnv !== null) {
      bail(2, "choose exactly one passphrase source: --bake-passphrase-file OR --bake-passphrase-env");
    }
    if (credBake.passphraseFile === null && credBake.passphraseEnv === null) {
      bail(2, "--bake-cred requires --bake-passphrase-file <path> or --bake-passphrase-env <VAR>");
    }
    if (noInject) {
      bail(2, "--bake-cred requires ESP injection; remove --no-inject");
    }
  }
  const isHelp = rawFlags.includes("-h") || rawFlags.includes("--help");
  if (isHelp) {
    process.stdout.write(
      "Usage: bun full-ai-cluster/tools/zflash.ts [flags] [iso-path]\n" +
        "  --ssh-key <path>          override default ~/.ssh/id_ed25519.pub for iter-4.2 inject\n" +
        "  --no-inject               skip the iter-4.2 ESP pubkey write (v1 manual-edit fallback)\n" +
        "  --skip-freshness-check    bypass iter-4.3 stale-checkout detection (NOT recommended)\n" +
        "  --skip-iso-pull           bypass iter-4.3 CI-ISO auto-download (use local newest)\n" +
        "  --host <name>             iter-5.2 inject node hostname (RFC1123); decoupled from\n" +
        "                            role-stack — e.g., --host pikachu installs as pikachu\n" +
        "                            regardless of flake role config. Default: flake config name\n" +
        "                            (control-plane for the zero-typing single-node path)\n" +
        "  --agent                   (B-0844) agent-driven mode — spawn flash-usb with piped stdin\n" +
        "                            so the agent auto-types the 'yes <nonce>' challenge by reading\n" +
        "                            the nonce from stdout. Touch ID PAM gate STILL fires on the\n" +
        "                            operator's Mac (cannot be agent-bypassed). Use when running\n" +
        "                            zflash through a pipe ('| tail', '2>&1 >log', etc.) which\n" +
        "                            breaks the default readline.question stdin-from-terminal flow.\n" +
        "  --test                    QEMU/CI-only: inject zeta-test-infra.pub alongside the operator\n" +
        "                            pubkey into /zeta-authorized-keys.pub. Production USB/ISO builds\n" +
        "                            must omit this flag so prod never trusts the ephemeral test key.\n" +
        "  --bake-cred <id=value>    B-0852 write encrypted /zeta-creds.enc to USB ESP\n" +
        "                            after flashing; repeatable. Values use the existing\n" +
        "                            zeta-creds-persist credential handlers.\n" +
        "  --bake-passphrase-file <path>\n" +
        "                            passphrase file for --bake-cred encryption\n" +
        "  --bake-passphrase-env <VAR>\n" +
        "                            environment variable containing passphrase for --bake-cred\n" +
        "  --persona <name>          persona scope for persona-scoped --bake-cred entries\n" +
        "  iso-path                  (optional) explicit ISO; default = newest under ~/Downloads,\n" +
        "                            auto-pulled from CI if origin/main has fresher build\n" +
        "  Run zflash-setup once first to install Touch ID for sudo.\n",
    );
    process.exit(0);
  }

  // iter-4.3 freshness check: bail if local install-substrate is behind
  // origin/main. Skip if explicitly opted out OR if not in a git checkout
  // (zflash run from a copied-out location). Skip in destructive path
  // ONLY when operator explicitly asked via --skip-freshness-check.
  if (!skipFreshnessCheck) {
    const repoRoot = findRepoRoot();
    if (repoRoot) {
      checkLocalCheckoutFreshness(repoRoot);
    } else {
      process.stderr.write(
        "zflash: (iter-4.3 freshness check skipped — not running from a git checkout)\n",
      );
    }
  } else {
    process.stderr.write("zflash: WARN — iter-4.3 freshness check bypassed via --skip-freshness-check\n");
  }

  const explicit = positional[0];
  let isoPath = explicit ? resolve(explicit) : autoDiscoverIso();

  // iter-4.3 CI-ISO auto-download: if local newest is older than the latest
  // successful CI build on main, pull the fresh artifact. Skip when explicit
  // ISO path passed (operator overrides), when opted out, or on failure.
  if (!explicit && !skipIsoPull) {
    isoPath = autoDownloadFreshIsoIfNeeded(isoPath);
  }

  const flashUsb = findFlashUsbPath();

  // Pre-flight: determine if iter-4.2 inject will run + which key
  const pubkeyPath = sshKeyOverride ?? DEFAULT_SSH_KEY;
  let willInject = !noInject;
  if (willInject && !existsSync(pubkeyPath)) {
    process.stderr.write(
      `\nzflash: iter-4.2 inject skipped — pubkey not found at ${pubkeyPath}\n` +
        `  (proceeding with flash; cluster node will need manual operator-ssh-keys.nix\n` +
        `   edit + nixos-rebuild on first login per iter-4 v1 fallback)\n\n`,
    );
    willInject = false;
  }

  // iter-5.2.2 (B-0792) — REVERTS iter-5.2.1 flash-time auto-generation:
  //
  // The maintainer 2026-05-26 surfaced the design flaw with flash-time
  // auto-generation: *"wait zflash has a hard coded name? i was
  // thinking it would be auto generated on each machine so i can't
  // use that same usb twice?"* — baking a name into the ESP at flash
  // time meant every install from the same USB inherits the SAME
  // hostname, causing mDNS collision when reused across machines.
  //
  // Fix: when --host is NOT passed, DON'T write zeta-hostname.txt
  // to the ESP. zeta-install.sh now generates a fresh random
  // node-<6hex> ON THE NODE at install time (per-install unique).
  // Each install from the same USB gets a different hostname.
  //
  // Operator paths:
  //   - `zflash --host pikachu` → ESP carries 'pikachu'; install honors
  //   - `zflash` (no --host) → ESP has no hostname; install auto-gens
  //                            on-node + prints in install banner +
  //                            displays in pre-login banner per
  //                            iter-5.2.2 NixOS login-banner module.
  //
  // The previous iter-5.2.1 "log the auto-name pre-flash so operator
  // knows what to ssh to" UX is lost in trade — operator now reads
  // the auto-name from the cluster console's login banner (printed
  // pre-login per iter-5.2.2 login-banner module) OR from mDNS scan.
  // Right trade for multi-node correctness.
  if (hostOverride === null && willInject) {
    process.stdout.write(
      `\niter-5.2.2: --host not specified; zeta-install.sh on-node will\n` +
        `             auto-generate a unique node-<6hex> hostname per-install.\n` +
        `             Pre-login banner on first boot displays the chosen hostname\n` +
        `             + IP (per iter-5.2.2 NixOS login-banner module).\n` +
        `             For memorable names, re-flash with: zflash --host <name>\n\n`,
    );
  }

  // Stdio inherit (default) — child handles all I/O directly (readline,
  // sudo Touch ID PAM prompt, dd progress). We are a thin invocation
  // wrapper.
  //
  // Agent mode (--agent flag, B-0844): switch from execFileSync({stdio:
  // "inherit"}) to spawn({stdio: ["pipe", "pipe", "inherit"]}) — stdin
  // is piped so we can auto-type the challenge response; stdout is
  // piped so we can SCAN for the "yes <nonce>" challenge line then
  // mirror everything back to our stdout; stderr remains inherited so
  // the Touch ID PAM prompt visibility is preserved.
  //
  // Why this exists: zflash docstring promised "agent auto-types the
  // yes <nonce> challenge" but the execFileSync({stdio: "inherit"})
  // implementation broke under any non-interactive stdin (e.g.,
  // `bun zflash.ts | tail`). The 2026-05-26 3rd USB-test session
  // surfaced this empirically — operator saw "safe to remove USB"
  // but USB wasn't actually formatted. This agent-mode closes the
  // docstring-vs-implementation gap.
  //
  // Touch ID PAM gate is PRESERVED — agent cannot bypass biometric
  // physical-presence proof on the operator's Mac.
  const flashUsbArgs = willInject
    ? [flashUsb, "--short", "--no-eject", isoPath]
    : [flashUsb, "--short", isoPath];
  if (agentMode) {
    process.stdout.write(
      "\nzflash: --agent mode active — will auto-type challenge response\n" +
        "         (Touch ID PAM gate still fires on operator's Mac;\n" +
        "          biometric physical-presence proof cannot be agent-bypassed)\n\n",
    );
    await new Promise<void>((res, rej) => {
      const child = spawn("bun", flashUsbArgs, {
        stdio: ["pipe", "pipe", "inherit"],
      });
      let stdoutBuf = "";
      let challengeAnswered = false;
      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        process.stdout.write(text); // mirror to operator's view
        if (!challengeAnswered) {
          stdoutBuf += text;
          // Match the "  yes <4hex>" line emitted by flash-usb.ts at
          // the runtime-acceptance prompt. The challenge is indented
          // by 2 spaces in flash-usb.ts; the nonce is exactly 4 hex
          // chars (16-bit entropy; per-run random; can't be pre-baked).
          const m = stdoutBuf.match(/^\s+yes ([0-9a-f]{4})\s*$/m);
          if (m) {
            const nonce = m[1];
            const answer = `yes ${nonce}\n`;
            process.stdout.write(
              `\n[agent-mode: auto-typing '${answer.trim()}' — operator visibility per glass-halo-bidirectional rule]\n`,
            );
            child.stdin.write(answer);
            child.stdin.end();
            challengeAnswered = true;
          }
        }
      });
      child.on("close", (code) => {
        if (code === 0) {
          res();
        } else {
          process.exit(code ?? 1);
        }
      });
      child.on("error", (err) => rej(err));
    });
  } else {
    try {
      execFileSync("bun", flashUsbArgs, { stdio: "inherit" });
    } catch (e: unknown) {
      // execFileSync throws on non-zero exit; child has already printed
      // its own error message + exited with its own code via flash-usb's
      // bail(). We propagate the exit code.
      const status =
        e && typeof e === "object" && "status" in e
          ? Number((e as { status: number }).status) || 1
          : 1;
      process.exit(status);
    }
  }

  if (willInject) {
    await injectPubkeyToUsb(pubkeyPath, hostOverride, credBake, testMode);
  } else {
    process.stdout.write("\n(iter-4.2 inject skipped per --no-inject or missing pubkey)\n");
    if (hostOverride !== null) {
      process.stdout.write(
        `(iter-5.2 hostname inject ALSO skipped — --host ${hostOverride} requires --no-inject NOT set;\n` +
          ` re-run without --no-inject if you want the hostname to land on the USB ESP)\n`,
      );
    }
  }
}

main().catch((err) => {
  bail(1, err instanceof Error ? err.message : String(err));
});
