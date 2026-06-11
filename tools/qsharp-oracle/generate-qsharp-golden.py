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
QSHARP_SOURCE = ROOT / "tools" / "qsharp-oracle" / "ZetaReferenceOracle.qs"
DEFAULT_OUTPUT = ROOT / "tools" / "qsharp-oracle" / "qsharp-golden.json"


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
        "generatedBy": "tools/qsharp-oracle/generate-qsharp-golden.py",
        "qsharpSource": "tools/qsharp-oracle/ZetaReferenceOracle.qs",
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
                {
                    "id": "mach-zehnder-open",
                    "operation": "Zeta.ReferenceOracle.ApplyMachZehnderOpen",
                    "probabilities": single_qubit_probs(0.5),
                    "checks": ["AmplitudeEmu.merge", "AmplitudeEmu.intensity"],
                },
                {
                    "id": "mach-zehnder-closed-zero-phase",
                    "operation": "Zeta.ReferenceOracle.ApplyMachZehnderClosedZeroPhase",
                    "probabilities": single_qubit_probs(1.0),
                    "visibility": 1.0,
                    "checks": ["AmplitudeEmu.merge", "AmplitudeEmu.intensity"],
                },
                {
                    "id": "mach-zehnder-closed-pi-phase",
                    "operation": "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiPhase",
                    "probabilities": single_qubit_probs(0.0),
                    "visibility": 1.0,
                    "checks": ["AmplitudeEmu.merge", "AmplitudeEmu.intensity"],
                },
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
