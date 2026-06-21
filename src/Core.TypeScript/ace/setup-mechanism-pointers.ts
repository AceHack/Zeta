import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  pointerFromMechanismManifest,
  type PackageManagerPointer,
} from "./setup-manifest.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const manifestDir = join(repoRoot, "tools", "setup", "manifests");

function readManifest(name: string): string {
  return readFileSync(join(manifestDir, name), "utf8");
}

/** Ace-visible pointers for each install mechanism (source × deps × update rules). */
export function buildSetupMechanismPointers(): ReadonlyArray<PackageManagerPointer> {
  return [
    pointerFromMechanismManifest({
      mechanism: "from-url",
      text: readManifest("from-url"),
      purpose: "HTTPS release assets → declared repo paths (jars, binaries, etc.)",
      realizer: "tools/setup/mechanisms/from-url.sh",
      manifest: "tools/setup/manifests/from-url",
      defaultUpdate: "pinned-url",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-deb",
      text: readManifest("from-deb"),
      purpose: "Direct .deb installs when distro apt lacks the package",
      realizer: "tools/setup/mechanisms/from-deb.sh",
      manifest: "tools/setup/manifests/from-deb",
      defaultUpdate: "when-drift-bump-pin",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-shim",
      text: readManifest("from-shim"),
      purpose: "PATH symlinks when binary name differs from upstream package",
      realizer: "tools/setup/mechanisms/from-shim.sh",
      manifest: "tools/setup/manifests/from-shim",
      defaultUpdate: "when-drift-bump-pin",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-installer",
      text: readManifest("from-installer"),
      purpose: "Vendor install scripts (HTTPS download-then-exec)",
      realizer: "tools/setup/mechanisms/from-installer.sh",
      manifest: "tools/setup/manifests/from-installer",
      optIn: ["ZETA_INSTALL_FULL=1"],
      defaultUpdate: "self-updating",
    }),
  ] as const;
}

/** Written beside manifests for Ace / tooling that reads JSON without TS. */
export function serializeSetupMechanismPointers(): string {
  return JSON.stringify(buildSetupMechanismPointers(), null, 2);
}

if (import.meta.main) {
  console.log(serializeSetupMechanismPointers());
}
