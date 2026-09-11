/**
 * git-worktree.test.ts — two changes open at once, which the sibling adapter cannot survive.
 *
 * `gitChangeControl` moves the shared HEAD with `checkout -b`, so two open changes in one
 * repository fight over which branch is checked out and whose files are on disk. Nothing breaks
 * today because the runtime is sequential — but that is a property held by an accident of the
 * CALLER, not by the adapter, and limits of that kind stop being true silently.
 *
 * The first test here is the one that earns the adapter: it opens two changes without closing the
 * first, writes different content in each, and merges both. Run against `gitChangeControl` it
 * would be a mess of clobbered files; here each change has its own directory and its own HEAD.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { agentWorkExecutor, branchExists, commandWorkExecutor, commitsAhead, gitChangeControl, gitWorktreeChangeControl, worktreeDirName } from "./adapters";
import { changeContextFor, collectionsReadyToLand } from "./branch-topology";
import { externalRefOf } from "./intake";
import type { Cascade } from "./goal-cascade";
import { Fidelity } from "./providers";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";

const node = (workId: string): CascadeNode => ({
  workId,
  workType: WorkType.Task,
  title: `do ${workId}`,
  state: WorkState.Open,
  ownerHatId: "tech_lead",
  assigneeHatId: "backend_implementer",
});

/** A repository with one commit on `main`, plus a place to put worktrees. */
function repo(label: string) {
  const root = mkdtempSync(join(tmpdir(), `worktree-${label}-`));
  const cwd = join(root, "repo");
  const worktreeRoot = join(root, "trees");
  mkdirSync(cwd, { recursive: true });
  mkdirSync(worktreeRoot, { recursive: true });
  const git = (...args: string[]) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr ?? ""}`);
  };
  git("init", "-b", "main");
  git("config", "user.email", "t@example.invalid");
  git("config", "user.name", "T");
  writeFileSync(join(cwd, "README.md"), "seed\n");
  git("add", "README.md");
  git("commit", "-m", "seed");
  return { cwd, worktreeRoot };
}

/**
 * The change's checkout, or a THROW.
 *
 * Never defaulted to an empty string. An empty path makes `join` produce a relative one and
 * `spawnSync` inherit the process's own directory — so a test whose `workdir` went missing would
 * silently write and COMMIT into the repository it is running inside.
 *
 * That is not hypothetical. It happened here, under the mutation that strips `workdir` from the
 * handle: the mutant was correctly killed, and on its way past it put two commits into this very
 * repo. The failure is the one this whole register is about — a fallback that quietly redirects a
 * real side effect — so the test helper refuses, exactly as the adapters do.
 */
function checkoutOf(opened: { readonly workdir?: string }): string {
  const workdir = opened.workdir;
  if (workdir === undefined || workdir.trim() === "") {
    throw new Error("the change reported no checkout; refusing to fall back to the current directory");
  }
  return workdir;
}

/** Commit a file inside a worktree, the way a work executor handed `ctx.workdir` would. */
function commitIn(workdir: string, file: string, body: string) {
  if (workdir.trim() === "") throw new Error("refusing to commit into the current directory");
  writeFileSync(join(workdir, file), body);
  for (const args of [["add", file], ["commit", "-m", `add ${file}`]]) {
    const r = spawnSync("git", args, { cwd: workdir, encoding: "utf-8" });
    expect(r.status).toBe(0);
  }
}

describe("TWO CHANGES OPEN AT ONCE", () => {
  test("each gets its own checkout, and both merge", async () => {
    const { cwd, worktreeRoot } = repo("concurrent");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });

    // BOTH opened before either is merged. This is the case the shared-HEAD adapter cannot take.
    const first = await change.open(node("task-1"), { branch: "work/task-1" });
    const second = await change.open(node("task-2"), { branch: "work/task-2" });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    // Separate directories, and the port SAYS where each one is.
    expect(first.value.workdir).toBeDefined();
    expect(second.value.workdir).toBeDefined();
    expect(first.value.workdir).not.toBe(second.value.workdir);

    commitIn(checkoutOf(first.value), "one.txt", "from task-1\n");
    commitIn(checkoutOf(second.value), "two.txt", "from task-2\n");

    // Neither worktree sees the other's file — the isolation is real, not nominal.
    expect(existsSync(join(checkoutOf(first.value), "two.txt"))).toBe(false);
    expect(existsSync(join(checkoutOf(second.value), "one.txt"))).toBe(false);

    expect((await change.merge(first.value)).ok).toBe(true);
    expect((await change.merge(second.value)).ok).toBe(true);

    // The shared repository ends with BOTH pieces of work, on main.
    expect(readFileSync(join(cwd, "one.txt"), "utf-8")).toContain("from task-1");
    expect(readFileSync(join(cwd, "two.txt"), "utf-8")).toContain("from task-2");
    const head = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, encoding: "utf-8" });
    expect(head.stdout.trim()).toBe("main");
  });

  test("THE SHARED CHECKOUT NEVER MOVES — that is what makes the concurrency safe", async () => {
    // `checkout -b` in the sibling adapter changes which branch the repository is on. Here `main`
    // stays checked out the whole time, which is precisely why a second open cannot disturb a
    // first one's files.
    const { cwd, worktreeRoot } = repo("head");
    const branchNow = () => spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, encoding: "utf-8" }).stdout.trim();
    expect(branchNow()).toBe("main");

    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const opened = await change.open(node("task-1"), { branch: "work/task-1" });
    expect(opened.ok).toBe(true);
    expect(branchNow()).toBe("main");

    // ...and the sibling adapter does the opposite, which is the whole reason this one exists.
    const shared = gitChangeControl({ cwd, baseBranch: "main" });
    expect((await shared.open(node("task-9"), { branch: "work/task-9" })).ok).toBe(true);
    expect(branchNow()).toBe("work/task-9");
  });

  test("the merge leaves a MERGE COMMIT, and the worktree is cleaned up", async () => {
    const { cwd, worktreeRoot } = repo("cleanup");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const opened = await change.open(node("task-1"), { branch: "work/task-1" });
    if (!opened.ok) throw new Error(opened.reason);
    commitIn(checkoutOf(opened.value), "one.txt", "work\n");

    expect(existsSync(checkoutOf(opened.value))).toBe(true);
    expect((await change.merge(opened.value)).ok).toBe(true);

    const parents = spawnSync("git", ["rev-list", "--parents", "-n", "1", "HEAD"], { cwd, encoding: "utf-8" });
    expect(parents.stdout.trim().split(/ +/)).toHaveLength(3);
    // A worktree left behind holds a lock on its branch, and the next run's open would refuse.
    expect(existsSync(checkoutOf(opened.value))).toBe(false);
  });
});

describe("THE MERGE LANDS ON THE BASE, NOT ON WHATEVER IS CHECKED OUT", () => {
  // -- WHY EVERY OTHER TEST IN THIS FILE MISSED IT --------------------------
  // `repo()` leaves `main` checked out, and `main` is also the base. HEAD and the base were the
  // same ref in every test here, so `git merge --no-ff <branch>` -- which merges into HEAD -- was
  // indistinguishable from one that merges into the base. The fixture could not reach the state
  // production is normally in: a repository sitting on a feature branch.
  //
  // MEASURED 2026-09-10 against a clone of a working repository on a feature branch: the change
  // branched from `main` correctly, the merge landed on the FEATURE branch, `main` never moved,
  // and the run reported `1 landed` and delivered.

  /** The fixture's repository, moved onto a feature branch with work in progress on it. */
  function onFeatureBranch(label: string) {
    const made = repo(label);
    const git = (...args: string[]) => {
      const r = spawnSync("git", args, { cwd: made.cwd, encoding: "utf-8" });
      if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr ?? ""}`);
    };
    git("checkout", "-b", "mine");
    // Uncommitted work, because the operator's files are the other thing that must survive.
    writeFileSync(join(made.cwd, "UNCOMMITTED.txt"), "work in progress\n");
    return made;
  }

  const tipOf = (cwd: string, ref: string) =>
    spawnSync("git", ["rev-parse", ref], { cwd, encoding: "utf-8" }).stdout.trim();

  test("the base branch receives the merge and the checked-out branch does not", async () => {
    const { cwd, worktreeRoot } = onFeatureBranch("target");
    const mineBefore = tipOf(cwd, "mine");
    const mainBefore = tipOf(cwd, "main");
    expect(mineBefore).toBe(mainBefore); // branched from main a moment ago

    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const opened = await change.open(node("task-1"), { branch: "work/task-1" });
    if (!opened.ok) throw new Error(opened.reason);
    commitIn(checkoutOf(opened.value), "one.txt", "work\n");

    const merged = await change.merge(opened.value);
    expect(merged.ok).toBe(true);

    // THE BASE MOVED...
    expect(tipOf(cwd, "main")).not.toBe(mainBefore);
    // ...AND THE OPERATOR'S BRANCH DID NOT. This is the assertion the old code fails: it moved
    // `mine` and left `main` exactly where it was.
    expect(tipOf(cwd, "mine")).toBe(mineBefore);

    // AND THE COMMIT IT REPORTS IS THE ONE IT MADE. Read off the shared HEAD this would be the
    // operator's tip, and the tree hash filed against every bound check would belong to somebody
    // else's work — a verdict attributed to content that was never reviewed.
    if (!merged.ok) throw new Error(merged.reason);
    expect(merged.value.commit).toBe(tipOf(cwd, "main"));
    expect(merged.value.commit).not.toBe(tipOf(cwd, "mine"));
  });

  test("WHAT COUNTS AS 'NOTHING TO MERGE' IS ASKED OF THE BASE, not of the operator's branch", async () => {
    // The guard that refuses an empty branch counts commits. Counted from HEAD, it answers a
    // question about the OPERATOR's branch: if their branch already contains the change's commits,
    // `HEAD..work/x` is zero and a change with real work in it is refused as empty.
    //
    // Not contrived — it is exactly the state the previous defect left behind, since that bug
    // merged changes onto whatever branch was checked out. So the repair path was blocked by the
    // same assumption that caused the damage.
    const { cwd, worktreeRoot } = onFeatureBranch("counted");
    const git = (...args: string[]) => spawnSync("git", args, { cwd, encoding: "utf-8" });

    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const opened = await change.open(node("task-1"), { branch: "work/task-1" });
    if (!opened.ok) throw new Error(opened.reason);
    commitIn(checkoutOf(opened.value), "one.txt", "work\n");

    // The operator's branch takes the work too, so HEAD is no longer BEHIND the change branch…
    expect(git("merge", "--no-ff", "-m", "operator took it", "work/task-1").status).toBe(0);
    // …and a HEAD-relative count now says zero while a base-relative count still says one.
    expect(commitsAhead((a) => git(...a), "work/task-1")).toBe(0);
    expect(commitsAhead((a) => git(...a), "work/task-1", "main")).toBeGreaterThan(0);

    // The merge must still happen: the BASE has not seen this work.
    const mainBefore = tipOf(cwd, "main");
    const merged = await change.merge(opened.value);
    if (!merged.ok) throw new Error(merged.reason);
    expect(tipOf(cwd, "main")).not.toBe(mainBefore);
  });

  test("the operator's HEAD and working tree are where they were left", async () => {
    const { cwd, worktreeRoot } = onFeatureBranch("untouched");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const opened = await change.open(node("task-1"), { branch: "work/task-1" });
    if (!opened.ok) throw new Error(opened.reason);
    commitIn(checkoutOf(opened.value), "one.txt", "work\n");
    expect((await change.merge(opened.value)).ok).toBe(true);

    expect(
      spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, encoding: "utf-8" }).stdout.trim(),
    ).toBe("mine");
    // The borrowed checkout must not have swept the operator's untracked file away.
    expect(existsSync(join(cwd, "UNCOMMITTED.txt"))).toBe(true);
  });

  test("THE BORROWED CHECKOUT IS RELEASED — otherwise the NEXT change cannot merge", async () => {
    // A worktree left on the base holds a lock on it, so a second merge would be refused by git
    // with a message about the branch already being checked out. Two changes, in sequence, is the
    // falsifier for the release: the second one only works if the first cleaned up after itself.
    const { cwd, worktreeRoot } = onFeatureBranch("released");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });

    for (const id of ["task-1", "task-2"]) {
      const opened = await change.open(node(id), { branch: `work/${id}` });
      if (!opened.ok) throw new Error(opened.reason);
      commitIn(checkoutOf(opened.value), `${id}.txt`, "work\n");
      const merged = await change.merge(opened.value);
      if (!merged.ok) throw new Error(`${id}: ${merged.reason}`);
    }

    // Only the shared checkout remains; nothing was left holding the base.
    const trees = spawnSync("git", ["worktree", "list"], { cwd, encoding: "utf-8" }).stdout.trim().split("\n");
    expect(trees).toHaveLength(1);
    // Both changes are on the base, in order.
    const log = spawnSync("git", ["log", "--oneline", "main"], { cwd, encoding: "utf-8" }).stdout;
    expect(log).toContain("work/task-1");
    expect(log).toContain("work/task-2");
  });

  test("a failed merge also releases the base, and says what refused", async () => {
    // The release must not be on the success path only: a conflict that left the base checked out
    // would turn one failed change into a permanently unmergeable repository.
    const { cwd, worktreeRoot } = onFeatureBranch("conflict");
    const git = (...args: string[]) => spawnSync("git", args, { cwd, encoding: "utf-8" });

    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const opened = await change.open(node("task-1"), { branch: "work/task-1" });
    if (!opened.ok) throw new Error(opened.reason);
    commitIn(checkoutOf(opened.value), "clash.txt", "from the change\n");

    // A conflicting commit placed on the BASE, without disturbing the checked-out branch.
    const side = join(worktreeRoot, "seed-base");
    expect(git("worktree", "add", side, "main").status).toBe(0);
    writeFileSync(join(side, "clash.txt"), "from the base\n");
    expect(spawnSync("git", ["add", "clash.txt"], { cwd: side, encoding: "utf-8" }).status).toBe(0);
    expect(spawnSync("git", ["commit", "-m", "base side"], { cwd: side, encoding: "utf-8" }).status).toBe(0);
    expect(git("worktree", "remove", "--force", side).status).toBe(0);

    const merged = await change.merge(opened.value);
    expect(merged.ok).toBe(false);

    // THE BASE IS STILL MERGEABLE. Nothing is holding it, so a later change is not blocked by
    // this one's failure. The CHANGE's own worktree is deliberately still there — a failed merge
    // leaves the work on disk, which a sibling test in this file pins — so the assertion NAMES
    // the borrowed checkout rather than counting, or it would contradict that rule.
    const trees = spawnSync("git", ["worktree", "list"], { cwd, encoding: "utf-8" }).stdout;
    expect(trees).not.toContain(worktreeDirName("into-main"));
    expect(trees).toContain(worktreeDirName("work/task-1"));

    // …and the proof that the base is really free: a SECOND change merges cleanly afterwards.
    const next = await change.open(node("task-2"), { branch: "work/task-2" });
    if (!next.ok) throw new Error(next.reason);
    commitIn(checkoutOf(next.value), "two.txt", "work\n");
    const after = await change.merge(next.value);
    if (!after.ok) throw new Error(after.reason);
  });
});

