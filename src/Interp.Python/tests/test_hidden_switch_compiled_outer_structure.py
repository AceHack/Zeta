from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import replace
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_conformance as c
from zeta_interp import hidden_switch_compiled_outer_structure as o
from zeta_interp import hidden_switch_compiled_sources as sources
from zeta_interp import hidden_switch_compiled_storage as storage


def identity(raw: bytes) -> o.ByteIdentity:
    return o.ByteIdentity(len(raw), hashlib.sha256(raw).hexdigest().upper())


def descriptor(name: str, raw: bytes = b"{}") -> dict[str, Any]:
    actual = identity(raw)
    return {
        "File": name,
        "Bytes": actual.Bytes,
        "Sha256": actual.Sha256,
        "Encoding": "identity",
        "StoredBytes": actual.Bytes,
        "StoredSha256": actual.Sha256,
    }


def fixture() -> tuple[dict[str, Any], o.ExpectedOuter]:
    expected = o.ExpectedOuter(
        "a" * 40,
        (
            o.ExpectedSource("source.py", 1, "A" * 64),
            o.ExpectedSource("helper.py", 2, "B" * 64),
        ),
        (
            ("ProtocolSha256", "C" * 64),
            ("source.py", "A" * 64),
            ("helper.py", "B" * 64),
        ),
        "D" * 64,
        "zeta_interp.hidden_switch_compiled_outer_cli",
        ("--outer", "attempt"),
        identity(b"{}"),
        tuple((name, identity(b"{}")) for name in o.PREREQUISITES),
    )
    rows = []
    for index, spec in enumerate(c.case_specs()):
        inputs = [
            {"Role": role, "Artifact": descriptor(f"i{index}-{j}.json")}
            for j, role in enumerate(spec.InputRoles)
        ]
        calls = [
            {
                "Sequence": j,
                "Operation": op.Operation,
                "InputRoles": list(op.InputRoles),
                "ResultArtifact": descriptor(f"r{index}-{j}.json"),
            }
            for j, op in enumerate(spec.Calls)
        ]
        rows.append(
            {
                "Index": index,
                "CaseId": spec.CaseId,
                "ControlId": spec.ControlId,
                "Inputs": inputs,
                "Calls": calls,
            }
        )
    row = {
        "Schema": o.SCHEMA,
        "AttemptId": "081M1XXWTTF087G0R000X1HMD0",
        "StartedAtUtc": "2026-09-07T22:00:00.000000001Z",
        "FinishedAtUtc": "2026-09-07T22:00:00.000000002Z",
        "Complete": True,
        "Failure": None,
        "SourceCommit": expected.SourceCommit,
        "SourceFiles": [
            {"File": s.File, "Bytes": s.Bytes, "Sha256": s.Sha256}
            for s in expected.SourceFiles
        ],
        "CertificateBindings": dict(expected.CertificateBindings),
        "NumericCertificateSha256": expected.NumericCertificateSha256,
        "Producer": {
            "EntryModule": expected.EntryModule,
            "Arguments": list(expected.Arguments),
            "PythonIdentity": descriptor("python.json"),
        },
        "Prerequisites": [
            {"Id": name, "Artifact": descriptor(f"p{index}.json")}
            for index, name in enumerate(o.PREREQUISITES)
        ],
        "Cases": rows,
        "Completed": {"Cases": 92, "Calls": 136},
        "SeparateObligations": list(o.OBLIGATIONS),
        "Scope": o.SCOPE,
    }
    return row, expected


def encode(row: dict[str, Any]) -> bytes:
    return json.dumps(row, separators=(",", ":")).encode()


def check(
    row: dict[str, Any], expected: o.ExpectedOuter
) -> a.Admitted[o.OuterStructure] | o.StructureFailure:
    return o.admit_outer_structure(encode(row), expected)


def failed(row: dict[str, Any], case: str | None, call: object) -> None:
    row["Complete"] = False
    row["Failure"] = {
        "Stage": "record",
        "CaseId": case,
        "Call": call,
        "Code": "actual-failure",
        "Path": "OwnedAttempt",
        "Detail": "The original failure is retained.",
    }


