// hsm-audit-log-drain-model.ts — the pure, runnable half of the YubiHSM 2 audit-log drainer.
//
// DESIGN DOC: docs/research/2026-08-20-the-audit-log-drainer-designed-what-a-hash-chain-proves-and-what-only-an-off-host-anchor-can.md
//
// ── WHAT IS RUNNING AND WHAT IS ONLY DESIGNED ────────────────────────────────────────────
//
//   RUNNING (this file, under test):  the drain-interval arithmetic, index-gap detection,
//     cross-window overlap consistency, tick monotonicity, and the unlogged-event counters.
//     All pure. No device, no credential, no clock, no network.
//
//   DESIGNED, NOT RUNNING:  everything that touches hardware. There is no device I/O here
//     and none is planned in this file. Exporting entries needs an authenticated session,
//     i.e. a credential, and the drainer runs on a host whose compromise is assumed.
//
// ── THE CLAIM, AND ITS LIMIT, STATED AT THE CLAIM ────────────────────────────────────────
//
//   Yubico: "Entries in the Log Store are organized to form a chain of hashes. This enables
//   auditors to verify that a given set of entries has not been tampered with after
//   extraction, and that all entries are present." (User Guide section 1.2.11.)
//
//   Read precisely, "all entries are present" is scoped to the extracted SET. The chain
//   proves a DRAINED WINDOW was not altered after extraction. It does NOT prove that nothing
//   was evicted BEFORE you drained - and the ring is 62 deep and wraps silently by default,
//   so eviction is the normal case, not the exceptional one. A verifier that reports
//   "chain valid" over a window that lost 300 entries has told the truth and misled the
//   reader. So this module reports the two facts separately and never merges them.
//
// ── THE HASH FUNCTION IS NOT GUESSED ─────────────────────────────────────────────────────
//
//   The link function H that produces each 16-byte entry hash is specified in Yubico
//   protocol documentation this module has NOT read. Rather than invent one and ship a
//   verifier that "passes", every check below is chosen to need NO knowledge of H:
//
//     * index continuity across drains       - integer arithmetic on the item counter
//     * overlap consistency across drains    - byte equality of the SAME item seen twice
//     * tick monotonicity within a boot epoch- integer comparison
//     * unlogged boot and auth counters      - the device own report
//
//   Overlap consistency is the load-bearing one: it detects rewriting without knowing how
//   the chain is computed, because a rewritten entry must differ somewhere from the copy you
//   already banked. It costs one thing - the drainer must OVERLAP its windows deliberately
//   rather than drain-and-forget.

export interface LogEntry {
  /** The device monotonic item counter. Wrap period is UNKNOWN - see indexGaps. */
  readonly item: number;
  readonly cmd: number;
  readonly length: number;
  readonly sessionKey: number;
  readonly targetKey: number;
  readonly secondKey: number;
  readonly result: number;
  /** Device tick. NOT wall clock. See the design doc on why that is deliberate. */
  readonly tick: number;
  /** 16-byte chain hash, lowercase hex. Compared for equality; never recomputed here. */
  readonly hash: string;
}

/**
 * One drain. The device reports the entries plus two counters that exist precisely because
 * some events are NOT in the chain: "the number of unlogged authentication and power-up
 * events is stored in a counter that is retrieved as part of the log retrieval" (section
 * 1.2.11). A non-zero counter is evidence of activity no chain will ever cover.
 */
export interface DrainWindow {
  readonly entries: readonly LogEntry[];
  readonly unloggedBoots: number;
  readonly unloggedAuths: number;
  /**
   * HOST WALL CLOCK, EXPLICITLY UNTRUSTED.
   *
   * Declared, never used. `.claude/rules/local-time-never-enters-the-shared-fold.md`: local
   * time may steer local behaviour and must never filter, weight, reorder or dedupe the
   * evidence entering the shared record. The host is the party assumed compromised, so
   * letting it supply the timeline of its own audit is exactly the leak that rule forbids.
   * Nothing in this module reads this field for any ordering or judgement - it is carried so
   * that a reader can see it was recorded, and see that it decided nothing.
   */
  readonly hostObservedAtUntrusted?: string;
}