describe("A FEATURE'S STORIES LAND ON THE FEATURE, AND THE FEATURE ON THE TRUNK", () => {
  // -- WHY THIS TEST EXISTS AT THIS LAYER ------------------------------------
  // `run-org`'s fixture decomposes one request into ONE code item, so no end-to-end run can reach
  // the feature case at all. Measured on the folded cascade of a real run: `under=1` at every rung,
  // no integration branch, straight to the trunk — correct, and unable to exercise the other half.
  // So the cascade is built here and the REAL adapter is driven from it.

  /** goal -> initiative -> project(FEAT-1) -> two stories(S-1, S-2). A collection, measured. */
  function collecting(state: "open" | "done"): Cascade {
    const base = { ownerHatId: "tech_lead", state: state === "done" ? WorkState.Done : WorkState.Open };
    return {
      nodes: [
        { workId: "goal-1", workType: WorkType.Goal, title: "the outcome", ...base },
        { workId: "init-1", workType: WorkType.Initiative, title: "the epic", parentWorkId: "goal-1", ...base },
        {
          workId: "proj-1", workType: WorkType.Project, title: "the feature", parentWorkId: "init-1",
          requestRef: externalRefOf("jira", "FEAT-1"), ...base,
        },
        {
          workId: "leaf-1", workType: WorkType.Task, title: "story one", parentWorkId: "proj-1",
          requestRef: externalRefOf("jira", "S-1"), assigneeHatId: "backend_implementer", ...base,
        },
        {
          workId: "leaf-2", workType: WorkType.Task, title: "story two", parentWorkId: "proj-1",
          requestRef: externalRefOf("jira", "S-2"), assigneeHatId: "backend_implementer", ...base,
        },
      ],
    };
  }

  const tipOf = (cwd: string, ref: string) =>
    spawnSync("git", ["rev-parse", ref], { cwd, encoding: "utf-8" }).stdout.trim();

  test("both stories merge into the feature; the TRUNK does not move until the collection lands", async () => {
    const { cwd, worktreeRoot } = repo("feature");
    const cascade = collecting("open");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const mainAtStart = tipOf(cwd, "main");

    for (const [id, file] of [["leaf-1", "one.txt"], ["leaf-2", "two.txt"]] as const) {
      const ctx = changeContextFor({ cascade, workId: id });
      if (ctx === undefined) throw new Error(`no context for ${id}`);
      // The derivation, asserted where it is USED rather than only in its own unit test.
      expect(ctx.base).toBe("feature/FEAT-1");

      const opened = await change.open(
        cascade.nodes.find((n) => n.workId === id) as CascadeNode,
        ctx,
      );
      if (!opened.ok) throw new Error(`${id}: ${opened.reason}`);
      // THE HANDLE REMEMBERS. Without this `merge` would target the adapter's trunk and the feature
      // branch would stay empty while main collected the stories one at a time.
      expect(opened.value.base).toBe("feature/FEAT-1");

      commitIn(checkoutOf(opened.value), file, "work\n");
      const merged = await change.merge(opened.value);
      if (!merged.ok) throw new Error(`${id}: ${merged.reason}`);
    }

    // THE FEATURE BRANCH EXISTS AND HOLDS BOTH — created by the first story that needed it, joined
    // by the second. Nothing upstream created it; that is the whole point of doing it in `open`.
    expect(branchExists((a) => spawnSync("git", [...a], { cwd, encoding: "utf-8" }), "feature/FEAT-1")).toBe(true);
    const onFeature = spawnSync("git", ["log", "--oneline", "feature/FEAT-1"], { cwd, encoding: "utf-8" }).stdout;
    expect(onFeature).toContain("story/S-1");
    expect(onFeature).toContain("story/S-2");

    // ...AND THE TRUNK HAS SEEN NONE OF IT. A story that reached main directly would mean the
    // feature was never reviewable as a whole, which is the reason an integration branch exists.
    expect(tipOf(cwd, "main")).toBe(mainAtStart);
  });

  test("the collection lands on the trunk ONLY once it and every code item under it are done", async () => {
    const { cwd, worktreeRoot } = repo("collection");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });

    for (const [id, file] of [["leaf-1", "one.txt"], ["leaf-2", "two.txt"]] as const) {
      const open = collecting("open");
      const ctx = changeContextFor({ cascade: open, workId: id });
      const opened = await change.open(open.nodes.find((n) => n.workId === id) as CascadeNode, ctx as { branch: string });
      if (!opened.ok) throw new Error(opened.reason);
      commitIn(checkoutOf(opened.value), file, "work\n");
      const merged = await change.merge(opened.value);
      if (!merged.ok) throw new Error(merged.reason);
    }

    // WHILE ANYTHING IS OPEN, NOTHING LANDS. This is the guard against half a feature on the trunk.
    expect(collectionsReadyToLand({ cascade: collecting("open") })).toEqual([]);

    // Done, and every code item under it done.
    const ready = collectionsReadyToLand({ cascade: collecting("done") });
    expect(ready.map((r) => r.workId)).toEqual(["proj-1"]);
    expect(ready[0]?.branch).toBe("feature/FEAT-1");

    // The collection merges with NO base on the handle — which is how it asks for the trunk.
    const mainBefore = tipOf(cwd, "main");
    const landed = await change.merge({ changeId: "feature/FEAT-1@proj-1", branch: "feature/FEAT-1" });
    if (!landed.ok) throw new Error(landed.reason);
    expect(tipOf(cwd, "main")).not.toBe(mainBefore);

    // BOTH STORIES ARE NOW ON THE TRUNK, through the feature, in one merge.
    const onMain = spawnSync("git", ["log", "--oneline", "main"], { cwd, encoding: "utf-8" }).stdout;
    expect(onMain).toContain("story/S-1");
    expect(onMain).toContain("story/S-2");
    expect(onMain).toContain("feature/FEAT-1");
  });

  test("A RESUME REJOINS: the same item opened twice does not refuse, and does not lose its commit", async () => {
    // MEASURED before the rejoin existed: a second cycle over one item died on
    // `fatal: a branch named 'work/task-015' already exists`, and the run then called the item done
    // with nothing merged — its own branch, from its own previous cycle, read as somebody else's.
    const { cwd, worktreeRoot } = repo("resume");
    const cascade = collecting("open");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const node1 = cascade.nodes.find((n) => n.workId === "leaf-1") as CascadeNode;
    const ctx = changeContextFor({ cascade, workId: "leaf-1" }) as { branch: string; base?: string };

    const first = await change.open(node1, ctx);
    if (!first.ok) throw new Error(first.reason);
    commitIn(checkoutOf(first.value), "one.txt", "work\n");
    const tip = tipOf(cwd, "story/S-1");

    // The worktree is still on disk — the cycle did not merge. Opening again must hand back the
    // same checkout rather than refusing.
    const again = await change.open(node1, ctx);
    if (!again.ok) throw new Error(again.reason);
    expect(again.value.workdir).toBe(first.value.workdir);
    expect(again.value.base).toBe("feature/FEAT-1");
    // AND THE COMMIT SURVIVED. A rejoin that re-cut the branch from its base would silently discard
    // whatever the earlier cycle did, which is worse than the refusal it replaced.
    expect(tipOf(cwd, "story/S-1")).toBe(tip);

    // The integration branch is JOINED, not re-created: still one branch, still where it was.
    expect(branchExists((a) => spawnSync("git", [...a], { cwd, encoding: "utf-8" }), "feature/FEAT-1")).toBe(true);
  });

  test("a directory that is NOT this change's checkout is refused, not adopted", async () => {
    // The rejoin above must not become "any directory with the right name will do": work performed
    // in an unrelated tree would never reach the merge, and the run would report it delivered.
    const { cwd, worktreeRoot } = repo("stale");
    const cascade = collecting("open");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const ctx = changeContextFor({ cascade, workId: "leaf-1" }) as { branch: string; base?: string };

    mkdirSync(join(worktreeRoot, worktreeDirName(ctx.branch)), { recursive: true });
    writeFileSync(join(worktreeRoot, worktreeDirName(ctx.branch), "junk.txt"), "not a checkout\n");

    const opened = await change.open(cascade.nodes.find((n) => n.workId === "leaf-1") as CascadeNode, ctx);
    expect(opened.ok).toBe(false);
    if (opened.ok) throw new Error("expected a refusal");
    expect(opened.reason).toContain("is not a checkout of");
  });
});

