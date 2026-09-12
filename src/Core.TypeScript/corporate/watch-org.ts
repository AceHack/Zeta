/**
 * corporate/watch-org.ts — the organization, watching its own merge requests.
 *
 * MEASURED on the Agentic Team, 2026-09-11: every step after a merge request opened (reading its
 * comments, deciding, fixing, answering) ran only because a person started run-org again. A run stops
 * once its work is handed to people, and nothing read the request until the next one. So comments
 * waited on nobody, and the after-the-handoff loop was real only while someone was at the keyboard.
 *
 * ── WHAT IT DOES ─────────────────────────────────────────────────────────────
 * For each of an organization's RUN PROFILES (`run-profile.ts`), on the profile's interval, it asks
 * one question - IS THERE ANYTHING NEW THE ORGANIZATION HAS NOT SEEN? - and starts that profile's run
 * only if there is:
 *   - feedback on a handed-off request it has not raised yet (a comment, the pipeline failing, the
 *     target moving), read by the profile's own poller, or filed by a webhook into its feedback dir;
 *   - a settled item still owed an answer, or one whose answer was withheld;
 *   - an item raised and never decided;
 *   - an after-open step not yet done on a request (e.g. the `aireview` comment).
 * It decides nothing about the work. The run decides; this only notices that there is a run to have.
 *
 * ── WHAT IT WILL NOT DO ──────────────────────────────────────────────────────
 * Start a run while one holds the store (`store-lock.ts`, which also covers a run a person started).
 * Start the same run for the same reasons over and over: an unchanged set of reasons is retried only
 * every RETRY_EVERY intervals, so a follow-up that keeps failing costs one attempt an hour, not twelve.
 * Let a run go on forever: past its profile's maxRunMinutes it is stopped - by PID, with its tree,
 * never by name.
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { answersOwed, correlateFeedback, followUpFailures, type FeedbackDelivery } from "./change-followup";
import type { ChangeRequestConfig } from "./change-request";
import { afterOpenKey, DEFAULT_PIPELINE_ATTEMPTS, DEFAULT_REVIEW_ROUNDS } from "./change-request";
import { foldActionItems, foldAfterOpen, foldAfterUpdate, foldHandedOffChanges } from "./org-fold";
import type { OrgEvent } from "./org-event";
import { pollFeedback, readFeedbackDir } from "./followup-commands";
import { parseRegistry, type OrgRecord } from "./org-registry";
import { readEvents } from "./org-store";
import { profileArg, profileArgs, type RunProfile } from "./run-profile";
import { lockHolder } from "./store-lock";

/** An unchanged set of reasons is retried at most once every this many intervals. */
export const RETRY_EVERY = 6;

/** A run that exits non-zero faster than this never reached the organization. */
export const FAST_FAILURE_MS = 60_000;
/** How many of those in a row are retried at once before the backoff applies anyway. */
export const FAST_FAILURES = 3;

/**
 * Follow-ups that could not complete, in a row, before the request is a person's rather than a retry.
 *
 * MEASURED on dev-portal, 2026-09-12: three runs, then three more, each starting a session that died
 * on the repository's own startup context and left nothing decided. The reasons never changed, so
 * nothing in the backoff could tell the difference between "not yet" and "not ever".
 */
export const FOLLOW_UP_FAILURES = 3;

export interface WatchInput {
  readonly events: readonly OrgEvent[];
  /** What the profile's poller and its webhook directory report right now. */
  readonly deliveries: readonly FeedbackDelivery[];
  readonly changeRequests?: ChangeRequestConfig;
  readonly defaultBase: string;
  /** Delivery ids a run has already been started for. */
  readonly seen: ReadonlySet<string>;
  /** Runs already spent on each red pipeline, by action item id - see PipelinePolicy.UntilGreen. */
  readonly pipelineTries?: Readonly<Record<string, number>>;
}

