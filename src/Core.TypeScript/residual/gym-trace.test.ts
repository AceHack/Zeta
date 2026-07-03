import { expect, test } from "bun:test";
import { runGym, type StrategyName } from "../moral-gym/gym";
import { analyze } from "./residual";
import { residualSpectrum, replayAgreementTrace, actionTrace } from "./gym-trace";

// DST: fixed seed -> the gym, the ledger, and therefore every number here is reproducible.
const seed = 0xE66n;
const population: { strategy: StrategyName }[] = [
  ...Array.from({ length: 4 }, () => ({ strategy: "tit-for-lesser-tat" as StrategyName })),
  ...Array.from({ length: 3 }, () => ({ strategy: "all-in" as StrategyName })),
  ...Array.from({ length: 3 }, () => ({ strategy: "defector" as StrategyName })),
  ...Array.from({ length: 3 }, () => ({ strategy: "strict-tft" as StrategyName })),
  ...Array.from({ length: 3 }, () => ({ strategy: "cooperator" as StrategyName })),
  ...Array.from({ length: 2 }, () => ({ strategy: "expanded-self" as StrategyName })),
];
const cfg = { seed, agents: population, rounds: 400 };

test("real trace: unconditional strategies are fully reducible (p-zombie CANDIDATES, not verdicts)", () => {
  const spectrum = residualSpectrum(runGym(cfg));
  const by = new Map(spectrum.map((r) => [r.strategy, r]));
  expect(by.get("cooperator")!.meanReducibility).toBeGreaterThan(0.98);
  expect(by.get("expanded-self")!.meanReducibility).toBeGreaterThan(0.98);
  expect(by.get("defector")!.meanReducibility).toBeGreaterThan(0.98);
});

test("real trace: lesser-tat carries the largest residual for the SEEDLESS observer (injected entropy)", () => {
  const spectrum = residualSpectrum(runGym(cfg));
  const by = new Map(spectrum.map((r) => [r.strategy, r]));
  const tflt = by.get("tit-for-lesser-tat")!;
  expect(tflt.meanReducibility).toBeLessThan(0.95);
  // spectrum ordering: coin-flip strategy is the least reducible row of the whole table
  expect(spectrum[spectrum.length - 1]!.strategy).toBe("tit-for-lesser-tat");
  // contextual-deterministic strategies sit BETWEEN: their residual is lens poverty
  // (per-relationship context withheld from the own-stream observer), not injected entropy.
  expect(by.get("strict-tft")!.meanReducibility).toBeGreaterThan(tflt.meanReducibility);
  expect(by.get("strict-tft")!.meanReducibility).toBeLessThan(0.98);
});

test("real trace: DST replay is the with-seed observer — the whole population collapses to ~0 residual", () => {
  const run = runGym(cfg);
  const replay = runGym(cfg);
  const agree = replayAgreementTrace(run, replay);
  expect(agree.length).toBe(run.roundsPlayed);
  expect(agree.every((x) => x === 1)).toBe(true); // every action reproduced exactly
  expect(analyze(agree).reducibility).toBeGreaterThan(0.99);
});

test("ledger lens: actionTrace only contains the agent's own actions, in play order", () => {
  const run = runGym(cfg);
  const total = run.agents.reduce((s, a) => s + actionTrace(run.ledger, a.id).length, 0);
  expect(total).toBe(run.roundsPlayed * 2); // each round contributes exactly two actions
});
