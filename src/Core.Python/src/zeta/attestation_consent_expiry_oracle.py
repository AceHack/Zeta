"""Independent structural oracle for the finite test-only attestation window receipt.

This module does not verify an SSH signature and cannot establish consent or authority.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

SCHEMA = "zeta.attestation-consent-expiry-receipt/v1"
SCOPE = "attestation-window-observation"
MODE = "local-status-only"


def sha256_utf8(value: str) -> str:
    return f"sha256:{hashlib.sha256(value.encode('utf-8')).hexdigest()}"


def evaluate_test_only(
    raw_record_utf8: str, record_sha256: str, evaluation_instant: str
) -> dict[str, str]:
    """Check the finite fixture structurally with a declared test-only bound adapter."""
    if sha256_utf8(raw_record_utf8) != record_sha256:
        return {"kind": "refuse", "reason": "identity-mismatch"}
    try:
        record: Any = json.loads(raw_record_utf8)
        attestation = record["attestation"]
        start = attestation["windowStart"]
        end = attestation["windowEnd"]
    except KeyError, TypeError, json.JSONDecodeError:
        return {"kind": "refuse", "reason": "malformed-record"}
    if not all(
        isinstance(value, str) and value.endswith("Z")
        for value in (start, end, evaluation_instant)
    ):
        return {"kind": "refuse", "reason": "malformed-window-or-instant"}
    status = "within-declared-window"
    if evaluation_instant < start:
        status = "not-yet-declared-window"
    elif evaluation_instant > end:
        status = "expired-declared-window"
    return {
        "schema": SCHEMA,
        "provenanceMode": "test-only-bound-adapter",
        "attestationRecordSha256": record_sha256,
        "scopeId": SCOPE,
        "evaluationInstant": evaluation_instant,
        "evaluationMode": MODE,
        "status": status,
    }


def render_canonical(receipt: dict[str, str]) -> str:
    return json.dumps(receipt, separators=(",", ":")) + "\n"


def verify_canonical_test_only(
    raw_record_utf8: str,
    record_sha256: str,
    evaluation_instant: str,
    receipt: str,
) -> bool:
    """Reject altered, reordered, or authority-bearing test-only receipt bytes."""
    expected = evaluate_test_only(raw_record_utf8, record_sha256, evaluation_instant)
    forbidden = {
        "authority",
        "permission",
        "score",
        "vote",
        "threshold",
        "quorum",
        "consensus",
        "trust",
    }
    try:
        parsed: Any = json.loads(receipt)
    except json.JSONDecodeError:
        return False
    if not isinstance(parsed, dict) or any(key in parsed for key in forbidden):
        return False
    return receipt == render_canonical(expected)
