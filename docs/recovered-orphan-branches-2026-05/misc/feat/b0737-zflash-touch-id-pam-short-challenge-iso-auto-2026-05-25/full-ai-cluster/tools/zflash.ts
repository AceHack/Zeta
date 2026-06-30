#!/usr/bin/env bun
// full-ai-cluster/tools/zflash.ts
//
// Ultra-short wrapper around flash-usb.ts for the AI-cluster installer.
//
// Auto-discovers the newest `~/Downloads/zeta-installer-*.iso`, invokes
// flash-usb with the `--short` challenge format, and lets sudo's PAM
// stack (Touch ID, after `zflash-setup` ran) gate the dd.
//
// End-to-end keystrokes after first-time setup:
//
//   $ bun full-ai-cluster/tools/zflash.ts
//   ISO: ~/Downloads/zeta-installer-24.11.iso (1.70 GiB)
//   USB: /dev/disk6 (115 GiB, USB 3.2.1 FD)
//   *** ALL DATA ON /dev/disk6 WILL BE DESTROYED ***
//   type: yes a3f9
//   > yes a3f9         ← 8 chars; per-run random; can't be pre-baked
//   [Touch ID prompt]   ← finger on trackpad; PAM gate
//   Flash complete.
//
// Recommended shell alias (set up by zflash-setup):
//   alias zflash='bun ~/Documents/src/repos/Zeta/full-ai-cluster/tools/zflash.ts'
// Then just type: zflash
//
// Safety contract — preserved end-to-end:
//   - All flash-usb sanity rails (platform, ISO size + extension, USB
//     protocol, internal-disk + boot-disk refusal, size range)
//   - Random nonce per run (4 hex = 16-bit entropy; not pre-bakeable)
//   - Explicit consent token `yes` (not a stray Enter keypress)
//   - Touch ID PAM gate on the sudo dd (biometric proof of physical
//     presence; replaces password typing)
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
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ISO_GLOB_PREFIX = "zeta-installer-";

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

async function main() {
  if (platform() !== "darwin") {
    bail(2, "zflash is macOS-only; for Linux see the manual flow in flash-usb.ts header");
  }

  // Arg parsing: optional ISO path positional; --help.
  const argv = process.argv.slice(2);
  const isHelp = argv.includes("-h") || argv.includes("--help");
  if (isHelp) {
    process.stdout.write(
      "Usage: bun full-ai-cluster/tools/zflash.ts [iso-path]\n" +
        "  Auto-discovers newest ~/Downloads/zeta-installer-*.iso if no path.\n" +
        "  Run zflash-setup once first to install Touch ID for sudo.\n",
    );
    process.exit(0);
  }

  const explicit = argv.filter((a) => !a.startsWith("-"))[0];
  const isoPath = explicit ? resolve(explicit) : autoDiscoverIso();
  const flashUsb = findFlashUsbPath();

  // Stdio inherit — child handles all I/O directly (readline, sudo Touch ID
  // PAM prompt, dd progress). We are a thin invocation wrapper.
  try {
    execFileSync("bun", [flashUsb, "--short", isoPath], { stdio: "inherit" });
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
}

main().catch((err) => {
  bail(1, err instanceof Error ? err.message : String(err));
});
