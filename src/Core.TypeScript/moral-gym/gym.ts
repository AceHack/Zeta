// gym.ts — the moral corpus, made executable and DST-replayable.
//
// The day's ethics (docs/research/2026-07-02-mmorpgs-as-moral-gym-...) become the
// MECHANICS of a deterministic iterated game, so anyone can re-run the seed and WATCH
// the claims instead of being told them:
//   - tit-for-lesser-tat (generous TFT) beats strict all-in retaliation;
//   - full retaliation ("all I have") ENDS games (mutual-defect lock); lesser-tat keeps them infinite;
//   - reputation is EARNED STATE (credited only by others), and it makes cooperation win;
//   - self-width w -> 1 ("nothing is other") maximizes total welfare and ends zero games.
//
// DST / noninterference: ALL entropy enters through the injected splitmix64 Source (no
// Math.random) — same seed, byte-identical run. The engine IS the observe->report->improve
// loop, instrumented by a Detour<'F> = 'F -> 'F endomorphism mirroring src/Core/Detour.fs.

import { mix, GOLDEN_RATIO } from "../splitmix64/splitmix64";

const MASK64 = (1n << 64n) - 1n;

/** Deterministic Source — the one declared entropy channel (noninterference). */
export class Rng {
  private state: bigint;
  constructor(seed: bigint) {
    this.state = seed & MASK64;
  }
  /** splitmix64 step. */
  nextU64(): bigint {
    this.state = (this.state + GOLDEN_RATIO) & MASK64;
    return mix(this.state);
  }
  /** Uniform in [0, 1). */
  nextFloat(): number {
    return Number(this.nextU64() >> 11n) / 2 ** 53;
  }
}

// ---- Detour<'F> in TS (mirrors src/Core/Detour.fs; the loop's instrumentation) --------

export type Detour<F> = (target: F) => F;
export type Observe<T> = (t: T) => void;

/** observe/report (read-only): watch each round without altering its outcome. */
export function around<A, B>(obs: Observe<readonly [A, B]>): Detour<(a: A) => B> {
  return (target) => (a: A) => {
    const b = target(a);
    obs([a, b] as const);
    return b;
  };
}

export const attach = <F>(detour: Detour<F>, target: F): F => detour(target);

// ---- The game -------------------------------------------------------------------------

export type Action = "cooperate" | "defect";

export type StrategyName =
  | "cooperator"
  | "defector"
  | "strict-tft"
  | "all-in" // grim trigger: retaliate with all I have -> ends games
  | "tit-for-lesser-tat" // generous TFT + teach
  | "expanded-self"; // self-width w=1: the other's payoff IS mine -> nothing is other

export interface Agent {
  readonly id: number;
  readonly strategy: StrategyName;
  /** self-width in [0,1]: how much of the OTHER's payoff counts as mine. */
  readonly selfWidth: number;
  reputation: number; // EARNED: credited only by others (never self-set)
  payoff: number;
}

/** Per-relationship memory: last action seen + whether this pairing's game has ended. */
interface Relationship {
  lastOther: Action | null;
  ddStreak: number; // consecutive mutual-defect rounds
  ended: boolean; // locked into the dead DD state
  triggered: boolean; // all-in has been provoked
}

// Iterated Prisoner's Dilemma payoffs (T>R>P>S, 2R>T+S).
const R = 3; // both cooperate
const T = 5; // defect vs cooperator
const S = 0; // cooperate vs defector
const P = 1; // both defect
const DD_LOCK = 3; // consecutive mutual defects that "end" a relationship

