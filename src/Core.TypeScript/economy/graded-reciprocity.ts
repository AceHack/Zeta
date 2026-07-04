// graded-reciprocity — TIT FOR LESSER TAT: Aaron's strategy, proven in-toy (shadow*, 2026-07-04).
//
// Aaron, verbatim, answering the honest register caveat on latency incentive-compatibility
// ("not a universal game-theory theorem"): "tit for lessor tat, teach, play is, this is mine."
//
// The strategy, named and claimed: respond to every tat — but with a LESSER tit. Not Axelrod's
// tit-for-tat (equal retaliation: feuds echo forever under noise), not Nowak–Sigmund's generous
// TFT (probabilistic non-response), but DAMPED reciprocity: deterministic response at reduced
// magnitude, plus TEACH (the response is legible — a lesson, not vengeance) and PLAY (the game
// never goes terminal — high-school rules; nobody is destroyed, everyone is re-enrolled).
//
// The mathematical teeth (register B, in-toy): with damping λ < 1, a mutual-retaliation echo is
// the sequence m_{n+1} = λ·m_n — a CONTRACTION (Banach): every feud decays geometrically to the
// cooperation fixed point 0. λ = 1 (classic TFT) preserves noise forever (the well-known echo
// pathology); λ > 1 (escalation) diverges to the cap (vendetta). De-escalation isn't kindness
// at the expense of rigor — it is the unique regime where cooperation is globally attracting.
//
// Register, honestly: these are theorems about THIS toy (graded intensities, deterministic
// strategies). The mapping onto real conflict is C — anchored (Axelrod 1984 noise pathology;
// Nowak & Sigmund 1992 generosity; Boyd 1989 contrition; Banach 1922 the fixed point) — and
// Aaron's TEACH/PLAY halves live in the school-not-court register (bounded stakes as pedagogy).

// Intensities are plain numbers in [0, 1]: 0 = pure cooperation, 1 = maximal defection.
// (No branded alias — the clamp is the discipline.)

export function clampIntensity(m: number): number {
  return Math.max(0, Math.min(1, m));
}

/// A graded strategy maps the opponent's last intensity to a response intensity.
export type GradedStrategy = (opponentLast: number) => number;

/// Classic tit-for-tat: mirror exactly (λ = 1). The echo-preserver.
export const titForTat: GradedStrategy = (m) => clampIntensity(m);

/// TIT FOR LESSER TAT (Aaron's): mirror at damping λ < 1 — always answer, always smaller.
export function titForLesserTat(lambda: number): GradedStrategy {
  const l = clampIntensity(lambda);
  return (m) => clampIntensity(l * m);
}

/// Escalation (the vendetta): mirror at gain λ > 1. Included as the contrast case.
export function titForGreaterTat(lambda: number): GradedStrategy {
  return (m) => clampIntensity(lambda * m);
}

/// Play out a mutual-reciprocity echo: both sides run `strategy`, seeded by one perturbation
/// (a noise event / a wrong) of intensity `seed`. Returns the intensity trajectory.
export function feud(strategy: GradedStrategy, seed: number, rounds: number): number[] {
  const out: number[] = [];
  let m = clampIntensity(seed);
  for (let i = 0; i < rounds; i++) {
    out.push(m);
    m = strategy(m);
  }
  return out;
}

/// Total damage a feud inflicts (sum of intensities) — finite iff the feud contracts.
export function feudCost(trajectory: number[]): number {
  return trajectory.reduce((acc, m) => acc + m, 0);
}

/// TEACH: the lesson is legible iff the response is a monotone non-increasing function of the
/// wrong that never exceeds it — proportionate, bounded, decodable as "this answers that".
/// (A response bigger than the wrong reads as a new wrong — escalation is illegible.)
export function isLegibleLesson(strategy: GradedStrategy, samples = 101): boolean {
  let prev = -Infinity;
  for (let i = 0; i < samples; i++) {
    const wrong = i / (samples - 1);
    const response = strategy(wrong);
    if (response > wrong) return false; // exceeds the wrong: vendetta, not lesson
    if (response < prev - 1e-12) return false; // non-monotone: arbitrary, not decodable
    prev = response;
  }
  return true;
}

/// PLAY: the game stays non-terminal iff no feud trajectory ever saturates at the cap
/// (intensity 1 forever = a war, the game effectively over for both).
export function staysPlayable(strategy: GradedStrategy, seed: number, rounds: number): boolean {
  const t = feud(strategy, seed, rounds);
  const tail = t.slice(-3);
  return !tail.every((m) => m >= 1 - 1e-12);
}
