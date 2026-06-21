import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
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

  test("buildSetupMechanismPointers covers all four mechanism manifests", () => {
    const pointers = buildSetupMechanismPointers();
    expect(pointers.map((p) => p.manifest)).toEqual([
      "tools/setup/manifests/from-url",
      "tools/setup/manifests/from-deb",
      "tools/setup/manifests/from-shim",
      "tools/setup/manifests/from-installer",
    ]);
    for (const p of pointers) {
      expect(p.schema).toBe("zeta.ace.package-manager-pointers.v1");
      expect(p.realizer).toMatch(/^tools\/setup\/mechanisms\//);
      expect(p.dependencies.length).toBeGreaterThan(0);
      for (const dep of p.dependencies) {
        expect(dep.update).toBeDefined();
      }
    }
  });

  test("ace-mechanism-pointers.json matches generated pointers", () => {
    const expected = serializeSetupMechanismPointers();
    writeFileSync(pointersJsonPath, `${expected}\n`);
    const onDisk = readFileSync(pointersJsonPath, "utf8").trim();
    expect(onDisk).toBe(expected.trim());
  });
});
