/**
 * society-population.ts — who is IN the society, decided deliberately.
 *
 * Split out of `society-evolution-runner.ts` on 2026-08-20 because the runner's
 * inline loader had collapsed the population to ONE, and that one was the runner
 * itself. The audit is
 * `docs/research/2026-08-20-the-society-has-a-population-of-one-and-that-one-is-the-loop-itself-*.md`.
 *
 * ## What actually went wrong — and it was not chronological aging
 *
 * The old loader was `readdirSync(eventDir).sort().slice(-200)`, treating each
 * distinct `by` as an agent. Two independent defects compounded:
 *
 *   1. **Self-consumption.** Every event the loop writes carries `by: "society"`,
 *      so the loop's own output was its own input. That is an ambient feedback
 *      channel into a metered fold — manifesto §13 noninterference, stated for a
 *      population.
 *
 *   2. **`sort()` is LEXICOGRAPHIC ON FILENAME, and the filenames are not
 *      chronological across schemes.** `docs/observe-events/` holds 32-hex ZetaId
 *      names (`080d…`) written by the real agents and `society-<base36>` names
 *      written by this loop. `"0" < "s"`, so EVERY society file sorts after EVERY
 *      agent file, forever, regardless of time. The moment the loop had written
 *      200 events of its own it occupied the entire tail of the name-sorted list
 *      permanently.
 *
 * Measured on the live corpus (3,515 event files) while writing this module:
 *
 * ```
 * name-sorted last 200 : { society: 200 }                       ← what the loop saw
 * time-sorted last 200 : { soraya: 64, alexa: 63, otto: 58, society: 15 }
 * whole corpus by `by` : alexa 1085, otto 1049, soraya 967, society 403, 3 junk
 * ```
 *
 * The real agents never left. `alexa`, `otto` and `soraya` were writing events
 * minutes before this module was written. They were lexicographically outranked,
 * not aged out — so a fix that only widened the window would have restored the
 * population for exactly as long as it took the loop to write another 200 events.
 *
 * ## The three deliberate decisions this module makes
 *
 * **1. Source = the observe-event log, minus the loop's own lane.** It is the only
 * source with live, high-volume, independently-produced evidence. The heartbeat
 * lane was the alternative; it was rejected because it is a *liveness* signal with
 * no per-event content to score, it lives on `heartbeat/*` refs rather than in the
 * working tree (so a `git clone` at a tag could not fold it — see
 * `.claude/rules/clone-at-tag-stays-sufficient.md`), and `heartbeat-liveness.yml`
 * already watches it. Its failure mode would also be worse: a heartbeat is written
 * by CI on the agent's behalf, so an agent that had stopped thinking would still
 * look present.
 *
 * **2. The window anchor is the DATA's own latest timestamp, never `Date.now()`.**
 * `.claude/rules/local-time-never-enters-the-shared-fold.md` forbids a local
 * wall-clock filtering the evidence entering a shared fold: two nodes with
 * different clocks would fold different sets and diverge. So `horizonEnd` is
 * `max(at)` over the *eligible* records, and the window is
 * `[horizonEnd − horizonMs, horizonEnd]`. Same evidence set ⇒ same population, on
 * any machine, at any wall-clock time, replayed at any point in the future. That
 * is what makes this DST-replayable rather than merely deterministic-today.
 *
 * **3. Membership is PER-AGENT, so no writer can starve another out.** Presence is
 * "this agent has ≥1 eligible event inside the horizon" — a predicate on that
 * agent alone. A flat global file count is a shared resource that a chatty writer
 * consumes; that is precisely the mechanism that killed the population, and it is
 * the property this module refuses to reintroduce. Volume still matters, but only
 * as a *score*, never as *presence*.
 *
 * ## Aging behaviour, stated on purpose
 *
 * - An agent silent for longer than `horizonMs` (default 7 days) leaves the
 *   population. Seven days rather than one so a weekend, a CI outage, or a runner
 *   backlog cannot evict a live agent; shorter than a month so a genuinely dead
 *   agent does not haunt the fold for a quarter.
 * - **Known failure mode, named rather than hidden:** because the anchor is the
 *   data's own maximum, the population cannot drain to zero by the passage of
 *   time. If EVERY agent stops writing, `horizonEnd` freezes at their last event
 *   and the last 7 days of history stay the population forever — a fossil that
 *   still reads as alive. That is the deliberate trade for clock-independence, and
 *   it is exactly why `audit-society-population-health.ts` also checks freshness
 *   against the corpus rather than trusting this scan alone.
 * - As event volume grows this scan is O(files); it reads every `.json` in the
 *   directory. At 3.5k files that is milliseconds. The old `slice(-200)` was the
 *   optimisation that caused the bug, so it is not coming back; if the corpus ever
 *   makes a full scan expensive, the answer is to shard or prune the DIRECTORY,
 *   never to re-introduce a global count window.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createAgent, type SocietyAgent } from "./society-evolution";
import { founderGenome } from "./agent-genome";
import type { CalibrationPosterior } from "./calibration-ledger";

/**
 * The `by` value the evolution runner stamps on its own events.
 *
 * Exported so the runner EMITS this constant and this module EXCLUDES this
 * constant. One symbol, two call sites — the emitter and the filter cannot drift
 * apart, which is what re-opened the self-consumption hole the first time.
 */
