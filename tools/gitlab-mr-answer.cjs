#!/usr/bin/env node
/**
 * gitlab-mr-answer.cjs — answer a reviewer on their own thread, once the organization has decided.
 *
 * ── WRITES ONLY WHAT WAS ALREADY DECIDED ─────────────────────────────────────
 * The answering half of the after-the-handoff seam (`followup-commands.ts`). Given one merge request's
 * SETTLED action items on stdin, it replies on the thread each comment lives in - what was changed and
 * in which commit, or why nothing was - and resolves the thread when asked to. It decides nothing:
 * every word it posts is the organization's recorded account of the item, and it is called only after
 * the change that settles an item has been pushed, so "fixed in abc123" is never posted before abc123.
 *
 * MEASURED on MRs !162-!164: 26 reviewer comments decided and acted on, and not one reviewer was told.
 *
 * ── CONTRACT ─────────────────────────────────────────────────────────────────
 *   stdin   {"changeUrl", "resolve": bool, "items": [{"actionItemId","url","outcome","how","commit"?,"when"}]}
 *           `url` is where the item was raised (`...#note_<id>`); `when` is `always` or `if_thread`
 *           (answer only where the comment is a resolvable thread).
 *   stdout  one JSON line per item: {"actionItemId","replyId","resolved"} | {"actionItemId","skipped","resolved":false}
 *           | {"actionItemId","error"}. An error is retried by the organization next time; a skip is not.
 *   ORG_GLAB_BIN / ORG_GLAB_BIN_ARGS as in gitlab-mr-feedback.cjs (a stand-in for tests).
 * Run inside the repository: `glab api` resolves the project and host from its remote and uses glab's
 * own stored login. The reply body travels on stdin to glab, never on argv.
 */
"use strict";
const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const NL = String.fromCharCode(10);
const env = process.env;

function fail(code, message) {
  process.stderr.write("[gitlab-mr-answer] " + message + NL);
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

function api(args, input) {
  const r = spawnSync(glab(), [...prefix, "api", ...args], {
    encoding: "utf-8",
    shell: false,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    ...(input === undefined ? {} : { input }),
  });
  if (r.error) throw new Error("glab could not run: " + r.error.message);
  if (r.status !== 0) throw new Error("glab api " + args.join(" ") + " failed: " + String(r.stderr || r.stdout || "").trim().slice(0, 400));
  const out = String(r.stdout || "").trim();
  return out === "" ? null : JSON.parse(out);
}

function emit(result) {
  process.stdout.write(JSON.stringify(result) + NL);
}

const LEAD = { addressed: "**Fixed**", declined: "**Not changed.**", superseded: "**Superseded.**" };

/** The reply a reviewer reads. The organization's account, verbatim, under a line that says what happened. */
function replyBody(item) {
  const commit = typeof item.commit === "string" && item.commit.trim() !== "" ? item.commit.trim().slice(0, 8) : "";
  const lead =
    item.outcome === "addressed"
      ? commit === "" ? "**Addressed.**" : LEAD.addressed + " in " + commit + "."
      : LEAD[item.outcome] || "**" + String(item.outcome) + ".**";
  return (
    lead + NL + NL + String(item.how || "").trim() + NL + NL + "---" + NL +
    "_Answered by the agentic team working this change (automated). Reply on this thread if it does not settle your comment._"
  );
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf-8"));
} catch {
  fail(2, "stdin is not JSON");
}
const items = Array.isArray(input && input.items) ? input.items : [];
const m = /\/merge_requests\/(\d+)/.exec(String((input && input.changeUrl) || ""));
if (!m) {
  for (const it of items) emit({ actionItemId: it.actionItemId, skipped: "the change has no merge request to answer on", resolved: false });
  process.exit(0);
}
const iid = m[1];
const base = "projects/:id/merge_requests/" + iid + "/discussions";

// Every thread on the request, so each comment can be found in the discussion it belongs to.
const threadOf = new Map();
try {
  for (let page = 1; page < 50; page++) {
    const discussions = api([base + "?per_page=100&page=" + page]);
    if (!Array.isArray(discussions) || discussions.length === 0) break;
    for (const d of discussions) {
      const notes = Array.isArray(d.notes) ? d.notes : [];
      const resolvable = notes.some((n) => n && n.resolvable === true);
      const resolved = resolvable && notes.filter((n) => n && n.resolvable).every((n) => n.resolved === true);
      for (const n of notes) threadOf.set(String(n.id), { id: String(d.id), individual: d.individual_note === true, resolvable, resolved });
    }
    if (discussions.length < 100) break;
  }
} catch (e) {
  // Nothing could be read, so nothing can be answered: every item is an error, retried next time.
  for (const it of items) emit({ actionItemId: it.actionItemId, error: String((e && e.message) || e) });
  process.exit(3);
}

for (const it of items) {
  const id = it && it.actionItemId;
  try {
    const note = /#note_(\d+)/.exec(String(it.url || ""));
    if (!note) {
      emit({ actionItemId: id, skipped: "not a comment on the request - nothing to reply on", resolved: false });
      continue;
    }
    const thread = threadOf.get(note[1]);
    if (!thread) {
      emit({ actionItemId: id, skipped: "the comment is no longer on the request", resolved: false });
      continue;
    }
    if (it.when === "if_thread" && (thread.individual || !thread.resolvable)) {
      emit({ actionItemId: id, skipped: "not a resolvable thread, and nobody decided to answer it", resolved: false });
      continue;
    }
    const posted = api(["-X", "POST", base + "/" + thread.id + "/notes", "-H", "Content-Type: application/json", "--input", "-"], JSON.stringify({ body: replyBody(it) }));
    const replyId = posted && posted.id !== undefined ? "note-" + String(posted.id) : undefined;
    let resolved = thread.resolved;
    if (input.resolve === true && !thread.resolved) {
      try {
        api(["-X", "PUT", base + "/" + thread.id + "?resolved=true"]);
        resolved = true;
      } catch (e) {
        // The reply stands; a thread GitLab will not resolve (a plain comment) stays open, and says so.
        process.stderr.write("[gitlab-mr-answer] replied to " + String(id) + " but could not resolve it: " + String((e && e.message) || e) + NL);
      }
    }
    emit({ actionItemId: id, ...(replyId === undefined ? {} : { replyId }), resolved });
  } catch (e) {
    emit({ actionItemId: id, error: String((e && e.message) || e) });
  }
}
process.exit(0);
