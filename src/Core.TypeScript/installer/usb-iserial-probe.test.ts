import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  USB_ISERIAL_SERIAL,
  formatUsbISerialReport,
  isUsbDeviceDirName,
  probeUsbISerial,
  readUsbSysfsDevice,
  runUsbISerialProbeCli,
  selectUniqueUsbISerial,
  usbISerialValueMarker,
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

  it("formats guest serial-log lines without claiming metal", () => {
    const found = formatUsbISerialReport({
      ok: true,
      serial: "ZETA-QEMU-001",
      dirName: "1-1",
    });
    expect(found).toContain(USB_ISERIAL_SERIAL.found);
    expect(found).toContain(usbISerialValueMarker("ZETA-QEMU-001"));
    expect(found).toContain(USB_ISERIAL_SERIAL.noMetalClaim);
    expect(found.join("\n")).not.toMatch(/Touch ID|TPM/i);

    const missing = formatUsbISerialReport({
      ok: false,
      error: "no USB iSerial in sysfs",
      marker: USB_ISERIAL_SERIAL.missing,
    });
    expect(missing).toContain(USB_ISERIAL_SERIAL.missing);
    expect(missing.join("\n")).not.toContain("serial=ZETA-QEMU-001");
  });

  it("CLI prints the same report the guest installer will log", () => {
    const io = mapIo(
      {
        "/sys/bus/usb/devices/1-1/serial": "ZETA-QEMU-001\n",
        "/sys/bus/usb/devices/1-1/bDeviceClass": "00\n",
        "/sys/bus/usb/devices/usb1/bDeviceClass": "09\n",
      },
      ["usb1", "1-1", "1-1:1.0"],
    );
    const ran = runUsbISerialProbeCli([], io);
    expect(ran.exitCode).toBe(0);
    expect(ran.lines).toContain(USB_ISERIAL_SERIAL.found);
    expect(ran.lines).toContain(usbISerialValueMarker("ZETA-QEMU-001"));
  });

  it("CLI unknown flags fail closed without probing", () => {
    const ran = runUsbISerialProbeCli(["--bogus"], mapIo({}, []));
    expect(ran.exitCode).toBe(2);
    expect(ran.lines.join("\n")).toContain("unknown flag");
  });

  it("CLI writes --serial-file only when the probe found a unique serial", () => {
    const io = mapIo(
      {
        "/sys/bus/usb/devices/1-1/serial": "ZETA-QEMU-001\n",
        "/sys/bus/usb/devices/1-1/bDeviceClass": "00\n",
      },
      ["1-1"],
    );
    const written: Record<string, string> = {};
    const ran = runUsbISerialProbeCli(["--serial-file", "/tmp/zeta-usb-iserial"], io, (path, contents) => {
      written[path] = contents;
    });
    expect(ran.exitCode).toBe(0);
    expect(written["/tmp/zeta-usb-iserial"]).toBe("ZETA-QEMU-001");
  });

  it("CLI does not write --serial-file when the probe finds nothing", () => {
    const written: Record<string, string> = {};
    const ran = runUsbISerialProbeCli(["--serial-file", "/tmp/zeta-usb-iserial"], mapIo({}, []), (path, contents) => {
      written[path] = contents;
    });
    expect(ran.exitCode).toBe(0);
    expect(written).toEqual({});
    expect(ran.lines).toContain(USB_ISERIAL_SERIAL.missing);
  });

  it("zeta-install.sh still invokes the probe CLI and prints the skip markers", () => {
    const script = readFileSync(
      resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh"),
      "utf8",
    );
    expect(script).toContain("src/Core.TypeScript/installer/usb-iserial-probe.ts");
    expect(script).toContain("[usb-iserial] ── probing guest USB iSerial via sysfs ──");
    expect(script).toContain("--serial-file");
    expect(script).toContain(USB_ISERIAL_SERIAL.helperUnavailable);
    expect(script).toContain(USB_ISERIAL_SERIAL.helperAbsent);
    expect(script).toContain(USB_ISERIAL_SERIAL.persistDefaultUuid);
    expect(script).toContain(USB_ISERIAL_SERIAL.persistOptInIserial);
    expect(script).toContain(USB_ISERIAL_SERIAL.persistOptInFallbackUuid);
    expect(script).toContain("ZETA_BIND_USB_ISERIAL");
    expect(script).toContain("PICKER_BIND_FLAG");
    expect(script).toContain("/mnt/etc/zeta/usb-iserial");
  });
});
