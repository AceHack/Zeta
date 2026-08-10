#!/usr/bin/env bun
// memory-reindex-certified.ts — the SECOND named subject of the healer
// workitem ("First subjects: the MD032/MD026 safe fixer, reindex-memory-md")
// certified and wired as gyroscope axis 3. The 2026-07-08 incident's closure
// violation was EXACTLY this file going stale under other heals; with the
// reindexer running certified on every tick, MEMORY.md cannot stale by
// construction.
//
// Certification design (differs from the md fixer deliberately): the
// staleness detector DERIVES FROM THE GENERATOR ITSELF — stale ⟺ current
// content ≠ regeneration — the `gen(gen) == gen` pattern (only-the-
// irreducible-is-primitive: regeneration IS the correction, build = verify).
// Independent teeth come from the harness's trailing-space and code-span
// detectors over the generated output. The harness's toy memory detector is
// EXCLUDED on purpose: it asserts a toy index convention the real generator
// does not speak; certifying against it would fail closure spuriously.
// (Real markdown discipline for MEMORY.md is owned by the repo's actual
// markdownlint config + the certified md fixer running on the same tick.)
//
// The healer reuses the REAL generator's exported pieces (parseFrontmatter,
// renderIndex) and replicates only the filesystem walk over the harness's
// pure FileTree — certified logic == applied logic.

import { readFile, writeFile } from "node:fs/promises";

import {
  parseFrontmatter,
  renderIndex,
  collectEntries,
} from "../../memory/reindex-memory-md.ts";
import {
  certify,
  codeSpanIntegrityDetector,
  trailingSpaceDetector,
  tree,
  type Detector,
  type FileTree,
  type Fixture,
  type Healer,
  type Verdict,
} from "../healer-harness.ts";

// ── FileTree replica of the generator's collection walk ─────────────────────

interface TreeEntry {
  filename: string;
  fm: { name?: string; description?: string; created?: string };
  date: string;
  mtime: number;
}

function dateFromFilename(filename: string): string {
  const match = filename.match(/(\d{4})[_-](\d{2})[_-](\d{2})/);
  if (!match) return "0000-00-00";
  return `${match[1]!}-${match[2]!}-${match[3]!}`;
}

export function collectFromTree(t: FileTree): TreeEntry[] {
  const entries: TreeEntry[] = [];
  for (const [path, content] of t) {
    if (!path.startsWith("memory/") || !path.endsWith(".md")) continue;
    const base = path.split("/").pop()!;
    if (base === "MEMORY.md" || base === "README.md" || base.startsWith("CURRENT-")) continue;
    const fm = parseFrontmatter(content);
    if (!fm) continue;
    const filename = path.slice("memory/".length);
    const date = fm.created ?? dateFromFilename(base);
    entries.push({ filename, fm, date, mtime: 0 });
  }
  entries.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    return dateCmp !== 0 ? dateCmp : a.filename.localeCompare(b.filename);
  });
  return entries;
}

function markerOf(existing: string | undefined): string | undefined {
  return existing?.match(/^\[AutoDream last run: [^\]]+\]/m)?.[0];
}

export function regenerate(t: FileTree): string {
  return renderIndex(collectFromTree(t), markerOf(t.get("memory/MEMORY.md")));
}

// ── Healer + generator-derived detector ─────────────────────────────────────

export const memoryReindexHealer: Healer = {
  name: "memory-reindex-certified",
  heal: (t: FileTree): FileTree => {
    if (![...t.keys()].some((p) => p.startsWith("memory/"))) return new Map(t);
    const out = new Map(t);
    out.set("memory/MEMORY.md", regenerate(t));
    return out;
  },
};

/** gen(gen) == gen: stale ⟺ content differs from its own regeneration. */
export const memoryIndexRealDetector: Detector = {
  name: "memory-index-real-staleness",
  detect: (t) => {
    if (![...t.keys()].some((p) => p.startsWith("memory/"))) return [];
    const current = t.get("memory/MEMORY.md");
    return current === regenerate(t)
      ? []
      : [{ path: "memory/MEMORY.md", rule: "memory-index-real-staleness", detail: "index differs from regeneration" }];
  },
};

const fmNote = (name: string, created: string, desc: string): string =>
  `---\nname: ${name}\ndescription: "${desc}"\nmetadata:\n  type: project\ncreated: ${created}\n---\n\nbody\n`;

export const MEMORY_FIXTURES: readonly Fixture[] = [
  {
    name: "stale-index-real-shape",
    tree: tree({
      "memory/2026-08-01-alpha.md": fmNote("alpha", "2026-08-01", "first note"),
      "memory/2026-08-09-beta.md": fmNote("beta", "2026-08-09", "second note"),
      "memory/MEMORY.md": "[AutoDream last run: 2026-04-23]\n\nutterly stale\n",
      "src/unrelated.ts": "const x = 1;\n",
    }),
  },
  {
    name: "no-memory-dir-is-a-noop",
    tree: tree({ "docs/a.md": "# Hello\n\nBody.\n" }),
  },
];

export function certifyMemoryReindex(): Verdict {
  return certify(
    memoryReindexHealer,
    [memoryIndexRealDetector, trailingSpaceDetector, codeSpanIntegrityDetector],
    MEMORY_FIXTURES,
  );
}

// ── CLI: certify, THEN reindex the real filesystem (the write gate) ─────────

const invokedDirectly =
  typeof process.argv[1] === "string" && /memory-reindex-certified\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const verdict = certifyMemoryReindex();
  if (!verdict.pass) {
    console.error(`GATE: ${memoryReindexHealer.name} FAILED certification — write access refused.`);
    for (const v of verdict.violations) console.error(`  ${v.law} on ${v.fixture}: ${v.detail}`);
    process.exit(2);
  }
  console.log(`GATE: ${memoryReindexHealer.name} certified — write access granted.`);
  const entries = await collectEntries();
  const existing = await readFile("memory/MEMORY.md", "utf8").catch(() => "");
  const rendered = renderIndex(entries, markerOf(existing));
  if (rendered === existing) {
    console.log("OK: MEMORY.md already current");
  } else {
    await writeFile("memory/MEMORY.md", rendered);
    console.log(`healed: memory/MEMORY.md (${String(entries.length)} entries)`);
  }
  process.exit(0);
}
