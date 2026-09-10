#!/usr/bin/env bun
// src/Core.TypeScript/ci/local-checks.ts
//
// RUN THE CHECKS THIS DIFF WOULD FACE — LOCALLY, BEFORE PUSHING.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THIS EXISTS
// ═══════════════════════════════════════════════════════════════════════════
//
// Asked three times in one day, about three different checks: "is it possible
// to run these locally?" (CodeQL), "how do we make these locally checkable?"
// (the TS hermetic suite), "how can we poll these checks local?" (actionlint).
// Each time the answer existed and each time it had to be excavated out of
// `gate.yml` by hand.
//
// The cost of not having this is measured, not assumed. Today:
//   - a hermetic-suite failure took 24 MINUTES to surface in CI and 3.8
//     SECONDS to reproduce locally once the right file was known;
//   - an actionlint failure took 35s in CI and reproduced instantly;
//   - and in both cases finding WHICH command CI runs took longer than
//     running it.
//
// `scoped-lint.ts` already SCOPES a linter's output to the diff. It does not
// say which linters to run or how to invoke them. This does that, and nothing
// else — it is a router, not a new checker.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE OUTCOME VOCABULARY IS THE POINT
// ═══════════════════════════════════════════════════════════════════════════
//
// A local runner that prints "all green" when three of its checks could not
// start is worse than no runner: it manufactures confidence. So every check
// reports one of FOUR outcomes, and only one of them is a pass:
//
//   passed          it ran and found nothing
//   failed          it ran and found something
//   not-applicable  the diff contains nothing this check reads
//   could-not-run   the tool is absent, or the command errored out
//   not-attempted   deliberately skipped as too slow for a poll (see --slow)
//
// The fifth was added after the first run of this tool HUNG: the hermetic suite
// takes ~22 minutes, and a "poll your checks" command that blocks for twenty
// minutes is not one anybody polls. "Not attempted by choice" is genuinely none
// of the other four — it is not a pass, not a failure, not irrelevant to the
// diff, and nothing was broken. Collapsing it into any of them would either
// inflate the pass count or raise a false alarm.
//
// `could-not-run` is NOT a pass and is never counted as one. That is the
// distinction `exit 2` carries and an exit-code-only reading destroys, and it
// is the same one the domain filter draws in CI between a job that skipped
// because it was irrelevant and a job that was killed.
//
// The exit code follows: 0 only when nothing failed AND nothing was unknown;
// 1 on a real finding; 2 when something could not run. A green from this tool
// means "these named checks ran and passed", never "everything is fine".
//
// ═══════════════════════════════════════════════════════════════════════════
// THE ROSTER IS CHECKED AGAINST gate.yml, NOT TRUSTED
// ═══════════════════════════════════════════════════════════════════════════
//
// A hand-written map of "CI job -> local command" drifts the moment somebody
// adds a job, and drifts SILENTLY, which would make this tool claim coverage
// it does not have. So `auditRoster` reads the job names out of `gate.yml` and
// requires every one to be classified: either a local command, or an explicit
// `noLocalEquivalent` with a stated reason. A new gate job with no entry fails
// the audit. The roster may be incomplete; it may not be incomplete in
// silence.
//
// Usage:
//   bun src/Core.TypeScript/ci/local-checks.ts            # checks for the current diff
//   bun src/Core.TypeScript/ci/local-checks.ts --all      # ignore the diff, run everything
//   bun src/Core.TypeScript/ci/local-checks.ts --list     # what would run, and why
//   bun src/Core.TypeScript/ci/local-checks.ts --audit    # roster vs gate.yml

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { ALL_DOMAINS, classify, type Domain } from "./path-domains.ts";

export type Outcome = "passed" | "failed" | "not-applicable" | "could-not-run" | "not-attempted";

export interface CheckSpec {
  /** The `name:` of the job in gate.yml, so a reader can match a red X to a command. */
  readonly gateJob: string;
  /** Domains that make this check relevant. Empty = always relevant. */
  readonly domains: readonly Domain[];
  /** argv, run from the repo root. */
  readonly argv: readonly string[];
  /** The executable that must exist for this to be runnable at all. */
  readonly requires: string;
  /** Minutes-scale. Excluded from a default poll; run with `--slow`. */
  readonly slow?: boolean;
}

export interface NoLocal {
  readonly gateJob: string;
  readonly reason: string;
}

/**
 * Checks with a faithful local form.
 *
 * FAITHFUL means the local invocation is the SAME command and, where a version
 * matters, the same version. `actionlint` is the worked example: gate.yml pins
 * `v1.7.12` and the local binary reports 1.7.12, so a local green there really
 * does predict the CI job. Where that is not true it is said in the entry
 * rather than assumed, because a local check running a different version is a
 * different check wearing the same name.
 */
