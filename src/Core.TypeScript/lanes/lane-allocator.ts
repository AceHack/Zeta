#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

type Lane = "doc" | "code";
type Command = "allocate" | "release" | "path" | "status";

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- lane helpers intentionally delegate to repository-local git.
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write("error: not inside a git repository\n");
    process.exit(3);
  }
  return result.stdout.trim();
}

function lanePath(root: string, lane: Lane): string {
  const parent = dirname(root);
  const name = basename(root);
  return resolve(parent, `${name}-${lane}-lane`);
}

function parseLane(s: string): Lane | null {
  if (s === "doc" || s === "code") return s;
  return null;
}

function parseCommand(s: string): Command | null {
  if (s === "allocate" || s === "release" || s === "path" || s === "status") {
    return s;
  }
  return null;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function allocate(root: string, lane: Lane, branch: string): void {
  const wt = lanePath(root, lane);
  if (isDirectory(wt)) {
    process.stderr.write(`error: worktree already exists at ${wt}\n`);
    process.stderr.write(`       run: lane-allocator.ts release ${lane}\n`);
    process.exit(2);
  }
  process.stdout.write(`Allocating ${lane}-lane worktree...\n`);
  process.stdout.write(`  path:   ${wt}\n`);
  process.stdout.write(`  branch: ${branch}\n`);
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- lane helpers intentionally delegate to repository-local git.
  const result = spawnSync("git", ["worktree", "add", wt, "-b", branch], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.stderr.write("error: git worktree add failed\n");
    process.exit(3);
  }
  process.stdout.write(`OK: ${lane}-lane allocated at ${wt} on branch ${branch}\n`);
}

function release(root: string, lane: Lane): void {
  const wt = lanePath(root, lane);
  if (!isDirectory(wt)) {
    process.stdout.write(`no ${lane}-lane worktree at ${wt}; nothing to release\n`);
    return;
  }
  process.stdout.write(`Releasing ${lane}-lane worktree at ${wt}...\n`);
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- lane helpers intentionally delegate to repository-local git.
  const result = spawnSync("git", ["worktree", "remove", wt, "--force"], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.stderr.write("error: git worktree remove failed\n");
    process.exit(3);
  }
  process.stdout.write(`OK: ${lane}-lane released\n`);
}

function path(root: string, lane: Lane): void {
  process.stdout.write(lanePath(root, lane) + "\n");
}

function status(root: string): void {
  process.stdout.write("Lane worktree status:\n");
  for (const lane of ["doc", "code"] as Lane[]) {
    const wt = lanePath(root, lane);
    if (isDirectory(wt)) {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- lane helpers intentionally delegate to repository-local git.
      const result = spawnSync("git", ["-C", wt, "symbolic-ref", "--short", "HEAD"], { encoding: "utf8" });
      const branch = result.status === 0 ? result.stdout.trim() : "(detached)";
      process.stdout.write(`  ${lane.padEnd(4)} lane: ALLOCATED at ${wt} (branch: ${branch})\n`);
    } else {
      process.stdout.write(`  ${lane.padEnd(4)} lane: not allocated\n`);
    }
  }
}

function main(argv: string[]): number {
  if (argv.length < 1 || argv[0] === "-h" || argv[0] === "--help") {
    process.stdout.write(`Usage: lane-allocator.ts <allocate|release|path|status> [lane] [args]\n`);
    return argv.length < 1 ? 64 : 0;
  }
  const cmdArg = argv[0] ?? "";
  const cmd = parseCommand(cmdArg);
  if (!cmd) {
    process.stderr.write(`error: unknown command: ${cmdArg}\n`);
    return 64;
  }

  const root = repoRoot();

  if (cmd === "status") {
    status(root);
    return 0;
  }

  if (argv.length < 2) {
    process.stderr.write(`error: ${cmd} requires <lane>\n`);
    return 64;
  }

  const laneArg = argv[1] ?? "";
  const lane = parseLane(laneArg);
  if (!lane) {
    process.stderr.write(`error: unknown lane: ${laneArg}\n`);
    process.stderr.write("       valid lanes: doc | code\n");
    return 1;
  }

  switch (cmd) {
    case "allocate": {
      if (argv.length < 3) {
        process.stderr.write(`error: allocate requires a branch name\n`);
        return 64;
      }
      allocate(root, lane, argv[2] ?? "");
      return 0;
    }
    case "release":
      release(root, lane);
      return 0;
    case "path":
      path(root, lane);
      return 0;
  }

  return 64;
}

process.exit(main(process.argv.slice(2)));
