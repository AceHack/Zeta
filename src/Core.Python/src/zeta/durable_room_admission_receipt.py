"""Independent score-free immutable admission receipt for durable-room evidence."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from zeta import durable_room_max_decorrelation_preflight as preflight


class AdmissionRefusal(ValueError):
    pass


def _canonical(value: object) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def payload_object() -> dict[str, object]:
    preflight_receipt = json.loads(preflight.render_receipt())
    payload = preflight_receipt["payload"]
    return {
        "admissionState": "eligible-for-separate-result-review",
        "anchorBytesSha256": payload["anchorBytesSha256"],
        "carrierId": payload["carrierId"],
        "catalogueSha256": payload["catalogueSha256"],
        "controlManifestDigest": payload["controlManifestDigest"],
        "independentReceiptAgreement": True,
        "orderedCandidateEvidenceDigests": payload["orderedCandidateEvidenceDigests"],
        "preflightReceiptSha256": preflight_receipt["canonicalReceiptSha256"],
        "refusalCodes": [],
        "schema": "zeta.max-decorrelate-reconcile/admission/v1",
        "sourceRevision": payload["sourceRevision"],
    }


def render_receipt() -> str:
    payload = payload_object()
    encoded = _canonical(payload)
    return (
        _canonical({"canonicalReceiptSha256": _sha256(encoded), "payload": payload})
        + "\n"
    )


def verify_object(receipt: dict[str, Any]) -> None:
    payload = receipt.get("payload")
    if not isinstance(payload, dict):
        raise AdmissionRefusal("refuse-payload-shape")
    if payload.get("schema") != "zeta.max-decorrelate-reconcile/admission/v1":
        raise AdmissionRefusal("refuse-schema")
    if payload.get("admissionState") != "eligible-for-separate-result-review":
        raise AdmissionRefusal("refuse-admission-state")
    if payload.get("refusalCodes") != [] or not payload.get(
        "independentReceiptAgreement"
    ):
        raise AdmissionRefusal("refuse-agreement")
    expected = payload_object()
    for key in (
        "controlManifestDigest",
        "orderedCandidateEvidenceDigests",
        "preflightReceiptSha256",
        "sourceRevision",
    ):
        if payload.get(key) != expected[key]:
            raise AdmissionRefusal(f"refuse-{key}")
    if _canonical(receipt) + "\n" != render_receipt():
        raise AdmissionRefusal("refuse-canonical-receipt")
