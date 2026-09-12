/**
 * watch-org.test.ts — the organization notices what is new on its merge requests, starts a run for
 * it, and does not start one it should not: while another holds the store, for nothing new, or for
 * the same reasons over and over.
 */

import { describe, expect, test } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { RETRY_EVERY, shouldLaunch, watchProfile, watchReasons, type WatchInput } from "./watch-org";
import { isRunning, lockHolder, takeStoreLock } from "./store-lock";
import { validateRunProfile, validateRunProfiles, type RunProfile } from "./run-profile";
import type { OrgEvent } from "./org-event";
import type { OrgRecord } from "./org-registry";

/**
 * A child that simply STAYS ALIVE, with no wall-clock in it.
 *
 * These tests assert on a live process's EXISTENCE — who holds the run lock, that a
 * second run is refused — and never wait for it to finish. The child used to be
 * a one-minute timer, which reads to `audit-ambient-time-in-tests.ts` as a
 * 60-second wall-clock dependency and failed the gate. It was not one: nothing awaited
 * that timer. (Stated without writing the call out: this guard greps TEXT, so a comment
 * quoting the pattern is itself a finding — which is how this comment first failed it.)
 *
 * A listening socket is a real libuv handle, so the event loop stays open for exactly
 * as long as the parent lets it, and there is no duration anywhere to be load-sensitive
 * about. Loopback so no local firewall has an opinion; port 0 so nothing collides.
 * Fixing the idiom rather than allowlisting it: an allowlist row would have recorded a
 * wall-clock dependency that does not exist.
 */
const KEEP_ALIVE = "require('net').createServer().listen(0, '127.0.0.1')";

let seq = 0;
const ev = (fact: unknown, atMs = ++seq): OrgEvent =>
  ({ id: `e${String(seq)}`, kind: "change_projected", subjectId: "task-40", decision: "", atMs, evidenceRefs: [], supervisorChain: [], fact }) as unknown as OrgEvent;
const handedOff = ev({ kind: "change_handed_off", workId: "task-40", changeId: "c", branch: "defect/x", url: "https://git.example/p/-/merge_requests/164", base: "master", commit: "abc" });
const cr = { sections: [{ heading: "Root cause", states: "why" }], keepOut: [], sync: "merge_target" as const, replies: "reply_and_resolve" as const, afterOpen: [{ kind: "comment" as const, body: "aireview" }], why: "w" };
const aireviewDone = ev({ kind: "change_after_open", workId: "task-40", stepKey: "comment:aireview", replyId: "note-1" });
const comment = (id: string, author = "reviewer") => ({ deliveryId: id, source: "gitlab", itemKind: "diff_comment", summary: "cap the limit", author, changeUrl: `https://git.example/p/-/merge_requests/164#${id}` });
const input = (over: Partial<WatchInput>): WatchInput => ({ events: [handedOff, aireviewDone], deliveries: [], changeRequests: cr, defaultBase: "master", seen: new Set(), ...over });

