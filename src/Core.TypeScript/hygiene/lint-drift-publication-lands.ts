#!/usr/bin/env bun
// lint-drift-publication-lands.ts — a lane that COMPUTES a drift artifact must be able to
// PUBLISH it, and must fail when it cannot.
//
// THE DEFECT THIS CLOSES, measured rather than imagined (081M0QPZD9C087G0R002W8QC2A):
// `drift-sweep.yml` recomputed the drift ledger every few minutes, committed it, pushed it
// at `main`, and was refused every single time from 2026-08-13 onward:
//
//     remote: - Required status check "gate (required)" is expected.
//     ! [remote rejected]     main -> main (push declined due to repository rule violations)
//
// The push sat under `git push || echo "push race — next tick re-records (idempotent)"`, so
// **1,597 runs concluded `success`** while `docs/drift-events/` stayed frozen at tick
// `000247` and `data/platform-drift.json` at run `32232815018`. Ten days of a dashboard
// serving stale numbers from behind a green check — a check that did not run wearing the
// face of one that passed.
//
// THE SHARP HALF, and the reason a plain "don't swallow" reading is too weak: that `||`
// misfiled a PERMANENT rule rejection as a TRANSIENT race. A retry-shaped fallback applied
// to a refusal that will never resolve does not degrade — it loops quietly forever, and
// each iteration reports success. Transient and permanent failures are different events and
// a publication path may not collapse them.
//
// WHY A LINT AND NOT A COMMENT. Both halves of this were already written down in the
// workflow. Line 97 of `drift-dashboard-cadence.yml` said "CAPABILITY tested, not just
// presence" directly above the line that tested neither, and `drift-sweep.yml` carried a
// paragraph explaining the rejection above the `||` that swallowed it. Prose rots and reads
// as compliance; only a check that fails can hold the property.
//
// THREE RULES, over lanes DERIVED from content — never a hand-written allowlist, which is
// its own drift surface (a roster that can go stale next to the thing it describes):
//
//   route       a publication push may not target `main`. The "CI Gate" ruleset evaluates
//               `gate (required)` at PUSH time with no bypass actors, so such a push is
//               refused by construction. Park on `heartbeat/*` and flush via PR, the way
//               tick-metrics / society / agent-heartbeat already do.
//   swallow     a publish command's failure may not be routed into a non-fatal handler —
//               neither `|| echo` / `|| true` / `|| :` / `|| exit 0` nor a step-level
//               `continue-on-error: true`. Note the second form is INVISIBLE to the REST
//               API: `GET /actions/runs/<id>/jobs` reports a swallowed STEP's conclusion as
//               `success` (`outcome` is workflow-local and absent from REST), so no
//               run-scraping check can see it. Static text is the channel that can.
//   capability  a lane that publishes must probe whether its credential can actually push,
//               with a real `git push --dry-run` against the real remote. A
//               `secrets.A || secrets.B` ladder covers ABSENCE only; #10850 shipped a
//               present-but-powerless token and killed three lanes for 16.75h. Presence is
//               not capability, and this lane proved it for ten days.
//
// SCOPE, deliberately: generation steps are untouched. `drift-sweep.yml`'s platform-drift
// producer is `continue-on-error: true` on purpose — it reports on legs that by decision
// cannot block, so it must not block either. This lint speaks only to the step that
// PUBLISHES, which is a different question from the one that MEASURES.
//
// Exit 0 = every drift publication lane routes, fails loudly, and proves its credential
//        1 = lists each violation with file:line and the remedy.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOW_DIR = ".github/workflows";

/**
 * A drift publication artifact, as a PATTERN rather than a list.
 *
 * `data/platform-drift.json`, `data/drift-mtth.json`, `docs/drift-events/`,
 * `db/drift-dashboard/` all match, and so does the next one somebody adds — which is the
 * point. A literal roster of today's five artifacts would need editing by exactly the
 * person least likely to remember, at exactly the moment a new lane is being written.
 */
const DRIFT_ARTIFACT_RE = /\b(?:data|docs|db)\/[A-Za-z0-9._/-]*drift[A-Za-z0-9._/-]*/;

/** `git add <paths>` and `--paths <paths>` are the two ways a lane declares what it publishes. */
const PUBLISH_DECLARATION_RE = /\bgit\s+add\b|--paths\b/;

/** A command that moves content to the forge. `--dry-run` is a probe, not a publication. */
const PUSH_RE = /\bgit\s+push\b/;
const FLUSH_RE = /flush-via-staging\.ts\s+flush\b/;

/** Failure routed somewhere that is not a failure. */
const SWALLOW_RE = /\|\|\s*(?:echo\b|true\b|:\s*$|:\s|exit\s+0\b)/;

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly rule: "route" | "swallow" | "capability";
  readonly detail: string;
}

