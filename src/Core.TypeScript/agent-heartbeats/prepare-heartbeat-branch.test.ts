import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { prepareHeartbeatBranch } from "./prepare-heartbeat-branch";

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function fixture(): { readonly root: string; readonly work: string } {
  const root = mkdtempSync(join(tmpdir(), "zeta-heartbeat-accumulate-"));
  roots.push(root);
  git(root, "init", "--bare", "origin.git");
  git(root, "clone", join(root, "origin.git"), "work");
  const work = join(root, "work");
  git(work, "config", "user.name", "test");
  git(work, "config", "user.email", "test@example.invalid");
  git(work, "switch", "-c", "main");
  writeFileSync(join(work, "base.txt"), "base\n");
  git(work, "add", "base.txt");
  git(work, "commit", "-m", "base");
  git(work, "push", "-u", "origin", "main");
  return { root, work };
}

function commitFile(work: string, path: string, content: string, message: string): void {
  const full = join(work, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
  git(work, "add", path);
  git(work, "commit", "-m", message);
}

/**
 * The REPOSITORY's own `.gitattributes`, not a hand-written copy.
 *
 * The lane's merge semantics are declared there, so a fixture that restated them would keep
 * passing after someone deleted the real lines -- exactly the vacuity these tests exist to catch.
 */
const REPO_GITATTRIBUTES = readFileSync(join(import.meta.dir, "..", "..", "..", ".gitattributes"), "utf8");

/** Seed a fixture main with the shipped attributes, as the preparer's `checkout -B` would see them. */
function seedAttributes(work: string): void {
  commitFile(work, ".gitattributes", REPO_GITATTRIBUTES, "attributes");
  git(work, "push", "origin", "main");
}

function pushLane(work: string): void {
  git(work, "push", "--force-with-lease", "origin", "heartbeat/alexa");
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("prepareHeartbeatBranch", () => {
  it("starts a new lane from current main without staged state", () => {
    const { work } = fixture();
    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toEqual({
      ok: true,
      value: { head: "heartbeat/alexa", remoteFound: false, carried: false },
    });
    expect(git(work, "branch", "--show-current")).toBe("heartbeat/alexa");
  });

  it("carries multiple unflushed ticks when the mutable lane is rebuilt", () => {
    const { work } = fixture();
    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, "event-1.json", '{"tick":1}\n', "tick 1");
    pushLane(work);

    git(work, "switch", "main");
    const firstCarry = prepareHeartbeatBranch("alexa", work);
    expect(firstCarry).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });
    git(work, "commit", "-m", "carry tick 1");
    commitFile(work, "event-2.json", '{"tick":2}\n', "tick 2");
    pushLane(work);

    git(work, "switch", "main");
    const secondCarry = prepareHeartbeatBranch("alexa", work);
    expect(secondCarry).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });
    expect(readFileSync(join(work, "event-1.json"), "utf8")).toContain('"tick":1');
    expect(readFileSync(join(work, "event-2.json"), "utf8")).toContain('"tick":2');
    expect(git(work, "diff", "--cached", "--name-only").split("\n").sort()).toEqual(["event-1.json", "event-2.json"]);
  });

  it("does not restage a lane whose final tree already landed by squash", () => {
    const { work } = fixture();
    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, "event-1.json", '{"tick":1}\n', "tick 1");
    pushLane(work);

    git(work, "switch", "main");
    git(work, "merge", "--squash", "origin/heartbeat/alexa");
    git(work, "commit", "-m", "flush tick 1");
    git(work, "push", "origin", "main");

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { remoteFound: true, carried: false } });
    expect(readFileSync(join(work, "event-1.json"), "utf8")).toContain('"tick":1');
    expect(git(work, "diff", "--cached", "--name-only")).toBe("");
  });

  it("reports a content conflict and leaves the remote lane unchanged", () => {
    const { work } = fixture();
    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, "base.txt", "lane\n", "lane edit");
    pushLane(work);
    const remoteBefore = git(work, "rev-parse", "origin/heartbeat/alexa");

    git(work, "switch", "main");
    commitFile(work, "base.txt", "main\n", "main edit");
    git(work, "push", "origin", "main");

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("conflicting state was accepted");
    expect(result.error).toContain("carry unflushed heartbeat state failed");
    expect(git(work, "ls-remote", "origin", "refs/heads/heartbeat/alexa").split("\t")[0]).toBe(remoteBefore);
  });

  // --- PARTIAL FLUSH (2026-08-16 lane wedge) ------------------------------------------------
  // The pre-existing "already landed by squash" test above only covers a TOTAL flush. The lanes
  // wedged on the partial case: main lands a strict PREFIX of the lane's delta because the lane
  // keeps ticking while the flush PR is in flight.

  /** Drive main + lane to the exact divergence that wedged alexa/otto/soraya. */
  function partialFlush(work: string, path: string, main: string, lane: string): void {
    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, path, lane, "lane ticks past the flush snapshot");
    pushLane(work);

    git(work, "switch", "main");
    commitFile(work, path, main, "partial flush: only the snapshot reached main");
    git(work, "push", "origin", "main");
  }

  it("carries an append-only lane whose flush landed only a prefix", () => {
    const { work } = fixture();
    const p = "db/mutation-findings/alexa.jsonl";
    seedAttributes(work);
    partialFlush(work, p, '{"n":1}\n{"n":2}\n', '{"n":1}\n{"n":2}\n{"n":3}\n');

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });

    // `union` is exactly set-union here: nothing from either side is dropped, nothing duplicated.
    const lines = readFileSync(join(work, p), "utf8").split("\n").filter(Boolean);
    expect(lines).toEqual(['{"n":1}', '{"n":2}', '{"n":3}']);
    expect(lines).not.toContain("<<<<<<< HEAD");
  });

  it("carries the PR manifest, which is append-only but NOT lane-scoped", () => {
    // The path that wedged soraya at 02:43Z on 2026-08-17 (run 31988867656), after the three
    // declared paths were already merging clean. Distinct from the lane files above: two workflows
    // append to this one, so the single-writer argument does not apply. It is safe because rows are
    // append-only under a globally unique `pr_number`, and `pr-manifest-integrity` fails on a
    // duplicate key — so a union that ever duplicated a row would be caught by an existing check.
    const { work } = fixture();
    const p = "docs/github/prs/manifest.jsonl";
    seedAttributes(work);
    partialFlush(
      work,
      p,
      '{"pr_number":1}\n{"pr_number":2}\n',
      '{"pr_number":1}\n{"pr_number":2}\n{"pr_number":3}\n',
    );

    // Must be the lane the fixture actually pushed: with a different agent name `remoteFound` is
    // false, NO MERGE RUNS, and the assertions below pass without exercising the attribute at all.
    // The first draft of this test did exactly that and survived deleting the `.gitattributes`
    // line it exists to defend — vacuous, and caught by mutating the attribute away.
    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });

    const lines = readFileSync(join(work, p), "utf8").split("\n").filter(Boolean);
    expect(lines).toEqual(['{"pr_number":1}', '{"pr_number":2}', '{"pr_number":3}']);
    expect(lines).not.toContain("<<<<<<< HEAD");
  });

  it("carries the RS block log, which several lanes append to under a per-row writer", () => {
    // The path that wedged otto and soraya at 16:43Z on 2026-08-17 (run 32046921903), while the
    // flush outage had the lanes running many ticks ahead of main — which is precisely the
    // partial-flush window these attributes exist for.
    //
    // Distinct from the manifest above in what justifies it: there is no enforced uniqueness
    // check here. The argument is append-only (12/12 commits `+1 -0`) plus single-writer PER ROW
    // — the `agent` field names the lane that emitted the row, and a lane appends only its own.
    const { work } = fixture();
    const p = "data/rs-blocks.jsonl";
    seedAttributes(work);
    // Main holds another lane's row interleaved with this lane's flushed row; the lane has since
    // emitted one more of its own. Union must keep all three, in order, exactly once.
    partialFlush(
      work,
      p,
      '{"agent":"alexa","seq":1}\n{"agent":"otto","seq":1}\n',
      '{"agent":"alexa","seq":1}\n{"agent":"otto","seq":1}\n{"agent":"alexa","seq":2}\n',
    );

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });

    const lines = readFileSync(join(work, p), "utf8").split("\n").filter(Boolean);
    expect(lines).toEqual([
      '{"agent":"alexa","seq":1}',
      '{"agent":"otto","seq":1}',
      '{"agent":"alexa","seq":2}',
    ]);
    // The duplication fear made explicit: the two rows present on BOTH sides must appear once.
    // Git resolves an identical addition on both sides as one change; if that ever stopped being
    // true, this assertion is what catches it rather than a comment claiming it.
    expect(lines.filter((l) => l === '{"agent":"otto","seq":1}')).toHaveLength(1);
    expect(lines).not.toContain("<<<<<<< HEAD");
  });

  it("carries the drift-rate CI log when two lanes CREATED it independently", () => {
    // The path that wedged otto, alexa and soraya at 22:05Z and 22:24Z on 2026-08-22, plus the
    // alexa flush job, with `CONFLICT (add/add): Merge conflict in data/ci-runs.jsonl`.
    //
    // WHY THIS CASE IS NOT THE ONE ABOVE. Every other append-only path here is tested with main
    // holding a PREFIX of the lane's file, so the two sides overlap and the interesting question
    // is whether union duplicates the shared rows. Here the sides are DISJOINT: the path was four
    // hours old and had never reached main, so each lane created it from nothing with only its
    // own first row in it. There is no shared line at all, and no merge base — which is exactly
    // what `add/add` means and why this wedged the moment #13928 made the step actually commit.
    const { work } = fixture();
    const p = "data/ci-runs.jsonl";
    seedAttributes(work);
    partialFlush(
      work,
      p,
      '{"checkId":"agent-heartbeat","outcome":"green","lane":"otto"}\n',
      '{"checkId":"agent-heartbeat","outcome":"green","lane":"alexa"}\n',
    );

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });

    // Neither lane's row may be dropped: the file is the denominator of the drift rate, so a
    // silently-lost row understates how much CI actually ran.
    const lines = readFileSync(join(work, p), "utf8").split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines).toContain('{"checkId":"agent-heartbeat","outcome":"green","lane":"otto"}');
    expect(lines).toContain('{"checkId":"agent-heartbeat","outcome":"green","lane":"alexa"}');
    expect(lines).not.toContain("<<<<<<< HEAD");
  });

  it("keeps a regenerated snapshot parseable when both sides rewrote it", () => {
    const { work } = fixture();
    const p = "docs/observe-events/.rs-buffer-alexa.json";
    seedAttributes(work);
    // Single-line whole-file rewrites. `union` would concatenate them into two objects; the
    // assertion below is what makes that wrong answer fail instead of merely looking merged.
    partialFlush(work, p, '{"buffer":[1,2],"seq":2}', '{"buffer":[1,2,3],"seq":3}');

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });

    const merged = readFileSync(join(work, p), "utf8");
    expect(() => JSON.parse(merged) as unknown).not.toThrow();
    expect(JSON.parse(merged) as unknown).toEqual({ buffer: [1, 2, 3], seq: 3 });
  });

  it("registers the theirs driver, which git does not provide", () => {
    const { work } = fixture();
    seedAttributes(work);
    expect(prepareHeartbeatBranch("alexa", work).ok).toBe(true);
    // Without this, `merge=theirs` is silently ignored and the snapshot paths keep wedging --
    // the attributes block alone is NOT the fix.
    expect(git(work, "config", "--local", "merge.theirs.driver")).toBe("cp -f -- %B %A");
  });

  it("carries a PR shard both sides CREATED, keeping one whole record", () => {
    // The shape that wedged soraya at 00:17Z on 2026-08-18: `CONFLICT (add/add)`, not a content
    // conflict. Both branches created the same shard, so the merge base has NEITHER side — which
    // is why this needs its own case instead of reusing `partialFlush` (that helper seeds the
    // path on main first, producing the content-conflict shape this one is specifically not).
    const { work } = fixture();
    const p = "docs/github/prs/shards/009/080000000000000078030000000023dc.json";
    seedAttributes(work);

    // Byte-for-byte the live divergence: same record, two spellings of the wall clock.
    const shard = (fetchedAt: string, commitSha: string): string =>
      `${JSON.stringify({ pr_number: 9180, archive_path: "docs/history/pr-reviews/PR-9180.md", source_ids: [], fetched_at: fetchedAt, schema_version: "v1", commit_sha: commitSha, title: "feat(hall): LLMTV society grid" }, null, 2)}\n`;

    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, p, shard("2026-08-17T13:47:37.443Z", "8ca0ad39"), "lane creates the shard");
    pushLane(work);

    git(work, "switch", "main");
    commitFile(work, p, shard("2026-07-02T18:35:46.863Z", "764d57a2"), "main creates the same shard");
    git(work, "push", "origin", "main");

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });

    // The point of `theirs` over `union` here: the result must be ONE parseable record, not two
    // concatenated objects. Asserting `JSON.parse` is what makes the wrong driver fail loudly.
    const merged = readFileSync(join(work, p), "utf8");
    const parsed = JSON.parse(merged) as { pr_number: number; title: string; archive_path: string };
    expect(parsed.pr_number).toBe(9180);
    // The substantive fields are identical on both sides, so they must survive whichever side won.
    expect(parsed.title).toBe("feat(hall): LLMTV society grid");
    expect(parsed.archive_path).toBe("docs/history/pr-reviews/PR-9180.md");
    expect(merged).not.toContain("<<<<<<< HEAD");
  });

  it("carries a PR review archive both sides CREATED, keeping the copy that HAS the threads", () => {
    // The shape that wedged soraya from 05:11Z on 2026-08-18 (run 32104099738): `CONFLICT
    // (add/add)` on docs/history/pr-reviews/PR-####-*.md. Same add/add family as the shard case
    // above, so it likewise cannot reuse `partialFlush`.
    //
    // This case exists to pin the MERGE DIRECTION, which is the thing that was gotten backwards
    // when this path was first left undeclared. `prepareHeartbeatBranch` checks out main and
    // merges the lane, so `theirs` is the LANE. The lane is the side holding the review threads;
    // main's copy is the stale, thread-less one. If the direction were ever reversed, the
    // `PRRT_` assertion below fails — which is the whole point of asserting on the thread id
    // rather than on file size.
    const { work } = fixture();
    const p = "docs/history/pr-reviews/PR-9181-feat-core-schedulerzeta-weak-fixed-point.md";
    seedAttributes(work);

    // Abridged from the live pair: main records zero threads, the lane records a real one.
    const mainCopy = "# PR 9181\n\n## Review threads\n\n_none recorded_\n";
    const laneCopy = "# PR 9181\n\n## Review threads\n\n- PRRT_kwDOSF9kNM6N_x6l on src/Core/SchedulerZeta.fs\n";

    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, p, laneCopy, "lane archives the review WITH its thread");
    pushLane(work);

    git(work, "switch", "main");
    commitFile(work, p, mainCopy, "main archives the same review, threads not fetched");
    git(work, "push", "origin", "main");

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });

    const merged = readFileSync(join(work, p), "utf8");
    // The load-bearing assertion: the recorded thread survives. Taking main's side would lose it.
    expect(merged).toContain("PRRT_kwDOSF9kNM6N_x6l");
    expect(merged).not.toContain("_none recorded_");
    expect(merged).not.toContain("<<<<<<< HEAD");
  });


  it("carries a ci-runs log both sides CREATED, keeping every row exactly once", () => {
    // The shape that took ALL THREE lanes down at 22:05Z on 2026-08-22 (runs 32601483043,
    // 32602358227): `CONFLICT (add/add): Merge conflict in data/ci-runs.jsonl`. Third add/add
    // member, and the first caused by a file ARRIVING on main -- #13935 made the drift-rate
    // append actually commit, so the file reached main at 21:54:47Z and both sides had then
    // independently created it. So this cannot reuse `partialFlush` either.
    //
    // `union`, not `theirs`, and the assertions below are what force that: this is an
    // append-only log with rows from DIFFERENT lanes, so taking one side drops the other's
    // records. The live divergence, byte-for-byte -- main holds soraya's two flushed rows, the
    // alexa lane holds its own row, and the merge must end up with all three.
    const { work } = fixture();
    const p = "data/ci-runs.jsonl";
    seedAttributes(work);

    const row = (lane: string, at: string, runId: string): string =>
      `${JSON.stringify({ checkId: "agent-heartbeat", outcome: "green", at, lane, runId })}\n`;
    const soraya1 = row("soraya", "2026-08-22T21:26:28.533Z", "32599512363");
    const soraya2 = row("soraya", "2026-08-22T21:40:41.897Z", "32600184721");
    const alexa1 = row("alexa", "2026-08-22T21:55:02.782Z", "32600831751");

    git(work, "switch", "-c", "heartbeat/alexa");
    // The lane also carries soraya1 to exercise the partial-flush overlap: an addition IDENTICAL
    // on both sides must survive as ONE row. If union ever duplicated it, the count below is 4.
    commitFile(work, p, `${soraya1}${alexa1}`, "lane records its own tick");
    pushLane(work);

    git(work, "switch", "main");
    commitFile(work, p, `${soraya1}${soraya2}`, "main receives an earlier lane's flush");
    git(work, "push", "origin", "main");

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });

    const merged = readFileSync(join(work, p), "utf8");
    expect(merged).not.toContain("<<<<<<< HEAD");
    const lines = merged.split("\n").filter((l) => l !== "");
    // Every row present exactly once: nothing dropped (which `theirs` would do to soraya2) and
    // nothing duplicated (which is union's only real failure mode).
    expect(lines.length).toBe(3);
    expect(new Set(lines).size).toBe(3);
    for (const r of [soraya1, soraya2, alexa1]) expect(merged).toContain(r.trim());
    // Still one JSON object per line -- a concatenation would make the log unparseable.
    for (const l of lines) expect(() => JSON.parse(l) as unknown).not.toThrow();
  });
  it("still refuses a conflict outside the declared lane paths", () => {
    const { work } = fixture();
    seedAttributes(work);
    // Same partial-flush shape on an undeclared path: backpressure must survive the fix.
    partialFlush(work, "shared/report.md", "main line\n", "lane line\n");

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("an undeclared conflicting path was auto-resolved");
    expect(result.error).toContain("carry unflushed heartbeat state failed");
  });

  it("rejects an unsafe lane name as a value", () => {
    const { work } = fixture();
    expect(prepareHeartbeatBranch("../../main", work)).toEqual({
      ok: false,
      error: "agent must be one safe branch component; got ../../main",
    });
  });
});