export interface WatchVerdict {
  /** Why a run is wanted - empty means nothing new. */
  readonly reasons: readonly string[];
  /** The same reasons produce the same signature - how "nothing changed since last time" is told. */
  readonly signature: string;
  /** Deliveries this run would be started for, to mark seen once it is. */
  readonly newDeliveries: readonly string[];
  /** Red pipelines this run is being started for, to count the try once it is. */
  readonly redPipelines: readonly string[];
  /** Red pipelines the organization has tried enough times - a person is told, no run is started. */
  readonly atLimit: readonly string[];
}

/** Is there anything the organization has not seen? Pure: everything it reads is handed in. */
export function watchReasons(input: WatchInput): WatchVerdict {
  const handed = foldHandedOffChanges(input.events);
  const items = foldActionItems(input.events);
  const afterOpen = foldAfterOpen(input.events);
  const known = new Set([...items.values()].flat().map((i) => i.actionItemId));
  const ownReplies = new Set([...items.values()].flat().flatMap((i) => (i.answered?.replyId === undefined ? [] : [`${i.source}:${i.answered.replyId}`])));
  const ownPosted = new Set([...afterOpen.values(), ...foldAfterUpdate(input.events).values()].flatMap((e) => e.replyIds));
  const reasons: string[] = [];
  const keys: string[] = [];

  const corr = correlateFeedback(input.deliveries, handed, input.defaultBase);
  const fresh = (id: string, bareId: string): boolean => !known.has(id) && !ownReplies.has(id) && !ownPosted.has(bareId) && !input.seen.has(id);
  const newDeliveries: string[] = [];
  // ── A RED PIPELINE IS NOT SETTLED BY BEING EXPLAINED ──────────────────────
  // Under `until_green` a failed pipeline stays a reason for as long as it is failing, however the
  // organization decided about it - so a fix, a push, and the next pipeline all happen before the
  // request stops asking. The cap is what stops it retrying a failure it cannot turn green: at the
  // limit it is no longer a reason, and `atLimit` names it so a person is told instead.
  const untilGreen = input.changeRequests?.pipelines === "until_green";
  const attempts = input.changeRequests?.pipelineAttempts ?? DEFAULT_PIPELINE_ATTEMPTS;
  const isPipeline = (kind: string): boolean => kind === "pipeline_failed";
  const atLimit: string[] = [];
  const redPipelines: string[] = [];
  // A REQUEST WHOSE FOLLOW-UP KEEPS DYING IS NOT ASKED AGAIN. Its items stay open and are still the
  // organization's to do - what stops is spending another session to find out it cannot start.
  const hopeless = new Set<string>();
  for (const [workId] of handed) {
    const failed = followUpFailures(input.events, workId);
    if (failed.inARow < FOLLOW_UP_FAILURES) continue;
    hopeless.add(workId);
    atLimit.push(`${workId}: ${String(failed.inARow)} follow-ups in a row could not complete - ${(failed.lastReason ?? "").slice(0, 200)}`);
  }
  const decidedOn = new Map([...items.values()].flat().map((i) => [i.actionItemId, i] as const));
  for (const m of corr.aboutChange) {
    if (hopeless.has(m.workId)) continue;
    if (untilGreen && isPipeline(m.delivery.itemKind)) {
      // ── A DEFERRAL NAMES ITS OWN TRIGGER ────────────────────────────────────────────────────
      // MEASURED on agentic-tpm !164, 2026-09-12: pipeline 189289 is an EXTERNAL status with no jobs
      // to read, failing on the build agent's own MongoMemoryServer while the organization's
      // verification of that same commit passed. The organization deferred it - correctly - and this
      // asked again twice more about the same pipeline, which had not changed, before giving up and
      // calling for a person. A deferred item waits for news, and a NEW pipeline is the news: it
      // arrives with its own delivery id and is raised fresh.
      if (decidedOn.get(m.actionItemId)?.deferred !== undefined) continue;
      const tried = input.pipelineTries?.[m.actionItemId] ?? 0;
      if (tried >= attempts) {
        atLimit.push(`${m.actionItemId} on ${m.workId}`);
        continue;
      }
      redPipelines.push(m.actionItemId);
      if (fresh(m.actionItemId, m.delivery.deliveryId)) newDeliveries.push(m.actionItemId);
      reasons.push(`the request of ${m.workId} is red: ${m.delivery.summary} (try ${String(tried + 1)} of ${String(attempts)})`);
      // The try is NOT in the key: one pipeline is one reason, so the ordinary unchanged-reasons
      // backoff spaces the tries out. A pipeline takes minutes to run, and a second session on the
      // same red one five minutes later would be reading the same failure.
      keys.push(`p:${m.actionItemId}`);
      continue;
    }
    if (!fresh(m.actionItemId, m.delivery.deliveryId)) continue;
    newDeliveries.push(m.actionItemId);
    reasons.push(`new ${m.delivery.itemKind} on ${m.workId}${m.delivery.author === undefined ? "" : ` by ${m.delivery.author}`}`);
    keys.push(`d:${m.actionItemId}`);
  }
  for (const m of corr.targetMoved) {
    if (!fresh(m.actionItemId, m.delivery.deliveryId)) continue;
    newDeliveries.push(m.actionItemId);
    reasons.push(`${m.delivery.target ?? "the target"} moved under ${m.workId}`);
    keys.push(`t:${m.actionItemId}`);
  }

  for (const [workId, list] of items) {
    if (!handed.has(workId) || hopeless.has(workId)) continue;
    const replies = input.changeRequests?.replies;
    if (replies !== undefined && replies !== "none") {
      const { owed, withheld } = answersOwed(list);
      for (const o of owed) {
        reasons.push(`${o.actionItemId} on ${workId} is settled and owed an answer`);
        keys.push(`a:${o.actionItemId}`);
      }
      for (const w of withheld) {
        reasons.push(`${w.actionItemId} on ${workId} had an answer that could not be posted`);
        keys.push(`w:${w.actionItemId}`);
      }
    }
    for (const i of list) {
      if (i.settled === undefined && i.deferred === undefined) {
        reasons.push(`${i.actionItemId} on ${workId} ${i.reopened === undefined ? "was raised and never decided" : "was reopened"}`);
        // The item STATE is in the key: a reopen after a turned-back review is news, not the same reason again.
        keys.push(`u:${i.actionItemId}@${String(i.reopened?.atMs ?? i.raisedAtMs)}`);
      }
    }
  }

  // A FIX WAS PUSHED AND REVIEW HAS NOT BEEN ASKED FOR AGAIN (the post failed, or the run ended first).
  const afterUpdate = foldAfterUpdate(input.events);
  const limit = input.changeRequests?.reviewRounds ?? DEFAULT_REVIEW_ROUNDS;
  for (const [workId, change] of handed) {
    if (hopeless.has(workId)) continue;
    const steps = input.changeRequests?.afterUpdate ?? [];
    if (steps.length === 0 || change.commit === undefined || change.firstCommit === undefined || change.commit === change.firstCommit) continue;
    const rec = afterUpdate.get(workId);
    if ((rec?.rounds ?? 0) >= limit) continue;
    const pending = steps.filter((st) => !(rec?.done.has(`${afterOpenKey(st)}@${change.commit as string}`) ?? false));
    if (pending.length === 0) continue;
    reasons.push(`a fix was pushed to the request of ${workId} at ${change.commit.slice(0, 8)} and review has not been asked for again`);
    keys.push(`r:${workId}@${change.commit}`);
  }

  for (const [workId] of handed) {
    if (hopeless.has(workId)) continue;
    const done = afterOpen.get(workId)?.done ?? new Set<string>();
    for (const step of input.changeRequests?.afterOpen ?? []) {
      if (done.has(afterOpenKey(step))) continue;
      reasons.push(`'${afterOpenKey(step)}' is not yet done on ${workId}'s request`);
      keys.push(`o:${workId}:${afterOpenKey(step)}`);
    }
  }

  return { reasons, signature: [...keys].sort().join("|"), newDeliveries, redPipelines, atLimit };
}

