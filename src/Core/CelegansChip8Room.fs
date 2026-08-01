namespace Zeta.Core
/// **`CelegansChip8Room` — *C. elegans* worm wired as Oracle 7 `BeliefEstimator`
/// into `Chip8PredictionRoom`.**
///
/// The worm is a drop-in substitute for `Chip8Observer`'s `ReflectionEngine`-based
/// belief estimator. Both satisfy `Chip8PredictionRoom.BeliefEstimator`:
///
///   `InterruptKind -> Chip8Cow.Frame -> ReflectionEngine.Belief`
///
/// The worm ignores `InterruptKind` (it has no concept of interrupts — it only sees
/// pixels). The display pixels are injected into the 302-neuron Kuramoto oscillator
/// network; the motor neuron synchrony (order parameter r) determines the belief
/// distribution over input branches.
///
/// **Multi-observer architecture:**
/// `Chip8PredictionRoom.timerHandlerWithPriority` takes a single `BeliefEstimator`.
/// To run the worm and the AI observer simultaneously, fuse their beliefs with a
/// Condorcet-weighted average (see `OracleTransport.condorcetPosterior`):
///
///   let fusedBelief intr frame =
///       let aiB   = Chip8Observer.defaultBelief intr frame
///       let wormB = wormCtrl.BeliefEstimator intr frame
///       OracleTransport.fuseBeliefs [aiB; wormB]
///
/// The fused belief is the Kalman posterior over two independent observers.
/// The worm's L (decorrelation delay) is its Kuramoto relaxation time (~50 ticks),
/// so ρ_worm ≈ 1/(1+50) ≈ 0.02 — deep in the Classical/Independent regime.
///
/// **Sensor fusion proof:**
/// If the fused belief produces the same DLA fractal dimension as the computational
/// oracles (Canvas, CSS, Chip-8, SVG, Q#), the identity eigenvector is
/// substrate-independent across biological and computational substrates.
[<RequireQualifiedAccess>]
module CelegansChip8Room =

    open System

    /// Default connectome CSV path (relative to repo root).
    /// The White 1986 whole connectome — 2,960 edges, 302 neurons.
    let defaultConnectomePath = "src/Core/data/celegans-connectome-chemical.csv"

    /// Build a worm-only room — the worm is the sole belief estimator.
    /// The worm observes the Chip-8 display and drives the prediction scheduler.
    let wormRoom
        (name: string)
        (rom: byte[])
        (tank: SoftThrottle.Tank)
        (cyclesPerTick: int)
        (budget: int)
        (source: int64 -> SoftScheduler.Source)
        (resolved: Chip8PredictionRoom.State -> bool)
        (costOf: Chip8PredictionRoom.BranchCostEstimator)
        (csvPath: string)
        (seed: uint64)
        : SimFramework.RoomK<Chip8PredictionRoom.State> =
        let ctrl = CelegansController.create csvPath seed
        Chip8PredictionRoom.room
            name rom tank cyclesPerTick budget source resolved
            ctrl.BeliefEstimator
            costOf

    /// Build a fused room — the worm and the AI observer both contribute beliefs.
    /// The fused belief is a Condorcet-weighted average of the two independent observers.
    ///
    /// The AI observer has ρ_ai ≈ 0.1 (10-tick lookahead).
    /// The worm has ρ_worm ≈ 0.02 (50-tick Kuramoto relaxation).
    /// The fused posterior weights the worm more heavily (lower ρ = more independent).
    let fusedRoom
        (name: string)
        (rom: byte[])
        (tank: SoftThrottle.Tank)
        (cyclesPerTick: int)
        (budget: int)
        (source: int64 -> SoftScheduler.Source)
        (resolved: Chip8PredictionRoom.State -> bool)
        (costOf: Chip8PredictionRoom.BranchCostEstimator)
        (aiBelief: Chip8PredictionRoom.BeliefEstimator)
        (csvPath: string)
        (seed: uint64)
        : SimFramework.RoomK<Chip8PredictionRoom.State> =
        let ctrl = CelegansController.create csvPath seed
        // Condorcet weights: w_i = 1/(1+ρ_i) normalized.
        // AI: ρ ≈ 0.1 → w_ai ≈ 0.909
        // Worm: ρ ≈ 0.02 → w_worm ≈ 0.980
        // Normalized: w_worm ≈ 0.519, w_ai ≈ 0.481
        let rhoAi   = 0.10
        let rhoWorm = 0.02
        let wAi   = 1.0 / (1.0 + rhoAi)
        let wWorm = 1.0 / (1.0 + rhoWorm)
        let wTotal = wAi + wWorm
        let fusedBelief (intr: InterruptKind) (frame: Chip8Cow.Frame) : ReflectionEngine.Belief =
            let aiB   = aiBelief intr frame
            let wormB = ctrl.BeliefEstimator intr frame
            // Weighted average of the two belief distributions.
            // ReflectionEngine.Belief is ProbabilitySemiring.Rational[] over input branches.
            // The fused belief is the Condorcet-weighted sum, renormalized.
            let n = min aiB.Length wormB.Length
            if n = 0 then aiB
            else
                let wAiR   = ProbabilitySemiring.rat (int64 (wAi   * 1000.0)) 1000L
                let wWormR = ProbabilitySemiring.rat (int64 (wWorm * 1000.0)) 1000L
                let wTotalR = ProbabilitySemiring.add wAiR wWormR
                let fused = Array.init n (fun i ->
                    ProbabilitySemiring.add
                        (ProbabilitySemiring.mul wAiR   aiB.[i])
                        (ProbabilitySemiring.mul wWormR wormB.[i]))
                // Renormalize to sum to 1.
                let s = Array.fold ProbabilitySemiring.add ProbabilitySemiring.zero fused
                if s.Num > 0L then
                    Array.map (fun x -> ProbabilitySemiring.mul x (ProbabilitySemiring.recip s)) fused
                else fused
        Chip8PredictionRoom.room
            name rom tank cyclesPerTick budget source resolved
            fusedBelief
            costOf

    /// Run the worm as a standalone DLA oracle (no Chip-8 VM required).
    /// Feeds DLA growth frames directly to the worm's display injection.
    /// Returns the order parameter trace: (tick, r, clusterSize).
    let runDlaOracle
        (csvPath: string)
        (seed: uint64)
        (dlaFrames: Map<int,bool>[])
        : (int * float * int) [] =
        let connectome = CelegansController.loadFromCsv csvPath
        CelegansController.runDlaOracle connectome seed dlaFrames
