/**
 * gitlab-mr-feedback.test.ts — the GitLab poller turns what happened to a merge request into
 * deliveries, reads only, and never mistakes "could not look" for "nothing happened".
 *
 * Driven against a STAND-IN for glab that answers by API path, so the mapping is pinned without a
 * GitLab. The deliveries it prints are fed back through `asDelivery` - the same reader the runtime
 * uses - so a field the poller emits and the runtime drops would fail here.
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { asDelivery } from "./followup-commands";

const POLLER = resolve(import.meta.dir, "..", "..", "..", "tools", "gitlab-mr-feedback.cjs");

function poll(answers: Record<string, unknown>, changes: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), "mr-feedback-"));
  const stub = join(dir, "glab.cjs");
  const calls = join(dir, "calls.txt");
  writeFileSync(
    stub,
    `const fs=require("fs");const a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(calls)},a.join(" ")+"\\n");` +
      `const answers=${JSON.stringify(answers)};const path=a[a.length-1];` +
      `const hit=Object.keys(answers).find(k=>path.startsWith(k));` +
      `if(hit===undefined){process.stderr.write("no such path "+path);process.exit(1);}` +
      `process.stdout.write(JSON.stringify(answers[hit]));`,
  );
  const r = spawnSync("node", [POLLER], {
    input: JSON.stringify({ changes }),
    encoding: "utf-8",
    env: { ...process.env, ORG_GLAB_BIN: "node", ORG_GLAB_BIN_ARGS: JSON.stringify([stub]) },
  });
  const deliveries = r.stdout.split(/\r?\n/).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as Record<string, unknown>);
  const seen = spawnSync("node", ["-e", `process.stdout.write(require("fs").readFileSync(${JSON.stringify(calls)},"utf-8"))`], { encoding: "utf-8" }).stdout;
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, stderr: r.stderr, deliveries, calls: seen };
}

const MR = "https://git.example/g/p/-/merge_requests/162";

describe("WHAT HAPPENED TO A REQUEST BECOMES DELIVERIES, AND ONLY READS ARE MADE", () => {
  test("a person's note, a failed pipeline and the target's commit each become a delivery the runtime can read; system notes do not", () => {
    const r = poll(
      {
        "projects/:id/merge_requests/162/notes": [
          { id: 7, system: true, body: "added 1 commit" },
          { id: 8, system: false, body: "Please explain the race.", author: { username: "reviewer" } },
          { id: 9, system: false, body: "typo", author: { username: "reviewer" }, position: { new_path: "src/a.ts", new_line: 12 } },
        ],
        "projects/:id/merge_requests/162": { state: "opened", target_branch: "master", head_pipeline: { id: 55, status: "failed", web_url: "https://git.example/p/55" } },
        "projects/:id/repository/branches/master": { commit: { id: "abcdef0123456789" } },
      },
      [{ workId: "task-24", branch: "defect/AIAGENT-1660", url: MR }],
    );
    expect(r.status).toBe(0);
    const ids = r.deliveries.map((d) => d["deliveryId"]);
    expect(ids).toEqual(["pipeline-55-failed", "note-8", "note-9", "target-master-abcdef0123456789"]);
    const diff = r.deliveries.find((d) => d["deliveryId"] === "note-9");
    expect(diff?.["itemKind"]).toBe("diff_comment");
    expect(String(diff?.["summary"])).toContain("src/a.ts:12");
    expect(diff?.["changeUrl"]).toBe(MR);
    // Every delivery survives the runtime's own reader - nothing emitted is silently dropped.
    expect(r.deliveries.every((d) => asDelivery(d) !== undefined)).toBe(true);
    // READS ONLY: no method other than GET was ever asked for.
    expect(r.calls).not.toContain("--method");
  });

  test("a request somebody merged or closed is reported as such", () => {
    const r = poll(
      {
        "projects/:id/merge_requests/162/notes": [],
        "projects/:id/merge_requests/162": { state: "merged", merged_by: { username: "max" }, target_branch: "master" },
        "projects/:id/repository/branches/master": { commit: { id: "1234" } },
      },
      [{ workId: "task-24", branch: "b", url: MR }],
    );
    expect(r.deliveries[0]).toMatchObject({ deliveryId: "mr-162-merged", itemKind: "merged" });
    expect(String(r.deliveries[0]?.["summary"])).toContain("by max");
  });

  test("COULD NOT LOOK IS NOT NOTHING HAPPENED: a poll that reads no request fails", () => {
    const r = poll({}, [{ workId: "task-24", branch: "b", url: MR }]);
    expect(r.status).toBe(3);
    expect(r.deliveries).toEqual([]);
  });
});
