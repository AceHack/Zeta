namespace Zeta.Core

open System

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
///
/// **Measure, don't model (Aaron + Otto 2026-08-27).** `TsirelsonLatency = √2` is neither derived
/// nor fitted — it is the toy curve's solve, **to be measured**. What *is* measured: `S=4` at
/// `L=0` / full seed control (`BellTest.chshOf ±1`). That is consistent, not anomalous: the
/// common seed makes parties measurement-dependent (the free-choice premise fails). `2√2` is a
/// **predicted degradation floor** under real latency/jitter (Reticulum vs toy network).
/// `IScheduler` quarantines host-clock entropy so a drop is attributable to the network.
/// Two agents with a FourCorner throttle *approaching* `2√2` is an assumption, not a
/// measurement. Occupancy `2 × √2` lining up with Tsirelson is numerology.
///
/// **Jitter is dual-use (Aaron + Otto 2026-08-27).** The same variable sits on both
/// sides of the ledger: it *degrades* seed-shared S=4 **and** is the entropy an
/// agent **captures into frost** for uniqueness among peers. Not a nuisance to
/// minimise — the medium the dance trades in (`dual-use-detection-is-neutral`).
/// So √2 / 2√2 may not be a *latency* threshold at all: capture rate or frost
/// storage size can be the controlling axis. A sweep that varies only network
/// conditions is **underpowered by construction** — a null would mean nothing.
/// Decorrelation is plural (Alexa owns the thread): bus delay is the *journey*
/// (transient); lasting belief-decorrelation needs different sensory inputs
/// (`docs/research/2026-07-04-ferry-alexa-egg-bus-delay-*` FIG8). Host-clock
/// entropy is quarantined by `IScheduler`; what remains is attributable.
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

    /// **The latency that sets `maxChsh` to exactly `2√2` (Tsirelson) — it is `√2`** (Aaron 2026-06-08).
    /// Solve `2 + 2/(1+L) = 2√2` ⇒ `1+L = 1/(√2−1) = √2+1` ⇒ `L = √2`. **Honest caveat:** this clean `√2`
    /// is *contingent on the `1/(1+latency)` attenuation modeling choice* (see `attenuation` — flagged a
    /// modeling choice, not derived). A different attenuation form gives a different Tsirelson-crossing latency,
    /// so `√2` is "the Tsirelson point *of this model*", an artifact of the chosen curve — elegant, not fundamental.
    let TsirelsonLatency = sqrt 2.0

    /// Invert the model: the latency at which `maxChsh = targetChsh`, for `2 < target < 4`. `L = 2/(target−2) − 1`.
    /// `None` outside the achievable open interval `(2, 4)` (classical floor / algebraic ceiling are limits, not hit).
    let latencyFor (targetChsh: float) : float option =
        if targetChsh <= ClassicalBound + 1e-12 || targetChsh >= AlgebraicMax - 1e-12 then None
        else Some(2.0 / (targetChsh - ClassicalBound) - 1.0)

    /// The correlation regime a channel of this `latency` sits in (given the model's attenuation):
    /// **Classical** (`maxChsh ≤ 2`, e.g. git-over-commits — high latency), **Quantum** (`2 < maxChsh ≤ 2√2`,
    /// the physical no-signalling band), **Signalling** (`maxChsh > 2√2`, super-quantum / PR-box — the channel
    /// is effectively communicating). The honest read of a measured S: which band the channel's speed allows.
    type Regime =
        | Classical
        | Quantum
        | Signalling

    /// Classical band tolerance: `maxChsh` asymptotes to 2 but never hits it (finite latency), so "Classical"
    /// means "within `ClassicalEps` of 2" — practically indistinguishable from shared-randomness.
    [<Literal>]
    let ClassicalEps = 1e-5

    let regimeOf (latency: float) : Regime =
        let s = maxChsh latency
        if s <= ClassicalBound + ClassicalEps then Classical
        elif s <= Tsirelson + 1e-9 then Quantum
        else Signalling

    // ── Claim register: measured vs toy vs to-be-measured ─────────────
    // Otto 2026-08-27: "derived or fitted?" was the wrong question. Neither —
    // measure. S=4 is the seed-shared result. 2√2 is a predicted floor.

    type ChshClaim =
        /// A value with a named condition that a test already stages.
        | Measured of s: float * condition: string
        /// `maxChsh(L)` on the `1/(1+L)` curve. Can fail if the formula changes.
        | ToyModel of s: float * latency: float
        /// Predicted floor; no network sweep is attached yet.
        | UnmeasuredPredictedFloor of s: float * reason: string

    /// Measured: `L=0` / full seed control stages S=4. Not a Tsirelson
    /// violation — the free-choice premise does not hold for seed-shared agents.
    let measuredSeedSharedS4 : ChshClaim =
        Measured(
            AlgebraicMax,
            "L=0 toy or BellTest.chshOf ±1; common seed; measurement-dependent"
        )

    /// Toy curve at a latency. Not a network measurement.
    let toyAt (latency: float) : ChshClaim = ToyModel(maxChsh latency, latency)

    /// 2√2 as a predicted floor. Not a latency threshold by default:
    /// capture rate / frost storage may control. Latency-only sweep is
    /// underpowered. Not occupancy 2×√2.
    let tsirelsonFloorToBeMeasured : ChshClaim =
        UnmeasuredPredictedFloor(
            Tsirelson,
            "predicted floor; not occupancy 2x sqrt2; latency-only sweep underpowered; jitter is dual-use frost capture"
        )

    /// Neutral fact about jitter. Readings are caller policy (dual-use).
    type JitterFact =
        | JitterPresent

    /// Two honest readings of the same jitter. Neither is the verdict.
    type JitterReading =
        | CorrelationDegradation
        | FrostUniquenessCapture

    let jitterDualReadings : JitterReading list =
        [ CorrelationDegradation; FrostUniquenessCapture ]

    /// Living inventory of decorrelation *channels*. Alexa owns the
    /// thread (`decorrelation-harness.ts`). Completeness is unproven —
    /// we keep finding more (system prompt, selected model, …). This
    /// list is a snapshot for metering, never a closed roster.
    type ChannelRegister =
        | Proven
        | Measured
        | Candidate
        | Hypothesized
        | ReferenceCeiling

    type DecorrelationChannel =
        { Name: string
          Register: ChannelRegister }

    /// Snapshot of channels we already name. NOT exhaustive.
    let knownDecorrelationChannels : DecorrelationChannel list =
        [ { Name = "hat-producer-vs-verifier"; Register = Proven }
          { Name = "model-family"; Register = Measured }
          { Name = "selected-model"; Register = Measured }
          { Name = "prompt-frame"; Register = Candidate }
          { Name = "system-prompt"; Register = Candidate }
          { Name = "network-latency-jitter"; Register = Candidate }
          { Name = "sensory-input-diversity"; Register = Candidate }
          { Name = "memory-on-load"; Register = Hypothesized }
          { Name = "quantization"; Register = Hypothesized }
          { Name = "seed"; Register = Hypothesized }
          { Name = "temperature"; Register = Hypothesized }
          { Name = "persona"; Register = Hypothesized }
          { Name = "frost-capture-rate"; Register = Hypothesized }
          { Name = "frost-storage-size"; Register = Hypothesized }
          { Name = "host-clock-entropy"; Register = Hypothesized }
          { Name = "vendor"; Register = Hypothesized }
          { Name = "trainset"; Register = Hypothesized }
          { Name = "menu-order"; Register = ReferenceCeiling } ]

    /// Completeness is unproven. Alexa is still finding channels.
    let inventoryClaimsExhaustiveness = false

    let knownChannelNames : string list =
        knownDecorrelationChannels
        |> List.map (fun c -> c.Name)

    let hasKnownChannel (name: string) : bool =
        knownChannelNames
        |> List.exists (fun n -> String.Equals(n, name, StringComparison.Ordinal))

    /// A sweep that varies only `varied` is underpowered vs the *known*
    /// snapshot. Even covering every known name does not make the
    /// inventory exhaustive.
    let sweepIsUnderpowered (varied: string list) : bool =
        let named = Set.ofList knownChannelNames
        let v = Set.ofList varied
        not (Set.isEmpty (Set.difference named v))
