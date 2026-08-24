/// # CssStabilizerCodes — the syndrome-extraction layer of the QEC stack
///
/// Implements the Q# half of the routing verdict in
/// `docs/research/2026-08-23-qec-stack-routing-the-adinkra-bridge-closes-at-n8-and-reopens-at-n16-soraya.md`
/// §5 L6: *"the one genuinely quantum layer, and the one place Q# earns its keep."*
///
/// ## Register — and this file is where the line is easiest to cross
///
/// The classical parameters `[[n, k, d]]` are computed in `src/Core/CssCode.fs` and committed to
/// `css-stabilizer-treaty.json`. Those are **GF(2) linear algebra** — a structural claim this repo
/// can earn. This file is the other side: it writes down the **circuit** those parameters describe.
/// Writing the circuit is *still* not a physical claim. Running it needs QDK and a simulator; the
/// simulator is a program, not a device. **Nothing in Zeta holds an encoded qubit**, and no golden
/// vector in this directory should ever be read as evidence that one does.
///
/// The honest statement of what this buys: the stabiliser generators here are an **independent
/// transcription** of the same parity-check rows the F# module derives. If the transcription is
/// wrong, `css-stabilizer.test.ts` goes red — because it re-derives the rows from the Reed–Muller
/// *definition* in a third language and compares. That is the byte-lock, and it is a claim about
/// three implementations agreeing, not about physics.
///
/// ## Why the syndrome does not destroy what it protects
///
/// The property the whole construction turns on, stated once because it is the thing most often
/// waved at loosely: a stabiliser generator `g` fixes the codespace (`g|ψ⟩ = |ψ⟩`), and every
/// logical operator lies in the **normaliser** of the stabiliser group, so `[g, L] = 0`. Measuring
/// `g` therefore (a) does not disturb the logical state, and (b) returns an outcome that is
/// *statistically independent of the logical content* — it reports only which error coset the state
/// fell into. You learn what the environment did without learning, or damaging, what you stored.
///
/// For a CSS code that condition is exactly `H_X · H_Zᵀ = 0` over GF(2), which is why
/// `CssCode.Tests` asserts it directly: it is the condition that makes the stabiliser group abelian,
/// and without it there is no codespace at all.
///
/// Anchors (Beacon): Gottesman, *Stabilizer Codes and Quantum Error Correction* (Caltech PhD thesis,
/// 1997) — the stabiliser formalism and the Gottesman–Knill theorem that makes simulating these
/// circuits exact and poly-time. Calderbank & Shor (PRA 54, 1996) and Steane (Proc. R. Soc. A 452,
/// 1996) — the CSS construction. Shor, *Scheme for reducing decoherence in quantum computer memory*
/// (PRA 52, 1995) — the first code, and the first ancilla-based syndrome extraction.
namespace Zeta.ReferenceOracle.Qec {

    open Microsoft.Quantum.Intrinsic;
    open Microsoft.Quantum.Canon;
    open Microsoft.Quantum.Arrays;
    open Microsoft.Quantum.Measurement;

    /// The Steane [[7,1,3]] parity-check rows, as bit patterns over 7 coordinates.
    /// **Provenance, not inheritance** (routing doc §2): these are a generator of the dual of the
    /// committed `AdinkraCode.generator` punctured at coordinate 0. The puncture destroys
    /// doubly-evenness, so the resulting code has *left* the adinkra category — it is derived from
    /// our matrix, it is not an adinkra quantum code. Byte-locked in `css-stabilizer-treaty.json`
    /// under `cssCodes.steane_7_1_3`.
    ///
    /// Bit `i` of each row is coordinate `i`, little-endian — the same convention `CssCode.toHex`
    /// serialises with, so the hex in the treaty and the integers here are the same numbers.
    function SteaneCheckRows() : Int[] {
        return [0x55, 0x33, 0x0F];
    }

    /// The [[16,6,4]] parity-check rows: a reduced-echelon generator of RM(1,4).
    /// Unlike Steane, **nothing was punctured and nothing left the category** — RM(1,4) is
    /// doubly-even and self-orthogonal, so this is a genuine adinkra code at N=16 supercharges.
    /// The code itself is standard (quantum Reed–Muller, Calderbank–Shor 1996 / Steane 1996); what
    /// is ours is only the observation about which member of the adinkra family it is.
    function QuantumReedMullerCheckRows() : Int[] {
        return [0x9669, 0x5555, 0x3333, 0x0F0F, 0x00FF];
    }

