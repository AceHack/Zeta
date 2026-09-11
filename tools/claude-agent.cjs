#!/usr/bin/env node
/**
 * claude-agent.cjs — Claude Code as an agent of the organization: it reads the repository, runs it,
 * edits it, commits, judges.
 *
 * ── WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT ────────────────────────────
 * A CLIENT for the local Claude Code CLI. It knows how to be invoked by the organization's three
 * command seams, how to tell the agent who it is and where its worldview is, and how to answer in
 * each seam's protocol. It knows NOTHING about software delivery — no gate list, no idea what a BRD
 * holds, no opinion about reproduction. Those reach the agent from the organization: its practice
 * (ORG_PRACTICE / ORG_DIRECTIVES) and, above all, `observe`.
 *
 * ── THE WORLDVIEW IS ASKED FOR, NOT HANDED OVER ──────────────────────────────
 * The prompt says who the agent is, which work item it is acting on, and the command that shows it
 * everything else (`ORG_OBSERVE_CMD`, set by `run-org` for every child). What earlier steps
 * produced, what reviewers said, what the ticket says, where the change is checked out — the agent
 * opens the item and reads them. Nothing about the work is pre-copied into the prompt, so what an
 * agent knows no longer depends on which adapter happened to invoke it.
 *
 * ── THREE MODES, CHOSEN BY THE FIRST ARGUMENT, NEVER GUESSED ─────────────────
 *   work   <workId>                   --work-agent: make the change in this checkout; commit.
 *                                     stdout is testimony; a separate verifier decides.
 *   gate   <gate> <workId> [refs...]  --artifact-cmd: produce what <gate> judges, or ask a person.
 *                                     stdout is the artifact port's line protocol.
 *   review <gate> <workId>            --review-cmd: judge <gate> independently. Exit 0 approves,
 *                                     1 rejects; stdout is the reason.
 *
 * ── AUTHENTICATION ───────────────────────────────────────────────────────────
 * The LOCAL CLAUDE CODE LOGIN, by default: the credential stays in Claude Code's own store and never
 * passes through this process, the organization's configuration, or argv. `ORG_CLAUDE_TOKEN_FILE`
 * is the fallback — a PATH, read at call time, placed only in the child's environment.
 *
 * ── PERMISSIONS ──────────────────────────────────────────────────────────────
 * `dontAsk` with an explicit allowance per mode: anything not listed is denied, not prompted.
 * A mode that may change the checkout may not push, merge, rebase, switch branches or reset —
 * integrating is the organization's act (change control), never the agent's.
 */