export const SOCIETY_RUNNER_BY = "society";

/** Seven days. See "Aging behaviour" in the module header for why seven. */
export const DEFAULT_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The policy id the runner stamps on every event it writes under THIS loader.
 *
 * `hygiene/audit-society-population-health.ts` judges published events by this
 * marker rather than by a date. A date cutover would be hostage to merge timing —
 * the loop writes every 30 minutes, so every tick between "the audit was written"
 * and "the fix reached `main`" would land inside the judged window and turn the
 * gate red for a defect that was already fixed. A structural marker judges exactly
 * the events a fixed runner produced, and nothing else.
 *
 * Bump the `@N` when a change here invalidates events written under the previous
 * policy. Never bump it to escape a red audit — that is the one use this constant
 * must not have.
 */
export const POPULATION_POLICY_ID = "per-agent-window/corpus-anchored@1";

/**
 * The shape an agent id must have to enter the population.
 *
 * Not decoration. On 2026-08-17 a test leaked its temp directory into the `by`
 * field and six events landed carrying `by: "/tmp/attest-4EC3oi"` and two
 * siblings. Those are inside the default horizon as of this writing, so without
 * this guard the fix below would have reported a population of SIX — three real
 * agents and three temp directories — and the falsifier would have read green on
 * a corpus that was two-thirds nonsense.
 */
export const AGENT_ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** One agent's activity inside the window. */
export interface AgentActivity {
  readonly id: string;
  /** Eligible events inside the window. Presence needs ≥1; the count is the score. */
  readonly events: number;
  readonly firstAt: string;
  readonly lastAt: string;
}

/** The result of one population scan — everything the callers and the audit need. */
export interface PopulationScan {
  /** Sorted by id (ordinal) so the scan is order-stable across filesystems. */
  readonly agents: readonly AgentActivity[];
  /** `max(at)` over eligible records — the window anchor. Empty corpus ⇒ "". */
  readonly horizonEnd: string;
  /** `horizonEnd − horizonMs`, ISO. Empty corpus ⇒ "". */
  readonly horizonStart: string;
  /** `.json` files opened. */
  readonly scanned: number;
  /** Records with a usable `by` + `at` that survived every filter. */
  readonly eligible: number;
  /** Excluded-lane record counts, keyed by `by`. The loop's own output lands here. */
  readonly excludedByLane: Readonly<Record<string, number>>;
  /** Distinct `by` values refused by {@link AGENT_ID_SHAPE}, sorted, deduped. */
  readonly rejectedIds: readonly string[];
  /** Distinct eligible ids whose latest event predates the window. */
  readonly agedOut: readonly string[];
}

export interface PopulationWindow {
  readonly horizonMs?: number;
  /** `by` lanes that are never population. Defaults to the runner's own lane. */
  readonly excludeBy?: readonly string[];
}

interface RawRecord {
  readonly by: string;
  readonly at: string;
}

