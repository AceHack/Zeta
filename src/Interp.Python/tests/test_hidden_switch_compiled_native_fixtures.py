"""Owned hand-derived fixtures and actual Python dispatch; no new native runs."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import struct
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_certificate as c
from zeta_interp import hidden_switch_compiled_certificate_cases as corpus
from zeta_interp import hidden_switch_compiled_choice_replay as choice
from zeta_interp import hidden_switch_compiled_conformance as contract
from zeta_interp import hidden_switch_compiled_falsifiers as semantic
from zeta_interp import hidden_switch_compiled_ieee as s
from zeta_interp import hidden_switch_compiled_native_fixtures as f
from zeta_interp import hidden_switch_compiled_outer_negatives as selector


def _encode(value: object) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=True
    ).encode("ascii")


def _decoded(raw: bytes) -> Any:
    parsed = a.strict_json(raw)
    assert isinstance(parsed, a.Admitted), parsed
    return parsed.value


@pytest.fixture(scope="module")
def supplied() -> dict[str, Any]:
    root = Path(__file__).resolve().parents[3]
    base = root / "docs/research/hidden-switch-compiled-validation/2026-09-07"
    native = gzip.decompress(
        (base / "native-semantic-replay-attempt-1/native-semantic.json.gz").read_bytes()
    )
    assert (
        hashlib.sha256(native).hexdigest().upper()
        == "E83775583A18712E4495EB57EFAC80A61316129E85D4EFAC0D02C8E1AB6C1451"
    )
    invocation = gzip.decompress(
        (
            base / "native-invocation-replay-attempt-1/native-invocations.json.gz"
        ).read_bytes()
    )
    assert (
        hashlib.sha256(invocation).hexdigest().upper()
        == "9EBBC621583A24BF45DB3AD50F665CCD3EF3D4A7070004F9CDF4E58D705FD78D"
    )
    observed = _decoded(native)
    bindings = observed["CertificateBindings"]
    built = c.build_certificate(bindings)
    assert isinstance(built, s.Success)
    verified = c.verify_certificate(built.value, bindings)
    assert isinstance(verified, s.Success)
    payload = observed["Payload"]
    # Derived role-byte fixtures retain actual native values. This does not admit
    # placeholder bindings as the final source/runtime roster or launch native.
    return {
        "certificate": verified.value,
        "expected_bindings": bindings,
        "certificate_raw": _encode(built.value),
        "bindings_raw": b" \n" + _encode(bindings) + b"\n",
        "hand_slices_raw": _encode(
            {key: payload[key] for key in ("Scalars", "Episodes", "OldControls")}
        ),
        "semantic_raw": _encode(payload["Semantic"]),
        "selector_raw": _encode(_decoded(invocation)["SelectorWitness"]),
        "choice_context_raw": _encode(
            {
                "CertificateId": "certificate",
                "SourceManifestSha256": "A" * 64,
                "NativeRecordSha256": "B" * 64,
                "Passes": 2,
            }
        ),
    }


@pytest.fixture(scope="module")
def prepared(supplied: dict[str, Any]) -> f.PreparedNativeFixtures:
    result = f.prepare_native_fixtures(**supplied)
    assert isinstance(result, s.Success), result
    return result.value


def _case(prepared: f.PreparedNativeFixtures, name: str) -> f.PreparedCase:
    return next(row for row in prepared.Cases if row.CaseId == name)


def _inputs(row: f.PreparedCase) -> dict[str, bytes]:
    return {item.Role: item.Raw for item in row.Inputs}


def test_all38_cases_keep_exact_contract_and_uncounted_preparation(
    supplied: dict[str, Any],
    prepared: f.PreparedNativeFixtures,
) -> None:
    specs = tuple(row for row in contract.case_specs() if row.CaseId in f.CASE_IDS)
    assert len(specs) == len(prepared.Cases) == 38
    assert sum(len(row.Calls) for row in prepared.Cases) == 74
    assert prepared.CompletedOperation == 0 and prepared.Preparation
    assert any(
        row.Helper == "certificate-cases" and isinstance(row.Result, s.Success)
        for row in prepared.Preparation
    )
    for actual, expected in zip(prepared.Cases, specs, strict=True):
        assert (
            actual.CaseId == expected.CaseId and actual.ControlId == expected.ControlId
        )
        assert actual.Calls == expected.Calls
        assert tuple(item.Role for item in actual.Inputs) == expected.InputRoles
        assert all(type(item.Raw) is bytes for item in actual.Inputs)
    certificates = prepared.Cases[:31]
    assert len({_inputs(row)["raw"] for row in certificates}) == 31
    assert all(
        _inputs(row)["bindings"] == supplied["bindings_raw"] for row in certificates
    )
    assert (
        _inputs(_case(prepared, "semantic/full-hand"))["hand-slices"]
        == supplied["hand_slices_raw"]
    )
    assert (
        _inputs(_case(prepared, "selector/epsilon-tie"))["witness"]
        == supplied["selector_raw"]
    )


def test_actual43_python_calls_and31_unexecuted_native_slots(
    prepared: f.PreparedNativeFixtures,
) -> None:
    completed, pending = 0, 0
    for row in prepared.Cases:
        for index, spec in enumerate(row.Calls):
            actual = f.dispatch_native_fixture(prepared, row.CaseId, index)
            if spec.Operation == "native-certificate-verify":
                assert isinstance(actual, f.NativeCallPending)
                assert actual.CompletedOperation == 0 and actual.Call == spec
                assert actual.Inputs == row.Inputs
                pending += 1
                continue
            assert isinstance(actual, f.Dispatched), actual
            assert (
                actual.CompletedOperation == 1
                and actual.Call.Operation == spec.Operation
            )
            assert actual.Call.InputRoles == spec.InputRoles
            result = actual.Call.Result
            if row.CaseId.startswith("certificate/"):
                assert isinstance(result, corpus.PythonOutcome)
                assert result.Accepted == (row.CaseId == "certificate/baseline")
            elif row.CaseId == "semantic/full-hand":
                assert isinstance(result, s.Success)
                replay = result.value
                assert isinstance(replay, semantic.SemanticFalsifierReplay)
                assert replay.Completed == semantic.FalsifierCounts(
                    222, 48, 24, 10, 10, 53, 15, 10, 8
                )
                assert len(replay.MutantRefusals) == 2
            elif row.CaseId == "selector/epsilon-tie":
                assert isinstance(result, s.Success) and isinstance(
                    result.value, selector.SelectorTieReplay
                )
                assert result.value.ActualAction == 0 and result.value.MutantAction == 1
            elif row.CaseId == "choice/control":
                assert isinstance(result, s.Success) and isinstance(
                    result.value, choice.BufferReplayCounts
                )
                assert result.value.Calls == 4 and result.value.Bytes == 112
                assert result.value.Passes == 2 and result.value.TuplePositions == 2
                assert (
                    result.value.Strategy
                    == ("native-recursive", "compiled-guarded")[index]
                )
            else:
                assert isinstance(result, choice.BufferReplayFailure), result
                if row.CaseId == "choice/late-counter":
                    assert result.CompletedCalls == 2 and result.CompletedBytes == 56
                    assert result.Path == "Choices[2]"
                else:
                    assert result.CompletedCalls == 0
            completed += 1
    assert (completed, pending) == (43, 31)


def test_choices_are_actual_positions_zero_one_for_both_passes_and_strategies(
    supplied: dict[str, Any],
    prepared: f.PreparedNativeFixtures,
) -> None:
    inputs = _inputs(_case(prepared, "choice/control"))
    scalars = _decoded(supplied["hand_slices_raw"])["Scalars"]
    assert _decoded(inputs["tuples"]) == [
        {key: scalars[i]["Input"][key] for key in ("BeliefBits", "Effect", "Depth")}
        for i in (0, 1)
    ]
    assert _decoded(inputs["tuples"])[0]["BeliefBits"] == "8000000000000000"
    for buffer, field in (("native-buffer", "Native"), ("compiled-buffer", "Compiled")):
        expected = [scalars[index][field] for index in (0, 1, 0, 1)]
        raw = inputs[buffer]
        assert len(raw) == 112 and raw[:28] != raw[28:56]
        for index, row in enumerate(expected):
            decoded = a.decode_choice(raw[index * 28 : (index + 1) * 28], "test")
            assert isinstance(decoded, a.Admitted) and decoded.value == row
        late = _inputs(_case(prepared, "choice/late-counter"))[buffer]
        offset = 68
        assert late[:offset] == raw[:offset] and late[offset + 4 :] == raw[offset + 4 :]
        assert (
            struct.unpack_from("<I", late, offset)[0]
            == struct.unpack_from("<I", raw, offset)[0] + 1
        )
        assert _inputs(_case(prepared, "choice/truncated"))[buffer] == raw[:-28]
        assert (
            _inputs(_case(prepared, "choice/reordered"))[buffer]
            == raw[28:56] + raw[:28] + raw[56:]
        )
        reserved = _inputs(_case(prepared, "choice/reserved-byte"))[buffer]
        assert reserved[:2] == raw[:2] and reserved[2] == 1 and reserved[3:] == raw[3:]


def test_constructor_cached_python_outcome_cannot_replace_live_dispatch(
    prepared: f.PreparedNativeFixtures,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[bytes, object]] = []
    sentinel = corpus.PythonOutcome(
        False, "test-only-live-marker", "Marker", None, "new actual return", None
    )

    def called(raw: bytes, bindings: object) -> corpus.PythonOutcome:
        calls.append((raw, bindings))
        return sentinel

    monkeypatch.setattr(corpus, "python_outcome", called)
    first = f.dispatch_native_fixture(prepared, "certificate/baseline", 0)
    second = f.dispatch_native_fixture(prepared, "certificate/baseline", 0)
    assert isinstance(first, f.Dispatched) and isinstance(second, f.Dispatched)
    assert first.Call.Result is second.Call.Result is sentinel and len(calls) == 2
    assert calls[0][0] == _inputs(prepared.Cases[0])["raw"]


def test_all_native_slots_make_no_python_substitution(
    prepared: f.PreparedNativeFixtures,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def forbidden(*args: object, **kwargs: object) -> Any:
        pytest.fail("native slot attempted a Python computation")

    monkeypatch.setattr(corpus, "python_outcome", forbidden)
    monkeypatch.setattr(semantic, "replay_semantic_falsifiers", forbidden)
    monkeypatch.setattr(choice, "replay_choice_buffer", forbidden)
    monkeypatch.setattr(selector, "replay_selector_tie", forbidden)
    for case in prepared.Cases[:31]:
        result = f.dispatch_native_fixture(prepared, case.CaseId, 1)
        assert (
            isinstance(result, f.NativeCallPending) and result.CompletedOperation == 0
        )


@pytest.mark.parametrize(
    "name", ["semantic/full-hand", "selector/epsilon-tie", "choice/control"]
)
def test_each_noncertificate_dispatch_calls_live_public_checker(
    prepared: f.PreparedNativeFixtures,
    monkeypatch: pytest.MonkeyPatch,
    name: str,
) -> None:
    calls: list[tuple[object, ...]] = []
    marker = s.Failure("LiveMarker", "test-only actual checker return")

    def called(*args: object, **kwargs: object) -> s.Failure:
        calls.append(args)
        return marker

    module, target = {
        "semantic/full-hand": (semantic, "replay_semantic_falsifiers"),
        "selector/epsilon-tie": (selector, "replay_selector_tie"),
        "choice/control": (choice, "replay_choice_buffer"),
    }[name]
    monkeypatch.setattr(module, target, called)
    result = f.dispatch_native_fixture(prepared, name, 0)
    assert isinstance(result, f.Dispatched) and result.Call.Result is marker
    assert result.CompletedOperation == 1 and len(calls) == 1


@pytest.mark.parametrize(
    "case,index",
    [
        (None, 0),
        (True, 0),
        ("source/control", 0),
        ("choice/control", True),
        ("choice/control", -1),
        ("choice/control", 2),
    ],
)
def test_invalid_dispatch_cannot_count_a_call(
    prepared: f.PreparedNativeFixtures, case: object, index: object
) -> None:
    result = f.dispatch_native_fixture(prepared, case, index)
    assert isinstance(result, f.DispatchFailure) and result.CompletedOperation == 0


def test_unissued_or_copied_handle_refuses(prepared: f.PreparedNativeFixtures) -> None:
    values: tuple[object, ...] = (None, {}, replace(prepared))
    for value in values:
        result = f.dispatch_native_fixture(value, "certificate/baseline", 0)
        assert (
            isinstance(result, f.DispatchFailure)
            and result.Code == "FixtureNotPrepared"
        )


@pytest.mark.parametrize(
    "field,prefix",
    [
        ("hand_slices_raw", 31),
        ("semantic_raw", 31),
        ("selector_raw", 32),
        ("choice_context_raw", 33),
    ],
)
def test_later_parse_failure_retains_prepared_cases_inputs_and_real_helpers(
    supplied: dict[str, Any],
    field: str,
    prefix: int,
) -> None:
    given = dict(supplied)
    given[field] = b"{truncated"
    result = f.prepare_native_fixtures(**given)
    assert isinstance(result, f.PreparationFailure)
    assert len(result.Cases) == prefix and result.CompletedOperation == 0
    assert result.Cases[0].CaseId == "certificate/baseline"
    assert result.Cases[-1].CaseId == f.CASE_IDS[prefix - 1]
    assert result.Inputs[-1].Raw == b"{truncated"
    assert isinstance(result.Preparation[-1].Result, a.Refused)
    assert any(
        row.Helper == "certificate-cases" and isinstance(row.Result, s.Success)
        for row in result.Preparation
    )


@pytest.mark.parametrize(
    "mutation",
    [
        "binding-key",
        "binding-value",
        "binding-duplicate",
        "certificate",
        "unissued",
        "raw-type",
        "over-bound",
    ],
)
def test_binding_and_certificate_admission_refuses_without_prepared_cases(
    supplied: dict[str, Any],
    mutation: str,
) -> None:
    given = dict(supplied)
    if mutation.startswith("binding"):
        binding = copy.deepcopy(supplied["expected_bindings"])
        if mutation == "binding-key":
            binding["unlisted"] = "C" * 64
        elif mutation == "binding-value":
            binding["hand-validation"] = "C" * 64
        if mutation == "binding-duplicate":
            given["bindings_raw"] = b'{"x":0,"x":1}'
        else:
            given["bindings_raw"] = _encode(binding)
    elif mutation == "certificate":
        raw = _decoded(given["certificate_raw"])
        raw["Model"]["EpsilonBits"] = "0000000000000000"
        given["certificate_raw"] = _encode(raw)
    elif mutation == "unissued":
        given["certificate"] = replace(supplied["certificate"])
    elif mutation == "raw-type":
        given["certificate_raw"] = "{}"
    else:
        given["bindings_raw"] = b"x" * (f.MAX_BINDINGS_BYTES + 1)
    result = f.prepare_native_fixtures(**given)
    assert isinstance(result, f.PreparationFailure) and result.CompletedOperation == 0
    assert not result.Cases


@pytest.mark.parametrize(
    "mutation", ["index", "bits", "bool-counter", "same-record", "nodes-overflow"]
)
def test_choice_preparation_refuses_bad_actual_positions_or_vacuous_mutation(
    supplied: dict[str, Any],
    mutation: str,
) -> None:
    given = dict(supplied)
    hand = _decoded(given["hand_slices_raw"])
    rows = hand["Scalars"]
    if mutation == "index":
        rows[0]["Input"]["Index"] = 1
    elif mutation == "bits":
        rows[0]["Input"]["BeliefBits"] = "0000000000000000"
    elif mutation == "bool-counter":
        rows[0]["Native"]["Nodes"] = True
    elif mutation == "same-record":
        rows[1]["Compiled"] = rows[0]["Compiled"]
    else:
        rows[0]["Native"]["Nodes"] = (1 << 32) - 1
    given["hand_slices_raw"] = _encode(hand)
    result = f.prepare_native_fixtures(**given)
    assert isinstance(result, f.PreparationFailure) and result.CompletedOperation == 0
    assert len(result.Cases) == (34 if mutation == "nodes-overflow" else 33)
    assert result.Preparation


@pytest.mark.parametrize(
    "mutation", ["extra", "id", "passes-bool", "passes-one", "source", "native"]
)
def test_exact_choice_context_is_required(
    supplied: dict[str, Any], mutation: str
) -> None:
    given = dict(supplied)
    context = _decoded(given["choice_context_raw"])
    if mutation == "extra":
        context["Extra"] = 0
    elif mutation == "id":
        context["CertificateId"] = "other"
    elif mutation == "passes-bool":
        context["Passes"] = True
    elif mutation == "passes-one":
        context["Passes"] = 1
    elif mutation == "source":
        context["SourceManifestSha256"] = "a" * 64
    else:
        context["NativeRecordSha256"] = None
    given["choice_context_raw"] = _encode(context)
    result = f.prepare_native_fixtures(**given)
    assert isinstance(result, f.PreparationFailure) and len(result.Cases) == 33
    assert result.Inputs[-1].Raw == given["choice_context_raw"]


def test_real_preparation_never_executes_policy_or_source_entrypoints(
    supplied: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from zeta_interp import hidden_switch_compiled_reference as reference

    def forbidden(*args: object, **kwargs: object) -> Any:
        pytest.fail("fixture preparation executed a policy/source entry")

    for name in (
        "source_tapes",
        "run_episode",
        "native_choice",
        "compiled_choice",
        "evaluate_bits",
    ):
        monkeypatch.setattr(reference, name, forbidden)
    result = f.prepare_native_fixtures(**supplied)
    assert isinstance(result, s.Success) and len(result.value.Cases) == 38


def test_failed_actual_helper_result_survives_preparation_refusal(
    supplied: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    marker = s.Failure("HelperMarker", "test-only actual helper refusal")

    def refused(bindings: object) -> s.Failure:
        return marker

    monkeypatch.setattr(corpus, "certificate_cases", refused)
    result = f.prepare_native_fixtures(**supplied)
    assert isinstance(result, f.PreparationFailure) and result.Code == "HelperMarker"
    assert result.Preparation[-1].Helper == "certificate-cases"
    assert result.Preparation[-1].Result is marker
    assert len(result.Inputs) == 2 and not result.Cases


def test_certificate_binding_identity_is_not_only_a_matching_digest_string(
    supplied: dict[str, Any],
) -> None:
    given = dict(supplied)
    given["expected_bindings"] = {
        **supplied["expected_bindings"],
        "extra-source": "D" * 64,
    }
    result = f.prepare_native_fixtures(**given)
    assert isinstance(result, f.PreparationFailure) and result.Code == "FixtureBindings"
    assert not result.Preparation and result.CompletedOperation == 0


def test_changed_terminal_control_is_a_real_dispatched_replay_failure(
    supplied: dict[str, Any],
) -> None:
    given = dict(supplied)
    hand = _decoded(given["hand_slices_raw"])
    before = hand["OldControls"][-1]["Episode"]["Beliefs"][-1]
    hand["OldControls"][-1]["Episode"]["Beliefs"][-1] = 0.0 if before != 0.0 else 1.0
    given["hand_slices_raw"] = _encode(hand)
    result = f.prepare_native_fixtures(**given)
    assert isinstance(result, s.Success)
    actual = f.dispatch_native_fixture(result.value, "semantic/full-hand", 0)
    assert isinstance(actual, f.Dispatched) and actual.CompletedOperation == 1
    failure = actual.Call.Result
    assert isinstance(failure, semantic.SemanticFalsifierFailure)
    assert failure.Completed.ScalarPositions == 222
    assert failure.Completed.NewHandEpisodes == 48
    assert failure.Completed.OldControlEpisodes == 23


def test_prepared_bytes_do_not_follow_later_caller_mapping_mutation(
    supplied: dict[str, Any],
) -> None:
    given = {**supplied, "expected_bindings": dict(supplied["expected_bindings"])}
    result = f.prepare_native_fixtures(**given)
    assert isinstance(result, s.Success)
    before = tuple(row.Inputs for row in result.value.Cases)
    given["expected_bindings"]["hand-validation"] = "E" * 64
    given["bindings_raw"] = b"different bytes"
    assert tuple(row.Inputs for row in result.value.Cases) == before
    actual = f.dispatch_native_fixture(result.value, "certificate/baseline", 0)
    assert isinstance(actual, f.Dispatched)
    assert (
        isinstance(actual.Call.Result, corpus.PythonOutcome)
        and actual.Call.Result.Accepted
    )
