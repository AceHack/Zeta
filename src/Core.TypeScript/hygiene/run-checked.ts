#!/usr/bin/env bun
/**
 * run-checked.ts — run a command, then decide by its output ONLY IF it ran.
 *
 * WHY THIS EXISTS
 * ------------------------------------------------------------------------
 * The shape it replaces is everywhere in CI shell:
 *
 *     if some-tool input 2>&1 | grep -q 'BAD'; then echo "::error::..."; exit 1; fi
 *
 * A pipeline's exit status is the LAST command's, so `some-tool`'s status is
 * discarded entirely. If `some-tool` segfaults (exit 139 = 128+11) it prints
 * nothing, `grep` finds nothing, the `if` is false, and the step PASSES having
 * checked nothing. The louder the failure, the quieter the report — a crash is
 * strictly better hidden than a normal error, which is the wrong way round.
 *
 * This runs the command as a child (no pipeline), refuses to interpret the
 * output unless the process ran to completion with exit 0, and only then
 * applies the pattern assertions.
 *
 * USAGE
 * ------------------------------------------------------------------------
 *   bun run-checked.ts --label L [--deny RE]... [--require RE]...
 *                      [--message M] [--cwd DIR] [--strip-ansi]
 *                      -- CMD [ARG...]
 *
 * EXIT CODES — deliberately distinct, because they mean different things:
 *   0  ran, and every assertion held
 *   1  ran, and an assertion FAILED (a real finding)
 *   2  DID NOT RUN to completion (signal death / nonzero exit / spawn failure).
 *      This is NOT a finding and must never be reported as one — it is the
 *      absence of a measurement.
 *   3  bad invocation
 *
 * `--strip-ansi` exists because of a second measured trap: tsc hosted by bun
 * emits SGR colour codes even when stdout is a pipe, so the literal bytes are
 * `\x1b[91merror\x1b[0m\x1b[90m TS2688:` and `grep -c 'error TS'` returns 0 on
 * output that DOES contain a TypeScript error. Patterns are matched against
 * the de-coloured text when this flag is set.
 */

import { spawnSync } from "node:child_process";
import { assertCompleted, classifyExit, describeDisposition, SignalDeathError } from "./signal-death.ts";

export interface Assertion {
  readonly kind: "deny" | "require";
  readonly pattern: string;
}

export interface CliOptions {
  readonly label: string;
  readonly assertions: readonly Assertion[];
  readonly message: string | null;
  readonly cwd: string | null;
  readonly stripAnsi: boolean;
  readonly command: readonly string[];
}

/** SGR / CSI escape sequences, so a colourised diagnostic still matches. */
// eslint-disable-next-line no-control-regex -- matching terminal control bytes is the point
const ANSI_RE = new RegExp("\\u001b\\[[0-9;?]*[ -/]*[@-~]", "g");

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

export function parseArgs(argv: readonly string[]): CliOptions | { readonly error: string } {
  let label = "";
  let message: string | null = null;
  let cwd: string | null = null;
  let stripAnsiFlag = false;
  const assertions: Assertion[] = [];
  const command: string[] = [];
  let seenSeparator = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (seenSeparator) {
      command.push(arg);
      continue;
    }
    if (arg === "--") {
      seenSeparator = true;
      continue;
    }
    const next = argv[i + 1];
    switch (arg) {
      case "--label":
        if (next === undefined) return { error: "--label needs a value" };
        label = next;
        i++;
        break;
      case "--deny":
        if (next === undefined) return { error: "--deny needs a value" };
        assertions.push({ kind: "deny", pattern: next });
        i++;
        break;
      case "--require":
        if (next === undefined) return { error: "--require needs a value" };
        assertions.push({ kind: "require", pattern: next });
        i++;
        break;
      case "--message":
        if (next === undefined) return { error: "--message needs a value" };
        message = next;
        i++;
        break;
      case "--cwd":
        if (next === undefined) return { error: "--cwd needs a value" };
        cwd = next;
        i++;
        break;
      case "--strip-ansi":
        stripAnsiFlag = true;
        break;
      default:
        return { error: `unknown option ${arg}` };
    }
  }

  if (label === "") return { error: "--label is required" };
  if (command.length === 0) return { error: "no command given (put it after `--`)" };
  if (assertions.length === 0) return { error: "at least one --deny or --require is required" };
  return { label, assertions, message, cwd, stripAnsi: stripAnsiFlag, command };
}

