#!/usr/bin/env bun
// operator-presence.ts — OPERATOR PRESENCE AS A TICK-RATE MODULATOR.
//
// THE PROBLEM (Aaron, 2026-08-01): "I need some way to indicate that I'm here and monitoring so
// it can move faster" — burst at 15-minute cadence for a few hours while he is watching, then
// decay to something like every 4 hours until he pushes it again.
//
// THE INVERSION. The heartbeat cron is ALREADY `*/15 * * * *`, and the repo is public so runner
// minutes are free. The society is therefore permanently in burst. What is missing is not a way
// to go FAST — it is a way to go SLOW when nobody is watching, with fast as the DECLARED
// EXCEPTION. So the cron stays at */15 (it is just the polling clock) and each firing asks this
// module whether to do real work or exit immediately.
//
// THE LOAD-BEARING PROPERTY: FAIL SAFE TO SLOW.
//   Missing file, unreadable file, malformed JSON, bad timestamp, clock skew, expired window —
//   every one of these degrades to the IDLE cadence, never to burst. A presence signal that
//   failed OPEN would mean a corrupted file could pin an unattended society at maximum speed,
//   which is the opposite of what a presence signal is for. Speed must be something you
//   AFFIRMATIVELY CLAIM, and the claim must expire on its own.
//
// WHY A COMMITTED FILE and not a label/env/API: it works in a forge, in a bare clone, in a cron
// process, and in the future zetadb-native world. No forge-host coupling — the same reason the
// CA anchors are committed rather than fetched. (See the forge-host plugin note in
// tools/setup/persona-keys/ca.ts.)
//
// Usage:
//   bun operator-presence.ts decide --last <ISO|->        → exit 0 = TICK, exit 3 = SKIP
//   bun operator-presence.ts burst --hours 4              → write the presence file
//   bun operator-presence.ts status
//
// Exit codes: 0 = proceed with the tick · 3 = skip this firing (not an error) · 1 = usage error.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export const PRESENCE_PATH = "docs/presence/operator-presence.json";

/** Conservative defaults. Idle is deliberately much slower than the cron. */
export const DEFAULT_BURST_MIN = 15;
export const DEFAULT_IDLE_MIN = 240; // 4 hours

/**
 * THE LIVENESS FLOOR — no configuration may silence the society (Aaron, 2026-08-01):
 *
 *   "fail in the closed direction but NOT OFF — we still want to guarantee ticks for all members
 *    even when no one is watching. Failing completely closed is a last resort."
 *
 * So the presence signal modulates SPEED, never EXISTENCE. Without this clamp a parseable-but-
 * absurd `idleIntervalMin` (999999) would be honoured and the society would go silent — fail-closed
 * on existence, which is exactly the failure this must not have. Every member keeps ticking; the
 * only question the operator's presence answers is HOW FAST.
 */
export const MAX_IDLE_MIN = 360; // 6h ceiling — the slowest the society may ever run

export interface Presence {
  readonly operator?: string;
  /** ISO timestamp. While now < burstUntil, the burst cadence applies. Expires on its own. */
  readonly burstUntil?: string;
  readonly burstIntervalMin?: number;
  readonly idleIntervalMin?: number;
  readonly note?: string;
}

export type Cadence = "burst" | "idle";

export interface Decision {
  readonly proceed: boolean;
  readonly cadence: Cadence;
  readonly intervalMin: number;
  readonly reason: string;
}

/** Minutes between two ISO instants; NaN-safe (returns Infinity so a bad clock cannot BLOCK work). */
export function minutesBetween(fromIso: string | null, toIso: string): number {
  if (!fromIso) return Number.POSITIVE_INFINITY; // never ticked ⇒ due
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return (b - a) / 60000;
}

/**
 * THE DECISION. Pure: no clock, no filesystem — both are injected, so it is DST-replayable and
 * every branch is testable.
 *
 * FAIL-SAFE DIRECTION: any doubt about the presence signal ⇒ IDLE. Doubt about the LAST TICK ⇒
 * proceed (a missing/garbled last-tick must not wedge the society into silence — the two
 * unknowns fail in opposite directions ON PURPOSE).
 */
