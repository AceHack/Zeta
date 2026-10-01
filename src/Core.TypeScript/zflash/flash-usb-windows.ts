#!/usr/bin/env bun
/**
 * src/Core.TypeScript/zflash/flash-usb-windows.ts
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
 *     clear a disk, open \\.\PhysicalDriveN) go through an injectable
 *     CommandRunner / the node fs path, so they're swappable in tests.
 *
 * macOS ↔ Windows mapping:
 *   diskutil list -plist        ->  Get-Disk | ConvertTo-Json
 *   BusProtocol == "USB"        ->  BusType == "USB"
 *   info.Internal === true      ->  IsBoot / IsSystem
 *   diskutil unmountDisk        ->  Set-Disk -IsReadOnly $false; Clear-Disk -RemoveData -RemoveOEM
 *   sudo dd of=/dev/rdiskN      ->  raw write to \\.\PhysicalDriveN (admin), partition table LAST
 *   sudo (Touch ID / PAM)       ->  Administrator elevation (UAC / Windows Hello)
 *
 * REMOVABLE MEDIA. This tool used to run `Set-Disk -IsOffline $true` before the
 * write. Windows rejects that for every removable stick ("Removable media cannot
 * be set to offline", reproduced 2026-09-27 on a PNY USB 3.2.1 FD), so it could
 * not flash a USB stick at all. #6981 had handled removable media; the #8076
 * refactor dropped that path. The path now, for every target:
 *   1. stage a COPY of the ISO, hashed while copying — it must equal the sha256
 *      the integrity gate established, so the bytes baked and written are the
 *      bytes that were verified;
 *   2. bake the ESP payloads (operator pubkey, hostname, firstboot conf, repo
 *      pin — the list the shared planner in lib.ts builds for every arm) into
 *      the copy's FAT ESP in pure TypeScript (esp-fat-writer.ts), read back and
 *      compared — never into the device after the write, where Windows
 *      auto-mounts the isohybrid ESP read-only;
 *   3. Set-Disk -IsReadOnly $false; Clear-Disk -RemoveData -RemoveOEM (no
 *      offline, and no `mountvol /N`, which would disable automount system-wide);
 *   4. raw-write everything past the first 1 MiB, then the first 1 MiB (the
 *      partition table) LAST, so Windows has nothing to auto-mount mid-write;
 *   5. read back exactly the written range and compare its sha256 with the image.
 *
 * Usage (run from an ELEVATED PowerShell/terminal):
 *   bun src/Core.TypeScript/zflash/flash-usb-windows.ts [flags] [iso-path]
 *     --short      shorter `yes <4-hex>` challenge format
 *     --dry-run    print the plan (device + commands + ESP payloads) and exit; NO write
 *     --ssh-key <path> | --no-inject
 *     --host <name>  --role <r> [--flake-host <h>] [--join-server-url <u>] [--join-token <path>]
 *     --acme-email <addr> --public-domain <domain>   --repo-pin <40-hex>
 *     --lb-pool <auto|first-ip-last-ip>   Cilium LoadBalancer range (checked against the LAN at install)
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
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";

import { establishIsoIntegrity, realIsoIntegrityIo } from "./iso-integrity.ts";
import { bakeEspFiles, fdBlockIo, locateIsohybridEsp, type EspFile } from "./esp-fat-writer.ts";
import { planFileBackedZflashImage, type FileBackedEspWrite } from "./lib.ts";
import { firstbootRoleFromFlags } from "./firstboot-role.ts";
import { railFindingsForEspWrites } from "./injection-rail.ts";
import { planPublicEndpoint } from "../installer/public-endpoint.ts";
import { planLbPool } from "../installer/lan-config.ts";
import { readFileBounded } from "../io/safe-io.ts";

// ── Safety-rail constants — shared with every arm, not mirrored ──────
import { MAX_ISO_BYTES, MAX_USB_BYTES, MIN_ISO_BYTES, MIN_USB_BYTES } from "./size-bounds.ts";
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
export function psClearDiskScript(diskNumber: number): string {
  return `Clear-Disk -Number ${diskNumber} -RemoveData -RemoveOEM -Confirm:$false -ErrorAction Stop`;
}

/**
 * Everything run against the disk BEFORE the raw write, in order.
 *
 * Deliberately NO `Set-Disk -IsOffline $true`: Windows refuses it for removable
 * media ("Removable media cannot be set to offline"), which made this tool unable
 * to flash any USB stick. Clear-Disk removes every partition, so there is no
 * volume left to hold a lock on the sectors being written; with the partition
 * table written LAST (see copyImageToDevice) there is nothing to auto-mount until
 * the image is complete. Also NO `mountvol /N` — it disables automount for the
 * whole machine and persists after the tool exits.
 */
