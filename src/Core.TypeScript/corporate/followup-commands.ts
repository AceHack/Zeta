/**
 * corporate/followup-commands.ts — the operator's commands behind the after-the-handoff seams.
 *
 * Four seams, each a COMMAND the operator supplies, for the same reason the handoff is one: how a
 * description is written, how a session decides about feedback, how a checkout is verified and how a
 * review system is read are the project's knowledge, not the register's.
 *
 *   describe   `<cmd> ... describe <workId>` in the change's checkout; prints the path of a markdown
 *              description on its first line. Told the sections in ORG_MR_SECTIONS.
 *   follow-up  `<cmd> ... follow-up <workId>` in the change's checkout; prints its decisions as a JSON
 *              object on its last line. Told the open items in ORG_ACTION_ITEMS.
 *   verify     the run's own `--work-verify`, re-run in the change's checkout after it moved.
 *   feedback   `<cmd> ...`, given the handed-off changes on stdin as JSON, prints deliveries as JSON
 *              lines. Plus a directory webhooks file deliveries into. Both are READS.
 *   answer     `<cmd> ...`, given one change's settled items on stdin, replies where each was raised
 *              and prints one result per item as a JSON line. The one seam that writes to the review
 *              system - and only what the organization already decided and recorded.
 *
 * Every spawn is `shell: false`, nothing untrusted reaches argv, and a command that fails is a
 * refusal carried back to the runtime - never a default that pretends it succeeded.
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ActionItem, HandedOffChange } from "./org-fold";
import type {
  AnswerCheck,
  AnswerCheckRequest,
  AnswerRequest,
  AnswerResult,
  FeedbackDelivery,
  FollowUpOutcome,
  FollowUpRequest,
  FollowUpPlan,
  FollowUpPlanRequest,
  FollowUpReviewRequest,
  FollowUpReviewVerdict,
  ItemDecision,
} from "./change-followup";
import { sectionsBrief, type DescribeRequest } from "./change-request";
import { updateIsEmpty, type TicketCommentRequest, type TicketUpdate, type TicketUpdateRequest } from "./ticket-report";
import type { ChangeHandle, PortResult } from "./providers";

export interface CommandSpec {
  readonly command: string;
  readonly args: readonly string[];
  readonly timeoutMs?: number;
}

const MAX_OUTPUT = 32 * 1024 * 1024;

/**
 * THE SAME CALL, WITHOUT HOLDING THE ONLY THREAD.
 *
 * MEASURED on agentic-tpm, 2026-09-12: `--parallel 3` was set, the runtime queued both requests and
 * said "3 at a time" in its own record - and task-032's session began at 15:15:46, the second
 * task-040's ended. Perfectly serial. `ferry` was never at fault: it starts N ferries with
 * `Promise.all`, but the first one called a session through `spawnSync`, which BLOCKS THE ONLY
 * THREAD for as long as the session runs (21.6 min here). No other ferry can be scheduled while a
 * thread is blocked, so the degree-of-parallelism could never be anything but one.
 *
 * `ferry.test.ts` passed throughout, because it is given async work. The abstraction was right and
 * the port underneath it was synchronous - so the composition was the thing nobody tested.
 *
 * Returns exactly what `spawnSync` returns (`status`, `stdout`, `stderr`, `error`), so every caller
 * reads the result the same way it always did; only the awaiting changed.
 */
async function runAsync(
  spec: CommandSpec,
  extra: readonly string[],
  cwd: string,
  env: Record<string, string>,
  input?: string,
): Promise<{ status: number | null; stdout: string; stderr: string; error?: Error }> {
  return await new Promise((resolve) => {
    const child = spawn(spec.command, [...spec.args, ...extra], {
      cwd,
      env: { ...process.env, ...env },
      shell: false,
      windowsHide: true,
    });
    let out = "";
    let err = "";
    let over = false;
    let failed: Error | undefined;
    let done = false;
    // A child that outruns the buffer is stopped, exactly as spawnSync's maxBuffer stops one.
    const cap = (add: string, which: "out" | "err"): void => {
      if (over) return;
      if (which === "out") out += add;
      else err += add;
      if (out.length + err.length <= MAX_OUTPUT) return;
      over = true;
      failed = new Error(`${spec.command} wrote more than ${String(MAX_OUTPUT)} bytes`);
      child.kill("SIGKILL");
    };
    child.stdout?.setEncoding("utf-8");
    child.stderr?.setEncoding("utf-8");
    child.stdout?.on("data", (d: string) => { cap(d, "out"); });
    child.stderr?.on("data", (d: string) => { cap(d, "err"); });
    const timer = setTimeout(() => {
      failed ??= new Error(`${spec.command} did not finish within ${String(spec.timeoutMs ?? 3_000_000)}ms`);
      child.kill("SIGKILL");
    }, spec.timeoutMs ?? 3_000_000);
    const settle = (status: number | null): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ status, stdout: out, stderr: err, ...(failed === undefined ? {} : { error: failed }) });
    };
    child.on("error", (e: Error) => { failed ??= e; settle(null); });
    child.on("close", (code) => { settle(failed === undefined ? code : null); });
    if (input !== undefined) child.stdin?.end(input);
    else child.stdin?.end();
  });
}

