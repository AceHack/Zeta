#!/usr/bin/env bun
/**
 * Optional QEMU UEFI menu-boot smoke (USB-IDENTITY-THREAT-MODEL §8.2).
 *
 * Assembles a tiny FAT multiboot image with a real `grub-mkimage` EFI
 * (mdir-checked), then boots the same EFI/BOOT files under OVMF via QEMU
 * vvfat. Superfloppy-on-usb-storage is BLK0-only on this OVMF; vvfat is
 * the firmware-visible removable volume. Skip locally when tooling is
 * absent. CI: set MULTIBOOT_UEFI_SMOKE_REQUIRED=1 so a skip is a failure.
 *
 * Usage:
 *   bun src/Core.TypeScript/installer/multiboot/qemu-uefi-menu-smoke.ts
 */

import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  executeAssembleFatImage,
  mdirListingHasGrubEfiEmbed,
  planAssembleFatImage,
  planQemuUeFiBootArgs,
} from "./assemble.ts";
import { planMultibootUsb } from "./plan.ts";

export const UEFI_MENU_MARKER = "ZETA-MULTIBOOT-UEFI-MENU";

export const OVMF_PAIRS: readonly (readonly [string, string])[] = [
  ["/usr/share/OVMF/OVMF_CODE_4M.fd", "/usr/share/OVMF/OVMF_VARS_4M.fd"],
  ["/usr/share/OVMF/OVMF_CODE.fd", "/usr/share/OVMF/OVMF_VARS.fd"],
  ["/opt/homebrew/share/qemu/edk2-x86_64-code.fd", "/opt/homebrew/share/qemu/edk2-x86_64-vars.fd"],
];

const SMOKE_TIMEOUT_MS = 90_000;
const POLL_MS = 1_000;
const GRUB_MODULES = [
  "fat",
  "part_gpt",
  "part_msdos",
  "normal",
  "configfile",
  "echo",
  "serial",
  "terminal",
  "linux",
  "search",
] as const;

export type ResolvedOvmf = {
  readonly codePath: string;
  readonly varsPath: string;
};

export function firstExistingPath(
  candidates: readonly string[],
  exists: (path: string) => boolean = existsSync,
): string | null {
  for (const path of candidates) {
    if (exists(path)) {
      return path;
    }
  }
  return null;
}

export function resolveOvmfPaths(
  exists: (path: string) => boolean = existsSync,
): ResolvedOvmf | null {
  for (const [codePath, varsPath] of OVMF_PAIRS) {
    if (exists(codePath) && exists(varsPath)) {
      return { codePath, varsPath };
    }
  }
  return null;
}

export function smokeGrubCfg(): string {
  return [
    "serial --unit=0 --speed=115200",
    "terminal_input serial",
    "terminal_output serial",
    `echo ${UEFI_MENU_MARKER}`,
    'menuentry "zeta-installer" {',
    "  echo selected-zeta-installer",
    "}",
    "",
  ].join("\n");
}

export function grubMkimageArgs(outputPath: string): readonly string[] {
  return ["-O", "x86_64-efi", "-o", outputPath, "-p", "/EFI/BOOT", ...GRUB_MODULES];
}

export type SmokeTooling = {
  readonly qemu: boolean;
  readonly grubMkimage: boolean;
  readonly qemuImg: boolean;
  readonly mformat: boolean;
  readonly ovmf: boolean;
};

export function detectSmokeTooling(
  which: (bin: string) => boolean = (bin) => spawnSync(bin, ["--version"], { encoding: "utf8" }).status === 0,
  exists: (path: string) => boolean = existsSync,
): SmokeTooling {
  return {
    qemu: which("qemu-system-x86_64"),
    grubMkimage: which("grub-mkimage"),
    qemuImg: which("qemu-img"),
    mformat: which("mformat"),
    ovmf: resolveOvmfPaths(exists) !== null,
  };
}

