/**
 * linux-arm.ts — the Linux wiring for the zflash WRAPPER (081M037KPG1087G0R0005ANAFV).
 *
 * ## Why the wrapper could not simply be ported verb-for-verb
 *
 * `cli.ts`'s ESP pubkey-injection step is diskutil-shaped: flash → settle → rescan
 * external disks → find the FAT partition → `diskutil mount` (or `sudo mount_msdos`) →
 * `sudo tee` into the mount point → unmount → `diskutil eject`. Every verb in that chain
 * is macOS-only, and the obvious port (`lsblk` → `mount -t vfat` → write → `umount`)
 * would introduce a SECOND wrong-target surface: choosing a partition on a
 * freshly-written device and mounting it as root. `flash-usb-linux.ts` already spent its
 * whole design budget guaranteeing we write to the right disk; re-opening that question
 * one step later, against a device whose partition table the kernel has just re-read, is
 * the opposite of what this arm is for.
 *
 * ## What this file does instead — bake first, then flash, never mount
 *
 * The ESP writes are baked into a keyed COPY of the ISO *before* the device write, with
 * the mount-free `qemu-img` + `mtools` pipeline that `lib.ts`'s
 * `planFileBackedZflashImage` / `planFileBackedZflashImageExecution` already drive for
 * the file-backed (QEMU) path. `mcopy -i <image>@@<espOffset>` writes straight into the
 * FAT ESP at a byte offset — no loop mount, no partition selection, no root, and it
 * behaves identically on Linux and macOS.
 *
 * This is also the fix the WINDOWS arm already landed for its own reasons
 * (`flash-and-inject.ts`, 2026-06-14): inject into the file before the raw write, never
 * into the device afterward. Windows was forced there by handle invalidation; Linux is
 * choosing it because it deletes a destructive-target decision. Same shape, and it is
 * the third platform to arrive at it.
 *
 * The device write is then delegated to `flash-usb-linux.ts` **unchanged**. Every
 * wrong-disk rail (`type=disk`, `tran=usb`, not read-only, size bounds, no system mount
 * point, not backing `/`, exactly one surviving candidate) and the `pam_fprintd` gate
 * apply exactly as they do when that arm is run by hand. **This file contains no
 * device-selection logic of its own, by design** — read that as an invariant, not a
 * convenience: nothing here narrows, widens or second-guesses `selectUsbCandidate`.
 *
 * Everything above the effects seam is pure and unit-tested with no ISO, no USB stick,
 * no `qemu-img`, no `mtools` and no root.
 */

import { isPhysicalDevicePath } from "./lib.ts";

/** The sibling script that owns the destructive write and every rail guarding it. */
export const LINUX_FLASH_SCRIPT_BASENAME = "flash-usb-linux.ts";

/**
 * The Linux arm's ENTIRE flag allowlist, mirrored here so the wrapper cannot emit an
 * argv the arm will reject.
 *
 * This is not redundant bookkeeping — it is the specific bug this constant exists to
 * prevent. The macOS wrapper builds `[flashUsb, "--short", "--no-eject", isoPath]`, and
 * `--no-eject` does NOT exist on the Linux arm (macOS needs it because the wrapper
 * mounts the ESP after the flash; the Linux arm has nothing to keep attached). Reusing
 * the macOS argv would make every Linux flash die at the child's own allowlist with
 * "unknown flag(s): --no-eject" — after the operator had already been told a flash was
 * starting. `flashUsbLinuxArgv` checks its own output against this set.
 */
export const LINUX_FLASH_ALLOWED_FLAGS: readonly string[] = ["--short", "--dry-run", "-h", "--help"];

export type LinuxArgvResult =
  | { readonly ok: true; readonly argv: readonly string[] }
  | { readonly ok: false; readonly error: string };

export interface LinuxFlashArgvOptions {
  /** Shorter `yes <4-hex>` challenge. The wrapper has always used the short form. */
  readonly short?: boolean;
  /** Run every check and print the plan; never writes, never escalates. */
  readonly dryRun?: boolean;
}

