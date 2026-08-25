// category-vocabulary-agreement.test.ts — the four oracles and the registry must
// carry the SAME Category name→number map.
//
// WHY THIS EXISTS. `registry/categories.yaml` claimed on 2026-07-04 that "all oracles
// now carry the same category set". That clause was false when written:
// `src/Core.Rust.ZetaId/src/lib.rs` stopped at `WORK_ITEM = 8` and carried neither
// `CONTENT_ADDRESS = 9`, `INVENTORY_ASSET = 10`, `CHANNEL = 11` nor `EXTENDED = 15`.
// Three oracles agreed, the fourth had drifted, and nobody noticed for seven weeks —
// because the claim was PROSE. A wire-format vocabulary asserted in a comment is the
// vacuity class: it reads as a guarantee and constrains nothing.
//
// This is that claim made checkable. It compares the vocabulary as TEXT across the four
// oracle source files and the registry, which is the level the agreement actually lives
// at — an enum member missing from one language is invisible to any behavioural test that
// never names it.
//
// WHAT IT DOES NOT COVER, stated so it is not mistaken for more than it is: agreeing on
// `Agenda = 12` is agreement on the NAME and the NUMBER, not on the ENCODING. The
// cross-verification fixture `tests/cross-verification/zeta-id/vectors.yaml` is
// Observation-layout only (`pack` refuses `category >= 9`), so categories 9, 10, 11 and 12
// have NO golden vector in any oracle. That gap is real, predates this file, and is filed
// as its own work-item — see `docs/DECISIONS/2026-08-23-zetaid-keyed-agenda-declarations.md`.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import { Category } from "./types";

const REPO_ROOT = normalize(join(__dirname, "..", "..", ".."));
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

/** SCREAMING_SNAKE (Rust) → PascalCase (everyone else). */
function pascalOfScreaming(s: string): string {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function stripComments(line: string, marker: string): string {
  const i = line.indexOf(marker);
  return i === -1 ? line : line.slice(0, i);
}

/** `  - id: 12` / `    name: Agenda` pairs, comment lines skipped. */
function parseRegistry(text: string): Map<string, number> {
  const out = new Map<string, number>();
  let pending: number | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("#")) continue;
    const id = /^-\s+id:\s*(\d+)\s*$/.exec(line);
    if (id) {
      pending = Number.parseInt(id[1]!, 10);
      continue;
    }
    const name = /^name:\s*(\S+)\s*$/.exec(line);
    if (name && pending !== null) {
      out.set(name[1]!, pending);
      pending = null;
    }
  }
  return out;
}

/** TypeScript `Category` const object — the in-process source of truth. */
function tsVocabulary(): Map<string, number> {
  return new Map(Object.entries(Category).map(([k, v]) => [k, v as number]));
}

/** C# `Name = 12,` inside `public enum Category`. */
function csharpVocabulary(): Map<string, number> {
  const out = new Map<string, number>();
  for (const raw of read("src/Core.CSharp.ZetaId/Category.cs").split("\n")) {
    const m = /^\s*([A-Z][A-Za-z0-9]*)\s*=\s*(\d+)\s*,/.exec(stripComments(raw, "//"));
    if (m) out.set(m[1]!, Number.parseInt(m[2]!, 10));
  }
  return out;
}

/** F# `| Name = 12uy` inside `type Category`. */
function fsharpVocabulary(): Map<string, number> {
  const out = new Map<string, number>();
  const text = read("src/Core.FSharp.ZetaId/Types.fs");
  const start = text.indexOf("type Category =");
  expect(start).toBeGreaterThan(-1);
  const block = text.slice(start, text.indexOf("type Persona", start));
  for (const raw of block.split("\n")) {
    const m = /^\s*\|\s*([A-Z][A-Za-z0-9]*)\s*=\s*(\d+)uy/.exec(stripComments(raw, "//"));
    if (m) out.set(m[1]!, Number.parseInt(m[2]!, 10));
  }
  return out;
}

