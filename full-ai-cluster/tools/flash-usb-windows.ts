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
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
  fsyncSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

// ── Safety-rail constants — shared with every arm, not mirrored ──────
import { MAX_ISO_BYTES, MAX_USB_BYTES, MIN_ISO_BYTES, MIN_USB_BYTES } from "../../src/Core.TypeScript/zflash/size-bounds.ts";
export { MAX_ISO_BYTES, MAX_USB_BYTES, MIN_ISO_BYTES, MIN_USB_BYTES };

export const ISO_GLOB_PREFIX = "zeta-installer-";

// ── SSH-pubkey injection constants (mirror zflash.ts iter-4.2) ───────
// zeta-install.sh reads this exact filename off the boot media's ESP and
// injects it into operator-ssh-keys.nix before `nixos-install`. The name
// MUST match the on-node installer (do not rename without updating it).
export const ESP_PUBKEY_FILENAME = "zeta-authorized-keys.pub";

// GPT EFI System Partition type GUID (RFC-style, lowercased, no braces).
export const ESP_GPT_TYPE_GUID = "c12a7328-f81f-11d2-ba4b-00a0c93ec93b";
// MBR partition type 0xEF == EFI System Partition (239 decimal).
export const ESP_MBR_TYPE = 0xef;

// Default key search order — mirrors zflash's DEFAULT_SSH_KEY plus the
// usual fallbacks. First that exists AND validates wins.
export const DEFAULT_SSH_KEY_CANDIDATES = [
  ".ssh/id_ed25519.pub",
  ".ssh/id_ecdsa.pub",
  ".ssh/id_rsa.pub",
] as const;

// Recognized OpenSSH public-key type tokens (first field of the line).
export const SSH_PUBKEY_TYPES: readonly string[] = [
  "ssh-ed25519",
  "ssh-rsa",
  "ssh-dss",
  "ecdsa-sha2-nistp256",
  "ecdsa-sha2-nistp384",
  "ecdsa-sha2-nistp521",
  "sk-ssh-ed25519@openssh.com",
  "sk-ecdsa-sha2-nistp256@openssh.com",
];

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

// ── SSH pubkey: validation, resolution, on-disk file body (pure) ──────

export type PubkeyCheck = { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Accept ONLY a single-line OpenSSH PUBLIC key. Hard-reject anything that
 * looks like a PRIVATE key — the #1 footgun is injecting `id_ed25519`
 * (the private half) instead of `id_ed25519.pub`. Trailing comment is OK.
 */
export function validatePubkeyContent(text: string): PubkeyCheck {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) return { ok: false, message: "SSH key file is empty" };
  if (/-----BEGIN[\s\S]*PRIVATE KEY-----/.test(normalized) || /\bPRIVATE KEY\b/.test(normalized)) {
    return { ok: false, message: "refusing to inject a PRIVATE key — pass the .pub (public) key instead" };
  }
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length !== 1) {
    return { ok: false, message: `expected exactly one public-key line, found ${lines.length}` };
  }
  const fields = lines[0]!.trim().split(/\s+/);
  if (fields.length < 2) return { ok: false, message: "malformed public key (need '<type> <base64> [comment]')" };
  const type = fields[0]!;
  if (!SSH_PUBKEY_TYPES.includes(type)) {
    return { ok: false, message: `unrecognized key type '${type}' (expected one of: ${SSH_PUBKEY_TYPES.join(", ")})` };
  }
  if (!/^[A-Za-z0-9+/]+={0,3}$/.test(fields[1]!)) {
    return { ok: false, message: "public-key blob is not valid base64" };
  }
  return { ok: true };
}

/** Normalize the file body written to the ESP: LF endings, single trailing newline. */
export function pubkeyFileContent(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\n+$/, "") + "\n";
}

export interface PubkeyFsLike {
  exists(path: string): boolean;
  read(path: string): string;
}

export type PubkeyResolution =
  | { readonly ok: true; readonly path: string; readonly content: string }
  | { readonly ok: false; readonly message: string };

/**
 * Resolve the operator's SSH PUBLIC key. `explicitPath` (from --ssh-key)
 * wins; otherwise probe DEFAULT_SSH_KEY_CANDIDATES under `home` in order.
 * Always validates — an existing-but-malformed (or private) key is an error,
 * not a silent skip.
 */
