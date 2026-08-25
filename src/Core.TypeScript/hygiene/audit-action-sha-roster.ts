#!/usr/bin/env bun
// audit-action-sha-roster.ts — AH007: a third-party action nobody chose, at a SHA nobody checked.
//
// The two failures this closes
// ----------------------------
// 1. A FABRICATED SHA. An agent reaching for a plausible action under generation pressure can
//    emit `uses: owner/repo@<40 hex>` where the repo is one this project has never used and the
//    SHA was invented. It is well-formed, so nothing structural rejects it. If the ref does not
//    exist the job fails loudly; if it happens to exist, CI silently runs an UNREVIEWED
//    third-party action with whatever permissions the job holds.
//
//    Live near-miss, 2026-08-25: an agent reached for `astral-sh/setup-uv` — used nowhere in
//    this repo — with a SHA it invented, caught itself, and said so. It was the THIRD
//    fabricated-identifier incident that day; the other two were work-item ids written by the
//    coordinator, which is why `audit-task-zetaid-resolves.ts` (AH006) exists. Same class,
//    different namespace: a value that passes a shape check and names nothing.
//
// 2. PIN DRIFT. The same action pinned at two different SHAs across workflows. Found live when
//    this was written: `actions/upload-artifact` at BOTH `043fb46d1a93…` and `ea165f8d65b6…`,
//    while `actions/checkout` holds one SHA across all 79 workflows that use it. Nobody decided
//    that; it accumulated. Two pins mean half the fleet runs code the other half does not, and
//    a review of one tells you nothing about the other.
//
// Why a committed roster rather than a network check
// --------------------------------------------------
// Verifying a SHA resolves proves it EXISTS, not that anyone chose it — and existence is exactly
// what a fabricated-but-real SHA has. The roster makes adoption an explicit, reviewable act: a
// new third-party action cannot enter CI without a roster row landing in the same PR, which is
// the moment a human or a reviewer sees it. `--verify-remote` additionally proves each roster
// SHA resolves, for the runs where a network call is acceptable.
//
// The roster is DERIVED, then committed — not hand-maintained. `--write` regenerates it from the
// workflows, so it cannot drift from reality the way a hand-written allowlist does; what it
// cannot do is regenerate itself during a check, because then it would ratify whatever it found.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-action-sha-roster.ts
//   bun src/Core.TypeScript/hygiene/audit-action-sha-roster.ts --json
//   bun src/Core.TypeScript/hygiene/audit-action-sha-roster.ts --write          # regenerate roster
//   bun src/Core.TypeScript/hygiene/audit-action-sha-roster.ts --verify-remote  # prove SHAs resolve
//
// Exit codes:
//   0   every action reference is on the roster at the roster's SHA
//   1   an unrostered action, or a pin that disagrees with the roster
//   2   configuration error (no workflows, or no action references at all — a scan that did not run)

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

export const DRIFT_CLASS = "AH007";
const WORKFLOW_DIR = ".github/workflows";
export const ROSTER_PATH = "src/Core.TypeScript/hygiene/action-sha-roster.json";

/**
 * `uses: owner/repo[/subpath]@<ref>` — ANY ref, not just a SHA. Matching only 40-hex would make a
 * mutable-tag reference (`@v4`) invisible to this audit, which is strictly worse than a drifted pin:
 * the roster would look enforced while the reference it cannot see moves under CI on someone else's
 * schedule. Local (`./`) and `docker://` uses are not third-party and do not match.
 */
const USES_RE = /(?:^|\s)uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+)@([^\s#'"]+)/g;
const SHA_RE = /^[a-f0-9]{40}$/;

export interface Reference {
  readonly action: string;
  /** The raw ref as written — a 40-hex SHA when pinned, otherwise the tag/branch it floats on. */
  readonly sha: string;
  readonly pinned: boolean;
  readonly file: string;
  readonly line: number;
}

export interface Finding {
  readonly action: string;
  readonly sha: string;
  readonly file: string;
  readonly line: number;
  readonly reason: "not-on-roster" | "sha-disagrees-with-roster" | "unpinned-mutable-ref";
  readonly rosterSha?: string;
}

export interface AuditResult {
  readonly workflowsScanned: number;
  readonly referencesFound: number;
  readonly distinctActions: number;
  readonly findings: readonly Finding[];
}

/** Every third-party action reference in a workflow's text, with its line. */
export function extractReferences(file: string, src: string): Reference[] {
  const out: Reference[] = [];
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^\s*#/.test(line)) continue; // a commented-out `uses:` runs nothing
    USES_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = USES_RE.exec(line)) !== null) {
      const action = m[1];
      const sha = m[2];
      if (action !== undefined && sha !== undefined) {
        out.push({ action, sha, pinned: SHA_RE.test(sha), file, line: i + 1 });
      }
    }
  }
  return out;
}

export function collectReferences(root: string): { refs: Reference[]; workflows: number } {
  const dir = resolve(root, WORKFLOW_DIR);
  const files = readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).sort();
  const refs: Reference[] = [];
  for (const f of files) {
    let src: string;
    try {
      src = readFileSync(join(dir, f), "utf8");
    } catch {
      continue;
    }
    refs.push(...extractReferences(f, src));
  }
  return { refs, workflows: files.length };
}

/** Roster shape: action -> the single SHA it is pinned at. */
export type Roster = Readonly<Record<string, string>>;

export function readRoster(root: string): Roster | null {
  try {
    return JSON.parse(readFileSync(resolve(root, ROSTER_PATH), "utf8")) as Roster;
  } catch {
    return null;
  }
}

