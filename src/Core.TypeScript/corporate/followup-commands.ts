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

import { spawnSync } from "node:child_process";
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
import type { ChangeHandle, PortResult } from "./providers";

export interface CommandSpec {
  readonly command: string;
  readonly args: readonly string[];
  readonly timeoutMs?: number;
}

const MAX_OUTPUT = 32 * 1024 * 1024;

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

/** A description author behind a command. See the module header for its protocol. */
export function commandDescriber(spec: CommandSpec, fallbackCwd: string): (r: DescribeRequest) => Promise<PortResult<string>> {
  return async (r) => {
    const ran = run(spec, ["describe", r.workId], r.workdir ?? fallbackCwd, {
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

/** A follow-up session behind a command. See the module header for its protocol. */
export function commandFollowUp(spec: CommandSpec, fallbackCwd: string): (r: FollowUpRequest) => Promise<PortResult<FollowUpOutcome>> {
  return async (r) => {
    const items = r.items.map((i: ActionItem) => ({
      id: i.actionItemId,
      kind: i.itemKind,
      source: i.source,
      summary: i.summary,
      ...(i.detail === undefined ? {} : { detail: i.detail }),
      ...(i.author === undefined ? {} : { author: i.author }),
      ...(i.url === undefined ? {} : { url: i.url }),
      // Decided once already, and that did not stand: the session is told why, so it does not repeat it.
      ...(i.reopened === undefined ? {} : { reopenedBecause: i.reopened.why }),
      ...(i.reopenedTimes === undefined || i.reopenedTimes < 2 ? {} : { turnedBackTimes: i.reopenedTimes }),
      ...(i.deferred === undefined ? {} : { deferredBefore: i.deferred.why }),
    }));
    const ran = run(spec, ["follow-up", r.workId], r.workdir ?? fallbackCwd, {
      ORG_FOLLOWUP_MODE: r.mode,
      ORG_ACTION_ITEMS: JSON.stringify(items),
      ORG_CAN_SYNC: r.canSync ? "1" : "0",
      ...(r.pipelines === undefined ? {} : { ORG_PIPELINE_POLICY: r.pipelines }),
      ORG_ASSIGNEE: r.hatId,
      ORG_BRANCH: r.branch,
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

/** Re-run the work verifier in a change's own checkout. Exit 0 is a pass; anything else is the reason. */
export function commandVerifier(spec: CommandSpec, fallbackCwd: string): (h: ChangeHandle) => Promise<PortResult<string>> {
  return async (h) => {
    const workId = h.changeId.includes("@") ? h.changeId.slice(h.changeId.lastIndexOf("@") + 1) : h.changeId;
    const ran = run(spec, [workId], h.workdir ?? fallbackCwd, { ORG_BRANCH: h.branch });
    if (ran.error !== undefined) return { ok: false, reason: `'${spec.command}' could not run: ${ran.error.message}` };
    return ran.status === 0
      ? { ok: true, value: tail(ran.stdout), evidence: [{ kind: "trace", ref: `verified:${h.branch}` }] }
      : { ok: false, reason: `exit ${String(ran.status)}: ${tail(ran.stderr) || tail(ran.stdout)}` };
  };
}

/**
 * An answerer behind a command: given one change's owed answers on stdin as JSON, it replies where
 * each item was raised and prints one result per item as a JSON line. The only seam that WRITES to
 * the review system, and it writes only what the organization already decided and recorded.
 */
export function commandAnswerer(spec: CommandSpec, fallbackCwd: string): (r: AnswerRequest) => Promise<PortResult<readonly AnswerResult[]>> {
  return async (r) => {
    const ran = run(spec, [], r.workdir ?? fallbackCwd, { ORG_BRANCH: r.branch }, JSON.stringify(r));
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
      const ran = run(spec, ["check-answers", r.workId], r.workdir ?? fallbackCwd, { ORG_CHECK_FILE: file, ORG_BRANCH: r.branch });
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
    const ran = run(spec, [], fallbackCwd, {}, JSON.stringify({ op: "read", changeUrl }));
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
    const ran = run(spec, [r.gate, r.workId], r.workdir ?? fallbackCwd, {
      ORG_REVIEW_AS: r.reviewerHatId,
      ORG_BRANCH: r.branch,
      ORG_FOLLOWUP_REVIEW: JSON.stringify({ from: r.from, to: r.to, items: r.items }),
      ...(r.workdir === undefined ? {} : { ORG_WORKDIR: r.workdir }),
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
    const ran = run(spec, ["plan-round", r.workId], fallbackCwd, {
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
    const ran = run(spec, [], fallbackCwd, { ORG_BRANCH: r.branch }, JSON.stringify({ op: "comment", changeUrl: r.changeUrl ?? "", body: r.body, repeat: r.repeat === true }));
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
