#!/usr/bin/env bun
/**
 * retire-superseded-flush-prs.ts — close the flush PRs a newer flush replaced.
 *
 * Every tick snapshots the mutable lane `heartbeat/<agent>` onto an immutable
 * `heartbeat/<agent>-flush-<sha>` ref and opens a PR from it. Nothing ever
 * retired the previous one, so the open set grew monotonically: on 2026-08-17
 * eight heartbeat PRs were open at once, three of them for the same lane, with
 * #11362 (05:48) and #11394 (08:21) still sitting there hours later.
 *
 * That is not merely untidy. A superseded flush PR is unmergeable in practice —
 * its snapshot is behind, its gate may never even start (#11369, #11426 both
 * had ZERO gate runs, ever) — and `required-check-started` then fails the whole
 * flush job on account of a PR nobody intends to land. One abandoned PR took the
 * live telemetry lane red every ~25 minutes until it was closed by hand.
 *
 * WHY CLOSING LOSES NOTHING, and why that is a claim this file has to earn.
 *
 * The snapshots are not ancestors of each other: a later flush ref does NOT
 * contain an earlier one (verified — #11373 did not contain #11369's commits).
 * What makes retirement safe is the LANE, not the snapshot chain. Each tick
 * rebuilds `heartbeat/<agent>` carrying "any prior unflushed lane delta over
 * current main", so an unlanded flush's payload is re-accumulated into the next
 * tick's snapshot. Measured on both PRs closed by hand: main ended up a strict
 * superset of the abandoned PR's append-only findings log (60 lines vs 59, and
 * 49 vs 48, zero lines missing in each case), with the content-addressed event
 * files present under identical ZetaId names.
 *
 * That argument only holds while a REPLACEMENT IS ACTUALLY OPEN. So the keeper
 * must be present in the open set before anything is retired — see
 * `supersededFlushPrs`, which returns nothing at all when it is absent. Closing
 * the old PR when the new one failed to open would strand the delta behind a
 * closed PR with no live path to main, which is the one outcome worse than
 * accumulation.
 *
 * Closing is reversible (reopen); deleting a snapshot ref is not, so this tool
 * does not delete refs. The immutable snapshot stays as the recovery copy.
 */
export interface OpenFlushPr {
  readonly number: number;
  readonly headRef: string;
  readonly createdAt: string;
}

export interface FlushRefParts {
  readonly agent: string;
  readonly sha: string;
}

/**
 * Parse `heartbeat/<agent>-flush-<sha>`. Returns null for anything else —
 * including the mutable lane `heartbeat/<agent>` itself, which must never be
 * mistaken for a disposable snapshot.
 *
 * `<agent>` is matched non-greedily up to the LAST `-flush-`, so an agent name
 * containing the literal `-flush-` cannot smuggle a different lane past the
 * same-agent check below.
 */
export function parseFlushRef(headRef: string): FlushRefParts | null {
  if (!headRef.startsWith("heartbeat/")) return null;
  const rest = headRef.slice("heartbeat/".length);
  const marker = rest.lastIndexOf("-flush-");
  if (marker <= 0) return null;
  const agent = rest.slice(0, marker);
  const sha = rest.slice(marker + "-flush-".length);
  if (agent === "" || !/^[0-9a-f]{7,40}$/.test(sha)) return null;
  return { agent, sha };
}

/**
 * The flush PRs for `agent` that `keepSha` supersedes.
 *
 * Returns EMPTY when no open PR carries `keepSha`: the replacement must exist
 * before its predecessors are retired. This is the guard, not an optimisation.
 */
export function supersededFlushPrs(
  prs: readonly OpenFlushPr[],
  agent: string,
  keepSha: string,
): readonly number[] {
  const forAgent = prs
    .map((pr) => ({ pr, parts: parseFlushRef(pr.headRef) }))
    .filter((x): x is { pr: OpenFlushPr; parts: FlushRefParts } => x.parts !== null)
    .filter((x) => x.parts.agent === agent);

  const keeperPresent = forAgent.some((x) => x.parts.sha === keepSha);
  if (!keeperPresent) return [];

  return forAgent.filter((x) => x.parts.sha !== keepSha).map((x) => x.pr.number);
}

export interface GhResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function main(argv: readonly string[]): Promise<number> {
  const read = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const agent = read("--agent");
  const keepSha = read("--keep-sha");
  const dryRun = argv.includes("--dry-run");
  if (agent === undefined || keepSha === undefined) {
    process.stderr.write("retire-superseded-flush-prs: --agent and --keep-sha are required\n");
    return 2;
  }

  const { spawnSync } = await import("node:child_process");
  const listed = spawnSync(
    "gh",
    ["pr", "list", "--state", "open", "--json", "number,headRefName,createdAt", "--limit", "100"],
    { encoding: "utf8" },
  );
  if ((listed.status ?? -1) !== 0) {
    process.stderr.write(listed.stderr || "retire-superseded-flush-prs: gh pr list failed\n");
    return 2;
  }

  const open = JSON.parse(listed.stdout) as readonly {
    number: number;
    headRefName: string;
    createdAt: string;
  }[];
  const superseded = supersededFlushPrs(
    open.map((p) => ({ number: p.number, headRef: p.headRefName, createdAt: p.createdAt })),
    agent,
    keepSha,
  );

  if (superseded.length === 0) {
    process.stdout.write(`[retire] ${agent}: nothing superseded by ${keepSha.slice(0, 10)}\n`);
    return 0;
  }
  if (dryRun) {
    process.stdout.write(`[retire] ${agent}: would close ${superseded.map((n) => `#${n}`).join(", ")}\n`);
    return 0;
  }

  let failures = 0;
  for (const number of superseded) {
    const comment =
      `Superseded by the newer flush for \`heartbeat/${agent}\` at \`${keepSha.slice(0, 10)}\`, ` +
      `closed automatically to stop abandoned flush PRs accumulating.\n\n` +
      `No telemetry is lost: each tick rebuilds the lane carrying any prior unflushed delta over ` +
      `current main, so this PR's payload is re-accumulated into the snapshot that replaced it. ` +
      `The immutable \`heartbeat/${agent}-flush-*\` ref is left in place as a recovery copy — ` +
      `this tool never deletes refs. Reopen if that reading is wrong.`;
    const closed = spawnSync("gh", ["pr", "close", String(number), "--comment", comment], {
      encoding: "utf8",
    });
    if ((closed.status ?? -1) !== 0) {
      // Report and keep going: one un-closable PR must not strand the rest.
      process.stderr.write(`[retire] ${agent}: could not close #${number}: ${closed.stderr}\n`);
      failures += 1;
      continue;
    }
    process.stdout.write(`[retire] ${agent}: closed #${number} (superseded)\n`);
  }
  return failures === 0 ? 0 : 1;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(2);
    },
  );
}