describe("the refusals", () => {
  test("a branch that already exists is refused, not silently reused", async () => {
    const { cwd, worktreeRoot } = repo("dup");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    expect((await change.open(node("task-1"), { branch: "work/task-1" })).ok).toBe(true);
    const again = await change.open(node("task-2"), { branch: "work/task-1" });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toContain("work/task-1");
  });

  test("a base branch that does not exist is refused", async () => {
    const { cwd, worktreeRoot } = repo("nobase");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "no-such-base" });
    expect((await change.open(node("task-1"), { branch: "work/task-1" })).ok).toBe(false);
  });

  test("A MERGE THAT DID NOT HAPPEN IS REFUSED, and the work is NOT destroyed", async () => {
    // Removal comes after a successful merge on purpose: tidying up first would delete the only
    // checkout of work whose merge then refused.
    const { cwd, worktreeRoot } = repo("badmerge");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const r = await change.merge({ changeId: "c", branch: "never-existed", workdir: join(worktreeRoot, "never") });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("never-existed");
  });

  test("A FAILED MERGE LEAVES THE WORK ON DISK — removal comes after success, never before", async () => {
    // Tidying up first would delete the only checkout of work whose merge then refused, and the
    // branch would be the sole copy of something nobody could look at.
    const { cwd, worktreeRoot } = repo("keepwork");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const opened = await change.open(node("task-1"), { branch: "work/task-1" });
    if (!opened.ok) throw new Error(opened.reason);
    commitIn(checkoutOf(opened.value), "shared.txt", "from the worktree\n");

    // A conflicting commit on main, so the merge cannot succeed.
    writeFileSync(join(cwd, "shared.txt"), "from main\n");
    for (const args of [["add", "shared.txt"], ["commit", "-m", "conflicting"]]) {
      expect(spawnSync("git", args, { cwd, encoding: "utf-8" }).status).toBe(0);
    }

    const merged = await change.merge(opened.value);
    expect(merged.ok).toBe(false);
    // The work survives, in its own checkout, exactly where the port said it was.
    expect(existsSync(checkoutOf(opened.value))).toBe(true);
    expect(readFileSync(join(checkoutOf(opened.value), "shared.txt"), "utf-8")).toContain("from the worktree");
  });

  test("outside a repository it refuses rather than throwing", async () => {
    const root = mkdtempSync(join(tmpdir(), "worktree-none-"));
    const r = await gitWorktreeChangeControl({ cwd: root, worktreeRoot: root, baseBranch: "main" })
      .open(node("task-1"), { branch: "b" });
    expect(r.ok).toBe(false);
  });

  test("it says it is real, and where the worktrees live", () => {
    const port = gitWorktreeChangeControl({ cwd: ".", worktreeRoot: "/tmp/trees", baseBranch: "main" });
    expect(port.meta.fidelity).toBe(Fidelity.Real);
    expect(port.meta.describes).toContain("/tmp/trees");
  });
});

