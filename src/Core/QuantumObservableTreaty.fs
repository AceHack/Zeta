namespace Zeta.Core

/// Source-owned observable rows shared by the F# finite-resolution substrate and
/// external quantum oracles. Q# remains the continuous-amplitude oracle; this
/// module names the F#/analytic side so other language lanes can mirror the
/// same rows without re-deriving the treaty in tests.
[<RequireQualifiedAccess>]
module QuantumObservableTreaty =

    type Probabilities =
        { Zero: float
          One: float }

    type SingleQubitMeasurement =
        { Id: string
          Operation: string
          ThetaRadians: float option
          Probabilities: Probabilities }

    type ChshAngles =
        { A: float
          APrime: float
          B: float
          BPrime: float }

    type ChshCorrelators =
        { EAB: float
          EABPrime: float
          EAPrimeB: float
          EAPrimeBPrime: float }

    type CanonicalChsh =
        { Id: string
          Angles: ChshAngles
          Correlators: ChshCorrelators
          S: float
          Tsirelson: float
          ClassicalBound: float }

    type BellCorner =
        { Id: string
          Operation: string
          A: float
          B: float
          Coefficient: int
          SameOutcomeProbability: float
          OppositeOutcomeProbability: float
          Correlator: float }

    type SingletChsh =
        { Id: string
          Corners: BellCorner list
          S: float
          Analytic: float
          ClassicalBound: float }

    type BellCoincidence =
        { Id: string
          State: string
          Operation: string
          A: float
          B: float
          Event: string
          Probability: float }

    type InterferenceVisibility =
        { Id: string
          Operation: string
          PhaseRadians: float option
          Probabilities: Probabilities
          Visibility: float option }

    let private c = ImaginaryStack.complex

    let private real (value: float) : Complex =
        { Real = value; Imag = 0.0 }

    let private phase (angle: float) : Complex =
        { Real = cos angle; Imag = sin angle }

    let private probabilitiesFromState (state: QubitIso.JoinState) : Probabilities =
        let one = QubitIso.measureOne state
        { Zero = 1.0 - one; One = one }

    let private zero =
        QubitIso.ofQubit c.One c.Zero

    let singleQubitMeasurements () : SingleQubitMeasurement list =
        [ { Id = "H|0>"
            Operation = "Zeta.ReferenceOracle.ApplyH"
            ThetaRadians = None
            Probabilities = zero |> QubitIso.hadamard |> probabilitiesFromState }
          { Id = "Ry(pi/3)|0>"
            Operation = "Zeta.ReferenceOracle.ApplyRyPiOver3"
            ThetaRadians = Some(System.Math.PI / 3.0)
            Probabilities = zero |> QubitIso.ry (System.Math.PI / 3.0) |> probabilitiesFromState }
          { Id = "Ry(pi/2)|0>"
            Operation = "Zeta.ReferenceOracle.ApplyRyPiOver2"
            ThetaRadians = Some(System.Math.PI / 2.0)
            Probabilities = zero |> QubitIso.ry (System.Math.PI / 2.0) |> probabilitiesFromState } ]

    let canonicalChsh () : CanonicalChsh =
        let a, aPrime, b, bPrime = BellTest.canonicalAngles

        { Id = "BellPhiPlus canonical CHSH"
          Angles =
            { A = a
              APrime = aPrime
              B = b
              BPrime = bPrime }
          Correlators =
            { EAB = BellTest.correlation a b
              EABPrime = BellTest.correlation a bPrime
              EAPrimeB = BellTest.correlation aPrime b
              EAPrimeBPrime = BellTest.correlation aPrime bPrime }
          S = BellTest.chsh a aPrime b bPrime
          Tsirelson = BellTest.TsirelsonBound
          ClassicalBound = BellTest.ClassicalBound }

    let private singletCornerOperation index =
        match index with
        | 0 -> "Zeta.ReferenceOracle.ApplyBellSingletChshA0B0"
        | 1 -> "Zeta.ReferenceOracle.ApplyBellSingletChshA0B1"
        | 2 -> "Zeta.ReferenceOracle.ApplyBellSingletChshA1B0"
        | _ -> "Zeta.ReferenceOracle.ApplyBellSingletChshA1B1"

    let singletChsh () : SingletChsh =
        let corners =
            TimeGen.cornerAngles
            |> List.mapi (fun index (a, b) ->
                let opposite = BellTest.coincidenceProbability a b
                let coefficient = if index = 3 then -1 else 1

                { Id =
                    match index with
                    | 0 -> "E(a0,b0)"
                    | 1 -> "E(a0,b1)"
                    | 2 -> "E(a1,b0)"
                    | _ -> "E(a1,b1)"
                  Operation = singletCornerOperation index
                  A = a
                  B = b
                  Coefficient = coefficient
                  SameOutcomeProbability = 1.0 - opposite
                  OppositeOutcomeProbability = opposite
                  Correlator = BellTest.correlation a b })

        { Id = "BellSinglet CHSH corners"
          Corners = corners
          S = corners |> List.sumBy (fun corner -> float corner.Coefficient * corner.Correlator)
          Analytic = BellTest.TsirelsonBound
          ClassicalBound = BellTest.ClassicalBound }

    let bellCoincidences () : BellCoincidence list =
        [ { Id = "PhiPlus same-outcome a=0 b=pi/4"
            State = "PhiPlus"
            Operation = "Zeta.ReferenceOracle.ApplyBellPhiPlusAnalyzers"
            A = 0.0
            B = System.Math.PI / 4.0
            Event = "sameOutcome"
            Probability = BellTest.coincidenceProbability 0.0 (System.Math.PI / 4.0) }
          { Id = "Singlet opposite-outcome a=0 b=pi/4"
            State = "Singlet"
            Operation = "Zeta.ReferenceOracle.ApplyBellSingletAnalyzers"
            A = 0.0
            B = System.Math.PI / 4.0
            Event = "oppositeOutcome"
            Probability = BellTest.coincidenceProbability 0.0 (System.Math.PI / 4.0) }
          { Id = "PhiPlus same-outcome a=0 b=pi/2"
            State = "PhiPlus"
            Operation = "Zeta.ReferenceOracle.ApplyBellPhiPlusAnalyzers"
            A = 0.0
            B = System.Math.PI / 2.0
            Event = "sameOutcome"
            Probability = BellTest.coincidenceProbability 0.0 (System.Math.PI / 2.0) }
          { Id = "PhiPlus same-outcome a=0 b=pi"
            State = "PhiPlus"
            Operation = "Zeta.ReferenceOracle.ApplyBellPhiPlusAnalyzers"
            A = 0.0
            B = System.Math.PI
            Event = "sameOutcome"
            Probability = BellTest.coincidenceProbability 0.0 System.Math.PI } ]

    let private frame (seed: uint64) =
        Chip8Cow.create seed |> Chip8Cow.loadRom [| 0x60uy; byte seed |]

    let private probabilityFor frame probabilities =
        probabilities
        |> List.tryFind (fun (f, _) -> f = frame)
        |> Option.map snd
        |> Option.defaultValue 0.0

    let private probabilitiesFromAmp (amp: AmplitudeEmu.Amp) : Probabilities =
        let detectorZero = frame 0UL
        let detectorOne = frame 1UL
        let actual = amp |> AmplitudeEmu.merge |> AmplitudeEmu.bornProb
        { Zero = probabilityFor detectorZero actual
          One = probabilityFor detectorOne actual }

    let private closedInterferometer (phi: float) : AmplitudeEmu.Amp =
        let detectorZero = frame 0UL
        let detectorOne = frame 1UL
        let half = real 0.5
        let phase0 = phase (-phi / 2.0)
        let phase1 = phase (phi / 2.0)

        [ detectorZero, c.Mul(half, phase0)
          detectorZero, c.Mul(half, phase1)
          detectorOne, c.Mul(half, phase0)
          detectorOne, c.Negate(c.Mul(half, phase1)) ]

    let interferenceVisibility () : InterferenceVisibility list =
        let detectorZero = frame 0UL
        let detectorOne = frame 1UL
        let invSqrt2 = real (1.0 / sqrt 2.0)

        let openCase =
            [ detectorZero, invSqrt2
              detectorOne, invSqrt2 ]

        let closed id operation phase =
            { Id = id
              Operation = operation
              PhaseRadians = Some phase
              Probabilities = closedInterferometer phase |> probabilitiesFromAmp
              Visibility = Some 1.0 }

        [ { Id = "mach-zehnder-open"
            Operation = "Zeta.ReferenceOracle.ApplyMachZehnderOpen"
            PhaseRadians = None
            Probabilities = openCase |> probabilitiesFromAmp
            Visibility = None }
          closed "mach-zehnder-closed-zero-phase" "Zeta.ReferenceOracle.ApplyMachZehnderClosedZeroPhase" 0.0
          closed "mach-zehnder-closed-pi-over-3-phase" "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver3Phase" (System.Math.PI / 3.0)
          closed "mach-zehnder-closed-pi-over-2-phase" "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver2Phase" (System.Math.PI / 2.0)
          closed "mach-zehnder-closed-two-pi-over-3-phase" "Zeta.ReferenceOracle.ApplyMachZehnderClosedTwoPiOver3Phase" (2.0 * System.Math.PI / 3.0)
          closed "mach-zehnder-closed-pi-phase" "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiPhase" System.Math.PI ]
