import json
import subprocess
from pathlib import Path

import pytest

from zeta import durable_room_admission_receipt as admission


def _root() -> Path:
    for parent in [Path(__file__).resolve(), *Path(__file__).resolve().parents]:
        if (parent / "Zeta.sln").exists():
            return parent
    raise RuntimeError("root unavailable")


def _fsharp() -> str:
    return subprocess.run(
        ["dotnet", "fsi", "src/Research.FSharp/DurableRoomAdmissionReceipt.fsx"],
        cwd=_root(),
        check=True,
        capture_output=True,
        encoding="utf-8",
    ).stdout


def test_independent_fsharp_and_python_admission_receipts_match() -> None:
    assert _fsharp() == admission.render_receipt()


@pytest.mark.parametrize(
    "key",
    [
        "controlManifestDigest",
        "orderedCandidateEvidenceDigests",
        "preflightReceiptSha256",
        "sourceRevision",
    ],
)
def test_admission_field_mutations_are_refused(key: str) -> None:
    receipt = json.loads(admission.render_receipt())
    receipt["payload"][key] = "tampered"
    with pytest.raises(admission.AdmissionRefusal, match=key):
        admission.verify_object(receipt)
