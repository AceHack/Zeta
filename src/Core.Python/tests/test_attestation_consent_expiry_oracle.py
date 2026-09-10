from __future__ import annotations

import hashlib
import json
from pathlib import Path

from zeta.attestation_consent_expiry_oracle import (
    evaluate_test_only,
    render_canonical,
    verify_canonical_test_only,
)


def fixture() -> tuple[str, str]:
    record = {
        "id": "test-only",
        "at": "2026-09-07T12:01:00.000Z",
        "by": "otto",
        "kind": "attestation",
        "attestation": {
            "attestor": "otto",
            "attested": "alexa",
            "claim": "heartbeat-genuine",
            "windowStart": "2026-09-07T11:00:00.000Z",
            "windowEnd": "2026-09-07T12:00:00.000Z",
            "eventCount": 1,
            "attestedDigest": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            "strength": 1,
        },
    }
    raw = json.dumps(record, separators=(",", ":"))
    return raw, f"sha256:{hashlib.sha256(raw.encode('utf-8')).hexdigest()}"


def repository_root() -> Path:
    return Path(__file__).resolve().parents[3]


def test_test_only_window_statuses_are_structural_not_authority() -> None:
    raw, digest = fixture()
    receipt = evaluate_test_only(raw, digest, "2026-09-07T11:30:00.000Z")
    assert receipt["status"] == "within-declared-window"
    assert receipt["provenanceMode"] == "test-only-bound-adapter"
    assert all(
        key not in receipt
        for key in ("authority", "permission", "score", "vote", "consensus")
    )
    assert render_canonical(receipt).endswith("\n")


def test_changed_fixture_refuses() -> None:
    raw, digest = fixture()
    assert evaluate_test_only(f"{raw} ", digest, "2026-09-07T11:30:00.000Z") == {
        "kind": "refuse",
        "reason": "identity-mismatch",
    }


def test_committed_test_only_receipts_replay_and_refuse_order_or_authority_mutations() -> (
    None
):
    root = repository_root()
    fixture_raw = (
        root / "tests/fixtures/attestation-consent-expiry-test-only-record.json"
    ).read_text(encoding="utf-8")
    digest = f"sha256:{hashlib.sha256(fixture_raw.encode('utf-8')).hexdigest()}"
    typescript = (
        root
        / "docs/research/data/2026-09-07-attestation-consent-expiry-v1-typescript.json"
    ).read_text(encoding="utf-8")
    python = (
        root / "docs/research/data/2026-09-07-attestation-consent-expiry-v1-python.json"
    ).read_text(encoding="utf-8")
    assert typescript == python
    assert verify_canonical_test_only(
        fixture_raw, digest, "2026-09-07T11:30:00.000Z", python
    )
    parsed = json.loads(python)
    assert not verify_canonical_test_only(
        fixture_raw,
        digest,
        "2026-09-07T11:30:00.000Z",
        f"{json.dumps({'status': parsed['status'], **parsed}, separators=(',', ':'))}\n",
    )
    assert not verify_canonical_test_only(
        fixture_raw,
        digest,
        "2026-09-07T11:30:00.000Z",
        f"{json.dumps({**parsed, 'authority': 'forbidden'}, separators=(',', ':'))}\n",
    )
