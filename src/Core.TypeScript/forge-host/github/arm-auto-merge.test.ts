// arm-auto-merge.test.ts — falsifiers for "armed is what the READBACK says", fed fake answers.
//
// The measured defect this guards: `gh pr merge --auto` exits 0 whether it armed, merged at
// once, or silently failed. Every test below fails if the verdict is ever taken from the
// mutation's own answer instead of the readback, or if a failed readback is reported as a
// negative. The central ones were mutation-checked when written.

import { describe, expect, test } from "bun:test";
import type { ForgeError, Result } from "../types";
import { err, forgeError, ok } from "../result";
import type { GithubRest } from "./github-pr-rest.ts";
import {
  armAutoMerge,
  armMutation,
  decideArmOutcome,
  exitCodeFor,
  parseArgs,
  parseMutationResponse,
  parsePull,
  preflight,
  type PullSnapshot,
} from "./arm-auto-merge.ts";

const snap = (over: Partial<PullSnapshot> = {}): PullSnapshot => ({
  number: 5,
  nodeId: "PR_node",
  state: "open",
  merged: false,
  draft: false,
  headSha: "b".repeat(40),
  baseRef: "main",
  defaultBranch: "main",
  autoMerge: null,
  mergeableState: "blocked",
  ...over,
});

const restPull = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({
    number: 5,
    node_id: "PR_node",
    state: "open",
    merged: false,
    draft: false,
    head: { sha: "b".repeat(40) },
    base: { ref: "main", repo: { default_branch: "main" } },
    auto_merge: null,
    mergeable_state: "blocked",
    ...over,
  });

type Answer = Result<string, ForgeError>;

function fakeRest(script: Record<string, readonly Answer[]>): GithubRest & { calls: { key: string; body: unknown }[] } {
  const calls: { key: string; body: unknown }[] = [];
  const cursor = new Map<string, number>();
  return {
    calls,
    request: (method, path, body) => {
      const key = `${method} ${path}`;
      calls.push({ key, body });
      const answers = script[key];
      if (answers === undefined) return Promise.resolve(err(forgeError("not-found", `unscripted ${key}`)));
      const i = cursor.get(key) ?? 0;
      cursor.set(key, i + 1);
      return Promise.resolve(answers[Math.min(i, answers.length - 1)] as Answer);
    },
  };
}

const PULL = "GET repos/o/r/pulls/5";
const GQL = "POST graphql";
const armedAnswer = ok(JSON.stringify({ data: { enablePullRequestAutoMerge: { pullRequest: { autoMergeRequest: { enabledAt: "t" } } } } }));
const opts = { method: "squash" as const, updateBranch: false, allowNonDefaultBase: false, settleDelayMs: 0 };
const noSleep = (): Promise<void> => Promise.resolve();

describe("decideArmOutcome — the verdict is the readback's", () => {
  test("readback armed is armed even when the mutation's answer was lost", () => {
    const d = decideArmOutcome({ kind: "transport-error", error: forgeError("network", "reset") }, ok(snap({ autoMerge: { mergeMethod: "squash" } })));
    expect(d.outcome).toBe("armed");
    expect(d.mergeMethod).toBe("squash");
  });

  test("mutation reported armed but readback shows null is NOT armed", () => {
    expect(decideArmOutcome({ kind: "reported-armed" }, ok(snap())).outcome).toBe("not-armed");
  });

  test("readback merged is already-merged, whatever the mutation said", () => {
    expect(decideArmOutcome({ kind: "graphql-error", message: "Pull request is in clean status" }, ok(snap({ merged: true }))).outcome).toBe(
      "already-merged",
    );
  });

  test("merged wins over a stale auto_merge on the same readback", () => {
    expect(decideArmOutcome(null, ok(snap({ merged: true, autoMerge: { mergeMethod: "squash" } }))).outcome).toBe("already-merged");
  });

  test("a FAILED readback is unknown — never not-armed — even after a refusal", () => {
    const d = decideArmOutcome({ kind: "graphql-error", message: "draft" }, err(forgeError("network", "timeout")));
    expect(d.outcome).toBe("unknown");
  });

  test("the forge's own refusal sentence reaches the reason", () => {
    const d = decideArmOutcome({ kind: "graphql-error", message: "Pull request is in clean status" }, ok(snap()));
    expect(d.outcome).toBe("not-armed");
    expect(d.reason).toContain("clean status");
  });
});

