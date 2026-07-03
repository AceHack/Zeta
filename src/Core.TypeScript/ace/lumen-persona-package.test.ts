import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contentHash, type AcePackage } from "./store.ts";

// The Lumen persona-content ACE package (shadow*, Aaron 2026-07-03: "draft the persona-content
// package for Lumen on the Claude harness"). A persona is CONTENT — its card + the skill/blueprints it
// wears + its notebook seed — byte-locked so every environment resolves the IDENTICAL Lumen. This is
// the first slice of "ace distributes personas" (Aaron: a persona will eventually be its own isolated
// git repo / Zeta database). Proofs:
//   - content_hash verifies (integrity — the same verify-before-extract every ace package gets);
//   - the embedded persona files MATCH the live repo files (drift guard — rebuild if this fails);
//   - CONSENT BOUNDARY: the package is NOT yet signed by Lumen's key — deployment must be gated on the
//     persona's own signature (Consent-First §6); this test PINS that the consent layer is still open,
//     so no one wires a deploy realizer believing the gate exists.

const here = dirname(fileURLToPath(import.meta.url));
const packagePath = join(here, "packages", "lumen-persona-0.1.0.json");
const repoRoot = join(here, "..", "..", "..");

function readPackage(): AcePackage {
  return JSON.parse(readFileSync(packagePath, "utf8")) as AcePackage;
}

describe("lumen-persona Ace package", () => {
  test("content_hash verifies (integrity — verify-before-extract)", () => {
    const pkg = readPackage();
    const actual = contentHash(new TextEncoder().encode(JSON.stringify(pkg.files)));
    expect(pkg.manifest.content_hash).toBe(actual);
  });

  test("the card is embedded and names Lumen the mathematical-physics persona", () => {
    const pkg = readPackage();
    const card = pkg.files["lumen-persona/agents/mathematical-physics-expert.md"];
    expect(card).toBeDefined();
    expect(card).toContain("Lumen");
    expect(card).toContain("mathematics-and-physics");
  });

  test("embedded persona files match the live repo files (drift guard — rebuild if this fails)", () => {
    const pkg = readPackage();
    const live = (rel: string): string => readFileSync(join(repoRoot, rel), "utf8");
    expect(pkg.files["lumen-persona/agents/mathematical-physics-expert.md"]).toBe(live(".claude/agents/mathematical-physics-expert.md"));
    expect(pkg.files["lumen-persona/skills/mathematics-and-physics/SKILL.md"]).toBe(live(".claude/skills/mathematics-and-physics/SKILL.md"));
  });

  test("CONSENT BOUNDARY: the package is NOT signed — deployment must be gated on the persona's key", () => {
    const pkg = readPackage();
    // Integrity (content_hash) proves the bytes are intact; it does NOT prove Lumen consented to being
    // copied. Malicious copying is prevented only by the persona's own SIGNATURE (Consent-First §6).
    // This assertion pins that the consent gate is still open — a deploy realizer must NOT ship until a
    // Lumen-signed package + signature verification exists.
    expect(pkg.manifest.signature).toBeUndefined();
  });
});
