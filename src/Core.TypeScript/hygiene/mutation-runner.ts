#!/usr/bin/env bun
/**
 * mutation-runner.ts — the society's standing job: find tests that cannot fail.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-08-01)
 *
 * A passing test proves nothing until you know it can fail. On 2026-08-01 that gap produced, in
 * one day: six unfalsifiable "discharges" promoted into the frozen core, and a cache whose test
 * was named "reclaims unreachable cache entries" while its only assertion was
 * `expect(remaining).toBeGreaterThanOrEqual(0)` — a count, non-negative by construction, true for
 * every possible value. Disabling the retraction entirely left it 3 pass / 0 fail.
 *
 * Every one of those was caught by hand. Hand-catching does not scale and is the most expensive
 * tier there is. This mechanises it.
 *
 * WHY THE FREE-TIER FLEET IS THE RIGHT RUNNER — and it is not about capability:
 *   - ZERO JUDGEMENT. Flip `>=` to `>`, run the suite. Survived ⇒ finding. No model has to be
 *     *right* about anything; it only has to run a command and compare exit codes.
 *   - EMBARRASSINGLY PARALLEL. One mutant per agent per tick. No consensus, no shared state, no
 *     ordering. Adding members adds throughput at zero coordination cost (#1 scale-free).
 *   - SELF-VERIFYING. The output is a fact ("this suite passed with this mutation applied"), not
 *     an opinion. It survives the question every agent-produced claim must survive: could this
 *     agent have been wrong? Here, no — the exit code is the finding.
 *
 * It is a DRIFT REPORT, NOT A GATE. Trunk-based development at thousands of pushes a day does not
 * want another blocker; it wants detection latency near zero. A surviving mutant is reported and
 * healed, never prevented — retraction over prevention, applied to test quality.
 *
 * TWO SEPARATE LEVERS, do not confuse them: bounding BLAST RADIUS limits how much one bad push
 * can touch (see run-tier0.ts `--max-files`). This bounds DETECTION LATENCY — how long something
 * broken can sit on main looking green. The vacuous sweep test had a tiny blast radius and
 * unbounded detection latency, and scored perfectly on every check we had.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Exit codes:
 *   0 — ran; no surviving mutants (or nothing eligible to mutate)
 *   1 — usage / fatal error
 *   3 — SURVIVING MUTANT: a test suite passed with the code deliberately broken. A finding.
 *
 * Usage:
 *   bun mutation-runner.ts --agent otto --tick 42 [--since 6h] [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

/** A single mechanical edit. `find` must be a literal so application is exact and reversible. */
export interface Mutation {
  readonly name: string;
  readonly find: string;
  readonly replace: string;
}

/**
 * The mutation catalogue. Deliberately small and mechanical — each one changes behaviour in a way
 * ANY honest test of that line must notice. Nothing here requires understanding the code.
 */
export const MUTATIONS: readonly Mutation[] = [
  { name: "gte-to-gt", find: " >= ", replace: " > " },
  { name: "lte-to-lt", find: " <= ", replace: " < " },
  { name: "eq-to-neq", find: " === ", replace: " !== " },
  { name: "and-to-or", find: " && ", replace: " || " },
  { name: "plus-to-minus", find: " + ", replace: " - " },
  { name: "true-to-false", find: "return true;", replace: "return false;" },
  { name: "false-to-true", find: "return false;", replace: "return true;" },
  { name: "zero-to-one", find: "=== 0", replace: "=== 1" },
];

/**
 * DETERMINISTIC selection — no RNG, no clock.
 *
 * Ambient randomness would make a finding unreproducible and break DST (#7) and noninterference
 * (#13): entropy must enter only through declared channels, and here the declared channel is the
 * (agent, tick) pair the caller passes in. Same inputs ⇒ same mutant, on every machine, forever.
 * It is also what removes the need for coordination: two agents with different ids pick different
 * work without ever exchanging a message.
 */
export function selectTarget<T>(items: readonly T[], agent: string, tick: number): T | null {
  if (items.length === 0) return null;
  let h = 2166136261 >>> 0; // FNV-1a over the agent name, then folded with the tick
  for (let i = 0; i < agent.length; i++) {
    h ^= agent.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h = (h ^ (tick >>> 0)) >>> 0;
  h = Math.imul(h, 16777619) >>> 0;
  return items[h % items.length]!;
}

/** The first mutation in the catalogue that actually appears in `source`, chosen deterministically. */
export function pickMutation(source: string, agent: string, tick: number): Mutation | null {
  const applicable = MUTATIONS.filter((m) => isApplicable(source, m));
  return selectTarget(applicable, agent, tick);
}

/**
 * Is this line a comment (and therefore behaviourally inert)?
 *
 * Mutating a comment ALWAYS "survives" — nothing changed, so no test can notice. That is a false
 * positive, and false positives are how a drift report becomes noise nobody reads. Found by
 * validating this runner against real code: the first ` >= ` in ephemeral-task-hierarchy.ts is on
 * line 8, inside the docstring, and the runner duly reported a surviving mutant on a file whose
 * invariants are in fact well covered.
 */
export function isCommentLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

/**
 * Apply a mutation to the first occurrence ON A NON-COMMENT LINE — one behavioural change per
 * run, never a sweep. Returns the source unchanged if every occurrence is inert.
 */
export function applyMutation(source: string, m: Mutation): string {
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (isCommentLine(line) || !line.includes(m.find)) continue;
    // Also skip an occurrence that sits after a trailing `//` on an otherwise-live line.
    const idx = line.indexOf(m.find);
    const comment = line.indexOf("//");
    if (comment >= 0 && comment < idx) continue;
    lines[i] = line.replace(m.find, m.replace);
    return lines.join("\n");
  }
  return source;
}