"use strict";
const { spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { delimiter, isAbsolute, join, resolve } = require("node:path");

const NL = String.fromCharCode(10);
const env = process.env;
const [mode, ...rest] = process.argv.slice(2);

function fail(code, message) {
  process.stderr.write("[claude-agent] " + message + NL);
  process.exit(code);
}

if (mode !== "work" && mode !== "gate" && mode !== "review" && mode !== "describe" && mode !== "follow-up") {
  fail(2, "usage: claude-agent.cjs work <workId> | gate <gate> <workId> [refs...] | review <gate> <workId> | describe <workId> | follow-up <workId>");
}

/** The Claude Code binary: stated, else the npm-installed native one, else `claude` on PATH. */
function claudeBin() {
  if (env.ORG_CLAUDE_BIN) return env.ORG_CLAUDE_BIN;
  if (process.platform === "win32" && env.APPDATA) {
    const native = join(env.APPDATA, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
    if (existsSync(native)) return native;
  }
  return "claude";
}

/**
 * `observe` as a COMMAND ON PATH, not a quoted interpreter-and-script line.
 *
 * Two reasons, one measured. The agent types `observe dashboard` and nothing longer; and a read-only
 * agent can be allowed EXACTLY `Bash(observe:*)`. Allowing the interpreter instead (`Bash(bun:*)`)
 * was measured to be write access by another name: on the rehearsal a "read-only" author changed a
 * test file by running code through it.
 */
function observeShimDir() {
  if (!env.ORG_OBSERVE_CMD) return undefined;
  const dir = mkdtempSync(join(tmpdir(), "org-observe-"));
  writeFileSync(join(dir, "observe"), "#!/usr/bin/env bash" + NL + "exec " + env.ORG_OBSERVE_CMD + ' "$@"' + NL, { mode: 0o755 });
  writeFileSync(join(dir, "observe.cmd"), "@echo off" + String.fromCharCode(13) + NL + env.ORG_OBSERVE_CMD + " %*" + String.fromCharCode(13) + NL);
  return dir;
}
const SHIM = observeShimDir();

/** The child's environment. The token, when a file names one, goes HERE and nowhere else. */
function childEnv() {
  const out = { ...env };
  if (SHIM !== undefined) {
    const key = Object.keys(out).find((k) => k.toUpperCase() === "PATH") || "PATH";
    out[key] = SHIM + delimiter + (out[key] || "");
  }
  if (env.ORG_CLAUDE_TOKEN_FILE) {
    let token = "";
    try {
      token = readFileSync(env.ORG_CLAUDE_TOKEN_FILE, "utf-8").trim();
    } catch (err) {
      fail(5, "ORG_CLAUDE_TOKEN_FILE could not be read: " + String(err && err.message));
    }
    if (token === "") fail(5, "ORG_CLAUDE_TOKEN_FILE is empty");
    out.CLAUDE_CODE_OAUTH_TOKEN = token;
  }
  return out;
}

/** Git acts that integrate or rewrite. The organization does these through change control. */
const NEVER = [
  "Bash(git push:*)", "Bash(git merge:*)", "Bash(git rebase:*)", "Bash(git checkout:*)",
  "Bash(git switch:*)", "Bash(git reset:*)", "Bash(git branch -D:*)", "Bash(git worktree:*)",
  // STOPPING PROCESSES BY NAME. MEASURED on AIAGENT-1662: a QA agent cleaned up its own test
  // database with `taskkill /IM mongod-...exe` and five processes answered - every mongod on the
  // machine with that name, whoever started it. An agent stops what it started, by PID.
  "Bash(taskkill /IM:*)", "Bash(taskkill /im:*)", "Bash(taskkill /F /IM:*)", "Bash(taskkill /f /im:*)",
  "Bash(killall:*)", "Bash(pkill:*)",
];
/** Reading: the repository, its history, and the organization's record. */
const READ = [
  "Read", "Glob", "Grep",
  "Bash(observe:*)", "Bash(git log:*)", "Bash(git show:*)", "Bash(git diff:*)", "Bash(git status:*)",
  "Bash(git grep:*)", "Bash(git ls-files:*)", "Bash(git merge-base:*)", "Bash(git -C:*)", "Bash(ls:*)",
];
/** Changing a checkout: everything, minus the integrating acts above. */
const WRITE = ["Read", "Glob", "Grep", "Edit", "Write", "TodoWrite", "Bash"];
/** Judging: reading, plus running what the repository runs, so a reviewer can check a claim. */
const JUDGE = [...READ, "Bash(npm test:*)", "Bash(npm run:*)", "Bash(npx:*)", "Bash(node:*)", "Bash(bun:*)"];

/**
 * How long one Claude Code session may run.
 *
 * The ORGANIZATION'S step budget, less a minute to report in. MEASURED on AIAGENT-1662: this was a
 * fixed 25 minutes while run-org gave the step 50, so a three-part fix was killed halfway with its
 * tests written and no code - and the step was turned back for a limit nobody had set for it.
 * `ORG_CLAUDE_TIMEOUT_MS` still wins when stated.
 */
function claudeBudgetMs() {
  const stated = Number(env.ORG_CLAUDE_TIMEOUT_MS);
  if (Number.isFinite(stated) && stated > 0) return stated;
  const port = Number(env.ORG_PORT_TIMEOUT_MS);
  if (Number.isFinite(port) && port > 120_000) return port - 60_000;
  return 1_500_000;
}

/**
 * Run a process to completion or to its budget, and on the budget stop IT AND EVERYTHING IT STARTED.
 *
 * `spawnSync`'s timeout kills only the direct child. MEASURED on AIAGENT-1662: the timed-out agent's
 * shells and a jest run - with its own mongod - kept running after the agent was gone, competing
 * with the next step's test runs for the machine.
 */
/** Every process on the machine as { pid, ppid, created } - Windows only; empty when unreadable. */
function processTable() {
  const r = spawnSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command",
      "Get-CimInstance Win32_Process | ForEach-Object { '' + $_.ProcessId + ',' + $_.ParentProcessId + ',' + $_.CreationDate.ToFileTimeUtc() }"],
    { encoding: "utf-8", shell: false, windowsHide: true, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 },
  );
  if (r.status !== 0) return [];
  return String(r.stdout || "")
    .split(/\r?\n/)
    .map((l) => l.trim().split(","))
    .filter((p) => p.length === 3 && p[0] !== "")
    .map(([pid, ppid, created]) => ({ pid: Number(pid), ppid: Number(ppid), created: String(created) }));
}

/** The live descendants of `rootPid`, including children of ones already seen whose parent has died. */
function descendantsOf(rootPid, seen) {
  const table = processTable();
  const roots = new Set([rootPid, ...seen.keys()]);
  const out = [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of table) {
      if (p.pid === process.pid || roots.has(p.pid) && p.pid !== rootPid) continue;
      if (roots.has(p.ppid) && !out.some((o) => o.pid === p.pid)) {
        out.push(p);
        roots.add(p.pid);
        grew = true;
      }
    }
  }
  return out;
}

