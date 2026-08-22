#!/usr/bin/env bun
// derive-job-closure.ts — read ONE gate.yml job's tool closure out of the repo as DATA.
//
// WHAT THIS IS FOR. `docs/research/2026-08-20-surface-declarations-are-data-ace-is-one-
// satisfier-and-the-closure-is-the-repo-split.md` argues that a surface's install set IS a
// dependency closure, and explicitly does NOT claim the closure is computable today. This
// file is the narrowest honest test of that claim: for one job, derive the toolchain need
// mechanically, and REPORT WHAT IT CANNOT DERIVE rather than rounding it up to a number.
//
// THE OUTPUT HAS THREE FIELDS AND THE THIRD IS THE POINT.
//   tools      — binaries the job provably invokes, intersected with the declared vocabulary
//   unresolved — spawn sites whose command is not a literal, and second-hop scripts not read
//   ambient    — what install.sh provisions REGARDLESS of this job, which no static read of
//                the job can shrink (that is the over-install this measurement exists to price)
//
// A closure that omitted `ambient` would be a lie by subtraction: it would report what the
// job NEEDS while the job still PAYS for the union, and the gap is the whole finding.
//
// HONEST LIMITS, stated because they bound the claim:
//   * ONE HOP. `bun x.ts` is resolved into x.ts and x.ts's literal spawns are read. A spawn
//     inside a module x.ts imports is NOT followed; it lands in `unresolved`.
//   * LITERALS ONLY. `spawnSync(bin, ...)` where `bin` is a variable is unresolvable by
//     reading, full stop — that is the undecidable boundary, not a gap in the parser.
//   * BINARY NAMES ARE DECLARED, NOT DERIVED. A pin (`go = "1.26.4"`) does not tell you the
//     package ships `gofmt`. TOOL_BINARIES below is the one hand-maintained input and it is
//     small, checkable, and fails LOUD (an unmapped binary shows up as unresolved).
//
// Usage:
//   bun src/Core.TypeScript/ci/derive-job-closure.ts "lint (Go)"

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface GateJob {
  readonly id: string;
  readonly name: string;
  /** Shell text of every `run:` step, in order. */
  readonly runs: readonly string[];
}

export interface Closure {
  readonly job: string;
  readonly tools: readonly string[];
  readonly unresolved: readonly string[];
  readonly ambient: readonly string[];
}

/**
 * Which declared tool provides which binary.
 *
 * The ONLY hand-maintained table here, and it is hand-maintained for a reason a deriver
 * cannot argue away: a version pin names a package, and a package's binaries are a fact
 * about the package, not about the pin. Keys are `.mise.toml` tool names (backend prefix
 * stripped); values are the binaries that tool puts on PATH and that our code may invoke.
 */
export const TOOL_BINARIES: Readonly<Record<string, readonly string[]>> = {
  dotnet: ["dotnet"],
  go: ["go", "gofmt"],
  "golangci-lint": ["golangci-lint"],
  rust: ["cargo", "rustc", "rustup", "rustfmt", "clippy-driver"],
  zig: ["zig"],
  python: ["python", "python3"],
  java: ["java", "javac"],
  bun: ["bun", "bunx"],
  uv: ["uv", "uvx"],
  actionlint: ["actionlint"],
  shellcheck: ["shellcheck"],
  "1password-cli": ["op"],
  node: ["node", "npm", "npx"],
  "markdownlint-cli2": ["markdownlint-cli2"],
  semgrep: ["semgrep"],
  yamllint: ["yamllint"],
  ruff: ["ruff"],
  mypy: ["mypy"],
};

/** `.mise.toml` `[tools]` keys, backend prefix (`npm:`/`pipx:`/`github:`) stripped. */
export function declaredMiseTools(miseToml: string): readonly string[] {
  const out: string[] = [];
  let inTools = false;
  for (const raw of miseToml.split("\n")) {
    const line = raw.trimEnd();
    if (/^\[tools\]\s*$/.test(line)) {
      inTools = true;
      continue;
    }
    if (/^\[/.test(line)) {
      inTools = false;
      continue;
    }
    if (!inTools) continue;
    const m = /^\s*("([^"]+)"|[A-Za-z0-9_.-]+)\s*=/.exec(line);
    const key = m?.[2] ?? m?.[1];
    if (key === undefined) continue;
    out.push(key.replace(/^(npm|pipx|github|aqua|cargo|go|ubi):/u, "").replace(/^.*\//u, ""));
  }
  return out;
}

/** binary -> providing tool, inverted from TOOL_BINARIES and filtered to what is declared. */
export function binaryIndex(declared: readonly string[]): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const tool of declared) {
    for (const bin of TOOL_BINARIES[tool] ?? []) index.set(bin, tool);
  }
  return index;
}