describe("preflight — each early exit saves the one GraphQL call", () => {
  const pf = (s: PullSnapshot, allow = false) => preflight(s, { allowNonDefaultBase: allow });
  test("merged -> already-merged", () => {
    expect(pf(snap({ merged: true }))).toMatchObject({ kind: "decided", outcome: "already-merged" });
  });
  test("closed -> not-armed", () => {
    expect(pf(snap({ state: "closed" }))).toMatchObject({ kind: "decided", outcome: "not-armed" });
  });
  test("already armed -> armed, no mutation", () => {
    expect(pf(snap({ autoMerge: { mergeMethod: "squash" } }))).toMatchObject({ kind: "decided", outcome: "armed" });
  });
  test("draft -> not-armed naming the draft", () => {
    const p = pf(snap({ draft: true }));
    expect(p).toMatchObject({ kind: "decided", outcome: "not-armed" });
    expect(p.kind === "decided" && p.reason).toContain("draft");
  });
  test("non-default base -> not-armed unless explicitly allowed", () => {
    expect(pf(snap({ baseRef: "topic" }))).toMatchObject({ kind: "decided", outcome: "not-armed" });
    expect(pf(snap({ baseRef: "topic" }), true)).toEqual({ kind: "arm" });
  });
  test("unknown default branch does not block", () => {
    expect(pf(snap({ baseRef: "topic", defaultBranch: null }))).toEqual({ kind: "arm" });
  });
  test("an ordinary open PR arms", () => {
    expect(pf(snap())).toEqual({ kind: "arm" });
  });
});

describe("parsing", () => {
  test("parsePull reads auto_merge, merged, draft and the default branch", () => {
    const p = parsePull(restPull({ auto_merge: { merge_method: "squash" }, draft: true }));
    expect(p.ok && p.value.autoMerge).toEqual({ mergeMethod: "squash" });
    expect(p.ok && p.value.draft).toBe(true);
    expect(p.ok && p.value.defaultBranch).toBe("main");
    const m = parsePull(restPull({ merged: false, merged_at: "2026-09-23T00:00:00Z" }));
    expect(m.ok && m.value.merged).toBe(true);
  });

  test("an ABSENT auto_merge field is a parse failure, not 'not armed'", () => {
    const raw = JSON.parse(restPull()) as Record<string, unknown>;
    delete raw.auto_merge;
    expect(parsePull(JSON.stringify(raw)).ok).toBe(false);
  });

  test("mutation answers: armed, null, errors, transport", () => {
    expect(parseMutationResponse(armedAnswer)).toEqual({ kind: "reported-armed" });
    expect(parseMutationResponse(ok(JSON.stringify({ data: { enablePullRequestAutoMerge: { pullRequest: { autoMergeRequest: null } } } })))).toEqual({
      kind: "reported-not-armed",
    });
    expect(parseMutationResponse(ok(JSON.stringify({ errors: [{ message: "Pull request is a draft" }] })))).toEqual({
      kind: "graphql-error",
      message: "Pull request is a draft",
    });
    expect(parseMutationResponse(err(forgeError("internal", "GraphQL: Pull request is in clean status")))).toMatchObject({ kind: "graphql-error" });
    expect(parseMutationResponse(err(forgeError("network", "reset")))).toMatchObject({ kind: "transport-error" });
  });

  test("the mutation names the merge method", () => {
    expect(armMutation("squash")).toContain("mergeMethod: SQUASH");
    expect(armMutation("rebase")).toContain("mergeMethod: REBASE");
    expect(armMutation("merge")).toContain("mergeMethod: MERGE");
  });

  test("args", () => {
    expect(parseArgs(["12"]).ok).toBe(true);
    expect(parseArgs([]).ok).toBe(false);
    expect(parseArgs(["12", "--method", "octopus"]).ok).toBe(false);
    expect(parseArgs(["12", "13"]).ok).toBe(false);
    expect(parseArgs(["12", "--repo", "a/../b"]).ok).toBe(false);
  });

  test("exit codes are distinct per outcome", () => {
    const codes = (["armed", "not-armed", "already-merged", "unknown"] as const).map(exitCodeFor);
    expect(codes).toEqual([0, 1, 3, 4]);
  });
});

