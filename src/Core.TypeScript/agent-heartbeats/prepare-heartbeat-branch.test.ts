import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { annotateFailure, isLosslessLineExtension, prepareHeartbeatBranch } from "./prepare-heartbeat-branch";

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
      value: { head: "heartbeat/alexa", remoteFound: false, carried: false, healed: [] },
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

  it("carries the tick-reasoning log when main holds a strict PREFIX it has no ancestor for", () => {
    // The path that wedged alexa from 23:42Z on 2026-08-26 (run 33024333706) with
    // `CONFLICT (add/add): Merge conflict in data/tick-reasoning.jsonl`, while otto and soraya
    // ticked GREEN on that same run.
    //
    // WHY THIS CASE IS NEITHER OF THE TWO ABOVE, and why the distinction is the whole bug. The
    // mutation-findings case has main holding a prefix WITH a shared ancestor; the ci-runs case
    // has the two sides DISJOINT with no ancestor. This one is the cross: the sides OVERLAP
    // heavily -- measured live, main's 16 rows are a strict subset of the lane's 30 -- and git
    // still calls it `add/add`, because the path first reached main in alexa's OWN flush
    // (18e00976d2, #15551) at 23:11Z, which is NEWER than the lane's merge base. Overlapping
    // content does not save you when the base has neither side.
    //
    // It is also why "just wait for the next tick" is not a fix: a failed tick never advances the
    // lane, so the base never moves past the flush, so the add/add reproduces every 15 minutes
    // until this line exists. Two hours of red proved that empirically.
    const { work } = fixture();
    const p = "data/tick-reasoning.jsonl";
    seedAttributes(work);
    // Main carries the flushed row PLUS a row this lane did not write, in the order a real flush
    // leaves behind: the lane's snapshot first, then another lane's later append. Live data is
    // single-lane today (16/16 rows are `"agent":"alexa"`), so otto's row is the forward-looking
    // half of the per-ROW single-writer argument the `.gitattributes` entry rests on.
    //
    // It is also what makes this test DISCRIMINATE between the two drivers this repo uses.
    // `merge=theirs` takes the lane wholesale and would silently DELETE otto's row while still
    // satisfying every other assertion below. Dropping this row would leave a test that cannot
    // tell `union` from `theirs`, which is the vacuity these tests exist to catch.
    partialFlush(
      work,
      p,
      '{"agent":"alexa","chosen":"work","at":"T1"}\n{"agent":"otto","chosen":"play","at":"T0"}\n',
      '{"agent":"alexa","chosen":"work","at":"T1"}\n{"agent":"alexa","chosen":"explore","at":"T2"}\n',
    );

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });

    // The already-flushed row must survive EXACTLY ONCE. An add/add union over overlapping sides
    // is the shape most likely to double a flushed row, and a doubled row would inflate the
    // denominator of `observe/decorrelation-meter.ts`, which reads this file one row per decision.
    const lines = readFileSync(join(work, p), "utf8").split("\n").filter(Boolean);
    expect(lines).toEqual([
      '{"agent":"alexa","chosen":"work","at":"T1"}',
      '{"agent":"otto","chosen":"play","at":"T0"}',
      '{"agent":"alexa","chosen":"explore","at":"T2"}',
    ]);
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines).not.toContain("<<<<<<< HEAD");
    // Every row must still PARSE: `union` on a whole-file JSON snapshot produces concatenated
    // objects, and this assertion is what distinguishes the append-only class from that one.
    for (const line of lines) expect(() => JSON.parse(line) as unknown).not.toThrow();
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

