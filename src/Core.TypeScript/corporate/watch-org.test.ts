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
    const other = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
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
