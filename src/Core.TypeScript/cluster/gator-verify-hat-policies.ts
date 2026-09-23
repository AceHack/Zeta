#!/usr/bin/env bun
/**
 * gator-verify-hat-policies.ts -- EXECUTE the hat-system Gatekeeper policies.
 *
 * -- THE GAP THIS CLOSES ----------------------------------------------------
 * Seven ConstraintTemplates live under `full-ai-cluster/k8s/applications/hat-system/policies/`
 * and, until this file, nothing in CI had ever run their Rego against an input.
 * What existed checked everything AROUND the Rego: that it compiles and applies on
 * a kind cluster (`k8s-argocd-health-test.yml`), that the sync Config feeds what
 * it reads (`hat-constraint-roster.ts`), and -- for 03-conflict-of-interest -- a
 * MODEL of the rule rebuilt from the policy's text (`hat-conflict-symmetry.test.ts`).
 * A model cannot catch a wrong field path or an undefined-propagating comparison,
 * and the first execution found four of those (see "WHAT THE FIRST RUN FOUND").
 *
 * `gator` is Gatekeeper's own offline policy tester, pinned in `.mise.full.toml`
 * to the SAME release as the gatekeeper chart, so the engine under test is the
 * engine that enforces. This file checks that pin agreement and refuses to run a
 * different gator.
 *
 * -- WHAT IT DOES ------------------------------------------------------------
 *   1. Splits every two-document policy file into `<stem>.template.yaml` and
 *      `<stem>.constraint.yaml`. gator reads only the FIRST document of the path
 *      a suite names, so the committed file cannot be pointed at directly.
 *   2. Copies the committed seed hats, so conflict and quorum cases run against
 *      the real catalogue instead of a restatement of it.
 *   3. Copies the suites and fixtures, rendering `{{now-60s}}`-style placeholders
 *      to RFC 3339. Three policies compare against `time.now_ns()` and gator has no
 *      clock injection, so a fixed timestamp would age out of its window and turn
 *      a deny case into an admit case with nobody touching the file.
 *   4. REFUSES before running gator if coverage is incomplete: every
 *      ConstraintTemplate must be the subject of a suite test that has at least one
 *      MUST-VIOLATE case and at least one MUST-ADMIT case. A policy with only
 *      admit cases is satisfied by a policy that denies nothing, and one with only
 *      deny cases by a policy that denies everything.
 *   5. Runs `gator verify -v` and exits with its status.
 *
 * -- WHAT THE FIRST RUN FOUND (2026-09-23) -----------------------------------
 *   - 02-max-bindings and 03-conflict-of-interest read `b.status.phase != "Revoked"`.
 *     A HatBinding has NO status until the operator first reconciles it, the
 *     comparison is then UNDEFINED rather than true, and the binding silently
 *     dropped out of both rules. With the operator down the per-wearer cap
 *     admitted without limit and conflict pairs could be taken freely.
 *   - 04-quorum computed `count(spec.cosignedBy)`, UNDEFINED when the optional
 *     field is omitted -- so omitting it, rather than sending too few, bound a
 *     quorum-gated hat with zero signatures.
 *   - 07-no-supervisor-cycles bound `existing` to a bare inventory lookup, which is
 *     UNDEFINED when no Hat is synced yet (cache not warmed after a gatekeeper
 *     restart, or the first Hat ever), so the rule failed open and admitted even
 *     `supervises: [self]`.
 * All four are one shape: Rego's undefined propagates silently, a comparison
 * against a missing field is neither true nor false, the rule body does not
 * match -- and for a `violation` rule that means ADMIT. The mutation suite
 * (`gator-verify-hat-policies.test.ts`) re-plants each one and requires red.
 *
 * Run:   bun src/Core.TypeScript/cluster/gator-verify-hat-policies.ts
 *          [--policies <dir>]   policy directory to test (default: the committed one;
 *                               the mutation suite points this at a broken copy)
 *          [--keep]             leave the materialised tree in place and print its path
 * Exit:  0 -- every case passed
 *        1 -- a case failed, coverage is incomplete, or the gator/chart pins disagree
 *        2 -- gator is not on PATH (nothing ran; never report this as a pass)
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { parse, parseAllDocuments, stringify } from "yaml";
import { stringCompare } from "../collation/collation.ts";
import { HAT_POLICY_DIR, TEMPLATE_GROUP, CONSTRAINT_GROUP, defaultRepoRoot } from "./hat-constraint-roster.ts";

/** The suites and fixtures, relative to the repo root. */
export const SUITE_DIR = "full-ai-cluster/k8s/tests/gator/hat-system";
/** The committed seed hats the suites use as inventory. */
export const SEED_HAT_DIR = "full-ai-cluster/k8s/applications/hat-system/hats";
/** The gatekeeper chart Application whose `targetRevision` gator must equal. */
export const GATEKEEPER_APP = "full-ai-cluster/k8s/applications/open-policy-agent/Application.yaml";
/** The mise config that pins gator. */
export const MISE_FULL = ".mise.full.toml";