function run(spec: CommandSpec, extra: readonly string[], cwd: string, env: Record<string, string>, input?: string) {
  return spawnSync(spec.command, [...spec.args, ...extra], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf-8",
    shell: false,
    timeout: spec.timeoutMs ?? 3_000_000,
    maxBuffer: MAX_OUTPUT,
    ...(input === undefined ? {} : { input }),
  });
}

const tail = (t: string | null | undefined): string => String(t ?? "").trim().split(/\r?\n/).slice(-6).join(" | ").slice(0, 600);

/**
 * THE TWO HALVES OF TELLING A TICKET SOMETHING: compose it, then post it.
 *
 * Separate on purpose. The composer is an agent and can be wrong about the work; the poster is a
 * protocol and can only be wrong about the wire. Keeping them apart means a tracker outage cannot
 * make the organization re-think, and a bad update cannot be blamed on the network.
 */
export function commandTicketComposer(spec: CommandSpec, fallbackCwd: string): (r: TicketUpdateRequest) => Promise<PortResult<TicketUpdate>> {
  return async (r) => {
    const ran = await runAsync(spec, ["ticket-update", r.workId], r.workdir ?? fallbackCwd, {
      ORG_TICKET: r.ticket,
      ORG_MILESTONE: r.gate,
      ...(r.gateReason === undefined ? {} : { ORG_MILESTONE_REASON: r.gateReason.split(/\s+/).join(" ").slice(0, 400) }),
      ...(r.title === undefined ? {} : { ORG_MR_TITLE: r.title }),
      ...(r.branch === undefined ? {} : { ORG_BRANCH: r.branch }),
      ...(r.workdir === undefined ? {} : { ORG_WORKDIR: r.workdir }),
    });
    if (ran.error !== undefined) return { ok: false, reason: `'${spec.command}' could not run: ${ran.error.message}` };
    if (ran.status !== 0) return { ok: false, reason: `the update's author exited ${String(ran.status)}: ${tail(ran.stderr)}` };
    const line = String(ran.stdout ?? "").split(/\r?\n/).find((l) => l.trim().startsWith("{")) ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return { ok: false, reason: `the update's author answered with no JSON object (got '${line.slice(0, 200)}')` };
    }
    const it = parsed as { done?: unknown; willDo?: unknown; status?: unknown };
    const lines = (v: unknown): readonly string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter((x) => x.trim() !== "") : []);
    const update: TicketUpdate = { done: lines(it.done), willDo: lines(it.willDo), status: String(it.status ?? "").trim() };
    if (updateIsEmpty(update)) return { ok: false, reason: "the update's author said nothing - an empty update is not posted" };
    return { ok: true, value: update, evidence: [{ kind: "trace", ref: `ticket-update:${r.ticket}:${r.gate}` }] };
  };
}

/**
 * Posts the comment. The tracker is passed IN, so this file knows nothing about Jira or Linear -
 * the command does, and a third tracker is that command's business rather than this one's.
 */
export function commandTicketPoster(spec: CommandSpec, fallbackCwd: string): (r: TicketCommentRequest) => Promise<PortResult<{ readonly commentId?: string }>> {
  return async (r) => {
    const ran = await runAsync(spec, [r.ticket], fallbackCwd, { ORG_TRACKER: r.tracker, ORG_TICKET: r.ticket }, r.body);
    if (ran.error !== undefined) return { ok: false, reason: `'${spec.command}' could not run: ${ran.error.message}` };
    if (ran.status !== 0) return { ok: false, reason: `${r.tracker} did not take the comment (exit ${String(ran.status)}): ${tail(ran.stderr)}` };
    const id = String(ran.stdout ?? "").split(/\r?\n/)[0]?.trim() ?? "";
    return { ok: true, value: id === "" ? {} : { commentId: id }, evidence: id === "" ? [] : [{ kind: "trace", ref: `ticket-comment:${r.tracker}:${id}` }] };
  };
}

/** A description author behind a command. See the module header for its protocol. */
export function commandDescriber(spec: CommandSpec, fallbackCwd: string): (r: DescribeRequest) => Promise<PortResult<string>> {
  return async (r) => {
    const ran = await runAsync(spec, ["describe", r.workId], r.workdir ?? fallbackCwd, {
      ORG_MR_SECTIONS: sectionsBrief(r.sections),
      ...(r.settled === undefined || r.settled.length === 0
        ? {}
        : { ORG_MR_SETTLED: r.settled.map((s) => `- [${s.outcome}] ${s.summary.split(/\s+/).join(" ").slice(0, 200)}\n  told the reviewer: ${s.how.split(/\s+/).join(" ")}`).join("\n") }),
      ORG_MR_TITLE: r.title,
      ORG_BRANCH: r.branch,
      ...(r.base === undefined ? {} : { ORG_BASE: r.base }),
      ...(r.workdir === undefined ? {} : { ORG_WORKDIR: r.workdir }),
    });
    if (ran.error !== undefined) return { ok: false, reason: `'${spec.command}' could not run: ${ran.error.message}` };
    if (ran.status !== 0) return { ok: false, reason: `the description author exited ${String(ran.status)}: ${tail(ran.stderr)}` };
    const path = String(ran.stdout ?? "").split(/\r?\n/)[0]?.trim() ?? "";
    // READ, THEN INTERPRET THE FAILURE - never check-then-read, whose answer is stale by the read.
    let text: string;
    try {
      if (path === "") throw new Error("no path");
      text = readFileSync(path, "utf-8");
    } catch {
      return { ok: false, reason: `the description author named no readable file (got '${path.slice(0, 200)}')` };
    }
    return { ok: true, value: text, evidence: [{ kind: "trace", ref: `description:${path}` }] };
  };
}

