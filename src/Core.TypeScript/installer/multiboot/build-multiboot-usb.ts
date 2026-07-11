#!/usr/bin/env bun
/**
 * build-multiboot-usb.ts — multiboot USB planner + assembler CLI.
 *
 * Usage:
 *   bun …/build-multiboot-usb.ts --plan [--manifest path]
 *   bun …/build-multiboot-usb.ts --assemble --output zeta-multiboot.img \
 *     --local zeta-installer=/path/to/installer.iso \
 *     [--local mynode-model-two=/path/to/payload.img.gz] \
 *     [--cache-dir .cache/multiboot] [--dry-run] [--require-local] \
 *     [--kernel boot/nix/store/…/bzImage --initrd boot/nix/store/…/initrd] \
 *     [--iso-listing path] [--grub-cfg path] [--grub-efi path/to/BOOTX64.EFI]
 *
 * --plan: hermetic layout JSON (no network, no disk image).
 * --assemble: resolve pins → fetch/verify → FAT layout via qemu-img + mtools.
 *   grub-iso-local always needs --local. Optional --grub-efi embeds
 *   /EFI/BOOT/BOOTX64.EFI + /EFI/BOOT/grub.cfg (operator-supplied binary;
 *   from grub-mkimage / nix — not vendored).
 */

import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseImagesManifest } from "./images-manifest.ts";
import {
  planMultibootUsb,
  renderGrubCfgTemplate,
  resolveIsoKernelInitrdPaths,
} from "./plan.ts";
import {
  estimateImageSizeBytes,
  executeAssembleFatImage,
  planAssembleFatImage,
  type AssembleCommand,
} from "./assemble.ts";
import {
  bindResolvedArtifacts,
  resolveLatestPins,
  sha256FileHex,
} from "./resolve-artifacts.ts";
import { curlFetchToFile } from "../../ace/setup-realizers/curl-fetch.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DEFAULT_MANIFEST = join(
  REPO_ROOT,
  "full-ai-cluster/usb-nixos-installer/multiboot/images.manifest",
);
const DEFAULT_GRUB_CFG = join(
  REPO_ROOT,
  "full-ai-cluster/usb-nixos-installer/multiboot/grub.cfg",
);

function usage(): never {
  console.error(
    [
      "usage:",
      "  build-multiboot-usb.ts --plan [--manifest <path>]",
      "  build-multiboot-usb.ts --assemble --output <img> --local name=path ...",
      "    [--manifest <path>] [--grub-cfg <path>] [--cache-dir <dir>]",
      "    [--kernel <iso-rel>] [--initrd <iso-rel>] [--iso-listing <path>]",
      "    [--grub-efi <BOOTX64.EFI>] [--dry-run] [--require-local]",
    ].join("\n"),
  );
  process.exit(2);
}

function parseLocalArg(raw: string): { readonly name: string; readonly path: string } | null {
  const eq = raw.indexOf("=");
  if (eq <= 0) return null;
  const name = raw.slice(0, eq).trim();
  const path = raw.slice(eq + 1).trim();
  if (name.length === 0 || path.length === 0) return null;
  return { name, path: resolve(path) };
}

async function fetchText(url: string): Promise<string> {
  const tmp = join(
    process.env.TMPDIR ?? "/tmp",
    `multiboot-sums-${createHash("sha256").update(url).digest("hex").slice(0, 12)}.txt`,
  );
  try {
    await curlFetchToFile(tmp, url);
    return readFileSync(tmp, "utf8");
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
}

function defaultExecutor(): {
  writeFile: (path: string, content: string) => void;
  runCommand: (command: AssembleCommand) => { status: number; stderr?: string };
} {
  return {
    writeFile: (path, content) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content, "utf8");
    },
    runCommand: (command) => {
      const result = spawnSync(command.command, [...command.args], {
        encoding: "utf8",
      });
      return {
        status: result.status ?? 1,
        stderr: result.stderr ?? undefined,
      };
    },
  };
}

