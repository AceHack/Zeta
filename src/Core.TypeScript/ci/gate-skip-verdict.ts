#!/usr/bin/env bun
// gate-skip-verdict.ts -- decide `gate (required)` when a floor job says `skipped`.
//
// ── THE DEFECT ────────────────────────────────────────────────────────────────────
//
// The roll-up's verdict step was one line of grep:
//
//     if echo "$results" | grep -qE '"(failure|cancelled)"'; then exit 1; fi
//
// so `skipped` counted as success. That is CORRECT for the path filter -- a docs-only
// PR legitimately skips `full-verify` -- and WRONG for the other producer of the same
// word. GitHub marks a job `skipped` when a job it `needs:` did not succeed. So a red
// `path-filter` skips `build-and-test` AND `full-verify`, the roll-up sees two
// `skipped` values, and `gate (required)` -- the sole required status check, the one
// thing branch protection consults -- reports SUCCESS while its two heaviest subjects
// never ran. A check that did not run looked exactly like a check that passed, at the
// one place in the repo where that is most expensive.
//
// ── WHY NOT JUST FAIL ON `skipped` ────────────────────────────────────────────────
//
// Because it would go red on every docs-only PR, and a gate that blocks correct work
// is worse than the hole it closes. `skipped` is genuinely two-valued and the fix has
// to SEPARATE the values, not collapse them onto the pessimistic one.
//
// ── HOW THEY ARE SEPARATED ────────────────────────────────────────────────────────
//
// GitHub only produces `skipped` two ways, and `gate.yml` says which one applies:
//
//   1. The job's own JOB-LEVEL `if:` evaluated false. Deliberate. `full-verify`
//      declares `if: needs.path-filter.outputs.code == 'true'`, so it has a licence
//      to skip. This is the docs-only case.
//   2. A job it `needs:` did not succeed. Not deliberate, and invisible in the roll-up
//      because the dead prerequisite is not the job the roll-up is looking at.
//
// So a skip is legitimate iff the job DECLARES a job-level `if:` **and** every job it
// `needs:` reported `success`. Both halves are read out of `gate.yml` itself -- there
// is no list of "jobs allowed to skip" to drift. Give `build-and-test` an `if:` and it
// becomes skippable here with no edit to this file; delete `full-verify`'s and it stops
// being, likewise.
//
// The second half is only answerable if the roll-up can SEE those prerequisites, which
// is why `gate-required.needs:` gained `matrix-setup` and `path-filter`.
//
// STATED WITHOUT SOFTENING: that makes those two jobs block, and previously they did
// not. `gate-blocking-floor.ts` has derived them as inside the floor since #15504, but
// a derivation is a claim about intent and the runtime disagreed with it -- a red
// `path-filter` produced a GREEN gate. So this change adds two jobs to the set that can
// stop a merge. Nothing else gains blocking power: no hygiene lint, no drift job, no
// continue-on-error leg.
//
// ── FAIL CLOSED, AND WHERE THAT COSTS ─────────────────────────────────────────────
//
// Every unclassifiable state blocks: an unreadable or unparseable `gate.yml`, a result
// string that is none of the four GitHub documents, an empty `needs` context, a
// prerequisite whose result the roll-up cannot see. The cost is real and worth naming:
// this step can now turn a green gate red because a PARSE failed, where before it could
// only do so because a JOB failed. Two things bound it -- `gate.yml` is read from the
// roll-up's own sparse checkout in the same job (if that is broken the job already
// fails), and the parse is pinned against the real `gate.yml` by the tests beside this
// file. A gate that fails open is the thing this whole change is about.
//
// Usage (CI):  NEEDS_JSON='${{ toJSON(needs) }}' bun gate-skip-verdict.ts
// Usage (local, against a captured shape):
//   NEEDS_JSON="$(cat needs.json)" bun gate-skip-verdict.ts --gate-yml .github/workflows/gate.yml

import { readFileSync } from "node:fs";
import { gateYmlJobIds, gateYmlJobIfs, gateYmlJobNeeds, ROLLUP_JOB_ID } from "./gate-blocking-floor.ts";

/** The four values GitHub documents for `needs.<job>.result`. Anything else is unknown. */
export const KNOWN_RESULTS: readonly string[] = ["success", "failure", "cancelled", "skipped"];

/** What `gate.yml` declares about the jobs the roll-up is judging. */
export interface WorkflowDecls {
  /** Every job id declared under `jobs:`. */
  readonly jobIds: ReadonlySet<string>;
  /** job id -> the ids in its `needs:`. Absent means the job declares none. */
  readonly needsOf: ReadonlyMap<string, readonly string[]>;
  /** job id -> its job-level `if:` expression. Absent means the job declares none. */
  readonly ifOf: ReadonlyMap<string, string>;
}

export function parseDecls(yamlText: string): WorkflowDecls {
  return {
    jobIds: new Set(gateYmlJobIds(yamlText)),
    needsOf: gateYmlJobNeeds(yamlText),
    ifOf: gateYmlJobIfs(yamlText),
  };
}

export type VerdictKind = "pass" | "legitimate-skip" | "block";

export interface Verdict {
  readonly need: string;
  readonly result: string;
  readonly kind: VerdictKind;
  /** Why, in one sentence, printed for every row -- including the passing ones. */
  readonly reason: string;
}

/**
 * Classify ONE floor entry.
 *
 * `decls` is null when `gate.yml` could not be read or parsed. That does not disturb the
 * `failure`/`cancelled`/`success` answers -- those never needed the workflow text -- and
 * it makes every `skipped` unclassifiable, i.e. blocking. So a parse failure degrades to
 * "no skip is legitimate today", never to "every skip is".
 */
