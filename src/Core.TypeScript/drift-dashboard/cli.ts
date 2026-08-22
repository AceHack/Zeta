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
 *                                                  [--repo owner/name] [--write] [--exit-zero]
 *
 * Exit status is 1 when anything is red, anything is unknown, coverage fell short, or
 * a producer failed. An unobserved check is an unbounded number of unknown failures,
 * so it fails the pass; `--exit-zero` exists for report-generation jobs that must
 * still publish the artifact.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { GitHubAdapter } from "../forge-host/github/github-adapter.ts";
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
}

function parseArgs(argv: readonly string[]): Args {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  return {
    ref: get("--ref") ?? "main",
    // DoP=1 is the DEFAULT, not a fallback: at 1 the pass is a single cooperative loop
    // and therefore deterministic and replayable. Raising it is a throughput choice.
    dop: Math.max(1, Number(get("--dop") ?? "1")),
    offline: argv.includes("--offline"),
    repo: get("--repo"),
    write: argv.includes("--write"),
    exitZero: argv.includes("--exit-zero"),
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
      }
    } else {
      sourceErrors.push(`${source.sourceName}: could not enumerate check definitions: ${defs.error.kind}: ${defs.error.message}`);
    }
  }

  roster = mergeDefinitions(roster, definitions, now);
  const report = foldDashboard({ roster, observations, failures, sourceErrors, now });

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
    console.log(`wrote ${ROSTER_PATH}, ${MARKDOWN_PATH}, ${HTML_PATH}, ${JSON_PATH}`);
  } else {
    console.log(renderMarkdown(report));
  }

  console.error(headline(report));
  return args.exitZero || report.ok ? 0 : 1;
}

if (import.meta.main) {
  process.exit(await main());
}
