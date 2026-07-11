import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseImagesManifest } from "./images-manifest.ts";
import {
  planMultibootUsb,
  renderGrubCfgTemplate,
  resolveIsoKernelInitrdPaths
} from "./plan.ts";
import {
  estimateImageSizeBytes,
  executeAssembleFatImage,
  planAssembleFatImage
} from "./assemble.ts";
import {
  bindResolvedArtifacts,
  resolveLatestPins,
  sha256FileHex
} from "./resolve-artifacts.ts";
import { curlFetchToFile } from "../../ace/setup-realizers/curl-fetch.ts";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.."), DEFAULT_MANIFEST = join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/multiboot/images.manifest"), DEFAULT_GRUB_CFG = join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/multiboot/grub.cfg");
function usage() {
  console.error([
    "usage:",
    "  build-multiboot-usb.ts --plan [--manifest <path>]",
    "  build-multiboot-usb.ts --assemble --output <img> --local name=path ...",
    "    [--manifest <path>] [--grub-cfg <path>] [--cache-dir <dir>]",
    "    [--kernel <iso-rel>] [--initrd <iso-rel>] [--iso-listing <path>]",
    "    [--dry-run] [--require-local]"
  ].join(`
`));
  process.exit(2);
}
function parseLocalArg(raw) {
  const eq = raw.indexOf("=");
  if (eq <= 0)
    return null;
  const name = raw.slice(0, eq).trim(), path = raw.slice(eq + 1).trim();
  if (name.length === 0 || path.length === 0)
    return null;
  return { name, path: resolve(path) };
}
async function fetchText(url) {
  const tmp = join(process.env.TMPDIR ?? "/tmp", `multiboot-sums-${createHash("sha256").update(url).digest("hex").slice(0, 12)}.txt`);
  try {
    await curlFetchToFile(tmp, url);
    return readFileSync(tmp, "utf8");
  } finally {
    try {
      unlinkSync(tmp);
    } catch {}
  }
}
function defaultExecutor() {
  return {
    writeFile: (path, content) => {
      mkdirSync(dirname(path), { recursive: !0 });
      writeFileSync(path, content, "utf8");
    },
    runCommand: (command) => {
      const result = spawnSync(command.command, [...command.args], {
        encoding: "utf8"
      });
      return {
        status: result.status ?? 1,
        stderr: result.stderr ?? void 0
      };
    }
  };
}
async function runAssemble(opts) {
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
  let planned = planMultibootUsb({ entries: parsed.entries });
  if (!planned.ok) {
    console.error(`plan error: ${planned.error}`);
    return 1;
  }
  let pins = new Map;
  if (!opts.requireLocal) {
    const pinResult = await resolveLatestPins(planned.plan, fetchText);
    if (!pinResult.ok) {
      console.error(`resolve latest pins: ${pinResult.error}`);
      return 1;
    }
    pins = new Map(pinResult.pins);
    planned = planMultibootUsb({
      entries: parsed.entries,
      latestPins: pins
    });
    if (!planned.ok) {
      console.error(`plan error (with pins): ${planned.error}`);
      return 1;
    }
  } else {
    planned = planMultibootUsb({ entries: parsed.entries });
    if (!planned.ok) {
      console.error(`plan error: ${planned.error}`);
      return 1;
    }
  }
  mkdirSync(opts.cacheDir, { recursive: !0 });
  const bound = await bindResolvedArtifacts({
    plan: planned.plan,
    localByName: opts.localByName,
    cacheDir: opts.cacheDir,
    pins,
    fetchToFile: curlFetchToFile,
    requireLocal: opts.requireLocal
  });
  if (!bound.ok) {
    console.error(`bind artifacts: ${bound.error}`);
    return 1;
  }
  let { kernel, initrd } = opts;
  if ((kernel === void 0 || initrd === void 0) && opts.isoListingPath !== void 0) {
    const listing = readFileSync(opts.isoListingPath, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0), resolved = resolveIsoKernelInitrdPaths(listing);
    if (!resolved.ok) {
      console.error(`iso listing: ${resolved.error}`);
      return 1;
    }
    kernel = resolved.kernel;
    initrd = resolved.initrd;
  }
  if (kernel === void 0 || initrd === void 0) {
    console.error("assemble requires --kernel and --initrd (or --iso-listing) to fill grub.cfg placeholders");
    return 2;
  }
  const template = readFileSync(opts.grubCfgPath, "utf8"), grubCfgContent = renderGrubCfgTemplate(template, { kernel, initrd }), imageSizeBytes = estimateImageSizeBytes(bound.artifacts), stagingDir = join(opts.cacheDir, "staging");
  mkdirSync(stagingDir, { recursive: !0 });
  const assembled = planAssembleFatImage({
    plan: planned.plan,
    artifacts: bound.artifacts,
    outputImagePath: resolve(opts.outputImagePath),
    imageSizeBytes,
    stagingDir,
    grubCfgContent
  });
  if (!assembled.ok) {
    console.error(`assemble plan: ${assembled.error}`);
    return 1;
  }
  if (opts.dryRun) {
    console.log(JSON.stringify({
      rowId: "multiboot-usb-assemble-dry-run",
      outputImagePath: resolve(opts.outputImagePath),
      imageSizeBytes,
      artifacts: bound.artifacts.map((a) => ({
        name: a.name,
        imagePath: a.imagePath,
        localPath: a.localPath,
        sizeBytes: a.sizeBytes
      })),
      steps: assembled.steps
    }, null, 2));
    return 0;
  }
  const executed = executeAssembleFatImage(assembled.steps, defaultExecutor());
  if (!executed.ok) {
    console.error(`assemble execute: ${executed.error}`);
    return 1;
  }
  const out = resolve(opts.outputImagePath), digest = await sha256FileHex(out);
  console.log(JSON.stringify({
    rowId: "multiboot-usb-assemble",
    outputImagePath: out,
    imageSizeBytes,
    sha256: digest,
    completedSteps: executed.completedSteps,
    note: "FAT layout assembled; grub-install EFI/BIOS embed is a follow-up"
  }, null, 2));
  return 0;
}
function runPlan(manifestPath) {
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
  console.log(JSON.stringify({
    rowId: "multiboot-usb-planner",
    manifestPath: abs,
    plan: planned.plan
  }, null, 2));
  return 0;
}
async function main(argv) {
  let mode = null, manifestPath = DEFAULT_MANIFEST, grubCfgPath = DEFAULT_GRUB_CFG, outputImagePath = "", cacheDir = join(REPO_ROOT, ".cache/multiboot"), requireLocal = !1, dryRun = !1, kernel, initrd, isoListingPath;
  const localByName = new Map;
  for (let i = 0;i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--plan")
      mode = "plan";
    else if (arg === "--assemble")
      mode = "assemble";
    else if (arg === "--manifest") {
      manifestPath = argv[++i] ?? "";
      if (manifestPath === "")
        usage();
    } else if (arg === "--grub-cfg") {
      grubCfgPath = argv[++i] ?? "";
      if (grubCfgPath === "")
        usage();
    } else if (arg === "--output") {
      outputImagePath = argv[++i] ?? "";
      if (outputImagePath === "")
        usage();
    } else if (arg === "--cache-dir") {
      cacheDir = argv[++i] ?? "";
      if (cacheDir === "")
        usage();
    } else if (arg === "--local") {
      const raw = argv[++i] ?? "", parsed = parseLocalArg(raw);
      if (parsed === null) {
        console.error(`--local expects name=path, got: ${raw}`);
        usage();
      }
      localByName.set(parsed.name, parsed.path);
    } else if (arg === "--kernel") {
      kernel = argv[++i];
      if (kernel === void 0 || kernel === "")
        usage();
    } else if (arg === "--initrd") {
      initrd = argv[++i];
      if (initrd === void 0 || initrd === "")
        usage();
    } else if (arg === "--iso-listing") {
      isoListingPath = argv[++i];
      if (isoListingPath === void 0 || isoListingPath === "")
        usage();
    } else if (arg === "--require-local")
      requireLocal = !0;
    else if (arg === "--dry-run")
      dryRun = !0;
    else if (arg === "-h" || arg === "--help")
      usage();
    else {
      console.error(`unknown argument: ${arg}`);
      usage();
    }
  }
  if (mode === null) {
    console.error("pass --plan or --assemble");
    usage();
  }
  if (mode === "plan")
    return runPlan(manifestPath);
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
    isoListingPath
  });
}
if (import.meta.main)
  process.exit(await main(process.argv.slice(2)));