interface WatchState {
  readonly seen: readonly string[];
  readonly lastSignature?: string;
  readonly lastLaunchMs?: number;
  /** Consecutive runs that died before they ran. Cleared by one that ran. */
  readonly fastFailures?: number;
  /** Runs spent on each red pipeline, by action item id. A pipeline is only red once. */
  readonly pipelineTries?: Readonly<Record<string, number>>;
}

function readState(store: string): WatchState {
  try {
    return JSON.parse(readFileSync(join(store, "watch", "state.json"), "utf-8")) as WatchState;
  } catch {
    return { seen: [] };
  }
}

function writeState(store: string, state: WatchState): void {
  mkdirSync(join(store, "watch"), { recursive: true });
  // Bounded: the seen list only needs to outlive the deliveries a poller can still return.
  writeFileSync(join(store, "watch", "state.json"), JSON.stringify({ ...state, seen: state.seen.slice(-5000) }, null, 1));
}

function log(store: string, line: string): void {
  mkdirSync(join(store, "watch"), { recursive: true });
  const text = `${new Date().toISOString()} ${line}\n`;
  process.stdout.write(`[watch ${store.split(/[\\/]/).pop() ?? store}] ${line}\n`);
  try {
    writeFileSync(join(store, "watch", "watch.log"), text, { flag: "a" });
  } catch {
    // a log line that cannot be written does not stop the watch
  }
}

