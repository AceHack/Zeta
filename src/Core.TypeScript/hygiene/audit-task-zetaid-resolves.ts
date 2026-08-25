#!/usr/bin/env bun
// audit-task-zetaid-resolves.ts — a Task id that is well-formed and identifies nothing.
//
// The gap this closes
// -------------------
// `agencysignature-block.ts` validates the `Task:` trailer with two tests:
// `PLACEHOLDER_TASK_RE` (is it an unfilled template?) and `TASK_RE` (is it SHAPED like a
// ZetaId?). Neither asks whether the id EXISTS. So a well-formed invented key passes the
// gate silently, and it is harder to catch by eye than a placeholder precisely because it
// looks exactly right.
//
// Live instance, and the reason this exists: on 2026-08-25 the shadow wrote
// `Task: 081M0X0JQGY087G0R000EBCPQ3` into a commit trailer without minting it. It matches
// no work-item. It passed local validation and would have merged. It was caught by hand,
// afterwards, by an author who happened to re-read his own trailer — which is not a
// control, it is luck.
//
// The legacy id scheme already has this guard. `src/Core.TypeScript/backlog/b-ref-resolve.ts`
// requires a `B-NNNN` mentioned in prose to resolve to a real row or archive artifact. The
// ZetaId scheme that REPLACED it — per `.claude/rules/workitems-mint-with-zetaid.md` — never
// got the equivalent. So the newer, mandatory key is the less-checked one.
//
// What resolution means
// ---------------------
// A Task id resolves when a work-item file carries it as its filename prefix, in either
// state — `workitems/<id>-*.md` (open) or `workitems/done/YYYY/MM/<id>-*.md` (completed).
// State is a FOLDER here (see the work-item body comment), so both are valid referents and
// checking only the open set would fail every commit whose item has since been completed.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-task-zetaid-resolves.ts <id> [<id>...]
//   bun src/Core.TypeScript/hygiene/audit-task-zetaid-resolves.ts --stdin   # ids or trailer text
//   bun src/Core.TypeScript/hygiene/audit-task-zetaid-resolves.ts --json
//
// Exit codes:
//   0   every id given resolves to a work-item
//   1   at least one does not
//   2   configuration error (no work-items found at all — a scan that did not run)

import { readdirSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join, resolve } from "node:path";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

export const DRIFT_CLASS = "AH006";

/** A ZetaId as minted by `new-workitem.ts`: 26 chars, Crockford-ish base32, `081` era prefix. */
export const ZETAID_RE = /\b(081[0-9A-Z]{23})\b/g;

/** `Task: <id>` in an AgencySignature block. */
const TASK_LINE_RE = /^Task:\s*(\S+)\s*$/gm;

export interface Finding {
  id: string;
  reason: "no-such-workitem";
}

export interface AuditResult {
  workItemsIndexed: number;
  /** Distinguishes "checked N and all resolved" from "was handed nothing to check". */
  inputWasEmpty: boolean;
  idsChecked: number;
  findings: Finding[];
}

/**
 * Every ZetaId that a committed work-item claims, in either state.
 *
 * Built by walking the directory rather than by globbing a pattern, because a glob that
 * matches nothing and a directory that is empty are indistinguishable to the caller — and
 * "no work-items exist" must be a CONFIGURATION ERROR here, never a silent pass. An index
 * of size zero would make every id unresolvable and this check maximally loud in the wrong
 * direction; the runner treats it as exit 2 instead.
 */
export function indexWorkItems(root: string): Set<string> {
  const ids = new Set<string>();
  const walk = (dir: string, depth: number): void => {
    if (depth > 6) return;
    // `withFileTypes` returns the entry KIND from the same syscall that listed it. The
    // readdir-then-stat form this replaces is a check-then-use race (CWE-367) — the entry
    // can change between the two calls — and the repo's own TOCTOU lint caught it here.
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const e = ent.name;
      if (ent.isDirectory()) {
        // `events/` holds append-only event JSON keyed by a DIFFERENT id space; walking it
        // would admit ids that name no work-item and quietly make this check pass.
        if (e === "events") continue;
        walk(join(dir, e), depth + 1);
        continue;
      }
      if (!e.endsWith(".md")) continue;
      const m = /^(081[0-9A-Z]{23})-/.exec(e);
      if (m && m[1]) ids.add(m[1]);
    }
  };
  walk(join(root, "workitems"), 0);
  return ids;
}

