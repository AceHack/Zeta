import { describe, expect, it } from "bun:test";
import {
  USB_ISERIAL_SERIAL,
  isUsbDeviceDirName,
  probeUsbISerial,
  readUsbSysfsDevice,
  selectUniqueUsbISerial,
  type UsbSysfsDevice,
} from "./usb-iserial-probe.ts";

function mapIo(files: Readonly<Record<string, string>>, dirs: readonly string[]) {
  return {
    readDir: (_dir: string) => dirs,
    readFile: (path: string) => files[path] ?? null,
  };
}

describe("usb-iserial-probe", () => {
  it("serial markers do not claim physical metal", () => {
    expect(USB_ISERIAL_SERIAL.noMetalClaim).toContain("no physical-stick claim");
    expect(USB_ISERIAL_SERIAL.found).not.toMatch(/Touch ID|TPM/i);
  });

  it("skips interface nodes and root-hub usbN names", () => {
    expect(isUsbDeviceDirName("1-1")).toBe(true);
    expect(isUsbDeviceDirName("1-1.2")).toBe(true);
    expect(isUsbDeviceDirName("1-1:1.0")).toBe(false);
    expect(isUsbDeviceDirName("usb1")).toBe(false);
  });

  it("reads serial from an injected sysfs device", () => {
    const device = readUsbSysfsDevice("/sys/bus/usb/devices", "1-1", (path) => {
      if (path.endsWith("/serial")) return "ZETA-STICK-001\n";
      if (path.endsWith("/bDeviceClass")) return "00\n";
      return null;
    });
    expect(device.serial).toBe("ZETA-STICK-001");
    expect(device.deviceClass).toBe("00");
  });

  it("selects the unique non-hub serial", () => {
    const devices: readonly UsbSysfsDevice[] = [
      { dirName: "usb1", serial: null, manufacturer: "Linux", product: "hub", deviceClass: "09" },
      {
        dirName: "1-1",
        serial: "ZETA-STICK-001",
        manufacturer: "QEMU",
        product: "QEMU USB HARDDRIVE",
        deviceClass: "00",
      },
    ];
    const selected = selectUniqueUsbISerial(devices);
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.serial).toBe("ZETA-STICK-001");
    expect(selected.dirName).toBe("1-1");
  });

  it("fails closed when no serial is present", () => {
    const selected = selectUniqueUsbISerial([
      { dirName: "1-1", serial: null, manufacturer: "QEMU", product: "USB", deviceClass: "00" },
    ]);
    expect(selected.ok).toBe(false);
    if (selected.ok) return;
    expect(selected.marker).toBe(USB_ISERIAL_SERIAL.missing);
  });

  it("fails closed when two sticks both have serials", () => {
    const selected = selectUniqueUsbISerial([
      { dirName: "1-1", serial: "AAA", manufacturer: null, product: null, deviceClass: "00" },
      { dirName: "1-2", serial: "BBB", manufacturer: null, product: null, deviceClass: "00" },
    ]);
    expect(selected.ok).toBe(false);
    if (selected.ok) return;
    expect(selected.marker).toBe(USB_ISERIAL_SERIAL.ambiguous);
  });

  it("probes a fake sysfs tree the way QEMU would inject one stick", () => {
    const io = mapIo(
      {
        "/sys/bus/usb/devices/1-1/serial": "QEMU-USB-SERIAL-42",
        "/sys/bus/usb/devices/1-1/bDeviceClass": "00",
        "/sys/bus/usb/devices/1-1/manufacturer": "QEMU",
        "/sys/bus/usb/devices/1-1/product": "QEMU USB HARDDRIVE",
        "/sys/bus/usb/devices/usb1/bDeviceClass": "09",
      },
      ["usb1", "1-1", "1-1:1.0"],
    );
    const probed = probeUsbISerial(io, "/sys/bus/usb/devices");
    expect(probed.ok).toBe(true);
    if (!probed.ok) return;
    expect(probed.serial).toBe("QEMU-USB-SERIAL-42");
  });
});
