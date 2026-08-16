#!/usr/bin/env bun
/**
 * Optional QEMU UEFI menu-boot smoke (USB-IDENTITY-THREAT-MODEL §8.2).
 *
 * Assembles a tiny FAT multiboot image with a real `grub-mkimage` EFI,
 * boots it under OVMF, and waits for the serial menu marker.
 * Local: skip (exit 0) when qemu/ovmf/grub-mkimage/mtools are missing.
 * CI: set MULTIBOOT_UEFI_SMOKE_REQUIRED=1 so a skip is a failure.
 *
 * Usage:
 *   bun src/Core.TypeScript/installer/multiboot/qemu-uefi-menu-smoke.ts
 */

import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  executeAssembleFatImage,
  planAssembleFatImage,
  planQemuUeFiBootArgs,
} from "./assemble.ts";
import { planMultibootUsb } from "./plan.ts";

export const UEFI_MENU_MARKER = "ZETA-MULTIBOOT-UEFI-MENU";

export const OVMF_CODE_CANDIDATES = [
  "/usr/share/OVMF/OVMF_CODE_4M.fd",
  "/usr/share/OVMF/OVMF_CODE.fd",
  "/usr/share/ovmf/OVMF.fd",
  "/opt/homebrew/share/qemu/edk2-x86_64-code.fd",
] as const;

export const OVMF_VARS_CANDIDATES = [
  "/usr/share/OVMF/OVMF_VARS_4M.fd",
  "/usr/share/OVMF/OVMF_VARS.fd",
  "/usr/share/OVMF/OVMF_VARS_4M.ms.fd",
] as const;

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
  const codePath = firstExistingPath(OVMF_CODE_CANDIDATES, exists);
  const varsPath = firstExistingPath(OVMF_VARS_CANDIDATES, exists);
  if (codePath === null || varsPath === null) {
    return null;
  }
  return { codePath, varsPath };
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

async function waitForMarker(serialLogPath: string, deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    if (existsSync(serialLogPath)) {
      const text = readFileSync(serialLogPath, "utf8");
      if (text.includes(UEFI_MENU_MARKER)) {
        return true;
      }
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

  const qemuPlan = planQemuUeFiBootArgs({
    outputImagePath: outImg,
    ovmfCodePath: ovmf.codePath,
    ovmfVarsPath: ovmfVarsCopy,
    serialLogPath,
  });
  if (!qemuPlan.ok) {
    return { exitCode: 1, reason: qemuPlan.error };
  }

  const qemuArgs = [...qemuPlan.args.slice(1)];
  if (existsSync("/dev/kvm")) {
    qemuArgs.push("-enable-kvm");
  }
  const qemu = spawn("qemu-system-x86_64", qemuArgs, { stdio: "ignore" });
  try {
    const seen = await waitForMarker(serialLogPath, Date.now() + SMOKE_TIMEOUT_MS);
    if (!seen) {
      const tail = existsSync(serialLogPath) ? readFileSync(serialLogPath, "utf8").slice(-1500) : "";
      return {
        exitCode: 1,
        reason: `timeout waiting for ${UEFI_MENU_MARKER}${tail.length > 0 ? `\n${tail}` : ""}`,
      };
    }
    return { exitCode: 0, reason: `observed ${UEFI_MENU_MARKER}` };
  } finally {
    qemu.kill("SIGTERM");
  }
}

if (import.meta.main) {
  const result = await runUefiMenuSmoke();
  console.log(`[qemu-uefi-menu-smoke] ${result.reason}`);
  process.exit(result.exitCode);
}
