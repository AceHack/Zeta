#!/usr/bin/env bun
// audit_clause_drift.ts — alignment-clause drift detection.
//
// B-0058 slice 2 (responsibility #4): alignment-clause drift detector.
// Compares docs/ALIGNMENT.md between two git refs. For each clause
// that was added, removed, or had its body text modified, reports the
// change and lists the factory surfaces that depend on it (via the
// existing audit_clause_coverage.ts surface scan).
//
// Usage:
//   bun tools/alignment/audit_clause_drift.ts
//   bun tools/alignment/audit_clause_drift.ts --base main --head HEAD
//   bun tools/alignment/audit_clause_drift.ts --json
//   bun tools/alignment/audit_clause_drift.ts --md
//
// Exit codes:
//   0  No drift detected (or informational-only drift)
//   1  Clause removed or body changed — impact survey emitted
//   2  Script error / bad args

import { spawnSync } from "node:child_process";
import { audit } from "./audit_clause_coverage.ts";

type ExitCode = 0 | 1 | 2;

const CLAUSE_HEADING_RE = /^###\s+(HC-\d+|SD-\d+|DIR-\d+)\s+(.*)$/;
const ALIGNMENT_PATH = "docs/ALIGNMENT.md";

interface ClauseSnapshot {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

interface ClauseDiff {
  readonly id: string;
  readonly kind: "added" | "removed" | "title-changed" | "body-changed";
  readonly baseTitle: string | null;
  readonly headTitle: string | null;
  readonly dependentSurfaces: readonly string[];
}

interface DriftResult {
  readonly schema: string;
  readonly baseRef: string;
  readonly headRef: string;
  readonly baseClauses: number;
  readonly headClauses: number;
  readonly diffs: readonly ClauseDiff[];
}

interface Args {
  readonly base: string;
  readonly head: string;
  readonly json: boolean;
  readonly md: boolean;
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

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

function defaultBranch(): string {
  const result = spawnSync(
    "git", // eslint-disable-line sonarjs/no-os-command-from-path
    ["rev-parse", "--abbrev-ref", "origin/HEAD"],
    { encoding: "utf8" },
  );
  if (result.error || result.status !== 0) return "main";
  const ref = result.stdout.trim();
  return ref.startsWith("origin/") ? ref.slice("origin/".length) : ref;
}

function parseArgs(argv: readonly string[]): ParseResult {
  const state = {
    base: "",
    head: "HEAD",
    json: false,
    md: false,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    if (arg === "--json") { state.json = true; i += 1; continue; }
    if (arg === "--md") { state.md = true; i += 1; continue; }
    if (arg === "--base") {
      const next = argv[i + 1];
      if (next === undefined) return { kind: "error", message: "audit_clause_drift: --base requires a ref" };
      state.base = next;
      i += 2;
      continue;
    }
    if (arg === "--head") {
      const next = argv[i + 1];
      if (next === undefined) return { kind: "error", message: "audit_clause_drift: --head requires a ref" };
      state.head = next;
      i += 2;
      continue;
    }
    return { kind: "error", message: `audit_clause_drift: unknown arg: ${arg}` };
  }
  if (state.base === "") state.base = defaultBranch();
  return { kind: "args", args: state };
}

function getFileAtRef(ref: string, path: string): string | null {
  const result = spawnSync(
    "git", // eslint-disable-line sonarjs/no-os-command-from-path
    ["show", `${ref}:${path}`],
    { encoding: "utf8" },
  );
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

function extractClauses(content: string): readonly ClauseSnapshot[] {
  const lines = content.split("\n");
  const clauses: ClauseSnapshot[] = [];
  let current: { id: string; title: string; bodyLines: string[] } | null = null;

  for (const line of lines) {
    const match = CLAUSE_HEADING_RE.exec(line);
    if (match) {
      if (current !== null) {
        clauses.push({
          id: current.id,
          title: current.title,
          body: current.bodyLines.join("\n").trim(),
        });
      }
      current = {
        id: match[1] ?? "",
        title: match[2] ?? "",
        bodyLines: [],
      };
      continue;
    }
    if (current !== null) {
      if (line.startsWith("## ") || line.startsWith("# ")) {
        clauses.push({
          id: current.id,
          title: current.title,
          body: current.bodyLines.join("\n").trim(),
        });
        current = null;
      } else {
        current.bodyLines.push(line);
      }
    }
  }
  if (current !== null) {
    clauses.push({
      id: current.id,
      title: current.title,
      body: current.bodyLines.join("\n").trim(),
    });
  }
  return clauses;
}

function buildDependencyMap(): ReadonlyMap<string, readonly string[]> {
  const result = audit();
  const map = new Map<string, string[]>();
  for (const surface of result.surfaces) {
    for (const clause of surface.clausesCited) {
      const existing = map.get(clause);
      if (existing !== undefined) {
        existing.push(`${surface.kind}:${surface.name}`);
      } else {
        map.set(clause, [`${surface.kind}:${surface.name}`]);
      }
    }
  }
  return map;
}

function computeDrift(baseRef: string, headRef: string): DriftResult {
  const baseContent = getFileAtRef(baseRef, ALIGNMENT_PATH);
  const headContent = getFileAtRef(headRef, ALIGNMENT_PATH);

  if (baseContent === null && headContent === null) {
    return { schema: "clause-drift-v1", baseRef, headRef, baseClauses: 0, headClauses: 0, diffs: [] };
  }

  const baseClauses = baseContent !== null ? extractClauses(baseContent) : [];
  const headClauses = headContent !== null ? extractClauses(headContent) : [];

  const baseMap = new Map(baseClauses.map((c) => [c.id, c]));
  const headMap = new Map(headClauses.map((c) => [c.id, c]));
  const depMap = buildDependencyMap();

  const diffs: ClauseDiff[] = [];

  for (const [id, baseClause] of baseMap) {
    const headClause = headMap.get(id);
    if (headClause === undefined) {
      diffs.push({
        id,
        kind: "removed",
        baseTitle: baseClause.title,
        headTitle: null,
        dependentSurfaces: depMap.get(id) ?? [],
      });
    } else if (baseClause.title !== headClause.title) {
      diffs.push({
        id,
        kind: "title-changed",
        baseTitle: baseClause.title,
        headTitle: headClause.title,
        dependentSurfaces: depMap.get(id) ?? [],
      });
    } else if (baseClause.body !== headClause.body) {
      diffs.push({
        id,
        kind: "body-changed",
        baseTitle: baseClause.title,
        headTitle: headClause.title,
        dependentSurfaces: depMap.get(id) ?? [],
      });
    }
  }

  for (const [id, headClause] of headMap) {
    if (!baseMap.has(id)) {
      diffs.push({
        id,
        kind: "added",
        baseTitle: null,
        headTitle: headClause.title,
        dependentSurfaces: [],
      });
    }
  }

  diffs.sort((a, b) => {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  return {
    schema: "clause-drift-v1",
    baseRef,
    headRef,
    baseClauses: baseClauses.length,
    headClauses: headClauses.length,
    diffs,
  };
}

function emitJson(r: DriftResult): string {
  const payload = {
    schema: r.schema,
    base_ref: r.baseRef,
    head_ref: r.headRef,
    base_clauses: r.baseClauses,
    head_clauses: r.headClauses,
    diffs: r.diffs.map((d) => ({
      id: d.id,
      kind: d.kind,
      base_title: d.baseTitle,
      head_title: d.headTitle,
      dependent_surfaces: d.dependentSurfaces,
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function emitMd(r: DriftResult): string {
  const lines: string[] = [];
  lines.push("# Alignment-clause drift report");
  lines.push("");
  lines.push(`Schema: \`${r.schema}\`. Base: \`${r.baseRef}\`. Head: \`${r.headRef}\`.`);
  lines.push(`Clauses at base: **${String(r.baseClauses)}**. Clauses at head: **${String(r.headClauses)}**.`);
  lines.push(`Diffs detected: **${String(r.diffs.length)}**.`);
  lines.push("");

  if (r.diffs.length === 0) {
    lines.push("No clause drift detected between base and head.");
    return lines.join("\n");
  }

  lines.push("| Clause | Change | Base title | Head title | Dependent surfaces |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const d of r.diffs) {
    const deps = d.dependentSurfaces.length > 0 ? d.dependentSurfaces.join(", ") : "(none)";
    lines.push(`| ${d.id} | ${d.kind} | ${d.baseTitle ?? "(n/a)"} | ${d.headTitle ?? "(n/a)"} | ${deps} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function emitHuman(r: DriftResult): string {
  const lines: string[] = [];
  lines.push(`clause_drift base=${r.baseRef} head=${r.headRef} base_clauses=${String(r.baseClauses)} head_clauses=${String(r.headClauses)} diffs=${String(r.diffs.length)}`);
  lines.push("");

  if (r.diffs.length === 0) {
    lines.push("No clause drift detected.");
    return lines.join("\n");
  }

  for (const d of r.diffs) {
    const label = d.kind === "added"
      ? `+ ${d.id} "${d.headTitle ?? ""}"`
      : d.kind === "removed"
        ? `- ${d.id} "${d.baseTitle ?? ""}"`
        : d.kind === "title-changed"
          ? `~ ${d.id} "${d.baseTitle ?? ""}" -> "${d.headTitle ?? ""}"`
          : `~ ${d.id} "${d.baseTitle ?? ""}" (body changed)`;
    lines.push(label);

    if (d.dependentSurfaces.length > 0) {
      lines.push(`  depends: ${d.dependentSurfaces.join(", ")}`);
    }
  }
  return lines.join("\n");
}

export function main(argv: readonly string[]): ExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(
      "Usage: audit_clause_drift.ts [--base REF] [--head REF] [--json | --md]\n" +
      "  Defaults: --base <default-branch> --head HEAD\n",
    );
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 2;
  }
  const { args } = parsed;

  process.chdir(repoRoot());

  const result = computeDrift(args.base, args.head);

  if (args.json) {
    process.stdout.write(emitJson(result));
  } else if (args.md) {
    process.stdout.write(emitMd(result));
  } else {
    process.stdout.write(`${emitHuman(result)}\n`);
  }

  const hasRemovalOrChange = result.diffs.some(
    (d) => d.kind === "removed" || d.kind === "body-changed",
  );
  return hasRemovalOrChange ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