function decide(agent: Agent, rel: Relationship, rng: Rng): Action {
  switch (agent.strategy) {
    case "cooperator":
    case "expanded-self":
      return "cooperate"; // w=1: maximizing joint payoff = cooperate
    case "defector":
      return "defect";
    case "strict-tft":
      return rel.lastOther === "defect" ? "defect" : "cooperate";
    case "all-in":
      // grim trigger: once glitched, retaliate with all I have, forever (ends the game)
      if (rel.lastOther === "defect") rel.triggered = true;
      return rel.triggered ? "defect" : "cooperate";
    case "tit-for-lesser-tat": {
      if (rel.lastOther !== "defect") return "cooperate";
      // retaliate with LESS than you got: forgive with prob g (generous TFT),
      // and when forgiving, "teach" by returning cooperation (raise the other).
      // self-width widens forgiveness: the more the other IS you (w->1), the less
      // you retaliate, because hurting them hurts you — "nothing is other" => never retaliate.
      const forgive = 0.35 + agent.selfWidth * 0.65;
      return rng.nextFloat() < forgive ? "cooperate" : "defect";
    }
  }
}

function payoff(mine: Action, theirs: Action): number {
  if (mine === "cooperate" && theirs === "cooperate") return R;
  if (mine === "cooperate" && theirs === "defect") return S;
  if (mine === "defect" && theirs === "cooperate") return T;
  return P;
}

export interface RoundRecord {
  a: number;
  b: number;
  actionA: Action;
  actionB: Action;
}

export interface GymConfig {
  readonly seed: bigint;
  readonly agents: readonly { strategy: StrategyName; selfWidth?: number }[];
  readonly rounds: number;
}

export interface GymResult {
  readonly seed: string;
  readonly rounds: number;
  readonly agents: readonly Agent[];
  /** relationships that locked into the dead mutual-defect state (games ENDED). */
  readonly gamesEnded: number;
  /** population total payoff (welfare). */
  readonly totalWelfare: number;
  /** observe->report ledger size (rounds actually played, DD-locked pairs excluded). */
  readonly roundsPlayed: number;
  /** the observe->report ledger itself — every resolved round, in play order (the real trace
   *  the residual measure lenses; 081KTF7Q3TT). */
  readonly ledger: readonly RoundRecord[];
  /** per-strategy rollup for the scoreboard. */
  readonly board: readonly {
    strategy: StrategyName;
    reputation: number;
    payoff: number;
  }[];
}

