from __future__ import annotations

import gzip
import hashlib
import json
from dataclasses import asdict, replace
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_bindings as b
from zeta_interp import hidden_switch_compiled_conformance as c
from zeta_interp import hidden_switch_compiled_cost_ledgers as costs
from zeta_interp import hidden_switch_compiled_static_fixtures as f

CONTEXT = b.BindingContext(a.PROTOCOL_SHA256, "1" * 40, "2" * 64, "3" * 64)
REFUSALS = {
    "json/duplicate-key": ("json-duplicate", "$"),
    "json/nonfinite": ("json-nonfinite", "$.Value"),
    "json/bool-integer": ("integer", "Raw.Count"),
    "json/extra-key": ("fields", "Raw"),
    "json/missing-key": ("fields", "Raw"),
    "json/truncated": ("json-parse", "$"),
    "json/invalid-utf8": ("json-parse", "$"),
    "artifact/stored-hash": ("artifact-hash", "Descriptor"),
    "artifact/original-hash": ("artifact-hash", "Descriptor"),
    "artifact/unrelated-gzip": ("artifact-gzip", "Descriptor"),
    "artifact/parent-path": ("artifact-path", "Descriptor.File"),
    "links/envelope-substitution": (
        "input-envelope-bytes",
        "Records[6].Expected.Subject",
    ),
    "links/source-substitution": ("binding-context", "Records[5].Context"),
    "links/certificate-substitution": ("binding-context", "Records[5].Context"),
    "links/runtime-substitution": ("binding-context", "Records[5].Context"),
    "links/reordered-inputs": ("input-roster", "Expected.Inputs"),
    "links/cost-before-behavior": ("phase-chronology", "Timeline.CostStarted"),
    "links/replay-substitution": (
        "input-envelope-bytes",
        "Records[6].Expected.Subject",
    ),
    "schedule/omitted": ("schedule-roster", "Schedule"),
    "schedule/reordered": ("schedule-value", "Schedule[0].Strategy"),
    "schedule/warmup": ("schedule-value", "Schedule[0].WarmupCalls"),
    "schedule/duplicate": ("schedule-value", "Schedule[1].Strategy"),
    "resources/zero-wall": ("integer", "Timing.WallNs"),
    "resources/negative-allocation": ("integer", "Timing.AllocatedBytes"),
    "resources/decreasing-gc": ("gc-delta", "Timing"),
    "resources/zero-native-allocation": ("zero-native-median", "RequiredMedian"),
}


def prepared(name: str) -> f.PreparedCase:
    result = f.prepare_static_case(name, context=CONTEXT)
    assert isinstance(result, a.Admitted), result
    return result.value


def execute(case: f.PreparedCase, index: object = 0) -> object:
    return f.execute_static_call(
        case.CaseId, index, case.Inputs, case.SupportingArtifacts
    )


@pytest.mark.parametrize("name", f.STATIC_CASE_IDS)
def test_fixed_actual_operations_retain_exact_boundary_and_all_results(
    name: str,
) -> None:
    case = prepared(name)
    spec = next(row for row in c.case_specs() if row.CaseId == name)
    assert tuple(row.Role for row in case.Inputs) == spec.InputRoles
    for index, _ in enumerate(spec.Calls):
        actual = execute(case, index)
        if name in REFUSALS:
            assert isinstance(actual, (a.Refused, b.BindingSubjectsRefused)), actual
            assert (actual.code, actual.path) == REFUSALS[name]
        else:
            assert isinstance(actual, a.Admitted), actual
        tree = c.result_tree(actual)
        assert isinstance(tree, a.Admitted), tree
        assert tree.value["Fields"]  # Full returned field projection is available.


def test_case_subset_has_32_cases_36_calls_without_native_or_io_cases() -> None:
    assert len(f.STATIC_CASE_IDS) == 32
    assert (
        sum(len(row.Calls) for row in c.case_specs() if row.CaseId in f.STATIC_CASE_IDS)
        == 36
    )
    assert not any(
        name.startswith(
            (
                "certificate/",
                "semantic/",
                "selector/",
                "choice/",
                "source/",
                "python/",
                "storage/",
            )
        )
        for name in f.STATIC_CASE_IDS
    )


