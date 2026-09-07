from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import asdict
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_bindings as b


def _raw(value: Any) -> bytes:
    return json.dumps(value, separators=(",", ":"), sort_keys=True).encode()


def _digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest().upper()


def _descriptor(role: str, raw: bytes) -> dict[str, Any]:
    return {
        "File": role + ".json",
        "Bytes": len(raw),
        "Sha256": _digest(raw),
        "Encoding": "identity",
        "StoredBytes": len(raw),
        "StoredSha256": _digest(raw),
    }


def _stamp(ns: int) -> str:
    return f"2026-09-07T00:00:00.{ns:09d}Z"


def _fixture(
    changed_context: tuple[int, str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, tuple[bytes, bytes]]]:
    context = {
        "ProtocolSha256": a.PROTOCOL_SHA256,
        "SourceCommit": "1" * 40,
        "NumericCertificateSha256": "2" * 64,
        "NativeRecordSha256": "3" * 64,
    }
    inputs: list[dict[str, Any]] = []
    records: list[dict[str, Any]] = []
    artifacts: dict[str, tuple[bytes, bytes]] = {}
    for index, role in enumerate(b.ROLES):
        actual_context = copy.deepcopy(context)
        if changed_context is not None and index == changed_context[0]:
            actual_context[changed_context[1]] = changed_context[2]
        raw = _raw(
            {
                "Role": role,
                "Context": actual_context,
                "Inputs": copy.deepcopy(inputs),
                "Payload": {"Witness": 0},
            }
        )
        descriptor = _descriptor(role, raw)
        records.append({"Role": role, "Artifact": descriptor})
        artifacts[descriptor["File"]] = (raw, raw)
        inputs.append({"Role": role, "Bytes": len(raw), "Sha256": _digest(raw)})
    expected = {"Context": context, "Inputs": inputs}
    fixture = {
        "Records": records,
        "Expected": copy.deepcopy(expected),
        "Timeline": {key: _stamp(index) for index, key in enumerate(b.TIMELINE_FIELDS)},
    }
    return fixture, expected, artifacts


def _last_raw(
    fixture: dict[str, Any],
    expected: dict[str, Any],
    artifacts: dict[str, tuple[bytes, bytes]],
    raw: bytes,
    *,
    refresh_expected: bool = False,
) -> None:
    descriptor = _descriptor("replay", raw)
    fixture["Records"][-1]["Artifact"] = descriptor
    artifacts[descriptor["File"]] = (raw, raw)
    if refresh_expected:
        expected["Inputs"][-1] = {
            "Role": "replay",
            "Bytes": len(raw),
            "Sha256": _digest(raw),
        }
        fixture["Expected"] = copy.deepcopy(expected)


def _refused(
    result: a.Admitted[b.BindingSubjects] | b.BindingSubjectsRefused,
) -> b.BindingSubjectsRefused:
    assert isinstance(result, b.BindingSubjectsRefused), result
    return result


def test_complete_chain_and_scoped_result() -> None:
    fixture, expected, artifacts = _fixture()
    result = b.admit_binding_subjects(fixture, expected, artifacts)
    assert isinstance(result, a.Admitted), result
    assert [asdict(row) for row in result.value.Subjects] == expected["Inputs"]
    assert result.value.Scope == "seven-synthetic-binding-subjects-only"
    assert result.value.ScientificPhaseAndRuntimeAdmission == "not-performed"
    values = [ns for _, ns in result.value.Timeline]
    assert [value - values[0] for value in values] == list(range(10))