/** The device Log Store depth. "it can only store up to 62 different entries" (1.2.11). */
export const LOG_STORE_ENTRIES = 62;

export interface DrainBudgetInput {
  /** Logged entries produced per unit of application work (e.g. per x402 payment). */
  readonly loggedEntriesPerOperation: number;
  /** Application operations per second. */
  readonly operationsPerSecond: number;
  /**
   * Entries the DRAIN ITSELF costs. The drainer consumes the resource it protects: a drain
   * needs a session, and session establishment is logged like any other operation (1.2.11).
   * A drainer holding a persistent session pays less; a drainer that opens one per drain pays
   * open + authenticate + the retrieval command.
   */
  readonly entriesPerDrain: number;
  /**
   * How many consecutive drains may FAIL without losing an entry. 1 means no slack, which is
   * a design that loses evidence the first time the USB stack hiccups.
   */
  readonly toleratedConsecutiveFailures: number;
  /** Physical floor on how fast drains can be issued, in seconds. */
  readonly minDrainIntervalSeconds: number;
  readonly ringSize?: number;
}

export interface DrainBudget {
  readonly feasible: boolean;
  readonly intervalSeconds: number;
  /** Entries the ring must absorb between successful drains. */
  readonly budgetPerCycle: number;
  readonly reason: string;
}

/**
 * The arithmetic, shown rather than asserted.
 *
 * Let R be the ring size (62), f the number of consecutive drain failures to survive, c the
 * entries a drain itself costs, r the logged-entry rate from application work, and T the
 * drain interval. Between the last SUCCESSFUL drain and the next one, the device may see
 * (f + 1) intervals of work plus (f + 1) drain attempts - a failed drain that got as far as
 * opening a session still consumed its entries. So the requirement is
 *
 *     (f + 1) * (r * T + c)  <=  R
 *
 * which rearranges to
 *
 *     T  <=  R / (f + 1) / r  -  c / r        [ = budgetPerCycle / r, with budget = R/(f+1) - c ]
 *
 * Two things fall straight out of this, and both are design conclusions rather than tuning:
 *
 *   1. If R / (f + 1) is not strictly greater than c, NO interval works. The drain overhead
 *      alone fills the ring. This is the sense in which the drainer consumes what it
 *      protects, and it is why holding a persistent session (small c) is not an optimisation
 *      but a feasibility condition at any interesting rate.
 *
 *   2. The bound is on T, and T has a physical floor. So there is a maximum sustainable
 *      logged-entry rate, above which the 62-entry ring cannot be drained losslessly by ANY
 *      schedule. Past that point the honest options are: log fewer commands (per-command
 *      audit), or accept lossy evidence and say so, or stop calling the log an audit trail.
 */
export function drainBudget(input: DrainBudgetInput): DrainBudget {
  const R = input.ringSize ?? LOG_STORE_ENTRIES;
  const f = input.toleratedConsecutiveFailures;
  const c = input.entriesPerDrain;
  const r = input.loggedEntriesPerOperation * input.operationsPerSecond;

  const perCycle = R / (f + 1);
  const budgetPerCycle = perCycle - c;
  if (!(budgetPerCycle >= 1)) {
    return {
      feasible: false,
      intervalSeconds: 0,
      budgetPerCycle,
      reason:
        "infeasible: a ring of " +
        String(R) +
        " tolerating " +
        String(f) +
        " consecutive failure(s) leaves " +
        String(perCycle) +
        " entries per cycle, and the drain itself costs " +
        String(c) +
        ". The drainer would fill the ring it exists to empty. Reduce entriesPerDrain (hold a persistent session) or reduce toleratedConsecutiveFailures.",
    };
  }
  if (r === 0) {
    return {
      feasible: true,
      intervalSeconds: Number.POSITIVE_INFINITY,
      budgetPerCycle,
      reason: "no logged application work: the ring only fills from boots and session establishment",
    };
  }
  const interval = budgetPerCycle / r;
  if (!(interval >= input.minDrainIntervalSeconds)) {
    return {
      feasible: false,
      intervalSeconds: interval,
      budgetPerCycle,
      reason:
        "infeasible: the required interval " +
        interval.toFixed(3) +
        "s is below the physical floor " +
        String(input.minDrainIntervalSeconds) +
        "s. At " +
        String(r) +
        " logged entries/s a 62-entry ring cannot be drained losslessly by ANY schedule. Enable per-command audit for fewer commands, or stop calling this an audit trail.",
    };
  }
  return {
    feasible: true,
    intervalSeconds: interval,
    budgetPerCycle,
    reason:
      "drain every " +
      interval.toFixed(3) +
      "s: " +
      String(r) +
      " logged entries/s, budget " +
      budgetPerCycle.toFixed(1) +
      " entries per cycle after the " +
      String(c) +
      "-entry drain overhead, surviving " +
      String(f) +
      " consecutive failed drain(s)",
  };
}

