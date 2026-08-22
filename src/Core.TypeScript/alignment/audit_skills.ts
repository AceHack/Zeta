#!/usr/bin/env bun
// audit_skills.ts — per-round skill runtime observability.
//
// TypeScript+Bun port of audit_skills.sh, slice 4 of the TS+Bun
// migration. See `docs/best-practices/repo-scripting.md`.
//
// Pattern parallel to audit_personas.ts: same range-based audit
// shape, three output modes (JSON / Markdown / human-summary),
// gate threshold support. Schema: DORA-2025-skill-scope-v1.
//
// DORA column → skill-scope adaptation:
//   #4 throughput            -> notebook_mentions + commit_mentions
//   #5 instability           -> commits touching SKILL.md
//   #7 individual effectiveness -> mentioned-but-not-edited proxy
//   #9 friction              -> rounds since owner's last notebook touch
//
// Six remaining DORA columns emit "-" until signals exist.
//
// Usage:
//   bun src/Core.TypeScript/alignment/audit_skills.ts                   # main..HEAD
//   bun src/Core.TypeScript/alignment/audit_skills.ts HEAD~20..HEAD     # explicit range
//   bun src/Core.TypeScript/alignment/audit_skills.ts --json
//   bun src/Core.TypeScript/alignment/audit_skills.ts --md
//   bun src/Core.TypeScript/alignment/audit_skills.ts --out DIR
//   bun src/Core.TypeScript/alignment/audit_skills.ts --stale N
//   bun src/Core.TypeScript/alignment/audit_skills.ts --gate N
//
// Exit codes:
//   0  Clean run
//   1  Stale-gate tripped (when --gate N given and any friction >= N)
//   2  Script error / missing dependency / bad args

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  spawnSync,
  type SpawnSyncReturns,
} from "node:child_process";

type AuditExitCode = 0 | 1 | 2;

interface Args {
  readonly range: string;
  readonly json: boolean;
  readonly md: boolean;
  readonly outDir: string | null;
  readonly gate: number | null;
  readonly staleMin: number;
  readonly roundLabel: string | null;
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

interface SkillRow {
  readonly name: string;
  readonly owner: string;
  readonly ownerLastRound: number;
  readonly friction: string;
  readonly throughput: number;
  readonly instability: number;
  readonly effectiveness: number;
  readonly touched: boolean;
}

interface AuditResult {
  readonly roundLabel: string;
  readonly range: string;
  readonly rosterTotal: number;
  readonly rosterTouched: number;
  readonly coverage: string;
  readonly rows: readonly SkillRow[];
}

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const ROUND_RE = /^## Round (\d+)/gm;
const OWNER_RE = /memory\/([a-z0-9_-]+)\/NOTEBOOK\.md/;

function classifyFailure(
  cmd: string,
  args: readonly string[],
  result: SpawnSyncReturns<string>,
): string | null {
  if (result.error) {
    return `Failed to start '${cmd} ${args.join(" ")}': ${result.error.message}`;
  }
  if (result.status === null) {
    return `'${cmd} ${args.join(" ")}' terminated before reporting an exit code`;
  }
  return null;
}

function runGit(args: readonly string[]): { stdout: string; status: number | null } {
  const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    "git",
    args,
    { encoding: "utf8", maxBuffer: SPAWN_MAX_BUFFER },
  );
  const failure = classifyFailure("git", args, result);
  if (failure !== null) throw new Error(failure);
  return { stdout: result.stdout, status: result.status };
}

function repoRoot(): string {
  return runGit(["rev-parse", "--show-toplevel"]).stdout.trim();
}

