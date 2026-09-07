"""Independent finite NciNonUrgency receipt checker controls."""

from __future__ import annotations

import json
import shutil
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest

from zeta.nci_witness_receipt_oracle import (
    WitnessFailure,
    render_receipt,
    verify_pinned_subject,
    verify_receipt,
)

ROOT = Path(__file__).resolve().parents[3]
HISTORICAL_REGISTRY = (
    ROOT / "docs/research/data/2026-09-06-nci-witness-v1-registry.json"
)


def copied_subject(tmp_path: Path) -> Path:
    for relative in (
        Path("src/Core.TLA/specs/NciNonUrgency.tla"),
        Path("src/Core.TLA/specs/NciNonUrgency.cfg"),
        Path("src/Core.TLA/tla2tools.jar"),
        Path("registry/tlc-models.json"),
    ):
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        source = (
            HISTORICAL_REGISTRY
            if relative == Path("registry/tlc-models.json")
            else ROOT / relative
        )
        shutil.copy2(source, target)
    verify_pinned_subject(tmp_path)
    return tmp_path


def test_pinned_nci_subject_renders_a_canonical_receipt(tmp_path: Path) -> None:
    subject = copied_subject(tmp_path)
    receipt = render_receipt(subject)
    assert receipt.endswith("\n")
    verify_receipt(subject, receipt)


def test_committed_receipts_are_equal_and_replay_the_independent_canonical_form(
    tmp_path: Path,
) -> None:
    subject = copied_subject(tmp_path)
    typescript = (
        ROOT / "docs/research/data/2026-09-06-nci-witness-v1-typescript.json"
    ).read_text(encoding="utf-8")
    python = (
        ROOT / "docs/research/data/2026-09-06-nci-witness-v1-python.json"
    ).read_text(encoding="utf-8")
    assert typescript == python == render_receipt(subject)
    verify_receipt(subject, python)


def test_current_registry_cannot_reuse_the_historical_receipt(tmp_path: Path) -> None:
    subject = copied_subject(tmp_path)
    receipt = render_receipt(subject)
    shutil.copy2(
        ROOT / "registry/tlc-models.json", subject / "registry/tlc-models.json"
    )
    with pytest.raises(WitnessFailure, match="refuse-identity-mismatch") as refused:
        verify_receipt(subject, receipt)
    assert refused.value.detail == "registry/tlc-models.json"


def test_named_refusal_survives_contextmanager_traceback_assignment() -> None:
    @contextmanager
    def propagate() -> Iterator[None]:
        yield

    original = WitnessFailure("refuse-identity-mismatch", "registry/tlc-models.json")
    with pytest.raises(WitnessFailure) as refused, propagate():
        raise original
    assert refused.value is original
    assert str(refused.value) == "refuse-identity-mismatch: registry/tlc-models.json"


def test_mutated_config_is_refused_before_receipt_render(tmp_path: Path) -> None:
    subject = copied_subject(tmp_path)
    config = subject / "src/Core.TLA/specs/NciNonUrgency.cfg"
    config.write_text(
        config.read_text(encoding="utf-8") + "\\* mutation\n", encoding="utf-8"
    )
    with pytest.raises(WitnessFailure, match="refuse-identity-mismatch"):
        verify_pinned_subject(subject)


def test_altered_or_incomplete_json_receipt_is_refused(tmp_path: Path) -> None:
    subject = copied_subject(tmp_path)
    body = json.loads(render_receipt(subject))
    del body["checkedProperties"]
    with pytest.raises(WitnessFailure, match="refuse-receipt-mismatch"):
        verify_receipt(subject, json.dumps(body, separators=(",", ":")) + "\n")
    body = json.loads(render_receipt(subject))
    body["verdict"] = "policy-authorized"
    with pytest.raises(WitnessFailure, match="refuse-receipt-mismatch"):
        verify_receipt(subject, json.dumps(body, separators=(",", ":")) + "\n")


def test_python_oracle_has_no_typescript_emitter_dependency() -> None:
    source = (
        ROOT / "src/Core.Python/src/zeta/nci_witness_receipt_oracle.py"
    ).read_text(encoding="utf-8")
    assert "nci-witness-receipt" not in source
