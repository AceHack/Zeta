#!/usr/bin/env bun
/**
 * full-ai-cluster/tools/flash-usb-windows.ts
 *
 * Windows equivalent of flash-usb.ts (macOS): write the AI-cluster
 * installer ISO to a USB stick, with the SAME safety rails.
 *
 * Design — testable on any OS:
 *   - All the dangerous decision logic (device selection, safety rails,
 *     the confirm nonce, and the raw byte-copy) is pure TypeScript and
 *     exported, so flash-usb-windows.test.ts can verify it on macOS/Linux
 *     against realistic `Get-Disk` JSON fixtures + temp-file byte copies.
 *   - Only the genuinely Windows-specific operations (enumerate disks,
 *     take a disk offline, open \\.\PhysicalDriveN) go through an
 *     injectable CommandRunner / the node fs path, so they're swappable
 *     in tests.
 *
 * macOS ↔ Windows mapping:
 *   diskutil list -plist        ->  Get-Disk | ConvertTo-Json
 *   BusProtocol == "USB"        ->  BusType == "USB"
 *   info.Internal === true      ->  IsBoot / IsSystem
 *   diskutil unmountDisk        ->  Set-Disk -IsOffline $true
 *   sudo dd of=/dev/rdiskN      ->  raw write to \\.\PhysicalDriveN (admin)
 *   sudo (Touch ID / PAM)       ->  Administrator elevation (UAC / Windows Hello)
 *   diskutil eject              ->  Set-Disk -IsOffline $false
 *
 * Usage (run from an ELEVATED PowerShell/terminal):
 *   bun full-ai-cluster\tools\flash-usb-windows.ts [flags] [iso-path]
 *     --short      shorter `yes <4-hex>` challenge format
 *     --dry-run    print the plan (device + commands) and exit; NO write
 *     -h, --help
 *   iso-path defaults to the newest %USERPROFILE%\Downloads\zeta-installer-*.iso
 *
 * Exit codes: 0 success; 1 runtime failure; 2 usage / safety-rail refusal.
 */

import {
  closeSync,
  existsSync,
  fstatSync,
  openSync,
  readdirSync,
  readSync,
  statSync,
  writeSync,
  fsyncSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Safety-rail constants (mirror flash-usb.ts exactly) ──────────────
export const MIN_ISO_BYTES = 200 * 1024 * 1024;
export const MAX_ISO_BYTES = 8 * 1024 * 1024 * 1024;
export const MIN_USB_BYTES = 4 * 1024 * 1024 * 1024;
export const MAX_USB_BYTES = 256 * 1024 * 1024 * 1024;

export const ISO_GLOB_PREFIX = "zeta-installer-";

export function human(bytes: number): string {
  const u = ["B", "KiB", "MiB", "GiB", "TiB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(2)} ${u[i]}`;
}

// ── Pure logic ───────────────────────────────────────────────────────

export interface WinDisk {
  readonly number: number;
  readonly friendlyName: string;
  readonly serialNumber: string | null;
  readonly busType: string;
  readonly size: number;
  readonly isBoot: boolean;
  readonly isSystem: boolean;
  readonly isReadOnly: boolean;
  readonly operationalStatus: string;
  readonly partitionStyle: string;
}

/**
 * Parse `Get-Disk | Select ... | ConvertTo-Json` output. ConvertTo-Json
 * emits a bare object for one disk and an array for many — normalize both.
 */
export function parseGetDiskJson(jsonText: string): WinDisk[] {
  const raw = JSON.parse(jsonText);
  const arr: unknown[] = Array.isArray(raw) ? raw : [raw];
  return arr.map((d) => {
    const o = d as Record<string, unknown>;
    const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));
    const str = (v: unknown): string => (v == null ? "" : String(v));
    // PowerShell booleans survive JSON as true/false; OperationalStatus +
    // PartitionStyle sometimes serialize as { value, ... } objects.
    const flat = (v: unknown): string =>
      v != null && typeof v === "object" && "value" in (v as object)
        ? String((v as { value: unknown }).value)
        : str(v);
    return {
      number: num(o.Number),
      friendlyName: str(o.FriendlyName),
      serialNumber: o.SerialNumber == null ? null : str(o.SerialNumber),
      busType: flat(o.BusType),
      size: num(o.Size),
      isBoot: o.IsBoot === true,
      isSystem: o.IsSystem === true,
      isReadOnly: o.IsReadOnly === true,
      operationalStatus: flat(o.OperationalStatus),
      partitionStyle: flat(o.PartitionStyle),
    };
  });
}

