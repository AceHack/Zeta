#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

const PERSONAS_YAML_PATH = join(REPO_ROOT, "registry", "personas.yaml");
const SURFACES_YAML_PATH = join(REPO_ROOT, "registry", "cell-surfaces.yaml");

const TS_OUT_TS = join(REPO_ROOT, "src", "Core.TypeScript", "identity", "generated-registry.ts");
const FS_OUT = join(REPO_ROOT, "src", "Core", "IdentityRegistry.fs");

interface PersonaEntry {
  id: number;
  name: string;
  role: string;
  description: string;
  public_key?: string;
  allowed_surfaces: string[];
}

interface SurfacesEntry {
  name: string;
  description: string;
}

function main() {
  console.log("Generating identity registry files...");

  // Load and parse YAML files
  const personasData = parseYaml(readFileSync(PERSONAS_YAML_PATH, "utf8")) as { entries: PersonaEntry[] };
  const surfacesData = parseYaml(readFileSync(SURFACES_YAML_PATH, "utf8")) as { surfaces: SurfacesEntry[] };

  const entries = personasData.entries.sort((a, b) => a.id - b.id);
  const surfaces = surfacesData.surfaces.map((s) => s.name).sort();

  const personaNames = entries.map((e) => e.name);

  // 1. Generate generated-registry.ts
  const tsContent = `// generated-registry.ts — GENERATED FILE — DO NOT EDIT DIRECTLY
// Source: registry/personas.yaml & registry/cell-surfaces.yaml

export type PersonaId = ${personaNames.map((n) => `"${n}"`).join(" | ")};

export interface PersonaRegistryEntry {
  readonly id: number;
  readonly name: PersonaId;
  readonly role: string;
  readonly description: string;
  readonly publicKey?: string;
  readonly allowedSurfaces: readonly string[];
}

export const VALID_PERSONAS = new Set<string>([
  ${personaNames.map((n) => `"${n}"`).join(",\n  ")}
]);

export const PERSONA_REGISTRY: readonly PersonaRegistryEntry[] = [
  ${entries
    .map(
      (e) => `{
    id: ${e.id},
    name: "${e.name}",
    role: "${e.role}",
    description: ${JSON.stringify(e.description)},
    ${e.public_key ? `publicKey: "${e.public_key}",` : ""}
    allowedSurfaces: [${e.allowed_surfaces.map((s) => `"${s}"`).join(", ")}]
  }`,
    )
    .join(",\n  ")}
];

export const CELL_SURFACES = new Set<string>([
  ${surfaces.map((s) => `"${s}"`).join(",\n  ")}
]);
`;

  writeFileSync(TS_OUT_TS, tsContent, "utf8");
  console.log(`Wrote TS file: ${TS_OUT_TS}`);

  // 2. Generate IdentityRegistry.fs
  // F# DU cases should be title case
  const toTitleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const fsContent = `// IdentityRegistry.fs — GENERATED FILE — DO NOT EDIT DIRECTLY
namespace Zeta.Core

/// PersonaId - Closed, registry-backed enum of identities (the hubs).
type PersonaId =
    ${personaNames.map((n) => `| ${toTitleCase(n)}`).join("\n    ")}

[<RequireQualifiedAccess>]
module PersonaId =
    let toString = function
        ${personaNames.map((n) => `| ${toTitleCase(n)} -> "${n}"`).join("\n        ")}

    let parse = function
        ${personaNames.map((n) => `| "${n}" -> Some ${toTitleCase(n)}`).join("\n        ")}
        | _ -> None

module IdentityRegistry =
    let validPersonas =
        [
            ${personaNames.map((n) => `"${n}"`).join(";\n            ")}
        ]
        |> Set.ofList

    let validSurfaces =
        [
            ${surfaces.map((s) => `"${s}"`).join(";\n            ")}
        ]
        |> Set.ofList
`;

  writeFileSync(FS_OUT, fsContent, "utf8");
  console.log(`Wrote F# file: ${FS_OUT}`);
}

if (import.meta.main) {
  main();
}
