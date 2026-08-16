import { describe, expect, it } from "bun:test";
import { planQemuUeFiBootArgs } from "./assemble.ts";
import { QEMU_USB_TEST_SERIAL } from "../qemu-usb-storage.ts";
import {
  UEFI_MENU_MARKER,
  detectSmokeTooling,
  firstExistingPath,
  grubMkimageArgs,
  kvmIsUsable,
  missingSmokeTools,
  resolveOvmfPaths,
  smokeGrubCfg,
} from "./qemu-uefi-menu-smoke.ts";

describe("qemu-uefi-menu-smoke planning", () => {
  it("emits the serial menu marker in grub.cfg", () => {
    expect(smokeGrubCfg()).toContain(UEFI_MENU_MARKER);
    expect(smokeGrubCfg()).toContain("serial --unit=0");
    expect(smokeGrubCfg()).toContain('menuentry "zeta-installer"');
  });

  it("asks grub-mkimage for removable-media prefix + serial modules", () => {
    const args = grubMkimageArgs("/tmp/BOOTX64.EFI");
    expect(args).toContain("x86_64-efi");
    expect(args).toContain("/EFI/BOOT");
    expect(args).toContain("serial");
    expect(args).toContain("fat");
  });

  it("resolves the first existing OVMF pair", () => {
    const present = new Set([
      "/usr/share/OVMF/OVMF_CODE.fd",
      "/usr/share/OVMF/OVMF_VARS.fd",
    ]);
    const resolved = resolveOvmfPaths((p) => present.has(p));
    expect(resolved).toEqual({
      codePath: "/usr/share/OVMF/OVMF_CODE.fd",
      varsPath: "/usr/share/OVMF/OVMF_VARS.fd",
    });
  });

  it("prefers a matched 4M CODE/VARS pair over mixed sizes", () => {
    const present = new Set([
      "/usr/share/OVMF/OVMF_CODE_4M.fd",
      "/usr/share/OVMF/OVMF_VARS_4M.fd",
      "/usr/share/OVMF/OVMF_CODE.fd",
      "/usr/share/OVMF/OVMF_VARS.fd",
    ]);
    const resolved = resolveOvmfPaths((p) => present.has(p));
    expect(resolved).toEqual({
      codePath: "/usr/share/OVMF/OVMF_CODE_4M.fd",
      varsPath: "/usr/share/OVMF/OVMF_VARS_4M.fd",
    });
  });

  it("lists every missing tool", () => {
    const missing = missingSmokeTools({
      qemu: false,
      grubMkimage: false,
      qemuImg: true,
      mformat: true,
      ovmf: false,
    });
    expect(missing).toEqual(["qemu-system-x86_64", "grub-mkimage", "OVMF firmware"]);
  });

  it("detectSmokeTooling reports booleans without throwing", () => {
    const tools = detectSmokeTooling(
      () => false,
      () => false,
    );
    expect(missingSmokeTools(tools).length).toBe(5);
  });

  it("kvmIsUsable is false when the probe cannot open the device", () => {
    expect(
      kvmIsUsable(() => {
        throw new Error("EACCES");
      }),
    ).toBe(false);
    expect(kvmIsUsable(() => undefined)).toBe(true);
  });

  it("firstExistingPath returns null when none exist", () => {
    expect(firstExistingPath(["/nope-a", "/nope-b"], () => false)).toBeNull();
  });

  it("reuses planQemuUeFiBootArgs for the smoke image", () => {
    const planned = planQemuUeFiBootArgs({
      outputImagePath: "/tmp/zeta-esp",
      ovmfCodePath: "/usr/share/OVMF/OVMF_CODE.fd",
      ovmfVarsPath: "/tmp/OVMF_VARS.fd",
      serialLogPath: "/tmp/serial.log",
      media: "vfat-dir",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const joined = planned.args.join(" ");
    expect(joined).toContain("OVMF_CODE.fd");
    expect(joined).toContain("fat:rw:/tmp/zeta-esp");
    expect(joined).toContain("serial.log");
    expect(joined).toContain("virtio-blk-pci");
    expect(joined).toContain("-display none");
    expect(joined).not.toContain("-nographic");
  });

  it("usb media carries a guest-visible iSerial (host sysfs is still fake-tree)", () => {
    const planned = planQemuUeFiBootArgs({
      outputImagePath: "/tmp/stick.img",
      ovmfCodePath: "/usr/share/OVMF/OVMF_CODE.fd",
      ovmfVarsPath: "/tmp/OVMF_VARS.fd",
      media: "usb",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const joined = planned.args.join(" ");
    expect(joined).toContain("usb-storage,bus=xhci.0,drive=stick,bootindex=1");
    expect(joined).toContain(`serial=${QEMU_USB_TEST_SERIAL}`);
    expect(joined).not.toContain("virtio-blk-pci");
  });

  it("rejects a USB serial that cannot be QEMU -device parser input", () => {
    const planned = planQemuUeFiBootArgs({
      outputImagePath: "/tmp/stick.img",
      ovmfCodePath: "/usr/share/OVMF/OVMF_CODE.fd",
      ovmfVarsPath: "/tmp/OVMF_VARS.fd",
      media: "usb",
      usbSerial: "bad,serial",
    });
    expect(planned.ok).toBe(false);
  });

  it("rejects a vfat-dir path that would break the QEMU fat: parser", () => {
    const planned = planQemuUeFiBootArgs({
      outputImagePath: "/tmp/esp,dir",
      ovmfCodePath: "/usr/share/OVMF/OVMF_CODE.fd",
      ovmfVarsPath: "/tmp/OVMF_VARS.fd",
      media: "vfat-dir",
    });
    expect(planned.ok).toBe(false);
  });
});