export type Selection =
  | { readonly ok: true; readonly disk: WinDisk }
  | { readonly ok: false; readonly code: 1 | 2; readonly message: string };

/**
 * Apply the safety rails and pick exactly one USB target. Mirrors the
 * macOS rails: USB bus, NOT boot/system, size in [4 GiB, 256 GiB], and
 * exactly one candidate (refuse on 0 or >1 — the operator must isolate
 * the target by unplugging the others).
 */
export function selectUsbCandidate(disks: readonly WinDisk[]): Selection {
  const candidates = disks.filter(
    (d) =>
      d.busType.toUpperCase() === "USB" &&
      !d.isBoot &&
      !d.isSystem &&
      d.size >= MIN_USB_BYTES &&
      d.size <= MAX_USB_BYTES,
  );
  if (candidates.length === 0) {
    const seen = disks
      .map((d) => `  disk ${d.number} ${d.friendlyName} bus=${d.busType} ${human(d.size)} boot=${d.isBoot} system=${d.isSystem}`)
      .join("\n");
    return {
      ok: false,
      code: 2,
      message:
        `no eligible USB target found (need: BusType=USB, not boot/system disk, size in ` +
        `[${human(MIN_USB_BYTES)}, ${human(MAX_USB_BYTES)}]).\nDisks seen:\n${seen || "  (none)"}`,
    };
  }
  if (candidates.length > 1) {
    const list = candidates
      .map((d) => `  disk ${d.number} ${d.friendlyName} ${human(d.size)}`)
      .join("\n");
    return {
      ok: false,
      code: 2,
      message:
        `multiple USB candidates — refusing to pick one. Unplug all but the target USB and re-run:\n${list}`,
    };
  }
  return { ok: true, disk: candidates[0]! };
}

export type IsoCheck = { readonly ok: true } | { readonly ok: false; readonly message: string };

export function validateIso(isoPath: string, sizeBytes: number, isFile: boolean): IsoCheck {
  if (!isoPath.toLowerCase().endsWith(".iso")) return { ok: false, message: `expected a *.iso file, got: ${isoPath}` };
  if (!isFile) return { ok: false, message: `ISO path is not a file: ${isoPath}` };
  if (sizeBytes < MIN_ISO_BYTES || sizeBytes > MAX_ISO_BYTES) {
    return {
      ok: false,
      message: `ISO size ${human(sizeBytes)} outside sane range [${human(MIN_ISO_BYTES)}, ${human(MAX_ISO_BYTES)}]`,
    };
  }
  return { ok: true };
}

export function physicalDrivePath(diskNumber: number): string {
  if (!Number.isInteger(diskNumber) || diskNumber < 0) {
    throw new Error(`invalid physical drive number: ${diskNumber}`);
  }
  return `\\\\.\\PhysicalDrive${diskNumber}`;
}

/** 4-hex nonce (matches flash-usb.ts --short). Caller supplies randomness. */
export function buildShortChallenge(nonceHex4: string): string {
  if (!/^[0-9a-f]{4}$/.test(nonceHex4)) throw new Error(`nonce must be 4 lowercase hex chars, got: ${nonceHex4}`);
  return `yes ${nonceHex4}`;
}

export function makeNonce(rng: () => number = Math.random): string {
  return Math.floor(rng() * 0x10000)
    .toString(16)
    .padStart(4, "0");
}

// PowerShell command builders (pure → assert-able in tests).
export function psGetDiskScript(): string {
  return (
    "Get-Disk | Select-Object Number,FriendlyName,SerialNumber,BusType,Size," +
    "IsBoot,IsSystem,IsReadOnly,OperationalStatus,PartitionStyle | ConvertTo-Json -Depth 3"
  );
}
export function psIsAdminScript(): string {
  return (
    "[bool](([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent())" +
    ".IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))"
  );
}
export function psSetReadonlyScript(diskNumber: number, ro: boolean): string {
  return `Set-Disk -Number ${diskNumber} -IsReadOnly $${ro ? "true" : "false"}`;
}
export function psSetOfflineScript(diskNumber: number, offline: boolean): string {
  return `Set-Disk -Number ${diskNumber} -IsOffline $${offline ? "true" : "false"}`;
}
export function psListVolumesScript(diskNumber: number): string {
  return (
    `Get-Partition -DiskNumber ${diskNumber} -ErrorAction SilentlyContinue | ` +
    `Get-Volume -ErrorAction SilentlyContinue | ` +
    `Select-Object DriveLetter,FileSystemLabel,Size | ConvertTo-Json -Depth 3`
  );
}