def test_positive_json_preserves_signed_zero_and_exact_items() -> None:
    case = prepared("json/control")
    assert case.Inputs == (
        c.NamedInput("raw", b'{"Count":0,"Value":-0,"Items":[0,1]}'),
    )
    assert execute(case) == a.Admitted(f.JsonFixture(0, "8000000000000000", (0, 1)))
    for raw in (
        f.JSON_CONTROL.replace(b"-0", b"0"),
        f.JSON_CONTROL.replace(b"[0,1]", b"[false,1]"),
    ):
        assert isinstance(f.json_fixture_pipeline(raw), a.Refused)


def test_artifact_negative_descriptor_is_separate_from_actual_retained_bytes() -> None:
    case = prepared("artifact/unrelated-gzip")
    inputs = {row.Role: row.Raw for row in case.Inputs}
    descriptor = json.loads(inputs["descriptor"])
    assert gzip.decompress(inputs["stored"]) == b"ABD" and inputs["original"] == b"ABC"
    assert (
        descriptor["StoredSha256"]
        == hashlib.sha256(inputs["stored"]).hexdigest().upper()
    )
    assert (
        descriptor["Sha256"] == hashlib.sha256(inputs["original"]).hexdigest().upper()
    )
    assert inputs["stored"][4:8] == b"\0" * 4
    assert isinstance(execute(case), a.Refused)


