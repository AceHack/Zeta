#!/usr/bin/env bun
// audit_retractibility.ts — retractibility-and-log check for factory surfaces.
//
// B-0058 responsibility #1: verify that each factory surface (skill, agent,
// backlog item) preserves retractibility — git-tracked and one-commit-removable.
// Reports inbound reference counts so entangled surfaces are visible.
//
// Usage:
//   bun tools/alignment/audit_retractibility.ts
//   bun tools/alignment/audit_retractibility.ts --json
//   bun tools/alignment/audit_retractibility.ts --md
//   bun tools/alignment/audit_retractibility.ts --gate N   # fail if any surface has >= N inbound refs
//   bun tools/alignment/audit_retractibility.ts <path> ... # check specific files
//
// Exit codes:
//   0  All surfaces retractible (or below gate threshold)
//   1  Gate tripped (when --gate N given and any surface has >= N inbound refs)
//   2  Script error / bad args

import { readFileSync, readdirSync } from "node:fs";
import { relative } from "node:path";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1 | 2;

type RetractStatus = "retractible" | "entangled" | "untracked";

interface SurfaceRetract {
  readonly path: string;
  readonly kind: "skill" | "agent" | "backlog" | "file";
  readonly name: string;
  readonly gitTracked: boolean;
  readonly inboundRefs: number;
  readonly inboundFrom: readonly string[];
  readonly status: RetractStatus;
}

interface RetractResult {
  readonly schema: string;
  readonly totalSurfaces: number;
  readonly retractible: number;
  readonly entangled: number;
  readonly untracked: number;
  readonly entanglementThreshold: number;
  readonly surfaces: readonly SurfaceRetract[];
}