// ── Raw byte copy (pure; the data-write path — fully testable) ───────

export interface CopyOpts {
  readonly isoPath: string;
  readonly destPath: string;
  readonly chunkSize?: number; // default 4 MiB
  readonly sectorSize?: number; // default 4096 (works for 512- and 4096-sector drives)
  readonly openFlag?: string; // default "r+" (physical drive / existing file)
  readonly onProgress?: (writtenBytes: number, totalBytes: number) => void;
}

/**
 * Copy an ISO image to a destination, padding the final write up to a
 * sector boundary with zeros (raw block devices require sector-aligned
 * writes — the equivalent of dd's `conv=sync`). Works on a real
 * \\.\PhysicalDriveN handle on Windows AND on a plain temp file (tests).
 * Returns the number of bytes written (>= ISO size, padded).
 */
export function copyImageToDevice(o: CopyOpts): { bytesWritten: number; isoBytes: number } {
  const chunk = o.chunkSize ?? 4 * 1024 * 1024;
  const sector = o.sectorSize ?? 4096;
  if (chunk % sector !== 0) throw new Error(`chunkSize ${chunk} must be a multiple of sectorSize ${sector}`);
  const src = openSync(o.isoPath, "r");
  const dst = openSync(o.destPath, o.openFlag ?? "r+");
  try {
    const total = fstatSync(src).size;
    const buf = Buffer.allocUnsafe(chunk);
    let written = 0;
    let srcPos = 0;
    while (srcPos < total) {
      const n = readSync(src, buf, 0, chunk, srcPos);
      if (n <= 0) break;
      let len = n;
      if (len % sector !== 0) {
        const padded = Math.ceil(len / sector) * sector;
        buf.fill(0, len, padded);
        len = padded;
      }
      // dest write offset tracks `written` (always sector-aligned).
      writeSync(dst, buf, 0, len, written);
      written += len;
      srcPos += n;
      o.onProgress?.(Math.min(srcPos, total), total);
    }
    fsyncSync(dst);
    return { bytesWritten: written, isoBytes: total };
  } finally {
    closeSync(src);
    closeSync(dst);
  }
}

// ── ISO auto-discovery (mirror zflash) ───────────────────────────────
export function autoDiscoverIso(downloadsDir: string): string | null {
  if (!existsSync(downloadsDir)) return null;
  const candidates = readdirSync(downloadsDir)
    .filter((f) => f.startsWith(ISO_GLOB_PREFIX) && f.toLowerCase().endsWith(".iso"))
    .map((f) => join(downloadsDir, f))
    .filter((p) => {
      try {
        return statSync(p).isFile();
      } catch {
        return false;
      }
    });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return candidates[0]!;
}

// ── Side-effecting layer (injectable for the orchestrator/tests) ─────
export interface CommandRunner {
  ps(script: string): string;
}

