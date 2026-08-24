#!/usr/bin/env bun
// src/Core.TypeScript/zflash/flash-usb-linux.ts — the Linux arm of the safety-railed
// installer-ISO → USB flasher (081M037KPG1087G0R0005ANAFV, recovered from B0738).
//
// WHY THIS FILE EXISTS
//
// `flash-usb.ts` refuses on anything that is not darwin and prints a `dd` command for the
// operator to run by hand:
//
//     lsblk; sudo dd if=<iso> of=/dev/<device> bs=4M status=progress conv=fsync
//
// That printed line has NONE of the safety the macOS path has. It does not check the bus,
// it does not check that the target is not the boot disk, it does not check the size, and
// it asks for no runtime consent — the operator types a device name from memory into a
// command that destroys whatever is behind it. The Windows arm (`flash-usb-windows.ts`)
// was built; the Linux arm was dropped, and Linux is the cluster-node OS.
//
// THE RAILS, mirrored from the macOS and Windows arms:
//   - ISO must exist, be a file, end in `.iso`, and be within [200 MiB, 8 GiB]
//   - target must be a whole disk (`type == "disk"`), not a partition
//   - target must be on the USB transport (`tran == "usb"`) — not merely "removable"
//   - target must not be read-only
//   - target must be within [4 GiB, 256 GiB]
//   - target must not host `/`, `/boot`, or `/boot/efi`, and must not be the disk backing
//     the root filesystem
//   - exactly ONE candidate must survive; zero or two is a refusal, never a guess
//   - a fresh random nonce must be typed back at runtime, so the answer cannot be pre-baked
//
// THE GATE: DEGRADE, NEVER BYPASS
//
// The privileged write goes through `sudo` or `pkexec`, so it goes through PAM, so a
// configured `pam_fprintd.so` gets its chance. What this file will NOT do is claim that a
// fingerprint happened. `sudo` and `pkexec` report their own exit status and never name
// the module that satisfied PAM, and on every mainstream Linux stack `pam_unix.so` sits in
// the same chain as `pam_fprintd.so` — so the honest reading of a successful escalation is
// `unattributed`, exactly as it is on the stock macOS stack
// (081M06DSQ0Q087G0R000H91391). `planEscalation` therefore reports what the chain CAN
// establish, computed from the resolved chain by the shared parser, and the readout prints
// that rather than the mechanism it attempted.
//
// The fallback is a fallback, not a hole: where fingerprint hardware is absent or nothing
// is enrolled, the plan degrades to the same mechanism WITHOUT the biometric claim, and
// the operator authenticates with a password. There is no path in this file that skips
// authentication, and none that adds a NOPASSWD rule.
//
// TESTABILITY (manifesto §13 noninterference)
//
// Everything above the `main()` line is pure and exported: `lsblk` JSON in, decision out;
// PAM files in, plan out. `flash-usb-linux.test.ts` runs the whole decision surface on ANY
// OS with no USB stick, no root, and no finger on a sensor.
//
// Implementation note: every subprocess call uses execFileSync/spawn in argv-array form —
// never shell interpolation. Device paths reaching an argv come from `lsblk`'s own JSON
// and are re-validated against a whitelist shape before use.

import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { platform } from "node:os";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { analyzePamAuthChain, type PamAuthChainAnalysis } from "../pam/auth-chain.ts";
import { establishIsoIntegrity, realIsoIntegrityIo } from "./iso-integrity.ts";

// ── Bounds — one contract, three hosts, and now literally one definition ─────────

import { MAX_ISO_BYTES, MAX_USB_BYTES, MIN_ISO_BYTES, MIN_USB_BYTES } from "./size-bounds.ts";
import { resolveElevator, resolveElevatorPathOrThrow } from "../privilege/elevator.ts";
export { MAX_ISO_BYTES, MAX_USB_BYTES, MIN_ISO_BYTES, MIN_USB_BYTES };

/** Mount points that mark a disk as the running system's. Hosting any of these is fatal. */
export const SYSTEM_MOUNTPOINTS: readonly string[] = ["/", "/boot", "/boot/efi", "/efi", "/nix/store"];

/** The module whose exclusivity would license the word "biometric" on Linux. */
export const FPRINTD_MODULE = "pam_fprintd.so";

/** PAM services consulted for the fingerprint gate, one per escalation mechanism. */
// zeta-elevator-not-argv: a PAM service name (the basename under /etc/pam.d), never a program to spawn.
export const SUDO_PAM_SERVICE = "sudo";
export const POLKIT_PAM_SERVICE = "polkit-1";