interface Args {
  readonly json: boolean;
  readonly md: boolean;
  readonly gate: number | null;
  readonly paths: readonly string[];
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

const ENTANGLEMENT_THRESHOLD = 5;

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

export function parseArgs(argv: readonly string[]): ParseResult {
  const state = {
    json: false,
    md: false,
    gate: null as number | null,
    paths: [] as string[],
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    if (arg === "--json") { state.json = true; i += 1; continue; }
    if (arg === "--md") { state.md = true; i += 1; continue; }
    if (arg === "--gate") {
      const next = argv[i + 1];
      if (next === undefined) return { kind: "error", message: "audit_retractibility: --gate requires a number" };
      const n = Number(next);
      if (!Number.isFinite(n) || n < 0) return { kind: "error", message: `audit_retractibility: invalid gate value: ${next}` };
      state.gate = n;
      i += 2;
      continue;
    }
    if (arg.startsWith("-")) {
      return { kind: "error", message: `audit_retractibility: unknown flag: ${arg}` };
    }
    state.paths.push(arg);
    i += 1;
  }
  return { kind: "args", args: state };
}

function isGitTracked(filePath: string): boolean {
  const result = spawnSync(
    "git", // eslint-disable-line sonarjs/no-os-command-from-path
    ["ls-files", "--error-unmatch", filePath],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
  return result.status === 0;
}

export function countInboundRefs(filePath: string, root: string): { count: number; from: readonly string[] } {
  const relPath = relative(root, `${root}/${filePath}`);

  const result = spawnSync(
    "git", // eslint-disable-line sonarjs/no-os-command-from-path
    ["grep", "-l", "--fixed-strings", relPath],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );

  const lines = (result.stdout ?? "").trim().split("\n").filter((l) => l.length > 0);
  const selfExcluded = lines.filter((l) => l !== relPath).sort();

  return { count: selfExcluded.length, from: selfExcluded };
}

function classifyStatus(gitTracked: boolean, inboundRefs: number): RetractStatus {
  if (!gitTracked) return "untracked";
  if (inboundRefs >= ENTANGLEMENT_THRESHOLD) return "entangled";
  return "retractible";
}

function discoverSkills(): readonly string[] {
  try {
    const entries = readdirSync(".claude/skills", { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
      .map((e) => `.claude/skills/${e.name}/SKILL.md`)
      .filter((p) => { try { readFileSync(p); return true; } catch { return false; } })
      .sort();
  } catch { return []; }
}

function discoverAgents(): readonly string[] {
  try {
    const entries = readdirSync(".claude/agents", { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => `.claude/agents/${e.name}`)
      .sort();
  } catch { return []; }
}

function discoverBacklog(): readonly string[] {
  const paths: string[] = [];
  for (const priority of ["P0", "P1"] as const) {
    const dir = `docs/backlog/${priority}`;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isFile() && e.name.endsWith(".md")) {
          paths.push(`${dir}/${e.name}`);
        }
      }
    } catch { /* skip missing dirs */ }
  }
  return paths.sort();
}

function kindFromPath(p: string): "skill" | "agent" | "backlog" | "file" {
  if (p.startsWith(".claude/skills/")) return "skill";
  if (p.startsWith(".claude/agents/")) return "agent";
  if (p.startsWith("docs/backlog/")) return "backlog";
  return "file";
}

function nameFromPath(p: string): string {
  const kind = kindFromPath(p);
  if (kind === "skill") {
    const match = /\.claude\/skills\/([^/]+)\//.exec(p);
    return match?.[1] ?? p;
  }
  if (kind === "agent") {
    const match = /\.claude\/agents\/(.+)\.md$/.exec(p);
    return match?.[1] ?? p;
  }
  if (kind === "backlog") {
    const match = /(B-\d+)/.exec(p);
    return match?.[1] ?? p;
  }
  return p;
}

export function auditRetractibility(paths: readonly string[]): RetractResult {
  const root = process.cwd();
  const surfaces: SurfaceRetract[] = [];

  for (const p of paths) {
    const gitTracked = isGitTracked(p);
    const { count, from } = gitTracked ? countInboundRefs(p, root) : { count: 0, from: [] as string[] };
    const status = classifyStatus(gitTracked, count);

    surfaces.push({
      path: p,
      kind: kindFromPath(p),
      name: nameFromPath(p),
      gitTracked,
      inboundRefs: count,
      inboundFrom: from,
      status,
    });
  }

  surfaces.sort((a, b) => b.inboundRefs - a.inboundRefs);

  return {
    schema: "retractibility-v1",
    totalSurfaces: surfaces.length,
    retractible: surfaces.filter((s) => s.status === "retractible").length,
    entangled: surfaces.filter((s) => s.status === "entangled").length,
    untracked: surfaces.filter((s) => s.status === "untracked").length,
    entanglementThreshold: ENTANGLEMENT_THRESHOLD,
    surfaces,
  };
}

function emitJson(r: RetractResult): string {
  const payload = {
    schema: r.schema,
    total_surfaces: r.totalSurfaces,
    retractible: r.retractible,
    entangled: r.entangled,
    untracked: r.untracked,
    entanglement_threshold: r.entanglementThreshold,
    surfaces: r.surfaces.map((s) => ({
      path: s.path,
      kind: s.kind,
      name: s.name,
      git_tracked: s.gitTracked,
      inbound_refs: s.inboundRefs,
      inbound_from: s.inboundFrom,
      status: s.status,
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function emitMd(r: RetractResult): string {
  const lines: string[] = [];
  lines.push("# Retractibility audit");
  lines.push("");
  lines.push(`Schema: \`${r.schema}\`. Entanglement threshold: ${String(r.entanglementThreshold)} inbound refs.`);
  lines.push("");
  lines.push(`Surfaces: **${String(r.totalSurfaces)}** total — **${String(r.retractible)}** retractible, **${String(r.entangled)}** entangled, **${String(r.untracked)}** untracked.`);
  lines.push("");
  lines.push("| Status | Kind | Name | Inbound refs | Path |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const s of r.surfaces) {
    lines.push(`| ${s.status} | ${s.kind} | ${s.name} | ${String(s.inboundRefs)} | ${s.path} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function emitHuman(r: RetractResult): string {
  const lines: string[] = [];
  lines.push(`retractibility total=${String(r.totalSurfaces)} retractible=${String(r.retractible)} entangled=${String(r.entangled)} untracked=${String(r.untracked)} threshold=${String(r.entanglementThreshold)}`);
  lines.push("");

  const entangled = r.surfaces.filter((s) => s.status === "entangled");
  if (entangled.length > 0) {
    lines.push("Entangled surfaces (>= threshold inbound refs):");
    for (const s of entangled) {
      lines.push(`  [${s.kind}] ${s.name.padEnd(40)} refs=${String(s.inboundRefs)}`);
    }
    lines.push("");
  }

  const untrackedList = r.surfaces.filter((s) => s.status === "untracked");
  if (untrackedList.length > 0) {
    lines.push("Untracked surfaces (not git-tracked):");
    for (const s of untrackedList) {
      lines.push(`  [${s.kind}] ${s.name}`);
    }
    lines.push("");
  }

  const topRetractible = r.surfaces
    .filter((s) => s.status === "retractible")
    .slice(0, 10);
  if (topRetractible.length > 0) {
    lines.push("Top retractible surfaces by inbound refs:");
    for (const s of topRetractible) {
      lines.push(`  [${s.kind}] ${s.name.padEnd(40)} refs=${String(s.inboundRefs)}`);
    }
  }

  return lines.join("\n");
}

export function main(argv: readonly string[]): ExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(
      "Usage: audit_retractibility.ts [--json | --md] [--gate N] [path ...]\n" +
      "  No paths = scan all skills, agents, backlog P0/P1.\n" +
      "  --gate N  Fail if any surface has >= N inbound refs.\n",
    );
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 2;
  }
  const { args } = parsed;

  process.chdir(repoRoot());

  let paths: readonly string[];
  if (args.paths.length > 0) {
    paths = args.paths;
  } else {
    paths = [...discoverSkills(), ...discoverAgents(), ...discoverBacklog()];
  }

  const result = auditRetractibility(paths);

  if (args.json) {
    process.stdout.write(emitJson(result));
  } else if (args.md) {
    process.stdout.write(emitMd(result));
  } else {
    process.stdout.write(`${emitHuman(result)}\n`);
  }

  if (args.gate !== null) {
    const gateN = args.gate;
    const failing = result.surfaces.filter((s) => s.inboundRefs >= gateN);
    if (failing.length > 0) {
      for (const f of failing) {
        process.stderr.write(
          `audit_retractibility: ${f.name} (${f.kind}) has ${String(f.inboundRefs)} inbound refs >= gate ${String(gateN)}\n`,
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
