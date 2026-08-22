#!/usr/bin/env bun
/**
 * lint-no-decide-by-grep.ts — refuse a CI gate that decides PASS/FAIL by
 * grepping the output of a process whose exit status it threw away.
 *
 * THE SHAPE
 * ------------------------------------------------------------------------
 *     if some-tool input 2>&1 | grep -q 'BAD'; then fail; fi
 *
 * A pipeline's exit status is the LAST command's. `some-tool`'s status is
 * discarded. So when `some-tool` dies on a signal — 139 = 128+11 SIGSEGV,
 * 134 = 128+6 SIGABRT — it emits nothing, `grep` matches nothing, the
 * condition is false, and the gate PASSES having checked nothing.
 *
 * The failure is worse the louder the crash is, which is the wrong way round:
 * a normal error at least prints a diagnostic the grep might catch; a segfault
 * prints exactly what a clean run prints, which is nothing.
 *
 * MEASURED, 2026-08-15 (this is not a hypothetical hazard):
 *   - `bunx tsc --noEmit` exited 139 with zero bytes of output on a tree whose
 *     typecheck is clean. Same tree, same command, crashes on some runs only.
 *   - `.github/workflows/lean-proof.yml` carried 20 of these over `lake env
 *     lean`. Replaying that step verbatim with a `lake` that SIGSEGVs on every
 *     call: the step exited 0 and printed "axiom audit clean (no sorryAx)".
 *     Twenty proof gates reporting green with no prover output at all.
 *
 * WHAT IS ALLOWED
 * ------------------------------------------------------------------------
 * Pipelines whose producer is a pure-text source (`echo`, `printf`, `cat` of a
 * string you just built, a shell variable). Those cannot silently half-run: if
 * `echo` dies you have lost the machine, not a measurement.
 *
 * The fix for everything else is `run-checked.ts`: run the tool as a child,
 * assert it COMPLETED, and only then look at its output. Order is the point —
 * after the grep, a crash has already been laundered into a verdict.
 *
 * Beacon anchor: POSIX.1-2017 §2.9.2 — "the exit status of a pipeline shall be
 * the exit status of the last command"; and §2.8.2 / `waitpid(2)` WIFSIGNALED
 * for the shell's 128+N convention.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly producer: string;
  readonly text: string;
}

/**
 * Producers whose output may be piped into a decision. All are pure text
 * sources: they read something already in hand rather than performing the
 * computation the gate is asking about.
 */
export const TEXT_PRODUCERS: ReadonlySet<string> = new Set([
  "echo",
  "printf",
  "cat",
  "head",
  "tail",
  "sed",
  "awk",
  "tr",
  "sort",
  "uniq",
  "wc",
  "cut",
  "rev",
  "grep",
  "rg",
  "jq",
  "yq",
  "ls",
  "seq",
  "basename",
  "dirname",
  "env",
  "date",
  "true",
  "false",
  "git",
  "find",
  "xargs",
  "sw_vers",
  "uname",
  "python3",
  "bun",
  "node",
]);

/** Files whose whole subject is this pattern, so they may quote it. */
export const SELF_EXEMPT: readonly string[] = [
  "src/Core.TypeScript/hygiene/lint-no-decide-by-grep.ts",
  "src/Core.TypeScript/hygiene/lint-no-decide-by-grep.test.ts",
  "src/Core.TypeScript/hygiene/run-checked.ts",
  "src/Core.TypeScript/hygiene/signal-death.ts",
  "src/Core.TypeScript/hygiene/signal-death.test.ts",
];

/**
 * The floor. If the scan sees fewer workflow files than this, its scope has
 * regressed and it must exit nonzero rather than report "no findings" — the
 * same vacuity class this lint exists to catch (`lint:markdown` linted zero
 * files and exited 0 for months, #10712).
 */
export const MIN_WORKFLOWS_EXPECTED = 40;

/**
 * POLARITY IS THE WHOLE RULE — and getting it wrong would make the lint noisy
 * in the one direction that is already safe.
 *
 *   if CMD | grep -q PAT; then fail; fi     DENY — pass iff ABSENT. A crash
 *                                           prints nothing, the condition is
 *                                           false, and it PASSES. *The defect.*
 *
 *   if ! CMD | grep -q PAT; then fail; fi   REQUIRE — pass iff PRESENT. A crash
 *   CMD | grep -q PAT           (set -e)    prints nothing, the grep exits 1,
 *                                           and it FAILS. Fail-closed.
 *
 * So only the UN-NEGATED `if` condition is flagged. Two live sites in this repo
 * are the require polarity (`ollama list | awk | grep -qx "$MODEL"` in
 * accelerator-local-llm-validate.yml:74 and macos-install-sh-test.yml:130);
 * they are correct as written and flagging them would be a false positive.
 */