describe("annotateFailure", () => {
  // The VERBATIM stderr of the alexa preparer in run 33024333706, job 98362009835, whose only
  // annotation was `Process completed with exit code 1`.
  const LIVE_FAILURE =
    "carry unflushed heartbeat state failed: Auto-merging data/ci-runs.jsonl\n" +
    "Auto-merging data/tick-reasoning.jsonl\n" +
    "CONFLICT (add/add): Merge conflict in data/tick-reasoning.jsonl\n" +
    "Auto-merging db/mutation-findings/alexa.jsonl\n" +
    "Squash commit -- not updating HEAD\n" +
    "Automatic merge failed; fix conflicts and then commit the result.";

  it("carries the conflicting PATH into the annotation, which is the whole diagnosis", () => {
    const annotation = annotateFailure(LIVE_FAILURE);
    expect(annotation).toStartWith("::error title=heartbeat lane preparation failed::");
    // Naming the file is what turns a red run into a one-line remedy: declare the path in the
    // `.gitattributes` heartbeat block. An annotation that omitted it would be no better than
    // the exit code it replaces.
    expect(annotation).toContain("CONFLICT (add/add): Merge conflict in data/tick-reasoning.jsonl");
  });

  it("survives as ONE workflow command, so nothing after the first line is truncated", () => {
    const annotation = annotateFailure(LIVE_FAILURE);
    // A workflow command ends at a literal newline. The CONFLICT line is the THIRD line of the
    // real message, so an unencoded annotation would be cut before reaching it -- the failure
    // mode this encoding exists to prevent, and one a "contains the path" assertion alone would
    // not catch.
    expect(annotation).not.toContain("\n");
    expect(annotation.split("%0A")).toHaveLength(6);
  });

  it("escapes the percent sign before the newline, so an encoded body is not re-read", () => {
    // Order matters: escaping `\n` first and `%` second would rewrite the `%0A` just emitted into
    // `%250A`, and the annotation would render the escape instead of a line break.
    expect(annotateFailure("100%\ndone")).toBe(
      "::error title=heartbeat lane preparation failed::100%25%0Adone",
    );
  });
});

describe("prepare-heartbeat-branch CLI", () => {
  it("EMITS the annotation on a real conflicting tick, not merely computing one", () => {
    // The falsifier for the wiring rather than the formatter. `annotateFailure` was fully covered
    // by unit tests above and DELETING ITS ONLY CALL SITE still left them all green -- a check
    // that cannot fail for the thing it exists to protect. Legibility is a property of the
    // PROCESS OUTPUT, so it has to be asserted by running the process.
    const { work } = fixture();
    seedAttributes(work);
    // An UNDECLARED path, so the preparer's typed backpressure fires exactly as it did live.
    const p = "data/not-declared.jsonl";
    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, p, '{"n":"lane"}\n', "lane ticks past the flush snapshot");
    git(work, "push", "--force-with-lease", "origin", "heartbeat/alexa");
    git(work, "switch", "main");
    commitFile(work, p, '{"n":"main"}\n', "partial flush: only the snapshot reached main");
    git(work, "push", "origin", "main");

    const run = spawnSync(
      process.execPath,
      [join(import.meta.dir, "prepare-heartbeat-branch.ts"), "--agent", "alexa"],
      { cwd: work, encoding: "utf8" },
    );

    expect(run.status).toBe(1);
    const annotation = run.stderr.split("\n").find((l) => l.startsWith("::error "));
    expect(annotation).toBeDefined();
    // The annotation must NAME THE PATH. That is the entire difference between this and the
    // `Process completed with exit code 1` that was the only annotation on run 33024333706.
    expect(annotation).toContain("data/not-declared.jsonl");
    // Explicit timeout: this is the only test here that spawns a second `bun` runtime on top of
    // the git fixture, so it is the most load-sensitive one in the file. The default 5s is
    // already marginal for the git-only tests on a busy runner; leaving this one on the default
    // would make it the first to flake, and a flaky falsifier gets deleted rather than fixed.
  }, 30_000);
});