export function diskPreparationScripts(diskNumber: number): readonly string[] {
  return [psSetReadonlyScript(diskNumber, false), psClearDiskScript(diskNumber)];
}

/** Run {@link diskPreparationScripts} in order; the first failure throws (fail loud, before any byte is written). */
export function prepareDiskForRawWrite(runner: Pick<CommandRunner, "ps">, diskNumber: number, log: (s: string) => void = () => {}): void {
  for (const script of diskPreparationScripts(diskNumber)) {
    log(`  ${script}`);
    runner.ps(script);
  }
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

/** The region written LAST: the MBR/GPT partition table and everything near it. */
export const PARTITION_TABLE_BYTES = 1024 * 1024;

export interface CopyOpts {
  readonly isoPath: string;
  readonly destPath: string;
  readonly chunkSize?: number; // default 4 MiB
  readonly sectorSize?: number; // default 4096 (works for 512- and 4096-sector drives)
  readonly openFlag?: string; // default "r+" (physical drive / existing file)
  /**
   * Bytes at the start of the image written AFTER everything else (default
   * PARTITION_TABLE_BYTES). Until they land, a cleared disk has no partition
   * table, so Windows has nothing to auto-mount — and cannot lock or mount
   * the ESP half-way through the write. Must be a multiple of sectorSize.
   */
  readonly headLastBytes?: number;
  readonly onProgress?: (writtenBytes: number, totalBytes: number) => void;
  /** Called after each positional write, in write order (tests assert the ordering). */
  readonly onWrite?: (position: number, length: number) => void;
}

/**
 * Copy an image to a destination, padding the final write up to a sector
 * boundary with zeros (raw block devices require sector-aligned writes — the
 * equivalent of dd's `conv=sync`). Writes the tail (everything past
 * `headLastBytes`) first and the head LAST. Works on a real
 * \\.\PhysicalDriveN handle on Windows AND on a plain temp file (tests).
 * Returns the number of bytes written (>= image size, padded).
 */
export function copyImageToDevice(o: CopyOpts): { bytesWritten: number; isoBytes: number } {
  const chunk = o.chunkSize ?? 4 * 1024 * 1024;
  const sector = o.sectorSize ?? 4096;
  const headLast = o.headLastBytes ?? PARTITION_TABLE_BYTES;
  if (chunk % sector !== 0) throw new Error(`chunkSize ${chunk} must be a multiple of sectorSize ${sector}`);
  if (headLast < 0 || headLast % sector !== 0) {
    throw new Error(`headLastBytes ${headLast} must be a non-negative multiple of sectorSize ${sector}`);
  }
  const src = openSync(o.isoPath, "r");
  const dst = openSync(o.destPath, o.openFlag ?? "r+");
  try {
    const total = fstatSync(src).size;
    const head = Math.min(total, headLast);
    const buf = Buffer.allocUnsafe(chunk);
    let written = 0;
    // Source and destination offsets are equal: `head` is sector-aligned, and
    // only the image's final block can be short (it is padded, never shifted).
    const writeRange = (from: number, to: number): void => {
      let pos = from;
      while (pos < to) {
        const n = readSync(src, buf, 0, Math.min(chunk, to - pos), pos);
        if (n <= 0) throw new Error(`short read of image at ${pos} (wanted ${to - pos} more bytes)`);
        let len = n;
        if (len % sector !== 0) {
          if (pos + n !== total) throw new Error(`unaligned short read of image at ${pos} (${n} bytes)`);
          const padded = Math.ceil(len / sector) * sector;
          buf.fill(0, len, padded);
          len = padded;
        }
        writeSync(dst, buf, 0, len, pos);
        o.onWrite?.(pos, len);
        written += len;
        pos += n;
        o.onProgress?.(Math.min(written, total), total);
      }
    };
    writeRange(head, total); // everything but the partition table
    writeRange(0, head); // the partition table, LAST
    fsyncSync(dst);
    return { bytesWritten: written, isoBytes: total };
  } finally {
    closeSync(src);
    closeSync(dst);
  }
}

/**
 * sha256 of bytes [0, length) of `path`. With `padPastEof` a short file is
 * treated as zero-padded to `length` (the image, whose last block the write
 * padded); without it a short read is an error (the device must return every
 * byte that was written).
 */
export function sha256OfRange(path: string, length: number, padPastEof: boolean, chunkSize = 4 * 1024 * 1024): string {
  const fd = openSync(path, "r");
  try {
    const h = createHash("sha256");
    const buf = Buffer.allocUnsafe(chunkSize);
    let pos = 0;
    while (pos < length) {
      const want = Math.min(chunkSize, length - pos);
      let got = 0;
      while (got < want) {
        const n = readSync(fd, buf, got, want - got, pos + got);
        if (n <= 0) break;
        got += n;
      }
      if (got < want) {
        if (!padPastEof) throw new Error(`short read of ${path} at ${pos + got}: device returned fewer bytes than were written`);
        buf.fill(0, got, want);
      }
      h.update(buf.subarray(0, want));
      pos += want;
    }
    return h.digest("hex");
  } finally {
    closeSync(fd);
  }
}

export type ReadbackVerdict =
  | { readonly ok: true; readonly sha256: string; readonly bytes: number }
  | { readonly ok: false; readonly imageSha256: string; readonly deviceSha256: string; readonly bytes: number; readonly message: string };

/**
 * Read back EXACTLY the range the write covered (`bytesWritten`, sector-padded)
 * from the device and compare its sha256 with the image's (zero-padded to the
 * same length). A mismatch is a hard failure — the stick is not the image.
 */
export function verifyDeviceReadback(o: { imagePath: string; devicePath: string; bytesWritten: number }): ReadbackVerdict {
  const imageSha256 = sha256OfRange(o.imagePath, o.bytesWritten, true);
  const deviceSha256 = sha256OfRange(o.devicePath, o.bytesWritten, false);
  if (imageSha256 === deviceSha256) return { ok: true, sha256: deviceSha256, bytes: o.bytesWritten };
  return {
    ok: false,
    imageSha256,
    deviceSha256,
    bytes: o.bytesWritten,
    message:
      `read-back MISMATCH over ${o.bytesWritten} bytes: image sha256 ${imageSha256}, ` +
      `device sha256 ${deviceSha256}. The USB does NOT hold the image — do not boot it; re-flash.`,
  };
}

export type StageResult =
  | { readonly ok: true; readonly sha256: string; readonly bytes: number }
  | { readonly ok: false; readonly message: string };

/**
 * Copy `isoPath` to a NEW file `stagePath` (exclusive create), hashing the bytes
 * as they are copied, and require the hash to equal `expectedSha256` — the one
 * the integrity gate established. So the bytes that get baked and written are
 * exactly the bytes that were verified, not whatever the path names a moment
 * after the gate read it.
 */
export function stageVerifiedCopy(isoPath: string, stagePath: string, expectedSha256: string, chunkSize = 4 * 1024 * 1024): StageResult {
  const src = openSync(isoPath, "r");
  try {
    const dst = openSync(stagePath, "wx");
    try {
      const h = createHash("sha256");
      const buf = Buffer.allocUnsafe(chunkSize);
      let pos = 0;
      while (true) {
        const n = readSync(src, buf, 0, chunkSize, pos);
        if (n <= 0) break;
        h.update(buf.subarray(0, n));
        let put = 0;
        while (put < n) put += writeSync(dst, buf, put, n - put, pos + put);
        pos += n;
      }
      fsyncSync(dst);
      const sha256 = h.digest("hex");
      if (sha256 !== expectedSha256.toLowerCase()) {
        return {
          ok: false,
          message: `staged copy sha256 ${sha256} != verified ${expectedSha256} — the ISO changed after it was verified; refusing`,
        };
      }
      return { ok: true, sha256, bytes: pos };
    } finally {
      closeSync(dst);
    }
  } finally {
    closeSync(src);
  }
}

// ── ESP payloads: the SAME list the shared planner builds for every arm ──

/** Parsed command line. Pure; `parseWindowsFlasherArgs` is the only producer. */
export interface WindowsFlasherArgs {
  readonly short: boolean;
  readonly dryRun: boolean;
  readonly noInject: boolean;
  readonly help: boolean;
  readonly isoPath?: string;
  readonly sshKeyPath?: string;
  readonly host?: string;
  readonly role?: string;
  readonly flakeHost?: string;
  readonly joinServerUrl?: string;
  readonly joinTokenPath?: string;
  readonly acmeEmail?: string;
  readonly publicDomain?: string;
  readonly lbPool?: string;
  readonly repoPin?: string;
}

export type ArgsResult = { readonly ok: true; readonly value: WindowsFlasherArgs } | { readonly ok: false; readonly message: string };

const VALUE_FLAG_FIELDS: Readonly<Record<string, keyof WindowsFlasherArgs>> = {
  "--ssh-key": "sshKeyPath",
  "--host": "host",
  "--role": "role",
  "--flake-host": "flakeHost",
  "--join-server-url": "joinServerUrl",
  "--join-token": "joinTokenPath",
  "--acme-email": "acmeEmail",
  "--public-domain": "publicDomain",
  "--lb-pool": "lbPool",
  "--repo-pin": "repoPin",
};

/** Parse argv into flags. Unknown flags, missing values and >1 positional are refusals. */
export function parseWindowsFlasherArgs(argv: readonly string[]): ArgsResult {
  const unknown = firstUnknownFlag(argv);
  if (unknown !== null) return { ok: false, message: `unknown arg: ${unknown}` };
  const out: Record<string, unknown> = {
    short: argv.includes("--short"),
    dryRun: argv.includes("--dry-run"),
    noInject: argv.includes("--no-inject"),
    help: argv.includes("-h") || argv.includes("--help"),
  };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const field = VALUE_FLAG_FIELDS[a];
    if (field !== undefined) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("-")) return { ok: false, message: `${a} requires an argument` };
      if (out[field] !== undefined) return { ok: false, message: `${a} given more than once` };
      out[field] = v;
      i++;
      continue;
    }
    if (!a.startsWith("-")) positional.push(a);
  }
  if (positional.length > 1) return { ok: false, message: `at most one ISO path expected, got ${positional.length}` };
  if (positional[0] !== undefined) out.isoPath = positional[0];
  if (out.noInject === true && out.sshKeyPath !== undefined) {
    return { ok: false, message: "--ssh-key and --no-inject contradict each other" };
  }
  return { ok: true, value: out as unknown as WindowsFlasherArgs };
}

