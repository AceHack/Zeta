"""Independent verifier for the finite score-free durable-room preflight.

This module independently constructs the pinned bytes and receipt. It does not
call F#, TypeScript, an ARC runner, or a candidate-selection helper.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

SCHEMA = "zeta.max-decorrelate-reconcile/preflight/v1"
CARRIER = "zeta.durable-room-evidence/v1"


class PreflightRefusal(ValueError):
    """Raised when a receipt violates a pinned preflight boundary."""


def _canonical(value: object) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _source_revision() -> str:
    root = Path(__file__).resolve()
    for parent in [root, *root.parents]:
        if (parent / "Zeta.sln").exists():
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=parent,
                check=True,
                capture_output=True,
                encoding="utf-8",
            )
            return result.stdout.strip()
    raise PreflightRefusal("refuse-source-revision-unavailable")


def _anchor() -> dict[str, object]:
    return {
        "actionBudget": 32,
        "actionCount": 11,
        "channelFingerprint": "channel:udp-a",
        "elapsedMs": 200,
        "episodeId": "episode-1",
        "factId": "fact-1",
        "roomFingerprint": "room:arc-v1",
        "roomId": "chip9-arc-room",
        "runId": "run-1",
        "schema": CARRIER,
        "signatureSplit": "split:agent-a",
        "solved": True,
        "sourceArtifact": "sha256:trajectory-1",
        "spectrumSlice": "rainbow:blue",
        "timeBudgetMs": 500,
        "uncertainty": {"meanPpm": 650000, "precisionPpm": 20},
        "weight": 1,
    }


def _candidate(
    candidate_id: str,
    atom_sequence: list[str],
    intermediate: str,
    mean_ppm: int,
    precision_ppm: int,
    action_count: int,
    witness: str,
) -> dict[str, object]:
    return {
        "atomSequence": atom_sequence,
        "candidateId": candidate_id,
        "causalOrderDigest": _sha256("\n".join(atom_sequence)),
        "decorrelationScore": abs(650000 - mean_ppm)
        + abs(20 - precision_ppm)
        + abs(11 - action_count),
        "finalView": {
            "actionCount": action_count,
            "meanPpm": mean_ppm,
            "precisionPpm": precision_ppm,
        },
        "intermediateStatus": intermediate,
        "reconciliationOutcome": "pass",
        "reconciliationWitness": witness,
    }


def _control_manifest() -> dict[str, str]:
    return {
        "anchor": "observed",
        "catalogue": "observed",
        "chshSidecar": "observed",
        "currentCandidatePreload": "refused",
        "identity": "observed",
        "metric": "observed",
        "priorMemory": "accepted",
        "reconciliationWitness": "observed",
        "retractionOrder": "observed",
    }


def _observation_barriers() -> list[dict[str, str]]:
    return [
        {"candidateId": candidate_id, "currentCandidatePreload": "refused"}
        for candidate_id in [
            "identity/v1",
            "replace-uncertainty/v1",
            "retract-replace/v1",
        ]
    ]


def payload_object() -> dict[str, object]:
    anchor_bytes = _canonical(_anchor())
    catalogue = ["identity/v1", "replace-uncertainty/v1", "retract-replace/v1"]
    candidates = [
        _candidate(
            "identity/v1",
            ["anchor-positive"],
            "resolved",
            650000,
            20,
            11,
            "anchor-resolved-tuple/v1",
        ),
        _candidate(
            "replace-uncertainty/v1",
            ["old-positive", "old-retraction", "replacement-positive"],
            "resolved",
            800000,
            40,
            8,
            "replacement-resolved-tuple/v1",
        ),
        _candidate(
            "retract-replace/v1",
            ["old-retraction", "old-positive", "replacement-positive"],
            "unresolved",
            800000,
            40,
            8,
            "replacement-after-unresolved-replay/v1",
        ),
    ]
    return {
        "anchorBytes": anchor_bytes,
        "anchorBytesSha256": _sha256(anchor_bytes),
        "candidates": candidates,
        "catalogue": catalogue,
        "catalogueSha256": _sha256(_canonical(catalogue)),
        "carrierId": CARRIER,
        "chshSidecar": "absent",
        "controlManifestDigest": _sha256(_canonical(_control_manifest())),
        "emitterIdentity": "fsharp-durable-room-preflight/v1",
        "memoryInputs": [
            {
                "acquisitionPhase": "prior-game",
                "availableAt": "run-start",
                "kind": "prior-memory",
                "sourceId": "chip8-orbit/v1",
            }
        ],
        "observationBarrierReceipts": _observation_barriers(),
        "orderedCandidateEvidenceDigests": [
            _sha256(_canonical(candidate)) for candidate in candidates
        ],
        "reconciliationDefinition": "resolved-tuple-equality/v1",
        "runtimeIdentities": ["dotnet-fsi/v1", "python-uv/v1"],
        "schema": SCHEMA,
        "sourceRevision": _source_revision(),
        "verifierIdentity": "python-durable-room-preflight/v1",
    }


def render_receipt() -> str:
    payload = payload_object()
    encoded_payload = _canonical(payload)
    return (
        _canonical(
            {"canonicalReceiptSha256": _sha256(encoded_payload), "payload": payload}
        )
        + "\n"
    )


def verify_receipt(text: str) -> None:
    if text != render_receipt():
        raise PreflightRefusal("refuse-canonical-receipt-mismatch")


def verify_object(receipt: dict[str, Any]) -> None:
    payload = receipt.get("payload", {})
    if not isinstance(payload, dict):
        raise PreflightRefusal("refuse-payload-shape")
    if payload.get("chshSidecar") != "absent":
        raise PreflightRefusal("refuse-chsh-sidecar")
    if payload.get("controlManifestDigest") != _sha256(_canonical(_control_manifest())):
        raise PreflightRefusal("refuse-control-manifest-mismatch")
    if payload.get("observationBarrierReceipts") != _observation_barriers():
        raise PreflightRefusal("refuse-observation-barrier-mismatch")
    if payload.get("catalogue") != [
        "identity/v1",
        "replace-uncertainty/v1",
        "retract-replace/v1",
    ]:
        raise PreflightRefusal("refuse-catalogue-mismatch")
    anchor_bytes = payload.get("anchorBytes")
    if not isinstance(anchor_bytes, str) or payload.get("anchorBytesSha256") != _sha256(
        anchor_bytes
    ):
        raise PreflightRefusal("refuse-anchor-hash-mismatch")
    candidates = payload.get("candidates")
    if not isinstance(candidates, list):
        raise PreflightRefusal("refuse-candidate-shape")
    if any(
        isinstance(row, dict) and "current-answer" in row.get("atomSequence", [])
        for row in candidates
    ):
        raise PreflightRefusal("refuse-current-candidate-preload")
    expected_witnesses = [
        "anchor-resolved-tuple/v1",
        "replacement-resolved-tuple/v1",
        "replacement-after-unresolved-replay/v1",
    ]
    expected_sequences = [
        ["anchor-positive"],
        ["old-positive", "old-retraction", "replacement-positive"],
        ["old-retraction", "old-positive", "replacement-positive"],
    ]
    for index, row in enumerate(candidates):
        if not isinstance(row, dict):
            raise PreflightRefusal("refuse-candidate-shape")
        if row.get("atomSequence") != expected_sequences[index]:
            raise PreflightRefusal("refuse-atom-order-mismatch")
        if row.get("causalOrderDigest") != _sha256(
            "\n".join(expected_sequences[index])
        ):
            raise PreflightRefusal("refuse-causal-order-mismatch")
        final = row.get("finalView")
        if not isinstance(final, dict):
            raise PreflightRefusal("refuse-final-view-shape")
        expected_score = (
            abs(650000 - final.get("meanPpm", 0))
            + abs(20 - final.get("precisionPpm", 0))
            + abs(11 - final.get("actionCount", 0))
        )
        if row.get("decorrelationScore") != expected_score:
            raise PreflightRefusal("refuse-metric-witness-mismatch")
        if (
            row.get("reconciliationWitness") != expected_witnesses[index]
            or row.get("reconciliationOutcome") != "pass"
        ):
            raise PreflightRefusal("refuse-reconciliation-witness-mismatch")
    if payload.get("orderedCandidateEvidenceDigests") != [
        _sha256(_canonical(row)) for row in candidates
    ]:
        raise PreflightRefusal("refuse-candidate-evidence-digest-mismatch")
    if payload.get("memoryInputs") != [
        {
            "acquisitionPhase": "prior-game",
            "availableAt": "run-start",
            "kind": "prior-memory",
            "sourceId": "chip8-orbit/v1",
        }
    ]:
        raise PreflightRefusal("refuse-declared-prior-memory-mismatch")
    if payload.get("sourceRevision") != _source_revision() or payload.get(
        "runtimeIdentities"
    ) != ["dotnet-fsi/v1", "python-uv/v1"]:
        raise PreflightRefusal("refuse-implementation-identity-mismatch")
    verify_receipt(_canonical(receipt) + "\n")
