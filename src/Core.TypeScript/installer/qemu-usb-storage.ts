/**
 * QEMU USB mass-storage device argv — guest-visible iSerial.
 *
 * `-device usb-storage,...,serial=X` is what Linux in the guest sees at
 * `/sys/bus/usb/devices/<bus>-<port>/serial`. It is NOT host sysfs; the
 * host probe (`usb-iserial-probe.ts`) still takes an injected tree.
 * No physical-stick / Touch ID / TPM claim.
 *
 * USB-IDENTITY-THREAT-MODEL §4 / §8. Default persist remains FAT UUID.
 */

export const QEMU_USB_TEST_SERIAL = "ZETA-QEMU-001" as const;

export const QEMU_USB_STORAGE_SERIAL = {
  guestVisible: "[qemu-usb-storage] serial= is guest sysfs iSerial, not host sysfs",
  noMetalClaim: "[qemu-usb-storage] QEMU-emulated stick; no physical-stick claim",
} as const;

/**
 * Refuse values that cannot be both QEMU -device parser input AND KDF
 * binding material. Boundary whitespace is persist's to reject; commas
 * and equals break `-device` key=value parsing.
 */
export function qemuUsbSerialError(serial: string): string | null {
  if (serial.length === 0) return "USB serial must be non-empty";
  if (serial !== serial.trim()) {
    return "USB serial must not have leading or trailing whitespace (this value is key material)";
  }
  if (serial.includes(",") || serial.includes("=")) {
    return "USB serial must not contain comma or equals (QEMU -device parser)";
  }
  return null;
}

export function qemuUsbStorageDeviceArg(
  driveId: string,
  serial?: string,
  /**
   * Firmware boot order. Default 1 (the only stick). A SECOND attached stick
   * needs a distinct index, otherwise QEMU refuses the whole command line with
   * "Two devices with same boot index" — which is how the two-stick
   * enumeration smoke would otherwise fail for a reason unrelated to USB.
   */
  bootIndex = 1,
): { readonly ok: true; readonly device: string; readonly serial: string } | { readonly ok: false; readonly error: string } {
  const resolvedSerial = serial ?? QEMU_USB_TEST_SERIAL;
  if (driveId.length === 0) return { ok: false, error: "usb-storage drive id is required" };
  if (driveId.includes(",") || driveId.includes("=")) {
    return { ok: false, error: "usb-storage drive id must not contain comma or equals" };
  }
  if (!Number.isSafeInteger(bootIndex) || bootIndex < 1) {
    return { ok: false, error: "usb-storage bootIndex must be a safe integer >= 1" };
  }
  const serialErr = qemuUsbSerialError(resolvedSerial);
  if (serialErr !== null) return { ok: false, error: serialErr };
  return {
    ok: true,
    serial: resolvedSerial,
    device: `usb-storage,bus=xhci.0,drive=${driveId},bootindex=${String(bootIndex)},serial=${resolvedSerial}`,
  };
}
