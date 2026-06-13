#!/usr/bin/env bun
// audit_clause_coverage.ts — alignment-clause coverage audit.
//
// B-0058: new-surface alignment-clause consistency check.
// Scans .claude/skills/*/SKILL.md, .claude/agents/*.md, and
// docs/backlog/P0/*.md + docs/backlog/P1/*.md for references to
// alignment clauses (HC-1..HC-7, SD-1..SD-9, DIR-1..DIR-5) from
// docs/ALIGNMENT.md. Reports which surfaces cite which clauses and
// flags surfaces with zero clause references as coverage gaps.
//
// This is a detection surface, not a gate — it does not block commits.
// The alignment-auditor uses this output to prioritize clause-coverage
// improvements. The --gate flag optionally fails if any surface has
// fewer than N clause citations (advisory, not enforcement).
//
// Usage:
//   bun tools/alignment/audit_clause_coverage.ts
//   bun tools/alignment/audit_clause_coverage.ts --json
//   bun tools/alignment/audit_clause_coverage.ts --md
//   bun tools/alignment/audit_clause_coverage.ts --out DIR
//   bun tools/alignment/audit_clause_coverage.ts --gate N
//
// Exit codes:
//   0  Clean run (or no surfaces found)
//   1  Gate tripped (when --gate N given and any surface has < N citations)
//   2  Script error / bad args

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

type AuditExitCode = 0 | 1 | 2;

export const ALL_CLAUSES: readonly string[] = [
  "HC-1", "HC-2", "HC-3", "HC-4", "HC-5", "HC-6", "HC-7",
  "SD-1", "SD-2", "SD-3", "SD-4", "SD-5", "SD-6", "SD-7", "SD-8", "SD-9",
  "DIR-1", "DIR-2", "DIR-3", "DIR-4", "DIR-5",
] as const;