async function runAssemble(opts: {
  readonly manifestPath: string;
  readonly outputImagePath: string;
  readonly grubCfgPath: string;
  readonly cacheDir: string;
  readonly localByName: ReadonlyMap<string, string>;
  readonly requireLocal: boolean;
  readonly dryRun: boolean;
  readonly kernel?: string;
  readonly initrd?: string;
  readonly isoListingPath?: string;
  readonly grubEfiPath?: string;
}): Promise<number> {
  const absManifest = resolve(opts.manifestPath);
  if (!existsSync(absManifest)) {
    console.error(`manifest not found: ${absManifest}`);
    return 2;
  }
  const parsed = parseImagesManifest(readFileSync(absManifest, "utf8"));
  if (!parsed.ok) {
    console.error(`manifest parse error: ${parsed.error}`);
    return 1;
  }

  // First pass plan without pins (url-latest still present).
  let planned = planMultibootUsb({ entries: parsed.entries });
  if (!planned.ok) {
    console.error(`plan error: ${planned.error}`);
    return 1;
  }

  let pins = new Map();
  if (!opts.requireLocal) {
    const pinResult = await resolveLatestPins(planned.plan, fetchText);
    if (!pinResult.ok) {
      console.error(`resolve latest pins: ${pinResult.error}`);
      return 1;
    }
    pins = new Map(pinResult.pins);
    planned = planMultibootUsb({
      entries: parsed.entries,
      latestPins: pins,
    });
    if (!planned.ok) {
      console.error(`plan error (with pins): ${planned.error}`);
      return 1;
    }
  } else {
    // Still need pins map empty; bind will use --local for url-latest.
    planned = planMultibootUsb({ entries: parsed.entries });
    if (!planned.ok) {
      console.error(`plan error: ${planned.error}`);
      return 1;
    }
  }

  mkdirSync(opts.cacheDir, { recursive: true });
  const bound = await bindResolvedArtifacts({
    plan: planned.plan,
    localByName: opts.localByName,
    cacheDir: opts.cacheDir,
    pins,
    fetchToFile: curlFetchToFile,
    requireLocal: opts.requireLocal,
  });
  if (!bound.ok) {
    console.error(`bind artifacts: ${bound.error}`);
    return 1;
  }

  let kernel = opts.kernel;
  let initrd = opts.initrd;
  if ((kernel === undefined || initrd === undefined) && opts.isoListingPath !== undefined) {
    const listing = readFileSync(opts.isoListingPath, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const resolved = resolveIsoKernelInitrdPaths(listing);
    if (!resolved.ok) {
      console.error(`iso listing: ${resolved.error}`);
      return 1;
    }
    kernel = resolved.kernel;
    initrd = resolved.initrd;
  }
  if (kernel === undefined || initrd === undefined) {
    console.error(
      "assemble requires --kernel and --initrd (or --iso-listing) to fill grub.cfg placeholders",
    );
    return 2;
  }

  const template = readFileSync(opts.grubCfgPath, "utf8");
  const grubCfgContent = renderGrubCfgTemplate(template, { kernel, initrd });
  const grubEfiPath =
    opts.grubEfiPath !== undefined ? resolve(opts.grubEfiPath) : undefined;
  if (grubEfiPath !== undefined && !existsSync(grubEfiPath)) {
    console.error(`--grub-efi not found: ${grubEfiPath}`);
    return 2;
  }
  const efiExtra =
    grubEfiPath === undefined ? [] : [{ sizeBytes: statSync(grubEfiPath).size }];
  const imageSizeBytes = estimateImageSizeBytes([...bound.artifacts, ...efiExtra]);
  const stagingDir = join(opts.cacheDir, "staging");
  mkdirSync(stagingDir, { recursive: true });

  const assembled = planAssembleFatImage({
    plan: planned.plan,
    artifacts: bound.artifacts,
    outputImagePath: resolve(opts.outputImagePath),
    imageSizeBytes,
    stagingDir,
    grubCfgContent,
    ...(grubEfiPath === undefined ? {} : { grubEfiLocalPath: grubEfiPath }),
  });
  if (!assembled.ok) {
    console.error(`assemble plan: ${assembled.error}`);
    return 1;
  }

  if (opts.dryRun) {
    console.log(
      JSON.stringify(
        {
          rowId: "multiboot-usb-assemble-dry-run",
          outputImagePath: resolve(opts.outputImagePath),
          imageSizeBytes,
          grubEfiEmbedded: assembled.grubEfiEmbedded,
          artifacts: bound.artifacts.map((a) => ({
            name: a.name,
            imagePath: a.imagePath,
            localPath: a.localPath,
            sizeBytes: a.sizeBytes,
          })),
          steps: assembled.steps,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  const executed = executeAssembleFatImage(assembled.steps, defaultExecutor());
  if (!executed.ok) {
    console.error(`assemble execute: ${executed.error}`);
    return 1;
  }

  const out = resolve(opts.outputImagePath);
  const digest = await sha256FileHex(out);
  console.log(
    JSON.stringify(
      {
        rowId: "multiboot-usb-assemble",
        outputImagePath: out,
        imageSizeBytes,
        sha256: digest,
        completedSteps: executed.completedSteps,
        grubEfiEmbedded: assembled.grubEfiEmbedded,
        note: assembled.grubEfiEmbedded
          ? "FAT layout + EFI/BOOT/BOOTX64.EFI embedded; QEMU UEFI menu boot needs a real GRUB EFI binary"
          : "FAT layout assembled; pass --grub-efi <BOOTX64.EFI> to embed UEFI loader",
      },
      null,
      2,
    ),
  );
  return 0;
}

function runPlan(manifestPath: string): number {
  const abs = resolve(manifestPath);
  if (!existsSync(abs)) {
    console.error(`manifest not found: ${abs}`);
    return 2;
  }
  const parsed = parseImagesManifest(readFileSync(abs, "utf8"));
  if (!parsed.ok) {
    console.error(`manifest parse error: ${parsed.error}`);
    return 1;
  }
  const planned = planMultibootUsb({ entries: parsed.entries });
  if (!planned.ok) {
    console.error(`plan error: ${planned.error}`);
    return 1;
  }
  console.log(
    JSON.stringify(
      {
        rowId: "multiboot-usb-planner",
        manifestPath: abs,
        plan: planned.plan,
      },
      null,
      2,
    ),
  );
  return 0;
}

async function main(argv: readonly string[]): Promise<number> {
  let mode: "plan" | "assemble" | null = null;
  let manifestPath = DEFAULT_MANIFEST;
  let grubCfgPath = DEFAULT_GRUB_CFG;
  let outputImagePath = "";
  let cacheDir = join(REPO_ROOT, ".cache/multiboot");
  let requireLocal = false;
  let dryRun = false;
  let kernel: string | undefined;
  let initrd: string | undefined;
  let isoListingPath: string | undefined;
  let grubEfiPath: string | undefined;
  const localByName = new Map<string, string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--plan") {
      mode = "plan";
    } else if (arg === "--assemble") {
      mode = "assemble";
    } else if (arg === "--manifest") {
      manifestPath = argv[++i] ?? "";
      if (manifestPath === "") usage();
    } else if (arg === "--grub-cfg") {
      grubCfgPath = argv[++i] ?? "";
      if (grubCfgPath === "") usage();
    } else if (arg === "--grub-efi") {
      grubEfiPath = argv[++i] ?? "";
      if (grubEfiPath === "") usage();
    } else if (arg === "--output") {
      outputImagePath = argv[++i] ?? "";
      if (outputImagePath === "") usage();
    } else if (arg === "--cache-dir") {
      cacheDir = argv[++i] ?? "";
      if (cacheDir === "") usage();
    } else if (arg === "--local") {
      const raw = argv[++i] ?? "";
      const parsed = parseLocalArg(raw);
      if (parsed === null) {
        console.error(`--local expects name=path, got: ${raw}`);
        usage();
      }
      localByName.set(parsed.name, parsed.path);
    } else if (arg === "--kernel") {
      kernel = argv[++i];
      if (kernel === undefined || kernel === "") usage();
    } else if (arg === "--initrd") {
      initrd = argv[++i];
      if (initrd === undefined || initrd === "") usage();
    } else if (arg === "--iso-listing") {
      isoListingPath = argv[++i];
      if (isoListingPath === undefined || isoListingPath === "") usage();
    } else if (arg === "--require-local") {
      requireLocal = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "-h" || arg === "--help") {
      usage();
    } else {
      console.error(`unknown argument: ${arg}`);
      usage();
    }
  }

  if (mode === null) {
    console.error("pass --plan or --assemble");
    usage();
  }
  if (mode === "plan") {
    return runPlan(manifestPath);
  }
  if (outputImagePath === "") {
    console.error("--assemble requires --output <img>");
    usage();
  }
  return runAssemble({
    manifestPath,
    outputImagePath,
    grubCfgPath,
    cacheDir: resolve(cacheDir),
    localByName,
    requireLocal,
    dryRun,
    kernel,
    initrd,
    isoListingPath,
    grubEfiPath,
  });
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
