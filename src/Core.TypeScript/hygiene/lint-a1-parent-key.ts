#!/usr/bin/env bun
// lint-a1-parent-key.ts — the A1 mechanical tripwire (workitem
// 081KZHY9MVY08QG0R003CK4DF8; Vera's A1 signature note 2026-08-08: "a
// treaty article without a mechanical tripwire decays into folklore").
//
// Treaty Article 6 (A1, consent recorded 2026-08-08): NO attribute —
// role/hat, cell, surface, model, runtime, trust tier — may ever appear as
// a parent key above persona in any layout or schema. The near-miss that
// prompted A1 was a drafted (and cancelled) memory/role/persona/ folder
// restructure. This lint makes that class un-committable: for every
// tracked path that carries a PERSONA name as an exact segment, no
// ANCESTOR segment may be a known role/hat or surface name.
//
// The check is deliberately a conjunction (ancestor ∈ coordinates AND
// descendant ∈ personas) so ordinary words never trip it, and it is scoped
// to layouts — the schema half of A1 is enforced where the schema lives
// (personas.yaml role: is optional/descriptive since the same consent
// round; Soraya's A1-as-predicate workitem 081KZHY9MXC carries the full
// formalization).
//
// Pure core (parse/scan), edge-only I/O; the live-repo assertion runs as a
// test in the hygiene suite, so the tripwire fires in CI without a new
// gate job — same pattern as check-bash-retirement-inventory.
//
// Usage:
//   git ls-files | bun src/Core.TypeScript/hygiene/lint-a1-parent-key.ts
// Exit: 0 clean · 1 violation(s) (printed).

import { readFileSync } from "node:fs";

/** Minimal line-scan of a zeta-registry YAML for a scalar field on entries.
 * Deliberately not a YAML parser: hygiene modules must run under bare
 * `bun test` with no node_modules (the drift-ADR yaml lesson, #9881). The
 * registries' entry shape is a stable two-space list of `field: value`
 * lines, which this reads exactly. */
export function scanRegistryField(text: string, field: string): readonly string[] {
  const out: string[] = [];
  const re = new RegExp(`^\\s+${field}:\\s*"?([A-Za-z0-9_-]+)"?\\s*$`);
  for (const line of text.split("\n")) {
    const m = re.exec(line);
    if (m?.[1] !== undefined) out.push(m[1]);
  }
  return [...new Set(out)];
}

export interface A1Violation {
  readonly path: string;
  readonly coordinate: string; // the role/surface segment acting as parent key
  readonly persona: string; // the persona segment keyed beneath it
}

/** Pure: paths where a persona name appears as an exact segment BELOW an
 * exact role/surface segment. Case-insensitive on the coordinate (roles
 * are TitleCase in the registry, folders are usually lower). */
export function findA1Violations(
  paths: readonly string[],
  personas: readonly string[],
  coordinates: readonly string[],
): readonly A1Violation[] {
  const personaSet = new Set(personas.map((p) => p.toLowerCase()));
  const coordSet = new Set(coordinates.map((c) => c.toLowerCase()));
  const out: A1Violation[] = [];
  for (const path of paths) {
    const segs = path.split("/").map((s) => s.toLowerCase());
    for (let i = 0; i < segs.length; i += 1) {
      const seg = segs[i];
      if (seg === undefined || !personaSet.has(seg)) continue;
      for (let j = 0; j < i; j += 1) {
        const anc = segs[j];
        if (anc !== undefined && coordSet.has(anc)) {
          out.push({ path, coordinate: anc, persona: seg });
        }
      }
    }
  }
  return out;
}

export function loadCoordinatesFromRegistries(
  personasYaml: string,
  cellSurfacesYaml: string,
): { personas: readonly string[]; coordinates: readonly string[] } {
  const personas = scanRegistryField(personasYaml, "name");
  const roles = scanRegistryField(personasYaml, "role");
  const surfaces = scanRegistryField(cellSurfacesYaml, "name").filter((s) => !personas.includes(s));
  return { personas, coordinates: [...roles, ...surfaces] };
}

const invokedDirectly = typeof process.argv[1] === "string" && /lint-a1-parent-key\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const { personas, coordinates } = loadCoordinatesFromRegistries(
    readFileSync("registry/personas.yaml", "utf8"),
    readFileSync("registry/cell-surfaces.yaml", "utf8"),
  );
  const chunks: Buffer[] = [];
  process.stdin.on("data", (c: Buffer) => chunks.push(c));
  process.stdin.on("end", () => {
    const paths = Buffer.concat(chunks).toString("utf8").split("\n").filter((l) => l.trim() !== "");
    const violations = findA1Violations(paths, personas, coordinates);
    for (const v of violations) {
      console.error(`A1 VIOLATION: ${v.path} — persona '${v.persona}' keyed under coordinate '${v.coordinate}' (treaty Article 6: no parent key above the hub)`);
    }
    if (violations.length > 0) process.exit(1);
    console.log(`lint-a1-parent-key: ${String(paths.length)} path(s) clean — no coordinate above the hub.`);
    process.exit(0);
  });
}