export function human(bytes: number): string {
  const u = ["B", "KiB", "MiB", "GiB", "TiB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(2)} ${u[i] ?? "B"}`;
}

// ── lsblk enumeration (pure) ─────────────────────────────────────────────────────────────

/** Columns requested from `lsblk`. Order is not significant — output is keyed JSON. */
export const LSBLK_COLUMNS =
  "NAME,PATH,SIZE,TYPE,TRAN,RM,RO,HOTPLUG,MODEL,VENDOR,SERIAL,MOUNTPOINTS,MOUNTPOINT,PTTYPE,FSTYPE,LABEL";

/** `lsblk` argv. `--bytes` so sizes are numbers, not "14.9G" strings we would have to parse. */
export function lsblkArgv(): readonly string[] {
  return ["--json", "--bytes", "--paths", "--output", LSBLK_COLUMNS];
}

export interface LinuxBlockDevice {
  readonly name: string;
  readonly path: string;
  readonly sizeBytes: number;
  /** `disk`, `part`, `loop`, `rom`, … */
  readonly type: string;
  /** Transport: `usb`, `nvme`, `sata`, … Empty when lsblk cannot determine one. */
  readonly transport: string;
  readonly removable: boolean;
  readonly readOnly: boolean;
  readonly hotplug: boolean;
  readonly model: string;
  readonly vendor: string;
  readonly serial: string;
  readonly partitionTable: string;
  readonly fsType: string;
  readonly label: string;
  /** Every mount point on this node — `MOUNTPOINTS` (util-linux ≥ 2.37) or `MOUNTPOINT`. */
  readonly mountpoints: readonly string[];
  readonly children: readonly LinuxBlockDevice[];
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return 0;
}

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  // Anything else (an object lsblk never emits in these columns) has no useful string
  // form — "" is honest where "[object Object]" would look like a device attribute.
  return "";
}

/**
 * Normalize the `mountpoints` / `mountpoint` field.
 *
 * util-linux ≥ 2.37 emits `"mountpoints": ["/boot/efi"]`, and an UNMOUNTED node as
 * `[null]` — a one-element array whose element is null. Older releases emit a scalar
 * `"mountpoint": null`. Reading `[null]` as "one mount point" would make every unmounted
 * partition look mounted; reading only the scalar form would make a mounted `/` on a
 * modern host look unmounted, which is the direction that destroys a boot disk.
 */
function asMountpoints(plural: unknown, singular: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(plural)) {
    for (const m of plural) {
      const s = asString(m);
      if (s !== "") out.push(s);
    }
  }
  const one = asString(singular);
  if (one !== "" && !out.includes(one)) out.push(one);
  return out;
}

function toDevice(raw: unknown): LinuxBlockDevice {
  const o = (raw ?? {}) as Record<string, unknown>;
  const name = asString(o.name);
  return {
    name,
    // `--paths` makes lsblk emit absolute paths in `name` too, but older releases keyed
    // the absolute form under `path`; fall back to /dev/<name> rather than emit "".
    path: asString(o.path) || (name.startsWith("/") ? name : `/dev/${name}`),
    sizeBytes: asNumber(o.size),
    type: asString(o.type),
    transport: asString(o.tran).toLowerCase(),
    removable: o.rm === true || asString(o.rm) === "1",
    readOnly: o.ro === true || asString(o.ro) === "1",
    hotplug: o.hotplug === true || asString(o.hotplug) === "1",
    model: asString(o.model),
    vendor: asString(o.vendor),
    serial: asString(o.serial),
    partitionTable: asString(o.pttype),
    fsType: asString(o.fstype),
    label: asString(o.label),
    mountpoints: asMountpoints(o.mountpoints, o.mountpoint),
    children: Array.isArray(o.children) ? o.children.map(toDevice) : [],
  };
}

/** Parse `lsblk --json …` output into the top-level device list (children nested). */
export function parseLsblkJson(jsonText: string): LinuxBlockDevice[] {
  const parsed: unknown = JSON.parse(jsonText);
  const list = (parsed as { blockdevices?: unknown }).blockdevices;
  if (!Array.isArray(list)) return [];
  return list.map(toDevice);
}

/** Every mount point on a device or any of its descendants. */
export function allMountpoints(device: LinuxBlockDevice): string[] {
  return [...device.mountpoints, ...device.children.flatMap(allMountpoints)];
}

/**
 * Device paths this file is willing to put in an argv. Whitelisted by SHAPE even though
 * `lsblk` produced them — the same belt-and-suspenders the macOS arm applies to `diskutil`
 * output. Whole disks only; a partition path is rejected here by construction.
 */
/** Whole-disk kernel node names, one anchored pattern per naming scheme. */
const WHOLE_DISK_NAMES: readonly RegExp[] = [
  /^sd[a-z]{1,2}$/,
  /^vd[a-z]{1,2}$/,
  /^hd[a-z]{1,2}$/,
  /^nvme\d+n\d+$/,
  /^mmcblk\d+$/,
];

/** Partition node names. Kept explicit because the suffix differs by scheme: `sda1` but
 *  `nvme0n1p2` — a shared "strip trailing digits" rule turns `nvme0n1` into `nvme0n`. */