/**
 * Blank out full-line comments, PRESERVING line numbers so a report can cite the source.
 *
 * Both YAML keys and the shell inside `run: |` use `#`, and every one of this repo's
 * workflows carries long comment paragraphs that quote the very commands being linted —
 * `drift-sweep.yml` explains its own rejected `git push` in prose directly above it. A
 * scanner that reads those would fire on the explanation instead of the code.
 *
 * Only FULL-line comments are stripped: a trailing `#` cannot be removed safely because
 * `#` appears inside quoted `::error::` strings, and cutting there would corrupt the very
 * lines this lint has to read. That asymmetry is stated rather than hidden — it means a
 * `git push` hidden after a trailing `#` on a code line would still be seen. Erring toward
 * reading too much is the right direction for a check.
 */
export function blankFullLineComments(text: string): readonly string[] {
  return text.split("\n").map((l) => (/^\s*#/.test(l) ? "" : l));
}

/** Does this line DECLARE that a drift artifact is being published? */
export function declaresDriftPublication(line: string): boolean {
  return PUBLISH_DECLARATION_RE.test(line) && DRIFT_ARTIFACT_RE.test(line);
}

/**
 * Does this push land on `main`?
 *
 * A BARE `git push` counts. These lanes check out `main` and commit onto it, so an
 * untargeted push goes exactly where an explicit `HEAD:main` would — and the bare form is
 * what `drift-sweep.yml` actually used, so a check that only matched the explicit spelling
 * would have missed the live instance it was written for.
 */
export function pushTargetsMain(command: string): boolean {
  const m = /\bgit\s+push\b/.exec(command);
  if (m === null) return false;
  if (/--dry-run\b/.test(command)) return false;

  // Only the push command's OWN arguments: stop at the first shell separator, so a
  // `&& echo main` downstream cannot be read as a refspec.
  const tail = command.slice(m.index + m[0].length).split(/[;&|]/)[0] ?? "";
  if (/\b(?:HEAD:)?(?:refs\/heads\/)?main\b/.test(tail)) return true;

  // BARE PUSH. Strip options and redirections; whatever survives would be
  // `<remote> [refspec...]`, and nothing surviving means the push takes its destination
  // from the current branch's upstream — which on these lanes is `main`.
  //
  // The live instance was `if git push 2>/tmp/push-err; then`, wrapped in an `if` and
  // carrying a redirection, which is precisely why this has to strip rather than pattern
  // match: the first draft of this function missed the very line it was written for.
  const bare = tail
    .replace(/\d?>>?\s*\S+/g, " ")
    .replace(/\d?>&\d/g, " ")
    .replace(/(?:^|\s)-{1,2}[A-Za-z][\w-]*(?:=\S+)?/g, " ");
  return bare.trim().length === 0;
}

/** Is this command's failure routed into something that is not a failure? */
export function isSwallowed(command: string): boolean {
  return SWALLOW_RE.test(command);
}

interface Step {
  readonly startLine: number;
  readonly endLine: number;
  readonly continueOnError: boolean;
}

/** Step boundaries and their `continue-on-error`, for attributing a command to its step. */
export function scanSteps(lines: readonly string[]): readonly Step[] {
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s{4,}-\s+(?:name|run|uses):/.test(lines[i] ?? "")) starts.push(i);
  }
  return starts.map((start, idx) => {
    const end = idx + 1 < starts.length ? (starts[idx + 1] ?? lines.length) : lines.length;
    const body = lines.slice(start, end);
    return {
      startLine: start,
      endLine: end,
      continueOnError: body.some((l) => /^\s*continue-on-error:\s*true\s*$/.test(l)),
    };
  });
}

const stepAt = (steps: readonly Step[], line: number): Step | undefined =>
  steps.find((s) => line >= s.startLine && line < s.endLine);

/**
 * Join backslash continuations into ONE logical command, keyed to the line it starts on.
 *
 * WHY THIS EXISTS — an owned miss, caught by the discrimination proof rather than by
 * reasoning. The first version of this lint scanned physical lines, so it passed on:
 *
 *     bun .../flush-via-staging.ts flush \
 *       --lane drift-sweep \
 *       --message "drift: record sweep tick" || echo "::warning::flush failed"
 *
 * The `|| echo` sits on a line that contains no `git push` and no `flush`, so nothing
 * matched it. That is the guard-that-guards-nothing failure inside the guard against it —
 * the shipped workflows use exactly this multi-line shape, so the ONE spelling the lint
 * would have faced in practice was the one it could not see. Line-based scanning of a
 * shell that has line continuations is simply the wrong unit.
 */
export function logicalCommands(
  lines: readonly string[],
): readonly { readonly start: number; readonly text: string }[] {
  const out: { start: number; text: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const start = i;
    let text = lines[i] ?? "";
    while (/\\\s*$/.test(text) && i + 1 < lines.length) {
      i += 1;
      text = `${text.replace(/\\\s*$/, " ")}${lines[i] ?? ""}`;
    }
    out.push({ start, text });
    i += 1;
  }
  return out;
}

