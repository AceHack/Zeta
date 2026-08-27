#!/usr/bin/env bun
/**
 * audit-artifact-freshness.ts — assert that a published timestamp is RECENT.
 *
 * WHY THIS EXISTS. Three scheduled lanes died quietly and none of them produced a
 * signal anyone read:
 *
 *   - the Red State lane failed ten consecutive runs (2026-08-25T06:37Z ->
 *     2026-08-27T02:02Z) and `demo/red/red-state.json` froze at 2026-08-23T18:35Z —
 *     just under four days — while the dashboard at `/demo/red/` kept rendering that
 *     timestamp in its footer as if it were news;
 *   - a sibling lane went two days;
 *   - a retired launchd lane went ten weeks.
 *
 * Every one of them was found because a human happened to read a name off a list.
 *
 * The surface to catch them was already built and unused. `collect-red-state.ts`
 * writes `generatedAtIso`, `demo/red/index.html` renders it, and **nothing asserted
 * it was recent**. A timestamp that is displayed but never checked is decoration: it
 * makes the page look accountable and holds nobody to anything.
 *
 * WHAT THIS CHECKS, AND WHY IT IS NOT THE SAME AS "DID THE LANE RUN". The drift
 * dashboard already watches whether each WORKFLOW produced a verdict. This watches
 * whether the ARTIFACT the workflow exists to publish actually landed — which is the
 * end-to-end property. They come apart: a lane can go green, collect perfectly, and
 * still publish nothing when its flush PR does not merge. The dashboard would call
 * that lane healthy; the file would still be four days old.
 *
 * NOT A GATE. Exits non-zero so a freeze is impossible to miss in a run's own
 * conclusion, and is deliberately absent from the required-check floor. Promotion to
 * the floor is the maintainer's call, not a side effect of shipping the check.
 *
 * Usage:
 *   bun src/Core.TypeScript/hygiene/audit-artifact-freshness.ts
 *   bun src/Core.TypeScript/hygiene/audit-artifact-freshness.ts --json
 *   bun src/Core.TypeScript/hygiene/audit-artifact-freshness.ts --now 2026-08-27T02:00:00Z
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFAULT_FOLD_CONFIG } from "../drift-dashboard/fold.ts";

// ─── The threshold, and why that number ─────────────────────────────────────
//
// `staleAfterSeconds = stalenessFactor × cadenceSeconds`, with BOTH inputs taken
// from something that already exists rather than chosen here:
//
//   cadenceSeconds   — read off the lane's OWN declared `cron`, per subject. A
//                      threshold that does not descend from the declared cadence is
//                      a number somebody liked, and this repo has already paid for
//                      two of those in one night (a 5000 ms Bun timeout and a
//                      `>= 1.5x` SIMD gate, neither traceable to a chooser).
//
//   stalenessFactor  — imported, not redeclared. `DEFAULT_FOLD_CONFIG.stalenessFactor`
//                      is the drift dashboard's already-argued answer to exactly this
//                      question ("a periodic check is STALE once its newest verdict is
//                      older than stalenessFactor × periodSeconds"), and it is 3.
//                      Importing it means the repo has ONE staleness constant; a second
//                      copy would drift from the first and nobody would notice which
//                      was right.
//
// Why 3 rather than 1 or 2, restated for this surface: GitHub drops scheduled runs
// under load — the drift-dashboard workflow's own header says so and staggers its
// cron off the hour because of it — so a single missed tick is weather. Three
// consecutive missed ticks is not. At the 6h cadence below that is an 18h window,
// which is comfortably shorter than every freeze that motivated this file (2 days,
// 3.7 days, 10 weeks) and comfortably longer than any hiccup observed.
export function staleAfterSeconds(cadenceSeconds: number): number {
  return DEFAULT_FOLD_CONFIG.stalenessFactor * cadenceSeconds;
}

// ─── The roster ─────────────────────────────────────────────────────────────

export interface FreshnessSubject {
  readonly id: string;
  /** Repo-relative path to a JSON document. */
  readonly path: string;
  /** Top-level key holding an ISO-8601 instant. */
  readonly field: string;
  /** The lane's declared period, in seconds. */
  readonly cadenceSeconds: number;
  /** Where that cadence was READ FROM — so a reader can check it, not trust it. */
  readonly cadenceDeclaredIn: string;
  /** What a freeze here means to a human. */
  readonly why: string;
}