export function decideTick(rawPresence: string | null, nowIso: string, lastTickIso: string | null): Decision {
  let p: Presence = {};
  let parseNote = "";
  if (rawPresence !== null) {
    try {
      p = JSON.parse(rawPresence) as Presence;
    } catch {
      parseNote = " (presence file malformed — failing safe to idle)";
      p = {};
    }
  } else {
    parseNote = " (no presence file — failing safe to idle)";
  }

  const rawBurst = Number.isFinite(p.burstIntervalMin) ? Number(p.burstIntervalMin) : DEFAULT_BURST_MIN;
  const burstMin = Math.min(MAX_IDLE_MIN, Math.max(1, rawBurst));
  // Clamp BOTH directions: >= 1 minute (a 0/negative interval would busy-spin the runner) and
  // <= MAX_IDLE_MIN (no config may push the society below the guaranteed tick rate).
  const rawIdle = Number.isFinite(p.idleIntervalMin) ? Number(p.idleIntervalMin) : DEFAULT_IDLE_MIN;
  const idleMin = Math.min(MAX_IDLE_MIN, Math.max(1, rawIdle));

  const until = p.burstUntil ? Date.parse(p.burstUntil) : NaN;
  const now = Date.parse(nowIso);
  // An unparseable or absent burstUntil is NOT a burst. Only a valid future instant is.
  const inBurst = Number.isFinite(until) && Number.isFinite(now) && now < until;

  const cadence: Cadence = inBurst ? "burst" : "idle";
  const intervalMin = inBurst ? burstMin : idleMin;
  const elapsed = minutesBetween(lastTickIso, nowIso);
  const proceed = elapsed >= intervalMin;

  const window = inBurst ? `burst until ${p.burstUntil}` : `idle${parseNote}`;
  const el = Number.isFinite(elapsed) ? `${elapsed.toFixed(1)}m` : "never";
  return {
    proceed,
    cadence,
    intervalMin,
    reason: `${window}; cadence=${intervalMin}m; since last tick=${el} ⇒ ${proceed ? "TICK" : "SKIP"}`,
  };
}

/** The presence document for a burst of `hours` starting at `nowIso`. */
export function makeBurst(nowIso: string, hours: number, operator = "aaron"): Presence {
  const until = new Date(Date.parse(nowIso) + hours * 3600_000).toISOString();
  return {
    operator,
    burstUntil: until,
    burstIntervalMin: DEFAULT_BURST_MIN,
    idleIntervalMin: DEFAULT_IDLE_MIN,
    note:
      "Operator is present and monitoring; the society may run at the burst cadence until " +
      `${until}. This claim EXPIRES ON ITS OWN — nothing needs to clear it, and a stale or ` +
      "corrupted file degrades to idle, never to burst.",
  };
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  const root = process.cwd();
  const file = join(root, PRESENCE_PATH);
  const nowIso = new Date().toISOString();

  if (cmd === "burst") {
    const hIdx = rest.indexOf("--hours");
    const hours = hIdx >= 0 ? Number(rest[hIdx + 1] ?? "4") : 4;
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      console.error("[presence] --hours must be in (0, 24]");
      process.exit(1);
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(makeBurst(nowIso, hours), null, 2) + "\n");
    console.log(`[presence] burst for ${hours}h → ${PRESENCE_PATH} (expires on its own)`);
    return;
  }

  const raw = existsSync(file) ? readFileSync(file, "utf8") : null;

  if (cmd === "status") {
    const d = decideTick(raw, nowIso, null);
    console.log(`[presence] cadence=${d.cadence} interval=${d.intervalMin}m — ${d.reason}`);
    return;
  }

  if (cmd === "decide") {
    const lIdx = rest.indexOf("--last");
    const lastRaw = lIdx >= 0 ? rest[lIdx + 1] : undefined;
    const last = !lastRaw || lastRaw === "-" ? null : lastRaw;
    const d = decideTick(raw, nowIso, last);
    console.log(`[presence] ${d.cadence.toUpperCase()} — ${d.reason}`);
    process.exit(d.proceed ? 0 : 3); // 3 = skip, deliberately NOT 1 (a skip is not an error)
  }

  console.error("usage: operator-presence.ts <decide --last ISO|-> | burst --hours N | status>");
  process.exit(1);
}

if (import.meta.main) main();
