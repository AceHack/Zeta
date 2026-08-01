#!/usr/bin/env bun
// lint-fused-persona-cell.ts — ADR phase 5 hygiene lint.
//
// Treaty Article 1 (docs/research/2026-07-03-persona-cell-identity-treaty-
// dv2-hub-satellite-spiffe-alignment-proposed.md): "No layer — bus, keys,
// signatures, filesystem, branch names, registries — may store the pair as
// a fused string … String projections exist only at edges, produced and
// parsed by exactly one module." That module is
// src/Core.TypeScript/identity/actor-ref.ts (+ its F# oracle twin).
//
// This lint finds fused persona⊕cell string literals ("otto-cli",
// "otto/cli", "vera/codex/2@node7", …) in source files OUTSIDE the parser
// module. Expand-contract aware: known pre-phase-8 offenders live in a
// BASELINE file (ratchet — shrink-only); anything not in the baseline
// fails the build.
//
// Vocabulary note: the surface set used here is registry-derived (closed
// vocabulary keeps false positives near zero). A fused literal with an
// unregistered surface cannot be flagged by this lint — the open cell set
// is by design unenumerable (treaty containment clause). The byte-lock
// parser remains the enforcement point for those.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/lint-fused-persona-cell.ts
//   bun src/Core.TypeScript/hygiene/lint-fused-persona-cell.ts --update-baseline
//   bun src/Core.TypeScript/hygiene/lint-fused-persona-cell.ts --strict   # baseline also fails (phase-8 contract mode)
//
// Line-level exemption: append a comment containing `fused-ok:<reason>`.
//
// Exit codes:
//   0 — clean (violations only in baseline, unless --strict)
//   1 — new fused literal found (or any, with --strict)
//   2 — tooling / input error

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import * as path from "node:path";

import { CELL_SURFACES, VALID_PERSONAS } from "../identity/generated-registry.ts";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * Surfaces that exist operationally but are not yet in cell-surfaces.yaml.
 * Empty since the 2026-07-08 registry catch-up (cowork/browser-tab/chat
 * added — open finding 2026-07-04 closed). Add here only as a stopgap
 * while a registry PR is in flight — the registry is the source of truth.
 */
export const PENDING_REGISTRY_SURFACES: readonly string[] = [];

export function surfaceVocabulary(): Set<string> {
  const s = new Set<string>(CELL_SURFACES);
  for (const extra of PENDING_REGISTRY_SURFACES) s.add(extra);
  return s;
}

// ---------------------------------------------------------------------------
// Detection (pure)
// ---------------------------------------------------------------------------

export interface Finding {
  readonly file: string;
  readonly line: number; // 1-based
  readonly literal: string; // the fused token found
  readonly form: "hyphen" | "slash";
}

const SEG = "[a-z0-9][a-z0-9._-]*";
// Char class that may NOT precede a fused token (prevents matching inside
// longer hyphenated tokens such as doc-slug filenames: "…-lior-gemini-…").
const NOT_BEFORE = "[a-z0-9._/@-]";

/** String literals on one line: '…' "…" `…` (line-local; template spans ignored). */
const LITERAL_RE = /'([^'\\]*)'|"([^"\\]*)"|`([^`\\]*)`/g;

const EXEMPT_MARKER = "fused-ok:";

function buildMatchers(
  personas: readonly string[],
  surfaces: readonly string[],
): {
  hyphen: RegExp;
  slash: RegExp;
} {
  const p = personas.map(escapeRe).join("|");
  const s = surfaces.map(escapeRe).join("|");
  // otto-cli  (legacy composite form)
  const hyphen = new RegExp(`(^|(?!${NOT_BEFORE}).)(?:${p})-(?:${s})(?![a-z0-9._-])`, "g");
  // otto/cli, otto/cli/2, otto/cli/2@node7  (canonical projection form)
  const slash = new RegExp(`(^|(?!${NOT_BEFORE}).)(?:${p})/(?:${s})(?:/${SEG})?(?:@${SEG})?(?![a-z0-9._@/-])`, "g");
  return { hyphen, slash };
}

