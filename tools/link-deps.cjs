#!/usr/bin/env node
/**
 * link-deps.cjs — make a fresh worktree runnable by linking the dependency directories the base
 * checkout already installed.
 *
 * ── WHY LINK, AND WHY IT IS CONFIGURATION ────────────────────────────────────
 * A git worktree is a checkout, not an installation. Installing per worktree costs minutes and
 * network per change; linking what the base checkout already has costs nothing and gives every
 * change the SAME dependency tree its trunk is tested against. Which directories are dependencies is
 * the project's knowledge, so it is configuration: `LINK_DIRS` (newline-separated names, default
 * `node_modules`), and a directory is linked wherever the base checkout has one — at the root and in
 * each workspace — down to `LINK_DEPTH` (default 3). Nothing inside a dependency directory is walked.
 *
 * Run by the worktree change-control's setup hook with `ORG_BASE_CHECKOUT` and `ORG_WORKTREE` set.
 * A change that must alter its dependencies installs them itself; this only provides the baseline.
 *
 * Exit 0 when the worktree has every dependency directory the base has; non-zero, with the reason,
 * otherwise — so an unrunnable checkout refuses the change instead of failing its tests.
 */
"use strict";
const { existsSync, readdirSync, statSync, symlinkSync } = require("node:fs");
const { join, relative } = require("node:path");

const base = process.env.ORG_BASE_CHECKOUT;
const tree = process.env.ORG_WORKTREE || process.cwd();
if (!base) {
  process.stderr.write("[link-deps] ORG_BASE_CHECKOUT is not set\n");
  process.exit(2);
}
const names = (process.env.LINK_DIRS || "node_modules").split(String.fromCharCode(10)).map((s) => s.trim()).filter(Boolean);
const maxDepth = Number(process.env.LINK_DEPTH || "3");
const SKIP = new Set([".git", ...names]);

const linked = [];
const missing = [];
function walk(dir, depth) {
  for (const name of names) {
    const from = join(dir, name);
    if (!existsSync(from)) continue;
    const to = join(tree, relative(base, dir), name);
    if (existsSync(to)) continue;
    if (!existsSync(join(tree, relative(base, dir)))) continue; // a directory the worktree does not have
    try {
      // A JUNCTION on Windows needs no privilege; a symlink elsewhere.
      symlinkSync(from, to, process.platform === "win32" ? "junction" : "dir");
      linked.push(relative(base, from));
    } catch (err) {
      missing.push(relative(base, from) + ": " + String(err && err.message));
    }
  }
  if (depth >= maxDepth) return;
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP.has(e) || e.startsWith(".")) continue;
    const at = join(dir, e);
    try {
      if (statSync(at).isDirectory()) walk(at, depth + 1);
    } catch {
      /* unreadable entries are not dependency directories */
    }
  }
}
walk(base, 0);
for (const l of linked) process.stdout.write("linked " + l + "\n");
if (missing.length > 0) {
  for (const m of missing) process.stderr.write("[link-deps] could not link " + m + "\n");
  process.exit(1);
}
process.stdout.write("[link-deps] " + String(linked.length) + " dependency director" + (linked.length === 1 ? "y" : "ies") + " linked into " + tree + "\n");
