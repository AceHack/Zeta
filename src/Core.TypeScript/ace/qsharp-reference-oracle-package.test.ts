import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packageHash } from "./package-hash.ts";
import { contentHash, type AcePackage } from "./store.ts";
import { pointerFromSetupManifest } from "./setup-manifest.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packagePath = join(here, "packages", "qsharp-reference-oracle-0.1.0.json");
const registryPath = join(here, "registry.json");
const quantumManifestPath = join(here, "..", "..", "..", "tools", "setup", "manifests", "from-uv-venv");

function readPackage(): AcePackage {
  return JSON.parse(readFileSync(packagePath, "utf8")) as AcePackage;
}

describe("qsharp-reference-oracle Ace package", () => {
  test("content_hash matches packaged dependency pointers", () => {
    const pkg = readPackage();
    const actual = contentHash(new TextEncoder().encode(JSON.stringify(pkg.files)));
    expect(pkg.manifest.content_hash).toBe(actual);
  });

  test("bundled registry pins the package identity", () => {
    const pkg = readPackage();
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      "qsharp-reference-oracle": { "0.1.0": { package_hash: string; url: string } };
    };

    const entry = registry["qsharp-reference-oracle"]["0.1.0"];
    expect(entry.package_hash).toBe(packageHash(pkg));
    expect(entry.url).toBe(
      "https://raw.githubusercontent.com/Lucent-Financial-Group/Zeta/main/src/Core.TypeScript/ace/packages/qsharp-reference-oracle-0.1.0.json",
    );
  });

  test("package dependency pointer is generated from the install manifest", () => {
    const pkg = readPackage();
    const pointer = JSON.parse(pkg.files["qsharp-reference-oracle.deps.json"]!);
    const expected = pointerFromSetupManifest({
      text: readFileSync(quantumManifestPath, "utf8"),
      ecosystem: "pypi",
      purpose: "QDK/Q# reference oracle for finite-resolution qubits observable golden vectors",
      realizer: "tools/setup/mechanisms/from-uv-venv.sh",
      manifest: "tools/setup/manifests/from-uv-venv",
      optIn: ["ZETA_INSTALL_QUANTUM=1", "ZETA_INSTALL_FULL=1"],
    });

    expect(pointer).toEqual(expected);
  });
});