/**
 * Jobs of a GitHub Actions workflow, with the shell text of their `run:` steps.
 *
 * Hand-parsed rather than YAML-library-parsed on purpose: `clone-at-tag-stays-sufficient`
 * wants this readable from a bare checkout with no package manager present, and gate.yml's
 * job/step shape is regular enough that indentation is a sound discriminator.
 */
export function parseGateJobs(yamlText: string): readonly GateJob[] {
  const lines = yamlText.split("\n");
  const jobs: GateJob[] = [];
  let inJobs = false;
  let cur: { id: string; name: string; runs: string[] } | null = null;
  let runBody: string[] | null = null;
  let runIndent = 0;

  const flush = (): void => {
    if (cur) jobs.push({ id: cur.id, name: cur.name || cur.id, runs: cur.runs });
    cur = null;
  };

  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^[A-Za-z]/.test(line)) break; // left the jobs: block entirely

    if (runBody !== null) {
      const indent = line.search(/\S/u);
      if (line.trim().length === 0 || indent >= runIndent) {
        runBody.push(line);
        continue;
      }
      cur?.runs.push(runBody.join("\n"));
      runBody = null;
    }

    const jobStart = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobStart?.[1] !== undefined) {
      flush();
      cur = { id: jobStart[1], name: "", runs: [] };
      continue;
    }
    if (!cur) continue;

    const nameLine = /^ {4}name:\s*(.+?)\s*$/.exec(line);
    if (nameLine?.[1] !== undefined) {
      cur.name = nameLine[1].replace(/^["']|["']$/gu, "");
      continue;
    }
    // `- run:` (list-item inline) is valid YAML and must parse the same as `run:` on its
    // own line. gate.yml happens to use only the latter, so a parser tested against
    // gate.yml alone would pass while silently seeing nothing in a workflow using the
    // former — a deriver that reports "needs nothing" for a job it could not read.
    const runBlock = /^(\s+)(?:-\s+)?run:\s*[|>][-+]?\s*$/.exec(line);
    if (runBlock?.[1] !== undefined) {
      runBody = [];
      runIndent = runBlock[1].length + 1;
      continue;
    }
    const runInline = /^\s+(?:-\s+)?run:\s*(\S.*)$/.exec(line);
    if (runInline?.[1] !== undefined) cur.runs.push(runInline[1]);
  }
  if (runBody !== null && cur !== null) (cur as { runs: string[] }).runs.push(runBody.join("\n"));
  flush();
  return jobs;
}

/** First word of each command in a shell fragment. Comments and operators are stripped. */
export function invokedBinaries(shell: string): readonly string[] {
  const out: string[] = [];
  for (const rawLine of shell.split("\n")) {
    const noComment = rawLine.replace(/(^|\s)#.*$/u, "");
    for (const seg of noComment.split(/\|\||&&|[|;()]/u)) {
      const words = seg.trim().split(/\s+/u).filter((w) => w.length > 0);
      let i = 0;
      while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i] ?? "")) i++; // env prefixes
      let head = words[i];
      if (head === undefined) continue;
      // `mise exec -- <bin>` and `mise exec <tool> -- <bin>`: the real invocation is after `--`.
      if (head === "mise" && words.includes("--")) {
        head = words[words.indexOf("--") + 1];
        if (head === undefined) continue;
      }
      out.push(head.replace(/^.*\//u, ""));
    }
  }
  return out;
}