/**
 * Stop whatever the session left running once it has ended. A process is stopped only when it is
 * provably the session's: the same pid AND the same creation time as when it was seen under the
 * session, or started after the session began by a process that was - so a recycled pid is never
 * touched. Never this process itself.
 */
function sweepLeftovers(win, rootPid, seen, startedAt) {
  if (rootPid === undefined) return;
  if (!win) {
    try {
      process.kill(-rootPid, "SIGKILL");
    } catch {
      // the group is gone - nothing was left behind
    }
    return;
  }
  const table = processTable();
  const startedFt = (BigInt(startedAt) + 11644473600000n) * 10000n; // ms since 1970 -> FILETIME
  const ours = new Set();
  for (const p of table) if (seen.get(p.pid) === p.created) ours.add(p.pid);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of table) {
      if (ours.has(p.pid) || p.pid === process.pid) continue;
      const parentIsOurs = p.ppid === rootPid || ours.has(p.ppid);
      let newer = false;
      try {
        newer = BigInt(p.created) >= startedFt;
      } catch {
        newer = false;
      }
      if (parentIsOurs && newer) {
        ours.add(p.pid);
        grew = true;
      }
    }
  }
  for (const pid of ours) spawnSync("taskkill", ["/T", "/F", "/PID", String(pid)], { shell: false, windowsHide: true });
}

function runBounded(command, args, { cwd, env: childEnvironment, input, budgetMs }) {
  const { spawn } = require("node:child_process");
  return new Promise((done) => {
    const win = process.platform === "win32";
    const child = spawn(command, args, { cwd, env: childEnvironment, shell: false, windowsHide: true, detached: !win });
    const out = [];
    const err = [];
    let timedOut = false;
    let error;
    child.stdout.on("data", (b) => out.push(b));
    child.stderr.on("data", (b) => err.push(b));
    child.on("error", (e) => {
      error = e;
    });
    // ── WHAT THE SESSION STARTED, remembered while it runs ────────────────────
    // A session that ends normally can still leave its background processes running: MEASURED on
    // AIAGENT-1661, three QA-harness servers (each holding a checkout open) outlived the sessions
    // that started them by hours, and the checkout could not be moved. On Windows a dead parent's
    // children are not findable from it, so the tree is sampled while it lives and swept at the end.
    const startedAt = Date.now();
    const seen = new Map(); // pid -> creation stamp
    const sample = () => {
      if (!win || child.pid === undefined) return;
      for (const p of descendantsOf(child.pid, seen)) seen.set(p.pid, p.created);
    };
    const sampler = win ? setInterval(sample, 20_000) : undefined;
    const stopTree = () => {
      if (win) {
        if (child.pid !== undefined) spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { shell: false, windowsHide: true });
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      sample();
      stopTree();
    }, budgetMs);
    child.on("close", (status) => {
      clearTimeout(timer);
      if (sampler !== undefined) clearInterval(sampler);
      sweepLeftovers(win, child.pid, seen, startedAt);
      done({ status, stdout: Buffer.concat(out).toString("utf-8"), stderr: Buffer.concat(err).toString("utf-8"), timedOut, error });
    });
    // THE PROMPT ON STDIN — never argv, which every process on the machine can read and which
    // Windows caps at 32k characters.
    child.stdin.on("error", () => {});
    child.stdin.end(input, "utf-8");
  });
}

/** What a stopped session left uncommitted, so the next attempt is told rather than surprised. */
function leftBehind(cwd) {
  const r = spawnSync("git", ["status", "--porcelain"], { cwd, encoding: "utf-8", shell: false, windowsHide: true });
  const lines = String(r.stdout || "").split(NL).map((l) => l.trim()).filter((l) => l !== "");
  return lines.length === 0 ? "" : "; left uncommitted in the checkout: " + lines.slice(0, 20).join(", ") + (lines.length > 20 ? " ..." : "");
}

/**
 * Run one Claude Code session and return its structured answer.
 *
 * `is_error` DECIDES, not `subtype`: measured, a logged-out CLI answers `subtype: "success"` with
 * `is_error: true` and a result of "Not logged in". Reading `subtype` would file that as work done.
 */
