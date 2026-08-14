// complete-workitem-concurrency.test.ts — the acceptance criteria for
// 081KZZ3Q990087G0R003QXYVN6, stated as a DEMONSTRATION against a CONTROL.
//
// The claim under test is "two work-item completions generated concurrently both land
// with no conflict". A demonstration without a control proves nothing — a merge that
// succeeds might succeed for reasons unrelated to the change. So each scenario is run
// twice over real `git`, on the same fixture, differing only in whether the retired
// shared `workitems/done/index.jsonl` append happens:
//
//   TREATMENT (what `complete-workitem.ts` does now) — two branches, two completions,
//             disjoint ZetaId-keyed paths → both merges succeed.
//   CONTROL   (the shape that was removed) — the identical two completions, plus the
//             one-line append to the shared index → the second merge CONFLICTS.
//
// The control reconstructs the retired append inline (`appendRetiredIndexLine`) rather
// than importing it, because the production code no longer contains it. That is the
// point: the defect has to be re-created on purpose to be reproduced.

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { completeWorkItem, type CompletedWorkItem } from "./complete-workitem";
import { mintWorkItem, type WorkItemEnv } from "./new-workitem";

const GIT_TIMEOUT_MS = 15_000; // bunfig `[test] timeout` is a no-op; the real cap is 5000 ms (#10539)

const detEnv = (ms: number): WorkItemEnv => ({ nowMs: () => ms, nextInt64: () => 0n });

