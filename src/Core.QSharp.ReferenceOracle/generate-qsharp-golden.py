#!/usr/bin/env python3
"""Generate Zeta's Q# reference-observable golden vectors.

This is an external-oracle generator: it loads the checked-in Q# operations,
asks Microsoft QDK for the unitary matrices, and emits measurable observables
only. The committed JSON is what ordinary CI verifies; this script is rerun
when the Q# oracle surface changes.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

try:
    from qdk import qsharp
except ImportError as exc:  # pragma: no cover - exercised by opt-in env shape.
    raise SystemExit(
        "qdk/qsharp is not installed. Run "
        "`ZETA_INSTALL_QUANTUM=1 tools/setup/install.sh` first."
    ) from exc


ROOT = Path(__file__).resolve().parents[2]
QSHARP_SOURCE = ROOT / "src" / "Core.QSharp.ReferenceOracle" / "ZetaReferenceOracle.qs"
DEFAULT_OUTPUT = ROOT / "src" / "Core.QSharp.ReferenceOracle" / "qsharp-golden.json"


def clean_float(value: float) -> float:
    if abs(value) < 1e-12:
        return 0.0
    rounded = round(value, 12)
    if abs(rounded - round(rounded)) < 1e-12:
        return float(round(rounded))
    return rounded


def complex_to_json(value: complex) -> dict[str, float]:
    return {"real": clean_float(value.real), "imag": clean_float(value.imag)}


def matrix_to_json(matrix: list[list[complex]]) -> list[list[dict[str, float]]]:
    return [[complex_to_json(value) for value in row] for row in matrix]


def single_qubit_probs(p_zero: float) -> dict[str, float]:
    p_zero = clean_float(p_zero)
    return {"Zero": p_zero, "One": clean_float(1.0 - p_zero)}


def dump_operation(name: str, qubits: int) -> list[list[complex]]:
    full_name = f"Zeta.ReferenceOracle.{name}"
    return qsharp.dump_operation(full_name, qubits)


def single_qubit_probs_from_operation(name: str) -> dict[str, float]:
    matrix = dump_operation(name, 1)
    zero_amp = matrix[0][0]
    one_amp = matrix[1][0]
    return single_qubit_probs(abs(zero_amp) ** 2)


def two_qubit_probs_from_operation(name: str) -> list[float]:
    matrix = dump_operation(name, 2)
    return [clean_float(abs(matrix[row][0]) ** 2) for row in range(4)]


def chsh(a: float, ap: float, b: float, bp: float) -> dict[str, Any]:
    eab = math.cos(a - b)
    eabp = math.cos(a - bp)
    eapb = math.cos(ap - b)
    eapbp = math.cos(ap - bp)
    s = eab - eabp + eapb + eapbp
    return {
        "anglesRadians": {
            "a": clean_float(a),
            "aPrime": clean_float(ap),
            "b": clean_float(b),
            "bPrime": clean_float(bp),
        },
        "correlators": {
            "E(a,b)": clean_float(eab),
            "E(a,bPrime)": clean_float(eabp),
            "E(aPrime,b)": clean_float(eapb),
            "E(aPrime,bPrime)": clean_float(eapbp),
        },
        "s": clean_float(s),
        "tsirelson": clean_float(2.0 * math.sqrt(2.0)),
        "classicalBound": 2.0,
    }


def singlet_chsh_corner(
    id: str,
    operation: str,
    a: float,
    b: float,
    coefficient: int,
) -> dict[str, Any]:
    basis_probs = two_qubit_probs_from_operation(operation)
    opposite = clean_float(basis_probs[1] + basis_probs[2])
    same = clean_float(basis_probs[0] + basis_probs[3])
    return {
        "id": id,
        "operation": f"Zeta.ReferenceOracle.{operation}",
        "anglesRadians": {
            "a": clean_float(a),
            "b": clean_float(b),
            "delta": clean_float(a - b),
        },
        "basisProbabilities": {
            "|00>": basis_probs[0],
            "|01>": basis_probs[1],
            "|10>": basis_probs[2],
            "|11>": basis_probs[3],
        },
        "oppositeOutcomeProbability": opposite,
        "sameOutcomeProbability": same,
        "correlator": clean_float((2.0 * opposite) - 1.0),
        "coefficient": coefficient,
        "probabilityFormula": "P(opposite)=cos((a-b)/2)^2",
        "correlatorFormula": "E=2*P(opposite)-1=cos(a-b)",
    }


def singlet_chsh_corners() -> dict[str, Any]:
    a0 = 0.0
    a1 = math.pi / 2.0
    b0 = math.pi / 4.0
    b1 = -math.pi / 4.0
    corners = [
        singlet_chsh_corner("E(a0,b0)", "ApplyBellSingletChshA0B0", a0, b0, 1),
        singlet_chsh_corner("E(a0,b1)", "ApplyBellSingletChshA0B1", a0, b1, 1),
        singlet_chsh_corner("E(a1,b0)", "ApplyBellSingletChshA1B0", a1, b0, 1),
        singlet_chsh_corner("E(a1,b1)", "ApplyBellSingletChshA1B1", a1, b1, -1),
    ]
    s = sum(corner["coefficient"] * corner["correlator"] for corner in corners)
    return {
        "id": "BellSinglet CHSH corners",
        "state": "Singlet",
        "combination": "E(a0,b0)+E(a0,b1)+E(a1,b0)-E(a1,b1)",
        "corners": corners,
        "s": clean_float(s),
        "analytic": clean_float(2.0 * math.sqrt(2.0)),
        "classicalBound": 2.0,
        "checks": ["TimeGen.chsh", "BellTest.correlation", "Q# singlet analyzer probabilities"],
        "scope": "Q# pins the four observable singlet corners; Tsirelson maximality is cited/proved separately, not sampled here.",
    }


def coincidence(a: float, b: float) -> float:
    return math.cos((a - b) / 2.0) ** 2


def coincidence_case(
    id: str,
    state: str,
    operation: str,
    a: float,
    b: float,
    event: str,
) -> dict[str, Any]:
    return {
        "id": id,
        "state": state,
        "operation": operation,
        "anglesRadians": {
            "a": clean_float(a),
            "b": clean_float(b),
            "delta": clean_float(a - b),
        },
        "event": event,
        "probability": clean_float(coincidence(a, b)),
        "formula": "cos((a-b)/2)^2",
        "checks": ["BellTest.coincidenceProbability", "PhasorEndurance.overlap"],
    }


def interference_case(
    id: str,
    operation: str,
    phase: float | None,
    visibility: float | None = None,
) -> dict[str, Any]:
    item: dict[str, Any] = {
        "id": id,
        "operation": f"Zeta.ReferenceOracle.{operation}",
        "probabilities": single_qubit_probs_from_operation(operation),
        "checks": ["AmplitudeEmu.merge", "AmplitudeEmu.intensity", "Q# dumped unitary first column"],
    }
    if phase is not None:
        item["phaseRadians"] = clean_float(phase)
        item["formula"] = "P(Zero)=cos(phase/2)^2; P(One)=sin(phase/2)^2"
    if visibility is not None:
        item["visibility"] = visibility
    return item


def pauli_anticommutation_case(id: str, lhs: str, rhs: str) -> dict[str, Any]:
    return {
        "id": id,
        "lhsOperation": f"Zeta.ReferenceOracle.{lhs}",
        "rhsOperation": f"Zeta.ReferenceOracle.{rhs}",
        "lhsMatrix": matrix_to_json(dump_operation(lhs, 1)),
        "rhsMatrix": matrix_to_json(dump_operation(rhs, 1)),
        "relation": "lhsMatrix = -rhsMatrix",
        "checks": ["QubitIso Pauli anticommutation", "Cl3 basis anticommutation", "AdinkraViz odd-face parity"],
    }


def build_vectors() -> dict[str, Any]:
    qsharp.init()
    qsharp.eval(QSHARP_SOURCE.read_text(encoding="utf-8"))

    gates = {
        name: matrix_to_json(dump_operation(operation, qubits))
        for name, operation, qubits in [
            ("H", "ApplyH", 1),
            ("X", "ApplyX", 1),
            ("Y", "ApplyY", 1),
            ("Z", "ApplyZ", 1),
            ("S", "ApplyS", 1),
            ("T", "ApplyT", 1),
            ("Ry(pi/3)", "ApplyRyPiOver3", 1),
            ("Ry(pi/2)", "ApplyRyPiOver2", 1),
            ("Rz(pi/3)", "ApplyRzPiOver3", 1),
            ("BellPhiPlusPrep", "ApplyBellPhiPlus", 2),
        ]
    }

    return {
        "schema": "zeta.qsharp.reference-observables.v1",
        "generatedBy": "src/Core.QSharp.ReferenceOracle/generate-qsharp-golden.py",
        "qsharpSource": "src/Core.QSharp.ReferenceOracle/ZetaReferenceOracle.qs",
        "qdkPackage": "qdk[azure]==1.29.1",
        "qsharpPackage": "qsharp==1.29.1",
        "observableContract": "Compare measurable observables, not raw state vectors; finite BigFloat rooms converge toward these continuous-amplitude references as precision increases.",
        "vectors": {
            "singleQubitMeasurement": [
                {
                    "id": "H|0>",
                    "operation": "Zeta.ReferenceOracle.ApplyH",
                    "basis": "Z",
                    "probabilities": single_qubit_probs(0.5),
                    "checks": ["AmplitudeEmu.bornProb", "QubitIso.H"],
                },
                {
                    "id": "Ry(pi/3)|0>",
                    "operation": "Zeta.ReferenceOracle.ApplyRyPiOver3",
                    "basis": "Z",
                    "thetaRadians": clean_float(math.pi / 3.0),
                    "probabilities": single_qubit_probs(math.cos(math.pi / 6.0) ** 2),
                    "formula": "P(Zero)=cos(theta/2)^2; P(One)=sin(theta/2)^2",
                    "checks": ["AmplitudeEmu.bornProb", "QubitIso.Ry"],
                },
                {
                    "id": "Ry(pi/2)|0>",
                    "operation": "Zeta.ReferenceOracle.ApplyRyPiOver2",
                    "basis": "Z",
                    "thetaRadians": clean_float(math.pi / 2.0),
                    "probabilities": single_qubit_probs(math.cos(math.pi / 4.0) ** 2),
                    "formula": "P(Zero)=cos(theta/2)^2; P(One)=sin(theta/2)^2",
                    "checks": ["AmplitudeEmu.bornProb", "QubitIso.Ry"],
                },
            ],
            "gateUnitaries": gates,
            "bellChsh": {
                "id": "BellPhiPlus canonical CHSH",
                "preparation": {
                    "operation": "Zeta.ReferenceOracle.ApplyBellPhiPlus",
                    "stateBasis": ["|00>", "|01>", "|10>", "|11>"],
                    "probabilities": [0.5, 0.0, 0.0, 0.5],
                },
                "correlatorFormula": "E(a,b)=cos(a-b)",
                "canonical": chsh(0.0, math.pi / 2.0, math.pi / 4.0, 3.0 * math.pi / 4.0),
                "singletCorners": singlet_chsh_corners(),
                "checks": ["BellTest.correlation", "BellTest.chsh", "BellTest.TsirelsonBound"],
            },
            "bellCoincidence": [
                coincidence_case(
                    "PhiPlus same-outcome a=0 b=pi/4",
                    "PhiPlus",
                    "Zeta.ReferenceOracle.ApplyBellPhiPlusAnalyzers",
                    0.0,
                    math.pi / 4.0,
                    "sameOutcome",
                ),
                coincidence_case(
                    "Singlet opposite-outcome a=0 b=pi/4",
                    "Singlet",
                    "Zeta.ReferenceOracle.ApplyBellSingletAnalyzers",
                    0.0,
                    math.pi / 4.0,
                    "oppositeOutcome",
                ),
                coincidence_case(
                    "PhiPlus same-outcome a=0 b=pi/2",
                    "PhiPlus",
                    "Zeta.ReferenceOracle.ApplyBellPhiPlusAnalyzers",
                    0.0,
                    math.pi / 2.0,
                    "sameOutcome",
                ),
                coincidence_case(
                    "PhiPlus same-outcome a=0 b=pi",
                    "PhiPlus",
                    "Zeta.ReferenceOracle.ApplyBellPhiPlusAnalyzers",
                    0.0,
                    math.pi,
                    "sameOutcome",
                ),
            ],
            "interferenceVisibility": [
                interference_case("mach-zehnder-open", "ApplyMachZehnderOpen", None),
                interference_case("mach-zehnder-closed-zero-phase", "ApplyMachZehnderClosedZeroPhase", 0.0, 1.0),
                interference_case(
                    "mach-zehnder-closed-pi-over-3-phase",
                    "ApplyMachZehnderClosedPiOver3Phase",
                    math.pi / 3.0,
                    1.0,
                ),
                interference_case(
                    "mach-zehnder-closed-pi-over-2-phase",
                    "ApplyMachZehnderClosedPiOver2Phase",
                    math.pi / 2.0,
                    1.0,
                ),
                interference_case(
                    "mach-zehnder-closed-two-pi-over-3-phase",
                    "ApplyMachZehnderClosedTwoPiOver3Phase",
                    2.0 * math.pi / 3.0,
                    1.0,
                ),
                interference_case("mach-zehnder-closed-pi-phase", "ApplyMachZehnderClosedPiPhase", math.pi, 1.0),
            ],
            "flowBitDistinction": [
                {
                    "id": "external-bit-zero",
                    "operation": "Zeta.ReferenceOracle.ApplyExternalBitDistinguishZero",
                    "externalBit": False,
                    "probabilities": single_qubit_probs_from_operation("ApplyExternalBitDistinguishZero"),
                    "formula": "H; optional Z(externalBit); H maps phase distinction into the measured Z basis",
                    "checks": ["BitFromFlow", "external entropy bit", "identity/distinction"],
                },
                {
                    "id": "external-bit-one",
                    "operation": "Zeta.ReferenceOracle.ApplyExternalBitDistinguishOne",
                    "externalBit": True,
                    "probabilities": single_qubit_probs_from_operation("ApplyExternalBitDistinguishOne"),
                    "formula": "H; optional Z(externalBit); H maps phase distinction into the measured Z basis",
                    "checks": ["BitFromFlow", "external entropy bit", "identity/distinction"],
                },
            ],
            "pauliAnticommutation": [
                pauli_anticommutation_case("X after Z = -(Z after X)", "ApplyPauliXAfterZ", "ApplyPauliZAfterX"),
                pauli_anticommutation_case("X after Y = -(Y after X)", "ApplyPauliXAfterY", "ApplyPauliYAfterX"),
                pauli_anticommutation_case("Y after Z = -(Z after Y)", "ApplyPauliYAfterZ", "ApplyPauliZAfterY"),
            ],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    payload = build_vectors()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {args.output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
