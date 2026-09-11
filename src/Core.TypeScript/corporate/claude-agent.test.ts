/**
 * claude-agent.test.ts — the Claude Code client speaks each seam's protocol, and never files a
 * failure as work done.
 *
 * Driven against a STAND-IN for the Claude binary (a script that answers with a canned JSON result
 * and records what it was sent), so these pin the mapping without spending on a model. The real
 * binary is exercised by the rehearsal run, not here.
 */

import { describe, expect, test } from "bun:test";
import { waitUntil } from "../testing/deterministic-async.ts";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const AGENT = resolve(import.meta.dir, "..", "..", "..", "tools", "claude-agent.cjs");

/** Run the agent with a stand-in Claude that answers `result` and records its argv and stdin. */
function run(args: readonly string[], result: Record<string, unknown>, extraEnv: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "claude-agent-"));
  const stub = join(dir, "stub.cjs");
  const sent = join(dir, "sent.json");
  writeFileSync(
    stub,
    `const fs=require("fs");let input="";process.stdin.on("data",d=>input+=d);process.stdin.on("end",()=>{` +
      `fs.writeFileSync(${JSON.stringify(sent)},JSON.stringify({argv:process.argv.slice(2),input,token:process.env.CLAUDE_CODE_OAUTH_TOKEN||null}));` +
      `process.stdout.write(${JSON.stringify(JSON.stringify(result))});});`,
  );
  const r = spawnSync(process.execPath === "" ? "node" : "node", [AGENT, ...args], {
    cwd: dir,
    encoding: "utf-8",
    env: {
      ...process.env,
      ORG_CLAUDE_BIN: "node",
      ORG_CLAUDE_BIN_ARGS: JSON.stringify([stub]),
      ORG_OBSERVE_CMD: "observe --store S",
      ORG_DOCS_DIR: join(dir, "docs"),
      ORG_TICKET: "AIAGENT-1659",
      ...extraEnv,
    },
  });
  // READ, THEN INTERPRET ENOENT. `existsSync(sent)` gating `readFileSync(sent)`
  // answers a question that is already stale by the time the read runs, and the
  // read reports absence itself. Absent means "the stub was never invoked",
  // which is exactly the `undefined` this produced before.
  let seen: { argv: string[]; input: string; token: string | null } | undefined;
  try {
    seen = JSON.parse(readFileSync(sent, "utf-8")) as { argv: string[]; input: string; token: string | null };
  } catch {
    seen = undefined;
  }
  return { ...r, seen, dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const ok = (structured: unknown) => ({ type: "result", subtype: "success", is_error: false, structured_output: structured, usage: { input_tokens: 10, output_tokens: 5 } });

/**
 * Is this pid still running? `kill(pid, 0)` sends no signal and only asks.
 *
 * Extracted because both tree-kill tests need it and a predicate that throws is
 * not a predicate -- `waitUntil` wants a boolean, and swallowing the ESRCH here
 * keeps the try/catch out of the assertion.
 */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}


