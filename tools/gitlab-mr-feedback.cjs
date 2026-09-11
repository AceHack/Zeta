#!/usr/bin/env node
/**
 * gitlab-mr-feedback.cjs — what happened to the organization's merge requests, read from GitLab.
 *
 * ── A READ, AND ONLY A READ ──────────────────────────────────────────────────
 * The poller half of the after-the-handoff seam (`followup-commands.ts`): given the handed-off
 * changes on stdin, it asks GitLab what happened to each and prints one DELIVERY per event as a JSON
 * line. It writes nothing to GitLab - no comment, no label, no approval - and it decides nothing: a
 * delivery becomes an action item on the work, and the organization decides what to do about it.
 *
 * The same shape a webhook delivery is filed in, so a project that can reach this machine with
 * webhooks and one that cannot are the same organization. Every delivery id is STABLE per event
 * (a note's id, a target's commit), which is what makes a second poll raise nothing new.
 *
 *   comment          a person's note on the request (system notes are GitLab's own and are skipped)
 *   merged / closed  the request left the open state - somebody integrated or abandoned it
 *   pipeline_failed  the request's head pipeline failed
 *   target_moved     the branch it targets is at a commit; the organization measures whether the
 *                    change is behind it before raising anything
 *
 * ── CONTRACT ─────────────────────────────────────────────────────────────────
 *   stdin               {"changes":[{"workId","branch","url","base"?}]}
 *   ORG_GLAB_BIN        the glab binary (default: the installed one); ORG_GLAB_BIN_ARGS a JSON array
 *                       of arguments placed before `api` (for a stand-in in tests)
 *   ORG_FEEDBACK_SOURCE the source name deliveries carry (default: gitlab)
 * Run inside the repository: `glab api` resolves the project and host from its remote, and
 * authenticates with glab's own stored login. No token passes through here or argv.
 */
"use strict";
const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const NL = String.fromCharCode(10);
const env = process.env;
const source = (env.ORG_FEEDBACK_SOURCE || "gitlab").trim() || "gitlab";

function fail(code, message) {
  process.stderr.write("[gitlab-mr-feedback] " + message + NL);
  process.exit(code);
}

function glab() {
  if (env.ORG_GLAB_BIN) return env.ORG_GLAB_BIN;
  if (process.platform === "win32" && env.LOCALAPPDATA) {
    const installed = join(env.LOCALAPPDATA, "Programs", "glab", "glab.exe");
    if (existsSync(installed)) return installed;
  }
  return "glab";
}
const prefix = (() => {
  try {
    return env.ORG_GLAB_BIN_ARGS ? JSON.parse(env.ORG_GLAB_BIN_ARGS) : [];
  } catch {
    return fail(2, "ORG_GLAB_BIN_ARGS is not a JSON array");
  }
})();

function api(path) {
  const r = spawnSync(glab(), [...prefix, "api", path], { encoding: "utf-8", shell: false, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  if (r.error) throw new Error("glab could not run: " + r.error.message);
  if (r.status !== 0) throw new Error("glab api " + path + " failed: " + String(r.stderr || r.stdout || "").trim().slice(0, 400));
  return JSON.parse(String(r.stdout || "null"));
}

function emit(delivery) {
  process.stdout.write(JSON.stringify(delivery) + NL);
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf-8"));
} catch {
  fail(2, "stdin is not JSON");
}
const changes = Array.isArray(input && input.changes) ? input.changes : [];
const targets = new Map();
let failures = 0;

for (const c of changes) {
  const m = /\/merge_requests\/(\d+)/.exec(String(c.url || ""));
  if (!m) continue;
  const iid = m[1];
  const mrUrl = String(c.url).replace(/#.*$/, "");
  try {
    const mr = api("projects/:id/merge_requests/" + iid);
    if (mr && mr.state && mr.state !== "opened") {
      emit({ deliveryId: "mr-" + iid + "-" + mr.state, source, itemKind: mr.state, summary: "the merge request was " + mr.state + (mr.merged_by ? " by " + mr.merged_by.username : mr.closed_by ? " by " + mr.closed_by.username : ""), url: mrUrl, changeUrl: mrUrl });
    }
    const pipe = mr && mr.head_pipeline;
    if (pipe && pipe.status === "failed") {
      emit({ deliveryId: "pipeline-" + String(pipe.id) + "-failed", source, itemKind: "pipeline_failed", summary: "the request's pipeline " + String(pipe.id) + " failed", url: String(pipe.web_url || mrUrl), changeUrl: mrUrl });
    }
    if (mr && mr.target_branch) targets.set(mr.target_branch, true);
    // Every note, oldest first, page by page. System notes are GitLab narrating itself.
    for (let page = 1; page < 50; page++) {
      const notes = api("projects/:id/merge_requests/" + iid + "/notes?sort=asc&order_by=created_at&per_page=100&page=" + page);
      if (!Array.isArray(notes) || notes.length === 0) break;
      for (const n of notes) {
        if (n.system) continue;
        const where = n.position && n.position.new_path ? " (on " + n.position.new_path + (n.position.new_line ? ":" + n.position.new_line : "") + ")" : "";
        const body = String(n.body || "").trim();
        emit({
          deliveryId: "note-" + String(n.id),
          source,
          itemKind: n.position ? "diff_comment" : "comment",
          summary: body.split(/\s+/).join(" ").slice(0, 300) + where,
          detail: body + where,
          author: n.author && n.author.username ? n.author.username : undefined,
          url: mrUrl + "#note_" + String(n.id),
          changeUrl: mrUrl,
        });
      }
      if (notes.length < 100) break;
    }
  } catch (e) {
    failures += 1;
    process.stderr.write("[gitlab-mr-feedback] " + String(c.url) + ": " + String((e && e.message) || e) + NL);
  }
}

// A TARGET IS REPORTED AT ITS COMMIT, once per poll: each commit is its own event, so the same
// commit polled twice raises nothing twice, and a new one is a new item only where the change is behind.
for (const target of targets.keys()) {
  try {
    const b = api("projects/:id/repository/branches/" + encodeURIComponent(target));
    const sha = b && b.commit && b.commit.id;
    if (sha) emit({ deliveryId: "target-" + target + "-" + sha, source, itemKind: "target_moved", summary: target + " is at " + String(sha).slice(0, 12), target, targetCommit: sha });
  } catch (e) {
    failures += 1;
    process.stderr.write("[gitlab-mr-feedback] target " + target + ": " + String((e && e.message) || e) + NL);
  }
}

// A poll that could read nothing is a failure, not an empty answer: "no feedback" and "could not look"
// are different sentences, and the second must not read as the first.
if (failures > 0 && failures >= changes.length + targets.size) fail(3, "could not read any merge request");
process.exit(0);