/** Whether a run should start now for this profile, and why not when it should not. */
export function shouldLaunch(verdict: WatchVerdict, state: WatchState, nowMs: number, everyMinutes: number): { readonly launch: boolean; readonly why: string } {
  if (verdict.reasons.length === 0) return { launch: false, why: "nothing new" };
  if (state.lastSignature === verdict.signature && state.lastLaunchMs !== undefined && nowMs - state.lastLaunchMs < RETRY_EVERY * everyMinutes * 60_000) {
    return { launch: false, why: `the same ${String(verdict.reasons.length)} reason(s) as the last run - retried every ${String(RETRY_EVERY)} intervals` };
  }
  return { launch: true, why: verdict.reasons.slice(0, 5).join("; ") + (verdict.reasons.length > 5 ? `; and ${String(verdict.reasons.length - 5)} more` : "") };
}

export interface WatchDeps {
  /**
   * Starts the run; returns the child so its end (and its limit) can be watched.
   *
   * `reason` is why the watcher wanted this run, and it travels INTO the run so that every agent
   * call the run makes records what it was spent on - money with its provenance attached, rather
   * than a total nobody can account for later.
   */
  readonly start: (profile: RunProfile, logFile: string, reason: string) => ChildProcess;
  readonly nowMs: () => number;
}