describe("IS THERE ANYTHING THE ORGANIZATION HAS NOT SEEN?", () => {
  test("a quiet request is nothing new - no run", () => {
    expect(watchReasons(input({})).reasons).toEqual([]);
  });

  test("a new comment on a handed-off request is", () => {
    const v = watchReasons(input({ deliveries: [comment("note-9")] }));
    expect(v.reasons).toEqual(["new diff_comment on task-40 by reviewer"]);
    expect(v.newDeliveries).toEqual(["gitlab:note-9"]);
  });

  test("...but not one already raised, one a run was already started for, or the organization's own comments", () => {
    const raised = ev({ kind: "action_item_raised", workId: "task-40", actionItemId: "gitlab:note-9", source: "gitlab", itemKind: "diff_comment", summary: "s" });
    const settled = ev({ kind: "action_item_settled", workId: "task-40", actionItemId: "gitlab:note-9", outcome: "addressed", how: "h", respond: true });
    const answered = ev({ kind: "action_item_answered", workId: "task-40", actionItemId: "gitlab:note-9", replyId: "note-50", resolved: true });
    const v = watchReasons(
      input({
        events: [handedOff, aireviewDone, raised, settled, answered],
        // the raised one, the org's own reply, its own `aireview`, and one a run was already started for
        deliveries: [comment("note-9"), comment("note-50", "max"), comment("note-1", "max"), comment("note-60")],
        seen: new Set(["gitlab:note-60"]),
      }),
    );
    expect(v.reasons).toEqual([]);
  });

  test("an answer still owed, an item never decided, and a pending after-open step are each reasons; a deferred item waits for news", () => {
    const raised = (id: string) => ev({ kind: "action_item_raised", workId: "task-40", actionItemId: id, source: "gitlab", itemKind: "comment", summary: "s" });
    const v = watchReasons(
      input({
        events: [
          handedOff,
          raised("gitlab:owed"),
          ev({ kind: "action_item_settled", workId: "task-40", actionItemId: "gitlab:owed", outcome: "declined", how: "out of scope", respond: true }),
          raised("gitlab:undecided"),
          raised("gitlab:waiting"),
          ev({ kind: "action_item_deferred", workId: "task-40", actionItemId: "gitlab:waiting", why: "not now" }),
        ],
      }),
    );
    expect(v.reasons).toContain("gitlab:owed on task-40 is settled and owed an answer");
    expect(v.reasons).toContain("gitlab:undecided on task-40 was raised and never decided");
    expect(v.reasons).toContain("'comment:aireview' is not yet done on task-40's request");
    expect(v.reasons.some((r) => r.includes("gitlab:waiting"))).toBe(false);
  });

  test("the target moving is news once per commit", () => {
    const moved = { deliveryId: "target-master-f00", source: "gitlab", itemKind: "target_moved", summary: "master moved", target: "master" };
    expect(watchReasons(input({ deliveries: [moved] })).newDeliveries).toEqual(["gitlab:target-master-f00@task-40"]);
    expect(watchReasons(input({ deliveries: [moved], seen: new Set(["gitlab:target-master-f00@task-40"]) })).reasons).toEqual([]);
  });
});

