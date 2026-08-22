import { describe, expect, it } from "bun:test";
import { selectCliBindingMaterial } from "./installer-binding-cli.ts";
import {
  QEMU_USB_STORAGE_SERIAL,
  QEMU_USB_TEST_SERIAL,
  qemuUsbSerialError,
  qemuUsbStorageDeviceArg,
} from "./qemu-usb-storage.ts";
import { probeUsbISerial } from "./usb-iserial-probe.ts";

describe("qemu-usb-storage", () => {
  it("markers do not claim physical metal", () => {
    expect(QEMU_USB_STORAGE_SERIAL.noMetalClaim).toContain("no physical-stick claim");
    expect(QEMU_USB_STORAGE_SERIAL.guestVisible).toContain("not host sysfs");
  });

  it("default device arg carries the guest-visible test serial", () => {
    const planned = qemuUsbStorageDeviceArg("zflashboot");
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.serial).toBe(QEMU_USB_TEST_SERIAL);
    expect(planned.device).toBe(
      `usb-storage,bus=xhci.0,drive=zflashboot,bootindex=1,serial=${QEMU_USB_TEST_SERIAL}`,
    );
  });

  it("refuses empty or boundary-whitespace serial rather than emitting it", () => {
    expect(qemuUsbSerialError("")).not.toBeNull();
    expect(qemuUsbSerialError(" ZETA-QEMU-001")).not.toBeNull();
    expect(qemuUsbSerialError("ZETA-QEMU-001 ")).not.toBeNull();
    expect(qemuUsbStorageDeviceArg("stick", "")).toMatchObject({ ok: false });
  });

  it("refuses comma and equals — they split QEMU -device parsing", () => {
    expect(qemuUsbSerialError("A,B")).not.toBeNull();
    expect(qemuUsbSerialError("A=B")).not.toBeNull();
  });

  it("the default serial is legal persist binding material", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: null,
      usbISerial: QEMU_USB_TEST_SERIAL,
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("usbISerial");
    expect(selected.material).toBe(QEMU_USB_TEST_SERIAL);
  });

  it("the probe accepts the same bytes the QEMU device would present in guest sysfs", () => {
    const io = {
      readDir: () => ["usb1", "1-1", "1-1:1.0"],
      readFile: (path: string) => {
        if (path.endsWith("/1-1/serial")) return `${QEMU_USB_TEST_SERIAL}\n`;
        if (path.endsWith("/1-1/bDeviceClass")) return "00\n";
        if (path.endsWith("/usb1/bDeviceClass")) return "09\n";
        return null;
      },
    };
    const probed = probeUsbISerial(io, "/sys/bus/usb/devices");
    expect(probed.ok).toBe(true);
    if (!probed.ok) return;
    expect(probed.serial).toBe(QEMU_USB_TEST_SERIAL);
  });
});