/** The last line of output that parses as a JSON object. */
function lastJson(stdout: string | null | undefined): Record<string, unknown> | undefined {
  const lines = String(stdout ?? "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("{"));
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const v = JSON.parse(lines[i] as string) as unknown;
      if (typeof v === "object" && v !== null && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      // not this line
    }
  }
  return undefined;
}

/** How much of an item's detail travels in the prompt before the session is sent to `observe`. */
export const DETAIL_IN_PROMPT = 600;

/**
 * How much of an earlier attempt's account the next session is shown.
 *
 * Shorter than a detail on purpose: what the last round DID is a few sentences, and the point of
 * carrying it is to save the next session from re-deriving it - not to re-paste a transcript.
 */
export const ATTEMPT_IN_PROMPT = 400;

/** How many earlier attempts go in the prompt. The rest stay in the record for `observe`. */
export const ATTEMPTS_IN_PROMPT = 2;

/**
 * How much recalled memory a follow-up session is handed.
 *
 * Bounded like everything else that crosses this seam: memory is meant to save a session from
 * working something out again, and a wall of it would cost more context than the deriving did.
 */
export const RECALL_IN_PROMPT = 4000;

/** The detail, cut, saying where the whole of it is - which is the worldview, not another message. */
function detailForPrompt(detail: string, workId: string): string {
  const t = detail.trim();
  if (t.length <= DETAIL_IN_PROMPT) return t;
  return `${t.slice(0, DETAIL_IN_PROMPT)}… (+${String(t.length - DETAIL_IN_PROMPT)} more — open \`observe item ${workId}\` and read its passage)`;
}

/** A follow-up session behind a command. See the module header for its protocol. */
export function commandFollowUp(spec: CommandSpec, fallbackCwd: string): (r: FollowUpRequest) => Promise<PortResult<FollowUpOutcome>> {
  return async (r) => {
    const items = r.items.map((i: ActionItem) => ({
      id: i.actionItemId,
      kind: i.itemKind,
      source: i.source,
      summary: i.summary,
      // BOUNDED, and the whole of it is in `observe`. An item's detail is a reviewer's entire
      // comment or a pipeline's job logs; pasting it here put ~16KB of world into a prompt whose
      // repository already spends most of the context window on its own documents.
      ...(i.detail === undefined ? {} : { detail: detailForPrompt(i.detail, r.workId) }),
      ...(i.author === undefined ? {} : { author: i.author }),
      ...(i.url === undefined ? {} : { url: i.url }),
      // Decided once already, and that did not stand: the session is told why, so it does not repeat it.
      ...(i.reopened === undefined ? {} : { reopenedBecause: i.reopened.why }),
      // WHAT EARLIER ROUNDS ALREADY TRIED, so this one starts from it rather than deriving it again.
      // A reopened item used to arrive with the objection and no account of the work behind it.
      ...(i.attempts === undefined || i.attempts.length === 0
        ? {}
        : {
            alreadyTried: i.attempts.slice(-ATTEMPTS_IN_PROMPT).map((a) => ({
              decided: a.outcome,
              what: a.how.trim().length <= ATTEMPT_IN_PROMPT ? a.how.trim() : `${a.how.trim().slice(0, ATTEMPT_IN_PROMPT)}…`,
              thenWhat: a.thenWhat.split(/s+/).join(" ").slice(0, ATTEMPT_IN_PROMPT),
            })),
          }),
      ...(i.reopenedTimes === undefined || i.reopenedTimes < 2 ? {} : { turnedBackTimes: i.reopenedTimes }),
      ...(i.deferred === undefined ? {} : { deferredBefore: i.deferred.why }),
    }));
    const ran = await runAsync(spec, ["follow-up", r.workId], r.workdir ?? fallbackCwd, {
      ORG_FOLLOWUP_MODE: r.mode,
      ORG_ACTION_ITEMS: JSON.stringify(items),
      ORG_CAN_SYNC: r.canSync ? "1" : "0",
      ...(r.pipelines === undefined ? {} : { ORG_PIPELINE_POLICY: r.pipelines }),
      ORG_ASSIGNEE: r.hatId,
      ORG_BRANCH: r.branch,
      // What this hat already knows. Absent when the organization has no memory configured, which
      // is exactly how it read before the circuit reached this seam.
      ...(r.recall === undefined || r.recall.trim() === "" ? {} : { ORG_RECALL: r.recall.trim().slice(0, RECALL_IN_PROMPT) }),
      ...(r.base === undefined ? {} : { ORG_BASE: r.base }),
      ...(r.workdir === undefined ? {} : { ORG_WORKDIR: r.workdir }),
      ...(r.conflicts === undefined ? {} : { ORG_CONFLICTS: JSON.stringify(r.conflicts) }),
    });
    if (ran.error !== undefined) return { ok: false, reason: `'${spec.command}' could not run: ${ran.error.message}` };
    if (ran.status !== 0) return { ok: false, reason: `the follow-up session exited ${String(ran.status)}: ${tail(ran.stderr)}` };
    const out = lastJson(ran.stdout);
    if (out === undefined) return { ok: false, reason: "the follow-up session printed no decisions" };
    const decisions = Array.isArray(out["decisions"])
      ? (out["decisions"] as unknown[]).flatMap((d): ItemDecision[] => {
          if (typeof d !== "object" || d === null) return [];
          const x = d as Record<string, unknown>;
          return [{
            actionItemId: String(x["id"] ?? x["actionItemId"] ?? ""),
            outcome: String(x["outcome"] ?? "") as ItemDecision["outcome"],
            how: String(x["how"] ?? ""),
            // Only an explicit `false` withholds the answer: a session that says nothing about it answers.
            ...(x["respond"] === false ? { respond: false } : { respond: true }),
          }];
        })
      : [];
    return {
      ok: true,
      value: { decisions, syncWithTarget: out["syncWithTarget"] === true, summary: String(out["summary"] ?? "") },
      evidence: [],
    };
  };
}

/** How many changed files a review is handed before the list is cut. */
export const CHANGED_FILES_IN_PROMPT = 60;

/** A path that looks like a test, by the conventions every repository here actually uses. */
export function looksLikeATest(path: string): boolean {
  const parts = path.toLowerCase().split("/");
  const file = parts[parts.length - 1] ?? "";
  const inATestDirectory = parts.slice(0, -1).some((d) => d === "test" || d === "tests" || d === "__tests__" || d === "spec" || d === "specs");
  const dot = file.split(".");
  const suffixedWithOne = dot.length > 2 && (dot[dot.length - 2] === "test" || dot[dot.length - 2] === "spec");
  const namedLikeOne = file.startsWith("test_") || file.startsWith("spec_");
  return inATestDirectory || suffixedWithOne || namedLikeOne;
}

/**
 * WHAT CHANGED BETWEEN TWO COMMITS, handed to a reviewer instead of made it go and find out.
 *
 * MEASURED across agentic-tpm and dev-portal, 2026-09-11..12 (94 calls, $242.53): a `review` call
 * averages 72 agent turns, against 18 for the `follow-up` that produced the work it judges - four
 * times the turns to check a change as to make it. Turns are the cost here: 156 tokens are READ for
 * every one written, so what a session has to discover for itself is most of the bill.
 *
 * A reviewer's first several turns are always the same: what changed, and which of those are tests.
 * Both are one git command, so the organization runs it once rather than paying a model to find out.
 * Bounded, and empty when it cannot be read - a reviewer that is handed nothing does exactly what
 * it did before, which is look for itself.
 */
async function changedBetween(checkout: string, from: string, to: string): Promise<{ readonly files: readonly string[]; readonly tests: readonly string[]; readonly more: number } | undefined> {
  const ran = await runAsync({ command: "git", args: [] }, ["-C", checkout, "diff", "--name-only", `${from}..${to}`], checkout, {});
  if (ran.error !== undefined || ran.status !== 0) return undefined;
  const all = String(ran.stdout ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (all.length === 0) return undefined;
  const shown = all.slice(0, CHANGED_FILES_IN_PROMPT);
  return { files: shown, tests: all.filter(looksLikeATest).slice(0, CHANGED_FILES_IN_PROMPT), more: Math.max(0, all.length - shown.length) };
}

/**
 * Remove a scratch worktree the organization named, whatever state the session left it in.
 *
 * Deliberately total: unregister it, then delete whatever is still on disk, then prune the stale
 * entries. Every step may legitimately fail - the session may have removed it already, or never
 * made it - and none of them can be allowed to fail a review that has already been given.
 */
async function removeScratchWorktree(checkout: string, scratch: string): Promise<void> {
  const git = { command: "git", args: [] as readonly string[] } satisfies CommandSpec;
  try {
    await runAsync(git, ["-C", checkout, "worktree", "remove", "--force", scratch], checkout, {});
  } catch {
    /* it may never have been registered */
  }
  try {
    rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* it may never have existed */
  }
  try {
    await runAsync(git, ["-C", checkout, "worktree", "prune"], checkout, {});
  } catch {
    /* the checkout may not be a repository */
  }
}

/**
 * WHAT A GREEN SUITE AT A COMMIT IS WORTH: not running it again at that same commit.
 *
 * MEASURED on agentic-tpm, 2026-09-12: every check ran the whole suite - 81-88s of jest plus 7-8s of
 * vitest - and `verify.log` shows the same two suites re-run round after round against the same two
 * branches. A round that is turned back leaves its commits unpushed, so the NEXT round verifies the
 * identical tree from scratch; a round that changes no code at all (an answer rewritten, a
 * description amended) does too.
 *
 * The receipt is a file in the checkout's own `.git`, so it survives the run: `watch-org` spawns a
 * fresh `run-org` every tick, and anything held in memory dies with it.
 *
 * IT IS ONLY EVER A PASS. A failure is not cached: a suite that failed once is exactly the thing
 * somebody is about to change, and a cached red would outlive the fix.
 *
 * THREE THINGS MUST MATCH or the receipt is ignored - the commit, a clean working tree (uncommitted
 * work is not in the commit and the suite has not seen it), and the verifier command itself.
 */
const VERIFY_RECEIPT = "org-verified";

/** What the receipt is for: this commit, this verifier. A clean tree is checked separately. */
function receiptFor(spec: CommandSpec, commit: string): string {
  return `${commit} ${createHash("sha256").update(JSON.stringify([spec.command, spec.args ?? []])).digest("hex").slice(0, 16)}`;
}

/**
 * The checkout's HEAD and whether anything is uncommitted - or undefined when either cannot be read,
 * which means no receipt is written or believed and the suite simply runs, as it always did.
 */
async function treeState(cwd: string): Promise<{ readonly commit: string; readonly clean: boolean } | undefined> {
  const git = { command: "git", args: [] as readonly string[] } satisfies CommandSpec;
  const head = await runAsync(git, ["rev-parse", "HEAD"], cwd, {});
  if (head.error !== undefined || head.status !== 0) return undefined;
  const commit = String(head.stdout ?? "").trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) return undefined;
  const dirty = await runAsync(git, ["status", "--porcelain"], cwd, {});
  if (dirty.error !== undefined || dirty.status !== 0) return undefined;
  return { commit, clean: String(dirty.stdout ?? "").trim() === "" };
}

/** Where the receipt lives for this checkout - inside its own git directory, worktree or not. */
async function receiptPath(cwd: string): Promise<string | undefined> {
  const where = await runAsync({ command: "git", args: [] }, ["rev-parse", "--absolute-git-dir"], cwd, {});
  if (where.error !== undefined || where.status !== 0) return undefined;
  const dir = String(where.stdout ?? "").trim();
  return dir === "" ? undefined : join(dir, VERIFY_RECEIPT);
}

/**
 * Re-run the work verifier in a change's own checkout. Exit 0 is a pass; anything else is the reason.
 *
 * AWAITED, NOT BLOCKING. MEASURED on agentic-tpm, 2026-09-12: the suite is 81-88s of jest plus 7-8s
 * of vitest, and this port called `spawnSync` - so for a minute and a half NOTHING else in the run
 * could proceed: not another item's session, not a poll, not the queue that is supposed to be
 * running three at a time. The same defect as the follow-up port had, on the longest command here.
 */
export function commandVerifier(spec: CommandSpec, fallbackCwd: string): (h: ChangeHandle, slot?: number) => Promise<PortResult<string>> {
  return async (h, slot) => {
    const workId = h.changeId.includes("@") ? h.changeId.slice(h.changeId.lastIndexOf("@") + 1) : h.changeId;
    const cwd = h.workdir ?? fallbackCwd;
    // ── A GREEN SUITE AT THIS EXACT COMMIT IS NOT RUN AGAIN ─────────────────────────────────────
    const state = await treeState(cwd);
    const receipt = state === undefined ? undefined : await receiptPath(cwd);
    const want = state === undefined ? undefined : receiptFor(spec, state.commit);
    if (state?.clean === true && receipt !== undefined && want !== undefined) {
      try {
        // One syscall, one answer. existsSync-then-read is a window the check-then-use
        // lint refuses; an absent or unreadable receipt is no receipt and the suite runs.
        if (readFileSync(receipt, "utf-8").trim() === want) {
          return {
            ok: true,
            value: `the suite already passed at ${state.commit.slice(0, 8)} and nothing has changed since`,
            evidence: [{ kind: "trace", ref: `verified:${h.branch}@${state.commit.slice(0, 8)}` }],
          };
        }
      } catch {
        // An unreadable or absent receipt is no receipt: run the suite.
      }
    }
    // WHICH CONCURRENT VERIFICATION THIS IS. At the default width there is only ever slot 0; when
    // the operator widens it, this is the number the project's own verify command allocates ports
    // from, so two suites on one machine do not bind the same one.
    const ran = await runAsync(spec, [workId], cwd, { ORG_BRANCH: h.branch, ORG_VERIFY_SLOT: String(slot ?? 0) });
    if (ran.error !== undefined) return { ok: false, reason: `'${spec.command}' could not run: ${ran.error.message}` };
    if (ran.status !== 0) return { ok: false, reason: `exit ${String(ran.status)}: ${tail(ran.stderr) || tail(ran.stdout)}` };
    // Only a pass is recorded, and only for a tree that was clean when it ran. Failing to write the
    // receipt costs a re-run later and nothing else, so it never fails the verification.
    if (state?.clean === true && receipt !== undefined && want !== undefined) {
      try {
        writeFileSync(receipt, `${want}
`);
      } catch {
        /* the receipt is an optimisation, never a result */
      }
    }
    return { ok: true, value: tail(ran.stdout), evidence: [{ kind: "trace", ref: `verified:${h.branch}` }] };
  };
}

/**
 * An answerer behind a command: given one change's owed answers on stdin as JSON, it replies where
 * each item was raised and prints one result per item as a JSON line. The only seam that WRITES to
 * the review system, and it writes only what the organization already decided and recorded.
 */
export function commandAnswerer(spec: CommandSpec, fallbackCwd: string): (r: AnswerRequest) => Promise<PortResult<readonly AnswerResult[]>> {
  return async (r) => {
    const ran = await runAsync(spec, [], r.workdir ?? fallbackCwd, { ORG_BRANCH: r.branch }, JSON.stringify(r));
    if (ran.error !== undefined) return { ok: false, reason: `the answerer '${spec.command}' could not run: ${ran.error.message}` };
    const results: AnswerResult[] = [];
    for (const line of String(ran.stdout ?? "").split(/\r?\n/)) {
      const t = line.trim();
      if (!t.startsWith("{")) continue;
      try {
        const x = JSON.parse(t) as Record<string, unknown>;
        const id = typeof x["actionItemId"] === "string" ? x["actionItemId"] : "";
        if (!r.items.some((i) => i.actionItemId === id)) continue;
        if (typeof x["error"] === "string") results.push({ actionItemId: id, error: x["error"] });
        else {
          results.push({
            actionItemId: id,
            resolved: x["resolved"] === true,
            ...(typeof x["replyId"] === "string" && x["replyId"] !== "" ? { replyId: x["replyId"] } : {}),
            ...(typeof x["skipped"] === "string" && x["skipped"] !== "" ? { skipped: x["skipped"] } : {}),
          });
        }
      } catch {
        // a line that is not a result is the answerer talking
      }
    }
    // A non-zero exit with no results is a failure; with results, the results are what happened.
    if (ran.status !== 0 && results.length === 0) return { ok: false, reason: `the answerer exited ${String(ran.status)}: ${tail(ran.stderr)}` };
    return { ok: true, value: results, evidence: [] };
  };
}

/**
 * Answers checked before posting, by a session behind the follow-up command (`<cmd> ...
 * check-answers <workId>` in the change's checkout). What it checks travels in a FILE named by
 * ORG_CHECK_FILE - descriptions and accounts outgrow an environment variable on Windows (32K).
 * It prints `{"results":[{"id","confirmed","unconfirmed"}]}` as its last JSON line.
 */
export function commandAnswerChecker(spec: CommandSpec, fallbackCwd: string) {
  return async (r: AnswerCheckRequest): Promise<PortResult<readonly AnswerCheck[]>> => {
    const dir = mkdtempSync(join(tmpdir(), "org-check-"));
    const file = join(dir, "check.json");
    try {
      writeFileSync(file, JSON.stringify({ description: r.description ?? null, items: r.items }), { mode: 0o600 });
      const ran = await runAsync(spec, ["check-answers", r.workId], r.workdir ?? fallbackCwd, { ORG_CHECK_FILE: file, ORG_BRANCH: r.branch });
      if (ran.error !== undefined) return { ok: false, reason: `the answer checker '${spec.command}' could not run: ${ran.error.message}` };
      if (ran.status !== 0) return { ok: false, reason: `the answer checker exited ${String(ran.status)}: ${tail(ran.stderr)}` };
      const out = lastJson(ran.stdout);
      const results = Array.isArray(out?.["results"]) ? (out?.["results"] as unknown[]) : undefined;
      if (results === undefined) return { ok: false, reason: "the answer checker printed no results" };
      // AN ITEM THE CHECKER SAID NOTHING ABOUT IS NOT CONFIRMED: silence is not a check.
      return {
        ok: true,
        value: r.items.map((i) => {
          const x = results.find((y) => typeof y === "object" && y !== null && (y as Record<string, unknown>)["id"] === i.actionItemId) as Record<string, unknown> | undefined;
          const unconfirmed = Array.isArray(x?.["unconfirmed"]) ? (x?.["unconfirmed"] as unknown[]).map(String).filter((s) => s.trim() !== "") : [];
          return x === undefined
            ? { actionItemId: i.actionItemId, confirmed: false, unconfirmed: ["the checker said nothing about this answer"] }
            : { actionItemId: i.actionItemId, confirmed: x["confirmed"] === true && unconfirmed.length === 0, unconfirmed };
        }),
        evidence: [],
      };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

/** A request's current description, through the answerer command (`op: "read"`). */
export function commandChangeReader(spec: CommandSpec, fallbackCwd: string) {
  return async (changeUrl: string): Promise<PortResult<{ readonly description: string }>> => {
    const ran = await runAsync(spec, [], fallbackCwd, {}, JSON.stringify({ op: "read", changeUrl }));
    if (ran.error !== undefined) return { ok: false, reason: `'${spec.command}' could not run: ${ran.error.message}` };
    if (ran.status !== 0) return { ok: false, reason: `reading the request exited ${String(ran.status)}: ${tail(ran.stderr)}` };
    const out = lastJson(ran.stdout);
    if (typeof out?.["description"] !== "string") return { ok: false, reason: "reading the request returned no description" };
    return { ok: true, value: { description: out["description"] }, evidence: [] };
  };
}

/**
 * A follow-up's commits reviewed through the run's own review command (`<cmd> ... <gate> <workId>`
 * in the change's checkout), told what it is reviewing in ORG_FOLLOWUP_REVIEW. Exit 0 approves.
 */
export function commandFollowUpReview(spec: CommandSpec, fallbackCwd: string) {
  return async (r: FollowUpReviewRequest): Promise<PortResult<FollowUpReviewVerdict>> => {
    const checkout = r.workdir ?? fallbackCwd;
    // ── THE SCRATCH COPY IS THE ORGANIZATION'S TO CLEAN UP, NOT THE REVIEWER'S ──────────────────
    // Proving a test non-vacuous means a throwaway worktree, and the reviewer was told to make one
    // at a path of its own choosing and remove it afterwards. Cleanup that depends on an agent
    // remembering is cleanup that does not happen: the copies accumulate, and on a synced folder
    // every one of them is a full checkout being uploaded. So the path is NAMED here, and removed
    // here, whatever the session did or failed to do with it.
    const scratch = join(tmpdir(), `org-review-${r.workId.replace(/[^A-Za-z0-9_-]/g, "_")}-${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`);
    // The first several turns of every review are "what changed, and which of those are tests".
    // One git command, run once here, instead of a model discovering it at 72 turns a call.
    const changed = await changedBetween(checkout, r.from, r.to);
    const ran = await runAsync(spec, [r.gate, r.workId], checkout, {
      ORG_REVIEW_AS: r.reviewerHatId,
      ORG_BRANCH: r.branch,
      ORG_REVIEW_SCRATCH: scratch,
      ...(changed === undefined ? {} : { ORG_REVIEW_CHANGED: JSON.stringify(changed) }),
      ORG_FOLLOWUP_REVIEW: JSON.stringify({ from: r.from, to: r.to, items: r.items, ...(r.alreadyProven === undefined ? {} : { alreadyProven: r.alreadyProven }) }),
      ...(r.workdir === undefined ? {} : { ORG_WORKDIR: r.workdir }),
    }).finally(async () => {
      await removeScratchWorktree(checkout, scratch);
    });
    if (ran.error !== undefined) return { ok: false, reason: `the reviewer '${spec.command}' could not run: ${ran.error.message}` };
    const lines = String(ran.stdout ?? "").trim().split(/\r?\n/).filter((l) => !l.startsWith("usage:"));
    const said = lines.filter((l) => !l.trim().startsWith("{")).join(" ").slice(0, 2000);
    if (ran.status !== 0 && ran.status !== 1) return { ok: false, reason: `the reviewer exited ${String(ran.status)}: ${tail(ran.stderr) || said}` };
    // WHAT IT TURNED BACK, when it said. A reviewer that names nothing turns the whole round back.
    const structured = lastJson(ran.stdout);
    const rejected = Array.isArray(structured?.["rejected"]) ? (structured["rejected"] as unknown[]).map((x) => String(x)) : undefined;
    return {
      ok: true,
      value: {
        approved: ran.status === 0,
        reason: said === "" ? `exit ${String(ran.status)}` : said,
        ...(rejected === undefined || rejected.length === 0 ? {} : { rejected }),
      },
      evidence: [],
    };
  };
}

/**
 * WHICH STAGES A ROUND OWES, decided by the organization through a command.
 *
 * Invoked as `plan-round <workId>`, told what the round is about in ORG_ROUND. Prints one JSON
 * object: `{"gates":[...],"why":"..."}`. Anything else - a crash, no JSON, a stage the item's chain
 * does not owe - leaves the round owing its usual stages, which is what every round owed before
 * anyone was asked. Deciding to review LESS has to be a decision, never a parse failure.
 */
export function commandFollowUpPlanner(spec: CommandSpec, fallbackCwd: string) {
  return async (r: FollowUpPlanRequest): Promise<PortResult<FollowUpPlan>> => {
    const ran = await runAsync(spec, ["plan-round", r.workId], fallbackCwd, {
      ORG_ROUND: JSON.stringify({
        workId: r.workId,
        available: r.available,
        usual: r.usual,
        because: r.because,
        roundsSoFar: r.roundsSoFar,
        ...(r.lastTurnedBackBy === undefined ? {} : { lastTurnedBackBy: r.lastTurnedBackBy }),
      }),
      ORG_PLAN_AS: r.plannerHatId,
    });
    if (ran.error !== undefined) return { ok: false, reason: `the planner '${spec.command}' could not run: ${ran.error.message}` };
    if (ran.status !== 0) return { ok: false, reason: `the planner exited ${String(ran.status)}: ${tail(ran.stderr)}` };
    const out = lastJson(ran.stdout);
    if (out === undefined) return { ok: false, reason: "the planner printed no plan" };
    const gates = Array.isArray(out["gates"]) ? (out["gates"] as unknown[]).map((g) => String(g)) : undefined;
    if (gates === undefined) return { ok: false, reason: "the plan named no stages - not even none, which would be a list" };
    return { ok: true, value: { gates, why: String(out["why"] ?? "") }, evidence: [] };
  };
}

/**
 * The organization's own comment on a request, through the answerer command (`op: "comment"`) - how
 * configured after-open steps are performed. Prints `{"replyId"}` so the comment is recognised later.
 */
export function commandCommenter(spec: CommandSpec, fallbackCwd: string) {
  return async (r: { readonly workId: string; readonly changeUrl?: string; readonly branch: string; readonly body: string; readonly repeat?: boolean }): Promise<PortResult<{ readonly replyId?: string }>> => {
    const ran = await runAsync(spec, [], fallbackCwd, { ORG_BRANCH: r.branch }, JSON.stringify({ op: "comment", changeUrl: r.changeUrl ?? "", body: r.body, repeat: r.repeat === true }));
    if (ran.error !== undefined) return { ok: false, reason: `the commenter '${spec.command}' could not run: ${ran.error.message}` };
    if (ran.status !== 0) return { ok: false, reason: `the commenter exited ${String(ran.status)}: ${tail(ran.stderr)}` };
    const out = lastJson(ran.stdout);
    const replyId = typeof out?.["replyId"] === "string" && out["replyId"] !== "" ? out["replyId"] : undefined;
    return { ok: true, value: replyId === undefined ? {} : { replyId }, evidence: [] };
  };
}

/** A delivery that can mean something, or undefined. Fields that do not type-check are dropped, never guessed. */
export function asDelivery(raw: unknown): FeedbackDelivery | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const x = raw as Record<string, unknown>;
  const str = (k: string): string | undefined => (typeof x[k] === "string" && (x[k] as string).trim() !== "" ? (x[k] as string) : undefined);
  const deliveryId = str("deliveryId");
  const source = str("source");
  const itemKind = str("itemKind");
  const summary = str("summary");
  if (deliveryId === undefined || source === undefined || itemKind === undefined || summary === undefined) return undefined;
  const out: Record<string, string> = { deliveryId, source, itemKind, summary };
  for (const k of ["detail", "url", "author", "branch", "changeUrl", "target", "targetCommit"]) {
    const v = str(k);
    if (v !== undefined) out[k] = v;
  }
  return out as unknown as FeedbackDelivery;
}

/**
 * The deliveries waiting in the feedback directory, and the files they came from.
 *
 * A file holds one delivery or an array of them. One that does not parse is REPORTED, never dropped
 * in silence: a webhook the organization cannot read is feedback somebody gave and nobody saw.
 */
export function readFeedbackDir(dir: string): { readonly deliveries: readonly FeedbackDelivery[]; readonly files: readonly string[]; readonly unreadable: readonly string[] } {
  let names: readonly string[];
  try {
    names = readdirSync(dir);
  } catch {
    // No directory is no feedback - read, then interpret, rather than check-then-read.
    return { deliveries: [], files: [], unreadable: [] };
  }
  const deliveries: FeedbackDelivery[] = [];
  const files: string[] = [];
  const unreadable: string[] = [];
  for (const name of names.filter((n) => n.endsWith(".json")).sort()) {
    const path = join(dir, name);
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
      const all = (Array.isArray(parsed) ? parsed : [parsed]).map(asDelivery);
      if (all.some((d) => d === undefined)) unreadable.push(name);
      deliveries.push(...all.filter((d): d is FeedbackDelivery => d !== undefined));
      files.push(path);
    } catch {
      unreadable.push(name);
    }
  }
  return { deliveries, files, unreadable };
}

/** Move read deliveries aside, so the next run starts from what is new. Raising is idempotent either way. */
export function consumeFeedback(dir: string, files: readonly string[]): void {
  if (files.length === 0) return;
  const done = join(dir, "consumed");
  mkdirSync(done, { recursive: true });
  for (const f of files) {
    try {
      renameSync(f, join(done, f.slice(Math.max(f.lastIndexOf("/"), f.lastIndexOf("\\")) + 1)));
    } catch {
      // A file that cannot be moved is read again next time; the log's idempotency absorbs it.
    }
  }
}

/** Ask a poller what happened to the handed-off changes. It is given them on stdin; it prints deliveries as JSON lines. */
export function pollFeedback(
  spec: CommandSpec,
  cwd: string,
  changes: ReadonlyMap<string, HandedOffChange>,
): { readonly deliveries: readonly FeedbackDelivery[]; readonly refusal?: string } {
  if (changes.size === 0) return { deliveries: [] };
  const ran = run(spec, [], cwd, {}, JSON.stringify({ changes: [...changes.values()] }));
  if (ran.error !== undefined) return { deliveries: [], refusal: `the feedback poller '${spec.command}' could not run: ${ran.error.message}` };
  if (ran.status !== 0) return { deliveries: [], refusal: `the feedback poller exited ${String(ran.status)}: ${tail(ran.stderr)}` };
  const deliveries: FeedbackDelivery[] = [];
  for (const line of String(ran.stdout ?? "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      const d = asDelivery(JSON.parse(t));
      if (d !== undefined) deliveries.push(d);
    } catch {
      // a line that is not a delivery is the poller talking
    }
  }
  return { deliveries };
}
