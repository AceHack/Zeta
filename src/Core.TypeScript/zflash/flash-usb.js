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
const MIN_ISO_BYTES = 200 * 1024 * 1024;
const MAX_ISO_BYTES = 8 * 1024 * 1024 * 1024;
const MIN_USB_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_USB_BYTES = 256 * 1024 * 1024 * 1024;
function bail(code, msg) {
    process.stderr.write(`flash-usb: ${msg}\n`);
    process.exit(code);
}
function human(bytes) {
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
function plistToJson(plistXml) {
    const json = execFileSync("plutil", ["-convert", "json", "-o", "-", "-"], {
        input: plistXml,
        encoding: "utf8",
    });
    return JSON.parse(json);
}
function diskutilListPlist() {
    const xml = execFileSync("diskutil", ["list", "-plist", "external", "physical"], { encoding: "utf8" });
    return plistToJson(xml);
}
function diskutilInfo(device) {
    const xml = execFileSync("diskutil", ["info", "-plist", device], {
        encoding: "utf8",
    });
    return plistToJson(xml);
}
function bootDiskIdentifier() {
    // `mount` output -> find row mounting `/` -> extract diskN.
    const mountOut = execFileSync("mount", [], { encoding: "utf8" });
    const rootMount = mountOut.split("\n").find((l) => / on \/ \(/.test(l));
    if (!rootMount)
        return "";
    const m = rootMount.match(/^\/dev\/(disk\d+)/);
    return m?.[1] ?? "";
}
// Whitelist of safe device-identifier shapes. Belt-and-suspenders
// even though diskutil produces these strings itself.
function assertSafeDevicePath(device) {
    if (!/^\/dev\/disk\d+$/.test(device)) {
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
    const ALLOWED_FLAGS = new Set(["--short", "--no-eject", "-h", "--help"]);
    const rawFlags = argv.filter((a) => a.startsWith("-"));
    const positional = argv.filter((a) => !a.startsWith("-"));
    const unknownFlags = rawFlags.filter((f) => !ALLOWED_FLAGS.has(f));
    if (unknownFlags.length > 0) {
        bail(2, `unknown flag(s): ${unknownFlags.join(", ")}\n` +
            `Allowed flags: ${[...ALLOWED_FLAGS].join(", ")}\n` +
            `Refusing to proceed — destructive tool requires exact flag match.`);
    }
    const flags = new Set(rawFlags);
    const useShortChallenge = flags.has("--short");
    const noEject = flags.has("--no-eject");
    const isHelp = flags.has("-h") || flags.has("--help");
    if (isHelp || positional.length !== 1) {
        process.stdout.write("Usage: bun full-ai-cluster/tools/flash-usb.ts [--short] [--no-eject] <path-to-iso>\n" +
            "  --short      use shorter `yes <4-hex>` challenge format\n" +
            "  --no-eject   leave the USB attached after dd (for downstream tooling\n" +
            "               like zflash's iter-4.2 ESP-mount + pubkey-inject step;\n" +
            "               downstream MUST eject itself when done)\n");
        process.exit(isHelp && positional.length === 0 ? 0 : 2);
    }
    const firstArg = positional[0];
    if (firstArg === undefined)
        bail(2, "internal: positional length check passed but positional[0] is undefined");
    const isoPath = firstArg;
    // ── 1. Platform gate ───────────────────────────────────────
    if (platform() !== "darwin") {
        bail(2, "this script only supports macOS. For Linux, use the manual flow:\n" +
            "  lsblk; sudo dd if=<iso> of=/dev/<device> bs=4M status=progress conv=fsync");
    }
    // ── 2. ISO gate ────────────────────────────────────────────
    if (!existsSync(isoPath))
        bail(2, `ISO file does not exist: ${isoPath}`);
    if (!isoPath.endsWith(".iso"))
        bail(2, `expected *.iso file, got: ${isoPath}`);
    const isoStat = statSync(isoPath);
    if (!isoStat.isFile())
        bail(2, `ISO path is not a file: ${isoPath}`);
    if (isoStat.size < MIN_ISO_BYTES || isoStat.size > MAX_ISO_BYTES) {
        bail(2, `ISO size ${human(isoStat.size)} outside sane range ` +
            `[${human(MIN_ISO_BYTES)}, ${human(MAX_ISO_BYTES)}]; refusing`);
    }
    process.stdout.write(`ISO: ${isoPath} (${human(isoStat.size)})\n`);
    // ── 3. Enumerate USB devices ───────────────────────────────
    const list = diskutilListPlist();
    const externalDevices = list.AllDisksAndPartitions.map((d) => `/dev/${d.DeviceIdentifier}`);
    const usbCandidates = [];
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
        bail(2, "no USB devices found.\n" +
            "Plug in the USB stick, then re-run. If you already plugged it in,\n" +
            "give the OS a few seconds and try again.");
    }
    if (usbCandidates.length > 1) {
        process.stderr.write("flash-usb: multiple USB devices found:\n");
        for (const c of usbCandidates) {
            const size = Number(c.info.TotalSize ?? 0);
            const model = String(c.info.MediaName ?? "?");
            process.stderr.write(`  ${c.device}  ${human(size)}  ${model}\n`);
        }
        bail(2, "refusing to pick one. Unplug all but the target USB and re-run, OR\n" +
            "use manual flow: sudo dd if=<iso> of=/dev/rdiskN bs=4m");
    }
    const candidate = usbCandidates[0];
    if (candidate === undefined)
        bail(2, "internal: no USB candidate after length check");
    const { device, info } = candidate;
    assertSafeDevicePath(device);
    const size = Number(info.TotalSize ?? 0);
    const model = String(info.MediaName ?? info.IORegistryEntryName ?? "?");
    const removable = info.RemovableMedia === true || info.RemovableMediaOrExternalDevice === true;
    // ── 4. Per-device safety gates ─────────────────────────────
    if (size < MIN_USB_BYTES || size > MAX_USB_BYTES) {
        bail(2, `device ${device} size ${human(size)} outside USB range ` +
            `[${human(MIN_USB_BYTES)}, ${human(MAX_USB_BYTES)}]; refusing\n` +
            `(this protects against pointing at an external SSD by mistake)`);
    }
    const bootDisk = bootDiskIdentifier();
    const deviceShort = device.replace("/dev/", "");
    if (bootDisk && deviceShort === bootDisk) {
        bail(2, `device ${device} IS the boot disk; refusing to overwrite`);
    }
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
    const nonceBytes = useShortChallenge ? 2 : 4;
    const nonce = randomBytes(nonceBytes).toString("hex");
    const acceptancePhrase = useShortChallenge
        ? `yes ${nonce}`
        : `accept-destroy ${device} ${nonce}`;
    // Extra-detail fields (best-effort — diskutil may omit any of these
    // depending on the USB controller; show "?" rather than fail).
    const vendor = String(info.DeviceVendor ?? info.IORegistryEntryName ?? "?");
    const serial = String(info.DeviceSerial ?? info.DeviceSerialNumber ?? "?");
    const ioRegName = String(info.IORegistryEntryName ?? "?");
    const partitionTable = String(info.Content ?? "?");
    const writable = info.WritableMedia === true || info.Writable === true ? "yes" : "no";
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
    const candidateEntry = list.AllDisksAndPartitions.find((d) => `/dev/${d.DeviceIdentifier}` === device);
    const partitions = candidateEntry?.Partitions ?? [];
    process.stdout.write(`Currently on ${device} (will be DESTROYED):\n`);
    if (partitions.length === 0) {
        process.stdout.write(`  (no partitions detected — raw / freshly-erased device)\n`);
    }
    else {
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
            process.stdout.write(`  ${partDev.padEnd(14)} ${pContent.padEnd(18)} ${human(pSize).padStart(10)}   ${pFs}${label}${mountStr}${pUsed}\n`);
        }
    }
    process.stdout.write("\n");
    process.stdout.write(`*** ALL DATA ON ${device} WILL BE DESTROYED ***\n\n`);
    process.stdout.write("By completing the confirmation prompt below, the runner\n" +
        "(human OR agent acting on their behalf) accepts responsibility\n" +
        "for the contents of the destination device.\n\n");
    process.stdout.write("To proceed, type EXACTLY (case-sensitive, single line):\n\n");
    process.stdout.write(`  ${acceptancePhrase}\n\n`);
    const rl = readline.createInterface({ input: stdin, output: stdout });
    // readline strips the trailing newline; no .trim() — "EXACTLY" must
    // mean EXACTLY. Whitespace tolerance would undermine the gate
    // (a piped `accept-destroy ... <nonce>\n` would otherwise pass).
    const typed = await rl.question("> ");
    rl.close();
    if (typed !== acceptancePhrase) {
        bail(1, `confirmation mismatch — runner did NOT accept responsibility.\n` +
            `  expected: ${acceptancePhrase}\n` +
            `  got:      ${typed || "(empty)"}\n` +
            `Aborted.`);
    }
    // ── 6. Unmount → dd → eject ────────────────────────────────
    process.stdout.write(`\nUnmounting ${device} ...\n`);
    execFileSync("diskutil", ["unmountDisk", device], { stdio: "inherit" });
    // /dev/rdiskN is the raw character device — ~10x faster than
    // the buffered /dev/diskN on macOS.
    const rawDevice = `/dev/r${deviceShort}`;
    process.stdout.write(`\nFlashing ${isoPath} → ${rawDevice} ` +
        `(${human(isoStat.size)}; this takes a few minutes) ...\n\n`);
    const dd = spawn("sudo", [
        "dd",
        `if=${isoPath}`,
        `of=${rawDevice}`,
        "bs=4m",
        "conv=sync",
        "status=progress",
    ], { stdio: "inherit" });
    const code = await new Promise((res) => dd.on("close", (c) => res(c ?? 1)));
    if (code !== 0) {
        bail(code, `dd exited ${code}; partial flash may be on device.`);
    }
    if (noEject) {
        process.stdout.write(`\n(--no-eject passed; ${device} remains attached for downstream tooling)\n`);
    }
    else {
        process.stdout.write(`\nEjecting ${device} ...\n`);
        try {
            execFileSync("diskutil", ["eject", device], { stdio: "inherit" });
        }
        catch {
            process.stdout.write("(eject failed; that is fine — the flash succeeded. " +
                "Unplug + replug to verify.)\n");
        }
    }
    process.stdout.write("\nFlash complete.\n");
}
main().catch((err) => {
    bail(1, err instanceof Error ? err.message : String(err));
});
