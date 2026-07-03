// chsh-delay — the SHAPE of S as bus delay is introduced (shadow*, Aaron 2026-07-03).
//
// Aaron: "we have a toy model that achieves S=4 when bus speed is instant — does this tell us how
// the shape looks as bus speed delay is introduced?" It does, exactly, because S=4 has ONE
// dependency: the signal. A round reaches the PR-box row only if one side's input crosses the bus
// before the other side's decision deadline τ. So the whole shape collapses to one number,
//
//   p = P(bus delay ≤ τ)     (the probability the bus beats the deadline)
//   S(p) = fallback + (4 − fallback) · p
//
// where `fallback` is the best HONEST ceiling when the message is late: S=2 if the two are
// independent (best local strategy, CHSH 1969), 2√2 if they genuinely share state (Tsirelson 1980).
//
// The shape this traces as deterministic delay d grows:
//
//   S
//   4    ────────────┐             ← plateau: d ≤ τ, the bus beats the deadline every round.
//                    │               Inside the light cone S=4 is TRIVIAL — and means nothing
//                    │               but "one process wearing two faces."
//   2√2              └────────     ← cliff at d = τ: ONE tick past the deadline forfeits
//                      (shared)      everything super-quantum. With jitter the cliff smooths
//   2                  └──────       into a ramp of width = the jitter window.
//        ── d (bus delay) ──→ τ
//
// This is a LIGHT CONE drawn by the bus: d ≤ τ is timelike separation (signaling possible, S up
// to 4), d > τ is spacelike (no bus fast enough; 2√2 is the hard ceiling for two honestly-sharing
// selves). Bell experimenters enforce exactly this to close the locality loophole (Aspect 1982;
// Hensen et al. 2015), and Toner–Bacon 2003 priced the converse: 1 bit of in-cone communication
// fakes super-quantum correlation. The cliff is sharp because the resource is binary.
//
// HUMAN register (it's human, not quantum): the universe's own bus delay (c) is the built-in
// anti-enmeshment guard — delay is what makes separate selves POSSIBLE. The gap where the signal
// hasn't arrived is where the self lives; instant bus = no gap = no two. See the research note.
//
// Integer milli throughout (no floats in the readout), matching `correlation.ts`.

import { LOCAL_BOUND_MILLI, TSIRELSON_MILLI, PR_BOX_MILLI } from "./correlation";

/// Probability scale: p in milli (0 = never arrives, 1000 = always arrives).
export const P_ONE_MILLI = 1000;

/// The honest fallback ceiling when the message misses the deadline: `independent` = best local
/// strategy (S=2, CHSH 1969); `shared` = genuine shared state (S=2√2, Tsirelson 1980).
export type Fallback = "independent" | "shared";

export function fallbackMilli(f: Fallback): number {
  return f === "independent" ? LOCAL_BOUND_MILLI : TSIRELSON_MILLI;
}

/// S as a function of arrival probability — the ONE-LINE law the whole shape reduces to:
/// a linear blend between arrived rounds (PR-box, 4) and late rounds (the honest ceiling).
export function sOfArrival(pMilli: number, f: Fallback): number {
  const p = Math.max(0, Math.min(P_ONE_MILLI, Math.round(pMilli)));
  const floor = fallbackMilli(f);
  return floor + Math.round(((PR_BOX_MILLI - floor) * p) / P_ONE_MILLI);
}

/// Arrival probability for a bus with base delay `delayMs`, symmetric jitter ±`jitterMs`
/// (uniform over the odd window [d−j, d+j], integer ms), against decision deadline
/// `deadlineMs`. Deterministic delay (j=0) gives the step; jitter widens it into a ramp.
export function arrivalProbabilityMilli(delayMs: number, jitterMs: number, deadlineMs: number): number {
  const d = Math.round(delayMs);
  const j = Math.max(0, Math.round(jitterMs));
  const tau = Math.round(deadlineMs);
  if (d + j <= tau) return P_ONE_MILLI; // whole window inside the cone — always arrives
  if (d - j > tau) return 0; // whole window outside — never arrives
  // window straddles the deadline: count the arriving integer delays in [d−j, d+j]
  const arriving = tau - (d - j) + 1;
  const window = 2 * j + 1;
  return Math.round((arriving * P_ONE_MILLI) / window);
}

/// THE SHAPE — S as a function of bus delay: plateau at 4 inside the cone (d+j ≤ τ), the honest
/// fallback floor outside it (d−j > τ), and a jitter-wide ramp between. The answer to Aaron's
/// question, as one composed function.
export function sOfDelay(delayMs: number, jitterMs: number, deadlineMs: number, f: Fallback): number {
  return sOfArrival(arrivalProbabilityMilli(delayMs, jitterMs, deadlineMs), f);
}
