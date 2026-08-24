#!/usr/bin/env bun
/**
 * tick-agreement-probe.ts — a FEASIBILITY PROBE, deliberately not a meter.
 *
 * It answers exactly one question: **does `docs/observe-events/` contain enough concurrent
 * multi-agent ticks to estimate anything at all?** It reports, per heartbeat-agent pair, the raw
 * agreement rate `po` on `action.kind`, the chance-agreement `pe` computed from the pair's OWN
 * marginals, Cohen's kappa `(po - pe) / (1 - pe)`, and — for contrast — the excess a
 * `1 / (number of distinct kinds)` null would have produced.
 *
 * ## Why the contrast column exists
 *
 * `src/Core.TypeScript/observe/decorrelation-meter.ts` uses `expectedByChance = 1 / avgMenuSize`.
 * That is the chance-agreement of two agents choosing UNIFORMLY. Agents do not choose uniformly:
 * the action-kind marginal is dominated by one kind, so two INDEPENDENT agents with these marginals
 * already agree far more often than `1 / k`. Using the uniform null therefore attributes ordinary
 * marginal skew to coupling and OVER-reports correlation. The two columns here differ on live data,
 * which is why the contrast is printed rather than argued.
 *
 * ## What this is NOT — the demarcation this probe exists to make legible
 *
 * `kappa` here is an **agreement** correlation on an action label. It is **NOT** the `rho` that
 * `N_eff = N/(1+(N-1)rho)` (`src/Bayesian/CondorcetBoundary.fs`) or `expectedGain`
 * (`src/Core/SocietyUsefulWork.fs`) are defined over — those take the pairwise **ERROR**
 * correlation, which requires per-item ground truth this event log does not carry. Two agents of
 * competence c with perfectly INDEPENDENT errors agree at rate `1 - 2c(1-c)`: at c = 0.9 that is
 * 0.82, so a high agreement rate is what independence looks like among competent agents. Feeding
 * this number into `effectiveTrialCount` would be a category error.
 *
 * Further limits, stated rather than discovered later:
 *  - Agents run on separate heartbeat lanes, so they do NOT face a common menu. The comparison is
 *    not of answers to one question.
 *  - Windowing is a fixed 15-minute bucket with last-write-wins, matching the heartbeat cadence.
 *  - No null model, no confounder stratification, no confidence interval. `DecorrelationExcess` /
 *    `DecorrelationExcessFusion` are the instruments that carry those; this is not one.
 *
 * Register (`.claude/rules/toy-is-free-metered-must-be-earned.md`): **metered** as a count of the
 * corpus (re-runnable, deterministic given the committed events). **NOT metered** as any statement
 * about the society's decorrelation.
 *
 * Anchors: Cohen, J. (1960) — the kappa coefficient and the marginal chance-agreement baseline.
 * Scott, W.A. (1955) — pi, the same correction with pooled marginals.
 *
 * Usage: bun src/Core.TypeScript/society/tick-agreement-probe.ts [--json] [--window-ms 900000]
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The heartbeat roster, from `.github/workflows/agent-heartbeat.yml` `matrix.agent`. */
export const HEARTBEAT_AGENTS = ["alexa", "otto", "soraya"] as const;

export interface ObserveEvent {
  readonly at: string;
  readonly by: string;
  readonly action?: { readonly kind?: string };
}

export interface PairAgreement {
  readonly a: string;
  readonly b: string;
  /** Concurrent windows in which BOTH agents acted. */
  readonly n: number;
  /** Observed agreement rate. */
  readonly po: number;
  /** Chance agreement from the pair's own marginals (Cohen 1960). */
  readonly pe: number;
  /** (po - pe) / (1 - pe). */
  readonly kappa: number;
  /** The uniform null `1 / kinds` that `decorrelation-meter.ts` uses. */
  readonly uniformNull: number;
  /** (po - uniformNull) / (1 - uniformNull) — the shipped meter's shape, for contrast only. */
  readonly uniformNullExcess: number;
  /** Distinct action kinds seen in this pair's comparable windows. */
  readonly kinds: number;
}

