#!/usr/bin/env bun
// affected-legs.ts — publish the affected-set query's verdict as CI job selectors.
//
// THE ONE DESIGN RULE THIS FILE EXISTS TO ENFORCE, stated before anything else:
//
//   The change -> job mapping is DERIVED FROM THE GRAPH AT RUN TIME. It is never
//   hand-maintained.
//
// A `gate.yml` carrying twenty hand-written `if:` guards against leg names would be
// a SECOND COPY of `build-graph.json` in a format nobody can diff against the
// first. It would drift, and drift here is silent: the failure is a job that should
// have run and did not, which looks exactly like a job that ran and passed. That is
// how a wired graph becomes an unwired one again in six months, and it is the
// failure this repo already performed once -- `build-graph.ts` was built, anchored,
// tested, and left with zero workflow references.
//
// So: one step runs this, it emits one boolean per leg, and the guards read the
// booleans. Adding a leg is a graph edit; no workflow edit follows.
//
// SOUNDNESS, and why this can only ever ADD jobs relative to a full run:
//
//   * `mode: full`  -> every leg is true. Any diff that reaches an unmodelled path
//     lands here, so "we do not know" resolves to "run everything".
//   * An UNCOVERED target (see `hygiene/audit-build-graph-completeness.ts`) forces
//     full mode via `--force-full`, because a target with no leg cannot tell us
//     which jobs its change needs.
//   * A failure of ANY kind in this step emits full mode and exits 0. A selector
//     that fails closed would block the gate; a selector that fails OPEN to
//     "run everything" costs minutes and cannot hide a regression. Fail-safe here
//     means MORE work, never less.
//
// OBSERVE-ONLY UNTIL PROVEN. Nothing consumes these outputs yet, deliberately. The
// mapping is published and compared against what the gate actually ran, so the
// derivation is checked against reality BEFORE any `if:` depends on it. Flipping
// the guards on an unproven selector would be the same class of mistake as trusting
// an incomplete graph.
//
// Usage:
//   bun src/Core.TypeScript/ci/affected-legs.ts --base <sha> --head <sha>
//   bun src/Core.TypeScript/ci/affected-legs.ts --changed <file>   # one path per line
//   ... --github-output          # append `leg_<slug>=true|false` + `mode=` to $GITHUB_OUTPUT

import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

export type Verdict = { readonly mode: string; readonly legs: readonly string[] };

/** `gate/lint-no-conflict-markers` -> `gate_lint_no_conflict_markers`. */
export function legSlug(leg: string): string {
  return leg.replace(/[^A-Za-z0-9]+/gu, "_").toLowerCase();
}

/**
 * One `name=value` line per leg, plus `mode`.
 *
 * `allLegs` is the full roster from the graph, not just the affected ones: a leg
 * that is absent from the output is indistinguishable from one set to false by an
 * `if:` expression, and "absent" is how a typo becomes a silent skip. Every leg is
 * always emitted, explicitly true or explicitly false.
 */
export function renderOutputs(verdict: Verdict, allLegs: readonly string[]): readonly string[] {
  const on = new Set(verdict.legs);
  const lines = [`mode=${verdict.mode}`];
  for (const leg of [...allLegs].sort()) {
    lines.push(`leg_${legSlug(leg)}=${on.has(leg) || verdict.mode === "full" ? "true" : "false"}`);
  }
  return lines;
}

/**
 * The whole verdict as ONE `$GITHUB_OUTPUT` line: `legs={"gate_lint_fsharp":true,...}`.
 *
 * WHY ONE JSON OUTPUT AND NOT 33 DECLARED ONES. A GitHub Actions job's `outputs:`
 * block must be written out statically, so one output per leg means a hand-written
 * roster in `gate.yml` that drifts from the graph the moment a target is added —
 * the second copy this file's header refuses. One JSON value has no roster: the
 * KEYS come from the graph at run time, and `gate.yml` only ever names the single
 * key `legs`.
 *
 * AND IT IS FAIL-CLOSED WITHOUT A GUARD, which the per-leg form is not. A consumer
 * writes `fromJSON(needs.path-filter.outputs.legs).gate_lint_fsharp != false`.
 * A leg this file never emitted — a new job, a typo, a graph that lost a target —
 * reads as `null`, and `null != false` is TRUE, so the job RUNS. The failure mode
 * of not knowing is doing the work, never skipping it. Pair that with the `|| '{}'`
 * default on the output itself and a path-filter that did not run turns every
 * consumer on.
 */
export function renderLegsJson(verdict: Verdict, allLegs: readonly string[]): string {
  const on = new Set(verdict.legs);
  const obj: Record<string, boolean> = {};
  // Sorted: the line is compared across runs and lands in logs, so key order is
  // part of the artifact (DST -- same input, same bytes).
  for (const leg of [...allLegs].sort()) {
    obj[legSlug(leg)] = on.has(leg) || verdict.mode === "full";
  }
  return `legs=${JSON.stringify(obj)}`;
}

/** Every leg any target claims — the roster `renderOutputs` must cover. */
export function allLegsOf(graphText: string): readonly string[] {
  const g = JSON.parse(graphText) as { targets: { legs?: string[] }[] };
  const set = new Set<string>();
  for (const t of g.targets) for (const l of t.legs ?? []) set.add(l);
  return [...set].sort();
}

const GRAPH = "src/Core.TypeScript/ace/build-graph.json";

/** The value after `flag`, or undefined. Explicit so a missing operand is a clear error. */
function operand(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

function changedPaths(argv: readonly string[]): string {
  const changed = operand(argv, "--changed");
  if (changed !== undefined) return readFileSync(changed, "utf-8");
  const base = operand(argv, "--base");
  const head = operand(argv, "--head");
  if (base === undefined || head === undefined) {
    throw new Error("need --changed <file> or --base <sha> --head <sha>");
  }
  const r = spawnSync("git", ["diff", "--name-only", base, head], {
    encoding: "utf-8",
    maxBuffer: 1 << 28,
  });
  if (r.status !== 0) throw new Error(`git diff failed: ${r.stderr}`);
  return r.stdout;
}

function query(diff: string): Verdict {
  const r = spawnSync("bun", ["src/Core.TypeScript/ace/build-graph.ts", "affected", "--json"], {
    input: diff,
    encoding: "utf-8",
    maxBuffer: 1 << 28,
  });
  if (r.status !== 0) throw new Error(`affected query failed: ${r.stderr}`);
  const parsed = JSON.parse(r.stdout) as { mode: string; legs?: string[] };
  return { mode: parsed.mode, legs: parsed.legs ?? [] };
}

function main(argv: readonly string[]): number {
  const allLegs = allLegsOf(readFileSync(GRAPH, "utf-8"));
  let verdict: Verdict;
  try {
    verdict = query(changedPaths(argv));
  } catch (err) {
    // FAIL SAFE = run everything. See the header: this selector may only ever add
    // work relative to a full run, so its own failure must not be able to skip one.
    console.error(`affected-legs: ${String(err)} — emitting mode=full (fail-safe: run everything)`);
    verdict = { mode: "full", legs: allLegs };
  }
  const lines = renderOutputs(verdict, allLegs);
  for (const l of lines) console.log(l);
  const out = process.env.GITHUB_OUTPUT;
  if (argv.includes("--github-output") && out !== undefined && out !== "") {
    // Both shapes: the per-leg lines stay (they are the readable form, and an
    // undeclared output is simply ignored by Actions), and `legs=` is the one a
    // job selector actually consumes. See `renderLegsJson` for why.
    appendFileSync(out, `${[...lines, renderLegsJson(verdict, allLegs)].join("\n")}\n`);
  }
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