/**
 * THE SELF-SUSTAINING LOOP (2026-08-26, run 33024333706).
 *
 * These reconstruct the alexa wedge from its measured shape rather than asserting on the fix's own
 * vocabulary. The condition being rebuilt, taken off the live refs at 00:54Z:
 *
 *     merge-base 443cdacdb5 (22:27:58Z)   data/tick-reasoning.jsonl ABSENT
 *     main       16 rows (via the 23:11Z squash flush #15551)
 *     lane       30 rows, of which rows 1..16 are main's 16 VERBATIM
 *
 * `main` acquires the path through a SQUASH, so no ancestry links its copy to the lane that wrote
 * it and the base holds neither side — add/add by construction. Every fixture below builds main's
 * copy that way, because a fixture that merged normally would give git the ancestry the production
 * flush destroys and would pass without the fix.
 */
describe("prepareHeartbeatBranch — squash-flush divergence", () => {
  /** The undeclared path is the point: a declared one would be resolved by `.gitattributes`. */
  const LANE_PATH = "data/undeclared-stream.jsonl";
  const FLUSHED = '{"row":1}\n{"row":2}\n';
  const UNFLUSHED = '{"row":3}\n';

  /**
   * Build the wedge: lane at `laneBody`, main at `mainBody`, merge base holding NEITHER.
   *
   * Returns after leaving both refs on the origin, so `prepareHeartbeatBranch` sees exactly what a
   * runner sees on a fresh checkout.
   */
  function wedge(work: string, mainBody: string, laneBody: string): void {
    seedAttributes(work);
    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, LANE_PATH, laneBody, "lane keeps ticking past the flush");
    pushLane(work);
    git(work, "switch", "main");
    // The squash flush: main CREATES the path independently. No ancestry to the lane.
    commitFile(work, LANE_PATH, mainBody, "squash flush lands a prefix of the lane's delta");
    git(work, "push", "origin", "main");
  }

  it("REPRODUCES the wedge: without the prefix rule the carry is an add/add conflict", () => {
    const { work } = fixture();
    wedge(work, FLUSHED, FLUSHED + UNFLUSHED);

    // The control. This is the exact command the preparer runs, minus the fallback — so it shows
    // the condition is genuinely present and the passing test below is not vacuous.
    git(work, "fetch", "origin", "+refs/heads/main:refs/remotes/origin/main");
    git(work, "fetch", "origin", "+refs/heads/heartbeat/alexa:refs/remotes/origin/heartbeat/alexa");
    git(work, "checkout", "-B", "probe", "origin/main");
    const merge = spawnSync("git", ["merge", "--squash", "--no-commit", "refs/remotes/origin/heartbeat/alexa"], {
      cwd: work,
      encoding: "utf8",
    });
    expect(merge.status).not.toBe(0);
    expect(merge.stdout + merge.stderr).toContain("CONFLICT (add/add)");
    expect(merge.stdout + merge.stderr).toContain(LANE_PATH);
  });

  it("CARRIES it anyway when main's copy embeds in the lane's by insertions only", () => {
    const { work } = fixture();
    wedge(work, FLUSHED, FLUSHED + UNFLUSHED);

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { carried: true, healed: [LANE_PATH] } });

    // Losslessness, asserted on the bytes rather than on the outcome flag: every flushed row
    // survives, the unflushed row arrives, nothing is duplicated, and no marker leaked through.
    const carried = readFileSync(join(work, LANE_PATH), "utf8");
    expect(carried).toBe(FLUSHED + UNFLUSHED);
    expect(carried).not.toContain("<<<<<<<");
    const rows = carried.split("\n").filter((l) => l.length > 0);
    expect(rows).toEqual(new Array(...new Set(rows)));
  });

  it("BREAKS THE LOOP: the healed tick advances the merge base past the flush", () => {
    const { work } = fixture();
    wedge(work, FLUSHED, FLUSHED + UNFLUSHED);
    const stuckBase = git(work, "merge-base", "origin/main", "origin/heartbeat/alexa");

    // Tick once, exactly as the workflow does: prepare, commit, push the lane.
    expect(prepareHeartbeatBranch("alexa", work)).toMatchObject({ ok: true });
    git(work, "commit", "-m", "heartbeat(alexa): accumulated tick");
    pushLane(work);

    // THE PROPERTY. Before the fix a failed tick never pushed, so this value never moved and the
    // next tick recomputed the identical add/add — forever. It has now moved onto the flush.
    git(work, "fetch", "origin", "+refs/heads/heartbeat/alexa:refs/remotes/origin/heartbeat/alexa");
    const movedBase = git(work, "merge-base", "origin/main", "origin/heartbeat/alexa");
    expect(movedBase).not.toBe(stuckBase);
    expect(git(work, "cat-file", "-t", `${movedBase}:${LANE_PATH}`)).toBe("blob");

    // And the next tick is an ordinary clean carry — the divergence is gone, not deferred.
    const next = prepareHeartbeatBranch("alexa", work);
    expect(next).toMatchObject({ ok: true, value: { healed: [] } });
  });

  it("REFUSES when main holds a line the lane does not — the rule can still fail", () => {
    const { work } = fixture();
    // One rival row on main that the lane never saw. Taking the lane's copy would DROP it, so the
    // embedding fails and the tick must die exactly as it does today. This is the control that
    // keeps the test above from being a check that cannot fail.
    wedge(work, FLUSHED + '{"row":"rival"}\n', FLUSHED + UNFLUSHED);

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toContain("carry unflushed heartbeat state");
    expect(result.error).toContain(LANE_PATH);
  });

  it("REFUSES a mid-line prefix — a byte prefix that rewrites main's last row", () => {
    const { work } = fixture();
    // Main's last line is unterminated, and the lane "extends" it. Byte-prefix holds; the
    // insertion-only rule does not, because `{"row":2}` would silently become `{"row":22}`.
    wedge(work, '{"row":1}\n{"row":2}', '{"row":1}\n{"row":22}\n');

    expect(prepareHeartbeatBranch("alexa", work)).toMatchObject({ ok: false });
  });

  it("leaves the index untouched when any one path is refused (all-or-nothing)", () => {
    const { work } = fixture();
    seedAttributes(work);
    const healable = "data/healable.jsonl";
    const rival = "data/rival.jsonl";
    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, healable, FLUSHED + UNFLUSHED, "lane: healable");
    commitFile(work, rival, FLUSHED, "lane: rival");
    pushLane(work);
    git(work, "switch", "main");
    commitFile(work, healable, FLUSHED, "flush: healable prefix");
    commitFile(work, rival, '{"row":"only-on-main"}\n', "flush: rival diverged");
    git(work, "push", "origin", "main");

    expect(prepareHeartbeatBranch("alexa", work)).toMatchObject({ ok: false });
    // The healable path must NOT have been quietly resolved on the way to refusing the other one:
    // a partial resolution would leave a half-carried tick behind whatever gets reported.
    const unmerged = git(work, "diff", "--name-only", "--diff-filter=U");
    expect(unmerged.split("\n").filter((l) => l.length > 0).sort()).toEqual([healable, rival].sort());
  });

  /**
   * The NUL refusal has to be shown doing WORK, not merely present.
   *
   * The first pair below is refused by the line comparison alone, so it would pass with the NUL
   * check deleted — it pins nothing. The second pair is the one that needs the check: `a\0\n` DOES
   * embed in `a\0\nb\n` as a line subsequence, so without the refusal the rule would accept it and
   * splice bytes into the middle of a blob whose records are located by OFFSET, not by newline.
   * Every byte of main's copy survives and the file is still destroyed. Mutating the NUL check
   * away left every other test green until this case was added.
   */
  it("refuses binary blobs outright — the line argument does not apply to them", () => {
    expect(isLosslessLineExtension(Buffer.from([0x61, 0x00]), Buffer.from([0x61, 0x00, 0x62]))).toBe(false);
    expect(
      isLosslessLineExtension(Buffer.from([0x61, 0x00, 0x0a]), Buffer.from([0x61, 0x00, 0x0a, 0x62, 0x0a])),
    ).toBe(false);
  });

  it("accepts an EMPTY main side — the ours=0 signature this class was first measured with", () => {
    expect(isLosslessLineExtension(Buffer.alloc(0), Buffer.from("{}\n"))).toBe(true);
  });

  it("refuses equal blobs and a longer ours — neither is a STRICT extension", () => {
    expect(isLosslessLineExtension(Buffer.from("a\n"), Buffer.from("a\n"))).toBe(false);
    expect(isLosslessLineExtension(Buffer.from("a\nb\n"), Buffer.from("a\n"))).toBe(false);
  });
});