/**
 * Three entries. Two was the smallest roster that proved the check is not welded to
 * `red-state`; the third arrived as predicted — a five-line edit, not a design.
 *
 * What a GENERAL version would need, and why it is still not built here: deriving
 * `cadenceSeconds` from the workflow's own `cron` automatically (the drift dashboard's
 * `expectationForWorkflow` already does this and could be lifted), and a way to name
 * the timestamp inside nested documents rather than a top-level key. Neither is worth
 * paying for at three subjects, and both become obvious at five.
 */
export const FRESHNESS_ROSTER: readonly FreshnessSubject[] = [
  {
    id: "red-state",
    path: "demo/red/red-state.json",
    field: "generatedAtIso",
    // `.github/workflows/proof-closure-drift.yml` — `schedule: cron: "23 */6 * * *"`.
    cadenceSeconds: 6 * 3600,
    cadenceDeclaredIn: '.github/workflows/proof-closure-drift.yml cron "23 */6 * * *"',
    why: "the Red State dashboard at /demo/red/ renders this timestamp; a frozen one means the page is showing a snapshot of a repo that no longer exists",
  },
  {
    id: "drift-dashboard",
    path: "data/drift-dashboard.json",
    field: "at",
    // `.github/workflows/drift-dashboard-cadence.yml` — `schedule: cron: "41 */6 * * *"`.
    cadenceSeconds: 6 * 3600,
    cadenceDeclaredIn: '.github/workflows/drift-dashboard-cadence.yml cron "41 */6 * * *"',
    why: "society-status reads this file; a frozen one reports yesterday's roster as today's",
  },
  {
    id: "pr-categorization",
    path: "data/pr-categorization/statistics.json",
    field: "generatedAtIso",
    // `.github/workflows/pr-categorization-cadence.yml` — `schedule: cron: "34 */6 * * *"`.
    cadenceSeconds: 6 * 3600,
    cadenceDeclaredIn: '.github/workflows/pr-categorization-cadence.yml cron "34 */6 * * *"',
    why: "the PR area dashboard at data/pr-categorization/index.html renders these accuracies; a frozen one reports model scores measured against a corpus that has since grown by thousands of PRs, and the area mix is exactly what shifts fastest",
  },
];

// ─── The verdict ────────────────────────────────────────────────────────────

/**
 * STALE AND ABSENT ARE DIFFERENT ANSWERS, and neither is fresh.
 *
 * Same discipline as "exit code 2 is a check that never ran": a check that could not
 * read its subject has not passed, and must not be reported in the same breath as one
 * that read it and liked it. `missing-file` / `unparseable` / `no-field` /
 * `unparseable-timestamp` each name what actually happened, so nobody has to guess
 * whether an empty result meant healthy or blind.
 *
 * `from-the-future` is here because the alternative is worse: a timestamp ahead of now
 * has the SMALLEST age of all and would otherwise be the freshest thing on the board.
 * Clock skew and a fabricated value produce exactly that, so it is called out rather
 * than rewarded.
 */
export type FreshnessState =
  "fresh" | "stale" | "missing-file" | "unparseable" | "no-field" | "unparseable-timestamp" | "from-the-future";

export interface FreshnessVerdict {
  readonly id: string;
  readonly state: FreshnessState;
  readonly ok: boolean;
  /** Seconds between the recorded instant and `now`; null when there is no instant. */
  readonly ageSeconds: number | null;
  readonly staleAfterSeconds: number;
  readonly detail: string;
}

function humanDuration(seconds: number): string {
  const s = Math.abs(Math.round(seconds));
  if (s < 90) return `${s}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  if (s < 172_800) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86_400).toFixed(1)}d`;
}

/**
 * Pure. `raw` is the file body, or `null` when the file is not there; `nowMs` is
 * injected so the verdict is a function of its inputs and replays deterministically
 * (`.claude/rules/dv2-data-split-discipline-activated.md` §4 DST — and §7: no ambient
 * clock reaches a decision).
 */