async function runClaude(prompt, schema, allowed, cwd) {
  const args = [
    "-p", "--output-format", "json", "--permission-mode", "dontAsk",
    "--json-schema", JSON.stringify(schema),
    "--allowedTools", ...allowed,
    "--disallowedTools", ...NEVER,
  ];
  if (env.ORG_CLAUDE_MODEL) args.push("--model", env.ORG_CLAUDE_MODEL);
  // A stand-in for the binary, for tests: `ORG_CLAUDE_BIN=node ORG_CLAUDE_BIN_ARGS=["stub.cjs"]`.
  let pre = [];
  if (env.ORG_CLAUDE_BIN_ARGS) {
    try {
      pre = JSON.parse(env.ORG_CLAUDE_BIN_ARGS);
    } catch {
      fail(2, "ORG_CLAUDE_BIN_ARGS is not a JSON array");
    }
  }
  const budgetMs = claudeBudgetMs();
  const run = await runBounded(claudeBin(), [...pre, ...args], { cwd, env: childEnv(), input: prompt, budgetMs });
  if (run.timedOut) {
    fail(4, "Claude Code did not finish within " + String(Math.round(budgetMs / 60_000)) + " min; it and everything it started were stopped" + leftBehind(cwd));
  }
  if (run.error) fail(4, "Claude Code could not run: " + run.error.message);
  let out;
  try {
    out = JSON.parse(String(run.stdout || "").trim());
  } catch {
    fail(4, "Claude Code did not answer in JSON (exit " + String(run.status) + "): " + String(run.stderr || run.stdout).slice(0, 600));
  }
  if (out.is_error) fail(4, "Claude Code reported an error: " + String(out.result || out.subtype).slice(0, 600));
  if (out.structured_output === undefined || out.structured_output === null) {
    fail(4, "Claude Code returned no structured answer: " + String(out.result).slice(0, 600));
  }
  const u = out.usage || {};
  return {
    answer: out.structured_output,
    usage: "usage: in=" + String((u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)) +
      " out=" + String(u.output_tokens || 0) + " model=" + String(env.ORG_CLAUDE_MODEL || "claude-code"),
    denied: (out.permission_denials || []).map((d) => d.tool_name + " " + JSON.stringify(d.tool_input || {}).slice(0, 120)),
  };
}

/** Who the agent is and how it sees the organization. The same preamble for every mode. */
/** Where this work's evidence lives: the organization's record, beside its step documents. */
function evidenceDir(workId) {
  return resolve(env.ORG_DOCS_DIR || join(process.cwd(), ".org-docs"), workId, "evidence").split("\\").join("/");
}

function preamble(hat, workId) {
  const observe = env.ORG_OBSERVE_CMD ? "observe" : undefined;
  return [
    "You are acting as the hat '" + hat + "' in a software organization, on work item " + workId + ".",
    "",
    observe
      ? [
          "YOUR WORLDVIEW IS `observe`. Everything the organization knows is reachable through it, and nothing",
          "about this work has been pasted into this message. Before doing anything, run:",
          "  " + observe + " --hat " + hat + " dashboard",
          "  " + observe + " --hat " + hat + " item " + workId,
          "Then open whatever you need from there: the item's parent chain (the request, the business",
          "context, the description of the existing system), its attachments (what earlier steps produced),",
          "its steps (what each asked and what the reviewer SAID - above all any step that turned the work",
          "back), its comments, and where its change is checked out. Attachments open with:",
          "  " + observe + " --hat " + hat + " attachment <workId> <ref>",
        ].join(NL)
      : "No `observe` command was provided (ORG_OBSERVE_CMD is unset), so you cannot see the organization's record. Say so in your answer rather than guessing what it contains.",
    "",
    // EACH BLOCK SAYS WHOSE IT IS. MEASURED on AIAGENT-1659: unattributed, the organization's
    // directives were quoted in a document as if they were the repository's CLAUDE.md, and the
    // reviewer rejected it for citation fabrication. Right call; the prompt had made it easy.
    env.ORG_PRACTICE
      ? "HOW THIS ORGANIZATION DOES THIS STEP (the ORGANIZATION's practice - if you cite it, cite it as the organization's, never as a file in the repository):" + NL + env.ORG_PRACTICE + NL
      : "",
    env.ORG_DIRECTIVES
      ? "THIS ORGANIZATION'S STANDING DIRECTIVES (the ORGANIZATION's, not the repository's - cite them as such):" + NL + env.ORG_DIRECTIVES + NL
      : "",
    env.ORG_REPO_SKILLS ? "THE REPOSITORY'S OWN SKILLS (prefer them where they apply):" + NL + env.ORG_REPO_SKILLS + NL : "",
    "Cite only what you actually read, where you read it. A quotation attributed to a file must be in that file.",
    "Stop only processes YOU started, by their PID - never by name: other agents and people share this machine.",
    // THE ORGANIZATION'S RECORD IS NOT THE PRODUCT. MEASURED on the first three merge requests: a UAT
    // screenshot committed into the repository, a step document committed as docs/task-012/, and
    // code comments citing task-024 and docs/goal-017/... - ids and paths a reviewer of the change
    // can never open. What the organization produces about the work stays with the organization.
    "EVIDENCE BELONGS TO THE ORGANIZATION, NOT THE PRODUCT. Screenshots, recordings, logs, notes and documents you produce about this work go in " +
      evidenceDir(workId) +
      " and are cited from your answer; never commit them into the repository, and never make a test write them into the working tree. " +
      "That directory is yours, not the product's: no committed file may contain its path, or any path on this machine. A committed test writes what it captures to its runner's own output location (Playwright's test.info().outputPath(), a temporary directory), and you copy what you want to keep into the evidence directory after you run it. Never mention the organization's internal ids (task-..., goal-..., proj-...) or its documents in anything you commit - the people reviewing the change cannot see them. The ticket key is the only reference the repository needs.",
    env.ORG_FEEDBACK ? "THIS WORK CAME BACK. What was said, newest first - address every point:" + NL + env.ORG_FEEDBACK + NL : "",
    env.ORG_ANSWERS ? "A PERSON ALREADY ANSWERED (do not ask these again):" + NL + env.ORG_ANSWERS + NL : "",
  ].filter((l) => l !== "").join(NL);
}

