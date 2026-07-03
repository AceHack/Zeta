import { expect, test } from "bun:test";
import { runGym, selfWidthSweep, type StrategyName } from "./gym";

function pop(spec: [StrategyName, number][]): { strategy: StrategyName }[] {
  return spec.flatMap(([s, n]) => Array.from({ length: n }, () => ({ strategy: s })));
}

test("DST: same seed -> byte-identical run", () => {
  const cfg = { seed: 0xE66n, agents: pop([["tit-for-lesser-tat", 4], ["defector", 3], ["all-in", 3]]), rounds: 200 };
  const a = runGym(cfg);
  const b = runGym(cfg);
  expect(JSON.stringify(a.board)).toBe(JSON.stringify(b.board));
  expect(a.gamesEnded).toBe(b.gamesEnded);
  expect(a.totalWelfare).toBe(b.totalWelfare);
  expect(a.roundsPlayed).toBe(b.roundsPlayed);
});

test("reputation is earned: defectors get shunned to the bottom", () => {
  const r = runGym({ seed: 0xE66n, agents: pop([["tit-for-lesser-tat", 5], ["defector", 5], ["cooperator", 5]]), rounds: 300 });
  const defector = r.board.find((b) => b.strategy === "defector")!;
  const others = r.board.filter((b) => b.strategy !== "defector");
  expect(defector.reputation).toBe(0); // shunned: never credited by others
  for (const o of others) expect(o.reputation).toBeGreaterThan(defector.reputation);
});

test("full retaliation ends games; lesser-tat keeps them infinite", () => {
  const withAllIn = runGym({ seed: 0xE66n, agents: pop([["all-in", 6], ["defector", 4]]), rounds: 300 });
  const onlyLesser = runGym({ seed: 0xE66n, agents: pop([["tit-for-lesser-tat", 6], ["cooperator", 4]]), rounds: 300 });
  expect(withAllIn.gamesEnded).toBeGreaterThan(0); // "retaliate with all I have -> end the game"
  expect(onlyLesser.gamesEnded).toBe(0); // lesser-tat + cooperators never lock DD
});

test('"nothing is other": welfare rises monotonically with self-width', () => {
  const sweep = selfWidthSweep(0xE66n, 250, 5);
  for (let i = 1; i < sweep.length; i++) {
    expect(sweep[i]!.welfare).toBeGreaterThanOrEqual(sweep[i - 1]!.welfare);
  }
  expect(sweep[sweep.length - 1]!.welfare).toBeGreaterThan(sweep[0]!.welfare); // w=1 beats w=0
});

test("expanded-self is not exploited into the cellar (widening self is viable)", () => {
  const r = runGym({ seed: 0xE66n, agents: pop([["expanded-self", 3], ["tit-for-lesser-tat", 3], ["defector", 3], ["cooperator", 3]]), rounds: 300 });
  const expanded = r.board.find((b) => b.strategy === "expanded-self")!;
  const defector = r.board.find((b) => b.strategy === "defector")!;
  expect(expanded.reputation).toBeGreaterThan(defector.reputation);
});