function readRecords(eventDir: string): { records: RawRecord[]; scanned: number } {
  const records: RawRecord[] = [];
  let scanned = 0;
  let files: string[];
  try {
    files = readdirSync(eventDir).filter((f) => f.endsWith(".json"));
  } catch {
    return { records, scanned };
  }
  for (const f of files) {
    scanned++;
    try {
      const raw: unknown = JSON.parse(readFileSync(join(eventDir, f), "utf-8"));
      if (raw === null || typeof raw !== "object") continue;
      const rec = raw as Record<string, unknown>;
      if (typeof rec["by"] !== "string" || typeof rec["at"] !== "string") continue;
      if (rec["by"].length === 0 || rec["at"].length === 0) continue;
      records.push({ by: rec["by"], at: rec["at"] });
    } catch {
      /* malformed file: skipped, and counted in `scanned` so a corpus that is all
         garbage cannot look like a corpus that is small. */
    }
  }
  return { records, scanned };
}

/**
 * Scan the event directory and decide the population.
 *
 * Pure with respect to the wall clock: the only time values consulted are the
 * `at` fields in the corpus itself.
 */
export function scanPopulation(eventDir: string, window: PopulationWindow = {}): PopulationScan {
  const horizonMs = window.horizonMs ?? DEFAULT_HORIZON_MS;
  const excludeBy = new Set(window.excludeBy ?? [SOCIETY_RUNNER_BY]);

  const { records, scanned } = readRecords(eventDir);

  const excludedByLane: Record<string, number> = {};
  const rejected = new Set<string>();
  const eligibleRecords: RawRecord[] = [];

  for (const r of records) {
    if (excludeBy.has(r.by)) {
      excludedByLane[r.by] = (excludedByLane[r.by] ?? 0) + 1;
      continue;
    }
    if (!AGENT_ID_SHAPE.test(r.by)) {
      rejected.add(r.by);
      continue;
    }
    eligibleRecords.push(r);
  }

  if (eligibleRecords.length === 0) {
    return {
      agents: [],
      horizonEnd: "",
      horizonStart: "",
      scanned,
      eligible: 0,
      excludedByLane,
      rejectedIds: [...rejected].sort(),
      agedOut: [],
    };
  }

  // The anchor is the corpus's own latest timestamp — NOT Date.now().
  // `.claude/rules/local-time-never-enters-the-shared-fold.md`.
  let horizonEnd = eligibleRecords[0]!.at;
  for (const r of eligibleRecords) if (r.at > horizonEnd) horizonEnd = r.at;

  const endMs = Date.parse(horizonEnd);
  const startMs = Number.isFinite(endMs) ? endMs - horizonMs : Number.NEGATIVE_INFINITY;
  const horizonStart = Number.isFinite(startMs) ? new Date(startMs).toISOString() : "";

  const inWindow = new Map<string, { events: number; firstAt: string; lastAt: string }>();
  const seenIds = new Set<string>();
  for (const r of eligibleRecords) {
    seenIds.add(r.by);
    const t = Date.parse(r.at);
    if (!Number.isFinite(t) || t < startMs) continue;
    const cur = inWindow.get(r.by);
    if (cur === undefined) {
      inWindow.set(r.by, { events: 1, firstAt: r.at, lastAt: r.at });
    } else {
      cur.events++;
      if (r.at < cur.firstAt) cur.firstAt = r.at;
      if (r.at > cur.lastAt) cur.lastAt = r.at;
    }
  }

  const agents: AgentActivity[] = [...inWindow.entries()]
    .map(([id, s]) => ({ id, events: s.events, firstAt: s.firstAt, lastAt: s.lastAt }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const agedOut = [...seenIds].filter((id) => !inWindow.has(id)).sort();

  return {
    agents,
    horizonEnd,
    horizonStart,
    scanned,
    eligible: eligibleRecords.length,
    excludedByLane,
    rejectedIds: [...rejected].sort(),
    agedOut,
  };
}

/**
 * The fitness proxy, normalised by the WINDOW's own busiest agent.
 *
 * The old proxy was `log(events + 1) / log(200)` — the 200 being the old
 * `slice(-200)` window size, a magic constant fused to the very mechanism that
 * broke. With a per-agent window every real agent has hundreds of events, so that
 * expression exceeds 1 for everyone and `mu = min(0.95, fitness)` pins every agent
 * to 0.95: identical fitness, identical genome, `geneticDiversity === 0`, and a
 * `meanFitness` frozen at 0.6505648066545648 for four days.
 *
 * Normalising by the window's own maximum is scale-free (manifesto §1): it reads
 * the same at three events per agent and at three million, and it cannot saturate
 * because the busiest agent DEFINES 1.0. It is a relative volume proxy and nothing
 * more — `unmetered` in the sense of
 * `.claude/rules/toy-is-free-metered-must-be-earned.md`. Real calibration lives in
 * `calibration-ledger.ts`; wiring it in is a separate job, and this comment is
 * here so nobody mistakes an activity count for a calibration score.
 */
export function activityFitness(events: number, maxEvents: number): number {
  const denom = Math.log(Math.max(maxEvents, 1) + 1);
  if (!(denom > 0)) return 0;
  return Math.min(1, Math.log(Math.max(events, 0) + 1) / denom);
}

/**
 * The bootstrap population, used only when the scan finds nobody at all.
 *
 * Named rather than inline because it is a real fork in behaviour: a green tick on
 * a bootstrap population is NOT evidence that any agent is alive. The scan result
 * carries `agents: []` in that case, and the audit reads the scan, not this list.
 */
export const BOOTSTRAP_AGENT_IDS: readonly string[] = ["alexa", "otto", "soraya"];

export function bootstrapAgents(): SocietyAgent[] {
  return BOOTSTRAP_AGENT_IDS.map((id) =>
    createAgent(id, founderGenome(128, 64, 32), {
      zid: id,
      hatId: "default",
      mu: 0.5,
      sigma: 0.2,
      settledCount: 0,
    }),
  );
}

/** Turn a scan into scored society agents. Empty scan ⇒ {@link bootstrapAgents}. */
export function agentsFromScan(scan: PopulationScan): SocietyAgent[] {
  if (scan.agents.length === 0) return bootstrapAgents();
  const maxEvents = scan.agents.reduce((m, a) => Math.max(m, a.events), 0);
  return scan.agents.map((a) => {
    const fitness = activityFitness(a.events, maxEvents);
    const calibration: CalibrationPosterior = {
      zid: a.id,
      hatId: "default",
      mu: Math.min(0.95, fitness),
      sigma: 0.1 + (1 - fitness) * 0.2,
      settledCount: a.events,
    };
    const genome = founderGenome(
      Math.floor(fitness * 255),
      Math.floor((1 - fitness) * 128),
      64,
    );
    return createAgent(a.id, genome, calibration);
  });
}

/**
 * The accumulating lineage counter, folded from the loop's OWN events.
 *
 * The runner used to call `createSociety(agents, 0)` on every tick, so `generation`
 * read `1` in all 400 events ever written — a field shaped like a lineage counter
 * that counted nothing. It is a counter now, and the fold is the fix:
 *
 * > **The loop's own events are its LINEAGE. They are never its POPULATION.**
 *
 * That single sentence is what both halves of this module implement. The `society`
 * lane is excluded from {@link scanPopulation} and read here, so the loop learns
 * its own history without becoming its own member.
 *
 * Deriving from the G-set rather than a new state file keeps this idempotent and
 * DST-replayable — re-running over the same corpus yields the same number, and no
 * second source of truth can drift from the events. Named failure mode: **if the
 * event directory is pruned, the counter restarts from the oldest surviving
 * event.** That is the standard cost of a fold over a prunable log; the alternative
 * (a `bnn-state.json`-style sidecar) trades it for a file that can disagree with
 * the events, which is worse.
 */
export function latestGeneration(
  eventDir: string,
  lane: string = SOCIETY_RUNNER_BY,
): number {
  let files: string[];
  try {
    files = readdirSync(eventDir).filter((f) => f.endsWith(".json"));
  } catch {
    return 0;
  }
  let best = 0;
  for (const f of files) {
    try {
      const raw: unknown = JSON.parse(readFileSync(join(eventDir, f), "utf-8"));
      if (raw === null || typeof raw !== "object") continue;
      const rec = raw as Record<string, unknown>;
      if (rec["by"] !== lane) continue;
      if (rec["kind"] !== "evolution") continue;
      const g = rec["generation"];
      if (typeof g === "number" && Number.isFinite(g) && g > best) best = Math.floor(g);
    } catch {
      /* malformed: skipped */
    }
  }
  return best;
}

/**
 * The whole loader, in the order the runner needs it.
 * Kept here so the runner, the tests and the audit all fold the same way.
 */
export function loadPopulation(
  eventDir: string,
  window: PopulationWindow = {},
): { scan: PopulationScan; agents: SocietyAgent[]; generation: number } {
  const scan = scanPopulation(eventDir, window);
  return { scan, agents: agentsFromScan(scan), generation: latestGeneration(eventDir) };
}