describe("A RED PIPELINE IS NOT SETTLED BY BEING EXPLAINED", () => {
  const red = {
    deliveryId: "pipeline-55-failed",
    source: "gitlab",
    itemKind: "pipeline_failed",
    summary: "the request's pipeline 55 failed at bcc152b0aa11",
    changeUrl: "https://git.example/p/-/merge_requests/164",
  };
  // The organization decided about it already - raised, then declined as a flake. That is what
  // happened on agentic-tpm !164, and the request stayed red.
  const declined = [
    ev({ kind: "action_item_raised", workId: "task-40", actionItemId: "gitlab:pipeline-55-failed", source: "gitlab", itemKind: "pipeline_failed", summary: "s" }),
    ev({ kind: "action_item_settled", workId: "task-40", actionItemId: "gitlab:pipeline-55-failed", outcome: "declined", how: "a MongoMemoryServer flake; green locally at the same SHA", respond: true }),
    ev({ kind: "action_item_answered", workId: "task-40", actionItemId: "gitlab:pipeline-55-failed", replyId: "note-51", resolved: true }),
  ];
  const untilGreen = { ...cr, pipelines: "until_green" as const };

  test("under until_green a failing pipeline is still a reason, however the organization decided about it", () => {
    const v = watchReasons(input({ events: [handedOff, aireviewDone, ...declined], deliveries: [red], changeRequests: untilGreen, seen: new Set(["gitlab:pipeline-55-failed"]) }));
    expect(v.reasons).toEqual(["the request of task-40 is red: the request's pipeline 55 failed at bcc152b0aa11 (try 1 of 3)"]);
    expect(v.redPipelines).toEqual(["gitlab:pipeline-55-failed"]);
  });

  test("under flag_only the same pipeline, already decided, is not news again", () => {
    const v = watchReasons(input({ events: [handedOff, aireviewDone, ...declined], deliveries: [red], changeRequests: { ...cr, pipelines: "flag_only" as const } }));
    expect(v.reasons).toEqual([]);
  });

  test("A DEFERRAL NAMES ITS OWN TRIGGER: a pipeline the organization decided to wait on is not asked about again until a NEW one fails", () => {
    // MEASURED on agentic-tpm !164, 2026-09-12: an EXTERNAL pipeline with no jobs to read, failing on
    // the build agent's own MongoMemoryServer while the organization's verification of that same
    // commit passed. It deferred - correctly - and was asked twice more about the same pipeline.
    const waited = [
      ev({ kind: "action_item_raised", workId: "task-40", actionItemId: "gitlab:pipeline-55-failed", source: "gitlab", itemKind: "pipeline_failed", summary: "s" }),
      ev({ kind: "action_item_deferred", workId: "task-40", actionItemId: "gitlab:pipeline-55-failed", why: "not reproducible here: our own verification of this commit passes; the next pipeline is the trigger" }),
    ];
    const v = watchReasons(input({ events: [handedOff, aireviewDone, ...waited], deliveries: [red], changeRequests: untilGreen }));
    expect(v.reasons).toEqual([]);
    expect(v.redPipelines).toEqual([]);
    // ...and a NEW pipeline failing IS news, raised fresh.
    const next = { ...red, deliveryId: "pipeline-56-failed", summary: "the request's pipeline 56 failed at 9aa1b2c3" };
    const after = watchReasons(input({ events: [handedOff, aireviewDone, ...waited], deliveries: [next], changeRequests: untilGreen }));
    expect(after.reasons).toEqual(["the request of task-40 is red: the request's pipeline 56 failed at 9aa1b2c3 (try 1 of 3)"]);
  });

  test("a pipeline that went green stops being a reason, and the tries do not carry to the next one", () => {
    const v = watchReasons(input({ events: [handedOff, aireviewDone, ...declined], deliveries: [], changeRequests: untilGreen, pipelineTries: { "gitlab:pipeline-55-failed": 3 } }));
    expect(v.reasons).toEqual([]);
    const next = { ...red, deliveryId: "pipeline-56-failed", summary: "the request's pipeline 56 failed at 9aa1b2c3" };
    const after = watchReasons(input({ events: [handedOff, aireviewDone, ...declined], deliveries: [next], changeRequests: untilGreen, pipelineTries: { "gitlab:pipeline-55-failed": 3 } }));
    expect(after.reasons).toEqual(["the request of task-40 is red: the request's pipeline 56 failed at 9aa1b2c3 (try 1 of 3)"]);
  });

  test("SPENT, NOT SPINNING: after its allowance the pipeline is a person's, and no run is started for it", () => {
    const v = watchReasons(input({ events: [handedOff, aireviewDone, ...declined], deliveries: [red], changeRequests: untilGreen, pipelineTries: { "gitlab:pipeline-55-failed": 3 } }));
    expect(v.reasons).toEqual([]);
    expect(v.atLimit).toEqual(["gitlab:pipeline-55-failed on task-40"]);
    // The allowance is the organization's to state.
    const generous = watchReasons(input({ events: [handedOff, aireviewDone, ...declined], deliveries: [red], changeRequests: { ...untilGreen, pipelineAttempts: 5 }, pipelineTries: { "gitlab:pipeline-55-failed": 3 } }));
    expect(generous.reasons).toEqual(["the request of task-40 is red: the request's pipeline 55 failed at bcc152b0aa11 (try 4 of 5)"]);
    expect(generous.atLimit).toEqual([]);
  });

  test("an organization that has not stated a pipeline policy is not treated as having said `none`", () => {
    // NOT STATED is refused by run-org, never quietly read as "pipelines do not matter here". What a
    // watcher does with it is the old behaviour: raised once, like any other delivery.
    const v = watchReasons(input({ events: [handedOff, aireviewDone], deliveries: [red] }));
    expect(v.reasons).toEqual(["new pipeline_failed on task-40"]);
    expect(v.redPipelines).toEqual([]);
  });
});

