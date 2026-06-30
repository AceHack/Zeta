#!/usr/bin/env bun
// full-ai-cluster/tools/zflash-setup.ts
//
// One-time setup for zflash: installs Touch ID as the PAM auth method
// for sudo so each `zflash` flash gates on biometric proof of physical
// presence instead of typing a password.
//
// What this script does:
//   1. Checks /etc/pam.d/sudo for an existing `auth sufficient pam_tid.so`
//      line. If present, it's idempotent — no-op + report.
//   2. If absent, inserts `auth sufficient pam_tid.so` at the TOP of the
//      auth stack (so Touch ID is tried before password). Uses `sudo tee`
//      to rewrite the file with the new line prepended. Note: `tee`
//      truncates + writes in place; this is NOT a crash-atomic rename
//      (e.g., `tee tmp; mv tmp /etc/pam.d/sudo`). If `sudo tee` is
//      interrupted mid-write, /etc/pam.d/sudo could be left truncated
//      and the next sudo could fail. Acceptable here because (a) the
//      operation is one-time + interactive (operator at console;
//      interruption rare), (b) recovery is trivial (Apple's stock
//      /etc/pam.d/sudo is well-documented and short — re-create from
//      docs if needed), (c) full crash-atomic write would require an
//      atomic-rename helper running as root which adds attack surface.
//      Future scope item: implement true crash-atomic write if real
//      interruption shows up in operation.
//   3. On macOS Sequoia 15+, this change persists across `softwareupdate`
//      (the OS preserves user-added pam_tid lines in /etc/pam.d/sudo). On
//      earlier macOS versions, the change MAY get reverted on system updates
//      — re-run zflash-setup after major OS updates if `sudo` starts asking
//      for a password again.
//   4. Optionally adds a shell alias `zflash` to ~/.zshrc (or specified rc
//      file) for ultra-short invocation. Skipped if an alias already exists.
//
// What this script does NOT do:
//   - Does NOT add a sudoers NOPASSWD rule. The Touch ID gate IS the
//     consent floor; NOPASSWD would remove all auth. We keep PAM in the
//     loop so biometric proof is required.
//   - Does NOT store any passwords. Touch ID auth uses the Mac's Secure
//     Enclave; no credentials flow through this script.
//   - Does NOT modify the flash-usb.ts safety rails. All hardware sanity
//     checks (USB-only, single-USB, non-internal, non-boot, size-bounds,
//     ISO checks) + the runtime nonce gate remain in force.
//
// Idempotent: safe to re-run. Reports current state on each invocation.
//
// Usage:
//   bun full-ai-cluster/tools/zflash-setup.ts [--install-alias]
//     --install-alias  also add `alias zflash='bun <path>/zflash.ts'`
//                      to ~/.zshrc (or $SHELL_RC env var)
//
// Requires sudo (asks for password ONCE during PAM file edit; future
// sudo invocations use Touch ID).

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PAM_SUDO = "/etc/pam.d/sudo";
const PAM_TID_LINE = "auth       sufficient     pam_tid.so";

function bail(code: number, msg: string): never {
  process.stderr.write(`zflash-setup: ${msg}\n`);
  process.exit(code);
}

function info(msg: string): void {
  process.stdout.write(`zflash-setup: ${msg}\n`);
}

function pamSudoHasTid(): boolean {
  if (!existsSync(PAM_SUDO)) {
    bail(2, `${PAM_SUDO} does not exist; cannot install Touch ID PAM line`);
  }
  const contents = readFileSync(PAM_SUDO, "utf8");
  // Match any uncommented line containing pam_tid.so
  return contents
    .split("\n")
    .some((line) => !line.trimStart().startsWith("#") && /pam_tid\.so/.test(line));
}