describe("THE WORLDVIEW IS ASKED FOR — the prompt carries the observe command, not the work", () => {
  test("every mode tells the agent to open its dashboard and item through observe", () => {
    const r = run(["work", "task-9"], ok({ summary: "fixed", commit: "abc", testsRun: [], blocked: "" }), { ORG_ASSIGNEE: "backend_implementer" });
    expect(r.status).toBe(0);
    expect(r.seen?.input).toContain("observe --hat backend_implementer dashboard");
    expect(r.seen?.input).toContain("observe --hat backend_implementer item task-9");
    // `observe` is a COMMAND ON PATH, so a read-only agent can be allowed exactly `Bash(observe:*)`.
    expect(r.seen?.argv).not.toContain("Bash(bun:*)");
    r.cleanup();
  });

  test("THE PROMPT TRAVELS ON STDIN, never argv", () => {
    const r = run(["work", "task-9"], ok({ summary: "s", commit: "", testsRun: [], blocked: "" }));
    expect(r.seen?.argv.join(" ")).not.toContain("YOUR TASK NOW");
    expect(r.seen?.input).toContain("YOUR TASK NOW");
    r.cleanup();
  });

  test("EVIDENCE STAYS WITH THE ORGANIZATION: every mode names the work's evidence directory and forbids committing it", () => {
    // MEASURED on the first three merge requests: a committed UAT screenshot, a step document under
    // docs/task-012/, and code comments citing task-024 - none of which a reviewer can open.
    for (const args of [["work", "task-9"], ["gate", "qa_uat", "task-9"]] as const) {
      const r = run(args, ok({ summary: "s", commit: "", testsRun: [], blocked: "", questions: ["q"], title: "", document: "", files: [], plan: [], learned: [] }));
      const input = r.seen?.input ?? "";
      expect(input).toContain(join(r.dir, "docs", "task-9", "evidence").split("\\").join("/"));
      expect(input).toContain("never commit them into the repository");
      // MEASURED on AIAGENT-1658: told not to let a test write into the working tree, the author
      // committed a spec that wrote its screenshots to the evidence directory's absolute path instead.
      expect(input).toContain("no committed file may contain its path, or any path on this machine");
      expect(input).toContain("test.info().outputPath()");
      expect(input).toContain("Never mention the organization's internal ids");
      r.cleanup();
    }
  });

  test("A FAILED REPRODUCTION IS NOT A QUESTION: the author is told to chase the code before asking a person", () => {
    // MEASURED on AIAGENT-1659: the reproduction passed on the mock provider, production runs SQL,
    // and the author asked the reporter instead of reproducing on the path production takes.
    const r = run(["gate", "reproduction", "task-9"], ok({ questions: ["q"], title: "", document: "", files: [], plan: [], learned: [] }));
    const input = r.seen?.input ?? "";
    expect(input).toContain("exhaust what the repository can tell you");
    expect(input).toContain("the environment is what differs");
    expect(input).not.toContain("for instance a defect you could not reproduce");
    r.cleanup();
  });

  test("an integrating git act is never allowed, in any mode", () => {
    const r = run(["work", "task-9"], ok({ summary: "s", commit: "", testsRun: [], blocked: "" }));
    const argv = r.seen?.argv ?? [];
    expect(argv).toContain("--disallowedTools");
    expect(argv).toContain("Bash(git push:*)");
    expect(argv).toContain("dontAsk");
    r.cleanup();
  });
});

