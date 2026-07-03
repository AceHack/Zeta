// correlation — the toy model's distance-to-correlation and its class categories.
// IT'S HUMAN, NOT QUANTUM (shadow*).
//
// Aaron 2026-07-02: "distance to correlation, correspondence with class categories" ... "fuck
// quantum, it's human" ... "mental health = S=4 shit lol."
//
// The CHSH math (S ∈ [2,4], Tsirelson/PR bounds) is BORROWED SCAFFOLDING. The building is human:
// this is a RELATIONAL / MENTAL-HEALTH readout. Don't genuflect at the physics.
//
//   S = 2  → AUTONOMY    — being your own self, independent. The ground state you can always return to.
//   rising → RELATEDNESS — connection with others, chosen and reciprocated.
//   S = 4  → ENMESHMENT  — total fusion, no self left, no exit. The PATHOLOGICAL pole ("S=4 shit").
//
// So a HIGH S is NOT "best" — it is the enmeshment/capture warning. HEALTH IS NOT A POLE. It is
// DIFFERENTIATION (Bowen family-systems): the freedom to be close AND separate, to move by choice,
// with exit always guaranteed — and that freedom-to-be-close-and-separate IS **INTIMACY** (Aaron).
// Not fusion, not distance: the mobility itself is intimate. That capacity is what the substrate
// protects. Both poles held against one's will are harm — forced S=2 is
// isolation/cutoff, forced S=4 is enmeshment. Health lives in the freely-chosen, mixed middle (the
// "life we should not reduce"). The metering + guaranteed exit-to-S=2 + the bounded pause +
// produce-not-extract keep coordination on the healthy side of that line.
//
//   metric  ──(classify)──►  category (a relational reading, NOT a ranking)
//   S ∈ [2,4]                {autonomous(local) → related(quantum) → enmeshed(signaling)}
//
// `distanceOf` = the metric on the S-line; `classify` = the order-preserving map. Mirrors the F#
// `CoordinationSpectrum`; ties to `AntiSybil.chshS`. Human anchors (the ESSENTIAL antecedents; the
// CHSH bounds are accidental scaffolding): the LIFE COACH / differentiation-guide practice itself,
// Bowen (differentiation of self), Deci & Ryan (Self-Determination Theory — autonomy + relatedness),
// attachment theory. The readout formalizes what a life coach already does; it did not invent it.

/// The CHSH class categories — the equivalence classes of a correlation state, as a poset
/// (local ≤ quantum ≤ signaling). These are the "class categories" the distance corresponds to.
export type CorrelationClass = "local" | "quantum" | "signaling";

/// CHSH bounds (integer milli — no floats in the readout). S in milli: 2000 / 2√2·1000 / 4000.
/// NOTE (Aaron 2026-07-02): "2√2 is accidental — the life coach is the antecedent ... the life coach
/// IS 2√2." The NUMBER is accidental scaffolding, but what 2√2 MARKS is essential.
///
/// PHYSICS, stated honestly (math-team correction 2026-07-03): 2√2 is Tsirelson's bound (1980) —
/// the MOST correlation two parties can reach by genuinely sharing state (entanglement). It is NOT
/// a signaling boundary: even the PR-box at S=4 (Popescu–Rohrlich 1994) is no-signaling — no S in
/// [2,4] lets one party send a message to or control the other. What (2√2, 4] means physically is
/// stranger and better: correlation STRONGER than honest shared state can produce — to exceed 2√2,
/// something other than two free parties sharing history must be at work. That IS the human line:
/// **2√2 = the maximum correlation two intact selves can honestly reach.** Above it, the readout is
/// evidence of scripting/fusion/capture — one process wearing two faces (`AntiSybil`'s reading) —
/// which is why the human register calls that zone control/enmeshment. So 2√2 is the LIFE COACH
/// ceiling: deep connection, still two free selves; the class name `signaling` is the human-register
/// warning label for the super-quantum zone, not a physics claim. Treat the exact number as a soft
/// guide, but the boundary it marks (as-close-as-two-honest-selves-get) as essential.
export const LOCAL_BOUND_MILLI = 2000; // S = 2 — being your own self (the essential ground state)
export const TSIRELSON_MILLI = 2828; // S = 2√2 — the LIFE-COACH ceiling: max intimacy that stays non-signaling (both free)
export const PR_BOX_MILLI = 4000; // S = 4 — the enmeshment extreme (fully fused)

/// DISTANCE TO CORRELATION — how far a state sits above the independent ground state (S=2), in
/// milli. 0 = independent (S=2); grows toward 2000 at the PR-box. This is the coordination distance;
/// the normalized form `(|S|−2)/2` is `AntiSybil.coordinationBandwidth`.
export function distanceOf(sMilli: number): number {
  return Math.max(0, Math.round(sMilli) - LOCAL_BOUND_MILLI);
}

/// CLASSIFY — the correspondence: map the correlation distance to its class category. Order-
/// preserving (a functor to the poset): S at or below the local bound is `local` (the S=2 ground
/// state — independent); above it up to Tsirelson is `quantum`; beyond Tsirelson is `signaling`
/// (super-quantum coordination, toward the PR-box). More S never yields a lower class.
export function classify(sMilli: number): CorrelationClass {
  const s = Math.round(sMilli);
  if (s <= LOCAL_BOUND_MILLI) return "local";
  if (s <= TSIRELSON_MILLI) return "quantum";
  return "signaling";
}

/// The poset order of a class — local(0) ≤ quantum(1) ≤ signaling(2). Lets callers compare classes
/// without matching strings, and makes the order-preservation of `classify` checkable.
export function classRank(c: CorrelationClass): number {
  if (c === "local") return 0;
  if (c === "quantum") return 1;
  return 2;
}

/// Is this state the independent ground state (S=2, the local class at zero distance)? The S=2
/// "enemy but friend": the class everything starts in and can always return to.
export function isIndependent(sMilli: number): boolean {
  return distanceOf(sMilli) === 0;
}