/** The real start: run-org under this same runtime, its output to the store's run.log (the previous one kept). */
export function startRunOrg(runOrgPath: string): WatchDeps["start"] {
  return (profile, logFile, reason) => {
    try {
      renameSync(logFile, logFile.replace(/run\.log$/, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.log`));
    } catch {
      // no earlier log
    }
    const fd = openSync(logFile, "a");
    const child = spawn(process.execPath, [runOrgPath, ...profile.args], {
      env: { ...process.env, ...profile.env, ORG_RUN_REASON: reason },
      stdio: ["ignore", fd, fd],
      shell: false,
      windowsHide: true,
    });
    child.once("exit", () => closeSync(fd));
    return child;
  };
}

/** Stop a run and everything it started, by PID - never by name. */
function stopTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { shell: false, windowsHide: true });
  else {
    try {
      child.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
}

/** One look at one profile: poll, decide, and start its run if there is something new. */
export async function watchProfile(
  org: OrgRecord,
  profile: RunProfile,
  deps: WatchDeps,
  running: Map<string, ChildProcess>,
): Promise<string> {
  const store = resolve(profileArg(profile, "--store") as string);
  if (running.has(profile.name)) return "its run is still going";
  const holder = lockHolder(store);
  if (holder !== undefined) return `a run holds the store (pid ${String(holder.pid)})`;

  const events = readEvents(store);
  const handed = foldHandedOffChanges(events);
  const feedbackDir = profileArg(profile, "--feedback-dir") ?? join(store, "feedback");
  const filed = readFeedbackDir(feedbackDir);
  const feedbackCmd = profileArg(profile, "--feedback-cmd");
  const cwd = profileArg(profile, "--git") ?? store;
  const polled =
    feedbackCmd === undefined ? { deliveries: [] as FeedbackDelivery[] } : pollFeedback({ command: feedbackCmd, args: profileArgs(profile, "--feedback-arg") }, cwd, handed);
  const state = readState(store);
  const verdict = watchReasons({
    events,
    deliveries: [...filed.deliveries, ...polled.deliveries],
    ...(org.changeRequests === undefined ? {} : { changeRequests: org.changeRequests }),
    defaultBase: profileArg(profile, "--base") ?? "main",
    seen: new Set(state.seen),
    ...(state.pipelineTries === undefined ? {} : { pipelineTries: state.pipelineTries }),
  });
  // A pipeline the organization has tried its allowance of times and not turned green is a person's
  // to look at. Said once per look, in the log a person reads - never swallowed, never retried on.
  for (const stuck of verdict.atLimit) log(store, `STILL RED after ${String(org.changeRequests?.pipelineAttempts ?? DEFAULT_PIPELINE_ATTEMPTS)} tries, and a person is needed: ${stuck}`);
  const decision = shouldLaunch(verdict, state, deps.nowMs(), profile.everyMinutes);
  const polledNote = "refusal" in polled && polled.refusal !== undefined ? ` (the poll said: ${polled.refusal})` : "";
  if (!decision.launch) return decision.why + polledNote;

  const startedMs = deps.nowMs();
  const child = deps.start(profile, join(store, "run.log"), decision.why);
  running.set(profile.name, child);
  // The consecutive-fast-failure count is carried across the launch - dropping it here would reset
  // the cap on every retry, and the retrying would never stop.
  const tries = { ...state.pipelineTries };
  for (const id of verdict.redPipelines) tries[id] = (tries[id] ?? 0) + 1;
  writeState(store, {
    seen: [...state.seen, ...verdict.newDeliveries],
    lastSignature: verdict.signature,
    lastLaunchMs: deps.nowMs(),
    ...(state.fastFailures === undefined ? {} : { fastFailures: state.fastFailures }),
    ...(Object.keys(tries).length === 0 ? {} : { pipelineTries: tries }),
  });
  log(store, `started a run (pid ${String(child.pid)}): ${decision.why}`);
  const limit = setTimeout(() => {
    log(store, `the run passed its ${String(profile.maxRunMinutes)}-minute limit - stopping pid ${String(child.pid)} and what it started`);
    stopTree(child);
  }, profile.maxRunMinutes * 60_000);
  child.once("exit", (code) => {
    clearTimeout(limit);
    running.delete(profile.name);
    const tookMs = deps.nowMs() - startedMs;
    log(store, `the run ended (exit ${String(code)}) after ${String(Math.round(tookMs / 1000))}s`);
    // ── A RUN THAT DIED BEFORE IT RAN IS NOT AN ANSWER ────────────────────
    // MEASURED on dev-portal, 2026-09-11 22:34:33: a run exited 66 in 79ms having written nothing -
    // the entry file was briefly unreadable (this tree lives under a syncing folder). Two review
    // findings a person had just filed were recorded as SEEN at launch, which is permanent: nothing
    // would ever have raised them again, and the unchanged reasons were also under the retry
    // backoff, so the organization would have sat still for half an hour and then found nothing to
    // do. A run that died before it ran saw nothing, so it is not allowed to have seen anything:
    // what it marked is given back and the signature forgotten, and the next look tries again.
    // FAST_FAILURES in a row stops the retrying - in case it is not transient - but the deliveries
    // are handed back every time, because losing a person's comment is the worse failure.
    if (code !== 0 && tookMs < FAST_FAILURE_MS) {
      const now = readState(store);
      const fails = (now.fastFailures ?? 0) + 1;
      // Only what THIS launch claimed: `watchReasons` was handed `state.seen`, so newDeliveries
      // never contains anything an earlier run already handled.
      const claimed = new Set(verdict.newDeliveries);
      const { lastSignature: _forgotten, ...rest } = now;
      // The try it never took is given back with everything else it never saw.
      const back = { ...now.pipelineTries };
      for (const id of verdict.redPipelines) back[id] = Math.max(0, (back[id] ?? 0) - 1);
      const handedBack: WatchState = {
        ...rest,
        seen: now.seen.filter((id) => !claimed.has(id)),
        fastFailures: fails,
        ...(Object.keys(back).length === 0 ? {} : { pipelineTries: back }),
      };
      if (fails <= FAST_FAILURES) {
        writeState(store, handedBack);
        log(store, `it died in under ${String(FAST_FAILURE_MS / 1000)}s (${String(fails)} in a row) - it saw nothing, so the next look tries again`);
      } else {
        // Still hand the deliveries back; only the retrying stops.
        writeState(store, { ...handedBack, ...(now.lastSignature === undefined ? {} : { lastSignature: now.lastSignature }) });
        log(store, `${String(fails)} runs in a row died before they ran - waiting out the backoff; look at ${join(store, "run.log")}`);
      }
      return;
    }
    const after = readState(store);
    if ((after.fastFailures ?? 0) > 0) writeState(store, { ...after, fastFailures: 0 });
  });
  return `started: ${decision.why}${polledNote}`;
}

function registryOrg(orgId: string): OrgRecord | { readonly reason: string } {
  const home = process.env["ORG_HOME"] ?? process.env["HOME"] ?? process.env["USERPROFILE"] ?? ".";
  const path = process.env["ORG_REGISTRY"] ?? join(home, ".agent-org", "registry.json");
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    return { reason: `no registry at ${path}` };
  }
  const parsed = parseRegistry(raw);
  if (!parsed.ok) return { reason: parsed.reason };
  return parsed.registry.orgs.find((o) => o.orgId === orgId) ?? { reason: `no organization '${orgId}' in ${path}` };
}

/** `bun watch-org.ts --org <id> [--profile <name>] [--once]` */
async function main(argv: readonly string[]): Promise<number> {
  const orgId = argv[argv.indexOf("--org") + 1];
  if (!argv.includes("--org") || orgId === undefined) {
    console.error("usage: watch-org.ts --org <id> [--profile <name>] [--once]");
    return 3;
  }
  const only = argv.includes("--profile") ? argv[argv.indexOf("--profile") + 1] : undefined;
  const once = argv.includes("--once");
  const deps: WatchDeps = { start: startRunOrg(resolve(import.meta.dir, "run-org.ts")), nowMs: () => Date.now() };
  const running = new Map<string, ChildProcess>();
  const due = new Map<string, number>();
  for (;;) {
    // THE REGISTRY IS READ EVERY TICK: a profile changed, added or removed applies without a restart.
    const org = registryOrg(orgId);
    if ("reason" in org) {
      console.error(`watch: ${org.reason}`);
      if (once) return 2;
    } else {
      const profiles = (org.runProfiles ?? []).filter((p) => only === undefined || p.name === only);
      if (profiles.length === 0) {
        console.error(`watch: '${orgId}' has no run profiles${only === undefined ? "" : ` named '${only}'`} - 'org run-profile set' states one`);
        return 2;
      }
      for (const p of profiles) {
        if ((due.get(p.name) ?? 0) > Date.now()) continue;
        due.set(p.name, Date.now() + p.everyMinutes * 60_000);
        const said = await watchProfile(org, p, deps, running);
        console.log(`[watch ${p.name}] ${said}`);
      }
      if (once) {
        // --once: wait for what was started, then stop.
        while (running.size > 0) await new Promise((r) => setTimeout(r, 5_000));
        return 0;
      }
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
