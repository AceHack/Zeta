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

/** Bun realizer module path for Ace time-crystal pointers (081KLL7 post-cutover). */
export function bunMechanismRealizer(mechanismId: string): string {
  return `src/Core.TypeScript/ace/setup-realizers/${mechanismId}.ts`;
}

/** Ace-visible pointers for each install mechanism (manifest → realizer → dep graph). */
export function buildSetupMechanismPointers(): ReadonlyArray<PackageManagerPointer> {
  return [
    pointerFromMechanismManifest({
      mechanism: "from-url",
      text: readManifest("from-url"),
      purpose: "HTTPS release assets → declared repo paths (jars, binaries, etc.)",
      realizer: bunMechanismRealizer("from-url"),
      manifest: "tools/setup/manifests/from-url",
      defaultUpdate: "pinned-url",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-deb",
      text: readManifest("from-deb"),
      purpose: "Direct .deb installs when distro apt lacks the package",
      realizer: bunMechanismRealizer("from-deb"),
      manifest: "tools/setup/manifests/from-deb",
      defaultUpdate: "when-drift-bump-pin",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-shim",
      text: readManifest("from-shim"),
      purpose: "PATH symlinks when binary name differs from upstream package",
      realizer: bunMechanismRealizer("from-shim"),
      manifest: "tools/setup/manifests/from-shim",
      defaultUpdate: "when-drift-bump-pin",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-autotools-tarball",
      text: readManifest("from-autotools-tarball"),
      purpose: "Pinned upstream autotools tarball → configure/make install (Linux formal solvers)",
      realizer: bunMechanismRealizer("from-autotools-tarball"),
      manifest: "tools/setup/manifests/from-autotools-tarball",
      defaultUpdate: "pinned-url",
    }),
    pointerFromSetupManifest({
      text: readManifest("from-uv-tool"),
      ecosystem: "uv-tool",
      purpose: "Python CLI tools via uv tool install",
      realizer: bunMechanismRealizer("from-uv-tool"),
      manifest: "tools/setup/manifests/from-uv-tool",
      defaultUpdate: "pinned",
    }),
    pointerFromSetupManifest({
      text: readManifest("from-uv-venv"),
      ecosystem: "pypi",
      purpose: "Importable Python libraries into repo .venv (uv pip install)",
      realizer: bunMechanismRealizer("from-uv-venv"),
      manifest: "tools/setup/manifests/from-uv-venv",
      optIn: ["ZETA_INSTALL_QUANTUM=1", "ZETA_INSTALL_FULL=1"],
      defaultUpdate: "pinned",
    }),
    pointerFromSetupManifest({
      text: readManifest("from-uv-project"),
      ecosystem: "uv-project",
      purpose:
        "Locked uv projects via `uv sync --frozen` (committed uv.lock, sha256 per wheel)",
      realizer: bunMechanismRealizer("from-uv-project"),
      manifest: "tools/setup/manifests/from-uv-project",
      // Per-project, declared in the manifest's `opt-in=` column. Listed here so
      // ace's pointer set shows the gate without having to read the realizer.
      optIn: ["ZETA_INSTALL_INTERP=1"],
      defaultUpdate: "pinned",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-elan",
      text: readManifest("from-elan"),
      purpose: "Lean 4 toolchain manager (pinned elan-init.sh)",
      realizer: bunMechanismRealizer("from-elan"),
      manifest: "tools/setup/manifests/from-elan",
      defaultUpdate: "pinned-url",
    }),
    pointerFromSetupManifest({
      text: readManifest("from-dotnet-global"),
      ecosystem: "dotnet-global",
      purpose: "dotnet tool install --global",
      realizer: bunMechanismRealizer("from-dotnet-global"),
      manifest: "tools/setup/manifests/from-dotnet-global",
      defaultUpdate: "pinned",
    }),
    pointerFromSetupManifest({
      text: readManifest("from-dotnet-workload"),
      ecosystem: "dotnet-workload",
      purpose: "dotnet workload install",
      realizer: bunMechanismRealizer("from-dotnet-workload"),
      manifest: "tools/setup/manifests/from-dotnet-workload",
      defaultUpdate: "pinned",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-opam-git",
      text: readManifest("from-opam-git"),
      purpose: "opam source-build from pinned git commit",
      realizer: bunMechanismRealizer("from-opam-git"),
      manifest: "tools/setup/manifests/from-opam-git",
      optIn: ["ZETA_INSTALL_FULL=1"],
      defaultUpdate: "pinned",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-agda-cubical",
      text: readManifest("from-agda-cubical"),
      purpose:
        "Cubical Agda proof lane — pinned agda/cubical release clone (pin-pair vs installed Agda) + user-library registration (081KX1VE4G808QG0R003DCK3GV)",
      realizer: bunMechanismRealizer("from-agda-cubical"),
      manifest: "tools/setup/manifests/from-agda-cubical",
      defaultUpdate: "pinned",
    }),
    pointerFromSetupManifest({
      text: readManifest("from-bun-global"),
      ecosystem: "bun-global",
      purpose: "Agent + peer-AI CLIs via bun install --global",
      realizer: bunMechanismRealizer("from-bun-global"),
      manifest: "tools/setup/manifests/from-bun-global",
      defaultUpdate: "pinned",
    }),
    {
      schema: "zeta.ace.package-manager-pointers.v1",
      purpose: "Expose repo package bins (ace, zeta-shadow) on PATH via bun link",
      realizer: bunMechanismRealizer("from-bun-link"),
      manifest: "(repo-root package.json bin map — no separate manifest)",
      dependencies: [
        {
          ecosystem: "bun-link",
          spec: "package.json#bin",
          update: "pinned",
        },
      ],
    },
    {
      // 081KZKWB1FZ — the repo's OWN devDependencies were the one dependency class
      // ACE did not manage. install.sh never ran a root `bun install`, so a fully
      // provisioned machine had every toolchain and no node_modules, and a local
      // `lint (TS)` disagreed with CI via phantom TS2307s that read like findings.
      // Dogfooding ACE is the fix: a dependency class belongs in the package
      // manager of package managers, not as a shell line in a bootstrap script.
      schema: "zeta.ace.package-manager-pointers.v1",
      purpose: "Install the repo's own package.json dependencies (bun install at repo root)",
      realizer: bunMechanismRealizer("from-bun-workspace"),
      manifest: "(repo-root package.json + bun.lock — no separate manifest)",
      dependencies: [
        {
          ecosystem: "bun-workspace",
          spec: "package.json#devDependencies",
          // bun.lock IS the pin. Applied deliberately WITHOUT --frozen-lockfile so
          // lockfile drift cannot hard-fail provisioning for all three §24
          // consumers; the lint gate stays the place that enforces freshness.
          update: "pinned",
        },
      ],
    },
    pointerFromMechanismManifest({
      mechanism: "from-installer",
      text: readManifest("from-installer"),
      purpose: "Vendor install scripts (HTTPS download-then-exec)",
      realizer: bunMechanismRealizer("from-installer"),
      manifest: "tools/setup/manifests/from-installer",
      optIn: ["ZETA_INSTALL_FULL=1"],
      defaultUpdate: "self-updating",
    }),
    pointerFromMechanismManifest({
      mechanism: "from-ollama",
      text: readManifest("from-ollama"),
      purpose: "Local-LLM primitive — ollama runtime + pinned model",
      realizer: bunMechanismRealizer("from-ollama"),
      manifest: "tools/setup/manifests/from-ollama",
      optIn: ["ZETA_INSTALL_FULL=1"],
      defaultUpdate: "pinned",
    }),
    {
      schema: "zeta.ace.package-manager-pointers.v1",
      purpose:
        "Symlink tracked scripts/hooks/commit-msg into .git/hooks (Manus wrapper leak guard, 081KWN0JKJV)",
      realizer: bunMechanismRealizer("from-git-hooks"),
      manifest: "scripts/hooks/commit-msg",
      dependencies: [
        {
          ecosystem: "git-hooks",
          spec: "scripts/hooks/commit-msg",
          update: "pinned",
        },
      ],
    },
  ] as const;
}

/** Written beside manifests for Ace / tooling that reads JSON without TS. */
export function serializeSetupMechanismPointers(): string {
  return JSON.stringify(buildSetupMechanismPointers(), null, 2);
}

if (import.meta.main) {
  console.log(serializeSetupMechanismPointers());
}
