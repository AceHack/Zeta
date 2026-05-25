#!/usr/bin/env bun
// full-ai-cluster/tools/flash-usb.ts
//
// Safety-railed `dd` wrapper for flashing the AI-cluster installer
// ISO to a USB stick on macOS. Built so the maintainer (and any
// autonomous agent the maintainer authorizes) can flash without
// risk of picking the wrong device.
//
// Why this exists: the classifier blocks ad-hoc `dd` + recon as a
// composite high-blast-radius operation. A reviewable script with
// hard-coded safety guards changes the blast-radius calculation —
// every destructive action is gated by checks the maintainer can
// audit once in code review, instead of every-invocation trust.
//
// Hard refusals (exit 2):
//   - Not running on macOS (Linux support is TODO)
//   - ISO arg missing, not a file, or not *.iso
//   - ISO size outside [200 MiB, 8 GiB] — sanity gate
//   - Zero or 2+ USB devices connected (ambiguous)
//   - Selected device is not protocol USB/USB-C
//   - Selected device is internal
//   - Selected device is the current boot disk
//   - Selected device size outside [4 GiB, 256 GiB]
//
// Confirmation gate (exit 1):
//   - Operator must type the FULL device path (e.g. `/dev/disk4`).
//     `yes`/`y` is REJECTED — typed-path is the verification
//     that the operator visually checked the device.
//
// Then:
//   - `diskutil unmountDisk` (not eject)
//   - `sudo dd` with `/dev/rdiskN` (raw device; ~10x faster)
//   - `bs=4m conv=sync status=progress`
//   - `diskutil eject` on success
//
// Usage:
//   bun full-ai-cluster/tools/flash-usb.ts <path-to-iso>
//
// Authorization for agent execution:
//   The classifier may block `diskutil list` + `dd` even from this
//   script. To allow an agent to run it, add to .claude/settings.json:
//     "permissions": { "allow": [
//       "Bash(bun full-ai-cluster/tools/flash-usb.ts *)"
//     ] }
//   The safety rails in this script are what makes that permission
//   grant reasonable.
//
// Implementation note: all subprocess calls use execFileSync (argv-
// array form) — never shell interpolation. Inputs that flow into
// arguments come from diskutil's own JSON output (trusted) or from
// hardcoded literals, never from user-controlled strings.

