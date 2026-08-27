#!/usr/bin/env bun
/**
 * drift-dashboard/cli.ts — run one observation pass and render the dashboard.
 *
 * The edge: all I/O and the only clock read in the whole feature. Everything that
 * DECIDES anything lives in `fold.ts`, which is pure and takes `now` as an argument —
 * so a pass replays deterministically (DST) and local wall-clock never reaches the
 * result (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
 *
 * Producers are resolved through the **forge-host plugin interface**, not named here:
 * GitHub is *a* forge host and the destination is **sovereign mode**, with author/
 * verifier agent attestations as a future `CheckObservationSource`. `--offline` runs
 * the whole pipeline with NO producer at all, off the persisted roster alone — which is
 * both a useful mode and a standing demonstration that the core does not need a forge
 * host to work.
 *
 *   bun src/Core.TypeScript/drift-dashboard/cli.ts [--ref main] [--dop 8] [--offline]
 *                              [--repo owner/name] [--write] [--exit-zero] [--timing]
 *
 * `--timing` prints the wall time, the gh-call count and calls-per-check. It exists
 * because the first performance report on this tool INFERRED the bottleneck from a CPU
 * percentage and was wrong; a tool built on "measure, do not infer" should hand you the
 * number rather than make you reconstruct it.
 *
 * Exit status is 1 when anything is red, anything is unknown, coverage fell short, or
 * a producer failed. An unobserved check is an unbounded number of unknown failures,
 * so it fails the pass; `--exit-zero` exists for report-generation jobs that must
 * still publish the artifact.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { GitHubAdapter } from "../forge-host/github/github-adapter.ts";
import { ghCallStats } from "../forge-host/github/gh-cli.ts";
import type {
  CheckDefinition,
  CheckObservation,
  CheckObservationFailure,
  CheckObservationSource,
} from "../forge-host/index.ts";
import { foldDashboard, headline, triggerMatchesExpectation } from "./fold.ts";
import { renderHtml, renderJson, renderMarkdown } from "./render.ts";
import { loadRoster, mergeDefinitions, recordObservations, saveRoster } from "./roster.ts";

const ROSTER_PATH = "db/drift-dashboard/roster.json";
const MARKDOWN_PATH = "docs/DRIFT-DASHBOARD.md";
const HTML_PATH = "data/drift-dashboard.html";
const JSON_PATH = "data/drift-dashboard.json";

interface Args {
  readonly ref: string;
  readonly dop: number;
  readonly offline: boolean;
  readonly repo: string | null;
  readonly write: boolean;
  readonly exitZero: boolean;
  readonly repoRoot: string;
  readonly timing: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  return {
    ref: get("--ref") ?? "main",
    // **DoP 8 by default; determinism is `--dop 1`, and that is the right way round.**
    //
    // `.claude/rules/async-all-the-way-truthful-signatures.md` requires the knob to
    // DEGRADE to 1, not to DEFAULT to 1 — and defaulting to 1 made this tool unusable
    // interactively: its first user timed out at 400s on the default and went back to
    // their own scan. A guard slower than the unsafe path selects for the unsafe path.
    //
    // The determinism claim survives the swap because it was checked rather than
    // assumed: DoP=1 and DoP=12 produce byte-identical row order against the live repo
    // (the fold sorts ordinally, so the report is a function of the observation SET,
    // never of completion order). `--dop 1` remains the single cooperative loop for
    // replay.
    // 16 measured on the live repo: 87 calls take 19.4s at DoP=1-equivalent serial
    // cost, 9.3s at 8, 4.6s at 16, 3.9s at 24 — and cumulative gh time is FLAT across
    // all of them (60.6s / 60.7s / 60.8s), so parallelism is buying real overlap and
    // not provoking a rate-limit penalty. 16 is the knee; past it the curve flattens.
    dop: Math.max(1, Number(get("--dop") ?? "16")),
    offline: argv.includes("--offline"),
    repo: get("--repo"),
    write: argv.includes("--write"),
    exitZero: argv.includes("--exit-zero"),
    timing: argv.includes("--timing"),
    repoRoot: resolve(get("--repo-root") ?? process.cwd()),
  };
}

function detectRepo(): string {
  const proc = Bun.spawnSync(["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  const out = new TextDecoder().decode(proc.stdout).trim();
  if (proc.exitCode !== 0 || out === "") throw new Error("could not detect repo; pass --repo owner/name");
  return out;
}

async function main(): Promise<number> {
  const args = parseArgs(Bun.argv.slice(2));
  // The ONE clock read. Injected into the fold from here and nowhere else.
  const now = new Date().toISOString();

  const rosterPath = join(args.repoRoot, ROSTER_PATH);
  let roster = loadRoster(rosterPath, args.ref, now);

  let definitions: readonly CheckDefinition[] = [];
  let observations: readonly CheckObservation[] = [];
  let failures: readonly CheckObservationFailure[] = [];
  const sourceErrors: string[] = [];
  // Sources we could not ask AT ALL. Kept separate from the sentences above because
  // the fold needs the KEY — to refuse to judge every check that belongs to the source
  // — not the prose.
  const blindSources: string[] = [];

  if (!args.offline) {
    const nwo = args.repo ?? detectRepo();
    const source: CheckObservationSource = new GitHubAdapter(
      nwo.split("/")[0] ?? "",
      nwo.split("/")[1] ?? "",
      { repoRoot: args.repoRoot, checkRef: args.ref },
    );

    const defs = await source.listCheckDefinitions();
    if (defs.ok) {
      definitions = defs.value;
      const pass = await source.listLatestCheckObservations(args.ref, definitions, {
        maxDegreeOfParallelism: args.dop,
      });
      if (pass.ok) {
        observations = pass.value.observations;
        failures = pass.value.failures;
      } else {
        // Could not learn ANYTHING this pass. Recorded as a source error, which makes
        // the report NOT OK — a pass that failed must never look like a pass that
        // found nothing wrong.
        sourceErrors.push(`${source.sourceName}: observation pass failed: ${pass.error.kind}: ${pass.error.message}`);
        blindSources.push(source.sourceName);
      }
    } else {
      sourceErrors.push(`${source.sourceName}: could not enumerate check definitions: ${defs.error.kind}: ${defs.error.message}`);
      blindSources.push(source.sourceName);
    }
  }

  roster = mergeDefinitions(roster, definitions, now);
  const report = foldDashboard({ roster, observations, failures, sourceErrors, blindSources, now });

  roster = recordObservations(
    roster,
    new Map(
      observations.map((o) => {
        const entry = roster.checks.find((c) => c.checkId === o.checkId);
        return [
          o.checkId,
          {
            observedAt: o.observedAt,
            kind: o.verdict.kind,
            viaDeclaredTrigger:
              entry !== undefined && triggerMatchesExpectation(o.trigger, entry.expectation),
          },
        ] as const;
      }),
    ),
  );

  // STDOUT IS ALWAYS THE REPORT — `--write` ADDS files, it does not DIVERT the report.
  //
  // It used to replace it: under `--write`, stdout carried the single line
  // `wrote db/…, docs/…, data/…`. The cadence workflow does
  // `cli.ts … --write > dashboard.md` and then `cat dashboard.md >> $GITHUB_STEP_SUMMARY`,
  // so the job summary — the surface the workflow's own header calls the reason the
  // lane exists, "the answer is in the run itself and not only in an artifact" — was
  // that one line, every tick, for as long as the lane has existed. The receipt is a
  // side note and belongs on stderr with the other side notes.
  console.log(renderMarkdown(report));
  if (args.write) {
    saveRoster(rosterPath, roster);
    for (const [rel, text] of [
      [MARKDOWN_PATH, renderMarkdown(report)],
      [HTML_PATH, renderHtml(report)],
      [JSON_PATH, renderJson(report)],
    ] as const) {
      const abs = join(args.repoRoot, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, text, "utf8");
    }
    console.error(`wrote ${ROSTER_PATH}, ${MARKDOWN_PATH}, ${HTML_PATH}, ${JSON_PATH}`);
  }

  if (args.timing) {
    const wallMs = Date.now() - Date.parse(now);
    console.error(
      `timing: ${(wallMs / 1000).toFixed(1)}s wall · ${ghCallStats.calls} api calls (${ghCallStats.fetches} via fetch, ${ghCallStats.spawns} via subprocess) ` +
        `(${(ghCallStats.totalMs / 1000).toFixed(1)}s cumulative, DoP=${args.dop}) ` +
        `· ${(ghCallStats.calls / Math.max(roster.checks.length, 1)).toFixed(2)} calls/check`,
    );
  }
  // A SWALLOWED ERROR CHANNEL. `sourceErrors` was collected, counted in the headline
  // ("SOURCE ERRORS 1") and rendered into artifacts nobody opens — and its TEXT reached
  // no log. The one line that would have named the 2026-08-27 outage in the run's own
  // output ("auth-failure: no GitHub token in …") existed the whole time and was never
  // printed. A count is not a diagnosis.
  for (const e of report.sourceErrors) console.error(`::error title=drift-dashboard source error::${e}`);
  console.error(headline(report));
  return args.exitZero || report.ok ? 0 : 1;
}

if (import.meta.main) {
  process.exit(await main());
}
