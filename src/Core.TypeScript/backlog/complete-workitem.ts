#!/usr/bin/env bun
// complete-workitem.ts — move a work-item to done (081KSXN940008QG0R002FWR9B2 lifecycle = folder).
//
// Completing a work-item:
//   1. updates frontmatter: state → done, adds `completed: <ISO datetime>` (precise;
//      DORA lead-time = created→completed),
//   2. MOVES the file workitems/<zetaid>-<desc>.md → workitems/done/YYYY/MM/<zetaid>-<desc>.md
//      (folder = state; YYYY/MM from the COMPLETION date — path answers "done when",
//      the ZetaId prefix still answers "created when"). A move is a git rename of a
//      disjoint, ZetaId-prefixed file → conflict-free even with 500 concurrent agents.
//
// NO AGGREGATE INDEX IS WRITTEN — 081KZZ3Q990087G0R003QXYVN6.
// This used to also append a line to `workitems/done/index.jsonl`, which put a single
// shared read-modify-write file back on a path whose whole point is disjointness: two
// agents completing items concurrently conflicted on that one file, pairwise (observed
// three times on 2026-08-13, each hand-union-resolved during a rebase). The done SET is
// already the shard store — `done/YYYY/MM/<zetaid>-*.md`, one file per record, path a
// function of the ZetaId, so a duplicate is unrepresentable — and every field the index
// carried (id, path, completed, title) is a projection of that file. A derived aggregate
// of a store nobody queried was pure conflict surface, so it is gone rather than
// re-derived: at removal it had 36 lines against 76 done items (53% stale) and ZERO
// readers in the repo, which is the evidence that it was never load-bearing.
// Need the list? Walk `workitems/done/**/*.md` — that walk is the index.
//
// DST (manifesto §7): the core `completeWorkItem` is a PURE function of
// (content, fromPath, env); the clock arrives via env. Date.now() is only in
// SYSTEM_ENV at the CLI boundary.
//
// Usage:
//   bun src/Core.TypeScript/backlog/complete-workitem.ts <zetaid|path> [--dir workitems] [--dry-run]
//
// Exit codes: 0 ok · 2 usage / not-found error.

import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { isCanonical, ZETAID_BASE32_LEN } from "../zeta-id/encoding";
import { SYSTEM_ENV, workItemEventsRoot, type WorkItemEnv } from "./new-workitem";
import { publishStateChangedEvent } from "../work-items/lifecycle";
import { parseLifecycleState, type WorkItemLifecycleState } from "../work-items/types";

