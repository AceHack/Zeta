import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  pointerFromMechanismManifest,
  pointerFromSetupManifest,
  type PackageManagerPointer,
} from "./setup-manifest.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const manifestDir = join(repoRoot, "tools", "setup", "manifests");

function readManifest(name: string): string {
  return readFileSync(join(manifestDir, name), "utf8");
}

/** Ace-visible pointers for each install mechanism (manifest → realizer → dep graph). */
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
      mechanism: "from-autotools-tarball",
      text: readManifest("from-autotools-tarball"),
      purpose: "Pinned upstream autotools tarball → configure/make install (Linux formal solvers)",
      realizer: "tools/setup/mechanisms/from-autotools-tarball.sh",
      manifest: "tools/setup/manifests/from-autotools-tarball",
      defaultUpdate: "pinned-url",
    }),
    pointerFromSetupManifest({
      text: readManifest("from-uv-tool"),
      ecosystem: "uv-tool",
      purpose: "Python CLI tools via uv tool install",
      realizer: "tools/setup/mechanisms/from-uv-tool.sh",
      manifest: "tools/setup/manifests/from-uv-tool",
      defaultUpdate: "pinned",
    }),
    pointerFromSetupManifest({
      text: readManifest("from-uv-venv"),
      ecosystem: "pypi",
      purpose: "Importable Python libraries into repo .venv (uv pip install)",
      realizer: "tools/setup/mechanisms/from-uv-venv.sh",
      manifest: "tools/setup/manifests/from-uv-venv",
      optIn: ["ZETA_INSTALL_QUANTUM=1", "ZETA_INSTALL_FULL=1"],
      defaultUpdate: "pinned",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-elan",
      text: readManifest("from-elan"),
      purpose: "Lean 4 toolchain manager (pinned elan-init.sh)",
      realizer: "tools/setup/mechanisms/from-elan.sh",
      manifest: "tools/setup/manifests/from-elan",
      defaultUpdate: "pinned-url",
    }),
    pointerFromSetupManifest({
      text: readManifest("from-dotnet-global"),
      ecosystem: "dotnet-global",
      purpose: "dotnet tool install --global",
      realizer: "tools/setup/mechanisms/from-dotnet-global.sh",
      manifest: "tools/setup/manifests/from-dotnet-global",
      defaultUpdate: "pinned",
    }),
    pointerFromSetupManifest({
      text: readManifest("from-dotnet-workload"),
      ecosystem: "dotnet-workload",
      purpose: "dotnet workload install",
      realizer: "tools/setup/mechanisms/from-dotnet-workload.sh",
      manifest: "tools/setup/manifests/from-dotnet-workload",
      defaultUpdate: "pinned",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-opam-git",
      text: readManifest("from-opam-git"),
      purpose: "opam source-build from pinned git commit",
      realizer: "tools/setup/mechanisms/from-opam-git.sh",
      manifest: "tools/setup/manifests/from-opam-git",
      optIn: ["ZETA_INSTALL_FULL=1"],
      defaultUpdate: "pinned",
    }),
    pointerFromSetupManifest({
      text: readManifest("from-bun-global"),
      ecosystem: "bun-global",
      purpose: "Agent + peer-AI CLIs via bun install --global",
      realizer: "tools/setup/mechanisms/from-bun-global.sh",
      manifest: "tools/setup/manifests/from-bun-global",
      defaultUpdate: "pinned",
    }),
    {
      schema: "zeta.ace.package-manager-pointers.v1",
      purpose: "Expose repo package bins (ace, zeta-shadow) on PATH via bun link",
      realizer: "tools/setup/mechanisms/from-bun-link.sh",
      manifest: "(repo-root package.json bin map — no separate manifest)",
      dependencies: [
        {
          ecosystem: "bun-link",
          spec: "package.json#bin",
          update: "pinned",
        },
      ],
    },
    pointerFromMechanismManifest({
      mechanism: "from-installer",
      text: readManifest("from-installer"),
      purpose: "Vendor install scripts (HTTPS download-then-exec)",
      realizer: "tools/setup/mechanisms/from-installer.sh",
      manifest: "tools/setup/manifests/from-installer",
      optIn: ["ZETA_INSTALL_FULL=1"],
      defaultUpdate: "self-updating",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-ollama",
      text: readManifest("from-ollama"),
      purpose: "Local-LLM primitive — ollama runtime + pinned model",
      realizer: "tools/setup/mechanisms/from-ollama.sh",
      manifest: "tools/setup/manifests/from-ollama",
      optIn: ["ZETA_INSTALL_FULL=1"],
      defaultUpdate: "pinned",
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
