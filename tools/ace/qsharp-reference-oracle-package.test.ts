import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packageHash } from "./package-hash.ts";
import { contentHash, type AcePackage } from "./store.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packagePath = join(here, "packages", "qsharp-reference-oracle-0.1.0.json");
const registryPath = join(here, "registry.json");
const quantumManifestPath = join(here, "..", "setup", "manifests", "quantum");

function readPackage(): AcePackage {
  return JSON.parse(readFileSync(packagePath, "utf8")) as AcePackage;
}

function manifestSpecs(): string[] {
  return readFileSync(quantumManifestPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\s+/)[0]!)
    .filter((spec) => !spec.includes("<pin>"));
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
      "https://raw.githubusercontent.com/Lucent-Financial-Group/Zeta/main/tools/ace/packages/qsharp-reference-oracle-0.1.0.json",
    );
  });

  test("package dependency pointers mirror the install manifest", () => {
    const pkg = readPackage();
    const pointer = JSON.parse(pkg.files["qsharp-reference-oracle.deps.json"]!) as {
      dependencies: Array<{ ecosystem: string; spec: string }>;
      realizer: string;
      manifest: string;
    };

    expect(pointer.realizer).toBe("tools/setup/common/quantum.sh");
    expect(pointer.manifest).toBe("tools/setup/manifests/quantum");
    expect(pointer.dependencies.map((dep) => dep.ecosystem)).toEqual(["pypi", "pypi", "pypi"]);
    expect(pointer.dependencies.map((dep) => dep.spec)).toEqual(manifestSpecs());
  });
});
