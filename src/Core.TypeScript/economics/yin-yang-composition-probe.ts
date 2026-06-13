// yin-yang-composition-probe.ts
// Smallest safe slice for B-0046.2: pure TS yin-yang gate for Ammous candidate-probe
// Substrate: time/energy denominated; money-extraction excluded.
// Gated by yin-yang: unification + harmonious-division both required.

export type YinYangResult = {
  candidate: string;
  passes: boolean;
  reason: string;
  unificationPole: boolean;
  divisionPole: boolean;
};

export function probeYinYang(candidate: string, description: string): YinYangResult {
  // Minimal operational probe for Ammous Bitcoin-Standard per B-0046
  // Unification: 21M cap, low-time-preference, μένω resonance (staying power)
  const unification = /21M|cap|low.time.preference|μένω|staying|persistence/i.test(description);
  // Division: plural primitives, not monoculture; explicit counterweight required
  const division = /plural|counterweight|among|not THE|co-exist/i.test(description);
  const passes = unification && division;
  return {
    candidate,
    passes,
    reason: passes
      ? "Both poles satisfied — candidate admissible under yin-yang composition"
      : "Missing pole(s) — requires explicit counterweight for admission (retractable)",
    unificationPole: unification,
    divisionPole: division,
  };
}

// Smoke: Ammous probe (candidate status, not admitted)
const ammosProbe = probeYinYang(
  "Ammous Bitcoin-Standard",
  "21M hard cap, low time preference, μένω staying-operator; requires plural monetary primitives counterweight"
);
console.assert(ammosProbe.passes === false, "Ammous should fail without full division pole");
console.assert(!ammosProbe.passes && ammosProbe.unificationPole, "Unification present");