import { execFileSync, spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { platform } from "node:os";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const MIN_ISO_BYTES = 200 * 1024 * 1024;
const MAX_ISO_BYTES = 8 * 1024 * 1024 * 1024;
const MIN_USB_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_USB_BYTES = 256 * 1024 * 1024 * 1024;

function bail(code: number, msg: string): never {
  process.stderr.write(`flash-usb: ${msg}\n`);
  process.exit(code);
}

function human(bytes: number): string {
  const u = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(2)} ${u[i]}`;
}

// Convert plist XML stdin to JSON via plutil. Safe pipeline because
// the plist comes from diskutil (trusted), not user input.
function plistToJson(plistXml: string): unknown {
  const json = execFileSync("plutil", ["-convert", "json", "-o", "-", "-"], {
    input: plistXml,
    encoding: "utf8",
  });
  return JSON.parse(json);
}

function diskutilListPlist(): unknown {
  const xml = execFileSync(
    "diskutil",
    ["list", "-plist", "external", "physical"],
    { encoding: "utf8" },
  );
  return plistToJson(xml);
}

function diskutilInfo(device: string): Record<string, unknown> {
  const xml = execFileSync("diskutil", ["info", "-plist", device], {
    encoding: "utf8",
  });
  return plistToJson(xml) as Record<string, unknown>;
}

function bootDiskIdentifier(): string {
  // `mount` output -> find row mounting `/` -> extract diskN.
  const mountOut = execFileSync("mount", [], { encoding: "utf8" });
  const rootMount = mountOut.split("\n").find((l) => / on \/ \(/.test(l));
  if (!rootMount) return "";
  const m = rootMount.match(/^\/dev\/(disk\d+)/);
  return m?.[1] ?? "";
}

// Whitelist of safe device-identifier shapes. Belt-and-suspenders
// even though diskutil produces these strings itself.
function assertSafeDevicePath(device: string): void {
  if (!/^\/dev\/disk\d+$/.test(device)) {
    bail(2, `unsafe device path: ${device}`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const firstArg = argv[0];
  const isHelp = firstArg === "-h" || firstArg === "--help";
  // Preserve original unified-check semantics: any of {wrong arg count,
  // help-flag in any position} prints usage and exits — exit 0 ONLY
  // when there's exactly one arg and it's a help flag.
  if (argv.length !== 1 || isHelp) {
    process.stdout.write(
      "Usage: bun full-ai-cluster/tools/flash-usb.ts <path-to-iso>\n",
    );
    process.exit(argv.length === 1 && isHelp ? 0 : 2);
  }
  if (firstArg === undefined) bail(2, "internal: argv length check passed but argv[0] is undefined");
  const isoPath: string = firstArg;

  // ── 1. Platform gate ───────────────────────────────────────
  if (platform() !== "darwin") {
    bail(
      2,
      "this script only supports macOS. For Linux, use the manual flow:\n" +
        "  lsblk; sudo dd if=<iso> of=/dev/<device> bs=4M status=progress conv=fsync",
    );
  }

  // ── 2. ISO gate ────────────────────────────────────────────
  if (!existsSync(isoPath)) bail(2, `ISO file does not exist: ${isoPath}`);
  if (!isoPath.endsWith(".iso")) bail(2, `expected *.iso file, got: ${isoPath}`);
  const isoStat = statSync(isoPath);
  if (!isoStat.isFile()) bail(2, `ISO path is not a file: ${isoPath}`);
  if (isoStat.size < MIN_ISO_BYTES || isoStat.size > MAX_ISO_BYTES) {
    bail(
      2,
      `ISO size ${human(isoStat.size)} outside sane range ` +
        `[${human(MIN_ISO_BYTES)}, ${human(MAX_ISO_BYTES)}]; refusing`,
    );
  }
  process.stdout.write(`ISO: ${isoPath} (${human(isoStat.size)})\n`);

  // ── 3. Enumerate USB devices ───────────────────────────────
  const list = diskutilListPlist() as {
    AllDisksAndPartitions: { DeviceIdentifier: string }[];
  };
  const externalDevices = list.AllDisksAndPartitions.map(
    (d) => `/dev/${d.DeviceIdentifier}`,
  );

  const usbCandidates: { device: string; info: Record<string, unknown> }[] = [];
  for (const device of externalDevices) {
    assertSafeDevicePath(device);
    const info = diskutilInfo(device);
    const proto = String(info.BusProtocol ?? "");
    const internal = info.Internal === true;
    if ((proto === "USB" || proto === "USB-C") && !internal) {
      usbCandidates.push({ device, info });
    }
  }

  if (usbCandidates.length === 0) {
    bail(
      2,
      "no USB devices found.\n" +
        "Plug in the USB stick, then re-run. If you already plugged it in,\n" +
        "give the OS a few seconds and try again.",
    );
  }
  if (usbCandidates.length > 1) {
    process.stderr.write("flash-usb: multiple USB devices found:\n");
    for (const c of usbCandidates) {
      const size = Number(c.info.TotalSize ?? 0);
      const model = String(c.info.MediaName ?? "?");
      process.stderr.write(`  ${c.device}  ${human(size)}  ${model}\n`);
    }
    bail(
      2,
      "refusing to pick one. Unplug all but the target USB and re-run, OR\n" +
        "use manual flow: sudo dd if=<iso> of=/dev/rdiskN bs=4m",
    );
  }

  const candidate = usbCandidates[0];
  if (candidate === undefined) bail(2, "internal: no USB candidate after length check");
  const { device, info } = candidate;
  assertSafeDevicePath(device);
  const size = Number(info.TotalSize ?? 0);
  const model = String(info.MediaName ?? info.IORegistryEntryName ?? "?");
  const removable =
    info.RemovableMedia === true || info.RemovableMediaOrExternalDevice === true;

  // ── 4. Per-device safety gates ─────────────────────────────
  if (size < MIN_USB_BYTES || size > MAX_USB_BYTES) {
    bail(
      2,
      `device ${device} size ${human(size)} outside USB range ` +
        `[${human(MIN_USB_BYTES)}, ${human(MAX_USB_BYTES)}]; refusing\n` +
        `(this protects against pointing at an external SSD by mistake)`,
    );
  }

  const bootDisk = bootDiskIdentifier();
  const deviceShort = device.replace("/dev/", "");
  if (bootDisk && deviceShort === bootDisk) {
    bail(2, `device ${device} IS the boot disk; refusing to overwrite`);
  }

  // ── 5. Display + typed-path confirmation ───────────────────
  process.stdout.write("\n");
  process.stdout.write("USB device identified:\n");
  process.stdout.write(`  Device:    ${device}\n`);
  process.stdout.write(`  Model:     ${model}\n`);
  process.stdout.write(`  Size:      ${human(size)}\n`);
  process.stdout.write(`  Protocol:  ${info.BusProtocol}\n`);
  process.stdout.write(`  Removable: ${removable}\n`);
  process.stdout.write(`  Boot disk: ${bootDisk}  (target is not boot disk)\n`);
  process.stdout.write("\n");
  process.stdout.write(`*** ALL DATA ON ${device} WILL BE DESTROYED ***\n\n`);
  process.stdout.write(
    `To confirm, type the full device path exactly: ${device}\n`,
  );

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const typed = (await rl.question("> ")).trim();
  rl.close();

  if (typed !== device) {
    bail(
      1,
      `confirmation mismatch (got '${typed}', expected '${device}'). Aborted.`,
    );
  }

  // ── 6. Unmount → dd → eject ────────────────────────────────
  process.stdout.write(`\nUnmounting ${device} ...\n`);
  execFileSync("diskutil", ["unmountDisk", device], { stdio: "inherit" });

  // /dev/rdiskN is the raw character device — ~10x faster than
  // the buffered /dev/diskN on macOS.
  const rawDevice = `/dev/r${deviceShort}`;
  process.stdout.write(
    `\nFlashing ${isoPath} → ${rawDevice} ` +
      `(${human(isoStat.size)}; this takes a few minutes) ...\n\n`,
  );

  const dd = spawn(
    "sudo",
    [
      "dd",
      `if=${isoPath}`,
      `of=${rawDevice}`,
      "bs=4m",
      "conv=sync",
      "status=progress",
    ],
    { stdio: "inherit" },
  );

  const code: number = await new Promise((res) =>
    dd.on("close", (c) => res(c ?? 1)),
  );

  if (code !== 0) {
    bail(code, `dd exited ${code}; partial flash may be on device.`);
  }

  process.stdout.write(`\nEjecting ${device} ...\n`);
  try {
    execFileSync("diskutil", ["eject", device], { stdio: "inherit" });
  } catch {
    process.stdout.write(
      "(eject failed; that is fine — the flash succeeded. " +
        "Unplug + replug to verify.)\n",
    );
  }

  process.stdout.write("\nFlash complete.\n");
}

main().catch((err) => {
  bail(1, err instanceof Error ? err.message : String(err));
});
