import { describe, expect, it } from "bun:test";
import { planQemuUeFiBootArgs } from "./assemble.ts";
import {
  UEFI_MENU_MARKER,
  detectSmokeTooling,
  firstExistingPath,
  grubMkimageArgs,
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

  it("firstExistingPath returns null when none exist", () => {
    expect(firstExistingPath(["/nope-a", "/nope-b"], () => false)).toBeNull();
  });

  it("reuses planQemuUeFiBootArgs for the smoke image", () => {
    const planned = planQemuUeFiBootArgs({
      outputImagePath: "/tmp/zeta-multiboot.img",
      ovmfCodePath: "/usr/share/OVMF/OVMF_CODE.fd",
      ovmfVarsPath: "/tmp/OVMF_VARS.fd",
      serialLogPath: "/tmp/serial.log",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.args.join(" ")).toContain("OVMF_CODE.fd");
    expect(planned.args.join(" ")).toContain("zeta-multiboot.img");
    expect(planned.args.join(" ")).toContain("serial.log");
  });
});