const realRunner: CommandRunner = {
  ps(script: string): string {
    // Prefer Windows PowerShell; fall back to pwsh (PowerShell Core).
    const bin = process.platform === "win32" ? "powershell" : "pwsh";
    return execFileSync(bin, ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  },
};

function bail(code: 1 | 2, msg: string): never {
  process.stderr.write(`flash-usb-windows: ${msg}\n`);
  process.exit(code);
}

async function main(runner: CommandRunner = realRunner): Promise<void> {
  const argv = process.argv.slice(2);
  const short = argv.includes("--short");
  const dryRun = argv.includes("--dry-run");
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(
      "usage: bun full-ai-cluster\\tools\\flash-usb-windows.ts [--short] [--dry-run] [iso-path]\n" +
        "  run from an ELEVATED (Administrator) terminal\n",
    );
    process.exit(0);
  }
  const positional = argv.filter((a) => !a.startsWith("-"));
  if (positional.length > 1) bail(2, `at most one ISO path expected, got ${positional.length}`);

  if (process.platform !== "win32") {
    bail(2, "this tool only runs on Windows. On macOS use flash-usb.ts / zflash.ts.");
  }

  // Elevation gate — the Windows equivalent of sudo + Touch ID.
  const admin = runner.ps(psIsAdminScript()).trim().toLowerCase().startsWith("true");
  if (!admin && !dryRun) {
    bail(
      2,
      "not elevated. Re-run from an Administrator PowerShell (right-click → " +
        "Run as administrator), OR press Win, type 'PowerShell', and Ctrl+Shift+Enter.",
    );
  }

  // Resolve + validate ISO.
  const isoPath = positional[0] ?? autoDiscoverIso(join(homedir(), "Downloads"));
  if (!isoPath) bail(2, `no zeta-installer-*.iso under %USERPROFILE%\\Downloads; pass an ISO path explicitly`);
  if (!existsSync(isoPath)) bail(2, `ISO file does not exist: ${isoPath}`);
  const st = statSync(isoPath);
  const iso = validateIso(isoPath, st.size, st.isFile());
  if (!iso.ok) bail(2, iso.message);
  process.stdout.write(`ISO: ${isoPath} (${human(st.size)})\n`);

  // Enumerate + select.
  const disks = parseGetDiskJson(runner.ps(psGetDiskScript()));
  const sel = selectUsbCandidate(disks);
  if (!sel.ok) bail(sel.code, sel.message);
  const disk = sel.disk;
  const drivePath = physicalDrivePath(disk.number);

  process.stdout.write(
    `\nUSB device identified:\n` +
      `  Disk number: ${disk.number}  (${drivePath})\n` +
      `  Model:       ${disk.friendlyName}\n` +
      `  Serial:      ${disk.serialNumber ?? "?"}\n` +
      `  Size:        ${human(disk.size)}\n` +
      `  Bus:         ${disk.busType}\n` +
      `  Boot disk:   ${disk.isBoot} | System disk: ${disk.isSystem}\n`,
  );
  try {
    const vols = runner.ps(psListVolumesScript(disk.number)).trim();
    if (vols) process.stdout.write(`\nCurrent volumes on disk ${disk.number} (will be DESTROYED):\n${vols}\n`);
  } catch {
    /* volume listing is best-effort */
  }
  process.stdout.write(`\n*** ALL DATA ON disk ${disk.number} (${drivePath}) WILL BE DESTROYED ***\n`);

  const nonce = makeNonce();
  const phrase = short ? buildShortChallenge(nonce) : `accept-destroy ${disk.number} ${nonce}${nonce}`;

  if (dryRun) {
    process.stdout.write(
      `\n[dry-run] would prompt for: ${phrase}\n` +
        `[dry-run] would run:\n` +
        `  ${psSetReadonlyScript(disk.number, false)}\n` +
        `  ${psSetOfflineScript(disk.number, true)}\n` +
        `  <raw copy ${isoPath} -> ${drivePath}, sector-padded>\n` +
        `  ${psSetOfflineScript(disk.number, false)}\n` +
        `[dry-run] no changes made.\n`,
    );
    process.exit(0);
  }

  process.stdout.write(`\nTo proceed, type EXACTLY (case-sensitive):\n\n  ${phrase}\n\n> `);
  const typed = (await readLine()).trim();
  if (typed !== phrase) bail(2, `confirmation mismatch — aborting (no write performed).`);

  // Prepare the disk: clear read-only, take offline (dismounts volumes).
  runner.ps(psSetReadonlyScript(disk.number, false));
  runner.ps(psSetOfflineScript(disk.number, true));

  process.stdout.write(`\nFlashing ${isoPath} -> ${drivePath} (this takes a few minutes) ...\n`);
  let lastPct = -1;
  const res = copyImageToDevice({
    isoPath,
    destPath: drivePath,
    onProgress: (w, t) => {
      const pct = Math.floor((w / t) * 100);
      if (pct !== lastPct) {
        process.stdout.write(`\r  ${pct}%  (${human(w)} / ${human(t)})   `);
        lastPct = pct;
      }
    },
  });
  process.stdout.write(`\n\nWrote ${human(res.bytesWritten)} (ISO ${human(res.isoBytes)}). Flash complete.\n`);

  // Bring the disk back online so Windows re-reads the new partition table.
  try {
    runner.ps(psSetOfflineScript(disk.number, false));
  } catch {
    /* eject is best-effort; the flash already succeeded */
  }
  process.stdout.write(`Disk ${disk.number} back online; safe to remove the USB.\n`);
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", (d) => {
      process.stdin.pause();
      resolve(d.toString());
    });
  });
}

// Only run main() when executed directly (so tests can import the pure fns).
if (import.meta.main) {
  main().catch((e) => bail(1, e instanceof Error ? e.message : String(e)));
}