function reduceFlag(
  arg: string,
  next: string | undefined,
  state: {
    range: string;
    json: boolean;
    md: boolean;
    outDir: string | null;
    gate: number | null;
    staleMin: number;
    roundLabel: string | null;
  },
): { ok: true; consumed: 1 | 2 } | { ok: false; message: string } {
  if (arg === "--json") {
    state.json = true;
    return { ok: true, consumed: 1 };
  }
  if (arg === "--md") {
    state.md = true;
    return { ok: true, consumed: 1 };
  }
  if (arg === "--out") {
    if (next === undefined) {
      return { ok: false, message: "audit_skills: --out requires a directory" };
    }
    state.outDir = next;
    return { ok: true, consumed: 2 };
  }
  if (arg === "--gate") {
    if (next === undefined) {
      return { ok: false, message: "audit_skills: --gate requires a value" };
    }
    state.gate = Number(next);
    return { ok: true, consumed: 2 };
  }
  if (arg === "--stale") {
    if (next === undefined) {
      return { ok: false, message: "audit_skills: --stale requires a value" };
    }
    state.staleMin = Number(next);
    return { ok: true, consumed: 2 };
  }
  if (arg === "--round") {
    if (next === undefined) {
      return { ok: false, message: "audit_skills: --round requires a label" };
    }
    state.roundLabel = next;
    return { ok: true, consumed: 2 };
  }
  if (!arg.startsWith("--")) {
    state.range = arg;
    return { ok: true, consumed: 1 };
  }
  return { ok: false, message: `audit_skills: unknown arg: ${arg}` };
}

function parseArgs(argv: readonly string[]): ParseResult {
  const state = {
    range: "main..HEAD",
    json: false,
    md: false,
    outDir: null as string | null,
    gate: null as number | null,
    staleMin: 0,
    roundLabel: null as string | null,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    const r = reduceFlag(arg, argv[i + 1], state);
    if (!r.ok) return { kind: "error", message: r.message };
    i += r.consumed;
  }
  return {
    kind: "args",
    args: {
      range: state.range,
      json: state.json,
      md: state.md,
      outDir: state.outDir,
      gate: state.gate,
      staleMin: state.staleMin,
      roundLabel: state.roundLabel,
    },
  };
}

function listSkills(): readonly string[] {
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = readdirSync(".claude/skills", { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith("_")) continue;
    try {
      readFileSync(`.claude/skills/${e.name}/SKILL.md`, "utf8");
    } catch {
      continue;
    }
    out.push(e.name);
  }
  out.sort(byteCompare);
  return out;
}

function byteCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function maxRoundIn(notebook: string): number {
  let content: string;
  try {
    content = readFileSync(notebook, "utf8");
  } catch {
    return 0;
  }
  let max = 0;
  for (const m of content.matchAll(ROUND_RE)) {
    const n = m[1];
    if (n !== undefined) {
      const parsed = Number(n);
      if (parsed > max) max = parsed;
    }
  }
  return max;
}

interface PersonaInfo {
  readonly name: string;
  readonly path: string;
}

function listPersonas(): readonly PersonaInfo[] {
  const memoryDir = "memory";
  const out: PersonaInfo[] = [];
  try {
    const items = readdirSync(memoryDir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        const personaPath = join(memoryDir, item.name);
        if (item.name === "observed-phenomena" || item.name === "architectural-intent-guesses") {
          continue;
        }
        
        const hasNotebook =
          existsSync(join(personaPath, "NOTEBOOK.md")) ||
          existsSync(join(personaPath, "MEMORY.md")) ||
          existsSync(join(personaPath, "PERSONA.md"));
        if (hasNotebook) {
          out.push({ name: item.name, path: personaPath });
        }
      }
    }
  } catch {
    return [];
  }
  out.sort((a, b) => byteCompare(a.name, b.name));
  return out;
}

function currentRound(personas: readonly PersonaInfo[]): number {
  let max = 0;
  for (const p of personas) {
    for (const f of ["NOTEBOOK.md", "MEMORY.md", "PERSONA.md"]) {
      const r = maxRoundIn(join(p.path, f));
      if (r > max) max = r;
    }
  }
  return max;
}

function skillOwner(skill: string): string {
  let content: string;
  try {
    content = readFileSync(`.claude/skills/${skill}/SKILL.md`, "utf8");
  } catch {
    return "";
  }
  const m = OWNER_RE.exec(content);
  return m === null ? "" : (m[1] ?? "");
}

function commitMentionsForSkill(skill: string, range: string): number {
  // Match `.claude/skills/<skill>/` OR \b<skill>\b in commit bodies.
  const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    "git",
    ["log", "--pretty=format:%B", range],
    { encoding: "utf8", maxBuffer: SPAWN_MAX_BUFFER },
  );
  if (result.status !== 0) return 0;
  const re = new RegExp(`(\\.claude/skills/${skill}/|\\b${skill}\\b)`, "g");
  let count = 0;
  // Bash counts lines containing matches via `grep -c`. We mirror that
  // by counting lines (not occurrences) that satisfy the regex.
  for (const line of result.stdout.split("\n")) {
    if (re.test(line)) count += 1;
    re.lastIndex = 0;
  }
  return count;
}

