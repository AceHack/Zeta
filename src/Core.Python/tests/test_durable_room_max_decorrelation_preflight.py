import json
import subprocess
from pathlib import Path

import pytest

from zeta import durable_room_max_decorrelation_preflight as preflight


def _root() -> Path:
    current = Path(__file__).resolve()
    for parent in [current, *current.parents]:
        if (parent / "Zeta.sln").exists():
            return parent
    raise RuntimeError("repository root unavailable")


def _fsharp_receipt() -> str:
    script = _root() / "src/Research.FSharp/DurableRoomMaxDecorrelationPreflight.fsx"
    result = subprocess.run(
        ["dotnet", "fsi", str(script)],
        check=True,
        capture_output=True,
        encoding="utf-8",
    )
    return result.stdout


def test_fsharp_emitter_and_independent_python_verifier_match_canonical_bytes() -> None:
    fsharp_bytes = _fsharp_receipt()
    python_bytes = preflight.render_receipt()
    assert fsharp_bytes == python_bytes
    preflight.verify_receipt(fsharp_bytes)


def test_preflight_records_the_pinned_finite_catalogue_without_a_winner() -> None:
    receipt = json.loads(preflight.render_receipt())
    payload = receipt["payload"]
    assert payload["catalogue"] == [
        "identity/v1",
        "replace-uncertainty/v1",
        "retract-replace/v1",
    ]
    assert "bestPassingCandidate" not in payload
    assert [row["decorrelationScore"] for row in payload["candidates"]] == [
        0,
        150023,
        150023,
    ]


@pytest.mark.parametrize(
    ("mutation", "reason"),
    [
        (
            lambda value: value["payload"].__setitem__("anchorBytesSha256", "0" * 64),
            "anchor-hash",
        ),
        (
            lambda value: value["payload"].__setitem__("catalogue", ["identity/v1"]),
            "catalogue",
        ),
        (lambda value: value["payload"].__setitem__("chshSidecar", "injected"), "chsh"),
        (
            lambda value: value["payload"].__setitem__(
                "controlManifestDigest", "0" * 64
            ),
            "control-manifest",
        ),
        (
            lambda value: value["payload"].__setitem__(
                "observationBarrierReceipts", []
            ),
            "observation-barrier",
        ),
        (
            lambda value: value["payload"]["candidates"][0]["atomSequence"].append(
                "current-answer"
            ),
            "current-candidate",
        ),
        (
            lambda value: value["payload"]["candidates"][1].__setitem__(
                "decorrelationScore", 0
            ),
            "metric-witness",
        ),
        (
            lambda value: value["payload"]["candidates"][1].__setitem__(
                "reconciliationWitness", "missing"
            ),
            "reconciliation-witness",
        ),
        (
            lambda value: value["payload"]["candidates"][2].__setitem__(
                "atomSequence",
                ["old-positive", "old-retraction", "replacement-positive"],
            ),
            "atom-order",
        ),
        (
            lambda value: value["payload"]["orderedCandidateEvidenceDigests"].reverse(),
            "candidate-evidence-digest",
        ),
    ],
)
def test_mutations_are_refused_by_the_independent_verifier(
    mutation: object, reason: str
) -> None:
    receipt = json.loads(preflight.render_receipt())
    assert callable(mutation)
    mutation(receipt)
    with pytest.raises(preflight.PreflightRefusal, match=reason):
        preflight.verify_object(receipt)


def test_declared_prior_memory_and_retraction_order_are_visible_not_banned() -> None:
    receipt = json.loads(preflight.render_receipt())
    candidates = receipt["payload"]["candidates"]
    assert candidates[1]["atomSequence"] == [
        "old-positive",
        "old-retraction",
        "replacement-positive",
    ]
    assert candidates[2]["intermediateStatus"] == "unresolved"
    assert candidates[2]["reconciliationOutcome"] == "pass"
    assert receipt["payload"]["memoryInputs"] == [
        {
            "acquisitionPhase": "prior-game",
            "availableAt": "run-start",
            "kind": "prior-memory",
            "sourceId": "chip8-orbit/v1",
        }
    ]