def test_complete_schema_is_only_an_immutable_read_plan(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    row, expected = fixture()

    def prohibited(*args: object, **kwargs: object) -> None:
        raise AssertionError("structure must not read artifacts or execute operations")

    monkeypatch.setattr(storage, "read_artifact", prohibited)
    monkeypatch.setattr(sources, "verify_source_files", prohibited)
    result = check(row, expected)
    assert isinstance(result, a.Admitted)
    assert result.value.Prefix.Cases == 92 and result.value.Prefix.Calls == 136
    assert result.value.Envelope == identity(encode(row))
    assert len(result.value.References) == 9 + sum(
        len(spec.InputRoles) + len(spec.Calls) for spec in c.case_specs()
    )
    assert result.value.References[0].Role == "producer-python-identity"
    assert tuple(ref.Role for ref in result.value.References[1:9]) == o.PREREQUISITES
    assert result.value.ArtifactReads == result.value.OutcomeReplay == "not-performed"
    assert result.value.SourceAndRuntimeAdmission == "caller-prerequisite-not-performed"
    before = result.value.References[-1].File
    row["Cases"][-1]["Calls"][-1]["ResultArtifact"]["File"] = "changed.json"
    assert result.value.References[-1].File == before


@pytest.mark.parametrize(
    "key,value",
    [
        ("Schema", "other"),
        ("Scope", "runtime-admitted"),
        ("SourceCommit", "b" * 40),
        ("NumericCertificateSha256", "E" * 64),
        ("AttemptId", "I" * 26),
        ("AttemptId", "8" + "0" * 25),
        ("AttemptId", "0" * 25),
        ("Complete", 1),
        ("SeparateObligations", []),
        ("SeparateObligations", list(reversed(o.OBLIGATIONS))),
        ("Failure", {}),
    ],
)
def test_context_and_obligations_cannot_self_admit(key: str, value: object) -> None:
    row, expected = fixture()
    row[key] = value
    assert isinstance(check(row, expected), o.StructureFailure)


@pytest.mark.parametrize(
    "kind",
    [
        "source-hash",
        "source-order",
        "source-bool",
        "source-extra",
        "binding",
        "entry",
        "arguments",
        "identity",
        "prerequisite-bytes",
        "prerequisite-order",
        "prerequisite-omission",
        "result-path",
        "late-call-bool",
        "declared-count",
    ],
)
def test_cross_field_substitutions_and_late_failures(kind: str) -> None:
    row, expected = fixture()
    if kind == "source-hash":
        row["SourceFiles"][0]["Sha256"] = "F" * 64
    elif kind == "source-order":
        row["SourceFiles"].reverse()
    elif kind == "source-bool":
        row["SourceFiles"][0]["Bytes"] = True
    elif kind == "source-extra":
        row["SourceFiles"][0]["Commit"] = expected.SourceCommit
    elif kind == "binding":
        row["CertificateBindings"]["source.py"] = "F" * 64
    elif kind == "entry":
        row["Producer"]["EntryModule"] = "arbitrary.module"
    elif kind == "arguments":
        row["Producer"]["Arguments"].append("--bypass")
    elif kind == "identity":
        row["Producer"]["PythonIdentity"] = descriptor("python.json", b" {}")
    elif kind == "prerequisite-bytes":
        row["Prerequisites"][-1]["Artifact"] = descriptor("p7.json", b" {}")
    elif kind == "prerequisite-order":
        row["Prerequisites"].reverse()
    elif kind == "prerequisite-omission":
        row["Prerequisites"].pop()
    elif kind == "result-path":
        row["Cases"][-1]["Calls"][-1]["ResultArtifact"]["File"] = "../escape"
    elif kind == "late-call-bool":
        row["Cases"][-1]["Calls"][-1]["Sequence"] = True
    elif kind == "declared-count":
        row["Completed"]["Calls"] = 135
    result = check(row, expected)
    assert isinstance(result, o.StructureFailure)
    if kind == "prerequisite-bytes":
        assert len(result.References) == 8
    if kind == "late-call-bool":
        assert (result.CheckedCaseRows, result.CheckedCalls) == (91, 135)


def test_whole_byte_variants_cannot_use_the_same_independent_identity() -> None:
    row, expected = fixture()
    row["Prerequisites"][0]["Artifact"] = descriptor("p0.json", b" {}")
    refused = check(row, expected)
    assert (
        isinstance(refused, o.StructureFailure)
        and refused.Problem.code == "outer-input-identity"
    )
    independent = replace(
        expected,
        Prerequisites=(("certificate", identity(b" {}")), *expected.Prerequisites[1:]),
    )
    assert isinstance(check(row, independent), a.Admitted)


def test_aliases_require_one_exact_descriptor() -> None:
    row, expected = fixture()
    row["Cases"][-1]["Calls"][-1]["ResultArtifact"] = copy.deepcopy(
        row["Producer"]["PythonIdentity"]
    )
    assert isinstance(check(row, expected), a.Admitted)
    row["Cases"][-1]["Calls"][-1]["ResultArtifact"] = descriptor(
        "python.json", b"other"
    )
    result = check(row, expected)
    assert (
        isinstance(result, o.StructureFailure)
        and result.Problem.code == "outer-artifact-alias"
    )
    assert result.CheckedCalls == 136


def test_utc_nanosecond_order_and_equal_times() -> None:
    row, expected = fixture()
    row["FinishedAtUtc"] = row["StartedAtUtc"]
    assert isinstance(check(row, expected), a.Admitted)
    row["FinishedAtUtc"] = "2026-09-07T22:00:00.000000000Z"
    assert isinstance(check(row, expected), o.StructureFailure)


@pytest.mark.parametrize(
    "returned,call", [(0, None), (0, 0), (1, 0), (1, 1), (2, 1), (2, None)]
)
def test_failed_final_case_keeps_accepted_cases_and_actual_return_prefix(
    returned: int, call: int | None
) -> None:
    row, expected = fixture()
    row["Cases"][-1]["Calls"] = row["Cases"][-1]["Calls"][:returned]
    row["Completed"] = {"Cases": 91, "Calls": 134 + returned}
    failed(row, c.case_specs()[-1].CaseId, call)
    result = check(row, expected)
    assert isinstance(result, a.Admitted)
    assert (
        result.value.Prefix.Cases == 91 and result.value.Prefix.Calls == 134 + returned
    )
    assert not result.value.Complete


@pytest.mark.parametrize(
    "kind",
    [
        "unrelated-case",
        "null-case",
        "call-bool",
        "future-call",
        "empty-detail",
        "missing-field",
    ],
)
def test_failed_location_cannot_relabel_retained_work(kind: str) -> None:
    row, expected = fixture()
    row["Cases"] = row["Cases"][:1]
    row["Cases"][0]["Calls"] = []
    row["Completed"] = {"Cases": 0, "Calls": 0}
    failed(row, c.case_specs()[0].CaseId, 0)
    if kind == "unrelated-case":
        row["Failure"]["CaseId"] = c.case_specs()[1].CaseId
    elif kind == "null-case":
        row["Failure"]["CaseId"] = None
    elif kind == "call-bool":
        row["Failure"]["Call"] = False
    elif kind == "future-call":
        row["Failure"]["Call"] = 1
    elif kind == "empty-detail":
        row["Failure"]["Detail"] = ""
    elif kind == "missing-field":
        del row["Failure"]["Path"]
    assert isinstance(check(row, expected), o.StructureFailure)


@pytest.mark.parametrize("after_all", [False, True])
def test_failure_outside_case_has_no_fabricated_call(after_all: bool) -> None:
    row, expected = fixture()
    if not after_all:
        row["Cases"] = []
        row["Completed"] = {"Cases": 0, "Calls": 0}
    failed(row, None, None)
    assert isinstance(check(row, expected), a.Admitted)


@pytest.mark.parametrize(
    "kind",
    [
        "object",
        "commit",
        "empty-sources",
        "duplicate-sources",
        "bool-source",
        "duplicate-binding",
        "missing-protocol",
        "wrong-prerequisites",
        "bool-identity",
        "arguments",
    ],
)
def test_malformed_independent_expectations_are_typed_refusals(kind: str) -> None:
    row, expected = fixture()
    value: object = expected
    if kind == "object":
        value = object()
    elif kind == "commit":
        value = replace(expected, SourceCommit="A" * 40)
    elif kind == "empty-sources":
        value = replace(expected, SourceFiles=())
    elif kind == "duplicate-sources":
        value = replace(
            expected, SourceFiles=(expected.SourceFiles[0], expected.SourceFiles[0])
        )
    elif kind == "bool-source":
        value = replace(
            expected, SourceFiles=(o.ExpectedSource("source.py", True, "A" * 64),)
        )
    elif kind == "duplicate-binding":
        value = replace(
            expected,
            CertificateBindings=(
                expected.CertificateBindings[0],
                expected.CertificateBindings[0],
            ),
        )
    elif kind == "missing-protocol":
        value = replace(expected, CertificateBindings=expected.CertificateBindings[1:])
    elif kind == "wrong-prerequisites":
        value = replace(expected, Prerequisites=tuple(reversed(expected.Prerequisites)))
    elif kind == "bool-identity":
        value = replace(expected, PythonIdentity=o.ByteIdentity(True, "A" * 64))
    elif kind == "arguments":
        value = replace(expected, Arguments=(False,))  # type: ignore[arg-type]
    assert isinstance(o.admit_outer_structure(encode(row), value), o.StructureFailure)


@pytest.mark.parametrize(
    "raw", [b'{"Schema":0,"Schema":1}', b"{", b"\xff", b"null", None]
)
def test_invalid_raw_envelopes_refuse_without_a_read_plan(raw: object) -> None:
    _, expected = fixture()
    result = o.admit_outer_structure(raw, expected)
    assert isinstance(result, o.StructureFailure) and result.References == ()


def test_late_structural_failure_retains_every_earlier_reference() -> None:
    row, expected = fixture()
    admitted = check(row, expected)
    assert isinstance(admitted, a.Admitted)
    row["Cases"][-1]["Calls"][-1]["Sequence"] = True
    refused = check(row, expected)
    assert isinstance(refused, o.StructureFailure)
    assert refused.References == admitted.value.References[:-1]


def test_late_case_header_failure_keeps_whole_prior_case_plans() -> None:
    row, expected = fixture()
    admitted = check(row, expected)
    assert isinstance(admitted, a.Admitted)
    row["Cases"][-1]["CaseId"] = "wrong"
    refused = check(row, expected)
    assert isinstance(refused, o.StructureFailure)
    earlier = tuple(
        ref for ref in admitted.value.References if not ref.At.startswith("Cases[91].")
    )
    assert refused.References == earlier