export function resolveSshPubkey(
  explicitPath: string | undefined,
  home: string,
  fs: PubkeyFsLike,
): PubkeyResolution {
  if (explicitPath) {
    if (!fs.exists(explicitPath)) return { ok: false, message: `--ssh-key not found: ${explicitPath}` };
    const content = fs.read(explicitPath);
    const v = validatePubkeyContent(content);
    if (!v.ok) return { ok: false, message: `${explicitPath}: ${v.message}` };
    return { ok: true, path: explicitPath, content: content.replace(/\r\n/g, "\n").trim() };
  }
  const tried: string[] = [];
  for (const rel of DEFAULT_SSH_KEY_CANDIDATES) {
    const p = join(home, rel);
    tried.push(p);
    if (!fs.exists(p)) continue;
    const content = fs.read(p);
    const v = validatePubkeyContent(content);
    if (!v.ok) return { ok: false, message: `${p}: ${v.message}` };
    return { ok: true, path: p, content: content.replace(/\r\n/g, "\n").trim() };
  }
  return {
    ok: false,
    message:
      `no SSH public key found (looked for: ${tried.join(", ")}).\n` +
      `  Create one with:  ssh-keygen -t ed25519\n` +
      `  Or pass an explicit key:  --ssh-key C:\\path\\to\\key.pub\n` +
      `  Or skip key injection (password login only):  --no-inject`,
  };
}

// ── ESP partition discovery + drive-letter selection (pure) ──────────

export interface WinPartition {
  readonly number: number;
  readonly size: number;
  readonly type: string; // Get-Partition .Type (e.g. "System", "FAT32", "IFS", "Basic")
  readonly gptType: string; // GPT type GUID (lowercased, braces stripped) or ""
  readonly mbrType: number | null; // MBR partition type byte, or null on GPT disks
  readonly driveLetter: string; // "" when unmounted
  readonly isHidden: boolean;
}

export function parseGetPartitionJson(jsonText: string): WinPartition[] {
  const t = jsonText.trim();
  if (t.length === 0) return [];
  const raw = JSON.parse(t);
  const arr: unknown[] = Array.isArray(raw) ? raw : [raw];
  return arr.map((d) => {
    const o = d as Record<string, unknown>;
    const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));
    const flat = (v: unknown): string =>
      v != null && typeof v === "object" && "value" in (v as object)
        ? String((v as { value: unknown }).value)
        : v == null
          ? ""
          : String(v);
    // DriveLetter serializes as a single char, 0, null, or "" when unset.
    const dl = o.DriveLetter;
    const driveLetter =
      dl == null || dl === 0 || dl === "0" || dl === "\u0000" ? "" : String(dl).trim().replace(/[:\\]/g, "");
    const gpt = flat(o.GptType).toLowerCase().replace(/[{}]/g, "");
    const mbrRaw = o.MbrType;
    return {
      number: num(o.PartitionNumber),
      size: num(o.Size),
      type: flat(o.Type),
      gptType: gpt,
      mbrType: mbrRaw == null ? null : num(mbrRaw),
      driveLetter: /^[A-Za-z]$/.test(driveLetter) ? driveLetter.toUpperCase() : "",
      isHidden: o.IsHidden === true,
    };
  });
}

/** True if the partition is (or looks like) the FAT EFI System Partition. */
export function isEspLike(p: WinPartition): boolean {
  if (p.gptType === ESP_GPT_TYPE_GUID) return true;
  if (p.mbrType === ESP_MBR_TYPE) return true;
  const t = p.type.toLowerCase();
  return t === "system" || t.includes("efi") || t.startsWith("fat");
}

export type EspSelection =
  | { readonly ok: true; readonly partition: WinPartition }
  | { readonly ok: false; readonly message: string };

/**
 * Pick the ESP on the freshly-flashed isohybrid USB. The disk has a big
 * ISO9660 data region (~1.5 GiB) and a tiny FAT ESP (a few MiB → a couple
 * hundred MiB). Prefer an explicit EFI signal (GPT GUID / MBR 0xEF / type);
 * fall back to "smallest partition under 512 MiB". Among ties, smallest wins.
 */
