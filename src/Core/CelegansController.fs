namespace Zeta.Core

/// **`CelegansController` — *C. elegans* connectome as a Chip-8 `BeliefEstimator` (Oracle 7).**
///
/// The 302-neuron hermaphrodite connectome (White et al. 1986, via OpenWorm c302) is loaded as a
/// weighted directed graph. Each neuron is a Kuramoto phase oscillator; chemical synapses and gap
/// junctions provide the coupling. The Chip-8 display (64×32 pixels) is mapped onto the 302 sensory
/// neurons via a spatial receptive-field projection. Motor neuron phases are read out as a belief
/// distribution over Chip-8 input branches (key-down / key-up).
///
/// **Why this is Oracle 7 in the sensor-fusion proof:**
/// The worm has no language model, no training data, no reward function, and no knowledge of DLA or
/// the Tsirelson threshold. Its connectome is fixed (the genome is the specification; the connectome
/// is the compiled output — Layer B / μF / GSet). Its behavior is determined entirely by the visual
/// field and the Kuramoto coupling constants. If the worm's play trajectory produces the same fractal
/// dimension as the six computational oracles, the identity eigenvector is substrate-independent
/// across biological and computational substrates.
///
/// **Honest scope:** this is a Kuramoto mean-field approximation, not a biophysical simulation.
/// The coupling constants are proportional to synapse count (White 1986) but the neuron model is
/// a simple phase oscillator (not Hodgkin-Huxley). This is sufficient for the oracle proof; a
/// full biophysical simulation (OpenWorm Sibernetic) is the next rung.
///
/// **DST discipline:** no float in the proof lineage for the belief output. Phase angles are float
/// (physics); the final belief is normalized exact rational via `ProbabilitySemiring`.
[<RequireQualifiedAccess>]
module CelegansController =

    open System
    open System.IO

    // ── Connectome data types ──────────────────────────────────────────────────

    /// A directed synapse: pre→post with a weight (synapse count).
    type Synapse = { Pre: string; Post: string; Weight: float; IsElectrical: bool }

    /// The loaded connectome: neuron name list + adjacency (sparse).
    type Connectome = {
        Neurons: string[]
        IndexOf: Map<string, int>
        Synapses: Synapse[]
        /// Coupling matrix K[i,j] = sum of synapse weights from j→i (pre→post).
        K: float[,]
    }

    // ── Kuramoto oscillator state ──────────────────────────────────────────────

    /// Per-neuron phase (radians) and natural frequency.
    type OscillatorState = {
        Phase: float[]      // θ_i ∈ [0, 2π)
        Omega: float[]      // ω_i natural frequency (rad/s)
        N: int
    }

    // ── Sensorimotor mapping ───────────────────────────────────────────────────

    /// The 302 neurons are partitioned into three functional groups for the Chip-8 interface:
    ///   - Sensory (AFD, ASE, AWC, …): receive visual input from the display
    ///   - Interneuron (AIY, AIZ, RIA, …): propagate via Kuramoto
    ///   - Motor (VA, VB, DA, DB, AS, …): output → belief over key-down/key-up
    ///
    /// Partition is based on WormAtlas functional classification (simplified).
    let private sensoryPrefixes = [| "AF"; "AS"; "AW"; "PH"; "IL"; "OL"; "CE" |]
    let private motorPrefixes   = [| "VA"; "VB"; "VC"; "VD"; "DA"; "DB"; "DD"; "AS"; "MU" |]

    let private isSensory (name: string) =
        sensoryPrefixes |> Array.exists (fun p -> name.StartsWith(p, StringComparison.OrdinalIgnoreCase))
    let private isMotor (name: string) =
        motorPrefixes |> Array.exists (fun p -> name.StartsWith(p, StringComparison.OrdinalIgnoreCase))

    // ── Connectome loader ──────────────────────────────────────────────────────

    /// Parse the White 1986 whole-connectome CSV (aconnectome_white_1986_whole.csv).
    /// Format: pre, post, type (chemical|electrical), synapses
    let private parseSynapses (csvText: string) : Synapse[] =
        csvText.Split('\n')
        |> Array.skip 1  // header: pre,post,type,synapses
        |> Array.choose (fun line ->
            let parts = line.Trim().Split('\t')
            if parts.Length >= 4 then
                match Double.TryParse(parts.[3].Trim()) with
                | true, w when w > 0.0 ->
                    Some { Pre = parts.[0].Trim()
                           Post = parts.[1].Trim()
                           Weight = w
                           IsElectrical = parts.[2].Trim().ToLowerInvariant() = "electrical" }
                | _ -> None
            else None)

    /// Build the connectome from the parsed synapse list.
    let buildConnectome (synapses: Synapse[]) : Connectome =
        let neurons =
            synapses
            |> Array.collect (fun s -> [| s.Pre; s.Post |])
            |> Array.distinct
            |> Array.sort
        let indexOf = neurons |> Array.mapi (fun i n -> n, i) |> Map.ofArray
        let n = neurons.Length
        let k = Array2D.zeroCreate<float> n n
        for s in synapses do
            match Map.tryFind s.Pre indexOf, Map.tryFind s.Post indexOf with
            | Some i, Some j ->
                // Chemical: directed j→i coupling; electrical: bidirectional
                k.[j, i] <- k.[j, i] + s.Weight
                if s.IsElectrical then k.[i, j] <- k.[i, j] + s.Weight
            | _ -> ()
        // Normalize each row so max coupling = 1.0
        for i in 0 .. n-1 do
            let rowMax = [ for j in 0..n-1 -> k.[i,j] ] |> List.max
            if rowMax > 0.0 then
                for j in 0..n-1 do k.[i,j] <- k.[i,j] / rowMax
        { Neurons = neurons; IndexOf = indexOf; Synapses = synapses; K = k }

    /// Load the connectome from the embedded CSV path (relative to the assembly location).
    let loadFromCsv (csvPath: string) : Connectome =
        // Size cap before read — a poisoned/oversized CSV must not exhaust the heap
        // (the sanctioned pattern; cf. the Checkpoint.fs stream loader).
        let info = FileInfo csvPath
        let maxMiB = 64L
        let maxBytes = maxMiB * 1024L * 1024L
        if info.Length > maxBytes then
            invalidArg (nameof csvPath) (sprintf "connectome CSV '%s' is %d bytes — exceeds the %d MiB load cap" csvPath info.Length maxMiB)
        // nosemgrep: file-read-without-size-cap -- guarded by the FileInfo.Length cap immediately above
        let text = File.ReadAllText(csvPath)
        buildConnectome (parseSynapses text)

    // ── Oscillator initialization ──────────────────────────────────────────────

    /// Initialize the Kuramoto state from a seed.
    /// Natural frequencies are drawn from a narrow Gaussian (σ=0.1 rad/s around 1.0 rad/s)
    /// to model the worm's ~1 Hz body-wave oscillation.
    let initOscillator (seed: uint64) (n: int) : OscillatorState =
        // Use SplitMix64.mix as a deterministic sequence generator:
        // mix(seed + i*GoldenRatio) gives a well-distributed sequence for each index.
        let hashFloat (s: uint64) (i: int) =
            let h = SplitMix64.mix (s + uint64 i * SplitMix64.GoldenRatio)
            float h / float System.UInt64.MaxValue
        let phase = Array.init n (fun i -> hashFloat seed i * 2.0 * Math.PI)
        let omega = Array.init n (fun i -> 1.0 + 0.1 * (hashFloat (seed + 1UL) i - 0.5))
        { Phase = phase; Omega = omega; N = n }

    // ── Sensory input injection ────────────────────────────────────────────────

    /// Map the Chip-8 display (64×32 = 2048 pixels) onto sensory neurons.
    /// Each sensory neuron gets a receptive field: a rectangular patch of the display.
    /// The patch mean brightness is added as a phase perturbation (external drive).
    let injectDisplay (display: Map<int,bool>) (connectome: Connectome) (osc: OscillatorState) : OscillatorState =
        let sensoryIdx =
            connectome.Neurons
            |> Array.mapi (fun i n -> i, n)
            |> Array.filter (fun (_, n) -> isSensory n)
            |> Array.map fst
        let nSensory = sensoryIdx.Length
        if nSensory = 0 then osc
        else
            // Divide the 64×32 display into nSensory receptive fields (column strips)
            let stripW = max 1 (64 / nSensory)
            let newPhase = Array.copy osc.Phase
            for k in 0 .. nSensory - 1 do
                let x0 = k * stripW
                let x1 = min 64 (x0 + stripW)
                let mutable lit = 0
                let mutable total = 0
                for y in 0 .. 31 do
                    for x in x0 .. x1 - 1 do
                        total <- total + 1
                        if Map.tryFind (y * 64 + x) display |> Option.defaultValue false then
                            lit <- lit + 1
                let brightness = if total > 0 then float lit / float total else 0.0
                // External drive: bright pixels advance phase by up to π/4
                newPhase.[sensoryIdx.[k]] <- newPhase.[sensoryIdx.[k]] + brightness * Math.PI / 4.0
            { osc with Phase = newPhase }

    // ── Kuramoto integration step ──────────────────────────────────────────────

    /// One Euler step of the Kuramoto model:
    ///   dθ_i/dt = ω_i + (K/N) Σ_j K[i,j] sin(θ_j - θ_i)
    /// dt = 0.05 s (20 Hz update, matching the Chip-8 timer tick).
    let private dt = 0.05

    let step (connectome: Connectome) (osc: OscillatorState) : OscillatorState =
        let n = osc.N
        let newPhase = Array.copy osc.Phase
        for i in 0 .. n-1 do
            let mutable coupling = 0.0
            for j in 0 .. n-1 do
                let kij = connectome.K.[i,j]
                if kij > 0.0 then
                    coupling <- coupling + kij * Math.Sin(osc.Phase.[j] - osc.Phase.[i])
            newPhase.[i] <- osc.Phase.[i] + dt * (osc.Omega.[i] + coupling / float n)
            // Wrap to [0, 2π)
            newPhase.[i] <- newPhase.[i] % (2.0 * Math.PI)
            if newPhase.[i] < 0.0 then newPhase.[i] <- newPhase.[i] + 2.0 * Math.PI
        { osc with Phase = newPhase }

    /// Run `steps` Kuramoto integration steps (warm-up / transient removal).
    let warmUp (connectome: Connectome) (steps: int) (osc: OscillatorState) : OscillatorState =
        let mutable s = osc
        for _ in 1 .. steps do s <- step connectome s
        s

    // ── Motor readout → BeliefEstimator ───────────────────────────────────────

    /// Read the motor neuron phases and produce a belief over Chip-8 input branches.
    /// The belief is a 2-element array [P(key-down), P(key-up)] normalized to sum 1.
    ///
    /// Motor readout: the mean cosine of motor neuron phases relative to the global
    /// mean phase. cos > 0 → key-down (excitatory); cos < 0 → key-up (inhibitory).
    let motorReadout (connectome: Connectome) (osc: OscillatorState) : ReflectionEngine.Belief =
        let motorIdx =
            connectome.Neurons
            |> Array.mapi (fun i n -> i, n)
            |> Array.filter (fun (_, n) -> isMotor n)
            |> Array.map fst
        if motorIdx.Length = 0 then
            // Fallback: uniform belief (no motor neurons found)
            [| ProbabilitySemiring.rat 1L 2L; ProbabilitySemiring.rat 1L 2L |]
        else
            // Global mean phase (order parameter)
            let meanPhase =
                let sumSin = osc.Phase |> Array.sumBy Math.Sin
                let sumCos = osc.Phase |> Array.sumBy Math.Cos
                Math.Atan2(sumSin, sumCos)
            // Motor mean cosine relative to global mean
            let motorCos =
                motorIdx
                |> Array.map (fun i -> Math.Cos(osc.Phase.[i] - meanPhase))
                |> Array.average
            // Map motorCos ∈ [-1, 1] → P(key-down) ∈ [0.1, 0.9]
            let pDown = 0.5 + 0.4 * motorCos  // linear, bounded away from 0/1
            let pDown = max 0.05 (min 0.95 pDown)
            let pUp = 1.0 - pDown
            // Convert to exact rational (denominator 100 — sufficient precision for oracle use)
            let toRat (x: float) =
                let num = int64 (Math.Round(x * 100.0))
                ProbabilitySemiring.rat num 100L
            [| toRat pDown; toRat pUp |]

    // ── Stateful controller ────────────────────────────────────────────────────

    /// A mutable controller that holds the oscillator state across Chip-8 frames.
    /// Thread-safety: single-threaded use only (matches the Chip-8 scheduler contract).
    type Controller(connectome: Connectome, seed: uint64) =
        let mutable osc = initOscillator seed connectome.Neurons.Length |> warmUp connectome 200

        /// Update the oscillator with the current display state and return the belief.
        /// Called once per Chip-8 timer tick (20 Hz).
        member _.Tick(display: Map<int,bool>) : ReflectionEngine.Belief =
            osc <- injectDisplay display connectome osc
            osc <- step connectome osc
            motorReadout connectome osc

        /// The `BeliefEstimator` interface for `Chip8PredictionRoom.timerHandlerWithPriority`.
        /// `InterruptKind` is ignored — the worm responds only to the visual field.
        member self.BeliefEstimator : Chip8PredictionRoom.BeliefEstimator =
            fun _interruptKind frame -> self.Tick(frame.Display)

        /// Kuramoto order parameter r ∈ [0, 1]: 1 = fully synchronized, 0 = incoherent.
        /// This is the worm's ρ — the biological analogue of the Tsirelson correlation.
        member _.OrderParameter : float =
            let sumSin = osc.Phase |> Array.sumBy Math.Sin
            let sumCos = osc.Phase |> Array.sumBy Math.Cos
            Math.Sqrt(sumSin * sumSin + sumCos * sumCos) / float osc.N

    /// Create a controller from the embedded connectome CSV path and a seed.
    let create (csvPath: string) (seed: uint64) : Controller =
        let connectome = loadFromCsv csvPath
        Controller(connectome, seed)

    // ── Oracle 7 DLA interface ─────────────────────────────────────────────────

    /// Run the worm controller over a DLA growth sequence and record the order parameter
    /// at each stick event. Returns the sequence of (tick, orderParameter, stuckCount) triples.
    ///
    /// This is the biological oracle for the sensor-fusion proof: the worm observes the DLA
    /// cluster growing on the Chip-8 display and its synchronization state is recorded.
    /// If the order parameter crosses the Tsirelson threshold (1/(3√2) ≈ 0.2357) at the same
    /// cluster size as the computational oracles, the identity eigenvector is substrate-independent.
    let runDlaOracle
        (connectome: Connectome)
        (seed: uint64)
        (dlaFrames: Map<int,bool>[])
        : (int * float * int) [] =
        let ctrl = Controller(connectome, seed)
        dlaFrames
        |> Array.mapi (fun tick display ->
            let _ = ctrl.Tick(display)
            let r = ctrl.OrderParameter
            let stuckCount = display |> Map.filter (fun _ v -> v) |> Map.count
            (tick, r, stuckCount))