describe("THE SAME REASONS DO NOT START THE SAME RUN OVER AND OVER", () => {
  const v = watchReasons(input({ deliveries: [comment("note-9")] }));
  test("unchanged reasons inside the retry window: no run; after it: one more try", () => {
    const state = { seen: [], lastSignature: v.signature, lastLaunchMs: 0 };
    expect(shouldLaunch(v, state, 5 * 60_000, 5).launch).toBe(false);
    expect(shouldLaunch(v, state, RETRY_EVERY * 5 * 60_000 + 1, 5).launch).toBe(true);
    expect(shouldLaunch(watchReasons(input({ deliveries: [comment("note-10")] })), state, 60_000, 5).launch).toBe(true);
  });
});

describe("A RUN IS STARTED ONLY WHEN THE STORE IS FREE, AND WHAT IT WAS STARTED FOR IS REMEMBERED", () => {
  function fakeChild(): ChildProcess {
    const c = new EventEmitter() as unknown as ChildProcess;
    (c as unknown as { pid: number }).pid = 424242;
    return c;
  }

  test("new feedback filed by a webhook starts the profile's run once; the next look sees nothing new", async () => {
    const store = mkdtempSync(join(tmpdir(), "watch-store-"));
    try {
      const { appendEvent } = await import("./org-store");
      appendEvent(handedOff, store);
      appendEvent(aireviewDone, store);
      const { mkdirSync } = await import("node:fs");
      mkdirSync(join(store, "feedback"), { recursive: true });
      writeFileSync(join(store, "feedback", "hook-1.json"), JSON.stringify(comment("note-77")));
      const profile: RunProfile = { name: "tpm", args: ["--org", "acme", "--store", store], env: {}, everyMinutes: 5, maxRunMinutes: 60, why: "w" };
      const org = { orgId: "acme", changeRequests: cr } as unknown as OrgRecord;
      const started: string[] = [];
      const deps = { start: (p: RunProfile) => { started.push(p.name); return fakeChild(); }, nowMs: () => 1_000 };
      const running = new Map<string, ChildProcess>();
      expect(await watchProfile(org, profile, deps, running)).toContain("started: new diff_comment on task-40");
      expect(started).toEqual(["tpm"]);
      // While it runs, nothing else starts for this profile.
      expect(await watchProfile(org, profile, deps, running)).toBe("its run is still going");
      (running.get("tpm") as unknown as EventEmitter).emit("exit", 0);
      // The same delivery is not news any more.
      expect(await watchProfile(org, profile, deps, running)).toBe("nothing new");
      expect(JSON.parse(readFileSync(join(store, "watch", "state.json"), "utf-8")).seen).toContain("gitlab:note-77");
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });

  test("A RUN THAT DIED BEFORE IT RAN SAW NOTHING: the comment it was started for is raised again, not lost", async () => {
    const store = mkdtempSync(join(tmpdir(), "watch-crash-"));
    try {
      const { appendEvent } = await import("./org-store");
      appendEvent(handedOff, store);
      appendEvent(aireviewDone, store);
      const { mkdirSync } = await import("node:fs");
      mkdirSync(join(store, "feedback"), { recursive: true });
      // An older comment a run already handled. A later crash must not resurrect it.
      writeFileSync(join(store, "feedback", "hook-0.json"), JSON.stringify(comment("note-11")));
      const profile: RunProfile = { name: "tpm", args: ["--org", "acme", "--store", store], env: {}, everyMinutes: 5, maxRunMinutes: 60, why: "w" };
      const org = { orgId: "acme", changeRequests: cr } as unknown as OrgRecord;
      const starts: number[] = [];
      // MEASURED 2026-09-11: 79ms and exit 66, having written nothing. The clock does not move, so
      // every one of these ends inside FAST_FAILURE_MS.
      const deps = { start: () => { starts.push(1); return fakeChild(); }, nowMs: () => 1_000 };
      const running = new Map<string, ChildProcess>();
      const state = (): { seen: string[]; lastSignature?: string; fastFailures?: number } =>
        JSON.parse(readFileSync(join(store, "watch", "state.json"), "utf-8"));

      expect(await watchProfile(org, profile, deps, running)).toContain("started: new diff_comment on task-40");
      (running.get("tpm") as unknown as EventEmitter).emit("exit", 0);
      expect(state().seen).toEqual(["gitlab:note-11"]);

      writeFileSync(join(store, "feedback", "hook-1.json"), JSON.stringify(comment("note-77")));
      expect(await watchProfile(org, profile, deps, running)).toContain("started: new diff_comment on task-40");
      expect(state().seen).toContain("gitlab:note-77");
      (running.get("tpm") as unknown as EventEmitter).emit("exit", 66);
      // It never reached the organization, so it is not allowed to have seen the comment - but the
      // one an earlier run DID handle stays handled.
      expect(state().seen).not.toContain("gitlab:note-77");
      expect(state().seen).toContain("gitlab:note-11");
      expect(state().lastSignature).toBeUndefined();
      expect(state().fastFailures).toBe(1);

      // The very next look starts a run again rather than waiting out the backoff.
      expect(await watchProfile(org, profile, deps, running)).toContain("started: new diff_comment on task-40");
      (running.get("tpm") as unknown as EventEmitter).emit("exit", 66);
      expect(await watchProfile(org, profile, deps, running)).toContain("started:");
      (running.get("tpm") as unknown as EventEmitter).emit("exit", 66);
      expect(await watchProfile(org, profile, deps, running)).toContain("started:");
      (running.get("tpm") as unknown as EventEmitter).emit("exit", 66);
      expect(starts.length).toBe(5);
      // A fourth death in a row is not transient: the retrying stops - but the comment is STILL
      // handed back, because losing what a person wrote is the worse failure.
      expect(state().fastFailures).toBe(4);
      expect(state().seen).not.toContain("gitlab:note-77");
      expect(await watchProfile(org, profile, deps, running)).toContain("the same 1 reason(s) as the last run");
      expect(starts.length).toBe(5);

      // A run that FAILED after really running is a different animal: the organization saw the
      // comment and decided against it, or died trying. That is not undone here - it is its own
      // failure to look at, and handing the delivery back would raise it again forever.
      let clock = 1_000 + 40 * 60_000;
      (deps as { nowMs: () => number }).nowMs = () => clock;
      expect(await watchProfile(org, profile, deps, running)).toContain("started:");
      clock += 20 * 60_000;
      (running.get("tpm") as unknown as EventEmitter).emit("exit", 1);
      expect(state().seen).toContain("gitlab:note-77");
      expect(state().fastFailures).toBe(0);
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });

  test("a run that ran keeps what it saw, and clears the fast-failure count", async () => {
    const store = mkdtempSync(join(tmpdir(), "watch-ran-"));
    try {
      const { appendEvent } = await import("./org-store");
      appendEvent(handedOff, store);
      appendEvent(aireviewDone, store);
      const { mkdirSync } = await import("node:fs");
      mkdirSync(join(store, "feedback"), { recursive: true });
      writeFileSync(join(store, "feedback", "hook-1.json"), JSON.stringify(comment("note-77")));
      const profile: RunProfile = { name: "tpm", args: ["--org", "acme", "--store", store], env: {}, everyMinutes: 5, maxRunMinutes: 60, why: "w" };
      const org = { orgId: "acme", changeRequests: cr } as unknown as OrgRecord;
      const deps = { start: () => fakeChild(), nowMs: () => 1_000 };
      const running = new Map<string, ChildProcess>();
      expect(await watchProfile(org, profile, deps, running)).toContain("started:");
      (running.get("tpm") as unknown as EventEmitter).emit("exit", 0);
      const state = JSON.parse(readFileSync(join(store, "watch", "state.json"), "utf-8"));
      expect(state.seen).toContain("gitlab:note-77");
      expect(state.lastSignature).toBeString();
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });

  test("ONE RUN AT A TIME: a store another living process holds is left alone - including a run a person started", async () => {
    const store = mkdtempSync(join(tmpdir(), "watch-lock-"));
    const other = spawn(process.execPath, ["-e", KEEP_ALIVE], { stdio: "ignore" });
    try {
      writeFileSync(join(store, "run.lock"), JSON.stringify({ pid: other.pid, startedAt: "t" }));
      expect(lockHolder(store)?.pid).toBe(other.pid);
      expect(takeStoreLock(store).ok).toBe(false);
      const profile: RunProfile = { name: "tpm", args: ["--org", "acme", "--store", store], env: {}, everyMinutes: 5, maxRunMinutes: 60, why: "w" };
      const said = await watchProfile({ orgId: "acme" } as unknown as OrgRecord, profile, { start: () => { throw new Error("must not start"); }, nowMs: () => 0 }, new Map());
      expect(said).toContain("a run holds the store");
    } finally {
      other.kill();
      rmSync(store, { recursive: true, force: true });
    }
  });

  test("a lock whose owner is gone is taken over, and a release removes only its own lock", () => {
    const store = mkdtempSync(join(tmpdir(), "watch-stale-"));
    try {
      writeFileSync(join(store, "run.lock"), JSON.stringify({ pid: 2_147_000_001, startedAt: "t" }));
      expect(isRunning(2_147_000_001)).toBe(false);
      const mine = takeStoreLock(store);
      expect(mine.ok).toBe(true);
      if (mine.ok) {
        // A successor took over (e.g. after this run was presumed dead): our release must not remove its lock.
        writeFileSync(join(store, "run.lock"), JSON.stringify({ pid: 999_999_991, startedAt: "t2" }));
        mine.release();
        expect(JSON.parse(readFileSync(join(store, "run.lock"), "utf-8")).pid).toBe(999_999_991);
      }
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });
});

describe("A RUN PROFILE HOLDS HOW A RUN STARTS - NEVER A CREDENTIAL", () => {
  const ok: RunProfile = { name: "agentic-tpm", args: ["--org", "acme", "--store", "/s/tpm"], env: { VERIFY_STEPS: "[]", JIRA_AUTH_FILE: "/k" }, everyMinutes: 5, maxRunMinutes: 720, why: "w" };
  test("a complete profile is accepted; a *_FILE path is not a secret", () => {
    expect(validateRunProfile(ok, "acme").ok).toBe(true);
  });
  test("a secret-named environment key, a missing store, another organization, or two profiles on one store are refused", () => {
    expect(validateRunProfile({ ...ok, env: { GITLAB_TOKEN: "glpat-x" } }).ok).toBe(false);
    expect(validateRunProfile({ ...ok, env: { JIRA_API_KEY: "x" } }).ok).toBe(false);
    expect(validateRunProfile({ ...ok, args: ["--org", "acme"] }).ok).toBe(false);
    expect(validateRunProfile(ok, "other-org").ok).toBe(false);
    expect(validateRunProfiles([ok, { ...ok, name: "copy" }]).ok).toBe(false);
  });
});

describe("THE WATCHER KEEPS THE REVIEW LOOP MOVING", () => {
  const withRounds = { ...cr, afterUpdate: [{ kind: "comment" as const, body: "aireview" }], reviewRounds: 3 };
  const pushed = ev({ kind: "change_handed_off", workId: "task-40", changeId: "c", branch: "defect/x", url: "https://git.example/p/-/merge_requests/164", base: "master", commit: "fix2" });

  test("a fix pushed with no re-review asked for yet is a reason; asked, it is not; past the limit it is not either", () => {
    const base = { events: [handedOff, aireviewDone, pushed], changeRequests: withRounds };
    expect(watchReasons(input(base)).reasons.some((r) => r.includes("review has not been asked for again"))).toBe(true);
    const asked = ev({ kind: "change_after_update", workId: "task-40", stepKey: "comment:aireview", commit: "fix2", replyId: "note-9" });
    expect(watchReasons(input({ ...base, events: [...base.events, asked] })).reasons).toEqual([]);
    const spent = { ...withRounds, reviewRounds: 1 };
    const oldRound = ev({ kind: "change_after_update", workId: "task-40", stepKey: "comment:aireview", commit: "fix1" });
    expect(watchReasons(input({ events: [handedOff, aireviewDone, pushed, oldRound], changeRequests: spent })).reasons).toEqual([]);
  });

  test("an item reopened by a turned-back review is NEWS - its signature differs from the launch that raised it", () => {
    const raised = ev({ kind: "action_item_raised", workId: "task-40", actionItemId: "gitlab:note-3", source: "gitlab", itemKind: "diff_comment", summary: "s" });
    const before = watchReasons(input({ events: [handedOff, aireviewDone, raised] }));
    const reopened = ev({ kind: "action_item_reopened", workId: "task-40", actionItemId: "gitlab:note-3", why: "turned back" });
    const after = watchReasons(input({ events: [handedOff, aireviewDone, raised, reopened] }));
    expect(after.reasons).toEqual(["gitlab:note-3 on task-40 was reopened"]);
    expect(after.signature).not.toBe(before.signature);
    expect(shouldLaunch(after, { seen: [], lastSignature: before.signature, lastLaunchMs: 0 }, 60_000, 5).launch).toBe(true);
  });
});

describe("A REQUEST WHOSE FOLLOW-UP KEEPS DYING IS A PERSON'S, NOT ANOTHER ATTEMPT", () => {
  // MEASURED on dev-portal, 2026-09-12: every session in that repository died the same way - its own
  // CLAUDE.md transitively imports 499KB of docs, so a session starts with ~196,000 tokens already
  // written, manages four tool calls, reports "autocompact is thrashing", and exits. Six minutes and
  // about six dollars, every thirty minutes, for nothing.
  const died = (n: number) =>
    Array.from({ length: n }, () =>
      ({ id: "e", kind: "change_projected", subjectId: "task-40", decision: "the follow-up of task-40 did not complete: the follow-up session exited 4: Autocompact is thrashing", atMs: 1, evidenceRefs: [], supervisorChain: [] }) as unknown as OrgEvent,
    );
  const ranFine = { id: "e", kind: "change_projected", subjectId: "task-40", decision: "followed up task-40: 2 of 2 item(s) decided", atMs: 1, evidenceRefs: [], supervisorChain: [] } as unknown as OrgEvent;
  const raised = ev({ kind: "action_item_raised", workId: "task-40", actionItemId: "gitlab:note-9", source: "gitlab", itemKind: "comment", summary: "s" });

  // A SECOND request, healthy, on its own branch: silencing one must silence exactly one.
  const otherHandedOff = ev({ kind: "change_handed_off", workId: "task-41", changeId: "c2", branch: "defect/y", url: "https://git.example/p/-/merge_requests/165", base: "master", commit: "def" });
  const otherComment = { deliveryId: "note-77", source: "gitlab", itemKind: "diff_comment", summary: "and this one", author: "reviewer", branch: "defect/y" };

  test("after three failures in a row it stops asking about THAT request, and says what it kept failing on", () => {
    const v = watchReasons(input({
      events: [handedOff, aireviewDone, otherHandedOff, raised, ...died(3)],
      // An UNRAISED comment on the failing request: even fresh news about it is not asked again.
      deliveries: [comment("note-fresh"), otherComment],
    }));
    expect(v.reasons.some((r) => r.includes("note-fresh"))).toBe(false);
    expect(v.reasons.some((r) => r.includes("task-40"))).toBe(false);
    expect(v.atLimit.length).toBe(1);
    expect(v.atLimit[0]).toContain("3 follow-ups in a row could not complete");
    expect(v.atLimit[0]).toContain("Autocompact is thrashing");
    // ...and the OTHER request is untouched: one request's history is its own.
    expect(v.reasons.some((r) => r.includes("task-41"))).toBe(true);
  });

  test("two failures is not a pattern - it is still the organization's to try", () => {
    const v = watchReasons(input({ events: [handedOff, aireviewDone, raised, ...died(2)], deliveries: [comment("note-9")] }));
    expect(v.reasons.length).toBeGreaterThan(0);
    expect(v.atLimit).toEqual([]);
  });

  test("a follow-up that DID run clears the history: a request that works again is not carrying one", () => {
    const v = watchReasons(input({ events: [handedOff, aireviewDone, raised, ...died(3), ranFine, ...died(1)], deliveries: [comment("note-9")] }));
    expect(v.reasons.length).toBeGreaterThan(0);
    expect(v.atLimit).toEqual([]);
  });
});
