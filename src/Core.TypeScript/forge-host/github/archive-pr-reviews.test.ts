/**
 * archive-pr-reviews — non-vacuity probes for the heartbeat backfill step.
 *
 * The defect these exist to prevent recurring (081M005VXY6087G0R001T04ATY):
 * `agent-heartbeat.yml` invoked this tool with `--batch 3`, a flag the parser has
 * never accepted, so every tick died at argument parsing having archived nothing —
 * and the `| tail -10` pipeline swallowed the exit code so the step reported
 * success anyway. The first test below would have failed on day one.
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { extractInvocations } from "../../hygiene/audit-workflow-cli-flags.ts";
import { WRITE_TARGETS, normalizeSince, selectBatch } from "./archive-pr-reviews.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..", "..");
const TOOL = "src/Core.TypeScript/forge-host/github/archive-pr-reviews.ts";
const WORKFLOW = join(REPO_ROOT, ".github", "workflows", "agent-heartbeat.yml");

// NODE BUILTINS + REPO-LOCAL MODULES ONLY — no `yaml`, no external package.
// `pr-manifest-integrity.yml` runs this directory with NO `bun install` by design,
// and an earlier revision of this file imported `yaml` to parse the workflow, which
// turned that job red. The step's `run:` block is located by text instead. The
// argv is extracted by the SAME `extractInvocations` the lint uses, so the test
// exercises the real code path rather than a parallel regex that could drift.

/**
 * Slice the archive step's `run:` block out of the workflow by text.
 *
 * A YAML parser would be tidier; it is not available in the job that runs this file.
 * The step boundary is unambiguous anyway: steps are a `- name:` list at a fixed
 * indent, so the block runs from this step's `- name:` to the next one.
 */
function archiveStepRunBlock(): string {
  const lines = readFileSync(WORKFLOW, "utf8").split("\n");
  const start = lines.findIndex((l) => /^\s*- name: Archive PR review history/.test(l));
  if (start === -1) throw new Error("archive step not found in agent-heartbeat.yml");
  const indent = (lines[start] ?? "").indexOf("- name:");
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.trimEnd().length > 0 && line.indexOf("- name:") === indent) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/** The literal argv this workflow hands to the archive tool. */
function workflowArgvForTool(runBlock: string): string[] {
  const found = extractInvocations(runBlock).find((i) => i.tool === TOOL);
  return found?.args ?? [];
}

