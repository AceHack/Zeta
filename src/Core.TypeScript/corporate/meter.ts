/**
 * corporate/meter.ts — what every crossing of a port actually cost.
 *
 * ── WHY THIS HAS TO EXIST BEFORE ANY DASHBOARD DOES ──────────────────────────
 * Thirty mockups of this organization have shown a dollar figure, and every one of them was
 * invented, because nothing in the register recorded a single token. That is the worst shape a
 * number can have: it is not wrong in a way anyone can see. A reader budgets against it.
 *
 * §13 already says entropy and influence cross only through DECLARED, METERED channels, and the
 * declared half was built — `providers.ts` is the one place this register reaches a shell, a
 * filesystem or a model. The metered half was never built. This is it.
 *
 * ── THE RULE THAT MAKES A TOTAL HONEST: CARRY THE DENOMINATOR ────────────────
 * A sum over calls, some of which reported usage and some of which did not, is indistinguishable
 * from a sum over calls that all did. So `Spend` never carries a bare total: it carries `priced`
 * and `calls`, and a reader is told `$3.76 over 9 of 14 calls`. A caller that wants one number can
 * have one; it cannot have one without also being handed what it excludes.
 *
 * And `costUsd` is ABSENT, never `0`, when nothing was priced. Zero is a measurement — it says the
 * work was free — and defaulting to it would reintroduce exactly the invented figure this module
 * exists to delete. An unpriced run reports "not metered", which is true and useful; `$0.00` is
 * neither.
 *
 * ── PRICES ARE SUPPLIED, NEVER GUESSED ───────────────────────────────────────
 * The same discipline `requestUrl` keeps for links. A price table baked in here would be stale the
 * week after it was written and would be believed anyway. No table, no cost — the tokens are still
 * recorded, so a price applied later reprices the history exactly.
 *
 * ── LOCAL TIME STAYS LOCAL ───────────────────────────────────────────────────
 * `durationMs` is measured from a local clock and is REPORTED, never folded into a decision — the
 * discipline `local-time-never-enters-the-shared-fold` requires. Nothing here gates on a duration.
 */

import type { Fidelity, Port, PortResult } from "./providers";

/** What a provider reports about a model call it made. Absent for ports that call no model. */
export interface PortUsage {
  readonly tokensIn?: number;
  readonly tokensOut?: number;
  /** The model id as the provider names it. The key a price table is looked up by. */
  readonly model?: string;
}

/** One crossing of one port, measured. */
export interface PortMeter {
  readonly port: Port;
  /** Which adapter — `ProviderMeta.name`, so two adapters on one port stay distinguishable. */
  readonly provider: string;
  readonly fidelity: Fidelity;
  readonly startedMs: number;
  readonly durationMs: number;
  /** Whether the call succeeded. A refusal still costs time and often still costs tokens. */
  readonly ok: boolean;
  readonly tokensIn?: number;
  readonly tokensOut?: number;
  readonly model?: string;
  /** Present only when a price was configured for `model` AND tokens were reported. */
  readonly costUsd?: number;
}

/** Dollars per million tokens, per model. Supplied by an operator; never defaulted. */
export interface ModelPrice {
  readonly inPerMillion: number;
  readonly outPerMillion: number;
}

export type Pricing = Readonly<Record<string, ModelPrice>>;

/**
 * What a call cost in dollars, or `undefined` when that is not knowable.
 *
 * Three ways to be unknowable and all three return absent: no model reported, no price configured
 * for that model, or no tokens reported. A price configured for a DIFFERENT model does not apply to
 * this one — the same rule as URL templates, for the same reason.
 */
export function priceOf(usage: PortUsage, pricing: Pricing): number | undefined {
  if (usage.model === undefined) return undefined;
  const price = pricing[usage.model];
  if (price === undefined) return undefined;
  const tokensIn = usage.tokensIn ?? 0;
  const tokensOut = usage.tokensOut ?? 0;
  // A priced model that reported no tokens is not a free call, it is an unmeasured one.
  if (tokensIn === 0 && tokensOut === 0) return undefined;
  return (tokensIn * price.inPerMillion + tokensOut * price.outPerMillion) / 1_000_000;
}

