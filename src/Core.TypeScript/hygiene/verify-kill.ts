/**
 * `verify-kill` — did the test you just wrote actually kill the mutant?
 *
 * WHY THIS EXISTS, and it is empirical rather than theoretical. Over one day of working real
 * mutation findings, the "re-run and confirm it dies" step caught a wrong answer FIVE times:
 *
 *   - twice a test written specifically to kill a mutant PASSED against that mutant unchanged
 *     (`grammar-16-render.ts`, `mutation-readout.ts`) — in both cases the survivor was masked or
 *     redundant code, and the honest response was not a test at all;
 *   - once a hand-rolled falsifier loop applied a mutation that SILENTLY DID NOT MATCH, so every
 *     mutant "survived" and the run looked like a clean bill;
 *   - twice the surrounding shell reported success from a command that had produced no output.
 *
 * Every one of those was caught by remembering to check. That is a discipline living in someone's
 * head, which means it dies with their context window. This is the same question as a command.
 *
 * THE GUARD THAT MATTERS MOST is the applicability assertion. A mutation whose pattern does not
 * appear in the file is a NO-OP, and a no-op mutant always "survives" — which reads exactly like a
 * genuine finding and exactly like a test that failed to bite. That is the runner's own
 * `unresolved` lesson (exit 0 conflating "passed" with "never ran") applied one level up: a check
 * that did not run must never look like a check that passed. So `not-applicable` is its own
 * outcome and its own exit code, never folded into either verdict.
 *
 * Usage:
 *   bun src/Core.TypeScript/hygiene/verify-kill.ts \
 *     --source src/Core.TypeScript/x.ts --test src/Core.TypeScript/x.test.ts --mutation gte-to-gt
 *
 * Exit codes — distinct so CI and humans can branch on them:
 *   0  killed             the suite now separates the variant. The fix is real.
 *   3  still alive        indistinguishable. Either the test does not bite, or the survivor is
 *                         redundant/free and a test was the wrong response.
 *   4  not applicable     the mutation pattern is not in the file. Nothing was measured.
 *   5  unresolved         baseline red, or the suite exited 0 without running (see runMutant).
 *   2  usage error
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MUTATIONS, isApplicable, runMutant, type Mutation } from "./mutation-runner";
import { appendTranscriptOnce, loadAllLedgers } from "./mutation-freedoms";
import { observeFinding, recordChoice } from "./mutation-readout";

export type VerifyOutcome =
  /** The suite separates baseline from mutant — the fix bites. */
  | { readonly kind: "killed" }
  /** The suite still cannot tell them apart. */
  | { readonly kind: "still-alive" }
  /** The pattern is absent, so applying it changed nothing. NOT a survival. */
  | { readonly kind: "not-applicable"; readonly why: string }
  /** No signal at all — the run established nothing. */
  | { readonly kind: "unresolved"; readonly why: string };

export function mutationByName(name: string): Mutation | undefined {
  return MUTATIONS.find((m) => m.name === name);
}

/**
 * Run one mutation against one suite and say, unambiguously, which of four things happened.
 *
 * `readSource` is injected so the applicability check is testable without a filesystem, and
 * `run` so the whole decision can be exercised without spawning a suite. Ambient IO here would
 * make this module the one thing in the pipeline that cannot itself be verified.
 */
export function verifyKill(
  root: string,
  source: string,
  test: string,
  mutationName: string,
  deps: {
    readonly readSource: (path: string) => string;
    readonly run: (root: string, target: { source: string; test: string }, m: Mutation) => { kind: string; why?: string };
  },
): VerifyOutcome {
  const mutation = mutationByName(mutationName);
  if (mutation === undefined) {
    return {
      kind: "not-applicable",
      why: `unknown mutation ${JSON.stringify(mutationName)} — known: ${MUTATIONS.map((m) => m.name).join(", ")}`,
    };
  }

  // APPLICABILITY FIRST, before spending a suite run on it. A pattern that is not present cannot
  // be flipped, and a mutant that was never really applied always looks like it survived.
  let src: string;
  try {
    src = deps.readSource(join(root, source));
  } catch {
    return { kind: "not-applicable", why: `could not read ${source}` };
  }
  if (!isApplicable(src, mutation)) {
    return {
      kind: "not-applicable",
      why:
        `${JSON.stringify(mutation.find)} does not appear on any non-comment line of ${source}, ` +
        `so applying ${mutation.name} changes nothing. This is NOT a surviving mutant — nothing was measured`,
    };
  }

  const finding = deps.run(root, { source, test }, mutation);
  switch (finding.kind) {
    case "distinguished-by-suite":
      return { kind: "killed" };
    case "indistinguishable-under-suite":
      return { kind: "still-alive" };
    default:
      return { kind: "unresolved", why: finding.why ?? "the run established nothing" };
  }
}

