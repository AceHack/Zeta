namespace Zeta.ReferenceOracle {
    operation ApplyH(qs : Qubit[]) : Unit is Adj + Ctl {
        H(qs[0]);
    }

    operation ApplyX(qs : Qubit[]) : Unit is Adj + Ctl {
        X(qs[0]);
    }

    operation ApplyY(qs : Qubit[]) : Unit is Adj + Ctl {
        Y(qs[0]);
    }

    operation ApplyZ(qs : Qubit[]) : Unit is Adj + Ctl {
        Z(qs[0]);
    }

    operation ApplyS(qs : Qubit[]) : Unit is Adj + Ctl {
        S(qs[0]);
    }

    operation ApplyT(qs : Qubit[]) : Unit is Adj + Ctl {
        T(qs[0]);
    }

    operation ApplyRyPiOver3(qs : Qubit[]) : Unit is Adj + Ctl {
        Ry(3.141592653589793 / 3.0, qs[0]);
    }

    operation ApplyRyPiOver2(qs : Qubit[]) : Unit is Adj + Ctl {
        Ry(3.141592653589793 / 2.0, qs[0]);
    }

    operation ApplyRzPiOver3(qs : Qubit[]) : Unit is Adj + Ctl {
        Rz(3.141592653589793 / 3.0, qs[0]);
    }

    operation ApplyBellPhiPlus(qs : Qubit[]) : Unit is Adj + Ctl {
        H(qs[0]);
        CNOT(qs[0], qs[1]);
    }

    operation ApplyBellSinglet(qs : Qubit[]) : Unit is Adj + Ctl {
        H(qs[0]);
        CNOT(qs[0], qs[1]);
        X(qs[1]);
        Z(qs[1]);
    }

    operation ApplyBellPhiPlusAnalyzers(a : Double, b : Double, qs : Qubit[]) : Unit is Adj + Ctl {
        H(qs[0]);
        CNOT(qs[0], qs[1]);
        Ry(-a, qs[0]);
        Ry(-b, qs[1]);
    }

    operation ApplyBellSingletAnalyzers(a : Double, b : Double, qs : Qubit[]) : Unit is Adj + Ctl {
        H(qs[0]);
        CNOT(qs[0], qs[1]);
        X(qs[1]);
        Z(qs[1]);
        Ry(-a, qs[0]);
        Ry(-b, qs[1]);
    }

    operation ApplyBellPhiPlusAnalyzersCanonical(qs : Qubit[]) : Unit is Adj + Ctl {
        ApplyBellPhiPlusAnalyzers(0.0, 3.141592653589793 / 4.0, qs);
    }

    operation ApplyBellSingletAnalyzersCanonical(qs : Qubit[]) : Unit is Adj + Ctl {
        ApplyBellSingletAnalyzers(0.0, 3.141592653589793 / 4.0, qs);
    }

    operation ApplyBellSingletChshA0B0(qs : Qubit[]) : Unit is Adj + Ctl {
        ApplyBellSingletAnalyzers(0.0, 3.141592653589793 / 4.0, qs);
    }

    operation ApplyBellSingletChshA0B1(qs : Qubit[]) : Unit is Adj + Ctl {
        ApplyBellSingletAnalyzers(0.0, -3.141592653589793 / 4.0, qs);
    }

    operation ApplyBellSingletChshA1B0(qs : Qubit[]) : Unit is Adj + Ctl {
        ApplyBellSingletAnalyzers(3.141592653589793 / 2.0, 3.141592653589793 / 4.0, qs);
    }

    operation ApplyBellSingletChshA1B1(qs : Qubit[]) : Unit is Adj + Ctl {
        ApplyBellSingletAnalyzers(3.141592653589793 / 2.0, -3.141592653589793 / 4.0, qs);
    }

    operation ApplyPauliXAfterZ(qs : Qubit[]) : Unit is Adj + Ctl {
        Z(qs[0]);
        X(qs[0]);
    }

    operation ApplyPauliZAfterX(qs : Qubit[]) : Unit is Adj + Ctl {
        X(qs[0]);
        Z(qs[0]);
    }

    operation ApplyPauliXAfterY(qs : Qubit[]) : Unit is Adj + Ctl {
        Y(qs[0]);
        X(qs[0]);
    }

    operation ApplyPauliYAfterX(qs : Qubit[]) : Unit is Adj + Ctl {
        X(qs[0]);
        Y(qs[0]);
    }

    operation ApplyPauliYAfterZ(qs : Qubit[]) : Unit is Adj + Ctl {
        Z(qs[0]);
        Y(qs[0]);
    }

    operation ApplyPauliZAfterY(qs : Qubit[]) : Unit is Adj + Ctl {
        Y(qs[0]);
        Z(qs[0]);
    }

    operation ApplyMachZehnderOpen(qs : Qubit[]) : Unit is Adj + Ctl {
        H(qs[0]);
    }

    operation ApplyMachZehnderClosedZeroPhase(qs : Qubit[]) : Unit is Adj + Ctl {
        H(qs[0]);
        H(qs[0]);
    }

    operation ApplyMachZehnderClosedPiPhase(qs : Qubit[]) : Unit is Adj + Ctl {
        H(qs[0]);
        Z(qs[0]);
        H(qs[0]);
    }

    operation ApplyMachZehnderClosedPiOver3Phase(qs : Qubit[]) : Unit is Adj + Ctl {
        H(qs[0]);
        Rz(3.141592653589793 / 3.0, qs[0]);
        H(qs[0]);
    }

    operation ApplyMachZehnderClosedPiOver2Phase(qs : Qubit[]) : Unit is Adj + Ctl {
        H(qs[0]);
        Rz(3.141592653589793 / 2.0, qs[0]);
        H(qs[0]);
    }

    operation ApplyMachZehnderClosedTwoPiOver3Phase(qs : Qubit[]) : Unit is Adj + Ctl {
        H(qs[0]);
        Rz(2.0 * 3.141592653589793 / 3.0, qs[0]);
        H(qs[0]);
    }
}