@pytest.mark.parametrize("variant", ["leading-space", "escaped-key"])
def test_semantically_identical_bytes_require_shared_binding_and_mutant_witness(
    variant: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixture, expected, artifacts = _fixture()
    original = artifacts["replay.json"][1]
    changed = (
        b" " + original
        if variant == "leading-space"
        else original.replace(b'"Witness"', b'"\\u0057itness"')
    )
    assert changed != original and json.loads(changed) == json.loads(original)
    _last_raw(fixture, expected, artifacts, changed)
    result = _refused(b.admit_binding_subjects(fixture, expected, artifacts))
    assert result.code == "input-envelope-bytes"
    assert (
        result.path == "Records[6].Expected.Subject" and result.CompletedSubjects == 6
    )
    witness = b.require_binding_refusal(result, code=result.code, path=result.path)
    assert isinstance(witness, a.Admitted)
    # Explicit fixture-only fault: keep JSON, descriptors, context, links,
    # scientific-adapter shape and chronology live. Production has no switch.
    monkeypatch.setattr(
        b, "_match_input_envelope_bytes", lambda *_args: a.Admitted(None)
    )
    mutant = b.admit_binding_subjects(fixture, expected, artifacts)
    assert isinstance(mutant, a.Admitted), mutant
    caught = b.require_binding_refusal(mutant, code=result.code, path=result.path)
    assert isinstance(caught, a.Refused) and caught.code == "negative-outcome"


@pytest.mark.parametrize(
    "field,value",
    [
        ("SourceCommit", "4" * 40),
        ("NumericCertificateSha256", "5" * 64),
        ("NativeRecordSha256", "6" * 64),
    ],
)
def test_changed_actual_metadata_refuses_even_with_all_bytes_and_links_rebound(
    field: str, value: str
) -> None:
    fixture, expected, artifacts = _fixture((5, field, value))
    result = _refused(b.admit_binding_subjects(fixture, expected, artifacts))
    assert result.code == "binding-context" and result.path == "Records[5].Context"
    assert result.CompletedSubjects == 5


def test_primitive_extracts_metadata_from_bound_bytes_not_detached_self_report() -> (
    None
):
    fixture, expected, artifacts = _fixture()
    original = artifacts["replay.json"][1]
    detached = json.loads(original)
    detached["Context"]["SourceCommit"] = "7" * 40
    changed = _raw(detached)
    # Even when the expected complete-byte identity is explicitly updated,
    # the actual changed metadata in those bytes cannot be paired with the
    # unchanged context through this API.
    expectation = b.BindingExpectation(
        expected["Context"],
        {"Role": "replay", "Bytes": len(changed), "Sha256": _digest(changed)},
        expected["Inputs"][:-1],
    )
    result = b.admit_binding_subject(
        _descriptor("replay", changed), changed, changed, expectation
    )
    assert isinstance(result, a.Refused) and result.code == "binding-context"
    # Rewriting detached data never rewrites the original immutable bytes.
    good = b.BindingExpectation(
        expected["Context"], expected["Inputs"][-1], expected["Inputs"][:-1]
    )
    result = b.admit_binding_subject(
        fixture["Records"][-1]["Artifact"], original, original, good
    )
    assert isinstance(result, a.Admitted)


@pytest.mark.parametrize("index", range(7))
def test_every_complete_subject_byte_binding_checked_with_prefix(index: int) -> None:
    fixture, expected, artifacts = _fixture()
    expected["Inputs"][index]["Sha256"] = "F" * 64
    fixture["Expected"] = copy.deepcopy(expected)
    result = _refused(b.admit_binding_subjects(fixture, expected, artifacts))
    assert result.code == "input-envelope-bytes" and result.CompletedSubjects == index


def test_exact_upstream_links_not_just_individual_subject_identities() -> None:
    fixture, expected, artifacts = _fixture()
    value = json.loads(artifacts["replay.json"][1])
    value["Inputs"][2]["Sha256"] = "E" * 64
    _last_raw(fixture, expected, artifacts, _raw(value), refresh_expected=True)
    result = _refused(b.admit_binding_subjects(fixture, expected, artifacts))
    assert result.code == "input-links" and result.path == "Records[6].Inputs"
    value["Inputs"][2]["Sha256"] = expected["Inputs"][2]["Sha256"]
    value["Inputs"][2], value["Inputs"][3] = value["Inputs"][3], value["Inputs"][2]
    _last_raw(fixture, expected, artifacts, _raw(value), refresh_expected=True)
    assert (
        _refused(b.admit_binding_subjects(fixture, expected, artifacts)).code
        == "input-links"
    )


def test_fixture_cannot_admit_its_own_replaced_expected_map() -> None:
    fixture, expected, artifacts = _fixture()
    fixture["Expected"]["Inputs"][-1]["Sha256"] = "A" * 64
    result = _refused(b.admit_binding_subjects(fixture, expected, artifacts))
    assert result.code == "binding-expectation" and result.CompletedSubjects == 0


@pytest.mark.parametrize("bad", [True, 12.0, -1, "12", a.INT64_MAX + 1])
def test_expected_byte_counts_do_not_coerce(bad: Any) -> None:
    fixture, expected, artifacts = _fixture()
    expected["Inputs"][-1]["Bytes"] = bad
    fixture["Expected"] = copy.deepcopy(expected)
    result = _refused(b.admit_binding_subjects(fixture, expected, artifacts))
    assert result.code == "integer" and result.path == "Expected.Inputs[6].Bytes"


@pytest.mark.parametrize("bad", ["1" * 39, "A" * 40, "g" * 40, 123, None])
def test_source_commit_is_full_lowercase(bad: Any) -> None:
    fixture, expected, artifacts = _fixture((5, "SourceCommit", bad))
    result = _refused(b.admit_binding_subjects(fixture, expected, artifacts))
    assert result.code == "binding-commit" and result.CompletedSubjects == 5


def test_artifact_relation_is_still_live_under_omission_mutant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixture, expected, artifacts = _fixture()
    original = artifacts["replay.json"][1]
    artifacts["replay.json"] = (b" " + original, original)
    monkeypatch.setattr(
        b, "_match_input_envelope_bytes", lambda *_args: a.Admitted(None)
    )
    result = _refused(b.admit_binding_subjects(fixture, expected, artifacts))
    assert result.code != "input-envelope-bytes" and result.CompletedSubjects == 6


@pytest.mark.parametrize(
    "mutation",
    [
        "extra-file",
        "missing-file",
        "duplicate-file",
        "bad-pair",
        "reordered",
        "truncated",
    ],
)
def test_exact_materialized_and_record_rosters(mutation: str) -> None:
    fixture, expected, artifacts = _fixture()
    if mutation == "extra-file":
        artifacts["extra.json"] = (b"x", b"x")
    elif mutation == "missing-file":
        del artifacts["cost.json"]
    elif mutation == "duplicate-file":
        fixture["Records"][5]["Artifact"]["File"] = "replay.json"
    elif mutation == "bad-pair":
        artifacts["cost.json"] = (bytearray(b"x"), b"x")  # type: ignore[assignment]
    elif mutation == "reordered":
        fixture["Records"][-2:] = reversed(fixture["Records"][-2:])
        expected["Inputs"][-2:] = reversed(expected["Inputs"][-2:])
        fixture["Expected"] = copy.deepcopy(expected)
    else:
        fixture["Records"].pop()
    assert isinstance(
        b.admit_binding_subjects(fixture, expected, artifacts), b.BindingSubjectsRefused
    )


@pytest.mark.parametrize(
    "mutation",
    [
        "duplicate-json",
        "wrong-role",
        "extra-payload",
        "bool-witness",
        "missing-context",
        "extra-top-level",
        "self-link",
    ],
)
def test_actual_raw_schema_and_context_cannot_hide_behind_fresh_hashes(
    mutation: str,
) -> None:
    fixture, expected, artifacts = _fixture()
    raw = artifacts["replay.json"][1]
    value = json.loads(raw)
    if mutation == "duplicate-json":
        changed = raw.replace(b'"Role":"replay"', b'"Role":"replay","Role":"replay"')
    else:
        if mutation == "wrong-role":
            value["Role"] = "cost"
        elif mutation == "extra-payload":
            value["Payload"]["Extra"] = 0
        elif mutation == "bool-witness":
            value["Payload"]["Witness"] = False
        elif mutation == "missing-context":
            del value["Context"]
        elif mutation == "extra-top-level":
            value["Passed"] = True
        else:
            value["Inputs"].append(expected["Inputs"][-1])
        changed = _raw(value)
    _last_raw(fixture, expected, artifacts, changed, refresh_expected=True)
    result = _refused(b.admit_binding_subjects(fixture, expected, artifacts))
    assert result.CompletedSubjects == 6 and result.code != "input-envelope-bytes"


def test_shared_boundary_leaves_scientific_phase_schema_to_its_parser() -> None:
    fixture, expected, artifacts = _fixture()
    value = json.loads(artifacts["replay.json"][1])
    value["Payload"] = {"ScientificValues": [1, 2, 3]}
    _last_raw(fixture, expected, artifacts, _raw(value), refresh_expected=True)
    raw = artifacts["replay.json"][1]
    primitive = b.admit_binding_subject(
        fixture["Records"][-1]["Artifact"],
        raw,
        raw,
        b.BindingExpectation(
            expected["Context"], expected["Inputs"][-1], expected["Inputs"][:-1]
        ),
    )
    assert isinstance(primitive, a.Admitted)
    synthetic = _refused(b.admit_binding_subjects(fixture, expected, artifacts))
    assert synthetic.code == "fields" and synthetic.path == "Records[6].Payload"


def test_closure_and_exit_are_unordered_and_equal_timestamps_allowed() -> None:
    fixture, expected, artifacts = _fixture()
    timeline = fixture["Timeline"]
    timeline["BehaviorClosed"], timeline["BehaviorExit"] = (
        timeline["BehaviorExit"],
        timeline["BehaviorClosed"],
    )
    assert isinstance(
        b.admit_binding_subjects(fixture, expected, artifacts), a.Admitted
    )
    fixture["Timeline"] = {key: _stamp(0) for key in b.TIMELINE_FIELDS}
    assert isinstance(
        b.admit_binding_subjects(fixture, expected, artifacts), a.Admitted
    )


@pytest.mark.parametrize(
    "before,after",
    [
        ("BehaviorFinish", "BehaviorClosed"),
        ("BehaviorFinish", "BehaviorExit"),
        ("BehaviorClosed", "CostStarted"),
        ("BehaviorExit", "CostStarted"),
        ("CostStarted", "BehaviorReadStarted"),
        ("BehaviorReadStarted", "BehaviorReadFinished"),
        ("BehaviorReadFinished", "AdmissionFinished"),
        ("AdmissionFinished", "FirstPolicyCall"),
        ("FirstPolicyCall", "SetupFinished"),
        ("SetupFinished", "FirstRowStarted"),
    ],
)
def test_every_partial_order_edge_rejects_one_nanosecond_reversal(
    before: str, after: str
) -> None:
    timeline = {key: _stamp(0) for key in b.TIMELINE_FIELDS}
    timeline[before] = _stamp(1)
    if before == "BehaviorFinish":
        # Preserve the other finish branch and its entire downstream chain;
        # exactly the selected edge is reversed, so dropping it is observable.
        other = "BehaviorExit" if after == "BehaviorClosed" else "BehaviorClosed"
        timeline[other] = _stamp(1)
        for key in b.TIMELINE_FIELDS[3:]:
            timeline[key] = _stamp(1)
    result = b.admit_phase_chronology(timeline)
    assert isinstance(result, a.Refused) and result.code == "phase-chronology"
    assert result.path == "Timeline." + after


def test_late_chronology_failure_retains_all_subjects() -> None:
    fixture, expected, artifacts = _fixture()
    fixture["Timeline"]["CostStarted"] = "2026-09-06T23:59:59.999999999Z"
    result = _refused(b.admit_binding_subjects(fixture, expected, artifacts))
    assert result.code == "phase-chronology" and result.CompletedSubjects == 7


@pytest.mark.parametrize(
    "bad", [None, False, "2026-09-07T00:00:00.0000000001Z", "2026-09-07T00:00:00-01:00"]
)
def test_no_ambiguous_or_rounded_timeline(bad: Any) -> None:
    fixture, expected, artifacts = _fixture()
    fixture["Timeline"]["BehaviorClosed"] = bad
    result = _refused(b.admit_binding_subjects(fixture, expected, artifacts))
    assert result.code == "utc" and result.CompletedSubjects == 7
