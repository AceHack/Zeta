#!/usr/bin/env node
/**
 * app-builder.cjs — a WORKER that actually builds software.
 *
 * WHAT THIS IS FOR: `--work-cmd` is the seam a real model-backed agent plugs into. With no model
 * reachable from this machine, this stands in for one — but unlike a simulation it writes REAL
 * source, REAL tests and REAL commits into the change's own worktree. What is under test here is
 * the ORGANIZATION: whether a stated goal reaches a worker with enough context to act on, whether
 * the gates judge real evidence, and whether what merges is software that actually runs.
 *
 * It reads its assignment from the ENVIRONMENT (`workBriefEnv`), because an opaque work id is not
 * an assignment. If it cannot tell what is being asked of it, it EXITS NON-ZERO rather than
 * guessing — a worker that invents work when it does not understand the brief is worse than one
 * that fails, because the organization would then gate, approve and merge the invention.
 *
 *   argv: [...fixed args] <workId>
 *   env : ORG_WORK_TITLE, ORG_WORK_TYPE, ORG_WORK_ID, ORG_WORKDIR, ...
 */
"use strict";
const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const briefed = process.env.ORG_WORK_TITLE || "";
const title = briefed.toLowerCase();
const workId = process.env.ORG_WORK_ID || process.argv[process.argv.length - 1];
const type = process.env.ORG_WORK_TYPE || "";
const cwd = process.cwd();

process.stderr.write("[builder] " + workId + " type=" + type + " title=" + JSON.stringify(briefed) + "\n");

if (!briefed) {
  // The defect this whole run was built to detect: a worker handed an id and nothing else.
  process.stderr.write("[builder] no ORG_WORK_TITLE: I was told an id and nothing about the work\n");
  process.exit(3);
}

// WHAT THIS WORKER KNOWS HOW TO BUILD. A real agent would read the brief and reason about it; this
// one matches against it. An unmatched brief is a REFUSAL, never a default — see the header.
if (!/shorten|short link|url/.test(title)) {
  process.stderr.write("[builder] I do not know how to build '" + briefed + "'\n");
  process.exit(4);
}

mkdirSync(join(cwd, "src"), { recursive: true });
mkdirSync(join(cwd, "test"), { recursive: true });

const STORE = [
  '"use strict";',
  '/** In-memory code -> url store. Codes are deterministic so a test can assert them. */',
  'const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";',
  '',
  'function encode(n) {',
  '  let out = "";',
  '  let v = n + 1;',
  '  while (v > 0) { out = ALPHABET[v % ALPHABET.length] + out; v = Math.floor(v / ALPHABET.length); }',
  '  return out;',
  '}',
  '',
  'class Store {',
  '  constructor() { this.byCode = new Map(); this.byUrl = new Map(); }',
  '  /** The same URL always gets the same code: shortening twice is one link, not two. */',
  '  put(url) {',
  '    const seen = this.byUrl.get(url);',
  '    if (seen !== undefined) return seen;',
  '    const code = encode(this.byCode.size);',
  '    this.byCode.set(code, url);',
  '    this.byUrl.set(url, code);',
  '    return code;',
  '  }',
  '  get(code) { return this.byCode.get(code); }',
  '  get size() { return this.byCode.size; }',
  '}',
  'module.exports = { Store, encode };',
  '',
].join("\n");

const APP = [
  '"use strict";',
  'const http = require("node:http");',
  'const { Store } = require("./store");',
  '',
  '/** http/https absolute URLs only. A shortener that redirects to javascript: is a vulnerability. */',
  'function validUrl(raw) {',
  '  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return false;',
  '  let u;',
  '  try { u = new URL(raw); } catch { return false; }',
  '  return u.protocol === "http:" || u.protocol === "https:";',
  '}',
  '',
  'function send(res, status, payload) {',
  '  const b = JSON.stringify(payload);',
  '  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(b) });',
  '  res.end(b);',
  '}',
  '',
  'function createApp(store) {',
  '  const s = store || new Store();',
  '  const server = http.createServer((req, res) => {',
  '    if (req.method === "POST" && req.url === "/shorten") {',
  '      let body = "";',
  '      req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });',
  '      req.on("end", () => {',
  '        let parsed;',
  '        try { parsed = JSON.parse(body); } catch { return send(res, 400, { error: "body must be JSON" }); }',
  '        if (!validUrl(parsed && parsed.url)) return send(res, 400, { error: "url must be an absolute http(s) URL" });',
  '        send(res, 201, { code: s.put(parsed.url) });',
  '      });',
  '      return;',
  '    }',
  '    if (req.method === "GET" && req.url && req.url.length > 1) {',
  '      const url = s.get(req.url.slice(1));',
  '      if (url === undefined) return send(res, 404, { error: "no such code" });',
  '      res.writeHead(302, { location: url });',
  '      return res.end();',
  '    }',
  '    send(res, 404, { error: "not found" });',
  '  });',
  '  return { server, store: s };',
  '}',
  '',
  'module.exports = { createApp, validUrl };',
  '',
].join("\n");