export interface DrainFinding {
  readonly kind:
    | "eviction-gap"
    | "overlap-mismatch"
    | "no-overlap"
    | "tick-regression"
    | "unlogged-events"
    | "empty-window";
  readonly detail: string;
  /** checked = derivable from the entries alone. limited = true but bounded, see detail. */
  readonly register: "checked" | "limited";
}

/**
 * EVICTION DETECTION - the check the hash chain cannot perform.
 *
 * Consecutive drains must be contiguous or overlapping on the item counter. A jump means
 * entries existed and were overwritten before anyone banked them.
 *
 * THE LIMIT, stated where the finding is produced rather than in a footnote: the item counter
 * has a wrap period this repo has NOT established. Yubico SET LOG INDEX documents "Possible
 * Values: 1-60", which is smaller than the 62-entry store and strongly suggests a small,
 * wrapping counter. If the counter wraps, an eviction of exactly one full period is
 * INVISIBLE to this check. So a clean result means "no gap smaller than the wrap period",
 * never "nothing was evicted".
 *
 * Falsifier, and it belongs on a THROWAWAY device: drive the log past one full index period
 * and observe whether `item` restarts.
 */
export function detectEvictionGaps(windows: readonly DrainWindow[]): readonly DrainFinding[] {
  const out: DrainFinding[] = [];
  let previousLast: LogEntry | undefined;
  for (const [i, w] of windows.entries()) {
    const first = w.entries[0];
    const last = w.entries[w.entries.length - 1];
    if (first === undefined || last === undefined) {
      out.push({ kind: "empty-window", detail: "window " + String(i) + " is empty", register: "checked" });
      continue;
    }
    if (previousLast !== undefined && first.item >= previousLast.item + 2) {
      out.push({
        kind: "eviction-gap",
        detail:
          "window " +
          String(i) +
          " starts at item " +
          String(first.item) +
          " but the previous window ended at " +
          String(previousLast.item) +
          ": " +
          String(first.item - previousLast.item - 1) +
          " entry(ies) were overwritten before they were banked. The hash chain over each window is unaffected and will verify - which is exactly why chain validity must not be reported as completeness.",
        register: "limited",
      });
    }
    previousLast = last;
  }
  return out;
}

function sameEntry(a: LogEntry, b: LogEntry): boolean {
  return (
    a.cmd === b.cmd &&
    a.length === b.length &&
    a.sessionKey === b.sessionKey &&
    a.targetKey === b.targetKey &&
    a.secondKey === b.secondKey &&
    a.result === b.result &&
    a.tick === b.tick &&
    a.hash === b.hash
  );
}

/**
 * TAMPER DETECTION WITHOUT KNOWING THE HASH FUNCTION.
 *
 * If two drains overlap on item k, the two copies of item k must be byte-identical. A device
 * or a host that rewrote history between the drains must differ somewhere - and this check
 * needs no knowledge of how the chain is computed, which is why it is the one this module
 * can honestly ship today.
 *
 * It has a precondition the drainer must MEET rather than hope for: the windows have to
 * overlap. A drain-and-forget schedule produces no overlap and therefore no evidence, so a
 * missing overlap is reported as a finding in its own right rather than passing silently.
 */