/** Bucket events into fixed windows, keeping the LAST action per agent per window. */
export function bucketByWindow(
  events: readonly ObserveEvent[],
  windowMs: number,
  roster: readonly string[],
): Map<number, Map<string, string>> {
  const windows = new Map<number, Map<string, string>>();
  for (const e of events) {
    if (!roster.includes(e.by)) continue;
    const kind = e.action?.kind;
    if (kind === undefined || kind.length === 0) continue;
    const t = new Date(e.at).getTime();
    if (!Number.isFinite(t)) continue;
    const bucket = Math.floor(t / windowMs);
    let m = windows.get(bucket);
    if (m === undefined) { m = new Map<string, string>(); windows.set(bucket, m); }
    m.set(e.by, kind);
  }
  return windows;
}

/** Cohen's kappa for one pair, plus the uniform-null contrast. */
export function pairAgreement(
  windows: ReadonlyMap<number, ReadonlyMap<string, string>>,
  a: string,
  b: string,
): PairAgreement {
  const pairs: [string, string][] = [];
  for (const [, m] of windows) {
    const x = m.get(a);
    const y = m.get(b);
    if (x !== undefined && y !== undefined) pairs.push([x, y]);
  }
  const n = pairs.length;
  if (n === 0) {
    return { a, b, n: 0, po: 0, pe: 0, kappa: 0, uniformNull: 0, uniformNullExcess: 0, kinds: 0 };
  }
  const po = pairs.filter(([x, y]) => x === y).length / n;
  const mA = new Map<string, number>();
  const mB = new Map<string, number>();
  for (const [x, y] of pairs) {
    mA.set(x, (mA.get(x) ?? 0) + 1);
    mB.set(y, (mB.get(y) ?? 0) + 1);
  }
  let pe = 0;
  for (const [k, ca] of mA) pe += (ca / n) * ((mB.get(k) ?? 0) / n);
  const kinds = new Set([...mA.keys(), ...mB.keys()]).size;
  const uniformNull = kinds > 0 ? 1 / kinds : 0;
  // A degenerate pe = 1 (both agents emitted exactly one kind, the same one) has no defined kappa:
  // there is no room above chance. Report 0 rather than divide by zero and poison a mean.
  const kappa = pe >= 1 ? 0 : (po - pe) / (1 - pe);
  const uniformNullExcess = uniformNull >= 1 ? 0 : (po - uniformNull) / (1 - uniformNull);
  return { a, b, n, po, pe, kappa, uniformNull, uniformNullExcess, kinds };
}

/** Read every `*.json` under `dir` that parses as an observe event. */
export function loadEvents(dir: string): ObserveEvent[] {
  const out: ObserveEvent[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const e = JSON.parse(readFileSync(join(dir, f), "utf-8")) as ObserveEvent;
      if (typeof e.at === "string" && typeof e.by === "string") out.push(e);
    } catch { /* a malformed shard is skipped, never guessed at */ }
  }
  return out;
}

export function probe(repoRoot: string, windowMs: number): {
  readonly events: number;
  readonly windows: number;
  readonly pairs: readonly PairAgreement[];
} {
  const events = loadEvents(join(repoRoot, "docs", "observe-events"));
  const windows = bucketByWindow(events, windowMs, HEARTBEAT_AGENTS as readonly string[]);
  const pairs: PairAgreement[] = [];
  for (let i = 0; i < HEARTBEAT_AGENTS.length; i++) {
    for (let j = i + 1; j < HEARTBEAT_AGENTS.length; j++) {
      pairs.push(pairAgreement(windows, HEARTBEAT_AGENTS[i]!, HEARTBEAT_AGENTS[j]!));
    }
  }
  return { events: events.length, windows: windows.size, pairs };
}

if (import.meta.main) {
  const wi = process.argv.indexOf("--window-ms");
  const windowMs = wi >= 0 ? Number(process.argv[wi + 1]) : 900_000;
  const r = probe(process.cwd(), windowMs);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(`[probe] ${r.events} events, ${r.windows} windows of ${windowMs}ms`);
    for (const p of r.pairs) {
      console.log(
        `[probe] ${p.a}|${p.b}  n=${p.n}  po=${p.po.toFixed(4)}  pe=${p.pe.toFixed(4)}  ` +
        `kappa=${p.kappa.toFixed(4)}  uniformNullExcess=${p.uniformNullExcess.toFixed(4)}`,
      );
    }
    console.log("[probe] kappa is AGREEMENT correlation, NOT the Condorcet error-correlation rho.");
  }
}
