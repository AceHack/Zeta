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
import { fileURLToPath } from "node:url";

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
      // A model is required of every call - the tests state one, exactly as an organization must.
      ORG_CLAUDE_MODEL: "stub-model",
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
  }, 30_000);

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
    // No review answers yet: the description is not told about any.
    expect(input).not.toContain("REVIEWERS HAVE BEEN ANSWERED");
    r.cleanup();
  });

  test("check-answers: told the CURRENT description and every answer, reads only, and prints a result per answer", () => {
    // MEASURED on MR !162: a reply cited description content that did not exist, and nothing checked it.
    const dir = mkdtempSync(join(tmpdir(), "check-"));
    const file = join(dir, "check.json");
    writeFileSync(file, JSON.stringify({ description: "## Resolution\nNo backfill; see rebaseline.", items: [{ actionItemId: "gitlab:note-9", summary: "why no backfill?", outcome: "declined", how: "history is append-only", commit: "abc" }] }));
    const r = run(["check-answers", "task-9"], ok({ results: [{ id: "gitlab:note-9", confirmed: true, unconfirmed: [] }] }), { ORG_CHECK_FILE: file, ORG_BRANCH: "defect/x" });
    expect(r.status).toBe(0);
    const input = r.seen?.input ?? "";
    expect(input).toContain("## Resolution\nNo backfill; see rebaseline.");
    expect(input).toContain("history is append-only");
    expect(input).toContain("confirmed = true only if EVERY claim holds");
    expect(r.seen?.argv).not.toContain("Edit");
    expect(JSON.parse(r.stdout.trim().split(/\r?\n/).pop() as string)).toEqual({ results: [{ id: "gitlab:note-9", confirmed: true, unconfirmed: [] }] });
    r.cleanup();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a FOLLOW-UP review is told the commits and their claims, and must prove each fix's test fails without it", () => {
    // MEASURED on MR !164: a follow-up commit's claimed fix had half no test would miss; it was never reviewed.
    const r = run(["review", "implementation_review", "task-9"], ok({ verdict: "reject", reason: "no test fails without the loadingStates guard", lookedAt: ["diff"] }), {
      ORG_REVIEW_AS: "code_reviewer",
      ORG_FOLLOWUP_REVIEW: JSON.stringify({ from: "452fcafab1a2", to: "e9f5b769b246", items: [{ summary: "stale abort clobbers loadingStates", outcome: "addressed", how: "guarded the finally blocks" }] }),
    });
    expect(r.status).toBe(1);
    const input = r.seen?.input ?? "";
    expect(input).toContain("THIS IS A FOLLOW-UP REVIEW");
    expect(input).toContain("git diff 452fcafab1a2..e9f5b769b246");
    expect(input).toContain("guarded the finally blocks");
    expect(input).toContain("confirm it FAILS");
    expect(input).toContain("Never change");
    r.cleanup();
    // An ordinary gate review is not told any of this.
    const plain = run(["review", "implementation_review", "task-9"], ok({ verdict: "approve", reason: "ok", lookedAt: [] }));
    expect(plain.seen?.input).not.toContain("FOLLOW-UP REVIEW");
    plain.cleanup();
  });

  test("describe on a re-handoff is told what reviewers were answered, and that the description must carry it", () => {
    // MEASURED on MR !162: a reply said the rollout note was in the description; the rewrite had none.
    const r = run(["describe", "task-9"], ok({ description: "## Root cause\nA race." }), {
      ORG_MR_SECTIONS: "## Root cause\nwhy",
      ORG_MR_SETTLED: "- [addressed] no backfill of old rows\n  told the reviewer: option (b), a rollout note in the description",
    });
    const input = r.seen?.input ?? "";
    expect(input).toContain("REVIEWERS HAVE BEEN ANSWERED ON THIS REQUEST");
    expect(input).toContain("told the reviewer: option (b), a rollout note in the description");
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
    // MEASURED on MR !163: the posted answer said "I'll file it" - the organization cannot write to the tracker.
    expect(flagOnly.seen?.input).toContain("never \"I'll file it\"");
    const last = JSON.parse(flagOnly.stdout.trim().split(/\r?\n/).pop() as string) as { decisions: { id: string }[]; syncWithTarget: boolean };
    expect(last.decisions.map((d) => d.id)).toEqual(["gitlab:n1"]);
    expect(last.syncWithTarget).toBe(false);
    flagOnly.cleanup();
    const canSync = run(["follow-up", "task-9"], answer, { ORG_ACTION_ITEMS: items, ORG_CAN_SYNC: "1" });
    expect((JSON.parse(canSync.stdout.trim().split(/\r?\n/).pop() as string) as { syncWithTarget: boolean }).syncWithTarget).toBe(true);
    canSync.cleanup();
  });

  test("follow-up: under until_green the session is told a red pipeline cannot be declined - and is told nothing about pipelines otherwise", () => {
    const items = JSON.stringify([{ id: "gitlab:pipeline-55-failed", kind: "pipeline_failed", summary: "the request's pipeline 55 failed" }]);
    const answer = ok({ decisions: [{ id: "gitlab:pipeline-55-failed", outcome: "deferred", how: "the runner ran out of disk" }], syncWithTarget: false, summary: "s" });
    const told = run(["follow-up", "task-9"], answer, { ORG_ACTION_ITEMS: items, ORG_CAN_SYNC: "0", ORG_PIPELINE_POLICY: "until_green" });
    expect(told.status).toBe(0);
    // MEASURED on agentic-tpm !164: two red pipelines were declined as a flake, and the request stayed red.
    expect(told.seen?.input).toContain("A RED PIPELINE (item kind `pipeline_failed`) IS NOT FINISHED BY BEING EXPLAINED");
    expect(told.seen?.input).toContain("A green run locally is not a green pipeline");
    told.cleanup();
    // An organization whose pipelines are its own business is not lectured about them.
    const quiet = run(["follow-up", "task-9"], answer, { ORG_ACTION_ITEMS: items, ORG_CAN_SYNC: "0", ORG_PIPELINE_POLICY: "flag_only" });
    expect(quiet.seen?.input).not.toContain("IS NOT FINISHED BY BEING EXPLAINED");
    quiet.cleanup();
  });

  test("THE SESSION ALREADY HAS THE ITEMS WHOLE, and is told not to go fetching them", () => {
    // MEASURED on dev-portal, 2026-09-12: three sessions saw a cut passage in `observe`, asked for the
    // item whole to "recover the truncated action-item text", and thrashed their context to nothing.
    // The text was already in front of them.
    const items = JSON.stringify([{ id: "gitlab:note-1", kind: "comment", summary: "a very long review comment" }]);
    const r = run(["follow-up", "task-9"], ok({ decisions: [], syncWithTarget: false, summary: "s" }), { ORG_ACTION_ITEMS: items, ORG_CAN_SYNC: "0" });
    expect(r.seen?.input).toContain("WHAT IS PRINTED ABOVE IS THE WHOLE OF EACH ITEM");
    expect(r.seen?.input).toContain("loses its");
    expect(r.seen?.input).toContain("--passage <n>");
    r.cleanup();
  }, 30_000);

  test("A REPEAT FAILURE IS DECIDED DIFFERENTLY: the session is told the count, and that declining is a complete answer", () => {
    // MEASURED on agentic-tpm !164: the same finding claimed fixed and turned back three rounds running.
    const items = JSON.stringify([{ id: "gitlab:note-1", kind: "comment", summary: "add the index", reopenedBecause: "the test passes with the fix removed", turnedBackTimes: 3 }]);
    const answer = ok({ decisions: [{ id: "gitlab:note-1", outcome: "declined", how: "the premise does not hold: the query is covered by the existing index" }], syncWithTarget: false, summary: "s" });
    const r = run(["follow-up", "task-9"], answer, { ORG_ACTION_ITEMS: items, ORG_CAN_SYNC: "0" });
    expect(r.status).toBe(0);
    expect(r.seen?.input).toContain("turnedBackTimes");
    expect(r.seen?.input).toContain("Doing the same thing again is the one");
    expect(r.seen?.input).toContain("A finding is a");
    expect(r.seen?.input).toContain("DECLINED with the");
    r.cleanup();
  });

  test("A REVIEWER JUDGES A DECLINE ON ITS REASON, not on a test that cannot exist", () => {
    const r = run(["review", "implementation_review", "task-9"], ok({ verdict: "approve", reason: "the decline holds", lookedAt: ["the query planner output"] }), {
      ORG_FOLLOWUP_REVIEW: JSON.stringify({ from: "aaaaaaa", to: "bbbbbbb", items: [{ summary: "add the index", outcome: "declined", how: "the premise does not hold" }] }),
    });
    expect(r.seen?.input).toContain("JUDGED ON ITS REASON, NOT ON A TEST");
    expect(r.seen?.input).toContain("not every claim is right");
    expect(r.seen?.input).toContain("the author may decline it next round and that ends it");
    r.cleanup();
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
    // The guard settings file is a fresh temp path each run; the claim is about the TOKEN, so the
    // one path that legitimately differs is normalised rather than compared.
    const sameShape = (argv: readonly string[]) => argv.map((a, i) => (argv[i - 1] === "--settings" ? "<guard settings>" : a));
    expect(sameShape(withToken)).toEqual(sameShape(without.seen?.argv ?? []));
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
  }, 30_000);
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
        // UNREF'D, NOT DETACHED — and the difference is the whole test. `unref()` lets the
        // stub exit without waiting for this child; `detached: true` would additionally call
        // `setsid()`, which puts the child in its OWN process group.
        //
        // The comment here used to say detaching was needed because Node "would otherwise put
        // the child in a job object that dies with its parent, and the test would pass without
        // any tree kill at all." MEASURED 2026-09-11, and that is not what happens on POSIX:
        //
        //   plain     parent exits -> grandchild ALIVE, pgid still the parent's group
        //                          -> kill(-pgid) KILLS it
        //   detached  parent exits -> grandchild ALIVE, pgid is its own (setsid)
        //                          -> kill(-pgid) returns ESRCH, grandchild SURVIVES
        //
        // `sweepLeftovers` in tools/claude-agent.cjs kills the session BY PROCESS GROUP, so the
        // detached form asserted something that POSIX path cannot deliver — which is why both
        // these tests hung for 20s and failed. The job-object reasoning describes WINDOWS, where
        // `taskkill /T` walks the parent/child table and reaps a detached grandchild fine.
        //
        // RESTORED 2026-09-11. This fix landed once (#17271) and was reverted by #17296, which
        // rewrote the file from a branch cut before the merge. Nothing conflicted; the two tests
        // simply went red again and blocked three unrelated PRs. That is the instance behind the
        // merge-main-before-testing rule now in CLAUDE.md and AGENTS.md.
        `const g=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});g.unref();` +
        `fs.writeFileSync(${JSON.stringify(pidFile)},String(g.pid));setInterval(()=>{},1000);`,
    );
    const r = spawnSync("node", [AGENT, "work", "task-9"], {
      cwd: dir,
      encoding: "utf-8",
      env: { ...process.env, ORG_CLAUDE_BIN: "node", ORG_CLAUDE_BIN_ARGS: JSON.stringify([stub]), ORG_CLAUDE_MODEL: "stub-model", ORG_CLAUDE_TIMEOUT_MS: "2500" },
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
        `const g=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});g.unref();` +
        `fs.writeFileSync(${JSON.stringify(pidFile)},String(g.pid));` +
        `process.stdin.on("data",()=>{});process.stdin.on("end",()=>{process.stdout.write(${JSON.stringify(answer)});process.exit(0);});`,
    );
    const r = spawnSync("node", [AGENT, "review", "qa_uat", "task-9"], {
      cwd: dir,
      encoding: "utf-8",
      env: { ...process.env, ORG_CLAUDE_BIN: "node", ORG_CLAUDE_BIN_ARGS: JSON.stringify([stub]), ORG_CLAUDE_MODEL: "stub-model" },
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

describe("A CALL THAT FAILED STILL SPENT THE MONEY AND THE MINUTES", () => {
  // MEASURED on dev-portal, 2026-09-12: three runs in a row each ran a session for about six minutes
  // and left nothing behind - no cost line, no reason - because the ledger was written only after a
  // call succeeded. Three failures read exactly like an organization with nothing to do, and free.
  test("a session that answers nothing is recorded, with what went wrong and what it cost", () => {
    const dir = mkdtempSync(join(tmpdir(), "claude-agent-cost-"));
    const stub = join(dir, "stub.cjs");
    // The CLI's own envelope, with a cost and a session - and no structured answer at all.
    writeFileSync(
      stub,
      'let i="";process.stdin.on("data",d=>i+=d);process.stdin.on("end",()=>{process.stdout.write(JSON.stringify(' +
        '{ type: "result", session_id: "s-1", total_cost_usd: 3.5, num_turns: 42, usage: { output_tokens: 10 }, result: "I could not comply" }' +
        '));});',
    );
    const r = spawnSync("node", [AGENT, "work", "task-9"], {
      cwd: dir,
      encoding: "utf-8",
      env: { ...process.env, ORG_CLAUDE_BIN: "node", ORG_CLAUDE_BIN_ARGS: JSON.stringify([stub]), ORG_CLAUDE_MODEL: "stub-model", ORG_ASSIGNEE: "backend_implementer", ORG_COST_DIR: join(dir, "cost") },
    });
    expect(r.status).toBe(4);
    const day = new Date().toISOString().slice(0, 10);
    const line = JSON.parse(readFileSync(join(dir, "cost", day + ".jsonl"), "utf-8").trim().split(String.fromCharCode(10))[0] as string) as Record<string, unknown>;
    expect(line["costUsd"]).toBe(3.5);
    expect(line["agentTurns"]).toBe(42);
    expect(String(line["failed"])).toContain("no structured answer");
    rmSync(dir, { recursive: true, force: true });
  }, 30_000);
});

describe("A MODEL IS CHOSEN BY THE ORGANIZATION, NEVER INHERITED FROM WHATEVER IS INSTALLED", () => {
  test("no model configured is a REFUSAL - the call is not made", () => {
    // MEASURED 2026-09-11: nothing set a model, so every agent silently took the installed CLI's
    // default (an Opus build from a package 127 releases old) and a day of runs cost about $3,900
    // at Opus rates. An unstated model is now the same as any other unstated configuration: refused.
    const r = run(["work", "task-9"], ok({ summary: "s", commit: "", testsRun: [], blocked: "" }), { ORG_CLAUDE_MODEL: "", ORG_CLAUDE_MODEL_BY_HAT: "" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("no model is configured");
    expect(r.seen).toBeUndefined();
    r.cleanup();
  });

  test("each hat thinks with the model the organization gave IT, and the map is the operator's", () => {
    const byHat = JSON.stringify({ default: "cheap-model", backend_implementer: "expensive-model" });
    const a = run(["work", "task-9"], ok({ summary: "s", commit: "", testsRun: [], blocked: "" }), { ORG_CLAUDE_MODEL: "", ORG_CLAUDE_MODEL_BY_HAT: byHat, ORG_ASSIGNEE: "backend_implementer" });
    expect(a.seen?.argv.join(" ")).toContain("--model expensive-model");
    a.cleanup();
    const b = run(["work", "task-9"], ok({ summary: "s", commit: "", testsRun: [], blocked: "" }), { ORG_CLAUDE_MODEL: "", ORG_CLAUDE_MODEL_BY_HAT: byHat, ORG_ASSIGNEE: "release_manager" });
    expect(b.seen?.argv.join(" ")).toContain("--model cheap-model");
    b.cleanup();
  });

  test("THE WORK, NOT ONLY THE WEARER: the narrowest thing the organization said is what is used", () => {
    // MEASURED on agentic-tpm, 2026-09-12: the hat that writes a fix also DECIDES which stages a round
    // owes, and naming only hats put that decision on the same model as the implementing.
    const round = JSON.stringify({ workId: "task-9", available: ["qa_uat"], usual: ["qa_uat"], because: [], roundsSoFar: 1 });
    const plan = ok({ gates: [], why: "nothing changed" });
    const byHat = JSON.stringify({
      default: "cheap-model",
      backend_implementer: "expensive-model",
      "mode:plan-round": "deciding-model",
      "backend_implementer/plan-round": "this-hats-deciding-model",
    });
    const env = { ORG_CLAUDE_MODEL: "", ORG_CLAUDE_MODEL_BY_HAT: byHat, ORG_ROUND: round };
    // hat/mode beats mode beats hat.
    const a = run(["plan-round", "task-9"], plan, { ...env, ORG_PLAN_AS: "backend_implementer" });
    expect(a.seen?.argv.join(" ")).toContain("--model this-hats-deciding-model");
    a.cleanup();
    const b = run(["plan-round", "task-9"], plan, { ...env, ORG_PLAN_AS: "qa_director" });
    expect(b.seen?.argv.join(" ")).toContain("--model deciding-model");
    b.cleanup();
    // ...and the hat still decides its own implementing work.
    const c = run(["work", "task-9"], ok({ summary: "s", commit: "", testsRun: [], blocked: "" }), { ...env, ORG_ASSIGNEE: "backend_implementer" });
    expect(c.seen?.argv.join(" ")).toContain("--model expensive-model");
    c.cleanup();
  }, 30_000);

  test("a hat with no entry and no default is refused rather than quietly given the other hat's model", () => {
    const r = run(["work", "task-9"], ok({ summary: "s", commit: "", testsRun: [], blocked: "" }), { ORG_CLAUDE_MODEL: "", ORG_CLAUDE_MODEL_BY_HAT: JSON.stringify({ reviewer: "m" }), ORG_ASSIGNEE: "backend_implementer" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("backend_implementer");
    r.cleanup();
  });
});

describe("EVERY CALL LEAVES A COST LINE SAYING WHERE THE MONEY WENT AND WHY", () => {
  test("the ledger carries the money AND its provenance - work item, hat, mode, model, session, reason", () => {
    const store = mkdtempSync(join(tmpdir(), "org-cost-"));
    try {
      const answered = {
        type: "result", subtype: "success", is_error: false,
        structured_output: { summary: "s", commit: "", testsRun: [], blocked: "" },
        session_id: "sess-77", total_cost_usd: 1.25, num_turns: 12, duration_ms: 900,
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 4000, cache_creation_input_tokens: 200 },
      };
      const r = run(["work", "task-9"], answered, {
        ORG_STORE: store, ORG_ASSIGNEE: "backend_implementer", ORG_CLAUDE_MODEL: "stated-model",
        ORG_ID: "acme", ORG_PROFILE: "dev-portal",
        ORG_RUN_REASON: "a comment was left on the request of task-9",
      });
      expect(r.status).toBe(0);
      const day = new Date().toISOString().slice(0, 10);
      const lines = readFileSync(join(store, "cost", day + ".jsonl"), "utf-8").trim().split(String.fromCharCode(10));
      expect(lines.length).toBe(1);
      const line = JSON.parse(lines[0] as string) as Record<string, unknown>;
      expect(line["costUsd"]).toBe(1.25);
      expect(line["workId"]).toBe("task-9");
      expect(line["hat"]).toBe("backend_implementer");
      expect(line["mode"]).toBe("work");
      expect(line["model"]).toBe("stated-model");
      expect(line["sessionId"]).toBe("sess-77");
      expect(line["cacheReadTokens"]).toBe(4000);
      expect(line["cacheWriteTokens"]).toBe(200);
      // WHY the money was spent, not only how much: the reason the run was started travels with it.
      expect(line["reason"]).toBe("a comment was left on the request of task-9");
      expect(line["org"]).toBe("acme");
      expect(line["profile"]).toBe("dev-portal");
      r.cleanup();
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });

  test("the cost of a call is on the usage line too, so a run log shows it without opening the ledger", () => {
    const answered = {
      type: "result", subtype: "success", is_error: false,
      structured_output: { summary: "s", commit: "", testsRun: [], blocked: "" },
      total_cost_usd: 0.5, usage: { input_tokens: 1, output_tokens: 2 },
    };
    const r = run(["work", "task-9"], answered, { ORG_CLAUDE_MODEL: "stated-model" });
    expect(r.stdout).toContain("cost=$0.5000");
    expect(r.stdout).toContain("model=stated-model");
    r.cleanup();
  });

  test("nowhere to write the ledger is SAID, never swallowed", () => {
    const r = run(["work", "task-9"], ok({ summary: "s", commit: "", testsRun: [], blocked: "" }), { ORG_CLAUDE_MODEL: "m", ORG_STORE: "", ORG_COST_DIR: "" });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("cost not recorded");
    r.cleanup();
  });
});

describe("THE SWEEP KILLS BY PROCESS GROUP, so a reaping test may not leave the group", () => {
  // A GUARD AGAINST SILENT REVERT, and it is here because the revert already happened.
  //
  // `sweepLeftovers` in tools/claude-agent.cjs reaps a session on POSIX with
  // `process.kill(-rootPid, "SIGKILL")` -- BY PROCESS GROUP. Measured 2026-09-11:
  //
  //   plain     parent exits -> grandchild alive, pgid still the parent's -> kill(-pgid) KILLS
  //   setsid'd  parent exits -> grandchild alive, pgid its own            -> ESRCH, SURVIVES
  //
  // So a stub that puts its grandchild in a NEW process group asserts something the POSIX
  // path cannot deliver, hangs for its full 20s `waitUntil` budget, and fails. That fix
  // landed in #17271 and was REVERTED by #17296 -- a branch cut before the merge that
  // rewrote the whole file. Nothing conflicted; the tests just went red again and blocked
  // three unrelated PRs.
  //
  // A behaviour test cannot notice its own deletion, so this one asserts the SHAPE of the
  // file. Crude, and the right crudeness: it makes the next revert loud.
  //
  // THE NEEDLE IS ASSEMBLED, NEVER SPELLED. A source-grepping guard that writes its own
  // pattern as a literal convicts itself -- which this one did on its first run, and which
  // is the FIFTH time that shape has bitten in a single session. The FOURTH was this very
  // paragraph: it originally spelled out a one-minute timer call while explaining that
  // spelling out a one-minute timer call trips `audit-ambient-time-in-tests.ts` -- and it
  // duly tripped it, on a clean tree, in CI. The pattern is named here in prose only.
  //
  // Stripping comments is not enough either: the control below needs the pattern in *code*.
  // Building it from fragments is what actually works, and it is the only thing that does.
  const OPT = "detach" + "ed";
  const NEEDLES = [`${OPT}:true`, `${OPT}: true`];

  test("no stub in this file puts its grandchild in a new process group", () => {
    // fileURLToPath, never `.pathname`: on Windows the latter is "/C:/…%20…", which no read can open.
    const src = readFileSync(fileURLToPath(import.meta.url), "utf-8");
    const code = src
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    for (const needle of NEEDLES) expect(code).not.toContain(needle);
  });

  test("THE CONTROL: the guard fires on a real revert — it is not vacuous", () => {
    // Without this, a guard whose needle was misspelled, or whose comment filter emptied
    // `code`, would pass forever while checking nothing.
    const reverted = `const g=spawn(x,["-e",y],{stdio:"ignore",${NEEDLES[0] ?? ""}});`;
    expect(NEEDLES.some((n) => reverted.includes(n))).toBe(true);
  });
});