/** The live-feed index path, and the exact bytes its publisher emits. Shared by the two blocks below. */
const INDEX_PATH = "docs/room-evidence/index.json";

/**
 * Reproduce `encodeRoomEvidenceLiveFeedIndex`: entries sorted by `eventId`, two-space, trailing NL.
 *
 * Restated here rather than imported because the point under test is a BYTE shape — if the
 * publisher's serialisation ever changes, these fixtures must be re-measured against the new bytes
 * rather than silently tracking it and continuing to pass.
 */
function liveFeedIndexJson(...eventIds: readonly string[]): string {
  const entries = [...eventIds].sort().map((eventId) => ({
    eventId,
    auditContentKey: `audit-${eventId}`,
    receiptContentKey: `receipt-${eventId}`,
    file: `room-evidence/${eventId}.json`,
  }));
  return `${JSON.stringify({ schema: "zeta.room-evidence-live-feed-index.v1", entries }, null, 2)}\n`;
}

/**
 * The SECOND shape of the same squash-flush divergence: a canonically-ORDERED accumulating set.
 *
 * `docs/room-evidence/index.json` is not a log. `canonicalIndex` in
 * `observe/room/durable-room-evidence-live-feed.ts` re-serialises the whole entry set sorted by
 * `eventId` on every publish, so an entry whose id sorts LOW lands in front of everything main
 * already holds. Nothing is lost — the diff is pure insertion — but main's copy is not a byte
 * prefix of the lane's, so the 2026-08-26 prefix rule refused it and the alexa lane died from
 * 02:44Z on 2026-08-27 (run 33048649621, job 98438518098).
 *
 * Every fixture here reproduces the LIVE shape: a common base holding the empty index, main and
 * the lane each publishing into it. That is a three-stage CONTENT conflict, not the add/add the
 * block above covers — the two shapes reach the same fallback and must both be pinned.
 */