export function verifyOverlapConsistency(windows: readonly DrainWindow[]): readonly DrainFinding[] {
  const out: DrainFinding[] = [];
  for (let i = 1; i !== windows.length; i += 1) {
    const prev = windows[i - 1];
    const cur = windows[i];
    if (prev === undefined || cur === undefined) continue;
    const byItem = new Map(prev.entries.map((e) => [e.item, e]));
    let overlaps = 0;
    for (const e of cur.entries) {
      const before = byItem.get(e.item);
      if (before === undefined) continue;
      overlaps += 1;
      if (sameEntry(before, e)) continue;
      out.push({
        kind: "overlap-mismatch",
        detail:
          "item " +
          String(e.item) +
          " differs between drain " +
          String(i - 1) +
          " and drain " +
          String(i) +
          ": banked hash " +
          before.hash +
          ", re-read hash " +
          e.hash +
          ". The same entry cannot legitimately change. Treat as a tamper alarm, not a retry.",
        register: "checked",
      });
    }
    if (overlaps === 0) {
      out.push({
        kind: "no-overlap",
        detail:
          "drains " +
          String(i - 1) +
          " and " +
          String(i) +
          " share no items, so nothing cross-checks them. Overlap is the only tamper evidence available without the chain link function; a schedule that produces none has opted out of the check.",
        register: "checked",
      });
    }
  }
  return out;
}

/**
 * Boot markers. In Yubico own example output a power-on entry appears as cmd 0x00 with
 * sessionKey 0xffff and tick 0 - the tick counter restarts at boot, so a tick DECREASE is
 * legitimate there and nowhere else.
 */
export function isBootMarker(e: LogEntry): boolean {
  return e.cmd === 0x00 && e.tick === 0;
}

/**
 * Tick monotonicity WITHIN a boot epoch.
 *
 * The tick is the device own logical order - its proper time. It is the only ordering this
 * design trusts, because it is the only one the compromised host does not produce. A
 * regression that is not explained by a boot marker means the sequence was reordered or
 * forged.
 */
export function verifyTickMonotonic(entries: readonly LogEntry[]): readonly DrainFinding[] {
  const out: DrainFinding[] = [];
  let previous: LogEntry | undefined;
  for (const e of entries) {
    if (isBootMarker(e)) {
      previous = e;
      continue;
    }
    if (previous !== undefined && !isBootMarker(previous) && e.tick <= previous.tick - 1) {
      out.push({
        kind: "tick-regression",
        detail:
          "item " +
          String(e.item) +
          " has tick " +
          String(e.tick) +
          " after item " +
          String(previous.item) +
          " at tick " +
          String(previous.tick) +
          ", with no boot marker between them",
        register: "checked",
      });
    }
    previous = e;
  }
  return out;
}

/**
 * The counters that exist because some events are never in the chain.
 *
 * Session establishment is always permitted even under force-audit, so that logs can always
 * be retrieved - and the events that slip through are counted rather than logged. A non-zero
 * counter is authenticated activity no chain will ever cover, and it must be surfaced, not
 * summed away.
 */
export function checkUnloggedCounters(windows: readonly DrainWindow[]): readonly DrainFinding[] {
  const out: DrainFinding[] = [];
  for (const [i, w] of windows.entries()) {
    if (w.unloggedBoots === 0 && w.unloggedAuths === 0) continue;
    out.push({
      kind: "unlogged-events",
      detail:
        "drain " +
        String(i) +
        " reports " +
        String(w.unloggedBoots) +
        " unlogged boot(s) and " +
        String(w.unloggedAuths) +
        " unlogged authentication(s). These are real events with NO chain entry: the trail is incomplete by an amount the chain cannot express.",
      register: "checked",
    });
  }
  return out;
}

/** Everything the pure half can say about a sequence of drains. */
export function auditDrainSequence(windows: readonly DrainWindow[]): readonly DrainFinding[] {
  const flat = windows.flatMap((w) => w.entries.slice());
  return detectEvictionGaps(windows)
    .concat(verifyOverlapConsistency(windows))
    .concat(verifyTickMonotonic(flat))
    .concat(checkUnloggedCounters(windows));
}