function git(cwd: string, args: readonly string[]): { status: number; out: string } {
  try {
    const out = execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { status: 0, out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

/** A repo with two OPEN work-items on `main`, ready for two agents to complete one each. */
function seedRepo(): { root: string; a: string; b: string } {
  const root = mkdtempSync(join(tmpdir(), "zeta-done-index-"));
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "shadow@example.invalid"]);
  git(root, ["config", "user.name", "shadow"]);
  git(root, ["config", "commit.gpgsign", "false"]);

  const wi = join(root, "workitems");
  mkdirSync(wi, { recursive: true });
  const mintA = mintWorkItem({ title: "Agent A item", type: "task", priority: "P2" }, detEnv(Date.UTC(2026, 0, 1)));
  const mintB = mintWorkItem({ title: "Agent B item", type: "bug", priority: "P1" }, detEnv(Date.UTC(2026, 0, 2)));
  writeFileSync(join(wi, mintA.filename), mintA.content, "utf8");
  writeFileSync(join(wi, mintB.filename), mintB.content, "utf8");
  git(root, ["add", "-A"]);
  git(root, ["commit", "-qm", "two open work-items"]);
  return { root, a: join(wi, mintA.filename), b: join(wi, mintB.filename) };
}

/** Exactly the filesystem effect `complete-workitem.ts` performs today (no events). */
function applyCompletion(fromPath: string, atMs: number): CompletedWorkItem {
  const done = completeWorkItem(readFileSync(fromPath, "utf8"), fromPath, detEnv(atMs));
  mkdirSync(dirname(done.toPath), { recursive: true });
  writeFileSync(done.toPath, done.newContent, "utf8");
  rmSync(done.fromPath);
  return done;
}

/** The RETIRED behaviour, reconstructed for the control only. */
function appendRetiredIndexLine(done: CompletedWorkItem, workItemsDir: string): void {
  const title = /^title:\s*(.*)$/m.exec(done.newContent)?.[1]?.trim().replace(/^"|"$/g, "") ?? "";
  const completed = /^completed:\s*(.*)$/m.exec(done.newContent)?.[1]?.trim() ?? "";
  const line = `${JSON.stringify({ id: done.zetaid, path: done.toPath, completed, title })}\n`;
  const indexPath = join(workItemsDir, "done", "index.jsonl");
  mkdirSync(dirname(indexPath), { recursive: true });
  appendFileSync(indexPath, line, "utf8");
}

/** Complete one item on its own branch cut from `main`, then return to `main`. */
function completeOnBranch(root: string, branch: string, itemPath: string, atMs: number, withIndex: boolean): void {
  git(root, ["checkout", "-q", "-b", branch, "main"]);
  const done = applyCompletion(itemPath, atMs);
  if (withIndex) appendRetiredIndexLine(done, join(root, "workitems"));
  git(root, ["add", "-A"]);
  git(root, ["commit", "-qm", `complete ${done.zetaid}`]);
  git(root, ["checkout", "-q", "main"]);
}

/** Run the two-concurrent-completions scenario; report both merge outcomes. */
function twoConcurrentCompletions(withIndex: boolean): {
  root: string;
  first: { status: number; out: string };
  second: { status: number; out: string };
} {
  const { root, a, b } = seedRepo();
  completeOnBranch(root, "agent-a", a, Date.UTC(2026, 7, 14, 1), withIndex);
  completeOnBranch(root, "agent-b", b, Date.UTC(2026, 7, 14, 2), withIndex);
  const first = git(root, ["merge", "--no-edit", "-q", "agent-a"]);
  const second = git(root, ["merge", "--no-edit", "-q", "agent-b"]);
  return { root, first, second };
}

describe("§2 lock-free — two concurrent completions, demonstrated with real git", () => {
  test(
    "TREATMENT: no shared aggregate — both completions merge with NO conflict",
    () => {
      const { root, first, second } = twoConcurrentCompletions(false);
      expect(first.status).toBe(0);
      expect(second.status).toBe(0); // ← the whole point: the second merge does not conflict
      expect(second.out).not.toContain("CONFLICT");

      // Both records landed, in their own disjoint files, and no aggregate was created.
      const ls = git(root, ["ls-files", "workitems/done"]).out.trim().split("\n");
      expect(ls.filter((p) => p.endsWith(".md")).length).toBe(2);
      expect(existsSync(join(root, "workitems/done/index.jsonl"))).toBe(false);
    },
    GIT_TIMEOUT_MS,
  );

  test(
    "CONTROL: the SAME two completions plus the retired index append DO conflict",
    () => {
      const { root, first, second } = twoConcurrentCompletions(true);
      expect(first.status).toBe(0);
      expect(second.status).not.toBe(0); // ← the defect this work removes, reproduced
      expect(second.out).toContain("CONFLICT");
      expect(second.out).toContain("workitems/done/index.jsonl");
      git(root, ["merge", "--abort"]);
    },
    GIT_TIMEOUT_MS,
  );
});

describe("§12 idempotency — re-completing an already-done item", () => {
  test("is refused, so it can neither duplicate a record nor duplicate an index line", () => {
    const { a } = seedRepo();
    const done = applyCompletion(a, Date.UTC(2026, 7, 14, 1));
    // The done file is the record; re-running against it is rejected on the terminal state,
    // which is what makes completion apply-N-times == apply-once.
    expect(() =>
      completeWorkItem(readFileSync(done.toPath, "utf8"), done.toPath, detEnv(Date.UTC(2026, 7, 14, 3))),
    ).toThrow(/already terminal/);
  });

  test("a second completion ADDRESSES the same record rather than appending another", () => {
    const { a } = seedRepo();
    const src = readFileSync(a, "utf8");
    // Same item, two different completion instants within one month. The record is ADDRESSED by
    // its ZetaId, so the second write lands on the same path (an upsert) — where the retired
    // JSONL append would have produced a second line for the same id.
    const one = completeWorkItem(src, a, detEnv(Date.UTC(2026, 7, 14)));
    const two = completeWorkItem(src, a, detEnv(Date.UTC(2026, 7, 20)));
    expect(one.zetaid).toBe(two.zetaid);
    expect(one.toPath).toBe(two.toPath);
    // …and the content genuinely differs, so the assertion above is not vacuous.
    expect(two.newContent).not.toBe(one.newContent);
    expect(two.newContent).toContain("completed: 2026-08-20T");
  });
});

describe("the removed index carried no information the shard store lacks", () => {
  test("every field of a retired index line is a projection of the done file", () => {
    const { a } = seedRepo();
    const done = applyCompletion(a, Date.UTC(2026, 7, 14, 1));
    const content = readFileSync(done.toPath, "utf8");
    const field = (f: string): string =>
      (new RegExp(`^${f}:\\s*(.*)$`, "m").exec(content)?.[1] ?? "").trim().replace(/^"|"$/g, "");
    // id · path · completed · title — the four fields the JSONL line held.
    expect(basename(done.toPath).slice(0, 26)).toBe(done.zetaid);
    expect(field("id")).toBe(done.zetaid);
    expect(field("completed")).toBe("2026-08-14T01:00:00.000Z");
    expect(field("title")).toBe("Agent A item");
  });
});
