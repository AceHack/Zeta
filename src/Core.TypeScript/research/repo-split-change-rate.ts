#!/usr/bin/env bun
/**
 * repo-split-change-rate.ts — the DV2.0 change-rate half of the split question.
 *
 * Folds `git log --name-only` over a window, assigns every touched path to a
 * candidate component (the same assignment `repo-split-cut-cost.ts` uses, so
 * the two halves are directly comparable), and reports per component:
 *
 *   - commits that touch it
 *   - SOLO commits (touch it and nothing else) — the split-cheapness signal
 *   - distinct files touched, and the re-touch % (round 2's operative axis)
 *
 * and per component PAIR, the logical coupling: how many commits touch both.
 * Logical coupling is the discriminator round 2 adopted from Gall, Hajek &
 * Jazayeri (ICSM 1998): two directories that always change in the same commit
 * are the same repo, and splitting them yields a distributed transaction
 * wearing a boundary's clothes.
 *
 * Honest limits:
 *   - A squash-merge repo has one commit per PR, so "solo %" is measured at PR
 *     granularity, not at authoring granularity. That is the right unit for a
 *     repo split (a PR is what would have to become two PRs) but it is not the
 *     same thing as developer intent.
 *   - Merge commits are excluded (`--no-merges`): they restate their parents'
 *     paths and would double-count coupling.
 *
 * Usage:
 *   bun src/Core.TypeScript/research/repo-split-change-rate.ts [--since 90]
 */

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { assign, CANDIDATES, type Component } from "./repo-split-cut-cost.ts";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");

export interface CommitFold {
  readonly commits: number;
  readonly perComponent: Map<
    string,
    { commits: number; solo: number; files: Set<string>; touches: number }
  >;
  readonly pairs: Map<string, number>;
}

export function fold(
  since: string,
  components: readonly Component[] = CANDIDATES,
): CommitFold {
  const raw = execFileSync(
    "git",
    [
      "log",
      "--no-merges",
      `--since=${since}`,
      "--format=%x00%H",
      "--name-only",
    ],
    { cwd: REPO_ROOT, maxBuffer: 2048 * 1024 * 1024, encoding: "utf8" },
  );

  const per = new Map<
    string,
    { commits: number; solo: number; files: Set<string>; touches: number }
  >();
  const pairs = new Map<string, number>();
  let commits = 0;

  for (const chunk of raw.split("\u0000")) {
    if (chunk.trim().length === 0) continue;
    const lines = chunk.split("\n");
    const paths = lines.slice(1).filter((l) => l.length > 0);
    if (paths.length === 0) continue;
    commits += 1;

    const hit = new Set<string>();
    for (const p of paths) {
      const c = assign(p, components);
      hit.add(c);
      let s = per.get(c);
      if (s === undefined) {
        s = { commits: 0, solo: 0, files: new Set(), touches: 0 };
        per.set(c, s);
      }
      s.files.add(p);
      s.touches += 1;
    }
    for (const c of hit) {
      const s = per.get(c)!;
      s.commits += 1;
      if (hit.size === 1) s.solo += 1;
    }
    const sorted = [...hit].sort();
    for (let i = 0; i < sorted.length; i++)
      for (let j = i + 1; j < sorted.length; j++) {
        const k = `${sorted[i]} x ${sorted[j]}`;
        pairs.set(k, (pairs.get(k) ?? 0) + 1);
      }
  }

  return { commits, perComponent: per, pairs };
}

function main(): void {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--since");
  const days = i >= 0 ? argv[i + 1]! : "90";
  const since = `${days} days ago`;
  const f = fold(since);

  process.stdout.write(
    `window: --since="${since}"   non-merge commits with paths: ${f.commits}\n\n`,
  );
  process.stdout.write(
    "component    commits    solo   solo%    files   touches   touches/file\n",
  );
  const rows = [...f.perComponent.entries()].sort(
    (a, b) => b[1].commits - a[1].commits,
  );
  for (const [name, s] of rows) {
    const soloPct = ((s.solo / s.commits) * 100).toFixed(0);
    const tpf = (s.touches / s.files.size).toFixed(2);
    process.stdout.write(
      `${name.padEnd(12)} ${String(s.commits).padStart(7)} ${String(s.solo).padStart(7)}` +
        ` ${soloPct.padStart(6)}%  ${String(s.files.size).padStart(7)}` +
        ` ${String(s.touches).padStart(9)}   ${tpf.padStart(12)}\n`,
    );
  }

  process.stdout.write("\nlogical coupling (commits touching BOTH):\n");
  const pr = [...f.pairs.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, v] of pr.slice(0, 30)) {
    const [a, b] = k.split(" x ") as [string, string];
    const ca = f.perComponent.get(a)!.commits;
    const cb = f.perComponent.get(b)!.commits;
    process.stdout.write(
      `${k.padEnd(28)} ${String(v).padStart(5)}   ` +
        `${((v / ca) * 100).toFixed(0)}% of ${a}   ${((v / cb) * 100).toFixed(0)}% of ${b}\n`,
    );
  }
}

if (import.meta.main) main();
