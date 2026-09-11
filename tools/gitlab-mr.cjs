#!/usr/bin/env node
/**
 * gitlab-mr.cjs — hand a change to people on GitLab: push its branch and open a merge request.
 *
 * ── WHAT IT DOES, AND WHAT IT NEVER DOES ─────────────────────────────────────
 * Pushes ORG_BRANCH to the remote (never forced), then opens a merge request from it into ORG_BASE
 * and prints the request's URL. It NEVER merges, approves, or sets auto-merge: integrating is a
 * person's act, and the organization's last act on a change is to put it in front of one.
 *
 * IDEMPOTENT: if a merge request from this branch into this base is already open, its URL is
 * printed and nothing new is created — a resumed run must not open a second review of one change.
 *
 * ── CONTRACT (the change-control adapter's `handoff` command) ────────────────
 *   ORG_BRANCH            the branch to propose                       (required)
 *   ORG_BASE              the branch it is proposed against           (required)
 *   ORG_TITLE             the merge request's title                   (required)
 *   ORG_DESCRIPTION_FILE  a file holding its description (markdown)   (required)
 *   ORG_GIT_REMOTE        the remote to push to                       (default: origin)
 *   ORG_GLAB_BIN          the glab binary                             (default: the installed one)
 * Run with its working directory inside the repository: `glab api` resolves the project and the
 * host from that checkout's remote. Authentication is glab's and git's own stored login; no token
 * passes through here or through argv. Exit 0 prints the URL as the last line.
 */
"use strict";
const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const NL = String.fromCharCode(10);
const env = process.env;

function fail(code, message) {
  process.stderr.write("[gitlab-mr] " + message + NL);
  process.exit(code);
}

const branch = (env.ORG_BRANCH || "").trim();
const base = (env.ORG_BASE || "").trim();
const title = (env.ORG_TITLE || "").trim();
const descriptionFile = env.ORG_DESCRIPTION_FILE || "";
if (!branch || !base || !title || !descriptionFile) {
  fail(2, "needs ORG_BRANCH, ORG_BASE, ORG_TITLE and ORG_DESCRIPTION_FILE");
}
if (branch === base) fail(2, "refusing to propose '" + branch + "' into itself");
if (!existsSync(descriptionFile)) fail(2, "ORG_DESCRIPTION_FILE does not exist: " + descriptionFile);

function glabBin() {
  if (env.ORG_GLAB_BIN) return env.ORG_GLAB_BIN;
  if (process.platform === "win32" && env.LOCALAPPDATA) {
    const installed = join(env.LOCALAPPDATA, "Programs", "glab", "glab.exe");
    if (existsSync(installed)) return installed;
  }
  return "glab";
}

function run(command, args, input) {
  return spawnSync(command, args, {
    encoding: "utf-8",
    shell: false,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    ...(input === undefined ? {} : { input }),
  });
}

// ── 1. PUSH, NEVER FORCED ────────────────────────────────────────────────────
// A rejected push (someone else moved the branch) is a refusal, never a reason to overwrite it.
const remote = env.ORG_GIT_REMOTE || "origin";
const pushed = run("git", ["push", "--set-upstream", remote, branch + ":refs/heads/" + branch]);
if (pushed.error) fail(4, "git could not run: " + pushed.error.message);
if (pushed.status !== 0) fail(3, "the push of " + branch + " was refused: " + String(pushed.stderr || "").trim().slice(0, 800));

const glab = glabBin();
function api(args, input) {
  const r = run(glab, ["api", ...args], input);
  if (r.error) fail(4, "glab could not run: " + r.error.message);
  if (r.status !== 0) fail(3, "glab api " + args[args.length - 1] + " failed: " + String(r.stderr || r.stdout || "").trim().slice(0, 800));
  try {
    return JSON.parse(String(r.stdout || ""));
  } catch {
    fail(3, "glab api " + args[args.length - 1] + " did not answer in JSON");
  }
}

// ── 2. ALREADY OPEN? ─────────────────────────────────────────────────────────
const query =
  "projects/:id/merge_requests?state=opened&source_branch=" + encodeURIComponent(branch) +
  "&target_branch=" + encodeURIComponent(base);
const open = api([query]);
if (Array.isArray(open) && open.length > 0 && typeof open[0].web_url === "string") {
  process.stdout.write("already open" + NL + open[0].web_url + NL);
  process.exit(0);
}

// ── 3. OPEN IT ───────────────────────────────────────────────────────────────
// The body goes on stdin as JSON: a field value is subject to glab's placeholder expansion, and a
// description quoting code in braces would fail to send.
const body = JSON.stringify({
  source_branch: branch,
  target_branch: base,
  title,
  description: readFileSync(descriptionFile, "utf-8"),
});
const created = api(
  ["--method", "POST", "--header", "Content-Type: application/json", "--input", "-", "projects/:id/merge_requests"],
  body,
);
if (!created || typeof created.web_url !== "string") fail(3, "GitLab did not return the merge request it created");
process.stdout.write("opened" + NL + created.web_url + NL);
process.exit(0);