@pytest.mark.parametrize(
    "name", ["links/envelope-substitution", "links/replay-substitution"]
)
def test_same_decoded_tree_fails_real_byte_check_and_live_omission_discriminator(
    name: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    baseline, case = prepared("links/control"), prepared(name)
    unchanged, altered = baseline.SupportingArtifacts[-1], case.SupportingArtifacts[-1]
    assert unchanged.Original != altered.Original
    assert json.loads(unchanged.Original) == json.loads(altered.Original)
    before = execute(case)
    assert (
        isinstance(before, b.BindingSubjectsRefused) and before.CompletedSubjects == 6
    )
    assert (
        before.code == "input-envelope-bytes"
        and before.path == "Records[6].Expected.Subject"
    )
    monkeypatch.setattr(
        b, "_match_input_envelope_bytes", lambda *_args: a.Admitted(None)
    )
    actual_mutant = execute(case)
    assert isinstance(actual_mutant, a.Admitted)
    actual_checker = b.require_binding_refusal(
        actual_mutant, code=before.code, path=before.path
    )
    assert (
        isinstance(actual_checker, a.Refused)
        and actual_checker.code == "negative-outcome"
    )


@pytest.mark.parametrize(
    "name,field",
    [
        ("links/source-substitution", "SourceCommit"),
        ("links/certificate-substitution", "NumericCertificateSha256"),
        ("links/runtime-substitution", "NativeRecordSha256"),
    ],
)
def test_cost_metadata_change_refreshes_all_byte_links_but_not_expected_context(
    name: str, field: str
) -> None:
    case = prepared(name)
    values = {row.Role: json.loads(row.Raw) for row in case.Inputs}
    cost = json.loads(case.SupportingArtifacts[5].Original)
    assert values["expected"]["Context"] == asdict(CONTEXT)
    assert cost["Context"][field] != values["expected"]["Context"][field]
    for index, artifact in enumerate(case.SupportingArtifacts):
        expected = values["expected"]["Inputs"][index]
        assert expected["Bytes"] == len(artifact.Original)
        assert (
            expected["Sha256"] == hashlib.sha256(artifact.Original).hexdigest().upper()
        )
    result = execute(case)
    assert (
        isinstance(result, b.BindingSubjectsRefused) and result.CompletedSubjects == 5
    )


def test_exact_resource_control_and_half_boundary_values() -> None:
    case = prepared("resources/control")
    assert execute(case, 1) == a.Admitted(
        costs.DescriptiveRatio(0, 0, None, "zero-native-cpu")
    )
    assert execute(case, 2) == a.Admitted(
        costs.DescriptiveRatio(0, 1, costs.CanonicalRatio("0", "1"), None)
    )
    half = prepared("resources/half-threshold")
    assert execute(half, 0) == a.Admitted(
        {"Numerator": 2**53, "Denominator": 2**54, "AtMostHalf": True}
    )
    assert execute(half, 1) == a.Admitted(
        {"Numerator": 2**53 + 1, "Denominator": 2**54, "AtMostHalf": False}
    )


def test_dispatch_preserves_actual_result_object_and_calls_one_operation_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    marker = a.Refused("injected-real-boundary", "real-call", "retain exactly")
    calls: list[tuple[object, ...]] = []

    def bind(*args: object) -> a.Refused:
        calls.append(args)
        return marker

    monkeypatch.setattr(a, "bind_artifact_bytes", bind)
    case = prepared("artifact/control")
    assert not calls  # Preparation never runs the operation.
    first = execute(case, 0)
    assert first is marker and len(calls) == 1
    second = execute(case, 1)
    assert second is marker and len(calls) == 2
    assert calls[0][1:3] == (b"ABC", b"ABC")
    assert calls[1][1] != b"ABC" and calls[1][2] == b"ABC"


@pytest.mark.parametrize(
    "bad", [None, True, "json/unknown", "source/control", "artifact/symlink-path"]
)
def test_case_domain_rejects_unknown_and_other_family_ids(bad: object) -> None:
    assert isinstance(f.prepare_static_case(bad), a.Refused)
    assert isinstance(f.execute_static_call(bad, 0, ()), a.Refused)


@pytest.mark.parametrize("bad", [True, -1, 1.0, 2, "0"])
def test_call_domain_refuses_aliases_without_execution(bad: object) -> None:
    assert isinstance(execute(prepared("artifact/control"), bad), a.Refused)


@pytest.mark.parametrize(
    "variant",
    ["reorder", "duplicate", "missing", "wrong-byte-type", "unexpected-support"],
)
def test_input_roles_and_immutable_support_are_exact(variant: str) -> None:
    case = prepared("artifact/control")
    inputs: Any = case.Inputs
    support = case.SupportingArtifacts
    if variant == "reorder":
        inputs = tuple(reversed(inputs))
    elif variant == "duplicate":
        inputs = inputs + inputs[:1]
    elif variant == "missing":
        inputs = inputs[1:]
    elif variant == "wrong-byte-type":
        malformed: Any = bytearray(inputs[0].Raw)
        inputs = (c.NamedInput(inputs[0].Role, malformed), *inputs[1:])
    else:
        support = (f.SupportingArtifact("extra", b"a", b"a"),)
    assert isinstance(f.execute_static_call(case.CaseId, 0, inputs, support), a.Refused)


def test_link_context_is_explicit_and_support_is_neither_dropped_nor_unbound() -> None:
    assert isinstance(f.prepare_static_case("links/control"), a.Refused)
    for context in (
        asdict(CONTEXT),
        replace(CONTEXT, SourceCommit="A" * 40),
        replace(CONTEXT, ProtocolSha256="0" * 64),
    ):
        assert isinstance(
            f.prepare_static_case("links/control", context=context), a.Refused
        )
    case = prepared("links/control")
    assert isinstance(
        execute(replace(case, SupportingArtifacts=case.SupportingArtifacts[:-1])),
        b.BindingSubjectsRefused,
    )
    duplicate = case.SupportingArtifacts + case.SupportingArtifacts[:1]
    assert isinstance(execute(replace(case, SupportingArtifacts=duplicate)), a.Refused)
    changed = (
        replace(case.SupportingArtifacts[0], Original=b"{}"),
        *case.SupportingArtifacts[1:],
    )
    assert isinstance(
        execute(replace(case, SupportingArtifacts=changed)), b.BindingSubjectsRefused
    )


def test_execution_uses_actual_input_bytes_and_never_regenerates_fixture(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    case = prepared("json/control")
    changed = replace(case, Inputs=(c.NamedInput("raw", b"{"),))
    monkeypatch.setattr(
        f,
        "prepare_static_case",
        lambda *_args, **_kwargs: pytest.fail("regenerated fixture"),
    )
    result = execute(changed)
    assert isinstance(result, a.Refused) and result.code == "json-parse"
