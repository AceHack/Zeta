#!/usr/bin/env bun
// set-workitem-state.ts — transition a work-item lifecycle state (081KSXN940008QG0R002FWR9B2 slice 2).
//
// Non-terminal transitions (backlog ↔ in-progress) update frontmatter and emit
// `state-changed`. `--close` emits a `closed` event and sets state → closed (no file move).
//
// Usage:
//   bun src/Core.TypeScript/backlog/set-workitem-state.ts <zetaid|path> --to in-progress [--dir workitems] [--dry-run]
//   bun src/Core.TypeScript/backlog/set-workitem-state.ts <zetaid|path> --close [--reason "..."] [--dir workitems] [--dry-run]
//
// Exit codes: 0 ok · 1 event collision · 2 usage / not-found error.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { isCanonical, ZETAID_BASE32_LEN } from "../zeta-id/encoding";
import { SYSTEM_ENV, workItemEventsRoot } from "./new-workitem";
import { publishClosedEvent, publishStateChangedEvent } from "../work-items/lifecycle";
import { parseLifecycleState, type WorkItemLifecycleState } from "../work-items/types";

function extractFrontmatterField(content: string, field: string): string | undefined {
  const end = content.indexOf("\n---", 3);
  const block = content.startsWith("---") && end > 0 ? content.slice(0, end) : content;
  const m = block.match(new RegExp(`^${field}:\\s*(.*)$`, "m"));
  return m ? m[1]!.trim() : undefined;
}

function replaceFrontmatterState(content: string, to: WorkItemLifecycleState): string {
  if (!/^state:\s*.*$/m.test(content)) {
    throw new Error("set-workitem-state: no `state:` field in frontmatter");
  }
  return content.replace(/^state:\s*.*$/m, `state: ${to}`);
}

function resolvePath(arg: string, dir: string): string | null {
  if (arg.includes("/") || arg.endsWith(".md")) {
    return existsSync(arg) ? arg : null;
  }
  const hits: string[] = [];
  const walk = (d: string): void => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory() && e.name !== "done" && e.name !== "events") walk(p);
      else if (e.isFile() && e.name.startsWith(`${arg}-`) && e.name.endsWith(".md")) hits.push(p);
    }
  };
  walk(dir);
  return hits.length === 1 ? hits[0]! : null;
}

function zetaidFromPath(path: string): string {
  const stem = basename(path).slice(0, -3);
  const zetaid = stem.slice(0, ZETAID_BASE32_LEN);
  if (!isCanonical(zetaid)) throw new Error(`set-workitem-state: not a canonical ZetaId filename: ${basename(path)}`);
  return zetaid;
}

function main(argv: readonly string[]): number {
  const args = argv.filter((a) => !a.startsWith("--"));
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const push = flags.has("--push");
  const dirIdx = argv.indexOf("--dir");
  const dir = dirIdx >= 0 ? argv[dirIdx + 1]! : "workitems";
  const toIdx = argv.indexOf("--to");
  const toRaw = toIdx >= 0 ? argv[toIdx + 1] : undefined;
  const reasonIdx = argv.indexOf("--reason");
  const reason = reasonIdx >= 0 ? argv[reasonIdx + 1] : undefined;
  const target = args[0];
  const close = flags.has("--close");

  if (!target || (!close && !toRaw)) {
    process.stderr.write(
      "Usage: bun src/Core.TypeScript/backlog/set-workitem-state.ts <zetaid|path> --to backlog|in-progress [--dir workitems] [--dry-run]\n" +
        "       bun src/Core.TypeScript/backlog/set-workitem-state.ts <zetaid|path> --close [--reason ...] [--dir workitems] [--dry-run]\n",
    );
    return 2;
  }

  const fromPath = resolvePath(target, dir);
  if (!fromPath) {
    process.stderr.write(`set-workitem-state: could not uniquely resolve ${JSON.stringify(target)} under ${dir}/\n`);
    return 2;
  }

  const content = readFileSync(fromPath, "utf8");
  const fromState = parseLifecycleState(extractFrontmatterField(content, "state"));
  if (!fromState) {
    process.stderr.write("set-workitem-state: no valid `state:` in frontmatter\n");
    return 2;
  }

  const zetaid = zetaidFromPath(fromPath);
  const actor = process.env.ZETA_WORKITEM_ACTOR ?? "otto-cli";
  const eventsRoot = workItemEventsRoot(dir);

  if (close) {
    if (fromState === "closed") {
      process.stderr.write("set-workitem-state: already closed\n");
      return 2;
    }
    const newContent = replaceFrontmatterState(content, "closed");
    if (flags.has("--dry-run")) {
      process.stdout.write(`[dry-run] ${fromPath}: ${fromState} → closed\n`);
      return 0;
    }
    writeFileSync(fromPath, newContent, "utf8");
    const result = publishClosedEvent(zetaid, SYSTEM_ENV, actor, eventsRoot, reason, push);
    if (result.kind === "collision") {
      process.stderr.write(`set-workitem-state: event collision at ${result.path}\n`);
      return 1;
    }
    process.stdout.write(`closed ${zetaid}\n  event: ${result.path}\n`);
    return 0;
  }

  const to = parseLifecycleState(toRaw);
  if (!to || to === "done" || to === "closed") {
    process.stderr.write("set-workitem-state: --to must be backlog or in-progress (use complete-workitem for done)\n");
    return 2;
  }
  if (fromState === to) {
    process.stdout.write(`unchanged ${zetaid} (already ${to})\n`);
    return 0;
  }
  if (fromState === "done" || fromState === "closed") {
    process.stderr.write(`set-workitem-state: cannot transition from terminal state ${fromState}\n`);
    return 2;
  }

  const newContent = replaceFrontmatterState(content, to);
  if (flags.has("--dry-run")) {
    process.stdout.write(`[dry-run] ${fromPath}: ${fromState} → ${to}\n`);
    return 0;
  }
  writeFileSync(fromPath, newContent, "utf8");
  const result = publishStateChangedEvent(zetaid, fromState, to, SYSTEM_ENV, actor, eventsRoot, push);
  if (result.kind === "collision") {
    process.stderr.write(`set-workitem-state: event collision at ${result.path}\n`);
    return 1;
  }
  process.stdout.write(`state ${zetaid}: ${fromState} → ${to}\n  event: ${result.path}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