describe("heartbeat archive step is not vacuous", () => {
  test("the text-based step extraction is bounded and found the right step", () => {
    // Guards the extractor itself. Without a YAML parser the step boundary is found by
    // text, so this pins that it captured exactly ONE step: if the terminator regex ever
    // stops matching, the block would swallow the rest of the file and the assertions
    // below would start passing on other steps' content — vacuity by over-capture.
    const block = archiveStepRunBlock();
    expect(block).toContain("Archive PR review history");
    expect(block.match(/^\s*- name:/gm)?.length).toBe(1);
    expect(block).toContain("archive-pr-reviews.ts");
    // Bounded: the next step in the file must NOT be inside the block.
    expect(block).not.toContain("Attempt codegen work");
  });

  test("every flag the workflow passes is accepted by the REAL parser", () => {
    const argv = workflowArgvForTool(archiveStepRunBlock());
    expect(argv.length).toBeGreaterThan(0);

    // `--help` is appended so the parser runs to completion on the workflow's own
    // argv and then exits 0 WITHOUT making any `gh` call. Arg parsing happens in
    // order, so any unaccepted flag still exits 1 before `--help` is reached.
    // This executes the actual parser rather than approximating it with a regex.
    const result = spawnSync("bun", [TOOL, ...argv, "--help"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });

    expect(result.stderr ?? "").not.toContain("unknown arg");
    expect(result.status).toBe(0);
  });

  test("the known-bad historical argv is genuinely rejected (probe is not vacuous)", () => {
    // If this ever exits 0, the probe above has stopped discriminating and is
    // worthless — it would pass no matter what the workflow said.
    const result = spawnSync(
      "bun",
      [TOOL, "--owner", "Lucent-Financial-Group", "--repo", "Zeta", "--batch", "3", "--help"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr ?? "").toContain("unknown arg: --batch");
  });

  test("the step does not mask the tool's exit code behind a pipe", () => {
    const run = archiveStepRunBlock();
    // The original defect: `bun ...archive-pr-reviews.ts ... 2>&1 | tail -10 || echo`.
    // A pipeline's status is the last command's, so the failure vanished and the
    // `||` fallback was unreachable. Require an explicit exit-code check instead.
    const joined = run.replace(/\\\r?\n\s*/g, " ");
    const invocation = new RegExp(`bun\\s+${TOOL}[^\\n]*`).exec(joined)?.[0] ?? "";
    expect(invocation).not.toMatch(/\|\s*tail/);
    expect(run).toMatch(/ARCHIVE_RC=\$\?/);
    expect(run).toMatch(/ARCHIVE_RC["}\s]*-ne 0|ARCHIVE_RC" -ne 0/);
  });

  test("the step actually asks for work: --all-merged with a bound", () => {
    const argv = workflowArgvForTool(archiveStepRunBlock());
    // Without --all-merged and without a PR number the tool returns 1 ("must provide
    // PR number or --all-merged"); a bound is what keeps a 30-minute tick sane.
    expect(argv).toContain("--all-merged");
    expect(argv).toContain("--limit");
  });
});

/**
 * THE STEP MUST COMMIT WHAT THE TOOL WROTE — all of it, not just the index.
 *
 * The defect (081M00GCA8P087G0R000M00W9S): the step ran `git add docs/github/prs/`,
 * which is the shard store plus the derived index, and never staged
 * `docs/history/pr-reviews/`, which is where the archive BODIES go. The shard is a
 * pointer; staging the pointer and dropping the target commits an index entry whose
 * `archive_path` names a file that is not in the tree.
 *
 * It is self-sealing, which is what makes it worth a test rather than a one-line fix:
 * `selectBatch` skips any PR that already has a shard, so a PR processed by the broken
 * step is marked done, has no body, and is never re-selected by `--all-merged`.
 *
 * These probes derive the required pathspecs from the tool's exported `WRITE_TARGETS`,
 * so adding a new output directory to the tool fails here until the step stages it too
 * — the class is closed, not the one instance.
 */
describe("heartbeat archive step commits every path the tool writes", () => {
  /** The pathspecs on the step's `git add` lines, with line-continuations folded. */
  function gitAddPathspecs(runBlock: string): string[] {
    const joined = runBlock.replace(/\\\r?\n\s*/g, " ");
    const specs: string[] = [];
    for (const line of joined.split("\n")) {
      const m = /^\s*git add\s+(.+)$/.exec(line);
      if (!m) continue;
      for (const tok of (m[1] ?? "").split(/\s+/)) {
        if (tok.length > 0 && !tok.startsWith("-") && !tok.startsWith("|")) specs.push(tok);
      }
    }
    return specs;
  }

  const covers = (specs: string[], target: string): boolean =>
    specs.some((s) => {
      const spec = s.replace(/\/$/, "");
      return target === spec || target.startsWith(`${spec}/`);
    });

  test("every WRITE_TARGET is staged by the step's git add", () => {
    const specs = gitAddPathspecs(archiveStepRunBlock());
    expect(specs.length).toBeGreaterThan(0);
    for (const target of WRITE_TARGETS) {
      // Names the target in the failure message — a bare toBe(true) here would say
      // nothing about WHICH output directory is being dropped.
      expect({ target, staged: covers(specs, target) }).toEqual({ target, staged: true });
    }
  });

  test("the archive body directory specifically is staged", () => {
    // Pinned separately from the loop above: this is the one that was actually missing,
    // and the loop would still pass if WRITE_TARGETS were ever narrowed to hide it.
    const specs = gitAddPathspecs(archiveStepRunBlock());
    expect(WRITE_TARGETS).toContain("docs/history/pr-reviews");
    expect(covers(specs, "docs/history/pr-reviews")).toBe(true);
  });

  test("the commit guard sees the body directory too, including UNTRACKED files", () => {
    // `git diff --quiet` is blind to untracked files, and a fresh archive body is always
    // untracked. So the guard needs the `git ls-files -o` half AND that half must name
    // the body directory — otherwise the `git add` above is never reached on the exact
    // tick that has new archives and nothing else. (Proof the blindness is real, not
    // theoretical: this is also why the later codegen step's `git add -A`, gated on a
    // bare `git diff --quiet`, did not rescue the dropped bodies.)
    const run = archiveStepRunBlock();
    const joined = run.replace(/\\\r?\n\s*/g, " ");
    const guard = joined.split("\n").find((l) => l.includes("git ls-files -o")) ?? "";
    expect(guard).toContain("docs/history/pr-reviews/");
    expect(guard).toContain("docs/github/prs/");
  });

  test("probe is not vacuous: the historical git-add line fails these checks", () => {
    // Replant the exact pre-fix staging and show it dies. Without this, the three tests
    // above could be passing on a pathspec matcher that returns true for anything.
    const mutant = "            git add docs/github/prs/\n";
    const specs = gitAddPathspecs(mutant);
    expect(specs).toEqual(["docs/github/prs/"]);
    expect(covers(specs, "docs/github/prs/shards")).toBe(true); // index: still covered
    expect(covers(specs, "docs/history/pr-reviews")).toBe(false); // body: DROPPED
  });
});

describe("selectBatch — bounded drain, oldest first", () => {
  const archived = (set: Set<number>) => (pr: number) => set.has(pr);

  test("skips PRs that already have a shard", () => {
    const got = selectBatch([1, 2, 3, 4], "/unused", 2, archived(new Set([1, 2])));
    expect(got).toEqual([3, 4]);
  });

  test("takes the OLDEST n, not the newest", () => {
    const got = selectBatch([10, 20, 30, 40], "/unused", 2, archived(new Set()));
    expect(got).toEqual([10, 20]);
  });

  test("unbounded when no limit is given", () => {
    expect(selectBatch([3, 1, 2], "/unused", undefined, archived(new Set()))).toEqual([1, 2, 3]);
  });

  test("a backlog drains completely under repeated bounded ticks (anti-starvation)", () => {
    // The property that matters. Newest-first + a small cap re-picks the same head
    // every tick and never reaches the tail; oldest-first over a shrinking queue
    // guarantees every PR is eventually archived.
    const done = new Set<number>();
    const candidates = Array.from({ length: 50 }, (_, i) => i + 1);
    for (let tick = 0; tick < 100 && done.size < candidates.length; tick += 1) {
      for (const pr of selectBatch(candidates, "/unused", 3, archived(done))) done.add(pr);
    }
    expect(done.size).toBe(50);
  });

  test("returns empty once the backlog is drained (healthy steady state)", () => {
    const all = new Set([1, 2, 3]);
    expect(selectBatch([1, 2, 3], "/unused", 3, archived(all))).toEqual([]);
  });
});

describe("normalizeSince — the silent-zero-match trap", () => {
  const now = new Date("2026-08-14T12:00:00Z");

  test("'7d' becomes a real cutoff instead of matching nothing", () => {
    const cutoff = normalizeSince("7d", now);
    expect(cutoff).toBe("2026-08-07T12:00:00.000Z");
    // The original bug, pinned: a raw lexicographic compare against "7d" excluded
    // every ISO timestamp, so the sweep silently found zero PRs and exited 0.
    expect("2026-08-14T00:00:00Z" >= "7d").toBe(false);
    expect("2026-08-14T00:00:00Z" >= cutoff).toBe(true);
  });

  test("'24h' does not overflow into nonsense", () => {
    expect(normalizeSince("24h", now)).toBe("2026-08-13T12:00:00.000Z");
  });

  test("absolute dates pass through", () => {
    expect(normalizeSince("2026-07-01", now)).toBe("2026-07-01");
  });
});
