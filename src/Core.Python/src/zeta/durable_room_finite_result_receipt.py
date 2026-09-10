"""Independent score-free finite durable-room result receipt verifier."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from zeta import durable_room_admission_receipt as admission
from zeta import durable_room_max_decorrelation_preflight as preflight


class ResultRefusal(ValueError):
    pass


def _canonical(value: object) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True)


def payload_object() -> dict[str, object]:
    preflight_receipt = json.loads(preflight.render_receipt())
    payload = preflight_receipt["payload"]
    admission_receipt = json.loads(admission.render_receipt())
    return {
        "admissionReceiptSha256": admission_receipt["canonicalReceiptSha256"],
        "anchorBytesSha256": payload["anchorBytesSha256"],
        "carrierId": payload["carrierId"],
        "catalogueSha256": payload["catalogueSha256"],
        "controlManifestDigest": payload["controlManifestDigest"],
        "noPassingCandidateReason": "",
        "observedCatalogueEntries": payload["candidates"],
        "orderedCandidateEvidenceDigests": payload["orderedCandidateEvidenceDigests"],
        "resultState": "observed-finite-catalogue",
        "schema": "zeta.max-decorrelate-reconcile/result/v1",
        "sourceRevision": payload["sourceRevision"],
    }


def render_receipt() -> str:
    payload = payload_object()
    encoded = _canonical(payload)
    return (
        _canonical(
            {
                "canonicalReceiptSha256": hashlib.sha256(encoded.encode()).hexdigest(),
                "payload": payload,
            }
        )
        + "\n"
    )


def verify_object(receipt: dict[str, Any]) -> None:
    payload = receipt.get("payload")
    if (
        not isinstance(payload, dict)
        or payload.get("schema") != "zeta.max-decorrelate-reconcile/result/v1"
    ):
        raise ResultRefusal("refuse-schema")
    if payload.get("resultState") not in {
        "observed-finite-catalogue",
        "no-passing-candidate",
        "unmeasured",
    }:
        raise ResultRefusal("refuse-result-state")
    if payload.get("winner") is not None or payload.get("argmax") is not None:
        raise ResultRefusal("refuse-selection-field")
    if _canonical(receipt) + "\n" != render_receipt():
        raise ResultRefusal("refuse-canonical-receipt")