describe("AFTER THE HANDOFF: THE DESCRIPTION AND THE FOLLOW-UP", () => {
  test("describe: told the organization's sections, reads only, writes the description where the runtime reads it", () => {
    const r = run(["describe", "task-9"], ok({ description: "## Root cause\nA race." }), {
      ORG_MR_SECTIONS: "## Root cause\nwhy, with file:line",
      ORG_MR_TITLE: "AIAGENT-1659: cases not persisted",
      ORG_BASE: "main",
    });
    expect(r.status).toBe(0);
    const input = r.seen?.input ?? "";
    expect(input).toContain("## Root cause\nwhy, with file:line");
    expect(input).toContain("never cite the organization's internal ids");
    expect(r.seen?.argv).not.toContain("Edit");
    const path = r.stdout.split(/\r?\n/)[0] as string;
    expect(path.endsWith(join("task-9", "change_request.md"))).toBe(true);
    expect(readFileSync(path, "utf-8")).toContain("A race.");
    r.cleanup();
  });

  test("describe refuses to run without sections - it would write a request nobody configured", () => {
    const r = run(["describe", "task-9"], ok({ description: "x" }));
    expect(r.status).toBe(2);
    r.cleanup();
  });

  test("follow-up: the items reach the session, its decisions come back as the last JSON line, and a sync it may not ask for is dropped", () => {
    const items = JSON.stringify([{ id: "gitlab:n1", kind: "comment", summary: "rename x" }, { id: "gitlab:t@task-9", kind: "behind_target", summary: "main moved" }]);
    const answer = ok({ decisions: [{ id: "gitlab:n1", outcome: "addressed", how: "renamed" }], syncWithTarget: true, summary: "s" });
    const flagOnly = run(["follow-up", "task-9"], answer, { ORG_ACTION_ITEMS: items, ORG_CAN_SYNC: "0" });
    expect(flagOnly.status).toBe(0);
    expect(flagOnly.seen?.input).toContain("rename x");
    expect(flagOnly.seen?.input).toContain("bringing the change level is not available here");
    // A suggestion is CHECKED before it is applied, and `how` is written for the reviewer who will read it.
    expect(flagOnly.seen?.input).toContain("A SUGGESTED FIX IS A CLAIM - CHECK IT BEFORE YOU ACT ON IT");
    expect(flagOnly.seen?.input).toContain("`how` IS POSTED AS YOUR REPLY ON THE REVIEWER'S THREAD");
    expect(flagOnly.seen?.argv.join(" ")).toContain('"respond"');
    // MEASURED on MR !163: "belongs in its own ticket" was deferred twice, and the reviewer heard nothing.
    expect(flagOnly.seen?.input).toContain("is DECLINED for this change: say why and name where it belongs");
    expect(flagOnly.seen?.input).toContain("`reopenedBecause`");
    const last = JSON.parse(flagOnly.stdout.trim().split(/\r?\n/).pop() as string) as { decisions: { id: string }[]; syncWithTarget: boolean };
    expect(last.decisions.map((d) => d.id)).toEqual(["gitlab:n1"]);
    expect(last.syncWithTarget).toBe(false);
    flagOnly.cleanup();
    const canSync = run(["follow-up", "task-9"], answer, { ORG_ACTION_ITEMS: items, ORG_CAN_SYNC: "1" });
    expect((JSON.parse(canSync.stdout.trim().split(/\r?\n/).pop() as string) as { syncWithTarget: boolean }).syncWithTarget).toBe(true);
    canSync.cleanup();
  });

  test("follow-up in resolve mode is told the conflicted paths and decides nothing about items", () => {
    const r = run(["follow-up", "task-9"], ok({ decisions: [{ id: "x", outcome: "addressed", how: "h" }], syncWithTarget: true, summary: "resolved" }), {
      ORG_FOLLOWUP_MODE: "resolve",
      ORG_CONFLICTS: JSON.stringify(["README.md"]),
      ORG_CAN_SYNC: "1",
    });
    expect(r.seen?.input).toContain("conflicted in: README.md");
    const last = JSON.parse(r.stdout.trim().split(/\r?\n/).pop() as string) as { decisions: unknown[]; syncWithTarget: boolean };
    expect(last.decisions).toEqual([]);
    expect(last.syncWithTarget).toBe(false);
    r.cleanup();
  });
});