/**
 * Build the argv handed to `bun` for the Linux flash arm.
 *
 * The ISO path is passed as the sole positional. It is rejected when it begins with `-`:
 * the child splits argv on that character alone (`argv.filter((a) => a.startsWith("-"))`),
 * so a path like `-rf.iso` would be read as a flag, fail the allowlist, and — more to the
 * point — a path-shaped flag reaching a destructive tool is exactly the class of input
 * that must never be resolved by guessing.
 */
export function flashUsbLinuxArgv(
  scriptPath: string,
  isoPath: string,
  options: LinuxFlashArgvOptions = {},
): LinuxArgvResult {
  const script = scriptPath.trim();
  if (script.length === 0) return { ok: false, error: "scriptPath is required" };
  const iso = isoPath.trim();
  if (iso.length === 0) return { ok: false, error: "isoPath is required" };
  if (iso.startsWith("-")) {
    return {
      ok: false,
      error:
        `ISO path would be parsed as a flag by ${LINUX_FLASH_SCRIPT_BASENAME}: ${iso}\n` +
        "Pass an absolute path (or ./-prefixed form); refusing to guess.",
    };
  }
  if (!iso.toLowerCase().endsWith(".iso")) {
    // The child validates this too. Failing here keeps the message next to the caller
    // that chose the path, instead of surfacing from a spawned process.
    return { ok: false, error: `expected a *.iso path, got: ${iso}` };
  }

  const flags: string[] = [];
  if (options.short === true) flags.push("--short");
  if (options.dryRun === true) flags.push("--dry-run");

  const rejected = flags.filter((f) => !LINUX_FLASH_ALLOWED_FLAGS.includes(f));
  if (rejected.length > 0) {
    return {
      ok: false,
      error: `internal: flag(s) not accepted by ${LINUX_FLASH_SCRIPT_BASENAME}: ${rejected.join(", ")}`,
    };
  }
  return { ok: true, argv: [script, ...flags, iso] };
}

export type LinuxBakedImageResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: string };

export interface LinuxBakedImageInput {
  /** The pristine source ISO. Never written to. */
  readonly isoPath: string;
  /** A caller-created working directory (mkdtemp). */
  readonly workDir: string;
  /** Per-run hex tag, so two concurrent runs cannot collide on one working image. */
  readonly nonceHex: string;
}

/**
 * Derive the path of the keyed working image.
 *
 * Three properties are enforced rather than assumed, because each maps to a way this
 * step could quietly do the wrong thing:
 *
 * 1. **It ends in `.iso`.** `flash-usb-linux.ts`'s `validateIso` refuses anything else,
 *    so a `.img` working copy would bake correctly and then be refused at the flash step
 *    — after the operator had been told the key was injected.
 * 2. **It is never the source ISO.** Baking in place would mutate the operator's cached
 *    download, silently invalidating the freshness/hash checks that decide whether the
 *    next run re-pulls, and permanently keying an artifact that is supposed to be
 *    pristine.
 * 3. **It is not a device path.** A working image is a FILE. `isPhysicalDevicePath` is
 *    reused from `lib.ts` so the file-backed path and this one refuse the same shapes.
 */
export function planLinuxBakedImagePath(input: LinuxBakedImageInput): LinuxBakedImageResult {
  const isoPath = input.isoPath.trim();
  const workDir = input.workDir.trim().replace(/\/+$/, "");
  const nonce = input.nonceHex.trim().toLowerCase();

  if (isoPath.length === 0) return { ok: false, error: "isoPath is required" };
  if (!isoPath.toLowerCase().endsWith(".iso")) {
    return { ok: false, error: `isoPath must end with .iso: ${isoPath}` };
  }
  if (workDir.length === 0) return { ok: false, error: "workDir is required" };
  if (isPhysicalDevicePath(workDir)) {
    return { ok: false, error: `workDir must be a directory, not a device path: ${workDir}` };
  }
  if (!/^[0-9a-f]{4,16}$/.test(nonce)) {
    return { ok: false, error: `nonceHex must be 4-16 lowercase hex chars, got: ${input.nonceHex}` };
  }

  const value = `${workDir}/zflash-keyed-${nonce}.iso`;
  if (isPhysicalDevicePath(value)) {
    return { ok: false, error: `baked image path must be file-backed, not a device path: ${value}` };
  }
  if (value === isoPath) {
    return {
      ok: false,
      error: `baked image path collides with the source ISO (${isoPath}); refusing to bake in place`,
    };
  }
  return { ok: true, value };
}

