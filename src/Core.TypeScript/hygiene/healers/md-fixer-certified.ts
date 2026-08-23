#!/usr/bin/env bun
// md-fixer-certified.ts — the production MD032/MD026/MD022 fixer, adapted into the
// healer harness and GATED on certification (workitem 081KX3KA3F008QG0R0022EF9R8,
// final scope: "First subjects: the MD032/MD026 safe fixer … Gate healer
// write access on passing it").
//
// The adapter wraps the EXACT exported production transform
// (fixMarkdownText — the same function the raw CLI applies), so what the
// harness certifies is what the write path runs; there is no adapter-only
// code that could pass laws the production path violates.
//
// THE WRITE-ACCESS GATE: the CLI here re-certifies the healer against the
// three laws (idempotence byte-for-byte, closure-as-subset across ALL
// reference detectors, convergence within budget) over the built-in incident
// corpus (the 2026-07-08 oscillation + MEMORY.md-staling counterexamples as
// golden vectors) PLUS the md-specific fixtures below, ON EVERY INVOCATION,
// before touching a single file. Certification failure ⇒ exit 2, nothing
// written. A healer's write access is not a standing privilege; it is
// re-earned at each run (interfaces-free-classes-earned: the privilege is
// justified under rules/, and the justification is executable).
//
// Usage (drop-in for the raw fixer in lint-autofix.yml's produce job):
//   bun src/Core.TypeScript/hygiene/healers/md-fixer-certified.ts FILE [FILE ...]
//   bun src/Core.TypeScript/hygiene/healers/md-fixer-certified.ts --certify-only
//
// Exit codes: 0 healed/no-op · 2 CERTIFICATION FAILED (nothing written) or usage.

import { readFileSync, writeFileSync } from "node:fs";

import { fixMarkdownText } from "../fix-markdown-md032-md026.ts";
import {
  BUILTIN_FIXTURES,
  certify,
  REFERENCE_DETECTORS,
  tree,
  type FileTree,
  type Fixture,
  type Healer,
  type Verdict,
} from "../healer-harness.ts";

/** The production fixer as a harness Healer: applies fixMarkdownText to
 * every .md file, leaves every other path byte-identical (closure begins
 * with not touching what you do not own). */
export const mdFixerHealer: Healer = {
  name: "md032-md026-production-fixer",
  heal: (t: FileTree): FileTree => {
    const out = new Map<string, string>();
    for (const [path, content] of t) {
      out.set(path, path.endsWith(".md") ? fixMarkdownText(content) : content);
    }
    return out;
  },
};

/** Md-specific fixtures, beyond the shared incident corpus: the fixer's own
 * happy paths and its known must-not-touch regions. */
export const MD_FIXER_FIXTURES: readonly Fixture[] = [
  {
    name: "md032-list-needs-blanks",
    tree: tree({
      "docs/list.md": "Intro line\n- item one\n- item two\nOutro line\n",
      "src/code.ts": "const x = 1; // not markdown — must stay byte-identical\n",
    }),
  },
  {
    name: "md026-heading-punctuation",
    tree: tree({
      "docs/heads.md": "# Heading ends badly.\n\nBody text.\n\n## Another one:\n\nMore body.\n",
    }),
  },
  {
    name: "fenced-code-untouchable",
    tree: tree({
      "docs/fence.md": "# Ok\n\n```text\n- not a real list\n# not a real heading.\n```\n\nDone.\n",
    }),
  },
  {
    // 081KZQ3234608QG0R003D5V4B4: the class drift-evolution exposed — a
    // heading missing its surrounding blanks survived 15 ticks because no
    // certified pass owned MD022. This fixture is the live finding's shape
    // (docs/architecture/temporal-persona-triple.md, tick 73–88).
    name: "md022-heading-needs-blanks",
    tree: tree({
      "docs/md022.md": "Prose right before.\n## The Heading\nProse right after.\n\n# Top\n## Stacked heading\ntail\n",
    }),
  },
  {
    // 081M0QZF4QY087G0R000WKDYFZ — the incident, as a GOLDEN VECTOR for the
    // write gate rather than only as a unit test of the predicate.
    //
    // Both hard-wrapped numerals are the real ones the sweep edited on
    // 2026-08-23 (`docs/books/…RAW-2026-08-18-*.md:686` and
    // `docs/design/2026-08-23-clifford-gpu-theory-brief-*.md:87`). Certifying
    // over this fixture is what makes the naive re-splitter
    // (`resplitterHealer` — the harness's own reproduction of the pre-fix
    // behaviour) FAIL closure against `ol-prefix`, which it did not before the
    // detector existed.
    //
    // The third file is a genuine list missing its blanks. Stated honestly,
    // because the opposite is tempting to write: it does NOT make a
    // do-nothing healer fail certification — the three laws are idempotence,
    // closure and convergence, and a healer that heals nothing satisfies all
    // three trivially. No gate can require a fix; only a test can. The
    // "STILL HEALS" assertions in md-fixer-certified.test.ts are that check,
    // and this file is here so the incident fixture carries the same shape
    // the gate is blind to rather than pretending the gate covers it.
    name: "md029-hard-wrapped-numeral-is-prose-not-a-list",
    tree: tree({
      "docs/books/authored.md":
        "## Provenance\n\nchosen as the headline property of an installer in\n2007. It rhymes with two other things in this record:\n",
      "docs/design/brief.md":
        "# Brief\n\nthe geometric-algebra formulation of that pipeline was published in\n2016. The measured consequence is the one that matters here.\n",
      "docs/genuine-list.md": "Intro line\n1. item one\n2. item two\nOutro line\n",
    }),
  },
];

export function certifyMdFixer(): Verdict {
  return certify(mdFixerHealer, REFERENCE_DETECTORS, [...BUILTIN_FIXTURES, ...MD_FIXER_FIXTURES]);
}

// ── CLI: certify, THEN heal (the gate) ───────────────────────────────────────

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const certifyOnly = argv.includes("--certify-only");
  const files = argv.filter((a) => !a.startsWith("--"));
  if (!certifyOnly && files.length === 0) {
    console.error(
      "usage: md-fixer-certified.ts FILE [FILE ...] | --certify-only   (refuses to write if certification fails)",
    );
    process.exit(2);
  }

  const verdict = certifyMdFixer();
  if (!verdict.pass) {
    console.error(`GATE: ${mdFixerHealer.name} FAILED certification — write access refused, nothing touched.`);
    for (const v of verdict.violations) {
      console.error(`  ${v.law} on ${v.fixture}: ${v.detail}`);
    }
    process.exit(2);
  }
  console.log(`GATE: ${mdFixerHealer.name} certified (3 laws over ${String(BUILTIN_FIXTURES.length + MD_FIXER_FIXTURES.length)} fixtures) — write access granted.`);
  if (certifyOnly) process.exit(0);

  let changed = 0;
  for (const f of files) {
    let original: string;
    try {
      original = readFileSync(f, "utf8");
    } catch {
      console.log(`skip (unreadable): ${f}`);
      continue;
    }
    const fixed = fixMarkdownText(original);
    if (fixed !== original) {
      writeFileSync(f, fixed, "utf8");
      changed += 1;
      console.log(`healed: ${f}`);
    }
  }
  console.log(changed === 0 ? "OK: no changes needed" : `healed ${String(changed)} file(s)`);
  process.exit(0);
}