describe("A FAILURE IS NEVER FILED AS WORK DONE", () => {
  test("is_error decides, not subtype — the logged-out CLI says 'success' and is an error", () => {
    const r = run(["work", "task-9"], { type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("Not logged in");
    r.cleanup();
  });

  test("a blocked implementer refuses the step with its reason", () => {
    const r = run(["work", "task-9"], ok({ summary: "", commit: "", testsRun: [], blocked: "the reproduction test does not exist" }));
    expect(r.status).toBe(3);
    expect(r.stderr).toContain("the reproduction test does not exist");
    r.cleanup();
  });

  test("an author that produced neither a document nor a question refuses", () => {
    const r = run(["gate", "reproduction", "task-9"], ok({ questions: [], title: "", document: "", files: [], plan: [], learned: [] }));
    expect(r.status).toBe(3);
    r.cleanup();
  });
});

describe("EACH SEAM'S PROTOCOL", () => {
  test("gate: a document is written under the docs dir and its path printed, with plan and lessons", () => {
    const r = run(["gate", "system_context", "goal-1"], ok({ questions: [], title: "System context", document: "The hub stores cases in …", files: [], plan: ["read the case store"], learned: [{ key: "hub-sync", lesson: "sync rewrites rows" }] }));
    expect(r.status).toBe(0);
    const lines = r.stdout.trim().split(/\r?\n/);
    const doc = lines[0] as string;
    expect(doc.endsWith(join("goal-1", "system_context.md"))).toBe(true);
    expect(readFileSync(doc, "utf-8")).toContain("The hub stores cases in");
    expect(lines).toContain("- read the case store");
    expect(lines).toContain("learned: hub-sync :: sync rewrites rows");
    r.cleanup();
  });

  test("gate: questions become `ask:` lines and NO document is written", () => {
    const r = run(["gate", "system_context", "goal-1"], ok({ questions: ["Which program's tempo config is authoritative?"], title: "", document: "", files: [], plan: [], learned: [] }));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("ask: Which program's tempo config is authoritative?");
    expect(existsSync(join(r.dir, "docs", "goal-1", "system_context.md"))).toBe(false);
    r.cleanup();
  });

  test("gate: a draft that came WITH a question is kept and named in the question, never submitted", () => {
    // MEASURED on AIAGENT-1661: a 17 KB QA record was discarded because it came with one question.
    const r = run(["gate", "qa_uat", "task-3"], ok({ questions: ["Real-stack Playwright or the API steps?"], title: "QA", document: "## what I verified\nall green", files: [], plan: [], learned: [] }));
    expect(r.status).toBe(0);
    const draft = join(r.dir, "docs", "task-3", "qa_uat.draft.md");
    // The read IS the existence assertion: a missing draft makes `readFileSync`
    // throw ENOENT naming the path, which fails this test more informatively
    // than `expect(false).toBe(true)` did. The separate `existsSync` added a
    // stale-by-construction window and no signal.
    expect(readFileSync(draft, "utf-8")).toContain("all green");
    expect(r.stdout).toContain("ask: Real-stack Playwright or the API steps? [draft so far: ");
    // Still a question, not an artifact: the submitted document does not exist and no path line is emitted alone.
    expect(existsSync(join(r.dir, "docs", "task-3", "qa_uat.md"))).toBe(false);
    expect(r.stdout.split("\n").filter((l) => l.trim() !== "" && !l.startsWith("ask: ") && !l.startsWith("usage:") && !l.startsWith("learned: "))).toEqual([]);
    r.cleanup();
  });

  test("gate: WITHOUT its own checkout the author may only read", () => {
    const r = run(["gate", "system_context", "goal-1"], ok({ questions: ["q"], title: "", document: "", files: [], plan: [], learned: [] }));
    const allowed = r.seen?.argv ?? [];
    expect(allowed).not.toContain("Edit");
    expect(allowed).not.toContain("Write");
    r.cleanup();
  });

  test("review: approve exits 0, reject exits 1, and the reason is what it printed", () => {
    const yes = run(["review", "reproduction", "task-9"], ok({ verdict: "approve", reason: "fails on main for the stated reason", lookedAt: ["test/x.test.ts"] }));
    expect(yes.status).toBe(0);
    expect(yes.stdout).toContain("fails on main for the stated reason");
    yes.cleanup();
    const no = run(["review", "reproduction", "task-9"], ok({ verdict: "reject", reason: "the test passes on main", lookedAt: [] }));
    expect(no.status).toBe(1);
    expect(no.stdout).toContain("the test passes on main");
    no.cleanup();
  });
});

describe("AUTHENTICATION", () => {
  test("by default the local CLI login is used — no token is set by this client", () => {
    const r = run(["work", "task-9"], ok({ summary: "s", commit: "", testsRun: [], blocked: "" }), { CLAUDE_CODE_OAUTH_TOKEN: "" });
    expect(r.seen?.token ?? "").toBe("");
    r.cleanup();
  });

  test("a token FILE is read at call time into the child's environment — never onto argv", () => {
    const dir = mkdtempSync(join(tmpdir(), "tok-"));
    const f = join(dir, "t.txt");
    writeFileSync(f, "sk-test-token\n");
    const r = run(["work", "task-9"], ok({ summary: "s", commit: "", testsRun: [], blocked: "" }), { ORG_CLAUDE_TOKEN_FILE: f });
    expect(r.seen?.token).toBe("sk-test-token");
    // THE CLAIM RIDES ON A DIFFERENTIAL, NOT AN ABSENCE.
    //
    // `argv.join(" ").not.toContain(token)` witnesses ONE RENDERING of a leak and
    // never its absence (R5, `audit-check-arity-nonequality`): a token split across
    // two argv elements joins to "sk-test -token", which does not contain the secret
    // and passes a test whose entire subject is that the secret is not on argv.
    //
    // The property actually being claimed is NONINTERFERENCE (§13): the secret must
    // not influence argv AT ALL. So run the same command with and without the token
    // file and assert argv is IDENTICAL. That is a positive, exact check which fails
    // on any leak — whole, split, encoded, or merely a length difference — and it
    // fails for the right reason, because the thing it compares is the thing the
    // claim is about.
    //
    // NO per-element `not.toContain` accompanies it, deliberately. Those would be
    // exactly the absence assertions R5 refuses, and they would add nothing: the
    // equality diff already prints the offending element, so the failure names the
    // leak without a weaker check standing beside the stronger one.
    const withToken = r.seen?.argv ?? [];
    const without = run(["work", "task-9"], ok({ summary: "s", commit: "", testsRun: [], blocked: "" }));
    expect(withToken.length).toBeGreaterThan(0);
    expect(withToken).toEqual(without.seen?.argv ?? []);
    without.cleanup();
    r.cleanup();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("A REVIEW JUDGES WHETHER THE WORK MAY MOVE, NOT WHETHER THE DOCUMENT IS ACCURATE", () => {
  // MEASURED on AIAGENT-1661: a release-readiness document concluding "NOT READY" was APPROVED
  // because it "answered the question with an evidence-anchored punch list" - a gate that passes
  // whatever the answer is is not a gate.
  test("the reviewer is told an accurate 'not ready' is a rejection", () => {
    const r = run(["review", "release_readiness", "task-9"], ok({ verdict: "reject", reason: "two blockers left", lookedAt: [] }));
    expect(r.seen?.input).toContain("approving it moves the work forward");
    expect(r.seen?.input).toContain("is a REJECTION");
    expect(r.status).toBe(1);
    r.cleanup();
  });
});

describe("AN IMPLEMENTER COMMITS AS IT GOES, KNOWING ITS LIMIT", () => {
  // MEASURED on AIAGENT-1662: two implementation sessions ran out of time with everything still in
  // the working tree - tests, route changes, a jest config - so the next attempt had to re-verify
  // all of it from scratch.
  test("the work prompt states the budget and asks for a commit per finished piece", () => {
    const r = run(["work", "task-9"], ok({ summary: "s", commit: "", testsRun: [], blocked: "" }), { ORG_PORT_TIMEOUT_MS: "3000000" });
    expect(r.seen?.input).toContain("COMMIT AS YOU GO");
    expect(r.seen?.input).toContain("about 49 minutes");
    r.cleanup();
  });
});

describe("AN AGENT STOPS ONLY WHAT IT STARTED", () => {
  // MEASURED on AIAGENT-1662: `taskkill /IM mongod-...exe` from a QA agent stopped five processes,
  // every mongod on the machine with that name.
  test("stopping processes by name is denied in every mode, and the prompt says why", () => {
    for (const args of [["work", "task-9"], ["gate", "qa_uat", "task-9"], ["review", "qa_uat", "task-9"]]) {
      const r = run(args, ok({ summary: "s", commit: "", testsRun: [], blocked: "", questions: [], title: "t", document: "d", files: [], plan: [], learned: [], verdict: "approve", reason: "r", lookedAt: [] }));
      const argv = r.seen?.argv ?? [];
      expect(argv).toContain("Bash(taskkill /IM:*)");
      expect(argv).toContain("Bash(pkill:*)");
      expect(r.seen?.input).toContain("by their PID - never by name");
      r.cleanup();
    }
  });
});

describe("A SESSION THAT RUNS OUT OF TIME IS STOPPED WITH EVERYTHING IT STARTED", () => {
  // MEASURED on AIAGENT-1662: the agent was killed at a fixed 25 minutes, and its shells and a jest
  // run with its own mongod kept running afterwards, competing with the next step's tests.
  test("the budget stops the session AND its children, and says so", async () => {
    const dir = mkdtempSync(join(tmpdir(), "claude-agent-slow-"));
    const stub = join(dir, "slow.cjs");
    const pidFile = join(dir, "grandchild.pid");
    writeFileSync(
      stub,
      `const {spawn}=require("child_process");const fs=require("fs");` +
        // DETACHED, like Claude Code's own shells: Node would otherwise put the child in a job object
        // that dies with its parent, and the test would pass without any tree kill at all.
        `const g=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore",detached:true});g.unref();` +
        `fs.writeFileSync(${JSON.stringify(pidFile)},String(g.pid));setInterval(()=>{},1000);`,
    );
    const r = spawnSync("node", [AGENT, "work", "task-9"], {
      cwd: dir,
      encoding: "utf-8",
      env: { ...process.env, ORG_CLAUDE_BIN: "node", ORG_CLAUDE_BIN_ARGS: JSON.stringify([stub]), ORG_CLAUDE_TIMEOUT_MS: "2500" },
      timeout: 60_000,
    });
    try {
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("did not finish within");
      const pid = Number(readFileSync(pidFile, "utf-8"));
      // POLL THE PROPERTY, DO NOT SLEEP TOWARD IT. The old loop slept 250ms up
      // to twenty times and then asserted, which asserts that five seconds was
      // enough on THIS machine at THIS moment -- and it was not: this test and
      // its sibling were the only two failures in the file on a developer
      // laptop, at ~7.6s and ~5.1s. `waitUntil` returns at the first instant
      // the process is gone, so a loaded runner only makes it wait longer, and
      // a real failure (the tree was never killed) still fails on any machine.
      await waitUntil(() => !isAlive(pid), {
        timeoutMs: 20_000,
        describe: `the detached grandchild ${String(pid)} to be killed with its session`,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe("A SESSION THAT ENDS NORMALLY LEAVES NOTHING RUNNING", () => {
  // MEASURED on AIAGENT-1661: three QA-harness servers outlived the sessions that started them by
  // hours, holding the change's checkout open so it could not even be moved.
  test("a background process the session started is stopped when the session answers and exits", async () => {
    const dir = mkdtempSync(join(tmpdir(), "claude-agent-leftover-"));
    const stub = join(dir, "leaves.cjs");
    const pidFile = join(dir, "leftover.pid");
    const answer = JSON.stringify({ type: "result", subtype: "success", is_error: false, structured_output: { verdict: "approve", reason: "ok", lookedAt: [] }, usage: {} });
    writeFileSync(
      stub,
      `const {spawn}=require("child_process");const fs=require("fs");` +
        `const g=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore",detached:true});g.unref();` +
        `fs.writeFileSync(${JSON.stringify(pidFile)},String(g.pid));` +
        `process.stdin.on("data",()=>{});process.stdin.on("end",()=>{process.stdout.write(${JSON.stringify(answer)});process.exit(0);});`,
    );
    const r = spawnSync("node", [AGENT, "review", "qa_uat", "task-9"], {
      cwd: dir,
      encoding: "utf-8",
      env: { ...process.env, ORG_CLAUDE_BIN: "node", ORG_CLAUDE_BIN_ARGS: JSON.stringify([stub]) },
      timeout: 90_000,
    });
    try {
      expect(r.status).toBe(0);
      const pid = Number(readFileSync(pidFile, "utf-8"));
      // POLL THE PROPERTY, DO NOT SLEEP TOWARD IT. The old loop slept 250ms up
      // to twenty times and then asserted, which asserts that five seconds was
      // enough on THIS machine at THIS moment -- and it was not: this test and
      // its sibling were the only two failures in the file on a developer
      // laptop, at ~7.6s and ~5.1s. `waitUntil` returns at the first instant
      // the process is gone, so a loaded runner only makes it wait longer, and
      // a real failure (the tree was never killed) still fails on any machine.
      await waitUntil(() => !isAlive(pid), {
        timeoutMs: 20_000,
        describe: `the detached grandchild ${String(pid)} to be killed with its session`,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