describe("armAutoMerge end to end against a fake forge", () => {
  test("arms, then verifies by readback: one GraphQL call total", async () => {
    const rest = fakeRest({
      [PULL]: [ok(restPull()), ok(restPull({ auto_merge: { merge_method: "squash" } }))],
      [GQL]: [armedAnswer],
    });
    const v = await armAutoMerge("o/r", 5, opts, { rest, sleep: noSleep });
    expect(v.outcome).toBe("armed");
    expect(v.mutationAttempted).toBe(true);
    expect(v.readbacks).toBe(1);
    expect(rest.calls.filter((c) => c.key === GQL).length).toBe(1);
    expect((rest.calls.find((c) => c.key === GQL)?.body as { variables: { id: string } }).variables.id).toBe("PR_node");
  });

  test("rc-0-but-merged-immediately is reported as already-merged", async () => {
    const rest = fakeRest({
      [PULL]: [ok(restPull()), ok(restPull({ merged: true }))],
      [GQL]: [ok(JSON.stringify({ errors: [{ message: "Pull request is in clean status" }] }))],
    });
    expect((await armAutoMerge("o/r", 5, opts, { rest, sleep: noSleep })).outcome).toBe("already-merged");
  });

  test("a draft never reaches GraphQL", async () => {
    const rest = fakeRest({ [PULL]: [ok(restPull({ draft: true }))] });
    const v = await armAutoMerge("o/r", 5, opts, { rest, sleep: noSleep });
    expect(v.outcome).toBe("not-armed");
    expect(rest.calls.some((c) => c.key === GQL)).toBe(false);
  });

  test("already armed sends no mutation", async () => {
    const rest = fakeRest({ [PULL]: [ok(restPull({ auto_merge: { merge_method: "squash" } }))] });
    const v = await armAutoMerge("o/r", 5, opts, { rest, sleep: noSleep });
    expect(v.outcome).toBe("armed");
    expect(v.mutationAttempted).toBe(false);
    expect(rest.calls.length).toBe(1);
  });

  test("forge said armed, readback lags: re-reads a bounded number of times", async () => {
    const rest = fakeRest({
      [PULL]: [ok(restPull()), ok(restPull()), ok(restPull({ auto_merge: { merge_method: "squash" } }))],
      [GQL]: [armedAnswer],
    });
    const v = await armAutoMerge("o/r", 5, opts, { rest, sleep: noSleep });
    expect(v.outcome).toBe("armed");
    expect(v.readbacks).toBe(2);
  });

  test("forge said armed, readback never shows it: not-armed after exactly 1 + 2 readbacks", async () => {
    const rest = fakeRest({ [PULL]: [ok(restPull())], [GQL]: [armedAnswer] });
    const v = await armAutoMerge("o/r", 5, opts, { rest, sleep: noSleep });
    expect(v.outcome).toBe("not-armed");
    expect(v.readbacks).toBe(3);
  });

  test("a refusal is not re-read: one readback only", async () => {
    const rest = fakeRest({
      [PULL]: [ok(restPull())],
      [GQL]: [ok(JSON.stringify({ errors: [{ message: "nope" }] }))],
    });
    const v = await armAutoMerge("o/r", 5, opts, { rest, sleep: noSleep });
    expect(v.outcome).toBe("not-armed");
    expect(v.readbacks).toBe(1);
  });

  test("readback failure after a mutation is unknown", async () => {
    const rest = fakeRest({ [PULL]: [ok(restPull()), err(forgeError("network", "reset"))], [GQL]: [armedAnswer] });
    const v = await armAutoMerge("o/r", 5, opts, { rest, sleep: noSleep });
    expect(v.outcome).toBe("unknown");
    expect(exitCodeFor(v.outcome)).toBe(4);
  });

  test("pre-read failure is unknown and nothing is attempted", async () => {
    const rest = fakeRest({ [PULL]: [err(forgeError("network", "reset"))] });
    const v = await armAutoMerge("o/r", 5, opts, { rest, sleep: noSleep });
    expect(v.outcome).toBe("unknown");
    expect(rest.calls.length).toBe(1);
  });

  test("--update-branch PUTs the REST endpoint with the expected head, then arms", async () => {
    const rest = fakeRest({
      [PULL]: [ok(restPull()), ok(restPull({ auto_merge: { merge_method: "squash" } }))],
      "PUT repos/o/r/pulls/5/update-branch": [ok(JSON.stringify({ message: "Updating pull request branch." }))],
      [GQL]: [armedAnswer],
    });
    const v = await armAutoMerge("o/r", 5, { ...opts, updateBranch: true }, { rest, sleep: noSleep });
    expect(v.updateBranch).toEqual({ kind: "requested", message: "Updating pull request branch." });
    expect(v.outcome).toBe("armed");
    const put = rest.calls.find((c) => c.key.startsWith("PUT"));
    expect(put?.body).toEqual({ expected_head_sha: "b".repeat(40) });
  });
});
