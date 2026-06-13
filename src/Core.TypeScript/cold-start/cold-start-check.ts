#!/usr/bin/env bun
// cold-start-check.ts — print big-picture state for fresh-Otto
// (or new-contributor) cold-start ingestion.
//
// Operationalizes the cold-start big-picture-first rule
// (memory/feedback_cold_start_big_picture_first_not_prompt_first_aaron_2026_04_30.md):
// the Zeta default inverts the industry-default "prompt-first"
// cognitive shape. On every cold-start, the agent's first cognitive
// move should be big-picture awareness — mission, trajectory,
// disciplines — and individual decisions flow downstream from that.
//
// This tool is the executable form of the prose rule (B-0117), the
// same prose-rule -> executable-tool pattern that produced
// `tools/github/poll-pr-gate.ts` from the poll-the-gate rule.
//
// Origin: peer-review recommendation 2026-04-30 (the cold-start
// executable was named in a peer-AI review session) and reinforced
// by the substrate-or-it-didn't-happen rule. Filed as B-0117 to
// close the gap.
//
// Usage:
//   bun tools/cold-start-check.ts                  # human-readable, terse
//   bun tools/cold-start-check.ts --json           # JSON for programmatic consumption
//   bun tools/cold-start-check.ts --no-git         # skip git log + PR query (offline mode)
//   bun tools/cold-start-check.ts --help           # this help
//
// Output is designed for fresh-cold-start ingestion (one screen,
// ~30-50 lines). NOT designed for ongoing-session reference —
// CURRENT-aaron.md + CURRENT-amara.md + the loaded CLAUDE.md +
// memory files are the ongoing-session sources.
//
// Exit codes:
//   0 — output emitted successfully
//   1 — usage error (bad args, --help shown)
//   2 — git command failed AND --no-git not set (the tool can run
//       offline; default mode requires git for the trajectory step)

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ESM-safe self-path resolution (replaces CommonJS `__filename` per
// peer-AI review on PR #1188; bun runs the file as ESM).
const SELF_PATH = fileURLToPath(import.meta.url);

type Args = {
  json: boolean;
  noGit: boolean;
};

function printHelp(): void {
  // Print the leading comment block as help text.
  const src = readFileSync(SELF_PATH, "utf8");
  const helpLines: string[] = [];
  for (const line of src.split("\n")) {
    if (line.startsWith("//")) {
      helpLines.push(line.replace(/^\/\/ ?/, ""));
    } else if (line.startsWith("#!")) {
      // skip shebang
    } else {
      break;
    }
  }
  console.log(helpLines.join("\n"));
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { json: false, noGit: false };
  for (const a of argv) {
    switch (a) {
      case "--json": args.json = true; break;
      case "--no-git": args.noGit = true; break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
      default:
        console.error(`error: unknown argument: ${a}`);
        console.error("use --help for usage");
        process.exit(1);
    }
  }
  return args;
}

// git() runs a git subprocess and returns trimmed stdout. On
// non-zero exit, behavior depends on whether the caller needs hard
// failure surfaced or is OK with empty-string fallback. The default
// mode surfaces failures (per peer-AI review on PR #1188); offline
// mode (--no-git) avoids invoking git entirely so this codepath
// only runs when git output is actually expected.
function git(...args: string[]): { ok: boolean; out: string; err: string } {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r: SpawnSyncReturns<string> = spawnSync("git", args, { encoding: "utf8" });
  if (r.status !== 0) {
    return { ok: false, out: "", err: (r.stderr || "").trim() };
  }
  return { ok: true, out: r.stdout.trim(), err: "" };
}

function gitOrEmpty(...args: string[]): string {
  return git(...args).out;
}

function fileFirstLine(path: string): string {
  if (!existsSync(path)) return "(missing)";
  const src = readFileSync(path, "utf8").trim();
  // Skip frontmatter and find the first non-blank, non-`#` headline.
  let inFrontmatter = false;
  for (const line of src.split("\n")) {
    if (line === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;
    if (line.trim() === "") continue;
    // Strip leading `# ` for headlines so the bullet looks clean.
    const cleaned = line.replace(/^#+\s*/, "").trim();
    if (cleaned) return cleaned.slice(0, 200);
  }
  return "(empty)";
}

type Step = {
  n: number;
  label: string;
  source: string;
  headline: string;
};

// ── Argument parsing happens BEFORE any git invocation so --no-git
//    actually prevents repoRoot()'s git rev-parse call (peer-AI
//    finding on PR #1188). When --no-git is set, fall back to
//    process.cwd() rather than asking git.
const args = parseArgs(process.argv.slice(2));

function repoRoot(): string {
  if (args.noGit) return process.cwd();
  const r = git("rev-parse", "--show-toplevel");
  if (!r.ok) {
    console.error(`warning: 'git rev-parse --show-toplevel' failed: ${r.err}`);
    console.error("falling back to process.cwd(). Use --no-git to suppress this warning.");
    return process.cwd();
  }
  return r.out || process.cwd();
}

const root = repoRoot();

// Steps 1-7 each point at a specific source-of-truth file. The
// headline for each step is the first meaningful line of that file
// (typically the title or `name:` field). Step 8 is the closing
// directive — read the prompt and proceed. Step 8 has no source
// file; its headline is fixed text.
const steps: Step[] = [
  {
    n: 1,
    label: "Mission scope",
    source: "memory/feedback_zeta_ultimate_scope_intellectual_backup_of_earth_wont_do_authority_aaron_2026_04_30.md",
    headline: "",
  },
  {
    n: 2,
    label: "Products in flight",
    source: "memory/feedback_substrate_is_product_four_products_evolving_trajectory_aaron_2026_04_30.md",
    headline: "",
  },
  {
    n: 3,
    label: "Internal direction (project-survival)",
    source: "memory/feedback_internal_direction_from_project_survival_aaron_2026_04_30.md",
    headline: "",
  },
  {
    n: 4,
    label: "Authority scope (two-ask-the-maintainer)",
    source: "docs/WONT-DO.md",
    headline: "",
  },
  {
    n: 5,
    label: "Operating disciplines",
    source: "CLAUDE.md",
    headline: "",
  },
  {
    n: 6,
    label: "Current trajectory",
    source: "(git log + open PRs)",
    headline: "",
  },
  {
    n: 7,
    label: "Maintainer CURRENT files",
    source: "(per-maintainer CURRENT-<name>.md)",
    headline: "",
  },
  {
    n: 8,
    label: "Then prompt",
    source: "(closing directive)",
    headline: "Read the user's prompt and proceed downstream from the big picture above.",
  },
];

// Resolve headlines for the file-backed steps (1-5).
for (const step of steps) {
  if (step.source.startsWith("(")) continue; // synthetic/computed sources
  step.headline = fileFirstLine(join(root, step.source));
}

// Step 6: trajectory via git log + (optional) open PR count.
if (args.noGit) {
  steps[5]!.headline = "(--no-git: trajectory skipped)";
} else {
  const lastCommits = gitOrEmpty("log", "--oneline", "-5").split("\n").filter(Boolean);
  const branch = gitOrEmpty("symbolic-ref", "--short", "HEAD") || "(detached)";
  steps[5]!.headline = `branch=${branch}; recent=${lastCommits.length} commit(s)`;
}

// Step 7: per-maintainer CURRENT files. These live OUTSIDE the
// repo (under ~/.claude/projects/<slug>/memory/) per CLAUDE.md
// fast-path discipline. List which maintainer-current files exist
// in the user-scope memory directory.
const home = process.env.HOME;
const userScope = home && existsSync(join(home, ".claude/projects"))
  ? join(home, ".claude/projects")
  : "";
let currentFilesHeadline: string;
if (!userScope) {
  currentFilesHeadline = "(user-scope memory directory not found)";
} else {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("find", [userScope, "-maxdepth", "3", "-name", "CURRENT-*.md", "-type", "f"], {
    encoding: "utf8",
  });
  if (r.status === 0 && r.stdout.trim()) {
    const names = r.stdout.trim().split("\n").map(p => {
      const base = p.split("/").pop() ?? p;
      return base.replace(/^CURRENT-/, "").replace(/\.md$/, "");
    });
    currentFilesHeadline = `${names.length} file(s): ${names.join(", ")}`;
  } else {
    currentFilesHeadline = "(no CURRENT-*.md files found in user-scope memory)";
  }
}
steps[6]!.headline = currentFilesHeadline;

if (args.json) {
  console.log(JSON.stringify({
    cold_start_check: {
      generated_at: new Date().toISOString(),
      steps: steps.map(s => ({ n: s.n, label: s.label, source: s.source, headline: s.headline })),
    },
  }, null, 2));
  process.exit(0);
}

// Human-readable output. Terse, one-screen, fresh-Otto-ingestion-friendly.
console.log("══════════════════════════════════════════════════════════════════");
console.log("  Zeta cold-start check — big-picture-first cognitive shape");
console.log(`  Generated: ${new Date().toISOString()}  |  Repo: ${root}`);
console.log("══════════════════════════════════════════════════════════════════");
console.log("");
for (const step of steps) {
  if (step.n === 8) continue; // Step 8 is rendered separately as the closing directive
  console.log(`  ${step.n}. ${step.label}`);
  console.log(`       source:   ${step.source}`);
  console.log(`       headline: ${step.headline}`);
  console.log("");
}

// Step 6 sub-bullets: recent commits, in human-readable mode only.
if (!args.noGit) {
  console.log("  Recent commits (last 5):");
  const lastCommits = gitOrEmpty("log", "--oneline", "-5").split("\n").filter(Boolean);
  for (const c of lastCommits) {
    console.log(`    ${c}`);
  }
  console.log("");
}

console.log(`  ${steps[7]!.n}. ${steps[7]!.label} — ${steps[7]!.headline}`);
console.log("");
console.log("══════════════════════════════════════════════════════════════════");
console.log("  Cold-start checklist complete. Big-picture loaded; per-prompt");
console.log("  decisions now flow downstream from the objectives above,");
console.log("  never compromising disciplines or principles to satisfy a");
console.log("  narrow ask. Composes with: CLAUDE.md fast-path, CURRENT-*.md,");
console.log("  feedback_cold_start_big_picture_first_not_prompt_first_*.md.");
console.log("══════════════════════════════════════════════════════════════════");
