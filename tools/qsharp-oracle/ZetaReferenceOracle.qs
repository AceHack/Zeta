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
}