const TEST = [
  '"use strict";',
  'const { test } = require("node:test");',
  'const assert = require("node:assert");',
  'const { createApp, validUrl } = require("../src/app");',
  'const { Store } = require("../src/store");',
  '',
  'function listen(app) {',
  '  return new Promise((r) => app.server.listen(0, "127.0.0.1", () => r(app.server.address().port)));',
  '}',
  'async function post(port, body) {',
  '  const res = await fetch("http://127.0.0.1:" + port + "/shorten", {',
  '    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),',
  '  });',
  '  return { status: res.status, json: await res.json().catch(() => undefined) };',
  '}',
  '',
  'test("POST /shorten returns a code and GET /:code redirects to the original", async () => {',
  '  const app = createApp(); const port = await listen(app);',
  '  try {',
  '    const made = await post(port, { url: "https://example.com/a/very/long/path?q=1" });',
  '    assert.strictEqual(made.status, 201);',
  '    assert.ok(typeof made.json.code === "string" && made.json.code.length > 0);',
  '    const res = await fetch("http://127.0.0.1:" + port + "/" + made.json.code, { redirect: "manual" });',
  '    assert.strictEqual(res.status, 302);',
  '    assert.strictEqual(res.headers.get("location"), "https://example.com/a/very/long/path?q=1");',
  '  } finally { app.server.close(); }',
  '});',
  '',
  'test("invalid input is rejected", async () => {',
  '  const app = createApp(); const port = await listen(app);',
  '  try {',
  '    assert.strictEqual((await post(port, { url: "javascript:alert(1)" })).status, 400);',
  '    assert.strictEqual((await post(port, { url: "not a url" })).status, 400);',
  '    assert.strictEqual((await post(port, {})).status, 400);',
  '  } finally { app.server.close(); }',
  '});',
  '',
  'test("an unknown code is 404, not a redirect to nowhere", async () => {',
  '  const app = createApp(); const port = await listen(app);',
  '  try {',
  '    const res = await fetch("http://127.0.0.1:" + port + "/zzzznope", { redirect: "manual" });',
  '    assert.strictEqual(res.status, 404);',
  '  } finally { app.server.close(); }',
  '});',
  '',
  'test("shortening the same URL twice yields one link", () => {',
  '  const s = new Store();',
  '  assert.strictEqual(s.put("https://example.com"), s.put("https://example.com"));',
  '  assert.strictEqual(s.size, 1);',
  '});',
  '',
  'test("validUrl accepts http and https only", () => {',
  '  assert.ok(validUrl("http://a.com")); assert.ok(validUrl("https://a.com"));',
  '  assert.ok(!validUrl("ftp://a.com")); assert.ok(!validUrl(""));',
  '});',
  '',
].join("\n");

// ── A DELIBERATE DEFECT, FOR THE FIRST N ATTEMPTS ──────────────────────────
// `FAIL_FIRST=n` makes this worker ship a REAL bug the first n times it is asked: the redirect
// answers 301 where the suite requires 302. The point is to watch whether the organization's rework
// loop actually drives a broken change to green, rather than only handling work that was right
// first time. The counter lives in the checkout so it survives across the retries of one change.
const attemptFile = join(cwd, ".attempt");
let attempt = 0;
try { attempt = Number(require("node:fs").readFileSync(attemptFile, "utf-8")) || 0; } catch {}
attempt += 1;
writeFileSync(attemptFile, String(attempt));
const failFirst = Number(process.env.FAIL_FIRST || "0");
const shipBug = attempt <= failFirst;
if (shipBug) process.stderr.write("[builder] attempt " + attempt + ": shipping the 301 defect\n");

writeFileSync(join(cwd, "src", "store.js"), STORE);
writeFileSync(join(cwd, "src", "app.js"), shipBug ? APP.replace("res.writeHead(302, { location: url });", "res.writeHead(301, { location: url });") : APP);
writeFileSync(join(cwd, "test", "app.test.js"), TEST);

// THE WORKER COMMITS ITS OWN WORK. `gitWorktreeChangeControl` refuses to commit on a performer's
// behalf — doing so would sweep whatever else is lying in that tree into a commit nobody wrote — so
// a worker that leaves its files uncommitted has produced nothing the organization can merge.
const git = (args) => spawnSync("git", args, { cwd, encoding: "utf-8", shell: false });
writeFileSync(join(cwd, ".gitignore"), ".attempt\n");
git(["add", "-A"]);

// RE-RUNNING IS NOT FAILING. A gate that turns work back invokes this worker again on the same
// checkout; the files are already written and already committed, so `git commit` finds nothing
// staged and exits non-zero. Reporting that as a failed build would make every retry fail for a
// reason that has nothing to do with the work — the organization would then escalate a green tree.
const staged = git(["diff", "--cached", "--quiet"]);
if (staged.status === 0) {
  process.stdout.write("already implemented " + workId + ": nothing further to commit\n");
  process.exit(0);
}

const done = git(["commit", "-m", "feat(" + workId + "): " + briefed]);
if (done.status !== 0) {
  process.stderr.write("[builder] commit failed: " + (done.stderr || "").trim() + "\n");
  process.exit(5);
}
process.stdout.write("implemented " + workId + ": src/store.js, src/app.js, test/app.test.js\n");
