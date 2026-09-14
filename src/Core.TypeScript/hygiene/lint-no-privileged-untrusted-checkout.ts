#!/usr/bin/env bun
// lint-no-privileged-untrusted-checkout.ts — the premise under CodeQL alert #798, enforced.
//
// A DISMISSAL WHOSE PREMISE NOTHING CHECKS IS THE VACUITY CLASS. Alert #798
// ("Checkout of untrusted code in a non-privileged context", .github/workflows/gate.yml)
// is dismissed because gate.yml checks out `base.sha` rather than the PR head, and because
// no workflow in this tree runs on a privileged trigger at all. Both halves are one edit
// away from being false and neither would announce it. That is what this file is for.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THE SEVERE CASE IS THE PAIR, NOT EITHER HALF
//
// Checking out a PR head is NORMAL and safe under `pull_request`: a forked PR gets a
// read-only token and no secrets, so running the author's code grants the author nothing
// they did not already have. `resume-diff.yml` does exactly this, deliberately.
//
// The vulnerability is the PAIR. Under a PRIVILEGED trigger — `pull_request_target`,
// `workflow_run`, `issue_comment` — the job runs with the BASE repository's secrets and a
// write token, while the code being checked out is still the PR author's. Anyone who can
// open a PR then executes code inside a privileged context. That is the class this file
// refuses, and refusing the pair is what lets the safe single halves keep working.
//
// MEASURED 2026-09-13 by parsing every workflow's `on:` block as YAML (not by grepping —
// the repo's own `pull_request_target` mentions are all PROSE saying "never
// pull_request_target", and a grep for the identifier matches the comment that forbids it):
//
//   workflows with a privileged trigger ................ 1  (rerun-cancelled-gate.yml,
//     `workflow_run` — its bare checkout resolves to the DEFAULT BRANCH, which is trusted;
//     see `isUntrusted` for why the default ref's trust depends on the event)
//   gate.yml checkout ref ............................. github.event.pull_request.base.sha
//
// WHAT MAKES THIS CHECKER GO RED:
//   - any workflow adds `pull_request_target` / `workflow_run` / `issue_comment` AND
//     checks out an author-controlled ref (the critical pair), or
//   - gate.yml's PR checkout stops pinning a base-side ref (the #798 premise itself).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// NO EXTERNAL IMPORTS. This runs in the `lint (build-graph completeness)` job, which sets up
// bun but never runs `bun install` -- every sibling premise checker there imports `node:`
// builtins only. The first version of this file imported `yaml` and died in CI with
// "Cannot find package 'yaml'" while passing locally, which is the tier lesson in miniature:
// a checker is only as available as the job it runs in. The line-oriented reader below is
// validated against the `yaml` parser over all 96 real workflows by the test file, which DOES
// run in a tier with dependencies -- so the hand parser is checked, not trusted.

const WORKFLOW_DIR = ".github/workflows";
const GATE = "gate.yml";

/** Triggers that run with the BASE repo's secrets and write token while the PR author
 *  still controls the code. The pair of one of these with an untrusted ref is the defect. */
export const PRIVILEGED_TRIGGERS: readonly string[] = [
  "pull_request_target",
  "workflow_run",
  "issue_comment",
];

/** Refs whose content the PR author controls. `head_ref`/`head.sha`/`head.ref` are the
 *  author's branch; `refs/pull/N/merge` includes the author's commits. */
const UNTRUSTED_REF = /pull_request\.head\.|github\.head_ref|workflow_run\.head_|refs\/pull\//u;

/** A ref is base-side when it names the target branch's commit — trusted, already reviewed. */
const BASE_REF = /pull_request\.base\.sha|github\.event\.before|\bbase_ref\b/u;

export interface Finding {
  readonly workflow: string;
  readonly detail: string;
}

/** Strip a `#` comment, but never inside quotes. Workflow refs contain `#` in pinned
 *  action SHAs (`uses: actions/checkout@sha # v7`), so a naive split corrupts them. */
function uncomment(line: string): string {
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q !== null) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === "#") return line.slice(0, i);
  }
  return line;
}

function indentOf(line: string): number {
  // NARROWED, NOT ASSERTED. `noUncheckedIndexedAccess` types a capture group as
  // `string | undefined` even where the pattern guarantees it, and the house style here is to
  // narrow rather than reach for `!`.
  const m = /^(\s*)/u.exec(line);
  const lead = m === null ? undefined : m[1];
  return lead === undefined ? 0 : lead.length;
}

/** The top-level `on:` keys. YAML 1.1 also lets `on` be written quoted, and some workflows
 *  use the flow form `on: [a, b]` or the scalar `on: push` — all three are read here. A
 *  reader that only handled the block form would see NO triggers on a flow-form workflow and
 *  pass it unconditionally, which is the vacuity class by parser gap. */