const PARTITION_NAMES: readonly RegExp[] = [
  /^sd[a-z]{1,2}\d+$/,
  /^vd[a-z]{1,2}\d+$/,
  /^hd[a-z]{1,2}\d+$/,
  /^nvme\d+n\d+p\d+$/,
  /^mmcblk\d+p\d+$/,
];

/** The node name under `/dev`, or null when the path is not a direct child of `/dev`.
 *  The alphanumeric constraint is what rejects `..`, nested paths and shell metacharacters. */
function devNodeName(path: string): string | null {
  if (!path.startsWith("/dev/")) return null;
  const name = path.slice("/dev/".length);
  return /^[a-z0-9]+$/.test(name) ? name : null;
}

export function isSafeWholeDiskPath(path: string): boolean {
  const name = devNodeName(path);
  return name !== null && WHOLE_DISK_NAMES.some((re) => re.test(name));
}

/**
 * Whether a device spec names a bare kernel block node (whole disk or partition) that the
 * `lsblk` tree can be searched for. Device-mapper (`/dev/mapper/vg-root`, `/dev/dm-0`),
 * MD RAID, LUKS holders and ZFS datasets are NOT — they resolve to underlying nodes this
 * file does not trace, so a root sitting on one cannot be located here.
 */
function isResolvableDeviceSpec(path: string): boolean {
  const name = devNodeName(path);
  if (name === null) return false;
  return [...WHOLE_DISK_NAMES, ...PARTITION_NAMES].some((re) => re.test(name));
}

/**
 * Whether `rootSource` (as reported by `findmnt -n -o SOURCE /`) sits on `device`.
 *
 * Matching is on the device tree, not on string prefixes: `/dev/sda` is NOT the parent of
 * `/dev/sdaa`, and a prefix test would say it was. An unresolvable root source (an LVM
 * mapper path, a btrfs subvolume spec, a ZFS dataset) returns TRUE — a root we cannot
 * locate is a root that might be here, and the guard fails closed.
 */
export function hostsRootFilesystem(device: LinuxBlockDevice, rootSource: string): boolean {
  const src = rootSource.trim();
  if (src === "") return true; // unknown root ⇒ treat every disk as suspect
  const bare = src.split("[")[0] ?? src; // strip a btrfs `[/subvol]` suffix
  // A spec we cannot trace to a kernel block node (LVM/dm, MD, LUKS, ZFS, a UUID= form)
  // is a root that MIGHT be on this disk, so the guard fails closed.
  if (!isResolvableDeviceSpec(bare)) return true;
  if (bare === device.path) return true;
  const nodes: LinuxBlockDevice[] = [device, ...device.children.flatMap((c) => [c, ...c.children])];
  return nodes.some((n) => n.path === bare);
}

export type Selection =
  | { readonly ok: true; readonly device: LinuxBlockDevice }
  | { readonly ok: false; readonly code: 1 | 2; readonly message: string };

export interface SelectionContext {
  /** `findmnt -n -o SOURCE /` output. Empty ⇒ unknown ⇒ every disk is treated as suspect. */
  readonly rootSource: string;
}

function describe(d: LinuxBlockDevice): string {
  const id = [d.vendor, d.model].filter((s) => s !== "").join(" ") || "?";
  return `  ${d.path}  ${human(d.sizeBytes)}  ${id}  tran=${d.transport || "?"} type=${d.type} ro=${String(d.readOnly)}`;
}

/**
 * Apply the rails and pick exactly one USB target. Refuses on zero and on two or more —
 * the operator isolates the target by unplugging the others, the tool never guesses.
 */
export function selectUsbCandidate(
  devices: readonly LinuxBlockDevice[],
  context: SelectionContext,
): Selection {
  const candidates = devices.filter(
    (d) =>
      d.type === "disk" &&
      d.transport === "usb" &&
      !d.readOnly &&
      d.sizeBytes >= MIN_USB_BYTES &&
      d.sizeBytes <= MAX_USB_BYTES &&
      isSafeWholeDiskPath(d.path) &&
      !allMountpoints(d).some((m) => SYSTEM_MOUNTPOINTS.includes(m)) &&
      !hostsRootFilesystem(d, context.rootSource),
  );
  if (candidates.length === 0) {
    const seen = devices.map(describe).join("\n");
    return {
      ok: false,
      code: 2,
      message:
        `no eligible USB target found (need: type=disk, tran=usb, not read-only, size in ` +
        `[${human(MIN_USB_BYTES)}, ${human(MAX_USB_BYTES)}], hosting none of ` +
        `${SYSTEM_MOUNTPOINTS.join(" ")}, and not backing the root filesystem).\n` +
        `Devices seen:\n${seen || "  (none)"}`,
    };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      code: 2,
      message:
        `multiple USB candidates — refusing to pick one. Unplug all but the target and re-run:\n` +
        candidates.map(describe).join("\n"),
    };
  }
  const only = candidates[0];
  if (only === undefined) throw new Error("unreachable: candidate count was checked to be 1");
  return { ok: true, device: only };
}