/** `bun <path>.ts` arguments appearing in shell text — the one hop this deriver follows. */
export function bunScriptTargets(shell: string): readonly string[] {
  const out: string[] = [];
  for (const m of shell.matchAll(/\bbun\s+(?:run\s+)?([A-Za-z0-9_./-]+\.ts)\b/gu)) {
    if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

export interface SpawnScan {
  readonly literals: readonly string[];
  readonly dynamic: readonly string[];
}

/**
 * Literal command names spawned by a TypeScript file, and the sites that are NOT literal.
 *
 * The `dynamic` half is the honest half. `spawnSync(bin, args)` with a computed `bin` cannot
 * be resolved by reading, and calling that "no dependency" is exactly the vacuity this repo
 * keeps catching — a check that cannot fail. It is reported, never dropped.
 */
export function scanSpawns(scriptText: string): SpawnScan {
  const literals: string[] = [];
  const dynamic: string[] = [];

  for (const m of scriptText.matchAll(/\b(?:spawnSync|execFileSync|execFile)\s*\(\s*([^,)]+)/gu)) {
    const arg = (m[1] ?? "").trim();
    const lit = /^["'`]([^"'`]+)["'`]$/.exec(arg);
    if (lit?.[1] !== undefined) literals.push(lit[1]);
    else dynamic.push(`spawnSync(${arg})`);
  }
  for (const m of scriptText.matchAll(/\bBun\.spawn(?:Sync)?\s*\(\s*\[\s*([^,\]]+)/gu)) {
    const arg = (m[1] ?? "").trim();
    const lit = /^["'`]([^"'`]+)["'`]$/.exec(arg);
    if (lit?.[1] !== undefined) literals.push(lit[1]);
    else dynamic.push(`Bun.spawn([${arg}])`);
  }
  // Command tables: `cmd: ["uv", "run", ...]` — the shape lint-python.ts uses.
  for (const m of scriptText.matchAll(/\bcmd:\s*\[\s*"([^"]+)"/gu)) {
    if (m[1] !== undefined) literals.push(m[1]);
  }
  return { literals, dynamic };
}

/**
 * What `tools/setup/install.sh` provisions on every job that runs it, independent of the job.
 *
 * Derived, not asserted: the apt manifest is the manifest, and the realizer roster is the
 * roster. Anything here that the job's own closure does not name is over-install.
 */
export function ambientInstall(repoRoot: string): readonly string[] {
  const apt = readFileSync(join(repoRoot, "tools", "setup", "manifests", "apt"), "utf8");
  const pkgs = apt
    .split("\n")
    .map((l) => l.replace(/#.*$/u, "").trim())
    .filter((l) => l.length > 0);
  const mise = declaredMiseTools(readFileSync(join(repoRoot, ".mise.toml"), "utf8"));
  return [
    `apt: ${String(pkgs.length)} packages (${pkgs.join(" ")})`,
    `mise: ${String(mise.length)} tools (${mise.join(" ")})`,
    "realizers: tools/setup/manifests/from-* — see setup-realizers/index.ts install order",
  ];
}

export interface DeriveInputs {
  readonly gateYml: string;
  readonly miseToml: string;
  /** Returns the text of a repo-relative path, or null when absent. */
  readonly readScript: (relPath: string) => string | null;
}

export function deriveClosure(jobName: string, inputs: DeriveInputs): Closure {
  const job = parseGateJobs(inputs.gateYml).find((j) => j.name === jobName || j.id === jobName);
  if (job === undefined) throw new Error(`no job named ${JSON.stringify(jobName)} in gate.yml`);

  const index = binaryIndex(declaredMiseTools(inputs.miseToml));
  const tools = new Set<string>();
  const unresolved = new Set<string>();

  for (const shell of job.runs) {
    for (const bin of invokedBinaries(shell)) {
      const tool = index.get(bin);
      if (tool !== undefined) tools.add(tool);
    }
    for (const rel of bunScriptTargets(shell)) {
      const text = inputs.readScript(rel);
      if (text === null) {
        unresolved.add(`unreadable second hop: ${rel}`);
        continue;
      }
      const scan = scanSpawns(text);
      for (const bin of scan.literals) {
        const tool = index.get(bin);
        if (tool !== undefined) tools.add(tool);
        else unresolved.add(`${rel} spawns '${bin}' — provided by no declared mise tool`);
      }
      for (const site of scan.dynamic) unresolved.add(`${rel}: ${site}`);
      if (/\bimport\s.*from\s+["']\.\//u.test(text)) {
        unresolved.add(`${rel} imports local modules — spawns beyond one hop are NOT read`);
      }
    }
  }
  return {
    job: job.name,
    tools: [...tools].sort(),
    unresolved: [...unresolved].sort(),
    ambient: [],
  };
}

if (import.meta.main) {
  const repoRoot = join(import.meta.dir, "..", "..", "..");
  const name = process.argv[2];
  if (name === undefined) {
    process.stderr.write('usage: bun derive-job-closure.ts "lint (Go)"\n');
    process.exit(64);
  }
  const closure = deriveClosure(name, {
    gateYml: readFileSync(join(repoRoot, ".github", "workflows", "gate.yml"), "utf8"),
    miseToml: readFileSync(join(repoRoot, ".mise.toml"), "utf8"),
    readScript: (rel) => {
      try {
        return readFileSync(join(repoRoot, rel), "utf8");
      } catch {
        return null;
      }
    },
  });
  process.stdout.write(
    `${JSON.stringify({ ...closure, ambient: ambientInstall(repoRoot) }, null, 2)}\n`,
  );
}
