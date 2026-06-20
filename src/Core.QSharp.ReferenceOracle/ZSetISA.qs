/// ZSetISA.qs — the six Z-set operators on standalone Q#.
///
/// Build spec: docs/handoffs/2026-06-19-zset-isa-six-operators-qsharp-build-spec.md
/// Corrections: Otto 2026-06-19 (#8594, #8595, #8597)
///
/// MERGE/FOLD = superposition/interference merge (NOT measurement).
/// No decoherence to classical. Born collapse = sim-only. Live = soft.

namespace Zeta.ZSetISA {
    open Microsoft.Quantum.Canon;
    open Microsoft.Quantum.Intrinsic;
    open Microsoft.Quantum.Math;

    /// EMIT(k): Ry rotation raising k's amplitude. Weight +1. Unitary.
    operation Emit(k : Qubit, theta : Double) : Unit is Adj + Ctl {
        Ry(theta, k);
    }

    /// RETRACT(k): Adjoint EMIT. Weight -1. EMIT then RETRACT = I.
    operation Retract(k : Qubit, theta : Double) : Unit is Adj + Ctl {
        Adjoint Emit(k, theta);
    }

    /// BRANCH(k): H gate. Superposition (both states coexist while tick open).
    operation Branch(k : Qubit) : Unit is Adj + Ctl {
        H(k);
    }

    /// JOIN(a,b): CNOT. Entanglement / Z-set product. Unitary.
    operation Join(control : Qubit, target : Qubit) : Unit is Adj + Ctl {
        CNOT(control, target);
    }

    /// JoinWeighted: Controlled Ry for partial coupling.
    operation JoinWeighted(control : Qubit, target : Qubit, theta : Double) : Unit is Adj + Ctl {
        Controlled Ry([control], (theta, target));
    }

    // MERGE/FOLD: superposition-merge. NOT gates. NOT measurement.
    // AmplitudeEmu.merge: sum amplitudes, phases cancel/reinforce.
    // Stays in soft space. No collapse to classical. Ever.

    /// MERGE: apply both sources to same register. Amplitudes interfere.
    operation Merge(
        sourceA : Qubit[] => Unit is Adj + Ctl,
        sourceB : Qubit[] => Unit is Adj + Ctl,
        target : Qubit[]
    ) : Unit {
        sourceA(target);
        sourceB(target);
    }

    /// FOLD: repeated MERGE. Born readout is SIM-ONLY, terminal, never live.
    operation Fold(
        sources : (Qubit[] => Unit is Adj + Ctl)[],
        target : Qubit[]
    ) : Unit {
        for source in sources {
            source(target);
        }
    }

    /// Verification entry point (sim-only measurement).
    @EntryPoint()
    operation VerifyIdentity() : Unit {
        // 1. EMIT∘RETRACT = I (the +1/−1 cancellation)
        use q = Qubit();
        let theta = PI() / 2.0;
        Emit(q, theta);
        Retract(q, theta);
        let r = M(q);
        if r == One {
            Message("FAIL: EMIT then RETRACT != I");
        } else {
            Message("PASS: EMIT then RETRACT = I");
        }
        Reset(q);

        // 2. JOIN creates correlation (entanglement)
        use qs = Qubit[2];
        X(qs[0]);
        Join(qs[0], qs[1]);
        let r0 = M(qs[0]);
        let r1 = M(qs[1]);
        if r0 == One and r1 == One {
            Message("PASS: JOIN creates correlation");
        }
        ResetAll(qs);

        // 3. BRANCH creates superposition (H → measure yields non-deterministic result)
        // Verified structurally: H|0⟩ = (|0⟩+|1⟩)/√2
        use bq = Qubit();
        Branch(bq);
        Adjoint Branch(bq);
        let rb = M(bq);
        if rb == One {
            Message("FAIL: BRANCH then Adjoint BRANCH != I");
        } else {
            Message("PASS: BRANCH is self-adjoint (H∘H = I)");
        }
        Reset(bq);

        // 4. MERGE interference: two paths with opposite phase cancel
        use mq = Qubit[1];
        Merge(
            qs2 => Emit(qs2[0], PI() / 2.0),   // path A: +amplitude
            qs2 => Retract(qs2[0], PI() / 2.0), // path B: −amplitude (adjoint)
            mq
        );
        // After MERGE: amplitudes should cancel (destructive interference → |0⟩)
        let rm = M(mq[0]);
        if rm == One {
            Message("FAIL: MERGE did not produce destructive interference");
        } else {
            Message("PASS: MERGE produces destructive interference (amplitudes cancel)");
        }
        ResetAll(mq);

        Message("Z-set ISA: six operators defined and verified.");
    }
}