const ROUTE_DETAIL =
  'publication push targets `main`. The "CI Gate" ruleset requires `gate (required)` at PUSH ' +
  "time with no bypass actors, so this is refused every run and always will be. Park on " +
  "`heartbeat/*` and flush via PR: " +
  "`bun src/Core.TypeScript/forge-host/github/flush-via-staging.ts flush --lane <lane> ...`";

const SWALLOW_DETAIL =
  "the publish command's failure is routed into a non-fatal handler. This is the exact " +
  "line-shape that hid 1,597 green runs publishing nothing, and it misfiles a PERMANENT rule " +
  "rejection as a TRANSIENT race — a retry story attached to a refusal that never resolves. " +
  "Let it fail the step; a fallback may switch MECHANISM, never pretend.";

const CONTINUE_ON_ERROR_DETAIL =
  "the publishing step carries `continue-on-error: true`, so a failed publish leaves the job " +
  "green. Worse, it is UNREPRESENTABLE downstream: the REST jobs API reports a swallowed step's " +
  "conclusion as `success`, so no run-scraping detector can see it. (A generation step may be " +
  "continue-on-error; the step that PUBLISHES may not.)";

const CAPABILITY_DETAIL =
  "this lane publishes but never probes whether its credential CAN push. A " +
  "`secrets.A || secrets.B` ladder covers ABSENCE only — #10850 shipped a present-but-powerless " +
  "token and killed three lanes for 16.75h. Add the preflight tick-metrics.yml and " +
  "agent-heartbeat.yml already run: a real " +
  "`git push --dry-run origin HEAD:refs/heads/credprobe/<lane>` against the real remote.";

/** Every rule that applies to ONE publish command, at the line it starts on. */
function auditPublishCommand(
  file: string,
  line: number,
  command: string,
  step: Step | undefined,
): readonly Violation[] {
  const out: Violation[] = [];
  if (pushTargetsMain(command)) out.push({ file, line, rule: "route", detail: ROUTE_DETAIL });
  if (isSwallowed(command)) out.push({ file, line, rule: "swallow", detail: SWALLOW_DETAIL });
  if (step?.continueOnError === true) {
    out.push({ file, line, rule: "swallow", detail: CONTINUE_ON_ERROR_DETAIL });
  }
  return out;
}

/** The whole audit for one workflow file. Empty result = this lane is not a publication lane. */
export function auditWorkflow(file: string, text: string): readonly Violation[] {
  const lines = blankFullLineComments(text);
  if (!lines.some(declaresDriftPublication)) return [];

  const steps = scanSteps(lines);
  const violations: Violation[] = [];
  let publishes = false;
  let probes = false;

  for (const { start, text: raw } of logicalCommands(lines)) {
    if (PUSH_RE.test(raw) && /--dry-run\b/.test(raw)) {
      probes = true;
      continue;
    }
    if (!PUSH_RE.test(raw) && !FLUSH_RE.test(raw)) continue;
    publishes = true;
    violations.push(...auditPublishCommand(file, start + 1, raw, stepAt(steps, start)));
  }

  if (publishes && !probes) {
    violations.push({ file, line: 1, rule: "capability", detail: CAPABILITY_DETAIL });
  }

  return violations;
}

export function auditDir(dir: string): {
  readonly lanes: readonly string[];
  readonly violations: readonly Violation[];
} {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();
  const lanes: string[] = [];
  const violations: Violation[] = [];
  for (const file of files) {
    const text = readFileSync(join(dir, file), "utf8");
    if (!blankFullLineComments(text).some(declaresDriftPublication)) continue;
    lanes.push(file);
    violations.push(...auditWorkflow(file, text));
  }
  return { lanes, violations };
}

if (import.meta.main) {
  const { lanes, violations } = auditDir(WORKFLOW_DIR);

  // SCAN FLOOR. A rename or a moved directory would leave this lint inspecting nothing and
  // reporting success — the vacuity class, committed inside the guard against it.
  if (lanes.length === 0) {
    console.error(`FAIL: scan floor — no drift publication lane found in ${WORKFLOW_DIR}.`);
    console.error("  A check that inspects nothing is not a check. Fix the scan, not the floor.");
    process.exit(1);
  }

  if (violations.length > 0) {
    console.error(
      `FAIL: ${String(violations.length)} drift-publication violation(s) across ` + `${String(lanes.length)} lane(s):`,
    );
    for (const v of violations) console.error(`  ${v.file}:${String(v.line)}  [${v.rule}] ${v.detail}`);
    console.error("");
    console.error("  A lane that computes an artifact and cannot publish it is a green check over");
    console.error("  stale data. See 081M0QPZD9C087G0R002W8QC2A and src/Core.TypeScript/ci/drift-loud.ts.");
    process.exit(1);
  }

  console.log(`ok: ${String(lanes.length)} drift publication lane(s) route via PR, fail loudly, and probe capability`);
  for (const l of lanes) console.log(`  - ${l}`);
}