export interface MeterContext {
  readonly port: Port;
  readonly provider: string;
  readonly fidelity: Fidelity;
  readonly pricing?: Pricing;
  /** Injected so a test measures what it decides to measure. Defaults to the local clock. */
  readonly now?: () => number;
}

/**
 * Run a port call and measure it.
 *
 * The result is returned UNCHANGED. Metering observes a crossing; it must not be able to alter one,
 * or the meter becomes part of what it measures.
 */
export async function meterCall<T>(
  ctx: MeterContext,
  call: () => Promise<PortResult<T>>,
): Promise<{ readonly result: PortResult<T>; readonly meter: PortMeter }> {
  const clock = ctx.now ?? Date.now;
  const startedMs = clock();
  const result = await call();
  const durationMs = Math.max(0, clock() - startedMs);
  const usage: PortUsage = result.ok ? (result.usage ?? {}) : {};
  const costUsd = ctx.pricing === undefined ? undefined : priceOf(usage, ctx.pricing);
  return {
    result,
    meter: {
      port: ctx.port,
      provider: ctx.provider,
      fidelity: ctx.fidelity,
      startedMs,
      durationMs,
      ok: result.ok,
      ...(usage.tokensIn === undefined ? {} : { tokensIn: usage.tokensIn }),
      ...(usage.tokensOut === undefined ? {} : { tokensOut: usage.tokensOut }),
      ...(usage.model === undefined ? {} : { model: usage.model }),
      ...(costUsd === undefined ? {} : { costUsd }),
    },
  };
}

/**
 * A total, and everything the total leaves out.
 *
 * `calls` is the denominator and it is not optional. Reporting `costUsd` without it would let a run
 * where one call in fourteen was priced render identically to one where all fourteen were.
 */
export interface Spend {
  readonly calls: number;
  /** How many of those calls carried a price. `0` ⇒ `costUsd` is absent. */
  readonly priced: number;
  readonly costUsd: number | undefined;
  readonly durationMs: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  /** How many calls actually reported tokens — the denominator for the token figures. */
  readonly withTokens: number;
}

export const NO_SPEND: Spend = {
  calls: 0,
  priced: 0,
  costUsd: undefined,
  durationMs: 0,
  tokensIn: 0,
  tokensOut: 0,
  withTokens: 0,
};

export function spendOf(meters: readonly PortMeter[]): Spend {
  let priced = 0;
  let costUsd = 0;
  let durationMs = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let withTokens = 0;
  for (const m of meters) {
    durationMs += m.durationMs;
    if (m.costUsd !== undefined) {
      priced += 1;
      costUsd += m.costUsd;
    }
    if (m.tokensIn !== undefined || m.tokensOut !== undefined) {
      withTokens += 1;
      tokensIn += m.tokensIn ?? 0;
      tokensOut += m.tokensOut ?? 0;
    }
  }
  return {
    calls: meters.length,
    priced,
    // ABSENT, NOT ZERO. Nothing priced means the cost is unknown, and "$0.00" says it was free.
    costUsd: priced === 0 ? undefined : costUsd,
    durationMs,
    tokensIn,
    tokensOut,
    withTokens,
  };
}

export function addSpend(a: Spend, b: Spend): Spend {
  const priced = a.priced + b.priced;
  return {
    calls: a.calls + b.calls,
    priced,
    costUsd: priced === 0 ? undefined : (a.costUsd ?? 0) + (b.costUsd ?? 0),
    durationMs: a.durationMs + b.durationMs,
    tokensIn: a.tokensIn + b.tokensIn,
    tokensOut: a.tokensOut + b.tokensOut,
    withTokens: a.withTokens + b.withTokens,
  };
}

/**
 * How a spend reads on a screen, including when it cannot be read as money.
 *
 * Kept here rather than in the page so that every surface says the same thing about the same
 * absence — a dashboard that renders `undefined` as `$0.00` in one place and `—` in another has
 * made the gap a rendering detail instead of a fact.
 */
export function spendLabel(spend: Spend): string {
  if (spend.calls === 0) return "no calls";
  if (spend.costUsd === undefined) return `not priced · ${String(spend.calls)} calls`;
  const money = `$${spend.costUsd.toFixed(2)}`;
  return spend.priced === spend.calls
    ? money
    : `${money} over ${String(spend.priced)} of ${String(spend.calls)} calls`;
}
