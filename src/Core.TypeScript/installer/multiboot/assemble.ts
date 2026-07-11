/**
 * Multiboot FAT-image assemble planner (slice 2).
 *
 * Pure: given a MultibootPlan + resolved local artifacts + rendered grub.cfg,
 * emit a deterministic command/file step list (qemu-img + mtools). No network,
 * no process spawn — mirrors zflash `planFileBackedZflashImageExecution`.
 *
 * Honesty: this lays out `/boot/` + `/payloads/` + `grub.cfg` on a FAT volume
 * labeled ZETA_MB. Embedding GRUB EFI/BIOS (`grub-install`) is a follow-up;
 * this slice is QEMU-inspectable (mdir / qemu-img) and dd-ready for the FS
 * layout. Identity namespace: flash payloads never under `/boot/`.
 */

import type { MultibootPlan } from "./plan.ts";

export type AssembleCommand = {
  readonly command: string;
  readonly args: readonly string[];
};

export type AssembleStep =
  | { readonly kind: "command"; readonly command: AssembleCommand }
  | { readonly kind: "write-file"; readonly path: string; readonly content: string };

export type ResolvedArtifact = {
  readonly name: string;
  /** On-image POSIX path from the plan (e.g. `/boot/iso/zeta-installer.iso`). */
  readonly imagePath: string;
  /** Host path to verified bytes. */
  readonly localPath: string;
  readonly sizeBytes: number;
};

export type PlanAssembleFatImageInput = {
  readonly plan: MultibootPlan;
  readonly artifacts: readonly ResolvedArtifact[];
  readonly outputImagePath: string;
  readonly imageSizeBytes: number;
  readonly stagingDir: string;
  /** Fully rendered grub.cfg (placeholders already filled). */
  readonly grubCfgContent: string;
};

export type PlanAssembleFatImageResult =
  | {
      readonly ok: true;
      readonly steps: readonly AssembleStep[];
      readonly mtoolsImageSpecifier: string;
      readonly grubCfgStagingPath: string;
    }
  | { readonly ok: false; readonly error: string };

const FAT_OVERHEAD_BYTES = 32 * 1024 * 1024;
const MIB = 1024 * 1024;

/** Round artifact total + overhead up to the next whole MiB (qemu-img size). */
export function estimateImageSizeBytes(
  artifacts: readonly { readonly sizeBytes: number }[],
  overheadBytes: number = FAT_OVERHEAD_BYTES,
): number {
  let total = overheadBytes;
  for (const a of artifacts) {
    if (!Number.isSafeInteger(a.sizeBytes) || a.sizeBytes < 0) {
      return overheadBytes;
    }
    total += a.sizeBytes;
  }
  return Math.max(MIB, Math.ceil(total / MIB) * MIB);
}

function mtoolsDest(imagePath: string): string {
  // mcopy/mmd want ::/boot/iso/x.iso (same as zflash file-backed ESP writes)
  return `::${imagePath.startsWith("/") ? imagePath : `/${imagePath}`}`;
}

/**
 * Parent directory paths that must exist before mcopy (ordered shallow→deep).
 * `/boot/iso/x.iso` → `/boot`, `/boot/iso`
 */
export function parentDirPaths(imagePath: string): readonly string[] {
  const parts = imagePath.split("/").filter((p) => p.length > 0);
  if (parts.length <= 1) return [];
  const dirs: string[] = [];
  let acc = "";
  for (let i = 0; i < parts.length - 1; i++) {
    acc += `/${parts[i]!}`;
    dirs.push(acc);
  }
  return dirs;
}

/**
 * Plan FAT composite image assembly. Fails closed on missing artifacts,
 * namespace violations, or unsafe sizes.
 */