export type EspWritesResult =
  | { readonly ok: true; readonly value: readonly FileBackedEspWrite[] }
  | { readonly ok: false; readonly message: string };

/**
 * The ESP writes for this flash, from the SHARED planner (lib.ts
 * `planFileBackedZflashImage`) — so a Windows stick carries byte-for-byte the
 * payloads the other arms bake for the same flags: pubkey, hostname, firstboot
 * role conf (+ join token), the public-TLS pair, and the repo pin. Role and
 * public-endpoint flags go through the same validators the device CLI runs.
 * An empty list is a legitimate answer (--no-inject and nothing else asked).
 */
export function planWindowsEspWrites(
  args: WindowsFlasherArgs,
  pubkeyContent: string | undefined,
  isoPath: string,
  espOffsetBytes: number,
  outputImagePath: string,
): EspWritesResult {
  const role = firstbootRoleFromFlags({
    ...(args.role === undefined ? {} : { role: args.role }),
    ...(args.flakeHost === undefined ? {} : { flakeHost: args.flakeHost }),
    ...(args.joinServerUrl === undefined ? {} : { joinServerUrl: args.joinServerUrl }),
    ...(args.joinTokenPath === undefined ? {} : { joinTokenSourcePath: args.joinTokenPath }),
  });
  if (!role.ok) return { ok: false, message: `join material refused: ${role.error}` };
  const pe = planPublicEndpoint({
    ...(args.acmeEmail === undefined ? {} : { acmeEmail: args.acmeEmail }),
    ...(args.publicDomain === undefined ? {} : { publicDomain: args.publicDomain }),
  });
  if (!pe.ok) return { ok: false, message: `public TLS refused: ${pe.error}` };
  const lb = planLbPool(args.lbPool);
  if (!lb.ok) return { ok: false, message: `LoadBalancer range refused: ${lb.error}` };
  const nothingAsked =
    pubkeyContent === undefined &&
    args.host === undefined &&
    role.value === undefined &&
    pe.value === null &&
    lb.value === null &&
    args.repoPin === undefined;
  if (nothingAsked) return { ok: true, value: [] };
  const planned = planFileBackedZflashImage({
    isoPath,
    outputImagePath,
    espOffsetBytes,
    ...(pubkeyContent === undefined ? {} : { authorizedKeysContent: pubkeyContent }),
    ...(args.host === undefined ? {} : { hostname: args.host }),
    ...(role.value === undefined ? {} : { firstbootRole: role.value }),
    ...(args.joinTokenPath === undefined ? {} : { joinTokenSourcePath: args.joinTokenPath }),
    ...(pe.value === null ? {} : { publicEndpoint: pe.value }),
    ...(lb.value === null ? {} : { lbPool: lb.value }),
    ...(args.repoPin === undefined ? {} : { repoPinCommit: args.repoPin }),
  });
  if (!planned.ok) return { ok: false, message: planned.error };
  return { ok: true, value: planned.value.espWrites };
}