// ── ISO validation + the runtime consent challenge (pure) ────────────────────────────────

export type IsoCheck = { readonly ok: true } | { readonly ok: false; readonly message: string };

export function validateIso(isoPath: string, sizeBytes: number, isFile: boolean): IsoCheck {
  if (!isoPath.toLowerCase().endsWith(".iso")) {
    return { ok: false, message: `expected a *.iso file, got: ${isoPath}` };
  }
  if (!isFile) return { ok: false, message: `ISO path is not a file: ${isoPath}` };
  if (sizeBytes < MIN_ISO_BYTES || sizeBytes > MAX_ISO_BYTES) {
    return {
      ok: false,
      message: `ISO size ${human(sizeBytes)} outside sane range [${human(MIN_ISO_BYTES)}, ${human(MAX_ISO_BYTES)}]`,
    };
  }
  return { ok: true };
}

/** Long form — device path + 8-hex nonce, matching flash-usb.ts's default challenge. */
export function buildLongChallenge(devicePath: string, nonceHex8: string): string {
  if (!/^[0-9a-f]{8}$/.test(nonceHex8)) throw new Error(`nonce must be 8 lowercase hex chars, got: ${nonceHex8}`);
  return `accept-destroy ${devicePath} ${nonceHex8}`;
}

/** Short form — 4-hex nonce, matching flash-usb.ts `--short`. */
export function buildShortChallenge(nonceHex4: string): string {
  if (!/^[0-9a-f]{4}$/.test(nonceHex4)) throw new Error(`nonce must be 4 lowercase hex chars, got: ${nonceHex4}`);
  return `yes ${nonceHex4}`;
}

/** Fresh per run: a nonce the runner has to OBSERVE, so no answer can be pre-baked. */
export function makeNonce(short: boolean, rand: (n: number) => Buffer = randomBytes): string {
  return rand(short ? 2 : 4).toString("hex");
}

// ── The escalation gate: which mechanism, and what it can honestly establish ─────────────

/** What `fprintd-list` says about the operator's enrolled fingerprints. */
export type FprintdEnrollment = "enrolled" | "none-enrolled" | "no-device" | "unknown";

/**
 * Read `fprintd-list <user>`. Conservative: anything unrecognised is `unknown`, and
 * `unknown` never counts as enrolled — an unread enrollment state must not license a
 * fingerprint claim.
 */