export const ROSTER: readonly CheckSpec[] = [
  {
    gateJob: "lint (actionlint)",
    domains: ["workflows"],
    // Byte-identical to gate.yml's step, minus `-color`.
    argv: ["actionlint", "-ignore", 'unknown permission scope "administration"'],
    requires: "actionlint",
  },
  {
    gateJob: "lint (TS)",
    domains: ["typescript"],
    argv: ["bun", "run", "typecheck"],
    requires: "bun",
  },
  {
    gateJob: "test (TS hermetic)",
    domains: ["typescript"],
    // The exact command the hermetic job runs. Slow by nature (~22 min in CI);
    // `--list` names it so a reader can run one FILE instead, which is what
    // actually diagnoses a failure.
    argv: ["bun", "--config=bunfig.hermetic.toml", "test"],
    requires: "bun",
    // ~22 min in CI, ~equally long locally. Diagnosing a failure in it never
    // needs the whole thing: `bun test <the one file>` reproduced today's
    // failure in 3.8 seconds. Named here so a reader knows the command; run
    // with --slow when you actually want all 26,575 of them.
    slow: true,
  },
];

/**
 * Jobs with no faithful local form, and WHY.
 *
 * An honest empty is worth more than a fake command: a local runner that
 * pretends to cover a matrix leg is exactly the manufactured confidence this
 * file's outcome vocabulary exists to prevent.
 */
export const NO_LOCAL: readonly NoLocal[] = [
  { gateJob: "gate (required)", reason: "an aggregation of other jobs' results; there is nothing to run" },
  { gateJob: "path filter", reason: "computes a diff against a PR base that does not exist locally" },
];

/**
 * Derive runnable checks from gate.yml itself.
 *
 * WHY DERIVED RATHER THAN LISTED. A hand-written map of 33 jobs to their
 * commands drifts the moment anyone edits the workflow, and drifts silently —
 * which would make this tool claim coverage it does not have, the exact defect
 * its outcome vocabulary exists to prevent. Measured while writing it: 23 gate
 * jobs invoke a plain `bun <script>.ts`, several of them more than one, and two
 * are aggregates of a dozen audits. Transcribing that by hand was never going
 * to stay true.
 *
 * WHAT IS DELIBERATELY NOT DERIVED. A command carrying an environment variable,
 * a shell redirect, or a line continuation cannot be run blind from here — its
 * meaning depends on state this tool does not have. Those are reported as
 * `could-not-run` with the reason, NEVER skipped silently and never counted as
 * passing. An honest "I could not run this" is the whole point.
 */
export function deriveFromGate(gateYaml: string): { specs: CheckSpec[]; unrunnable: NoLocal[] } {
  const specs: CheckSpec[] = [];
  const unrunnable: NoLocal[] = [];
  const seen = new Set<string>();
  let job = "";
  for (const raw of gateYaml.split("\n")) {
    const n = /^\s{4}name:\s*(.+?)\s*$/u.exec(raw);
    if (n?.[1] !== undefined) { job = n[1].replace(/^["']|["']$/gu, ""); continue; }
    if (job.length === 0 || raw.trim().startsWith("#")) continue;
    const c = /(bun\s+(?:src\/|tools\/|tests\/)\S+\.ts[^\n|&]*)/u.exec(raw);
    if (c?.[1] === undefined) continue;
    const cmd = c[1].trim();
    const key = `${job}::${cmd}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // A matrix job's own name is an unexpanded expression; there is no single
    // local form of "run this for every OS".
    if (job.includes("${{")) { unrunnable.push({ gateJob: job, reason: "a matrix leg — no single local form" }); continue; }
    if (/[$<>\\]/u.test(cmd)) {
      unrunnable.push({ gateJob: job, reason: `needs environment or shell state: \`${cmd.slice(0, 60)}\`` });
      continue;
    }
    specs.push({ gateJob: job, domains: domainsForJob(job), argv: cmd.split(/\s+/u), requires: "bun" });
  }
  return { specs, unrunnable };
}

/** Job name -> the domain that makes it relevant. Unknown = always relevant (fail-safe: runs more). */
function domainsForJob(job: string): readonly Domain[] {
  const l = job.toLowerCase();
  if (l.includes("(c#)")) return ["csharp"];
  if (l.includes("(f#)")) return ["fsharp"];
  if (l.includes("(go)")) return ["go"];
  if (l.includes("(python)")) return ["python"];
  if (l.includes("(rust)")) return ["rust"];
  if (l.includes("(ts)") || l.includes("typescript")) return ["typescript"];
  if (l.includes("markdown")) return ["markdown"];
  if (l.includes("actionlint")) return ["workflows"];
  if (l.includes("yaml")) return ["yaml"];
  if (l.includes("shellcheck")) return ["shell"];
  return [];
}