describe("prepareHeartbeatBranch — canonically-ordered set divergence", () => {
  const LOW = "11d5cf2c2f32f6ccff77d6a6174466d5";
  const HIGH = "59e83513bb0123e733f549982610cdc9";

  /** Base holds the empty index; main publishes `mainIds`, the lane publishes `laneIds`. */
  function divergeOverBase(work: string, mainIds: readonly string[], laneIds: readonly string[]): void {
    seedAttributes(work);
    commitFile(work, INDEX_PATH, liveFeedIndexJson(), "base: empty live-feed index");
    git(work, "push", "origin", "main");
    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, INDEX_PATH, liveFeedIndexJson(...laneIds), "lane publishes its events");
    pushLane(work);
    git(work, "switch", "main");
    commitFile(work, INDEX_PATH, liveFeedIndexJson(...mainIds), "flush lands an older snapshot");
    git(work, "push", "origin", "main");
  }

  it("REPRODUCES the wedge, and shows the PREFIX rule could never have cleared it", () => {
    const { work } = fixture();
    divergeOverBase(work, [HIGH], [LOW, HIGH]);

    git(work, "fetch", "origin", "+refs/heads/main:refs/remotes/origin/main");
    git(work, "fetch", "origin", "+refs/heads/heartbeat/alexa:refs/remotes/origin/heartbeat/alexa");
    git(work, "checkout", "-B", "probe", "origin/main");
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const merge = spawnSync("git", ["merge", "--squash", "--no-commit", "refs/remotes/origin/heartbeat/alexa"], {
      cwd: work,
      encoding: "utf8",
    });
    expect(merge.status).not.toBe(0);
    expect(merge.stdout + merge.stderr).toContain("CONFLICT (content)");
    expect(merge.stdout + merge.stderr).toContain(INDEX_PATH);

    // WHY THE OLD RULE FAILED, asserted rather than asserted-about: main's copy is not a byte
    // prefix of the lane's, so the 2026-08-26 rule returned false and the tick died. Without this
    // line the test below would pass under the old rule too, and prove nothing about the widening.
    const ours = Buffer.from(liveFeedIndexJson(HIGH));
    const theirs = Buffer.from(liveFeedIndexJson(LOW, HIGH));
    expect(theirs.subarray(0, ours.length).equals(ours)).toBe(false);
    expect(isLosslessLineExtension(ours, theirs)).toBe(true);
  });

  it("CARRIES it: the low-sorting entry is inserted and main's entry survives verbatim", () => {
    const { work } = fixture();
    divergeOverBase(work, [HIGH], [LOW, HIGH]);

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { carried: true, healed: [INDEX_PATH] } });

    // Losslessness on the bytes: the file still parses, main's entry is intact field-for-field,
    // the lane's arrived, canonical order holds, and no marker leaked into published discovery.
    const carried = readFileSync(join(work, INDEX_PATH), "utf8");
    expect(carried).not.toContain("<<<<<<<");
    expect(carried).toBe(liveFeedIndexJson(LOW, HIGH));
    const parsed = JSON.parse(carried) as { readonly entries: readonly { readonly eventId: string }[] };
    expect(parsed.entries.map((entry) => entry.eventId)).toEqual([LOW, HIGH]);
  });

  it("REFUSES when main published an entry the lane never saw", () => {
    const { work } = fixture();
    // Main holds an entry absent from the lane's set. Taking the lane's copy would DELETE a
    // published event from discovery — the exact clobber the rule exists to refuse.
    divergeOverBase(work, [HIGH, "ff00000000000000000000000000000f"], [LOW, HIGH]);

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toContain("carry unflushed heartbeat state");
  });

  it("REFUSES a rewritten entry — same key, changed content key", () => {
    const ours = Buffer.from(liveFeedIndexJson(HIGH));
    const theirs = Buffer.from(liveFeedIndexJson(LOW, HIGH).replace(`audit-${HIGH}`, "audit-rewritten"));
    // Every structural line still matches; only the value line changed. An embedding that ignored
    // content would accept this and silently republish a different content address.
    expect(isLosslessLineExtension(ours, theirs)).toBe(false);
  });

  it("REFUSES a REORDER — main's lines all present, but not in main's order", () => {
    // The property is subsequence, not subset. `b` before `a` on main cannot embed in `a` then
    // `b`, so a file whose records carry positional meaning is never silently re-sequenced.
    expect(isLosslessLineExtension(Buffer.from("b\na\n"), Buffer.from("a\nb\nc\n"))).toBe(false);
    expect(isLosslessLineExtension(Buffer.from("a\nb\n"), Buffer.from("a\nb\nc\n"))).toBe(true);
  });

  it("REFUSES a DELETION dressed as an insertion — main's line absent from a longer lane copy", () => {
    expect(isLosslessLineExtension(Buffer.from("a\nb\n"), Buffer.from("a\nc\nd\ne\n"))).toBe(false);
  });

  /**
   * The whole-line property, pinned where it now lives.
   *
   * The prefix rule enforced this with an explicit `ours` ends-with-newline guard. The
   * insertion-only rule gets it from `terminatedLines` instead — the newline is carried inside
   * each token, so main's unterminated `{"row":2}` cannot match the lane's `{"row":22}\n`. That is
   * a real property of the tokeniser, not a happy accident: a tokeniser that dropped its trailing
   * fragment (a one-line off-by-one) would accept this pair and silently rewrite main's last
   * record. Asserted at the unit level because the guard it replaced no longer exists to mutate.
   */
  it("REFUSES a mid-line extension at the unit level — a row must not be rewritten", () => {
    expect(isLosslessLineExtension(Buffer.from('{"row":1}\n{"row":2}'), Buffer.from('{"row":1}\n{"row":22}\n'))).toBe(
      false,
    );
    // And the honest converse: an unterminated fragment that survives verbatim IS carried, so the
    // refusal above is about the record CHANGING, not about the missing newline as such.
    expect(isLosslessLineExtension(Buffer.from("a\nb"), Buffer.from("a\nc\nb"))).toBe(true);
  });
});