/** Run the deterministic moral gym. Same seed -> identical result. */
export function runGym(cfg: GymConfig): GymResult {
  const rng = new Rng(cfg.seed);
  const agents: Agent[] = cfg.agents.map((a, id) => ({
    id,
    strategy: a.strategy,
    selfWidth: a.selfWidth ?? (a.strategy === "expanded-self" ? 1 : 0),
    reputation: 0,
    payoff: 0,
  }));
  const n = agents.length;
  const rel = new Map<string, Relationship>();
  const key = (i: number, j: number): string => `${i}:${j}`;
  const relOf = (i: number, j: number): Relationship => {
    const k = key(i, j);
    let r = rel.get(k);
    if (!r) {
      r = { lastOther: null, ddStreak: 0, ended: false, triggered: false };
      rel.set(k, r);
    }
    return r;
  };

  const ledger: RoundRecord[] = [];
  // observe->report: a Detour watching every resolved round (read-only).
  const observedResolve = attach(
    around<readonly [number, number], RoundRecord>((pair) => ledger.push(pair[1])),
    ([i, j]: readonly [number, number]): RoundRecord => {
      const ra = relOf(i, j);
      const rb = relOf(j, i);
      const actionA = decide(agents[i]!, ra, rng);
      const actionB = decide(agents[j]!, rb, rng);
      return { a: i, b: j, actionA, actionB };
    },
  );

  let gamesEnded = 0;
  for (let round = 0; round < cfg.rounds; round++) {
    // Reputation-weighted partner selection (indirect reciprocity, the Agora scoreboard):
    // each agent proposes a partner, biased toward higher reputation; defectors get shunned.
    for (let i = 0; i < n; i++) {
      // pick partner j != i, weighted by (reputation + 1) so high-rep agents attract play
      let total = 0;
      const weights: number[] = [];
      for (let j = 0; j < n; j++) {
        const r = relOf(i, j);
        const w = i === j || r.ended ? 0 : Math.max(0.1, agents[j]!.reputation + 1);
        weights.push(w);
        total += w;
      }
      if (total === 0) continue;
      let pick = rng.nextFloat() * total;
      let j = 0;
      for (let cand = 0; cand < n; cand++) {
        pick -= weights[cand]!;
        if (pick <= 0) {
          j = cand;
          break;
        }
      }
      const ra = relOf(i, j);
      const rb = relOf(j, i);
      if (ra.ended || rb.ended) continue;

      const rec = observedResolve([i, j] as const);

      // improve: the strategies already adapted via rel memory; bank payoffs + earned reputation.
      const pa = payoff(rec.actionA, rec.actionB);
      const pb = payoff(rec.actionB, rec.actionA);
      // self-width: an agent books own + w*other's payoff (expanded self internalizes the other).
      agents[i]!.payoff += pa + agents[i]!.selfWidth * pb;
      agents[j]!.payoff += pb + agents[j]!.selfWidth * pa;
      // reputation is EARNED by OTHERS: if you cooperated, your partner credits you.
      if (rec.actionA === "cooperate") agents[i]!.reputation += 1;
      if (rec.actionB === "cooperate") agents[j]!.reputation += 1;
      // defectors lose standing (the shun signal)
      if (rec.actionA === "defect") agents[i]!.reputation = Math.max(0, agents[i]!.reputation - 1);
      if (rec.actionB === "defect") agents[j]!.reputation = Math.max(0, agents[j]!.reputation - 1);

      ra.lastOther = rec.actionB;
      rb.lastOther = rec.actionA;
      const mutualDefect = rec.actionA === "defect" && rec.actionB === "defect";
      ra.ddStreak = mutualDefect ? ra.ddStreak + 1 : 0;
      rb.ddStreak = mutualDefect ? rb.ddStreak + 1 : 0;
      if (!ra.ended && ra.ddStreak >= DD_LOCK) {
        ra.ended = true;
        rb.ended = true;
        gamesEnded += 1; // this relationship's game has ENDED (the non-retractable move)
      }
    }
  }

  const totalWelfare = agents.reduce((s, a) => s + a.payoff, 0);
  const byStrat = new Map<StrategyName, { reputation: number; payoff: number; count: number }>();
  for (const a of agents) {
    const cur = byStrat.get(a.strategy) ?? { reputation: 0, payoff: 0, count: 0 };
    cur.reputation += a.reputation;
    cur.payoff += a.payoff;
    cur.count += 1;
    byStrat.set(a.strategy, cur);
  }
  const board = [...byStrat.entries()]
    .map(([strategy, v]) => ({
      strategy,
      reputation: Math.round((v.reputation / v.count) * 100) / 100,
      payoff: Math.round((v.payoff / v.count) * 100) / 100,
    }))
    .sort((x, y) => y.reputation - x.reputation);

  return {
    seed: cfg.seed.toString(),
    rounds: cfg.rounds,
    agents,
    gamesEnded,
    totalWelfare: Math.round(totalWelfare * 100) / 100,
    roundsPlayed: ledger.length,
    ledger,
    board,
  };
}

/** Sweep self-width 0->1 to render "nothing is other" as a monotone welfare curve. */
export function selfWidthSweep(seed: bigint, rounds: number, steps: number): { w: number; welfare: number; gamesEnded: number }[] {
  const out: { w: number; welfare: number; gamesEnded: number }[] = [];
  for (let s = 0; s <= steps; s++) {
    const w = s / steps;
    // a homogeneous population at self-width w (everyone internalizes the other equally)
    const agents = Array.from({ length: 12 }, () => ({ strategy: "tit-for-lesser-tat" as StrategyName, selfWidth: w }));
    const r = runGym({ seed, agents, rounds });
    out.push({ w: Math.round(w * 100) / 100, welfare: r.totalWelfare, gamesEnded: r.gamesEnded });
  }
  return out;
}
