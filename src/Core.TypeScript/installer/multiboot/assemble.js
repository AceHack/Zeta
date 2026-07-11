export const GRUB_EFI_IMAGE_PATH = "/EFI/BOOT/BOOTX64.EFI", GRUB_EFI_CFG_PATH = "/EFI/BOOT/grub.cfg";
const FAT_OVERHEAD_BYTES = 33554432, MIB = 1048576;
export function estimateImageSizeBytes(artifacts, overheadBytes = FAT_OVERHEAD_BYTES) {
  let total = overheadBytes;
  for (const a of artifacts) {
    if (!Number.isSafeInteger(a.sizeBytes) || a.sizeBytes < 0)
      return overheadBytes;
    total += a.sizeBytes;
  }
  return Math.max(MIB, Math.ceil(total / MIB) * MIB);
}
function mtoolsDest(imagePath) {
  return `::${imagePath.startsWith("/") ? imagePath : `/${imagePath}`}`;
}
export function parentDirPaths(imagePath) {
  const parts = imagePath.split("/").filter((p) => p.length > 0);
  if (parts.length <= 1)
    return [];
  const dirs = [];
  let acc = "";
  for (let i = 0;i < parts.length - 1; i++) {
    acc += `/${parts[i]}`;
    dirs.push(acc);
  }
  return dirs;
}
export function planQemuUeFiBootArgs(input) {
  if (input.outputImagePath.trim().length === 0)
    return { ok: !1, error: "outputImagePath is required" };
  if (input.ovmfCodePath.trim().length === 0 || input.ovmfVarsPath.trim().length === 0)
    return { ok: !1, error: "ovmfCodePath and ovmfVarsPath are required" };
  const args = [
    "qemu-system-x86_64",
    "-machine",
    "q35",
    "-m",
    "1024",
    "-drive",
    `if=pflash,format=raw,readonly=on,file=${input.ovmfCodePath}`,
    "-drive",
    `if=pflash,format=raw,file=${input.ovmfVarsPath}`,
    "-drive",
    `file=${input.outputImagePath},format=raw,if=virtio`,
    "-nographic"
  ];
  if (input.serialLogPath !== void 0 && input.serialLogPath.trim().length > 0)
    return {
      ok: !0,
      args: [...args, "-serial", `file:${input.serialLogPath}`]
    };
  return { ok: !0, args };
}
export function planAssembleFatImage(input) {
  if (input.plan.items.length === 0)
    return { ok: !1, error: "assemble requires at least one plan item" };
  if (!Number.isSafeInteger(input.imageSizeBytes) || input.imageSizeBytes < MIB)
    return { ok: !1, error: "imageSizeBytes must be a safe integer >= 1MiB" };
  if (input.outputImagePath.trim().length === 0)
    return { ok: !1, error: "outputImagePath is required" };
  if (input.stagingDir.trim().length === 0)
    return { ok: !1, error: "stagingDir is required" };
  if (input.grubCfgContent.trim().length === 0)
    return { ok: !1, error: "grubCfgContent must be non-empty" };
  if (input.grubCfgContent.includes("@KERNEL@") || input.grubCfgContent.includes("@INITRD@"))
    return {
      ok: !1,
      error: "grubCfgContent still contains @KERNEL@/@INITRD@ placeholders"
    };
  const grubEfiLocalPath = input.grubEfiLocalPath?.trim();
  if (grubEfiLocalPath !== void 0 && grubEfiLocalPath.length === 0)
    return { ok: !1, error: "grubEfiLocalPath must be non-empty when provided" };
  const byName = new Map;
  for (const art of input.artifacts) {
    if (byName.has(art.name))
      return { ok: !1, error: `duplicate artifact name "${art.name}"` };
    byName.set(art.name, art);
  }
  for (const item of input.plan.items) {
    const art = byName.get(item.name);
    if (art === void 0)
      return { ok: !1, error: `missing local artifact for plan item "${item.name}"` };
    if (art.imagePath !== item.imagePath)
      return {
        ok: !1,
        error: `artifact "${item.name}" imagePath mismatch: plan ${item.imagePath} vs ${art.imagePath}`
      };
    if (item.layoutKind === "flash-payload" && art.imagePath.startsWith("/boot/"))
      return {
        ok: !1,
        error: `flash payload "${item.name}" must not land under /boot/ (identity namespace)`
      };
    if (item.layoutKind === "grub-iso" && art.imagePath.startsWith("/payloads/"))
      return {
        ok: !1,
        error: `grub-iso "${item.name}" must not land under /payloads/ (identity namespace)`
      };
  }
  if (byName.size !== input.plan.items.length)
    return {
      ok: !1,
      error: `artifact count ${String(byName.size)} != plan item count ${String(input.plan.items.length)}`
    };
  const grubCfgStagingPath = `${input.stagingDir.replace(/\/+$/, "")}/grub.cfg`, mtoolsImageSpecifier = input.outputImagePath, steps = [], grubEfiEmbedded = grubEfiLocalPath !== void 0;
  steps.push({
    kind: "command",
    command: {
      command: "qemu-img",
      args: ["create", "-f", "raw", input.outputImagePath, String(input.imageSizeBytes)]
    }
  });
  steps.push({
    kind: "command",
    command: {
      command: "mformat",
      args: ["-F", "-v", "ZETA_MB", "-i", mtoolsImageSpecifier, "::"]
    }
  });
  const dirsNeeded = new Set;
  dirsNeeded.add("/boot");
  dirsNeeded.add("/boot/grub");
  dirsNeeded.add("/boot/iso");
  dirsNeeded.add("/payloads");
  if (grubEfiEmbedded) {
    dirsNeeded.add("/EFI");
    dirsNeeded.add("/EFI/BOOT");
  }
  for (const item of input.plan.items)
    for (const d of parentDirPaths(item.imagePath))
      dirsNeeded.add(d);
  const orderedDirs = [...dirsNeeded].sort((a, b) => {
    const ac = a.split("/").length, bc = b.split("/").length;
    if (ac !== bc)
      return ac - bc;
    return a.localeCompare(b);
  });
  for (const dir of orderedDirs)
    steps.push({
      kind: "command",
      command: {
        command: "mmd",
        args: ["-i", mtoolsImageSpecifier, mtoolsDest(dir)]
      }
    });
  steps.push({
    kind: "write-file",
    path: grubCfgStagingPath,
    content: input.grubCfgContent
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
        mtoolsDest(input.plan.grubCfgPath)
      ]
    }
  });
  if (grubEfiEmbedded) {
    steps.push({
      kind: "command",
      command: {
        command: "mcopy",
        args: [
          "-o",
          "-i",
          mtoolsImageSpecifier,
          grubCfgStagingPath,
          mtoolsDest(GRUB_EFI_CFG_PATH)
        ]
      }
    });
    steps.push({
      kind: "command",
      command: {
        command: "mcopy",
        args: [
          "-o",
          "-i",
          mtoolsImageSpecifier,
          grubEfiLocalPath,
          mtoolsDest(GRUB_EFI_IMAGE_PATH)
        ]
      }
    });
  }
  for (const item of input.plan.items) {
    const art = byName.get(item.name);
    steps.push({
      kind: "command",
      command: {
        command: "mcopy",
        args: ["-o", "-i", mtoolsImageSpecifier, art.localPath, mtoolsDest(art.imagePath)]
      }
    });
  }
  return {
    ok: !0,
    steps,
    mtoolsImageSpecifier,
    grubCfgStagingPath,
    grubEfiEmbedded
  };
}
export function executeAssembleFatImage(steps, executor) {
  let completed = 0;
  for (const step of steps) {
    if (step.kind === "write-file") {
      try {
        executor.writeFile(step.path, step.content);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        return { ok: !1, error: `write-file failed (${step.path}): ${reason}`, completedSteps: completed };
      }
      completed += 1;
      continue;
    }
    let result;
    try {
      result = executor.runCommand(step.command);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      return {
        ok: !1,
        error: `command threw (${step.command.command}): ${reason}`,
        completedSteps: completed
      };
    }
    if (result.status !== 0)
      return {
        ok: !1,
        error: `command failed (${step.command.command} ${step.command.args.join(" ")}): status=${String(result.status)}${result.stderr ? ` ${result.stderr}` : ""}`,
        completedSteps: completed
      };
    completed += 1;
  }
  return { ok: !0, completedSteps: completed };
}
export function mdirListingHasGrubEfiEmbed(listing) {
  const hasEfiBoot = /EFI/i.test(listing) && /BOOT/i.test(listing), hasLoader = /BOOTX64/i.test(listing) || /bootx64\.efi/i.test(listing), hasCfg = /grub\s+cfg/i.test(listing) || /grub\.cfg/i.test(listing);
  return hasEfiBoot && hasLoader && hasCfg;
}
