namespace Zeta.Core

/// **`FeedbackThrottle` — finite feedback-propagation speed caps the achievable CHSH (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"our qubit toy reaches `2√2` (and `S=4`) because it has no light-speed throttle — like a processor
/// with no throttle. The feedback channels are instant. Wire it into the multiplexed WebSocket and the network
/// propagation speed won't allow it, even with the four-corner feedback channels, because they are NOT
/// instant."* This makes that testable in DST.
///
/// **The structure (defensible boundary conditions):**
///   - **Instant feedback (`latency = 0`):** the toy — the feedback channel maintains *any* staged
///     correlation, so CHSH up to the **algebraic max `S=4`** (full real-time control / signalling regime).
///   - **No usable real-time feedback (`latency → ∞`):** only the *pre-shared* seed remains (no real-time
///     correction), so you're back to the **classical local bound `S=2`** (shared randomness only).
///   - **Finite latency interpolates `4 → 2`**, monotonically — and **`2√2` (Tsirelson) is crossed somewhere
///     in between.** So a real (finite-speed) transport *cannot* sit at the toy's `S=4`; the throttle pulls it
///     down toward — and through — the quantum value.
///
/// **Why this matters:** it explains *why the toy overshoots* (instant feedback = no throttle = `S=4`) and
/// predicts that wiring `BellTest`/`CoincidenceClock` through the finite-latency mux-WS transport drops the
/// achievable CHSH below `4`. The feedback channel's propagation speed = our Lamport/heartbeat causal-cone
/// speed (`#7079`), the knob the toy has at ∞. Ties to `FerryThrottler` (the throttle the processor already
/// has; the qubit toy is missing its analog).
///
/// **Honest scope (peel):** the **boundary conditions (`4` at instant, `2` at no-real-time-feedback) and
/// monotonicity** are the content; the **interpolation `attenuation` is a MODELING CHOICE**, not derived (a
/// different attenuation gives a different curve and a different Tsirelson-crossing latency). And finite
/// latency alone only gives a *range* `[2,4]` — **`2√2` is the value Information Causality picks out within
/// that range**, not something the throttle *produces* by itself. So this models *that a throttle caps below
/// `S=4`* (real, Aaron's point); it does **not** derive that the cap is exactly `2√2` (that's IC). Deterministic
/// (DST §7); the "speed" is the feedback-channel propagation rate (heartbeat/Lamport), not literal `c`.
[<RequireQualifiedAccess>]
module FeedbackThrottle =

    /// The classical local-hidden-variable CHSH bound (no real-time feedback; pre-shared only).
    [<Literal>]
    let ClassicalBound = 2.0

    /// Tsirelson's bound (the Information-Causality value within the achievable range).
    let Tsirelson = 2.0 * sqrt 2.0

    /// The algebraic max (instant feedback / full real-time control).
    [<Literal>]
    let AlgebraicMax = 4.0

    /// Feedback effectiveness as a function of propagation `latency` (in ticks / heartbeats): `1` at `0`
    /// (instant), `→ 0` as `latency → ∞`, monotonically decreasing. **Modeling choice** (`1/(1+latency)`);
    /// the boundary values + monotonicity are what's load-bearing, not this exact form.
    let attenuation (latency: float) : float = 1.0 / (1.0 + max 0.0 latency)

    /// The maximum CHSH a system with feedback `latency` can stage: `2 + 2·attenuation` — i.e. `4` at instant
    /// feedback, `→ 2` (classical) as feedback becomes unusably slow. A finite-speed transport sits *below*
    /// the toy's `S=4`.
    let maxChsh (latency: float) : float = ClassicalBound + 2.0 * attenuation latency

    /// Can this latency still reach the *superdeterministic* (supra-Tsirelson) regime? Only when feedback is
    /// fast enough that `maxChsh > 2√2`. Below that latency the toy can overshoot; above it, it cannot.
    let canExceedTsirelson (latency: float) : bool = maxChsh latency > Tsirelson + 1e-12

    /// Does this latency still beat the classical bound at all (any quantum-like correlation maintainable)?
    let canExceedClassical (latency: float) : bool = maxChsh latency > ClassicalBound + 1e-12