/** Where the materialised split policies and seed hats land inside the run tree. */
const POLICIES_OUT = "_policies";
const HATS_OUT = "_hats";

interface Doc {
  readonly apiVersion?: string;
  readonly kind?: string;
  readonly metadata?: { readonly name?: string };
}

/** One policy file, split into the two documents gator needs as separate files. */
export interface SplitPolicy {
  readonly stem: string;
  readonly templateName: string;
  readonly template: string;
  readonly constraint: string;
}

/**
 * Split a committed policy file. Exactly one ConstraintTemplate and exactly one
 * Constraint, or it is refused -- a third document would be silently dropped by
 * the split, which is the same "gator reads only the first document" trap moved
 * one layer up.
 */
export function splitPolicy(stem: string, text: string): SplitPolicy {
  const templates: Doc[] = [];
  const constraints: Doc[] = [];
  let other = 0;
  for (const d of parseAllDocuments(text)) {
    const value = d.toJS() as Doc | null;
    if (value === null) continue;
    const api = value.apiVersion ?? "";
    if (api.startsWith(TEMPLATE_GROUP + "/") && value.kind === "ConstraintTemplate") templates.push(value);
    else if (api.startsWith(CONSTRAINT_GROUP + "/")) constraints.push(value);
    else other += 1;
  }
  if (templates.length !== 1 || constraints.length !== 1 || other !== 0) {
    throw new Error(
      `${stem}.yaml: expected exactly one ConstraintTemplate and one Constraint, found ` +
        `${String(templates.length)} template(s), ${String(constraints.length)} constraint(s), ${String(other)} other document(s)`,
    );
  }
  const [template] = templates;
  const [constraint] = constraints;
  if (template === undefined || constraint === undefined) throw new Error(`${stem}.yaml: unreachable`);
  return {
    stem,
    templateName: template.metadata?.name ?? "",
    template: stringify(template),
    constraint: stringify(constraint),
  };
}

const PLACEHOLDER = /\{\{now([+-])(\d+)s\}\}/g;

/** Render `{{now-60s}}` / `{{now+600s}}` to RFC 3339 relative to `nowMs`. */
export function renderTimePlaceholders(text: string, nowMs: number): string {
  return text.replace(PLACEHOLDER, (_m, sign: string, seconds: string) => {
    const delta = Number.parseInt(seconds, 10) * 1000 * (sign === "-" ? -1 : 1);
    // Whole seconds: RFC 3339 without fractional seconds is what the API server emits.
    return new Date(Math.floor((nowMs + delta) / 1000) * 1000).toISOString().replace(".000Z", "Z");
  });
}

interface SuiteCase {
  readonly name?: string;
  readonly assertions?: readonly { readonly violations?: unknown }[];
}
interface SuiteTest {
  readonly name?: string;
  readonly template?: string;
  readonly cases?: readonly SuiteCase[];
}
interface Suite {
  readonly kind?: string;
  readonly tests?: readonly SuiteTest[];
}

/** Does this case assert at least one violation (`yes` or a positive count)? */
function expectsViolation(c: SuiteCase): boolean {
  return (c.assertions ?? []).some((a) => a.violations === "yes" || a.violations === true || (typeof a.violations === "number" && a.violations > 0));
}
/** Does this case assert zero violations overall? */
function expectsAdmit(c: SuiteCase): boolean {
  return (c.assertions ?? []).some((a) => a.violations === "no" || a.violations === false || a.violations === 0);
}

/**
 * Every coverage defect, given the policy stems and the parsed suites. Empty
 * means every policy has at least one must-violate and one must-admit case.
 */
export function coverageFailures(stems: readonly string[], suites: readonly { file: string; suite: Suite }[]): string[] {
  const failures: string[] = [];
  if (stems.length === 0) failures.push(`no policy files under ${HAT_POLICY_DIR} -- an empty roster passes trivially, so it is a failure`);
  const tally = new Map<string, { deny: number; admit: number }>();
  for (const stem of stems) tally.set(stem, { deny: 0, admit: 0 });
  for (const { file, suite } of suites) {
    for (const t of suite.tests ?? []) {
      const m = /^_policies\/(.+)\.template\.yaml$/.exec(t.template ?? "");
      const stem = m?.[1];
      if (stem === undefined || !tally.has(stem)) {
        failures.push(`${file}: test ${t.name ?? "?"} names template ${t.template ?? "(none)"}, which is not a committed policy`);
        continue;
      }
      const row = tally.get(stem);
      if (row === undefined) continue;
      for (const c of t.cases ?? []) {
        if (expectsViolation(c)) row.deny += 1;
        if (expectsAdmit(c)) row.admit += 1;
      }
    }
  }
  for (const [stem, row] of [...tally].sort((a, b) => stringCompare(a[0], b[0]))) {
    if (row.deny === 0) failures.push(`${stem}: no MUST-VIOLATE case -- a policy that denies nothing would pass its suite`);
    if (row.admit === 0) failures.push(`${stem}: no MUST-ADMIT case -- a policy that denies everything would pass its suite`);
  }
  return failures;
}

