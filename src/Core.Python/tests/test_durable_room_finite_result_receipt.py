from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest
from zeta import durable_room_finite_result_receipt as result

ROOT = Path(__file__).parents[3]


def test_fsharp_and_python_result_receipts_are_byte_identical() -> None:
    emitted = subprocess.run(
        ["dotnet", "fsi", "src/Research.FSharp/DurableRoomFiniteResultReceipt.fsx"],
        cwd=ROOT,
        capture_output=True,
        check=True,
        text=True,
    ).stdout
    assert emitted == result.render_receipt()


def test_result_rejects_injected_selection_field() -> None:
    receipt = json.loads(result.render_receipt())
    receipt["payload"]["winner"] = "identity/v1"
    with pytest.raises(result.ResultRefusal, match="selection-field"):
        result.verify_object(receipt)