/** Rust `pub const NAME: u8 = 12;` inside `pub mod category`. */
function rustVocabulary(): Map<string, number> {
  const out = new Map<string, number>();
  const text = read("src/Core.Rust.ZetaId/src/lib.rs");
  const start = text.indexOf("pub mod category {");
  expect(start).toBeGreaterThan(-1);
  const block = text.slice(start, text.indexOf("pub mod persona", start));
  for (const raw of block.split("\n")) {
    const m = /^\s*pub const ([A-Z][A-Z0-9_]*)\s*:\s*u8\s*=\s*(\d+)\s*;/.exec(stripComments(raw, "///"));
    if (m) out.set(pascalOfScreaming(m[1]!), Number.parseInt(m[2]!, 10));
  }
  return out;
}

// ORDINAL, not `localeCompare`. A culture-sensitive comparison here would make the
// agreement verdict depend on the runner's locale — a four-oracle byte-lock check whose
// own ordering is not byte-locked. `<`/`>` on strings is UTF-16 code-unit order, which is
// what `.claude/rules/culture-invariant-by-default.md` requires.
const ordinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => a[1] - b[1] || ordinal(a[0], b[0]));

// ── The parsers must actually find something ────────────────────────────────
// Without these, a regex that silently matches nothing turns every agreement
// assertion below into `{} === {}` — a check that cannot fail.

test("each oracle parser extracts a non-trivial vocabulary (anti-vacuity)", () => {
  for (const [name, vocab] of [
    ["typescript", tsVocabulary()],
    ["csharp", csharpVocabulary()],
    ["fsharp", fsharpVocabulary()],
    ["rust", rustVocabulary()],
    ["registry", parseRegistry(read("registry/categories.yaml"))],
  ] as const) {
    expect({ name, size: vocab.size >= 12 }).toEqual({ name, size: true });
    expect({ name, hasWorkItem: vocab.get("WorkItem") }).toEqual({ name, hasWorkItem: 8 });
  }
});

// ── The agreement ───────────────────────────────────────────────────────────

test("C# / F# / Rust carry the same Category vocabulary as TypeScript", () => {
  const ts = sorted(tsVocabulary());
  expect(sorted(csharpVocabulary())).toEqual(ts);
  expect(sorted(fsharpVocabulary())).toEqual(ts);
  expect(sorted(rustVocabulary())).toEqual(ts);
});

test("registry/categories.yaml is a prefix of the oracle vocabulary (Extended is code-only)", () => {
  const ts = tsVocabulary();
  for (const [name, id] of parseRegistry(read("registry/categories.yaml"))) {
    expect({ name, id: ts.get(name) }).toEqual({ name, id });
  }
});

test("every allocated slot below Extended is registered in registry/categories.yaml", () => {
  const registry = parseRegistry(read("registry/categories.yaml"));
  for (const [name, id] of tsVocabulary()) {
    if ((id as number) >= Category.Extended) continue; // Extended is the escape marker, not an allocation
    expect({ name, registered: registry.has(name) }).toEqual({ name, registered: true });
  }
});

// ── The allocation this file was written alongside ──────────────────────────

test("Agenda is allocated at 12, in every oracle and the registry", () => {
  expect(Category.Agenda).toBe(12);
  expect(csharpVocabulary().get("Agenda")).toBe(12);
  expect(fsharpVocabulary().get("Agenda")).toBe(12);
  expect(rustVocabulary().get("Agenda")).toBe(12);
  expect(parseRegistry(read("registry/categories.yaml")).get("Agenda")).toBe(12);
});

test("the allocation was additive: no existing number moved (NO-SHIFT discipline)", () => {
  // The numbering carries a documented no-shift history — bit 64's removal in 2026-08-11
  // was made specifically so Category stayed at offset 65. Adding a member must never
  // renumber one, because every id already minted decodes by number, not by name.
  const ts = tsVocabulary();
  for (const [name, id] of [
    ["Observation", 0], ["Emission", 1], ["Workflow", 2], ["Heartbeat", 3], ["Batch", 4],
    ["FrictionTelemetry", 5], ["Bus", 6], ["Spawn", 7], ["WorkItem", 8], ["ContentAddress", 9],
    ["InventoryAsset", 10], ["Channel", 11], ["Extended", 15],
  ] as const) {
    expect({ name, id: ts.get(name) }).toEqual({ name, id });
  }
});

test("13 and 14 are still free, and Extended (15) is the path beyond them", () => {
  const taken = new Set(tsVocabulary().values());
  expect(taken.has(13)).toBe(false);
  expect(taken.has(14)).toBe(false);
  expect(Category.Extended).toBe(15);
});