export function selectEspPartition(parts: readonly WinPartition[]): EspSelection {
  const bySizeAsc = (a: WinPartition, b: WinPartition) => a.size - b.size;
  const explicit = parts.filter(isEspLike).slice().sort(bySizeAsc);
  if (explicit.length > 0) return { ok: true, partition: explicit[0]! };
  const small = parts
    .filter((p) => p.size > 0 && p.size < 512 * 1024 * 1024)
    .slice()
    .sort(bySizeAsc);
  if (small.length > 0) return { ok: true, partition: small[0]! };
  const seen = parts.map((p) => `  part ${p.number} ${human(p.size)} type=${p.type} mbr=${p.mbrType ?? "-"}`).join("\n");
  return {
    ok: false,
    message: `could not identify the EFI System Partition on this disk.\nPartitions seen:\n${seen || "  (none)"}`,
  };
}

/** First free drive letter in S..Z not already in use. Throws if none free. */
export function firstFreeDriveLetter(used: readonly string[]): string {
  const taken = new Set(used.map((l) => l.toUpperCase().replace(/[:\\]/g, "")));
  for (const c of "STUVWXYZ") {
    if (!taken.has(c)) return c;
  }
  throw new Error("no free drive letter in S..Z to mount the ESP");
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

// ── ESP-mount script builders (pure → assert-able in tests) ──────────
export function psGetPartitionScript(diskNumber: number): string {
  return (
    `Get-Partition -DiskNumber ${diskNumber} -ErrorAction SilentlyContinue | ` +
    `Select-Object PartitionNumber,Size,Type,GptType,MbrType,DriveLetter,IsHidden | ` +
    `ConvertTo-Json -Depth 3`
  );
}
export function psUsedDriveLettersScript(): string {
  return `(Get-Volume | Where-Object DriveLetter | Select-Object -ExpandProperty DriveLetter) -join ''`;
}
export function psAddAccessPathAssignScript(diskNumber: number, partitionNumber: number): string {
  return `Add-PartitionAccessPath -DiskNumber ${diskNumber} -PartitionNumber ${partitionNumber} -AssignDriveLetter`;
}
export function psRemoveAccessPathScript(diskNumber: number, partitionNumber: number, letter: string): string {
  return `Remove-PartitionAccessPath -DiskNumber ${diskNumber} -PartitionNumber ${partitionNumber} -AccessPath "${letter}:\\"`;
}
/**
 * diskpart script that assigns a drive letter to an ESP/System partition.
 * diskpart succeeds here where the Storage cmdlets refuse on `System`-type
 * partitions — it is the reliable mount path for a USB EFI partition.
 */
export function diskpartAssignScript(diskNumber: number, partitionNumber: number, letter: string): string {
  return [
    `select disk ${diskNumber}`,
    `select partition ${partitionNumber}`,
    `assign letter=${letter}`,
  ].join("\r\n");
}
export function diskpartRemoveLetterScript(diskNumber: number, partitionNumber: number, letter: string): string {
  return [
    `select disk ${diskNumber}`,
    `select partition ${partitionNumber}`,
    `remove letter=${letter}`,
  ].join("\r\n");
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
  /** Run a diskpart script (reliable ESP-letter assignment). */
  diskpart(script: string): string;
  /** Write a text file (LF body) to a mounted ESP path like "S:\zeta-authorized-keys.pub". */
  writeFile(path: string, content: string): void;
  /** Read a text file back (for the read-back-verify step). */
  readFile(path: string): string;
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
  diskpart(script: string): string {
    // diskpart reads its commands from a script file (`/s`). Use a temp dir + file
    // (mkdtemp — CodeQL insecure-temporary-file; 081KRFA460008QG0R0022THSDJ pattern).
    const dir = mkdtempSync(join(tmpdir(), "zeta-diskpart-"));
    const tmp = join(dir, "script.txt");
    writeFileSync(tmp, script.endsWith("\r\n") ? script : script + "\r\n", "ascii");
    try {
      return execFileSync("diskpart", ["/s", tmp], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    } finally {
      try {
        unlinkSync(tmp);
        rmSync(dir, { recursive: true });
      } catch {
        /* best-effort cleanup */
      }
    }
  },
  writeFile(path: string, content: string): void {
    writeFileSync(path, content, "utf8");
  },
  readFile(path: string): string {
    return readFileSync(path, "utf8");
  },
};

export interface EspInjectResult {
  readonly ok: boolean;
  readonly partitionNumber: number;
  readonly driveLetter: string;
  readonly assignedLetter: boolean; // true if we mounted it (so caller un-mounts)
  readonly verified: boolean;
  readonly message: string;
}

/**
 * Mount the freshly-flashed USB's EFI System Partition, write the operator's
 * pubkey as `zeta-authorized-keys.pub`, READ IT BACK to prove the write
 * landed, then unmount. Mirrors zflash.ts iter-4.2 (macOS mount_msdos path).
 *
 * Fail-loud by contract: returns ok=false on any failure. The caller treats
 * a false result as a hard error (the macOS path's "silent inject failure →
 * keyless USB" lesson — never green-by-skip).
 *
 * Mount-letter ladder (most-reliable first):
 *   1. partition already has a DriveLetter (removable FAT auto-mount)
 *   2. diskpart `assign letter=` (works on System/ESP partitions)
 *   3. Add-PartitionAccessPath -AssignDriveLetter (last resort)
 */
export function injectPubkeyIntoEsp(
  runner: CommandRunner,
  diskNumber: number,
  pubkeyContent: string,
  log: (s: string) => void = () => {},
): EspInjectResult {
  const fail = (message: string, partitionNumber = -1, driveLetter = "", assignedLetter = false): EspInjectResult => ({
    ok: false,
    partitionNumber,
    driveLetter,
    assignedLetter,
    verified: false,
    message,
  });

  const parts = parseGetPartitionJson(runner.ps(psGetPartitionScript(diskNumber)));
  const sel = selectEspPartition(parts);
  if (!sel.ok) return fail(sel.message);
  const esp = sel.partition;
  log(`inject: ESP is partition ${esp.number} (${human(esp.size)}, type=${esp.type})`);

  let letter = esp.driveLetter;
  let assignedLetter = false;

  if (!letter) {
    // Rung 2: diskpart assign (reliable for ESP).
    try {
      const used = runner.ps(psUsedDriveLettersScript()).trim();
      const usedArr = used.split("").filter((c) => /[A-Za-z]/.test(c));
      const cand = firstFreeDriveLetter(usedArr);
      runner.diskpart(diskpartAssignScript(diskNumber, esp.number, cand));
      // Re-query to confirm the letter actually attached.
      const after = parseGetPartitionJson(runner.ps(psGetPartitionScript(diskNumber)));
      const got = after.find((p) => p.number === esp.number)?.driveLetter;
      letter = got || cand;
      assignedLetter = true;
      log(`inject: mounted ESP at ${letter}: via diskpart`);
    } catch (e) {
      log(`inject: diskpart assign failed (${e instanceof Error ? e.message : String(e)}); trying Add-PartitionAccessPath`);
    }
  }

  if (!letter) {
    // Rung 3: Storage cmdlet.
    try {
      runner.ps(psAddAccessPathAssignScript(diskNumber, esp.number));
      const after = parseGetPartitionJson(runner.ps(psGetPartitionScript(diskNumber)));
      letter = after.find((p) => p.number === esp.number)?.driveLetter ?? "";
      assignedLetter = letter.length > 0;
      if (letter) log(`inject: mounted ESP at ${letter}: via Add-PartitionAccessPath`);
    } catch (e) {
      log(`inject: Add-PartitionAccessPath failed (${e instanceof Error ? e.message : String(e)})`);
    }
  }

  if (!letter) {
    return fail(
      `could not mount the ESP (no drive letter could be assigned). The USB is bootable but has NO operator key.\n` +
        `  Manually mount the small FAT partition on disk ${diskNumber} and copy your .pub key to it as\n` +
        `  ${ESP_PUBKEY_FILENAME}, or re-run after closing anything holding the disk.`,
      esp.number,
    );
  }

  const dest = `${letter}:\\${ESP_PUBKEY_FILENAME}`;
  const body = pubkeyFileContent(pubkeyContent);
  try {
    runner.writeFile(dest, body);
  } catch (e) {
    return fail(`writing ${dest} failed: ${e instanceof Error ? e.message : String(e)}`, esp.number, letter, assignedLetter);
  }

  // Read-back verify — prove the key actually landed (assert, don't skip).
  let verified = false;
  try {
    verified = runner.readFile(dest).replace(/\r\n/g, "\n").trim() === pubkeyContent.replace(/\r\n/g, "\n").trim();
  } catch (e) {
    return fail(`read-back of ${dest} failed: ${e instanceof Error ? e.message : String(e)}`, esp.number, letter, assignedLetter);
  }

  // Unmount the access path we added (best-effort; the bytes are already
  // flushed by the read-back). Skip if the letter was auto-mounted.
  if (assignedLetter) {
    try {
      runner.diskpart(diskpartRemoveLetterScript(diskNumber, esp.number, letter));
    } catch {
      try {
        runner.ps(psRemoveAccessPathScript(diskNumber, esp.number, letter));
      } catch {
        /* leaving the letter mapped is harmless; the write is done */
      }
    }
  }

  return {
    ok: verified,
    partitionNumber: esp.number,
    driveLetter: letter,
    assignedLetter,
    verified,
    message: verified
      ? `pubkey written to ${dest} and verified`
      : `WROTE ${dest} but read-back did NOT match — DO NOT trust this USB's key; re-flash`,
  };
}

function bail(code: 1 | 2, msg: string): never {
  process.stderr.write(`flash-usb-windows: ${msg}\n`);
  process.exit(code);
}

async function main(runner: CommandRunner = realRunner): Promise<void> {
  const argv = process.argv.slice(2);
  const short = argv.includes("--short");
  const dryRun = argv.includes("--dry-run");
  const noInject = argv.includes("--no-inject");
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(
      "usage: bun full-ai-cluster\\tools\\flash-usb-windows.ts [flags] [iso-path]\n" +
        "  run from an ELEVATED (Administrator) terminal\n" +
        "    --short            shorter `yes <4-hex>` confirm phrase\n" +
        "    --dry-run          print the plan and exit; NO write\n" +
        "    --ssh-key <path>   public key to inject (default: ~/.ssh/id_ed25519.pub)\n" +
        "    --no-inject        skip SSH-key injection (password login only)\n",
    );
    process.exit(0);
  }
  // --ssh-key takes a value; pull it out before computing positionals.
  let sshKeyPath: string | undefined;
  const skIdx = argv.indexOf("--ssh-key");
  if (skIdx !== -1) {
    sshKeyPath = argv[skIdx + 1];
    if (!sshKeyPath || sshKeyPath.startsWith("-")) bail(2, "--ssh-key requires a path argument");
  }
  const positional = argv.filter((a, i) => !a.startsWith("-") && !(skIdx !== -1 && i === skIdx + 1));
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

  // Resolve the operator SSH pubkey NOW — BEFORE the destructive write — so a
  // missing/malformed key fails before the USB is wiped (not after).
  const realFs: PubkeyFsLike = { exists: existsSync, read: (p) => readFileSync(p, "utf8") };
  let pubkey: { path: string; content: string } | null = null;
  if (!noInject) {
    const r = resolveSshPubkey(sshKeyPath, homedir(), realFs);
    if (!r.ok) bail(2, `SSH key injection required (default). ${r.message}`);
    pubkey = { path: r.path, content: r.content };
    process.stdout.write(`SSH key to inject: ${pubkey.path}\n`);
  } else {
    process.stdout.write(`SSH key injection: DISABLED (--no-inject; password login only)\n`);
  }

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
        (pubkey
          ? `  <mount ESP, write ${ESP_PUBKEY_FILENAME} = ${pubkey.path}, read-back verify, unmount>\n`
          : `  <SSH-key injection skipped (--no-inject)>\n`) +
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

  // Bring the disk back online so Windows enumerates the new partition table
  // (required before we can mount the ESP to inject the key).
  try {
    runner.ps(psSetOfflineScript(disk.number, false));
  } catch {
    /* eject is best-effort; the flash already succeeded */
  }

  // SSH-key injection (fail-loud — mirrors zflash.ts iter-4.2). A keyless
  // USB is the silent-failure trap the macOS path was burned by, so a failed
  // inject is a HARD error: the flash succeeded but the result is unusable for
  // zero-typing first boot.
  if (pubkey) {
    process.stdout.write(`\nInjecting ${pubkey.path} into the USB ESP as ${ESP_PUBKEY_FILENAME} ...\n`);
    const inj = injectPubkeyIntoEsp(runner, disk.number, pubkey.content, (s) => process.stdout.write(`  ${s}\n`));
    if (!inj.ok) {
      bail(
        1,
        `SSH-KEY INJECTION FAILED — ${inj.message}\n` +
          `  The ISO is flashed but the operator key is NOT on the USB. First boot would be\n` +
          `  password-only. Fix the cause and re-run, or re-run with --no-inject to accept that.`,
      );
    }
    process.stdout.write(`  ${inj.message}\n`);
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