export function classifyFloorResult(
  need: string,
  results: ReadonlyMap<string, string>,
  decls: WorkflowDecls | null,
): Verdict {
  const result = results.get(need) ?? "<missing>";
  const block = (reason: string): Verdict => ({ need, result, kind: "block", reason });

  if (result === "success") {
    return { need, result, kind: "pass", reason: "ran and succeeded" };
  }
  if (result === "failure" || result === "cancelled") {
    return block(`the job ${result === "failure" ? "failed" : "was cancelled"}`);
  }
  if (result !== "skipped") {
    // `<missing>`, `null`, or a value GitHub does not document. Never seen; never trusted.
    return block(
      `result ${JSON.stringify(result)} is not one of ${KNOWN_RESULTS.join("/")}, so it cannot be shown to be a pass`,
    );
  }

  // ── result === "skipped": the whole point of this file ──────────────────────────
  if (decls === null) {
    return block("skipped, and gate.yml could not be read or parsed, so the skip cannot be shown legitimate");
  }
  if (!decls.jobIds.has(need)) {
    return block(`skipped, and gate.yml declares no job \`${need}\` — the roll-up and the workflow disagree`);
  }
  const condition = decls.ifOf.get(need);
  if (condition === undefined) {
    return block(
      "skipped, but the job declares no job-level `if:` — the only remaining way it can skip is a " +
        "prerequisite that did not succeed",
    );
  }
  const prerequisites = decls.needsOf.get(need) ?? [];
  for (const up of prerequisites) {
    const upResult = results.get(up);
    if (upResult === undefined) {
      return block(
        `skipped, and its prerequisite \`${up}\` is not visible to the roll-up — add \`${up}\` to ` +
          `\`${ROLLUP_JOB_ID}.needs:\` so this skip can be classified`,
      );
    }
    if (upResult !== "success") {
      return block(`skipped because its prerequisite \`${up}\` reported \`${upResult}\`, not because \`if:\` said no`);
    }
  }
  const upstream = prerequisites.length === 0 ? "it has no prerequisites" : `${prerequisites.join(", ")} all succeeded`;
  return {
    need,
    result,
    kind: "legitimate-skip",
    reason: `declared \`if: ${condition}\` evaluated false while ${upstream}`,
  };
}

export interface GateVerdict {
  readonly verdicts: readonly Verdict[];
  readonly blocked: readonly Verdict[];
  readonly passed: boolean;
}

/**
 * The whole verdict.
 *
 * An EMPTY floor blocks. A roll-up with nothing to roll up is the vacuity class in its
 * purest form -- it would report success having judged nothing -- so it is refused rather
 * than congratulated.
 */
export function decideGate(results: ReadonlyMap<string, string>, decls: WorkflowDecls | null): GateVerdict {
  if (results.size === 0) {
    const v: Verdict = {
      need: "<the needs context>",
      result: "<empty>",
      kind: "block",
      reason: "the roll-up received an empty `needs` context, so it judged nothing — a green here would assert nothing",
    };
    return { verdicts: [v], blocked: [v], passed: false };
  }
  const verdicts = [...results.keys()].sort().map((need) => classifyFloorResult(need, results, decls));
  const blocked = verdicts.filter((v) => v.kind === "block");
  return { verdicts, blocked, passed: blocked.length === 0 };
}

/**
 * `toJSON(needs)` -> job id -> result string.
 *
 * Returns null when the value is not the object GitHub produces. Null is the fail-closed
 * answer: `decideGate` then sees an empty map and blocks.
 */
export function parseNeedsJson(text: string): ReadonlyMap<string, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const out = new Map<string, string>();
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    const result = (value as { result?: unknown } | null)?.result;
    out.set(id, typeof result === "string" ? result : "<missing>");
  }
  return out;
}

const KIND_MARK: Readonly<Record<VerdictKind, string>> = {
  pass: "ok  ",
  "legitimate-skip": "skip",
  block: "FAIL",
};

export function renderVerdict(gate: GateVerdict): string {
  const lines = ["Floor job results, and why each one is or is not acceptable:"];
  for (const v of gate.verdicts) {
    lines.push(`  [${KIND_MARK[v.kind]}] ${v.need}: ${v.result} — ${v.reason}`);
  }
  return lines.join("\n");
}

// ── CLI ────────────────────────────────────────────────────────────────────────────

function main(): void {
  const argv = process.argv.slice(2);
  const gateFlag = argv.indexOf("--gate-yml");
  const gateYmlPath = gateFlag >= 0 ? (argv[gateFlag + 1] ?? "") : ".github/workflows/gate.yml";

  const results = parseNeedsJson(process.env.NEEDS_JSON ?? "");
  let decls: WorkflowDecls | null = null;
  try {
    decls = parseDecls(readFileSync(gateYmlPath, "utf8"));
  } catch {
    console.log(`::warning title=gate verdict::could not read ${gateYmlPath}; no skip can be classified as legitimate.`);
  }

  const gate = decideGate(results ?? new Map(), decls);
  console.log(renderVerdict(gate));

  if (gate.passed) {
    console.log("\nAll floor jobs succeeded or were legitimately skipped. ✓");
    console.log('Scope of this green: see the "gate (required)" step summary.');
    return;
  }
  for (const v of gate.blocked) {
    console.log(`::error title=gate floor::${v.need}: ${v.reason}`);
  }
  console.log(
    "\nA `skipped` floor job is only acceptable when gate.yml gives it a job-level `if:` AND every job\n" +
      "it needs succeeded. Otherwise the job did not run because something upstream died, and a green\n" +
      "here would report a pass for a check that never executed.",
  );
  process.exitCode = 1;
}

if (import.meta.main) {
  main();
}
