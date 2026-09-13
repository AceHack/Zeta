import { describe, expect, it, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { ResolvedArtifact } from "./assemble.ts";
import { planAssembleFatImage, planQemuUeFiBootArgs, resolvedArtifactsFromPlan } from "./assemble.ts";
import { planMultibootUsb } from "./plan.ts";
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
    expect(smokeGrubCfg()).toContain('menuentry "placeholder-not-the-installer"');
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

// The lane boots a GRUB EFI from a real ESP under OVMF and reaches its menu. It does NOT
// boot the installer: the menu entry only `echo`s, and the file it points at is a
// placeholder of a few bytes. Until 2026-09-10 that placeholder was called
// `zeta-installer.iso` and its menu entry `zeta-installer` -- borrowing the name of the
// real product, which ships as `zeta-installer-<version>.iso` and is built by
// `nix build .#installer-iso` in a different lane entirely.
//
// Nothing asserted anything false; the NAMES did the misleading, in a checks list where a
// reader sees a green tick and a familiar word. This pins the correction, because a
// placeholder drifting back toward the product's name is exactly the kind of change that
// looks harmless in a diff.
describe("the placeholder must not borrow the real installer's name", () => {
  const smokeSources = [
    readFileSync(new URL("./qemu-uefi-menu-smoke.ts", import.meta.url), "utf8"),
    readFileSync(new URL("./gpt-esp-usb-boot-smoke.ts", import.meta.url), "utf8"),
  ];

  function code(raw: string): string {
    // Comments stripped FIRST: this file's own explanation above says `zeta-installer.iso`,
    // and a guard its own prose can satisfy is not a guard.
    return raw
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
  }

  test("no smoke source names a zeta-installer artifact", () => {
    for (const raw of smokeSources) expect(code(raw)).not.toContain("zeta-installer");
  });

  test("the control: the comment stripper is not a no-op", () => {
    // Without this, stripping everything would make the assertion above pass vacuously.
    const c = code(smokeSources[0]!);
    expect(c).toContain("placeholder-not-the-installer");
    expect(c.length).toBeGreaterThan(500);
  });

  test("the menu entry says placeholder", () => {
    expect(smokeGrubCfg()).toContain('menuentry "placeholder-not-the-installer"');
    expect(smokeGrubCfg()).not.toContain("zeta-installer");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE LANE WAS RED ON `main` FOR THREE DAYS AND EVERY TEST IN THIS FILE WAS GREEN.
//
// #17228 renamed one coupled value into two different names -- the plan entry to
// "placeholder-not-the-installer" and the artifact's on-image path to
// "/boot/iso/not-an-installer-placeholder.bin" -- while `plan.ts` derives that path from
// the entry NAME as `/boot/iso/${name}.iso`. `planAssembleFatImage` refused the
// disagreement correctly, in 0.5s, before QEMU was ever started:
//
//   artifact "placeholder-not-the-installer" imagePath mismatch:
//     plan /boot/iso/placeholder-not-the-installer.iso
//      vs  /boot/iso/not-an-installer-placeholder.bin
//
// Nothing here caught it because the mismatch lived in `runUefiMenuSmoke`, which needs
// OVMF and grub-mkimage to execute and so is only ever exercised by the CI lane itself.
// These tests reach the same plan/artifact seam WITHOUT any tooling, so the next rename
// fails here in milliseconds instead of on `main` for three days.
describe("FALSIFIER: the smoke's artifacts agree with the smoke's plan", () => {
  const SMOKE_ENTRY = "placeholder-not-the-installer";

  const smokePlan = () =>
    planMultibootUsb({
      entries: [{ name: SMOKE_ENTRY, kind: "grub-iso-local", flakeAttr: "nix:.#installer-iso" }],
    });

  const assembleWith = (artifacts: readonly ResolvedArtifact[]) => {
    const planned = smokePlan();
    if (!planned.ok) throw new Error(`plan failed: ${planned.error}`);
    return planAssembleFatImage({
      plan: planned.plan,
      artifacts,
      outputImagePath: "/tmp/zeta-smoke-out.img",
      imageSizeBytes: 8 * 1024 * 1024,
      stagingDir: "/tmp/zeta-smoke-stage",
      grubCfgContent: smokeGrubCfg(),
    });
  };

  test("artifacts built from the plan assemble cleanly", () => {
    const planned = smokePlan();
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const result = assembleWith(
      resolvedArtifactsFromPlan(planned.plan.items, () => "/tmp/zeta-smoke-payload.bin", 64),
    );
    expect(result.ok).toBe(true);
  });

  // The exact regression, pinned. Without the derived construction this is what the lane
  // did, and it is what `main` has been doing since 2026-09-10.
  test("a hand-written imagePath that disagrees with the plan is REFUSED", () => {
    const result = assembleWith([
      {
        name: SMOKE_ENTRY,
        imagePath: "/boot/iso/not-an-installer-placeholder.bin",
        localPath: "/tmp/zeta-smoke-payload.bin",
        sizeBytes: 64,
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("imagePath mismatch");
  });

  // Guards the constructor itself: it must COPY the plan's path, not recompute one.
  test("resolvedArtifactsFromPlan takes name and imagePath from the plan", () => {
    const items = [{ name: "alpha", imagePath: "/boot/iso/alpha.iso" }];
    const [a] = resolvedArtifactsFromPlan(items, () => "/host/alpha.bin", 64);
    expect(a?.name).toBe("alpha");
    expect(a?.imagePath).toBe("/boot/iso/alpha.iso");
    expect(a?.localPath).toBe("/host/alpha.bin");
  });

  test("resolvedArtifactsFromPlan carries every plan item, not just the first", () => {
    const items = [
      { name: "alpha", imagePath: "/boot/iso/alpha.iso" },
      { name: "beta", imagePath: "/boot/iso/beta.iso" },
    ];
    const out = resolvedArtifactsFromPlan(items, (i) => `/host/${i.name}.bin`, 64);
    expect(out.map((a) => a.imagePath)).toEqual(["/boot/iso/alpha.iso", "/boot/iso/beta.iso"]);
  });
});
