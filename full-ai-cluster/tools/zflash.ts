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
//   ISO: ~/Downloads/zeta-installer-24.11.iso (1.70 GiB)
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

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  // type-info like "DOS_FAT_32" / "EFI" / "Microsoft Basic Data".
  // Returns the partition device path (e.g., /dev/disk6s2) or null.
  try {
    const out = execFileSync("diskutil", ["list", device], { encoding: "utf8" });
    const lines = out.split("\n");
    for (const line of lines) {
      // FAT/EFI partitions show up with types like:
      //   2: EFI EFI                  209.7 MB   disk6s1
      //   2: DOS_FAT_32 NIXOS_ISO     65.5 MB    disk6s2
      // Be lenient — accept anything FAT/EFI/MS-DOS-shaped.
      if (/\b(DOS_FAT|EFI|MS-DOS|FAT16|FAT32|Windows_FAT)\b/i.test(line)) {
        const m = line.match(/\b(disk\d+s\d+)\s*$/);
        if (m) return `/dev/${m[1]}`;
      }
    }
  } catch {
    /* fall through to null */
  }
  return null;
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

async function injectPubkeyToUsb(pubkeyPath: string): Promise<void> {
  process.stdout.write(`\niter-4.2: injecting ${pubkeyPath} into freshly-flashed USB ESP ...\n`);

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

  // Mount it (diskutil mount may not need sudo if the ESP auto-mounts)
  try {
    execFileSync("diskutil", ["mount", espPart], { stdio: "inherit" });
  } catch (e) {
    dumpDiagnostics(`diskutil mount ${espPart} failed`);
    bail(
      3,
      `iter-4.2 inject failed: diskutil mount ${espPart} failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // Get mount point
  const mountPoint = getMountPoint(espPart);
  if (!mountPoint) {
    dumpDiagnostics(`no Mount Point in diskutil info ${espPart}`);
    try {
      execFileSync("diskutil", ["unmount", espPart], { stdio: "ignore" });
    } catch {
      /* ignore */
    }
    bail(3, `iter-4.2 inject failed: mounted ${espPart} but couldn't determine mount point.`);
  }
  process.stdout.write(`iter-4.2: mounted at ${mountPoint}\n`);

  // Read pubkey content
  const pubkey = readFileSync(pubkeyPath, "utf8").trim();
  const firstLine = pubkey.split("\n")[0] ?? "";
  // Per #5083 Copilot P1: broaden to all OpenSSH pubkey type tokens
  // per sshd(8) AuthorizedKeysFile. Validates structurally: type token
  // (one of ssh-*, ecdsa-sha2-*, sk-ssh-*, sk-ecdsa-sha2-*) + space +
  // base64-shaped material (allow any non-whitespace; the actual base64
  // decode happens on the cluster side).
  const VALID_PUBKEY = /^(ssh-(ed25519|rsa|dss)|ecdsa-sha2-\S+|sk-ssh-ed25519@\S+|sk-ecdsa-sha2-\S+)\s+\S+/;
  if (!VALID_PUBKEY.test(firstLine)) {
    try {
      execFileSync("diskutil", ["unmount", espPart], { stdio: "ignore" });
    } catch {
      /* ignore */
    }
    dumpDiagnostics(`${pubkeyPath} first line is not a recognized OpenSSH pubkey (expected ssh-ed25519 / ssh-rsa / ssh-dss / ecdsa-sha2-* / sk-ssh-ed25519@* / sk-ecdsa-sha2-*)`);
    bail(3, `iter-4.2 inject failed: ${pubkeyPath} is not a recognized SSH pubkey format.`);
  }

  // Write via sudo tee (stdin avoids shell-quoting hazards)
  const target = join(mountPoint, "zeta-authorized-keys.pub");
  try {
    execFileSync("sudo", ["tee", target], {
      input: pubkey + "\n",
      stdio: ["pipe", "ignore", "inherit"],
    });
  } catch (e) {
    dumpDiagnostics(`sudo tee ${target} failed`);
    try {
      execFileSync("diskutil", ["unmount", espPart], { stdio: "ignore" });
    } catch {
      /* ignore */
    }
    bail(3, `iter-4.2 inject failed: sudo tee ${target} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  process.stdout.write(`iter-4.2: wrote pubkey to ${target}\n`);

  // Unmount
  try {
    execFileSync("diskutil", ["unmount", espPart], { stdio: "inherit" });
  } catch {
    process.stdout.write(`(unmount of ${espPart} reported error; that is usually safe to ignore.)\n`);
  }

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
  const ALLOWED_FLAGS = new Set(["-h", "--help", "--ssh-key", "--no-inject"]);
  const argv = process.argv.slice(2);

  // Two-arg flag parsing for --ssh-key <path>
  let sshKeyOverride: string | null = null;
  let noInject = false;
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
  const isHelp = rawFlags.includes("-h") || rawFlags.includes("--help");
  if (isHelp) {
    process.stdout.write(
      "Usage: bun full-ai-cluster/tools/zflash.ts [--ssh-key <path>] [--no-inject] [iso-path]\n" +
        "  --ssh-key <path>  override default ~/.ssh/id_ed25519.pub for iter-4.2 inject\n" +
        "  --no-inject       skip the iter-4.2 ESP pubkey write (USB will boot but\n" +
        "                    cluster node won't have SSH access until manual edit +\n" +
        "                    nixos-rebuild on first login per iter-4 v1 fallback)\n" +
        "  iso-path          (optional) explicit ISO; default = newest\n" +
        "                    ~/Downloads/zeta-installer-*.iso\n" +
        "  Run zflash-setup once first to install Touch ID for sudo.\n",
    );
    process.exit(0);
  }

  const explicit = positional[0];
  const isoPath = explicit ? resolve(explicit) : autoDiscoverIso();
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

  // Stdio inherit — child handles all I/O directly (readline, sudo Touch ID
  // PAM prompt, dd progress). We are a thin invocation wrapper.
  const flashUsbArgs = willInject
    ? [flashUsb, "--short", "--no-eject", isoPath]
    : [flashUsb, "--short", isoPath];
  try {
    execFileSync("bun", flashUsbArgs, { stdio: "inherit" });
  } catch (e: unknown) {
    // execFileSync throws on non-zero exit; child has already printed its
    // own error message + exited with its own code via flash-usb's bail().
    // We propagate the exit code.
    const status =
      e && typeof e === "object" && "status" in e
        ? Number((e as { status: number }).status) || 1
        : 1;
    process.exit(status);
  }

  if (willInject) {
    await injectPubkeyToUsb(pubkeyPath);
  } else {
    process.stdout.write("\n(iter-4.2 inject skipped per --no-inject or missing pubkey)\n");
  }
}

main().catch((err) => {
  bail(1, err instanceof Error ? err.message : String(err));
});