function fileChurnForSkill(skill: string, range: string): number {
  const path = `.claude/skills/${skill}/SKILL.md`;
  const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    "git",
    ["log", "--pretty=format:%H", range, "--", path],
    { encoding: "utf8", maxBuffer: SPAWN_MAX_BUFFER },
  );
  if (result.status !== 0) return 0;
  return result.stdout.split("\n").filter((s) => s.length > 0).length;
}

function notebookMentionsForSkill(skill: string, personas: readonly PersonaInfo[]): number {
  let total = 0;
  const re = new RegExp(`\\b${skill}\\b`, "g");
  for (const p of personas) {
    let content: string;
    for (const f of ["NOTEBOOK.md", "MEMORY.md", "PERSONA.md"]) {
      try {
        content = readFileSync(join(p.path, f), "utf8");
      } catch {
        continue;
      }
      for (const line of content.split("\n")) {
        if (re.test(line)) total += 1;
        re.lastIndex = 0;
      }
    }
  }
  return total;
}

function buildRow(skill: string, cr: number, range: string, personas: readonly PersonaInfo[]): SkillRow {
  const owner = skillOwner(skill);
  const ownerPersona = personas.find((p) => p.name === owner);
  let ownerLastRound = 0;
  if (ownerPersona !== undefined) {
    for (const f of ["NOTEBOOK.md", "MEMORY.md", "PERSONA.md"]) {
      const r = maxRoundIn(join(ownerPersona.path, f));
      if (r > ownerLastRound) ownerLastRound = r;
    }
  }
  const friction = ownerLastRound === 0 ? "-" : String(cr - ownerLastRound);
  const mentions = commitMentionsForSkill(skill, range);
  const nbMentions = notebookMentionsForSkill(skill, personas);
  const churn = fileChurnForSkill(skill, range);
  const throughput = mentions + nbMentions;
  const effectiveness = throughput > 0 && churn === 0 ? 1 : 0;
  const touched = throughput > 0 || churn > 0;
  return {
    name: skill,
    owner: owner === "" ? "-" : owner,
    ownerLastRound,
    friction,
    throughput,
    instability: churn,
    effectiveness,
    touched,
  };
}

function applyStaleFilter(rows: readonly SkillRow[], staleMin: number): readonly SkillRow[] {
  if (staleMin === 0) return rows;
  return rows.filter((r) => r.friction !== "-" && Number(r.friction) >= staleMin);
}

export function audit(args: Args): AuditResult {
  const personas = listPersonas();
  const skills = listSkills();
  const cr =
    args.roundLabel !== null && /^\d+$/.test(args.roundLabel)
      ? Number(args.roundLabel)
      : currentRound(personas);
  const roundLabel = args.roundLabel ?? String(cr);
  const allRows = skills.map((s) => buildRow(s, cr, args.range, personas));
  const rows = applyStaleFilter(allRows, args.staleMin);
  const rosterTotal = allRows.length;
  const rosterTouched = allRows.filter((r) => r.touched).length;
  const coverage = rosterTotal > 0 ? (rosterTouched / rosterTotal).toFixed(2) : "0.00";
  return { roundLabel, range: args.range, rosterTotal, rosterTouched, coverage, rows };
}

