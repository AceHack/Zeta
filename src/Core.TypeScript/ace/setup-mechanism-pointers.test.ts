import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseMechanismManifest } from "./setup-manifest.ts";
import {
  buildSetupMechanismPointers,
  serializeSetupMechanismPointers,
} from "./setup-mechanism-pointers.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const pointersJsonPath = join(repoRoot, "tools", "setup", "ace-mechanism-pointers.json");

describe("setup mechanism pointers (Ace time-crystal deps)", () => {
  test("from-url manifest rows parse as mechanism deps", () => {
    const text = readFileSync(join(repoRoot, "tools/setup/manifests/from-url"), "utf8");
    const entries = parseMechanismManifest(text);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries[0]!.tokens[0]).toMatch(/\.jar$/);
    expect(entries[0]!.tokens[1]).toMatch(/^https:\/\//);
    expect(entries[0]!.attrs.requires).toBe("java");
  });

  test("from-shim includes jammy cvc5 alias", () => {
    const text = readFileSync(join(repoRoot, "tools/setup/manifests/from-shim"), "utf8");
    const entries = parseMechanismManifest(text);
    expect(entries.some((e) => e.tokens.join(" ") === "cvc5 cvc4" && e.attrs.when === "ubuntu-22.04")).toBe(
      true,
    );
  });

  test("buildSetupMechanismPointers covers all install mechanism manifests", () => {
    const pointers = buildSetupMechanismPointers();
    expect(pointers.length).toBeGreaterThanOrEqual(13);
    expect(pointers.every((p) => p.realizer.startsWith("tools/setup/mechanisms/"))).toBe(true);
    for (const p of pointers) {
      expect(p.schema).toBe("zeta.ace.package-manager-pointers.v1");
      if (
        p.manifest === "tools/setup/manifests/from-dotnet-workload"
        || p.manifest === "tools/setup/manifests/from-deb"
      ) {
        expect(p.dependencies.length).toBe(0);
      } else {
        expect(p.dependencies.length).toBeGreaterThan(0);
      }
      for (const dep of p.dependencies) {
        expect(dep.update).toBeDefined();
      }
    }
  });

  test("every from-*.sh mechanism has an Ace pointer realizer", () => {
    const pointers = buildSetupMechanismPointers();
    const realizers = new Set(pointers.map((p) => p.realizer));
    const mechanismDir = join(repoRoot, "tools/setup/mechanisms");
    const scripts = readdirSync(mechanismDir)
      .filter((name) => name.startsWith("from-") && name.endsWith(".sh"))
      .map((name) => `tools/setup/mechanisms/${name}`);
    for (const script of scripts) {
      expect(realizers.has(script)).toBe(true);
    }
  });

  test("ace-mechanism-pointers.json matches generated pointers", () => {
    const expected = serializeSetupMechanismPointers();
    writeFileSync(pointersJsonPath, `${expected}\n`);
    const onDisk = readFileSync(pointersJsonPath, "utf8").trim();
    expect(onDisk).toBe(expected.trim());
  });
});