/**
 * Which ESP payloads this slice can carry on Linux.
 *
 * `pubkey` and `hostname` ride the file-backed planner unchanged. `credentialBlob` is
 * NOT here: `--bake-cred` runs a separate darwin-shaped credential pipeline before the
 * ESP write, and that pipeline has not been ported or tested. It is refused by name
 * rather than ignored — see `linuxWrapperRefusals`.
 */
export interface LinuxWrapperRequest {
  readonly injectPubkey: boolean;
  readonly hostname: string | null;
  readonly bakeCredCount: number;
}

/**
 * Wrapper features with no Linux path in this slice, as operator-facing refusals.
 *
 * An empty array means the request is fully serviceable. A non-empty array must ABORT
 * the run — never proceed with the unsupported part skipped. The failure being designed
 * against is the one where an operator asks for baked credentials, watches a flash
 * succeed, and boots a node that silently has none: "could not do it" and "did it" must
 * not render the same, which is the same discipline the biometric gate follows.
 */
export function linuxWrapperRefusals(request: LinuxWrapperRequest): string[] {
  const refusals: string[] = [];
  if (request.bakeCredCount > 0) {
    refusals.push(
      "--bake-cred has no Linux path yet (the credential-baking pipeline is macOS-shaped). " +
        "Refusing rather than flashing a USB with no credentials on it. " +
        "Track: 081M037KPG1087G0R0005ANAFV.",
    );
  }
  return refusals;
}

/**
 * Whether an ESP bake is needed at all.
 *
 * With `--no-inject` and no `--host` there is nothing to write, so the pristine ISO is
 * flashed directly and the whole `qemu-img`/`mtools` requirement disappears. Asking for
 * those tools in that case would refuse a run that has no reason to fail.
 */
export function linuxBakeIsRequired(request: LinuxWrapperRequest): boolean {
  return request.injectPubkey || (request.hostname !== null && request.hostname.trim().length > 0);
}

export interface LinuxBakeToolAvailability {
  /** Absolute path or null. `qemu-img` makes the writable raw copy of the ISO. */
  readonly qemuImg: string | null;
  /** Absolute path or null. `mcopy` writes into the FAT ESP at a byte offset. */
  readonly mcopy: string | null;
  /** Absolute path or null. `mdir` reads the ESP back to prove the writes landed. */
  readonly mdir: string | null;
}

export type LinuxBakeToolResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

/**
 * Refuse the run when a tool the bake depends on is missing.
 *
 * Fail-closed on purpose. The tempting alternative — flash anyway and warn that the key
 * could not be injected — produces a stick that boots into a node the operator cannot
 * SSH into, discovered only after carrying it to the hardware. `mdir` is required
 * alongside `mcopy` because the file-backed path learned in CI (081KZHJPJCF) that
 * `mcopy` can exit 0 without the file landing; the read-back is what catches the silent
 * drop, so a bake without it is unverified rather than merely unverbose.
 */
export function requireLinuxBakeTools(availability: LinuxBakeToolAvailability): LinuxBakeToolResult {
  const missing: string[] = [];
  if (availability.qemuImg === null) missing.push("qemu-img (package: qemu-utils / qemu-img)");
  if (availability.mcopy === null) missing.push("mcopy (package: mtools)");
  if (availability.mdir === null) missing.push("mdir (package: mtools)");
  if (missing.length === 0) return { ok: true };
  return {
    ok: false,
    error:
      `cannot bake the ESP payload — missing: ${missing.join(", ")}.\n` +
      "Refusing to flash: a stick written without the injected pubkey boots a node you\n" +
      "cannot log into, and you would not find out until it is in the machine.\n" +
      "Install the tools, or re-run with --no-inject to flash a bare ISO deliberately.",
  };
}