const ticket = env.ORG_TICKET || "";

// The modes run inside one async body, because a session is awaited: see `runBounded`.
(async () => {
// ═════════════════════════════════════════════════════════════════════════════
// work — make the change
// ═════════════════════════════════════════════════════════════════════════════
if (mode === "work") {
  const workId = rest[rest.length - 1];
  if (!workId) fail(2, "work needs <workId>");
  const hat = env.ORG_ASSIGNEE || env.ORG_WORK_OWNER || "implementer";
  const prompt = [
    preamble(hat, workId),
    "",
    "YOUR TASK NOW: make the change work item " + workId + " needs, in this checkout (your current",
    "directory, branch " + (env.ORG_BRANCH || "(unknown)") + "). This is the implementation step; a separate",
    "verifier and independent reviewers judge it afterwards, so report what you did, not whether it is good.",
    "",
    "Rules:",
    "- Work only in this checkout. Commit on the current branch" + (ticket ? " with a message that starts '" + ticket + ": '" : "") + ".",
    "- Do not push, merge, rebase, switch branches or reset. Integrating is the organization's job.",
    "- Test first where the practice says so. If an earlier step left a reproduction (a failing test), it",
    "  must FAIL before your change and PASS after it - run it both ways and report both results.",
    "- Run the repository's own tests for what you touched, the way its instructions say to.",
    "- COMMIT AS YOU GO: each piece that is done and whose tests pass is its own commit, the moment it",
    "  is. Your session has a time limit" + (claudeBudgetMs() ? " of about " + String(Math.round(claudeBudgetMs() / 60_000)) + " minutes" : "") + "; work that is only in the",
    "  working tree when it runs out has to be re-verified by whoever picks it up. If a test run hangs,",
    "  bound it (a timeout, --forceExit) rather than waiting on it again.",
    "- If you cannot do this properly, set `blocked` to exactly why. A refused step is recoverable; a faked one is not.",
  ].join(NL);
  const schema = {
    type: "object",
    properties: {
      summary: { type: "string", description: "What you changed and why, in a few sentences." },
      commit: { type: "string", description: "The commit hash you made, or empty if none." },
      testsRun: { type: "array", items: { type: "object", properties: { command: { type: "string" }, result: { type: "string" } }, required: ["command", "result"] } },
      blocked: { type: "string", description: "Empty if done. Otherwise exactly why you could not." },
    },
    required: ["summary", "commit", "testsRun", "blocked"],
  };
  const r = await runClaude(prompt, schema, WRITE, process.cwd());
  const a = r.answer;
  if (String(a.blocked || "").trim() !== "") fail(3, "blocked: " + a.blocked);
  process.stdout.write(String(a.summary).trim() + NL);
  if (a.commit) process.stdout.write("commit " + a.commit + NL);
  for (const t of a.testsRun || []) process.stdout.write("ran " + t.command + " -> " + t.result + NL);
  for (const d of r.denied) process.stdout.write("denied " + d + NL);
  process.stdout.write(r.usage + NL);
  process.exit(0);
}

// ═════════════════════════════════════════════════════════════════════════════
// gate — produce what a step judges, or ask
// ═════════════════════════════════════════════════════════════════════════════
if (mode === "gate") {
  const [gate, workId] = rest;
  if (!gate || !workId) fail(2, "gate needs <gate> <workId>");
  const hat = env.ORG_ASSIGNEE || env.ORG_WORK_OWNER || "author";
  // A CHECKOUT OF ITS OWN means this step may change code (a reproduction commits its failing test).
  // Without one the agent is reading a shared clone and may change nothing in it.
  // COMPARED BY REAL PATH. MEASURED: the worktree path carried the 8.3 short form (`MAX~1.CHA`) and
  // the process saw the long one, so a textual compare said "not your checkout" and the author of a
  // reproduction was denied the write it needed — and asked a person for permission.
  const real = (p) => {
    try {
      return realpathSync.native(p).toLowerCase();
    } catch {
      return resolve(p).toLowerCase();
    }
  };
  const own = Boolean(env.ORG_WORKDIR) && real(env.ORG_WORKDIR) === real(process.cwd());
  const docsDir = resolve(env.ORG_DOCS_DIR || join(process.cwd(), ".org-docs"));
  const rounds = env.ORG_ASK_ROUNDS_LEFT || "unbounded";
  const prompt = [
    preamble(hat, workId),
    "",
    "YOUR TASK NOW: the step '" + gate + "' on work item " + workId + ". Open the item: the step's line says",
    "what it asks. Produce what that step is judged on, as a markdown document, grounded in what you",
    "actually read in the repository and in the record - cite files and lines.",
    own
      ? "You are in this item's own checkout (branch " + (env.ORG_BRANCH || "?") + "). If this step's work includes code - a failing test that reproduces a defect, for instance - write it, run it, and commit it on this branch" + (ticket ? " with a message starting '" + ticket + ": '" : "") + ". List every file you created in `files`."
      : "You are in a SHARED clone: read anything, change nothing. Your output is the document.",
    "",
    rounds === "0"
      ? "You have NO question rounds left: do the step on your best reading and state any assumption inside the document."
      : "If something only a PERSON can settle is genuinely missing (a business decision, an intention, a constraint nobody wrote down), put the questions in `questions` and leave `document` empty. You have " + rounds + " round(s) left for this work; never re-ask anything answered." + NL +
        "IF THE STEP'S QUESTION CANNOT HONESTLY BE ANSWERED YES WITHOUT A PERSON you MUST ask: put each question in `questions`, and fold a one-line summary of what you tried into the question itself so the person has the context. A document whose conclusion is a question reaches nobody; a question in `questions` reaches a person and holds the work until they answer." + NL +
        // WHAT A PERSON IS FOR. MEASURED on AIAGENT-1658 and 1659: both reproductions failed, both
        // went to the reporter, and 1659's had passed on the MOCK data provider while production runs
        // SQL - its own document named code worth suspecting. A failed reproduction beside suspicious
        // code says the environment is wrong, and that is the organization's to fix, not the reporter's.
        "Before you ask, exhaust what the repository can tell you. A question is for a fact only a person holds (an intention, a decision, something that happened outside the code) - never for something reading or running the code would settle. In particular, work you could not make happen is not by itself a question: if the code looks suspicious, the environment is what differs, so make it match the real one and chase the suspicion.",
    "If you worked something out that the next agent would otherwise rediscover the hard way, add it to `learned`.",
  ].join(NL);
  const schema = {
    type: "object",
    properties: {
      questions: { type: "array", items: { type: "string" } },
      title: { type: "string" },
      document: { type: "string", description: "The markdown document this step produces. Empty if asking." },
      files: { type: "array", items: { type: "string" }, description: "Other files you created or changed, as paths." },
      plan: { type: "array", items: { type: "string" }, description: "What this step undertook to do, one line each." },
      learned: { type: "array", items: { type: "object", properties: { key: { type: "string" }, lesson: { type: "string" } }, required: ["key", "lesson"] } },
    },
    required: ["questions", "title", "document", "files", "plan", "learned"],
  };
  const r = await runClaude(prompt, schema, own ? WRITE : READ, process.cwd());
  const a = r.answer;
  const asks = (a.questions || []).map((q) => String(q).trim()).filter((q) => q !== "");
  const lessons = (a.learned || []).map((l) => "learned: " + String(l.key).trim() + " :: " + String(l.lesson).trim());
  for (const d of r.denied) process.stderr.write("[claude-agent] denied " + d + NL);
  if (asks.length > 0) {
    // THE DRAFT IS KEPT, NOT SUBMITTED. A question still refuses the step - a document next to an
    // open question is a guess with the uncertainty stripped off - but throwing the draft away made
    // the retry redo it and left the person answering blind to what was already done. MEASURED on
    // AIAGENT-1661: a 17 KB QA record was discarded because it came with one question.
    let draftNote = "";
    if (String(a.document || "").trim() !== "") {
      mkdirSync(join(docsDir, workId), { recursive: true });
      const draft = join(docsDir, workId, gate + ".draft.md");
      writeFileSync(draft, "# DRAFT (not submitted - it came with questions) - " + (String(a.title).trim() || gate) + NL + NL + String(a.document).trim() + NL, "utf-8");
      draftNote = " [draft so far: " + draft + "]";
    }
    for (const q of asks) process.stdout.write("ask: " + q.split(NL).join(" ") + draftNote + NL);
    for (const l of lessons) process.stdout.write(l + NL);
    process.stdout.write(r.usage + NL);
    process.exit(0);
  }
  if (String(a.document || "").trim() === "") fail(3, "produced neither a document nor a question for '" + gate + "'");
  mkdirSync(join(docsDir, workId), { recursive: true });
  const path = join(docsDir, workId, gate + ".md");
  writeFileSync(path, "# " + (String(a.title).trim() || gate + " for " + workId) + NL + NL +
    "_Step: " + gate + " | Work: " + workId + " | By: " + hat + "_" + NL + NL + String(a.document).trim() + NL, "utf-8");
  process.stdout.write(path + NL);
  for (const f of a.files || []) {
    const at = isAbsolute(f) ? f : resolve(process.cwd(), f);
    if (existsSync(at)) process.stdout.write(at + NL);
  }
  for (const p of a.plan || []) process.stdout.write("- " + String(p).trim() + NL);
  for (const l of lessons) process.stdout.write(l + NL);
  process.stdout.write(r.usage + NL);
  process.exit(0);
}

// ═════════════════════════════════════════════════════════════════════════════
// review — judge a step independently
// ═════════════════════════════════════════════════════════════════════════════
if (mode === "review") {
  const [gate, workId] = rest;
  if (!gate || !workId) fail(2, "review needs <gate> <workId>");
  const hat = env.ORG_REVIEW_AS || "reviewer";
  const prompt = [
    preamble(hat, workId),
    "",
    "YOUR TASK NOW: you are an INDEPENDENT reviewer. You did not do this work. Judge the step '" + gate + "'",
    "on work item " + workId + ": open the item, read what that step asks and what was produced for it",
    "(its attachments), and - where the work is code - read the change itself in its checkout",
    "(`git -C <checkout> log` and `git -C <checkout> diff <merge-base>..HEAD`). Run its tests if a claim",
    "depends on them. Judge against the ticket and the step's question, not your own idea of the feature.",
    "",
    "Approve only if the step's question is genuinely answered by evidence you looked at. Reject a",
    "document that invents what it did not read, a reproduction that does not fail for the reason the",
    "ticket describes, a fix whose test would pass without it, or anything vacuous. Say exactly why,",
    "specifically enough that the author can act on it.",
    "",
    "A step is a gate: approving it moves the work forward. So approve only when the ANSWER lets the",
    "work move - an accurate document whose own conclusion is that the work is NOT ready, not fixed, or",
    "still blocked is a REJECTION, with what is left as your reason. Before relying on anything an",
    "author reports as still open, check it against the item's current record: it may have closed since.",
  ].join(NL);
  const schema = {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["approve", "reject"] },
      reason: { type: "string", description: "Why, specific and actionable. Cite what you looked at." },
      lookedAt: { type: "array", items: { type: "string" } },
    },
    required: ["verdict", "reason", "lookedAt"],
  };
  const r = await runClaude(prompt, schema, JUDGE, process.cwd());
  const a = r.answer;
  process.stdout.write(String(a.reason).trim() + (a.lookedAt && a.lookedAt.length ? " [looked at: " + a.lookedAt.join(", ") + "]" : "") + NL);
  process.exit(a.verdict === "approve" ? 0 : 1);
}