export function triggersOf(text: string): readonly string[] {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const m = /^(?:on|"on"|'on'):\s*(.*)$/u.exec(uncomment(line));
    if (m === null) continue;
    const inline = (m[1] ?? "").trim();
    if (inline.startsWith("[")) {
      return inline.replace(/^\[|\]$/gu, "").split(",")
        .map((t) => t.trim().replace(/^["']|["']$/gu, "")).filter((t) => t.length > 0);
    }
    if (inline.length > 0) return [inline.replace(/^["']|["']$/gu, "")];
    const keys: string[] = [];
    for (const rest of lines.slice(i + 1)) {
      const l = uncomment(rest);
      if (l.trim().length === 0) continue;
      if (indentOf(l) === 0) break;            // dedent to column 0 ends the block
      const k = /^\s+([A-Za-z_][\w-]*):/u.exec(l);
      const key = k === null ? undefined : k[1];
      if (key !== undefined && indentOf(l) <= 2) keys.push(key);
    }
    return keys;
  }
  return [];
}

/** Every `ref:` handed to an actions/checkout step, in document order. A checkout with no
 *  `ref:` is recorded as `<default>` rather than skipped — absence is a fact about trust,
 *  never an excuse to say nothing. */
export function checkoutRefs(text: string): readonly string[] {
  const lines = text.split("\n").map(uncomment);
  const refs: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i];
    if (head === undefined || !/uses:\s*actions\/checkout/u.test(head)) continue;
    const stepIndent = indentOf(head);
    let found: string | null = null;
    for (const l of lines.slice(i + 1)) {
      if (l.trim().length === 0) continue;
      // Next step (a `- ` at or left of this step) or a dedent ends the window.
      if (indentOf(l) < stepIndent) break;
      if (indentOf(l) === stepIndent && /^\s*-\s/u.test(l)) break;
      const m = /\bref:\s*(.+)$/u.exec(l);
      const raw = m === null ? undefined : m[1];
      if (raw !== undefined) {
        let v = raw.trim();
        // Only a FLOW mapping (`with: { ref: x }`) puts a closing brace after the value.
        // A block-form `ref: ${{ ... }}` ends in `}}` that belongs to the expression — the
        // first version stripped at the first `}` and reported a truncated ref.
        if (/\{/u.test(l.slice(0, l.indexOf("ref:"))) && v.endsWith("}")) {
          v = v.slice(0, -1).trim().replace(/,$/u, "").trim();
        }
        found = v.replace(/^["']|["']$/gu, "");
        break;
      }
    }
    refs.push(found ?? "<default>");
  }
  return refs;
}

/** Whether a checkout ref is author-controlled, GIVEN the workflow's triggers.
 *
 *  The default ref is NOT universally untrusted, and treating it so was this checker's
 *  first bug — it fired on `rerun-cancelled-gate.yml`, whose bare checkout is its
 *  documented safety guard. What `actions/checkout` resolves to with no `ref:` depends
 *  entirely on the event:
 *
 *    pull_request / pull_request_target -> refs/pull/N/merge, which CONTAINS the author's
 *                                          commits. Untrusted.
 *    workflow_run / issue_comment / push / schedule -> the DEFAULT BRANCH at its tip.
 *                                          Trusted, already reviewed and merged.
 *
 *  A checker that flags the safest available pattern is worse than no checker: it trains
 *  readers to dismiss it, and the real finding then arrives pre-ignored. */
export function isUntrusted(ref: string, triggers: readonly string[]): boolean {
  if (UNTRUSTED_REF.test(ref)) return true;
  if (ref !== "<default>") return false;
  return triggers.some((t) => t === "pull_request" || t === "pull_request_target");
}

/** The critical pair: a privileged trigger AND a checkout the PR author controls. */
export function findPrivilegedUntrustedCheckout(name: string, text: string): Finding | null {
  const all = triggersOf(text);
  const trig = all.filter((t) => PRIVILEGED_TRIGGERS.includes(t));
  if (trig.length === 0) return null;
  const bad = checkoutRefs(text).filter((r) => isUntrusted(r, all));
  if (bad.length === 0) return null;
  return {
    workflow: name,
    detail: `privileged trigger [${trig.join(", ")}] checks out author-controlled ref(s) [${bad.join(", ")}]`,
  };
}

/** #798's own premise: gate.yml's PR-event checkout stays pinned to a base-side ref. */
export function gatePinsBaseRef(text: string): boolean {
  const refs = checkoutRefs(text);
  if (refs.length === 0) return false; // no checkout to inspect => cannot confirm => not a pass
  return refs.some((r) => BASE_REF.test(r));
}

function main(): number {
  const files = readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  const findings: Finding[] = [];
  const unreadable: string[] = [];
  let gateSeen = false;
  let gateOk = false;

  for (const f of files) {
    let text: string;
    try {
      text = readFileSync(join(WORKFLOW_DIR, f), "utf8");
    } catch (e) {
      // A workflow this cannot read is UNKNOWN, never assumed safe.
      unreadable.push(`${f}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const finding = findPrivilegedUntrustedCheckout(f, text);
    if (finding !== null) findings.push(finding);
    if (f === GATE) { gateSeen = true; gateOk = gatePinsBaseRef(text); }
  }

  console.log(`scanned ${String(files.length)} workflow file(s) in ${WORKFLOW_DIR}`);
  for (const u of unreadable) console.log(`  UNKNOWN  ${u}`);
  if (!gateSeen) {
    console.log(`  FAIL     ${GATE} not found — #798's premise cannot be confirmed`);
  } else if (gateOk) {
    console.log(`  ok       ${GATE} pins a base-side checkout ref (#798 premise holds)`);
  } else {
    console.log(`  FAIL     ${GATE} no longer pins a base-side checkout ref — #798's premise is GONE`);
  }
  if (findings.length === 0) {
    console.log(`  ok       no workflow pairs a privileged trigger with an author-controlled checkout`);
  }
  for (const f of findings) console.log(`  FAIL     ${f.workflow}: ${f.detail}`);

  const failed = findings.length > 0 || unreadable.length > 0 || !gateSeen || !gateOk;
  console.log(failed ? "\nprivileged-untrusted-checkout premise FAILS." : "\nprivileged-untrusted-checkout premise holds.");
  return failed ? 1 : 0;
}

if (import.meta.main) process.exit(main());
