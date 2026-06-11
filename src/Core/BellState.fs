namespace Zeta.Core

/// Two-qubit Bell-state preparation on the same complex amplitude substrate as `QubitIso`.
[<RequireQualifiedAccess>]
module BellState =

    let private c = ImaginaryStack.complex

    /// Basis order is `|00>`, `|01>`, `|10>`, `|11>`, matching the Q# oracle fixture.
    type State =
        { ZeroZero: Complex
          ZeroOne: Complex
          OneZero: Complex
          OneOne: Complex }

    let zeroZero: State =
        { ZeroZero = c.One
          ZeroOne = c.Zero
          OneZero = c.Zero
          OneOne = c.Zero }

    let private scale (factor: float) (z: Complex) : Complex =
        c.Mul({ Real = factor; Imag = 0.0 }, z)

    let private magSq (z: Complex) : float = z.Real * z.Real + z.Imag * z.Imag

    let normSq (state: State) : float =
        magSq state.ZeroZero + magSq state.ZeroOne + magSq state.OneZero + magSq state.OneOne

    let probabilities (state: State) : float[] =
        let n = normSq state
        if n = 0.0 then
            [| 0.0; 0.0; 0.0; 0.0 |]
        else
            [| magSq state.ZeroZero / n
               magSq state.ZeroOne / n
               magSq state.OneZero / n
               magSq state.OneOne / n |]

    /// Apply H to the first qubit.
    let hadamardFirst (state: State) : State =
        let invSqrt2 = 1.0 / sqrt 2.0
        { ZeroZero = c.Add(state.ZeroZero, state.OneZero) |> scale invSqrt2
          ZeroOne = c.Add(state.ZeroOne, state.OneOne) |> scale invSqrt2
          OneZero = c.Add(state.ZeroZero, c.Negate state.OneZero) |> scale invSqrt2
          OneOne = c.Add(state.ZeroOne, c.Negate state.OneOne) |> scale invSqrt2 }

    /// Apply CNOT with the first qubit as control and the second as target.
    let cnot01 (state: State) : State =
        { state with
            OneZero = state.OneOne
            OneOne = state.OneZero }

    /// Prepare `|Φ+> = (|00> + |11>) / sqrt(2)` from `|00>` via `H(0); CNOT(0,1)`.
    let phiPlus () : State = zeroZero |> hadamardFirst |> cnot01