// ═════════════════════════════════════════════════════════════════════════════
// describe — write the merge request's description, in the organization's sections
// ═════════════════════════════════════════════════════════════════════════════
if (mode === "describe") {
  const workId = rest[0];
  if (!workId) fail(2, "describe needs <workId>");
  if (!env.ORG_MR_SECTIONS) fail(2, "describe needs ORG_MR_SECTIONS: the sections this organization's merge requests carry");
  const hat = env.ORG_ASSIGNEE || "release_manager";
  const base = env.ORG_BASE || "the target branch";
  const prompt = [
    preamble(hat, workId),
    "",
    "YOUR TASK NOW: write the description of the merge request for work item " + workId + ", proposed for HUMAN REVIEW as",
    "'" + (env.ORG_MR_TITLE || workId) + "' (branch " + (env.ORG_BRANCH || "?") + " against " + base + "). You are in the change's own checkout.",
    "Read the item and its parent chain through observe - the request, the reproduction (or why there is none), the root",
    "cause, what was designed and changed, the QA record and each reviewer's words - and read the change itself",
    "(`git log " + base + "..HEAD`, `git diff " + base + "...HEAD`).",
    "",
    "Write for the people who will review it. They cannot see the organization's record, so the description must",
    "stand on its own: never cite the organization's internal ids (task-..., goal-...) or its documents; cite files,",
    "lines, tests and commands in the repository instead. Where something was NOT established - no reproduction, a",
    "check that could not run - say so plainly; a description that softens a gap is worse than one that names it.",
    "",
    "It MUST contain exactly these sections, each as a markdown heading `## <heading>`, in this order, each stating",
    "what is asked of it:",
    "",
    env.ORG_MR_SECTIONS,
  ].join(NL);
  const schema = {
    type: "object",
    properties: { description: { type: "string", description: "The whole description, markdown, with every section as a `## ` heading." } },
    required: ["description"],
  };
  const r = await runClaude(prompt, schema, READ, process.cwd());
  const text = String(r.answer.description || "").trim();
  if (text === "") fail(3, "the description came back empty");
  const docsDir = resolve(env.ORG_DOCS_DIR || join(process.cwd(), ".org-docs"));
  mkdirSync(join(docsDir, workId), { recursive: true });
  const path = join(docsDir, workId, "change_request.md");
  writeFileSync(path, text + NL, "utf-8");
  process.stdout.write(path + NL + r.usage + NL);
  process.exit(0);
}