export function missingSmokeTools(tools: SmokeTooling): readonly string[] {
  const missing: string[] = [];
  if (!tools.qemu) missing.push("qemu-system-x86_64");
  if (!tools.grubMkimage) missing.push("grub-mkimage");
  if (!tools.qemuImg) missing.push("qemu-img");
  if (!tools.mformat) missing.push("mformat");
  if (!tools.ovmf) missing.push("OVMF firmware");
  return missing;
}

/** GitHub-hosted runners often expose `/dev/kvm` without grant. QEMU then exits 1. */
export function kvmIsUsable(
  probe: () => void = () => {
    const fd = openSync("/dev/kvm", "r+");
    closeSync(fd);
  },
): boolean {
  try {
    probe();
    return true;
  } catch {
    return false;
  }
}

function commandOnPath(bin: string): boolean {
  const probe = spawnSync(bin, ["--version"], { encoding: "utf8" });
  if (probe.status === 0) {
    return true;
  }
  // mformat -V; grub-mkimage --help
  const help = spawnSync(bin, ["-V"], { encoding: "utf8" });
  return help.status === 0;
}

function spawnExecutor() {
  return {
    writeFile: (path: string, content: string) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content, "utf8");
    },
    runCommand: (command: { readonly command: string; readonly args: readonly string[] }) => {
      const result = spawnSync(command.command, [...command.args], { encoding: "utf8" });
      return { status: result.status ?? 1, stderr: result.stderr ?? undefined };
    },
  };
}