export function parseFprintdList(output: string): FprintdEnrollment {
  const text = output.toLowerCase();
  if (text.includes("no devices available") || text.includes("found 0 devices")) return "no-device";
  if (text.includes("has no fingers enrolled")) return "none-enrolled";
  // fprintd prints one ` - #<n>: <finger-name>` line per enrolled finger. Quantifiers are
  // bounded: the indent is cosmetic and an unbounded `\s*-\s*` is a backtracking shape.
  if (/^[ \t]{0,8}-[ \t]{0,4}#\d+:/m.test(output)) return "enrolled";
  return "unknown";
}

export type EscalationMechanism = "sudo" | "pkexec";

/** What the chosen mechanism's resolved PAM chain can establish about the factor used. */
export type EscalationFactor = "biometric" | "unattributed";

export interface EscalationInputs {
  readonly sudoAvailable: boolean;
  readonly pkexecAvailable: boolean;
  /** Resolved `auth` chain of /etc/pam.d/sudo, analyzed for `pam_fprintd.so`. */
  readonly sudoChain: PamAuthChainAnalysis;
  /** Resolved `auth` chain of /etc/pam.d/polkit-1, analyzed for `pam_fprintd.so`. */
  readonly polkitChain: PamAuthChainAnalysis;
  readonly enrollment: FprintdEnrollment;
  /** Whether stdin is a TTY. `sudo`'s password fallback needs one; `pkexec` does not. */
  readonly hasTty: boolean;
}

export type EscalationPlan =
  | {
      readonly ok: true;
      readonly mechanism: EscalationMechanism;
      /** Whether `pam_fprintd.so` is in the chosen mechanism's chain AND a finger is enrolled. */
      readonly fingerprintOffered: boolean;
      /** What a success through this mechanism would ESTABLISH — never rounded up. */
      readonly factor: EscalationFactor;
      /** Operator-facing sentence explaining the choice and the limit of its claim. */
      readonly rationale: string;
    }
  | { readonly ok: false; readonly message: string };

interface MechanismOption {
  readonly mechanism: EscalationMechanism;
  /** The PAM service whose chain this mechanism authenticates against. */
  readonly pamService: string;
  readonly chain: PamAuthChainAnalysis;
  readonly usable: boolean;
  readonly unusableReason: string;
}

/**
 * Choose the escalation mechanism and state honestly what it can establish.
 *
 * ORDER: a mechanism that actually offers the fingerprint outranks one that does not, and
 * ties break toward `sudo` — the mechanism the macOS arm already uses, and the one whose
 * prompt appears in the terminal the operator is looking at.
 *
 * DEGRADE, NEVER BYPASS: when no chain offers a fingerprint, the plan still escalates and
 * the operator authenticates with a password. `ok:false` is returned only when there is no
 * authenticated path AT ALL — never as a reason to proceed unauthenticated.
 *
 * The `factor` is `biometric` only where `pam_fprintd.so` is the sole module in the
 * resolved chain that could have satisfied the transaction. On every mainstream Linux
 * stack `pam_unix.so` shares that chain, so the truthful answer is `unattributed`, and
 * this function says so rather than printing the mechanism as though it were the factor.
 */
export function planEscalation(inputs: EscalationInputs): EscalationPlan {
  const enrolled = inputs.enrollment === "enrolled";
  const options: readonly MechanismOption[] = [
    {
      mechanism: "sudo",
      pamService: SUDO_PAM_SERVICE,
      chain: inputs.sudoChain,
      usable: inputs.sudoAvailable && inputs.hasTty,
      unusableReason: !inputs.sudoAvailable
        ? "sudo is not on PATH"
        : "stdin is not a TTY, so sudo has nowhere to prompt (an agent-run shell)",
    },
    {
      mechanism: "pkexec",
      pamService: POLKIT_PAM_SERVICE,
      chain: inputs.polkitChain,
      usable: inputs.pkexecAvailable,
      unusableReason: "pkexec is not on PATH",
    },
  ];
  const usable = options.filter((o) => o.usable);
  if (usable.length === 0) {
    return {
      ok: false,
      message:
        "no authenticated privilege-escalation path is available — refusing to continue.\n" +
        options.map((o) => `  ${o.mechanism}: ${o.unusableReason}`).join("\n") +
        "\nThis is a refusal, NOT a reason to run dd unprivileged or to add a NOPASSWD rule.",
    };
  }

  // A mechanism that actually offers the fingerprint outranks one that does not; `usable`
  // is non-empty by the guard above, so the fallback element always exists.
  const chosen = usable.find((o) => enrolled && o.chain.targetConfigured) ?? usable[0];
  if (chosen === undefined) throw new Error("unreachable: usable mechanisms were checked non-empty");
  const fingerprintOffered = enrolled && chosen.chain.targetConfigured;
  const factor: EscalationFactor =
    fingerprintOffered && chosen.chain.targetIsOnlySatisfier ? "biometric" : "unattributed";

  let rationale: string;
  if (!fingerprintOffered) {
    const why = !enrolled
      ? `fprintd reports ${inputs.enrollment.replace("-", " ")}`
      : `${FPRINTD_MODULE} is absent from the resolved /etc/pam.d/${chosen.pamService} auth chain`;
    rationale =
      `escalating with ${chosen.mechanism}; no fingerprint gate is available here (${why}), ` +
      "so the operator authenticates with a password. The gate degraded — it did not open.";
  } else if (factor === "biometric") {
    rationale =
      `escalating with ${chosen.mechanism}; ${FPRINTD_MODULE} is the only module in the resolved ` +
      "auth chain that could satisfy it, so a success here IS attributable to the fingerprint.";
  } else {
    const competing = [
      ...chosen.chain.competingEntries,
      ...chosen.chain.unresolvedIncludes.map((s) => `include ${s} (unreadable — chain unknown)`),
    ].join(", ");
    rationale =
      `escalating with ${chosen.mechanism}; the fingerprint will be OFFERED, but ${competing} ` +
      `share the same auth chain and ${chosen.mechanism} does not report which module satisfied ` +
      "PAM. Approval is real; that it was a BIOMETRIC is not observable at this seam.";
  }
  return { ok: true, mechanism: chosen.mechanism, fingerprintOffered, factor, rationale };
}

/**
 * Build the escalated argv.
 *
 * `commandPath` must be ABSOLUTE: `pkexec` resolves its polkit action against the program
 * path, and an absolute path also removes the PATH-shadowing question for both mechanisms.
 * `sudo --` terminates option parsing so a device path can never be read as a flag;
 * `pkexec` has no such terminator and is given the resolved path directly.
 */
export function escalationArgv(
  mechanism: EscalationMechanism,
  commandPath: string,
  args: readonly string[],
  elevatorPath: string,
): string[] {
  if (!commandPath.startsWith("/")) {
    throw new Error(`escalation requires an absolute command path, got: ${commandPath}`);
  }
  // The ELEVATOR must be absolute for the same reason the target command is, and the
  // reason is sharper: an elevator resolved by name is substitutable by any writable
  // directory earlier on `PATH`, which is the P1 in docs/BUGS.md (2026-08-24). The caller
  // gets it from `resolveElevator`, which additionally requires root ownership, the setuid
  // bit, and no group/other write. This parameter is REQUIRED rather than defaulted so a
  // future call site cannot silently reacquire the PATH lookup by omitting it.
  if (!elevatorPath.startsWith("/")) {
    throw new Error(`escalation requires an absolute elevator path, got: ${elevatorPath}`);
  }
  return mechanism === "sudo"
    ? [elevatorPath, "--", commandPath, ...args]
    : [elevatorPath, commandPath, ...args];
}

/** GNU `dd` arguments. `conv=fsync` makes the exit status mean the bytes reached the device. */
export function ddArgs(isoPath: string, devicePath: string): string[] {
  if (!isSafeWholeDiskPath(devicePath)) throw new Error(`unsafe device path: ${devicePath}`);
  return [`if=${isoPath}`, `of=${devicePath}`, "bs=4M", "conv=fsync", "status=progress"];
}

/**
 * Mount points that must be unmounted before the write, innermost first.
 *
 * Deepest-first matters: unmounting `/media/u/data` before its parent `/media/u` is the
 * only order that succeeds when one is nested inside the other.
 */
export function unmountTargets(device: LinuxBlockDevice): string[] {
  return [...new Set(allMountpoints(device))].sort((a, b) => b.split("/").length - a.split("/").length);
}

// ── Host effects (the only place this file touches the outside world) ────────────────────

export interface LinuxFlashEffects {
  readonly readFile: (path: string) => string;
  readonly runCapture: (argv: readonly string[]) => string;
  /** Absolute path of a program on PATH, or null when it is not installed. */
  readonly which: (program: string) => string | null;
  readonly isTty: () => boolean;
  readonly currentUser: () => string;
}

// ── CLI (imperative shell; every decision above is pure and already tested) ──────────────

function bail(code: number, msg: string): never {
  process.stderr.write(`flash-usb-linux: ${msg}\n`);
  process.exit(code);
}

function realEffects(): LinuxFlashEffects {
  return {
    // Throws on an absent file — an unreadable policy is an UNKNOWN chain, never an empty one.
    readFile: (p) => readFileSync(p, "utf8"),
    runCapture: (argv) => runCapture(argv),
    which: (program) => {
      try {
        // `command -v` is POSIX and, unlike `which`, is not an optional package. The
        // program name arrives as a positional ($1), never interpolated into the script.
        const out = execFileSync("/bin/sh", ["-c", 'command -v -- "$1"', "sh", program], {
          encoding: "utf8",
        }).trim();
        return out.startsWith("/") ? out : null;
      } catch {
        return null;
      }
    },
    isTty: () => stdin.isTTY,
    currentUser: () => process.env.SUDO_USER ?? process.env.USER ?? "",
  };
}

/** Run an argv array and capture stdout. Empty argv is a programming error, not input. */
function runCapture(argv: readonly string[]): string {
  const [program, ...rest] = argv;
  if (program === undefined) throw new Error("runCapture: empty argv");
  return execFileSync(program, rest, { encoding: "utf8" });
}

/** Run an argv array with inherited stdio. Returns the exit status. */
function runInherit(argv: readonly string[]): void {
  const [program, ...rest] = argv;
  if (program === undefined) throw new Error("runInherit: empty argv");
  execFileSync(program, rest, { stdio: "inherit" });
}

function readEnrollment(fx: LinuxFlashEffects): FprintdEnrollment {
  const fprintdList = fx.which("fprintd-list");
  if (fprintdList === null) return "no-device";
  try {
    return parseFprintdList(fx.runCapture([fprintdList, fx.currentUser()]));
  } catch {
    // fprintd-list exits non-zero when no device is present; the message is on stderr and
    // execFileSync throws. Unknown, not enrolled.
    return "unknown";
  }
}

function chainFor(fx: LinuxFlashEffects, service: string): PamAuthChainAnalysis {
  return analyzePamAuthChain(fx.readFile, {
    service,
    targetModule: FPRINTD_MODULE,
    syntax: "linux-pam",
    // Distributions ship pam_fprintd under a bracketed control flag (`[success=2
    // default=ignore]`) as often as under `sufficient`; both short-circuit the chain on
    // success, and neither is accepted implicitly — they are listed.
    targetControlFlags: ["sufficient", "[success=1 default=ignore]", "[success=2 default=ignore]", "[success=3 default=ignore]"],
  });
}

interface ParsedArgs {
  readonly isoPath: string;
  readonly useShort: boolean;
  readonly dryRun: boolean;
}

/**
 * Parse argv against a strict flag ALLOWLIST. Silently accepting an unknown flag on a
 * destructive tool is how a typo'd `--dry-run` proceeds to a real write.
 */
function parseArgs(argv: readonly string[]): ParsedArgs {
  const ALLOWED_FLAGS = new Set(["--short", "--dry-run", "-h", "--help"]);
  const rawFlags = argv.filter((a) => a.startsWith("-"));
  const positional = argv.filter((a) => !a.startsWith("-"));
  const unknown = rawFlags.filter((f) => !ALLOWED_FLAGS.has(f));
  if (unknown.length > 0) {
    bail(
      2,
      `unknown flag(s): ${unknown.join(", ")}\nAllowed: ${[...ALLOWED_FLAGS].join(", ")}\n` +
        "Refusing to proceed — a destructive tool requires an exact flag match.",
    );
  }
  const flags = new Set(rawFlags);
  const wantsHelp = flags.has("-h") || flags.has("--help");
  const isoPath = positional[0];
  if (wantsHelp || positional.length !== 1 || isoPath === undefined) {
    process.stdout.write(
      "Usage: bun src/Core.TypeScript/zflash/flash-usb-linux.ts [--short] [--dry-run] <path-to-iso>\n" +
        "  --short     shorter `yes <4-hex>` challenge\n" +
        "  --dry-run   run every check and print the plan; never writes and never escalates\n",
    );
    process.exit(wantsHelp ? 0 : 2);
  }
  return { isoPath, useShort: flags.has("--short"), dryRun: flags.has("--dry-run") };
}

/** Print the full identification block the operator reads BEFORE the consent prompt. */
function printReadout(target: LinuxBlockDevice, rootSource: string, plan: EscalationPlan & { ok: true }): void {
  const identity = [target.vendor, target.model].filter((s) => s !== "").join(" ") || "?";
  const lines = [
    "",
    "USB device identified:",
    `  Device:      ${target.path}`,
    `  Model:       ${identity}`,
    `  Serial:      ${target.serial || "?"}`,
    `  Size:        ${human(target.sizeBytes)}`,
    `  Transport:   ${target.transport}`,
    `  Removable:   ${String(target.removable)}`,
    `  Part. table: ${target.partitionTable || "(none)"}`,
    `  Root source: ${rootSource || "(unknown)"}  (target does not back it)`,
    `  Escalation:  ${plan.mechanism}`,
    `  Factor:      ${plan.factor}`,
    `  Rationale:   ${plan.rationale}`,
    "",
    `Currently on ${target.path} (will be DESTROYED):`,
  ];
  if (target.children.length === 0) {
    lines.push("  (no partitions detected — raw / freshly-erased device)");
  } else {
    for (const p of target.children) {
      const mounts = p.mountpoints.length > 0 ? ` mounted at ${p.mountpoints.join(", ")}` : "";
      const label = p.label !== "" ? ` "${p.label}"` : "";
      lines.push(
        `  ${p.path.padEnd(16)} ${(p.fsType || "(none)").padEnd(10)} ${human(p.sizeBytes).padStart(10)}${label}${mounts}`,
      );
    }
  }
  process.stdout.write(`${lines.join("\n")}\n\n`);
}

/** The runtime acceptance gate. Returns only when the runner typed the challenge EXACTLY. */
async function requireTypedConsent(target: LinuxBlockDevice, useShort: boolean): Promise<void> {
  const nonce = makeNonce(useShort);
  const phrase = useShort ? buildShortChallenge(nonce) : buildLongChallenge(target.path, nonce);
  process.stdout.write(
    `*** ALL DATA ON ${target.path} WILL BE DESTROYED ***\n\n` +
      "By completing the confirmation prompt below, the runner (human OR agent acting on\n" +
      "their behalf) accepts responsibility for the contents of the destination device.\n\n" +
      "To proceed, type EXACTLY (case-sensitive, single line):\n\n" +
      `  ${phrase}\n\n`,
  );
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const typed = await rl.question("> ");
  rl.close();
  // No .trim() — "EXACTLY" must mean EXACTLY, or a piped answer slips through.
  if (typed !== phrase) {
    bail(
      1,
      "confirmation mismatch — runner did NOT accept responsibility.\n" +
        `  expected: ${phrase}\n  got:      ${typed || "(empty)"}\nAborted.`,
    );
  }
}

/** Release every mount on the target, deepest first, through the chosen escalation. */
function unmountAll(
  fx: LinuxFlashEffects,
  target: LinuxBlockDevice,
  mechanism: EscalationMechanism,
  elevatorPath: string,
): void {
  const targets = unmountTargets(target);
  if (targets.length === 0) return;
  const umount = fx.which("umount");
  if (umount === null) bail(2, `umount is not on PATH but ${targets.join(", ")} is mounted; refusing`);
  for (const mountpoint of targets) {
    process.stdout.write(`Unmounting ${mountpoint} ...\n`);
    try {
      runInherit(escalationArgv(mechanism, umount, [mountpoint], elevatorPath));
    } catch {
      bail(2, `failed to unmount ${mountpoint}; refusing to write to a mounted device`);
    }
  }
}

/** Read the root filesystem's backing device. Unknown on any failure — never guessed. */
function readRootSource(fx: LinuxFlashEffects): string {
  const findmnt = fx.which("findmnt");
  if (findmnt === null) return "";
  try {
    return fx.runCapture([findmnt, "-n", "-o", "SOURCE", "/"]).trim();
  } catch {
    return ""; // unknown ⇒ hostsRootFilesystem treats every disk as suspect
  }
}

async function main(): Promise<void> {
  const { isoPath, useShort, dryRun } = parseArgs(process.argv.slice(2));

  if (platform() !== "linux") bail(2, `this script only supports Linux; running on ${platform()}`);

  const fx = realEffects();

  if (!existsSync(isoPath)) bail(2, `ISO file does not exist: ${isoPath}`);
  const isoStat = statSync(isoPath);
  const isoCheck = validateIso(isoPath, isoStat.size, isoStat.isFile());
  if (!isoCheck.ok) bail(2, isoCheck.message);
  process.stdout.write(`ISO: ${isoPath} (${human(isoStat.size)})\n`);

  // ── VERIFY BEFORE WRITE ──────────────────────────────────────────────
  //
  // validateIso above establishes the ISO's SIZE and nothing else. Until
  // 081M0HG7X7B087G0R002A05DAP this arm stopped there, so on Linux zflash
  // wrote whatever bytes were at that path to a block device. The gate is
  // the same one the macOS arm runs, imported rather than copied, and it
  // fails CLOSED: no manifest beside the ISO is a refusal, never a pass.
  //
  // Placed before lsblk so a refusal costs the operator nothing and no
  // device is so much as enumerated.
  {
    const integrity = await establishIsoIntegrity(isoPath, realIsoIntegrityIo());
    if (!integrity.ok) bail(2, integrity.message);
    process.stdout.write(integrity.report);
  }

  const lsblkPath = fx.which("lsblk");
  if (lsblkPath === null) bail(2, "lsblk is not on PATH (install util-linux)");
  const devices = parseLsblkJson(fx.runCapture([lsblkPath, ...lsblkArgv()]));

  const rootSource = readRootSource(fx);

  const selection = selectUsbCandidate(devices, { rootSource });
  if (!selection.ok) bail(selection.code, selection.message);
  const target = selection.device;

  const plan = planEscalation({
    // Availability is decided by the SAME resolver that execution will use, so the plan
    // and the spawn cannot disagree. `fx.which` was used here before and is the wrong
    // question: it reports what `PATH` says, and `PATH` is a value the attacker controls.
    sudoAvailable: resolveElevator("sudo").ok,
    pkexecAvailable: resolveElevator("pkexec").ok,
    sudoChain: chainFor(fx, SUDO_PAM_SERVICE),
    polkitChain: chainFor(fx, POLKIT_PAM_SERVICE),
    enrollment: readEnrollment(fx),
    hasTty: fx.isTty(),
  });
  if (!plan.ok) bail(2, plan.message);

  printReadout(target, rootSource, plan);

  if (dryRun) {
    process.stdout.write("--dry-run: no consent prompt, no escalation, no write. Plan above.\n");
    return;
  }

  await requireTypedConsent(target, useShort);
  // Resolve the chosen elevator ONCE, by absolute path, and use the same one for the
  // unmounts and for the write — resolving twice would leave a window in which they
  // differ, and resolving by name would leave the PATH-shim hole this closes.
  const elevatorPath = resolveElevatorPathOrThrow(plan.mechanism);
  unmountAll(fx, target, plan.mechanism, elevatorPath);

  const ddPath = fx.which("dd");
  if (ddPath === null) bail(2, "dd is not on PATH (install coreutils)");
  const [ddProgram, ...ddRest] = escalationArgv(plan.mechanism, ddPath, ddArgs(isoPath, target.path), elevatorPath);
  if (ddProgram === undefined) bail(1, "internal: escalationArgv produced an empty argv");
  process.stdout.write(`\nFlashing ${isoPath} → ${target.path} (${human(isoStat.size)}) ...\n`);
  process.stdout.write(`${plan.rationale}\n\n`);
  const child = spawn(ddProgram, ddRest, { stdio: "inherit" });
  const code: number = await new Promise<number>((res) => {
    child.on("close", (c) => {
      res(c ?? 1);
    });
  });
  if (code !== 0) bail(code, `dd exited ${String(code)}; a partial flash may be on the device.`);

  process.stdout.write("\nFlash complete.\n");
  process.stdout.write(`Approval factor established: ${plan.factor}\n`);
}

if (import.meta.main) {
  main().catch((err: unknown) => bail(1, err instanceof Error ? err.message : String(err)));
}