    /// `true` when bit `i` of `row` is set.
    function RowHasCoordinate(row : Int, i : Int) : Bool {
        return (row >>> i) % 2 == 1;
    }

    /// **The CSS commutation condition, `H_X · H_Zᵀ = 0` over GF(2).**
    /// Callable so that the Q# lane can refuse a bad row set at its own boundary rather than
    /// trusting that the F# side checked. A stabiliser group that is not abelian has no joint
    /// eigenspace, so this failing means there is no code — not a code with worse parameters.
    function RowsCommute(rows : Int[], n : Int) : Bool {
        mutable ok = true;
        for x in rows {
            for z in rows {
                mutable overlap = 0;
                for i in 0 .. n - 1 {
                    if RowHasCoordinate(x, i) and RowHasCoordinate(z, i) {
                        set overlap += 1;
                    }
                }
                if overlap % 2 != 0 {
                    set ok = false;
                }
            }
        }
        return ok;
    }

    /// Measure one **Z-type** stabiliser `⊗_{i∈row} Z_i` by the standard ancilla construction:
    /// the ancilla starts in |0⟩, a CNOT from each data qubit in the row accumulates the parity,
    /// and measuring the ancilla in the computational basis reads it out.
    ///
    /// This is the operation that makes "look at what the environment did without looking at the
    /// data" concrete: the ancilla ends up holding the *parity* of the row, which is a function of
    /// the error and — because the row is a stabiliser — **not** a function of the logical state.
    operation MeasureZStabilizer(data : Qubit[], row : Int) : Result {
        use ancilla = Qubit();
        for i in 0 .. Length(data) - 1 {
            if RowHasCoordinate(row, i) {
                CNOT(data[i], ancilla);
            }
        }
        let result = MResetZ(ancilla);
        return result;
    }

    /// Measure one **X-type** stabiliser `⊗_{i∈row} X_i`. Same construction conjugated by Hadamard
    /// on the ancilla, with the CNOTs reversed so the parity is accumulated in the X basis.
    operation MeasureXStabilizer(data : Qubit[], row : Int) : Result {
        use ancilla = Qubit();
        H(ancilla);
        for i in 0 .. Length(data) - 1 {
            if RowHasCoordinate(row, i) {
                CNOT(ancilla, data[i]);
            }
        }
        H(ancilla);
        let result = MResetZ(ancilla);
        return result;
    }

    /// Extract the full syndrome: the Z-type rows first, then the X-type rows, in the row order the
    /// treaty commits. Order is part of the contract — a syndrome is only decodable against the row
    /// ordering it was measured in, so shuffling the rows silently changes the meaning of every
    /// entry in a decoder's table.
    ///
    /// Returns `n - k` results for an `[[n, k, d]]` CSS code built from a single classical code.
    operation ExtractSyndrome(data : Qubit[], rows : Int[]) : Result[] {
        mutable zPart = [];
        for row in rows {
            set zPart += [MeasureZStabilizer(data, row)];
        }
        mutable xPart = [];
        for row in rows {
            set xPart += [MeasureXStabilizer(data, row)];
        }
        return zPart + xPart;
    }

    /// The classical syndrome of a **known** error pattern against a row set — the same arithmetic
    /// `CssCode.syndrome` performs in F#, transcribed here so the Q# lane can state its expectation
    /// without importing one.
    ///
    /// This is the *classical* half and it is deliberately separate from `ExtractSyndrome`: one is
    /// GF(2) arithmetic over a bit pattern, the other is a circuit over qubits. Keeping them in
    /// different functions is what stops the file from implying that running the arithmetic is the
    /// same act as running the circuit.
    function ClassicalSyndrome(rows : Int[], error : Int, n : Int) : Int {
        mutable syndrome = 0;
        for r in 0 .. Length(rows) - 1 {
            mutable parity = 0;
            for i in 0 .. n - 1 {
                if RowHasCoordinate(rows[r], i) and RowHasCoordinate(error, i) {
                    set parity += 1;
                }
            }
            if parity % 2 == 1 {
                set syndrome += 1 <<< r;
            }
        }
        return syndrome;
    }
}