/** The chart pin and the mise pin must agree, and the gator on PATH must be that version. */
export function pinFailures(appYaml: string, miseToml: string, gatorVersionLine: string): string[] {
  const failures: string[] = [];
  const app = parse(appYaml) as { spec?: { source?: { chart?: string; targetRevision?: string } } };
  const chart = app.spec?.source?.targetRevision ?? "";
  const mise = /^gator\s*=\s*"([^"]+)"/m.exec(miseToml)?.[1] ?? "";
  if (chart.length === 0) failures.push(`${GATEKEEPER_APP}: no spec.source.targetRevision`);
  if (mise.length === 0) failures.push(`${MISE_FULL}: no \`gator = "<version>"\` pin`);
  if (chart.length > 0 && mise.length > 0 && chart !== mise) {
    failures.push(`gator ${mise} (${MISE_FULL}) != gatekeeper chart ${chart} (${GATEKEEPER_APP}) -- the suite would test a different engine than the one that enforces`);
  }
  const running = /gator version v?(\S+?)[\s,]/.exec(gatorVersionLine + " ")?.[1] ?? "";
  if (mise.length > 0 && running !== mise) {
    failures.push(`gator on PATH reports ${running.length > 0 ? running : "(unparseable: " + gatorVersionLine.trim() + ")"}, pinned ${mise}`);
  }
  return failures;
}

/** Recursively list files under `dir`, relative to it, ordinal-sorted. */
function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p));
    }
  };
  walk(dir);
  return out.sort(stringCompare);
}

/**
 * Build the run tree under `outDir`. Returns the parsed suites and policy stems so
 * the caller can check coverage without re-reading.
 */
export function materialise(
  repoRoot: string,
  policiesDir: string,
  outDir: string,
  nowMs: number,
): { stems: string[]; suites: { file: string; suite: Suite }[] } {
  const suiteRoot = join(repoRoot, SUITE_DIR);
  for (const rel of listFiles(suiteRoot)) {
    const dest = join(outDir, rel);
    mkdirSync(join(dest, ".."), { recursive: true });
    writeFileSync(dest, renderTimePlaceholders(readFileSync(join(suiteRoot, rel), "utf8"), nowMs));
  }
  mkdirSync(join(outDir, POLICIES_OUT), { recursive: true });
  const stems: string[] = [];
  for (const file of readdirSync(policiesDir).sort(stringCompare)) {
    if (!file.endsWith(".yaml")) continue;
    const stem = file.slice(0, -".yaml".length);
    const split = splitPolicy(stem, readFileSync(join(policiesDir, file), "utf8"));
    writeFileSync(join(outDir, POLICIES_OUT, `${stem}.template.yaml`), split.template);
    writeFileSync(join(outDir, POLICIES_OUT, `${stem}.constraint.yaml`), split.constraint);
    stems.push(stem);
  }
  cpSync(join(repoRoot, SEED_HAT_DIR), join(outDir, HATS_OUT), { recursive: true });
  const suites: { file: string; suite: Suite }[] = [];
  for (const rel of listFiles(suiteRoot)) {
    if (!rel.endsWith(".suite.yaml")) continue;
    suites.push({ file: join(SUITE_DIR, rel), suite: parse(readFileSync(join(suiteRoot, rel), "utf8")) as Suite });
  }
  return { stems, suites };
}

function main(argv: readonly string[]): number {
  const repoRoot = defaultRepoRoot();
  const at = argv.indexOf("--policies");
  const policiesDir = at >= 0 && argv[at + 1] !== undefined ? argv[at + 1] ?? "" : join(repoRoot, HAT_POLICY_DIR);
  const keep = argv.includes("--keep");

  const version = spawnSync("gator", ["--version"], { encoding: "utf8" });
  if (version.error !== undefined || version.status !== 0) {
    console.error("::error::gator is not on PATH -- NOTHING RAN. Install it with `MISE_ENV=full mise install gator` (pinned in .mise.full.toml).");
    return 2;
  }
  const pins = pinFailures(
    readFileSync(join(repoRoot, GATEKEEPER_APP), "utf8"),
    readFileSync(join(repoRoot, MISE_FULL), "utf8"),
    version.stdout,
  );

  const outDir = mkdtempSync(join(tmpdir(), "gator-hat-policies-"));
  try {
    const { stems, suites } = materialise(repoRoot, policiesDir, outDir, Date.now());
    const failures = [...pins, ...coverageFailures(stems, suites)];
    for (const f of failures) console.error(`::error::${f}`);
    if (failures.length > 0) return 1;
    console.log(`gator ${version.stdout.trim()}`);
    console.log(`${String(stems.length)} policies, ${String(suites.length)} suites -> ${outDir}`);
    const run = spawnSync("gator", ["verify", "-v", outDir], { stdio: "inherit" });
    if (run.error !== undefined) {
      console.error(`::error::gator verify did not start: ${run.error.message}`);
      return 1;
    }
    return run.status ?? 1;
  } finally {
    if (keep) console.log(`kept: ${outDir}`);
    else rmSync(outDir, { recursive: true, force: true });
  }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
