// build-lumen-persona-package.ts — assemble the Lumen persona-content ACE package (shadow*).
//
// Aaron 2026-07-03: "draft the persona-content package for Lumen on the Claude harness." A persona is
// CONTENT (its card + the skill/blueprints it wears + its notebook seed), not a tool — so the ace
// package carries the content itself, byte-locked by the same blake3 content_hash discipline as every
// other package. This builder DOGFOODS the ace hasher (no hand-computed hashes): it reads the
// persona-content files from the repo, embeds them into an AcePackage, computes the content_hash via
// `packageHash`, and writes packages/lumen-persona-0.1.0.json. Re-run after any card/blueprint edit;
// the test asserts the committed package still matches the live repo files (drift guard).
//
// The result is the "declare + hash so every environment resolves the identical Lumen" slice (#1 of
// the ace-shields plan). It rides the Claude harness Lumen already has (`.claude/agents/…`). Placing
// the content into a fresh environment is a `from-repo-content` realizer — a separate, named slice;
// this builder produces the verifiable package the realizer would consume.

import { readFileSync, writeFileSync } from "node:fs";
import { type AcePackage } from "../../src/Core.TypeScript/ace/store.ts";
import { contentHash } from "../../src/Core.TypeScript/ace/store.ts";

const repoRoot = new URL("../../", import.meta.url).pathname;
const read = (rel: string): string => readFileSync(repoRoot + rel, "utf8");

// The persona-content set: the card (the Claude-harness seat), the skill she wears + its physics
// blueprints, and a notebook seed. Everything a fresh environment needs to resolve Lumen identically.
const CONTENT: readonly { readonly path: string; readonly src: string; readonly role: string }[] = [
  { path: "agents/mathematical-physics-expert.md", src: ".claude/agents/mathematical-physics-expert.md", role: "agent-card" },
  { path: "skills/mathematics-and-physics/SKILL.md", src: ".claude/skills/mathematics-and-physics/SKILL.md", role: "skill" },
  { path: "skills/mathematics-and-physics/blueprints/theoretical-physics-expert.md", src: ".claude/skills/mathematics-and-physics/blueprints/theoretical-physics-expert.md", role: "blueprint" },
  { path: "skills/mathematics-and-physics/blueprints/physics-expert.md", src: ".claude/skills/mathematics-and-physics/blueprints/physics-expert.md", role: "blueprint" },
  { path: "skills/mathematics-and-physics/blueprints/measure-theory-and-signed-measures-expert.md", src: ".claude/skills/mathematics-and-physics/blueprints/measure-theory-and-signed-measures-expert.md", role: "blueprint" },
  { path: "skills/mathematics-and-physics/blueprints/probability-and-bayesian-inference-expert.md", src: ".claude/skills/mathematics-and-physics/blueprints/probability-and-bayesian-inference-expert.md", role: "blueprint" },
];

// A notebook seed (Lumen owns memory/lumen/NOTEBOOK.md; the package ships a first-line seed so a fresh
// environment has the file to append to — pause-not-death: her story has somewhere to persist).
const NOTEBOOK_SEED =
  "# Lumen — Mathematical-Physics Expert · NOTEBOOK\n\n" +
  "Newest-first. Convergence-oracle log: mappings proposed, the falsifier named, the register tier.\n\n" +
  "> Seeded by the ace persona-content package (lumen-persona-0.1.0). Lumen's shipped work: Casimir↔IV,\n" +
  "> Brownian experts, ζ-regularization / −1/12 (frame-rate cost, B-path stated, not a landed theorem).\n";

const files: Record<string, string> = { "lumen-persona/NOTEBOOK.seed.md": NOTEBOOK_SEED };
const contentIndex: { path: string; role: string; bytes: number }[] = [];
for (const c of CONTENT) {
  const body = read(c.src);
  files["lumen-persona/" + c.path] = body;
  contentIndex.push({ path: c.path, role: c.role, bytes: body.length });
}

// A content manifest (the realizer's placement map: what goes where in a target .claude/ tree).
files["lumen-persona/content.json"] = JSON.stringify(
  {
    schema: "zeta.ace.persona-content.v1",
    persona: "Lumen",
    harness: "claude",
    placement: ".claude/",
    notebook: "memory/lumen/NOTEBOOK.md",
    content: contentIndex,
  },
  null,
  2,
);

// content_hash = the ace file-content identity (what installPackage's verify-before-extract checks):
// contentHash(JSON.stringify(files)). Dogfood the ace hasher — no hand-computed hash. Computed BEFORE
// constructing the (readonly) manifest so nothing is mutated in place.
const contentHashValue = contentHash(new TextEncoder().encode(JSON.stringify(files)));

const pkg: AcePackage = {
  manifest: {
    format_version: 1,
    name: "lumen-persona",
    version: "0.1.0",
    description: "Persona-content package for Lumen (mathematical-physics expert): card + mathematics-and-physics skill/blueprints + notebook seed, byte-locked for identical resolution in every environment. Claude harness.",
    content_hash: contentHashValue,
  },
  files,
};

writeFileSync(repoRoot + "src/Core.TypeScript/ace/packages/lumen-persona-0.1.0.json", JSON.stringify(pkg, null, 2) + "\n");
console.log("wrote lumen-persona-0.1.0.json  content_hash=" + contentHashValue);