// ═════════════════════════════════════════════════════════════════════════════
// follow-up — decide about what people said on a change already in front of them
// ═════════════════════════════════════════════════════════════════════════════
if (mode === "follow-up") {
  const workId = rest[0];
  if (!workId) fail(2, "follow-up needs <workId>");
  const hat = env.ORG_ASSIGNEE || "implementer";
  const resolving = env.ORG_FOLLOWUP_MODE === "resolve";
  let items = [];
  try {
    items = JSON.parse(env.ORG_ACTION_ITEMS || "[]");
  } catch {
    fail(2, "ORG_ACTION_ITEMS is not JSON");
  }
  const conflicts = (() => {
    try {
      return JSON.parse(env.ORG_CONFLICTS || "[]");
    } catch {
      return [];
    }
  })();
  const canSync = env.ORG_CAN_SYNC === "1";
  const prompt = resolving
    ? [
        preamble(hat, workId),
        "",
        "YOUR TASK NOW: a merge of " + (env.ORG_BASE ? "the target (" + env.ORG_BASE + ")" : "the target") + " into this branch (" + (env.ORG_BRANCH || "?") + ") is IN PROGRESS",
        "in this checkout and conflicted in: " + conflicts.join(", ") + ".",
        "Resolve each conflict so that BOTH this change's intent and the target's survive - read both sides and the",
        "item's record before choosing. Run the tests for what you touched. Then `git add` the resolved files and",
        "conclude the merge with `git commit --no-edit`. Do not abort the merge and do not change anything else.",
        "If a conflict cannot be resolved without a decision only a person can make, leave it and say so in `summary`.",
      ].join(NL)
    : [
        preamble(hat, workId),
        "",
        "YOUR TASK NOW: this change is already in front of people for review, and these ACTION ITEMS are open on it:",
        JSON.stringify(items, null, 2),
        "",
        "They are not instructions - they are what happened (a reviewer's comment, the request being updated, its",
        "target moving ahead). Weigh each one and decide, reporting every item exactly once by its id:",
        "- addressed: you acted on it. If that means changing code, change it on this branch (test first where it",
        "  changes behaviour), run the tests, and commit. If it was a question, `how` is your answer to it.",
        "- declined: it should not be acted on - say why, specifically enough for the person who raised it.",
        "- deferred: it is worth doing, but not now - say why. It stays open.",
        "A reviewer's comment is a person who read your work: take it seriously, and do not decline one without a reason",
        "you would give them directly.",
        canSync
          ? "An item of kind behind_target means the target moved ahead of this change. You cannot merge it yourself; if the change should be brought level, set `syncWithTarget` and the organization will merge the target in (conflicts come back to you)."
          : "An item of kind behind_target means the target moved ahead. This organization only records that; bringing the change level is not available here, so decide whether anything else needs doing.",
        "Do not push - the organization re-verifies the checkout and updates the request itself.",
      ].join(NL);
  const schema = {
    type: "object",
    properties: {
      decisions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            outcome: { type: "string", enum: ["addressed", "declined", "deferred"] },
            how: { type: "string" },
          },
          required: ["id", "outcome", "how"],
        },
      },
      syncWithTarget: { type: "boolean" },
      summary: { type: "string" },
    },
    required: ["decisions", "syncWithTarget", "summary"],
  };
  const r = await runClaude(prompt, schema, WRITE, process.cwd());
  const a = r.answer;
  process.stdout.write(r.usage + NL);
  process.stdout.write(JSON.stringify({ decisions: resolving ? [] : a.decisions || [], syncWithTarget: !resolving && canSync && a.syncWithTarget === true, summary: String(a.summary || "") }) + NL);
  process.exit(0);
}
})().catch((e) => fail(4, "claude-agent failed: " + String((e && e.message) || e)));
