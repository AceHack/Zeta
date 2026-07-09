import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseImagesManifest } from "./images-manifest.ts";
import { planMultibootUsb } from "./plan.ts";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.."), DEFAULT_MANIFEST = join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/multiboot/images.manifest");
function usage() {
  console.error("usage: bun src/Core.TypeScript/installer/multiboot/build-multiboot-usb.ts --plan [--manifest <path>]");
  process.exit(2);
}
function main(argv) {
  let planOnly = !1, manifestPath = DEFAULT_MANIFEST;
  for (let i = 0;i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--plan")
      planOnly = !0;
    else if (arg === "--manifest") {
      manifestPath = argv[++i] ?? "";
      if (manifestPath === "")
        usage();
    } else if (arg === "-h" || arg === "--help")
      usage();
    else {
      console.error(`unknown argument: ${arg}`);
      usage();
    }
  }
  if (!planOnly) {
    console.error("build-multiboot-usb: full assemble not landed yet \u2014 pass --plan for hermetic layout JSON");
    return 2;
  }
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
if (import.meta.main)
  process.exit(main(process.argv.slice(2)));
