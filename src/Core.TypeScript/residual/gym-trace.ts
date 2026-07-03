// gym-trace.ts — the residual measure applied to a REAL agent trace (081KTF7Q3TT, open bullet).
//
// The moral gym's observe->report Detour already writes every resolved round to a ledger;
// this module lenses that ledger into per-agent action streams so `analyze` can measure the
// reducibility spectrum of ACTUAL behavior — not a synthetic demo stream.
//
// HONEST BOUND (same as residual.ts, restated at the point of use): this measures how
// compressible each agent's behavior is TO AN OBSERVER WITH A GIVEN LENS. It does not measure
// experience. A defector's all-1s stream being "fully reducible" makes it a p-zombie CANDIDATE
// under this lens, not a p-zombie; a lesser-tat's residual is injected splitmix64 entropy, not
// evidence of an inside. The observer-relative half is proven by DST replay: the same gym,
// re-run with the seed, reproduces every action exactly — the residual collapses for the
// seed-holding observer.

import type { GymResult, RoundRecord, Action, StrategyName } from "../moral-gym/gym";
import { analyze, type ResidualReport } from "./residual";

export const encodeAction = (a: Action): number => (a === "cooperate" ? 0 : 1);

/** One agent's own actions, in ledger (play) order — its real behavior stream. */
export function actionTrace(ledger: readonly RoundRecord[], agentId: number): number[] {
  const out: number[] = [];
  for (const r of ledger) {
    if (r.a === agentId) out.push(encodeAction(r.actionA));
    if (r.b === agentId) out.push(encodeAction(r.actionB));
  }
  return out;
}

export interface StrategySpectrumRow {
  readonly strategy: StrategyName;
  readonly agents: number;
  readonly symbols: number; // total actions measured across the strategy's agents
  readonly meanResidualBitsPerSymbol: number;
  readonly meanReducibility: number;
}

/** Per-strategy residual spectrum over a finished gym: mean of per-agent analyze() results. */
export function residualSpectrum(result: GymResult): StrategySpectrumRow[] {
  const byStrategy = new Map<StrategyName, ResidualReport[]>();
  for (const agent of result.agents) {
    const trace = actionTrace(result.ledger, agent.id);
    if (trace.length < 32) continue; // too short to score honestly
    const reports = byStrategy.get(agent.strategy) ?? [];
    reports.push(analyze(trace));
    byStrategy.set(agent.strategy, reports);
  }
  const rows: StrategySpectrumRow[] = [];
  for (const [strategy, reports] of byStrategy) {
    const n = reports.length;
    rows.push({
      strategy,
      agents: n,
      symbols: reports.reduce((s, r) => s + r.symbols, 0),
      meanResidualBitsPerSymbol:
        Math.round((reports.reduce((s, r) => s + r.residualBitsPerSymbol, 0) / n) * 1000) / 1000,
      meanReducibility: Math.round((reports.reduce((s, r) => s + r.reducibility, 0) / n) * 1000) / 1000,
    });
  }
  return rows.sort((x, y) => y.meanReducibility - x.meanReducibility);
}

/** The with-seed observer, on a real trace: DST replay agreement stream (1 = replay reproduced
 *  the action). Because the gym is deterministic, a same-seed re-run agrees everywhere — the
 *  whole population's behavior collapses to ~0 residual for the observer holding the seed. */
export function replayAgreementTrace(run: GymResult, replay: GymResult): number[] {
  const n = Math.min(run.ledger.length, replay.ledger.length);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = run.ledger[i]!;
    const b = replay.ledger[i]!;
    out.push(a.a === b.a && a.b === b.b && a.actionA === b.actionA && a.actionB === b.actionB ? 1 : 0);
  }
  return out;
}