function emitJson(r: AuditResult): string {
  const skills = r.rows.map((row) => ({
    name: row.name,
    owner: row.owner,
    owner_last_round: row.ownerLastRound,
    dora_friction_rounds: row.friction,
    dora_throughput: row.throughput,
    dora_instability: row.instability,
    dora_individual_effectiveness: row.effectiveness,
    touched_this_round: row.touched ? 1 : 0,
    dora_unmeasured: [
      "organizational_performance",
      "team_performance",
      "product_performance",
      "code_quality",
      "valuable_work",
      "burnout",
    ],
  }));
  const payload = {
    round: r.roundLabel,
    range: r.range,
    schema: "DORA-2025-skill-scope-v1",
    roster_total: r.rosterTotal,
    roster_touched: r.rosterTouched,
    roster_coverage: Number(r.coverage),
    skills,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function emitMd(r: AuditResult): string {
  const lines: string[] = [];
  lines.push(`# Skill runtime audit — round ${r.roundLabel}`);
  lines.push("");
  lines.push(`Range audited: \`${r.range}\`. Schema: \`DORA-2025-skill-scope-v1\`.`);
  lines.push("");
  lines.push(`Roster coverage: **${String(r.rosterTouched)} / ${String(r.rosterTotal)}** (${r.coverage}).`);
  lines.push("");
  lines.push("DORA columns adapted to skill scope (the six columns with no");
  lines.push("reliable skill-scope signal today emit `-`; see header comment");
  lines.push("in `src/Core.TypeScript/alignment/audit_skills.ts` for the mapping rationale):");
  lines.push("");
  lines.push("| Skill | Owner | Last round | Friction (#9) | Throughput (#4) | Instability (#5) | Ind. effectiveness (#7) | Touched |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of r.rows) {
    const mark = row.touched ? "yes" : "no";
    const lrCell = row.ownerLastRound === 0 ? "(none)" : String(row.ownerLastRound);
    lines.push(
      `| ${row.name} | ${row.owner} | ${lrCell} | ${row.friction} | ${String(row.throughput)} | ${String(row.instability)} | ${String(row.effectiveness)} | ${mark} |`,
    );
  }
  lines.push("");
  lines.push("Source of truth:");
  lines.push("");
  lines.push("- `.claude/skills/<skill>/SKILL.md` for roster + owner mapping;");
  lines.push("- `memory/<persona>/<owner>/NOTEBOOK.md` for owner-last-round;");
  lines.push(`- \`git log ${r.range}\` for commit mentions and file-churn.`);
  lines.push("");
  lines.push("No external DB. Replaces no existing skill-audit surface;");
  lines.push("pairs with `audit_personas.sh` for a full runtime view.");
  return lines.join("\n");
}

function emitHumanSummary(r: AuditResult): string {
  const lines: string[] = [];
  lines.push(
    `round=${r.roundLabel} range=${r.range} coverage=${String(r.rosterTouched)}/${String(r.rosterTotal)} (${r.coverage})`,
  );
  for (const row of r.rows) {
    const lrCell = row.ownerLastRound === 0 ? "-" : `r${String(row.ownerLastRound)}`;
    lines.push(
      `  ${row.name.padEnd(40)} owner=${row.owner.padEnd(20)} last=${lrCell.padEnd(5)} friction=${row.friction.padEnd(3)} thru=${String(row.throughput).padEnd(3)} churn=${String(row.instability).padEnd(3)} eff=${String(row.effectiveness)}`,
    );
  }
  return lines.join("\n");
}

function gateCheck(rows: readonly SkillRow[], gate: number): readonly SkillRow[] {
  return rows.filter((r) => r.friction !== "-" && Number(r.friction) >= gate);
}

export function main(argv: readonly string[]): AuditExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(
      "Usage: audit_skills.ts [RANGE] [--json | --md] [--out DIR] [--gate N] [--stale N] [--round LABEL]\n",
    );
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 2;
  }
  const { args } = parsed;

  process.chdir(repoRoot());

  const result = audit(args);

  if (args.outDir !== null) {
    mkdirSync(args.outDir, { recursive: true });
    writeFileSync(
      join(args.outDir, `round-${result.roundLabel}-skills.json`),
      emitJson(result),
    );
    writeFileSync(
      join(args.outDir, `round-${result.roundLabel}-skills.md`),
      `${emitMd(result)}\n`,
    );
    process.stdout.write(
      `audit_skills: wrote ${args.outDir}/round-${result.roundLabel}-skills.{json,md}\n`,
    );
  } else if (args.json) {
    process.stdout.write(emitJson(result));
  } else if (args.md) {
    process.stdout.write(`${emitMd(result)}\n`);
  } else {
    process.stdout.write(`${emitHumanSummary(result)}\n`);
  }

  if (args.gate !== null) {
    const failing = gateCheck(result.rows, args.gate);
    if (failing.length > 0) {
      for (const f of failing) {
        process.stderr.write(
          `audit_skills: ${f.name} friction=${f.friction} >= gate ${String(args.gate)}\n`,
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
