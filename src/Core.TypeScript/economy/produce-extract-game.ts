// produce-extract-game — the vampire's countdown, as a toy (shadow*, register B — TOY ONLY).
//
// HONEST SCOPE, READ FIRST (math-team triage 2026-07-03): this is a finite repeated game with
// CHOSEN payoffs. It proves properties OF THE TOY, under swept parameter regions — it does NOT
// and CANNOT prove "love is the fitness function" as a universal. What it CAN show, exhaustively:
//
//   1. Mutual extraction self-terminates (the vampire drains its host, then starves) — value is
//      DESTROYED, not moved, whenever extraction is lossy.
//   2. Mutual production compounds — whenever production creates surplus.
//   3. THE TEMPTATION IS REAL: on short horizons, extraction OUTSCORES production. We prove the
//      dishonest region exists rather than hiding it.
//   4. THE HORIZON IS THE THEOREM: past a computable horizon, produce (and produce-reciprocating)
//      strategies dominate extraction. This is Axelrod's shadow-of-the-future (1984) made exact
//      in-toy — extraction is rational ONLY under a countdown. Which is the mechanical content of
//      the anti-vampire wager ("assume immortal"): removing the countdown is what makes
//      production the winning strategy. The wager buys the horizon; the horizon picks the winner.
//
// Anchors: Axelrod 1984 (iterated PD tournaments, shadow of the future); Maynard Smith & Price
// 1973 / Maynard Smith 1982 (ESS); Trivers 1971 (reciprocal altruism). The mapping to
// produce/extract is `docs/research/2026-07-02-produce-or-extract-…`; the honest-scope discipline
// is `2026-07-03-provability-triage-…`.
//
// Deterministic throughout: pure fold, integer milli, no randomness — the proofs sweep grids.

/// One player's move: PRODUCE (spend own capacity to create partner surplus) or EXTRACT (drain
/// the partner lossily). The two poles of the discriminator.
export type Move = "produce" | "extract";

/// A strategy is a pure policy over the visible history (partner's previous move).
export type Strategy = "alwaysProduce" | "alwaysExtract" | "titForTat";

export interface GameParams {
  /// Starting capacity per player (milli).
  readonly initialCapacity: number;
  /// PRODUCE: producer pays `produceCost`, partner receives `produceGain`. Surplus exists iff
  /// produceGain > produceCost — production creates value.
  readonly produceCost: number;
  readonly produceGain: number;
  /// EXTRACT: victim loses `extractTake`, extractor receives `extractYield`. Lossy iff
  /// extractYield < extractTake — extraction destroys value in transit.
  readonly extractTake: number;
  readonly extractYield: number;
}

export interface GameResult {
  readonly finalA: number;
  readonly finalB: number;
  /// Round at which a player hit zero capacity (dead — takes no actions, yields nothing), or null.
  readonly deadA: number | null;
  readonly deadB: number | null;
  readonly rounds: number;
}

function moveOf(s: Strategy, partnerLast: Move | null): Move {
  if (s === "alwaysProduce") return "produce";
  if (s === "alwaysExtract") return "extract";
  return partnerLast ?? "produce"; // tit-for-tat: open producing, then mirror
}

/// One side's move resolved against the other's start-of-round state: what it costs the mover,
/// what it does to the other. Production pays its cost regardless (a corpse receives nothing);
/// extraction from a corpse returns zero — the vampire starves. Lossy transfer pro-rates on a
/// shallow victim.
function resolveMove(m: Move | null, otherAlive: boolean, otherCap: number, p: GameParams): { self: number; other: number } {
  if (m === "produce") return { self: -p.produceCost, other: otherAlive ? p.produceGain : 0 };
  if (m === "extract" && otherAlive) {
    const take = Math.min(p.extractTake, otherCap);
    return { self: Math.round((take * p.extractYield) / p.extractTake), other: -take };
  }
  return { self: 0, other: 0 };
}

/// Play `rounds` rounds of the toy, deterministically. Dead players (capacity ≤ 0) act no more
/// and yield nothing.
export function play(a: Strategy, b: Strategy, rounds: number, p: GameParams): GameResult {
  let capA = p.initialCapacity;
  let capB = p.initialCapacity;
  let deadA: number | null = null;
  let deadB: number | null = null;
  let lastA: Move | null = null;
  let lastB: Move | null = null;

  for (let r = 1; r <= rounds; r++) {
    const aliveA = deadA === null;
    const aliveB = deadB === null;
    if (!aliveA && !aliveB) break;
    const mA: Move | null = aliveA ? moveOf(a, lastB) : null;
    const mB: Move | null = aliveB ? moveOf(b, lastA) : null;

    // resolve simultaneously against start-of-round capacities
    const rA = resolveMove(mA, aliveB, capB, p);
    const rB = resolveMove(mB, aliveA, capA, p);
    capA += rA.self + rB.other;
    capB += rA.other + rB.self;
    if (deadA === null && capA <= 0) {
      capA = 0;
      deadA = r;
    }
    if (deadB === null && capB <= 0) {
      capB = 0;
      deadB = r;
    }
    lastA = mA ?? lastA;
    lastB = mB ?? lastB;
  }
  return { finalA: capA, finalB: capB, deadA, deadB, rounds };
}

/// Total value in the pair at game end — what the relationship (coalition, marriage, society)
/// holds after `rounds`. Production compounds it; lossy extraction burns it.
export function pairTotal(r: GameResult): number {
  return r.finalA + r.finalB;
}

/// Round-robin score of a strategy against a field (including itself), summed over `rounds`-round
/// matches — the Axelrod tournament shape. Higher = fitter in this population.
export function tournamentScore(s: Strategy, field: readonly Strategy[], rounds: number, p: GameParams): number {
  let score = 0;
  for (const opp of field) score += play(s, opp, rounds, p).finalA;
  return score;
}