export interface AssertionFailure {
  readonly kind: "deny" | "require";
  readonly pattern: string;
}

/**
 * Apply the assertions to already-validated output.
 *
 * Split out from the process handling so it can be tested without spawning,
 * and — more to the point — so it is IMPOSSIBLE to reach without the caller
 * having first decided the process actually ran.
 */
export function evaluateAssertions(output: string, assertions: readonly Assertion[]): readonly AssertionFailure[] {
  const failures: AssertionFailure[] = [];
  for (const a of assertions) {
    const re = new RegExp(a.pattern);
    const hit = re.test(output);
    if (a.kind === "deny" && hit) failures.push(a);
    if (a.kind === "require" && !hit) failures.push(a);
  }
  return failures;
}

/**
 * Write a diagnostic line to stderr WITHOUT going through the console object.
 *
 * Two reasons, both measured on 2026-08-15:
 *  1. Bun colourises console output even when stderr is a pipe, so every line
 *     arrives prefixed with an SGR reset+colour sequence. GitHub Actions only
 *     recognises a workflow command when the line BEGINS with `::error::` — an
 *     ANSI prefix means the annotation silently does not appear. A guard whose
 *     alarm does not render is most of the way back to no guard.
 *  2. The same prefix defeated this file's own regression test, which asserts
 *     no line starts with `---`: with the colour prefix, that assertion could
 *     not fail. Exactly the vacuity class this change is about, in its own test.
 */
function emit(line: string): void {
  process.stderr.write(`${line}\n`);
}

function main(argv: readonly string[]): number {
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    emit(`run-checked: ${parsed.error}`);
    return 3;
  }
  const [bin, ...args] = parsed.command as [string, ...string[]];

  const result = spawnSync(bin, args, {
    cwd: parsed.cwd ?? process.cwd(),
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });

  const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  // ORDER IS THE WHOLE POINT: disposition first, output second.
  try {
    assertCompleted(parsed.label, result);
  } catch (e) {
    const disposition = e instanceof SignalDeathError ? e.disposition : classifyExit(result);
    emit(`::error::${parsed.label}: the check DID NOT RUN — ${describeDisposition(disposition)}`);
    emit(
      "::error::A process that did not finish produces the same empty output as a clean pass. " +
        "This is reported as 'no measurement', never as 'no findings'.",
    );
    // Separators are `***`, NOT `---`. A line beginning `---` is a patch
    // boundary to `git interpret-trailers`, so any PR body quoting this output
    // silently loses its AgencySignature trailer block. Found the hard way:
    // this file's first version used `---`, and the PR body announcing it
    // stopped parsing at exactly that line. A diagnostic that breaks the tool
    // reading it is its own small version of the defect this file guards.
    if (raw.trim() !== "") {
      emit("*** last 40 lines of what it did emit before dying ***");
      emit(raw.split("\n").slice(-40).join("\n"));
    } else {
      emit("*** it emitted nothing at all, which is exactly the trap ***");
    }
    return 2;
  }

  const text = parsed.stripAnsi ? stripAnsi(raw) : raw;
  const failures = evaluateAssertions(text, parsed.assertions);
  if (failures.length > 0) {
    for (const f of failures) {
      const detail =
        f.kind === "deny"
          ? `output CONTAINS the forbidden pattern /${f.pattern}/`
          : `output is MISSING the required pattern /${f.pattern}/`;
      emit(`::error::${parsed.message ?? parsed.label}: ${detail}`);
    }
    emit(raw.split("\n").slice(-40).join("\n"));
    return 1;
  }

  process.stdout.write(`✓ ${parsed.label}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