const CONDITION_KEYWORD = /^\s*(if|elif|while|until)\s+/;

/** True when the line is a `fail-if-the-pattern-is-FOUND` condition. */
export function isDenyPolarity(rawLine: string): boolean {
  const m = CONDITION_KEYWORD.exec(rawLine);
  if (m === null) return false;
  return !/^\s*!/.test(rawLine.slice(m[0].length));
}

/** Strip a leading `if`/`elif`/`while`/`until` so the producer is visible. */
function stripConditionKeyword(s: string): string {
  return s.replace(CONDITION_KEYWORD, "");
}

/** First bare word of a command, ignoring `VAR=x` prefixes and redirections. */
export function producerOf(command: string): string | null {
  let rest = command.trim();
  // drop leading assignments: FOO=bar BAZ=qux cmd ...
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(rest)) {
    const sp = rest.indexOf(" ");
    if (sp < 0) return null;
    rest = rest.slice(sp + 1).trim();
  }
  const word = rest.split(/\s+/)[0] ?? "";
  if (word === "") return null;
  // `$(...)`, `"$VAR"`, backticks: not a literal producer we can name
  if (word.startsWith("$") || word.startsWith('"') || word.startsWith("'") || word.startsWith("`")) return null;
  if (word.startsWith("(") || word.startsWith("{")) return null;
  return basename(word);
}

/**
 * Scan one workflow's text. A line is a finding when a pipeline ending in a
 * `grep`/`rg` boolean test has a producer that is NOT a pure text source.
 *
 * Deliberately line-based: these are shell one-liners in YAML `run:` blocks,
 * and a shell parser here would be a bigger surface than the rule it enforces.
 * The consequence is that a pipeline split across a `\` continuation is not
 * seen — a known, named limit rather than a silent one.
 */
export function scanText(file: string, text: string): readonly Finding[] {
  if (SELF_EXEMPT.some((e) => file.endsWith(e))) return [];
  const findings: Finding[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();
    // YAML comments and shell comments are documentation, not execution.
    if (trimmed.startsWith("#")) continue;
    // Only a BOOLEAN grep decides anything.
    if (!/\|\s*(grep|rg)\b[^|]*\s-\w*q/.test(raw)) continue;
    // Only the deny polarity can turn a crash into a pass.
    if (!isDenyPolarity(raw)) continue;

    const segments = stripConditionKeyword(raw).split("|");
    const first = segments[0] ?? "";
    const producer = producerOf(first);
    if (producer === null) continue;
    if (TEXT_PRODUCERS.has(producer)) continue;
    findings.push({ file, line: i + 1, producer, text: trimmed });
  }
  return findings;
}

function trackedWorkflows(repoRoot: string): readonly string[] {
  const out = execFileSync("git", ["ls-files", ".github/workflows"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return out.split("\n").filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
}

export interface ScanResult {
  readonly filesScanned: number;
  readonly findings: readonly Finding[];
}

export function scanRepo(repoRoot: string): ScanResult {
  const files = trackedWorkflows(repoRoot);
  const findings: Finding[] = [];
  for (const f of files) {
    findings.push(...scanText(f, readFileSync(resolve(repoRoot, f), "utf8")));
  }
  return { filesScanned: files.length, findings };
}

function main(): number {
  const repoRoot = resolve(import.meta.dir, "..", "..", "..");
  const { filesScanned, findings } = scanRepo(repoRoot);

  if (filesScanned < MIN_WORKFLOWS_EXPECTED) {
    console.error(
      `lint-no-decide-by-grep: scanned ${filesScanned} workflows, floor is ${MIN_WORKFLOWS_EXPECTED}. ` +
        "Scope regressed — refusing to report a clean run.",
    );
    return 2;
  }

  if (findings.length > 0) {
    console.error("A CI gate decides by grepping output whose exit status was discarded:");
    console.error("");
    for (const f of findings) {
      console.error(`  ${f.file}:${f.line}  (producer: ${f.producer})`);
      console.error(`    ${f.text}`);
    }
    console.error("");
    console.error("A pipeline's exit status is the LAST command's. If the producer dies on a");
    console.error("signal (139 = SIGSEGV, 134 = SIGABRT) it prints nothing, the grep matches");
    console.error("nothing, and the gate PASSES having checked nothing.");
    console.error("");
    console.error("Fix: src/Core.TypeScript/hygiene/run-checked.ts");
    console.error("  bun src/Core.TypeScript/hygiene/run-checked.ts \\");
    console.error("    --label '<what this checks>' --deny '<pattern>' -- <cmd> <args...>");
    return 1;
  }

  console.log(`✓ lint-no-decide-by-grep: ${filesScanned} workflows, no gate decides by a discarded exit status.`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