describe("worktreeDirName", () => {
  test("A BRANCH WITH A SLASH BECOMES ONE DIRECTORY, not a nested pair", () => {
    // `work/task-1` used verbatim would put every change inside a shared `work/` parent — and on
    // Windows the slash is not a legal name at all.
    expect(worktreeDirName("work/task-1")).toBe("work-task-1");
    expect(worktreeDirName("work/task-1")).not.toContain("/");
  });

  test("distinct branches stay distinct", () => {
    expect(worktreeDirName("work/task-1")).not.toBe(worktreeDirName("work/task-2"));
    expect(worktreeDirName("feature/a b")).toBe("feature-a-b");
  });

  test("ordinary names are left alone", () => {
    expect(worktreeDirName("task-1.fix_2")).toBe("task-1.fix_2");
  });
});

describe("THE CHANGE'S CHECKOUT REACHES THE WORK — otherwise the worktree is decorative", () => {
  /** A marker only present inside the worktree, so a wrong cwd is observable. */
  const markerCheck = "process.exit(require('node:fs').existsSync('marker.txt') ? 0 : 3)";

  test("commandWorkExecutor runs in `ctx.workdir` when one is given", async () => {
    const { cwd, worktreeRoot } = repo("exec-cwd");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const opened = await change.open(node("task-1"), { branch: "work/task-1" });
    if (!opened.ok) throw new Error(opened.reason);
    writeFileSync(join(checkoutOf(opened.value), "marker.txt"), "here\n");

    // Configured to run in the MAIN repo, which has no marker...
    const port = commandWorkExecutor({
      command: process.execPath,
      argsFor: () => ["-e", markerCheck],
      cwd,
    });
    const inWorktree = await port.execute(node("task-1"), { branch: "work/task-1", workdir: checkoutOf(opened.value) });
    expect(inWorktree.ok && inWorktree.value.succeeded).toBe(true);

    // ...and without the workdir it runs there and does not find it.
    const inRepo = await port.execute(node("task-1"), { branch: "work/task-1" });
    expect(inRepo.ok && inRepo.value.succeeded).toBe(false);
  });

  test("agentWorkExecutor's VERIFIER runs in `ctx.workdir` too", async () => {
    // The verifier is what decides, so a verifier judging the wrong tree would decide about work
    // that is not there — the sharpest form of this mistake.
    const { cwd, worktreeRoot } = repo("verify-cwd");
    const change = gitWorktreeChangeControl({ cwd, worktreeRoot, baseBranch: "main" });
    const opened = await change.open(node("task-1"), { branch: "work/task-1" });
    if (!opened.ok) throw new Error(opened.reason);
    writeFileSync(join(checkoutOf(opened.value), "marker.txt"), "here\n");

    const port = agentWorkExecutor({
      perform: () => ({ summary: "wrote the marker", artifacts: ["marker.txt"] }),
      verify: { command: process.execPath, argsFor: () => ["-e", markerCheck], cwd },
    });
    const inWorktree = await port.execute(node("task-1"), { branch: "work/task-1", workdir: checkoutOf(opened.value) });
    expect(inWorktree.ok && inWorktree.value.succeeded).toBe(true);

    const inRepo = await port.execute(node("task-1"), { branch: "work/task-1" });
    expect(inRepo.ok && inRepo.value.succeeded).toBe(false);
  });
});