export function planAssembleFatImage(
  input: PlanAssembleFatImageInput,
): PlanAssembleFatImageResult {
  if (input.plan.items.length === 0) {
    return { ok: false, error: "assemble requires at least one plan item" };
  }
  if (!Number.isSafeInteger(input.imageSizeBytes) || input.imageSizeBytes < MIB) {
    return { ok: false, error: "imageSizeBytes must be a safe integer >= 1MiB" };
  }
  if (input.outputImagePath.trim().length === 0) {
    return { ok: false, error: "outputImagePath is required" };
  }
  if (input.stagingDir.trim().length === 0) {
    return { ok: false, error: "stagingDir is required" };
  }
  if (input.grubCfgContent.trim().length === 0) {
    return { ok: false, error: "grubCfgContent must be non-empty" };
  }
  if (input.grubCfgContent.includes("@KERNEL@") || input.grubCfgContent.includes("@INITRD@")) {
    return {
      ok: false,
      error: "grubCfgContent still contains @KERNEL@/@INITRD@ placeholders",
    };
  }

  const byName = new Map<string, ResolvedArtifact>();
  for (const art of input.artifacts) {
    if (byName.has(art.name)) {
      return { ok: false, error: `duplicate artifact name "${art.name}"` };
    }
    byName.set(art.name, art);
  }

  for (const item of input.plan.items) {
    const art = byName.get(item.name);
    if (art === undefined) {
      return { ok: false, error: `missing local artifact for plan item "${item.name}"` };
    }
    if (art.imagePath !== item.imagePath) {
      return {
        ok: false,
        error: `artifact "${item.name}" imagePath mismatch: plan ${item.imagePath} vs ${art.imagePath}`,
      };
    }
    if (item.layoutKind === "flash-payload" && art.imagePath.startsWith("/boot/")) {
      return {
        ok: false,
        error: `flash payload "${item.name}" must not land under /boot/ (identity namespace)`,
      };
    }
    if (item.layoutKind === "grub-iso" && art.imagePath.startsWith("/payloads/")) {
      return {
        ok: false,
        error: `grub-iso "${item.name}" must not land under /payloads/ (identity namespace)`,
      };
    }
  }

  if (byName.size !== input.plan.items.length) {
    return {
      ok: false,
      error: `artifact count ${String(byName.size)} != plan item count ${String(input.plan.items.length)}`,
    };
  }

  const grubCfgStagingPath = `${input.stagingDir.replace(/\/+$/, "")}/grub.cfg`;
  const mtoolsImageSpecifier = input.outputImagePath;
  const steps: AssembleStep[] = [];

  steps.push({
    kind: "command",
    command: {
      command: "qemu-img",
      args: ["create", "-f", "raw", input.outputImagePath, String(input.imageSizeBytes)],
    },
  });

  // Whole-file FAT32, volume label ZETA_MB (matches grub.cfg root=LABEL=ZETA_MULTIBOOT
  // intent; LABEL length capped at 11 for FAT — use ZETA_MB).
  steps.push({
    kind: "command",
    command: {
      command: "mformat",
      args: ["-F", "-v", "ZETA_MB", "-i", mtoolsImageSpecifier, "::"],
    },
  });

  const dirsNeeded = new Set<string>();
  dirsNeeded.add("/boot");
  dirsNeeded.add("/boot/grub");
  dirsNeeded.add("/boot/iso");
  dirsNeeded.add("/payloads");
  for (const item of input.plan.items) {
    for (const d of parentDirPaths(item.imagePath)) {
      dirsNeeded.add(d);
    }
  }
  // Shallow → deep: sort by path segment count then lexicographic.
  const orderedDirs = [...dirsNeeded].sort((a, b) => {
    const ac = a.split("/").length;
    const bc = b.split("/").length;
    if (ac !== bc) return ac - bc;
    return a.localeCompare(b);
  });
  for (const dir of orderedDirs) {
    steps.push({
      kind: "command",
      command: {
        command: "mmd",
        args: ["-i", mtoolsImageSpecifier, mtoolsDest(dir)],
      },
    });
  }

  steps.push({
    kind: "write-file",
    path: grubCfgStagingPath,
    content: input.grubCfgContent,
  });
  steps.push({
    kind: "command",
    command: {
      command: "mcopy",
      args: [
        "-o",
        "-i",
        mtoolsImageSpecifier,
        grubCfgStagingPath,
        mtoolsDest(input.plan.grubCfgPath),
      ],
    },
  });

  for (const item of input.plan.items) {
    const art = byName.get(item.name)!;
    steps.push({
      kind: "command",
      command: {
        command: "mcopy",
        args: ["-o", "-i", mtoolsImageSpecifier, art.localPath, mtoolsDest(art.imagePath)],
      },
    });
  }

  return {
    ok: true,
    steps,
    mtoolsImageSpecifier,
    grubCfgStagingPath,
  };
}

export type AssembleExecutor = {
  readonly writeFile: (path: string, content: string) => void;
  readonly runCommand: (command: AssembleCommand) => { readonly status: number; readonly stderr?: string };
};

export type ExecuteAssembleResult =
  | { readonly ok: true; readonly completedSteps: number }
  | {
      readonly ok: false;
      readonly error: string;
      readonly completedSteps: number;
    };

/** Run a planned assemble through injected I/O (testable; no hidden effects). */
export function executeAssembleFatImage(
  steps: readonly AssembleStep[],
  executor: AssembleExecutor,
): ExecuteAssembleResult {
  let completed = 0;
  for (const step of steps) {
    if (step.kind === "write-file") {
      try {
        executor.writeFile(step.path, step.content);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        return { ok: false, error: `write-file failed (${step.path}): ${reason}`, completedSteps: completed };
      }
      completed += 1;
      continue;
    }
    let result: { readonly status: number; readonly stderr?: string };
    try {
      result = executor.runCommand(step.command);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: `command threw (${step.command.command}): ${reason}`,
        completedSteps: completed,
      };
    }
    if (result.status !== 0) {
      return {
        ok: false,
        error: `command failed (${step.command.command} ${step.command.args.join(" ")}): status=${String(result.status)}${result.stderr ? ` ${result.stderr}` : ""}`,
        completedSteps: completed,
      };
    }
    completed += 1;
  }
  return { ok: true, completedSteps: completed };
}
