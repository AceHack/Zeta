/**
 * gitlab-mr-answer.test.ts — a reviewer is answered on their own thread with what the organization
 * decided, the thread is resolved when asked, and nothing is posted that was not decided.
 *
 * Driven against a STAND-IN for glab that records every call (method, path, body), so what reaches
 * GitLab is pinned without a GitLab. Results are fed through `commandAnswerer`'s own parser.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { commandAnswerer } from "./followup-commands";
import type { AnswerItem, AnswerResult } from "./change-followup";

const ANSWERER = resolve(import.meta.dir, "..", "..", "..", "tools", "gitlab-mr-answer.cjs");
const MR = "https://git.example/g/p/-/merge_requests/164";

interface Call { readonly method: string; readonly path: string; readonly body?: { body?: string } }

const DISCUSSIONS = [
  // A diff comment: a resolvable thread.
  { id: "d-diff", individual_note: false, notes: [{ id: 101, resolvable: true, resolved: false, body: "cap the limit" }] },
  // A plain comment: an individual note, not resolvable.
  { id: "d-plain", individual_note: true, notes: [{ id: 102, resolvable: false, resolved: false, body: "aireview" }] },
  // A thread somebody already resolved.
  { id: "d-done", individual_note: false, notes: [{ id: 103, resolvable: true, resolved: true, body: "nit" }] },
];

async function answer(items: AnswerItem[], resolveThreads: boolean, opts: { failPut?: boolean; failList?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "mr-answer-"));
  const stub = join(dir, "glab.cjs");
  const calls = join(dir, "calls.jsonl");
  writeFileSync(
    stub,
    `const fs=require("fs");const a=process.argv.slice(2);` +
      `const mi=a.indexOf("-X");const method=mi>=0?a[mi+1]:"GET";const path=a.find(x=>x.startsWith("projects/"));` +
      `const body=a.includes("--input")?JSON.parse(fs.readFileSync(0,"utf-8")):undefined;` +
      `fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify({method,path,body})+"\\n");` +
      `if(method==="GET"){if(${opts.failList === true})process.exit(1);process.stdout.write(JSON.stringify(path.includes("page=1")?${JSON.stringify(DISCUSSIONS)}:[]));process.exit(0);}` +
      `if(method==="POST"){process.stdout.write(JSON.stringify({id:900+Number(fs.readFileSync(${JSON.stringify(calls)},"utf-8").split("\\n").length)}));process.exit(0);}` +
      `if(method==="PUT"){if(${opts.failPut === true}){process.stderr.write("422");process.exit(1);}process.stdout.write("{}");process.exit(0);}`,
  );
  process.env["ORG_GLAB_BIN"] = "node";
  process.env["ORG_GLAB_BIN_ARGS"] = JSON.stringify([stub]);
  try {
    const run = commandAnswerer({ command: "node", args: [ANSWERER] }, dir);
    const r = await run({ workId: "task-040", changeUrl: MR, branch: "defect/x", resolve: resolveThreads, items });
    // READ, THEN INTERPRET ENOENT. `existsSync` gating `readFileSync` leaves a
    // window the answer is stale in, and the read reports absence itself --
    // absent here means "the stub recorded no calls", which is exactly the empty
    // array the ternary produced.
    let seen: Call[];
    try {
      seen = readFileSync(calls, "utf-8").split("\n").filter((l) => l !== "").map((l) => JSON.parse(l) as Call);
    } catch {
      seen = [];
    }
    return { r, calls: seen };
  } finally {
    delete process.env["ORG_GLAB_BIN"];
    delete process.env["ORG_GLAB_BIN_ARGS"];
    rmSync(dir, { recursive: true, force: true });
  }
}

const item = (id: string, note: number, over: Partial<AnswerItem> = {}): AnswerItem => ({
  actionItemId: id,
  source: "gitlab",
  itemKind: "diff_comment",
  url: `${MR}#note_${String(note)}`,
  outcome: "addressed",
  how: "Capped the accepted limit at 50 in routes/oversight.ts; oversight.findings test asserts it.",
  when: "always",
  ...over,
});

const ok = (r: Awaited<ReturnType<typeof answer>>["r"]): readonly AnswerResult[] => {
  if (!r.ok) throw new Error(r.reason);
  return r.value;
};

describe("A REVIEWER IS ANSWERED ON THEIR OWN THREAD", () => {
  test("a fixed comment gets a reply naming the commit and what changed, on ITS thread, and the thread is resolved", async () => {
    const { r, calls } = await answer([item("gitlab:note-101", 101, { commit: "452fcafab1a24093" })], true);
    const [res] = ok(r);
    expect(res).toMatchObject({ actionItemId: "gitlab:note-101", resolved: true });
    expect("replyId" in (res as object) && String((res as { replyId?: string }).replyId)).toMatch(/^note-\d+$/);
    const post = calls.find((c) => c.method === "POST");
    expect(post?.path).toBe("projects/:id/merge_requests/164/discussions/d-diff/notes");
    expect(post?.body?.body).toContain("**Fixed** in 452fcafa.");
    expect(post?.body?.body).toContain("Capped the accepted limit at 50");
    expect(calls.find((c) => c.method === "PUT")?.path).toBe("projects/:id/merge_requests/164/discussions/d-diff?resolved=true");
  });

  test("a declined comment is answered with why not, and resolved too", async () => {
    const { r, calls } = await answer([item("gitlab:note-101", 101, { outcome: "declined", how: "The suggested cap would drop rows: visibleFindings filters after the read." })], true);
    expect(ok(r)[0]).toMatchObject({ resolved: true });
    const body = calls.find((c) => c.method === "POST")?.body?.body ?? "";
    expect(body.startsWith("**Not changed.**")).toBe(true);
    expect(body).toContain("visibleFindings filters after the read");
  });

  test("with replies=reply the thread is answered and LEFT for the reviewers to resolve", async () => {
    const { r, calls } = await answer([item("gitlab:note-101", 101)], false);
    expect(ok(r)[0]).toMatchObject({ resolved: false });
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  test("an item settled before answering existed is answered only where it is a resolvable thread", async () => {
    const { r, calls } = await answer(
      [item("gitlab:note-101", 101, { when: "if_thread" }), item("gitlab:note-102", 102, { when: "if_thread", itemKind: "comment" })],
      true,
    );
    const res = ok(r);
    expect(res.find((x) => x.actionItemId === "gitlab:note-101")).toMatchObject({ resolved: true });
    expect(res.find((x) => x.actionItemId === "gitlab:note-102")).toMatchObject({ skipped: expect.stringContaining("not a resolvable thread") });
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });

  test("an item that is not a comment (a pipeline, an operator's note) is skipped, never posted somewhere else", async () => {
    const { r, calls } = await answer([item("gitlab:pipeline-9-failed", 0, { url: "https://build.example/job/9", itemKind: "pipeline_failed" })], true);
    expect(ok(r)[0]).toMatchObject({ skipped: expect.stringContaining("not a comment") });
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
  });

  test("a thread GitLab will not resolve keeps its reply and says it is still open", async () => {
    const { r } = await answer([item("gitlab:note-102", 102, { itemKind: "comment" })], true, { failPut: true });
    const [res] = ok(r);
    expect(res).toMatchObject({ resolved: false });
    expect((res as { replyId?: string }).replyId).toMatch(/^note-/);
  });

  test("COULD NOT LOOK IS NOT NOTHING TO SAY: an unreadable request makes every item an error, so each is tried again", async () => {
    const { r, calls } = await answer([item("gitlab:note-101", 101)], true, { failList: true });
    expect(ok(r)[0]).toHaveProperty("error");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
});