export type EspFilesResult = { readonly ok: true; readonly value: readonly EspFile[] } | { readonly ok: false; readonly message: string };

/** Materialise planned writes into (name, bytes). A `sourcePath` is read once, bounded, BEFORE any device work. */
export function resolveEspFiles(
  writes: readonly FileBackedEspWrite[],
  readSource: (path: string) => { ok: true; bytes: Buffer } | { ok: false; message: string } = defaultReadSource,
): EspFilesResult {
  const files: EspFile[] = [];
  for (const w of writes) {
    const name = w.destination.replace(/^\//, "");
    if (w.content !== undefined) {
      files.push({ name, body: Buffer.from(w.content, "utf8") });
      continue;
    }
    if (w.sourcePath === undefined) return { ok: false, message: `${w.destination}: planned write has neither content nor source` };
    const r = readSource(w.sourcePath);
    if (!r.ok) return { ok: false, message: `${w.destination}: ${r.message}` };
    files.push({ name, body: r.bytes });
  }
  return { ok: true, value: files };
}

function defaultReadSource(path: string): { ok: true; bytes: Buffer } | { ok: false; message: string } {
  const r = readFileBounded(path, { maxBytes: 1024 * 1024 });
  if (!r.ok) return { ok: false, message: r.error.message };
  return { ok: true, bytes: Buffer.from(r.value.text, "utf8") };
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

/** Flags that stand alone. */
export const BOOLEAN_FLAGS: readonly string[] = ["--short", "--dry-run", "--no-inject", "--help", "-h"];
/** Flags that consume the following token as their value. */
export const VALUE_FLAGS: readonly string[] = [
  "--ssh-key",
  // ESP payload flags — same names and validators as the device CLI (allowed-flags.ts).
  "--host",
  "--role",
  "--flake-host",
  "--join-server-url",
  "--join-token",
  "--acme-email",
  "--public-domain",
  "--lb-pool",
  "--repo-pin",
];

/**
 * FAIL CLOSED ON AN UNRECOGNISED FLAG — 081M03HRHBS087G0R001HRAFQ0.
 *
 * The tool asks `argv.includes("--dry-run")` and then FILTERS every remaining `-`-prefixed token
 * out of the positional list. So an unknown flag was not merely ignored — it was actively
 * discarded, and `--dry-runn` meant "destroy the USB for real". Positional count was already
 * bounded; flags were the hole.
 *
 * Returns the first unrecognised flag, or null. Positionals are NOT judged here: at most one ISO
 * path is legal and the existing `positional.length > 1` check already covers that.
 *
 * Exported and pure because the destructive path is Windows-gated, so this is the surface a
 * macOS/Linux test can exercise directly — see flash-usb-windows.test.ts.
 */
export function firstUnknownFlag(argv: readonly string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (VALUE_FLAGS.includes(arg)) {
      i++; // its value is not a flag, whatever it looks like
      continue;
    }
    if (BOOLEAN_FLAGS.includes(arg)) continue;
    if (arg.startsWith("-")) return arg;
  }
  return null;
}

async function main(runner: CommandRunner = realRunner): Promise<void> {
  const argv = process.argv.slice(2);

  // FIRST — above the elevation check, above disk enumeration, above every `runner.ps` call, so a
  // mistyped flag cannot reach the machine at all. `unknown arg` is also the phrase
  // `hygiene/audit-workflow-cli-flags.ts` looks for to decide this parser has a closed flag set.
  const unknownFlag = firstUnknownFlag(argv);
  if (unknownFlag !== null) {
    bail(
      2,
      `unknown arg: ${unknownFlag} — REFUSED, no device was read or written. ` +
        `Accepted: ${[...BOOLEAN_FLAGS, ...VALUE_FLAGS].sort().join(" ")} [iso-path]`,
    );
  }
  const parsed = parseWindowsFlasherArgs(argv);
  if (!parsed.ok) bail(2, parsed.message);
  const args = parsed.value;

  if (args.help) {
    process.stdout.write(
      "usage: bun src\\Core.TypeScript\\zflash\\flash-usb-windows.ts [flags] [iso-path]\n" +
        "  run from an ELEVATED (Administrator) terminal\n" +
        "    --short                    shorter `yes <4-hex>` confirm phrase\n" +
        "    --dry-run                  print the plan and exit; NO write\n" +
        "    --ssh-key <path>           public key to bake (default: ~/.ssh/id_ed25519.pub)\n" +
        "    --no-inject                no SSH key on the ESP (password login only)\n" +
        "    --host <name>              /zeta-hostname.txt\n" +
        "    --role <first-control-plane|joiner> [--flake-host <h>] [--join-server-url <u>] [--join-token <path>]\n" +
        "                               /zeta-firstboot.conf (+ /zeta-join-token)\n" +
        "    --acme-email <addr> --public-domain <domain>   public TLS pair, appended to /zeta-firstboot.conf\n" +
        "    --lb-pool <auto|first-ip-last-ip>   Cilium LoadBalancer range (FREE addresses on the node's LAN, outside DHCP);\n" +
        "                               appended to /zeta-firstboot.conf; the installer checks it against the LAN\n" +
        "    --repo-pin <40-hex>        /zeta-repo-pin (pin the installed tree to a commit)\n",
    );
    process.exit(0);
  }
  const dryRun = args.dryRun;

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
  const isoPath = args.isoPath ?? autoDiscoverIso(join(homedir(), "Downloads"));
  if (!isoPath) bail(2, `no zeta-installer-*.iso under %USERPROFILE%\\Downloads; pass an ISO path explicitly`);
  if (!existsSync(isoPath)) bail(2, `ISO file does not exist: ${isoPath}`);
  const st = statSync(isoPath);
  const iso = validateIso(isoPath, st.size, st.isFile());
  if (!iso.ok) bail(2, iso.message);
  process.stdout.write(`ISO: ${isoPath} (${human(st.size)})\n`);

  // ── VERIFY BEFORE WRITE ──────────────────────────────────────────────
  //
  // validateIso above establishes the ISO's SIZE and nothing else. Until
  // 081M0HG7X7B087G0R002A05DAP this arm stopped there, so on Windows zflash
  // wrote whatever bytes were at that path to \\.\PhysicalDriveN. The gate
  // is the same one the macOS arm runs, imported rather than copied, and it
  // fails CLOSED: no manifest beside the ISO is a refusal, never a pass.
  //
  // This matters more here than anywhere: the default ISO path is whatever
  // autoDiscoverIso found in the operator's Downloads folder, which is the
  // least trustworthy directory on the machine.
  const integrity = await establishIsoIntegrity(isoPath, realIsoIntegrityIo());
  if (!integrity.ok) bail(2, integrity.message);
  process.stdout.write(integrity.report);

  // Resolve the operator SSH pubkey NOW — BEFORE the destructive write — so a
  // missing/malformed key fails before the USB is wiped (not after).
  const realFs: PubkeyFsLike = { exists: existsSync, read: (p) => readFileSync(p, "utf8") };
  let pubkey: { path: string; content: string } | null = null;
  if (!args.noInject) {
    const r = resolveSshPubkey(args.sshKeyPath, homedir(), realFs);
    if (!r.ok) bail(2, `SSH key injection required (default). ${r.message}`);
    pubkey = { path: r.path, content: r.content };
    process.stdout.write(`SSH key to bake: ${pubkey.path}\n`);
  } else {
    process.stdout.write(`SSH key injection: DISABLED (--no-inject; password login only)\n`);
  }

  // Plan the ESP payloads from the SHARED planner, against the ESP the ISO's
  // own MBR names — refused here, before any disk is enumerated, if the ISO has
  // no isohybrid ESP or a flag is invalid.
  const espLoc = locateIsohybridEsp(readHead(isoPath, 512));
  if (!espLoc.ok) bail(2, `cannot bake ESP payloads: ${espLoc.error}`);
  const stageName = `${basename(isoPath)}.baked.img`;
  const planned = planWindowsEspWrites(args, pubkey?.content, isoPath, espLoc.value.offsetBytes, stageName);
  if (!planned.ok) bail(2, planned.message);
  for (const finding of railFindingsForEspWrites(planned.value.map((w) => w.destination))) {
    process.stderr.write(`flash-usb-windows: constitutional-rail finding: ${finding}\n`);
  }
  const espFiles = resolveEspFiles(planned.value);
  if (!espFiles.ok) bail(2, espFiles.message);

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
  const phrase = args.short ? buildShortChallenge(nonce) : `accept-destroy ${disk.number} ${nonce}${nonce}`;
  const bakeList = espFiles.value.map((f) => `    /${f.name} (${f.body.length} B)`).join("\n");

  if (dryRun) {
    process.stdout.write(
      `\n[dry-run] would prompt for: ${phrase}\n` +
        `[dry-run] would:\n` +
        `  <copy ${isoPath} -> <temp>\\${stageName}, sha256 must equal ${integrity.sha256}>\n` +
        (espFiles.value.length > 0
          ? `  <bake into the copy's ESP (MBR 0xEF @ LBA ${espLoc.value.startLba}), each read back and compared:\n${bakeList}>\n`
          : `  <no ESP payloads (--no-inject, nothing else asked)>\n`) +
        diskPreparationScripts(disk.number).map((s) => `  ${s}\n`).join("") +
        `  <raw write -> ${drivePath}: bytes past ${human(PARTITION_TABLE_BYTES)} first, partition table LAST>\n` +
        `  <read back the written range from ${drivePath}, compare sha256 with the baked image>\n` +
        `[dry-run] no changes made.\n`,
    );
    process.exit(0);
  }

  // Created only now — after every refusal that can happen without touching
  // anything — and removed in the finally below on every path out.
  const stageDir = mkdtempSync(join(tmpdir(), "zeta-flash-stage-"));
  const stagePath = join(stageDir, stageName);
  const cleanupStage = (): void => {
    try {
      rmSync(stageDir, { recursive: true, force: true });
    } catch {
      process.stderr.write(`flash-usb-windows: could not remove staging dir ${stageDir}; delete it manually\n`);
    }
  };
  let failure: FlashAbort | null = null;
  try {
    // Stage + bake BEFORE the confirm prompt: every failure here happens with the
    // USB untouched, and the prompt-to-write gap stays short.
    process.stdout.write(`\nStaging a verified copy of the ISO at ${stagePath} ...\n`);
    const staged = stageVerifiedCopy(isoPath, stagePath, integrity.sha256);
    if (!staged.ok) abort(2, staged.message);
    if (espFiles.value.length > 0) {
      const fd = openSync(stagePath, "r+");
      try {
        const baked = bakeEspFiles(fdBlockIo(fd), espFiles.value);
        if (!baked.ok) abort(1, `ESP bake FAILED (no device was touched): ${baked.error}`);
        fsyncSync(fd);
        process.stdout.write(
          `Baked into the copy's FAT${baked.value.fatType} ESP and read back:\n` +
            baked.value.files.map((f) => `    /${f.name}  (8.3 ${f.shortName.slice(0, 8).trimEnd()}.${f.shortName.slice(8).trimEnd()})`).join("\n") +
            "\n",
        );
      } finally {
        closeSync(fd);
      }
    }

    process.stdout.write(`\nTo proceed, type EXACTLY (case-sensitive):\n\n  ${phrase}\n\n> `);
    const typed = (await readLine()).trim();
    if (typed !== phrase) abort(2, `confirmation mismatch — aborting (no write performed).`);

    // Prepare the disk: clear read-only, clear partitions. No offline (removable
    // media refuses it) — see diskPreparationScripts.
    process.stdout.write(`\nPreparing disk ${disk.number}:\n`);
    prepareDiskForRawWrite(runner, disk.number, (s) => process.stdout.write(`${s}\n`));

    process.stdout.write(`\nFlashing -> ${drivePath} (partition table last; this takes a few minutes) ...\n`);
    let lastPct = -1;
    const res = copyImageToDevice({
      isoPath: stagePath,
      destPath: drivePath,
      onProgress: (w, t) => {
        const pct = Math.floor((w / t) * 100);
        if (pct !== lastPct) {
          process.stdout.write(`\r  ${pct}%  (${human(w)} / ${human(t)})   `);
          lastPct = pct;
        }
      },
    });
    process.stdout.write(`\n\nWrote ${human(res.bytesWritten)} (image ${human(res.isoBytes)}).\n`);

    process.stdout.write(`Reading back ${human(res.bytesWritten)} from ${drivePath} ...\n`);
    const rb = verifyDeviceReadback({ imagePath: stagePath, devicePath: drivePath, bytesWritten: res.bytesWritten });
    if (!rb.ok) abort(1, rb.message);
    process.stdout.write(`Read-back sha256 ${rb.sha256} matches the baked image.\n`);
    process.stdout.write(`Flash complete; disk ${disk.number} is safe to remove.\n`);
  } catch (e) {
    failure = asFlashAbort(e);
  } finally {
    cleanupStage();
  }
  if (failure !== null) bail(failure.code, failure.message);
}

/** A refusal raised inside the staging try-block, so the staging dir is removed before exit. */
interface FlashAbort {
  readonly code: 1 | 2;
  readonly message: string;
}
const FLASH_ABORT = Symbol("flash-abort");
function abort(code: 1 | 2, message: string): never {
  throw Object.assign(new Error(message), { [FLASH_ABORT]: code });
}
function asFlashAbort(e: unknown): FlashAbort {
  if (e instanceof Error) {
    const code = (e as Error & { [FLASH_ABORT]?: 1 | 2 })[FLASH_ABORT];
    return { code: code ?? 1, message: e.message };
  }
  return { code: 1, message: String(e) };
}

/** First `n` bytes of a file (short file → shorter buffer). */
function readHead(path: string, n: number): Buffer {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(n);
    const got = readSync(fd, buf, 0, n, 0);
    return buf.subarray(0, got);
  } finally {
    closeSync(fd);
  }
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