/** Task ids named in arbitrary text — a commit message, a PR body, or a bare list. */
export function extractTaskIds(text: string): string[] {
  const out = new Set<string>();
  TASK_LINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TASK_LINE_RE.exec(text)) !== null) {
    const v = m[1];
    if (v !== undefined && /^081[0-9A-Z]{23}$/.test(v)) out.add(v);
  }
  // A bare list of ids (the CLI form) has no `Task:` prefix.
  if (out.size === 0) {
    ZETAID_RE.lastIndex = 0;
    let z: RegExpExecArray | null;
    while ((z = ZETAID_RE.exec(text)) !== null) {
      const v = z[1];
      if (v !== undefined) out.add(v);
    }
  }
  return [...out];
}

export function auditIds(ids: readonly string[], known: ReadonlySet<string>): Finding[] {
  return ids.filter((id) => !known.has(id)).map((id) => ({ id, reason: "no-such-workitem" as const }));
}

export function runAudit(ids: readonly string[]): AuditResult {
  const known = indexWorkItems(repoRoot());
  return {
    workItemsIndexed: known.size,
    inputWasEmpty: ids.length === 0,
    idsChecked: ids.length,
    findings: auditIds(ids, known),
  };
}

function renderHuman(r: AuditResult): string {
  const head = `${r.idsChecked} Task id(s) against ${r.workItemsIndexed} work-item(s)`;
  if (r.inputWasEmpty) {
    return (
      `task-zetaid-resolves: NO INPUT — found no Task ids to check (index: ${String(r.workItemsIndexed)} work-items). ` +
      `This is NOT a pass. A caller that expected ids and got none is looking at the wrong text — ` +
      `commonly a SHALLOW CI checkout, where 'git log' yields one merge commit carrying no trailer.`
    );
  }
  if (r.findings.length === 0) return `task-zetaid-resolves: OK — ${head}; all resolve.`;
  const lines = [
    `task-zetaid-resolves: UNRESOLVABLE — ${r.findings.length} of ${head}.`,
    "",
    "A Task id that is well-formed and identifies nothing passes the AgencySignature",
    "gate, which checks SHAPE only. It is harder to spot than a placeholder because it",
    "looks exactly right.",
    "",
  ];
  for (const f of r.findings) lines.push(`  ${f.id} — no work-item file carries this id (open or done)`);
  lines.push("");
  lines.push("FIX: mint one instead of writing one —");
  lines.push('  bun src/Core.TypeScript/backlog/new-workitem.ts --type task|bug --title "..."');
  lines.push("...then use the id it prints, and commit the work-item file with the change.");
  return lines.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const wantStdin = argv.includes("--stdin");
  const positional = argv.filter((a) => !a.startsWith("--"));

  let ids: string[] = positional;
  if (wantStdin || positional.length === 0) {
    const text = await Bun.stdin.text().catch(() => "");
    ids = extractTaskIds(text);
  }

  const result = runAudit(ids);

  // A scan that indexed nothing did not run. Reporting "all resolve" over an empty index
  // would be the exact failure this file exists to refuse.
  if (result.workItemsIndexed === 0) {
    console.error(
      "task-zetaid-resolves: configuration error — indexed ZERO work-items under workitems/. " +
        "That is not a clean tree, it is a scan that did not run.",
    );
    process.exit(2);
  }
  if (json) console.log(JSON.stringify({ driftClass: DRIFT_CLASS, ...result }, null, 2));
  else console.log(renderHuman(result));

  // Exit 2, not 0, when handed nothing. Reporting "all resolve" over zero subjects is the
  // vacuity this audit exists to refuse, and it happened on this file's OWN first CI run:
  // the wiring piped a shallow `git log` and the check passed having examined 0 ids.
  if (result.inputWasEmpty) process.exit(2);
  process.exit(result.findings.length === 0 ? 0 : 1);
}