async function waitForMarker(
  serialLogPath: string,
  deadline: number,
  extraText: () => string = () => "",
  qemuHasExited: () => boolean = () => false,
): Promise<boolean> {
  while (Date.now() < deadline) {
    const fileText = existsSync(serialLogPath) ? readFileSync(serialLogPath, "utf8") : "";
    if (fileText.includes(UEFI_MENU_MARKER) || extraText().includes(UEFI_MENU_MARKER)) {
      return true;
    }
    if (qemuHasExited()) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return false;
}

export async function runUefiMenuSmoke(): Promise<{
  readonly exitCode: 0 | 1 | 2;
  readonly reason: string;
}> {
  const required = process.env.MULTIBOOT_UEFI_SMOKE_REQUIRED === "1";
  const tools = detectSmokeTooling(commandOnPath);
  const missing = missingSmokeTools(tools);
  if (missing.length > 0) {
    const reason = `missing tooling: ${missing.join(", ")}`;
    if (required) {
      return { exitCode: 2, reason };
    }
    return { exitCode: 0, reason: `skip — ${reason}` };
  }

  const ovmf = resolveOvmfPaths();
  if (ovmf === null) {
    return { exitCode: required ? 2 : 0, reason: "OVMF paths unresolved" };
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), "zeta-uefi-menu-smoke-"));
  const isoPath = join(tmpRoot, "zeta-installer.iso");
  const efiPath = join(tmpRoot, "BOOTX64.EFI");
  const outImg = join(tmpRoot, "zeta-multiboot.img");
  const stagingDir = join(tmpRoot, "staging");
  const serialLogPath = join(tmpRoot, "serial.log");
  const ovmfVarsCopy = join(tmpRoot, "OVMF_VARS.fd");
  writeFileSync(isoPath, "zeta-uefi-smoke-iso\n");
  mkdirSync(stagingDir, { recursive: true });
  copyFileSync(ovmf.varsPath, ovmfVarsCopy);

  const mkimage = spawnSync("grub-mkimage", [...grubMkimageArgs(efiPath)], { encoding: "utf8" });
  if (mkimage.status !== 0 || !existsSync(efiPath)) {
    return {
      exitCode: 1,
      reason: `grub-mkimage failed: ${mkimage.stderr || mkimage.stdout || `status ${String(mkimage.status)}`}`,
    };
  }

  const planned = planMultibootUsb({
    entries: [
      {
        name: "zeta-installer",
        kind: "grub-iso-local",
        flakeAttr: "nix:.#installer-iso",
      },
    ],
  });
  if (!planned.ok) {
    return { exitCode: 1, reason: planned.error };
  }

  const assembled = planAssembleFatImage({
    plan: planned.plan,
    artifacts: [
      {
        name: "zeta-installer",
        imagePath: "/boot/iso/zeta-installer.iso",
        localPath: isoPath,
        sizeBytes: 64,
      },
    ],
    outputImagePath: outImg,
    imageSizeBytes: 8 * 1024 * 1024,
    stagingDir,
    grubCfgContent: smokeGrubCfg(),
    grubEfiLocalPath: efiPath,
  });
  if (!assembled.ok) {
    return { exitCode: 1, reason: assembled.error };
  }

  const executed = executeAssembleFatImage(assembled.steps, spawnExecutor());
  if (!executed.ok) {
    return { exitCode: 1, reason: executed.error };
  }

  const listing = spawnSync("mdir", ["-/", "-i", outImg], { encoding: "utf8" });
  const listingText = `${listing.stdout ?? ""}\n${listing.stderr ?? ""}`;
  if (listing.status !== 0 || !mdirListingHasGrubEfiEmbed(listingText)) {
    return {
      exitCode: 1,
      reason: `assembled image missing EFI/BOOT embed (mdir status ${String(listing.status)}):\n${listingText.slice(-1500)}`,
    };
  }

  // Superfloppy FAT on QEMU usb-storage shows up as a USB HARDDRIVE (BLK0, no
  // FS0) — OVMF never finds BOOTX64.EFI. Boot the same EFI files via vvfat.
  const espDir = join(tmpRoot, "esp");
  mkdirSync(join(espDir, "EFI", "BOOT"), { recursive: true });
  copyFileSync(efiPath, join(espDir, "EFI", "BOOT", "BOOTX64.EFI"));
  writeFileSync(join(espDir, "EFI", "BOOT", "grub.cfg"), smokeGrubCfg());

  const qemuPlan = planQemuUeFiBootArgs({
    outputImagePath: espDir,
    ovmfCodePath: ovmf.codePath,
    ovmfVarsPath: ovmfVarsCopy,
    serialLogPath,
    media: "vfat-dir",
  });
  if (!qemuPlan.ok) {
    return { exitCode: 1, reason: qemuPlan.error };
  }

  writeFileSync(serialLogPath, "");
  const qemuArgs = [...qemuPlan.args.slice(1)];
  // Always pin accel. QEMU prefers KVM when `/dev/kvm` exists even without
  // `-enable-kvm`; runners often deny that node (Permission denied → exit 1).
  qemuArgs.push("-accel", kvmIsUsable() ? "kvm" : "tcg");
  const qemu = spawn("qemu-system-x86_64", qemuArgs, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const extra: string[] = [];
  qemu.stdout?.on("data", (chunk: Buffer) => extra.push(chunk.toString("utf8")));
  qemu.stderr?.on("data", (chunk: Buffer) => extra.push(chunk.toString("utf8")));
  let qemuExit: number | null = null;
  qemu.on("error", (err: Error) => {
    extra.push(err.message);
    qemuExit = 1;
  });
  qemu.on("exit", (code) => {
    qemuExit = code;
  });
  try {
    const seen = await waitForMarker(
      serialLogPath,
      Date.now() + SMOKE_TIMEOUT_MS,
      () => extra.join(""),
      () => qemuExit !== null,
    );
    if (seen) {
      return { exitCode: 0, reason: `observed ${UEFI_MENU_MARKER}` };
    }
    const fileTail = existsSync(serialLogPath) ? readFileSync(serialLogPath, "utf8") : "";
    const combined = `${fileTail}\n${extra.join("")}`.trim();
    const exitNote = qemuExit !== null ? ` qemu exited ${String(qemuExit)}` : "";
    return {
      exitCode: 1,
      reason: `timeout waiting for ${UEFI_MENU_MARKER}${exitNote}${combined.length > 0 ? `\n${combined.slice(-2000)}` : " (empty serial)"}`,
    };
  } finally {
    qemu.kill("SIGTERM");
  }
}

if (import.meta.main) {
  const result = await runUefiMenuSmoke();
  console.log(`[qemu-uefi-menu-smoke] ${result.reason}`);
  process.exit(result.exitCode);
}
