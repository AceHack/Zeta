#!/usr/bin/env bun
// capture-tick-snapshot.ts — captures a snapshot pin of factory state
// at tick-open / tick-close time.
//
// TypeScript+Bun port of capture-tick-snapshot.sh, slice 9 of the
// TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// Prints a YAML or JSON fragment for pasting into:
//   docs/hygiene-history/session-snapshots.md (session-level)
//   docs/decision-proxy-evidence/DP-NNN.yaml `model` block (decision-level)
//   a tick-history row's `notes` column (tick-level)
//
// Addresses Amara's 4th-ferry snapshot-pinning concern: "Claude is not
// a single stable operator unless the actual snapshot, system-prompt
// bundle, and loaded memory surfaces are all pinned and recorded".
//
// Usage:
//   bun tools/hygiene/capture-tick-snapshot.ts         # YAML
//   bun tools/hygiene/capture-tick-snapshot.ts --json  # JSON
//
// Exit codes:
//   0  always (best-effort capture; missing files yield empty fields)

import { statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

type ExitCode = 0;
type Format = "yaml" | "json";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

// (regex moved to manual extraction in extractRepoName to avoid
// sonarjs/slow-regex flag on `[^/]+/[^/]+`; the manual version is
// linear-scan + last-two-segments which preserves bash output exactly)

function gitOutput(args: readonly string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return "";
  return result.stdout.trim();
}

function fileExists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function safeSha(path: string): string {
  if (!fileExists(path)) return "";
  return gitOutput(["hash-object", path]);
}

function safeBytes(path: string): string {
  if (!fileExists(path)) return "";
  try {
    return String(statSync(path).size);
  } catch {
    return "";
  }
}

function claudeVersion(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("claude", ["--version"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return "unknown";
  const first = result.stdout.split("\n")[0] ?? "";
  return first.trim() || "unknown";
}

function extractRepoName(url: string): string {
  // Match bash sed `.*[:/]([^/]+/[^/]+)(\.git)?$` byte-for-byte.
  // Bash regex is GREEDY on `[^/]+/[^/]+` — when input ends in `.git`,
  // greedy capture grabs `repo/name.git` and trailing `(\.git)?` matches
  // empty. Result: bash output keeps `.git` suffix. TS port preserves
  // this for drop-in equivalence (downstream consumers may rely on it).
  // Manual extraction: take last two slash-separated segments after the
  // last `:` or `/` separator that precedes them.
  const lastSlash = url.lastIndexOf("/");
  if (lastSlash <= 0) return "unknown";
  const beforeLast = url.slice(0, lastSlash);
  const sepIdx = Math.max(
    beforeLast.lastIndexOf("/"),
    beforeLast.lastIndexOf(":"),
  );
  if (sepIdx < 0) return "unknown";
  const captured = url.slice(sepIdx + 1);
  return captured.length > 0 ? captured : "unknown";
}

function repoFullName(): string {
  const url = gitOutput(["config", "--get", "remote.origin.url"]);
  if (url === "") return "unknown";
  return extractRepoName(url);
}

function isoUtcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

interface Snapshot {
  readonly dateUtc: string;
  readonly headSha: string;
  readonly branch: string;
  readonly repo: string;
  readonly claudeCliVersion: string;
  readonly claudeMdInRepoSha: string;
  readonly claudeMdHomeSha: string;
  readonly agentsMdSha: string;
  readonly memoryIndexSha: string;
  readonly memoryIndexBytes: string;
}

function captureSnapshot(): Snapshot {
  const homeClaudeMd = join(homedir(), ".claude", "CLAUDE.md");
  return {
    dateUtc: isoUtcNow(),
    headSha: gitOutput(["rev-parse", "HEAD"]) || "unknown",
    branch: gitOutput(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown",
    repo: repoFullName(),
    claudeCliVersion: claudeVersion(),
    claudeMdInRepoSha: safeSha("./CLAUDE.md"),
    claudeMdHomeSha: fileExists(homeClaudeMd) ? safeSha(homeClaudeMd) : "",
    agentsMdSha: safeSha("./AGENTS.md"),
    memoryIndexSha: safeSha("memory/MEMORY.md"),
    memoryIndexBytes: safeBytes("memory/MEMORY.md"),
  };
}

function emitJson(s: Snapshot): void {
  process.stdout.write("{\n");
  process.stdout.write(`  "date_utc": "${s.dateUtc}",\n`);
  process.stdout.write(`  "head_sha": "${s.headSha}",\n`);
  process.stdout.write(`  "branch": "${s.branch}",\n`);
  process.stdout.write(`  "repo": "${s.repo}",\n`);
  process.stdout.write(`  "claude_cli_version": "${s.claudeCliVersion}",\n`);
  process.stdout.write(`  "claude_md_sha_in_repo": "${s.claudeMdInRepoSha}",\n`);
  process.stdout.write(`  "claude_md_sha_home": "${s.claudeMdHomeSha}",\n`);
  process.stdout.write(`  "agents_md_sha": "${s.agentsMdSha}",\n`);
  process.stdout.write(`  "memory_index_sha": "${s.memoryIndexSha}",\n`);
  process.stdout.write(`  "memory_index_bytes": "${s.memoryIndexBytes}",\n`);
  process.stdout.write('  "model_snapshot": null,\n');
  process.stdout.write('  "prompt_bundle_hash": null\n');
  process.stdout.write("}\n");
}

function emitYaml(s: Snapshot): void {
  process.stdout.write(`# tick-snapshot captured ${s.dateUtc}\n`);
  process.stdout.write("snapshot:\n");
  process.stdout.write(`  date_utc: ${s.dateUtc}\n`);
  process.stdout.write(`  head_sha: ${s.headSha}\n`);
  process.stdout.write(`  branch: ${s.branch}\n`);
  process.stdout.write(`  repo: ${s.repo}\n`);
  process.stdout.write(`  claude_cli_version: ${s.claudeCliVersion}\n`);
  process.stdout.write("  files:\n");
  process.stdout.write(`    claude_md_in_repo_sha: ${s.claudeMdInRepoSha}\n`);
  process.stdout.write(`    claude_md_home_sha: ${s.claudeMdHomeSha}\n`);
  process.stdout.write(`    agents_md_sha: ${s.agentsMdSha}\n`);
  process.stdout.write(`    memory_index_sha: ${s.memoryIndexSha}\n`);
  process.stdout.write(`    memory_index_bytes: ${s.memoryIndexBytes}\n`);
  process.stdout.write("  # Agent fills these from session context:\n");
  process.stdout.write("  model_snapshot: null        # e.g., claude-opus-4-7\n");
  process.stdout.write("  prompt_bundle_hash: null    # null until a reconstruct-tool lands\n");
}

export function main(argv: readonly string[]): ExitCode {
  const format: Format = argv[0] === "--json" ? "json" : "yaml";
  const snapshot = captureSnapshot();
  if (format === "json") emitJson(snapshot);
  else emitYaml(snapshot);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