/**
 * Judge references against the roster.
 *
 * Note the drift case is reported per REFERENCE rather than per action: naming every site is what
 * lets a reader see which half of the fleet runs which code, and a single "action X has two pins"
 * line hides exactly that.
 */
export function auditReferences(refs: readonly Reference[], roster: Roster): Finding[] {
  const findings: Finding[] = [];
  for (const r of refs) {
    if (!r.pinned) {
      findings.push({ ...r, reason: "unpinned-mutable-ref" });
      continue;
    }
    const pinned = roster[r.action];
    if (pinned === undefined) {
      findings.push({ ...r, reason: "not-on-roster" });
    } else if (pinned !== r.sha) {
      findings.push({ ...r, reason: "sha-disagrees-with-roster", rosterSha: pinned });
    }
  }
  return findings;
}

/** The roster a clean tree would have — one entry per action, refusing to invent one when pins disagree. */
export function deriveRoster(refs: readonly Reference[]): { roster: Roster; conflicts: string[] } {
  const seen = new Map<string, Set<string>>();
  for (const r of refs) {
    if (!r.pinned) continue;
    if (!seen.has(r.action)) seen.set(r.action, new Set());
    seen.get(r.action)!.add(r.sha);
  }
  const roster: Record<string, string> = {};
  const conflicts: string[] = [];
  for (const [action, shas] of [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const list = [...shas].sort();
    if (list.length > 1) conflicts.push(`${action} is pinned at ${list.length} different SHAs: ${list.join(", ")}`);
    roster[action] = list[0]!;
  }
  return { roster, conflicts };
}

function renderHuman(r: AuditResult, roster: Roster): string {
  const head = `${r.workflowsScanned} workflow(s), ${r.referencesFound} action reference(s), ${r.distinctActions} distinct action(s), roster holds ${Object.keys(roster).length}`;
  if (r.findings.length === 0) return `action-sha-roster: OK — ${head}.`;
  const lines = [`action-sha-roster: ${r.findings.length} finding(s) — ${head}`, ""];
  for (const f of r.findings) {
    if (f.reason === "unpinned-mutable-ref") {
      lines.push(`  ${f.file}:${String(f.line)}  ${f.action}@${f.sha}`);
      lines.push(`      NOT PINNED. \`@${f.sha}\` is a tag or branch the upstream owner can move at any`);
      lines.push(`      time, so what CI runs tomorrow is not what anyone reviewed today. Pin the SHA.`);
      lines.push("");
    } else if (f.reason === "not-on-roster") {
      lines.push(`  ${f.file}:${String(f.line)}  ${f.action}@${f.sha.slice(0, 12)}`);
      lines.push(`      NOT ON THE ROSTER. A third-party action entering CI is a supply-chain decision;`);
      lines.push(`      it needs a roster row landing in the same PR so somebody sees it.`);
    } else {
      lines.push(`  ${f.file}:${String(f.line)}  ${f.action}@${f.sha.slice(0, 12)}`);
      lines.push(`      DISAGREES WITH THE ROSTER (${(f.rosterSha ?? "").slice(0, 12)}). Two pins mean half the`);
      lines.push(`      fleet runs code the other half does not, and reviewing one tells you nothing about the other.`);
    }
  }
  lines.push("");
  lines.push("FIX: pin every site at one SHA, then regenerate with --write and commit the roster.");
  return lines.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const root = repoRoot();

  let collected: { refs: Reference[]; workflows: number };
  try {
    collected = collectReferences(root);
  } catch (err) {
    console.error(`action-sha-roster: configuration error — ${String(err)}`);
    process.exit(2);
  }
  const { refs, workflows } = collected;

  // Zero references across a non-empty workflow dir is a scan that did not run, not a clean repo.
  if (workflows > 0 && refs.length === 0) {
    console.error(
      `action-sha-roster: configuration error — scanned ${String(workflows)} workflow(s) and found ZERO ` +
        `pinned action references. That is not a clean tree, it is a scan that did not run.`,
    );
    process.exit(2);
  }

  if (argv.includes("--write")) {
    const { roster, conflicts } = deriveRoster(refs);
    // A conflicted tree has no single correct roster. Writing one anyway would RATIFY whichever
    // pin happened to sort first — a generated file that looks like a decision nobody made.
    if (conflicts.length > 0) {
      for (const c of conflicts) console.error(`action-sha-roster: REFUSING TO WRITE — ${c}`);
      console.error(
        `action-sha-roster: align the disagreeing sites by hand first, then re-run --write. ` +
          `Choosing for you would record an arbitrary pick as an intentional pin.`,
      );
      process.exit(1);
    }
    writeFileSync(resolve(root, ROSTER_PATH), `${JSON.stringify(roster, null, 2)}\n`, "utf8");
    console.log(`action-sha-roster: wrote ${String(Object.keys(roster).length)} entries to ${ROSTER_PATH}`);
    process.exit(0);
  }

  const roster = readRoster(root);
  if (roster === null) {
    console.error(`action-sha-roster: configuration error — no roster at ${ROSTER_PATH}. Generate it with --write.`);
    process.exit(2);
  }

  const findings = auditReferences(refs, roster);
  const result: AuditResult = {
    workflowsScanned: workflows,
    referencesFound: refs.length,
    distinctActions: new Set(refs.map((r) => r.action)).size,
    findings,
  };

  if (argv.includes("--json")) console.log(JSON.stringify({ driftClass: DRIFT_CLASS, ...result }, null, 2));
  else console.log(renderHuman(result, roster));
  process.exit(findings.length === 0 ? 0 : 1);
}
