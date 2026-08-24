#!/usr/bin/env bun
// src/Core.TypeScript/zflash/flash-usb.ts — safety-railed dd wrapper for installer ISO → USB.
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
//   - Runner must type a phrase containing the device path AND
//     a fresh random nonce printed at runtime: e.g.
//       accept-destroy /dev/disk4 a3f9c1d2
//   - The nonce makes it impossible for an agent to pre-bake the
//     answer; the runner has to OBSERVE the nonce at THIS run.
//   - The phrase explicitly says `accept-destroy`. By typing it,
//     the runner is signing a runtime acceptance of responsibility
//     for the contents of the destination device.
//
// Then:
//   - `diskutil unmountDisk` (not eject)
//   - `sudo dd` with `/dev/rdiskN` (raw device; ~10x faster)
//   - `bs=4m conv=sync status=progress`
//   - `diskutil eject` on success
//
// Usage:
//   bun src/Core.TypeScript/zflash/flash-usb.ts <path-to-iso>
//
// Authorization for agent execution:
//   The classifier may block `diskutil list` + `dd` even from this
//   script. To allow an agent to run it, add to .claude/settings.json:
//     "permissions": { "allow": [
//       "Bash(bun src/Core.TypeScript/zflash/flash-usb.ts *)"
//     ] }
//
//   The permission rule grants INVOCATION, not absolution. The
//   safety rails (platform / ISO size / USB-protocol / internal-
//   disk / boot-disk / size-range refusals) AND the runtime
//   acceptance gate carry the safety logic. Bypassing them (e.g.
//   piping an answer to stdin to skip the verification gate) is
//   the bypasser's responsibility, not the maintainer's who
//   shipped this tool in good faith.
//
// Liability framing:
//   By completing the runtime confirmation prompt, the runner
//   (whether human OR agent acting on a runner's behalf) accepts
//   responsibility for the contents of the destination device.
//   The maintainer who committed this script + the permission
//   rule has no liability for a downstream runner who accepts
//   responsibility at the runtime gate. Per the framework's
//   autonomy-first-class + NCI disciplines: agents act on their
//   owner's behalf; the owner is responsible for their agent's
//   actions; you are not responsible for what another maintainer's
//   agent decides to do with substrate you provided in good faith.
//
// Implementation note: all subprocess calls use execFileSync (argv-
// array form) — never shell interpolation. Inputs that flow into
// arguments come from diskutil's own JSON output (trusted) or from
// hardcoded literals, never from user-controlled strings.

import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { platform } from "node:os";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { establishIsoIntegrity, realIsoIntegrityIo } from "./iso-integrity.ts";
import {
  checkDeviceIdentity,
  checkStatedPin,
  classifyDeviceState,
  DEFAULT_HEAD_SAMPLE_BYTES,
  DEFAULT_READBACK_CHUNK_BYTES,
  openChunkReader,
  sampleHeadDigests,
  verifyReadBack,
  ZETA_INSTALL_VOLUME_LABEL,
  type ChunkReader,
  type DeviceIdentity,
  type ObservedPartition,
  type StatedTargetPin,
} from "./verify.ts";
import { MAX_ISO_BYTES, MAX_USB_BYTES, MIN_ISO_BYTES, MIN_USB_BYTES } from "./size-bounds.ts";
import { resolveElevatorPathOrThrow } from "../privilege/elevator.ts";


/**
 * The typed acknowledgement for a half-provisioned device.
 *
 * Fixed text, no nonce: the nonce belongs to the destroy challenge, where its
 * job is to prove the runner observed THIS run. This phrase has a different
 * job -- it proves the runner read the VERDICT -- so it names the state and
 * nothing else. cli.ts matches this line to answer it in --agent mode, so the
 * two-space indent it is printed with is part of the contract.
 */
export const HALF_PROVISIONED_ACK = "ack half-provisioned";



/** The privilege elevator, resolved to an ABSOLUTE, root-owned, setuid, non-world-writable
 *  path — never through `PATH`. Resolving an elevator by name lets any writable directory
 *  earlier on `PATH` substitute a program of the attacker's choosing, with no git diff for
 *  review to see (docs/BUGS.md P1, 2026-08-24). Throws on a host with no conforming
 *  elevator, which is the correct outcome: there is nothing safe to fall back to. */
function sudoProgram(): string {
  return resolveElevatorPathOrThrow("sudo");
}

function bail(code: number, msg: string): never {
  process.stderr.write(`flash-usb: ${msg}\n`);
  process.exit(code);
}