function escapeRe(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Scan one file's source text for fused persona-cell string literals.
 * Pure — no filesystem access.
 */
export function findFusedLiterals(
  source: string,
  filePath: string,
  personas: readonly string[] = [...VALID_PERSONAS],
  surfaces: readonly string[] = [...surfaceVocabulary()],
): Finding[] {
  const { hyphen, slash } = buildMatchers(personas, surfaces);
  const findings: Finding[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.includes(EXEMPT_MARKER)) continue;

    LITERAL_RE.lastIndex = 0;
    let lit: RegExpExecArray | null = LITERAL_RE.exec(line);
    while (lit !== null) {
      const content = lit[1] ?? lit[2] ?? lit[3] ?? "";
      for (const [form, re] of [["hyphen", hyphen] as const, ["slash", slash] as const]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null = re.exec(content);
        while (m !== null) {
          const lead = m[1] ?? "";
          const token = m[0].startsWith(lead) ? m[0].slice(lead.length) : m[0];
          findings.push({ file: filePath, line: i + 1, literal: token, form });
          m = re.exec(content);
        }
      }
      lit = LITERAL_RE.exec(line);
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Scope / allowlist
// ---------------------------------------------------------------------------

/** The one module (treaty Art. 1) + its golden vectors + registry codegen. */
export const PARSER_MODULE_ALLOWLIST: readonly string[] = [
  "src/Core.TypeScript/identity/actor-ref.ts",
  "src/Core.TypeScript/identity/actor-ref.test.ts",
  "src/Core.TypeScript/identity/generated-registry.ts",
  "src/Core/ActorRef.fs", // F# oracle twin of the one module
  "tests/Tests.FSharp/ActorRef.Tests.fs", // F# oracle golden vectors
  "tests/cross-verification/golden-vectors/actor-ref.json",
  // this lint (its own vocabulary/test fixtures)
  "src/Core.TypeScript/hygiene/lint-fused-persona-cell.ts",
  "src/Core.TypeScript/hygiene/lint-fused-persona-cell.test.ts",
];

export function isAllowlisted(filePath: string): boolean {
  return PARSER_MODULE_ALLOWLIST.includes(filePath.replace(/\\/g, "/"));
}

const SCAN_EXTENSIONS = new Set([".ts", ".js", ".mjs", ".cjs", ".fs", ".fsx", ".fsi", ".py", ".sh"]);

export function isInScope(filePath: string): boolean {
  const p = filePath.replace(/\\/g, "/");
  if (!/^(src|tools|tests)\//.test(p)) return false;
  if (!SCAN_EXTENSIONS.has(path.extname(p))) return false;
  return !isAllowlisted(p);
}

// ---------------------------------------------------------------------------
// Baseline (ratchet)
// ---------------------------------------------------------------------------

export const BASELINE_PATH = "src/Core.TypeScript/hygiene/lint-fused-persona-cell.baseline.json";

export interface Baseline {
  readonly description: string;
  readonly entries: readonly string[]; // "file:literal" (line-insensitive; survives drift)
}

export function baselineKey(f: Finding): string {
  return `${f.file}:${f.literal}`;
}

export function splitByBaseline(
  findings: readonly Finding[],
  baseline: ReadonlySet<string>,
): { grandfathered: Finding[]; violations: Finding[] } {
  const grandfathered: Finding[] = [];
  const violations: Finding[] = [];
  for (const f of findings) {
    (baseline.has(baselineKey(f)) ? grandfathered : violations).push(f);
  }
  return { grandfathered, violations };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function trackedFiles(repoRoot: string): string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("git", ["ls-files", "--", "src", "tools", "tests"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`git ls-files failed: ${r.stderr}`);
  }
  return r.stdout.split("\n").filter((f) => f.length > 0);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const strict = argv.includes("--strict");
  const updateBaseline = argv.includes("--update-baseline");
  const repoRoot = process.cwd();

  let files: string[];
  try {
    files = trackedFiles(repoRoot).filter(isInScope);
  } catch (err) {
    console.error(String(err));
    return 2;
  }

  const all: Finding[] = [];
  for (const f of files) {
    let text: string;
    try {
      text = readFileSync(path.join(repoRoot, f), "utf8");
    } catch {
      continue; // deleted in working tree etc.
    }
    all.push(...findFusedLiterals(text, f));
  }

  if (updateBaseline) {
    const entries = [...new Set(all.map(baselineKey))].sort();
    const doc: Baseline = {
      description:
        "Grandfathered fused persona-cell literals (pre-phase-8). Ratchet: shrink-only — never add entries by hand; phase-8 contract drives this to [].",
      entries,
    };
    writeFileSync(path.join(repoRoot, BASELINE_PATH), `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`baseline written: ${entries.length} entries -> ${BASELINE_PATH}`);
    return 0;
  }

  let baseline = new Set<string>();
  const baselineFile = path.join(repoRoot, BASELINE_PATH);
  if (existsSync(baselineFile)) {
    try {
      const doc = JSON.parse(readFileSync(baselineFile, "utf8")) as Baseline;
      baseline = new Set(doc.entries);
    } catch (err) {
      console.error(`unreadable baseline ${BASELINE_PATH}: ${String(err)}`);
      return 2;
    }
  }

  const { grandfathered, violations } = splitByBaseline(all, baseline);

  for (const f of grandfathered) {
    console.log(`LEGACY    ${f.file}:${f.line}  "${f.literal}" (${f.form}; baseline, phase-8 contract target)`);
  }
  for (const f of violations) {
    console.log(
      `VIOLATION ${f.file}:${f.line}  "${f.literal}" (${f.form}) — store the record (ActorRef), not the projection; parse/project only via identity/actor-ref.ts (treaty Art. 1)`,
    );
  }

  const stale = [...baseline].filter((k) => !all.some((f) => baselineKey(f) === k));
  for (const k of stale) {
    console.log(`STALE     baseline entry no longer found: ${k} (run --update-baseline to ratchet down)`);
  }

  console.log(
    `summary: ${files.length} files scanned, ${grandfathered.length} legacy (baseline), ${violations.length} new, ${stale.length} stale baseline entries`,
  );

  if (violations.length > 0) return 1;
  if (strict && grandfathered.length > 0) return 1;
  return 0;
}

const invokedDirectly =
  typeof process.argv[1] === "string" && /lint-fused-persona-cell\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  process.exit(main());
}
