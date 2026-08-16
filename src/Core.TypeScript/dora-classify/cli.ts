#!/usr/bin/env bun
/**
 * src/Core.TypeScript/dora-classify/cli.ts
 *
 * Step 1 substrate: CLI wrapper that reads commit metadata via `git`
 * + runs the pure-logic classifier + emits JSON.
 *
 * Usage:
 *
 *   # Classify a single commit by SHA (defaults to HEAD)
 *   bun src/Core.TypeScript/dora-classify/cli.ts --sha HEAD
 *
 *   # Classify last N commits + aggregate per-author ratios
 *   bun src/Core.TypeScript/dora-classify/cli.ts --since "24 hours ago" --aggregate
 *
 *   # Classify commits in a specific range
 *   bun src/Core.TypeScript/dora-classify/cli.ts --range origin/main..HEAD --aggregate
 *
 * Output: JSON to stdout. Per-commit classification when `--sha` mode;
 * AuthorRatioStats array when `--aggregate` mode.
 *
 * Exit codes:
 *   0 success
 *   1 missing required arg / bad CLI input
 *   2 git invocation failure
 *   3 JSON serialization error (should never happen)
 */

import { execFileSync } from "node:child_process";

import {
  aggregateAuthorRatios,
  classifyCommit,
  type AuthorRatioStats,
  type ClassificationResult,
  type CommitMetadata,
} from "./classify";

interface CliArgs {
  readonly sha?: string;
  readonly since?: string;
  readonly range?: string;
  readonly aggregate: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs | { readonly error: string } {
  let sha: string | undefined;
  let since: string | undefined;
  let range: string | undefined;
  let aggregate = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = (): string => {
      if (i + 1 >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[++i]!;
    };
    try {
      if (arg === "--sha") sha = next();
      else if (arg === "--since") since = next();
      else if (arg === "--range") range = next();
      else if (arg === "--aggregate") aggregate = true;
      else if (arg === "--help" || arg === "-h") return { error: "help" };
      else return { error: `unknown arg: ${arg}` };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
  if (!sha && !since && !range) {
    sha = "HEAD";
  }
  const provided = [sha, since, range].filter((x) => x !== undefined).length;
  if (provided > 1) {
    return { error: "specify exactly one of --sha / --since / --range" };
  }
  return {
    aggregate,
    ...(sha === undefined ? {} : { sha }),
    ...(since === undefined ? {} : { since }),
    ...(range === undefined ? {} : { range }),
  };
}

function gitLogShasInRange(args: CliArgs): readonly string[] {
  let gitArgs: readonly string[];
  if (args.sha) {
    return [args.sha];
  } else if (args.since) {
    gitArgs = ["log", "--pretty=format:%H", `--since=${args.since}`];
  } else if (args.range) {
    gitArgs = ["log", "--pretty=format:%H", args.range];
  } else {
    return ["HEAD"];
  }
  const out = execFileSync("git", [...gitArgs], { encoding: "utf8" }).trim();
  if (out.length === 0) return [];
  return out.split("\n");
}

function gitCommitMetadata(sha: string): CommitMetadata {
  // Header line with %H|%an|%ae|%cI|%s; then blank line; then changed files
  const hdrOut = execFileSync(
    "git",
    ["log", "-1", "--pretty=format:%H|%an|%ae|%cI|%s", sha],
    { encoding: "utf8" },
  ).trim();
  const parts = hdrOut.split("|");
  if (parts.length < 5) {
    throw new Error(`unexpected git log output for ${sha}: ${hdrOut}`);
  }
  const [hSha, author, authorEmail, timestampIso, ...subjectParts] = parts;
  const subject = subjectParts.join("|");
  const filesOut = execFileSync(
    "git",
    ["diff-tree", "--no-commit-id", "--name-only", "-r", sha],
    { encoding: "utf8" },
  ).trim();
  const changedFiles = filesOut.length === 0 ? [] : filesOut.split("\n");
  return {
    sha: hSha!,
    author: author!,
    authorEmail: authorEmail!,
    timestampIso: timestampIso!,
    subject,
    changedFiles,
  };
}

interface CliOutput {
  readonly mode: "single" | "aggregate";
  readonly classifications?: readonly ClassificationResult[];
  readonly authorStats?: readonly AuthorRatioStats[];
}

async function main(): Promise<number> {
  const argv = Bun.argv.slice(2);
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    if (parsed.error === "help") {
      process.stdout.write(
        "Usage: bun src/Core.TypeScript/dora-classify/cli.ts [--sha <ref> | --since <git-time> | --range <gitref..gitref>] [--aggregate]\n" +
          "Defaults to --sha HEAD when no mode arg given.\n",
      );
      return 0;
    }
    process.stderr.write(`error: ${parsed.error}\n`);
    return 1;
  }
  let shas: readonly string[];
  try {
    shas = gitLogShasInRange(parsed);
  } catch (e) {
    process.stderr.write(`git error: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  if (shas.length === 0) {
    process.stdout.write(JSON.stringify({ mode: parsed.aggregate ? "aggregate" : "single", classifications: [] }, null, 2));
    process.stdout.write("\n");
    return 0;
  }
  const classifications: ClassificationResult[] = [];
  for (const sha of shas) {
    let meta: CommitMetadata;
    try {
      meta = gitCommitMetadata(sha);
    } catch (e) {
      process.stderr.write(`git error on ${sha}: ${e instanceof Error ? e.message : String(e)}\n`);
      return 2;
    }
    classifications.push(classifyCommit(meta));
  }
  const out: CliOutput = parsed.aggregate
    ? { mode: "aggregate", authorStats: aggregateAuthorRatios(classifications) }
    : { mode: "single", classifications };
  try {
    process.stdout.write(JSON.stringify(out, null, 2));
    process.stdout.write("\n");
  } catch (e) {
    process.stderr.write(`json error: ${e instanceof Error ? e.message : String(e)}\n`);
    return 3;
  }
  return 0;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