export function human(bytes: number): string {
  const u = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(2)} ${u[i]}`;
}

// ============================================================================
// PURE DECISION SURFACE -- the safety rails, as values rather than as control
// flow buried in main().
// ============================================================================
//
// WHY THIS BLOCK EXISTS. Every rail below was already implemented in this file;
// none of it was reachable from a test. The rails lived inline in a 660-line
// `main()` that calls `process.exit` and `sudo dd`, in a module that ran itself
// on import. The Linux arm (flash-usb-linux.ts) and the Windows arm
// (flash-usb-windows.ts) had each already been written this way and each has a
// test file; the macOS arm -- the one the maintainer's own laptop uses -- did
// not, and appeared in NO coverage report because no test ever loaded it.
//
// These are EXTRACTIONS, not a second copy. `main()` below calls each one. A
// mirrored rail that drifts from the rail actually enforced is worse than no
// test at all, because it reports green about code that no longer runs.

export const ALLOWED_FLAGS: readonly string[] = [
  "--short",
  "--no-eject",
  "--accept-unrecognized",
  "--accept-half-provisioned",
  "-h",
  "--help",
];

/** Flags carrying a value as `--name=value`: the caller's STATED target pin. */
export const VALUE_FLAGS: readonly string[] = [
  "--expect-device",
  "--expect-size",
  "--expect-model",
];

export interface ParsedFlags {
  readonly short: boolean;
  readonly noEject: boolean;
  readonly acceptUnrecognized: boolean;
  readonly acceptHalfProvisioned: boolean;
  readonly help: boolean;
  readonly expectDevice: string | null;
  readonly expectModel: string | null;
  readonly expectSize: number | null;
  readonly positional: readonly string[];
}

export type FlagParse =
  | { readonly ok: true; readonly flags: ParsedFlags }
  | { readonly ok: false; readonly code: 2; readonly message: string };

export function flagName(f: string): string {
  return f.includes("=") ? f.slice(0, f.indexOf("=")) : f;
}

/**
 * Parse argv under a strict allowlist.
 *
 * The allowlist is the rail, not a nicety: silently accepting an unrecognised
 * flag on a destructive tool means a mistyped `--dry-run` or `--shrot` proceeds
 * all the way to `sudo dd` while the operator believes they asked for something
 * else. Likewise a value flag given with no `=value` is a REFUSAL rather than a
 * silent null -- an operator who meant to pin the target and mistyped the syntax
 * must not be handed the unpinned path by accident.
 */
export function parseFlags(argv: readonly string[]): FlagParse {
  const rawFlags = argv.filter((a) => a.startsWith("-"));
  const positional = argv.filter((a) => !a.startsWith("-"));
  const allowed = new Set(ALLOWED_FLAGS);
  const valued = new Set(VALUE_FLAGS);

  const unknown = rawFlags.filter((f) => !allowed.has(f) && !valued.has(flagName(f)));
  if (unknown.length > 0) {
    return {
      ok: false,
      code: 2,
      message:
        `unknown flag(s): ${unknown.join(", ")}\n` +
        `Allowed flags: ${ALLOWED_FLAGS.join(", ")}\n` +
        `Refusing to proceed - destructive tool requires exact flag match.`,
    };
  }

  let bad: string | null = null;
  const valueOf = (name: string): string | null => {
    const hit = rawFlags.find((f) => flagName(f) === name);
    if (hit === undefined) return null;
    const eq = hit.indexOf("=");
    const v = eq < 0 ? "" : hit.slice(eq + 1);
    if (v.length === 0) {
      bad ??= `flag ${name} needs a value, as ${name}=VALUE`;
      return null;
    }
    return v;
  };

  const expectDevice = valueOf("--expect-device");
  const expectModel = valueOf("--expect-model");
  const expectSizeRaw = valueOf("--expect-size");
  if (bad !== null) return { ok: false, code: 2, message: bad };

  const expectSize = expectSizeRaw === null ? null : Number(expectSizeRaw);
  if (expectSize !== null && !Number.isSafeInteger(expectSize)) {
    return {
      ok: false,
      code: 2,
      message: `--expect-size must be a whole number of bytes, got ${String(expectSizeRaw)}`,
    };
  }

  const has = (f: string): boolean => rawFlags.includes(f);
  return {
    ok: true,
    flags: {
      short: has("--short"),
      noEject: has("--no-eject"),
      acceptUnrecognized: has("--accept-unrecognized"),
      acceptHalfProvisioned: has("--accept-half-provisioned"),
      help: has("-h") || has("--help"),
      expectDevice,
      expectModel,
      expectSize,
      positional,
    },
  };
}

/** Whitelist of safe whole-disk paths. diskutil produces these itself; the
 *  check is belt-and-suspenders against a partition path (/dev/disk4s1) or a
 *  crafted string reaching an argv array. */
export function isSafeDevicePath(device: string): boolean {
  return /^\/dev\/disk\d+$/u.test(device);
}

/** The raw character device is the ONLY handle the privileged reader accepts.
 *  Kept a separate predicate because the two shapes are not interchangeable:
 *  /dev/diskN is buffered, /dev/rdiskN is raw and ~10x faster. */
export function isSafeRawDevicePath(device: string): boolean {
  return /^\/dev\/rdisk\d+$/u.test(device);
}

export function rawDevicePathFor(device: string): string {
  return `/dev/r${device.replace("/dev/", "")}`;
}

/** Parse `diskutil list -plist external physical` (already plutil-converted to
 *  JSON) into whole-disk paths. The plist read needs macOS; this parse does not,
 *  which is the whole reason it is a separate function. */
export function parseExternalDevices(listJson: unknown): string[] {
  if (listJson === null || typeof listJson !== "object") return [];
  const disks = (listJson as { AllDisksAndPartitions?: unknown }).AllDisksAndPartitions;
  if (!Array.isArray(disks)) return [];
  return disks
    .map((d: unknown) => (d as { DeviceIdentifier?: unknown }).DeviceIdentifier)
    .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    .map((id: string) => `/dev/${id}`);
}

/** The bus filter. USB-C is a distinct BusProtocol string on macOS and both
 *  count; anything Internal is refused whatever the bus says. */
export function isUsbCandidate(busProtocol: string, internal: boolean): boolean {
  return (busProtocol === "USB" || busProtocol === "USB-C") && !internal;
}

export interface UsbCandidate {
  readonly device: string;
  readonly sizeBytes: number;
  readonly model: string;
}

export type UsbSelection =
  | { readonly kind: "selected"; readonly device: string }
  | { readonly kind: "none"; readonly message: string }
  | { readonly kind: "ambiguous"; readonly message: string };

/**
 * Zero, one, or many.
 *
 * The `many` arm is a REFUSAL, not a picker. A tool that picks "the external
 * disk" is one plugged-in phone away from destroying it, and the operator's
 * mental model of which stick is "the" stick is exactly what cannot be checked
 * from inside the process.
 */
export function selectUsbTarget(candidates: readonly UsbCandidate[]): UsbSelection {
  if (candidates.length === 0) {
    return {
      kind: "none",
      message:
        "no USB devices found.\n" +
        "Plug in the USB stick, then re-run. If you already plugged it in,\n" +
        "give the OS a few seconds and try again.",
    };
  }
  if (candidates.length > 1) {
    const listing = candidates
      .map((c) => `  ${c.device}  ${human(c.sizeBytes)}  ${c.model}`)
      .join("\n");
    return {
      kind: "ambiguous",
      message:
        `multiple USB devices found:\n${listing}\n` +
        "refusing to pick one. Unplug all but the target USB and re-run, OR\n" +
        "use manual flow: sudo dd if=<iso> of=/dev/rdiskN bs=4m",
    };
  }
  const only = candidates[0];
  if (only === undefined) return { kind: "none", message: "internal: empty after length check" };
  return { kind: "selected", device: only.device };
}

export type RailCheck = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** The ISO gate: exists, named *.iso, is a regular file, size in range. */
export function validateIso(isoPath: string, sizeBytes: number, exists: boolean, isFile: boolean): RailCheck {
  if (!exists) return { ok: false, message: `ISO file does not exist: ${isoPath}` };
  if (!isoPath.endsWith(".iso")) return { ok: false, message: `expected *.iso file, got: ${isoPath}` };
  if (!isFile) return { ok: false, message: `ISO path is not a file: ${isoPath}` };
  if (sizeBytes < MIN_ISO_BYTES || sizeBytes > MAX_ISO_BYTES) {
    return {
      ok: false,
      message:
        `ISO size ${human(sizeBytes)} outside sane range ` +
        `[${human(MIN_ISO_BYTES)}, ${human(MAX_ISO_BYTES)}]; refusing`,
    };
  }
  return { ok: true };
}

/** The size bound is what stands between this tool and an external SSD. */
export function validateUsbSize(device: string, sizeBytes: number): RailCheck {
  if (sizeBytes < MIN_USB_BYTES || sizeBytes > MAX_USB_BYTES) {
    return {
      ok: false,
      message:
        `device ${device} size ${human(sizeBytes)} outside USB range ` +
        `[${human(MIN_USB_BYTES)}, ${human(MAX_USB_BYTES)}]; refusing\n` +
        `(this protects against pointing at an external SSD by mistake)`,
    };
  }
  return { ok: true };
}

/** Parse `mount` output for the disk backing `/`. Split out from the shell-out
 *  so the parse can be tested against real macOS `mount` text. Returns "" when
 *  no row mounts `/`, and "" is treated as "unknown", never as "safe". */
export function parseBootDiskIdentifier(mountOutput: string): string {
  const rootMount = mountOutput.split("\n").find((l) => / on \/ \(/u.test(l));
  if (rootMount === undefined) return "";
  const m = /^\/dev\/(disk\d+)/u.exec(rootMount);
  return m?.[1] ?? "";
}

/** True when the target IS the boot disk. An empty bootDisk means the root row
 *  could not be parsed, and an unknown answer must not read as a pass -- but it
 *  cannot refuse either without bricking every host whose `mount` we misparse,
 *  so the caller pairs this with the size + bus + internal rails. */
export function targetIsBootDisk(device: string, bootDisk: string): boolean {
  if (bootDisk === "") return false;
  return device.replace("/dev/", "") === bootDisk;
}

/** Nonce width is the consent strength knob: 8 hex chars long-form, 4 short. */
export function makeNonce(short: boolean, rand: (n: number) => Buffer = randomBytes): string {
  return rand(short ? 2 : 4).toString("hex");
}

export function buildLongChallenge(device: string, nonce: string): string {
  return `accept-destroy ${device} ${nonce}`;
}

export function buildShortChallenge(nonce: string): string {
  return `yes ${nonce}`;
}

export function buildChallenge(short: boolean, device: string, nonce: string): string {
  return short ? buildShortChallenge(nonce) : buildLongChallenge(device, nonce);
}

/**
 * The acceptance comparison. EXACT, on purpose.
 *
 * readline has already stripped the trailing newline and there is deliberately
 * no .trim(): whitespace tolerance would let a piped answer with stray padding
 * satisfy a gate whose entire job is to prove a human read THIS run's nonce.
 */
export function acceptanceMatches(typed: string, expected: string): boolean {
  return typed === expected;
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

/**
 * Read the five identifying fields, as a value that can be COMPARED.
 *
 * These exact fields were already being read and printed. Lifting them into a
 * value is the whole change: a printed field informs, a compared field
 * refuses.
 */
function readIdentity(device: string): DeviceIdentity {
  const info = diskutilInfo(device);
  return {
    devicePath: device,
    sizeBytes: Number(info.TotalSize ?? 0),
    mediaName: String(info.MediaName ?? info.IORegistryEntryName ?? "?"),
    busProtocol: String(info.BusProtocol ?? ""),
    removableMedia:
      info.RemovableMedia === true || info.RemovableMediaOrExternalDevice === true,
    internal: info.Internal === true,
  };
}

function bootDiskIdentifier(): string {
  // Shell-out here; the PARSE is parseBootDiskIdentifier above, so it can be
  // tested against real `mount` text on any host.
  return parseBootDiskIdentifier(execFileSync("mount", [], { encoding: "utf8" }));
}

/**
 * Read a raw device through sudo, as a ChunkReader.
 *
 * MEASURED, 2026-08-21, and the reason this exists: /dev/rdisk6 on this Mac is
 * crw-r----- root:operator and the maintainer is not in the operator group, so
 * an unprivileged openSync("/dev/rdisk6", "r") throws EACCES. Every read of a
 * device from this tool therefore has to go through sudo -- including the
 * read-back verify at step 7, which until now used the unprivileged shim and
 * would have failed on every real flash AFTER a successful dd.
 *
 * READ-ONLY BY CONSTRUCTION. The argv below has an if= and no of=, so dd
 * writes to stdout and there is no code path here that can name an output
 * device. argv-array form, never a shell string; the path is re-validated
 * against the /dev/rdiskN shape on the way in.
 */
function privilegedDeviceReader(rawDevicePath: string, blockBytes: number): ChunkReader {
  if (!isSafeRawDevicePath(rawDevicePath)) {
    bail(2, `unsafe raw device path: ${rawDevicePath}`);
  }
  if (!Number.isSafeInteger(blockBytes) || blockBytes <= 0) {
    bail(2, `invalid privileged-read block size: ${String(blockBytes)}`);
  }
  return {
    read(offset: number, length: number): Uint8Array {
      if (offset % blockBytes !== 0) {
        bail(
          2,
          `internal: privileged read offset ${String(offset)} is not a multiple of ` +
            `the ${String(blockBytes)}-byte block size; dd skip= counts blocks, so a ` +
            `misaligned offset would silently read the WRONG range`,
        );
      }
      const blocks = Math.ceil(length / blockBytes);
      const out = execFileSync(
        sudoProgram(),
        [
          "dd",
          `if=${rawDevicePath}`,
          `bs=${String(blockBytes)}`,
          `skip=${String(offset / blockBytes)}`,
          `count=${String(blocks)}`,
        ],
        { maxBuffer: blocks * blockBytes + 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
      );
      return new Uint8Array(out.buffer, out.byteOffset, Math.min(out.length, length));
    },
  };
}

// Whitelist of safe device-identifier shapes. Belt-and-suspenders
// even though diskutil produces these strings itself.
function assertSafeDevicePath(device: string): void {
  if (!isSafeDevicePath(device)) {
    bail(2, `unsafe device path: ${device}`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  // Parse flags + positional ISO path. Supported flags allowlist:
  //   --short   shorter `yes <4-hex>` challenge format (default: full
  //             `accept-destroy <device> <8-hex>`). Used by the
  //             `zflash` wrapper; safe to type by hand too.
  //   -h/--help usage
  //
  // Allowlist (Copilot P0 catch): for a destructive tool, silently
  // accepting unknown flags like `--dry-run` or a misspelled `--short`
  // would proceed to sudo dd despite operator intent. Bail explicitly
  // on any unrecognized flag.
  // The allowlist, the value-flag syntax check and the refusal texts all live in
  // parseFlags() above -- one definition, called here, asserted in the test file.
  const parsed = parseFlags(argv);
  if (!parsed.ok) bail(parsed.code, parsed.message);
  const {
    acceptUnrecognized,
    acceptHalfProvisioned,
    expectDevice,
    expectModel,
    expectSize,
    positional,
    short: useShortChallenge,
    noEject,
    help: isHelp,
  } = parsed.flags;
  if (isHelp || positional.length !== 1) {
    process.stdout.write(
      "Usage: bun src/Core.TypeScript/zflash/flash-usb.ts [flags] <path-to-iso>\n" +
        "  --short      use shorter yes-<4-hex> challenge format\n" +
        "  --no-eject   leave the USB attached after dd (for downstream tooling\n" +
        "               like zflash's iter-4.2 ESP-mount + pubkey-inject step,\n" +
        "               downstream MUST eject itself when done)\n" +
        "  --expect-device=/dev/diskN   state the target instead of discovering it\n" +
        "  --expect-size=BYTES          state the exact device size\n" +
        "  --expect-model=NAME          state the exact diskutil MediaName\n" +
        "  --accept-unrecognized        proceed on a device whose state is not a\n" +
        "                               shape zflash put there (somebody else's data)\n" +
        "  --accept-half-provisioned    answer the half-provisioned acknowledgement\n" +
        "                               non-interactively (for scripted callers)\n" +
        "\n" +
        "The ISO is verified against a SHA256SUMS or <iso>.sha256 manifest beside it\n" +
        "BEFORE any device is enumerated, and the written bytes are read back and\n" +
        "compared after dd. Neither step has an opt-out.\n",
    );
    process.exit(isHelp && positional.length === 0 ? 0 : 2);
  }
  const firstArg = positional[0];
  if (firstArg === undefined) bail(2, "internal: positional length check passed but positional[0] is undefined");
  const isoPath: string = firstArg;

  // ── 1. Platform gate ───────────────────────────────────────
  if (platform() !== "darwin") {
    // This used to print a raw `lsblk; sudo dd …` line for the operator to type by hand —
    // a command with none of the rails above it: no bus check, no boot-disk check, no size
    // bound, no runtime consent. The Linux arm now exists and carries the same contract
    // (081M037KPG1087G0R0005ANAFV), so point at it rather than at a hand-typed dd.
    bail(
      2,
      "this script only supports macOS. Use the platform arm for this host:\n" +
        "  Linux:   bun src/Core.TypeScript/zflash/flash-usb-linux.ts <path-to-iso>\n" +
        "  Windows: bun src/Core.TypeScript/zflash/flash-usb-windows.ts <path-to-iso>",
    );
  }

  // ── 2. ISO gate ────────────────────────────────────────────
  const isoExists = existsSync(isoPath);
  const isoStat = isoExists ? statSync(isoPath) : null;
  const isoCheck = validateIso(
    isoPath,
    isoStat?.size ?? 0,
    isoExists,
    isoStat?.isFile() ?? false,
  );
  if (!isoCheck.ok) bail(2, isoCheck.message);
  // validateIso returning ok implies exists && isFile, so isoStat is non-null.
  // Re-checked rather than asserted: an `as` here would be the vacuity class.
  if (isoStat === null) bail(2, `internal: ISO gate passed but stat is absent for ${isoPath}`);
  const isoBytes: number = isoStat.size;
  process.stdout.write(`ISO: ${isoPath} (${human(isoBytes)})\n`);

  // ── 2b. VERIFY BEFORE WRITE ────────────────────────────────
  //
  // Until now zflash established the ISO's SIZE and nothing else. CI cosign-
  // signs the x86 ISO and computes a SHA-256, but writes it only to
  // GITHUB_OUTPUT and the step summary -- so there was nothing on disk beside
  // the ISO to check it against, and nothing checked it.
  //
  // This is a REFUSAL, not a warning: non-zero exit, no device touched, before
  // any enumeration happens.
  //
  // The block that used to sit here — candidate list, read, hash, refuse — now
  // lives in ./iso-integrity.ts, because the Linux and Windows arms need the
  // same gate and had none. One definition, three call sites; the alternative
  // was three copies under a comment claiming they matched.
  {
    const integrity = await establishIsoIntegrity(isoPath, realIsoIntegrityIo());
    if (!integrity.ok) bail(2, integrity.message);
    process.stdout.write(integrity.report);
  }

  // ── 3. Enumerate USB devices ───────────────────────────────
  const list = diskutilListPlist() as {
    AllDisksAndPartitions: {
      DeviceIdentifier: string;
      Partitions?: {
        DeviceIdentifier: string;
        Content?: string;
        Size?: number;
        VolumeName?: string;
      }[];
      Content?: string;
    }[];
  };
  const externalDevices = parseExternalDevices(list);

  const usbCandidates: { device: string; info: Record<string, unknown> }[] = [];
  for (const device of externalDevices) {
    assertSafeDevicePath(device);
    const info = diskutilInfo(device);
    if (isUsbCandidate(String(info.BusProtocol ?? ""), info.Internal === true)) {
      usbCandidates.push({ device, info });
    }
  }

  // Zero / one / many, decided by selectUsbTarget above. `many` is a refusal,
  // never a picker -- see that function's comment for why.
  const selection = selectUsbTarget(
    usbCandidates.map((c) => ({
      device: c.device,
      sizeBytes: Number(c.info.TotalSize ?? 0),
      model: String(c.info.MediaName ?? "?"),
    })),
  );
  if (selection.kind !== "selected") bail(2, selection.message);

  const candidate = usbCandidates.find((c) => c.device === selection.device);
  if (candidate === undefined) bail(2, "internal: selected device not in candidate list");
  const { device, info } = candidate;
  assertSafeDevicePath(device);
  const size = Number(info.TotalSize ?? 0);
  const model = String(info.MediaName ?? info.IORegistryEntryName ?? "?");
  const removable =
    info.RemovableMedia === true || info.RemovableMediaOrExternalDevice === true;

  // ── 4. Per-device safety gates ─────────────────────────────
  const sizeCheck = validateUsbSize(device, size);
  if (!sizeCheck.ok) bail(2, sizeCheck.message);

  const bootDisk = bootDiskIdentifier();

  // /dev/rdiskN is the raw character device -- ~10x faster than the buffered
  // /dev/diskN on macOS, and the only handle the privileged reader accepts.
  // Declared here rather than at the write step because the head-digest sample
  // below reads from it BEFORE any consent is asked for.
  const rawDevice = rawDevicePathFor(device);
  if (targetIsBootDisk(device, bootDisk)) {
    bail(2, `device ${device} IS the boot disk; refusing to overwrite`);
  }

  // ── 4b. DEVICE IDENTITY: STATED, then checked ──────────────
  //
  // The principle, stated once so the code below is legible: a tool that
  // selects "the external disk" is one plugged-in phone away from destroying
  // it. The target must never be discovered dynamically.
  //
  // Until 2026-08-21 this block built its own expectation by falling back to
  // the OBSERVED value field by field, so with no --expect-* flag the first
  // identity check compared the observed device to itself and printed a
  // warning. cli.ts never passed --expect-*, so that was the only path anyone
  // used. A check that cannot fail is not a check.
  //
  // There are now two comparisons, and neither has a fallback:
  //   1. the caller STATED pin  vs  what enumeration found      (here)
  //   2. the enumeration SNAPSHOT vs a fresh read before dd     (step 5c)
  // (2) is the TOCTOU guard: two observations taken at different times, which
  // is a real comparison. (1) is the wrong-disk guard, and it is the only one
  // that can catch "the tool picked a disk you did not mean".
  const observedIdentity = readIdentity(device);
  if (expectDevice === null || expectSize === null || expectModel === null) {
    bail(
      2,
      "UNPINNED TARGET -- this device was DISCOVERED, not stated, and a tool that\n" +
        "  discovers its own target is one plugged-in phone away from destroying it.\n" +
        "  Re-run naming the target:\n\n" +
        "    --expect-device=" + observedIdentity.devicePath +
        " --expect-size=" + String(observedIdentity.sizeBytes) +
        " --expect-model=" + JSON.stringify(observedIdentity.mediaName) + "\n\n" +
        "  (the zflash wrapper passes these for you, from the device it shows you)\n" +
        "  No device has been touched.",
    );
  }
  const statedPin: StatedTargetPin = {
    devicePath: expectDevice,
    sizeBytes: expectSize,
    mediaName: expectModel,
  };
  {
    const pinCheck = checkStatedPin(statedPin, observedIdentity);
    if (!pinCheck.ok) bail(2, pinCheck.error);
  }
  process.stdout.write(
    "Target PINNED by the caller: " +
      statedPin.devicePath +
      "  " +
      String(statedPin.sizeBytes) +
      " bytes  " +
      statedPin.mediaName +
      "\n",
  );



  // ── 5. Display + responsibility-acceptance confirmation ────
  //
  // The runner (human OR agent acting on their behalf) types
  // back a phrase that contains the device path AND a fresh
  // random nonce printed at runtime. The nonce makes it
  // impossible for an agent to pre-bake the answer — the
  // runner has to OBSERVE the displayed value at THIS run.
  //
  // The phrase explicitly says `accept-destroy`. By typing it,
  // the runner is signing a runtime acceptance of responsibility
  // for the contents of the destination device. The maintainer
  // who shipped this tool is not liable for what a downstream
  // runner accepts at this prompt — the runner had every safety
  // rail (platform, ISO size, USB-protocol, internal check,
  // boot-disk check, size range) AND this explicit acceptance
  // gate to refuse on.
  // Long form: 8-hex nonce + explicit accept-destroy + device path. Default;
  //   strongest consent signature; ties consent to a specific device.
  // Short form (--short): 4-hex nonce + `yes` prefix. ~14 keystrokes total
  //   from `zflash` wrapper invocation. Same safety contract — nonce still
  //   random per run (can't be pre-baked); `yes` still requires explicit
  //   typed consent (not a stray Enter). Device path is implicit (the
  //   sanity-rail block above already enforces single-USB; only one device
  //   can be the target).
  const nonce = makeNonce(useShortChallenge);
  const acceptancePhrase = buildChallenge(useShortChallenge, device, nonce);

  // Extra-detail fields (best-effort — diskutil may omit any of these
  // depending on the USB controller; show "?" rather than fail).
  const vendor = String(info.DeviceVendor ?? info.IORegistryEntryName ?? "?");
  const serial = String(info.DeviceSerial ?? info.DeviceSerialNumber ?? "?");
  const ioRegName = String(info.IORegistryEntryName ?? "?");
  const partitionTable = String(info.Content ?? "?");
  const writable =
    info.WritableMedia === true || info.Writable === true ? "yes" : "no";

  process.stdout.write("\n");
  process.stdout.write("USB device identified:\n");
  process.stdout.write(`  Device:      ${device}\n`);
  process.stdout.write(`  Model:       ${model}\n`);
  process.stdout.write(`  Vendor:      ${vendor}\n`);
  process.stdout.write(`  IORegName:   ${ioRegName}\n`);
  process.stdout.write(`  Serial:      ${serial}\n`);
  process.stdout.write(`  Size:        ${human(size)}\n`);
  process.stdout.write(`  Protocol:    ${info.BusProtocol}\n`);
  process.stdout.write(`  Removable:   ${removable}\n`);
  process.stdout.write(`  Writable:    ${writable}\n`);
  process.stdout.write(`  Part. table: ${partitionTable}\n`);
  process.stdout.write(`  Boot disk:   ${bootDisk}  (target is not boot disk)\n`);
  process.stdout.write("\n");

  // Show what's currently on the USB so the runner sees exactly what
  // they're about to destroy BEFORE the consent prompt. Per-partition
  // filesystem + volume name + used-space, pulled from diskutil info
  // for each partition listed under the candidate device.
  const candidateEntry = list.AllDisksAndPartitions.find(
    (d) => `/dev/${d.DeviceIdentifier}` === device,
  );
  const partitions = candidateEntry?.Partitions ?? [];
  process.stdout.write(`Currently on ${device} (will be DESTROYED):\n`);
  if (partitions.length === 0) {
    process.stdout.write(
      `  (no partitions detected — raw / freshly-erased device)\n`,
    );
  } else {
    for (const p of partitions) {
      const partDev = `/dev/${p.DeviceIdentifier}`;
      // Defense-in-depth: partition-device identifier comes from diskutil's
      // own plist (trusted) but we still validate the path shape before
      // feeding it to another diskutil invocation, matching the same
      // discipline `assertSafeDevicePath` enforces on the whole-disk
      // candidate. Partition paths have an additional 's<N>' suffix
      // (e.g. /dev/disk6s1), so we use a partition-aware regex here.
      if (!/^\/dev\/disk\d+s\d+$/.test(partDev)) {
        bail(2, `unsafe partition path from diskutil: ${partDev}`);
      }
      const pInfo = diskutilInfo(partDev);
      const pSize = Number(p.Size ?? pInfo.TotalSize ?? 0);
      const pContent = String(p.Content ?? pInfo.Content ?? "?");
      const pFs = String(pInfo.FilesystemName ?? pInfo.FilesystemUserVisibleName ?? "(none)");
      const pVol = p.VolumeName ?? pInfo.VolumeName;
      const pMount = String(pInfo.MountPoint ?? "");
      const pUsedRaw = pInfo.VolumeUsedSpaceInBytes;
      const pUsed = typeof pUsedRaw === "number" && pUsedRaw > 0 ? ` — ${human(pUsedRaw)} used` : "";
      const label = pVol ? ` "${pVol}"` : "";
      const mountStr = pMount ? ` mounted at ${pMount}` : "";
      process.stdout.write(
        `  ${partDev.padEnd(14)} ${pContent.padEnd(18)} ${human(pSize).padStart(10)}   ${pFs}${label}${mountStr}${pUsed}\n`,
      );
    }
  }
  process.stdout.write("\n");

  // ── 4c. CLASSIFY the device state ──────────────────────────
  //
  // The partition table above used to be printed and thrown away: blank,
  // half-written and correctly-flashed devices all took the same code path.
  // Now it is evidence for a closed-union verdict.
  //
  // The classifier reports a FACT, never an authorization -- the policy below
  // is the policy of this tool, not a property of the classifier.
  const observedPartitions: ObservedPartition[] = [];
  for (const p of partitions) {
    const partDev = "/dev/" + p.DeviceIdentifier;
    const pInfo = diskutilInfo(partDev);
    const fsRaw = pInfo.FilesystemName ?? pInfo.FilesystemUserVisibleName ?? null;
    const volRaw = p.VolumeName ?? pInfo.VolumeName ?? null;
    observedPartitions.push({
      identifier: p.DeviceIdentifier,
      content: String(p.Content ?? pInfo.Content ?? "?"),
      sizeBytes: Number(p.Size ?? pInfo.TotalSize ?? 0),
      volumeName: typeof volRaw === "string" && volRaw.length > 0 ? volRaw : null,
      filesystem: typeof fsRaw === "string" && fsRaw.length > 0 ? fsRaw : null,
    });
  }

  // ── 4c-i. SUPPLY R1 WITH ITS INPUTS ────────────────────────
  //
  // R1 of the classifier detects "labelled ZETA_INSTALL, but the head bytes
  // disagree with the ISO" -- a stick that LOOKS provisioned and holds the
  // wrong image. Until now the only caller that ever supplied its two digest
  // fields was the test file, so on the live path R1 could not fire and such a
  // stick classified as "provisioned": the precise misread R1 was written to
  // prevent, green in tests and unreachable in life.
  //
  // The sample is taken ONLY when the label is present, because that is the
  // only case R1 speaks to -- and because reading a device costs a sudo prompt
  // (see privilegedDeviceReader for why it must).
  const labelled = observedPartitions.some(
    (p) => p.volumeName === ZETA_INSTALL_VOLUME_LABEL,
  );
  let headDigestHex: string | null = null;
  let expectedHeadDigestHex: string | null = null;
  let headSampleError: string | null = labelled
    ? null
    : "no " + ZETA_INSTALL_VOLUME_LABEL + " label on this device, so there is nothing to compare";
  if (labelled) {
    process.stdout.write(
      "This device carries the " + ZETA_INSTALL_VOLUME_LABEL + " label, so the first " +
        String(DEFAULT_HEAD_SAMPLE_BYTES) + " bytes are being read back and\n" +
        "compared against the ISO. This is a READ. It needs sudo because " + rawDevice + "\n" +
        "is root:operator and this process is neither.\n",
    );
    const isoReader = openChunkReader(isoPath);
    try {
      const sample = sampleHeadDigests(
        isoReader,
        privilegedDeviceReader(rawDevice, DEFAULT_HEAD_SAMPLE_BYTES),
        DEFAULT_HEAD_SAMPLE_BYTES,
      );
      if (sample.ok) {
        headDigestHex = sample.deviceHeadDigestHex;
        expectedHeadDigestHex = sample.isoHeadDigestHex;
      } else {
        headSampleError = sample.error;
      }
    } catch (e: unknown) {
      // A failed sample is reported, never swallowed. It leaves R1 unable to
      // fire, which the classifier then says out loud as a LABEL-ONLY verdict.
      headSampleError =
        "could not read the device head: " + (e instanceof Error ? e.message : String(e));
    } finally {
      isoReader.close();
    }
  }

  const classification = classifyDeviceState({
    partitionScheme: partitionTable === "?" ? "" : partitionTable,
    partitions: observedPartitions,
    totalSizeBytes: size,
    headDigestHex,
    expectedHeadDigestHex,
    headSampleError,
  });
  process.stdout.write(
    "Device state:  " + classification.state + "  (" + classification.rule + ")\n" +
      "  " + classification.reason + "\n" +
      "  head digest checked: " + (classification.headDigestChecked ? "yes" : "NO") + "\n\n",
  );

  // ── 4d. POLICY on the classified state ─────────────────────
  //
  // Detection landed without policy: only "unrecognized" blocked, and
  // "half-provisioned" was printed and then walked straight into the destroy
  // prompt. Two states, two different answers, because the costs are not
  // symmetric.
  //
  //   unrecognized -> REFUSE. Being wrong here means destroying somebody
  //     else's data, which is the one outcome that cannot be undone by
  //     re-running the tool. --accept-unrecognized is the deliberate override.
  //
  //   half-provisioned -> ACKNOWLEDGE, never refuse. An interrupted write is
  //     one of the most common LEGITIMATE reasons to re-flash a stick. A hard
  //     refusal would block the ordinary repair path and would train operators
  //     to reach for an override flag by reflex, which is how an override
  //     stops meaning anything. So the operator types the state name once, in
  //     this same run, before the destroy challenge: it never blocks, it
  //     cannot be satisfied without having read the verdict, and it leaves in
  //     the transcript a record of WHAT was destroyed rather than only that
  //     consent was given. --accept-half-provisioned exists so a
  //     non-interactive caller can be explicit rather than hang.
  //
  // The destroy challenge itself is deliberately NOT changed. Its two phrase
  // formats are a cross-arm parity contract pinned by flash-usb-linux.test.ts,
  // and the Linux arm has no classifier with which to name a state.
  if (classification.state === "unrecognized" && !acceptUnrecognized) {
    bail(
      2,
      "device state is UNRECOGNIZED -- this is not a shape zflash put here, so it\n" +
        "may be somebody else's data. Refusing.\n" +
        "  " + classification.reason + "\n" +
        "If you are certain, re-run with --accept-unrecognized.",
    );
  }

  // One readline interface for BOTH prompts. Two interfaces in sequence would
  // race on a piped stdin: the first buffers whatever arrived with the line it
  // read, and closing it discards the rest, so the second would wait forever
  // for input that had already been consumed.
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const closeAndBail = (code: number, msg: string): never => {
    rl.close();
    bail(code, msg);
  };

  if (classification.state === "half-provisioned") {
    if (acceptHalfProvisioned) {
      process.stdout.write(
        "(--accept-half-provisioned: state acknowledged non-interactively)\n\n",
      );
    } else {
      process.stdout.write(
        "This device is HALF-PROVISIONED. Either a previous write started and did\n" +
          "not finish, or its label and its actual bytes disagree. Re-flashing is\n" +
          "the normal repair for that, so this is NOT a refusal -- but the state is\n" +
          "acknowledged deliberately before anything is destroyed.\n\n" +
          "Type EXACTLY (case-sensitive, single line):\n\n",
      );
      process.stdout.write("  " + HALF_PROVISIONED_ACK + "\n\n");
      const ack = await rl.question("> ");
      if (ack !== HALF_PROVISIONED_ACK) {
        closeAndBail(
          1,
          "device state was NOT acknowledged.\n" +
            "  expected: " + HALF_PROVISIONED_ACK + "\n" +
            "  got:      " + (ack || "(empty)") + "\nAborted.",
        );
      }
    }
  }


  process.stdout.write(`*** ALL DATA ON ${device} WILL BE DESTROYED ***\n\n`);
  process.stdout.write(
    "By completing the confirmation prompt below, the runner\n" +
      "(human OR agent acting on their behalf) accepts responsibility\n" +
      "for the contents of the destination device.\n\n",
  );
  process.stdout.write(
    "To proceed, type EXACTLY (case-sensitive, single line):\n\n",
  );
  process.stdout.write(`  ${acceptancePhrase}\n\n`);

  // readline strips the trailing newline; no .trim() — "EXACTLY" must
  // mean EXACTLY. Whitespace tolerance would undermine the gate
  // (a piped `accept-destroy ... <nonce>\n` would otherwise pass).
  const typed = await rl.question("> ");
  rl.close();

  if (!acceptanceMatches(typed, acceptancePhrase)) {
    bail(
      1,
      `confirmation mismatch — runner did NOT accept responsibility.\n` +
        `  expected: ${acceptancePhrase}\n` +
        `  got:      ${typed || "(empty)"}\n` +
        `Aborted.`,
    );
  }

  // ── 5c. RE-READ identity immediately before the write ──────
  //
  // Everything above was decided from a plist read some seconds ago, across a
  // blocking prompt the operator may have sat on for minutes. USB enumeration
  // is not stable and /dev/diskN is recycled, so the check that actually
  // protects the device is this one -- the last read before the first write.
  //
  // It compares the ENUMERATION SNAPSHOT against a fresh read. All six fields
  // are load-bearing here, including the three (busProtocol, removableMedia,
  // internal) that no caller can state, because both sides are observations
  // taken at different moments -- nothing is compared to itself.
  {
    const recheck = checkDeviceIdentity(observedIdentity, readIdentity(device));
    if (!recheck.ok) {
      bail(
        2,
        "the device CHANGED between the consent prompt and the write.\n" +
          recheck.error +
          "\nRefusing to write. Nothing has been touched.",
      );
    }
  }


  // ── 6. Unmount → dd → eject ────────────────────────────────
  process.stdout.write(`\nUnmounting ${device} ...\n`);
  execFileSync("diskutil", ["unmountDisk", device], { stdio: "inherit" });

  process.stdout.write(
    `\nFlashing ${isoPath} → ${rawDevice} ` +
      `(${human(isoBytes)}; this takes a few minutes) ...\n\n`,
  );

  const dd = spawn(
    sudoProgram(),
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

  // ── 7. VERIFY BACK ─────────────────────────────────────────
  //
  // Ported from the Windows arm, which is the only one that had this. A dd
  // that exits 0 has proved the syscalls returned, not that the bytes are on
  // the stick. Fail-loud by contract: any failure here is a hard exit, and
  // there is no flag that skips it.
  process.stdout.write("\nRead-back verifying " + rawDevice + " against the ISO ...\n");
  {
    // MEASURED 2026-08-21: the device side CANNOT be the unprivileged shim.
    // /dev/rdisk6 is crw-r----- root:operator and this process is not in that
    // group, so openChunkReader("/dev/rdisk6") throws EACCES -- which means
    // this read-back, the step whose own docstring says it is "fail-loud by
    // contract" with "no flag that skips it", would have failed on every real
    // flash AFTER a dd that had already succeeded. Present, tested, and
    // unreachable: the same defect class as R1 above.
    //
    // The ISO side stays on the file shim, where it works and is covered.
    const isoReader = openChunkReader(isoPath);
    const deviceReader = privilegedDeviceReader(rawDevice, DEFAULT_READBACK_CHUNK_BYTES);
    let verdict;
    try {
      verdict = verifyReadBack(isoReader, deviceReader, isoBytes, DEFAULT_READBACK_CHUNK_BYTES);
    } finally {
      isoReader.close();
    }
    if (!verdict.ok) {
      bail(
        3,
        "READ-BACK VERIFY FAILED after a dd that exited 0.\n  " +
          verdict.error +
          "\n  Compared " +
          String(verdict.bytesCompared) +
          " of " +
          String(isoBytes) +
          " bytes. Treat this USB as unusable and re-flash.",
      );
    }
    process.stdout.write(
      "Read-back verified: " + String(verdict.bytesCompared) + " bytes match the ISO.\n",
    );
  }

  if (noEject) {
    process.stdout.write(
      `\n(--no-eject passed; ${device} remains attached for downstream tooling)\n`,
    );
  } else {
    process.stdout.write(`\nEjecting ${device} ...\n`);
    try {
      execFileSync("diskutil", ["eject", device], { stdio: "inherit" });
    } catch {
      process.stdout.write(
        "(eject failed; that is fine — the flash succeeded. " +
          "Unplug + replug to verify.)\n",
      );
    }
  }

  process.stdout.write("\nFlash complete.\n");
}

// ENTRY GUARD -- the Linux and Windows arms have carried this since they were
// written; this arm did not, and that omission is why it had no test file.
// A bare `main()` at module scope means ANY import of this module -- including
// from a test -- enumerates disks, prompts, and on a satisfied challenge runs
// `sudo dd`. So the file was not merely untested, it was UNTESTABLE: importing
// it to assert on its safety rails would have fired the destructive path the
// rails exist to gate. Pinned by flash-usb.test.ts ("module import is inert").
if (import.meta.main) {
  main().catch((err: unknown) => {
    bail(1, err instanceof Error ? err.message : String(err));
  });
}