export interface CompletedWorkItem {
  readonly zetaid: string;
  readonly fromPath: string;
  readonly toPath: string;
  readonly fromState: WorkItemLifecycleState;
  readonly newContent: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function extractFrontmatterField(content: string, field: string): string | undefined {
  // only scan the leading --- ... --- block
  const end = content.indexOf("\n---", 3);
  const block = content.startsWith("---") && end > 0 ? content.slice(0, end) : content;
  const m = block.match(new RegExp(`^${field}:\\s*(.*)$`, "m"));
  return m ? m[1]!.trim() : undefined;
}

/** Pure: compute the done-path, updated content, and index line. No filesystem. */
export function completeWorkItem(content: string, fromPath: string, env: WorkItemEnv): CompletedWorkItem {
  const file = basename(fromPath);
  if (!file.endsWith(".md")) {
    throw new Error(`complete-workitem: expected a .md work-item file, got ${JSON.stringify(file)}`);
  }
  const stem = file.slice(0, -3);
  const zetaid = stem.slice(0, ZETAID_BASE32_LEN);
  if (!isCanonical(zetaid)) {
    throw new Error(`complete-workitem: ${JSON.stringify(file)} does not start with a canonical ZetaId`);
  }

  const ms = env.nowMs();
  const d = new Date(ms);
  const yyyy = String(d.getUTCFullYear());
  const mm = pad2(d.getUTCMonth() + 1);
  const completedIso = d.toISOString();
  const workItemsDir = dirname(fromPath);
  const toPath = join(workItemsDir, "done", yyyy, mm, file);

  const fromState = parseLifecycleState(extractFrontmatterField(content, "state"));
  if (!fromState) {
    throw new Error("complete-workitem: no valid `state:` field in frontmatter");
  }
  if (fromState === "done" || fromState === "closed") {
    throw new Error(`complete-workitem: item already terminal (state: ${fromState})`);
  }

  // Update frontmatter: state → done; insert/replace `completed:`.
  let newContent = content;
  if (/^state:\s*.*$/m.test(newContent)) {
    newContent = newContent.replace(/^state:\s*.*$/m, "state: done");
  } else {
    throw new Error("complete-workitem: no `state:` field in frontmatter");
  }
  if (/^completed:\s*.*$/m.test(newContent)) {
    newContent = newContent.replace(/^completed:\s*.*$/m, `completed: ${completedIso}`);
  } else {
    // insert after the `created:` line if present, else before the closing ---
    if (/^created:\s*.*$/m.test(newContent)) {
      newContent = newContent.replace(/^(created:\s*.*)$/m, `$1\ncompleted: ${completedIso}`);
    } else {
      newContent = newContent.replace(/\n---/, `\ncompleted: ${completedIso}\n---`);
    }
  }

  return { zetaid, fromPath, toPath, fromState, newContent };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

/** Resolve a work-item file from a zetaid (glob `<zetaid>-*.md` under dir, recursive)
 *  or an explicit path. */
function resolvePath(arg: string, dir: string): string | null {
  if (arg.includes("/") || arg.endsWith(".md")) {
    return existsSync(arg) ? arg : null;
  }
  // treat arg as a zetaid prefix; search dir (active) then done/** recursively
  const hits: string[] = [];
  const walk = (d: string): void => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.startsWith(`${arg}-`) && e.name.endsWith(".md")) hits.push(p);
    }
  };
  walk(dir);
  return hits.length === 1 ? hits[0]! : null;
}

function main(argv: readonly string[]): number {
  const args = argv.filter((a) => !a.startsWith("--"));
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const push = flags.has("--push");
  const dirIdx = argv.indexOf("--dir");
  const dir = dirIdx >= 0 ? argv[dirIdx + 1]! : "workitems";
  const target = args[0];

  if (!target) {
    process.stderr.write("Usage: bun src/Core.TypeScript/backlog/complete-workitem.ts <zetaid|path> [--dir workitems] [--dry-run]\n");
    return 2;
  }
  const fromPath = resolvePath(target, dir);
  if (!fromPath) {
    process.stderr.write(`complete-workitem: could not uniquely resolve ${JSON.stringify(target)} under ${dir}/\n`);
    return 2;
  }

  const content = readFileSync(fromPath, "utf8");
  let done: CompletedWorkItem;
  try {
    done = completeWorkItem(content, fromPath, SYSTEM_ENV);
  } catch (e) {
    process.stderr.write(`complete-workitem: ${(e as Error).message}\n`);
    return 2;
  }

  if (flags.has("--dry-run")) {
    process.stdout.write(`[dry-run] ${done.fromPath} → ${done.toPath}\n`);
    return 0;
  }

  mkdirSync(dirname(done.toPath), { recursive: true });
  if (existsSync(done.toPath)) {
    process.stderr.write(`complete-workitem: refusing to overwrite existing ${done.toPath}\n`);
    return 2;
  }
  writeFileSync(done.toPath, done.newContent, "utf8");
  rmSync(done.fromPath);
  const workItemsDir = dirname(done.fromPath);

  const actor = process.env.ZETA_WORKITEM_ACTOR ?? "otto-cli";
  const eventsRoot = workItemEventsRoot(workItemsDir);
  const stateResult = publishStateChangedEvent(
    done.zetaid,
    done.fromState,
    "done",
    SYSTEM_ENV,
    actor,
    eventsRoot,
    push,
  );
  if (stateResult.kind === "collision") {
    process.stderr.write(`complete-workitem: event collision at ${stateResult.path}\n`);
    return 1;
  }

  process.stdout.write(
    `completed ${done.zetaid}\n  ${done.fromPath} → ${done.toPath}\n  event: ${stateResult.path}\n`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