/**
 * WHY THERE IS NO NINTH `.gitattributes` LINE — the reasoning, as an executable check.
 *
 * The eight `merge=union` declarations in the heartbeat block were each hand-written after a lane
 * died on a new path, and the reflex on the ninth is to write a ninth line. For
 * `docs/room-evidence/index.json` that reflex is wrong, and wrong in the most dangerous way
 * available: union RESOLVES this file correctly on every lossless case — so it would be tested,
 * seen to work, and landed — and corrupts it SILENTLY, with exit code 0, on the divergent case.
 * Prose saying so rots. This runs.
 */
describe("merge=union is disqualified for the JSON live-feed index", () => {
  /** Merge `laneIds` into `mainIds` over an empty base, with `merge=union` declared on the path. */
  function unionMerge(
    mainIds: readonly string[],
    laneIds: readonly string[],
  ): { readonly rc: number; readonly body: string } {
    const { work } = fixture();
    commitFile(work, ".gitattributes", `${INDEX_PATH} merge=union\n`, "declare union on the index");
    commitFile(work, INDEX_PATH, liveFeedIndexJson(), "base: empty index");
    git(work, "switch", "-c", "lane");
    commitFile(work, INDEX_PATH, liveFeedIndexJson(...laneIds), "lane publishes");
    git(work, "switch", "main");
    commitFile(work, INDEX_PATH, liveFeedIndexJson(...mainIds), "main publishes");
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const merge = spawnSync("git", ["merge", "--squash", "--no-commit", "lane"], { cwd: work, encoding: "utf8" });
    return { rc: merge.status ?? -1, body: readFileSync(join(work, INDEX_PATH), "utf8") };
  }

  it("looks correct on the lossless case — which is why the ninth line is tempting", () => {
    const { rc, body } = unionMerge(["bbb"], ["aaa", "bbb"]);
    expect(rc).toBe(0);
    const parsed = JSON.parse(body) as { readonly entries: readonly { readonly eventId: string }[] };
    expect(parsed.entries.map((entry) => entry.eventId)).toEqual(["aaa", "bbb"]);
  });

  it("SILENTLY publishes unparseable JSON on the divergent case, with exit code 0", () => {
    // Main holds `zzz`, which the lane never saw. This is the case the preparer's rule refuses
    // loudly, leaving the tick red. Union concatenates the two conflicting hunks of a
    // pretty-printed object and hands back a broken artifact while reporting success.
    const { rc, body } = unionMerge(["aaa", "zzz"], ["aaa", "bbb"]);
    expect(rc).toBe(0);
    expect(() => JSON.parse(body) as unknown).toThrow();
  });

  it("and so the shipped attributes must NOT declare a merge driver on that path", () => {
    // The guard on the reflex. Deleting this test is the only way to add the line, which is the
    // intended friction: whoever does it has to read the two cases above first.
    const declaration = new RegExp(`^\\s*${INDEX_PATH.replaceAll(".", "\\.")}\\s+.*merge=`, "m");
    expect(REPO_GITATTRIBUTES).not.toMatch(declaration);
  });
});
