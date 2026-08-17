/**
 * USB iSerial probe — USB-IDENTITY-THREAT-MODEL §4.
 *
 * Reads Linux sysfs (`/sys/bus/usb/devices/<bus>-<port>/serial`) through
 * injected I/O so QEMU and unit tests can supply a fake tree. Skips hubs
 * and interface nodes. Fails closed when zero or more than one serial
 * is present (ambiguous stick). Not the default persist path. No metal claim.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";

export const USB_SYSFS_DEVICES_DIR = "/sys/bus/usb/devices" as const;

/** USB hub class (skip; root hubs are not the installer stick). */
const USB_CLASS_HUB = "09";

export const USB_ISERIAL_SERIAL = {
  found: "[usb-iserial] probed USB iSerial on sysfs mass-storage device",
  missing: "[usb-iserial] no USB iSerial in sysfs; factor unavailable",
  ambiguous: "[usb-iserial] multiple USB serials in sysfs; refuse to guess",
  noMetalClaim: "[usb-iserial] probe-only; QEMU-injectable; no physical-stick claim",
  helperUnavailable: "[usb-iserial] probe helper unavailable (bun/runtime missing); factor not probed",
  helperAbsent: "[usb-iserial] probe helper absent; skipping",
  persistDefaultUuid: "[usb-iserial] persist-default remains --usb-uuid",
  persistOptInIserial: "[usb-iserial] persist-opt-in --usb-iserial (ZETA_BIND_USB_ISERIAL=1)",
  persistOptInFallbackUuid:
    "[usb-iserial] persist-opt-in requested but probe failed; staying --usb-uuid",
} as const;

export type UsbSysfsDevice = {
  readonly dirName: string;
  readonly serial: string | null;
  readonly manufacturer: string | null;
  readonly product: string | null;
  readonly deviceClass: string | null;
};

export type UsbISerialProbeResult =
  | { readonly ok: true; readonly serial: string; readonly dirName: string }
  | { readonly ok: false; readonly error: string; readonly marker: string };

export type UsbSysfsIo = {
  readonly readDir: (dir: string) => readonly string[];
  readonly readFile: (path: string) => string | null;
};

function trimOrNull(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.replace(/\r?\n$/u, "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Interface nodes look like `1-1:1.0`; skip them. */
export function isUsbDeviceDirName(name: string): boolean {
  if (name.includes(":")) return false;
  if (/^usb\d+$/u.test(name)) return false;
  return /^\d+-\d+(?:\.\d+)*$/u.test(name);
}

export function readUsbSysfsDevice(
  devicesDir: string,
  dirName: string,
  readFile: (path: string) => string | null,
): UsbSysfsDevice {
  const base = `${devicesDir.replace(/\/+$/u, "")}/${dirName}`;
  return {
    dirName,
    serial: trimOrNull(readFile(`${base}/serial`)),
    manufacturer: trimOrNull(readFile(`${base}/manufacturer`)),
    product: trimOrNull(readFile(`${base}/product`)),
    deviceClass: trimOrNull(readFile(`${base}/bDeviceClass`)),
  };
}

export function isUsbHub(device: UsbSysfsDevice): boolean {
  return device.deviceClass === USB_CLASS_HUB;
}

/**
 * Pick the unique non-hub device that has a serial. Ambiguity is a hard miss.
 */
export function selectUniqueUsbISerial(
  devices: readonly UsbSysfsDevice[],
): UsbISerialProbeResult {
  const candidates = devices.filter((d) => !isUsbHub(d) && d.serial !== null);
  if (candidates.length === 0) {
    return { ok: false, error: "no USB iSerial in sysfs", marker: USB_ISERIAL_SERIAL.missing };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      error: `ambiguous USB iSerial (${String(candidates.length)} devices)`,
      marker: USB_ISERIAL_SERIAL.ambiguous,
    };
  }
  const chosen = candidates[0]!;
  return { ok: true, serial: chosen.serial!, dirName: chosen.dirName };
}

export function probeUsbISerial(
  io: UsbSysfsIo,
  devicesDir: string = USB_SYSFS_DEVICES_DIR,
): UsbISerialProbeResult {
  let names: readonly string[];
  try {
    names = io.readDir(devicesDir);
  } catch {
    return { ok: false, error: "usb sysfs devices dir unreadable", marker: USB_ISERIAL_SERIAL.missing };
  }
  const devices: UsbSysfsDevice[] = [];
  for (const name of names) {
    if (!isUsbDeviceDirName(name)) continue;
    devices.push(readUsbSysfsDevice(devicesDir, name, io.readFile));
  }
  return selectUniqueUsbISerial(devices);
}

export function usbISerialValueMarker(serial: string): string {
  return `[usb-iserial] serial=${serial}`;
}

/** Serial-log lines the guest installer prints. No metal / Touch ID / TPM claim. */
export function formatUsbISerialReport(result: UsbISerialProbeResult): readonly string[] {
  if (result.ok) {
    return [USB_ISERIAL_SERIAL.found, usbISerialValueMarker(result.serial), USB_ISERIAL_SERIAL.noMetalClaim];
  }
  return [result.marker, USB_ISERIAL_SERIAL.noMetalClaim];
}

export function createNodeUsbSysfsIo(): UsbSysfsIo {
  return {
    readDir: (dir) => readdirSync(dir),
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return null;
      }
    },
  };
}

function parseProbeCliArgs(
  argv: readonly string[],
): { readonly sysfsDir: string; readonly serialFile: string | null } | { readonly error: string } {
  // Annotated `string`, not inferred: `USB_SYSFS_DEVICES_DIR` is `as const`, so inference would
  // narrow this to the literal `"/sys/bus/usb/devices"` and `--sysfs-dir` could never assign to it.
  let sysfsDir: string = USB_SYSFS_DEVICES_DIR;
  let serialFile: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--sysfs-dir") {
      if (i + 1 >= argv.length) return { error: "--sysfs-dir requires a path" };
      sysfsDir = argv[++i]!;
    } else if (arg === "--serial-file") {
      if (i + 1 >= argv.length) return { error: "--serial-file requires a path" };
      serialFile = argv[++i]!;
    } else {
      return { error: `unknown flag: ${arg}` };
    }
  }
  return { sysfsDir, serialFile };
}

export type ProbeCliWriteFile = (path: string, contents: string) => void;

function defaultProbeCliWriteFile(path: string, contents: string): void {
  writeFileSync(path, contents, "utf8");
}

export function runUsbISerialProbeCli(
  argv: readonly string[],
  io: UsbSysfsIo = createNodeUsbSysfsIo(),
  writeFile: ProbeCliWriteFile = defaultProbeCliWriteFile,
): { readonly exitCode: number; readonly lines: readonly string[] } {
  const parsed = parseProbeCliArgs(argv);
  if ("error" in parsed) {
    return { exitCode: 2, lines: [`usb-iserial-probe: ${parsed.error}`] };
  }
  const result = probeUsbISerial(io, parsed.sysfsDir);
  if (result.ok && parsed.serialFile !== null) {
    writeFile(parsed.serialFile, result.serial);
  }
  return { exitCode: 0, lines: formatUsbISerialReport(result) };
}

if (import.meta.main) {
  const ran = runUsbISerialProbeCli(process.argv.slice(2));
  for (const line of ran.lines) {
    console.log(line);
  }
  process.exit(ran.exitCode);
}
