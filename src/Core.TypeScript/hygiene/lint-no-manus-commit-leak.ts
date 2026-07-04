#!/usr/bin/env bun
// lint-no-manus-commit-leak.ts — fail if any commit on this branch (vs base)
// carries Manus/Lumen shell-wrapper text in its message (081KWMY831H).
//
// Usage:
//   bun src/Core.TypeScript/hygiene/lint-no-manus-commit-leak.ts
//   bun src/Core.TypeScript/hygiene/lint-no-manus-commit-leak.ts --base origin/main
import { spawnSync } from "node:child_process";
import { hasManusWrapperSignature } from "./sanitize-manus-commit-msg.ts";

function usage(): void {
  process.stderr.write(
    "usage: bun src/Core.TypeScript/hygiene/lint-no-manus-commit-leak.ts [--base <ref>]\n",
  );
}

function main(argv: string[]): number {
  let base = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : "origin/main";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") {
      base = argv[i + 1] ?? base;
      i++;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      usage();
      return 0;
    }
  }

  // Ensure base exists (shallow clones may lack origin/main).
  const hasBase = spawnSync("git", ["rev-parse", "--verify", base], {
    encoding: "utf8",
  });
  if (hasBase.status !== 0) {
    const fetch = spawnSync("git", ["fetch", "--depth=1", "origin", "main"], {
      encoding: "utf8",
    });
    if (fetch.status !== 0) {
      process.stderr.write(
        `lint-no-manus-commit-leak: cannot resolve base ${base}; skipping (not a PR clone?)\n`,
      );
      return 0;
    }
    base = "origin/main";
  }

  const log = spawnSync(
    "git",
    ["log", `${base}..HEAD`, "--format=%H%x00%B%x00"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (log.status !== 0) {
    process.stderr.write(`lint-no-manus-commit-leak: git log failed: ${log.stderr}\n`);
    return 1;
  }

  const chunks = log.stdout.split("\0").filter((c) => c.trim().length > 0);
  const bad: string[] = [];
  for (let i = 0; i + 1 < chunks.length; i += 2) {
    const sha = chunks[i]!.trim();
    const body = chunks[i + 1] ?? "";
    if (hasManusWrapperSignature(body)) {
      bad.push(sha.slice(0, 12));
    }
  }

  if (bad.length > 0) {
    process.stderr.write(
      `lint-no-manus-commit-leak: Manus/Lumen wrapper text in commit message(s): ${bad.join(", ")}\n` +
        "  Strip __manus_ec / trap '' PIPE from subjects (scripts/hooks/commit-msg) and amend/rebase.\n",
    );
    return 1;
  }

  process.stdout.write(
    `lint-no-manus-commit-leak: ok (${String(chunks.length / 2)} commit(s) since ${base})\n`,
  );
  return 0;
}

process.exitCode = main(process.argv.slice(2));