function installPamTid(): void {
  info(`installing ${PAM_TID_LINE} at top of ${PAM_SUDO}`);
  info("sudo will prompt for password ONCE here (then Touch ID forever after)");

  // Read current contents (no sudo needed for read — /etc/pam.d/sudo is
  // world-readable on macOS by default).
  const current = readFileSync(PAM_SUDO, "utf8");

  // Prepend the pam_tid line using the file's existing newline style.
  // Apple's stock /etc/pam.d/sudo uses LF; detecting + matching covers
  // any operator who's hand-edited the file with a CR/LF tool.
  const usesCrLf = current.includes("\r\n") && !current.includes("\n\n");
  const lineEnding = usesCrLf ? "\r\n" : "\n";
  const newContents = `${PAM_TID_LINE}${lineEnding}${current}`;

  // `sudo tee` rewrites the file in place (truncate + write). Not
  // crash-atomic; see header for the trade-off rationale.
  const r = spawnSync("sudo", ["tee", PAM_SUDO], {
    input: newContents,
    stdio: ["pipe", "ignore", "inherit"],
  });
  if (r.status !== 0) {
    bail(r.status ?? 1, "sudo tee failed; PAM file not updated");
  }

  info("PAM Touch ID installed");
}

function verifyTouchIdHardware(): boolean {
  // `bioutil -r` reports biometric capability. Not strictly required —
  // PAM will fall through to password if biometric hardware is absent.
  try {
    const out = execFileSync("bioutil", ["-r"], { encoding: "utf8" });
    // If we got output without throwing, biometric subsystem is responding.
    return out.length > 0;
  } catch {
    return false;
  }
}

function addShellAlias(): void {
  const rcPath = process.env["SHELL_RC"] ?? join(homedir(), ".zshrc");
  // fileURLToPath decodes percent-encoding so spaces/unicode in the
  // checkout path produce a valid filesystem path the shell can use.
  const zflashPath = join(dirname(fileURLToPath(import.meta.url)), "zflash.ts");
  const aliasLine = `alias zflash='bun ${zflashPath}'`;

  if (!existsSync(rcPath)) {
    info(`shell rc ${rcPath} does not exist; skipping alias install`);
    info(`add this manually to your shell rc:  ${aliasLine}`);
    return;
  }
  const rc = readFileSync(rcPath, "utf8");
  if (rc.includes("alias zflash=")) {
    info(`alias zflash already in ${rcPath}; skipping`);
    return;
  }
  // Append (writeFileSync with 'a' flag would be cleaner; using execFileSync
  // tee for parity + audit transparency)
  const newRc = `${rc}\n# Installed by zflash-setup ${new Date().toISOString()}\n${aliasLine}\n`;
  const r = spawnSync("tee", [rcPath], {
    input: newRc,
    stdio: ["pipe", "ignore", "inherit"],
  });
  if (r.status !== 0) {
    bail(r.status ?? 1, `failed to write ${rcPath}`);
  }
  info(`added alias to ${rcPath}; reload shell or source it to activate`);
}

async function main() {
  if (platform() !== "darwin") {
    bail(2, "zflash-setup is macOS-only (Touch ID via pam_tid.so is Apple-specific)");
  }

  const argv = process.argv.slice(2);
  const installAlias = argv.includes("--install-alias");
  const isHelp = argv.includes("-h") || argv.includes("--help");
  if (isHelp) {
    process.stdout.write(
      "Usage: bun full-ai-cluster/tools/zflash-setup.ts [--install-alias]\n" +
        "  --install-alias   also add `alias zflash=...` to ~/.zshrc\n",
    );
    process.exit(0);
  }

  info(`platform: macOS ${execFileSync("sw_vers", ["-productVersion"], { encoding: "utf8" }).trim()}`);
  info(`biometric hardware: ${verifyTouchIdHardware() ? "present" : "not detected (PAM will fall back to password)"}`);

  if (pamSudoHasTid()) {
    info(`${PAM_SUDO} already has pam_tid.so line — no changes needed`);
  } else {
    installPamTid();
  }

  if (installAlias) {
    addShellAlias();
  } else {
    info("(--install-alias not passed; skipping shell alias install)");
    // fileURLToPath decodes percent-encoding so spaces/unicode in the
  // checkout path produce a valid filesystem path the shell can use.
  const zflashPath = join(dirname(fileURLToPath(import.meta.url)), "zflash.ts");
    info(`to add manually:  alias zflash='bun ${zflashPath}'`);
  }

  info("done. Test with: sudo -k && sudo true   (should prompt for Touch ID)");
}

main().catch((err) => {
  bail(1, err instanceof Error ? err.message : String(err));
});