export function classifyFreshness(subject: FreshnessSubject, raw: string | null, nowMs: number): FreshnessVerdict {
  const limit = staleAfterSeconds(subject.cadenceSeconds);
  const base = { id: subject.id, staleAfterSeconds: limit } as const;

  if (raw === null) {
    return {
      ...base,
      state: "missing-file",
      ok: false,
      ageSeconds: null,
      detail: `${subject.path} does not exist — absent is not fresh`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      ...base,
      state: "unparseable",
      ok: false,
      ageSeconds: null,
      detail: `${subject.path} is not JSON (${e instanceof Error ? e.message : String(e)})`,
    };
  }
  // `Array.isArray` explicitly: a top-level array is `typeof "object"`, so without
  // this it would fall through and be reported as a document that merely lacks the
  // field — which is a different and less true statement than "this is not the
  // document shape at all".
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ...base,
      state: "unparseable",
      ok: false,
      ageSeconds: null,
      detail: `${subject.path} is not a JSON object`,
    };
  }

  const value = (parsed as Record<string, unknown>)[subject.field];
  if (typeof value !== "string" || value.trim().length === 0) {
    return {
      ...base,
      state: "no-field",
      ok: false,
      ageSeconds: null,
      detail: `${subject.path} carries no \`${subject.field}\` — a document with no timestamp is not a fresh document, it is an unreadable one`,
    };
  }

  const at = Date.parse(value);
  if (Number.isNaN(at)) {
    return {
      ...base,
      state: "unparseable-timestamp",
      ok: false,
      ageSeconds: null,
      detail: `${subject.path} \`${subject.field}\` is not an instant: ${JSON.stringify(value)}`,
    };
  }

  const ageSeconds = (nowMs - at) / 1000;
  if (ageSeconds < 0) {
    return {
      ...base,
      state: "from-the-future",
      ok: false,
      ageSeconds,
      detail: `${subject.path} \`${subject.field}\` is ${humanDuration(ageSeconds)} in the FUTURE (${value}) — clock skew or a fabricated value; either way it is not evidence of a recent run`,
    };
  }
  if (ageSeconds > limit) {
    return {
      ...base,
      state: "stale",
      ok: false,
      ageSeconds,
      detail: `${subject.path} \`${subject.field}\` is ${humanDuration(ageSeconds)} old (${value}); the lane declares every ${humanDuration(subject.cadenceSeconds)} and ${DEFAULT_FOLD_CONFIG.stalenessFactor} missed ticks is ${humanDuration(limit)}. ${subject.why}`,
    };
  }
  return {
    ...base,
    state: "fresh",
    ok: true,
    ageSeconds,
    detail: `${subject.path} \`${subject.field}\` is ${humanDuration(ageSeconds)} old, inside the ${humanDuration(limit)} window`,
  };
}

export function auditFreshness(
  roster: readonly FreshnessSubject[],
  read: (path: string) => string | null,
  nowMs: number,
): readonly FreshnessVerdict[] {
  return roster.map((s) => classifyFreshness(s, read(s.path), nowMs));
}

// ─── The edge ───────────────────────────────────────────────────────────────

function readOrNull(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

function main(argv: readonly string[]): number {
  const root = resolve(process.env["REPO_ROOT"] ?? process.cwd());
  const nowArgIndex = argv.indexOf("--now");
  const nowRaw = nowArgIndex === -1 ? null : (argv[nowArgIndex + 1] ?? null);
  const nowMs = nowRaw === null ? Date.now() : Date.parse(nowRaw);
  if (Number.isNaN(nowMs)) {
    console.error(`--now is not an instant: ${JSON.stringify(nowRaw)}`);
    return 2;
  }

  const verdicts = auditFreshness(FRESHNESS_ROSTER, (p) => readOrNull(resolve(root, p)), nowMs);

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ at: new Date(nowMs).toISOString(), verdicts }, null, 2));
  } else {
    for (const v of verdicts) {
      console.log(`${v.ok ? "ok  " : "RED "} ${v.id.padEnd(18)} ${v.state.padEnd(22)} ${v.detail}`);
    }
  }

  const bad = verdicts.filter((v) => !v.ok);
  for (const v of bad) {
    console.error(`::error title=Stale published artifact (${v.id})::${v.detail}`);
  }
  if (bad.length === 0) {
    console.error(`ok: ${verdicts.length} published artifact(s) carry a recent timestamp`);
    return 0;
  }
  console.error(`NOT OK: ${bad.length} of ${verdicts.length} published artifact(s) are not fresh`);
  return 1;
}

if (import.meta.main) {
  process.exit(main(Bun.argv.slice(2)));
}