const isKnown = (job: string): boolean =>
  ROSTER.some((c) => c.gateJob === job) || NO_LOCAL.some((n) => n.gateJob === job);

/** Every `name:` in gate.yml, which is what a red X in the UI shows. */
export function gateJobNames(gateYaml: string): readonly string[] {
  const out: string[] = [];
  for (const line of gateYaml.split("\n")) {
    const m = /^\s{4}name:\s*(.+?)\s*$/u.exec(line);
    if (m?.[1] !== undefined) out.push(m[1].replace(/^["']|["']$/gu, ""));
  }
  return out;
}

/** Gate jobs this roster says nothing about. Non-empty means the roster is silently incomplete. */
export function auditRoster(gateYaml: string): readonly string[] {
  return gateJobNames(gateYaml).filter((j) => !isKnown(j));
}

export interface CheckResult {
  readonly gateJob: string;
  /** job + script basename: several gate jobs run more than one script. */
  readonly label: string;
  readonly outcome: Outcome;
  readonly detail: string;
}

/** `lint (yaml/k8s) [audit-observability-chain]` — the job, plus which of its scripts this is. */
function labelOf(spec: CheckSpec): string {
  const script = spec.argv.find((a) => a.endsWith(".ts"));
  if (script === undefined) return spec.gateJob;
  const base = script.slice(script.lastIndexOf("/") + 1).replace(/\.ts$/u, "");
  return `${spec.gateJob} [${base}]`;
}

function toolExists(bin: string): boolean {
  const r = spawnSync("command", ["-v", bin], { shell: true, encoding: "utf-8" });
  return r.status === 0 && String(r.stdout ?? "").trim().length > 0;
}

export function relevant(spec: CheckSpec, touched: Readonly<Record<Domain, boolean>>): boolean {
  if (spec.domains.length === 0) return true;
  return spec.domains.some((d) => touched[d]);
}

export function runCheck(
  spec: CheckSpec,
  touched: Readonly<Record<Domain, boolean>>,
  all: boolean,
  slow = false,
): CheckResult {
  if (spec.slow === true && !slow) {
    return { gateJob: spec.gateJob, label: labelOf(spec), outcome: "not-attempted", detail: "slow — run with --slow" };
  }
  if (!all && !relevant(spec, touched)) {
    return { gateJob: spec.gateJob, label: labelOf(spec), outcome: "not-applicable", detail: `diff touches no ${spec.domains.join("/")}` };
  }
  if (!toolExists(spec.requires)) {
    // NOT a pass. The check produced no information about the tree.
    return { gateJob: spec.gateJob, label: labelOf(spec), outcome: "could-not-run", detail: `\`${spec.requires}\` is not on PATH` };
  }
  const [bin, ...args] = spec.argv;
  if (bin === undefined) return { gateJob: spec.gateJob, label: labelOf(spec), outcome: "could-not-run", detail: "empty argv" };
  const r = spawnSync(bin, args, { encoding: "utf-8" });
  if (r.error !== undefined) {
    return { gateJob: spec.gateJob, label: labelOf(spec), outcome: "could-not-run", detail: r.error.message };
  }
  // An exit code above 1 is conventionally a usage/setup error rather than a
  // finding -- a check that never ran, not one that failed.
  if (r.status !== null && r.status > 1) {
    return { gateJob: spec.gateJob, label: labelOf(spec), outcome: "could-not-run", detail: `exit ${String(r.status)}` };
  }
  const output = `${String(r.stdout ?? "")}${String(r.stderr ?? "")}`.trim();
  if (r.status === 0) return { gateJob: spec.gateJob, label: labelOf(spec), outcome: "passed", detail: "" };

  // EXIT 1 IS NOT ALWAYS A FINDING, and this tool got it wrong on its own first
  // run. A hand-written roster entry named a script that does not exist; bun
  // exits 1 for a missing module exactly as it does for a real finding, so the
  // status code alone cannot tell "the subject is broken" from "the check never
  // ran". Reported as a failure, that is a false alarm; reported as passed it
  // would be worse. It is `could-not-run` — locus ENVIRONMENT, not subject —
  // and separating the two needs the output, not the code.
  if (/Module not found|Cannot find module|command not found|No such file or directory/u.test(output)) {
    return { gateJob: spec.gateJob, label: labelOf(spec), outcome: "could-not-run", detail: output.split("\n")[0] ?? "missing module or binary" };
  }
  return { gateJob: spec.gateJob, label: labelOf(spec), outcome: "failed", detail: output.split("\n").slice(0, 12).join("\n") };
}

function changedFiles(): readonly string[] {
  const base = spawnSync("git", ["merge-base", "HEAD", "origin/main"], { encoding: "utf-8" });
  const ref = base.status === 0 ? String(base.stdout ?? "").trim() : "origin/main";
  const d = spawnSync("git", ["diff", "--name-only", ref, "HEAD"], { encoding: "utf-8" });
  const staged = spawnSync("git", ["diff", "--name-only"], { encoding: "utf-8" });
  return `${String(d.stdout ?? "")}\n${String(staged.stdout ?? "")}`.split("\n").filter((l) => l.trim().length > 0);
}

const SYMBOL: Readonly<Record<Outcome, string>> = {
  passed: "  ok  ",
  failed: " FAIL ",
  "not-applicable": "  n/a ",
  "could-not-run": " ???? ",
  "not-attempted": " skip ",
};

export async function main(argv: readonly string[]): Promise<number> {
  const all = argv.includes("--all");

  if (argv.includes("--audit")) {
    let yaml: string;
    try { yaml = readFileSync(".github/workflows/gate.yml", "utf-8"); }
    catch (e) { process.stderr.write(`could not run: ${String(e)}\n`); return 2; }
    const missing = auditRoster(yaml);
    if (missing.length === 0) {
      process.stdout.write("local-checks: every gate job is classified (a command, or a stated reason there is none).\n");
      return 0;
    }
    process.stdout.write(`local-checks: ${String(missing.length)} gate job(s) this roster says nothing about:\n`);
    for (const m of missing) process.stdout.write(`  ${m}\n`);
    process.stdout.write("\nAdd each to ROSTER (with its local argv) or to NO_LOCAL (with the reason there is none).\n");
    return 1;
  }

  const files = all ? [] : changedFiles();
  const touched = all
    ? (Object.fromEntries(ALL_DOMAINS.map((d) => [d, true])) as Record<Domain, boolean>)
    : classify(files).touched;

  if (argv.includes("--list")) {
    process.stdout.write(`${all ? "all checks" : `${String(files.length)} changed file(s)`}\n\n`);
    for (const spec of ROSTER) {
      const why = relevant(spec, touched) || all ? "would run" : `n/a (no ${spec.domains.join("/")})`;
      process.stdout.write(`  ${spec.gateJob.padEnd(26)} ${why.padEnd(22)} ${spec.argv.join(" ")}\n`);
    }
    for (const n of NO_LOCAL) process.stdout.write(`  ${n.gateJob.padEnd(26)} no local form         — ${n.reason}\n`);
    return 0;
  }

  let derived: CheckSpec[] = [];
  let unrunnable: NoLocal[] = [];
  try {
    const y = readFileSync(".github/workflows/gate.yml", "utf-8");
    const d = deriveFromGate(y);
    derived = d.specs;
    unrunnable = d.unrunnable;
  } catch {
    // Not fatal, and not silent: the hand-written roster still runs, and the
    // count below will show fewer checks than the audit says exist.
    process.stderr.write("note: could not read gate.yml — only the hand-written roster will run\n");
  }
  const specs = [...ROSTER, ...derived.filter((d) => !ROSTER.some((r) => r.argv.join(" ") === d.argv.join(" ")))];
  const runSlow = argv.includes("--slow");
  const results = specs.map((s) => runCheck(s, touched, all, runSlow));
  for (const u of unrunnable) {
    results.push({ gateJob: u.gateJob, label: u.gateJob, outcome: "could-not-run", detail: u.reason });
  }
  for (const r of results) {
    process.stdout.write(`[${SYMBOL[r.outcome]}] ${r.label}${r.detail.length > 0 ? ` — ${r.detail.split("\n")[0] ?? ""}` : ""}\n`);
    if (r.outcome === "failed" && r.detail.includes("\n")) {
      for (const l of r.detail.split("\n").slice(1)) process.stdout.write(`          ${l}\n`);
    }
  }
  const failed = results.filter((r) => r.outcome === "failed").length;
  const unknown = results.filter((r) => r.outcome === "could-not-run").length;
  const na = results.filter((r) => r.outcome === "not-applicable").length;
  const skipped = results.filter((r) => r.outcome === "not-attempted").length;
  process.stdout.write(
    `\n${String(results.length - failed - unknown - na - skipped)} passed · ${String(failed)} failed · ` +
    `${String(na)} not applicable · ${String(skipped)} not attempted (slow) · ` +
    `${String(unknown)} COULD NOT RUN (unknown, not a pass)\n`,
  );
  if (failed > 0) return 1;
  return unknown > 0 ? 2 : 0;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }).catch((e: unknown) => {
    process.stderr.write(`could not run: ${String(e)}\n`);
    process.exitCode = 2;
  });
}