/** Exit code per outcome. Distinct by design — a caller must be able to tell these apart. */
export function exitCodeFor(outcome: VerifyOutcome): number {
  switch (outcome.kind) {
    case "killed":
      return 0;
    case "still-alive":
      return 3;
    case "not-applicable":
      return 4;
    case "unresolved":
      return 5;
  }
}

export function formatOutcome(o: VerifyOutcome, source: string, test: string, mutation: string): string {
  const room = `  ${source}\n  ${test}\n  ${mutation}`;
  switch (o.kind) {
    case "killed":
      return `[verify-kill] KILLED — the suite now separates the variant.\n${room}`;
    case "still-alive":
      return (
        `[verify-kill] STILL ALIVE — the suite cannot tell them apart.\n${room}\n\n` +
        `  The test does not bite. Before writing another: check whether the survivor is REDUNDANT\n` +
        `  (masked by another guard deciding the same thing) — no test can hold that, and declaring\n` +
        `  it free would be dishonest. Both of those have their own cell in the runner's menu.`
      );
    case "not-applicable":
      return `[verify-kill] NOT APPLICABLE — nothing was measured.\n${room}\n  ${o.why}`;
    case "unresolved":
      return `[verify-kill] UNRESOLVED — the run established nothing.\n${room}\n  ${o.why}`;
  }
}

/**
 * Record a PROVEN kill as a `write-test` resolution.
 *
 * This closes the hole that made `resolutionCoverage` useless: findings accumulate per tick, but
 * resolutions only ever landed as PRs, so the coverage ratio would have read near-zero forever and
 * the false-alarm rate stayed permanently (and correctly) withheld. The fix is not a new discipline
 * to remember — it is that the moment a kill is PROVEN is exactly the moment the resolution is
 * known, so the tool that proves it records it.
 *
 * Only on `killed`. A still-alive mutant has resolved nothing, and recording it would assert a
 * judgement the run did not earn.
 *
 * Idempotent by content address: re-running `verify-kill --record` over the same fix appends
 * nothing, because a duplicated resolution would inflate the numerator of the metric it feeds.
 */
export function recordKill(
  root: string,
  declarer: string,
  room: { readonly source: string; readonly test: string; readonly mutation: string },
): { readonly recorded: boolean; readonly reason: string } {
  const readout = observeFinding(room, declarer, loadAllLedgers(root));
  const idx = readout.grid.findIndex((c) => c?.action.kind === "write-test");
  if (idx < 0) {
    // The menu adapts to the finding; if this declarer already declared the dimension free, the
    // write-test cell is withheld. Saying so beats silently recording nothing.
    return { recorded: false, reason: "no write-test cell on this menu (already declared free by this declarer?)" };
  }
  const entry = recordChoice(readout, declarer, idx, { kind: "write-test" });
  const wrote = appendTranscriptOnce(root, declarer, entry);
  return {
    recorded: wrote,
    reason: wrote ? `recorded write-test resolution ${entry.address.slice(0, 16)}…` : "already recorded — idempotent, nothing appended",
  };
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const invokedDirectly = typeof process.argv[1] === "string" && /verify-kill\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const source = argValue("--source");
  const test = argValue("--test");
  const mutation = argValue("--mutation");
  if (source === undefined || test === undefined || mutation === undefined) {
    console.error(
      `usage: verify-kill --source <file.ts> --test <file.test.ts> --mutation <name>\n` +
        `  mutations: ${MUTATIONS.map((m) => m.name).join(", ")}`,
    );
    process.exit(2);
  }
  const root = argValue("--repo-root") ?? process.cwd();
  const outcome = verifyKill(root, source, test, mutation, {
    readSource: (p) => readFileSync(p, "utf8"),
    run: (r, t, m) => runMutant(r, t, m).distinguishability,
  });
  console.error(formatOutcome(outcome, source, test, mutation));

  // `--record` writes the resolution ONLY for a proven kill. Deliberately opt-in: a read-only
  // verification must stay read-only unless the caller asks for the write.
  if (process.argv.includes("--record") && outcome.kind === "killed") {
    const declarer = argValue("--declarer");
    if (declarer === undefined) {
      console.error(`  --record needs --declarer <name>; nothing recorded`);
      process.exit(2);
    }
    const r = recordKill(root, declarer, { source, test, mutation });
    console.error(`  ${r.reason}`);
  }

  process.exit(exitCodeFor(outcome));
}