describe("A MERGE THAT MOVES NOTHING IS NOT A MERGE", async () => {
  test("an EMPTY branch is refused — `git merge --no-ff` exits 0 on it, which read as success", async () => {
    // The defect, measured: `git merge --no-ff <branch>` where the branch points at the same commit
    // as HEAD prints "Already up to date." and returns 0. Both git adapters read that zero as a
    // merge and returned `merged:<branch>` as evidence, so a run whose work produced no commit
    // reported real delivery over a repository nothing had happened in.
    //
    // Every other test in this file COMMITS inside the change before merging, which is why the case
    // was never constructed and why 12 of 12 mutants passed over a branch no test reached.
    const { cwd, worktreeRoot } = repo("empty");
    const port = gitWorktreeChangeControl({ cwd, baseBranch: "main", worktreeRoot });
    const opened = await port.open(node("task-1"), { branch: "work/task-1" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    // Nothing is committed. The worktree exists and the branch exists; the change does not.
    const landed = await port.merge(opened.value);
    expect(landed.ok).toBe(false);
    if (landed.ok) return;
    expect(landed.reason).toContain("no commits");
    expect(landed.reason).toContain("a merge that moves nothing is not a merge");

    // ...and `main` is where it was, which is the fact the old `ok: true` was denying.
    const log = spawnSync("git", ["log", "--oneline"], { cwd, encoding: "utf-8" });
    expect((log.stdout ?? "").trim().split("\n")).toHaveLength(1);
  });

  test("A FILE IN THE WORKTREE IS NOT A COMMIT — uncommitted work is still refused", async () => {
    // The tempting fix is for change control to `git add -A` on the performer's behalf. It is not
    // taken: that would sweep whatever else is lying in the tree into a commit nobody wrote.
    const { cwd, worktreeRoot } = repo("dirty");
    const port = gitWorktreeChangeControl({ cwd, baseBranch: "main", worktreeRoot });
    const opened = await port.open(node("task-2"), { branch: "work/task-2" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    writeFileSync(join(checkoutOf(opened.value), "note.txt"), "the agent wrote this\n");

    const landed = await port.merge(opened.value);
    expect(landed.ok).toBe(false);
  });

  test("and the refusal is FALSIFIABLE: one commit is enough to make the same merge succeed", async () => {
    // Without this the check above could be a merge that never works, which is the opposite defect.
    const { cwd, worktreeRoot } = repo("committed");
    const port = gitWorktreeChangeControl({ cwd, baseBranch: "main", worktreeRoot });
    const opened = await port.open(node("task-3"), { branch: "work/task-3" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    commitIn(checkoutOf(opened.value), "note.txt", "committed\n");

    const landed = await port.merge(opened.value);
    expect(landed.ok).toBe(true);
    const log = spawnSync("git", ["log", "--oneline"], { cwd, encoding: "utf-8" });
    expect((log.stdout ?? "").trim().split("\n").length).toBeGreaterThan(1);
  });
});

describe("the SHARED-CHECKOUT adapter refuses the same way, and unknown is not zero", async () => {
  test("gitChangeControl also refuses an empty branch — both adapters, one rule", async () => {
    // The worktree variant had a test and this one did not, so the mutation matrix killed the
    // mutant on one branch and survived on the other. Two adapters implementing one rule need two
    // falsifiers, or half the rule is enforced by nothing.
    const { cwd } = repo("shared-empty");
    const port = gitChangeControl({ cwd, baseBranch: "main" });
    const opened = await port.open(node("task-1"), { branch: "work/task-1" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const landed = await port.merge(opened.value);
    expect(landed.ok).toBe(false);
    if (landed.ok) return;
    expect(landed.reason).toContain("nothing to merge");
  });

  test("A COUNT GIT CANNOT ANSWER IS UNKNOWN, and unknown refuses rather than guessing", async () => {
    // `rev-list --count HEAD..<branch>` on a branch that does not exist exits non-zero. Reading
    // that as 0 would refuse a real merge; reading it as 1 would permit an empty one. Both mutants
    // survived until this test existed, because no test ever made git fail to answer.
    const { cwd, worktreeRoot } = repo("unknown");
    const port = gitWorktreeChangeControl({ cwd, baseBranch: "main", worktreeRoot });
    const landed = await port.merge({ changeId: "c", branch: "work/never-created" });
    expect(landed.ok).toBe(false);
    if (landed.ok) return;
    // The wording matters: "could not tell" is a different statement from "there is nothing there".
    expect(landed.reason).toContain("could not tell");
  });
});

describe("commitsAhead: every way of not knowing answers UNKNOWN", () => {
  test("a normal count is returned as a number", () => {
    // Trailing whitespace is what git actually prints, and `.trim()` is what handles it.
    expect(commitsAhead(() => ({ status: 0, stdout: "3\n" }), "b")).toBe(3);
    expect(commitsAhead(() => ({ status: 0, stdout: "0\n" }), "b")).toBe(0);
  });

  test("GIT FAILING is unknown, not zero", () => {
    expect(commitsAhead(() => ({ status: 128, stdout: "" }), "b")).toBeUndefined();
  });

  test("AND AN UNPARSEABLE ANSWER IS ALSO UNKNOWN — the path no adapter call can reach", () => {
    // This is why the function takes its runner as a parameter. Through `gitWorktreeChangeControl`
    // there is no way to make git exit 0 and print something that is not a number, so the guard was
    // unreachable defensive code and a mutant turning it into `? 1 :` survived — a mutant that
    // would have let an EMPTY branch merge whenever git answered strangely.
    expect(commitsAhead(() => ({ status: 0, stdout: "not a number" }), "b")).toBeUndefined();
    expect(commitsAhead(() => ({ status: 0, stdout: "" }), "b")).toBeUndefined();
    // ...and 1 in particular, because that is the value the surviving mutant chose.
    expect(commitsAhead(() => ({ status: 0, stdout: "nonsense" }), "b")).not.toBe(1);
  });
});

describe("a merge git REFUSES is still a refusal — the conflict path", () => {
  test("gitChangeControl reports a real merge conflict rather than 'merged'", async () => {
    // COVERAGE THIS BRANCH LOST AND GOT BACK. Before the empty-branch guard, the test that reached
    // `if (merged.status !== 0)` did so with a branch that had nothing on it — and once "nothing to
    // merge" became its own refusal, the git-level failure was reached by no test at all. The
    // mutant that deleted the conflict refusal then survived: an adapter that would have reported
    // `merged:` over a conflicted tree.
    //
    // So the case is constructed properly here: two branches that genuinely disagree about one file.
    const { cwd } = repo("conflict");
    const git = (...args: string[]) => spawnSync("git", args, { cwd, encoding: "utf-8" });

    // main gains a line...
    writeFileSync(join(cwd, "shared.txt"), "from main\n");
    git("add", "shared.txt");
    git("-c", "user.email=t@example.invalid", "-c", "user.name=T", "commit", "-m", "main writes");

    // ...and a branch off the ORIGINAL commit writes the same file differently.
    git("checkout", "-b", "work/clash", "HEAD~1");
    writeFileSync(join(cwd, "shared.txt"), "from the branch\n");
    git("add", "shared.txt");
    git("-c", "user.email=t@example.invalid", "-c", "user.name=T", "commit", "-m", "branch writes");
    git("checkout", "main");

    const port = gitChangeControl({ cwd, baseBranch: "main" });
    const landed = await port.merge({ changeId: "c", branch: "work/clash" });
    expect(landed.ok).toBe(false);
    if (landed.ok) return;
    expect(landed.reason).toContain("refused");
    // And NOT the empty-branch reason: the branch has a commit, so this is git saying no.
    expect(landed.reason).not.toContain("no commits");

    // The conflict is left for a human; the adapter does not pretend it landed.
    git("merge", "--abort");
  });
});

describe("A NEW WORKTREE IS MADE RUNNABLE BEFORE ANYTHING IS SENT INTO IT", () => {
  // MEASURED on the Agentic Team's repositories: every one is an npm monorepo, and a fresh worktree
  // has no `node_modules` — every verifier and QA run in it would fail for a reason unrelated to the
  // change.
  const LINKER = join(import.meta.dir, "..", "..", "..", "tools", "link-deps.cjs");

  test("the setup runs once in the new worktree and the base's dependency directories are linked", async () => {
    const { cwd, worktreeRoot } = repo("setup");
    mkdirSync(join(cwd, "node_modules", "left-pad"), { recursive: true });
    writeFileSync(join(cwd, "node_modules", "left-pad", "index.js"), "module.exports = 1;\n");
    const port = gitWorktreeChangeControl({ cwd, baseBranch: "main", worktreeRoot, setup: { command: "node", args: [LINKER] } });
    const opened = await port.open(node("w-1"), { branch: "bug/SETUP-1" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const wd = opened.value.workdir as string;
    expect(readFileSync(join(wd, "node_modules", "left-pad", "index.js"), "utf-8")).toContain("module.exports");
  });

  test("a setup that FAILS refuses the change — never a checkout whose tests cannot run", async () => {
    const { cwd, worktreeRoot } = repo("setup-fail");
    const port = gitWorktreeChangeControl({ cwd, baseBranch: "main", worktreeRoot, setup: { command: "node", args: ["-e", "process.exit(7)"] } });
    const opened = await port.open(node("w-2"), { branch: "bug/SETUP-2" });
    expect(opened.ok).toBe(false);
    if (!opened.ok) expect(opened.reason).toContain("could not be made runnable");
  });

  test("with no setup the adapter behaves as it always did", async () => {
    const { cwd, worktreeRoot } = repo("no-setup");
    const port = gitWorktreeChangeControl({ cwd, baseBranch: "main", worktreeRoot });
    expect((await port.open(node("w-3"), { branch: "bug/SETUP-3" })).ok).toBe(true);
  });
});