interface Args {
  readonly json: boolean;
  readonly md: boolean;
  readonly outDir: string | null;
  readonly gate: number | null;
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

type SurfaceKind = "skill" | "agent" | "backlog";

interface SurfaceRow {
  readonly kind: SurfaceKind;
  readonly name: string;
  readonly path: string;
  readonly clausesCited: readonly string[];
  readonly clauseCount: number;
}

interface AuditResult {
  readonly schema: string;
  readonly totalSurfaces: number;
  readonly totalWithZero: number;
  readonly totalClauses: number;
  readonly surfaces: readonly SurfaceRow[];
  readonly uncitedClauses: readonly string[];
}

function repoRoot(): string {
  const result = spawnSync(
    "git", // eslint-disable-line sonarjs/no-os-command-from-path
    ["rev-parse", "--show-toplevel"],
    { encoding: "utf8" },
  );
  if (result.error) throw new Error(`git rev-parse failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`git rev-parse exited with status ${String(result.status)}`);
  return result.stdout.trim();
}

function parseArgs(argv: readonly string[]): ParseResult {
  const state = {
    json: false,
    md: false,
    outDir: null as string | null,
    gate: null as number | null,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    if (arg === "--json") { state.json = true; i += 1; continue; }
    if (arg === "--md") { state.md = true; i += 1; continue; }
    if (arg === "--out") {
      const next = argv[i + 1];
      if (next === undefined) return { kind: "error", message: "audit_clause_coverage: --out requires a directory" };
      state.outDir = next;
      i += 2;
      continue;
    }
    if (arg === "--gate") {
      const next = argv[i + 1];
      if (next === undefined) return { kind: "error", message: "audit_clause_coverage: --gate requires a number" };
      const n = Number(next);
      if (!Number.isFinite(n) || n < 0) return { kind: "error", message: `audit_clause_coverage: invalid gate value: ${next}` };
      state.gate = n;
      i += 2;
      continue;
    }
    return { kind: "error", message: `audit_clause_coverage: unknown arg: ${arg}` };
  }
  return { kind: "args", args: state };
}

export function extractClauses(content: string): readonly string[] {
  const found = new Set<string>();
  const re = /\b(HC-[1-7]|SD-[1-9]|DIR-[1-5])\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const clause = match[1];
    if (clause !== undefined) found.add(clause);
  }
  return ALL_CLAUSES.filter((c) => found.has(c));
}

function listSkillSurfaces(): readonly SurfaceRow[] {
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = readdirSync(".claude/skills", { withFileTypes: true });
  } catch {
    return [];
  }
  const rows: SurfaceRow[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith("_")) continue;
    const path = `.claude/skills/${e.name}/SKILL.md`;
    let content: string;
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const clausesCited = extractClauses(content);
    rows.push({
      kind: "skill",
      name: e.name,
      path,
      clausesCited,
      clauseCount: clausesCited.length,
    });
  }
  rows.sort((a, b) => byteCompare(a.name, b.name));
  return rows;
}

function listAgentSurfaces(): readonly SurfaceRow[] {
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = readdirSync(".claude/agents", { withFileTypes: true });
  } catch {
    return [];
  }
  const rows: SurfaceRow[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith(".md")) continue;
    const path = `.claude/agents/${e.name}`;
    let content: string;
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const name = e.name.replace(/\.md$/, "");
    const clausesCited = extractClauses(content);
    rows.push({
      kind: "agent",
      name,
      path,
      clausesCited,
      clauseCount: clausesCited.length,
    });
  }
  rows.sort((a, b) => byteCompare(a.name, b.name));
  return rows;
}

function listBacklogSurfaces(): readonly SurfaceRow[] {
  const rows: SurfaceRow[] = [];
  for (const priority of ["P0", "P1"] as const) {
    const dir = `docs/backlog/${priority}`;
    let entries: readonly import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (!e.name.endsWith(".md")) continue;
      const path = `${dir}/${e.name}`;
      let content: string;
      try {
        content = readFileSync(path, "utf8");
      } catch {
        continue;
      }
      const idMatch = /^(B-\d+)/.exec(e.name);
      const name = idMatch !== null ? (idMatch[1] ?? e.name) : e.name;
      const clausesCited = extractClauses(content);
      rows.push({
        kind: "backlog",
        name,
        path,
        clausesCited,
        clauseCount: clausesCited.length,
      });
    }
  }
  rows.sort((a, b) => byteCompare(a.name, b.name));
  return rows;
}

function byteCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function audit(): AuditResult {
  const skills = listSkillSurfaces();
  const agents = listAgentSurfaces();
  const backlog = listBacklogSurfaces();
  const surfaces = [...skills, ...agents, ...backlog];

  const allCited = new Set<string>();
  for (const s of surfaces) {
    for (const c of s.clausesCited) allCited.add(c);
  }
  const uncitedClauses = ALL_CLAUSES.filter((c) => !allCited.has(c));

  return {
    schema: "alignment-clause-coverage-v2",
    totalSurfaces: surfaces.length,
    totalWithZero: surfaces.filter((s) => s.clauseCount === 0).length,
    totalClauses: ALL_CLAUSES.length,
    surfaces,
    uncitedClauses,
  };
}

function emitJson(r: AuditResult): string {
  const payload = {
    schema: r.schema,
    total_surfaces: r.totalSurfaces,
    total_with_zero_clauses: r.totalWithZero,
    total_alignment_clauses: r.totalClauses,
    uncited_clauses: r.uncitedClauses,
    surfaces: r.surfaces.map((s) => ({
      kind: s.kind,
      name: s.name,
      path: s.path,
      clauses_cited: s.clausesCited,
      clause_count: s.clauseCount,
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function emitMd(r: AuditResult): string {
  const lines: string[] = [];
  lines.push("# Alignment-clause coverage audit");
  lines.push("");
  lines.push(`Schema: \`${r.schema}\`. Clauses from \`docs/ALIGNMENT.md\`: ${String(r.totalClauses)}.`);
  lines.push("");
  const skillCount = r.surfaces.filter((s) => s.kind === "skill").length;
  const agentCount = r.surfaces.filter((s) => s.kind === "agent").length;
  const backlogCount = r.surfaces.filter((s) => s.kind === "backlog").length;
  lines.push(`Surfaces audited: **${String(r.totalSurfaces)}** (${String(skillCount)} skills, ${String(agentCount)} agents, ${String(backlogCount)} backlog P0/P1).`);
  lines.push(`Surfaces with zero clause citations: **${String(r.totalWithZero)}**.`);
  if (r.uncitedClauses.length > 0) {
    lines.push(`Clauses cited by no surface: **${r.uncitedClauses.join(", ")}**.`);
  } else {
    lines.push("All clauses cited by at least one surface.");
  }
  lines.push("");
  lines.push("| Kind | Name | Clauses cited | Count |");
  lines.push("| --- | --- | --- | --- |");
  for (const s of r.surfaces) {
    const cited = s.clausesCited.length > 0 ? s.clausesCited.join(", ") : "(none)";
    lines.push(`| ${s.kind} | ${s.name} | ${cited} | ${String(s.clauseCount)} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function emitHumanSummary(r: AuditResult): string {
  const lines: string[] = [];
  lines.push(`surfaces=${String(r.totalSurfaces)} zero_coverage=${String(r.totalWithZero)} clauses=${String(r.totalClauses)}`);
  if (r.uncitedClauses.length > 0) {
    lines.push(`uncited: ${r.uncitedClauses.join(", ")}`);
  }
  lines.push("");

  const zeroes = r.surfaces.filter((s) => s.clauseCount === 0);
  if (zeroes.length > 0) {
    lines.push("Surfaces with zero clause citations:");
    for (const s of zeroes) {
      lines.push(`  [${s.kind}] ${s.name}`);
    }
    lines.push("");
  }

  const nonZero = r.surfaces.filter((s) => s.clauseCount > 0);
  if (nonZero.length > 0) {
    lines.push("Surfaces with clause citations:");
    for (const s of nonZero) {
      lines.push(`  [${s.kind}] ${s.name.padEnd(45)} ${s.clausesCited.join(", ")}`);
    }
  }
  return lines.join("\n");
}

export function main(argv: readonly string[]): AuditExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(
      "Usage: audit_clause_coverage.ts [--json | --md] [--out DIR] [--gate N]\n",
    );
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 2;
  }
  const { args } = parsed;

  process.chdir(repoRoot());

  const result = audit();

  if (args.outDir !== null) {
    mkdirSync(args.outDir, { recursive: true });
    writeFileSync(
      join(args.outDir, "clause-coverage.json"),
      emitJson(result),
    );
    writeFileSync(
      join(args.outDir, "clause-coverage.md"),
      emitMd(result),
    );
    process.stdout.write(
      `audit_clause_coverage: wrote ${args.outDir}/clause-coverage.{json,md}\n`,
    );
  } else if (args.json) {
    process.stdout.write(emitJson(result));
  } else if (args.md) {
    process.stdout.write(emitMd(result));
  } else {
    process.stdout.write(`${emitHumanSummary(result)}\n`);
  }

  if (args.gate !== null) {
    const gateN = args.gate;
    const failing = result.surfaces.filter((s) => s.clauseCount < gateN);
    if (failing.length > 0) {
      for (const f of failing) {
        process.stderr.write(
          `audit_clause_coverage: ${f.name} (${f.kind}) has ${String(f.clauseCount)} clauses < gate ${String(gateN)}\n`,
        );
      }
      return 1;
    }
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