/** Does this mutation have any BEHAVIOURAL site in the source? (comments do not count.) */
export function isApplicable(source: string, m: Mutation): boolean {
  return applyMutation(source, m) !== source;
}

/** A source file paired with the test file that is supposed to cover it. */
export interface Target {
  readonly source: string;
  readonly test: string;
}

/** Pair `foo.ts` with `foo.test.ts`, keeping only pairs where both exist. */
export function pairWithTests(files: readonly string[], root: string): readonly Target[] {
  const out: Target[] = [];
  for (const f of files) {
    if (!f.endsWith(".ts") || f.endsWith(".test.ts") || f.endsWith(".d.ts")) continue;
    const test = f.replace(/\.ts$/, ".test.ts");
    if (existsSync(join(root, f)) && existsSync(join(root, test))) out.push({ source: f, test });
  }
  return out;
}

export interface Finding {
  readonly source: string;
  readonly test: string;
  readonly mutation: string;
  readonly survived: boolean;
}

/**
 * Mutate, run the suite, ALWAYS restore.
 *
 * The restore is in a `finally` and is not optional: this writes to the working tree of a live
 * repository. A crash between mutate and restore would leave deliberately-broken code on disk,
 * and in a trunk-based repo that is one careless `git add -A` away from being pushed. The healer
 * shipped an unused import the same day; assume the same class of accident here.
 */
export function runMutant(root: string, target: Target, m: Mutation): Finding {
  const srcPath = join(root, target.source);
  const original = readFileSync(srcPath, "utf8");
  try {
    writeFileSync(srcPath, applyMutation(original, m));
    const r = spawnSync("bun", ["test", target.test], {
      cwd: root,
      encoding: "utf8",
      timeout: 120_000,
    });
    // Survived = the suite still passed with the code deliberately broken. That is the finding.
    return { source: target.source, test: target.test, mutation: m.name, survived: r.status === 0 };
  } finally {
    writeFileSync(srcPath, original);
  }
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const root = argValue("--repo-root") ?? process.cwd();
  const agent = argValue("--agent") ?? "unknown";
  const tick = Number(argValue("--tick") ?? "0");
  const since = argValue("--since") ?? "24h";
  const dryRun = process.argv.includes("--dry-run");

  if (!Number.isFinite(tick)) {
    console.error("[mutation] FATAL: --tick must be a number (it seeds deterministic selection).");
    process.exit(1);
  }

  // Recently-changed files only: mutation-test what just landed, where detection latency matters
  // most. Scanning the whole repo every tick would be slower and would re-report old findings.
  const changed = spawnSync("git", ["log", `--since=${since}`, "--name-only", "--pretty=format:"], {
    cwd: root,
    encoding: "utf8",
  });
  const files = [...new Set((changed.stdout ?? "").split("\n").map((s) => s.trim()).filter(Boolean))];
  const targets = pairWithTests(files, root);

  if (targets.length === 0) {
    console.log(`[mutation] ${agent}: no source+test pairs changed in the last ${since} — nothing to do.`);
    return;
  }

  const target = selectTarget(targets, agent, tick)!;
  const source = readFileSync(join(root, target.source), "utf8");
  const mutation = pickMutation(source, agent, tick);

  if (!mutation) {
    console.log(`[mutation] ${agent}: no applicable mutation for ${target.source} — nothing to do.`);
    return;
  }

  console.log(`[mutation] ${agent} tick=${tick}: ${mutation.name} -> ${target.source} (suite: ${target.test})`);

  if (dryRun) {
    console.log(`[mutation] DRY RUN — no file written, no suite run.`);
    return;
  }

  const finding = runMutant(root, target, mutation);

  if (finding.survived) {
    console.error(
      `\n[mutation] ✗ SURVIVING MUTANT — the suite PASSED with the code deliberately broken.\n` +
        `  file:     ${finding.source}\n` +
        `  suite:    ${finding.test}\n` +
        `  mutation: ${finding.mutation}\n\n` +
        `  This is a FACT, not a judgement: ${finding.test} cannot distinguish the real\n` +
        `  implementation from a broken one on this line. The test does not cover what it\n` +
        `  appears to cover. Fix the test, then re-run and confirm it goes red.\n`,
    );
    process.exit(3);
  }

  console.log(`[mutation] ✓ killed — ${target.test} caught ${mutation.name}. The test does its job.`);
}

if (import.meta.main) main();
